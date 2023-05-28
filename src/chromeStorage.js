// Contains all interaction with the Chrome storage API
import { configSyncDefaults } from "./config.js";

// ----- Storage -----
// Validate the config in sync storage
await validateConfigSync();

export let configSync = await fetchConfigSync();

/* c8 ignore start - This event listener cannot really be tested*/
// Whenever someone changes a value in sync storage, we need to be notified to update the global configSync object
chrome.storage.onChanged.addListener(async function (changes, namespace) {
	// We only care about changes to the sync storage
	if (namespace !== "sync") {
		return;
	}
	for (const [key, value] of Object.entries(changes)) {
		configSync[key] = value.newValue;
	}
});
/* c8 ignore stop*/

// This function also exists in background.js
export async function setSyncStorageValue(key, value) {
	configSync[key] = value;

	await chrome.storage.sync.set({ [key]: value });
}

// Returns the number of requests the user can still make to the Youtube API today
export async function getUserQuotaRemainingToday() {
	// The quota gets reset at midnight
	if (configSync.userQuotaResetTime < Date.now()) {
		await setSyncStorageValue("userQuotaRemainingToday", 200);
		await setSyncStorageValue("userQuotaResetTime", new Date(new Date().setHours(24, 0, 0, 0)).getTime());
	}
	return configSync.userQuotaRemainingToday;
}

// -- Private --
async function fetchConfigSync() {
	let configSync = await chrome.storage.sync.get().then((result) => {
		return result;
	});

	return configSync;
}

async function validateConfigSync() {
	const configSyncValues = await chrome.storage.sync.get();

	// Set default values for config values that do not exist in sync storage
	for (const [key, value] of Object.entries(configSyncDefaults)) {
		if (configSyncValues[key] === undefined) {
			console.log(`Config value (setting) "${key}" does not exist in sync storage. Setting default:`);
			console.log(value);
			await chrome.storage.sync.set({ [key]: value });
		}
	}

	// Remove old config values from sync storage
	for (const [key, value] of Object.entries(configSyncValues)) {
		if (configSyncDefaults[key] === undefined) {
			console.log(`Config value (setting) "${key}" is not used anymore (was removed with the most recent update). Removing it from sync storage...`);
			await chrome.storage.sync.remove(key);
		}
	}
}
