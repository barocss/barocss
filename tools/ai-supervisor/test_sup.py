#!/usr/bin/env python3
"""Deterministic tests for the shadow supervisor.

  python3 -m unittest discover -s tools/ai-supervisor -v

Synthetic snapshots exercise every rule and contradiction. The replay test drives the recorded
E-001…E-007 history through derive() (needs the fixture's commits in local git).
"""
import copy, os, sys, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402
import replay  # noqa: E402

B = "ai/E-009-x"
AT = "2026-09-25T12:00:00+00:00"


def exp(status="ready", **kw):
    e = {"id": "E-009", "outcome": "O2", "branch": B, "status": status}
    e.update(kw)
    return e


def snap(dev_status="ready", branch=None, prs=(), plan_branches=(), blockers=(), dev_exp=True,
         last_ai="ai(strategy): review E-008 PROVEN", check_errors=(), dev_ci="success", branch_time=AT):
    """branch: None (absent) or a dict merged into the branch copy of the experiment."""
    d = exp(dev_status) if dev_exp else None
    branches = {}
    if branch is not None:
        branches[B] = {"sha": "b" * 40, "time": branch_time, "ahead": True, "exp": exp(**dict({"status": "running"}, **branch))}
    for name in plan_branches:
        branches[name] = {"sha": "c" * 40, "time": AT, "ahead": True, "exp": None}
    return {
        "at": AT,
        "develop": {"sha": "d" * 40, "ci": dev_ci, "exp": d, "check_errors": list(check_errors),
                    "last_ai_subject": last_ai,
                    "state": {"now": {"blockers": list(blockers)},
                              "outcomes": {"O1": {"status": "done"}, "O2": {"status": "active"}}}},
        "branches": branches,
        "prs": [dict({"state": "OPEN", "ci": "success", "mergeable": "MERGEABLE", "head": B, "number": 5,
                      "url": "https://github.com/o/r/pull/5"}, **p) for p in prs],
    }


def action(s):
    return sup.derive(s)["next_action"]


class RuleTable(unittest.TestCase):
    def test_precedence_is_explicit(self):
        # Changing V1 precedence must be a visible edit to this list.
        self.assertEqual([r[0] for r in sup.RULES],
                         ["C0", "P1", "P2", "E1", "E2", "E3", "E4", "R1", "M1", "M2", "S1", "S2"])

    def test_every_action_has_a_state(self):
        for a in ("PLAN", "EXECUTE", "REVIEW", "MERGE", "WAIT_FOR_CI", "BLOCKED", "HUMAN_REQUIRED", "IDLE"):
            self.assertIn(a, sup.ACTION_STATE)


class Execution(unittest.TestCase):
    def test_ready_without_branch_executes(self):
        st = sup.derive(snap("ready"))
        self.assertEqual((st["next_action"], st["phase"], st["state"]), ("EXECUTE E-009", "ready", "runnable"))

    def test_running_branch_waits_and_flags_liveness(self):
        st = sup.derive(snap("ready", branch={"status": "running"}))
        self.assertEqual((st["next_action"], st["state"]), ("WAIT_EXECUTION E-009", "active"))
        self.assertTrue(any("liveness" in a for a in st["ambiguities"]))
        self.assertEqual(st["experiments"][0]["source"], "branch")

    def test_quiet_running_branch_is_attention_not_action(self):
        st = sup.derive(snap("ready", branch={"status": "running"}, branch_time="2026-09-25T08:00:00+00:00"))
        self.assertEqual(st["next_action"], "WAIT_EXECUTION E-009")
        self.assertIn("execution_quiet", [a["kind"] for a in st["attention"]])

    def test_branch_created_but_still_ready_waits(self):
        self.assertEqual(action(snap("ready", branch={"status": "ready"})), "WAIT_EXECUTION E-009")

    def test_done_without_pr_waits_for_execution_to_open_it(self):
        self.assertEqual(action(snap("ready", branch={"status": "done"})), "WAIT_EXECUTION E-009")


class Review(unittest.TestCase):
    def test_done_with_pending_ci_waits(self):
        for ci in ("pending", "none"):
            self.assertEqual(action(snap("ready", branch={"status": "done"}, prs=[{"ci": ci}])), "WAIT_FOR_CI #5")

    def test_done_or_blocked_with_concluded_ci_reviews(self):
        for status in ("done", "blocked"):
            for ci in ("success", "failure"):   # red CI is review input, not a stop
                self.assertEqual(action(snap("ready", branch={"status": status}, prs=[{"ci": ci}])),
                                 "REVIEW E-009", (status, ci))

    def test_branch_copy_wins_while_develop_ready(self):
        # V1 §1.2: develop says ready, the branch says done → the branch is authoritative.
        st = sup.derive(snap("ready", branch={"status": "done"}, prs=[{}]))
        self.assertEqual(st["experiments"][0]["status"], "done")

    def test_branch_copy_ignored_once_develop_evaluated(self):
        # V1 §1.2 only reads the branch for ready/running; a leftover branch copy doesn't matter.
        self.assertEqual(action(snap("evaluated", branch={"status": "done"})), "PLAN")


