#!/usr/bin/env python3
"""Deterministic tests for the serial supervisor (V2 Phase 2).

  python3 -m unittest discover -s tools/ai-supervisor -v

Pure tests drive decide() with Phase 1 statuses from synthetic snapshots. Process tests run the real
loop, wrapper and ledger against fixtures/fake_claude.py and a file-backed "world" the fake session
changes, so crash, timeout, restart and stale-ledger paths use real processes. No network, no model.
"""
import json, os, signal, subprocess, sys, tempfile, time, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402
import supervise as sv  # noqa: E402
from test_sup import snap  # noqa: E402

FAKE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "fake_claude.py")
OLD = "2020-01-01T00:00:00+00:00"      # a push before any session in these tests ended
FUTURE = "2099-01-01T00:00:00+00:00"   # a push after it (someone else is active)

WORLDS = {
    "execute": lambda: snap("ready"),
    "running": lambda: snap("ready", branch={"status": "running"}, branch_time=OLD),
    "running_ext": lambda: snap("ready", branch={"status": "running"}, branch_time=FUTURE),
    "ci": lambda: snap("ready", branch={"status": "done"}, prs=[{"ci": "pending"}]),
    "review": lambda: snap("ready", branch={"status": "done"}, prs=[{}]),
    "blocked_result": lambda: snap("ready", branch={"status": "blocked", "result": {"verdict": "INCONCLUSIVE"}},
                                   prs=[{}]),
    "merge": lambda: snap("ready", branch={"status": "evaluated", "review": {"merged": True}}, prs=[{}]),
    "plan": lambda: snap("evaluated"),
    "plan_branch": lambda: snap("evaluated", plan_branches=["ai/strategy-E-010"]),
    "human": lambda: snap("evaluated", blockers=["gh token expired"]),
    "red": lambda: snap("evaluated", plan_branches=["ai/strategy-E-010"],
                        prs=[{"head": "ai/strategy-E-010", "number": 7, "ci": "failure"}]),
    "contradiction": lambda: snap("done"),
}


def view(name, **kw):
    s = WORLDS[name]()
    for k, v in kw.items():
        if k == "head_time":
            for b in s["branches"].values():
                b["time"] = v
    return sv.view_of(s, sup.derive(s))


def cfg(home, **kw):
    base = dict(home=home, claude=[sys.executable, FAKE], prepare=False, poll_s=0.01, monitor_s=0.05,
                settle_s=0, backoff_s=0, kill_grace_s=1, fetch=False)
    base.update(kw)
    return sv.Config(**base)


def rec(key, state, action=None, ended=None, **kw):
    r = {"session_id": kw.pop("sid", "s-" + state + key), "key": key, "action": action or key.split("@")[0],
         "state": state, "attempt": 1, "ended_at": ended or sv.iso(time.time() - 5)}
    r.update(kw)
    return r


C = sv.Config(backoff_s=100, max_attempts=3, poll_s=7, stale_min=180)


