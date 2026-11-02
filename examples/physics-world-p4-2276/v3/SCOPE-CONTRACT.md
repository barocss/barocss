---
work_id: physics-world-p4-accounting-cache-v3-2276
artifact_type: preimplementation-accounting-only-contract
status: awaiting_parent_freeze_no_implementation_no_execution
owner_role: independent-physics-algorithm-work
source_request: remove repeated ownership scans while retaining the qualified v2 mathematics and cache semantics
last_updated: 2026-11-02
---

# Scope and retained evidence

Parent base is9b16f1ab411cdcc95acb92bcb71b3c2d396df59a. All original, v1, v2
and P5 files stay unchanged. Only new v3 artifacts are owned here.
V2 passed24 SAT controls with494 original support attempts and six complete
CURRENT raw replies. Its CPU was1233559000ns versus885643000ns uncached:
COST_NO_GO. V1 and all old first failures/sign UNKNOWN states remain intact.
No cache is adopted. No original World, production, fixture, Node projection,
trig seed, new dependency or release is admitted.

Recorded v2 key CPU totals99714000ns. Removing it all would still leave
248202000ns regression. V2 source and recorded misses imply at least32368
main-path ownership scans, each with about54 sizeof calls. Their actual CPU
share is unmeasured. Replacing those scans is a bounded hypothesis, not a claim
that it closes347916000ns or makes the original8-box/full1200-step run fit180s.

# Exact transfer boundary

Change ownership bookkeeping only. Keep v2 complete invariant-key encoding,
including its existing key-version bytes, argument eligibility, Context
settings/traps/entry flags, signed-zero/exponent representations and original
function/source identity. Keep per-stage ordinal/incoming-mask selection,
complete postflag replay, all Context/code checks, logical counters, original
call order, pending commit/discard, same-object exception propagation and
pointer/scope restoration. No new result cache or cache granularity is added.

Retain ORIGINAL SAT/support callables and code objects. No SAT/QP expression,
geometry formula, report row, normalization, physical tolerance, precision or
solver bound changes. The new source transfer audit permits only ledger
initialization/reset, size accounting, resource predicates, accounting stats
and full-audit hooks at the old bookkeeping sites. Encoding/arithmetic and
control-flow outside those sites must match the frozen v2 source. Stable
test-only forwarding observers add no mathematical call.

# Fixed 256KiB bookkeeping upper bound

The total cache ceiling remains67108864bytes. B is exactly262144bytes, reserved
INSIDE that ceiling, not an extra allowance. B is an upper bound, not actual
allocated memory or a tuning parameter. Use these fixed sub-reservations:

| Component | Bytes |
|---|---:|
| self, attribute/bounds/counter dictionaries, fixed metadata/methods, ledger structure | 65536 |
| at most128 mutable integer slots, at most128 measured bytes per slot | 16384 |
| one active scope/settings skeleton and bounded stage temporaries | 65536 |
| full-audit scratch with fixed nesting and O(1) storage | 65536 |
| remaining conservative bookkeeping/growth margin | 49152 |

Before mathematical calls, measure the actual fixed structures and supported
runtime integer sizes. Verify every sub-reservation. All new private ledger,
audit and metadata objects belong in this inventory. No hidden size/id memo,
unbounded scratch list, recursive retained graph copy or unused global cache
is allowed. A new field must fit the frozen inventory, not increase B.

Maintain an explicit inventory of all mutable integer slots. Logical counts
are bounded by288 SAT attempts,8640 support calls,288 pairs,8192 stage variants,
30 ordinals and512 masks. Resource/byte fields cannot exceed the frozen byte
ceilings on a successful path. Timer accumulators cannot exceed180000000000ns;
the170s internal/180s outer guard still applies. Reject an exceeded magnitude
as a resource failure. Verify native integer representation sizes at the
allowed maxima and at full audits; never assume one machine-word integer.
The supported runtime/provider executable is pinned in execution receipts.

The private dictionary shapes and immutable fixed objects are fixed after
construction. Their cached reservation covers all replacements of bounded
integer values. Container capacity changes are variable ledger components,
not an assumed fixed-size property. Constructor/full audits verify the shape
and slot inventory. Unsupported storage/runtime behavior fails before math.

# Incremental variable ledger and allocation checks

Maintain retained payload bytes and pending payload bytes as in v2. Include
all pair keys, pair records, stage-token integers, entry/result/postflag tuple
objects and Decimal coefficient storage, using actual sizeof at creation.
Also maintain actual committed pair/stage dictionary capacities, actual pending
dictionary capacity and active encoded-key allocation. A scope key equal to a
retained key can still be a second live object and must be covered.

At every old accounting check use:

`U = B + retained payload/containers + pending payload/container + active key`.

