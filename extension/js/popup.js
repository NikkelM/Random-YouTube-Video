import configSync from "./config.js";

const defaultApiKey = await chrome.runtime.sendMessage({ command: "getDefaultApiKey" });

// ---------- Get DOM elements ----------

const domElements = {
	useCustomApiKeyOptionToggle: document.getElementById("useCustomApiKeyOptionToggle"),
	dbOptOutOptionToggle: document.getElementById("dbOptOutOptionToggle"),
	customApiKeyInputDiv: document.getElementById("customApiKeyInputDiv"),
	customApiKeyInputField: customApiKeyInputDiv.children.namedItem("customApiKeyInputField"),
	customApiKeySubmitButton: customApiKeyInputDiv.children.namedItem("customApiKeySubmitButton"),
	customApiKeyInputErrorDiv: customApiKeyInputDiv.children.namedItem("customApiKeyInputErrorDiv"),
	customApiKeyInputErrorText: customApiKeyInputErrorDiv.children.namedItem("customApiKeyInputErrorText"),
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

domElements.customApiKeySubmitButton.addEventListener("click", async function () {
	// Make sure the passed API key is valid
	const newApiKey = domElements.customApiKeyInputField.value;
	if (!await validateApiKey(newApiKey)) {
		setSyncStorageValue("customYoutubeApiKey", null);
		domElements.customApiKeyInputField.value = "";
	} else {
		setSyncStorageValue("customYoutubeApiKey", newApiKey);
	}
	manageDbOptOutOption();
});

// ---------- Sync storage interaction ----------

async function setSyncStorageValue(key, value) {
	configSync[key] = value;
	await chrome.storage.sync.set({ [key]: value });
	console.log("Set " + key + " to " + value + " in sync storage.");
}

// ---------- Helper functions ----------

function checkDbOptOutOptionEligibility() {
	console.log(configSync.customYoutubeApiKey)
	// This option may only be enabled if the user has provided a valid custom Youtube API key
	if (configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey && configSync.customYoutubeApiKey !== defaultApiKey) {
		return true;
	} else {
		return false;
	}
}

function manageDbOptOutOption() {
	// If useCustomApiKeyOption is not checked, the user may not opt to not use the database
	if (checkDbOptOutOptionEligibility()) {
		domElements.dbOptOutOptionToggle.parentElement.classList.remove("disabled");
	} else {
		console.log("The user may not opt to not use the database.")
		domElements.dbOptOutOptionToggle.parentElement.classList.add("disabled");
	}
	// If this option is checked is dependent on the value of the customApiKeyOption and the value in sync storage 
	domElements.dbOptOutOptionToggle.checked = checkDbOptOutOptionEligibility() && configSync.dbOptOutOption;
}

function setDomElementDefaultsFromConfig() {
	// If this option is checked is only dependent on the value in sync storage
	domElements.useCustomApiKeyOptionToggle.checked = configSync.useCustomApiKeyOption;
	// Determine if the dbOptOutOptionToggle should be checked and enabled
	manageDbOptOutOption();
	// Show the customAPIKeyInputDiv if the user has enabled the option
	if (configSync.useCustomApiKeyOption) {
		domElements.customApiKeyInputDiv.classList.remove("hidden");
	}
	// Set the value of the custom API key input field to the value in sync storage
	domElements.customApiKeyInputField.value = configSync.customYoutubeApiKey ? configSync.customYoutubeApiKey : "";
}

function manageDependents(parent, checked) {
	switch (parent) {
		case domElements.useCustomApiKeyOptionToggle:
			if (checked) {
				// Show input field for custom API key
				domElements.customApiKeyInputDiv.classList.remove("hidden");
				// Set the value of the custom API key input field to the value in sync storage
				domElements.customApiKeyInputField.value = configSync.customYoutubeApiKey ? configSync.customYoutubeApiKey : "";

				manageDbOptOutOption();
			} else {
				// The user may no longer opt to not use the database
				domElements.dbOptOutOptionToggle.checked = false;
				setSyncStorageValue("dbOptOutOption", false);
				manageDbOptOutOption();

				// Hide input field for custom API key
				domElements.customApiKeyInputDiv.classList.add("hidden");
			}
			break;
		default:
			console.log("No dependents to manage for element: " + parent.id);
			break;
	}
}

async function validateApiKey(key) {
	const apiResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=YouTube+Data+API&type=video&key=${key}`)
		.then((response) => response.json());

	if (apiResponse["error"]) {
		console.log(apiResponse);
		domElements.customApiKeyInputErrorDiv.classList.remove("hidden");
		domElements.customApiKeyInputErrorText.innerText = apiResponse["error"]["message"];
		return false;
	}
	domElements.customApiKeyInputErrorDiv.classList.add("hidden");
	return true;
}

chrome.storage.sync.get(console.log);