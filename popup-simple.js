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

// Cached set of watched token mints — loaded once on popup open
let _watchedMints = new Set();

function renderFeedItem(entry) {
  const tier = entry.riskScore > 50 ? 'high' : entry.riskScore >= 35 ? 'medium' : 'low';
  const isWatched = _watchedMints.has(entry.tokenMint);
  const div = document.createElement('div');
  div.className = 'feed-item';
  div.innerHTML = `
    <button class="feed-watch-btn ${isWatched ? 'watched' : ''}" title="${isWatched ? 'Watching' : 'Watch this token'}">${isWatched ? '\u2713' : '+'}</button>
    <div class="feed-item-risk ${escapeHtml(tier)}">${escapeHtml(String(entry.riskScore))}%</div>
    <div class="feed-item-info">
      <div class="feed-item-name">${escapeHtml(entry.tokenName || entry.tokenMint?.slice(0, 8) + '...')}</div>
      <div class="feed-item-detail">${escapeHtml(entry.swarmName || entry.swarmCode || '')}</div>
    </div>
    <div class="feed-item-time">${escapeHtml(timeAgo(entry.timestamp))}</div>
  `;

  // Click row to open on DexScreener
  div.querySelector('.feed-item-info').addEventListener('click', () => {
    if (entry.tokenMint) {
      chrome.tabs.create({ url: `https://dexscreener.com/solana/${entry.tokenMint}` });
    }
  });
  div.querySelector('.feed-item-risk').addEventListener('click', () => {
    if (entry.tokenMint) {
      chrome.tabs.create({ url: `https://dexscreener.com/solana/${entry.tokenMint}` });
    }
  });
  div.querySelector('.feed-item-time').addEventListener('click', () => {
    if (entry.tokenMint) {
      chrome.tabs.create({ url: `https://dexscreener.com/solana/${entry.tokenMint}` });
    }
  });

  // Watch/unwatch button
  const watchBtn = div.querySelector('.feed-watch-btn');
  if (isWatched) watchBtn.disabled = false;
  watchBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    watchBtn.disabled = true;
    watchBtn.textContent = '...';

    const currentlyWatched = _watchedMints.has(entry.tokenMint);
    const action = currentlyWatched ? 'unwatch' : 'watch';

    try {
      const storage = await new Promise(r => chrome.storage.local.get(['wallet'], r));
      if (!storage.wallet) {
        watchBtn.textContent = currentlyWatched ? '\u2713' : '+';
        watchBtn.disabled = false;
        return;
      }

      const data = await apiFetchFromPopup(`${API_BASE}/ext-watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          wallet: storage.wallet,
          tokenCA: entry.tokenMint,
          tokenName: entry.tokenName || null,
          tokenSymbol: null,
        }),
      });

      if (data.success || data.message === 'Already watching') {
        if (action === 'watch') {
          _watchedMints.add(entry.tokenMint);
          watchBtn.textContent = '\u2713';
          watchBtn.classList.add('watched');
          watchBtn.title = 'Watching';
        } else {
          _watchedMints.delete(entry.tokenMint);
          watchBtn.textContent = '+';
          watchBtn.classList.remove('watched');
          watchBtn.title = 'Watch this token';
        }
        watchBtn.disabled = false;
      } else {
        watchBtn.textContent = currentlyWatched ? '\u2713' : '+';
        watchBtn.disabled = false;
        watchBtn.title = data.error || 'Could not update';
      }
    } catch (err) {
      watchBtn.textContent = currentlyWatched ? '\u2713' : '+';
      watchBtn.disabled = false;
      watchBtn.title = err.message || 'Watch failed';
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
  chrome.storage.local.get(['activityFeed', 'guardianAlerts', 'wallet'], async (result) => {
    const feed = result.activityFeed || { high: [], medium: [], low: [] };

    // Load watchlist so feed items show correct checkmarks
    if (result.wallet) {
      try {
        const resp = await apiFetchFromPopup(
          `${API_BASE}/ext-watchlist?wallet=${encodeURIComponent(result.wallet)}`,
          { method: 'GET' }
        );
        if (resp.success && resp.tokens) {
          _watchedMints = new Set(resp.tokens.map(t => t.tokenCA));
        }
      } catch {}
    }

    renderTier('high', feed.high || []);
    renderTier('medium', feed.medium || []);
    renderTier('low', feed.low || []);
    renderFeedAlerts(result.guardianAlerts || []);
  });
}

function renderFeedAlerts(alerts) {
  const section = document.getElementById('feed-alerts');
  const container = document.getElementById('feed-alerts-items');
  const countEl = document.getElementById('alerts-count');

  // Filter to last 24 hours
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const recent = (alerts || []).filter(a => now - a.timestamp < DAY);

  if (recent.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  countEl.textContent = recent.length;

  const typeEmojis = {
    price_crash: '\ud83d\udcc9',
    whale_entry: '\ud83d\udc0b',
    whale_dump: '\ud83d\udd34',
    rug_alert: '\ud83d\udea8',
    cluster_high: '\ud83d\udd78\ufe0f',
    cluster_medium: '\ud83d\udfe1',
    swarm_attention: '\ud83d\udd25',
  };

  // Group by token
  const groups = new Map();
  for (const a of recent) {
    if (!groups.has(a.tokenCA)) groups.set(a.tokenCA, []);
    groups.get(a.tokenCA).push(a);
  }

  container.innerHTML = '';
  for (const [tokenCA, tokenAlerts] of groups) {
    const latest = tokenAlerts[0];
    const emoji = typeEmojis[latest.type] || '\u26a0\ufe0f';
    const tokenLabel = latest.tokenSymbol || latest.tokenName || tokenCA?.slice(0, 8) + '...';
    const hasMultiple = tokenAlerts.length > 1;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'feed-alert-group';

    const headerDiv = document.createElement('div');
    const isBullish = latest.type === 'whale_entry';
    const isDanger = ['whale_dump', 'price_crash', 'rug_alert', 'cluster_high'].includes(latest.type);
    const isAttention = latest.type === 'swarm_attention';
    headerDiv.className = `feed-alert-item ${hasMultiple ? 'feed-alert-item--grouped' : ''} ${isBullish ? 'feed-alert-item--bullish' : ''} ${isDanger ? 'feed-alert-item--danger' : ''} ${isAttention ? 'feed-alert-item--attention' : ''}`;
    headerDiv.innerHTML = `
      <span class="feed-alert-emoji">${emoji}</span>
      <div class="feed-alert-info">
        <span class="feed-alert-token">${escapeHtml(tokenLabel)}${hasMultiple ? `<span class="feed-alert-badge">${tokenAlerts.length}</span>` : ''}</span>
        <span class="feed-alert-msg">${escapeHtml(latest.message || '')}</span>
      </div>
      <span class="feed-item-time">${escapeHtml(timeAgo(latest.timestamp))}${hasMultiple ? ' <span class="feed-alert-chevron">\u25bc</span>' : ''}</span>
    `;

    if (hasMultiple) {
      let expanded = false;
      const subContainer = document.createElement('div');
      subContainer.className = 'feed-alert-sub';
      subContainer.style.display = 'none';

      for (const a of tokenAlerts.slice(1)) {
        const sub = document.createElement('div');
        sub.className = `feed-alert-item feed-alert-item--sub ${a.type === 'whale_entry' ? 'feed-alert-item--bullish' : ''} ${['whale_dump', 'price_crash', 'rug_alert', 'cluster_high'].includes(a.type) ? 'feed-alert-item--danger' : ''} ${a.type === 'swarm_attention' ? 'feed-alert-item--attention' : ''}`;
        sub.innerHTML = `
          <span class="feed-alert-emoji">${typeEmojis[a.type] || '\u26a0\ufe0f'}</span>
          <div class="feed-alert-info">
            <span class="feed-alert-msg">${escapeHtml(a.message || '')}</span>
          </div>
          <span class="feed-item-time">${escapeHtml(timeAgo(a.timestamp))}</span>
        `;
        sub.addEventListener('click', () => {
          chrome.tabs.create({ url: a.url || `https://dexscreener.com/solana/${tokenCA}` });
        });
        subContainer.appendChild(sub);
      }

      headerDiv.addEventListener('click', () => {
        expanded = !expanded;
        subContainer.style.display = expanded ? '' : 'none';
        const chevron = headerDiv.querySelector('.feed-alert-chevron');
        if (chevron) chevron.style.transform = expanded ? 'rotate(180deg)' : '';
      });
      groupDiv.appendChild(headerDiv);
      groupDiv.appendChild(subContainer);
    } else {
      headerDiv.addEventListener('click', () => {
        chrome.tabs.create({ url: latest.url || `https://dexscreener.com/solana/${tokenCA}` });
      });
      groupDiv.appendChild(headerDiv);
    }

    container.appendChild(groupDiv);
  }
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
  if (area === 'local' && changes.guardianAlerts) {
    renderFeedAlerts(changes.guardianAlerts.newValue || []);
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

// ─── Helper: API fetch from popup via background (with timeout) ───

function apiFetchFromPopup(url, options, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Request timed out')), timeoutMs);
    chrome.runtime.sendMessage({
      type: 'API_FETCH', url, options
    }, (response) => {
      clearTimeout(timer);
      if (chrome.runtime.lastError) {
        return reject(new Error(chrome.runtime.lastError.message));
      }
      if (response && response.success) resolve(response.data);
      else reject(new Error(response?.error || 'API request failed'));
    });
  });
}

