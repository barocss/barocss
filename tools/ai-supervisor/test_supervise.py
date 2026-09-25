#!/usr/bin/env python3
"""Deterministic tests for the serial supervisor (V2 Phase 2).

  python3 -m unittest discover -s tools/ai-supervisor -v

Pure tests drive decide() with Phase 1 statuses from synthetic snapshots. Process tests run the real
loop, wrapper and ledger against fixtures/fake_claude.py and a file-backed "world" the fake session
changes, so crash, timeout, restart and stale-ledger paths use real processes. No network, no model.
"""
import contextlib, io, json, os, signal, subprocess, sys, tempfile, threading, time, unittest, uuid

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402
import supervise as sv  # noqa: E402
from test_sup import snap  # noqa: E402

FAKE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "fake_claude.py")
FAKE_GH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "fake_gh.py")
OLD = "2020-01-01T00:00:00+00:00"      # a push before any session in these tests ended
FUTURE = "2099-01-01T00:00:00+00:00"   # a push after it (someone else is active)

def _product(s):
    """The experiment's contract allows product code (as E-008's does)."""
    s["develop"]["exp"]["allowed"] = {"product_code": True}
    return s


WORLDS = {
    "execute": lambda: snap("ready"),
    "running": lambda: snap("ready", branch={"status": "running"}, branch_time=OLD),
    "running_ext": lambda: snap("ready", branch={"status": "running"}, branch_time=FUTURE),
    "ci": lambda: snap("ready", branch={"status": "done"}, prs=[{"ci": "pending"}]),
    "review": lambda: snap("ready", branch={"status": "done"}, prs=[{}]),
    "blocked_result": lambda: snap("ready", branch={"status": "blocked", "result": {"verdict": "INCONCLUSIVE"}},
                                   prs=[{}]),
    "merge": lambda: snap("ready", branch={"status": "evaluated", "review": {"merged": True}}, prs=[{}]),
    "plan_merge": lambda: snap("evaluated", plan_branches=["ai/strategy-E-010"],
                               prs=[{"head": "ai/strategy-E-010", "number": 7}]),
    "merge_product": lambda: _product(snap("ready", branch={"status": "evaluated", "review": {"merged": True}},
                                           prs=[{}])),
    "merge_labeled": lambda: _product(snap("ready", branch={"status": "evaluated", "review": {"merged": True}},
                                           prs=[{"labels": ["human-approved"]}])),
    "merge_approved": lambda: _product(snap("ready", branch={"status": "evaluated", "review": {"merged": True}},
                                            prs=[{"review": "APPROVED"}])),
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
                settle_s=0, backoff_s=0, kill_grace_s=1, fetch=False, tick_s=0.05, bind_review=False)
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
        for name, action in (("execute", "EXECUTE E-009"), ("review", "REVIEW E-009"), ("plan", "PLAN")):
            d = sv.decide(view(name), [], time.time(), C)
            self.assertEqual((d["do"], d["action"], d["attempt"]), ("launch", action, 1), name)

    def test_a_decided_merge_is_mechanical(self):
        # Strategy decided it (review merged: true); the supervisor executes it with gh, no Opus session.
        d = sv.decide(view("merge"), [], time.time(), C)
        self.assertEqual((d["do"], d["action"], d["pr"]["number"]), ("merge", "MERGE #5", 5))
        self.assertEqual(sv.merge_command(C, dict(d["pr"], sha="f" * 40)),
                         ["gh", "pr", "merge", "5", "--merge", "--match-head-commit", "f" * 40])

    def test_a_refused_merge_holds(self):
        v = view("merge")
        d = sv.decide(v, [rec(v["key"], "REFUSED", reason="Planner PR changes files outside .ai/: x")], time.time(), C)
        self.assertEqual((d["do"], d["kind"]), ("hold", "merge_refused"))

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

    def test_interrupted_costs_no_attempt_and_resumes(self):
        v = view("execute")
        d = sv.decide(v, [rec(v["key"], "INTERRUPTED", sid=str(i)) for i in range(5)], time.time(), C)
        self.assertEqual((d["do"], d["attempt"]), ("launch", 1))
        d = sv.decide(view("running"), [rec(v["key"], "INTERRUPTED", action="EXECUTE E-009")], time.time(), C)
        self.assertEqual((d["do"], d["action"]), ("launch", "EXECUTE E-009"))

    def test_lifecycle(self):
        self.assertEqual(sv.lifecycle("running", True), "RUNNING")
        self.assertEqual(sv.lifecycle("paused", True), "PAUSING")
        self.assertEqual(sv.lifecycle("paused", False), "PAUSED")
        self.assertEqual(sv.lifecycle("stopped", True), "STOPPED")

    def test_product_code_merge_waits_for_a_human(self):
        v = view("merge_product")
        self.assertEqual((v["product_code"], v["approved"]), (True, False))
        d = sv.decide(v, [], time.time(), C)
        self.assertEqual((d["do"], d["kind"]), ("hold", "human_approval"))
        self.assertIn("human-approved", d["reason"])
        for name in ("merge_labeled", "merge_approved"):   # label, or an approving review (a bot-authored PR)
            d = sv.decide(view(name), [], time.time(), C)
            self.assertEqual((d["do"], d["action"]), ("merge", "MERGE #5"), name)
        d = sv.decide(view("merge"), [], time.time(), C)       # evidence-only PR: no approval needed
        self.assertEqual(d["do"], "merge")
        self.assertNotIn("product_code", view("review"))       # the gate only concerns MERGE

    def test_transition(self):
        r = rec(view("execute")["key"], "COMPLETED", action="EXECUTE E-009")
        self.assertEqual(sv.transition(r, view("review")), "advanced")
        self.assertEqual(sv.transition(r, view("ci")), "advanced")
        self.assertEqual(sv.transition(r, view("execute")), "no_progress")
        self.assertEqual(sv.transition(r, view("running")), "incomplete")
        self.assertEqual(sv.transition(r, view("contradiction")), "contradiction")
        self.assertEqual(sv.transition(r, view("plan")), "unexpected")

    def test_standard_instruction_plus_observed_step(self):
        cmd = sv.Config().command("sid-1")
        self.assertEqual(cmd[cmd.index("-p") + 1], sv.STANDARD_INSTRUCTION)
        self.assertEqual(cmd[cmd.index("--model") + 1], "opus")
        self.assertTrue(sv.STANDARD_INSTRUCTION.startswith("Read AGENTS.md and follow it."))
        for action, needle in (("EXECUTE E-009", "EXECUTION (§3) of E-009 only"), ("REVIEW E-009", "review (§2A) of E-009"),
                               ("PLAN", "choose and contract"), ("MERGE #5", "PR #5")):
            cmd = sv.Config().command("sid-1", action)
            text = cmd[cmd.index("-p") + 1]
            self.assertTrue(text.startswith(sv.STANDARD_INSTRUCTION), action)
            self.assertIn(f"next step is {action}: ", text)
            self.assertIn(needle, text)
            self.assertIn("stop without changing anything", text)


