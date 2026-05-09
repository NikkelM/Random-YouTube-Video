// Builds the "Shuffle" buttons that are used by the extension, and handles other dom related tasks

// ----- Public -----
export let shuffleButton;
export let shuffleButtonTextElement;
export let shuffleButtonTooltipElement;

export function buildShuffleButton(pageType, channelId, eventVersion, clickHandler) {
	let buttonDivID;
	let buttonDivExtraStyle = "";
	let buttonDivOwner;
	let buttonDivAppend = true;
	let isLargeButton = true;

	// Depending on the type of page we're on, we might need to change certain parts of the button
	switch (pageType) {
		case "channel":
			buttonDivID = "youtube-random-video-large-shuffle-button-channel";
			switch (eventVersion) {
				case "default":
					buttonDivOwner = [document.getElementById("channel-header").querySelector("#inner-header-container").children.namedItem("buttons")];
					buttonDivExtraStyle = "margin-left: 8px;";
					break;
				case "20240521":
					buttonDivOwner = [document.getElementById("page-header").getElementsByTagName("yt-flexible-actions-view-model")[0]];
					break;
			}
			break;
		case "video":
			buttonDivID = "youtube-random-video-large-shuffle-button-video";
			buttonDivExtraStyle = "margin-left: 8px;";
			buttonDivOwner = [document.getElementById("above-the-fold").children.namedItem("top-row").children.namedItem("owner")];
			break;
		case "short":
			isLargeButton = false;
			buttonDivID = "youtube-random-video-small-shuffle-button-short";
			buttonDivAppend = false;
			buttonDivOwner = document.querySelectorAll("ytd-reel-video-renderer ytd-reel-player-overlay-renderer #actions");
			break;
		default:
			console.warn(`Cannot build button: Unknown page type: ${pageType}`);
			return;
	}

	// If we are on a video page, modify the "min-width" of the two divs holding the buttons to make room for the "Shuffle" button
	// This doesn't fix them overlapping in all cases, but most times it does
	if (pageType == "video") {
		buttonDivOwner[0].style.minWidth = "calc(50% + 50px)";
		buttonDivOwner[0].parentElement.children.namedItem("actions").style.minWidth = "calc(50% - 62px)";
	}

	// If the button should not be visible but exists, hide it
	if (document.getElementById(buttonDivID) && !channelId) {
		document.getElementById(buttonDivID).style.display = "none";
		console.log("No channelId found: Button should not be visible, hiding it.");
		return;
	}

	if (!channelId) {
		console.log("Cannot build button: No channelID found.");
		return;
	}

	// If all required buttons already exist, don't build them again, but only update values
	let allButtonsOnPage = document.querySelectorAll(`#${buttonDivID}`);
	if (allButtonsOnPage.length >= buttonDivOwner.length) {
		let button;
		if (pageType === "short") {
			// If we are on a shorts page, get the button of the active renderer
			button = document.querySelector("ytd-reel-video-renderer[is-active] ytd-reel-player-overlay-renderer #actions").children.namedItem(buttonDivID);
		} else {
			button = document.getElementById(buttonDivID);
		}

		// Unhide the button if it was hidden
		button.style.display = "flex";

		// Update the channelId
		let btnElement = button.querySelector('button');
		if (btnElement) {
			btnElement.dataset.channelId = channelId ?? "";
		}

		// Set the variables to the correct button reference
		shuffleButton = button;
		if (isLargeButton) {
			shuffleButtonTextElement = shuffleButton.querySelector('#random-youtube-video-large-shuffle-button-text');
		} else {
			shuffleButtonTextElement = shuffleButton.querySelector('#random-youtube-video-small-shuffle-button-text');
		}
		let tooltipEl = shuffleButton.querySelector('tp-yt-paper-tooltip');
		let tooltipDiv = tooltipEl?.querySelector('#tooltip');
		shuffleButtonTooltipElement = {
			get innerText() { return tooltipDiv?.textContent ?? ""; },
			set innerText(val) {
				if (tooltipDiv) tooltipDiv.textContent = val;
			}
		};

		return;
		// Else, we need to build new buttons for those owners that don't have one yet
	} else {
		buttonDivOwner = Array.from(buttonDivOwner).filter(owner => !owner.children.namedItem(buttonDivID));
	}

	// Create the button wrapper div (no ytd-button-renderer - we use self-contained styled buttons)
	let buttonDiv;
	if (pageType === "channel" || pageType === "video") {
		buttonDiv = `
	<div id="${buttonDivID}" style="align-items: center; display: flex; flex-direction: row; flex: none; ${buttonDivExtraStyle}">
	</div>`;
	} else if (pageType === "short") {
		buttonDiv = `
	<div id="${buttonDivID}" class="button-container style-scope ytd-reel-player-overlay-renderer" style="${buttonDivExtraStyle}">
	</div>`;
	}
	buttonDiv = new DOMParser().parseFromString(buttonDiv, "text/html").body.firstChild;

	buttonDivOwner.forEach(owner => {
		// Only add a button if there isn't one already (which can happen for shorts pages)
		if (owner.children.namedItem(buttonDivID) == null) {
			const cloneButtonDiv = buttonDiv.cloneNode(true);

			// Depending on the page we're on, we may want to prepend or append the button to the parent
			if (buttonDivAppend) {
				owner.appendChild(cloneButtonDiv);
			} else {
				owner.prepend(cloneButtonDiv);
			}
		}
	});

	// Build the button directly (no need to wait for YouTube component upgrade)
	finalizeButton(pageType, channelId, clickHandler, isLargeButton, buttonDivOwner, buttonDivID);
}

