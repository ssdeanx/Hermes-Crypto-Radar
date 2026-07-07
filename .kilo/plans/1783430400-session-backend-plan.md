# Session Backend Implementation Plan

> Based on `docs/SESSION-BACKEND-SPEC.md`
> Target: implement store/ (A) + new data sources (B) + API/WS layers

---

## 0. Pre-flight checks (current state confirmed)

| Check | Status |
|-------|--------|
| Node.js v24.18.0 — `node:sqlite` (`DatabaseSync`) | ✅ Works |
| `ws` package | ❌ Not installed — add to `dependencies` in `package.json` |
| `better-sqlite3` | ❌ Not needed (using `node:sqlite`) |
| Existing `Kline` type | ✅ Has all fields needed for schema |
| Existing `PaperTrade` type | ✅ Has `id`, `symbol`, `side`? **No** — uses `type: 'buy'|'sell'`, **not** `side` |
| `RadarRunResult` type | ❌ Does not exist — must be created for `persistRun()` |
| `RateLimiter` | ✅ Exists but uses `tryConsume()` (sync bool) — collector needs async-aware handling |
| `CircuitBreaker` | ✅ Exists in `core/circuit-breaker.ts` |
| `ws.ts` (existing) | ✅ Binance inbound WebSocket client — **do not confuse with new `src/api/ws.ts`** |

---

## 1. Critical design decisions (must resolve before coding)

### 1.1 `src/store/schema.ts` — `paper_trades` table vs existing `PaperTrade` interface

The spec schema has `side TEXT NOT NULL` but the existing `PaperTrade` (in `paper-trade.ts:45`) uses `type: 'buy' | 'sell'`.

**Decision**: Use `side TEXT NOT NULL` in the DB schema (matches `PaperTrade.type` semantics). When upserting, map `type → side` in the `Store` adapter layer. Do NOT change the existing `PaperTrade` interface.

### 1.2 `RadarRunResult` type — what does `runRadar()` return?

`runRadar()` returns:
```ts
{
  tickers: EnrichedTicker[];
  technicals: Map<string, Map<string, TechnicalIndicators>>;
  newsMatches: NewsMatch[];
  signals: TokenSignal[];
  aggregatedSignals: AggregatedSignal[];
  onchain: OnChainMetrics | null;
  run: RadarRun;
}
```

**Decision**: Define `RadarRunResult` in `src/types.ts` matching this shape. `persistRun(result: RadarRunResult)` consumes it to extract tickers/signals/news.

### 1.3 `node:sqlite` — sync API, prepared statements, WAL

`DatabaseSync` is synchronous — all operations block. This is fine for a CLI/cron tool with a single daemon, but the REST API endpoints must not block the event loop for long queries.

**Decision**: Use `DatabaseSync` for all store operations. Keep individual queries fast (<10ms). Batch inserts wrap in `db.exec('BEGIN')...COMMIT`. No async wrapper needed.

### 1.4 Type imports — `verbatimModuleSyntax` enforced

`tsconfig.json` has `"verbatimModuleSyntax": true`. This means:
- Use `import type { Foo } from './bar.js'` for type-only imports
- Use `import { Foo } from './bar.js'` for runtime imports
- Always include `.js` extension in relative imports

### 1.5 Collector rate limiting

The existing `RateLimiter` uses `tryConsume()` (sync, returns boolean). The collector calls Binance in a loop and needs to wait when rate-limited.

**Decision**: Add a `waitForToken()` method to `RateLimiter` that returns a Promise resolving when a token is available. Use a simple polling approach (setInterval + promise) rather than a complex async token bucket. Add this to the existing `RateLimiter` class.

---

## 2. Implementation order (8 steps, independent where possible)

### Step 1: `src/store/` — Foundation

**Files to create:**
- `src/store/schema.ts` — SQL DDL constant + version constant
- `src/store/db.ts` — `Store` class with all upsert/get methods
- `src/store/db.test.ts` — Unit + in-memory integration tests

