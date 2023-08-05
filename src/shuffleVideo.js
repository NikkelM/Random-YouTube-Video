// Handles everything concerning the shuffling of videos, including fetching data from the YouTube API
import {
	isEmpty,
	addHours,
	getLength,
	isVideoUrl,
	RandomYoutubeVideoError,
	YoutubeAPIError
} from "./utils.js";
import { configSync, setSyncStorageValue, getUserQuotaRemainingToday } from "./chromeStorage.js";

// --------------- Public ---------------
// Chooses a random video uploaded on the current YouTube channel
export async function chooseRandomVideo(channelId, firedFromPopup, progressTextElement) {
	/* c8 ignore start */
	try {
		// The service worker will get stopped after 30 seconds
		// This request will cause a "Receiving end does not exist" error, but starts the worker again as well
		await chrome.runtime.sendMessage({ command: "connectionTest" });
	} catch (error) {
		console.log("The service worker was stopped and had to be restarted.");
	}
	try {
		// While chooseRandomVideo is running, we need to keep the service worker alive
		// Otherwise, it will get stopped after 30 seconds and we will get an error if fetching the videos takes longer
		var keepServiceWorkerAlive = setInterval(() => {
			chrome.runtime.sendMessage({ command: "connectionTest" });
		}, 25000);
		/* c8 ignore stop */

		// Each user has a set amount of quota they can use per day.
		// If they exceed it, they need to provide a custom API key, or wait until the quota resets the next day.
		let userQuotaRemainingToday = await getUserQuotaRemainingToday();

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

		console.log(`Shuffling from playlist/channel: ${uploadsPlaylistId}`);

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
				if (databaseSharing) {
					console.log("Uploads playlist for this channel does not exist in the database. Fetching it from the YouTube API...");
				} else {
					console.log("Fetching the uploads playlist for this channel from the YouTube API...");
				}
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
			console.log(`Local uploads playlist for this channel may be outdated.${databaseSharing ? " Updating from the database..." : ""}`);

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

		// To prevent potential TypeErrors later on, assign an empty newVideos object if it doesn't exist
		if (!playlistInfo["newVideos"]) {
			playlistInfo["newVideos"] = {};
		}

		let chosenVideos, encounteredDeletedVideos;
		({ chosenVideos, playlistInfo, shouldUpdateDatabase, encounteredDeletedVideos } = await chooseRandomVideosFromPlaylist(playlistInfo, channelId, shouldUpdateDatabase));

		if (shouldUpdateDatabase && databaseSharing) {
			console.log("Updating the database with the new playlist information...");

			playlistInfo["lastUpdatedDBAt"] = new Date().toISOString();

			let videosToDatabase = {};
			// If any videos need to be deleted, this should be the union of videos, newvideos, minus the videos to delete
			if (encounteredDeletedVideos) {
				console.log("Some videos need to be deleted from the database. All current videos will be uploaded to the database...");
				videosToDatabase = Object.assign({}, playlistInfo["videos"], playlistInfo["newVideos"] ?? {});
			} else {
				// Otherwise, we want to only upload new videos. If there are no "newVideos", we upload all videos, as this is the first time we are uploading the playlist
				console.log("Uploading new video IDs to the database...");
				if(getLength(playlistInfo["newVideos"] ?? {}) > 0) {
					videosToDatabase = playlistInfo["newVideos"];
				} else {
					videosToDatabase = playlistInfo["videos"] ?? 0;
				}
				// videosToDatabase = playlistInfo["newVideos"] ?? playlistInfo["videos"] ?? {};
			}

			await uploadPlaylistToDatabase(playlistInfo, videosToDatabase, uploadsPlaylistId, encounteredDeletedVideos);

			// If we just updated the database, we automatically have the same version as it
			playlistInfo["lastFetchedFromDB"] = new Date().toISOString();
		}

		// Update the playlist locally
		console.log("Saving playlist to local storage...");

		// We can now join the new videos with the old ones
		playlistInfo["videos"] = Object.assign({}, playlistInfo["videos"], playlistInfo["newVideos"] ?? {});

		// Only save the wanted keys
		const playlistInfoForLocalStorage = {
			// Remember the last time the playlist was accessed locally (==now)
			"lastAccessedLocally": new Date().toISOString(),
			"lastFetchedFromDB": playlistInfo["lastFetchedFromDB"] ?? new Date(0).toISOString(),
			"lastVideoPublishedAt": playlistInfo["lastVideoPublishedAt"] ?? new Date(0).toISOString().slice(0, 19) + 'Z',
			"videos": playlistInfo["videos"] ?? {}
		};

		await savePlaylistToLocalStorage(uploadsPlaylistId, playlistInfoForLocalStorage);

		await setSyncStorageValue("numShuffledVideosTotal", configSync.numShuffledVideosTotal + 1);

		await playVideo(chosenVideos, firedFromPopup);
	} catch (error) {
		await setSyncStorageValue("userQuotaRemainingToday", Math.max(0, configSync.userQuotaRemainingToday - 1));
		throw error;
	} finally {
		clearInterval(keepServiceWorkerAlive);
	}
}

