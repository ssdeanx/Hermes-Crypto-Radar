// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Advanced SVG Visualizations
// ═══════════════════════════════════════════════════════════════════════
//
// Self-contained SVG chart generators for:
//   1. Correlation Heat Map — N×N correlation matrix of token pairs
//   2. Portfolio Performance Dashboard — donut + bar + summary stats
//   3. Market Breadth Gauge — thermometer, sector bars, gainers/losers
//   4. Strategy Performance — win rate gauge, direction breakdown, Sharpe
//
// All charts follow dark-theme (#0f172a bg), use CSS-in-<style> for
// maintainability, viewBox for responsive scaling, role="img" + aria-label
// for accessibility, and <title> tooltips on interactive elements.
// ═══════════════════════════════════════════════════════════════════════

import type { BacktestResult } from '../backtest.js';

// ── Types ──

export interface Holding {
  symbol: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;      // absolute P&L in USD
  pnlPercent: number;
}

export interface MarketMetrics {
  priceChangePercent: number;
  volume: number;
  chain?: string;
}

/** Color and label info for a single donut segment */
interface DonutSegment {
  value: number;
  label: string;
  color: string;
}

// ── Constants ──

const BG = '#0f172a';
const TEXT = '#f1f5f9';
const ACCENT = '#22d3ee';
const SUBTLE = '#64748b';
const MUTED = '#1e293b';
const GRID_LINE = '#1e293b';

