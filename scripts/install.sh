#!/usr/bin/env bash
set -euo pipefail
echo "🛰️ Installing Hermes Crypto Radar..."
git clone https://github.com/ssdeanx/Hermes-Crypto-Radar.git /tmp/hermes-crypto-radar
cd /tmp/hermes-crypto-radar
npm install && npm run build
ln -sf "$PWD" ~/.hermes/plugins/crypto-radar
echo "✅ Installed! Run 'hermes plugins list | grep crypto-radar' to verify."
