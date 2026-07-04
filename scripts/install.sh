#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Hermes Crypto Radar — One-Line Install
# ═══════════════════════════════════════════════════════════════════════
# Usage: bash <(curl -fsSL https://raw.githubusercontent.com/ssdeanx/Hermes-Crypto-Radar/main/scripts/install.sh)
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

VERSION="2.0.0"
REPO="ssdeanx/Hermes-Crypto-Radar"
INSTALL_DIR="${HERMES_PLUGIN_DIR:-$HOME/.hermes/plugins/crypto-radar}"

echo "🛰️  Installing Hermes Crypto Radar v${VERSION}..."
echo ""

# ── Check prerequisites ──
if ! command -v node &>/dev/null; then
  echo "❌ Node.js is required but not found. Install Node.js >= 22 from https://nodejs.org"
  exit 1
fi

NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VER" -lt 22 ]; then
  echo "❌ Node.js >= 22 required (found v$(node -v)). Upgrade from https://nodejs.org"
  exit 1
fi
echo "✅ Node.js $(node -v)"

# ── Download and extract ──
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

echo "📦 Downloading Crypto Radar v${VERSION}..."
curl -fsSL "https://github.com/${REPO}/archive/refs/tags/v${VERSION}.tar.gz" -o "$TMP_DIR/release.tar.gz" 2>/dev/null \
  || curl -fsSL "https://github.com/${REPO}/archive/main.tar.gz" -o "$TMP_DIR/release.tar.gz"

echo "📂 Extracting..."
mkdir -p "$INSTALL_DIR"
tar -xzf "$TMP_DIR/release.tar.gz" -C "$TMP_DIR"
# Find the extracted directory (github adds a prefix)
EXTRACTED_DIR=$(find "$TMP_DIR" -maxdepth 1 -type d | tail -1)
cp -r "$EXTRACTED_DIR"/* "$INSTALL_DIR"/ 2>/dev/null || true

# ── Install dependencies and build ──
cd "$INSTALL_DIR"
echo "🔧 Installing dependencies..."
npm install --production 2>/dev/null || npm install
echo "🔨 Building..."
npm run build

# ── Register as Hermes plugin ──
if command -v hermes &>/dev/null; then
  echo "🔌 Registering with Hermes..."
  hermes plugins install "$INSTALL_DIR" 2>/dev/null \
    || ln -sf "$INSTALL_DIR" "$HOME/.hermes/plugins/crypto-radar" 2>/dev/null \
    || echo "   (Run 'hermes plugins install $INSTALL_DIR' manually if needed)"
fi

echo ""
echo "✅ Hermes Crypto Radar v${VERSION} installed!"
echo ""
echo "Quick start:"
echo "  hermes tools list | grep crypto_radar    # Verify plugin tools"
echo "  crypto-radar scan --dynamic              # Run first scan"
echo "  crypto-radar health                      # Check system status"
echo ""
echo "For cron automation, add to crontab:"
echo "  0 */2 * * * cd $INSTALL_DIR && node dist/cli.js scan --dynamic 30 --no-news --format json --quiet"
echo ""
