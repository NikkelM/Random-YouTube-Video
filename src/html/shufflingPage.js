// Contains logic for the "shufflingPage" that is opened when the user clicks the "Shuffle" button from the popup
import { delay, setDOMTextWithDelay } from "../utils.js";
import { configSync, setSyncStorageValue } from "../chromeStorage.js";
import { buildShufflingHints, tryFocusingTab } from "./htmlUtils.js";
import { chooseRandomVideo } from "../shuffleVideo.js";

// ----- Setup -----
// Restart the background script if it was stopped to prevent a flash of an error page when shuffling
try {
	await chrome.runtime.sendMessage({ command: "connectionTest" });
} catch (error) {
	console.log("The background worker was stopped and had to be restarted.");
	// Wait a bit to make sure the background script has time to restart and we don't get an error when connecting the port
	await delay(10);
}

// Open a port to the background script
// By default, the port will cause the background script to reload when it is closed (== when this page is closed/URL changes)
// However, if the shuffle completes successfully, this script will send a message to the port that will disconnect that listener
const port = chrome.runtime.connect({ name: "shufflingPage" });

const domElements = getDomElements();
await setDomElemenEventListeners(domElements);

// If this page is open, it means the user has clicked the shuffle button
shuffleButtonClicked();

// If the current extension version is newer than configSync.lastViewedChangelogVersion, highlight the changelog button
if (configSync.lastViewedChangelogVersion !== chrome.runtime.getManifest().version) {
	domElements.viewChangelogButton.classList.add("highlight-green");
}

await buildShufflingHints(domElements);
// Only show the contents of the page after a short delay, so that the user doesn't see the page at all for short loading times
waitUntilShowingDivContents();

// Get all relevant DOM elements
function getDomElements() {
	return {
		// The div containing all other elements
		randomYoutubeVideo: document.getElementById("randomYoutubeVideo"),
		// Shows the percentage of videos that have been fetched
		fetchPercentageNoticeShufflingPage: document.getElementById("fetchPercentageNoticeShufflingPage"),
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

// Set event listeners for DOM elements
async function setDomElemenEventListeners(domElements) {
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

// Called when the randomize-button from the popup is clicked
async function shuffleButtonClicked() {
	try {
		domElements.shufflingFromChannelHeading.innerText = configSync.currentChannelName;
		const shuffleButtonTextElement = domElements.fetchPercentageNoticeShufflingPage;

		setDOMTextWithDelay(shuffleButtonTextElement, "Applying filters...", 4000, () => { return ((shuffleButtonTextElement.innerText === "Please wait..." || shuffleButtonTextElement.innerText === "Fetching: 100%")); });
		setDOMTextWithDelay(shuffleButtonTextElement, "Should be done soon...", 8000, () => { return (shuffleButtonTextElement.innerText === "Applying filters..." || shuffleButtonTextElement.innerText === "Fetching: 100%"); });

		if (configSync.shuffleIgnoreShortsOption != "1") {
			setDOMTextWithDelay(shuffleButtonTextElement, "Sorting shorts...", 12000, () => { return ((shuffleButtonTextElement.innerText === "Should be done soon..." || shuffleButtonTextElement.innerText === "Fetching: 100%")); });
			if (configSync.shuffleIgnoreShortsOption == "2") {
				setDOMTextWithDelay(shuffleButtonTextElement, "Lots of shorts...", 20000, () => { return ((shuffleButtonTextElement.innerText === "Sorting shorts..." || shuffleButtonTextElement.innerText === "Fetching: 100%")); });
			} else if (configSync.shuffleIgnoreShortsOption == "0") {
				setDOMTextWithDelay(shuffleButtonTextElement, "Not many shorts...", 20000, () => { return ((shuffleButtonTextElement.innerText === "Sorting shorts..." || shuffleButtonTextElement.innerText === "Fetching: 100%")); });
			}
			setDOMTextWithDelay(shuffleButtonTextElement, "Still sorting...", 35000, () => { return ((shuffleButtonTextElement.innerText === "Lots of shorts..." || shuffleButtonTextElement.innerText === "Not many shorts..." || shuffleButtonTextElement.innerText === "Fetching: 100%")); });
		} else {
			setDOMTextWithDelay(shuffleButtonTextElement, "Still shuffling...", 20000, () => { return ((shuffleButtonTextElement.innerText === "Should be done soon..." || shuffleButtonTextElement.innerText === "Fetching: 100%")); });
		}

		await chooseRandomVideo(configSync.currentChannelId, true, shuffleButtonTextElement);

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
		domElements.fetchPercentageNoticeShufflingPage.innerText = errorHeading;
		domElements.shuffleErrorText.innerText = errorMessage;
		domElements.shuffleErrorText.classList.remove("hidden");

		// Stop displaying the elements that are only shown while shuffling
		domElements.shufflingInProgressElements.classList.add("hidden");

		// We don't need to wait to show the contents of the page as we have encountered an error
		domElements.randomYoutubeVideo.classList.remove("hidden");

		// Remove the port's onDisconnect listener, as the shuffle process has stopped
		port.postMessage({ command: "shuffleComplete" });
		return;
	}
}

async function waitUntilShowingDivContents() {
	await delay(1000);
	domElements.randomYoutubeVideo.classList.remove("hidden");
}
