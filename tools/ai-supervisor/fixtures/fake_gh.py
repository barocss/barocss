#!/usr/bin/env python3
"""Stand-in for `gh` in test_supervise.py (mechanical merges). Never talks to GitHub.

  gh pr view N --json files   prints {"files": [{"path": …}]} from $SUP_FAKE_GH_FILES (JSON list; default [".ai/STATE.yaml"])
  gh pr merge N --merge …     appends argv to $SUP_FAKE_GH_ARGV, then writes $SUP_FAKE_GH_WORLD (if set) to
                              $SUP_FAKE_WORLD and exits $SUP_FAKE_GH_EXIT (default 0)
"""
import json, os, sys

args = sys.argv[1:]
if args[:2] == ["pr", "view"]:
    paths = json.loads(os.environ.get("SUP_FAKE_GH_FILES", '[".ai/STATE.yaml"]'))
    print(json.dumps({"files": [{"path": p} for p in paths]}))
    sys.exit(0)
with open(os.environ["SUP_FAKE_GH_ARGV"], "a") as fh:
    fh.write(json.dumps(args) + "\n")
code = int(os.environ.get("SUP_FAKE_GH_EXIT", "0"))
if code:
    print("GraphQL: Head branch was modified", file=sys.stderr)
elif os.environ.get("SUP_FAKE_GH_WORLD"):
    with open(os.environ["SUP_FAKE_WORLD"], "w") as fh:
        fh.write(os.environ["SUP_FAKE_GH_WORLD"])
sys.exit(code)
