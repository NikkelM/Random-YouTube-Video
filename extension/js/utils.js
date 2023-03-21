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

// ----- URLs -----

function isVideoUrl(url) {
	if (!url) return false;

	const urlParts = url.split("/");
	return urlParts[3].startsWith("watch?v=");
}

// Gets the name of the channel, or the channel id directly, from an url
function getChannelFromUrl(url) {
	const urlParts = url.split("/");

	// We handle "channel", "c", "user" and "@Username" explicitly, as we can easily identify the URL format
	if (urlParts[3].startsWith("@")) {
		return {
			"type": "username",
			"value": urlParts[3]
		};
	} else if (urlParts[3] == "c") {
		return {
			"type": "username",
			"value": "@" + urlParts[4]
		};
	} else if (urlParts[3] == "channel") {
		return {
			"type": "channelId",
			"value": urlParts[4]
		};
	} else if (urlParts[3] == "user") {
		return {
			"type": "username",
			"value": urlParts[4]
		};
	}

	// The only other option is for the page to be in the format https://youtube.com/username, which we cannot identify otherwise
	return {
		"type": "username",
		"value": urlParts[3]
	};
}

// ----- DOM -----

// Waits for a certain amount of milliseconds
function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function setDOMTextWithDelay(textElement, newText, delayMS, changeToken, finalizes = false) {
	// Sets the innerHTML of a (text) DOM element after a delay, if something else hasn't changed it yet
	// i.e. only one function can change the text among all functions that were passed the same changeToken
	delay(delayMS).then(() => {
		if (!changeToken.isFinalized) {
			textElement.innerHTML = newText;
			// If the caller wants to stop others from setting the value to something else
			changeToken.isFinalized = finalizes;
		}
	});
}

// ----- Objects -----

// Determines if an object is empty
function isEmpty(obj) {
	return Object.keys(obj).length === 0;
}

// Adds a number of hours to a date
function addHours(date, hours) {
	return new Date(date.getTime() + hours * 3600000);
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

// ---------- Sync storage ----------

async function fetchConfigSync() {
	configSync = await chrome.storage.sync.get().then((result) => {
		return result;
	});

	return configSync;
}

// ---------- Custom classes ----------

// Used to pass a boolean by reference
class BooleanReference {
	constructor() {
		// true if the final value has been reached
		this.isFinalized = false;
	}
}

// ----- Errors -----

class RandomYoutubeVideoError extends Error {
	constructor(message) {
		super(message);
		this.message = message;
		this.name = "RandomYoutubeVideoError";
	}
}

class YoutubeAPIError extends RandomYoutubeVideoError {
	constructor(code=-1, message="", reason="") {
		super(message);
		this.code = code;
		this.message = message;
		this.reason = reason;
		this.name = "YoutubeAPIError";
	}
}