// --------------- Private ---------------
// ---------- Database ----------
// Try to get the playlist from the database. If it does not exist, return an empty dictionary.
async function tryGetPlaylistFromDB(playlistId) {
	const msg = {
		command: "getPlaylistFromDB",
		data: playlistId
	};

	let playlistInfo = await chrome.runtime.sendMessage(msg);

	/* c8 ignore start - These are legacy conversions we don't want to test */
	// In case the playlist is still in the old Array format (before v1.0.0) in the database, convert it to the new format
	if (playlistInfo && playlistInfo["videos"] && Array.isArray(playlistInfo["videos"])) {
		console.log("The playlist was found in the database, but it is in an old format (before v1.0.0). Removing...");

		await chrome.runtime.sendMessage({ command: 'updateDBPlaylistToV1.0.0', data: { key: playlistId } });
		return {};
	}

	// In case the videos have the upload date AND time in the database (before v1.3.0), convert it to only the date
	if (playlistInfo && playlistInfo["videos"] && typeof playlistInfo["videos"] === "string" && playlistInfo["videos"][Object.keys(playlistInfo["videos"])[0]].length > 10) {
		console.log("The playlist was found in the database, but it is in an old format (before v1.3.0). Updating format...");

		// Convert the videos to contain only the date
		for (const videoId in playlistInfo["videos"]) {
			playlistInfo["videos"][videoId] = playlistInfo["videos"][videoId].substring(0, 10);
		}
	}
	/* c8 ignore stop */

	if (!playlistInfo) {
		return {};
	}

	if (!playlistInfo["videos"]) {
		// Due to some mistake, there is no video data in the database
		// Overwrite the playlist with an empty one
		console.log("The playlist was found in the database, but it is empty. Removing...");
		await uploadPlaylistToDatabase({}, {}, playlistId, true);
		return {};
	}

	playlistInfo["lastFetchedFromDB"] = new Date().toISOString();

	return playlistInfo;
}

