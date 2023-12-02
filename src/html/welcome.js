// Contains logic for the "Welcome" page
import { setSyncStorageValue } from "../chromeStorage.js";
import { buildShufflingHints, tryFocusingTab } from "./htmlUtils.js";

// ----- Setup -----
const domElements = getDomElements();

// Show the "Reload all YouTube pages" div if there are youtube pages open
chrome.tabs.query({}, function (tabs) {
	for (let i = 0; i <= tabs.length - 1; i++) {
		if (tabs[i].url.split("/")[2]?.includes("youtube")) {
			domElements.needToReloadYouTubePagesDiv.classList.remove("hidden");
			break;
		}
	}
});

// --- Set headers ---
const currentVersion = chrome.runtime.getManifest().version;
domElements.updateHeading.innerText = `Random YouTube Video - v${currentVersion}`;

await buildShufflingHints(domElements);
await setPopupDomElemenEventListeners(domElements);

// ---------- DOM ----------
// Get all relevant DOM elements
function getDomElements() {
	return {
		// The document heading with the current version
		updateHeading: document.getElementById("updateHeading"),

		// RELOAD YOUTUBE PAGES
		// The div containing the button and texts to reload all YouTube pages
		needToReloadYouTubePagesDiv: document.getElementById("needToReloadYouTubePagesDiv"),
		// Button to reload all YouTube pages
		reloadAllYouTubePagesButton: document.getElementById("reloadAllYouTubePagesButton"),
		// Text displayed before/after reloading all YouTube pages
		reloadText: document.getElementById("reloadText"),
		// The button to open the options page
		openOptionsPageButton: document.getElementById("openOptionsPageButton"),

		// SHUFFLING HINTS
		// The p element containing the shuffle hint
		shufflingHintP: document.getElementById("shufflingHintP"),
		// The button that displays the next shuffle hint
		nextHintButton: document.getElementById("nextHintButton"),

		// FOOTER
		// View changelog button
		viewChangelogButton: document.getElementById("viewChangelogButton"),
	}
}

// Set event listeners for DOM elements
async function setPopupDomElemenEventListeners(domElements) {
	// Reload all YouTube pages button
	domElements.reloadAllYouTubePagesButton.addEventListener("click", async function () {
		let tabs = await chrome.tabs.query({});
		for (let i = 0; i <= tabs.length - 1; i++) {
			if (tabs[i].url.split("/")[2]?.includes("youtube")) {
				chrome.tabs.reload(tabs[i].id);
			}
		}

		domElements.reloadAllYouTubePagesButton.classList.remove("highlight-green");
		domElements.reloadText.innerHTML = `
		<br />
		<br />
		That's it - 'Shuffle' buttons have been added to all YouTube channel, video and shorts pages!<br />
		If you experience any issues, feel free to reach out to me on GitHub, linked below and in the options page.
	`;
	});

	// Open options page button
	domElements.openOptionsPageButton.addEventListener("click", async function () {
		const optionsUrl = chrome.runtime.getURL("html/popup.html");
		await chrome.tabs.create({ url: optionsUrl });
	});

	// View changelog button
	domElements.viewChangelogButton.addEventListener("click", async function () {
		await setSyncStorageValue("lastViewedChangelogVersion", chrome.runtime.getManifest().version);

		const changelogUrl = chrome.runtime.getURL("html/changelog.html");
		let mustOpenTab = await tryFocusingTab(changelogUrl);
		if (mustOpenTab) {
			await chrome.tabs.create({ url: changelogUrl });
		}
	});
}