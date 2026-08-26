const path = require('path');

const BuildManifest = require('./webpack.manifest.cjs');
const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = env => {
	return {
		// Only files that are loaded directly by the manifest or by an HTML page belong here
		// Everything else is imported by one of these and does not need its own bundle
		entry: {
			// JS
			background: './src/background.js',
			content: './src/content.js',
			// HTML
			changelog: './src/html/changelog.js',
			shufflingPage: './src/html/shufflingPage.js',
			welcome: './src/html/welcome.js',
			// Disabled together with the news feature in background.js, which is the only thing that could ever open this page
			// breakingNews: './src/html/breakingNews.js',
			// POPUP
			popup: './src/html/popup/popup.js',
		},
		module: {
			rules: [
				{
					test: /\.jsx?$/,
					use: ['babel-loader'],
					exclude: /node_modules/,
				},
			],
		},
		resolve: {
			extensions: ['.js'],
		},
		output: {
			path: path.resolve(__dirname, 'dist', env.browser)
		},
		plugins: [
			new ESLintPlugin({
				extensions: ['js'],
			}),
			new CopyPlugin({
				patterns: [
					{
						from: 'static',
						globOptions: {
							// The news page is not shipped while the feature is disabled, as the script it loads is not built either
							ignore: ['**/*manifest*.json', '**/breakingNews.html'],
						},
					},
				],
			}),
			new BuildManifest({
				browser: env.browser
			}),
		],
	};
};
