# Hermes Crypto Radar — Dashboard Session Design

> **Status:** Design / Brainstorm
> **Target:** Single-page web app served from the daemon (F23 pattern) or standalone
> **Stack candidates:** React + TypeScript + Tailwind + Recharts/D3 + WebSocket
> **API surface:** Existing 16 REST routes + 6 WebSocket channels + ML pipeline

---

## 1. Site Map

```
/                          Landing page (marketing / hero)
/login                     Login
/signup                    Sign up
/forgot-password           Password reset
/dashboard                 Main dashboard (redirect after auth)
  /overview                 Portfolio summary + top signals + market pulse
  /signals                  Signal board with filters
  /signals/:symbol          Signal detail + breakdown
  /charts                   Charting suite
  /charts/:symbol           Single-token chart + indicators
  /portfolio                Paper trading dashboard
  /portfolio/trades         Trade history
  /portfolio/report         Performance report (Sharpe, returns, drawdown)
  /backtest                 Backtest runner + results
  /backtest/optimize        Weight optimization
  /ml                       ML pipeline dashboard
  /ml/models                Model management
  /ml/predictions           Prediction viewer
  /news                     News aggregation feed
  /correlation              N×N correlation heatmap
  /market                   Market overview (all tickers)
  /futures                  Futures data (funding, OI, LSR, liquidations)
  /fear-greed               Fear & Greed historical chart
  /cross-asset              Cross-asset dominance / market cap
  /admin                    User settings
  /admin/api-keys           API key management
  /admin/alerts             Alert rule configuration
  /admin/team               Team management (enterprise)
  /admin/health             System health dashboard
  /admin/export             Data export (XLSX, CSV, JSON, PDF)
```

---

## 2. Page-by-Page Breakdown

### 2.1 Landing Page (`/`)

**Purpose:** Marketing / first impression. Animated hero video via **HyperFrames**, feature showcase, CTA signup.

The hero section is a **HyperFrames composition** — an HTML+GSAP animated motion graphic rendered to WebM/MP4 and embedded as a `<video autoplay muted loop>` background or inline showcase. This gives a professional, cinematic feel without shipping a heavy animation framework to the SPA bundle.

```
┌──────────────────────────────────────────────────────────────┐
│  [Logo]  [Features] [Pricing] [Login] [Sign Up]             │
│──────────────────────────────────────────────────────────────│
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  HyperFrames Hero Video (auto-play, loop)               │  │
│  │  ┌──────────────────────────────────────────────────┐   │  │
│  │  │  Animated title + particle bg + live signal      │   │  │
│  │  │  ticker + chain icons sweeping in with GSAP     │   │  │
│  │  │  "Enterprise Crypto Market Intelligence"         │   │  │
│  │  │  49 tokens · 31 chains · 26 indicators · AI     │   │  │
│  │  │  [Start Free Trial →]  [See Live Demo ▸]         │   │  │
│  │  └──────────────────────────────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                              │
│── Features ──────────────────────────────────────────────────│
│  📊 Real-time signals        🤖 AI/ML predictions            │
│  📈 Professional charts      🔬 Backtesting engine           │
│  📰 News aggregation         💼 Paper trading                │
│  🔗 31 chains                 🔌 Hermes Agent integration    │
│                                                              │
│── Live Read-Only Preview ────────────────────────────────────│
│  [Embedded mini-dashboard: top signals + regime + chart,     │
│   pulled from daemon's latest scan, no auth required]        │
│                                                              │
│── Metrics Bar ───────────────────────────────────────────────│
│  $2.4T tracked · 49 tokens · 1222 tests passing · v2.1.0    │
│                                                              │
│── Footer ────────────────────────────────────────────────────│
│  Docs · API · GitHub · Terms · Privacy                      │
└──────────────────────────────────────────────────────────────┘
```

**HyperFrames hero composition plan:**
```
npx hyperframes init landing-hero --template swiss-grid
# Compose: animated title → chain icons stagger → 
# live signal ticker overlay → CTA pulse → fade to static
npx hyperframes render --quality high --output src/assets/hero.mp4
```

**API used (live preview section only):**
- `GET /api/stats` — test count, version
- `GET /api/signals?limit=3` — live signal preview
- `GET /api/fear-greed?limit=1` — market pulse
- No auth required for landing page reads

---

### 2.2 Auth (`/login`, `/signup`, `/forgot-password`)

**Login page:**
```
┌──────────────────────┐
│  [Logo]              │
│                      │
│  Welcome back        │
│                      │
│  Email               │
│  [________________]  │
│  Password            │
│  [________________]  │
│                      │
│  [Sign In →]         │
│  ─── or ───          │
│  [Google] [GitHub]   │
│                      │
│  Forgot password?    │
│  No account? Sign up │
└──────────────────────┘
```

**Signup adds:** Confirm password, accept ToS, optional invite code (enterprise)

**Auth model:**
- **Free tier:** Single user, 10 tokens, 1 profile
- **Pro tier:** All tokens, full API, backtesting
- **Enterprise:** Team accounts, SSO, audit logs, custom alerts

**Implementation:** JWT-based, stored in daemon-managed SQLite (users table) or external (Supabase/Auth0). The daemon already has SQLite — simplest path is a `users` table with bcrypt + JWT.

---

### 2.3 Dashboard — Overview (`/dashboard` or `/dashboard/overview`)

