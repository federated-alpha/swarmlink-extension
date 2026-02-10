/**
 * SwarmLink Content Script
 * Monitors token pages (DexScreener, pump.fun, Raydium, Jupiter, Birdeye,
 * GMGN, Photon, RugCheck, Solscan, LetsBONK, Believe, SolanaFM,
 * Solana Explorer, Phantom) and X for token mentions
 * Automatically scans tokens and shares signals with swarm
 */

const API_BASE = 'https://www.federatedalpha.com/api';

// Track scanned tokens to avoid duplicates
const scannedTokens = new Set();

// Proxy fetch through background script (avoids CORS issues in Firefox
// where content scripts send the page's origin, not the extension's)
async function apiFetch(url, options) {
  const response = await chrome.runtime.sendMessage({
    type: 'API_FETCH',
    url,
    options
  });
  if (!response || !response.success) {
    throw new Error(response?.error || 'API fetch failed');
  }
  return response.data;
}

console.log('SwarmLink: Content script loaded on', window.location.hostname);

// ─── Wallet Sync: Listen for wallet address from federatedalpha.com ───
// The website broadcasts the connected wallet so the extension can use it
// for authenticated API calls (swarm-signal requires wallet, not UUID)
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  if (event.origin !== 'https://federatedalpha.com' &&
      event.origin !== 'https://www.federatedalpha.com' &&
      !event.origin.startsWith('http://localhost')) return;
  if (event.data?.type === 'SWARMLINK_WALLET' && event.data.wallet) {
    // Validate wallet format before storing
    const w = event.data.wallet;
    if (typeof w !== 'string' || w.length < 32 || w.length > 44) return;
    chrome.storage.local.set({ wallet: w });
    console.log('SwarmLink: Wallet synced from website:', w.slice(0, 8) + '...');
  }
  if (event.data?.type === 'SWARMLINK_ACTIVE_SWARM' && event.data.swarmCode) {
    const code = event.data.swarmCode;
    if (typeof code !== 'string' || !/^SWARM-[A-Z0-9]{12}$/.test(code)) return;
    chrome.storage.local.set({ activeSwarm: code });
    console.log('SwarmLink: Active swarm set from website:', code);
  }
});

