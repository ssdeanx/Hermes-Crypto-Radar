// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Radar Engine
// ═══════════════════════════════════════════════════════════════════════

import type {
  BinanceTicker, EnrichedTicker, TechnicalIndicators,
  NewsMatch, TokenSignal, RadarOptions, RadarRun, KlineInterval,
} from './types.js';
import { getTokensByChain, getBinancePair } from './tokens.js';
import type { TokenDef } from './tokens.js';
import { fetchAllTickers, fetchKlines } from './binance.js';
import { fetchSimplePrices } from './coingecko.js';
import type { CoinGeckoPrice } from './coingecko.js';
import { computeAllIndicators } from './indicators.js';
import { fetchAndMatchNews } from './news.js';
import { computeSignals } from './signals.js';
import { logger } from './core/logger.js';
import { Cache } from './core/cache.js';
import { loadConfig } from './core/config.js';
import type { RadarConfig } from './core/config.js';
import { StrategyEngine } from './analysis/engine.js';
import type { AggregatedSignal } from './analysis/strategies.js';
import { toTable, toMarkdownReport, toSignalReport, toCSV, csvHeader, NEWS_CSV_HEADER } from './output.js';
import { exportToXlsx } from './xlsx-export.js';
import { checkLogRotation } from './core/log-rotation.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

const LOCK_FILE = path.resolve('radar.lock');
const STATE_FILE = path.resolve('crypto-radar-state.json');
const DEFAULT_INTERVALS: KlineInterval[] = ['15m', '1h', '4h', '1d'];

let _runCounter = 0;
const _cache = new Cache(300_000);

function getRunId(): string {
  _runCounter++;
  const ts = Date.now().toString(36).toUpperCase();
  return `RADAR-${ts}-${_runCounter}`;
}

function toISOUTC(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function toET(d: Date): string {
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).replace(',', '');
}

function enrichTicker(
  raw: BinanceTicker,
  token: TokenDef,
  runId: string,
  tsUtc: string,
): EnrichedTicker {
  const lastPrice = parseFloat(raw.lastPrice);
  const bidPrice = parseFloat(raw.bidPrice);
  const askPrice = parseFloat(raw.askPrice);
  const highPrice = parseFloat(raw.highPrice);
  const lowPrice = parseFloat(raw.lowPrice);
  const openPrice = parseFloat(raw.openPrice);
  const prevClosePrice = parseFloat(raw.prevClosePrice);
  const weightedAvgPrice = parseFloat(raw.weightedAvgPrice);
  const quoteVolume = parseFloat(raw.quoteVolume);
  const volume = parseFloat(raw.volume);
  const bidQty = parseFloat(raw.bidQty);
  const askQty = parseFloat(raw.askQty);
  const spreadPct = bidPrice > 0 ? ((askPrice - bidPrice) / bidPrice) * 100 : 0;
  const vwapDistPct = weightedAvgPrice > 0
    ? ((lastPrice - weightedAvgPrice) / weightedAvgPrice) * 100 : 0;
  const range = highPrice - lowPrice;
  const rangePosPct = range > 0 ? (lastPrice - lowPrice) / range : 0.5;
  const bookImbalance = (bidQty + askQty) > 0
    ? (bidQty - askQty) / (bidQty + askQty) : 0;
  const priceChangePercent = parseFloat(raw.priceChangePercent);
  const momentum = priceChangePercent * (quoteVolume > 10e6 ? 1.2 : 1.0);
  const alerts: string[] = [];
  if (priceChangePercent <= -5) alerts.push('DIP');
  if (priceChangePercent >= 5) alerts.push('PUMP');
  if (quoteVolume >= 10e6) alerts.push('HI-VOL');
  if (spreadPct >= 1) alerts.push('WIDE');
  return {
    runId, tsUtc, dateEt: toET(new Date()),
    symbol: token.sym, chain: token.chain, tokenId: token.id, tokenName: token.name,
    lastPrice, bidPrice, bidQty, askPrice, askQty, spreadPct,
    openPrice, highPrice, lowPrice, prevClosePrice,
    priceChange: parseFloat(raw.priceChange), priceChangePercent, weightedAvgPrice,
    volume, quoteVolume, count: raw.count, lastQty: parseFloat(raw.lastQty),
    vwapDistPct, rangePosPct, bookImbalance,
    volVsAvg: 0, obv: 0, momentum,
    alerts: alerts.join('|'), source: 'binance',
  };
}