**Files to edit:**
- `src/types.ts` — add `RadarRunResult` type, add `KlineRow`/`TickerRow`/`SignalRow`/`NewsRow`/`PaperTradeRow`/`FundingRow`/`OIRow`/`LsRatioRow`/`LiquidationRow`/`FearGreedRow`/`OrderBookRow`/`CrossAssetRow` row types
- `src/core/rate-limiter.ts` — add `waitForToken()` async method
- `package.json` — no changes yet (ws not needed for store)

**Implementation notes:**
- Use `node:sqlite` → `import { DatabaseSync } from 'node:sqlite'`
- Schema DDL: copy the SQL from spec §3.1 verbatim, export as `SCHEMA_DDL` const
- Store class: single `DatabaseSync` instance, WAL mode (PRAGMA journal_mode=WAL), foreign keys ON
- Prepared statement cache: `Map<string, StatementSync>` keyed by SQL text
- All batch upserts (klines, funding, etc.) wrap in `BEGIN...COMMIT`
- `path` defaults to `<dataDir>/crypto-radar.db`
- `Store.open(dataDir)` is the primary factory — calls `migrate()` if db file doesn't exist
- `persistRun(result)`: upserts each ticker into `tickers`, each signal into `signals`, each newsMatch into `news`. Uses `Map` to deduplicate by `(symbol, ts_utc)` before insert.
- Tests: use `:memory:` database, no temp files needed

**Row types to add to `src/types.ts`:**
```ts
export interface KlineRow {
  symbol: string; interval: string; open_time: number;
  open: number; high: number; low: number; close: number;
  volume: number; quote_volume: number;
  taker_buy_vol: number; taker_buy_quote_vol: number;
}
export interface TickerRow { symbol: string; ts_utc: string; price: number; /* ...all fields from EnrichedTicker */ }
export interface SignalRow { symbol: string; ts_utc: string; composite_score: number; direction: string; /* ... */ }
export interface NewsRow { id: string; symbol: string; headline: string; /* ... */ }
export interface PaperTradeRow { id: string; profile: string; symbol: string; side: string; /* ... */ }
export interface FundingRow { symbol: string; ts: number; rate: number; }
export interface OIRow { symbol: string; ts: number; open_interest: number; }
export interface LsRatioRow { symbol: string; ts: number; long_account: number; short_account: number; long_position: number; short_position: number; }
export interface LiquidationRow { id: string; symbol: string; ts: number; side: string; price: number; qty: number; usd: number; }
export interface FearGreedRow { ts: number; value: number; classification: string; }
export interface OrderBookRow { symbol: string; ts: number; spread_pct: number; imbalance: number; bids: string; asks: string; }
export interface CrossAssetRow { ts: number; btc_dominance: number; eth_dominance: number; total_mcap: number; total_mcap_change_24h: number; market_cap_percentage_json: string; }
export interface RadarRunResult {
  tickers: EnrichedTicker[];
  technicals: Map<string, Map<string, TechnicalIndicators>>;
  newsMatches: NewsMatch[];
  signals: TokenSignal[];
  aggregatedSignals: AggregatedSignal[];
  onchain: OnChainMetrics | null;
  run: RadarRun;
}
```

### Step 2: `src/core/config.ts` + `src/index.ts` edits

**Files to edit:**
- `src/core/config.ts` — extend `RadarConfig` with:
  - `store?: { path?: string }` 
  - `sources.futures?: boolean` (default true)
  - `sources.fearGreed?: boolean` (default true)
  - `sources.crossAsset?: boolean` (default true)
  - `apiToken?: string`
  - `wsPort?: number` (default 9878)
- Add `RADAR__STORE_PATH`, `RADAR__SOURCES_FUTURES`, `RADAR__SOURCES_FEAR_GREED`, `RADAR__SOURCES_CROSS_ASSET`, `RADAR__API_TOKEN`, `RADAR__WS_PORT` env overrides
- `src/index.ts` — add exports for `Store`, row types, `createRestHandler`, `createWsHub`, `runCollector`, source modules (as they are created)

### Step 3: Persist hook in `radar.ts` + `daemon.ts`

