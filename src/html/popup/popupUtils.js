// This file contains helper functions for the popup
import { getLength, fetchConfigSync, setSyncStorageValue, } from "../../utils.js";
import { updateFYIDiv } from "../htmlUtils.js";

// ----- Dependency management -----

let configSync = await fetchConfigSync();

export async function manageDependents(domElements, parent, value, configSync) {
	switch (parent) {
		// Custom API key: Option toggle
		case domElements.useCustomApiKeyOptionToggle:
			// For this option, the value is the same as the checked state
			if (value) {
				// Show input field for custom API key
				domElements.customApiKeyInputDiv.classList.remove("hidden");
				// Set the value of the custom API key input field to the value in sync storage
				domElements.customApiKeyInputField.value = configSync.customYoutubeApiKey ? configSync.customYoutubeApiKey : "";

				// Show the guide on how to get a custom API key if the user has not already provided one
				if (!configSync.customYoutubeApiKey) {
					domElements.customApiKeyHowToGetDiv.classList.remove("hidden");
				} else {
					domElements.customApiKeyHowToGetDiv.classList.add("hidden");
				}

				manageDbOptOutOption(domElements, configSync);
			} else {
				// The user must share data with the database
				domElements.dbSharingOptionToggle.checked = true;
				configSync.databaseSharingEnabledOption = true;
				configSync = await setSyncStorageValue("databaseSharingEnabledOption", true, configSync);

				manageDbOptOutOption(domElements, configSync);

				// Hide input field for custom API key
				domElements.customApiKeyInputDiv.classList.add("hidden");
			}
			updateFYIDiv(domElements, configSync);
			break;

		case domElements.customApiKeySubmitButton:
			// Show the guide on how to get a custom API key if the user has not already provided one
			if (!configSync.customYoutubeApiKey) {
				domElements.customApiKeyHowToGetDiv.classList.remove("hidden");
			} else {
				domElements.customApiKeyHowToGetDiv.classList.add("hidden");
			}

			// This is called after validation of a provided API key
			// Depending on whether or not it is valid, we need to update the FYI div
			updateFYIDiv(domElements, configSync);
			break;

		case domElements.shuffleOpenInNewTabOptionToggle:
			// If it was turned off, we need to disable the reuse tab option toggle
			if (value) {
				// We call this function when first opening the popup, so this is where the initial state of the reuse tab option is set
				domElements.shuffleReUseNewTabOptionToggle.checked = configSync.shuffleReUseNewTabOption;
				domElements.shuffleReUseNewTabOptionToggle.parentElement.classList.remove("disabled");
			} else {
				// If the open in a new tab option gets disabled, we also want to disable the reuse tab option to avoid confusion
				domElements.shuffleReUseNewTabOptionToggle.checked = false;
				configSync = await setSyncStorageValue("shuffleReUseNewTabOption", false, configSync);
				domElements.shuffleReUseNewTabOptionToggle.parentElement.classList.add("disabled");
			}
			break;

		case domElements.shuffleOpenAsPlaylistOptionToggle:
			if (value) {
				domElements.shuffleNumVideosInPlaylistDiv.classList.remove("disabled");
			} else {
				domElements.shuffleNumVideosInPlaylistDiv.classList.add("disabled");
			}
			break;

		default:
			console.log(`No dependents to manage for element: ${parent.id}`);
			break;
	}
}

async function checkDbOptOutOptionEligibility(configSync) {
	let { APIKey, isCustomKey, keyIndex } = await chrome.runtime.sendMessage({ command: "getDefaultAPIKeys" });

	if (!APIKey) {
		APIKey = [];
	}

	const defaultAPIKeys = APIKey;

	// This option may only be enabled if the user has provided a valid custom Youtube API key
	return (configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey && !defaultAPIKeys.includes(configSync.customYoutubeApiKey));
}

async function manageDbOptOutOption(domElements, configSync) {
	// If useCustomApiKeyOption is not checked, the user must share data with the database
	if (await checkDbOptOutOptionEligibility(configSync)) {
		domElements.dbSharingOptionToggle.parentElement.classList.remove("disabled");
	} else {
		domElements.dbSharingOptionToggle.parentElement.classList.add("disabled");
	}

	// If the user may not opt out of database sharing but the latest record shows they would like to, make sure it's set correctly in sync storage
	if (!(await checkDbOptOutOptionEligibility(configSync)) && !configSync.databaseSharingEnabledOption) {
		configSync.databaseSharingEnabledOption = true;
		configSync = await setSyncStorageValue("databaseSharingEnabledOption", true, configSync);
	}
	domElements.dbSharingOptionToggle.checked = configSync.databaseSharingEnabledOption;
}

// ---------- Helper functions ----------

// Validates a YouTube API key by sending a short request
export async function validateApiKey(customAPIKey, domElements) {
	// APIKey is actually an array of objects here, despite the naming
	let { APIKey, isCustomKey, keyIndex } = await chrome.runtime.sendMessage({ command: "getDefaultAPIKeys" });

	if (!APIKey) {
		APIKey = [];
	}

	const defaultAPIKeys = APIKey;

	// Users should not add default API keys
	if (defaultAPIKeys.includes(customAPIKey)) {
		domElements.customApiKeyInputInfoText.innerText = "This API key is used by the extension. Please enter your own.";
		domElements.customApiKeyInputInfoDiv.classList.remove("hidden");
		return false;
	}

	// Send a request to get the uploads of the "YouTube" channel
	const apiResponse = await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=UUBR8-60-B28hp2BmDPdntcQ&key=${customAPIKey}`)
		.then((response) => response.json());

	if (apiResponse["error"]) {
		domElements.customApiKeyInputInfoText.innerText = "Error: " + apiResponse["error"]["message"];
		domElements.customApiKeyInputInfoDiv.classList.remove("hidden");
		return false;
	}

	domElements.customApiKeyInputInfoText.innerText = "Custom API key is valid and was successfully set.";
	domElements.customApiKeyInputInfoDiv.classList.remove("hidden");
	return true;
}

export async function setChannelSetting(channelId, setting, value, configSync) {
	let channelSettings = configSync.channelSettings;
	if (!channelSettings[channelId]) {
		channelSettings[channelId] = {};
	}
	channelSettings[channelId][setting] = value;

	configSync.channelSettings = channelSettings;
	configSync = await setSyncStorageValue("channelSettings", channelSettings, configSync);

	return configSync;
}

export async function removeChannelSetting(channelId, setting, configSync) {
	let channelSettings = configSync.channelSettings;
	if (!channelSettings[channelId]) {
		return;
	}
	delete channelSettings[channelId][setting];

	// If the channel settings object is empty, remove it entirely
	if (getLength(channelSettings[channelId]) === 0) {
		delete channelSettings[channelId];
	}

	configSync.channelSettings = channelSettings;
	configSync = await setSyncStorageValue("channelSettings", channelSettings, configSync);

	return configSync;
}