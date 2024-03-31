// Entry point for the Shuffle+ page
import { setSyncStorageValue } from "../chromeStorage.js";
import { getUser, revokeAccess } from "../googleOauth.js";
import { buildShufflingHints, tryFocusingTab } from "./htmlUtils.js";
import { openStripeCheckout } from "../stripe.js";

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

		// SUBSCRIBE
		// Subscribe button
		subscribeButtonDiv: document.getElementById("subscribeButtonDiv"),
		subscribeButton: document.getElementById("subscribeButton"),

		// FORGET ME
		// Forget me button
		googleRevokeAccessButtonDiv: document.getElementById("googleRevokeAccessButtonDiv"),
		googleRevokeAccessButton: document.getElementById("googleRevokeAccessButton"),
		// Confirmation popup
		googleRevokeAccessConfirmationPopup: document.getElementById("googleRevokeAccessConfirmationPopup"),
		// Confirm button in popup
		googleRevokeAccessConfirmButton: document.getElementById("googleRevokeAccessConfirmButton"),
		// Cancel button in popup
		googleRevokeAccessCancelButton: document.getElementById("googleRevokeAccessCancelButton"),

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
		domElements.googleLoginSuccessDiv.classList.remove("hidden");
		domElements.googleRevokeAccessButtonDiv.classList.remove("hidden");
	} else {
		domElements.googleLoginButtonDiv.classList.remove("hidden");
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
			domElements.googleLoginButtonDiv.classList.add("hidden");
			domElements.googleLoginErrorDiv.classList.add("hidden");
			domElements.googleLoginSuccessDiv.classList.remove("hidden");
			domElements.googleRevokeAccessButtonDiv.classList.remove("hidden");
			// TODO: If the user is logged in and subscribed, change the extension icon, e.g.:
			// chrome.action.setIcon({ path: chrome.runtime.getURL('icons/icon-128-white.png') });
		} else {
			console.log(user);
			domElements.googleLoginButton.textContent = `Login failed with error: ${user.code ? user.code : 'Unknown Error'}`;
			domElements.googleLoginSuccessDiv.classList.add("hidden");
			domElements.googleLoginErrorDiv.classList.remove("hidden");
			domElements.googleLoginErrorP.textContent = user.error;
		}
	});

	// Subscribe button
	domElements.subscribeButton.addEventListener("click", async function () {
		await openStripeCheckout();
	});

	// Forget me button
	let enableConfirmButtonTimout;
	domElements.googleRevokeAccessButton.addEventListener("click", function () {
		domElements.googleRevokeAccessConfirmationPopup.classList.remove("hidden");
		domElements.googleRevokeAccessConfirmButton.disabled = true;
		domElements.googleRevokeAccessConfirmButton.classList.add("button-fillup");

		// Enable the confirm button after 5 seconds
		enableConfirmButtonTimout = setTimeout(function () {
			domElements.googleRevokeAccessConfirmButton.disabled = false;
			domElements.googleRevokeAccessConfirmButton.classList.remove("button-fillup");
		}, 10000);
	});

	domElements.googleRevokeAccessConfirmationPopup.addEventListener("click", function (event) {
		if (event.target === this) {
			domElements.googleRevokeAccessConfirmationPopup.classList.add("hidden");
			clearTimeout(enableConfirmButtonTimout);
		}
	});

	// Forget me - cancel button
	domElements.googleRevokeAccessCancelButton.addEventListener("click", function () {
		domElements.googleRevokeAccessConfirmationPopup.classList.add("hidden");
		clearTimeout(enableConfirmButtonTimout);
	});

	// Forget me - confirm button
	domElements.googleRevokeAccessConfirmButton.addEventListener("click", async function () {
		domElements.googleRevokeAccessConfirmationPopup.classList.add("hidden");
		domElements.googleRevokeAccessButton.textContent = "Removing user account...";
		const forgotUser = await revokeAccess(true);
		if (forgotUser) {
			domElements.googleLoginButtonDiv.classList.remove("hidden");
			domElements.googleLoginSuccessDiv.classList.add("hidden");
			domElements.googleRevokeAccessButtonDiv.classList.add("hidden");
			domElements.googleRevokeAccessButton.textContent = "Forget me permanently";
			domElements.welcomeHeader.textContent = "User account removed successfully! Sign in below to get started again";
		} else {
			domElements.googleLoginSuccessDiv.classList.add("hidden");
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
