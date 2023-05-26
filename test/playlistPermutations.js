// Utility to get a date object from x days ago
function daysAgo(x) {
	return new Date(Date.now() - x * 24 * 60 * 60 * 1000);
}

const zeroDaysAgo = daysAgo(0).toISOString();
const oneDayAgo = daysAgo(1).toISOString();
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
	]
]

const defaultVideos = {
	"local000001": threeDaysAgo,
	"local000002": daysAgo(4).toISOString(),
	"local000003": daysAgo(5).toISOString(),
	"local000004": daysAgo(6).toISOString(),
	"local000005": daysAgo(7).toISOString(),
	"local000006": daysAgo(8).toISOString(),
	"local000007": daysAgo(9).toISOString(),
	"local000008": daysAgo(10).toISOString(),
	"local000009": daysAgo(11).toISOString(),
	"local000010": daysAgo(12).toISOString(),
	"local000011": daysAgo(13).toISOString()
}

export let playlistPermutations = [];
let playlistId, channelId, lastAccessedLocally, lastUpdatedDBAt, lastFetchedFromDB, lastVideoPublishedAt, newUploadedVideos, newLastVideoPublishedAt, localVideos;

for (let i = 0; i < playlistModifiers[0].length; i++) {
	for (let j = 0; j < playlistModifiers[1].length; j++) {
		for (let k = 0; k < playlistModifiers[2].length; k++) {
			for (let l = 0; l < playlistModifiers[3].length; l++) {
				for (let m = 0; m < playlistModifiers[4].length; m++) {
					// The playlist ID always exists
					playlistId = (`UU_${playlistModifiers[0][i]}_${playlistModifiers[1][j]}_${playlistModifiers[2][k]}_${playlistModifiers[3][l]}_${playlistModifiers[4][m]}`);
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
					lastVideoPublishedAt = threeDaysAgo;

					if (playlistModifiers[3][l] === "LocalPlaylistContainsDeletedVideos") {
						localVideos = { ...defaultVideos, "local0000-1": fourteenDaysAgo };
					} else if (playlistModifiers[3][l] === "LocalPlaylistContainsNoDeletedVideos") {
						localVideos = { ...defaultVideos };
					} else if (playlistModifiers[2][k] === "PlaylistDoesNotExistLocally") {
						localVideos = null;
					} else {
						throw new Error(`Invalid playlist modifier combination: ${playlistModifiers[3][l]}`);
					}

					// Was a new video uploaded since the last time we fetched data from the YouTube API
					// This only gets video values if DBEntryIsNotUpToDate is true
					if (playlistModifiers[1][j] === "DBEntryIsNotUpToDate") {
						if (playlistModifiers[4][m] === "OneNewVideoUploaded") {
							newUploadedVideos = { "local000012": zeroDaysAgo };
							newLastVideoPublishedAt = zeroDaysAgo;
						} else if (playlistModifiers[4][m] === "MultipleNewVideosUploaded") {
							newUploadedVideos = { "local000012": zeroDaysAgo, "local000013": zeroDaysAgo };
							newLastVideoPublishedAt = zeroDaysAgo;
						} else if (playlistModifiers[4][m] === "NoNewVideoUploaded") {
							newUploadedVideos = {};
							newLastVideoPublishedAt = lastVideoPublishedAt;
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
						// DB & Local
						lastVideoPublishedAt,
						// DB
						lastUpdatedDBAt,
						// "YT API" (actually DB)
						newUploadedVideos
					});
				}
			}
		}
	}
}

export const localPlaylistPermutations = playlistPermutations;

console.log(playlistPermutations)
console.log('-------------------------------------------')
// log length
console.log(playlistPermutations.length)
console.log('-------------------------------------------')
console.log('-------------------------------------------')
// console.log(localPlaylistPermutations)

// ----- Database -----
const databasePermutationPresets = [
	// DBUpToDate, No new videos
	{
		lastUpdatedDBAt: zeroDaysAgo,
		lastVideoPublishedAt: threeDaysAgo
	},
	// DBUpToDate, New videos
	{
		lastUpdatedDBAt: zeroDaysAgo,
		lastVideoPublishedAt: oneDayAgo
	},
	// DBNotUpToDate, No new videos
	{
		lastUpdatedDBAt: fourteenDaysAgo,
		lastVideoPublishedAt: threeDaysAgo
	},
	// DBNotUpToDate, New videos
	{
		lastUpdatedDBAt: fourteenDaysAgo,
		lastVideoPublishedAt: oneDayAgo
	},
	// DBDoesNotExist
	{
		lastUpdatedDBAt: null,
		lastVideoPublishedAt: null
	}
];

// TODO: These permutations need the correct playlist IDs as keys
export let databasePermutations = [];

for (const permutation of databasePermutationPresets) {
	let newPermutation = {
		lastUpdatedDBAt: permutation.lastUpdatedDBAt,
		lastVideoPublishedAt: permutation.lastVideoPublishedAt,
		videos: { ...defaultVideos }
	};

	if (permutation.lastVideoPublishedAt === oneDayAgo) {
		newPermutation.videos["db000000001"] = oneDayAgo;
	}

	databasePermutations.push(newPermutation);
}