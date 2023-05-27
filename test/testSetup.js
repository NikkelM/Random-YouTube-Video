import sinonChrome from 'sinon-chrome';

import { configSyncDefaults } from '../src/config.js';
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
	Object.assign(mockedLocalStorage, obj);
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
		case 'getPlaylistFromDB':
			// Return a playlist from the database
			return Promise.resolve(mockedDatabase[request.data] ?? null);

		// With our mocked database, both commands have the same effect
		case 'updatePlaylistInfoInDB':
			request.data.val.videos = { ...mockedDatabase[request.data.key]?.videos ?? {}, ...request.data.val.videos };
		case 'overwritePlaylistInfoInDB':
			// Update/Overwrite a playlist in the database
			mockedDatabase[request.data.key] = request.data.val;
			return "PlaylistInfo was sent to database.";

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

		default:
			console.log(`Please implement this command: ${request.command}`);
			break;
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
beforeEach(() => {
	chrome.storage.sync.set(deepCopy(configSyncDefaults));
	chrome.storage.local.set(deepCopy(localPlaylistPermutations));

	mockedDatabase = deepCopy(databasePermutations);
});

afterEach(async function () {
	await chrome.storage.sync.clear();
	await chrome.storage.local.clear();

	clearMockedDatabase();
});

// ----- Helpers -----
// Reimplementation of the function in the background script
async function getAPIKey(forceDefault, useAPIKeyAtIndex = null) {
	const defaultAPIKeys = [
		"testAPIKey0",
		"testAPIKey1",
		"testAPIKey2",
	];

	// List of API keys that are stored in the database/locally
	let availableAPIKeys = null;

	// If the user has opted to use a custom API key, use that instead of the default one
	if (!forceDefault && mockedConfigSync.useCustomApiKeyOption && mockedConfigSync.customYoutubeApiKey) {
		return {
			APIKey: mockedConfigSync.customYoutubeApiKey,
			isCustomKey: true,
			keyIndex: null
		};
	} else {
		availableAPIKeys = defaultAPIKeys;
	}

	if (forceDefault) {
		// Return a list of all API keys
		return { APIKey: availableAPIKeys, isCustomKey: false, keyIndex: null };
	}

	let usedIndex = null;
	let chosenAPIKey = null;
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