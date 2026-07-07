// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Warm Daemon Tests
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';

// ── Hoisted mocks ──

const mockHttp = vi.hoisted(() => ({ createServer: vi.fn() }));
const mockFs = vi.hoisted(() => ({
  existsSync: vi.fn(), writeFileSync: vi.fn(), readFileSync: vi.fn(),
  unlinkSync: vi.fn(), mkdirSync: vi.fn(),
}));
const mockBinance = vi.hoisted(() => ({ fetchAllTickers: vi.fn(), fetchKlines: vi.fn() }));
const mockTokens = vi.hoisted(() => ({
  getTokenList: vi.fn(), getBinancePair: vi.fn(),
  getActiveTokenCount: vi.fn(), reloadTokenConfig: vi.fn(),
}));
const mockCacheModule = vi.hoisted(() => {
  class MockCacheClass {
    set = vi.fn(); get = vi.fn(); has = vi.fn(); clear = vi.fn();
    stats = vi.fn(() => ({ size: 0, keys: [] }));
  }
  const mockInstance = new MockCacheClass();
  return {
    Cache: MockCacheClass,
    getGlobalCache: vi.fn(() => mockInstance),
  };
});

vi.mock('node:http', () => mockHttp);
vi.mock('node:fs', () => mockFs);
vi.mock('./binance.js', () => mockBinance);
vi.mock('./tokens.js', () => mockTokens);
vi.mock('./core/cache.js', () => mockCacheModule);

// ── Module under test ──

import { isDaemonRunning, stopDaemon } from './daemon.js';

// ── Helpers ──

const originalKill = process.kill;
function mockResponse() {
  return { writeHead: vi.fn().mockReturnThis(), end: vi.fn(), setHeader: vi.fn() };
}

// ═══════════════════════════════════════════════════════════════════════
// isDaemonRunning
// ═══════════════════════════════════════════════════════════════════════

