// Main file that is run when the user enters a youtube.com page
import { configSync, isVideoUrl, setSyncStorageValue, setDOMTextWithDelay, RandomYoutubeVideoError } from "./utils.js";
import { buildShuffleButton, shuffleButton, shuffleButtonTextElement } from "./buildShuffleButton.js";
import { chooseRandomVideo } from "./shuffleVideo.js";

// ---------- Initialization ----------

// Load the font used for the "shuffle" icon
// Do this before building the button to prevent a flash of unstyled text
let iconFont = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0">`;
iconFont = new DOMParser().parseFromString(iconFont, "text/html").head.firstChild;
document.head.appendChild(iconFont);

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
	// We can get an error here if the extension context was invalidated and the user navigates without reloading the page
	try {
		// If we are still connected to the background worker, we can send a message to test the connection
		chrome.runtime.sendMessage({ command: "connectionTest" });
	} catch (error) {
		// If the extension's background worker was reloaded, we need to reload the page to re-connect to the background worker
		if (error.message === 'Extension context invalidated.') {
			window.location.reload();
		}
	}

	// When navigating from e.g. the homepage after an invalidated extension context, sometimes the config is not loaded correctly
	if (!configSync) {
		window.location.reload();
	}

	// Save the current channelID and channelName in the extension's storage to be accessible by the popup
	// configSync.currentChannelId = channelId;
	await setSyncStorageValue("currentChannelId", channelId);
	// configSync.currentChannelName = channelName;
	await setSyncStorageValue("currentChannelName", channelName);

	// Update the channel name in the popup in case it was opened while the navigation was still going on
	// If we don't do this, the configSync and displayed value might diverge
	chrome.runtime.sendMessage({ command: "updateCurrentChannel" });

	buildShuffleButton(pageType, channelId, shuffleVideos);
}

// ---------- Shuffle ----------

// Called when the randomize-button is clicked
async function shuffleVideos() {
	try {
		// Get the saved channelId from the button
		const channelId = shuffleButton?.children[0]?.children[0]?.children[0]?.children?.namedItem('channelId')?.innerText;

		// If the channelId somehow wasn't saved, throw an error
		if (!channelId) {
			throw new RandomYoutubeVideoError(
				{
					code: "RYV-9",
					message: "The extension was unable to find from which channel to shuffle.",
					solveHint: "The page will reload, after which it should work again. If it doesn't, please report this issue on GitHub!",
					showTrace: false
				}
			)
		}

		// We need this variable to make sure the button text is only changed if the shuffle hasn't finished within the time limit
		let hasBeenShuffled = false;
		setDOMTextWithDelay(shuffleButtonTextElement, "\xa0Shuffling...", 1000, () => { return (shuffleButtonTextElement.innerText === "\xa0Shuffle" && !hasBeenShuffled); });
		setDOMTextWithDelay(shuffleButtonTextElement, "\xa0Still on it...", 5000, () => { return (shuffleButtonTextElement.innerText === "\xa0Shuffling..." && !hasBeenShuffled); });

		await chooseRandomVideo(channelId, false, shuffleButtonTextElement);
		hasBeenShuffled = true;

		// Reset the button text in case we opened the video in a new tab
		shuffleButtonTextElement.innerText = "\xa0Shuffle";
	} catch (error) {
		console.error(error.stack);
		console.error(error.message);

		let displayText = "";
		switch (error.name) {
			case "RandomYoutubeVideoError":
				displayText = `Error ${error.code}`;
				break;
			case "YoutubeAPIError":
				displayText = `API Error ${error.code}`;
				break;
			default:
				displayText = `Unknown Error`;
		}

		// Special case: If the extension's background worker was reloaded, we need to reload the page to get the correct reference to the shuffle function again
		if (error.message === 'Extension context invalidated.') {
			// We don't want the button text to quickly change before the page is reloaded
			displayText = `Shuffle`;

			// Inform the user about what has happened
			alert(`Random YouTube Video:

The extension's background worker was reloaded. This happens after an extension update, or after you interrupted a shuffle that was started from the popup.

The page will reload and you can try again.`)

			// Reload the page
			window.location.reload();
			return;
		}

		// Alert the user about the error
		alert(`Random YouTube Video:\n\n${displayText}${error.message ? "\n" + error.message : ""}${error.reason ? "\n" + error.reason : ""}${error.solveHint ? "\n" + error.solveHint : ""}${error.showTrace !== false ? "\n\n" + error.stack : ""}`);

		// Immediately display the error
		shuffleButtonTextElement.innerText = `\xa0${displayText}`;

		return;
	}
}
