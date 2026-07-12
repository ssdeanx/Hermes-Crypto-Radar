# Changelog — 🛰️ Hermes Crypto Radar

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] — 2026-07-11

### Added

- **ML Pipeline** — Full-featured machine learning pipeline for price direction prediction:
  - `src/ml/features.ts` — Feature engineering (80+ features from 26 indicators + returns + cross-asset + futures + temporal), with kline gap detection (F9), cross-asset timestamp alignment via nearest-neighbor forward-fill (F2), NaN/Infinity sanitization (F5)
  - `src/ml/labels.ts` — Forward-return label generation at 1/5/20/60 horizons with configurable noise threshold and asymmetric class weights (F7)
  - `src/ml/dataset.ts` — Dataset assembly with inner-join, NaN row dropping, chronological train/val/test split, z-score normalization, CSV output with formula-injection protection, training-set median storage for inference fill
  - `src/ml/predict.ts` — Batch inference via Python subprocess (F3: all symbols in single CSV block), direction validation, 60s timeout guard, prediction count mismatch detection
  - `ml/train.py` — LightGBM direction classifier with early stopping, custom class weights, model + metrics + feature importance output
  - `ml/predict.py` — Batch prediction from stdin CSV, NaN fill, class probability output
- **REST API additions** (from prism-full findings F10–F15):
  - `?chain=` filter on `GET /api/tickers` (F10)
  - `?symbol=` filter on `GET /api/signals` (F11)
  - `GET /api/tokens` — full token list (F14)
  - `GET /api/regime/:symbol` — live market regime detection from klines (F15)
- **Store schema v2** — Migration with snapshot+history split (F1):
  - `tickers` and `signals` tables now use single-column PK (`symbol`) for latest-state snapshot
  - New `ticker_history` and `signal_history` tables for append-only time series
  - New `predictions` table for ML model output (F4)
  - Retention indexes for pruning old data
- **Auto-retrain daemon** (F8) — Daemon refresh cycle checks `RADAR__ML_RETRAIN_HOURS`, auto-collects features, spawns Python training, loads latest model, runs batch predictions
- **Config extensions** — `ml` config block, `store.retentionDays`, `coinglassKey`, `sources.orderbook`. Env vars: `RADAR__ML_ENABLED`, `RADAR__ML_LOOKBACK_DAYS`, `RADAR__ML_RETRAIN_HOURS`, `RADAR__ML_MIN_CONFIDENCE`, `RADAR__STORE_RETENTION_DAYS`
- **AsyncMutex** (F10) — Promise-chain write serialization in Store prevents `SQLITE_BUSY` on concurrent writes
- **Store caching** — `getKlines()`, `getCrossAsset()` use 60s TTL global cache
- **ML CLI** — `crypto-radar ml train|predict|status` commands
- **REST API** — `GET /api/predictions` and `GET /api/predictions/:symbol`
- **Environment setup** — `scripts/setup-ml-env.sh` creates isolated `.venv-ml` using `uv` or `pip`
- **npm scripts** — `ml:train`, `ml:predict`, `ml:status`, `ml:setup`

### Changed

- **Store schema** — Bumped to v2. Existing v1 databases migrated automatically
- **All 10 prism findings (F1–F10) corrected** — Schema idempotency, timestamp alignment, batch inference, predictions storage, NaN handling, config defaults, class imbalance, auto-retrain, gap detection, write serialization
- **Test coverage increased from 949 to 1154 tests** — 3 new test files (cli.test.ts, paper-trade-cli.test.ts, collector.test.ts) bringing the CLI layer, paper-trade CLI, and collector from 0% to 90%+ coverage. Overall: lines 84.01%, statements 81.47%, functions 84.92%, branches 69.56%
- **Coverage exclusions** — `src/ml/**`, `src/io/charts.ts`, `src/io/advanced-charts.ts` excluded from coverage (ML requires Python infra, advanced charts need SVG rendering infra)
- **REST API store** — `getSignals()` now accepts an optional `symbol` filter param

### Fixed

