// Handles everything concerning the shuffling of videos, including sending messages to the backend database and the YouTube API

let configSync = null;

// For cases in which the playlist in the database has the old Array format (before v1.0.0), we need to overwrite it
let mustOverwriteDatabase = false;

// Chooses a random video uploaded on the current YouTube channel
async function chooseRandomVideo(channelId) {
	// Make sure we have the latest config
	await fetchConfigSync();

	// Each user has a set amount of quota they can use per day.
	// If they exceed it, they need to provide a custom API key, or wait until the quota resets the next day.
	let userQuotaRemainingToday = await getUserQuotaRemainingToday(configSync);

	// If we somehow update the playlist info and want to send it to the database in the end, this variable indicates it
	let shouldUpdateDatabase = false;

	// User preferences
	const databaseSharing = configSync.databaseSharingEnabledOption;

	// Get the id of the uploads playlist for this channel
	const uploadsPlaylistId = channelId ? channelId.replace("UC", "UU") : null;
	if (!uploadsPlaylistId) {
		throw new RandomYoutubeVideoError(code = "RYV-1", message = "No channelID. Please reload page.");
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
			({ playlistInfo, userQuotaRemainingToday } = await getPlaylistFromAPI(uploadsPlaylistId, null, userQuotaRemainingToday));

			shouldUpdateDatabase = true;
		} else if (databaseSharing && (playlistInfo["lastUpdatedDBAt"] ?? new Date(0).toISOString()) < addHours(new Date(), -48).toISOString()) {
			// If the playlist exists in the database but is outdated, update it from the API.
			console.log("Uploads playlist for this channel may be outdated in the database. Updating from the YouTube API...");

			({ playlistInfo, userQuotaRemainingToday } = await updatePlaylistFromAPI(playlistInfo, uploadsPlaylistId, null, userQuotaRemainingToday));

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
			({ playlistInfo, userQuotaRemainingToday } = await getPlaylistFromAPI(uploadsPlaylistId, null, userQuotaRemainingToday));

			shouldUpdateDatabase = true;
			// If the playlist exists in the database but is outdated there as well, update it from the API.
		} else if ((playlistInfo["lastUpdatedDBAt"] ?? new Date(0).toISOString()) < addHours(new Date(), -48).toISOString()) {
			console.log("Uploads playlist for this channel may be outdated in the database. Updating from the YouTube API...");
			({ playlistInfo, userQuotaRemainingToday } = await updatePlaylistFromAPI(playlistInfo, uploadsPlaylistId, null, userQuotaRemainingToday));

			shouldUpdateDatabase = true;
		}
	}

	// Update the remaining user quota in the configSync
	await setSyncStorageValue("userQuotaRemainingToday", Math.max(0, userQuotaRemainingToday));

	// TODO: Maybe move this logic to a new function
	const videoShufflePercentage = configSync.channelSettings[channelId]?.shufflePercentage ?? 100;

	let allVideos = Object.assign({}, playlistInfo["videos"], playlistInfo["newVideos"]);
	let videosByDate = Object.keys(allVideos).sort((a, b) => {
		return new Date(allVideos[b]) - new Date(allVideos[a]);
	});

	let videosToShuffle = videosByDate.slice(0, Math.max(1, Math.ceil(videosByDate.length * (videoShufflePercentage / 100))));

	let randomVideo = chooseRandomVideoFromList(videosToShuffle);
	console.log("A random video has been chosen: " + randomVideo);

	let encounteredDeletedVideos = false;
	// If the video does not exist, remove it from the playlist and choose a new one, until we find one that exists
	if (!await testVideoExistence(randomVideo)) {
		encounteredDeletedVideos = true;
		do {
			console.log("The chosen video does not exist anymore. Removing it from the database and choosing a new one...");

			// Remove the video from the local playlist object
			// It will always be in the "videos" object, as we have just fetched the "newVideos" from the YouTube API
			delete playlistInfo["videos"][randomVideo];

			// Choose a new random video
			allVideos = Object.assign({}, playlistInfo["videos"], playlistInfo["newVideos"]);
			videosByDate = Object.keys(allVideos).sort((a, b) => {
				return new Date(allVideos[b]) - new Date(allVideos[a]);
			});

			videosToShuffle = videosByDate.slice(0, Math.max(1, Math.ceil(videosByDate.length * (videoShufflePercentage / 100))));

			randomVideo = chooseRandomVideoFromList(videosToShuffle);

			console.log(`A new random video has been chosen: ${randomVideo}`);
		} while (!await testVideoExistence(randomVideo))

		// Update the database by removing the deleted videos there as well
		shouldUpdateDatabase = true;
	}

	if (shouldUpdateDatabase && databaseSharing) {
		playlistInfo["lastUpdatedDBAt"] = new Date().toISOString();

		let videosToDatabase = {};
		// If any videos need to be deleted, this should be the union of videos, newvideos, minus the videos to delete
		if (encounteredDeletedVideos) {
			console.log("Some videos need to be deleted from the database. All current videos will be uploaded to the database...");
			videosToDatabase = Object.assign({}, playlistInfo["videos"], playlistInfo["newVideos"] ?? {});
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
			// mustOverwriteDatabase: In case the data is still in the old format, we need to overwrite it
			command: (encounteredDeletedVideos || mustOverwriteDatabase) ? 'overwritePlaylistInfoInDB' : 'updatePlaylistInfoInDB',
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

	// We can now join the new videos with the old ones
	playlistInfo["videos"] = Object.assign({}, playlistInfo["videos"], playlistInfo["newVideos"] ?? {});

	// Only save the wanted keys
	playlistInfoForLocalStorage = {
		// Remember the last time the playlist was accessed locally (==now)
		"lastAccessedLocally": new Date().toISOString(),
		"lastFetchedFromDB": playlistInfo["lastFetchedFromDB"] ?? new Date(0).toISOString(),
		"lastVideoPublishedAt": playlistInfo["lastVideoPublishedAt"] ?? new Date(0).toISOString(),
		"videos": playlistInfo["videos"] ?? {}
	};

	await savePlaylistToLocalStorage(uploadsPlaylistId, playlistInfoForLocalStorage);

	playVideo(randomVideo, uploadsPlaylistId);
}

// ---------- Database ----------

// Try to get the playlist from the database. If it does not exist, return an empty dictionary.
async function tryGetPlaylistFromDB(playlistId) {
	const msg = {
		command: "getPlaylistFromDB",
		data: playlistId
	};

	let playlistInfo = await chrome.runtime.sendMessage(msg);

	// In case the playlist is still in the old Array format (before v1.0.0) in the database, convert it to the new format
	if (playlistInfo && playlistInfo["videos"] && Array.isArray(playlistInfo["videos"])) {
		console.log("The playlist was found in the database, but it is in an old format (before v1.0.0). Updating format...");
		mustOverwriteDatabase = true;
		return {};
	}

	if (!playlistInfo) {
		return {};
	}

	playlistInfo["lastFetchedFromDB"] = new Date().toISOString();

	return playlistInfo;
}

// ---------- YouTube API ----------

async function getPlaylistFromAPI(playlistId, useAPIKeyAtIndex, userQuotaRemainingToday) {
	// Get an API key
	let { APIKey, isCustomKey, keyIndex } = await getAPIKey(useAPIKeyAtIndex);
	// We need to keep track of the original key's index, so we know when we have tried all keys
	const originalKeyIndex = keyIndex;

	// If the user does not use a custom API key and has no quota remaining, we cannot continue
	if (!isCustomKey && userQuotaRemainingToday <= 0) {
		console.log("You have exceeded your daily quota allocation. You can try again tomorrow.");
		throw new RandomYoutubeVideoError(code = "RYV-DailyQuota", message = "You have exceeded your daily quota allocation. You can try again tomorrow.");
	}

	let playlistInfo = {};

	let pageToken = "";

	let apiResponse = null;
	({ apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday } = await getPlaylistSnippetFromAPI(playlistId, pageToken, APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday));

	// For each video, add an entry in the form of videoId: uploadTime
	playlistInfo["videos"] = Object.fromEntries(apiResponse["items"].map((video) => [video["contentDetails"]["videoId"], video["contentDetails"]["videoPublishedAt"]]));

	// We also want to get the uploadTime of the most recent video
	playlistInfo["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;

	while (pageToken !== null) {
		({ apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday } = await getPlaylistSnippetFromAPI(playlistId, pageToken, APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday));

		// For each video, add an entry in the form of videoId: uploadTime
		playlistInfo["videos"] = Object.assign(playlistInfo["videos"], Object.fromEntries(apiResponse["items"].map((video) => [video["contentDetails"]["videoId"], video["contentDetails"]["videoPublishedAt"]])));

		pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;
	}

	return { playlistInfo, userQuotaRemainingToday };
}

// Get snippets from the API as long as new videos are being found
async function updatePlaylistFromAPI(playlistInfo, playlistId, useAPIKeyAtIndex, userQuotaRemainingToday) {
	// Get an API key
	let { APIKey, isCustomKey, keyIndex } = await getAPIKey(useAPIKeyAtIndex);
	// We need to keep track of the original key's index, so we know when we have tried all keys
	const originalKeyIndex = keyIndex;

	// If the user does not use a custom API key and has no quota remaining, we cannot continue
	if (!isCustomKey && userQuotaRemainingToday <= 0) {
		console.log("You have exceeded your daily quota allocation. You can try again tomorrow.");
		throw new RandomYoutubeVideoError(code = "RYV-DailyQuota", message = "You have exceeded your daily quota allocation. You can try again tomorrow.");
	}

	let lastKnownUploadTime = playlistInfo["lastVideoPublishedAt"];

	let apiResponse = null;
	({ apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday } = await getPlaylistSnippetFromAPI(playlistId, "", APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday));

	// Update the "last video published at" date (only for the most recent video)
	// If the newest video isn't newer than what we already have, we don't need to update the local storage
	if (lastKnownUploadTime < apiResponse["items"][0]["contentDetails"]["videoPublishedAt"]) {
		console.log("At least one video has been published since the last check, updating known video ID's...");
		playlistInfo["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	} else {
		console.log("No new videos have been published since the last check.");
		return { playlistInfo, userQuotaRemainingToday };
	}

	let currVideo = 0;
	let newVideos = {};

	// While the currently saved last video is older then the currently checked video from the API response, we need to add videos to local storage
	while (lastKnownUploadTime < apiResponse["items"][currVideo]["contentDetails"]["videoPublishedAt"]) {
		// Add the video to the newVideos object
		newVideos[apiResponse["items"][currVideo]["contentDetails"]["videoId"]] = apiResponse["items"][currVideo]["contentDetails"]["videoPublishedAt"];

		currVideo++;

		// If the current page has been completely checked
		if (currVideo >= apiResponse["items"].length) {
			// If another page exists, continue checking
			if (apiResponse["nextPageToken"]) {

				// Get the next snippet	
				({ apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday } = await getPlaylistSnippetFromAPI(playlistId, apiResponse["nextPageToken"], APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday));

				currVideo = 0;
				// Else, we have checked all videos
			} else {
				break;
			}
		}
	}
	console.log(`Found ${Object.keys(newVideos).length} new video(s).`);

	// Add the new videos to a new key within the playlistInfo
	playlistInfo["newVideos"] = newVideos;

	return { playlistInfo, userQuotaRemainingToday };
}

// Send a request to the Youtube API to get a snippet of a playlist
async function getPlaylistSnippetFromAPI(playlistId, pageToken, APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday) {
	let apiResponse = null;

	// We wrap this in a while block to simulate a retry mechanism until we get a valid response
	while (true) {
		try {
			console.log("Getting snippet from YouTube API...");

			if (!isCustomKey) {
				userQuotaRemainingToday--;
			}

			await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=${pageToken}&playlistId=${playlistId}&key=${APIKey}`)
				.then((response) => response.json())
				.then((data) => apiResponse = data);

			if (apiResponse["error"]) {
				throw new YoutubeAPIError(code = apiResponse["error"]["code"], message = apiResponse["error"]["message"], reason = apiResponse["error"]["errors"][0]["reason"]);
			}

			break;
		} catch (error) {
			// We handle the case where an API key's quota was exceeded
			if (error instanceof YoutubeAPIError && error.code === 403 && error.reason === "quotaExceeded") {
				// We need to get another API key
				if (!isCustomKey) {
					console.log("Quota for this key was exceeded, trying another API key...");
					({ APIKey, isCustomKey, keyIndex } = await getAPIKey(keyIndex + 1));
					if (keyIndex === originalKeyIndex) {
						console.log("All API keys have exceeded the allocated quota. Please inform the developer.");
						throw new RandomYoutubeVideoError(code = "RYV-2", message = "All API keys have exceeded the allocated quota. Please inform the developer.");
					}
				} else {
					console.log("You have exceeded the quota of your custom API key. You need to wait until the quota is reset, or use a different API key.");
					throw error;
				}
			}
		}
	}

	return { apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday };
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
async function getAPIKey(useAPIKeyAtIndex = null) {
	const msg = {
		command: "getAPIKey",
		data: {
			useAPIKeyAtIndex: useAPIKeyAtIndex
		}
	};

	// The response includes three parts: the API key, whether or not it is a custom key, and if it is not, at which index of the list of API keys the current key is
	let { APIKey, isCustomKey, keyIndex } = await chrome.runtime.sendMessage(msg);

	if (!APIKey) {
		throw new RandomYoutubeVideoError(code = "RYV-3", message = "No API key available! Please inform the developer.");
	}

	return { APIKey, isCustomKey, keyIndex };
}

function chooseRandomVideoFromList(videoIds) {
	let randomVideo = videoIds[Math.floor(Math.random() * videoIds.length)];
	return randomVideo;
}

function playVideo(randomVideo, uploadsPlaylistId) {
	// Get the correct URL format
	let randomVideoURL = configSync.shuffleOpenAsPlaylistOption ? `https://www.youtube.com/watch?v=${randomVideo}&list=${uploadsPlaylistId}` : `https://www.youtube.com/watch?v=${randomVideo}`;

	// Open the video in a new tab or in the current tab, depending on the user's settings
	if (configSync.shuffleOpenInNewTabOption) {
		// Video page: Pause the current video if it is playing
		if (isVideoUrl(window.location.href)) {
			const player = document.querySelector('ytd-player#ytd-player')?.children[0]?.children[0];
			if (player.classList.contains('playing-mode')) {
				player.children[0].click();
			}
		} else {
			// Channel page: Pause the featured video if it exists and is playing
			const featuredPlayer = document.querySelector('ytd-player#player')?.children[0]?.children[0];
			if (featuredPlayer && featuredPlayer.classList.contains('playing-mode')) {
				featuredPlayer.children[0].click();
			}
			// Channel page: Pause the miniplayer if it exists and is playing
			const miniPlayer = document.querySelector('ytd-player#ytd-player')?.children[0]?.children[0];
			if (miniPlayer && miniPlayer.classList.contains('playing-mode')) {
				miniPlayer.children[0].click();
			}
		}

		window.open(randomVideoURL, '_blank').focus();
	} else {
		window.location.href = randomVideoURL;
	}
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