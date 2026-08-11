# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules

import os
import tomllib

from server.model_download import MANIFEST, validate_model_files


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
# and server/model_download.py). A frozen app never auto-downloads them, so a
# missing or corrupt input is a hard build error rather than a silently broken
# offline TTS release. No wholesale models/ copy: the dev models dir may hold
# extra variants (fp32/int8 Kokoro, experiments) that would bloat the release.
_MODEL_ERRORS = validate_model_files(Path("models"))
if _MODEL_ERRORS:
    raise SystemExit(
        "TTS model preflight failed. Run 'make desktop-models' first:\n- "
        + "\n- ".join(_MODEL_ERRORS)
    )
for _model in MANIFEST:
    _f = Path("models") / _model.filename
    datas.append((str(_f), "models"))

if Path("assets").exists():
    datas.append(("assets", "assets"))

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
