// Main file that is run when the user enters a youtube.com page

// ---------- Initialization ----------

let currUrl = getUrl(window.location.href);
let shuffleButton = null;
// Access the actual text using shuffleButtonText.innerHTML
let shuffleButtonText = null;

// Whenever a YouTube navigation event fires, we need to check if we have entered a different channel page
// as the corresponding html element we need doesn't get refreshed by default
document.addEventListener("yt-navigate-start", handleNavigateStart);

var observer = new MutationObserver(function (mutations, me) {
	let requiredElement = null;
	if (isChannelUrl(currUrl)) {
		requiredElement = document.getElementById("inner-header-container");
	} else if (isVideoUrl(currUrl)) {
		requiredElement = document.getElementById("above-the-fold");
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
		const urlParts = url.split("/");
		// We handle "channel", "c", "user" and "@Username"
		if (urlParts[3].startsWith("@")) {
			return urlParts.slice(0, 4).join("/");
		} else if (urlParts[3] == "c") {
			return urlParts.slice(0, 3).join("/") + "/@" + urlParts[4];
		} else if (urlParts[3] == "channel") {
			return urlParts.slice(0, 5).join("/");
		} else if (urlParts[3] == "user") {
			return urlParts.slice(0, 5).join("/");
		}
	}

	return null;
}

function addShuffleButtonToPage() {
	console.log("Building shuffle button...");

	if (isChannelUrl(currUrl)) {
		buildShuffleButton("channel");
	} else if (isVideoUrl(currUrl)) {
		buildShuffleButton("video");
	}
}

async function shuffleVideos() {
	// Called when the randomize-button is clicked
	let changeToken = new BooleanReference();
	setDOMTextWithDelay(shuffleButtonText, `&nbsp;Please wait...`, 500, changeToken);
	setDOMTextWithDelay(shuffleButtonText, `&nbsp;Working on it...`, 6000, changeToken);

	try {
		await chooseRandomVideo();
	} catch (error) {
		console.error(error.stack);
		console.error(error.message);

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

		// Immediately display the error and stop other text changes
		// TODO: Also add the error in more detail to the popup and/or logs?
		setDOMTextWithDelay(shuffleButtonText, displayText, 0, changeToken, true);
		return;
	}
}