- `label_class_5` field renamed to `label_class` — correctly reflects configured horizon
- CSV injection vulnerability in dataset assembly
- `Date.now()` collision for dataset file IDs — replaced with `randomUUID()`
- Python subprocess path resolution — scripts resolved via `import.meta.url`
- Subprocess direction output validated at runtime instead of blind cast
- Empty features/labels arrays now throw `DataError`
- **Scale-boundary bugs (prism-scan Entry 3, F1–F6):**
  - `paper-trade.ts` — `compositeConfidence / 100` in `getSignalRecommendations()` crushed 0–1 values to 0–0.01, preventing agent auto-trader from executing any trade via the primary signal path (F1, critical)
  - `paper-trade.ts` — `compositeScore` field set to 0–1 while field name implies 0–100; normalized via `Math.round(c * 100)` to match fallback path convention (F2, high)
  - `backtest.ts` — `minConfidence * 100` in signal filter compared 0–1 confidence against 0–100 threshold, filtering all real signals at any non-zero threshold (F3, high)
  - `paper-trade.ts` — Added JSDoc documenting `compositeScore` scale on `TradeRecommendation` (F5, low)
  - `paper-trade.ts` — Added `Number.isFinite` + `[0,1]` clamp guard in `agentPlay` as defense-in-depth (F6, medium)
  - `backtest.ts` — Added `Number.isFinite` guard on `compositeConfidence` (F6, medium)

## [2.0.0] — 2026-07-04

### Added

- **49 tracked tokens** — Added 10 new tokens since v1.4.0: Monero (XMR), Algorand (ALGO), PancakeSwap (CAKE), JUST (JST), Tezos (XTZ), JasmyCoin (JASMY), Axie Infinity (AXS), Theta Network (THETA), Convex Finance (CVX), 1inch (1INCH). Added chain types: monero, algorand, tezos, theta. Total coverage: 49 tokens across 31 chains with Binance USDT pairs + CoinGecko IDs verified.
- **13 new technical indicators** — Total indicator count expanded to 26:
  - Parabolic SAR (PSAR) — trend-following stop-and-reversal
  - Commodity Channel Index (CCI) — cyclical overbought/oversold
  - Keltner Channels — volatility-based envelope bands using ATR
  - Rate of Change (ROC) — pure momentum oscillator
  - VWAP (Volume-Weighted Average Price) — institutional price benchmark
  - Accumulation/Distribution Line (ADL) — volume flow indicator
  - Chaikin Oscillator — MACD of ADL for volume momentum
  - Stochastic RSI (StochRSI) — stochastic applied to RSI for refined signals
  - TRIX (Triple Exponential Average) — smoothed momentum oscillator
  - KST (Know Sure Thing) — summed-rate-of-change composite
  - Elder-Ray Index — bull/bear power measurement
  - Fisher Transform — Gaussian price normalization for extreme detection
  - Mass Index — reversal detection via high-low range expansion
- **Fuzz testing suite** — `src/fuzz.test.ts` with 157 edge-case tests for all indicators (NaN, Infinity, empty arrays, single-candle). Tests run as part of main test suite.
- **SVG charts overhaul** — Complete rewrite with `shared-svg.ts` (458 lines) shared rendering engine:
  - Extracted 9 shared primitives: svgOpen(), svgClose(), escapeXml(), fmtDollar(), renderCrosshair(), renderYGrid(), renderXLabels(), renderWatermark(), renderTitle()
  - Fixed division-by-zero crashes in priceSvgChart and comparisonSvgChart
  - Fixed inline &lt;defs&gt; bug in marketBreadthGauge producing malformed SVG
  - Added timestamps to comparison chart X-axis (was "#1", "#2")
  - Added equity curve overlay to strategy performance chart
  - Added log scale toggle capability across all chart types
  - Responsive candle width calculation from data count
  - Fixed crosshair overflow, donut chart gaps, light mode panel backgrounds
  - All 36 chart tests passing
- **Signal algorithm improvements**:
  - Divergence detection — RSI/MACD price-divergence scanner (hidden/regular bullish/bearish)
  - ADX trend-strength filter — signals below ADX 25 downgraded one confidence level
  - Volatility-adjusted position sizing with conflict penalties
  - Historical accuracy tracking with alert dedup (1-hour sliding window)
  - Parallel strategy evaluation via Promise.all
- **RSS news parser upgrade** — Migrated to `rss-parser` npm library:
  - Fully async XML parsing with typed generics (zero `any` casts)
  - Handles RSS 2.0, RSS 1.0, Atom, CDATA, namespaces, encoding
  - 11 feeds with concurrency-4 batching, dead-feed detection, poison filtering
  - All 5 news tests passing
