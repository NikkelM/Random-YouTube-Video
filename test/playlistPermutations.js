import { configSyncDefaults } from "../src/config.js";

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
export function needsYTAPIInteraction(permutation) {
	const databaseSharing = permutation.configSync.databaseSharingEnabledOption;
	if (databaseSharing) {
		return (needsDBInteraction(permutation) &&
			(permutation.playlistModifiers.lastUpdatedDBAt === 'DBEntryIsNotUpToDate' || permutation.playlistModifiers.lastUpdatedDBAt === 'DBEntryDoesNotExist')
		);
	} else {
		return (permutation.playlistModifiers.lastAccessedLocally === 'LocalPlaylistDoesNotExist' || permutation.playlistModifiers.lastAccessedLocally === 'LocalPlaylistNotRecentlyAccessed');
	}
}

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

// ----- Local storage -----
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
	],
	// configSync: What configSync does this permutation use
	[
		'DefaultConfigSync',
	]
];

const defaultLocalVideos = {
	"LOCAL000001": threeDaysAgo.substring(0, 10),
	"LOCAL000002": daysAgo(4).substring(0, 10),
	"LOCAL000003": daysAgo(5).substring(0, 10),
	"LOCAL000004": daysAgo(6).substring(0, 10),
	"LOCAL000005": daysAgo(7).substring(0, 10),
	"LOCAL000006": daysAgo(8).substring(0, 10),
	"LOCAL000007": daysAgo(9).substring(0, 10),
	"LOCAL000008": daysAgo(10).substring(0, 10),
	"LOCAL000009": daysAgo(11).substring(0, 10),
	"LOCAL000010": daysAgo(12).substring(0, 10),
	"LOCAL000011": daysAgo(13).substring(0, 10)
};

const defaultLocalDeletedVideos = {
	"DEL_LOCAL01": fourteenDaysAgo.substring(0, 10),
	"DEL_LOCAL02": fourteenDaysAgo.substring(0, 10),
	"DEL_LOCAL03": fourteenDaysAgo.substring(0, 10),
	"DEL_LOCAL04": fourteenDaysAgo.substring(0, 10),
	"DEL_LOCAL05": fourteenDaysAgo.substring(0, 10)
};

const defaultDBVideos = {
	"DB00000001": twoDaysAgo.substring(0, 10),
	"DB00000002": twoDaysAgo.substring(0, 10)
};

const defaultDBDeletedVideos = {
	"DEL_DB01": fourteenDaysAgo.substring(0, 10),
	"DEL_DB02": fourteenDaysAgo.substring(0, 10),
	"DEL_DB03": fourteenDaysAgo.substring(0, 10)
};

const oneNewYTAPIVideo = {
	"YT000000001": zeroDaysAgo.substring(0, 10)
};

// Get over the 50 per page API limit, and get to more than one additional page for the inner while loop
const multipleNewYTAPIVideos = {};
for (let i = 1; i <= 105; i++) {
	const key = `YT${String(i).padStart(8, '0')}`;
	multipleNewYTAPIVideos[key] = zeroDaysAgo.substring(0, 10);
}

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
	dbDeletedVideos,
	configSync;

for (let i = 0; i < playlistModifiers[0].length; i++) {
	for (let j = 0; j < playlistModifiers[1].length; j++) {
		for (let k = 0; k < playlistModifiers[2].length; k++) {
			for (let l = 0; l < playlistModifiers[3].length; l++) {
				for (let m = 0; m < playlistModifiers[4].length; m++) {
					for (let n = 0; n < playlistModifiers[5].length; n++) {
						for (let o = 0; o < playlistModifiers[6].length; o++) {
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
							// This only gets values if !DBEntryDoesNotExist
							if (playlistModifiers[1][j] !== "DBEntryDoesNotExist") {
								if (playlistModifiers[5][n] === "DBContainsVideosNotInLocalPlaylist") {
									dbVideos = deepCopy({ ...defaultLocalVideos, ...defaultDBVideos });
									dbDeletedVideos = null;
									dbLastVideoPublishedAt = twoDaysAgo;
								} else if (playlistModifiers[5][n] === "DBContainsNoVideosNotInLocalPlaylist") {
									dbVideos = deepCopy(defaultLocalVideos);
									dbDeletedVideos = null;
									dbLastVideoPublishedAt = localLastVideoPublishedAt;
								} else if (playlistModifiers[5][n] === "DBContainsDeletedVideos") {
									dbVideos = deepCopy({ ...defaultLocalVideos, ...defaultDBVideos });
									dbDeletedVideos = deepCopy(defaultDBDeletedVideos);
									dbLastVideoPublishedAt = twoDaysAgo;
								} else {
									throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[5][n]}`);
								}
							} else {
								dbVideos = null;
								dbLastVideoPublishedAt = null;
							}

							// Was a new video uploaded since the last time we fetched data from the YouTube API
							// newLastVideoPublishedAt is the new date that should be in the database and locally after the update
							if (playlistModifiers[1][j] !== "DBEntryIsUpToDate") {
								if (playlistModifiers[4][m] === "OneNewVideoUploaded") {
									newLastVideoPublishedAt = deepCopy(oneNewYTAPIVideo);
								} else if (playlistModifiers[4][m] === "MultipleNewVideosUploaded") {
									newUploadedVideos = deepCopy(multipleNewYTAPIVideos);
									newLastVideoPublishedAt = zeroDaysAgo;
								} else if (playlistModifiers[4][m] === "NoNewVideoUploaded") {
									newUploadedVideos = {};
									newLastVideoPublishedAt = dbLastVideoPublishedAt;
								} else {
									throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[4][m]}`);
								}
							} else {
								newUploadedVideos = null;
								newLastVideoPublishedAt = null;
							}

							if (playlistModifiers[6][o] === "DefaultConfigSync") {
								configSync = deepCopy(configSyncDefaults);
							} else {
								throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[6][o]}`);
							}

							playlistPermutations.push({
								// Also add the modifiers to the object
								playlistModifiers: {
									lastFetchedFromDB: playlistModifiers[0][i],
									lastUpdatedDBAt: playlistModifiers[1][j],
									lastAccessedLocally: playlistModifiers[2][k],
									containsDeletedVideos: playlistModifiers[3][l],
									newUploadedVideos: playlistModifiers[4][m],
									dbContainsNewVideos: playlistModifiers[5][n],
									configSync: playlistModifiers[6][o],
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
								newLastVideoPublishedAt,
								// Config
								configSync
							});
						}
					}
				}
			}
		}
	}
}

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