// Extract token mint from URL (initial fast check)
function extractTokenFromURL() {
  const url = window.location.href;

  // Pump.fun: https://pump.fun/coin/ABC123... (always a token mint)
  const pumpMatch = url.match(/pump\.fun\/coin\/([A-Za-z0-9]{32,44})/);
  if (pumpMatch) return pumpMatch[1];

  // DexScreener: URL may contain pair address OR token mint
  // We'll extract it from URL first, then verify via DOM
  const dexMatch = url.match(/dexscreener\.com\/solana\/([A-Za-z0-9]{32,44})/);
  if (dexMatch) return dexMatch[1]; // May be pair address - will be resolved in initScanner

  // Raydium: ?outputCurrency=ABC123...
  const raydiumMatch = url.match(/[?&]outputCurrency=([A-Za-z0-9]{32,44})/);
  if (raydiumMatch) return raydiumMatch[1];

  // Jupiter: /swap/SOL-ABC123... or /swap/So11...ABC123
  const jupiterMatch = url.match(/\/swap\/[A-Za-z0-9]+-([A-Za-z0-9]{32,44})/);
  if (jupiterMatch) return jupiterMatch[1];

  // Birdeye: /token/ABC123... or /solana/token/ABC123...
  const birdeyeMatch = url.match(/birdeye\.so\/(?:solana\/)?token\/([A-Za-z0-9]{32,44})/);
  if (birdeyeMatch) return birdeyeMatch[1];

  // GMGN: /sol/token/ABC123...
  const gmgnMatch = url.match(/gmgn\.ai\/sol\/token\/([A-Za-z0-9]{32,44})/);
  if (gmgnMatch) return gmgnMatch[1];

  // Photon: /en/lp/ABC123... (language prefix varies)
  const photonMatch = url.match(/photon-sol\.tinyastro\.io\/\w+\/lp\/([A-Za-z0-9]{32,44})/);
  if (photonMatch) return photonMatch[1];

  // RugCheck: /tokens/ABC123...
  const rugcheckMatch = url.match(/rugcheck\.xyz\/tokens\/([A-Za-z0-9]{32,44})/);
  if (rugcheckMatch) return rugcheckMatch[1];

  // Solscan: /token/ABC123...
  const solscanMatch = url.match(/solscan\.io\/token\/([A-Za-z0-9]{32,44})/);
  if (solscanMatch) return solscanMatch[1];

  // LetsBONK: /coin/ABC123...
  const letsbonkMatch = url.match(/letsbonk\.fun\/coin\/([A-Za-z0-9]{32,44})/);
  if (letsbonkMatch) return letsbonkMatch[1];

  // Believe: /coin/ABC123...
  const believeMatch = url.match(/believe\.app\/coin\/([A-Za-z0-9]{32,44})/);
  if (believeMatch) return believeMatch[1];

  // Raydium LaunchLab: /launchpad/token/ABC123...
  const raydiumLabMatch = url.match(/raydium\.io\/launchpad\/token\/([A-Za-z0-9]{32,44})/);
  if (raydiumLabMatch) return raydiumLabMatch[1];

  // SolanaFM: /address/ABC123...
  const solanafmMatch = url.match(/solana\.fm\/address\/([A-Za-z0-9]{32,44})/);
  if (solanafmMatch) return solanafmMatch[1];

  // Solana Explorer: /address/ABC123...
  const explorerMatch = url.match(/explorer\.solana\.com\/address\/([A-Za-z0-9]{32,44})/);
  if (explorerMatch) return explorerMatch[1];

  // Phantom: /tokens/solana/ABC123...
  const phantomMatch = url.match(/phantom\.com\/tokens\/solana\/([A-Za-z0-9]{32,44})/);
  if (phantomMatch) return phantomMatch[1];

  return null;
}

// DexScreener: try to get the real token mint from the page DOM
// DexScreener URLs often use pair addresses, not token mints
function extractTokenFromDexScreenerDOM() {
  // Method 1: Look for the token contract address link
  // DexScreener shows "Contract: <address>" with a copy button
  const links = document.querySelectorAll('a[href*="solscan.io/token/"]');
  for (const link of links) {
    const match = link.href.match(/solscan\.io\/token\/([A-Za-z0-9]{32,44})/);
    if (match) {
      console.log('SwarmLink: Found token mint from Solscan link:', match[1].slice(0, 8) + '...');
      return match[1];
    }
  }

  // Method 2: Look for explorer links to the token
  const explorerLinks = document.querySelectorAll('a[href*="explorer.solana.com/address/"]');
  for (const link of explorerLinks) {
    const match = link.href.match(/explorer\.solana\.com\/address\/([A-Za-z0-9]{32,44})/);
    if (match) {
      console.log('SwarmLink: Found token mint from Explorer link:', match[1].slice(0, 8) + '...');
      return match[1];
    }
  }

  // Method 3: Look for copy-able address elements with Solana address pattern
  const allText = document.querySelectorAll('[class*="token"] a, [class*="pair-info"] a');
  for (const el of allText) {
    const text = el.textContent?.trim();
    if (text && /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) {
      console.log('SwarmLink: Found token address from DOM text:', text.slice(0, 8) + '...');
      return text;
    }
  }

  return null;
}