// Upload a playlist to the database
async function uploadPlaylistToDatabase(playlistInfo, videosToDatabase, uploadsPlaylistId, encounteredDeletedVideos) {
	// Only upload the wanted keys
	const playlistInfoForDatabase = {
		"lastUpdatedDBAt": playlistInfo["lastUpdatedDBAt"] ?? new Date().toISOString(),
		"lastVideoPublishedAt": playlistInfo["lastVideoPublishedAt"] ?? new Date(0).toISOString().slice(0, 19) + 'Z',
		"videos": videosToDatabase
	};

	// Send the playlist info to the database
	const msg = {
		command: encounteredDeletedVideos ? 'overwritePlaylistInfoInDB' : 'updatePlaylistInfoInDB',
		data: {
			key: uploadsPlaylistId,
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
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-4A",
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

	// If there are more results we need to fetch than the user has quota remaining (+leeway) and the user is not using a custom API key, we need to throw an error
	const totalResults = apiResponse["pageInfo"]["totalResults"];
	if (totalResults / 50 >= userQuotaRemainingToday + 50 && !isCustomKey) {
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-4B",
				message: `The channel you are shuffling from has too many uploads (${totalResults}) for the amount of API requests you can make. To protect the userbase, each user has a limited amount of requests they can make per day.`,
				solveHint: "To shuffle from channels with more uploads, please use a custom API key.",
				showTrace: false
			}
		);
	}

	// The YouTube API limits the number of videos that can be fetched for uploads playlists to 20,000
	// If it seems that such a limitation is in place, we want to alert the user to it
	if (totalResults >= 19999) {
		window.alert("NOTICE: The channel you are shuffling from has a lot of uploads (20,000+). The YouTube API only allows fetching the most recent 20,000 videos, which means that older uploads will not be shuffled from. This limitation is in place no matter if you use a custom API key or not.\n\nThe extension will now fetch all videos it can get from the API.");
	}

	// Set the current progress as text for the shuffle button/info text
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
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-4A",
				message: "You have exceeded your daily quota allocation for the YouTube API.",
				solveHint: "You can try again tomorrow or provide a custom API key.",
				showTrace: false
			}
		);
	}

	let lastKnownUploadTime = playlistInfo["lastVideoPublishedAt"];

	let apiResponse = null;
	({ apiResponse, APIKey, isCustomKey, keyIndex, userQuotaRemainingToday } = await getPlaylistSnippetFromAPI(playlistId, "", APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday));

	const totalNumVideosOnChannel = apiResponse["pageInfo"]["totalResults"];
	// If the channel has already reached the API cap, we don't know how many new videos there are, so we put an estimate to show the user something
	// The difference could be negative if there are more videos saved in the database than exist in the playlist, e.g videos were deleted
	const numLocallyKnownVideos = getLength(playlistInfo["videos"]);
	const totalExpectedNewResults = totalNumVideosOnChannel > 19999 ? 1000 : Math.max(totalNumVideosOnChannel - numLocallyKnownVideos, 0);

	// If there are more results we need to fetch than the user has quota remaining (+leeway) and the user is not using a custom API key, we need to throw an error
	if (totalExpectedNewResults / 50 >= userQuotaRemainingToday + 50 && !isCustomKey) {
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-4B",
				message: `The channel you are shuffling from has too many new uploads (${totalExpectedNewResults}) for the amount of API requests you can make. To protect the userbase, each user has a limited amount of requests they can make per day.`,
				solveHint: "To shuffle from channels with more uploads, please use a custom API key.",
				showTrace: false
			}
		);
	}

	// Set the current progress as text for the shuffle button/info text
	let resultsFetchedCount = apiResponse["items"].length;

	// If there are less than 50 new videos, we don't need to show a progress percentage
	if (totalExpectedNewResults > 50) {
		progressTextElement.innerText = `\xa0Fetching: ${Math.min(Math.round(resultsFetchedCount / totalExpectedNewResults * 100), 100)}%`;
	}

	// Update the "last video published at" date (only for the most recent video)
	// If the newest video isn't newer than what we already have, we don't need to update the local storage
	if (lastKnownUploadTime < apiResponse["items"][0]["contentDetails"]["videoPublishedAt"]) {
		console.log("At least one video has been published since the last check, updating video ID's...");
		playlistInfo["lastVideoPublishedAt"] = apiResponse["items"][0]["contentDetails"]["videoPublishedAt"];
	} else {
		console.log("No new videos have been published since the last check.");

		// Make sure that we are not missing any videos in the database
		if (totalNumVideosOnChannel > numLocallyKnownVideos) {
			console.log(`There are less videos saved in the database than are uploaded on the channel (${numLocallyKnownVideos}/${totalNumVideosOnChannel}), so some videos are missing. Refetching all videos...`);
			return await getPlaylistFromAPI(playlistId, keyIndex, userQuotaRemainingToday, progressTextElement);
		}

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
				progressTextElement.innerText = `\xa0Fetching: ${Math.min(Math.round(resultsFetchedCount / totalExpectedNewResults * 100), 100)}%`;

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

	// Make sure that we are not missing any videos in the database
	const numVideosInDatabase = numLocallyKnownVideos + getLength(playlistInfo["newVideos"]);
	if (totalNumVideosOnChannel > numVideosInDatabase) {
		console.log(`There are less videos saved in the database than are uploaded on the channel (${numVideosInDatabase}/${totalNumVideosOnChannel}), so some videos are missing. Refetching all videos...`);
		return await getPlaylistFromAPI(playlistId, keyIndex, userQuotaRemainingToday, progressTextElement);
	}

	return { playlistInfo, userQuotaRemainingToday };
}

