// Handles access to the Youtube API to get video information

let API_KEY = null;
let uploadsPlaylistDict = null;

async function initAPI() {
	if (!API_KEY) {
		console.log('Getting API key from local storage...');
		API_KEY = await getAPIKey();
	}
	if (!uploadsPlaylistDict) {
		console.log('Getting uploads playlists dictionary from local storage...')
		uploadsPlaylistDict = await getUploadsPlaylistsFromLocalStorage()
	}
}

async function pingAPI() {
	await initAPI();

	if (!API_KEY) {
		console.log('No API key set.');
		return;
	}
	console.log('The current API key is: ' + API_KEY);

	const channelId = document.querySelector('[itemprop=channelId]').getAttribute('content');
	// TODO: When does this happen? Can we get the id another way?
	if (!channelId) {
		console.log('No channelId could be found.');
		return;
	}
	console.log('Pinging API for channel ID: ' + channelId);

	const uploadsPlaylist = uploadsPlaylistDict[channelId] ? uploadsPlaylistDict[channelId] : await getUploadsPlaylistFromChannelID(channelId);
	console.log('Uploads playlist for this channel is: ' + uploadsPlaylist);
}

async function getUploadsPlaylistFromChannelID(channelId) {
	// Ping the youtube api and get the playlist named uploads for the channel with id channelId
	console.log('Uploads playlist for this channel is unknown. Getting it from the API...');

	await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`)
		.then((response) => response.json())
		.then((data) => api_response = data);

	const playlistID = api_response['items'][0]['contentDetails']['relatedPlaylists']['uploads'];

	uploadsPlaylistDict[channelId] = playlistID;
	await chrome.storage.local.set({ "uploadsPlaylists": uploadsPlaylistDict })

	return playlistID;
}

async function getAPIKey() {
	return chrome.storage.local.get(["API_KEY"]).then((result) => {
		if (result) {
			return result.API_KEY;
		}
		return null;
	});
}

async function getUploadsPlaylistsFromLocalStorage() {
	return chrome.storage.local.get(["uploadsPlaylists"]).then((result) => {
		if (result) {
			return result.uploadsPlaylists;
		}
		return null;
	});
}