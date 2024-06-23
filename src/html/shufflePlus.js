// Entry point for the Shuffle+ page
import { setSyncStorageValue } from "../chromeStorage.js";
import { getUser, revokeAccess } from "../googleOauth.js";
import { buildShufflingHints, tryFocusingTab } from "./htmlUtils.js";
import { openStripeCheckout, getSubscriptions, userHasActiveSubscriptionRole } from "../stripe.js";

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
		loadingOverlay: document.getElementById("loadingOverlay"),

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
		// TODO: Move into product overview
		// Subscribe button
		manageSubscriptionButtonDiv: document.getElementById("manageSubscriptionButtonDiv"),
		manageSubscriptionButton: document.getElementById("manageSubscriptionButton"),

		// PRODUCT OVERVIEW
		// Product overview div
		productOverviewDiv: document.getElementById("productOverviewDiv"),
		// Currency selector
		currencySelectorSelect: document.getElementById("currencySelectorSelect"),

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
	};
}

// Set default values from configSync == user preferences
async function setDomElementValuesFromConfig(domElements) {
	user = await getUser(true, false, false);
	if (user) {
		domElements.welcomeHeader.textContent = `Welcome ${user.userInfo.displayName.split(" ")[0]}!`;
		domElements.googleLoginSuccessDiv.classList.remove("hidden");
		domElements.googleRevokeAccessButtonDiv.classList.remove("hidden");

		// Doing this again here to save time if there is no user, but refresh the access token if there is
		user = await getUser(false, true, false);
		await setSubscriptionUI(domElements, user);
	} else {
		domElements.googleLoginButtonDiv.classList.remove("hidden");
		domElements.manageSubscriptionButtonDiv.classList.add("hidden");
	}

	// Set the value of the selector to the user currency, or USD if not found
	domElements.currencySelectorSelect.value = (await chrome.storage.session.get("userCurrency")).userCurrency || "USD";

	// This must be last
	domElements.loadingOverlay.classList.add("fadeOut");
}

