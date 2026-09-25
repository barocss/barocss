#!/usr/bin/env python3
"""BaroCSS autonomy V3: GitHub Issues for planning, local git for code. See docs/autonomy-v3.md.

    v3.py status                    local task state, control state, planner wake reasons
    v3.py start|pause|resume|stop   control file; `run` obeys it between steps
    v3.py plan                      launch one fresh Planner (Opus, medium effort)
    v3.py run [--once] [--issue N]  claim a `v3:ready` Issue → Compute (Opus, low) in a worktree →
                                    verify → local merge into develop → verify → close the Issue

Deterministic: it never decides direction, never opens a PR, never pushes.
"""
import argparse, json, os, re, subprocess, sys, time

HOME = os.environ.get("AI_HOME", os.path.expanduser("~/.barocss-ai"))
V3 = os.path.join(HOME, "v3")
TASKS = os.path.join(V3, "tasks.json")
CONTROL = os.path.join(V3, "control.json")
WAKE = os.path.join(V3, "planner-wake.json")
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"], cwd=HERE,
                      capture_output=True, text=True, check=True).stdout.strip().removesuffix("/.git")
INTEGRATION = os.path.join(V3, "integration")        # the worktree where local `develop` is checked out
BASE = "develop"
L_READY, L_RUN, L_DONE, L_FAIL = "v3:ready", "v3:running", "v3:done", "v3:failed"
COMPUTE = {"model": "opus", "effort": "low", "timeout_s": 90 * 60}
PLANNER = {"model": "opus", "effort": "medium", "timeout_s": 45 * 60}
MAX_ATTEMPTS = 2
READY_LOW_WATER = 1                                  # wake Planner when fewer ready Issues than this


def sh(cmd, cwd=REPO, check=True, **kw):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, **kw)
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(cmd)}: {r.stderr.strip() or r.stdout.strip()}")
    return r


def load(path, default):
    try:
        with open(path) as fh:
            return json.load(fh)
    except (FileNotFoundError, ValueError):
        return default


def save(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = path + ".tmp"
    with open(tmp, "w") as fh:
        json.dump(data, fh, indent=2)
    os.replace(tmp, path)


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def wake_planner(reason):
    w = load(WAKE, {"reasons": []})
    w["reasons"].append({"at": now(), "reason": reason})
    save(WAKE, w)


def desired():
    return load(CONTROL, {}).get("desired", "running")


def gh_json(args):
    return json.loads(sh(["gh", *args]).stdout or "null")


def ready_issues():
    items = gh_json(["issue", "list", "--label", L_READY, "--state", "open", "--json", "number,title,labels",
                     "--limit", "50"])
    return sorted((i for i in items if not any(l["name"] in (L_RUN, L_FAIL) for l in i["labels"])),
                  key=lambda i: i["number"])


def verification_commands(body):
    """The Issue's ```verify block: one shell command per line, run from the repo root."""
    m = re.search(r"```verify\n(.*?)```", body, re.S)
    return [l.strip() for l in m.group(1).splitlines() if l.strip() and not l.startswith("#")] if m else []


def verify(cmds, cwd):
    for c in cmds:
        r = subprocess.run(c, shell=True, cwd=cwd, capture_output=True, text=True, timeout=30 * 60)
        if r.returncode:
            return False, f"`{c}` failed:\n{(r.stdout + r.stderr)[-1500:]}"
    return True, f"{len(cmds)} command(s) passed"


def clean_env():
    return {k: v for k, v in os.environ.items() if not k.startswith("CLAUDE") and k not in ("AI_AGENT", "BAGGAGE")}


def launch(prompt, cwd, cfg, log):
    cmd = ["claude", "-p", prompt, "--model", cfg["model"], "--effort", cfg["effort"],
           "--permission-mode", "auto", "--output-format", "json"]
    t0 = time.time()
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=cfg["timeout_s"],
                           env=clean_env(), stdin=subprocess.DEVNULL)
        out, code = r.stdout, r.returncode
    except subprocess.TimeoutExpired as e:
        out, code = (e.stdout or b"").decode() if isinstance(e.stdout, bytes) else (e.stdout or ""), "timeout"
    with open(log, "w") as fh:
        fh.write(out)
    try:
        res = json.loads(out)
    except ValueError:
        res = {}
    return {"code": code, "secs": round(time.time() - t0), "cost_usd": res.get("total_cost_usd"),
            "text": (res.get("result") or "")[-3000:], "session_id": res.get("session_id")}