// ─── Guardian ───

function loadGuardian() {
  chrome.storage.local.get(['wallet', 'guardianAlerts', 'guardianEnabled'], (result) => {
    const authGate = document.getElementById('guardian-auth-gate');
    const content = document.getElementById('guardian-content');

    if (!result.wallet) {
      authGate.style.display = '';
      content.style.display = 'none';
      return;
    }

    authGate.style.display = 'none';
    content.style.display = '';

    // Guardian toggle
    const toggle = document.getElementById('guardianToggle');
    toggle.checked = result.guardianEnabled !== false;
    toggle.onchange = () => {
      chrome.storage.local.set({ guardianEnabled: toggle.checked });
    };

    // Load watchlist from API
    loadGuardianWatchlist(result.wallet);

    // Load cached alerts
    renderGuardianAlerts(result.guardianAlerts || []);

    // Mark alerts as seen: reset unread count and badge
    chrome.storage.local.set({ guardianUnread: 0 });
    chrome.storage.local.get(['mySwarms'], (r) => {
      const count = (r.mySwarms || []).length;
      chrome.runtime.sendMessage({ action: 'updateBadge', count });
    });
  });
}

async function loadGuardianWatchlist(wallet) {
  const container = document.getElementById('guardian-watchlist');
  const countEl = document.getElementById('guardian-watchlist-count');

  try {
    const resp = await apiFetchFromPopup(
      `${API_BASE}/ext-watchlist?wallet=${encodeURIComponent(wallet)}`,
      { method: 'GET' }
    );

    if (!resp.success) {
      container.innerHTML = `<div class="guardian-empty">${escapeHtml(resp.error || 'Could not load watchlist')}</div>`;
      return;
    }

    countEl.textContent = `${resp.count} / ${resp.limit}`;

    if (resp.tokens.length === 0) {
      container.innerHTML = '<div class="guardian-empty">No tokens watched yet. Visit a token page to add one.</div>';
      return;
    }

    container.innerHTML = '';
    for (const token of resp.tokens) {
      const div = document.createElement('div');
      div.className = 'guardian-token';
      const label = token.symbol || token.name || token.tokenCA.slice(0, 8) + '...';
      const shortCA = token.tokenCA.slice(0, 6) + '...' + token.tokenCA.slice(-4);
      div.innerHTML = `
        <span class="guardian-token-name">${escapeHtml(label)}</span>
        <span class="guardian-token-ca">${escapeHtml(shortCA)}</span>
        <button class="guardian-token-remove" title="Remove">&times;</button>
      `;

      div.querySelector('.guardian-token-remove').addEventListener('click', async (e) => {
        e.stopPropagation();
        const removeBtn = e.target;
        removeBtn.disabled = true;
        removeBtn.textContent = '...';
        try {
          const result = await apiFetchFromPopup(`${API_BASE}/ext-watchlist`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'unwatch', wallet, tokenCA: token.tokenCA })
          });
          if (result && result.success !== false) {
            div.remove();
            const remaining = container.querySelectorAll('.guardian-token').length;
            countEl.textContent = `${remaining} / ${resp.limit}`;
            if (remaining === 0) {
              container.innerHTML = '<div class="guardian-empty">No tokens watched yet. Visit a token page to add one.</div>';
            }
          } else {
            removeBtn.textContent = '\u00d7';
            removeBtn.disabled = false;
          }
        } catch (err) {
          console.error('Unwatch error:', err);
          removeBtn.textContent = '\u00d7';
          removeBtn.disabled = false;
        }
      });

      div.addEventListener('click', () => {
        chrome.tabs.create({ url: `https://dexscreener.com/solana/${token.tokenCA}` });
      });

      container.appendChild(div);
    }
  } catch (err) {
    container.innerHTML = '<div class="guardian-empty">Could not load watchlist</div>';
    console.error('Guardian watchlist error:', err);
  }
}

