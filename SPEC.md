# 🛰️ Hermes Crypto Radar — SPEC

> **Project:** Hermes Agent Plugin — Multi-chain crypto market radar  
> **Status:** v1.0.0 · MVP  
> **Versioning:** [SemVer](https://semver.org/) — all changes tracked in this spec

---

## 1. Vision

A professional-grade Hermes Agent plugin for crypto market intelligence. Runs as a compiled TypeScript CLI wrapped in a Hermes Python plugin, giving the agent real-time market data, technical analysis, news signals, and composite trading signals for 30+ tokens across multiple chains.

**Goal:** Be a top-listed plugin on the [Hermes Plugin Marketplace](https://hermes-agent.nousresearch.com/) — the go-to crypto tool for Hermes users.

### Core Design Tenets

1. **Agent-first** — Tools return structured JSON that Hermes can reason about and incorporate into responses
2. **Multi-chain** — Solana, Polygon, BNB, and broad-market (BTC, ETH, XRP, DOGE, ADA)
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
              │  ├── core/         (Config, cache, │
              │  │                  errors, logger,│
              │  │                  rate-limiter)  │
              │  ├── analysis/     (Strategy eng.  │
              │  │                  momentum, mr,  │
              │  │                  trend-follow)  │
              │  ├── io/           (Charts: ASCII  │
              │  │                  + SVG)          │
              │  └── monitor/      (Health checks) │
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

### 3.1 Current (v1.0.0) — 32 tokens

| Chain | Tokens |
|-------|--------|
| **Solana** (13) | SOL, JUP, JTO, RAY, PYTH, BONK, KMNO, PUMP, RENDER, ORCA, FIDA, WIF, BOME, AUDIO |
| **Polygon/DeFi** (13) | POL, SUSHI, UNI, AAVE, CRV, LINK, QUICK, BAL, LDO, BAT, COMP, ZRO, GRT |
| **Multi** (7) | BTC, ETH, BNB, XRP, DOGE, ADA |

### 3.2 Expansion Plan

| Phase | Additions | Priority |
|-------|-----------|----------|
| v1.1 | SUI, APT, SEI, TIA (new L1s) | High |
| v1.2 | INJ, RUNE, ATOM (cross-chain) | Medium |
| v1.3 | Top 50 by volume (dynamic detection) | Medium |
| v2.0 | User-configurable token list (config file) | High |

---

## 4. Features

### 4.1 Implemented (v1.0.0)

| Feature | Status | Details |
|---------|--------|---------|
| Binance 24hr ticker | ✅ | All USDT pairs, timeout + retry + 429 backoff |
| Token enrichment | ✅ | Spread, VWAP distance, range position, book imbalance |
| Momentum scoring | ✅ | Price change + volume + spread + book imbalance |
| Technical indicators | ✅ | RSI, MFI, MACD, Bollinger Bands, ATR, volume trend, EMA50 |
| News fetching | ✅ | 9 RSS feeds, headline/body matching, relevance scoring, poison filtering, dedup |
| Signal generation | ✅ | Composite score: 40% momentum + 40% technical + 20% news, alerts |
| CSV logging | ✅ | Append-only, header-on-first-write |
| CLI | ✅ | `scan`, `signals`, `news`, `tokens`, `chart`, `health`, `configure`, `strategies` + flags |
| Hermes plugin | ✅ | 4 tools, JSON output, `check_fn` gating |
| Multi-chain | ✅ | Solana + Polygon + broad-market separation |
| Output formats | ✅ | Terminal table, CSV, JSON, Markdown, XLSX (Excel/Sheets) |
| **CoinGecko data source** | 🔜 | Free API module created, not yet wired into scan pipeline |
| **XLSX export** | ✅ | Excel/Google Sheets native export via exceljs, `--format xlsx` |
| **CI pipeline** | 🔜 | GitHub Actions workflow defined, pending org repo setup |
| **Terminal sparkline charts** | ✅ | ASCII price charts via asciichart, configurable lookback/period |
| **SVG chart generation** | ✅ | Self-contained SVG price charts, multi-panel with RSI |
| **3-strategy signal engine** | ✅ | Momentum, Mean Reversion, Trend Following — weighted confidence voting |
| **Strategy aggregation** | ✅ | Weighted vote engine, per-strategy reasons, composite confidence 0–100% |
| **Health monitoring** | ✅ | Binance API, data directory, system resource checks, uptime tracking |
| **Configuration system** | ✅ | JSON config file + `RADAR__*` env vars, typed defaults |
| **Typed error classes** | ✅ | CryptoRadarError, NetworkError, RateLimitError, DataError, ConfigError |
| **Structured logging** | ✅ | Pino-style JSON logs to stderr, levels (trace–fatal), child loggers |
| **In-memory cache** | ✅ | TTL-based, memoize support, stats tracking, automatic expiry |
| **Rate limiter** | ✅ | Token-bucket algorithm, configurable max/window |

### 4.2 Planned (Roadmap)

| Feature | Status | Details | Target |
|---------|--------|---------|--------|
| Multi-timeframe analysis | 🔜 | 15m, 1h, 4h, 1d klines + strategy eval per timeframe | v1.2 |
| CoinGecko data source | 🔜 | Fallback/alternative prices via free CoinGecko API | v1.1 |
| XLSX export | 🔜 | Excel/Google Sheets native export | v1.1 |
| CI pipeline | 🔜 | GitHub Actions: build, test, lint on every PR | v1.1 |
| User-config token list | 🔜 | `radar.config.json` per user | v1.1 |
| WebSocket live prices | 🔜 | Binance WS for real-time updates | v1.2 |
| Portfolio tracking | 🔜 | User-defined holdings → P&L | v1.2 |
| Price alerts | 🔜 | Threshold-based notification via Hermes gateway | v1.2 |
| DEX data (Jupiter) | 🔜 | Solana DEX prices via Jupiter API | v1.2 |
| Backtesting engine | 🔜 | Test strategies against historical data | v1.3 |
| On-chain metrics | 🔜 | TVL, volume, fees via DeFiLlama | v1.3 |
| Sentiment analysis | 🔜 | AI-powered news sentiment scoring | v1.3 |
| Strategy config UI | 🔜 | Adjust weights/params via config file | v1.1 |
| Hermes chart tool | 🔜 | SVG charts delivered as agent visual responses | v1.1 |
| Plugin marketplace publish | 🔜 | Publish to `hermes skills publish` | v1.1 |

---

## 5. Tool Reference

### 5.1 `crypto_radar_scan`

Full market scan. Fetches prices, indicators, news, and generates signals.

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `filter` | string[] | — | Token symbols to filter (e.g. `["SOL", "BTC"]`) |
| `chain` | string | — | Chain filter: `solana`, `polygon`, `bnb`, etc. |
| `sort_by` | string | `momentum` | Sort: `alpha`, `change`, `volume`, `momentum` |
| `no_tech` | boolean | `false` | Skip technical indicators |
| `no_news` | boolean | `false` | Skip news fetching |
| `no_log` | boolean | `false` | Skip CSV logging |

**Returns:** JSON with `tickers[]` (enriched market data), `technicals{}` (indicators by symbol), `news[]` (matched articles), `signals[]` (composite scores), `run{}` (metadata).

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

---

## 6. Data Flow

### 6.1 Scan Pipeline

```
Agent calls crypto_radar_scan()
  → plugin/__init__.py spawns node dist/cli.js scan --format json
    → radar.ts: runRadar()
      → binance.ts: fetchAllTickers()     [GET ticker/24hr for 30 pairs]
      → for each token:
          → indicators.ts: computeAllIndicators()  [GET klines, compute RSI/MACD/BB/ATR]
      → news.ts: fetchAndMatchNews()     [GET 9 RSS feeds, parse, match, score]
      → signals.ts: computeSignals()     [weighted composite scores]
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
| **Filter** | | Poison headlines dropped, sub-0.5 relevance filtered |

### 6.3 Signal Scoring Model

| Component | Weight | Inputs |
|-----------|--------|--------|
| Momentum | 40% | Price change, spread, volume, book imbalance, range position |
| Technical | 40% | RSI, MACD, BB position, volume trend, EMA50 distance |
| News | 20% | Recent article count × relevance |

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

```
hermes plugins install /path/to/hermes-crypto-radar
```

### 8.3 Skill-based Alternative (if plugin not accepted)

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
npm run test         # Run test suite
npm run clean        # Remove dist/
```

### 9.2 Project Structure

```
hermes-crypto-radar/
├── src/
│   ├── cli.ts              # CLI entry point (Commander)
│   ├── index.ts            # Public API exports
│   ├── types.ts            # Type definitions
│   ├── tokens.ts           # Token registry (32 tokens + growing)
│   ├── binance.ts          # Binance API client
│   ├── coingecko.ts        # CoinGecko API client (alt data source)
│   ├── indicators.ts       # Technical indicators (RSI, MACD, BB, ATR, MFI)
│   ├── news.ts             # RSS news fetcher + matcher
│   ├── signals.ts          # Composite signal scoring
│   ├── output.ts           # Formatters (CSV, JSON, MD, table, XLSX)
│   ├── radar.ts            # Main radar engine
│   ├── xlsx-export.ts      # Excel/Sheets export via exceljs
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
│   │   └── charts.ts       # ASCII sparklines + SVG chart gen
│   └── monitor/            # System health
│       └── health.ts       # Health checks (API, data, system)
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
| 1.1.0 | 2026-07-02 | News domain extraction fix, SOURCE_TIERS bug fix, multi-line CSV quoting, XLSX export, CoinGecko API module, kline caching (eliminated double-fetch), dead dep cleanup, SPEC docs overhaul, vitest test suite (28 tests), CI pipeline, unused dep removal (pino, zod, csv-parse) |

---

## 13. Future Research Areas

- **Solana DEX + Jupiter aggregator** — on-chain price discovery for non-Binance tokens
- **DeFiLlama integration** — TVL, fees, volume for protocol health signals
- **CoinGecko API** — broader market data, categories, trending
- **Machine learning signals** — pattern recognition on kline data
- **Backtesting framework** — historical signal accuracy measurement
- **Social sentiment** — X/Twitter, Reddit mentions for signal generation
- **OHLCV chart generation** — SVG sparklines for Hermes visual responses
