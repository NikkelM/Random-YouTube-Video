// Puppeteer browser tests that install the extension and therefore require a headful browser to run.
import expect from "expect.js";
import puppeteer from "puppeteer";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("headful compatibility", function () {
	this.timeout(30000);

	context("shuffle button insertion", function () {
		let browser, page;

		before(async () => {
			const extensionPath = join(__dirname, "../dist/chromium");

			browser = await puppeteer.launch({
				headless: false, // Extensions only work in head-full mode
				args: [
					`--disable-extensions-except=${extensionPath}`,
					`--load-extension=${extensionPath}`,
					'--no-sandbox'
				],
				executablePath: process.env.PUPPETEER_EXEC_PATH,
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

		after(async () => {
			await browser.close();
		});

		afterEach(async () => {
			await page.close();
			page = await browser.newPage();
		});

		it('should insert the shuffle button into channel pages', async function () {
			await page.goto("https://www.youtube.com/@RickAstleyYT");

			await page.waitForSelector("#youtube-random-video-large-shuffle-button-channel");
			const shuffleButton = await page.$("#youtube-random-video-large-shuffle-button-channel");

			expect(shuffleButton).to.not.be(null);
		});

		it('should insert the shuffle button into video pages', async function () {
			await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

			await page.waitForSelector("#youtube-random-video-large-shuffle-button-video");
			const shuffleButton = await page.$("#youtube-random-video-large-shuffle-button-video");

			expect(shuffleButton).to.not.be(null);
		});

		it('should insert the shuffle button into shorts pages', async function () {
			await page.goto("https://www.youtube.com/shorts/vOSD7vSreXA");

			await page.waitForSelector("#youtube-random-video-small-shuffle-button-short");
			const shuffleButton = await page.$("#youtube-random-video-small-shuffle-button-short");

			expect(shuffleButton).to.not.be(null);
		});
	});
});