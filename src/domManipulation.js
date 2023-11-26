// Builds the 'Shuffle' buttons that are used by the extension, and handles other dom related tasks

// ----- Public -----
export let shuffleButton = null;
export let shuffleButtonTextElement = null;

export function buildShuffleButton(pageType, channelId, clickHandler) {
	let buttonDivID = null;
	let buttonDivExtraStyle = "";
	let buttonDivOwner = null;
	let buttonDivAppend = true;
	let isSmallButton = false;

	// Depending on the type of page we're on, we might need to change certain parts of the button
	switch (pageType) {
		case "channel":
			buttonDivID = "youtube-random-video-large-shuffle-button-channel";
			buttonDivOwner = [document.getElementById("channel-header").querySelector("#inner-header-container").children.namedItem("buttons")];
			break;
		case "video":
			buttonDivID = "youtube-random-video-large-shuffle-button-video";
			buttonDivExtraStyle = "margin-left: 8px;";
			buttonDivOwner = [document.getElementById("above-the-fold").children.namedItem("top-row").children.namedItem("owner")];
			break;
		case "short":
			isSmallButton = true;
			buttonDivID = "youtube-random-video-small-shuffle-button-short";
			buttonDivAppend = false;
			buttonDivOwner = document.querySelectorAll("ytd-reel-video-renderer ytd-reel-player-overlay-renderer #actions");
			break;
		default:
			console.warn(`Cannot build button: Unknown page type: ${pageType}`);
			return;
	}

	// If we are on a video page, modify the "min-width" of the two divs holding the buttons to make room for the 'Shuffle' button
	// This doesn't fix them overlapping in all cases, but most times it does
	if (pageType == "video") {
		buttonDivOwner[0].style.minWidth = "calc(50% + 50px)";
		buttonDivOwner[0].parentElement.children.namedItem("actions").style.minWidth = "calc(50% - 62px)";
	}

	// If the button should not be visible but exists, hide it
	if (document.getElementById(buttonDivID) && !channelId) {
		document.getElementById(buttonDivID).style.display = "none";
		console.log('No channelId found: Button should not be visible, hiding it.');
		return;
	}

	// If all required buttons already exist, don't build them again, but only update values
	let allButtonsOnPage = document.querySelectorAll(`#${buttonDivID}`);
	if (allButtonsOnPage.length >= buttonDivOwner.length && channelId) {
		let button = null;
		if (pageType === "short") {
			// If we are on a shorts page, get the button of the active renderer
			button = document.querySelector("ytd-reel-video-renderer[is-active] ytd-reel-player-overlay-renderer #actions").children.namedItem(buttonDivID);
		} else {
			button = document.getElementById(buttonDivID);
		}

		// Unhide the button if it was hidden
		button.style.display = "flex";

		// Update the channelId
		button.children[0].children[0].children[0].children.namedItem('channelId').innerText = channelId ?? "";

		// Set the variables to the correct button reference (channel vs. video vs. shorts page)
		shuffleButton = button;
		if (isSmallButton) {
			shuffleButtonTextElement = shuffleButton.children[0].children[0].children[0].children[0].children[0];
		} else {
			shuffleButtonTextElement = shuffleButton.children[0].children[0].children[0].children[1].children[0];
		}

		return;
	}

	if (!channelId) {
		console.log("Cannot build button: No channelID found.");
		return;
	}

	// Create the button div & renderer
	let buttonDiv;
	if (pageType === "channel" || pageType === "video") {
		buttonDiv = `
	<div id="${buttonDivID}" class="style-scope ytd-c4-tabbed-header-renderer" style="align-items: center; display: flex; flex-direction: row; ${buttonDivExtraStyle}">
		<ytd-button-renderer class="style-scope ytd-c4-tabbed-header-renderer">
		</ytd-button-renderer>
	</div>`;
	} else if (pageType === "short") {
		buttonDiv = `
	<div id="${buttonDivID}" class="button-container style-scope ytd-reel-player-overlay-renderer" style="${buttonDivExtraStyle}">
		<ytd-button-renderer class="style-scope ytd-reel-player-overlay-renderer" button-renderer="" button-next="">
		</ytd-button-renderer>
	</div>`;
	}
	buttonDiv = new DOMParser().parseFromString(buttonDiv, "text/html").body.firstChild;

	// Depending on the page we're on, we may want to prepend or append the button to the parent
	if (buttonDivAppend) {
		buttonDivOwner.forEach(owner => {
			// Only add a button if there isn't one already (which can happen for shorts pages)
			if (owner.children.namedItem(buttonDivID) == null) {
				const cloneButtonDiv = buttonDiv.cloneNode(true);
				owner.appendChild(cloneButtonDiv);
			}
		});
	} else {
		buttonDivOwner.forEach(owner => {
			if (owner.children.namedItem(buttonDivID) == null) {
				const cloneButtonDiv = buttonDiv.cloneNode(true);
				owner.prepend(cloneButtonDiv);
			}
		});
	}

	// Wait for the button renderer to get the child elements defined by the element type
	let observer = new MutationObserver(function (mutations, me) {
		let shuffleButton = buttonDivOwner[buttonDivOwner.length - 1].children.namedItem(buttonDivID);
		if (shuffleButton.children.length > 0) {
			me.disconnect(); // Stop observing
			finalizeButton(pageType, channelId, clickHandler, isSmallButton);
			return;
		}
	});

	// start observing
	observer.observe(document, {
		childList: true,
		subtree: true
	});
}

