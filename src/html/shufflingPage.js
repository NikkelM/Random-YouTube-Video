// Contains logic for the "shufflingPage" that is opened when the user clicks the "Shuffle" button from the popup
import { delay } from "../utils.js";
import { configSync, setSyncStorageValue } from "../chromeStorage.js";
import { displayShufflingHint, tryFocusingTab } from "./htmlUtils.js";
import { chooseRandomVideo } from "../shuffleVideo.js";

// ----- Setup -----
// Open a port to the background script
// By default, the port will cause the background script to reload when it is closed (== when this page is closed/URL changes)
// However, if the shuffle completes successfully, this script will send a message to the port that will disconnect that listener
const port = chrome.runtime.connect({ name: "shufflingPage" });

const domElements = getDomElements();

// Get all relevant DOM elements
function getDomElements() {
	return {
		// The div containing all other elements
		randomYoutubeVideo: document.getElementById("randomYoutubeVideo"),
		// Shows the percentage of videos that have been fetched
		fetchPercentageNotice: document.getElementById("fetchPercentageNotice"),
		// The text that is displayed when an error has occurred
		shuffleErrorText: document.getElementById("shuffleErrorText"),
		// Div containing all elements that should only be displayed if we are still shuffling
		shufflingInProgressElements: document.getElementById("shufflingInProgressElements"),
		// The heading containing the "Shuffling from <channel name>..." text
		shufflingFromChannelHeading: document.getElementById("shufflingFromChannelHeading"),
		// The p element containing the shuffle hint
		shufflingHintP: document.getElementById("shufflingHintP"),
		// The button that displays the next shuffle hint
		nextHintButton: document.getElementById("nextHintButton"),

		// FOOTER
		// View changelog button
		viewChangelogButton: document.getElementById("viewChangelogButton")
	}
}

// If the current extension version is newer than configSync.lastViewedChangelogVersion, highlight the changelog button
if (configSync.lastViewedChangelogVersion !== chrome.runtime.getManifest().version) {
	domElements.viewChangelogButton.classList.add("highlight-green");
}

// Set event listeners for DOM elements
async function setDomElemenEventListeners(domElements) {
	// Add click listener to the "New hint" button
	domElements.nextHintButton.addEventListener("click", async function () {
		currentHint = await displayShufflingHint(domElements.shufflingHintP, currentHint);
	});

	// View changelog button
	domElements.viewChangelogButton.addEventListener("click", async function () {
		await setSyncStorageValue("lastViewedChangelogVersion", chrome.runtime.getManifest().version);

		const tabUrl = chrome.runtime.getURL("html/changelog.html");
		let mustOpenTab = await tryFocusingTab(tabUrl);
		if (mustOpenTab) {
			window.open(tabUrl, "_blank");
		}
	});
}

await setDomElemenEventListeners(domElements);

// ----- Main -----
// If this page is open, it means the user has clicked the shuffle button
shuffleButtonClicked();

// Only show the contents of the page after a short delay, so that the user doesn't see the page at all for short loading times
waitUntilShowingDivContents();

// ----- Shuffling Hints -----
let currentHint = await displayShufflingHint(domElements.shufflingHintP);

// Called when the randomize-button from the popup is clicked
async function shuffleButtonClicked() {
	try {
		domElements.shufflingFromChannelHeading.innerText = configSync.currentChannelName;

		await chooseRandomVideo(configSync.currentChannelId, true, domElements.fetchPercentageNotice);

		// Focus this tab when the shuffle completes
		chrome.tabs.query({ url: chrome.runtime.getURL('html/shufflingPage.html') }, function (tabs) {
			if (tabs.length > 0) {
				// Focus the tab
				chrome.tabs.update(tabs[0].id, { active: true });
			}
		});

		// Remove the port's onDisconnect listener, as we have successfully opened the video and the service worker won't freeze
		port.postMessage({ command: "shuffleComplete" });

	} catch (error) {
		console.error(error.stack);
		console.error(error.message);

		let errorHeading = "";
		switch (error.name) {
			case "RandomYoutubeVideoError":
				errorHeading = `Error ${error.code}`;
				break;
			case "YoutubeAPIError":
				errorHeading = `API Error ${error.code}`;
				break;
			default:
				errorHeading = `Unknown Error`;
		}

		const errorMessage = `${error.message ?? ""}${error.reason ? "\n" + error.reason : ""}${error.solveHint ? "\n" + error.solveHint : ""}${error.showTrace !== false ? "\n\n" + error.stack : ""}`;

		// Immediately display the error
		domElements.fetchPercentageNotice.innerText = errorHeading;
		domElements.shuffleErrorText.innerText = errorMessage;
		domElements.shuffleErrorText.classList.remove("hidden");

		// Stop displaying the elements that are only shown while shuffling
		domElements.shufflingInProgressElements.classList.add("hidden");

		// We don't need to wait to show the contents of the page as we have encountered an error
		domElements.randomYoutubeVideo.classList.remove("hidden");
		return;
	}
}

async function waitUntilShowingDivContents() {
	await delay(1000);
	domElements.randomYoutubeVideo.classList.remove("hidden");
}
