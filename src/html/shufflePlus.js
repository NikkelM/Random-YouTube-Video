// Entry point for the popup page
import { delay } from "../utils.js";
import { configSync, setSyncStorageValue, removeSyncStorageValue } from "../chromeStorage.js";
import { tryFocusingTab } from "./htmlUtils.js";
import { googleLogin } from "../payments.js";

// ----- Setup -----

const domElements = getPopupDomElements();
await setPopupDomElementValuesFromConfig(domElements);
await setPopupDomElemenEventListeners(domElements);

// ----- DOM -----
// --- Private ---
// Get relevant DOM elements
function getPopupDomElements() {
	return {
		body: document.body,
		// LOGIN
		// Google login button
		googleLoginButton: document.getElementById("googleLoginButton"),

		// FOOTER
		// View changelog button
		viewChangelogButton: document.getElementById("viewChangelogButton"),
		// Shuffle+ button
		shufflePlusButton: document.getElementById("shufflePlusButton"),
	}
}

// Set default values from configSync == user preferences
async function setPopupDomElementValuesFromConfig(domElements) {
	return;
}

// Set event listeners for DOM elements
async function setPopupDomElemenEventListeners(domElements) {
	// Google login button
	domElements.googleLoginButton.addEventListener("click", async function () {
		await googleLogin();
	});
}

function onSignIn(googleUser) {
  var profile = googleUser.getBasicProfile();
  console.log('ID: ' + profile.getId()); // Do not send to your backend! Use an ID token instead.
  console.log('Name: ' + profile.getName());
  console.log('Image URL: ' + profile.getImageUrl());
  console.log('Email: ' + profile.getEmail()); // This is null if the 'email' scope is not present.
}