class Decide(unittest.TestCase):
    def test_semantic_actions_launch_one_fresh_session(self):
        for name, action in (("execute", "EXECUTE E-009"), ("review", "REVIEW E-009"), ("plan", "PLAN"),
                             ("merge", "MERGE #5")):
            d = sv.decide(view(name), [], time.time(), C)
            self.assertEqual((d["do"], d["action"], d["attempt"]), ("launch", action, 1), name)

    def test_live_session_blocks_every_launch(self):
        live = [rec("EXECUTE E-009@dddd", "RUNNING", ended=None)]
        for name in WORLDS:
            self.assertEqual(sv.decide(view(name), live, time.time(), C)["do"], "monitor", name)

    def test_ci_is_a_deterministic_wait(self):
        d = sv.decide(view("ci"), [], time.time(), C)
        self.assertEqual((d["do"], d["delay"]), ("wait", 7))

    def test_process_failure_retries_after_backoff_then_exhausts(self):
        v = view("execute")
        now = time.time()
        one = [rec(v["key"], "CRASHED", ended=sv.iso(now - 10))]
        self.assertEqual(sv.decide(v, one, now, C)["do"], "wait")              # backoff 100 s × 1
        d = sv.decide(v, one, now + 200, C)
        self.assertEqual((d["do"], d["attempt"]), ("launch", 2))
        three = one + [rec(v["key"], "TIMED_OUT", sid="b"), rec(v["key"], "CRASHED", sid="c")]
        d = sv.decide(v, three, now + 10_000, C)
        self.assertEqual((d["do"], d["kind"]), ("hold", "retry_exhausted"))

    def test_clean_exit_without_progress_is_not_retried(self):
        v = view("review")
        d = sv.decide(v, [rec(v["key"], "COMPLETED")], time.time(), C)
        self.assertEqual((d["do"], d["kind"]), ("hold", "no_progress"))

    def test_attempts_are_per_action_key(self):
        # A failed EXECUTE does not count against the REVIEW that follows it.
        ex = view("execute")
        d = sv.decide(view("review"), [rec(ex["key"], "CRASHED")] * 3, time.time(), C)
        self.assertEqual((d["do"], d["attempt"]), ("launch", 1))

    def test_inflight_after_our_crash_resumes_the_original_action(self):
        ex = view("execute")
        d = sv.decide(view("running"), [rec(ex["key"], "CRASHED", action="EXECUTE E-009")], time.time() + 999, C)
        self.assertEqual((d["do"], d["key"], d["action"], d["attempt"]), ("launch", ex["key"], "EXECUTE E-009", 2))

    def test_inflight_after_our_clean_exit_holds(self):
        ex = view("execute")
        d = sv.decide(view("running"), [rec(ex["key"], "COMPLETED", action="EXECUTE E-009")], time.time(), C)
        self.assertEqual((d["do"], d["kind"]), ("hold", "incomplete"))

    def test_inflight_pushed_by_someone_else_waits_then_flags_quiet(self):
        ex = view("execute")
        d = sv.decide(view("running_ext"), [rec(ex["key"], "CRASHED")], time.time(), C)
        self.assertEqual(d["do"], "wait")
        d = sv.decide(view("running"), [], time.time(), C)   # no record of ours, last push years ago
        self.assertEqual((d["do"], d["kind"]), ("hold", "inflight_quiet"))

    def test_wait_plan_after_crashed_strategy_resumes(self):
        p = view("plan")
        d = sv.decide(view("plan_branch", head_time=OLD), [rec(p["key"], "CRASHED", action="PLAN")], time.time() + 999, C)
        self.assertEqual((d["do"], d["action"]), ("launch", "PLAN"))

    def test_hold_states_never_launch(self):
        for name, kind in (("human", "human_required"), ("red", "blocked"), ("contradiction", "human_required")):
            d = sv.decide(view(name), [], time.time(), C)
            self.assertEqual((d["do"], d["kind"]), ("hold", kind), name)

    def test_release_rearms_an_exhausted_key(self):
        v = view("execute")
        recs = [rec(v["key"], "CRASHED", sid=str(i), released=True) for i in range(3)]
        self.assertEqual(sv.decide(v, recs, time.time(), C)["do"], "launch")

    def test_transition(self):
        r = rec(view("execute")["key"], "COMPLETED", action="EXECUTE E-009")
        self.assertEqual(sv.transition(r, view("review")), "advanced")
        self.assertEqual(sv.transition(r, view("ci")), "advanced")
        self.assertEqual(sv.transition(r, view("execute")), "no_progress")
        self.assertEqual(sv.transition(r, view("running")), "incomplete")
        self.assertEqual(sv.transition(r, view("contradiction")), "contradiction")
        self.assertEqual(sv.transition(r, view("plan")), "unexpected")

    def test_standard_instruction_only(self):
        cmd = sv.Config().command("sid-1")
        self.assertEqual(cmd[cmd.index("-p") + 1], sv.STANDARD_INSTRUCTION)
        self.assertEqual(cmd[cmd.index("--model") + 1], "opus")
        self.assertTrue(sv.STANDARD_INSTRUCTION.startswith("Read AGENTS.md and follow it."))


