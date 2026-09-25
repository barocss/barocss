#!/usr/bin/env python3
"""Work DAG model and deterministic scheduler (migration slice 1, see MIGRATION.md).

A work item is one frozen contract plus the observed state of its branch and PR. schedule() decides
mechanically which items can run, which wait and why, and which semantic computation is due:

  PLAN     a fresh Planner context (today: V1 Strategy choose/record, AGENTS.md §2B)
  COMPUTE  a fresh context that executes one frozen contract (today: V1 Execution, §3)
  JUDGE    a fresh context that reviews one result (today: V1 Strategy review, §2A)
  MERGE    an already-decided merge (today still done by a Strategy session, §6)

It reads no verdict, evidence or product priority; the only ordering input is the contract's
declared integer `priority`. Readiness = state READY + dependencies DONE + no deterministic conflict
with an active item (write scopes, named locks, observed paths) + a free slot.

V1 compatibility: V1 is a DAG of at most one item (.ai/EXPERIMENT.yaml), and every V1 item writes that
shared file, so any two V1 items conflict and V1 is serial by construction. At concurrency 1,
schedule(from_snapshot(snap))["next_action"] must equal sup.derive(snap)["next_action"]; the replay
checks this on every historical event, and derive() flags any live disagreement as attention.
"""
import os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402

# Item states, from the contract status (branch copy per AGENTS.md §1.2) and its PR.
READY = "READY"            # contract ready, branch not created yet  → COMPUTE candidate
RUNNING = "RUNNING"        # compute in flight (ready/running on the branch, or done/blocked before the PR)
CI = "CI"                  # result PR open, required checks pending (the Judge reads CI)
JUDGE = "JUDGE"            # result PR open, checks concluded        → JUDGE
MERGING = "MERGING"        # judged merge: true, PR open             → MERGE once CI allows
UNRECORDED = "UNRECORDED"  # judged merge: false, record not on develop yet → PLAN records it
DONE = "DONE"              # judged and landed on develop; satisfies dependencies
INVALID = "INVALID"        # a state the protocol can't reach (closed PR before review, …)

OPEN = {READY, RUNNING, CI, JUDGE, MERGING, INVALID}   # not landed; V1 plans only when none is open
ACTIVE = {RUNNING, CI, JUDGE, MERGING}                 # its branch holds write scope and locks
MODE = {"EXECUTE": "COMPUTE", "REVIEW": "JUDGE", "PLAN": "PLAN", "MERGE": "MERGE"}


# ---------------------------------------------------------------- items

def _list(x):
    return [str(v) for v in x] if isinstance(x, list) else []


def item(contract, branch=None, prs=(), file=sup.EXP):
    """One work item from the contract committed on develop, its branch view and its PRs. None if no work.

    branch: {"exp": <contract on the branch>, "time": …} or None; prs: PRs whose head is the item's branch.
    """
    if not contract or contract.get("status") in (None, "none"):
        return None
    d_status = contract["status"]
    use_branch = d_status in ("ready", "running") and branch is not None   # §1.2
    c = (branch.get("exp") or {}) if use_branch else contract
    status = c.get("status")
    prs = sorted(prs, key=lambda p: -p["number"])
    open_prs = [p for p in prs if p["state"] == "OPEN"]
    pr = open_prs[0] if open_prs else (prs[0] if prs else None)
    review = c.get("review") or {}

    if d_status in ("done", "blocked") or (d_status == "running" and branch is None):
        state = INVALID   # results reach develop only through a reviewed merge; running needs its branch
    elif status == "ready" and branch is None:
        state = READY
    elif status in ("ready", "running"):
        state = RUNNING
    elif status in ("done", "blocked"):
        state = RUNNING if pr is None else (INVALID if pr["state"] != "OPEN"
                                            else CI if sup._pending(pr["ci"]) else JUDGE)
    elif status == "evaluated" and use_branch:
        merged = review.get("merged")
        state = (MERGING if open_prs else INVALID) if merged is True else UNRECORDED if merged is False else INVALID
    elif status == "evaluated":
        state = DONE
    else:
        state = INVALID

    eid = str(contract.get("id") or "")
    paths = [p.replace("<id>", eid) for p in _list((contract.get("allowed") or {}).get("paths"))]
    prio = contract.get("priority")
    return {
        "id": eid, "outcome": contract.get("outcome"), "branch": contract.get("branch"),
        "state": state, "status": status, "pr": pr,
        "priority": prio if isinstance(prio, int) and not isinstance(prio, bool) else 0,
        "depends_on": _list(contract.get("depends_on")),
        "locks": sorted(set(_list(contract.get("locks")))),
        "observes": sorted(set(_list(contract.get("observes")))),
        # The contract file itself is in scope: every V1 item writes .ai/EXPERIMENT.yaml, so V1 is serial.
        "writes": sorted(set(paths + [file, f".ai/evidence/{eid}/"])),
    }


