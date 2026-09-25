#!/usr/bin/env python3
"""Serial autonomous supervisor for the V1 protocol (V2 Phase 2).

It removes one human action: opening a fresh Opus session and pasting the standard instruction.
Everything else stays V1 (AGENTS.md). While the autonomous work is active, the loop is:

  observe (Phase 1: sup.collect_live + sup.derive) → decide (pure, below) → wait | hold | launch ONE
  fresh session with STANDARD_INSTRUCTION → monitor it (exit / crash / timeout) → re-observe → repeat

It is not a daemon. `start` runs in the foreground of whatever started it (a Claude App session, a
terminal) and stops when that owner goes away, on SIGTERM/SIGINT/SIGHUP, or on `stop`:

  python3 tools/ai-supervisor/supervise.py start                  # autonomous work on, until stopped
  python3 tools/ai-supervisor/supervise.py pause | resume | stop  # from any other shell
  python3 tools/ai-supervisor/supervise.py status                 # what it is doing, and why
  python3 tools/ai-supervisor/supervise.py start --dry-run        # observe + decide, launch nothing
  python3 tools/ai-supervisor/supervise.py start --max-sessions 1 # canary: one handoff, then stop
  python3 tools/ai-supervisor/supervise.py release KEY            # re-arm an action held after retries

The supervisor decides only mechanics: whether a session is alive, whether a process failed, whether
to wait. It never reads a verdict, a priority or evidence; the launched session does all of that
under AGENTS.md. Runtime state lives outside git in $AI_HOME (default ~/.barocss-ai).
"""
import argparse, fcntl, hashlib, json, os, pwd, re, signal, socket, subprocess, sys, threading, time, urllib.parse, uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402
import work  # noqa: E402
import directives  # noqa: E402

STANDARD_INSTRUCTION = (
    "Read AGENTS.md and follow it.\n\n"
    "Determine your mode from the durable project state on origin/develop exactly as §1 says.\n\n"
    "Run one pass of that mode, then stop."
)
# Migration slice 2 (MIGRATION.md): each launch names the step the supervisor observed, so a COMPUTE
# context gets one contract instead of choosing work. §1 stays authoritative; a mismatch means the
# supervisor saw stale state, and the session must stop without changes rather than guess.
ADDRESS = {
    "EXECUTE": "EXECUTION (§3) of {target} only: run that one frozen contract",
    "REVIEW": "STRATEGY review (§2A) of {target}",
    "PLAN": "STRATEGY (§2): record any pending result, then choose and contract (§2B)",
    "MERGE": "STRATEGY: land the merge already decided in the review, PR {target} (§2A.5), then continue as §2 says",
}


def instruction(action, ports=None):
    """STANDARD_INSTRUCTION plus the observed step. Without an action, the V1 instruction unchanged.

    ports: (first, last) of the slot's port range when sessions run side by side (--concurrency > 1)."""
    if not action:
        return STANDARD_INSTRUCTION
    word, _, target = action.partition(" ")
    text = (f"{STANDARD_INSTRUCTION}\n\nThe supervisor observed that the next step is {action}: "
            f"{ADDRESS[word].format(target=target)}. Confirm it with §1 first. If §1 gives a different mode "
            "or work item, stop without changing anything.")
    if ports:
        text += (f"\n\nAnother session may be running in parallel on its own work item. Any server you start "
                 f"(dev server, proxy, browser debug port) must listen on a port in {ports[0]}-{ports[1]} "
                 "($BARO_PORT_BASE is the first), not on a fixed port, unless your contract's `locks` names "
                 "that port.")
    return text

LAUNCH = {"PLAN", "EXECUTE", "REVIEW"}            # a fresh session does it
MECHANICAL = {"MERGE"}                            # the supervisor does it (gh); Strategy already decided it
INFLIGHT = {"WAIT_EXECUTION", "WAIT_PLAN"}        # a pass is mid-way; whose session is it?
WAIT = {"WAIT_FOR_CI"}                            # external; the supervisor waits, no session is kept alive
HOLD = {"BLOCKED", "HUMAN_REQUIRED", "IDLE"}      # don't guess
FAILED = {"CRASHED", "TIMED_OUT"}                 # process/environment failures: the only retryable ones
RESUMABLE = FAILED | {"INTERRUPTED"}              # INTERRUPTED: stopped by the user/owner; resumes, costs no attempt
# What V1 does after each launched action (AGENTS.md §2, §3). A mechanical check, not a judgment.
EXPECTED_AFTER = {
    "EXECUTE": {"WAIT_FOR_CI", "REVIEW"},
    "REVIEW": {"MERGE", "WAIT_FOR_CI", "PLAN", "EXECUTE", "HUMAN_REQUIRED"},
    "PLAN": {"EXECUTE", "WAIT_FOR_CI", "MERGE", "HUMAN_REQUIRED"},
    "MERGE": LAUNCH | WAIT | {"HUMAN_REQUIRED"},
}
SCRUB_KEEP = {"CLAUDE_CODE_OAUTH_TOKEN", "CLAUDE_CONFIG_DIR"}
# STATE.human_directives (2026-09-25): a product_code PR merges only after a human approves it. The
# supervisor enforces its half: no merge of such a PR until one of these is on it.
APPROVAL_LABEL = "human-approved"


class Config:
    def __init__(self, **kw):
        self.home = os.environ.get("AI_HOME", os.path.expanduser("~/.barocss-ai"))
        self.claude = ["claude"]
        self.model = "opus"
        self.permission_mode = "auto"
        self.timeout_s = {"EXECUTE": 6 * 3600}   # per launched action word
        self.default_timeout_s = 2 * 3600
        self.idle_timeout_s = 60 * 60           # no session output for this long → TIMED_OUT
        self.max_attempts = 3                   # per action key, counting only process failures
        self.backoff_s = 120                    # before attempt n+1: backoff_s * n
        self.poll_s = 60                        # WAIT_FOR_CI / hold re-observe interval
        self.monitor_s = 15
        self.settle_s = 30                      # after exit, let GitHub catch up before re-observing
        self.kill_grace_s = 20
        self.stale_min = sup.STALE_EXEC_MIN
        self.fetch = True
        self.prepare = True                     # reset the session workspace to origin/develop
        self.owner = None                       # pid whose exit ends the autonomous work (None: not watched)
        self.repo_dir = sup.TOP                 # the repository this supervisor drives
        self.lock_dir = default_lock_dir()      # per-user, independent of AI_HOME (see RepoLock)
        self.identity = None                    # {id, name}; derived from repo_dir when None
        self.tick_s = 1.0                       # how quickly pause / resume / stop take effect
        self.concurrency = 1                    # sessions at once; 1 keeps the serial loop below unchanged
        self.gh = ["gh"]                        # mechanical merges
        self.bind_review = True                 # merge only the head a Strategy review commit produced (+ develop merges)
        self.directives = True                  # read directive issues each observation (#160); tests turn it off
        self.port_base = 5200                   # --concurrency > 1: slot n gets port_base + n*port_span …
        self.port_span = 100
        self.notify = False                     # desktop notifications (the CLI turns them on)
        self.__dict__.update(kw)
        self.workspace = kw.get("workspace") or os.path.join(self.home, "workspace")

    def timeout_for(self, action):
        return self.timeout_s.get(action.split()[0], self.default_timeout_s)

    def slot_ports(self, slot):
        first = self.port_base + (slot or 0) * self.port_span
        return first, first + self.port_span - 1

    def command(self, sid, action=None, ports=None):
        return [*self.claude, "-p", instruction(action, ports), "--model", self.model,
                "--permission-mode", self.permission_mode, "--session-id", sid,
                "--output-format", "stream-json", "--verbose"]


def mode_of(action):
    return work.MODE.get(action.split()[0])


REVIEW_SUBJECT = re.compile(r"^ai\(strategy\): review E-\d+")


def reviewed_head(repo, head, develop="origin/develop", limit=200):
    """(ok, reason): is `head` the commit a Strategy review produced, plus only clean merges of develop?

    A decided merge is a decision about a diff, not a PR number. Walk the first-parent chain from head to
    the latest `ai(strategy): review E-N` commit; every commit on the way must be a two-parent merge whose
    second parent is on develop and whose tree equals git's automatic merge of its parents (what
    `gh pr update-branch` makes). Anything else was pushed after the review and nobody reviewed it."""
    g = lambda *a: subprocess.run(["git", "-C", repo, *a], capture_output=True, text=True)
    c, merges = head, 0
    for _ in range(limit):
        r = g("log", "-1", "--format=%P%x00%s", c)
        if r.returncode:
            return False, f"commit {c[:7]} is not available locally"
        parents, _, subject = r.stdout.rstrip("\n").partition("\x00")
        ps = parents.split()
        if REVIEW_SUBJECT.match(subject):
            return True, f"reviewed at {c[:7]}" + (f", then {merges} develop merge(s)" if merges else "")
        what = f"{c[:7]} ({subject[:60]})"
        if len(ps) != 2:
            return False, f"head_changed_after_review: {what} was pushed after the review and is not a develop merge"
        if g("merge-base", "--is-ancestor", ps[1], develop).returncode:
            return False, f"head_changed_after_review: {what} merges {ps[1][:7]}, which is not on develop"
        mt = g("merge-tree", "--write-tree", ps[0], ps[1])
        tree = g("rev-parse", c + "^{tree}").stdout.strip()
        if mt.returncode or mt.stdout.split()[:1] != [tree]:
            return False, f"head_changed_after_review: {what} is a develop merge with changes of its own"
        c, merges = ps[0], merges + 1
    return False, f"head_changed_after_review: no review commit within {limit} commits of {head[:7]}"


def merge_command(cfg, pr):
    """The one GitHub write the supervisor makes: merge exactly the head the decision saw."""
    cmd = [*cfg.gh, "pr", "merge", str(pr["number"]), "--merge"]
    return cmd + ["--match-head-commit", pr["sha"]] if pr.get("sha") else cmd


def iso(t):
    return datetime.fromtimestamp(t, timezone.utc).isoformat(timespec="seconds")


def epoch(s):
    return sup.parse_time(s).timestamp()


# ---------------------------------------------------------------- view + decide (pure)

