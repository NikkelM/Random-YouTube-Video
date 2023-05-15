// Contains logic for the "extensionUpdate" page that is opened after the extension was updated

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

await updateChangelog(currentVersion);

async function updateChangelog(version) {
	// Get the complete changelog from GitHub
	let versionChangelog = await fetch(`https://raw.githubusercontent.com/NikkelM/Random-YouTube-Video/v${version}/CHANGELOG.md`)
		.then(response => response.text());

	if (versionChangelog === "404: Not Found") {
		versionChangelog = `\n- Could not find any release notes for this version (${version}).`;
	} else {
		// Get only the text between the <!--Releasenotes start--> and <!--Releasenotes end--> lines
		versionChangelog = versionChangelog.substring(
			versionChangelog.indexOf("<!--Releasenotes start-->") + "<!--Releasenotes start-->".length,
			versionChangelog.indexOf("<!--Releasenotes end-->")
		);
	}

	// Add the changelog to the changelogDiv in the form of an unordered list, with each line being a list item, minus the leading "- "
	const changelogList = document.createElement("ul");
	changelogList.classList.add("thirdWidth", "textLeft");
	changelogList.innerHTML = versionChangelog.replace(/^- /gm, "<li>");
	// Replace the current child of the changelogDiv with the new list
	domElements.changelogDiv.children[0].replaceWith(changelogList);
}


// Tip logic
const jsonFileUrl = chrome.runtime.getURL('data/shufflingTips.json');
const jsonData = await loadJsonFile(jsonFileUrl);
let currentHint = await displayShufflingHints();

// Add click listener to the "New tip" button
domElements.nextTipButton.addEventListener("click", async function () {
	currentHint = await displayShufflingHints(currentHint);
});

async function displayShufflingHints(currentHintIndex = null) {
	// Choose a (new) random hint from the JSON file and display it
	let randomHintIndex = currentHintIndex;
	while (randomHintIndex === currentHintIndex) {
		randomHintIndex = Math.floor(Math.random() * jsonData.length);
	}
	const randomHint = jsonData[randomHintIndex];

	// Insert line breaks into the hint text after every 70 characters, but don't break words
	const displayedText = randomHint//.replace(/(.{1,80})(?:\s+|$)/g, "$1\n");

	domElements.shufflingTipP.innerText = displayedText;

	return randomHintIndex;
}
