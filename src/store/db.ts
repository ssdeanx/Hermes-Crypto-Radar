import { DatabaseSync } from 'node:sqlite';
import type { StatementSync, SQLInputValue } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { migrate } from './schema.js';
import { DataError } from '../core/errors.js';
import { logger } from '../core/logger.js';
import type {
  KlineRow, TickerRow, SignalRow, NewsRow, PaperTradeRow,
  FundingRow, OIRow, LsRatioRow, LiquidationRow,
  FearGreedRow, OrderBookRow, CrossAssetRow,
} from '../types.js';
import type { EnrichedTicker, NewsMatch, TokenSignal } from '../types.js';

const log = logger.child({ module: 'store' });

type Stmt = StatementSync;

function allRows<T>(stmt: Stmt, ...params: SQLInputValue[]): T[] {
  return stmt.all(...params) as unknown as T[];
}

function oneRow<T>(stmt: Stmt, ...params: SQLInputValue[]): T | undefined {
  return stmt.get(...params) as unknown as T | undefined;
}

export class Store {
  private db: DatabaseSync;
  private stmts = new Map<string, Stmt>();

  constructor(opts: { path: string; createIfMissing?: boolean }) {
    const dbPath = resolve(opts.path);
    if (!existsSync(dbPath) && opts.createIfMissing === false) {
      throw new DataError('store', `Database not found at ${dbPath}`);
    }
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
  }

  static open(dataDir: string, fileName = 'crypto-radar.db'): Store {
    return new Store({ path: resolve(dataDir, fileName) });
  }

  migrate(): void {
    migrate(this.db);
  }

  close(): void {
    this.stmts.clear();
    this.db.close();
  }

  private prep(sql: string): Stmt {
    let stmt = this.stmts.get(sql);
    if (!stmt) {
      stmt = this.db.prepare(sql);
      this.stmts.set(sql, stmt);
    }
    return stmt;
  }

  private runInTransaction(fn: () => void): void {
    this.db.exec('BEGIN');
    try {
      fn();
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      log.error('Transaction rolled back', { error: String(err) });
      throw err;
    }
  }

  // ── Klines ──

