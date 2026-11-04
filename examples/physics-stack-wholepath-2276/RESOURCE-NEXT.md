# Next complete-path resource gate

Status: READ_ONLY_SOURCE_REVIEW_NOT_EXECUTED. Only this document is authored.
The complete64MiB explicit owned-DATA bound is NOT_QUALIFIED. Full1200 remains
BLOCKED. No arithmetic variant, old cost retime, resource cap or RSS limit is
introduced. Live packet parity and make-repetition evidence do not close this
resource gap.

## Reuse the qualified code within its actual scope

The actual `physics-p4-owned-data-2276/evidence/selftest-01/summary.json` reports
PASS_OWNED_DATA_SEVEN_PURE_DATA_GROUPS. It verifies7324 registered objects and
554644 owned bytes, including Fraction integers, aliases and a cycle. It is a
pure-data helper qualification, not a complete-reference allocation proof.

| Reusable code | Exact useful boundary | What it does not prove |
| --- | --- | --- |
| `owned.py:runtime_guard` | Exact CPython3.13.5,64-bit pointers and fixed list/int layout | V8 or Decimal layout |
| `owned.py:owned_size` / `_owned_size` | Closed retained graph; direct dict keys/values; actual Fraction numerator/denominator references; identity deduplication; bounded seen-set growth/worklist/iterator AUX | In-flight function locals or arbitrary module closure discovery |
| `owned.py:JsonBudget`, `read_json` | Fixed retained-document slots, immutable regular file<=2MiB, pre-read/pre-decode reservations, bounded64KiB hashing, explicit alias-release duty | Live pipe reading, original reference main's own `json.loads`, or result generation |
| `JsonBudget.walk_phase`, `kernel_helper_phase` | Mutually exclusive use of the SAME8MiB scratch inside the32MiB helper ceiling | An automatically discovered old-kernel working bound |
| `integer-witness-harness-2276/node_bridge.py:cpu_snapshot`, `NativeWorker.close` | OS RUSAGE_CHILDREN delta only AFTER actual close/wait; complete lifetime CPU of its one known owned leaf Node | Concurrent multi-child ownership, Node grandchildren, or whole-tree RSS |
| `integer-witness-2276/ALLOCATION.md` | Pattern for fixed populations, prebounds, explicit wire copies and bounded serializer fragments | Transfer of its32MiB proof population or2368B rational-pair charge to the current producer |

Keep these frozen files unchanged. The old24MiB parent +32MiB proof/audit +8MiB
transport partition describes ONE proof/audit child and disjoint audit phases.
It is not a permit for32MiB per reference worker. The corrected helper itself
also caps data+AUX at32MiB and AUX at8MiB; callers may tighten, not raise, these
caps. Helper/controller/walker storage is owned DATA, not free instrumentation.

## Smallest useful accounting interface

Use a NEW fixed-slot reservation ledger, not a heap profiler. Its complete
interface can be `reserve(slot, bytes)`, `release(slot)` and `snapshot()`. Freeze
slot names, allowed phase transitions and per-slot bounds before allocation.
The aggregate is the SUM of all simultaneously live reservations across
processes and must be<=67108864 bytes. A reservation is not an observation.
Report observed closed graphs and declared transient bounds separately.

Assign each process one fixed credit up front; it may subdivide that credit
locally but cannot borrow another process's scratch while that process can
still use it. Avoid per-allocation cross-process RPC. Unknown bounds refuse
admission. Do not choose convenient per-process numbers until the populations
below have a source-reviewed upper bound. There is no sound numerical split
available from the current receipts.

The coordinator keeps the global fixed ledger and three step credits. Each
step credit remains charged during engine work, serialized transfer, proof,
out-of-order replies AND pending archive. Returning a proof or writing part of
a gzip stream does not release it. Local worker ledgers must be checked before
read/decode/operator allocation; a later telemetry message cannot prevent an
earlier over-allocation.

## Required roots and lifetimes

