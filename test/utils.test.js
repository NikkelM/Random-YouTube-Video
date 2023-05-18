var expect = require('expect.js');
const stdout = require("test-console").stdout;
var rewire = require('rewire');
const utils = rewire('../extension/js/utils.js');

describe('utils.js', function () {

	context('console helpers', function () {
		it('should reroute console.log', function () {
			const output = stdout.inspectSync(() => {
				console.log("Test log");
			});

			expect(output).to.eql(["[youtube-random-video]: Test log\n"]);
		});
	});

	context('DOM helpers', function () {
		it('should replace DOM text with delay', function () {
			// TODO
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

})