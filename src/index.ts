// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Public API
// ═══════════════════════════════════════════════════════════════════════

export { runRadar, displayRadar } from './radar.js';
export { fetchAllTickers, fetchTicker, fetchKlines, fetchDepth } from './binance.js';
export { fetchAndMatchNews } from './news.js';
export { computeSignals } from './signals.js';
export { computeAllIndicators, computeRSI, computeMACD, computeBB, computeATR } from './indicators.js';
export { getTokenList, getTokenById, getTokenBySymbol, getTokensByChain, getBinancePair } from './tokens.js';
export { toTable, toCSV, toMarkdownReport, toSignalReport } from './output.js';

// Enterprise core
export { loadConfig, resetConfig, writeDefaultConfig } from './core/config.js';
export type { RadarConfig } from './core/config.js';
export { CryptoRadarError, NetworkError, RateLimitError, DataError, ConfigError, CacheError, SignalError } from './core/errors.js';
export { logger } from './core/logger.js';
export { Cache } from './core/cache.js';
export { RateLimiter } from './core/rate-limiter.js';

// Charts
export { priceSparkline, multiMaSparkline, priceSvgChart, multiPanelSvgChart } from './io/charts.js';

// Strategy engine
export { StrategyEngine } from './analysis/engine.js';
export { MomentumStrategy } from './analysis/momentum.js';
export { MeanReversionStrategy } from './analysis/mean-reversion.js';
export { TrendFollowingStrategy } from './analysis/trend-following.js';
export type { SignalStrategy, StrategyContext, StrategySignal, AggregatedSignal, SignalDirection } from './analysis/strategies.js';

// Health
export { HealthMonitor } from './monitor/health.js';
export type { HealthStatus } from './monitor/health.js';

export type {
  TokenDef, BinanceTicker, EnrichedTicker, TechnicalIndicators,
  NewsMatch, TokenSignal, RadarOptions, RadarRun,
  Kline, Chain, SortMode, OutputFormat,
} from './types.js';