describe('isDaemonRunning', () => {
  beforeEach(() => { vi.clearAllMocks(); process.kill = vi.fn(); });
  afterEach(() => { process.kill = originalKill; });

  it('returns true when pid exists and process is alive', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('12345\n');
    (process.kill as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(isDaemonRunning()).toBe(true);
  });

  it('returns false when pid file is missing', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(isDaemonRunning()).toBe(false);
  });

  it('returns false and cleans stale pid when process is dead', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('99999\n');
    (process.kill as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error('ESRCH'); });
    expect(isDaemonRunning()).toBe(false);
    expect(mockFs.unlinkSync).toHaveBeenCalled();
  });

  it('returns false when pid file has invalid content', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('not-a-number\n');
    expect(isDaemonRunning()).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// stopDaemon
// ═══════════════════════════════════════════════════════════════════════

describe('stopDaemon', () => {
  beforeEach(() => { vi.clearAllMocks(); process.kill = vi.fn(); });
  afterEach(() => { process.kill = originalKill; });

  it('sends SIGTERM when pid file exists', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('12345\n');
    (process.kill as ReturnType<typeof vi.fn>).mockReturnValue(true);
    expect(stopDaemon()).toBe(true);
    expect(process.kill).toHaveBeenCalledWith(12345, 'SIGTERM');
  });

  it('returns false when no pid file', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(stopDaemon()).toBe(false);
  });

  it('returns false and cleans up when kill fails', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.readFileSync.mockReturnValue('12345\n');
    (process.kill as ReturnType<typeof vi.fn>).mockImplementation(() => { throw new Error('ESRCH'); });
    expect(stopDaemon()).toBe(false);
    expect(mockFs.unlinkSync).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// HTTP handler tests (runDaemon integration)
// ═══════════════════════════════════════════════════════════════════════

describe('HTTP server', () => {
  let requestHandler: ((req: any, res: any) => void) | undefined;
  let mockSrv: { listen: ReturnType<typeof vi.fn>; close: ReturnType<typeof vi.fn> };
  let daemonMod: typeof import('./daemon.js');

  beforeAll(async () => {
    vi.useFakeTimers();
    mockSrv = { listen: vi.fn((_p: number, _h: string, cb?: () => void) => cb?.()), close: vi.fn() };
    mockHttp.createServer.mockImplementation((h: (req: any, res: any) => void) => {
      requestHandler = h;
      return mockSrv as any;
    });
    mockBinance.fetchAllTickers.mockResolvedValue(new Map([['SOLUSDT', { symbol: 'SOLUSDT', lastPrice: '150' }]]));
    mockBinance.fetchKlines.mockResolvedValue([]);
    mockTokens.getTokenList.mockReturnValue([]);
    mockTokens.getActiveTokenCount.mockReturnValue(42);
    mockFs.existsSync.mockReturnValue(false);

    daemonMod = await import('./daemon.js');
    daemonMod.runDaemon();
    await vi.advanceTimersByTimeAsync(1000);
  });

  afterAll(() => { vi.useRealTimers(); });
  afterEach(() => { vi.clearAllMocks(); });

  it('writes PID file and starts HTTP server on port 9877', () => {
    expect(mockFs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('daemon.pid'), expect.any(String));
    expect(mockSrv.listen).toHaveBeenCalledWith(9877, '127.0.0.1', expect.any(Function));
  });

  it('health endpoint returns status', () => {
    const res = mockResponse();
    requestHandler!({ url: '/health', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    const data = JSON.parse(res.end.mock.calls[0]![0]);
    expect(data.status).toMatch(/^(ready|warming)$/);
    expect(data.activeTokens).toBe(42);
  });

  it('root path returns health info', () => {
    const res = mockResponse();
    requestHandler!({ url: '/', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('OPTIONS returns 204', () => {
    const res = mockResponse();
    requestHandler!({ url: '/health', method: 'OPTIONS', headers: { host: 'localhost:9877' } }, res);
    expect(res.writeHead).toHaveBeenCalledWith(204);
  });

  it('refresh triggers cache refresh', async () => {
    const res = mockResponse();
    requestHandler!({ url: '/refresh', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    await vi.advanceTimersByTimeAsync(100);
    const data = JSON.parse(res.end.mock.calls[0]![0]);
    expect(data.ok).toBe(true);
  });

  it('reload-config calls reloadTokenConfig', () => {
    const res = mockResponse();
    requestHandler!({ url: '/reload-config', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    expect(mockTokens.reloadTokenConfig).toHaveBeenCalled();
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
  });

  it('reload-config returns 500 on error', () => {
    mockTokens.reloadTokenConfig.mockImplementationOnce(() => { throw new Error('Parse error'); });
    const res = mockResponse();
    requestHandler!({ url: '/reload-config', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object));
  });

  it('scan-complete increments scan counter', () => {
    const res1 = mockResponse();
    requestHandler!({ url: '/scan-complete', method: 'POST', headers: { host: 'localhost:9877' } }, res1);
    expect(JSON.parse(res1.end.mock.calls[0]![0]).scanCount).toBe(1);
    const res2 = mockResponse();
    requestHandler!({ url: '/scan-complete', method: 'POST', headers: { host: 'localhost:9877' } }, res2);
    expect(JSON.parse(res2.end.mock.calls[0]![0]).scanCount).toBe(2);
  });

  it('unknown path returns 404', () => {
    const res = mockResponse();
    requestHandler!({ url: '/unknown', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
  });

  it('sets security headers', () => {
    const res = mockResponse();
    requestHandler!({ url: '/health', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    expect(res.setHeader).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('health endpoint returns errorCount and scanCount', () => {
    const res = mockResponse();
    requestHandler!({ url: '/health', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    const data = JSON.parse(res.end.mock.calls[0]![0]);
    expect(data).toHaveProperty('scanCount');
    expect(data).toHaveProperty('errorCount');
    expect(typeof data.scanCount).toBe('number');
    expect(typeof data.errorCount).toBe('number');
  });

  it('health endpoint returns status and uptime', () => {
    const res = mockResponse();
    requestHandler!({ url: '/health', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    const data = JSON.parse(res.end.mock.calls[0]![0]);
    expect(data).toHaveProperty('uptime');
    expect(data).toHaveProperty('activeTokens');
    expect(typeof data.uptime).toBe('number');
    expect(typeof data.activeTokens).toBe('number');
  });

  it('health endpoint shows refreshIntervalMs and memoryUsage', () => {
    const res = mockResponse();
    requestHandler!({ url: '/health', method: 'GET', headers: { host: 'localhost:9877' } }, res);
    const data = JSON.parse(res.end.mock.calls[0]![0]);
    expect(data).toHaveProperty('refreshIntervalMs');
    expect(data).toHaveProperty('memoryUsage');
    expect(typeof data.refreshIntervalMs).toBe('number');
    expect(typeof data.memoryUsage).toBe('string');
  });
});
