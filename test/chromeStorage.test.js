import expect from 'expect.js';

import { configSync, setSyncStorageValue, getUserQuotaRemainingToday } from '../src/chromeStorage.js';
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
				expect(setArgs[setArgs.length - 1]).to.eql([configSyncDefaults]);

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

});