#!/usr/bin/env python3
"""Concurrency > 1 in the supervisor: decide_many() (pure) and the parallel loop against fake sessions.

  python3 -m unittest discover -s tools/ai-supervisor -v

Work-store items live in a JSON file ({id: "ready" | "pr" | "evaluated"}) that the fake session advances
for the item its addressed instruction names, so several fake sessions can run at once.
"""
import json, os, sys, time, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402
import supervise as sv  # noqa: E402
import work  # noqa: E402
from test_sup import snap  # noqa: E402
from test_supervise import World, background, cfg, runner, wait_for  # noqa: E402


def par_snap(states, locks=None, paths=None):
    """Legacy EXPERIMENT.yaml judged and landed (E-009), plus one work-store item per entry of states."""
    s = snap("evaluated")
    s["develop"]["work"] = {}
    for i, (eid, st) in enumerate(sorted(states.items())):
        path, br = f".ai/work/{eid}.yaml", f"ai/{eid}-x"
        c = {"id": eid, "outcome": "O2", "branch": br, "status": "evaluated" if st == "evaluated" else "ready",
             "allowed": {"paths": list((paths or {}).get(eid, [f"packages/p{i}/"]))},
             "locks": list((locks or {}).get(eid, []))}
        s["develop"]["work"][path] = c
        if st == "pr":
            s["branches"][br] = {"sha": "e" * 40, "time": "2020-01-01T00:00:00+00:00", "ahead": True, "exp": None,
                                 "files": {path: dict(c, status="done")}}
            s["prs"].append({"head": br, "number": 20 + i, "state": "OPEN", "ci": "success",
                             "mergeable": "MERGEABLE", "url": f"https://github.com/o/r/pull/{20 + i}"})
    return s


class PWorld(World):
    def __init__(self, test, items, plan=(), locks=None, paths=None):
        super().__init__(test, "plan", plan=plan)
        self.f["items"] = os.path.join(self.dir, "items")
        with open(self.f["items"], "w") as fh:
            json.dump(items, fh)
        os.environ["SUP_FAKE_ITEMS"] = self.f["items"]
        self.locks, self.paths = locks, paths
        self.max_live = 0

    def items(self):
        with open(self.f["items"]) as fh:
            return json.load(fh)

    def observe(self):
        s = par_snap(self.items(), self.locks, self.paths)
        return s, sup.derive(s)

    def psup(self, n=2, **kw):
        return self.sup(concurrency=n, **kw)

    def live(self):
        n = [r for r in self.records() if r["state"] == "RUNNING"]
        self.max_live = max(self.max_live, len(n))
        return n


def overlap(a, b):
    return sv.epoch(a["started_at"]) < sv.epoch(b["ended_at"]) and sv.epoch(b["started_at"]) < sv.epoch(a["ended_at"])


