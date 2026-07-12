#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Hermes Crypto Radar — Cron Collector
# ═══════════════════════════════════════════════════════════════════════
# Designed for Hermes cron (no_agent=true) or system crontab.
#
# Datasets written every run:
#   • radar-runlog.jsonl          — RUN-HISTORY LEDGER (1 line/run, append)
#   • radar-tickers.jsonl         — TICKER DATASET, ML-ready (1 line/ticker, append)
#   • radar-output.{txt,csv,md,xlsx} — Current snapshot (rotated to archive/ before overwrite)
#   • crypto-radar.db             — klines + futures store (via `collect`)
#   • crypto-radar-log.csv        — Rolling CSV (append)
#   • crypto-radar-news.csv       — Rolling news CSV (append)
#
# CSV is the canonical dataset. The ticker JSONL is the append-friendly
# ML fine-tuning dataset (consistent schema, nulls not missing keys).
#
# Environment:
#   RADAR__DATA_DIR   — override data/log directory
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Resolve plugin dir (built dist/cli.js) ──
# 1. Sibling of this script (plugin install layout: scripts/../dist/cli.js)
# 2. Cron workdir (cwd has dist/cli.js)
# 3. Explicit install location
if [ -f "$SCRIPT_DIR/../dist/cli.js" ]; then
  PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
elif [ -f "$(pwd)/dist/cli.js" ]; then
  PLUGIN_DIR="$(pwd)"
else
  PLUGIN_DIR="/home/sam/Music/Crypto-Radar-Signals/Hermes-Crypto-Radar"
fi

DATA_DIR="${RADAR__DATA_DIR:-$HOME/.hermes/data/crypto-radar}"
TICKERS_JSONL="${DATA_DIR}/radar-tickers.jsonl"
MAX_LOG_AGE_DAYS=30

# ── Validate build exists ──
if [ ! -f "$PLUGIN_DIR/dist/cli.js" ]; then
  echo "  ❌ Crypto Radar collector: dist/cli.js not found at $PLUGIN_DIR"
  echo "     Run 'npm run build' in $PLUGIN_DIR"
  exit 1
fi

mkdir -p "$DATA_DIR"
cd "$PLUGIN_DIR"

# ── Run scan (prices + technicals + strategy signals) ──
# Captured so we can both validate and append JSONL. --quiet suppresses the
# human table on stderr; --format json puts the structured payload on stdout.
SCAN_STDERR=$(mktemp)
SCAN_STDOUT=$(mktemp)
trap 'rm -f "$SCAN_STDERR" "$SCAN_STDOUT"' EXIT

SCAN_EXIT=0
node dist/cli.js scan \
  --dynamic 30 \
  --onchain \
  --no-news \
  --format json \
  --quiet \
  --sort momentum \
  >"$SCAN_STDOUT" 2>"$SCAN_STDERR" || SCAN_EXIT=$?

if [ "$SCAN_EXIT" -ne 0 ] || [ ! -s "$SCAN_STDOUT" ]; then
  echo "  ❌ Crypto Radar scan failed (exit: $SCAN_EXIT)"
  [ -s "$SCAN_STDERR" ] && sed 's/^/     /' "$SCAN_STDERR"
  exit 1
fi

# ── Validate JSON payload before trusting it ──
if ! node -e "try{JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.exit(0)}catch(e){process.exit(1)}" <"$SCAN_STDOUT" 2>/dev/null; then
  echo "  ❌ Crypto Radar scan produced invalid JSON"
  [ -s "$SCAN_STDERR" ] && sed 's/^/     /' "$SCAN_STDERR"
  exit 1
fi

# ── Run collector (klines + futures) → updates crypto-radar.db ──
# Writes klines/futures datasets every run. Non-fatal: if the DB write
# hits issues, scan datasets + JSONL are already written, so the run still
# records successfully.
COLLECT_STDERR=$(mktemp)
trap 'rm -f "$SCAN_STDERR" "$SCAN_STDOUT" "$COLLECT_STDERR"' EXIT
node dist/cli.js collect --klines --futures 2>"$COLLECT_STDERR" || {
  echo "  ⚠️  Collector reported issues (klines/futures may be partial):"
  [ -s "$COLLECT_STDERR" ] && sed 's/^/     /' "$COLLECT_STDERR"
  # Non-fatal: scan datasets + JSONL already written. Continue.
}

