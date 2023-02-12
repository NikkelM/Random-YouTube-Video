const defaultApiKey = await chrome.runtime.sendMessage({ command: "getDefaultApiKey" });

let configSync = await fetchConfigSync();

// ---------- Get relevant DOM elements ----------

const domElements = {
	// Custom API key: Option toggle
	useCustomApiKeyOptionToggle: document.getElementById("useCustomApiKeyOptionToggle"),
	// Custom API key: Input
	customApiKeyInputDiv: document.getElementById("customApiKeyInputDiv"),
	customApiKeyInputField: customApiKeyInputDiv.children.namedItem("customApiKeyInputField"),
	customApiKeySubmitButton: customApiKeyInputDiv.children.namedItem("customApiKeySubmitButton"),
	customApiKeyInputErrorDiv: customApiKeyInputDiv.children.namedItem("customApiKeyInputErrorDiv"),
	customApiKeyInputErrorText: customApiKeyInputErrorDiv.children.namedItem("customApiKeyInputErrorText"),
	// Database sharing: Option toggle
	dbSharingOptionToggle: document.getElementById("dbSharingOptionToggle"),
	// Shuffling: Open in new tab option toggle
	shuffleOpenInNewTabOptionToggle: document.getElementById("shuffleOpenInNewTabOptionToggle"),
	// Shuffling: Open as playlist option toggle
	shuffleOpenAsPlaylistOptionToggle: document.getElementById("shuffleOpenAsPlaylistOptionToggle"),
	// Shuffling: Shuffle from last x% of videos input
	shuffleLastXVideosInputField: document.getElementById("shuffleLastXVideosInputField"),
	// Custom options per channel div
	channelCustomOptionsDiv: document.getElementById("channelCustomOptionsDiv"),
	// Custom options per channel: Channel name and description
	channelCustomOptionsHeader: channelCustomOptionsDiv.children.namedItem("channelCustomOptionsHeader"),
	// Custom options per channel: Shuffling: Shuffle from last x% of videos input
	shuffleLastXVideosChannelCustomInputField: document.getElementById("shuffleLastXVideosChannelCustomInputField"),
}

// ---------- Set default values from config ----------

function setDomElementDefaultsFromConfig() {
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
	domElements.channelCustomOptionsHeader.innerText = `Settings for "${configSync.currentChannelName}"`;

	// ----- Custom options per channel: Shuffling: Shuffle from last x% of videos input -----
	domElements.shuffleLastXVideosChannelCustomInputField.value = configSync.customShufflePercentages[configSync.currentChannelId] ?? 100;
}

setDomElementDefaultsFromConfig();

// ---------- Event listeners ----------

// Custom API key: Option toggle
domElements.useCustomApiKeyOptionToggle.addEventListener("change", function () {
	setSyncStorageValue("useCustomApiKeyOption", this.checked);
	manageDependents(domElements.useCustomApiKeyOptionToggle, this.checked);
});

// Database sharing: Option toggle
domElements.dbSharingOptionToggle.addEventListener("change", function () {
	setSyncStorageValue("databaseSharingEnabledOption", this.checked);
	manageDependents(domElements.dbSharingOptionToggle, this.checked);
});

// Custom API key: Input
domElements.customApiKeySubmitButton.addEventListener("click", async function () {
	// Make sure the passed API key is valid
	const newApiKey = domElements.customApiKeyInputField.value;
	if (await validateApiKey(newApiKey)) {
		setSyncStorageValue("customYoutubeApiKey", newApiKey);
	} else {
		setSyncStorageValue("customYoutubeApiKey", null);
		setSyncStorageValue("databaseSharingEnabledOption", true);
		domElements.customApiKeyInputField.value = "";
	}
	manageDbOptOutOption();
});

// Shuffling: Open in new tab option toggle
domElements.shuffleOpenInNewTabOptionToggle.addEventListener("change", function () {
	setSyncStorageValue("shuffleOpenInNewTabOption", this.checked);
	manageDependents(domElements.shuffleOpenInNewTabOptionToggle, this.checked);
});

// Shuffling: Open as playlist option toggle
domElements.shuffleOpenAsPlaylistOptionToggle.addEventListener("change", function () {
	setSyncStorageValue("shuffleOpenAsPlaylistOption", this.checked);
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
		let customShufflePercentages = configSync.customShufflePercentages;
		customShufflePercentages[configSync.currentChannelId] = value;

		setSyncStorageValue("customShufflePercentages", customShufflePercentages);
	}

	// Set the value of the input field to the clamped value
	this.value = value;

	manageDependents(domElements.shuffleLastXVideosChannelCustomInputField, value);
});

// ----- Dependency management -----

function manageDependents(parent, checked) {
	switch (parent) {
		// Custom API key: Option toggle
		case domElements.useCustomApiKeyOptionToggle:
			if (checked) {
				// Show input field for custom API key
				domElements.customApiKeyInputDiv.classList.remove("hidden");
				// Set the value of the custom API key input field to the value in sync storage
				domElements.customApiKeyInputField.value = configSync.customYoutubeApiKey ? configSync.customYoutubeApiKey : "";

				manageDbOptOutOption();
			} else {
				// The user must share data with the database
				domElements.dbSharingOptionToggle.checked = true;
				setSyncStorageValue("databaseSharingEnabledOption", true);
				manageDbOptOutOption();

				// Hide input field for custom API key
				domElements.customApiKeyInputDiv.classList.add("hidden");
			}
			break;
		default:
			console.log(`No dependents to manage for element: ${parent.id}`);
			break;
	}
}

// ---------- Sync storage interaction ----------

async function setSyncStorageValue(key, value) {
	configSync[key] = value;

	await chrome.storage.sync.set({ [key]: value });

	// Refresh the config in the background script. Send it like this to avoid a request to the chrome storage API
	chrome.runtime.sendMessage({ command: "newConfigSync", data: configSync });

	console.log(`Set ${key} to ${value} in sync storage.`);
}

async function fetchConfigSync() {
	return await chrome.storage.sync.get().then((result) => {
		return result;
	});
}

// ---------- Helper functions ----------

function checkDbOptOutOptionEligibility() {
	// This option may only be enabled if the user has provided a valid custom Youtube API key
	return (configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey && configSync.customYoutubeApiKey !== defaultApiKey);
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
		setSyncStorageValue("databaseSharingEnabledOption", configSync.databaseSharingEnabledOption);
	}
	domElements.dbSharingOptionToggle.checked = configSync.databaseSharingEnabledOption;
}

// Validates a YouTube API key by sending a short request
async function validateApiKey(key) {
	const apiResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=YouTube+Data+API&type=video&key=${key}`)
		.then((response) => response.json());

	if (apiResponse["error"]) {
		domElements.customApiKeyInputErrorDiv.classList.remove("hidden");
		domElements.customApiKeyInputErrorText.innerText = apiResponse["error"]["message"];
		return false;
	}
	domElements.customApiKeyInputErrorDiv.classList.add("hidden");
	return true;
}