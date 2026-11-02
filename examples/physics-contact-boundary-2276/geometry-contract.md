---
work_id: physics-contact-boundary-2276
artifact_type: frozen-canonical-face-geometry-contract
status: staged_surface_midpoint_certificate_not_run
owner_role: independent-algorithm-work
source_request: repair contact generation at strict line boundaries without tolerance relaxation or compatibility modes
last_updated: 2026-11-01
---

# Canonical representable face witnesses

## Staged defect after the first World attempt

The first source/emitted four-fixture gate passed128rows and repaired77
historical strict-line failures. Those receipts and their source hashes
remain unchanged. The next World source attempt exposed a missing condition
in the construction certificate. A line could intersect both boxes while
its actual A-exit/B-entry surface midpoint was far from the returned point.
ALIGNED step4row26 recorded about0.168962m midpoint error; OFFSET step2row11
recorded about0.125m. OFFSET step2row18 was independently unresolved between
80and120digit classification. The World attempt stopped; YAW was not run.
None of those results is changed or relabelled by this stage.

Before new arithmetic runs, freeze this stronger certificate. The interval
routine returns exact closed lower/upper bounds. For the actual returned
binary64 midpoint, let `ta` be A's upper bound and `tb` be B's lower bound
along the unchanged raw normal `n`. Require both intervals to exist and
`(ta+tb)^2 * dot(n,n) / 4 <= (existing1e-12)^2`. This is the exact squared
Euclidean distance to the actual surface-pair midpoint. It is stricter than
the independent1e-9m check and introduces no larger tolerance. The condition
applies to the original candidate point as well as every rounded trial.

Also require that the named original A face is the exact exit bound and the
named original B face is the exact entry bound. Compare rational values
exactly, including closed-boundary ties. These checks reject a side-wall
entry that cannot represent the selected face pair. The identity zero-width
edge control remains eligible; there is no blanket strict-interior rule.

Only `strict-line.ts` and one additional face certification call are changed.
The old16trial limit, rational/integer/bit caps, movement bounds, raw normals,
selection, point IDs/order, clipping, independent references, and solver
remain unchanged. A construction or precision refusal stays a refusal.

The parent adds the saved ALIGNED4/OFFSET2 poses to the four original cases
and authenticates all six cases/192rows before new World work. The previous
version has79resolved failing rows, one unresolved row, and112passing rows
in this combined DATA set. New source and emitted fixture runs must check
every row and the unchanged paired witness reference. If independent
precision remains unresolved, preserve that first result and freeze a
separate refinement; do not alter the verifier or silently inject an
interior tolerance. The author runs no tests or new arithmetic campaign.

A new analytical regression uses identity boxes at `(0,0,0)` and `(0,1.8,0)`,
normal `(1e-19,1,0)`, and point `(1,0.9,0)`. Both line intervals exist, but
A's actual exit is the X side at `t=0`, whereas B's entry is its bottom at
about `t=-0.1`. The actual midpoint offset is about `0.05m`, so `check` must
reject. One inward X ULP makes the original Y faces the actual bounds and
must pass. This expected result comes from the box planes, not a copy of
the production predicate. Existing eleven tests remain; the staged suite
has twelve tests and is unrun by its author.

Base8d7474ba0b4df5367dbeee93b3a95cb777dcac48. Owned source is the canonical
face-contact.ts plus new strict-line.ts in physics-rigid-feature-geometry and
this contract/test file. No old evidence, independent verifier, edge law,
SAT selection, solver, World, iteration count or physical gate is changed.
Existing HOLDs remain. No dependencies or Node runtime imports are added.

## Fixed geometric rule

Keep current clipping, candidate selection, duplicate elimination, sort,
IDs, order and plane normal bits. Finalize each selected face point on this
one canonical path; there is no selectable previous mode or fallback.
Use exact rational arithmetic on decoded binary64 poses/extents/normal.
Build the normalized quaternion matrix as quadratic terms divided by q·q,
without sqrt or a copied source basis. Intersect the actual point-normal
line with each OBB's three closed local slabs. Zero direction is exactly
zero, and a parallel outside slab refuses. Closed intervals must overlap
within each box. There is ZERO slab inflation, epsilon or inside tolerance.
The two OBB intervals need not intersect each other: paired surface witnesses
can have a signed separation within the existing witness gate.

If the existing actual float midpoint has strict line certificates, and its
paired named-face witnesses meet the unchanged1e-12m witness bounds, return
those bytes unchanged. Otherwise move its representable seed one nextafter
step per world coordinate toward the centroid of the current clipped patch's
candidate midpoints. At most16steps per selected point, no scale/shrink
parameter. The same original selected row and ID are retained. Do not drop,
merge, replace with another vertex, clamp a normal or construct a rest value.

For each seed, intersect its line along the unchanged normal with the exact
selected A/B face planes, correctly round both paired witnesses to binary64,
and form midpoint=(witnessA+witnessB)/2 using the original float operations.
Certify THAT actual returned float midpoint with the exact zero-inflation
line predicate, not its seed or a rational ideal midpoint. Require both
rounded witnesses inside their box and on the named original face within
the pre-existing1e-12m witness bound. Require exact-rational Euclidean
movement of EACH witness and midpoint from its original generated value
<=1e-12m. The existing signed gap<=1e-12m and all outer witness validation
still apply. A failed bounded construction refuses with original NUMERIC_LIMIT
and witness message. There is no wider test or unbounded repair loop.

Correct rational-to-binary64 conversion uses integer quotient/remainder with
ties-to-even. Signed input zeros remain untouched when no movement is needed;
nextafter changes only the requested direction by one representable step.
No arithmetic or test result is inferred before execution.

## Fixed work bounds

One exact context per face call, at most4retained rows and16rounding trials
per row. Initial unchanged-point certification is separate. Exact context:
<=200000rational operations,<=2000000metered BigInt operations,
<=16384bits per integer after every operation, including intermediates.
GCD remainder steps are metered. Fixed-dimensional validation, bit-length
inspection and IEEE field access are bounded separately. Exceeding any cap
refuses; no retry with higher limits. Report actual rational/integer counts,
peak bits, rows moved and maximum rounding steps in conditioning. This is
not a performance qualification.

## Parent execution boundary

Author runs no parser, build, test, helper, geometry, solver or World call.
After complete source freeze, parent runs synthetic source/emitted tests,
existing geometry controls and pinned independent witness reference, then
the saved four32-row patches. All128rows must retain exact IDs/order/normal
bits, and the independent Decimal80/120 strict line/witness and1e-12m
Euclidean movement checks must pass. Original77failed rows and prior
strict-line NO_GO receipts remain immutable. Only after that gate may parent
run bounded original stack cases. A refusal remains a refusal, never a
compatibility fallback or a relabelled physical pass.
