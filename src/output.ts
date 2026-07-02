// ═══════════════════════════════════════════════════════════════════════
// Hermes Crypto Radar — Output Formatters
// ═══════════════════════════════════════════════════════════════════════

import type { EnrichedTicker, OutputFormat, TokenSignal, NewsMatch, TechnicalIndicators } from './types.js';
import type { AggregatedSignal } from './analysis/strategies.js';

// ── CSV ──

export const CSV_HEADER = 'run_id,ts_utc,date_et,symbol,chain,lastPrice,bidPrice,bidQty,askPrice,askQty,spreadPct,openPrice,highPrice,lowPrice,prevClosePrice,priceChangePercent,weightedAvgPrice,priceChange,volume,quoteVolume,count,lastQty,vwapDistPct,rangePosPct,bookImbalance,volVsAvg,obv,momentum,alerts,openTime,closeTime,source';

export function toCSV(ticker: EnrichedTicker): string {
  const f = (v: number | null | undefined, d = 8) => {
    if (v == null || !Number.isFinite(v)) return '';
    return v.toFixed(d).replace(/0+$/, '').replace(/\.$/, '');
  };
  const parts = [
    ticker.runId,
    ticker.tsUtc,
    ticker.dateEt,
    ticker.symbol,
    ticker.chain,
    f(ticker.lastPrice),
    f(ticker.bidPrice),
    f(ticker.bidQty),
    f(ticker.askPrice),
    f(ticker.askQty),
    f(ticker.spreadPct, 4),
    f(ticker.openPrice),
    f(ticker.highPrice),
    f(ticker.lowPrice),
    f(ticker.prevClosePrice),
    f(ticker.priceChangePercent, 2),
    f(ticker.weightedAvgPrice),
    f(ticker.priceChange),
    f(ticker.volume),
    f(ticker.quoteVolume, 2),
    ticker.count.toString(),
    f(ticker.lastQty),
    f(ticker.vwapDistPct, 2),
    f(ticker.rangePosPct, 4),
    f(ticker.bookImbalance, 4),
    f(ticker.volVsAvg, 2),
    f(ticker.obv, 2),
    f(ticker.momentum, 2),
    ticker.alerts,
  ];
  return parts.join(',');
}

export function csvHeader(): string {
  return CSV_HEADER;
}

// ── JSON Lines ──

export function toJSONLine(ticker: EnrichedTicker): string {
  return JSON.stringify(ticker);
}

// ── Markdown report ──

