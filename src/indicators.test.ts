// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Indicator Tests
// ═══════════════════════════════════════════════════════════════════════
//
// Verifies all technical indicator computations against known expected
// values using deterministic input data.

import { describe, it, expect } from 'vitest';
import {
  sma, ema, emaSeries,
  computeRSI, computeMFI, computeMACD, computeBB, computeATR, computeVolTrend,
  computeAllIndicators,
} from './indicators.js';
import type { Kline } from './types.js';

// ── Known test data ──
// Simple linear sequence for SMA/EMA: [10, 20, 30, 40, 50]
const LINEAR_5 = [10, 20, 30, 40, 50];

// RSI test data — known bullish sequence
const RSI_CLOSES = [
  44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84,
  46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41,
  46.22, 46.21,
];

// MACD test data — 30+ closes needed
const MACD_CLOSES = [
  45.0, 46.0, 47.0, 48.0, 47.5, 46.5, 47.0, 48.5, 49.0, 48.0,
  47.0, 46.0, 45.5, 46.5, 47.5, 48.0, 49.0, 50.0, 49.5, 49.0,
  48.5, 48.0, 47.5, 48.5, 49.5, 50.0, 51.0, 50.5, 50.0, 51.5,
  52.0, 51.5, 52.5, 53.0, 52.0, 53.5,
];

const MFI_HIGHS = [46, 47, 48, 49, 48, 47, 48, 49, 50, 49, 48, 47, 46, 47, 48, 49, 50, 51, 50, 49];
const MFI_LOWS  = [44, 45, 46, 47, 46, 45, 46, 47, 48, 47, 46, 45, 44, 45, 46, 47, 48, 49, 48, 47];
const MFI_CLOSES = [45, 46, 47, 48, 47, 46, 47, 48, 49, 48, 47, 46, 45, 46, 47, 48, 49, 50, 49, 48];
const MFI_VOLS   = [1000, 1100, 1200, 1300, 1200, 1100, 1200, 1300, 1400, 1300, 1200, 1100, 1000, 1100, 1200, 1300, 1400, 1500, 1400, 1300];

// ── SMA ──

describe('SMA', () => {
  it('returns null for insufficient data', () => {
    expect(sma([1, 2], 3)).toBeNull();
  });

  it('computes SMA for exact period', () => {
    expect(sma([10, 20, 30], 3)).toBe(20);
  });

  it('computes SMA with extra data beyond period', () => {
    expect(sma(LINEAR_5, 3)).toBe(40); // last 3: 30, 40, 50 => 120/3 = 40
  });

  it('handles single value period', () => {
    expect(sma([5, 10, 15], 1)).toBe(15);
  });
});

// ── EMA ──

describe('EMA', () => {
  it('returns null for insufficient data', () => {
    expect(ema([1, 2], 3)).toBeNull();
  });

  it('computes EMA', () => {
    const result = ema([22, 23, 24, 25, 26, 27, 28, 29, 30, 31], 5);
    // SMA of first 5: (22+23+24+25+26)/5 = 24
    // then EMA formula with k=2/(5+1)=0.333...
    expect(result).not.toBeNull();
    expect(result!).toBeGreaterThan(26);
    expect(result!).toBeLessThan(32);
  });
});

describe('emaSeries', () => {
  it('returns nulls for insufficient data', () => {
    const result = emaSeries([1, 2], 5);
    expect(result.every(v => v === null)).toBe(true);
  });

  it('computes full EMA series', () => {
    const result = emaSeries(LINEAR_5, 3);
    // First 3 SMA: (10+20+30)/3 = 20 at index 2
    expect(result[2]).toBe(20);
    // index 3: 40*0.5 + 20*0.5 = 30
    expect(result[3]).toBeCloseTo(30, 5);
    // index 4: 50*0.5 + 30*0.5 = 40
    expect(result[4]).toBeCloseTo(40, 5);
  });
});

// ── RSI ──

describe('RSI', () => {
  it('returns null for insufficient data', () => {
    expect(computeRSI([44, 45], 14)).toBeNull();
  });

  it('computes RSI for known bullish sequence', () => {
    const rsi = computeRSI(RSI_CLOSES, 14);
    expect(rsi).not.toBeNull();
    // Expected range for this sequence: ~55-70 (moderately bullish)
    expect(rsi!).toBeGreaterThan(50);
    expect(rsi!).toBeLessThan(80);
  });

  it('returns 100 when no losses', () => {
    const rsi = computeRSI([10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24], 14);
    expect(rsi).toBe(100);
  });

  it('returns 0 when no gains', () => {
    const rsi = computeRSI([24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10], 14);
    expect(rsi).toBe(0);
  });
});

// ── MACD ──

