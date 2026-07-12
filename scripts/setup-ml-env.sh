#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Hermes Crypto Radar — ML Environment Setup
# ═══════════════════════════════════════════════════════════════════════
#
# Creates an isolated Python virtual environment for ML training
# using uv (fast Python package manager) or pip as fallback.
#
# Usage:
#   bash scripts/setup-ml-env.sh
#   bash scripts/setup-ml-env.sh --uv     # force uv
#   bash scripts/setup-ml-env.sh --pip    # force pip
#
# Environment:
#   ML_PYTHON      — Python interpreter path (default: python3)
#   ML_VENV_DIR    — venv directory (default: .venv-ml)
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_DIR"

# ── Config ──
PYTHON="${ML_PYTHON:-python3}"
VENV_DIR="${ML_VENV_DIR:-.venv-ml}"
REQUIREMENTS="ml/requirements.txt"

# ── Detect package manager ──
USE_UV=false
if [[ "${1:-}" == "--uv" ]]; then
  USE_UV=true
elif [[ "${1:-}" == "--pip" ]]; then
  USE_UV=false
elif command -v uv &>/dev/null; then
  USE_UV=true
fi

echo "  🐍 Setting up ML Python environment..."
echo "     Python:      $PYTHON"
echo "     Venv dir:    $VENV_DIR"
echo "     Manager:     $([ "$USE_UV" = true ] && echo 'uv' || echo 'pip')"
echo ""

# ── Verify Python ──
if ! command -v "$PYTHON" &>/dev/null; then
  echo "  ❌ Python not found: $PYTHON"
  echo "     Install Python 3.10+ from https://python.org"
  exit 1
fi

PY_VERSION=$("$PYTHON" --version 2>&1)
echo "     $PY_VERSION"

# ── Create venv ──
if [ ! -d "$VENV_DIR" ]; then
  echo "  → Creating virtual environment..."
  "$PYTHON" -m venv "$VENV_DIR"
  echo "     Done"
fi

# ── Activate ──
source "$VENV_DIR/bin/activate"
echo "     Active: $(which python3)"

# ── Upgrade pip ──
echo "  → Upgrading pip..."
python3 -m pip install --quiet --upgrade pip
echo "     Done"

# ── Install dependencies ──
if [ ! -f "$REQUIREMENTS" ]; then
  echo "  ⚠️  No requirements.txt found at $REQUIREMENTS"
  echo "     Skipping package install"
  echo ""
  echo "  ✅ ML venv ready at $VENV_DIR"
  echo "     Activate: source $VENV_DIR/bin/activate"
  exit 0
fi

echo "  → Installing ML dependencies from $REQUIREMENTS..."

if [ "$USE_UV" = true ]; then
  # uv is significantly faster
  if ! command -v uv &>/dev/null; then
    echo "  ⚠️  uv not found, falling back to pip"
    python3 -m pip install --quiet -r "$REQUIREMENTS"
  else
    uv pip install --quiet -r "$REQUIREMENTS"
  fi
else
  python3 -m pip install --quiet -r "$REQUIREMENTS"
fi

echo "     Done"

# ── Verify key imports ──
echo "  → Verifying imports..."
python3 -c "
import sys
try:
    import lightgbm; print(f'     lightgbm    {lightgbm.__version__}')
except Exception: print('     lightgbm    not installed')
try:
    import pandas; print(f'     pandas      {pandas.__version__}')
except Exception: print('     pandas      not installed')
try:
    import sklearn; print(f'     scikit-learn {sklearn.__version__}')
except Exception: print('     scikit-learn not installed')
try:
    import joblib; print(f'     joblib      {joblib.__version__}')
except Exception: print('     joblib      not installed')
" 2>&1 || {
  echo "  ⚠️  Import verification had issues — some packages may not be installed"
}

echo ""
echo "  ✅ ML environment ready"
echo "     Venv:  $VENV_DIR"
echo "     Usage: source $VENV_DIR/bin/activate"
echo "     Then:  npm run ml:train"
echo ""
echo "     Or set RADAR__ML_PYTHON=$VENV_DIR/bin/python3"