export async function runRadar(options: RadarOptions = {}): Promise<{
  tickers: EnrichedTicker[];
  technicals: Map<string, Map<string, TechnicalIndicators>>;
  newsMatches: NewsMatch[];
  signals: TokenSignal[];
  aggregatedSignals: AggregatedSignal[];
  run: RadarRun;
}> {
  const startTime = Date.now();
  const runId = getRunId();
  const tsUtc = toISOUTC(new Date());
  const config: RadarConfig = loadConfig();
  const log = logger.child({ runId });
  const intervals: KlineInterval[] = options.period ? [options.period] : DEFAULT_INTERVALS;

  log.info('Starting radar scan', { filter: options.filter, chain: options.chain, intervals });

  const cacheKey = `tickers:${options.chain ?? 'all'}:${options.filter?.join(',') ?? ''}`;
  let rawTickers = _cache.get<Map<string, BinanceTicker>>(cacheKey);
  if (!rawTickers) {
    rawTickers = await fetchAllTickers();
    _cache.set(cacheKey, rawTickers, 300_000);
  }

  const tokens = options.chain ? getTokensByChain(options.chain) : getTokensByChain(undefined);
  const filteredTokens = options.filter && options.filter.length > 0
    ? tokens.filter(t => options.filter!.includes(t.sym)) : tokens;

  const tickers: EnrichedTicker[] = [];
  for (const token of filteredTokens) {
    const pair = getBinancePair(token);
    const raw = rawTickers.get(pair);
    if (raw) tickers.push(enrichTicker(raw, token, runId, tsUtc));
  }

  if (options.sortBy) {
    const sortKey = options.sortBy === 'change' ? 'priceChangePercent' as const
      : options.sortBy === 'volume' ? 'quoteVolume' as const
      : options.sortBy === 'momentum' || options.sortBy === 'signal' ? 'momentum' as const
      : 'symbol' as const;
    if (sortKey === 'symbol') tickers.sort((a, b) => a.symbol.localeCompare(b.symbol));
    else tickers.sort((a, b) => b[sortKey] - a[sortKey]);
  }

  const technicals = new Map<string, Map<string, TechnicalIndicators>>();
  const klineCache = new Map<string, Awaited<ReturnType<typeof fetchKlines>>>();
  const KLINE_LIMIT = 200;

  if (options.includeTech !== false) {
    log.info(`Computing technical indicators for ${tickers.length} tokens across ${intervals.length} intervals...`);
    const BATCH_SIZE = 5;
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (t) => {
        try {
          const pair = getBinancePair(
            getTokensByChain(t.chain).find(tk => tk.sym === t.symbol) ?? {
              id: t.tokenId, sym: t.symbol, name: t.tokenName, chain: t.chain,
            } as TokenDef,
          );
          const perTokenTechs = new Map<string, TechnicalIndicators>();
          await Promise.all(intervals.map(async (interval) => {
            const ck = `${pair}:${interval}`;
            if (!klineCache.has(ck)) {
              klineCache.set(ck, await fetchKlines(pair, interval, KLINE_LIMIT));
            }
            const klines = klineCache.get(ck)!;
            const tech = computeAllIndicators(klines);
            perTokenTechs.set(interval, tech);
            if (interval === '1h') {
              if (tech.obv != null) t.obv = tech.obv;
              if (tech.volVsAvg != null) t.volVsAvg = tech.volVsAvg;
            }
          }));
          technicals.set(t.symbol, perTokenTechs);
        } catch (err) {
          log.warn(`Failed to compute indicators for ${t.symbol}`, { error: err instanceof Error ? err.message : String(err) });
        }
      }));
    }
  }

  let newsMatches: NewsMatch[] = [];
  if (options.includeNews !== false) {
    const newsCacheKey = `news:${runId}`;
    let cached = _cache.get<NewsMatch[]>(newsCacheKey);
    if (!cached) {
      log.info('Fetching news feeds...');
      try {
        newsMatches = await fetchAndMatchNews(runId, tsUtc);
        _cache.set(newsCacheKey, newsMatches, 300_000);
      } catch (err) {
        log.warn('News fetch failed, continuing without news', { error: err instanceof Error ? err.message : String(err) });
      }
    } else {
      newsMatches = cached;
    }
  }

  const singleTechs = new Map<string, TechnicalIndicators>();
  for (const [sym, perInterval] of technicals) {
    const oneHr = perInterval.get('1h') ?? perInterval.values().next().value ?? null;
    if (oneHr) singleTechs.set(sym, oneHr);
  }
  const signals = computeSignals(tickers, singleTechs, newsMatches);

  const engine = new StrategyEngine();
  const aggregatedSignals: AggregatedSignal[] = [];

  for (const t of tickers) {
    const tokenNews = newsMatches.filter(n => n.symbol === t.symbol);
    const pair = getBinancePair(
      getTokensByChain(t.chain).find(tk => tk.sym === t.symbol) ?? {
        id: t.tokenId, sym: t.symbol, name: t.tokenName, chain: t.chain,
      } as TokenDef,
    );
    let closes: number[] = [];
    let highs: number[] = [];
    let lows: number[] = [];
    let volumes: number[] = [];
    const defaultInterval = intervals[0] ?? '1h';
    const ck = `${pair}:${defaultInterval}`;
    const cachedKlines = klineCache.get(ck);
    if (cachedKlines) {
      closes = cachedKlines.map(k => k.close);
      highs = cachedKlines.map(k => k.high);
      lows = cachedKlines.map(k => k.low);
      volumes = cachedKlines.map(k => k.volume);
    } else {
      try {
        const klines = await fetchKlines(pair, defaultInterval, KLINE_LIMIT);
        klineCache.set(ck, klines);
        closes = klines.map(k => k.close);
        highs = klines.map(k => k.high);
        lows = klines.map(k => k.low);
        volumes = klines.map(k => k.volume);
      } catch { /* proceed without */ }
    }

    const agg = engine.evaluate({
      ticker: t,
      technical: singleTechs.get(t.symbol) ?? null,
      technicalsByInterval: technicals.get(t.symbol) ?? new Map(),
      news: tokenNews,
      klineCloses: closes,
      klineHighs: highs,
      klineLows: lows,
      klineVolumes: volumes,
    });
    aggregatedSignals.push(agg);
  }

  if (!options.noLog) {
    await appendToLog(tickers, config.dataDir, 'crypto-radar-log.csv', csvHeader(), toCSV);
    await appendToLog(newsMatches, config.dataDir, 'crypto-radar-news.csv',
      NEWS_CSV_HEADER, toNewsCSV);
  }

  const durationMs = Date.now() - startTime;
  const run: RadarRun = { runId, tsUtc, numTokens: tickers.length, numSignals: signals.length, durationMs };
  log.info(`Scan complete: ${tickers.length} tokens, ${durationMs}ms`);
  return { tickers, technicals, newsMatches, signals, aggregatedSignals, run };
}

