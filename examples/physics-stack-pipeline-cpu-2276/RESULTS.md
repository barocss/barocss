---
work_id: physics-stack-pipeline-cpu-2276
artifact_type: implementation-validation-result
status: real_prefix_cpu_complete_original_full_run_open
owner_role: independent-physics-algorithm-work
source_request: measure actual bounded Physics composition cost
last_updated: 2026-11-04
---

# Actual real composition CPU

Root directly executed the reviewed owner once with PINS1c7de45057a200997f48f8f05cf14ae4665279844fb9cea2af414bdb1c9c5bbb:

```sh
$PYTHON -B examples/physics-stack-pipeline-cpu-2276/collect-real.py \
  examples/physics-stack-pipeline-cpu-2276/evidence/prefix-01 \
  1c7de45057a200997f48f8f05cf14ae4665279844fb9cea2af414bdb1c9c5bbb
```

Actual status **CPU_COMPLETE_REAL_PREFIX**. All48 steps pass original independent
normal KKT, strict contact, all36-row position, ledger and quality checks, with
all195 original wire pairs and425916 complete-record numeric words/raw bytes
exact. All four operation counts match:48/48/48/51, no shadow pass. The producer
Worker and all3 Python references close cleanly; source hashes remain exact.
The prior18-control PASS is reused with its exact source seal; no extra test
process or numerical baseline is retimed.

Observed whole owner span before final receipt:9.265764666954055s.
Complete ONE Node subtree lifetime CPU, including its Worker and waited Python
children: user21.301446s +system0.365372s. OS wait4 matches the single after-wait
RUSAGE_CHILDREN delta; it is not added a second time. Parent controller SELF is
separate, user0.098934s +system0.023456s over its declared partial span. Startup,
group setup and final controller receipt work are not included in that SELF
span, so total whole controller lifetime is not claimed.

The OS wait4 maxrss observation is237879296 bytes for its credited subtree
maximum. This is not a simultaneous process-tree total, a Node-only attribution,
a new RSS limit or a64MiB retained-DATA proof. No speed ratio, old799ms gate
reopening or1200 completion forecast follows from these measurements.

This qualifies actual prefix CPU collection under the closed-tree/source
premises. Original complete1200/8–10s observer, new lossless full archive,
World/API/recorder integration and desktop remain pending. Older strict64MiB
proof/cache profiles retain their original scopes and NO_GOs; their unknown
memory result is not converted to a pass. See ENVELOPE-PREMISES.md for the
explicit original-exit scope correction. No deployment, mobile or HOLD restart.
