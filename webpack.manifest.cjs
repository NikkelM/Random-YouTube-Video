// Adapted from https://github.com/ajayyy/SponsorBlock/blob/d5d766b429fb08802aabc72d187259d8db1e3a79/webpack/webpack.manifest.js
const path = require('path');
const fs = require('fs');

const manifest = require("./static/manifest.json");
const firefoxManifestExtra = require("./static/firefox-manifest-extra.json");
const chromiumManifestExtra = require("./static/chromium-manifest-extra.json");

class BuildManifest {
	constructor(options = {}) {
		this.options = options;
	}

	apply() {
		const distFolder = path.resolve(__dirname, 'dist', this.options.browser);
		const distManifestFile = path.resolve(distFolder, "manifest.json");

		// Add missing manifest elements
		if (this.options.browser.toLowerCase() === "firefox") {
			mergeObjects(manifest, firefoxManifestExtra);
		} else if (this.options.browser.toLowerCase() === "chromium") {
			mergeObjects(manifest, chromiumManifestExtra);
		}

		let result = JSON.stringify(manifest, null, 2);

		fs.mkdirSync(distFolder, { recursive: true });
		fs.writeFileSync(distManifestFile, result);
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