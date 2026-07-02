// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Strategy Interface & Types
// ═══════════════════════════════════════════════════════════════════════

import type { EnrichedTicker, TechnicalIndicators, NewsMatch } from '../types.js';

/** Direction a strategy recommends */
export type SignalDirection = 'buy' | 'sell' | 'neutral' | 'strong_buy' | 'strong_sell';

/** A single signal from a strategy */
export interface StrategySignal {
  strategy: string;
  direction: SignalDirection;
  confidence: number;          // 0.0 – 1.0
  reason: string;
  indicators: Record<string, number | null>;
  timeframe: string;           // e.g. '1h', '4h', '1d'
}

/** Aggregated signal across all strategies */
export interface AggregatedSignal {
  symbol: string;
  tokenName: string;
  chain: string;
  lastPrice: number;
  priceChangePercent: number;
  direction: SignalDirection;
  compositeConfidence: number;  // 0.0 – 1.0
  signals: StrategySignal[];
  alerts: string[];
  timestamp: string;
}

/** Context passed to every strategy for evaluation */
export interface StrategyContext {
  ticker: EnrichedTicker;
  technical: TechnicalIndicators | null;
  news: NewsMatch[];
  klineCloses: number[];
  klineHighs: number[];
  klineLows: number[];
  klineVolumes: number[];
}

/** A strategy evaluates market data and returns signals */
export interface SignalStrategy {
  readonly name: string;
  readonly description: string;
  readonly timeframe: string;
  evaluate(ctx: StrategyContext): StrategySignal;
}

/** Weighted vote for signal aggregation */
export interface StrategyWeight {
  name: string;
  weight: number;  // 0.0 – 1.0
}
