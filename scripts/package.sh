#!/usr/bin/env bash
# package.sh — build a Chrome Web Store-ready ZIP
# Usage: bash scripts/package.sh

set -euo pipefail
cd "$(dirname "$0")/.."

# sync manifest from popup.js site list
node scripts/sync-manifest.js

VERSION=$(node -p "require('./manifest.json').version")
OUT="dist/askall-v${VERSION}.zip"

rm -rf dist
mkdir -p dist

zip -r "$OUT" \
  manifest.json \
  background/ \
  content/ \
  popup/ \
  icons/ \
  LICENSE \
  -x "*.DS_Store" "*__MACOSX*"

SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo "Packaged: $OUT ($SIZE)"
echo "Version:  $VERSION"
echo ""
echo "Upload this file to https://chrome.google.com/webstore/devconsole"
