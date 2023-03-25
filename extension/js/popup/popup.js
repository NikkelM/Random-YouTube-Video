let configSync = await fetchConfigSync();

// Get all relevant DOM elements
const domElements = getDomElements();

await setDomElementValuesFromConfig(domElements, configSync);

await setDomElemenEventListeners(domElements, configSync);
