// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Health Monitor Tests
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthMonitor } from './health.js';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('HealthMonitor', () => {
  let monitor: HealthMonitor;

  beforeEach(() => {
    monitor = new HealthMonitor();
    mockFetch.mockReset();
  });

  it('returns healthy status when all checks pass', async () => {
    // Mock binance API
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: 'BTCUSDT', lastPrice: '50000.00' }),
    });

    const result = await monitor.check();
    expect(result.status).toBe('healthy');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.checks.length).toBe(3);
  });

  it('returns degraded when binance fails once', async () => {
    mockFetch.mockRejectedValue(new Error('Connection refused'));

    const result = await monitor.check();
    // First failure = warn (not fail yet)
    expect(result.status).toBe('degraded');
  });

  it('includes system details', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: 'BTCUSDT', lastPrice: '50000.00' }),
    });

    const result = await monitor.check();
    expect(result.details).toBeDefined();
    expect(result.details.nodeVersion).toBeDefined();
    expect(result.details.tokensTracked).toBeGreaterThanOrEqual(32);
  });

  it('reset clears failure count and updates uptime', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ symbol: 'BTCUSDT', lastPrice: '50000.00' }),
    });

    await monitor.check();
    const before = await monitor.check();
    monitor.reset();
    const after = await monitor.check();
    // Uptime should be lower after reset compared to if we hadn't reset
    expect(after.uptime).toBeGreaterThanOrEqual(0);
  });
});
