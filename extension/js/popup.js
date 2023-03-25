const defaultAPIKeys = await chrome.runtime.sendMessage({ command: "getDefaultAPIKeys" });

let configSync = await fetchConfigSync();

// ---------- Get relevant DOM elements ----------

const domElements = {
	// GLOBAL SETTINGS
	// Custom API key: Option toggle
	useCustomApiKeyOptionToggle: document.getElementById("useCustomApiKeyOptionToggle"),
	// Custom API key: Input
	customApiKeyInputDiv: document.getElementById("customApiKeyInputDiv"),
	customApiKeyInputField: customApiKeyInputDiv.children.namedItem("customApiKeyInputField"),
	customApiKeySubmitButton: customApiKeyInputDiv.children.namedItem("customApiKeySubmitButton"),
	customApiKeyInputInfoDiv: customApiKeyInputDiv.children.namedItem("customApiKeyInputInfoDiv"),
	customApiKeyInputInfoText: customApiKeyInputInfoDiv.children.namedItem("customApiKeyInputInfoText"),
	// Database sharing: Option toggle
	dbSharingOptionToggle: document.getElementById("dbSharingOptionToggle"),
	// Shuffling: Open in new tab option toggle
	shuffleOpenInNewTabOptionToggle: document.getElementById("shuffleOpenInNewTabOptionToggle"),
	// Shuffling: Open as playlist option toggle
	shuffleOpenAsPlaylistOptionToggle: document.getElementById("shuffleOpenAsPlaylistOptionToggle"),
	// Shuffling: Shuffle from last x% of videos input
	shuffleLastXVideosInputField: document.getElementById("shuffleLastXVideosInputField"),

	// PER CHANNEL SETTINGS
	// Custom options per channel div
	channelCustomOptionsDiv: document.getElementById("channelCustomOptionsDiv"),
	// Custom options per channel: Channel name and description
	channelCustomOptionsHeader: channelCustomOptionsDiv.children.namedItem("channelCustomOptionsHeader"),
	// Custom options per channel: Shuffling: Shuffle from last x% of videos input
	shuffleLastXVideosChannelCustomInputField: document.getElementById("shuffleLastXVideosChannelCustomInputField"),

	// Popup shuffle button notice
	popupShuffleButtonNotice: document.getElementById("popupShuffleButtonNotice"),
	// Popup shuffle button
	popupShuffleButton: document.getElementById("popupShuffleButton"),

	// FYI - FOR YOUR INFORMATION
	// FYI div
	forYourInformationDiv: document.getElementById("forYourInformationDiv"),
	// FYI: Daily quota notice div
	dailyQuotaNoticeDiv: forYourInformationDiv.children.namedItem("dailyQuotaNoticeDiv"),
	// Daily quota notice: Text
	dailyQuotaNoticeText: dailyQuotaNoticeDiv.children.namedItem("dailyQuotaNoticeText"),
}

// ---------- Set default values from config ----------

// The cofigSync contains all values the various sliders and text inputs should have
async function setDomElementValuesFromConfig() {
	// ----- Custom API key: Option toggle -----
	// If this option is checked is only dependent on the value in sync storage
	domElements.useCustomApiKeyOptionToggle.checked = configSync.useCustomApiKeyOption;

	// ----- Database sharing: Option toggle -----
	// Determine if the dbSharingOptionToggle should be checked and enabled
	manageDbOptOutOption();

	// ----- Custom API key: Input -----
	// Show the customAPIKeyInputDiv if the user has enabled the option
	if (configSync.useCustomApiKeyOption) {
		domElements.customApiKeyInputDiv.classList.remove("hidden");
	}
	// Set the value of the custom API key input field to the value in sync storage
	domElements.customApiKeyInputField.value = configSync.customYoutubeApiKey ? configSync.customYoutubeApiKey : "";

	// ----- Shuffling: Open in new tab option toggle -----
	domElements.shuffleOpenInNewTabOptionToggle.checked = configSync.shuffleOpenInNewTabOption;

	// ----- Shuffling: Open as playlist option toggle -----
	domElements.shuffleOpenAsPlaylistOptionToggle.checked = configSync.shuffleOpenAsPlaylistOption;

	// ----- Custom options per channel div -----
	if (configSync.currentChannelId) {
		domElements.channelCustomOptionsDiv.classList.remove("hidden");
	}

	// ----- Custom options per channel: Channel name and description -----
	domElements.channelCustomOptionsHeader.innerText = `Channel Settings: ${configSync.currentChannelName}`;

	// ----- Custom options per channel: Shuffling: Shuffle from last x% of videos input -----
	domElements.shuffleLastXVideosChannelCustomInputField.value = configSync.channelSettings[configSync.currentChannelId]?.shufflePercentage ?? 100;

	// Popup shuffle button
	// Show it only if we are on a youtube.com page
	if (await getActiveTab().then(tab => tab.url.includes("youtube.com"))) {
		domElements.popupShuffleButton.innerHTML = `Shuffle from: ${configSync.currentChannelName}`;
		domElements.popupShuffleButton.classList.remove("hidden");
		domElements.popupShuffleButtonNotice.classList.add("hidden");
	}

	// Contains logic for all the "For your information" div content
	updateFYIDiv();
}

