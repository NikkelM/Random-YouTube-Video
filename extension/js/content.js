// Main file that is run when the user enters a youtube.com page

// ---------- Initialization ----------

// Load the font used for the "shuffle" icon
// Do this before building the button to prevent a flash of unstyled text
let iconFont = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0">`;
iconFont = new DOMParser().parseFromString(iconFont, "text/html").head.firstChild;
document.head.appendChild(iconFont);

let shuffleButton = null;
// We can access the actual text using "shuffleButtonTextElement.innerHTML"
let shuffleButtonTextElement = null;

document.addEventListener("yt-navigate-finish", startDOMObserver);

async function startDOMObserver(event) {
	const isVideoPage = isVideoUrl(window.location.href);

	// Get the channel id from the event data
	let channelId = null;
	let channelName = null;

	if (isVideoPage) {
		channelId = event?.detail?.response?.playerResponse?.videoDetails?.channelId;
		channelName = event?.detail?.response?.playerResponse?.videoDetails?.author;
	} else {
		channelId = event?.detail?.response?.response?.header?.c4TabbedHeaderRenderer?.channelId;
		channelName = event?.detail?.response?.response?.header?.c4TabbedHeaderRenderer?.title;
	}

	if (!channelId?.startsWith("UC")) {
		// If no valid channelId was provided in the event, we won't be able to add the button
		return;
	}

	// Wait until the required DOM element we add the button to is loaded
	var observer = new MutationObserver(function (mutations, me) {
		// ----- Channel page -----
		if (!isVideoPage) {
			var channelPageRequiredElementLoadComplete = document.getElementById("channel-header");

			// ----- Video page -----
		} else {
			// Find out if we are on a video page that has completed loading the required element
			var videoPageRequiredElementLoadComplete = document.getElementById("player") && document.getElementById("above-the-fold");
		}

		// If we are on a video page, and the required element has loaded, add the shuffle button
		if (isVideoPage && videoPageRequiredElementLoadComplete) {
			me.disconnect(); // Stop observing
			channelDetectedAction("video", channelId, channelName);
			return;
		}

		// If we are NOT on a video page, we assume we are on a channel page
		// If the required element has loaded, add a shuffle button
		if (!isVideoPage && channelPageRequiredElementLoadComplete) {
			me.disconnect(); // Stop observing
			channelDetectedAction("channel", channelId, channelName);
			return;
		}
	});

	// start observing
	observer.observe(document, {
		childList: true,
		subtree: true
	});
}

async function channelDetectedAction(pageType, channelId, channelName) {
	await fetchConfigSync();

	// Save the current channelID and channelName in the extension's storage to be accessible by the popup
	configSync.currentChannelId = channelId;
	await setSyncStorageValue("currentChannelId", channelId);
	configSync.currentChannelName = channelName;
	await setSyncStorageValue("currentChannelName", channelName);

	buildShuffleButton(pageType, channelId);
}

// ---------- Shuffle ----------

// Called when the randomize-button is clicked
async function shuffleVideos() {
	try {
		var changeToken = new BooleanReference();
		// Make sure we have the latest config
		await fetchConfigSync();

		setDOMTextWithDelay(shuffleButtonTextElement, `&nbsp;Please wait...`, 500, changeToken);
		setDOMTextWithDelay(shuffleButtonTextElement, `&nbsp;Working on it...`, 6000, changeToken);

		// Get the saved channelId from the button. If for some reason it is not there, use the channelId from the config
		const channelId = shuffleButton?.children[0]?.children[0]?.children[0]?.children?.namedItem('channelId')?.innerHTML ?? configSync.currentChannelId;

		await chooseRandomVideo(channelId);
		// Reset the button text in case we opened the video in a new tab
		setDOMTextWithDelay(shuffleButtonTextElement, `&nbsp;Shuffle`, 0, changeToken, true);
	} catch (error) {
		console.error(error.stack);
		console.error(error.message);

		let displayText = "";
		switch (error.name) {
			case "RandomYoutubeVideoError":
				displayText = `&nbsp;Error ${error.code}`;
				break;
			case "YoutubeAPIError":
				displayText = `&nbsp;API Error ${error.code}`;
				break;
			default:
				displayText = `&nbsp;Unknown Error`;
		}

		// Special case: If the extension's background worker was reloaded, we need to reload the page to get the correct reference to the shuffle function again
		if (error.message === 'Extension context invalidated.') {
			// We don't want the button text to quickly change before the page is reloaded
			displayText = `&nbsp;Shuffle`;

			// Inform the user about what has happened
			alert("Random YouTube Video:\nThe extension's background worker was reloaded. This happens either when the extension is updated, or you interrupted a shuffle that was started from the popup.\n\nThe page will reload and you can try again.")

			// Reload the page
			window.location.reload();
		}

		// Immediately display the error and stop other text changes
		setDOMTextWithDelay(shuffleButtonTextElement, displayText, 0, changeToken, true);
		return;
	}
}
