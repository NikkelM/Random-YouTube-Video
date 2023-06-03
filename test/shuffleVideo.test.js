import expect from 'expect.js';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

import { RandomYoutubeVideoError } from '../src/utils.js';
import { chooseRandomVideo } from '../src/shuffleVideo.js';
import { configSync } from '../src/chromeStorage.js';
import { deepCopy, configSyncPermutations, playlistPermutations, needsDBInteraction, needsYTAPIInteraction } from './playlistPermutations.js';

// Utility to get the contents of localStorage at a certain key
async function getKeyFromLocalStorage(key) {
	return await chrome.storage.local.get([key]).then((result) => {
		return result[key];
	});
}

function setUpMockResponses(mockResponses) {
	// Repeats the last response if there are no more responses set up
	global.fetch = sinon.stub().callsFake((url) => {
		// Find the first response that is contained within the url
		const validResponsesForUrl = mockResponses[Object.keys(mockResponses).find((key) => url.includes(key))];
		if (!validResponsesForUrl) {
			throw new Error(`No valid response found for url: ${url}`);
		}

		if (validResponsesForUrl.length > 1) {
			return Promise.resolve(validResponsesForUrl.shift());
		}
		// console.log(`Repeating last response for url: ${url}`);
		return Promise.resolve(validResponsesForUrl[0]);
	});
}

