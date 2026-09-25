#!/usr/bin/env python3
"""Deterministic tests for the Work DAG scheduler (migration slice 1).

  python3 -m unittest discover -s tools/ai-supervisor -v

1. V1 equivalence: over an exhaustive grid of V1 states, schedule() at concurrency 1 picks exactly
   what sup.RULES picks. (The replay in test_sup checks the same on recorded history.)
2. DAG semantics on synthetic multi-item views: dependencies, cycles, conflicts, slots, planner wake.
"""
import copy, itertools, os, random, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402
import work  # noqa: E402
from test_sup import snap  # noqa: E402

RUNNING, JUDGE, MERGING, DONE = work.RUNNING, work.JUDGE, work.MERGING, work.DONE


class V1Equivalence(unittest.TestCase):
    BRANCH = [None, {"status": "ready"}, {"status": "running"}, {"status": "done"}, {"status": "blocked"},
              {"status": "evaluated", "review": {"merged": True}},
              {"status": "evaluated", "review": {"merged": False}},
              {"status": "evaluated", "review": {}}, {"status": "none"}, {"status": "running", "id": "E-001"}]
    PRS = [[], [{"ci": "pending"}], [{"ci": "none"}], [{"ci": "success"}], [{"ci": "failure"}],
           [{"mergeable": "CONFLICTING"}], [{"state": "CLOSED"}], [{"state": "MERGED"}],
           [{"number": 5}, {"number": 6}], [{"state": "CLOSED", "number": 4}, {"number": 5, "ci": "pending"}]]
    PLAN = [((), ()), (("ai/strategy-E-010",), ()),
            (("ai/strategy-E-010",), ({"head": "ai/strategy-E-010", "number": 7, "ci": "pending"},)),
            (("ai/strategy-E-010",), ({"head": "ai/strategy-E-010", "number": 7},)),
            (("ai/strategy-E-010",), ({"head": "ai/strategy-E-010", "number": 7, "ci": "failure"},)),
            (("ai/strategy-E-010",), ({"head": "ai/strategy-E-010", "number": 7, "state": "CLOSED"},))]

    def test_grid_matches_v1_rules(self):
        n = 0
        for dev, br, prs, (pb, pp), blk in itertools.product(
                ["none", "ready", "running", "done", "evaluated", "missing"], self.BRANCH, self.PRS, self.PLAN,
                [(), ("need a token",)]):
            s = snap("ready" if dev == "missing" else dev, branch=br, prs=list(prs) + list(pp),
                     plan_branches=pb, blockers=blk, dev_exp=dev != "missing")
            st = sup.derive(s)
            w = work.schedule(work.from_snapshot(s))
            self.assertEqual(w["next_action"], st["next_action"], (dev, br, prs, pb, pp, blk, st["rule"]))
            self.assertTrue(st["work"]["agrees_with_v1"])
            n += 1
        self.assertGreater(n, 7000)

    def test_mode_names(self):
        self.assertEqual(work.schedule(work.from_snapshot(snap("ready")))["mode"], "COMPUTE")
        self.assertEqual(work.schedule(work.from_snapshot(snap("ready", branch={"status": "done"},
                                                                prs=[{}])))["mode"], "JUDGE")
        self.assertEqual(work.schedule(work.from_snapshot(snap("evaluated")))["mode"], "PLAN")

    def test_v1_items_always_conflict(self):
        # Both write the shared .ai/EXPERIMENT.yaml slot: V1 is serial by construction, at any concurrency.
        a, b = c("E-1", paths=["a/"]), c("E-2", paths=["b/"])
        self.assertTrue(work.conflicts(a, b))


def c(eid, state=work.READY, paths=(), deps=(), locks=(), observes=(), priority=None, file=None, **kw):
    """A work item. file=None → V1-style (writes .ai/EXPERIMENT.yaml); otherwise its own contract file."""
    contract = {"id": eid, "outcome": "O2", "branch": f"ai/{eid}", "status": "ready",
                "allowed": {"paths": list(paths)}, "depends_on": list(deps), "locks": list(locks),
                "observes": list(observes)}
    if priority is not None:
        contract["priority"] = priority
    it = work.item(contract, file=file or sup.EXP)
    it.update(state=state, **kw)
    return it


def own(eid, state=work.READY, **kw):   # future-style item with its own contract file
    return c(eid, state, file=f".ai/work/{eid}.yaml", **kw)


def sched(items, concurrency=1, **view):
    v = {"items": items, "plan_pr": None, "plan_branches": [], "blockers": [], "contradictions": []}
    v.update(view)
    return work.schedule(v, concurrency=concurrency)


def launched(r):
    return [x["action"] for x in r["launch"]]


def row(r, eid):
    return next(i for i in r["items"] if i["id"] == eid)


