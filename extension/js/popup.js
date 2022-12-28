import configSync from "./config.js";

// ---------- Get DOM elements ----------

const useCustomApiKeyOptionToggle = document.getElementById("useCustomApiKeyOptionToggle");

// ---------- Set default values from config ----------

useCustomApiKeyOptionToggle.checked = configSync.useCustomApiKeyOption;

// ---------- Event listeners ----------

useCustomApiKeyOptionToggle.addEventListener("change", function () {
	if (this.checked) {
		setSyncStorageValue("useCustomApiKeyOption", true);
	} else {
		setSyncStorageValue("useCustomApiKeyOption", false);
	}
});

// ---------- Sync storage interaction ----------

async function setSyncStorageValue(key, value) {
	await chrome.storage.sync.set({ [key]: value });
	console.log("Set " + key + " to " + value + " in sync storage");
}