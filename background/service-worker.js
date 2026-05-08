// Minimal service worker. The extension does not need persistent background work;
// the popup performs its own fetches. We keep the worker for installation hooks
// and to ensure the action icon stays enabled across all tabs.

chrome.runtime.onInstalled.addListener(() => {
  // Reserved for future first-run setup. No persistent state is created here.
});

// Allow the popup to query the active tab through the worker if it ever needs to.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "PING") {
    sendResponse({ ok: true, time: Date.now() });
    return true;
  }
  return false;
});