// Extract token name from page (works across all supported sites)
function extractTokenName() {
  const hostname = window.location.hostname;
  const title = document.title || '';

  // DexScreener: "BONK / SOL | DEX Screener" or "$BONK (BONK) | DEX Screener"
  if (hostname.includes('dexscreener.com')) {
    const match = title.match(/^(.+?)\s*[/|]/);
    if (match) return match[1].trim();
  }

  // Pump.fun: token name is in the h1 or title
  if (hostname.includes('pump.fun')) {
    const h1 = document.querySelector('h1');
    if (h1) return h1.textContent.trim();
    const match = title.match(/^(.+?)\s*[-|]/);
    if (match) return match[1].trim();
  }

  // Birdeye: "BONK Price | Birdeye"
  if (hostname.includes('birdeye.so')) {
    const match = title.match(/^(.+?)\s*Price/i);
    if (match) return match[1].trim();
  }

  // GMGN: "BONK (BONK) - GMGN" or similar
  if (hostname.includes('gmgn.ai')) {
    const match = title.match(/^(.+?)\s*[-|]/);
    if (match) return match[1].trim();
  }

  // Photon: token name in title before separator
  if (hostname.includes('photon-sol.tinyastro.io')) {
    const match = title.match(/^(.+?)\s*[-|]/);
    if (match) return match[1].trim();
  }

  // RugCheck: "Token Name - RugCheck"
  if (hostname.includes('rugcheck.xyz')) {
    const match = title.match(/^(.+?)\s*[-|]/);
    if (match) return match[1].trim();
  }

  // Solscan: "Token Name | Solscan"
  if (hostname.includes('solscan.io')) {
    const match = title.match(/^(.+?)\s*[-|]/);
    if (match) return match[1].trim();
  }

  // Jupiter/Raydium: try title
  const match = title.match(/^(.+?)\s*[-|]/);
  if (match) return match[1].trim();

  return null;
}

// Extract Solana addresses from tweet text (for X/Twitter)
function extractSolanaAddresses(text) {
  if (!text) return [];

  // Match Solana addresses (base58, 32-44 chars)
  const addressRegex = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
  const matches = text.match(addressRegex) || [];

  return matches.filter(addr => {
    // Validate base58 alphabet (no 0, O, I, l)
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr);
  });
}

// Get user data from storage
async function getUserData() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userId'], (syncResult) => {
      chrome.storage.local.get(['mySwarms', 'wallet', 'activeSwarm'], (localResult) => {
        console.log('SwarmLink: Storage check:', {
          userId: syncResult.userId,
          wallet: localResult.wallet,
          swarms: localResult.mySwarms,
          activeSwarm: localResult.activeSwarm
        });

        // Filter to active swarm only (if set)
        let swarms = localResult.mySwarms || [];
        if (localResult.activeSwarm && swarms.length > 0) {
          const active = swarms.find(s => s.code === localResult.activeSwarm);
          if (active) swarms = [active];
        }

        resolve({
          userId: syncResult.userId,
          wallet: localResult.wallet,
          swarms
        });
      });
    });
  });
}

// Show a one-time toast notification on the page (one per message type)
const notificationsShown = new Set();
function showSwarmLinkNotification(message) {
  if (notificationsShown.has(message)) return;
  notificationsShown.add(message);
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = 'position:fixed;top:16px;right:16px;z-index:999999;background:#1e293b;color:#e2e8f0;padding:12px 20px;border-radius:8px;font-size:14px;font-family:system-ui,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:1px solid #334155;max-width:360px;line-height:1.4;';
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 8000);
}

// Auto-fetch swarms from API when we have a wallet but no swarms cached
async function autoSyncSwarms(wallet) {
  try {
    console.log('SwarmLink: Auto-syncing swarms for wallet', wallet.slice(0, 8) + '...');
    const data = await apiFetch(`${API_BASE}/my-swarms?wallet=${wallet}`, { method: 'GET' });
    if (data.success && data.swarms && data.swarms.length > 0) {
      await new Promise(resolve => chrome.storage.local.set({ mySwarms: data.swarms }, resolve));
      console.log('SwarmLink: Auto-synced', data.swarms.length, 'swarms');
      return data.swarms;
    }
  } catch (e) {
    console.warn('SwarmLink: Auto-sync failed:', e.message);
  }
  return [];
}