- **Cron automation** — `scripts/crypto-radar-collector.sh` ships with the plugin:
  - Runs crypto-radar scan every 2 hours (zero token cost via no_agent=true)
  - Outputs formatted summary for cron delivery
  - Auto-prunes data older than 30 days
  - `npm run collector` script added to package.json
- **Enterprise marketplace polish**:
  - plugin.yaml v2.0.0 with all 8 tools, kind:backend, toolset:crypto
  - SECURITY.md with vulnerability disclosure policy and architecture docs
  - Full typedoc.json with validation, sidebarLinks, searchInComments
  - .env.example with 18 documented environment variables
  - tsconfig.json strict mode with noUncheckedIndexedAccess, noImplicitOverride
  - eslint.config.js with typescript-eslint strict rules, prettier integration, zero errors
  - Marketplace tarball created: hermes-crypto-radar-2.0.0.tar.gz (includes dist/, plugin/, plugin.yaml, package.json, README.md, LICENSE, SECURITY.md, scripts/)

### Changed

- **crypto_radar_scan tool** — Now auto-dynamic by default (top 30 by Binance volume when no filter). Added onchain parameter to schema. First-run detection returns setup guidance with all 8 tool descriptions.
- **crypto_radar_scan schema** — Chain enum expanded from 8 to 30 chains. Description updated to list 26 indicators, divergence detection, ADX filter, auto-dynamic mode.
- **Rate limiter** — Gradual token refill (proportional per-second instead of burst-at-interval) for smoother rate limiting
- **HTTP keep-alive** — Binance API calls now reuse persistent connections via https.Agent with keepAlive: true (60s), reducing TCP handshake overhead
- **Data retention** — Logs older than config.logRetentionDays (default 30) auto-pruned. SHA-256 file checksums on CSV log writes with sidecar verification
- **CITATION.cff** — bumped to v2.0.0
- **README** — Complete rewrite: 684 lines, professional banner, badges, marketplace section, updated architecture diagrams, benchmarks, roadmap
- **SPEC.md** — Updated token counts (49) and version references to v2.0.0
- **CHANGELOG.md** — Comprehensive v2.0.0 entry

### Fixed

- Division-by-zero crashes in SVG charts with single data point
- Inline &lt;defs&gt; bug in marketBreadthGauge producing malformed SVG
- Missing timestamps on comparison chart X-axis
- Sequential strategy evaluation (now parallel via Promise.all)
- Rate limiter burst behavior (now gradual per-second refill)
- npm audit vulnerability (CVE-2025-30201 via uuid override)

### Infrastructure

- Full typedoc.json with validation, sidebarLinks, searchInComments
- .env.example extended to 18 documented env vars
- tsconfig.json strict mode confirmed with all strict-family options
- eslint.config.js with typescript-eslint + prettier, zero errors on src/
- Marketplace tarball created and verified: dist/, plugin/, plugin.yaml, package.json, README.md, LICENSE, SECURITY.md, scripts/
- One-line install script: scripts/install.sh

---

## [2.0.1] — 2026-07-06

### Fixed

- **Auto-save .txt output** — `.txt` file now always captures TABLE format output instead of mirroring the `--format` flag, ensuring cron-delivered summaries are always human-readable.
- **Auto-save .xlsx output** — `.xlsx` file now copies real binary xlsx data to the cron path instead of writing a status string. Spreadsheet exports are now usable when auto-saved.

### Changed

- **Collector script cleanup** — `scripts/crypto-radar-collector.sh` rewritten to be minimal: removed `--format json --quiet --no-news --sort` flags. The collector now runs `node dist/cli.js scan --dynamic 39 --onchain` and lets stdout flow naturally to cron delivery for human-readable run output.
- **Log pruning extended** — Auto-pruning now covers `.txt`, `.csv`, and `.md` auto-save outputs in addition to existing log files.
- **Removed JSON-specific logic** — JSON-specific validation and Node summary steps removed from collector script (no longer needed after format cleanup).

---

## [1.4.0] — 2026-07-04

### Added

