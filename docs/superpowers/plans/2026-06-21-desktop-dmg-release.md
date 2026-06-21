# Desktop dmg Packaging & GitHub Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the PySide6/PyInstaller desktop app into a signed, notarized macOS `.dmg` and publish it to GitHub Releases, guaranteeing no `.env`/secret material ships in the artifact.

**Architecture:** Local-only build pipeline driven by Makefile targets. Two small pytest-tested Python helpers (version reader + bundle security guard) plus three Bash orchestration scripts (icon, sign+dmg+notarize, GitHub publish). The PyInstaller spec gains a `BUNDLE` step to emit a real `.app`. Apple secrets are read from gitignored `.env.package` and loaded into a throwaway keychain that is torn down on exit.

**Tech Stack:** Python 3.12 (tomllib, pytest), Bash, PyInstaller, `codesign`, `xcrun notarytool`/`stapler`, `create-dmg`/`hdiutil`, `sips`/`iconutil`, `gh` CLI, GNU Make, `uv`.

## Global Constraints

- Target arch: **arm64 only** (Apple Silicon). No universal2.
- Bundle identifier: **`com.victorfu.ollie-reader`**. `LSUIElement=true`. `LSMinimumSystemVersion=12.0`.
- Version source of truth: **`desktop/pyproject.toml` `[project].version`** (currently `0.1.0`).
- Release tag: **`desktop-v<version>`**. dmg filename: **`ollie-reader-<version>.dmg`**.
- All Python invoked inside scripts uses the desktop venv: **`uv run --directory <desktop> python …`** (system python3 may be <3.11 and lack tomllib).
- New Python package dir is named **`release/`** (NOT `packaging/` — that name shadows the installed `packaging` distribution that PyInstaller imports).
- Hardened runtime entitlements: `com.apple.security.cs.disable-library-validation` + `com.apple.security.cs.allow-unsigned-executable-memory`.
- Secrets: `.env.package` is gitignored and must never be committed, scanned-into-bundle, or uploaded to a release. Release uploads only the `.dmg` + `.sha256`.
- Repo is PUBLIC. Run paths from repo root `/Users/victor/Documents/ollie-reader` unless stated.

---

## File Structure

**Create:**
- `desktop/release/__init__.py` — marks `release` as an importable package for tests.
- `desktop/release/version.py` — `read_version(pyproject_path) -> str`; CLI prints version.
- `desktop/release/verify_bundle.py` — `scan_bundle(root) -> list[str]`; CLI exits 1 on findings.
- `desktop/release/entitlements.plist` — hardened-runtime entitlements.
- `desktop/release/make_icon.sh` — `tray-icon.png` → `AppIcon.icns`.
- `desktop/release/package_macos.sh` — icon → build → verify → sign → dmg → notarize → staple.
- `desktop/release/release_github.sh` — guards + `gh release create`.
- `desktop/tests/test_version.py` — tests for `version.read_version`.
- `desktop/tests/test_verify_bundle.py` — tests for `verify_bundle.scan_bundle`.

**Modify:**
- `desktop/ollie-reader-desktop.spec` — append `BUNDLE`, inject version into `Info.plist`.
- `desktop/.gitignore` — ignore generated `assets/AppIcon.icns` + `assets/AppIcon.iconset`.
- `Makefile` — add `desktop-icon`, `desktop-verify`, `desktop-dmg`, `desktop-release`.
- `desktop/README.md` — document the dmg/release flow.

---

## Task 1: Version reader helper

**Files:**
- Create: `desktop/release/__init__.py` (empty)
- Create: `desktop/release/version.py`
- Test: `desktop/tests/test_version.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `release.version.read_version(pyproject_path: str | os.PathLike) -> str` (reads `[project].version`); running `python release/version.py [pyproject_path]` prints the version (defaults to `pyproject.toml` in cwd). Used by both Bash scripts and the spec fallback.

- [ ] **Step 1: Create the package marker**

```bash
mkdir -p desktop/release
: > desktop/release/__init__.py
```

- [ ] **Step 2: Write the failing test**

Create `desktop/tests/test_version.py`:

```python
import textwrap

import pytest

from release.version import read_version


def test_reads_project_version_from_real_pyproject():
    assert read_version("pyproject.toml") == "0.1.0"


def test_reads_version_from_arbitrary_pyproject(tmp_path):
    p = tmp_path / "pyproject.toml"
    p.write_text(
        textwrap.dedent(
            """
            [project]
            name = "x"
            version = "9.8.7"
            """
        )
    )
    assert read_version(p) == "9.8.7"


