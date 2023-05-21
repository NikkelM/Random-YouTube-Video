const expect = require('expect.js');
const sinon = require('sinon');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const utils = require('../src/utils.js');

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
			it('should not break if no URL is provided', function () {
				expect(utils.isVideoUrl(null)).to.be(false);
				expect(utils.isVideoUrl(undefined)).to.be(false);
				expect(utils.isVideoUrl("")).to.be(false);
			});

			it('should identify a YouTube video URL', function () {
				expect(utils.isVideoUrl("https://www.youtube.com/watch?v=12345678901")).to.be(true);
			});

			it('should identify a YouTube non-video URL', function () {
				expect(utils.isVideoUrl("https://www.youtube.com/channel/myChannelID")).to.be(false);
				expect(utils.isVideoUrl("https://www.youtube.com/@Username")).to.be(false);
				expect(utils.isVideoUrl("https://www.youtube.com")).to.be(false);
				expect(utils.isVideoUrl("https://www.youtube.com/playlist?list=PL1234567890")).to.be(false);
			});

		});
	});

	context('utilities', function () {

		context('isEmpty()', function () {
			it('should return true for empty objects', function () {
				expect(utils.isEmpty({})).to.be(true);
			});

			it('should return false for non-empty objects', function () {
				expect(utils.isEmpty({ "test": "test" })).to.be(false);
			});

			it('should return true for empty arrays', function () {
				expect(utils.isEmpty([])).to.be(true);
			});

			it('should return false for non-empty arrays', function () {
				expect(utils.isEmpty(["test"])).to.be(false);
			});
		});

		context('getLength()', function () {
			it('should return 0 for empty objects', function () {
				expect(utils.getLength({})).to.be(0);
			});

			it('should return the number of keys for non-empty objects', function () {
				expect(utils.getLength({ "test": "test" })).to.be(1);
				expect(utils.getLength({ "test": "test", "test2": "test2" })).to.be(2);
			});

			it('should return 0 for empty arrays', function () {
				expect(utils.getLength([])).to.be(0);
			});

			it('should return the number of elements for non-empty arrays', function () {
				expect(utils.getLength(["test"])).to.be(1);
				expect(utils.getLength(["test", "test2"])).to.be(2);
			});
		});

		context('addHours()', function () {
			it('should add hours to a date', function () {
				let date = new Date("2019-01-01T00:00:00Z");
				date = utils.addHours(date, 1);
				expect(date.toISOString()).to.be("2019-01-01T01:00:00.000Z");
			});

			it('should add negative hours to a date', function () {
				let date = new Date("2019-01-01T00:00:00Z");
				date = utils.addHours(date, -1);
				expect(date.toISOString()).to.be("2018-12-31T23:00:00.000Z");
			});
		});
	});

	context('custom errors', function () {

		context('RandomYoutubeVideoError', function () {
			it('should be an instance of Error', function () {
				const e = new utils.RandomYoutubeVideoError({});

				expect(e).to.be.an(Error);
			});

			it('should have the correct name', function () {
				const e = new utils.RandomYoutubeVideoError({});

				expect(e.name).to.equal('RandomYoutubeVideoError');
			});

			it('should have the correct properties', function () {
				const e = new utils.RandomYoutubeVideoError({
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
				const e = new utils.YoutubeAPIError();

				expect(e).to.be.an(Error);
				expect(e).to.be.an(utils.RandomYoutubeVideoError);
			});

			it('should have the correct name', function () {
				const e = new utils.YoutubeAPIError();

				expect(e.name).to.equal('YoutubeAPIError');
			});

			it('should have the correct properties', function () {
				const e = new utils.YoutubeAPIError("RYV-test", 'test message', 'test reason', 'test solveHint', true);

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