**The command center — first thing a user sees after login.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ Sidebar  │  Overview                       [Profile ▾] [⚙]     │
│──────────────┴──────────────────────────────────────────────────────│
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Portfolio    │ │ Active       │ │ Win Rate     │ │ Best       │ │
│  │ Equity       │ │ Signals      │ │ 68%          │ │ Performer  │ │
│  │ $12,430.50  │ │ 7            │ │ ↑ +5% (7d)  │ │ SOL +23%  │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────┐ ┌────────────────────┐ │
│  │  Top Signals (sorted by score)          │ │  Market Regime     │ │
│  │  ┌────────┬──────┬──────┬────────┬───┐  │ │                    │ │
│  │  │ Token  │ Dir  │Score │ ADX   │ ⚡│  │ │  🟢 Risk-On        │ │
│  │  │ SOL    │ 📈   │ 87   │ 32↗   │ 🔥│  │ │  Fear & Greed: 55  │ │
│  │  │ BTC    │ 📈   │ 72   │ 28↗   │ ✓ │  │ │  Neutral           │ │
│  │  │ ETH    │ 📉   │ -65  │ 35↗   │ ✓ │  │ │                    │ │
│  │  │ SUI    │ 📈   │ 58   │ 22→   │ ⚡│  │ │  BTC Dom: 45.2%   │ │
│  │  │ ...    │      │      │       │   │  │ │  Total MCap: $2.4T │ │
│  │  └────────┴──────┴──────┴────────┴───┘  │ └────────────────────┘ │
│  └─────────────────────────────────────────┘                       │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Recent News                                  [See all ▸]    │   │
│  │  📰 Solana breaks $200 — CoinDesk · 12m ago · relevance 0.92│   │
│  │  📰 Bitcoin ETF flows — Reuters · 34m ago · relevance 0.85  │   │
│  │  📰 Ethereum L2 surge — The Block · 1h ago · relevance 0.78 │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌────────────────────────────┐ ┌────────────────────────────────┐  │
│  │  Quick Actions             │ │  ML Predictions (next 4h)      │  │
│  │  [Run Scan] [Run Backtest] │ │  SOL: +3.2% (conf 78%)        │  │
│  │  [View Charts] [Export]   │ │  BTC: +1.1% (conf 85%)        │  │
│  └────────────────────────────┘ └────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints consumed:**
- `GET /api/portfolio` — equity, cash, holdings, PnL
- `GET /api/signals?limit=5&sort=score` — top signals
- `GET /api/tickers?limit=5&sort=momentum` — market pulse
- `GET /api/news?limit=3` — recent news
- `GET /api/predictions?limit=3` — ML predictions
- `GET /api/fear-greed?limit=1` — current Fear & Greed
- `GET /api/cross-asset?limit=1` — BTC dominance, total MCap
- `GET /api/stats` — system stats
- `WS prices` — real-time price updates

---

### 2.4 Signals Board (`/dashboard/signals`)

**All signals, sortable, filterable — the core decision surface.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ Signals Board                          [Search tokens...] [⚙]  │
│─────────────────────────────────────────────────────────────────────│
│  Filters: [All Chains ▾] [Direction ▾] [Min Score ▾] [Regime ▾]   │
│  Sort by: [Composite Score ▾]                                       │
│                                                                     │
│  ┌────────┬──────┬──────┬──────┬──────┬──────┬──────┬────────┬───┐ │
│  │ Token  │ Dir  │Score │Mom   │Tech  │News  │ADX   │Diverg  │ ⚡│ │
│  ├────────┼──────┼──────┼──────┼──────┼──────┼──────┼────────┼───┤ │
│  │ SOL    │ 📈 SB│ 87   │ 82   │ 75   │ 50   │ 32↗  │ Bull   │🔥 │ │
│  │ BTC    │ 📈 B │ 72   │ 68   │ 70   │ 60   │ 28↗  │ None   │ ✓ │ │
│  │ ETH    │ 📉 S │ -65  │ -55  │ -60  │ 40   │ 35↗  │ Bear   │ ✓ │ │
│  │ SUI    │ 📈 B │ 58   │ 62   │ 45   │ 55   │ 22→  │ None   │ ⚡│ │
│  │ ...    │      │      │      │      │      │      │        │   │ │
│  └────────┴──────┴──────┴──────┴──────┴──────┴──────┴────────┴───┘ │
│                                                                     │
│  [Click a row → Signal Detail Modal]                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  SOL — Strong Buy  (Score: 87)                               │   │
│  │                                                              │   │
│  │  Breakdown:                                                  │   │
│  │  Momentum:     bullish  (conf: 82) ━━━━━━━━━━━━━━━━━━━━    │   │
│  │  Technical:    bullish  (conf: 75) ━━━━━━━━━━━━━━━━━     │   │
│  │  News:         neutral  (conf: 50) ━━━━━━━━━━━━━         │   │
│  │  On-chain:     +15% boost (TVL >$1B, trending up)         │   │
│  │  Volume:       +5% (volVsAvg: 2.3×)                       │   │
│  │  Agreement:    +10% bonus (all 3 strategies align)        │   │
│  │  ADX filter:   1.0× (trending, 32)                        │   │
│  │                                                              │   │
│  │  Risk:  Volatility factor 0.7 — reduce position 30%         │   │
│  │  Alerts: 🟠 [HIGH] Strong trend (ADX 32.1)                  │   │
│  │                                                              │   │
│  │  ┌──────────────────────────────────┐                        │   │
│  │  │  4h Chart with indicators      │                        │   │
│  │  │  [candlestick + RSI + MACD]    │                        │   │
│  │  └──────────────────────────────────┘                        │   │
│  │                                                              │   │
│  │  [Trade on Paper ▸]  [View Full Chart ▸]  [Dismiss]         │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints:**
- `GET /api/signals?symbol=&minScore=&direction=&limit=` — filtered signals
- `GET /api/signals/:symbol` — signal detail
- `GET /api/regime/:symbol` — regime + indicators for chart
- `GET /api/tickers/:symbol` — current ticker
- `WS signals` — real-time signal updates

---

### 2.5 Charts & Analysis (`/dashboard/charts`, `/dashboard/charts/:symbol`)

