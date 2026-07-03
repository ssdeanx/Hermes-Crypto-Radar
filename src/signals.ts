// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Signal Generator
// ═══════════════════════════════════════════════════════════════════════
//
// Feature set:
//   - Composite scoring (momentum, technical, news, on-chain)
//   - Confidence calibration (conflict penalties, agreement bonuses)
//   - Context-aware on-chain boost with TVL trend direction
//   - Volume confirmation (±5%)
//   - Signal metadata (per-strategy breakdown, market regime)
//   - Alert deduplication (1-hour sliding window)
// ═══════════════════════════════════════════════════════════════════════

import type {
  EnrichedTicker, TokenSignal, TechnicalIndicators,
  NewsMatch, Chain, SignalBreakdown,
} from './types.js';
import type { OnChainMetrics } from './onchain.js';
import { PROTOCOL_MAP } from './onchain.js';
import { getTokenById } from './tokens.js';

// ═══════════════════════════════════════════════════════════════════════
// Alert deduplication
// ═══════════════════════════════════════════════════════════════════════
//
// Tracks recent alert keys (symbol + alert text) to avoid repeating the
// same message in consecutive scans. Cache is shared across all calls
// and cleared after ALERT_DEDUP_WINDOW_MS of inactivity.

const ALERT_DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const recentlySentAlerts = new Map<string, number>(); // key → timestamp

/**
 * Check if an alert is fresh (not seen within the dedup window).
 * Returns true if the alert should be shown, false if it's a duplicate.
 */
function isAlertUnique(key: string): boolean {
  const now = Date.now();
  const lastSent = recentlySentAlerts.get(key);
  if (lastSent !== undefined && (now - lastSent) < ALERT_DEDUP_WINDOW_MS) {
    return false; // still within the dedup window
  }
  recentlySentAlerts.set(key, now);
  return true;
}

/**
 * Clear the alert dedup cache (exposed for testing / manual reset).
 */
export function clearAlertCache(): void {
  recentlySentAlerts.clear();
}

/**
 * Evict stale entries from the alert cache to prevent unbounded growth.
 */
