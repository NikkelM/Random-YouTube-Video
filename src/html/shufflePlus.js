// Entry point for the Shuffle+ page
import { googleLogin } from "../payments.js";

// ----- Setup -----
let user;
const domElements = getPopupDomElements();
await setPopupDomElementValuesFromConfig(domElements);
await setPopupDomElemenEventListeners(domElements);

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

		// FOOTER
		// View changelog button
		viewChangelogButton: document.getElementById("viewChangelogButton"),
		// Shuffle+ button
		shufflePlusButton: document.getElementById("shufflePlusButton"),
	}
}

// Set default values from configSync == user preferences
async function setPopupDomElementValuesFromConfig(domElements) {
	// TODO: Save username locally for faster access when the page is loaded
	// TODO: Separate functions for just getting locally saved metadata and actually logging in to firebase/refreshing tokens
	user = await googleLogin();
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
		user = await googleLogin();
		if (user) {
			domElements.welcomeHeader = `Welcome ${user.displayName.split(" ")[0]}!`;
		} else {
			// TODO: Display error message
		}
	});
}
