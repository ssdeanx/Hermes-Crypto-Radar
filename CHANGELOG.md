# Changelog — 🛰️ Hermes Crypto Radar

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.1.0] — 2026-07-02

### Added
- **XLSX export** — `--format xlsx` generates native Excel workbooks via `exceljs` with frozen headers, auto-column-width, and conditional green/red coloring on `priceChangePercent`. Importable into Excel, Google Sheets, Apple Numbers, and LibreOffice Calc.
- **CoinGecko API module** — `src/coingecko.ts` provides `fetchSimplePrices()` and `fetchMarketData()` for alternative/fallback price data. Module created, ready for pipeline wiring.
- **CI pipeline** — GitHub Actions workflow (`.github/workflows/ci.yml`) builds on Node 20 & 22, runs test suite, and verifies dist output.
- **Vitest test suite** — 28 unit tests across 4 test files:
  - `indicators.test.ts` (15 tests): RSI, MACD, BB, ATR, SMA, EMA, MFI, volume trend
  - `signals.test.ts` (8 tests): composite scoring, alerts (DIP/PUMP/overbought/oversold), news contribution
  - `engine.test.ts` (8 tests): strategy direction voting, confidence scoring, failure handling, cross-strategy aggregation
  - `output.test.ts` (8 tests): CSV, JSON, Markdown, terminal table, signal report formatting
  - Coverage reporter configured (v8, lcov, HTML)
- **NEWS_CSV_HEADER shared constant** — `src/output.ts` now exports a canonical news CSV header, imported by `radar.ts` to prevent schema drift between write path and data definition.
- **Kline caching** — Per-run `Map<string, Kline[]>` eliminates the double-fetch of klines (was: fetched once for indicators, again for strategy engine; now: fetched once, cached, reused). ~50% reduction in API calls per scan.

### Changed
- **SPEC.md overhaul** — Architecture diagram updated to show all 7 source directories (`core/`, `analysis/`, `io/`, `monitor/`). Project structure tree matches actual layout. Token count corrected (Polygon/DeFi: 12→13). Roadmap falsehood fixed (multi-timeframe was marked "✅ DONE" but is not implemented — changed to 🔜). Quality standards updated with CI and dependency hygiene gates.
- **CLI format options** — `scan`, `signals`, and `news` commands now accept `xlsx` as a format value alongside `table`, `json`, `csv`, `md`.
- **OutputFormat type** — Extended union type to include `'xlsx'`.
- **Package dependencies** — Removed 3 unused packages (`pino`, `zod`, `csv-parse`). Added `exceljs` for XLSX export. Confirmed all remaining `dependencies` are actually imported.
- **version** bumped from `1.0.0` to `1.1.0`.

### Fixed
- **SOURCE_TIERS bug** — News relevance scoring was keying on `token.name` to look up source tiers, causing ALL tokens to receive the default 0.8 multiplier instead of the correct source-specific weight (e.g., CoinTelegraph=1.0, NullTX=0.4). Fixed to key on `feed.name` via new `sourceName` parameter on `matchToken()`.
- **News domain extraction** — RSS feeds returning relative URLs or empty link fields silently produced empty `domain` values, corrupting the CSV. Fixed with fallback to `source.toLowerCase() + '.com'`.
- **CSV multi-line quoting** — News descriptions containing embedded newlines produced malformed CSV rows. Fixed by stripping `\r`/`\n` to spaces before quoting.

### Performance
- **Kline caching** — eliminated redundant API calls. Before: one `fetchKlines()` per token for indicators (step 2) + one per token for strategy engine (step 5) = 60 API calls for 30 tokens. After: one per token = 30 API calls. Both fetches now use `limit=200` (was 100 vs 200) for consistent data.

---

## [1.0.0] — 2026-07-02

### Added
- **32 tokens** across Solana (13), Polygon/DeFi (13), and Multi (7)
- **Binance 24hr ticker** — All USDT pairs with timeout + retry + 429 backoff
- **Token enrichment** — Spread, VWAP distance, range position, book imbalance
- **Momentum scoring** — Price change + volume + spread + book imbalance
- **Technical indicators** — RSI, MFI, MACD, Bollinger Bands, ATR, volume trend, EMA50
- **News fetching** — 9 RSS feeds with headline/body matching, relevance scoring, poison filtering, cross-feed dedup
- **Composite signal generation** — 40% momentum + 40% technical + 20% news
- **CLI** — 8 commands: `scan`, `signals`, `news`, `tokens`, `chart`, `health`, `configure`, `strategies`
- **Hermes plugin** — 4 agent tools (`crypto_radar_scan`, `_signals`, `_news`, `_tokens`) via Python bridge
- **Output formats** — Terminal table, CSV, JSON, Markdown
- **Terminal sparkline charts** — ASCII price charts via asciichart
- **SVG chart generation** — Self-contained dark-theme SVG with volume bars, multi-panel with RSI
- **3-strategy signal engine** — Momentum (40%), Mean Reversion (20%), Trend Following (40%) with weighted confidence voting
- **Strategy aggregation** — Weighted vote engine → `strong_buy`/`buy`/`neutral`/`sell`/`strong_sell` with 0–100% confidence
- **Health monitoring** — Binance API, data directory, system resource checks
- **Configuration system** — JSON config file + `RADAR__*` env vars with typed defaults
- **Typed error classes** — `CryptoRadarError`, `NetworkError`, `RateLimitError`, `DataError`, `ConfigError`, `CacheError`, `SignalError`
- **Structured logging** — JSON to stderr, 6 levels (trace–fatal), child loggers
- **In-memory cache** — TTL-based with `memoize()` support and auto-expiry
- **Rate limiter** — Token-bucket algorithm, configurable max/window
- **Plugin metadata** — `plugin.yaml` with version, description, 4 provided tools
- **SPEC.md** — Full project specification with architecture, token roster, tool reference, data flow, scoring models, development guide, and marketplace publishing plan

### Infrastructure
- TypeScript 5.8 with strict mode, ES2022 target, ESNext modules
- Commander.js CLI framework
- csv-stringify for CSV generation
- picocolors for terminal coloring
- 24 source files across 6 directories (src/, src/core/, src/analysis/, src/io/, src/monitor/, plugin/)

---

## [0.x] — Pre-release (not tracked)

Initial prototype as Node.js scripts in `/home/sam/cron/token-radar-v2.js` — Binance price scanner with CSV logging, RSS news matcher, and daily cron pipeline. Codebase was a single 50KB JS file. This version was the functional predecessor that informed the v1.0 TypeScript rewrite.

---

*Hermes Crypto Radar — Built for production-grade crypto market intelligence.*