export function tryRenameUntitledList(attempt = 1) {
	let mainPlaylistElement = document.querySelector("ytd-playlist-panel-renderer#playlist.style-scope.ytd-watch-flexy")?.querySelector("yt-formatted-string.title.style-scope.ytd-playlist-panel-renderer");
	let collapsedPlaylistElement = document.querySelector("ytd-playlist-panel-renderer#playlist.style-scope.ytd-watch-flexy")?.querySelector("yt-formatted-string.byline-title.style-scope.ytd-playlist-panel-renderer");

	// Retry this a few times, in case the element has not yet loaded in
	if (!mainPlaylistElement || !collapsedPlaylistElement) {
		if (attempt <= 10) {
			setTimeout(() => tryRenameUntitledList(attempt + 1), 200);
			return;
		} else {
			return;
		}
	}

	for (let playlistType of [mainPlaylistElement, collapsedPlaylistElement]) {
		if (playlistType && window.location.href.includes("&list=TL") && playlistType.title == "Untitled List") {
			playlistType.innerText = "Random YouTube Video - Playlist";
			playlistType.title = "This playlist is unlisted, temporary and cannot be saved. You can visit it using the link in the URL bar until it is removed by YouTube, which will happen automatically.";
			// With the way that YouTube handles navigation, the playlist title somehow won't get updated correctly when navigating if we change it here at any point
			// So we need to change it back if the user moves to a different playlist
		} else if (playlistType) {
			playlistType.innerText = playlistType.title;
		}
	}
}

// ----- Private -----
function finalizeButton(pageType, channelId, clickHandler, isLargeButton, buttonDivOwner, buttonDivID) {
	let button;
	if (isLargeButton) {
		button = `
		<button
			class="ryv-shuffle-btn"
			aria-label="Shuffle from this channel"
			data-channel-id="${channelId ?? ""}">
				<span class="material-symbols-outlined" style="font-size: 24px; width: 24px; overflow: hidden;">
					shuffle
				</span>
				<span id="random-youtube-video-large-shuffle-button-text" role="text" style="white-space: nowrap;">
					&nbsp;Shuffle
				</span>
		</button>`;
	} else {
		button = `
		<button
			class="ryv-shuffle-btn-small"
			aria-label="Shuffle from this channel"
			data-channel-id="${channelId ?? ""}">
				<span id="random-youtube-video-small-shuffle-button-text" class="material-symbols-outlined" style="font-size: 24px; width: 100%; height: 100%; overflow: hidden; display: flex; align-items: center; justify-content: center;">
					shuffle
				</span>
		</button>`;
	}
	button = new DOMParser().parseFromString(button, "text/html").body.firstChild;

	// Clear any auto-generated content from the wrapper and add our button + YouTube tooltip
	buttonDivOwner.forEach(owner => {
		let wrapper = owner.children.namedItem(buttonDivID);
		// Clear existing children
		wrapper.innerHTML = "";

		let cloneButton = button.cloneNode(true);
		wrapper.appendChild(cloneButton);

		// Create YouTube-native tooltip via document.createElement for proper Polymer upgrade
		let tooltip = document.createElement("tp-yt-paper-tooltip");
		tooltip.setAttribute("fit-to-visible-bounds", "");
		tooltip.setAttribute("offset", "8");
		tooltip.setAttribute("role", "tooltip");
		tooltip.setAttribute("tabindex", "-1");
		tooltip.textContent = isLargeButton ? "Shuffle from this channel" : "Shuffle from channel";
		wrapper.appendChild(tooltip);

		// Add the event listener to the button element itself
		cloneButton.addEventListener("click", clickHandler);
	});

	// Set the references to the current button
	let activeButton;
	if (pageType === "short") {
		activeButton = document.querySelector("ytd-reel-video-renderer[is-active] ytd-reel-player-overlay-renderer #actions").children.namedItem(buttonDivID);
	} else {
		activeButton = document.getElementById(buttonDivID);
	}

	shuffleButton = activeButton;
	if (isLargeButton) {
		shuffleButtonTextElement = shuffleButton.querySelector('#random-youtube-video-large-shuffle-button-text');
	} else {
		shuffleButtonTextElement = shuffleButton.querySelector('#random-youtube-video-small-shuffle-button-text');
	}
	// Update tooltip text via Polymer's internal #tooltip div (not the comment node firstChild)
	let tooltipEl = shuffleButton.querySelector('tp-yt-paper-tooltip');
	let tooltipDiv = tooltipEl?.querySelector('#tooltip');
	shuffleButtonTooltipElement = {
		get innerText() { return tooltipDiv?.textContent ?? ""; },
		set innerText(val) {
			if (tooltipDiv) tooltipDiv.textContent = val;
		}
	};
}