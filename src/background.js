// Background service worker for the extension, which is run ("started") on extension initialization
// Handles communication between the extension and the content script as well as Firebase interactions
import { configSync, setSyncStorageValue } from "./chromeStorage.js";
import { isFirefox, firebaseConfig } from "./config.js";
import { userHasActiveSubscriptionRole } from "./stripe.js";
import { getApp, getApps, initializeApp } from "firebase/app";
import { getDatabase, ref, child, update, get, remove } from "firebase/database";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { countryToCurrency } from "country-to-currency";
// We need to import utils.js to get the console re-routing function
import { } from "./utils.js";

// ---------- Initialization/Chrome event listeners ----------
await initExtension();

// Check whether a new version was installed
async function initExtension() {
	const manifestData = chrome.runtime.getManifest();
	if (configSync.previousVersion === null) {
		console.log(`Extension was installed for the first time (v${manifestData.version})`, true);
		await setSyncStorageValue("previousVersion", manifestData.version);
		const welcomeUrl = chrome.runtime.getURL("html/welcome.html");
		await chrome.tabs.create({ url: welcomeUrl });
	} else if (isFirefox && !await browser.permissions.contains({ permissions: ["tabs"], origins: ["*://*.youtube.com/*"] })) {
		console.log("The extension is running in Firefox and does not have the required permissions.");
		const welcomeUrl = chrome.runtime.getURL("html/welcome.html");
		await chrome.tabs.create({ url: welcomeUrl });
	}
	// 3.0.0 introduced the previousVersion config value, so the update would not be handled correctly here
	if (configSync.previousVersion < manifestData.version || configSync.previousVersion === "3.0.0") {
		await handleExtensionUpdate(manifestData, configSync.previousVersion);
	}

	await checkShufflePlusStatus();
	checkLocalStorageCapacity();
}

// On every startup, we check the claim roles for the user
async function checkShufflePlusStatus() {
	// TODO: If the user has not yet been introduced to Shuffle+, open the introduction page
	// Use a config flag to do so
	if (await userHasActiveSubscriptionRole()) {
		chrome.action.setIcon({
			path: {
				"16": chrome.runtime.getURL("icons/icon-16-white.png"),
				"32": chrome.runtime.getURL("icons/icon-32-white.png"),
				"48": chrome.runtime.getURL("icons/icon-48-white.png"),
				"128": chrome.runtime.getURL("icons/icon-128-white.png")
			}
		});
	}

	await getUserLocaleInfo();
}

// Gets the user's IP, countryCode and local currency to store in session storage
// We are not saving this permanently, as the user's location may change
async function getUserLocaleInfo() {
	// TODO: Find other things that would better be stored in session storage
	// Store the user's country code and local currency in session storage
	const userIP = await fetch("https://api.ipify.org?format=json").then(response => response.json()).then(data => data.ip);
	let userCurrency, userCountryCode = null;
	try {
		const response = await fetch(`http://ip-api.com/json/${userIP}?fields=countryCode,currency`);
		if (response.ok) {
			const data = await response.json();
			// Lowercase, as that's the formatting in Stripe
			userCurrency = data.currency.toLowerCase();
			userCountryCode = data.countryCode;
		}
	} catch (error) {
		console.error("Error fetching user currency:", error);
	}

	if (!userCurrency) {
		userCurrency = countryToCurrency[navigator.language.split("-")[1]].toLowerCase();
	}
	if (!userCountryCode) {
		userCountryCode = navigator.language.split("-")[1];
	}

	chrome.storage.session.set({ userCurrency: userCurrency, userCountryCode: userCountryCode });
}