class WorkAuthority(unittest.TestCase):
    """Slice 2: decide() reads the Work DAG scheduler; the V1 RULES gate it."""

    def test_view_comes_from_the_work_scheduler(self):
        for name in WORLDS:
            s = WORLDS[name]()
            st = sup.derive(s)
            v = sv.view_of(s, st)
            self.assertEqual((v["next_action"], v["v1_next_action"]), (st["work"]["next_action"], st["next_action"]))
            self.assertTrue(v["agrees_with_v1"], name)
        self.assertEqual(view("execute")["mode"], "COMPUTE")
        self.assertEqual(view("review")["mode"], "JUDGE")
        self.assertEqual(view("plan")["mode"], "PLAN")
        self.assertEqual(view("execute")["work"]["planner"]["state"], "idle")

    def test_keys_unchanged_so_existing_ledgers_still_count(self):
        self.assertEqual(view("execute")["key"].split("@")[0], "EXECUTE E-009")

    def test_disagreement_holds_instead_of_launching(self):
        s = WORLDS["execute"]()
        st = sup.derive(s)
        st["work"] = dict(st["work"], next_action="PLAN", mode="PLAN", agrees_with_v1=False)
        d = sv.decide(sv.view_of(s, st), [], time.time(), C)
        self.assertEqual((d["do"], d["kind"]), ("hold", "work_model_disagrees"))
        self.assertIn("V1 EXECUTE E-009", d["reason"])


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
        # Each world is its own repository with its own lock dir: tests never touch a real runner's lock.
        self.identity = {"id": "t" + uuid.uuid4().hex[:15], "name": "test/" + os.path.basename(self.dir)}
        self.lock_dir = os.path.join(self.dir, "locks")
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

    def overrides(self):
        return {"lock_dir": self.lock_dir, "identity": self.identity}

    def sup(self, **kw):
        kw = dict(self.overrides(), **kw)
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
        ev = [e["title"] for e in sv._tail_jsonl(os.path.join(w.home, "events.jsonl"), 50)]
        self.assertIn("started EXECUTE E-009", ev)
        self.assertIn("EXECUTE E-009 completed", ev)          # sent without anyone asking
        (r,) = rep["sessions"]
        self.assertEqual((r["state"], r["action"], r["attempt"], r["exit_code"]), ("COMPLETED", "EXECUTE E-009", 1, 0))
        self.assertEqual((r["after"]["next_action"], r["transition"]), ("REVIEW E-009", "advanced"))
        self.assertEqual(rep["decision"]["do"], "launch")          # next action derived …
        self.assertEqual(rep["decision"]["action"], "REVIEW E-009")
        (argv,) = w.launches()                                     # … but not launched
        self.assertEqual(argv[argv.index("-p") + 1], sv.instruction("EXECUTE E-009"))
        self.assertEqual(r["mode"], "COMPUTE")
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

    def test_workspace_failure_is_a_retryable_environment_failure(self):
        w = World(self, "execute", plan=[{"world": "review"}])
        s = w.sup(prepare=True, workspace=os.path.join(w.dir, "ws"))
        calls = []

        def flaky(ws=None):
            calls.append(1)
            if len(calls) == 1:
                raise subprocess.CalledProcessError(128, ["git", "clone"], stderr="fatal: network down")
            os.makedirs(s.cfg.workspace, exist_ok=True)
        s.prepare_workspace = flaky
        rep = s.run(max_sessions=1)                       # the runner survives and retries
        recs = w.records()
        self.assertEqual([(r["state"], r["attempt"]) for r in recs], [("CRASHED", 1), ("COMPLETED", 2)])
        self.assertIn("network down", recs[0]["reason"])
        self.assertEqual(rep["decision"]["action"], "REVIEW E-009")

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
        self.assertEqual(events.count("wait"), 1)   # one log line per change, not per poll

    def test_dry_run_launches_nothing_and_keeps_the_ledger(self):
        w = World(self, "execute")
        rep = w.sup().run(dry_run=True)
        d = rep["decision"]
        self.assertEqual((d["do"], d["action"]), ("launch", "EXECUTE E-009"))
        self.assertIn(sv.instruction("EXECUTE E-009"), d["command"])
        self.assertEqual((w.launches(), w.records()), ([], []))