// Send a request to the Youtube API to get a snippet of a playlist
async function getPlaylistSnippetFromAPI(playlistId, pageToken, APIKey, isCustomKey, keyIndex, originalKeyIndex, userQuotaRemainingToday) {
	const originalUserQuotaRemainingToday = userQuotaRemainingToday;
	let apiResponse = null;

	// We wrap this in a while block to simulate a retry mechanism until we get a valid response
	/* eslint no-constant-condition: ["error", { "checkLoops": false }] */
	while (true) {
		try {
			console.log("Getting snippet from YouTube API...");

			await fetch(`https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=${pageToken}&playlistId=${playlistId}&key=${APIKey}`)
				.then((response) => response.json())
				.then((data) => apiResponse = data);

			if (apiResponse["error"]) {
				throw new YoutubeAPIError(
					apiResponse["error"]["code"],
					apiResponse["error"]["message"],
					apiResponse["error"]["errors"][0]["reason"],
					"",
					false
				);
			}

			// We allow users to go beyond the daily limit in case there are only a few more videos to be fetched.
			// But if it goes too far, we need to cancel the operation.
			userQuotaRemainingToday--;
			if (userQuotaRemainingToday <= -50) {
				throw new RandomYoutubeVideoError(
					{
						code: "RYV-4B",
						message: "The channel you are shuffling from has too many uploads for the amount of API requests you can make. To protect the userbase, each user has a limited amount of requests they can make per day.",
						solveHint: "To shuffle from channels with more uploads, please use a custom API key.",
						showTrace: false
					}
				);
			}

			break;
		} catch (error) {
			// Immediately set the user quota in sync storage, as we won't be able to do so correctly later due to the error
			// We will set it again in the error handler and remove 1 from it, so we need to add 1 here to compensate
			await setSyncStorageValue("userQuotaRemainingToday", Math.max(0, Math.min(200, userQuotaRemainingToday + 1)));

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
							solveHint: "This can easily happen if the channels you are shuffling from have a lot of uploads, or if you are using the API key for something else as well. You need to wait until the quota is reset or use a different API key.",
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
	let videoExists;

	try {
		let response = await fetch(`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}&format=json`, {
			method: "HEAD"
		});

		// 401 unauthorized means the video may exist, but cannot be embedded
		// As an alternative, we check if a thumbnail exists for this video id
		if (response.status === 401) {
			let thumbResponse = await fetch(`https://img.youtube.com/vi/${videoId}/0.jpg`, {
				method: "HEAD"
			});

			if (thumbResponse.status !== 200) {
				console.log(`Video doesn't exist: ${videoId}`);
				videoExists = false;
			} else {
				videoExists = true;
			}
		} else if (response.status !== 200) {
			console.log(`Video doesn't exist: ${videoId}`);
			videoExists = false;
		} else {
			videoExists = true;
		}
	} catch (error) {
		console.log(`Video doesn't exist: ${videoId}`);
		videoExists = false;
	}

	return videoExists;
}

async function isShort(videoId) {
	let videoIsShort;
	try {
		await fetch(`https://www.youtube.com/oembed?url=http://www.youtube.com/shorts/${videoId}&format=json`, {
			method: "GET"
		}).then(res => res.json())
			.then(res => {
				if (res.thumbnail_url.endsWith("hq2.jpg")) {
					videoIsShort = true;
				} else {
					videoIsShort = false;
				}
			});
		// We get an 'Unauthorized' response if the video cannot be embedded, which cannot be parsed as JSON using res.json()
		// This fallback tests if we get redirected to a normal video page, which means the video is not a short, but this takes longer
	} catch (error) {
		await fetch(`https://www.youtube.com/shorts/${videoId}`)
			.then(res => {
				if (res.redirected) {
					videoIsShort = false;
				} else {
					videoIsShort = true;
				}
			});
	}
	return videoIsShort;
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
				message: "There are no API keys available in the database. It may be that they were removed for security reasons.",
				solveHint: "Please check back later if this has been resolved, otherwise contact the developer. You can always use the extension by providing your custom API key via the popup, which is never uploaded to the extension's database.",
				showTrace: false
			}
		);
	}

	return { APIKey, isCustomKey, keyIndex };
}

