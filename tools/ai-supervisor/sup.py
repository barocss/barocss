#!/usr/bin/env python3
"""Shadow supervisor for the V1 autonomous protocol (V2 Phase 1, docs/autonomy-v2-design.md §11 P1).

Observe only. It reads origin/develop, the ai/* branches, PRs and CI, derives the phase V1 is in
and the next action V1 (AGENTS.md §1-§3) would take, and writes a status file. It launches,
pushes, opens, closes and merges nothing, and it never makes an experiment judgment.

  python3 tools/ai-supervisor/sup.py observe                 # fetch, derive, print, write status
  python3 tools/ai-supervisor/sup.py observe --no-fetch --out status.json --snapshot-out snap.json
  python3 tools/ai-supervisor/sup.py derive snap.json        # derive from a recorded snapshot

Two layers:
  collect_live() -> snapshot   git + gh reads only; the snapshot is plain JSON
  derive(snapshot) -> status   pure function; the V1 precedence lives in RULES below

Requires PyYAML and, for live mode, an authenticated `gh`.
"""
import argparse, json, os, subprocess, sys
from datetime import datetime, timezone
from types import SimpleNamespace

import yaml

EXP, STATE, CHECK = ".ai/EXPERIMENT.yaml", ".ai/STATE.yaml", ".ai/check.py"
WORK = ".ai/work/"   # migration slice 3: work store, one contract per <id>.yaml (the V1 RULES ignore it)
STATUSES = {"none", "ready", "running", "done", "blocked", "evaluated"}   # V1, .ai/check.py
PLAN_STATUSES = {"none", "evaluated", "missing"}                          # AGENTS.md §1: → STRATEGY choose
REQUIRED_CHECKS = ("Test and Build",)                                     # AGENTS.md §6
EXP_PREFIX, PLAN_PREFIX = "ai/E-", "ai/strategy-"
STALE_EXEC_MIN = 180   # attention only: no commit on a running branch for this long

# Every action the supervisor can predict, and the runtime state it implies.
ACTION_STATE = {
    "PLAN": "runnable",            # launch a Strategy session (§2B; §2A too when a record is pending)
    "EXECUTE": "runnable",         # launch an Execution session (§3)
    "REVIEW": "runnable",          # launch a Strategy session for review (§2A)
    "MERGE": "runnable",           # mechanical: merge a PR whose merge was already decided
    "WAIT_EXECUTION": "active",    # an Execution is (probably) in flight
    "WAIT_PLAN": "active",         # a Strategy pass pushed a branch but has not opened its PR
    "WAIT_FOR_CI": "waiting",      # required checks pending on the PR that decides the next step
    "BLOCKED": "blocked",          # the next step's PR has red CI; a session must fix it
    "HUMAN_REQUIRED": "blocked",   # contradiction or recorded blocker; don't guess
    "IDLE": "idle",                # reserved: V1 has no idle state (see README, ambiguities)
}


# ---------------------------------------------------------------- derive (pure)

def _prs_for(snap, head):
    return sorted((p for p in snap["prs"] if p["head"] == head), key=lambda p: -p["number"])


