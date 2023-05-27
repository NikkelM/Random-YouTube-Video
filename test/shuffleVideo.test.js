import expect from 'expect.js';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
const { window } = new JSDOM('<!doctype html><html><body></body></html>');

import { RandomYoutubeVideoError } from '../src/utils.js';
import { chooseRandomVideo } from '../src/shuffleVideo.js';
import { configSync } from '../src/chromeStorage.js';
import { deepCopy, databasePermutations, playlistPermutations, needsDBInteraction, needsYTAPIInteraction } from './playlistPermutations.js';

// Utility to get the contents of localStorage at a certain key
async function getKeyFromLocalStorage(key) {
	return await chrome.storage.local.get([key]).then((result) => {
		return result[key];
	});
}

// Get all local storage contents
async function getLocalStorage() {
	return await chrome.storage.local.get(null).then((result) => {
		return result;
	});
}

async function getPlaylistFromDatabase(key) {
	return await chrome.runtime.sendMessage({ command: "getPlaylistFromDB", data: key });
}

function setUpMockResponses(mockResponses) {
	// Repeats the last response if there are no more responses set up
	global.fetch = sinon.stub().callsFake((url) => {
		// Find the first response that is contained within the url
		const validResponsesForUrl = mockResponses[Object.keys(mockResponses).find((key) => url.includes(key))] || [{ status: 400 }];

		if (validResponsesForUrl.length > 1) {
			return Promise.resolve(validResponsesForUrl.shift());
		}
		// console.log("Repeating last response for url: " + url);
		return Promise.resolve(validResponsesForUrl[0]);
	});
}

