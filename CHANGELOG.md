# Changelog

## v1.1.0

<!--Releasenotes start-->
- The extension now uses a faster & more reliable method of getting the channel ID for the current page.
<!--Releasenotes end-->

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