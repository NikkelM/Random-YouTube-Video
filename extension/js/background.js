// Background script for the extension, which is run on extension initialization
// Handles communication between the extension and the content script

let APIKey = null;

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.command === "get_API_key") {
		sendResponse(APIKey);
	} else if (request.command === "set_API_key") {
		console.log("Setting API key to: " + request.data.val);
		APIKey = request.data.val;
		setLocalStorage("API_KEY", request.data.val).then(sendResponse);
	}

	return true;
});

initExtension();

// ---------- functions ----------

async function initExtension() {
	chrome.storage.local.get(console.log);
	console.log("Initializing extension, getting API key...");
	APIKey = await getFromLocalStorage("API_KEY");
	console.log("API key: " + APIKey);
}

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

// ---------- firebase ----------
try {
	self.importScripts('../firebase/firebase-compat.js');

	const firebaseConfig = {
		apiKey: "AIzaSyA6d7Ahi7fMB4Ey8xXM8f9C9Iya97IGs-c",
		authDomain: "random--video-ex-chrome.firebaseapp.com",
		projectId: "random-youtube-video-ex-chrome",
		storageBucket: "random-youtube-video-ex-chrome.appspot.com",
		messagingSenderId: "141257152664",
		appId: "1:141257152664:web:f70e46e35d02921a8818ed",
		databaseURL: "https://random-youtube-video-ex-chrome-default-rtdb.europe-west1.firebasedatabase.app",
		// measurementId: "G-51M436YZF1",
	};

	const app = firebase.initializeApp(firebaseConfig);
	// console.log(app);

	const db = firebase.database(app);
	// console.log(db);

	chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
		if (request.command === 'get') {
			readDataOnce(request.data.key).then(sendResponse);
		}	else if (request.command === "post") {
			writeData(request.data.key, request.data.val).then(sendResponse);
		}

		return true;
	});

	async function writeData(key, val) {
		db.ref(key).update(val);
		return "Update sent to database."
	}

	// Prefers to get cached data instead of sending a request to the database
	async function readDataOnce(key) {
		const res = await db.ref(key).once('value').then((snapshot) => {
			return snapshot.val();
		});
		
		return res;
	}

} catch (error) {
	console.log(error);
}