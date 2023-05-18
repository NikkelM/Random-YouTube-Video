// This file contains functions that are related to the DOM elements of the popup

// ---------- Setup ----------

// Get relevant DOM elements
function getDomElements() {
	return {
		// Body element
		body: document.body,

		// GLOBAL SETTINGS
		// Custom API key: Option toggle
		useCustomApiKeyOptionToggle: document.getElementById("useCustomApiKeyOptionToggle"),
		// Custom API key: Input
		customApiKeyInputDiv: document.getElementById("customApiKeyInputDiv"),
		customApiKeyInputField: customApiKeyInputDiv.children.namedItem("customApiKeyInputField"),
		customApiKeySubmitButton: customApiKeyInputDiv.children.namedItem("customApiKeySubmitButton"),
		customApiKeyInputInfoDiv: customApiKeyInputDiv.children.namedItem("customApiKeyInputInfoDiv"),
		customApiKeyInputInfoText: customApiKeyInputInfoDiv.children.namedItem("customApiKeyInputInfoText"),
		customApiKeyHowToGetDiv: document.getElementById("customApiKeyHowToGetDiv"),

		// Database sharing: Option toggle
		dbSharingOptionToggle: document.getElementById("dbSharingOptionToggle"),
		// Shuffling: Open in new tab option toggle
		shuffleOpenInNewTabOptionToggle: document.getElementById("shuffleOpenInNewTabOptionToggle"),
		// Shuffling: Reuse tab option toggle
		shuffleReUseNewTabOptionToggle: document.getElementById("shuffleReUseNewTabOptionToggle"),
		// Shuffling : Ignore shorts option toggle
		shuffleIgnoreShortsOptionToggle: document.getElementById("shuffleIgnoreShortsOptionToggle"),
		// Shuffling: Open as playlist option toggle
		shuffleOpenAsPlaylistOptionToggle: document.getElementById("shuffleOpenAsPlaylistOptionToggle"),
		// Shuffling: Number of videos in playlist div
		shuffleNumVideosInPlaylistDiv: document.getElementById("shuffleNumVideosInPlaylistDiv"),
		// Shuffling: Number of videos in playlist input
		shuffleNumVideosInPlaylistInput: shuffleNumVideosInPlaylistDiv.children.namedItem("shuffleNumVideosInPlaylistInput"),

		// PER CHANNEL SETTINGS
		// Custom options per channel div
		channelCustomOptionsDiv: document.getElementById("channelCustomOptionsDiv"),
		// Custom options per channel: Channel name and description
		channelCustomOptionsHeader: channelCustomOptionsDiv.children.namedItem("channelCustomOptionsHeader"),
		// Custom options per channel: Dropdown menu Div (only for reference below)
		channelCustomOptionsDropdownDiv: channelCustomOptionsDiv.children.namedItem("channelCustomOptionsDropdownDiv"),
		// Dropdown menu div: Dropdown menu
		channelCustomOptionsDropdown: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsDropdown"),
		// ----- Inputs -----
		// Dropdown menu div: Date input
		channelCustomOptionsDateOptionInput: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsDateOptionInput"),
		// Dropdown menu div: YouTube Video ID input
		channelCustomOptionsVideoIdOptionInput: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsVideoIdOptionInput"),
		// Dropdown menu div: Percentage input
		channelCustomOptionsPercentageOptionInput: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsPercentageOptionInput"),
		// Dropdown menu div: Percentage input p for % sign
		channelCustomOptionsPercentageOptionP: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsPercentageOptionP"),

		// Popup shuffle button
		popupShuffleButton: document.getElementById("popupShuffleButton"),

		// FYI - FOR YOUR INFORMATION
		// FYI div
		forYourInformationDiv: document.getElementById("forYourInformationDiv"),
		// FYI: Number of shuffled videos text
		numberOfShuffledVideosText: forYourInformationDiv.children.namedItem("numberOfShuffledVideosText"),
		// FYI: Daily quota notice div
		dailyQuotaNoticeDiv: forYourInformationDiv.children.namedItem("dailyQuotaNoticeDiv"),
		// Daily quota notice: Text
		dailyQuotaNoticeText: dailyQuotaNoticeDiv.children.namedItem("dailyQuotaNoticeText"),

		// FOOTER
		// View changelog button
		viewChangelogButton: document.getElementById("viewChangelogButton"),
	}
}

