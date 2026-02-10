// SwarmLink Extension Popup
console.log('SwarmLink extension loaded!');

const API_BASE = 'https://www.federatedalpha.com/api';

// ─── Tab Navigation ───

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(v => {
      v.style.display = 'none';
      v.classList.remove('active');
    });

    tab.classList.add('active');
    const view = document.getElementById(tab.dataset.tab + '-view');
    view.style.display = '';
    view.classList.add('active');
  });
});

// ─── Theme Toggle ───

document.getElementById('themeToggle').addEventListener('click', () => {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  chrome.storage.sync.set({ theme: next });
});

chrome.storage.sync.get(['theme'], (r) => {
  if (r.theme) document.documentElement.setAttribute('data-theme', r.theme);
});

// ─── Activity Feed ───

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function renderFeedItem(entry) {
  const tier = entry.riskScore > 50 ? 'high' : entry.riskScore >= 35 ? 'medium' : 'low';
  const div = document.createElement('div');
  div.className = 'feed-item';
  div.title = `Click to view on DexScreener`;
  div.innerHTML = `
    <div class="feed-item-risk ${escapeHtml(tier)}">${escapeHtml(String(entry.riskScore))}%</div>
    <div class="feed-item-info">
      <div class="feed-item-name">${escapeHtml(entry.tokenName || entry.tokenMint?.slice(0, 8) + '...')}</div>
      <div class="feed-item-detail">${escapeHtml(entry.swarmName || entry.swarmCode || '')}</div>
    </div>
    <div class="feed-item-members">${escapeHtml(String(entry.memberCount || 1))} scanned</div>
    <div class="feed-item-time">${escapeHtml(timeAgo(entry.timestamp))}</div>
  `;
  div.addEventListener('click', () => {
    if (entry.tokenMint) {
      chrome.tabs.create({ url: `https://dexscreener.com/solana/${entry.tokenMint}` });
    }
  });
  return div;
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function loadActivityFeed() {
  chrome.storage.local.get(['activityFeed'], (result) => {
    const feed = result.activityFeed || { high: [], medium: [], low: [] };

    renderTier('high', feed.high || []);
    renderTier('medium', feed.medium || []);
    renderTier('low', feed.low || []);
  });
}

function renderTier(tier, items) {
  const container = document.getElementById(`${tier}-items`);
  const countEl = document.getElementById(`${tier}-count`);

  // Deduplicate by tokenMint (keep latest)
  const seen = new Map();
  for (const item of items) {
    const key = item.tokenMint;
    if (!key) continue;
    const existing = seen.get(key);
    if (!existing || item.timestamp > existing.timestamp) {
      seen.set(key, item);
    }
  }
  const deduped = Array.from(seen.values()).sort((a, b) => b.timestamp - a.timestamp);

  countEl.textContent = deduped.length;

  if (deduped.length === 0) {
    container.innerHTML = `<div class="feed-empty">No ${escapeHtml(tier)} risk tokens detected</div>`;
    return;
  }

  container.innerHTML = '';
  deduped.forEach(entry => {
    container.appendChild(renderFeedItem(entry));
  });
}

// Listen for live updates from background
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.activityFeed) {
    loadActivityFeed();
  }
  if (area === 'local' && changes.mySwarms) {
    displaySwarms(changes.mySwarms.newValue || []);
  }
});

// ─── Swarms ───

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function getUserId() {
  const stored = await new Promise((resolve) => {
    chrome.storage.sync.get(['userId'], (result) => resolve(result.userId));
  });

  if (stored) return stored;

  try {
    const response = await fetch(`${API_BASE}/sync-userid?action=get`);
    const data = await response.json();

    if (data.success && data.userId) {
      await new Promise((resolve) => {
        chrome.storage.sync.set({ userId: data.userId }, resolve);
      });
      return data.userId;
    }
  } catch (error) {
    console.error('Failed to sync userId:', error);
  }

  const newUserId = generateUUID();
  await new Promise((resolve) => {
    chrome.storage.sync.set({ userId: newUserId }, resolve);
  });
  return newUserId;
}

async function syncSwarmsFromAPI() {
  try {
    // Prefer wallet (Solana address) over UUID — wallet is synced from website
    const walletResult = await new Promise(r => chrome.storage.local.get(['wallet'], r));
    const wallet = walletResult.wallet;

    let userId = wallet || await getUserId();
    let response = await fetch(`${API_BASE}/my-swarms?wallet=${userId}`);
    let data = await response.json();

    // If wallet didn't find swarms, try UUID as fallback
    if ((!data.swarms || data.swarms.length === 0) && wallet) {
      const fallbackId = await getUserId();
      if (fallbackId !== wallet) {
        response = await fetch(`${API_BASE}/my-swarms?userId=${fallbackId}`);
        data = await response.json();
      }
    }

    if (data.swarms) {
      await new Promise(resolve => {
        chrome.storage.local.set({ mySwarms: data.swarms }, resolve);
      });
      return data.swarms;
    }
  } catch (error) {
    console.error('Failed to sync swarms:', error);
  }
  return null;
}

function displaySwarms(swarms) {
  const listEl = document.getElementById('swarms-list');
  updateActiveSwarmSelector(swarms);

  if (!swarms || swarms.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p>No swarms yet. Create one on the website!</p>
        <button class="btn btn-primary" onclick="chrome.tabs.create({url:'https://www.federatedalpha.com/swarms'})">
          Open SwarmLink
        </button>
      </div>
    `;
  } else {
    listEl.innerHTML = '';
    swarms.forEach(swarm => {
      const div = document.createElement('div');
      div.className = 'hive-card';
      div.innerHTML = `
        <div class="hive-header">
          <span class="hive-name">${escapeHtml(swarm.name)}</span>
        </div>
        <div class="hive-description">${escapeHtml(swarm.description || '')}</div>
        <div class="hive-footer">
          <span style="font-family:monospace;font-size:11px;color:var(--text-secondary)">${escapeHtml(swarm.code)}</span>
        </div>
      `;
      listEl.appendChild(div);
    });
  }
}

async function loadSwarms() {
  const apiSwarms = await syncSwarmsFromAPI();

  if (apiSwarms) {
    displaySwarms(apiSwarms);
  } else {
    chrome.storage.local.get(['mySwarms'], (result) => {
      displaySwarms(result.mySwarms || []);
    });
  }
}

// ─── Active Swarm Selector ───

function updateActiveSwarmSelector(swarms) {
  const bar = document.getElementById('activeSwarmBar');
  const select = document.getElementById('activeSwarmSelect');

  if (!swarms || swarms.length === 0) {
    bar.style.display = 'none';
    return;
  }

  bar.style.display = '';
  select.innerHTML = '';

  swarms.forEach(swarm => {
    const opt = document.createElement('option');
    opt.value = swarm.code;
    opt.textContent = escapeHtml(swarm.name);
    select.appendChild(opt);
  });

  // Restore saved selection
  chrome.storage.local.get(['activeSwarm'], (r) => {
    if (r.activeSwarm && swarms.some(s => s.code === r.activeSwarm)) {
      select.value = r.activeSwarm;
    } else {
      // Default to first swarm
      chrome.storage.local.set({ activeSwarm: swarms[0].code });
    }
  });

  select.addEventListener('change', () => {
    chrome.storage.local.set({ activeSwarm: select.value });
    console.log('SwarmLink: Active swarm set to', select.value);
  });
}

// ─── Initialize ───

loadActivityFeed();
loadSwarms();
