// Content script that is injected into YouTube pages
import { setDOMTextWithDelay, updateSmallButtonStyleForText, getPageTypeFromURL, RandomYoutubeVideoError, delay } from "./utils.js";
import { configSync, setSyncStorageValue } from "./chromeStorage.js";
import { buildShuffleButton, shuffleButton, shuffleButtonTextElement, tryRenameUntitledList } from "./domManipulation.js";
import { chooseRandomVideo } from "./shuffleVideo.js";

// ---------- Initialization ----------
// Load the font used for the "shuffle" icon
// Do this before building the button to prevent a flash of unstyled text
let iconFont = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0">`;
iconFont = new DOMParser().parseFromString(iconFont, "text/html").head.firstChild;
document.head.appendChild(iconFont);

// ---------- DOM ----------
// The only way for a button to already exist when the content script is loaded is if the extension was reloaded in the background
// That will cause the content script to be re-injected into the page, but the DOM will not be reloaded
// That in turn will disconnect the event listener (on Firefox), which will make the button not work
const videoShuffleButton = document.getElementById("youtube-random-video-large-shuffle-button-video");
const channelShuffleButton = document.getElementById("youtube-random-video-large-shuffle-button-channel");
const shortShuffleButton = document.getElementById("youtube-random-video-small-shuffle-button-short");
if (videoShuffleButton || channelShuffleButton || shortShuffleButton) {
	window.location.reload(true);
}

// After every navigation event, we need to check if this page needs a 'Shuffle' button
document.addEventListener("yt-navigate-finish", startDOMObserver);