class Merge(unittest.TestCase):
    def reviewed(self, merged=True, **pr):
        return snap("ready", branch={"status": "evaluated", "review": {"accepted_verdict": "PROVEN",
                                                                       "merged": merged}}, prs=[pr])

    def test_reviewed_merge_waits_for_ci_then_merges(self):
        self.assertEqual(action(self.reviewed(ci="pending")), "WAIT_FOR_CI #5")
        st = sup.derive(self.reviewed(ci="success"))
        self.assertEqual((st["next_action"], st["phase"]), ("MERGE #5", "merging"))

    def test_reviewed_merge_with_red_ci_is_blocked(self):
        self.assertEqual(action(self.reviewed(ci="failure")), "BLOCKED #5")

    def test_reviewed_merge_with_conflict_needs_human(self):
        self.assertEqual(action(self.reviewed(mergeable="CONFLICTING")), "HUMAN_REQUIRED #5")

    def test_rejected_review_goes_to_plan_for_the_record(self):
        st = sup.derive(self.reviewed(merged=False))
        self.assertEqual((st["next_action"], st["phase"]), ("PLAN", "rejected_unrecorded"))


class Plan(unittest.TestCase):
    def test_evaluated_none_missing_plan(self):
        self.assertEqual(action(snap("evaluated")), "PLAN")
        self.assertEqual(action(snap("none")), "PLAN")
        self.assertEqual(action(snap(dev_exp=False)), "PLAN")

    def test_blockers_need_human(self):
        st = sup.derive(snap("evaluated", blockers=["gh token expired"]))
        self.assertEqual((st["next_action"], st["phase"]), ("HUMAN_REQUIRED", "human_blocked"))

    def test_plan_branch_without_pr_waits(self):
        self.assertEqual(action(snap("evaluated", plan_branches=["ai/strategy-E-010"])),
                         "WAIT_PLAN ai/strategy-E-010")

    def test_open_plan_pr_precedes_planning_again(self):
        pr = {"head": "ai/strategy-E-010", "number": 7}
        self.assertEqual(action(snap("evaluated", plan_branches=["ai/strategy-E-010"], prs=[dict(pr, ci="pending")])),
                         "WAIT_FOR_CI #7")
        self.assertEqual(action(snap("evaluated", plan_branches=["ai/strategy-E-010"], prs=[pr])), "MERGE #7")
        self.assertEqual(action(snap("evaluated", plan_branches=["ai/strategy-E-010"], prs=[dict(pr, ci="failure")])),
                         "BLOCKED #7")

    def test_abandoned_plan_branch_is_attention_only(self):
        st = sup.derive(snap("evaluated", plan_branches=["ai/strategy-E-010"],
                             prs=[{"head": "ai/strategy-E-010", "number": 7, "state": "CLOSED"}]))
        self.assertEqual(st["next_action"], "PLAN")
        self.assertIn("abandoned_strategy_branch", [a["kind"] for a in st["attention"]])

    def test_plan_repeat_ambiguity(self):
        st = sup.derive(snap("evaluated", last_ai="ai(strategy): contract E-009 something"))
        self.assertTrue(any("idle marker" in a for a in st["ambiguities"]))
        st = sup.derive(snap("evaluated"))   # last .ai commit is a review → the plan is simply due
        self.assertFalse(any("idle marker" in a for a in st["ambiguities"]))


