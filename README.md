# 🛰️ Hermes Crypto Radar

**Multi-chain crypto market intelligence — Hermes Agent plugin**

Tracks **32 tokens** across Solana, Polygon, and broad-market chains (BTC, ETH, BNB, XRP, DOGE, ADA). Fetches live Binance prices, computes technical indicators (RSI, MACD, Bollinger Bands, ATR, MFI), matches RSS news, runs a 3-strategy signal engine, and exports to JSON, CSV, Markdown, HTML tables, and Excel XLSX.

---

## Quick Start

```bash
npm install
npm run build
ln -sf "$PWD" ~/.hermes/plugins/crypto-radar
```

Verify:
```bash
node dist/cli.js scan --filter SOL --no-news --format json
```

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `scan` | Full market scan — prices, indicators, news, signals |
| `signals` | Composite trading signals snapshot |
| `news` | Crypto news matching tracked tokens |
| `tokens` | List all tracked tokens |
| `chart` | Generate ASCII sparkline or SVG chart for a token |
| `health` | System health checks (API, data dir, uptime) |
| `strategies` | List registered strategy modules with weights |
| `configure` | Print current configuration |

### Common Flags

| Flag | Type | Applies To | Description |
|------|------|-----------|-------------|
| `--filter` | `string[]` | scan, signals, news | Token symbols to include (e.g. `--filter SOL BTC`) |
| `--chain` | `string` | scan, tokens | Chain filter: `solana`, `polygon`, `multi` |
| `--format` | `string` | scan | Output: `table`, `json`, `csv`, `md`, `xlsx` |
| `--sort-by` | `string` | scan | Sort: `alpha` (default), `change`, `volume`, `momentum`, `signal` |
| `--alt-source` | | scan | Use CoinGecko as primary price source instead of Binance |
| `--no-news` | `boolean` | scan | Skip news fetching |
| `--no-tech` | `boolean` | scan | Skip technical indicators |
| `--no-log` | `boolean` | scan | Skip CSV file logging |
| `--quiet` | `boolean` | scan | Suppress table output (for scripting) |

### Examples

```bash
# Comprehensive scan by chain
node dist/cli.js scan --chain solana --format json

# Export to Excel
node dist/cli.js scan --filter SOL BTC ETH --format xlsx --no-news

# Signals view (lightweight)
node dist/cli.js signals --filter SOL

# Specific token chart
node dist/cli.js chart --symbol SOL --days 7

# Health check
node dist/cli.js health
```

---

## Technical Indicators

| Indicator | Window | Source |
|-----------|--------|--------|
| RSI | 14 periods | Closing prices |
| MACD | 12/26/9 | EMA cross + histogram |
| Bollinger Bands | 20/2 | SMA ± 2σ |
| ATR | 14 periods | True range % of price |
| MFI | 14 periods | Money Flow Index |
| Volume Trend | 20 vs 50 avg | Volume comparison |
| EMA50 Distance | 50 periods | Price vs EMA50 |

---

## Signal Engine

Enterprise-grade **3-strategy** signal aggregation:

| Strategy | Weight | Approach |
|----------|--------|----------|
| **Momentum** | 40% | Trending moves with volume + MACD confirmation |
| **Mean Reversion** | 20% | Overextended prices (RSI extremes, BB touches) |
| **Trend Following** | 40% | EMA alignment (20/50/200) + volume trends |

Output: `strong_buy` / `buy` / `neutral` / `sell` / `strong_sell` with 0–100% confidence.

---

## Hermes Plugin Tools

| Tool | Purpose |
|------|---------|
| `crypto_radar_scan` | Full market scan for agent context |
| `crypto_radar_signals` | Ranked trading signals |
| `crypto_radar_news` | Relevant news by token |
| `crypto_radar_tokens` | List tracked tokens |
| `crypto_radar_chart` | SVG chart as agent visual response |

All tools return structured JSON for agent reasoning. Register via `plugin.yaml` → symlink into `~/.hermes/plugins/`.

---

## Output Formats

| Format | Command | Description |
|--------|---------|-------------|
| `json` | `--format json` | Structured data for programmatic use |
| `csv` | `--format csv` | Spreadsheet-compatible rows |
| `md` | `--format md` | Markdown report |
| `table` | `--format table` | Terminal table (default) |
| `xlsx` | `--format xlsx` | Excel workbook with formatting |

XLSX output includes frozen headers, auto-column-width, and conditional green/red coloring on `priceChangePercent`.

---

## Requirements

- **Node.js** >= 20
- **Hermes Agent** (for plugin integration)
- No API keys required — uses public Binance REST API + RSS feeds
- CoinGecko optional fallback (free, no key needed)

---

## Development

```bash
npm run build      # TypeScript compile → dist/
npm test           # Run vitest suite (58 tests)
npm run test:watch # Watch mode for TDD
npm run clean      # rm -rf dist/
```

Full spec at [SPEC.md](SPEC.md). Enterprise audit at [CRYPTO-ENTERPRISE-AUDIT.md](CRYPTO-ENTERPRISE-AUDIT.md).

---

## Project Structure

```
src/
├── cli.ts              # Commander.js CLI entry
├── radar.ts            # Main enrichment pipeline
├── binance.ts          # Binance REST client
├── coingecko.ts        # CoinGecko fallback client
├── indicators.ts       # RSI, MACD, BB, ATR, MFI, EMA
├── news.ts             # RSS fetcher + relevance matcher
├── signals.ts          # Composite signal scoring
├── output.ts           # Formatters (table, JSON, CSV, MD)
├── xlsx-export.ts      # Excel export via exceljs
├── tokens.ts           # 32-token registry
├── types.ts            # All type definitions
├── core/               # Config, cache, errors, logger, rate-limiter
├── analysis/           # Strategy engine (momentum, MR, trend-follow)
├── io/                 # Chart generation (ASCII + SVG)
└── monitor/            # Health checks
```
