#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Hermes Crypto Radar — Cron Collector
# ═══════════════════════════════════════════════════════════════════════
# Ships with the hermes-crypto-radar plugin.
# Designed for Hermes cron (no_agent=true) or system crontab.
#
# Environment:
#   RADAR__DATA_DIR   — override data/log directory
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${RADAR__DATA_DIR:-$HOME/.hermes/data/crypto-radar}"
LOG_FILE="${DATA_DIR}/cron-$(date +%Y%m%d).json"
MAX_LOG_AGE_DAYS=30

# ── Validate ──
if [ ! -f "$PLUGIN_DIR/dist/cli.js" ]; then
  echo "  ❌ Crypto Radar collector: dist/cli.js not found"
  echo "     Run 'npm run build' in $PLUGIN_DIR"
  exit 1
fi

mkdir -p "$DATA_DIR"
cd "$PLUGIN_DIR"

# ── Run scan ──
STDERR_LOG=$(mktemp)
trap 'rm -f "$STDERR_LOG"' EXIT

SCAN_EXIT=0
OUTPUT=$(node dist/cli.js scan \
  --dynamic 30 \
  --onchain \
  --no-news \
  --format json \
  --quiet \
  --sort momentum 2>"$STDERR_LOG") || SCAN_EXIT=$?

if [ "$SCAN_EXIT" -ne 0 ] || [ -z "$OUTPUT" ]; then
  STDERR_TEXT=""
  [ -s "$STDERR_LOG" ] && STDERR_TEXT=$(cat "$STDERR_LOG")
  echo "  ❌ Crypto Radar scan failed (exit: $SCAN_EXIT)"
  [ -n "$STDERR_TEXT" ] && echo "     Error: $STDERR_TEXT"
  exit 1
fi

# ── Validate JSON ──
if ! echo "$OUTPUT" | node -e "
  try { JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.exit(0); }
  catch(e) { process.exit(1); }
" 2>/dev/null; then
  echo "  ❌ Crypto Radar scan produced invalid JSON"
  exit 1
fi

echo "$OUTPUT" >> "$LOG_FILE"

# ── Prune old logs ──
find "$DATA_DIR" -name "cron-*.json" -mtime +"$MAX_LOG_AGE_DAYS" -delete 2>/dev/null || true

# ── Summary for cron delivery ──
export LOG_FILE
echo "$OUTPUT" | node -e "
const d = require('fs').readFileSync('/dev/stdin','utf8');
try {
  const data = JSON.parse(d);
  const tickers = data.tickers || [];
  const signals = data.aggregatedSignals || data.signals || [];
  const onchain = data.onchain;
  const run = data.run || {};

  const sorted = [...tickers].sort(
    (a, b) => Math.abs(b.priceChangePercent || 0) - Math.abs(a.priceChangePercent || 0)
  );
  const topMovers = sorted.slice(0, 5);
  const strongSignals = signals.filter(s => (s.compositeConfidence || 0) > 0.7);
  const buySignals   = signals.filter(s => /buy/i.test(s.direction || '')).length;
  const sellSignals  = signals.filter(s => /sell/i.test(s.direction || '')).length;
  const neutralSignals = signals.length - buySignals - sellSignals;

  console.log('');
  console.log('  ┌───────────────────────────────────────────────────────────┐');
  console.log('  │  🛰️  Crypto Radar — Market Scan Complete                 │');
  console.log('  └───────────────────────────────────────────────────────────┘');
  console.log('');
  console.log('  📊  Tracked tokens:   ' + tickers.length);
  console.log('  🟢  Buy signals:      ' + buySignals);
  console.log('  🔴  Sell signals:     ' + sellSignals);
  console.log('  ⚪  Neutral:          ' + neutralSignals);
  console.log('  🔔  Strong signals:   ' + strongSignals.length + ' (confidence > 70%)');
  console.log('  ⏱   Scan duration:    ' + (run.durationMs || '?') + 'ms');

  if (strongSignals.length > 0) {
    console.log('');
    console.log('  🔥 Top Signals:');
    strongSignals.slice(0, 5).forEach(s => {
      const dirIcon = /buy/i.test(s.direction || '') ? '🟢' : /sell/i.test(s.direction || '') ? '🔴' : '⚪';
      const confidence = Math.round((s.compositeConfidence || 0) * 100);
      const reason = (s.signals && s.signals[0] && s.signals[0].reason)
        ? s.signals[0].reason.substring(0, 80)
        : s.compositeReason || '';
      console.log('    ' + dirIcon + ' ' + s.symbol + ' — ' + reason + ' (' + confidence + '%)');
    });
  }

  if (topMovers.length > 0) {
    console.log('');
    console.log('  📉 Top Movers (24h):');
    topMovers.forEach(t => {
      const dir = (t.priceChangePercent || 0) >= 0 ? '🟢' : '🔴';
      const price = (t.lastPrice || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
      });
      console.log('    ' + dir + ' ' + t.symbol + ' — ' + (t.priceChangePercent || 0).toFixed(2) + '% @ \\$' + price);
    });
  }

  if (onchain && onchain.chains && onchain.chains.length > 0) {
    console.log('');
    console.log('  ⛓️  Chain TVL:');
    onchain.chains.slice(0, 5).forEach(c => {
      const tvl = (c.tvl || 0).toLocaleString('en-US', {
        minimumFractionDigits: 0, maximumFractionDigits: 0
      });
      console.log('    ' + c.chain + ': \\$' + tvl);
    });
  }

  console.log('');
  console.log('  📁 ' + process.env.LOG_FILE);
  console.log('  🕐 ' + new Date().toISOString());
  console.log('');
} catch(e) {
  console.log('  ❌ Error parsing radar data: ' + e.message);
  process.exit(1);
}
" || true
