// Utility functions for the various HTML pages' logic
let shufflingHintJsonData = null;

async function initShufflingHints() {
	const shufflingHintJsonUrl = chrome.runtime.getURL('data/shufflingTips.json');
	shufflingHintJsonData = await loadJsonFile(shufflingHintJsonUrl);
}

async function displayShufflingHint(displayElement, currentHintIndex = null) {
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
