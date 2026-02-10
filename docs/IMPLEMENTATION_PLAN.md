# SwarmLink MVP Implementation Plan - Dual-Stream Sentiment System

## What We're Building This Weekend

**Goal:** Swarm-based alerts combining technical rug detection + social sentiment

**Stack:**
- ✅ Vercel serverless functions (no containers!)
- ✅ Upstash Redis (existing setup)
- ✅ Helius RPC (existing setup)
- ✅ Chrome Extension Manifest v3
- ✅ Simple heuristic sentiment (no ML/TF.js for MVP)

---

## Files to Create

### 1. `/api/scan-token.js` - Server-Side Token Scanner

**Purpose:** Wrap CAScanner.jsx logic into API endpoint

**Reuses:**
- `api/lib/funding-chain.js` → cluster detection
- Helius RPC → holder data
- DexScreener API → market data

**Request:**
```json
POST /api/scan-token
{
  "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "userId": "uuid-here"
}
```

**Response:**
```json
{
  "success": true,
  "result": {
    "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    "riskScore": 85,
    "signals": {
      "cluster": "HIGH",
      "liquidityLocked": false,
      "mintAuthority": "revoked",
      "holderConcentration": 75,
      "suspiciousWallets": 5
    },
    "marketData": {
      "price": 0.0012,
      "liquidity": 45000,
      "volume24h": 125000
    }
  }
}
```

**Implementation Notes:**
- Extract token scanning logic from `src/CAScanner.jsx` (lines 224-400)
- Use same Helius RPC calls
- Call `detectClusters()` from funding-chain.js
- Cache results in Redis: `scan:${tokenMint}` (TTL: 5 min)

---

### 2. `/api/analyze-sentiment.js` - X Sentiment Analysis

**Purpose:** Analyze tweet text for FOMO/FUD/Pump signals

**Request:**
```json
POST /api/analyze-sentiment
{
  "text": "🚀 $BONK to the moon! 100x guaranteed! LFG! 🚀",
  "tokenMint": "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263"
}
```

**Response:**
```json
{
  "success": true,
  "sentimentScore": 92,
  "signals": {
    "fomo": true,
    "fud": false,
    "pump": true,
    "keywords": ["🚀", "moon", "100x", "LFG"]
  }
}
```

**Heuristic Algorithm:**
```javascript
const FOMO_KEYWORDS = ['moon', '100x', 'ape in', 'last chance', 'dont miss', '🚀', '💎'];
const FUD_KEYWORDS = ['scam', 'rug', 'dump', 'sell now', 'warning', '🚩'];
const PUMP_KEYWORDS = ['LFG', 'buy now', 'pump', 'explode', 'parabolic'];

function analyzeSentiment(text) {
  const lowerText = text.toLowerCase();

  const fomoCount = FOMO_KEYWORDS.filter(kw => lowerText.includes(kw.toLowerCase())).length;
  const fudCount = FUD_KEYWORDS.filter(kw => lowerText.includes(kw.toLowerCase())).length;
  const pumpCount = PUMP_KEYWORDS.filter(kw => lowerText.includes(kw.toLowerCase())).length;

  // Score: 0-100 based on keyword density
  const totalKeywords = fomoCount + fudCount + pumpCount;
  const sentimentScore = Math.min(100, (fomoCount + pumpCount) * 15 - fudCount * 10);

  return {
    sentimentScore: Math.max(0, sentimentScore),
    signals: {
      fomo: fomoCount >= 2,
      fud: fudCount >= 2,
      pump: pumpCount >= 1
    },
    keywords: [...FOMO_KEYWORDS, ...PUMP_KEYWORDS].filter(kw =>
      lowerText.includes(kw.toLowerCase())
    )
  };
}
```

---

### 3. `/api/swarm-signal.js` - Signal Aggregation

**Purpose:** Store signals from swarm members, check consensus, trigger alerts

**Request:**
```json
POST /api/swarm-signal
{
  "userId": "uuid-here",
  "swarmCode": "SWARM-ABC123",
  "tokenMint": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "signal": {
    "type": "rug_detection",
    "riskScore": 85,
    "sentimentScore": 92,
    "signals": {
      "cluster": "HIGH",
      "fomo": true
    }
  },
  "timestamp": 1707350400000
}
```

