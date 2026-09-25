#!/usr/bin/env python3
"""Serial autonomous supervisor for the V1 protocol (V2 Phase 2).

It removes one human action: opening a fresh Opus session and pasting the standard instruction.
Everything else stays V1 (AGENTS.md). The loop:

  observe (Phase 1: sup.collect_live + sup.derive) → decide (pure, below) → wait | hold | launch ONE
  fresh session with STANDARD_INSTRUCTION → monitor it (exit / crash / timeout) → re-observe → repeat

  python3 tools/ai-supervisor/supervise.py run --dry-run          # observe + decide, launch nothing
  python3 tools/ai-supervisor/supervise.py run                    # loop forever, one session at a time
  python3 tools/ai-supervisor/supervise.py run --max-sessions 1   # canary: one handoff, then stop
  python3 tools/ai-supervisor/supervise.py status                 # ledger + last decision
  python3 tools/ai-supervisor/supervise.py release KEY            # re-arm an action held after retries

The supervisor decides only mechanics: whether a session is alive, whether a process failed, whether
to wait. It never reads a verdict, a priority or evidence; the launched session does all of that
under AGENTS.md. Runtime state lives outside git in $AI_HOME (default ~/.barocss-ai).
"""
import argparse, fcntl, json, os, signal, subprocess, sys, time, uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402
import work  # noqa: E402

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


def instruction(action):
    """STANDARD_INSTRUCTION plus the observed step. Without an action, the V1 instruction unchanged."""
    if not action:
        return STANDARD_INSTRUCTION
    word, _, target = action.partition(" ")
    return (f"{STANDARD_INSTRUCTION}\n\nThe supervisor observed that the next step is {action}: "
            f"{ADDRESS[word].format(target=target)}. Confirm it with §1 first. If §1 gives a different mode "
            "or work item, stop without changing anything.")

LAUNCH = {"PLAN", "EXECUTE", "REVIEW", "MERGE"}   # a fresh session does it (MERGE authority stays with Strategy)
INFLIGHT = {"WAIT_EXECUTION", "WAIT_PLAN"}        # a pass is mid-way; whose session is it?
WAIT = {"WAIT_FOR_CI"}                            # external; the supervisor waits, no session is kept alive
HOLD = {"BLOCKED", "HUMAN_REQUIRED", "IDLE"}      # don't guess
FAILED = {"CRASHED", "TIMED_OUT"}                 # process/environment failures: the only retryable ones
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
        self.__dict__.update(kw)
        self.workspace = kw.get("workspace") or os.path.join(self.home, "workspace")

    def timeout_for(self, action):
        return self.timeout_s.get(action.split()[0], self.default_timeout_s)

    def command(self, sid, action=None):
        return [*self.claude, "-p", instruction(action), "--model", self.model,
                "--permission-mode", self.permission_mode, "--session-id", sid,
                "--output-format", "stream-json", "--verbose"]


def mode_of(action):
    return work.MODE.get(action.split()[0])


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
    word = a.split()[0]
    dev = snap["develop"].get("sha") or ""
    head = None
    if word == "WAIT_EXECUTION" and st["experiments"]:
        head = (snap["branches"].get(st["experiments"][0]["branch"]) or {}).get("time")
    elif word == "WAIT_PLAN":
        head = (snap["branches"].get(a.split()[1]) or {}).get("time")
    exp = st["experiments"][0] if st["experiments"] else {}
    return {"at": snap.get("at"), "next_action": a, "action": word, "rule": st["rule"], "state": st["state"],
            "key": f"{a}@{dev[:12]}", "develop": dev, "head_time": head, "experiment": exp.get("id"),
            "exp_status": exp.get("status"), "attention": st["attention"],
            "mode": w["mode"], "v1_next_action": st["next_action"], "agrees_with_v1": w["agrees_with_v1"],
            "work": {"buckets": w["buckets"], "planner": w["planner"], "concurrency": w["concurrency"]}}


