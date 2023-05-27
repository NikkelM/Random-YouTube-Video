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
}

// Determine whether or not a permutation needs to interact with the YouTube API

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
		'PlaylistDoesNotExistLocally',
		'LocalPlaylistRecentlyAccessed',
		'LocalPlaylistNotRecentlyAccessed'
	],
	// containsDeletedVideos: If the local playlist should contain deleted videos
	[
		'LocalPlaylistContainsDeletedVideos',
		'LocalPlaylistContainsNoDeletedVideos'
	],
	// newUploadedVideos: Only if DBEntryIsNotUpToDate: If a new video has since been uploaded
	[
		'OneNewVideoUploaded',
		'MultipleNewVideosUploaded',
		'NoNewVideoUploaded'
	],
	// dbContainsNewVideos: Only if !DBEntryDoesNotExist: If the database contains videos that are not in the local playlist
	[
		'DBContainsVideosNotInLocalPlaylist',
		'DBContainsNoVideosNotInLocalPlaylist'
	]
];

export const defaultLocalVideos = {
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

const oneNewYTAPIVideo = {
	"YT000000001": zeroDaysAgo.substring(0, 10)
};

const multipleNewYTAPIVideos = {
	"YT000000001": zeroDaysAgo.substring(0, 10),
	"YT00000002": zeroDaysAgo.substring(0, 10),
	"YT00000003": zeroDaysAgo.substring(0, 10),
	"YT00000004": zeroDaysAgo.substring(0, 10),
	"YT00000005": zeroDaysAgo.substring(0, 10),
	"YT00000006": zeroDaysAgo.substring(0, 10),
	"YT00000007": zeroDaysAgo.substring(0, 10),
	"YT00000008": zeroDaysAgo.substring(0, 10),
	"YT00000009": zeroDaysAgo.substring(0, 10),
	"YT00000010": zeroDaysAgo.substring(0, 10),
	"YT00000011": zeroDaysAgo.substring(0, 10)
};

export let playlistPermutations = [];
let playlistId, channelId, lastAccessedLocally, lastUpdatedDBAt, lastFetchedFromDB, localLastVideoPublishedAt, dbLastVideoPublishedAt, newUploadedVideos, newLastVideoPublishedAt, localVideos, dbVideos;

for (let i = 0; i < playlistModifiers[0].length; i++) {
	for (let j = 0; j < playlistModifiers[1].length; j++) {
		for (let k = 0; k < playlistModifiers[2].length; k++) {
			for (let l = 0; l < playlistModifiers[3].length; l++) {
				for (let m = 0; m < playlistModifiers[4].length; m++) {
					for (let n = 0; n < playlistModifiers[5].length; n++) {
						// Do not create an entry if !DBEntryIsNotUpToDate && !NoNewVideoUploaded, as these would give us no new data
						if (playlistModifiers[1][j] !== "DBEntryIsNotUpToDate" && playlistModifiers[4][m] !== "NoNewVideoUploaded") {
							continue;
						}

						// The playlist ID always exists
						playlistId = (`UU_${playlistModifiers[0][i]}_${playlistModifiers[1][j]}_${playlistModifiers[2][k]}_${playlistModifiers[3][l]}_${playlistModifiers[4][m]}_${playlistModifiers[5][n]}`);
						channelId = playlistId.replace("UU", "UC");

						// When was the playlist last accessed locally
						if (playlistModifiers[2][k] === "PlaylistDoesNotExistLocally") {
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
						} else if (playlistModifiers[2][k] === "PlaylistDoesNotExistLocally") {
							lastFetchedFromDB = null;
						} else {
							throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[0][i]}`);
						}

						// When was the last locally known video published
						localLastVideoPublishedAt = threeDaysAgo;

						if (playlistModifiers[3][l] === "LocalPlaylistContainsDeletedVideos") {
							localVideos = deepCopy(defaultLocalVideos);
							localVideos["DEL_LOCAL01"] = fourteenDaysAgo.substring(0, 10);
						} else if (playlistModifiers[3][l] === "LocalPlaylistContainsNoDeletedVideos") {
							localVideos = deepCopy(defaultLocalVideos);
						} else if (playlistModifiers[2][k] === "PlaylistDoesNotExistLocally") {
							localVideos = null;
						} else {
							throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[3][l]}`);
						}

						// Does the db contain videos unknown to the local playlist
						// This only gets values if !DBEntryDoesNotExist
						if (playlistModifiers[1][j] !== "DBEntryDoesNotExist") {
							if (playlistModifiers[5][n] === "DBContainsVideosNotInLocalPlaylist") {
								dbVideos = deepCopy(defaultLocalVideos);
								dbVideos["DB000000001"] = twoDaysAgo.substring(0, 10);
								dbLastVideoPublishedAt = twoDaysAgo;
							} else if (playlistModifiers[5][n] === "DBContainsNoVideosNotInLocalPlaylist") {
								dbVideos = deepCopy(defaultLocalVideos);
								dbLastVideoPublishedAt = localLastVideoPublishedAt;
							} else {
								throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[5][n]}`);
							}
						} else {
							dbVideos = null;
							dbLastVideoPublishedAt = null;
						}

						// Was a new video uploaded since the last time we fetched data from the YouTube API
						// newLastVideoPublishedAt is the new date that should be in the database and locally after the update
						// This only gets video values if DBEntryIsNotUpToDate is true
						if (playlistModifiers[1][j] === "DBEntryIsNotUpToDate") {
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

						playlistPermutations.push({
							// Also add the modifier strings to the object
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
							localLastVideoPublishedAt,
							// DB
							dbVideos,
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

export const localPlaylistPermutations = playlistPermutations.reduce((acc, playlist) => {
	if (playlist.playlistModifiers.lastAccessedLocally !== "PlaylistDoesNotExistLocally") {
		const playlistCopy = deepCopy(playlist);
		const { playlistId, lastAccessedLocally, lastFetchedFromDB, localLastVideoPublishedAt, localVideos } = playlistCopy;
		acc[playlistId] = { lastAccessedLocally, lastFetchedFromDB, lastVideoPublishedAt: localLastVideoPublishedAt, videos: localVideos };
	}
	return acc;
}, {});

// ----- Database -----
export const databasePermutations = playlistPermutations.reduce((acc, playlist) => {
	if (playlist.playlistModifiers.lastUpdatedDBAt !== "DBEntryDoesNotExist") {
		const playlistCopy = deepCopy(playlist);
		const { playlistId, lastUpdatedDBAt, dbLastVideoPublishedAt, dbVideos } = playlistCopy;
		acc[playlistId] = { lastUpdatedDBAt, lastVideoPublishedAt: dbLastVideoPublishedAt, videos: dbVideos };
	}
	return acc;
}, {});
