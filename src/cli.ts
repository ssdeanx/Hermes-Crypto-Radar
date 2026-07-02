// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — CLI Entry Point (Enterprise)
// ═══════════════════════════════════════════════════════════════════════

import { Command } from 'commander';
import { runRadar, displayRadar } from './radar.js';
import type { Chain, SortMode, OutputFormat, KlineInterval } from './types.js';
import { getTokenList } from './tokens.js';
import { fetchKlines } from './binance.js';
import { getBinancePair } from './tokens.js';
import { priceSparkline, multiMaSparkline, priceSvgChart, multiPanelSvgChart } from './io/charts.js';
import { HealthMonitor } from './monitor/health.js';
import { loadConfig, writeDefaultConfig } from './core/config.js';
import { logger } from './core/logger.js';
import { StrategyEngine } from './analysis/engine.js';
import { runDaemon, isDaemonRunning, stopDaemon } from './daemon.js';

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
  .option('-c, --chain <chain>', 'Filter to chain (solana, polygon, bnb, xrp, etc.)')
  .option('--sort <mode>', 'Sort: alpha|change|volume|momentum', 'momentum')
  .option('--format <fmt>', 'Output format: table|json|csv|md|xlsx', 'table')
  .option('-q, --quiet', 'Suppress display output (cron-friendly)')
  .option('--no-log', 'Skip data logging to CSV')
  .option('--no-tech', 'Skip technical indicator computation')
  .option('--no-news', 'Skip news fetching')
  .option('--period <interval>', 'Kline interval: 15m|1h|4h|1d (default: all)')
  .action(async (opts) => {
    try {
      const result = await runRadar({
        filter: opts.filter,
        chain: opts.chain as Chain | undefined,
        sortBy: opts.sort as SortMode,
        format: opts.format as OutputFormat,
        quiet: opts.quiet ?? false,
        noLog: opts.noLog === false ? false : undefined,
        includeTech: opts.tech,
        includeNews: opts.news,
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
  .option('--type <type>', 'Chart type: sparkline|ma|svg|dashboard', 'sparkline')
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
    console.table(strategies.map(s => ({
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
    for (const check of status.checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️' : '❌';
      console.log(`  ${icon} ${check.name} (${check.latencyMs}ms)`);
      console.log(`     ${check.message}`);
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

// ── strategies command weights update ──
// Note: getStrategyInfo() is patched onto engine for CLI info
// We need a way to expose weights — extend StrategyEngine

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

// Default to scan if no command given
if (process.argv.length <= 2) {
  process.argv.push('scan');
}

program.parse(process.argv);
