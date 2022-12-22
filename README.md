<h1 align="center">Random YouTube Video</h1>

<p align="center">
<a href="https://chrome.google.com/webstore/detail/random-youtube-video/kijgnjhogkjodpakfmhgleobifempckf">
  <img src="https://img.shields.io/badge/Get%20it%20on%20the-Chrome%20web%20store-brightgreen"
    alt="Get it on the Chrome web store"></a>
<br>
<a href="https://chrome.google.com/webstore/detail/random-youtube-video/kijgnjhogkjodpakfmhgleobifempckf">
  <img src="https://img.shields.io/chrome-web-store/v/kijgnjhogkjodpakfmhgleobifempckf"
    alt="Chrome web store version"></a>
<a href="https://github.com/NikkelM/Random-YouTube-Video/tree/dev">
  <img src="https://img.shields.io/github/manifest-json/v/NikkelM/Random-YouTube-Video/dev?filename=extension%2Fmanifest.json&label=dev"
    alt="Development version"></a>
<br>
<a href="https://github.com/NikkelM/Random-YouTube-Video/tree/main/CHANGELOG.md">
  <img src="https://img.shields.io/badge/View-changelog-lightgrey"
    alt="View changelog"></a>
</p>

Adds a button to YouTube channel pages that plays a random video from that channel.

## Setup

As this extension requires access to the YouTube API, you will need to provide a (free) API key and set it in the extension popup.
Follow steps 1 & 2 in the [official documentation](https://developers.google.com/youtube/v3/getting-started) to acquire an API key.
The API key authorizes up to 10,000 requests per day, a limit which under normal use of this extension will never be reached.

*A future version of this extension may remove the need to provide an API key.*

After obtaining the API key, open the extension's popup and submit the key. 
**The key is stored locally and never leaves your device!**
It is used to make requests to the YouTube API, which is necessary to get the list of videos a channel has uploaded.

## Usage

After providing an API key, you can start using the extension.
You will notice the new *Random* button next to the *Subscribe* and *Join* options on channel pages.
Clicking the button will play a random video from the channel.

NOTE:<br>
It may take a few seconds for a video to start the first time a random video for a new channel is requested, as the uploaded videos are fetched from the YouTube API.
After this, the video data is stored in your browser's local storage, and subsequent uses are much faster.