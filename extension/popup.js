const button = document.getElementById("submit-api-key");

button.addEventListener("click", async () => {
	const textInput = document.getElementById("api-key-input").value;
  await chrome.storage.local.set({"API_KEY": textInput})
});

if (await chrome.storage.local.get(["API_KEY"]) != null) {
	const textField = document.getElementById("api-key-input")
	await chrome.storage.local.get(["API_KEY"]).then((result) => {
    textField.value = result.API_KEY ?? "";
  });
}