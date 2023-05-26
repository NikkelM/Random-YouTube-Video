import expect from 'expect.js';
import sinon from 'sinon';

import { RandomYoutubeVideoError } from '../src/utils.js';
import { chooseRandomVideo } from '../src/shuffleVideo.js';
import { configSync } from '../src/chromeStorage.js';
import { times, playlistPermutations, localPlaylistPermutations, databasePermutations } from './playlistPermutations.js';

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

// Utility to get a date object from x days ago, plus an additional five minutes
function daysAgoMinusOffset(x) {
	return new Date(Date.now() - x * 24 * 60 * 60 * 1000 - 300000).toISOString();
}

function setUpMockResponses(mockResponses) {
	// Repeats the last response if there are no more responses set up
	global.fetch = sinon.stub().callsFake(() => {
		if (mockResponses.length > 1) {
			return Promise.resolve(mockResponses.shift());
		}
		return Promise.resolve(mockResponses[0]);
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

		// Test the function for different playlist states:
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
						newUploadedVideos: playlistModifiers[4][m]
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

					it('should have a valid localStorage setup', async function () {
						const testedPlaylistLocally = await getKeyFromLocalStorage(input.playlistId);

						// Only for playlists that should exist locally
						if (input.playlistModifiers.lastAccessedLocally !== 'PlaylistDoesNotExistLocally') {
							expect(testedPlaylistLocally).to.be.an('object');
							expect(testedPlaylistLocally.lastAccessedLocally).to.be(input.lastAccessedLocally);
							expect(testedPlaylistLocally.lastFetchedFromDB).to.be(input.lastFetchedFromDB);
							expect(testedPlaylistLocally.lastVideoPublishedAt).to.be(input.localLastVideoPublishedAt);
							expect(testedPlaylistLocally.videos).to.be.an('object');
							expect(testedPlaylistLocally.videos).to.eql(input.localVideos);
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
							expect(testedPlaylistInDB.videos).to.eql(input.dbVideos);
						} else {
							// For non-existent playlists, the database should not contain an entry
							expect(testedPlaylistInDB).to.be(null);
						}
					});

					// TODO: Undo only for playlists that do not need to be updated from the database and exist locally
					if (input.playlistModifiers.lastFetchedFromDB === 'LocalPlaylistFetchedDBRecently' && input.playlistModifiers.lastAccessedLocally !== 'PlaylistDoesNotExistLocally') {
						it('should correctly update the local playlist object', async function () {
							const mockResponses = [
								{ status: 200 }
							];
							setUpMockResponses(mockResponses);

							const playlistInfoBefore = await getKeyFromLocalStorage(input.playlistId);
							await chooseRandomVideo(input.channelId, false, null);
							const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);

							expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(playlistInfoBefore.lastAccessedLocally);
							expect(playlistInfoAfter.lastFetchedFromDB).to.be(playlistInfoBefore.lastFetchedFromDB);
							expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
						});
					}

				});
			});

			// inputs.forEach(function (input) {
			// 	context(`playlist ${input.playlistId}`, function () {

			// 		// No database access required for these playlists
			// 		if (input.lastFetchedFromDB === times.zeroDaysAgo) {
			// 			// TODO: This test should work for all inputs, but we haven't mocked the youtube api and database yet
			// 			it('should correctly update the local playlist object', async function () {
			// 				const mockResponses = [
			// 					{ status: 200 }
			// 				];
			// 				setUpMockResponses(mockResponses);

			// 				const playlistInfoBefore = await getKeyFromLocalStorage(input.playlistId);
			// 				await chooseRandomVideo(input.channelId, false, null);
			// 				const playlistInfoAfter = await getKeyFromLocalStorage(input.playlistId);

			// 				expect(playlistInfoAfter.lastAccessedLocally).to.be.greaterThan(playlistInfoBefore.lastAccessedLocally);
			// 				expect(playlistInfoAfter.lastFetchedFromDB).to.be(playlistInfoBefore.lastFetchedFromDB);
			// 				expect(playlistInfoAfter.lastVideoPublishedAt).to.be(playlistInfoBefore.lastVideoPublishedAt);
			// 			});

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