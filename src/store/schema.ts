import type { DatabaseSync } from 'node:sqlite';

export const SCHEMA_VERSION = 1;

export const SCHEMA_DDL = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS klines (
  symbol       TEXT    NOT NULL,
  interval     TEXT    NOT NULL,
  open_time    INTEGER NOT NULL,
  open         REAL, high REAL, low REAL, close REAL,
  volume       REAL, quote_volume REAL,
  taker_buy_vol REAL, taker_buy_quote_vol REAL,
  PRIMARY KEY (symbol, interval, open_time)
);

CREATE TABLE IF NOT EXISTS tickers (
  symbol            TEXT NOT NULL,
  ts_utc            TEXT NOT NULL,
  price             REAL, price_change_pct REAL,
  volume            REAL, quote_volume REAL,
  rsi REAL, macd_hist REAL, bb_width REAL, atr_pct REAL,
  adx REAL, regime TEXT, composite_score REAL,
  PRIMARY KEY (symbol, ts_utc)
);

CREATE TABLE IF NOT EXISTS signals (
  symbol            TEXT NOT NULL,
  ts_utc            TEXT NOT NULL,
  composite_score   REAL, direction TEXT,
  momentum_score    REAL, mean_reversion_score REAL, trend_following_score REAL,
  regime TEXT, adx REAL,
  PRIMARY KEY (symbol, ts_utc)
);

CREATE TABLE IF NOT EXISTS news (
  id          TEXT PRIMARY KEY,
  symbol      TEXT, headline TEXT, description TEXT,
  source TEXT, domain TEXT, relevance REAL, pub_date TEXT
);

CREATE TABLE IF NOT EXISTS paper_trades (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL DEFAULT 'trader1',
  symbol TEXT NOT NULL, side TEXT NOT NULL,
  entry_price REAL, entry_time TEXT,
  quantity REAL, exit_price REAL, exit_time TEXT,
  pnl REAL, fees REAL, status TEXT
);

CREATE TABLE IF NOT EXISTS futures_funding (
  symbol TEXT NOT NULL, ts INTEGER NOT NULL, rate REAL,
  PRIMARY KEY (symbol, ts)
);

CREATE TABLE IF NOT EXISTS futures_oi (
  symbol TEXT NOT NULL, ts INTEGER NOT NULL, open_interest REAL,
  PRIMARY KEY (symbol, ts)
);

CREATE TABLE IF NOT EXISTS futures_ls_ratio (
  symbol TEXT NOT NULL, ts INTEGER NOT NULL,
  long_account REAL, short_account REAL, long_position REAL, short_position REAL,
  PRIMARY KEY (symbol, ts)
);

CREATE TABLE IF NOT EXISTS liquidations (
  id TEXT PRIMARY KEY, symbol TEXT, ts INTEGER,
  side TEXT, price REAL, qty REAL, usd REAL
);

CREATE TABLE IF NOT EXISTS fear_greed (
  ts INTEGER PRIMARY KEY, value INTEGER, classification TEXT
);

CREATE TABLE IF NOT EXISTS orderbook (
  symbol TEXT NOT NULL, ts INTEGER NOT NULL,
  spread_pct REAL, imbalance REAL,
  bids TEXT, asks TEXT,
  PRIMARY KEY (symbol, ts)
);

CREATE TABLE IF NOT EXISTS cross_asset (
  ts INTEGER PRIMARY KEY,
  btc_dominance REAL, eth_dominance REAL,
  total_mcap REAL, total_mcap_change_24h REAL,
  market_cap_percentage_json TEXT
);
`;

export function migrate(db: DatabaseSync): void {
  db.exec(SCHEMA_DDL);
  const stmt = db.prepare('INSERT OR IGNORE INTO schema_meta (key, value) VALUES (?, ?)');
  stmt.run('version', String(SCHEMA_VERSION));
}
