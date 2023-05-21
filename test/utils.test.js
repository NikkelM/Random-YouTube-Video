const expect = require('expect.js');
const sinon = require('sinon');
const rewire = require('rewire');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

// const testUtils = rewire('./testUtils.js');

const utils = rewire('../src/utils.js');

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

	context('custom errors', function () {

		context('RandomYoutubeVideoError', function () {
			const RandomYoutubeVideoError = utils.__get__('RandomYoutubeVideoError');

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
			const RandomYoutubeVideoError = utils.__get__('RandomYoutubeVideoError');
			const YoutubeAPIError = utils.__get__('YoutubeAPIError');

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