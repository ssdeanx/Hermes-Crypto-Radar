// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Binance API Client
// ═══════════════════════════════════════════════════════════════════════

import type { BinanceTicker, Kline, Chain } from './types.js';
import { getTokenList, getBinancePair } from './tokens.js';
import type { TokenDef } from './tokens.js';
import { CircuitBreaker } from './core/circuit-breaker.js';
import { logger } from './core/logger.js';

const BASE_URL = 'https://data-api.binance.vision';

/** Global circuit breaker for Binance API calls — 3 failures → 60s cool-down */
const binanceBreaker = new CircuitBreaker({ name: 'binance', failureThreshold: 3, cooldownMs: 60_000 });
const FETCH_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;

/** Create a timeout signal that aborts after `ms` */
function timeoutSignal(ms: number): AbortController {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl;
}

/** Fetch with retries and 429 backoff */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const ctrl = timeoutSignal(FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });

      // 429 rate limit — backoff
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '2', 10);
        await sleep(Math.min(retryAfter * 1000, 10_000));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText} — ${url}`);
      }

      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      await sleep(1_000 * attempt);
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => {
    const t = setTimeout(r, ms);
    t.unref();
  });
}

/** Get unique USDT pairs for all tracked tokens */
function getPairs(): string[] {
  const seen = new Set<string>();
  const pairs: string[] = [];
  for (const token of getTokenList()) {
    const pair = getBinancePair(token);
    if (!seen.has(pair)) {
      seen.add(pair);
      pairs.push(pair);
    }
  }
  return pairs;
}

/**
 * Fetch 24hr ticker for ALL USDT pairs from Binance.
 * This is used by the dynamic top-N volume detection to discover which pairs
 * are most active, regardless of the hardcoded token registry.
 * @returns A map of symbol -> ticker for all USDT pairs
 */
export async function fetchAllUsdtTickers(): Promise<Map<string, BinanceTicker>> {
  return binanceBreaker.call(async () => {
    const url = `${BASE_URL}/api/v3/ticker/24hr`;
    const res = await fetchWithRetry(url);
    const data = (await res.json()) as BinanceTicker[];
    const map = new Map<string, BinanceTicker>();
    for (const ticker of data) {
      if (ticker.symbol.endsWith('USDT')) {
        map.set(ticker.symbol, ticker);
      }
    }
    return map;
  }, async () => new Map());
}

/**
 * Fetch 24hr ticker for all tracked tokens from Binance.
 * @returns A map of symbol -> ticker
 */
export async function fetchAllTickers(): Promise<Map<string, BinanceTicker>> {
  return binanceBreaker.call(async () => {
    const pairs = getPairs();
    const symbols = pairs.map(s => `"${s}"`).join(',');
    const url = `${BASE_URL}/api/v3/ticker/24hr?symbols=[${symbols}]`;

    const res = await fetchWithRetry(url);
    const data = (await res.json()) as BinanceTicker[];
    const map = new Map<string, BinanceTicker>();
    for (const ticker of data) {
      map.set(ticker.symbol, ticker);
    }
    return map;
  }, async () => new Map());
}

/**
 * Fetch single ticker by pair.
 * @param pair Trading pair e.g. 'SOLUSDT'
 * @returns The Binance ticker data
 */
export async function fetchTicker(pair: string): Promise<BinanceTicker> {
  const url = `${BASE_URL}/api/v3/ticker/24hr?symbol=${pair}`;
  const res = await fetchWithRetry(url);
  return (await res.json()) as BinanceTicker;
}

/**
 * Fetch klines/candles for a pair.
 * @param pair Trading pair e.g. 'SOLUSDT'
 * @param interval Kline interval (default: '1h')
 * @param limit Number of candles (default: 100)
 * @returns Array of parsed Kline objects
 */
export async function fetchKlines(
  pair: string,
  interval = '1h',
  limit = 100,
): Promise<Kline[]> {
  return binanceBreaker.call(async () => {
    const url = `${BASE_URL}/api/v3/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
    const res = await fetchWithRetry(url);
    const data = (await res.json()) as unknown[][];
    return data.map(k => ({
      openTime:     Number(k[0]),
      open:         Number(k[1]),
      high:         Number(k[2]),
      low:          Number(k[3]),
      close:        Number(k[4]),
      volume:       Number(k[5]),
      closeTime:    Number(k[6]),
      quoteVolume:  Number(k[7]),
      count:        Number(k[8]),
      takerBuyVol:  Number(k[9]),
      takerBuyQuoteVol: Number(k[10]),
      ignore:       Number(k[11]),
    }));
  }, async () => []);
}

/**
 * Fetch exchange info to get trading pairs and precision.
 * @returns Exchange info with symbol details
 */
export async function fetchExchangeInfo(): Promise<{
  symbols: Array<{ symbol: string; status: string; baseAsset: string; quoteAsset: string }>;
}> {
  const url = `${BASE_URL}/api/v3/exchangeInfo`;
  const res = await fetchWithRetry(url);
  return (await res.json()) as any;
}

/**
 * Fetch depth / order book for a pair.
 * @param pair Trading pair e.g. 'SOLUSDT'
 * @param limit Depth level (default: 20)
 * @returns Order book bids and asks
 */
export async function fetchDepth(pair: string, limit = 20): Promise<{
  bids: [string, string][];
  asks: [string, string][];
}> {
  const url = `${BASE_URL}/api/v3/depth?symbol=${pair}&limit=${limit}`;
  const res = await fetchWithRetry(url);
  return (await res.json()) as any;
}

export type { BinanceTicker } from './types.js';
