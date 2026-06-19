"""macOS 開機自啟：寫/移除 ~/Library/LaunchAgents 下的 LaunchAgent plist。"""

import plistlib
from pathlib import Path
from typing import Optional

LABEL = "com.ollie-reader.desktop"


def _plist_path(home: Optional[Path] = None) -> Path:
    base = home or Path.home()
    return base / "Library" / "LaunchAgents" / f"{LABEL}.plist"


def install(program_args: list[str], home: Optional[Path] = None) -> Path:
    path = _plist_path(home)
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "Label": LABEL,
        "ProgramArguments": program_args,
        "RunAtLoad": True,
        "KeepAlive": False,
    }
    with open(path, "wb") as f:
        plistlib.dump(data, f)
    return path


def uninstall(home: Optional[Path] = None) -> None:
    path = _plist_path(home)
    if path.exists():
        path.unlink()


def is_installed(home: Optional[Path] = None) -> bool:
    return _plist_path(home).exists()
