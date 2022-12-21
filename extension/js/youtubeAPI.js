// Handles access to the Youtube API to get video information

let APIKey = null;

// Requests the API key from the background script
async function validateAPIKey() {
	if (!APIKey) {
		console.log('Getting API key...');

		const msg = {
			command: "getAPIKey"
		};

		APIKey = await chrome.runtime.sendMessage(msg);

		if (!APIKey) {
			throw new RandomYoutubeVideoError("No API key");
		}
	}
}

// Chooses a random video uploaded on the current YouTube channel
async function chooseRandomVideo() {
	// TODO: Move this to where we actually need it
	// Make sure an API key is available
	await validateAPIKey();

	// Get the id of the uploads playlist for this channel
	const uploadsPlaylistId = document.querySelector("[itemprop=channelId]").getAttribute("content").replace("UC", "UU");
	console.log("Choosing a random video from playlist/channel: " + uploadsPlaylistId);

	// TODO: Make sure this format is up-to-date
	/* Local dictionary format
	{
		"lastVideoPublishedAt": DateTimeString (iso),
		"lastFetchedFromDB": DateTimeString (iso),
		"videos": [
			"videoId"
		]
	}
	*/

	// Check if the playlist is already saved in local storage, so we don't need to access the database
	let playlistInfo = await tryGetPlaylistFromLocalStorage(uploadsPlaylistId);

	// The playlist does not exist locally. Try to get it from the database first
	if (isEmpty(playlistInfo)) {
		// No information for this playlist is saved in local storage
		// Try to get it from the database
		console.log("Uploads playlist for this channel does not exist locally. Trying to get it from the database...");
		playlistInfo = await tryGetPlaylistFromDB(uploadsPlaylistId);

		// If the playlist does not exist in the database, get it from the API
		if (isEmpty(playlistInfo)) {
			console.log("Uploads playlist for this channel does not exist in the database. Fetching it from the YouTube API...");
			playlistInfo = await getPlaylistFromApi(uploadsPlaylistId);

			// Send the playlist info to the db
			const msg = {
				command: 'postToDB',
				data: {
					key: 'uploadsPlaylists/' + uploadsPlaylistId,
					val: playlistInfo
				}
			};

			chrome.runtime.sendMessage(msg);
		}

		// The playlist exists in the database, but is not saved locally. Save it locally.
		console.log("Uploads playlist for this channel successfully retrieved. Saving it locally...")

		// First update the lastFetchedFromDB field
		playlistInfo["lastFetchedFromDB"] = new Date().toISOString();

		// Get the locally stored playlist
		let locallyStoredPlaylist = await chrome.storage.local.get([uploadsPlaylistId]).then((result) => {
			if (result[uploadsPlaylistId]) {
				return result[uploadsPlaylistId];
			}
			return {};
		});

		locallyStoredPlaylist = playlistInfo;

		// Update local storage
		await chrome.storage.local.set({ [uploadsPlaylistId]: locallyStoredPlaylist });

		// The playlist exists locally, but is outdated. Update it from the database. If needed, update the database values as well.
		// TODO: Make the 72 hours a setting for the user (to reduce load on database, set a min-value)
	} else if (playlistInfo["lastFetchedFromDB"] < addHours(new Date(), -72).toISOString()) {
		// TODO: Introduce "lastUpdated" field in db to control how often we query the API. E.g. only once every 24 hours.
		console.log("Uploads playlist for this channel is outdated. Trying to update from the database...");
		playlistInfo = await tryGetPlaylistFromDB(uploadsPlaylistId);

		// The playlist does not exist in the database (==it was deleted since the user last fetched it). Get it from the API.
		if (isEmpty(playlistInfo)) {
			playlistInfo = await getPlaylistFromApi(uploadsPlaylistId);
		}

		// Update the lastFetchedFromDB field
		playlistInfo["lastFetchedFromDB"] = new Date().toISOString();

		// Update local storage
		await chrome.storage.local.set({ [uploadsPlaylistId]: locallyStoredPlaylist });
	}

	// Choose a random video from the playlist
	const randomVideo = playlistInfo["videos"][Math.floor(Math.random() * playlistInfo["videos"].length)];
	console.log("A random video has been chosen: " + randomVideo);

	// Navigate to the random video
	// window.location.href = "https://www.youtube.com/watch?v=" + randomVideo;
}

// Tries to fetch the playlist from local storage. If it is not present, returns an empty dictionary
async function tryGetPlaylistFromLocalStorage(playlistId) {
	return await chrome.storage.local.get([playlistId]).then((result) => {
		if (result[playlistId]) {
			return result[playlistId];
		}
		return {};
	});
}

// Tries to get the playlist from the database. If it is not present, returns an empty dictionary
async function tryGetPlaylistFromDB(playlistId) {
	const msg = {
		command: "getPlaylistFromDB",
		data: playlistId
	};

	return await chrome.runtime.sendMessage(msg) ?? {};
}

async function getPlaylistFromApi(playlistId) {
	// Make a call to the Api to get the playlist
	let playlistInfo = {
		"lastVideoPublishedAt": null,
		"lastUpdatedAt": new Date().toISOString(),
		"videos": []
	};
	let pageToken = "";

	// We also want to get the uploadTime of the most recent video
	let apiResponse = await getPlaylistSnippetFromAPI(playlistId, pageToken);

	playlistInfo["videos"] = apiResponse["items"].map((video) => video["contentDetails"]["videoId"]);
	playlistInfo["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;

	while (pageToken !== null) {
		apiResponse = await getPlaylistSnippetFromAPI(playlistId, pageToken);

		playlistInfo["videos"] = playlistInfo["videos"].concat(apiResponse["items"].map((video) => video["contentDetails"]["videoId"]));

		pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;
	}

	return playlistInfo;
}

async function getPlaylistSnippetFromAPI(playlistId, pageToken) {
	await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=${pageToken}&playlistId=${playlistId}&key=${APIKey}`)
		.then((response) => response.json())
		.then((data) => apiResponse = data);

	if (apiResponse["error"]) {
		throw new YoutubeAPIError(apiResponse["error"]["code"], apiResponse["error"]["message"]);
	}
	return apiResponse;
}