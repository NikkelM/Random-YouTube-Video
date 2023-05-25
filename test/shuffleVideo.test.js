import expect from 'expect.js';
import sinon from 'sinon';

import { RandomYoutubeVideoError } from '../src/utils.js';
import { chooseRandomVideo } from '../src/shuffleVideo.js';
import { configSync } from '../src/chromeStorage.js';

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

// Utility to get a date object from x days ago, and a bit earlier to offset for delays, as an ISO string
function daysAgoMinusOffset(x) {
	return new Date(Date.now() - x * 24 * 60 * 60 * 1000 - 1000).toISOString();
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
		context('playlists with different states', function () {

			// There are three modifiers to the playlist state, which influence what chooseRandomVideo() does:
			// 1. Whether the playlist has been fetched from the database recently
			// 2. Whether the playlist is up-to-date in the database
			// 3. Whether the playlist has been accessed locally recently
			// These correspond to the following entries in the playlist object:
			// 1. lastFetchedFromDB 		(saved locally only)
			// 2. lastUpdatedDBAt				(saved in DB only)	
			// 3. lastAccessedLocally		(saved locally only)
			// They are created in playlistPermutations.js

			context('DB up-to-date and recently accessed playlist', function () {
				const channelId = "UC-DBRecentlyFetchedDBUpToDateLocallyAccessedRecently";
				const playlistId = "UU-DBRecentlyFetchedDBUpToDateLocallyAccessedRecently";

				it('should have a valid test playlist set up', async function () {
					// The playlist tested in this context is up-to-date in the database and has been accessed locally recently
					expect(await getKeyFromLocalStorage(playlistId)).to.be.ok();
					const testedPlaylist = await getKeyFromLocalStorage(playlistId);

					expect(testedPlaylist.lastAccessedLocally).to.be.greaterThan(daysAgoMinusOffset(0));
					expect(testedPlaylist.lastFetchedFromDB).to.be.greaterThan(daysAgoMinusOffset(0));
					expect(testedPlaylist.lastVideoPublishedAt).to.be.greaterThan(daysAgoMinusOffset(3));
				});

				it('should correctly update the local playlist object', async function () {
					const mockResponses = [
						{ status: 200 }
					];
					setUpMockResponses(mockResponses);

					const playlistInfoBefore = await getKeyFromLocalStorage(playlistId);
					await chooseRandomVideo(channelId, false, null);
					const playlistInfoAfter = await getKeyFromLocalStorage(playlistId);

					// expect the playlist last accessed to be more recent, and all others to be the same
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
					await chooseRandomVideo(channelId, false, null);
					const userQuotaRemainingTodayAfter = configSync.userQuotaRemainingToday;

					expect(userQuotaRemainingTodayAfter).to.be(userQuotaRemainingTodayBefore);
				});

				it('should only send the correct messages to the background script', async function () {
					const mockResponses = [
						{ status: 200 }
					];
					setUpMockResponses(mockResponses);

					await chooseRandomVideo(channelId, false, null);

					expect(chrome.runtime.sendMessage.calledOnce).to.be(true);
					expect(chrome.runtime.sendMessage.calledWith({ command: "getAllYouTubeTabs" })).to.be(true);
				});

				it('should not interact with the database', async function () {
					const mockResponses = [
						{ status: 200 }
					];
					setUpMockResponses(mockResponses);

					await chooseRandomVideo(channelId, false, null);

					expect(chrome.runtime.sendMessage.calledOnce).to.be(true);
					expect(chrome.runtime.sendMessage.calledWith({ command: "getPlaylistFromDB" })).to.be(false);
					expect(chrome.runtime.sendMessage.calledWith({ command: "updatePlaylistInfoInDB" })).to.be(false);
					expect(chrome.runtime.sendMessage.calledWith({ command: "overwritePlaylistInfoInDB" })).to.be(false);
				});

			});

		});

	});

});