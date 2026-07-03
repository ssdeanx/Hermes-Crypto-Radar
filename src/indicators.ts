// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Technical Indicators
// ═══════════════════════════════════════════════════════════════════════

import type { Kline, TechnicalIndicators, BBandsResult, MACDResult, StochasticResult, IchimokuResult } from './types.js';

/**
 * Simple Moving Average.
 * @param values Input price array
 * @param period Window length
 * @returns SMA value or null if insufficient data
 */
export function sma(values: number[], period: number): number | null {
  if (!values || values.length < period) return null;
  const window = values.slice(-period);
  return window.reduce((a, b) => a + b, 0) / period;
}

/**
 * Exponential Moving Average.
 * @param values Input price array
 * @param period EMA period
 * @returns EMA value or null if insufficient data
 */
export function ema(values: number[], period: number): number | null {
  if (!values || values.length < period) return null;
  const k = 2 / (period + 1);
  let emaVal = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    emaVal = values[i]! * k + emaVal * (1 - k);
  }
  return emaVal;
}

/**
 * Compute an EMA series for all positions.
 * @param values Input price array
 * @param period EMA period
 * @returns Array of EMA values (null for first period-1 positions)
 */
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

/**
 * Compute Relative Strength Index.
 * @param closes Closing price array
 * @param period RSI period (default: 14)
 * @returns RSI value (0-100) or null if insufficient data
 */
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

/**
 * Compute Money Flow Index.
 * @param highs High price array
 * @param lows Low price array
 * @param closes Close price array
 * @param volumes Volume array
 * @param period MFI period (default: 14)
 * @returns MFI value (0-100) or null if insufficient data
 */
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

/**
 * Compute MACD (Moving Average Convergence Divergence).
 * @param closes Closing price array
 * @returns MACDResult with macd, signal, and histogram, or nulls if insufficient data
 */
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

/**
 * Compute Bollinger Bands.
 * @param closes Closing price array
 * @param period BB period (default: 20)
 * @param multiplier Standard deviation multiplier (default: 2)
 * @returns BBandsResult or null if insufficient data
 */
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

/**
 * Compute Average True Range percentage.
 * @param highs High price array
 * @param lows Low price array
 * @param closes Close price array
 * @param period ATR period (default: 14)
 * @returns ATR as a percentage of current close, or null if insufficient data
 */
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

/**
 * Compute volume trend (recent 7 vs prior 7 periods).
 * @param volumes Volume array
 * @returns Ratio change (e.g. 0.2 = +20%), or null if insufficient data
 */
export function computeVolTrend(volumes: number[]): number | null {
  if (!volumes || volumes.length < 14) return null;
  const recent = volumes.slice(-7);
  const older = volumes.slice(-14, -7);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
  if (olderAvg === 0) return 0;
  return (recentAvg / olderAvg) - 1;
}

/**
 * Compute Stochastic Oscillator (%K and %D).
 *
 * Measures where current close sits within the recent high-low range.
 * %K > 80 suggests overbought, %K < 20 suggests oversold.
 * A %K cross above %D is a bullish signal; cross below is bearish.
 *
 * @param highs High price array
 * @param lows Low price array
 * @param closes Closing price array
 * @param period Lookback period (default: 14)
 * @param smoothK Smoothing period for %K (default: 3)
 * @param smoothD Smoothing period for %D (default: 3)
 * @returns { k, d } values or nulls if insufficient data
 */