def view_of(snap, st):
    """The few observed facts decide() reads, from a Phase 1 snapshot and its derived status.

    Slice 2: the step comes from the Work DAG scheduler (st["work"]); Phase 1's V1 RULES only gate it.
    """
    w = st["work"]
    a = w["next_action"]
    word, _, target = a.partition(" ")
    dev = snap["develop"].get("sha") or ""
    # The work item the step names (legacy EXPERIMENT.yaml or a work-store file), else the legacy item.
    items = {i["id"]: i for i in w["items"]}
    items.update({f"#{i['pr']}": i for i in w["items"] if i.get("pr")})   # WAIT_FOR_CI / MERGE name a PR
    exp = st["experiments"][0] if st["experiments"] else {}
    it = items.get(target) or items.get(exp.get("id")) or {}
    head = None
    if word == "WAIT_EXECUTION":
        head = (snap["branches"].get(it.get("branch")) or {}).get("time")
    elif word == "WAIT_PLAN":
        head = (snap["branches"].get(target) or {}).get("time")
    merge = None
    if word == "MERGE":
        p = next((p for p in snap["prs"] if f"#{p['number']}" == target), {})
        merge = {"number": p.get("number"), "sha": p.get("sha"), "head": p.get("head"),
                 "plan": str(p.get("head", "")).startswith(sup.PLAN_PREFIX)}
    return {"at": snap.get("at"), "next_action": a, "action": word, "rule": st["rule"], "state": st["state"],
            "merge": merge, "phase": st["phase"], "key": f"{a}@{dev[:12]}", "develop": dev, "head_time": head,
            "experiment": it.get("id"), "exp_status": it.get("status"), "attention": st["attention"],
            "store": bool((snap["develop"].get("work") or {})),
            "mode": w["mode"], "v1_next_action": st["next_action"], "agrees_with_v1": w["agrees_with_v1"],
            "work": {"buckets": w["buckets"], "planner": w["planner"], "concurrency": w["concurrency"]},
            "project": _project(snap, st, exp, it), **_merge_gate(snap, word, target)}


def _merge_gate(snap, word, target):
    """For MERGE #n: does that PR change product code, and has a human approved it? Mechanical facts only."""
    if word != "MERGE" or not target.startswith("#"):
        return {}
    pr = next((p for p in snap["prs"] if f"#{p['number']}" == target), None) or {}
    contracts = [snap["develop"].get("exp") or {}] + list((snap["develop"].get("work") or {}).values())
    c = next((c for c in contracts if (c or {}).get("branch") and c.get("branch") == pr.get("head")), None) or {}
    return {"product_code": bool((c.get("allowed") or {}).get("product_code")),
            "approved": APPROVAL_LABEL in (pr.get("labels") or []) or pr.get("review") == "APPROVED",
            "merge_pr": target}


def _contract_of(snap, eid):
    """The work-store contract with this id (branch copy while it's the authoritative one), else None."""
    for path, c in (snap["develop"].get("work") or {}).items():
        if (c or {}).get("id") == eid:
            b = snap["branches"].get(c.get("branch")) or {}
            live = c.get("status") in ("ready", "running") and (b.get("files") or {}).get(path)
            return live or c
    return None


def _project(snap, st, exp, it=None):
    """Display only (status): what the durable state says the project is doing. decide() never reads it."""
    state = snap["develop"].get("state") or {}
    now = state.get("now") or {}
    oid = now.get("active_outcome") or next((o["id"] for o in st["outcomes"] if o["status"] == "active"), None)
    src = _contract_of(snap, (it or {}).get("id")) if it and it.get("id") != exp.get("id") else None
    pr, verdict = exp.get("pr"), exp.get("proposed_verdict")
    if src is not None:   # a work-store item: its own PR and proposed verdict
        prs = sorted((p for p in snap["prs"] if p["head"] == it.get("branch")),
                     key=lambda p: (p["state"] != "OPEN", -p["number"]))
        pr, verdict = sup._pr_view(prs[0] if prs else None), (src.get("result") or {}).get("verdict")
    else:
        src = (snap["branches"].get(exp.get("branch")) or {}).get("exp") if exp.get("source") == "branch" \
            else snap["develop"].get("exp")
    flat = lambda x: " ".join(str(x).split()) if x else None
    return {"outcome": oid, "outcome_statement": flat(((state.get("outcomes") or {}).get(oid) or {}).get("statement")),
            "question": flat((src or {}).get("question")), "last_result": flat(now.get("last_result")),
            "blockers": list(now.get("blockers") or []), "pr": pr, "verdict": verdict}


def decide(v, records, now, cfg):
    """Pure: (view, ledger records, now, config) → one decision. Never returns two launches."""
    live = [r for r in records if r["state"] == "RUNNING"]
    if live:
        return {"do": "monitor", "session": live[-1]["session_id"], "reason": "a session is alive; never launch a second"}
    recs = [r for r in records if not r.get("released")]
    if v.get("agrees_with_v1") is False:   # None: work-store items exist and the V1 RULES no longer gate
        # Until the V1 RULES retire, a scheduler that disagrees with them is a bug to look at, not a plan.
        return _hold("work_model_disagrees", f"work {v['next_action']} vs V1 {v['v1_next_action']}")
    word = v["action"]
    if word in DIRECTIVE_READERS and not (v.get("directives") or {"ok": True})["ok"]:
        return _hold("directives_unavailable", f"{v['next_action']}: can't read the directive issues "
                                               f"({v['directives'].get('error')}); a Strategy pass needs them")
    if word == "MERGE" and v.get("product_code") and not v.get("approved"):
        return _hold("human_approval", f"{v['merge_pr']} changes product code: review it, then add the "
                                       f"`{APPROVAL_LABEL}` label (or approve the PR) to let it merge")
    if word in LAUNCH:
        return _attempt(v["key"], v["next_action"], recs, now, cfg)
    if word in MECHANICAL:
        d = _attempt(v["key"], v["next_action"], recs, now, cfg)
        if d["do"] == "launch":
            d.update(do="merge", pr=v["merge"], reason=f"{v['next_action']}: decided merge, checks green; "
                                                          "the supervisor merges (no session)")
        return d
    if word in INFLIGHT:
        sessions = [r for r in recs if r.get("kind") != "merge"]
        last = sessions[-1] if sessions else None
        head = epoch(v["head_time"]) if v.get("head_time") else None
        if last and head is not None and epoch(last["ended_at"]) >= head:
            # Nothing was pushed since our last session ended, so the half-done pass is ours. (Serial: a RUNNING
            # item blocks every launch, so with several work items the last session is still the one that left it.)
            if last["state"] in RESUMABLE:
                return _attempt(last["key"], last["action"], recs, now, cfg, resume=v["next_action"])
            return _hold("incomplete", f"session {last['session_id'][:8]} ({last['action']}) exited cleanly but "
                                       f"left {v['next_action']}; a relaunch would guess")
        if head is not None and (now - head) / 60 >= cfg.stale_min:
            return _hold("inflight_quiet", f"{v['next_action']}: no supervised session and no push for "
                                           f"{int((now - head) // 60)} min")
        return {"do": "wait", "delay": cfg.poll_s, "reason": f"{v['next_action']}: a session outside this supervisor "
                                                             "is in flight"}
    if word in WAIT:
        return {"do": "wait", "delay": cfg.poll_s, "reason": f"{v['next_action']}: deterministic wait"}
    return _hold(word.lower(), f"{v['next_action']} (rule {v['rule']})")


def _attempt(key, action, recs, now, cfg, resume=None):
    mine = [r for r in recs if r["key"] == key]
    refused = [r for r in mine if r["state"] == "REFUSED"]
    if refused:   # a precondition of a mechanical step failed; that is a finding, not a flake
        return _hold("merge_refused", f"{action}: {refused[-1]['reason']}")
    done = [r for r in mine if r["state"] == "COMPLETED"]
    if done:
        # A clean exit that left the same durable state is a session outcome, not a process failure.
        return _hold("no_progress", f"session {done[-1]['session_id'][:8]} completed {action} and the durable "
                                    "state did not advance; not retrying a semantic outcome")
    failed = [r for r in mine if r["state"] in FAILED]
    if len(failed) >= cfg.max_attempts:
        return _hold("retry_exhausted", f"{key}: {len(failed)} process failures "
                                        f"({', '.join(r['state'] for r in failed)}); release with "
                                        f"`supervise.py release '{key}'` once fixed")
    if failed:
        ready_at = epoch(failed[-1]["ended_at"]) + cfg.backoff_s * len(failed)
        if now < ready_at:
            return {"do": "wait", "delay": ready_at - now, "reason": f"backoff before attempt {len(failed) + 1} of {key}"}
    d = {"do": "launch", "key": key, "action": action, "attempt": len(failed) + 1,
         "reason": f"{action}: semantic work, launch one fresh session"}
    if resume:
        d["reason"] = f"resume {action} after an interrupted or failed session (repository shows {resume})"
    return d


STRATEGY_WORDS = {"PLAN", "REVIEW", "MERGE"}   # every one of these writes STATE.yaml: one at a time
DIRECTIVE_READERS = {"PLAN", "REVIEW"}          # sessions that must read the directives (AGENTS.md §2)


def pkey(action, develop):
    """Parallel action key. A work item's EXECUTE/REVIEW and a PR's MERGE are stable identities, so a
    completed one is never relaunched just because develop moved; PLAN is per develop commit."""
    return f"{action}@{develop[:12]}" if action.split()[0] == "PLAN" else action