def test_missing_version_raises(tmp_path):
    p = tmp_path / "pyproject.toml"
    p.write_text('[project]\nname = "x"\n')
    with pytest.raises(KeyError):
        read_version(p)
```

- [ ] **Step 3: Run test to verify it fails**

Run: `make desktop-test` (or `uv run --directory desktop pytest tests/test_version.py -v`)
Expected: FAIL — `ModuleNotFoundError: No module named 'release.version'`.

- [ ] **Step 4: Write minimal implementation**

Create `desktop/release/version.py`:

```python
"""Single source of truth for the desktop app version (from pyproject.toml)."""

import sys
import tomllib
from os import PathLike


def read_version(pyproject_path: "str | PathLike[str]") -> str:
    with open(pyproject_path, "rb") as f:
        data = tomllib.load(f)
    return data["project"]["version"]


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "pyproject.toml"
    print(read_version(path))
```

- [ ] **Step 5: Run test to verify it passes**

Run: `uv run --directory desktop pytest tests/test_version.py -v`
Expected: 3 passed.

- [ ] **Step 6: Verify the CLI**

Run: `uv run --directory desktop python release/version.py`
Expected output: `0.1.0`

- [ ] **Step 7: Commit**

```bash
git add desktop/release/__init__.py desktop/release/version.py desktop/tests/test_version.py
git commit -m "feat(desktop): add version reader helper for packaging"
```

---

## Task 2: Bundle security guard

**Files:**
- Create: `desktop/release/verify_bundle.py`
- Test: `desktop/tests/test_verify_bundle.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `release.verify_bundle.scan_bundle(root: str | os.PathLike) -> list[str]` — returns a list of human-readable finding strings (empty = clean). `main()`/CLI: `python release/verify_bundle.py <path>` prints findings and exits `1` if any, else prints `OK` and exits `0`.

**Design notes for the implementer:**
- Filename denylist must NOT blanket-match `*.pem`/`*.key` — `certifi/cacert.pem` is a legitimate public CA bundle and would false-positive. Catch private keys via the **content** pattern `BEGIN … PRIVATE KEY` instead.
- Content scan only small text-ish files (skip files > 1 MiB and known-binary extensions) so it doesn't crawl the 256 MB `.onnx`/`.bin`/`.dylib` payload.

- [ ] **Step 1: Write the failing test**

Create `desktop/tests/test_verify_bundle.py`:

```python
from release.verify_bundle import scan_bundle


def _app(tmp_path):
    root = tmp_path / "ollie-reader.app" / "Contents"
    (root / "MacOS").mkdir(parents=True)
    (root / "Resources").mkdir(parents=True)
    return tmp_path / "ollie-reader.app"


def test_clean_bundle_has_no_findings(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / "models").mkdir()
    (app / "Contents" / "Resources" / "models" / "voices.bin").write_bytes(b"\x00" * 10)
    assert scan_bundle(app) == []


def test_dotenv_file_is_flagged(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / ".env.local").write_text("APPLE_APP_PASSWORD=abcd-efgh\n")
    findings = scan_bundle(app)
    assert findings  # non-empty
    assert any(".env" in f for f in findings)


def test_p12_file_is_flagged(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / "cert.p12").write_bytes(b"\x00\x01")
    assert any(".p12" in f for f in scan_bundle(app))


def test_private_key_content_is_flagged(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / "config.txt").write_text(
        "-----BEGIN PRIVATE KEY-----\nMIIxxx\n-----END PRIVATE KEY-----\n"
    )
    assert any("PRIVATE KEY" in f for f in scan_bundle(app))


def test_google_api_key_content_is_flagged(tmp_path):
    app = _app(tmp_path)
    (app / "Contents" / "Resources" / "settings.json").write_text(
        '{"key": "AIzaSyA1234567890_abcdefghijklmnopqrstuv"}'
    )
    assert scan_bundle(app)


def test_certifi_cacert_pem_is_not_flagged(tmp_path):
    # Public CA bundle ships legitimately; must not be a false positive.
    app = _app(tmp_path)
    certifi = app / "Contents" / "Resources" / "certifi"
    certifi.mkdir()
    (certifi / "cacert.pem").write_text(
        "-----BEGIN CERTIFICATE-----\nMIIFake\n-----END CERTIFICATE-----\n"
    )
    assert scan_bundle(app) == []
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run --directory desktop pytest tests/test_verify_bundle.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'release.verify_bundle'`.

