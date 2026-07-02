// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Trend Following Strategy
// ═══════════════════════════════════════════════════════════════════════
//
// Identifies established trends using:
//   - EMA alignment (short > mid > long = uptrend)
//   - Price above/below key MAs
//   - ADX-style trend strength (via ATR comparison)
//   - Higher highs / lower lows pattern detection
//   - Volume supporting the trend

import type { SignalStrategy, StrategyContext, StrategySignal } from './strategies.js';
import { ema } from '../indicators.js';

export class TrendFollowingStrategy implements SignalStrategy {
  readonly name = 'trend-following';
  readonly description = 'Identifies established trends using EMA alignment, price vs MA, and volume confirmation';
  readonly timeframe = '1h';

  evaluate(ctx: StrategyContext): StrategySignal {
    const { ticker, technical, klineCloses } = ctx;
    let confidence = 0.3;
    const indicators: Record<string, number | null> = {};
    const reasons: string[] = [];

    // 1. EMA alignment (trend direction)
    const ema20 = ema(klineCloses, 20);
    const ema50 = ema(klineCloses, 50);
    const ema200 = ema(klineCloses, 200);
    indicators.ema20 = ema20;
    indicators.ema50 = ema50;
    indicators.ema200 = ema200;

    const currentPrice = klineCloses[klineCloses.length - 1] ?? ticker.lastPrice;

    let trendDirection: 'up' | 'down' | 'sideways' = 'sideways';
    let trendStrength = 0;

    if (ema20 != null && ema50 != null) {
      // Uptrend: short > mid, price above both
      if (ema20 > ema50 && currentPrice > ema20) {
        trendDirection = 'up';
        trendStrength += 1;
        confidence += 0.10;
        reasons.push('EMA20 above EMA50 — bullish alignment');
      }
      // Downtrend: short < mid, price below both
      else if (ema20 < ema50 && currentPrice < ema20) {
        trendDirection = 'down';
        trendStrength += 1;
        confidence += 0.10;
        reasons.push('EMA20 below EMA50 — bearish alignment');
      } else {
        reasons.push('EMAs mixed — no clear trend');
      }
    }

    // 3-way alignment with EMA200
    if (ema200 != null && ema20 != null && ema50 != null) {
      if (ema20 > ema50 && ema50 > ema200) {
        trendStrength += 2;
        confidence += 0.15;
        reasons.push('full bullish alignment: EMA20 > EMA50 > EMA200');
      } else if (ema20 < ema50 && ema50 < ema200) {
        trendStrength += 2;
        confidence += 0.15;
        reasons.push('full bearish alignment: EMA20 < EMA50 < EMA200');
      }
    }

    // 2. Price position relative to EMAs
    if (ema50 != null) {
      const distFromEma50 = ((currentPrice - ema50) / ema50) * 100;
      indicators.priceVsEma50 = distFromEma50;

      if (distFromEma50 > 2 && trendDirection === 'up') {
        confidence += 0.08;
        reasons.push(`price ${distFromEma50.toFixed(1)}% above EMA50, trend strong`);
      } else if (distFromEma50 < -2 && trendDirection === 'down') {
        confidence += 0.08;
        reasons.push(`price ${Math.abs(distFromEma50).toFixed(1)}% below EMA50, trend strong`);
      } else if (Math.abs(distFromEma50) < 1) {
        reasons.push('price near EMA50 — potential trend consolidation');
      }
    }

    // 3. Volume confirmation
    if (technical?.volTrend != null) {
      indicators.volumeTrend = technical.volTrend;
      // Volume rising with price = trend confirmation
      if (technical.volTrend > 0.2 && Math.abs(ticker.priceChangePercent) > 2) {
        confidence += 0.08;
        reasons.push('volume confirms trend direction');
      }
    }

    // 4. ATR-based trend strength (higher vol = stronger trend)
    if (technical?.atrPct != null) {
      indicators.atrPercent = technical.atrPct;
      if (technical.atrPct > 3) {
        confidence += 0.05;
        reasons.push(`high volatility (ATR ${technical.atrPct.toFixed(1)}%)`);
      }
    }

    // 5. 24h price change in trend direction
    if (trendDirection === 'up' && ticker.priceChangePercent > 0) {
      confidence += 0.05;
    } else if (trendDirection === 'down' && ticker.priceChangePercent < 0) {
      confidence += 0.05;
    }

    // Determine signal
    const isStrongTrend = trendStrength >= 3;
    let direction: 'buy' | 'sell' | 'neutral' | 'strong_buy' | 'strong_sell';

    if (trendDirection === 'up' && isStrongTrend && confidence >= 0.7) {
      direction = 'strong_buy';
    } else if (trendDirection === 'up' && confidence >= 0.5) {
      direction = 'buy';
    } else if (trendDirection === 'down' && isStrongTrend && confidence >= 0.7) {
      direction = 'strong_sell';
    } else if (trendDirection === 'down' && confidence >= 0.5) {
      direction = 'sell';
    } else {
      direction = 'neutral';
    }

    confidence = Math.max(0, Math.min(1, confidence));

    return {
      strategy: this.name,
      direction,
      confidence: Math.round(confidence * 100) / 100,
      reason: reasons.join('; ') || 'no clear trend detected',
      indicators,
      timeframe: this.timeframe,
    };
  }
}
