#!/usr/bin/env bash
# Generate desktop/assets/AppIcon.icns from assets/tray-icon.png.
set -euo pipefail

DESKTOP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DESKTOP_DIR"

SRC="assets/tray-icon.png"
ICONSET="assets/AppIcon.iconset"
OUT="assets/AppIcon.icns"

[ -f "$SRC" ] || { echo "missing $SRC" >&2; exit 1; }

rm -rf "$ICONSET"
mkdir -p "$ICONSET"
for s in 16 32 128 256 512; do
  sips -z "$s" "$s" "$SRC" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2))
  sips -z "$d" "$d" "$SRC" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$OUT"
rm -rf "$ICONSET"
echo "wrote $OUT"
