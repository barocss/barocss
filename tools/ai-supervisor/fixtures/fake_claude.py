#!/usr/bin/env python3
"""Stand-in for `claude -p` in test_supervise.py. Never talks to a model.

Each launch appends its argv to $SUP_FAKE_ARGV and pops one step from the JSON list in $SUP_FAKE_PLAN:
  world    name written to $SUP_FAKE_WORLD (the durable state the test observer derives from)
  sleep    seconds to run, printing a stream-json line every 0.1 s
  silent   seconds to run without output
  child    leave a grandchild `sleep 60` behind, pid written to $SUP_FAKE_CHILD
  result   "success" (default) | "error" | null (no result event)
  exit     exit code (default 0)
  advance  move the addressed work item one step in $SUP_FAKE_ITEMS (parallel tests): EXECUTE X → "pr",
           REVIEW X → "evaluated". The item comes from the addressed instruction ("next step is …").
Plan and item files are updated under a lock: parallel sessions share them.
"""
import fcntl, json, os, re, subprocess, sys, time
from contextlib import contextmanager


@contextmanager
def locked(path):
    with open(path + ".lock", "a") as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        yield

with open(os.environ["SUP_FAKE_ARGV"], "a") as fh:
    fh.write(json.dumps(sys.argv[1:]) + "\n")
if os.environ.get("SUP_FAKE_ENV"):
    with open(os.environ["SUP_FAKE_ENV"], "a") as fh:
        fh.write(json.dumps({k: os.environ.get(k) for k in ("BARO_PORT_BASE", "BARO_PORT_LAST")}) + "\n")
plan_path = os.environ["SUP_FAKE_PLAN"]
with locked(plan_path):
    with open(plan_path) as fh:
        plan = json.load(fh)
    step = plan.pop(0) if plan else {}
    with open(plan_path, "w") as fh:
        json.dump(plan, fh)

print(json.dumps({"type": "system", "subtype": "init"}), flush=True)
if step.get("child"):
    c = subprocess.Popen(["sleep", "60"])
    with open(os.environ["SUP_FAKE_CHILD"], "w") as fh:
        fh.write(str(c.pid))
t = time.time()
while time.time() - t < step.get("sleep", 0):
    print(json.dumps({"type": "assistant"}), flush=True)
    time.sleep(0.1)
time.sleep(step.get("silent", 0))
if step.get("advance"):
    prompt = sys.argv[sys.argv.index("-p") + 1] if "-p" in sys.argv else ""
    m = re.search(r"next step is (\w+) (\S+?):", prompt)
    if m:
        items_path = os.environ["SUP_FAKE_ITEMS"]
        with locked(items_path):
            with open(items_path) as fh:
                items = json.load(fh)
            nxt = {"EXECUTE": "pr", "REVIEW": "evaluated"}.get(m.group(1))
            if nxt and m.group(2) in items:
                items[m.group(2)] = nxt
            with open(items_path, "w") as fh:
                json.dump(items, fh)
if "world" in step:
    with open(os.environ["SUP_FAKE_WORLD"], "w") as fh:
        fh.write(step["world"])
res = step.get("result", "success")
if res is not None:
    print(json.dumps({"type": "result", "subtype": "success" if res == "success" else "error_during_execution",
                      "is_error": res != "success", "api_error_status": None if res == "success" else 529}), flush=True)
sys.exit(step.get("exit", 0))
