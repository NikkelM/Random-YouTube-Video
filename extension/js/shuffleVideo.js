// Handles everything concerning the shuffling of videos, including sending messages to the backend database and the YouTube API

let APIKey = null;
let configSync = null;

// Chooses a random video uploaded on the current YouTube channel
async function chooseRandomVideo() {
	await fetchConfigSync();
	// Make sure an API key is available
	await getAPIKey();

	// If we somehow update the playlist info and want to send it to the database in the end, this variable indicates it
	let shouldUpdateDatabase = false;

	// User preferences
	const databaseSharing = configSync.databaseSharingEnabledOption;

	// Get the id of the uploads playlist for this channel
	const uploadsPlaylistId = await getPlaylistIdFromUrl(window.location.href);
	if (!uploadsPlaylistId) {
		throw new RandomYoutubeVideoError("Could not find channel ID. Are you on a valid page?");
	}

	console.log(`Choosing a random video from playlist/channel: ${uploadsPlaylistId}`);

	// Check if the playlist is already saved in local storage, so we don't need to access the database
	let playlistInfo = await tryGetPlaylistFromLocalStorage(uploadsPlaylistId);

	// The playlist does not exist locally. Try to get it from the database first
	if (isEmpty(playlistInfo)) {
		// No information for this playlist is saved in local storage
		// Try to get it from the database
		console.log(`Uploads playlist for this channel does not exist locally.${databaseSharing ? " Trying to get it from the database..." : ""}`);
		playlistInfo = databaseSharing ? await tryGetPlaylistFromDB(uploadsPlaylistId) : {};

		// If the playlist does not exist in the database, get it from the API
		if (isEmpty(playlistInfo)) {
			console.log("Uploads playlist for this channel does not exist in the database. Fetching it from the YouTube API...");
			playlistInfo = await getPlaylistFromApi(uploadsPlaylistId);

			shouldUpdateDatabase = true;
		} else if (databaseSharing && (playlistInfo["lastUpdatedDBAt"] ?? new Date(0).toISOString()) < addHours(new Date(), -48).toISOString()) {
			// If the playlist exists in the database but is outdated, update it from the API.
			console.log("Uploads playlist for this channel may be outdated in the database. Updating from the YouTube API...");

			playlistInfo = await updatePlaylistFromApi(playlistInfo, uploadsPlaylistId);

			shouldUpdateDatabase = true;
		}

		console.log("Uploads playlist for this channel successfully retrieved.");

		// The playlist exists locally, but may be outdated. Update it from the database. If needed, update the database values as well.
	} else if ((databaseSharing && ((playlistInfo["lastFetchedFromDB"] ?? new Date(0).toISOString()) < addHours(new Date(), -48).toISOString())) ||
		(!databaseSharing && ((playlistInfo["lastAccessedLocally"] ?? new Date(0).toISOString()) < addHours(new Date(), -48).toISOString()))) {
		console.log(`Local uploads playlist for this channel may be outdated. ${databaseSharing ? "Updating from the database..." : ""}`);

		playlistInfo = databaseSharing ? await tryGetPlaylistFromDB(uploadsPlaylistId) : {};

		// The playlist does not exist in the database (==it was deleted since the user last fetched it). Get it from the API.
		// With the current functionality and db rules, this shouldn't happen, except if the user has opted out of database sharing.
		if (isEmpty(playlistInfo)) {
			console.log(`${databaseSharing ? "Uploads playlist for this channel does not exist in the database. " : "Fetching it from the YouTube API..."}`);
			playlistInfo = await getPlaylistFromApi(uploadsPlaylistId);

			shouldUpdateDatabase = true;
			// If the playlist exists in the database but is outdated there as well, update it from the API.
		} else if ((playlistInfo["lastUpdatedDBAt"] ?? new Date(0).toISOString()) < addHours(new Date(), -48).toISOString()) {
			console.log("Uploads playlist for this channel may be outdated in the database. Updating from the YouTube API...");
			playlistInfo = await updatePlaylistFromApi(playlistInfo, uploadsPlaylistId);

			shouldUpdateDatabase = true;
		}
	}

	// Choose a random video from the videos object, where the keys are the video IDs
	let videoIds = Object.keys(playlistInfo["videos"]) ?? [];
	// Append the new videos to the list of videos
	videoIds = videoIds.concat(Object.keys(playlistInfo["newVideos"] ?? {}));

	let randomVideo = videoIds[Math.floor(Math.random() * videoIds.length)];
	console.log("A random video has been chosen: " + randomVideo);

	let videoIDsToRemoveFromDB = [];
	// If the video does not exist, remove it from the playlist and choose a new one, until we find one that exists
	if (!await testVideoExistence(randomVideo)) {
		do {
			console.log("The chosen video does not exist anymore. Removing it from the database and choosing a new one...");
			videoIDsToRemoveFromDB.push(randomVideo);

			// Remove the video from the local playlist object
			// It will always be in the "videos" object, as we have just fetched the "newVideos" from the YouTube API
			delete playlistInfo["videos"][randomVideo];

			// Choose a new random video
			videoIds = Object.keys(playlistInfo["videos"]) ?? [];
			// Append the new videos to the list of videos
			videoIds = videoIds.concat(Object.keys(playlistInfo["newVideos"] ?? {}));

			randomVideo = videoIds[Math.floor(Math.random() * videoIds.length)];

			console.log(`A new random video has been chosen: ${randomVideo}`);
		} while (!await testVideoExistence(randomVideo))

		// Update the database by removing the deleted videos there as well
		shouldUpdateDatabase = true;
	}

	if (shouldUpdateDatabase && databaseSharing) {
		playlistInfo["lastUpdatedDBAt"] = new Date().toISOString();

		let videosToDatabase = {};
		// If any videos need to be deleted, this should be the union of videos, newvideos, minus the videos to delete
		if (videoIDsToRemoveFromDB.length > 0) {
			console.log("Some videos need to be deleted from the database. All current videos will be uploaded to the database...");
			videosToDatabase = Object.assign({}, playlistInfo["videos"], playlistInfo["newVideos"]);
			videoIDsToRemoveFromDB.forEach(videoID => delete videosToDatabase[videoID]);
		} else {
			// Otherwise, we want to only upload new videos. If there are no "newVideos", we upload all videos, as this is the first time we are uploading the playlist
			console.log("Uploading new video IDs to the database...");
			videosToDatabase = playlistInfo["newVideos"] ?? playlistInfo["videos"] ?? {};
		}

		// Only upload the wanted keys
		const playlistInfoForDatabase = {
			"lastUpdatedDBAt": playlistInfo["lastUpdatedDBAt"],
			"lastVideoPublishedAt": playlistInfo["lastVideoPublishedAt"] ?? new Date(0).toISOString(),
			"videos": videosToDatabase
		};

		// Send the playlist info to the database
		const msg = {
			command: videoIDsToRemoveFromDB.length > 0 ? 'overwritePlaylistInfoInDB' : 'updatePlaylistInfoInDB',
			data: {
				key: 'uploadsPlaylists/' + uploadsPlaylistId,
				val: playlistInfoForDatabase
			}
		};

		chrome.runtime.sendMessage(msg);

		// If we just updated the database, we automatically have the same version as it
		playlistInfo["lastFetchedFromDB"] = playlistInfo["lastUpdatedDBAt"];
	}

	// Update the playlist locally
	console.log("Saving playlist to local storage...");

	// If applicable, add all new videos to the videos object
	if (playlistInfo["newVideos"]) {
		for (const videoId in playlistInfo["newVideos"]) {
			playlistInfo["videos"][videoId] = true;
		}
		// remove the newVideos key
		delete playlistInfo["newVideos"];
	}

	// Only save the wanted keys
	playlistInfoForLocalStorage = {
		// Remember the last time the playlist was accessed locally (==now)
		"lastAccessedLocally": new Date().toISOString(),
		"lastFetchedFromDB": playlistInfo["lastFetchedFromDB"] ?? new Date(0).toISOString(),
		"lastVideoPublishedAt": playlistInfo["lastVideoPublishedAt"] ?? new Date(0).toISOString(),
		"videos": playlistInfo["videos"] ?? {}
	};

	await savePlaylistToLocalStorage(uploadsPlaylistId, playlistInfoForLocalStorage);

	// Navigate to the random video
	window.location.href = `https://www.youtube.com/watch?v=${randomVideo}&list=${uploadsPlaylistId}`;
}

