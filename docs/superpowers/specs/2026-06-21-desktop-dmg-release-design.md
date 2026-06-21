# Desktop dmg packaging & GitHub release — Design

<status>Approved 2026-06-21</status>

## Goal

Package the Ollie Reader desktop app (PySide6 tray + FastAPI sidecar, frozen with
PyInstaller) into a **signed, notarized macOS `.dmg`** and publish it as a **GitHub
Release**, with a hard guarantee that **no secret / `.env` material ends up in the
artifact or the release**.

## Context (current state)

- **App:** `desktop/` — PySide6 tray shell + local FastAPI sidecar (Piper/Kokoro TTS,
  PDF). Managed with `uv`. Entry: `desktop/main.py`.
- **Packaging today:** `make desktop-package` → `pyinstaller ollie-reader-desktop.spec`.
  The spec stops at `COLLECT`, producing a loose folder
  `desktop/dist/ollie-reader/ollie-reader` — **not** a `.app` bundle.
- **Models:** `desktop/models/` ≈ 256 MB (gitignored), bundled by the spec.
- **Secrets:** `desktop/` sidecar source references **no** secrets/`.env`. Apple signing
  secrets live in **`.env.package`** at repo root (gitignored, never tracked in git
  history): `APPLE_ID`, `APPLE_TEAM_ID`, `APPLE_APP_PASSWORD`,
  `APPLE_CERTIFICATE_PASSWORD`, `APPLE_CERTIFICATE` (base64 `.p12`).
- **Repo:** `victorfu/ollie-reader` is **PUBLIC** → release assets are world-readable.
- **Host / tooling:** arm64 Mac; `codesign`, `xcrun notarytool` (Xcode), and
  `create-dmg` (Homebrew) all present.
- **Current version:** `desktop/pyproject.toml` → `0.1.0`.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Build location | **Local Mac → `gh release`**. Apple secrets + 256 MB models never leave the machine. |
| App icon | **Generate `.icns` from `assets/tray-icon.png`** at build time (gitignored). |
| Release tag / version | **`desktop-v<version>`**, version from `desktop/pyproject.toml`. |
| Bundle identifier | `com.victorfu.ollie-reader` |
| Dock presence | **`LSUIElement=true`** — tray/menu-bar app, no Dock icon. |
| Target arch | **arm64-only** (Apple Silicon) for the first release. Universal2 deferred. |
| Min macOS | `LSMinimumSystemVersion=12.0` |

## Architecture / components

Each unit is independently runnable and testable; orchestration lives in the Makefile.

### 1. `.app` bundle — modify `desktop/ollie-reader-desktop.spec`

Append a `BUNDLE` step after `COLLECT`:

```python
app = BUNDLE(
    coll,
    name="ollie-reader.app",
    icon="assets/AppIcon.icns",
    bundle_identifier="com.victorfu.ollie-reader",
    info_plist={
        "CFBundleShortVersionString": "<version from pyproject>",
        "CFBundleVersion": "<version from pyproject>",
        "LSUIElement": True,
        "NSHighResolutionCapable": True,
        "LSMinimumSystemVersion": "12.0",
    },
)
```

Output becomes `desktop/dist/ollie-reader.app`. Version is injected at build time (the
build script reads `pyproject.toml` and passes it in, e.g. via env consumed by the spec)
so the plist never drifts from the source of truth.

### 2. Icon — `make desktop-icon`

`assets/tray-icon.png` → `AppIcon.iconset` (multiple sizes via `sips`) → `AppIcon.icns`
(`iconutil`). Output `desktop/assets/AppIcon.icns` is **gitignored**; the png stays the
single source of truth and the icns is regenerated each build.

### 3. Package + sign + notarize — `desktop/scripts/package_macos.sh`

Sources `.env.package` from repo root. Steps:

1. **Import cert into a temporary keychain.** Decode base64 `APPLE_CERTIFICATE` → temp
   `.p12`; `security create-keychain` + `import` with `APPLE_CERTIFICATE_PASSWORD`. A
   `trap` deletes the temp keychain + `.p12` on exit (success or failure). Login keychain
   is never touched.
2. **Sign inside-out.** Sign every nested Mach-O (`.dylib`, `.so`, the inner executable),
   then the `.app`, with `--options runtime` (hardened runtime), the
   `Developer ID Application` identity, and `desktop/packaging/entitlements.plist`.
3. **Build dmg.** `create-dmg` with an `/Applications` drag symlink; `hdiutil` fallback.
   Output `desktop/dist/ollie-reader-<version>.dmg`.