describe('shuffleVideo', function () {

	beforeEach(function () {
		chrome.runtime.sendMessage.resetHistory();
	});

	afterEach(function () {
		delete global.fetch;
	});

	context('chooseRandomVideo()', function () {
		let domElement, windowOpenStub, errorSpy;
		const videoExistenceMockResponses = {
			'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=LOC': [{ status: 200 }],
			'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DB': [{ status: 200 }],
			'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=YT': [{ status: 200 }],
			'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=DEL': [{ status: 400 }]
		};

		beforeEach(function () {
			// ---------- DOM ----------
			// Initialize the window with a given url
			const { window } = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.youtube.com/watch?v=00000000001' });
			global.window = window;
			global.document = window.document;

			windowOpenStub = sinon.stub(window, 'open').returns({ focus: sinon.stub() });

			domElement = global.window.document.createElement('div');

			// Spy on jsdom error output
			errorSpy = sinon.spy(console, 'error');
		});

		afterEach(function () {
			domElement = undefined;

			windowOpenStub.restore();
			errorSpy.resetHistory();
			delete global.window;
		});

		context('general error handling', function () {
			it('should throw an error if no channelId is given', async function () {
				try {
					await chooseRandomVideo(null, false, domElement);
				} catch (error) {
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-1");
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should reduce the userQuotaRemainingToday by one if an error is encountered', async function () {
				expect(configSync.userQuotaRemainingToday).to.be(200);
				try {
					// The error is that there is no channelId
					await chooseRandomVideo(null, false, domElement);
				} catch (error) {
				}
				expect(configSync.userQuotaRemainingToday).to.be(199);
			});
		});
 
		context('various user settings', function () {
			// Choose a number of playlists for which to test different user setting combinations
			const playlists = [
				// Locally up-to-date playlist with deleted videos
				playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistFetchedDBRecently_DBEntryIsUpToDate_LocalPlaylistRecentlyAccessed_LocalPlaylistContainsDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist'),
				// Locally up-to-date playlist without deleted videos
				playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistFetchedDBRecently_DBEntryIsUpToDate_LocalPlaylistRecentlyAccessed_LocalPlaylistContainsNoDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist'),
				// Playlist that has to be updated from the database, but not from the YT API
				playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistDidNotFetchDBRecently_DBEntryIsUpToDate_LocalPlaylistNotRecentlyAccessed_LocalPlaylistContainsNoDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist'),
				// Playlist that has to be updated from the YT API as well, YT API has no new videos
				playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistNotRecentlyAccessed_LocalPlaylistContainsNoDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist'),
				// Playlist that has to be updated from the YT API as well, YT API has new videos
				playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistNotRecentlyAccessed_LocalPlaylistContainsNoDeletedVideos_MultipleNewVideosUploaded_DBContainsNoVideosNotInLocalPlaylist')
			];

			playlists.forEach((input) => {
				context(`playlist ${input.playlistId}`, function () {

					beforeEach(function () {
						// ---------- Fetch mock responses ----------
						// ----- YT API responses -----
						// Combine the local, db and newVideos into one object, but remove locally deleted videos, as they do not exist in the YT API anymore
						const allVideos = deepCopy({ ...input.dbVideos, ...input.localVideos, ...input.newUploadedVideos });
						for (const [videoId, publishTime] of Object.entries(allVideos)) {
							if (videoId.startsWith('DEL_LOC')) {
								delete allVideos[videoId];
							} else {
								allVideos[videoId] = publishTime;
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
						let YTResponses = [];
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

						const YTMockResponses = {
							'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': YTResponses,
						};

						// If the video id contains _S_, it is a short video, if it contains _V_, it is a normal video
						// if it is a short, the thumbnail_url will be `https://i.ytimg.com/vi/${videoId}/hq2.jpg`
						// We check the complete thumbnail_url in the function, so we need to mock each video's response individually
						let videoIsShortMockResponses = {};
						for (const [videoId, publishTime] of Object.entries(allVideos)) {
							if (videoId.includes('_S_')) {
								videoIsShortMockResponses[`https://www.youtube.com/oembed?url=http://www.youtube.com/shorts/${videoId}&format=json`] = [new Response(JSON.stringify({
									"thumbnail_url": `https://i.ytimg.com/vi/${videoId}/hq2.jpg`,
								}))];
							} else {
								videoIsShortMockResponses[`https://www.youtube.com/oembed?url=http://www.youtube.com/shorts/${videoId}&format=json`] = [new Response(JSON.stringify({
									"thumbnail_url": `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
								}))];
							}
						}

						const mockResponses = { ...videoExistenceMockResponses, ...YTMockResponses, ...videoIsShortMockResponses };

						setUpMockResponses(mockResponses);
					});

					configSyncPermutations.forEach((config, index) => {
						context(`configSyncPermutations[${index}]`, function () {

							beforeEach(async function () {
								// Clear the sync storage and set the new values
								await chrome.storage.sync.clear();
								await chrome.storage.sync.set(config);
							});

							if (config.shuffleOpenInNewTabOption && !(config.shuffleReUseNewTabOption && config.shuffleTabId !== null)) {
								it('should open a new tab with the correct URL', async function () {
									await chooseRandomVideo(input.channelId, false, domElement);

									expect(windowOpenStub.calledOnce).to.be(true);

									if (config.shuffleOpenAsPlaylistOption) {
										expect(windowOpenStub.args[0][0]).to.contain('https://www.youtube.com/watch_videos?video_ids=');
									} else {
										expect(windowOpenStub.args[0][0]).to.contain('https://www.youtube.com/watch?v=');
									}
								});

							} else if (config.shuffleReUseNewTabOption && config.shuffleTabId !== null) {
								it('should open the video in the reusable tab', async function () {
									// Due to the way JSDOM works, we cannot stub or spy on window.location.assign, so we have to check that window.open was not called
									await chooseRandomVideo(input.channelId, false, domElement);

									expect(windowOpenStub.callCount).to.be(0);

									const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);
									console.log(commands)
									console.log(chrome.runtime.sendMessage.callCount)
									console.log(config)

									if (needsYTAPIInteraction(input) && config.databaseSharingEnabledOption) {
										expect(chrome.runtime.sendMessage.callCount).to.be(6);
									} else if (needsYTAPIInteraction(input) && !config.databaseSharingEnabledOption) {
										expect(chrome.runtime.sendMessage.callCount).to.be(4);
									} else {
										// 3 if we need to delete videos in the database, 4 if we don't
										expect(chrome.runtime.sendMessage.callCount).to.be.within(3, 4);
									}

									expect(commands).to.contain('openVideoInTabWithId');
								});

							} else {
								it('should open the video in the current tab', async function () {
									// Due to the way JSDOM works, we cannot stub or spy on window.location.assign, so we have to check that window.open was not called
									await chooseRandomVideo(input.channelId, false, domElement);

									expect(windowOpenStub.callCount).to.be(0);

									// As a workaround, we check that JSDOM complains about window.location.assign not being implemented
									expect(errorSpy.callCount).to.be(1);
									expect(errorSpy.args[0][0]).to.contain('Error: Not implemented: navigation');
								});
							}

						});
					});
				});
			});

		});

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
						dbContainsNewVideos: playlistModifiers[5][n],
						configSync: playlistModifiers[6][o]
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
					newLastVideoPublishedAt,
					// Config
					configSync
				}
			*/

			playlistPermutations.forEach(function (input) {
				context(`playlist ${input.playlistId}`, function () {

					beforeEach(function () {
						// ---------- Fetch mock responses ----------
						// ----- YT API responses -----
						// Combine the local, db and newVideos into one object, but remove locally deleted videos, as they do not exist in the YT API anymore
						const allVideos = deepCopy({ ...input.dbVideos, ...input.localVideos, ...input.newUploadedVideos });
						for (const [videoId, publishTime] of Object.entries(allVideos)) {
							if (videoId.startsWith('DEL_LOC')) {
								delete allVideos[videoId];
							} else {
								allVideos[videoId] = publishTime;
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
						let YTResponses = [];
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

						const YTMockResponses = {
							'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': YTResponses,
						};

						const mockResponses = { ...videoExistenceMockResponses, ...YTMockResponses };

						setUpMockResponses(mockResponses);
					});

					context('setup', function () {
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
					});

					it('should correctly update the configSync object', async function () {
						const configSyncBefore = deepCopy(configSync);

						await chooseRandomVideo(input.channelId, false, domElement);

						const configSyncAfter = deepCopy(configSync);

						expect(configSyncBefore.numShuffledVideosTotal).to.be(0);
						expect(configSyncAfter.numShuffledVideosTotal).to.be(1);

						expect(configSyncBefore.shuffleTabId).to.be(null);
						expect(configSyncAfter.shuffleTabId).to.be(1);

						if (!needsYTAPIInteraction(input)) {
							expect(configSyncBefore.userQuotaRemainingToday).to.be(configSyncAfter.userQuotaRemainingToday);
						} else {
							expect(configSyncBefore.userQuotaRemainingToday).to.be.greaterThan(configSyncAfter.userQuotaRemainingToday);
						}
					});

					context('database interaction', function () {
						if (!needsDBInteraction(input)) {
							it('should only interact with the database to remove deleted videos', async function () {
								await chooseRandomVideo(input.channelId, false, domElement);

								const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);

								// callCount is 3 if we didn't choose a deleted video, 4 else
								expect(chrome.runtime.sendMessage.callCount).to.be.within(3, 4);

								expect(commands).to.contain('connectionTest');
								expect(commands).to.contain('getAllYouTubeTabs');
								expect(commands).to.contain('getCurrentTabId');

								if (chrome.runtime.sendMessage.callCount === 4) {
									expect(commands).to.contain('overwritePlaylistInfoInDB');
								}

							});
						} else if (input.playlistModifiers.dbContainsNewVideos === 'DBContainsDeletedVideos') {
							it('should update the database if no deleted videos were chosen, or overwrite it if a deleted video was found', async function () {
								await chooseRandomVideo(input.channelId, false, domElement);
								const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);

								const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);

								if (needsYTAPIInteraction(input)) {
									expect(chrome.runtime.sendMessage.callCount).to.be(6);
								} else {
									expect(chrome.runtime.sendMessage.callCount).to.be.within(4, 5);
								}

								expect(commands).to.contain('connectionTest');
								expect(commands).to.contain('getPlaylistFromDB');
								expect(commands).to.contain('getAllYouTubeTabs');
								expect(commands).to.contain('getCurrentTabId');

								const numDeletedVideosBefore = Object.keys(input.dbDeletedVideos).filter(videoId => videoId.includes('DEL')).length;
								const numDeletedVideosAfter = Object.keys(playlistInfoAfter.videos).filter(videoId => videoId.includes('DEL')).length;

								// Callcount:
								// 6 if we need to fetch from the YT API, with update or overwrite depending on if a video was deleted
								// 5 if we don't need to fetch from the YT API, but need to overwrite the playlist in the DB
								// 4 if we dont need to overwrite the playlist in the DB
								switch (chrome.runtime.sendMessage.callCount) {
									case 4:
										expect(numDeletedVideosBefore).to.be(numDeletedVideosAfter);
										break;
									case 5:
										expect(commands).to.contain('overwritePlaylistInfoInDB');
										expect(numDeletedVideosBefore).to.be.greaterThan(numDeletedVideosAfter);
										break;
									case 6:
										expect(commands).to.contain('getAPIKey');
										if (numDeletedVideosBefore > numDeletedVideosAfter) {
											expect(commands).to.contain('overwritePlaylistInfoInDB');
										} else {
											expect(commands).to.contain('updatePlaylistInfoInDB');
										}
										break;
									default:
										expect().fail("Unexpected call count");
								}
							});
						} else if (input.playlistModifiers.containsDeletedVideos === 'LocalPlaylistContainsDeletedVideos') {
							it('should update the database after interacting with the YouTube API and overwrite local deleted videos', async function () {
								await chooseRandomVideo(input.channelId, false, domElement);
								const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);

								const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);

								expect(commands).to.contain('connectionTest');
								expect(commands).to.contain('getPlaylistFromDB');
								expect(commands).to.contain('getAllYouTubeTabs');
								expect(commands).to.contain('getCurrentTabId');

								// Callcount:
								// 6 if we need to fetch from the YT API, we consequently need to update the DB
								// 4 if we dont need to fetch from the YT API
								if (needsYTAPIInteraction(input)) {
									expect(chrome.runtime.sendMessage.callCount).to.be(6);
									expect(commands).to.contain('getAPIKey');
									expect(commands).to.contain('updatePlaylistInfoInDB');
								} else {
									expect(chrome.runtime.sendMessage.callCount).to.be(4);
								}

								const numDeletedVideosAfter = Object.keys(playlistInfoAfter.videos).filter(videoId => videoId.includes('DEL')).length;

								expect(numDeletedVideosAfter).to.be(0);
							});
						} else if (input.playlistModifiers.lastUpdatedDBAt === 'DBEntryIsUpToDate') {
							it('should only fetch data from the database', async function () {
								await chooseRandomVideo(input.channelId, false, domElement);

								const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);

								// 4 because we only need to fetch from the DB
								expect(chrome.runtime.sendMessage.callCount).to.be(4);

								expect(commands).to.contain('connectionTest');
								expect(commands).to.contain('getPlaylistFromDB');
								expect(commands).to.contain('getAllYouTubeTabs');
								expect(commands).to.contain('getCurrentTabId');
							});
							// For all other cases, the DB entry either doesn't exist, or is out of date, so we need to fetch from the YT API
						} else {
							it('should update the database', async function () {
								await chooseRandomVideo(input.channelId, false, domElement);

								const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);

								// 6 because we need to fetch from the DB, fetch from the YT API, and update the DB
								expect(chrome.runtime.sendMessage.callCount).to.be(6);

								expect(commands).to.contain('connectionTest');
								expect(commands).to.contain('getPlaylistFromDB');
								expect(commands).to.contain('getAllYouTubeTabs');
								expect(commands).to.contain('getCurrentTabId');
								expect(commands).to.contain('getAPIKey');
								expect(commands).to.contain('updatePlaylistInfoInDB');
							});
						}
					});

					context('locally stored playlist', function () {
						// For all playlists that do not need to interact with the YouTube API
						if (!needsYTAPIInteraction(input)) {
							it('should correctly update the local playlist object', async function () {
								const timeBefore = new Date(Date.now() - 300000).toISOString(); // Add a small offset to be able to compare with greaterThan
								const playlistInfoBefore = await getKeyFromLocalStorage(input.playlistId);
								await chooseRandomVideo(input.channelId, false, domElement);
								const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);
								const videosAfter = Object.keys(playlistInfoAfter.videos);

								if (input.playlistModifiers.lastAccessedLocally !== 'LocalPlaylistDoesNotExist') {
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(playlistInfoBefore.lastAccessedLocally);
									// If we have not had to update the local playlist, the lastAccessedLocally should be updated but all other values should remain the same
									if (!needsDBInteraction(input)) {
										expect(playlistInfoAfter.lastFetchedFromDB).to.be(playlistInfoBefore.lastFetchedFromDB);
										expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
										expect(playlistInfoBefore.videos).to.have.keys(videosAfter);
										// If the database contains videos not in the local playlist
									} else if (input.playlistModifiers.dbContainsNewVideos === 'DBContainsVideosNotInLocalPlaylist' ||
										input.playlistModifiers.dbContainsNewVideos === 'DBContainsDeletedVideos') {
										expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(playlistInfoBefore.lastFetchedFromDB);
										if (input.playlistModifiers.dbContainsNewVideos === 'DBContainsVideosNotInLocalPlaylist') {
											expect(playlistInfoAfter.lastVideoPublishedAt).to.be.greaterThan(playlistInfoBefore.lastVideoPublishedAt);
										} else {
											expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
										}
										if (input.localDeletedVideos) {
											// By fetching the videos from the database, any locally deleted videos should have been removed from the local playlist
											expect(playlistInfoAfter.videos).to.not.have.keys(Object.keys(input.localDeletedVideos));
										}
										expect({ ...input.localVideos, ...input.dbVideos, ...input.dbDeletedVideos }).to.have.keys(videosAfter);
										// The database and local playlist are in sync already
									} else {
										expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(playlistInfoBefore.lastFetchedFromDB);
										expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
										// By fetching the videos from the database, any deleted videos should have been removed from the local playlist
										// We also know that here, the db did not contain any deleted videos
										expect(playlistInfoAfter.videos).to.have.keys(Object.keys({ ...input.localVideos, ...input.dbVideos }));
									}
								} else {
									// If the playlist did not exist locally before, it should now
									// Reminder: We did not interact with the YouTube API
									expect(playlistInfoAfter).to.be.an('object');
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(timeBefore);
									expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(timeBefore);
									expect(playlistInfoAfter.lastVideoPublishedAt).to.be(input.dbLastVideoPublishedAt);
									expect({ ...input.dbVideos, ...input.dbDeletedVideos }).to.have.keys(videosAfter)
								}
							});
							// For playlists that need to interact with the YouTube API
						} else {
							it('should correctly update the local playlist object', async function () {
								const timeBefore = new Date(Date.now() - 300000).toISOString(); // Add a small offset to be able to compare with greaterThan
								const playlistInfoBefore = await getKeyFromLocalStorage(input.playlistId);
								await chooseRandomVideo(input.channelId, false, domElement);
								const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);
								const videosAfter = Object.keys(playlistInfoAfter.videos);

								if (!needsDBInteraction(input)) {
									throw new Error('This test should not be run for playlists that do not need to interact with the database. If they are, this means we are now using different configSync objects.');
								}

								if (input.playlistModifiers.lastAccessedLocally !== 'LocalPlaylistDoesNotExist') {
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(playlistInfoBefore.lastAccessedLocally);
									expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(playlistInfoBefore.lastFetchedFromDB);
									// If there are no *new* videos
									if (input.playlistModifiers.dbContainsNewVideos === 'DBContainsNoVideosNotInLocalPlaylist' && input.playlistModifiers.newUploadedVideos === 'NoNewVideoUploaded') {
										expect(playlistInfoAfter.lastVideoPublishedAt.substring(0, 10)).to.be(playlistInfoBefore.lastVideoPublishedAt.substring(0, 10));
										if (input.playlistModifiers.containsDeletedVideos === 'LocalPlaylistContainsDeletedVideos') {
											expect(playlistInfoAfter.videos).to.have.keys(Object.keys({ ...input.localVideos, ...input.dbVideos }));
										} else {
											expect(playlistInfoAfter.videos).to.eql(playlistInfoBefore.videos);
										}
										// If there are deleted videos, but no new videos
									} else if (input.playlistModifiers.dbContainsNewVideos === 'DBContainsDeletedVideos' && input.playlistModifiers.newUploadedVideos === 'NoNewVideoUploaded') {
										expect(playlistInfoAfter.lastVideoPublishedAt.substring(0, 10)).to.be(playlistInfoBefore.lastVideoPublishedAt.substring(0, 10));
										expect(playlistInfoAfter.videos).to.have.keys(Object.keys(input.localVideos));
										expect({ ...playlistInfoAfter.videos, ...input.dbDeletedVideos }).to.have.keys(Object.keys(playlistInfoAfter.videos));
										// If there were new videos, either in the DB or uploaded
									} else {
										expect(playlistInfoAfter.lastVideoPublishedAt).to.be.greaterThan(playlistInfoBefore.lastVideoPublishedAt);
										expect({ ...input.localVideos, ...input.dbVideos, ...input.dbDeletedVideos, ...input.newUploadedVideos }).to.have.keys(videosAfter);
									}
								} else {
									// If the playlist did not exist locally before, it should now
									// Reminder: We interacted with the YouTube API
									expect(playlistInfoAfter).to.be.an('object');
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(timeBefore);
									expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(timeBefore);
									expect(playlistInfoAfter.lastVideoPublishedAt.substring(0, 10)).to.be(input.newLastVideoPublishedAt.substring(0, 10));
									expect({ ...input.localVideos, ...input.dbVideos, ...input.dbDeletedVideos, ...input.newUploadedVideos }).to.have.keys(videosAfter)
								}

							});
						}
					});

					context('error handling', function () {
						context('userQuotaRemainingToday', function () {
							if (needsYTAPIInteraction(input)) {
								it('should throw an error if the userQuotaRemainingToday is 0', async function () {
									configSync.userQuotaRemainingToday = 0;

									try {
										await chooseRandomVideo(input.channelId, false, domElement);
									} catch (error) {
										expect(error).to.be.a(RandomYoutubeVideoError);
										expect(error.code).to.be("RYV-4A");
										return;
									}
									expect().fail("No error was thrown");
								});

								if (input.playlistModifiers.dbContainsNewVideos !== 'NoNewVideos') {
									it('should throw an error if there is not enough quota remaining from the start to fetch all required videos of a playlist', async function () {
										// Set the quota to -100, so that we can't fetch all videos of the playlist
										// We need a negative value, as there is a leeway of 50
										configSync.userQuotaRemainingToday = 1;

										// ---------- Fetch mock responses ----------
										let YTResponses = [];
										YTResponses.push(new Response(JSON.stringify(
											{
												"kind": "youtube#playlistItemListResponse",
												"etag": "tag",
												"nextPageToken": 'nextPageToken',
												"items": [],
												"pageInfo": {
													"totalResults": 19000,
													"resultsPerPage": 50
												}
											}
										)));

										const YTMockResponses = {
											'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': YTResponses,
										};

										const mockResponses = { ...videoExistenceMockResponses, ...YTMockResponses };

										setUpMockResponses(mockResponses);

										try {
											await chooseRandomVideo(input.channelId, false, domElement);
										} catch (error) {
											expect(error).to.be.a(RandomYoutubeVideoError);
											expect(error.code).to.be("RYV-4B");
											return;
										}
										expect().fail("No error was thrown");
									});
								}
							} else {
								it('should not throw an error if the userQuotaRemainingToday is 0', async function () {
									configSync.userQuotaRemainingToday = 0;
									await chooseRandomVideo(input.channelId, false, domElement);
								});
							}

						});
					});
				});
			});
		});

	});

});