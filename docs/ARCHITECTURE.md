# SwarmLink Architecture - Dual-Stream Sentiment Intelligence

## Existing MVP (Before Extension)

### What We Already Have ✅

**1. Frontend Token Scanner (CAScanner.jsx)**
- Client-side React app for scanning Solana tokens
- **Data Sources:**
  - Helius RPC → blockchain data (holders, metadata)
  - DexScreener API → market data (price, liquidity, volume)
  - pump.fun API → bonding curve data
- **Analysis:**
  - Holder concentration
  - Mint/freeze authority checks
  - Liquidity analysis
  - Market cap calculations

**2. Cluster Detection System (api/lib/funding-chain.js)**
- **3 Detection Signals:**
  1. **Temporal Clustering** - wallets created/buying in same window
  2. **Funding Chain Tracing** - shared funders within 1-2 hops
  3. **Behavioral Fingerprinting** - suspiciously similar wallet profiles
- **Reputation Database:**
  - Redis keys: `cluster:dumps:{fundingSource}` (permanent)
  - Tracks confirmed rug pulls
  - AllenHark blacklist integration (~4,178 scammer addresses)
- **Functions:**
  - `detectClusters(holderChains)` - finds coordinated wallets
  - `traceFunders(wallet, kv)` - traces funding sources
  - `checkReputation(fundingSources, kv)` - queries dump history
  - `scoreTemporalCluster(wallets)` - timestamps analysis
  - `scoreBehavioralCluster(wallets)` - pattern matching

**3. Automated Scanning Cron (api/cron/cluster-scan.js)**
- Runs every 5 minutes via cron-job.org
- Scans tokens from:
  - `cluster:queue` (high-risk flagged by rug-radar)
  - `all_watched_tokens` (user watchlists)
- Max 3 tokens per run (45s time limit)
- Sends Telegram alerts (@fedalpha1) if cluster detected
- Redis caching: 4h dedup, 24h alert cooldown

**4. Infrastructure**
- **RPC:** Helius free tier (1M credits/month)
- **Database:** Upstash Redis (@upstash/redis v1.36.1)
- **Alerts:** Telegram Bot API
- **Deployment:** Vercel serverless functions

---

## SwarmLink Extension - What We're Building

### Dual-Stream Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER EXTENSION                        │
│                                                             │
│  ┌───────────────────────┐    ┌──────────────────────────┐ │
│  │   STREAM 1: TECHNICAL │    │   STREAM 2: SOCIAL       │ │
│  │   (DexScreener/X URLs)│    │   (X Sentiment)          │ │
│  └───────────┬───────────┘    └──────────┬───────────────┘ │
│              │                           │                  │
│              ▼                           ▼                  │
│     Content Script (content.js)                            │
│              │                           │                  │
│              ▼                           ▼                  │
│     /api/scan-token            /api/analyze-sentiment      │
│     (Reuses existing           (NEW: TF.js heuristics)     │
│      cluster detection)                                    │
│              │                           │                  │
│              └───────────┬───────────────┘                  │
│                          ▼                                  │
│                /api/swarm-signal                           │
│                (Aggregate signals)                         │
│                          │                                  │
│                          ▼                                  │
│                 Redis: swarm:{CODE}:signals:{TOKEN}        │
│                          │                                  │
│                          ▼                                  │
│              Check Threshold (≥3 members?)                 │
│                          │                                  │
│                   YES ───┴─── NO                            │
│                    │           │                            │
│                    ▼           ▼                            │
│         Browser Notification  Wait                         │
│         "🚨 Swarm Alert!"                                  │
└─────────────────────────────────────────────────────────────┘
```

### Stream 1: Technical Rug Detection (DexScreener)

**Trigger Sites:**
- dexscreener.com/solana/*
- raydium.io/*
- jup.ag/*
- birdeye.so/*

**Content Script Logic:**
```javascript
// Extract token from URL
const tokenMint = extractTokenFromURL(); // e.g., "ABC123...XYZ"

// Call EXISTING scan endpoint (reuses all cluster detection logic!)
const scanResult = await fetch(`${API_BASE}/scan-token`, {
  method: 'POST',
  body: JSON.stringify({ address: tokenMint, userId })
});

