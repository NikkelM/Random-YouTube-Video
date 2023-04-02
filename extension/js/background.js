// Background script for the extension, which is run ("started") on extension initialization
// Handles communication between the extension and the content script as well as firebase

let configSync = null;

// ---------- Initialization/Chrome event listeners ----------

// On Chrome startup, we make sure we are not using too much local storage
chrome.runtime.onStartup.addListener(async function () {
	// If over 90% of the storage quota for playlists is used, remove playlists that have not been accessed in a long time
	const utilizedStorage = await chrome.storage.local.getBytesInUse();
	const maxLocalStorage = chrome.storage.local.QUOTA_BYTES;

	console.log(`${((utilizedStorage / maxLocalStorage) * 100).toFixed(2)}% of local storage is used. (${utilizedStorage}/${maxLocalStorage} bytes)`);

	if (maxLocalStorage * 0.9 < utilizedStorage) {
		console.log("Local storage is over 90% utilized. Removing playlists that have not been accessed the longest...");

		// Get all playlists from local storage
		const localStorageContents = await chrome.storage.local.get();

		// We only need the keys that hold playlists, which is signified by the existence of the "videos" sub-key
		const allPlaylists = Object.fromEntries(Object.entries(localStorageContents).filter(([k, v]) => v["videos"]));

		// Sort the playlists by lastAccessedLocally value
		const sortedPlaylists = Object.entries(allPlaylists).sort((a, b) => {
			return new Date(b[1]["lastAccessedLocally"] ?? 0) - new Date(a[1]["lastAccessedLocally"] ?? 0);
		});

		// Remove the 20% of playlists that have not been accessed the longest
		const playlistsToRemove = sortedPlaylists.slice(Math.floor(sortedPlaylists.length * 0.8));
		for (const [playlistId, playlistInfo] of playlistsToRemove) {
			console.log(`Removing playlist ${playlistId} from local storage...`);
			chrome.storage.local.remove(playlistId);
		}
	}
});

// Check whether new version is installed
chrome.runtime.onInstalled.addListener(async function (details) {
	const manifestData = chrome.runtime.getManifest();

	if (details.reason == "update" && details.previousVersion !== manifestData.version) {
		await handleExtensionUpdate(manifestData, details.previousVersion);
	}

	// Validate the config in sync storage
	await validateConfigSync();
});

async function handleExtensionUpdate(manifestData, previousVersion) {
	console.log(`Extension was updated to version v${manifestData.version}`);

	// Handle changes that may be specific to a certain version change
	await handleVersionSpecificUpdates(previousVersion);

	// This variable indicates if the local storage should be cleared when updating to the newest version
	// Should only be true if changes were made to the data structure, requiring users to get the new data format from the database
	// Provide reason for clearing if applicable
	// Reason: N/A
	// Version before change: N/A
	const clearLocalStorageOnUpdate = false;

	if (clearLocalStorageOnUpdate) {
		console.log("The storage structure has changed and local storage must be reset. Clearing...");
		await chrome.storage.local.clear();
	}
}

async function handleVersionSpecificUpdates(previousVersion) {
	// v1.3.0 removed the "youtubeAPIKey" key from local storage, which was replaced by the "youtubeAPIKeys" key
	if (previousVersion < "1.3.0") {
		const localStorageContents = await chrome.storage.local.get();
		// Delete the youtubeAPIKey from local storage if it exists
		if (localStorageContents["youtubeAPIKey"]) {
			await chrome.storage.local.remove("youtubeAPIKey");
		}
	}
}

async function validateConfigSync() {
	// All keys regarding user settings and their defaults
	const configSyncDefaults = {
		// If the user has enabled the custom API key option
		"useCustomApiKeyOption": false,
		// The custom API key the user has provided. This key is already validated.
		"customYoutubeApiKey": null,
		// If the user has enabled sharing video ID's with the database
		"databaseSharingEnabledOption": true,
		// These two properties influence the behavior of the "shuffle" button
		"shuffleOpenInNewTabOption": false,
		"shuffleOpenAsPlaylistOption": true,
		// channelSettings is a dictionary of channelID -> Dictionary of channel settings
		"channelSettings": {},
		// These two properties are used by the popup to determine which channel's settings to show
		"currentChannelId": null,
		"currentChannelName": null,
		// The number of videos the user has shuffled so far
		"numShuffledVideosTotal": 0,
		// These two properties determine the amount of quota remaining today, and the time at which the quota will next reset (daily resets at midnight)
		"userQuotaRemainingToday": 200,
		// The default reset time is midnight of the next day
		"userQuotaResetTime": new Date(new Date().setHours(24, 0, 0, 0)).getTime(),
		// We want to regularly check if there are new API keys available (weekly)
		"nextAPIKeysCheckTime": new Date(new Date().setHours(168, 0, 0, 0)).getTime(),
		// For april fools: Will be the number of the year in which the user was last rickrolled (we only want to rickroll the user once per year)
		"wasLastRickRolledInYear": "1970",
	};

	const configSyncValues = await chrome.storage.sync.get();

	// Set default values for config values that do not exist in sync storage
	for (const [key, value] of Object.entries(configSyncDefaults)) {
		if (configSyncValues[key] === undefined) {
			console.log(`Config value (setting) "${key}" does not exist in sync storage. Setting default:`);
			console.log(value);
			await chrome.storage.sync.set({ [key]: value });
		}
	}

	// Remove old config values from sync storage
	for (const [key, value] of Object.entries(configSyncValues)) {
		if (configSyncDefaults[key] === undefined) {
			console.log(`Config value (setting) "${key}" is not used anymore (was removed with the most recent update). Removing it from sync storage...`);
			await chrome.storage.sync.remove(key);
		}
	}
}

