const path = require('path');

const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: {
		// JS
		background: './src/background.js',
		buildShuffleButton: './src/buildShuffleButton.js',
		content: './src/content.js',
		shuffleVideo: './src/shuffleVideo.js',
		utils: './src/utils.js',
		chromeStorage: './src/chromeStorage.js',
		// HTML
		changelog: './src/html/changelog.js',
		htmlUtils: './src/html/htmlUtils.js',
		shufflingPage: './src/html/shufflingPage.js',
		// POPUP
		popup: './src/html/popup/popup.js',
		popupUtils: './src/html/popup/popupUtils.js',
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
		path: path.resolve(__dirname, 'dist'),
		clean: true,
	},
	plugins: [
		new ESLintPlugin({
			extensions: ['js', 'ts'],
			overrideConfigFile: path.resolve(__dirname, '.eslintrc'),
		}),
		new CopyPlugin({
			patterns: [{ from: 'static' }],
		}),
	],
};