// Set event listeners for DOM elements
async function setDomElementEventListeners(domElements) {
	// Google login button
	domElements.googleLoginButton.addEventListener("click", async function () {
		domElements.googleLoginButton.textContent = "Signing in...";
		user = await getUser(false, true, true);

		if (user.userInfo?.displayName) {
			domElements.welcomeHeader.textContent = `Login successful! Welcome ${user.userInfo.displayName.split(" ")[0]}!`;
			domElements.googleLoginSuccessP.textContent = "If you are subscribed to Shuffle+, you now have access to all premium features!";
			domElements.googleLoginButton.textContent = "Sign in with Google";
			domElements.googleLoginButtonDiv.classList.add("hidden");
			domElements.googleLoginErrorDiv.classList.add("hidden");
			domElements.googleLoginSuccessDiv.classList.remove("hidden");
			domElements.googleRevokeAccessButtonDiv.classList.remove("hidden");
			domElements.manageSubscriptionButtonDiv.classList.remove("hidden");
			await setSubscriptionUI(domElements, user);

			chrome.action.setIcon({
				path: {
					"16": chrome.runtime.getURL("icons/icon-16-white.png"),
					"32": chrome.runtime.getURL("icons/icon-32-white.png"),
					"48": chrome.runtime.getURL("icons/icon-48-white.png"),
					"128": chrome.runtime.getURL("icons/icon-128-white.png")
				}
			});
		} else {
			domElements.googleLoginButton.textContent = `Login failed with error: ${user.code ? user.code : "Unknown Error"}`;
			domElements.googleLoginSuccessDiv.classList.add("hidden");
			domElements.googleLoginErrorDiv.classList.remove("hidden");
			domElements.googleLoginErrorP.textContent = user.error;
		}
	});

	// Manage subscription button
	domElements.manageSubscriptionButton.addEventListener("click", async function () {
		if (await userHasActiveSubscriptionRole()) {
			// TODO: This is the test URL
			const url = `https://billing.stripe.com/p/login/test_7sI5lw95Afu5fzqbII?prefilled_email=${user.userInfo.email}`;
			await chrome.tabs.create({ url });
		} else {
			domElements.manageSubscriptionButton.textContent = "Preparing subscription...";

			// Get configuration from UI or use defaults
			// TODO: Use correct product name
			let requestedProduct = "Shuffle+ (Test)";
			let requestedCurrency = domElements.currencySelectorSelect.value;
			let requestedInterval = "year";
			let requestedIntervalCount = 1; // Unused with yearly interval in this context

			await openStripeCheckout(user, requestedProduct, requestedCurrency, requestedInterval, requestedIntervalCount);
			domElements.manageSubscriptionButton.textContent = "Subscribe to Shuffle+";
		}
	});

	// Forget me button
	let enableConfirmButtonTimeout;
	domElements.googleRevokeAccessButton.addEventListener("click", function () {
		domElements.googleRevokeAccessConfirmationPopup.classList.remove("hidden");
		domElements.googleRevokeAccessConfirmButton.disabled = true;
		domElements.googleRevokeAccessConfirmButton.classList.add("buttonFillUp");

		// Enable the confirm button after 5 seconds
		enableConfirmButtonTimeout = setTimeout(function () {
			domElements.googleRevokeAccessConfirmButton.disabled = false;
			domElements.googleRevokeAccessConfirmButton.classList.remove("buttonFillUp");
		}, 10000);
	});

	// Forget me - popup click handler
	domElements.googleRevokeAccessConfirmationPopup.addEventListener("click", function (event) {
		if (event.target === this) {
			domElements.googleRevokeAccessConfirmationPopup.classList.add("hidden");
			clearTimeout(enableConfirmButtonTimeout);
		}
	});

	// Forget me - cancel button
	domElements.googleRevokeAccessCancelButton.addEventListener("click", function () {
		domElements.googleRevokeAccessConfirmationPopup.classList.add("hidden");
		clearTimeout(enableConfirmButtonTimeout);
	});

	// Forget me - confirm button
	domElements.googleRevokeAccessConfirmButton.addEventListener("click", async function () {
		domElements.googleRevokeAccessConfirmationPopup.classList.add("hidden");
		domElements.googleRevokeAccessButton.textContent = "Removing user account...";
		const forgotUser = await revokeAccess(user, true);
		if (forgotUser) {
			domElements.googleLoginButtonDiv.classList.remove("hidden");
			domElements.googleLoginSuccessDiv.classList.add("hidden");
			domElements.googleRevokeAccessButtonDiv.classList.add("hidden");
			domElements.manageSubscriptionButtonDiv.classList.add("hidden");
			domElements.googleRevokeAccessButton.textContent = "Forget me permanently";
			domElements.welcomeHeader.textContent = "Account was successfully removed! Sign in to get started again";
		} else {
			domElements.googleLoginSuccessDiv.classList.add("hidden");
			domElements.googleRevokeAccessButton.textContent = "Removing account failed! Please try again later.";
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

// Sets UI elements according to the user's subscription status
async function setSubscriptionUI(domElements, user) {
	const subscriptionStatus = await getSubscriptionStatus(user);

	if (subscriptionStatus.hasActiveSubscription) {
		if (subscriptionStatus.isCancelled) {
			domElements.googleLoginSuccessP.textContent = `Your benefits will expire on ${new Date(subscriptionStatus.subscriptionEnd).toLocaleDateString()} if you do not renew your subscription beforehand!`;
		} else {
			domElements.googleLoginSuccessP.textContent = `Your subscription gives you access to all Shuffle+ benefits until ${new Date(subscriptionStatus.subscriptionEnd).toLocaleDateString()} and will renew automatically.`;
		}
		domElements.manageSubscriptionButton.textContent = "Manage your subscription";
	} else {
		if (subscriptionStatus.subscriptionEnd) {
			if (subscriptionStatus.subscriptionEnd > Date.now()) {
				domElements.googleLoginSuccessP.textContent = `Your benefits will expire on ${new Date(subscriptionStatus.subscriptionEnd).toLocaleDateString()} if you do not renew your subscription beforehand!`;
			} else {
				domElements.googleLoginSuccessP.textContent = `Your benefits expired on ${new Date(subscriptionStatus.subscriptionEnd).toLocaleDateString()}. Renew your subscription now to restore access to all Shuffle+ benefits!`;
			}
		} else {
			domElements.googleLoginSuccessP.textContent = "Subscribe to Shuffle+ to get access to all premium features!";
		}
	}
}

// Gets the subscription status for the current user
async function getSubscriptionStatus(user = null) {
	const subscriptions = await getSubscriptions(user, false);

	if (subscriptions.length > 0) {
		const activeSubscription = subscriptions.find(s => s.status == "active");
		if (activeSubscription) {
			if (activeSubscription.cancel_at_period_end) {
				return {
					hasActiveSubscription: true,
					isCancelled: true,
					subscriptionEnd: activeSubscription.current_period_end.seconds * 1000
				};
			} else if (activeSubscription.cancel_at) {
				return {
					hasActiveSubscription: true,
					isCancelled: true,
					subscriptionEnd: activeSubscription.cancel_at.seconds * 1000
				};
			}
			return {
				hasActiveSubscription: true,
				isCancelled: false,
				subscriptionEnd: activeSubscription.current_period_end.seconds * 1000
			};
		} else {
			// Get the most recently run out subscription
			const lastSubscription = subscriptions.reduce((prev, current) => (prev.ended_at > current.ended_at) ? prev : current);
			return {
				hasActiveSubscription: false,
				isCancelled: true,
				subscriptionEnd: lastSubscription.ended_at.seconds * 1000
			};
		}
	}
	return {
		hasActiveSubscription: false,
		isCancelled: null,
		subscriptionEnd: null
	};
}