async function appendToLog<T>(
  items: T[],
  dataDir: string,
  fileName: string,
  header: string,
  formatter: (item: T) => string,
): Promise<void> {
  try {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const filePath = path.join(dataDir, fileName);
    checkLogRotation(filePath);
    const tmpPath = filePath + '.tmp';
    const exists = fs.existsSync(filePath);
    const content = (exists ? '' : header + '\n') + items.map(item => formatter(item)).join('\n') + '\n';
    await fs.promises.writeFile(tmpPath, content);
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    logger.error('Failed to write log', { file: fileName, error: String(err) });
  }
}

function toNewsCSV(match: NewsMatch): string {
  const cleanHeadline = match.headline.replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
  const cleanDescription = match.description.replace(/\r?\n|\r/g, ' ').replace(/"/g, '""');
  return [
    match.runId, match.tsUtc, match.symbol,
    `"${cleanHeadline}"`, `"${cleanDescription}"`,
    match.source, match.domain, match.relevance,
  ].join(',');
}

export async function displayRadar(
  result: Awaited<ReturnType<typeof runRadar>>,
  options: RadarOptions,
): Promise<string> {
  const format = options.format ?? 'table';
  if (format === 'json') {
    return JSON.stringify({
      tickers: result.tickers, signals: result.signals,
      aggregatedSignals: result.aggregatedSignals, run: result.run,
    }, null, 2);
  }
  if (format === 'csv') {
    const lines = [csvHeader()];
    for (const t of result.tickers) lines.push(toCSV(t));
    return lines.join('\n');
  }
  if (format === 'md') {
    const singleTechs = new Map<string, TechnicalIndicators>();
    for (const [sym, perInterval] of result.technicals) {
      const oneHr = perInterval.get('1h') ?? perInterval.values().next().value ?? null;
      if (oneHr) singleTechs.set(sym, oneHr);
    }
    return toMarkdownReport(result.tickers, singleTechs, result.newsMatches);
  }
  if (format === 'xlsx') {
    try {
      const config = loadConfig();
      const fn = `crypto-radar-${result.run.runId.toLowerCase()}.xlsx`;
      const fp = path.resolve(config.dataDir, fn);
      if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir, { recursive: true });
      await exportToXlsx(result.tickers, fp);
      return `[XLSX export: ${fp} — ${result.tickers.length} tokens]`;
    } catch (err) {
      logger.error('XLSX export failed', { error: err instanceof Error ? err.message : String(err) });
      return `[XLSX export failed: ${err instanceof Error ? err.message : 'unknown error'}]`;
    }
  }
  if (options.quiet) return '';
  let output = toTable(result.tickers, result.aggregatedSignals);
  if (result.signals.length > 0) {
    output += '\n\n═══ Top Signals ═══\n';
    const topSignals = [...result.signals].sort((a, b) => b.compositeScore - a.compositeScore).slice(0, 5);
    for (const s of topSignals) {
      output += `\n${s.symbol} (${s.chain}) ${s.compositeScore}/100  [M:${s.momentumScore} T:${s.technicalScore} N:${s.newsScore}]`;
      if (s.alerts.length > 0) output += `  ${s.alerts.slice(0, 3).join(', ')}`;
    }
  }
  return output;
}