**Professional-grade charting suite with all 26 indicators toggleable.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ Charts │ SOL/USDT                     [1h ▾] [Indicators ▾] [+] │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                                                              │   │
│  │  Price Chart (candlestick)                                   │   │
│  │  Overlays: EMA 20/50/200, BB, VWAP, PSAR                    │   │
│  │                                                              │   │
│  │  ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲  $187.43 (+2.3%)                       │   │
│  │  ╱  ╲╱  ╲╱  ╲╱  ╲╱  ╲                                      │   │
│  │  ──── EMA 20 ──── EMA 50 - - - EMA 200 . . .                │   │
│  │                                                              │   │
│  │  Volume histogram below                                      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌──────────────┐  │
│  │ RSI (55)    │ │ MACD        │ │ BB Width    │ │ Volume       │  │
│  │ ━━━━━━━━━━  │ │ ┃┃┃┃┃↑━    │ │ 0.05        │ │ Profile      │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └──────────────┘  │
│                                                                     │
│  Toggleable: [RSI] [MACD] [BB] [Stoch] [ADX] [OBV] [MFI] [ATR]    │
│  [+15 more...]                                                      │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Volume Profile     Support/Resistance     Patterns          │   │
│  │  POC: 185.20       S1: 182.50            Bullish Engulf     │   │
│  │  HVN: 184-186      R1: 189.00            Doji              │   │
│  │  LVN: 180-182      R2: 192.50                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints:**
- `GET /api/klines/:symbol?interval=&limit=` — kline data
- `GET /api/tickers/:symbol` — current price
- `GET /api/regime/:symbol` — regime + indicators
- `WS prices` — real-time price fills

---

### 2.6 Portfolio & Paper Trading (`/dashboard/portfolio`)

**The paper trading cockpit — track fake money, execute trades, see performance.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ Paper Trading                    [Profile: trader1 ▾] [⚙]      │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Cash         │ │ Holdings     │ │ Total Equity │ │ Total      │ │
│  │ $8,540.20   │ │ $3,245.00   │ │ $11,785.20  │ │ Return     │ │
│  │              │ │ 3 positions  │ │              │ │ +17.85%    │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                     │
│  ┌─────────────┬────────┬────────┬──────────┬──────────┬──────────┐ │
│  │ Token       │ Qty    │ Avg    │ Current  │ P&L      │ Actions  │ │
│  ├─────────────┼────────┼────────┼──────────┼──────────┼──────────┤ │
│  │ SOL         │ 15.0   │ 153.33 │ 187.43   │ +511.50  │ [Sell]   │ │
│  │ BTC         │ 0.5    │ 51,000 │ 54,200   │ +1,600   │ [Sell]   │ │
│  │ ETH         │ 2.0    │ 3,200  │ 3,150    │ -100     │ [Sell]   │ │
│  └─────────────┴────────┴────────┴──────────┴──────────┴──────────┘ │
│                                                                     │
│  [Buy SOL] trade form: amount ___ reason ___ [Execute]              │
│                                                                     │
│  ┌─ Trade History ───────────────────────────────────────────────┐  │
│  │ # │ Date │ Pair │ Side │ Qty │ Price │ Total  │ P&L    │ Rsn│  │
│  │ 1 │ 7/12 │ SOL  │ Buy  │ 10  │ 150   │ 1,500  │ --     │ sig│  │
│  │ 2 │ 7/12 │ SOL  │ Buy  │ 5   │ 160   │ 800    │ --     │ sig│  │
│  │ 3 │ 7/11 │ BTC  │ Sell │ 1   │ 52,000│ 52,000 │ +2,000 │ tp │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Performance Report ─────────────────────────────────────────┐  │
│  │  Win Rate: 50%    Sharpe: 0.85    Best: +2,000   Worst: -1K  │  │
│  │  Equity Curve: [╱╲╱╲╱╲╱╲╱╲╱╲]                               │  │
│  │  Per-token breakdown: SOL: +511, BTC: +600, ETH: -100        │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Agent Play ─────────────────────────────────────────────────┐  │
│  │  [Run Agent]  [Config: maxPerTrade $1000, minConf 0.3]      │  │
│  │  Last run: 7/12 14:30 — 3 trades executed, $245 realized    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints:**
- `GET /api/portfolio?profile=` — portfolio snapshot
- `GET /api/portfolio/trades?profile=&status=` — all trades
- `POST /api/portfolio/trade` — **NEW** execute a paper trade (needs endpoint)
- `POST /api/portfolio/agent-play` — **NEW** run agent with config
- `WS portfolio` — real-time P&L updates

---

### 2.7 Backtesting (`/dashboard/backtest`, `/dashboard/backtest/optimize`)

**Run historical simulations, compare strategies, optimize weights.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ Backtesting                                        [New Test ▸] │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│  ┌─ Run Configuration ──────────────────────────────────────────┐   │
│  │  Tokens: [SOL] [BTC] [ETH] [SUI] [APT] [+ Add]              │   │
│  │  Interval: [1h ▾]   Horizon: [1 ▾]   Mode: [Forward ▾]      │   │
│  │  Min Confidence: [0.3]   Date Range: [7d ▾]                  │   │
│  │  [Run Backtest ▸]   [Save Configuration]   [Load Config]     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ Results ───────────────────────────────────────────────────┐   │
│  │  Overall:                                                    │   │
│  │  Win Rate: 62.5%   Total Return: +18.4%   Sharpe: 1.24      │   │
│  │  Max Drawdown: -8.2%   Total Signals: 187                    │   │
│  │                                                              │   │
│  │  Equity Curve:  ╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲╱╲                     │   │
│  │                                                              │   │
│  │  By Direction:                                               │   │
│  │  Buy: 62% WR (120 sig)   Sell: 58% WR (67 sig)              │   │
│  │  Strong Buy: 72% WR       Strong Sell: 55% WR               │   │
│  │                                                              │   │
│  │  Per Symbol:                                                 │   │
│  │  SOL: 65% WR, +22.1%, Sharpe 1.45                           │   │
│  │  BTC: 58% WR, +15.3%, Sharpe 1.02                           │   │
│  │  ETH: 52% WR, +8.2%,  Sharpe 0.78                           │   │
│  │                                                              │   │
│  │  [Export Results ▸]  [Compare ▸]  [Optimize Weights ▸]      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ Saved Backtests ────────────────────────────────────────────┐   │
│  │  # │ Date    │ Tokens    │ Horizon │ WR    │ Sharpe │        │   │
│  │  1 │ 7/12    │ SOL,BTC   │ 1       │ 62.5% │ 1.24   │ [Load]│   │
│  │  2 │ 7/11    │ SOL,ETH   │ 3       │ 55.0% │ 0.92   │ [Load]│   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**Weight Optimization page:**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Weight Optimization                                                │
│                                                                     │
│  Current Weights:    Momentum 0.40  MR 0.20  TF 0.40               │
│  Step: [0.05 ▾]  Min Weight: [0.10 ▾]  Metric: [Sharpe ▾]        │
│                                                                     │
│  [Run Optimization ▸]                                               │
│                                                                     │
│  Best Weights Found:  Momentum 0.35  MR 0.15  TF 0.50              │
│  Improvement:  Sharpe +0.31  Win Rate +4.2%  Return +5.8%          │
│                                                                     │
│  ┌─ 3D/Heatmap visualization of weight combos ─────────────────┐   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Apply to Engine ▸]  [Save as Preset ▸]                           │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints:**
- `GET /api/backtest` — **NEW** run + return results (or use existing CLI)
- `GET /api/backtest/optimize` — **NEW** weight optimization
- Existing: `crypto-radar backtest` CLI call via Hermes plugin

