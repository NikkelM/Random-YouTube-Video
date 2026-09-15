import expect from 'expect.js';

import { configSync, setSyncStorageValue, setSyncStorageValues, removeSyncStorageValue, getUserQuotaRemainingToday, validateConfigSync } from '../src/chromeStorage.js';
import { configSyncDefaults } from '../src/config.js';

describe('chromeStorage', function () {

	context('configSync', function () {
		// This test *must* be the very first one, as otherwise number of set calls will be different, and we can only get the validation run once at import time
		it('should correctly remove and add keys when validating', async function () {
			try {
				const setArgs = chrome.storage.sync.set.args;
				const removeArgs = chrome.storage.sync.remove.args;
				const clearArgs = chrome.storage.sync.clear.args;

				expect(setArgs.length).to.be(2 + Object.keys(configSyncDefaults).length);
				expect(setArgs[0]).to.eql([{ 'thisKeyShouldBeRemoved': 'thisValueShouldBeRemoved' }]);
				for (let i = 0; i < Object.keys(configSyncDefaults).length; i++) {
					expect(setArgs[i + 1]).to.eql([{ [Object.keys(configSyncDefaults)[i]]: Object.values(configSyncDefaults)[i] }]);
				}

				expect(removeArgs).to.eql([["thisKeyShouldBeRemoved"]]);

				expect(clearArgs).to.eql([]);
			} catch (e) {
				e.message = 'As this test failed, it either did not run as the first test, or the testSetup was changed\n\t' + e.message;
				throw e;
			}
		});

		it('should be an object', function () {
			expect(configSync).to.be.an('object');
		});

		it('should be cleared correctly', function () {
			expect(configSync).to.not.eql({});
			chrome.storage.sync.clear();
			expect(configSync).to.eql({});
		});
	});

	context('setSyncStorageValue()', function () {
		it('should set the value in the configSync object', async function () {
			await setSyncStorageValue("testKey1", "testValue1");

			expect(configSync).to.have.key("testKey1");
			expect(configSync.testKey1).to.be("testValue1");
		});

		it('should overwrite the value in the configSync object', async function () {
			await setSyncStorageValue("testKey2", "testValue2");

			expect(configSync).to.have.key("testKey2");
			expect(configSync.testKey2).to.be("testValue2");

			await setSyncStorageValue("testKey2", "testValue2b");

			expect(configSync).to.have.key("testKey2");
			expect(configSync.testKey2).to.be("testValue2b");
		});

		// Our implementation does not merge objects but replace them, so we make sure that behavior is consistent
		it('should not merge the value in the configSync object', async function () {
			await setSyncStorageValue("testKey3", { "testKey3a": "testValue3a" });

			expect(configSync).to.have.key("testKey3");
			expect(configSync.testKey3).to.have.key("testKey3a");

			await setSyncStorageValue("testKey3", { "testKey3b": "testValue3b" });

			expect(configSync).to.have.key("testKey3");
			expect(configSync.testKey3).to.have.key("testKey3b");
		});

		// Every write counts towards the sync storage quota, which users can run into when shuffling or browsing a lot
		it('should not write to storage if the value did not change', async function () {
			await setSyncStorageValue("testKey5", "testValue5");
			const numSetCalls = chrome.storage.sync.set.callCount;

			await setSyncStorageValue("testKey5", "testValue5");

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls);
			expect(configSync.testKey5).to.be("testValue5");
		});

		it('should not write to storage if an object with the same contents is set', async function () {
			await setSyncStorageValue("testKey6", { "a": 1 });
			const numSetCalls = chrome.storage.sync.set.callCount;

			await setSyncStorageValue("testKey6", { "a": 1 });

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls);

			await setSyncStorageValue("testKey6", { "a": 2 });

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls + 1);
			expect(configSync.testKey6).to.eql({ "a": 2 });
		});

		// A value taken from configSync and then changed is still the same reference, so its contents cannot tell us whether it was modified
		it('should write to storage if the stored object was mutated in place', async function () {
			await setSyncStorageValue("testKey12", { "a": 1 });
			const numSetCalls = chrome.storage.sync.set.callCount;

			const mutatedValue = configSync.testKey12;
			mutatedValue.a = 2;
			await setSyncStorageValue("testKey12", mutatedValue);

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls + 1);
			expect(configSync.testKey12).to.eql({ "a": 2 });
		});
	});

	context('setSyncStorageValues()', function () {
		it('should set multiple values in one write', async function () {
			const numSetCalls = chrome.storage.sync.set.callCount;

			await setSyncStorageValues({ "testKey7": "testValue7", "testKey8": "testValue8" });

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls + 1);
			expect(configSync.testKey7).to.be("testValue7");
			expect(configSync.testKey8).to.be("testValue8");
		});

		it('should not write to storage if no value changed', async function () {
			await setSyncStorageValues({ "testKey9": "testValue9" });
			const numSetCalls = chrome.storage.sync.set.callCount;

			await setSyncStorageValues({ "testKey9": "testValue9" });

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls);
		});

		it('should only write the values that changed', async function () {
			await setSyncStorageValues({ "testKey10": "testValue10", "testKey11": "testValue11" });
			const numSetCalls = chrome.storage.sync.set.callCount;

			await setSyncStorageValues({ "testKey10": "testValue10", "testKey11": "testValue11b" });

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls + 1);
			expect(chrome.storage.sync.set.lastCall.args[0]).to.eql({ "testKey11": "testValue11b" });
		});
	});

	context('removeSyncStorageValue()', function () {
		it('should remove the value from the configSync object', async function () {
			await setSyncStorageValue("testKey4", "testValue4");

			expect(configSync).to.have.key("testKey4");
			expect(configSync.testKey4).to.be("testValue4");

			await removeSyncStorageValue("testKey4");

			expect(configSync).to.not.have.key("testKey4");
		});
	});

	context('getUserQuotaRemainingToday()', function () {
		it('should return the number of requests the user can still make to the Youtube API today', async function () {
			await setSyncStorageValue("userQuotaRemainingToday", 20);

			let quota = await getUserQuotaRemainingToday();
			expect(quota).to.be(20);
		});

		it('should reset the quota if the reset time has passed', async function () {
			await setSyncStorageValue("userQuotaRemainingToday", 1);

			let quota = await getUserQuotaRemainingToday();
			expect(quota).to.be(1);

			await setSyncStorageValue("userQuotaResetTime", new Date(new Date().setSeconds(new Date().getSeconds() - 10)).getTime());

			quota = await getUserQuotaRemainingToday();
			expect(quota).to.be(200);
		});

		it('should set the reset time to midnight after a reset', async function () {
			await setSyncStorageValue("userQuotaResetTime", new Date(new Date().setSeconds(new Date().getSeconds() - 10)).getTime());

			await getUserQuotaRemainingToday();

			// Check that the reset time is set to midnight
			expect(configSync.userQuotaResetTime).to.be(new Date(new Date().setHours(24, 0, 0, 0)).getTime());
		});
	});

	context('validateConfigSync()', function () {
		context('fix incorrect settings', async function () {
			it('should reset the useCustomApiKeyOption if no API key is set', async function () {
				await setSyncStorageValue("useCustomApiKeyOption", true);
				await setSyncStorageValue("customYoutubeApiKey", null);

				await validateConfigSync();

				expect(configSync.useCustomApiKeyOption).to.be(false);
			});

			it('should enable database sharing if no API key is set', async function () {
				await setSyncStorageValue("useCustomApiKeyOption", false);
				await setSyncStorageValue("databaseSharingEnabledOption", false);

				await validateConfigSync();

				expect(configSync.databaseSharingEnabledOption).to.be(true);
			});

			it('should disable reusing the new tab if shuffling does not open a new tab', async function () {
				await setSyncStorageValue("shuffleOpenInNewTabOption", false);
				await setSyncStorageValue("shuffleReUseNewTabOption", true);

				await validateConfigSync();

				expect(configSync.shuffleReUseNewTabOption).to.be(false);
			});

			it('should ensure valid values are set for ignoring shorts (0-2)', async function () {
				// Too small
				await setSyncStorageValue("shuffleIgnoreShortsOption", -1);

				await validateConfigSync();

				expect(configSync.shuffleIgnoreShortsOption).to.be(1);

				// Too large
				await setSyncStorageValue("shuffleIgnoreShortsOption", 3);

				await validateConfigSync();

				expect(configSync.shuffleIgnoreShortsOption).to.be(1);
			});

			it('should ensure valid values are set for the number of videos in a playlist', async function () {
				// Too small
				await setSyncStorageValue("shuffleNumVideosInPlaylist", 0);

				await validateConfigSync();

				expect(configSync.shuffleNumVideosInPlaylist).to.be(10);

				// Too large
				await setSyncStorageValue("shuffleNumVideosInPlaylist", 51);

				await validateConfigSync();

				expect(configSync.shuffleNumVideosInPlaylist).to.be(10);
			});
		});
	});

});