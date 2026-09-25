#!/usr/bin/env python3
"""Stand-in for `claude -p` in test_supervise.py. Never talks to a model.

Each launch appends its argv to $SUP_FAKE_ARGV and pops one step from the JSON list in $SUP_FAKE_PLAN:
  world    name written to $SUP_FAKE_WORLD (the durable state the test observer derives from)
  sleep    seconds to run, printing a stream-json line every 0.1 s
  silent   seconds to run without output
  child    leave a grandchild `sleep 60` behind, pid written to $SUP_FAKE_CHILD
  result   "success" (default) | "error" | null (no result event)
  exit     exit code (default 0)
With $SUP_FAKE_ENV set, each launch also appends its cwd, $BARO_PORT_BASE and $BARO_SLOT there.
"""
import json, os, subprocess, sys, time

with open(os.environ["SUP_FAKE_ARGV"], "a") as fh:
    fh.write(json.dumps(sys.argv[1:]) + "\n")
if os.environ.get("SUP_FAKE_ENV"):   # lanes: where and with which port range each session ran
    with open(os.environ["SUP_FAKE_ENV"], "a") as fh:
        fh.write(json.dumps({"cwd": os.getcwd(), "port": os.environ.get("BARO_PORT_BASE"),
                             "slot": os.environ.get("BARO_SLOT")}) + "\n")
plan_path = os.environ["SUP_FAKE_PLAN"]
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
if "world" in step:
    with open(os.environ["SUP_FAKE_WORLD"], "w") as fh:
        fh.write(step["world"])
res = step.get("result", "success")
if res is not None:
    print(json.dumps({"type": "result", "subtype": "success" if res == "success" else "error_during_execution",
                      "is_error": res != "success", "api_error_status": None if res == "success" else 529}), flush=True)
sys.exit(step.get("exit", 0))
