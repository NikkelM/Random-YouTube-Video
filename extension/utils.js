let log = console.log

console.log = function () {
	var args = Array.from(arguments);
	args.unshift("[youtube-random-video]: ");
	log.apply(console, args);
}