// Set default values from config
// The configSync contains all values the various sliders and text inputs should have
async function setDomElementValuesFromConfig(domElements, configSync) {
	// Disable animations to prevent them from playing when setting the values
	toggleAnimations(domElements, false);

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
	manageDependents(domElements, domElements.shuffleOpenInNewTabOptionToggle, configSync.shuffleOpenInNewTabOption, configSync);

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
	updateDomElementsDependentOnChannel(domElements, configSync);

	// ----- Custom options per channel div -----
	if (configSync.currentChannelId) {
		domElements.channelCustomOptionsDiv.classList.remove("hidden");
	}

	// Contains logic for all the "For your information" div content
	updateFYIDiv(domElements, configSync);

	// If the current extension version is newer than configSync.lastViewedChangelogVersion, highlight the changelog button
	if (configSync.lastViewedChangelogVersion !== chrome.runtime.getManifest().version) {
		domElements.viewChangelogButton.classList.add("highlight-green");
	}

	// Enable animations
	toggleAnimations(domElements, true);
}

async function toggleAnimations(domElements, enable) {
	if (enable) {
		// Small delay to make sure running animations cannot be seen
		await delay(100);
		domElements.body.classList.remove("no-transitions");
	} else {
		domElements.body.classList.add("no-transitions");
	}
}

