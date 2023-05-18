var expect = require('expect.js');
const sinon = require('sinon');
var rewire = require('rewire');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const utils = rewire('../extension/js/utils.js');

describe('utils.js', function () {

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

})