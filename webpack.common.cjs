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
			breakingNews: './src/html/breakingNews.js',
			// POPUP
			popup: './src/html/popup/popup.js',
		},
		module: {
			rules: [
				{
					test: /\.(js|ts)x?$/,
					use: ['babel-loader'],
					exclude: /node_modules/,
				},
			],
		},
		resolve: {
			extensions: ['.ts', '.js'],
		},
		output: {
			path: path.resolve(__dirname, 'dist', env.browser)
		},
		plugins: [
			new ESLintPlugin({
				extensions: ['js', 'ts'],
				overrideConfigFile: path.resolve(__dirname, '.eslintrc'),
			}),
			new CopyPlugin({
				patterns: [
					{
						from: 'static',
						globOptions: {
							ignore: ['**/*manifest*.json'],
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
