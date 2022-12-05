// Handles access to the Youtube API to get video information

let API_KEY = null;

async function initAPI() {
	if (!API_KEY) {
		console.log('Getting API key from local storage...');
		API_KEY = await getAPIKey();
	}
}

async function pingAPI() {
	await initAPI();

	if(!API_KEY) {
		console.log('No API key set.');
		return;
	}
	console.log('The current API key is: ' + API_KEY);

	
}

async function getAPIKey() {
	return chrome.storage.local.get(["API_KEY"]).then((result) => {
		if (result) {
			return result.API_KEY;
		}
		return null;
	});
}