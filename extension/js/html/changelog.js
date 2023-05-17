// Contains logic for the "changelog" page

const domElements = getDomElements();

// Get all relevant DOM elements
function getDomElements() {
	return {
		// The div containing all other elements
		randomYoutubeVideo: document.getElementById("randomYoutubeVideo"),
		// The document heading with the current version
		updateHeading: document.getElementById("updateHeading"),
		// Text that is shown if there is no changelog for the currently installed version
		noChangelogErrorP: document.getElementById("noChangelogErrorP"),
		// Div that is shown if the changelog cannot be fetched in a reasonable amount of time
		genericErrorDiv: document.getElementById("genericErrorDiv"),
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

let changelogText = await fetchChangelog(`v${currentVersion}`);

// ----- Dropdown menu -----
const availableVersions = getVersions(changelogText);
try {
	addVersionsToDropdown(availableVersions);
} catch (error) {
	domElements.genericErrorDiv.classList.remove("hidden");
}

function getVersions(changelogText) {
	const regex = /v\d+(\.\d+)+/g;
	return changelogText.match(regex);
}

function addVersionsToDropdown(versions) {
	// Add all versions to the dropdown menu
	versions.forEach(version => {
		const option = document.createElement("option");
		option.value = version;
		option.innerText = version;
		domElements.chooseChangelogVersionDropdown.appendChild(option);
	});
}

// Change the displayed changelog to the chosen version
domElements.chooseChangelogVersionDropdown.addEventListener("change", async function () {
	await updateChangelog(this.value);
});

// ----- Changelog -----
// Do this after adding the dropdown options, so that if there is no changelog for the current version, we know the most recent version that does have a changelog
try {
	await updateChangelog();
} catch (error) {
	domElements.genericErrorDiv.classList.remove("hidden");
}
displayErrorAfterWaiting();

async function fetchChangelog(forVersion = `v${currentVersion}`) {
	// Get the current changelog from GitHub
	let changelog = await fetch(`https://raw.githubusercontent.com/NikkelM/Random-YouTube-Video/${forVersion}/CHANGELOG.md`)
		.then(response => response.text());

	if (changelog === "404: Not Found") {
		changelog = await fetch("https://raw.githubusercontent.com/NikkelM/Random-YouTube-Video/main/CHANGELOG.md")
			.then(response => response.text());
	}

	return changelog;
}

async function updateChangelog(forVersion = `v${currentVersion}`) {
	if (changelogText === null) {
		changelogText = await fetchChangelog(forVersion);
	}
	domElements.whatsNewHeader.innerText = `What's new in ${forVersion}:`;

	// Get the text between "## ${version}" and the next "##", or if there is none, the end of the changelog
	const versionIndex = changelogText.indexOf(`## ${forVersion}`);
	const nextVersionIndex = changelogText.indexOf("##", versionIndex + `## ${forVersion}`.length);
	// If there is no next version, use the end of the changelog
	const endIndex = nextVersionIndex !== -1 ? nextVersionIndex : changelogText.length;

	let thisVersionChangelog = versionIndex !== -1
		? changelogText.substring(
			versionIndex + `## v${forVersion}`.length, endIndex)
		: "";

	// If the given version has no changelog available, try to get the changelog for the latest version
	if (thisVersionChangelog === "") {
		updateChangelog(availableVersions[0]);
		domElements.noChangelogErrorP.classList.remove("hidden");
		return;
	}

	// Add the changelog to the changelogDiv in the form of an unordered list, with each line being a list item, minus the leading "- "
	const changelogList = document.createElement("ul");
	changelogList.classList.add("thirdWidth", "textLeft");
	changelogList.innerHTML = thisVersionChangelog.replace(/^- /gm, "<li>");

	// Replace the current child of the changelogDiv with the new list
	domElements.changelogDiv.children[0].replaceWith(changelogList);

	// Show the changelog if it was hidden
	domElements.belowHeadingDiv.classList.remove("hidden");
}

// If the main content is not shown yet, it means the changelog could not be fetched
async function displayErrorAfterWaiting(ms = 2000) {
	await delay(ms);
	if (domElements.belowHeadingDiv.classList.contains("hidden")) {
		domElements.genericErrorDiv.classList.remove("hidden");
	}
}

// ----- Shuffling Hints -----
let currentHint = await displayShufflingHint(domElements.shufflingTipP);
// Add click listener to the "New tip" button
domElements.nextTipButton.addEventListener("click", async function () {
	currentHint = await displayShufflingHint(domElements.shufflingTipP, currentHint);
});