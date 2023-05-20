const path = require('path');

const DotenvPlugin = require('dotenv-webpack');
const ESLintPlugin = require('eslint-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
	entry: {
		// JS
		background: './src/background.js',
		buildShuffleButton: './src/buildShuffleButton.js',
		content: './src/content.js',
		shuffleVideo: './src/shuffleVideo.js',
		utils: './src/utils.js',
		// HTML
		changelog: './src/html/changelog.js',
		htmlUtils: './src/html/htmlUtils.js',
		shufflingPage: './src/html/shufflingPage.js',
		// POPUP
		popup: './src/html/popup/popup.js',
		domElements: './src/html/popup/domElements.js',
		popupUtils: './src/html/popup/popupUtils.js',
	},
	module: {
		rules: [
			{
				test: /\.(js|ts)x?$/,
				use: ['babel-loader'],
				exclude: /node_modules/,
			},
			{
				test: /\.(scss|css)$/,
				use: [MiniCssExtractPlugin.loader, 'css-loader', 'sass-loader'],
			},
		],
	},
	resolve: {
		extensions: ['.ts', '.js'],
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'dist'),
		clean: true,
	},
	plugins: [
		new DotenvPlugin(),
		new ESLintPlugin({
			extensions: ['js', 'ts'],
			overrideConfigFile: path.resolve(__dirname, '.eslintrc'),
		}),
		// new MiniCssExtractPlugin({
		//   filename: 'styles/[name].css',
		// }),
		new CopyPlugin({
			patterns: [{ from: 'static' }],
		}),
	],
};
