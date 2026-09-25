#!/usr/bin/env python3
"""Replay V1 history through the shadow supervisor and check it picks the transitions that happened.

  python3 tools/ai-supervisor/replay.py            # replay from fixture + local git objects; exit 1 on mismatch
  python3 tools/ai-supervisor/replay.py --trace    # also print every event with the predicted action
  python3 tools/ai-supervisor/replay.py --record   # (network) re-record fixtures/v1-history.json from gh

The fixture holds only what git cannot: PR open/merge times and required-check completion times.
Commits, EXPERIMENT.yaml and STATE.yaml at each point come from git. Snapshots have the same shape
as sup.collect_live(), so replay exercises the same derive().

Event → the prediction that must hold just before it (the latest moment a supervisor could have acted):
  first commit on ai/E-*                 EXECUTE <id>        (a session was launched)
  commit "ai(strategy): review E-N"      REVIEW E-N
  first commit on ai/strategy-*          PLAN
  PR merged                              MERGE #<n>
  any other commit, PR opened            WAIT_* (a session in flight; the supervisor must not launch)
  CI completed                           no expectation (external)
Push time is approximated by commit time; GitHub does not keep push times for merged branches.
"""
import argparse, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import sup  # noqa: E402

FIXTURE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "v1-history.json")
WAITS = {"WAIT_EXECUTION", "WAIT_PLAN", "WAIT_FOR_CI"}


def record(path=FIXTURE, first_pr=106):
    prs = sup.gh_json("pr", "list", "--state", "all", "--search", "head:ai/", "--limit", "200", "--json",
                      "number,headRefName,state,createdAt,mergedAt,closedAt")
    out = []
    for p in sorted(prs, key=lambda p: p["number"]):
        if p["number"] < first_pr or not p["headRefName"].startswith("ai/"):
            continue
        commits = []
        for c in sup.gh_json("pr", "view", str(p["number"]), "--json", "commits")["commits"]:
            runs = sup.gh_json("api", f"repos/{{owner}}/{{repo}}/commits/{c['oid']}/check-runs")["check_runs"]
            commits.append({"sha": c["oid"], "time": c["committedDate"], "subject": c["messageHeadline"],
                            "checks": [{"name": r["name"], "conclusion": r["conclusion"],
                                        "started": r["started_at"], "completed": r["completed_at"]}
                                       for r in runs if r["name"] in sup.REQUIRED_CHECKS]})
        out.append({"number": p["number"], "head": p["headRefName"], "state": p["state"],
                    "created": p["createdAt"], "merged": p["mergedAt"], "closed": p["closedAt"],
                    "commits": commits})
    dev = sup.git("rev-parse", "origin/develop").strip()
    at = sup.datetime.now(sup.timezone.utc).isoformat(timespec="seconds")
    data = {"repo_develop_tip": dev, "recorded_at": at, "prs": out}
    sup.write_json(path, data)
    return data


def load_fixture(path=FIXTURE):
    with open(path) as fh:
        return json.load(fh)


class MissingObjects(RuntimeError):
    pass


