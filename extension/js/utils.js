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
	const urlParts = url.split("/");
	return urlParts[3].startsWith("@") || urlParts[3] == "c" || urlParts[3] == "channel" || urlParts[3] == "user";
}

function isVideoUrl(url) {
	const urlParts = url.split("/");
	return urlParts[3].startsWith("watch?v=");
}

function delay(time) {
	return new Promise(resolve => setTimeout(resolve, time));
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