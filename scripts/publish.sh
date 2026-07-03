#!/usr/bin/env bash
set -euo pipefail
VERSION="${1:-$(node -e "console.log(require('./package.json').version)")}"
echo "Packaging hermes-crypto-radar v$VERSION for marketplace..."
# Create clean tarball
tar -czf "hermes-crypto-radar-$VERSION.tar.gz" \
  --exclude=node_modules \
  --exclude=data \
  --exclude=coverage \
  --exclude=.git \
  --exclude=.github \
  --exclude=src \
  --exclude=test \
  --exclude=*.test.ts \
  dist/ plugin/ plugin.yaml package.json README.md LICENSE
echo "Created: hermes-crypto-radar-$VERSION.tar.gz"
echo "To publish: hermes skills publish ./crypto-radar-skill.md"
