// Background service worker for SwarmLink extension
console.log('SwarmLink background script loaded');

let isActive = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  if (message.type === 'TOGGLE_ACTIVE') {
    isActive = message.isActive;
    console.log('Active state changed:', isActive);

    if (isActive) {
      startSwarmLink();
    } else {
      stopSwarmLink();
    }
  }

  sendResponse({ success: true });
  return true;
});

function startSwarmLink() {
  console.log('🐝 SwarmLink activated');
  // TODO: Initialize P2P connections
  // TODO: Start federated learning
}

function stopSwarmLink() {
  console.log('🐝 SwarmLink paused');
  // TODO: Disconnect P2P
  // TODO: Stop training
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  console.log('SwarmLink extension installed');
  chrome.storage.local.set({
    isActive: false,
    myHives: [],
  });
});
