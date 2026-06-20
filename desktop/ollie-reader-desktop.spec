# -*- mode: python ; coding: utf-8 -*-
import os
import shutil
from pathlib import Path

from PyInstaller.utils.hooks import collect_all, collect_submodules


def _stage_kokoro_hf_cache():
    """Build an offline-ready Hugging Face cache for the Kokoro model.

    Copies refs/main and the resolved snapshot (symlinks dereferenced into real
    files, blobs dropped) into build/hf-cache so the frozen app can load Kokoro
    with HF_HUB_OFFLINE=1. Returns the staged dir to add to datas, or None if
    the source cache isn't present on this machine.
    """
    repo = "models--hexgrad--Kokoro-82M"
    candidates = []
    if os.environ.get("HF_HUB_CACHE"):
        candidates.append(Path(os.environ["HF_HUB_CACHE"]) / repo)
    if os.environ.get("HF_HOME"):
        candidates.append(Path(os.environ["HF_HOME"]) / "hub" / repo)
    candidates.append(Path.home() / ".cache" / "huggingface" / "hub" / repo)
    src = next((p for p in candidates if (p / "refs" / "main").exists()), None)
    if src is None:
        print("WARNING: Kokoro HF cache not found; bundle will require network for Kokoro TTS.")
        return None
    rev = (src / "refs" / "main").read_text().strip()
    snap_src = src / "snapshots" / rev
    if not snap_src.exists():
        print(f"WARNING: Kokoro snapshot {rev} missing; skipping Kokoro bundling.")
        return None
    staged = Path("build") / "hf-cache"
    dst_repo = staged / "hub" / repo
    snap_dst = dst_repo / "snapshots" / rev
    if dst_repo.exists():
        shutil.rmtree(dst_repo)
    snap_dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(snap_src, snap_dst, symlinks=False)  # dereference -> real files
    (dst_repo / "refs").mkdir(parents=True, exist_ok=True)
    (dst_repo / "refs" / "main").write_text(rev)
    print(f"Staged Kokoro HF cache ({rev}) -> {staged}")
    return staged


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

_hf_staged = _stage_kokoro_hf_cache()
if _hf_staged is not None:
    datas.append((str(_hf_staged), "hf"))

for pkg in (
    "kokoro",
    "torch",
    "piper",
    "soundfile",
    "numpy",
    "language_tags",
    "espeakng_loader",
    "en_core_web_sm",
    "misaki",
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
