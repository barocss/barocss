# D344 native quadrature conditioning: source-only analysis

## Status and priority

SOURCE_ONLY / NOT_RUN. Read fixed worktree `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b` while D343 source/API/Studio gates are frozen. No runtime/build/test/browser, product source edit, commit or push. Re-pin all sources after D343 publication before any bounded reproduction or implementation. This source note does not authorize a new algorithm or duplicate the repaired upright longitudinal provider.

The provider anomaly already has immutable D343 data: actual native strict-valid tiny Z cylinder, interval `[.3456789,.34567890000000023]`; upright V `6.278163296415536e-15`, C `[.12345670000000006,-.23456779999999994,.3456789000000001]`; native B-rep quadrature V `6.180191251439208e-15`, C `[.10042170557247179,-.26839177431837347,.3456789000000001]`. These are prior observed results, not rerun here. They establish a separate provider discrepancy, not its internal cause. Rounded analytic pi and native stored rational-circle geometry are separate authorities.

## Confirmed source facts

Paths below are relative to the fixed worktree; line numbers refer to the current frozen source, not a future checkpoint.

1. **Centering exists already.** `packages/barocss-cad/src/brep/brep-mass-quadrature.ts:39-44` subtracts `centre` in `accumulate`. `setCentre` at619-625 takes the support-control-pole box midpoint; `fromCentre` at631-634 moves local integrals back to world coordinates. Adding only another late point subtraction is not a justified correction.
2. **Dispatch separates planar caps and curved sides.** `brep-mass-quadrature.ts:142-158` sends planar supports to `planarIntegrals`, whole patches to `patchIntegrals`, and remaining faces to tessellated-domain quadrature. If all faces use planar/whole branches, it returns `meshed:false`; `solid-mass.ts:81-89` then does no Richardson second pass. Whole-patch detection uses boundary/perimeter sampling at648-678. Whether THIS captured side takes that branch is still NOT_PROVEN at runtime.
3. **Whole-patch arithmetic is absolute before centering.** `patchIntegrals` at721-737 stores `q[axis]*weight` in homogeneous `Pw` using original world poles, then batches `uSums` at781-795. `patchPoint` at799-812 sums those absolute columns, projects `x/w,y/w,z/w`, forms quotient-rule partials, crosses them, and only THEN calls centered `accumulate`. It does not call `surfaceD1Evaluator` at these nodes.
4. **Other evaluators also use absolute homogeneous sums.** `core/math.ts:242-268` does so for `surfaceEvaluator`; `core/derivatives.ts:148-171` does so for surface point/partials. Constant-coordinate restoration applies only when every surface pole shares that coordinate. A ruled side with distinct lower/upper Z poles is not globally constant in Z, even though its U derivative in Z should vanish and its V derivative is a tiny constant. These shared evaluators are adjacent scope; their use must be traced before proposing a global change.
5. **Planar cap path differs.** `planarIntegrals` at106-130 evaluates the exact boundary curve and integrates its plane. Curve D1 restoration at`core/derivatives.ts:106-130` restores shared coordinates exactly. A horizontal cap's shared Z coordinate is therefore not evaluated through the same side-surface height difference. This makes face-contribution separation useful.
6. **Late raw/central conversion remains separate.** `fromCentre` returns world raw integrals; `solid-mass.ts:33-46` later divides raw first moments and subtracts `V*c_i*c_j` for central inertia. Better derivatives alone do not prove all raw-to-central inertia arithmetic stable.

## Leading falsifiable hypothesis

**H1: absolute homogeneous column differencing in the whole-patch fast path loses the tiny ruled height before `accumulate` can center anything.** This is a source-backed hypothesis, not a diagnosed root cause.

For the captured side profile, each V pole pair has identical tangent coordinates and weights, with Z endpoints separated by h=`2.220446049250313e-16` near0.3457. In exact arithmetic for its standard V-linear basis, W_v=0, S_v^x=S_v^y=0, S_v^z=h, and S_u^z=0. In `uSums`, however, R(column0).z and R(column1).z are separately rounded sums of approximately0.3457*w. `patchPoint` computes their difference through `zv += D_v*R.z`; the small h can be quantized or disappear before the normal is formed. The later `p-centre` cannot recover a damaged Jacobian.

This mechanism can qualitatively explain all three prior observations together: V wrong, tangent centroids shifted, normal centroid correct. The accumulator uses V from `x*n_x` alone (`:42`), so horizontal caps do not supply V. Side n_x/n_y depend on the small V-normal derivative. Tangent first moments weight those angular normal errors differently. In contrast, the local normal first moment comes from cap n_z contributions; symmetry about the chosen center can leave its local first moment near zero, and `fromCentre` then returns center_z even with an erroneous V. This explanatory consistency is not execution proof.

