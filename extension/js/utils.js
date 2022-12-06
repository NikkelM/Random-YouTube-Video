let log = console.log

console.log = function () {
	var args = Array.from(arguments);
	args.unshift("[youtube-random-video]: ");
	log.apply(console, args);
}

function isChannelUrl(url) {
	const urlParts = url.split('/');
	return urlParts[3].startsWith('@') || urlParts[3] == "c" || urlParts[3] == "channel" || urlParts[3] == "user";
}