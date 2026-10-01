#!/usr/bin/env python3
"""Required local checks for a claimed Issue; no merge, push, PR or model launch."""
import argparse
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def commands(base, body, full=False, head=None):
    blocks = re.findall(r"```verify\s*\n(.*?)```", body, re.S)
    verify = [line.strip() for block in blocks for line in block.splitlines()
              if line.strip() and not line.lstrip().startswith("#")]
    if not verify:
        raise ValueError("Issue must contain a nonempty verify block")
    diff = subprocess.run(["git", "diff", "--name-only", "-z", base, *([head] if head else []), "--"], cwd=ROOT,
                          capture_output=True, text=True, check=True).stdout
    paths = [p for p in diff.split("\0") if p]
    packages = sorted({"/".join(p.split("/")[:2]) for p in paths
                       if p.startswith("packages/")})
    checks = [["bash", "-e", "-o", "pipefail", "-c", c] for c in verify]
    for package in packages:
        manifest = ROOT / package / "package.json"
        if not manifest.exists():
            raise ValueError(f"Changed package missing manifest: {package}; define explicit checks")
        scripts = json.loads(manifest.read_text()).get("scripts", {})
        for check in ("lint", "type-check"):
            if check in scripts:
                checks.append(["pnpm", "-C", package, check])
    if full or len(packages) > 1 or any(p in {"package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
                                           "eslint.config.mjs"} for p in paths):
        checks.append(["pnpm", "check"])
    if packages:
        checks += [["pnpm", "build:library"], ["node", ".github/scripts/check-packages.mjs"]]
    # Conservative: CSS generation, browser insert/scope and server scope changes all need the ratchet.
    if any(p.startswith(("packages/barocss/src/", "packages/barocss-browser/src/",
                         "packages/barocss-server/src/", "scripts/fuzz/")) for p in paths):
        checks.append(["node", "scripts/fuzz/browser-ratchet.mjs"])
    return checks


def run(checks):
    for command in checks:
        print("RUN " + json.dumps(command), flush=True)
        subprocess.run(command, cwd=ROOT, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Task base or pre-merge integration SHA")
    parser.add_argument("--issue-body", required=True, type=Path)
    parser.add_argument("--head", help="Compare committed changes only (HEAD after merge); preserve unrelated dirty work")
    parser.add_argument("--full", action="store_true", help="Core change, unclear impact or required acceptance")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        checks = commands(args.base, args.issue_body.read_text(), args.full, args.head)
        if args.dry_run:
            print(json.dumps(checks, indent=2))
        else:
            run(checks)
    except (ValueError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"Verification blocked: {error}\n")


if __name__ == "__main__":
    main()
