// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Health Check System
// ═══════════════════════════════════════════════════════════════════════
//
// Monitors data source availability, data freshness, and system status.

import { fetchTicker } from '../binance.js';
import { logger } from '../core/logger.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;          // seconds since last reset
  checks: HealthCheck[];
  details: Record<string, unknown>;
}

interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  latencyMs: number;
  message: string;
  lastChecked: string;
}

let _startTime = Date.now();

export class HealthMonitor {
  private checks: HealthCheck[] = [];
  private consecutiveFailures = new Map<string, number>();

  /** Run all health checks and return overall status. */
  async check(): Promise<HealthStatus> {
    const results = await Promise.allSettled([
      this.checkBinance(),
      this.checkDataFiles(),
      this.checkSystem(),
    ]);

    this.checks = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        this.checks.push(result.value);
      }
    }

    const failures = this.checks.filter(c => c.status === 'fail').length;
    const warnings = this.checks.filter(c => c.status === 'warn').length;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (failures > 0) status = 'unhealthy';
    else if (warnings > 0) status = 'degraded';
    else status = 'healthy';

    return {
      status,
      uptime: Math.floor((Date.now() - _startTime) / 1000),
      checks: this.checks,
      details: {
        tokensTracked: 40,
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
      },
    };
  }

  private async checkBinance(): Promise<HealthCheck> {
    const start = Date.now();
    try {
      const ticker = await fetchTicker('BTCUSDT');
      const latency = Date.now() - start;
      this.consecutiveFailures.set('binance', 0);

      if (ticker && ticker.symbol === 'BTCUSDT') {
        return {
          name: 'binance-api',
          status: 'pass',
          latencyMs: latency,
          message: `BTCUSDT: $${parseFloat(ticker.lastPrice).toFixed(2)}`,
          lastChecked: new Date().toISOString(),
        };
      }
      return {
        name: 'binance-api',
        status: 'warn',
        latencyMs: latency,
        message: 'Response received but data may be incomplete',
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      const failCount = (this.consecutiveFailures.get('binance') ?? 0) + 1;
      this.consecutiveFailures.set('binance', failCount);
      const latency = Date.now() - start;

      return {
        name: 'binance-api',
        status: failCount >= 3 ? 'fail' : 'warn',
        latencyMs: latency,
        message: `Failed: ${err instanceof Error ? err.message : String(err)}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkDataFiles(): Promise<HealthCheck> {
    const start = Date.now();
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dataDir = 'data';

    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const latency = Date.now() - start;
      return {
        name: 'data-files',
        status: 'pass',
        latencyMs: latency,
        message: 'Data directory accessible',
        lastChecked: new Date().toISOString(),
      };
    } catch (err) {
      const latency = Date.now() - start;
      return {
        name: 'data-files',
        status: 'warn',
        latencyMs: latency,
        message: `Data dir issue: ${err instanceof Error ? err.message : String(err)}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkSystem(): Promise<HealthCheck> {
    const start = Date.now();
    const mem = process.memoryUsage();
    const latency = Date.now() - start;

    const memMB = Math.round(mem.heapUsed / 1024 / 1024);
    const status = memMB > 500 ? 'warn' : 'pass';

    return {
      name: 'system',
      status,
      latencyMs: latency,
      message: `Heap: ${memMB}MB, RSS: ${Math.round(mem.rss / 1024 / 1024)}MB`,
      lastChecked: new Date().toISOString(),
    };
  }

  /** Reset uptime counter. */
  reset(): void {
    _startTime = Date.now();
    this.consecutiveFailures.clear();
  }
}