- [ ] **Step 3: Write minimal implementation**

Create `desktop/release/verify_bundle.py`:

```python
"""Scan a built .app bundle for secret/.env material before signing & release.

Exit non-zero if anything suspicious is found. Designed to be the gate between
PyInstaller output and codesign/dmg/upload.
"""

import re
import sys
from pathlib import Path

# Matched against each file's basename (case-insensitive).
_DENY_NAME = [
    re.compile(r"^\.env($|\.)", re.I),          # .env, .env.local, .env.package…
    re.compile(r"\.p12$", re.I),
    re.compile(r"\.pfx$", re.I),
    re.compile(r"^id_(rsa|dsa|ecdsa|ed25519)$", re.I),  # private keys (not .pub)
    re.compile(r"service[_-]?account.*\.json$", re.I),
    re.compile(r"(^|[-_])credentials\.json$", re.I),
]
# Directory names that should never appear inside a shipped bundle.
_DENY_DIR = {".git"}

# Content patterns — scanned only on small text-ish files.
_DENY_CONTENT = [
    (re.compile(rb"APPLE_APP_PASSWORD"), "APPLE_APP_PASSWORD"),
    (re.compile(rb"APPLE_CERTIFICATE"), "APPLE_CERTIFICATE"),
    (re.compile(rb"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "PRIVATE KEY block"),
    (re.compile(rb"AKIA[0-9A-Z]{16}"), "AWS access key"),
    (re.compile(rb"AIza[0-9A-Za-z_\-]{35}"), "Google API key"),
    (re.compile(rb"xox[baprs]-[0-9A-Za-z-]{10,}"), "Slack token"),
]
_SKIP_CONTENT_SUFFIX = {
    ".onnx", ".bin", ".dylib", ".so", ".zip", ".dat", ".a", ".png",
    ".jpg", ".jpeg", ".icns", ".pyc", ".woff", ".woff2", ".ttf",
}
_MAX_CONTENT_BYTES = 1024 * 1024  # 1 MiB


def scan_bundle(root: "str | Path") -> "list[str]":
    root = Path(root)
    findings: "list[str]" = []
    if not root.exists():
        return [f"bundle does not exist: {root}"]

    for path in root.rglob("*"):
        rel = path.relative_to(root)
        if path.is_dir():
            if path.name in _DENY_DIR:
                findings.append(f"forbidden directory: {rel}")
            continue
        name = path.name
        for pat in _DENY_NAME:
            if pat.search(name):
                findings.append(f"forbidden filename: {rel}")
                break
        if path.suffix.lower() in _SKIP_CONTENT_SUFFIX:
            continue
        try:
            if path.stat().st_size > _MAX_CONTENT_BYTES:
                continue
            data = path.read_bytes()
        except OSError:
            continue
        for pat, label in _DENY_CONTENT:
            if pat.search(data):
                findings.append(f"secret content ({label}) in: {rel}")

    # de-dup while preserving order
    seen: "set[str]" = set()
    out: "list[str]" = []
    for f in findings:
        if f not in seen:
            seen.add(f)
            out.append(f)
    return out


def main(argv: "list[str]") -> int:
    if len(argv) != 2:
        print("usage: verify_bundle.py <path-to-.app>", file=sys.stderr)
        return 2
    findings = scan_bundle(argv[1])
    if findings:
        print(f"SECURITY GUARD FAILED — {len(findings)} finding(s) in {argv[1]}:")
        for f in findings:
            print(f"  - {f}")
        return 1
    print(f"OK — no secret/.env material found in {argv[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
```

- [ ] **Step 4: Run test to verify it passes**

Run: `uv run --directory desktop pytest tests/test_verify_bundle.py -v`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add desktop/release/verify_bundle.py desktop/tests/test_verify_bundle.py
git commit -m "feat(desktop): add bundle security guard to block secrets in artifact"
```

---

## Task 3: App icon generation

**Files:**
- Create: `desktop/release/make_icon.sh`
- Modify: `desktop/.gitignore`
- Modify: `Makefile` (add `desktop-icon` target)

**Interfaces:**
- Consumes: `desktop/assets/tray-icon.png` (512×512).
- Produces: `desktop/assets/AppIcon.icns` (gitignored), consumed by the spec `BUNDLE` (Task 4) and the build script (Task 5).

> The source is 512×512, so the 1024px `@2x` slot is upscaled — the icon is slightly soft at the largest size. Acceptable for now; swap in a 1024px source later for crisper output.
>
> This task comes before the spec change (Task 4) because `BUNDLE(icon="assets/AppIcon.icns")` requires the `.icns` to exist at build time.

- [ ] **Step 1: Write the icon script**

Create `desktop/release/make_icon.sh`:

```bash
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
```

- [ ] **Step 2: Add the Makefile target**

In `Makefile`, add `desktop-icon` to the `.PHONY` list and add this target under the Desktop section (before `desktop-package`):

```make
desktop-icon: ## Generate assets/AppIcon.icns from tray-icon.png
	bash $(DESKTOP)/release/make_icon.sh
