// Main file that is run when the user enters a youtube.com page

// ---------- Initialization ----------

// Load the font used for the "shuffle" icon
// Do this at the very beginning to prevent a flash of unstyled text
let iconFont = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0">`;
iconFont = new DOMParser().parseFromString(iconFont, "text/html").head.firstChild;
document.head.appendChild(iconFont);

let shuffleButton = null;
// Access the actual text using "shuffleButtonTextElement.innerHTML"!
let shuffleButtonTextElement = null;

// Whenever a YouTube navigation event fires, we need to check if we need to add the "shuffle" button
document.addEventListener("yt-navigate-finish", startDOMObserver);
startDOMObserver();

function startDOMObserver() {
	var observer = new MutationObserver(function (mutations, me) {
		const isVideoPage = isVideoUrl(window.location.href);

		// Find out if we are on a channel page that has completed loading the required element
		// When navigating between pages, YouTube does not replace the 'ytd-browse' element of the previous page, but simply sets it to 'hidden'
		// So we need to find the visible 'ytd-browse' element
		const visibleVideoBrowser = Array.from(document.querySelectorAll('ytd-browse')).filter(node => node.hidden === false)[0];

		// This visible element must then have the correct child element, indicating a video link
		const visibleVideoItem = visibleVideoBrowser?.querySelector('ytd-grid-video-renderer')?.querySelector('a#video-title').href;

		// If such a video link exists, we can check if we should are ready to build the button
		const channelPageRequiredElementLoadComplete = visibleVideoItem ? document.getElementById("channel-header") : null;

		// Find out if we are on a video page that has completed loading the required element
		const videoPageRequiredElementLoadComplete = document.getElementById("player") && document.getElementById("above-the-fold");

		// If we are on a video page, and the required element has loaded, add the shuffle button
		if (isVideoPage && videoPageRequiredElementLoadComplete) {
			me.disconnect(); // stop observing
			buildShuffleButton("video");
			return;
		}

		// If we are NOT on a video page, we assume we are on a channel page
		// If the required element has loaded, add a shuffle button
		if (!isVideoPage && channelPageRequiredElementLoadComplete) {
			me.disconnect(); // stop observing
			buildShuffleButton("channel");
			return;
		}
	});

	// start observing
	observer.observe(document, {
		childList: true,
		subtree: true
	});
}

// ---------- functions ----------

async function shuffleVideos() {
	// Called when the randomize-button is clicked
	let changeToken = new BooleanReference();
	setDOMTextWithDelay(shuffleButtonTextElement, `&nbsp;Please wait...`, 500, changeToken);
	setDOMTextWithDelay(shuffleButtonTextElement, `&nbsp;Working on it...`, 6000, changeToken);

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
		setDOMTextWithDelay(shuffleButtonTextElement, displayText, 0, changeToken, true);
		return;
	}
}
