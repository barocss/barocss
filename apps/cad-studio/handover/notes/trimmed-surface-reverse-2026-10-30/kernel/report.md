# D337 Kernel trim sidecar Reverse

2026-10-30. Fixed checkout `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, baseline `92413878961db4f5886097fcf43439761c11452d`, branch `local/cad-dev`. No commit or push. Other agents own Model and Studio files.

## Result

Implemented `reverseTrimmedSurfaceAxis(surface, trimLoops, options)` in `packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-axis-reversal.ts`, exported through `src/index.ts`. It uses the existing `SurfaceAxisReversalOptions` and calls the parent native operation once. It returns the complete parent result, owned mutable `trimLoops`, and a separate `trimTransport` report. Parent error precedence and the parent128-observation report remain unchanged. The new error class is `TrimmedSurfaceAxisReversalError`, codes `INPUT|SUPPORT|DOMAIN|TOPOLOGY|REPRESENTABILITY|BUDGET|BINDING`.

Profile: exact nondegenerate affine degree1x1 four-pole equal-positive-weight planar support; one simple stored3..160-point loop; either keep flag; either selected axis; finite original clamped nonunit domains. The input sidecar has exact own-data fields, dense arrays, and finite in-domain coordinates. Forward collinear samples are accepted. Repeated points, zero edges, backtracking, nonadjacent crossing/touch/overlap and zero area refuse.

The selected parent provenance domain gives exact rational `a+(b-t)`. Interior values round once with `SectionRationalContext.nearest`. Endpoint partners copy directly. Nonselected coordinate bits remain unchanged. The exact selected-axis L1 world displacement gives an upward-rounded conservative bound. Separate UV and linear tolerances retain their original1e-7 values. Both input and rounded output have independent exact topology and area checks. Output winding must reverse. No points are dropped, snapped or merged.

Cached homogeneous exact points and existing `exactOrient2` avoid rational arithmetic in the O(n²) segment checks. Combined input/output budgets remain separate from native observations: maximum160 bindings,25,120 edge pairs,25,440 vertex pairs and102,400 orientation tests. Input area, output area and support/transport use three request-local rational contexts, each retaining the existing200,000-operation and8192-bit caps.

## Verification

All executions used `/Users/user/Library/pnpm/nodejs/22.19.0/bin/node`, version22.19.0, from `packages/barocss-cad` in the fixed checkout. Each execution acquired `/Users/user/.claude/local-mods/barocss-lanes-guard/bin/gate.sh acquire heavy 1800 <label>` and released it through an EXIT trap. Actual admission messages are in `gate.log`. Root granted the exclusive heavy window before execution.

| Command after the Node executable | Result | Receipt |
|---|---|---|
| `scripts/tool.mjs build` | PASS, exit0 | `build-first.log` |
| `--test test/trimmed-surface-axis-reversal.test.mjs` | PASS8/8, fail0, skip0, exit0 | `focused-first.log` |
| `scripts/tool.mjs type-check` | PASS, exit0 | `types-first.log` |
| `scripts/tool.mjs lint` | PASS including code-shape, exit0 | `lint-first.log` |
| `--test test/numeric-policy.test.mjs test/numeric-policy-range.test.mjs test/exact-segment-crossing-v1.test.mjs test/exact-collinear-segment-overlap-v1.test.mjs test/bezier-coons-surface.test.mjs` | PASS19/19, fail0, skip0, exit0 | `related-first.log` |

First failure: NONE. The original logs are preserved without replacement. No full suite was run.

Focused tests use an independent Fraction oracle implemented within the test, without CAD projection/evaluation/reversal/polygon/rational helpers. The affine lift, Green area and centroid are calculated from represented binary64 input values. Actual native evaluations are checked separately. The first test admits160-point rectangles for both axes and both keep flags and compares the parent report/provenance to a direct parent invocation. It checks material area1100 and centroid[340/11,104/11,3] for outside, area100 and centroid[20,4,3] for inside. The160-point concave case checks actual stored area130.9590625 separately from design131, endpoint world displacement bounds, material moments and world probes.

Other focused cases cover fractional nearest rounding, reversed authored winding, endpoint copies, nonselected negative-zero bits, double selected and combined-axis geometric preservation, native AXIS precedence, nonaffine/rational/degenerate support refusal, malformed/sparse/multi-loop/oversized/out-of-domain sidecars, accessors without getter execution, duplicate/backtracking/crossing/touch/overlap/zero-area refusal, rounding collapse refusal, chart coordinates above10000 and original UV tolerance refusal on a large domain. Success and refusal paths check input ownership.

## Boundaries

The Kernel tests do not run Model's public projectLoop producer; their160-point sampled outlines exercise the stored-polyline profile independently. Model and actual Studio flow evidence belong to their assigned owners. Save/Open, Undo/Redo, selection, actual public160 producer projection and remaining consumer guards are not claimed by this receipt. Independent geometry review is pending with root. No native file/schema/dependency/WASM/standards data changed. Curved supports, nonaffine bilinear supports, unequal weights, multiple loops and larger loops remain refused. Surface solid mass is NOT_APPLICABLE. This report does not claim exact trimmed-mesh mass, generic B-rep trimming, whole-roadmap08 completion or release.

## Owned files

- `packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-axis-reversal.ts` (new)
- `packages/barocss-cad/src/index.ts` (two export lines)
- `packages/barocss-cad/test/trimmed-surface-axis-reversal.test.mjs` (new)

No source changes were made after the reported build/check/test sequence. The heavy window is released.
