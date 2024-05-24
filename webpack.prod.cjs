const { merge } = require('webpack-merge');
const common = require('./webpack.common.cjs');

module.exports = env => {
	let mode = "production";
	env.mode = mode;
	env.NODE_ENV = mode;

	return merge(common(env), {
		mode
	});
};