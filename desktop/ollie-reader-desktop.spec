# -*- mode: python ; coding: utf-8 -*-
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules


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

if Path("models").exists():
    datas.append(("models", "models"))

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
