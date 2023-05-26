import sinonChrome from 'sinon-chrome';

import { configSyncDefaults } from '../src/config.js';
import { localPlaylistPermutations, databasePermutations } from './playlistPermutations.js';

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
			return Promise.resolve(mockedDatabase[request.data]);

		// With our mocked database, both commands have the same effect
		case 'updatePlaylistInfoInDB':
		case 'overwritePlaylistInfoInDB':
			// Update a playlist in the database
			mockedDatabase[request.data.key] = request.data.val;
			return "PlaylistInfo was sent to database."

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
	chrome.storage.sync.set(configSyncDefaults);
	chrome.storage.local.set(localPlaylistPermutations);

	mockedDatabase = Object.assign({}, databasePermutations);
});

afterEach(async function () {
	await chrome.storage.sync.clear();
	await chrome.storage.local.clear();

	clearMockedDatabase();
});