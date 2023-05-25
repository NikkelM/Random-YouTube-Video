import expect from 'expect.js';
import sinon from 'sinon';

import { RandomYoutubeVideoError } from '../src/utils.js';
import { chooseRandomVideo } from '../src/shuffleVideo.js';
import { configSync } from '../src/chromeStorage.js';
import { times, playlistModifiers, localPlaylistPermutations, databasePermutations } from './playlistPermutations.js';

// Utility to get the contents of localStorage at a certain key
async function getKeyFromLocalStorage(key) {
	return await chrome.storage.local.get([key]).then((result) => {
		if (result[key]) {
			return result[key];
		}
		return {};
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

	before(function () {
		// Disable console logging from the tested code
		sinon.stub(console, 'log');
	});

	beforeEach(function () {
		chrome.runtime.sendMessage.resetHistory();
	});

	afterEach(function () {
		delete global.fetch;
	});

	after(function () {
		console.log.restore();
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

			// There are three modifiers to the playlist state, which influence what chooseRandomVideo() does:
			// 1. Whether the playlist has been fetched from the database recently
			// 2. Whether the playlist is up-to-date in the database
			// 3. Whether the playlist has been accessed locally recently
			// These correspond to the following entries in the playlist object:
			// 1. lastFetchedFromDB 		(saved locally only)
			// 2. lastUpdatedDBAt				(saved in DB only)	
			// 3. lastAccessedLocally		(saved locally only)
			// They are created in playlistPermutations.js

			const inputs = [];
			for (let i = 0; i < playlistModifiers[0].length; i++) {
				for (let j = 0; j < playlistModifiers[1].length; j++) {
					for (let k = 0; k < playlistModifiers[2].length; k++) {
						inputs.push({
							lastFetchedFromDB: (playlistModifiers[0][i] === "DBRecentlyFetched") ? times.zeroDaysAgo : times.fourteenDaysAgo,
							// lastUpdatedDBAt: playlistModifiers[1][j],
							lastAccessedLocally: (playlistModifiers[2][k] === "LocallyAccessedRecently") ? times.zeroDaysAgo : times.fourteenDaysAgo,
							lastVideoPublishedAt: times.threeDaysAgo,
							playlistId: `UU-${playlistModifiers[0][i]}${playlistModifiers[1][j]}${playlistModifiers[2][k]}`,
							channelId: `UC-${playlistModifiers[0][i]}${playlistModifiers[1][j]}${playlistModifiers[2][k]}`
						});
					}
				}
			}

			inputs.forEach(function (input) {
				context(`playlist ${input.playlistId}`, function () {

					it('should have a valid test playlist set up', async function () {
						expect(await getKeyFromLocalStorage(input.playlistId)).to.be.ok();
						const testedPlaylist = await getKeyFromLocalStorage(input.playlistId);

						expect(testedPlaylist.lastAccessedLocally).to.be(input.lastAccessedLocally);
						expect(testedPlaylist.lastFetchedFromDB).to.be(input.lastFetchedFromDB);
						expect(testedPlaylist.lastVideoPublishedAt).to.be(input.lastVideoPublishedAt);
					});

					// No database access required for these playlists
					if (input.lastFetchedFromDB === times.zeroDaysAgo) {
						// TODO: This test should work for all inputs, but we haven't mocked the youtube api and database yet
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

						it('should not change the userQuotaRemainingToday', async function () {
							const mockResponses = [
								{ status: 200 }
							];
							setUpMockResponses(mockResponses);

							const userQuotaRemainingTodayBefore = configSync.userQuotaRemainingToday;
							await chooseRandomVideo(input.channelId, false, null);
							const userQuotaRemainingTodayAfter = configSync.userQuotaRemainingToday;

							expect(userQuotaRemainingTodayAfter).to.be(userQuotaRemainingTodayBefore);
						});

						it('should not interact with the database', async function () {
							const mockResponses = [
								{ status: 200 }
							];
							setUpMockResponses(mockResponses);

							await chooseRandomVideo(input.channelId, false, null);

							expect(chrome.runtime.sendMessage.calledOnce).to.be(true);
							expect(chrome.runtime.sendMessage.calledWith({ command: "getPlaylistFromDB" })).to.be(false);
							expect(chrome.runtime.sendMessage.calledWith({ command: "updatePlaylistInfoInDB" })).to.be(false);
							expect(chrome.runtime.sendMessage.calledWith({ command: "overwritePlaylistInfoInDB" })).to.be(false);
						});

					}

				});
			});

		});

	});

});