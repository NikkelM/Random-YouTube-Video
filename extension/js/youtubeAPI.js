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
		"lastVideoPublishedAt": DateTimeString,
		"lastFetchedFromDB": DateTimeString,
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
			console.log("Uploads playlist for this channel does not exist in the database. Trying to get it from the YouTube API...");
			playlistInfo = await getPlaylistFromApi(uploadsPlaylistId);

			// TODO: Save the playlist to the database
			// TODO: Save the playlist to local storage
		} else {
			// The playlist exists in the database, but is not saved locally. Save it locally.
			console.log("Uploads playlist for this channel successfully retrieved from the database. Saving it locally...")

			// First update the lastFetchedFromDB field
			playlistInfo["lastFetchedFromDB"] = new Date().toISOString();
			
			// Get the local storage dictionary
			let localStoragePlaylists = await chrome.storage.local.get(["uploadsPlaylists"]).then((result) => {
				if (result["uploadsPlaylists"]) {
					return result["uploadsPlaylists"];
				}
				return {};
			});
		
			localStoragePlaylists[uploadsPlaylistId] = playlistInfo;
		
			// Update local storage
			await chrome.storage.local.set({ "uploadsPlaylists": localStoragePlaylists });
		}
		// The playlist exists locally, but is outdated. Update it from the database. If needed, update the database values as well.
	} else if (playlistInfo["lastFetchedFromDB"] < "Date now - xx hours") {
		// TODO

		// TODO: Introduce "lastUpdated" field in db to control how often we query the API. E.g. only once every 24 hours.
		// TODO: Only get updated values from db once per day as well, and update from db to youtube API once per day.

		// TODO: Update from DB here
		// localStoragePlaylists = await updateLocalStoragePlaylistFromApi(playlistId, localStoragePlaylists);
		console.log("Uploads playlist for this channel is outdated. Trying to update from the database...");
		playlistInfo = await tryUpdatePlaylistFromDB(uploadsPlaylistId, lastFetchedFromDB);

		// TODO: Handle case where the playlist no longer exists in the database
		// TODO: Update the lastFetchedFromDB field in the local storage
	}

	// TODO: Not modified below
	// Choose a random video from the playlist
	const randomVideo = playlistInfo["videos"][Math.floor(Math.random() * playlistInfo["videos"].length)];
	console.log("A random video has been chosen: " + randomVideo);

	// Navigate to the random video
	// window.location.href = "https://www.youtube.com/watch?v=" + randomVideo;
}

// Tries to fetch the playlist from local storage. If it is not present, returns an empty dictionary
async function tryGetPlaylistFromLocalStorage(playlistId) {
	let localStoragePlaylists = await chrome.storage.local.get(["uploadsPlaylists"]).then((result) => {
		if (result["uploadsPlaylists"]) {
			return result["uploadsPlaylists"];
		}
		return {};
	});

	// If the playlist is already saved in local storage, return it
	if (localStoragePlaylists[playlistId]) {
		return localStoragePlaylists[playlistId];
	}

	// The playlist does not exist locally
	return {};
}

// Tries to get the playlist from the database. If it is not present, returns an empty dictionary
async function tryGetPlaylistFromDB(playlistId) {
	const msg = {
		command: "getPlaylistFromDB",
		data: playlistId
	};

	return await chrome.runtime.sendMessage(msg) ?? {};
}

// OLD --------------------------------

async function getWholePlaylistFromAPI(playlistId) {
	// This function is only called if there is no playlist already saved in local storage
	let uploadsPlaylist = {
		"lastVideoPublishedAt": null,
		"lastUpdatedAt": new Date().toISOString(),
		"videos": []
	};
	let pageToken = "";

	// We also want to get the uploadTime of the most recent video
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
		if (result["uploadsPlaylists"]) {
			return result["uploadsPlaylists"];
		}
		return {};
	});

	localStoragePlaylists[playlistId] = uploadsPlaylist;

	// Update local storage
	await chrome.storage.local.set({ "uploadsPlaylists": localStoragePlaylists });

	// Update db
	const msg = {
		command: 'post',
		data: {
			key: "uploadsPlaylists/" + playlistId,
			val: uploadsPlaylist
		}
	};

	chrome.runtime.sendMessage(msg);

	return uploadsPlaylist;
}

async function updateLocalStoragePlaylistFromApi(playlistId, localStoragePlaylists) {
	let lastVideoPublishedAt = localStoragePlaylists[playlistId]["lastVideoPublishedAt"];
	let apiResponse = await getPlaylistSnippetFromAPI(playlistId, "");

	// Update the last video published at date (only for the most recent video)
	// If the newest video isn't newer than what we already have, we don't need to update the local storage
	if (lastVideoPublishedAt < apiResponse["items"][0]["contentDetails"]["videoPublishedAt"]) {
		console.log("At least one video has been published since the last check.");
		localStoragePlaylists[playlistId]["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	} else {
		console.log("No new videos have been published since the last check.");
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
	console.log("Setting locally");
	await chrome.storage.local.set({ "uploadsPlaylists": localStoragePlaylists })

	return localStoragePlaylists;
}

async function getPlaylistSnippetFromAPI(playlistId, pageToken) {
	// TODO: Better error handling for when this returns an error!
	await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=${pageToken}&playlistId=${playlistId}&key=${APIKey}`)
		.then((response) => response.json())
		.then((data) => apiResponse = data);

	if (apiResponse["error"]) {
		throw new YoutubeAPIError(apiResponse["error"]["code"], apiResponse["error"]["message"]);
	}
	return apiResponse;
}