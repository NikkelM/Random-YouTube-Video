// Background script for the extension, which is run on extension initialization
// Handles communication between the extension and the content script

let APIKey = null;

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.command === "get_API_key") {
		sendResponse(APIKey);
	} else if (request.command === "set_API_key") {
		APIKey = request.data.val;
		setLocalStorage("API_KEY", request.data.val).then(sendResponse);
	}

	return true;
});

initExtension();

// ---------- functions ----------

async function initExtension() {
	// false if the user has not set an API key
	console.log("Initializing extension, getting API key...");
	APIKey = await getFromLocalStorage("API_KEY");
	console.log("API key: " + APIKey);
}

async function getFromLocalStorage(key) {
	return await chrome.storage.local.get([key]).then((result) => {
		if (result.key) {
			return result.key;
		}
		return null;
	});
}

async function setLocalStorage(key, value) {
	await chrome.storage.local.set({ key: value });
	return value;
}