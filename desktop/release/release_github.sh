#!/usr/bin/env bash
# Publish the notarized dmg to GitHub Releases as desktop-v<version>.
# Refuses to run if .env.package is tracked, the tag exists, or assets are missing.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DESKTOP_DIR/.." && pwd)"
PY=(uv run --directory "$DESKTOP_DIR" python)

# --- secret guards ----------------------------------------------------------
git -C "$REPO_ROOT" check-ignore -q .env.package \
  || { echo "ABORT: .env.package is not gitignored" >&2; exit 1; }
if git -C "$REPO_ROOT" ls-files --error-unmatch .env.package >/dev/null 2>&1; then
  echo "ABORT: .env.package is tracked in git" >&2; exit 1
fi

VERSION="$("${PY[@]}" release/version.py)"
TAG="desktop-v$VERSION"
DMG="$DESKTOP_DIR/dist/ollie-reader-$VERSION.dmg"
SUM="$DMG.sha256"

[ -f "$DMG" ] || { echo "ABORT: missing $DMG — run 'make desktop-dmg' first" >&2; exit 1; }
[ -f "$SUM" ] || { echo "ABORT: missing $SUM" >&2; exit 1; }

if gh release view "$TAG" --repo victorfu/ollie-reader >/dev/null 2>&1; then
  echo "ABORT: release $TAG already exists" >&2; exit 1
fi

gh release create "$TAG" "$DMG" "$SUM" \
  --repo victorfu/ollie-reader \
  --title "Ollie Reader Desktop $VERSION" \
  --notes "macOS desktop app — Apple Silicon (arm64), signed & notarized.

Install: open the .dmg and drag **Ollie Reader** to Applications.

Verify download: \`shasum -a 256 -c ollie-reader-$VERSION.dmg.sha256\`"
echo "published $TAG"