def facts(snap):
    """Flatten a snapshot into the handful of facts the rules read."""
    dev = snap["develop"]
    dexp = dev.get("exp")
    f = SimpleNamespace()
    f.d_status = (dexp or {}).get("status") if dexp is not None else "missing"
    f.id = (dexp or {}).get("id")
    f.branch = (dexp or {}).get("branch")
    f.state = dev.get("state") or {}
    f.blockers = list(((f.state.get("now") or {}).get("blockers")) or [])
    br = snap["branches"].get(f.branch) if f.branch else None
    f.branch_exists = br is not None
    f.branch_head = br
    f.b_exp = (br or {}).get("exp")
    f.b_status = (f.b_exp or {}).get("status") if br else None
    # AGENTS.md §1.2: while develop says ready/running and the branch exists, the branch copy is authoritative.
    f.use_branch = f.d_status in ("ready", "running") and f.branch_exists
    f.exp = (f.b_exp or {}) if f.use_branch else (dexp or {})
    f.status = f.b_status if f.use_branch else f.d_status
    f.review = f.exp.get("review") or {}
    f.result = f.exp.get("result") or {}
    prs = _prs_for(snap, f.branch) if f.branch else []
    f.open_prs = [p for p in prs if p["state"] == "OPEN"]
    f.pr = f.open_prs[0] if f.open_prs else (prs[0] if prs else None)
    f.pr_state = f.pr["state"] if f.pr else None
    f.ci = f.pr["ci"] if f.pr else None
    # Strategy integration (§2B.3). A strategy branch counts while it is ahead of develop and its PR
    # is open or not opened yet; one whose PR was closed is abandoned.
    plan_open = [p for p in snap["prs"] if p["head"].startswith(PLAN_PREFIX) and p["state"] == "OPEN"]
    closed_heads = {p["head"] for p in snap["prs"] if p["head"].startswith(PLAN_PREFIX) and p["state"] != "OPEN"}
    open_heads = {p["head"] for p in plan_open}
    f.plan_prs = plan_open
    f.plan_pr = plan_open[0] if len(plan_open) == 1 else None
    f.plan_branches = sorted(n for n, b in snap["branches"].items()
                             if n.startswith(PLAN_PREFIX) and b.get("ahead") and n not in open_heads
                             and n not in closed_heads)
    f.abandoned_plan = sorted(n for n, b in snap["branches"].items()
                              if n.startswith(PLAN_PREFIX) and b.get("ahead") and n in closed_heads
                              and n not in open_heads)
    # Work-store items (slice 3) are scheduled by work.py, not by these V1 rules; their branches aren't strays.
    store = dev.get("work") or {}
    f.store = bool(store)
    store_branches = {(c or {}).get("branch") for c in store.values()}
    f.stray_exp_prs = [p for p in snap["prs"] if p["head"].startswith(EXP_PREFIX) and p["state"] == "OPEN"
                       and p["head"] != f.branch and p["head"] not in store_branches]
    f.contradictions = contradictions(f, dev)
    return f


def contradictions(f, dev):
    """States V1 cannot reach by following AGENTS.md. Any of these stops prediction (HUMAN_REQUIRED)."""
    out = []
    if f.d_status not in STATUSES | {"missing"}:
        out.append(f"develop EXPERIMENT.status {f.d_status!r} is not a V1 status")
    for e in dev.get("check_errors") or []:
        out.append(f"develop fails check.py structure: {e}")
    if f.d_status in ("done", "blocked"):
        out.append(f"develop says {f.d_status}: results reach develop only through a reviewed merge (§2A, §3.6)")
    if f.d_status == "running" and not f.branch_exists:
        out.append(f"develop says running but branch {f.branch} is missing on origin")
    if f.use_branch:
        if f.b_exp is None:
            out.append(f"branch {f.branch} has no {EXP}")
        elif f.b_exp.get("id") != f.id:
            out.append(f"branch {f.branch} holds {f.b_exp.get('id')} while develop holds {f.id}")
        elif f.b_status not in STATUSES - {"none"}:
            out.append(f"branch {f.branch} status {f.b_status!r} is not an experiment status")
    if len(f.open_prs) > 1:
        out.append(f"{len(f.open_prs)} open PRs for {f.branch}: " + ", ".join(f"#{p['number']}" for p in f.open_prs))
    if f.pr and f.d_status in ("ready", "running"):
        if f.pr_state == "MERGED":
            out.append(f"PR #{f.pr['number']} for {f.branch} is merged but develop still says {f.d_status}")
        if f.pr_state == "CLOSED" and f.status in ("ready", "running", "done", "blocked"):
            out.append(f"PR #{f.pr['number']} for {f.branch} was closed but {f.id} is {f.status}, not reviewed")
    rec = f.result.get("pr")
    if rec and f.pr and f.use_branch and not str(rec).rstrip("/").endswith(f"/{f.pr['number']}"):
        out.append(f"result.pr {rec} does not match PR #{f.pr['number']} for {f.branch}")
    if f.use_branch and f.status == "evaluated" and f.review.get("merged") not in (True, False):
        out.append(f"{f.id} is evaluated on {f.branch} but review.merged is {f.review.get('merged')!r}")
    if f.use_branch and f.status == "evaluated" and f.review.get("merged") is True and not f.open_prs:
        out.append(f"{f.id} review says merged: true but {f.branch} has no open PR")
    plans = [p["head"] for p in f.plan_prs] + f.plan_branches
    if len(plans) > 1:
        out.append("more than one Strategy pass in flight: " + ", ".join(plans))
    if plans and f.status in ("ready", "running", "done", "blocked") and not f.store:
        # V1 plans only between experiments. With a work store the Planner may land work while items run.
        out.append(f"Strategy branch {plans[0]} is ahead of develop while {f.id} is {f.status}")
    return out