```

- [ ] **Step 3: Ignore generated icon artifacts**

Append to `desktop/.gitignore`:

```
assets/AppIcon.icns
assets/AppIcon.iconset/
```

- [ ] **Step 4: Run and verify**

Run:
```bash
make desktop-icon
file desktop/assets/AppIcon.icns
```
Expected: `wrote assets/AppIcon.icns`, and `file` reports `Mac OS X icon` (icns). Confirm it is gitignored:
```bash
git check-ignore desktop/assets/AppIcon.icns && echo "ignored OK"
```
Expected: prints the path + `ignored OK`.

- [ ] **Step 5: Commit**

```bash
git add desktop/release/make_icon.sh desktop/.gitignore Makefile
git commit -m "feat(desktop): generate AppIcon.icns from tray-icon.png"
```

---

## Task 4: `.app` bundle — entitlements + spec BUNDLE step

**Files:**
- Create: `desktop/release/entitlements.plist`
- Modify: `desktop/ollie-reader-desktop.spec` (add helper near the top; append `BUNDLE` after the existing `coll = COLLECT(...)` block at the end of the file)
- Modify: `desktop/README.md` (packaging section)

**Interfaces:**
- Consumes: `desktop/assets/AppIcon.icns` (Task 3); `OLLIE_BUNDLE_VERSION` env var (optional; set by Task 5's script) with fallback to reading `pyproject.toml` directly so `make desktop-package` works standalone.
- Produces: `desktop/dist/ollie-reader.app` with `Info.plist` carrying the bundle id, version, and `LSUIElement`. Consumed by Task 5.

This task is verify-by-execution (no unit test — PyInstaller output is validated by inspecting the produced `.app`).

- [ ] **Step 1: Create the entitlements file**

Create `desktop/release/entitlements.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
</dict>
</plist>
```

- [ ] **Step 2: Add version helper + BUNDLE to the spec**

In `desktop/ollie-reader-desktop.spec`, at the very top after the existing imports (`from pathlib import Path`), add:

```python
import os
import tomllib


def _bundle_version() -> str:
    env = os.environ.get("OLLIE_BUNDLE_VERSION")
    if env:
        return env
    with open("pyproject.toml", "rb") as f:
        return tomllib.load(f)["project"]["version"]
```

Then at the END of the file, immediately after the existing `coll = COLLECT(...)` block, append:

```python
app = BUNDLE(
    coll,
    name="ollie-reader.app",
    icon="assets/AppIcon.icns",
    bundle_identifier="com.victorfu.ollie-reader",
    version=_bundle_version(),
    info_plist={
        "CFBundleShortVersionString": _bundle_version(),
        "CFBundleVersion": _bundle_version(),
        "LSUIElement": True,
        "NSHighResolutionCapable": True,
        "LSMinimumSystemVersion": "12.0",
    },
)
```

- [ ] **Step 3: Build (icon from Task 3 already exists)**

Run:
```bash
make desktop-package
```
Expected: build completes; `desktop/dist/ollie-reader.app` now exists. (If `assets/AppIcon.icns` is missing, run `make desktop-icon` from Task 3 first.)

- [ ] **Step 4: Verify the bundle shape and Info.plist**

Run:
```bash
test -d desktop/dist/ollie-reader.app && echo "APP OK"
/usr/bin/plutil -p desktop/dist/ollie-reader.app/Contents/Info.plist \
  | grep -E 'CFBundleIdentifier|CFBundleShortVersionString|LSUIElement'
```
Expected: `APP OK`, `CFBundleIdentifier => "com.victorfu.ollie-reader"`, `CFBundleShortVersionString => "0.1.0"`, `LSUIElement => 1`.

- [ ] **Step 5: Update the README packaging section**

In `desktop/README.md`, replace the `## 打包（PyInstaller）` body so the產物 line reads `dist/ollie-reader.app`, and add a pointer:

