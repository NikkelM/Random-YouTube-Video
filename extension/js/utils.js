let log = console.log

console.log = function () {
	var args = Array.from(arguments);
	args.unshift("[youtube-random-video]: ");
	log.apply(console, args);
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

function isChannelUrl(url) {
	const urlParts = url.split('/');
	return urlParts[3].startsWith('@') || urlParts[3] == "c" || urlParts[3] == "channel" || urlParts[3] == "user";
}