// Share with swarm (anonymized)
await shareWithSwarm(scanResult);
```

**NEW Endpoint: /api/scan-token.js**
- Wraps existing CAScanner logic into serverless function
- Reuses: `api/lib/funding-chain.js` cluster detection
- Calls: Helius RPC, DexScreener, pump.fun
- Returns: `{ riskScore, signals: { cluster, liquidity, authority } }`

### Stream 2: Social Sentiment (X/Twitter)

**Trigger Sites:**
- twitter.com/*/status/* (tweets mentioning Solana tokens)
- x.com/*/status/*

**Content Script Logic:**
```javascript
// Extract tweet text + token mentions
const tweetText = document.querySelector('[data-testid="tweetText"]').innerText;
const tokenMints = extractSolanaAddresses(tweetText);

// Analyze sentiment (heuristic keywords)
const sentiment = analyzeSentiment(tweetText);
// Returns: { score: 0-100, signals: { fomo: true, fud: false, pump: true } }

// Share with swarm
await shareWithSwarm({ tokenMint, sentiment, source: 'twitter' });
```

**NEW Endpoint: /api/analyze-sentiment.js**
- **MVP:** Simple heuristic keyword matching (no ML needed!)
  - FOMO keywords: "moon", "100x", "ape in", "last chance", "🚀"
  - FUD keywords: "scam", "rug", "dump", "sell now"
  - Pump keywords: "LFG", "buy now", "pump", "explode"
- Count keyword matches → Score 0-100
- Returns: `{ sentimentScore, signals: { fomo, fud, pump } }`
- **Future (v0.2):** Can add TF.js model if heuristics aren't accurate enough

### Swarm Signal Aggregation

**NEW Endpoint: /api/swarm-signal.js**

**Request:**
```json
{
  "userId": "uuid-here",
  "swarmCode": "SWARM-ABC123",
  "tokenMint": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "signal": {
    "type": "rug_detection", // or "sentiment"
    "riskScore": 85,
    "sentimentScore": 92, // if type=sentiment
    "signals": {
      "cluster": "HIGH",
      "liquidityLocked": false,
      "fomo": true
    }
  },
  "timestamp": 1707350400000
}
```

**Redis Storage:**
```
Key: swarm:{SWARM-CODE}:signals:{TOKEN-MINT}
Value: Sorted set (score = timestamp)
[
  {
    memberId: "uuid",
    riskScore: 85,
    sentimentScore: 92,
    signals: {...},
    timestamp: 1707350400000
  },
  ...
]
TTL: 24 hours
```

**Aggregation Logic:**
```javascript
// Get all signals for this token in this swarm
const signals = await kv.zrange(`swarm:${swarmCode}:signals:${tokenMint}`, 0, -1);

// Calculate consensus
const memberCount = signals.length;
const avgRiskScore = signals.reduce((sum, s) => sum + s.riskScore, 0) / memberCount;
const avgSentimentScore = signals.reduce((sum, s) => sum + (s.sentimentScore || 0), 0) / memberCount;

// Get swarm threshold (default: 3 members)
const threshold = await kv.hget(`swarm:${swarmCode}`, 'alertThreshold') || 3;

// Dual-stream intelligence rules:
if (memberCount >= threshold) {
  // Rule 1: High rug risk
  if (avgRiskScore >= 70) {
    return { alert: true, type: 'rug', message: `⚠️ ${memberCount} members flagged rug risk (${avgRiskScore}%)` };
  }

  // Rule 2: High hype + High risk = Pump warning
  if (avgSentimentScore >= 80 && avgRiskScore >= 60) {
    return { alert: true, type: 'pump', message: `🚨 Pump detected: High hype (${avgSentimentScore}%) + Medium risk (${avgRiskScore}%)` };
  }

  // Rule 3: Pure FOMO spike (low risk but extreme hype)
  if (avgSentimentScore >= 90 && avgRiskScore < 40) {
    return { alert: true, type: 'fomo', message: `🔥 FOMO spike: ${memberCount} members see extreme hype` };
  }
}