// The shuffling page will open a port when it is started
// By default, the port closing will cause the service worker to be reloaded, as this will fix a freezing issue
chrome.runtime.onConnect.addListener(function (port) {
	if (port.name === "shufflingPage") {
		port.onDisconnect.addListener(reloadServiceWorker);

		port.onMessage.addListener(function (msg) {
			if (msg.command === "shuffleComplete") {
				port.onDisconnect.removeListener(reloadServiceWorker);
			}
		});
	}
});

// This will reload the service orker, which will invalidate the extension context for all YouTube tabs
function reloadServiceWorker() {
	console.log("Shuffling page was closed before the shuffle was completed. Reloading service worker to prevent freezing...");
	chrome.runtime.reload();
}

// ---------- Message handler ----------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	switch (request.command) {
		// Tries to get the playlist from Firebase
		case "getPlaylistFromDB":
			readDataOnce('uploadsPlaylists/' + request.data).then(sendResponse);
			break;
		// Updates (without overwriting videos) the playlist in Firebase 
		case "updatePlaylistInfoInDB":
			updatePlaylistInfoInDB(request.data.key, request.data.val, false).then(sendResponse);
			break;
		// Updates (with overwriting videos, as some were deleted and we do not grant 'delete' permissions) the playlist in Firebase
		case "overwritePlaylistInfoInDB":
			updatePlaylistInfoInDB(request.data.key, request.data.val, true).then(sendResponse);
		// Gets an API key depending on user settings
		case "getAPIKey":
			getAPIKey(false, request.data.useAPIKeyAtIndex).then(sendResponse);
			break;
		// Gets the default API keys saved in the database
		case "getDefaultAPIKeys":
			getAPIKey(true, null).then(sendResponse);
			break;
		// A new configSync should be set
		case "newConfigSync":
			configSync = request.data;
			sendResponse("New configSync set.");
			break;
		default:
			console.log(`Unknown command: ${request.command} (service worker). Hopefully another message listener will handle it.`);
			sendResponse(`Unknown command: ${request.command} (service worker). Hopefully another message listener will handle it.`);
			break;
	}
	return true;
});

// ---------- Firebase ----------

self.importScripts('../firebase/firebase-compat.js');

const firebaseConfig = {
	apiKey: "AIzaSyA6d7Ahi7fMB4Ey8xXM8f9C9Iya97IGs-c",
	authDomain: "random--video-ex-chrome.firebaseapp.com",
	projectId: "random-youtube-video-ex-chrome",
	storageBucket: "random-youtube-video-ex-chrome.appspot.com",
	messagingSenderId: "141257152664",
	appId: "1:141257152664:web:f70e46e35d02921a8818ed",
	databaseURL: "https://random-youtube-video-ex-chrome-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.database(app);

async function updatePlaylistInfoInDB(playlistId, playlistInfo, overwriteVideos) {
	if (overwriteVideos) {
		console.log("Setting playlistInfo in the database...");
		// Update the entire object. Due to the way Firebase works, this will overwrite the existing 'videos' object, as it is nested within the playlist
		db.ref(playlistId).update(playlistInfo);
	} else {
		console.log("Updating playlistInfo in the database...");
		// Contains all properties except the videos
		const playlistInfoWithoutVideos = Object.fromEntries(Object.entries(playlistInfo).filter(([key, value]) => key !== "videos"));

		// Upload the 'metadata'
		db.ref(playlistId).update(playlistInfoWithoutVideos);

		// Update the videos separately to not overwrite the existing videos
		db.ref(playlistId + "/videos").update(playlistInfo.videos);
	}

	return "PlaylistInfo was sent to database.";
}

// Prefers to get cached data instead of sending a request to the database
async function readDataOnce(key) {
	console.log(`Reading data for key ${key} from database...`);
	const res = await db.ref(key).once("value").then((snapshot) => {
		return snapshot.val();
	});

	return res;
}

// ---------- Helpers ----------

async function getAPIKey(forceDefault, useAPIKeyAtIndex = null) {
	await fetchConfigSync();

	// List of API keys that are stored in the database/locally
	let availableAPIKeys = null;

	// If the user has opted to use a custom API key, use that instead of the default one
	if (!forceDefault && configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey) {
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
		setLocalStorage("youtubeAPIKeys", availableAPIKeys);

		console.log("API keys were fetched. Next check will be in one week.");
		// Set the next time to check for API keys to one week from now
		configSync.nextAPIKeysCheckTime = new Date(new Date().setHours(168, 0, 0, 0)).getTime();
		await setSyncStorageValue("nextAPIKeysCheckTime", configSync.nextAPIKeysCheckTime);
	}

	if (forceDefault) {
		// Return a list of all API keys
		return { APIKey: availableAPIKeys.map(key => rot13(key, false)), isCustomKey: false, keyIndex: null };
	}

	let usedIndex = null;
	let chosenAPIKey = null;
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

// ---------- Local storage ----------

async function getFromLocalStorage(key) {
	return await chrome.storage.local.get([key]).then((result) => {
		if (result[key]) {
			return result[key];
		}
		return null;
	});
}

async function setLocalStorage(key, value) {
	await chrome.storage.local.set({ [key]: value });
	return value;
}

// ---------- Sync storage ----------

async function fetchConfigSync() {
	configSync = await chrome.storage.sync.get().then((result) => {
		return result;
	});

	return configSync;
}

// This function also exists in utils.js
async function setSyncStorageValue(key, value) {
	configSync[key] = value;

	await chrome.storage.sync.set({ [key]: value });
}