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
import argparse, fcntl, json, os, signal, subprocess, sys, threading, time, uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402

STANDARD_INSTRUCTION = (
    "Read AGENTS.md and follow it.\n\n"
    "Determine your mode from the durable project state on origin/develop exactly as §1 says.\n\n"
    "Run one pass of that mode, then stop."
)

LAUNCH = {"PLAN", "EXECUTE", "REVIEW", "MERGE"}   # a fresh session does it (MERGE authority stays with Strategy)
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
        self.tick_s = 1.0                       # how quickly pause / resume / stop take effect
        self.__dict__.update(kw)
        self.workspace = kw.get("workspace") or os.path.join(self.home, "workspace")

    def timeout_for(self, action):
        return self.timeout_s.get(action.split()[0], self.default_timeout_s)

    def command(self, sid):
        return [*self.claude, "-p", STANDARD_INSTRUCTION, "--model", self.model,
                "--permission-mode", self.permission_mode, "--session-id", sid,
                "--output-format", "stream-json", "--verbose"]


def iso(t):
    return datetime.fromtimestamp(t, timezone.utc).isoformat(timespec="seconds")


def epoch(s):
    return sup.parse_time(s).timestamp()


# ---------------------------------------------------------------- view + decide (pure)

def view_of(snap, st):
    """The few observed facts decide() reads, from a Phase 1 snapshot and its derived status."""
    a = st["next_action"]
    word = a.split()[0]
    dev = snap["develop"].get("sha") or ""
    head = None
    if word == "WAIT_EXECUTION" and st["experiments"]:
        head = (snap["branches"].get(st["experiments"][0]["branch"]) or {}).get("time")
    elif word == "WAIT_PLAN":
        head = (snap["branches"].get(a.split()[1]) or {}).get("time")
    exp = st["experiments"][0] if st["experiments"] else {}
    return {"at": snap.get("at"), "next_action": a, "action": word, "rule": st["rule"], "state": st["state"],
            "phase": st["phase"], "key": f"{a}@{dev[:12]}", "develop": dev, "head_time": head,
            "experiment": exp.get("id"), "exp_status": exp.get("status"), "attention": st["attention"],
            "project": _project(snap, st, exp)}


def _project(snap, st, exp):
    """Display only (status): what the durable state says the project is doing. decide() never reads it."""
    state = snap["develop"].get("state") or {}
    now = state.get("now") or {}
    oid = now.get("active_outcome") or next((o["id"] for o in st["outcomes"] if o["status"] == "active"), None)
    src = (snap["branches"].get(exp.get("branch")) or {}).get("exp") if exp.get("source") == "branch" \
        else snap["develop"].get("exp")
    flat = lambda x: " ".join(str(x).split()) if x else None
    return {"outcome": oid, "outcome_statement": flat(((state.get("outcomes") or {}).get(oid) or {}).get("statement")),
            "question": flat((src or {}).get("question")), "last_result": flat(now.get("last_result")),
            "blockers": list(now.get("blockers") or []), "pr": exp.get("pr"),
            "verdict": exp.get("proposed_verdict")}


def decide(v, records, now, cfg):
    """Pure: (view, ledger records, now, config) → one decision. Never returns two launches."""
    live = [r for r in records if r["state"] == "RUNNING"]
    if live:
        return {"do": "monitor", "session": live[-1]["session_id"], "reason": "a session is alive; never launch a second"}
    recs = [r for r in records if not r.get("released")]
    word = v["action"]
    if word in LAUNCH:
        return _attempt(v["key"], v["next_action"], recs, now, cfg)
    if word in INFLIGHT:
        last = recs[-1] if recs else None
        head = epoch(v["head_time"]) if v.get("head_time") else None
        if last and head is not None and epoch(last["ended_at"]) >= head:
            # Nothing was pushed since our last session ended, so the half-done pass is ours.
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
    info = read_json(os.path.join(home, "runner.json")) or {}
    pid = info.get("pid")
    alive = bool(pid) and (pid == os.getpid() or (pid_alive(pid) and "supervise.py" in subprocess.run(
        ["ps", "-o", "command=", "-p", str(pid)], capture_output=True, text=True).stdout))
    if not alive and info.get("state") not in (None, "STOPPED"):
        info = dict(info, state="STOPPED", stop_reason="runner process gone (crashed or killed)")
    info.setdefault("state", "STOPPED")
    info["alive"] = alive
    return info


# ---------------------------------------------------------------- supervisor (I/O)

