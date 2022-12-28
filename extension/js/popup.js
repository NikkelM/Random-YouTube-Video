import configSync from "./config.js";

// ---------- Get DOM elements ----------

const useCustomApiKeyOptionToggle = document.getElementById("useCustomApiKeyOptionToggle");
const dbOptOutOptionToggle = document.getElementById("dbOptOutOptionToggle");

// ---------- Set default values from config ----------

useCustomApiKeyOptionToggle.checked = configSync.useCustomApiKeyOption;
// TODO: Make sure the user is allowed to use this option
// TODO: Custom API key must be checked, API key must be provided and != default key
// TODO: Else classList.add("disabled")
dbOptOutOptionToggle.checked = configSync.dbOptOutOption;

// ---------- Event listeners ----------

useCustomApiKeyOptionToggle.addEventListener("change", function () {
	if (this.checked) {
		setSyncStorageValue("useCustomApiKeyOption", true);
	} else {
		setSyncStorageValue("useCustomApiKeyOption", false);
	}
});

dbOptOutOptionToggle.addEventListener("change", function () {
	if (this.checked) {
		setSyncStorageValue("dbOptOutOption", true);
	} else {
		setSyncStorageValue("dbOptOutOption", false);
	}
});

// ---------- Sync storage interaction ----------

async function setSyncStorageValue(key, value) {
	await chrome.storage.sync.set({ [key]: value });
	console.log("Set " + key + " to " + value + " in sync storage");
}