Before inserting anything, require U plus the same conservative payload and
dictionary-growth reservation to fit67108864bytes. Pending and retained
containers can resize independently; reserve both when needed. After insertion,
measure only changed container capacities, update the ledger immediately and
check U again. Do not defer a failed resource check until request end.

At commit, cover both pending and retained references/payloads until scope
release. Conservative duplicate counting is allowed; subtraction before actual
release is not. Failed original SAT calls discard pending objects, without
touching retained entries or flags. Normal capacity shortage calls original
once without storing; no eviction, retry, increased bound or second solver.
The bookkeeping reserve can cause an earlier unstored bypass near capacity;
the actual64MiB ceiling and original arithmetic fallback remain unchanged.

Keep the v2 temporary-key bound BEFORE as_tuple/bytes materialization. Add it
to U and require the same64MiB ceiling. B covers only its listed small fixed
scratch; it does not hide variable digit tuples or encoded-key buffers.
Any extra temporary introduced by the new implementation must have a frozen
preallocation bound or fit the explicit B component before it is created.

# Full allocation audits and honest labels

Perform a full explicit sizeof allocation sum at cache start and request end,
before clear, and before/after each existing primitive case. It must include
all private fixed, ledger, retained and pending objects. Walk the bounded
pair/stage structure with fixed-depth O(1) scratch, without a seen/id set or
full snapshot of entries. Shared immutable objects may be counted more than
once; provider/caller objects that are excluded must be listed explicitly.
No owned object may be omitted merely because it also appears in a ledger.
In controls only, also audit immediately after each pending insertion/commit
and before scope release, so live pending storage is checked independently.
These hooks add no mathematical call. The six timed full requests use the
maintained guard at every mutation and full walks only at start/end.

Verify measured fixed bookkeeping fits B, measured allocation sum is at most U,
and U is at most67108864bytes. Verify incremental key/pair/stage/container totals
against an independently walked total. Audit objects and loop temporaries
also fit B's audit/scope/integer components. Stop on any undercount, shape,
integer-size, ledger or resource mismatch. No adjustment after a failed audit.

Report separately `ownedUpperBoundBytes`, `peakOwnedUpperBoundBytes`,
`measuredAllocationSumBytes` and `fixedBookkeepingMeasuredBytes`. The measured
sum is a sum of actual sizeof observations with possible shared-object
overcount; it is NOT unique actual heap use, process RSS or a conservative
upper bound masquerading as an actual measurement. Any legacy owned-byte
field must explicitly identify its upper-bound meaning. Record B and all
ledger deltas and actual mathematical counters. A final clear releases all
entries and resets per-request counters; external actual-call totals survive.

# Fixed control and six-call population

CONTROL-RECIPES.json retains v2's exact literal fixtures, Context templates,
normalization, case order, reset/capacity/exception rules and12 paired cases.
Run each original baseline and candidate once:24 SAT attempts, at most720
original support attempts. Expected494 helper attempts and52 candidate hits
must be checked anew; previous receipts are not new-provider qualification.
Additional full size/ledger audits use DATA only at those existing checkpoints
and add0 SAT, support, evaluate, QP or World calls.

Authenticate all12 original providers, complete archives/raw inputs, v1/v2
results and immutable source pins before mathematics. Freeze these exact
recipes before implementation; parent freezes effective new sources before
execution. Keep complete signed Decimal/IEEE representations, original
exception object/flags, caller immutability and original report comparisons.
Assert stage/helper/traversal/key semantics match v2; only storage accounting
values/metadata may differ. Resource controls still use the same one-pair
bound and original unstored fallback.

Only if controls PASS, make exactly6 fresh candidate evaluate calls on the same
captured ALIGNED/OFFSET/YAW1/16 stdin. CURRENT raw authority is unchanged: original
cost-census A1 plus observable-census other five. Compare COMPLETE raw bytes,
IEEE bits including -0, strings, rows, certificates, classifications, counters
and caller state. No new uncached full run, fixture or DTO reconstruction.
Full study total38 becomes44 at full reach. Report24 SAT controls separately.

NUMERIC_EQ_PASS requires all controls and six raw comparisons. COST_GO additionally
requires six unprofiled candidate CPU samples, including setup, bookkeeping,
final full audits, stats, restoration and clear, to sum strictly below885643000ns.
Use original uncached authority, never slower v1/v2. Record all regressions;
the old/fresh pairing is not a randomized benchmark or per-frame guarantee.
A third COST_NO_GO ends this specific support-radius cache slice. No extra
profiling, repeated failed prefix, codec tuning, bound change or trajectory
expansion follows under this scope.

Keep170s internal,180s outer owned-process-group guard, at most4s cleanup and
32MiB evidence per fresh run. Stop first mismatch/unknown/resource/source failure.
Preserve reached counts and evidence. Only these two documents are authorized
now; implementation and numerical execution remain NOT_STARTED pending parent
freeze and later explicit run authorization. No activation or deployment.
