// Entry point for the popup page
import { configSync, delay } from "../../utils.js";
import { manageDependents } from "./popupUtils.js";
import { getDomElements, setDomElemenEventListeners, updateDomElementsDependentOnChannel, updateFYIDiv } from "./domElements.js";

// Get all relevant DOM elements
const domElements = getDomElements();

await setDomElementValuesFromConfig(domElements);

await setDomElemenEventListeners(domElements);

// IMPORTANT: Only one message handler can send a response. This is the one in the background script for this extension, so we CANNOT send a response here!
chrome.runtime.onMessage.addListener(async function (request) {
	switch (request.command) {
		case "updateCurrentChannel":
			// We need to update the relevant DOM elements with the new channel name
			updateDomElementsDependentOnChannel(domElements);
			break;
		default:
			console.log(`Unknown command: ${request.command} (popup). Hopefully another message listener will handle it.`);
			break;
	}
});

// Set default values from configSync == user preferences
async function setDomElementValuesFromConfig(domElements) {
	// Disable animations to prevent them from playing when setting the values
	toggleAnimations(domElements);

	// ----- Custom API key: Option toggle -----
	// If this option is checked is only dependent on the value in sync storage
	domElements.useCustomApiKeyOptionToggle.checked = configSync.useCustomApiKeyOption;

	// ----- Database sharing: Option toggle -----
	// Determine if the dbSharingOptionToggle should be checked and enabled
	domElements.dbSharingOptionToggle.checked = configSync.databaseSharingEnabledOption;
	if (!configSync.useCustomApiKeyOption || !configSync.customYoutubeApiKey) {
		domElements.dbSharingOptionToggle.parentElement.classList.add("disabled");
	}

	// ----- Custom API key: Input -----
	// Show the customAPIKeyInputDiv if the user has enabled the option
	if (configSync.useCustomApiKeyOption) {
		domElements.customApiKeyInputDiv.classList.remove("hidden");
	}
	// Set the value of the custom API key input field to the value in sync storage
	domElements.customApiKeyInputField.value = configSync.customYoutubeApiKey ? configSync.customYoutubeApiKey : "";

	if (configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey) {
		domElements.customApiKeyHowToGetDiv.classList.add("hidden");
	}

	// ----- Shuffling: Open in new tab option toggle -----
	domElements.shuffleOpenInNewTabOptionToggle.checked = configSync.shuffleOpenInNewTabOption;

	// ----- Shuffling: Reuse tab option toggle -----
	// If this option is enabled depends on the state of the shuffleOpenInNewTabOptionToggle
	manageDependents(domElements, domElements.shuffleOpenInNewTabOptionToggle, configSync.shuffleOpenInNewTabOption);

	// ----- Shuffling: Ignore shorts option toggle -----
	domElements.shuffleIgnoreShortsOptionToggle.checked = configSync.shuffleIgnoreShortsOption;

	// ----- Shuffling: Open as playlist option toggle -----
	domElements.shuffleOpenAsPlaylistOptionToggle.checked = configSync.shuffleOpenAsPlaylistOption;

	// ----- Shuffling: Number of videos in playlist div -----
	// Disable the div if the user has not enabled the option to open as playlist
	if (!configSync.shuffleOpenAsPlaylistOption) {
		domElements.shuffleNumVideosInPlaylistDiv.classList.add("disabled");
	}
	// Set the value of the input field to the value in sync storage
	domElements.shuffleNumVideosInPlaylistInput.value = configSync.shuffleNumVideosInPlaylist;

	// Updates all elements that contain the channel name
	updateDomElementsDependentOnChannel(domElements);

	// ----- Custom options per channel div -----
	if (configSync.currentChannelId) {
		domElements.channelCustomOptionsDiv.classList.remove("hidden");
	}

	// Contains logic for all the "For your information" div content
	updateFYIDiv(domElements);

	// If the current extension version is newer than configSync.lastViewedChangelogVersion, highlight the changelog button
	if (configSync.lastViewedChangelogVersion !== chrome.runtime.getManifest().version) {
		domElements.viewChangelogButton.classList.add("highlight-green");
	}

	// Enable animations
	toggleAnimations(domElements);
}

async function toggleAnimations(domElements) {
	if (domElements.body.classList.contains("no-transitions")) {
		// Small delay to make sure running animations cannot be seen
		await delay(100);
		domElements.body.classList.remove("no-transitions");
	} else {
		domElements.body.classList.add("no-transitions");
	}
}