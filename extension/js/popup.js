const optionAToggle = document.getElementById("optionAToggle");

optionAToggle.addEventListener("change", function () {
	if (this.checked) {
		console.log("checked");
		setSyncStorageValue("optionAToggle", true);
	} else {
		console.log("unchecked");
		setSyncStorageValue("optionAToggle", false);
	}
});

async function setSyncStorageValue(key, value) {
	await chrome.storage.sync.set({ [key]: value });
	console.log("Set " + key + " to " + value + " in sync storage");
}

console.log("config");
console.log(config);