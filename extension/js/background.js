// Background script for the extension, which is run on extension initialization
// Handles communication between the extension and the content script as well as firebase

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.command === "getPlaylistFromDB") {
		readDataOnce('uploadsPlaylists/' + request.data).then(sendResponse);
	} else if (request.command === "postToDB") {
		writeData(request.data.key, request.data.val).then(sendResponse);
	} else if (request.command === "getAPIKey") {
		getAPIKey().then(sendResponse);
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
	console.log("Reading data from database...");
	const res = await db.ref(key).once("value").then((snapshot) => {
		return snapshot.val();
	});

	return res;
}

// ---------- Helpers ----------

async function getAPIKey() {
	APIKey = await getFromLocalStorage("youtubeAPIKey");
	// If the API key is not saved in local storage, get it from the database
	if (!APIKey) {
		APIKey = await readDataOnce("youtubeAPIKey");
		setLocalStorage("youtubeAPIKey", APIKey);
	}

	return APIKey;
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