// ---------- Database ----------

// Tries to get the playlist from the database. If it is not present, returns an empty dictionary
async function tryGetPlaylistFromDB(playlistId) {
	const msg = {
		command: "getPlaylistFromDB",
		data: playlistId
	};

	let playlistInfo = await chrome.runtime.sendMessage(msg);

	// TODO: Remove this in a future version
	// Backward compatibility for older format where videos = [id, id] instead of videos = {id: true, id: true}
	if (playlistInfo && playlistInfo["videos"] && Array.isArray(playlistInfo["videos"])) {
		console.log('The information for this playlist has an old format in the database. Updating it...');

		let videos = {};
		playlistInfo["videos"].forEach(video => videos[video] = true);
		playlistInfo["videos"] = videos;

		// Update the database entry with the new format
		// Only upload the wanted keys
		const playlistInfoForDatabase = {
			"lastUpdatedDBAt": playlistInfo["lastUpdatedDBAt"],
			"lastVideoPublishedAt": playlistInfo["lastVideoPublishedAt"] ?? new Date(0).toISOString(),
			"videos": videos
		};

		// Send the playlist info to the database
		const msg = {
			command: 'overwritePlaylistInfoInDB',
			data: {
				key: 'uploadsPlaylists/' + playlistId,
				val: playlistInfoForDatabase
			}
		};

		chrome.runtime.sendMessage(msg);
	}

	if (!playlistInfo) {
		return {};
	}

	playlistInfo["lastFetchedFromDB"] = new Date().toISOString();

	return playlistInfo;
}

