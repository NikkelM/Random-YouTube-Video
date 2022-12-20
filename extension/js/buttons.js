// Builds the randomize buttons that are used by the extension

// Channel page
function buildShuffleButton() {
	let newButton = document.createElement("div");
	newButton.id = "shuffle-button";
	newButton.classList.add("style-scope");
	newButton.classList.add("ytd-c4-tabbed-header-renderer");
	newButton.style = "align-items: center; display: flex; flex-direction: row;";

	let buttonRenderer = document.createElement("ytd-button-renderer");
	buttonRenderer.classList.add("style-scope");
	buttonRenderer.classList.add("ytd-c4-tabbed-header-renderer");

	newButton.appendChild(buttonRenderer);

	document.getElementById('inner-header-container').children.namedItem('buttons').prepend(newButton);

	// Wait for the button to get the child elements defined by the element type
	var observer = new MutationObserver(function (mutations, me) {
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

async function addButtonShape() {
	// The button itself
	// We need to wait until the previous element has been added to the DOM, otherwise YouTube will overwrite our changes
	let button = document.createElement("button");
	button.classList.add("yt-spec-button-shape-next");
	button.classList.add("yt-spec-button-shape-next--tonal");
	button.classList.add("yt-spec-button-shape-next--mono");
	button.classList.add("yt-spec-button-shape-next--size-m");
	button.setAttribute("aria-label", "Shuffle all Videos");

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
	let buttonDiv = document.createElement("div");
	buttonDiv.classList.add("cbox");
	buttonDiv.classList.add("yt-spec-button-shape-next--button-text-content");

	let buttonSpan = document.createElement("span");
	buttonSpan.classList.add("yt-core-attributed-string");
	buttonSpan.classList.add("yt-core-attributed-string--white-space-no-wrap");
	buttonSpan.setAttribute("role", "text");
	buttonSpan.innerHTML = "&nbsp;Random";

	buttonDiv.appendChild(buttonSpan);
	button.appendChild(buttonDiv);

	let buttonTouchResponse = document.createElement("yt-touch-feedback-shape");
	buttonTouchResponse.style.borderRadius = "inherit";

	let buttonTouchResponseDiv = document.createElement("div");
	buttonTouchResponseDiv.classList.add("yt-spec-touch-feedback-shape");
	buttonTouchResponseDiv.classList.add("yt-spec-touch-feedback-shape--touch-response");
	buttonTouchResponseDiv.setAttribute("aria-hidden", "true");

	let buttonTouchResponseStroke = document.createElement("div");
	buttonTouchResponseStroke.classList.add("yt-spec-touch-feedback-shape__stroke");
	buttonTouchResponseStroke.style = "";

	let buttonTouchResponseFill = document.createElement("div");
	buttonTouchResponseFill.classList.add("yt-spec-touch-feedback-shape__fill");
	buttonTouchResponseFill.style = "";

	buttonTouchResponseDiv.appendChild(buttonTouchResponseStroke);
	buttonTouchResponseDiv.appendChild(buttonTouchResponseFill);
	buttonTouchResponse.appendChild(buttonTouchResponseDiv);

	button.appendChild(buttonTouchResponse);

	// Add the button to the page
	document.getElementById('inner-header-container').children.namedItem('buttons').children.namedItem("shuffle-button").children[0].children[0].appendChild(button);

	shuffleButton = document.getElementById('inner-header-container').children.namedItem('buttons').children.namedItem("shuffle-button");
	shuffleButtonText = shuffleButton.children[0].children[0].children[0].children[1].children[0];

	// Add the event listener that shuffles the videos to the button
	shuffleButton.addEventListener("click", shuffleVideos);
}

// Video page

function buildShuffleButtonVideo() {
	let newButton = document.createElement("div");
	newButton.id = "shuffle-button";
	newButton.classList.add("style-scope");
	newButton.classList.add("ytd-c4-tabbed-header-renderer");
	newButton.style = "align-items: center; display: flex; flex-direction: row; margin-left: 8px;";

	let buttonRenderer = document.createElement("ytd-button-renderer");
	buttonRenderer.classList.add("style-scope");
	buttonRenderer.classList.add("ytd-c4-tabbed-header-renderer");

	newButton.appendChild(buttonRenderer);

	document.getElementById('above-the-fold').children.namedItem("top-row").children.namedItem("owner").appendChild(newButton);

	// Wait for the button to get the child elements defined by the element type
	var observer = new MutationObserver(function (mutations, me) {
		var shuffleButton = document.getElementById('above-the-fold').children.namedItem("top-row").children.namedItem("owner").children.namedItem("shuffle-button");
		if (shuffleButton.children.length > 0) {
			addButtonShapeVideo();
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

async function addButtonShapeVideo() {
	// The button itself
	let button = document.createElement("button");
	button.classList.add("yt-spec-button-shape-next");
	button.classList.add("yt-spec-button-shape-next--tonal");
	button.classList.add("yt-spec-button-shape-next--mono");
	button.classList.add("yt-spec-button-shape-next--size-m");
	button.setAttribute("aria-label", "Shuffle all Videos");

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
	let buttonDiv = document.createElement("div");
	buttonDiv.classList.add("cbox");
	buttonDiv.classList.add("yt-spec-button-shape-next--button-text-content");

	let buttonSpan = document.createElement("span");
	buttonSpan.classList.add("yt-core-attributed-string");
	buttonSpan.classList.add("yt-core-attributed-string--white-space-no-wrap");
	buttonSpan.setAttribute("role", "text");
	buttonSpan.innerHTML = "&nbsp;Random";

	buttonDiv.appendChild(buttonSpan);
	button.appendChild(buttonDiv);

	let buttonTouchResponse = document.createElement("yt-touch-feedback-shape");
	buttonTouchResponse.style.borderRadius = "inherit";

	let buttonTouchResponseDiv = document.createElement("div");
	buttonTouchResponseDiv.classList.add("yt-spec-touch-feedback-shape");
	buttonTouchResponseDiv.classList.add("yt-spec-touch-feedback-shape--touch-response");
	buttonTouchResponseDiv.setAttribute("aria-hidden", "true");

	let buttonTouchResponseStroke = document.createElement("div");
	buttonTouchResponseStroke.classList.add("yt-spec-touch-feedback-shape__stroke");
	buttonTouchResponseStroke.style = "";

	let buttonTouchResponseFill = document.createElement("div");
	buttonTouchResponseFill.classList.add("yt-spec-touch-feedback-shape__fill");
	buttonTouchResponseFill.style = "";

	buttonTouchResponseDiv.appendChild(buttonTouchResponseStroke);
	buttonTouchResponseDiv.appendChild(buttonTouchResponseFill);
	buttonTouchResponse.appendChild(buttonTouchResponseDiv);

	button.appendChild(buttonTouchResponse);

	// Add the button to the page
	document.getElementById('above-the-fold').children.namedItem("top-row").children.namedItem("owner").children.namedItem("shuffle-button").children[0].children[0].appendChild(button);

	shuffleButton = document.getElementById('above-the-fold').children.namedItem("top-row").children.namedItem("owner").children.namedItem("shuffle-button");
	shuffleButtonText = shuffleButton.children[0].children[0].children[0].children[1].children[0];

	// Add the event listener that shuffles the videos to the button
	shuffleButton.addEventListener("click", shuffleVideos);
}