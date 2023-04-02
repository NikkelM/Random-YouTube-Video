// Handles everything concerning the shuffling of videos, including sending messages to the backend database and the YouTube API

let configSync = null;

// For cases in which the playlist in the database has the old Array format (before v1.0.0), we need to overwrite it
let mustOverwriteDatabase = false;

// Chooses a random video uploaded on the current YouTube channel
async function chooseRandomVideo(channelId, firedFromPopup, progressTextElement) {
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
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-1",
				message: "No channel-ID found.",
				solveHint: "Please reload the page and try again. Please inform the developer if this keeps happening.",
				showTrace: false
			}
		);
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
			({ playlistInfo, userQuotaRemainingToday } = await getPlaylistFromAPI(uploadsPlaylistId, null, userQuotaRemainingToday, progressTextElement));

			shouldUpdateDatabase = true;
		} else if (databaseSharing && (playlistInfo["lastUpdatedDBAt"] ?? new Date(0).toISOString()) < addHours(new Date(), -48).toISOString()) {
			// If the playlist exists in the database but is outdated, update it from the API.
			console.log("Uploads playlist for this channel may be outdated in the database. Updating from the YouTube API...");

			({ playlistInfo, userQuotaRemainingToday } = await updatePlaylistFromAPI(playlistInfo, uploadsPlaylistId, null, userQuotaRemainingToday, progressTextElement));

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
			({ playlistInfo, userQuotaRemainingToday } = await getPlaylistFromAPI(uploadsPlaylistId, null, userQuotaRemainingToday, progressTextElement));

			shouldUpdateDatabase = true;
			// If the playlist exists in the database but is outdated there as well, update it from the API.
		} else if ((playlistInfo["lastUpdatedDBAt"] ?? new Date(0).toISOString()) < addHours(new Date(), -48).toISOString()) {
			console.log("Uploads playlist for this channel may be outdated in the database. Updating from the YouTube API...");
			({ playlistInfo, userQuotaRemainingToday } = await updatePlaylistFromAPI(playlistInfo, uploadsPlaylistId, null, userQuotaRemainingToday, progressTextElement));

			shouldUpdateDatabase = true;
		}
	}

	// Update the remaining user quota in the configSync
	await setSyncStorageValue("userQuotaRemainingToday", Math.max(0, userQuotaRemainingToday));

	({ randomVideo, playlistInfo, shouldUpdateDatabase, encounteredDeletedVideos } = await chooseRandomVideoFromPlaylist(playlistInfo, channelId, shouldUpdateDatabase));

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

		await uploadPlaylistToDatabase(playlistInfo, videosToDatabase, uploadsPlaylistId, mustOverwriteDatabase, encounteredDeletedVideos);

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

	configSync.numShuffledVideosTotal += 1;
	await setSyncStorageValue("numShuffledVideosTotal", configSync.numShuffledVideosTotal);

	playVideo(randomVideo, uploadsPlaylistId, firedFromPopup);
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
		console.log("The playlist was found in the database, but it is in an old format (before v1.0.0). Removing...");
		mustOverwriteDatabase = true;
		return {};
	}

	// In case the videos have the upload date AND time in the database (before v1.3.0), convert it to only the date
	if (playlistInfo && playlistInfo["videos"] && playlistInfo["videos"][Object.keys(playlistInfo["videos"])[0]].length > 10) {
		console.log("The playlist was found in the database, but it is in an old format (before v1.3.0). Updating format...");

		// Convert the videos to contain only the date
		for (const videoId in playlistInfo["videos"]) {
			playlistInfo["videos"][videoId] = playlistInfo["videos"][videoId].substring(0, 10);
		}

		await uploadPlaylistToDatabase(playlistInfo, playlistInfo["videos"], playlistId, true, false);
	}

	if (!playlistInfo) {
		return {};
	}

	playlistInfo["lastFetchedFromDB"] = new Date().toISOString();

	return playlistInfo;
}