export function computeStochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
  smoothK = 3,
  smoothD = 3,
): StochasticResult {
  if (!closes || closes.length < period) return { k: null, d: null };

  // Compute raw %K values for each completed period window
  const rawK: number[] = [];
  for (let i = period - 1; i < closes.length; i++) {
    const highN = Math.max(...highs.slice(i - period + 1, i + 1));
    const lowN = Math.min(...lows.slice(i - period + 1, i + 1));
    const range = highN - lowN;
    rawK.push(range === 0 ? 50 : ((closes[i]! - lowN) / range) * 100);
  }

  // Need enough rawK to produce smoothed values
  if (rawK.length < smoothK) return { k: null, d: null };

  // Compute smoothed %K series via SMA
  const kSeries: number[] = [];
  for (let i = smoothK - 1; i < rawK.length; i++) {
    const window = rawK.slice(i - smoothK + 1, i + 1);
    kSeries.push(window.reduce((a, b) => a + b, 0) / smoothK);
  }

  const k = kSeries[kSeries.length - 1]!;
  const d = kSeries.length >= smoothD
    ? (() => {
        const window = kSeries.slice(kSeries.length - smoothD);
        return window.reduce((a, b) => a + b, 0) / smoothD;
      })()
    : null;

  return { k, d };
}

/**
 * Compute Ichimoku Cloud lines.
 *
 * Provides conversion line (Tenkan-sen), base line (Kijun-sen),
 * leading spans (Senkou Span A & B), and lagging span (Chikou Span).
 * Key signals: price above/below cloud, TK cross, cloud twist.
 *
 * Note: Span A and Span B are normally plotted `displacement` periods
 * ahead. Here we return the raw computed values; the caller should
 * interpret displacement in charting context.
 *
 * @param highs High price array
 * @param lows Low price array
 * @param closes Closing price array
 * @param conversionPeriod Tenkan-sen period (default: 9)
 * @param basePeriod Kijun-sen period (default: 26)
 * @param spanBPeriod Senkou Span B period (default: 52)
 * @param displacement Displacement for spans (default: 26)
 * @returns IchimokuResult with computed line values
 */
export function computeIchimoku(
  highs: number[],
  lows: number[],
  closes: number[],
  conversionPeriod = 9,
  basePeriod = 26,
  spanBPeriod = 52,
  displacement = 26,
): IchimokuResult {
  if (!closes || closes.length < basePeriod) {
    return { conversionLine: null, baseLine: null, spanA: null, spanB: null, laggingSpan: null };
  }

  const highConv = Math.max(...highs.slice(-conversionPeriod));
  const lowConv = Math.min(...lows.slice(-conversionPeriod));
  const conversionLine = (highConv + lowConv) / 2;

  const highBase = Math.max(...highs.slice(-basePeriod));
  const lowBase = Math.min(...lows.slice(-basePeriod));
  const baseLine = (highBase + lowBase) / 2;

  // Span A = (Conversion + Base) / 2 (normally shifted forward by displacement)
  const spanA = (conversionLine + baseLine) / 2;

  // Span B requires spanBPeriod data; if insufficient, return null for spanB
  let spanB: number | null = null;
  if (closes.length >= spanBPeriod) {
    const highSpanB = Math.max(...highs.slice(-spanBPeriod));
    const lowSpanB = Math.min(...lows.slice(-spanBPeriod));
    spanB = (highSpanB + lowSpanB) / 2;
  }

  // Lagging span is the current close, normally plotted `displacement`
  // periods behind. We return the raw value.
  const laggingSpan = closes[closes.length - 1]!;

  return { conversionLine, baseLine, spanA, spanB, laggingSpan };
}

/**
 * Compute Williams %R.
 *
 * Measures overbought/oversold levels. Values below -80 indicate
 * oversold (potential bounce), above -20 indicate overbought
 * (potential pullback). Inverse of Stochastic %K in interpretation.
 *
 * @param highs High price array
 * @param lows Low price array
 * @param closes Closing price array
 * @param period Lookback period (default: 14)
 * @returns Williams %R value (-100 to 0) or null if insufficient data
 */
export function computeWilliamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number | null {
  if (!closes || closes.length < period) return null;
  const highN = Math.max(...highs.slice(-period));
  const lowN = Math.min(...lows.slice(-period));
  const range = highN - lowN;
  if (range === 0) return -50; // neutral when no range
  return ((highN - closes[closes.length - 1]!) / range) * -100;
}

