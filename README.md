# 🛰️ Hermes Crypto Radar

**Multi-chain crypto market radar plugin for Hermes Agent**

Tracks 30+ tokens across Solana, Polygon, and broad-market (BTC, ETH, BNB, XRP, DOGE, ADA). Live Binance prices, technical indicators (RSI, MACD, Bollinger Bands, ATR), crypto news matching, and composite trading signals — all accessible through 4 Hermes agent tools.

## Quick Start

```bash
npm install && npm run build
ln -sf "$PWD" ~/.hermes/plugins/crypto-radar
```

## Usage

```bash
# Scan all tokens
node dist/cli.js scan

# Filter by token or chain
node dist/cli.js scan --filter SOL BTC ETH
node dist/cli.js scan --chain solana

# Signals mode
node dist/cli.js signals

# Output formats
node dist/cli.js scan --format json
node dist/cli.js scan --format csv
node dist/cli.js scan --format md
```

See [SPEC.md](SPEC.md) for full documentation.

## Tools

| Tool | Description |
|------|-------------|
| `crypto_radar_scan` | Full market scan — prices, indicators, news, signals |
| `crypto_radar_signals` | Composite trading signals (momentum + technical + news) |
| `crypto_radar_news` | Crypto news matching tracked tokens |
| `crypto_radar_tokens` | List tracked tokens |

## Requirements

- Node.js >= 20
- Hermes Agent (for plugin integration)
- No API keys required (uses public Binance data + RSS feeds)
