# 🛰️ Hermes Crypto Radar — SPEC

> **Project:** Hermes Agent Plugin — Multi-chain crypto market radar  
> **Status:** v2.0.0 · Marketplace Release  
> **Versioning:** [SemVer](https://semver.org/) — all changes tracked in this spec

---

## 1. Vision

A professional-grade Hermes Agent plugin for crypto market intelligence. Runs as a compiled TypeScript CLI wrapped in a Hermes Python plugin, giving the agent real-time market data, technical analysis, news signals, and composite trading signals for 49+ tokens across 31 chains.

**Goal:** Be a top-listed plugin on the [Hermes Plugin Marketplace](https://hermes-agent.nousresearch.com/) — the go-to crypto tool for Hermes users.

### Core Design Tenets

1. **Agent-first** — Tools return structured JSON that Hermes can reason about and incorporate into responses
2. **Multi-chain** — 31 chains: Solana, Polygon, Ethereum, BNB, Bitcoin, XRP, Cardano, Dogecoin, Cosmos, Sui, Aptos, Sei, Celestia, Injective, Thorchain, NEAR, TRON, Stellar, Avalanche, Litecoin, Bitcoin Cash, Hedera, Bittensor, Polkadot, Filecoin, Zcash, Monero, Algorand, Tezos, Theta + broader market
3. **Production data** — Real Binance spot prices, real RSS news feeds, real technical indicators
4. **Extensible** — Plugin can be extended with new chains, tokens, data sources, and visualizations without breaking existing tools
5. **Self-documenting** — Every tool has complete schema descriptions; the agent never has to guess parameters

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Hermes Agent                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Plugin: crypto-radar                     │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐         │   │
│  │  │scan tool │  │signals   │  │news tool   │ ...      │   │
│  │  │          │  │tool      │  │            │           │   │
│  │  └────┬─────┘  └────┬─────┘  └─────┬──────┘         │   │
│  │       │             │              │                 │   │
│  │  ┌────▼─────────────▼──────────────▼──────────────┐  │   │
│  │  │        plugin/__init__.py (Python bridge)       │  │   │
│  │  │        spawns node subprocess                   │  │   │
│  │  └────────────────┬────────────────────────────────┘  │   │
│  └───────────────────┼──────────────────────────────────┘   │
└──────────────────────┼──────────────────────────────────────┘
                       │
              ┌────────▼────────────────────────┐
              │    dist/cli.js                   │
              │    (Compiled TS, 24 files)       │
              │                                  │
              │  src/                            │
              │  ├── cli.ts        (Entry point)  │
              │  ├── index.ts      (Public API)   │
              │  ├── types.ts      (Type defs)    │
              │  ├── tokens.ts     (Token registry)│
              │  ├── binance.ts    (Binance API)   │
              │  ├── indicators.ts (RSI, MACD, BB) │
              │  ├── news.ts       (RSS matcher)   │
              │  ├── signals.ts    (Scoring)       │
              │  ├── radar.ts      (Main engine)   │
              │  ├── output.ts     (Formatters)    │
              │  ├── coingecko.ts  (Alt data src)  │
              │  ├── xlsx-export.ts(Excel export)  │
              │  ├── html-report.ts(HTML/PDF rpt)  │
              │  ├── ws.ts         (WebSocket)     │
              │  ├── webhook.ts    (Alert deliv)   │
              │  ├── core/         (Config, cache, │
              │  │                  errors, logger,│
              │  │                  rate-limiter)  │
              │  ├── analysis/     (Strategy eng.  │
              │  │                  momentum, mr,  │
              │  │                  trend-follow)  │
              │  ├── io/           (Charts: ASCII  │
              │  │                  + SVG, patterns)│
              │  └── monitor/      (Health,corr.)  │
              └────────────────────────────────────┘
```

### 2.1 Plugin Loading Flow

1. Hermes starts → discovers `~/.hermes/plugins/crypto-radar/plugin.yaml`
2. Plugin loader reads `kind: backend` → imports `plugin/__init__.py`
3. Calls `register(ctx)` → registers 4 tools into `crypto` toolset
4. Each tool's `check_fn` verifies `dist/cli.js` exists + node is available
5. On tool call → Python handler spawns `node dist/cli.js <command>` → returns JSON

---

## 3. Token Coverage

### 3.1 Current (v2.0.0) — 49+ tokens

| Chain | Tokens |
|-------|--------|
| **Solana** (15) | SOL, JUP, JTO, RAY, PYTH, BONK, KMNO, PUMP, RENDER, ORCA, FIDA, WIF, BOME, AUDIO, TRUMP |
| **Polygon/DeFi** (13) | POL, SUSHI, UNI, AAVE, CRV, LINK, QUICK, BAL, LDO, BAT, COMP, ZRO, GRT |
| **Multi/Broad** (6) | BTC, ETH, BNB, XRP, DOGE, ADA |
| **Cosmos/New L1s** (7) | SUI, APT, SEI, TIA, INJ, RUNE, ATOM |
| **Layer-1 Broader** (11) | NEAR, TRX, XLM, AVAX, LTC, BCH, HBAR, TAO, DOT, FIL, ZEC |
| **Ethereum Ecosystem** (10) | PEPE, WLD, ENA, FET, OP, ARB, AXS, JASMY, CVX, 1INCH |
| **Monero** (1) | XMR |
| **Algorand** (1) | ALGO |
| **BNB Ecosystem** (1) | CAKE |
| **TRON Ecosystem** (1) | JST |
| **Tezos** (1) | XTZ |
| **Theta Network** (1) | THETA |

**Total chains:** 31 — `solana`, `polygon`, `bnb`, `bitcoin`, `ethereum`, `dogecoin`, `xrp`, `cardano`, `sui`, `aptos`, `sei`, `celestia`, `injective`, `thorchain`, `cosmos`, `near`, `tron`, `stellar`, `avalanche`, `litecoin`, `bitcoin-cash`, `hedera`, `bittensor`, `polkadot`, `filecoin`, `zcash`, `monero`, `algorand`, `tezos`, `theta`

### 3.2 Expansion Plan

| Phase | Additions | Priority |
|-------|-----------|----------|
| v1.2 | SUI, APT, SEI, TIA (new L1s) | ✅ |
| v1.2 | INJ, RUNE, ATOM (cross-chain) | ✅ |
| v1.3 | Top 50 by volume (dynamic detection) | ✅ |
| v1.3 | 5 new indicators (Stochastic, Ichimoku, W%R, CMF, TSI) | ✅ |
| v2.0 | 10+ new tokens (broad L1s, monero, algorand, tezos, theta) | ✅ |
| v2.0 | 16+ additional indicators (ADX, PSAR, CCI, Keltner, ROC, VWAP, FI, ADL, etc.) | ✅ |
| v2.0 | New chains (monero, algorand, tezos, theta, hedera, etc.) | ✅ |
| v2.0 | Marketplace release — polished docs, badges, enterprise callout | ✅ |

---

## 4. Features

### 4.1 Implemented (v1.3.0)

| Feature | Status | Details | Version |
|---------|--------|---------|---------|
| Binance 24hr ticker | ✅ | All USDT pairs, timeout + retry + 429 backoff | v1.0 |
| Token enrichment | ✅ | Spread, VWAP distance, range position, book imbalance | v1.0 |
| Momentum scoring | ✅ | Price change + volume + spread + book imbalance | v1.0 |
| Technical indicators | ✅ | RSI, MFI, MACD, Bollinger Bands, ATR, volume trend, EMA50, OBV | v1.0 |
| News fetching | ✅ | 9 RSS feeds, headline/body matching, relevance scoring, poison filtering, dedup | v1.0 |
| Signal generation | ✅ | Composite score: 40% momentum + 40% technical + 20% news, alerts | v1.0 |
| CSV logging | ✅ | Append-only, header-on-first-write | v1.0 |
| CLI | ✅ | `scan`, `signals`, `news`, `tokens`, `chart`, `health`, `configure`, `strategies`, `daemon` | v1.0 |
| Hermes plugin | ✅ | 8 tools, JSON output, `check_fn` gating | v1.0 |
| Multi-chain | ✅ | Solana + Polygon + broad-market + Cosmos/L1s separation | v1.0 |
| Output formats | ✅ | Terminal table, CSV, JSON, Markdown, XLSX (Excel/Sheets) | v1.0 |
| **CoinGecko data source** | ✅ | Free API wired into scan pipeline via `--alt-source` flag, fallback for missing tokens | v1.1 |
| **XLSX export** | ✅ | Excel/Google Sheets native export via exceljs, `--format xlsx` | v1.1 |
| **CI pipeline** | ✅ | GitHub Actions builds on Node 20 & 22, runs tests, verifies dist | v1.1 |
| **Terminal sparkline charts** | ✅ | ASCII price charts via asciichart, configurable lookback/period | v1.0 |
| **SVG chart generation** | ✅ | Self-contained SVG price charts, multi-panel with RSI | v1.0 |
| **3-strategy signal engine** | ✅ | Momentum, Mean Reversion, Trend Following — weighted confidence voting | v1.0 |
| **Strategy aggregation** | ✅ | Weighted vote engine, per-strategy reasons, composite confidence 0–100% | v1.0 |
| **Health monitoring** | ✅ | Binance API, data directory, system resource checks, uptime tracking | v1.0 |
| **Configuration system** | ✅ | JSON config file + `RADAR__*` env vars, typed defaults | v1.0 |
| **Typed error classes** | ✅ | CryptoRadarError, NetworkError, RateLimitError, DataError, ConfigError | v1.0 |
| **Structured logging** | ✅ | Pino-style JSON logs to stderr, levels (trace–fatal), child loggers | v1.0 |
| **In-memory cache** | ✅ | TTL-based, memoize support, stats tracking, automatic expiry | v1.0 |
| **Rate limiter** | ✅ | Token-bucket algorithm, configurable max/window | v1.0 |
| **Multi-timeframe analysis** | ✅ | 15m, 1h, 4h, 1d klines + strategy eval per timeframe | v1.2 |
| **Cross-timeframe aggregation** | ✅ | Weighted vote (15m=0.10, 1h=0.25, 4h=0.30, 1d=0.35) | v1.2 |
| **Circuit breaker** | ✅ | CLOSED/OPEN/HALF-OPEN, failure threshold, cached-fallback | v1.2 |
| **Parallel kline fetching** | ✅ | Batches of 5, ~60% scan time reduction for 30+ tokens | v1.2 |
| **Parallel news feeds** | ✅ | Concurrency-4, news in ~2s instead of ~12s | v1.2 |
| **Atomic file writes** | ✅ | `.tmp` → `fs.renameSync()`, no partial-write data loss | v1.2 |
| **Log rotation** | ✅ | 10MB rotate, gzip, keep 5 archives | v1.2 |
| **OBV indicator** | ✅ | On-Balance Volume computed from klines | v1.2 |
| **Stochastic Oscillator** | ✅ | %K/%D with 14/3/3 period defaults | v1.3 |
| **Ichimoku Cloud** | ✅ | Conversion/base line, span A/B, lagging span | v1.3 |
| **Williams %R** | ✅ | 14-period Williams %R (-100 to 0) | v1.3 |
| **Chaikin Money Flow** | ✅ | 20-period CMF from high/low/close/volume | v1.3 |
| **True Strength Index** | ✅ | 25/13 double-smoothed TSI | v1.3 |
| **DeFiLlama on-chain metrics** | ✅ | Protocol TVL, chain TVL, fees (1d/7d/30d), on-chain prices | v1.3 |
| **On-chain signal boost** | ✅ | 0–15% confidence boost based on protocol TVL strength | v1.3 |
| **Dynamic top-50 scan** | ✅ | `--dynamic [count]` auto-discovers top N by volume | v1.3 |
| **Strategy weight overrides** | ✅ | `radar.config.json` + `RADAR__*` env overrides | v1.3 |
| **ESLint + Prettier** | ✅ | Flat config, strict TS rules, auto-fix | v1.3 |
| **SVG chart overhaul** | ✅ | CSS-in-style, gradients, viewBox, tooltips, crosshairs, a11y | v1.3 |
| **Daemon mode** | ✅ | Warm HTTP daemon for sub-50ms tool calls | v1.3 |
| **Auto-dynamic scan** | ✅ | Scan defaults to top-30 tokens by volume when no filter given | v1.3 |
| **Backtesting engine** | ✅ | Signal accuracy backtesting with weight optimization | v1.3 |
| **Candlestick pattern recognition** | ✅ | 16 patterns: doji, hammer, engulfing, morning/evening star, etc. | v1.3 |
| **Chart comparison overlay** | ✅ | Multi-token SVG comparison chart with normalized returns | v1.3 |
| **Correlation engine** | ✅ | N×N Pearson correlation matrix between tracked tokens | v1.3 |
| **Data retention policy** | ✅ | Configurable log pruning by age + SHA-256 file checksums | v1.3 |
| **Discord/Telegram webhooks** | ✅ | Price alert notifications via Discord webhook or Telegram bot | v1.3 |
| **Fuzz testing suite** | ✅ | 130 edge-case tests for all indicators (NaN, Infinity, empty) | v1.3 |
| **HTML/PDF report** | ✅ | Self-contained dark-theme HTML report generator | v1.3 |
| **Market regime detection** | ✅ | Trending/Ranging/Volatile/Quiet classification via ADX+BB+ATR | v1.3 |
| **npm publication** | ✅ | `hermes-crypto-radar@1.3.0` on npm registry | v1.3 |
| **Support/Resistance detection** | ✅ | Pivot points, cluster detection, volume confirmation, psych levels | v1.3 |
| **Token search CLI** | ✅ | `search` command finds tokens by symbol/name/chain | v1.3 |
| **Volume Profile analysis** | ✅ | Market Profile: POC, HVN/LVN, value area, SVG histogram | v1.3 |
| **Webhook notifications** | ✅ | Discord + Telegram alert delivery | v1.3 |

### 4.2 Planned (Roadmap)

| Feature | Status | Details | Target |
|---------|--------|---------|--------|
| Multi-timeframe analysis | ✅ | 15m, 1h, 4h, 1d klines + strategy eval per timeframe | v1.2 ✅ |
| On-chain metrics | ✅ | TVL, volume, fees via DeFiLlama | v1.3 ✅ |
| Dynamic volume token discovery | ✅ | `--dynamic [count]` top-N by 24h volume | v1.3 ✅ |
| User-config token list | ✅ | `radar.config.json` per user | v1.2 ✅ |
| Strategy config overrides | ✅ | Adjust weights/params via config file + env vars | v1.3 ✅ |
| Hermes chart tool | ✅ | SVG charts delivered as agent visual responses | v1.1 ✅ |
| Daemon tool | ✅ | Warm daemon for sub-50ms tool calls | v1.3 ✅ |
| WebSocket live prices | ✅ | Binance WS for real-time updates | v2.0.0 ✅ |
| Expanded indicator suite | ✅ | 16 new indicators (ADX, PSAR, CCI, Keltner, ROC, VWAP, FI, ADL, Chaikin Osc, StochRSI, TRIX, KST, Elder-Ray, Fisher, Mass Index) | v2.0.0 ✅ |
| Expanded token roster | ✅ | 11 new L1 + ecosystem tokens across 31 chains | v2.0.0 ✅ |
| Marketplace-ready docs | ✅ | Professional README, comparison table, benchmarks, roadmap | v2.0.0 ✅ |
| **Portfolio tracking** | 🔜 | User-defined holdings → P&L, position sizing | v2.0.1 |
| **Multi-user watchlists** | 🔜 | Shared token lists via config | v2.0.1 |
| **AI-driven signal suggestions** | 🔜 | LLM-powered trade ideas from market context | v2.0.2 |
| **Custom indicator scripting** | 🔜 | User-defined indicators in TS | v2.0.3 |
| **Backtesting dashboard** | 🔜 | Web UI for strategy optimization | v2.1.0 |
| **Real-time alert engine** | 🔜 | Price thresholds, indicator crossovers | v2.1.0 |
| **DEX aggregation** | 🔜 | Uniswap, Raydium, Orca, Jupiter | v2.1.0 |
| **Social sentiment analysis** | 🔜 | X/Twitter, Reddit, Discord | v2.2.0 |
| **Paper trading simulator** | 🔜 | Virtual portfolio with signal validation | v2.2.0 |
| **Mobile companion** | 🔜 | Hermes mobile plugin | v3.0.0 |

---

## 5. Tool Reference

### 5.1 `crypto_radar_scan`

Full market scan. Fetches prices, indicators, news, on-chain metrics (if enabled), and generates signals.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `filter` | string[] | — | Token symbols to filter (e.g. `["SOL", "BTC"]`) |
| `chain` | string | — | Chain filter: `solana`, `polygon`, `bnb`, etc. |
| `sort_by` | string | `momentum` | Sort: `alpha`, `change`, `volume`, `momentum`, `signal` |
| `no_tech` | boolean | `false` | Skip technical indicators |
| `no_news` | boolean | `false` | Skip news fetching |
| `no_log` | boolean | `false` | Skip CSV logging |

**Returns:** JSON with `tickers[]` (enriched market data), `technicals{}` (indicators by symbol), `news[]` (matched articles), `signals[]` (composite scores), `onchain{}` (DeFiLlama metrics), `run{}` (metadata).

### 5.2 `crypto_radar_signals`

Quick signal snapshot. Lighter than a full scan.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `filter` | string[] | — | Token symbols to include |

**Returns:** JSON with ranked `signals[]` — each has symbol, chain, price, scores, alerts.

### 5.3 `crypto_radar_news`

Fetch and score crypto news against tracked tokens.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `filter` | string[] | — | Token symbols to filter news for |

**Returns:** JSON with `news[]` — matched articles with headline, description, source, relevance score.

### 5.4 `crypto_radar_tokens`

List all tracked tokens.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `chain` | string | — | Filter by chain |

**Returns:** JSON with `tokens[]` — symbol, name, chain for each.

### 5.5 `crypto_radar_chart`

Generate SVG charts for agent visual responses. Supports line, candlestick, dashboard, and sparkline chart types.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `symbol` | string | — | Token symbol (e.g. SOL, BTC) |
| `type` | string | `sparkline` | Chart type: `sparkline`, `ma`, `svg`, `dashboard`, `candlestick` |
| `period` | string | `1h` | Kline interval: `15m`, `1h`, `4h`, `1d` |
| `lookback` | number | `100` | Number of candles to display |
| `width` | number | `600` | SVG width in pixels |

**Returns:** SVG markup string with responsive viewBox, CSS gradients, tooltips, and crosshair effects.

### 5.6 `crypto_radar_daemon`

Manage the warm HTTP daemon for sub-50ms tool calls.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `action` | string | `status` | Action: `start`, `stop`, `status` |
| `port` | number | `9877` | HTTP port for the daemon |
| `refresh_sec` | number | `300` | Cache refresh interval in seconds |

**Returns:** JSON with daemon status, cache state, and uptime.

### 5.7 `crypto_radar_onchain`

On-chain metrics from DeFiLlama: protocol TVL, chain TVL, fees.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `filter` | string[] | — | Token symbols to filter |

**Returns:** JSON with onchain metrics — protocol TVL, chain TVL, fees (1d/7d/30d), and on-chain prices per token.

### 5.8 `crypto_radar_ws`

WebSocket stream management for real-time prices.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `action` | string | `status` | Action: `start`, `stop`, `status` |

**Returns:** JSON with WebSocket connection status, active streams, and uptime.

---

## 6. Data Flow

### 6.1 Scan Pipeline

```
Agent calls crypto_radar_scan()
  → plugin/__init__.py spawns node dist/cli.js scan --format json
    → radar.ts: runRadar()
      → binance.ts: fetchAllTickers()          [GET ticker/24hr for 49+ pairs, parallel batches of 5]
      → indicators.ts: computeAllIndicators()  [Parallel kline fetches, compute RSI/MACD/BB/ATR/Stochastic/Ichimoku/CMF/TSI/W%R/ADX/PSAR/CCI/Keltner/ROC/VWAP/FI/ADL/ChaikinOsc/StochRSI/TRIX/KST/ElderRay/Fisher/MassIndex]
      → news.ts: fetchAndMatchNews()           [11 RSS feeds, concurrency-4, headline/body/sentiment scoring]
      → defillama.ts: fetchOnChainMetrics()    [DeFiLlama: protocol TVL, chain TVL, fees 1d/7d/30d]
      → signals.ts: computeSignals()           [Weighted composite: momentum 40% + technical 40% + news 20%, on-chain 0-15% boost]
      → output.ts: format → JSON
  → JSON returned to agent context
  → Agent reasons about data, responds to user
```

### 6.2 News Scoring Model

| Signal | Weight | Description |
|--------|--------|-------------|
| Token name in headline | 1.0 | Direct mention, strongest signal |
| Ticker in headline + crypto context | 0.7 | e.g. "SOL surges 10%" |
| Token name in description | 0.7 | Mentioned in article body |
| Ticker symbol in headline | 0.5 | Bare symbol match |
| Ticker with $ prefix in description | 0.5 | e.g. "$SOL mentioned" |
| Source tier multiplier | 0.4–1.0 | CoinTelegraph/CoinDesk/Decrypt = 1.0, NullTX = 0.4 |
| Sentiment keyword match | +0.2 | Bullish/bearish sentiment keywords in headline |
| Recency bonus | +0.1–0.3 | Articles <6h old get +0.3, <24h +0.1 |
| **Filter** | | Poison headlines dropped, sub-0.5 relevance filtered |

### 6.3 Signal Scoring Model

| Component | Weight | Inputs |
|-----------|--------|--------|
| Momentum | 40% | Price change, spread, volume, book imbalance, range position |
| Technical | 40% | RSI, MACD, BB position, volume trend, EMA50 distance, 26+ indicators |
| News | 20% | Recent article count × relevance, sentiment keywords, recency bonus |
| On-chain boost | 0–15% | Protocol TVL strength (DeFiLlama) added to composite score |

---

## 6b. Strategy Engine (Enterprise)

The strategy engine runs **3 signal strategies** per token and aggregates them into a single composite signal with confidence scoring.

### Strategy Weights

| Strategy | Weight | Description |
|----------|--------|-------------|
| **Momentum** | 40% | Detects strong trending moves with volume confirmation and MACD alignment |
| **Mean Reversion** | 20% | Identifies overextended prices likely to revert (RSI extremes, BB touch) |
| **Trend Following** | 40% | Identifies established trends via EMA alignment (20/50/200) and volume |

### How It Works

1. Each strategy receives market context (ticker, technicals, news, klines)
2. Each returns a signal: direction (`buy`/`sell`/`neutral`/`strong_buy`/`strong_sell`) + confidence (0.0–1.0) + human-readable reason
3. Engine aggregates via weighted voting — direction wins by combined weight, composite confidence is weighted average
4. Alerts are collected per-token (dip/pump, overbought/oversold, high volume, news coverage)

### Signal Direction Mapping

| Scenario | Direction Example |
|----------|-------------------|
| Momentum + Trend aligned, high confidence | `strong_buy` |
| Momentum only, moderate confidence | `buy` |
| Conflicting strategies | `neutral` |
| Mean reversion + oversold | `buy` (counter-trend) |
| All bearish | `sell` / `strong_sell` |

---

## 7. Output Schema

### 7.1 CSV Log (`crypto-radar-log.csv`)

```
run_id,ts_utc,date_et,symbol,chain,lastPrice,bidPrice,bidQty,askPrice,askQty,
spreadPct,openPrice,highPrice,lowPrice,prevClosePrice,priceChangePercent,
weightedAvgPrice,priceChange,volume,quoteVolume,count,lastQty,vwapDistPct,
rangePosPct,bookImbalance,volVsAvg,obv,momentum,alerts,openTime,closeTime,source
```

### 7.2 News Log (`crypto-radar-news.csv`)

```
run_id,ts_utc,symbol,headline,description,source,domain,relevance
```

### 7.3 Signal JSON (tool output)

```json
{
  "symbol": "SOL",
  "chain": "solana",
  "lastPrice": 145.32,
  "priceChangePercent": 3.45,
  "momentumScore": 72.5,
  "technicalScore": 65.0,
  "newsScore": 40.0,
  "compositeScore": 63.0,
  "alerts": ["High volume", "News: 3 articles"],
  "timestamp": "2026-07-02T15:30:00Z"
}
```

---

## 8. Installation

### 8.1 From Source

```bash
# Clone/enter the project
cd hermes-crypto-radar

# Install deps and build
npm install
npm run build

# Register with Hermes
ln -sf "$PWD" ~/.hermes/plugins/crypto-radar

# Verify
hermes plugins list | grep crypto-radar
hermes tools list | grep crypto_radar
```

### 8.2 Manual Hermes Registration

```bash
hermes plugins install /path/to/hermes-crypto-radar
# Or from project root:
hermes plugins install .
```

### 8.3 Quick Verification

```bash
hermes plugins list | grep crypto-radar
hermes tools list | grep crypto_radar
node dist/cli.js scan --filter SOL --no-news --format json   # Quick scan test
node dist/cli.js health                                       # System health check
```

### 8.4 Skill-based Alternative (if plugin not accepted)

The project also ships as a Hermes skill that wraps the CLI:

```bash
hermes skills install ./crypto-radar-skill.md
```

---

## 9. Development

### 9.1 Commands

```bash
npm run build        # Compile TS → dist/
npm run watch        # Watch mode
npm run start        # Run CLI (default: scan)
npm test             # Run vitest suite (332+ tests)
npm run test:watch   # Watch mode for TDD
npm run lint         # ESLint check
npm run lint:fix     # ESLint auto-fix
npm run format       # Prettier check
npm run format:fix   # Prettier auto-format
npm run clean        # Remove dist/
npm run daemon       # Start warm daemon
```

### 9.2 Project Structure

```
hermes-crypto-radar/
├── src/
│   ├── cli.ts              # CLI entry point (Commander)
│   ├── index.ts            # Public API exports
│   ├── types.ts            # Type definitions
│   ├── tokens.ts           # Token registry (49+ tokens, 31 chains)
│   ├── binance.ts          # Binance API client
│   ├── coingecko.ts        # CoinGecko API client (alt data source)
│   ├── indicators.ts       # Technical indicators (RSI, MACD, BB, ATR, MFI, OBV, Stochastic, Ichimoku, W%R, CMF, TSI, ADX, PSAR, CCI, Keltner, ROC, VWAP, FI, ADL, ChaikinOsc, StochRSI, TRIX, KST, ElderRay, Fisher, MassIndex)
│   ├── news.ts             # RSS news fetcher + matcher
│   ├── signals.ts          # Composite signal scoring
│   ├── output.ts           # Formatters (CSV, JSON, MD, table, XLSX)
│   ├── radar.ts            # Main radar engine
│   ├── xlsx-export.ts      # Excel/Sheets export via exceljs
│   ├── html-report.ts      # HTML/PDF report generator
│   ├── ws.ts               # WebSocket live price streams
│   ├── webhook.ts          # Discord/Telegram alert delivery
│   ├── core/               # Enterprise infrastructure
│   │   ├── config.ts       # Typed config (file + env + defaults)
│   │   ├── errors.ts       # 6 typed error classes
│   │   ├── cache.ts        # TTL-based in-memory cache
│   │   ├── rate-limiter.ts # Token-bucket rate limiter
│   │   ├── logger.ts       # Structured JSON logger (6 levels)
│   │   └── index.ts        # Core barrel exports
│   ├── analysis/           # Strategy signal engine
│   │   ├── strategies.ts   # Strategy interface + types
│   │   ├── engine.ts       # Weighted voting engine
│   │   ├── momentum.ts     # Momentum strategy (40%)
│   │   ├── mean-reversion.ts # Mean reversion (20%)
│   │   └── trend-following.ts # Trend following (40%)
│   ├── io/                 # Visual output
│   │   ├── charts.ts       # ASCII sparklines + SVG chart gen
│   │   └── patterns.ts     # Candlestick pattern recognition (16 patterns)
│   └── monitor/            # System health
│       ├── health.ts       # Health checks (API, data, system)
│       ├── correlation.ts  # N×N Pearson correlation matrix
│       └── regression.ts   # Market regime classification
├── plugin/
│   └── __init__.py         # Hermes plugin (Python bridge)
├── plugin.yaml             # Plugin metadata
├── data/                   # Log output directory
├── .github/workflows/      # CI pipeline
├── SPEC.md                 # This file
├── README.md               # User-facing docs
├── package.json
└── tsconfig.json
```

### 9.3 Adding a New Token

Edit `src/tokens.ts`:

```typescript
'my-token': { id: 'my-token', sym: 'MYT', name: 'My Token', chain: 'solana' },
```

Rebuild: `npm run build`

### 9.4 Adding a New Tool

1. Add handler function in `plugin/__init__.py`
2. Add schema dict in `plugin/__init__.py`
3. Add to `_TOOLS` tuple
4. Add name to `provides_tools` in `plugin.yaml`

---

## 10. Quality Standards

- **All tools return JSON** — never raw text or unstructured output
- **All errors caught** — no unhandled rejections in production paths
- **All network calls have timeouts + retries** — Binance 429 handling, feed timeouts
- **Minimal deps** — each declared dependency is actually imported; no dead dependencies
- **CI pipeline** — tests run on every PR via GitHub Actions; merge blocked on failing checks
- **Hermes conventions** — tools registered via `register(ctx)`, gated by `check_fn`, `toolset` in `plugin.yaml`

---

## 11. Publishing to Hermes Marketplace

To get the plugin listed on the Hermes map/registry:

1. **Package as tarball**: `tar -czf crypto-radar-1.0.0.tar.gz --exclude=node_modules --exclude=dist --exclude=data .`
2. **Publish via Hermes**: `hermes skills publish ./crypto-radar-skill.md`
3. **Or submit plugin** to the Hermes repo via PR to `plugins/` directory
4. **Promote** in Nous Research Discord (`#plugins-skills-and-skins`)
5. **User demand** drives listing rank — documented features + clean API

---

## 12. Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-02 | Initial release — 32 tokens, Binance prices, tech indicators, news, signals, 4 Hermes tools, CSV/JSON/MD output |
| 1.1.0 | 2026-07-02 | News domain extraction fix, SOURCE_TIERS bug fix, multi-line CSV quoting, XLSX export, CoinGecko API + pipeline wiring, kline caching, dead dep cleanup, SPEC/README docs overhaul, vitest test suite (58 tests), CI pipeline, deterministic integration tests, XLSX error handling, XRP CoinGecko ID fix |
| 1.2.0 | 2026-07-02 | Circuit breaker, parallel kline/news fetching, atomic writes, log rotation, multi-timeframe analysis (15m/1h/4h/1d), cross-timeframe strategy aggregation, OBV indicator, 7 new tokens (SUI/APT/SEI/TIA/INJ/RUNE/ATOM), config auto-discovery, coverage gate, 155 tests, pre-commit hook, full JSDoc |
| 1.3.0 | 2026-07-03 | 5 new indicators (Stochastic, Ichimoku, Williams %R, CMF, TSI), DeFiLlama on-chain metrics + signal boost, dynamic top-50 volume scan, auto-dynamic scan (default top-30), strategy weight config overrides, SVG chart overhaul (gradients, viewBox, tooltips, crosshairs, a11y), daemon mode, eslint/prettier, backtesting engine, candlestick pattern recognition (16 patterns), chart comparison overlay, correlation engine, data retention policy, Discord/Telegram webhooks, fuzz testing suite (130 tests), HTML/PDF report, market regime detection (ADX+BB+ATR), npm publication, support/resistance detection, token search CLI, Volume Profile analysis, webhook notifications, .env.example, .npmignore, package.json SEO, standardized data dir, 332 tests |
| 1.4.0 | 2026-07-04 | Enterprise marketplace polish: plugin.yaml toolset+crypto, enhanced .env.example (daemon/WS/webhook/retention vars), TypeScript strict mode hardening (noUnusedLocals, noUnusedParameters, noImplicitOverride), enhanced typedoc.json (validation, categorize, sidebarLinks, searchInComments), enhanced package.json scripts (prebuild, postbuild, typecheck, coverage, postversion), npm metadata (funding, publishConfig, engines.npm, categories), CHANGELOG.md v1.4.0 entry, CITATION.cff bump, all documentation updated to v1.4.0, marketplace readiness checklist |
| **2.0.0** | **2026-07-04** | **Marketplace release — major expansion**: 16 new indicators (ADX, Parabolic SAR, CCI, Keltner Channels, ROC, VWAP, Force Index, ADL, Chaikin Oscillator, StochRSI, TRIX, KST, Elder-Ray, Fisher Transform, Mass Index), 11 new tokens (NEAR, TRX, XLM, AVAX, LTC, BCH, HBAR, TAO, DOT, FIL, ZEC) + TRUMP + additional ecosystem tokens, 5 new chains (monero, algorand, tezos, theta + hedera), WebSocket live price streams, HTML self-contained report generator, professional README overhaul (comparison table, benchmarks, developer API section, roadmap, enterprise callout, use cases), SPEC.md updated for 49+ tokens × 31 chains × 26+ indicators, marketplace badges (npm downloads, GitHub stars), quick start guide with GIF placeholder |

---

## 13. Future Research Areas

- ~~Solana DEX + Jupiter aggregator~~ ✅ Completed v1.3.0
- ~~DeFiLlama integration~~ ✅ Completed v1.3.0
- ~~CoinGecko API~~ ✅ Completed v1.1.0
- ~~WebSocket live prices~~ ✅ Completed v2.0.0
- ~~OHLCV chart generation~~ ✅ Completed v1.0 (sparklines) + v1.3 (SVG overhaul)
- **Machine learning signals** — pattern recognition on kline data using trained models
- **Backtesting dashboard** — web UI for strategy optimization
- **Social sentiment** — X/Twitter, Reddit mentions for signal generation
- **Portfolio tracking** — user-defined holdings → P&L tracking
- **Cross-chain DEX aggregation** — Uniswap, Raydium, Orca integration
- **Paper trading engine** — simulated portfolio with real signals
- **AI-driven trade suggestions** — LLM reasoning over market context
