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
  // Only allow requests to our own API to prevent abuse if a matched site is compromised
  if (message.type === 'API_FETCH') {
    if (!message.url || !message.url.startsWith('https://www.federatedalpha.com/api')) {
      sendResponse({ success: false, error: 'Blocked: URL not allowed' });
      return true;
    }
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

// Open URL when notification is clicked
// Guardian alerts store a full URL; swarm alerts store a tokenMint
chrome.notifications.onClicked.addListener((notifId) => {
  chrome.storage.local.get(['notifMap'], (result) => {
    const map = result.notifMap || {};
    const target = map[notifId];
    if (target) {
      const url = target.startsWith('http') ? target : `https://pump.fun/coin/${target}`;
      chrome.tabs.create({ url });
      delete map[notifId];
      chrome.storage.local.set({ notifMap: map });
    }
  });
});

// Initialize badge + guardian alarm on install
chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(['mySwarms']);
  const swarms = result.mySwarms || [];
  updateBadge(swarms.length);
  chrome.alarms.create('guardianPoll', { periodInMinutes: 1 });
});

// Initialize badge + guardian alarm on startup
chrome.runtime.onStartup.addListener(async () => {
  const result = await chrome.storage.local.get(['mySwarms']);
  const swarms = result.mySwarms || [];
  updateBadge(swarms.length);
  chrome.alarms.create('guardianPoll', { periodInMinutes: 1 });
});

// ─── Guardian Alert Polling ───

const GUARDIAN_API = 'https://www.federatedalpha.com/api';
let guardianPolling = false; // mutex to prevent concurrent polls

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'guardianPoll') {
    pollGuardianAlerts();
  }
});

async function pollGuardianAlerts() {
  if (guardianPolling) return;
  guardianPolling = true;

  try {
    const storage = await chrome.storage.local.get(['wallet', 'guardianCursor', 'guardianEnabled']);
    if (!storage.wallet) return;
    if (storage.guardianEnabled === false) return;

    const since = storage.guardianCursor || 0;
    const resp = await fetch(
      `${GUARDIAN_API}/ext-alerts?wallet=${encodeURIComponent(storage.wallet)}&since=${since}`
    );
    if (!resp.ok) return;

    let data;
    try { data = await resp.json(); } catch { return; }
    if (!data.success || !data.alerts || data.alerts.length === 0) return;

    // Show browser notification for each alert
    const notifEntries = {};
    for (const alert of data.alerts) {
      const tokenLabel = alert.tokenSymbol || alert.tokenCA?.slice(0, 8) + '...';

      const typeLabels = {
        price_crash: 'Price Crash',
        whale_entry: 'Whale Entry',
        whale_dump: 'Whale Dump',
        rug_alert: 'Rug Alert',
        cluster_high: 'Cluster (HIGH)',
        cluster_medium: 'Cluster (MED)',
      };
      const typeLabel = typeLabels[alert.type] || alert.type;

      const notifId = `guardian-${alert.id || Date.now()}`;

      chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title: `${tokenLabel} — ${typeLabel}`,
        message: alert.message || 'Guardian alert',
        priority: alert.severity === 'high' ? 2 : 1,
      });

      notifEntries[notifId] = alert.url || `https://dexscreener.com/solana/${alert.tokenCA}`;
    }

    // Batch storage updates: alerts + cursor + notifMap
    const existing = await chrome.storage.local.get(['guardianAlerts', 'notifMap', 'guardianUnread']);
    const mergedAlerts = [...data.alerts, ...(existing.guardianAlerts || [])].slice(0, 50);
    const mergedMap = { ...(existing.notifMap || {}), ...notifEntries };
    const unread = (existing.guardianUnread || 0) + data.alerts.length;

    const updates = {
      guardianAlerts: mergedAlerts,
      notifMap: mergedMap,
      guardianUnread: unread,
    };
    if (data.cursor) updates.guardianCursor = data.cursor;

    await chrome.storage.local.set(updates);

    // Show unread count on badge (red)
    if (unread > 0) {
      chrome.action.setBadgeText({ text: unread.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#ef4444' });
    }
  } catch (err) {
    console.error('Guardian poll error:', err.message);
  } finally {
    guardianPolling = false;
  }
}
