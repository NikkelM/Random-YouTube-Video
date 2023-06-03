import { configSyncDefaults } from "../src/config.js";

// ---------- Constants used by the permutations ----------
// Keep these in sync with the values compared against in the tests
const zeroDaysAgo = daysAgo(0);
const oneDayAgo = daysAgo(1);
const twoDaysAgo = daysAgo(2);
const threeDaysAgo = daysAgo(3);
const fourteenDaysAgo = daysAgo(14);

export const times = {
	zeroDaysAgo,
	oneDayAgo,
	threeDaysAgo,
	fourteenDaysAgo
}

// The configSync should always be the default, with these settings being changed
// This allows us to not have to define something for every setting
const configSyncModifiers = [
	// useCustomApiKeyOption
	[
		true,
		false
	],
	// customYoutubeApiKey
	[
		"validCustomAPIKey",
		null
	],
	// databaseSharingEnabledOption
	[
		true,
		false
	],

	// shuffleOpenInNewTabOption
	[
		true,
		false
	],
	// shuffleReUseNewTabOption
	[
		true,
		false
	],
	// shuffleTabId
	[
		1,
		null
	],
	// shuffleIgnoreShortsOption
	[
		true,
		false
	],
	// shuffleOpenAsPlaylistOption
	[
		true,
		false
	],
	// shuffleNumVideosInPlaylist
	[
		10,
		5
	]
	// TODO: Test the April Fools' Day option
	// TODO for testing the popup: channelSettings, currentChannelId/currentChannelName, numShuffledVideosTotal, lastViewedChangelogVersion
];

export let configSyncPermutations = [];
for (const useCustomApiKeyOption of configSyncModifiers[0]) {
	for (const customYoutubeApiKey of configSyncModifiers[1]) {
		for (const databaseSharingEnabledOption of configSyncModifiers[2]) {
			for (const shuffleOpenInNewTabOption of configSyncModifiers[3]) {
				for (const shuffleReUseNewTabOption of configSyncModifiers[4]) {
					for (const shuffleTabId of configSyncModifiers[5]) {
						for (const shuffleIgnoreShortsOption of configSyncModifiers[6]) {
							for (const shuffleOpenAsPlaylistOption of configSyncModifiers[7]) {
								for (const shuffleNumVideosInPlaylist of configSyncModifiers[8]) {
									// Exclude invalid combinations
									if (!useCustomApiKeyOption && (customYoutubeApiKey !== null || databaseSharingEnabledOption)) continue;
									if (!shuffleOpenInNewTabOption && shuffleReUseNewTabOption) continue;
									if (!shuffleReUseNewTabOption && shuffleTabId !== null) continue;
									if (!shuffleOpenAsPlaylistOption && shuffleNumVideosInPlaylist !== 10) continue;

									let modifiedConfigSync = deepCopy(configSyncDefaults);
									modifiedConfigSync.useCustomApiKeyOption = useCustomApiKeyOption;
									modifiedConfigSync.customYoutubeApiKey = customYoutubeApiKey;
									modifiedConfigSync.databaseSharingEnabledOption = databaseSharingEnabledOption;
									modifiedConfigSync.shuffleOpenInNewTabOption = shuffleOpenInNewTabOption;
									modifiedConfigSync.shuffleReUseNewTabOption = shuffleReUseNewTabOption;
									modifiedConfigSync.shuffleTabId = shuffleTabId;
									modifiedConfigSync.shuffleIgnoreShortsOption = shuffleIgnoreShortsOption;
									modifiedConfigSync.shuffleOpenAsPlaylistOption = shuffleOpenAsPlaylistOption;
									modifiedConfigSync.shuffleNumVideosInPlaylist = shuffleNumVideosInPlaylist;

									configSyncPermutations.push(modifiedConfigSync);
								}
							}
						}
					}
				}
			}
		}
	}
}

const playlistModifiers = [
	// lastFetchedFromDB: If the data was recently fetched from the database
	[
		'LocalPlaylistFetchedDBRecently',
		'LocalPlaylistDidNotFetchDBRecently'
	],
	// lastUpdatedDBAt: If an entry in the database exists, and if yes, if the videos in the database are up-to-date, or new ones have been uploaded
	[
		'DBEntryDoesNotExist',
		'DBEntryIsUpToDate',
		'DBEntryIsNotUpToDate'
	],
	// lastAccessedLocally: If the playlist exists locally, and if yes, when it was last accessed
	[
		'LocalPlaylistDoesNotExist',
		'LocalPlaylistRecentlyAccessed',
		'LocalPlaylistNotRecentlyAccessed'
	],
	// containsDeletedVideos: If the local playlist should contain deleted videos
	[
		'LocalPlaylistContainsDeletedVideos',
		'LocalPlaylistContainsNoDeletedVideos'
	],
	// newUploadedVideos: If a new video has since been uploaded
	[
		'OneNewVideoUploaded',
		'MultipleNewVideosUploaded',
		'NoNewVideoUploaded'
	],
	// dbContainsNewVideos: If the database contains videos that are not in the local playlist
	[
		'DBContainsVideosNotInLocalPlaylist',
		'DBContainsNoVideosNotInLocalPlaylist',
		'DBContainsDeletedVideos'
	]
];