// ---------- YouTube API ----------

async function getPlaylistFromApi(playlistId) {
	let playlistInfo = {};

	let pageToken = "";
	let apiResponse = await getPlaylistSnippetFromAPI(playlistId, pageToken);

	playlistInfo["videos"] = apiResponse["items"].map((video) => video["contentDetails"]["videoId"]);

	// We also want to get the uploadTime of the most recent video
	playlistInfo["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;

	while (pageToken !== null) {
		apiResponse = await getPlaylistSnippetFromAPI(playlistId, pageToken);

		playlistInfo["videos"] = playlistInfo["videos"].concat(apiResponse["items"].map((video) => video["contentDetails"]["videoId"]));

		pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;
	}

	// Turn the videos array into an object for easier handling in the database
	playlistInfo["videos"] = playlistInfo["videos"].reduce((obj, videoId) => {
		obj[videoId] = true;
		return obj;
	}, {});

	return playlistInfo;
}

// Get snippets from the API as long as new videos are being found
async function updatePlaylistFromApi(localPlaylist, playlistId) {
	let lastKnownUploadTime = localPlaylist["lastVideoPublishedAt"];
	let apiResponse = await getPlaylistSnippetFromAPI(playlistId, "");

	// Update the "last video published at" date (only for the most recent video)
	// If the newest video isn't newer than what we already have, we don't need to update the local storage
	if (lastKnownUploadTime < apiResponse["items"][0]["contentDetails"]["videoPublishedAt"]) {
		console.log("At least one video has been published since the last check, updating known video ID's...");
		localPlaylist["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	} else {
		console.log("No new videos have been published since the last check.");
		return localPlaylist;
	}

	let currVideo = 0;
	let newVideos = [];

	// While the currently saved last video is older then the currently checked video from the API response, we need to add videos to local storage
	while (lastKnownUploadTime < apiResponse["items"][currVideo]["contentDetails"]["videoPublishedAt"]) {
		newVideos.push(apiResponse["items"][currVideo]["contentDetails"]["videoId"]);

		currVideo++;

		// If the current page has been completely checked
		if (currVideo >= apiResponse["items"].length) {
			// If another page exists, continue checking
			if (apiResponse["nextPageToken"]) {

				// Get the next snippet
				apiResponse = await getPlaylistSnippetFromAPI(playlistId, apiResponse["nextPageToken"]);

				currVideo = 0;
				// Else, we have checked all videos
			} else {
				break;
			}
		}
	}
	console.log(`Found ${newVideos.length} new video(s).`);

	// Add the new videos to a new object within the localPlaylist
	localPlaylist["newVideos"] = newVideos.reduce((obj, videoId) => {
		obj[videoId] = true;
		return obj;
	}, {});

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

// ---------- Utility ----------

async function testVideoExistence(videoId) {
	try {
		await fetch(`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}&format=json`)
			.then((response) => response.json())
			.then((data) => apiResponse = data);
	} catch (error) {
		console.log(`Video doesn't exist: ${videoId}`);
		return false;
	}

	return true;
}

// Requests the API key from the background script
async function getAPIKey() {
	console.log('Getting API key...');

	const msg = {
		command: "getApiKey"
	};

	APIKey = await chrome.runtime.sendMessage(msg);

	if (!APIKey) {
		throw new RandomYoutubeVideoError("No API key! Please inform the developer if this keeps happening.");
	}
}

async function getPlaylistIdFromUrl(url) {
	let videoId = null;

	// if it's a video url, we can get the id from the url
	if (isVideoUrl(url)) { // || isPlaylistUrl || isShortsUrl
		videoId = url.split("v=")[1].split("&")[0];
		// Otherwise, we need to get some video link from the DOM
	} else {
		videoId = document.getElementById('youtube-random-video-shuffle-button-channel').children[0].children[0].children[0].children.namedItem('videoLink').innerHTML;
	}
	let apiResponse;

	await fetch(`https://youtube.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${APIKey}`)
		.then((response) => response.json())
		.then((data) => apiResponse = data);

	if (apiResponse["error"]) {
		throw new YoutubeAPIError(apiResponse["error"]["code"], apiResponse["error"]["message"]);
	}

	return apiResponse.items[0].snippet.channelId.replace("UC", "UU");
}

// ---------- Local storage ----------

// Tries to fetch the playlist from local storage. If it is not present, returns an empty dictionary
async function tryGetPlaylistFromLocalStorage(playlistId) {
	return await chrome.storage.local.get([playlistId]).then((result) => {
		if (result[playlistId]) {
			return result[playlistId];
		}
		return {};
	});
}

async function savePlaylistToLocalStorage(playlistId, playlistInfo) {
	await chrome.storage.local.set({ [playlistId]: playlistInfo });
}