| Owner | Strong roots that must be covered simultaneously |
| --- | --- |
| Node producer | Current speculative Body graph; actual prepare input; `before` clone; actual prepared result; live StrictLineContext box/normal/direction/last-midpoint rationals; normal/position solver matrices, histories and diagnostic graphs; detachment graph admission/walk tables; V8 source and detached graphs plus serialized backing while they coexist; last candidate retained for next prepare |
| Node coordinator | Initial state/config and actual frame960; contiguous accepted state; THREE uncommitted step slots including producer-in-progress; each detached packet and body alias; all normal/geometry/position/ledger/quality reports; pending request/reply graphs; current complete archive record; failure/reached packet; metadata, source pins, control/credit maps and accounting AUX |
| Each position worker, counted twice | Actual input line, decoder text/tree and full request; raw-body copies; outer decoded model; PRE and HYP records; cold `F.solve_exact` model; active LP/QP locals; result/comparison/published exact strings; ledger locals; prepared wrapper `Scope.bodies/bases/tokens/pair/stats`, actual Token slot referents, Decimal context keys/flags; response and encoder chunks |
| Geometry worker | Input/decoder/request; initial/current/frame960 quality states; contact rows and witnesses at BOTH80/120 precisions; decoded boxes/bases/Decimal vectors; quality pairs/metrics; output and encoder chunks; retained helper constant DATA |
| Every process | Bounded stdin/stdout/stderr buffers, outstanding write callbacks/promises, source/control metadata, last error/traceback if retained, timer closures holding packets, and the ledger/walker/controller itself |
| Archive owner | Full record object; UTF16/string fragments and UTF8 line;936-byte frame buffers and `Buffer.concat` result; original physical wire bytes; gzip input/output chunks, pending writes, dictionary/workspace, hashes and decompressed-recovery scratch when used |

Within ONE process, actual shared objects/backing stores count once by identity,
with every root exposed to the same traversal. Across processes, serialized/
decoded copies are separate ownership. `Buffer.subarray` is not a release:
count its entire retained ArrayBuffer backing once, plus the view. A missing
root cannot be excused by matching a serialized packet hash. Before releasing a
document/slot, clear all packet/currentAttempt/callback/response aliases; the
qualified JsonDocument.release API explicitly cannot detect those aliases.

Module/function/code objects and interpreter/JIT/GC/allocator machinery are
outside the existing explicit-DATA definition. DATA referenced by a module,
closure or function default is still DATA. Include the referenced constants,
mutable tables and request state through an explicit data-root inventory;
do not pass a module to a walker and treat its refusal as permission to skip
its data. Count each imported module instance's owned DATA; do not deduplicate
separate F/NINE/PARENT instances without actual shared identity. V8 heapUsed,
CPython allocator capacity and RSS are separate observations, not substitutes
for these roots. Native location alone does not exempt payload or copies.

## Four missing pieces prevent a64MiB claim

1. **Decimal and slot records.** The qualified helper explicitly rejects
   Decimal and slots classes. The prepared `Token` has slots
   `serial/quaternion/norm`; Scope owns dictionaries containing Decimal values.
   Whitelisting Scope's ordinary dictionary alone does not cover those tokens,
   bound-method owner links or numerical leaves. A NEW exact-type adapter is
   required. It must not execute arbitrary subject properties or silently
   treat all native objects as zero. For Decimal, establish whether the PINNED
   C implementation's size report includes coefficient allocation, and bound
   operator/native scratch separately. `as_tuple()` itself allocates digits;
   using it requires a prior reservation and does not establish native scratch.
2. **Cold reference working storage.** A post-return graph cannot observe
   `full-pair-reference.py:phase_one`'s `source`, old `table`, `pivot_row` and
   `new_table` coexisting. `phase_two` retains model/block/rhs while `eliminate`
   copies another augmented `work` matrix. `rank`, margins, certificates,
   comprehension temporaries and `stationary_seen` also need closed population
   bounds. Fraction retained numerator/denominator storage is supported, but
   arithmetic GCD/division/product temporaries are not captured by a retained
   graph walk. Existing8192/16385-bit arithmetic guards bound integer size,
   not the total number simultaneously alive. Decimal SAT scratch has the
   same problem. `kernel_helper_phase(unknown)` supplies no proof.
3. **Node producer liveness.** There is no qualified V8 owned-graph observer
   for this producer. The old proof's fixed BigInt/rational populations are a
   different algorithm. Current strict-line rational components can each be
   checked up to16384 bits; the old2368B two8192-bit charge is not transferable.
   Current multiply/checked guards inspect a raw product AFTER construction,
   so its refused transient can exceed the admitted bit cap. Size every live
   operand/result/text temporary from the actual operation and count it before
   the next operator. The make census gives call/repetition counts, not maximum
   live rationals or an allocation bound. A bounded returned V8 packet does not
   bound internal strict-line or position-solver workspace.
4. **Transport/compression coexistence.** Existing IO uses full stringify,
   Buffer conversion/concatenation and gzipSync. A2MiB wire cap alone does not
   cover original graph + detached graph + wire + decoded graph + UTF16/UTF8
   encodings + all reply/record/gzip copies across three pending steps. The old
   file decoder does not guard the original CLIs' live parser. Streaming gzip
   still has native dictionary/workspace and pending buffers requiring explicit
   parameter-based bounds. If those premises are unavailable, report unknown;
   do not classify all zlib operation storage as free runtime overhead.

