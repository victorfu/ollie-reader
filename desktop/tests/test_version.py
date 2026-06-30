import textwrap

import pytest

from release.version import read_version
from server.config import VERSION


def test_reads_project_version_from_real_pyproject():
    assert read_version("pyproject.toml") == VERSION


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
