// Handles access to the Youtube API to get video information

let API_KEY = null;

async function initAPI() {
	if (!API_KEY) {
		console.log('Getting API key from local storage...');

		const msg = {
			command: 'get_API_key'
		};

		API_KEY = await chrome.runtime.sendMessage(msg);
	}
}

async function pingAPI() {
	await initAPI();

	if (!API_KEY) {
		throw new YoutubeVideoError('No API key');
	}
	console.log('The current API key is: ' + API_KEY);

	const uploadsPlaylistId = document.querySelector('[itemprop=channelId]').getAttribute('content').replace('UC', 'UU');
	console.log('Pinging API for playlist ID: ' + uploadsPlaylistId);

	/* Get a dictionary in format
	{
		"lastVideoPublishedAt": DateTimeString,
		"videos": [
			"videoId"
		]
	}
	*/
	let	playlistInfo = await getPlaylistFromLocalStorage(uploadsPlaylistId);

	const randomVideo = playlistInfo["videos"][Math.floor(Math.random() * playlistInfo["videos"].length)];
	console.log('A random video has been chosen: ' + randomVideo);

	// Navigate to the random video
	window.location.href = 'https://www.youtube.com/watch?v=' + randomVideo;
}

async function getPlaylistFromLocalStorage(playlistId) {
	let localStoragePlaylists = await chrome.storage.local.get(["uploadsPlaylists"]).then((result) => {
		if (result.uploadsPlaylists !== undefined) {
			return result.uploadsPlaylists;
		}
		return {};
	});

	if (localStoragePlaylists[playlistId]) {
		localStoragePlaylists = await updateLocalStoragePlaylistFromApi(playlistId, localStoragePlaylists);
		return localStoragePlaylists[playlistId];
	}

	// No information for this playlist is saved in local storage
	// Ping the youtube api and get the videos in the playlist with playlistId
	console.log('Uploads playlist for this channel is unknown. Getting it from the API...');
	return await getWholePlaylistFromAPI(playlistId);
}

async function getWholePlaylistFromAPI(playlistId) {
	// This function is only called if there is no playlist already saved in local storage
	let uploadsPlaylist = {
		"lastVideoPublishedAt": null,
		"videos": []
	};
	let pageToken = "";

	// The first time, we also want to get the uploadTime of the most recent video
	let apiResponse = await getPlaylistSnippetFromAPI(playlistId, pageToken);

	uploadsPlaylist["videos"] = uploadsPlaylist["videos"].concat(apiResponse["items"].map((video) => video["contentDetails"]["videoId"]));
	uploadsPlaylist["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;

	while (pageToken !== null) {
		apiResponse = await getPlaylistSnippetFromAPI(playlistId, pageToken);

		uploadsPlaylist["videos"] = uploadsPlaylist["videos"].concat(apiResponse["items"].map((video) => video["contentDetails"]["videoId"]));

		pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;
	}

	let localStoragePlaylists = await chrome.storage.local.get(["uploadsPlaylists"]).then((result) => {
		if (result.uploadsPlaylists) {
			return result.uploadsPlaylists;
		}
		return {};
	});

	localStoragePlaylists[playlistId] = uploadsPlaylist;

	await chrome.storage.local.set({ "uploadsPlaylists": localStoragePlaylists })

	return uploadsPlaylist;
}

async function updateLocalStoragePlaylistFromApi(playlistId, localStoragePlaylists) {
	let lastVideoPublishedAt = localStoragePlaylists[playlistId]["lastVideoPublishedAt"];
	let apiResponse = await getPlaylistSnippetFromAPI(playlistId, "");

	// Update the last video published at date (only for the most recent video)
	// If the newest video isn't newer than what we already have, we don't need to update the local storage
	if (lastVideoPublishedAt < apiResponse["items"][0]["contentDetails"]["videoPublishedAt"]) {
		console.log('At least one video has been published since the last check.');
		localStoragePlaylists[playlistId]["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	} else {
		console.log('No new videos have been published since the last check.');
		return localStoragePlaylists;
	}

	let currVideo = 0;
	// while the currently saved last video is older then the currently checked video from the API response, we need to add videos to local storage
	while (lastVideoPublishedAt < apiResponse["items"][currVideo]["contentDetails"]["videoPublishedAt"]) {
		localStoragePlaylists[channelId]["videos"].push(apiResponse["items"][currVideo]["contentDetails"]["videoId"]);

		currVideo++;

		// The current page has been completely checked
		if (currVideo >= apiResponse["items"].length) {
			if (apiResponse["nextPageToken"]) {
				apiResponse = await getPlaylistSnippetFromAPI(playlistId, apiResponse["nextPageToken"]);
				currVideo = 0;
			} else {
				break;
			}
		}
	}

	// Push the new list to local storage
	await chrome.storage.local.set({ "uploadsPlaylists": localStoragePlaylists })

	return localStoragePlaylists;
}

async function getPlaylistSnippetFromAPI(playlistId, pageToken) {
	await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=${pageToken}&playlistId=${playlistId}&key=${API_KEY}`)
		.then((response) => response.json())
		.then((data) => apiResponse = data);

	if (apiResponse["error"]) {
		throw new YoutubeVideoError(apiResponse["error"]["code"], apiResponse["error"]["message"]);
	}
	return apiResponse;
}