class Busy(RuntimeError):
    pass


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

    def _observe_live(self):
        snap = sup.collect_live(fetch=self.cfg.fetch)
        return snap, sup.derive(snap)

    def observe(self):
        snap, st = self.observe_fn()
        sup.write_json(os.path.join(self.cfg.home, "status.json"), st)
        return view_of(snap, st)

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
                "started_at": self.started_at, "updated_at": iso(time.time()), **kw}
        prev = read_json(os.path.join(self.cfg.home, "runner.json")) or {}
        sup.write_json(os.path.join(self.cfg.home, "runner.json"), info)
        if prev.get("state") != state or prev.get("pid") != os.getpid():
            self.log("runner", state=state, **{k: v for k, v in kw.items() if k in ("activity", "reason")})

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

    def prepare_workspace(self):
        ws = self.cfg.workspace
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

    def launch(self, d, v):
        sid = str(uuid.uuid4())
        sdir = session_dir(self.cfg, sid)
        os.makedirs(sdir)
        try:
            if self.cfg.prepare:
                self.prepare_workspace()
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
                         "before": {"next_action": v["next_action"], "develop": v["develop"]}, "dir": sdir})
            self.ledger.save(recs)
            self.log("session_crashed", session=sid, action=d["action"], attempt=d["attempt"],
                     reason=f"workspace setup failed: {err}")
            return None
        cwd = self.cfg.workspace
        os.makedirs(cwd, exist_ok=True)
        cmd = self.cfg.command(sid)
        now = time.time()
        rec = {"session_id": sid, "key": d["key"], "action": d["action"], "experiment": v["experiment"],
               "attempt": d["attempt"], "state": "RUNNING", "pid": None, "pgid": None,
               "started_at": iso(now), "last_activity": iso(now), "ended_at": None,
               "timeout_s": self.cfg.timeout_for(d["action"]), "idle_timeout_s": self.cfg.idle_timeout_s,
               "exit_code": None, "reason": None, "before": {"next_action": v["next_action"], "develop": v["develop"]},
               "cwd": cwd, "dir": sdir}
        recs = self.ledger.load()
        recs.append(rec)
        self.ledger.save(recs)   # recorded before spawn: a crash here leaves a RUNNING record reconcile settles
        with open(os.path.join(sdir, "wrapper.log"), "ab") as wlog:
            p = subprocess.Popen([sys.executable, os.path.abspath(__file__), "_wrap", "--sup-session", sid,
                                  "--owner", str(self.cfg.owner or 0), sdir, cwd, "--", *cmd],
                                 start_new_session=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                 stderr=wlog)
        self.procs[sid] = p
        rec = self.ledger.update(sid, pid=p.pid, pgid=p.pid)
        self.log("session_launched", session=sid, action=d["action"], attempt=d["attempt"], pid=p.pid)
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

    def run_locked(self, fn):
        lock = self._lock()
        try:
            return fn(self)
        finally:
            lock.close()

    def _lock(self):
        fh = open(os.path.join(self.cfg.home, "supervisor.lock"), "w")
        try:
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            fh.close()
            raise Busy(f"another supervisor holds {fh.name}")
        return fh

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
            if managed and self.desired() == "paused" and d["do"] == "launch":
                d = {"do": "paused", "would": d["action"], "reason": f"paused; would launch {d['action']}"}
            self._write_decision(v, d)
            if not managed:
                if d["do"] == "launch":
                    d["command"] = self.cfg.command("<new-session-uuid>")
                    d["cwd"] = self.cfg.workspace
                report.update(view=v, decision=d)
                self.log("dry_run" if dry_run else "decision", next_action=v["next_action"], do=d["do"],
                         reason=d["reason"])
                return report
            if d["do"] == "launch":
                if max_sessions is not None and launched >= max_sessions:
                    return self._final(report, v, d)
                if self.launch(d, v) is not None:   # None: workspace setup failed, recorded as a crash
                    launched += 1
                continue
            self.set_runner(lifecycle(self.desired(), False), activity=d["do"], detail=d["reason"],
                            next_action=v["next_action"])
            if (d["do"], d["reason"]) != self._logged:   # one line per change, not per poll
                self._logged = (d["do"], d["reason"])
                self.log(d["do"], next_action=v["next_action"], reason=d["reason"])
            self.sleep(d.get("delay", self.cfg.poll_s))

    def _await(self, sid):
        rec = self.monitor(sid)
        if rec["state"] == "INTERRUPTED":
            return rec, None
        self.sleep(self.cfg.settle_s)
        v = self._observe_or_none()
        if v is not None:
            rec = self.ledger.update(sid, after={"next_action": v["next_action"], "rule": v["rule"],
                                                 "develop": v["develop"]}, transition=transition(rec, v))
            self.log("state_after", session=sid, next_action=v["next_action"], transition=rec["transition"])
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

MODE = {"EXECUTE": "EXECUTION", "PLAN": "STRATEGY", "REVIEW": "STRATEGY", "MERGE": "STRATEGY"}


