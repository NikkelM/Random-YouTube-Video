import sinonChrome from 'sinon-chrome';

import { configSyncDefaults } from './testConfig.js';
import { deepCopy, localPlaylistPermutations, databasePermutations } from './playlistPermutations.js';

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
chrome.storage.sync.remove.callsFake((key) => {
	delete mockedConfigSync[key];
	return Promise.resolve();
});
chrome.storage.sync.clear.callsFake(() => {
	for (const key in mockedConfigSync) {
		delete mockedConfigSync[key];
	}
	return Promise.resolve();
});

// ---------- Local storage ----------
let mockedLocalStorage = {};

chrome.storage.local.get.callsFake(() => {
	return Promise.resolve(mockedLocalStorage);
});
chrome.storage.local.set.callsFake((obj) => {
	Object.assign(mockedLocalStorage, deepCopy(obj));
	return Promise.resolve();
});
chrome.storage.local.remove.callsFake((key) => {
	delete mockedLocalStorage[key];
	return Promise.resolve();
});
chrome.storage.local.clear.callsFake(() => {
	for (const key in mockedLocalStorage) {
		delete mockedLocalStorage[key];
	}
	return Promise.resolve();
});

// ---------- Chrome runtime message listener ----------
chrome.runtime.sendMessage.callsFake((request) => {
	switch (request.command) {
		case "connectionTest":
			return Promise.resolve("Connection test successful.");

		case 'getPlaylistFromDB':
			// Return a playlist from the database
			return Promise.resolve(deepCopy(mockedDatabase[request.data] ?? null));

		// With our mocked database, both commands have the same effect
		case 'updatePlaylistInfoInDB':
			request.data.val.videos = { ...mockedDatabase[request.data.key]?.videos ?? {}, ...deepCopy(request.data.val.videos) };
		case 'overwritePlaylistInfoInDB':
			// Update/Overwrite a playlist in the database
			mockedDatabase[request.data.key] = deepCopy(request.data.val);
			return "PlaylistInfo was sent to database.";

		// Only for the tests
		case "setKeyInDB":
			mockedDatabase[request.data.key] = deepCopy(request.data.val);
			return "Key was set in the database (mocked for tests).";

		case "getAPIKey":
			return getAPIKey(false, request.data.useAPIKeyAtIndex);

		case "getDefaultAPIKeys":
			return getAPIKey(true, null);

		case 'getAllYouTubeTabs':
			// Return a list of tabs with a YouTube URL
			return Promise.resolve([
				{
					id: 1,
					url: 'https://www.youtube.com/watch?v=00000000001'
				},
				{
					id: 2,
					url: 'https://www.youtube.com/watch?v=00000000002'
				}
			]);

		case 'getCurrentTabId':
			return Promise.resolve(1);

		case 'openVideoInTabWithId':
			return Promise.resolve(true);

		default:
			console.log(`Please implement this command: ${request.command}`);
			throw new Error(`Please implement this command: ${request.command}`);
	}
});

// ---------- Database mock object ----------
let mockedDatabase = {};

function clearMockedDatabase() {
	for (const key in mockedDatabase) {
		delete mockedDatabase[key];
	}
}

// ---------- Test setup and teardown ----------
// Setup before the import of configSync in the first test
// To pass the first test, this needs to be done outside any before hooks
// The first test will check that this key was removed during validation
chrome.storage.sync.set({ "thisKeyShouldBeRemoved": "thisValueShouldBeRemoved" });

beforeEach(() => {
	chrome.storage.sync.set(deepCopy(configSyncDefaults));
	chrome.storage.local.set(deepCopy(localPlaylistPermutations));

	mockedDatabase = deepCopy(databasePermutations);
	mockedDatabase["youtubeAPIKeys"] = [
		"testAPIKey0",
		"testAPIKey1",
		"testAPIKey2",
	];
});

afterEach(async function () {
	await chrome.storage.sync.clear();
	await chrome.storage.local.clear();

	clearMockedDatabase();
});

// ----- Helpers -----
// Re-implementation of the function in the background script
async function getAPIKey(forceGetAllDefaultKeys, useAPIKeyAtIndex = null) {
	// List of API keys that are stored in the database/locally
	let availableAPIKeys;

	// If the user has opted to use a custom API key, use that instead of the default one
	if (!forceGetAllDefaultKeys && mockedConfigSync.useCustomApiKeyOption && mockedConfigSync.customYoutubeApiKey) {
		return {
			APIKey: mockedConfigSync.customYoutubeApiKey,
			isCustomKey: true,
			keyIndex: null
		};
	} else {
		availableAPIKeys = mockedDatabase["youtubeAPIKeys"];
	}

	if (forceGetAllDefaultKeys) {
		// Return a list of all API keys
		return { APIKey: availableAPIKeys, isCustomKey: false, keyIndex: null };
	}

	let usedIndex;
	let chosenAPIKey;
	if (useAPIKeyAtIndex === null) {
		// Choose a random one of the available API keys to evenly distribute the quotas
		usedIndex = Math.floor(Math.random() * availableAPIKeys.length);
		chosenAPIKey = availableAPIKeys[usedIndex];
	} else {
		// Use the API key at the specified index, using the first one if the index is out of bounds
		// This variable is set when a previously chosen key already exceeded its quota
		usedIndex = availableAPIKeys[useAPIKeyAtIndex] ? useAPIKeyAtIndex : 0;
		chosenAPIKey = availableAPIKeys[usedIndex];
	}

	// Return the API key, whether or not it is a custom one, and the index of the API key that was used
	return {
		APIKey: chosenAPIKey,
		isCustomKey: false,
		keyIndex: usedIndex
	};
}