async function chooseRandomVideosFromPlaylist(playlistInfo, channelId, shouldUpdateDatabase) {
	let activeShuffleFilterOption = configSync.channelSettings[channelId]?.activeOption ?? "allVideosOption";
	let activeOptionValue;

	switch (activeShuffleFilterOption) {
		case "allVideosOption":
			activeOptionValue = null;
			break;
		case "dateOption":
			activeOptionValue = configSync.channelSettings[channelId]?.dateValue;
			break;
		case "videoIdOption":
			activeOptionValue = configSync.channelSettings[channelId]?.videoIdValue;
			break;
		case "percentageOption":
			// The default is 100%, and we remove the setting from storage if it is 100% to save space
			activeOptionValue = configSync.channelSettings[channelId]?.percentageValue ?? 100;
			break;
	}

	// If there is no value set for the active option, we alert the user
	if (activeOptionValue === undefined) {
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-7",
				message: `You have set an option to filter the videos that are shuffled (${activeShuffleFilterOption}), but no value for the option is set.`,
				solveHint: "Please set a value for the active shuffle filter option in the popup, e.g. a valid date or video ID.",
				showTrace: false
			}
		);
	}

	// Sort all videos by date
	let allVideos = Object.assign({}, playlistInfo["videos"], playlistInfo["newVideos"] ?? {});

	let videosByDate = Object.keys(allVideos).sort((a, b) => {
		return new Date(allVideos[b]) - new Date(allVideos[a]);
	});

	// Error handling for videosToShuffle being undefined/empty is done in applyShuffleFilter()
	let videosToShuffle = applyShuffleFilter(allVideos, videosByDate, activeShuffleFilterOption, activeOptionValue);

	let chosenVideos = [];
	let randomVideo;
	let encounteredDeletedVideos = false;

	const numVideosToChoose = configSync.shuffleOpenAsPlaylistOption ? configSync.shuffleNumVideosInPlaylist : 1;

	console.log(`Choosing ${numVideosToChoose} random video${numVideosToChoose > 1 ? "s" : ""}.`);

	// We use this label to break out of both the for loop and the while loop if there are no more videos after encountering a deleted video
	outerLoop:
	for (let i = 0; i < numVideosToChoose; i++) {
		if (videosToShuffle.length === 0) {
			// All available videos were chosen from, so we need to terminate the loop early
			console.log(`No more videos to choose from (${numVideosToChoose - i} videos too few uploaded on channel).`);
			break outerLoop;
		}

		randomVideo = videosToShuffle[Math.floor(Math.random() * videosToShuffle.length)];

		// If the video does not exist, remove it from the playlist and choose a new one, until we find one that exists
		if (!await testVideoExistence(randomVideo)) {
			encounteredDeletedVideos = true;
			// Update the database by removing the deleted videos there as well
			shouldUpdateDatabase = true;
			do {
				// Remove the video from the local playlist object
				// It will always be in the "videos" object, as we have just fetched the "newVideos" from the YouTube API
				delete playlistInfo["videos"][randomVideo];

				// Remove the deleted video from the videosToShuffle array and choose a new random video
				videosToShuffle.splice(videosToShuffle.indexOf(randomVideo), 1);
				randomVideo = videosToShuffle[Math.floor(Math.random() * videosToShuffle.length)];

				console.log(`The chosen video does not exist anymore, so it will be removed from the database. A new random video has been chosen: ${randomVideo}`);

				if (randomVideo === undefined) {
					// If we haven't chosen any videos yet, the channel does not contain any videos
					if (chosenVideos.length === 0) {
						throw new RandomYoutubeVideoError(
							{
								code: "RYV-6B",
								message: "All previously uploaded videos on this channel were deleted (the channel does not have any uploads) or you are ignoring shorts and the channel has only uploaded shorts.",
								solveHint: "If you are ignoring shorts, disable the option in the popup to shuffle from this channel.",
								showTrace: false
							}
						)
						// If we have chosen at least one video, we just return those
						/* c8 ignore start - Same behaviour as earlier, but this only triggers if the last chosen videos was a deleted one */
					} else {
						console.log(`No more videos to choose from (${numVideosToChoose - i} videos too few uploaded on channel).`);
						break outerLoop;
					}
					/* c8 ignore stop */
				}
			} while (!await testVideoExistence(randomVideo))
		}

		// If the user does not want to shuffle from shorts, and we do not yet know the type of the chosen video, we check if it is a short
		if (configSync.shuffleIgnoreShortsOption) {
			const videoIsShort = await isShort(randomVideo);

			if (videoIsShort) {
				console.log('A chosen video was a short, but shorts are ignored. Choosing a new random video.');

				// Remove the video from videosToShuffle to not choose it again
				// Do not remove it from the playlistInfo object, as we do not want to delete it from the database
				videosToShuffle.splice(videosToShuffle.indexOf(randomVideo), 1);

				// We need to decrement i, as we did not choose a video in this iteration
				i--;
			} else {
				// The video is not a short, so add it to the list of chosen videos and remove it from the pool of videos to choose from
				chosenVideos.push(randomVideo);
				videosToShuffle.splice(videosToShuffle.indexOf(randomVideo), 1);
			}
		} else {
			// We are not ignoring shorts and the video exists
			chosenVideos.push(randomVideo);
			videosToShuffle.splice(videosToShuffle.indexOf(randomVideo), 1);
		}
	}

	// If we haven't chosen any videos: The channel has no uploads, or only shorts
	if (chosenVideos.length === 0) {
		throw new RandomYoutubeVideoError(
			{
				code: "RYV-6B",
				message: "All previously uploaded videos on this channel were deleted (the channel does not have any uploads) or you are ignoring shorts and the channel has only uploaded shorts.",
				solveHint: "If you are ignoring shorts, disable the option in the popup to shuffle from this channel.",
				showTrace: false
			}
		)
	}
	console.log(`${chosenVideos.length} random video${chosenVideos.length > 1 ? "s have" : " has"} been chosen: [${chosenVideos}]`);

	return { chosenVideos, playlistInfo, shouldUpdateDatabase, encounteredDeletedVideos };
}

