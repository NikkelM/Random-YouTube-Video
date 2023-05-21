// Contains all interaction with the Chrome storage API
// ----- Storage -----
export let configSync = await fetchConfigSync();

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
