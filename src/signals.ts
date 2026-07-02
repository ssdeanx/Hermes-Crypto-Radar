// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Signal Generator
// ═══════════════════════════════════════════════════════════════════════

import type {
  EnrichedTicker, TokenSignal, TechnicalIndicators,
  NewsMatch, Chain,
} from './types.js';
import { getTokenById } from './tokens.js';

/**
 * Compute composite signal scores for all tickers.
 *
 * Scoring model:
 * - Momentum (40%): price change, spread, book imbalance
 * - Technical (40%): RSI, MACD, BB position, volume trend
 * - News (20%): recent relevant news volume and relevance
 *
 * @param tickers Array of enriched tickers
 * @param technicals Map of symbol -> TechnicalIndicators
 * @param newsMatches Array of news matches
 * @returns Array of computed TokenSignal objects
 */
export function computeSignals(
  tickers: EnrichedTicker[],
  technicals: Map<string, TechnicalIndicators>,
  newsMatches: NewsMatch[],
): TokenSignal[] {
  const newsBySymbol = new Map<string, NewsMatch[]>();
  for (const m of newsMatches) {
    const arr = newsBySymbol.get(m.symbol) ?? [];
    arr.push(m);
    newsBySymbol.set(m.symbol, arr);
  }

  return tickers.map(t => {
    const tech = technicals.get(t.symbol);
    const newsItems = newsBySymbol.get(t.symbol) ?? [];

    // Momentum score (0-100)
    const momentumScore = computeMomentumScore(t);

    // Technical score (0-100)
    const technicalScore = tech ? computeTechnicalScore(tech) : 0;

    // News score (0-100)
    const newsScore = computeNewsScore(newsItems);

    // Composite (weighted)
    const compositeScore =
      momentumScore * 0.40 +
      technicalScore * 0.40 +
      newsScore * 0.20;

    // Alerts
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

    const tokenDef = getTokenById(t.tokenId);

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
    };
  });
}

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

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