// Make sure we are not using too much local storage
async function checkLocalStorageCapacity() {
	// If over 90% of the storage quota for playlists is used, remove playlists that have not been accessed in a long time
	const utilizedStorage = isFirefox ? JSON.stringify(await chrome.storage.local.get()).length : await chrome.storage.local.getBytesInUse();
	// Firefox does not offer a way to get the maximum local storage capacity, so we use 5MB as per the documentation
	const maxLocalStorage = isFirefox ? 5000000 : chrome.storage.local.QUOTA_BYTES;

	console.log(`${((utilizedStorage / maxLocalStorage) * 100).toFixed(2)}% of local storage is used. (${utilizedStorage}/${maxLocalStorage} bytes)`, true);

	if (maxLocalStorage * 0.9 < utilizedStorage) {
		console.log("Local storage is over 90% utilized. Removing playlists that have not been accessed the longest to free up some space...", true);

		// Get all playlists from local storage
		const localStorageContents = await chrome.storage.local.get();

		// We only need the keys that hold playlists, which is signified by the existence of the "videos" sub-key
		const allPlaylists = Object.fromEntries(Object.entries(localStorageContents).filter(([_, value]) => value["videos"]));

		// Sort the playlists by lastAccessedLocally value
		const sortedPlaylists = Object.entries(allPlaylists).sort((a, b) => {
			return new Date(b[1]["lastAccessedLocally"] ?? 0) - new Date(a[1]["lastAccessedLocally"] ?? 0);
		});

		// Remove the 20% of playlists that have not been accessed the longest
		const playlistsToRemove = sortedPlaylists.slice(Math.floor(sortedPlaylists.length * 0.8));
		for (const [playlistId, _playlistInfo] of playlistsToRemove) {
			console.log(`Removing playlist ${playlistId} from local storage...`, true);
			chrome.storage.local.remove(playlistId);
		}
	}
}

async function handleExtensionUpdate(manifestData, previousVersion) {
	console.log(`Extension was successfully updated to version v${manifestData.version}`, true);
	await setSyncStorageValue("previousVersion", manifestData.version);

	// Handle changes that may be specific to a certain version change
	await handleVersionSpecificUpdates(previousVersion);

	// This variable indicates if the local storage should be cleared when updating to the newest version
	// Should only be true if changes were made to the data structure, requiring users to get the new data format from the database
	// Provide reason for clearing if applicable
	// Reason: N/A
	// Version before change: N/A
	const clearLocalStorageOnUpdate = false;

	if (clearLocalStorageOnUpdate) {
		console.log("The storage structure has changed and local storage must be reset. Clearing...", true);
		await chrome.storage.local.clear();
	}
}

async function handleVersionSpecificUpdates(previousVersion) {
	// v3.0.1 changed the data type for the shuffleIgnoreShortsOption from boolean to number
	if (previousVersion < "3.0.1") {
		console.log("Updating sync storage to v3.0.1 format...", true);
		const syncStorageContents = await chrome.storage.sync.get();
		if (syncStorageContents["shuffleIgnoreShortsOption"] == true) {
			await setSyncStorageValue("shuffleIgnoreShortsOption", 2);
		} else {
			await setSyncStorageValue("shuffleIgnoreShortsOption", 1);
		}
	}

	// v1.5.0 renamed some keys in the channelSettings object
	if (previousVersion < "1.5.0") {
		console.log("Updating channelSettings to v1.5.0 format...", true);

		let configSyncValues = await chrome.storage.sync.get();

		// For each object entry in channelSettings that has the "shufflePercentage" item, rename it to "percentageValue" and add a new key "activeOption": "percentageOption"
		for (const [_channelId, channelSetting] of Object.entries(configSyncValues["channelSettings"])) {
			if (channelSetting["shufflePercentage"]) {
				channelSetting["percentageValue"] = channelSetting["shufflePercentage"];
				channelSetting["activeOption"] = "percentageOption";
				delete channelSetting["shufflePercentage"];
			}
		}
		await setSyncStorageValue("channelSettings", configSyncValues["channelSettings"]);
	}

	// v1.3.0 removed the "youtubeAPIKey" key from local storage, which was replaced by the "youtubeAPIKeys" key
	if (previousVersion < "1.3.0") {
		console.log("Updating local storage to v1.3.0 format...", true);
		const localStorageContents = await chrome.storage.local.get();
		// Delete the youtubeAPIKey from local storage if it exists
		if (localStorageContents["youtubeAPIKey"]) {
			await chrome.storage.local.remove("youtubeAPIKey");
		}
	}
}

// The shuffling page will open a port when it is started
// By default, the port closing will cause the service worker to be reloaded, as this will fix a freezing issue
let shufflingPageIsShuffling = false;
chrome.runtime.onConnect.addListener(function (port) {
	if (port.name === "shufflingPage") {
		shufflingPageIsShuffling = true;
		port.onDisconnect.addListener(reloadServiceWorker);

		port.onMessage.addListener(function (msg) {
			if (msg.command === "shuffleComplete") {
				shufflingPageIsShuffling = false;
				port.onDisconnect.removeListener(reloadServiceWorker);
			}
		});
	}
});

