// Utility functions

// ---------- Console extension ----------

let log = console.log;

console.log = function () {
	var args = Array.from(arguments);
	args.unshift("[youtube-random-video]: ");
	log.apply(console, args);
}

let error = console.error;

console.error = function () {
	var args = Array.from(arguments);
	args.unshift("[youtube-random-video]: ");
	error.apply(console, args);
}

// ---------- Utility functions ----------

// ----- DOM -----

function setDOMTextWithDelay(textElement, newText, delayMS, predicate = () => { return true; }) {
	// Sets the innerHTML of a (text) DOM element after a delay, if a predicate evaluates to true
	// If no predicate is passed, this function will always set the text after the delay
	delay(delayMS).then(() => {
		if (predicate()) {
			textElement.innerText = newText;
		}
	});
}

// ----- URLs -----

function isVideoUrl(url) {
	if (!url) return false;

	const urlParts = url.split("/");
	return urlParts[3].startsWith("watch?v=");
}

// ----- Small utilities -----

// Waits for a certain amount of milliseconds
function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Determines if an object is empty
function isEmpty(obj) {
	return Object.keys(obj).length === 0;
}

// Gets the length of an object
function getLength(obj) {
	return Object.keys(obj).length;
}

// Adds a number of hours to a date
function addHours(date, hours) {
	return new Date(date.getTime() + hours * 3600000);
}

// ----- Storage -----

async function fetchConfigSync() {
	configSync = await chrome.storage.sync.get().then((result) => {
		return result;
	});

	return configSync;
}

// This function also exists in background.js
async function setSyncStorageValue(key, value, passedConfigSync = null) {
	// passedConfigSync is set if this is called from the popup, as for the others the config is a global variable
	if (passedConfigSync) {
		passedConfigSync[key] = value;
	} else {
		configSync[key] = value;
	}

	await chrome.storage.sync.set({ [key]: value });

	// Refresh the config in the background script. Send it like this to avoid a request to the chrome storage API
	chrome.runtime.sendMessage({ command: "newConfigSync", data: passedConfigSync ?? configSync });
}

// Returns the number of requests the user can still make to the Youtube API today
async function getUserQuotaRemainingToday(configSync) {
	// The quota gets reset at midnight
	if (configSync.userQuotaResetTime < Date.now()) {
		configSync.userQuotaRemainingToday = 200;
		configSync.userQuotaResetTime = new Date(new Date().setHours(24, 0, 0, 0)).getTime();
		await setSyncStorageValue("userQuotaRemainingToday", configSync.userQuotaRemainingToday);
		await setSyncStorageValue("userQuotaResetTime", configSync.userQuotaResetTime);
	}
	return configSync.userQuotaRemainingToday;
}

// ---------- Message sending ----------

// Wrapper around sendMessage to work with asynchronous responses
function sendMessage(msg) {
	return new Promise((resolve, reject) => {
		chrome.tabs.sendMessage(msg, (response) => {
			if (response) {
				resolve(response)
			}
			else {
				reject(response)
			}
		});
	})
}

// ----- Errors -----

class RandomYoutubeVideoError extends Error {
	constructor({ code = "RYV-0", message = "", solveHint = "", showTrace = true }) {
		super(message);
		this.code = code;
		this.message = message;
		this.solveHint = solveHint;
		this.showTrace = showTrace;
		this.name = "RandomYoutubeVideoError";
	}
}

class YoutubeAPIError extends RandomYoutubeVideoError {
	constructor(code = "YAPI-0", message = "", reason = "", solveHint = "", showTrace = true) {
		super(message);
		this.code = code;
		this.message = message;
		this.reason = reason;
		this.solveHint = solveHint;
		this.showTrace = showTrace;
		this.name = "YoutubeAPIError";
	}
}