/**
 * Compute Chaikin Money Flow (CMF).
 *
 * Measures buying/selling pressure over a period by combining
 * price position within the high-low range with volume.
 * Positive values indicate buying pressure, negative indicates
 * selling pressure.
 *
 * @param highs High price array
 * @param lows Low price array
 * @param closes Closing price array
 * @param volumes Volume array
 * @param period Lookback period (default: 20)
 * @returns CMF value (-1 to 1) or null if insufficient data
 */
export function computeCMF(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period = 20,
): number | null {
  if (!closes || closes.length < period) return null;

  let mfVolumeSum = 0;
  let volumeSum = 0;

  const startIdx = closes.length - period;
  for (let i = startIdx; i < closes.length; i++) {
    const high = highs[i]!;
    const low = lows[i]!;
    const close = closes[i]!;
    const range = high - low;
    // Money Flow Multiplier: ((C - L) - (H - C)) / (H - L)
    // Ranges from -1 (close at low) to +1 (close at high)
    const multiplier = range > 0 ? ((close - low) - (high - close)) / range : 0;
    mfVolumeSum += multiplier * volumes[i]!;
    volumeSum += volumes[i]!;
  }

  if (volumeSum === 0) return 0;
  return mfVolumeSum / volumeSum;
}

/**
 * Compute True Strength Index (TSI).
 *
 * A momentum oscillator that uses double smoothing of price changes
 * to reduce noise while capturing trend strength.
 * Positive values indicate bullish momentum, negative values bearish.
 *
 * @param closes Closing price array
 * @param longPeriod Long EMA period for first smoothing (default: 25)
 * @param shortPeriod Short EMA period for second smoothing (default: 13)
 * @returns TSI value (-100 to 100) or null if insufficient data
 */
export function computeTSI(
  closes: number[],
  longPeriod = 25,
  shortPeriod = 13,
): number | null {
  if (!closes || closes.length < longPeriod + shortPeriod) return null;

  // Momentum = price change (first difference)
  const momentum: number[] = [];
  const absMomentum: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i]! - closes[i - 1]!;
    momentum.push(diff);
    absMomentum.push(Math.abs(diff));
  }

  // First smooth: EMA of momentum (and abs momentum) with long period
  const ema1Series = emaSeries(momentum, longPeriod);
  const absEma1Series = emaSeries(absMomentum, longPeriod);

  const validEma1 = ema1Series.filter((v): v is number => v != null);
  const validAbsEma1 = absEma1Series.filter((v): v is number => v != null);

  if (validEma1.length < shortPeriod || validAbsEma1.length < shortPeriod) return null;

  // Second smooth: EMA of first-smoothed series with short period
  const ema2Series = emaSeries(validEma1, shortPeriod);
  const absEma2Series = emaSeries(validAbsEma1, shortPeriod);

  const ema2 = ema2Series[ema2Series.length - 1];
  const absEma2 = absEma2Series[absEma2Series.length - 1];

  if (ema2 == null || absEma2 == null || absEma2 === 0) return 0;

  return (ema2 / absEma2) * 100;
}

/**
 * Compute all technical indicators for a given set of klines.
 * @param klines Array of Kline data
 * @returns TechnicalIndicators with all computed values
 */
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
    stochastic: computeStochastic(highs, lows, closes),
    ichimoku: computeIchimoku(highs, lows, closes),
    williamsR: computeWilliamsR(highs, lows, closes),
    cmf: computeCMF(highs, lows, closes, volumes),
    tsi: computeTSI(closes),
  };
}

/**
 * Compute Wilder smoothing (used by ADX).
 * First value is SMA of initial `period` values,
 * subsequent values use Wilder's EMA: ((prev * (period-1)) + current) / period.
 */
function wilderSmooth(values: number[], period: number): number[] {
  const result: number[] = [];
  if (values.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i]!;
  result.push(sum / period);
  for (let i = period; i < values.length; i++) {
    result.push(((result[result.length - 1]!) * (period - 1) + values[i]!) / period);
  }
  return result;
}

