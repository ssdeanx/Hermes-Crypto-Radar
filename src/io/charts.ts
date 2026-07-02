// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Chart Generation
// ═══════════════════════════════════════════════════════════════════════
//
// Two chart types:
//   1. Terminal ASCII charts — sparklines drawn inline (asciichart)
//   2. SVG charts — standalone scalable vector graphics for sharing/embedding

import asciichart from 'asciichart';
import type { Kline } from '../types.js';

// ── Terminal ASCII Charts ──

export interface ChartOptions {
  height?: number;
  width?: number;
  format?: 'ascii' | 'svg';
  showLabels?: boolean;
}

/**
 * Generate a terminal sparkline chart for price data.
 * Uses asciichart for compact inline display.
 */
export function priceSparkline(klines: Kline[], opts: ChartOptions = {}): string {
  const closes = klines.map(k => k.close);
  return asciichart.plot(closes, {
    height: opts.height ?? 10,
    format: opts.format ?? 'ascii',
    colors: [
      asciichart.green,
      asciichart.blue,
      asciichart.magenta,
      asciichart.cyan,
    ],
  });
}

/**
 * Generate a dual-line sparkline (price + volume).
 */
export function dualSparkline(klines: Kline[], opts: ChartOptions = {}): string {
  const closes = klines.map(k => k.close);
  const volumes = klines.map(k => k.quoteVolume);

  return asciichart.plot([closes, volumes], {
    height: opts.height ?? 12,
    format: opts.format ?? 'ascii',
    colors: [
      asciichart.green,
      asciichart.cyan,
    ],
  });
}

/**
 * Multi-series chart: price, EMA20, EMA50
 */
export function multiMaSparkline(klines: Kline[], opts: ChartOptions = {}): string {
  const closes = klines.map(k => k.close);
  const ema20 = calculateSeriesEma(closes, 20).map(v => v ?? 0);
  const ema50 = calculateSeriesEma(closes, 50).map(v => v ?? 0);

  return asciichart.plot([closes, ema20, ema50], {
    height: opts.height ?? 12,
    format: opts.format ?? 'ascii',
    colors: [
      asciichart.green,
      asciichart.yellow,
      asciichart.red,
    ],
  });
}

function calculateSeriesEma(values: number[], period: number): (number | null)[] {
  if (!values || values.length < period) return new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(values.length).fill(null);
  result[period - 1] = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) {
    result[i] = values[i]! * k + (result[i - 1] ?? result[period - 1]!) * (1 - k);
  }
  return result;
}

// ── SVG Chart Generation ──

/**
 * Generate an inline SVG price chart.
 * Self-contained — no external deps, renders in any browser/markdown viewer.
 */