def compute_prompt(issue):
    return open(os.path.join(HERE, "COMPUTE.md")).read() + f"""
==================================================
THIS RUN
==================================================

Ignore the V1 `.ai/` protocol in AGENTS.md: no contracts, no .ai/ edits, no pushes.
Your worktree is on branch v3/issue-{issue['number']}. If product code in packages/ changed, add a patch
changeset in .changeset/. Make ONE local commit: `v3(#{issue['number']}): <summary>`. The Supervisor
integrates it; the Issue's ```verify block is what it will run.

# #{issue['number']} {issue['title']}
{issue['body']}"""


def ensure_integration():
    if not os.path.isdir(INTEGRATION):
        sh(["git", "worktree", "add", INTEGRATION, BASE])
    return INTEGRATION


def run_one(issue_no=None):
    tasks = load(TASKS, {})
    if issue_no is None:
        ready = ready_issues()
        if not ready:
            wake_planner("no ready Issues")
            print("IDLE: no ready Issues (Planner woken)")
            return None
        issue_no = ready[0]["number"]
    issue = gh_json(["issue", "view", str(issue_no), "--json", "number,title,body"])
    key, branch = str(issue_no), f"v3/issue-{issue_no}"
    t = tasks.setdefault(key, {"issue": issue_no, "title": issue["title"], "attempts": 0})
    if t["attempts"] >= MAX_ATTEMPTS:
        print(f"#{issue_no}: attempts exhausted")
        return t
    t.update(state="claimed", branch=branch, claimed_at=now(), attempts=t["attempts"] + 1)
    save(TASKS, tasks)
    sh(["gh", "issue", "edit", key, "--add-label", L_RUN, "--remove-label", L_READY])

    integ = ensure_integration()
    wt = os.path.join(V3, "wt", f"issue-{issue_no}")
    if os.path.isdir(wt):                                   # crash recovery: restart the attempt cleanly
        sh(["git", "worktree", "remove", "--force", wt], check=False)
    sh(["git", "branch", "-f", branch, BASE])
    sh(["git", "worktree", "add", wt, branch])
    base_sha = sh(["git", "rev-parse", BASE]).stdout.strip()
    if os.path.exists(os.path.join(REPO, "pnpm-lock.yaml")):
        sh(["pnpm", "install", "--frozen-lockfile", "--prefer-offline"], cwd=wt, check=False)

    t.update(state="computing", worktree=wt, base=base_sha)
    save(TASKS, tasks)
    sdir = os.path.join(V3, "sessions")
    os.makedirs(sdir, exist_ok=True)
    res = launch(compute_prompt(issue), wt, COMPUTE, os.path.join(sdir, f"issue-{issue_no}-{t['attempts']}.json"))
    t["compute"] = {k: res[k] for k in ("code", "secs", "cost_usd", "session_id")} | {"effort": COMPUTE["effort"],
                                                                                     "model": COMPUTE["model"]}
    commits = sh(["git", "rev-list", f"{base_sha}..{branch}"]).stdout.split()
    cmds = verification_commands(issue["body"])

    def fail(why):
        t.update(state="failed", error=why[-2000:])
        save(TASKS, tasks)
        sh(["gh", "issue", "edit", key, "--remove-label", L_RUN, "--add-label",
            L_READY if t["attempts"] < MAX_ATTEMPTS else L_FAIL])
        if t["attempts"] >= MAX_ATTEMPTS:
            sh(["gh", "issue", "comment", key, "--body", f"V3 Compute failed after {t['attempts']} attempts: {why[:1500]}"])
            wake_planner(f"#{issue_no} failed")
        print(f"#{issue_no} FAILED: {why[:300]}")
        return t

    if res["code"] != 0 or not commits:
        return fail(f"compute exit {res['code']}, {len(commits)} commit(s)")
    if sh(["git", "status", "--porcelain"], cwd=wt).stdout.strip():
        return fail("compute left uncommitted changes")
    ok, msg = verify(cmds, wt)
    if not ok:
        return fail("targeted verification on the task branch: " + msg)

    t["state"] = "integrating"
    save(TASKS, tasks)
    m = sh(["git", "merge", "--no-ff", "-m", f"v3: integrate #{issue_no} {issue['title']}", branch], cwd=integ, check=False)
    if m.returncode:
        sh(["git", "merge", "--abort"], cwd=integ, check=False)
        return fail("merge conflict into local develop (needs a conflict-resolution task)")
    if os.path.exists(os.path.join(integ, "pnpm-lock.yaml")):
        sh(["pnpm", "install", "--frozen-lockfile", "--prefer-offline"], cwd=integ, check=False)
    ok, msg = verify(cmds, integ)
    if not ok:
        sh(["git", "reset", "--hard", base_sha], cwd=integ)   # local develop only; never pushed
        return fail("affected verification after integration: " + msg)
    merge_sha = sh(["git", "rev-parse", "HEAD"], cwd=integ).stdout.strip()

    body = (f"Done by V3 Compute ({COMPUTE['model']}, effort {COMPUTE['effort']}, {res['secs']}s"
            f"{', $%.2f' % res['cost_usd'] if res['cost_usd'] else ''}).\n\n"
            f"Local commit(s) {', '.join(c[:9] for c in commits)} integrated into local `develop` as {merge_sha[:9]} "
            f"(not pushed yet; it goes up with the next checkpoint push).\n\nVerification (task branch and after "
            f"integration): {msg}.\n\n<details><summary>Compute result</summary>\n\n{res['text']}\n</details>")
    sh(["gh", "issue", "close", key, "--comment", body])
    sh(["gh", "issue", "edit", key, "--remove-label", L_RUN, "--add-label", L_DONE])
    sh(["git", "worktree", "remove", "--force", wt], check=False)
    t.update(state="integrated", commits=commits, merge=merge_sha, finished_at=now())
    save(TASKS, tasks)
    wake_planner(f"#{issue_no} integrated")
    if len(ready_issues()) < READY_LOW_WATER:
        wake_planner("ready Issues below threshold")
    print(f"#{issue_no} INTEGRATED as {merge_sha[:9]}")
    return t


