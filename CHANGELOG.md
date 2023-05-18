# Changelog

## v1.5.3 (Unreleased)

<!--Releasenotes start-->
- Added a new option: 'Ignore shorts'. When enabled, the extension will not choose shorts when shuffling. This option is disabled by default, you can enable it in the extension popup.
- The 'Open as Playlist' option has been reworked to be more useful in the context of the extension: If this option is enabled, the shuffle will now open a playlist of randomly chosen videos instead of the uploads playlist of the channel. Please note that YouTube does not allow you to save this playlist.
- Added an input to let you choose how many videos should be shuffled and placed in the playlist when the 'Open a Playlist' option is enabled. YouTube limits the length of these temporary playlists to 50 videos. Higher values will also lead to longer shuffle times.
- The 'Reuse new tab' option is now able to reuse the tab even if it is not the currently focused one. It will however not reuse the tab if you have since navigated away from YouTube, to not accidentally overwrite a page you might still need.
- Added a 'Changelog' button to the popup that will open the changelog in a new tab. The button will be highlighted if the extension has received an update since the last time you opened the changelog. You can also use this page to view older versions of the changelog.
- Added tips and useful information about the extension to the shuffling page opened when using the shuffle button from the popup.
- Added a button to the popup that allows you to view the changelog.
- Added a tooltip to the 'Shuffle' button on channel and video pages.
- Added a link to the YouTube API documentation to help you get started with setting up your own API key. You can find it in the popup when enabling the 'Use custom API key' option.
- Sliders in the popup for enabled options will no longer play their 'enable' animation when the popup is opened and instead directly start in the correct position.
- Changed some default settings for a better first-time experience.
- Sped up the process of checking if a video exists or not by not waiting for unnecessary results from an API request.
- Fixed the buttons displayed under a video sometimes being misaligned/overlapping for most resolutions.
- Fixed a bug where it was possible that the 'Shuffle' button shuffled from a previously visited channel instead of the current one.
- Fixed an issue with the extension checking an internal URL against a fixed instead of dynamic extension ID.
- Fixed a small scaling issue in the popup.
<!--Releasenotes end-->

## v1.5.2

- Added an option that allows you to reuse the same tab when shuffling multiple times from the same channel. This setting only takes effect if you have enabled the option to open shuffled videos in a new tab.
- Fixed a bug where it was possible for the database to not include some videos uploaded on a channel.

## v1.5.1

- Correctly migrate old channel settings to the new format.
- Small improvement to backend logic for channel settings.

## v1.5.0

- Added three new options to the popup: You can now choose to only shuffle from...
- ...videos uploaded on or after a certain date.
- ...videos uploaded on or after the day another video was uploaded.
- ...the most recent x% of videos uploaded on the channel.
- Fixed a bug that might sometimes cause user settings to not get saved correctly.

## v1.4.6

- Fixed the "Shuffling..." text on the shuffle button not being reset after a shuffle.

## v1.4.5

- Added an additional threshold to prevent the API quotas to be used up by channels with too many uploads by accident.
- Added an alert for users of custom API keys when they are shuffling from a channel with 20,000+ uploads, as the YouTube API only provides the most recent 20,000 results.
- Added a small text change to the shuffle button to indicate the shuffle is working in case it takes a bit longer to fetch data from the database.
- Fixed some alignment issues in the extension popup.
- Removed unused code.

## v1.4.4