// Applies a filter to the playlist object, based on the setting set in the popup
function applyShuffleFilter(allVideos, videosByDate, activeShuffleFilterOption, activeOptionValue) {
	let videosToShuffle;
	switch (activeShuffleFilterOption) {
		case "allVideosOption":
			// For this option, no additional filtering is needed
			videosToShuffle = videosByDate;
			break;

		case "dateOption":
			// Take only videos that were released after the specified date
			videosToShuffle = videosByDate.filter((videoId) => {
				return new Date(allVideos[videoId]) >= new Date(activeOptionValue);
			});
			// If the list is empty, alert the user
			if (videosToShuffle.length === 0) {
				throw new RandomYoutubeVideoError(
					{
						code: "RYV-8A",
						message: `There are no videos that were released after the specified date (${activeOptionValue}).`,
						solveHint: "Please change the date or use a different shuffle filter option.",
						showTrace: false
					}
				);
			}
			break;

		case "videoIdOption":
			// Take only videos that were released after the specified video
			// The videos are already sorted by date, so we can just take the videos that are after the specified video in the list
			// If the specified video does not exist, we alert the user
			var videoIndex = videosByDate.indexOf(activeOptionValue);
			if (videoIndex === -1) {
				throw new RandomYoutubeVideoError(
					{
						code: "RYV-8B",
						message: `The video ID you specified (${activeOptionValue}) does not map to a video uploaded on this channel.`,
						solveHint: "Please fix the video ID or use a different shuffle filter option.",
						showTrace: false
					}
				);
			}

			videosToShuffle = videosByDate.slice(0, videoIndex);

			// If the list is empty, alert the user
			if (videosToShuffle.length === 0) {
				throw new RandomYoutubeVideoError(
					{
						code: "RYV-8C",
						message: `There are no videos that were released after the specified video ID (${activeOptionValue}), or the newest video has not yet been added to the database.`,
						solveHint: "The extension will update playlists every 48 hours, so please wait for an update, change the video ID or use a different shuffle filter option.",
						showTrace: false
					}
				);
			}
			break;

		case "percentageOption":
			if (activeOptionValue < 1 || activeOptionValue > 100) {
				throw new RandomYoutubeVideoError(
					{
						code: "RYV-8D",
						message: `The percentage you specified (${activeOptionValue}) should be between 1 and 100. Normally, you should not be able to set such a value.`,
						solveHint: "Please fix the percentage in the popup.",
						showTrace: false
					}
				);
			}
			// Take only a percentage of the videos, and then choose a random video from that subset
			videosToShuffle = videosByDate.slice(0, Math.max(1, Math.ceil(videosByDate.length * (activeOptionValue / 100))));
			break;
	}

	return videosToShuffle;
}