def planner_prompt():
    return open(os.path.join(HERE, "PLANNER.md")).read() + "\n\nLocal status:\n" + json.dumps(status(), indent=2)


def status():
    tasks = load(TASKS, {})
    ahead = sh(["git", "rev-list", "--count", f"origin/{BASE}..{BASE}"], check=False).stdout.strip()
    return {"desired": desired(), "tasks": tasks, "planner_wake": load(WAKE, {"reasons": []})["reasons"],
            "local_develop_ahead_of_origin": ahead}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["status", "start", "pause", "resume", "stop", "plan", "run"])
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--issue", type=int)
    a = ap.parse_args()
    if a.cmd in ("start", "resume"):
        save(CONTROL, {"desired": "running", "at": now()})
    elif a.cmd in ("pause", "stop"):
        save(CONTROL, {"desired": "paused" if a.cmd == "pause" else "stopped", "at": now()})
    elif a.cmd == "status":
        print(json.dumps(status(), indent=2))
    elif a.cmd == "plan":
        res = launch(planner_prompt(), REPO, PLANNER, os.path.join(V3, "sessions", f"planner-{int(time.time())}.json"))
        save(WAKE, {"reasons": [], "last_planner": now()})
        print(res["text"])
    elif a.cmd == "run":
        while desired() == "running":
            t = run_one(a.issue)
            if a.once or a.issue or t is None:
                break
        print("control:", desired())


if __name__ == "__main__":
    sys.exit(main())
