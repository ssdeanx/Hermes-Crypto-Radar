// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Charts Tests
// ═══════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import { priceSparkline, dualSparkline, multiMaSparkline, priceSvgChart, multiPanelSvgChart } from './charts.js';
import type { Kline } from '../types.js';

function makeKlines(count: number): Kline[] {
  return Array.from({ length: count }, (_, i) => ({
    openTime: i * 3600000,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 100 + i + Math.sin(i * 0.5) * 5,
    volume: 1000 + i * 10,
    closeTime: (i + 1) * 3600000,
    quoteVolume: (100 + i) * 1000,
    count: 100,
    takerBuyVol: 500,
    takerBuyQuoteVol: 50000,
    ignore: 0,
  }));
}

describe('priceSparkline', () => {
  it('produces ASCII chart output', () => {
    const klines = makeKlines(30);
    const chart = priceSparkline(klines);
    expect(chart).toBeTruthy();
    expect(chart.length).toBeGreaterThan(10);
    expect(chart).toMatch(/[╭╮╰╯│┤╱╲]/); // asciichart line drawing chars
  });

  it('respects custom height', () => {
    const klines = makeKlines(20);
    const chart = priceSparkline(klines, { height: 5 });
    const lines = chart.trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(5);
  });
});

describe('dualSparkline', () => {
  it('produces multi-series chart', () => {
    const klines = makeKlines(30);
    const chart = dualSparkline(klines);
    expect(chart).toBeTruthy();
    expect(chart.length).toBeGreaterThan(10);
  });
});

describe('multiMaSparkline', () => {
  it('produces multi-series chart with EMAs', () => {
    const klines = makeKlines(60);
    const chart = multiMaSparkline(klines);
    expect(chart).toBeTruthy();
    expect(chart.length).toBeGreaterThan(10);
  });
});

describe('priceSvgChart', () => {
  it('generates valid SVG', () => {
    const klines = makeKlines(30);
    const svg = priceSvgChart('Test Chart', klines, 600, 300);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('Test Chart');
    expect(svg).toContain('viewBox');
  });

  it('outputs different dimensions', () => {
    const klines = makeKlines(20);
    const svg = priceSvgChart('Small', klines, 300, 150);
    expect(svg).toContain('width=\"300\"');
    expect(svg).toContain('height=\"150\"');
  });
});

describe('multiPanelSvgChart', () => {
  it('generates multi-panel dashboard', () => {
    const klines = makeKlines(40);
    const rsiValues = klines.map((_, i) => i < 14 ? null : 50 + Math.sin(i * 0.5) * 20);
    const svg = multiPanelSvgChart('Dashboard', klines, rsiValues, 600, 400);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('RSI');
    expect(svg).toContain('Dashboard');
  });
});
