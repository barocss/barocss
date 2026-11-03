# Full Gram reference. Source contract, before execution

This folder owns one new finite full-frame validator. Root alone runs it.
The author may read data/specifications, write source, parse AST/JSON structure,
and hash files. Author numerical, helper, geometry, reference, candidate,
compiler, World and browser calls are zero. No candidate implementation is
read or imported. Old source, banks, failures, receipts and cost decisions stay
unchanged. No old V3 re-audit, corrected old memory PASS or retime follows.

## Input and result

Use the pinned Python with `-B`:

```
validator.py CASE FULLREQUEST FULLREPLY ACTUAL_KERNEL_REPLY FRESH_OUT
```

CASE is exactly one of ALIGNED-1, ALIGNED-16, OFFSET-1, OFFSET-16, YAW-1,
YAW-16. The complete campaign has six fresh candidate full-wrapper calls and
six immediate independent audits, in the frozen harness order. There is no
second candidate proof call. ACTUAL_KERNEL_REPLY is the actual in-call kernel
reply captured by the wrapper. The validator imports no candidate module and
does not call a candidate, new interval/root routine, cold QP or World.

Output protocol is `p4-full-gram-reference-v1`. Success status is
`EXECUTED_PASS_FULL_GRAM_REFERENCE`, `firstFailure:null`; failure status is
`EXECUTED_NO_GO_FULL_GRAM_REFERENCE`, with the first exception type/reason and
exit1. Both expose `caseId`, `WorldCalls:0`, `coldQpCalls:0`,
`candidateCallsByValidator:0`. Success exposes `audit` containing input pins,
mathematical census, full comparison census and memory reservations. A failed
case stops the parent campaign before a later candidate call. Source authoring
is not execution evidence or a cost decision.

## Two complete comparisons

First authenticate the actual FULLREQUEST bytes against the original bank's
canonical request pin, then decode that request exactly once. The saved
original request is not separately parsed. The old checker receives the same
authenticated request object through a transport adapter. Signed zeros,
strings including explicit n/d, row IDs and ordering are preserved.

Compare FULLREPLY to the immutable prior actual direct-grid full reply:
`physics-p4-radical-compact-harness-2276/evidence/full-b-01/full-bank/CASE-reply.json`.
This is the SAME V3 format. Every key, list element, exact string and numeric
Float64 word must agree. Numeric exceptions are zero; no subtree is omitted,
rewritten or normalized. Proof counters and endpoints are included. The
`sameV3Comparison` report has `allLeavesExact:true`, actual leaf counts,
`numericExceptions:0`, `normalization:false`, `subtreeExclusion:false`.
That immutable prior payload is a regression authority, not a newly generated
oracle. Its historical memory measurements remain revoked and its COST_NO_GO
remains unchanged.

Then independently verify the current reply against the immutable cold full
V2 authority, with the unchanged concrete V2-to-V3 map. The exact old
`geometry.py`, `intervals.py`, `comparison.py` files are copied byte-for-byte
into this folder; their support import resolves ONLY to this NEW adapter.
The old V3 validator/support are never imported. The map consumes exactly1447
explicit paths and descends72 certificate renames per case, with no wildcard,
normalization or subtree deletion. Every remaining physical/scalar/axis/tie/
selection/KKT leaf is compared exactly. Same-V3 comparison has no such map.

## Independent mathematics and qualified component reuse

The geometry component is pinned OLD `physics-p4-sat-2276/integer_sat.py`.
It uses actual represented PRE/HYP geometry and the old DIRECT cross/dot
`prepare`/`solve_model` path, not the new Gram factorization. It is isolated
from candidate modules. Quaternion/body decoding is qualified component reuse,
not a new independent native geometry oracle. The old direct axis/support
algorithm is distinct from the new pair-local Gram algebra; R1 has separately
qualified all signed27, Gram21, center6 and all15 N/D/S slots on its fixed bank.
This full validator does not imply new arbitrary-profile/overflow coverage.

