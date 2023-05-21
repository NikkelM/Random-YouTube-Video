// import sinon-chrome
import sinonChrome from 'sinon-chrome';
import { configSyncDefaults } from '../src/config.js';

global.chrome = sinonChrome;

let mockedConfigSync = {};

chrome.storage.sync.get.callsFake(() => {
	return Promise.resolve(mockedConfigSync)
});
chrome.storage.sync.set.callsFake((obj) => {
	Object.assign(mockedConfigSync, obj);
	return Promise.resolve()
});
chrome.storage.sync.clear.callsFake(() => {
	for (const key in mockedConfigSync) {
		delete mockedConfigSync[key];
	}
	return Promise.resolve()
});

beforeEach(() => {
	chrome.storage.sync.set(configSyncDefaults);
});

afterEach(async function () {
	await chrome.storage.sync.clear();
});