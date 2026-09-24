#!/usr/bin/env python3
"""Deterministic checks for the autonomous protocol (see AGENTS.md §6).

  python3 .ai/check.py                                  # structure only (CI runs this)
  python3 .ai/check.py --role strategy  --base origin/develop
      + every changed file is under .ai/
  python3 .ai/check.py --role execution --base origin/develop
      + contract fields unchanged vs base (only status/result may differ)
      + every changed file is inside the contract's write scope

Exit 0 = valid. Requires PyYAML.
"""
import argparse, fnmatch, subprocess, sys
import yaml

EXP, STATE = ".ai/EXPERIMENT.yaml", ".ai/STATE.yaml"
STATUSES = {"none", "ready", "running", "done", "blocked", "evaluated"}
VERDICTS = {"PROVEN", "DISPROVEN", "PARTIAL", "INCONCLUSIVE"}
LEVELS = {"L0", "L1", "L2", "L3"}
CONTRACT_REQUIRED = ["id", "outcome", "branch", "question", "decision_it_informs",
                     "scenario", "method", "allowed", "evidence", "budget"]
EXEC_MUTABLE = {"status", "result"}
errors = []


def err(msg):
    errors.append(msg)


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, check=True).stdout


def load(path, ref=None):
    text = git("show", f"{ref}:{path}") if ref else open(path, encoding="utf-8").read()
    data = yaml.safe_load(text)
    if not isinstance(data, dict):
        raise ValueError(f"{path}: not a mapping")
    return data


def check_structure(exp, state):
    status = exp.get("status")
    if status not in STATUSES:
        err(f"EXPERIMENT.status {status!r} not in {sorted(STATUSES)}")
    if status != "none":
        for k in CONTRACT_REQUIRED:
            if not exp.get(k):
                err(f"EXPERIMENT.{k} required when status != none")
        ev = exp.get("evidence") or {}
        for k in ("level_required", "proves_yes", "proves_no"):
            if not ev.get(k):
                err(f"EXPERIMENT.evidence.{k} required when status != none")
        if ev.get("level_required") and ev["level_required"] not in LEVELS:
            err(f"EXPERIMENT.evidence.level_required must be one of {sorted(LEVELS)}")
        if not (exp.get("allowed") or {}).get("paths"):
            err("EXPERIMENT.allowed.paths required when status != none")
    if status in {"done", "blocked", "evaluated"}:
        res = exp.get("result") or {}
        if res.get("verdict") not in VERDICTS:
            err(f"EXPERIMENT.result.verdict must be one of {sorted(VERDICTS)} when status={status}")
        if res.get("level") not in LEVELS:
            err(f"EXPERIMENT.result.level must be one of {sorted(LEVELS)} when status={status}")
        if not res.get("evidence"):
            err(f"EXPERIMENT.result.evidence required when status={status}")
    if status == "evaluated":
        rev = exp.get("review") or {}
        if rev.get("accepted_verdict") not in VERDICTS:
            err("EXPERIMENT.review.accepted_verdict required when status=evaluated")
        if rev.get("merged") not in (True, False):
            err("EXPERIMENT.review.merged must be true/false when status=evaluated")

    for k in ("now", "outcomes", "knowledge", "decisions"):
        if k not in state:
            err(f"STATE.{k} missing")
    now, outcomes = state.get("now") or {}, state.get("outcomes") or {}
    if now.get("active_outcome") not in outcomes:
        err(f"STATE.now.active_outcome {now.get('active_outcome')!r} not in STATE.outcomes")
    if exp.get("outcome") and exp["outcome"] not in outcomes:
        err(f"EXPERIMENT.outcome {exp['outcome']!r} not in STATE.outcomes")
    active = [k for k, v in outcomes.items() if (v or {}).get("status") == "active"]
    if len(active) != 1:
        err(f"exactly one active outcome expected, found {active}")


def changed_files(base):
    mb = git("merge-base", base, "HEAD").strip()
    files = set(git("diff", "--name-only", mb).split())
    files |= set(git("ls-files", "--others", "--exclude-standard").split())
    return sorted(files)


def in_scope(path, patterns):
    for p in patterns:
        if p.endswith("/") and path.startswith(p):
            return True
        if fnmatch.fnmatch(path, p) or (p.endswith("/**") and path.startswith(p[:-2])):
            return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--role", choices=["strategy", "execution"])
    ap.add_argument("--base")
    a = ap.parse_args()
    if a.role and not a.base:
        ap.error("--role requires --base")

    exp, state = load(EXP), load(STATE)
    check_structure(exp, state)

    if a.role == "strategy":
        for f in changed_files(a.base):
            if not f.startswith(".ai/"):
                err(f"strategy change outside .ai/: {f}")
    elif a.role == "execution":
        base_exp = load(EXP, a.base)
        if base_exp.get("status") not in {"ready", "running"}:
            err(f"base contract status is {base_exp.get('status')!r}; nothing to execute")
        for k in set(base_exp) | set(exp):
            if k not in EXEC_MUTABLE and base_exp.get(k) != exp.get(k):
                err(f"frozen contract field changed: {k}")
        eid = exp.get("id") or ""
        scope = [p.replace("<id>", eid) for p in (exp.get("allowed") or {}).get("paths") or []]
        scope += [EXP, f".ai/evidence/{eid}/"]
        for f in changed_files(a.base):
            if not in_scope(f, scope):
                err(f"execution change outside contract scope: {f}")

    for e in errors:
        print(f"FAIL {e}")
    print("OK" if not errors else f"{len(errors)} problem(s)")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
