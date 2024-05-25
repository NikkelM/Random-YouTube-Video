// Contains all interaction with the Chrome storage API
import { configSyncDefaults } from "./config.js";

// ----- Storage -----
await validateConfigSync();

export let configSync = await chrome.storage.sync.get();

/* c8 ignore start - This event listener cannot really be tested */
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
/* c8 ignore stop */

// This function also exists in background.js
export async function setSyncStorageValue(key, value) {
	configSync[key] = value;

	await chrome.storage.sync.set({ [key]: value });
}

export async function removeSyncStorageValue(key) {
	delete configSync[key];

	await chrome.storage.sync.remove(key);
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
async function validateConfigSync() {
	const configSyncValues = await chrome.storage.sync.get();

	// Set default values for config values that do not exist in sync storage
	for (const [key, value] of Object.entries(configSyncDefaults)) {
		if (configSyncValues[key] === undefined) {
			await chrome.storage.sync.set({ [key]: value });
		}
	}

	// Remove old config values from sync storage
	for (const [key, _] of Object.entries(configSyncValues)) {
		if (configSyncDefaults[key] === undefined) {
			await chrome.storage.sync.remove(key);
		}
	}

	// Validate that dependent values are correct
	// Custom API key must be set if the user has enabled the custom API key option
	if (configSyncValues.useCustomApiKeyOption && !configSyncValues.customYoutubeApiKey) {
		await chrome.storage.sync.set({ "useCustomApiKeyOption": false });
	}
	// If the user has no custom API key, they must have database sharing enabled
	if (!configSyncValues.useCustomApiKeyOption && !configSyncValues.databaseSharingEnabledOption) {
		await chrome.storage.sync.set({ "databaseSharingEnabledOption": true });
	}

	if (!configSyncValues.shuffleOpenInNewTabOption && configSyncValues.shuffleReUseNewTabOption) {
		await chrome.storage.sync.set({ "shuffleReUseNewTabOption": false });
	}

	if (!(0 <= configSyncValues.shuffleIgnoreShortsOption && configSyncValues.shuffleIgnoreShortsOption <= 2)) {
		await chrome.storage.sync.set({ "shuffleIgnoreShortsOption": 1 });
	}

	if (!(1 <= configSyncValues.shuffleNumVideosInPlaylist && configSyncValues.shuffleNumVideosInPlaylist <= 50)) {
		await chrome.storage.sync.set({ "shuffleNumVideosInPlaylist": 10 });
	}
}