return { alert: false };
```

**Response:**
```json
{
  "success": true,
  "swarmConsensus": {
    "alertTriggered": true,
    "type": "pump",
    "memberCount": 4,
    "avgRiskScore": 62,
    "avgSentimentScore": 85,
    "message": "🚨 Pump detected: High hype + Medium risk"
  }
}
```

### Browser Notifications

**Manifest Permissions:**
```json
"permissions": ["storage", "notifications"]
```

**Background Worker (background.js):**
```javascript
// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'SWARM_ALERT') {
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
  }
});
```

---

## Privacy Model

### What We Share

**Technical Stream (DexScreener):**
```javascript
{
  tokenMint: sha256(tokenAddress), // Hashed for privacy
  riskScore: 85,                   // 0-100 score
  signals: {                       // Anonymized flags
    cluster: "HIGH",               // Not actual wallet addresses
    liquidityLocked: false,
    authority: "revoked"
  }
}
```

**Social Stream (X):**
```javascript
{
  tokenMint: sha256(tokenAddress),
  sentimentScore: 92,
  signals: {
    fomo: true,
    fud: false,
    pump: true
  }
  // NO tweet content, NO usernames, NO URLs
}
```

### What We DON'T Share

- ❌ Wallet addresses (only hashed token mints)
- ❌ Tweet content (only sentiment scores)
- ❌ Browsing history (only permitted sites)
- ❌ Personal data (only anonymous userId)
- ❌ Transaction data (never touch wallets)

### Chrome Security Model

**Content Script Sandboxing:**
- Can ONLY access sites listed in `host_permissions`
- Cannot access general browsing history
- Cannot read cookies/passwords
- Cannot access wallet extensions (different isolation)

**Permissions:**
```json
{
  "host_permissions": [
    "https://dexscreener.com/*",
    "https://raydium.io/*",
    "https://jup.ag/*",
    "https://birdeye.so/*",
    "https://twitter.com/*",
    "https://x.com/*",
    "https://federatedalpha.com/*"
  ]
}
```

---

## Data Flow Example

### Scenario: Alice visits DexScreener, sees $WOJAK

```
1. Alice opens: https://dexscreener.com/solana/ABC123...XYZ

2. Content script detects token mint from URL: ABC123...XYZ

3. Call /api/scan-token:
   ├─ Fetch holders from Helius RPC
   ├─ Run cluster detection (funding-chain.js)
   ├─ Check market data (DexScreener)
   ├─ Return: { riskScore: 85, signals: { cluster: "HIGH" } }

4. Call /api/swarm-signal (Alice in "Memecoin Hunters" swarm):
   ├─ Hash token: sha256(ABC123...XYZ) = "hash123"
   ├─ Store in Redis: swarm:SWARM-MEMECOIN:signals:hash123
   ├─ Check consensus: 1/6 members (threshold not met)
   ├─ Return: { alert: false }

5. Bob visits same token 5 minutes later:
   ├─ Same scan → riskScore: 82
   ├─ Store signal → 2/6 members (threshold not met)

6. Carol visits same token:
   ├─ Same scan → riskScore: 88
   ├─ Store signal → 3/6 members (THRESHOLD MET ✅)
   ├─ avgRiskScore = (85+82+88)/3 = 85%
   ├─ Return: { alert: true, type: 'rug', message: "⚠️ 3 members flagged rug risk (85%)" }

7. Browser notification fires for ALL 6 swarm members:
   "⚠️ Rug Alert: $WOJAK flagged by 3 members (85% risk)"

8. Dave was about to buy → Sees alert → Avoids rug ✅
```

### Scenario: Dual-Stream Intelligence

```
1. Alice browses X, sees tweet: "🚀 $BONK to the moon! 100x guaranteed! LFG! 🚀"
   ├─ Content script extracts: tokenMint = BONK...
   ├─ Sentiment analysis: FOMO keywords detected
   ├─ Call /api/analyze-sentiment:
      └─ Return: { sentimentScore: 95, signals: { fomo: true, pump: true } }
   ├─ Share with swarm: sentimentScore = 95

2. Bob visits DexScreener for $BONK:
   ├─ Technical scan: riskScore = 65 (medium cluster risk)
   ├─ Share with swarm: riskScore = 65

3. Swarm aggregation (2 signals):
   ├─ avgRiskScore = 65
   ├─ avgSentimentScore = 95
   ├─ Rule: "High hype + Medium risk = Pump warning"
   ├─ Alert: "🚨 Pump detected: High hype (95%) + Medium risk (65%)"

4. All swarm members notified:
   "Don't FOMO - likely coordinated pump"
