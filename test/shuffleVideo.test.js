const expect = require('expect.js');
const sinon = require('sinon');
const rewire = require('rewire');

const testUtils = rewire('./testUtils.js');

const utils = rewire('../extension/js/utils.js');
const shuffleVideo = rewire('../extension/js/shuffleVideo.js');

describe('shuffleVideo.js', function () {
	const mockFetch = testUtils.__get__('mockFetch');

	let mockChrome, setupMockSyncStorageObject, setupMockLocalStorageObject;

	this.beforeAll(function () {
		mockChrome = testUtils.__get__('mockChrome');

		global.configSync = {}, global.mockLocalStorageObject = {};
		global.chrome = mockChrome();

		setupMockSyncStorageObject = testUtils.__get__('setupMockSyncStorageObject');
		setupMockLocalStorageObject = testUtils.__get__('setupMockLocalStorageObject');
	});

	// Restore everything
	this.afterAll(function () {
		delete global.chrome;
		delete global.configSync;
		delete global.mockLocalStorageObject;
	});

	context('testVideoExistence()', function () {
		const testVideoExistence = shuffleVideo.__get__('testVideoExistence');

		it('should return true if the video exists', async function () {
			mockFetch(shuffleVideo, { status: 200 });

			const videoId = 'thisExists';
			const videoExists = await testVideoExistence(videoId);
			expect(videoExists).to.be(true);
		});

		it('should return false if the video does not exist', async function () {
			mockFetch(shuffleVideo, { status: 400 });

			const videoId = 'thisDoesNotExist';
			const videoExists = await testVideoExistence(videoId);
			expect(videoExists).to.be(false);
		});

	});

});