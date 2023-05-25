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

// TODO: Also add case for deleted videos in the playlist
export const playlistModifiers = [
	[
		'DBRecentlyFetched',
		'DBNotRecentlyFetched'
	],
	[
		'DBUpToDate',
		'DBNotUpToDate'
	],
	[
		'LocallyAccessedRecently',
		'NotLocallyAccessedRecently'
	]
]

const defaultVideos = {
	"00000000001": threeDaysAgo,
	"00000000002": daysAgo(4).toISOString(),
	"00000000003": daysAgo(5).toISOString(),
	"00000000004": daysAgo(6).toISOString(),
	"00000000005": daysAgo(7).toISOString(),
	"00000000006": daysAgo(8).toISOString(),
	"00000000007": daysAgo(9).toISOString(),
	"00000000008": daysAgo(10).toISOString(),
	"00000000009": daysAgo(11).toISOString(),
	"00000000010": daysAgo(12).toISOString(),
	"00000000011": daysAgo(13).toISOString()
}

export let localPlaylistPermutations = {};
let playlistId, lastAccessedLocally, lastFetchedFromDB, lastVideoPublishedAt, videos;
for (let i = 0; i < playlistModifiers[0].length; i++) {
	for (let j = 0; j < playlistModifiers[1].length; j++) {
		for (let k = 0; k < playlistModifiers[2].length; k++) {
			playlistId = (`UU-${playlistModifiers[0][i]}${playlistModifiers[1][j]}${playlistModifiers[2][k]}`);
			lastAccessedLocally = (playlistModifiers[2][k] === "LocallyAccessedRecently") ? zeroDaysAgo : fourteenDaysAgo;
			lastFetchedFromDB = (playlistModifiers[0][i] === "DBRecentlyFetched") ? zeroDaysAgo : fourteenDaysAgo;
			lastVideoPublishedAt = threeDaysAgo;
			videos = defaultVideos;

			localPlaylistPermutations[playlistId] = {
				lastAccessedLocally,
				lastFetchedFromDB,
				lastVideoPublishedAt,
				videos
			}
		}
	}
}

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
		newPermutation.videos["00000000012"] = oneDayAgo;
	}

	databasePermutations.push(newPermutation);
}