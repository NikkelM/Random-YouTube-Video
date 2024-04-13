// Entry point for the popup page
import { delay } from "../../utils.js";
import { configSync, setSyncStorageValue, removeSyncStorageValue } from "../../chromeStorage.js";
import { manageDependents, manageDbOptOutOption, validateApiKey, setChannelSetting, removeChannelSetting, updateFYIDiv } from "./popupUtils.js";
import { tryFocusingTab } from "../htmlUtils.js";
import { userHasActiveSubscriptionRole } from "../../stripe.js";

// ----- Setup -----
const isPopup = chrome.extension.getViews({ type: "popup" }).length > 0;
if (isPopup) {
	const tabs = await chrome.tabs.query({});
	const activeTab = tabs.filter(tab => tab.active);
	const popupURL = chrome.runtime.getURL("html/popup.html");

	// If the options page is focused, do not open the popup
	if (activeTab[0].url === popupURL) {
		window.close();
	} else {
		// Else, close the options page in the background
		for (const tab of tabs) {
			if (tab.url === popupURL) {
				chrome.tabs.remove(tab.id);
				break;
			}
		}
	}
}

const domElements = getDomElements();
await setDomElementValuesFromConfig(domElements);
await setDomElementEventListeners(domElements);
await determineOverlayVisibility(domElements);

// Restart the background script if it was stopped to make sure the shuffle button immediately works
try {
	await chrome.runtime.sendMessage({ command: "connectionTest" });
} catch (error) {
	console.log("The background worker was stopped and had to be restarted.");
}

