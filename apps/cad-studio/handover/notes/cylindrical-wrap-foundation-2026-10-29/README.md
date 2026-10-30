# D297 private cylindrical wrap foundations — 2026-10-29

This checkpoint adds private mathematical helpers and one connection fixture on top of `06c33222a`.
It does not add a wrapped B-rep, physical solid, Part feature, Model node, public API or Studio command.
No original source-coefficient checksum pin is used as a geometry oracle.

## Implemented contract

- `cylindrical-wrap-map.ts` copies one admitted stored rational quadratic near-quarter. Exact rational
  Bernstein bounds certify positive denominator/radius/angular derivative, stored-circle defect,
  second angular derivative and piecewise affine nominal-arclength error. A fixed 24-term outward atan
  interval and at most 256 dyadic cells bound admission. Native U nodes must be exactly representable.
  The actual stored poles, weights, knots and original domain are retained. The caller retains producer
  provenance. The actual-length residual is scalar; it is not an actual-arclength spatial inverse.
- `cylindrical-wrap-curve.ts` composes a native-domain linear UV segment with a rational degree(2,1)
  Bezier Surface into a rational cubic. It keeps the original Surface and native UV pcurve. Exact
  degree-six homogeneous cross-residual coefficients bound the stored cp*weight representation,
  including caller-owned shared endpoint overrides. Both edge and pcurve use the same t=[0,1]
  direction; coedge reversal is separate. Existing native tolerance and exact-arithmetic budgets remain.
- The connection fixture extracts the original positive-Y quarter of a native R10/H30 circle-extrusion
  by direct-copy splitting, keeps U=[0,0.5], and composes successive map cells with shared endpoints.
  Source immutability, original domain, analytic bounds and original source-body validity/mass are checked.
  Number evaluations with observation-only slack detect regressions; they do not admit production geometry.

## Verification

Node 22.19.0 kernel build and changed-source lint pass. Focused tests:34/34. Whole kernel:
2022 total /2016 pass /0 fail /6 existing skips (272290.539416 ms). Generated agent-tools/refusals
checks pass; API inventory is unchanged and returns SCOPED_PASS for its six named rules only.
Original outputs and the independent read-only mathematical/source reviews are adjacent files.

The first native-domain focused run passed33/34. Its unchanged output is `focused-first-failure.txt`.
Both original semicircles start at +X. The fixture inadvertently retained the negative-Y half, whose native
middle weight differs from Math.SQRT1_2 by one ulp. The typed failure was:

```text
error: 'Cylindrical wrap map: One rational quadratic quarter with native weight bits[1,sqrt(1/2),1] is required'
code: 'SUPPORT'
```

The fixture now selects the original positive-Y carrier geometrically. No support/tolerance relaxation or
source reconstruction was used. The subsequent34/34 and whole-kernel pass apply to that corrected fixture.

## Explicit limits and next step

No global native Number evaluator error, trim embedding, positive side Jacobian, topology, aggregate glyph
budget, wrapped volume/centroid/inertia or physical solid is certified. Each helper has its own bounded
request context; many individually admitted edges are not an aggregate glyph receipt. Native producer
provenance remains a caller obligation. These modules are absent from the public index and Model/Studio.

Model/Studio/browser were not rerun for D297. Their last complete product evidence belongs to D296 runtime
62069bbd1 (Model1822/1822, Studio365/365 and actual Chrome/WebGPU flows36/37). No performance comparison was
run for these new private helpers and no speedup is claimed. No push, PR or release.

D298 must first connect a bounded native cylinder source adapter, preserve protected old records, build
shared edges/pcurves and counter-island faces, and prove regularity/nonintersection plus independent mass.
Only then may a native feature and Model/API/Studio integration be qualified. Arbitrary fonts, shaping,
full-cylinder seam crossing, tilted cylinders, engraving and general rational surfaces remain outside this
private checkpoint.