// Set event listeners for DOM elements
async function setDomElemenEventListeners(domElements, configSync) {
	// Custom API key: Option toggle
	domElements.useCustomApiKeyOptionToggle.addEventListener("change", async function () {
		configSync.useCustomApiKeyOption = this.checked;
		await setSyncStorageValue("useCustomApiKeyOption", this.checked, configSync);

		manageDependents(domElements, domElements.useCustomApiKeyOptionToggle, this.checked, configSync);
	});

	// Database sharing: Option toggle
	domElements.dbSharingOptionToggle.addEventListener("change", async function () {
		configSync.databaseSharingEnabledOption = this.checked;
		await setSyncStorageValue("databaseSharingEnabledOption", this.checked, configSync);

		manageDependents(domElements, domElements.dbSharingOptionToggle, this.checked, configSync);
	});

	// Custom API key: Input
	domElements.customApiKeySubmitButton.addEventListener("click", async function () {
		// Make sure the passed API key is valid
		const newAPIKey = domElements.customApiKeyInputField.value;

		if (newAPIKey.length > 0 && await validateApiKey(newAPIKey, domElements)) {
			configSync.customYoutubeApiKey = newAPIKey;
			await setSyncStorageValue("customYoutubeApiKey", newAPIKey, configSync);
		} else {
			configSync.customYoutubeApiKey = null;
			configSync.databaseSharingEnabledOption = true;
			await setSyncStorageValue("customYoutubeApiKey", null, configSync);
			await setSyncStorageValue("databaseSharingEnabledOption", true, configSync);
			domElements.customApiKeyInputField.value = "";
		}
		// If the user removed the API key, show a message in the info div
		if (newAPIKey.length === 0) {
			domElements.customApiKeyInputInfoText.innerText = "Custom API key was successfully removed.";
			domElements.customApiKeyInputInfoDiv.classList.remove("hidden");
		}

		manageDbOptOutOption(domElements, configSync);

		manageDependents(domElements, domElements.customApiKeySubmitButton, null, configSync);
	});

	// Shuffling: Open in new tab option toggle
	domElements.shuffleOpenInNewTabOptionToggle.addEventListener("change", async function () {
		configSync.shuffleOpenInNewTabOption = this.checked;
		await setSyncStorageValue("shuffleOpenInNewTabOption", this.checked, configSync);

		manageDependents(domElements, domElements.shuffleOpenInNewTabOptionToggle, this.checked, configSync);
	});

	// Shuffling: Reuse tab option toggle
	domElements.shuffleReUseNewTabOptionToggle.addEventListener("change", async function () {
		configSync.shuffleReUseNewTabOption = this.checked;
		await setSyncStorageValue("shuffleReUseNewTabOption", this.checked, configSync);

		manageDependents(domElements, domElements.shuffleReUseNewTabOptionToggle, this.checked, configSync);
	});

	// Shuffling: Ignore shorts option toggle
	domElements.shuffleIgnoreShortsOptionToggle.addEventListener("change", async function () {
		configSync.shuffleIgnoreShortsOption = this.checked;
		await setSyncStorageValue("shuffleIgnoreShortsOption", this.checked, configSync);

		manageDependents(domElements, domElements.shuffleIgnoreShortsOptionToggle, this.checked, configSync);
	});

	// Shuffling: Open as playlist option toggle
	domElements.shuffleOpenAsPlaylistOptionToggle.addEventListener("change", async function () {
		configSync.shuffleOpenAsPlaylistOption = this.checked;
		await setSyncStorageValue("shuffleOpenAsPlaylistOption", this.checked, configSync);

		manageDependents(domElements, domElements.shuffleOpenAsPlaylistOptionToggle, this.checked, configSync);
	});

	// Shuffling: Number of videos in playlist input
	domElements.shuffleNumVideosInPlaylistInput.addEventListener("focusout", async function () {
		if (this.value === "") {
			// Set the previous value if the input is empty, or set it to 5 if there is no previous value
			this.value = configSync.shuffleNumVideosInPlaylist ?? 5;

			this.classList.add('invalid-input');
			setTimeout(() => {
				this.classList.remove('invalid-input');
			}, 1500);
		}

		// Clamp the value to the range [1, 50]
		const minValue = parseInt(this.getAttribute("min"));
		const maxValue = parseInt(this.getAttribute("max"));
		if (this.value < minValue || this.value > maxValue) {
			this.value = Math.min(Math.max(Math.round(this.value), minValue), maxValue);

			this.classList.add('invalid-input');
			setTimeout(() => {
				this.classList.remove('invalid-input');
			}, 1500);
		}

		await setSyncStorageValue("shuffleNumVideosInPlaylist", parseInt(this.value), configSync);

		manageDependents(domElements, domElements.shuffleNumVideosInPlaylistInput, this.value, configSync);
	});

	// Custom options per channel: Dropdown menu
	domElements.channelCustomOptionsDropdown.addEventListener("change", async function () {
		// Update the configSync in case the channel was changed after the event listener was added
		configSync = await fetchConfigSync();

		// Set the value in configSync to the currently selected option
		await setChannelSetting(configSync.currentChannelId, "activeOption", this.value);

		updateChannelSettingsDropdownMenu(domElements, configSync);

		manageDependents(domElements, domElements.channelCustomOptionsDropdown, this.value, configSync);
	});

	// Custom options per channel: Dropdown menu: Date input
	domElements.channelCustomOptionsDateOptionInput.addEventListener("focusout", async function () {
		// Update the configSync in case the channel was changed after the event listener was added
		configSync = await fetchConfigSync();

		// Make sure the date is valid. If it is not, set it to the previous value. If there is no previous value, set it to null
		const selectedDate = new Date(this.value);
		if (selectedDate > new Date()) {
			this.value = configSync.channelSettings[configSync.currentChannelId]?.dateValue ?? null;

			this.classList.add('invalid-input');
			setTimeout(() => {
				this.classList.remove('invalid-input');
			}, 1500);
		}

		// Set the value in sync storage
		if (this.value) {
			await setChannelSetting(configSync.currentChannelId, "dateValue", this.value);
		} else {
			await removeChannelSetting(configSync.currentChannelId, "dateValue");
		}

		manageDependents(domElements, domElements.channelCustomOptionsDateOptionInput, this.value, configSync);
	});

	// Custom options per channel: Dropdown menu: Youtube Video Id input
	domElements.channelCustomOptionsVideoIdOptionInput.addEventListener("focusout", async function () {
		// Update the configSync in case the channel was changed after the event listener was added
		configSync = await fetchConfigSync();

		// If an ID was entered, make sure it is valid, i.e. consists of 11 characters
		if (this.value.length === 11) {
			// In case we previously had an invalid input, reset the placeholder
			this.placeholder = "Enter Video ID";
			// Set the value in sync storage
			await setChannelSetting(configSync.currentChannelId, "videoIdValue", this.value);
		} else if (this.value === "") {
			// If the input is empty, remove the value from sync storage
			await removeChannelSetting(configSync.currentChannelId, "videoIdValue");
		} else {
			// Else, the input was invalid
			this.value = configSync.channelSettings[configSync.currentChannelId].videoIdValue ?? "";
			if (this.value === "") {
				this.placeholder = "Invalid video ID";
			}

			this.classList.add('invalid-input');
			setTimeout(() => {
				this.classList.remove('invalid-input');
			}, 1500);
		}

		manageDependents(domElements, domElements.channelCustomOptionsVideoIdOptionInput, this.value, configSync);
	});

	// Custom options per channel: Dropdown menu: Percentage input
	domElements.channelCustomOptionsPercentageOptionInput.addEventListener("focusout", async function () {
		// Update the configSync in case the channel was changed after the event listener was added
		configSync = await fetchConfigSync();

		if (this.value === "") {
			// Set the previous value if the input is empty, or set it to 100 if there is no previous value
			this.value = configSync.channelSettings[configSync.currentChannelId]?.percentageValue ?? 100;

			this.classList.add('invalid-input');
			setTimeout(() => {
				this.classList.remove('invalid-input');
			}, 1500);
		}

		// Clamp the value to the range [1, 100]
		const minValue = parseInt(this.getAttribute("min"));
		const maxValue = parseInt(this.getAttribute("max"));
		if (this.value < minValue || this.value > maxValue) {
			this.value = Math.min(Math.max(Math.round(this.value), minValue), maxValue);

			this.classList.add('invalid-input');
			setTimeout(() => {
				this.classList.remove('invalid-input');
			}, 1500);
		}

		// We only need to save the value if it's not the default of 100. If we have already saved a different one, we want to remove it
		if (this.value != 100) {
			await setChannelSetting(configSync.currentChannelId, "percentageValue", parseInt(this.value));
		} else {
			await removeChannelSetting(configSync.currentChannelId, "percentageValue");
		}

		manageDependents(domElements, domElements.channelCustomOptionsPercentageOptionInput, this.value, configSync);
	});

	// Popup shuffle button
	domElements.popupShuffleButton.addEventListener("click", function () {
		focusOrOpenTab(chrome.runtime.getURL("html/shufflingPage.html"));
		// Close the popup
		window.close();
	});

	// View changelog button
	domElements.viewChangelogButton.addEventListener("click", async function () {
		await setSyncStorageValue("lastViewedChangelogVersion", chrome.runtime.getManifest().version, configSync);
		focusOrOpenTab(chrome.runtime.getURL("html/changelog.html"));
		// Close the popup
		window.close();
	});
}