def status_report(home, view=None, now=None):
    """Everything a watcher needs, from the runtime files (or a fresh `view`). Reads, never writes."""
    now = now or time.time()
    runner = runner_info(home)
    last = read_json(os.path.join(home, "supervisor.json")) or {}
    recs = Ledger(home).load()
    v = view or last.get("view") or {}
    d = decide(v, recs, now, Config(home=home)) if view else (last.get("decision") or {})
    proj = v.get("project") or {}
    live = next((r for r in reversed(recs) if r["state"] == "RUNNING"), None)
    done = next((r for r in reversed(recs) if r["state"] != "RUNNING"), None)
    session = None
    if live:
        sdir = session_dir(Config(home=home), live["session_id"])
        act = max([epoch(live["started_at"])] + [os.path.getmtime(os.path.join(sdir, f))
                  for f in ("log.jsonl", "stderr.log") if os.path.exists(os.path.join(sdir, f))])
        session = {"id": live["session_id"], "action": live["action"], "attempt": live["attempt"],
                   "pid": live.get("pid"), "alive": ps_pid(live["session_id"]) is not None,
                   "started_at": live["started_at"], "elapsed_s": int(now - epoch(live["started_at"])),
                   "quiet_s": int(now - act), "timeout_s": live["timeout_s"],
                   "last_step": last_step(os.path.join(sdir, "log.jsonl"))}
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
    return {
        "runner": {k: runner.get(k) for k in ("state", "desired", "pid", "owner", "started_at", "updated_at",
                                              "activity", "detail", "stop_reason", "reason")}
                  | {"uptime_s": int(now - epoch(runner["started_at"])) if runner.get("alive") and
                     runner.get("started_at") else None},
        "control": read_control(home),
        "outcome": {"id": proj.get("outcome"), "statement": proj.get("outcome_statement")},
        "experiment": {"id": v.get("experiment"), "status": v.get("exp_status"), "phase": v.get("phase"),
                       "question": proj.get("question"), "verdict": proj.get("verdict"), "pr": proj.get("pr")},
        "mode": MODE.get(live["action"].split()[0]) if live else None,
        "session": session,
        "last_result": last_result,
        "state_last_result": proj.get("last_result"),
        "next": {"action": v.get("next_action"), "do": d.get("do"), "reason": d.get("reason"),
                 "observed_at": v.get("at") if view else last.get("at")},
        "waiting": waiting,
        "blockers": blockers,
    }


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
        out(f"mode        : {r['mode']} (Opus session running)")
        out(f"session     : {se['id'][:8]} {se['action']} attempt {se['attempt']}, elapsed {_dur(se['elapsed_s'])}"
            f" of {_dur(se['timeout_s'])}, quiet {_dur(se['quiet_s'])}" + ("" if se["alive"] else " [process gone]"))
        if se.get("last_step"):
            out(f"last step   : {se['last_step']}")
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


# ---------------------------------------------------------------- CLI

def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ["_wrap"]:   # _wrap --sup-session SID --owner PID SDIR CWD -- CMD...
        i = argv.index("--")
        wrap(argv[5], argv[6], argv[i + 1:], owner=int(argv[4]) or None)
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
    if a.cmd == "start":
        owner = None if a.no_owner or a.dry_run or a.once else (a.owner or os.getppid())
        cfg = Config(model=a.model, permission_mode=a.permission_mode, claude=[a.claude], poll_s=a.poll,
                     fetch=not a.no_fetch, owner=owner, **kw)
        try:
            rep = Supervisor(cfg).run(max_sessions=a.max_sessions, dry_run=a.dry_run, once=a.once)
        except Busy:
            print("already running:", file=sys.stderr)
            print_report(status_report(cfg.home), out=lambda x: print(x, file=sys.stderr))
            return 2
        print(json.dumps(rep, indent=2, default=str))
        return 0
    cfg = Config(**kw)
    home = cfg.home
    if a.cmd in ("pause", "resume"):
        if not runner_info(home)["alive"]:
            print("not running (use `start`)" if a.cmd == "resume" else "not running; nothing to pause")
            return 1
        request(home, "paused" if a.cmd == "pause" else "running", by=a.cmd)
        print(f"{a.cmd} requested")
        t = time.time()
        while time.time() - t < 5 and runner_info(home).get("desired") != read_control(home)["desired"]:
            time.sleep(0.2)
        print_report(status_report(home))
        return 0
    if a.cmd == "stop":
        request(home, "stopped", by="stop")
        t = time.time()
        while runner_info(home)["alive"] and time.time() - t < a.wait:
            time.sleep(0.5)
        if runner_info(home)["alive"]:
            print(f"runner still alive after {a.wait:.0f}s", file=sys.stderr)
            return 1
        try:
            left = Supervisor(cfg, out=lambda *x: None).run_locked(lambda s: s.stop_orphans("stop requested"))
        except Busy:
            left = []
        for x in left:
            print(f"interrupted orphan session {x['session_id'][:8]} ({x['action']})")
        print_report(status_report(home))
        return 0
    if a.cmd == "status":
        view = None
        if a.refresh:
            snap = sup.collect_live(fetch=True)
            view = view_of(snap, sup.derive(snap))
        rep = status_report(home, view=view)
        print(json.dumps(rep, indent=2, default=str)) if a.json else print_report(rep)
        return 0
    led = Ledger(home)
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