function renderGuardianAlerts(alerts) {
  const container = document.getElementById('guardian-alerts');

  if (!alerts || alerts.length === 0) {
    container.innerHTML = '<div class="guardian-empty">No alerts yet. Watch tokens to receive alerts.</div>';
    return;
  }

  const typeEmojis = {
    price_crash: '📉',
    whale_entry: '🐋',
    whale_dump: '🔴',
    rug_alert: '🚨',
    cluster_high: '🕸️',
    cluster_medium: '🟡',
    swarm_attention: '🔥',
  };

  container.innerHTML = '';
  for (const alert of alerts.slice(0, 20)) {
    const div = document.createElement('div');
    div.className = 'guardian-alert-item';
    const emoji = typeEmojis[alert.type] || '⚠️';
    const tokenLabel = alert.tokenSymbol || alert.tokenCA?.slice(0, 8) + '...';
    div.innerHTML = `
      <span class="guardian-alert-type">${emoji}</span>
      <div class="guardian-alert-info">
        <div class="guardian-alert-token">${escapeHtml(tokenLabel)}</div>
        <div class="guardian-alert-msg">${escapeHtml(alert.message || '')}</div>
      </div>
      <span class="guardian-alert-time">${escapeHtml(timeAgo(alert.timestamp))}</span>
    `;
    div.addEventListener('click', () => {
      const url = alert.url || `https://dexscreener.com/solana/${alert.tokenCA}`;
      chrome.tabs.create({ url });
    });
    container.appendChild(div);
  }
}

// Listen for guardian alert updates
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.guardianAlerts) {
    renderGuardianAlerts(changes.guardianAlerts.newValue || []);
  }
});

// ─── Initialize ───

loadActivityFeed();
loadSwarms();
loadGuardian();
