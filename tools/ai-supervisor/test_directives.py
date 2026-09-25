#!/usr/bin/env python3
"""Directive issues (#160): the allowlisted reader, fail-closed behaviour, and the supervisor's use of it."""
import contextlib, io, json, os, sys, tempfile, time, unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import directives  # noqa: E402
import supervise as sv  # noqa: E402
from test_supervise import C, World, rec, view  # noqa: E402

CFG = {"label": "directive", "authors": ["easylogic"]}


def issue(n, author, body="do X", updated="2026-09-25T10:00:00Z", editor=None):
    return {"number": n, "title": f"t{n}", "body": body, "author": {"login": author}, "updatedAt": updated,
            "url": f"https://github.com/o/r/issues/{n}", "editor": {"login": editor} if editor else None}


class Reader(unittest.TestCase):
    def test_only_allowed_authors_are_in_force(self):
        ok, ignored = directives.split([issue(5, "easylogic"), issue(3, "stranger"), issue(1, "easylogic")], CFG)
        self.assertEqual([d["number"] for d in ok], [1, 5])            # oldest first
        self.assertEqual([(d["number"], d["author"]) for d in ignored], [(3, "stranger")])
        self.assertEqual(directives.ids(ok), ["#1@2026-09-25T10:00:00Z", "#5@2026-09-25T10:00:00Z"])

    def test_a_body_edited_by_someone_else_is_not_in_force(self):
        ok, ignored = directives.split([issue(4, "easylogic", editor="some-bot"), issue(6, "easylogic",
                                                                                      editor="easylogic")], CFG)
        self.assertEqual([d["number"] for d in ok], [6])
        self.assertEqual(ignored[0]["number"], 4)
        self.assertIn("last edited by some-bot", ignored[0]["reason"])

    def test_repo_config(self):
        cfg = directives.config()
        self.assertEqual(cfg["label"], "directive")
        self.assertIn("easylogic", cfg["authors"])

    def fake_gh(self, script):
        d = tempfile.mkdtemp()
        p = os.path.join(d, "gh")
        with open(p, "w") as fh:
            fh.write("#!/bin/sh\n" + script)
        os.chmod(p, 0o755)
        return (p,)

    def test_unavailable_fails_closed(self):
        with self.assertRaises(directives.Unavailable):
            directives.fetch(CFG, gh=self.fake_gh("echo 'HTTP 502' >&2; exit 1"))
        with self.assertRaises(directives.Unavailable):
            directives.fetch(CFG, gh=self.fake_gh("echo not-json"))
        with self.assertRaises(directives.Unavailable):
            directives.fetch(CFG, gh=self.fake_gh("echo '{\"data\": null}'"))

    def test_cli_exit_code_when_unavailable(self):
        orig = directives.current
        directives.current = lambda *a, **k: (_ for _ in ()).throw(directives.Unavailable("offline"))
        self.addCleanup(lambda: setattr(directives, "current", orig))
        err, out = io.StringIO(), io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(out):
            self.assertEqual(directives.main([]), 2)
        self.assertEqual(out.getvalue(), "")                       # nothing that could be mistaken for a list
        self.assertIn("Stop without changes", err.getvalue())

    def test_cli_prints_ids_and_ignored(self):
        orig = directives.current
        directives.current = lambda *a, **k: directives.split([issue(7, "easylogic"), issue(8, "x")], CFG)
        self.addCleanup(lambda: setattr(directives, "current", orig))
        err, out = io.StringIO(), io.StringIO()
        with contextlib.redirect_stderr(err), contextlib.redirect_stdout(out):
            self.assertEqual(directives.main(["--ids"]), 0)
        self.assertEqual(out.getvalue().strip(), "#7@2026-09-25T10:00:00Z")
        self.assertIn("ignored: #8: author x is not allowed", err.getvalue())


class Supervisor(unittest.TestCase):
    DOWN = {"ok": False, "ids": [], "ignored": [], "error": "offline"}

    def test_strategy_sessions_hold_when_directives_are_unreadable(self):
        for name, action in (("plan", "PLAN"), ("review", "REVIEW E-009")):
            v = dict(view(name), directives=self.DOWN)
            d = sv.decide(v, [], time.time(), C)
            self.assertEqual((d["do"], d["kind"]), ("hold", "directives_unavailable"), name)
        d = sv.decide(dict(view("execute"), directives=self.DOWN), [], time.time(), C)
        self.assertEqual(d["do"], "launch")                         # Execution reads only its contract

    def test_parallel_filter_too(self):
        v = dict(view("plan"), directives=self.DOWN)
        sched = {"launch": [{"mode": "PLAN", "action": "PLAN", "work": None},
                            {"mode": "COMPUTE", "action": "EXECUTE E-010", "work": "E-010"}], "waits": [], "holds": []}
        d = sv.decide_many(v, sched, [], time.time(), sv.Config(concurrency=2))
        self.assertEqual([x["action"] for x in d["launch"]], ["EXECUTE E-010"])
        self.assertEqual([h["kind"] for h in d["holds"]], ["directives_unavailable"])

    def test_launch_records_the_directives_in_force(self):
        w = World(self, "execute", plan=[{"world": "review"}])
        s = w.sup()
        s._directives = lambda: {"ok": True, "ids": ["#161@2026-09-25T11:00:00Z"], "ignored": [], "error": None}
        s.run(max_sessions=1)
        self.assertEqual(w.records()[0]["directives"], ["#161@2026-09-25T11:00:00Z"])

    def test_ignored_directives_are_attention(self):
        w = World(self, "plan")
        s = w.sup()
        s._directives = lambda: {"ok": True, "ids": [], "error": None,
                                 "ignored": [{"number": 9, "author": "stranger"}]}
        v = s.observe()
        self.assertIn("directive_ignored", [a["kind"] for a in v["attention"]])


if __name__ == "__main__":
    unittest.main()