def _pending(ci):
    return ci in ("pending", "none")   # "none": the PR is open but no required check has reported yet


def _pr_step(pr, ready_action):
    """A PR whose merge is already decided: wait for CI, then merge (or stop)."""
    if _pending(pr["ci"]):
        return "WAIT_FOR_CI", f"#{pr['number']}"
    if pr["ci"] != "success":
        return "BLOCKED", f"#{pr['number']}"
    if pr.get("mergeable") == "CONFLICTING":
        return "HUMAN_REQUIRED", f"#{pr['number']}"
    return ready_action, f"#{pr['number']}"


def _reviewed_merge(f):
    return f.use_branch and f.status == "evaluated" and f.review.get("merged") is True


# V1 precedence, first match wins. Each row: (rule id, phase, when, action, source in AGENTS.md).
# Rows P* come first because §2B.3 has a Strategy pass integrate its own PR before it stops, and
# V1 runs one thing at a time: while a plan is landing, nothing else is due.
RULES = [
    ("C0", "contradiction", lambda f: f.contradictions,
     lambda f: ("HUMAN_REQUIRED", None), "not reachable by following AGENTS.md"),
    ("P1", "plan_integrating", lambda f: f.plan_pr is not None,
     lambda f: _pr_step(f.plan_pr, "MERGE"), "§2B.3 merge own .ai/-only PR once checks pass"),
    ("P2", "planning", lambda f: bool(f.plan_branches),
     lambda f: ("WAIT_PLAN", f.plan_branches[0]), "§2B.3 PR not opened yet"),
    ("E1", "ready", lambda f: f.status == "ready" and not f.branch_exists,
     lambda f: ("EXECUTE", f.id), "§1 ready → EXECUTION; §3.1 creates the branch"),
    ("E2", "executing", lambda f: f.status in ("ready", "running"),
     lambda f: ("WAIT_EXECUTION", f.id), "§1 running → EXECUTION (in flight; liveness unknown)"),
    ("E3", "executing", lambda f: f.status in ("done", "blocked") and f.pr is None,
     lambda f: ("WAIT_EXECUTION", f.id), "§3.6 Execution opens the PR"),
    ("E4", "awaiting_ci", lambda f: f.status in ("done", "blocked") and f.pr_state == "OPEN" and _pending(f.ci),
     lambda f: ("WAIT_FOR_CI", f"#{f.pr['number']}"), "§2A.2 review reads CI"),
    ("R1", "needs_review", lambda f: f.status in ("done", "blocked") and f.pr_state == "OPEN",
     lambda f: ("REVIEW", f.id), "§1 done/blocked → STRATEGY review; red CI is review input"),
    ("M1", "merging", _reviewed_merge,
     lambda f: _pr_step(f.pr, "MERGE"), "§2A.5 merge once required checks pass"),
    ("M2", "rejected_unrecorded", lambda f: f.use_branch and f.status == "evaluated" and f.review.get("merged") is False,
     lambda f: ("PLAN", None), "§2A.5 not merging: record goes onto a strategy branch (§2B)"),
    ("S1", "human_blocked", lambda f: f.status in PLAN_STATUSES and bool(f.blockers),
     lambda f: ("HUMAN_REQUIRED", None), "STATE.now.blockers set (§2B.3, §8)"),
    ("S2", "needs_plan", lambda f: f.status in PLAN_STATUSES,
     lambda f: ("PLAN", None), "§1 none/evaluated/missing → STRATEGY choose"),
]


