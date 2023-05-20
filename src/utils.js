// Utility functions

// ---------- Console extension ----------
export function rerouteConsole() {
	// Reroute console.log and console.error
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
}

// ---------- Utility functions ----------

// ----- DOM -----

export function setDOMTextWithDelay(textElement, newText, delayMS, predicate = () => { return true; }) {
	// Sets the innerHTML of a (text) DOM element after a delay, if a predicate evaluates to true
	// If no predicate is passed, this function will always set the text after the delay
	delay(delayMS).then(() => {
		if (predicate()) {
			textElement.innerText = newText;
		}
	});
}

// ----- URLs -----

export function isVideoUrl(url) {
	if (!url) return false;

	const urlParts = url.split("/");
	return urlParts[3].startsWith("watch?v=");
}

// Loads a JSON file from a URL
export function loadJsonFile(jsonFileUrl) {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('GET', jsonFileUrl, true);
		xhr.responseType = 'json';
		xhr.onload = function () {
			if (xhr.status === 200) {
				resolve(xhr.response);
			} else {
				reject(xhr.statusText);
			}
		};
		xhr.send();
	});
}

// ----- Small utilities -----

// Waits for a certain amount of milliseconds
export function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Determines if an object is empty
export function isEmpty(obj) {
	return Object.keys(obj).length === 0;
}

// Gets the length of an object
export function getLength(obj) {
	return Object.keys(obj).length;
}

// Adds a number of hours to a date
export function addHours(date, hours) {
	return new Date(date.getTime() + hours * 3600000);
}

// ----- Storage -----
export async function fetchConfigSync() {
	let configSync = await chrome.storage.sync.get().then((result) => {
		return result;
	});

	return configSync;
}

// This function also exists in background.js
export async function setSyncStorageValue(key, value, configSync) {
	configSync[key] = value;

	await chrome.storage.sync.set({ [key]: value });

	// Refresh the config in the background script. Send it like this to avoid a request to the chrome storage API
	// TODO: Is this still necessary?
	// chrome.runtime.sendMessage({ command: "newConfigSync", data: configSync });

	return configSync;
}

// Returns the number of requests the user can still make to the Youtube API today
export async function getUserQuotaRemainingToday(configSync) {
	// The quota gets reset at midnight
	if (configSync.userQuotaResetTime < Date.now()) {
		configSync.userQuotaRemainingToday = 200;
		configSync.userQuotaResetTime = new Date(new Date().setHours(24, 0, 0, 0)).getTime();
		configSync = await setSyncStorageValue("userQuotaRemainingToday", configSync.userQuotaRemainingToday, configSync);
		configSync = await setSyncStorageValue("userQuotaResetTime", configSync.userQuotaResetTime, configSync);
	}
	return configSync.userQuotaRemainingToday;
}

// ---------- Message sending ----------

// Wrapper around sendMessage to work with asynchronous responses
export function sendMessage(msg) {
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

export class RandomYoutubeVideoError extends Error {
	constructor({ code = "RYV-0", message = "", solveHint = "", showTrace = true }) {
		super(message);
		this.code = code;
		this.message = message;
		this.solveHint = solveHint;
		this.showTrace = showTrace;
		this.name = "RandomYoutubeVideoError";
	}
}

export class YoutubeAPIError extends RandomYoutubeVideoError {
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