// _S_ means the video is a short, _V_ means it is a normal video
const defaultLocalVideos = {
	"LOC_S_00001": threeDaysAgo.substring(0, 10),
	"LOC_S_00002": daysAgo(4).substring(0, 10),
	"LOC_S_00003": daysAgo(5).substring(0, 10),
	"LOC_S_00004": daysAgo(6).substring(0, 10),
	"LOC_S_00005": daysAgo(7).substring(0, 10),
	"LOC_V_00006": daysAgo(8).substring(0, 10),
	"LOC_V_00007": daysAgo(9).substring(0, 10),
	"LOC_V_00008": daysAgo(10).substring(0, 10),
	"LOC_V_00009": daysAgo(11).substring(0, 10),
	"LOC_V_00010": daysAgo(12).substring(0, 10),
};

const defaultLocalDeletedVideos = {
	"DEL_LOC_S_1": fourteenDaysAgo.substring(0, 10),
	"DEL_LOC_S_2": fourteenDaysAgo.substring(0, 10),
	"DEL_LOC_V_3": fourteenDaysAgo.substring(0, 10),
	"DEL_LOC_V_4": fourteenDaysAgo.substring(0, 10),
	"DEL_LOC_V_5": fourteenDaysAgo.substring(0, 10)
};

const defaultDBVideos = {
	"DB_V_000001": twoDaysAgo.substring(0, 10),
	"DB_S_000002": twoDaysAgo.substring(0, 10)
};

const defaultDBDeletedVideos = {
	"DEL_DB_V_01": fourteenDaysAgo.substring(0, 10),
	"DEL_DB_V_02": fourteenDaysAgo.substring(0, 10),
	"DEL_DB_V_03": fourteenDaysAgo.substring(0, 10)
};

// The YT API returns a full-length timestamp
const oneNewYTAPIVideo = {
	"YT_V_000001": zeroDaysAgo
};

// Get over the 50 per page API limit, and get to more than one additional page for the inner while loop
const multipleNewYTAPIVideos = {};
for (let i = 1; i <= 70; i++) {
	const key = `YT_V_${String(i).padStart(6, '0')}`;
	multipleNewYTAPIVideos[key] = zeroDaysAgo;
}
// Add another 35 shorts, with _S_ in the key
for (let i = 71; i <= 105; i++) {
	const key = `YT_S_${String(i).padStart(6, '0')}`;
	multipleNewYTAPIVideos[key] = zeroDaysAgo;
}

// ---------- Permutations for testing ----------
export let playlistPermutations = [];
let playlistId,
	channelId,
	lastAccessedLocally,
	lastUpdatedDBAt,
	lastFetchedFromDB,
	localLastVideoPublishedAt,
	dbLastVideoPublishedAt,
	newUploadedVideos,
	newLastVideoPublishedAt,
	localVideos,
	localDeletedVideos,
	dbVideos,
	dbDeletedVideos;

