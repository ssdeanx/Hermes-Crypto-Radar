// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — CLI Entry Point (Enterprise)
// ═══════════════════════════════════════════════════════════════════════

import { Command } from 'commander';
import { runRadar, displayRadar } from './radar.js';
import type { Chain, SortMode, OutputFormat, KlineInterval } from './types.js';
import { getTokenList } from './tokens.js';
import type { TokenDef } from './tokens.js';
import { getTopTokensByVolume } from './tokens.js';
import { fetchKlines } from './binance.js';
import { getBinancePair } from './tokens.js';
import { priceSparkline, multiMaSparkline, priceSvgChart, multiPanelSvgChart, candlestickSvgChart } from './io/charts.js';
import { HealthMonitor } from './monitor/health.js';
import { loadConfig, writeDefaultConfig } from './core/config.js';
import { logger } from './core/logger.js';
import { StrategyEngine } from './analysis/engine.js';
import { runDaemon, isDaemonRunning, stopDaemon } from './daemon.js';
import { runBacktest, formatBacktest } from './backtest.js';
import type { BacktestOptions } from './backtest.js';
import { detectRegime, getRegimeWeights, formatRegime } from './analysis/regime.js';
import { computeCorrelationMatrix, findTopCorrelations, formatCorrelationTable } from './analysis/correlation.js';
import { computeADX, computeBB, computeATR, computeVolVsAvg } from './indicators.js';
import { runBenchmark, formatBenchmark } from './core/benchmark.js';
import { exportCsvToSql } from './sqlite-export.js';
import type { ExportResult } from './sqlite-export.js';
import { generateHtmlReport, generateSignalSnapshot } from './pdf-export.js';
import { validateOutput } from './output.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ── Constants ──

/** Default top-N count for auto-dynamic mode (no --filter, no --dynamic) */
const DEFAULT_TOP_N = 30;

/** Count used when --dynamic flag is passed without a value */
const DYNAMIC_FLAG_TOP_N = 50;

