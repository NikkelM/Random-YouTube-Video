import expect from 'expect.js';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

import { isVideoUrl, getPageTypeFromURL, isEmpty, getLength, addHours, delay, setDOMTextWithDelay, versionIsOlderThan, getChangelogForVersion, RandomYoutubeVideoError, YoutubeAPIError } from '../src/utils.js';

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
				expect(isVideoUrl("edge://extensions/")).to.be(false);
			});
		});

		context('getPageTypeFromURL()', function () {
			it('should not break if no URL is provided', function () {
				expect(getPageTypeFromURL(null)).to.be(null);
				expect(getPageTypeFromURL(undefined)).to.be(null);
				expect(getPageTypeFromURL("")).to.be(null);
				expect(getPageTypeFromURL(0)).to.be(null);
			});
			
			it('should identify a YouTube video URL', function () {
				expect(getPageTypeFromURL("https://www.youtube.com/watch?v=12345678901")).to.be("video");
			});
			
			it('should identify a YouTube shorts URL', function () {
				expect(getPageTypeFromURL("https://www.youtube.com/shorts/12345678901")).to.be("short");
			});

			it('should identify a YouTube non-video/non-shorts URL', function () {
				expect(getPageTypeFromURL("https://www.youtube.com/channel/myChannelID")).to.be("channel");
				expect(getPageTypeFromURL("https://www.youtube.com/@Username")).to.be("channel");
				expect(getPageTypeFromURL("https://www.youtube.com")).to.be("channel");
				expect(getPageTypeFromURL("https://www.youtube.com/playlist?list=PL1234567890")).to.be("channel");
			});

			it('should identify a non-YouTube URL', function () {
				expect(getPageTypeFromURL("https://www.google.com")).to.be(null);
				expect(getPageTypeFromURL("https://www.google.com/search?q=youtube")).to.be(null);
				expect(getPageTypeFromURL("about:blank")).to.be(null);
				expect(getPageTypeFromURL("edge://extensions/")).to.be(null);
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
			let clock;

			beforeEach(() => {
				clock = sinon.useFakeTimers();
			});

			afterEach(() => {
				clock.restore();
			});

			it('should replace DOM text with default predicate', async function () {
				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				setDOMTextWithDelay(dom.window.document.getElementById("test-span"), "After", 30);

				await clock.tickAsync(10);
				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				await clock.tickAsync(30);
				expect(dom.window.document.getElementById("test-span").innerText).to.be("After");
			});

			it('should replace DOM text if custom predicate is true', async function () {
				const someBoolean = true;
				const predicate = () => { return dom.window.document.getElementById("test-span").innerText === "Before" && someBoolean; };

				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				setDOMTextWithDelay(dom.window.document.getElementById("test-span"), "After", 30, predicate);

				await clock.tickAsync(10);
				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				await clock.tickAsync(30);
				expect(dom.window.document.getElementById("test-span").innerText).to.be("After");
			});

			it('should not replace DOM text if predicate is false', async function () {
				const someBoolean = false;
				const predicate = () => { return dom.window.document.getElementById("test-span").innerText === "Before" && someBoolean; };

				expect(dom.window.document.getElementById("test-span").innerText).to.be("Before");

				setDOMTextWithDelay(dom.window.document.getElementById("test-span"), "After", 20, predicate);

				await clock.tickAsync(30);
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
			it('should return 0 for undefined', function () {
				expect(getLength(undefined)).to.be(0);
			});

			it('should return 0 for null', function () {
				expect(getLength(null)).to.be(0);
			});

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

		context('versionIsOlderThan()', function () {
			it('should compare the parts as numbers, not as text', function () {
				// Comparing the strings directly would consider 3.0.9 to be newer than 3.0.10
				expect(versionIsOlderThan("3.0.9", "3.0.10")).to.be(true);
				expect(versionIsOlderThan("3.0.10", "3.0.9")).to.be(false);

				expect(versionIsOlderThan("3.9.9", "3.10.0")).to.be(true);
				expect(versionIsOlderThan("3.10.0", "3.9.9")).to.be(false);

				expect(versionIsOlderThan("1.9.0", "10.0.0")).to.be(true);
			});

			it('should return false for the same version', function () {
				expect(versionIsOlderThan("3.1.14", "3.1.14")).to.be(false);
			});

			it('should treat missing parts as zero', function () {
				expect(versionIsOlderThan("3.1", "3.1.0")).to.be(false);
				expect(versionIsOlderThan("3.1.0", "3.1")).to.be(false);
				expect(versionIsOlderThan("3.1", "3.1.1")).to.be(true);
			});

			it('should compare each part in order', function () {
				expect(versionIsOlderThan("2.99.99", "3.0.0")).to.be(true);
				expect(versionIsOlderThan("3.0.0", "2.99.99")).to.be(false);
			});

			it('should not break if a version is missing or malformed', function () {
				expect(versionIsOlderThan(null, "1.0.0")).to.be(true);
				expect(versionIsOlderThan(undefined, "1.0.0")).to.be(true);
				expect(versionIsOlderThan("1.0.0", null)).to.be(false);
				expect(versionIsOlderThan("not a version", "1.0.0")).to.be(true);
			});

			it('should recognise the versions the update handling depends on', function () {
				// These are the versions that trigger a migration
				expect(versionIsOlderThan("1.2.9", "1.3.0")).to.be(true);
				expect(versionIsOlderThan("1.3.0", "1.3.0")).to.be(false);
				expect(versionIsOlderThan("1.4.10", "1.5.0")).to.be(true);
				expect(versionIsOlderThan("3.0.0", "3.0.1")).to.be(true);
				expect(versionIsOlderThan("3.1.14", "3.0.1")).to.be(false);
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

	context('getChangelogForVersion()', function () {
		const changelog = [
			'# Changelog',
			'',
			'## v2.0.0',
			'',
			'<!--Releasenotes start-->',
			'- Added something new.',
			'<!--Releasenotes end-->',
			'',
			'## v1.10.0',
			'',
			'- Fixed something old.',
			'- Fixed something else.',
			'',
			'## v1.9.0',
			'',
			'- The first release.'
		].join('\n');

		// The changelog is fetched from GitHub, so it may use either line ending, depending on how it was committed
		['\n', '\r\n'].forEach(function (lineEnding) {
			const lineEndingName = lineEnding === '\n' ? 'LF' : 'CRLF';
			const thisChangelog = changelog.replace(/\n/g, lineEnding);

			it(`should return the changelog of the requested version for ${lineEndingName} line endings`, function () {
				expect(getChangelogForVersion(thisChangelog, 'v1.10.0').replace(/\r/g, '')).to.be('- Fixed something old.\n- Fixed something else.');
			});

			it(`should not include the heading of the next version for ${lineEndingName} line endings`, function () {
				expect(getChangelogForVersion(thisChangelog, 'v2.0.0')).to.not.contain('## v1.10.0');
			});

			it(`should return the changelog of the last version for ${lineEndingName} line endings`, function () {
				expect(getChangelogForVersion(thisChangelog, 'v1.9.0').replace(/\r/g, '')).to.be('- The first release.');
			});

			it(`should return an empty string for a version without a changelog for ${lineEndingName} line endings`, function () {
				expect(getChangelogForVersion(thisChangelog, 'v3.0.0')).to.be('');
			});
		});

		// Without an exact match, "v1.9.0" would also match the heading of "v1.9.0-beta"
		it('should not match a version that only shares a prefix with the requested one', function () {
			expect(getChangelogForVersion('## v1.9.0-beta\n\n- A beta release.', 'v1.9.0')).to.be('');
		});

		it('should return an empty string if no changelog was passed', function () {
			expect(getChangelogForVersion('', 'v1.9.0')).to.be('');
			expect(getChangelogForVersion(changelog, undefined)).to.be('');
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