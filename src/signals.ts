// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Signal Generator
// ═══════════════════════════════════════════════════════════════════════

import type {
  EnrichedTicker, TokenSignal, TechnicalIndicators,
  NewsMatch, Chain,
} from './types.js';
import type { OnChainMetrics } from './onchain.js';
import { PROTOCOL_MAP } from './onchain.js';
import { getTokenById } from './tokens.js';

/**
 * Compute an on-chain confidence boost (0–15 percentage points) based on
 * protocol TVL for a given token. Uses the PROTOCOL_MAP to find the
 * DeFiLlama protocol slug for the token, then looks up the fetched TVL
 * from the OnChainMetrics result.
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

  // High TVL (>$1B) → +10–15% boost
  if (tvl > 1_000_000_000) {
    return 10 + Math.min((tvl - 1_000_000_000) / 100_000_000_000 * 5, 5);
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

/**
 * Compute composite signal scores for all tickers.
 *
 * Scoring model:
 * - Momentum (40%): price change, spread, book imbalance
 * - Technical (40%): RSI, MACD, BB position, volume trend
 * - News (20%): recent relevant news volume and relevance
 * - On-chain boost (up to +15% added to composite): protocol TVL strength
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

    // On-chain boost (0-15 percentage points)
    const onchainBoost = onchain
      ? computeOnchainBoost(t.symbol, t.tokenId, onchain)
      : 0;

    // Composite (weighted + on-chain boost)
    let compositeScore =
      momentumScore * 0.40 +
      technicalScore * 0.40 +
      newsScore * 0.20 +
      onchainBoost; // add on-chain boost directly as percentage points

    // Cap at 100
    compositeScore = Math.min(compositeScore, 100);

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
    if (onchainBoost >= 10) alerts.push('Strong on-chain TVL');

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