---

### 2.8 ML Predictions (`/dashboard/ml`)

**Monitor model health, see predictions, train/retrain.**

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ ML Pipeline                      [Last trained: 7/12 03:00 UTC] │
│─────────────────────────────────────────────────────────────────────│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Model        │ │ Features     │ │ Predictions  │ │ Accuracy   │ │
│  │ LightGBM v3  │ │ 80+          │ │ 49 tokens    │ │ 72.3%      │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                     │
│  ┌─ Predictions ─────────────────────────────────────────────────┐  │
│  │  ┌────────┬────────┬────────┬────────┬────────┬─────────────┐ │  │
│  │  │ Token  │ Dir    │Conf    │Target  │Horizon │ Model Age   │ │  │
│  │  ├────────┼────────┼────────┼────────┼────────┼─────────────┤ │  │
│  │  │ SOL    │ 📈 +3.2│ 78%    │ $193   │ 4h     │ 2h          │ │  │
│  │  │ BTC    │ 📈 +1.1│ 85%    │ $54,800│ 4h     │ 2h          │ │  │
│  │  │ ETH    │ 📉 -0.8│ 62%    │ $3,125 │ 4h     │ 2h          │ │  │
│  │  └────────┴────────┴────────┴────────┴────────┴─────────────┘ │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─ Training History ────────────────────────────────────────────┐  │
│  │  Run │ Date       │ Samples │ Features │ Score │ Duration    │  │
│  │  1   │ 2026-07-12 │ 12,400  │ 84       │ 0.723 │ 4m 12s      │  │
│  │  2   │ 2026-07-11 │ 11,800  │ 82       │ 0.715 │ 3m 58s      │  │
│  │  3   │ 2026-07-10 │ 10,200  │ 80       │ 0.698 │ 3m 44s      │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  [Retrain Now] [View Feature Importance] [Download Model]          │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints:**
- `GET /api/predictions?symbol=&model_id=&minConfidence=&limit=`
- `GET /api/predictions/:symbol`
- `POST /api/ml/train` — **NEW** trigger training
- `GET /api/ml/status` — **NEW** training status
- `GET /api/ml/feature-importance` — **NEW** feature importance data

---

### 2.9 News Feed (`/dashboard/news`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ News Feed                       [11 sources] [Search...] [⚙]   │
│─────────────────────────────────────────────────────────────────────│
│  Filters: [All Tokens ▾] [All Sources ▾] [Min Relevance ▾]        │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ 🔴 [CRITICAL] Solana breaks $200 — CoinDesk                  │   │
│  │   12m ago · relevance 0.92 · bullish sentiment               │   │
│  │   "SOL surged past $200 for the first time..."               │   │
│  │   Tags: SOL, momentum, breakout                               │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ 🟠 [HIGH] Bitcoin ETF breaks $100B AUM — Reuters            │   │
│  │   34m ago · relevance 0.85 · neutral sentiment               │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │ 🟡 [MEDIUM] Ethereum L2 activity surges 40% — The Block     │   │
│  │   1h ago · relevance 0.78 · bullish sentiment                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  [Load More ▸]                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints:**
- `GET /api/news?symbol=&source=&limit=`
- `WS news` — real-time news alerts

---

### 2.10 Correlation Matrix (`/dashboard/correlation`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ Correlation Engine                [Period: 30d ▾]               │
│─────────────────────────────────────────────────────────────────────│
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │           SOL    BTC    ETH    SUI    APT    SEI    INJ      │   │
│  │  SOL      1.00   0.32   0.45   0.28   0.31   0.22   0.35    │   │
│  │  BTC      0.32   1.00   0.68   0.15   0.12   0.08   0.25    │   │
│  │  ETH      0.45   0.68   1.00   0.30   0.28   0.18   0.38    │   │
│  │  SUI      0.28   0.15   0.30   1.00   0.55   0.42   0.20    │   │
│  │  APT      0.31   0.12   0.28   0.55   1.00   0.48   0.18    │   │
│  │  SEI      0.22   0.08   0.18   0.42   0.48   1.00   0.15    │   │
│  │  INJ      0.35   0.25   0.38   0.20   0.18   0.15   1.00    │   │
│  │                                                              │   │
│  │  Color: 🟢 Strong positive  🟡 Weak  🔴 Strong negative     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Cross-asset data: BTC Dom 45.2% · ETH Dom 18.1% · Total $2.4T    │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints:**
- `GET /api/cross-asset?limit=`
- **NEW** `GET /api/correlation?period=` — correlation matrix data

---

