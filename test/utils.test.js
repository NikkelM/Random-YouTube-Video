import expect from 'expect.js';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

import { isVideoUrl, isEmpty, getLength, addHours, delay, setDOMTextWithDelay, RandomYoutubeVideoError, YoutubeAPIError } from '../src/utils.js';

describe('utils.js', function () {
	context('URL helpers', function () {

		context('isVideoUrl()', function () {
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

			it('should identify a non-YouTube URL', function () {
				expect(isVideoUrl("https://www.google.com")).to.be(false);
				expect(isVideoUrl("https://www.google.com/search?q=youtube")).to.be(false);
				expect(isVideoUrl("about:blank")).to.be(false);
			});

		});
	});

	context('DOM', function () {

		// Before each test, create a dummy document element
		var dom;
		beforeEach(function () {
			dom = new JSDOM(`<!DOCTYPE html><body><span id="test-span"></span></body>`);
			dom.window.document.getElementById("test-span").innerText = "Before";
		});

		context('setDOMTextWithDelay()', function () {
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

	context('utilities', function () {

		context('isEmpty()', function () {
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

		context('delay()', function () {
			let clock;

			beforeEach(() => {
				clock = sinon.useFakeTimers();
			});

			afterEach(() => {
				clock.restore();
			});

			it('should resolve after the specified delay', async () => {
				let hasResolved = false;
				
				delay(1000).then(() => {
					hasResolved = true;
				});

				expect(hasResolved).to.be(false);
				await clock.tickAsync(999);
				expect(hasResolved).to.be(false);
				await clock.tickAsync(1);	
				expect(hasResolved).to.be(true);
			});
		});

	});

	context('custom errors', function () {

		context('RandomYoutubeVideoError', function () {
			it('should be an instance of Error', function () {
				const e = new RandomYoutubeVideoError({});

				expect(e).to.be.an(Error);
			});

			it('should have the correct name', function () {
				const e = new RandomYoutubeVideoError({});

				expect(e.name).to.equal('RandomYoutubeVideoError');
			});

			it('should have the correct properties', function () {
				const e = new RandomYoutubeVideoError({
					code: "RYV-test",
					message: 'test message',
					solveHint: 'test solveHint',
					showTrace: true
				});

				expect(e).to.have.property('code');
				expect(e).to.have.property('message');
				expect(e).to.have.property('solveHint');
				expect(e).to.have.property('showTrace');

				expect(e.code).to.equal('RYV-test');
				expect(e.message).to.equal('test message');
				expect(e.solveHint).to.equal('test solveHint');
				expect(e.showTrace).to.equal(true);
			});
		});

		context('YoutubeAPIError', function () {
			it('should be an instance of Error', function () {
				const e = new YoutubeAPIError();

				expect(e).to.be.an(Error);
				expect(e).to.be.an(RandomYoutubeVideoError);
			});

			it('should have the correct name', function () {
				const e = new YoutubeAPIError();

				expect(e.name).to.equal('YoutubeAPIError');
			});

			it('should have the correct properties', function () {
				const e = new YoutubeAPIError("RYV-test", 'test message', 'test reason', 'test solveHint', true);

				expect(e).to.have.property('code');
				expect(e).to.have.property('message');
				expect(e).to.have.property('reason');
				expect(e).to.have.property('solveHint');
				expect(e).to.have.property('showTrace');

				expect(e.code).to.equal('RYV-test');
				expect(e.message).to.equal('test message');
				expect(e.reason).to.equal('test reason');
				expect(e.solveHint).to.equal('test solveHint');
				expect(e.showTrace).to.equal(true);
			});
		});

	});

})