async function playVideo(chosenVideos, firedFromPopup) {
	// Get the correct URL format
	let randomVideoURL;
	if (configSync.shuffleOpenAsPlaylistOption && chosenVideos.length > 1) {
		const randomVideos = chosenVideos.join(",");
		randomVideoURL = `https://www.youtube.com/watch_videos?video_ids=${randomVideos}`;
	} else {
		randomVideoURL = `https://www.youtube.com/watch?v=${chosenVideos[0]}`;
	}

	// Get all tab IDs
	const currentYouTubeTabs = await chrome.runtime.sendMessage({ command: "getAllYouTubeTabs" }) ?? [];
	// Find out if the reusable tab is still open (and on a youtube.com page)
	const reusableTabExists = currentYouTubeTabs.find((tab) => tab.id === configSync.shuffleTabId);

	// Open the video in a new tab, the reusable tab or the current tab
	// If the shuffle button from the popup was used, we always open the video in the 'same tab' (==the shuffling page)
	// If the user wants to reuse tabs, we only open in a new tab if the reusable tab is not open anymore
	if (configSync.shuffleOpenInNewTabOption && !firedFromPopup) {
		// Video page: Pause the current video if it is playing
		if (isVideoUrl(window.location.href)) {
			const player = document.querySelector('ytd-player#ytd-player')?.children[0]?.children[0];
			if (player && player.classList.contains('playing-mode') && !player.classList.contains('unstarted-mode')) {
				player.children[0].click();
			}
		} else {
			// Channel page: Pause the featured video if it exists and is playing
			const featuredPlayer = document.querySelector('ytd-player#player')?.children[0]?.children[0];
			if (featuredPlayer && featuredPlayer.classList.contains('playing-mode') && !featuredPlayer.classList.contains('unstarted-mode')) {
				featuredPlayer.children[0].click();
			}
			// Any page: Pause the miniplayer if it exists and is playing
			const miniPlayer = document.querySelector('ytd-player#ytd-player')?.children[0]?.children[0];
			if (miniPlayer && miniPlayer.classList.contains('playing-mode') && !miniPlayer.classList.contains('unstarted-mode')) {
				miniPlayer.children[0].click();
			}
		}

		// If there is a reusable tab and the option is enabled, open the video there
		if (configSync.shuffleReUseNewTabOption && reusableTabExists) {
			aprilFoolsJoke();

			// Focus the reusable tab and open the video there
			await chrome.runtime.sendMessage({ command: "openVideoInTabWithId", data: { tabId: configSync.shuffleTabId, videoUrl: randomVideoURL } });

			// If there is no reusable tab or the option is disabled, open the video in a new tab
		} else {
			window.open(randomVideoURL, '_blank').focus();

			// Save the ID of the opened tab as the new reusable tab
			await setSyncStorageValue("shuffleTabId", await chrome.runtime.sendMessage({ command: "getCurrentTabId" }));

			// April fools joke: Users get rickrolled once on April 1st every year
			// If we open both videos in a new tab, we want the rickroll to be focused
			aprilFoolsJoke();
		}
	} else {
		if (firedFromPopup) {
			// Save the ID of the current tab as the reusable tab, as it is a new page opened from the popup
			await setSyncStorageValue("shuffleTabId", await chrome.runtime.sendMessage({ command: "getCurrentTabId" }));
		}

		// We need to open the rickroll first, as otherwise the function call doesn't happen, as we change the URL
		aprilFoolsJoke();

		window.location.assign(randomVideoURL);
	}
}

// Once per year on April first, rickroll the user
async function aprilFoolsJoke() {
	const now = new Date();
	if (now.getMonth() === 3 && now.getDate() === 1 && configSync.wasLastRickRolledInYear !== String(now.getFullYear())) {
		await setSyncStorageValue("wasLastRickRolledInYear", String(now.getFullYear()));

		window.open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", '_blank').focus();
	}
}

// ---------- Local storage ----------
// Tries to fetch the playlist from local storage. If it is not present, returns an empty dictionary
async function tryGetPlaylistFromLocalStorage(playlistId) {
	return await chrome.storage.local.get([playlistId]).then(async (result) => {
		if (result[playlistId]) {
			// To fix a bug introduced in v2.2.1
			if(!result[playlistId]["videos"]) {
				// Remove from localStorage
				await chrome.storage.local.remove([playlistId]);
				return {}
			}
			return result[playlistId];
		}
		return {};
	});
}

async function savePlaylistToLocalStorage(playlistId, playlistInfo) {
	await chrome.storage.local.set({ [playlistId]: playlistInfo });
}