describe('MACD', () => {
  it('returns null fields for insufficient data', () => {
    const result = computeMACD([1, 2, 3]);
    expect(result.macd).toBeNull();
    expect(result.signal).toBeNull();
    expect(result.histogram).toBeNull();
  });

  it('computes MACD for sufficient data', () => {
    const result = computeMACD(MACD_CLOSES);
    expect(result.macd).not.toBeNull();
    expect(result.signal).not.toBeNull();
    expect(result.histogram).not.toBeNull();
    // In an uptrend, MACD > signal (histogram > 0)
    expect(result.histogram!).toBeGreaterThan(0);
  });
});

// ── Bollinger Bands ──

describe('Bollinger Bands', () => {
  it('returns null for insufficient data', () => {
    expect(computeBB([1, 2], 20)).toBeNull();
  });

  it('computes BB for basic data', () => {
    const bb = computeBB([10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48, 50], 20);
    expect(bb).not.toBeNull();
    expect(bb!.upper).toBeGreaterThan(bb!.middle);
    expect(bb!.middle).toBeGreaterThan(bb!.lower);
    expect(bb!.width).toBeGreaterThan(0);
    expect(bb!.position).toBeGreaterThanOrEqual(0);
    expect(bb!.position).toBeLessThanOrEqual(1);
  });

  it('has width proportional to volatility', () => {
    const stableBB = computeBB([50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50, 50], 20);
    const volatileBB = computeBB([40, 42, 38, 44, 36, 46, 34, 48, 32, 50, 30, 52, 28, 54, 26, 56, 24, 58, 22, 60], 20);
    expect(stableBB).not.toBeNull();
    expect(volatileBB).not.toBeNull();
    expect(volatileBB!.width).toBeGreaterThan(stableBB!.width);
  });
});

// ── ATR ──

describe('ATR', () => {
  it('returns null for insufficient data', () => {
    expect(computeATR([46], [44], [45], 14)).toBeNull();
  });

  it('computes ATR percentage', () => {
    const atr = computeATR(MFI_HIGHS, MFI_LOWS, MFI_CLOSES, 14);
    expect(atr).not.toBeNull();
    expect(atr!).toBeGreaterThan(0);
    expect(atr!).toBeLessThan(20); // reasonable ATR% range
  });
});

// ── Volume Trend ──

describe('Volume Trend', () => {
  it('returns null for insufficient data', () => {
    expect(computeVolTrend([1, 2, 3])).toBeNull();
  });

  it('computes volume trend ratio', () => {
    // Last 7 values higher than prior 7 -> positive trend
    const rising = [
      100, 100, 100, 100, 100, 100, 100,  // older
      200, 200, 200, 200, 200, 200, 200,  // recent
    ];
    expect(computeVolTrend(rising)).toBeCloseTo(1.0, 1); // 200/100 - 1 = 1.0
  });

  it('detects declining volume', () => {
    const declining = [
      200, 200, 200, 200, 200, 200, 200,
      100, 100, 100, 100, 100, 100, 100,
    ];
    expect(computeVolTrend(declining)).toBeCloseTo(-0.5, 1); // 100/200 - 1 = -0.5
  });
});

// ── computeAllIndicators integration ──

describe('computeAllIndicators', () => {
  function makeKlines(closes: number[]): Kline[] {
    return closes.map((c, i) => ({
      openTime: i * 3600000,
      open: c - 1,
      high: c + 2,
      low: c - 2,
      close: c,
      volume: 1000,
      closeTime: (i + 1) * 3600000,
      quoteVolume: c * 1000,
      count: 100,
      takerBuyVol: 500,
      takerBuyQuoteVol: c * 500,
      ignore: 0,
    }));
  }

  it('computes all indicators from kline data', () => {
    // Need at least 50+ data points for EMA50
    const closes = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i * 0.2) * 10);
    const klines = makeKlines(closes);
    const result = computeAllIndicators(klines);

    expect(result.rsi).not.toBeNull();
    expect(result.mfi).not.toBeNull();
    expect(result.bb).not.toBeNull();
    expect(result.macd).not.toBeNull();
    expect(result.atrPct).not.toBeNull();
    expect(result.volTrend).not.toBeNull();
    expect(result.priceVsEma50).not.toBeNull();
  });

  it('returns null fields for insufficient data', () => {
    const closes = [100, 101, 102]; // only 3 data points
    const klines = makeKlines(closes);
    const result = computeAllIndicators(klines);

    expect(result.rsi).toBeNull();
    expect(result.mfi).toBeNull();
    expect(result.bb).toBeNull();
    expect(result.macd.macd).toBeNull();
    expect(result.priceVsEma50).toBeNull();
  });
});
