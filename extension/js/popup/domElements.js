// This file contains functions that are related to the DOM elements of the popup

// ---------- Setup ----------

// Get relevant DOM elements
function getDomElements() {
	return {
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
}

// Set default values from config
// The configSync contains all values the various sliders and text inputs should have
async function setDomElementValuesFromConfig(domElements, configSync) {
	// ----- Custom API key: Option toggle -----
	// If this option is checked is only dependent on the value in sync storage
	domElements.useCustomApiKeyOptionToggle.checked = configSync.useCustomApiKeyOption;

	// ----- Database sharing: Option toggle -----
	// Determine if the dbSharingOptionToggle should be checked and enabled
	manageDbOptOutOption(domElements, configSync);

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
	domElements.popupShuffleButton.innerHTML = `Shuffle from: ${configSync.currentChannelName}`;

	// Contains logic for all the "For your information" div content
	updateFYIDiv(domElements, configSync);
}

// Set event listeners for DOM elements
async function setDomElemenEventListeners(domElements, configSync) {
	// Custom API key: Option toggle
	domElements.useCustomApiKeyOptionToggle.addEventListener("change", function () {
		configSync.useCustomApiKeyOption = this.checked;
		setSyncStorageValue("useCustomApiKeyOption", this.checked, configSync);
		manageDependents(domElements, domElements.useCustomApiKeyOptionToggle, this.checked);
	});

	// Database sharing: Option toggle
	domElements.dbSharingOptionToggle.addEventListener("change", function () {
		configSync.databaseSharingEnabledOption = this.checked;
		setSyncStorageValue("databaseSharingEnabledOption", this.checked, configSync);
		manageDependents(domElements, domElements.dbSharingOptionToggle, this.checked);
	});

	// Custom API key: Input
	domElements.customApiKeySubmitButton.addEventListener("click", async function () {
		// Make sure the passed API key is valid
		const newAPIKey = domElements.customApiKeyInputField.value;
		if (await validateApiKey(newAPIKey, domElements)) {
			configSync.customYoutubeApiKey = newAPIKey;
			await setSyncStorageValue("customYoutubeApiKey", newAPIKey, configSync);
		} else {
			configSync.customYoutubeApiKey = null;
			configSync.databaseSharingEnabledOption = true;
			await setSyncStorageValue("customYoutubeApiKey", null, configSync);
			await setSyncStorageValue("databaseSharingEnabledOption", true, configSync);
			domElements.customApiKeyInputField.value = "";
		}
		manageDbOptOutOption(domElements, configSync);
		manageDependents(domElements, domElements.customApiKeySubmitButton, null);
	});

	// Shuffling: Open in new tab option toggle
	domElements.shuffleOpenInNewTabOptionToggle.addEventListener("change", function () {
		configSync.shuffleOpenInNewTabOption = this.checked;
		setSyncStorageValue("shuffleOpenInNewTabOption", this.checked, configSync);
		manageDependents(domElements, domElements.shuffleOpenInNewTabOptionToggle, this.checked);
	});

	// Shuffling: Open as playlist option toggle
	domElements.shuffleOpenAsPlaylistOptionToggle.addEventListener("change", function () {
		configSync.shuffleOpenAsPlaylistOption = this.checked;
		setSyncStorageValue("shuffleOpenAsPlaylistOption", this.checked, configSync);
		manageDependents(domElements, domElements.shuffleOpenAsPlaylistOptionToggle, this.checked);
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

		manageDependents(domElements, domElements.shuffleLastXVideosChannelCustomInputField, value);
	});

	// Popup shuffle button
	domElements.popupShuffleButton.addEventListener("click", function () {
		// Open the shuffling page in a new tab, which will automatically start the shuffle
		window.open(chrome.runtime.getURL("html/shufflingPage.html"), "Random YouTube Video - Shuffling...");
	});
}

// Sometimes we change the content of the FYI div, or even if it should be displayed at all
async function updateFYIDiv(domElements, configSync) {
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