await setDomElementValuesFromConfig();

// ---------- Event listeners ----------

// Custom API key: Option toggle
domElements.useCustomApiKeyOptionToggle.addEventListener("change", function () {
	configSync.useCustomApiKeyOption = this.checked;
	setSyncStorageValue("useCustomApiKeyOption", this.checked, configSync);
	manageDependents(domElements.useCustomApiKeyOptionToggle, this.checked);
});

// Database sharing: Option toggle
domElements.dbSharingOptionToggle.addEventListener("change", function () {
	configSync.databaseSharingEnabledOption = this.checked;
	setSyncStorageValue("databaseSharingEnabledOption", this.checked, configSync);
	manageDependents(domElements.dbSharingOptionToggle, this.checked);
});

// Custom API key: Input
domElements.customApiKeySubmitButton.addEventListener("click", async function () {
	// Make sure the passed API key is valid
	const newAPIKey = domElements.customApiKeyInputField.value;
	if (await validateApiKey(newAPIKey)) {
		configSync.customYoutubeApiKey = newAPIKey;
		await setSyncStorageValue("customYoutubeApiKey", newAPIKey, configSync);
	} else {
		configSync.customYoutubeApiKey = null;
		configSync.databaseSharingEnabledOption = true;
		await setSyncStorageValue("customYoutubeApiKey", null, configSync);
		await setSyncStorageValue("databaseSharingEnabledOption", true, configSync);
		domElements.customApiKeyInputField.value = "";
	}
	manageDbOptOutOption();
	manageDependents(domElements.customApiKeySubmitButton, null);
});

// Shuffling: Open in new tab option toggle
domElements.shuffleOpenInNewTabOptionToggle.addEventListener("change", function () {
	configSync.shuffleOpenInNewTabOption = this.checked;
	setSyncStorageValue("shuffleOpenInNewTabOption", this.checked, configSync);
	manageDependents(domElements.shuffleOpenInNewTabOptionToggle, this.checked);
});

// Shuffling: Open as playlist option toggle
domElements.shuffleOpenAsPlaylistOptionToggle.addEventListener("change", function () {
	configSync.shuffleOpenAsPlaylistOption = this.checked;
	setSyncStorageValue("shuffleOpenAsPlaylistOption", this.checked, configSync);
	manageDependents(domElements.shuffleOpenAsPlaylistOptionToggle, this.checked);
});

// Custom options per channel: Shuffling: Shuffle from last x% of videos input
domElements.shuffleLastXVideosChannelCustomInputField.addEventListener("focusout", function () {
	// Clamp the value to the range [1, 100]
	if (this.value === "") {
		this.value = 100;
	}
	const value = Math.min(Math.max(this.value, 1), 100);

	// We only need to save the value if it's not the default of 100
	if (value !== 100) {
		setChannelSetting(configSync.currentChannelId, "shufflePercentage", value);
	}

	// Set the value of the input field to the clamped value
	this.value = value;

	manageDependents(domElements.shuffleLastXVideosChannelCustomInputField, value);
});

// Popup shuffle button
domElements.popupShuffleButton.addEventListener("click", async function () {
	const activeTab = await getActiveTab();
	// Shuffle from the most recent channel
	await chrome.tabs.sendMessage(activeTab.id, { command: "shuffleFromChannel", data: configSync.currentChannelId });
});

