function mockChrome() {
	let chrome = {
		storage: {
			sync: {
				get: function () {
					return Promise.resolve(configSync);
				},
				set: function (objToAdd) {
					configSync = Object.assign(configSync, objToAdd);
					return Promise.resolve();
				},
				clear: function () {
					configSync = {};
					return Promise.resolve();
				}
			},
			local: {
				get: function () {
					return Promise.resolve(mockLocalStorageObject);
				},
				set: function (objToAdd) {
					mockLocalStorageObject = Object.assign(mockLocalStorageObject, objToAdd);
					return Promise.resolve();
				},
				clear: function () {
					mockLocalStorageObject = {};
					return Promise.resolve();
				}
			}
		},
		runtime: {
			// TODO: Whenever one of these is called, implement the correct behaviour here
			sendMessage: function (request) {
				switch (request.command) {
					// Tries to get the playlist from Firebase
					case "getPlaylistFromDB":
						// readDataOnce('uploadsPlaylists/' + request.data).then(sendResponse);
						break;
					// Updates (without overwriting videos) the playlist in Firebase 
					case "updatePlaylistInfoInDB":
						// updatePlaylistInfoInDB(request.data.key, request.data.val, false).then(sendResponse);
						break;
					// Updates (with overwriting videos, as some were deleted and we do not grant 'delete' permissions) the playlist in Firebase
					case "overwritePlaylistInfoInDB":
						// updatePlaylistInfoInDB(request.data.key, request.data.val, true).then(sendResponse);
					// Gets an API key depending on user settings
					case "getAPIKey":
						// getAPIKey(false, request.data.useAPIKeyAtIndex).then(sendResponse);
						break;
					// Gets the default API keys saved in the database
					case "getDefaultAPIKeys":
						// getAPIKey(true, null).then(sendResponse);
						break;
					// A new configSync should be set
					case "newConfigSync":
						configSync = request.data;
						return "New configSync set.";
					case "getCurrentTabId":
						// getCurrentTabId().then(sendResponse);
						break;
					case "getAllYouTubeTabs":
						// getAllYouTubeTabs().then(sendResponse);
						break;
					case "openVideoInTabWithId":
						// openVideoInTabWithId(request.data.tabId, request.data.videoUrl).then(sendResponse);
						break
					default:
						return `Unknown command: ${request.command} (service worker). Hopefully another message listener will handle it.`;
				}
			},
		}
	};

	return chrome;
}

// From background.js
const configSyncDefaults = {
	// If the user has enabled the custom API key option
	"useCustomApiKeyOption": false,
	// The custom API key the user has provided. This key is already validated.
	"customYoutubeApiKey": null,
	// If the user has enabled sharing video ID's with the database
	"databaseSharingEnabledOption": true,
	// These properties influence the behavior of the "Shuffle" button
	"shuffleOpenInNewTabOption": true,
	"shuffleReUseNewTabOption": true,
	"shuffleIgnoreShortsOption": false,
	"shuffleOpenAsPlaylistOption": true,
	// How many random videos to add to a playlist
	"shuffleNumVideosInPlaylist": 10,
	// If shuffled videos are opened in a new tab, save the tab ID of that tab here to reuse the tab when the user shuffles again
	"shuffleTabId": null,
	// channelSettings is a dictionary of channelID -> Dictionary of channel settings
	"channelSettings": {},
	// These two properties are used by the popup to determine which channel's settings to show
	"currentChannelId": null,
	"currentChannelName": null,
	// The number of videos the user has shuffled so far
	"numShuffledVideosTotal": 0,
	// These two properties determine the amount of quota remaining today, and the time at which the quota will next reset (daily resets at midnight)
	"userQuotaRemainingToday": 200,
	// The default reset time is midnight of the next day
	"userQuotaResetTime": new Date(new Date().setHours(24, 0, 0, 0)).getTime(),
	// We want to regularly check if there are new API keys available (weekly)
	"nextAPIKeysCheckTime": new Date(new Date().setHours(168, 0, 0, 0)).getTime(),
	// The last version for which the user has viewed the changelog
	"lastViewedChangelogVersion": "0",
	// For april fools: Will be the number of the year in which the user was last rickrolled (we only want to rickroll the user once per year)
	"wasLastRickRolledInYear": "1970",
};

async function setupMockSyncStorageObject() {
	await chrome.storage.sync.clear();

	configSync = configSyncDefaults;
}

const defaultLocalStorage = {
	// These are the actual API keys to enable us to test if the API can be reached using them
	"youtubeAPIKeys": [
		"NVmn5lPXwulXIJJwSGTTMoG1kZZG6bjrXwce6lp",
		"NVmn5lQZ_hhncP4wb-5skm-wDxGJ56ll9GmDOnb",
		"NVmn5lQkbt45vV6vR4hnuV3T6mekoUcFOpVjQnR"
	],
	// A locally outdated playlist. The database entry should return that it is up-to-date
	"locallyOutdatedPlaylist": {
		// These dates should always be relative to the current date
		"lastAccessedLocally": new Date(new Date().setHours(-96, 0, 0, 0)).toISOString(),
		"lastFetchedFromDB": new Date(new Date().setHours(-96, 0, 0, 0)).toISOString(),
		"lastVideoPublishedAt": "2023-05-18T07:00:08Z",
		"videos": {
			"-W6sqcFynow": "2023-05-18",
			"22qybYNeY18": "2023-04-17",
		}
	},
	// A locally up-to-date playlist
	"locallyUpToDatePlaylist": {
		// These dates should always be relative to the current date
		"lastAccessedLocally": new Date(new Date().setHours(-10, 0, 0, 0)).toISOString(),
		"lastFetchedFromDB": new Date(new Date().setHours(-12, 0, 0, 0)).toISOString(),
		"lastVideoPublishedAt": "2023-05-18T07:00:08Z",
		"videos": {
			"-W6sqcFynow": "2023-05-18",
			"22qybYNeY18": "2023-04-17",
		}
	},
	// A playlist outdated in the database
	// TODO: Mock the database values
	"locallyUpToDatePlaylist": {
		// These dates should always be relative to the current date
		"lastAccessedLocally": new Date(new Date().setHours(-96, 0, 0, 0)).toISOString(),
		"lastFetchedFromDB": new Date(new Date().setHours(-96, 0, 0, 0)).toISOString(),
		"lastVideoPublishedAt": "2023-05-18T07:00:08Z",
		"videos": {
			"-W6sqcFynow": "2023-05-18",
			"22qybYNeY18": "2023-04-17",
		}
	}
}

async function setupMockLocalStorageObject() {
	await chrome.storage.local.clear();

	mockLocalStorageObject = defaultLocalStorage;
}