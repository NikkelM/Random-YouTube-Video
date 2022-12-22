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

function isChannelUrl(url) {
	if (!url) return false;

	const urlParts = url.split("/");
	return urlParts[3].startsWith("@") || urlParts[3] == "c" || urlParts[3] == "channel" || urlParts[3] == "user";
}

function isVideoUrl(url) {
	if (!url) return false;

	const urlParts = url.split("/");
	return urlParts[3].startsWith("watch?v=");
}

// Waits for a certain amount of milliseconds
function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

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

// Determines if an object is empty
function isEmpty(obj) {
	return Object.keys(obj).length === 0;
}

// Adds a number of hours to a date
function addHours(date, hours) {
	return new Date(date.getTime() + hours * 3600000);
}

// ---------- Classes ----------

// Used to pass a boolean by reference
class BooleanReference {
	constructor() {
		this.value = true;
	}
}

class RandomYoutubeVideoError extends Error {
	constructor(message) {
		super(message);
		this.message = message;
		this.name = "RandomYoutubeVideoError";
	}
}

class YoutubeAPIError extends RandomYoutubeVideoError {
	constructor(code, message) {
		super(message);
		this.code = code;
		this.message = message;
		this.name = "YoutubeAPIError";
	}
}