// Scan token and share with swarm
async function scanAndShareToken(tokenMint) {
  // Avoid duplicate scans
  if (scannedTokens.has(tokenMint)) {
    console.log('SwarmLink: Already scanned', tokenMint.slice(0, 8) + '...');
    return;
  }

  scannedTokens.add(tokenMint);
  console.log('SwarmLink: Scanning token', tokenMint.slice(0, 8) + '...');

  let { userId, wallet, swarms } = await getUserData();

  // If we have a wallet but no swarms, try auto-syncing from API
  if (wallet && swarms.length === 0) {
    swarms = await autoSyncSwarms(wallet);
  }

  // Need either wallet or userId, and at least one swarm
  if (!wallet && !userId) {
    showSwarmLinkNotification('SwarmLink: Connect wallet at federatedalpha.com/swarms to start scanning');
    console.log('SwarmLink: No wallet synced yet — visit federatedalpha.com/swarms with wallet connected');
    return;
  }
  if (swarms.length === 0) {
    showSwarmLinkNotification('SwarmLink: Join a swarm at federatedalpha.com/swarms to share signals');
    console.log('SwarmLink: No swarms found, skipping scan');
    return;
  }

  try {
    // Call scan-token API (via background script to avoid CORS issues)
    const scanData = await apiFetch(`${API_BASE}/scan-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: tokenMint, userId: wallet || userId })
    });

    if (!scanData.success) {
      console.log('SwarmLink: Scan returned no data');
      return;
    }

    // Get token name from API response or page DOM
    const tokenName = scanData.result.tokenSymbol || scanData.result.tokenName || extractTokenName() || tokenMint.slice(0, 8) + '...';

    console.log('SwarmLink: Scan result', {
      token: tokenName,
      riskScore: scanData.result.riskScore,
      risk: scanData.result.overallRisk
    });

    // Share with all swarms
    for (const swarm of swarms) {
      try {
        const signalData = await apiFetch(`${API_BASE}/swarm-signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: wallet || userId,
            swarmCode: swarm.code,
            tokenMint,
            tokenName: scanData.result.tokenName || extractTokenName() || null,
            tokenSymbol: scanData.result.tokenSymbol || null,
            tokenImage: scanData.result.tokenImage || null,
            signal: {
              type: 'rug_detection',
              riskScore: scanData.result.riskScore,
              signals: scanData.result.signals
            },
            timestamp: Date.now()
          })
        });
        if (!signalData.success && signalData.error) {
          console.warn('SwarmLink: Signal rejected:', signalData.error, signalData.tier || '');
          continue;
        }

        const consensus = signalData.swarmConsensus;

        if (consensus) {
          console.log('SwarmLink: Signal result', {
            riskTier: consensus.riskTier,
            pushAlert: consensus.alertTriggered,
            members: consensus.memberCount
          });

          // Always store in activity feed (all risk levels)
          chrome.runtime.sendMessage({
            type: 'SCAN_RESULT',
            tokenMint,
            tokenName,
            overallRisk: scanData.result.overallRisk,
            riskTier: consensus.riskTier,
            riskScore: consensus.avgRiskScore,
            message: consensus.message,
            swarmCode: swarm.code,
            swarmName: swarm.name,
            memberCount: consensus.memberCount,
            timestamp: Date.now()
          });

          // Push notification only when server says so (HIGH risk + threshold + cooldown)
          if (consensus.alertTriggered) {
            console.log('SwarmLink: Push alert!', consensus.message);
            chrome.runtime.sendMessage({
              type: 'SWARM_ALERT',
              alertType: consensus.alertType,
              message: consensus.message,
              tokenMint,
              tokenName,
              overallRisk: scanData.result.overallRisk,
              swarmCode: swarm.code,
              swarmName: swarm.name,
              riskScore: consensus.avgRiskScore
            });
          }
        } else {
          console.warn('SwarmLink: Signal sent but no consensus data', signalData);
        }
      } catch (error) {
        console.error('SwarmLink: Failed to share signal with swarm', swarm.code, error);
      }
    }

  } catch (error) {
    console.error('SwarmLink: Scan error', error);
  }
}