def from_snapshot(snap):
    """A Phase 1 snapshot → a work view: the legacy V1 item (EXPERIMENT.yaml, adapter) plus every
    work-store item (.ai/work/<id>.yaml, slice 3). An empty store is exactly V1."""
    f = sup.facts(snap)
    items = []
    if snap["develop"].get("exp") is not None:
        items.append(item(snap["develop"]["exp"], snap["branches"].get(f.branch) if f.branch else None,
                          [p for p in snap["prs"] if p["head"] == f.branch]))
    store = snap["develop"].get("work") or {}
    for path, c in sorted(store.items()):
        b = snap["branches"].get((c or {}).get("branch"))
        items.append(item(c, {"exp": (b.get("files") or {}).get(path), "time": b.get("time")} if b else None,
                          [p for p in snap["prs"] if p["head"] == (c or {}).get("branch")], file=path))
    return {"items": [i for i in items if i], "store": len(store), "plan_pr": f.plan_pr,
            "plan_branches": list(f.plan_branches), "blockers": list(f.blockers),
            "contradictions": list(f.contradictions)}


# ---------------------------------------------------------------- conflicts (deterministic)

def _prefix(p):
    """(literal prefix, is_tree). A trailing '/' or any glob makes the entry a tree; globs cut at the wildcard."""
    for i, ch in enumerate(p):
        if ch in "*?[":
            return p[:i], True
    return p, p.endswith("/")


def overlaps(a, b):
    """Could one path entry and another name the same file? Conservative for globs."""
    (pa, ta), (pb, tb) = _prefix(a), _prefix(b)
    return pa == pb or (ta and pb.startswith(pa)) or (tb and pa.startswith(pb))


def conflicts(a, b):
    """Reasons two items can't be active at once. Empty list = independent."""
    out = [f"both write {x} / {y}" for x in a["writes"] for y in b["writes"] if overlaps(x, y)][:1]
    out += [f"lock {k}" for k in sorted(set(a["locks"]) & set(b["locks"]))]
    for w, r in ((a, b), (b, a)):
        hit = [f"{w['id']} writes {x}, {r['id']} observes {y}" for x in w["writes"] for y in r["observes"]
               if overlaps(x, y)]
        out += hit[:1]
    return out


def _cycles(items):
    """Ids on a dependency cycle among the known items."""
    graph = {i["id"]: [d for d in i["depends_on"] if d] for i in items}
    on_cycle, color = set(), {}

    def visit(n, stack):
        color[n] = 1
        stack.append(n)
        for d in graph.get(n, ()):
            if d not in graph:
                continue
            if color.get(d) == 1:
                on_cycle.update(stack[stack.index(d):])
            elif not color.get(d):
                visit(d, stack)
        stack.pop()
        color[n] = 2

    for n in sorted(graph):
        if not color.get(n):
            visit(n, [])
    return on_cycle


# ---------------------------------------------------------------- schedule (pure)

