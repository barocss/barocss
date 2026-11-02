---
work_id: physics-stack-solver-2276
artifact_type: frozen-reference-contract
status: ready_for_parent_execution
owner_role: independent-fixture-executor
source_request: "Issue #2276: unchanged independent geometry and quality checks for candidate trajectories"
last_updated: 2026-11-01
---

# Trajectory geometry wrapper

Freeze before implementation and parent execution. Own only this contract
and `trajectory-reference.py`. Do not edit old helpers, receipts, or HOLDs.
No candidate, World, solver, OBB production math, or archive study is imported
or called. Parent retains separate position and phase-ledger references.

## Immutable imports

Verify SHA256 before each import of definitions:

- `physics-motion-nogo-2276/stack-study.py`:
  `70a34672ef53f034fa714bcd54a120a60c672fea3fd740841064dc8ac43263e2`.
- `physics-rigid-contact-reference/geometry-reference.py`:
  `2c8bc7f6cd809e865c986a859b8614c963c4862296920555eb31c9487411af26`.

Both helpers use standard-library imports and guarded main functions.
Disable bytecode writes. The wrapper uses only Python's standard library.

## Newline JSON operations

Start with `python3 -B examples/physics-stack-solver-2276/trajectory-reference.py`.
One request line produces one response line. Input cap is 2 MiB per line.
The optional `guardMetadata` is echoed without using it for numerical checks;
parent may include raw-frame hashes and provenance there.

`{op:"quality", request:{state,initial,timeSeconds,referenceAt8s}, guardMetadata?}`
calls the unchanged geometry helper's `evaluate(request)` exactly once.
Keep its original `ok`, `metrics`, and `violations`, including its unchanged
Decimal80/120 resolution check, signed SAT geometry, 2 mm global gates,
and pointwise 8–10 s terminal gates. Do not convert or replace parameters.
Add operation, source pins, echoed metadata, and wrapper resolution fields.

`{op:"contacts", freeBodies:[...], pointLedger:[...], guardMetadata?}`
requires the original full nine-body/point ledger layout. Zero to 32 points
are allowed. Validate the saved-layout fields with the unchanged helper.
For every point, call `geometry_at_precision(point,freeBodies,80)` and again
at 120, then `compare_geometry(low,high)`. Check exactly the original
`stack-equilibrium.py` geometry wrapper conditions:

- `lineIntersectsBoth` and `lineMidpointWithinTolerance` are true.
- Both endpoints' `pointInsideTolerance` are true.
- Signed `supportPlaneGapM <= 1e-9` m. Do not use its absolute value. Negative
  penetration stays recorded; it is not made zero.

The old helper uses 1e-9 m for slab/midpoint/support geometry and 1e-60
for precision differences. Do not widen either gate. Inspect every row even
if a prior row fails. Return all row violations and full independent witness
data. Numeric maximum metrics summarize signed support gap, midpoint error,
slab violation, and precision difference. Keep exact Decimal strings in rows.
No points means zero checked rows, no contact witness, and null geometric
maxima; it does not imply contact coverage or a valid contact-free world.

## Response and evidence boundary

For contacts, return `ok`, `resolved`, `executionFailure`,
`precisionResolved`, `pointChecks`, `metrics`, `rows`, `violations`,
`guardMetadata`, and `sourcePins`. A resolved geometric gate failure has
`ok:false,resolved:true,executionFailure:false`. Invalid input, helper
exception, or precision disagreement has unresolved/execution-failure flags.
Rows continue after a row-level invalid/precision result, and retain its error.
Unknown operations and malformed input produce an execution-failure response.
Failure to authenticate an imported helper exits before accepting requests.

The wrapper writes only stdout/stderr. It neither edits files nor runs tests,
models, controls, a simulation, or historical campaigns by itself. A future
parent response is geometry evidence only. It does not validate contact
impulses, completeness, convergence, eight-box stability, or native adoption.