// Upload a playlist to the database
async function uploadPlaylistToDatabase(playlistInfo, videosToDatabase, uploadsPlaylistId, mustOverwriteDatabase, encounteredDeletedVideos) {
	// Only upload the wanted keys
	const playlistInfoForDatabase = {
		"lastUpdatedDBAt": playlistInfo["lastUpdatedDBAt"],
		"lastVideoPublishedAt": playlistInfo["lastVideoPublishedAt"] ?? new Date(0).toISOString(),
		"videos": videosToDatabase
	};

	// Send the playlist info to the database
	const msg = {
		// mustOverwriteDatabase: In case the data is still in an old format, we need to overwrite it instead of updating
		command: (mustOverwriteDatabase || encounteredDeletedVideos) ? 'overwritePlaylistInfoInDB' : 'updatePlaylistInfoInDB',
		data: {
			key: 'uploadsPlaylists/' + uploadsPlaylistId,
			val: playlistInfoForDatabase
		}
	};

	await chrome.runtime.sendMessage(msg);
}

// ---------- YouTube API ----------

async function getPlaylistFromAPI(playlistId, useAPIKeyAtIndex, userQuotaRemainingToday, progressTextElement) {
	// Get an API key
	let { APIKey, isCustomKey, keyIndex } = await getAPIKey(useAPIKeyAtIndex);
	// We need to keep track of the original key's index, so we know when we have tried all keys
	const originalKeyIndex = keyIndex;

	// If the user does not use a custom API key and has no quota remaining, we cannot continue
	if (!isCustomKey && userQuotaRemainingToday <= 0) {
		console.log("You have exceeded your daily quota allocation for the YouTube API. You can try again tomorrow or provide a custom API key.");
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-4",
				message: "You have exceeded your daily quota allocation for the YouTube API.",
				solveHint: "You can try again tomorrow or provide a custom API key.",
				showTrace: false
			}
		);
	}

	let playlistInfo = {};

	let pageToken = "";

	let apiResponse = null;
	({ apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday } = await getPlaylistSnippetFromAPI(playlistId, pageToken, APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday));

	// Set the current progress as text for the shuffle button/info text
	const totalResults = apiResponse["pageInfo"]["totalResults"];
	let resultsFetchedCount = apiResponse["items"].length;

	// If there are less than 50 videos, we don't need to show a progress percentage
	if (totalResults > 50) {
		progressTextElement.innerText = `\xa0Fetching: ${Math.round(resultsFetchedCount / totalResults * 100)}%`;
	}

	// For each video, add an entry in the form of videoId: uploadTime
	playlistInfo["videos"] = Object.fromEntries(apiResponse["items"].map((video) => [video["contentDetails"]["videoId"], video["contentDetails"]["videoPublishedAt"].substring(0, 10)]));

	// We also want to get the uploadTime of the most recent video
	playlistInfo["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;

	while (pageToken !== null) {
		({ apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday } = await getPlaylistSnippetFromAPI(playlistId, pageToken, APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday));

		// Set the current progress as text for the shuffle button/info text
		// We never get to this code part if there are less than or exactly 50 videos in the playlist, so we don't need to check for that
		resultsFetchedCount += apiResponse["items"].length;
		progressTextElement.innerText = `\xa0Fetching: ${Math.round(resultsFetchedCount / totalResults * 100)}%`;

		// For each video, add an entry in the form of videoId: uploadTime
		playlistInfo["videos"] = Object.assign(playlistInfo["videos"], Object.fromEntries(apiResponse["items"].map((video) => [video["contentDetails"]["videoId"], video["contentDetails"]["videoPublishedAt"].substring(0, 10)])));

		pageToken = apiResponse["nextPageToken"] ? apiResponse["nextPageToken"] : null;
	}

	return { playlistInfo, userQuotaRemainingToday };
}

