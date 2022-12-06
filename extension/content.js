let oldURL = getChannelUrl(window.location.href)

document.addEventListener('yt-navigate-start', handleNavigateStart);

var observer = new MutationObserver(function (mutations, me) {
	// `mutations` is an array of mutations that occurred
	// `me` is the MutationObserver instance
	var buttons = document.getElementById('inner-header-container');
	if (buttons) {
		buildShuffleButton();
		me.disconnect(); // stop observing
		return;
	}
});

// start observing
observer.observe(document, {
	childList: true,
	subtree: true
});

function handleNavigateStart() {
	const newUrl = getChannelUrl(window.location.href);

	if (newUrl && newUrl !== oldURL) {
		oldURL = newUrl;
		window.location.reload();
	}
}

function getChannelUrl(url) {
	if (!isChannelUrl(url)) {
		return null;
	}

	const urlParts = url.split('/');

	// This can be either "channel", "c" or "@Username"
	if (urlParts[3].startsWith('@')) {
		return urlParts.slice(0, 4).join('/');
	} else if (urlParts[3] == "c") {
		return urlParts.slice(0, 3).join('/') + '/@' + urlParts[4];
	} else if (urlParts[3] == "channel") {
		return urlParts.slice(0, 5).join('/');
	}
	throw new Error('Url is a channel url, but not handled correctly');
}

function buildShuffleButton() {
	const currUrl = window.location.href;
	console.log(currUrl);
	if (isChannelUrl(currUrl)) {
		console.log("Building shuffle button");
		addShuffleButtonSkeleton();
	}
}

function addShuffleButtonSkeleton() {
	let newButton = document.createElement("div");
	newButton.id = "shuffle-button"
	newButton.classList.add("style-scope")
	newButton.classList.add("ytd-c4-tabbed-header-renderer")
	newButton.style = "align-items: center; display: flex; flex-direction: row;"

	let buttonRenderer = document.createElement("ytd-button-renderer")
	buttonRenderer.classList.add("style-scope")
	buttonRenderer.classList.add("ytd-c4-tabbed-header-renderer")

	newButton.appendChild(buttonRenderer)

	document.getElementById('inner-header-container').children.namedItem('buttons').prepend(newButton);

	// Wait for the button to get the child elements defined by the element type
	var observer = new MutationObserver(function (mutations, me) {
		// `mutations` is an array of mutations that occurred
		// `me` is the MutationObserver instance
		var shuffleButton = document.getElementById('inner-header-container').children.namedItem('buttons').children.namedItem("shuffle-button");
		if (shuffleButton.children.length > 0) {
			addButtonShape();
			me.disconnect(); // stop observing
			return;
		}
	});

	// start observing
	observer.observe(document, {
		childList: true,
		subtree: true
	});
}

function addButtonShape() {
	// The button itself
	let button = document.createElement("button")
	button.classList.add("yt-spec-button-shape-next")
	button.classList.add("yt-spec-button-shape-next--tonal")
	button.classList.add("yt-spec-button-shape-next--mono")
	button.classList.add("yt-spec-button-shape-next--size-m")
	button.setAttribute("aria-label", "Shuffle all Videos")

	// Load the font used for the "shuffle" icon
	let iconFont = document.createElement("link");
	iconFont.rel = "stylesheet";
	iconFont.href = "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0";

	document.head.appendChild(iconFont);

	// The shuffle icon, using a Google font icon
	let shuffleIcon = document.createElement("span");
	shuffleIcon.classList.add("material-symbols-outlined");
	shuffleIcon.innerHTML = "shuffle";

	button.appendChild(shuffleIcon);

	// Various divs and spans to make the button look like a normal YouTube button
	let buttonDiv = document.createElement("div")
	buttonDiv.classList.add("cbox")
	buttonDiv.classList.add("yt-spec-button-shape-next--button-text-content")

	let buttonSpan = document.createElement("span")
	buttonSpan.classList.add("yt-core-attributed-string")
	buttonSpan.classList.add("yt-core-attributed-string--white-space-no-wrap")
	buttonSpan.setAttribute("role", "text")
	buttonSpan.innerHTML = "&nbsp;Random"

	buttonDiv.appendChild(buttonSpan);
	button.appendChild(buttonDiv);

	let buttonTouchResponse = document.createElement("yt-touch-feedback-shape")
	buttonTouchResponse.style.borderRadius = "inherit"

	let buttonTouchResponseDiv = document.createElement("div")
	buttonTouchResponseDiv.classList.add("yt-spec-touch-feedback-shape")
	buttonTouchResponseDiv.classList.add("yt-spec-touch-feedback-shape--touch-response")
	buttonTouchResponseDiv.setAttribute("aria-hidden", "true")

	let buttonTouchResponseStroke = document.createElement("div")
	buttonTouchResponseStroke.classList.add("yt-spec-touch-feedback-shape__stroke")
	buttonTouchResponseStroke.style = ""

	let buttonTouchResponseFill = document.createElement("div")
	buttonTouchResponseFill.classList.add("yt-spec-touch-feedback-shape__fill")
	buttonTouchResponseFill.style = ""

	buttonTouchResponseDiv.appendChild(buttonTouchResponseStroke)
	buttonTouchResponseDiv.appendChild(buttonTouchResponseFill)
	buttonTouchResponse.appendChild(buttonTouchResponseDiv)

	button.appendChild(buttonTouchResponse)

	// Add the button to the page
	document.getElementById('inner-header-container').children.namedItem('buttons').children.namedItem("shuffle-button").children[0].children[0].appendChild(button);

	// Add the event listener that shuffles the videos to the button
	document.getElementById('inner-header-container').children.namedItem('buttons').children.namedItem("shuffle-button").addEventListener("click", shuffleVideos);
}

async function shuffleVideos() {
	await pingAPI();
}