Do not repair these gaps with heap samples, forced GC, a successful16-step
peak, one oversized scratch guess, or ignored unsupported types. Samples can
locate roots but cannot prove transient admission. Retained errors/tracebacks
can keep a whole failed frame alive; a failed phase is an abort boundary.

## Whole owned CPU: reuse the mechanism, fix the owner

The smallest clean new collector is one Python OS-resource owner with a CLOSED
direct-child inventory: Node producer, Node coordinator, geometry Python and
two position Pythons. Create/pin all pipes before launch and pass the required
FDs to the Node coordinator; it does not spawn hidden children. All children
inherit the same owned group. This adds transport adapters, not reference math
or a new mixed router. If producer/coordinator are one process in a later
design, enumerate that smaller tree explicitly rather than pretending two
process copies share memory.

Reuse `cpu_snapshot()` immediately before starting this fixed child set and
after ALL five have closed/waited, including kills, residual pipe drain and
failed cleanup. In a fresh collector with no unrelated children, the delta
is the authoritative aggregate complete-lifetime child user+system CPU. Do
not apply overlapping before/after RUSAGE_CHILDREN deltas independently to
concurrent children: they would count one another. Per-child attribution,
if required, needs exact wait4(pid) records and a collector that does not reap
that PID elsewhere. Missing reap invalidates complete CPU accounting.

Account the Python collector itself as well. Its self process-time span is a
separate controller observation, not automatically its whole lifetime. A
reviewed external parent must obtain its OS after-wait usage before claiming
complete controller CPU; explicitly verify the platform's descendant-inclusion
semantics to avoid adding the same five children twice. Until this is checked,
claim COMPLETE_CHILD_SET_CPU only, not whole-owned CPU. Do not substitute the
reference's per-handler timing sidecar or Node process.cpuUsage for child CPU.

Record RSS separately with actual units/method. RUSAGE_CHILDREN.ru_maxrss is
not a sum of simultaneous process RSS. No new RSS pass/fail limit is selected.

## Concrete next tiny qualification

Do NOT start another physics campaign to guess these limits. Author a new
data-only component contract, preserving owned.py and its seven-group receipt.
The narrow first target is **exact-type retained roots plus fixed reservations**:

1. Reuse the original walker unchanged for supported closed graphs. In a NEW
   helper, add only an exact Decimal leaf policy and one explicitly identified
   native-slots Token policy, with the original key/value, Fraction, seen-growth
   and AUX rules retained. This is new qualification, not inherited PASS.
   Before implementation, freeze pinned Decimal size/layout premises; if they
   cannot be established, expected result is UNSUPPORTED/UNKNOWN and stop.
2. Construct a small independent flat register-on-construction fixture with
   signed-zero/finite Decimal values, differing bounded coefficient lengths,
   shared Decimal aliases, Fraction integer aliases and exact Token slot links.
   Register actual object/slot referents explicitly; do not use the candidate
   traversal to create its own expected graph. Verify exact IDs/owned charges,
   below/at/above data+AUX bounds, missing slot, unknown subclass and forbidden
   getter rejection. Test source/hash/runtime pins and no retained subject
   mutation. This gate contains no physics, cold solve, SAT, World or baseline.
3. Give the NEW fixed ledger five synthetic owners and three step slots. Use
   registered bytearrays/strings/views to exercise simultaneous source/wire/
   decoded/reply/archive copies, shared backing, abort retention and exact
   release order. Refuse one byte over the GLOBAL cap before allocation. Do
   not credit a release with a live external alias. This qualifies accounting
   transitions only; it supplies no real producer/reference population bound.
4. Separately qualify the after-wait collector with fixed bounded synthetic
   leaf processes: normal EOF, one killed worker and missing reap. Check PID
   ownership and exact once-only collection; use OS usage, not worker claimed
   time. Freeze descendant inclusion/controller semantics before integration.

These small gates may share one new source package but keep their results
separate. Do not rerun the already passed seven-group legacy campaign as a
replacement receipt or reopen an ended cost candidate. Keep170s/180s,2MiB
reports and16MiB component evidence; Root alone executes after source freeze.

After these components pass, the next source task is a CLOSED liveness table
for one original position-world request and one producer prepare, including
the simultaneous populations named above. Then select per-process credits
whose complete aggregate fits the unchanged64MiB and guard allocations BEFORE
the original numerical operations. That guard/adapter is a new behavior path
and needs frozen refusal/parity tests. Without those tables, even successful
synthetic qualification leaves composed64MiB and full1200 BLOCKED.

No source claim here grants exact arithmetic execution, a cache, API activation,
mobile testing, deployment or HOLD restart.