  upsertKlines(rows: KlineRow[]): number {
    if (rows.length === 0) return 0;
    const sql = `INSERT OR IGNORE INTO klines (symbol, interval, open_time, open, high, low, close, volume, quote_volume, taker_buy_vol, taker_buy_quote_vol)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    let count = 0;
    this.runInTransaction(() => {
      const stmt = this.prep(sql);
      for (const r of rows) {
        const result = stmt.run(r.symbol, r.interval, r.open_time, r.open, r.high, r.low, r.close, r.volume, r.quote_volume, r.taker_buy_vol, r.taker_buy_quote_vol);
        if (result.changes > 0) count++;
      }
    });
    return count;
  }

  getKlines(symbol: string, interval: string, opts?: { from?: number; to?: number; limit?: number; order?: 'asc' | 'desc' }): KlineRow[] {
    let sql = 'SELECT * FROM klines WHERE symbol = ? AND interval = ?';
    const params: SQLInputValue[] = [symbol, interval];
    if (opts?.from !== undefined) { sql += ' AND open_time >= ?'; params.push(opts.from); }
    if (opts?.to !== undefined) { sql += ' AND open_time <= ?'; params.push(opts.to); }
    sql += ` ORDER BY open_time ${opts?.order === 'desc' ? 'DESC' : 'ASC'}`;
    if (opts?.limit !== undefined) { sql += ' LIMIT ?'; params.push(opts.limit); }
    return allRows<KlineRow>(this.prep(sql), ...params);
  }

  latestKlineTime(symbol: string, interval: string): number | null {
    const row = oneRow<{ t: number | null }>(this.prep('SELECT MAX(open_time) AS t FROM klines WHERE symbol = ? AND interval = ?'), symbol, interval);
    return row?.t ?? null;
  }

  klineCount(symbol?: string, interval?: string): number {
    let sql = 'SELECT COUNT(*) AS c FROM klines';
    const params: SQLInputValue[] = [];
    if (symbol) { sql += ' WHERE symbol = ?'; params.push(symbol); }
    if (interval) { sql += symbol ? ' AND interval = ?' : ' WHERE interval = ?'; params.push(interval); }
    const row = oneRow<{ c: number }>(this.prep(sql), ...params);
    return row?.c ?? 0;
  }

  // ── Scan archive ──

  persistRun(result: {
    tickers: EnrichedTicker[];
    newsMatches: NewsMatch[];
    signals: TokenSignal[];
  }): void {
    this.runInTransaction(() => {
      const tickerStmt = this.prep(`INSERT OR IGNORE INTO tickers
        (symbol, ts_utc, price, price_change_pct, volume, quote_volume,
         rsi, macd_hist, bb_width, atr_pct, adx, regime, composite_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const t of result.tickers) {
        tickerStmt.run(
          t.symbol, t.tsUtc, t.lastPrice, t.priceChangePercent,
          t.volume, t.quoteVolume,
          t.rsi ?? null, t.macdHistogram ?? null, t.bbWidth ?? null, t.atrPct ?? null,
          t.adx ?? null, t.regime ?? null, t.compositeScore ?? null,
        );
      }

      const signalStmt = this.prep(`INSERT OR IGNORE INTO signals
        (symbol, ts_utc, composite_score, direction, momentum_score, mean_reversion_score, trend_following_score, regime, adx)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const s of result.signals) {
        signalStmt.run(
          s.symbol, s.timestamp, s.compositeScore, s.alerts?.[0] ?? null,
          s.momentumScore ?? null, s.technicalScore ?? null, s.newsScore ?? null,
          s.regime ?? null, s.adx ?? null,
        );
      }

      const newsStmt = this.prep(`INSERT OR IGNORE INTO news
        (id, symbol, headline, description, source, domain, relevance, pub_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const n of result.newsMatches) {
        const newsId = sha1(`${n.headline}|${n.source}|${n.tsUtc}`);
        newsStmt.run(newsId, n.symbol, n.headline, n.description, n.source, n.domain, n.relevance, n.tsUtc);
      }
    });
  }

  getLatestTickers(filter?: { symbol?: string; chain?: string; limit?: number }): TickerRow[] {
    let sql = 'SELECT * FROM tickers';
    const params: SQLInputValue[] = [];
    if (filter?.symbol) { sql += ' WHERE symbol = ?'; params.push(filter.symbol); }
    sql += ' ORDER BY ts_utc DESC';
    if (filter?.limit !== undefined) { sql += ' LIMIT ?'; params.push(filter.limit); }
    else { sql += ' LIMIT 200'; params.push(200); }
    return allRows<TickerRow>(this.prep(sql), ...params);
  }

  getSignals(filter?: { minScore?: number; direction?: string; limit?: number }): SignalRow[] {
    let sql = 'SELECT * FROM signals WHERE 1=1';
    const params: SQLInputValue[] = [];
    if (filter?.minScore !== undefined) { sql += ' AND composite_score >= ?'; params.push(filter.minScore); }
    if (filter?.direction) { sql += ' AND direction = ?'; params.push(filter.direction); }
    sql += ' ORDER BY composite_score DESC';
    if (filter?.limit !== undefined) { sql += ' LIMIT ?'; params.push(filter.limit); }
    else { sql += ' LIMIT 200'; params.push(200); }
    return allRows<SignalRow>(this.prep(sql), ...params);
  }

  getNews(filter?: { symbol?: string; limit?: number }): NewsRow[] {
    let sql = 'SELECT * FROM news';
    const params: SQLInputValue[] = [];
    if (filter?.symbol) { sql += ' WHERE symbol = ?'; params.push(filter.symbol); }
    sql += ' ORDER BY pub_date DESC';
    if (filter?.limit !== undefined) { sql += ' LIMIT ?'; params.push(filter.limit); }
    else { sql += ' LIMIT 50'; params.push(50); }
    return allRows<NewsRow>(this.prep(sql), ...params);
  }

  // ── Paper trading ──

  upsertPaperTrade(t: PaperTradeRow): void {
    this.prep(`INSERT OR REPLACE INTO paper_trades
      (id, profile, symbol, side, entry_price, entry_time, quantity, exit_price, exit_time, pnl, fees, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(t.id, t.profile, t.symbol, t.side, t.entry_price, t.entry_time, t.quantity, t.exit_price, t.exit_time, t.pnl, t.fees, t.status);
  }

  getPaperTrades(profile: string, status?: 'open' | 'closed'): PaperTradeRow[] {
    let sql = 'SELECT * FROM paper_trades WHERE profile = ?';
    const params: SQLInputValue[] = [profile];
    if (status) { sql += ' AND status = ?'; params.push(status); }
    return allRows<PaperTradeRow>(this.prep(sql), ...params);
  }

  // ── Futures sources ──

  upsertFunding(rows: FundingRow[]): number {
    if (rows.length === 0) return 0;
    const sql = 'INSERT OR IGNORE INTO futures_funding (symbol, ts, rate) VALUES (?, ?, ?)';
    let count = 0;
    this.runInTransaction(() => {
      const stmt = this.prep(sql);
      for (const r of rows) { if (stmt.run(r.symbol, r.ts, r.rate).changes > 0) count++; }
    });
    return count;
  }

  upsertOpenInterest(rows: OIRow[]): number {
    if (rows.length === 0) return 0;
    const sql = 'INSERT OR IGNORE INTO futures_oi (symbol, ts, open_interest) VALUES (?, ?, ?)';
    let count = 0;
    this.runInTransaction(() => {
      const stmt = this.prep(sql);
      for (const r of rows) { if (stmt.run(r.symbol, r.ts, r.open_interest).changes > 0) count++; }
    });
    return count;
  }

  upsertLsRatio(rows: LsRatioRow[]): number {
    if (rows.length === 0) return 0;
    const sql = 'INSERT OR IGNORE INTO futures_ls_ratio (symbol, ts, long_account, short_account, long_position, short_position) VALUES (?, ?, ?, ?, ?, ?)';
    let count = 0;
    this.runInTransaction(() => {
      const stmt = this.prep(sql);
      for (const r of rows) { if (stmt.run(r.symbol, r.ts, r.long_account, r.short_account, r.long_position, r.short_position).changes > 0) count++; }
    });
    return count;
  }

  upsertLiquidations(rows: LiquidationRow[]): number {
    if (rows.length === 0) return 0;
    const sql = 'INSERT OR IGNORE INTO liquidations (id, symbol, ts, side, price, qty, usd) VALUES (?, ?, ?, ?, ?, ?, ?)';
    let count = 0;
    this.runInTransaction(() => {
      const stmt = this.prep(sql);
      for (const r of rows) { if (stmt.run(r.id, r.symbol, r.ts, r.side, r.price, r.qty, r.usd).changes > 0) count++; }
    });
    return count;
  }

  getFunding(symbol: string, limit = 50): FundingRow[] {
    return allRows<FundingRow>(this.prep('SELECT * FROM futures_funding WHERE symbol = ? ORDER BY ts DESC LIMIT ?'), symbol, limit);
  }

  getOpenInterest(symbol: string, limit = 50): OIRow[] {
    return allRows<OIRow>(this.prep('SELECT * FROM futures_oi WHERE symbol = ? ORDER BY ts DESC LIMIT ?'), symbol, limit);
  }

  getLsRatio(symbol: string, limit = 50): LsRatioRow[] {
    return allRows<LsRatioRow>(this.prep('SELECT * FROM futures_ls_ratio WHERE symbol = ? ORDER BY ts DESC LIMIT ?'), symbol, limit);
  }

  getLiquidations(symbol?: string, limit = 50): LiquidationRow[] {
    if (symbol) {
      return allRows<LiquidationRow>(this.prep('SELECT * FROM liquidations WHERE symbol = ? ORDER BY ts DESC LIMIT ?'), symbol, limit);
    }
    return allRows<LiquidationRow>(this.prep('SELECT * FROM liquidations ORDER BY ts DESC LIMIT ?'), limit);
  }

  // ── Fear & Greed ──

  upsertFearGreed(row: FearGreedRow): void {
    this.prep('INSERT OR REPLACE INTO fear_greed (ts, value, classification) VALUES (?, ?, ?)').run(row.ts, row.value, row.classification);
  }

  getFearGreed(limit = 30): FearGreedRow[] {
    return allRows<FearGreedRow>(this.prep('SELECT * FROM fear_greed ORDER BY ts DESC LIMIT ?'), limit);
  }

  // ── Order Book ──

  upsertOrderBook(row: OrderBookRow): void {
    this.prep('INSERT OR REPLACE INTO orderbook (symbol, ts, spread_pct, imbalance, bids, asks) VALUES (?, ?, ?, ?, ?, ?)').run(row.symbol, row.ts, row.spread_pct, row.imbalance, row.bids, row.asks);
  }

  getOrderBook(symbol: string, limit = 50): OrderBookRow[] {
    return allRows<OrderBookRow>(this.prep('SELECT * FROM orderbook WHERE symbol = ? ORDER BY ts DESC LIMIT ?'), symbol, limit);
  }

  // ── Cross Asset ──

  upsertCrossAsset(row: CrossAssetRow): void {
    this.prep('INSERT OR REPLACE INTO cross_asset (ts, btc_dominance, eth_dominance, total_mcap, total_mcap_change_24h, market_cap_percentage_json) VALUES (?, ?, ?, ?, ?, ?)').run(row.ts, row.btc_dominance, row.eth_dominance, row.total_mcap, row.total_mcap_change_24h, row.market_cap_percentage_json);
  }

  getCrossAsset(limit = 50): CrossAssetRow[] {
    return allRows<CrossAssetRow>(this.prep('SELECT * FROM cross_asset ORDER BY ts DESC LIMIT ?'), limit);
  }

  // ── Meta ──

  stats(): Record<string, number> {
    const tables = [
      'klines', 'tickers', 'signals', 'news', 'paper_trades',
      'futures_funding', 'futures_oi', 'futures_ls_ratio', 'liquidations',
      'fear_greed', 'orderbook', 'cross_asset',
    ];
    const result: Record<string, number> = {};
    for (const t of tables) {
      const row = oneRow<{ c: number }>(this.prep(`SELECT COUNT(*) AS c FROM ${t}`));
      result[t] = row?.c ?? 0;
    }
    return result;
  }
}

function sha1(input: string): string {
  return createHash('sha1').update(input).digest('hex');
}
