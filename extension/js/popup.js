const button = document.getElementById("submit-api-key");

if (await chrome.storage.local.get(["API_KEY"]) != null) {
	const textField = document.getElementById("api-key-input");
	await chrome.storage.local.get(["API_KEY"]).then((result) => {
		textField.value = result.API_KEY ?? "";
	});
}

// API key submitted
button.addEventListener("click", async () => {
	const textInput = document.getElementById("api-key-input").value;
	await chrome.storage.local.set({ "API_KEY": textInput });
	
	const msg = {
		command: 'set_API_key',
		data: {
			val: textInput
		}
	};
	chrome.runtime.sendMessage(msg);
});