def decide_many(v, sched, records, now, cfg, gate=None, head_of=None, pr_of=None):
    """Pure, concurrency > 1: the Work DAG scheduler's launch list, filtered mechanically.

    sched: work.schedule(view, concurrency, sessions=live). gate(target) → _merge_gate() facts for a
    MERGE; head_of(work_id) → the item branch's last push time (ISO) or None.
    pr_of(target) → {number, sha, head, plan} for a MERGE's PR.
    Returns {"launch": [decision…], "merge": [decision…], "holds": [hold…], "waits": [str…]}. Never more
    launches than free slots, never two sessions for one work item or action, never two Strategy-mode
    sessions. A MERGE is mechanical (no session, no slot) but still waits while a Strategy session is live,
    since that session may be writing STATE.yaml on the branch being merged.
    """
    pr_of = pr_of or (lambda target: {"number": int(target.lstrip("#")), "sha": None, "head": None, "plan": False})
    gate = gate or (lambda target: {})
    head_of = head_of or (lambda wid: None)
    recs = [r for r in records if not r.get("released")]
    live = [r for r in records if r["state"] == "RUNNING"]
    out = {"launch": [], "merge": [], "holds": [], "waits": list(sched.get("waits") or [])}
    if v.get("agrees_with_v1") is False:
        out["holds"].append(_hold("work_model_disagrees", f"work {v['next_action']} vs V1 {v['v1_next_action']}"))
        return out
    for h in sched.get("holds") or []:
        out["holds"].append(_hold(h.split()[0].lower(), f"{h} (scheduler)"))
    free = max(0, cfg.concurrency - len(live))
    busy_actions = {r["action"] for r in live}
    wid_of = lambda r: r.get("work") or r.get("experiment")   # records from before concurrency carry only experiment
    busy_work = {wid_of(r) for r in live if wid_of(r)}
    strategy = any(r["action"].split()[0] in STRATEGY_WORDS for r in live)
    cands = []
    # An item whose branch says running but no session of ours is alive: resume it if our session died.
    for w in out["waits"]:
        word, _, wid = w.partition(" ")
        if word != "WAIT_EXECUTION" or wid in busy_work:
            continue
        mine = [r for r in recs if wid_of(r) == wid and r["state"] != "RUNNING"]
        head = head_of(wid)
        if mine and head and epoch(mine[-1]["ended_at"]) >= epoch(head):
            last = mine[-1]
            if last["state"] in RESUMABLE:
                cands.append((last["action"], wid, last["key"]))
            else:
                out["holds"].append(_hold("incomplete", f"session {last['session_id'][:8]} ({last['action']}) "
                                                        f"exited cleanly but left {w}"))
    for x in sched.get("launch") or []:
        cands.append((x["action"], x.get("work"), pkey(x["action"], v.get("develop") or "")))
    for action, wid, key in cands:
        word = action.split()[0]
        if action in busy_actions or (wid and wid in busy_work):
            continue
        if word in DIRECTIVE_READERS and not (v.get("directives") or {"ok": True})["ok"]:
            out["holds"].append(_hold("directives_unavailable", f"{action}: can't read the directive issues "
                                                                f"({v['directives'].get('error')})"))
            continue
        if word in STRATEGY_WORDS and strategy:
            out["waits"].append(f"{action}: a Strategy-mode session is running")
            continue
        if word == "MERGE":
            g = gate(action.split()[1])
            if g.get("product_code") and not g.get("approved"):
                out["holds"].append(_hold("human_approval", f"{action.split()[1]} changes product code: review it, "
                                                            f"then add the `{APPROVAL_LABEL}` label (or approve the PR)"))
                continue
        d = _attempt(key, action, recs, now, cfg)
        if d["do"] == "launch" and word == "MERGE":
            d.update(do="merge", pr=pr_of(action.split()[1]), work=wid, mode=word,
                     reason=f"{action}: decided merge; the supervisor merges (no session)")
            out["merge"].append(d)
            busy_actions.add(action)
            continue
        if d["do"] == "launch":
            if free <= 0:
                out["waits"].append(f"{action}: no free slot (concurrency {cfg.concurrency})")
                continue
            d.update(work=wid, mode=word)
            out["launch"].append(d)
            free -= 1
            busy_actions.add(action)
            if wid:
                busy_work.add(wid)
            strategy = strategy or word in STRATEGY_WORDS
        elif d["do"] == "hold":
            out["holds"].append(d)
        else:
            out["waits"].append(d["reason"])
    return out


def _hold(kind, detail):
    return {"do": "hold", "kind": kind, "reason": detail}


def transition(rec, v):
    """Did the session move the durable state the way V1 would? Mechanical only."""
    if v["key"] == rec["key"]:
        return "no_progress"
    if v["action"] in INFLIGHT and v.get("head_time") and epoch(v["head_time"]) <= epoch(rec["ended_at"]):
        return "incomplete"
    if v["rule"] == "C0":
        return "contradiction"
    if v.get("store"):   # several work items interleave; V1's per-action successors no longer apply
        return "advanced"
    return "advanced" if v["action"] in EXPECTED_AFTER[rec["action"].split()[0]] else "unexpected"


# ---------------------------------------------------------------- ledger (runtime state, outside git)

class Ledger:
    KEEP = 200

    def __init__(self, home):
        self.path = os.path.join(home, "ledger.json")

    def load(self):
        try:
            with open(self.path) as fh:
                return json.load(fh)["records"]
        except FileNotFoundError:
            return []

    def save(self, records):
        sup.write_json(self.path, {"schema": 1, "records": records[-self.KEEP:]})

    def update(self, sid, **kw):
        recs = self.load()
        for r in recs:
            if r["session_id"] == sid:
                r.update(kw)
        self.save(recs)
        return next(r for r in recs if r["session_id"] == sid)


# ---------------------------------------------------------------- processes

def session_dir(cfg, sid):
    return os.path.join(cfg.home, "sessions", sid)


def ps_pid(sid):
    """Pid of the live wrapper carrying this session's token, else None. Survives restarts and pid reuse."""
    out = subprocess.run(["ps", "-Ao", "pid=,stat=,command="], capture_output=True, text=True).stdout
    for line in out.splitlines():
        if f"--sup-session {sid}" in line and line.split()[1][:1] != "Z":
            return int(line.split()[0])
    return None


def result_event(log):
    """The session's final stream-json `result` event, if it wrote one."""
    try:
        with open(log, "rb") as fh:
            fh.seek(0, 2)
            fh.seek(max(0, fh.tell() - 262144))
            lines = fh.read().decode("utf-8", "replace").splitlines()
    except FileNotFoundError:
        return None
    for line in reversed(lines):
        if '"type":"result"' in line.replace(" ", ""):
            try:
                return json.loads(line)
            except ValueError:
                return None
    return None


def outcome(sdir):
    """(state, reason, exit code, result event) of a session whose process is gone."""
    try:
        with open(os.path.join(sdir, "exit.json")) as fh:
            ex = json.load(fh)
        code = ex["code"]
    except (FileNotFoundError, ValueError, KeyError):
        return "CRASHED", "process ended without an exit record (killed, or stale ledger)", None, None
    res = result_event(os.path.join(sdir, "log.jsonl"))
    if ex.get("interrupted"):
        return "INTERRUPTED", ex["interrupted"], code, res
    if code != 0:
        return "CRASHED", f"exit code {code}", code, res
    if res is None:
        return "CRASHED", "exit 0 without a result event", code, res
    if res.get("is_error"):
        return "CRASHED", f"session error: {res.get('subtype')} api_status={res.get('api_error_status')}", code, res
    return "COMPLETED", res.get("subtype", "success"), code, res


def summary(res):
    if not res:
        return None
    return {"turns": res.get("num_turns"), "cost_usd": res.get("total_cost_usd"),
            "duration_s": round((res.get("duration_ms") or 0) / 1000), "denials": len(res.get("permission_denials") or []),
            "text": (res.get("result") or "")[:800]}


def last_step(log):
    """The session's latest tool call or message, for status. Display only."""
    try:
        with open(log, "rb") as fh:
            fh.seek(0, 2)
            fh.seek(max(0, fh.tell() - 131072))
            lines = fh.read().decode("utf-8", "replace").splitlines()
    except FileNotFoundError:
        return None
    for line in reversed(lines):
        try:
            e = json.loads(line)
        except ValueError:
            continue
        if e.get("type") != "assistant":
            continue
        for c in reversed((e.get("message") or {}).get("content") or []):
            if c.get("type") == "tool_use":
                inp = c.get("input") or {}
                what = inp.get("description") or inp.get("command") or inp.get("file_path") or inp.get("prompt") or ""
                return f"{c.get('name')}: {' '.join(str(what).split())[:120]}"
            if c.get("type") == "text" and c.get("text", "").strip():
                return "says: " + " ".join(c["text"].split())[:120]
    return None


def killpg(pgid, grace, alive):
    for sig in (signal.SIGTERM, signal.SIGKILL):
        try:
            os.killpg(pgid, sig)
        except (ProcessLookupError, PermissionError):
            return
        t = time.time()
        while time.time() - t < grace:
            if not alive():
                return
            time.sleep(0.05)


def pid_alive(pid):
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    st = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return bool(st) and not st.startswith("Z")


def wrap(sdir, cwd, cmd, owner=None, grace=20):
    """Detached parent of one session: runs it, then writes exit.json. It outlives a crashed supervisor
    (so a restart can adopt the session) but not the owner: when the autonomous work's owner is gone,
    the session is ended too, and exit.json says it was interrupted."""
    env = {k: v for k, v in os.environ.items()
           if k in SCRUB_KEEP or not (k.startswith("CLAUDE") or k in ("AI_AGENT", "BAGGAGE"))}
    try:   # per-session additions written by launch(), e.g. the slot's port range
        with open(os.path.join(sdir, "env.json")) as fh:
            env.update({str(k): str(v) for k, v in json.load(fh).items()})
    except (FileNotFoundError, ValueError):
        pass
    ex = {}
    with open(os.path.join(sdir, "log.jsonl"), "ab") as out, open(os.path.join(sdir, "stderr.log"), "ab") as err:
        try:
            p = subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.DEVNULL, stdout=out, stderr=err, env=env)
        except OSError as e:
            err.write(f"spawn failed: {e}\n".encode())
            p = None
            ex["code"] = 127
        while p is not None:
            try:
                ex["code"] = p.wait(timeout=1)
                break
            except subprocess.TimeoutExpired:
                if owner and not pid_alive(owner):
                    signal.signal(signal.SIGTERM, signal.SIG_IGN)
                    os.killpg(0, signal.SIGTERM)
                    try:
                        ex["code"] = p.wait(timeout=grace)
                    except subprocess.TimeoutExpired:
                        ex["code"] = None
                    ex["interrupted"] = f"owner {owner} gone"
                    break
    ex["ended_at"] = iso(time.time())
    sup.write_json(os.path.join(sdir, "exit.json"), ex)
    if ex.get("interrupted"):
        os.killpg(0, signal.SIGKILL)   # whatever is left of the session, and this wrapper


# ---------------------------------------------------------------- repository ownership
# One supervisor per repository, whatever the worktree, shell, Claude App work or AI_HOME. The lock is
# keyed by the repository's identity (its canonical origin remote) and lives in a per-user directory
# that AI_HOME does not move. It is a flock: the kernel drops it when the holder dies, so a crash never
# leaves it stuck, and liveness is never judged from a pid.

