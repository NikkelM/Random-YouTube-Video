import expect from 'expect.js';
import puppeteer from 'puppeteer';

describe('compatibility', function () {
	context('YouTube', function () {
		context('URLs', function () {
			it('should redirect a watch_videos URL to a temporary playlist URL', async function () {
				const watchVideosUrl = 'https://www.youtube.com/watch_videos?video_ids=dQw4w9WgXcQ,dQw4w9WgXcQ,dQw4w9WgXcQ,dQw4w9WgXcQ';
				const redirectedUrl = (await fetch(watchVideosUrl)).url;

				// The playlist is temporary, indicated by a TL start in the ID
				expect(redirectedUrl).to.contain('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=TL');
			});
		});

		context('events', function () {
			it('should contain required data in the yt-navigate-finish event', async function () {
				this.timeout(10000);

				const browser = await puppeteer.launch({ headless: true });
				const page = await browser.newPage();

				let event = {};

				// Create a promise that listens for the 'yt-navigate-finish' event
				const waitForNavigateFinish = new Promise((resolve, reject) => {
					page.on('console', msg => {
						if (msg.text().includes('yt-navigate-finish')) {
							// Remove the yt-navigate-finish from the string and parse the rest to event
							event = JSON.parse(msg.text().replace('yt-navigate-finish ', ''));
							resolve();
						}
					});
				});

				await page.evaluateOnNewDocument(() => {
					document.addEventListener('yt-navigate-finish', function (e) {
						const serializableEvent = {
							channelId: e.detail?.response?.playerResponse?.videoDetails?.channelId,
							channelName: e.detail?.response?.playerResponse?.videoDetails?.author
						};
						// Now, this object can be safely serialized to JSON
						console.log('yt-navigate-finish', JSON.stringify(serializableEvent));
					});
				});

				// Navigate to a YouTube page
				await page.goto('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

				const timeout = new Promise((resolve, reject) => {
					setTimeout(() => {
						reject(new Error('Timed out waiting for yt-navigate-finish event'));
					}, 5000);
				});

				// Wait for either the event to fire or the timeout
				try {
					await Promise.race([waitForNavigateFinish, timeout]);
				} catch (error) {
					console.error(error.message);
				}

				await browser.close();

				console.log("The following data was extracted from the yt-navigate-finish event:");
				console.log(event);

				expect(event.channelId).to.be('UCuAXFkgsw1L7xaCfnd5JJOw');
				expect(event.channelName).to.be('Rick Astley');
			});
		});
	});
});