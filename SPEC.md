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
┌─────────────────────────────────────────────────────┐
│                   Hermes Agent                       │
│  ┌──────────────────────────────────────────────┐   │
│  │           Plugin: crypto-radar               │   │
│  │  ┌──────────┐  ┌──────────┐  ┌────────────┐ │   │
│  │  │scan tool │  │signals   │  │news tool   │ │   │
│  │  │          │  │tool      │  │            │ │   │
│  │  └────┬─────┘  └────┬─────┘  └─────┬──────┘ │   │
│  │       │             │              │         │   │
│  │  ┌────▼─────────────▼──────────────▼──────┐  │   │
│  │  │    plugin/__init__.py (Python bridge)   │  │   │
│  │  │    spawns node subprocess               │  │   │
│  │  └────────────────┬────────────────────────┘  │   │
│  └───────────────────┼──────────────────────────┘   │
└──────────────────────┼──────────────────────────────┘
                       │
              ┌────────▼────────┐
              │  dist/cli.js    │
              │  (Compiled TS)  │
              │                 │
              │  ┌────────────┐ │
              │  │ binance.ts │ │
              │  │ news.ts    │ │
              │  │ signals.ts │ │
              │  │ radar.ts   │ │
              │  └────────────┘ │
              └─────────────────┘
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
| **Polygon/DeFi** (12) | POL, SUSHI, UNI, AAVE, CRV, LINK, QUICK, BAL, LDO, BAT, COMP, ZRO, GRT |
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
| CLI | ✅ | `scan`, `signals`, `news`, `tokens` + flags |
| Hermes plugin | ✅ | 4 tools, JSON output, `check_fn` gating |
| Multi-chain | ✅ | Solana + Polygon + broad-market separation |
| Output formats | ✅ | Terminal table, CSV, JSON lines, Markdown |

### 4.2 Planned (Roadmap)

| Feature | Status | Details | Target |
|---------|--------|---------|--------|
| Price history log | 🔜 | Append-only CSV with state tracking | v1.1 |
| Multi-timeframe analysis | 🔜 | 15m, 1h, 4h, 1d klines | v1.1 |
| User-config token list | 🔜 | `radar.config.json` per user | v1.1 |
| WebSocket live prices | 🔜 | Binance WS for real-time updates | v1.2 |
| Portfolio tracking | 🔜 | User-defined holdings → P&L | v1.2 |
| Price alerts | 🔜 | Threshold-based notification via Hermes | v1.2 |
| DEX data (Jupiter) | 🔜 | Solana DEX prices via Jupiter API | v1.2 |
| On-chain metrics | 🔜 | TVL, volume, fees via DeFiLlama | v1.3 |
| Sentiment analysis | 🔜 | AI-powered news sentiment scoring | v1.3 |
| Visualizations | 🔜 | Sparkline charts, price heatmaps | v1.3 |
| Backtesting engine | 🔜 | Test signals against historical data | v2.0 |
| Telegram integration | 🔜 | Daily briefing delivery via Hermes gateway | v2.0 |
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
│   ├── cli.ts           # CLI entry point (Commander)
│   ├── index.ts         # Public API exports
│   ├── types.ts         # Type definitions
│   ├── tokens.ts        # Token registry (32 tokens)
│   ├── binance.ts       # Binance API client
│   ├── indicators.ts    # Technical indicators (RSI, MACD, BB, ATR)
│   ├── news.ts          # RSS news fetcher + matcher
│   ├── signals.ts        # Composite signal scoring
│   ├── output.ts        # Formatters (CSV, JSON, MD, table)
│   └── radar.ts         # Main radar engine
├── plugin/
│   └── __init__.py      # Hermes plugin (Python bridge)
├── plugin.yaml          # Plugin metadata
├── data/                # Log output directory
├── scripts/             # Utility scripts
├── SPEC.md              # This file
├── README.md            # User-facing docs
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
- **Minimal deps** — TypeScript only: commander, zod, csv-parse/csv-stringify, picocolors
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

---

## 13. Future Research Areas

- **Solana DEX + Jupiter aggregator** — on-chain price discovery for non-Binance tokens
- **DeFiLlama integration** — TVL, fees, volume for protocol health signals
- **CoinGecko API** — broader market data, categories, trending
- **Machine learning signals** — pattern recognition on kline data
- **Backtesting framework** — historical signal accuracy measurement
- **Social sentiment** — X/Twitter, Reddit mentions for signal generation
- **OHLCV chart generation** — SVG sparklines for Hermes visual responses