4. **Notarize + staple.** `xcrun notarytool submit … --apple-id $APPLE_ID --team-id
   $APPLE_TEAM_ID --password $APPLE_APP_PASSWORD --wait`, then `xcrun stapler staple` the
   dmg. Verify with `spctl -a -t open --context context:primary-signature`.
5. Emit `ollie-reader-<version>.dmg.sha256` alongside.

**Entitlements** (`desktop/packaging/entitlements.plist`) — required for a
PyInstaller-frozen Python + onnxruntime app to pass notarization under hardened runtime:

- `com.apple.security.cs.disable-library-validation` (load our Developer-ID-signed
  bundled dylibs/.so)
- `com.apple.security.cs.allow-unsigned-executable-memory` (numpy/onnxruntime)

### 4. Security guard — `desktop/scripts/verify_bundle_clean.sh`

Runs **after** `.app` build, **before** dmg/release. Non-zero exit aborts the build.

- **Filename scan** over the whole `.app`: deny `.env*`, `*.p12`, `*.pem`, `*.key`,
  `id_rsa*`, `.git`, `credentials*`, `*serviceAccount*`.
- **Content scan** for high-risk patterns: `APPLE_APP_PASSWORD`, `BEGIN PRIVATE KEY`,
  `AKIA[0-9A-Z]{16}` (AWS), `AIza[0-9A-Za-z_\-]{35}` (Google), `serviceAccount`.
- Sanity-asserts expected payload exists (`models/`, deps) so an empty/partial bundle
  doesn't silently pass.

### 5. Publish — `desktop/scripts/release_github.sh`

- Read version from `pyproject.toml` → tag `desktop-v<version>`.
- **Repo guard:** re-assert `.env.package` is gitignored AND untracked
  (`git ls-files --error-unmatch` must fail); abort otherwise.
- Refuse if tag already exists (idempotent) or if packaging files are uncommitted.
- `gh release create desktop-v<version> <dmg> <dmg>.sha256 --title "Ollie Reader
  Desktop <version>" --notes "…"`. Uploads **only** the dmg + checksum — never an env
  file.

### 6. Makefile targets

```
make desktop-icon      # tray-icon.png → AppIcon.icns
make desktop-package   # (existing) raw PyInstaller .app
make desktop-verify    # security scan of the built .app
make desktop-dmg       # icon → package → verify → sign → dmg → notarize → staple
make desktop-release   # desktop-dmg → gh release create desktop-v<version>
```

## Data flow

```
pyproject.toml ──version──┐
tray-icon.png → AppIcon.icns
                          ▼
main.py + server/ + shell/ + models/ + assets/
   → PyInstaller (spec + BUNDLE) → dist/ollie-reader.app
   → verify_bundle_clean.sh  (ABORT if any secret/.env found)
   → codesign (hardened runtime + entitlements, temp keychain from .env.package)
   → create-dmg → ollie-reader-<v>.dmg (+ .sha256)
   → notarytool submit --wait → stapler staple
   → gh release create desktop-v<v>   (uploads dmg + sha256 only)
```

## Error handling

- **Missing `.env.package` / missing key** → fail fast with a clear message naming the key.
- **Temp keychain** always torn down via `trap` (no secret residue, no login-keychain
  pollution) even on signing failure.
- **Security guard failure** → hard abort before any signing/upload; print offending paths.
- **Notarization rejected** → surface `notarytool log` URL/output; do not staple/release.
- **Tag exists / dirty tree** → release script refuses rather than clobbering.

## Testing / verification

- No app test runner for shell packaging; verify by execution:
  - `make desktop-icon` produces a valid multi-res `.icns` (`iconutil` exit 0).
  - `make desktop-dmg` yields a dmg where `spctl -a -t open` and `codesign --verify
    --deep --strict` pass, and `stapler validate` succeeds.
  - `make desktop-verify` is unit-checked against a fixture: a planted dummy `.env` makes
    it exit non-zero; a clean tree exits 0.
  - Manual: mount dmg on a clean(ish) account, launch — Gatekeeper opens without warning.
- `make desktop-test` (existing pytest) still green.

## Out of scope

- Web app `.env.local` (Firebase/Gemini) — not part of the desktop bundle.
- Intel / universal2 builds — deferred.
- GitHub Actions automation — deferred (local build chosen); structure leaves room to add
  a macOS-runner workflow later reusing the same scripts.
- `firebase-debug.log` at repo root (gitignored) — noted, not addressed here.