// This will reload the service worker, which will invalidate the extension context for all YouTube tabs
function reloadServiceWorker() {
	console.log("Shuffling page was closed before the shuffle was completed. Reloading service worker to prevent freezing...", true);
	chrome.runtime.reload();
}

// ---------- Message handler ----------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	switch (request.command) {
		// Simple connection test from the content script
		case "connectionTest":
			sendResponse("Connection to background script successful.");
			break;
		// Tries to get a playlist from Firebase
		case "getPlaylistFromDB":
			readDataOnce("uploadsPlaylists/" + request.data).then(sendResponse);
			break;
		// Updates (not overwriting videos) a playlist in Firebase 
		case "updatePlaylistInfoInDB":
			updatePlaylistInfoInDB("uploadsPlaylists/" + request.data.key, request.data.val, false).then(sendResponse);
			break;
		// Updates (overwriting videos) a playlist in Firebase
		case "overwritePlaylistInfoInDB":
			updatePlaylistInfoInDB("uploadsPlaylists/" + request.data.key, request.data.val, true).then(sendResponse);
			break;
		// Before v1.0.0 the videos were stored in an array without upload times, so they need to all be re-fetched
		case "updateDBPlaylistToV1.0.0":
			updateDBPlaylistToV1_0_0("uploadsPlaylists/" + request.data.key).then(sendResponse);
			break;
		// Uploads the configSync object to Firestore under the current user's ID
		case "syncUserSettingWithFirestore":
			syncUserSettingWithFirestore(request.data).then(sendResponse);
			break;
		// Gets an API key depending on user settings
		case "getAPIKey":
			getAPIKey(false, request.data.useAPIKeyAtIndex).then(sendResponse);
			break;
		// Gets the default API keys saved in the database
		case "getDefaultAPIKeys":
			getAPIKey(true, null).then(sendResponse);
			break;
		case "getCurrentTabId":
			getCurrentTabId().then(sendResponse);
			break;
		case "getAllYouTubeTabs":
			getAllYouTubeTabs().then(sendResponse);
			break;
		case "openVideoInTabWithId":
			openVideoInTabWithId(request.data.tabId, request.data.videoUrl).then(sendResponse);
			break;
		case "getShufflingPageShuffleStatus":
			sendResponse(shufflingPageIsShuffling);
			break;
		default:
			console.log(`Unknown command: ${request.command} (service worker). Hopefully another message listener will handle it.`);
			sendResponse(`Unknown command: ${request.command} (service worker). Hopefully another message listener will handle it.`);
			break;
	}
	return true;
});

// ---------- Firebase ----------
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const firebase = getDatabase(app);
const firestore = getFirestore(app);

async function updatePlaylistInfoInDB(playlistId, playlistInfo, overwriteVideos) {
	// Find out if the playlist already exists in the database
	// We only need to send this request if we don't already have to overwrite the entry
	let playlistExists = true;
	if (!overwriteVideos) {
		playlistExists = await readDataOnce(playlistId);
	}

	if (overwriteVideos || !playlistExists) {
		console.log("Setting playlistInfo in the database...");
		// Update the entire object. Due to the way Firebase works, this will overwrite the existing "videos" object, as it is nested within the playlist
		update(ref(firebase, playlistId), playlistInfo);
	} else {
		console.log("Updating playlistInfo in the database...");
		// Contains all properties except the videos
		const playlistInfoWithoutVideos = Object.fromEntries(Object.entries(playlistInfo).filter(([key, _]) => (key !== "videos")));

		// Upload the "metadata"
		update(ref(firebase, playlistId), playlistInfoWithoutVideos);

		// Update the videos separately to not overwrite existing videos
		update(ref(firebase, playlistId + "/videos"), playlistInfo.videos);
	}

	return "PlaylistInfo was sent to database.";
}

async function updateDBPlaylistToV1_0_0(playlistId) {
	// Remove all videos from the database
	remove(ref(firebase, playlistId + "/videos"));

	return "Videos were removed from the database playlist.";
}

