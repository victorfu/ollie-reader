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

# Derive the GitHub repo (owner/name) from the origin remote rather than
# hardcoding it — keeps forks and renamed remotes working. Handles both
# git@github.com:owner/name(.git) and https://github.com/owner/name(.git).
REMOTE_URL="$(git -C "$REPO_ROOT" remote get-url origin 2>/dev/null || true)"
REPO="$(printf '%s' "$REMOTE_URL" | sed -E 's#^.*github\.com[:/]##; s#\.git$##')"
[ -n "$REPO" ] || { echo "ABORT: cannot determine GitHub repo from origin remote" >&2; exit 1; }

VERSION="$("${PY[@]}" release/version.py)"
TAG="desktop-v$VERSION"
DMG="$DESKTOP_DIR/dist/ollie-reader-$VERSION.dmg"
SUM="$DMG.sha256"
PROVENANCE="$DMG.commit"

[ -f "$DMG" ] || { echo "ABORT: missing $DMG — run 'make desktop-dmg' first" >&2; exit 1; }
[ -f "$SUM" ] || { echo "ABORT: missing $SUM" >&2; exit 1; }
SOURCE_COMMIT="$("${PY[@]}" release/provenance.py verify "$REPO_ROOT" "$PROVENANCE")"
( cd "$DESKTOP_DIR/dist" && shasum -a 256 -c "$(basename "$SUM")" )

# The commit must already exist on this GitHub remote. When a tag is already
# present, require it to resolve to the exact build commit and ask gh to verify
# it. Otherwise create the tag explicitly at that commit (never at the remote's
# default branch by implication).
REMOTE_REFS="$(git -C "$REPO_ROOT" ls-remote "$REMOTE_URL")"
if ! printf '%s\n' "$REMOTE_REFS" | awk '{print $1}' | grep -Fxq "$SOURCE_COMMIT"; then
  echo "ABORT: source commit $SOURCE_COMMIT is not the tip of any origin ref; push it first" >&2
  exit 1
fi
TAG_DIRECT="$(printf '%s\n' "$REMOTE_REFS" | awk -v ref="refs/tags/$TAG" '$2 == ref {print $1; exit}')"
TAG_PEELED="$(printf '%s\n' "$REMOTE_REFS" | awk -v ref="refs/tags/$TAG^{}" '$2 == ref {print $1; exit}')"
TAG_COMMIT="${TAG_PEELED:-$TAG_DIRECT}"
GH_TAG_ARGS=()
if [ -n "$TAG_COMMIT" ]; then
  [ "$TAG_COMMIT" = "$SOURCE_COMMIT" ] || {
    echo "ABORT: remote tag $TAG points to $TAG_COMMIT, asset was built from $SOURCE_COMMIT" >&2
    exit 1
  }
  GH_TAG_ARGS+=(--verify-tag)
else
  GH_TAG_ARGS+=(--target "$SOURCE_COMMIT")
fi

if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
  echo "ABORT: release $TAG already exists" >&2; exit 1
fi

gh release create "$TAG" "$DMG" "$SUM" \
  --repo "$REPO" \
  "${GH_TAG_ARGS[@]}" \
  --title "Ollie Reader Desktop $VERSION" \
  --notes "macOS desktop app — Apple Silicon (arm64), signed & notarized.

Install: open the .dmg and drag **Ollie Reader** to Applications.

Verify download: \`shasum -a 256 -c ollie-reader-$VERSION.dmg.sha256\`"
echo "published $TAG"
