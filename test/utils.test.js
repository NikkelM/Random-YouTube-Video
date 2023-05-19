var expect = require('expect.js');
const sinon = require('sinon');
var rewire = require('rewire');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const testUtils = rewire('./testUtils.js');

const utils = rewire('../extension/js/utils.js');

describe('utils.js', function () {

	let mockChrome, setupMockSyncStorageObject, setupMockLocalStorageObject;
	global.configSync = {}, global.mockLocalStorageObject = {};

	this.beforeAll(function () {
		mockChrome = testUtils.__get__('mockChrome');

		global.chrome = mockChrome();

		setupMockSyncStorageObject = testUtils.__get__('setupMockSyncStorageObject');
		setupMockLocalStorageObject = testUtils.__get__('setupMockLocalStorageObject');
	});

	// Restore the original chrome object
	this.afterAll(function () {
		delete global.chrome;
	});

	context('console helpers', function () {

		it('should reroute console.log', function () {
			let spy = sinon.spy(console, 'log');
			console.log("Test log");

			expect(spy.calledOnce).to.be(true);
			expect(spy.calledWith("Test log")).to.be(true);
		});

		it('should reroute console.warn', function () {
			let spy = sinon.spy(console, 'warn');
			console.warn("Test warning");

			expect(spy.calledOnce).to.be(true);
			expect(spy.calledWith("Test warning")).to.be(true);
		});

		it('should reroute console.error', function () {
			let spy = sinon.spy(console, 'error');
			console.error("Test error");

			expect(spy.calledOnce).to.be(true);
			expect(spy.calledWith("Test error")).to.be(true);
		});

	});

	context('DOM helpers', function () {

		// Before each test, create a dummy document element
		var dom;
		beforeEach(function () {
			dom = new JSDOM(`<!DOCTYPE html><body><span id="test-span"></span></body>`);
			dom.window.document.getElementById("test-span").innerText = "Before";
		});

		context('setDOMTextWithDelay()', function () {
			const setDOMTextWithDelay = utils.__get__('setDOMTextWithDelay');

			it('should replace DOM text with default predicate', async function () {
				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				setDOMTextWithDelay(dom.window.document.getElementById("test-span"), "After", 30);

				await new Promise(r => setTimeout(r, 10));
				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				await new Promise(r => setTimeout(r, 30));
				expect(dom.window.document.getElementById("test-span").innerText).to.be("After");
			});

			it('should replace DOM text if custom predicate is true', async function () {
				const someBoolean = true;
				const predicate = () => { return dom.window.document.getElementById("test-span").innerText === "Before" && someBoolean; };

				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				setDOMTextWithDelay(dom.window.document.getElementById("test-span"), "After", 30, predicate);

				await new Promise(r => setTimeout(r, 10));
				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				await new Promise(r => setTimeout(r, 30));
				expect(dom.window.document.getElementById("test-span").innerText).to.be("After");
			});

			it('should not replace DOM text if predicate is false', async function () {
				const someBoolean = false;
				const predicate = () => { return dom.window.document.getElementById("test-span").innerText === "Before" && someBoolean; };

				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				setDOMTextWithDelay(dom.window.document.getElementById("test-span"), "After", 20, predicate);

				await new Promise(r => setTimeout(r, 30));
				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");
			});
		});
	});

	context('URL helpers', function () {

		context('isVideoUrl()', function () {
			const isVideoUrl = utils.__get__('isVideoUrl');

			it('should not break if no URL is provided', function () {
				expect(isVideoUrl(null)).to.be(false);
				expect(isVideoUrl(undefined)).to.be(false);
				expect(isVideoUrl("")).to.be(false);
			});

			it('should identify a YouTube video URL', function () {
				expect(isVideoUrl("https://www.youtube.com/watch?v=12345678901")).to.be(true);
			});

			it('should identify a YouTube non-video URL', function () {
				expect(isVideoUrl("https://www.youtube.com/channel/myChannelID")).to.be(false);
				expect(isVideoUrl("https://www.youtube.com/@Username")).to.be(false);
				expect(isVideoUrl("https://www.youtube.com")).to.be(false);
				expect(isVideoUrl("https://www.youtube.com/playlist?list=PL1234567890")).to.be(false);
			});

		});

		context('loadJsonFile()', function () {
			const loadJsonFile = utils.__get__('loadJsonFile');

			// Mock the XMLHttpRequest object
			let xhr, requests;
			beforeEach(function () {
				// Replace XMLHttpRequest with FakeXMLHttpRequest
				xhr = sinon.useFakeXMLHttpRequest();
				global.XMLHttpRequest = xhr;

				requests = [];

				xhr.onCreate = function (xhr) {
					requests.push(xhr);
				};
			});

			afterEach(function () {
				// Restore original XMLHttpRequest
				xhr.restore();
			});

			it('should load a JSON file', async function () {
				let json = loadJsonFile("test/test.json");

				// Fake the response
				requests[0].respond(200, { "Content-Type": "application/json" }, '{ "test": "test" }');

				json = await json;

				expect(json).to.be.an('object');
				expect(json.test).to.be("test");
			});

			it('should throw an error if the file is not found', async function () {
				let json = loadJsonFile("test/doesNotExist.json");

				// Fake the response
				requests[0].respond(404);

				try {
					json = await json;
					expect(true).to.be(false);
				} catch (e) {
					expect(e.message).to.be("Not Found");
				}

			}
			);

		});
	});

	context('utilities', function () {

		context('isEmpty()', function () {
			const isEmpty = utils.__get__('isEmpty');

			it('should return true for empty objects', function () {
				expect(isEmpty({})).to.be(true);
			});

			it('should return false for non-empty objects', function () {
				expect(isEmpty({ "test": "test" })).to.be(false);
			});

			it('should return true for empty arrays', function () {
				expect(isEmpty([])).to.be(true);
			});

			it('should return false for non-empty arrays', function () {
				expect(isEmpty(["test"])).to.be(false);
			});
		});

		context('getLength()', function () {
			const getLength = utils.__get__('getLength');

			it('should return 0 for empty objects', function () {
				expect(getLength({})).to.be(0);
			});

			it('should return the number of keys for non-empty objects', function () {
				expect(getLength({ "test": "test" })).to.be(1);
				expect(getLength({ "test": "test", "test2": "test2" })).to.be(2);
			});

			it('should return 0 for empty arrays', function () {
				expect(getLength([])).to.be(0);
			});

			it('should return the number of elements for non-empty arrays', function () {
				expect(getLength(["test"])).to.be(1);
				expect(getLength(["test", "test2"])).to.be(2);
			});
		});

		context('addHours()', function () {
			const addHours = utils.__get__('addHours');

			it('should add hours to a date', function () {
				let date = new Date("2019-01-01T00:00:00Z");
				date = addHours(date, 1);
				expect(date.toISOString()).to.be("2019-01-01T01:00:00.000Z");
			});

			it('should add negative hours to a date', function () {
				let date = new Date("2019-01-01T00:00:00Z");
				date = addHours(date, -1);
				expect(date.toISOString()).to.be("2018-12-31T23:00:00.000Z");
			});
		});

	});

	context('browser storage', function () {

		this.beforeEach(async function () {
			await setupMockSyncStorageObject();
			await setupMockLocalStorageObject();
		});

		context('fetchConfigSync()', function () {
			const fetchConfigSync = utils.__get__('fetchConfigSync');

			it('should return the correct config', async function () {
				let config = await fetchConfigSync();

				// Only test for some properties, a full test is done separately
				expect(config).to.be.an('object');
				expect(config).to.have.property('shuffleOpenInNewTabOption');
				expect(config.customYoutubeApiKey).to.be(null);
				expect(config.channelSettings).to.be.an('object');
				expect(config.channelSettings).to.be.empty;
			});
		});

		context('setSyncStorageValue()', function () {
			const setSyncStorageValue = utils.__get__('setSyncStorageValue');

			this.beforeAll(async function () {
				// Spy on chrome.runtime.sendMessage() to check if it is called
				sinon.spy(chrome.runtime, "sendMessage");
				sinon.spy(chrome.storage.sync, "set");
			});

			this.beforeEach(async function () {
				// Reset the spies
				chrome.runtime.sendMessage.resetHistory();
				chrome.storage.sync.set.resetHistory();
			});

			it('should set the correct value in the global config object', async function () {
				await setSyncStorageValue("testAddedKeyGlobal", "testAddedValGlobal");

				expect(configSync.testAddedKeyGlobal).to.be("testAddedValGlobal");
				expect(chrome.runtime.sendMessage.calledOnce).to.be(true);
				expect(chrome.storage.sync.set.calledOnce).to.be(true);
				expect(chrome.runtime.sendMessage.calledWith({ command: "newConfigSync", data: configSync })).to.be(true);

				expect(chrome.runtime.sendMessage.returnValues[0]).to.equal("New configSync set.");
			});

			it('should set the correct value in the passed config object', async function () {
				let passedConfigSync = {};
				await setSyncStorageValue("testAddedKeyPassed", "testAddedValPassed", passedConfigSync);

				expect(passedConfigSync.testAddedKeyPassed).to.be("testAddedValPassed");
				expect(chrome.runtime.sendMessage.calledOnce).to.be(true);
				expect(chrome.storage.sync.set.calledOnce).to.be(true);

				expect(chrome.runtime.sendMessage.calledWith({ command: "newConfigSync", data: configSync })).to.be(true);
			});

			it('should correctly overwrite the global configSync object with the new one', async function () {
				let passedConfigSync = {};
				// Remember what the configSync was before to make sure it was replaced
				let configSyncBefore = configSync;

				await setSyncStorageValue("testAddedKeyPassed", "testAddedValPassed", passedConfigSync);

				expect(passedConfigSync.testAddedKeyPassed).to.be("testAddedValPassed");
				expect(chrome.runtime.sendMessage.calledOnce).to.be(true);
				expect(chrome.storage.sync.set.calledOnce).to.be(true);
				
				expect(chrome.runtime.sendMessage.calledWith({ command: "newConfigSync", data: passedConfigSync })).to.be(true);
				expect(chrome.runtime.sendMessage.calledWith({ command: "newConfigSync", data: configSyncBefore })).to.be(false);
				// Make sure the global configSync object was replaced
				expect(configSync).to.equal(passedConfigSync);
			});

		});
	});

})