// Checks Firestore for new news and opens the news page if there are
import { configSync, getSessionStorageValue, setSyncStorageValue } from "../chromeStorage.js";
import { buildShufflingHints, tryFocusingTab } from "./htmlUtils.js";

const domElements = getDomElements();
await setDomElementValues(domElements);
await buildShufflingHints(domElements);
await setDomElementEventListeners(domElements);

function getDomElements() {
	return {
		newsHeading: document.getElementById("newsHeading"),
		newsContent: document.getElementById("newsContent"),
		publishTime: document.getElementById("publishTime"),
		// The p element containing the shuffle hint
		shufflingHintP: document.getElementById("shufflingHintP"),
		// The button that displays the next shuffle hint
		nextHintButton: document.getElementById("nextHintButton"),

		// FOOTER
		// View changelog button
		viewChangelogButton: document.getElementById("viewChangelogButton"),
	}
}

// Set default values from configSync == user preferences
async function setDomElementValues(domElements) {
	await buildNews();

	// If the current extension version is newer than configSync.lastViewedChangelogVersion, highlight the changelog button
	if (configSync.lastViewedChangelogVersion !== chrome.runtime.getManifest().version) {
		domElements.viewChangelogButton.classList.add("highlight-green");
	}
}

// Set event listeners for DOM elements
async function setDomElementEventListeners(domElements) {
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

async function buildNews() {
	const news = await getSessionStorageValue("news");

	// This normally shouldn't happen, as the news page is only opened if news have been added to session storage before
	if (!news) {
		console.log("No news found in session storage, even though there should be some!");
		return;
	}

	domElements.newsHeading.textContent = news.heading;
	domElements.newsContent.innerHTML = news.htmlContent;

	const createdAtDate = new Date(news.createdAt.seconds * 1000);
	const differenceInTime = new Date().getTime() - createdAtDate.getTime();
	const differenceInDays = Math.floor(differenceInTime / (1000 * 3600 * 24));

	let dateString = `Published on ${createdAtDate.toLocaleDateString()}`;
	if (differenceInDays > 1) {
		dateString += ` (${differenceInDays} days ago)`;
	}

	domElements.publishTime.textContent = dateString;
}
