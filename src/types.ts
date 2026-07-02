// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Core Types
// ═══════════════════════════════════════════════════════════════════════

/** Blockchain chain identifier */
export type Chain = 'solana' | 'polygon' | 'bnb' | 'xrp' | 'ethereum' | 'bitcoin' | 'dogecoin' | 'cardano' | 'multi';

/** Supported output formats */
export type OutputFormat = 'csv' | 'json' | 'md' | 'table' | 'xlsx';

/** Sort mode for radar display */
export type SortMode = 'alpha' | 'change' | 'volume' | 'signal' | 'momentum';

/** Kline interval for multi-timeframe analysis */
export type KlineInterval = '15m' | '1h' | '4h' | '1d';

/** Token definition */
export interface TokenDef {
  id: string;
  sym: string;
  name: string;
  chain: Chain;
  /** When chain='multi', the actual chains this token trades under */
  chains?: Chain[];
  /** Binance trading pair, e.g. 'SOLUSDT' */
  pair?: string;
  /** CoinGecko ID for alternative data source */
  coingeckoId?: string;
}

/** Raw Binance ticker data (24hr ticker endpoint) */
export interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

/** Full enriched ticker with computed indicators */
export interface EnrichedTicker {
  runId: string;
  tsUtc: string;
  dateEt: string;
  symbol: string;
  chain: Chain;
  tokenId: string;
  tokenName: string;
  lastPrice: number;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  spreadPct: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  prevClosePrice: number;
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  volume: number;
  quoteVolume: number;
  count: number;
  lastQty: number;
  vwapDistPct: number;
  rangePosPct: number;
  bookImbalance: number;
  volVsAvg: number;
  obv: number;
  momentum: number;
  alerts: string;
  source: string;
}

/** Technical indicators computed from kline/candlestick data */
export interface TechnicalIndicators {
  rsi: number | null;
  mfi: number | null;
  bb: BBandsResult | null;
  macd: MACDResult | null;
  atrPct: number | null;
  volTrend: number | null;
  priceVsEma50: number | null;
  obv: number | null;
  volVsAvg: number | null;
}

export interface BBandsResult {
  upper: number;
  middle: number;
  lower: number;
  width: number;
  position: number;
}

export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
}

/** News article from RSS feed */
export interface NewsArticle {
  headline: string;
  description: string;
  source: string;
  domain: string;
  pubDate: string;
  url: string;
}

/** Matched news item for a token */
export interface NewsMatch {
  runId: string;
  tsUtc: string;
  symbol: string;
  headline: string;
  description: string;
  source: string;
  domain: string;
  relevance: number;
  url: string;
}

/** Composite signal for a token */
export interface TokenSignal {
  symbol: string;
  tokenId: string;
  tokenName: string;
  chain: Chain;
  lastPrice: number;
  priceChangePercent: number;
  momentumScore: number;
  technicalScore: number;
  newsScore: number;
  compositeScore: number;
  alerts: string[];
  timestamp: string;
}

/** Radar run options */
export interface RadarOptions {
  filter?: string[];
  chain?: Chain;
  sortBy?: SortMode;
  noLog?: boolean;
  quiet?: boolean;
  format?: OutputFormat;
  includeTech?: boolean;
  includeNews?: boolean;
  /** Limit scan to a specific kline interval (e.g. '1h' or '4h') */
  period?: KlineInterval;
}

/** Run metadata for a radar sweep */
export interface RadarRun {
  runId: string;
  tsUtc: string;
  numTokens: number;
  numSignals: number;
  durationMs: number;
}

/** Kline data point */
export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  count: number;
  takerBuyVol: number;
  takerBuyQuoteVol: number;
  ignore: number;
}