export function toMarkdownReport(
  tickers: EnrichedTicker[],
  technicals?: Map<string, TechnicalIndicators>,
  newsMatches?: NewsMatch[],
): string {
  const lines: string[] = [];
  const now = new Date().toISOString();

  lines.push(`# 🛰️ Crypto Radar — ${now.slice(0, 19)}Z\n`);

  // Summary
  const total = tickers.length;
  const gainers = tickers.filter(t => t.priceChangePercent > 0).length;
  const losers = tickers.filter(t => t.priceChangePercent < 0).length;
  lines.push(`**${total} tokens tracked** — 📈 ${gainers} up · 📉 ${losers} down\n`);

  // Table
  lines.push('| Symbol | Chain | Price | 24h Chg | Vol (24h) | Spread | Momentum |');
  lines.push('|--------|-------|-------|---------|-----------|--------|----------|');

  for (const t of tickers) {
    const chgStr = t.priceChangePercent >= 0
      ? `+${t.priceChangePercent.toFixed(2)}%`
      : `${t.priceChangePercent.toFixed(2)}%`;
    const momentumTag = t.momentum >= 5 ? '🚀' : t.momentum <= -5 ? '⚠️' : '';
    lines.push(
      `| ${t.symbol} | ${t.chain} | $${fmtPrice(t.lastPrice)} | ${chgStr} | ${fmtQuoteVol(t.quoteVolume)} | ${t.spreadPct.toFixed(3)}% | ${momentumTag}`,
    );
  }

  // Technical indicators section
  if (technicals && technicals.size > 0) {
    lines.push('\n## 📊 Technical Indicators\n');
    lines.push('| Symbol | RSI | MFI | BB Width | MACD Hist | ATR% | Vol Trend | Price vs EMA50 |');
    lines.push('|--------|-----|-----|----------|-----------|------|-----------|----------------|');

    for (const [sym, ti] of Array.from(technicals)) {
      lines.push(
        `| ${sym} | ${ti.rsi?.toFixed(1) ?? '—'} | ${ti.mfi?.toFixed(1) ?? '—'} | ${ti.bb?.width.toFixed(3) ?? '—'} | ${ti.macd?.histogram.toExponential(2) ?? '—'} | ${ti.atrPct?.toFixed(2) ?? '—'}% | ${ti.volTrend?.toFixed(2) ?? '—'} | ${ti.priceVsEma50?.toFixed(2) ?? '—'}%`,
      );
    }
  }

  // News section
  if (newsMatches && newsMatches.length > 0) {
    lines.push('\n## 📰 News Signals\n');

    // Group by symbol
    const bySymbol = new Map<string, NewsMatch[]>();
    for (const m of newsMatches) {
      const arr = bySymbol.get(m.symbol) ?? [];
      arr.push(m);
      bySymbol.set(m.symbol, arr);
    }

    for (const [sym, items] of Array.from(bySymbol)) {
      lines.push(`### ${sym}\n`);
      for (const item of items.slice(0, 3)) {
        lines.push(`- **${item.headline}** (${item.source}, rel: ${item.relevance})`);
        if (item.description) {
          lines.push(`  ${item.description.slice(0, 200)}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

// ── Terminal table ──

export function toTable(tickers: EnrichedTicker[], aggregatedSignals?: AggregatedSignal[]): string {
  const lines: string[] = [];
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  lines.push(`🛰️  Crypto Radar — ${now}  |  ${tickers.length} tokens\n`);

  // Header
  lines.push('Sym     Chain    Price        24h Chg    Vol(24h)    Spread   Momentum  Tags');

  for (const t of tickers) {
    const sym = t.symbol.padEnd(7);
    const chain = t.chain.padEnd(8);
    const price = fmtPrice(t.lastPrice).padEnd(12);
    const chg = (t.priceChangePercent >= 0 ? '+' : '') + t.priceChangePercent.toFixed(2) + '%';
    const chgStr = chg.padEnd(10);
    const vol = fmtQuoteVol(t.quoteVolume).padEnd(10);
    const spread = fmtSpread(t.spreadPct).padEnd(8);
    const momentum = t.momentum.toFixed(1).padEnd(8);

    // Tags
    const tags: string[] = [];
    if (t.priceChangePercent <= -5) tags.push('🔴DIP');
    else if (t.priceChangePercent >= 5) tags.push('🟢PUMP');
    if (t.quoteVolume >= 10e6) tags.push('💧HI-LIQ');
    if (t.spreadPct >= 1) tags.push('⚠️WIDE');
    const tagStr = tags.join(' ');

    lines.push(`${sym} ${chain} ${price} ${chgStr} ${vol} ${spread} ${momentum} ${tagStr}`);
  }

  return lines.join('\n');
}

// ── Signal report ──

export function toSignalReport(signals: TokenSignal[]): string {
  const sorted = [...signals].sort((a, b) => b.compositeScore - a.compositeScore);
  const lines: string[] = [];

  lines.push('# 🚀 Crypto Radar — Signals\n');

  for (const s of sorted.slice(0, 10)) {
    const scoreBar = scoreToBar(s.compositeScore, 20);
    lines.push(`## ${s.symbol} (${s.chain}) — Score: ${s.compositeScore.toFixed(1)}/100`);
    lines.push(`Price: $${s.lastPrice} | 24h: ${s.priceChangePercent >= 0 ? '+' : ''}${s.priceChangePercent.toFixed(2)}%`);
    lines.push(`Momentum: ${s.momentumScore.toFixed(1)} | Technical: ${s.technicalScore.toFixed(1)} | News: ${s.newsScore.toFixed(1)}`);
    lines.push(`\`${scoreBar}\``);
    if (s.alerts.length > 0) {
      lines.push(`Alerts: ${s.alerts.join(', ')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Helpers ──

function fmtPrice(v: number): string {
  return v < 1 ? '$' + v.toFixed(6) : '$' + v.toFixed(2);
}

function fmtQuoteVol(v: number): string {
  if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return '$' + (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
  return '$' + v.toFixed(0);
}

function fmtSpread(v: number): string {
  return Number.isFinite(v) ? v.toFixed(3) + '%' : '—';
}

function scoreToBar(score: number, maxLen: number): string {
  const filled = Math.round((score / 100) * maxLen);
  const empty = maxLen - filled;
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, empty));
}
