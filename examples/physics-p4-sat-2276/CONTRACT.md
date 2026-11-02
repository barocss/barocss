---
work_id: physics-p4-sat-2276
artifact_type: offline-integer-sat-micro-contract
status: authored_not_run
last_updated: 2026-11-03
---

This is new offline algorithm research. All original P4 NO_GO, first failures,
HOLDs, thresholds, iteration limits and public body limits remain. No current
engine or old reference is edited. There are zero World, production geometry,
QP, old-reference, fixture-builder, transcendental-seed or network calls.

The actual hot entry is `physics-rigid-signed-closure-world/reference.py:188`
`compact_pair`. It combines Float64 `fresh_query` with Decimal80/120 raw and
normalized quaternion SAT. Its recorded position-reference share is about55%.
The support-radius cache v3 approach ended at COST_NO_GO and is not resumed.

FIRST authenticate all twelve raw saved files in corpus.json before importing
the candidate. The six CURRENT frames are ALIGNED1/16, OFFSET1/16, YAW1/16.
ALIGNED1 authority is the actual cost-census reply, including its signed zeros;
the other five use observable-census original raw replies. Decode each nine-body
PRE and HYP raw frame. Preserve the original36 eligible pairs in lexical order,
all15 axes and both raw/normalized quaternion conventions:432 pair stages,
864 convention problems,12960 axis visits. No selected pair or zero axis is
omitted from the counts. Exact-zero axes remain counted but have no margin.

Candidate input is bodies only. Saved expected responses never seed a matrix,
axis, sign, winner, interval or rounding decision. It uses integer homogeneous
coordinates and exact signed comparisons. Method and scope are in METHOD.md.
The kernel returns the exact algebraic first minimum, all exact tied minima,
axis zero/near-parallel/sign classifications, and independently auditable dyadic
enclosures for the minimum margin, nonnegative depth and raw/normalized deltas.

The saved full authority has only these independent geometric numeric fields:
rawMarginM, normalizedMarginM, rawDepthM, normalizedDepthM,
rawNormalizedMarginDifferenceM, rawNormalizedDepthDifferenceM. Every proposed
word must exactly match the saved binary64 word, and a separate Fraction-only
observer must place the candidate's entire enclosure strictly inside that saved
word's nearest-even bin. No new reference evaluation supplies expected values.
Classification must match the sign of the saved margin, unless its value is
zero, which cannot certify whether a nonzero exact margin rounded to zero.
Such a case is explicitly UNRESOLVED rather than silently accepted.

Missing independent outputs remain explicit. Saved `selection`, `ties` are
Float64-operation-order outputs, not exact-SAT winner certificates. The exact
winner is emitted but its external feature equality is NOT_QUALIFIED. The old
algorithm-specific `precisionMaxDifferenceM` cannot be reconstructed honestly
from a new exact backend. Scalar feature/normal/point/cutoff/tie fields and
full compact_pair raw-output compatibility are NOT_RUN. No output is copied
from authority into candidate output. Therefore even numeric-word PASS is
only PASS_SAVED_SAT_NUMERIC_SUBSET, never a hot-root replacement or P4 GO.

Bounds:180s outer guard supplied by parent;170s internal alarm;2,000,000 metered
integer kernel operations TOTAL for the micro,16384bits per intermediate,
64MiB explicit retained-data accounting,8MiB total new evidence,one frame and
one pair's candidate state at a time. Inputs are at most2MiB each. Guard before
integer products/shifts using conservative bit upper bounds, and before
allocation/serialization using conservative bounds. Square-root Newton loop
has64 iterations and rounding precision is fixed to64,128,256,512,1024,2048bits;
no precision/cap retry beyond this table. Resource exhaustion is a preserved
NO_GO prefix. Neither operation limit nor precision is tuned after a failure.
Fixed finite IEEE decoding/loop indices are separate from metered large-integer
arithmetic. All candidate arithmetic entry points meter their operations.

Write each returned pair before comparing it. Stop at first source/input,
numeric-word, interval, classification, resource or output mismatch. Counts
cover attempted and completed work, including the failing pair. Keep exact
failure and partial prefix; no later frame runs. Existing authority remains
immutable. Fresh run ID is mandatory.

No new cost PASS is defined from historical full-reference timing: this kernel
omits scalar selection, legacy precision-delta construction, QP and transport.
Record its own total wall/CPU cost including decode, validation, predicates,
intervals, observer, output and cleanup. A full-output-compatible backend and
new total-cost forecast are still required before any1200-step replay.

The separate fixed six-pose192-row contact-boundary corpus has line/surface
witness authority, not pair SAT-output authority. Its original hash is pinned
and its row count is audited only. No SAT compatibility claim follows from
that corpus, and its old geometry is not recomputed. A dedicated line backend
is NOT_RUN and cannot stand in for the compact_pair hot root.

Parent command, only inside its unchanged180s external heavy guard:

```
python3 -B examples/physics-p4-sat-2276/run.py <fresh-run-id>
```

Output: `examples/physics-p4-sat-2276/evidence/<fresh-run-id>/summary.json` and
append-only `pairs.jsonl`. Before execution, parent reviews and freezes all new
source hashes. Authoring, source inspection and hashing are not numerical runs.
