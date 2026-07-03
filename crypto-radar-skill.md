---
name: crypto-radar
version: 1.3.0
description: "Multi-chain crypto market intelligence for Hermes Agent — 39+ tokens, 10 technical indicators, RSS news, 3-strategy signal engine, DeFiLlama on-chain metrics, SVG candlestick charts, XLSX/CSV/JSON export, warm daemon for sub-50ms tool calls."
author: Sam
tags: [crypto, trading, binance, defi, signals, technical-analysis, hermes-plugin]
install:
  type: plugin
  requires:
    - hermes >= 0.1.0
    - node >= 22.0.0
  steps:
    - npm install
    - npm run build
    - ln -sf "$PWD" ~/.hermes/plugins/crypto-radar
---

# Crypto Radar Plugin

Hermes Agent plugin for multi-chain crypto market intelligence.

## Features

- **40+ tokens** across Solana, Polygon, BNB, Bitcoin, Ethereum, Dogecoin, XRP, Cardano, Sui, Aptos, Sei, Celestia, Injective, Thorchain, & Cosmos
- **10 technical indicators**: RSI, MACD, Bollinger Bands, ATR, EMA, SMA, Stochastic, Williams %R, OBV, Volume Profile
- **RSS news aggregation** from 9 feeds with signal extraction
- **3-strategy signal engine**: momentum, mean-reversion, trend-following
- **DeFiLlama on-chain metrics**: protocol TVL, chain TVL, DEX fees
- **WebSocket real-time price streaming**
- **SVG candlestick charts**
- **XLSX/CSV/JSON/MD export**
- **Warm daemon** for sub-50ms tool calls
- **Health monitoring** with status endpoint

## Tools

| Tool | Description |
|------|-------------|
| `crypto_radar_scan` | Scan token prices across all tracked chains |
| `crypto_radar_signals` | Generate trading signals from technical indicators |
| `crypto_radar_news` | Fetch and analyze crypto RSS news |
| `crypto_radar_tokens` | List and manage tracked token whitelist |
| `crypto_radar_chart` | Render SVG candlestick chart for a token |
| `crypto_radar_daemon` | Control the warm daemon (start/stop/status) |
| `crypto_radar_onchain` | Query DeFiLlama on-chain metrics |
| `crypto_radar_ws` | WebSocket real-time price stream |

## Installation

```bash
# One-liner install
bash <(curl -fsSL https://raw.githubusercontent.com/ssdeanx/Hermes-Crypto-Radar/main/scripts/install.sh)

# Or manual install
git clone https://github.com/ssdeanx/Hermes-Crypto-Radar.git
cd Hermes-Crypto-Radar
npm install && npm run build
ln -sf "$PWD" ~/.hermes/plugins/crypto-radar
```

## Commands

```bash
# Scan token prices
crypto-radar scan

# Generate trading signals
crypto-radar signals

# Fetch crypto news
crypto-radar news

# Start warm daemon for fast tool calls
crypto-radar daemon

# Plot chart for a token (e.g., BTC)
crypto-radar chart BTC --svg

# Export to XLSX/CSV/JSON
crypto-radar export --format xlsx
```

## Configuration

Edit `crypto-radar.json` in the plugin root to configure:
- `tokens` — whitelist of tracked token symbols
- `rss_feeds` — RSS feed URLs for news
- `indicators` — technical indicator parameters
- `dexscreener` — DexScreener API settings (polling interval, max retries)

## License

MIT