export function priceSvgChart(
  title: string,
  klines: Kline[],
  width = 600,
  height = 300,
): string {
  const closes = klines.map(k => k.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const padding = { top: 30, right: 20, bottom: 40, left: 60 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const n = closes.length;

  // Generate SVG path data
  const points = closes.map((v, i) => {
    const x = padding.left + (i / (n - 1)) * plotW;
    const y = padding.top + plotH - ((v - min) / range) * plotH;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathData = points.join(' ');

  // Grid lines and labels
  const gridLines = 5;
  let gridSvg = '';
  let labelSvg = '';
  for (let i = 0; i <= gridLines; i++) {
    const yRatio = i / gridLines;
    const y = padding.top + plotH * yRatio;
    const val = max - range * yRatio;
    gridSvg += `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(width - padding.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#e2e8f0" stroke-width="1"/>\n`;
    labelSvg += `<text x="${(padding.left - 8).toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="end" fill="#94a3b8" font-size="11" font-family="monospace">${formatYLabel(val)}</text>\n`;
  }

  // Last value label
  const lastClose = closes[n - 1] ?? 0;
  const lastX = padding.left + plotW;
  const lastY = padding.top + plotH - ((lastClose - min) / range) * plotH;

  // Volume bars (optional, small at bottom)
  const volumes = klines.map(k => k.quoteVolume);
  const maxVol = Math.max(...volumes) || 1;
  let volSvg = '';
  for (let i = 0; i < n; i++) {
    const volRatio = volumes[i]! / maxVol;
    const x = padding.left + (i / (n - 1)) * plotW;
    const barH = volRatio * 20;
    const barY = height - padding.bottom + 5;
    volSvg += `<rect x="${(x - 1).toFixed(1)}" y="${(barY - barH).toFixed(1)}" width="2" height="${barH.toFixed(1)}" fill="rgba(148,163,184,0.3)" />\n`;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>
  
  <!-- Title -->
  <text x="${(width / 2).toFixed(1)}" y="20" text-anchor="middle" fill="#f1f5f9" font-size="13" font-family="sans-serif" font-weight="bold">${escapeXml(title)}</text>
  
  <!-- Grid -->
  ${gridSvg}
  
  <!-- Volume bars -->
  ${volSvg}
  
  <!-- Price line -->
  <path d="${pathData}" fill="none" stroke="rgba(34, 211, 238, 0.9)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  
  <!-- Price fill -->
  <path d="${pathData} L${(padding.left + plotW).toFixed(1)},${(padding.top + plotH).toFixed(1)} L${padding.left.toFixed(1)},${(padding.top + plotH).toFixed(1)} Z" fill="rgba(34, 211, 238, 0.08)"/>
  
  <!-- Last price label -->
  <rect x="${(lastX + 5).toFixed(1)}" y="${(lastY - 10).toFixed(1)}" width="80" height="20" rx="4" fill="#1e293b" stroke="rgba(34,211,238,0.3)"/>
  <text x="${(lastX + 10).toFixed(1)}" y="${(lastY + 3).toFixed(1)}" fill="#22d3ee" font-size="11" font-family="monospace" font-weight="bold">${formatYLabel(lastClose)}</text>
  
  <!-- Y-axis labels -->
  ${labelSvg}
</svg>`;

  return svg;
}

/**
 * Generate a multi-panel SVG dashboard with price + RSI.
 */
export function multiPanelSvgChart(
  title: string,
  klines: Kline[],
  rsiValues: (number | null)[],
  width = 600,
  height = 400,
): string {
  const panelH = Math.floor((height - 20) / 2);
  const priceSvg = priceSvgChart(title, klines, width, panelH + 40);

  // Extract just the viewBox from priceSvg and rescale
  const rsiPanelHeight = panelH;
  const padding = { top: 15, right: 20, bottom: 25, left: 60 };
  const plotW = width - padding.left - padding.right;
  const plotH = rsiPanelHeight - padding.top - padding.bottom;
  const n = klines.length;

  // Filter out null RSI values but maintain x positions
  const validRsis = rsiValues.filter((v): v is number => v != null);
  const rsiMin = 0;
  const rsiMax = 100;

  let rsiPath = '';
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const rsi = rsiValues[i];
    if (rsi == null) continue;
    const x = padding.left + (i / (n - 1)) * plotW;
    const y = padding.top + plotH - ((rsi - rsiMin) / (rsiMax - rsiMin)) * plotH;
    rsiPath += `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    idx++;
  }

  // Overbought/oversold lines
  const obY = padding.top + plotH - ((70 - rsiMin) / (rsiMax - rsiMin)) * plotH;
  const osY = padding.top + plotH - ((30 - rsiMin) / (rsiMax - rsiMin)) * plotH;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <rect width="${width}" height="${height}" fill="#0f172a" rx="8"/>
  
  <!-- Title -->
  <text x="${(width / 2).toFixed(1)}" y="16" text-anchor="middle" fill="#f1f5f9" font-size="12" font-family="sans-serif" font-weight="bold">${escapeXml(title)}</text>
  
  <!-- PRICE PANEL -->
  <g transform="translate(0, 0) scale(1, ${panelH / (panelH + 40)})">
    ${priceSvg.replace('<svg', '<g').replace('</svg>', '</g>')}
  </g>
  
  <!-- RSI PANEL -->
  <g transform="translate(0, ${panelH + 10})">
    <!-- Panel bg -->
    <rect x="0" y="0" width="${width}" height="${rsiPanelHeight}" fill="transparent"/>
    
    <!-- Overbought line (70) -->
    <line x1="${padding.left}" y1="${obY.toFixed(1)}" x2="${(width - padding.right).toFixed(1)}" y2="${obY.toFixed(1)}" stroke="rgba(239,68,68,0.5)" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="${(width - 15).toFixed(1)}" y="${(obY + 3).toFixed(1)}" text-anchor="end" fill="rgba(239,68,68,0.6)" font-size="9" font-family="monospace">70</text>
    
    <!-- Oversold line (30) -->
    <line x1="${padding.left}" y1="${osY.toFixed(1)}" x2="${(width - padding.right).toFixed(1)}" y2="${osY.toFixed(1)}" stroke="rgba(34,197,94,0.5)" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="${(width - 15).toFixed(1)}" y="${(osY + 3).toFixed(1)}" text-anchor="end" fill="rgba(34,197,94,0.6)" font-size="9" font-family="monospace">30</text>
    
    <!-- RSI line -->
    <path d="${rsiPath}" fill="none" stroke="rgba(168,85,247,0.9)" stroke-width="1.5" stroke-linejoin="round"/>
    
    <!-- Label -->
    <text x="${padding.left.toFixed(1)}" y="${(rsiPanelHeight - 5).toFixed(1)}" fill="#94a3b8" font-size="9" font-family="monospace">RSI (14)</text>
  </g>
</svg>`;

  return svg;
}

function formatYLabel(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(6)}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
