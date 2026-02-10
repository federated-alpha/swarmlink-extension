# SwarmLink MVP Specification - Hive-Based Sentiment Alerts

## Executive Summary

**Problem:** Solana traders get rugged because they lack collaborative intelligence - everyone scans tokens in isolation.

**Solution:** SwarmLink enables swarms to passively share sentiment signals. When multiple members flag a token as risky, the whole swarm gets alerted.

**Value Prop:** "My swarm caught a rug I almost bought" - collaborative alpha without manual effort.

---

## Core Feature: Hive-Based Rug Detection Alerts

### User Experience

**Scenario 1: Passive Detection**
1. User browses DexScreener looking at $WOJAK token
2. Extension auto-scans token in background (via existing /api/scan-token)
3. Detects high rug risk (cluster analysis shows coordinated wallets)
4. Shares anonymized signal with user's hive
5. **If ≥3 swarm members also flagged it:** Browser notification fires
6. Alert: "⚠️ Hive Alert: $WOJAK flagged by 4/6 members - High rug risk"

**Scenario 2: Consensus Building**
1. Alice visits DexScreener for $BONK - scans → 85% rug risk
2. Bob visits same token 10 minutes later → 90% rug risk
3. Carol checks it on Raydium → 80% rug risk
4. Threshold met (3 members) → All 6 swarm members get notified
5. Dave was about to buy $BONK → sees alert → avoids rug

**Scenario 3: Niche Customization**
- "Memecoin Hunters" hive: Low threshold (≥2 members), FOMO-focused
- "Rug Detectors" hive: High threshold (≥5 members), only critical signals
- "DeFi Yields" hive: Different logic (yield opportunities, not rugs)

### Technical Specification

#### 1. Content Script (NEW)

**File:** `apps/extension/src/content.js`