```

---

## File Structure

```
federated-alpha/
├── api/
│   ├── scan-token.js              # NEW: Server-side token scanner
│   ├── analyze-sentiment.js       # NEW: X sentiment analysis
│   ├── swarm-signal.js           # NEW: Signal aggregation
│   ├── lib/
│   │   ├── funding-chain.js       # EXISTING: Cluster detection
│   │   └── helius.js              # EXISTING: Helius RPC utils
│   └── cron/
│       └── cluster-scan.js        # EXISTING: Automated scanning
├── apps/extension/
│   ├── manifest.json              # Chrome extension v3
│   ├── content.js                 # NEW: Monitor DexScreener/X
│   ├── background.js              # Badge + notifications
│   └── popup.js                   # Swarm management UI
└── src/
    └── CAScanner.jsx              # EXISTING: Frontend scanner
```

---

## MVP Approach: Simple Centralized Aggregation

### What We're Building (v0.1)
- ✅ Centralized score aggregation in Redis
- ✅ Browser extension monitors DexScreener + X
- ✅ Reuses existing cluster detection (api/lib/funding-chain.js)
- ✅ Swarm consensus: ≥3 members → Alert
- ✅ **100% serverless on Vercel** (no containers, no P2P mesh)

### What We're NOT Building Yet
- ❌ Federated Learning (v0.4 - future)
- ❌ TF.js models (v0.2 - X sentiment can use simple heuristics first)
- ❌ WebRTC P2P mesh (v0.4 - not needed for MVP)
- ❌ Differential privacy (v0.4 - scores are already anonymized)

### Simple Aggregation Logic
```javascript
// api/swarm-signal.js - just average scores and check threshold
const signals = await kv.zrange(`swarm:${swarmCode}:signals:${tokenMint}`, 0, -1);
const avgRiskScore = signals.reduce((sum, s) => sum + s.riskScore, 0) / signals.length;

if (signals.length >= 3 && avgRiskScore >= 70) {
  return { alert: true, message: "⚠️ Rug risk detected by swarm" };
}
```

### Vercel Compatibility
- ✅ All endpoints are Vercel serverless functions
- ✅ No WebSockets needed (simple HTTP requests)
- ✅ No containers or custom runtimes
- ✅ Uses existing Upstash Redis
- ✅ Same infrastructure as current site

---

## Implementation Timeline

### This Weekend (Feb 8-9, 2026)

**Saturday:**
- [ ] Build /api/scan-token.js (wrap CAScanner logic)
- [ ] Build /api/swarm-signal.js (score aggregation)
- [ ] Content script for DexScreener URL detection
- [ ] Test: Single user scan → Redis storage

**Sunday:**
- [ ] Build /api/analyze-sentiment.js (heuristic keywords)
- [ ] Content script for X sentiment extraction
- [ ] Browser notifications (background.js)
- [ ] Test: 3 users → Threshold alert

**Monday (Soft Launch):**
- [ ] Deploy to 5-10 waitlist testers
- [ ] Monitor alerts in Telegram
- [ ] Gather feedback
- [ ] Fix critical bugs

**Next Week:**
- [ ] Add alert history in popup
- [ ] Pre-built niche swarms (Memecoin Hunters, Rug Detectors)
- [ ] Polish UI/UX
- [ ] Prepare Chrome Web Store submission

---

## Success Metrics

**Week 1 (Soft Launch):**
- 10+ active users
- 50+ tokens scanned
- 5+ alerts triggered
- 1+ verified rug caught

**Week 2 (Chrome Web Store):**
- 100+ installs
- 20+ swarms created
- 200+ tokens scanned
- 0 critical bugs

**Month 1 (Public Launch):**
- 1,000+ installs
- 100+ active swarms
- 10+ verified rugs prevented
- Featured in Solana community channels

---

## Next Steps

1. ✅ Document existing architecture (THIS FILE)
2. 🚀 Build /api/scan-token.js (reuse CAScanner logic)
3. 🚀 Build /api/swarm-signal.js (score aggregation)
4. 🚀 Build content script (DexScreener + X monitoring)
5. 🚀 Build /api/analyze-sentiment.js (X sentiment)
6. 🚀 Test dual-stream alerts
7. 🚀 Deploy soft launch

**Ready to build!** 🔨
