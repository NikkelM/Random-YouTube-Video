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
	// 0 = only shorts, 1 = no option set (shorts are included), 2 = ignore shorts
	"shuffleIgnoreShortsOption": 1,
	// TODO: Revert when fixed
	"shuffleOpenAsPlaylistOption": false,
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
	// Contains user information and tokens if the user is logged in with Google
	"googleOauth": null,
	// ----- SHUFFLE PLUS OPTIONS -----
	// Sync user & channel settings with Firebase
	// TODO: Add a toggle in the popup. TODO on that: When the setting gets toggled on, sync all syncable settings to Firestore immediately. When turned off, remove all settings from Firestore
	// TODO: Should the default be false? Not many people need this, so it might be unnecessary overhead
	"plusSyncSettings": true
};

// true if the setting can be synced with Firestore, false otherwise
export const configSyncFirestoreSyncable = {
	"useCustomApiKeyOption": false,
	"customYoutubeApiKey": false,
	"databaseSharingEnabledOption": false,
	"shuffleOpenInNewTabOption": true,
	"shuffleReUseNewTabOption": true,
	"shuffleIgnoreShortsOption": true,
	"shuffleOpenAsPlaylistOption": true,
	"shuffleNumVideosInPlaylist": true,
	"shuffleTabId": false,
	"channelSettings": true,
	"currentChannelId": true,
	"currentChannelName": true,
	"numShuffledVideosTotal": true,
	"userQuotaRemainingToday": false,
	"userQuotaResetTime": false,
	"nextAPIKeysCheckTime": false,
	"lastViewedChangelogVersion": false,
	"wasLastRickRolledInYear": false,
	"previousVersion": false,
	"reviewMessageShown": false,
	"donationMessageShown": false,
	"googleOauth": false,
	"plusSyncSettings": true
};

export const isFirefox = typeof browser !== "undefined";

export const firebaseConfig = {
	apiKey: "AIzaSyA6d7Ahi7fMB4Ey8xXM8f9C9Iya97IGs-c",
	authDomain: "random--video-ex-chrome.firebaseapp.com",
	projectId: "random-youtube-video-ex-chrome",
	storageBucket: "random-youtube-video-ex-chrome.appspot.com",
	messagingSenderId: "141257152664",
	appId: "1:141257152664:web:f70e46e35d02921a8818ed",
	databaseURL: "https://random-youtube-video-ex-chrome-default-rtdb.europe-west1.firebasedatabase.app"
};

// TODO: Add hints for Shuffle+
export const shufflingHints = [
	// General extension hints
	"The extension adds a 'Shuffle' button to all channel, video and shorts pages on YouTube. This button has the same behaviour as shuffling from the popup!",
	"If you are the first person to shuffle from a channel, the video ID's of that channel are saved both locally and in a remote database for other users to use!",
	"The extension does not collect any personal information, it only stores video ID's of channels you shuffle from, without linking them back to you!",
	"You only have a certain number of requests to the YouTube API per day. You can remove this limit by providing your own API key in the popup!",
	"The extension popup shows you how many videos you have shuffled so far!",
	"The list of videos uploaded on a channel is updated regularly, so don't worry if you don't immediately see a recently uploaded video when shuffling!",
	"All video ID's are stored locally in your browser's storage, to make shuffling from a channel even faster the next time you visit it!",
	"The 'Shuffle' button will display a progress percentage if the extension has to fetch data from the YouTube API!",

	// Shuffle+
	"Subscribe to Shuffle+ to get access to new features and enhance your shuffling experience!",

	// Errors
	"Whenever an error is encountered, an alert will open with more detailed information on what caused it, and how you may resolve it. If you still need assistance, please open an issue on GitHub and include the channel ID!",

	// General options
	"Use the 'Open in new tab' option to open each shuffled video in its own tab!",
	"Use the 'Reuse new tab' option to only open a new tab on the first shuffle, and open subsequent shuffled videos in that tab, no matter from which tab you start the shuffle!",
	"Use the 'Open in playlist' option to open shuffled videos in the uploads playlist of the channel! You can customize how many videos are added to the playlist!",
	"You can choose to ignore, include, or only shuffle from shorts uploaded on a channel!",
	"Use the 'Use custom API key' option to provide your own YouTube API key, which will be used instead of the extension's keys. This removes the API quota limit and allows you to opt out of sharing video IDs with other users!",

	// Channel options
	"The extension popup allows you to customize the shuffling experience for the most recently visited channel at any time!",
	"You can choose from a number of filters to choose what videos are considered when shuffling from a specific channel!",
	"The 'Shuffle' button in the popup always shuffles from your most recently visited channel!",
	"You can choose to only shuffle from the most recent X percentage of videos uploaded on the channel by using the '...the most recent x% of videos' shuffle filter!",
	"You can choose to only shuffle from videos uploaded after a specific date by using the '...videos uploaded after date' shuffle filter!",
	"You can choose to only shuffle from videos uploaded after a specific other video by using the '...videos after video with ID' shuffle filter!",

	// Custom API key
	"If you provide a custom YouTube API key, it will be validated first to make sure you can use it with the extension!",
	"If you provide a custom YouTube API key, you are able to opt out of sharing video ID's with the extension's database. In this case, video ID's are only stored locally!",
	"If you provide a custom YouTube API key, it is never shared with the extension's database, and only stored locally!",

	// Changelog
	"The popup will highlight the 'Changelog' button whenever a new version of the extension has been installed!",
	"Want to stay up-to-date on the newest features and improvements? Check out the changelog using the button in the popup!",

	// Meta/GitHub
	"Do you have an idea on how this extension could be improved? Open an issue on GitHub and let me know!",
	"Use the handy links located at the bottom of the popup and other pages to immediately view the extension on different stores!",
	"If you are enjoying this extension, please consider leaving a review to help others find it!",
	"If you want to stay up-to-date with the extension's development, consider starring the GitHub repository!",
	"This extension is a hobby project - you can support it by sponsoring me on GitHub or donating on Ko-Fi!",
	"The extension's source code is available on GitHub: https://github.com/NikkelM/Random-YouTube-Video"
];
