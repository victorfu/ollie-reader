import subprocess
from pathlib import Path

import pytest

from release.provenance import (
    ProvenanceError,
    current_commit,
    ensure_clean_worktree,
    record_asset_commit,
    verify_asset_commit,
)


def _git(repo, *args):
    return subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()


@pytest.fixture
def repo(tmp_path):
    repo_root = tmp_path / "repo"
    repo_root.mkdir()
    _git(repo_root, "init", "-q")
    _git(repo_root, "config", "user.name", "Test")
    _git(repo_root, "config", "user.email", "test@example.com")
    (repo_root / "source.txt").write_text("v1")
    _git(repo_root, "add", "source.txt")
    _git(repo_root, "commit", "-qm", "initial")
    return repo_root


def test_record_and_verify_asset_commit(repo, tmp_path):
    provenance = tmp_path / "asset.commit"
    commit = current_commit(repo)

    assert record_asset_commit(repo, provenance, commit) == commit
    assert verify_asset_commit(repo, provenance) == commit


def test_clean_check_rejects_uncommitted_source(repo):
    (repo / "source.txt").write_text("dirty")

    with pytest.raises(ProvenanceError, match="not clean"):
        ensure_clean_worktree(repo)


def test_clean_check_rejects_untracked_source(repo):
    (repo / "new-source.py").write_text("print('new')")

    with pytest.raises(ProvenanceError, match="not clean"):
        ensure_clean_worktree(repo)


def test_verify_rejects_asset_from_another_commit(repo, tmp_path):
    provenance = tmp_path / "asset.commit"
    old_commit = current_commit(repo)
    record_asset_commit(repo, provenance, old_commit)
    (repo / "source.txt").write_text("v2")
    _git(repo, "add", "source.txt")
    _git(repo, "commit", "-qm", "second")

    with pytest.raises(ProvenanceError, match="asset was built"):
        verify_asset_commit(repo, provenance)


def test_record_rejects_commit_change_during_packaging(repo, tmp_path):
    old_commit = current_commit(repo)
    (repo / "source.txt").write_text("v2")
    _git(repo, "add", "source.txt")
    _git(repo, "commit", "-qm", "second")

    with pytest.raises(ProvenanceError, match="changed during packaging"):
        record_asset_commit(repo, tmp_path / "asset.commit", old_commit)


def test_release_scripts_enforce_asset_and_tag_provenance():
    release_dir = Path(__file__).resolve().parents[1] / "release"
    package_script = (release_dir / "package_macos.sh").read_text(encoding="utf-8")
    github_script = (release_dir / "release_github.sh").read_text(encoding="utf-8")

    assert "provenance.py check" in package_script
    assert "provenance.py record" in package_script
    assert "provenance.py verify" in github_script
    assert "--verify-tag" in github_script
    assert '--target "$SOURCE_COMMIT"' in github_script
