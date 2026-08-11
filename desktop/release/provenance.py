"""Source-commit provenance checks for signed desktop release assets."""

import argparse
import subprocess
from pathlib import Path


class ProvenanceError(RuntimeError):
    pass


def _git(repo_root: Path, *args: str) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_root), *args],
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError) as exc:
        raise ProvenanceError(f"git {' '.join(args)} failed") from exc
    return result.stdout.strip()


def current_commit(repo_root: "str | Path") -> str:
    return _git(Path(repo_root), "rev-parse", "HEAD")


def ensure_clean_worktree(repo_root: "str | Path") -> None:
    status = _git(
        Path(repo_root),
        "status",
        "--porcelain",
        "--untracked-files=normal",
    )
    if status:
        raise ProvenanceError(
            "release worktree is not clean; commit or remove source changes first"
        )


def record_asset_commit(
    repo_root: "str | Path",
    output_path: "str | Path",
    expected_commit: str,
) -> str:
    ensure_clean_worktree(repo_root)
    commit = current_commit(repo_root)
    if commit != expected_commit:
        raise ProvenanceError(
            f"source commit changed during packaging ({expected_commit} -> {commit})"
        )
    Path(output_path).write_text(f"{commit}\n", encoding="utf-8")
    return commit


def verify_asset_commit(
    repo_root: "str | Path",
    provenance_path: "str | Path",
) -> str:
    ensure_clean_worktree(repo_root)
    current = current_commit(repo_root)
    path = Path(provenance_path)
    try:
        recorded = path.read_text(encoding="utf-8").strip()
    except OSError as exc:
        raise ProvenanceError(f"missing release provenance file: {path}") from exc
    if recorded != current:
        raise ProvenanceError(
            f"release asset was built from {recorded or 'unknown'}, current HEAD is {current}"
        )
    return current


def main(argv: "list[str] | None" = None) -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    check = subparsers.add_parser("check")
    check.add_argument("repo_root")

    record = subparsers.add_parser("record")
    record.add_argument("repo_root")
    record.add_argument("output_path")
    record.add_argument("expected_commit")

    verify = subparsers.add_parser("verify")
    verify.add_argument("repo_root")
    verify.add_argument("provenance_path")

    args = parser.parse_args(argv)
    try:
        if args.command == "check":
            ensure_clean_worktree(args.repo_root)
            commit = current_commit(args.repo_root)
        elif args.command == "record":
            commit = record_asset_commit(
                args.repo_root,
                args.output_path,
                args.expected_commit,
            )
        else:
            commit = verify_asset_commit(args.repo_root, args.provenance_path)
    except ProvenanceError as exc:
        parser.error(str(exc))
    print(commit)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