// Get snippets from the API as long as new videos are being found
async function updatePlaylistFromAPI(playlistInfo, playlistId, useAPIKeyAtIndex, userQuotaRemainingToday, progressTextElement) {
	// Get an API key
	let { APIKey, isCustomKey, keyIndex } = await getAPIKey(useAPIKeyAtIndex);
	// We need to keep track of the original key's index, so we know when we have tried all keys
	const originalKeyIndex = keyIndex;

	// If the user does not use a custom API key and has no quota remaining, we cannot continue
	if (!isCustomKey && userQuotaRemainingToday <= 0) {
		console.log("You have exceeded your daily quota allocation for the YouTube API. You can try again tomorrow or provide a custom API key.");
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-4",
				message: "You have exceeded your daily quota allocation for the YouTube API.",
				solveHint: "You can try again tomorrow or provide a custom API key.",
				showTrace: false
			}
		);
	}

	let lastKnownUploadTime = playlistInfo["lastVideoPublishedAt"];

	let apiResponse = null;
	({ apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday } = await getPlaylistSnippetFromAPI(playlistId, "", APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday));

	// Set the current progress as text for the shuffle button/info text
	const totalNewResults = apiResponse["pageInfo"]["totalResults"] - getLength(playlistInfo["videos"]);
	let resultsFetchedCount = apiResponse["items"].length;

	// If there are less than 50 new videos, we don't need to show a progress percentage
	if (totalNewResults > 50) {
		progressTextElement.innerText = `\xa0Fetching: ${Math.min(Math.round(resultsFetchedCount / totalNewResults * 100), 100)}%`;
	}

	// Update the "last video published at" date (only for the most recent video)
	// If the newest video isn't newer than what we already have, we don't need to update the local storage
	if (lastKnownUploadTime < apiResponse["items"][0]["contentDetails"]["videoPublishedAt"]) {
		console.log("At least one video has been published since the last check, updating video ID's...");
		playlistInfo["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	} else {
		console.log("No new videos have been published since the last check.");
		return { playlistInfo, userQuotaRemainingToday };
	}

	let currVideo = 0;
	let newVideos = {};

	// While the currently saved last video is older then the currently checked video from the API response, we need to add videos to local storage
	while (lastKnownUploadTime < apiResponse["items"][currVideo]["contentDetails"]["videoPublishedAt"]) {
		// Add the video to the newVideos object, with the videoId as key and the upload date (without time) as value
		newVideos[apiResponse["items"][currVideo]["contentDetails"]["videoId"]] = apiResponse["items"][currVideo]["contentDetails"]["videoPublishedAt"].substring(0, 10);

		currVideo++;

		// If the current page has been completely checked
		if (currVideo >= apiResponse["items"].length) {
			// If another page exists, continue checking
			if (apiResponse["nextPageToken"]) {

				// Get the next snippet	
				({ apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday } = await getPlaylistSnippetFromAPI(playlistId, apiResponse["nextPageToken"], APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday));

				// Set the current progress as text for the shuffle button/info text
				// We never get to this code part if there are less than or exactly 50 new videos, so we don't need to check for that
				resultsFetchedCount += apiResponse["items"].length;
				progressTextElement.innerText = `\xa0Fetching: ${Math.min(Math.round(resultsFetchedCount / totalNewResults * 100), 100)}%`;

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
	const originalUserQuotaRemainingToday = userQuotaRemainingToday;
	let apiResponse = null;

	// We wrap this in a while block to simulate a retry mechanism until we get a valid response
	while (true) {
		try {
			console.log("Getting snippet from YouTube API...");

			userQuotaRemainingToday--;

			await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=${pageToken}&playlistId=${playlistId}&key=${APIKey}`)
				.then((response) => response.json())
				.then((data) => apiResponse = data);

			if (apiResponse["error"]) {
				throw new YoutubeAPIError(
					code = apiResponse["error"]["code"],
					message = apiResponse["error"]["message"],
					reason = apiResponse["error"]["errors"][0]["reason"]
				);
			}

			break;
		} catch (error) {
			// We handle the case where an API key's quota was exceeded
			if (error instanceof YoutubeAPIError && error.code === 403 && error.reason === "quotaExceeded") {
				// We need to get another API key
				if (!isCustomKey) {
					console.log("Quota for this key was exceeded, refreshing API keys and trying again...");

					// In case this is something irregular, we want to check if anything has changed with the API keys now
					// We can force this by setting the nextAPIKeysCheckTime to a time in the past
					await setSyncStorageValue("nextAPIKeysCheckTime", Date.now() - 100);
					({ APIKey, isCustomKey, keyIndex } = await getAPIKey(keyIndex + 1));

					if (keyIndex === originalKeyIndex) {
						throw new RandomYoutubeVideoError(
							{
								code: "RYV-2",
								message: "All API keys have exceeded the allocated quota.",
								solveHint: "Please *immediately* inform the developer. You can try again tomorrow or provide a custom API key to immediately resolve this problem.",
								showTrace: false
							}
						);
					}
				} else {
					throw new RandomYoutubeVideoError(
						{
							code: "RYV-5",
							message: "Your custom API key has reached its daily quota allocation.",
							solveHint: "You must have watched a lot of videos to have this happen, or are using the API key for something else as well. You need to wait until the quota is reset or use a different API key.",
							showTrace: false
						}
					);
				}
			} else if (error instanceof YoutubeAPIError && error.code === 404 && error.reason === "playlistNotFound") {
				throw new RandomYoutubeVideoError(
					{
						code: "RYV-6A",
						message: "This channel has not uploaded any videos.",
						showTrace: false
					}
				);
			} else {
				throw error;
			}
		}
	}

	// If the user is using a custom key, we do not want to update the quota
	userQuotaRemainingToday = isCustomKey ? originalUserQuotaRemainingToday : userQuotaRemainingToday;

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

	// The response includes three parts: the API key, whether or not it is a custom key, and at which index of the list of API keys the current key is
	let { APIKey, isCustomKey, keyIndex } = await chrome.runtime.sendMessage(msg);

	if (!APIKey) {
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-3",
				message: "There are no API keys available in the database. This is due to an attacker using the API keys provided by the extension. Read the statement here: https://github.com/NikkelM/Random-YouTube-Video/issues/125",
				solveHint: "You can still use the extension by providing your custom API key via the popup. The attacker is not able to use that API key, as it is never transmitted to the extension's database.",
				showTrace: false
			}
		);
	}

	return { APIKey, isCustomKey, keyIndex };
}

async function chooseRandomVideoFromPlaylist(playlistInfo, channelId, shouldUpdateDatabase) {
	const videoShufflePercentage = configSync.channelSettings[channelId]?.shufflePercentage ?? 100;

	let allVideos = Object.assign({}, playlistInfo["videos"], playlistInfo["newVideos"]);
	let videosByDate = Object.keys(allVideos).sort((a, b) => {
		return new Date(allVideos[b]) - new Date(allVideos[a]);
	});

	let videosToShuffle = videosByDate.slice(0, Math.max(1, Math.ceil(videosByDate.length * (videoShufflePercentage / 100))));

	let randomVideo = videosToShuffle[Math.floor(Math.random() * videosToShuffle.length)];
	console.log(`A random video has been chosen: ${randomVideo}`);

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

			randomVideo = videosToShuffle[Math.floor(Math.random() * videosToShuffle.length)];

			console.log(`A new random video has been chosen: ${randomVideo}`);

			if (randomVideo === undefined) {
				throw new RandomYoutubeVideoError(
					{
						code: "RYV-6B",
						message: "All previously uploaded videos on this channel were deleted - the channel does not have any uploads.",
						showTrace: false
					}
				)
			}
		} while (!await testVideoExistence(randomVideo))

		// Update the database by removing the deleted videos there as well
		shouldUpdateDatabase = true;
	}

	return { randomVideo, playlistInfo, shouldUpdateDatabase, encounteredDeletedVideos };
}

function playVideo(randomVideo, uploadsPlaylistId, firedFromPopup) {
	// Get the correct URL format
	let randomVideoURL = configSync.shuffleOpenAsPlaylistOption
		? `https://www.youtube.com/watch?v=${randomVideo}&list=${uploadsPlaylistId}`
		: `https://www.youtube.com/watch?v=${randomVideo}`;

	// Open the video in a new tab or in the current tab, depending on the user's settings
	// If the shuffle button from the popup was used, we always open the video in the same tab (==the shuffling page)
	if (configSync.shuffleOpenInNewTabOption && !firedFromPopup) {
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
			// Any page: Pause the miniplayer if it exists and is playing
			const miniPlayer = document.querySelector('ytd-player#ytd-player')?.children[0]?.children[0];
			if (miniPlayer && miniPlayer.classList.contains('playing-mode')) {
				miniPlayer.children[0].click();
			}
		}

		window.open(randomVideoURL, '_blank').focus();

		// April fools joke: Users get rickrolled once on April 1st every year
		// If we open both videos in a new tab, we want the rickroll to be focused
		aprilFoolsJoke();
	} else {
		// Else, we need to open the rickroll first, as otherwise the function call doesn't happen
		aprilFoolsJoke();

		window.location.href = randomVideoURL;
	}
}

// Once per year on April first, rickroll the user
function aprilFoolsJoke() {
	const now = new Date();
	if (now.getMonth() === 3 && now.getDate() === 1 && configSync.wasLastRickRolledInYear !== now.getFullYear()) {
		configSync.wasLastRickRolledInYear = now.getFullYear();
		setSyncStorageValue("wasLastRickRolledInYear", now.getFullYear());

		window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", '_blank').focus();
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