def background(s, **kw):
    box = {}
    t = threading.Thread(target=lambda: box.update(rep=s.run(**kw)), daemon=True)
    t.start()
    return t, box


def runner(w):
    return sv.read_json(os.path.join(w.home, "runner.json")) or {}


class Notifications(unittest.TestCase):
    def events(self, w):
        return sv._tail_jsonl(os.path.join(w.home, "events.jsonl"), 100)

    def test_every_transition_is_announced_once(self):
        # EXECUTE ends → CI (announced once, though polled many times) → REVIEW → a product-code MERGE that
        # needs a human (urgent), then stop.
        w = World(self, "execute", plan=[{"world": "ci", "sleep": 0.2}, {"world": "merge_product"}],
                  script=[])
        s = w.sup()
        t, box = background(s)
        self.assertTrue(wait_for(lambda: any(e["title"] == "EXECUTE E-009 completed" for e in self.events(w))))
        self.assertTrue(wait_for(lambda: any(e["title"] == "waiting for CI" for e in self.events(w))))
        time.sleep(0.3)
        with open(w.f["world"], "w") as fh:
            fh.write("review")                              # CI finished
        self.assertTrue(wait_for(lambda: any(e["title"] == "needs you: human_approval" for e in self.events(w))))
        time.sleep(0.3)
        sv.request(w.home, "stopped", by="test")
        t.join(10)
        ev = self.events(w)
        titles = [e["title"] for e in ev]
        self.assertEqual(titles.count("waiting for CI"), 1)
        self.assertEqual(titles.count("needs you: human_approval"), 1)
        self.assertTrue(next(e for e in ev if e["title"] == "needs you: human_approval")["urgent"])
        self.assertIn("runner STOPPED", titles)
        self.assertEqual([x[x.index("-p") + 1].split("next step is ")[-1][:12] for x in w.launches()],
                         [sv.instruction("EXECUTE E-009").split("next step is ")[-1][:12],
                          sv.instruction("REVIEW E-009").split("next step is ")[-1][:12]])   # no MERGE launch
        st = sv.status_report(w.home)
        self.assertTrue(st["events"])
        lines = []
        sv.print_report(st, out=lines.append)
        self.assertTrue(any(l.startswith("event       :") for l in lines))

    def test_approval_releases_the_hold(self):
        w = World(self, "merge_product", plan=[{"world": "plan"}])
        gh_argv = os.path.join(w.dir, "gh_argv")
        os.environ.update(SUP_FAKE_GH_ARGV=gh_argv, SUP_FAKE_GH_WORLD="plan")
        self.addCleanup(lambda: [os.environ.pop(k, None) for k in ("SUP_FAKE_GH_ARGV", "SUP_FAKE_GH_WORLD")])
        s = w.sup(gh=[sys.executable, FAKE_GH])
        t, box = background(s)
        self.assertTrue(wait_for(lambda: any(e["title"] == "needs you: human_approval" for e in self.events(w))))
        time.sleep(0.3)
        self.assertEqual(w.launches(), [])
        self.assertFalse(os.path.exists(gh_argv))           # held: nothing merged
        with open(w.f["world"], "w") as fh:
            fh.write("merge_labeled")                       # the human added the label
        self.assertTrue(wait_for(lambda: os.path.exists(gh_argv)))   # the supervisor merges it, no session
        self.assertTrue(wait_for(lambda: w.records() and w.records()[0].get("state") == "COMPLETED"))
        sv.request(w.home, "stopped", by="test")
        t.join(10)
        self.assertEqual((w.records()[0]["action"], w.records()[0]["kind"]), ("MERGE #5", "merge"))
        self.assertFalse(any("next step is MERGE" in a[a.index("-p") + 1] for a in w.launches()))   # no MERGE session