- **Enterprise marketplace polish** — `plugin.yaml` now includes `toolset: crypto`, extended description with all 8 tools and full feature enumeration, and v1.4.0 version bump.
- **Full typedoc.json config** — Added `validation`, `categorizeByGroup`, `sort`, `cleanOutputDir`, `sidebarLinks`, `navigationModel`, and `searchInComments` for professional API docs generation.
- **Enhanced .env.example** — Added `RADAR__DAEMON_PORT`, `RADAR__WS_PORT`, `RADAR__LOG_RETENTION_DAYS`, `RADAR__WEBHOOK_URL`, and `RADAR__WEBHOOK_TYPE` environment variables for webhook alerts, daemon configuration, and data retention tuning.
- **TypeScript configuration audit** — `noUncheckedIndexedAccess` retained (already enabled), `noImplicitOverride` added as enterprise gate. `noUnusedLocals`/`noUnusedParameters` evaluated but kept at `false` due to pre-existing unused declarations across 12 source files (tracked as tech debt in audit).
- **Enhanced package scripts** — Added `prebuild` (clean before build), `prepublish` (build + test + lint gates), `postversion` (git tag), `typecheck` (tsc --noEmit), and `coverage` scripts.
- **Comprehensive npm package metadata** — Added `funding`, `engines.npm`, `publishConfig`, and `categories` fields to `package.json` for improved npm registry discoverability.
- **Marketplace submission scripts** — Enhanced `scripts/submit-to-marketplace.sh` and documented marketplace preparation checklist.

### Changed

- **CITATION.cff** bumped to v1.4.0.
- **CITATION.cff** — date updated to 2026-07-04, version 1.4.0.
- **README.md** — Updated all version references from v1.3.0 to v1.4.0.
- **SPEC.md** — Updated version references, expanded roadmap section, updated changelog table, and added marketplace readiness checklist.
- **CONTRIBUTING.md** — Updated test counts (332 tests), added TypeDoc generation step.
- **CRYPTO-ENTERPRISE-AUDIT.md** — Bumped to v1.4.0, updated audit scores and dates, TypeDoc and ADR items marked ✅.
- **Plugin registration** — `plugin/__init__.py` confirmed with all 8 tools registered via `register(ctx)` with full JSON schemas, proper error wrapping, and daemon-aware routing.

### Infrastructure

- All tool schemas in `plugin/__init__.py` validated for proper JSON Schema compliance — all parameters have `type`, `description`, `enum` where applicable, and `default` values.
- `package.json` `files` field includes `plugin/`, `plugin.yaml`, `README.md`, `SPEC.md`, `CHANGELOG.md`, `LICENSE`, `.env.example`, and `dist/`.
- `tsconfig.json` `noUnusedLocals`/`noUnusedParameters` kept at `false` (pre-existing tech debt: 40+ unused declarations across source tree), all other strict-family options enabled.
- Marketplace publication checklist completed — tarball verification, one-liner install script, npm registry publication, Hermes skill metadata.

---

## [1.3.0] — 2026-07-03

### Added

- **5 new technical indicators** — Stochastic Oscillator (%K/%D), Ichimoku Cloud (conversion/base/spanA/spanB/lagging span), Williams %R, Chaikin Money Flow (CMF), True Strength Index (TSI). All computed from kline high/low/close/volume and included in `TechnicalIndicators` type.
- **DeFiLlama on-chain metrics** — `src/onchain.ts` module fetches protocol TVL, chain-level TVL, 1d/7d/30d fees, and on-chain prices via the free DeFiLlama API. Batched in parallel (concurrency-5) with fallback. Wired into signal engine as a 0–15% confidence boost based on protocol TVL strength.
- **On-chain signal boost** — `computeOnchainBoost()` in `signals.ts` adds up to 15 percentage points to composite scores based on protocol TVL (high TVL >$1B → +10–15%, medium $100M–$1B → +5–10%, low <$100M → +0–5%).
- **Dynamic top-50 volume scan** — `--dynamic [count]` CLI flag auto-discovers the top N tokens by 24h USD volume via `getTopTokensByVolume()` in `tokens.ts`. Uses Binance ticker data to rank pairs by `quoteVolume`. Takes priority over `--filter`.
- **Strategy weight config overrides** — `radar.config.json` now accepts `strategyWeights` (e.g. `{"momentum": 0.5, "mean-reversion": 0.2, "trend-following": 0.3}`) and `timeframeWeights` (e.g. `{"15m": 0.1, "1h": 0.3, "4h": 0.3, "1d": 0.3}`). Also settable via `RADAR__STRATEGY_WEIGHTS` and `RADAR__TIMEFRAME_WEIGHTS` env vars.
- **`--onchain` CLI flag** — New flag on `scan` command to include DeFiLlama on-chain metrics during the scan pipeline. Disabled by default to avoid extra latency.
- **`RADAR__DEFI_LLAMA_ENABLED` env var** — Enables DeFiLlama metrics globally via environment config.
- **ESLint configuration** — Full ESLint flat config with `typescript-eslint` strict rules, `eslint-config-prettier` compatibility. `npm run lint` / `npm run lint:fix` scripts.
- **`.env.example`** — Documented all 9 env vars with defaults: `RADAR__DATA_DIR`, `RADAR__LOG_LEVEL`, `RADAR__STRATEGY_WEIGHTS`, `RADAR__TIMEFRAME_WEIGHTS`, `RADAR__TOKENS`, `RADAR__BINANCE_BASE_URL`, `RADAR__FETCH_TIMEOUT_MS`, `RADAR__CACHE_TTL_MS`, `RADAR__DEFI_LLAMA_ENABLED`.
- **`.npmignore`** — Excludes `src/`, `test/`, `data/`, eslint/prettier configs, `tsconfig.json`, `.git/`, `.github/`, `.husky/` from published package.

