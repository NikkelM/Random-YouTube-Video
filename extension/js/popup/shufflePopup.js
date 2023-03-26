let configSync = await fetchConfigSync();

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

		// The text that notifies the user that the extension is still fetching data
		pleaseWaitNotice: document.getElementById("pleaseWaitNotice"),

		// The text that is displayed when an error has occurred
		shuffleErrorText: document.getElementById("shuffleErrorText"),

		// Div containing all elements that should only be displayed if we are still shuffling
		shufflingInProgressElements: document.getElementById("shufflingInProgressElements"),

		// The heading containing the "Shuffling from <channel name>..." text
		shufflingFromChannelHeading: document.getElementById("shufflingFromChannelHeading"),
	}
}

async function shuffleButtonClicked() {
	domElements.shufflingFromChannelHeading.innerHTML = configSync.currentChannelName;

	// Called when the randomize-button is clicked
	let changeToken = new BooleanReference();
	setDOMTextWithDelay(domElements.pleaseWaitNotice, `Working on it...`, 10000, changeToken);
	setDOMTextWithDelay(domElements.pleaseWaitNotice, `Just a bit longer...`, 22000, changeToken);

	try {
		await chooseRandomVideo(configSync.currentChannelId, true);
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

		const errorMessage = (error.message && error.message.length > 0) ? error.message : "This error has no message.";

		// Immediately display the error and stop other text changes
		setDOMTextWithDelay(domElements.pleaseWaitNotice, displayText, 0, changeToken, true);
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