class Lifecycle(unittest.TestCase):
    def live(self, w):
        return [r for r in w.records() if r["state"] == "RUNNING"]

    def test_pause_lets_the_session_finish_then_resume_continues(self):
        w = World(self, "execute", plan=[{"world": "review", "sleep": 1.0}, {"world": "plan", "sleep": 0.2}])
        t, box = background(w.sup())
        self.assertTrue(wait_for(lambda: self.live(w)))
        sv.request(w.home, "paused", by="test")
        self.assertTrue(wait_for(lambda: runner(w).get("state") == "PAUSING"))
        self.assertTrue(wait_for(lambda: runner(w).get("state") == "PAUSED"))
        (r,) = w.records()
        self.assertEqual((r["state"], r["transition"]), ("COMPLETED", "advanced"))   # finished, not killed
        time.sleep(0.5)
        self.assertEqual(len(w.launches()), 1)             # REVIEW is due, but nothing launches while paused
        self.assertIn("would launch REVIEW E-009", runner(w).get("detail", ""))
        sv.request(w.home, "running", by="test")
        # Resumed, it keeps going on its own: REVIEW, then PLAN, whose session changes nothing (plan
        # exhausted), so it holds as no_progress instead of relaunching.
        self.assertTrue(wait_for(lambda: runner(w).get("detail", "").find("no_progress") >= 0 or
                                 "did not advance" in runner(w).get("detail", "")))
        self.assertEqual([(r["action"], r["state"]) for r in w.records()],
                         [("EXECUTE E-009", "COMPLETED"), ("REVIEW E-009", "COMPLETED"), ("PLAN", "COMPLETED")])
        time.sleep(0.3)
        self.assertEqual(len(w.launches()), 3)
        sv.request(w.home, "stopped", by="test")
        t.join(10)
        self.assertFalse(t.is_alive())
        self.assertEqual((runner(w)["state"], box["rep"]["stopped"]), ("STOPPED", "stop requested"))

    def test_stop_interrupts_and_a_restart_resumes(self):
        w = World(self, "execute", plan=[{"sleep": 30, "child": True}, {"world": "review"}])
        t, box = background(w.sup())
        self.assertTrue(wait_for(lambda: self.live(w) and os.path.exists(w.f["child"])))
        sid = self.live(w)[0]["session_id"]
        sv.request(w.home, "stopped", by="test")
        t.join(10)
        self.assertFalse(t.is_alive())
        (r,) = w.records()
        self.assertEqual((r["state"], r["reason"]), ("INTERRUPTED", "stop requested"))
        self.assertIsNone(sv.ps_pid(sid))
        self.assertTrue(wait_for(lambda: not _pid_alive(w.child())))
        self.assertEqual(runner(w)["state"], "STOPPED")
        # Later: start again. start means running, whatever the last request was; no attempt was spent.
        rep = w.sup().run(max_sessions=1)
        (r2,) = rep["sessions"]
        self.assertEqual((r2["action"], r2["attempt"], r2["state"]), ("EXECUTE E-009", 1, "COMPLETED"))
        self.assertEqual(sv.read_control(w.home)["desired"], "running")

    def test_owner_exit_stops_the_run(self):
        owner = subprocess.Popen(["sleep", "60"])
        self.addCleanup(owner.kill)
        w = World(self, "execute", plan=[{"sleep": 30}])
        t, box = background(w.sup(owner=owner.pid))
        self.assertTrue(wait_for(lambda: self.live(w)))
        owner.kill()
        owner.wait()
        t.join(10)
        self.assertFalse(t.is_alive())
        (r,) = w.records()
        self.assertEqual(r["state"], "INTERRUPTED")
        self.assertIn(f"owner {owner.pid} gone", r["reason"])

    def test_session_does_not_outlive_owner_and_runner(self):
        # Both the app (owner) and the runner vanish at once: the wrapper ends the session itself.
        owner = subprocess.Popen(["sleep", "60"])
        self.addCleanup(owner.kill)
        w = World(self, "execute", plan=[{"sleep": 30}])
        a = w.sup(owner=owner.pid)
        r = a.launch(sv.decide(a.observe(), [], time.time(), a.cfg), a.observe())
        w.orphan(a)
        owner.kill()
        owner.wait()
        self.assertTrue(wait_for(lambda: sv.ps_pid(r["session_id"]) is None, timeout=15))
        rep = w.sup().run(once=True)
        (r,) = w.records()
        self.assertEqual(r["state"], "INTERRUPTED")
        self.assertEqual((rep["decision"]["do"], rep["decision"]["attempt"]), ("launch", 1))

    def test_stop_without_runner_ends_orphan_sessions(self):
        w = World(self, "execute", plan=[{"sleep": 30}])
        a = w.sup()
        r = a.launch(sv.decide(a.observe(), [], time.time(), a.cfg), a.observe())
        w.orphan(a)
        (x,) = w.sup().run_locked(lambda s: s.stop_orphans("stop requested"))
        self.assertEqual(x["state"], "INTERRUPTED")
        self.assertIsNone(sv.ps_pid(r["session_id"]))

    def test_status_while_running_and_after(self):
        w = World(self, "execute", plan=[{"world": "review", "sleep": 1.5}])
        t, box = background(w.sup(max_attempts=3))
        self.assertTrue(wait_for(lambda: self.live(w) and runner(w).get("activity") == "session"))
        st = sv.status_report(w.home)
        self.assertEqual((st["runner"]["state"], st["mode"]), ("RUNNING", "EXECUTION"))
        self.assertEqual((st["session"]["action"], st["session"]["attempt"]), ("EXECUTE E-009", 1))
        self.assertEqual((st["outcome"]["id"], st["experiment"]["id"]), ("O2", "E-009"))
        self.assertEqual(st["next"]["action"], "EXECUTE E-009")
        self.assertIsNotNone(st["runner"]["uptime_s"])
        sv.request(w.home, "paused", by="test")
        self.assertTrue(wait_for(lambda: sv.status_report(w.home)["runner"]["state"] == "PAUSED"))
        st = sv.status_report(w.home)
        self.assertIsNone(st["session"])
        self.assertEqual((st["last_result"]["action"], st["last_result"]["state"], st["last_result"]["after"]),
                         ("EXECUTE E-009", "COMPLETED", "REVIEW E-009"))
        self.assertEqual((st["next"]["action"], st["next"]["do"]), ("REVIEW E-009", "paused"))
        lines = []
        sv.print_report(st, out=lines.append)
        text = "\n".join(lines)
        for needle in ("runner      : PAUSED", "outcome     : O2", "experiment  : E-009", "last result : EXECUTE",
                       "next action : REVIEW E-009 → paused"):
            self.assertIn(needle, text)
        sv.request(w.home, "stopped", by="test")
        t.join(10)
        self.assertEqual(sv.status_report(w.home)["runner"]["state"], "STOPPED")

    def test_stop_during_observation_launches_nothing(self):
        # The stop arrives while the runner is reading GitHub, and the state says EXECUTE: no session.
        for pause_first in (False, True):
            w = World(self, "execute", plan=[{"sleep": 30}])
            calls = []

            def observe(w=w, calls=calls, pause_first=pause_first):
                calls.append(1)
                if pause_first and len(calls) == 1:
                    sv.request(w.home, "paused", by="test")
                else:
                    sv.request(w.home, "stopped", by="test")
                return w.observe()
            s = sv.Supervisor(cfg(w.home, **w.overrides()), observe=observe, out=lambda *a: None)
            rep = s.run()
            self.assertEqual(rep["stopped"], "stop requested")
            self.assertEqual((w.launches(), w.records()), ([], []), pause_first)

    def test_signal_stops_the_run(self):
        w = World(self, "execute", plan=[{"sleep": 30}])
        s = w.sup()
        t, box = background(s)
        self.assertTrue(wait_for(lambda: self.live(w)))
        s._on_signal(signal.SIGTERM, None)       # what the SIGTERM/SIGINT/SIGHUP handler does
        t.join(10)
        self.assertEqual((box["rep"]["stopped"], w.records()[0]["state"]), ("signal SIGTERM", "INTERRUPTED"))

    def test_cli_controls_without_a_runner(self):
        w = World(self, "execute", plan=[{"sleep": 30}])
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(sv.main(["--home", w.home, "pause"], overrides=w.overrides()), 1)
            self.assertEqual(sv.main(["--home", w.home, "resume"], overrides=w.overrides()), 1)
            a = w.sup()
            r = a.launch(sv.decide(a.observe(), [], time.time(), a.cfg), a.observe())
            w.orphan(a)
            self.assertEqual(sv.main(["--home", w.home, "stop", "--wait", "1"], overrides=w.overrides()), 0)
        self.assertEqual(w.records()[0]["state"], "INTERRUPTED")
        self.assertIsNone(sv.ps_pid(r["session_id"]))
        self.assertEqual(sv.read_control(w.home)["desired"], "stopped")

    def test_status_shows_ci_wait_and_blockers(self):
        w = World(self, "ci")
        w.sup().run(once=True)
        st = sv.status_report(w.home)
        self.assertEqual((st["waiting"]["on"], st["next"]["do"]), ("CI", "wait"))
        w = World(self, "human")
        w.sup().run(once=True)
        st = sv.status_report(w.home)
        self.assertTrue(any("gh token expired" in b for b in st["blockers"]))
        self.assertTrue(any(b.startswith("hold human_required") for b in st["blockers"]))