def _minutes(a, b):
    return int((parse_time(b) - parse_time(a)).total_seconds() // 60)


def derive(snap):
    """Pure: snapshot -> status dict. Same snapshot, same status."""
    f = facts(snap)
    for rid, phase, when, act, src in RULES:
        if when(f):
            action, target = act(f)
            break
    else:   # every V1 status is covered above; reaching here means the rule table has a hole
        rid, phase, src = "X0", "unmatched", "no rule matched"
        action, target = "HUMAN_REQUIRED", None
        f.contradictions.append(f"no rule matched status={f.status!r} pr={f.pr_state!r}")

    attention, ambiguities = [], []
    if f.blockers:
        attention.append({"kind": "state_blockers", "detail": f.blockers})
    if snap["develop"].get("ci") == "failure":
        attention.append({"kind": "develop_ci_red", "detail": "V1 lets Strategy select maintenance (§2 rules)"})
    for c in f.contradictions:
        attention.append({"kind": "contradiction", "detail": c})
    for n in f.abandoned_plan:
        attention.append({"kind": "abandoned_strategy_branch", "detail": n})
    for p in f.stray_exp_prs:
        attention.append({"kind": "stray_experiment_pr", "detail": f"#{p['number']} {p['head']}"})
    if action in ("BLOCKED", "HUMAN_REQUIRED") and rid not in ("C0", "S1"):
        attention.append({"kind": action.lower(), "detail": f"{rid}: {target}"})
    age = None
    if f.branch_head and f.branch_head.get("time") and snap.get("at"):
        age = _minutes(f.branch_head["time"], snap["at"])
    if action == "WAIT_EXECUTION":
        ambiguities.append("V1 'running' has no liveness signal: a crashed Execution looks the same as a live one")
        if age is not None and age >= STALE_EXEC_MIN:
            attention.append({"kind": "execution_quiet", "detail": f"{f.branch}: no commit for {age} min"})
    if phase == "needs_plan" and str(snap["develop"].get("last_ai_subject", "")).startswith("ai(strategy):") \
            and not str(snap["develop"].get("last_ai_subject", "")).startswith("ai(strategy): review"):
        ambiguities.append("last .ai commit on develop is a Strategy pass that left no ready contract; "
                           "V1 has no idle marker, so a new PLAN may repeat it")

    exp = None
    if f.id:
        exp = {
            "id": f.id, "outcome": f.exp.get("outcome"), "branch": f.branch,
            "develop_status": f.d_status, "branch_status": f.b_status,
            "status": f.status, "source": "branch" if f.use_branch else "develop",
            "phase": phase, "proposed_verdict": f.result.get("verdict"),
            "accepted_verdict": f.review.get("accepted_verdict"), "merge_decision": f.review.get("merged"),
            "pr": _pr_view(f.pr), "head_age_min": age if f.use_branch else None,
        }
    plan = None
    if f.plan_pr or f.plan_branches:
        plan = {"branch": f.plan_pr["head"] if f.plan_pr else f.plan_branches[0], "pr": _pr_view(f.plan_pr)}
    outcomes = [{"id": k, "status": (v or {}).get("status"),
                 "current": bool(exp and exp["outcome"] == k)}
                for k, v in (f.state.get("outcomes") or {}).items()]
    # Migration slice 1 (MIGRATION.md): the Work DAG scheduler runs in shadow at concurrency 1 and must
    # pick what the V1 rules picked. It decides nothing yet; a disagreement is surfaced, not acted on.
    import work   # lazy: work imports sup
    wv = work.from_snapshot(snap)
    w = work.schedule(wv, concurrency=1)
    v1_next = action if target is None else f"{action} {target}"
    # Slice 3: with work-store items the V1 RULES no longer see all the work, so they stop gating (None).
    w["agrees_with_v1"] = None if wv["store"] else w["next_action"] == v1_next
    if w["agrees_with_v1"] is False:
        attention.append({"kind": "work_model_disagrees", "detail": f"work {w['next_action']} vs V1 {v1_next}"})
    return {
        "schema": 1, "mode": "shadow", "at": snap.get("at"),
        "develop": {"sha": snap["develop"].get("sha"), "ci": snap["develop"].get("ci")},
        "outcomes": outcomes,
        "experiments": [exp] if exp else [],
        "plan": plan,
        "phase": phase, "rule": rid, "rule_source": src,
        "next_action": v1_next,
        "state": ACTION_STATE[action],
        "attention": attention, "contradictions": f.contradictions, "ambiguities": ambiguities,
        "work": w,
    }


def _pr_view(p):
    if not p:
        return None
    return {k: p.get(k) for k in ("number", "state", "ci", "mergeable", "url")}


# ---------------------------------------------------------------- collect (read-only I/O)

def parse_time(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


HERE = os.path.dirname(os.path.abspath(__file__))
TOP = subprocess.run(["git", "-C", HERE, "rev-parse", "--show-toplevel"],
                     capture_output=True, text=True).stdout.strip() or "."   # pathspecs resolve from the repo root


def git(*args, check=True):
    r = subprocess.run(["git", "-C", TOP, *args], capture_output=True, text=True)
    if check and r.returncode:
        raise RuntimeError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout if r.returncode == 0 else None


_yaml_cache = {}


def load_at(sha, path):
    key = (sha, path)
    if key not in _yaml_cache:
        text = git("show", f"{sha}:{path}", check=False)
        _yaml_cache[key] = yaml.safe_load(text) if text is not None else None
    return _yaml_cache[key]


def structure_errors(sha, exp, state, work=None):
    """Run the check_structure (and check_work, if present) of the check.py committed at `sha`."""
    src = git("show", f"{sha}:{CHECK}", check=False)
    if src is None or exp is None or state is None:
        return []
    ns = {"__name__": "v1_check"}
    exec(compile(src, f"{sha}:{CHECK}", "exec"), ns)
    ns["errors"].clear()
    ns["check_structure"](exp, state)
    if work and "check_work" in ns:
        ns["check_work"](work, exp, state)
    return list(ns["errors"])


def load_work_at(sha):
    """{path: contract} for every .ai/work/*.yaml committed at sha."""
    names = (git("ls-tree", "--name-only", sha, WORK, check=False) or "").split()
    return {n: load_at(sha, n) for n in names if n.endswith(".yaml")}


def is_ancestor(a, b):
    return subprocess.run(["git", "-C", TOP, "merge-base", "--is-ancestor", a, b]).returncode == 0


def develop_view(sha, ci):
    exp, state, work = load_at(sha, EXP), load_at(sha, STATE), load_work_at(sha)
    return {
        "sha": sha, "exp": exp, "state": state, "ci": ci, "work": work,
        "check_errors": structure_errors(sha, exp, state, work),
        "last_ai_subject": (git("log", "-1", "--no-merges", "--format=%s", sha, "--", ".ai/") or "").strip(),
    }


def branch_view(sha, time, dev_sha, want_exp, want_files=()):
    return {"sha": sha, "time": time, "ahead": not is_ancestor(sha, dev_sha),
            "exp": load_at(sha, EXP) if want_exp else None,
            "files": {p: load_at(sha, p) for p in want_files}}


def store_files(develop):
    """branch → work-store contract path, from the contracts committed on develop."""
    return {(c or {}).get("branch"): p for p, c in (develop.get("work") or {}).items()}


def summarize_checks(runs):
    """runs: [{name, status, conclusion}] → pending | success | failure | none (required checks only)."""
    req = [r for r in runs if r.get("name") in REQUIRED_CHECKS]
    if not req:
        return "none"
    if any((r.get("status") or "").upper() != "COMPLETED" for r in req):
        return "pending"
    ok = {"SUCCESS", "NEUTRAL", "SKIPPED"}
    return "success" if all((r.get("conclusion") or "").upper() in ok for r in req) else "failure"


def gh_json(*args):
    r = subprocess.run(["gh", *args], capture_output=True, text=True, cwd=TOP)   # {owner}/{repo} resolve from the repo, not the cwd
    if r.returncode:
        raise RuntimeError(f"gh {' '.join(args)}: {r.stderr.strip()}")
    return json.loads(r.stdout)


def collect_live(fetch=True):
    if fetch:
        git("fetch", "origin", "--prune", "--quiet")
    dev = git("rev-parse", "origin/develop").strip()
    runs = gh_json("api", f"repos/{{owner}}/{{repo}}/commits/{dev}/check-runs")["check_runs"]
    dev_ci = summarize_checks([{"name": r["name"], "status": r["status"], "conclusion": r["conclusion"]} for r in runs])
    develop = develop_view(dev, dev_ci)
    exp_branch = (develop["exp"] or {}).get("branch")
    files = store_files(develop)
    branches = {}
    refs = git("for-each-ref", "--format=%(refname:strip=3) %(objectname) %(committerdate:iso-strict)",
               "refs/remotes/origin/ai/")
    for line in refs.splitlines():
        name, sha, time = line.split(" ", 2)
        branches[name] = branch_view(sha, time, dev, want_exp=(name == exp_branch),
                                     want_files=[files[name]] if name in files else ())
    prs = []
    for p in gh_json("pr", "list", "--state", "all", "--search", "head:ai/", "--limit", "200", "--json",
                     "number,headRefName,state,headRefOid,mergeable,url,statusCheckRollup"):
        if not p["headRefName"].startswith("ai/"):
            continue
        rollup = [{"name": c.get("name") or c.get("context"),
                   "status": c.get("status") or ("COMPLETED" if c.get("state") not in (None, "PENDING") else "PENDING"),
                   "conclusion": c.get("conclusion") or c.get("state")} for c in p["statusCheckRollup"] or []]
        prs.append({"number": p["number"], "head": p["headRefName"], "state": p["state"],
                    "sha": p["headRefOid"], "mergeable": p["mergeable"], "url": p["url"],
                    "ci": summarize_checks(rollup)})
    return {"at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "develop": develop, "branches": branches, "prs": prs}


# ---------------------------------------------------------------- CLI

def default_out():
    return os.path.join(os.environ.get("AI_HOME", os.path.expanduser("~/.barocss-ai")), "status.json")


def write_json(path, data):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, sort_keys=False, default=str)
        fh.write("\n")
    os.replace(tmp, path)


def print_status(st):
    print(f"next action : {st['next_action']}   [{st['state']}]")
    print(f"phase       : {st['phase']}  (rule {st['rule']}: {st['rule_source']})")
    for e in st["experiments"]:
        pr = e["pr"]
        prs = f"#{pr['number']} {pr['state']} ci={pr['ci']}" if pr else "none"
        print(f"experiment  : {e['id']} {e['outcome']} develop={e['develop_status']} branch={e['branch_status']} "
              f"→ {e['status']} (from {e['source']}), PR {prs}")
    print("outcomes    : " + ", ".join(f"{o['id']}={o['status']}" for o in st["outcomes"]))
    print(f"develop     : {str(st['develop']['sha'])[:7]} ci={st['develop']['ci']}")
    for a in st["attention"]:
        print(f"attention   : {a['kind']}: {a['detail']}")
    for a in st["ambiguities"]:
        print(f"ambiguity   : {a}")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    o = sub.add_parser("observe", help="read repo + GitHub state, derive, write status (no side effects)")
    o.add_argument("--no-fetch", action="store_true")
    o.add_argument("--out", default=default_out())
    o.add_argument("--snapshot-out")
    o.add_argument("--json", action="store_true", help="print the status JSON instead of the summary")
    d = sub.add_parser("derive", help="derive status from a snapshot JSON file")
    d.add_argument("snapshot")
    a = ap.parse_args(argv)

    if a.cmd == "observe":
        snap = collect_live(fetch=not a.no_fetch)
        if a.snapshot_out:
            write_json(a.snapshot_out, snap)
        st = derive(snap)
        if a.out != "-":   # "-": print only (a session reading the schedule must not touch the runtime status)
            write_json(a.out, st)
        print(json.dumps(st, indent=2, default=str) if a.json else "", end="")
        if not a.json:
            print_status(st)
            print(f"status file : {a.out}" if a.out != "-" else "work next   : " + st["work"]["next_action"])
    else:
        with open(a.snapshot) as fh:
            print(json.dumps(derive(json.load(fh)), indent=2, default=str))


if __name__ == "__main__":
    main()
