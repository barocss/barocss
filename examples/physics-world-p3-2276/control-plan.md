---
work_id: physics-world-p3-2276
artifact_type: frozen-bounded-controls-plan
status: authored_not_run
owner_role: independent-physics-algorithm-review
source_request: preserve the global call ceilings and all selected controls with current P0 APIs
last_updated: 2026-11-02
---

# Call population

Parent selected reuse of the SOURCE and compiled RENAME first-step Worlds for
the new-profile S1 controls. The rename is the already selected identity map.
Physical values, directed A/B roles, clock, laws and all gates remain fixed.
Commands, query expectations and known ID-bearing errors use that same map.
There is no new constructor for these two control populations.

The observed SOURCE variants and RENAME recovery use
`compareVariantObservedStep`. It preserves the actual32 contact records in
their observed order, their signed-zero pointers and all contact-position
F64LE bytes. It maps declared directed A/B bodies by their original Z0/Z1
rest roles. For actual null hits only, it swaps endpoint IDs/position arrays
and changes traversal indices/order to match the corresponding original
physical-role records. It changes no number, hit, geometry or arithmetic.
Every actual-to-original ordinal and endpoint swap is recorded. The unchanged
`compareOriginalStep` then requires all six phase raw frames, full actual
projection rows/certificates, public before/after, reports, corrections, caps
and mapped contact sequence to match exactly. Certificate reuse retains the
original direct-six-phase mode and authenticated original reply locator.

Uninstrumented repeat/compiled variants retain public-output parity against
the qualified SOURCE authority and explicitly report phasesObserved=false.
The identity/order mapping does not create a new contact or connected model.

| Population | Constructors | World attempts |
|---|---:|---:|
| Completed current-public source/emitted admission baselines | 2 | 0 |
| Original main: source, repeat, compiled | 3 | 3600 |
| RENAME/PERMUTE first steps in three graphs | 6 | 6 |
| Six legacy cases, baseline + candidate, source + compiled | 24 | 524 |
| Duplicate-B/shared-A constructor negatives, source + compiled | 4 | 0 |
| Axis/limit/anchor/sparse-anchor negatives, source + compiled | 8 | 0 |
| Reused RENAME S1: 23 refusals + recovery + disposed step, two graphs | 0 | 50 |
| Maximum total | **47** | **4180** |

The frozen World attempt ceiling is 4182. Reusing the variant setup removes
two duplicated setup attempts. Do not spend this unused margin on new cases.
Query calls are 9 per reused World, 18 total. Explicit disposal is twice per
reused World, 4 total. Normal cleanup is main3 + legacy24 + other variants4 =31;
normal total dispose calls are35. Reused Worlds end through explicit disposal.
Record actual attempts, accepts, refusals, queries, getters and cleanup. Never
fill a shortened prefix from these maxima.

Cap controls retain four single-vector cases and two ordered-array cases per
graph:12 entry cases total. Those cases make14 actual scalar guard leaf calls
at full reach:4 singles +1 first-failing ordered array +2 second-failing ordered
array per graph. These are separate counters. No World, projection or solve is
used by these guards. Parent must freeze this distinction before execution.

# Legacy comparison

Use the immutable current P0 baseline at `2e270d3b` and the staged candidate
with the same `PhysicsModel`, `WorldOptions`, `step(commands)` and query APIs.
This is implementation compatibility, not an independent physical oracle.
Compare every returned state/raw number bit and each known error code/message.
Provider digest is provenance and differs between graphs; other public identity
fields remain compared. Each error must belong to its own factory's error class.

The six selected recipes remain LC122, LO2, LDF2, LSF2, LSH2 and LKF1 attempts
per factory, at most131. LC must accept121 and refuse122 at its original cap.
LDF preserves an actual earlier typed refusal and stops both matching prefixes;
it does not preclaim a successful physical return. No broad old probe is run.

# P0 refusal adaptations

There are still12 per-pair domain refusals,8 structural/precedence submissions
and3 ordinary-accessor submissions per reused S1 World. Parent approved these
API adaptations before execution:

- The old invalid-dt submission becomes `step(1/100)`. P0 has no dt argument.
  Expected INVALID_COMMAND is `commands must be a dense array of at most 64`.
- `step(null)` uses the same dense-command error. Sparse command arrays fail
  earlier during inert copying: `arrays must be dense ordinary data arrays`.
- A NaN component fails inert copying: `only finite plain data is supported`.
- An ordinary vector index getter is rejected without invocation, with
  `arrays must be dense ordinary data arrays`. The three original marker kinds
  remain Error/object/null. Getter invocation count must be0. Their historical
  emerged-value identity claim is NOT_APPLICABLE to the P0 inert-data boundary.
- Missing fields, duplicate commands, unknown bodies and parser precedence
  keep their source-backed current P0 literals. Force, linear impulse and
  off-axis errors precede the new empty-command error for both components.

All23 submissions retain S1/public raw and cursor. Queries and copies also run
at S1. One independently compared empty recovery then advances to S2. This is
a measured recovery step in the selected RENAME fixture, not a1200-step variant
claim. No recorder attach/restore, hidden state injection or new throw-control
submission is included. New-profile recorder qualification remains unmeasured.

# Structural negatives, copies and queries

Per graph: duplicate B; shared A with its anchor adjusted to keep coincidence;
unsupported axis; unsupported limit; noncoincident anchor; sparse anchor.
The last case now fails the existing P0 inert-data array boundary before joint
parsing. All other selected error messages retain the original restriction,
endpoint or anchor literals. Six constructor attempts, no accepted World.

Constructor and returned-state mutations must leave fresh state unchanged.
P0 body states omit shape/inertia: check model copy and visible state fields;
do not claim nonexistent body DTO fields were mutated. Positive overlap/ray
queries use both physical Z roles. Ray distance uses the original independent
scalar sphere-ray query reference, with exact comparison and no new tolerance.
Three negative queries and two queries after disposal retain their selected
current P0 errors. Two disposals are idempotent. GetState and step after disposal
must report DISPOSED before argument validation.

No compatibility or variant function runs at import. Parent freezes providers,
reference helpers, this program, case ledger and counters before calling it.
First unexpected result stops the prefix and preserves cleanup as a separate
actual action. Public rollback proof remains public-state proof. No nonempty
cache, public new-profile cap failure or full connected mechanism is claimed.