class Contradictions(unittest.TestCase):
    def assertHuman(self, s, needle):
        st = sup.derive(s)
        self.assertEqual((st["next_action"], st["phase"], st["state"]), ("HUMAN_REQUIRED", "contradiction", "blocked"))
        self.assertTrue(any(needle in c for c in st["contradictions"]), st["contradictions"])

    def test_develop_holds_branch_only_status(self):
        self.assertHuman(snap("done"), "develop says done")
        self.assertHuman(snap("blocked"), "develop says blocked")

    def test_develop_running_branch_missing(self):
        self.assertHuman(snap("running"), "branch ai/E-009-x is missing")

    def test_invalid_status(self):
        self.assertHuman(snap("finished"), "not a V1 status")

    def test_structure_errors(self):
        self.assertHuman(snap("ready", check_errors=["EXPERIMENT.question required"]), "check.py structure")

    def test_branch_holds_other_experiment(self):
        self.assertHuman(snap("ready", branch={"status": "running", "id": "E-008"}), "holds E-008")

    def test_merged_pr_but_develop_ready(self):
        self.assertHuman(snap("ready", branch={"status": "evaluated", "review": {"merged": True}},
                              prs=[{"state": "MERGED"}]), "merged but develop still says ready")

    def test_closed_pr_unreviewed(self):
        self.assertHuman(snap("ready", branch={"status": "done"}, prs=[{"state": "CLOSED"}]), "not reviewed")

    def test_result_pr_mismatch(self):
        self.assertHuman(snap("ready", branch={"status": "done", "result": {"pr": "https://github.com/o/r/pull/4"}},
                              prs=[{}]), "does not match PR #5")

    def test_review_merge_without_open_pr(self):
        self.assertHuman(snap("ready", branch={"status": "evaluated", "review": {"merged": True}}), "no open PR")

    def test_evaluated_without_merge_decision(self):
        self.assertHuman(snap("ready", branch={"status": "evaluated", "review": {}}, prs=[{}]), "review.merged")

    def test_two_open_prs_for_branch(self):
        self.assertHuman(snap("ready", branch={"status": "done"}, prs=[{"number": 5}, {"number": 6}]), "2 open PRs")

    def test_plan_in_flight_during_experiment(self):
        self.assertHuman(snap("ready", branch={"status": "running"}, plan_branches=["ai/strategy-E-010"]),
                         "ahead of develop while E-009 is running")

    def test_two_plans_in_flight(self):
        self.assertHuman(snap("evaluated", plan_branches=["ai/strategy-E-010", "ai/strategy-E-011"]),
                         "more than one Strategy pass")


class Properties(unittest.TestCase):
    def test_derive_is_pure_and_deterministic(self):
        s = snap("ready", branch={"status": "done"}, prs=[{}])
        before = copy.deepcopy(s)
        self.assertEqual(sup.derive(s), sup.derive(s))
        self.assertEqual(s, before)

    def test_status_shape(self):
        st = sup.derive(snap("ready", branch={"status": "done"}, prs=[{}]))
        for k in ("outcomes", "experiments", "phase", "next_action", "state", "attention", "contradictions",
                  "ambiguities", "plan", "develop"):
            self.assertIn(k, st)
        self.assertEqual(st["experiments"][0]["pr"]["ci"], "success")
        self.assertEqual([o["id"] for o in st["outcomes"] if o["current"]], ["O2"])

    def test_develop_ci_red_is_attention(self):
        st = sup.derive(snap("evaluated", dev_ci="failure"))
        self.assertEqual(st["next_action"], "PLAN")
        self.assertIn("develop_ci_red", [a["kind"] for a in st["attention"]])

    def test_summarize_checks(self):
        ok = {"name": "Test and Build", "status": "COMPLETED", "conclusion": "SUCCESS"}
        self.assertEqual(sup.summarize_checks([]), "none")
        self.assertEqual(sup.summarize_checks([{"name": "other", "status": "IN_PROGRESS"}]), "none")
        self.assertEqual(sup.summarize_checks([ok]), "success")
        self.assertEqual(sup.summarize_checks([dict(ok, status="IN_PROGRESS", conclusion=None)]), "pending")
        self.assertEqual(sup.summarize_checks([dict(ok, conclusion="FAILURE")]), "failure")


class Replay(unittest.TestCase):
    def test_v1_history_transitions(self):
        try:
            checked, bad, _, final = replay.replay()
        except replay.MissingObjects as e:
            self.skipTest(str(e))
        self.assertEqual(bad, [])
        self.assertGreaterEqual(checked, 60)
        # The fixture was recorded with E-007's PR open and CI green.
        self.assertEqual(final["next_action"], "REVIEW E-007")

    def test_bootstrap_flags_plan_repeat(self):
        # Before E-001, the last .ai commit was `ai(strategy): migrate …` with status none (README ambiguity 2).
        try:
            h = replay.History(replay.load_fixture())
        except replay.MissingObjects as e:
            self.skipTest(str(e))
        st = sup.derive(h.snapshot(h.t("2026-09-24T14:25:56Z")))
        self.assertEqual(st["next_action"], "PLAN")
        self.assertTrue(any("idle marker" in a for a in st["ambiguities"]))


if __name__ == "__main__":
    unittest.main()
