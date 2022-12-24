// Handles everything concerning the shuffling of videos, including sending messages to the backend database and the YouTube API

let APIKey = null;

// Chooses a random video uploaded on the current YouTube channel
async function chooseRandomVideo() {
	// Get the id of the uploads playlist for this channel
	const uploadsPlaylistId = document.querySelector("[itemprop=channelId]").getAttribute("content").replace("UC", "UU");
	console.log("Choosing a random video from playlist/channel: " + uploadsPlaylistId);

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

			// Send the playlist info to the database
			const msg = {
				command: 'postToDB',
				data: {
					key: 'uploadsPlaylists/' + uploadsPlaylistId,
					val: playlistInfo
				}
			};

			chrome.runtime.sendMessage(msg);
		}

		// Save the playlist locally
		console.log("Uploads playlist for this channel successfully retrieved from database or API. Saving it locally...")

		// First update the lastFetchedFromDB field
		playlistInfo["lastFetchedFromDB"] = new Date().toISOString();

		// Update local storage. We don't care if it already exists, because we always have the newest version here.
		chrome.storage.local.set({ [uploadsPlaylistId]: playlistInfo });

		// The playlist exists locally, but may be outdated. Update it from the database. If needed, update the database values as well.
	} else if (playlistInfo["lastFetchedFromDB"] < addHours(new Date(), -48).toISOString()) {
		console.log("Local uploads playlist for this channel may be outdated. Updating from the database...");
		playlistInfo = await tryGetPlaylistFromDB(uploadsPlaylistId);

		// The playlist does not exist in the database (==it was deleted since the user last fetched it). Get it from the API.
		// With the current functionality and db rules, this shouldn't happen.
		if (isEmpty(playlistInfo)) {
			console.log("Uploads playlist for this channel does not exist in the database. Fetching it from the YouTube API...");
			playlistInfo = await getPlaylistFromApi(uploadsPlaylistId);

			// If the playlist exists in the database but is outdated there as well, update it from the API.
		} else if (playlistInfo["lastUpdatedDBAt"] < addHours(new Date(), -48).toISOString()) {
			console.log("Uploads playlist for this channel may be outdated in the database. Updating from the YouTube API...")
			playlistInfo = await updatePlaylistFromApi(playlistInfo, uploadsPlaylistId);

			// TODO: Make this more efficient, meaning only add the new videos to the list. (#24)
			// Send the updated playlist info to the database
			const msg = {
				command: 'postToDB',
				data: {
					key: 'uploadsPlaylists/' + uploadsPlaylistId,
					val: playlistInfo
				}
			};

			chrome.runtime.sendMessage(msg);
		}

		// Update the lastFetchedFromDB field
		playlistInfo["lastFetchedFromDB"] = new Date().toISOString();

		// Update local storage
		chrome.storage.local.set({ [uploadsPlaylistId]: playlistInfo });
	}

	// Choose a random video from the playlist
	const randomVideo = playlistInfo["videos"][Math.floor(Math.random() * playlistInfo["videos"].length)];
	console.log("A random video has been chosen: " + randomVideo);

	// TODO: If the video does not exist anymore, remove it from the locally and db stored playlist and choose a new one. (#5)
	// Navigate to the random video
	window.location.href = `https://www.youtube.com/watch?v=${randomVideo}&list=${uploadsPlaylistId}`;
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
	// Make sure an API key is available
	await validateAPIKey();

	let playlistInfo = {
		"lastVideoPublishedAt": null,
		"lastUpdatedDBAt": new Date().toISOString(),
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

// Get snippets from the API as long as new videos are being found
async function updatePlaylistFromApi(localPlaylist, playlistId) {
	// Make sure an API key is available
	await validateAPIKey();

	// Update the lastUpdatedDBAt field
	localPlaylist["lastUpdatedDBAt"] = new Date().toISOString();

	let lastKnownUploadTime = localPlaylist["lastVideoPublishedAt"];
	let apiResponse = await getPlaylistSnippetFromAPI(playlistId, "");

	// Update the "last video published at" date (only for the most recent video)
	// If the newest video isn't newer than what we already have, we don't need to update the local storage
	if (lastKnownUploadTime < apiResponse["items"][0]["contentDetails"]["videoPublishedAt"]) {
		console.log("At least one video has been published since the last check.");
		localPlaylist["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	} else {
		console.log("No new videos have been published since the last check.");
		return localPlaylist;
	}

	let currVideo = 0;
	let newVideos = [];
	// While the currently saved last video is older then the currently checked video from the API response, we need to add videos to local storage
	while (lastVideoPublishedAt < apiResponse["items"][currVideo]["contentDetails"]["videoPublishedAt"]) {
		newVideos.push(apiResponse["items"][currVideo]["contentDetails"]["videoId"]);

		currVideo++;

		// If the current page has been completely checked
		if (currVideo >= apiResponse["items"].length) {
			// If another page exists, continue checking
			if (apiResponse["nextPageToken"]) {
				apiResponse = await getPlaylistSnippetFromAPI(playlistId, apiResponse["nextPageToken"]);
				currVideo = 0;
				// Else, we have checked all videos
			} else {
				break;
			}
		}
	}
	// Add the new videos to the localPlaylist
	localPlaylist["videos"] = newVideos.concat(localPlaylist["videos"]);

	return localPlaylist;
}

// Sends a request to the Youtube API to get the snippet of a playlist
async function getPlaylistSnippetFromAPI(playlistId, pageToken) {
	console.log("Getting snippet from YouTube API...");
	await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=${pageToken}&playlistId=${playlistId}&key=${APIKey}`)
		.then((response) => response.json())
		.then((data) => apiResponse = data);

	if (apiResponse["error"]) {
		throw new YoutubeAPIError(apiResponse["error"]["code"], apiResponse["error"]["message"]);
	}
	return apiResponse;
}

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