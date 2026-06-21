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

# --- throwaway keychain + cert import ---------------------------------------
WORK="$(mktemp -d)"
KEYCHAIN="$WORK/build.keychain-db"
KEYCHAIN_PW="$(openssl rand -base64 24)"
CERT_P12="$WORK/cert.p12"
ORIG_KEYCHAINS="$(security list-keychains -d user | sed -e 's/^[[:space:]]*//' -e 's/"//g')"

cleanup() {
  security list-keychains -d user -s ${ORIG_KEYCHAINS} 2>/dev/null || true
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
security list-keychains -d user -s "$KEYCHAIN" ${ORIG_KEYCHAINS}

IDENTITY="$(security find-identity -v -p codesigning "$KEYCHAIN" \
  | awk '/Developer ID Application/ {print $2; exit}')"
[ -n "$IDENTITY" ] || { echo "no 'Developer ID Application' identity in cert" >&2; exit 1; }
echo "signing identity: $IDENTITY"

# --- sign inside-out (all Mach-O, then main exe + app with entitlements) ----
find "$APP/Contents" -type f -print0 | while IFS= read -r -d '' f; do
  if file "$f" | grep -q "Mach-O"; then
    codesign --force --timestamp --options runtime \
      --keychain "$KEYCHAIN" --sign "$IDENTITY" "$f"
  fi
done
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
xcrun notarytool submit "$DMG" \
  --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_APP_PASSWORD" \
  --wait
xcrun stapler staple "$DMG"
spctl -a -t open --context context:primary-signature -v "$DMG" || true

# --- checksum ---------------------------------------------------------------
( cd "$DESKTOP_DIR/dist" && shasum -a 256 "ollie-reader-$VERSION.dmg" > "ollie-reader-$VERSION.dmg.sha256" )
echo "built and notarized: $DMG"