// ── Global error handlers ──
process.on('uncaughtException', (err) => {
  console.error(`[FATAL] Unhandled exception: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`[FATAL] Unhandled rejection: ${reason}`);
  process.exit(1);
});

const program = new Command();

program
  .name('crypto-radar')
  .description('🛰️  Hermes Crypto Radar — Enterprise crypto market intelligence')
  .version('1.0.0');

// ── scan command (default) ──
program
  .command('scan')
  .alias('s')
  .description('Run a full radar scan (prices + technicals + news + strategy signals)')
  .option('-f, --filter <symbols...>', 'Filter to specific tokens by symbol')
  .option('--dynamic [count]', 'Explicit control for auto-dynamic top-N (default when no --filter: top 30 by volume; use --dynamic or --dynamic 50 to override count)')
  .option('-c, --chain <chain>', 'Filter to chain (solana, polygon, bnb, xrp, etc.)')
  .option('--sort <mode>', 'Sort: alpha|change|volume|momentum', 'momentum')
  .option('--format <fmt>', 'Output format: table|json|csv|md|xlsx', 'table')
  .option('-q, --quiet', 'Suppress display output (cron-friendly)')
  .option('--no-log', 'Skip data logging to CSV')
  .option('--no-tech', 'Skip technical indicator computation')
  .option('--no-news', 'Skip news fetching')
  .option('--onchain', 'Include DeFiLlama on-chain metrics (TVL, fees)')
  .option('--period <interval>', 'Kline interval: 15m|1h|4h|1d (default: all)')
  .action(async (opts) => {
    try {
      // ── Auto-dynamic mode by default ──
      // When no --filter is provided, scan fetches the top N tokens by 24h
      // Binance volume (default 30). --dynamic [N] overrides the count.
      let filter = opts.filter;
      if (!filter || filter.length === 0) {
        const count = typeof opts.dynamic === 'string'
          ? parseInt(opts.dynamic, 10)
          : opts.dynamic !== undefined
            ? DYNAMIC_FLAG_TOP_N
            : DEFAULT_TOP_N;
        try {
          const dynamicTokens = await getTopTokensByVolume(count);
          filter = dynamicTokens.map(t => t.sym);
          console.error(`[auto-dynamic] Top ${dynamicTokens.length} tokens by volume`);
        } catch {
          console.error('[auto-dynamic] Failed to fetch top tokens, using default list');
        }
      }

      const result = await runRadar({
        filter,
        chain: opts.chain as Chain | undefined,
        sortBy: opts.sort as SortMode,
        format: opts.format as OutputFormat,
        quiet: opts.quiet ?? false,
        noLog: opts.noLog === false ? false : undefined,
        includeTech: opts.tech,
        includeNews: opts.news,
        includeOnchain: opts.onchain ?? false,
        period: opts.period as KlineInterval | undefined,
      });

      const output = await displayRadar(result, {
        format: opts.format as OutputFormat,
        quiet: opts.quiet ?? false,
      });

      if (output) console.log(output);

      console.error(`\n[done] ${result.run.runId} — ${result.run.numTokens} tokens in ${result.run.durationMs}ms`);
      console.error(`       ${result.aggregatedSignals.length} strategy signals`);
      if (!opts.noLog) console.error(`       Logged to data/ directory`);

      // Auto-save all report formats
      const dataDir = loadConfig().dataDir;
      const date = new Date().toISOString().slice(0, 10);
      fs.mkdirSync(dataDir, { recursive: true });

      const formats: OutputFormat[] = ['table', 'json', 'csv', 'md', 'xlsx'];
      for (const fmt of formats) {
        if (fmt === 'table') {
          // Bug 1 fix: always save TABLE format to .txt regardless of --format flag
          const tableContent = await displayRadar(result, { format: 'table' });
          if (tableContent) {
            fs.writeFileSync(path.join(dataDir, `cron-${date}.txt`), tableContent + '\n', 'utf-8');
          }
        } else if (fmt === 'xlsx') {
          // Bug 2 fix: displayRadar('xlsx') side-effects the real .xlsx file and returns
          // a status string; copy the real file from its side-effect location instead
          await displayRadar(result, { format: 'xlsx' });
          const runIdLower = result.run.runId.toLowerCase();
          const xlsxSource = path.join(dataDir, `crypto-radar-${runIdLower}.xlsx`);
          const xlsxDest = path.join(dataDir, `cron-${date}.xlsx`);
          if (fs.existsSync(xlsxSource)) {
            fs.copyFileSync(xlsxSource, xlsxDest);
          }
        } else {
          const content = await displayRadar(result, { format: fmt });
          if (content) {
            fs.writeFileSync(path.join(dataDir, `cron-${date}.${fmt}`), content + '\n', 'utf-8');
          }
        }
      }
    } catch (err) {
      console.error(`[ERROR] Radar scan failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── chart command ──
program
  .command('chart')
  .alias('c')
  .description('Generate price charts for a token')
  .argument('<symbol>', 'Token symbol (e.g. SOL, BTC, ETH)')
  .option('--type <type>', 'Chart type: sparkline|ma|svg|dashboard|candlestick|watermark', 'sparkline')
  .option('--period <p>', 'Kline interval: 15m|1h|4h|1d', '1h')
  .option('--lookback <n>', 'Number of candles', '100')
  .option('--width <px>', 'SVG width (svg/dashboard only)', '600')
  .action(async (symbol, opts) => {
    try {
      const sym = symbol.toUpperCase();
      const tokens = getTokenList();
      const token = tokens.find(t => t.sym === sym);
      if (!token) { console.error(`Unknown token: ${sym}`); process.exit(1); }

      const pair = getBinancePair(token);
      const klines = await fetchKlines(pair, opts.period, parseInt(opts.lookback, 10));
      if (klines.length === 0) { console.error(`No data for ${pair}`); process.exit(1); }

      switch (opts.type) {
        case 'sparkline':
          console.log(`\n${sym} Price (${opts.period}, last ${klines.length} candles):\n`);
          console.log(priceSparkline(klines, { height: 12 }));
          console.log(`\nLatest: $${klines[klines.length - 1]!.close.toFixed(2)}`);
          console.log(`High: $${Math.max(...klines.map(k => k.high)).toFixed(2)}`);
          console.log(`Low: $${Math.min(...klines.map(k => k.low)).toFixed(2)}`);
          break;

        case 'ma':
          console.log(`\n${sym} Price + EMA20/EMA50 (${opts.period}):\n`);
          console.log(multiMaSparkline(klines, { height: 12 }));
          break;

        case 'svg':
          console.log(priceSvgChart(`${sym} Price (${opts.period})`, klines, parseInt(opts.width, 10)));
          break;

        case 'dashboard':
          console.log(multiPanelSvgChart(`${sym} Price + RSI`, klines, klines.map(() => null), parseInt(opts.width, 10), 400));
          break;

        case 'candlestick':
          console.log(candlestickSvgChart(`${sym} Candlestick (${opts.period})`, klines, parseInt(opts.width, 10), Math.round(parseInt(opts.width, 10) * 0.6)));
          break;

        case 'watermark':
          // Watermark is embedded in all SVG charts; render a branded SVG as demo
          console.log(priceSvgChart(`${sym} Watermark Demo (${opts.period})`, klines, parseInt(opts.width, 10)));
          break;
      }
    } catch (err) {
      console.error(`[ERROR] Chart generation failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── strategies command ──
program
  .command('strategies')
  .alias('strat')
  .description('List available signal strategies and their weights')
  .action(() => {
    const engine = new StrategyEngine();
    const strategies = engine.getStrategyInfo();
    console.log('\n📊 Signal Strategies:\n');
    console.table(strategies.strategies.map(s => ({
      Name: s.name,
      Description: s.description,
      Timeframe: s.timeframe,
      Weight: `${(s.weight * 100).toFixed(0)}%`,
    })));
  });

// ── tokens command ──
program
  .command('tokens')
  .description('List all tracked tokens')
  .option('-c, --chain <chain>', 'Filter by chain')
  .action((opts) => {
    const tokens = getTokenList()
      .filter(t => !opts.chain || t.chain === opts.chain || t.chains?.includes(opts.chain));
    console.table(tokens.map(t => ({ Symbol: t.sym, Name: t.name, Chain: t.chain })));
  });

// ── search command ──
program
  .command('search')
  .alias('find')
  .description('Search for tokens by symbol, name, or address (fuzzy matching)')
  .argument('<query>', 'Search query (symbol, name, or partial/fuzzy match)')
  .option('--json', 'Output as JSON with match scores')
  .option('--limit <n>', 'Max results', '20')
  .action((query, opts) => {
    const q = query.toLowerCase();
    const tokens = getTokenList();

    // Score each token by relevance (fuzzy matching)
    interface ScoredHit { token: TokenDef; score: number; matchField: string; }
    const scored: ScoredHit[] = [];

    for (const token of tokens) {
      const sym = token.sym.toLowerCase();
      const name = token.name.toLowerCase();
      const id = token.id.toLowerCase();
      const chain = token.chain.toLowerCase();

      let bestScore = 0;
      let matchField = '';

      // Exact symbol match → highest priority
      if (sym === q) { bestScore = 100; matchField = 'symbol'; }
      else if (name === q) { bestScore = 95; matchField = 'name'; }
      else if (id === q) { bestScore = 90; matchField = 'id'; }
      // Prefix match
      else if (sym.startsWith(q)) { bestScore = 80; matchField = 'symbol'; }
      else if (name.startsWith(q)) { bestScore = 75; matchField = 'name'; }
      // Substring match
      else if (sym.includes(q)) { bestScore = 60; matchField = 'symbol'; }
      else if (name.includes(q)) { bestScore = 55; matchField = 'name'; }
      else if (id.includes(q)) { bestScore = 50; matchField = 'id'; }
      else if (chain.includes(q)) { bestScore = 40; matchField = 'chain'; }
      // Fuzzy: character overlap (for typos)
      else {
        const overlap = countOverlap(sym, q);
        if (overlap >= q.length * 0.6) { bestScore = Math.round(overlap / q.length * 35); matchField = 'symbol'; }
        else {
          const nameOverlap = countOverlap(name, q);
          if (nameOverlap >= q.length * 0.6) { bestScore = Math.round(nameOverlap / q.length * 30); matchField = 'name'; }
        }
      }

      if (bestScore > 0) {
        scored.push({ token, score: bestScore, matchField });
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = parseInt(opts.limit, 10) || 20;
    const limited = scored.slice(0, limit);

    if (opts.json) {
      console.log(JSON.stringify(limited.map(h => ({
        symbol: h.token.sym,
        name: h.token.name,
        chain: h.token.chain,
        id: h.token.id,
        score: h.score,
        matchField: h.matchField,
        coingeckoId: h.token.coingeckoId,
        ...(h.token.chains ? { chains: h.token.chains } : {}),
      })), null, 2));
    } else {
      if (limited.length === 0) {
        console.error(`No tokens matching "${query}"`);
        return;
      }
      console.table(limited.map(h => ({
        Symbol: h.token.sym,
        Name: h.token.name,
        Chain: h.token.chain,
        ID: h.token.id,
        Match: `${h.matchField} (${h.score}%)`,
      })));
      console.error(`\n${limited.length} result(s) for "${query}"`);
    }
  });

function countOverlap(a: string, b: string): number {
  let score = 0;
  for (const ch of b) {
    if (a.includes(ch)) score++;
  }
  return score;
}

// ── signals command ──
program
  .command('signals')
  .description('Generate composite signals from latest data')
  .option('-f, --filter <symbols...>', 'Filter to specific tokens')
  .option('--format <fmt>', 'Output format: table|json|md|xlsx', 'table')
  .action(async (opts) => {
    try {
      const result = await runRadar({
        filter: opts.filter,
        format: opts.format as OutputFormat,
        sortBy: 'signal',
      });
      const output = await displayRadar(result, { format: opts.format as OutputFormat });
      if (output) console.log(output);
    } catch (err) {
      console.error(`[ERROR] Signal generation failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── news command ──
program
  .command('news')
  .description('Fetch and display crypto news matching tracked tokens')
  .option('-f, --filter <symbols...>', 'Filter to specific tokens')
  .option('--format <fmt>', 'Output format: table|json|md|xlsx', 'table')
  .action(async (opts) => {
    try {
      const result = await runRadar({
        filter: opts.filter,
        format: opts.format as OutputFormat,
        includeTech: false,
      });
      const output = await displayRadar(result, { format: opts.format as OutputFormat });
      if (output) console.log(output);
    } catch (err) {
      console.error(`[ERROR] News fetch failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── health command ──
program
  .command('health')
  .description('Run system health checks')
  .action(async () => {
    const monitor = new HealthMonitor();
    const status = await monitor.check();
    console.log(`\n🛰️  Crypto Radar — Health Check\n`);
    console.log(`Status: ${status.status === 'healthy' ? '✅' : status.status === 'degraded' ? '⚠️' : '❌'} ${status.status.toUpperCase()}`);
    console.log(`Uptime: ${Math.floor(status.uptime / 60)}m ${status.uptime % 60}s`);
    console.log('');

    // Primary checks table
    for (const check of status.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
      const name = check.name.padEnd(16);
      console.log(`  ${icon} ${name} (${check.latencyMs}ms)  ${check.message}`);
    }

    // Cache stats summary (from HealthStatus extended fields)
    if (status.cacheStats) {
      const { entries, hitRate, memoryEstimate } = status.cacheStats;
      console.log(`       cache stats: ${entries} entries, ${hitRate}% hit rate, ~${(memoryEstimate / 1024).toFixed(0)}KB est.`);
    }

    // Feed health detail lines
    if (status.feedHealth && status.feedHealth.feeds.length > 0) {
      for (const feed of status.feedHealth.feeds) {
        const icon = feed.status === 'healthy' ? '✅' : feed.status === 'degraded' ? '⚠️' : '❌';
        console.log(`  ${icon} feed: ${feed.name} — ${feed.status} (${feed.consecutiveFailures} failures)`);
      }
    }

    console.log('');
    console.log('Details:', JSON.stringify(status.details, null, 2));
  });

// ── configure command ──
program
  .command('configure')
  .alias('config')
  .description('Show or generate configuration')
  .option('--generate', 'Generate default config file at radar.config.json')
  .option('--show', 'Show current resolved configuration')
  .action((opts) => {
    if (opts.generate) {
      writeDefaultConfig('radar.config.json');
      console.log('Generated radar.config.json with defaults. Edit then restart.');
    }
    if (opts.show) {
      const config = loadConfig();
      console.log(JSON.stringify(config, null, 2));
    }
    if (!opts.generate && !opts.show) {
      console.log('Usage: crypto-radar configure --show | --generate');
    }
  });

// ── export-sqlite command ──
program
  .command('export-sqlite')
  .alias('export-db')
  .description('Export radar CSV logs as SQLite-compatible SQL for long-term aggregation')
  .option('-o, --output <path>', 'Output SQL file path (default: stdout)')
  .option('--stdout', 'Force output to stdout (default when no -o given)')
  .option('--validate-only', 'Only validate CSV data, do not generate SQL')
  .action((opts) => {
    const result = exportCsvToSql({
      outputPath: opts.output,
      toStdout: opts.stdout ?? !opts.output,
      validateOnly: opts.validateOnly ?? false,
    });
    if (!opts.validateOnly) {
      console.error(`[export-sqlite] Exported ${result.tickerRows} ticker rows, ${result.newsRows} news rows`);
      if (result.sqlFile) console.error(`[export-sqlite] Wrote ${result.sqlFile}`);
    } else {
      console.error(`[export-sqlite] Validation: ${result.validationErrors} errors in ${result.validationTotal} rows`);
    }
  });

// ── regime command ──
program
  .command('regime')
  .alias('r')
  .description('Detect current market regime for a token')
  .argument('<symbol>', 'Token symbol (e.g. SOL, BTC, ETH)')
  .option('--period <p>', 'Kline interval: 15m|1h|4h|1d', '1h')
  .option('--lookback <n>', 'Number of candles', '200')
  .option('--weights', 'Show regime-adapted strategy weights', false)
  .action(async (symbol, opts) => {
    try {
      const sym = symbol.toUpperCase();
      const tokens = getTokenList();
      const token = tokens.find(t => t.sym === sym);
      if (!token) { console.error(`Unknown token: ${sym}`); process.exit(1); }

      const pair = getBinancePair(token);
      const period = opts.period as string;
      const lookback = parseInt(opts.lookback, 10) || 200;

      console.error(`Fetching ${lookback} ${period} candles for ${pair}...`);
      const klines = await fetchKlines(pair, period, lookback);
      if (klines.length < 30) { console.error(`Insufficient data for ${pair} (need ≥30 candles, got ${klines.length})`); process.exit(1); }

      const closes = klines.map(k => k.close);
      const highs = klines.map(k => k.high);
      const lows = klines.map(k => k.low);
      const volumes = klines.map(k => k.volume);

      // Compute indicators needed for regime detection
      const adx = computeADX(highs, lows, closes, 14);
      const bb = computeBB(closes, 20);
      const atrPct = computeATR(highs, lows, closes, 14);
      const volVsAvg = computeVolVsAvg(volumes);

      const bbWidth = bb?.width ?? null;

      // Volume ratio (raw: current / avg)
      let volRatio: number | null = null;
      if (volVsAvg != null) {
        volRatio = 1 + volVsAvg; // volVsAvg is (current/avg) - 1
      }

      const result = detectRegime({ adx, bbWidth, atrPct, volRatio });
      console.log(formatRegime(result));

      // Show regime-adapted weights if requested
      if (opts.weights) {
        const weights = getRegimeWeights(result.regime);
        console.log('📊 Regime-Adapted Strategy Weights:');
        console.log(`    Momentum:       ${(weights.momentum * 100).toFixed(0)}%`);
        console.log(`    Mean-Reversion: ${(weights.meanReversion * 100).toFixed(0)}%`);
        console.log(`    Trend-Following: ${(weights.trendFollowing * 100).toFixed(0)}%`);
        console.log(`    Position Size:  ${(weights.positionSize * 100).toFixed(0)}%`);
        console.log('');
      }
    } catch (err) {
      console.error(`[ERROR] Regime detection failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── correlation command ──
program
  .command('correlation')
  .alias('corr')
  .description('Compute cross-token correlation matrix from price movements')
  .option('--symbols <syms...>', 'Specific symbols to correlate (default: top 10 by volume)')
  .option('--count <n>', 'Number of tokens to fetch when auto-detecting', '10')
  .option('--period <p>', 'Kline interval: 15m|1h|4h|1d', '1h')
  .option('--lookback <n>', 'Number of candles', '100')
  .option('--top <n>', 'Show top N correlations for each symbol', '3')
  .option('--json', 'Output as JSON', false)
  .action(async (opts) => {
    try {
      // Resolve symbol list
      let symbols: string[];
      if (opts.symbols && opts.symbols.length > 0) {
        symbols = opts.symbols.map((s: string) => s.toUpperCase());
      } else {
        const count = parseInt(opts.count, 10) || 10;
        const topTokens = await getTopTokensByVolume(Math.min(count, 20));
        symbols = topTokens.map(t => t.sym);
        console.error(`[auto] Top ${symbols.length} tokens by volume selected`);
      }

      // Validate tokens exist
      const tokens = getTokenList();
      const validTokens = tokens.filter(t => symbols.includes(t.sym));
      if (validTokens.length < 2) {
        console.error(`Need at least 2 valid tokens. Found ${validTokens.length}.`);
        process.exit(1);
      }

      const period = opts.period as string;
      const lookback = parseInt(opts.lookback, 10) || 100;

      // Fetch klines for each token in parallel
      console.error(`Fetching ${lookback} ${period} candles for ${validTokens.length} tokens...`);
      const priceMap = new Map<string, number[]>();

      const fetchResults = await Promise.allSettled(
        validTokens.map(async (token) => {
          const pair = getBinancePair(token);
          const klines = await fetchKlines(pair, period, lookback);
          if (klines.length >= 20) {
            priceMap.set(token.sym, klines.map(k => k.close));
          }
        }),
      );

      const failed = fetchResults.filter(r => r.status === 'rejected').length;
      if (failed > 0) console.error(`[warn] ${failed} token(s) failed to fetch`);

      if (priceMap.size < 2) {
        console.error('Insufficient data: need at least 2 tokens with valid klines.');
        process.exit(1);
      }

      console.error(`Computing correlation matrix for ${priceMap.size} tokens...`);

      const matrix = computeCorrelationMatrix(priceMap);

      if (opts.json) {
        console.log(JSON.stringify(matrix, null, 2));
      } else {
        console.log(formatCorrelationTable(matrix));

        // Show top correlations per symbol
        const topN = parseInt(opts.top, 10) || 3;
        console.log(`\n📈 Top ${topN} Correlations per Token:\n`);

        for (const sym of matrix.symbols) {
          const top = findTopCorrelations(sym, matrix, topN);
          const pairs = top.map(p =>
            `${p.symbolB}: ${p.correlation > 0 ? '+' : ''}${p.correlation.toFixed(3)}`
          ).join(', ');
          console.log(`  ${sym.padEnd(6)} → ${pairs}`);
        }
        console.log('');
      }
    } catch (err) {
      console.error(`[ERROR] Correlation analysis failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── report command ──
program
  .command('report')
  .description('Generate HTML report and save to file (open in browser → Print → PDF)')
  .option('-o, --output <path>', 'Output HTML file path', 'crypto-radar-report.html')
  .option('-s, --snapshot', 'Generate compact signal snapshot instead of full report')
  .action(async (opts) => {
    try {
      console.error('Running radar scan for report...');
      const result = await runRadar({
        includeTech: true,
        includeNews: true,
        includeOnchain: true,
        noLog: true,
      });

      const tickers = result.tickers;
      const signals = result.aggregatedSignals;
      const onchain = (result as Record<string, unknown>).onchainMetrics as import('./onchain.js').OnChainMetrics | null ?? null;

      let html: string;
      if (opts.snapshot) {
        html = generateSignalSnapshot(signals);
        console.error(`Generating signal snapshot (${signals.length} signals)...`);
      } else {
        html = generateHtmlReport({
          title: 'Crypto Radar Report',
          date: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
          tickers,
          aggregatedSignals: signals,
          onchain,
          includeCharts: true,
        });
        console.error(`Generating full report (${tickers.length} tokens, ${signals.length} signals)...`);
      }

      const outputPath = opts.output;
      await import('fs').then(fs => fs.promises.writeFile(outputPath, html, 'utf-8'));
      console.error(`✅ Report written to ${outputPath}`);
      console.error(`   Open in browser → File → Print → Save as PDF (enable background graphics)`);
    } catch (err) {
      console.error(`[ERROR] Report generation failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── validate command ──
program
  .command('validate')
  .description('Validate existing radar CSV data against expected schema')
  .option('-f, --file <path>', 'Path to CSV data file', 'data/radar-output.csv')
  .option('--json', 'Output errors as JSON')
  .action(async (opts) => {
    try {
      const fs = await import('fs');
      const pathMod = await import('path');
      const csvPath = pathMod.resolve(opts.file);

      // Security: prevent path traversal — restrict to project directories
      const projectRoot = pathMod.resolve('.');
      const allowedPrefixes = [
        projectRoot,
        pathMod.resolve('data'),
        pathMod.resolve('dist'),
      ];
      const isAllowed = allowedPrefixes.some(prefix =>
        csvPath.startsWith(prefix + pathMod.sep) || csvPath === prefix,
      );
      if (!isAllowed) {
        console.error(`❌ Security: file path is not in allowed directories`);
        process.exit(1);
      }

      if (!fs.existsSync(csvPath)) {
        console.error(`❌ File not found: ${csvPath}`);
        process.exit(1);
      }
      console.error(`Validating ${csvPath}...`);

      const csvContent = fs.readFileSync(csvPath, 'utf-8');
      const lines = csvContent.trim().split('\n');
      if (lines.length < 2) {
        console.error('❌ CSV file has no data rows');
        process.exit(1);
      }

      const header = lines[0]!;
      // Parse CSV into partial EnrichedTicker objects
      const headers = header.split(',');
      const tickers: import('./types.js').EnrichedTicker[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i]!.split(',');
        const row: Record<string, unknown> = {};
        for (let j = 0; j < headers.length; j++) {
          row[headers[j]!] = values[j];
        }
        // Parse numeric fields
        const t: Partial<import('./types.js').EnrichedTicker> = {
          runId: String(row.run_id ?? ''),
          tsUtc: String(row.ts_utc ?? ''),
          dateEt: String(row.date_et ?? ''),
          symbol: String(row.symbol ?? ''),
          chain: String(row.chain ?? '') as import('./types.js').Chain,
          tokenId: String(row.tokenId ?? ''),
          tokenName: String(row.tokenName ?? ''),
          lastPrice: parseFloat(String(row.lastPrice ?? '')),
          priceChangePercent: parseFloat(String(row.priceChangePercent ?? '')),
          volume: parseFloat(String(row.volume ?? '')),
          quoteVolume: parseFloat(String(row.quoteVolume ?? '')),
          spreadPct: parseFloat(String(row.spreadPct ?? '')),
          momentum: parseFloat(String(row.momentum ?? '')),
        };
        tickers.push(t as import('./types.js').EnrichedTicker);
      }

      const errors = validateOutput(tickers);

      if (errors.length === 0) {
        console.log(`✅ Validation passed — ${tickers.length} rows checked, 0 errors`);
      } else {
        if (opts.json) {
          console.log(JSON.stringify(errors, null, 2));
        } else {
          console.log(`❌ Validation found ${errors.length} error(s):\n`);
          for (const err of errors) {
            console.log(`  ${err.field}: ${err.message} (got: ${JSON.stringify(err.value)})`);
          }
        }
        process.exit(1);
      }
    } catch (err) {
      console.error(`[ERROR] Validation failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── daemon command ──
program
  .command('daemon')
  .description('Start/stop/status warm daemon for sub-50ms tool calls')
  .option('--port <port>', 'HTTP port for health endpoint', String(9877))
  .option('--refresh <sec>', 'Cache refresh interval in seconds', String(300))
  .option('--status', 'Check if daemon is running')
  .option('--stop', 'Stop running daemon')
  .action(async (opts) => {
    if (opts.status) {
      const running = isDaemonRunning();
      console.log(`Daemon: ${running ? '✅ RUNNING' : '⏹️  STOPPED'}`);
      process.exit(running ? 0 : 1);
    }
    if (opts.stop) {
      const stopped = stopDaemon();
      console.log(stopped ? '⏹️  Daemon stopped' : '❌ No running daemon found');
      process.exit(stopped ? 0 : 1);
    }
    // Start foreground
    if (opts.port) process.env.RADAR__DAEMON_PORT = opts.port;
    if (opts.refresh) process.env.RADAR__REFRESH_SEC = opts.refresh;
    await runDaemon();
  });

// ── backtest command ──
program
  .command('backtest')
  .description('Run signal backtest against historical kline data')
  .option('-s, --symbol <symbol>', 'Filter to specific token')
  .option('--horizon <n>', 'Candles ahead to check', '1')
  .option('--confidence <n>', 'Minimum confidence threshold (0-1)', '0')
  .action(async (opts) => {
    try {
      console.error('Running radar scan for backtest data...');
      const result = await runRadar({ includeTech: true, includeNews: false, noLog: true });

      const filterSymbol = opts.symbol ? opts.symbol.toUpperCase() : null;
      const signals = filterSymbol
        ? result.aggregatedSignals.filter(s => s.symbol === filterSymbol)
        : result.aggregatedSignals;

      if (signals.length === 0) {
        console.error('No signals to backtest. Try running without --symbol filter.');
        process.exit(1);
      }

      // Build klines map: fetch extended klines for each symbol with a signal
      const klinesBySymbol = new Map<string, import('./types.js').Kline[]>();
      const symbols = [...new Set(signals.map(s => s.symbol))];
      const tokens = getTokenList();

      console.error(`Building kline maps for ${symbols.length} symbols...`);

      for (const sym of symbols) {
        const token = tokens.find(t => t.sym === sym);
        if (!token) continue;
        try {
          const pair = getBinancePair(token);
          // Fetch extra klines so we can look ahead from the signal position
          // Signal uses last 200 candles; fetch 400 to have room
          const klines = await fetchKlines(pair, '1h', 400);
          if (klines.length > 10) {
            klinesBySymbol.set(sym, klines);
          }
        } catch {
          // skip symbol if klines fail
        }
      }

      const backtestOptions: BacktestOptions = {
        horizon: parseInt(opts.horizon, 10) || 1,
        minConfidence: parseFloat(opts.confidence) || 0,
      };

      const btResult = runBacktest(signals, klinesBySymbol, backtestOptions);
      console.log(formatBacktest(btResult));

      // Store for programmatic use
      (globalThis as Record<string, unknown>).__lastBacktestResult = btResult;
    } catch (err) {
      console.error(`[ERROR] Backtest failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ── benchmark command ──
program
  .command('benchmark')
  .description('Run performance benchmark')
  .option('--iterations <n>', 'Number of runs for median timing', '3')
  .action(async (opts) => {
    try {
      console.error('Running performance benchmark...');
      const iterations = Math.max(1, parseInt(opts.iterations, 10) || 3);
      const result = iterations > 1
        ? await (await import('./core/benchmark.js')).runBenchmarkMedian(iterations)
        : await runBenchmark();
      console.log(formatBenchmark(result));
    } catch (err) {
      console.error(`[ERROR] Benchmark failed:`, err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// Default to scan if no command given
if (process.argv.length <= 2) {
  process.argv.push('scan');
}

program.parse(process.argv);
