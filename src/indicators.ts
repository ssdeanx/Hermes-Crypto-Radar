// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Technical Indicators
// ═══════════════════════════════════════════════════════════════════════

import type { Kline, TechnicalIndicators, BBandsResult, MACDResult } from './types.js';

export function sma(values: number[], period: number): number | null {
  if (!values || values.length < period) return null;
  const window = values.slice(-period);
  return window.reduce((a, b) => a + b, 0) / period;
}

export function ema(values: number[], period: number): number | null {
  if (!values || values.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaVal = values[i]! * k + emaVal * (1 - k);
  }
  return emaVal;
}

export function emaSeries(values: number[], period: number): (number | null)[] {
  if (!values || values.length < period) return new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(values.length).fill(null);
  result[period - 1] = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i]! * k + (result[i - 1] ?? 0) * (1 - k);
  }
  return result;
}

export function computeRSI(closes: number[], period = 14): number | null {
  if (!closes || closes.length < period + 1) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i]! - closes[i - 1]!;
    if (delta > 0) gains += delta;
    else losses += Math.abs(delta);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i]! - closes[i - 1]!;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

export function computeMFI(
  highs: number[], lows: number[], closes: number[], volumes: number[], period = 14,
): number | null {
  if (!closes || closes.length < period + 1) return null;
  const typicalPrices = closes.map((c, i) => (highs[i]! + lows[i]! + c) / 3);
  const rawMFs = typicalPrices.map((tp, i) => tp * volumes[i]!);
  let posSum = 0, negSum = 0;
  for (let i = 1; i <= period; i++) {
    if (typicalPrices[i]! > typicalPrices[i - 1]!) posSum += rawMFs[i]!;
    else if (typicalPrices[i]! < typicalPrices[i - 1]!) negSum += rawMFs[i]!;
  }
  let posMF = posSum / period;
  let negMF = negSum / period;
  for (let i = period + 1; i < rawMFs.length; i++) {
    const pos = typicalPrices[i]! > typicalPrices[i - 1]! ? rawMFs[i]! : 0;
    const neg = typicalPrices[i]! < typicalPrices[i - 1]! ? rawMFs[i]! : 0;
    posMF = (posMF * (period - 1) + pos) / period;
    negMF = (negMF * (period - 1) + neg) / period;
  }
  if (negMF === 0) return 100;
  return 100 - (100 / (1 + posMF / negMF));
}

export function computeMACD(closes: number[]): MACDResult {
  if (!closes || closes.length < 26) {
    return { macd: null, signal: null, histogram: null } as any;
  }
  const ema12Series = emaSeries(closes, 12);
  const ema26Series = emaSeries(closes, 26);
  const macdSeries = closes.map((_, i) =>
    ema12Series[i] != null && ema26Series[i] != null ? ema12Series[i]! - ema26Series[i]! : null
  );
  const validMacd = macdSeries.filter((v): v is number => v != null);
  if (validMacd.length < 9) return { macd: null, signal: null, histogram: null } as any;
  const signalSeries = emaSeries(validMacd, 9);
  const macd = validMacd[validMacd.length - 1]!;
  const signal = signalSeries[signalSeries.length - 1]!;
  return { macd, signal, histogram: macd - signal };
}

export function computeBB(closes: number[], period = 20, multiplier = 2): BBandsResult | null {
  if (!closes || closes.length < period) return null;
  const window = closes.slice(-period);
  const middle = window.reduce((a, b) => a + b, 0) / period;
  const variance = window.reduce((sum, v) => sum + (v - middle) ** 2, 0) / period;
  const stddev = Math.sqrt(variance);
  const upper = middle + multiplier * stddev;
  const lower = middle - multiplier * stddev;
  const width = middle > 0 ? (upper - lower) / middle : 0;
  const close = closes[closes.length - 1]!;
  const position = upper - lower > 0 ? (close - lower) / (upper - lower) : 0.5;
  return { upper, middle, lower, width, position };
}

export function computeATR(
  highs: number[], lows: number[], closes: number[], period = 14,
): number | null {
  if (!closes || closes.length < period + 1) return null;
  const trueRanges: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    trueRanges.push(Math.max(
      highs[i]! - lows[i]!,
      Math.abs(highs[i]! - closes[i - 1]!),
      Math.abs(lows[i]! - closes[i - 1]!),
    ));
  }
  let atr = trueRanges.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]!) / period;
  }
  const currentClose = closes[closes.length - 1]!;
  return currentClose > 0 ? (atr / currentClose) * 100 : null;
}

export function computeVolTrend(volumes: number[]): number | null {
  if (!volumes || volumes.length < 14) return null;
  const recent = volumes.slice(-7);
  const older = volumes.slice(-14, -7);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  if (olderAvg === 0) return 0;
  return (recentAvg / olderAvg) - 1;
}

export function computeAllIndicators(klines: Kline[]): TechnicalIndicators {
  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  const volumes = klines.map(k => k.volume);
  const currentClose = closes[closes.length - 1] ?? 0;
  const ema50 = ema(closes, 50);
  const priceVsEma50 = ema50 !== null && ema50 > 0
    ? ((currentClose - ema50) / ema50) * 100
    : null;
  return {
    rsi: computeRSI(closes),
    mfi: computeMFI(highs, lows, closes, volumes),
    bb: computeBB(closes),
    macd: computeMACD(closes),
    atrPct: computeATR(highs, lows, closes),
    volTrend: computeVolTrend(volumes),
    priceVsEma50,
    obv: computeOBV(closes, volumes),
    volVsAvg: computeVolVsAvg(volumes),
  };
}

export function computeOBV(closes: number[], volumes: number[]): number | null {
  if (closes.length < 2) return null;
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i]! > closes[i - 1]!) obv += volumes[i]!;
    else if (closes[i]! < closes[i - 1]!) obv -= volumes[i]!;
  }
  return obv;
}

export function computeVolVsAvg(volumes: number[]): number | null {
  if (!volumes || volumes.length < 20) return null;
  const currentVolume = volumes[volumes.length - 1]!;
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (avgVolume === 0) return null;
  return (currentVolume / avgVolume) - 1;
}