**Redis Storage:**
```javascript
// Key: swarm:{SWARM-CODE}:signals:{TOKEN-MINT}
// Value: Hash of member signals
await kv.hset(`swarm:${swarmCode}:signals:${tokenMint}`, userId, JSON.stringify({
  riskScore: signal.riskScore || 0,
  sentimentScore: signal.sentimentScore || 0,
  signals: signal.signals,
  timestamp: timestamp
}));

// TTL: 24 hours
await kv.expire(`swarm:${swarmCode}:signals:${tokenMint}`, 86400);
```

**Consensus Logic:**
```javascript
// Get all member signals
const signalsHash = await kv.hgetall(`swarm:${swarmCode}:signals:${tokenMint}`);
const signals = Object.values(signalsHash).map(s => JSON.parse(s));

const memberCount = signals.length;
const avgRiskScore = signals.reduce((sum, s) => sum + s.riskScore, 0) / memberCount;
const avgSentimentScore = signals.reduce((sum, s) => sum + s.sentimentScore, 0) / memberCount;

// Get swarm settings
const swarmData = await kv.hgetall(`swarm:${swarmCode}`);
const threshold = parseInt(swarmData.alertThreshold || '3');

// Alert rules
let alertTriggered = false;
let alertType = null;
let message = null;

if (memberCount >= threshold) {
  // Rule 1: High rug risk
  if (avgRiskScore >= 70) {
    alertTriggered = true;
    alertType = 'rug';
    message = `⚠️ Rug risk: ${memberCount} members flagged (${Math.round(avgRiskScore)}% risk)`;
  }

  // Rule 2: High hype + Medium risk = Pump warning
  else if (avgSentimentScore >= 80 && avgRiskScore >= 50) {
    alertTriggered = true;
    alertType = 'pump';
    message = `🚨 Pump warning: High hype (${Math.round(avgSentimentScore)}%) + Medium risk (${Math.round(avgRiskScore)}%)`;
  }

  // Rule 3: Extreme FOMO spike (low risk)
  else if (avgSentimentScore >= 90 && avgRiskScore < 40) {
    alertTriggered = true;
    alertType = 'fomo';
    message = `🔥 FOMO spike: ${memberCount} members see extreme hype`;
  }
}

return {
  success: true,
  swarmConsensus: {
    alertTriggered,
    alertType,
    memberCount,
    avgRiskScore: Math.round(avgRiskScore),
    avgSentimentScore: Math.round(avgSentimentScore),
    message
  }
};
```

**Response:**
```json
{
  "success": true,
  "swarmConsensus": {
    "alertTriggered": true,
    "alertType": "rug",
    "memberCount": 4,
    "avgRiskScore": 82,
    "avgSentimentScore": 65,
    "message": "⚠️ Rug risk: 4 members flagged (82% risk)"
  }
}
```

---

### 4. `apps/extension/content.js` - Content Script

**Purpose:** Monitor DexScreener/X pages, extract tokens, call scan APIs

**Manifest Permissions:**
```json
{
  "content_scripts": [{
    "matches": [
      "https://dexscreener.com/solana/*",
      "https://raydium.io/*",
      "https://jup.ag/*",
      "https://twitter.com/*/status/*",
      "https://x.com/*/status/*"
    ],
    "js": ["content.js"],
    "run_at": "document_idle"
  }]
}
```

