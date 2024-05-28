// Helper functions for the popup
import { getLength, deepCopy } from "../../utils.js";
import { configSyncFirestoreSyncable } from "../../config.js";
import { configSync, setSyncStorageValue, getUserQuotaRemainingToday } from "../../chromeStorage.js";
import { animateSlideOut } from "../htmlUtils.js";
import { userHasActiveSubscriptionRole } from "../../stripe.js";

// ---------- Dependency management ----------
// ----- Public -----
export async function manageDependents(domElements, parent, value) {
	switch (parent) {
		// Custom API key: Option toggle
		case domElements.useCustomApiKeyOptionToggle:
			// For this option, the value is the same as the checked state
			if (value) {
				// Set the value of the custom API key input field to the value in sync storage
				domElements.customApiKeyInputField.value = configSync.customYoutubeApiKey ? configSync.customYoutubeApiKey : "";

				manageDbOptOutOption(domElements);
			} else {
				// The user must share data with the database
				domElements.dbSharingOptionToggle.checked = true;
				configSync.databaseSharingEnabledOption = true;
				await setUserSetting("databaseSharingEnabledOption", true);

				manageDbOptOutOption(domElements);
			}
			animateSlideOut(domElements.customApiKeyInputDiv);
			updateFYIDiv(domElements);
			break;

		case domElements.customApiKeySubmitButton:
			// This is called after validation of a provided API key
			// Depending on whether or not it is valid, we need to update the FYI div
			updateFYIDiv(domElements);
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
				await setUserSetting("shuffleReUseNewTabOption", false);
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

		case domElements.advancedSettingsExpandButton:
			// If true, it means the container is sliding out, so we need to slide out all dependent containers as well
			if (value) {
				if (configSync.useCustomApiKeyOption) {
					animateSlideOut(domElements.customApiKeyInputDiv);
				}
			}
			break;

		default:
			console.log(`No dependents to manage for element: ${parent.id}`);
			break;
	}
}

export async function manageDbOptOutOption(domElements) {
	// If useCustomApiKeyOption is not checked, the user must share data with the database
	if (await checkDbOptOutOptionEligibility()) {
		domElements.dbSharingOptionToggle.parentElement.classList.remove("disabled");
	} else {
		domElements.dbSharingOptionToggle.parentElement.classList.add("disabled");
	}

	// If the user may not opt out of database sharing but the latest record shows they would like to, make sure it's set correctly in sync storage
	if (!(await checkDbOptOutOptionEligibility()) && !configSync.databaseSharingEnabledOption) {
		configSync.databaseSharingEnabledOption = true;
		await setUserSetting("databaseSharingEnabledOption", true);
	}
	domElements.dbSharingOptionToggle.checked = configSync.databaseSharingEnabledOption;
}

// ----- Private -----
async function checkDbOptOutOptionEligibility() {
	let { APIKey } = await chrome.runtime.sendMessage({ command: "getDefaultAPIKeys" });

	if (!APIKey) {
		APIKey = [];
	}

	const defaultAPIKeys = APIKey;

	// This option may only be enabled if the user has provided a valid custom Youtube API key
	return (configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey && !defaultAPIKeys.includes(configSync.customYoutubeApiKey));
}

// ---------- Helpers ----------
// ----- Public -----
// Contains information such as number of shuffled videos so far, daily quota notice, etc.
export async function updateFYIDiv(domElements) {
	// ----- FYI: Number of shuffled videos text -----
	// Use toLocaleString() to add commas/periods to large numbers
	const numShuffledVideosTotal = configSync.numShuffledVideosTotal.toLocaleString();
	domElements.numberOfShuffledVideosText.innerText = `You have shuffled ${numShuffledVideosTotal} time${(configSync.numShuffledVideosTotal !== 1) ? "s" : ""} until now.`;

	// ----- Daily quota notice -----
	await getUserQuotaRemainingToday();

	// ----- Daily quota notice: Text -----
	// We set the value first to prevent the default value from being displayed for a split second
	domElements.dailyQuotaNoticeText.innerText = configSync.userQuotaRemainingToday;

	// ----- FYI: Daily quota notice div -----
	// If the user has a custom API key, the daily quota notice is not relevant. So we only display it if the user is not providing a custom API key
	if (!configSync.customYoutubeApiKey || !configSync.useCustomApiKeyOption) {
		domElements.dailyQuotaNoticeDiv.classList.remove("hidden");
	} else {
		domElements.dailyQuotaNoticeDiv.classList.add("hidden");
	}
}

