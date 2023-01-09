// Background script for the extension, which is run on extension initialization
// Handles communication between the extension and the content script as well as firebase

let configSync = null;

// ---------- Initialization ----------

async function initializeExtension() {
	const manifestData = chrome.runtime.getManifest();
	console.log("The extension is running on version: " + manifestData.version);

	// This variable indicates if the local storage should be cleared when updating to the newest version
	// Should only be true if changes were made to the data structure, requiring users to get the new data format from the database
	const clearStorageOnUpdate = true;

	// Check if the extension was updated
	getFromLocalStorage("extensionVersion").then((result) => {
		if (result !== manifestData.version) {
			console.log("Extension updated from version " + result + " to " + manifestData.version);

			if (clearStorageOnUpdate) {
				console.log("Variable indicates local storage should be cleared. Clearing...");
				chrome.storage.local.clear();
			}

			// Make sure the current extension version is always saved in local storage
			setLocalStorage("extensionVersion", manifestData.version);
		}
	});

	// If over 90% of the storage quota for playlists is used, remove playlists that have not been accessed in a long time
	const utilizedStorage = await chrome.storage.local.getBytesInUse();
	const maxLocalStorage = chrome.storage.local.QUOTA_BYTES;

	console.log(((utilizedStorage / maxLocalStorage) * 100).toFixed(2) + "% of local storage is used. (" + utilizedStorage + "/" + maxLocalStorage + " bytes)");

	if (maxLocalStorage * 0.9 < utilizedStorage) {
		console.log("Local storage is over 90% utilized. Removing playlists that have not been accessed the longest...");

		// Get all playlists from local storage
		const localStorageContents = await chrome.storage.local.get();

		// We only need the keys that hold playlists
		const allPlaylists = Object.fromEntries(Object.entries(localStorageContents).filter(([k, v]) => v["videos"]));

		// Sort the playlists by lastAccessedLocally value
		const sortedPlaylists = Object.entries(allPlaylists).sort((a, b) => {
			return new Date(b[1]["lastAccessedLocally"]) - new Date(a[1]["lastAccessedLocally"]);
		});

		chrome.storage.local.get(console.log)
		// Remove the 20% of playlists that have not been accessed the longest
		const playlistsToRemove = sortedPlaylists.slice(Math.floor(sortedPlaylists.length * 0.8));
		for (const [playlistId, playlistInfo] of playlistsToRemove) {
			console.log("Removing playlist " + playlistId + " from local storage...");
			chrome.storage.local.remove(playlistId);
		}
		chrome.storage.local.get(console.log)
	}

}

initializeExtension();

// ---------- Message handler ----------

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	switch (request.command) {
		case "getPlaylistFromDB":
			readDataOnce('uploadsPlaylists/' + request.data).then(sendResponse);
			break;
		case "postToDB":
			writeData(request.data.key, request.data.val).then(sendResponse);
			break;
		// Gets the API key depending on user setting
		case "getApiKey":
			getApiKey(false).then(sendResponse);
			break;
		// Gets the default API key saved in the database
		case "getDefaultApiKey":
			getApiKey(true).then(sendResponse);
			break;
		case "refreshConfigSync":
			fetchConfigSync(true).then(sendResponse);
			break;
		default:
			console.log("Unknown command: " + request.command);
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

async function writeData(key, val) {
	console.log("Writing data to database...");
	db.ref(key).update(val);
	return "Update sent to database.";
}

// Prefers to get cached data instead of sending a request to the database
async function readDataOnce(key) {
	console.log("Reading data for key " + key + " from database...");
	const res = await db.ref(key).once("value").then((snapshot) => {
		return snapshot.val();
	});

	return res;
}

// ---------- Helpers ----------

async function getApiKey(forceDefault) {
	await fetchConfigSync(false);

	// If the user has opted to use a custom API key, use that instead of the default one
	if (!forceDefault && configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey) {
		APIKey = configSync.customYoutubeApiKey;
		return APIKey;
	} else {
		APIKey = await getFromLocalStorage("youtubeAPIKey");
	}

	// If the API key is not saved in local storage, get it from the database.
	if (!APIKey) {
		APIKey = await readDataOnce("youtubeAPIKey");
		// The locally stored API key gets scrambled
		setLocalStorage("youtubeAPIKey", rot13(APIKey, true));
		return APIKey;
	}

	return rot13(APIKey, false);
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

async function fetchConfigSync(forceRefresh) {
	if (configSync && !forceRefresh) {
		return configSync;
	}

	configSync = await chrome.storage.sync.get().then((result) => {
		return result;
	});

	return configSync;
}