export function tryRenameUntitledList() {
	let untitledListElement = document.querySelector('ytd-playlist-panel-renderer#playlist.style-scope.ytd-watch-flexy').querySelector('yt-formatted-string');

	if (untitledListElement) {
		untitledListElement.innerText = "Random YouTube Video - Playlist";
		untitledListElement.title = "This playlist is unlisted, temporary and cannot be saved. Until it is removed by YouTube (which will happen automatically), you can revisit it using the link in the URL bar.";
	}
}

// ----- Private -----
function finalizeButton(pageType, channelId, clickHandler, isSmallButton) {
	let buttonText = "&nbsp;Shuffle";
	let buttonDivID = null;
	let buttonDivOwner = null;

	switch (pageType) {
		case "channel":
			buttonDivID = "youtube-random-video-large-shuffle-button-channel";
			buttonDivOwner = [document.getElementById("inner-header-container").children.namedItem("buttons")];
			break;
		case "video":
			buttonDivID = "youtube-random-video-large-shuffle-button-video";
			buttonDivOwner = [document.getElementById("above-the-fold").children.namedItem("top-row").children.namedItem("owner")];
			break;
		case "short":
			buttonDivID = "youtube-random-video-small-shuffle-button-short";
			buttonDivOwner = document.querySelectorAll("ytd-reel-video-renderer ytd-reel-player-overlay-renderer #actions");
			break;
		default:
			console.warn(`Cannot build button: unknown page type: ${pageType}`);
			return;
	}

	let button;
	if (isSmallButton) {
		button = `
		<button
			class="yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-l yt-spec-button-shape-next--icon-button"
			aria-label="Shuffle from this channel">
				<div class="yt-spec-button-shape-next__icon">
					<span id="random-youtube-video-small-shuffle-button-text" class="material-symbols-outlined" style="width: 24.01px; overflow: hidden;">
						shuffle
					</span>
				</div>
				<!--TODO: Do we need this still?-->
				<span style="display: none">
					<span></span>
				</span>
				<yt-touch-feedback-shape style="border-radius: inherit;">
					<div class="yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response" aria-hidden="true">
						<div class="yt-spec-touch-feedback-shape__stroke" style></div>
						<div class="yt-spec-touch-feedback-shape__fill" style></div>
					</div>
				</yt-touch-feedback-shape>
				<span id="channelId" style="display: none">${channelId ?? ""}</span>
		</button>`;
	} else {
		button = `
	<button
		class="yt-spec-button-shape-next yt-spec-button-shape-next--tonal yt-spec-button-shape-next--mono yt-spec-button-shape-next--size-m"
		aria-label="Shuffle from this channel">
			<span class="material-symbols-outlined" style="width: 24.01px; overflow: hidden;">
				shuffle
			</span>
			<div class="cbox yt-spec-button-shape-next--button-text-content">
				<span id="random-youtube-video-large-shuffle-button-text" class="yt-core-attributed-string yt-core-attributed-string--white-space-no-wrap" role="text">
					${buttonText}
				</span>
			</div>
			<yt-touch-feedback-shape style="border-radius: inherit;">
				<div class="yt-spec-touch-feedback-shape yt-spec-touch-feedback-shape--touch-response" aria-hidden="true">
					<div class="yt-spec-touch-feedback-shape__stroke" style></div>
					<div class="yt-spec-touch-feedback-shape__fill" style></div>
				</div>
			</yt-touch-feedback-shape>
			<span id="channelId" style="display: none">${channelId ?? ""}</span>
	</button>`;
	}
	button = new DOMParser().parseFromString(button, "text/html").body.firstChild;

	let buttonTooltip = `
	<tp-yt-paper-tooltip fit-to-visible-bounds offset="8" role="tooltip" tabindex="-1">
	</tp-yt-paper-tooltip>`;
	buttonTooltip = new DOMParser().parseFromString(buttonTooltip, "text/html").body.firstChild;
	buttonTooltip.innerText = "Shuffle from this channel";

	// Remove the original button tooltip, it does not have all required attributes
	buttonDivOwner.forEach(owner => {
		owner.children.namedItem(buttonDivID).children[0].removeChild(owner.children.namedItem(buttonDivID).children[0].children[1]);
	});

	// Add the correct tooltip
	buttonDivOwner.forEach(owner => {
		let cloneButtonTooltip = buttonTooltip.cloneNode(true);
		owner.children.namedItem(buttonDivID).children[0].appendChild(cloneButtonTooltip);
	});

	// Add the button to the page
	buttonDivOwner.forEach(owner => {
		let cloneButton = button.cloneNode(true);
		owner.children.namedItem(buttonDivID).children[0].children[0].appendChild(cloneButton);
	});

	// Set the click handler for all buttons
	buttonDivOwner.forEach(owner => {
		// The shuffleButton must be the currently active short
		shuffleButton = owner.children.namedItem(buttonDivID);

		// Add the event listener that shuffles the videos to the button
		shuffleButton.addEventListener("click", clickHandler);
	});

	// Finally, set the references to the current button
	let activeButton = null;
	if (pageType === "short") {
		// If we are on a shorts page, get the button of the active renderer
		activeButton = document.querySelector("ytd-reel-video-renderer[is-active] ytd-reel-player-overlay-renderer #actions").children.namedItem(buttonDivID);
	} else {
		activeButton = document.getElementById(buttonDivID);
	}

	shuffleButton = activeButton;
	if (isSmallButton) {
		shuffleButtonTextElement = shuffleButton.children[0].children[0].children[0].children[0].children[0];
	} else {
		shuffleButtonTextElement = shuffleButton.children[0].children[0].children[0].children[1].children[0];
	}
}