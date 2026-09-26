#!/usr/bin/env python3
"""Stand-in for `gh` in the supervisor tests (mechanical merges). Never talks to GitHub.

  gh pr view N --json <fields>  prints the requested fields: files from $SUP_FAKE_GH_FILES (JSON list; default
                                [".ai/STATE.yaml"]), mergeStateStatus from $SUP_FAKE_GH_STATE (default CLEAN),
                                headRefOid from $SUP_FAKE_GH_HEAD (default: none, so any observed head matches)
  gh pr update-branch N         appends argv to $SUP_FAKE_GH_ARGV and sets the state file (if any) to CLEAN
  gh pr merge N --merge …       appends argv to $SUP_FAKE_GH_ARGV, then writes $SUP_FAKE_GH_WORLD (if set) to
                                $SUP_FAKE_WORLD and exits $SUP_FAKE_GH_EXIT (default 0)
$SUP_FAKE_GH_STATE_FILE, when set, holds mergeStateStatus instead of the env var, so update-branch can change it.
"""
import json, os, sys

args = sys.argv[1:]
state_file = os.environ.get("SUP_FAKE_GH_STATE_FILE")


def state():
    if state_file and os.path.exists(state_file):
        return open(state_file).read().strip()
    return os.environ.get("SUP_FAKE_GH_STATE", "CLEAN")


if args[:2] == ["pr", "view"]:
    fields = args[args.index("--json") + 1].split(",") if "--json" in args else []
    out = {}
    if "files" in fields:
        out["files"] = [{"path": p} for p in json.loads(os.environ.get("SUP_FAKE_GH_FILES", '[".ai/STATE.yaml"]'))]
    if "mergeStateStatus" in fields:
        out["mergeStateStatus"] = state()
    if "headRefOid" in fields:
        out["headRefOid"] = os.environ.get("SUP_FAKE_GH_HEAD")
    print(json.dumps(out))
    sys.exit(0)
with open(os.environ["SUP_FAKE_GH_ARGV"], "a") as fh:
    fh.write(json.dumps(args) + "\n")
if args[:2] == ["pr", "update-branch"]:
    if state_file:
        open(state_file, "w").write("CLEAN")
    sys.exit(0)
code = int(os.environ.get("SUP_FAKE_GH_EXIT", "0"))
if code:
    print("GraphQL: Head branch was modified", file=sys.stderr)
elif os.environ.get("SUP_FAKE_GH_WORLD"):
    with open(os.environ["SUP_FAKE_WORLD"], "w") as fh:
        fh.write(os.environ["SUP_FAKE_GH_WORLD"])
sys.exit(code)