def canonical_remote(url):
    """git@github.com:O/R.git, ssh://git@github.com/O/R, https://u@github.com/O/R/ → github.com/o/r"""
    u = url.strip()
    m = re.match(r"^[\w.-]+@([^:/]+):(.+)$", u)   # scp-like
    if m:
        host, path = m.group(1), m.group(2)
    else:
        p = urllib.parse.urlsplit(u)
        if p.scheme in ("", "file"):
            return "path:" + os.path.realpath(p.path or u)
        host, path = p.hostname or "", p.path
    path = path.strip("/")
    path = path[:-4] if path.endswith(".git") else path
    return f"{host.lower()}/{path.lower()}"


def repo_identity(repo_dir):
    """Same id for every clone and worktree of one repository; the git common dir if there is no remote."""
    r = subprocess.run(["git", "-C", repo_dir, "remote", "get-url", "origin"], capture_output=True, text=True)
    if r.returncode == 0 and r.stdout.strip():
        name = canonical_remote(r.stdout)
    else:
        common = subprocess.run(["git", "-C", repo_dir, "rev-parse", "--git-common-dir"], capture_output=True,
                                text=True, check=True).stdout.strip()
        name = "path:" + os.path.realpath(os.path.join(repo_dir, common))
    return {"id": hashlib.sha256(name.encode()).hexdigest()[:16], "name": name}


def default_lock_dir():
    # The passwd home, not $HOME: neither AI_HOME nor a changed HOME moves the ownership boundary.
    return os.path.join(pwd.getpwuid(os.getuid()).pw_dir, ".cache", "ai-supervisor", "locks")


class RepoLock:
    """<lock_dir>/<repo id>.lock (flock) plus <repo id>.owner.json (who holds it, with a random token)."""

    def __init__(self, path):
        self.path = path
        self.owner_path = path[:-len(".lock")] + ".owner.json"
        self.fh = self.token = None

    @classmethod
    def for_repo(cls, lock_dir, ident):
        return cls(os.path.join(lock_dir, ident["id"] + ".lock"))

    def acquire(self, record, wait=2.0, label=True):
        """label=False: a short maintenance hold (stop's sweep) that keeps the last runner's owner record."""
        # A short retry: `probe` holds a shared lock for microseconds and must not make `start` fail.
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        fh = open(self.path, "a")
        end = time.time() + wait
        while True:
            try:
                fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except OSError:
                if time.time() >= end:
                    fh.close()
                    rec = read_json(self.owner_path) or {}
                    raise Busy(f"repository {record.get('repo')} is owned by supervisor pid {rec.get('pid')} "
                               f"(home {rec.get('home')}, worktree {rec.get('worktree')}, since "
                               f"{rec.get('acquired_at')})", owner=rec)
                time.sleep(0.05)
        self.fh, self.token = fh, uuid.uuid4().hex
        if label:
            sup.write_json(self.owner_path, dict(record, pid=os.getpid(), token=self.token,
                                                 acquired_at=iso(time.time())))
        return self

    def release(self):
        if self.fh is None:
            return
        rec = read_json(self.owner_path) or {}
        if rec.get("token") == self.token:   # keep it as "last owner" for status
            sup.write_json(self.owner_path, dict(rec, released_at=iso(time.time())))
        fcntl.flock(self.fh, fcntl.LOCK_UN)
        self.fh.close()
        self.fh = None

    close = release

    def probe(self):
        """{alive, record}: alive only if some process holds the lock right now. The record is just a label."""
        rec = read_json(self.owner_path)
        if not os.path.exists(self.path):
            return {"alive": False, "record": rec}
        with open(self.path, "a") as fh:
            try:
                fcntl.flock(fh, fcntl.LOCK_SH | fcntl.LOCK_NB)
            except OSError:
                return {"alive": True, "record": rec}
            fcntl.flock(fh, fcntl.LOCK_UN)
        return {"alive": False, "record": rec}


def live_wrappers(repo_id):
    """Session wrappers of this repository still running anywhere on this machine, found by argv token."""
    out = subprocess.run(["ps", "-Ao", "pid=,stat=,command="], capture_output=True, text=True).stdout
    found = []
    for line in out.splitlines():
        if f"--sup-repo {repo_id}" in line and line.split()[1][:1] != "Z":
            m = re.search(r"--sup-session (\S+)", line)
            if m:
                found.append({"pid": int(line.split()[0]), "sid": m.group(1)})
    return found


# ---------------------------------------------------------------- lifecycle (app-scoped, not a daemon)
# control.json: what the user wants (running | paused | stopped), written by start / pause / resume / stop.
# runner.json:  what the runner is doing (RUNNING | PAUSING | PAUSED | STOPPED), written by the runner.

def read_json(path):
    try:
        with open(path) as fh:
            return json.load(fh)
    except (FileNotFoundError, ValueError):
        return None


def read_control(home):
    return read_json(os.path.join(home, "control.json")) or {"desired": "running"}


def request(home, desired, by):
    os.makedirs(home, exist_ok=True)
    sup.write_json(os.path.join(home, "control.json"), {"desired": desired, "at": iso(time.time()), "by": by})


def lifecycle(desired, session_live):
    """Runner state for a desired state (pure)."""
    if desired == "stopped":
        return "STOPPED"
    if desired == "paused":
        return "PAUSING" if session_live else "PAUSED"
    return "RUNNING"


def runner_info(home):
    """The runner of this home is alive iff it holds its repository lock under the same token. A live pid
    alone proves nothing (pid reuse)."""
    info = read_json(os.path.join(home, "runner.json")) or {}
    alive = False
    if info.get("lock") and info.get("token"):
        p = RepoLock(info["lock"]).probe()
        alive = p["alive"] and (p["record"] or {}).get("token") == info["token"]
    if not alive and info.get("state") not in (None, "STOPPED"):
        info = dict(info, state="STOPPED", stop_reason="runner process gone (crashed or killed)")
    info.setdefault("state", "STOPPED")
    info["alive"] = alive
    return info


# ---------------------------------------------------------------- supervisor (I/O)

class Busy(RuntimeError):
    def __init__(self, msg, owner=None):
        super().__init__(msg)
        self.owner = owner