def git(*a, cwd):
    return subprocess.run(["git", *a], cwd=cwd, check=True, capture_output=True, text=True).stdout


def make_repo(root, name, url):
    d = os.path.join(root, name)
    os.makedirs(d)
    git("init", "-q", cwd=d)
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-q", "--allow-empty", "-m", "init", cwd=d)
    if url:
        git("remote", "add", "origin", url, cwd=d)
    return d


class RepoOwnership(unittest.TestCase):
    """One supervisor per repository: the lock is keyed by repository identity, not AI_HOME."""

    def setUp(self):
        self.root = tempfile.mkdtemp(prefix="sup-own-")
        self.locks = os.path.join(self.root, "locks")   # stands in for the per-user lock dir
        self.one = make_repo(self.root, "one", "https://github.com/Example/One.git")
        self.held = []
        self.addCleanup(lambda: [x.release() for x in self.held])

    def sup(self, repo, home="home"):
        return sv.Supervisor(sv.Config(home=os.path.join(self.root, home), repo_dir=repo, lock_dir=self.locks),
                             observe=lambda: None, out=lambda *a: None)

    def take(self, s):
        lock = s._lock()
        self.held.append(lock)
        return lock

    def test_canonical_remote(self):
        forms = ["https://github.com/Example/One.git", "https://user@github.com/example/one/",
                 "git@github.com:Example/One.git", "ssh://git@github.com/example/one", "git@GitHub.com:example/one"]
        self.assertEqual({sv.canonical_remote(u) for u in forms}, {"github.com/example/one"})
        self.assertNotEqual(sv.canonical_remote("git@github.com:example/two"), "github.com/example/one")

    def test_1_same_repo_same_home(self):
        self.take(self.sup(self.one))
        with self.assertRaises(sv.Busy):
            self.sup(self.one)._lock()

    def test_2_same_repo_different_ai_home(self):
        self.take(self.sup(self.one, "home-a"))
        with self.assertRaises(sv.Busy) as e:
            self.sup(self.one, "home-b")._lock()
        self.assertEqual(e.exception.owner["home"], os.path.join(self.root, "home-a"))
        self.assertEqual(e.exception.owner["pid"], os.getpid())

    def test_3_same_repo_different_worktree_or_clone(self):
        wt = os.path.join(self.root, "one-wt")
        git("worktree", "add", "-q", "--detach", wt, cwd=self.one)
        clone = make_repo(self.root, "one-clone", "git@github.com:example/one")   # same repo, ssh form
        ids = {sv.repo_identity(d)["id"] for d in (self.one, wt, clone)}
        self.assertEqual(ids, {sv.repo_identity(self.one)["id"]})
        self.take(self.sup(self.one, "home-a"))
        for d in (wt, clone):
            with self.assertRaises(sv.Busy):
                self.sup(d, "home-b")._lock()

    def test_3b_without_a_remote_worktrees_share_the_common_dir(self):
        local = make_repo(self.root, "local", None)
        wt = os.path.join(self.root, "local-wt")
        git("worktree", "add", "-q", "--detach", wt, cwd=local)
        self.assertEqual(sv.repo_identity(local), sv.repo_identity(wt))
        self.assertTrue(sv.repo_identity(local)["name"].startswith("path:"))

    def test_4_different_repos_run_concurrently(self):
        two = make_repo(self.root, "two", "https://github.com/example/two")
        self.take(self.sup(self.one, "home-a"))
        self.take(self.sup(two, "home-a"))   # even with the same AI_HOME: the boundary is the repository

    def test_5_stale_owner_record_is_recoverable(self):
        s = self.sup(self.one)
        lock = s.repo_lock()
        dead = subprocess.Popen(["true"])
        dead.wait()
        os.makedirs(self.locks, exist_ok=True)
        open(lock.path, "a").close()
        old = {"repo": "github.com/example/one", "pid": dead.pid, "token": "old", "home": "/gone"}
        sv.sup.write_json(lock.owner_path, old)
        self.assertEqual(lock.probe(), {"alive": False, "record": old})
        self.take(s)                                          # taken over; nobody had to be asked or killed
        self.assertEqual(sv.read_json(lock.owner_path)["pid"], os.getpid())

    def test_6_pid_reuse_is_not_ownership(self):
        # The recorded pid now belongs to a live, unrelated process. The lock is free, so there is no
        # owner, and nothing signals that process.
        bystander = subprocess.Popen(["sleep", "60"])
        self.addCleanup(bystander.kill)
        s = self.sup(self.one)
        lock = s.repo_lock()
        os.makedirs(self.locks, exist_ok=True)
        open(lock.path, "a").close()
        sv.sup.write_json(lock.owner_path, {"pid": bystander.pid, "token": "tok", "home": s.cfg.home})
        os.makedirs(s.cfg.home, exist_ok=True)
        sv.sup.write_json(os.path.join(s.cfg.home, "runner.json"),
                          {"state": "RUNNING", "pid": bystander.pid, "lock": lock.path, "token": "tok"})
        info = sv.runner_info(s.cfg.home)
        self.assertEqual((info["alive"], info["state"]), (False, "STOPPED"))
        with contextlib.redirect_stdout(io.StringIO()):
            self.assertEqual(sv.main(["--home", s.cfg.home, "stop", "--wait", "1"],
                                     overrides={"lock_dir": self.locks, "repo_dir": self.one}), 0)
        self.take(s)
        self.assertIsNone(bystander.poll())                   # still alive, never signalled
        # A live owner under another token (a newer run) is not this home's runner either.
        sv.sup.write_json(os.path.join(s.cfg.home, "runner.json"),
                          {"state": "RUNNING", "pid": os.getpid(), "lock": lock.path, "token": "not-it"})
        self.assertFalse(sv.runner_info(s.cfg.home)["alive"])

    def test_7_restart_after_a_crashed_owner(self):
        code = ("import sys, time; sys.path.insert(0, %r); import supervise as sv; "
                "s = sv.Supervisor(sv.Config(home=%r, repo_dir=%r, lock_dir=%r), observe=lambda: None, out=print); "
                "s._lock(); print('locked', flush=True); time.sleep(60)"
                % (os.path.dirname(os.path.abspath(sv.__file__)), os.path.join(self.root, "home-x"), self.one,
                   self.locks))
        p = subprocess.Popen([sys.executable, "-c", code], stdout=subprocess.PIPE, text=True)
        self.addCleanup(p.kill)
        self.addCleanup(p.stdout.close)
        self.assertEqual(p.stdout.readline().strip(), "locked")
        s = self.sup(self.one, "home-y")
        with self.assertRaises(sv.Busy):
            s._lock()
        self.assertTrue(s.repo_lock().probe()["alive"])
        p.kill()                                              # crash: no cleanup, no release
        p.wait()
        self.assertFalse(s.repo_lock().probe()["alive"])      # the kernel dropped the flock
        self.take(s)

    def test_session_of_another_home_blocks_start(self):
        # Runner A (home a) died but its session lives on; runner B (home b) can't see it in its ledger.
        w = World(self, "execute", plan=[{"sleep": 30}])
        a = w.sup()
        r = a.launch(sv.decide(a.observe(), [], time.time(), a.cfg), a.observe())
        w.orphan(a)
        b = sv.Supervisor(cfg(os.path.join(w.dir, "home-b"), **w.overrides()), observe=w.observe,
                          out=lambda *x: None)
        with self.assertRaises(sv.Busy) as e:
            b.run(max_sessions=1)
        self.assertIn(r["session_id"][:8], str(e.exception))
        self.assertTrue(wait_for(lambda: len(w.launches()) == 1))
        time.sleep(0.3)
        self.assertEqual(len(w.launches()), 1)                # b launched nothing
        # `stop` typed in home b finds it and ends it, by its token.
        with contextlib.redirect_stdout(io.StringIO()):
            sv.main(["--home", b.cfg.home, "stop", "--wait", "1"], overrides=w.overrides())
        self.assertIsNone(sv.ps_pid(r["session_id"]))

    def test_controls_reach_the_owner_from_another_home(self):
        w = World(self, "execute", plan=[{"sleep": 30}])
        t, box = background(w.sup())
        self.assertTrue(wait_for(lambda: [r for r in w.records() if r["state"] == "RUNNING"]))
        other = os.path.join(w.dir, "elsewhere")
        with contextlib.redirect_stdout(io.StringIO()) as out:
            self.assertEqual(sv.main(["--home", other, "status"], overrides=w.overrides()), 0)
            self.assertIn("runner      : RUNNING", out.getvalue())
            self.assertIn("held by pid", out.getvalue())
            self.assertEqual(sv.main(["--home", other, "stop", "--wait", "10"], overrides=w.overrides()), 0)
        t.join(10)
        self.assertFalse(t.is_alive())
        self.assertEqual(w.records()[0]["state"], "INTERRUPTED")


