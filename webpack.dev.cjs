const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');

module.exports = env => {
	let mode = "development";
	let devtool = 'inline-source-map';
	let optimization = {
		minimize: false
	};

	env.mode = mode;
	env.devtool = devtool;
	env.optimization = optimization;

	return merge(common(env), {
		mode,
		devtool,
		optimization
	});
};