// ----- Dependency management -----

function manageDependents(parent, value) {
	switch (parent) {
		// Custom API key: Option toggle
		case domElements.useCustomApiKeyOptionToggle:
			// For this option, the value is the same as the checked state
			if (value) {
				// Show input field for custom API key
				domElements.customApiKeyInputDiv.classList.remove("hidden");
				// Set the value of the custom API key input field to the value in sync storage
				domElements.customApiKeyInputField.value = configSync.customYoutubeApiKey ? configSync.customYoutubeApiKey : "";

				manageDbOptOutOption();
			} else {
				// The user must share data with the database
				domElements.dbSharingOptionToggle.checked = true;
				configSync.databaseSharingEnabledOption = true;
				setSyncStorageValue("databaseSharingEnabledOption", true, configSync);

				manageDbOptOutOption();

				// Hide input field for custom API key
				domElements.customApiKeyInputDiv.classList.add("hidden");
			}
			updateFYIDiv();
			break;
		case domElements.customApiKeySubmitButton:
			// This is called after validation of a provided API key
			// Depending on whether or not it is valid, we need to update the FYI div
			updateFYIDiv();
		default:
			console.log(`No dependents to manage for element: ${parent.id}`);
			break;
	}
}

// ---------- Helper functions ----------

function checkDbOptOutOptionEligibility() {
	// This option may only be enabled if the user has provided a valid custom Youtube API key
	return (configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey && !defaultAPIKeys.includes(configSync.customYoutubeApiKey));
}

function manageDbOptOutOption() {
	// If useCustomApiKeyOption is not checked, the user must share data with the database
	if (checkDbOptOutOptionEligibility()) {
		domElements.dbSharingOptionToggle.parentElement.classList.remove("disabled");
	} else {
		domElements.dbSharingOptionToggle.parentElement.classList.add("disabled");
	}

	// If the user may not opt out of database sharing but the latest record shows they would like to, make sure it's set correctly in sync storage
	if (!checkDbOptOutOptionEligibility() && !configSync.databaseSharingEnabledOption) {
		configSync.databaseSharingEnabledOption = true;
		setSyncStorageValue("databaseSharingEnabledOption", true, configSync);
	}
	domElements.dbSharingOptionToggle.checked = configSync.databaseSharingEnabledOption;
}

// Validates a YouTube API key by sending a short request
async function validateApiKey(APIKey) {
	// Users should not add default API keys
	if (defaultAPIKeys.includes(APIKey)) {
		domElements.customApiKeyInputInfoText.innerText = "This is a default API key. Please enter your own.";
		domElements.customApiKeyInputInfoDiv.classList.remove("hidden");
		return false;
	}

	// Send a request to get the uploads of the "YouTube" channel
	const apiResponse = await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=UUBR8-60-B28hp2BmDPdntcQ&key=${APIKey}`)
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

function setChannelSetting(channelId, setting, value) {
	let channelSettings = configSync.channelSettings;
	if (!channelSettings[channelId]) {
		channelSettings[channelId] = {};
	}
	channelSettings[channelId][setting] = value;

	configSync.channelSettings = channelSettings;
	setSyncStorageValue("channelSettings", channelSettings, configSync);
}

async function updateFYIDiv() {
	let numFYIElements = 0;

	// ----- Daily quota notice -----
	await getUserQuotaRemainingToday(configSync);
	// ----- Daily quota notice: Text -----
	// We set the value first to prevent the default value from being displayed for a split second
	domElements.dailyQuotaNoticeText.innerText = configSync.userQuotaRemainingToday;

	// ----- FYI: Daily quota notice div -----
	// If the user has a custom API key, the daily quota notice is not relevant. So we only display it if the user is not providing a custom API key
	if (!configSync.customYoutubeApiKey || !configSync.useCustomApiKeyOption) {
		domElements.dailyQuotaNoticeDiv.classList.remove("hidden");
		numFYIElements++;
	} else {
		domElements.dailyQuotaNoticeDiv.classList.add("hidden");
	}

	// ----- FYI div -----
	// We need to do this after handling all above elements to decide if we even need to show the FYI div
	if (numFYIElements > 0) {
		domElements.forYourInformationDiv.classList.remove("hidden");
	} else {
		domElements.forYourInformationDiv.classList.add("hidden");
	}
}