### 2.11 Market Overview (`/dashboard/market`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ Market Overview                         [Chain ▾] [Sort ▾] [🔍]│
│─────────────────────────────────────────────────────────────────────│
│  ┌────────┬──────────┬────────┬────────┬────────┬────────┬────────┐ │
│  │ Token  │ Price    │ 24h Chg│ Volume │ Mom    │ RSI    │ Signal │ │
│  ├────────┼──────────┼────────┼────────┼────────┼────────┼────────┤ │
│  │ BTC    │ $54,200  │ +2.3%  │ 28B    │ 0.82   │ 58     │ 📈 B  │ │
│  │ ETH    │ $3,150   │ -0.8%  │ 12B    │ 0.45   │ 42     │ 📉 S  │ │
│  │ SOL    │ $187.43  │ +5.2%  │ 4.2B   │ 0.91   │ 65     │ 📈 SB │ │
│  │ ...    │          │        │        │        │        │       │ │
│  └────────┴──────────┴────────┴────────┴────────┴────────┴────────┘ │
│                                                                     │
│  Chain filters: [All] [Solana] [Ethereum] [BNB] [Cosmos] [...]    │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints:**
- `GET /api/tickers?symbol=&chain=&limit=`
- `GET /api/tickers/:symbol`
- `WS prices`

---

### 2.12 Futures & Derivatives (`/dashboard/futures`)

```
┌─────────────────────────────────────────────────────────────────────┐
│  ☰ Futures Data                           [Symbol: SOL ▾] [⚙]     │
│─────────────────────────────────────────────────────────────────────│
│  ┌─ Funding Rate ───────┐ ┌─ Open Interest ───┐ ┌─ L/S Ratio ────┐ │
│  │  0.01% (8h)          │ │  $1.2B             │ │  55/45         │ │
│  │  ━━━━━━━━╱╲━━━━━━━━  │ │  ━━━╱╲━━━━━━━━━━  │ │  Long bias     │ │
│  └───────────────────────┘ └───────────────────┘ └────────────────┘ │
│                                                                     │
│  ┌─ Liquidations ──────────────────────────────────────────────┐   │
│  │  ┌──────┬──────────┬───────┬────────┬──────────┬──────────┐ │   │
│  │  │ Time │ Side     │ Price │ Qty    │ USD      │          │ │   │
│  │  │ 14:30│ SELL     │ 185.2 │ 12,500 │ $2.31M   │          │ │   │
│  │  │ 14:15│ BUY      │ 183.0 │ 8,200  │ $1.50M   │          │ │   │
│  │  └──────┴──────────┴───────┴────────┴──────────┴──────────┘ │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**API endpoints:**
- `GET /api/futures/:symbol?type=funding&limit=`
- `GET /api/futures/:symbol?type=oi`
- `GET /api/futures/:symbol?type=lsratio`
- `GET /api/futures/:symbol?type=liquidations`

---

### 2.13 Settings & Admin

**User Settings (`/dashboard/admin`):**
- Profile (name, email, avatar)
- Password change
- Notification preferences
- Theme (dark/light) — app is dark-first

**API Keys (`/dashboard/admin/api-keys`):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  API Keys                                              [New Key ▸] │
│                                                                     │
│  ┌──────────┬──────────────────────┬──────────┬──────────┬────────┐ │
│  │ Name     │ Key                  │ Created  │ Last Used│ Status │ │
│  ├──────────┼──────────────────────┼──────────┼──────────┼────────┤ │
│  │ Trading  │ hcr_sk_...a1b2      │ 7/12     │ Active   │ 🔴 Rev │ │
│  │ Dev      │ hcr_sk_...c3d4      │ 7/10     │ 2h ago   │ 🟢     │ │
│  └──────────┴──────────────────────┴──────────┴──────────┴────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

**Alert Rules (`/dashboard/admin/alerts`):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Alert Rules                                          [+ New Rule] │
│                                                                     │
│  ┌─ Webhook Channels ───────────────────────────────────────────┐   │
│  │  🔔 Discord  ✅ Connected  [Test]                              │   │
│  │  🔔 Telegram ✅ Connected  [Test]                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─ Rules ─────────────────────────────────────────────────────┐    │
│  │  When [SOL] score > [80] → notify [Discord + Telegram]     │    │
│  │  When [BTC] RSI > [75] → notify [Discord]                  │    │
│  │  When [Any] volume > [3x avg] → notify [All]               │    │
│  └────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**System Health (`/dashboard/admin/health`):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  System Health                              [Last: 14:32:01 UTC]   │
│                                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ │
│  │ Daemon       │ │ Binance API  │ │ DeFiLlama    │ │ WebSocket  │ │
│  │ 🟢 Online    │ │ 🟢 OK        │ │ 🟢 OK        │ │ 🟢 12 conn │ │
│  │ 12d uptime   │ │ 98ms latency │ │ 145ms lat    │ │            │ │
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘ │
│                                                                     │
│  DB stats: 124K klines · 3.2K signals · 1.8K news · 15MB          │
│  Collector: last run 14:00 · next run 18:00 · klines OK            │
│  ML model: LightGBM v3 · age 2h · 72.3% accuracy                   │
└─────────────────────────────────────────────────────────────────────┘
```

**Data Export (`/dashboard/admin/export`):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  Data Export                                                        │
│                                                                     │
│  Format: [📊 XLSX] [📄 CSV] [📋 JSON] [📑 PDF]                   │
│  Scope:  [All tokens ▾]  [Date range ▾]                            │
│  Include: ☑ Signals  ☑ Tickers  ☑ News  ☑ Backtest                │
│           ☑ Portfolio  ☑ Predictions  ☑ Correlation                │
│                                                                     │
│  [Export ▸]                                                          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Enterprise Features Not Yet In API

The following require **new backend endpoints** or infrastructure to support the dashboard:

