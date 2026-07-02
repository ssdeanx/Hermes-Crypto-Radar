import type { EnrichedTicker, TechnicalIndicators, NewsMatch } from '../types.js';

export type SignalDirection = 'buy' | 'sell' | 'neutral' | 'strong_buy' | 'strong_sell';

export interface StrategySignal {
  strategy: string;
  direction: SignalDirection;
  confidence: number;
  reason: string;
  indicators: Record<string, number | null>;
  timeframe: string;
}

export interface AggregatedSignal {
  symbol: string;
  tokenName: string;
  chain: string;
  lastPrice: number;
  priceChangePercent: number;
  direction: SignalDirection;
  compositeConfidence: number;
  signals: StrategySignal[];
  alerts: string[];
  timestamp: string;
  compositeReason?: string;
}

export interface StrategyContext {
  ticker: EnrichedTicker;
  technical: TechnicalIndicators | null;
  technicalsByInterval: Map<string, TechnicalIndicators>;
  news: NewsMatch[];
  klineCloses: number[];
  klineHighs: number[];
  klineLows: number[];
  klineVolumes: number[];
}

export interface SignalStrategy {
  readonly name: string;
  readonly description: string;
  readonly timeframe: string;
  evaluate(ctx: StrategyContext): StrategySignal;
}

export interface StrategyWeight {
  name: string;
  weight: number;
}
