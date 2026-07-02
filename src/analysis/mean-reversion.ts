// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Mean Reversion Strategy
// ═══════════════════════════════════════════════════════════════════════
//
// Identifies overextended prices likely to revert:
//   - RSI extremes (>70 overbought, <30 oversold)
//   - Distance from moving averages (VWAP, EMA50)
//   - Bollinger Band squeeze + position
//   - Low momentum + extreme positioning

import type { SignalStrategy, StrategyContext, StrategySignal } from './strategies.js';

/**
 * Mean Reversion strategy.
 *
 * Identifies overextended prices likely to revert to the mean
 * using RSI, Bollinger Bands, and MA distance.
 */
export class MeanReversionStrategy implements SignalStrategy {
  readonly name = 'mean-reversion';
  readonly description = 'Identifies overextended prices likely to revert to the mean using RSI, BB, and MA distance';
  readonly timeframe = '1h';

  evaluate(ctx: StrategyContext): StrategySignal {
    const { ticker, technical } = ctx;
    let confidence = 0.3; // base — mean reversion is riskier
    const indicators: Record<string, number | null> = {};
    const reasons: string[] = [];

    // 1. RSI extremes
    if (technical?.rsi != null) {
      indicators.rsi = technical.rsi;
      if (technical.rsi > 75) {
        confidence += 0.25;
        reasons.push(`overbought (RSI ${technical.rsi.toFixed(1)}), expecting pullback`);
      } else if (technical.rsi > 70) {
        confidence += 0.15;
        reasons.push(`moderately overbought (RSI ${technical.rsi.toFixed(1)})`);
      } else if (technical.rsi < 25) {
        confidence += 0.25;
        reasons.push(`oversold (RSI ${technical.rsi.toFixed(1)}), expecting bounce`);
      } else if (technical.rsi < 30) {
        confidence += 0.15;
        reasons.push(`moderately oversold (RSI ${technical.rsi.toFixed(1)})`);
      }
    }

    // 2. Bollinger Band position — price near bands suggests reversion
    if (technical?.bb != null) {
      indicators.bbPosition = technical.bb.position;
      if (technical.bb.position > 0.95) {
        confidence += 0.15;
        reasons.push(`price at upper BB (position ${technical.bb.position.toFixed(2)})`);
      } else if (technical.bb.position < 0.05) {
        confidence += 0.15;
        reasons.push(`price at lower BB (position ${technical.bb.position.toFixed(2)})`);
      }

      // BB squeeze — narrow bands often precede explosive moves
      if (technical.bb.width < 0.05) {
        confidence += 0.10;
        reasons.push(`BB squeeze (width ${technical.bb.width.toFixed(4)})`);
      }
      indicators.bbWidth = technical.bb.width;
    }

    // 3. Distance from VWAP
    if (Math.abs(ticker.vwapDistPct) > 3) {
      confidence += 0.10;
      reasons.push(`${ticker.vwapDistPct > 0 ? 'above' : 'below'} VWAP by ${Math.abs(ticker.vwapDistPct).toFixed(1)}%`);
    }
    indicators.vwapDistance = ticker.vwapDistPct;

    // 4. Price vs EMA50
    if (technical?.priceVsEma50 != null) {
      indicators.priceVsEma50 = technical.priceVsEma50;
      if (Math.abs(technical.priceVsEma50) > 5) {
        confidence += 0.10;
        reasons.push(`price ${technical.priceVsEma50 > 0 ? 'above' : 'below'} EMA50 by ${Math.abs(technical.priceVsEma50).toFixed(1)}%`);
      }
    }

    // 5. Low momentum + extreme position = strong reversion signal
    if (Math.abs(ticker.momentum) < 2 && confidence > 0.5) {
      confidence += 0.10;
      reasons.push('low momentum amplifies reversion probability');
    }

    // Direction: mean reversion bets AGAINST the current move
    let direction: 'buy' | 'sell' | 'neutral' | 'strong_buy' | 'strong_sell';
    const isOverbought =
      (technical?.rsi != null && technical.rsi > 70) ||
      (technical?.bb != null && technical.bb.position > 0.9);

    const isOversold =
      (technical?.rsi != null && technical.rsi < 30) ||
      (technical?.bb != null && technical.bb.position < 0.1);

    if (isOverbought && confidence >= 0.7) {
      direction = 'sell'; // price high, expect reversion down
    } else if (isOversold && confidence >= 0.7) {
      direction = 'buy';  // price low, expect reversion up
    } else if (isOverbought) {
      direction = 'neutral';
    } else if (isOversold) {
      direction = 'neutral';
    } else {
      direction = 'neutral';
    }

    confidence = Math.max(0, Math.min(1, confidence));

    return {
      strategy: this.name,
      direction,
      confidence: Math.round(confidence * 100) / 100,
      reason: reasons.join('; ') || 'no clear reversion signal',
      indicators,
      timeframe: this.timeframe,
    };
  }
}
