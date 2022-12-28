async function fetchConfig() {
	return await chrome.storage.sync.get().then((result) => {
		return result;
	});
}

let configSync = await fetchConfig();

export default configSync;