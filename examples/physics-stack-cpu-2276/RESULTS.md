---
work_id: physics-stack-cpu-2276
artifact_type: implementation-validation-result
status: bounded_component_pass_full_p4_open
owner_role: independent-physics-algorithm-work
source_request: qualify OS after-wait CPU collection without double counting
last_updated: 2026-11-04
---

# Actual synthetic OS CPU collection

Root directly invoked the reviewed collector under the heavy lane, with no
nested detached supervisor and PINS57cee80ebb4532b00c740b4245a268aa6b00171ebd2edbbfab66995aae068721:
PASS_SYNTHETIC_DARWIN_CPU_COLLECTION_COMPONENT, all7 groups PASS. Observed wall
before final receipt is0.695590834s; this is synthetic tool qualification,
not a physics benchmark or an old cost-gate retime.

| Actual workload | Complete child user/system CPU us | Execution |
| --- | --- | --- |
| Clean Python leaf | 25944 /15176 | CLEAN |
| Parent and reaped grandchild | 81054 /51753 | CLEAN |
| Node + joined Worker +3 Python leaves | 135644 /48498 | CLEAN |
| Expected leaf exit7 | 18005 /7216 | FAILED |
| Admitted no-descendant leaf, terminated timeout | 13434 /4607 | TIMEOUT |

Each value is ONE RUSAGE_CHILDREN delta after exact wait4/EOF. wait4 agrees
within the predeclared2us rounding crosscheck and is NOT added again. Worker CPU
is included in its one Node process. Execution failure and complete observed
CPU are separate: the known leaf timeout is not a successful workload.

Five metadata-only corrupted-closure controls all return CPUUNKNOWN/null from
an already measured clean receipt; no extra tree or deliberate orphan was made.
Overlap refuses before spawning. All source/tool/OS-file pins remain unchanged.
No unrelated process was inspected, reaped or signaled.

Collector SELF is a separate observed span,93471/26553us; it excludes startup,
group setup and final receipt encoding/writes and is not whole controller life.
Darwin RSS fields are bytes and descendant maxima, not simultaneous tree totals;
no RSS limit or DATA proof follows. Primary-source/OS semantics are linked in
SEMANTICS.md. Actual Physics calls0, whole64MiBBound/resourceQualification=false,
full1200 BLOCKED and API=false. Real composition CPU is the next separate gate.