**Files to edit:**
- `src/radar.ts` — at end of `runRadar()`, call `store.persistRun(result)` guarded by a config check `config.store !== false`
- `src/daemon.ts` — on startup, open `Store` (via `Store.open(config.dataDir)`) and pass to radar options; after `refreshAll()` or `runRadar()`, call `persistRun`

**Key concern**: `radar.ts` currently has no import of `Store`. Inject via optional parameter or a global. The cleanest approach: add an optional `store?: Store` parameter to `runRadar()` options (extend `RadarOptions`).

### Step 4: `src/collector.ts` — Historical backfill

**Files to create:**
- `src/collector.ts` — `runCollector()` function
- `src/collector.test.ts` — integration tests with mock klines/futures data

**Files to edit:**
- (none beyond config/index which are already done)

**Implementation notes:**
- Kline backfill algorithm:
  1. `last = store.latestKlineTime(symbol, interval)`
  2. If `last === null` → seed mode: fetch pages of 1000 candles walking backward from `now` using `endTime` until `backfillDays` covered
  3. If `last` exists → incremental: `startTime = last + intervalMs`, fetch single page
  4. Binance `GET /api/v3/klines` supports `startTime`, `endTime`, `limit` params
- Use `CircuitBreaker` + `RateLimiter.waitForToken()` for each fetch
- `CollectorReport` return type: `{ klinesInserted, fundingInserted, oiInserted, lsInserted, liquidationsInserted, errors, durationMs }`
- Interval → ms mapping: `{ '15m': 900000, '1h': 3600000, '4h': 14400000, '1d': 86400000 }`

### Step 5: `src/sources/*` — New data sources (B)

**Files to create (each with `.test.ts`):**
- `src/sources/futures.ts` — `fetchFundingRates`, `fetchOpenInterest`, `fetchLongShortRatio`, `fetchTopLongShortPositionRatio`, `fetchLiquidations`
- `src/sources/fear-greed.ts` — `fetchFearGreed(limit?)`
- `src/sources/orderbook.ts` — snapshot depth, compute spread/imbalance
- `src/sources/cross-asset.ts` — `fetchGlobal()` from CoinGecko

**Implementation notes:**
- All sources use `fetch()` with `CircuitBreaker` + `RateLimiter` (reuse pattern from `binance.ts`)
- Futures base URL: `https://fapi.binance.com`
- Each has a pure parse function (receives raw JSON, returns typed array) — unit-testable
- Fear & Greed: `GET https://api.alternative.me/fng/?limit=N` — no auth required
- Orderbook: reuses `fetchDepth(pair, 20)` from `binance.ts` — compute `spread_pct = ((ask[0] - bid[0]) / bid[0]) * 100`, `imbalance = (bidQty - askQty) / (bidQty + askQty)` using top level
- Cross-asset: `GET https://api.coingecko.com/api/v3/global` — extract `data.market_cap_percentage.btc`, `.eth`, `data.total_market_cap.usd`, `data.market_cap_change_percentage_24h_usd`

### Step 6: `src/api/rest.ts` — REST API

**Files to create:**
- `src/api/rest.ts` — `createRestHandler(store)` → request handler function
- `src/api/rest.test.ts` — handler-level + booted-server tests

**Implementation notes:**
- Handler signature: `(req: IncomingMessage, url: URL, res: ServerResponse) => Promise<void>`
- Mounted in daemon at `/api/*` — the daemon checks `if (pathname.startsWith('/api'))` and delegates
- All routes return JSON with proper status codes
- Error contract: `{ error: string, code: string, detail?: string }` — use `CryptoRadarError` codes
- Auth middleware for `POST /api/collect`: check `Authorization: Bearer <token>` against `config.apiToken`
- Route table from spec §5 — implement all GET routes + the POST
- CORS + security headers are already set by the daemon — REST handler should NOT duplicate them

### Step 7: `src/api/ws.ts` — WebSocket push

**Files to create:**
- `src/api/ws.ts` — `createWsHub(httpServer, store)` → `WsHub`
- `src/api/ws.test.ts` — integration tests

**Files to edit:**
- `package.json` — add `ws` dependency and `@types/ws` devDependency

