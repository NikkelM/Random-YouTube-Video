// Contains logic for the "changelog" page

const domElements = getDomElements();

// Get all relevant DOM elements
function getDomElements() {
	return {
		// The div containing all other elements
		randomYoutubeVideo: document.getElementById("randomYoutubeVideo"),

		// The heading containing the new version number
		updateHeading: document.getElementById("updateHeading"),

		// The div containing the changelog, an unordered list element
		changelogDiv: document.getElementById("changelogDiv"),

		// The p element containing the shuffle tip
		shufflingTipP: document.getElementById("shufflingTipP"),

		// The button that displays the next shuffle tip
		nextTipButton: document.getElementById("nextTipButton"),
	}
}

const currentVersion = chrome.runtime.getManifest().version;
domElements.updateHeading.innerText = `Random YouTube Video - v${currentVersion}`;

let changelogText = null;
await updateChangelog();

async function fetchChangelog(forVersion = currentVersion) {
	// Get the current changelog from GitHub
	let changelog = await fetch(`https://raw.githubusercontent.com/NikkelM/Random-YouTube-Video/v${forVersion}/CHANGELOG.md`)
		.then(response => response.text());

	if (changelog === "404: Not Found") {
		changelog = "\n- Could not fetch the changelog from GitHub. Try again later or visit GitHub directly.";
	}

	return changelog;
}

async function updateChangelog(forVersion = currentVersion) {
	if (changelogText === null) {
		changelogText = await fetchChangelog(forVersion);
	}

	// Get the text between "## v${version}" and the next "##"
	const versionIndex = changelogText.indexOf(`## v${forVersion}`);

	changelogText = versionIndex !== -1
		? changelogText.substring(
			versionIndex + `## v${forVersion}`.length,
			changelogText.indexOf("##", versionIndex + `## v${forVersion}`.length))
		: "";
	console.log(changelogText)

	if (changelogText === "") {
		changelogText = `\n- No changes found for this version (v${forVersion}).`;
	}

	// Add the changelog to the changelogDiv in the form of an unordered list, with each line being a list item, minus the leading "- "
	const changelogList = document.createElement("ul");
	changelogList.classList.add("thirdWidth", "textLeft");
	changelogList.innerHTML = changelogText.replace(/^- /gm, "<li>");

	// Replace the current child of the changelogDiv with the new list
	domElements.changelogDiv.children[0].replaceWith(changelogList);
}

// Logic for displaying hints
let currentHint = await displayShufflingHint(domElements.shufflingTipP);
// Add click listener to the "New tip" button
domElements.nextTipButton.addEventListener("click", async function () {
	currentHint = await displayShufflingHint(domElements.shufflingTipP, currentHint);
});