- Unfortunately, an attacker has compromised the default API keys provided by the extension. You can read the statement [here](https://github.com/NikkelM/Random-YouTube-Video/issues/125). These keys have therefore been disabled. You can still use your own custom API key, which is never transmitted to the extension's database and can therefore not be stolen. If you do not have a custom API key, you can generate one [here](https://developers.google.com/youtube/v3/getting-started). I will be working on reworking the way in which the extension communicates with YouTube's API to prevent this from happening again. I apologize for the inconvenience.
- Fixed a bug where the channel name displayed in the popup would sometimes not be synchronized with the one that is used in the backend.
- Fixed a bug where it would not be possible to set the shuffle percentage to 100% if another value was previously set.

## v1.4.3

- Fixed a bug occurring when a channel has no videos.

## v1.4.2

- The shuffle button will now show the current progress when more than one request to the YouTube API needs to be made.
- The extension popup now shows the number of videos you have shuffled so far.
- Fixed a bug where the surprise wouldn't work for people with certain settings.

## v1.4.1

- Added a small surprise!
- Fixed a bug that caused the shuffle button to not work initially after an update in a specific case.

## v1.4.0

- Added a shuffle button to the extension popup that will shuffle from your most recently visited channel. When shuffling using this button, a new tab will open that must remain open while the shuffle is being prepared.
- When an error is encountered, the full error message and a hint for what to do about it will be displayed.
- Some updates to the internal handling of API keys.
- Improved maintainability of the codebase.

## v1.3.0

- Limited the amount of daily requests a user may make to the YouTube API to protect the userbase against abuse. This should not affect users with normal usage patterns. If you are affected by this, you may make use of the custom API key option to remove this limitation.
- The extension now provides more information when setting a custom YouTube API key.
- Improvements to the reliability of API requests.
- Various improvements to storage management both locally and in the remote database.
- Reduced the size of stored video data.

## v1.2.1

- Fixed an issue with the API.

## v1.2.0

- You are now able to set the percentage of videos that are shuffled for each individual channel instead of one global value. Simply visit a channel or video page and open the extension popup.

## v1.1.2

- Removed unnecessary logging.

## v1.1.1

- Fixed a bug where the extension would throw an API error when navigating from the subscriptions to a channel page and clicking the shuffle button.

## v1.1.0

- The shuffle button is now displayed on all sub-pages of a channel page no matter the entry page.
- The extension now uses a faster & more reliable method of getting the channel ID for the current page.

## v1.0.1

- When opening shuffled videos in a new tab, the currently playing video will be paused.

## v1.0.0

- Added a new option: Open the shuffled video in a new tab.
- Added a new option: Open the shuffled video within the uploads playlist of the channel.
- Added a new option: Only shuffle from the last x% of videos uploaded on the channel - use this to exclude older videos from the shuffle.
- The backend database now uses a more efficient method of storing and communicating video IDs.
- Fixed a bug where the newest videos would not be fetched from the YouTube API in a certain case.
- Fixed a bug where the extension was attempting to access a non-existent version of the shuffle-button.

## v0.2.2

- Fixed a bug where the extension would shuffle from videos of the wrong channel when navigating from the subscriptions to the channel page.
- Changed the text of the button from "Random" to "Shuffle" to match YouTube's naming conventions.

## v0.2.1

- Fixed increased API quota usage introduced by a previous update.
- Prevented the icon on the 'Randomize' button from not loading in fast enough in some cases.

## v0.2.0

- Eliminated previously necessary page reloads during normal YouTube navigation.
- Added support for channel pages in the format "youtube.com/channelName".
- Fixed a bug where users using a custom API key would need to re-fetch video ID's more often than would be necessary.

## v0.1.2

- Fixed a bug preventing interaction with the database in some cases.

## v0.1.1

- Added option to use custom API key.
- Added option to opt out of sharing video id's with other users (can be enabled if using a custom API key).
- Smoother user experience in some places.
- Various bugfixes.

## v0.1.0.2

- Fixed a bug where the extension would not be able to choose a video if a channel has uploaded a new video since the last check.

## v0.1.0.1

- If a deleted video is chosen by the extension, it will now choose a new one instead of redirecting to a broken YouTube page.
- Various improvements to how local storage is handled.
- The extension will now make less requests to the database.

## v0.1.0

- Added a backend database removing the need for users to provide an API key.
- The extension popup has a new look! No more default html.
- The extension icons and store visuals have been updated.
- Various bugfixes.

## v0.0.2

- Added the randomize-button to YouTube video pages - find it next to the subscribe button!
- The button is now smarter and will be able to tell you if you should wait or if something went wrong.
- Sped up & fixed some things.

## v0.0.1

- Initial release.