// ----- DOM -----
// --- Private ---
// Get relevant DOM elements
function getDomElements() {
	/* global reviewDonationDiv, reviewDiv, donationDiv, customApiKeyInputDiv, customApiKeyInputInfoDiv, shuffleNumVideosInPlaylistDiv, channelCustomOptionsDiv, channelCustomOptionsDropdownDiv, forYourInformationDiv, dailyQuotaNoticeDiv */
	/* eslint no-undef: "error" */
	return {
		body: document.body,

		// OVERLAY
		// Review/Donation div
		reviewDonationDiv: document.getElementById("reviewDonationDiv"),
		// Review div
		reviewDiv: reviewDonationDiv.children.namedItem("reviewDiv"),
		// Review close button
		reviewOverlayCloseButton: reviewDiv.children.namedItem("reviewOverlayCloseButton"),
		// Donation div
		donationDiv: reviewDonationDiv.children.namedItem("donationDiv"),
		// Donation close button
		donationOverlayCloseButton: donationDiv.children.namedItem("donationOverlayCloseButton"),

		// GLOBAL SETTINGS
		// Custom API key: Option toggle
		useCustomApiKeyOptionToggle: document.getElementById("useCustomApiKeyOptionToggle"),
		// Custom API key: Input
		customApiKeyInputDiv: document.getElementById("customApiKeyInputDiv"),
		customApiKeyInputField: customApiKeyInputDiv.children.namedItem("customApiKeyInputField"),
		customApiKeySubmitButton: customApiKeyInputDiv.children.namedItem("customApiKeySubmitButton"),
		customApiKeyInputInfoDiv: customApiKeyInputDiv.children.namedItem("customApiKeyInputInfoDiv"),
		customApiKeyInputInfoText: customApiKeyInputInfoDiv.children.namedItem("customApiKeyInputInfoText"),
		customApiKeyHowToGetDiv: document.getElementById("customApiKeyHowToGetDiv"),

		// Database sharing: Option toggle
		dbSharingOptionToggle: document.getElementById("dbSharingOptionToggle"),
		// Shuffling: Open in new tab option toggle
		shuffleOpenInNewTabOptionToggle: document.getElementById("shuffleOpenInNewTabOptionToggle"),
		// Shuffling: Reuse tab option toggle
		shuffleReUseNewTabOptionToggle: document.getElementById("shuffleReUseNewTabOptionToggle"),
		// Shuffling : Ignore shorts option dropdown
		shuffleIgnoreShortsOptionDropdown: document.getElementById("shuffleIgnoreShortsOptionDropdown"),
		// Shuffling: Open as playlist option toggle
		shuffleOpenAsPlaylistOptionToggle: document.getElementById("shuffleOpenAsPlaylistOptionToggle"),
		// Shuffling: Number of videos in playlist div
		shuffleNumVideosInPlaylistDiv: document.getElementById("shuffleNumVideosInPlaylistDiv"),
		// Shuffling: Number of videos in playlist input
		shuffleNumVideosInPlaylistInput: shuffleNumVideosInPlaylistDiv.children.namedItem("shuffleNumVideosInPlaylistInput"),

		// PER CHANNEL SETTINGS
		// Custom options per channel div
		channelCustomOptionsDiv: document.getElementById("channelCustomOptionsDiv"),
		// Custom options per channel: Channel name and description
		channelCustomOptionsHeader: channelCustomOptionsDiv.children.namedItem("channelCustomOptionsHeader"),
		// Custom options per channel: Dropdown menu Div (only for reference below)
		channelCustomOptionsDropdownDiv: channelCustomOptionsDiv.children.namedItem("channelCustomOptionsDropdownDiv"),
		// Dropdown menu div: Dropdown menu
		channelCustomOptionsDropdown: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsDropdown"),
		// ----- Inputs -----
		// Dropdown menu div: Date input
		channelCustomOptionsDateOptionInput: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsDateOptionInput"),
		// Dropdown menu div: YouTube Video ID input
		channelCustomOptionsVideoIdOptionInput: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsVideoIdOptionInput"),
		// Dropdown menu div: Percentage input
		channelCustomOptionsPercentageOptionInput: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsPercentageOptionInput"),
		// Dropdown menu div: Percentage input p for % sign
		channelCustomOptionsPercentageOptionP: channelCustomOptionsDropdownDiv.children.namedItem("channelCustomOptionsPercentageOptionP"),

		// Popup shuffle button
		popupShuffleButton: document.getElementById("popupShuffleButton"),

		// FYI - FOR YOUR INFORMATION
		// FYI div
		forYourInformationDiv: document.getElementById("forYourInformationDiv"),
		// FYI: Number of shuffled videos text
		numberOfShuffledVideosText: forYourInformationDiv.children.namedItem("numberOfShuffledVideosText"),
		// FYI: Daily quota notice div
		dailyQuotaNoticeDiv: forYourInformationDiv.children.namedItem("dailyQuotaNoticeDiv"),
		// Daily quota notice: Text
		dailyQuotaNoticeText: dailyQuotaNoticeDiv.children.namedItem("dailyQuotaNoticeText"),

		// FOOTER
		// View changelog button
		viewChangelogButton: document.getElementById("viewChangelogButton"),
		// Shuffle+ button
		shufflePlusButton: document.getElementById("shufflePlusButton"),
	};
}