/**
 * Compute Average Directional Index (ADX).
 *
 * Measures trend strength regardless of direction.
 * ADX > 25 indicates trending market (strong signals),
 * ADX < 20 indicates choppy/range-bound market.
 * Uses Wilder's original method with smoothed +DI/-DI.
 *
 * @param highs High price array
 * @param lows Low price array
 * @param closes Closing price array
 * @param period ADX period (default: 14)
 * @returns ADX value (0-100) or null if insufficient data
 */
export function computeADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period = 14,
): number | null {
  if (!closes || closes.length < period * 2) return null;

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const trueRange = Math.max(
      highs[i]! - lows[i]!,
      Math.abs(highs[i]! - closes[i - 1]!),
      Math.abs(lows[i]! - closes[i - 1]!),
    );
    tr.push(trueRange);

    const upMove = highs[i]! - highs[i - 1]!;
    const downMove = lows[i - 1]! - lows[i]!;

    // +DM and -DM are mutually exclusive
    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
      minusDM.push(0);
    } else if (downMove > upMove && downMove > 0) {
      plusDM.push(0);
      minusDM.push(downMove);
    } else {
      plusDM.push(0);
      minusDM.push(0);
    }
  }

  const smoothedTR = wilderSmooth(tr, period);
  const smoothedPlusDM = wilderSmooth(plusDM, period);
  const smoothedMinusDM = wilderSmooth(minusDM, period);

  const plusDI: number[] = [];
  const minusDI: number[] = [];
  for (let i = 0; i < smoothedTR.length; i++) {
    const sTR = smoothedTR[i]!;
    plusDI.push(sTR > 0 ? (smoothedPlusDM[i]! / sTR) * 100 : 0);
    minusDI.push(sTR > 0 ? (smoothedMinusDM[i]! / sTR) * 100 : 0);
  }

  const dx: number[] = [];
  for (let i = 0; i < plusDI.length; i++) {
    const sum = plusDI[i]! + minusDI[i]!;
    dx.push(sum > 0 ? (Math.abs(plusDI[i]! - minusDI[i]!) / sum) * 100 : 0);
  }

  const adxSeries = wilderSmooth(dx, period);
  return adxSeries.length > 0 ? adxSeries[adxSeries.length - 1]! : null;
}

/**
 * Compute a series of RSI values for each position in the input array.
 *
 * @param closes Closing price array
 * @param period RSI period (default: 14)
 * @returns Array of RSI values (null for first `period` positions)
 */
export function rsiSeries(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (!closes || closes.length < period + 1) return new Array(closes.length).fill(null);

  // Compute initial average gain/loss
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = closes[i]! - closes[i - 1]!;
    if (delta > 0) avgGain += delta;
    else avgLoss += Math.abs(delta);
  }
  avgGain /= period;
  avgLoss /= period;

  // Fill first `period` entries with null
  for (let i = 0; i < period; i++) result.push(null);

  // First RSI value after initial period
  result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));

  // Subsequent values using Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    const delta = closes[i]! - closes[i - 1]!;
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? Math.abs(delta) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result.push(avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss)));
  }

  return result;
}

/**
 * Compute On-Balance Volume.
 * @param closes Closing price array
 * @param volumes Volume array
 * @returns OBV value, or null if fewer than 2 data points
 */
export function computeOBV(closes: number[], volumes: number[]): number | null {
  if (closes.length < 2 || volumes.length < closes.length) return null;
  let obv = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i]! > closes[i - 1]!) obv += volumes[i]!;
    else if (closes[i]! < closes[i - 1]!) obv -= volumes[i]!;
  }
  return obv;
}

/**
 * Compute current volume vs 20-period average volume ratio.
 * @param volumes Volume array
 * @returns Ratio change (e.g. 0.5 = +50%), or null if insufficient data
 */
export function computeVolVsAvg(volumes: number[]): number | null {
  if (!volumes || volumes.length < 20) return null;
  const currentVolume = volumes[volumes.length - 1]!;
  const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  if (avgVolume === 0) return null;
  return (currentVolume / avgVolume) - 1;
}
