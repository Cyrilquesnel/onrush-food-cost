// Opening an extension-owned tab does not require the "tabs" permission.
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('index.html') }).catch(error => {
    // No recipe or supplier data is available to this worker.
    console.error('Impossible d’ouvrir le calculateur.', error.message);
  });
});