async function syncUserSettingWithFirestore(settingToSync) {
	const userSettingsRef = doc(firestore, "users", getAuth().currentUser.uid, "userSettings", "configSync");
	await setDoc(userSettingsRef, settingToSync, { merge: true });

	return "User settings uploaded/synced to database.";
}

async function readDataOnce(key) {
	console.log(`Reading data for key ${key} from database...`);

	const res = get(child(ref(getDatabase()), key)).then((snapshot) => {
		return snapshot.val();
	});

	return res;
}

// ---------- Helpers ----------
async function getAPIKey(forceGetAllDefaultKeys, useAPIKeyAtIndex = null) {
	// List of API keys that are stored in the database/locally
	let availableAPIKeys;

	// If the user has opted to use a custom API key, use that instead of the default one
	if (!forceGetAllDefaultKeys && configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey) {
		return {
			APIKey: configSync.customYoutubeApiKey,
			isCustomKey: true,
			keyIndex: null
		};
	} else {
		availableAPIKeys = await getFromLocalStorage("youtubeAPIKeys");
	}

	// If there are no API keys saved in local storage or if we need to perform a periodic check, get them from the database.
	if (!availableAPIKeys || configSync.nextAPIKeysCheckTime < Date.now()) {
		availableAPIKeys = await readDataOnce("youtubeAPIKeys");

		if (!availableAPIKeys) {
			return { APIKey: null, isCustomKey: false, keyIndex: null };
		}

		// The API keys get scrambled and stored locally
		availableAPIKeys = availableAPIKeys.map(key => rot13(key, true));
		setInLocalStorage("youtubeAPIKeys", availableAPIKeys);

		console.log("API keys were fetched. Next check will be in one week.");
		// Set the next time to check for API keys to one week from now
		await setSyncStorageValue("nextAPIKeysCheckTime", new Date(new Date().setHours(168, 0, 0, 0)).getTime());
	}

	if (forceGetAllDefaultKeys) {
		// Return a list of all API keys
		return { APIKey: availableAPIKeys.map(key => rot13(key, false)), isCustomKey: false, keyIndex: null };
	}

	let usedIndex;
	let chosenAPIKey;
	if (useAPIKeyAtIndex === null) {
		// Choose a random one of the available API keys to evenly distribute the quotas
		usedIndex = Math.floor(Math.random() * availableAPIKeys.length);
		chosenAPIKey = availableAPIKeys[usedIndex];
	} else {
		// Use the API key at the specified index, using the first one if the index is out of bounds
		// This variable is set when a previously chosen key already exceeded its quota
		usedIndex = availableAPIKeys[useAPIKeyAtIndex] ? useAPIKeyAtIndex : 0;
		chosenAPIKey = availableAPIKeys[usedIndex];
	}

	// Return the API key, whether or not it is a custom one, and the index of the API key that was used
	return {
		APIKey: rot13(chosenAPIKey, false),
		isCustomKey: false,
		keyIndex: usedIndex
	};
}

// Very simple cipher to scramble a string
function rot13(message, encrypt) {
	const originalAlpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
	const cipher = "nopqrstuvwxyzabcdefghijklmNOPQRSTUVWXYZ0123456789ABCDEFGHIJKLM";
	// do a replace based off of indices
	if (encrypt) {
		return message.replace(/[a-z0-9]/gi, letter => cipher[originalAlpha.indexOf(letter)]);
	} else {
		return message.replace(/[a-z0-9]/gi, letter => originalAlpha[cipher.indexOf(letter)]);
	}
}

// Get all tabs whose url is a YouTube page. Content scripts cannot access the chrome.tabs API
async function getAllYouTubeTabs() {
	return await chrome.tabs.query({ url: "*://*.youtube.com/*" });
}

async function getCurrentTabId() {
	return await chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
		return tabs[0].id;
	});
}

// If we want to open the video in a tab other than the focused one, we need to use the chrome.tabs API, which is not available in content scripts
async function openVideoInTabWithId(tabId, videoUrl) {
	await chrome.tabs.update(tabId, { active: true, url: videoUrl });
	return true;
}

// ---------- Local storage ----------
async function getFromLocalStorage(key) {
	return await chrome.storage.local.get([key]).then((result) => {
		if (result[key] !== undefined) {
			return result[key];
		}
		return null;
	});
}

async function setInLocalStorage(key, value) {
	await chrome.storage.local.set({ [key]: value });
	return value;
}