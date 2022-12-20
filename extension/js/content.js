// Main file that is run when the user enters a youtube.com page

// ---------- Initialization ----------

let currUrl = getUrl(window.location.href);
let shuffleButton = null;
let shuffleButtonText = null;

// Whenever a YouTube navigation event fires, we need to check if we have entered a different channel page
// as the corresponding html element we need doesn't get refreshed by default
document.addEventListener('yt-navigate-start', handleNavigateStart);

var observer = new MutationObserver(function (mutations, me) {
	let requiredElement = null;
	if (isChannelUrl(currUrl)) {
		requiredElement = document.getElementById('inner-header-container');
	} else if (isVideoUrl(currUrl)) {
		requiredElement = document.getElementById('above-the-fold');
	}

	if (requiredElement) {
		addShuffleButtonToPage();
		me.disconnect(); // stop observing
		return;
	}
});

// start observing
observer.observe(document, {
	childList: true,
	subtree: true
});


// ---------- functions ----------

function handleNavigateStart() {
	const newUrl = getUrl(window.location.href);

	if (newUrl && newUrl !== currUrl) {
		currUrl = newUrl;
		window.location.reload();
	}
}

function getUrl(url) {
	if (isVideoUrl(url)) {
		return url;
	} else if (isChannelUrl(url)) {
		const urlParts = url.split('/');
		// We handle "channel", "c", "user" and "@Username"
		if (urlParts[3].startsWith('@')) {
			return urlParts.slice(0, 4).join('/');
		} else if (urlParts[3] == "c") {
			return urlParts.slice(0, 3).join('/') + '/@' + urlParts[4];
		} else if (urlParts[3] == "channel") {
			return urlParts.slice(0, 5).join('/');
		} else if (urlParts[3] == "user") {
			return urlParts.slice(0, 5).join('/');
		}
	}

	return null;
}

function addShuffleButtonToPage() {
	console.log("Building shuffle button...");

	if (isChannelUrl(currUrl)) {
		buildShuffleButton();
	} else if (isVideoUrl(currUrl)) {
		buildShuffleButtonVideo();
	}
}

function setShuffleButtonText(text) {
	shuffleButtonText.innerHTML = text;
}

async function shuffleVideos() {
	setShuffleButtonText(`&nbsp;Please wait...`);
	
	try {
		await pingAPI();
	} catch (error) {
		console.error(error["message"]);

		switch (error.name) {
			case "RandomYoutubeVideoError":
				displayText = `&nbsp;${error.message}`;
				break;
			case "YoutubeAPIError":
				displayText = `&nbsp;API Error (${error.code})`;
				break;
			default:
				displayText = `&nbsp;Unknown Error`;
		}

		setShuffleButtonText(displayText);
		return;
	}
}
