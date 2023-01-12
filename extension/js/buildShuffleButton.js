// Builds the randomize-buttons that are used by the extension

// Channel page
function buildShuffleButton(pageType) {
	let buttonDivID = "youtube-random-video-shuffle-button";
	let buttonDivExtraStyle = "";
	let buttonDivOwner = null;
	let buttonDivPrepend = true;

	// Depending on the type of page we're on, we might need to change certain parts of the button
	switch (pageType) {
		case "channel":
			buttonDivID = "youtube-random-video-shuffle-button-channel";
			buttonDivOwner = document.getElementById("inner-header-container").children.namedItem("buttons");
			break;
		case "video":
			buttonDivID = "youtube-random-video-shuffle-button-video";
			buttonDivExtraStyle = "margin-left: 8px;";
			buttonDivOwner = document.getElementById("above-the-fold").children.namedItem("top-row").children.namedItem("owner");
			buttonDivPrepend = false;
			break;
		default:
			console.warn("Cannot build button: unknown page type: " + pageType);
			return;
	}

	// If the button already exists, don't build it again
	if (document.getElementById(buttonDivID)) {
		console.log("Button already exists, not building again.");
		return;
	}

	// Load the font used for the "shuffle" icon
	let iconFont = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@48,400,0,0">`;
	iconFont = new DOMParser().parseFromString(iconFont, "text/html").head.firstChild;
	document.head.appendChild(iconFont);

	// Create the button div & renderer
	let buttonDiv = `
	<div id="${buttonDivID}" class="style-scope ytd-c4-tabbed-header-renderer" style="align-items: center; display: flex; flex-direction: row; ${buttonDivExtraStyle}">
		<ytd-button-renderer class="style-scope ytd-c4-tabbed-header-renderer">
		</ytd-button-renderer>
	</div>`;
	buttonDiv = new DOMParser().parseFromString(buttonDiv, "text/html").body.firstChild;

	// Depending on the page we're on, we wat to prepend or append the button to the owner
	if (buttonDivPrepend) {
		buttonDivOwner.prepend(buttonDiv);
	} else {
		buttonDivOwner.appendChild(buttonDiv);
	}

	// Wait for the button renderer to get the child elements defined by the element type (YouTube thing...)
	var observer = new MutationObserver(function (mutations, me) {
		var shuffleButton = buttonDivOwner.children.namedItem(buttonDivID);
		if (shuffleButton.children.length > 0) {
			finalizeButton(pageType);
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

function finalizeButton(pageType) {
	let buttonDivID = "youtube-random-video-shuffle-button";
	let buttonDivOwner = null;

	switch (pageType) {
		case "channel":
			buttonDivID = "youtube-random-video-shuffle-button-channel";
			buttonDivOwner = document.getElementById("inner-header-container").children.namedItem("buttons");
			break;
		case "video":
			buttonDivID = "youtube-random-video-shuffle-button-video";
			buttonDivOwner = document.getElementById("above-the-fold").children.namedItem("top-row").children.namedItem("owner");
			break;
		default:
			console.warn("Cannot build button: unknown page type: " + pageType);
			return;
	}

	let buttonText = "&nbsp;Random";
	let button = `
	<button
		class="yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m"
		aria-label="Shuffle all videos">
			<span class="material-symbols-outlined">
				shuffle
			</span>
			<div class="cbox yt-spec-button-shape-next--button-text-content">
				<span class="yt-core-attributed-string yt-core-attributed-string--white-space-no-wrap" role="text">
					${buttonText}
				</span>
			</div>
			<yt-touch-feedback-shape style="border-radius: inherit;">
				<div class="yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response" aria-hidden="true">
					<div class="yt-spec-touch-feedback-shape__stroke" style></div>
					<div class="yt-spec-touch-feedback-shape__fill" style></div>
				</div>
			</yt-touch-feedback-shape>
	</button>`;
	button = new DOMParser().parseFromString(button, "text/html").body.firstChild;

	// Add the button to the page
	buttonDivOwner.children.namedItem(buttonDivID).children[0].children[0].appendChild(button);

	// Set references to the button and the text inside the button
	shuffleButton = buttonDivOwner.children.namedItem(buttonDivID);
	shuffleButtonText = shuffleButton.children[0].children[0].children[0].children[1].children[0];

	// Add the event listener that shuffles the videos to the button
	shuffleButton.addEventListener("click", shuffleVideos);
}