// Contains logic for the "Welcome" page
import { setSyncStorageValue } from "../chromeStorage.js";
import { buildShufflingHints, tryFocusingTab } from "./htmlUtils.js";
import { delay } from "../utils.js";

// ----- Setup -----
const isFirefox = typeof browser !== "undefined";
const domElements = getDomElements();

let mayShowReloadAllYouTubePagesDiv = false;
let tabs = await chrome.runtime.sendMessage({ command: "getAllYouTubeTabs" }) ?? [];
for (let i = 0; i <= tabs.length - 1; i++) {
	if (tabs[i].url.split("/")[2]?.includes("youtube")) {
		mayShowReloadAllYouTubePagesDiv = true;
		// Immediately show if we are not waiting for Firefox permissions
		if (!isFirefox || await browser.permissions.contains({ origins: ["*://*.youtube.com/*"] })) {
			domElements.needToReloadYouTubePagesDiv.classList.remove("hidden");
		}
		break;
	}
}

// --- Set headers ---
const currentVersion = chrome.runtime.getManifest().version_name ?? chrome.runtime.getManifest().version;
domElements.updateHeading.innerText = `Random YouTube Video - v${currentVersion}`;

await buildShufflingHints(domElements);
await setPopupDomElementEventListeners(domElements);

// ---------- DOM ----------
// Get all relevant DOM elements
function getDomElements() {
	return {
		// The document heading with the current version
		updateHeading: document.getElementById("updateHeading"),

		// FIREFOX PERMISSIONS
		// The div containing the permission request button
		firefoxPermissionsDiv: document.getElementById("firefoxPermissionsDiv"),
		// The button to request permissions
		giveFirefoxPermissionsButton: document.getElementById("giveFirefoxPermissionsButton"),

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
async function setPopupDomElementEventListeners(domElements) {
	// Firefox permissions button
	if (isFirefox && !await browser.permissions.contains({ origins: ["*://*.youtube.com/*"] })) {
		domElements.firefoxPermissionsDiv.classList.remove("hidden");

		// This is so important that we will use a browser alert window to make sure the user sees and acknowledges it
		await delay(50);
		alert("You need to grant the extension permission to run on YouTube in order to use it. Please grant permissions using the highlighted button.")

		domElements.giveFirefoxPermissionsButton.addEventListener("click", async function () {
			await requestFirefoxPermissions();
			// If permissions were not granted we must ask again, without them the extension does not work
			if (!await browser.permissions.contains({ origins: ["*://*.youtube.com/*"] })) {
				alert("You need to grant the extension permission to run on YouTube in order to use it. Please grant permissions.")
			} else {
				domElements.firefoxPermissionsDiv.classList.add("hidden");
				if (mayShowReloadAllYouTubePagesDiv) {
					domElements.needToReloadYouTubePagesDiv.classList.remove("hidden");
				}
			}
		});
	}

	// Reload all YouTube pages button
	domElements.reloadAllYouTubePagesButton.addEventListener("click", async function () {
		let tabs = await chrome.runtime.sendMessage({ command: "getAllYouTubeTabs" }) ?? [];
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

async function requestFirefoxPermissions() {
	const permissionsToRequest = {
		origins: ["*://*.youtube.com/*"]
	}
	await browser.permissions.request(permissionsToRequest);
}
