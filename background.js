// SwarmLink Background Service Worker
// Handles badge updates and storage listeners

// Update badge count when swarms change
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.mySwarms) {
    const swarms = changes.mySwarms.newValue || [];
    updateBadge(swarms.length);
  }
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Only accept messages from our own extension
  if (sender.id !== chrome.runtime.id) return;

  // Proxy API fetches from content scripts (background uses extension origin for CORS)
  if (message.type === 'API_FETCH') {
    fetch(message.url, message.options)
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true; // Keep message channel open for async sendResponse
  }

  if (message.action === 'updateBadge') {
    updateBadge(message.count);
  }

  // Store scan results in activity feed (all risk levels)
  if (message.type === 'SCAN_RESULT') {
    chrome.storage.local.get(['activityFeed'], (result) => {
      const feed = result.activityFeed || { high: [], medium: [], low: [] };

      const entry = {
        id: Date.now(),
        tokenMint: message.tokenMint,
        tokenName: message.tokenName,
        overallRisk: message.overallRisk,
        riskScore: message.riskScore,
        message: message.message,
        swarmCode: message.swarmCode,
        swarmName: message.swarmName,
        memberCount: message.memberCount,
        timestamp: message.timestamp
      };

      const tier = message.riskTier || 'low';
      feed[tier] = feed[tier] || [];
      feed[tier].unshift(entry);

      // Keep last 20 per tier
      feed.high = (feed.high || []).slice(0, 20);
      feed.medium = (feed.medium || []).slice(0, 20);
      feed.low = (feed.low || []).slice(0, 20);

      chrome.storage.local.set({ activityFeed: feed });
    });
  }

  // Handle push alerts from content script (HIGH risk only)
  if (message.type === 'SWARM_ALERT') {
    console.log('SwarmLink BG: Alert received!', message);

    // Show browser notification with token name and risk level
    const tokenLabel = message.tokenName || message.tokenMint?.slice(0, 8) + '...';
    const riskLevel = message.overallRisk || 'UNKNOWN';

    const notificationTitle = message.alertType === 'rug'
      ? `${tokenLabel} - HIGH RISK`
      : message.alertType === 'pump'
      ? `${tokenLabel} - Pump Warning`
      : message.alertType === 'fomo'
      ? `${tokenLabel} - FOMO Spike`
      : `${tokenLabel} - ${riskLevel} RISK`;

    const notifId = `swarm-${Date.now()}`;
    console.log('SwarmLink BG: Creating notification', notifId, notificationTitle);

    chrome.notifications.create(notifId, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title: notificationTitle,
      message: `Risk: ${message.riskScore || 0}% | ${message.swarmName || message.swarmCode}`,
      priority: 2
    }, (createdId) => {
      if (chrome.runtime.lastError) {
        console.error('SwarmLink BG: Notification error:', chrome.runtime.lastError);
      } else {
        console.log('SwarmLink BG: Notification created!', createdId);
      }
    });

    // Store notification -> token mapping for click handler
    chrome.storage.local.get(['notifMap'], (r) => {
      const map = r.notifMap || {};
      map[notifId] = message.tokenMint;
      chrome.storage.local.set({ notifMap: map });
    });

    // Store in alert history
    chrome.storage.local.get(['alertHistory'], (result) => {
      const history = result.alertHistory || [];
      history.unshift({
        id: Date.now(),
        type: message.alertType,
        message: message.message,
        tokenMint: message.tokenMint,
        swarmCode: message.swarmCode,
        swarmName: message.swarmName,
        riskScore: message.riskScore,
        timestamp: Date.now()
      });
      // Keep last 50 alerts
      chrome.storage.local.set({ alertHistory: history.slice(0, 50) });
    });
  }
});

// Update badge text
function updateBadge(count) {
  if (count > 0) {
    chrome.action.setBadgeText({ text: count.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#00d4ff' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Open pump.fun when notification is clicked (ready to trade)
chrome.notifications.onClicked.addListener((notifId) => {
  chrome.storage.local.get(['notifMap'], (result) => {
    const map = result.notifMap || {};
    const tokenMint = map[notifId];
    if (tokenMint) {
      chrome.tabs.create({ url: `https://pump.fun/coin/${tokenMint}` });
      delete map[notifId];
      chrome.storage.local.set({ notifMap: map });
    }
  });
});

// Initialize badge on install
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(['mySwarms']);
  const swarms = result.mySwarms || [];
  updateBadge(swarms.length);
});

// Initialize badge on startup
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get(['mySwarms']);
  const swarms = result.mySwarms || [];
  updateBadge(swarms.length);
});
