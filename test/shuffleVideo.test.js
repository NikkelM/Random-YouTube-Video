import expect from 'expect.js';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

import { RandomYoutubeVideoError, YoutubeAPIError } from '../src/utils.js';
import { chooseRandomVideo } from '../src/shuffleVideo.js';
import { configSync, setSyncStorageValue } from '../src/chromeStorage.js';
import { deepCopy, configSyncPermutations, playlistPermutations, needsDBInteraction, needsYTAPIInteraction } from './playlistPermutations.js';

// ---------- Utility functions ----------
// Utility to get the contents of localStorage at a certain key
async function getKeyFromLocalStorage(key) {
	return await chrome.storage.local.get([key]).then((result) => {
		if (result[key] !== undefined) {
			return result[key];
		}
		return null;
	});
}

function setupChannelSettings(configPermutations, playlistPermutations) {
	configPermutations.forEach((config) => {
		playlistPermutations.forEach((playlist) => {
			config.channelSettings[playlist.channelId] = deepCopy(config.channelSettings.template);
		});
		// Remove these, as they are not valid in the config structure
		delete config.channelSettings.template;
		delete config.channelSettings.type;
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
		return Promise.resolve(validResponsesForUrl[0]);
	});
}

// Checks that a set of messages contains the correct data format for the database
function checkPlaylistsUploadedToDB(messages, input) {
	messages.forEach((message) => {
		const data = message[0].data;

		expect(message.length).to.be(1);

		expect(data.key).to.be(input.playlistId);
		expect(Object.keys(data.val)).to.contain('lastUpdatedDBAt');
		expect(data.val.lastUpdatedDBAt.length).to.be(24);
		expect(Object.keys(data.val)).to.contain('lastVideoPublishedAt');
		expect(data.val.lastVideoPublishedAt.length).to.be(20);
		expect(Object.keys(data.val)).to.contain('videos');
		// Videos may only ever change together with the timestamp, which is also backfilled for playlists that do not have it yet
		const numChangedVideos = Object.keys(data.val.videos).length + (data.videosToDelete?.length ?? 0);
		if (numChangedVideos > 0) {
			expect(Object.keys(data.val)).to.contain('lastVideosChangedAt');
		}
		if (data.val.lastVideosChangedAt) {
			expect(data.val.lastVideosChangedAt.length).to.be(24);
		}
		// Check the format of the videos
		for (const [videoId, publishTime] of Object.entries(data.val.videos)) {
			expect(videoId.length).to.be(11);
			expect(publishTime.length).to.be(10);
		}
		for (const videoId of data.videosToDelete ?? []) {
			expect(videoId.length).to.be(11);
		}
	});
}

function getAllVideosAsOneObject(playlistInfo) {
	return Object.assign({}, playlistInfo.videos.unknownType, playlistInfo.videos.knownShorts, playlistInfo.videos.knownVideos);
}

