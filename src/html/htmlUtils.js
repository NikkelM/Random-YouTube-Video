// Shared utility functions for the various HTML pages' logic
import { loadJsonFile } from "../utils.js";

// ----- Shuffling Hints -----
let shufflingHintJsonData = null;

async function initShufflingHints() {
	const shufflingHintJsonUrl = chrome.runtime.getURL('data/shufflingHints.json');
	shufflingHintJsonData = await loadJsonFile(shufflingHintJsonUrl);
}

export async function displayShufflingHint(displayElement, currentHintIndex = null) {
	if (shufflingHintJsonData === null) {
		await initShufflingHints();
	}

	// Choose a (new) random hint from the JSON file and display it
	let randomHintIndex = currentHintIndex;
	while (randomHintIndex === currentHintIndex) {
		randomHintIndex = Math.floor(Math.random() * shufflingHintJsonData.length);
	}

	displayElement.innerText = shufflingHintJsonData[randomHintIndex];

	return randomHintIndex;
}

// ----- Other utility functions -----
export function focusOrOpenTab(tabUrl) {
	chrome.tabs.query({}, function (tabs) {
		let mustOpenTab = true;
		for (let i = 0; i <= tabs.length - 1; i++) {
			if (tabs[i].url === tabUrl) {
				// An instance of the page already exists, so don't create a new one
				mustOpenTab = false;
				// Focus the existing tab
				chrome.tabs.update(tabs[i].id, { active: true });
				break;
			}
		}
		if (mustOpenTab) {
			window.open(tabUrl);
		}
	});
}