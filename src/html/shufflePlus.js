// Entry point for the Shuffle+ page
import { setSyncStorageValue } from "../chromeStorage.js";
import { getUser } from "../googleOauth.js";
import { buildShufflingHints, tryFocusingTab } from "./htmlUtils.js";

// ----- Setup -----
let user;
const domElements = getPopupDomElements();
await setPopupDomElementValuesFromConfig(domElements);
await setPopupDomElemenEventListeners(domElements);
await buildShufflingHints(domElements);

// ----- DOM -----
// --- Private ---
// Get relevant DOM elements
function getPopupDomElements() {
	/* global googleLoginButtonDiv */
	/* eslint no-undef: "error" */
	return {
		body: document.body,
		// HEADER
		// Welcome ${username}
		welcomeHeader: document.getElementById("welcomeHeader"),

		// LOGIN
		// Google login button
		googleLoginButtonDiv: document.getElementById("googleLoginButtonDiv"),
		googleLoginButton: googleLoginButtonDiv.children.namedItem("googleLoginButton"),
		// Login Error Div
		googleLoginErrorDiv: document.getElementById("googleLoginErrorDiv"),
		googleLoginError: document.getElementById("googleLoginErrorP"),

		// SHUFFLING HINTS
		// The p element containing the shuffle hint
		shufflingHintP: document.getElementById("shufflingHintP"),
		// The button that displays the next shuffle hint
		nextHintButton: document.getElementById("nextHintButton"),

		// FOOTER
		// View changelog button
		viewChangelogButton: document.getElementById("viewChangelogButton"),
		// Shuffle+ button
		shufflePlusButton: document.getElementById("shufflePlusButton"),
	}
}

// Set default values from configSync == user preferences
async function setPopupDomElementValuesFromConfig(domElements) {
	user = await getUser(true);
	if (user) {
		domElements.welcomeHeader.textContent = `Welcome ${user.displayName.split(" ")[0]}!`;
	} else {
		domElements.googleLoginButtonDiv.style.display = "block";
	}
}

// Set event listeners for DOM elements
async function setPopupDomElemenEventListeners(domElements) {
	// Google login button
	domElements.googleLoginButton.addEventListener("click", async function () {
		domElements.googleLoginButton.textContent = "Logging in...";
		user = await getUser(false);
		if (user.displayName) {
			domElements.welcomeHeader.textContent = `Login successful! Welcome ${user.displayName.split(" ")[0]}!`;
			domElements.googleLoginButtonDiv.style.display = "none";
			domElements.googleLoginErrorDiv.style.display = "none";
		} else {
			console.log(user);
			domElements.googleLoginButton.textContent = `Login failed with error: ${user.code ? user.code : 'Unknown Error'}`;
			domElements.googleLoginErrorDiv.style.display = "block";
			domElements.googleLoginError.textContent = user.error;
		}
	});

	// View changelog button
	domElements.viewChangelogButton.addEventListener("click", async function () {
		await setSyncStorageValue("lastViewedChangelogVersion", chrome.runtime.getManifest().version);

		const changelogPage = chrome.runtime.getURL("html/changelog.html");
		let mustOpenTab = await tryFocusingTab(changelogPage);
		if (mustOpenTab) {
			await chrome.tabs.create({ url: changelogPage });
		}

		domElements.viewChangelogButton.classList.remove("highlight-green");
	});
}
