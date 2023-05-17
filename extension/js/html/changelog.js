// Contains logic for the "changelog" page

const domElements = getDomElements();

// Get all relevant DOM elements
function getDomElements() {
	return {
		// The div containing all other elements
		randomYoutubeVideo: document.getElementById("randomYoutubeVideo"),
		// The document heading with the current version
		updateHeading: document.getElementById("updateHeading"),
		// The div containing all elements below the heading
		belowHeadingDiv: document.getElementById("belowHeadingDiv"),
		// The heading containing the "What's new in <version>:" text
		whatsNewHeader: document.getElementById("whatsNewHeader"),
		// The div containing the changelog, an unordered list element
		changelogDiv: document.getElementById("changelogDiv"),
		// The dropdown menu for selecting a version
		chooseChangelogVersionDropdown: document.getElementById("chooseChangelogVersionDropdown"),
		// The p element containing the shuffle tip
		shufflingTipP: document.getElementById("shufflingTipP"),
		// The button that displays the next shuffle tip
		nextTipButton: document.getElementById("nextTipButton"),
	}
}

const currentVersion = chrome.runtime.getManifest().version;
domElements.updateHeading.innerText = `Random YouTube Video - v${currentVersion}`;
domElements.whatsNewHeader.innerText = `What's new in v${currentVersion}:`;

let changelogText = null;
await updateChangelog();

async function fetchChangelog(forVersion = `v${currentVersion}`) {
	// Get the current changelog from GitHub
	let changelog = await fetch(`https://raw.githubusercontent.com/NikkelM/Random-YouTube-Video/${forVersion}/CHANGELOG.md`)
		.then(response => response.text());

	if (changelog === "404: Not Found") {
		changelog = "\n- Could not fetch the changelog from GitHub. Try again later or visit GitHub directly.";
	}

	return changelog;
}

async function updateChangelog(forVersion = `v${currentVersion}`) {
	if (changelogText === null) {
		changelogText = await fetchChangelog(forVersion);
		domElements.belowHeadingDiv.classList.remove("hidden");
	}

	// Get the text between "## ${version}" and the next "##", or if there is none, the end of the changelog
	const versionIndex = changelogText.indexOf(`## ${forVersion}`);
	const nextVersionIndex = changelogText.indexOf("##", versionIndex + `## ${forVersion}`.length);
	// If there is no next version, use the end of the changelog
	const endIndex = nextVersionIndex !== -1 ? nextVersionIndex : changelogText.length;

	let thisVersionChangelog = versionIndex !== -1
		? changelogText.substring(
			versionIndex + `## v${forVersion}`.length, endIndex)
		: "";

	if (thisVersionChangelog === "") {
		thisVersionChangelog = `\n- No changes found for this version (${forVersion}).`;
	}

	// Add the changelog to the changelogDiv in the form of an unordered list, with each line being a list item, minus the leading "- "
	const changelogList = document.createElement("ul");
	changelogList.classList.add("thirdWidth", "textLeft");
	changelogList.innerHTML = thisVersionChangelog.replace(/^- /gm, "<li>");

	// Replace the current child of the changelogDiv with the new list
	domElements.changelogDiv.children[0].replaceWith(changelogList);
}

// ----- Dropdown menu -----
const regex = /v\d+(\.\d+)+/g;
const versions = changelogText.match(regex);
// Add all versions to the dropdown menu
versions.forEach(version => {
	const option = document.createElement("option");
	option.value = version;
	option.innerText = version;
	domElements.chooseChangelogVersionDropdown.appendChild(option);
});

// Change the displayed changelog to the chosen version
domElements.chooseChangelogVersionDropdown.addEventListener("change", async function () {
	domElements.whatsNewHeader.innerText = `What's new in ${this.value}:`;
	await updateChangelog(this.value);
});


// ----- Hints -----
let currentHint = await displayShufflingHint(domElements.shufflingTipP);
// Add click listener to the "New tip" button
domElements.nextTipButton.addEventListener("click", async function () {
	currentHint = await displayShufflingHint(domElements.shufflingTipP, currentHint);
});