class Paths(unittest.TestCase):
    def test_overlaps(self):
        o = work.overlaps
        self.assertTrue(o("packages/barocss/", "packages/barocss/src/x.ts"))
        self.assertFalse(o("packages/barocss/", "packages/barocss-browser/"))
        self.assertTrue(o("a/b.ts", "a/b.ts"))
        self.assertFalse(o("a/b.ts", "a/b.tsx"))
        self.assertTrue(o("packages/*/src", "packages/barocss/src/a.ts"))   # glob → conservative tree
        self.assertTrue(o("**", "anything"))
        self.assertFalse(o(".ai/evidence/E-1/", ".ai/evidence/E-2/"))


class Dag(unittest.TestCase):
    def test_independent_items_run_together_only_with_slots(self):
        items = [own("W-1", paths=["a/"]), own("W-2", paths=["b/"])]
        self.assertEqual(launched(sched(items, 2)), ["EXECUTE W-1", "EXECUTE W-2"])
        r = sched(items, 1)
        self.assertEqual(launched(r), ["EXECUTE W-1"])
        self.assertEqual(row(r, "W-2")["bucket"], "waiting")
        self.assertIn("no free slot", row(r, "W-2")["reason"])

    def test_overlapping_writes_serialize(self):
        r = sched([own("W-1", paths=["packages/barocss/src/"]), own("W-2", paths=["packages/barocss/"])], 3)
        self.assertEqual(launched(r), ["EXECUTE W-1"])
        self.assertIn("conflict with W-1", row(r, "W-2")["reason"])

    def test_active_item_holds_its_scope(self):
        # W-1's branch is unmerged (judge pending): W-2 on the same paths must wait even with free slots.
        r = sched([own("W-1", JUDGE, paths=["a/"], pr={"number": 3, "state": "OPEN", "ci": "success"}),
                   own("W-2", paths=["a/x"])], 3)
        self.assertEqual(launched(r), ["REVIEW W-1"])
        self.assertIn("conflict", row(r, "W-2")["reason"])

    def test_named_lock_and_observed_paths_conflict(self):
        r = sched([own("W-1", locks=["port:5173"]), own("W-2", locks=["port:5173"]), own("W-3", paths=["x/"])], 3)
        self.assertEqual(launched(r), ["EXECUTE W-1", "EXECUTE W-3"])
        self.assertIn("lock port:5173", row(r, "W-2")["reason"])
        r = sched([own("W-1", paths=["packages/barocss/src/"]), own("W-2", observes=["packages/barocss/"])], 3)
        self.assertEqual(launched(r), ["EXECUTE W-1"])
        self.assertIn("observes", row(r, "W-2")["reason"])

    def test_dependencies(self):
        r = sched([own("W-1", RUNNING), own("W-2", deps=["W-1"])], 3)
        self.assertEqual((launched(r), row(r, "W-2")["reason"]), ([], "depends on W-1 (RUNNING)"))
        r = sched([own("W-1", DONE), own("W-2", deps=["W-1"])], 3)
        self.assertEqual(launched(r), ["EXECUTE W-2"])

    def test_unknown_dependency_and_cycle_block(self):
        r = sched([own("W-1", deps=["W-9"]), own("W-2", deps=["W-3"]), own("W-3", deps=["W-2"]), own("W-4")], 3)
        self.assertEqual(launched(r), ["EXECUTE W-4"])
        self.assertEqual(r["buckets"]["blocked"], ["W-1", "W-2", "W-3"])
        self.assertEqual(row(r, "W-1")["reason"], "unknown dependency W-9")
        self.assertEqual(row(r, "W-2")["reason"], "dependency cycle")

    def test_priority_then_id(self):
        r = sched([own("W-1", paths=["a/"]), own("W-2", paths=["a/"], priority=5)], 3)
        self.assertEqual(launched(r), ["EXECUTE W-2"])

    def test_merge_then_judge_then_compute(self):
        pr = {"state": "OPEN", "ci": "success", "mergeable": "MERGEABLE"}
        r = sched([own("W-3", paths=["c/"]), own("W-2", JUDGE, pr=dict(pr, number=2)),
                   own("W-1", MERGING, pr=dict(pr, number=1))], 3)
        self.assertEqual(launched(r), ["MERGE #1", "REVIEW W-2", "EXECUTE W-3"])
        self.assertEqual(sched([own("W-3", paths=["c/"]), own("W-2", JUDGE, pr=dict(pr, number=2))], 1)
                         ["next_action"], "REVIEW W-2")

    def test_running_sessions_fill_slots(self):
        r = sched([own("W-1", RUNNING), own("W-2", paths=["b/"])], 1)
        self.assertEqual((launched(r), r["next_action"]), ([], "WAIT_EXECUTION W-1"))
        self.assertEqual(launched(sched([own("W-1", RUNNING), own("W-2", paths=["b/"])], 2)), ["EXECUTE W-2"])



