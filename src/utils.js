// Global utilities

/* c8 ignore start - The console reroutings cannot be tested correctly */
// ---------- Console rerouting ----------
var oldLog = console.log;
console.log = function () {
	if (arguments[0] !== "[random-youtube-video]:") {
		Array.prototype.unshift.call(arguments, '[random-youtube-video]:');
	}
	oldLog.apply(this, arguments);
}
/* c8 ignore stop */

// ---------- Utility functions ----------

// ----- URLs -----
export function isVideoUrl(url) {
	if (!url) return false;

	const urlParts = url.split("/");
	return urlParts[3]?.startsWith("watch?v=") ?? false;
}

// ----- DOM -----
export function setDOMTextWithDelay(textElement, newText, delayMS, predicate = () => { return true; }) {
	// Sets the innerHTML of a (text) DOM element after a delay, if a predicate evaluates to true
	// If no predicate is passed, this function will always set the text after the delay
	delay(delayMS).then(() => {
		if (predicate()) {
			textElement.innerText = newText;
		}
	});
}

// ----- Small utilities -----
// Waits for a certain amount of milliseconds
export function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

// Determines if an object is empty
export function isEmpty(obj) {
	return Object.keys(obj).length === 0;
}

// Gets the length of an object
export function getLength(obj) {
	return Object.keys(obj ?? {}).length;
}

// Adds a number of hours to a date
export function addHours(date, hours) {
	return new Date(date.getTime() + hours * 3600000);
}

// ----- Errors -----
export class RandomYoutubeVideoError extends Error {
	constructor({ code = "RYV-0", message = "", solveHint = "", showTrace = true }) {
		super(message);
		this.code = code;
		this.message = message;
		this.solveHint = solveHint;
		this.showTrace = showTrace;
		this.name = "RandomYoutubeVideoError";
	}
}

export class YoutubeAPIError extends RandomYoutubeVideoError {
	constructor(code = "YAPI-0", message = "", reason = "", solveHint = "", showTrace = true) {
		super(message);
		this.code = code;
		this.message = message;
		this.reason = reason;
		this.solveHint = solveHint;
		this.showTrace = showTrace;
		this.name = "YoutubeAPIError";
	}
}