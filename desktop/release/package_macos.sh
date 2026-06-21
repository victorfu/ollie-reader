#!/usr/bin/env bash
# Build → security-scan → sign (hardened runtime) → dmg → notarize → staple.
# Reads Apple credentials from <repo>/.env.package into a throwaway keychain.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$DESKTOP_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.package"
ENT="$SCRIPT_DIR/entitlements.plist"

PY=(uv run --directory "$DESKTOP_DIR" python)

# --- credentials ------------------------------------------------------------
[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE" >&2; exit 1; }
set -a; source "$ENV_FILE"; set +a
for v in APPLE_ID APPLE_TEAM_ID APPLE_APP_PASSWORD APPLE_CERTIFICATE_PASSWORD APPLE_CERTIFICATE; do
  [ -n "${!v:-}" ] || { echo "missing $v in .env.package" >&2; exit 1; }
done

VERSION="$("${PY[@]}" release/version.py)"
APP="$DESKTOP_DIR/dist/ollie-reader.app"
DMG="$DESKTOP_DIR/dist/ollie-reader-$VERSION.dmg"

# --- build ------------------------------------------------------------------
make -C "$REPO_ROOT" desktop-icon
OLLIE_BUNDLE_VERSION="$VERSION" make -C "$REPO_ROOT" desktop-package
[ -d "$APP" ] || { echo "build did not produce $APP" >&2; exit 1; }

# --- SECURITY GUARD (abort before signing if any secret/.env present) -------
"${PY[@]}" release/verify_bundle.py "$APP"

# --- prune dangling symlinks ------------------------------------------------
# The spec deliberately drops unused Qt frameworks (QtQml/QtQuick/QtPdf/
# QtVirtualKeyboard) to shrink the bundle, but PyInstaller leaves broken
# framework symlinks behind pointing at the removed targets. Dangling symlinks
# make `codesign --deep` and notarization fail ("No such file or directory"),
# so remove them before signing. The app is QtWidgets-only — these are unused.
PRUNED="$(find "$APP" -type l ! -exec test -e {} \; -print -delete | wc -l | tr -d ' ')"
echo "pruned $PRUNED dangling symlink(s) before signing"

# --- throwaway keychain + cert import ---------------------------------------
WORK="$(mktemp -d)"
KEYCHAIN="$WORK/build.keychain-db"
KEYCHAIN_PW="$(openssl rand -base64 24)"
CERT_P12="$WORK/cert.p12"
# Capture the current user keychain search list as an array so it can be
# restored verbatim on exit (paths may contain spaces).
ORIG_KEYCHAINS=()
while IFS= read -r _kc; do ORIG_KEYCHAINS+=("$_kc"); done \
  < <(security list-keychains -d user | sed -e 's/^[[:space:]]*//' -e 's/"//g')

cleanup() {
  if [ "${#ORIG_KEYCHAINS[@]}" -gt 0 ]; then
    security list-keychains -d user -s "${ORIG_KEYCHAINS[@]}" 2>/dev/null || true
  fi
  security delete-keychain "$KEYCHAIN" 2>/dev/null || true
  rm -rf "$WORK"
}
trap cleanup EXIT

printf '%s' "$APPLE_CERTIFICATE" | base64 --decode > "$CERT_P12"
security create-keychain -p "$KEYCHAIN_PW" "$KEYCHAIN"
security set-keychain-settings -lut 21600 "$KEYCHAIN"
security unlock-keychain -p "$KEYCHAIN_PW" "$KEYCHAIN"
security import "$CERT_P12" -k "$KEYCHAIN" -P "$APPLE_CERTIFICATE_PASSWORD" \
  -T /usr/bin/codesign
security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PW" "$KEYCHAIN" >/dev/null
# prepend our keychain to the search list so codesign can find the identity
security list-keychains -d user -s "$KEYCHAIN" "${ORIG_KEYCHAINS[@]}"

IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN" \
  | awk '/Developer ID Application/ {print $2; exit}')"
[ -n "$IDENTITY" ] || { echo "no 'Developer ID Application' identity in cert" >&2; exit 1; }
echo "signing identity: $IDENTITY"

# --- sign inside-out (all Mach-O, then main exe + app with entitlements) ----
while IFS= read -r -d '' f; do
  if file "$f" | grep -q "Mach-O"; then
    codesign --force --timestamp --options runtime \
      --keychain "$KEYCHAIN" --sign "$IDENTITY" "$f" \
      || { echo "codesign failed: $f" >&2; exit 1; }
  fi
done < <(find "$APP/Contents" -type f -print0)
codesign --force --timestamp --options runtime --entitlements "$ENT" \
  --keychain "$KEYCHAIN" --sign "$IDENTITY" "$APP/Contents/MacOS/ollie-reader"
codesign --force --timestamp --options runtime --entitlements "$ENT" \
  --keychain "$KEYCHAIN" --sign "$IDENTITY" "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"

# --- dmg --------------------------------------------------------------------
rm -f "$DMG"
if command -v create-dmg >/dev/null 2>&1; then
  create-dmg \
    --volname "Ollie Reader" \
    --window-size 600 320 \
    --icon "ollie-reader.app" 150 160 \
    --app-drop-link 450 160 \
    "$DMG" "$APP" || true
fi
if [ ! -f "$DMG" ]; then
  echo "create-dmg unavailable or failed; falling back to hdiutil"
  hdiutil create -volname "Ollie Reader" -srcfolder "$APP" -ov -format UDZO "$DMG"
fi
codesign --force --timestamp --keychain "$KEYCHAIN" --sign "$IDENTITY" "$DMG"

# --- notarize + staple ------------------------------------------------------
NOTARY_JSON="$(xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD" \
  --wait --output-format json)"
NOTARY_STATUS="$(printf '%s' "$NOTARY_JSON" | "${PY[@]}" -c 'import sys,json; print(json.load(sys.stdin).get("status",""))')"
echo "notarization status: $NOTARY_STATUS"
if [ "$NOTARY_STATUS" != "Accepted" ]; then
  echo "ERROR: notarization not Accepted ($NOTARY_STATUS)" >&2
  SUBMISSION_ID="$(printf '%s' "$NOTARY_JSON" | "${PY[@]}" -c 'import sys,json; print(json.load(sys.stdin).get("id",""))')"
  [ -n "$SUBMISSION_ID" ] && xcrun notarytool log "$SUBMISSION_ID" \
    --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD" >&2 || true
  exit 1
fi
xcrun stapler staple "$DMG"
xcrun stapler validate "$DMG"
spctl -a -t open --context context:primary-signature -v "$DMG"

# --- checksum ---------------------------------------------------------------
( cd "$DESKTOP_DIR/dist" && shasum -a 256 "ollie-reader-$VERSION.dmg" > "ollie-reader-$VERSION.dmg.sha256" )
echo "built and notarized: $DMG"
