let APIKey = null;

initExtension();

async function initExtension() {
	// false if the user has not set an API key
	APIKey = await getAPIKey();
}

async function getAPIKey() {
	return await chrome.storage.local.get(["API_KEY"]).then((result) => {
		if (result) {
			return result.API_KEY;
		}
		return null;
	});
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.command === 'get_local') {
		getFromLocalStorage(request.data.key).then(sendResponse);
	} else if (request.command === 'get_API_key') {
		sendResponse(APIKey);
	} else if (request.command === 'refresh_API_key') {
		APIKey = request.data.val;
	}
	
	return true;
});

async function getFromLocalStorage(key) {
	return await chrome.storage.local.get([key]).then((result) => {
		if (result) {
			return result.key;
		}
		return null;
	});
}