class History:
    def __init__(self, fx):
        self.fx = fx
        self.t = sup.parse_time
        shas = [fx["repo_develop_tip"]] + [c["sha"] for p in fx["prs"] for c in p["commits"]]
        missing = [s[:7] for s in shas if sup.git("cat-file", "-e", s + "^{commit}", check=False) is None]
        if missing:
            raise MissingObjects(f"commits not in local git (run `git fetch origin`): {', '.join(missing)}")
        # develop's first-parent history: (time, sha). A PR merge commit becomes visible at the PR's
        # mergedAt; its committer date can be a second earlier, which would show develop moving first.
        merged = {p["number"]: p["merged"] for p in fx["prs"] if p["merged"]}
        log = sup.git("log", "--first-parent", "--format=%H %cI %s", fx["repo_develop_tip"])
        self.develop = []
        for line in log.splitlines():
            sha, tm, subject = line.split(" ", 2)
            m = re.match(r"Merge pull request #(\d+) ", subject)
            if m and int(m.group(1)) in merged:
                tm = merged[int(m.group(1))]
            self.develop.append((self.t(tm), sha))
        self.develop.sort()

    def develop_at(self, t):
        cur = None
        for tm, sha in self.develop:
            if tm < t:
                cur = sha
            else:
                break
        return cur

    def ci_at(self, commit, t, pr_open):
        """Required-check state of `commit` as seen at time t."""
        seen = [c for c in commit["checks"] if c["started"] and self.t(c["started"]) < t]
        if not seen:
            return "none"
        runs = [{"name": c["name"],
                 "status": "COMPLETED" if c["completed"] and self.t(c["completed"]) < t else "IN_PROGRESS",
                 "conclusion": c["conclusion"]} for c in seen]
        return sup.summarize_checks(runs)

    def snapshot(self, t):
        dev = self.develop_at(t)
        develop = sup.develop_view(dev, ci="unknown")
        exp_branch = (develop["exp"] or {}).get("branch")
        branches, prs = {}, []
        for p in self.fx["prs"]:
            pushed = [c for c in p["commits"] if self.t(c["time"]) < t]
            if not pushed:
                continue
            head = pushed[-1]
            branches[p["head"]] = sup.branch_view(head["sha"], head["time"], dev, want_exp=(p["head"] == exp_branch))
            if self.t(p["created"]) >= t:
                continue
            if p["merged"] and self.t(p["merged"]) < t:
                state = "MERGED"
            elif p["closed"] and self.t(p["closed"]) < t:
                state = "CLOSED"
            else:
                state = "OPEN"
            prs.append({"number": p["number"], "head": p["head"], "state": state, "sha": head["sha"],
                        "mergeable": "MERGEABLE", "url": f"https://github.com/barocss/barocss/pull/{p['number']}",
                        "ci": self.ci_at(head, t, state == "OPEN")})
        return {"at": t.isoformat(), "develop": develop, "branches": branches, "prs": prs}

    def events(self):
        ev = []
        for p in self.fx["prs"]:
            plan = p["head"].startswith(sup.PLAN_PREFIX)
            for i, c in enumerate(p["commits"]):
                m = re.match(r"ai\(strategy\): review (E-\d+)", c["subject"])
                if i == 0:
                    exp = "PLAN" if plan else "EXECUTE " + re.match(r"ai/(E-\d+)", p["head"]).group(1)
                elif m:
                    exp = f"REVIEW {m.group(1)}"
                else:
                    exp = WAITS
                ev.append((c["time"], f"commit {c['sha'][:7]} {c['subject'][:60]}", exp))
                for ch in c["checks"]:
                    if ch["completed"]:
                        ev.append((ch["completed"], f"ci {ch['conclusion']} {c['sha'][:7]} (#{p['number']})", None))
            ev.append((p["created"], f"PR #{p['number']} opened ({p['head']})", WAITS))
            if p["merged"]:
                ev.append((p["merged"], f"PR #{p['number']} merged", f"MERGE #{p['number']}"))
        return sorted(ev, key=lambda e: self.t(e[0]))


def replay(fx=None, trace=False):
    """Returns (checked, mismatches, trace_lines, status at the recording time)."""
    h = History(fx or load_fixture())
    checked, bad, lines = 0, [], []
    for tm, what, expect in h.events():
        st = sup.derive(h.snapshot(h.t(tm)))
        got = st["next_action"]
        ok = True
        if expect is not None:
            checked += 1
            ok = (got.split()[0] in expect) if isinstance(expect, set) else (got == expect)
            if st["contradictions"]:
                ok = False
            if not ok:
                bad.append({"at": tm, "event": what, "expected": sorted(expect) if isinstance(expect, set) else expect,
                            "predicted": got, "phase": st["phase"], "contradictions": st["contradictions"]})
        if trace:
            mark = " " if expect is None else ("✓" if ok else "✗")
            lines.append(f"{mark} {tm}  {got:<22} {st['phase']:<17} ← {what}")
    final = sup.derive(h.snapshot(h.t(h.fx["recorded_at"])))
    if trace:
        lines.append(f"  {h.fx['recorded_at']}  {final['next_action']:<22} {final['phase']:<17} ← (fixture recorded)")
    return checked, bad, lines, final


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--record", action="store_true")
    ap.add_argument("--trace", action="store_true")
    a = ap.parse_args()
    if a.record:
        d = record()
        print(f"recorded {len(d['prs'])} PRs at {d['recorded_at']} → {FIXTURE}")
    checked, bad, lines, _ = replay(trace=a.trace)
    for line in lines:
        print(line)
    for b in bad:
        print("MISMATCH", json.dumps(b))
    print(f"{checked} transitions checked, {len(bad)} mismatch(es)")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