// ---------- Tests ----------
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

			it('should not reduce the userQuotaRemainingToday if no request to the YouTube API was made', async function () {
				expect(configSync.userQuotaRemainingToday).to.be(200);
				try {
					// The error is that there is no channelId
					await chooseRandomVideo(null, false, domElement);
				} catch (error) {
					// We do no validation here, as that's not the point of this test
				}
				expect(configSync.userQuotaRemainingToday).to.be(200);
			});

			it('should throw an error if there are no API keys in the database', async function () {
				// Remove all API keys from the database
				await chrome.runtime.sendMessage({ command: "setKeyInDB", data: { key: "youtubeAPIKeys", val: [] } });

				try {
					await chooseRandomVideo('testChannelId', false, domElement);
				} catch (error) {
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-3");
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should throw an error if the channel has no uploads', async function () {
				// Take a playlist with deleted videos
				const playlistId = "UU_LocalPlaylistFetchedDBRecently_DBEntryIsUpToDate_LocalPlaylistRecentlyAccessed_LocalPlaylistContainsDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsOnlyUnknownVideos";
				const channelId = playlistId.replace("UU", "UC");
				const testedPlaylist = await getKeyFromLocalStorage(playlistId);

				const newVideos = Object.keys(testedPlaylist.videos).reduce((newPlaylist, videoId) => {
					if (videoId.includes('DEL')) {
						newPlaylist[videoId] = testedPlaylist.videos[videoId];
					}
					return newPlaylist;
				}, {});
				testedPlaylist.videos.unknownType = newVideos;

				await chrome.storage.local.set({ [testedPlaylist.playlistId]: testedPlaylist });

				setUpMockResponses(videoExistenceMockResponses);

				try {
					await chooseRandomVideo(channelId, false, domElement);
				} catch (error) {
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-6B");
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should not open a recently uploaded private video classified as a short', async function () {
				const channelId = "UC_PRIVATE_VIDEO";
				const playlistId = channelId.replace("UC", "UU");
				const privateVideoId = "PRIVATE_VID";
				const now = new Date().toISOString();
				const playlistInfo = {
					lastAccessedLocally: now,
					lastFetchedFromDB: now,
					lastVideoPublishedAt: now,
					videos: {
						knownVideos: {},
						knownShorts: {},
						unknownType: {
							[privateVideoId]: now.substring(0, 10)
						}
					}
				};

				await setSyncStorageValue("databaseSharingEnabledOption", false);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "0");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);
				await chrome.storage.local.set({ [playlistId]: playlistInfo });
				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${privateVideoId}&format=json`]: [{ status: 403 }]
				});

				try {
					await chooseRandomVideo(channelId, false, domElement);
				} catch (error) {
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-6B");
					expect(windowOpenStub.callCount).to.be(0);
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should not remove videos from the playlist if their availability cannot be checked', async function () {
				const channelId = "UC_TRANSIENTERR";
				const playlistId = channelId.replace("UC", "UU");
				const now = new Date().toISOString();
				const videos = {
					"TRANSIENT_1": now.substring(0, 10),
					"TRANSIENT_2": now.substring(0, 10),
					"TRANSIENT_3": now.substring(0, 10),
					"TRANSIENT_4": now.substring(0, 10)
				};
				const playlistInfo = {
					lastAccessedLocally: now,
					lastFetchedFromDB: now,
					lastVideoPublishedAt: now,
					videos: {
						knownVideos: {},
						knownShorts: {},
						unknownType: deepCopy(videos)
					}
				};

				await setSyncStorageValue("databaseSharingEnabledOption", false);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);
				await chrome.storage.local.set({ [playlistId]: playlistInfo });

				// A server-side error means we cannot know if the videos still exist
				setUpMockResponses({
					'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=TRANSIENT': [{ status: 503 }]
				});

				try {
					await chooseRandomVideo(channelId, false, domElement);
				} catch (error) {
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-6C");
					expect(windowOpenStub.callCount).to.be(0);

					// None of the videos may be removed, as we never learned that they are gone
					const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
					expect(getAllVideosAsOneObject(playlistInfoAfter)).to.have.keys(Object.keys(videos));
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should retry a video whose availability check fails temporarily', async function () {
				const channelId = "UC_RETRYCHECK";
				const playlistId = channelId.replace("UC", "UU");
				const videoId = "RETRY_VIDEO";
				const now = new Date().toISOString();
				const playlistInfo = {
					lastAccessedLocally: now,
					lastFetchedFromDB: now,
					lastVideoPublishedAt: now,
					videos: {
						knownVideos: {},
						knownShorts: {},
						unknownType: {
							[videoId]: now.substring(0, 10)
						}
					}
				};

				await setSyncStorageValue("databaseSharingEnabledOption", false);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);
				await setSyncStorageValue("shuffleOpenInNewTabOption", true);
				await chrome.storage.local.set({ [playlistId]: playlistInfo });

				// The first check fails temporarily, the retry succeeds
				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}`]: [{ status: 503 }, { status: 200 }]
				});

				await chooseRandomVideo(channelId, false, domElement);

				expect(windowOpenStub.callCount).to.be(1);
				expect(windowOpenStub.args[0][0]).to.contain(videoId);

				const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
				expect(getAllVideosAsOneObject(playlistInfoAfter)).to.have.keys([videoId]);
			});

			it('should not remove videos another user added to the database while deleting a video that is gone', async function () {
				const channelId = "UC_REMOTEMERGE";
				const playlistId = channelId.replace("UC", "UU");
				const keptVideoId = "KEEPVIDEO_1";
				const goneVideoId = "GONEVIDEO_2";
				// This video was added to the database by someone else after we last fetched the playlist
				const remoteVideoId = "REMOTEVID_3";

				const now = new Date().toISOString();
				const uploadDate = now.substring(0, 10);
				const lastVideoPublishedAt = now.slice(0, 19) + 'Z';

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: now,
						lastVideoPublishedAt: lastVideoPublishedAt,
						videos: {
							knownVideos: {},
							knownShorts: {},
							unknownType: {
								[keptVideoId]: uploadDate,
								[goneVideoId]: uploadDate
							}
						}
					}
				});

				await chrome.runtime.sendMessage({
					command: "setKeyInDB",
					data: {
						key: playlistId,
						val: {
							lastUpdatedDBAt: now,
							lastVideoPublishedAt: lastVideoPublishedAt,
							videos: {
								[keptVideoId]: uploadDate,
								[goneVideoId]: uploadDate,
								[remoteVideoId]: uploadDate
							}
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", true);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				// Choose more videos than exist, so that both local videos are checked
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", true);
				await setSyncStorageValue("shuffleNumVideosInPlaylist", 5);

				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${keptVideoId}`]: [{ status: 200 }],
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${goneVideoId}`]: [{ status: 404 }]
				});

				await chooseRandomVideo(channelId, false, domElement);

				const playlistInDB = await chrome.runtime.sendMessage({ command: 'getPlaylistFromDB', data: playlistId });

				// The video that is gone must be removed, without touching the video we never knew about
				expect(Object.keys(playlistInDB.videos).sort()).to.eql([keptVideoId, remoteVideoId].sort());
			});

			it('should not treat the playlist as up-to-date if the database write fails', async function () {
				const channelId = "UC_FAILEDWRITE";
				const playlistId = channelId.replace("UC", "UU");
				const keptVideoId = "KEEPVIDEO_1";
				const goneVideoId = "GONEVIDEO_2";

				const now = new Date().toISOString();
				const uploadDate = now.substring(0, 10);
				const lastVideoPublishedAt = now.slice(0, 19) + 'Z';

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: now,
						lastUpdatedDBAt: now,
						lastVideoPublishedAt: lastVideoPublishedAt,
						videos: {
							knownVideos: {},
							knownShorts: {},
							unknownType: {
								[keptVideoId]: uploadDate,
								[goneVideoId]: uploadDate
							}
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", true);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				// Choose more videos than exist, so that both local videos are checked
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", true);
				await setSyncStorageValue("shuffleNumVideosInPlaylist", 5);

				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${keptVideoId}`]: [{ status: 200 }],
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${goneVideoId}`]: [{ status: 404 }]
				});

				global.failNextDatabaseWrite = true;

				await chooseRandomVideo(channelId, false, domElement);

				// As the write never reached the database, we may not remember the playlist as being in sync with it
				const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
				expect(playlistInfoAfter.lastFetchedFromDB).to.be(now);
			});

			it('should not lose another tab\'s work when it shuffles at the same time', async function () {
				const channelId = "UC_CONCURRENTTAB";
				const playlistId = channelId.replace("UC", "UU");
				const ourVideoId = "OURVIDEO_01";
				const otherTabVideoId = "OTHERTAB_01";

				const now = new Date().toISOString();
				const uploadDate = now.substring(0, 10);

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: now,
						lastVideoPublishedAt: now.slice(0, 19) + 'Z',
						videos: {
							knownVideos: {},
							knownShorts: {},
							unknownType: {
								[ourVideoId]: uploadDate
							}
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", false);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);
				await setSyncStorageValue("numShuffledVideosTotal", 0);

				// While this shuffle is checking its video, another tab finishes a shuffle of the same channel
				// It writes to storage directly, so our in-memory configSync stays stale, exactly as it would in a second tab
				let otherTabHasShuffled = false;
				global.fetch = sinon.stub().callsFake(async () => {
					if (!otherTabHasShuffled) {
						otherTabHasShuffled = true;

						const storedByOtherTab = deepCopy((await chrome.storage.local.get([playlistId]))[playlistId]);
						storedByOtherTab.videos.unknownType[otherTabVideoId] = uploadDate;
						await chrome.storage.local.set({ [playlistId]: storedByOtherTab });

						await chrome.storage.sync.set({ "numShuffledVideosTotal": 1 });
					}
					return { status: 200 };
				});

				await chooseRandomVideo(channelId, false, domElement);

				// Saving our own result must not undo the other tab's work
				const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
				expect(getAllVideosAsOneObject(playlistInfoAfter)).to.have.keys([ourVideoId, otherTabVideoId]);

				// Both shuffles have to be counted
				// This cannot prove that the value is re-read, as the mocked sync storage and configSync are the same object, so configSync never goes stale in tests
				expect(configSync.numShuffledVideosTotal).to.be(2);
			});

			it('should only send the deletions if the database already knows the playlist', async function () {
				const channelId = "UC_DELETEONLY";
				const playlistId = channelId.replace("UC", "UU");
				const keptVideoId = "KEEPVIDEO_1";
				const goneVideoId = "GONEVIDEO_2";

				const now = new Date().toISOString();
				const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
				const uploadDate = now.substring(0, 10);
				const lastVideoPublishedAt = now.slice(0, 19) + 'Z';

				// The local copy is stale, so the up-to-date database entry is read during the shuffle
				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: threeDaysAgo,
						lastVideoPublishedAt: lastVideoPublishedAt,
						videos: {
							knownVideos: {},
							knownShorts: {},
							unknownType: {
								[keptVideoId]: uploadDate,
								[goneVideoId]: uploadDate
							}
						}
					}
				});

				await chrome.runtime.sendMessage({
					command: "setKeyInDB",
					data: {
						key: playlistId,
						val: {
							lastUpdatedDBAt: now,
							lastVideoPublishedAt: lastVideoPublishedAt,
							videos: {
								[keptVideoId]: uploadDate,
								[goneVideoId]: uploadDate
							}
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", true);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				// Choose more videos than exist, so that both videos are checked
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", true);
				await setSyncStorageValue("shuffleNumVideosInPlaylist", 5);

				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${keptVideoId}`]: [{ status: 200 }],
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${goneVideoId}`]: [{ status: 404 }]
				});

				chrome.runtime.sendMessage.resetHistory();
				await chooseRandomVideo(channelId, false, domElement);

				const updateMessages = chrome.runtime.sendMessage.args.filter(arg => arg[0].command === 'updatePlaylistInfoInDB');
				expect(updateMessages.length).to.be(1);

				// There is nothing to add, so re-uploading every known video would be wasted bandwidth
				expect(updateMessages[0][0].data.val.videos).to.eql({});
				expect(updateMessages[0][0].data.videosToDelete).to.eql([goneVideoId]);
			});

			it('should not delete videos or write to the database if the connection fails', async function () {
				const channelId = "UC_OFFLINE";
				const playlistId = channelId.replace("UC", "UU");
				const now = new Date().toISOString();
				const videos = {
					"OFFLINEVID1": now.substring(0, 10),
					"OFFLINEVID2": now.substring(0, 10),
					"OFFLINEVID3": now.substring(0, 10),
					"OFFLINEVID4": now.substring(0, 10)
				};

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: now,
						lastVideoPublishedAt: now.slice(0, 19) + 'Z',
						videos: {
							knownVideos: {},
							knownShorts: {},
							unknownType: deepCopy(videos)
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", true);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);

				// Every request fails outright, as it would if the user lost their connection
				global.fetch = sinon.stub().rejects(new Error("Failed to fetch"));

				chrome.runtime.sendMessage.resetHistory();

				try {
					await chooseRandomVideo(channelId, false, domElement);
				} catch (error) {
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-6C");

					// A connection problem must never be mistaken for videos being gone
					const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
					expect(getAllVideosAsOneObject(playlistInfoAfter)).to.have.keys(Object.keys(videos));

					const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);
					expect(commands).to.not.contain('updatePlaylistInfoInDB');

					// A failed availability check is not a request to the YouTube API, so it may not cost the user any quota
					expect(configSync.userQuotaRemainingToday).to.be(200);
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should not delete videos if the requests are rate limited', async function () {
				const channelId = "UC_RATELIMITED";
				const playlistId = channelId.replace("UC", "UU");
				const now = new Date().toISOString();
				const videos = {
					"LIMITEDVID1": now.substring(0, 10),
					"LIMITEDVID2": now.substring(0, 10),
					"LIMITEDVID3": now.substring(0, 10),
					"LIMITEDVID4": now.substring(0, 10)
				};

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: now,
						lastVideoPublishedAt: now.slice(0, 19) + 'Z',
						videos: {
							knownVideos: {},
							knownShorts: {},
							unknownType: deepCopy(videos)
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", false);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);

				// YouTube rate limits the requests, which says nothing about the videos themselves
				setUpMockResponses({
					'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=LIMITED': [{ status: 429 }]
				});

				try {
					await chooseRandomVideo(channelId, false, domElement);
				} catch (error) {
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-6C");

					const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
					expect(getAllVideosAsOneObject(playlistInfoAfter)).to.have.keys(Object.keys(videos));
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should open a shuffled short on the shorts page', async function () {
				const channelId = "UC_SHORTSPLAY";
				const playlistId = channelId.replace("UC", "UU");
				const shortId = "SHORTVIDEO1";

				const now = new Date().toISOString();

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: now,
						lastVideoPublishedAt: now.slice(0, 19) + 'Z',
						videos: {
							knownVideos: {},
							// The video is already known to be a short, so its type does not have to be determined again
							knownShorts: {
								[shortId]: now.substring(0, 10)
							},
							unknownType: {}
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", false);
				// 0 means only shorts are shuffled
				await setSyncStorageValue("shuffleIgnoreShortsOption", "0");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);
				await setSyncStorageValue("shuffleOpenInNewTabOption", true);

				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${shortId}`]: [{ status: 200 }]
				});

				await chooseRandomVideo(channelId, false, domElement);

				expect(windowOpenStub.callCount).to.be(1);
				expect(windowOpenStub.args[0][0]).to.be(`https://www.youtube.com/shorts/${shortId}`);
			});

			it('should still open a playlist if only shorts are shuffled but playlists are enabled', async function () {
				const channelId = "UC_SHORTSLIST";
				const playlistId = channelId.replace("UC", "UU");
				const firstShortId = "SHORTVIDEO1";
				const secondShortId = "SHORTVIDEO2";

				const now = new Date().toISOString();
				const uploadDate = now.substring(0, 10);

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: now,
						lastVideoPublishedAt: now.slice(0, 19) + 'Z',
						videos: {
							knownVideos: {},
							knownShorts: {
								[firstShortId]: uploadDate,
								[secondShortId]: uploadDate
							},
							unknownType: {}
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", false);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "0");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", true);
				await setSyncStorageValue("shuffleNumVideosInPlaylist", 2);
				await setSyncStorageValue("shuffleOpenInNewTabOption", true);

				setUpMockResponses({
					'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=SHORTVIDEO': [{ status: 200 }]
				});

				await chooseRandomVideo(channelId, false, domElement);

				expect(windowOpenStub.callCount).to.be(1);
				expect(windowOpenStub.args[0][0]).to.contain('https://www.youtube.com/watch_videos?video_ids=');
			});

			it('should open a chosen short on the shorts page even if normal videos are shuffled too', async function () {
				const channelId = "UC_MIXEDSHORTS";
				const playlistId = channelId.replace("UC", "UU");
				const shortId = "SHORTVIDEO1";

				const now = new Date().toISOString();

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: now,
						lastVideoPublishedAt: now.slice(0, 19) + 'Z',
						videos: {
							knownVideos: {},
							knownShorts: {
								[shortId]: now.substring(0, 10)
							},
							unknownType: {}
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", false);
				// 1 means shorts are shuffled together with normal videos
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);
				await setSyncStorageValue("shuffleOpenInNewTabOption", true);

				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${shortId}`]: [{ status: 200 }]
				});

				await chooseRandomVideo(channelId, false, domElement);

				expect(windowOpenStub.callCount).to.be(1);
				expect(windowOpenStub.args[0][0]).to.be(`https://www.youtube.com/shorts/${shortId}`);
			});

			it('should remember the type of a video it had to check before opening it', async function () {
				const channelId = "UC_TYPELEARNED";
				const playlistId = channelId.replace("UC", "UU");
				const shortId = "SHORTVIDEO1";

				const now = new Date().toISOString();

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: now,
						lastVideoPublishedAt: now.slice(0, 19) + 'Z',
						videos: {
							knownVideos: {},
							knownShorts: {},
							// The type of this video is not known yet, so it has to be checked before opening it
							unknownType: {
								[shortId]: now.substring(0, 10)
							}
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", false);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);
				await setSyncStorageValue("shuffleOpenInNewTabOption", true);

				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${shortId}`]: [{ status: 200 }],
					// A thumbnail ending in hq2.jpg means the video is a short
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/shorts/${shortId}`]: [new Response(JSON.stringify({
						"thumbnail_url": `https://i.ytimg.com/vi/${shortId}/hq2.jpg`
					}))]
				});

				await chooseRandomVideo(channelId, false, domElement);

				expect(windowOpenStub.args[0][0]).to.be(`https://www.youtube.com/shorts/${shortId}`);

				// The type it found out has to be saved, so the check does not have to be repeated on the next shuffle
				const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
				expect(playlistInfoAfter.videos.knownShorts).to.have.key(shortId);
				expect(playlistInfoAfter.videos.unknownType).to.not.have.key(shortId);
			});

			it('should not download the playlist again if its videos did not change', async function () {
				const channelId = "UC_UNCHANGEDDB";
				const playlistId = channelId.replace("UC", "UU");
				const videoId = "STABLEVIDEO";

				const now = new Date().toISOString();
				const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
				const uploadDate = now.substring(0, 10);
				const lastVideoPublishedAt = now.slice(0, 19) + 'Z';

				// The local copy is stale enough that the database would normally be read again
				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: threeDaysAgo,
						lastUpdatedDBAt: now,
						lastVideosChangedAt: now,
						lastVideoPublishedAt: lastVideoPublishedAt,
						videos: {
							knownVideos: {},
							knownShorts: {},
							unknownType: { [videoId]: uploadDate }
						}
					}
				});

				await chrome.runtime.sendMessage({
					command: "setKeyInDB",
					data: {
						key: playlistId,
						val: {
							lastUpdatedDBAt: now,
							lastVideosChangedAt: now,
							lastVideoPublishedAt: lastVideoPublishedAt,
							videos: { [videoId]: uploadDate }
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", true);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);

				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}`]: [{ status: 200 }]
				});

				chrome.runtime.sendMessage.resetHistory();
				await chooseRandomVideo(channelId, false, domElement);

				const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);

				// Only the timestamps may be read, as downloading the whole playlist would be wasted bandwidth
				expect(commands).to.contain('getPlaylistTimestampsFromDB');
				expect(commands).to.not.contain('getPlaylistFromDB');

				// We are back in sync with the database, so the playlist does not have to be checked again for another 48 hours
				const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
				expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(threeDaysAgo);
			});

			it('should download the playlist if its videos changed', async function () {
				const channelId = "UC_CHANGEDDB";
				const playlistId = channelId.replace("UC", "UU");
				const knownVideoId = "STABLEVIDEO";
				const addedVideoId = "ADDEDVIDEO1";

				const now = new Date().toISOString();
				const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
				const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
				const uploadDate = now.substring(0, 10);
				const lastVideoPublishedAt = now.slice(0, 19) + 'Z';

				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: threeDaysAgo,
						lastUpdatedDBAt: anHourAgo,
						lastVideosChangedAt: anHourAgo,
						lastVideoPublishedAt: lastVideoPublishedAt,
						videos: {
							knownVideos: {},
							knownShorts: {},
							unknownType: { [knownVideoId]: uploadDate }
						}
					}
				});

				// Someone else added a video to the database since we last downloaded it
				await chrome.runtime.sendMessage({
					command: "setKeyInDB",
					data: {
						key: playlistId,
						val: {
							lastUpdatedDBAt: now,
							lastVideosChangedAt: now,
							lastVideoPublishedAt: lastVideoPublishedAt,
							videos: {
								[knownVideoId]: uploadDate,
								[addedVideoId]: uploadDate
							}
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", true);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);

				setUpMockResponses({
					'https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=': [{ status: 200 }]
				});

				chrome.runtime.sendMessage.resetHistory();
				await chooseRandomVideo(channelId, false, domElement);

				const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);
				expect(commands).to.contain('getPlaylistTimestampsFromDB');
				expect(commands).to.contain('getPlaylistFromDB');

				// The video the other user added has to end up in the local playlist
				const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
				expect(getAllVideosAsOneObject(playlistInfoAfter)).to.have.keys([knownVideoId, addedVideoId]);
			});

			it('should skip the download on the next shuffle after it has stored the timestamps once', async function () {
				const channelId = "UC_ROUNDTRIP";
				const playlistId = channelId.replace("UC", "UU");
				const videoId = "STABLEVIDEO";

				const now = new Date().toISOString();
				const anHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
				const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
				const uploadDate = now.substring(0, 10);
				const lastVideoPublishedAt = now.slice(0, 19) + 'Z';

				// The local copy is from before this field existed, so the first shuffle has to download the playlist
				await chrome.storage.local.set({
					[playlistId]: {
						lastAccessedLocally: now,
						lastFetchedFromDB: threeDaysAgo,
						lastVideoPublishedAt: lastVideoPublishedAt,
						videos: {
							knownVideos: {},
							knownShorts: {},
							unknownType: { [videoId]: uploadDate }
						}
					}
				});

				await chrome.runtime.sendMessage({
					command: "setKeyInDB",
					data: {
						key: playlistId,
						val: {
							lastUpdatedDBAt: now,
							lastVideosChangedAt: anHourAgo,
							lastVideoPublishedAt: lastVideoPublishedAt,
							videos: { [videoId]: uploadDate }
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", true);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);

				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}`]: [{ status: 200 }]
				});

				chrome.runtime.sendMessage.resetHistory();
				await chooseRandomVideo(channelId, false, domElement);

				// The first shuffle has to download the playlist, as there is nothing to compare against yet
				expect(chrome.runtime.sendMessage.args.map(arg => arg[0].command)).to.contain('getPlaylistFromDB');

				// The timestamps of the database have to be stored exactly as they are, or they could never match again
				const playlistInfoAfterFirst = await getKeyFromLocalStorage(playlistId);
				expect(playlistInfoAfterFirst.lastVideosChangedAt).to.be(anHourAgo);
				expect(playlistInfoAfterFirst.lastVideoPublishedAt).to.be(lastVideoPublishedAt);

				// Make the local copy old enough that the database would be consulted again
				const stalePlaylistInfo = deepCopy(playlistInfoAfterFirst);
				stalePlaylistInfo.lastFetchedFromDB = threeDaysAgo;
				await chrome.storage.local.set({ [playlistId]: stalePlaylistInfo });

				chrome.runtime.sendMessage.resetHistory();
				await chooseRandomVideo(channelId, false, domElement);

				// Nothing changed in the database, so the second shuffle may only read the timestamps
				const secondCommands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);
				expect(secondCommands).to.contain('getPlaylistTimestampsFromDB');
				expect(secondCommands).to.not.contain('getPlaylistFromDB');
			});

			it('should add the timestamp to playlists uploaded by an older version, even if no videos changed', async function () {
				const channelId = "UC_BACKFILL";
				const playlistId = channelId.replace("UC", "UU");
				const videoId = "STABLEVIDEO";

				const now = new Date().toISOString();
				const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
				const uploadDate = threeDaysAgo.substring(0, 10);
				const lastVideoPublishedAt = threeDaysAgo.slice(0, 19) + 'Z';

				// An older version uploaded this playlist, so it does not have a lastVideosChangedAt yet, and it is old enough that the API is consulted
				await chrome.runtime.sendMessage({
					command: "setKeyInDB",
					data: {
						key: playlistId,
						val: {
							lastUpdatedDBAt: threeDaysAgo,
							lastVideoPublishedAt: lastVideoPublishedAt,
							videos: { [videoId]: uploadDate }
						}
					}
				});

				await setSyncStorageValue("databaseSharingEnabledOption", true);
				await setSyncStorageValue("shuffleIgnoreShortsOption", "1");
				await setSyncStorageValue("shuffleOpenAsPlaylistOption", false);

				// The channel has not uploaded anything since, so the API returns the video the database already knows
				setUpMockResponses({
					[`https://www.youtube.com/oembed?url=http://www.youtube.com/watch?v=${videoId}`]: [{ status: 200 }],
					'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': [
						new Response(JSON.stringify({
							"kind": "youtube#playlistItemListResponse",
							"pageInfo": { "totalResults": 1, "resultsPerPage": 50 },
							"items": [{
								"kind": "youtube#playlistItem",
								"contentDetails": { "videoId": videoId, "videoPublishedAt": lastVideoPublishedAt }
							}]
						}))
					]
				});

				chrome.runtime.sendMessage.resetHistory();
				await chooseRandomVideo(channelId, false, domElement);

				// Without the timestamp in the database, no client could ever skip the download, so it has to be backfilled
				const uploads = chrome.runtime.sendMessage.args.filter(arg => arg[0].command === 'updatePlaylistInfoInDB');
				expect(uploads.length).to.be(1);
				expect(uploads[0][0].data.val.lastVideosChangedAt.length).to.be(24);

				// The client has to remember what it wrote, or it would download the playlist again on the next shuffle
				const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);
				expect(playlistInfoAfter.lastVideosChangedAt).to.be(uploads[0][0].data.val.lastVideosChangedAt);

				const stalePlaylistInfo = deepCopy(playlistInfoAfter);
				stalePlaylistInfo.lastFetchedFromDB = threeDaysAgo;
				await chrome.storage.local.set({ [playlistId]: stalePlaylistInfo });

				chrome.runtime.sendMessage.resetHistory();
				await chooseRandomVideo(channelId, false, domElement);

				expect(chrome.runtime.sendMessage.args.map(arg => arg[0].command)).to.not.contain('getPlaylistFromDB');
			});

			it('should alert the user if the channel has more than 20000 uploads', async function () {
				// Create a mock response with too many uploads
				let YTResponses = [
					new Response(JSON.stringify(
						{
							"kind": "youtube#playlistItemListResponse",
							"etag": "tag",
							"nextPageToken": 'nextPageToken',
							"items": [
								{
									"kind": "youtube#playlistItem",
									"etag": "tag",
									"id": "id",
									"contentDetails": {
										"videoId": 'testVideoId',
										"videoPublishedAt": new Date().toISOString()
									}
								}
							],
							"pageInfo": {
								"totalResults": 25000,
								"resultsPerPage": 50
							}
						}
					))
				];

				const YTMockResponses = {
					'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': YTResponses,
				};

				setUpMockResponses(YTMockResponses);

				// Add custom API key to the config to make sure we get to the alert
				await setSyncStorageValue('useCustomApiKeyOption', true);
				await setSyncStorageValue('customYoutubeApiKey', 'testApiKey');

				const alertStub = sinon.stub(window, 'alert');

				try {
					// Playlist that does not exist locally, DB is outdated
					await chooseRandomVideo('UU_LocalPlaylistDidNotFetchDBRecently_DBEntryDoesNotExist_LocalPlaylistDoesNotExist_LocalPlaylistContainsNoDeletedVideos_MultipleNewVideosUploaded_DBContainsNoVideosNotInLocalPlaylist', false, domElement);
				} catch (error) {
					// The error should be body was already consumed, as we did not provide enough mock responses
					expect(['The body has already been consumed.', 'Body is unusable', 'Body is unusable: Body has already been read']).to.contain(error.message);
				}

				expect(alertStub.calledOnce).to.be(true);
				expect(alertStub.calledWith('NOTICE: The channel you are shuffling from has a lot of uploads (20,000+). The YouTube API only allows fetching the most recent 20,000 videos, which means that older uploads will not be shuffled from. This limitation is in place no matter if you use a custom API key or not.\n\nThe extension will now fetch all videos it can get from the API.'));
			});
		});

		context('YouTube API error handling', function () {
			it('should throw an error if the YouTube API response returns an unhandled error', async function () {
				const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;
				const YTMockResponses = {
					'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': [
						new Response(JSON.stringify(
							{
								"error": {
									"code": 400,
									"message": "This is an unhandled error.",
									"errors": [
										{
											"message": "This is an unhandled error.",
											"domain": "youtube.something",
											"reason": "unhandledError",
											"location": "somewhere",
											"locationType": "something"
										}
									]
								}
							}
						))
					]
				};

				setUpMockResponses(YTMockResponses);

				// Playlist that does not exist locally, DB is outdated, so we need to fetch something from the API
				try {
					await chooseRandomVideo('UC_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistDoesNotExist_LocalPlaylistContainsNoDeletedVideos_MultipleNewVideosUploaded_DBContainsNoVideosNotInLocalPlaylist', false, domElement);
				} catch (error) {
					expect(error).to.be.a(YoutubeAPIError);
					expect(error.code).to.be(400);
					expect(error.message).to.be("This is an unhandled error.");
					expect(error.reason).to.be("unhandledError");

					// If an error is encountered, the quota is only reduced by 1
					expect(configSync.userQuotaRemainingToday).to.be(userQuotaRemainingTodayBefore - 1);
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should throw an error if the YouTube API response returns a playlistNotFound error', async function () {
				const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;
				const YTMockResponses = {
					'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': [
						new Response(JSON.stringify(
							{
								"error": {
									"code": 404,
									"message": "The playlist identified with the request's \u003ccode\u003eplaylistId\u003c/code\u003e parameter cannot be found.",
									"errors": [
										{
											"message": "The playlist identified with the request's \u003ccode\u003eplaylistId\u003c/code\u003e parameter cannot be found.",
											"domain": "youtube.playlistItem",
											"reason": "playlistNotFound",
											"location": "playlistId",
											"locationType": "parameter"
										}
									]
								}
							}
						))
					]
				};

				setUpMockResponses(YTMockResponses);

				// Playlist that does not exist locally, DB is outdated, so we need to fetch something from the API
				try {
					await chooseRandomVideo('UC_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistDoesNotExist_LocalPlaylistContainsNoDeletedVideos_MultipleNewVideosUploaded_DBContainsNoVideosNotInLocalPlaylist', false, domElement);
				} catch (error) {
					// This error is caught separately and a RandomYoutubeVideoError is thrown instead
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-6A");

					// If an error is encountered, the quota is only reduced by 1
					expect(configSync.userQuotaRemainingToday).to.be(userQuotaRemainingTodayBefore - 1);
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should throw an error if the YouTube API response returns a quotaExceeded error and no more keys are available', async function () {
				const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;
				const YTMockResponses = {
					'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': [
						new Response(JSON.stringify(
							{
								"error": {
									"code": 403,
									"message": "The request cannot be completed because you have exceeded your \u003ca href=\"/youtube/v3/getting-started#quota\"\u003equota\u003c/a\u003e.",
									"errors": [
										{
											"message": "The request cannot be completed because you have exceeded your \u003ca href=\"/youtube/v3/getting-started#quota\"\u003equota\u003c/a\u003e.",
											"domain": "youtube.quota",
											"reason": "quotaExceeded"
										}
									]
								}
							}
						))
					]
				};

				setUpMockResponses(YTMockResponses);

				// Remove all but one API key from the database
				await chrome.runtime.sendMessage({ command: "setKeyInDB", data: { key: "youtubeAPIKeys", val: ["defaultAPIKey1"] } });

				// Playlist that does not exist locally, DB is outdated, so we need to fetch something from the API
				try {
					await chooseRandomVideo('UC_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistDoesNotExist_LocalPlaylistContainsNoDeletedVideos_MultipleNewVideosUploaded_DBContainsNoVideosNotInLocalPlaylist', false, domElement);
				} catch (error) {
					// This error is caught separately and a RandomYoutubeVideoError is thrown instead
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-2");

					// If an error is encountered, the quota is only reduced by 1
					expect(configSync.userQuotaRemainingToday).to.be(userQuotaRemainingTodayBefore - 1);

					// The only available API key should have been used
					const fetchArguments = global.fetch.args;
					expect(fetchArguments.length).to.be(1);

					const apiKeys = fetchArguments.map((fetchArgument) => fetchArgument[0].split("&key=")[1]);
					expect(apiKeys[0]).to.be("defaultAPIKey1");
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should throw an error if the YouTube API response returns a quotaExceeded error and a custom API key was used', async function () {
				const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;
				const YTMockResponses = {
					'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': [
						new Response(JSON.stringify(
							{
								"error": {
									"code": 403,
									"message": "The request cannot be completed because you have exceeded your \u003ca href=\"/youtube/v3/getting-started#quota\"\u003equota\u003c/a\u003e.",
									"errors": [
										{
											"message": "The request cannot be completed because you have exceeded your \u003ca href=\"/youtube/v3/getting-started#quota\"\u003equota\u003c/a\u003e.",
											"domain": "youtube.quota",
											"reason": "quotaExceeded"
										}
									]
								}
							}
						))
					]
				};

				setUpMockResponses(YTMockResponses);

				// Set a custom API key in the config
				configSync.useCustomApiKeyOption = true;
				configSync.customYoutubeApiKey = "customAPIKey";

				// Playlist that does not exist locally, DB is outdated, so we need to fetch something from the API
				try {
					await chooseRandomVideo('UC_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistDoesNotExist_LocalPlaylistContainsNoDeletedVideos_MultipleNewVideosUploaded_DBContainsNoVideosNotInLocalPlaylist', false, domElement);
				} catch (error) {
					// This error is caught separately and a RandomYoutubeVideoError is thrown instead
					expect(error).to.be.a(RandomYoutubeVideoError);
					expect(error.code).to.be("RYV-5");

					// If an error is encountered, the quota is only reduced by 1
					expect(configSync.userQuotaRemainingToday).to.be(userQuotaRemainingTodayBefore - 1);

					// The custom API should have been used
					const fetchArguments = global.fetch.args;
					expect(fetchArguments.length).to.be(1);

					const apiKeys = fetchArguments.map((fetchArgument) => fetchArgument[0].split("&key=")[1]);
					expect(apiKeys[0]).to.be(configSync.customYoutubeApiKey);
					return;
				}
				expect().fail("No error was thrown");
			});

			it('should choose a new API key if the current one has no quota remaining', async function () {
				const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;
				const YTMockResponses = {
					'https://youtube.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=50&pageToken=': [
						new Response(JSON.stringify(
							{
								"error": {
									"code": 403,
									"message": "The request cannot be completed because you have exceeded your \u003ca href=\"/youtube/v3/getting-started#quota\"\u003equota\u003c/a\u003e.",
									"errors": [
										{
											"message": "The request cannot be completed because you have exceeded your \u003ca href=\"/youtube/v3/getting-started#quota\"\u003equota\u003c/a\u003e.",
											"domain": "youtube.quota",
											"reason": "quotaExceeded"
										}
									]
								}
							}
						)),
						new Response(JSON.stringify(
							{
								"error": {
									"code": 199,
									"message": "This appears if the first API key was swapped out for the second one successfully.",
									"errors": [
										{
											"message": "This appears if the first API key was swapped out for the second one successfully.",
											"domain": "custom",
											"reason": "wantingToCheckSomething"
										}
									]
								}
							}
						))
					]
				};

				setUpMockResponses(YTMockResponses);

				// Playlist that does not exist locally, DB is outdated, so we need to fetch something from the API
				try {
					await chooseRandomVideo('UC_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistDoesNotExist_LocalPlaylistContainsNoDeletedVideos_MultipleNewVideosUploaded_DBContainsNoVideosNotInLocalPlaylist', false, domElement);
				} catch (error) {
					// This error is caught separately and a RandomYoutubeVideoError is thrown instead
					expect(error).to.be.a(YoutubeAPIError);
					expect(error.code).to.be(199);
					expect(error.message).to.be("This appears if the first API key was swapped out for the second one successfully.");

					// If an error is encountered, the quota is only reduced by 1
					expect(configSync.userQuotaRemainingToday).to.be(userQuotaRemainingTodayBefore - 1);

					// The first and second API key should be different
					const fetchArguments = global.fetch.args;
					expect(fetchArguments.length).to.be(2);

					const apiKeys = fetchArguments.map((fetchArgument) => fetchArgument[0].split("&key=")[1]);
					expect(apiKeys[0]).to.not.be(apiKeys[1]);
					return;
				}
				expect().fail("No error was thrown");
			});
		});

		context('user settings', async function () {
			// Choose a number of playlists for which to test different user setting combinations
			const playlists = [
				// Playlist that does not exist locally, DB is outdated
				deepCopy(playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistDoesNotExist_LocalPlaylistContainsNoDeletedVideos_MultipleNewVideosUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsOnlyUnknownVideos')),
				// Playlist that does not exist locally, DB is up-to-date
				deepCopy(playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistDidNotFetchDBRecently_DBEntryIsUpToDate_LocalPlaylistDoesNotExist_LocalPlaylistContainsNoDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsOnlyUnknownVideos')),
				// Locally up-to-date playlist with deleted videos
				deepCopy(playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistFetchedDBRecently_DBEntryIsUpToDate_LocalPlaylistRecentlyAccessed_LocalPlaylistContainsDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsKnownShortsAndVideos')),
				// Locally up-to-date playlist without deleted videos
				deepCopy(playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistFetchedDBRecently_DBEntryIsUpToDate_LocalPlaylistRecentlyAccessed_LocalPlaylistContainsNoDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsOnlyUnknownVideos')),
				// Playlist that has to be updated from the database, but not from the YT API
				deepCopy(playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistDidNotFetchDBRecently_DBEntryIsUpToDate_LocalPlaylistNotRecentlyAccessed_LocalPlaylistContainsNoDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsKnownShortsAndVideos')),
				// Playlist that has to be updated from the YT API as well, YT API has no new videos
				deepCopy(playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistNotRecentlyAccessed_LocalPlaylistContainsNoDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsOnlyUnknownVideos')),
				// Playlist that has to be updated from the YT API as well, YT API has new videos
				deepCopy(playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistDidNotFetchDBRecently_DBEntryIsNotUpToDate_LocalPlaylistNotRecentlyAccessed_LocalPlaylistContainsNoDeletedVideos_MultipleNewVideosUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsKnownShortsAndVideos')),
				// Playlist that only has shorts saved locally
				deepCopy(playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistFetchedDBRecently_DBEntryIsUpToDate_LocalPlaylistRecentlyAccessed_LocalPlaylistContainsOnlyShorts_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsOnlyUnknownVideos')),
				// Playlist that has no shorts saved locally
				deepCopy(playlistPermutations.find((playlist) => playlist.playlistId === 'UU_LocalPlaylistFetchedDBRecently_DBEntryIsUpToDate_LocalPlaylistRecentlyAccessed_LocalPlaylistContainsNoShorts_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsOnlyUnknownVideos')),
			];
			setupChannelSettings(configSyncPermutations.channelSettingsPermutations, playlists);

			playlists.forEach((input) => {
				context(`playlist ${input.playlistId}`, function () {

					beforeEach(function () {
						// ---------- Fetch mock responses ----------
						// ----- YT API responses -----
						// Combine the local, db and newVideos into one object, but remove locally deleted videos, as they do not exist in the YT API any more
						let allVideos = deepCopy({ ...input.dbVideos, ...input.localVideos, ...input.newUploadedVideos });
						for (const [videoId, publishTime] of Object.entries(allVideos)) {
							if (videoId.startsWith('DEL_LOC')) {
								delete allVideos[videoId];
							} else {
								// The YT API returns the publishTime in ISO 8601 format, so we need to convert it, as the localStorage and DB use a different format
								allVideos[videoId] = new Date(publishTime).toISOString().slice(0, 19) + 'Z';
							}
						}
						allVideos = Object.fromEntries(Object.entries(allVideos).sort((a, b) => b[1].localeCompare(a[1])));

						let YTAPIItems = [];
						// The order of these is important, as the YouTube API will put the newest ones first, so sort by publishTime
						for (const [videoId, publishTime] of Object.entries(allVideos)) {
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
							// We pretend that this video cannot be embedded
							if (videoId === 'LOC_S_00001') {
								videoIsShortMockResponses[`https://www.youtube.com/oembed?url=http://www.youtube.com/shorts/${videoId}&format=json`] = ['Unauthorized'];
								videoIsShortMockResponses[`https://www.youtube.com/shorts/${videoId}`] = [{ status: 200, redirected: false }];
							} else if (videoId.includes('_S_')) {
								videoIsShortMockResponses[`https://www.youtube.com/oembed?url=http://www.youtube.com/shorts/${videoId}&format=json`] = [new Response(JSON.stringify({
									"thumbnail_url": `https://i.ytimg.com/vi/${videoId}/hq2.jpg`,
								}))];
								// We pretend that this video cannot be embedded
							} else if (videoId === 'LOC_V_00006') {
								videoIsShortMockResponses[`https://www.youtube.com/oembed?url=http://www.youtube.com/shorts/${videoId}&format=json`] = ['Unauthorized'];
								videoIsShortMockResponses[`https://www.youtube.com/shorts/${videoId}`] = [{ status: 200, redirected: true }];
							} else {
								videoIsShortMockResponses[`https://www.youtube.com/oembed?url=http://www.youtube.com/shorts/${videoId}&format=json`] = [new Response(JSON.stringify({
									"thumbnail_url": `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
								}))];
							}
						}

						const mockResponses = { ...videoExistenceMockResponses, ...YTMockResponses, ...videoIsShortMockResponses };

						setUpMockResponses(mockResponses);
					});

					context('April 1st joke', function () {
						let clock, date;

						beforeEach(function () {
							date = new Date();
							date.setMonth(3, 1);
							clock = sinon.useFakeTimers(date.getTime());
						});

						afterEach(function () {
							clock.restore();
						});

						it('should open a rickroll video if the user has not been rickrolled yet (openInNewTab option)', async function () {
							// Set the last rickroll date to the default, so the user has not been rickrolled yet
							configSync.wasLastRickRolledInYear = '1970';
							configSync.shuffleOpenInNewTabOption = true;

							try {
								await chooseRandomVideo(input.playlistId, false, domElement);
							} catch (error) {
								// This is an error thrown from the jsdom library we use to mock browser behaviour
								expect(error.message).to.contain('Not implemented: navigation (except hash changes)');
							}

							expect(windowOpenStub.calledTwice).to.be(true);
							expect(windowOpenStub.args[1][0]).to.be('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

							expect(configSync.wasLastRickRolledInYear).to.be(String(date.getFullYear()));
						});

						it('should open a rickroll video if the user has not been rickrolled yet (!openInNewTab option)', async function () {
							// Set the last rickroll date to the default, so the user has not been rickrolled yet
							configSync.wasLastRickRolledInYear = '1970';
							configSync.shuffleOpenInNewTabOption = false;

							await chooseRandomVideo(input.playlistId, false, domElement);

							expect(windowOpenStub.calledOnce).to.be(true);
							expect(windowOpenStub.args[0][0]).to.be('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

							expect(configSync.wasLastRickRolledInYear).to.be(String(date.getFullYear()));
						});

						it('should not open a rickroll video if the user has already been rickrolled this year', async function () {
							// Set the last rickroll date to this year, so the user has been rickrolled this year
							configSync.wasLastRickRolledInYear = String(date.getFullYear());
							configSync.shuffleOpenInNewTabOption = true;

							await chooseRandomVideo(input.playlistId, false, domElement);

							expect(windowOpenStub.calledOnce).to.be(true);
							expect(windowOpenStub.args[0][0]).to.not.be('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

							expect(configSync.wasLastRickRolledInYear).to.be(String(date.getFullYear()));
						});
					});

					Object.keys(configSyncPermutations).forEach((key) => {
						context(`${key}`, function () {

							configSyncPermutations[key].forEach((config, index) => {
								context(`permutation ${index}`, function () {
									beforeEach(async function () {
										// Clear the sync storage and set the new values
										await chrome.storage.sync.clear();
										await chrome.storage.sync.set(config);
									});

									if (key === 'openInNewTabPermutations') {
										if (config.shuffleOpenInNewTabOption && !(config.shuffleReUseNewTabOption && config.shuffleTabId !== null)) {
											it('should open a new tab with the correct URL', async function () {
												await chooseRandomVideo(input.channelId, false, domElement);

												expect(windowOpenStub.calledOnce).to.be(true);
												expect(windowOpenStub.args[0][0]).to.contain('https://www.youtube.com/watch_videos?video_ids=');
											});

										}
										else if (config.shuffleReUseNewTabOption && config.shuffleTabId !== null) {
											it('should open the video in the reusable tab', async function () {
												// Due to the way JSDOM works, we cannot stub or spy on window.location.assign, so we have to check that window.open was not called
												await chooseRandomVideo(input.channelId, false, domElement);

												expect(windowOpenStub.callCount).to.be(0);

												const commands = chrome.runtime.sendMessage.args.map(arg => arg[0].command);

												if (needsYTAPIInteraction(input)) {
													expect(chrome.runtime.sendMessage.callCount).to.be(6);
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
												expect(errorSpy.args[0][0]).to.contain('Not implemented: navigation');
											});
										}
									} else if (key === 'customAPIKeyPermutations') {
										if (config.useCustomApiKeyOption && config.customYoutubeApiKey) {
											it('should not reduce the userQuotaRemainingToday', async function () {
												const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;

												await chooseRandomVideo(input.channelId, false, domElement);

												const userQuotaRemainingTodayAfter = configSync.userQuotaRemainingToday;

												expect(userQuotaRemainingTodayBefore).to.be(userQuotaRemainingTodayAfter);
											});
										} else {
											it('should reduce the userQuotaRemainingToday if a request to the YouTube API has to be made', async function () {
												const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;

												await chooseRandomVideo(input.channelId, false, domElement);

												const userQuotaRemainingTodayAfter = configSync.userQuotaRemainingToday;

												if (needsYTAPIInteraction(input, config)) {
													expect(userQuotaRemainingTodayBefore).to.be.greaterThan(userQuotaRemainingTodayAfter);
												} else {
													expect(userQuotaRemainingTodayBefore).to.be(userQuotaRemainingTodayAfter);
												}
											});
										}
									} else if (key === 'openAsPlaylistPermutations') {
										if (config.shuffleOpenAsPlaylistOption) {
											it('should open the video in a playlist', async function () {
												await chooseRandomVideo(input.channelId, false, domElement);

												expect(windowOpenStub.calledOnce).to.be(true);
												expect(windowOpenStub.args[0][0]).to.contain('https://www.youtube.com/watch_videos?video_ids=');
											});
										} else {
											it('should not open the video in a playlist', async function () {
												await chooseRandomVideo(input.channelId, false, domElement);

												expect(windowOpenStub.calledOnce).to.be(true);
												// A single video is opened in the normal player, or on the shorts page if it is a short
												expect(windowOpenStub.args[0][0]).to.not.contain('watch_videos');
												expect(windowOpenStub.args[0][0]).to.match(/^https:\/\/www\.youtube\.com\/(watch\?v=|shorts\/)/);
											});
										}
									} else if (key === 'ignoreShortsPermutations') {
										// 0 = only shorts, 1 = no option set (shorts are included), 2 = ignore shorts
										if (config.shuffleIgnoreShortsOption == "2") {
											if (input.playlistId.includes('LocalPlaylistContainsOnlyShorts')) {
												it('should throw an error if the playlist only contains shorts', async function () {
													try {
														await chooseRandomVideo(input.channelId, false, domElement);
													}
													catch (error) {
														expect(error).to.be.a(RandomYoutubeVideoError);
														expect(error.code).to.be('RYV-6B');

														return;
													}
													expect().fail("No error was thrown");
												});
											} else {
												it('should not choose any shorts', async function () {
													await chooseRandomVideo(input.channelId, false, domElement);

													expect(windowOpenStub.args[0][0]).to.not.contain('_S_');
												});
											}
										} else if (config.shuffleIgnoreShortsOption == "0") {
											if (input.playlistId.includes('LocalPlaylistContainsNoShorts')) {
												it('should throw an error if the playlist contains no shorts', async function () {
													try {
														await chooseRandomVideo(input.channelId, false, domElement);
													}
													catch (error) {
														expect(error).to.be.a(RandomYoutubeVideoError);
														expect(error.code).to.be('RYV-6B');

														return;
													}
													expect().fail("No error was thrown");
												});
											} else {
												it('should only choose shorts', async function () {
													await chooseRandomVideo(input.channelId, false, domElement);

													expect(windowOpenStub.args[0][0]).to.not.contain('_V_');
												});
											}
										} else if (config.shuffleIgnoreShortsOption == "1") {
											if (!input.playlistId.includes('LocalPlaylistContainsNoShorts') && !input.playlistId.includes('LocalPlaylistContainsOnlyShorts') && !input.playlistId.includes('LocalPlaylistContainsNoVideos') && !input.playlistId.includes('MultipleNewVideosUploaded')) {
												// This works because we choose more videos than there are only videos OR shorts in the playlist, so there will always be one of each
												// If this suddenly starts failing, it may be that that assumption was changed
												it('should be able to choose both shorts and videos', async function () {
													await chooseRandomVideo(input.channelId, false, domElement);

													expect(windowOpenStub.args[0][0]).to.contain('_V_');
													expect(windowOpenStub.args[0][0]).to.contain('_S_');
												});
											}
										}
									} else if (key === 'channelSettingsPermutations') {
										// The percentageOption uses 100 as the default, and the allVideosOption has no value that can be set, so no error will be thrown
										if (Object.keys(config.channelSettings[input.channelId]).length === 1) {
											it('should throw an error if the activeOption has no value set', async function () {
												try {
													await chooseRandomVideo(input.channelId, false, domElement);
												} catch (error) {
													expect(error).to.be.an(RandomYoutubeVideoError);
													expect(error.code).to.be('RYV-7');

													return;
												}
												expect().fail("No error was thrown");
											});
											// These permutations contain only settings that lead to an error
										} else if (config.channelSettings[input.channelId].videoIdValue === 'DoesNotExistId') {
											it('should throw an error if the there are no videos matching the filter settings', async function () {
												try {
													await chooseRandomVideo(input.channelId, false, domElement);
												} catch (error) {
													expect(error).to.be.an(RandomYoutubeVideoError);
													expect(error.code).to.contain('RYV-8');

													return;
												}
												expect().fail("No error was thrown");
											});
										} else if (!(input.playlistId.includes('LocalPlaylistContainsNoShorts') && ['videoIdOption', 'videoIdBeforeOption'].includes(config.channelSettings[input.channelId].activeOption))) {
											it('should apply the correct filter', async function () {
												// The videos onto which the filter is applied includes the deleted videos (this changes the result e.g. for the percentageOption)
												let filteredVideos = deepCopy({ ...input.dbVideos, ...input.dbDeletedVideos, ...input.localVideos, ...input.localDeletedVideos, ...input.newUploadedVideos });
												filteredVideos = Object.fromEntries(Object.entries(filteredVideos).sort((a, b) => b[1].localeCompare(a[1])));

												await chooseRandomVideo(input.channelId, false, domElement);

												const chosenVideos = windowOpenStub.args[0][0].split('video_ids=')[1].split(',');

												// Depending on the activeOption, make sure that only videos that match the filter are chosen
												switch (config.channelSettings[input.channelId].activeOption) {
													case 'allVideosOption':
														for (const videoId of chosenVideos) {
															expect(Object.keys(filteredVideos).includes(videoId)).to.be(true);
														}
														break;
													case 'dateOption':
														for (const videoId of chosenVideos) {
															expect(filteredVideos[videoId]).to.be.greaterThan(config.channelSettings[input.channelId].dateValue);
														}
														break;
													case 'dateBeforeOption':
														for (const videoId of chosenVideos) {
															expect(filteredVideos[videoId] <= config.channelSettings[input.channelId].dateValue).to.be(true);
														}
														break;
													case 'videoIdOption':
														// Get all videos from index 0 to and including the videoIdValue
														const videosAfterVideoWithId = Object.keys(filteredVideos).slice(0, Object.keys(filteredVideos).indexOf(config.channelSettings[input.channelId].videoIdValue) + 1);
														// All videos that were chosen must be in the videosAfterVideoWithId array
														for (const videoId of chosenVideos) {
															expect(videosAfterVideoWithId.includes(videoId)).to.be(true);
														}
														break;
													case 'videoIdBeforeOption':
														// Get all videos from the videoIdValue onwards in the sorted list (including the video itself and older videos)
														const videosBeforeVideoWithId = Object.keys(filteredVideos).slice(Object.keys(filteredVideos).indexOf(config.channelSettings[input.channelId].videoIdValue));
														for (const videoId of chosenVideos) {
															expect(videosBeforeVideoWithId.includes(videoId)).to.be(true);
														}
														break;
													case 'percentageOption':
														// Get the most recent (starting from index 0) videos that match the percentageValue
														const percentageVideos = Object.keys(filteredVideos).slice(0, Math.max(1, Math.ceil(Object.keys(filteredVideos).length * (config.channelSettings[input.channelId].percentageValue / 100))));

														// All videos that were chosen must be in the percentageVideos array
														for (const videoId of chosenVideos) {
															expect(percentageVideos.includes(videoId)).to.be(true);
														}
														break;
													default:
														expect().fail("Untested activeOption");
												}
											});
										}
									} else {
										throw new Error('Unknown config key');
									}

								});
							});
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
						// Combine the local, db and newVideos into one object, but remove locally deleted videos, as they do not exist in the YT API any more
						let allVideos = deepCopy({ ...input.dbVideos, ...input.localVideos, ...input.newUploadedVideos });
						for (const [videoId, publishTime] of Object.entries(allVideos)) {
							if (videoId.startsWith('DEL_LOC')) {
								delete allVideos[videoId];
							} else {
								// The YT API returns the publishTime in ISO 8601 format, so we need to convert it, as the localStorage and DB use a different format
								allVideos[videoId] = new Date(publishTime).toISOString().slice(0, 19) + 'Z';
							}
						}
						allVideos = Object.fromEntries(Object.entries(allVideos).sort((a, b) => b[1].localeCompare(a[1])));

						let YTAPIItems = [];
						// The order of these is important, as the YouTube API will put the newest ones first, so sort by publishTime
						for (const [videoId, publishTime] of Object.entries(allVideos)) {
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
								expect(getAllVideosAsOneObject(testedPlaylistLocally)).to.eql({ ...input.localVideos, ...input.localDeletedVideos });
							} else {
								// For non-existent playlists, the local storage should be empty
								expect(testedPlaylistLocally).to.be(null);
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
							it('should only interact with the database to remove deleted videos if the local playlist is up-to-date', async function () {
								await chooseRandomVideo(input.channelId, false, domElement);

								const messages = chrome.runtime.sendMessage.args;
								const commands = messages.map(arg => arg[0].command);

								// callCount is 3 if we didn't choose a deleted video, 4 else
								expect(chrome.runtime.sendMessage.callCount).to.be.within(3, 4);

								expect(commands).to.contain('connectionTest');
								expect(commands).to.contain('getAllYouTubeTabs');
								expect(commands).to.contain('getCurrentTabId');

								if (chrome.runtime.sendMessage.callCount === 4) {
									expect(commands).to.contain('updatePlaylistInfoInDB');
									// One entry should contain a valid DB update that removes the videos that are gone
									const updateMessages = messages.filter(arg => arg[0].command === 'updatePlaylistInfoInDB');
									checkPlaylistsUploadedToDB(updateMessages, input);
									expect(updateMessages[0][0].data.videosToDelete).to.not.be.empty();
								}

							});
						} else if (input.playlistModifiers.dbContainsNewVideos === 'DBContainsDeletedVideos') {
							it('should update the database if no deleted videos were chosen, or overwrite it if a deleted video was found', async function () {
								await chooseRandomVideo(input.channelId, false, domElement);
								const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);

								const messages = chrome.runtime.sendMessage.args;
								const commands = messages.map(arg => arg[0].command);

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
								const numDeletedVideosAfter = Object.keys(getAllVideosAsOneObject(playlistInfoAfter)).filter(videoId => videoId.includes('DEL')).length;

								// Call count:
								// 6 if we need to fetch from the YT API, deleting videos individually if one was found to be gone
								// 5 if we don't need to fetch from the YT API, but need to delete videos from the DB
								// 4 if we don't need to change the playlist in the DB
								switch (chrome.runtime.sendMessage.callCount) {
									case 4:
										expect(numDeletedVideosBefore).to.be(numDeletedVideosAfter);
										break;
									case 5:
										expect(commands).to.contain('updatePlaylistInfoInDB');
										const deletionMessages = messages.filter(arg => arg[0].command === 'updatePlaylistInfoInDB');
										checkPlaylistsUploadedToDB(deletionMessages, input);
										// The videos that are gone must be removed one by one instead of replacing all videos
										expect(deletionMessages[0][0].data.videosToDelete).to.not.be.empty();

										expect(numDeletedVideosBefore).to.be.greaterThan(numDeletedVideosAfter);
										break;
									case 6:
										expect(commands).to.contain('getAPIKey');
										expect(commands).to.contain('updatePlaylistInfoInDB');
										const apiUpdateMessages = messages.filter(arg => arg[0].command === 'updatePlaylistInfoInDB');
										checkPlaylistsUploadedToDB(apiUpdateMessages, input);
										if (numDeletedVideosBefore > numDeletedVideosAfter) {
											expect(apiUpdateMessages[0][0].data.videosToDelete).to.not.be.empty();
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

								const messages = chrome.runtime.sendMessage.args;
								const commands = messages.map(arg => arg[0].command);

								expect(commands).to.contain('connectionTest');
								expect(commands).to.contain('getPlaylistFromDB');
								expect(commands).to.contain('getAllYouTubeTabs');
								expect(commands).to.contain('getCurrentTabId');

								// Call count:
								// 6 if we need to fetch from the YT API, we consequently need to update the DB
								// 4 if we don't need to fetch from the YT API
								if (needsYTAPIInteraction(input)) {
									expect(chrome.runtime.sendMessage.callCount).to.be(6);
									expect(commands).to.contain('getAPIKey');
									expect(commands).to.contain('updatePlaylistInfoInDB');
									const updateMessages = messages.filter(arg => arg[0].command === 'updatePlaylistInfoInDB');
									checkPlaylistsUploadedToDB(updateMessages, input);
								} else {
									expect(chrome.runtime.sendMessage.callCount).to.be(4);
								}

								const numDeletedVideosAfter = Object.keys(playlistInfoAfter.videos).filter(videoId => videoId.includes('DEL')).length;
								expect(numDeletedVideosAfter).to.be(0);
							});
						} else if (input.playlistModifiers.lastUpdatedDBAt === 'DBEntryIsUpToDate') {
							it('should only fetch data from the database', async function () {
								await chooseRandomVideo(input.channelId, false, domElement);

								const messages = chrome.runtime.sendMessage.args;
								const commands = messages.map(arg => arg[0].command);

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

								const messages = chrome.runtime.sendMessage.args;
								const commands = messages.map(arg => arg[0].command);

								// 6 because we need to fetch from the DB, fetch from the YT API, and update the DB
								expect(chrome.runtime.sendMessage.callCount).to.be(6);

								expect(commands).to.contain('connectionTest');
								expect(commands).to.contain('getPlaylistFromDB');
								expect(commands).to.contain('getAllYouTubeTabs');
								expect(commands).to.contain('getCurrentTabId');
								expect(commands).to.contain('getAPIKey');
								expect(commands).to.contain('updatePlaylistInfoInDB');
								const updateMessages = messages.filter(arg => arg[0].command === 'updatePlaylistInfoInDB');
								checkPlaylistsUploadedToDB(updateMessages, input);
							});
						}
						// Test special case where the database has an entry but no video data
						if (input.playlistId === 'UU_LocalPlaylistDidNotFetchDBRecently_DBEntryIsUpToDate_LocalPlaylistDoesNotExist_LocalPlaylistContainsNoDeletedVideos_NoNewVideoUploaded_DBContainsNoVideosNotInLocalPlaylist_LocalPlaylistContainsOnlyUnknownVideos') {
							it('should correctly handle the case that the database entry exists but has no videos', async function () {
								// Remove the video data from the database entry
								let newPlaylistInfoInDB = deepCopy(await chrome.runtime.sendMessage({ command: 'getPlaylistFromDB', data: input.playlistId }));
								delete newPlaylistInfoInDB["videos"];
								await chrome.runtime.sendMessage({ command: 'setKeyInDB', data: { key: input.playlistId, val: newPlaylistInfoInDB } });

								await chooseRandomVideo(input.channelId, false, domElement);

								const messages = chrome.runtime.sendMessage.args;
								const commands = messages.map(arg => arg[0].command);

								expect(chrome.runtime.sendMessage.callCount).to.be(8);

								// First two are from the test setup
								expect(commands).to.contain('setKeyInDB');
								const getPlaylistFromDBCount = commands.filter(command => command === 'getPlaylistFromDB').length;
								expect(getPlaylistFromDBCount).to.equal(2);
								expect(commands).to.contain('connectionTest');
								expect(commands).to.contain('getAPIKey');
								expect(commands).to.contain('updatePlaylistInfoInDB');
								const updateMessages = messages.filter(arg => arg[0].command === 'updatePlaylistInfoInDB');
								checkPlaylistsUploadedToDB(updateMessages, input);
								expect(commands).to.contain('getAllYouTubeTabs');
								expect(commands).to.contain('getCurrentTabId');

								// Get the entry from the database
								const playlistInfoInDB = await chrome.runtime.sendMessage({ command: 'getPlaylistFromDB', data: input.playlistId });
								expect(playlistInfoInDB).to.not.be(null);
								expect(Object.keys(playlistInfoInDB.videos).length).to.equal(10);
								// These are the videos that should be in the playlist, but due to some mistake were missing from the DB
								expect(playlistInfoInDB.videos).to.eql({ ...input.dbVideos });
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

								if (input.playlistModifiers.lastAccessedLocally !== 'LocalPlaylistDoesNotExist') {
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(playlistInfoBefore.lastAccessedLocally);
									// If we have not had to update the local playlist, the lastAccessedLocally should be updated but all other values should remain the same
									if (!needsDBInteraction(input)) {
										expect(playlistInfoAfter.lastFetchedFromDB).to.be(playlistInfoBefore.lastFetchedFromDB);
										expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
										expect(playlistInfoBefore.videos).to.have.keys(Object.keys(playlistInfoAfter.videos));
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
											expect(getAllVideosAsOneObject(playlistInfoAfter)).to.not.have.keys(Object.keys(input.localDeletedVideos));
										}
										expect({ ...input.localVideos, ...input.dbVideos, ...input.dbDeletedVideos }).to.have.keys(Object.keys(getAllVideosAsOneObject(playlistInfoAfter)));
										// The database and local playlist are in sync already
									} else {
										expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(playlistInfoBefore.lastFetchedFromDB);
										expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
										// By fetching the videos from the database, any deleted videos should have been removed from the local playlist
										// We also know that here, the db did not contain any deleted videos
										expect(getAllVideosAsOneObject(playlistInfoAfter)).to.have.keys(Object.keys({ ...input.localVideos, ...input.dbVideos }));
									}
								} else {
									// If the playlist did not exist locally before, it should now
									// Reminder: We did not interact with the YouTube API
									expect(playlistInfoAfter).to.be.an('object');
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(timeBefore);
									expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(timeBefore);
									expect(playlistInfoAfter.lastVideoPublishedAt).to.be(input.dbLastVideoPublishedAt);
									expect({ ...input.dbVideos, ...input.dbDeletedVideos }).to.have.keys(Object.keys(getAllVideosAsOneObject(playlistInfoAfter)))
								}
							});
							// For playlists that need to interact with the YouTube API
						} else {
							it('should correctly update the local playlist object', async function () {
								const timeBefore = new Date(Date.now() - 300000).toISOString(); // Add a small offset to be able to compare with greaterThan
								const playlistInfoBefore = await getKeyFromLocalStorage(input.playlistId);
								await chooseRandomVideo(input.channelId, false, domElement);
								const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);

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
											expect(getAllVideosAsOneObject(playlistInfoAfter)).to.have.keys(Object.keys({ ...input.localVideos, ...input.dbVideos }));
										} else if (input.playlistModifiers.lastUpdatedDBAt !== 'DBEntryDoesNotExist') {
											expect(playlistInfoAfter.videos).to.eql(playlistInfoBefore.videos);
										} else {
											// If the DB entry does not exist, we overwrite possible local knowledge about known videos and shorts
											expect(playlistInfoAfter.videos.knownVideos).to.eql({});
											expect(playlistInfoAfter.videos.knownShorts).to.eql({});
										}
										// If there are deleted videos, but no new videos
									} else if (input.playlistModifiers.dbContainsNewVideos === 'DBContainsDeletedVideos' && input.playlistModifiers.newUploadedVideos === 'NoNewVideoUploaded') {
										expect(playlistInfoAfter.lastVideoPublishedAt.substring(0, 10)).to.be(playlistInfoBefore.lastVideoPublishedAt.substring(0, 10));
										expect(getAllVideosAsOneObject(playlistInfoAfter)).to.have.keys(Object.keys(input.localVideos));
										expect({ ...getAllVideosAsOneObject(playlistInfoAfter), ...input.dbDeletedVideos }).to.have.keys(Object.keys(getAllVideosAsOneObject(playlistInfoAfter)));
										// If there were new videos, either in the DB or uploaded
									} else {
										expect(playlistInfoAfter.lastVideoPublishedAt).to.be.greaterThan(playlistInfoBefore.lastVideoPublishedAt);
										expect({ ...input.localVideos, ...input.dbVideos, ...input.dbDeletedVideos, ...input.newUploadedVideos }).to.have.keys(Object.keys(getAllVideosAsOneObject(playlistInfoAfter)));
									}
								} else {
									// If the playlist did not exist locally before, it should now
									// Reminder: We interacted with the YouTube API
									expect(playlistInfoAfter).to.be.an('object');
									expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(timeBefore);
									expect(playlistInfoAfter.lastFetchedFromDB).to.be.greaterThan(timeBefore);
									expect(playlistInfoAfter.lastVideoPublishedAt.substring(0, 10)).to.be(input.newLastVideoPublishedAt.substring(0, 10));
									expect({ ...input.localVideos, ...input.dbVideos, ...input.dbDeletedVideos, ...input.newUploadedVideos }).to.have.keys(Object.keys(getAllVideosAsOneObject(playlistInfoAfter)))
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