// Set default values from configSync == user preferences
async function setDomElementValuesFromConfig(domElements) {
	// Disable animations to prevent them from playing when setting the values
	toggleAnimations(domElements);

	// ----- Custom API key: Option toggle -----
	// If this option is checked is only dependent on the value in sync storage
	domElements.useCustomApiKeyOptionToggle.checked = configSync.useCustomApiKeyOption;

	// ----- Database sharing: Option toggle -----
	// Determine if the dbSharingOptionToggle should be checked and enabled
	domElements.dbSharingOptionToggle.checked = configSync.databaseSharingEnabledOption;
	if (!configSync.useCustomApiKeyOption || !configSync.customYoutubeApiKey) {
		domElements.dbSharingOptionToggle.parentElement.classList.add("disabled");
	}

	// ----- Custom API key: Input -----
	// Show the customAPIKeyInputDiv if the user has enabled the option
	if (configSync.useCustomApiKeyOption) {
		domElements.customApiKeyInputDiv.classList.remove("hidden");
	}
	// Set the value of the custom API key input field to the value in sync storage
	domElements.customApiKeyInputField.value = configSync.customYoutubeApiKey ? configSync.customYoutubeApiKey : "";

	if (configSync.useCustomApiKeyOption && configSync.customYoutubeApiKey) {
		domElements.customApiKeyHowToGetDiv.classList.add("hidden");
	}

	// ----- Shuffling: Open in new tab option toggle -----
	domElements.shuffleOpenInNewTabOptionToggle.checked = configSync.shuffleOpenInNewTabOption;

	// ----- Shuffling: Reuse tab option toggle -----
	// If this option is enabled depends on the state of the shuffleOpenInNewTabOptionToggle
	manageDependents(domElements, domElements.shuffleOpenInNewTabOptionToggle, configSync.shuffleOpenInNewTabOption);

	// ----- Shuffling: Ignore shorts option dropdown -----
	domElements.shuffleIgnoreShortsOptionDropdown.value = configSync.shuffleIgnoreShortsOption;

	// ----- Shuffling: Open as playlist option toggle -----
	domElements.shuffleOpenAsPlaylistOptionToggle.checked = configSync.shuffleOpenAsPlaylistOption;

	// ----- Shuffling: Number of videos in playlist div -----
	// Disable the div if the user has not enabled the option to open as playlist
	if (!configSync.shuffleOpenAsPlaylistOption) {
		domElements.shuffleNumVideosInPlaylistDiv.classList.add("disabled");
	}
	// Set the value of the input field to the value in sync storage
	domElements.shuffleNumVideosInPlaylistInput.value = configSync.shuffleNumVideosInPlaylist;

	// Updates all elements that contain the channel name
	updateDomElementsDependentOnChannel(domElements);

	// ----- Custom options per channel div -----
	if (configSync.currentChannelId) {
		domElements.channelCustomOptionsDiv.classList.remove("hidden");
	}

	// Contains logic for all the "For your information" div content
	updateFYIDiv(domElements);

	// If the current extension version is newer than configSync.lastViewedChangelogVersion, highlight the changelog button
	if (configSync.lastViewedChangelogVersion !== chrome.runtime.getManifest().version) {
		domElements.viewChangelogButton.classList.add("highlight-green");
	}

	// Enables or disables the animation of the Shuffle+ button depending on if the user is subscribed or not
	if (!(await userHasActiveSubscriptionRole())) {
		domElements.shufflePlusButton.classList.add("highlight-green-animated");
		domElements.shufflePlusButton.classList.remove("highlight-green");
	}

	// Enable animations
	toggleAnimations(domElements);
}

