let configSync = await fetchConfigSync();

// Get all relevant DOM elements
const domElements = getDomElements();

await setDomElementValuesFromConfig(domElements, configSync);

await setDomElemenEventListeners(domElements, configSync);

// IMPORTANT: Only one message handler can send a response. This is the one in the background script for us, so we CANNOT send a response here!
chrome.runtime.onMessage.addListener(async function (request, sender, sendResponse) {
	switch (request.command) {
		case "updateCurrentChannel":
			// The currentChannelId and currentChannelName have been updated in the configSync
			configSync = await fetchConfigSync();
			// We need to update the relevant DOM elements with the new channel name
			updateDomElementsWithChannelName(domElements, configSync);
			break;
		default:
			console.log(`Unknown command: ${request.command} (popup). Hopefully another message listener will handle it.`);
			break;
	}
});