def decide(v, records, now, cfg):
    """Pure: (view, ledger records, now, config) → one decision. Never returns two launches."""
    live = [r for r in records if r["state"] == "RUNNING"]
    if live:
        return {"do": "monitor", "session": live[-1]["session_id"], "reason": "a session is alive; never launch a second"}
    recs = [r for r in records if not r.get("released")]
    if not v.get("agrees_with_v1", True):
        # Until the V1 RULES retire, a scheduler that disagrees with them is a bug to look at, not a plan.
        return _hold("work_model_disagrees", f"work {v['next_action']} vs V1 {v['v1_next_action']}")
    word = v["action"]
    if word in LAUNCH:
        return _attempt(v["key"], v["next_action"], recs, now, cfg)
    if word in INFLIGHT:
        last = recs[-1] if recs else None
        head = epoch(v["head_time"]) if v.get("head_time") else None
        if last and head is not None and epoch(last["ended_at"]) >= head:
            # Nothing was pushed since our last session ended, so the half-done pass is ours.
            if last["state"] in FAILED:
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
        d["reason"] = f"resume {action} after a process failure (repository shows {resume})"
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
    """(state, reason, exit code) of a session whose process is gone."""
    try:
        with open(os.path.join(sdir, "exit.json")) as fh:
            code = json.load(fh)["code"]
    except (FileNotFoundError, ValueError, KeyError):
        return "CRASHED", "process ended without an exit record (killed, or stale ledger)", None
    res = result_event(os.path.join(sdir, "log.jsonl"))
    if code != 0:
        return "CRASHED", f"exit code {code}", code
    if res is None:
        return "CRASHED", "exit 0 without a result event", code
    if res.get("is_error"):
        return "CRASHED", f"session error: {res.get('subtype')} api_status={res.get('api_error_status')}", code
    return "COMPLETED", res.get("subtype", "success"), code


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


def wrap(sdir, cwd, cmd):
    """Detached parent of one session: runs it, then writes exit.json. Outlives the supervisor."""
    env = {k: v for k, v in os.environ.items()
           if k in SCRUB_KEEP or not (k.startswith("CLAUDE") or k in ("AI_AGENT", "BAGGAGE"))}
    with open(os.path.join(sdir, "log.jsonl"), "ab") as out, open(os.path.join(sdir, "stderr.log"), "ab") as err:
        try:
            code = subprocess.Popen(cmd, cwd=cwd, stdin=subprocess.DEVNULL, stdout=out, stderr=err, env=env).wait()
        except OSError as e:
            err.write(f"spawn failed: {e}\n".encode())
            code = 127
    sup.write_json(os.path.join(sdir, "exit.json"), {"code": code, "ended_at": iso(time.time())})


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
            state, reason, code = outcome(sdir)
            r.update(state=state, reason=reason, exit_code=code, ended_at=iso(time.time()))
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

    def prepare_workspace(self):
        ws = self.cfg.workspace
        if not os.path.isdir(os.path.join(ws, ".git")):
            url = sup.git("remote", "get-url", "origin").strip()
            subprocess.run(["git", "clone", "--quiet", "--reference-if-able", sup.TOP, "--dissociate", url, ws],
                           check=True)
        g = lambda *a: subprocess.run(["git", "-C", ws, *a], check=True, capture_output=True, text=True).stdout
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
        if self.cfg.prepare:
            self.prepare_workspace()
        cwd = self.cfg.workspace
        os.makedirs(cwd, exist_ok=True)
        cmd = self.cfg.command(sid, d["action"])
        now = time.time()
        rec = {"session_id": sid, "key": d["key"], "action": d["action"], "experiment": v["experiment"],
               "mode": mode_of(d["action"]),
               "attempt": d["attempt"], "state": "RUNNING", "pid": None, "pgid": None,
               "started_at": iso(now), "last_activity": iso(now), "ended_at": None,
               "timeout_s": self.cfg.timeout_for(d["action"]), "idle_timeout_s": self.cfg.idle_timeout_s,
               "exit_code": None, "reason": None, "before": {"next_action": v["next_action"], "develop": v["develop"]},
               "cwd": cwd, "dir": sdir}
        recs = self.ledger.load()
        recs.append(rec)
        self.ledger.save(recs)   # recorded before spawn: a crash here leaves a RUNNING record reconcile settles
        with open(os.path.join(sdir, "wrapper.log"), "ab") as wlog:
            p = subprocess.Popen([sys.executable, os.path.abspath(__file__), "_wrap", "--sup-session", sid, sdir, cwd,
                                  "--", *cmd], start_new_session=True, stdin=subprocess.DEVNULL,
                                 stdout=subprocess.DEVNULL, stderr=wlog)
        self.procs[sid] = p
        rec = self.ledger.update(sid, pid=p.pid, pgid=p.pid)
        self.log("session_launched", session=sid, action=d["action"], attempt=d["attempt"], pid=p.pid)
        return rec

    def monitor(self, sid):
        while True:
            rec = next(r for r in self.reconcile() if r["session_id"] == sid)
            if rec["state"] != "RUNNING":
                return rec
            time.sleep(self.cfg.monitor_s)

    def run(self, max_sessions=None, dry_run=False, once=False):
        lock = None if dry_run else self._lock()
        try:
            return self._loop(max_sessions, dry_run, once)
        finally:
            if lock:
                lock.close()

    def _lock(self):
        fh = open(os.path.join(self.cfg.home, "supervisor.lock"), "w")
        try:
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            fh.close()
            raise Busy(f"another supervisor holds {fh.name}")
        return fh

    def _loop(self, max_sessions, dry_run, once):
        launched = ended = 0
        report = {"sessions": []}
        while True:
            running = [r for r in self.ledger.load() if r["state"] == "RUNNING"]
            if running and not (dry_run or once):
                # Ours or adopted after a restart: follow it to the end, never start a second one.
                rec, v = self._await(running[-1]["session_id"])
                ended += 1
                report["sessions"].append(rec)
                if max_sessions is not None and ended >= max_sessions:
                    return self._final(report, v)
                continue
            recs = self.reconcile(persist=not dry_run)
            v = self._observe_or_none()
            if v is None:
                if once or dry_run:
                    return self._final(report, None)
                time.sleep(self.cfg.poll_s)
                continue
            d = decide(v, recs, time.time(), self.cfg)
            self._write_decision(v, d)
            if dry_run or once:
                if d["do"] == "launch":
                    d["command"] = self.cfg.command("<new-session-uuid>", d["action"])
                    d["cwd"] = self.cfg.workspace
                report.update(view=v, decision=d)
                self.log("dry_run" if dry_run else "decision", next_action=v["next_action"], do=d["do"],
                         reason=d["reason"])
                return report
            if d["do"] == "launch":
                if max_sessions is not None and launched >= max_sessions:
                    return self._final(report, v, d)
                self.launch(d, v)
                launched += 1
                continue
            self.log(d["do"], next_action=v["next_action"], reason=d["reason"])
            time.sleep(d.get("delay", self.cfg.poll_s))

    def _await(self, sid):
        rec = self.monitor(sid)
        time.sleep(self.cfg.settle_s)
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
            self.log("observe_failed", error=str(e)[:300])
            return None

    def _final(self, report, v, d=None):
        if v is not None and d is None:
            d = decide(v, self.ledger.load(), time.time(), self.cfg)
        report.update(view=v, decision=d)
        if v is not None:
            self._write_decision(v, d)
            self.log("stopped", next_action=v["next_action"], next_do=d["do"], reason=d["reason"])
        return report

    def _write_decision(self, v, d):
        sup.write_json(os.path.join(self.cfg.home, "supervisor.json"), {"at": iso(time.time()), "view": v, "decision": d})