The unchanged math code binds PRE/HYP117 raw Float64 values, one actual native
translation application, held body fields, static byte copy, addition
roundoff and all36 decoded row margins. Original pairs and all15 axes per
model are retained. No zero/near-parallel axis is pruned. Each frame verifies
72 records,432 saved physical words,144 convention problems and2160 axis
visits. The complete six-frame bank verifies432 records,2592 words,864 models
and12960 axis visits. The geometry Meter is fresh per audit with unchanged
2M integer operations/16384 bits. No old interval or square-root routine is
called.

For every raw/normalized margin N/(D sqrt(S)), exact minimal grid proof checks
q²D²S <= N²2^(2p) < (q+1)²D²S, equality width and negative sign reflection.
Zero/domain behavior remains fixed. Fraction arithmetic independently checks
clipping and absolute-difference intervals, including signed-square equality.
All six interval words are the immutable LITTLE-ENDIAN Float64 words. Strict
RNE cells, fixed precision table64,128,256,512,1024,2048, width1e-25 and
represented1e-12 physical gates remain unchanged. The exact maximum width is
derived from all72 records and compared to the metric.

The OLD independent position checker is imported from its pinned immutable
source. Its `check('kernel')` mathematical path remains unchanged. It verifies
all36 primal/dual rows,24 stationarity components,36 complementarity products,
objective, exact certificate strings, RNE and native observed gates, using
the original kernel request and ACTUAL_KERNEL_REPLY. No elimination/search or
cold solve is added. Full reference exact/represented fields, metrics and
proof counters are cross-bound to that actual in-call reply. The saved raw
dual payload must agree; dual uniqueness is not claimed. Positive masses and
exact all-row KKT establish the unique primal.

Only the old checker's I/O and memory admission entry points are adapted:
`read` returns already owned authenticated documents and pins; `allocation`
returns a conservative fixed8MiB input-data reservation. Its old64MiB input
gate is not used as new ownership evidence. The misleading old field
`explicitRetainedBytes` is removed from the helper result, replaced by
`kernelInputReservationBytes` and an explicit adapter label. No mathematical
function or old source file is modified. The runtime-layout metadata and
pinned52KiB Python binary check still run under the helper scratch reservation.

## Fixed ownership phases: same combined64MiB

The enclosing budget remains parent24MiB + this audit32MiB + outer
transport/encoding/hash8MiB =64MiB. The Node worker has exited before the audit.
No RSS, interpreter-code or native allocator measurement is claimed. The
qualified `physics-p4-owned-data-2276/owned.py` is source-pinned BEFORE import;
its actual seven-group selftest receipt is pinned. Its source is not changed.

Within the audit, qualified JsonBudget has a24MiB ceiling INCLUDING its shared
8MiB scratch, and a separate fixed8MiB non-JSON reservation completes32MiB.
All document raw allocations, lexical decode reservations and document slots
use qualified `read_json`: file2MiB, total actual input bytes16MiB, token100000,
depth64, integer lexeme16, float lexeme64, duplicate/nonfinite refusal. Raw
space is reserved BEFORE reading; decoded space BEFORE parsing. Files/tools
are hashed in64KiB chunks. Exact pins precede use. No Python digit/security
limit is raised.

Holding three full conservative JSON document ledgers is not assumed to fit.
Each document instead follows this PREDECLARED ownership-copy transfer:

1. Keep the original Doc reservation live. Qualified actual-reference walking
   proves its bytes/nodes. A separate walk measures already copied documents.
2. BEFORE copy, require existing copied bytes + complete source graph bytes +
   fixed4MiB generated-data bound <= the separate8MiB reservation. Refuse if it
   does not fit. Source unique nodes must be <=32768.
