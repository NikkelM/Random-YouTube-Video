// Adapted from https://github.com/ajayyy/SponsorBlock/blob/d5d766b429fb08802aabc72d187259d8db1e3a79/webpack/webpack.manifest.js
const { sources, Compilation } = require('webpack');

const manifest = require("./static/manifest.json");
const firefoxManifestExtra = require("./static/firefox-manifest-extra.json");
const chromiumManifestExtra = require("./static/chromium-manifest-extra.json");

class BuildManifest {
	constructor(options = {}) {
		this.options = options;
	}

	apply(compiler) {
		const browserManifest = JSON.parse(JSON.stringify(manifest));

		// Add missing manifest elements
		if (this.options.browser.toLowerCase() === "firefox") {
			mergeObjects(browserManifest, firefoxManifestExtra);
		} else if (this.options.browser.toLowerCase() === "chromium") {
			mergeObjects(browserManifest, chromiumManifestExtra);
		}

		const result = JSON.stringify(browserManifest, null, 2);

		compiler.hooks.thisCompilation.tap("BuildManifest", (compilation) => {
			compilation.hooks.processAssets.tap(
				{
					name: "BuildManifest",
					stage: Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL
				},
				() => {
					compilation.emitAsset("manifest.json", new sources.RawSource(result));
				}
			);
		});
	}
}

function mergeObjects(object1, object2) {
	for (const key in object2) {
		if (key in object1) {
			if (Array.isArray(object1[key])) {
				object1[key] = object1[key].concat(object2[key]);
			} else if (typeof object1[key] == 'object') {
				mergeObjects(object1[key], object2[key]);
			} else {
				object1[key] = object2[key];
			}
		} else {
			object1[key] = object2[key];
		}
	}
}

module.exports = BuildManifest;