# ---------------------------------------------------------------- CLI

def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ["_wrap"]:   # _wrap --sup-session SID SDIR CWD -- CMD...
        i = argv.index("--")
        wrap(argv[3], argv[4], argv[i + 1:])
        return 0
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--home", help="runtime state dir (default $AI_HOME or ~/.barocss-ai)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--dry-run", action="store_true", help="observe and decide; launch and write nothing")
    r.add_argument("--once", action="store_true", help="one observe/decide step without launching")
    r.add_argument("--max-sessions", type=int, help="stop after this many sessions have ended")
    r.add_argument("--no-fetch", action="store_true")
    r.add_argument("--model", default="opus")
    r.add_argument("--permission-mode", default="auto")
    r.add_argument("--claude", default="claude", help="claude executable")
    r.add_argument("--poll", type=float, default=60)
    sub.add_parser("status")
    rl = sub.add_parser("release", help="ignore past attempts of KEY so it may launch again")
    rl.add_argument("key")
    a = ap.parse_args(argv)
    kw = {"home": a.home} if a.home else {}
    if a.cmd == "run":
        cfg = Config(model=a.model, permission_mode=a.permission_mode, claude=[a.claude], poll_s=a.poll,
                     fetch=not a.no_fetch, **kw)
        try:
            rep = Supervisor(cfg).run(max_sessions=a.max_sessions, dry_run=a.dry_run, once=a.once)
        except Busy as e:
            print(e, file=sys.stderr)
            return 2
        print(json.dumps(rep, indent=2, default=str))
        return 0
    cfg = Config(**kw)
    led = Ledger(cfg.home)
    if a.cmd == "release":
        recs = led.load()
        n = 0
        for x in recs:
            if x["key"] == a.key and not x.get("released"):
                x["released"], n = True, n + 1
        led.save(recs)
        print(f"released {n} record(s) of {a.key}")
        return 0
    try:
        with open(os.path.join(cfg.home, "supervisor.json")) as fh:
            last = json.load(fh)
    except FileNotFoundError:
        last = None
    print(json.dumps({"last": last, "records": led.load()[-10:]}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