class DecideMany(unittest.TestCase):
    C = sv.Config(concurrency=2, backoff_s=100, max_attempts=3, poll_s=7)

    def plan(self, states, **kw):
        s = par_snap(states, **kw)
        st = sup.derive(s)
        return s, sv.view_of(s, st), work.schedule(work.from_snapshot(s), concurrency=2, sessions=0)

    def test_independent_items_fill_both_slots(self):
        s, v, sch = self.plan({"E-010": "ready", "E-011": "ready"})
        d = sv.decide_many(v, sch, [], time.time(), self.C)
        self.assertEqual([x["action"] for x in d["launch"]], ["EXECUTE E-010", "EXECUTE E-011"])
        self.assertEqual([x["work"] for x in d["launch"]], ["E-010", "E-011"])
        one = sv.decide_many(v, sch, [], time.time(), sv.Config(concurrency=1))
        self.assertEqual(len(one["launch"]), 1)                 # never above the slots

    def test_a_shared_lock_serializes(self):
        s, v, sch = self.plan({"E-010": "ready", "E-011": "ready"}, locks={"E-010": ["port:5173"], "E-011": ["port:5173"]})
        self.assertEqual(len(sv.decide_many(v, sch, [], time.time(), self.C)["launch"]), 1)

    def test_a_live_session_is_never_duplicated(self):
        s, v, sch = self.plan({"E-010": "ready", "E-011": "ready"})
        live = [{"session_id": "a", "key": "EXECUTE E-010", "action": "EXECUTE E-010", "work": "E-010",
                 "state": "RUNNING", "attempt": 1}]
        d = sv.decide_many(v, sch, live, time.time(), self.C)
        self.assertEqual([x["action"] for x in d["launch"]], ["EXECUTE E-011"])

    def test_a_pre_concurrency_record_still_blocks_its_item(self):
        s, v, sch = self.plan({"E-010": "ready", "E-011": "ready"})
        old = [{"session_id": "a", "key": "EXECUTE E-010@dddddddddddd", "action": "EXECUTE E-010",
                "experiment": "E-010", "state": "RUNNING", "attempt": 1}]   # no "work" field
        sch = dict(sch, launch=[{"mode": "COMPUTE", "action": "EXECUTE E-010x", "work": "E-010"}] + sch["launch"])
        d = sv.decide_many(v, sch, old, time.time(), self.C)
        self.assertNotIn("E-010", [x["work"] for x in d["launch"]])

    def test_one_strategy_session_at_a_time(self):
        s, v, sch = self.plan({"E-010": "pr", "E-011": "pr"})     # two results to judge
        d = sv.decide_many(v, sch, [], time.time(), self.C)
        self.assertEqual([x["action"] for x in d["launch"]], ["REVIEW E-010"])
        self.assertTrue(any("Strategy-mode session" in w for w in d["waits"]))
        live = [{"session_id": "p", "key": "PLAN@x", "action": "PLAN", "work": None, "state": "RUNNING", "attempt": 1}]
        s, v, sch = self.plan({"E-010": "pr", "E-011": "ready"})
        d = sv.decide_many(v, sch, live, time.time(), self.C)
        self.assertEqual([x["action"] for x in d["launch"]], ["EXECUTE E-011"])   # compute still runs

    def test_completed_execute_is_not_relaunched_when_develop_moves(self):
        s, v, sch = self.plan({"E-010": "ready", "E-011": "evaluated"})
        done = [{"session_id": "a", "key": "EXECUTE E-010", "action": "EXECUTE E-010", "work": "E-010",
                 "state": "COMPLETED", "attempt": 1, "ended_at": sv.iso(time.time() - 5)}]
        v = dict(v, develop="f" * 40)                             # something else landed meanwhile
        d = sv.decide_many(v, sch, done, time.time(), self.C)
        self.assertEqual(d["launch"], [])
        self.assertEqual([h["kind"] for h in d["holds"]], ["no_progress"])

    def test_crashed_session_is_resumed_for_its_item(self):
        s, v, sch = self.plan({"E-010": "ready", "E-011": "ready"})
        crashed = [{"session_id": "a", "key": "EXECUTE E-010", "action": "EXECUTE E-010", "work": "E-010",
                    "state": "CRASHED", "attempt": 1, "ended_at": sv.iso(time.time() - 500)}]
        sch = dict(sch, launch=[x for x in sch["launch"] if x["work"] != "E-010"],
                   waits=["WAIT_EXECUTION E-010"])                # its branch already says running
        d = sv.decide_many(v, sch, crashed, time.time(), self.C, head_of=lambda wid: "2020-01-01T00:00:00+00:00")
        self.assertEqual([(x["action"], x["attempt"]) for x in d["launch"]], [("EXECUTE E-010", 2), ("EXECUTE E-011", 1)])

    def test_product_code_merge_still_needs_a_human(self):
        s, v, sch = self.plan({"E-010": "ready"})
        sch = dict(sch, launch=[{"mode": "MERGE", "action": "MERGE #20", "work": "E-010"}])
        d = sv.decide_many(v, sch, [], time.time(), self.C, gate=lambda t: {"product_code": True, "approved": False})
        self.assertEqual((d["launch"], [h["kind"] for h in d["holds"]]), ([], ["human_approval"]))
        d = sv.decide_many(v, sch, [], time.time(), self.C, gate=lambda t: {"product_code": True, "approved": True})
        self.assertEqual([x["action"] for x in d["launch"]], ["MERGE #20"])