// ── Shared utilities ──

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDollar(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

function fmtPct(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

/** Clamp v to [min, max] */
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Interpolate between two hex colors.
 * Each color is a 6-char hex string with optional '#' prefix.
 */
function lerpColor(c1: string, c2: string, t: number): string {
  const a = parseInt(c1.replace('#', ''), 16);
  const b = parseInt(c2.replace('#', ''), 16);
  const r = Math.round(((a >> 16) & 0xff) * (1 - t) + ((b >> 16) & 0xff) * t);
  const g = Math.round(((a >> 8) & 0xff) * (1 - t) + ((b >> 8) & 0xff) * t);
  const bl = Math.round((a & 0xff) * (1 - t) + (b & 0xff) * t);
  return `#${((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0')}`;
}

/**
 * Map a correlation value [-1, 1] to a color.
 * 1.0 → #166534 (dark green)
 * 0.5 → #22c55e (light green)
 * 0.0 → #334155 (neutral)
 * -0.5 → #ef4444 (light red)
 * -1.0 → #991b1b (dark red)
 */
function correlationColor(v: number): string {
  const vv = clamp(v, -1, 1);
  if (vv >= 0) {
    // [0..1] → neutral→light green→dark green
    if (vv <= 0.5) return lerpColor('#334155', '#22c55e', vv / 0.5);
    return lerpColor('#22c55e', '#166534', (vv - 0.5) / 0.5);
  }
  // [-1..0] → dark red → light red → neutral
  const abs = Math.abs(vv);
  if (abs <= 0.5) return lerpColor('#334155', '#ef4444', abs / 0.5);
  return lerpColor('#ef4444', '#991b1b', (abs - 0.5) / 0.5);
}

/** Shared CSS injected into every SVG */
function advancedStyles(): string {
  return `<style>
    .a-bg { fill: #0f172a; }
    .a-title { fill: #f1f5f9; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 14px; font-weight: 700; }
    .a-subtitle { fill: #64748b; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 10px; }
    .a-label { fill: #94a3b8; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 9px; }
    .a-value { fill: #f1f5f9; font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 11px; font-weight: 600; }
    .a-accent { fill: #22d3ee; font-family: 'Inter', monospace; font-size: 10px; font-weight: 600; }
    .a-watermark { fill: rgba(148,163,184,0.2); font-family: 'Inter', system-ui, -apple-system, sans-serif; font-size: 9px; }
    .a-grid-line { stroke: #1e293b; stroke-width: 1; }
    .a-bar-up { fill: rgba(34,197,94,0.7); }
    .a-bar-down { fill: rgba(239,68,68,0.7); }
    .a-up-text { fill: #22c55e; }
    .a-down-text { fill: #ef4444; }
    .a-neutral-text { fill: #94a3b8; }
    .a-stat-box { fill: rgba(30,41,59,0.6); stroke: rgba(148,163,184,0.15); rx: 6; }
    .a-gauge-fill { fill: none; stroke: #22d3ee; stroke-linecap: round; }
    .a-gauge-bg { fill: none; stroke: #1e293b; stroke-linecap: round; }
    .a-donut-hole { fill: #0f172a; }
    .a-tick { stroke: #475569; stroke-width: 1; }
    .a-tick-label { fill: #475569; font-family: 'Inter', monospace; font-size: 8px; }
  </style>`;
}

/** Opening SVG tag with accessibility */
function svgOpen(w: number, h: number, title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" role="img" aria-label="${escapeXml(title)}">\n${advancedStyles()}\n<rect width="${w}" height="${h}" class="a-bg" rx="8"/>`;
}

function svgClose(): string {
  return '</svg>';
}

function renderTitle(w: number, y: number, title: string, subtitle?: string): string {
  let out = `<text x="${(w / 2).toFixed(1)}" y="${y}" text-anchor="middle" class="a-title">${escapeXml(title)}</text>\n`;
  if (subtitle) {
    out += `<text x="${(w / 2).toFixed(1)}" y="${(y + 15).toFixed(1)}" text-anchor="middle" class="a-subtitle">${escapeXml(subtitle)}</text>\n`;
  }
  return out;
}

function renderWatermark(w: number, h: number): string {
  return `<text x="${(w - 8).toFixed(1)}" y="${(h - 8).toFixed(1)}" text-anchor="end" class="a-watermark">🛰️ Hermes Crypto Radar</text>`;
}

// ── 1. Correlation Heat Map ──

/**
 * Generate an SVG correlation heat map.
 *
 * @param tokens  Array of token symbols (e.g. ['BTC', 'ETH', 'SOL', …])
 * @param matrix  N×N correlation matrix values in [-1, 1]
 * @param width   SVG width (default 500)
 * @param height  SVG height (default 500)
 * @returns       Inline SVG string
 */
export function correlationHeatMap(
  tokens: string[],
  matrix: number[][],
  width = 500,
  height = 500,
): string {
  const n = tokens.length;
  if (n === 0) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><text x="100" y="24" text-anchor="middle" fill="#94a3b8" font-size="12">No data</text></svg>';

  const titleH = 50;
  const padding = 16;
  const labelW = 60;  // space for y-axis labels
  const labelH = 20;  // space for x-axis labels (bottom)
  const cellArea = Math.min(width - labelW - padding * 2, height - titleH - labelH - padding * 2);
  const cellSize = cellArea / n;
  const gridW = cellSize * n;
  const gridX = labelW + padding;
  const gridY = titleH + padding;

  // Clip matrix to valid size
  const validMatrix = matrix.slice(0, n).map(row => row.slice(0, n));

  // Determine font size for labels based on cell count
  const labelFontSize = n > 15 ? 7 : n > 10 ? 8 : 10;

  let svg = svgOpen(width, height, 'Token Correlation Matrix');
  svg += renderTitle(width, 20, 'Token Correlation Matrix', `${n} tokens — Pearson correlation`);

  // ── Color legend bar ──
  const legendY = gridY - 12;
  const legendX = gridX;
  const legendW = gridW;
  const legendH = 6;
  // Gradient bar using small rects
  const legendSteps = 20;
  for (let i = 0; i < legendSteps; i++) {
    const t = (i / (legendSteps - 1)) * 2 - 1; // -1 to 1
    const lx = legendX + (i / legendSteps) * legendW;
    const lw = Math.max(1, legendW / legendSteps + 1);
    svg += `<rect x="${lx.toFixed(1)}" y="${legendY}" width="${lw.toFixed(1)}" height="${legendH}" fill="${correlationColor(t)}" />\n`;
  }
  svg += `<text x="${legendX}" y="${(legendY + legendH + 11).toFixed(1)}" class="a-label">-1.0</text>\n`;
  svg += `<text x="${(legendX + legendW / 2).toFixed(1)}" y="${(legendY + legendH + 11).toFixed(1)}" text-anchor="middle" class="a-label">0</text>\n`;
  svg += `<text x="${(legendX + legendW).toFixed(1)}" y="${(legendY + legendH + 11).toFixed(1)}" text-anchor="end" class="a-label">1.0</text>\n`;

  // ── Cells ──
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (c > r) continue; // only show lower triangle for readability
      const v = validMatrix[r]?.[c] ?? 0;
      const x = gridX + c * cellSize;
      const y = gridY + r * cellSize + legendH + 14;
      const color = correlationColor(v);
      svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(cellSize - 1).toFixed(1)}" height="${(cellSize - 1).toFixed(1)}" fill="${color}" rx="1">\n`;
      svg += `  <title>${escapeXml(tokens[r] as string)} / ${escapeXml(tokens[c] as string)}: ${v.toFixed(4)}</title>\n`;
      svg += `</rect>\n`;

      // Value text if cell is large enough
      if (cellSize > 35) {
        const textColor = Math.abs(v) > 0.6 ? '#ffffff' : '#94a3b8';
        svg += `<text x="${(x + cellSize / 2).toFixed(1)}" y="${(y + cellSize / 2 + 3.5).toFixed(1)}" text-anchor="middle" fill="${textColor}" font-family="'Inter', monospace" font-size="${Math.min(9, cellSize * 0.28)}" font-weight="600">${v.toFixed(2)}</text>\n`;
      }
    }
  }

  // ── Y-axis labels (token names on the left) ──
  for (let r = 0; r < n; r++) {
    const y = gridY + r * cellSize + cellSize / 2 + legendH + 14;
    svg += `<text x="${(gridX - 4).toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" dominant-baseline="middle" fill="#f1f5f9" font-family="'Inter', sans-serif" font-size="${labelFontSize}" font-weight="600">${escapeXml(tokens[r] as string)}</text>\n`;
  }

  // ── X-axis labels (token names at the bottom, rotated) ──
  for (let c = 0; c < n; c++) {
    const x = gridX + c * cellSize + cellSize / 2;
    const y = gridY + n * cellSize + legendH + 18;
    svg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="end" transform="rotate(${n > 8 ? 45 : 0}, ${x.toFixed(1)}, ${y.toFixed(1)})" fill="#f1f5f9" font-family="'Inter', sans-serif" font-size="${labelFontSize}" font-weight="600">${escapeXml(tokens[c] as string)}</text>\n`;
  }

  // ── Diagonal dashed line (self-correlation = 1.0) ──
  svg += `<line x1="${gridX}" y1="${(gridY + legendH + 14).toFixed(1)}" x2="${(gridX + gridW).toFixed(1)}" y2="${(gridY + n * cellSize + legendH + 14).toFixed(1)}" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="3,3"/>\n`;

  svg += renderWatermark(width, height);
  svg += svgClose();
  return svg;
}

// ── 2. Portfolio Performance Dashboard ──

/**
 * Generate a portfolio performance SVG dashboard.
 *
 * @param holdings  Array of holdings with symbol, amount, entryPrice, currentPrice, pnl
 * @param prices    Current market prices (symbol → price map)
 * @param pnl       Overall P&L data (totalInvested, currentValue, totalPnl)
 * @param width     SVG width (default 600)
 * @param height    SVG height (default 450)
 */
export function portfolioDashboard(
  holdings: Holding[],
  prices: Record<string, number>,
  pnl: { totalInvested: number; currentValue: number; totalPnl: number },
  width = 600,
  height = 450,
): string {
  if (holdings.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><text x="100" y="24" text-anchor="middle" fill="#94a3b8" font-size="12">No holdings</text></svg>';
  }

  const topMargin = 38;
  const pad = 16;
  const availW = width - pad * 2;
  const availH = height - topMargin - pad;

  // ── Compute best/worst performer ──
  let best = holdings[0]!;
  let worst = holdings[0]!;
  for (const h of holdings) {
    if (h.pnlPercent > best.pnlPercent) best = h;
    if (h.pnlPercent < worst.pnlPercent) worst = h;
  }

  // ── Stats bar ──
  const statsY = topMargin;
  const stats: { label: string; value: string; color: string }[] = [
    { label: 'Invested', value: fmtDollar(pnl.totalInvested), color: TEXT },
    { label: 'Value', value: fmtDollar(pnl.currentValue), color: ACCENT },
    { label: 'Total P&L', value: fmtPct(pnl.totalPnl), color: pnl.totalPnl >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Best', value: best.symbol + ' ' + fmtPct(best.pnlPercent), color: '#22c55e' },
    { label: 'Worst', value: worst.symbol + ' ' + fmtPct(worst.pnlPercent), color: '#ef4444' },
  ];

  let svg = svgOpen(width, height, 'Portfolio Performance Dashboard');
  svg += renderTitle(width, 16, 'Portfolio Performance');

  // Stats boxes
  const boxW = Math.min(100, (availW - 10) / stats.length);
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i]!;
    const bx = pad + i * (boxW + 2);
    svg += `<rect x="${bx.toFixed(1)}" y="${statsY}" width="${boxW.toFixed(1)}" height="38" class="a-stat-box"/>\n`;
    svg += `<text x="${(bx + boxW / 2).toFixed(1)}" y="${(statsY + 14).toFixed(1)}" text-anchor="middle" class="a-label">${escapeXml(s.label)}</text>\n`;
    svg += `<text x="${(bx + boxW / 2).toFixed(1)}" y="${(statsY + 30).toFixed(1)}" text-anchor="middle" fill="${s.color}" font-family="'Inter', monospace" font-size="${boxW > 80 ? '11' : '9'}" font-weight="600">${escapeXml(s.value)}</text>\n`;
  }

  // ── Donut chart (asset allocation) ──
  const donutTop = statsY + 50;
  const donutSize = Math.min(140, availH - 60);
  const donutCX = pad + donutSize / 2 + 10;
  const donutCY = donutTop + donutSize / 2;
  const donutR = donutSize / 2 - 8;
  const donutThick = Math.max(18, donutR * 0.45);

  // Sort holdings by current value descending
  const sorted = [...holdings].sort((a, b) => (a.amount * a.currentPrice) - (b.amount * b.currentPrice));
  const totalValue = holdings.reduce((s, h) => s + h.amount * h.currentPrice, 0) || 1;

  const donutColors = ['#22d3ee', '#22c55e', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];
  const segments: DonutSegment[] = sorted.map((h, i) => ({
    value: (h.amount * h.currentPrice) / totalValue,
    label: h.symbol,
    color: donutColors[i % donutColors.length]!,
  }));

  // Donut using stroke-dasharray technique
  const circumference = 2 * Math.PI * donutR;
  let dashOffset = 0;

  // Background circle
  svg += `<circle cx="${donutCX.toFixed(1)}" cy="${donutCY.toFixed(1)}" r="${donutR.toFixed(1)}" class="a-donut-hole" stroke="#1e293b" stroke-width="${donutThick.toFixed(1)}" fill="none"/>\n`;

  for (const seg of segments) {
    const segLen = seg.value * circumference;
    if (segLen < 0.5) continue; // skip tiny segments for dasharray
    svg += `<circle cx="${donutCX.toFixed(1)}" cy="${donutCY.toFixed(1)}" r="${donutR.toFixed(1)}" fill="none" stroke="${seg.color}" stroke-width="${donutThick.toFixed(1)}" stroke-dasharray="${segLen.toFixed(1)} ${(circumference - segLen).toFixed(1)}" stroke-dashoffset="${(-dashOffset).toFixed(1)}" transform="rotate(-90, ${donutCX.toFixed(1)}, ${donutCY.toFixed(1)})">\n`;
    svg += `  <title>${seg.label}: ${(seg.value * 100).toFixed(1)}%</title>\n`;
    svg += `</circle>\n`;
    dashOffset += segLen;
  }

  // Center hole label
  svg += `<text x="${donutCX.toFixed(1)}" y="${(donutCY - 4).toFixed(1)}" text-anchor="middle" fill="${TEXT}" font-family="'Inter', sans-serif" font-size="12" font-weight="700">${holdings.length}</text>\n`;
  svg += `<text x="${donutCX.toFixed(1)}" y="${(donutCY + 10).toFixed(1)}" text-anchor="middle" class="a-label">Assets</text>\n`;

  // ── Donut legend ──
  const legendX = donutCX + donutSize / 2 + 16;
  let legendY2 = donutTop + 4;
  for (const seg of segments) {
    if (legendY2 > donutTop + donutSize - 6) break;
    svg += `<rect x="${legendX}" y="${legendY2}" width="8" height="8" rx="1" fill="${seg.color}"/>\n`;
    svg += `<text x="${(legendX + 12).toFixed(1)}" y="${(legendY2 + 7).toFixed(1)}" class="a-label">${escapeXml(seg.label)} <tspan fill="${TEXT}" font-weight="600">${(seg.value * 100).toFixed(1)}%</tspan></text>\n`;
    legendY2 += 16;
  }

  // ── P&L Bar Chart ──
  const barLeft = pad;
  const barTop = donutTop + donutSize + 20;
  const barW = availW;
  const barH = height - barTop - pad - 16;
  const barAreaH = barH - 16;

  if (holdings.length > 0) {
    const maxAbsPnl = Math.max(Math.abs(Math.min(...holdings.map(h => h.pnl))), Math.max(...holdings.map(h => h.pnl)), 1);
    const barCount = holdings.length;
    const barSpacing = Math.min(8, (barW - 10) / barCount / 4);
    const singleBarW = Math.max(6, (barW - barSpacing * (barCount + 1)) / barCount);

    // Y-axis labels
    svg += `<text x="${(barLeft + 2).toFixed(1)}" y="${(barTop + 10).toFixed(1)}" class="a-label">P&amp;L</text>\n`;
    svg += `<text x="${(barLeft + 2).toFixed(1)}" y="${(barTop + barAreaH + 12).toFixed(1)}" class="a-label">${fmtDollar(-maxAbsPnl)}</text>\n`;
    svg += `<text x="${(barLeft + 2).toFixed(1)}" y="${(barTop + barAreaH / 2 + 10).toFixed(1)}" class="a-label">0</text>\n`;

    // Zero line
    const zeroY = barTop + barAreaH / 2;
    svg += `<line x1="${(barLeft + 30).toFixed(1)}" y1="${zeroY.toFixed(1)}" x2="${(barLeft + barW).toFixed(1)}" y2="${zeroY.toFixed(1)}" class="a-grid-line"/>\n`;

    for (let i = 0; i < barCount; i++) {
      const h = holdings[i]!;
      const barX = barLeft + 34 + i * (singleBarW + barSpacing);
      const isUp = h.pnl >= 0;
      const barHt = (Math.abs(h.pnl) / maxAbsPnl) * (barAreaH / 2);
      const barY2 = isUp ? zeroY - barHt : zeroY;

      svg += `<rect x="${barX.toFixed(1)}" y="${barY2.toFixed(1)}" width="${singleBarW.toFixed(1)}" height="${Math.max(1, barHt).toFixed(1)}" class="${isUp ? 'a-bar-up' : 'a-bar-down'}" rx="1">\n`;
      svg += `  <title>${escapeXml(h.symbol)}: ${fmtDollar(h.pnl)} (${fmtPct(h.pnlPercent)})</title>\n`;
      svg += `</rect>\n`;

      // Label below bar
      if (singleBarW > 8) {
        svg += `<text x="${(barX + singleBarW / 2).toFixed(1)}" y="${(zeroY + 14).toFixed(1)}" text-anchor="middle" class="a-label" font-size="7">${escapeXml(h.symbol)}</text>\n`;
      }
    }
  }

  svg += renderWatermark(width, height);
  svg += svgClose();
  return svg;
}

// ── 3. Market Breadth Gauge ──

/**
 * Generate a market breadth SVG dashboard.
 *
 * @param tokens  Array of token symbols
 * @param metrics Map of symbol → MarketMetrics (priceChangePercent, volume, chain)
 * @param width   SVG width (default 600)
 * @param height  SVG height (default 500)
 */
export function marketBreadthGauge(
  tokens: string[],
  metrics: Record<string, MarketMetrics>,
  width = 600,
  height = 500,
): string {
  if (tokens.length === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><text x="100" y="24" text-anchor="middle" fill="#94a3b8" font-size="12">No data</text></svg>';
  }

  const pad = 16;
  const topMargin = 40;

  // Compute stats
  const changeVals = tokens.map(t => metrics[t]?.priceChangePercent ?? 0);
  const upCount = changeVals.filter(v => v >= 0).length;
  const downCount = changeVals.filter(v => v < 0).length;
  const upPct = tokens.length > 0 ? (upCount / tokens.length) * 100 : 0;

  // Chain breakdown
  const chainChanges = new Map<string, number[]>();
  for (const t of tokens) {
    const m = metrics[t];
    if (!m) continue;
    const chain = m.chain ?? 'Other';
    if (!chainChanges.has(chain)) chainChanges.set(chain, []);
    chainChanges.get(chain)!.push(m.priceChangePercent);
  }
  const chainAvg: { name: string; avg: number }[] = [];
  for (const [name, vals] of chainChanges) {
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    chainAvg.push({ name, avg });
  }

  // Top/bottom 5 by change
  const sortedByChange = [...tokens]
    .map(t => ({ symbol: t, change: metrics[t]?.priceChangePercent ?? 0 }))
    .sort((a, b) => b.change - a.change);
  const top5 = sortedByChange.slice(0, 5);
  const bottom5 = sortedByChange.slice(-5).reverse();

  // Volume concentration
  const volumeSorted = [...tokens]
    .map(t => ({ symbol: t, volume: metrics[t]?.volume ?? 0 }))
    .filter(v => v.volume > 0)
    .sort((a, b) => b.volume - a.volume);
  const totalVol = volumeSorted.reduce((s, v) => s + v.volume, 0) || 1;
  const top3Vol = volumeSorted.slice(0, 3);

  let svg = svgOpen(width, height, 'Market Breadth Dashboard');
  svg += renderTitle(width, 16, 'Market Breadth', `${tokens.length} tokens tracked`);

  // ── Thermometer-style gauge ──
  const gaugeCX = 100;
  const gaugeTop = topMargin + 10;
  const gaugeH = 140;
  const gaugeW = 24;

  // Background track
  svg += `<rect x="${(gaugeCX - gaugeW / 2).toFixed(1)}" y="${gaugeTop}" width="${gaugeW}" height="${gaugeH}" rx="${gaugeW / 2}" fill="#1e293b"/>\n`;

  // Fill: height proportional to up%
  const fillH = (upPct / 100) * gaugeH;
  const fillTop = gaugeTop + gaugeH - fillH;
  // Green gradient fill
  const gradientId = 'gaugeGrad';
  svg += `<defs>\n<linearGradient id="${gradientId}" x1="0" y1="1" x2="0" y2="0">\n<stop offset="0%" stop-color="#22c55e" stop-opacity="0.9"/>\n<stop offset="100%" stop-color="#22d3ee"/>\n</linearGradient>\n</defs>\n`;
  svg += `<rect x="${(gaugeCX - gaugeW / 2 + 2).toFixed(1)}" y="${fillTop.toFixed(1)}" width="${(gaugeW - 4).toFixed(1)}" height="${Math.max(1, fillH).toFixed(1)}" rx="${(gaugeW - 4) / 2}" fill="url(#${gradientId})"/>\n`;

  // Bulb at bottom
  svg += `<circle cx="${gaugeCX}" cy="${(gaugeTop + gaugeH).toFixed(1)}" r="${(gaugeW / 2 + 2)}" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>\n`;
  svg += `<circle cx="${gaugeCX}" cy="${(gaugeTop + gaugeH).toFixed(1)}" r="${(gaugeW / 2 - 2)}" fill="${upPct >= 50 ? '#22c55e' : '#ef4444'}"/>\n`;

  // Percentage text
  svg += `<text x="${gaugeCX}" y="${(gaugeTop - 6).toFixed(1)}" text-anchor="middle" fill="${TEXT}" font-family="'Inter', sans-serif" font-size="12" font-weight="700">${upPct.toFixed(0)}% Up</text>\n`;

  // Gauge labels
  svg += `<text x="${(gaugeCX + gaugeW / 2 + 8).toFixed(1)}" y="${(gaugeTop + 8).toFixed(1)}" class="a-label">100%</text>\n`;
  svg += `<text x="${(gaugeCX + gaugeW / 2 + 8).toFixed(1)}" y="${(gaugeTop + gaugeH - 2).toFixed(1)}" class="a-label">0%</text>\n`;
  svg += `<text x="${(gaugeCX).toFixed(1)}" y="${(gaugeTop + gaugeH + 22).toFixed(1)}" text-anchor="middle" class="a-label">Bullish <tspan class="a-up-text">${upCount}</tspan> / Bearish <tspan class="a-down-text">${downCount}</tspan></text>\n`;

  // ── Sector breakdown bar ──
  const sectorLeft = 190;
  const sectorTop = gaugeTop;
  const sectorW = width - sectorLeft - pad;
  const sectorLabelW = 60;

  svg += `<text x="${sectorLeft}" y="${(sectorTop + 10).toFixed(1)}" class="a-title" font-size="11">Sector Performance</text>\n`;

  const sectorColors: Record<string, string> = {
    Solana: '#22d3ee',
    Polygon: '#8b5cf6',
    Cosmos: '#f59e0b',
    Ethereum: '#627eea',
    SUI: '#5bc9d6',
    Aptos: '#00bfa5',
    Sei: '#8b0000',
    Injective: '#00bcd4',
    BSC: '#f0b90b',
    Other: '#64748b',
  };

  // Horiz bar segments
  const maxAbsChain = Math.max(...chainAvg.map(c => Math.abs(c.avg)), 1);
  const barSegY = sectorTop + 18;
  const barSegH = 16;
  let barSegX = sectorLeft;

  for (const ch of chainAvg) {
    const segW = Math.max(20, (Math.abs(ch.avg) / maxAbsChain) * (sectorW - sectorLabelW));
    const color = sectorColors[ch.name] ?? '#64748b';
    svg += `<rect x="${barSegX.toFixed(1)}" y="${barSegY}" width="${segW.toFixed(1)}" height="${barSegH}" fill="${color}" rx="2" opacity="${ch.avg >= 0 ? '0.8' : '0.5'}">\n`;
    svg += `  <title>${escapeXml(ch.name)}: ${fmtPct(ch.avg)}</title>\n`;
    svg += `</rect>\n`;
    svg += `<text x="${(barSegX + segW + 4).toFixed(1)}" y="${(barSegY + barSegH - 3).toFixed(1)}" class="a-label" font-size="8">${escapeXml(ch.name)} ${fmtPct(ch.avg)}</text>\n`;
    barSegX += segW + 6;
    if (barSegX > width - pad - 20) break;
  }

  // Legend for sector colors (compact)
  let legY = barSegY + 28;
  let legX = sectorLeft;
  // Pick unique chains that have assigned colors
  const uniqueChains = chainAvg.map(c => c.name);
  for (const chName of uniqueChains) {
    const color = sectorColors[chName] ?? '#64748b';
    svg += `<rect x="${legX}" y="${legY}" width="6" height="6" rx="1" fill="${color}"/>\n`;
    svg += `<text x="${(legX + 9).toFixed(1)}" y="${(legY + 5).toFixed(1)}" class="a-label" font-size="7">${escapeXml(chName)}</text>\n`;
    legX += 55;
    if (legX > width - pad - 20) { legX = sectorLeft; legY += 12; }
  }

  // ── Top/Bottom 5 Gainers/Losers ──
  const listTop = gaugeTop + gaugeH + 50;

  // Gainers (left)
  svg += `<text x="${pad}" y="${(listTop + 10).toFixed(1)}" class="a-title" font-size="11">🏆 Top Gainers</text>\n`;
  for (let i = 0; i < top5.length; i++) {
    const item = top5[i]!;
    const ly = listTop + 18 + i * 16;
    svg += `<text x="${pad}" y="${ly.toFixed(1)}" class="a-label">${i + 1}. ${escapeXml(item.symbol)}</text>\n`;
    svg += `<text x="${(pad + 100).toFixed(1)}" y="${ly.toFixed(1)}" class="a-up-text" font-family="'Inter', monospace" font-size="9">${fmtPct(item.change)}</text>\n`;
  }

  // Losers (right half)
  const losX = width / 2;
  svg += `<text x="${losX}" y="${(listTop + 10).toFixed(1)}" class="a-title" font-size="11">🐻 Top Losers</text>\n`;
  for (let i = 0; i < bottom5.length; i++) {
    const item = bottom5[i]!;
    const ly = listTop + 18 + i * 16;
    svg += `<text x="${losX}" y="${ly.toFixed(1)}" class="a-label">${i + 1}. ${escapeXml(item.symbol)}</text>\n`;
    svg += `<text x="${(losX + 100).toFixed(1)}" y="${ly.toFixed(1)}" class="a-down-text" font-family="'Inter', monospace" font-size="9">${fmtPct(item.change)}</text>\n`;
  }

  // ── Volume concentration donut (bottom-right area) ──
  const volDonutCX = width - pad - 50;
  const volDonutCY = listTop + 90;
  const volDonutR = 30;
  const volThick = 10;

  if (top3Vol.length > 0) {
    const volCirc = 2 * Math.PI * volDonutR;
    const remainingVol = totalVol - top3Vol.reduce((s, v) => s + v.volume, 0);
    const volSegments: DonutSegment[] = [
      ...top3Vol.map((v, i) => ({ value: v.volume / totalVol, label: v.symbol, color: donutColors[i % donutColors.length]! })),
    ];
    if (remainingVol > 0) {
      volSegments.push({ value: remainingVol / totalVol, label: 'Others', color: '#334155' });
    }

    svg += `<text x="${volDonutCX}" y="${(volDonutCY - volDonutR - 14).toFixed(1)}" text-anchor="middle" class="a-title" font-size="10">Volume</text>\n`;

    // Background circle
    svg += `<circle cx="${volDonutCX.toFixed(1)}" cy="${volDonutCY.toFixed(1)}" r="${volDonutR.toFixed(1)}" fill="none" stroke="#1e293b" stroke-width="${volThick.toFixed(1)}"/>\n`;

    let vo = 0;
    for (const seg of volSegments) {
      const segLen = seg.value * volCirc;
      if (segLen < 0.5) continue;
      svg += `<circle cx="${volDonutCX.toFixed(1)}" cy="${volDonutCY.toFixed(1)}" r="${volDonutR.toFixed(1)}" fill="none" stroke="${seg.color}" stroke-width="${volThick.toFixed(1)}" stroke-dasharray="${segLen.toFixed(1)} ${(volCirc - segLen).toFixed(1)}" stroke-dashoffset="${(-vo).toFixed(1)}" transform="rotate(-90, ${volDonutCX.toFixed(1)}, ${volDonutCY.toFixed(1)})">\n`;
      svg += `  <title>${escapeXml(seg.label)}: ${(seg.value * 100).toFixed(1)}% of volume</title>\n`;
      svg += `</circle>\n`;
      vo += segLen;
    }

    // Center text
    svg += `<text x="${volDonutCX.toFixed(1)}" y="${(volDonutCY - 3).toFixed(1)}" text-anchor="middle" fill="${TEXT}" font-family="'Inter', sans-serif" font-size="10" font-weight="700">${fmtDollar(top3Vol[0]?.volume ?? 0)}</text>\n`;
    svg += `<text x="${volDonutCX.toFixed(1)}" y="${(volDonutCY + 9).toFixed(1)}" text-anchor="middle" class="a-label" font-size="7">top vol</text>\n`;

    // Mini legend next to donut
    let vlY = volDonutCY - volDonutR + 2;
    const vlX = volDonutCX + volDonutR + 10;
    for (const seg of volSegments) {
      svg += `<rect x="${vlX}" y="${vlY}" width="6" height="6" rx="1" fill="${seg.color}"/>\n`;
      svg += `<text x="${(vlX + 9).toFixed(1)}" y="${(vlY + 5).toFixed(1)}" class="a-label" font-size="7">${escapeXml(seg.label)} ${(seg.value * 100).toFixed(0)}%</text>\n`;
      vlY += 14;
      if (vlY > volDonutCY + volDonutR - 4) break;
    }
  }

  svg += renderWatermark(width, height);
  svg += svgClose();
  return svg;
}

// ── Helpers for strategy performance ──

// Shared donut colors array
const donutColors = ['#22d3ee', '#22c55e', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#a855f7', '#ec4899', '#14b8a6', '#eab308'];

// ── 4. Strategy Performance Chart ──

/**
 * Generate a strategy performance SVG chart.
 *
 * @param result  BacktestResult from backtest.ts
 * @param width   SVG width (default 500)
 * @param height  SVG height (default 400)
 */
export function strategyPerformance(
  result: BacktestResult,
  width = 500,
  height = 400,
): string {
  if (result.totalSignals === 0) {
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 40"><text x="100" y="24" text-anchor="middle" fill="#94a3b8" font-size="12">No signals</text></svg>';
  }

  const pad = 16;
  const topMargin = 38;

  let svg = svgOpen(width, height, 'Signal Strategy Performance');
  svg += renderTitle(width, 16, 'Signal Strategy Performance', `${result.symbol} — ${result.totalSignals} signals`);

  // ── Semi-circle speedometer (Win Rate gauge) ──
  const gaugeCX = 110;
  const gaugeCY = topMargin + 80;
  const gaugeR = 60;
  const gaugeThick = 16;

  // Background arc (180° sweep)
  const bgArc = `<path d="${describeArc(gaugeCX, gaugeCY, gaugeR, 180, 0)}" class="a-gauge-bg" stroke-width="${gaugeThick}"/>\n`;

  // Colored arc segments
  const gaugeVal = result.winRate; // 0-1
  const sweepDeg = gaugeVal * 180; // 0°–180° from bottom

  // Gradient for the gauge arc
  const gaugeGradId = 'wrGrad';
  svg += `<defs>\n<linearGradient id="${gaugeGradId}" x1="0" y1="0" x2="1" y2="0">\n<stop offset="0%" stop-color="#ef4444"/>\n<stop offset="50%" stop-color="#f59e0b"/>\n<stop offset="100%" stop-color="#22c55e"/>\n</linearGradient>\n</defs>\n`;

  svg += bgArc;
  // Foreground arc
  if (sweepDeg > 1) {
    svg += `<path d="${describeArc(gaugeCX, gaugeCY, gaugeR, 180, 180 - sweepDeg)}" fill="none" stroke="url(#${gaugeGradId})" stroke-width="${gaugeThick}" stroke-linecap="round"/>\n`;
  }

  // Tick marks
  for (const tickVal of [0, 0.25, 0.5, 0.75, 1.0]) {
    const angle = 180 - tickVal * 180;
    const rad = (angle * Math.PI) / 180;
    const innerR = gaugeR - gaugeThick / 2 - 4;
    const outerR = gaugeR + 4;
    const ix = gaugeCX + innerR * Math.cos(rad);
    const iy = gaugeCY - innerR * Math.sin(rad);
    const ox = gaugeCX + outerR * Math.cos(rad);
    const oy = gaugeCY - outerR * Math.sin(rad);
    svg += `<line x1="${ix.toFixed(1)}" y1="${iy.toFixed(1)}" x2="${ox.toFixed(1)}" y2="${oy.toFixed(1)}" class="a-tick"/>\n`;
    // Label
    const labelR = gaugeR + 12;
    const lx = gaugeCX + labelR * Math.cos(rad);
    const ly = gaugeCY - labelR * Math.sin(rad);
    svg += `<text x="${lx.toFixed(1)}" y="${(ly + 2).toFixed(1)}" text-anchor="middle" class="a-tick-label">${(tickVal * 100).toFixed(0)}%</text>\n`;
  }

  // Needle
  const needleAngle = 180 - sweepDeg;
  const needleRad = (needleAngle * Math.PI) / 180;
  const needleLen = gaugeR - 6;
  const nx = gaugeCX + needleLen * Math.cos(needleRad);
  const ny = gaugeCY - needleLen * Math.sin(needleRad);
  svg += `<line x1="${gaugeCX}" y1="${gaugeCY}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="#22d3ee" stroke-width="2" stroke-linecap="round"/>\n`;
  svg += `<circle cx="${gaugeCX}" cy="${gaugeCY}" r="4" fill="#22d3ee"/>\n`;

  // Center win rate value
  svg += `<text x="${gaugeCX}" y="${(gaugeCY + gaugeR + 20).toFixed(1)}" text-anchor="middle" fill="${TEXT}" font-family="'Inter', sans-serif" font-size="14" font-weight="700">${(result.winRate * 100).toFixed(1)}%</text>\n`;
  svg += `<text x="${gaugeCX}" y="${(gaugeCY + gaugeR + 32).toFixed(1)}" text-anchor="middle" class="a-label">Win Rate</text>\n`;
  svg += `<text x="${gaugeCX}" y="${(gaugeCY + gaugeR + 44).toFixed(1)}" text-anchor="middle" class="a-label">${result.wins}/${result.totalSignals}</text>\n`;

  // ── Per-direction breakdown bars (right side) ──
  const dirLeft = 200;
  const dirTop = topMargin + 10;
  const dirBarW = Math.min(16, (width - dirLeft - pad - 40) / 4);

  svg += `<text x="${dirLeft}" y="${(dirTop + 10).toFixed(1)}" class="a-title" font-size="11">Direction Breakdown</text>\n`;

  const directions: { key: keyof typeof result.byDirection; label: string; color: string }[] = [
    { key: 'strong_buy', label: 'Str Buy', color: '#22c55e' },
    { key: 'buy', label: 'Buy', color: '#16a34a' },
    { key: 'sell', label: 'Sell', color: '#dc2626' },
    { key: 'strong_sell', label: 'Str Sell', color: '#991b1b' },
  ];

  // Find max for scaling
  const maxDir = Math.max(
    1,
    ...directions.map(d => result.byDirection[d.key]?.total ?? 0),
  );
  const dirChartH = 80;
  const dirChartY = dirTop + 20;

  // Bars
  for (let i = 0; i < directions.length; i++) {
    const d = directions[i]!;
    const stats = result.byDirection[d.key];
    if (!stats || stats.total === 0) continue;

    const bx = dirLeft + i * 45;
    const barHt = (stats.total / maxDir) * dirChartH;
    const by = dirChartY + dirChartH - barHt;
    const winPct = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0;

    svg += `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${dirBarW.toFixed(1)}" height="${Math.max(1, barHt).toFixed(1)}" fill="${d.color}" opacity="0.8" rx="2">\n`;
    svg += `  <title>${escapeXml(d.label)}: ${stats.wins}/${stats.total} wins, avg ${fmtPct(stats.avgReturn)}</title>\n`;
    svg += `</rect>\n`;

    // Win rate overlay line on each bar
    const winY = dirChartY + dirChartH - (winPct / 100) * dirChartH;
    svg += `<line x1="${bx.toFixed(1)}" y1="${winY.toFixed(1)}" x2="${(bx + dirBarW).toFixed(1)}" y2="${winY.toFixed(1)}" stroke="#f1f5f9" stroke-width="1" stroke-dasharray="2,1"/>\n`;

    // Label
    svg += `<text x="${(bx + dirBarW / 2).toFixed(1)}" y="${(dirChartY + dirChartH + 12).toFixed(1)}" text-anchor="middle" class="a-label" font-size="7">${escapeXml(d.label)}</text>\n`;
    svg += `<text x="${(bx + dirBarW / 2).toFixed(1)}" y="${(dirChartY + dirChartH + 22).toFixed(1)}" text-anchor="middle" class="a-label" font-size="7">${stats.total}</text>\n`;
  }

  // ── Sharpe Ratio indicator ──
  const sharpeTop = dirTop + 130;
  svg += `<text x="${dirLeft}" y="${(sharpeTop + 10).toFixed(1)}" class="a-title" font-size="11">Sharpe Ratio</text>\n`;

  const sharpeVal = result.sharpeRatio;
  let sharpeColor: string;
  let sharpeLabel: string;
  if (sharpeVal >= 2) { sharpeColor = '#22c55e'; sharpeLabel = 'Excellent'; }
  else if (sharpeVal >= 1) { sharpeColor = '#16a34a'; sharpeLabel = 'Very Good'; }
  else if (sharpeVal >= 0.5) { sharpeColor = '#f59e0b'; sharpeLabel = 'Good'; }
  else if (sharpeVal >= 0) { sharpeColor = '#f97316'; sharpeLabel = 'Fair'; }
  else { sharpeColor = '#ef4444'; sharpeLabel = 'Poor'; }

  // Horizontal bar for Sharpe
  const sharpeBarW = width - dirLeft - pad - 20;
  const sharpeMax = 4;
  const sharpeRatio = clamp(sharpeVal / sharpeMax, 0, 1);
  const sharpeBarY = sharpeTop + 18;
  const sharpeBarH = 14;

  // Background
  svg += `<rect x="${dirLeft}" y="${sharpeBarY}" width="${sharpeBarW.toFixed(1)}" height="${sharpeBarH}" rx="${sharpeBarH / 2}" fill="#1e293b"/>\n`;

  // Multi-color background sections
  const shSegments = [
    { end: 0.25, color: '#991b1b' },
    { end: 0.5, color: '#ef4444' },
    { end: 0.75, color: '#f59e0b' },
    { end: 1.0, color: '#22c55e' },
  ];
  for (const seg of shSegments) {
    const segW = seg.end * sharpeBarW;
    svg += `<rect x="${dirLeft}" y="${sharpeBarY}" width="${segW.toFixed(1)}" height="${sharpeBarH}" rx="${sharpeBarH / 2}" fill="${seg.color}" opacity="0.3"/>\n`;
  }

  // Actual value indicator
  if (sharpeRatio > 0.01) {
    const shX = dirLeft + sharpeRatio * sharpeBarW;
    svg += `<rect x="${dirLeft}" y="${sharpeBarY}" width="${(shX - dirLeft).toFixed(1)}" height="${sharpeBarH}" rx="${sharpeBarH / 2}" fill="${sharpeColor}" opacity="0.7"/>\n`;
  }

  // Value label
  svg += `<text x="${(dirLeft + sharpeBarW + 8).toFixed(1)}" y="${(sharpeBarY + 11).toFixed(1)}" fill="${sharpeColor}" font-family="'Inter', monospace" font-size="11" font-weight="700">${sharpeVal.toFixed(2)}</text>\n`;
  svg += `<text x="${(dirLeft + sharpeBarW + 8).toFixed(1)}" y="${(sharpeBarY + 22).toFixed(1)}" fill="${sharpeColor}" font-family="'Inter', sans-serif" font-size="8">${sharpeLabel}</text>\n`;

  // ── Max Drawdown ──
  const ddTop = sharpeTop + 56;
  svg += `<text x="${dirLeft}" y="${(ddTop + 10).toFixed(1)}" class="a-title" font-size="11">Max Drawdown</text>\n`;

  const ddVal = result.maxDrawdown;
  const ddAbs = Math.abs(ddVal);
  const ddColor = ddAbs > 15 ? '#ef4444' : ddAbs > 8 ? '#f59e0b' : '#22c55e';

  svg += `<text x="${dirLeft}" y="${(ddTop + 32).toFixed(1)}" fill="${ddColor}" font-family="'Inter', monospace" font-size="18" font-weight="700">-${ddAbs.toFixed(1)}%</text>\n`;
  svg += `<text x="${dirLeft}" y="${(ddTop + 46).toFixed(1)}" class="a-label">Peak-to-trough decline</text>\n`;

  // ── Summary stats at bottom-left ──
  const sumLeft = pad;
  const sumTop = height - pad - 36;
  const sumData = [
    { label: 'Total Return', value: fmtPct(result.totalReturn), color: result.totalReturn >= 0 ? '#22c55e' : '#ef4444' },
    { label: 'Avg Return', value: fmtPct(result.avgReturn), color: result.avgReturn >= 0 ? '#22c55e' : '#ef4444' },
  ];

  for (let i = 0; i < sumData.length; i++) {
    const s = sumData[i]!;
    const sx = sumLeft + i * 120;
    svg += `<text x="${sx}" y="${(sumTop + 2).toFixed(1)}" class="a-label">${escapeXml(s.label)}</text>\n`;
    svg += `<text x="${sx}" y="${(sumTop + 18).toFixed(1)}" fill="${s.color}" font-family="'Inter', monospace" font-size="13" font-weight="700">${escapeXml(s.value)}</text>\n`;
  }

  svg += renderWatermark(width, height);
  svg += svgClose();
  return svg;
}

// ── Arc path helper for semi-circle gauge ──

/**
 * Describe an SVG arc path.
 * Sweeps from `startAngle` to `startAngle - sweep` (clockwise).
 * Angles in degrees; 0° = 3 o'clock, 90° = 6 o'clock, etc.
 */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  sweep: number,
): string {
  const startRad = ((startAngle - 90) * Math.PI) / 180;
  const endAngle = startAngle - sweep;
  const endRad = ((endAngle - 90) * Math.PI) / 180;

  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);

  const largeArc = sweep > 180 ? 1 : 0;

  return `M${x1.toFixed(1)},${y1.toFixed(1)} A${r.toFixed(1)},${r.toFixed(1)} 0 ${largeArc} 1 ${x2.toFixed(1)},${y2.toFixed(1)}`;
}
