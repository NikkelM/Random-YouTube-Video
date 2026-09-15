import expect from 'expect.js';

import { configSync, setSyncStorageValue } from '../src/chromeStorage.js';
import { setChannelSetting, removeChannelSetting } from '../src/html/popup/popupUtils.js';

describe('popupUtils', function () {

	// Channel settings must never be mutated in place, as a write of an unchanged reference is skipped to save the sync storage quota
	context('setChannelSetting()', function () {
		beforeEach(async function () {
			await setSyncStorageValue("channelSettings", {});
		});

		it('should persist a new setting to sync storage', async function () {
			const numSetCalls = chrome.storage.sync.set.callCount;

			await setChannelSetting("testChannelId", "activeOption", "percentageOption");

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls + 1);
			expect(chrome.storage.sync.set.lastCall.args[0]).to.eql({ "channelSettings": { "testChannelId": { "activeOption": "percentageOption" } } });
			expect(configSync.channelSettings).to.eql({ "testChannelId": { "activeOption": "percentageOption" } });
		});

		it('should persist settings that are added one after another', async function () {
			await setChannelSetting("testChannelId", "activeOption", "percentageOption");
			const numSetCalls = chrome.storage.sync.set.callCount;

			await setChannelSetting("testChannelId", "percentageValue", 50);

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls + 1);
			expect(chrome.storage.sync.set.lastCall.args[0]).to.eql({ "channelSettings": { "testChannelId": { "activeOption": "percentageOption", "percentageValue": 50 } } });
		});

		it('should persist an updated value for an existing setting', async function () {
			await setChannelSetting("testChannelId", "percentageValue", 50);
			const numSetCalls = chrome.storage.sync.set.callCount;

			await setChannelSetting("testChannelId", "percentageValue", 25);

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls + 1);
			expect(configSync.channelSettings.testChannelId.percentageValue).to.be(25);
		});

		it('should not touch the settings of other channels', async function () {
			await setChannelSetting("testChannelId", "activeOption", "percentageOption");

			await setChannelSetting("otherTestChannelId", "activeOption", "dateOption");

			expect(configSync.channelSettings).to.eql({
				"testChannelId": { "activeOption": "percentageOption" },
				"otherTestChannelId": { "activeOption": "dateOption" }
			});
		});

		it('should not write to storage if the setting already has the same value', async function () {
			await setChannelSetting("testChannelId", "percentageValue", 50);
			const numSetCalls = chrome.storage.sync.set.callCount;

			await setChannelSetting("testChannelId", "percentageValue", 50);

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls);
		});
	});

	context('removeChannelSetting()', function () {
		beforeEach(async function () {
			await setSyncStorageValue("channelSettings", {});
		});

		it('should persist the removal of a setting', async function () {
			await setChannelSetting("testChannelId", "activeOption", "percentageOption");
			await setChannelSetting("testChannelId", "percentageValue", 50);
			const numSetCalls = chrome.storage.sync.set.callCount;

			await removeChannelSetting("testChannelId", "percentageValue");

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls + 1);
			expect(chrome.storage.sync.set.lastCall.args[0]).to.eql({ "channelSettings": { "testChannelId": { "activeOption": "percentageOption" } } });
		});

		it('should remove the channel entirely if its last setting is removed', async function () {
			await setChannelSetting("testChannelId", "percentageValue", 50);

			await removeChannelSetting("testChannelId", "percentageValue");

			expect(configSync.channelSettings).to.eql({});
		});

		it('should not write to storage if the channel has no settings', async function () {
			const numSetCalls = chrome.storage.sync.set.callCount;

			await removeChannelSetting("testChannelId", "percentageValue");

			expect(chrome.storage.sync.set.callCount).to.be(numSetCalls);
		});
	});

});