async function startDOMObserver(event) {
	resetShuffleButtonText();

	let pageType = getPageTypeFromURL(window.location.href);

	// Get the channel id from the event data
	let channelId;
	let channelName;

	if (pageType == "video" || pageType == "short") {
		channelId = event?.detail?.response?.playerResponse?.videoDetails?.channelId;
		channelName = event?.detail?.response?.playerResponse?.videoDetails?.author;
	} else if (pageType == "channel") {
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
		if (pageType === "channel") {
			var channelPageRequiredElementLoadComplete = document.getElementById("channel-header");
			// ----- Video page -----
		} else if (pageType === "video") {
			var videoPageRequiredElementLoadComplete = document.getElementById("player") && document.getElementById("above-the-fold");
			// ----- Shorts page -----
		} else if (pageType === "short") {
			// As of now, we do not add a shuffle button to shorts pages, so we stop listening immediately
			var shortsPageRequiredElementLoadComplete = true;
		}

		// If we are on a video page, and the required element has loaded, add the shuffle button
		if (pageType === "video" && videoPageRequiredElementLoadComplete) {
			me.disconnect(); // Stop observing
			channelDetectedAction("video", channelId, channelName);
			return;
		} else if (pageType === "short" && shortsPageRequiredElementLoadComplete) {
			me.disconnect(); // Stop observing
			channelDetectedAction("short", channelId, channelName);
			return;
		} else if (pageType === "channel" && channelPageRequiredElementLoadComplete) {
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
	// It might be that we got here after shuffling, in which case we want to check if there is a 'Untitled List' that we can rename
	// We do this before anything else to prevent the previous text from showing shortly
	if (pageType === "video") {
		tryRenameUntitledList();
	}

	// We can get an error here if the extension context was invalidated and the user navigates without reloading the page
	try {
		// If we are still connected to the background worker, we can send a message to test the connection
		await chrome.runtime.sendMessage({ command: "connectionTest" });
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
	await setSyncStorageValue("currentChannelId", channelId);
	await setSyncStorageValue("currentChannelName", channelName);

	// Update the channel name in the popup in case it was opened while the navigation was still going on
	// If we don't do this, the configSync and displayed value might diverge
	await chrome.runtime.sendMessage({ command: "updateCurrentChannel" });

	buildShuffleButton(pageType, channelId, shuffleVideos);
}

function resetShuffleButtonText() {
	// The element will not exist if the button has not been built yet
	if (shuffleButtonTextElement) {
		if (shuffleButtonTextElement.id.includes("large-shuffle-button")) {
			shuffleButtonTextElement.innerText = "\xa0Shuffle";
		} else if (shuffleButtonTextElement.innerText !== "autorenew") {
			updateSmallButtonStyleForText(shuffleButtonTextElement, false);
			shuffleButtonTextElement.innerText = "shuffle";
		}
	}
}

// ---------- Shuffle ----------
// Called when the 'Shuffle' button is clicked
async function shuffleVideos() {
	resetShuffleButtonText();

	// Shorts pages make a copy of the shuffleButtonTextElement to be able to spin it even if the user scrolls to another short, to keep the animation going
	var shuffleButtonTextElementCopy = shuffleButtonTextElement;

	let channelId;
	try {
		// Get the saved channelId from the button
		channelId = shuffleButton?.children[0]?.children[0]?.children[0]?.children?.namedItem('channelId')?.innerText;

		// If the channelId somehow wasn't saved, throw an error
		if (!channelId) {
			throw new RandomYoutubeVideoError(
				{
					code: "RYV-9",
					message: "The extension was unable to find from which channel to shuffle.",
					solveHint: "The page will now reload, after which the button should work again. If it doesn't, please report this issue on GitHub!",
					showTrace: false,
					canSavePlaylist: false
				}
			)
		}

		// We need this variable to make sure the button text is only changed if the shuffle hasn't finished within the time limit
		var hasBeenShuffled = false;

		// Only use this text if the button is the large shuffle button, the small one only has space for an icon
		if (shuffleButtonTextElement.id.includes("large-shuffle-button")) {
			shuffleButtonTextElement.innerText = "\xa0Shuffling...";
			setDOMTextWithDelay(shuffleButtonTextElement, "\xa0Still on it...", 5000, () => { return ((shuffleButtonTextElement.innerText === "\xa0Shuffling..." || shuffleButtonTextElement.innerText === "\xa0Fetching: 100%") && !hasBeenShuffled); });
			if (configSync.shuffleIgnoreShortsOption != "1") {
				setDOMTextWithDelay(shuffleButtonTextElement, "\xa0Sorting shorts...", 10000, () => { return ((shuffleButtonTextElement.innerText === "\xa0Still on it..." || shuffleButtonTextElement.innerText === "\xa0Fetching: 100%") && !hasBeenShuffled); });
				if (configSync.shuffleIgnoreShortsOption == "2") {
					setDOMTextWithDelay(shuffleButtonTextElement, "\xa0Lots of shorts...", 20000, () => { return ((shuffleButtonTextElement.innerText === "\xa0Sorting shorts..." || shuffleButtonTextElement.innerText === "\xa0Fetching: 100%") && !hasBeenShuffled); });
				} else if (configSync.shuffleIgnoreShortsOption == "0") {
					setDOMTextWithDelay(shuffleButtonTextElement, "\xa0Not many shorts...", 20000, () => { return ((shuffleButtonTextElement.innerText === "\xa0Sorting shorts..." || shuffleButtonTextElement.innerText === "\xa0Fetching: 100%") && !hasBeenShuffled); });
				}
				setDOMTextWithDelay(shuffleButtonTextElement, "\xa0Still sorting...", 35000, () => { return ((shuffleButtonTextElement.innerText === "\xa0Lots of shorts..." || shuffleButtonTextElement.innerText === "\xa0Not many shorts..." || shuffleButtonTextElement.innerText === "\xa0Fetching: 100%") && !hasBeenShuffled); });
			} else {
				setDOMTextWithDelay(shuffleButtonTextElement, "\xa0Still shuffling...", 20000, () => { return ((shuffleButtonTextElement.innerText === "\xa0Still on it..." || shuffleButtonTextElement.innerText === "\xa0Fetching: 100%") && !hasBeenShuffled); });
			}
		} else {
			let iterationsWaited = 0;

			let checkInterval = setInterval(async () => {
				if (!hasBeenShuffled && (shuffleButtonTextElementCopy.innerText == "100%" || (shuffleButtonTextElementCopy.innerText == "shuffle" && iterationsWaited++ >= 15))) {
					clearInterval(checkInterval);
					await delay(400);

					// If we have finished the shuffle between the check and the delay, we don't want to change the text
					if (hasBeenShuffled) {
						return;
					}

					updateSmallButtonStyleForText(shuffleButtonTextElementCopy, false);
					shuffleButtonTextElementCopy.innerText = "autorenew";

					let rotation = 0;
					let rotateInterval = setInterval(() => {
						if (hasBeenShuffled) {
							clearInterval(rotateInterval);
							return;
						}
						shuffleButtonTextElementCopy.style.transform = `rotate(${rotation}deg)`;
						rotation = (rotation + 5) % 360;
					}, 25);
				} else if (hasBeenShuffled) {
					clearInterval(checkInterval);
				}
			}, 150);
		}

		await chooseRandomVideo(channelId, false, shuffleButtonTextElement);
		hasBeenShuffled = true;

		// Reset the button text in case we opened the video in a new tab
		if (shuffleButtonTextElement.id.includes("large-shuffle-button")) {
			shuffleButtonTextElement.innerText = "\xa0Shuffle";
		} else {
			updateSmallButtonStyleForText(shuffleButtonTextElementCopy, false);
			shuffleButtonTextElementCopy.innerText = "shuffle";
		}
	} catch (error) {
		console.error(error);

		hasBeenShuffled = true;
		if (shuffleButton.id.includes("small-shuffle-button")) {
			updateSmallButtonStyleForText(shuffleButtonTextElementCopy, true);
		}

		let displayText = "";
		if (shuffleButton?.id?.includes("large-shuffle-button")) {
			switch (error.name) {
				case "RandomYoutubeVideoError":
					displayText = `Error ${error.code}`;
					break;
				case "YoutubeAPIError":
					displayText = `API Error ${error.code}`;
					break;
				default:
					displayText = "Unknown Error";
			}
		} else {
			switch (error.name) {
				case "RandomYoutubeVideoError":
				case "YoutubeAPIError":
					displayText = error.code;
					break;
				default:
					displayText = "Unknown Error";
			}
		}

		// Special case: If the extension's background worker was reloaded, we need to reload the page to get the correct reference to the shuffle function again
		if (error.message === 'Extension context invalidated.') {
			// We don't want the button text to change before the page is reloaded
			hasBeenShuffled = true;

			// Inform the user about what has happened
			window.alert(`Random YouTube Video:

The extension's background worker was reloaded. This happens after an extension update, or after you interrupted a shuffle that was started from the popup.

The page will reload and you can try again.`)

			// Reload the page
			window.location.reload();
			return;
		}

		// Immediately display the error
		if (shuffleButton?.id?.includes("large-shuffle-button")) {
			shuffleButtonTextElement.innerText = `\xa0${displayText}`;
		} else {
			shuffleButtonTextElementCopy.innerText = displayText == "Unknown Error" ? "Error" : displayText;
		}
		// Small delay to allow for the DOM change to be rendered
		await delay(10);

		// Alert the user about the error
		window.alert(`Random YouTube Video:\n\nChannel ${channelId}\n${displayText}${error.message ? "\n" + error.message : ""}${error.reason ? "\n" + error.reason : ""}${error.solveHint ? "\n" + error.solveHint : ""}${error.showTrace !== false ? "\n\n" + error.stack : ""}`);

		return;
	}
}
