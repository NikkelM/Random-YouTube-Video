// Tests that can be run in a headless puppeteer browser.
import expect from "expect.js";
import puppeteer from "puppeteer";

describe("headless compatibility", function () {
	this.timeout(15000);
	let browser, page;

	before(async () => {
		browser = await puppeteer.launch({
			headless: true, // Extensions only work in head-full mode
			args: ['--no-sandbox'],
			executablePath: process.env.PUPPETEER_EXEC_PATH, // set by docker container
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

	context("events", function () {
		it("should contain required data in the yt-navigate-finish event for video pages", async function () {
			let event = {};

			// Create a promise that listens for the "yt-navigate-finish" event
			const waitForNavigateFinish = new Promise((resolve, reject) => {
				page.on("console", msg => {
					if (msg.text().includes("yt-navigate-finish")) {
						event = JSON.parse(msg.text().replace("yt-navigate-finish ", ""));
						resolve();
					}
				});
			});

			await page.evaluateOnNewDocument(() => {
				document.addEventListener("yt-navigate-finish", function (e) {
					const serializableEvent = {
						channelId: e.detail?.response?.playerResponse?.videoDetails?.channelId,
						channelName: e.detail?.response?.playerResponse?.videoDetails?.author
					};
					console.log("yt-navigate-finish", JSON.stringify(serializableEvent));
				});
			});

			await page.goto("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

			const timeout = new Promise((resolve, reject) => {
				setTimeout(() => {
					reject(new Error("Timed out waiting for yt-navigate-finish event"));
				}, 5000);
			});

			// Wait for either the event to fire or the timeout
			try {
				await Promise.race([waitForNavigateFinish, timeout]);
			} catch (error) {
				console.error(error.message);
			}

			console.log("The following data was extracted from the yt-navigate-finish event:");
			console.log(event);

			expect(event.channelId).to.be("UCuAXFkgsw1L7xaCfnd5JJOw");
			expect(event.channelName).to.be("Rick Astley");
		});

		it("should contain required data in the yt-navigate-finish event for channel pages", async function () {
			let event = {};

			// Create a promise that listens for the "yt-navigate-finish" event
			const waitForNavigateFinish = new Promise((resolve, reject) => {
				page.on("console", msg => {
					if (msg.text().includes("yt-navigate-finish")) {
						event = JSON.parse(msg.text().replace("yt-navigate-finish ", ""));
						resolve();
					}
				});
			});

			await page.evaluateOnNewDocument(() => {
				document.addEventListener("yt-navigate-finish", function (e) {
					const serializableEvent = {
						eventVersion: "default",
						channelId: e.detail?.response?.response?.header?.c4TabbedHeaderRenderer?.channelId,
						channelName: e.detail?.response?.response?.header?.c4TabbedHeaderRenderer?.title
					};
					if (!serializableEvent.channelId) {
						serializableEvent.eventVersion = "20240521";
						serializableEvent.channelId = e.detail?.endpoint?.browseEndpoint?.browseId;
					}
					if (!serializableEvent.channelName) {
						serializableEvent.eventVersion = "20240521";
						serializableEvent.channelName = e.detail?.response?.response?.header?.pageHeaderRenderer?.pageTitle;
					}

					console.log("yt-navigate-finish", JSON.stringify(serializableEvent));
				});
			});

			// Navigate to a YouTube video page
			await page.goto("https://www.youtube.com/@RickAstleyYT");

			const timeout = new Promise((resolve, reject) => {
				setTimeout(() => {
					reject(new Error("Timed out waiting for yt-navigate-finish event"));
				}, 5000);
			});

			// Wait for either the event to fire or the timeout
			try {
				await Promise.race([waitForNavigateFinish, timeout]);
			} catch (error) {
				console.error(error.message);
			}

			console.log("The following data was extracted from the yt-navigate-finish event:");
			console.log(event);

			expect(event.channelId).to.be("UCuAXFkgsw1L7xaCfnd5JJOw");
			expect(event.channelName).to.be("Rick Astley");
		});

		it("should contain required data in the yt-navigate-finish event for shorts pages", async function () {
			let event = {};

			// Create a promise that listens for the "yt-navigate-finish" event
			const waitForNavigateFinish = new Promise((resolve, reject) => {
				page.on("console", msg => {
					if (msg.text().includes("yt-navigate-finish")) {
						event = JSON.parse(msg.text().replace("yt-navigate-finish ", ""));
						resolve();
					}
				});
			});

			await page.evaluateOnNewDocument(() => {
				document.addEventListener("yt-navigate-finish", function (e) {
					const serializableEvent = {
						channelId: e.detail?.response?.playerResponse?.videoDetails?.channelId,
						channelName: e.detail?.response?.playerResponse?.videoDetails?.author
					};
					console.log("yt-navigate-finish", JSON.stringify(serializableEvent));
				});
			});

			await page.goto("https://www.youtube.com/shorts/vOSD7vSreXA");

			const timeout = new Promise((resolve, reject) => {
				setTimeout(() => {
					reject(new Error("Timed out waiting for yt-navigate-finish event"));
				}, 5000);
			});

			// Wait for either the event to fire or the timeout
			try {
				await Promise.race([waitForNavigateFinish, timeout]);
			} catch (error) {
				console.error(error.message);
			}

			console.log("The following data was extracted from the yt-navigate-finish event:");
			console.log(event);

			expect(event.channelId).to.be("UCuAXFkgsw1L7xaCfnd5JJOw");
			expect(event.channelName).to.be("Rick Astley");
		});
	});
});