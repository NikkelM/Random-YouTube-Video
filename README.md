<h1 align="center">Random YouTube Video</h1>

<p align="center">
Chrome Web Store:
<br>
<a href="https://chromewebstore.google.com/detail/random-youtube-video/kijgnjhogkjodpakfmhgleobifempckf">
  <img src="https://img.shields.io/chrome-web-store/v/kijgnjhogkjodpakfmhgleobifempckf?label=version"
    alt="Chrome web store version"></a>
<a href="https://chromewebstore.google.com/detail/random-youtube-video/kijgnjhogkjodpakfmhgleobifempckf">
  <img src="https://img.shields.io/chrome-web-store/stars/kijgnjhogkjodpakfmhgleobifempckf?label=rating"
    alt="Chrome web store rating"></a>
<a href="https://chromewebstore.google.com/detail/random-youtube-video/kijgnjhogkjodpakfmhgleobifempckf">
  <img src="https://img.shields.io/chrome-web-store/users/kijgnjhogkjodpakfmhgleobifempckf?label=users"
    alt="Chrome web store users"></a>
<br>
Firefox:
<br>
<a href="https://addons.mozilla.org/en-GB/firefox/addon/random-youtube-video/">
<img src="https://img.shields.io/amo/v/random-youtube-video?label=version"
		alt="Firefox version"></a>
<a href="https://addons.mozilla.org/en-GB/firefox/addon/random-youtube-video/">
	<img src="https://img.shields.io/amo/stars/random-youtube-video?label=rating"
		alt="Firefox rating"></a>
<a href="https://addons.mozilla.org/en-GB/firefox/addon/random-youtube-video/">
	<img alt="Firefox Add-on" src="https://img.shields.io/amo/users/random-youtube-video?label=users"
		alt="Firefox users"></a>
<br>
<br>
<a href='https://github.com/NikkelM/Random-YouTube-Video/actions?query=branch%3Amain'>
	<img src="https://img.shields.io/github/actions/workflow/status/NikkelM/Random-YouTube-Video/test.yml?branch=main&label=tests"
		alt="GitHub Workflow Status - Tests"></a>
<a href='https://coveralls.io/github/NikkelM/Random-YouTube-Video?branch=main'>
	<img src='https://coveralls.io/repos/github/NikkelM/Random-YouTube-Video/badge.svg?branch=main' 
		alt='Coverage Status'></a>
<br>
<a href="https://github.com/NikkelM/Random-YouTube-Video/tree/main/CHANGELOG.md">
  <img src="https://img.shields.io/badge/view-changelog-blue"
    alt="View changelog"></a>
</p>

Download the extension for: [Chrome/Chromium](https://chromewebstore.google.com/detail/random-youtube-video/kijgnjhogkjodpakfmhgleobifempckf) | [Firefox](https://addons.mozilla.org/en-GB/firefox/addon/random-youtube-video/) | [Edge](https://microsoftedge.microsoft.com/addons/detail/random-youtube-video/fccfflipicelkilpmgniblpoflkbhdbe)

*The Chrome Web Store version can be installed on any Chromium-based browser, such as Edge, Brave, Opera and many more.*

---

Do you have a favourite YouTube channel, but don't know what to watch? This extension is for you!

The Random YouTube Video extension adds a 'Shuffle' button to YouTube channel, video and shorts pages, which will play a truly random video from the current channel. You can use the extension's popup to customize your experience further.

Highlighted Features:<br>
- Choose from a wide range of options to individualize your experience, such as ignoring shorts, only shuffling from the most recent videos, shuffling multiple videos into a playlist, and much more!
- You don't need to open YouTube to shuffle from your favourite channels - the extension popup allows you to shuffle from your most recently visited channel at any time!
- If another user has already shuffled from the channel you want to watch, the extension will run faster for you as video IDs are shared!

## Contribution

Do you have ideas for new features or have encountered a bug? Please [open an issue](https://github.com/NikkelM/Random-YouTube-Video/issues/new/choose).

The `main` branch of this repository *should* always be stable. If you want to test the newest unreleased features, follow the steps below to create a local version of the extension that you can install in the browser of your choice.
<br>
You can find out what new changes will be coming in the next version in the [changelog](https://github.com/NikkelM/Random-YouTube-Video/blob/main/CHANGELOG.md).
Did you find any bugs with the version you tested? Please let me know by [opening an issue](https://github.com/NikkelM/Random-YouTube-Video/issues/new/choose)!

### Installation

- Install the required dependencies by running `npm install` in the root directory of the project.
- Use `npm run build` to build a distribution for each browser environment.
	- `npm run build:chromium` builds a distribution for Chrome/Chromium only.
	- `npm run build:firefox` builds a distribution for Firefox only.
	- Replace `build` with `dev` in the above commands to build a development version of the extension that updates automatically when you make changes to the code.
- The bundled extension files will be placed in the `dist/<environment>` directories.
- You can load the extension in your browser by following the instructions below.

#### Chromium

- Open the Extension Management page by navigating to `chrome://extensions`.
- Make sure that you have enabled developer mode.
- Click `Load unpacked` and choose the `dist/chromium` folder.

Loading the extension like this will persist it until you remove it manually.

#### Firefox

- Open the Add-ons page by navigating to `about:addons`.
- Click the cog icon and select `Debug Add-ons`.
- Click `Load Temporary Add-on...` and choose the `dist/firefox/manifest.json` file.

Loading the extension like this will persist it only *until you restart Firefox*. 
You may also test the extension with Firefox by running `npm run dev:firefox`, which uses `web-ext` to load the extension in a temporary Firefox profile. 

---

If you enjoy this extension and want to say thanks, consider buying me a [coffee](https://ko-fi.com/nikkelm) or [sponsoring](https://github.com/sponsors/NikkelM) this project.
