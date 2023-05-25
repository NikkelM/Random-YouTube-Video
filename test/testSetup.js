import sinonChrome from 'sinon-chrome';
import { configSyncDefaults } from '../src/config.js';

global.chrome = sinonChrome;

// ---------- Sync storage ----------
let mockedConfigSync = {};

chrome.storage.sync.get.callsFake(() => {
	return Promise.resolve(mockedConfigSync);
});
chrome.storage.sync.set.callsFake((obj) => {
	Object.assign(mockedConfigSync, obj);
	return Promise.resolve();
});
chrome.storage.sync.clear.callsFake(() => {
	for (const key in mockedConfigSync) {
		delete mockedConfigSync[key];
	}
	return Promise.resolve();
});

// Utility to get a date object from x days ago
function daysAgo(x) {
	return new Date(Date.now() - x * 24 * 60 * 60 * 1000);
}

// ---------- Local storage ----------
const defaultLocalStorage = {
	"UU-DBUpToDateAccessedRecently": {
		"lastAccessedLocally": daysAgo(0).toISOString(),
		"lastFetchedFromDB": daysAgo(0).toISOString(),
		"lastVideoPublishedAt": daysAgo(3).toISOString(),
		"videos": {
			"00000000001": daysAgo(3).toISOString(),
			"00000000002": daysAgo(4).toISOString(),
			"00000000003": daysAgo(5).toISOString(),
			"00000000004": daysAgo(6).toISOString(),
			"00000000005": daysAgo(7).toISOString(),
			"00000000006": daysAgo(8).toISOString(),
			"00000000007": daysAgo(9).toISOString(),
			"00000000008": daysAgo(10).toISOString(),
			"00000000009": daysAgo(11).toISOString(),
			"00000000010": daysAgo(12).toISOString(),
			"00000000011": daysAgo(13).toISOString()
		}
	}
};

let mockedLocalStorage = {};

chrome.storage.local.get.callsFake(() => {
	return Promise.resolve(mockedLocalStorage);
});
chrome.storage.local.set.callsFake((obj) => {
	Object.assign(mockedLocalStorage, obj);
	return Promise.resolve();
});
chrome.storage.local.clear.callsFake(() => {
	for (const key in mockedLocalStorage) {
		delete mockedLocalStorage[key];
	}
	return Promise.resolve();
});


beforeEach(() => {
	chrome.storage.sync.set(configSyncDefaults);
	chrome.storage.local.set(defaultLocalStorage);
});

afterEach(async function () {
	await chrome.storage.sync.clear();
	await chrome.storage.local.clear();
});