| Feature | Status | Priority |
|---|---|---|
| **Multi-user auth (JWT + roles)** | New | P0 — blocks all dashboards |
| **User management (CRUD)** | New | P0 |
| **POST /api/portfolio/trade** | New | P0 — paper trading needs execution |
| **POST /api/portfolio/agent-play** | New | P1 |
| **GET /api/backtest** (HTTP endpoint) | New | P1 — currently CLI-only |
| **GET /api/backtest/optimize** | New | P1 |
| **GET /api/correlation** | New | P1 |
| **POST /api/ml/train** | New | P1 |
| **GET /api/ml/status** | New | P1 |
| **GET /api/ml/feature-importance** | New | P2 |
| **GET /api/alerts/rules** + CRUD | New | P2 |
| **GET /api/admin/api-keys** + CRUD | New | P2 |
| **Export endpoint** | New | P2 |
| **Audit log** | New | P3 — enterprise |
| **Team workspaces** | New | P3 — enterprise |
| **WebSocket auth** | New | P0 — auth required for WS |
| **Multi-profile portfolio** | Already exists | — |
| **Role-based access (admin/analyst/viewer)** | New | P3 |

---

## 4. Architecture — Vercel + Railway

### Architecture diagram

```
┌──────────────────────────────────────┐     ┌──────────────────────────────────┐
│         Vercel (CDN edge)            │     │     Railway (Docker container)   │
│                                      │     │                                  │
│  ┌──────────────────────────────┐    │     │  ┌────────────────────────┐      │
│  │  Vite SPA (React 19 + TW v4) │    │     │  │  Daemon (Node 26)      │      │
│  │                              │    │     │  │                        │      │
│  │  Landing (HyperFrames hero)  │    │     │  │  REST API (port 3178)  │      │
│  │  Dashboard (all pages)       │────┼─────┼──│  WS /ws                │      │
│  │  Static assets               │API │  WS  │  │  Collector cron        │      │
│  │                              │    │     │  │  ML pipeline           │      │
│  └──────────────────────────────┘    │     │  │  SQLite DB             │      │
│                                      │     │  │                        │      │
│  VITE_API_URL=https://               │     │  └────────────────────────┘      │
│  crypto-daemon.railway.app           │     │                                  │
└──────────────────────────────────────┘     └──────────────────────────────────┘
```

### Why this split

| Concern | Old: Embedded in daemon | New: Vercel + Railway |
|---|---|---|
| **Frontend deploys** | Rebuild entire daemon for a CSS change | `git push` → Vercel builds in 15s |
| **Backend updates** | Rolling restart serves stale UI | Railway container redeploys independently |
| **CDN** | None — daemon serves assets on-demand | Vercel global edge (100+ PoPs) |
| **WebSocket** | Same port, trivially handled | Railway containers handle WS natively. Vercel supports WS (2026) but not needed — browser → Railway direct |
| **Cost** | Free (your own server) | Frontend free (Vercel). Backend $5–20/mo Railway |
| **Docker** | Not needed | Railway auto-detects Dockerfile, builds, deploys |
| **Local dev** | One process | `npm run dev` on frontend, `npm run daemon` on backend — clean separation |
| **Scaling** | Vertical only | Frontend CDN-autoscaled, backend independently scalable |

### Repo structure

```
hermes-crypto-radar/          # Existing repo = backend (daemon + API + WS + collector)
  ├── src/                    # TypeScript source
  ├── dist/                   # Compiled JS
  ├── Dockerfile              # Railway build
  ├── .railway.json           # Railway config
  └── ...

crypto-radar-dashboard/       # New repo = frontend (Vite SPA)
  ├── src/                    # React + TypeScript source
  ├── public/                 # hero.mp4 (from HyperFrames)
  ├── vercel.json             # SPA rewrites
  ├── .env.example            # VITE_API_URL
  └── ...
```

### Backend Dockerfile

Place in the existing `hermes-crypto-radar/` repo root:

```dockerfile
FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

FROM node:26-alpine AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
COPY scripts/ ./scripts/
COPY plugin.yaml ./

EXPOSE 3178

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3178/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/cli.js", "daemon"]
```

Two-stage build keeps the runtime image small (only `dist/`, `node_modules`, and essentials — no `src/`, no dev deps).

### Railway config

Place `.railway.json` at `hermes-crypto-radar/` root:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "numReplicas": 1,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 5
  }
}
```

**Railway setup steps (one-time):**
1. Push `hermes-crypto-radar` to GitHub
2. In Railway dashboard: **New Project → Deploy from GitHub repo**
3. Railway auto-detects `Dockerfile` and builds
4. Railway assigns `https://crypto-daemon.railway.app` (or custom domain)
5. Set env vars: none needed (daemon uses defaults)

### Frontend Vercel config

Place `vercel.json` at the new `crypto-radar-dashboard/` root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

**Vercel setup steps (one-time):**
1. Create new repo `crypto-radar-dashboard`
2. Push to GitHub
3. In Vercel dashboard: **Import GitHub repo**
4. Set env var: `VITE_API_URL=https://crypto-daemon.railway.app`
5. Deploy → `https://crypto-radar.vercel.app`

### CORS config (daemon side)

The daemon needs one header to accept requests from Vercel. Add to the REST handler:

```typescript
// In daemon's HTTP createServer, before routing:
res.setHeader('Access-Control-Allow-Origin', 'https://crypto-radar.vercel.app');
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
```

For local dev, use `http://localhost:5173` as the origin.

### WebSocket handling

WebSocket connections go **directly from browser → Railway** — no proxy needed. The frontend connects:

```typescript
const ws = new WebSocket(`wss://crypto-daemon.railway.app/ws?token=${jwt}`);
```

Railway's TCP proxy handles WebSocket upgrade transparently.

### Local development

```bash
# Terminal 1: backend
cd hermes-crypto-radar
npm run build && node dist/cli.js daemon
# → http://localhost:3178/api/health