class ParallelLoop(unittest.TestCase):
    def test_two_items_run_side_by_side_then_reviews_one_at_a_time(self):
        w = PWorld(self, {"E-010": "ready", "E-011": "ready"},
                   plan=[{"advance": 1, "sleep": 1.2}, {"advance": 1, "sleep": 1.2},
                         {"advance": 1, "sleep": 0.4}, {"advance": 1, "sleep": 0.4}])
        t, box = background(w.psup(2))
        self.assertTrue(wait_for(lambda: len(w.live()) == 2, timeout=15))       # both EXECUTEs at once
        self.assertTrue(wait_for(lambda: w.items() == {"E-010": "evaluated", "E-011": "evaluated"}, timeout=30))
        self.assertTrue(wait_for(lambda: any(r["action"] == "PLAN" and r["state"] != "RUNNING" for r in w.records()),
                                 timeout=15))            # no open work → the Planner, which changes nothing here
        sv.request(w.home, "stopped", by="test")
        t.join(15)
        self.assertFalse(t.is_alive())
        recs = w.records()
        by = {r["action"]: r for r in recs}
        self.assertTrue(overlap(by["EXECUTE E-010"], by["EXECUTE E-011"]))
        self.assertFalse(overlap(by["REVIEW E-010"], by["REVIEW E-011"]))      # Strategy-mode: one at a time
        self.assertEqual({by[a]["transition"] for a in ("EXECUTE E-010", "EXECUTE E-011", "REVIEW E-010",
                                                         "REVIEW E-011")}, {"advanced"})
        self.assertEqual(len({r.get("slot") for r in (by["EXECUTE E-010"], by["EXECUTE E-011"])}), 2)
        self.assertEqual(len([r for r in recs if r["action"] == "PLAN"]), 1)   # no_progress: not relaunched
        self.assertLessEqual(w.max_live, 2)

    def test_conflicting_items_never_overlap(self):
        w = PWorld(self, {"E-010": "ready", "E-011": "ready"}, locks={"E-010": ["port:5173"], "E-011": ["port:5173"]},
                   plan=[{"advance": 1, "sleep": 0.6}] * 4)
        t, box = background(w.psup(2))
        self.assertTrue(wait_for(lambda: w.items() == {"E-010": "evaluated", "E-011": "evaluated"}, timeout=40))
        sv.request(w.home, "stopped", by="test")
        t.join(15)
        by = {r["action"]: r for r in w.records()}
        self.assertFalse(overlap(by["EXECUTE E-010"], by["EXECUTE E-011"]))
        self.assertLessEqual(w.max_live, 2)

    def test_stop_interrupts_every_session_and_status_lists_them(self):
        w = PWorld(self, {"E-010": "ready", "E-011": "ready"}, plan=[{"sleep": 30}, {"sleep": 30}])
        t, box = background(w.psup(2))
        self.assertTrue(wait_for(lambda: len(w.live()) == 2, timeout=15))
        self.assertTrue(wait_for(lambda: runner(w).get("activity") == "2 session(s)", timeout=10))
        st = sv.status_report(w.home)
        self.assertEqual(sorted(x["action"] for x in st["sessions"]), ["EXECUTE E-010", "EXECUTE E-011"])
        lines = []
        sv.print_report(st, out=lines.append)
        self.assertTrue(any("2 Opus sessions running" in x for x in lines), lines)
        sv.request(w.home, "stopped", by="test")
        t.join(15)
        self.assertFalse(t.is_alive())
        self.assertEqual({r["state"] for r in w.records()}, {"INTERRUPTED"})
        self.assertEqual([sv.ps_pid(r["session_id"]) for r in w.records()], [None, None])

    def test_pause_drains_all_then_resume_fills_slots(self):
        w = PWorld(self, {"E-010": "ready", "E-011": "ready"}, plan=[{"advance": 1, "sleep": 1.0}] * 2 + [{}] * 4)
        t, box = background(w.psup(2))
        self.assertTrue(wait_for(lambda: len(w.live()) == 2, timeout=15))
        sv.request(w.home, "paused", by="test")
        self.assertTrue(wait_for(lambda: runner(w).get("state") == "PAUSED", timeout=20))
        self.assertEqual([r["state"] for r in w.records()], ["COMPLETED", "COMPLETED"])   # finished, not killed
        time.sleep(0.5)
        self.assertEqual(len(w.records()), 2)                 # REVIEWs are due but nothing launches
        sv.request(w.home, "running", by="test")
        self.assertTrue(wait_for(lambda: len(w.records()) >= 3, timeout=15))
        sv.request(w.home, "stopped", by="test")
        t.join(15)
        self.assertFalse(t.is_alive())

    def test_concurrency_one_keeps_the_serial_loop(self):
        s = sv.Supervisor(sv.Config(home=os.path.join(PWorld(self, {"E-010": "ready"}).dir, "h")), out=lambda *a: None)
        self.assertEqual(s.cfg.concurrency, 1)                # default; run() takes _loop, not _loop_parallel


if __name__ == "__main__":
    unittest.main()