class Planner(unittest.TestCase):
    def test_idle_slots_do_not_wake_planner(self):
        r = sched([own("W-1", RUNNING)], 3)
        self.assertEqual((r["planner"]["state"], launched(r), r["next_action"]), ("idle", [], "WAIT_EXECUTION W-1"))

    def test_waiting_work_does_not_wake_planner(self):
        r = sched([own("W-1", RUNNING), own("W-2", deps=["W-1"])], 3)
        self.assertEqual((r["planner"]["state"], r["next_action"]), ("idle", "WAIT_EXECUTION W-1"))

    def test_stuck_dag_wakes_planner(self):
        # Only the Planner can fix an unknown dependency or a cycle; wake it once nothing else can progress.
        r = sched([own("W-1", deps=["W-9"])], 3)
        self.assertEqual((r["planner"]["state"], launched(r)), ("needed", ["PLAN"]))
        self.assertIn("W-1", r["planner"]["reason"])
        r = sched([own("W-1", deps=["W-9"]), own("W-2", RUNNING)], 3)
        self.assertEqual(r["planner"]["state"], "idle")

    def test_no_open_work_wakes_planner(self):
        r = sched([own("W-1", DONE)], 3)
        self.assertEqual((r["planner"]["state"], launched(r)), ("needed", ["PLAN"]))
        self.assertEqual(sched([], 1)["next_action"], "PLAN")

    def test_rejected_result_wakes_planner_even_with_open_work(self):
        r = sched([own("W-1", work.UNRECORDED), own("W-2", paths=["b/"])], 2)
        self.assertEqual(launched(r), ["EXECUTE W-2", "PLAN"])
        self.assertIn("W-1", r["planner"]["reason"])

    def test_blockers_hold_planning_not_compute(self):
        r = sched([], 1, blockers=["token expired"])
        self.assertEqual((r["planner"]["state"], r["next_action"]), ("blocked", "HUMAN_REQUIRED"))
        r = sched([own("W-1")], 1, blockers=["token expired"])
        self.assertEqual(r["next_action"], "EXECUTE W-1")

    def test_planner_output_landing_blocks_new_launches(self):
        r = sched([own("W-1")], 3, plan_branches=["ai/strategy-E-010"])
        self.assertEqual((launched(r), r["next_action"]), ([], "WAIT_PLAN ai/strategy-E-010"))
        self.assertEqual(row(r, "W-1")["reason"], "planner output landing")


class Properties(unittest.TestCase):
    def test_pure_and_order_independent(self):
        items = [own("W-1", paths=["a/"]), own("W-2", paths=["a/"], priority=1), own("W-3", deps=["W-1"]),
                 own("W-4", locks=["browser"]), own("W-5", locks=["browser"])]
        before = copy.deepcopy(items)
        first = sched(items, 2)
        self.assertEqual(items, before)
        for seed in range(5):
            shuffled = items[:]
            random.Random(seed).shuffle(shuffled)
            self.assertEqual(sched(shuffled, 2), first)

    def test_never_exceeds_concurrency(self):
        items = [own(f"W-{i}", paths=[f"p{i}/"]) for i in range(6)]
        for n in range(0, 5):
            self.assertEqual(len(sched(items, n)["launch"]), n)
        self.assertEqual(len(sched(items + [own("W-9", RUNNING)], 3)["launch"]), 2)

    def test_bad_optional_fields_do_not_crash(self):
        it = work.item({"id": "W-1", "status": "ready", "depends_on": "W-0", "locks": None, "priority": "high",
                        "allowed": {"paths": "a/"}})
        self.assertEqual((it["depends_on"], it["locks"], it["priority"]), ([], [], 0))


class CheckPy(unittest.TestCase):
    def structure_errors(self, **extra):
        ns = {"__name__": "v1_check"}
        path = os.path.join(sup.TOP, sup.CHECK)
        exec(compile(open(path).read(), path, "exec"), ns)
        exp = sup.yaml.safe_load(open(os.path.join(sup.TOP, sup.EXP)))
        state = sup.yaml.safe_load(open(os.path.join(sup.TOP, sup.STATE)))
        exp = dict(exp, status="ready", **extra)
        ns["check_structure"](exp, state)
        return ns["errors"]

    def test_optional_dag_fields(self):
        self.assertEqual(self.structure_errors(), [])
        self.assertEqual(self.structure_errors(depends_on=["E-7"], locks=["port:5173"], observes=["a/"],
                                               priority=2), [])
        self.assertEqual(len(self.structure_errors(depends_on="E-7", locks=[1], priority=True)), 3)


if __name__ == "__main__":
    unittest.main()