```markdown
## 打包（PyInstaller）

```bash
make desktop-package
# 產物：dist/ollie-reader.app（macOS .app bundle，托盤 App，不顯示於 Dock）
```

要產生「已簽章 + 公證」的 dmg 並發佈到 GitHub，見「發佈 dmg」一節。
```

- [ ] **Step 6: Commit**

```bash
git add desktop/release/entitlements.plist desktop/ollie-reader-desktop.spec desktop/README.md
git commit -m "feat(desktop): emit .app bundle via PyInstaller BUNDLE step"
```

---

## Task 5: Sign + dmg + notarize pipeline

**Files:**
- Create: `desktop/release/package_macos.sh`
- Modify: `Makefile` (add `desktop-verify`, `desktop-dmg` targets)

**Interfaces:**
- Consumes: `.env.package` (repo root) with `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_CERTIFICATE`; `release/version.py`; `release/verify_bundle.py`; `release/entitlements.plist`; `make desktop-icon` + `make desktop-package`.
- Produces: `desktop/dist/ollie-reader-<version>.dmg` (signed, notarized, stapled) + `…dmg.sha256`. Consumed by Task 6.

> This is the one task that contacts Apple's notary service (network, typically 1–5 min via `--wait`). It needs valid credentials in `.env.package`. Verification = real signing + `spctl`/`stapler` checks.

- [ ] **Step 1: Write the packaging script**

Create `desktop/release/package_macos.sh`:

```bash
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
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x desktop/release/package_macos.sh desktop/release/make_icon.sh`

- [ ] **Step 3: Add Makefile targets**

In `Makefile`, add `desktop-verify desktop-dmg` to `.PHONY`, and add under the Desktop section:

```make
desktop-verify: ## Scan the built .app for secrets/.env (fails if any found)
	$(UV) run --directory $(DESKTOP) python release/verify_bundle.py dist/ollie-reader.app

desktop-dmg: ## Build a signed + notarized dmg (requires .env.package)
	bash $(DESKTOP)/release/package_macos.sh
```

- [ ] **Step 4: Dry-run the security guard alone (fast, no Apple calls)**

First confirm the guard passes on a real build:
```bash
make desktop-icon && make desktop-package && make desktop-verify
```
Expected: `OK — no secret/.env material found in dist/ollie-reader.app`.

Then confirm it actually catches a leak (must FAIL):
```bash
echo "APPLE_APP_PASSWORD=test" > desktop/dist/ollie-reader.app/Contents/Resources/.env.leak
make desktop-verify; echo "exit=$?"
rm -f desktop/dist/ollie-reader.app/Contents/Resources/.env.leak
```
Expected: prints `SECURITY GUARD FAILED …`, `exit=1`.

- [ ] **Step 5: Run the full signed + notarized build**

Run: `make desktop-dmg`
Expected: ends with `built and notarized: …/ollie-reader-0.1.0.dmg`. Notary `--wait` prints `status: Accepted`.

- [ ] **Step 6: Verify signature, notarization, staple**

Run:
```bash
codesign --verify --deep --strict --verbose=2 desktop/dist/ollie-reader.app
xcrun stapler validate desktop/dist/ollie-reader-0.1.0.dmg
spctl -a -t open --context context:primary-signature -v desktop/dist/ollie-reader-0.1.0.dmg
ls -lh desktop/dist/ollie-reader-0.1.0.dmg desktop/dist/ollie-reader-0.1.0.dmg.sha256
```
Expected: `valid on disk` / `satisfies its Designated Requirement`, `The validate action worked!`, `source=Notarized Developer ID`, and both files present (~280 MB dmg).

- [ ] **Step 7: Commit**

```bash
git add desktop/release/package_macos.sh Makefile
git commit -m "feat(desktop): sign, notarize, and build dmg from .env.package"
```

---

## Task 6: GitHub release publishing

**Files:**
- Create: `desktop/release/release_github.sh`
- Modify: `Makefile` (add `desktop-release` target)
- Modify: `desktop/README.md` (add "發佈 dmg" section)

**Interfaces:**
- Consumes: the dmg + sha256 from Task 5; `release/version.py`; `gh` CLI (authenticated); `git`.
- Produces: a GitHub Release tagged `desktop-v<version>` with the dmg + checksum attached.

- [ ] **Step 1: Write the release script**

Create `desktop/release/release_github.sh`:

```bash
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
```

