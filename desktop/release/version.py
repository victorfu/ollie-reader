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