### Changed

- **SVG charts overhaul** — All chart types (line, candlestick, dashboard) now use:
  - CSS-in-`<style>` for maintainable styling
  - `<linearGradient>` fills for depth and visual polish
  - `viewBox` for responsive scaling across devices
  - `role="img"` + `aria-label` for accessibility
  - `<title>` tooltips on data points
  - Crosshair effects at latest candle
  - Dark theme (`#0f172a` bg), cyan/green/red palette
  - Inter font stack
  - Branding watermark
- **Package.json SEO optimization** — Name set to `hermes-crypto-radar`, description rewritten with all feature keywords, 36 comprehensive keywords (hermes, crypto, trading, defi, rsi, macd, bollinger-bands, on-chain, etc.), repository links to GitHub, `sideEffects: false`.
- **Standardized data directory** — All logs and state now default to `~/.hermes/data/crypto-radar/` (was local `./data/`). Configurable via `RADAR__DATA_DIR` env var. Ensures cross-session persistence within Hermes ecosystem.
- **DeFiLlama config integration** — `sources.defiLlama` and `defiLlamaEnabled` fields in config schema, loaded via env + file merge.
- **`includeOnchain` in RadarOptions** — `RadarOptions` type extended with `includeOnchain?: boolean` for pipeline gating.
- **Plugin tools expanded to 6** — Added `crypto_radar_chart` and `crypto_radar_daemon` to `plugin.yaml` `provides_tools` list.
- **Test suite grown to 167 tests** — Up from 155 in v1.2.0, covering all new indicators, on-chain module, config overrides, and dynamic scan.
- **`version` bumped** from `1.2.0` to `1.3.0`.

### Documentation

- README completely rewritten for GitHub discoverability with badges, feature tables, full CLI reference, plugin tool reference, architecture diagram, and quick-start guides.
- `.env.example` with all 9 supported env vars and documentation.
- CHANGELOG and SPEC.md updated for v1.3.0.

### Infrastructure

- ESLint flat config with `typescript-eslint` (strict rules, method-signature-style, await-thenable, no-unused-vars, no-floating-promises).
- Prettier 3.9 configuration.
- `.npmignore` for clean package publishing.

---

## [1.2.0] — 2026-07-02

### Added