class World:
    """File-backed durable state plus the fake session's plan, in a temp dir."""

    def __init__(self, test, start, plan=(), script=()):
        self.dir = tempfile.mkdtemp(prefix="sup-test-")
        test.addCleanup(self.cleanup)
        self.home = os.path.join(self.dir, "home")
        self.f = {k: os.path.join(self.dir, k) for k in ("world", "plan", "argv", "child")}
        with open(self.f["world"], "w") as fh:
            fh.write(start)
        with open(self.f["plan"], "w") as fh:
            json.dump(list(plan), fh)
        self.script = list(script)   # names observed before falling back to the world file
        self.observed = []
        self.handles = []
        os.environ.update(SUP_FAKE_WORLD=self.f["world"], SUP_FAKE_PLAN=self.f["plan"],
                          SUP_FAKE_ARGV=self.f["argv"], SUP_FAKE_CHILD=self.f["child"])

    def observe(self):
        if self.script:
            name = self.script.pop(0)
        else:
            with open(self.f["world"]) as fh:
                name = fh.read().strip()
        self.observed.append(name)
        s = WORLDS[name]()
        return s, sup.derive(s)

    def sup(self, **kw):
        return sv.Supervisor(cfg(self.home, **kw), observe=self.observe, out=lambda *a: None)

    def launches(self):
        if not os.path.exists(self.f["argv"]):
            return []
        with open(self.f["argv"]) as fh:
            return [json.loads(line) for line in fh]

    def orphan(self, s):
        """Forget a supervisor's process handles, as if it died (the test still reaps them at cleanup)."""
        self.handles.extend(s.procs.values())
        s.procs.clear()

    def child(self):
        with open(self.f["child"]) as fh:
            return int(fh.read())

    def records(self):
        return sv.Ledger(self.home).load()

    def cleanup(self):
        for r in self.records():
            pid = sv.ps_pid(r["session_id"])
            if pid:
                os.killpg(pid, signal.SIGKILL)
        for p in self.handles:
            p.wait()


def wait_for(pred, timeout=10):
    t = time.time()
    while time.time() - t < timeout:
        if pred():
            return True
        time.sleep(0.02)
    return False


