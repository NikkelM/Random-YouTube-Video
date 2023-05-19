function mockChromeStorage() {
	let chrome = {
		storage: {
			sync: {
				get: function () {
					return Promise.resolve(mockSyncStorageObject);
				},
				set: function (objToAdd) {
					mockSyncStorageObject = Object.assign(mockSyncStorageObject, objToAdd);
					return Promise.resolve();
				}
			},
			local: {
				get: function () {
					return Promise.resolve(mockLocalStorage);
				},
				set: function (objToAdd) {
					mockLocalStorageObject = Object.assign(mockLocalStorage, objToAdd);
					return Promise.resolve();
				}
			}
		}
	};

	return chrome;
}

async function setupMockSyncStorageObject() {
	await chrome.storage.sync.set({ "storageType": "syncStorage" });
	await chrome.storage.sync.set({ "stringKey": "stringVal" });
	await chrome.storage.sync.set({ "objectKey": { "innerNumberKey": 1 } });
}

async function setupMockLocalStorageObject() {
	await chrome.storage.local.set({ "storageType": "localStorage" });
	await chrome.storage.local.set({ "stringKey": "stringVal" });
	await chrome.storage.local.set({ "objectKey": { "innerNumberKey": 1 } });
}