function evictStaleAlerts(): void {
  const cutoff = Date.now() - ALERT_DEDUP_WINDOW_MS;
  for (const [key, ts] of recentlySentAlerts.entries()) {
    if (ts < cutoff) recentlySentAlerts.delete(key);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// On-chain boost (context-aware)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute an on-chain confidence boost (0–15 percentage points) based on
 * protocol TVL for a given token, now with trend awareness.
 *
 * Rules:
 *   - TVL >$1B AND trending up  → +15%
 *   - TVL >$1B AND flat         → +10%
 *   - TVL >$1B AND dropping     →  no boost (even if TVL is still high)
 *   - TVL $100M–$1B             → +5–10% (same as before, unaffected by trend)
 *   - TVL <$100M                → +0–5%
 *
 * @param symbol Token symbol (e.g. 'SOLUSDT')
 * @param tokenId Internal token id (e.g. 'solana')
 * @param onchain Fetched on-chain metrics (may be null)
 * @returns Boost value in percentage points (0–15)
 */
export function computeOnchainBoost(
  symbol: string,
  tokenId: string,
  onchain: OnChainMetrics | null,
): number {
  if (!onchain || !onchain.protocols || onchain.protocols.length === 0) return 0;

  // Look up the DeFiLlama protocol slug for this token
  const protocolSlug = PROTOCOL_MAP[tokenId];
  if (!protocolSlug) return 0;

  // Find matching protocol in the fetched metrics
  const protocol = onchain.protocols.find(p => p.name === protocolSlug);
  if (!protocol) return 0;

  const tvl = protocol.tvl;
  const trend = protocol.tvlTrend;

  // High TVL (>$1B) with trend awareness
  if (tvl > 1_000_000_000) {
    if (trend === 'up') return 15;
    if (trend === 'flat') return 10;
    return 0; // dropping → no boost
  }

  // Medium TVL ($100M–$1B) → +5–10% boost
  if (tvl > 100_000_000) {
    return 5 + ((tvl - 100_000_000) / 900_000_000) * 5;
  }

  // Low TVL (>0, <$100M) → +0–5% boost
  if (tvl > 0) {
    return (tvl / 100_000_000) * 5;
  }

  return 0;
}

// ═══════════════════════════════════════════════════════════════════════
// Direction helpers (used for confidence calibration & breakdown)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Determine momentum direction from ticker data.
 * Bullish = strong price rise + book buy pressure, Bearish = opposite.
 */
function getMomentumDirection(t: EnrichedTicker): string {
  const strongBullish =
    t.priceChangePercent >= 3 ||
    (t.priceChangePercent >= 1 && t.bookImbalance > 0.2 && t.rangePosPct > 0.7);
  const strongBearish =
    t.priceChangePercent <= -3 ||
    (t.priceChangePercent <= -1 && t.bookImbalance < -0.2 && t.rangePosPct < 0.3);

  if (strongBullish) return 'bullish';
  if (strongBearish) return 'bearish';
  return 'neutral';
}

/**
 * Determine mean-reversion direction from technical indicators.
 * Oversold (expect bounce) or Overbought (expect pullback).
 */
function getMeanReversionDirection(tech: TechnicalIndicators | undefined): string {
  if (!tech) return 'neutral';
  const oversold =
    tech.rsi != null && tech.rsi < 30 &&
    tech.bb != null && tech.bb.position <= 0.2;
  const overbought =
    tech.rsi != null && tech.rsi > 70 &&
    tech.bb != null && tech.bb.position >= 0.8;

  if (oversold) return 'oversold';   // expect bounce → buyside opportunity
  if (overbought) return 'overbought'; // expect drop → sellside opportunity
  return 'neutral';
}

/**
 * Determine trend-following direction from MACD, EMA50, and volume trend.
 */
function getTrendFollowingDirection(tech: TechnicalIndicators | undefined): string {
  if (!tech) return 'neutral';

  const macdBullish =
    tech.macd?.histogram != null && tech.macd.histogram > 0 &&
    tech.priceVsEma50 != null && tech.priceVsEma50 > 0;
  const macdBearish =
    tech.macd?.histogram != null && tech.macd.histogram < 0 &&
    tech.priceVsEma50 != null && tech.priceVsEma50 < 0;

  if (macdBullish) return 'bullish';
  if (macdBearish) return 'bearish';
  return 'neutral';
}

/**
 * Compute confidence level (0–100) for the momentum direction based on
 * how extreme the underlying data is.
 */
function momentumConfidence(t: EnrichedTicker): number {
  let conf = 50;
  conf += Math.abs(t.priceChangePercent) * 5;          // up to ±inf but clamped later
  conf += Math.abs(t.bookImbalance) * 30;              // up to ±30
  conf -= Math.min(t.spreadPct * 15, 20);               // wide spread reduces confidence
  return Math.round(clamp(conf, 0, 100));
}

/**
 * Compute confidence level (0–100) for the mean-reversion direction.
 */
function meanReversionConfidence(tech: TechnicalIndicators | undefined): number {
  if (!tech) return 0;
  const rsiDev = tech.rsi != null ? Math.abs(tech.rsi - 50) * 2 : 0;
  const bbDev = tech.bb != null ? Math.abs(tech.bb.position - 0.5) * 80 : 0;
  return Math.round(clamp(rsiDev * 0.5 + bbDev * 0.5, 0, 100));
}

/**
 * Compute confidence level (0–100) for the trend-following direction.
 */
function trendFollowingConfidence(tech: TechnicalIndicators | undefined): number {
  if (!tech) return 0;
  let conf = 50;
  if (tech.macd?.histogram != null) {
    conf += clamp(Math.abs(tech.macd.histogram / (tech.macd.macd || 1)) * 30, -30, 30);
  }
  if (tech.priceVsEma50 != null) {
    conf += clamp(Math.abs(tech.priceVsEma50) * 15, -15, 15);
  }
  return Math.round(clamp(conf, 0, 100));
}

// ═══════════════════════════════════════════════════════════════════════
// Confidence calibration
// ═══════════════════════════════════════════════════════════════════════
//
// Converts a set of directional signals into a confidence adjustment
// (penalty or bonus) applied to the composite score.

interface CalibrationResult {
  penalty: number;        // negative or positive percentage-point adjustment
  breakdown: SignalBreakdown;
}

/**
 * Calibrate confidence by comparing the three strategy directions.
 *
 * Rules:
 *   - Momentum disagrees with trend-following  → -15% penalty
 *   - Momentum & trend-following agree but
 *     mean-reversion disagrees                →  -5% penalty
 *   - All 3 strategies agree                  → +10% bonus
 */
function calibrateConfidence(
  momentumDir: string,
  meanRevDir: string,
  trendFollowingDir: string,
  momentumConf: number,
  meanRevConf: number,
  trendConf: number,
): CalibrationResult {
  // Map directions to a buy/sell numeric scale for comparison
  const toSignal = (d: string): number => {
    if (d === 'bullish' || d === 'oversold') return 1;   // buy
    if (d === 'bearish' || d === 'overbought') return -1; // sell
    return 0; // neutral
  };

  const m = toSignal(momentumDir);
  const r = toSignal(meanRevDir);
  const t = toSignal(trendFollowingDir);

  let penalty = 0;

  // Momentum vs Trend-Following conflict
  if (m !== 0 && t !== 0 && m * t < 0) {
    penalty = -15;
  }
  // Momentum and TF agree, but mean-reversion disagrees
  else if (m !== 0 && t !== 0 && m * t > 0 && r !== 0 && m * r < 0) {
    penalty = -5;
  }
  // All three agree (all non-zero with same sign)
  else if (m !== 0 && t !== 0 && r !== 0 && m === t && t === r) {
    penalty = 10;
  }

  return {
    penalty,
    breakdown: {
      momentum: { direction: momentumDir, confidence: momentumConf },
      meanReversion: { direction: meanRevDir, confidence: meanRevConf },
      trendFollowing: { direction: trendFollowingDir, confidence: trendConf },
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════
// Volume confirmation
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute volume-based confidence adjustment.
 *   - Volume > 2× average → +5%
 *   - Volume < 0.5× average → -5%
 *   - Otherwise → 0
 *
 * Uses the volVsAvg field already computed on the ticker.
 */
function computeVolumeAdjustment(t: EnrichedTicker): number {
  if (t.volVsAvg == null) return 0;
  if (t.volVsAvg > 2) return 5;
  if (t.volVsAvg < 0.5) return -5;
  return 0;
}

// ═══════════════════════════════════════════════════════════════════════
// Market regime detection
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute a simple market regime based on aggregate signal directions
 * across all tokens in the current scan.
 */
function computeMarketRegime(signals: TokenSignal[]): string {
  if (signals.length === 0) return 'neutral';

  let bullishCount = 0;
  let bearishCount = 0;

  for (const s of signals) {
    if (s.signalBreakdown) {
      const mDir = s.signalBreakdown.momentum.direction;
      const tfDir = s.signalBreakdown.trendFollowing.direction;
      if (mDir === 'bullish' && tfDir === 'bullish') bullishCount++;
      if (mDir === 'bearish' && tfDir === 'bearish') bearishCount++;
    } else {
      // Fallback: if no breakdown, use score thresholds
      if (s.momentumScore > 60) bullishCount++;
      if (s.momentumScore < 40) bearishCount++;
    }
  }

  if (bullishCount > bearishCount * 2) return 'risk-on';
  if (bearishCount > bullishCount * 2) return 'risk-off';
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════════════
// Composite signal computation
// ═══════════════════════════════════════════════════════════════════════

/**
 * Compute composite signal scores for all tickers.
 *
 * Scoring model:
 *   - Momentum (40%): price change, spread, book imbalance
 *   - Technical (40%): RSI, MACD, BB position, volume trend
 *   - News (20%): recent relevant news volume and relevance
 *   - On-chain boost (trend-aware, up to +15% added)
 *   - Confidence calibration (±10% / -5% / -15%)
 *   - Volume confirmation (±5%)
 *
 * Each token also receives:
 *   - `signalBreakdown`: per-strategy direction + confidence
 *   - `regime`: market-wide regime (risk-on/risk-off/neutral)
 *
 * @param tickers Array of enriched tickers
 * @param technicals Map of symbol -> TechnicalIndicators
 * @param newsMatches Array of news matches
 * @param onchain Optional on-chain metrics for TVL-based boost
 * @returns Array of computed TokenSignal objects
 */
export function computeSignals(
  tickers: EnrichedTicker[],
  technicals: Map<string, TechnicalIndicators>,
  newsMatches: NewsMatch[],
  onchain?: OnChainMetrics | null,
): TokenSignal[] {
  // Evict stale alert entries before processing
  evictStaleAlerts();

  const newsBySymbol = new Map<string, NewsMatch[]>();
  for (const m of newsMatches) {
    const arr = newsBySymbol.get(m.symbol) ?? [];
    arr.push(m);
    newsBySymbol.set(m.symbol, arr);
  }

  // First pass: compute raw signals for every ticker
  const signals: TokenSignal[] = tickers.map(t => {
    const tech = technicals.get(t.symbol);
    const newsItems = newsBySymbol.get(t.symbol) ?? [];

    // ── Sub-scores (0-100) ─────────────────────────────────────────
    const momentumScore = computeMomentumScore(t);
    const technicalScore = tech ? computeTechnicalScore(tech) : 0;
    const newsScore = computeNewsScore(newsItems);

    // ── On-chain boost (0-15pp, trend-aware) ───────────────────────
    const onchainBoost = onchain
      ? computeOnchainBoost(t.symbol, t.tokenId, onchain)
      : 0;

    // ── Signal directions for confidence calibration ───────────────
    const momentumDir = getMomentumDirection(t);
    const meanRevDir = getMeanReversionDirection(tech);
    const trendDir = getTrendFollowingDirection(tech);

    // ── Per-strategy confidence (0-100) ────────────────────────────
    const momConf = momentumConfidence(t);
    const mrConf = meanReversionConfidence(tech);
    const tfConf = trendFollowingConfidence(tech);

    // ── Confidence calibration (penalty or bonus) ──────────────────
    const { penalty, breakdown } = calibrateConfidence(
      momentumDir, meanRevDir, trendDir,
      momConf, mrConf, tfConf,
    );

    // ── Volume confirmation ────────────────────────────────────────
    const volumeAdj = computeVolumeAdjustment(t);

    // ── Composite score ────────────────────────────────────────────
    let compositeScore =
      momentumScore * 0.40 +
      technicalScore * 0.40 +
      newsScore * 0.20 +
      onchainBoost +
      penalty +
      volumeAdj;

    compositeScore = clamp(compositeScore, 0, 100);

    // ── Alerts (deduplicated) ──────────────────────────────────────
    const rawAlerts = buildAlerts(t, tech, newsItems, onchainBoost);
    const alerts = rawAlerts.filter(a => isAlertUnique(`${t.symbol}:${a}`));

    return {
      symbol: t.symbol,
      tokenId: t.tokenId,
      tokenName: t.tokenName,
      chain: t.chain,
      lastPrice: t.lastPrice,
      priceChangePercent: t.priceChangePercent,
      momentumScore: Math.round(momentumScore * 10) / 10,
      technicalScore: Math.round(technicalScore * 10) / 10,
      newsScore: Math.round(newsScore * 10) / 10,
      compositeScore: Math.round(compositeScore * 10) / 10,
      alerts,
      timestamp: t.tsUtc,
      signalBreakdown: breakdown,
      // regime filled in the second pass below
    };
  });

  // Second pass: compute market regime from aggregate signal data
  const regime = computeMarketRegime(signals);
  for (const s of signals) {
    s.regime = regime;
  }

  return signals;
}

// ═══════════════════════════════════════════════════════════════════════
// Alert builder
// ═══════════════════════════════════════════════════════════════════════

/**
 * Build alert strings for a token without dedup filtering.
 */
function buildAlerts(
  t: EnrichedTicker,
  tech: TechnicalIndicators | undefined,
  newsItems: NewsMatch[],
  onchainBoost: number,
): string[] {
  const alerts: string[] = [];
  if (t.priceChangePercent <= -5) alerts.push('🔴 DIP (>5% drop)');
  if (t.priceChangePercent >= 5) alerts.push('🟢 PUMP (>5% gain)');
  if (tech?.rsi != null && tech.rsi > 70) alerts.push('Overbought (RSI > 70)');
  if (tech?.rsi != null && tech.rsi < 30) alerts.push('Oversold (RSI < 30)');
  if (tech?.bb != null && tech.bb.position >= 0.95) alerts.push('BB upper touch');
  if (tech?.bb != null && tech.bb.position <= 0.05) alerts.push('BB lower touch');
  if (t.quoteVolume >= 10e6) alerts.push('High volume');
  if (t.spreadPct >= 1) alerts.push('Wide spread');
  if (newsItems.length >= 2) alerts.push(`News: ${newsItems.length} articles`);
  if (onchainBoost >= 10) alerts.push('Strong on-chain TVL');
  return alerts;
}

// ═══════════════════════════════════════════════════════════════════════
// Score computation functions (unchanged from original)
// ═══════════════════════════════════════════════════════════════════════

/** Momentum score from market data (0-100) */
function computeMomentumScore(t: EnrichedTicker): number {
  let score = 50; // neutral baseline

  // Price change contribution (up to ±30)
  score += t.priceChangePercent * 3;

  // Spread penalty (wide spread = less momentum)
  if (t.spreadPct > 1) score -= 10;
  if (t.spreadPct > 0.5) score -= 5;

  // Volume boost
  if (t.quoteVolume > 10e6) score += 10;
  if (t.quoteVolume > 50e6) score += 5;

  // Book imbalance (strong buy/sell pressure)
  if (t.bookImbalance > 0.3) score += 8;
  if (t.bookImbalance < -0.3) score -= 8;

  // Range position
  if (t.rangePosPct > 0.9) score += 5;  // near high
  if (t.rangePosPct < 0.1) score -= 5;  // near low

  return clamp(score, 0, 100);
}

/** Technical score from indicators (0-100) */
function computeTechnicalScore(t: TechnicalIndicators): number {
  let score = 50;

  // RSI
  if (t.rsi != null) {
    if (t.rsi > 70) score -= 10;  // overbought
    else if (t.rsi < 30) score += 10;  // oversold (potential bounce)
    else if (t.rsi > 60) score += 5;  // bullish momentum
    else if (t.rsi < 40) score -= 5;  // bearish
  }

  // MACD
  if (t.macd?.histogram != null) {
    if (t.macd.histogram > 0) score += 8;
    else score -= 8;
  }

  // BB position
  if (t.bb != null) {
    if (t.bb.position > 0.8) score -= 5;  // stretched high
    if (t.bb.position < 0.2) score += 5;  // stretched low
  }

  // Volume trend
  if (t.volTrend != null) {
    score += clamp(t.volTrend * 10, -10, 10);
  }

  // Price vs EMA50
  if (t.priceVsEma50 != null) {
    score += clamp(t.priceVsEma50, -10, 10);
  }

  return clamp(score, 0, 100);
}

/** News score (0-100) */
function computeNewsScore(newsItems: NewsMatch[]): number {
  if (newsItems.length === 0) return 0;
  let score = 0;
  for (const item of newsItems) {
    score += item.relevance * 20;
  }
  return clamp(score, 0, 100);
}

/** Clamp a value between min and max */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
