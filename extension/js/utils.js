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

function isChannelUrl(url) {
	const urlParts = url.split('/');
	return urlParts[3].startsWith('@') || urlParts[3] == "c" || urlParts[3] == "channel" || urlParts[3] == "user";
}

function isVideoUrl(url) {
	const urlParts = url.split('/');
	return urlParts[3].startsWith('watch?v=');
}

class YoutubeVideoError extends Error {
	constructor(message, code) {
		super(message);
		this.code = code;
		this.message = message;
		this.name = "YoutubeVideoError";
	}
}