// ---------- Storage ----------
// ----- Public -----
// Validates a YouTube API key by sending a short request
export async function validateApiKey(customAPIKey, domElements) {
	// Make sure the service worker is running
	try {
		await chrome.runtime.sendMessage({ command: "connectionTest" });
	} catch (error) {
		console.log("The background worker was stopped and had to be restarted.");
	}
	// APIKey is actually an array of objects here, despite the naming
	let { APIKey } = await chrome.runtime.sendMessage({ command: "getDefaultAPIKeys" });

	if (!APIKey) {
		APIKey = [];
	}

	const defaultAPIKeys = APIKey;

	// Users should not add default API keys
	if (defaultAPIKeys.includes(customAPIKey)) {
		domElements.customApiKeyInputInfoText.innerText = "Error: API key not valid. Please pass a valid API key:";
		domElements.customApiKeyInputInfoDiv.classList.remove("hidden");

		domElements.customApiKeyInputField.classList.add("invalid-input");
		setTimeout(() => {
			domElements.customApiKeyInputField.classList.remove("invalid-input");
		}, 1500);
		return false;
	}

	// Send a request to get the uploads of the "YouTube" channel
	const apiResponse = await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=UUBR8-60-B28hp2BmDPdntcQ&key=${customAPIKey}`)
		.then((response) => response.json());

	if (apiResponse["error"]) {
		domElements.customApiKeyInputInfoText.innerText = "Error: API key not valid. Please pass a valid API key:";
		domElements.customApiKeyInputInfoDiv.classList.remove("hidden");

		domElements.customApiKeyInputField.classList.add("invalid-input");
		setTimeout(() => {
			domElements.customApiKeyInputField.classList.remove("invalid-input");
		}, 1500);
		return false;
	}

	domElements.customApiKeyInputInfoText.innerText = "Custom API key is valid and was successfully set.";
	domElements.customApiKeyInputInfoDiv.classList.remove("hidden");
	return true;
}

// Wrapper to sync settings with Firebase
export async function setUserSetting(setting, value, userIsShufflePlusSubscribed = null) {
	userIsShufflePlusSubscribed ??= await userHasActiveSubscriptionRole();
	const isSettingSyncable = configSyncFirestoreSyncable[setting] === true;
	const previousValue = deepCopy(configSync[setting]);

	await setSyncStorageValue(setting, value);

	if (isSettingSyncable && configSync.plusSyncSettings && previousValue !== value && userIsShufflePlusSubscribed) {
		chrome.runtime.sendMessage({ command: "syncUserSettingWithFirestore", data: { [setting]: value } });
	}
}

export async function setChannelSetting(channelId, setting, value, userIsShufflePlusSubscribed) {
	let channelSettings = configSync.channelSettings;
	if (!channelSettings[channelId]) {
		channelSettings[channelId] = {};
	}
	channelSettings[channelId][setting] = value;

	// Also remove the channel settings object if it only contains the default setting
	if (getLength(channelSettings[channelId]) === 1 && channelSettings[channelId].activeOption === "allVideosOption") {
		delete channelSettings[channelId];
	}

	await setUserSetting("channelSettings", channelSettings, userIsShufflePlusSubscribed);
}

export async function removeChannelSetting(channelId, setting) {
	let channelSettings = configSync.channelSettings;
	if (!channelSettings[channelId]) {
		return;
	}
	delete channelSettings[channelId][setting];

	// If the channel settings object is empty, remove it entirely
	if (getLength(channelSettings[channelId]) === 0) {
		delete channelSettings[channelId];
		// Also remove the channel settings object if it only contains the default setting
	} else if (getLength(channelSettings[channelId]) === 1 && channelSettings[channelId]["activeOption"] === "allVideosOption") {
		delete channelSettings[channelId];
	}

	await setUserSetting("channelSettings", channelSettings);
}