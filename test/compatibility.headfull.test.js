import expect from "expect.js";
import puppeteer from "puppeteer";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("compatibility", function () {
	this.timeout(15000);

	context("YouTube", function () {
		context("shuffle button insertion", function () {
			let browser, page;

			beforeEach(async () => {
				const extensionPath = join(__dirname, "../dist/chromium");

				browser = await puppeteer.launch({
					headless: false, // Extensions only work in head-full mode
					args: [
						`--disable-extensions-except=${extensionPath}`,
						`--load-extension=${extensionPath}`
					]
				});
				page = await browser.newPage();

				// Set the SOCS cookie for YouTube (cookie banner)
				await page.setCookie({
					'name': 'SOCS',
					'value': 'CAESEwgDEgk0ODE3Nzk3MjQaAmVuIAEaBgiA_LyaBg', // base64 encoded value
					'domain': '.youtube.com',
					'path': '/',
					'secure': true,
					'httpOnly': false
				});
			});

			afterEach(async () => {
				await browser.close();
			});

			it('should insert the shuffle button into the channel header', async function () {
				await page.goto("https://www.youtube.com/@RickAstleyYT");

				await page.waitForSelector("#youtube-random-video-large-shuffle-button-channel");
				const shuffleButton = await page.$("#youtube-random-video-large-shuffle-button-channel");

				expect(shuffleButton).to.not.be(null);
			});
		});
	});
});