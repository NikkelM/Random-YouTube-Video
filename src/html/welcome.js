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
		// Displays the version text
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