# Changelog — 🛰️ Hermes Crypto Radar

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

---

## [0.x] — Pre-release (not tracked)

Initial prototype as Node.js scripts in `/home/sam/cron/token-radar-v2.js` — Binance price scanner with CSV logging, RSS news matcher, and daily cron pipeline. Codebase was a single 50KB JS file. This version was the functional predecessor that informed the v1.0 TypeScript rewrite.

---

*Hermes Crypto Radar — Built for production-grade crypto market intelligence.*
