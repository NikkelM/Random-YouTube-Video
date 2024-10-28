const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');

module.exports = env => {
	let mode = "development";
	let devtool = 'inline-source-map';
	let optimization = {
		minimize: false,
		concatenateModules: false,
		flagIncludedChunks: false,
		mergeDuplicateChunks: false,
		removeAvailableModules: false,
		removeEmptyChunks: false,
		sideEffects: false,
		providedExports: false,
		usedExports: false,
	};

	env.mode = mode;
	env.devtool = devtool;
	env.optimization = optimization;
	env.NODE_ENV = mode;

	return merge(common(env), {
		mode,
		devtool,
		optimization,
		output: {
			filename: '[name].js',
			chunkFilename: '[name].js'
		}
	});
};