# D316 raw frames with a polynomial guide

The Kernel now accepts 2–8 explicit-frame sections and one polynomial NURBS guide. The profile input remains a line/arc array. No authoring mode, schema, global limit, tolerance, or original guide coefficient changes are included.

## Baseline and implementation

`baseline-identity.json` records the exact original checkout identity, Node version, and source/module hashes. `original-*` retains the original source and built modules. The D315 full-build receipt was reused before the first probe. `baseline-results.json` and `.txt` retain the exact six inputs and original typed refusals: 2/3/8 sections, polygon/circle profiles, translated +X frames. `after-results.json` retains their actual successful B-reps, mass properties, strict topology reports, and mesh counts. Their independent volumes are 7/3 and 7π/3 respectively.

The adapter uses the same certified common rigid frame admission as the earlier mixed-profile path. Every section must have identical axes. Squared axis/normal norms must equal one and the axis dot product must equal zero. Frame offsets must have an exact rigid decomposition. Original world frame origins and guide controls must reconstruct numerically exactly after the inverse/forward map. General rigid directions that fail these floating-point reconstruction witnesses are refused; they are not normalized or projected. Numeric equality follows the existing `===` contract, including its signed-zero semantics.

Original profiles are copied and shifted in local coordinates. Arc direction, sweep, and profile orientation must survive the translation. The original polynomial guide admission still checks degree 1–5, 2–64 controls as allowed by degree, knots, strict height, cap endpoints, and passage through section vertices. The adapter bounds its copies by the same maximum 64 controls and maximum 70 knots. Adjacent section planes must retain the existing positive separation threshold and supplied order.

`legacy(localInput, undefined, localGuide)` runs once. The existing `transformBrep` runs once. The common placement helper retains the original mass method and rigid mass algebra. Native SI inertia remains explicitly unavailable with reason `transformed`. Inline ellipse objects, rational guide weights, smooth interpolation, nonparallel/different axes, mixed z/frame position encodings, and failed reconstruction witnesses retain typed refusals. Constant transverse rational weights from admitted circle/mixed arc profiles remain supported.

## Verification receipts

All commands used Node v22.19.0. Build, tests, and lint ran serially under the existing heavy gate. The final gate was released before consumer verification.

- `build-final.txt`: full `node scripts/tool.mjs build`, exit 0. An empty log is normal for successful TypeScript compilation.
- `related-tests-final.txt`: six related Kernel test files, **102 PASS, 0 FAIL, 0 SKIP**. This is not the full Kernel suite.
- `lint-final.txt`: `node scripts/tool.mjs lint`, exit 0, including the existing code-shape guard.
- `legacy-bits-final.txt`: **21 SAME, INPUT_PRESERVED**. The oracle loads archived original loft/oriented/mixed module graphs and compares every enumerable B-rep/name numeric leaf and two-density mass trees by binary64 bytes, including signed zero. Fixtures cover height 2/3/8 sections with 4/16/17/64 controls, framed polygons/circles/mixed profiles, quadratic/cubic guides, a non-permutation direction, and a permuted mixed guide.
- `legacy-bits-results.json.gz`: lossless full original/current numeric trees and inputs, not hashes alone. Decode with gzip. The producing script writes the same payload format. Compression preserves the exact recorded JSON bytes.
- `after-baseline.txt`: all six original refusals now give valid B-reps, finite tessellations, and independent expected volumes.

The new test file covers 2/3/8 sections; +X/+Y/negative normals; in-plane origin shifts; 17/64 controls; circle/mixed arcs; a bowed authored world seam; failed-input atomicity; caller mutation isolation; and one legacy call with the third guide argument. Surface/cap points are checked against independently rotated local surfaces over grids in each actual face domain. They are sampled evaluator comparisons, not a claimed exact whole-domain roundoff theorem. The existing spline/loft construction and rigid transform supply the unsampled geometry.

Inertia checks have two independent forms. A 2×1×1 rectangular prism on a certified non-permutation direction uses analytic V/C/I. The translated affine square taper uses independent polynomial slice integrals for all central moments and an explicit tensor rotation, for every cardinal frame direction. Other circle/mixed/bowed surface and mass checks use the original local Kernel builder plus an independent world rotation; these are differential checks, not independent local mass integration.

The first focused run retained in `focused-initial.txt` had **5 PASS / 1 FAIL**. The failed oracle used a local face knot endpoint in a world face whose inverse-transformed source differed by a rounding unit, producing an out-of-domain evaluation. The harness now maps the same normalized grid positions through each actual face's domain. No production change addressed that harness failure. The following related run had 100/100 PASS. A later bounded-copy guard and two additional contract/inertia tests produced the final 102/102 receipt.

Full Kernel, Model, and Studio suites were **NOT_RUN** by this Kernel lane. Parent/consumer results are recorded separately. This lane made no commit, push, or PR.

`verification.json` binds the final source, built modules, and test hashes. `artifact-manifest.json` binds the evidence files. Source and tests are frozen after the final receipts.