# Terminal 2: frontend
cd crypto-radar-dashboard
VITE_API_URL=http://localhost:3178 npm run dev
# → http://localhost:5173
```

Both running locally, the frontend dev server proxies API calls to the local daemon. Zero Docker needed for development.

### Cost summary

| Service | What it runs | Monthly |
|---|---|---|
| Vercel (frontend) | Static SPA + assets + HyperFrames hero video | **Free** (Hobby/Pro) |
| Railway (backend) | Docker container, 512MB–1GB RAM, always-on | **$5–20/mo** |
| Railway volume (optional) | SQLite persistence across restarts | **$0** (Railway volumes free up to 1GB) |
| **Total** | | **$5–20/mo** |

---

## 5. Tech Stack (2026 Current)

| Layer | Choice | Version | Bundle | Notes |
|---|---|---|---|---|
| **Framework** | React + Vite SPA | React 19, Vite 6 | ~40KB (react+react-dom) | Dashboard is internal — no SSR. If SEO needed later, Next.js 16 with `output: 'export'` |
| **Language** | TypeScript strict | 5.8+ | 0KB (compile-time) | Project already uses TS 6.0.3 |
| **Styling** | Tailwind CSS v4 | v4.1 | ~10KB (purged) | Rust-based Oxide engine. CSS-native `@theme`, no tailwind.config.js. OKLCh tokens. Lightning CSS |
| **Components** | shadcn/ui | 2026 vendored | ~0KB until used | CLI `npx shadcn-ui@latest add` — you own the code, no runtime dep |
| **Candlestick** | Lightweight Charts | v5 | **35KB gzip** | Multi-pane, plugin system, Apache 2.0, 40K+ companies |
| **Standard Charts** | Recharts | v3 | ~30KB (tree-shaken) | Bar, line, pie, area for non-financial viz |
| **Data Tables** | TanStack Table | v8 | ~15KB | Virtual rows for 10K+ signals |
| **Server State** | TanStack Query | v5 | ~13KB | REST + WS cache. Auto-refetch, dedup |
| **UI State** | Zustand | v5 | **~1.1KB** | Sidebar, theme, selected token, layout |
| **Routing** | React Router | v7 | ~8KB | SPA routing. TanStack Router also viable |
| **Auth** | better-auth | 2026 | ~5KB | Best TS DX, plugin system, 2FA. Or simple JWT since daemon owns both ends |
| **Forms** | react-hook-form + zod | latest | ~12KB combined | Validation, perf |
| **Icons** | Lucide | latest | tree-shaken | Only imported icons in bundle |
| **Animations** | Framer Motion | latest | ~15KB (tree-shaken) | Route transitions, micro-interactions. Can skip entirely for zero cost |
| **WS Client** | Native WebSocket | built-in | **0KB** | With reconnection wrapper (~50 lines) |
| **Build** | Vite 6 | 6.x | — | ESBuild dev, Rollup prod. `@tailwindcss/vite` plugin |
| **Testing** | Vitest + Playwright | latest | — | Vitest matches existing project |

### Bundle Size Budget

| Asset | Target (gzip) | Notes |
|---|---|---|
| **Initial JS** (main entry) | **≤ 100KB** | React + Router + Zustand + TanStack Query + icon sprites |
| **Signals page JS** (lazy) | ≤ 30KB | TanStack Table + signal components |
| **Charts page JS** (lazy) | ≤ 45KB | Lightweight Charts + indicator presets |
| **Portfolio page JS** (lazy) | ≤ 25KB | Forms + portfolio components |
| **Backtest page JS** (lazy) | ≤ 25KB | Recharts + form config |
| **ML page JS** (lazy) | ≤ 15KB | Prediction cards + training table |
| **Landing hero video** | ≤ 2MB | HyperFrames rendered MP4, compressed with `ffmpeg -crf 23` |
| **CSS** (critical) | ≤ 15KB | Purged Tailwind output |
| **Total initial load** | **≤ 160KB** | Well under 200KB target |

### Bundle Size Strategy

1. **Route-level code splitting** — every `/dashboard/*` page is a `React.lazy()` + `Suspense`. Initial bundle is just the shell + overview.
2. **No runtime chart imports on non-chart pages** — Lightweight Charts loads only on `/dashboard/charts`.
3. **TanStack Query deduplicates API calls** — 10 components reading the same signal list share one cache entry.
4. **Zustand stores are lazy** — create them with factory functions, not singletons.
5. **shadcn/ui** — zero overhead until you add a component. No massive UI library import.
6. **Lucide icons** — tree-shaken per-import, not an icon font.
7. **Monitor with:** `npx vite-bundle-visualizer` or `rollup-plugin-visualizer`.

### Key Tailwind CSS v4 setup (CSS-native, no config file)

```css
/* app/globals.css */
@import "tailwindcss";

@theme {
  --color-background: #0f1117;
  --color-surface: #1a1d27;
  --color-surface-hover: #242736;
  --color-border: #2a2d3a;
  --color-primary: #6366f1;
  --color-success: #22c55e;
  --color-danger: #ef4444;
  --color-warning: #f59e0b;
  --color-text-primary: #f1f5f9;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;
  --color-chart-grid: #1e293b;
}

