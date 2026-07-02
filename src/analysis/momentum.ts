// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Momentum Strategy
// ═══════════════════════════════════════════════════════════════════════
//
// Detects strong trending moves by combining:
//   - Price change velocity (rate of change)
//   - Volume confirmation (volume rising with price)
//   - RSI momentum (not overbought, but strong)
//   - MACD alignment (histogram direction)
//   - Breakout from Bollinger Bands

import type { SignalStrategy, StrategyContext, StrategySignal } from './strategies.js';

/**
 * Momentum strategy.
 *
 * Detects strong trending moves with volume confirmation
 * and MACD alignment.
 */
export class MomentumStrategy implements SignalStrategy {
  readonly name = 'momentum';
  readonly description = 'Detects strong trending moves with volume confirmation and MACD alignment';
  readonly timeframe = '1h';

  evaluate(ctx: StrategyContext): StrategySignal {
    const { ticker, technical, klineCloses, klineVolumes } = ctx;
    let confidence = 0.5;
    const indicators: Record<string, number | null> = {};
    const reasons: string[] = [];

    // 1. Price change velocity (rate of change over 24h)
    const roc = ticker.priceChangePercent;
    indicators.roc = roc;

    if (roc > 5) {
      confidence += 0.20;
      reasons.push(`strong upward momentum: ${roc.toFixed(2)}%`);
    } else if (roc > 2) {
      confidence += 0.10;
      reasons.push(`moderate momentum: ${roc.toFixed(2)}%`);
    } else if (roc < -5) {
      confidence += 0.20;
      reasons.push(`strong downward momentum: ${roc.toFixed(2)}%`);
    } else if (roc < -2) {
      confidence += 0.10;
      reasons.push(`moderate downside momentum: ${roc.toFixed(2)}%`);
    }

    // 2. Volume confirmation
    if (ticker.quoteVolume > 50e6) {
      confidence += 0.10;
      reasons.push('very high volume');
    } else if (ticker.quoteVolume > 10e6) {
      confidence += 0.05;
    }

    // Volume trend
    if (technical?.volTrend != null && technical.volTrend > 0.3) {
      confidence += 0.08;
      reasons.push(`volume surging: ${(technical.volTrend * 100).toFixed(0)}% vs avg`);
    }
    indicators.volumeTrend = technical?.volTrend ?? null;

    // 3. RSI — strong but not exhausted
    if (technical?.rsi != null) {
      indicators.rsi = technical.rsi;
      if (roc > 0) {
        if (technical.rsi > 60 && technical.rsi < 75) {
          confidence += 0.08;
          reasons.push(`bullish RSI: ${technical.rsi.toFixed(1)}`);
        } else if (technical.rsi >= 75) {
          confidence -= 0.05;
          reasons.push('RSI overbought, potential exhaustion');
        }
      } else {
        if (technical.rsi < 40 && technical.rsi > 25) {
          confidence += 0.08;
          reasons.push(`bearish RSI: ${technical.rsi.toFixed(1)}`);
        } else if (technical.rsi <= 25) {
          confidence -= 0.05;
          reasons.push('RSI oversold, potential bounce');
        }
      }
    }

    // 4. MACD alignment
    if (technical?.macd != null) {
      indicators.macdHistogram = technical.macd.histogram;
      if (technical.macd.histogram > 0 && roc > 0) {
        confidence += 0.08;
        reasons.push('MACD positive and expanding');
      } else if (technical.macd.histogram < 0 && roc < 0) {
        confidence += 0.08;
        reasons.push('MACD negative and declining');
      } else if (technical.macd.histogram > 0 && roc < 0) {
        // Divergence warning
        reasons.push('⚠️ bullish MACD divergence (price down, MACD up)');
        confidence += 0.05;
      } else if (technical.macd.histogram < 0 && roc > 0) {
        reasons.push('⚠️ bearish MACD divergence (price up, MACD down)');
        confidence -= 0.05;
      }
    }

    // 5. BB breakout
    if (technical?.bb != null) {
      indicators.bbPosition = technical.bb.position;
      if (technical.bb.position > 0.95 && roc > 0) {
        confidence += 0.05;
        reasons.push('price at upper BB band');
      } else if (technical.bb.position < 0.05 && roc < 0) {
        confidence += 0.05;
        reasons.push('price at lower BB band');
      }
    }

    // Determine direction
    let direction: 'buy' | 'sell' | 'neutral' | 'strong_buy' | 'strong_sell';
    if (confidence >= 0.8) {
      direction = roc > 0 ? 'strong_buy' : 'strong_sell';
    } else if (confidence >= 0.6) {
      direction = roc > 0 ? 'buy' : 'sell';
    } else {
      direction = 'neutral';
    }

    confidence = Math.max(0, Math.min(1, confidence));

    return {
      strategy: this.name,
      direction,
      confidence: Math.round(confidence * 100) / 100,
      reason: reasons.join('; ') || 'no clear momentum signal',
      indicators,
      timeframe: this.timeframe,
    };
  }
}
