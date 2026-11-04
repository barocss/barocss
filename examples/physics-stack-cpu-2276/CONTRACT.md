# Synthetic Darwin CPU collection prerequisite

Status: SOURCE_ONLY_NOT_EXECUTED. Root alone imports/runs these sources. Own
only this NEW folder. No real physics/reference/candidate, old benchmark retime,
dependency, executable download, subreaper or process/security setting change.

## Exact guard and accounting boundary

Mode is DIRECT_ONE_COLLECTOR_OWNED_GROUP180S. Root invokes selftest.py DIRECTLY
under the heavy lane, WITHOUT command-run.mjs or another detached guard. Before
any child starts, the fresh collector joins its own PID-named process group
with setpgid(0,0) if it is not already that group's leader. The SAME collector
owns one180s alarm and final whole-group kill on an incomplete actual tree.
No new child supervisor, session, detached spawn or nested guard is created.
Every Python/Node process inherits that group. Local timeout
signals target only this collector's exact registered child PID. Never inspect,
reap or signal unrelated PIDs; no waitpid(-1), pkill or process-name scan.

The planned synthetic tree is owner Python -> ONE Node process -> THREE
Python leaves, with ONE producer Worker thread inside the Node process. The
thread is recorded/joined but is not a second process or CPU charge. Other
fixed cases use one Python leaf or one Python parent that waits one grandchild.
No test intentionally kills an intermediate parent with a live descendant.

Only one case may be active in a given Python owner. Snapshot OS
RUSAGE_CHILDREN immediately before its registered direct child starts, then
ONCE after exact wait4 and complete pipe close. Descendant closure additionally
requires the pinned parent's complete child/thread wait receipt. The resulting
aggregate user+system delta is the CPU authority. The wait4 rusage is an
independent OS cross-check, not another amount to add. No overlapping per-child
delta sums, handler self-times, thread CPU sums, startup subtraction or hidden
child exclusion. Darwin roll-up semantics are documented in SEMANTICS.md.

Report owner RUSAGE_SELF over the observed controller span separately. Its
start follows group/output setup and precedes pin authentication; its end
precedes final receipt encoding and writes. Interpreter/stdlib startup, group
setup and final receipt work are excluded from that SELF span. Do not
call that span complete controller lifetime or add it to an already inclusive
ancestor receipt. OS ru_maxrss is reported in Darwin BYTES, separately for
SELF and CHILDREN; the children field is a maximum across credited processes,
not simultaneous tree RSS or a sum. No new RSS limit or64MiB proof is created.

Incomplete reap, nonmonotonic/mismatched OS usage, missing/invalid descendant
closure, ignored SIGCHLD or unavailable receipt gives CPUUNKNOWN with
completeChildCpuUs=null. Raw reached OS observations may remain as diagnostics;
they are never0 or a qualified aggregate. Execution failure and CPU closure are
separate: a known leaf killed AFTER its no-descendant identity is admitted can
still have complete OS CPU, but is not a successful workload.

## Fixed seven groups

G1: one clean Python leaf,20ms target process CPU spin; exit0, EOF, exact PID/
PPID/group, positive OS CPU, direct wait4 and once-only RUSAGE delta agree.

G2: one Python intermediate starts one80ms target CPU grandchild and collects
it with exact wait4 before exiting. Root's child aggregate must include the
grandchild OS wait4 CPU, and Root's direct wait4 must match Root's aggregate.
The intermediate SELF snapshot is diagnostic only. Parent/child PIDs differ;
both group and PPID links are verified. No child claimed handler time is used.

G3: one Node coordinator and one joined Worker thread20ms wall-spin target,
three Python leaves10ms process-CPU target each, plus5ms Node main wall spin.
Root verifies one Node PID, one Worker with SAME PID/nonzero threadId/exit0,
all THREE registered Python roles and their inherited group/PPID/clean close,
complete Node exit/EOF/reap, and matching Root wait4/aggregate CPU. All startup,
thread/runtime work, IO and Node/Python shutdown are included in OS CPU.

G4: one known Python leaf with5ms target CPU exits7. Expected
CPU_COMPLETE with execution=FAILED; actual CPU remains positive, full wait metadata
retained, no fake successful workload or zero CPU.

G5: one known Python leaf announces its identity/no-descendant role, then waits
on its bounded open stdin. At150ms AFTER identity admission, owner sends SIGTERM, escalating only
if necessary, closes pipes and exact-waits it. Expected CPU_COMPLETE with execution=TIMEOUT
ONLY if known leaf identity, EOF and reap close; otherwise CPUUNKNOWN. This
does not exercise killing a parent with children or grant that route closure.

G6: pure bounded classification faults from G3's ALREADY observed receipt:
missing final closure, unreaped descendant, unjoined thread, killed parent with
missing closure, and absent wait4/reap. Every variant must give CPUUNKNOWN/null,
not a CPU PASS. No second tree, replayed CPU workload, fabricated OS observation
or actual orphan is created. Raw G3 observations stay unchanged.

G7: reject overlapping collection before spawn; require the one owned-group mode
and normal SIGCHLD semantics; verify the controller SELF span and Darwin RSS
labels stay separate. Unknown/missing fields fail closed. Finish with exact
source/tool/system/guard pin equality. No full controller-lifetime claim.

Target synthetic spin sum is135ms process CPU plus25ms Node wall spin; process
startup/OS scheduling is separately observed, so total CPU<1s is desired, not
a timing acceptance threshold. Fixed cases execute once, stop first unexpected
failure, no retry or baseline. The same collector owns inner170s checks and
one outer180s group alarm. Per case direct-child deadline<=5s, kill grace200ms, final reap/
drain<=2s. Stdout<=16KiB, stderr<=4KiB, read chunks<=4KiB, report<=2MiB,
component evidence<=16MiB. All metadata and captured outputs are bounded.

Root DIRECT command under the heavy lane, fresh ID/output; do not wrap another guard:

    pinned-python -B examples/physics-stack-cpu-2276/selftest.py NEW_OUT PINS_SHA

Authenticate the supplied PINS SHA, Python/framework/Node, source, installed
OS metadata and Apple SDK man/header files before target imports and again
before PASS. No executable is downloaded. Source-author calls: AST/hash/read
only; target imports/math/tests0. Root execution remains NOT_RUN.

Possible final success is PASS_SYNTHETIC_DARWIN_CPU_COLLECTION_COMPONENT.
Always keep full1200=BLOCKED, resourceQualification=false, whole64MiBBound=false,
API=false and actualPhysicsCalls=0. This component is not a prefix numerical
run, production pipeline adoption, mobile test, deployment or HOLD restart.