// Set event listeners for DOM elements
async function setDomElementEventListeners(domElements) {
	// Custom API key: Option toggle
	domElements.useCustomApiKeyOptionToggle.addEventListener("change", async function () {
		await setSyncStorageValue("useCustomApiKeyOption", this.checked);

		manageDependents(domElements, domElements.useCustomApiKeyOptionToggle, this.checked);
	});

	// Database sharing: Option toggle
	domElements.dbSharingOptionToggle.addEventListener("change", async function () {
		await setSyncStorageValue("databaseSharingEnabledOption", this.checked);

		manageDependents(domElements, domElements.dbSharingOptionToggle, this.checked);
	});

	// Custom API key: Input
	domElements.customApiKeySubmitButton.addEventListener("click", async function () {
		// Make sure the passed API key is valid
		const newAPIKey = domElements.customApiKeyInputField.value;
		const oldApiKey = configSync.customYoutubeApiKey;

		if (newAPIKey.length > 0 && await validateApiKey(newAPIKey, domElements)) {
			await setSyncStorageValue("customYoutubeApiKey", newAPIKey);
		} else {
			await removeSyncStorageValue("customYoutubeApiKey");
			await setSyncStorageValue("databaseSharingEnabledOption", true);
			domElements.customApiKeyInputField.value = "";
		}

		// If the user removed the API key, show a message in the info div
		if (oldApiKey != undefined && newAPIKey.length === 0) {
			domElements.customApiKeyInputInfoText.innerText = "Custom API key was successfully removed.";
			domElements.customApiKeyInputInfoDiv.classList.remove("hidden");
		}

		manageDbOptOutOption(domElements);

		manageDependents(domElements, domElements.customApiKeySubmitButton, null);
	});

	// Shuffling: Open in new tab option toggle
	domElements.shuffleOpenInNewTabOptionToggle.addEventListener("change", async function () {
		await setSyncStorageValue("shuffleOpenInNewTabOption", this.checked);

		manageDependents(domElements, domElements.shuffleOpenInNewTabOptionToggle, this.checked);
	});

	// Shuffling: Reuse tab option toggle
	domElements.shuffleReUseNewTabOptionToggle.addEventListener("change", async function () {
		await setSyncStorageValue("shuffleReUseNewTabOption", this.checked);

		manageDependents(domElements, domElements.shuffleReUseNewTabOptionToggle, this.checked);
	});

	// Shuffling: Ignore shorts option dropdown
	domElements.shuffleIgnoreShortsOptionDropdown.addEventListener("change", async function () {
		await setSyncStorageValue("shuffleIgnoreShortsOption", this.value);

		manageDependents(domElements, domElements.shuffleIgnoreShortsOptionDropdown, this.value);
	});

	// Shuffling: Open as playlist option toggle
	domElements.shuffleOpenAsPlaylistOptionToggle.addEventListener("change", async function () {
		await setSyncStorageValue("shuffleOpenAsPlaylistOption", this.checked);

		manageDependents(domElements, domElements.shuffleOpenAsPlaylistOptionToggle, this.checked);
	});

	// Shuffling: Number of videos in playlist input
	// Add an event listener for both using the arrows and manually typing in a value
	"change focusout".split(" ").forEach(function (event) {
		domElements.shuffleNumVideosInPlaylistInput.addEventListener(event, async function () {
			if (this.value === "") {
				// Set the previous value if the input is empty, or set it to 10 if there is no previous value
				this.value = configSync.shuffleNumVideosInPlaylist ?? 10;

				this.classList.add("invalid-input");
				setTimeout(() => {
					this.classList.remove("invalid-input");
				}, 1500);
			}

			// Clamp the value to the range [1, 50]
			const minValue = parseInt(this.getAttribute("min"));
			const maxValue = parseInt(this.getAttribute("max"));
			if (this.value < minValue || this.value > maxValue) {
				this.value = Math.min(Math.max(Math.round(this.value), minValue), maxValue);

				this.classList.add("invalid-input");
				setTimeout(() => {
					this.classList.remove("invalid-input");
				}, 1500);
			}

			await setSyncStorageValue("shuffleNumVideosInPlaylist", parseInt(this.value));

			manageDependents(domElements, domElements.shuffleNumVideosInPlaylistInput, this.value);
		});
	});

	// Custom options per channel: Dropdown menu
	domElements.channelCustomOptionsDropdown.addEventListener("change", async function () {
		// Set the value in configSync to the currently selected option
		await setChannelSetting(configSync.currentChannelId, "activeOption", this.value);

		updateChannelSettingsDropdownMenu(domElements);

		manageDependents(domElements, domElements.channelCustomOptionsDropdown, this.value);
	});

	// Custom options per channel: Dropdown menu: Date input
	domElements.channelCustomOptionsDateOptionInput.addEventListener("focusout", async function () {
		// Make sure the date is valid. If it is not, set it to the previous value. If there is no previous value, set it to null
		const selectedDate = new Date(this.value);
		if (selectedDate > new Date()) {
			this.value = configSync.channelSettings[configSync.currentChannelId]?.dateValue ?? null;

			this.classList.add("invalid-input");
			setTimeout(() => {
				this.classList.remove("invalid-input");
			}, 1500);
		}

		// Set the value in sync storage
		if (this.value) {
			await setChannelSetting(configSync.currentChannelId, "dateValue", this.value);
		} else {
			await removeChannelSetting(configSync.currentChannelId, "dateValue");
		}

		manageDependents(domElements, domElements.channelCustomOptionsDateOptionInput, this.value);
	});

	// Custom options per channel: Dropdown menu: Youtube Video Id input
	domElements.channelCustomOptionsVideoIdOptionInput.addEventListener("focusout", async function () {
		// If an ID was entered, make sure it is valid, i.e. consists of 11 characters
		if (this.value.length === 11) {
			// In case we previously had an invalid input, reset the placeholder
			this.placeholder = "Enter Video ID";
			// Set the value in sync storage
			await setChannelSetting(configSync.currentChannelId, "videoIdValue", this.value);
		} else if (this.value === "") {
			// If the input is empty, remove the value from sync storage
			await removeChannelSetting(configSync.currentChannelId, "videoIdValue");
		} else {
			// Else, the input was invalid
			this.value = configSync.channelSettings[configSync.currentChannelId].videoIdValue ?? "";
			if (this.value === "") {
				this.placeholder = "Invalid video ID";
			}

			this.classList.add("invalid-input");
			setTimeout(() => {
				this.classList.remove("invalid-input");
			}, 1500);
		}

		manageDependents(domElements, domElements.channelCustomOptionsVideoIdOptionInput, this.value);
	});

	// Custom options per channel: Dropdown menu: Percentage input
	// Even though we have disabled the arrows, still add an event listener for it to be sure
	"change focusout".split(" ").forEach(function (event) {
		domElements.channelCustomOptionsPercentageOptionInput.addEventListener(event, async function () {
			if (this.value === "") {
				// Set the previous value if the input is empty, or set it to 100 if there is no previous value
				this.value = configSync.channelSettings[configSync.currentChannelId]?.percentageValue ?? 100;

				this.classList.add("invalid-input");
				setTimeout(() => {
					this.classList.remove("invalid-input");
				}, 1500);
			}

			// Clamp the value to the range [1, 100]
			const minValue = parseInt(this.getAttribute("min"));
			const maxValue = parseInt(this.getAttribute("max"));
			if (this.value < minValue || this.value > maxValue) {
				this.value = Math.min(Math.max(Math.round(this.value), minValue), maxValue);

				this.classList.add("invalid-input");
				setTimeout(() => {
					this.classList.remove("invalid-input");
				}, 1500);
			}

			// We only need to save the value if it's not the default of 100. If we have already saved a different one, we want to remove it
			if (this.value != 100) {
				await setChannelSetting(configSync.currentChannelId, "percentageValue", parseInt(this.value));
			} else {
				await removeChannelSetting(configSync.currentChannelId, "percentageValue");
			}

			manageDependents(domElements, domElements.channelCustomOptionsPercentageOptionInput, this.value);
		});
	});

	// Popup shuffle button
	domElements.popupShuffleButton.addEventListener("click", async function () {
		const shufflingPage = chrome.runtime.getURL("html/shufflingPage.html");

		// Get the status of the shufflingPage, if it exists
		const shufflingPageIsShuffling = await chrome.runtime.sendMessage({ command: "getShufflingPageShuffleStatus" });
		// If the page is not shuffling, close it if it exists, as that means an error was encountered
		if (!shufflingPageIsShuffling) {
			const tabs = await chrome.tabs.query({});
			for (const tab of tabs) {
				if (tab.url === shufflingPage) {
					chrome.tabs.remove(tab.id);
					break;
				}
			}
		}

		let mustOpenTab = await tryFocusingTab(shufflingPage);
		if (mustOpenTab) {
			await chrome.tabs.create({ url: shufflingPage });
		}

		// Close the popup
		window.close();
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

	// Shuffle+ button
	domElements.shufflePlusButton.addEventListener("click", async function () {
		const shufflePlusPage = chrome.runtime.getURL("html/shufflePlus.html");
		let mustOpenTab = await tryFocusingTab(shufflePlusPage);
		if (mustOpenTab) {
			await chrome.tabs.create({ url: shufflePlusPage });
		}
	});
}

async function determineOverlayVisibility(domElements) {
	if (!configSync.reviewMessageShown && configSync.numShuffledVideosTotal < 75 && configSync.numShuffledVideosTotal >= 10) {
		domElements.reviewDiv.classList.remove("hidden");
		domElements.reviewDonationDiv.classList.remove("hidden");
		await setSyncStorageValue("reviewMessageShown", true);

		domElements.reviewOverlayCloseButton.addEventListener("click", function () {
			domElements.reviewDonationDiv.classList.add("hidden");
			domElements.reviewDiv.classList.add("hidden");
		});
	} else if (!configSync.donationMessageShown && configSync.numShuffledVideosTotal >= 75) {
		domElements.donationDiv.classList.remove("hidden");
		domElements.reviewDonationDiv.classList.remove("hidden");
		await setSyncStorageValue("donationMessageShown", true);

		domElements.donationOverlayCloseButton.addEventListener("click", function () {
			domElements.reviewDonationDiv.classList.add("hidden");
			domElements.donationDiv.classList.add("hidden");
		});
	}

	domElements.reviewDonationDiv.addEventListener("click", function (event) {
		if (event.target === this) {
			reviewDonationDiv.classList.add("hidden");
			domElements.reviewDiv.classList.add("hidden");
			domElements.donationDiv.classList.add("hidden");
		}
	});
}

// Responsible for all DOM elements that need a reference to the current channel
async function updateDomElementsDependentOnChannel(domElements) {
	// ----- Custom options per channel: Channel name and description -----
	domElements.channelCustomOptionsHeader.innerText = `Channel Settings: ${configSync.currentChannelName}`;

	// ----- Custom options per channel: Dropdown menu -----
	updateChannelSettingsDropdownMenu(domElements);

	// ----- Popup shuffle button -----
	domElements.popupShuffleButton.innerText = `Shuffle from: ${configSync.currentChannelName}`;
}

async function updateChannelSettingsDropdownMenu(domElements) {
	// ----- Custom options per channel: Dropdown menu -----
	// Set the dropdown menu to the active option chosen by the user
	// The default value is "allVideosOption"
	domElements.channelCustomOptionsDropdown.value = configSync.channelSettings[configSync.currentChannelId]?.activeOption ?? "allVideosOption";
	domElements.channelCustomOptionsDropdown.style.width = domElements.channelCustomOptionsDropdown.options[domElements.channelCustomOptionsDropdown.selectedIndex].getAttribute("option-width");
	domElements.channelCustomOptionsDropdown.title = domElements.channelCustomOptionsDropdown.options[domElements.channelCustomOptionsDropdown.selectedIndex].title;

	switch (domElements.channelCustomOptionsDropdown.value) {
		case "allVideosOption":
			// Hide all inputs
			domElements.channelCustomOptionsDateOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionP.classList.add("hidden");
			break;
		case "dateOption":
			// Hide the other inputs and unhide this one
			domElements.channelCustomOptionsDateOptionInput.classList.remove("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionP.classList.add("hidden");
			// Set the value of the active input to the value saved in the configSync
			// If no date was set yet, set it to null
			domElements.channelCustomOptionsDateOptionInput.value = configSync.channelSettings[configSync.currentChannelId]?.dateValue ?? null;
			break;
		case "videoIdOption":
			domElements.channelCustomOptionsDateOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.classList.remove("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionP.classList.add("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.value = configSync.channelSettings[configSync.currentChannelId]?.videoIdValue ?? "";
			break;
		case "percentageOption":
			domElements.channelCustomOptionsDateOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsVideoIdOptionInput.classList.add("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.classList.remove("hidden");
			domElements.channelCustomOptionsPercentageOptionP.classList.remove("hidden");
			domElements.channelCustomOptionsPercentageOptionInput.value = configSync.channelSettings[configSync.currentChannelId]?.percentageValue ?? 100;
			break;
	}
}

// ----- Helpers -----
// Toggle animations in the popup
async function toggleAnimations(domElements) {
	if (domElements.body.classList.contains("no-transitions")) {
		// Small delay to make sure running animations cannot be seen
		await delay(100);
		domElements.body.classList.remove("no-transitions");
	} else {
		domElements.body.classList.add("no-transitions");
	}
}

// ----- Message handler -----
// IMPORTANT: Only one message handler can send a response. This is the one in the background script for this extension, so we CANNOT send a response here!
chrome.runtime.onMessage.addListener(async function (request) {
	switch (request.command) {
		case "updateCurrentChannel":
			// We need to update the relevant DOM elements with the new channel name
			updateDomElementsDependentOnChannel(domElements);
			break;
		default:
			console.log(`Unknown command: ${request.command} (popup). Hopefully another message listener will handle it.`);
			// Add a small delay here to make sure we don't send a response before the background script has had a chance to respond
			// This is an issue on Firefox
			await delay(100);
			break;
	}
});