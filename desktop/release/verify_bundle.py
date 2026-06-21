"""Scan a built .app bundle for secret/.env material before signing & release.

Exit non-zero if anything suspicious is found. Designed to be the gate between
PyInstaller output and codesign/dmg/upload.
"""

import re
import sys
from pathlib import Path

# Matched against each file's basename (case-insensitive).
_DENY_NAME = [
    re.compile(r"^\.env($|\.)", re.I),          # .env, .env.local, .env.package…
    re.compile(r"\.p12$", re.I),
    re.compile(r"\.pfx$", re.I),
    re.compile(r"^id_(rsa|dsa|ecdsa|ed25519)$", re.I),  # private keys (not .pub)
    re.compile(r"service[_-]?account.*\.json$", re.I),
    re.compile(r"(^|[-_])credentials\.json$", re.I),
]
# Directory names that should never appear inside a shipped bundle.
_DENY_DIR = {".git"}

# Content patterns — scanned only on small text-ish files.
_DENY_CONTENT = [
    (re.compile(rb"APPLE_APP_PASSWORD"), "APPLE_APP_PASSWORD"),
    (re.compile(rb"APPLE_CERTIFICATE"), "APPLE_CERTIFICATE"),
    (re.compile(rb"-----BEGIN [A-Z ]*PRIVATE KEY-----"), "PRIVATE KEY block"),
    (re.compile(rb"AKIA[0-9A-Z]{16}"), "AWS access key"),
    (re.compile(rb"AIza[0-9A-Za-z_\-]{35}"), "Google API key"),
    (re.compile(rb"xox[baprs]-[0-9A-Za-z-]{10,}"), "Slack token"),
    (re.compile(rb'"type"\s*:\s*"service_account"'), "GCP/Firebase service account JSON"),
]
_SKIP_CONTENT_SUFFIX = {
    ".onnx", ".bin", ".dylib", ".so", ".zip", ".dat", ".a", ".png",
    ".jpg", ".jpeg", ".icns", ".pyc", ".woff", ".woff2", ".ttf",
}
_MAX_CONTENT_BYTES = 1024 * 1024  # 1 MiB


def scan_bundle(root: "str | Path") -> "list[str]":
    root = Path(root)
    findings: "list[str]" = []
    if not root.exists():
        return [f"bundle does not exist: {root}"]

    for path in root.rglob("*"):
        rel = path.relative_to(root)
        if path.is_dir():
            if path.name in _DENY_DIR:
                findings.append(f"forbidden directory: {rel}")
            continue
        name = path.name
        for pat in _DENY_NAME:
            if pat.search(name):
                findings.append(f"forbidden filename: {rel}")
                break
        if path.suffix.lower() in _SKIP_CONTENT_SUFFIX:
            continue
        try:
            if path.stat().st_size > _MAX_CONTENT_BYTES:
                continue
            data = path.read_bytes()
        except OSError:
            continue
        for pat, label in _DENY_CONTENT:
            if pat.search(data):
                findings.append(f"secret content ({label}) in: {rel}")

    # de-dup while preserving order
    seen: "set[str]" = set()
    out: "list[str]" = []
    for f in findings:
        if f not in seen:
            seen.add(f)
            out.append(f)
    return out


def main(argv: "list[str]") -> int:
    if len(argv) != 2:
        print("usage: verify_bundle.py <path-to-.app>", file=sys.stderr)
        return 2
    findings = scan_bundle(argv[1])
    if findings:
        print(f"SECURITY GUARD FAILED — {len(findings)} finding(s) in {argv[1]}:")
        for f in findings:
            print(f"  - {f}")
        return 1
    print(f"OK — no secret/.env material found in {argv[1]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