// Analyze X/Twitter sentiment
async function analyzeTweetSentiment() {
  // Find tweet text
  const tweetTextEl = document.querySelector('[data-testid="tweetText"]');
  if (!tweetTextEl) return;

  const tweetText = tweetTextEl.innerText;
  const tokenAddresses = extractSolanaAddresses(tweetText);

  if (tokenAddresses.length === 0) return;

  console.log('SwarmLink: Found Solana addresses in tweet:', tokenAddresses);

  let { userId, wallet, swarms } = await getUserData();

  // Auto-sync swarms if wallet exists but no swarms cached
  if (wallet && swarms.length === 0) {
    swarms = await autoSyncSwarms(wallet);
  }

  if (!wallet && !userId) {
    showSwarmLinkNotification('SwarmLink: Connect wallet at federatedalpha.com/swarms to start scanning');
    return;
  }
  if (swarms.length === 0) {
    showSwarmLinkNotification('SwarmLink: Join a swarm at federatedalpha.com/swarms to share signals');
    return;
  }

  try {
    // Analyze sentiment (via background script to avoid CORS issues)
    const sentimentData = await apiFetch(`${API_BASE}/analyze-sentiment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: tweetText, tokenMint: tokenAddresses[0] })
    });

    if (!sentimentData.success) return;

    console.log('SwarmLink: Sentiment analysis', {
      score: sentimentData.sentimentScore,
      signals: sentimentData.signals
    });

    // Share with swarms
    for (const swarm of swarms) {
      try {
        const signalData = await apiFetch(`${API_BASE}/swarm-signal`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wallet: wallet || userId,
            swarmCode: swarm.code,
            tokenMint: tokenAddresses[0],
            signal: {
              type: 'sentiment',
              sentimentScore: sentimentData.sentimentScore,
              signals: sentimentData.signals
            },
            timestamp: Date.now()
          })
        });

        if (signalData.swarmConsensus?.alertTriggered) {
          chrome.runtime.sendMessage({
            type: 'SWARM_ALERT',
            alertType: signalData.swarmConsensus.alertType,
            message: signalData.swarmConsensus.message,
            tokenMint: tokenAddresses[0],
            swarmCode: swarm.code,
            swarmName: swarm.name
          });
        }
      } catch (error) {
        console.error('SwarmLink: Failed to share sentiment signal', error);
      }
    }

  } catch (error) {
    console.error('SwarmLink: Sentiment analysis error', error);
  }
}

// Robust SPA navigation watcher — hooks pushState/replaceState + popstate + polling fallback
function watchNavigation(callback) {
  let lastUrl = window.location.href;

  const checkUrl = () => {
    const currentUrl = window.location.href;
    if (currentUrl !== lastUrl) {
      console.log('SwarmLink: Navigation detected', currentUrl.slice(0, 60) + '...');
      lastUrl = currentUrl;
      callback();
    }
  };

  // Hook history.pushState
  try {
    const origPushState = history.pushState;
    history.pushState = function() {
      origPushState.apply(this, arguments);
      setTimeout(checkUrl, 100);
    };
  } catch (e) { /* SES may block this */ }

  // Hook history.replaceState
  try {
    const origReplaceState = history.replaceState;
    history.replaceState = function() {
      origReplaceState.apply(this, arguments);
      setTimeout(checkUrl, 100);
    };
  } catch (e) { /* SES may block this */ }

  // Listen for back/forward
  window.addEventListener('popstate', () => setTimeout(checkUrl, 100));

  // Polling fallback in case hooks get blocked by SES
  setInterval(checkUrl, 1000);
}

// Main: Detect page type and scan
function initScanner() {
  const hostname = window.location.hostname;

  // DexScreener - needs special handling (URL contains pair address, not token mint)
  // Only use DOM extraction here — never fall back to URL which gives pair addresses
  if (hostname.includes('dexscreener.com')) {
    // Wait for page to render, then extract real token mint from DOM
    setTimeout(() => {
      const tokenMint = extractTokenFromDexScreenerDOM();

      if (tokenMint) {
        console.log('SwarmLink: Detected token', tokenMint.slice(0, 8) + '...');
        scanAndShareToken(tokenMint);
      } else {
        console.log('SwarmLink: Could not find token mint in DexScreener DOM (URL is likely a pair address)');
      }
    }, 3000); // Wait 3s for DexScreener SPA to fully render

    // Watch for URL changes (SPA navigation)
    watchNavigation(() => {
      scannedTokens.clear();
      setTimeout(() => {
        const newToken = extractTokenFromDexScreenerDOM();
        if (newToken && !scannedTokens.has(newToken)) {
          console.log('SwarmLink: SPA nav - new DexScreener token', newToken.slice(0, 8) + '...');
          scanAndShareToken(newToken);
        }
      }, 3000);
    });
  }

  // Pump.fun - URL IS the token mint
  else if (hostname.includes('pump.fun')) {
    const tokenMint = extractTokenFromURL();
    if (tokenMint) {
      console.log('SwarmLink: Detected pump.fun token', tokenMint.slice(0, 8) + '...');
      setTimeout(() => scanAndShareToken(tokenMint), 2000);
    }

    watchNavigation(() => {
      const newToken = extractTokenFromURL();
      if (newToken && !scannedTokens.has(newToken)) {
        console.log('SwarmLink: SPA nav - new pump.fun token', newToken.slice(0, 8) + '...');
        setTimeout(() => scanAndShareToken(newToken), 2000);
      }
    });
  }

  // GMGN - SPA, needs URL change watcher
  else if (hostname.includes('gmgn.ai')) {
    const tokenMint = extractTokenFromURL();
    if (tokenMint) {
      console.log('SwarmLink: Detected GMGN token', tokenMint.slice(0, 8) + '...');
      setTimeout(() => scanAndShareToken(tokenMint), 2000);
    }

    watchNavigation(() => {
      const newToken = extractTokenFromURL();
      if (newToken && !scannedTokens.has(newToken)) {
        setTimeout(() => scanAndShareToken(newToken), 2000);
      }
    });
  }

  // Photon - SPA, needs URL change watcher
  else if (hostname.includes('photon-sol.tinyastro.io')) {
    const tokenMint = extractTokenFromURL();
    if (tokenMint) {
      console.log('SwarmLink: Detected Photon token', tokenMint.slice(0, 8) + '...');
      setTimeout(() => scanAndShareToken(tokenMint), 2000);
    }

    watchNavigation(() => {
      const newToken = extractTokenFromURL();
      if (newToken && !scannedTokens.has(newToken)) {
        setTimeout(() => scanAndShareToken(newToken), 2000);
      }
    });
  }

  // Raydium, Jupiter, Birdeye, RugCheck, Solscan, LetsBONK, Believe,
  // SolanaFM, Solana Explorer, Phantom - URL has token mint
  else if (hostname.includes('raydium.io') ||
           hostname.includes('jup.ag') ||
           hostname.includes('birdeye.so') ||
           hostname.includes('rugcheck.xyz') ||
           hostname.includes('solscan.io') ||
           hostname.includes('letsbonk.fun') ||
           hostname.includes('believe.app') ||
           hostname.includes('solana.fm') ||
           hostname.includes('explorer.solana.com') ||
           hostname.includes('phantom.com')) {
    const tokenMint = extractTokenFromURL();
    if (tokenMint) {
      console.log('SwarmLink: Detected token', tokenMint.slice(0, 8) + '...');
      setTimeout(() => scanAndShareToken(tokenMint), 2000);
    }

    watchNavigation(() => {
      const newToken = extractTokenFromURL();
      if (newToken && !scannedTokens.has(newToken)) {
        setTimeout(() => scanAndShareToken(newToken), 2000);
      }
    });
  }

  // X/Twitter
  if (hostname === 'twitter.com' || hostname === 'x.com') {
    // Wait for tweet to load
    setTimeout(analyzeTweetSentiment, 3000);

    // Watch for new tweets (infinite scroll)
    const observer = new MutationObserver(() => {
      setTimeout(analyzeTweetSentiment, 1000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Initialize when page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScanner);
} else {
  initScanner();
}