/* Dark mode is default (crypto app) */
:root {
  color-scheme: dark;
}
```

### Why Vite SPA over Next.js for the frontend

- Dashboards don't need SSR (no SEO, no public-facing content beyond landing page)
- Vite SPA deploys to Vercel trivially as a static site — same CDN benefits as Next.js
- No server-side Node runtime needed for the frontend (the daemon handles everything backend)
- If you later need SEO on the landing page, add it as a separate Next.js app on a subdomain

---

## 6. Color Palette (Dark Theme — OKLCh)

The app is **dark-first** (crypto trading standard). Light mode is a future toggle.

```css
@theme {
  /* Background layers */
  --color-bg-deep:    oklch(0.13 0.02 265);   /* #0f1117 — page bg */
  --color-bg-surface: oklch(0.17 0.02 265);   /* #1a1d27 — card bg */
  --color-bg-elevated: oklch(0.20 0.02 265);  /* #242736 — hover/dropdown */

  /* Borders */
  --color-border: oklch(0.23 0.02 265);        /* #2a2d3a */

  /* Brand / interactive */
  --color-primary:       oklch(0.59 0.24 280); /* #6366f1 — indigo */
  --color-primary-hover: oklch(0.52 0.26 280); /* darker indigo */

  /* Semantic */
  --color-bullish:  oklch(0.62 0.23 145);      /* #22c55e — green */
  --color-bearish:  oklch(0.58 0.25 25);       /* #ef4444 — red */
  --color-neutral:  oklch(0.72 0.16 80);       /* #f59e0b — amber */

  /* Text */
  --color-text-primary:   oklch(0.92 0.01 265); /* #f1f5f9 */
  --color-text-secondary: oklch(0.65 0.03 265); /* #94a3b8 */
  --color-text-muted:     oklch(0.50 0.03 265); /* #64748b */

  /* Chart */
  --color-chart-grid: oklch(0.20 0.02 265);     /* #1e293b — grid lines */
}
```

---

## 7. Implementation Phases

### Phase 1 — Foundation (4-6 days)

**Backend (hermes-crypto-radar repo):**
- [ ] Add `Dockerfile` (two-stage Node 26 Alpine build)
- [ ] Add `.railway.json` (Docker builder, healthcheck at /api/health)
- [ ] Add CORS middleware to daemon HTTP handler (allow Vercel origin)
- [ ] Push to GitHub → Railway auto-deploys → `https://crypto-daemon.railway.app`
- [ ] Verify: `curl https://crypto-daemon.railway.app/api/health` → `{"status":"ok"}`

**Frontend (crypto-radar-dashboard repo — new):**
- [ ] Scaffold: `npm create vite@latest` → React + TypeScript
- [ ] Add Tailwind CSS v4: `npm install tailwindcss @tailwindcss/vite` + `@tailwindcss/vite` plugin
- [ ] Add shadcn/ui: `npx shadcn-ui@latest init` then `npx shadcn-ui@latest add button card chart sidebar table`
- [ ] Add `vercel.json` (SPA rewrites)
- [ ] Auth: better-auth or simple JWT (calls daemon auth endpoint)
- [ ] Dashboard skeleton: sidebar (Lucide icons), topbar, content area
- [ ] Zustand store: theme, sidebar open/closed, selected token
- [ ] Overview page: metric cards + top signals + recent news
- [ ] WebSocket connection to `wss://crypto-daemon.railway.app/ws`
- [ ] **Landing page**: HyperFrames hero video (`npx hyperframes init → compose → render → public/hero.mp4`)
- [ ] Landing page React component: embed hero video + live preview + metrics bar
- [ ] Landing page protected routes (redirect to /dashboard if authenticated)
- [ ] Set `VITE_API_URL=https://crypto-daemon.railway.app` in Vercel env
- [ ] Push to GitHub → Vercel auto-deploys → `https://crypto-radar.vercel.app`
- [ ] **Bundle budget check:** `npx vite-bundle-visualizer` — initial JS ≤ 100KB ✅
- [ ] **Milestone:** Authenticated user sees overview with live data from Railway ✅

### Phase 2 — Core Pages (5-7 days)

- [ ] **Signals Board** — TanStack Table with sort/filter (direction, chain, min score). Click-through detail modal with signal breakdown bar chart
- [ ] **Charts** — TradingView Lightweight Charts v5: candlestick series, volume histogram, indicator overlays (RSI, MACD, BB). Toggleable indicators via pane system
- [ ] **Portfolio** — Holdings table with P&L coloring, trade history, buy/sell forms. Agent Play controls
- [ ] **Market Overview** — All-tickers table with chain filter. Color-coded change %, sort by volume/momentum

### Phase 3 — Power Features (4-5 days)

- [ ] **Backtest Runner** — Configuration form, execute, results page (equity curve via Recharts, per-symbol breakdown table, Sharpe/win rate cards)
- [ ] **Weight Optimization** — 3D/heatmap visualization (Recharts), preset save/load
- [ ] **ML Predictions** — Prediction table, training history, retrain button
- [ ] **News Feed** — Priority-badged cards, filter by symbol/source, relevance score bar
- [ ] **Correlation Matrix** — Interactive heatmap (D3 + canvas for performance)

### Phase 4 — Enterprise & Polish (3-4 days)

- [ ] **API Key Management** — CRUD table, generate/revoke
- [ ] **Alert Rules** — Rule builder (when X happens → notify channel Y), webhook test buttons
- [ ] **Futures Data** — Funding rate chart, OI area chart, liquidation table
- [ ] **Export Center** — Select format (XLSX/CSV/JSON), scope, download
- [ ] **System Health** — Service status cards, DB stats, collector schedule, ML model age
- [ ] **Landing Page** — Standalone public page (or use Next.js 16 subdomain later)
- [ ] **Dark/Light toggle** — CSS variable swap at `:root` level
- [ ] **Performance** — React.lazy route splitting, TanStack Query stale-while-revalidate, virtual table rows

## 8. Wireframe: Sidebar Navigation

```
┌──────────────┬──────────────────────────────────────────────────────┐
│  ☰          │  [Content Area]                                       │
│             │                                                       │
│  ◆ Overview │                                                       │
│  ⚡ Signals  │                                                       │
│  📈 Charts   │                                                       │
│  💼 Portfolio│                                                       │
│  🔬 Backtest │                                                       │
│  🤖 ML       │                                                       │
│  📰 News     │                                                       │
│  🔗 Correl   │                                                       │
│  🌐 Market   │                                                       │
│  📊 Futures  │                                                       │
│  ──────────  │                                                       │
│  ⚙ Admin     │                                                       │
│  │ ├ Keys    │                                                       │
│  │ ├ Alerts  │                                                       │
│  │ ├ Health  │                                                       │
│  │ └ Export  │                                                       │
│             │                                                       │
│  🟢 Online   │                                                       │
│  v2.1.0     │                                                       │
└──────────────┴──────────────────────────────────────────────────────┘
```