def schedule(view, concurrency=1, sessions=None):
    """Pure: work view → which items run, wait or block, and the semantic computations due now.

    concurrency: max sessions at once. sessions: sessions believed alive (default: RUNNING items).
    next_action is the serial choice in Phase 1's vocabulary, so Phase 2 can consume it unchanged.
    """
    items = sorted(view["items"], key=lambda i: (-i["priority"], i["id"]))
    by_id = {i["id"]: i for i in items}
    cyc = _cycles(items)
    active = [i for i in items if i["state"] in ACTIVE]
    busy = sum(1 for i in items if i["state"] == RUNNING) if sessions is None else sessions
    free = max(0, concurrency - busy)
    rows, launch, waits, holds = {}, [], [], []
    buckets = {k: [] for k in ("ready", "running", "ci", "judge", "merging", "waiting", "blocked", "done")}

    def put(it, bucket, reason=None):
        buckets[bucket].append(it["id"])
        rows[it["id"]] = {"bucket": bucket, "reason": reason}

    def due(action, it=None):
        word = action.split()[0]
        launch.append({"mode": MODE[word], "action": action, "work": it["id"] if it else None})

    # Planner output landing first: new work is scheduled only from a settled DAG (V1 rules P1/P2).
    plan_pr, plan_branches = view.get("plan_pr"), view.get("plan_branches") or []
    integrating = None
    if plan_pr:
        integrating = " ".join(x for x in sup._pr_step(plan_pr, "MERGE") if x)
    elif plan_branches:
        integrating = f"WAIT_PLAN {plan_branches[0]}"

    candidates = []
    for it in items:
        s = it["state"]
        if s in (DONE, UNRECORDED):
            put(it, "done", "record pending (PLAN)" if s == UNRECORDED else None)
        elif s == RUNNING:
            put(it, "running")
            waits.append(f"WAIT_EXECUTION {it['id']}")
        elif s == CI:
            put(it, "ci")
            waits.append(f"WAIT_FOR_CI #{it['pr']['number']}")
        elif s == JUDGE:
            put(it, "judge")
            candidates.append(("REVIEW " + it["id"], it))
        elif s == MERGING:
            put(it, "merging")
            action, target = sup._pr_step(it["pr"], "MERGE")
            step = f"{action} {target}"
            (candidates.append((step, it)) if action == "MERGE" else
             waits.append(step) if action == "WAIT_FOR_CI" else holds.append(step))
        elif s == INVALID:
            put(it, "blocked", f"status {it['status']!r} with PR {it['pr'] and it['pr']['state']}")
            holds.append("HUMAN_REQUIRED")
        else:   # READY: dependencies, then conflicts; slots are applied below
            unknown = [d for d in it["depends_on"] if d not in by_id]
            if it["id"] in cyc:
                put(it, "blocked", "dependency cycle")
            elif unknown:
                put(it, "blocked", "unknown dependency " + ", ".join(unknown))
            else:
                pending = [f"{d} ({by_id[d]['state']})" for d in it["depends_on"] if by_id[d]["state"] != DONE]
                if pending:
                    put(it, "waiting", "depends on " + ", ".join(pending))
                else:
                    candidates.append(("EXECUTE " + it["id"], it))

    # Merges free write scopes, judges unblock dependents, then new compute. Each launch is one session.
    candidates.sort(key=lambda c: ("MERGE", "REVIEW", "EXECUTE").index(c[0].split()[0]))
    picked = []
    for action, it in candidates:
        if action.startswith("EXECUTE"):
            clash = [f"{o['id']}: {r}" for o in active + picked for r in conflicts(it, o)]
            if clash:
                put(it, "waiting", "conflict with " + clash[0])
                continue
        if integrating:
            reason = "planner output landing"
        elif free <= 0:
            reason = f"no free slot (concurrency {concurrency})"
        else:
            reason = None
        if action.startswith("EXECUTE"):
            put(it, "waiting" if reason else "ready", reason)
        if reason:
            continue
        due(action, it)
        free -= 1
        if action.startswith("EXECUTE"):
            picked.append(it)

    # Planner wakes on strategic state only: a judged result to record, a DAG only it can fix (unknown
    # dependency, cycle) once nothing else can progress, or no open work at all. An idle slot never wakes it.
    unrecorded = [i["id"] for i in items if i["state"] == UNRECORDED]
    open_work = [i for i in items if i["state"] in OPEN]
    stuck = [i for i in buckets["blocked"] if by_id[i]["state"] == READY]
    progressing = active or candidates
    if integrating:
        planner = {"state": "integrating", "reason": integrating}
    elif unrecorded:
        planner = {"state": "needed", "reason": "record rejected result " + ", ".join(unrecorded)}
    elif stuck and not progressing:
        planner = {"state": "needed", "reason": "blocked work " + ", ".join(stuck)}
    elif not open_work and view.get("blockers"):
        planner = {"state": "blocked", "reason": "STATE.now.blockers"}
        holds.append("HUMAN_REQUIRED")
    elif not open_work:
        planner = {"state": "needed", "reason": "no open work"}
    else:
        planner = {"state": "idle", "reason": None}
    if planner["state"] == "needed" and free > 0:
        due("PLAN")
        free -= 1

    if view.get("contradictions"):
        next_action = "HUMAN_REQUIRED"
    elif integrating:
        next_action = integrating
    else:
        next_action = (launch[0]["action"] if launch else waits[0] if waits else holds[0] if holds
                       else "PLAN" if planner["state"] == "needed" else "IDLE")
    word = next_action.split()[0]
    return {
        "schema": 1, "concurrency": concurrency, "free_slots": free,
        "items": [{"id": i["id"], "outcome": i["outcome"], "state": i["state"], "status": i["status"],
                   "branch": i["branch"], "pr": i["pr"]["number"] if i["pr"] else None,
                   "priority": i["priority"], "depends_on": i["depends_on"], "locks": i["locks"],
                   "observes": i["observes"], "writes": i["writes"], **rows[i["id"]]} for i in items],
        "buckets": buckets, "planner": planner,
        "launch": [] if view.get("contradictions") or integrating else launch,
        "waits": waits, "holds": holds + (["HUMAN_REQUIRED"] if view.get("contradictions") else []),
        "next_action": next_action, "mode": MODE.get(word),
    }
