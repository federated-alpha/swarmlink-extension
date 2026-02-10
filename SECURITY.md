# Security Policy

## Reporting Vulnerabilities

If you discover a security vulnerability in SwarmLink, please report it responsibly:

- **GitHub Issues:** [Open an issue](https://github.com/federated-alpha/swarmlink-extension/issues) (for non-critical bugs)
- **Direct contact:** DM [@federatedalpha](https://x.com/federatedalpha) on X (for critical vulnerabilities)

We take all reports seriously and will respond within 48 hours.

## Security Design

### Permissions (Minimal)

| Permission | Why |
|-----------|-----|
| `storage` | Save your swarms and preferences locally on your device |
| `notifications` | Alert you when high-risk tokens are detected |

We do **not** request `tabs`, `webRequest`, `cookies`, or any other elevated permissions.

### Host Access

The extension runs content scripts on Solana trading sites (DexScreener, Raydium, Jupiter, Birdeye, Pump.fun, etc.) to detect token mint addresses from page URLs. It does **not** read page content, intercept requests, or modify pages.

### Data Handling

- **All storage is local** (`chrome.storage.local` / `chrome.storage.sync`)
- **No telemetry, analytics, or tracking**
- **No data sold or shared with third parties**
- **Wallet address** is received from the Federated Alpha website via `postMessage` with origin validation — never from keystrokes or clipboard
- **API calls** go only to `https://federatedalpha.com/api` (our own backend)

### Content Security Policy

```
script-src 'self'; object-src 'self';
```

Only the extension's own scripts can execute. No inline scripts, no remote code loading, no eval().

### Input Validation

- All Solana addresses validated against base58 charset (`[1-9A-HJ-NP-Za-km-z]{32,44}`)
- Swarm codes validated against format `SWARM-[A-Z0-9]{12}`
- All user-displayed content passed through `escapeHtml()` to prevent XSS
- `postMessage` listeners validate origin before processing

## Audit This Code

We encourage community audits. Here's how:

1. **Read the source** — Every file is plain JavaScript, no obfuscation
2. **Check permissions** — `manifest.json` lists exactly what the extension can access
3. **Search for red flags** — `grep -r "eval\|Function(" .` should return nothing
4. **Run npm audit** — `npm install && npm audit` checks dependencies
5. **Load unpacked** — Test it yourself in `chrome://extensions/` developer mode

Found something? Open an issue or DM us. Auditors may be eligible for $ALPHA token airdrops.
