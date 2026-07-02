// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Signal Generation Tests
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { computeSignals } from './signals.js';
import type { EnrichedTicker, TechnicalIndicators, NewsMatch } from './types.js';

function makeTicker(overrides: Partial<EnrichedTicker> = {}): EnrichedTicker {
  return {
    runId: 'TEST-1',
    tsUtc: '2026-07-02T12:00:00Z',
    dateEt: '07/02 08:00',
    symbol: 'TEST',
    chain: 'solana',
    tokenId: 'test-token',
    tokenName: 'Test Token',
    lastPrice: 100,
    bidPrice: 99.95,
    bidQty: 100,
    askPrice: 100.05,
    askQty: 100,
    spreadPct: 0.1,
    openPrice: 99,
    highPrice: 105,
    lowPrice: 95,
    prevClosePrice: 99,
    priceChange: 1,
    priceChangePercent: 1.0,
    weightedAvgPrice: 100,
    volume: 10000,
    quoteVolume: 1_000_000,
    count: 500,
    lastQty: 10,
    vwapDistPct: 0,
    rangePosPct: 0.5,
    bookImbalance: 0,
    volVsAvg: 0,
    obv: 0,
    momentum: 1.0,
    alerts: '',
    source: 'binance',
    ...overrides,
  };
}

function makeTech(overrides: Partial<TechnicalIndicators> = {}): TechnicalIndicators {
  return {
    rsi: 50,
    mfi: 50,
    bb: { upper: 110, middle: 100, lower: 90, width: 0.2, position: 0.5 },
    macd: { macd: 0.5, signal: 0.3, histogram: 0.2 },
    atrPct: 1.5,
    volTrend: 0,
    priceVsEma50: 0,
    ...overrides,
  };
}

function makeNews(symbol: string, relevance = 0.7): NewsMatch {
  return {
    runId: 'TEST-1',
    tsUtc: '2026-07-02T12:00:00Z',
    symbol,
    headline: `Test news for ${symbol}`,
    description: 'Test description',
    source: 'CoinTelegraph',
    domain: 'cointelegraph.com',
    relevance,
    url: 'https://example.com/test',
  };
}

describe('computeSignals', () => {
  it('computes composite signals from tickers', () => {
    const tickers = [makeTicker({ symbol: 'TEST', priceChangePercent: 3.5, quoteVolume: 20_000_000 })];
    const technicals = new Map([['TEST', makeTech({ rsi: 62, macd: { macd: 0.8, signal: 0.4, histogram: 0.4 } })]]);
    const news = [makeNews('TEST', 0.8)];

    const signals = computeSignals(tickers, technicals, news);
    expect(signals).toHaveLength(1);

    const s = signals[0]!;
    expect(s.symbol).toBe('TEST');
    expect(s.momentumScore).toBeGreaterThan(50); // Positive price change boosts
    expect(s.technicalScore).toBeGreaterThan(50); // Bullish RSI + MACD
    expect(s.newsScore).toBeGreaterThan(0);       // Has news
    expect(s.compositeScore).toBeGreaterThan(0);
  });

  it('generates DIP alert for large drops', () => {
    const tickers = [makeTicker({ priceChangePercent: -8 })];
    const signals = computeSignals(tickers, new Map(), []);
    expect(signals[0]!.alerts).toContain('🔴 DIP (>5% drop)');
  });

  it('generates PUMP alert for large gains', () => {
    const tickers = [makeTicker({ priceChangePercent: 12 })];
    const signals = computeSignals(tickers, new Map(), []);
    expect(signals[0]!.alerts).toContain('🟢 PUMP (>5% gain)');
  });

  it('generates overbought alert for high RSI', () => {
    const tickers = [makeTicker()];
    const technicals = new Map([['TEST', makeTech({ rsi: 78 })]]);
    const signals = computeSignals(tickers, technicals, []);
    expect(signals[0]!.alerts).toContain('Overbought (RSI > 70)');
  });

  it('generates oversold alert for low RSI', () => {
    const tickers = [makeTicker()];
    const technicals = new Map([['TEST', makeTech({ rsi: 25 })]]);
    const signals = computeSignals(tickers, technicals, []);
    expect(signals[0]!.alerts).toContain('Oversold (RSI < 30)');
  });

  it('news score contribution increases with more articles', () => {
    const tickers = [makeTicker()];

    const signalsNoNews = computeSignals(tickers, new Map(), []);
    const signalsWithNews = computeSignals(tickers, new Map(), [
      makeNews('TEST', 1.0),
      makeNews('TEST', 0.7),
    ]);

    expect(signalsWithNews[0]!.newsScore).toBeGreaterThan(signalsNoNews[0]!.newsScore);
    expect(signalsNoNews[0]!.newsScore).toBe(0);
  });

  it('handles missing technical data gracefully', () => {
    const tickers = [makeTicker()];
    const signals = computeSignals(tickers, new Map(), []);
    expect(signals).toHaveLength(1);
    expect(signals[0]!.technicalScore).toBe(0);
  });

  it('sorts correctly by momentum', () => {
    const tickers = [
      makeTicker({ symbol: 'HIGH', priceChangePercent: 8, quoteVolume: 50_000_000 }),
      makeTicker({ symbol: 'LOW', priceChangePercent: -3, quoteVolume: 100_000 }),
    ];
    const signals = computeSignals(tickers, new Map(), []);
    expect(signals[0]!.symbol).toBe('HIGH');
    expect(signals[0]!.momentumScore).toBeGreaterThan(signals[1]!.momentumScore);
  });
});
