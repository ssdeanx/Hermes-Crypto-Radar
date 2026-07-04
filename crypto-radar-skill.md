---
name: crypto-radar
version: 2.0.0
description: "🛰️ Enterprise-grade multi-chain crypto market intelligence for Hermes Agent — tracks 49 tokens across 15+ chains with 26 technical indicators, divergence detection, ADX trend filter, RSS news aggregation from 11 feeds, DeFiLlama on-chain metrics, WebSocket real-time prices, warm daemon for sub-50ms tool calls, SVG candlestick/dashboard charts, and XLSX/CSV/JSON/MD export. 8 full-spectrum agent tools for token scanning, signal generation, news analysis, chart rendering, daemon management, on-chain queries, and real-time price streams."
author: Sam
tags: [crypto, trading, binance, defi, signals, technical-analysis, hermes-plugin, market-intelligence]
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

- **49 tokens** across 15+ chains — Solana, Polygon, BNB, Bitcoin, Ethereum, Dogecoin, XRP, Cardano, Sui, Aptos, Sei, Celestia, Injective, THORChain, Cosmos, NEAR, Avalanche, TRON, Stellar, Litecoin, Polkadot, Filecoin, Hedera, Algorand, Monero, Tezos, Theta, and more
- **26 technical indicators**: RSI, MACD, Bollinger Bands, ATR, EMA, SMA, Stochastic, Williams %R, OBV, Volume Profile, MFI, Ichimoku Cloud, CMF, TSI, ADX, Parabolic SAR, CCI, Keltner Channels, ROC, VWAP, StochRSI, TRIX, KST, Elder-Ray Index, Fisher Transform, Mass Index
- **Divergence detection** — RSI/MACD price-divergence scanner (hidden/regular bullish/bearish)
- **ADX trend-strength filter** — signals below ADX 25 downgraded one confidence level
- **RSS news aggregation** from 11 feeds with signal extraction and relevance scoring
- **3-strategy signal engine**: momentum, mean-reversion, trend-following with dynamic weight tuning
- **DeFiLlama on-chain metrics**: protocol TVL, chain TVL, DEX fees
- **WebSocket real-time price streaming** on port 9878
- **SVG candlestick/dashboard charts** with professional shared-svg.ts rendering engine
- **XLSX/CSV/JSON/MD export** with frozen headers and conditional formatting
- **Warm daemon** for sub-50ms tool calls with TCP keep-alive
- **Health monitoring** with status endpoint
- **Cron automation** via `scripts/crypto-radar-collector.sh`
- **Enterprise ready** — circuit breaker, rate limiter, TTL cache, atomic writes, log rotation, SHA-256 checksums

## Tools (8 agent tools)

| Tool | Description |
|------|-------------|
| `crypto_radar_scan` | Scan token prices, technical indicators, and market data across all tracked chains |
| `crypto_radar_signals` | Generate composite trading signals from 3-strategy engine + divergence detection + ADX filter |
| `crypto_radar_news` | Fetch and analyze crypto RSS news with relevance scoring across 11 feeds |
| `crypto_radar_tokens` | List and manage tracked token whitelist — query by chain, symbol, or ID |
| `crypto_radar_chart` | Render SVG candlestick, line, or multi-panel dashboard chart for any tracked token |
| `crypto_radar_daemon` | Control the warm daemon (start/stop/status) for cached sub-50ms tool responses |
| `crypto_radar_onchain` | Query DeFiLlama on-chain metrics — protocol TVL, chain TVL, DEX fees |
| `crypto_radar_ws` | Subscribe to WebSocket real-time price streams (latest trade, 24h change) |

## Installation

### One-liner install
```bash
bash <(curl -fsSL https://raw.githubusercontent.com/ssdeanx/Hermes-Crypto-Radar/main/scripts/install.sh)
```

### Manual install for Hermes Agent
```bash
# Clone and build
git clone https://github.com/ssdeanx/Hermes-Crypto-Radar.git
cd Hermes-Crypto-Radar
npm install && npm run build

# Register as Hermes plugin
ln -sf "$PWD" ~/.hermes/plugins/crypto-radar
```

### Via npm (standalone CLI)
```bash
npm install -g hermes-crypto-radar
crypto-radar scan
```

### Cron Automation (every 2h)
The plugin ships with a production-ready cron collector script:

```bash
# Manual cron setup
crontab -e
# Add: 0 */2 * * * cd /path/to/hermes-crypto-radar && node dist/cli.js scan --dynamic 30 --onchain --no-news --format json --quiet

# Or use the ship-ready script directly:
bash scripts/crypto-radar-collector.sh
```

## Commands (CLI)

```bash
# Scan token prices with technical indicators
crypto-radar scan

# Generate trading signals (momentum, mean-reversion, trend-following)
crypto-radar signals

# Fetch and analyze crypto news from 11 RSS feeds
crypto-radar news

# Start warm daemon for fast tool calls
crypto-radar daemon

# Plot SVG candlestick chart for a token (e.g., BTC)
crypto-radar chart BTC --svg

# Export market data to XLSX/CSV/JSON/MD
crypto-radar export --format xlsx

# Query DeFiLlama on-chain metrics
crypto-radar onchain --protocols

# Run benchmark of scan performance
crypto-radar benchmark

# Backtest signal strategy against historical data
crypto-radar backtest
```

## Configuration

Edit `crypto-radar.json` in the plugin root or use `RADAR__*` environment variables:

- `tokens` — whitelist of tracked token symbols
- `rss_feeds` — RSS feed URLs for news (11 feeds default)
- `indicators` — technical indicator parameters (periods, multipliers)
- `strategyWeights` — signal strategy weight overrides (`momentum`, `mean-reversion`, `trend-following`)
- `timeframeWeights` — multi-timeframe aggregation weights (`15m`, `1h`, `4h`, `1d`)
- `defiLlamaEnabled` — enable DeFiLlama on-chain metrics
- `RADAR__DATA_DIR` — data/log directory (default: `~/.hermes/data/crypto-radar`)
- `RADAR__DAEMON_PORT` — daemon HTTP port (default: 9877)
- `RADAR__WS_PORT` — WebSocket stream port (default: 9878)
- `RADAR__WEBHOOK_URL` — Discord/Telegram webhook for price alerts
- `RADAR__LOG_RETENTION_DAYS` — auto-prune logs after N days

## License

MIT
