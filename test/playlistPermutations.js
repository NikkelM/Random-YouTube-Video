// Utility to get a date object from x days ago
function daysAgo(x) {
	return new Date(Date.now() - x * 24 * 60 * 60 * 1000);
}

const zeroDaysAgo = daysAgo(0).toISOString();
const oneDayAgo = daysAgo(1).toISOString();
const twoDaysAgo = daysAgo(2).toISOString();
const threeDaysAgo = daysAgo(3).toISOString();
const fourteenDaysAgo = daysAgo(14).toISOString();

export const times = {
	zeroDaysAgo,
	oneDayAgo,
	threeDaysAgo,
	fourteenDaysAgo
}

// ----- Local storage -----
export const playlistModifiers = [
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
	// dbVideos: Only if !DBEntryDoesNotExist: If the database contains videos that are not in the local playlist
	[
		'DBContainsVideosNotInLocalPlaylist',
		'DBContainsNoVideosNotInLocalPlaylist'
	]
]

const defaultVideos = {
	"LOCAL000001": threeDaysAgo,
	"LOCAL000002": daysAgo(4).toISOString(),
	"LOCAL000003": daysAgo(5).toISOString(),
	"LOCAL000004": daysAgo(6).toISOString(),
	"LOCAL000005": daysAgo(7).toISOString(),
	"LOCAL000006": daysAgo(8).toISOString(),
	"LOCAL000007": daysAgo(9).toISOString(),
	"LOCAL000008": daysAgo(10).toISOString(),
	"LOCAL000009": daysAgo(11).toISOString(),
	"LOCAL000010": daysAgo(12).toISOString(),
	"LOCAL000011": daysAgo(13).toISOString()
}

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
						// TODO: Local vs db
						localLastVideoPublishedAt = threeDaysAgo;

						if (playlistModifiers[3][l] === "LocalPlaylistContainsDeletedVideos") {
							localVideos = { ...defaultVideos, "local00DEL1": fourteenDaysAgo };
						} else if (playlistModifiers[3][l] === "LocalPlaylistContainsNoDeletedVideos") {
							localVideos = { ...defaultVideos };
						} else if (playlistModifiers[2][k] === "PlaylistDoesNotExistLocally") {
							localVideos = null;
						} else {
							throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[3][l]}`);
						}

						// Does the db contain videos unknown to the local playlist
						// This only gets values if !DBEntryDoesNotExist
						if (playlistModifiers[1][j] !== "DBEntryDoesNotExist") {
							if (playlistModifiers[5][n] === "DBContainsVideosNotInLocalPlaylist") {
								dbVideos = { ...defaultVideos, "DB000000001": twoDaysAgo };
								dbLastVideoPublishedAt = twoDaysAgo;
							} else if (playlistModifiers[5][n] === "DBContainsNoVideosNotInLocalPlaylist") {
								dbVideos = { ...defaultVideos };
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
								newUploadedVideos = { "YT000000001": zeroDaysAgo };
								newLastVideoPublishedAt = zeroDaysAgo;
							} else if (playlistModifiers[4][m] === "MultipleNewVideosUploaded") {
								newUploadedVideos = { "YT000000001": zeroDaysAgo, "YT00000002": zeroDaysAgo, "YT00000003": zeroDaysAgo };
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
								newUploadedVideos: playlistModifiers[4][m]
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
		const { playlistId, lastAccessedLocally, lastFetchedFromDB, localLastVideoPublishedAt, localVideos } = playlist;
		acc[playlistId] = { lastAccessedLocally, lastFetchedFromDB, lastVideoPublishedAt: localLastVideoPublishedAt, videos: localVideos };
	}
	return acc;
}, {});

export const databasePermutations = playlistPermutations.reduce((acc, playlist) => {
	if (playlist.playlistModifiers.lastUpdatedDBAt !== "DBEntryDoesNotExist") {
		const { playlistId, lastUpdatedDBAt, dbLastVideoPublishedAt, dbVideos } = playlist;
		acc[playlistId] = { lastUpdatedDBAt, lastVideoPublishedAt: dbLastVideoPublishedAt, videos: dbVideos };
	}
	return acc;
}, {});

// console.log(playlistPermutations)
// console.log('-------------------------------------------')
// console.log(playlistPermutations.length)
// console.log('-------------------------------------------')
// console.log('-------------------------------------------')
// console.log(localPlaylistPermutations)
// console.log(Object.keys(localPlaylistPermutations).length)
// console.log('-------------------------------------------')
// console.log('-------------------------------------------')
// console.log(databaseEntries)
// console.log(Object.keys(databaseEntries).length)