**Implementation notes:**
- Import `{ WebSocketServer } from 'ws'`
- `createWsHub()` returns `WsHub` with `broadcast(channel, data)` method
- Channels: `'prices'`, `'signals'`, `'news'`, `'portfolio'`
- Client subscribes with: `{ type: 'subscribe', channel: 'prices', symbol?: 'SOLUSDT' }`
- Daemon mounts WS on the same HTTP server via `server.on('upgrade', ...)` — no separate WS port
- Heartbeat ping every 30s (`ws.ping()`, `pong` handler)
- Auto-prune dead sockets on ping timeout (respond `close()` if no pong within 10s)

### Step 8: `src/cli.ts` + cron script + docs

**Files to edit:**
- `src/cli.ts` — add `collect` command
- `scripts/crypto-radar-collector.sh` — add `collect --klines --futures` variant
- `README.md` + `SPEC.md` — update with new store/API/collector/sources sections

**CLI:**
```
crypto-radar collect [--klines] [--futures] [--backfill <days>] [--symbol SOL BTC]
```
Exit 0 on success, 1 on fatal.

---

## 3. Data flow diagram (key interactions)

```
cron/systemd
    │
    ▼
crypto-radar collect  ──►  runCollector()  ──►  store.upsertKlines()
    │                                              store.upsertFunding()
    │                                              ...
    ▼
crypto-radar scan/daemon
    │
    ▼
runRadar()  ──►  store.persistRun(result)  ──►  upsert tickers
    │                                              upsert signals
    │                                              upsert news
    ▼
daemon HTTP server
    │
    ├── GET /api/*  ──►  createRestHandler(store)  ──►  store.getTickers()
    │                                                       store.getKlines()
    │                                                       store.getSignals()
    │                                                       ...
    │
    └── WS upgrade  ──►  createWsHub()  ──►  broadcast prices/signals/news
                                               on scan complete
```

---

## 4. Testing strategy per step

| Step | Files | Test approach |
|------|-------|---------------|
| 1 | `db.ts`, `schema.ts` | `:memory:` database, test upsert/idempotency/get/stats for every table |
| 3 | `radar.ts` | Mock `store.persistRun()`, verify called with correct shape |
| 4 | `collector.ts` | Mock `fetchKlines` with sine-wave fixture (like `binance.integration.test.ts`), test seed + incremental modes |
| 5 | All `sources/*.ts` | Mock `fetch` with canned JSON, test parse + error paths |
| 6 | `rest.ts` | (a) handler-level with mock req/res, (b) boot daemon on ephemeral port, `fetch()` real endpoints |
| 7 | `api/ws.ts` | Connect `ws` client, subscribe, trigger broadcast, assert message received |

No new test dependencies needed. Follow existing vitest patterns (see `binance.test.ts`).

---

## 5. Open questions (deferred to implementation)

1. **CoinGecko rate limits**: The free tier allows 10-30 calls/min. The cross-asset collector calls it once per run — acceptable. No auth needed.
2. **Binance Futures `forceOrders` endpoint**: May require API key. If `GET /fapi/v1/forceOrders` returns 401, fall back to fetching recent liquidations from alternative path or skip gracefully.
3. **Paper trade schema mapping**: The `side` field in the schema should map from `PaperTrade.type` (`'buy'|'sell'`). No change to existing interface.
4. **`Stats` endpoint limiting**: For large datasets, `SELECT COUNT(*)` on every table could be slow. Consider using `sqlite_master` for row count estimates, or accept the O(n) cost since this is a CLI tool with modest data volumes.

---

## 6. Verification checklist

- [ ] `npm run build` clean
- [ ] `npm run lint` 0 errors
- [ ] `npm test` green (all existing + new tests pass)
- [ ] Coverage gates hold (statements ≥80%, branches ≥70%, functions ≥75%, lines ≥80%)
- [ ] `node:sqlite` store opens, migrates, and survives restart
- [ ] `crypto-radar collect` populates klines + futures data
- [ ] REST API returns real data for all routes
- [ ] WS hub broadcasts after scan
- [ ] `ws` is the only new runtime dep
- [ ] No stubs, no `TODO`, no `throw new Error('not implemented')`
