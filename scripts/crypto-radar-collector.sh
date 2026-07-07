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
MAX_LOG_AGE_DAYS=30

# ── Validate ──
if [ ! -f "$PLUGIN_DIR/dist/cli.js" ]; then
  echo "  ❌ Crypto Radar collector: dist/cli.js not found"
  echo "     Run 'npm run build' in $PLUGIN_DIR"
  exit 1
fi

mkdir -p "$DATA_DIR"
cd "$PLUGIN_DIR"

# ── Run scan — stdout flows through to cron delivery ──
node dist/cli.js scan --dynamic 39 --onchain || {
  echo "  ❌ Crypto Radar scan failed (exit: $?)" >&2
  exit 1
}

# ── Run collector (klines + futures) ──
node dist/cli.js collect --klines --futures || {
  echo "  ❌ Crypto Radar collector failed (exit: $?)" >&2
  exit 1
}

# ── Prune old logs and exports ──
find "$DATA_DIR" -name "cron-*.json" -mtime +"$MAX_LOG_AGE_DAYS" -delete 2>/dev/null || true
find "$DATA_DIR" -name "cron-*.txt" -mtime +"$MAX_LOG_AGE_DAYS" -delete 2>/dev/null || true
find "$DATA_DIR" -name "cron-*.csv" -mtime +"$MAX_LOG_AGE_DAYS" -delete 2>/dev/null || true
find "$DATA_DIR" -name "cron-*.md" -mtime +"$MAX_LOG_AGE_DAYS" -delete 2>/dev/null || true
find "$DATA_DIR" -name "crypto-radar-*.xlsx" -mtime +"$MAX_LOG_AGE_DAYS" -delete 2>/dev/null || true
