# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

import os
import tomllib


def _bundle_version() -> str:
    env = os.environ.get("OLLIE_BUNDLE_VERSION")
    if env:
        return env
    with open("pyproject.toml", "rb") as f:
        return tomllib.load(f)["project"]["version"]


datas = []
binaries = []
hiddenimports = [
    "server.app",
    "uvicorn.logging",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan.on",
]
hiddenimports += collect_submodules("server")
hiddenimports += collect_submodules("shell")

# Bundle only the model files the sidecar actually loads (see server/config.py
# and server/model_download.py). No wholesale models/ copy: the dev models dir
# may hold extra variants (fp32/int8 Kokoro, experiments) that would silently
# bloat the release.
_BUNDLED_MODELS = (
    "en_US-lessac-medium.onnx",       # Piper
    "en_US-lessac-medium.onnx.json",  # Piper voice config
    "kokoro-v1.0.fp16.onnx",          # Kokoro (the variant config.py points at)
    "voices-v1.0.bin",                # Kokoro voices
)
for _name in _BUNDLED_MODELS:
    _f = Path("models") / _name
    if _f.exists():
        datas.append((str(_f), "models"))

if Path("assets").exists():
    datas.append(("assets", "assets"))

# NOTE: the optional Azure SDK (uv group `azure`) is intentionally NOT collected.
# /api/azure-tts needs a user-supplied subscription key, and a key can never be
# bundled (release/verify_bundle.py enforces that), so the frozen build ships the
# keyless Edge engine instead and reports 503 for Azure.
for pkg in (
    "kokoro_onnx",
    "onnxruntime",
    "phonemizer",
    "piper",
    "soundfile",
    "numpy",
    "language_tags",
    "espeakng_loader",
    # Edge TTS (/api/etts). Pure Python but reached through a lazy import inside
    # server/tts_edge.py, and aiohttp/certifi carry data files (TLS roots) that
    # PyInstaller misses without collect_all.
    "edge_tts",
    "aiohttp",
    "certifi",
):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

a = Analysis(
    ["main.py"],
    pathex=["."],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    noarchive=False,
)


# --- Trim unused payload to shrink the bundle ---------------------------------
# Qt: this is a QtWidgets tray app — it never uses QML/Quick/PDF/on-screen
# keyboard. Those frameworks have no Python bindings and are pulled in
# transitively, so drop them (~19 MB). QtCore/QtGui/QtWidgets/QtNetwork/QtDBus
# stay (used directly or wired by PyInstaller's PySide6 hook).
_QT_DROP = ("QtQml", "QtQuick", "QtVirtualKeyboard", "QtPdf")


def _is_dropped(dest: str) -> bool:
    norm = dest.replace("\\", "/")
    if "PySide6/" in norm and any(q in norm for q in _QT_DROP):
        return True
    # babel ships locale data for ~480 locales (~31 MB); Kokoro's G2P only needs
    # English. Keep root + en* .dat files, drop the rest (~27 MB).
    if "babel/locale-data/" in norm:
        fname = norm.rsplit("/", 1)[-1]
        return not (fname == "root.dat" or fname.startswith("en"))
    return False


a.binaries = [b for b in a.binaries if not _is_dropped(b[0])]
a.datas = [d for d in a.datas if not _is_dropped(d[0])]

pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="ollie-reader",
    console=False,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    name="ollie-reader",
)
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