class MechanicalMerge(unittest.TestCase):
    """Real loop, ledger and a fake `gh`: a decided merge runs as `gh pr merge`, never as an Opus session."""

    def world(self, start, **env):
        w = World(self, start, plan=[])
        self.gh_argv = os.path.join(w.dir, "gh_argv")
        env = dict({"SUP_FAKE_GH_ARGV": self.gh_argv}, **env)
        keys = ("SUP_FAKE_GH_WORLD", "SUP_FAKE_GH_EXIT", "SUP_FAKE_GH_FILES", "SUP_FAKE_GH_STATE_FILE",
                "SUP_FAKE_GH_HEAD", "SUP_FAKE_GH_ARGV")
        for k in keys:
            os.environ.pop(k, None)
        os.environ.update(env)
        self.addCleanup(lambda: [os.environ.pop(k, None) for k in keys])
        return w

    def gh_calls(self):
        if not os.path.exists(self.gh_argv):
            return []
        with open(self.gh_argv) as fh:
            return [json.loads(line) for line in fh]

    def test_experiment_merge_runs_gh_not_a_session(self):
        w = self.world("merge", SUP_FAKE_GH_WORLD="plan")
        rep = w.sup(gh=[sys.executable, FAKE_GH]).run(max_sessions=1)
        (r,) = rep["sessions"]
        self.assertEqual((r["kind"], r["state"], r["action"]), ("merge", "COMPLETED", "MERGE #5"))
        self.assertEqual(self.gh_calls(), [["pr", "merge", "5", "--merge"]])
        self.assertEqual(w.launches(), [])                  # no Opus session
        self.assertEqual(r["after"]["next_action"], "PLAN")

    def test_a_branch_behind_develop_is_updated_first(self):
        state = os.path.join(tempfile.mkdtemp(), "state")
        with open(state, "w") as fh:
            fh.write("BEHIND")
        w = self.world("merge", SUP_FAKE_GH_WORLD="plan", SUP_FAKE_GH_STATE_FILE=state)
        rep = w.sup(gh=[sys.executable, FAKE_GH]).run(max_sessions=2)
        self.assertEqual([r["state"] for r in rep["sessions"]], ["UPDATED", "COMPLETED"])
        self.assertEqual([c[:2] for c in self.gh_calls()], [["pr", "update-branch"], ["pr", "merge"]])

    def test_a_moved_head_is_not_merged(self):
        w = self.world("merge", SUP_FAKE_GH_HEAD="a" * 40)
        s = w.sup(gh=[sys.executable, FAKE_GH])
        d = {"do": "merge", "key": "MERGE #5@x", "action": "MERGE #5", "attempt": 1,
             "pr": {"number": 5, "sha": "f" * 40, "head": "ai/E-009-x", "plan": False}}
        r = s.merge(d, s.observe())
        self.assertEqual((r["state"], self.gh_calls()), ("UPDATED", []))

    def test_merge_failures_retry_then_exhaust(self):
        w = self.world("merge", SUP_FAKE_GH_EXIT="1")
        rep = w.sup(gh=[sys.executable, FAKE_GH]).run(max_sessions=3)
        self.assertEqual([r["state"] for r in rep["sessions"]], ["CRASHED"] * 3)
        self.assertEqual((rep["decision"]["do"], rep["decision"]["kind"]), ("hold", "retry_exhausted"))

    def test_planner_pr_outside_ai_is_refused(self):
        w = self.world("plan_merge", SUP_FAKE_GH_FILES='[".ai/STATE.yaml", "packages/barocss/src/x.ts"]')
        rep = w.sup(gh=[sys.executable, FAKE_GH]).run(max_sessions=1)
        (r,) = rep["sessions"]
        self.assertEqual(r["state"], "REFUSED")
        self.assertIn("packages/barocss/src/x.ts", r["reason"])
        self.assertFalse(any(c[:2] == ["pr", "merge"] for c in self.gh_calls()))
        self.assertEqual((rep["decision"]["do"], rep["decision"]["kind"]), ("hold", "merge_refused"))

    def test_planner_pr_inside_ai_merges(self):
        w = self.world("plan_merge", SUP_FAKE_GH_WORLD="execute")
        rep = w.sup(gh=[sys.executable, FAKE_GH]).run(max_sessions=1)
        self.assertEqual(rep["sessions"][0]["state"], "COMPLETED")
        self.assertEqual(self.gh_calls()[-1][:3], ["pr", "merge", "7"])