for (let i = 0; i < playlistModifiers[0].length; i++) {
	for (let j = 0; j < playlistModifiers[1].length; j++) {
		for (let k = 0; k < playlistModifiers[2].length; k++) {
			for (let l = 0; l < playlistModifiers[3].length; l++) {
				for (let m = 0; m < playlistModifiers[4].length; m++) {
					for (let n = 0; n < playlistModifiers[5].length; n++) {
						// Skip permutations that are not possible
						// If the local playlist recently fetched from the DB, it does not matter when the DB entry was last updated or if it contains any videos not in the local playlist, and we know the local playlist was recently accessed
						if (playlistModifiers[0][i] === "LocalPlaylistFetchedDBRecently" && (playlistModifiers[1][j] !== "DBEntryIsUpToDate" || playlistModifiers[2][k] !== "LocalPlaylistRecentlyAccessed" || playlistModifiers[5][n] !== "DBContainsNoVideosNotInLocalPlaylist")) {
							continue;
						}
						// If the local playlist does not exist, it cannot contain deleted videos, or have been updated from the DB recently
						if ((playlistModifiers[2][k] === "LocalPlaylistDoesNotExist") && (playlistModifiers[3][l] === "LocalPlaylistContainsDeletedVideos" || playlistModifiers[0][i] === "LocalPlaylistFetchedDBRecently")) {
							continue;
						}
						// If the DB entry does not exist, it cannot contain videos not in the local playlist
						if ((playlistModifiers[1][j] === "DBEntryDoesNotExist") && (playlistModifiers[5][n] !== "DBContainsNoVideosNotInLocalPlaylist")) {
							continue;
						}
						// If the DB entry is up-to-date or the local playlist is up-to-date, it does not matter if there are new videos uploaded
						if ((playlistModifiers[1][j] === "DBEntryIsUpToDate" || playlistModifiers[0][i] === "LocalPlaylistFetchedDBRecently") && (playlistModifiers[4][m] !== "NoNewVideoUploaded")) {
							continue;
						}

						// The playlist ID always exists
						playlistId = (`UU_${playlistModifiers[0][i]}_${playlistModifiers[1][j]}_${playlistModifiers[2][k]}_${playlistModifiers[3][l]}_${playlistModifiers[4][m]}_${playlistModifiers[5][n]}`);
						channelId = playlistId.replace("UU", "UC");

						// When was the playlist last accessed locally
						if (playlistModifiers[2][k] === "LocalPlaylistDoesNotExist") {
							lastAccessedLocally = null;
						} else if (playlistModifiers[2][k] === "LocalPlaylistRecentlyAccessed") {
							lastAccessedLocally = zeroDaysAgo;
						} else if (playlistModifiers[2][k] === "LocalPlaylistNotRecentlyAccessed") {
							lastAccessedLocally = fourteenDaysAgo;
						} else {
							throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[2][k]}`);
						}

						// When was the playlist last updated in the database, if it exists
						if (playlistModifiers[1][j] === "DBEntryDoesNotExist") {
							lastUpdatedDBAt = null;
						} else if (playlistModifiers[1][j] === "DBEntryIsUpToDate") {
							lastUpdatedDBAt = zeroDaysAgo;
						} else if (playlistModifiers[1][j] === "DBEntryIsNotUpToDate") {
							lastUpdatedDBAt = fourteenDaysAgo;
						} else {
							throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[1][j]}`);
						}

						// How long ago until we last fetched the playlist from the database
						if (playlistModifiers[0][i] === "LocalPlaylistFetchedDBRecently") {
							lastFetchedFromDB = zeroDaysAgo;
						} else if (playlistModifiers[0][i] === "LocalPlaylistDidNotFetchDBRecently") {
							lastFetchedFromDB = fourteenDaysAgo;
						} else if (playlistModifiers[2][k] === "LocalPlaylistDoesNotExist") {
							lastFetchedFromDB = null;
						} else {
							throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[0][i]}`);
						}

						// When was the last locally known video published
						localLastVideoPublishedAt = threeDaysAgo;

						if (playlistModifiers[3][l] === "LocalPlaylistContainsDeletedVideos") {
							localVideos = deepCopy(defaultLocalVideos);
							localDeletedVideos = deepCopy(defaultLocalDeletedVideos);
						} else if (playlistModifiers[3][l] === "LocalPlaylistContainsNoDeletedVideos") {
							localVideos = deepCopy(defaultLocalVideos);
							localDeletedVideos = null;
						} else if (playlistModifiers[2][k] === "LocalPlaylistDoesNotExist") {
							localVideos = null;
							localDeletedVideos = null;
						} else {
							throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[3][l]}`);
						}

						// Does the db contain videos unknown to the local playlist
						if (playlistModifiers[5][n] === "DBContainsVideosNotInLocalPlaylist") {
							dbVideos = deepCopy({ ...defaultLocalVideos, ...defaultDBVideos });
							dbDeletedVideos = null;
							dbLastVideoPublishedAt = twoDaysAgo;
						} else if (playlistModifiers[5][n] === "DBContainsNoVideosNotInLocalPlaylist") {
							dbVideos = deepCopy(defaultLocalVideos);
							dbDeletedVideos = null;
							dbLastVideoPublishedAt = localLastVideoPublishedAt;
						} else if (playlistModifiers[5][n] === "DBContainsDeletedVideos") {
							dbVideos = deepCopy(defaultLocalVideos);
							dbDeletedVideos = deepCopy(defaultDBDeletedVideos);
							dbLastVideoPublishedAt = localLastVideoPublishedAt;
						} else {
							throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[5][n]}`);
						}

						// Was a new video uploaded since the last time we fetched data from the YouTube API
						// newLastVideoPublishedAt is the new date that should be in the database and locally after the update
						if (playlistModifiers[1][j] !== "DBEntryIsUpToDate") {
							if (playlistModifiers[4][m] === "OneNewVideoUploaded") {
								newUploadedVideos = deepCopy(oneNewYTAPIVideo);
								newLastVideoPublishedAt = zeroDaysAgo;
							} else if (playlistModifiers[4][m] === "MultipleNewVideosUploaded") {
								newUploadedVideos = deepCopy(multipleNewYTAPIVideos);
								newLastVideoPublishedAt = zeroDaysAgo;
							} else if (playlistModifiers[4][m] === "NoNewVideoUploaded") {
								newUploadedVideos = null;
								newLastVideoPublishedAt = dbLastVideoPublishedAt;
							} else {
								throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[4][m]}`);
							}
						} else {
							newUploadedVideos = null;
							newLastVideoPublishedAt = dbLastVideoPublishedAt;
						}

						playlistPermutations.push({
							// Also add the modifiers to the object
							playlistModifiers: {
								lastFetchedFromDB: playlistModifiers[0][i],
								lastUpdatedDBAt: playlistModifiers[1][j],
								lastAccessedLocally: playlistModifiers[2][k],
								containsDeletedVideos: playlistModifiers[3][l],
								newUploadedVideos: playlistModifiers[4][m],
								dbContainsNewVideos: playlistModifiers[5][n]
							},
							playlistId,
							channelId,
							// Local
							lastAccessedLocally,
							lastFetchedFromDB,
							localVideos,
							localDeletedVideos,
							localLastVideoPublishedAt,
							// DB
							dbVideos,
							dbDeletedVideos,
							lastUpdatedDBAt,
							dbLastVideoPublishedAt,
							// "YT API" (actually DB)
							newUploadedVideos,
							newLastVideoPublishedAt
						});
					}
				}
			}
		}
	}
}