Alternative hypotheses to retain until classified:

- H2: wholePatch classification is false, so surface-domain/tessellation/strip derivatives rather than patchPoint dominate.
- H3: the native rational-circle area differs materially from the rounded analytic guide. Independent actual-pole/weight arithmetic is needed; do not use the upright formula as the only oracle.
- H4: per-face field cancellation, planar cap arithmetic, or world/raw conversion dominates after otherwise correct node derivatives.
- H5: method fallback or cached provider identity differs from the claimed quadrature route. Capture `method`, `meshed`, dropped-strips status and exact input identity.

## Actual consumer trace

- Explicit raw `brepMassProperties` selects polynomial/planar exact first, then quadrature for curved faces, else tessellation (`brep/solid-mass.ts:121-138`). `brepSurfaceArea` uses the same cached quadrature at98-108; `quadratures` is keyed by original B-rep and q at70-79.
- Core `Part.mass` -> backend -> `api/core.ts:38-45` -> `massPropertiesOf`; `part/part-model.ts:4544-4548` chooses live custom provider, then upright prismatic closed form, then B-rep provider. Therefore the corrected upright Part/Model result does NOT qualify native quadrature. There is no separate public `Part.nativeMass` method in the inspected Part facade. Model's `nativeMassPropertiesOfBody` at`engine/evaluate.ts:133-147` is a private cached actual-provider lookup, not a forced B-rep integration.
- Model facade `api/core.ts:19-29` returns evaluated BodyResult/bodyMass. Native nonupright/imported outputs can reach the B-rep path through massPropertiesOf; the upright tiny Z example stays on corrected closed form.
- **STEP validation metadata is a concrete affected source consumer.** `io/step.ts:191` writes validation properties by default. `:204-209` calls raw `brepMassProperties(b,1)` and `brepSurfaceArea` even when an input CadPartOutput had a different upright mass provider. Core facade `.step` routes through `api/core.ts:50-52`; Model `exportStudioStep` gathers only B-reps at`engine/evaluate.ts:481-493`. This establishes the source route, not a reproduced exported-file failure. An actual STEP volume/centroid readback is still NOT_RUN.

## Small bounded reproduction after root grants it

No product edit is needed for the first probe. Use the exact D343 saved native B-rep after re-pinning published source. Preserve its bytes, validity/counts/names/all poles/weights/knots before/after.

1. Call existing wholePatch test and provider functions to identify each actual face branch; record per-face cap/curved contribution and full raw/central output. Private test-only instrumentation or a temporary source-bound harness must not be described as public API behavior. Preserve the first refusal/fallback exactly.
2. At the SAME stored Gauss nodes/weights used by the fast path, independently decode finite binary64 poles/weights/parameters into BigInt rational arithmetic. Verify the structural ruled identities W_v=0, S_v^x=S_v^y=0, S_v^z=h and S_u^z=0. Compare exact-at-those-nodes homogeneous differences/partials/normals with actual floating fast-path values. This isolates arithmetic conditioning from quadrature-rule error; it is not an exact-integration claim.
3. Compare exact-at-stored-node summed volume/moments with the floating sum, then use independent symmetry and a rounded circle volume guide with an explicit native-geometry bound/convergence check. Exact pi is not available. A positive-weight homogeneous circle-equation residual can independently bound deviation of the stored rational arcs from their intended radius; do not silently assume perfect-circle coefficients.
4. Controls: same stored tiny height recentered at normal0; ordinary translated height; reflected/cardinal whole native-cylinder transforms preserving the exact coefficient arrays; cap-only vs side-only sums. Record whether translations change an already-rounded native input geometry. Do not substitute the unsupported XY tiny Offset composition (D343 now correctly refuses missing target); transform the actual qualified native B-rep for quadrature-only controls.
5. Keep output method, MMGS/density/error contracts unchanged. Record native area, raw-to-central inertia and SI provenance separately. STEP validation metadata is the smallest actual external consumer proof if the provider anomaly reproduces; an upright Studio mass panel is insufficient.

## Correction boundary, only after proof

If H1 is established, a computational local homogeneous integration path is more narrowly grounded than rewriting public geometry/evaluator contracts. Poles must be recentered BEFORE weighted sums/derivative differences, and local coordinates must stay local into accumulation; re-adding center then subtracting it can lose the recovered tiny coordinate again. Preserve actual native source arrays and existing quadrature nodes/rules/fallback/method labels. Assess `fromCentre` and final central moments independently. This note does not choose final code, add a generic mass engine, clamp centroids, fudge V, refuse all tiny bodies, raise tolerances, rewrite native geometry or add dependencies/schema.

Any performance optimization must use the existing scoped performance harness with geometry equivalence before/after; an accuracy correction gets no speed claim without evidence. No implementation or reproduction is authorized by this source-only note.