describe('shuffleVideo', function () {

	before(function () {
		// sinon.stub(console, 'log');
	});

	beforeEach(function () {
		chrome.runtime.sendMessage.resetHistory();
	});

	afterEach(function () {
		delete global.fetch;
	});

	after(function () {
		// console.log.restore();
	});

	context('chooseRandomVideo()', function () {

		context('error handling', function () {
			it('should throw an error if no channelId is given', async function () {
				try {
					await chooseRandomVideo(null, false, null);
				} catch (error) {
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-1");
				}
			});
			it('should reduce the userQuotaRemainingToday by one if an error is encountered', async function () {
				expect(configSync.userQuotaRemainingToday).to.be(200);
				try {
					await chooseRandomVideo(null, false, null);
				} catch (error) {
				}
				expect(configSync.userQuotaRemainingToday).to.be(199);
			});
		});

		// TODO: Test for different user settings, not needed to test for every permutation, as we assume we have local data
		// Of course, we do need to test that we do not send a request to the database if the user has opted out of database sharing

		// Test chooseRandomVideo() for different playlist states:
		context('playlist permutations', function () {
			// playlistPermutations.js creates a permutation for each possible playlist state
			// The locally stored playlists are given in localPlaylistPermutations, those stored in the database in databasePermutations
			// Permutations look like this:
			/*
				{
					playlistModifiers: {
						lastFetchedFromDB: playlistModifiers[0][i],
						lastUpdatedDBAt: playlistModifiers[1][j],
						lastAccessedLocally: playlistModifiers[2][k],
						containsDeletedVideos: playlistModifiers[3][l],
						newUploadedVideos: playlistModifiers[4][m],
						dbContainsNewVideos: playlistModifiers[5][n]
					},
					playlistId,
					channelId,
					// Local
					lastAccessedLocally,
					lastFetchedFromDB,
					localVideos,
					localLastVideoPublishedAt,
					// DB
					dbVideos,
					lastUpdatedDBAt,
					dbLastVideoPublishedAt,
					// "YT API" (actually DB)
					newUploadedVideos,
					newLastVideoPublishedAt
				}
			*/

			playlistPermutations.forEach(function (input) {
				context(`playlist ${input.playlistId}`, function () {
					let YTResponses, domElement;

					beforeEach(function () {
						domElement = window.document.createElement('div');

						// ----- YT API responses -----
						// Combine the local, db and newVideos into one object, but remove locally deleted videos, as they do not exist in the YT API anymore
						const allVideos = deepCopy({ ...input.dbVideos, ...input.localVideos, ...input.newUploadedVideos });
						for (const [videoId, publishTime] of Object.entries(allVideos)) {
							if (videoId.startsWith('DEL_LOCAL')) {
								delete allVideos[videoId];
							} else {
								allVideos[videoId] = publishTime + 'T00:00:00Z';
							}
						}

						let YTAPIItems = [];
						// The order of these is important, as the YouTube API will put the newest ones first, so sort by publishTime
						for (const [videoId, publishTime] of Object.entries(allVideos).sort((a, b) => b[1].localeCompare(a[1]))) {
							YTAPIItems.push({
								"kind": "youtube#playlistItem",
								"etag": "tag",
								"id": "id",
								"contentDetails": {
									"videoId": videoId,
									"videoPublishedAt": publishTime
								}
							});
						}

						// Put 50 items into one response each, as that is the maximum number of items that can be returned by the YouTube API
						YTResponses = [];
						const totalResults = YTAPIItems.length;
						while (YTAPIItems.length > 0) {
							const items = YTAPIItems.splice(0, 50);
							YTResponses.push(new Response(JSON.stringify(
								{
									"kind": "youtube#playlistItemListResponse",
									"etag": "tag",
									"nextPageToken": YTAPIItems.length > 0 ? 'nextPageToken' : undefined,
									"items": items,
									"pageInfo": {
										"totalResults": totalResults,
										"resultsPerPage": 50
									}
								}
							)));
						}
					});

					afterEach(function () {
						YTResponses = undefined;
						domElement = undefined;
					});

					it('should have a valid localStorage setup', async function () {
						const testedPlaylistLocally = await getKeyFromLocalStorage(input.playlistId);

						// Only for playlists that should exist locally
						if (input.playlistModifiers.lastAccessedLocally !== 'LocalPlaylistDoesNotExist') {
							expect(testedPlaylistLocally).to.be.an('object');
							expect(testedPlaylistLocally.lastAccessedLocally).to.be(input.lastAccessedLocally);
							expect(testedPlaylistLocally.lastFetchedFromDB).to.be(input.lastFetchedFromDB);
							expect(testedPlaylistLocally.lastVideoPublishedAt).to.be(input.localLastVideoPublishedAt);
							expect(testedPlaylistLocally.videos).to.be.an('object');
							expect(testedPlaylistLocally.videos).to.eql({ ...input.localVideos, ...input.localDeletedVideos });
						} else {
							// For non-existent playlists, the local storage should be empty
							expect(testedPlaylistLocally).to.be(undefined);
						}
					});

					it('should have a valid database setup', async function () {
						const testedPlaylistInDB = await chrome.runtime.sendMessage({ command: 'getPlaylistFromDB', data: input.playlistId });

						// Only for playlists that should exist in the database
						if (input.playlistModifiers.lastUpdatedDBAt !== 'DBEntryDoesNotExist') {
							expect(testedPlaylistInDB).to.be.an('object');
							expect(testedPlaylistInDB.lastUpdatedDBAt).to.be(input.lastUpdatedDBAt);
							expect(testedPlaylistInDB.lastVideoPublishedAt).to.be(input.dbLastVideoPublishedAt);
							expect(testedPlaylistInDB.videos).to.be.an('object');
							expect(testedPlaylistInDB.videos).to.eql({ ...input.dbVideos, ...input.dbDeletedVideos });
						} else {
							// For non-existent playlists, the database should not contain an entry
							expect(testedPlaylistInDB).to.be(null);
						}
					});

					// These tests only work for playlists that exist locally, as they compare entries in localStorage
					if (input.playlistModifiers.lastAccessedLocally !== 'LocalPlaylistDoesNotExist') {

						// For all playlists that do not need to interact with the YouTube API
						if (!needsYTAPIInteraction(input)) {
							it('should correctly update the local playlist object', async function () {
								const mockResponses = {
									// These mock responses will be used for testing video existence
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=LOCAL': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DB': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=YT': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DEL': [{ status: 400 }]
								};
								setUpMockResponses(mockResponses);

								const playlistInfoBefore = await getKeyFromLocalStorage(input.playlistId);
								await chooseRandomVideo(input.channelId, false, domElement);
								const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);
								const videosAfter = Object.keys(playlistInfoAfter.videos);

								// If we have not had to update the local playlist, the lastAccessedLocally should be updated but all other values should remain the same
								if (!needsDBInteraction(input)) {
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(playlistInfoBefore.lastAccessedLocally);
									expect(playlistInfoAfter.lastFetchedFromDB).to.be(playlistInfoBefore.lastFetchedFromDB);
									expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
									expect(playlistInfoBefore.videos).to.have.keys(videosAfter);
									// If the database contains videos not in the local playlist
								} else if (input.playlistModifiers.dbContainsNewVideos === 'DBContainsVideosNotInLocalPlaylist' ||
									input.playlistModifiers.dbContainsNewVideos === 'DBContainsDeletedVideos') {
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(playlistInfoBefore.lastAccessedLocally);
									expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(playlistInfoBefore.lastFetchedFromDB);
									expect(playlistInfoAfter.lastVideoPublishedAt).to.be.greaterThan(playlistInfoBefore.lastVideoPublishedAt);
									if (input.localDeletedVideos) {
										// By fetching the videos from the database, any locally deleted videos should have been removed from the local playlist
										expect(playlistInfoAfter.videos).to.not.have.keys(Object.keys(input.localDeletedVideos));
									}
									expect({ ...input.localVideos, ...input.dbVideos, ...input.dbDeletedVideos }).to.have.keys(videosAfter);
									// The database and local playlist are in sync already
								} else {
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(playlistInfoBefore.lastAccessedLocally);
									expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(playlistInfoBefore.lastFetchedFromDB);
									expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
									// By fetching the videos from the database, any deleted videos should have been removed from the local playlist
									// We also know that here, the db did not contain any deleted videos
									expect(playlistInfoAfter.videos).to.have.keys(Object.keys({ ...input.localVideos, ...input.dbVideos }));
								}
							});

							it('should not change the userQuotaRemainingToday', async function () {
								const mockResponses = {
									// These mock responses will be used for testing video existence
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=LOCAL': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DB': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=YT': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DEL': [{ status: 400 }]
								};
								setUpMockResponses(mockResponses);

								const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;
								await chooseRandomVideo(input.channelId, false, domElement);
								const userQuotaRemainingTodayAfter = configSync.userQuotaRemainingToday;

								expect(userQuotaRemainingTodayAfter).to.be(userQuotaRemainingTodayBefore);
							});
						}

						// For playlists that need to interact with the YouTube API
						else {
							it('should correctly update the local playlist object', async function () {
								const mockResponses = {
									// These mock responses will be used for testing video existence
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=LOCAL': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DB': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=YT': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DEL': [{ status: 400 }],
									// These mock responses contain the results of the YouTube API call to get a playlistInfo
									'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': YTResponses
								};
								setUpMockResponses(mockResponses);

								const playlistInfoBefore = await getKeyFromLocalStorage(input.playlistId);
								await chooseRandomVideo(input.channelId, false, domElement);
								const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);

								if (!needsDBInteraction(input)) {
									throw new Error('This test should not be run for playlists that do not need to interact with the database. If they are, this means we are now using different configSync objects.');
								}

								// If there are no new videos at all
								if (input.playlistModifiers.dbContainsNewVideos === 'DBContainsNoNewVideos' && input.playlistModifiers.newUploadedVideos === 'NoNewUploadedVideos') {
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(playlistInfoBefore.lastAccessedLocally);
									expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(playlistInfoBefore.lastFetchedFromDB);
									expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
									// If there were new videos 
								}

							});

							it('should correctly update the userQuotaRemainingToday', async function () {
								const mockResponses = {
									// These mock responses will be used for testing video existence
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=LOCAL': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DB': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=YT': [{ status: 200 }],
									'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DEL': [{ status: 400 }],
									// These mock responses contain the results of the YouTube API call to get a playlistInfo
									'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': YTResponses
								};
								setUpMockResponses(mockResponses);

								const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;
								await chooseRandomVideo(input.channelId, false, domElement);
								const userQuotaRemainingTodayAfter = configSync.userQuotaRemainingToday;

								expect(userQuotaRemainingTodayAfter).to.be.lessThan(userQuotaRemainingTodayBefore);
							});

						}

					}

				});
			});

			// inputs.forEach(function (input) {
			// 	context(`playlist ${input.playlistId}`, function () {

			// 		// No database access required for these playlists
			// 		if (input.lastFetchedFromDB === times.zeroDaysAgo) {

			// 			it('should not change the userQuotaRemainingToday', async function () {
			// 				const mockResponses = [
			// 					{ status: 200 }
			// 				];
			// 				setUpMockResponses(mockResponses);

			// 				const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;
			// 				await chooseRandomVideo(input.channelId, false, null);
			// 				const userQuotaRemainingTodayAfter = configSync.userQuotaRemainingToday;

			// 				expect(userQuotaRemainingTodayAfter).to.be(userQuotaRemainingTodayBefore);
			// 			});

			// 			it('should not interact with the database', async function () {
			// 				const mockResponses = [
			// 					{ status: 200 }
			// 				];
			// 				setUpMockResponses(mockResponses);

			// 				await chooseRandomVideo(input.channelId, false, null);

			// 				expect(chrome.runtime.sendMessage.calledOnce).to.be(true);
			// 				expect(chrome.runtime.sendMessage.calledWith({ command: "getPlaylistFromDB" })).to.be(false);
			// 				expect(chrome.runtime.sendMessage.calledWith({ command: "updatePlaylistInfoInDB" })).to.be(false);
			// 				expect(chrome.runtime.sendMessage.calledWith({ command: "overwritePlaylistInfoInDB" })).to.be(false);
			// 			});

			// 		}

			// 	});
			// });

		});

	});

});