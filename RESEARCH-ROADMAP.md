# Hermes Crypto Radar — Research Roadmap

> Comprehensive research on AI dataset building, frontend architecture, backend gaps, and competitor analysis.

---

## Table of Contents

1. [Current Project Analysis](#1-current-project-analysis)
2. [Similar Projects Comparison](#2-similar-projects-comparison)
3. [Datasets for AI Agent Training](#3-datasets-for-ai-agent-training)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Backend Gaps](#5-backend-gaps)
6. [Implementation Roadmap](#6-implementation-roadmap)

---

## 1. Current Project Analysis

### What exists today

| Layer | Status | Details |
|-------|--------|---------|
| **Data sources** | Partial | Binance REST (49 tokens), DeFiLlama (TVL/fees), 11 RSS feeds, CoinGecko fallback, Jupiter DEX |
| **Indicators** | Strong | 26+ technical indicators (RSI, MACD, BB, ATR, Stochastic, Ichimoku, ADX, PSAR, CCI, Keltner, StochRSI, TRIX, KST, Elder-Ray, Fisher, Mass Index) |
| **Signal engine** | Strong | 3 strategies (momentum 40%, mean reversion 20%, trend following 40%), divergence detection, ADX filter, candlestick patterns (16), market regime detection |
| **Storage** | None | In-memory cache only (TTL-based). No database. Data lost on restart. |
| **Backend API** | Minimal | Daemon HTTP: `/health`, `/refresh`, `/reload-config`, `/scan-complete`. No REST API for frontend consumption. |
| **Frontend** | None | SVG charts exist but no interactive UI. HTML report generator exists but is static. |
| **AI/ML** | None | No training pipelines, no paper trading simulation, no reinforcement learning. |
| **Export** | Strong | JSON, CSV, XLSX, Markdown, HTML reports |

### Critical gaps

1. **No persistent storage** — All data lives in memory. Historical data for training is impossible.
2. **No REST API** — The daemon exposes 4 endpoints, none returning market data to clients.
3. **No WebSocket to clients** — Existing WS is Binance-to-daemon only, not daemon-to-frontend.
4. **No paper trading** — No way for agents or humans to simulate trades.
5. **No ML pipeline** — No data labeling, feature extraction, or model training infrastructure.
6. **No frontend** — No interactive dashboard for human users.

---

## 2. Similar Projects Comparison

### FreqTrade (52k stars) — The Gold Standard

| Aspect | FreqTrade | Hermes Crypto Radar |
|--------|-----------|-------------------|
| **Language** | Python | TypeScript/Node.js |
| **Storage** | SQLite (persistent trades, candles, configs) | In-memory only |
| **Frontend** | FreqUI (Vue.js SPA) | None |
| **AI/ML** | FreqAI — integrated ML pipeline (scikit-learn, PyTorch, LightGBM, RL) | None |
| **Paper trading** | Dry-run mode with full exchange simulation | None |
| **Backtesting** | Full engine with hyperparameter optimization (Optuna) | Basic backtesting |
| **Strategies** | User-defined Python strategies | 3 hardcoded strategies |
| **Exchanges** | 15+ exchanges via CCXT | Binance only |
| **Telegram** | Full bot control | Webhook alerts only |
| **Data** | Downloads and stores OHLCV for offline backtesting | Real-time only, no history |

**Key takeaway**: FreqTrade's FreqAI is the closest model to what you want. It supports supervised learning, RL, and adaptive retraining. Their data pipeline stores OHLCV in SQLite, which enables offline training.

### Microsoft Qlib (45.8k stars) — AI-First Quant Platform

| Aspect | Qlib | Hermes Crypto Radar |
|--------|------|-------------------|
| **Focus** | Research/production quant platform | Market intelligence signals |
| **Data** | Custom binary format, high-performance data server | REST API calls |
| **ML** | Full pipeline: Alpha158/Alpha360 feature sets, LightGBM, LSTM, Transformer, RL | None |
| **Markets** | Stocks (US, China), adaptable to crypto | Crypto only |
| **Frontend** | Visualization via Jupyter notebooks | None |
| **R&D Agent** | LLM-powered autonomous factor mining (RD-Agent) | None |

**Key takeaway**: Qlib's Alpha158 feature set (158 factors derived from OHLCV) is a proven template for building ML-ready datasets. Their data storage format is optimized for ML training. The RD-Agent shows how LLMs can automate quant research.

### Jesse (8.1k stars) — Best DX for Strategy Development

| Aspect | Jesse | Hermes Crypto Radar |
|--------|-------|-------------------|
| **Language** | Python + JavaScript frontend | TypeScript |
| **Strategy syntax** | Clean Python classes with `should_long()`, `go_long()` | Hardcoded strategies |
| **ML pipeline** | Built-in: gather features → train scikit-learn → deploy predictions | None |
| **Paper trading** | Full paper trading mode | None |
| **Monte Carlo** | Trade-shuffling + candle-based simulations | None |
| **AI assistant** | JesseGPT — LLM helps write/debug strategies | None |
| **Optimization** | Optuna-based hyperparameter tuning | None |
| **Frontend** | Built-in web UI with charts, trade viewer, code editor | None |

**Key takeaway**: Jesse's ML pipeline (gather → train → deploy) is elegantly simple. Their `record_features()` / `record_label()` pattern in strategies is the easiest way to build labeled training data.

### Other Notable Projects

| Project | Stars | Key Feature | Relevance |
|---------|-------|-------------|-----------|
| **Hummingbot** | 9k | Market making + DEX arbitrage | Order book depth data, DEX integration |
| **OctoBot** | 3k | No-code strategy builder | Strategy template patterns |
| **Gekko** | 10k (archived) | Pioneer in crypto bot space | Historical lessons on what failed |
| **FinGPT** | 13k | LLM for financial sentiment | NLP dataset approaches, sentiment scoring |
| **ccxt** | 35k | Unified exchange API | Multi-exchange data normalization |
| **TradingView/lightweight-charts** | 10k | Financial charting library | Frontend charting standard |

---

## 3. Datasets for AI Agent Training

### 3.1 Data Sources to Add

Your current data covers price + basic on-chain + news. For AI training, you need significantly more:

#### Tier 1: Essential (add immediately)

| Data Source | What it provides | API/Access | Cost |
|------------|------------------|------------|------|
| **Order book depth** | Bid/ask levels, spread, imbalance | Binance WebSocket `depth20@100ms` | Free |
| **Funding rates** | Perpetual futures sentiment | Binance `/fapi/v1/fundingRate` | Free |
| **Open interest** | Futures positioning | Binance `/fapi/v1/openInterest` | Free |
| **Liquidation data** | Forced sells/buys (cascading events) | Coinglass API or Binance `forceOrders` | Free tier available |
| **Long/short ratio** | Retail positioning | Binance `/futures/data/globalLongShortAccountRatio` | Free |
| **Taker buy/sell volume** | Aggressive buyer vs seller pressure | Already partially in `takerBuyVol` from klines |

#### Tier 2: High value (add for ML)

| Data Source | What it provides | API/Access | Cost |
|------------|------------------|------------|------|
| **Whale wallet movements** | Large holder behavior | Whale Alert API, Etherscan whale tracker | Free tier |
| **Exchange inflow/outflow** | Coins moving to/from exchanges (bearish/bullish signal) | CryptoQuant, Glassnode | Paid (free tier limited) |
| **Stablecoin supply** | Market liquidity indicator | DeFiLlama stablecoins endpoint | Free |
| **DEX volume by pair** | On-chain trading activity | DeFiLlama DEX volume | Free |
| **Social sentiment** | Twitter/X, Reddit, Telegram mention volume | LunarCrush, Santiment, or web scraping | Free tier |
| **Google Trends** | Retail interest spikes | Google Trends API (unofficial) | Free |
| **Fear & Greed Index** | Market psychology | alternative.me API | Free |

#### Tier 3: Advanced (for serious ML)

| Data Source | What it provides | API/Access | Cost |
|------------|------------------|------------|------|
| **CVD (Cumulative Volume Delta)** | Net buying/selling pressure over time | Compute from tick data | Free (compute) |
| **Options data** | Put/call ratio, max pain, implied volatility | Deribit API | Free |
| **Correlation matrix** | Cross-asset correlations (BTC vs ETH vs SPY) | Compute from price data | Free |
| **Macro indicators** | DXY, interest rates, CPI | FRED API | Free |
| **On-chain metrics** | Active addresses, hash rate, MVRV, NVT | Glassnode, IntoTheBlock | Paid |

### 3.2 Dataset Architecture for ML

Based on Qlib's Alpha158 and FreqTrade's FreqAI, here's the recommended dataset schema:

#### Raw Data Layer (store everything)

```
data/
├── ohlcv/                    # Kline data per symbol per interval
│   ├── BTCUSDT/
│   │   ├── 15m.parquet
│   │   ├── 1h.parquet
│   │   ├── 4h.parquet
│   │   └── 1d.parquet
│   └── ...
├── ticker_snapshots/         # Periodic full ticker snapshots
│   └── YYYY-MM-DD.parquet
├── orderbook/                # Order book depth snapshots
│   └── BTCUSDT/
│       └── YYYY-MM-DD.parquet
├── funding/                  # Funding rates
│   └── funding_rates.parquet
├── open_interest/            # Open interest history
│   └── open_interest.parquet
├── liquidations/             # Liquidation events
│   └── liquidations.parquet
├── news/                     # RSS articles with timestamps
│   └── news.parquet
├── onchain/                  # DeFiLlama TVL/fees
│   └── onchain_metrics.parquet
└── signals/                  # Historical signal outputs
    └── signal_history.parquet
```

**Storage format**: Apache Parquet (columnar, compressed, fast reads). Use `parquet` npm package or write via Python for training.

**Why Parquet over SQLite**: Parquet is columnar — ML training reads specific feature columns efficiently. SQLite is row-oriented and slower for bulk feature reads. Qlib uses custom binary, but Parquet is the pragmatic choice.

#### Feature Layer (computed from raw)

Based on Qlib's Alpha158, compute these feature groups for each token at each timestep:

**Price features (30)**:
- Returns: 1d, 5d, 10d, 20d, 60d
- Log returns: same periods
- High-low range, open-close range
- VWAP distance, volume-weighted price
- Price vs SMA(5,10,20,60), EMA(5,10,20,60)

**Volume features (15)**:
- Volume ratio vs SMA(5,10,20,60)
- Volume momentum
- OBV trend
- Taker buy/sell ratio
- Volume profile (POC, HVN, LVN)

**Volatility features (10)**:
- ATR(14), ATR percentage
- Bollinger Band width, position
- Keltner Channel width, position
- Historical volatility (5d, 10d, 20d)
- Parkinson volatility

**Momentum features (20)**:
- RSI(6,14), MACD histogram
- Stochastic %K/%D, Williams %R
- ROC(5,10,20), MFI(14)
- CCI(14,20), TSI
- Fisher Transform, TRIX

**Trend features (10)**:
- ADX(14), +DI, -DI
- Parabolic SAR distance
- Ichimoku cloud position
- EMA(50) distance
- Trend slope (linear regression)

**Market structure (10)**:
- Support/resistance distance
- Higher high / lower low count
- Candle patterns (doji, hammer, engulfing, etc.)
- Regime classification (trending/ranging/volatile)

**Cross-market (10)**:
- BTC correlation (rolling 20d)
- ETH correlation
- BTC dominance trend
- Funding rate differential
- Open interest change

**Sentiment (5)**:
- News relevance score
- Sentiment keyword ratio
- Fear & Greed index
- Social volume change
- Google Trends score

**Total**: ~110 features per token per timestep. This is comparable to Qlib's Alpha158.

### 3.3 Training Approaches

#### Approach A: Supervised Learning (start here)

**How it works**: Label historical data with outcomes, train a model to predict labels.

**Labeling strategy** (from Jesse's pattern):
```typescript
// At time T, look forward N candles
// Label = direction and magnitude of price move
const label = {
  direction: futurePrice > currentPrice ? 'long' : 'short',
  magnitude: (futurePrice - currentPrice) / currentPrice,
  target: futureClose,  // or: 1 = up, 0 = down
};
```

**Recommended models**:
1. **LightGBM** — Fast, handles tabular data well, good baseline. Used by Qlib as primary model.
2. **XGBoost** — Similar to LightGBM, slightly more robust to overfitting.
3. **Random Forest** — Simple, interpretable, good for initial experiments.
4. **Neural network (MLP)** — If you have >100k samples, a simple feedforward net can work.

**Training pipeline**:
1. Collect OHLCV + features into Parquet files
2. Compute forward-looking labels (e.g., "did price go up 2% in next 4 hours?")
3. Split: train (70%), validation (15%), test (15%) — chronological split, not random
4. Train model, evaluate on validation set
5. Deploy model predictions as an additional signal input

#### Approach B: Reinforcement Learning (advanced)

**How it works**: Agent learns to take buy/sell/hold actions to maximize cumulative reward.

**Framework**: Use Qlib's RL framework or FreqTrade's FreqAI RL module as reference.

**Environment design**:
- **State**: Current features (price, indicators, order book, etc.)
- **Actions**: Buy, sell, hold (discrete) or position size (continuous)
- **Reward**: PnL minus transaction costs, risk-adjusted returns (Sharpe)

**Libraries**:
- `stable-baselines3` (Python) — PPO, A2C, SAC algorithms
- `ray[rllib]` (Python) — Distributed RL
- For Node.js: `@tensorflow/tfjs-node` + custom RL loop (less mature)

**Recommendation**: Build supervised learning first (3-4 weeks), then add RL as a second phase.

#### Approach C: LLM-Based Signal Reasoning

**How it works**: Feed market data to an LLM and ask it to reason about signals.

**Existing work**:
- FinGPT: Fine-tuned LLMs for financial sentiment
- JesseGPT: LLM helps write and debug trading strategies
- Qlib's RD-Agent: LLM autonomously mines quant factors

**Implementation**:
1. Format market snapshot as structured prompt
2. Include: price data, indicators, news headlines, on-chain metrics
3. Ask LLM to output: signal direction, confidence, reasoning
4. Use as a "meta-signal" that weighs other signals

**Prompt template**:
```
You are a crypto trading analyst. Analyze the following market data for {SYMBOL}:

Price: ${price} ({change}%) | Volume: {volume} | RSI: {rsi} | MACD: {macd}
Market Regime: {regime} | ADX: {adx} | Funding Rate: {funding}
News: {top_headlines}

Provide: direction (long/short/neutral), confidence (0-100), reasoning.
```

### 3.4 Paper Trading Simulation

Based on FreqTrade's dry-run mode and Jesse's paper trading:

**Core components**:

1. **Simulated order book** — Track virtual positions with realistic fills
2. **Slippage model** — Simulate realistic fill prices based on order book depth
3. **Fee modeling** — Apply exchange fees (maker/taker) to simulated trades
4. **Portfolio tracking** — Track virtual balance, positions, PnL, drawdown
5. **Performance metrics** — Sharpe ratio, max drawdown, win rate, profit factor

**Implementation**:
```typescript
interface PaperTrade {
  id: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  entryTime: Date;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'open' | 'closed';
  exitPrice?: number;
  exitTime?: Date;
  pnl?: number;
  fees: number;
}

interface PaperPortfolio {
  balance: number;
  positions: PaperTrade[];
  closedTrades: PaperTrade[];
  totalPnl: number;
  sharpeRatio: number;
  maxDrawdown: number;
}
```

**Key features to implement**:
- Multiple concurrent positions
- Stop-loss and take-profit orders
- Position sizing (fixed % risk per trade)
- Performance reporting (daily PnL, cumulative returns chart)
- Comparison vs buy-and-hold benchmark

---

## 4. Frontend Architecture

### 4.1 Recommended Stack

Given your existing TypeScript/Node.js backend:

| Layer | Recommendation | Why |
|-------|---------------|-----|
| **Framework** | Next.js 14+ (App Router) | Matches TS stack, SSR for SEO, API routes for backend extension, great DX |
| **Styling** | Tailwind CSS + shadcn/ui | Fast development, consistent design, no CSS-in-JS overhead |
| **Charts** | TradingView Lightweight Charts v4 | Industry standard for financial charts, lightweight, open source |
| **State** | Zustand + React Query (TanStack Query) | Zustand for global state (portfolio, settings), React Query for server state (data fetching, caching, WebSocket) |
| **Real-time** | Socket.io or native WebSocket | Connects to daemon's WebSocket endpoint for live prices |
| **Tables** | TanStack Table | Powerful, sortable, filterable tables for token data |
| **Auth** | NextAuth.js (Auth.js) | Simple team auth with OAuth providers |
| **Database** | SQLite via Prisma or Drizzle | Lightweight for small team, same data as backend |

### 4.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Next.js Frontend                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ Dashboard │ │ Charts   │ │ Signals  │ │ Paper  │ │
│  │ (Home)    │ │ (Detail) │ │ (List)   │ │ Trading│ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
│       │             │            │           │       │
│  ┌──────────────────────────────────────────────┐   │
│  │            React Query + Zustand              │   │
│  └──────────────────────────────────────────────┘   │
│       │             │            │           │       │
│  ┌──────────────────────────────────────────────┐   │
│  │        API Client Layer (fetch + WS)          │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
         │              │             │          │
         ▼              ▼             ▼          ▼
┌─────────────────────────────────────────────────────┐
│              Crypto Radar Backend                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │
│  │ REST API │ │ WebSocket│ │ Daemon   │ │ SQLite │ │
│  │ (new)    │ │ Server   │ │ (existing│ │ (new)  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────┘ │
└─────────────────────────────────────────────────────┘
         │              │             │          │
         ▼              ▼             ▼          ▼
┌─────────────────────────────────────────────────────┐
│              Data Sources                           │
│  Binance REST/WS │ DeFiLlama │ RSS │ CoinGecko     │
└─────────────────────────────────────────────────────┘
```

### 4.3 Dashboard Pages

| Page | Description | Key Components |
|------|-------------|----------------|
| **`/`** | Overview dashboard | Portfolio summary, top signals, recent news, market heatmap |
| **`/signals`** | All trading signals | Sortable table with composite scores, filter by chain/score, sparklines |
| **`/token/[symbol]`** | Token detail | Interactive chart (TradingView), indicators panel, news feed, on-chain metrics |
| **`/signals/[symbol]`** | Signal detail | Strategy breakdown (momentum/mean-reversion/trend), historical accuracy, confidence chart |
| **`/paper-trading`** | Paper trading | Open positions, trade history, PnL chart, portfolio allocation |
| **`/news`** | News feed | Aggregated news with sentiment scores, relevance filtering |
| **`/onchain`** | On-chain analytics | TVL charts, fee trends, whale movements |
| **`/backtest`** | Strategy backtesting | Parameter tuning, historical performance, equity curves |
| **`/settings`** | Configuration | Strategy weights, timeframe weights, alert settings, API keys |

### 4.4 Charting Deep Dive

**TradingView Lightweight Charts v4** is the clear winner:

- Used by TradingView itself, Binance, and most crypto platforms
- ~40KB gzipped (vs D3 at ~250KB)
- Supports: candlestick, line, area, histogram, bar, baseline
- Built-in: crosshair, tooltips, time scale, price scale
- Custom series support for indicators
- Works with React via `lightweight-charts` wrapper

**Alternative considered**: Recharts (simpler but less financial-specific), D3.js (too low-level for this use case).

**Chart features to implement**:
- Interactive candlestick with zoom/pan
- Indicator overlays (EMA, Bollinger, MACD subplot)
- Volume bars
- Signal markers (buy/sell arrows on chart)
- Multi-timeframe switching
- Crosshair with data tooltip
- Drawing tools (support/resistance lines)

### 4.5 Real-Time Data Flow

```
Binance WS ──► Daemon (existing) ──► WebSocket Server (new) ──► Next.js Frontend
                                                    │
                                                    ├── Price updates (every 100ms)
                                                    ├── Signal updates (every 5min)
                                                    ├── News updates (every 2min)
                                                    └── Order book updates (every 100ms)
```

**Implementation**:
1. Extend daemon to accept WebSocket connections from clients
2. Use Socket.io for reliable WebSocket with auto-reconnection
3. Frontend subscribes to specific symbols/channels
4. React Query manages cache invalidation from WS messages

---

## 5. Backend Gaps

### 5.1 Database (Critical)

**Problem**: Everything is in-memory. No historical data. No training data. No paper trading history.

**Solution**: SQLite via Prisma ORM (TypeScript) or Drizzle ORM (lighter weight).

```sql
-- Core tables needed
CREATE TABLE price_history (
  id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,  -- '15m', '1h', '4h', '1d'
  open_time INTEGER NOT NULL,
  open REAL, high REAL, low REAL, close REAL,
  volume REAL, quote_volume REAL,
  UNIQUE(symbol, interval, open_time)
);

CREATE TABLE signals (
  id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  composite_score REAL,
  direction TEXT,
  momentum_score REAL,
  mean_reversion_score REAL,
  trend_following_score REAL,
  regime TEXT,
  adx REAL,
  alerts TEXT,  -- JSON array
  UNIQUE(symbol, timestamp)
);

CREATE TABLE news (
  id INTEGER PRIMARY KEY,
  symbol TEXT,
  headline TEXT,
  description TEXT,
  source TEXT,
  url TEXT,
  pub_date INTEGER,
  relevance REAL,
  sentiment REAL
);

CREATE TABLE paper_trades (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price REAL,
  entry_time INTEGER,
  quantity REAL,
  exit_price REAL,
  exit_time INTEGER,
  pnl REAL,
  fees REAL,
  status TEXT
);

CREATE TABLE onchain_metrics (
  id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  protocol_tvl REAL,
  chain_tvl REAL,
  fees_1d REAL,
  fees_7d REAL
);
```

**Why SQLite over PostgreSQL**: Small team, single server, zero ops overhead. SQLite handles 100k+ rows easily and runs in-process with Node.js via `better-sqlite3`. If you outgrow it, migration to Postgres is straightforward with Prisma.

### 5.2 REST API (Critical)

**Problem**: Daemon only exposes 4 utility endpoints. Frontend needs full data access.

**Solution**: Add a REST API layer. Two options:

**Option A: Extend daemon HTTP server** (simpler)
Add endpoints to existing `src/daemon.ts`:

```
GET /api/tickers              — Latest enriched tickers
GET /api/tickers/:symbol      — Single token detail
GET /api/signals              — All composite signals
GET /api/signals/:symbol      — Single token signal
GET /api/klines/:symbol       — Historical klines with indicator overlay
GET /api/news                 — News feed with pagination
GET /api/onchain              — On-chain metrics
GET /api/paper-trades         — Paper trading positions/history
POST /api/paper-trades        — Execute paper trade
GET /api/portfolio            — Paper trading portfolio summary
GET /api/backtest/:symbol     — Backtest results
```

**Option B: Separate API server** (cleaner)
New Express/Fastify server that reads from SQLite + daemon cache:

```
apps/
├── radar/          # Current CLI + daemon (existing)
├── api/            # REST API server (new)
│   └── src/
│       ├── routes/
│       ├── middleware/  (auth, rate limiting)
│       └── db/          (Prisma schema)
└── web/            # Next.js frontend (new)
```

**Recommendation**: Start with Option A (extend daemon) to ship fast. Migrate to Option B when you need auth or separate scaling.

### 5.3 WebSocket for Frontend (Critical)

**Problem**: Current WS is Binance-to-daemon internal pipe. Frontend needs a client-facing WS.

**Solution**: Add a WebSocket server to the daemon that proxies Binance data to frontend clients.

```typescript
// New: WebSocket server for frontend clients
// Port: 9878 (existing WS port) or separate port

// Channels:
// - prices:SOLUSDT     — Real-time price updates
// - signals:SOLUSDT    — Signal updates on change
// - news               — New news articles
// - portfolio          — Paper trading position updates
// - market             — Market overview (all tickers snapshot)
```

Use `ws` npm package (already a transitive dependency) or `socket.io` for reliability features.

### 5.4 Authentication (Phase 2)

For a small team, start with simple auth:

- **NextAuth.js** on the frontend with GitHub/Google OAuth
- **JWT tokens** passed to backend API
- **Role-based**: admin (full access), viewer (read-only), trader (paper trading)

### 5.5 Historical Data Collector (Important)

**Problem**: No way to backfill historical data for ML training.

**Solution**: A background job that downloads and stores historical OHLCV:

```typescript
// Run daily via cron or Hermes cron
async function collectHistoricalData() {
  for (const symbol of TOKEN_LIST) {
    for (const interval of ['15m', '1h', '4h', '1d']) {
      const klines = await fetchKlines(symbol, interval, 1000);
      await storeKlines(symbol, interval, klines); // SQLite
    }
  }
}
```

**Existing capability**: Binance `GET /klines` supports up to 1000 candles. For 1d interval, that's ~2.7 years of data. For 1h, ~41 days. For 15m, ~10 days.

**For ML training**: You need months/years of data. Use the Binance historical data download API or CCXT's `fetchOHLCV` with pagination.

---

## 6. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-3)

| Task | Priority | Effort | Details |
|------|----------|--------|---------|
| SQLite database | P0 | 3 days | Schema, Prisma setup, data models, migrations |
| REST API endpoints | P0 | 4 days | Extend daemon with `/api/*` routes for all data |
| Historical data collector | P0 | 2 days | Background job to backfill OHLCV into SQLite |
| Additional data sources | P1 | 3 days | Funding rates, open interest, long/short ratio from Binance |
| Paper trading engine | P1 | 4 days | Simulated order execution, portfolio tracking, PnL |

### Phase 2: Frontend (Weeks 3-6)

| Task | Priority | Effort | Details |
|------|----------|--------|---------|
| Next.js project setup | P0 | 1 day | App router, Tailwind, shadcn/ui, TypeScript |
| Dashboard page | P0 | 3 days | Market overview, top signals, portfolio summary |
| Signals table | P0 | 2 days | Sortable/filterable table with TanStack Table |
| Token detail page | P0 | 3 days | TradingView chart, indicators, news, on-chain |
| Real-time WebSocket | P1 | 2 days | Socket.io server + client, live price updates |
| News feed page | P1 | 1 day | Aggregated news with sentiment |
| Paper trading UI | P1 | 2 days | Position management, trade execution, PnL charts |

### Phase 3: AI/ML (Weeks 6-10)

| Task | Priority | Effort | Details |
|------|----------|--------|---------|
| Feature computation pipeline | P0 | 3 days | Compute 110 features from raw data, store as Parquet |
| Label generation | P0 | 2 days | Forward-looking labels for supervised learning |
| LightGBM training pipeline | P0 | 3 days | Train/predict/evaluate, model serialization |
| Signal integration | P0 | 2 days | ML predictions as additional signal weight |
| Backtest framework enhancement | P1 | 3 days | Historical strategy evaluation with new data |
| Sentiment scoring | P1 | 2 days | LLM-based news sentiment analysis |
| RL agent (optional) | P2 | 5 days | PPO/SAC agent for position sizing |

### Phase 4: Polish (Weeks 10-12)

| Task | Priority | Effort | Details |
|------|----------|--------|---------|
| Auth system | P1 | 2 days | NextAuth.js, JWT, role-based access |
| Alert system | P1 | 2 days | Price alerts, signal alerts, webhook delivery |
| Performance optimization | P1 | 2 days | Caching, pagination, lazy loading |
| Mobile responsive | P2 | 2 days | Responsive layouts for mobile/tablet |
| Documentation | P2 | 1 day | API docs, deployment guide |

### Technology Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Frontend framework** | Next.js 14 (App Router) | TypeScript match, SSR, API routes, ecosystem |
| **Charting** | TradingView Lightweight Charts v4 | Industry standard, lightweight, financial-focused |
| **Styling** | Tailwind + shadcn/ui | Fast prototyping, consistent design system |
| **State management** | Zustand + React Query | Lightweight, separation of client/server state |
| **Database** | SQLite via Prisma | Zero ops, in-process, sufficient for small team |
| **API** | Extend daemon HTTP server | Fastest path, no new process |
| **WebSocket** | Socket.io | Auto-reconnect, rooms, fallback to polling |
| **ML framework** | LightGBM (via Python subprocess or ONNX) | Best for tabular data, proven in quant |
| **Paper trading** | Custom TypeScript engine | Full control, integrates with existing signals |
| **Parquet storage** | parquetjs npm package | Native Node.js Parquet support |

---

## Appendix A: Key npm Packages

```json
{
  "frontend": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "lightweight-charts": "^4.2.0",
    "@tanstack/react-query": "^5.50.0",
    "@tanstack/react-table": "^8.20.0",
    "zustand": "^4.5.0",
    "socket.io-client": "^4.7.0",
    "tailwindcss": "^3.4.0",
    "next-auth": "^4.24.0",
    "recharts": "^2.12.0",
    "date-fns": "^3.6.0",
    "clsx": "^2.1.0"
  },
  "backend": {
    "better-sqlite3": "^11.0.0",
    "prisma": "^5.15.0",
    "@prisma/client": "^5.15.0",
    "ws": "^8.17.0",
    "socket.io": "^4.7.0",
    "parquetjs": "^0.11.0",
    "fastify": "^4.28.0",
    "zod": "^3.23.0"
  }
}
```

## Appendix B: Binance Free API Endpoints for New Data

| Endpoint | Data | Rate Limit |
|----------|------|------------|
| `GET /fapi/v1/fundingRate` | Funding rate history | 10 req/sec |
| `GET /fapi/v1/openInterest` | Open interest | 10 req/sec |
| `GET /futures/data/globalLongShortAccountRatio` | Long/short ratio | 10 req/sec |
| `GET /futures/data/topLongShortPositionRatio` | Top trader positioning | 10 req/sec |
| `GET /futures/data/takerlongshortRatio` | Taker buy/sell ratio | 10 req/sec |
| `GET /fapi/v1/forceOrders` | Liquidation orders | 10 req/sec |
| `GET /api/v3/klines` | Historical klines (1000 max) | 10 req/sec |
| `GET /api/v3/depth` | Order book (levels: 5,10,20) | 10 req/sec |

## Appendix C: RSS Feeds to Add for Sentiment

| Feed | URL | Value |
|------|-----|-------|
| CoinDesk | `coindesk.com/arc/outboundfeeds/rss` | Breaking news |
| The Block | `theblock.co/rss.xml` | Institutional news |
| Decrypt | `decrypt.co/feed` | DeFi/Web3 news |
| Bankless | `podcast.bankless.com/rss` | Ethereum ecosystem |
| Unchained | `unchainedcrypto.com/feed` | Crypto industry |
| Rekt News | `rekt.news/feed` | DeFi exploits/hacks |

---

*Report generated: 2026-07-06*
*Project: Hermes Crypto Radar v2.0.0*