**Triggers on these sites:**
- dexscreener.com/solana/*
- raydium.io/*
- jup.ag/*
- birdeye.so/*
- twitter.com/*/status/* (X posts with Solana addresses)

**Logic:**
```javascript
// Detect token address from URL/page content
const tokenMint = extractTokenFromPage();

// Call existing scan endpoint
const scanResult = await fetch(`${API_BASE}/scan-token`, {
  method: 'POST',
  body: JSON.stringify({ address: tokenMint })
});

// Share with swarm (anonymized)
await fetch(`${API_BASE}/hive-signal`, {
  method: 'POST',
  body: JSON.stringify({
    userId: getUserId(),
    swarmCode: getUserHives(), // Send all swarms user is in
    tokenMint: tokenMint,
    riskScore: scanResult.riskScore,
    signals: scanResult.signals, // cluster, liquidity, etc.
    timestamp: Date.now()
  })
});

// Check if threshold met
if (scanResult.hiveConsensus && scanResult.hiveConsensus.alertTriggered) {
  showNotification(scanResult.hiveConsensus);
}
```

**URL Pattern Matching:**
```javascript
// DexScreener: https://dexscreener.com/solana/ABC123...
const dexScreenerRegex = /dexscreener\.com\/solana\/([A-Za-z0-9]+)/;

// Raydium: https://raydium.io/swap/?inputCurrency=sol&outputCurrency=ABC123...
const raydiumRegex = /outputCurrency=([A-Za-z0-9]+)/;

// Jupiter: https://jup.ag/swap/SOL-ABC123...
const jupiterRegex = /swap\/SOL-([A-Za-z0-9]+)/;
```

#### 2. Hive Signal API (NEW)

**File:** `api/hive-signal.js`

**Endpoint:** `POST /api/hive-signal`

**Request:**
```json
{
  "userId": "uuid-here",
  "swarmCodes": ["SWARM-ABC123", "SWARM-XYZ789"],
  "tokenMint": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "riskScore": 85,
  "signals": {
    "clusterRisk": "HIGH",
    "liquidityLocked": false,
    "suspiciousWallets": 5
  },
  "timestamp": 1707350400000
}
```

**Redis Storage:**
```
Key: hive:{SWARM-CODE}:signals:{TOKEN-MINT}
Value: Sorted set of member signals
  {
    member: userId,
    score: riskScore,
    timestamp: time,
    signals: JSON
  }

TTL: 24 hours (signals expire after 1 day)
```

**Aggregation Logic:**
```javascript
// Get all signals for this token in this hive
const signals = await redis.zrange(`hive:${swarmCode}:signals:${tokenMint}`, 0, -1);

// Calculate consensus
const memberCount = signals.length;
const avgRiskScore = signals.reduce((sum, s) => sum + s.score, 0) / memberCount;

// Check threshold
const threshold = await redis.hget(`hive:${swarmCode}`, 'alertThreshold') || 3;

if (memberCount >= threshold && avgRiskScore >= 70) {
  return {
    alertTriggered: true,
    consensus: {
      memberCount: memberCount,
      avgRiskScore: avgRiskScore,
      topSignals: signals.slice(0, 5) // Show who flagged it
    }
  };
}
```

**Response:**
```json
{
  "success": true,
  "hiveConsensus": {
    "alertTriggered": true,
    "memberCount": 4,
    "avgRiskScore": 82,
    "message": "⚠️ 4 swarm members flagged this token"
  }
}
```

#### 3. Browser Notifications (NEW)

**File:** `apps/extension/src/background.js`

**Permissions Required:**
```json
// In manifest.json
"permissions": ["storage", "notifications"]
```

**Notification Logic:**
```javascript
// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'HIVE_ALERT') {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: '⚠️ Hive Alert',
      message: `${message.tokenSymbol}: Flagged by ${message.memberCount} members (${message.avgRiskScore}% risk)`,
      priority: 2,
      requireInteraction: true // Stays until user clicks
    });
  }
});
```

**Click Handler:**
```javascript
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open extension popup to show details
  chrome.action.openPopup();
});
```

#### 4. Popup Alert History (Enhancement)

**File:** `apps/extension/popup.js`

**New View: Alert History**
```jsx
const AlertHistoryView = () => {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    // Fetch from local storage
    chrome.storage.local.get(['alertHistory'], (result) => {
      setAlerts(result.alertHistory || []);
    });
  }, []);

  return (
    <div className="alert-history">
      <h3>Recent Hive Alerts</h3>
      {alerts.map(alert => (
        <div className="alert-card" key={alert.id}>
          <div className="alert-header">
            <Icon name="alert" />
            <span>{alert.tokenSymbol}</span>
          </div>
          <div className="alert-body">
            <p>Flagged by {alert.memberCount} members</p>
            <p>Avg Risk: {alert.avgRiskScore}%</p>
            <p className="alert-time">{formatTime(alert.timestamp)}</p>
          </div>
          <button onClick={() => window.open(`https://dexscreener.com/solana/${alert.tokenMint}`)}>
            View Token →
          </button>
        </div>
      ))}
    </div>
  );
};
```

---

## Implementation Timeline

### Weekend Sprint (2 Days)

**Saturday (Day 1):**
- [ ] Content script setup (detect DexScreener URLs)
- [ ] URL pattern matching for Raydium, Jupiter
- [ ] Call /api/scan-token from content script
- [ ] Build /api/hive-signal endpoint (Redis aggregation)
- [ ] Test with manual token scans

**Sunday (Day 2):**
- [ ] Add browser notifications
- [ ] Build alert history view in popup
- [ ] Test threshold logic (≥3 members)
- [ ] Polish UI for alerts
- [ ] Test with 2-3 real swarms

**Monday (Soft Launch):**
- [ ] Deploy to 5-10 waitlist users
- [ ] Gather feedback
- [ ] Fix critical bugs
- [ ] Prepare for Chrome Web Store submission

---

## Testing Strategy

### Manual Tests
1. **Single User:** Visit DexScreener → verify scan fires → check Redis
2. **Multi-User:** 3 testers visit same token → verify alert triggers
3. **Threshold:** Test with 2 members (no alert) vs 3 members (alert)
4. **Persistence:** Refresh page → verify signals persist in Redis
5. **TTL:** Wait 24h → verify signals expire

### Integration Tests
- Content script detects URLs correctly
- API endpoint aggregates signals
- Notifications show on all platforms (Chrome, Firefox, Linux)
- Cross-device: Alice on Chrome, Bob on Firefox → both get alerted

### Edge Cases
- Token with no data (new token)
- Multiple swarms for same user (send to all)
- Rapid scanning (rate limiting)
- Network failures (retry logic)

---

## Pre-Built Hives (Launch With These)

### 1. Memecoin Hunters
**Config:**
```json
{
  "code": "SWARM-MEMECOIN",
  "name": "Memecoin Hunters",
  "description": "Detect pumps and rugs before they happen",
  "icon": "rocket",
  "threshold": 2,
  "focus": "fomo",
  "alertTypes": ["rug", "pump", "whale_dump"]
}
```

### 2. Rug Detectors
**Config:**
```json
{
  "code": "SWARM-RUGDETECT",
  "name": "Rug Detectors",
  "description": "Caught 47 rugs in the last 30 days",
  "icon": "shield",
  "threshold": 3,
  "focus": "rug",
  "alertTypes": ["rug", "cluster", "liquidity"]
}
```

### 3. DeFi Yields
**Config:**
```json
{
  "code": "SWARM-DEFI",
  "name": "DeFi Yield Hunters",
  "description": "Finding hidden yields before they're crowded",
  "icon": "coins",
  "threshold": 4,
  "focus": "yield",
  "alertTypes": ["yield_opportunity", "protocol_health"]
}
```

---

## Success Metrics

**Week 1 (Soft Launch):**
- [ ] 10+ active users
- [ ] 50+ tokens scanned
- [ ] 5+ alerts triggered
- [ ] 0 critical bugs
- [ ] Positive feedback from testers

**Week 2 (Chrome Web Store):**
- [ ] 100+ installs
- [ ] 20+ swarms created
- [ ] 200+ tokens scanned
- [ ] 1+ verified rug caught by swarms

**Month 1 (Public Launch):**
- [ ] 1,000+ installs
- [ ] 100+ active swarms
- [ ] 10+ verified rugs prevented
- [ ] Featured in Solana community channels

---

## Future Enhancements (Post-MVP)

### v0.2: X Sentiment Analysis
- TF.js model for FOMO/FUD detection
- Monitor X posts mentioning Solana tokens
- Aggregate swarm sentiment: "85% FOMO spike for $BONK"

### v0.3: Wallet Vibes
- Monitor on-chain activity for watched tokens
- Alert on whale dumps, large transfers
- Hive consensus on wallet behavior

### v0.4: P2P Federated Learning
- WebRTC mesh for model updates
- Differential privacy (ε=1.0)
- Decentralized consensus without backend

### v0.5: Niche Customization
- NFT floor sentiment
- DAO governance trends
- Gaming guild engagement metrics

---

## Privacy & Security

**What We Collect:**
- Anonymous userId (UUID)
- Token scan results (risk scores, signals)
- Hive membership (codes only)
- Timestamps

**What We DON'T Collect:**
- Private keys (never touch wallets)
- Personal data (no emails, names)
- Browsing history (only scanned tokens)
- Raw transaction data

**Data Sharing:**
- Within hive: Anonymized risk scores only
- Across swarms: No data shared
- Third parties: None (fully self-hosted)

**Storage:**
- Redis: 24h TTL on signals (auto-delete)
- Local: Hive membership + alert history
- No permanent user profiling

---

## Go/No-Go Decision

**Ready to Publish When:**
- ✅ Content script detects tokens accurately (≥95% success rate)
- ✅ Hive alerts trigger correctly (≥3 members tested)
- ✅ Notifications work on all browsers
- ✅ No critical bugs in 24h of testing
- ✅ Positive feedback from 5+ beta testers

**DON'T Publish If:**
- ❌ Alerts trigger incorrectly (false positives)
- ❌ Performance issues (slows down browser)
- ❌ Privacy leaks (user data exposed)
- ❌ Extension crashes frequently

---

## Questions to Resolve Before Building

1. **Threshold Logic:** Fixed (≥3 members) or configurable per hive?
2. **Signal Weight:** Should newer signals count more than old ones?
3. **Notification Frequency:** Limit to 1 alert per token per day?
4. **False Positives:** How to handle tokens flagged incorrectly?
5. **Reputation:** Should repeat false-flaggers get lower signal weight?

---

**Next Step:** Build content script + /api/hive-signal this weekend. Deploy soft launch Monday.
