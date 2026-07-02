// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Strategy Engine
// ═══════════════════════════════════════════════════════════════════════
//
// Runs multiple strategies against market data and aggregates results
// into a single composite signal per token.

import type { SignalStrategy, StrategyContext, AggregatedSignal, StrategyWeight } from './strategies.js';
import type { EnrichedTicker, TechnicalIndicators, NewsMatch } from '../types.js';
import { MomentumStrategy } from './momentum.js';
import { MeanReversionStrategy } from './mean-reversion.js';
import { TrendFollowingStrategy } from './trend-following.js';
import { logger } from '../core/logger.js';

const DEFAULT_STRATEGIES: SignalStrategy[] = [
  new MomentumStrategy(),
  new MeanReversionStrategy(),
  new TrendFollowingStrategy(),
];

const DEFAULT_WEIGHTS: StrategyWeight[] = [
  { name: 'momentum', weight: 0.40 },
  { name: 'mean-reversion', weight: 0.20 },
  { name: 'trend-following', weight: 0.40 },
];

export class StrategyEngine {
  private strategies: SignalStrategy[];
  private weights: Map<string, number>;

  constructor(
    strategies: SignalStrategy[] = DEFAULT_STRATEGIES,
    weights: StrategyWeight[] = DEFAULT_WEIGHTS,
  ) {
    this.strategies = strategies;
    this.weights = new Map(weights.map(w => [w.name, w.weight]));
  }

  /** Evaluate all strategies for a single token context. */
  evaluate(ctx: StrategyContext): AggregatedSignal {
    const signals = this.strategies.map(s => {
      try {
        return s.evaluate(ctx);
      } catch (err) {
        logger.error(`Strategy "${s.name}" failed`, {
          symbol: ctx.ticker.symbol,
          error: err instanceof Error ? err.message : String(err),
        });
        return {
          strategy: s.name,
          direction: 'neutral' as const,
          confidence: 0,
          reason: `Error: ${err}`,
          indicators: {},
          timeframe: s.timeframe,
        };
      }
    });

    return this.aggregate(signals, ctx);
  }

  /** Aggregate multiple strategy signals into one. */
  private aggregate(signals: ReturnType<SignalStrategy['evaluate']>[], ctx: StrategyContext): AggregatedSignal {
    const totalWeight = Array.from(this.weights.values()).reduce((a, b) => a + b, 0) || 1;
    let weightedConfidence = 0;
    const dirVotes: Record<string, number> = { buy: 0, sell: 0, neutral: 0, strong_buy: 0, strong_sell: 0 };

    for (const signal of signals) {
      const weight = this.weights.get(signal.strategy) ?? (1 / this.strategies.length);
      const normalizedWeight = weight / totalWeight;

      // Confidence contributed to composite
      weightedConfidence += signal.confidence * normalizedWeight;

      // Direction voting
      const voteWeight = signal.confidence * normalizedWeight;
      dirVotes[signal.direction] = (dirVotes[signal.direction] ?? 0) + voteWeight;

      // Strong signals count double in votes
      if (signal.direction === 'strong_buy') dirVotes['buy'] = (dirVotes['buy'] ?? 0) + voteWeight;
      if (signal.direction === 'strong_sell') dirVotes['sell'] = (dirVotes['sell'] ?? 0) + voteWeight;
    }

    // Determine consensus direction
    let direction: 'buy' | 'sell' | 'neutral' | 'strong_buy' | 'strong_sell';
    const buyVotes = (dirVotes['buy'] ?? 0) + (dirVotes['strong_buy'] ?? 0);
    const sellVotes = (dirVotes['sell'] ?? 0) + (dirVotes['strong_sell'] ?? 0);

    if (buyVotes > sellVotes && buyVotes > 0.3) {
      direction = buyVotes > 0.5 ? 'strong_buy' : 'buy';
    } else if (sellVotes > buyVotes && sellVotes > 0.3) {
      direction = sellVotes > 0.5 ? 'strong_sell' : 'sell';
    } else {
      direction = 'neutral';
    }

    // Collect unique alerts
    const alerts: string[] = [];
    if (ctx.ticker.priceChangePercent <= -5) alerts.push('🔴 DIP (>5% drop)');
    if (ctx.ticker.priceChangePercent >= 5) alerts.push('🟢 PUMP (>5% gain)');
    if (ctx.technical?.rsi != null && ctx.technical.rsi > 70) alerts.push('RSI overbought');
    if (ctx.technical?.rsi != null && ctx.technical.rsi < 30) alerts.push('RSI oversold');
    if (ctx.ticker.quoteVolume >= 10e6) alerts.push('High volume');
    if (ctx.news.length >= 2) alerts.push(`News: ${ctx.news.length} articles`);

    const strategySignals = signals.map(s => ({
      strategy: s.strategy,
      direction: s.direction,
      confidence: s.confidence,
      reason: s.reason,
      indicators: s.indicators,
      timeframe: s.timeframe,
    }));

    return {
      symbol: ctx.ticker.symbol,
      tokenName: ctx.ticker.tokenName,
      chain: ctx.ticker.chain,
      lastPrice: ctx.ticker.lastPrice,
      priceChangePercent: ctx.ticker.priceChangePercent,
      direction,
      compositeConfidence: Math.round(weightedConfidence * 100) / 100,
      signals: strategySignals,
      alerts,
      timestamp: ctx.ticker.tsUtc,
    };
  }

  /** Get registered strategies metadata with weights. */
  getStrategyInfo(): Array<{ name: string; description: string; timeframe: string; weight: number }> {
    return this.strategies.map(s => ({
      name: s.name,
      description: s.description,
      timeframe: s.timeframe,
      weight: this.weights.get(s.name) ?? (1 / this.strategies.length),
    }));
  }
}
