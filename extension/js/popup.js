import configSync from "./config.js";

const defaultApiKey = await chrome.runtime.sendMessage({ command: "getDefaultApiKey" });

// ---------- Get DOM elements ----------

const domElements = {
	useCustomApiKeyOptionToggle: document.getElementById("useCustomApiKeyOptionToggle"),
	dbOptOutOptionToggle: document.getElementById("dbOptOutOptionToggle"),
	customApiKeyInput: document.getElementById("customApiKeyInput"),
	submitCustomApiKeyButton: document.getElementById("submitCustomApiKeyButton"),
}

// ---------- Set default values from config ----------

setDomElementDefaultsFromConfig();

// ---------- Event listeners ----------

domElements.useCustomApiKeyOptionToggle.addEventListener("change", function () {
	setSyncStorageValue("useCustomApiKeyOption", this.checked);
	manageDependents(useCustomApiKeyOptionToggle, this.checked);
});

domElements.dbOptOutOptionToggle.addEventListener("change", function () {
	setSyncStorageValue("dbOptOutOption", this.checked);
	manageDependents(dbOptOutOptionToggle, this.checked);
});

domElements.submitCustomApiKeyButton.addEventListener("click", function () {
	setSyncStorageValue("customYoutubeApiKey", domElements.customApiKeyInput.value);
});

// ---------- Sync storage interaction ----------

async function setSyncStorageValue(key, value) {
	await chrome.storage.sync.set({ [key]: value });
	console.log("Set " + key + " to " + value + " in sync storage");
}

// ---------- Helper functions ----------

function checkDbOptOutOptionEligibility() {
	// This option may only be enabled if the user has provided a valid custom Youtube API key
	if (configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey && configSync.customYoutubeApiKey != defaultApiKey) {
		return true;
	} else {
		return false;
	}
}

function setDomElementDefaultsFromConfig() {
	// If this option is checked is only dependent on the value in sync storage
	domElements.useCustomApiKeyOptionToggle.checked = configSync.useCustomApiKeyOption;
	// If useCustomApiKeyOption is not checked, the user may not opt to not use the database
	if (!checkDbOptOutOptionEligibility()) {
		domElements.dbOptOutOptionToggle.parentElement.classList.add("disabled");
	}
	// If this option is checked is dependent on the value of the customApiKeyOption and the value in sync storage 
	domElements.dbOptOutOptionToggle.checked = checkDbOptOutOptionEligibility() && configSync.dbOptOutOption;
	// Show the customAPIKeyInput if the user has enabled the option
	if (configSync.useCustomApiKeyOption) {
		domElements.customApiKeyInput.classList.remove("hidden");
	}
	domElements.customApiKeyInput.value = configSync.customYoutubeApiKey;
}

function manageDependents(parent, checked) {
	switch (parent) {
		case domElements.useCustomApiKeyOptionToggle:
			if (checked) {
				// The user may now opt to not use the database
				if (checkDbOptOutOptionEligibility()) {
					domElements.dbOptOutOptionToggle.parentElement.classList.remove("disabled");
				}
				// Show input field for custom API key
				domElements.customApiKeyInput.classList.remove("hidden");
			} else {
				// The user may no longer opt to not use the database
				domElements.dbOptOutOptionToggle.checked = false;
				setSyncStorageValue("dbOptOutOption", false);
				domElements.dbOptOutOptionToggle.parentElement.classList.add("disabled");
				// Hide input field for custom API key
				domElements.customApiKeyInput.classList.add("hidden");
			}
			break;
		default:
			console.log("No dependents to manage for element: " + parent.id);
			break;
	}
}