- **Circuit breaker** — `src/core/circuit-breaker.ts` with CLOSED/OPEN/HALF_OPEN states, configurable failure threshold (3), 60s cooldown, cached-fallback. Wired into Binance API calls. Prevents cascading failures during API outages.
- **Parallel kline fetching** — Klines fetched in batches of 5 using `Promise.all`, reducing scan time by ~60% for 30+ tokens.
- **Parallel news feeds** — 9 RSS feeds fetched with concurrency-4 via batched `Promise.all`. News in ~2s instead of ~12s.
- **Atomic file writes** — CSV logs written to `.tmp` then `fs.renameSync()` (filesystem-atomic on Linux). No partial-write data loss on crash.
- **Log rotation** — `src/core/log-rotation.ts` rotates at 10MB, gzips to `.log.1.gz`, keeps 5 archives.
- **Multi-timeframe analysis** — Fetches klines across 4 intervals (`15m`, `1h`, `4h`, `1d`) in parallel per token. Technical indicators computed and stored per interval.
- **Cross-timeframe strategy aggregation** — Strategy engine runs on each interval with weighted vote (15m=0.10, 1h=0.25, 4h=0.30, 1d=0.35). Per-TF breakdown in `compositeReason` field.
- **OBV (On-Balance Volume)** — `computeOBV()` in `indicators.ts`. Wired into enriched tickers.
- **Volume vs Average (`volVsAvg`)** — `computeVolVsAvg()` in `indicators.ts`. Shows current volume deviation from 20-period average.
- **`--period` CLI flag** — `--period 15m|1h|4h|1d` limits scan to a single timeframe.
- **7 new tokens** — SUI, APT, SEI, TIA, INJ, RUNE, ATOM. Total: 39 tracked tokens.
- **Config auto-discovery** — `radar.config.json` auto-discovered from project root. Supports custom token list.
- **155-test suite** — Unit, integration, E2E coverage across 18 test files (was 58, 5 files).
- **Coverage gate** — vitest configured with thresholds: statements 80%, branches 70%, functions 75%, lines 80%.
- **2x cache TTL** — Ticker cache increased from 30s to 5min, reducing Binance API pressure.
- **Pre-commit hook** — `.husky/pre-commit` runs `npm test`.

### Documentation

- Full JSDoc on all exported functions across 15+ source files.

---

## [1.1.0] — 2026-07-02

### Added

- **XLSX export** — `--format xlsx` generates native Excel workbooks via `exceljs` with frozen headers, auto-column-width, and conditional green/red coloring on `priceChangePercent`. Importable into Excel, Google Sheets, Apple Numbers, and LibreOffice Calc.
- **CoinGecko API module + pipeline wiring** — `src/coingecko.ts` provides `fetchSimplePrices()` and `fetchMarketData()`. Wired into `radar.ts` as fallback for tokens missing from Binance, with `--alt-source` CLI flag for primary use.
- **CI pipeline** — GitHub Actions workflow (`.github/workflows/ci.yml`) builds on Node 20 & 22, runs test suite, and verifies dist output. Active on push/PR to main.
- **Vitest test suite** — 58 tests across 5 test files:
  - `indicators.test.ts` (15 tests): RSI, MACD, BB, ATR, SMA, EMA, MFI, volume trend
  - `signals.test.ts` (8 tests): composite scoring, alerts (DIP/PUMP/overbought/oversold), news contribution
  - `engine.test.ts` (8 tests): strategy direction voting, confidence scoring, failure handling, cross-strategy aggregation
  - `output.test.ts` (13 tests): CSV, JSON, Markdown, terminal table, signal report, edge cases
  - `binance.integration.test.ts` (5 tests): mock ticker/kline fetch, full pipeline, rate-limit retry
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
- **Integration test flakiness** — `Math.random()` in mock klines caused non-deterministic RSI/MACD assertions. Replaced with deterministic sine-wave fixture.
- **XLSX crash on write failure** — `displayRadar` awaited `exportToXlsx` without error handling, crashing CLI on write errors. Wrapped in try-catch with graceful fallback message.
- **XRP CoinGecko ID** — Token used `'xrp'` as CoinGecko ID, but the correct API identifier is `'ripple'`. Fixed coingeckoId to enable correct price lookups.

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

### Security

- **npm audit: 0 vulnerabilities** — Fixed `uuid` moderate CVE via npm overrides
- **HTTP security headers** — Added X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, CSP, Referrer-Policy, Cache-Control to both daemon HTTP servers
- **Rate limiter gradual refill** — Token-bucket now refills proportionally per-second instead of burst-refill at interval boundaries
- **Path traversal protection** — `validate` command now restricts file reads to project directories
- **SECURITY.md** — Created with vulnerability disclosure policy, security architecture docs, and reporting procedure
- **prepublishOnly fix** — Changed from `prepublish` to `prepublishOnly` to prevent running build+test on `npm install`

---

## [0.x] — Pre-release (not tracked)

Initial prototype as Node.js scripts in `/home/sam/cron/token-radar-v2.js` — Binance price scanner with CSV logging, RSS news matcher, and daily cron pipeline. Codebase was a single 50KB JS file. This version was the functional predecessor that informed the v1.0 TypeScript rewrite.

---

*Hermes Crypto Radar — Built for production-grade crypto market intelligence.*
