// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Chart Generation
// ═══════════════════════════════════════════════════════════════════════
//
// SVG charts conforming to 2026 best practices:
//   - Self-contained (no external CSS/JS/deps)
//   - CSS-in-<style> for maintainable styling
//   - <linearGradient> for depth and visual polish
//   - viewBox for responsive scaling
//   - role="img" + aria-label for accessibility
//   - <title> tooltips on data points
//   - Crosshair effects at latest candle
//   - Dark theme (#0f172a bg), cyan/green/red palette
//   - Inter font stack
//   - Branding watermark
//
// Chart types:
//   1. priceSvgChart      — basic line chart with gradient fill
//   2. multiPanelSvgChart — price + RSI dashboard
//   3. candlestickSvgChart — OHLCV candlestick chart with EMA overlays

import asciichart from 'asciichart';
import type { Kline } from '../types.js';

// ── Terminal ASCII Charts ──

export interface ChartOptions {
  height?: number;
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
    colors: [
      asciichart.green,
      asciichart.yellow,
      asciichart.red,
    ],
  });
}

// ── Shared Helpers ──

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

function formatYLabel(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

interface ChartLayout {
  padding: { top: number; right: number; bottom: number; left: number };
  width: number;
  height: number;
  plotW: number;
  plotH: number;
}

function getLayout(width: number, height: number, bottomPad = 50): ChartLayout {
  const padding = { top: 30, right: 20, bottom: bottomPad, left: 60 };
  return {
    padding,
    width,
    height,
    plotW: width - padding.left - padding.right,
    plotH: height - padding.top - padding.bottom,
  };
}

/** Shared CSS styles block injected into every SVG */
function sharedStyles(): string {
  return `<style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&amp;display=swap');
    .bg { fill: #0f172a; }
    .title { fill: #f1f5f9; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 13px; font-weight: 700; }
    .grid-line { stroke: #1e293b; stroke-width: 1; }
    .grid-label { fill: #475569; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 10px; }
    .price-line { fill: none; stroke: url(#priceGrad); stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .price-fill { fill: url(#priceFillGrad); }
    .ema20-line { fill: none; stroke: #f59e0b; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
    .ema50-line { fill: none; stroke: #8b5cf6; stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
    .crosshair-line { stroke: rgba(148,163,184,0.5); stroke-width: 1; stroke-dasharray: 4,4; }
    .label-bg { fill: #1e293b; stroke: rgba(34,211,238,0.3); rx: 4; }
    .label-text { fill: #22d3ee; font-family: 'Inter', monospace; font-size: 11px; font-weight: 700; }
    .label-text-white { fill: #f1f5f9; font-family: 'Inter', monospace; font-size: 10px; }
    .minmax-line { stroke: #facc15; stroke-width: 1; stroke-dasharray: 3,2; }
    .minmax-text { fill: #facc15; font-family: 'Inter', monospace; font-size: 9px; }
    .vol-bar-up { fill: rgba(34,197,94,0.5); }
    .vol-bar-down { fill: rgba(239,68,68,0.5); }
    .candle-up { fill: rgba(34,197,94,0.7); stroke: #22c55e; }
    .candle-down { fill: rgba(239,68,68,0.7); stroke: #ef4444; }
    .wick-up { stroke: #22c55e; stroke-width: 1; }
    .wick-down { stroke: #ef4444; stroke-width: 1; }
    .watermark { fill: rgba(148,163,184,0.25); font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 10px; }
    .axis-label { fill: #64748b; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 9px; }
    .rsi-line { fill: none; stroke: url(#rsiGrad); stroke-width: 1.5; stroke-linejoin: round; }
    .rsi-label { fill: #94a3b8; font-family: 'Inter', monospace; font-size: 9px; }
    .rsi-ob { stroke: rgba(239,68,68,0.5); stroke-width: 1; stroke-dasharray: 4,3; }
    .rsi-os { stroke: rgba(34,197,94,0.5); stroke-width: 1; stroke-dasharray: 4,3; }
    .rsi-bound { stroke: rgba(148,163,184,0.15); stroke-width: 1; }
    /* Volume Profile styles */
    .vp-bar-normal { fill: rgba(148,163,184,0.15); }
    .vp-bar-hvn { fill: rgba(34,197,94,0.35); }
    .vp-bar-lvn { fill: rgba(239,68,68,0.3); }
    .vp-poc-line { stroke: #22d3ee; stroke-width: 1.5; stroke-dasharray: 3,2; }
    .vp-poc-label { fill: #22d3ee; font-family: 'Inter', monospace; font-size: 9px; font-weight: 700; }
    .vp-label { fill: #64748b; font-family: 'Inter', monospace; font-size: 9px; }
    .vp-va-area { fill: rgba(34,211,238,0.06); stroke: rgba(34,211,238,0.15); stroke-width: 0.5; }
    /* Comparison chart styles */
    .comp-grid-line { stroke: #1e293b; stroke-width: 1; }
    .comp-grid-line-zero { stroke: #334155; stroke-width: 2; stroke-dasharray: 5,3; }
    .comp-grid-label { fill: #475569; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 9px; }
    .comp-line { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    .comp-hover-dot { fill: transparent; }
    .comp-legend-text { fill: #f1f5f9; font-family: 'Inter', monospace; font-size: 10px; }
    .comp-pct-up { fill: #22c55e; }
    .comp-pct-down { fill: #ef4444; }
    .comp-pct-zero { fill: #94a3b8; }
    /* Light mode overrides */
    @media (prefers-color-scheme: light) {
      .bg { fill: #ffffff; }
      .title { fill: #1e293b; }
      .grid-line { stroke: #e2e8f0; }
      .grid-label { fill: #475569; }
      .axis-label { fill: #64748b; }
      .label-bg { fill: #f1f5f9; stroke: rgba(34,211,238,0.4); }
      .label-text { fill: #0891b2; }
      .label-text-white { fill: #1e293b; }
      .rsi-label { fill: #64748b; }
      .watermark { fill: rgba(100,116,139,0.35); }
      .comp-grid-line { stroke: #e2e8f0; }
      .comp-grid-line-zero { stroke: #cbd5e1; }
      .comp-grid-label { fill: #64748b; }
      .comp-legend-text { fill: #1e293b; }
      .vol-bar-up { fill: rgba(22,163,74,0.35); }
      .vol-bar-down { fill: rgba(220,38,38,0.35); }
      .candle-up { fill: rgba(22,163,74,0.6); stroke: #16a34a; }
      .candle-down { fill: rgba(220,38,38,0.6); stroke: #dc2626; }
      .wick-up { stroke: #16a34a; }
      .wick-down { stroke: #dc2626; }
    }
    /* Hyperframe animations */
    @keyframes pulse-glow {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
    @keyframes gradient-shift {
      0% { stop-color: #0f172a; }
      50% { stop-color: #1e293b; }
      100% { stop-color: #0f172a; }
    }
    .latest-candle { animation: pulse-glow 2s ease-in-out infinite; }
    .pulse-dot { animation: pulse-glow 2s ease-in-out infinite; }
    .data-point { transition: opacity 0.3s, stroke-width 0.3s, r 0.3s; }
    .data-point:hover { opacity: 1; stroke-width: 3; r: 5; }
    .frame-counter { fill: rgba(148,163,184,0.3); font-family: 'Inter', monospace; font-size: 8px; }
    /* Glassmorphism panel */
    .panel { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); background: rgba(30, 41, 59, 0.8); border-radius: 8px; }
    @media (prefers-color-scheme: light) {
      .panel { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); background: rgba(255, 255, 255, 0.9); }
    }
    /* Typography */
    .tabular-nums { font-variant-numeric: tabular-nums; }
    /* Accessibility: reduced motion */
    @media (prefers-reduced-motion: reduce) {
      .latest-candle, .pulse-dot, .data-point { animation: none; transition: none; }
    }
  </style>`;
}

/** Shared defs block: gradients used across chart types */
function sharedDefs(): string {
  return `<defs>
    <linearGradient id="priceGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.5"/>
      <stop offset="50%" stop-color="#22d3ee" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.95"/>
    </linearGradient>
    <linearGradient id="priceFillGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.02"/>
    </linearGradient>
    <linearGradient id="volGrad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0.25"/>
    </linearGradient>
    <linearGradient id="rsiGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#a78bfa" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#8b5cf6" stop-opacity="0.9"/>
    </linearGradient>
    <linearGradient id="candleVolUpGrad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="rgba(34,197,94,0.1)"/>
      <stop offset="100%" stop-color="rgba(34,197,94,0.5)"/>
    </linearGradient>
    <linearGradient id="candleVolDownGrad" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="rgba(239,68,68,0.1)"/>
      <stop offset="100%" stop-color="rgba(239,68,68,0.5)"/>
    </linearGradient>
    <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="2.5" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <filter id="glassMorphism" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur"/>
      <feSpecularLighting in="blur" surfaceScale="2" specularConstant="0.2" specularExponent="20" lighting-color="#ffffff" result="specOut">
        <fePointLight x="200" y="100" z="200"/>
      </feSpecularLighting>
      <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut2"/>
      <feComposite in="SourceGraphic" in2="specOut2" operator="arithmetic" k1="0" k2="1" k3="0.08" k4="0"/>
    </filter>
    <!-- Gradient-shift animation background gradients -->
    <linearGradient id="bgGradShift" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a">
        <animate attributeName="stop-color" values="#0f172a;#1e293b;#0f172a" dur="8s" repeatCount="indefinite"/>
      </stop>
      <stop offset="100%" stop-color="#0f172a">
        <animate attributeName="stop-color" values="#0f172a;#1e293b;#0f172a" dur="8s" repeatCount="indefinite"/>
      </stop>
    </linearGradient>
  </defs>`;
}

// ── Grid & Axis Renderers ──

/**
 * Render horizontal grid lines and Y-axis labels
 */
function renderYGrid(layout: ChartLayout, min: number, max: number, lines = 5): string {
  const { padding, plotW, plotH, width } = layout;
  const range = max - min || 1;
  let out = '';
  for (let i = 0; i <= lines; i++) {
    const yRatio = i / lines;
    const y = padding.top + plotH * yRatio;
    const val = max - range * yRatio;
    out += `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(width - padding.right).toFixed(1)}" y2="${y.toFixed(1)}" class="grid-line"/>\n`;
    out += `<text x="${(padding.left - 8).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="grid-label">${formatYLabel(val)}</text>\n`;
  }
  return out;
}

/**
 * Render X-axis time labels (last few timestamps)
 */
function renderXLabels(layout: ChartLayout, klines: Kline[], count = 5): string {
  const { padding, plotW, height, plotH } = layout;
  const n = klines.length;
  if (n === 0) return '';
  const step = Math.max(1, Math.floor(n / (count - 1)));
  let out = '';
  for (let i = 0; i < n; i += step) {
    const x = padding.left + (i / (n - 1)) * plotW;
    const k = klines[i]!;
    const label = formatTime(k.openTime);
    out += `<text x="${x.toFixed(1)}" y="${(height - padding.bottom + 18).toFixed(1)}" text-anchor="middle" class="axis-label">${escapeXml(label)}</text>\n`;
  }
  // Last one
  const lastK = klines[n - 1]!;
  const lastX = padding.left + plotW;
  out += `<text x="${lastX.toFixed(1)}" y="${(height - padding.bottom + 18).toFixed(1)}" text-anchor="end" class="axis-label">${formatTime(lastK.openTime)}</text>\n`;
  return out;
}

/**
 * Render min/max price markers with horizontal lines and labels
 */
function renderMinMaxMarkers(layout: ChartLayout, klines: Kline[], min: number, max: number): string {
  const { padding, plotW, plotH, width } = layout;
  const range = max - min || 1;
  const n = klines.length;
  let out = '';

  // Highest high
  let highIdx = 0;
  let highest = klines[0]?.high ?? 0;
  for (let i = 1; i < n; i++) {
    if ((klines[i]?.high ?? 0) > highest) { highest = klines[i]!.high; highIdx = i; }
  }
  const highX = padding.left + (highIdx / (n - 1)) * plotW;
  const highY = padding.top + plotH - ((highest - min) / range) * plotH;
  out += `<line x1="${padding.left}" y1="${highY.toFixed(1)}" x2="${(width - padding.right).toFixed(1)}" y2="${highY.toFixed(1)}" class="minmax-line"/>\n`;
  out += `<rect x="${(highX + 4).toFixed(1)}" y="${(highY - 11).toFixed(1)}" width="68" height="16" rx="3" fill="#1e293b" stroke="rgba(250,204,21,0.3)"/>\n`;
  out += `<text x="${(highX + 8).toFixed(1)}" y="${(highY + 1).toFixed(1)}" class="minmax-text">⬆ ${formatYLabel(highest)}</text>\n`;

  // Lowest low
  let lowIdx = 0;
  let lowest = klines[0]?.low ?? 0;
  for (let i = 1; i < n; i++) {
    if ((klines[i]?.low ?? Infinity) < lowest) { lowest = klines[i]!.low; lowIdx = i; }
  }
  const lowX = padding.left + (lowIdx / (n - 1)) * plotW;
  const lowY = padding.top + plotH - ((lowest - min) / range) * plotH;
  out += `<line x1="${padding.left}" y1="${lowY.toFixed(1)}" x2="${(width - padding.right).toFixed(1)}" y2="${lowY.toFixed(1)}" class="minmax-line"/>\n`;
  out += `<rect x="${(lowX + 4).toFixed(1)}" y="${(lowY - 11).toFixed(1)}" width="68" height="16" rx="3" fill="#1e293b" stroke="rgba(250,204,21,0.3)"/>\n`;
  out += `<text x="${(lowX + 8).toFixed(1)}" y="${(lowY + 1).toFixed(1)}" class="minmax-text">⬇ ${formatYLabel(lowest)}</text>\n`;

  return out;
}

/**
 * Render crosshair at the latest candle with price/date tooltip
 */
function renderCrosshair(layout: ChartLayout, klines: Kline[], min: number, max: number): string {
  const { padding, plotW, plotH, width } = layout;
  const range = max - min || 1;
  const n = klines.length;
  const lastK = klines[n - 1];
  if (!lastK) return '';

  const x = padding.left + plotW;
  const y = padding.top + plotH - ((lastK.close - min) / range) * plotH;

  return `<line x1="${x.toFixed(1)}" y1="${(padding.top - 5).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(padding.top + plotH + 5).toFixed(1)}" class="crosshair-line"/>\n` +
    `<rect x="${(x + 5).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="90" height="20" rx="4" class="label-bg"/>\n` +
    `<text x="${(x + 10).toFixed(1)}" y="${(y + 3).toFixed(1)}" class="label-text">${formatYLabel(lastK.close)}</text>\n` +
    `<rect x="${(padding.left - 5).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="90" height="20" rx="4" class="label-bg"/>\n` +
    `<text x="${padding.left.toFixed(1)}" y="${(y + 3).toFixed(1)}" class="label-text">${formatTime(lastK.openTime)}</text>\n`;
}

/**
 * Render volume bars with gradient fill
 */
function renderVolumeBars(layout: ChartLayout, klines: Kline[], barMaxHeight: number): string {
  const { padding, plotW, height } = layout;
  const n = klines.length;
  const volumes = klines.map(k => k.quoteVolume);
  const maxVol = Math.max(...volumes) || 1;
  let out = '';
  for (let i = 0; i < n; i++) {
    const volRatio = volumes[i]! / maxVol;
    const x = padding.left + (i / (n - 1)) * plotW;
    const barH = volRatio * barMaxHeight;
    const barY = height - padding.bottom + 5;
    out += `<rect x="${(x - 1).toFixed(1)}" y="${(barY - barH).toFixed(1)}" width="2" height="${barH.toFixed(1)}" fill="url(#volGrad)">
      <animate attributeName="height" from="0" to="${barH.toFixed(1)}" dur="0.5s" fill="freeze"/>
      <animate attributeName="y" from="${barY}" to="${(barY - barH).toFixed(1)}" dur="0.5s" fill="freeze"/>
    </rect>\n`;
  }
  return out;
}

/** Watermark branding */
function renderWatermark(layout: ChartLayout): string {
  const { width, height } = layout;
  return `<text x="${(width - 12).toFixed(1)}" y="${(height - 8).toFixed(1)}" text-anchor="end" class="watermark">🛰️ Hermes Crypto Radar</text>`;
}

/** Opening SVG tag with accessibility attributes */
function svgOpen(width: number, height: number, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${escapeXml(title)}">
  ${sharedStyles()}
  ${sharedDefs()}
  <rect width="${width}" height="${height}" class="bg" rx="8"/>`;
}

const SVG_CLOSE = '</svg>';

/** Render title centered */
function renderTitle(layout: ChartLayout, title: string): string {
  return `<text x="${(layout.width / 2).toFixed(1)}" y="20" text-anchor="middle" class="title">${escapeXml(title)}</text>`;
}

// ── SVG Chart Generation ──

/**
 * Generate an inline SVG price chart (line chart).
 * Enhanced with gradients, crosshair, tooltips, axis labels, min/max markers, and branding.
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
  const layout = getLayout(width, height);
  const { padding, plotW, plotH } = layout;
  const n = closes.length;

  // Generate SVG path data
  const points = closes.map((v, i) => {
    const x = padding.left + (i / (n - 1)) * plotW;
    const y = padding.top + plotH - ((v - min) / range) * plotH;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathData = points.join(' ');

  // Tooltip <title> elements on every data point
  let tooltipSvg = '';
  for (let i = 0; i < n; i++) {
    const x = padding.left + (i / (n - 1)) * plotW;
    const y = padding.top + plotH - ((closes[i]! - min) / range) * plotH;
    tooltipSvg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="data-point">
      <title>${formatTime(klines[i]!.openTime)} — ${formatYLabel(closes[i]!)}</title>
    </circle>\n`;
  }

  const svg = `${svgOpen(width, height, `Price Chart: ${title}`)}
  ${renderTitle(layout, title)}

  <!-- Grid & Y-axis -->
  ${renderYGrid(layout, min, max)}

  <!-- Volume bars -->
  ${renderVolumeBars(layout, klines, 20)}

  <!-- Price fill (gradient) -->
  <path d="${pathData} L${(padding.left + plotW).toFixed(1)},${(padding.top + plotH).toFixed(1)} L${padding.left.toFixed(1)},${(padding.top + plotH).toFixed(1)} Z" class="price-fill"/>

  <!-- Price line (gradient) -->
  <path d="${pathData}" class="price-line"/>

  <!-- Tooltips -->
  ${tooltipSvg}

  <!-- Crosshair + labels -->
  ${renderCrosshair(layout, klines, min, max)}

  <!-- Pulsing latest data point -->
  <circle cx="${(padding.left + plotW).toFixed(1)}" cy="${(padding.top + plotH - ((closes[n-1]! - min) / range) * plotH).toFixed(1)}" r="4" class="pulse-dot data-point"/>

  <!-- Frame counter -->
  <text x="6" y="${(height - 8).toFixed(1)}" class="frame-counter">FRM-${Math.floor(Math.random() * 90000 + 10000)}</text>

  <!-- Min/max markers -->
  ${renderMinMaxMarkers(layout, klines, min, max)}

  <!-- X-axis labels -->
  ${renderXLabels(layout, klines)}

  <!-- Branding -->
  ${renderWatermark(layout)}

${SVG_CLOSE}`;

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
  const closes = klines.map(k => k.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;

  // ── Price panel layout ──
  const priceLayout = getLayout(width, panelH + 40);
  const n = klines.length;

  const points = closes.map((v, i) => {
    const x = priceLayout.padding.left + (i / (n - 1)) * priceLayout.plotW;
    const y = priceLayout.padding.top + priceLayout.plotH - ((v - min) / range) * priceLayout.plotH;
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const pathData = points.join(' ');

  // Tooltips for price panel
  let priceTooltips = '';
  for (let i = 0; i < n; i++) {
    const x = priceLayout.padding.left + (i / (n - 1)) * priceLayout.plotW;
    const y = priceLayout.padding.top + priceLayout.plotH - ((closes[i]! - min) / range) * priceLayout.plotH;
    priceTooltips += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="data-point">
      <title>${formatTime(klines[i]!.openTime)} — ${formatYLabel(closes[i]!)}</title>
    </circle>\n`;
  }

  const priceCrosshair = renderCrosshair(priceLayout, klines, min, max);
  const priceMarkers = renderMinMaxMarkers(priceLayout, klines, min, max);
  const priceXLabels = renderXLabels(priceLayout, klines);
  const priceWatermark = renderWatermark(priceLayout);

  // ── RSI panel ──
  const rsiLayout = getLayout(width, panelH, 30);
  const rsiPanelTop = panelH + 10;
  const rsiPlotH = rsiLayout.plotH;

  // Filter out null RSI values but maintain x positions
  const rsiMin = 0;
  const rsiMax = 100;

  let rsiPath = '';
  let idx = 0;
  for (let i = 0; i < n; i++) {
    const rsi = rsiValues[i];
    if (rsi == null) continue;
    const x = rsiLayout.padding.left + (i / (n - 1)) * rsiLayout.plotW;
    const y = rsiPanelTop + rsiLayout.padding.top + rsiPlotH - ((rsi - rsiMin) / (rsiMax - rsiMin)) * rsiPlotH;
    rsiPath += `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    idx++;
  }

  // Overbought/oversold lines
  const obY = rsiPanelTop + rsiLayout.padding.top + rsiPlotH - ((70 - rsiMin) / (rsiMax - rsiMin)) * rsiPlotH;
  const osY = rsiPanelTop + rsiLayout.padding.top + rsiPlotH - ((30 - rsiMin) / (rsiMax - rsiMin)) * rsiPlotH;
  const midY = rsiPanelTop + rsiLayout.padding.top + rsiPlotH - ((50 - rsiMin) / (rsiMax - rsiMin)) * rsiPlotH;

  // RSI tooltips
  let rsiTooltips = '';
  for (let i = 0; i < n; i++) {
    const rsi = rsiValues[i];
    if (rsi == null) continue;
    const x = rsiLayout.padding.left + (i / (n - 1)) * rsiLayout.plotW;
    const y = rsiPanelTop + rsiLayout.padding.top + rsiPlotH - ((rsi - rsiMin) / (rsiMax - rsiMin)) * rsiPlotH;
    rsiTooltips += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="data-point">
      <title>${formatTime(klines[i]!.openTime)} — RSI: ${rsi.toFixed(1)}</title>
    </circle>\n`;
  }

  // RSI crosshair
  const lastRsi = rsiValues.filter((v): v is number => v != null).pop();
  const lastClose = closes[n - 1] ?? 0;
  let rsiCrosshair = '';
  if (lastRsi != null) {
    const x = rsiLayout.padding.left + rsiLayout.plotW;
    const y = rsiPanelTop + rsiLayout.padding.top + rsiPlotH - ((lastRsi - rsiMin) / (rsiMax - rsiMin)) * rsiPlotH;
    rsiCrosshair = `<line x1="${x.toFixed(1)}" y1="${(rsiPanelTop + rsiLayout.padding.top - 5).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(rsiPanelTop + rsiLayout.padding.top + rsiPlotH + 5).toFixed(1)}" class="crosshair-line"/>\n`;
    rsiCrosshair += `<rect x="${(x + 5).toFixed(1)}" y="${(y - 10).toFixed(1)}" width="60" height="18" rx="4" class="label-bg"/>\n`;
    rsiCrosshair += `<text x="${(x + 10).toFixed(1)}" y="${(y + 3).toFixed(1)}" class="label-text">RSI ${lastRsi.toFixed(1)}</text>\n`;
  }

  // RSI grid
  let rsiGrid = '';
  for (let v = 0; v <= 100; v += 10) {
    const y = rsiPanelTop + rsiLayout.padding.top + rsiPlotH - ((v - rsiMin) / (rsiMax - rsiMin)) * rsiPlotH;
    rsiGrid += `<line x1="${rsiLayout.padding.left}" y1="${y.toFixed(1)}" x2="${(width - rsiLayout.padding.right).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#1e293b" stroke-width="${v === 50 ? 0.5 : 0.3}"/>\n`;
    if (v > 0 && v < 100) {
      rsiGrid += `<text x="${(rsiLayout.padding.left - 6).toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="end" class="grid-label">${v}</text>\n`;
    }
  }

  const svg = `${svgOpen(width, height, `Dashboard: ${title}`)}
  ${renderTitle(rsiLayout, title)}

  <!-- ==================== PRICE PANEL ==================== -->
  <g transform="translate(0, 0)">
    <!-- Panel bg -->
    <rect x="${priceLayout.padding.left}" y="${priceLayout.padding.top}" width="${priceLayout.plotW}" height="${priceLayout.plotH}" fill="rgba(255,255,255,0.01)" rx="2"/>

    <!-- Grid & Y-axis -->
    ${renderYGrid(priceLayout, min, max)}

    <!-- Volume bars -->
    ${renderVolumeBars(priceLayout, klines, 15)}

    <!-- Price fill (gradient) -->
    <path d="${pathData} L${(priceLayout.padding.left + priceLayout.plotW).toFixed(1)},${(priceLayout.padding.top + priceLayout.plotH).toFixed(1)} L${priceLayout.padding.left.toFixed(1)},${(priceLayout.padding.top + priceLayout.plotH).toFixed(1)} Z" class="price-fill"/>

    <!-- Price line -->
    <path d="${pathData}" class="price-line"/>

    <!-- Tooltips -->
    ${priceTooltips}

    <!-- Crosshair -->
    ${priceCrosshair}

    <!-- Min/max markers -->
    ${priceMarkers}

    <!-- X-axis labels -->
    ${priceXLabels}

    <!-- Branding -->
    ${priceWatermark}
  </g>

  <!-- ==================== RSI PANEL ==================== -->
  <g transform="translate(0, 0)">
    <!-- Divider -->
    <line x1="${rsiLayout.padding.left}" y1="${panelH + 5}" x2="${(width - rsiLayout.padding.right)}" y2="${panelH + 5}" stroke="#1e293b" stroke-width="1"/>

    <!-- Panel bg -->
    <rect x="${rsiLayout.padding.left}" y="${(rsiPanelTop + rsiLayout.padding.top)}" width="${rsiLayout.plotW}" height="${rsiPlotH}" fill="rgba(255,255,255,0.01)" rx="2"/>

    <!-- RSI Grid -->
    ${rsiGrid}

    <!-- Overbought line (70) -->
    <line x1="${rsiLayout.padding.left}" y1="${obY.toFixed(1)}" x2="${(width - rsiLayout.padding.right).toFixed(1)}" y2="${obY.toFixed(1)}" class="rsi-ob"/>
    <text x="${(width - rsiLayout.padding.right - 5).toFixed(1)}" y="${(obY + 3).toFixed(1)}" text-anchor="end" class="rsi-label" fill="rgba(239,68,68,0.6)">70</text>

    <!-- Oversold line (30) -->
    <line x1="${rsiLayout.padding.left}" y1="${osY.toFixed(1)}" x2="${(width - rsiLayout.padding.right).toFixed(1)}" y2="${osY.toFixed(1)}" class="rsi-os"/>
    <text x="${(width - rsiLayout.padding.right - 5).toFixed(1)}" y="${(osY + 3).toFixed(1)}" text-anchor="end" class="rsi-label" fill="rgba(34,197,94,0.6)">30</text>

    <!-- Mid line (50) -->
    <line x1="${rsiLayout.padding.left}" y1="${midY.toFixed(1)}" x2="${(width - rsiLayout.padding.right).toFixed(1)}" y2="${midY.toFixed(1)}" class="rsi-bound"/>

    <!-- RSI line -->
    <path d="${rsiPath}" class="rsi-line"/>

    <!-- RSI tooltips -->
    ${rsiTooltips}

    <!-- RSI crosshair -->
    ${rsiCrosshair}

    <!-- Pulsing latest data point -->
    <circle cx="${(rsiLayout.padding.left + rsiLayout.plotW).toFixed(1)}" cy="${(rsiPanelTop + rsiLayout.padding.top + rsiPlotH - ((lastRsi ?? 50 - rsiMin) / (rsiMax - rsiMin)) * rsiPlotH).toFixed(1)}" r="4" class="pulse-dot data-point"/>

    <!-- Label -->
    <text x="${rsiLayout.padding.left.toFixed(1)}" y="${(rsiPanelTop + rsiLayout.height - 8).toFixed(1)}" class="rsi-label">RSI (14)</text>
  </g>

  <!-- Frame counter -->
  <text x="6" y="${(height - 8).toFixed(1)}" class="frame-counter">FRM-${Math.floor(Math.random() * 90000 + 10000)}</text>

${SVG_CLOSE}`;

  return svg;
}

// ── Candlestick Chart ──

/**
 * Generate an inline SVG candlestick chart with volume and EMA overlays.
 * Candlesticks: green body with wick for up candles, red for down.
 * EMA20 (amber), EMA50 (purple) overlay lines.
 *
 * When volumeProfile is provided, renders a horizontal volume profile histogram
 * on the right side of the chart (standard TradingView layout).
 * POC highlighted in cyan, HVN in green, LVN in red.
 */
export function candlestickSvgChart(
  title: string,
  klines: Kline[],
  width = 700,
  height = 400,
  volumeProfile?: {
    poc: number;
    vah: number;
    val: number;
    nodes: Array<{ priceLow: number; priceHigh: number; volumePercent: number; type: string }>;
  },
): string {
  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  const opens = klines.map(k => k.open);

  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const range = max - min || 1;
  const layout = getLayout(width, height);
  // Adjust right padding for volume profile panel
  if (volumeProfile) {
    layout.padding.right = 100;
    layout.plotW = width - layout.padding.left - layout.padding.right;
  }
  const { padding, plotW, plotH } = layout;
  const n = klines.length;

  // ── Candlesticks ──
  const candleWidth = Math.max(2, Math.min(8, (plotW / n) * 0.6));
  const halfWick = Math.max(0.5, candleWidth * 0.15);

  let candleSvg = '';
  let volSvg = '';
  const volumes = klines.map(k => k.volume);
  const maxVol = Math.max(...volumes) || 1;
  const volBarMax = 40;

  for (let i = 0; i < n; i++) {
    const k = klines[i]!;
    const isUp = k.close >= k.open;

    const x = padding.left + (i / (n - 1)) * plotW;
    const openY = padding.top + plotH - ((k.open - min) / range) * plotH;
    const closeY = padding.top + plotH - ((k.close - min) / range) * plotH;
    const highY = padding.top + plotH - ((k.high - min) / range) * plotH;
    const lowY = padding.top + plotH - ((k.low - min) / range) * plotH;

    // Wick (high-low line)
    const wickX = x.toFixed(1);
    const wickClass = isUp ? 'wick-up' : 'wick-down';
    candleSvg += `<line x1="${wickX}" y1="${highY.toFixed(1)}" x2="${wickX}" y2="${lowY.toFixed(1)}" class="${wickClass}"/>\n`;

    // Body (open-close rect)
    const bodyTop = isUp ? closeY : openY;
    const bodyBottom = isUp ? openY : closeY;
    const bodyH = Math.max(1, bodyBottom - bodyTop);
    const candleClass = isUp ? 'candle-up' : 'candle-down';

    candleSvg += `<rect x="${(x - candleWidth / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" class="${candleClass}${i === n - 1 ? ' latest-candle' : ''}">${i === n - 1 ? `<animate attributeName="opacity" values="0;1" dur="0.4s" fill="freeze"/>` : ''}</rect>\n`;

    // Tooltip
    candleSvg += `<rect x="${(x - candleWidth / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${candleWidth.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="transparent" style="pointer-events:visible">
      <title>${formatTime(k.openTime)}
O: ${formatYLabel(k.open)}
H: ${formatYLabel(k.high)}
L: ${formatYLabel(k.low)}
C: ${formatYLabel(k.close)}
Vol: ${(k.volume / 1).toFixed(1)}</title>
    </rect>\n`;

    // Volume bar (matching candle color)
    const volRatio = volumes[i]! / maxVol;
    const barH = volRatio * volBarMax;
    const barY = height - padding.bottom + 5;
    const volClass = isUp ? 'vol-bar-up' : 'vol-bar-down';
    volSvg += `<rect x="${(x - 1).toFixed(1)}" y="${(barY - barH).toFixed(1)}" width="2" height="${barH.toFixed(1)}" class="${volClass}">
      <animate attributeName="height" from="0" to="${barH.toFixed(1)}" dur="0.5s" fill="freeze"/>
      <animate attributeName="y" from="${barY}" to="${(barY - barH).toFixed(1)}" dur="0.5s" fill="freeze"/>
    </rect>\n`;
  }

  // ── EMA overlays ──
  const ema20 = calculateSeriesEma(closes, 20);
  const ema50 = calculateSeriesEma(closes, 50);

  function emaPath(ema: (number | null)[]): string | null {
    let start = -1;
    for (let i = 0; i < ema.length; i++) {
      if (ema[i] != null) { start = i; break; }
    }
    if (start === -1) return null;
    const pts: string[] = [];
    for (let i = start; i < ema.length; i++) {
      const v = ema[i]!;
      const x = padding.left + (i / (n - 1)) * plotW;
      const y = padding.top + plotH - ((v - min) / range) * plotH;
      pts.push(`${i === start ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }

  const ema20Path = emaPath(ema20);
  const ema50Path = emaPath(ema50);

  // ── Crosshair ──
  const lastClose = closes[n - 1] ?? 0;
  const crossX = padding.left + plotW;
  const crossY = padding.top + plotH - ((lastClose - min) / range) * plotH;

  // ── EMA Legend ──
  const legendSvg = `<rect x="${(padding.left + 4).toFixed(1)}" y="${(padding.top + 4).toFixed(1)}" width="120" height="48" rx="4" fill="#0f172a" stroke="#1e293b"/>
  <line x1="${(padding.left + 10).toFixed(1)}" y1="${(padding.top + 16).toFixed(1)}" x2="${(padding.left + 26).toFixed(1)}" y2="${(padding.top + 16).toFixed(1)}" stroke="#f59e0b" stroke-width="1.5"/>
  <text x="${(padding.left + 30).toFixed(1)}" y="${(padding.top + 19).toFixed(1)}" fill="#f59e0b" font-family="'Inter', monospace" font-size="9">EMA20</text>
  <line x1="${(padding.left + 10).toFixed(1)}" y1="${(padding.top + 32).toFixed(1)}" x2="${(padding.left + 26).toFixed(1)}" y2="${(padding.top + 32).toFixed(1)}" stroke="#8b5cf6" stroke-width="1.5"/>
  <text x="${(padding.left + 30).toFixed(1)}" y="${(padding.top + 35).toFixed(1)}" fill="#8b5cf6" font-family="'Inter', monospace" font-size="9">EMA50</text>
  <line x1="${(padding.left + 10).toFixed(1)}" y1="${(padding.top + 46).toFixed(1)}" x2="${(padding.left + 26).toFixed(1)}" y2="${(padding.top + 46).toFixed(1)}" stroke="#22c55e" stroke-width="1.5"/>
  <text x="${(padding.left + 30).toFixed(1)}" y="${(padding.top + 49).toFixed(1)}" fill="#22c55e" font-family="'Inter', monospace" font-size="9">Price</text>
  <rect x="${(padding.left + 10).toFixed(1)}" y="${(padding.top + 38).toFixed(1)}" width="16" height="8" rx="1" fill="rgba(34,197,94,0.7)" stroke="#22c55e"/>
  <text x="${(padding.left + 30).toFixed(1)}" y="${(padding.top + 49).toFixed(1)}" fill="#22c55e" font-family="'Inter', monospace" font-size="9">Price</text>`;

  // ── Volume Profile overlay ──
  let vpSvg = '';
  if (volumeProfile) {
    const vpLeft = padding.left + plotW + 4;
    const vpRight = width - 5;
    const vpWidth = vpRight - vpLeft;

    // Background panel
    vpSvg += `<rect x="${vpLeft.toFixed(1)}" y="${padding.top.toFixed(1)}" width="${vpWidth.toFixed(1)}" height="${plotH.toFixed(1)}" fill="rgba(15,23,42,0.6)" rx="2"/>\n`;

    // Value Area highlight (VAH to VAL)
    const valY = padding.top + plotH - ((volumeProfile.val - min) / range) * plotH;
    const vahY = padding.top + plotH - ((volumeProfile.vah - min) / range) * plotH;
    vpSvg += `<rect x="${vpLeft.toFixed(1)}" y="${valY.toFixed(1)}" width="${vpWidth.toFixed(1)}" height="${Math.max(1, vahY - valY).toFixed(1)}" class="vp-va-area"/>\n`;

    // Volume nodes as horizontal bars
    for (const node of volumeProfile.nodes) {
      const yTop = padding.top + plotH - ((node.priceHigh - min) / range) * plotH;
      const yBot = padding.top + plotH - ((node.priceLow - min) / range) * plotH;
      const barY = yBot;
      const barH = Math.max(1, yTop - yBot);
      const barW = (node.volumePercent / 100) * vpWidth;

      let barClass = 'vp-bar-normal';
      if (node.type === 'hvn') barClass = 'vp-bar-hvn';
      else if (node.type === 'lvn') barClass = 'vp-bar-lvn';

      vpSvg += `<rect x="${vpLeft.toFixed(1)}" y="${barY.toFixed(1)}" width="${Math.max(1, barW).toFixed(1)}" height="${barH.toFixed(1)}" class="${barClass}" />\n`;
    }

    // POC line — cyan dashed
    const pocY = padding.top + plotH - ((volumeProfile.poc - min) / range) * plotH;
    vpSvg += `<line x1="${vpLeft.toFixed(1)}" y1="${pocY.toFixed(1)}" x2="${vpRight.toFixed(1)}" y2="${pocY.toFixed(1)}" class="vp-poc-line"/>\n`;
    vpSvg += `<text x="${(vpLeft + 2).toFixed(1)}" y="${(pocY - 3).toFixed(1)}" class="vp-poc-label">POC ${formatYLabel(volumeProfile.poc)}</text>\n`;

    // VAH / VAL labels
    vpSvg += `<text x="${(vpLeft + 2).toFixed(1)}" y="${(vahY + 11).toFixed(1)}" class="vp-label">VAH</text>\n`;
    vpSvg += `<text x="${(vpLeft + 2).toFixed(1)}" y="${(valY - 3).toFixed(1)}" class="vp-label">VAL</text>\n`;

    // Volume Profile title
    vpSvg += `<text x="${(vpLeft + vpWidth / 2).toFixed(1)}" y="${(padding.top + 12).toFixed(1)}" text-anchor="middle" fill="#64748b" font-family="'Inter', sans-serif" font-size="9">VP</text>\n`;
  }

  const svg = `${svgOpen(width, height, `Candlestick Chart: ${title}`)}
  ${renderTitle(layout, title)}

  <!-- Grid & Y-axis -->
  ${renderYGrid(layout, min, max)}

  <!-- Candlestick bodies & wicks -->
  ${candleSvg}

  <!-- Volume bars -->
  ${volSvg}

  <!-- EMA20 overlay -->
  ${ema20Path ? `<path d="${ema20Path}" class="ema20-line"/>` : ''}

  <!-- EMA50 overlay -->
  ${ema50Path ? `<path d="${ema50Path}" class="ema50-line"/>` : ''}

  <!-- Crosshair at latest candle -->
  <line x1="${crossX.toFixed(1)}" y1="${(padding.top - 5).toFixed(1)}" x2="${crossX.toFixed(1)}" y2="${(padding.top + plotH + 5).toFixed(1)}" class="crosshair-line"/>
  <rect x="${(crossX + 5).toFixed(1)}" y="${(crossY - 10).toFixed(1)}" width="90" height="20" rx="4" class="label-bg"/>
  <text x="${(crossX + 10).toFixed(1)}" y="${(crossY + 3).toFixed(1)}" class="label-text">${formatYLabel(lastClose)}</text>
  <rect x="${(padding.left - 5).toFixed(1)}" y="${(crossY - 10).toFixed(1)}" width="100" height="20" rx="4" class="label-bg"/>
  <text x="${padding.left.toFixed(1)}" y="${(crossY + 3).toFixed(1)}" class="label-text">${formatTime(klines[n - 1]?.openTime ?? 0)}</text>

  <!-- Pulsing latest data point -->
  <circle cx="${crossX.toFixed(1)}" cy="${crossY.toFixed(1)}" r="4" class="pulse-dot data-point"/>

  <!-- Frame counter -->
  <text x="6" y="${(height - 8).toFixed(1)}" class="frame-counter">FRM-${Math.floor(Math.random() * 90000 + 10000)}</text>

  <!-- Min/max markers -->
  ${renderMinMaxMarkers(layout, klines, min, max)}

  <!-- X-axis labels -->
  ${renderXLabels(layout, klines)}

  <!-- EMA Legend -->
  ${legendSvg}

  <!-- Volume Profile -->
  ${vpSvg}

  <!-- Branding -->
  ${renderWatermark(layout)}

${SVG_CLOSE}`;

  return svg;
}

// ── Comparison Chart (multi-token overlay) ──

/**
 * Generate an SVG chart overlaying multiple token price series.
 * Each token gets a different colored line.
 * Prices are normalized to percentage change from start for fair comparison.
 * Dark theme matching existing charts. Y-axis shows percentage change (0% at center).
 */
export function comparisonSvgChart(
  title: string,
  priceMap: Map<string, number[]>, // symbol → close prices
  symbols: string[],               // ordered list to display
  width = 700,
  height = 400,
): string {
  const n = symbols.length;
  if (n === 0 || priceMap.size === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><rect width="200" height="40" fill="#0f172a" rx="4"/><text x="100" y="24" text-anchor="middle" fill="#94a3b8" font-family="\'Inter\', sans-serif" font-size="12">No data</text></svg>';
  }

  // Color palette for tokens — high contrast, colorblind-safe
  const palette = ['#06b6d4', '#f59e0b', '#c084fc', '#34d399', '#fb923c', '#fb7185', '#2dd4bf', '#eab308'];
  const lineColors = new Map<string, string>();
  symbols.forEach((s, i) => lineColors.set(s, palette[i % palette.length]!));

  // Normalize each series to percentage change from first value
  // pctChange[i] = (price[i] - price[0]) / price[0] * 100
  const normalizedMap = new Map<string, number[]>();
  let globalMin = 0;
  let globalMax = 0;

  for (const sym of symbols) {
    const prices = priceMap.get(sym);
    if (!prices || prices.length < 2) continue;
    const base = prices[0]!;
    if (base === 0) continue;
    const pctChanges = prices.map(p => ((p - base) / base) * 100);
    normalizedMap.set(sym, pctChanges);
    const seriesMin = Math.min(...pctChanges);
    const seriesMax = Math.max(...pctChanges);
    if (seriesMin < globalMin) globalMin = seriesMin;
    if (seriesMax > globalMax) globalMax = seriesMax;
  }

  if (normalizedMap.size === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><rect width="200" height="40" fill="#0f172a" rx="4"/><text x="100" y="24" text-anchor="middle" fill="#94a3b8" font-family="\'Inter\', sans-serif" font-size="12">No valid data</text></svg>';
  }

  // Expand range to at least ±5% and round to nice grid values
  const absMax = Math.max(Math.abs(globalMin), Math.abs(globalMax), 5);
  // Round up to next 5% multiple
  const chartMax = Math.ceil(absMax / 5) * 5;

  const padding = { top: 30, right: 20, bottom: 50, left: 60 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const layout: ChartLayout = { padding, width, height, plotW, plotH };

  const yRange = chartMax * 2; // from -chartMax to +chartMax
  const centerY = padding.top + plotH / 2;

  // For each series, compute max data points for x-spacing
  let maxPoints = 0;
  const pathMap = new Map<string, string>();
  const hoverDotsMap = new Map<string, string>();

  for (const sym of symbols) {
    const pctChanges = normalizedMap.get(sym);
    if (!pctChanges || pctChanges.length < 2) continue;
    const seriesLen = pctChanges.length;
    if (seriesLen > maxPoints) maxPoints = seriesLen;
  }

  if (maxPoints < 2) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><rect width="200" height="40" fill="#0f172a" rx="4"/><text x="100" y="24" text-anchor="middle" fill="#94a3b8" font-family="\'Inter\', sans-serif" font-size="12">Insufficient data</text></svg>';
  }

  for (const sym of symbols) {
    const pctChanges = normalizedMap.get(sym);
    if (!pctChanges || pctChanges.length < 2) continue;
    const color = lineColors.get(sym) ?? '#22d3ee';
    const seriesLen = pctChanges.length;

    let path = '';
    let hoverDots = '';
    for (let i = 0; i < seriesLen; i++) {
      const x = padding.left + (i / Math.max(1, maxPoints - 1)) * plotW;
      const y = centerY - (pctChanges[i]! / yRange) * plotH;
      path += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      hoverDots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="data-point" style="pointer-events:visible">
        <title>${escapeXml(sym)}: ${pctChanges[i]!.toFixed(2)}%</title>
      </circle>\n`;
    }

    pathMap.set(sym, path);
    hoverDotsMap.set(sym, hoverDots);
  }

  // ── Y-axis: percentage change grid ──
  let yGridSvg = '';
  const gridLevels: number[] = [];
  for (let v = -chartMax; v <= chartMax; v += 5) {
    gridLevels.push(v);
  }
  if (gridLevels[gridLevels.length - 1] !== chartMax) gridLevels.push(chartMax);

  for (const v of gridLevels) {
    const y = centerY - (v / yRange) * plotH;
    const isCenter = v === 0;
    const cls = isCenter ? 'comp-grid-line-zero' : 'comp-grid-line';
    yGridSvg += `<line x1="${padding.left}" y1="${y.toFixed(1)}" x2="${(width - padding.right).toFixed(1)}" y2="${y.toFixed(1)}" class="${cls}"/>\n`;
    const textFill = v > 0 ? '#475569' : (v < 0 ? '#475569' : '#475569');
    yGridSvg += `<text x="${(padding.left - 8).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" text-anchor="end" class="comp-grid-label" fill="${textFill}">${v >= 0 ? '+' : ''}${v}%</text>\n`;
  }

  // ── Legend (top-right corner) ──
  const legendItemH = 18;
  const legendPad = 6;
  const legendW = 80;
  const legendH = n * legendItemH + legendPad * 2;
  let legendSvg = `<rect x="${(width - padding.right - legendW - 4).toFixed(1)}" y="${(padding.top + 4).toFixed(1)}" width="${legendW}" height="${legendH}" rx="4" fill="rgba(15,23,42,0.85)" stroke="#1e293b"/>\n`;
  for (let i = 0; i < symbols.length; i++) {
    const sym = symbols[i]!;
    const color = lineColors.get(sym) ?? '#22d3ee';
    const ly = padding.top + 4 + legendPad + i * legendItemH;
    legendSvg += `<line x1="${(width - padding.right - legendW - 4 + 8).toFixed(1)}" y1="${(ly + 7).toFixed(1)}" x2="${(width - padding.right - legendW - 4 + 22).toFixed(1)}" y2="${(ly + 7).toFixed(1)}" stroke="${color}" stroke-width="2"/>\n`;
    legendSvg += `<text x="${(width - padding.right - legendW - 4 + 26).toFixed(1)}" y="${(ly + 10).toFixed(1)}" class="comp-legend-text">${escapeXml(sym)}</text>\n`;
  }

  // ── X-axis labels ──
  let xLabelsSvg = '';
  const xLabelCount = 5;
  for (let i = 0; i <= xLabelCount; i++) {
    const x = padding.left + (i / xLabelCount) * plotW;
    const idx = Math.round((i / xLabelCount) * (maxPoints - 1));
    xLabelsSvg += `<text x="${x.toFixed(1)}" y="${(height - padding.bottom + 18).toFixed(1)}" text-anchor="${i === 0 ? 'start' : (i === xLabelCount ? 'end' : 'middle')}" class="axis-label">#${idx + 1}</text>\n`;
  }

  // ── Zero center label ──
  const zeroLabelHtml = `<text x="${(width - padding.right - 4).toFixed(1)}" y="${(centerY + 3.5).toFixed(1)}" text-anchor="end" class="comp-grid-label">0%</text>`;

  const svg = `${svgOpen(width, height, `Comparison Chart: ${title}`)}
  ${renderTitle(layout, title)}

  <!-- Percentage grid -->
  ${yGridSvg}
  ${zeroLabelHtml}

  <!-- Price lines (normalized) + end-of-line labels + glow -->
  ${symbols.map(sym => {
    const path = pathMap.get(sym);
    const color = lineColors.get(sym) ?? '#22d3ee';
    if (!path) return '';
    const pctChanges = normalizedMap.get(sym);
    const lastVal = pctChanges?.[pctChanges.length - 1] ?? 0;
    const lastX = padding.left + plotW;
    const lastY = centerY - ((pctChanges?.[pctChanges.length - 1] ?? 0) / yRange) * plotH;
    const pctSign = lastVal >= 0 ? '+' : '';
    const pctClass = lastVal >= 0 ? 'comp-pct-up' : 'comp-pct-down';
    return `${path ? `<path d="${path}" class="comp-line" stroke="${color}" filter="url(#lineGlow)"/>` : ''}
    <rect x="${(lastX + 4).toFixed(1)}" y="${(lastY - 7).toFixed(1)}" width="50" height="14" rx="3" fill="#0f172a" stroke="${color}" stroke-width="0.5"/>
    <text x="${(lastX + 8).toFixed(1)}" y="${(lastY + 3).toFixed(1)}" fill="${color}" font-family="'Inter', monospace" font-size="9" font-weight="700">${pctSign}${lastVal.toFixed(1)}%</text>
    <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4" class="pulse-dot data-point" fill="${color}"/>`;
  }).filter(Boolean).join('\n')}

  <!-- Hover tooltips -->
  ${symbols.map(sym => hoverDotsMap.get(sym) ?? '').join('\n')}

  <!-- Legend -->
  ${legendSvg}

  <!-- X-axis labels -->
  ${xLabelsSvg}

  <!-- Branding -->
  ${renderWatermark(layout)}

  <!-- Frame counter -->
  <text x="6" y="${(height - 8).toFixed(1)}" class="frame-counter">FRM-${Math.floor(Math.random() * 90000 + 10000)}</text>

${SVG_CLOSE}`;

  return svg;
}