// ----- Locally stored playlists -----
export const localPlaylistPermutations = playlistPermutations.reduce((acc, playlist) => {
	if (playlist.playlistModifiers.lastAccessedLocally !== "LocalPlaylistDoesNotExist") {
		const playlistCopy = deepCopy(playlist);
		const { playlistId, lastAccessedLocally, lastFetchedFromDB, localLastVideoPublishedAt, localVideos, localDeletedVideos } = playlistCopy;
		acc[playlistId] = { lastAccessedLocally, lastFetchedFromDB, lastVideoPublishedAt: localLastVideoPublishedAt, videos: deepCopy({ ...localVideos, ...localDeletedVideos }) };
	}
	return acc;
}, {});

// ----- Database -----
export const databasePermutations = playlistPermutations.reduce((acc, playlist) => {
	if (playlist.playlistModifiers.lastUpdatedDBAt !== "DBEntryDoesNotExist") {
		const playlistCopy = deepCopy(playlist);
		const { playlistId, lastUpdatedDBAt, dbLastVideoPublishedAt, dbVideos, dbDeletedVideos } = playlistCopy;
		acc[playlistId] = { lastUpdatedDBAt, lastVideoPublishedAt: dbLastVideoPublishedAt, videos: deepCopy({ ...dbVideos, ...dbDeletedVideos }) };
	}
	return acc;
}, {});

// ----- Utility functions -----
// Utility to get a date object from x days ago
function daysAgo(x) {
	return new Date(Date.now() - x * 24 * 60 * 60 * 1000).toISOString();
}

// Create a deep copy of an object
export function deepCopy(obj) {
	return JSON.parse(JSON.stringify(obj));
}

// Determine whether or not a permutation needs to interact with the database
export function needsDBInteraction(permutation) {
	return (permutation.playlistModifiers.lastFetchedFromDB === 'LocalPlaylistDidNotFetchDBRecently' ||
		permutation.playlistModifiers.lastAccessedLocally === 'LocalPlaylistDoesNotExist');
}

// Determine whether or not a permutation needs to interact with the YouTube API
// We only test the default configSync with the permutations, so we can assume that the database sharing option is enabled
export function needsYTAPIInteraction(permutation) {
	return (needsDBInteraction(permutation) &&
		(permutation.playlistModifiers.lastUpdatedDBAt === 'DBEntryIsNotUpToDate' || permutation.playlistModifiers.lastUpdatedDBAt === 'DBEntryDoesNotExist')
	);
}