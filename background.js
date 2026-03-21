// background.js

// Listen for clicks on the extension icon
chrome.action.onClicked.addListener((tab) => {
  if (tab.url && !tab.url.startsWith("chrome://") && !tab.url.startsWith("edge://") && !tab.url.startsWith("about:")) {
    chrome.tabs.sendMessage(tab.id, { action: "toggle_panel" }).catch(err => {
      console.warn("Could not send toggle message. Page might not have content script injected yet:", err);
    });
  }
});

// Handle requests from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "get_tabs") {
    // Get all open tabs
    chrome.tabs.query({}, (tabs) => {
      sendResponse({ tabs });
    });
    return true; // Indicates asynchronous response
  }
  
  if (request.action === "switch_tab") {
    chrome.tabs.update(request.tabId, { active: true });
    // Also focus the window just in case
    chrome.windows.update(request.windowId, { focused: true });
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "close_tab") {
    chrome.tabs.remove(request.tabId, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.action === "search_query") {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(request.query)}`;
    chrome.tabs.create({ url: searchUrl });
    sendResponse({ success: true });
    return true;
  }
});
