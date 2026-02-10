# SwarmLink - Community-Powered Rug Detection for Solana

Browser extension that connects your trading group into a real-time sentiment swarm. When you scan a token on any supported site, your swarm sees the risk score instantly.

**No API keys. No tracking. No data collection. Just open-source rug detection.**

## What It Does

1. You browse a token on DexScreener, Raydium, Jupiter, Pump.fun, etc.
2. SwarmLink detects the token mint from the URL
3. It runs a rug risk scan (holder concentration, wallet age, cluster detection, funding chain analysis)
4. Your swarm members see the result in real-time
5. High-risk tokens trigger browser notifications

## Supported Sites

| Site | Type |
|------|------|
| [DexScreener](https://dexscreener.com) | DEX aggregator |
| [Raydium](https://raydium.io) | DEX + Launchpad |
| [Jupiter](https://jup.ag) | DEX aggregator |
| [Birdeye](https://birdeye.so) | Analytics |
| [Pump.fun](https://pump.fun) | Token launcher |
| [GMGN](https://gmgn.ai) | Trading terminal |
| [Photon](https://photon-sol.tinyastro.io) | Trading terminal |
| [RugCheck](https://rugcheck.xyz) | Token scanner |
| [LetsBonk](https://letsbonk.fun) | Token launcher |
| [Believe](https://believe.app) | Token launcher |
| [Solscan](https://solscan.io) | Block explorer |
| [SolanaFM](https://solana.fm) | Block explorer |
| [Solana Explorer](https://explorer.solana.com) | Block explorer |
| [Phantom](https://phantom.com) | Wallet |
| [X / Twitter](https://x.com) | Social (token links in posts) |

## Install (Developer Mode)

No Chrome Web Store listing yet. Load it directly:

1. Clone this repo: `git clone https://github.com/federated-alpha/swarmlink-extension.git`
2. Open Chrome and go to `chrome://extensions/`
3. Enable **Developer mode** (top right toggle)
4. Click **Load unpacked**
5. Select the cloned folder
6. Connect your wallet at [federatedalpha.com/swarms](https://federatedalpha.com/swarms)

The extension syncs your wallet and swarms automatically.

## Permissions

Only two permissions requested:

- **`storage`** — Save your swarms and preferences locally
- **`notifications`** — Alert on high-risk tokens

No `tabs`, `webRequest`, `cookies`, or any elevated access. See [SECURITY.md](SECURITY.md) for full details.

## How Risk Scoring Works

Each token scan checks:

- **Temporal clustering** — Did holders buy within the same time window?
- **Funding chain tracing** — Do holders share a common funding wallet?
- **Behavioral fingerprinting** — Do holders show bot-like patterns?
- **Holder concentration** — What % do the top 5 wallets hold?
- **Wallet age** — How old are the holder wallets on average?
- **Known rug sources** — Is the deployer wallet linked to previous rugs?

Scores range 0-100. Higher = more risk.

| Score | Risk Level |
|-------|-----------|
| 0-34 | LOW |
| 35-50 | MEDIUM |
| 51-100 | HIGH |

## Audit This Code

We built this to be auditable. No build step, no obfuscation, no minification.

```bash
# Check for eval/Function (should find nothing)
grep -r "eval\|Function(" --include="*.js" .

# Check dependencies for known vulnerabilities
npm install && npm audit

# Search for hardcoded secrets (should find nothing)
grep -rn "API_KEY\|SECRET\|PASSWORD\|PRIVATE" --include="*.js" .
```

Found something? See [SECURITY.md](SECURITY.md) for how to report.

## Tech Stack

- Chrome Extension Manifest V3 (Firefox compatible)
- Vanilla JavaScript (content scripts + popup)
- React 19 (popup UI via Vite build)
- No external CDN dependencies at runtime
- CSP: `script-src 'self'; object-src 'self'`

## Data & Privacy

- All data stored locally on your device
- No analytics, telemetry, or tracking
- API calls go only to `federatedalpha.com`
- Full details in [PRIVACY.md](PRIVACY.md)

## Contributing

PRs welcome. If you find a bug or want to add support for a new site:

1. Fork this repo
2. Create a branch (`git checkout -b feature/new-site`)
3. Make your changes
4. Open a PR with a description of what changed

## License

[MIT](LICENSE)

## Links

- Website: [federatedalpha.com](https://federatedalpha.com)
- X: [@federatedalpha](https://x.com/federatedalpha)
- Token: $ALPHA on Solana