**Implementation:**
```javascript
const API_BASE = 'https://federatedalpha.com/api';

// Extract token from URL
function extractTokenFromURL() {
  const url = window.location.href;

  // DexScreener: https://dexscreener.com/solana/ABC123...
  const dexMatch = url.match(/dexscreener\.com\/solana\/([A-Za-z0-9]{32,44})/);
  if (dexMatch) return dexMatch[1];

  // Raydium: ?outputCurrency=ABC123...
  const raydiumMatch = url.match(/outputCurrency=([A-Za-z0-9]{32,44})/);
  if (raydiumMatch) return raydiumMatch[1];

  // Jupiter: /swap/SOL-ABC123...
  const jupiterMatch = url.match(/swap\/[A-Z]+-([A-Za-z0-9]{32,44})/);
  if (jupiterMatch) return jupiterMatch[1];

  return null;
}

// Extract Solana addresses from tweet text
function extractSolanaAddresses(text) {
  // Match Solana addresses (base58, 32-44 chars)
  const addressRegex = /\b([1-9A-HJ-NP-Za-km-z]{32,44})\b/g;
  const matches = text.match(addressRegex) || [];
  return matches.filter(addr => {
    // Validate base58 alphabet (no 0, O, I, l)
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(addr);
  });
}

// Get user ID and swarms from storage
async function getUserData() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['userId'], (syncResult) => {
      chrome.storage.local.get(['mySwarms'], (localResult) => {
        resolve({
          userId: syncResult.userId,
          swarms: localResult.mySwarms || []
        });
      });
    });
  });
}

// Scan token on DexScreener/Raydium/Jupiter
async function scanToken(tokenMint) {
  const { userId, swarms } = await getUserData();

  if (!userId || swarms.length === 0) return;

  try {
    // Call scan-token API
    const scanResponse = await fetch(`${API_BASE}/scan-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: tokenMint, userId })
    });

    const scanData = await scanResponse.json();

    if (!scanData.success) return;

    // Share with all swarms
    for (const swarm of swarms) {
      const signalResponse = await fetch(`${API_BASE}/swarm-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          swarmCode: swarm.code,
          tokenMint,
          signal: {
            type: 'rug_detection',
            riskScore: scanData.result.riskScore,
            signals: scanData.result.signals
          },
          timestamp: Date.now()
        })
      });

      const signalData = await signalResponse.json();

      // Check if alert triggered
      if (signalData.swarmConsensus?.alertTriggered) {
        chrome.runtime.sendMessage({
          type: 'SWARM_ALERT',
          alertType: signalData.swarmConsensus.alertType,
          message: signalData.swarmConsensus.message,
          tokenMint,
          swarmCode: swarm.code
        });
      }
    }
  } catch (error) {
    console.error('Token scan failed:', error);
  }
}

// Analyze sentiment on X
async function analyzeTweet() {
  const tweetText = document.querySelector('[data-testid="tweetText"]')?.innerText;
  if (!tweetText) return;

  const tokenAddresses = extractSolanaAddresses(tweetText);
  if (tokenAddresses.length === 0) return;

  const { userId, swarms } = await getUserData();
  if (!userId || swarms.length === 0) return;

  try {
    // Analyze sentiment
    const sentimentResponse = await fetch(`${API_BASE}/analyze-sentiment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: tweetText, tokenMint: tokenAddresses[0] })
    });

    const sentimentData = await sentimentResponse.json();

    if (!sentimentData.success) return;

    // Share with swarms
    for (const swarm of swarms) {
      const signalResponse = await fetch(`${API_BASE}/swarm-signal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
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

      const signalData = await signalResponse.json();

      if (signalData.swarmConsensus?.alertTriggered) {
        chrome.runtime.sendMessage({
          type: 'SWARM_ALERT',
          alertType: signalData.swarmConsensus.alertType,
          message: signalData.swarmConsensus.message,
          tokenMint: tokenAddresses[0],
          swarmCode: swarm.code
        });
      }
    }
  } catch (error) {
    console.error('Sentiment analysis failed:', error);
  }
}

// Main: Detect page type and scan
if (window.location.hostname === 'dexscreener.com' ||
    window.location.hostname.includes('raydium') ||
    window.location.hostname.includes('jup.ag')) {

  const tokenMint = extractTokenFromURL();
  if (tokenMint) {
    // Debounce: wait 2 seconds after page load
    setTimeout(() => scanToken(tokenMint), 2000);
  }

} else if (window.location.hostname === 'twitter.com' || window.location.hostname === 'x.com') {
  // Wait for tweet to load
  setTimeout(analyzeTweet, 3000);
}
```

---

### 5. Update `apps/extension/background.js` - Notifications

**Add notification handler:**
```javascript
// Listen for alert messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SWARM_ALERT') {
    // Show browser notification
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: message.alertType === 'rug' ? '⚠️ Rug Alert' :
             message.alertType === 'pump' ? '🚨 Pump Warning' :
             '🔥 FOMO Spike',
      message: message.message,
      priority: 2,
      requireInteraction: true
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
        timestamp: Date.now()
      });
      // Keep last 50 alerts
      chrome.storage.local.set({ alertHistory: history.slice(0, 50) });
    });
  }

  if (message.action === 'updateBadge') {
    updateBadge(message.count);
  }
});
```

---

### 6. Update `apps/extension/manifest.json` - Add Permissions

```json
{
  "manifest_version": 3,
  "name": "SwarmLink - Federated Alpha Hives",
  "version": "0.1.0",
  "permissions": ["storage", "notifications"],
  "host_permissions": [
    "https://federatedalpha.com/*",
    "https://dexscreener.com/*",
    "https://raydium.io/*",
    "https://jup.ag/*",
    "https://twitter.com/*",
    "https://x.com/*"
  ],
  "content_scripts": [{
    "matches": [
      "https://dexscreener.com/solana/*",
      "https://raydium.io/*",
      "https://jup.ag/*",
      "https://twitter.com/*/status/*",
      "https://x.com/*/status/*"
    ],
    "js": ["content.js"],
    "run_at": "document_idle"
  }],
  "action": {
    "default_popup": "popup.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "swarmlink@federatedalpha.com",
      "strict_min_version": "109.0"
    }
  }
}
```

---

## Testing Plan

### Manual Tests

**1. Single User Scan:**
- [ ] Install extension
- [ ] Visit https://dexscreener.com/solana/[some-token]
- [ ] Check browser console → Verify API call to /api/scan-token
- [ ] Check Redis → Verify signal stored in `swarm:{CODE}:signals:{TOKEN}`
- [ ] Expect: No alert (only 1 member)

**2. Multi-User Threshold:**
- [ ] 3 users install extension
- [ ] All 3 join same swarm
- [ ] User 1 visits DexScreener token → Signal stored (1/3)
- [ ] User 2 visits same token → Signal stored (2/3)
- [ ] User 3 visits same token → ALERT TRIGGERS (3/3)
- [ ] Check: All 3 users receive browser notification

**3. X Sentiment:**
- [ ] User visits https://twitter.com/some/status/123
- [ ] Tweet contains: "🚀 $BONK to the moon! 100x!"
- [ ] Check console → Verify /api/analyze-sentiment called
- [ ] Check response → sentimentScore should be high (~90)
- [ ] Verify signal shared with swarm

**4. Dual-Stream Alert:**
- [ ] User A visits X → High sentiment score (90)
- [ ] User B visits DexScreener → Medium risk score (60)
- [ ] Check aggregation → Should trigger "Pump warning" alert

---

## Implementation Timeline

### Saturday (Feb 8)
- **9am-12pm:** Build `/api/scan-token.js` (extract logic from CAScanner.jsx)
- **12pm-2pm:** Build `/api/analyze-sentiment.js` (heuristic keywords)
- **2pm-5pm:** Build `/api/swarm-signal.js` (aggregation + consensus)
- **5pm-6pm:** Test all 3 endpoints with Postman

### Sunday (Feb 9)
- **9am-11am:** Build `content.js` (URL extraction + API calls)
- **11am-1pm:** Update `background.js` (notification handler)
- **1pm-3pm:** Update `manifest.json` (permissions + content_scripts)
- **3pm-6pm:** Testing with 3 browsers (simulate multi-user swarm)

### Monday (Feb 10)
- **9am-12pm:** Fix bugs from testing
- **12pm-3pm:** Deploy to Vercel
- **3pm-5pm:** Soft launch to 5-10 waitlist users
- **5pm-6pm:** Monitor alerts + gather feedback

---

## Deployment Checklist

- [ ] All API endpoints deployed to Vercel
- [ ] Environment variables set (VITE_HELIUS_API_KEY, KV_REST_API_URL, etc.)
- [ ] Extension ZIP created: `cd apps/extension && zip -r extension.zip .`
- [ ] Test install: Chrome → Extensions → Load unpacked → `apps/extension/`
- [ ] Verify permissions prompt shows correct sites
- [ ] Test on all platforms: Chrome (Linux), Firefox (Windows), Edge

---

## Success Criteria

✅ Extension installs without errors
✅ Content script detects tokens on DexScreener
✅ `/api/scan-token` returns risk scores
✅ `/api/swarm-signal` aggregates correctly
✅ Browser notification fires when threshold met
✅ X sentiment analysis extracts FOMO/FUD signals
✅ Dual-stream alerts work (technical + social)
✅ No crashes or performance issues

---

**Ready to build! Let's start with `/api/scan-token.js`** 🚀