async function updateFYIDiv(domElements, configSync) {
	// ----- FYI: Number of shuffled videos text -----
	// Use toLocaleString() to add commas/periods to large numbers
	const numShuffledVideosTotal = configSync.numShuffledVideosTotal.toLocaleString();
	domElements.numberOfShuffledVideosText.innerText = `You have shuffled ${numShuffledVideosTotal} video${(configSync.numShuffledVideosTotal !== 1) ? "s" : ""} until now.`;

	// ----- Daily quota notice -----
	await getUserQuotaRemainingToday(configSync);

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

// Responsible for all DOM elements that need a reference to the current channel
async function updateDomElementsDependentOnChannel(domElements, configSync) {
	// ----- Custom options per channel: Channel name and description -----
	domElements.channelCustomOptionsHeader.innerText = `Channel Settings: ${configSync.currentChannelName}`;

	// ----- Custom options per channel: Dropdown menu -----
	updateChannelSettingsDropdownMenu(domElements, configSync);

	// ----- Popup shuffle button -----
	domElements.popupShuffleButton.innerText = `Shuffle from: ${configSync.currentChannelName}`;
}

async function updateChannelSettingsDropdownMenu(domElements, configSync) {
	// ----- Custom options per channel: Dropdown menu -----
	// Set the dropdown menu to the active option chosen by the user
	// The default value is "allVideosOption"
	channelCustomOptionsDropdown.value = configSync.channelSettings[configSync.currentChannelId]?.activeOption ?? "allVideosOption";
	channelCustomOptionsDropdown.style.width = channelCustomOptionsDropdown.options[channelCustomOptionsDropdown.selectedIndex].getAttribute("option-width");
	channelCustomOptionsDropdown.title = channelCustomOptionsDropdown.options[channelCustomOptionsDropdown.selectedIndex].title;

	switch (channelCustomOptionsDropdown.value) {
		case "allVideosOption":
			// Hide all inputs
			domElements.channelCustomOptionsDateOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionP.classList.add("hidden");
			break;
		case "dateOption":
			// Hide the other inputs and unhide this one
			domElements.channelCustomOptionsDateOptionInput.classList.remove("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionP.classList.add("hidden");
			// Set the value of the active input to the value saved in the configSync
			// If no date was set yet, set it to null
			domElements.channelCustomOptionsDateOptionInput.value = configSync.channelSettings[configSync.currentChannelId]?.dateValue ?? null;
			break;
		case "videoIdOption":
			domElements.channelCustomOptionsDateOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.classList.remove("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionP.classList.add("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.value = configSync.channelSettings[configSync.currentChannelId]?.videoIdValue ?? "";
			break;
		case "percentageOption":
			domElements.channelCustomOptionsDateOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.classList.remove("hidden");
			domElements.channelCustomOptionsPercentageOptionP.classList.remove("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.value = configSync.channelSettings[configSync.currentChannelId]?.percentageValue ?? 100;
			break;
	}
}
