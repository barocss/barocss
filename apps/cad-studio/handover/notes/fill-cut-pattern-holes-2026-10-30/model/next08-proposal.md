# Next single remaining08 proposal

Recommendation: **one genuinely curved, single-span polynomial quadratic path for the existing fixed-orientation Path cut pattern**. This is a new bounded curved profile, not a repeat of delivered D334 open polylines or D345 polygon-hole masks. This is source inspection only: no source edit, build, test or browser execution was performed for this proposal.

## Priority and current evidence

First finish D345's qualified delivery and document/publication gates. Root confirmed a real successful-Fill selection alias in run-02 and repaired it before run-03: the consumed target index selected witness420 after output reordering. That correctness defect takes priority over generality. Root reports run-03 numeric and scoped visual PASS. This review identifies no further confirmed correctness defect; do not turn the intentional curved-path refusal below into a bug claim.

Roadmap `apps/cad-studio/handover/roadmap.md:78` leaves broader curve/fill support and direct-edit/surface gaps open. Its older polygon-hole sentence predates the current D345 delivery and should not be read as a request to reopen that profile.

## Concrete source gap

- Kernel `packages/barocss-cad/src/features/curve-cut-pattern.ts:32-45` accepts degree1 or degree2 only, requires all weights1, then requires each quadratic middle pole to be the exact straight-span midpoint. Thus a valid nonstraight polynomial quadratic is deliberately refused. Lines49-72 compute chord lengths and interpolate straight offsets, so merely removing the midpoint check would place cuts on the wrong path.
- Model `packages/barocss-cad-model/src/engine/curveFeaturePattern.ts:16-48` duplicates the straight-span admission and length logic. Its placement validation at lines100 onward also uses straight chords. Kernel-only admission would leave actual Studio picker/loader/build behavior inconsistent.
- The current actual UI says “open polyline” and “straight quadratic path” in `src/app/commands.ts:812-820`. Existing live source lookup is already present at `engine/curveFeaturePattern.ts:52-73`, compilation at `engine/part.ts:139`, and editable Path selection at `app/editFields.ts:577`.
- Reuse the existing original-CUT replay at Kernel `src/part/part-model.ts:1946-1958`: identity orientation, live source-cut activity, existing Boolean calls and stable `@k` suffixes. Public `src/api/spec.ts:238-242` already carries raw/live path and spacing/count without a new verb.

## Bounded acceptance proposal

Admit exactly one clamped degree2 span, three finite control points, all weights1, constant world-Z0, non-collinear XY control triangle, existing coordinate/spacing/count limits and fixed cutter orientation. Keep rational arcs, multi-span curves, closed curves, cusp/zero-speed cases, arbitrary frames, tangent rotation, tool clipping and general spline support outside this extension. Existing straight-profile output and names must remain unchanged.

High should first specify and qualify actual-curve arc length and bounded inverse-length placement before ordinary implementation. Do not approximate the control polygon as the curve, alter authored poles, or expand a tolerance to obtain admission. `src/nurbs/curves/cad-curve-arc-length.ts:42-55` is a useful existing diagnostic/comparison route, but its report explicitly says aggregate estimator, not certified upper bound, and no global binary64 error certificate. Calling it alone does not prove placement accuracy. Avoid a new general arclength engine; prefer a justified single-quadratic algorithm and independently checked positional residual at the existing linear policy.

A small independent authority is the exact native polynomial with P0=(0,0), P1=(20,0), P2=(20,20), knots[0,0,0,1,1,1]. It has B(t)=(40t−20t²,20t²), positive speed 40√((1−t)²+t²), and half-length 10+5√2·asinh(1). The t=.5 position is (15,5), rather than the endpoint-chord midpoint (10,10). These identities distinguish real curved placement from a disguised polyline. Use an independent high-precision closed-form/inverse oracle over the actual represented spacing before fixing expected placements; do not rely only on production Gauss estimates or rounded analytic constants at the full-path endpoint.

## Smallest meaningful actual Studio/file proof

One Chrome, serial contexts, one asymmetric original rectangular CUT plus stable witness420. Seed the native degree2 curve through the existing public Model `engine/direct.ts:54 importSource` source route, or normal `.barocad` Open; no private geometry constructors or authoring hooks. Select it in the actual Path cut pattern UI, use a safe interior spacing (for example10) and count3, preview Cancel/retry Apply, and verify independent curve positions, cutter corner/material witnesses, fixed tool orientation, volume/centroid and stable `@1/@2` names. For stock60×40×10 and three disjoint3×5×10 cuts, V=23550; first moments must use the independently derived actual offsets.

Exercise one actual Spacing edit and one live-path change through the existing Direct Move/Stretch controls, which D334 already maps in `apps/cad-studio/test/curve-cut-pattern-browser.mjs:198-239`. Check that shape change recomputes placement on the actual current curve, while a translation of the entire path preserves relative offsets. Verify Undo/Redo, unchanged original CUT/source identity, no stale witness selection, native Save/fresh Open and editable path/spacing/count. Include a distance-too-long refusal with document/selection/history retained and a valid retry. One main profile plus the separate invalid-distance observation is enough; do not rerun the whole D334 campaign.

Node qualification precedes browser: old intentional refusal captured, independent polynomial length/inversion and native-position residual, nonzero-speed/ownership/limit failures, current live source and nested file admission, existing no-hole straight/path controls. Actual browser remains PENDING for this proposal. This would close only the new single-curved-span consumer, not all remaining08; 09 and Electron15 remain in their existing order.