3. Copy only dictionaries/lists with memoized actual container references.
   Immutable JSON scalar leaves are retained by the copy. Same insertion/
   append order on the pinned runtime has no larger shallow container capacity
   than the source; explicit post-checks enforce that condition. The complete
   source graph size is the preallocated target bound, not an after-the-fact
   ledger reduction. The memo, recursion and capacity temporaries use the SAME
   scratch8MiB, exclusively. With <=32768 source nodes the memo has no more
   entries; conservative old+new dict-table and ID integer storage plus64
   recursion frames is below8MiB.
4. Independently walk the copy while the original Doc is still reserved and
   require copied bytes <= the predeclared source bound. Drop every original
   mutable alias by releasing Doc only after that copy owns the immutable
   leaves. No private slot edits, fake size or in-place ledger shrinking occur.
5. Store only the copied graph in the persistent registry. The prior actual
   V3 copy is compared first; delete its caller alias and registry owner BEFORE
   reading savedV2. The fixed non-JSON reservation is never released/shrunk.

Generated data has its own fixed4MiB share WITHIN non-JSON8MiB, reserved before
any geometry/helper call. Its closed population consists of9 prepared Boxes,
18 Basis records, at most180 basis/denominator integers of <=16384 bits;
18 restored body records; two15-axis report vectors;72 width Fractions; the
fixed1447-path comparison dictionaries/sets/strings; small KKT proof/counter
vectors, pin/controller metadata and phase measurements. Path strings are
bounded by the closed concrete map, not arbitrary input labels. Basis integer
storage is below0.5MiB at2212 bytes/int; the comparison path population and
container spare capacity are below2MiB; the remaining fixed retained vectors,
records and metadata are below1.5MiB. Any measured excess refuses.

The SAME scratch8MiB is mutually exclusive among JSON parsing, the qualified
walker, the ownership-copy memo, old KKT matrix/proof-vector work and direct
geometry/interval work. The old kernel helper receives already owned inputs,
so it allocates no duplicate JSON graph or dense solve. Its closed864 rational
matrix coefficients (numerator/denominator tuples in old Exact), all-row vectors, exact temporaries of8192 reduced/
16385 raw bits, runtime-layout metadata and binary authentication buffer fit
this8MiB working reservation. This includes complete matrix objects and
vectors, not merely Fraction integer internals. That fixed closed helper bound
is separate from the old checker's historical64MiB ceiling.

Qualified `owned_size` walks actual dictionary keys/values and Fraction
numerator/denominator references; temporary items tuples are never seen data
nodes. Its ID set/frame/iterator storage is prebounded and measured separately.
Explicit permitted plain records are Box, Basis, Margin, Meter, Comparison and
old Exact. Modules/functions/classes/paths are not silently traversed as data.
The final complete graph walk must be <= non-JSON8MiB. Report
`ownedDataMeasurement`, `explicitRetainedBytes`,
`observedRetainedPeakBytes` (actual complete PHASE checkpoints, including
source plus copied documents before original release; not continuous sampling),
`boundedPeakOwnedBytes` (qualified decode reservation peak + non-JSON8MiB),
`scratchReservedBytes:8388608`, `combinedAuditLimitBytes:33554432`,
`nonJSONReservationBytes:8388608`, `jsonBudgetIncludingSharedScratchBytes:25165824`,
and `walkerAndHelperScratchConcurrent:false`. These are new-source evidence
only. They do not restore old V3 revoked observed-memory metrics.

## Execution and claim boundary

Root's B6 campaign has one170s internal/180s external guard, file2MiB,
evidence16MiB, explicit combined64MiB. Each standalone validator also arms170s;
that does not create six extra campaign budgets. No tolerance, input, case,
operation price or precision retuning is permitted after a failure. All
source/tool/old-bank/prior-actual pins are sealed before the campaign. The
current R1 PASS is a prerequisite, not a full B or cost result. Root alone
records new B execution, first failure and the existing fixed cost decision.
No1200-step forecast, API adoption, native broad geometry qualification,
mobile, deployment or baseline/oracle regeneration follows from this source.