class Process(unittest.TestCase):
    def test_normal_completion(self):
        w = World(self, "execute", plan=[{"world": "review", "sleep": 0.2}])
        rep = w.sup().run(max_sessions=1)
        (r,) = rep["sessions"]
        self.assertEqual((r["state"], r["action"], r["attempt"], r["exit_code"]), ("COMPLETED", "EXECUTE E-009", 1, 0))
        self.assertEqual((r["after"]["next_action"], r["transition"]), ("REVIEW E-009", "advanced"))
        self.assertEqual(rep["decision"]["do"], "launch")          # next action derived …
        self.assertEqual(rep["decision"]["action"], "REVIEW E-009")
        (argv,) = w.launches()                                     # … but not launched
        self.assertEqual(argv[argv.index("-p") + 1], sv.STANDARD_INSTRUCTION)
        self.assertEqual(argv[argv.index("--session-id") + 1], r["session_id"])
        self.assertTrue(os.path.getsize(os.path.join(r["dir"], "log.jsonl")) > 0)

    def test_serial_loop_runs_one_session_at_a_time(self):
        w = World(self, "execute", plan=[{"world": "review", "sleep": 0.3}, {"world": "plan", "sleep": 0.3}])
        rep = w.sup().run(max_sessions=2)
        a, b = rep["sessions"]
        self.assertEqual([a["action"], b["action"]], ["EXECUTE E-009", "REVIEW E-009"])
        self.assertLessEqual(sv.epoch(a["ended_at"]), sv.epoch(b["started_at"]))
        self.assertEqual(len({x[x.index("--session-id") + 1] for x in w.launches()}), 2)   # fresh context each

    def test_duplicate_launch_prevented(self):
        w = World(self, "execute", plan=[{"sleep": 5}])
        a = w.sup()
        lock = a._lock()
        a.launch(sv.decide(a.observe(), [], time.time(), a.cfg), a.observe())
        b = w.sup()
        with self.assertRaises(sv.Busy):     # a second supervisor can't start while one runs
            b.run(max_sessions=1)
        lock.close()
        w.orphan(a)                          # the first supervisor dies; its session lives on
        for _ in range(3):                   # the state still says EXECUTE, yet nothing launches
            self.assertEqual(b.run(once=True)["decision"]["do"], "monitor")
        self.assertEqual(len(w.launches()), 1)

    def test_crash_retries_then_exhausts(self):
        w = World(self, "execute", plan=[{"exit": 1}] * 3)
        rep = w.sup().run(max_sessions=3)
        self.assertEqual([r["state"] for r in rep["sessions"]], ["CRASHED"] * 3)
        self.assertEqual([r["attempt"] for r in rep["sessions"]], [1, 2, 3])
        self.assertEqual((rep["decision"]["do"], rep["decision"]["kind"]), ("hold", "retry_exhausted"))
        rep = w.sup().run(once=True)        # a restart doesn't reset the budget
        self.assertEqual(rep["decision"]["kind"], "retry_exhausted")
        self.assertEqual(len(w.launches()), 3)

    def test_crash_after_progress_moves_on(self):
        w = World(self, "execute", plan=[{"world": "review", "exit": 1}])
        rep = w.sup().run(max_sessions=1)
        self.assertEqual(rep["sessions"][0]["state"], "CRASHED")
        self.assertEqual((rep["decision"]["action"], rep["decision"]["attempt"]), ("REVIEW E-009", 1))

    def test_api_error_is_a_process_failure(self):
        w = World(self, "execute", plan=[{"result": "error"}])
        rep = w.sup().run(max_sessions=1)
        self.assertIn("api_status=529", rep["sessions"][0]["reason"])
        self.assertEqual((rep["decision"]["do"], rep["decision"]["attempt"]), ("launch", 2))

    def test_timeout_kills_the_process_group(self):
        w = World(self, "execute", plan=[{"sleep": 30, "child": True}])
        # 3 s, not 1: under load a shorter timeout can fire before the fake has spawned the grandchild.
        rep = w.sup(timeout_s={"EXECUTE": 3.0}).run(max_sessions=1)
        r = rep["sessions"][0]
        self.assertEqual(r["state"], "TIMED_OUT")
        self.assertIn("timeout", r["reason"])
        self.assertIsNone(sv.ps_pid(r["session_id"]))
        child = w.child()
        self.assertTrue(wait_for(lambda: not _pid_alive(child)))
        self.assertEqual((rep["decision"]["do"], rep["decision"]["attempt"]), ("launch", 2))

    def test_idle_timeout(self):
        w = World(self, "execute", plan=[{"silent": 30}])
        rep = w.sup(idle_timeout_s=0.8).run(max_sessions=1)
        self.assertEqual(rep["sessions"][0]["state"], "TIMED_OUT")
        self.assertIn("no output", rep["sessions"][0]["reason"])

    def test_stray_children_are_cleaned_up_after_exit(self):
        w = World(self, "execute", plan=[{"world": "review", "child": True}])
        w.sup().run(max_sessions=1)
        child = w.child()
        self.assertTrue(wait_for(lambda: not _pid_alive(child)))

    def test_semantic_failure_is_not_retried(self):
        # The experiment ends blocked / INCONCLUSIVE: that is a result, so the next step is REVIEW.
        w = World(self, "execute", plan=[{"world": "blocked_result"}])
        rep = w.sup().run(max_sessions=1)
        self.assertEqual((rep["sessions"][0]["state"], rep["decision"]["action"]), ("COMPLETED", "REVIEW E-009"))
        # A clean exit that changed nothing: hold, don't relaunch.
        w = World(self, "review", plan=[{}])
        rep = w.sup().run(max_sessions=1)
        self.assertEqual(rep["sessions"][0]["transition"], "no_progress")
        self.assertEqual((rep["decision"]["do"], rep["decision"]["kind"]), ("hold", "no_progress"))
        self.assertEqual(len(w.launches()), 1)

    def test_restart_adopts_a_live_session(self):
        w = World(self, "execute", plan=[{"world": "review", "sleep": 1.0}])
        a = w.sup()
        a.launch(sv.decide(a.observe(), [], time.time(), a.cfg), a.observe())
        w.orphan(a)                          # supervisor gone; only the ledger and the process remain
        rep = w.sup().run(max_sessions=1)
        (r,) = rep["sessions"]
        self.assertEqual((r["state"], r["transition"]), ("COMPLETED", "advanced"))
        self.assertEqual(len(w.launches()), 1)

    def test_restart_after_session_ended_while_stopped(self):
        w = World(self, "execute", plan=[{"world": "review"}])
        a = w.sup()
        r = a.launch(sv.decide(a.observe(), [], time.time(), a.cfg), a.observe())
        w.orphan(a)
        self.assertTrue(wait_for(lambda: os.path.exists(os.path.join(r["dir"], "exit.json"))))
        rep = w.sup().run(max_sessions=1)
        self.assertEqual((rep["sessions"][0]["state"], rep["sessions"][0]["exit_code"]), ("COMPLETED", 0))
        self.assertEqual(rep["decision"]["action"], "REVIEW E-009")

    def test_stale_ledger(self):
        # RUNNING record whose pid now belongs to an unrelated live process (this test runner).
        w = World(self, "execute")
        key = view("execute")["key"]
        stale = rec(key, "RUNNING", action="EXECUTE E-009", ended=None, sid="stale-1", pid=os.getpid(),
                    pgid=os.getpid(), started_at=sv.iso(time.time() - 60), timeout_s=3600, idle_timeout_s=3600)
        sv.Ledger(w.home).save([stale])
        os.makedirs(sv.session_dir(cfg(w.home), "stale-1"))
        rep = w.sup().run(once=True)
        (r,) = w.records()
        self.assertEqual(r["state"], "CRASHED")
        self.assertIn("without an exit record", r["reason"])
        self.assertEqual((rep["decision"]["do"], rep["decision"]["attempt"]), ("launch", 2))

    def test_repository_changed_while_stopped(self):
        # The ledger remembers an EXECUTE that never reported back; meanwhile someone finished it.
        w = World(self, "review")
        key = view("execute")["key"]
        stale = rec(key, "RUNNING", action="EXECUTE E-009", ended=None, sid="gone-1", pid=None, pgid=None,
                    started_at=sv.iso(time.time() - 60), timeout_s=3600, idle_timeout_s=3600)
        sv.Ledger(w.home).save([stale])
        os.makedirs(sv.session_dir(cfg(w.home), "gone-1"))
        rep = w.sup().run(once=True)
        self.assertEqual((rep["decision"]["action"], rep["decision"]["attempt"]), ("REVIEW E-009", 1))
        # A completed REVIEW, then a human planned and merged the next contract by hand.
        w = World(self, "plan")
        sv.Ledger(w.home).save([rec(view("review")["key"], "COMPLETED", action="REVIEW E-009")])
        self.assertEqual(w.sup().run(once=True)["decision"]["action"], "PLAN")

    def test_ci_waiting(self):
        w = World(self, "review", plan=[{"world": "plan"}], script=["ci", "ci", "ci"])
        rep = w.sup().run(max_sessions=1)
        self.assertEqual(w.observed[:4], ["ci", "ci", "ci", "review"])
        self.assertEqual(rep["sessions"][0]["action"], "REVIEW E-009")
        self.assertEqual(len(w.launches()), 1)
        with open(os.path.join(w.home, "supervisor.log")) as fh:
            events = [json.loads(line)["event"] for line in fh]
        self.assertEqual(events.count("wait"), 3)

    def test_dry_run_launches_nothing_and_keeps_the_ledger(self):
        w = World(self, "execute")
        rep = w.sup().run(dry_run=True)
        d = rep["decision"]
        self.assertEqual((d["do"], d["action"]), ("launch", "EXECUTE E-009"))
        self.assertIn(sv.STANDARD_INSTRUCTION, d["command"])
        self.assertEqual((w.launches(), w.records()), ([], []))


def _pid_alive(pid):
    r = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)], capture_output=True, text=True)
    return r.returncode == 0 and not r.stdout.strip().startswith("Z")


if __name__ == "__main__":
    unittest.main()
