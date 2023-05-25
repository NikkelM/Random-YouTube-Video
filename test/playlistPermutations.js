// Utility to get a date object from x days ago
function daysAgo(x) {
	return new Date(Date.now() - x * 24 * 60 * 60 * 1000);
}

const lastPublishThreeDaysAgo = daysAgo(3).toISOString();
const lastPublishOneDayAgo = daysAgo(1).toISOString();

export const localPlaylistPermutations = {
	"UU-DBRecentlyFetchedDBUpToDateLocallyAccessedRecently": {
			lastAccessedLocally: daysAgo(0).toISOString(),
			lastFetchedFromDB: daysAgo(0).toISOString(),
			lastVideoPublishedAt: lastPublishThreeDaysAgo,
			videos: {
					"00000000001": lastPublishThreeDaysAgo,
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
	},

	"UU-DBRecentlyFetchedDBUpToDateNotLocallyAccessedRecently": {
			lastAccessedLocally: daysAgo(14).toISOString(),
			lastFetchedFromDB: daysAgo(0).toISOString(),
			lastVideoPublishedAt: lastPublishThreeDaysAgo,
			videos: {
					"00000000001": lastPublishThreeDaysAgo,
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
	},

	"UU-DBRecentlyFetchedDBNotUpToDateLocallyAccessedRecently": {
			lastAccessedLocally: daysAgo(0).toISOString(),
			lastFetchedFromDB: daysAgo(0).toISOString(),
			lastVideoPublishedAt: lastPublishThreeDaysAgo,
			videos: {
					"00000000001": lastPublishThreeDaysAgo,
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
	},

	"UU-DBRecentlyFetchedDBNotUpToDateNotLocallyAccessedRecently": {
			lastAccessedLocally: daysAgo(14).toISOString(),
			lastFetchedFromDB: daysAgo(0).toISOString(),
			lastVideoPublishedAt: lastPublishThreeDaysAgo,
			videos: {
					"00000000001": lastPublishThreeDaysAgo,
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
	},

	"UU-DBNotRecentlyFetchedDBUpToDateLocallyAccessedRecently": {
			lastAccessedLocally: daysAgo(0).toISOString(),
			lastFetchedFromDB: daysAgo(14).toISOString(),
			lastVideoPublishedAt: lastPublishThreeDaysAgo,
			videos: {
					"00000000001": lastPublishThreeDaysAgo,
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
	},
	"UU-DBNotRecentlyFetchedDBUpToDateNotLocallyAccessedRecently": {
			lastAccessedLocally: daysAgo(14).toISOString(),
			lastFetchedFromDB: daysAgo(14).toISOString(),
			lastVideoPublishedAt: lastPublishThreeDaysAgo,
			videos: {
					"00000000001": lastPublishThreeDaysAgo,
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
	},
	"UU-DBNotRecentlyFetchedDBNotUpToDateLocallyAccessedRecently": {
			lastAccessedLocally: daysAgo(0).toISOString(),
			lastFetchedFromDB: daysAgo(14).toISOString(),
			lastVideoPublishedAt: lastPublishThreeDaysAgo,
			videos: {
					"00000000001": lastPublishThreeDaysAgo,
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
	},
	"UU-DBNotRecentlyFetchedDBNotUpToDateNotLocallyAccessedRecently": {
			lastAccessedLocally: daysAgo(14).toISOString(),
			lastFetchedFromDB: daysAgo(14).toISOString(),
			lastVideoPublishedAt: lastPublishThreeDaysAgo,
			videos: {
					"00000000001": lastPublishThreeDaysAgo,
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
	}
};

const databasePermutationPresets = [
	{
		lastUpdatedDBAt: daysAgo(0).toISOString(),
		lastVideoPublishedAt: lastPublishThreeDaysAgo
	},
	{
		lastUpdatedDBAt: daysAgo(0).toISOString(),
		lastVideoPublishedAt: lastPublishOneDayAgo
	},
	{
		lastUpdatedDBAt: daysAgo(14).toISOString(),
		lastVideoPublishedAt: lastPublishThreeDaysAgo
	},
	{
		lastUpdatedDBAt: daysAgo(14).toISOString(),
		lastVideoPublishedAt: lastPublishOneDayAgo
	}
];

const databaseVideos = {
	"00000000001": lastPublishThreeDaysAgo,
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
};


// TODO: These permutations need the correct playlist IDs
export const databasePermutations = [];

for (const permutation of databasePermutationPresets) {
	let newPermutation = {
		lastUpdatedDBAt: permutation.lastUpdatedDBAt,
		lastVideoPublishedAt: permutation.lastVideoPublishedAt,
		videos: { ...databaseVideos }
	};

	if (permutation.lastVideoPublishedAt === lastPublishOneDayAgo) {
		newPermutation.videos["00000000000"] = lastPublishOneDayAgo;
	}

	databasePermutations.push(newPermutation);
}