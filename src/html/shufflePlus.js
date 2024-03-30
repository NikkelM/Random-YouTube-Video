// Entry point for the Shuffle+ page
import { setSyncStorageValue } from "../chromeStorage.js";
import { getUser, revokeAccess } from "../googleOauth.js";
import { buildShufflingHints, tryFocusingTab } from "./htmlUtils.js";

// ----- Setup -----
let user;
const domElements = getDomElements();
await setDomElementValuesFromConfig(domElements);
await setDomElementEventListeners(domElements);
await buildShufflingHints(domElements);

// ----- DOM -----
// --- Private ---
// Get relevant DOM elements
function getDomElements() {
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
		// Login Error
		googleLoginErrorDiv: document.getElementById("googleLoginErrorDiv"),
		googleLoginErrorP: document.getElementById("googleLoginErrorP"),
		// Login Success
		googleLoginSuccessDiv: document.getElementById("googleLoginSuccessDiv"),
		googleLoginSuccessP: document.getElementById("googleLoginSuccessP"),

		// FORGET ME
		// Forget me button
		googleRevokeAccessButtonDiv: document.getElementById("googleRevokeAccessButtonDiv"),
		googleRevokeAccessButton: document.getElementById("googleRevokeAccessButton"),

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
async function setDomElementValuesFromConfig(domElements) {
	user = await getUser(true);
	if (user) {
		domElements.welcomeHeader.textContent = `Welcome ${user.displayName.split(" ")[0]}!`;
		domElements.googleLoginSuccessDiv.style.display = "block";
		domElements.googleRevokeAccessButtonDiv.style.display = "block";
	} else {
		domElements.googleLoginButtonDiv.style.display = "block";
	}
}

// Set event listeners for DOM elements
async function setDomElementEventListeners(domElements) {
	// Google login button
	domElements.googleLoginButton.addEventListener("click", async function () {
		domElements.googleLoginButton.textContent = "Signing in...";
		user = await getUser(false);
		if (user.displayName) {
			domElements.welcomeHeader.textContent = `Login successful! Welcome ${user.displayName.split(" ")[0]}!`;
			domElements.googleLoginButton.textContent = "Sign in with Google";
			domElements.googleLoginButtonDiv.style.display = "none";
			domElements.googleLoginErrorDiv.style.display = "none";
			domElements.googleLoginSuccessDiv.style.display = "block";
			domElements.googleRevokeAccessButtonDiv.style.display = "block";
			// TODO: If the user is logged in and subscribed, change the extension icon, e.g.:
			// chrome.action.setIcon({ path: chrome.runtime.getURL('icons/icon-128-white.png') });
		} else {
			console.log(user);
			domElements.googleLoginButton.textContent = `Login failed with error: ${user.code ? user.code : 'Unknown Error'}`;
			domElements.googleLoginSuccessDiv.style.display = "none";
			domElements.googleLoginErrorDiv.style.display = "block";
			domElements.googleLoginErrorP.textContent = user.error;
		}
	});

	// Forget me button
	// TODO: Ask for confirmation before revoking access
	domElements.googleRevokeAccessButton.addEventListener("click", async function () {
		const forgotUser = await revokeAccess(true);
		if (forgotUser) {
			domElements.googleLoginButtonDiv.style.display = "block";
			domElements.googleLoginSuccessDiv.style.display = "none";
			domElements.googleRevokeAccessButtonDiv.style.display = "none";
			domElements.welcomeHeader.textContent = "App access revoked successfully! Sign in below to get started again";
		} else {
			domElements.googleLoginSuccessDiv.style.display = "none";
			domElements.googleRevokeAccessButton.textContent = "Signout failed!";
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