class Supervisor:
    def __init__(self, cfg, observe=None, out=print):
        self.cfg, self.out = cfg, out
        os.makedirs(cfg.home, exist_ok=True)
        self.ledger = Ledger(cfg.home)
        self.observe_fn = observe or self._observe_live
        self.procs = {}   # session id → Popen of the wrapper, when this process launched it
        self.signal = None
        self.started_at = None
        self.stop_reason = None
        self._logged = None
        self.observe_error = None
        self.lock = None
        self._ident = cfg.identity

    def identity(self):
        if self._ident is None:
            self._ident = repo_identity(self.cfg.repo_dir)
        return self._ident

    def repo_lock(self):
        return RepoLock.for_repo(self.cfg.lock_dir, self.identity())

    def _observe_live(self):
        snap = sup.collect_live(fetch=self.cfg.fetch)
        return snap, sup.derive(snap)

    def observe(self):
        snap, st = self.observe_fn()
        sup.write_json(os.path.join(self.cfg.home, "status.json"), st)
        self.snap = snap
        v = view_of(snap, st)
        v["directives"] = self._directives()
        if v["directives"].get("ignored"):
            v["attention"] = list(v["attention"]) + [
                {"kind": "directive_ignored", "detail": f"#{d['number']} by {d['author']} (not an allowed author)"}
                for d in v["directives"]["ignored"]]
        return v

    def _directives(self):
        """{ok, ids, ignored, error}: the directive issues in force (#160). Fails closed: ok False on error."""
        if not self.cfg.directives:
            return {"ok": True, "ids": [], "ignored": [], "error": None, "skipped": True}
        try:
            ok, ignored = directives.current(top=self.cfg.repo_dir)
            return {"ok": True, "ids": directives.ids(ok), "ignored": ignored, "error": None}
        except (directives.Unavailable, OSError, subprocess.TimeoutExpired, ValueError) as e:
            return {"ok": False, "ids": [], "ignored": [], "error": str(e)[:200]}

    def observe_parallel(self, n_live):
        """(view, schedule at this runner's concurrency) or None when observation failed."""
        v = self._observe_or_none()
        if v is None:
            return None
        return v, work.schedule(work.from_snapshot(self.snap), concurrency=self.cfg.concurrency, sessions=n_live)

    def _head_of(self, sched):
        branch = {i["id"]: i.get("branch") for i in sched.get("items") or []}
        return lambda wid: (self.snap["branches"].get(branch.get(wid)) or {}).get("time")

    def _pr_of(self, target):
        p = next((p for p in (self.snap or {}).get("prs", []) if f"#{p['number']}" == target), {})
        return {"number": p.get("number") or int(target.lstrip("#")), "sha": p.get("sha"), "head": p.get("head"),
                "plan": str(p.get("head", "")).startswith(sup.PLAN_PREFIX)}

    def _gate(self, target):
        return _merge_gate(self.snap, "MERGE", target)

    def notify(self, title, message, urgent=False):
        """Tell the user without being asked: $AI_HOME/events.jsonl always, a desktop notification when on."""
        ev = {"at": iso(time.time()), "title": title, "message": message, "urgent": urgent}
        with open(os.path.join(self.cfg.home, "events.jsonl"), "a") as fh:
            fh.write(json.dumps(ev) + "\n")
        if self.cfg.notify and sys.platform == "darwin":
            q = lambda x: json.dumps(str(x))[:400]   # AppleScript string literal
            script = f"display notification {q(message)} with title {q('BaroCSS AI: ' + title)}" + \
                (' sound name "Glass"' if urgent else "")
            try:
                subprocess.Popen(["osascript", "-e", script], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except OSError:
                pass

    def log(self, event, **kw):
        line = {"at": iso(time.time()), "event": event, **kw}
        with open(os.path.join(self.cfg.home, "supervisor.log"), "a") as fh:
            fh.write(json.dumps(line, default=str) + "\n")
        self.out(f"[{line['at']}] {event}: " + ", ".join(f"{k}={v}" for k, v in kw.items()))

    # -- lifecycle

    def desired(self):
        return read_control(self.cfg.home).get("desired", "running")

    def halt_reason(self):
        if self.signal:
            return f"signal {self.signal}"
        if self.cfg.owner and not pid_alive(self.cfg.owner):
            return f"owner {self.cfg.owner} gone"
        if self.desired() == "stopped":
            return "stop requested"
        return None

    def set_runner(self, state, **kw):
        info = {"state": state, "desired": self.desired(), "pid": os.getpid(), "owner": self.cfg.owner,
                "started_at": self.started_at, "updated_at": iso(time.time()), "repo": self.identity()["name"],
                "lock": self.lock.path if self.lock else None, "token": self.lock.token if self.lock else None, **kw}
        prev = read_json(os.path.join(self.cfg.home, "runner.json")) or {}
        sup.write_json(os.path.join(self.cfg.home, "runner.json"), info)
        if prev.get("state") != state or prev.get("pid") != os.getpid():
            self.log("runner", state=state, **{k: v for k, v in kw.items() if k in ("activity", "reason")})
            if state in ("PAUSED", "STOPPED") or prev.get("pid") != os.getpid():
                self.notify(f"runner {state}", kw.get("reason") or kw.get("detail") or kw.get("activity") or "")

    def sleep(self, secs):
        """Interruptible: returns early on stop, on a lost owner, or when pause/resume changes."""
        end, want = time.time() + secs, self.desired()
        while time.time() < end:
            if self.halt_reason() or self.desired() != want:
                return
            time.sleep(max(0, min(self.cfg.tick_s, end - time.time())))

    def _on_signal(self, signum, frame):
        self.signal = signal.Signals(signum).name

    # -- sessions

    def alive(self, rec):
        p = self.procs.get(rec["session_id"])
        if p is not None:
            return p.poll() is None
        return ps_pid(rec["session_id"]) is not None

    def reconcile(self, persist=True):
        """Settle RUNNING records against real processes (restart recovery, stale ledgers, timeouts)."""
        recs = self.ledger.load()
        now = time.time()
        for r in recs:
            if r["state"] != "RUNNING":
                continue
            sdir = session_dir(self.cfg, r["session_id"])
            if self.alive(r):
                if r["pgid"] is None:   # supervisor died between recording and spawning
                    r["pid"] = r["pgid"] = ps_pid(r["session_id"])
                act = max([epoch(r["started_at"])] + [os.path.getmtime(os.path.join(sdir, f))
                          for f in ("log.jsonl", "stderr.log") if os.path.exists(os.path.join(sdir, f))])
                r["last_activity"] = iso(act)
                why = None
                if now - epoch(r["started_at"]) > r["timeout_s"]:
                    why = f"timeout {r['timeout_s']}s"
                elif now - act > r["idle_timeout_s"]:
                    why = f"no output for {int(now - act)}s (idle timeout {r['idle_timeout_s']}s)"
                if why and persist:
                    killpg(r["pgid"], self.cfg.kill_grace_s, lambda: self.alive(r))
                    self.procs.pop(r["session_id"], None)
                    r.update(state="TIMED_OUT", reason=why, ended_at=iso(time.time()))
                    self.log("session_timed_out", session=r["session_id"], action=r["action"], reason=why)
                continue
            state, reason, code, res = outcome(sdir)
            r.update(state=state, reason=reason, exit_code=code, ended_at=iso(time.time()), result=summary(res))
            if persist:
                if self.procs.pop(r["session_id"], None) is not None:
                    # Stray children (dev servers …) left in the group. Only for our own child: after a
                    # restart the pgid may already belong to someone else.
                    killpg(r["pgid"], 0, lambda: False)
                self.log(f"session_{state.lower()}", session=r["session_id"], action=r["action"],
                         attempt=r["attempt"], reason=reason)
        if persist:
            self.ledger.save(recs)
        return recs

    def interrupt(self, rec, why):
        """End a live session because the autonomous work stopped. Resumable, costs no attempt."""
        sid = rec["session_id"]
        p = self.procs.get(sid)
        pgid = p.pid if p is not None else ps_pid(sid)
        if pgid:
            killpg(pgid, self.cfg.kill_grace_s, lambda: self.alive(rec))
        self.procs.pop(sid, None)
        state, reason, code, res = outcome(session_dir(self.cfg, sid))
        if state != "COMPLETED":   # it may have finished on its own just before the stop
            state, reason = "INTERRUPTED", why
        rec = self.ledger.update(sid, state=state, reason=reason, exit_code=code, ended_at=iso(time.time()),
                                 result=summary(res))
        self.log(f"session_{state.lower()}", session=sid, action=rec["action"], reason=reason)
        return rec

    def workspace_for(self, slot):
        return self.cfg.workspace if not slot else f"{self.cfg.workspace}-{slot}"

    def prepare_workspace(self, ws=None):
        ws = ws or self.cfg.workspace
        g = lambda *a: subprocess.run(["git", "-C", ws, *a], check=True, capture_output=True, text=True).stdout
        if not os.path.isdir(os.path.join(ws, ".git")):
            url = sup.git("remote", "get-url", "origin").strip()
            tmp = ws + ".cloning"
            subprocess.run(["rm", "-rf", tmp], check=True)
            subprocess.run(["git", "clone", "--quiet", "--no-checkout", url, tmp], check=True, capture_output=True, text=True)
            os.replace(tmp, ws)   # never leave a half-cloned workspace behind
        g("fetch", "origin", "--prune", "--quiet")
        g("checkout", "--quiet", "-f", "--detach", "origin/develop")
        g("reset", "--quiet", "--hard", "origin/develop")
        g("clean", "-fdq")
        for b in g("for-each-ref", "--format=%(refname:short)", "refs/heads/").split():
            g("branch", "-D", b)   # unpushed local work is not memory (AGENTS.md §6)

    def launch(self, d, v, slot=0, item_state=None):
        sid = str(uuid.uuid4())
        sdir = session_dir(self.cfg, sid)
        os.makedirs(sdir)
        ws = self.workspace_for(slot)
        try:
            if self.cfg.prepare:
                self.prepare_workspace(ws)
        except (OSError, subprocess.CalledProcessError) as e:
            # Environment failure before any session existed: recorded like a crash, so it retries
            # within the same budget instead of taking the runner down.
            err = (getattr(e, "stderr", None) or str(e)).strip()[:300]
            now = iso(time.time())
            recs = self.ledger.load()
            recs.append({"session_id": sid, "key": d["key"], "action": d["action"], "experiment": v["experiment"],
                         "attempt": d["attempt"], "state": "CRASHED", "pid": None, "pgid": None,
                         "started_at": now, "last_activity": now, "ended_at": now, "exit_code": None,
                         "timeout_s": 0, "idle_timeout_s": 0, "reason": f"workspace setup failed: {err}",
                         "work": d.get("work"), "slot": slot,
                         "before": {"next_action": v["next_action"], "develop": v["develop"]}, "dir": sdir})
            self.ledger.save(recs)
            self.log("session_crashed", session=sid, action=d["action"], attempt=d["attempt"],
                     reason=f"workspace setup failed: {err}")
            return None
        cwd = ws
        os.makedirs(cwd, exist_ok=True)
        ports = self.cfg.slot_ports(slot) if self.cfg.concurrency > 1 else None
        cmd = self.cfg.command(sid, d["action"], ports)
        if ports:
            sup.write_json(os.path.join(sdir, "env.json"),
                           {"BARO_PORT_BASE": str(ports[0]), "BARO_PORT_LAST": str(ports[1])})
        now = time.time()
        rec = {"session_id": sid, "key": d["key"], "action": d["action"], "experiment": v["experiment"],
               "mode": mode_of(d["action"]),
               "attempt": d["attempt"], "state": "RUNNING", "pid": None, "pgid": None,
               "started_at": iso(now), "last_activity": iso(now), "ended_at": None,
               "timeout_s": self.cfg.timeout_for(d["action"]), "idle_timeout_s": self.cfg.idle_timeout_s,
               "exit_code": None, "reason": None, "before": {"next_action": v["next_action"], "develop": v["develop"],
                                                             "item_state": item_state},
               "cwd": cwd, "dir": sdir, "work": d.get("work") or v.get("experiment"), "slot": slot,
               "directives": (v.get("directives") or {}).get("ids"),
               "ports": list(ports) if ports else None}
        recs = self.ledger.load()
        recs.append(rec)
        self.ledger.save(recs)   # recorded before spawn: a crash here leaves a RUNNING record reconcile settles
        with open(os.path.join(sdir, "wrapper.log"), "ab") as wlog:
            p = subprocess.Popen([sys.executable, os.path.abspath(__file__), "_wrap", "--sup-session", sid,
                                  "--sup-repo", self.identity()["id"], "--owner", str(self.cfg.owner or 0),
                                  sdir, cwd, "--", *cmd],
                                 start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                 stderr=wlog)
        self.procs[sid] = p
        rec = self.ledger.update(sid, pid=p.pid, pgid=p.pid)
        self.log("session_launched", session=sid, action=d["action"], attempt=d["attempt"], pid=p.pid)
        self.notify(f"started {d['action']}", f"fresh Opus session {sid[:8]}, attempt {d['attempt']}")
        return rec

    def monitor(self, sid, managed=True):
        while True:
            rec = next(r for r in self.reconcile() if r["session_id"] == sid)
            if rec["state"] != "RUNNING":
                return rec
            if managed:
                why = self.halt_reason()
                if why:
                    return self.interrupt(rec, why)
                self.set_runner(lifecycle(self.desired(), True), activity="session", session=sid,
                                action=rec["action"], detail=f"attempt {rec['attempt']}")
            self.sleep(self.cfg.monitor_s)

    def stop_orphans(self, why):
        """After the runner is gone: end any session still alive, so nothing of ours keeps running."""
        return [self.interrupt(r, why) for r in self.reconcile() if r["state"] == "RUNNING"]

    # -- loop

    def run(self, max_sessions=None, dry_run=False, once=False):
        """dry_run / once: one observe-decide step, no lifecycle. Otherwise: the autonomous work, until
        stop / owner gone / signal (or max_sessions ended)."""
        lock = None if dry_run else self._lock()
        managed = not (dry_run or once)
        old = {}
        try:
            if managed:
                request(self.cfg.home, "running", by="start")
                self.started_at = iso(time.time())
                if threading.current_thread() is threading.main_thread():
                    for sig in (signal.SIGTERM, signal.SIGINT, signal.SIGHUP):
                        old[sig] = signal.signal(sig, self._on_signal)
                self.set_runner("RUNNING", activity="starting")
            if managed and self.cfg.concurrency > 1:
                return self._loop_parallel(max_sessions)
            return self._loop(max_sessions, dry_run, once, managed)
        except BaseException as e:
            self.stop_reason = self.stop_reason or f"runner error: {type(e).__name__}: {str(e)[:200]}"
            raise
        finally:
            if managed:
                self.set_runner("STOPPED", activity="stopped", reason=self.stop_reason or "finished")
                for sig, h in old.items():
                    signal.signal(sig, h)
            if lock:
                lock.close()
                self.lock = None

    def run_locked(self, fn, check_foreign=True):
        if check_foreign:
            lock = self._lock()
        else:
            ident = self.identity()
            lock = self.repo_lock().acquire({"repo": ident["name"]}, label=False)
        try:
            return fn(self)
        finally:
            lock.close()

    def _lock(self):
        ident = self.identity()
        lock = self.repo_lock().acquire({"repo": ident["name"], "repo_id": ident["id"],
                                         "home": os.path.abspath(self.cfg.home),
                                         "worktree": os.path.abspath(self.cfg.repo_dir), "host": socket.gethostname()})
        # A session of this repository still running under another home (its runner crashed, and it was
        # started with a different AI_HOME) would be invisible to this ledger. Don't guess: refuse.
        own = {r["session_id"] for r in self.ledger.load()}
        foreign = [w for w in live_wrappers(ident["id"]) if w["sid"] not in own]
        if foreign:
            lock.release()
            raise Busy(f"a session of {ident['name']} started under another supervisor home is still running "
                       f"({', '.join(w['sid'][:8] + ' pid ' + str(w['pid']) for w in foreign)}); "
                       "end it with `supervise.py stop` first")
        self.lock = lock
        return lock

    def stop_foreign(self, why):
        """Under the repository lock: end session wrappers of this repository that no ledger here knows."""
        own = {r["session_id"] for r in self.ledger.load()}
        ended = []
        for w in live_wrappers(self.identity()["id"]):
            if w["sid"] not in own and ps_pid(w["sid"]) == w["pid"]:   # still that wrapper, by token
                killpg(w["pid"], self.cfg.kill_grace_s, lambda: ps_pid(w["sid"]) is not None)
                ended.append({"session_id": w["sid"], "action": "?", "state": "INTERRUPTED", "reason": why})
        return ended

    def _loop(self, max_sessions, dry_run, once, managed):
        launched = ended = 0
        report = {"sessions": []}
        while True:
            if managed:
                why = self.halt_reason()
                if why:
                    return self._stop(report, why)
            running = [r for r in self.ledger.load() if r["state"] == "RUNNING"]
            if running and managed:
                # Ours or adopted after a restart: follow it to the end, never start a second one.
                rec, v = self._await(running[-1]["session_id"])
                ended += 1
                report["sessions"].append(rec)
                if rec["state"] != "INTERRUPTED" and max_sessions is not None and ended >= max_sessions:
                    return self._final(report, v)
                continue
            recs = self.reconcile(persist=not dry_run)
            v = self._observe_or_none()
            if v is None:
                if not managed:
                    return self._final(report, None)
                self.set_runner(lifecycle(self.desired(), False), activity="observe_failed",
                                detail=f"retrying in {self.cfg.poll_s:.0f}s: {self.observe_error}")
                self.sleep(self.cfg.poll_s)
                continue
            d = decide(v, recs, time.time(), self.cfg)
            if managed and d["do"] in ("launch", "merge"):
                # Re-read the controls after the (slow) observation: a stop or pause that arrived meanwhile
                # must win. Launch or merge only while running and nothing asks the run to end.
                if self.halt_reason():
                    continue   # the top of the loop ends the run without starting a session
                if self.desired() != "running":
                    d = {"do": "paused", "would": d["action"], "reason": f"paused; would {d['do']} {d['action']}"}
            self._write_decision(v, d)
            if not managed:
                if d["do"] == "launch":
                    d["command"] = self.cfg.command("<new-session-uuid>", d["action"])
                    d["cwd"] = self.cfg.workspace
                elif d["do"] == "merge":
                    d["command"] = merge_command(self.cfg, d["pr"])
                report.update(view=v, decision=d)
                if self.cfg.concurrency > 1:
                    live_n = len([r for r in recs if r["state"] == "RUNNING"])
                    sched = work.schedule(work.from_snapshot(self.snap), concurrency=self.cfg.concurrency,
                                          sessions=live_n)
                    report["parallel"] = decide_many(v, sched, recs, time.time(), self.cfg, gate=self._gate,
                                                     head_of=self._head_of(sched))
                self.log("dry_run" if dry_run else "decision", next_action=v["next_action"], do=d["do"],
                         reason=d["reason"])
                return report
            if d["do"] == "launch":
                if max_sessions is not None and launched >= max_sessions:
                    return self._final(report, v, d)
                if self.launch(d, v) is not None:   # None: workspace setup failed, recorded as a crash
                    launched += 1
                continue
            if d["do"] == "merge":   # a step like a session: counts toward --max-sessions
                report["sessions"].append(self.merge(d, v))
                ended += 1
                if max_sessions is not None and ended >= max_sessions:
                    return self._final(report, self._observe_or_none())
                continue
            self.set_runner(lifecycle(self.desired(), False), activity=d["do"], detail=d["reason"],
                            next_action=v["next_action"])
            if (d["do"], d["reason"]) != self._logged:   # one line per change, not per poll
                self._logged = (d["do"], d["reason"])
                self.log(d["do"], next_action=v["next_action"], reason=d["reason"])
                if d["do"] == "hold":
                    self.notify(f"needs you: {d['kind']}", d["reason"], urgent=True)
                elif v["action"] == "WAIT_FOR_CI":
                    self.notify("waiting for CI", v["next_action"])
            self.sleep(d.get("delay", self.cfg.poll_s))

    def _loop_parallel(self, max_sessions):
        """concurrency > 1: never block on one session. Each tick settles every session, observes when
        something ended (or every poll_s), and fills free slots from the scheduler's launch list."""
        launched = ended = 0
        report = {"sessions": []}
        seen = {r["session_id"] for r in self.ledger.load() if r["state"] == "RUNNING"}
        v = sched = None
        last_obs = 0.0
        self._pmsg = set()
        while True:
            why = self.halt_reason()
            if why:
                return self._stop(report, why)
            recs = self.reconcile()
            live = [r for r in recs if r["state"] == "RUNNING"]
            finished = [r for r in recs if r["session_id"] in seen and r["state"] != "RUNNING"]
            seen = {r["session_id"] for r in live}
            if finished or v is None or time.time() - last_obs >= self.cfg.poll_s:
                if finished:
                    self.sleep(self.cfg.settle_s)
                got = self.observe_parallel(len(live))
                if got:
                    v, sched = got
                    last_obs = time.time()
            for r in finished:
                ended += 1
                report["sessions"].append(self._settled(r, v, sched))
            if max_sessions is not None and ended >= max_sessions and not live:
                report.update(view=v, parallel=None)
                self.stop_reason = "max sessions reached"
                self.log("stopped", reason=self.stop_reason)
                return report
            if v is None:
                self.set_runner(lifecycle(self.desired(), bool(live)), activity="observe_failed",
                                detail=self.observe_error)
                self.sleep(self.cfg.poll_s)
                continue
            d = decide_many(v, sched, recs, time.time(), self.cfg, gate=self._gate, head_of=self._head_of(sched),
                            pr_of=self._pr_of)
            if d["merge"] and self.desired() == "running" and not self.halt_reason():
                for x in d["merge"]:
                    report["sessions"].append(self.merge(x, v))
                    ended += 1
                v = None      # develop moved: observe again before launching anything
                continue
            started = []
            if self.desired() == "running" and not self.halt_reason():
                for x in d["launch"]:
                    if max_sessions is not None and launched >= max_sessions:
                        break
                    used = {r.get("slot") or 0 for r in live + started}
                    slot = min(set(range(self.cfg.concurrency)) - used)
                    state = next((i["state"] for i in sched["items"] if i["id"] == x.get("work")), None)
                    rec = self.launch(x, v, slot=slot, item_state=state)
                    if rec is not None:
                        launched += 1
                        seen.add(rec["session_id"])
                        started.append(rec)
            running = live + started
            self._write_decision(v, {"do": "parallel", "reason": f"{len(running)} running", **d})
            self.set_runner(lifecycle(self.desired(), bool(running)),
                            activity=f"{len(running)} session(s)" if running else
                            ("hold" if d["holds"] else "wait"),
                            detail="; ".join(r["action"] for r in running) or
                            "; ".join(h["reason"] for h in d["holds"]) or "; ".join(d["waits"])[:300],
                            sessions=[r["action"] for r in running])
            for h in d["holds"]:            # announce each new hold once
                if ("hold", h["reason"]) not in self._pmsg:
                    self._pmsg.add(("hold", h["reason"]))
                    self.log("hold", reason=h["reason"])
                    self.notify(f"needs you: {h['kind']}", h["reason"], urgent=True)
            for w_ in d["waits"]:
                if w_.startswith("WAIT_FOR_CI") and ("ci", w_) not in self._pmsg:
                    self._pmsg.add(("ci", w_))
                    self.notify("waiting for CI", w_)
            self.sleep(self.cfg.monitor_s)

    def _settled(self, rec, v, sched):
        """Record how a finished parallel session moved its work item, and tell the user."""
        took = _dur(epoch(rec["ended_at"]) - epoch(rec["started_at"]))
        if v is not None and sched is not None and rec["state"] != "INTERRUPTED":
            after = next((i["state"] for i in sched["items"] if i["id"] == rec.get("work")), None)
            before = (rec.get("before") or {}).get("item_state")
            if rec["action"].split()[0] == "PLAN":
                moved = v["develop"] != (rec.get("before") or {}).get("develop")
            else:
                moved = after != before
            trans = "contradiction" if v["rule"] == "C0" else ("advanced" if moved else "no_progress")
            rec = self.ledger.update(rec["session_id"], transition=trans,
                                     after={"next_action": v["next_action"], "item_state": after, "develop": v["develop"]})
            self.log("state_after", session=rec["session_id"], work=rec.get("work"), item_state=after, transition=trans)
            nxt = f"; {trans}, {rec.get('work') or 'plan'} now {after or v['next_action']}"
        else:
            nxt = ""
        verdict = ((rec.get("result") or {}).get("text") or "").strip().split("\n")[0][:120]
        self.notify(f"{rec['action']} {rec['state'].lower()}", f"after {took}{nxt}" + (f". {verdict}" if verdict else ""),
                    urgent=rec["state"] not in ("COMPLETED", "INTERRUPTED"))
        return rec

    def merge(self, d, v):
        """Mechanical merge: no Opus session. A Planner PR must touch only .ai/ (AGENTS.md §6)."""
        mid = "merge-" + str(uuid.uuid4())
        rec = {"session_id": mid, "kind": "merge", "key": d["key"], "action": d["action"], "mode": "MERGE",
               "experiment": v["experiment"], "attempt": d["attempt"], "started_at": iso(time.time()),
               "before": {"next_action": v["next_action"], "develop": v["develop"]}, "pr": d["pr"]}
        state, reason = "COMPLETED", "merged"
        try:
            n = str(d["pr"]["number"])
            info = json.loads(self._gh("pr", "view", n, "--json", "mergeStateStatus,headRefOid"))
            if d["pr"].get("sha") and info.get("headRefOid") and info["headRefOid"] != d["pr"]["sha"]:
                state, reason = "UPDATED", "PR head moved since it was observed; re-observing"
            elif info.get("mergeStateStatus") == "BEHIND":
                # develop requires an up-to-date branch: bring it up to date; CI reruns, then MERGE is due again
                self._gh("pr", "update-branch", n)
                state, reason = "UPDATED", "branch was behind develop; updated it, waiting for CI"
            elif not d["pr"].get("plan") and self.cfg.bind_review:
                sha = d["pr"].get("sha") or info.get("headRefOid")
                # pull/N/head exists as long as the PR does, whatever happened to its branch; develop too
                subprocess.run(["git", "-C", self.cfg.repo_dir, "fetch", "--quiet", "origin", f"pull/{n}/head",
                                "develop"], capture_output=True, text=True, timeout=120)
                ok, why = reviewed_head(self.cfg.repo_dir, sha) if sha else (False, "PR head unknown")
                if not ok:
                    state, reason = "REFUSED", why   # the human and Strategy decide what to do with new commits
            if state == "COMPLETED" and d["pr"].get("plan"):
                files = json.loads(self._gh("pr", "view", str(d["pr"]["number"]), "--json", "files"))["files"]
                outside = [f["path"] for f in files if not f["path"].startswith(".ai/")]
                if outside:
                    state, reason = "REFUSED", f"Planner PR changes files outside .ai/: {', '.join(outside[:5])}"
            if state == "COMPLETED":
                self._gh(*merge_command(self.cfg, d["pr"])[len(self.cfg.gh):])
        except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as e:
            state, reason = "CRASHED", ((getattr(e, "stderr", None) or str(e)).strip() or repr(e))[:300]
        rec.update(state=state, reason=reason, ended_at=iso(time.time()))
        recs = self.ledger.load()
        recs.append(rec)
        self.ledger.save(recs)
        self.log(f"merge_{state.lower()}", pr=d["pr"]["number"], action=d["action"], reason=reason)
        self.notify(f"{d['action']} {state.lower()}", reason, urgent=state not in ("COMPLETED", "UPDATED"))
        if state == "COMPLETED":
            self.sleep(self.cfg.settle_s)
            after = self._observe_or_none()
            if after is not None:
                rec = self.ledger.update(mid, after={"next_action": after["next_action"], "rule": after["rule"],
                                                     "develop": after["develop"]}, transition=transition(rec, after))
        return rec

    def _gh(self, *args):
        return subprocess.run([*self.cfg.gh, *args], cwd=self.cfg.repo_dir, capture_output=True, text=True,
                              check=True, timeout=120).stdout

    def _await(self, sid):
        rec = self.monitor(sid)
        took = _dur(epoch(rec["ended_at"]) - epoch(rec["started_at"]))
        if rec["state"] == "INTERRUPTED":
            self.notify(f"{rec['action']} interrupted", f"{rec['reason']} after {took}; resumes on next start")
            return rec, None
        self.sleep(self.cfg.settle_s)
        v = self._observe_or_none()
        nxt = ""
        if v is not None:
            rec = self.ledger.update(sid, after={"next_action": v["next_action"], "rule": v["rule"],
                                                 "develop": v["develop"]}, transition=transition(rec, v))
            self.log("state_after", session=sid, next_action=v["next_action"], transition=rec["transition"])
            nxt = f"; {rec['transition']} → next {v['next_action']}"
        verdict = ((rec.get("result") or {}).get("text") or "").strip().split("\n")[0][:120]
        self.notify(f"{rec['action']} {rec['state'].lower()}", f"after {took}{nxt}" + (f". {verdict}" if verdict else ""),
                    urgent=rec["state"] != "COMPLETED")
        return rec, v

    def _observe_or_none(self):
        try:
            return self.observe()
        except Exception as e:   # network / gh / git: observation has no side effects, so just try again later
            self.observe_error = str(e)[:300]
            self.log("observe_failed", error=self.observe_error)
            return None

    def _stop(self, report, why):
        self.stop_reason = why
        for r in self.stop_orphans(why):   # normally none: monitor() already interrupted it
            report["sessions"].append(r)
        report["stopped"] = why
        self.log("stopped", reason=why)
        return report

    def _final(self, report, v, d=None):
        if v is not None and d is None:
            d = decide(v, self.ledger.load(), time.time(), self.cfg)
        report.update(view=v, decision=d)
        self.stop_reason = "max sessions reached"
        if v is not None:
            self._write_decision(v, d)
            self.log("stopped", next_action=v["next_action"], next_do=d["do"], reason=d["reason"])
        return report

    def _write_decision(self, v, d):
        sup.write_json(os.path.join(self.cfg.home, "supervisor.json"), {"at": iso(time.time()), "view": v, "decision": d})


# ---------------------------------------------------------------- status (read-only)

MODE = {"EXECUTE": "EXECUTION", "PLAN": "STRATEGY", "REVIEW": "STRATEGY", "MERGE": "SUPERVISOR (mechanical)"}


def status_report(home, view=None, now=None, owner=None):
    """Everything a watcher needs, from the runtime files (or a fresh `view`). Reads, never writes.
    owner: RepoLock.probe() of the repository, when known."""
    now = now or time.time()
    runner = runner_info(home)
    last = read_json(os.path.join(home, "supervisor.json")) or {}
    recs = Ledger(home).load()
    v = view or last.get("view") or {}
    d = decide(v, recs, now, Config(home=home)) if view else (last.get("decision") or {})
    proj = v.get("project") or {}
    lives = [r for r in recs if r["state"] == "RUNNING"]
    live = lives[-1] if lives else None
    done = next((r for r in reversed(recs) if r["state"] != "RUNNING"), None)

    def view_session(x):
        sdir = session_dir(Config(home=home), x["session_id"])
        act = max([epoch(x["started_at"])] + [os.path.getmtime(os.path.join(sdir, f))
                  for f in ("log.jsonl", "stderr.log") if os.path.exists(os.path.join(sdir, f))])
        return {"id": x["session_id"], "action": x["action"], "attempt": x["attempt"], "slot": x.get("slot"),
                "pid": x.get("pid"), "alive": ps_pid(x["session_id"]) is not None,
                "started_at": x["started_at"], "elapsed_s": int(now - epoch(x["started_at"])),
                "quiet_s": int(now - act), "timeout_s": x["timeout_s"],
                "last_step": last_step(os.path.join(sdir, "log.jsonl"))}
    sessions = [view_session(x) for x in lives]
    session = sessions[-1] if sessions else None
    last_result = None
    if done:
        last_result = {k: done.get(k) for k in ("action", "state", "reason", "attempt", "transition", "ended_at")}
        last_result["after"] = (done.get("after") or {}).get("next_action")
        last_result["elapsed_s"] = int(epoch(done["ended_at"]) - epoch(done["started_at"])) \
            if done.get("started_at") and done.get("ended_at") else None
        last_result.update({k: v_ for k, v_ in (done.get("result") or {}).items() if k != "text"})
        last_result["summary"] = ((done.get("result") or {}).get("text") or "").strip().split("\n")[0][:300] or None
    waiting = None
    if v.get("action") == "WAIT_FOR_CI":
        waiting = {"on": "CI", "detail": v["next_action"], "pr": proj.get("pr")}
    elif v.get("action") in INFLIGHT and not live:
        waiting = {"on": "session outside this supervisor", "detail": v["next_action"]}
    blockers = [f"STATE.now.blockers: {b}" for b in proj.get("blockers") or []]
    blockers += [f"{a['kind']}: {a['detail']}" for a in v.get("attention") or [] if a["kind"] != "state_blockers"]
    if d.get("do") == "hold":
        blockers.append(f"hold {d.get('kind')}: {d.get('reason')}")
    for h in d.get("holds") or []:   # parallel runner: every hold it is sitting on
        blockers.append(f"hold {h.get('kind')}: {h.get('reason')}")
    return {
        "runner": {k: runner.get(k) for k in ("state", "desired", "pid", "owner", "started_at", "updated_at",
                                              "activity", "detail", "stop_reason", "reason")}
                  | {"uptime_s": int(now - epoch(runner["started_at"])) if runner.get("alive") and
                     runner.get("started_at") else None},
        "control": read_control(home),
        "owner": None if owner is None else dict({k: (owner["record"] or {}).get(k) for k in (
            "repo", "pid", "home", "worktree", "acquired_at", "released_at")}, alive=owner["alive"]),
        "outcome": {"id": proj.get("outcome"), "statement": proj.get("outcome_statement")},
        "experiment": {"id": v.get("experiment"), "status": v.get("exp_status"), "phase": v.get("phase"),
                       "question": proj.get("question"), "verdict": proj.get("verdict"), "pr": proj.get("pr")},
        "mode": MODE.get(live["action"].split()[0]) if live else None,
        "session": session,
        "sessions": sessions,
        "last_result": last_result,
        "state_last_result": proj.get("last_result"),
        "next": {"action": v.get("next_action"), "do": d.get("do"), "reason": d.get("reason"),
                 "observed_at": v.get("at") if view else last.get("at")},
        "waiting": waiting,
        "blockers": blockers,
        "events": _tail_jsonl(os.path.join(home, "events.jsonl"), 5),
    }


def _tail_jsonl(path, n):
    try:
        with open(path) as fh:
            lines = fh.readlines()[-n:]
    except FileNotFoundError:
        return []
    out = []
    for line in lines:
        try:
            out.append(json.loads(line))
        except ValueError:
            pass
    return out


def _dur(s):
    if s is None:
        return "-"
    s = int(s)
    return f"{s // 3600}h{s % 3600 // 60:02d}m" if s >= 3600 else f"{s // 60}m{s % 60:02d}s"


def print_report(r, out=print):
    ru, ex, se, lr, nx = r["runner"], r["experiment"], r["session"], r["last_result"], r["next"]
    extra = f"up {_dur(ru['uptime_s'])}, pid {ru['pid']}, owner {ru['owner']}" if ru["uptime_s"] is not None \
        else (ru.get("stop_reason") or ru.get("reason") or "not started")
    out(f"runner      : {ru['state']}  ({extra}; requested: {r['control'].get('desired')})")
    ow = r.get("owner")
    if ow and ow.get("repo"):
        who = f"pid {ow['pid']}, home {ow['home']}, worktree {ow['worktree']}"
        out(f"repo owner  : {ow['repo']} — " + (f"held by {who} since {ow['acquired_at']}" if ow["alive"]
                                               else f"free (last: {who})"))
    if ru.get("activity") and ru["state"] != "STOPPED":
        out(f"activity    : {ru['activity']}" + (f" — {ru['detail']}" if ru.get("detail") else ""))
    if r["next"]["action"] is None:
        out("project     : not observed yet")
        for b in r["blockers"]:
            out(f"blocker     : {b}")
        return
    out(f"outcome     : {r['outcome']['id']} — {r['outcome']['statement'] or '?'}")
    out(f"experiment  : {ex['id']} {ex['status']} ({ex['phase']})" + (f", verdict {ex['verdict']}" if ex["verdict"] else "")
        + (f", PR #{ex['pr']['number']} {ex['pr']['state']} ci={ex['pr']['ci']}" if ex.get("pr") else ""))
    if ex.get("question"):
        out(f"              {ex['question'][:160]}")
    if se:
        many = r.get("sessions") or [se]
        out(f"mode        : {', '.join(sorted({MODE.get(x['action'].split()[0], '?') for x in many}))} "
            f"({len(many)} Opus session{'s' if len(many) > 1 else ''} running)")
        for x in many:
            slot = f" [slot {x['slot']}]" if len(many) > 1 and x.get("slot") is not None else ""
            out(f"session     : {x['id'][:8]} {x['action']} attempt {x['attempt']}{slot}, elapsed {_dur(x['elapsed_s'])}"
                f" of {_dur(x['timeout_s'])}, quiet {_dur(x['quiet_s'])}" + ("" if x["alive"] else " [process gone]"))
            if x.get("last_step"):
                out(f"last step   : {x['last_step']}")
    else:
        out("mode        : none (no Opus session running)")
    if lr:
        cost = f", ${lr['cost_usd']:.2f}" if lr.get("cost_usd") else ""
        moved = f"; {lr['transition']} → {lr['after']}" if lr.get("transition") else ""
        out(f"last result : {lr['action']} → {lr['state']} ({lr['reason']}) after {_dur(lr['elapsed_s'])}{cost}{moved}")
        if lr.get("summary"):
            out(f"              {lr['summary']}")
    elif r.get("state_last_result"):
        out(f"last result : (STATE) {r['state_last_result'][:160]}")
    when = " when started" if ru["state"] == "STOPPED" and nx.get("do") == "launch" else ""
    out(f"next action : {nx['action']} → {nx['do']}{when}" + (f" — {nx['reason']}" if nx.get("reason") else "")
        + (f"  (observed {nx['observed_at']})" if nx.get("observed_at") else ""))
    if r["waiting"]:
        out(f"waiting     : {r['waiting']['on']}: {r['waiting']['detail']}")
    for b in r["blockers"]:
        out(f"blocker     : {b}")
    for e in r.get("events") or []:
        out(f"event       : {e['at'][11:19]} {'!' if e.get('urgent') else ' '} {e['title']} — {e['message'][:150]}")


# ---------------------------------------------------------------- CLI

def repo_owner(cfg):
    return RepoLock.for_repo(cfg.lock_dir, cfg.identity or repo_identity(cfg.repo_dir)).probe()


def main(argv=None, overrides=None):
    """overrides: Config fields for tests (lock_dir, identity); deliberately not reachable from the CLI."""
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ["_wrap"]:   # _wrap --sup-session SID --sup-repo RID --owner PID SDIR CWD -- CMD...
        i = argv.index("--")
        wrap(argv[7], argv[8], argv[i + 1:], owner=int(argv[6]) or None)
        return 0
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--home", help="runtime state dir (default $AI_HOME or ~/.barocss-ai)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("start", help="start the autonomous work in the foreground (until stop / owner exit)")
    r.add_argument("--dry-run", action="store_true", help="observe and decide once; launch nothing, keep the ledger")
    r.add_argument("--once", action="store_true", help="one observe/decide step without launching")
    r.add_argument("--max-sessions", type=int, help="stop after this many sessions have ended")
    r.add_argument("--owner", type=int, help="stop when this pid exits (default: the parent process)")
    r.add_argument("--no-owner", action="store_true", help="don't tie the run to a parent process")
    r.add_argument("--no-fetch", action="store_true")
    r.add_argument("--model", default="opus")
    r.add_argument("--permission-mode", default="auto")
    r.add_argument("--claude", default="claude", help="claude executable")
    r.add_argument("--poll", type=float, default=60)
    r.add_argument("--concurrency", type=int, default=1,
                   help="Opus sessions at once (default 1: the serial loop). >1: independent work items run side by "
                        "side as the Work DAG scheduler allows; at most one Strategy-mode session at a time")
    r.add_argument("--no-notify", action="store_true", help="no desktop notifications (events.jsonl is still written)")
    sub.add_parser("pause", help="launch no new session; let a running one finish")
    sub.add_parser("resume", help="undo pause")
    s = sub.add_parser("stop", help="stop the autonomous work now; a running session is interrupted (resumable)")
    s.add_argument("--wait", type=float, default=90, help="seconds to wait for the runner to exit")
    st = sub.add_parser("status")
    st.add_argument("--json", action="store_true")
    st.add_argument("--refresh", action="store_true", help="observe GitHub now (read-only) instead of the last observation")
    rl = sub.add_parser("release", help="ignore past attempts of KEY so it may launch again")
    rl.add_argument("key")
    a = ap.parse_args(argv)
    kw = {"home": a.home} if a.home else {}
    kw.update(overrides or {})
    if a.cmd == "start":
        owner = None if a.no_owner or a.dry_run or a.once else (a.owner or os.getppid())
        cfg = Config(model=a.model, permission_mode=a.permission_mode, claude=[a.claude], poll_s=a.poll,
                     fetch=not a.no_fetch, owner=owner, notify=not (a.no_notify or a.dry_run or a.once),
                     concurrency=max(1, a.concurrency), **kw)
        try:
            rep = Supervisor(cfg).run(max_sessions=a.max_sessions, dry_run=a.dry_run, once=a.once)
        except Busy as e:
            print(f"not started: {e}", file=sys.stderr)
            if (e.owner or {}).get("home"):
                print_report(status_report(e.owner["home"], owner=repo_owner(cfg)),
                             out=lambda x: print(x, file=sys.stderr))
            return 2
        print(json.dumps(rep, indent=2, default=str))
        return 0
    cfg = Config(**kw)
    o = repo_owner(cfg)
    rec = o["record"] or {}
    # Controls go to whoever owns the repository, whichever worktree or AI_HOME they were typed in.
    target = rec.get("home") if o["alive"] and rec.get("home") else cfg.home
    if a.cmd in ("pause", "resume"):
        if not o["alive"] or not runner_info(target)["alive"]:
            print("not running (use `start`)" if a.cmd == "resume" else "not running; nothing to pause")
            return 1
        request(target, "paused" if a.cmd == "pause" else "running", by=a.cmd)
        print(f"{a.cmd} requested ({target})")
        t = time.time()
        while time.time() - t < 5 and runner_info(target).get("desired") != read_control(target)["desired"]:
            time.sleep(0.2)
        print_report(status_report(target, owner=repo_owner(cfg)))
        return 0
    if a.cmd == "stop":
        request(target, "stopped", by="stop")
        t = time.time()
        while repo_owner(cfg)["alive"] and time.time() - t < a.wait:
            time.sleep(0.5)
        if repo_owner(cfg)["alive"]:
            print(f"repository owner still running after {a.wait:.0f}s", file=sys.stderr)
            return 1
        homes = {os.path.abspath(h) for h in (cfg.home, rec.get("home")) if h} - {os.path.abspath(cfg.home)}

        def sweep(sv_):
            left = sv_.stop_orphans("stop requested")
            for h in homes:
                left += Supervisor(Config(**dict(kw, home=h)), out=lambda *x: None).stop_orphans("stop requested")
            return left + sv_.stop_foreign("stop requested")
        try:
            left = Supervisor(cfg, out=lambda *x: None).run_locked(sweep, check_foreign=False)
        except Busy:   # someone started a new run in the meantime: it owns what is left
            left = []
        for x in left:
            print(f"interrupted orphan session {x['session_id'][:8]} ({x['action']})")
        print_report(status_report(target, owner=repo_owner(cfg)))
        return 0
    if a.cmd == "status":
        view = None
        if a.refresh:
            snap = sup.collect_live(fetch=True)
            view = view_of(snap, sup.derive(snap))
        if not o["alive"] and not os.path.exists(os.path.join(cfg.home, "runner.json")) and rec.get("home"):
            target = rec["home"]   # nothing here: show the last run of this repository
        rep = status_report(target, view=view, owner=o)
        print(json.dumps(rep, indent=2, default=str)) if a.json else print_report(rep)
        return 0
    led = Ledger(cfg.home)
    recs = led.load()
    n = 0
    for x in recs:
        if x["key"] == a.key and not x.get("released"):
            x["released"], n = True, n + 1
    led.save(recs)
    print(f"released {n} record(s) of {a.key}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
