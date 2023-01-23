// Builds the shuffle-buttons that are used by the extension

// If we find a video URL, we can shuffle, as we can get the channel id from the video URL
let videoId = null;
let currentChannel = null;

function updateShufflePrerequisites() {
	const oldVideoId = videoId;
	const thisChannel = document.getElementById('inner-header-container')?.querySelector('ytd-channel-name')?.querySelector('yt-formatted-string')?.innerHTML;

	// Reset the video if if we are on a different channel
	if (isVideoUrl(window.location.href)) {
		// Just set it to something unique
		currentChannel = window.location.href;

		videoId = window.location.href.split("v=")[1].split("&")[0];

		return oldVideoId !== videoId;
	} else if (thisChannel) {
		if (currentChannel !== thisChannel) {
			videoId = null;
			currentChannel = thisChannel;
		}
	} else {
		currentChannel = null;
		videoId = null;
	}

	const visibleVideoBrowser = document.querySelectorAll('ytd-browse');
	const visibleVideoItem = Array.from(visibleVideoBrowser).filter(node => node.hidden === false)[0];
	const channelPageVideoLink = visibleVideoItem?.querySelector('ytd-grid-video-renderer')?.querySelector('a#video-title').href;

	// If we are on a channel page that has a link to a video, we can shuffle
	// TODO: More ways of getting a video link
	if (channelPageVideoLink) {
		videoId = channelPageVideoLink.split("v=")[1].split("&")[0];
	}

	return oldVideoId !== videoId;
}

function buildShuffleButton(pageType, channelId) {
	// Update videoId and currentChannel
	let mustUpdateVideoId = false;
	if (channelId === null) {
		console.log("No channelId, using fallback method!");
		mustUpdateVideoId = updateShufflePrerequisites();
	}

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

	// If the button should not be visible but exists, hide it
	if (document.getElementById(buttonDivID) && !channelId && (!currentChannel || !videoId)) {
		document.getElementById(buttonDivID).style.display = "none";
		console.log('Button should not be visible, hiding it.');
		return;
	}

	// If the button already exists, don't build it again
	if (document.getElementById(buttonDivID) && (channelId || (currentChannel && videoId))) {
		// Unhide the button if it was hidden
		document.getElementById(buttonDivID).style.display = "flex";
		if (mustUpdateVideoId) {
			document.getElementById(buttonDivID).children[0].children[0].children[0].children.namedItem('videoLink').innerHTML = videoId ?? "";
		}
		document.getElementById(buttonDivID).children[0].children[0].children[0].children.namedItem('channelId').innerHTML = channelId ?? "";

		return;
	}

	if (!channelId && (!currentChannel || !videoId)) {
		console.log("Cannot build button: No channelId, not on a channel page, or no video ID to identify channel.");
		return;
	}

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
			finalizeButton(pageType, channelId);
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

function finalizeButton(pageType, channelId) {
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

	let buttonText = "&nbsp;Shuffle";
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
			<span id="videoLink" style="display: none">${videoId ?? ""}</span>
			<span id="channelId" style="display: none">${channelId ?? ""}</span>
	</button>`;
	button = new DOMParser().parseFromString(button, "text/html").body.firstChild;

	// Add the button to the page
	buttonDivOwner.children.namedItem(buttonDivID).children[0].children[0].appendChild(button);

	// Set references to the button and the text inside the button
	shuffleButton = buttonDivOwner.children.namedItem(buttonDivID);
	shuffleButtonTextElement = shuffleButton.children[0].children[0].children[0].children[1].children[0];

	// Add the event listener that shuffles the videos to the button
	shuffleButton.addEventListener("click", shuffleVideos);
}