// Global utilities
// ---------- Console rerouting ----------
var oldLog = console.log;
console.log = function () {
	if (arguments[0] !== "[random-youtube-video]:") {
		Array.prototype.unshift.call(arguments, '[random-youtube-video]:');
	}
	oldLog.apply(this, arguments);
}

var oldError = console.error;
console.error = function () {
	if (arguments[0] !== "[random-youtube-video]:") {
		Array.prototype.unshift.call(arguments, '[random-youtube-video]:');
	}
	oldError.apply(this, arguments);
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
export let configSync = await fetchConfigSync();

// Whenever someone changes a value in sync storage, we need to be notified to update the global configSync object
chrome.storage.onChanged.addListener(async function (changes, namespace) {
	// We only care about changes to the sync storage
	if (namespace !== "sync") {
		return;
	}
	for (const [key, value] of Object.entries(changes)) {
		configSync[key] = value.newValue;
	}
});

// This function also exists in background.js
export async function setSyncStorageValue(key, value) {
	configSync[key] = value;

	await chrome.storage.sync.set({ [key]: value });
}

// Returns the number of requests the user can still make to the Youtube API today
export async function getUserQuotaRemainingToday() {
	// The quota gets reset at midnight
	if (configSync.userQuotaResetTime < Date.now()) {
		await setSyncStorageValue("userQuotaRemainingToday", 200);
		await setSyncStorageValue("userQuotaResetTime", new Date(new Date().setHours(24, 0, 0, 0)).getTime());
	}
	return configSync.userQuotaRemainingToday;
}

// -- Private --
async function fetchConfigSync() {
	let configSync = await chrome.storage.sync.get().then((result) => {
		return result;
	});

	return configSync;
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