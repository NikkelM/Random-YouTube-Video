// Contains logic for the "shufflingPage" that is opened when the user clicks the "Shuffle" button from the popup

// Open a port to the background script
// By default, the port will cause the background script to reload when it is closed (== when this page is closed/URL changes)
// However, if the shuffle completes successfully, this script will send a message to the port that will disconnect that listener
const port = await chrome.runtime.connect({ name: "shufflingPage" });

const domElements = getDomElements();

// If this page is open, it means the user has clicked the shuffle button
shuffleButtonClicked();

// Only show the contents of the page after a short delay, so that the user doesn't see the page at all for short loading times
showDivContents();

// Get all relevant DOM elements
function getDomElements() {
	return {
		// The div containing all other elements
		randomYoutubeVideoPopup: document.getElementById("randomYoutubeVideoPopup"),

		// Shows the percentage of videos that have been fetched
		fetchPercentageNotice: document.getElementById("fetchPercentageNotice"),

		// The text that is displayed when an error has occurred
		shuffleErrorText: document.getElementById("shuffleErrorText"),

		// Div containing all elements that should only be displayed if we are still shuffling
		shufflingInProgressElements: document.getElementById("shufflingInProgressElements"),

		// The heading containing the "Shuffling from <channel name>..." text
		shufflingFromChannelHeading: document.getElementById("shufflingFromChannelHeading"),
	}
}

// Called when the randomize-button from the popup is clicked
async function shuffleButtonClicked() {
	try {
		var changeToken = new BooleanReference();

		var configSync = await fetchConfigSync();

		domElements.shufflingFromChannelHeading.innerHTML = configSync.currentChannelName;

		await chooseRandomVideo(configSync.currentChannelId, true, domElements.fetchPercentageNotice);
		// Remove the port's onDisconnect listener, as we have successfully opened the video and the service worker won't freeze
		port.postMessage({ command: "shuffleComplete" });
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

		const errorMessage = `${error.message ?? ""}${error.reason ? "<br>" + error.reason : ""}${error.solveHint ? "<br>" + error.solveHint : ""}<br><br>${error.stack}`;

		// Immediately display the error and stop other text changes
		setDOMTextWithDelay(domElements.fetchPercentageNotice, displayText, 0, changeToken, true);
		domElements.shuffleErrorText.innerHTML = errorMessage;
		domElements.shuffleErrorText.classList.remove("hidden");

		// Stop displaying the elements that are only shown while shuffling
		domElements.shufflingInProgressElements.classList.add("hidden");

		// We don't need to wait to show the contents of the page as we have encountered an error
		domElements.randomYoutubeVideoPopup.classList.remove("hidden");
		return;
	}
}

async function showDivContents() {
	await delay(1000);
	domElements.randomYoutubeVideoPopup.classList.remove("hidden");
}