- [ ] **Step 2: Make executable + add Makefile target**

Run: `chmod +x desktop/release/release_github.sh`

In `Makefile`, add `desktop-release` to `.PHONY` and add:

```make
desktop-release: desktop-dmg ## Publish the dmg to GitHub Releases as desktop-v<version>
	bash $(DESKTOP)/release/release_github.sh
```

- [ ] **Step 3: Verify the guards fire (without publishing)**

Confirm `gh` is authenticated and the abort paths work:
```bash
gh auth status
# tag-exists guard is the safe one to observe; this should NOT publish:
mv desktop/dist/ollie-reader-0.1.0.dmg /tmp/keep.dmg 2>/dev/null || true
bash desktop/release/release_github.sh; echo "exit=$?"
mv /tmp/keep.dmg desktop/dist/ollie-reader-0.1.0.dmg 2>/dev/null || true
```
Expected: `ABORT: missing …ollie-reader-0.1.0.dmg …`, `exit=1` (proves it refuses to publish without the artifact).

- [ ] **Step 4: Publish for real**

Run: `make desktop-release`
Expected: ends with `published desktop-v0.1.0`.

- [ ] **Step 5: Verify the release + assets**

Run:
```bash
gh release view desktop-v0.1.0 --repo victorfu/ollie-reader
gh release view desktop-v0.1.0 --repo victorfu/ollie-reader --json assets \
  --jq '.assets[].name'
```
Expected: the release exists; assets list is exactly `ollie-reader-0.1.0.dmg` and `ollie-reader-0.1.0.dmg.sha256` (no `.env` anything).

- [ ] **Step 6: Document the flow in the README**

Append to `desktop/README.md`:

```markdown
## 發佈 dmg（簽章 + 公證 + GitHub Release）

需要 repo 根目錄的 `.env.package`（Apple 憑證/帳號,已 gitignore)與 Xcode CLT、
`create-dmg`、已登入的 `gh`。

```bash
make desktop-dmg       # 產生 dist/ollie-reader-<版本>.dmg(已簽章、公證、staple)
make desktop-release   # 把 dmg + .sha256 發佈為 GitHub Release desktop-v<版本>
```

打包前會自動跑安全掃描(`release/verify_bundle.py`),若 `.app` 內含任何
`.env`/憑證/私鑰就中止,確保機密不會進入發佈物。版本號以 `pyproject.toml` 為準。
僅支援 Apple Silicon(arm64)。
```

- [ ] **Step 7: Commit**

```bash
git add desktop/release/release_github.sh Makefile desktop/README.md
git commit -m "feat(desktop): publish notarized dmg to GitHub Releases"
```

---

## Self-Review

**Spec coverage:**
- §1 `.app`/BUNDLE/arch/LSUIElement → Task 4. ✓
- §2 icon from png → Task 3. ✓
- §3 sign/notarize/temp keychain/entitlements/dmg/sha256 → Task 5 (+ entitlements file in Task 4). ✓
- §4 security guard (filename + content scan, abort) → Task 2 (logic) + Task 5 Step 4 (wired in build). ✓
- §5 publish, tag `desktop-v<v>`, repo guard, dmg+sha256 only → Task 6. ✓
- §6 Makefile surface (`desktop-icon`/`desktop-package`/`desktop-verify`/`desktop-dmg`/`desktop-release`) → Tasks 3,5,6 (package pre-exists). ✓
- Version single-source → Task 1, consumed in Tasks 4/5/6. ✓
- Out-of-scope items (web `.env.local`, universal2, GH Actions) correctly omitted. ✓

**Placeholder scan:** No TBD/TODO; every code/shell step has full content; commands have expected output. ✓

**Type/name consistency:** `read_version(pyproject_path)` (Task 1) used identically in spec fallback (Task 4) and scripts (Tasks 5/6). `scan_bundle(root)`/CLI exit codes (Task 2) match the `verify_bundle.py` invocation in Task 5. dmg path `dist/ollie-reader-<version>.dmg` consistent across Tasks 5/6. `release/` package name used uniformly. Makefile var `$(DESKTOP)`/`$(UV)` match existing file. ✓

**Task ordering:** Icon generation (Task 3) precedes the spec `BUNDLE` change (Task 4) so `assets/AppIcon.icns` exists before any build references it. Tasks 1–2 are independent (pure helpers + tests). Task 5 is the only task that contacts Apple's notary service; Task 6 is the only task that mutates the public GitHub repo.
