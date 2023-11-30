// Contains logic for the "Welcome" page
import { setSyncStorageValue } from "../chromeStorage.js";
import { displayShufflingHint, tryFocusingTab } from "./htmlUtils.js";

// ----- Setup -----
const domElements = getDomElements();
await buildShufflingHints();

// --- Set headers ---
const currentVersion = chrome.runtime.getManifest().version;
domElements.updateHeading.innerText = `Random YouTube Video - v${currentVersion}`;

// ---------- DOM ----------
// Get all relevant DOM elements
function getDomElements() {
	return {
		// The div containing all other elements
		randomYoutubeVideo: document.getElementById("randomYoutubeVideo"),
		// The document heading with the current version
		updateHeading: document.getElementById("updateHeading"),
		// Button to reload all YouTube pages
		reloadAllYouTubePagesButton: document.getElementById("reloadAllYouTubePagesButton"),
		// Text displayed before/after reloading all YouTube pages
		reloadText: document.getElementById("reloadText"),
		// The button to open the options page
		openOptionsPageButton: document.getElementById("openOptionsPageButton"),

		// SHUFFLING HINTS
		versionText: document.getElementById("versionText"),
		// The p element containing the shuffle hint
		shufflingHintP: document.getElementById("shufflingHintP"),
		// The button that displays the next shuffle hint
		nextHintButton: document.getElementById("nextHintButton"),

		// FOOTER
		// View changelog button
		viewChangelogButton: document.getElementById("viewChangelogButton"),
	}
}

// Reload all YouTube pages button
domElements.reloadAllYouTubePagesButton.addEventListener("click", async function () {
	// Reload all YouTube tabs
	let tabs = await chrome.tabs.query({});
	// Split the url and check if the domain is "youtube"
	for (let i = 0; i <= tabs.length - 1; i++) {
		if (tabs[i].url.split("/")[2]?.includes("youtube")) {
			chrome.tabs.reload(tabs[i].id);
		}
	}

	domElements.reloadAllYouTubePagesButton.classList.remove("highlight-green");
	// Display text after reloading
	domElements.reloadText.innerHTML = `
		<br />
		<br />
		That's it - 'Shuffle' buttons have been added to all YouTube channel, video and shorts pages!<br />
		If you experience any issues, feel free to reach out to me on GitHub, linked below and in the options page.
	`;
});

// Open options page button
domElements.openOptionsPageButton.addEventListener("click", async function () {
	await chrome.tabs.create({ url: "html/popup.html" });
});

// View changelog button
domElements.viewChangelogButton.addEventListener("click", async function () {
	await setSyncStorageValue("lastViewedChangelogVersion", chrome.runtime.getManifest().version);

	const tabUrl = chrome.runtime.getURL("html/changelog.html");
	let mustOpenTab = await tryFocusingTab(tabUrl);
	if (mustOpenTab) {
		await chrome.tabs.create({ url: "html/changelog.html" });
	}
});

// ----- Shuffling Hints -----
export async function buildShufflingHints() {
	let currentHint = await displayShufflingHint(domElements.shufflingHintP);
	// Add click listener to the "New hint" button
	domElements.nextHintButton.addEventListener("click", async function () {
		currentHint = await displayShufflingHint(domElements.shufflingHintP, currentHint);
	});
}