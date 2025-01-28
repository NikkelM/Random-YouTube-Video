// Shared utility functions for the various HTML pages' logic
import { isFirefox, shufflingHints } from "../config.js";

// ----- Shuffling Hints -----
export async function buildShufflingHints(domElements) {
	let currentHint = await displayShufflingHint(domElements.shufflingHintP);
	// Add click listener to the "New hint" button
	domElements.nextHintButton.addEventListener("click", async function () {
		currentHint = await displayShufflingHint(domElements.shufflingHintP, currentHint);
	});
}

async function displayShufflingHint(displayElement, currentHintIndex = null) {
	// Choose a (new) random hint from the JSON file and display it
	let randomHintIndex = currentHintIndex;
	while (randomHintIndex === currentHintIndex) {
		randomHintIndex = Math.floor(Math.random() * shufflingHints.length);
	}

	displayElement.innerText = shufflingHints[randomHintIndex];

	return randomHintIndex;
}

// ----- Animations -----
export function animateSlideOut(targetElement, shouldSlideOut = null) {
	if (shouldSlideOut) {
		targetElement.classList.remove("active");
	}

	// Sliding out
	if (!targetElement.classList.contains("active") && (shouldSlideOut == null || shouldSlideOut)) {
		targetElement.classList.add("active");
		targetElement.style.height = "auto";

		const targetHeight = targetElement.clientHeight;
		targetElement.style.height = "0px";

		setTimeout(function () {
			targetElement.style.height = targetHeight + "px";
			adjustParentContainerHeight(targetElement, targetHeight);

			// Start scrolling to the bottom of the page
			const startTime = performance.now();
			const duration = 800; // Adjust the duration to match the animation duration
			const initialScrollY = window.scrollY;

			function scrollStep(timestamp) {
				const progress = Math.min((timestamp - startTime) / duration, 1);
				window.scrollTo(0, initialScrollY + (document.body.scrollHeight - initialScrollY) * progress);

				if (progress < 1) {
					requestAnimationFrame(scrollStep);
				}
			}

			if (!isFirefox) {
				requestAnimationFrame(scrollStep);
			}
		}, 0);

		if (!isFirefox) {
			targetElement.addEventListener(
				"transitionend",
				function () {
					// Ensure the page is scrolled to the bottom after the animation
					window.scrollTo(0, document.body.scrollHeight);
				}, {
				once: true
			});
		}
	} else {
		// Sliding in
		const oldHeight = targetElement.clientHeight;
		targetElement.style.height = "0px";

		adjustParentContainerHeight(targetElement, -oldHeight);

		targetElement.addEventListener(
			"transitionend",
			function () {
				targetElement.classList.remove("active");
			}, {
			once: true
		});
	}
}

function adjustParentContainerHeight(childElement, heightChange) {
	const parentElement = childElement.parentElement;

	if (parentElement && parentElement.classList.contains("active")) {
		const currentParentHeight = parseInt(parentElement.style.height) || 0;
		parentElement.style.height = (currentParentHeight + heightChange) + "px";
	}
}

// ----- Tab interaction -----
// For Chromium, we are not allowed to query our own tabs, so this will always return mustOpenTab = true for Chromium with the current use cases
// This is not a big problem, as we only use it to query if the changelog page is already open, or the shuffling page had an error and should be automatically closed
export async function tryFocusingTab(tabUrl) {
	let mustOpenTab = true;
	// Only query for the requested URL (pattern), as we have not been granted the tabs permission which would allow querying all tabs
	let tabs = await chrome.tabs.query({ url: tabUrl });

	for (let i = 0; i <= tabs.length - 1; i++) {
		if (tabs[i].url === tabUrl) {
			// An instance of the page already exists, so don't create a new one
			mustOpenTab = false;
			// Focus the existing tab
			chrome.tabs.update(tabs[i].id, { active: true });
			break;
		}
	}
	return mustOpenTab;
}