# ── Run ML prediction if model exists ──
if [ -f "ml/models/model.joblib" ] || ls ml/models/model_*.joblib 2>/dev/null; then
  node dist/cli.js ml predict --interval 1h 2>/dev/null || true
fi

# ── Archive old logs (move, don't delete) ──
# Files older than MAX_LOG_AGE_DAYS are moved to an archive/ subdirectory
# so historical data is preserved for signal back-testing and model training.
ARCHIVE_DIR="${DATA_DIR}/archive"
ARCHIVE_AGE="${MAX_LOG_AGE_DAYS:-30}"
mkdir -p "$ARCHIVE_DIR"
# Archive old-style monthly files and old per-run XLSX orphans
for pattern in "cron-*" "crypto-radar-*.xlsx" "radar-*.*"; do
  find "$DATA_DIR" -maxdepth 1 -name "$pattern" -mtime +"$ARCHIVE_AGE" -exec mv {} "$ARCHIVE_DIR/" \; 2>/dev/null || true
done

# One-time migration: rename old monthly JSONL to new single-file names if they exist and target doesn't
if [ -f "$DATA_DIR/cron-$(date +%Y%m)-runlog.jsonl" ] && [ ! -f "$DATA_DIR/radar-runlog.jsonl" ]; then
  mv "$DATA_DIR"/cron-*-runlog.jsonl "$DATA_DIR/radar-runlog.jsonl" 2>/dev/null || true
fi
if ls "$DATA_DIR"/cron-*-tickers.jsonl 2>/dev/null | head -1 | grep -q . && [ ! -f "$DATA_DIR/radar-tickers.jsonl" ]; then
  # Merge all monthly ticker files into one
  cat "$DATA_DIR"/cron-*-tickers.jsonl > "$DATA_DIR/radar-tickers.jsonl" 2>/dev/null || true
  mv "$DATA_DIR"/cron-*-tickers.jsonl "$ARCHIVE_DIR/" 2>/dev/null || true
fi

# ── Summary for cron delivery (real stdout → meaningful recorded run) ──
export TICKERS_JSONL
node -e "
const fs = require('fs');
const d = fs.readFileSync('$SCAN_STDOUT', 'utf8');
try {
  const data = JSON.parse(d);
  const tickers = data.tickers || [];
  const signals = data.aggregatedSignals || data.signals || [];
  const onchain = data.onchain;
  const run = data.run || {};
  const buySignals    = signals.filter(s => /buy/i.test(s.direction || '')).length;
  const sellSignals   = signals.filter(s => /sell/i.test(s.direction || '')).length;
  const neutralSignals = signals.length - buySignals - sellSignals;
  const strongSignals = signals.filter(s => (s.compositeConfidence || 0) > 0.7);
  const topMovers = [...tickers]
    .sort((a,b) => Math.abs(b.priceChangePercent || 0) - Math.abs(a.priceChangePercent || 0))
    .slice(0, 5);

  console.log('');
  console.log('  🛰️  Crypto Radar — Market Scan Complete');
  console.log('  ─────────────────────────────────────────');
  console.log('  📊  Tracked tokens:  ' + tickers.length);
  console.log('  🟢  Buy signals:     ' + buySignals);
  console.log('  🔴  Sell signals:    ' + sellSignals);
  console.log('  ⚪  Neutral:         ' + neutralSignals);
  console.log('  🔔  Strong (>70%):   ' + strongSignals.length);
  console.log('  ⏱   Duration:       ' + (run.durationMs || '?') + 'ms');
  if (onchain && onchain.chains && onchain.chains.length) {
    console.log('  ⛓️   Top chain TVL:  ' + onchain.chains.slice(0,3)
      .map(c => c.chain + ' \$' + (c.tvl||0).toLocaleString('en-US',{maximumFractionDigits:0})).join('  '));
  }
  console.log('  📁  Ticker dataset: ' + process.env.TICKERS_JSONL);
  console.log('  🕐  ' + new Date().toISOString());
  console.log('');
} catch (e) {
  console.log('  ❌ Crypto Radar summary parse failed: ' + e.message);
  process.exit(1);
}
"
