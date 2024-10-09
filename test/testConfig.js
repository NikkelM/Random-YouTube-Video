// Contains configuration and other default values, changed to be used as the default in tests

// All keys regarding user settings and their defaults
export const configSyncDefaults = {
	// If the user has enabled the custom API key option
	"useCustomApiKeyOption": false,
	// The custom API key the user has provided. This key is already validated.
	"customYoutubeApiKey": null,
	// If the user has enabled sharing video ID's with the database
	"databaseSharingEnabledOption": true,
	// These properties influence the behavior of the "Shuffle" button
	"shuffleOpenInNewTabOption": true,
	"shuffleReUseNewTabOption": true,
	// 0 = only shorts, 1 = no option set (shorts are included), 2 = ignore shorts
	"shuffleIgnoreShortsOption": 1,
	"shuffleOpenAsPlaylistOption": true,
	// How many random videos to add to a playlist (0-50)
	"shuffleNumVideosInPlaylist": 10,
	// If shuffled videos are opened in a new tab, save the tab ID of that tab here to reuse the tab when the user shuffles again
	"shuffleTabId": null,
	// channelSettings is a dictionary of channelID -> Dictionary of channel settings
	"channelSettings": {},
	// These two properties are used by the popup to determine which channel's settings to show
	"currentChannelId": null,
	"currentChannelName": null,
	// The number of videos the user has shuffled so far
	// Does not count multiple times if a playlist is shuffled, so is actually numShuffledTimesTotal
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
	// Used when updating the extension
	"previousVersion": null,
	// If the message asking for a review has been shown yet
	"reviewMessageShown": false,
	// If the message asking for a donation has been shown yet
	"donationMessageShown": false,
	// The id/date of the last viewed news article
	"lastViewedNewsId": null,
	// The next time we should check for news (once per day)
	// We delay the first check by 24 hours to not immediately show the news after a user has installed the extension
	"nextNewsCheckTime": new Date(new Date().setHours(24, 0, 0, 0)).getTime()
};
