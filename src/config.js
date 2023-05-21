// Contains configuration and other default values

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

export const shufflingHints = [
	// General extension hints
	"The extension adds a 'Shuffle' button to all channel and video pages on YouTube, which has the same behaviour as shuffling from the popup!",
	"If you are the first person to shuffle from a channel, the video ID's of that channel are saved both locally and in a remote database for other users to use!",
	"Try using the extension on April 1st - maybe something unexpected will happen!",
	"The extension does not collect any personal information, it only stores video ID's of channels you shuffle from, without linking them back to you!",
	"You only have certain number of requests to the YouTube API per day. You can remove this limit by providing your own API key in the options!",
	"The extension popup shows you how many videos you have shuffled so far!",
	"The list of videos uploaded on a channel is updated regularly, so don't worry if you don't immediately see a recently uploaded video when shuffling!",
	"All video ID's are stored locally in your browser's cache, to make shuffling from a channel even faster the next time you visit it!",
	"If it ever happens that the 'Shuffle' button is not displayed, simply reload the page and it should be there again. If it doesn't, please open an issue on GitHub!",
	"The 'Shuffle' button will display a progress percentage if the extension has to fetch data from the YouTube API!",

	// Errors
	"Whenever an error is encountered, an alert will open with more detailed information on what caused it, and how you may resolve it. If you still need assistence, please open an issue on GitHub!",

	// Options
	"Use the 'Open in new tab' option to open each shuffled video in its own tab!",
	"Use the 'Reuse new tab' option to only open a new tab on the first shuffle, and open subsequent shuffled videos in that tab, no matter from which tab you start the shuffle!",
	"Use the 'Open in playlist' option to open shuffled videos in the uploads playlist of the channel!",
	"Use the 'Ignore Shorts' option to ignore videos marked as shorts when shuffling!",
	"Use the 'Use custom API key' option to provide your own YouTube API key, which will be used instead of the extension's keys. This removes the API quota limit!",
	"The extension popup allows you to customize the shuffling experience for the most recently visited channel at any time!",
	"You can choose from a number of filters to choose what videos are considered when shuffling from a specific channel!",
	"The 'Shuffle' button in the popup always shuffles from your most recently visited channel!",

	// Custom API key
	"If you provide a custom YouTube API key, it will be validated first to make sure you can use it with the extension!",
	"If you provide a custom YouTube API key, you are able to opt out of sharing video ID's with the extension's database. In this case, video ID's are only stored locally!",
	"If you provide a custom YouTube API key, it is never shared with the extension's database, and only stored locally!",

	// Changelog
	"The popup will highlight the 'Changelog' button whenever a new version of the extension has been installed!",
	"Are you wondering how the extension has changed over time? Check out the changelog using the button on the popup!",

	// Meta/GitHub
	"Do you have an idea on how this extension could be improved? Open an issue on GitHub and let me know!",
	"If you are enjoying this extension, please consider leaving a review to help others find it!",
	"If you want to stay up-to-date with the extension's development, consider starring the GitHub repository!",
	"This extension is a hobby project - you can support it by sponsoring me on GitHub or donating on Ko-Fi!",
	"The extension's source code is available on GitHub: https://github.com/NikkelM/Random-YouTube-Video"
]