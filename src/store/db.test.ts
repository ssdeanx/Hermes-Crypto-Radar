import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { Store } from './db.js';
import type {
  KlineRow, FundingRow, OIRow, LsRatioRow, LiquidationRow,
  FearGreedRow, OrderBookRow, CrossAssetRow, PaperTradeRow,
  EnrichedTicker, NewsMatch, TokenSignal,
} from '../types.js';

const TEST_DB = resolve(tmpdir(), `crypto-radar-test-${Date.now()}.db`);

describe('Store', () => {
  let store: Store;

  beforeEach(() => {
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
    store = new Store({ path: TEST_DB });
    store.migrate();
  });

  afterEach(() => {
    store.close();
    if (existsSync(TEST_DB)) unlinkSync(TEST_DB);
  });

  describe('migration', () => {
    it('creates all tables', () => {
      const stats = store.stats();
      expect(stats).toHaveProperty('klines');
      expect(stats).toHaveProperty('tickers');
      expect(stats).toHaveProperty('signals');
      expect(stats).toHaveProperty('news');
      expect(stats).toHaveProperty('paper_trades');
      expect(stats).toHaveProperty('futures_funding');
      expect(stats).toHaveProperty('futures_oi');
      expect(stats).toHaveProperty('futures_ls_ratio');
      expect(stats).toHaveProperty('liquidations');
      expect(stats).toHaveProperty('fear_greed');
      expect(stats).toHaveProperty('orderbook');
      expect(stats).toHaveProperty('cross_asset');
    });

    it('is idempotent', () => {
      expect(() => store.migrate()).not.toThrow();
      expect(() => store.migrate()).not.toThrow();
    });
  });

  describe('klines', () => {
    const kline: KlineRow = {
      symbol: 'SOLUSDT', interval: '1h', open_time: 1000000,
      open: 100, high: 105, low: 99, close: 104, volume: 5000, quote_volume: 520000,
      taker_buy_vol: 2500, taker_buy_quote_vol: 260000,
    };

    it('upserts and retrieves klines', () => {
      const inserted = store.upsertKlines([kline]);
      expect(inserted).toBe(1);

      const rows = store.getKlines('SOLUSDT', '1h');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.close).toBe(104);
    });

    it('idempotent on re-insert', () => {
      store.upsertKlines([kline]);
      const inserted = store.upsertKlines([kline]);
      expect(inserted).toBe(0);
    });

    it('supports from/to filtering', () => {
      const k1 = { ...kline, open_time: 1000000 };
      const k2 = { ...kline, open_time: 2000000, close: 110 };
      const k3 = { ...kline, open_time: 3000000, close: 115 };
      store.upsertKlines([k1, k2, k3]);

      const rows = store.getKlines('SOLUSDT', '1h', { from: 1500000, to: 2500000 });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.close).toBe(110);
    });

    it('latestKlineTime returns null for empty', () => {
      expect(store.latestKlineTime('SOLUSDT', '1h')).toBeNull();
    });

    it('latestKlineTime returns max open_time', () => {
      store.upsertKlines([kline, { ...kline, open_time: 2000000 }]);
      expect(store.latestKlineTime('SOLUSDT', '1h')).toBe(2000000);
    });

    it('klineCount returns total across symbols', () => {
      store.upsertKlines([kline, { ...kline, symbol: 'BTCUSDT', open_time: 1000001 }]);
      expect(store.klineCount()).toBe(2);
      expect(store.klineCount('SOLUSDT')).toBe(1);
    });
  });

  describe('tickers & signals & news (persistRun)', () => {
    const ticker: EnrichedTicker = {
      runId: 'R1', tsUtc: '2026-07-07T12:00:00Z', dateEt: '07/07 08:00',
      symbol: 'SOL', chain: 'solana', tokenId: 'solana', tokenName: 'Solana',
      lastPrice: 150, bidPrice: 149.95, bidQty: 100, askPrice: 150.05, askQty: 100,
      spreadPct: 0.07, openPrice: 148, highPrice: 152, lowPrice: 147, prevClosePrice: 149,
      priceChange: 1, priceChangePercent: 0.67, weightedAvgPrice: 150,
      volume: 50000, quoteVolume: 7500000, count: 1000, lastQty: 10,
      vwapDistPct: 0, rangePosPct: 0.6, bookImbalance: 0, volVsAvg: 0.1, obv: 0,
      momentum: 0.8, alerts: '', source: 'binance',
      rsi: 55, macdHistogram: 0.5, bbWidth: 0.05, atrPct: 1.2, adx: 25, regime: 'neutral', compositeScore: 65,
    };

    const signal: TokenSignal = {
      symbol: 'SOL', chain: 'solana', lastPrice: 150, priceChangePercent: 0.67,
      momentumScore: 60, technicalScore: 55, newsScore: 70, compositeScore: 65,
      alerts: ['long'], timestamp: '2026-07-07T12:00:00Z',
      tokenId: 'solana', tokenName: 'Solana',
    };

    const news: NewsMatch = {
      runId: 'R1', tsUtc: '2026-07-07T12:00:00Z',
      symbol: 'SOL', headline: 'Solana news', description: 'Great news',
      source: 'CoinDesk', domain: 'coindesk.com', relevance: 0.9, url: 'https://example.com',
    };

    it('persists tickers from run result', () => {
      store.persistRun({ tickers: [ticker], signals: [], newsMatches: [] });
      const rows = store.getLatestTickers({ limit: 10 });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.symbol).toBe('SOL');
      expect(rows[0]!.price).toBe(150);
    });

    it('persists signals from run result', () => {
      store.persistRun({ tickers: [], signals: [signal], newsMatches: [] });
      const rows = store.getSignals({ limit: 10 });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.composite_score).toBe(65);
    });

    it('persists news from run result', () => {
      store.persistRun({ tickers: [], signals: [], newsMatches: [news] });
      const rows = store.getNews({ limit: 10 });
      expect(rows).toHaveLength(1);
      expect(rows[0]!.headline).toBe('Solana news');
    });

    it('getSignals filters by minScore', () => {
      const s2 = { ...signal, compositeScore: 80, timestamp: '2026-07-07T12:01:00Z' };
      const s3 = { ...signal, compositeScore: 40, timestamp: '2026-07-07T12:02:00Z' };
      store.persistRun({ tickers: [], signals: [signal, s2, s3], newsMatches: [] });
      const rows = store.getSignals({ minScore: 60, limit: 10 });
      expect(rows).toHaveLength(2);
    });
  });

  describe('paper trades', () => {
    const trade: PaperTradeRow = {
      id: 'T1', profile: 'trader1', symbol: 'SOL', side: 'buy',
      entry_price: 150, entry_time: '2026-07-07T12:00:00Z',
      quantity: 10, exit_price: null, exit_time: null, pnl: null, fees: null, status: 'open',
    };

    it('upserts and retrieves', () => {
      store.upsertPaperTrade(trade);
      const rows = store.getPaperTrades('trader1');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.symbol).toBe('SOL');
    });

    it('filters by status', () => {
      store.upsertPaperTrade(trade);
      store.upsertPaperTrade({ ...trade, id: 'T2', status: 'closed', pnl: 50, exit_price: 160, exit_time: '2026-07-07T14:00:00Z' });
      expect(store.getPaperTrades('trader1', 'open')).toHaveLength(1);
      expect(store.getPaperTrades('trader1', 'closed')).toHaveLength(1);
    });
  });

  describe('futures sources', () => {
    const funding: FundingRow[] = [{ symbol: 'SOLUSDT', ts: 1000000, rate: 0.0001 }];
    const oi: OIRow[] = [{ symbol: 'SOLUSDT', ts: 1000000, open_interest: 500000 }];
    const ls: LsRatioRow[] = [{ symbol: 'SOLUSDT', ts: 1000000, long_account: 55, short_account: 45, long_position: 60, short_position: 40 }];
    const liq: LiquidationRow[] = [{ id: 'L1', symbol: 'SOLUSDT', ts: 1000000, side: 'SELL', price: 145, qty: 100, usd: 14500 }];

    it('upsertFunding and getFunding', () => {
      expect(store.upsertFunding(funding)).toBe(1);
      const rows = store.getFunding('SOLUSDT');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.rate).toBe(0.0001);
    });

    it('upsertOpenInterest and getOpenInterest', () => {
      expect(store.upsertOpenInterest(oi)).toBe(1);
      const rows = store.getOpenInterest('SOLUSDT');
      expect(rows[0]!.open_interest).toBe(500000);
    });

    it('upsertLsRatio and getLsRatio', () => {
      expect(store.upsertLsRatio(ls)).toBe(1);
      const rows = store.getLsRatio('SOLUSDT');
      expect(rows[0]!.long_account).toBe(55);
    });

    it('upsertLiquidations and getLiquidations', () => {
      expect(store.upsertLiquidations(liq)).toBe(1);
      const rows = store.getLiquidations('SOLUSDT');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.side).toBe('SELL');
    });
  });

  describe('fear & greed', () => {
    const fg: FearGreedRow = { ts: 1000000, value: 55, classification: 'Neutral' };

    it('upserts and retrieves', () => {
      store.upsertFearGreed(fg);
      const rows = store.getFearGreed();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.value).toBe(55);
    });
  });

  describe('orderbook', () => {
    const ob: OrderBookRow = { symbol: 'SOLUSDT', ts: 1000000, spread_pct: 0.05, imbalance: 0.1, bids: '[[150,1]]', asks: '[[150.1,1]]' };

    it('upserts and retrieves', () => {
      store.upsertOrderBook(ob);
      const rows = store.getOrderBook('SOLUSDT');
      expect(rows).toHaveLength(1);
      expect(rows[0]!.spread_pct).toBe(0.05);
    });
  });

  describe('cross asset', () => {
    const ca: CrossAssetRow = { ts: 1000000, btc_dominance: 45, eth_dominance: 18, total_mcap: 2000000000000, total_mcap_change_24h: 2.5, market_cap_percentage_json: '{"btc":45,"eth":18}' };

    it('upserts and retrieves', () => {
      store.upsertCrossAsset(ca);
      const rows = store.getCrossAsset();
      expect(rows).toHaveLength(1);
      expect(rows[0]!.btc_dominance).toBe(45);
    });
  });

  describe('stats', () => {
    it('returns zero counts for empty tables', () => {
      const s = store.stats();
      expect(s.klines).toBe(0);
      expect(s.tickers).toBe(0);
    });
  });

  describe('Store.open', () => {
    it('creates database at dataDir/fileName', () => {
      const s = Store.open('/tmp', `crypto-radar-open-test-${Date.now()}.db`);
      s.migrate();
      expect(s.stats()).toHaveProperty('klines');
      s.close();
    });
  });
});