class ReviewedHead(unittest.TestCase):
    """A decided merge binds to the reviewed diff: only clean develop merges may follow the review commit."""

    def setUp(self):
        self.r = tempfile.mkdtemp(prefix="sup-rev-")
        self.g("init", "-q", "-b", "develop")
        self.commit("base", "a.txt", "1")
        self.g("checkout", "-q", "-b", "ai/E-9")
        self.commit("ai(exec): E-9 result", "b.txt", "exec")
        self.commit("ai(strategy): review E-9 PROVEN", ".ai/x.yaml", "review")
        self.reviewed = self.head()

    def g(self, *a):
        return subprocess.run(["git", "-C", self.r, "-c", "user.email=t@t", "-c", "user.name=t", *a],
                              check=True, capture_output=True, text=True).stdout.strip()

    def commit(self, msg, path, text):
        with open(os.path.join(self.r, path.replace("/", "_")), "w") as fh:
            fh.write(text)
        self.g("add", "-A")
        self.g("commit", "-q", "-m", msg)

    def head(self):
        return self.g("rev-parse", "HEAD")

    def develop_moves(self):
        self.g("checkout", "-q", "develop")
        self.commit("other PR landed", "c.txt", "dev")
        self.g("checkout", "-q", "ai/E-9")

    def check(self):
        return sv.reviewed_head(self.r, self.head(), develop="develop")

    def test_the_reviewed_head_itself(self):
        self.assertEqual(self.check()[0], True)

    def test_a_clean_develop_merge_after_review(self):
        self.develop_moves()
        self.g("merge", "-q", "--no-edit", "develop")      # what gh pr update-branch makes
        ok, why = self.check()
        self.assertTrue(ok, why)
        self.assertIn("1 develop merge", why)

    def test_a_commit_pushed_after_the_review(self):
        self.commit("sneaky change", "b.txt", "changed after review")
        ok, why = self.check()
        self.assertFalse(ok)
        self.assertIn("head_changed_after_review", why)

    def test_a_develop_merge_with_extra_changes(self):
        self.develop_moves()
        self.g("merge", "-q", "--no-commit", "develop")
        with open(os.path.join(self.r, "b.txt"), "w") as fh:
            fh.write("smuggled into the merge")
        self.g("add", "-A")
        self.g("commit", "-q", "-m", "Merge branch 'develop'")
        ok, why = self.check()
        self.assertFalse(ok)
        self.assertIn("changes of its own", why)

    def test_a_merge_of_something_not_on_develop(self):
        self.g("checkout", "-q", "-b", "elsewhere", "develop")
        self.commit("unreviewed work", "d.txt", "x")
        self.g("checkout", "-q", "ai/E-9")
        self.g("merge", "-q", "--no-edit", "elsewhere")
        ok, why = self.check()
        self.assertFalse(ok)
        self.assertIn("not on develop", why)

    def test_no_review_commit(self):
        self.g("checkout", "-q", "develop")
        ok, why = self.check()
        self.assertFalse(ok)

    def test_merge_refuses_an_unreviewed_head(self):
        w = World(self, "merge", plan=[])
        gh_argv = os.path.join(w.dir, "gh_argv")
        os.environ["SUP_FAKE_GH_ARGV"] = gh_argv
        self.addCleanup(lambda: os.environ.pop("SUP_FAKE_GH_ARGV", None))
        self.commit("sneaky change", "b.txt", "changed after review")
        s = w.sup(gh=[sys.executable, FAKE_GH], bind_review=True, repo_dir=self.r)
        d = {"do": "merge", "key": "MERGE #5@x", "action": "MERGE #5", "attempt": 1,
             "pr": {"number": 5, "sha": self.head(), "head": "ai/E-9", "plan": False}}
        r = s.merge(d, s.observe())
        self.assertEqual(r["state"], "REFUSED")
        self.assertIn("head_changed_after_review", r["reason"])
        self.assertFalse(os.path.exists(gh_argv))           # gh pr merge never ran
        v = view("merge")
        dd = sv.decide(v, [dict(r, key=v["key"])], time.time(), C)
        self.assertEqual((dd["do"], dd["kind"]), ("hold", "merge_refused"))


def _pid_alive(pid):
    r = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)], capture_output=True, text=True)
    return r.returncode == 0 and not r.stdout.strip().startswith("Z")


if __name__ == "__main__":
    unittest.main()
