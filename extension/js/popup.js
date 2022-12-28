import configSync from "./config.js";

const optionAToggle = document.getElementById("optionAToggle");

optionAToggle.addEventListener("change", function () {
	if (this.checked) {
		setSyncStorageValue("optionAToggle", true);
	} else {
		setSyncStorageValue("optionAToggle", false);
	}
});

async function setSyncStorageValue(key, value) {
	await chrome.storage.sync.set({ [key]: value });
	console.log("Set " + key + " to " + value + " in sync storage");
}