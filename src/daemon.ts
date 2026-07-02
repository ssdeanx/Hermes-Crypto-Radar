// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Warm Daemon
// ═══════════════════════════════════════════════════════════════════════
//
// Keeps a warm Node.js process running to serve sub-50ms tool calls.
// Pre-fetches and caches ticker data, klines, and exchange info on a
// configurable refresh cycle. Exposes a lightweight HTTP health/status
// endpoint so the Hermes agent can check liveness.
//
// Usage:
//   crypto-radar daemon          # start foreground (default)
//   crypto-radar daemon --port 9876
//   crypto-radar daemon --status  # check if running
//   crypto-radar daemon --stop   # stop running daemon
//
// Environment:
//   RADAR__DAEMON_PORT    — HTTP server port (default: 9877)
//   RADAR__REFRESH_SEC    — cache refresh interval (default: 300 = 5 min)

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { loadConfig } from './core/config.js';
import { logger } from './core/logger.js';
import { fetchAllTickers, fetchKlines } from './binance.js';
import { getTokenList, getBinancePair, getActiveTokenCount, reloadTokenConfig } from './tokens.js';
import { Cache } from './core/cache.js';

// ── Config ──

const PID_FILE = path.resolve('data/daemon.pid');
const DEFAULT_PORT = 9877;
const DEFAULT_REFRESH_SEC = 300; // 5 min

const port = parseInt(process.env.RADAR__DAEMON_PORT ?? String(DEFAULT_PORT), 10);
const refreshMs = parseInt(process.env.RADAR__REFRESH_SEC ?? String(DEFAULT_REFRESH_SEC), 10) * 1000;

const log = logger.child({ module: 'daemon' });

// ── State ──

let _ready = false;
let _startTime = 0;
let _lastRefresh = 0;
let _refreshCount = 0;
let _scanCount = 0;
let _errorCount = 0;

const _cache = new Cache(600_000); // 10 min, longer ttl for daemon

// ── Warm-up functions ──

async function prewarmTickers(): Promise<void> {
  const start = Date.now();
  try {
    const tickers = await fetchAllTickers();
    _cache.set('tickers:all', tickers, 600_000);
    log.info(`Ticker cache warmed: ${tickers.size} pairs in ${Date.now() - start}ms`);
  } catch (err) {
    _errorCount++;
    log.warn(`Ticker prewarm failed`, { error: err instanceof Error ? err.message : String(err) });
  }
}

async function prewarmKlines(): Promise<void> {
  const tokens = getTokenList();
  const tokenCount = tokens.length;
  let okCount = 0;
  const start = Date.now();

  // Pre-warm 1h klines for each token (the most commonly requested interval)
  for (const token of tokens) {
    const pair = getBinancePair(token);
    const cacheKey = `${pair}:1h`;
    if (!_cache.has(cacheKey)) {
      try {
        const klines = await fetchKlines(pair, '1h', 200);
        _cache.set(cacheKey, klines, 600_000);
        okCount++;
      } catch {
        // non-fatal per token
      }
    }
  }

  log.info(`Kline cache warmed: ${okCount}/${tokenCount} tokens in ${Date.now() - start}ms`);
}

async function refreshAll(): Promise<void> {
  log.info('Cache refresh cycle starting...');
  await prewarmTickers();
  await prewarmKlines();
  _lastRefresh = Date.now();
  _refreshCount++;
  _ready = true;
  log.info(`Cache refresh complete (#${_refreshCount})`);
}

// ── HTTP server ──

function startHttp(): http.Server {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    const pathname = url.pathname;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── Health check ──
    if (pathname === '/' || pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: _ready ? 'ready' : 'warming',
        uptime: _startTime > 0 ? Math.floor((Date.now() - _startTime) / 1000) : 0,
        ready: _ready,
        lastRefresh: _lastRefresh,
        refreshCount: _refreshCount,
        scanCount: _scanCount,
        errorCount: _errorCount,
        activeTokens: getActiveTokenCount(),
        cacheEntries: _cache.stats().size,
        refreshIntervalMs: refreshMs,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      }));
      return;
    }

    // ── Force refresh ──
    if (pathname === '/refresh') {
      refreshAll().then(() => {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, refreshCount: _refreshCount }));
      }).catch(err => {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
      });
      return;
    }

    // ── Reload token config ──
    if (pathname === '/reload-config') {
      try {
        reloadTokenConfig();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, activeTokens: getActiveTokenCount() }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
      }
      return;
    }

    // ── Check if scanning ──
    if (pathname === '/scan-complete' && req.method === 'POST') {
      _scanCount++;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, scanCount: _scanCount }));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found', path: pathname }));
  });

  return server;
}

// ── PID file management ──

function writePid(): void {
  const dir = path.dirname(PID_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(PID_FILE, String(process.pid));
}

function readPid(): number | null {
  try {
    if (fs.existsSync(PID_FILE)) {
      return parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    }
  } catch { /* ignore */ }
  return null;
}

function removePid(): void {
  try {
    if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
  } catch { /* ignore */ }
}

// ── Main entry ──

export async function runDaemon(): Promise<void> {
  log.info(`Starting Crypto Radar daemon on port ${port}...`);

  writePid();
  _startTime = Date.now();

  const server = startHttp();

  // Initial warm-up
  log.info('Pre-warming caches...');
  await refreshAll();

  // Periodic refresh
  const refreshTimer = setInterval(() => {
    refreshAll().catch(err => {
      _errorCount++;
      log.error('Periodic refresh failed', { error: String(err) });
    });
  }, refreshMs);
  refreshTimer.unref();

  // Start HTTP server
  server.listen(port, '127.0.0.1', () => {
    _ready = true;
    log.info(`Daemon ready on http://127.0.0.1:${port} — refresh every ${refreshMs / 1000}s`);
  });

  // Graceful shutdown
  const shutdown = () => {
    log.info('Shutting down daemon...');
    clearInterval(refreshTimer);
    server.close();
    removePid();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  process.on('uncaughtException', (err) => {
    _errorCount++;
    log.error('Uncaught exception', { error: String(err) });
  });
}

// ── CLI helpers ──

export function isDaemonRunning(): boolean {
  const pid = readPid();
  if (!pid) return false;
  try {
    // On Linux, signal 0 checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    // Process not found — stale pid
    removePid();
    return false;
  }
}

export function stopDaemon(): boolean {
  const pid = readPid();
  if (!pid) return false;
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    removePid();
    return false;
  }
}
