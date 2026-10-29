# D344 bounded native-quadrature reproduction harness

## Status and ownership

SOURCE_ONLY / runtime, build, benchmark and source edits NOT_RUN. This prepares the existing16/CG10 provider diagnosis after D343 is qualified and published. Re-pin the published SHA, current dist/source hashes, actual run03 B-rep and all readback names before running. No new work queue or implementation is authorized by this note. Current source remains frozen for D343.

The captured run02 native target is /tmp/d343-studio/run-02/04-captured-thin-native.raw.json. It has the D343 physical interval[.3456789,.34567890000000023] and valid native geometry. Its old cap names are pre-identity-repair evidence; do not treat those names as final published names. Use the identical geometry with corrected names from the eventual accepted run03 file when available. Existing observations establish native volume/tangent-centroid discrepancy, not its arithmetic cause.

## Immutable input and evidence contract

One root-granted exclusive Node22 job acquires the existing heavy gate and releases it with an EXIT trap. Everything generated is under /tmp/d344-probe. No Model or browser state is mutated. Save original raw JSON, selected target key/ref, complete poles/weights/knots, native validity/structure/names, source SHA/file hashes, Node path/version and input hash before any provider call. Confirm exact input hash after every classification. Preserve the first error/null/fallback and all method labels rather than forcing a different integration route.

The baseline public call is brepMassProperties(exactTarget,1); brepSurfaceArea and brepQuadratureIntegrals are separately labeled public-source/provider observations. Use a newly owned B-rep per uncached sample. Reusing the same object hits solid-mass.ts quadratures WeakMap and does not measure/reproduce cold integration.

## Source-bound classification harness

Production module source is copied into a temporary esbuild bundle through an explicit onLoad transform. Save original/transformed bytes, transform patch, source hash and complete metafile. Insert bounded observation only: face dispatch (facet/planar/wholePatch/rest), before/after eleven centered integral deltas, setCentre values, wholePatch decision, and raw fromCentre return. Do not patch branch results, basis values, nodes, arithmetic order, tolerances or fallback behavior. Exporting private locals in this temporary bundle is an instrumentation seam, not a new public API. Compare its final provider output to the untouched production baseline before using its internals as evidence; mismatch means HARNESS_FAIL and stop diagnosis.

Actual source locations: brep-mass-quadrature.ts149–159 dispatch,619–625 existing center,631–634 world reconstruction,721–737 batched whole-patch rule,743–780 basis,784–795 uSums,799–813 quotient partials and accumulation. The existing side-route hypothesis is valid only if actual wholePatch is true. If either side takes rest/trimmed-domain integration, record that and revise the trace; do not force the fast path.

For the captured expected two curved sides, each native surface has degreeU2/degreeV1, five U poles/two V poles, two U Bezier spans and one V span. The source rule is13 Gauss nodes in U and11 in V: at most2faces*2spans*13*11=572 side-node records. This is a source-derived fixture count, not a new product budget. Two planar caps have2 half-circle edges each,2 knot spans per edge,12 boundary nodes and4 field nodes:384 possible field accumulations. First phase need only capture cap integral deltas; independently reconstruct their384 field samples only if side errors fail to explain the result. Unexpected counts are a fixture-classification failure, not silent truncation.

Record binary64 nodes and rule weights as hexadecimal bits, actual span endpoints and computed parameter values, N/D arrays, original homogeneous Pw, R/Ru columns, projected point/partials/normal, sense, composite weight and per-node field contributions. Copy active reusable arrays when observed. Do not hold aliases that the next sample mutates. Limit the trace to this fixed4face fixture and its declared controls.

## Independent rational oracle at exactly the stored nodes

No production geometry/math imports. Decode every finite binary64 coefficient, knot, parameter and Gauss weight to exact BigInt rational numbers. Reject nonfinite inputs explicitly. The exactness claim is arithmetic at the stored quadrature nodes, not exact integration of the surface or exact pi.

Use TWO independent layers:

1. Exact polynomial basis at each stored parameter. On the captured quadratic Bezier U span[a,b], t=(u-a)/(b-a), N=[(1-t)^2,2t(1-t),t^2], dN/du=[-2(1-t),2-4t,2t]/(b-a). On the V linear domain[c,d], vbar=(v-c)/(d-c), M=[1-vbar,vbar], dM/dv=[-1,1]/(d-c). This layer isolates basis recurrence rounding. Do not infer partition unity from the already rounded production arrays.
2. Exact arithmetic with the OBSERVED production N/D binary64 values. This layer isolates homogeneous multiplication/sum/subtraction/quotient rounding after basis generation. Compare Pw against exact original pole*weight, R/Ru against exact sums, then projected derivatives/normals against exact quotients. Keep these results separate from layer1; rounded derivative arrays may themselves violate structural zero identities slightly.

Verify native paired ruling hypotheses directly before asserting them: tangent coordinates and paired positive weights equal, V endpoint levels constant by column, knots as captured. If they hold, exact layer1 gives Wv=0, Sv tangent=0, Sv normal=(zColumn1-zColumn0)/(d-c), and Su normal=0. The two column levels are ordered by native parameterization; use their signed difference, not sorted endpoint height, for reflected controls. Neither integer inputs nor approximate coordinate coincidence is sufficient. Compare normal-relative derivative errors and cross-product terms by node/angular span. Report exact denominators and converted values; no tolerance is added to production.

Compute exact-at-stored-node centered field contributions using the same STORED center as production, rational compound Gauss weights and signs. Also compute using the production already-rounded composite weight to isolate that multiplication. Sum in fixed face/span/i/j order and record separate face contributions. Compare centered integrals before fromCentre, then exact world reconstruction and exact division byV. This separates derivative/field accumulation errors from raw-to-central cancellation. Area contains a square root: report its pointwise squared norm exactly and use a separate high-precision/enclosure stage; do not label a rounded sqrt rational-exact.

The independent native geometry check is a radial circle-equation homogeneous coefficient enclosure on all four stored rational arc spans, with positive-weight minimum and explicit rounding bounds. It bounds deviation from the declared circle, then bounds the rounded-pi volume/symmetry guide. Numerical node arithmetic and analytic guide are distinct. Do not use upright prismatic mass as the sole oracle. Inertia remains separate because world raw conversion can lose tiny centered moments even ifV/C improve.

## Declared controls

- Exact captured native geometry, both untouched and independent node oracle.
- Same paired native support with normal origin shifted near0, preserving h exactly when the represented subtraction is exact. Record every actual stored coefficient difference; mathematical translation and rounded reconstructed geometry are distinct.
- Ordinary translated cylinder with h.001 and h5.00009, same tangent profile; reflected normal interval and exact cardinal axis permutation/sign changes. Use native coefficient transforms, not unsupported XY tiny Offset composition.
- Original pre-Offset cylinder and visible ordinary+2 result, when accepted native files exist.
- Caps-only and sides-only integral deltas; density1 and one established MMGS density control after numerical diagnosis.

No collapse, centroid clamp, volume correction factor, global tiny-body refusal, changed knot/tolerance, geometry rewrite or new generic evaluator is part of the probe.

## Local-integration option, not an implementation choice

If node evidence establishes pre-accumulation cancellation, the narrow option is local homogeneous coordinates BEFORE q*w and uSums. For a fixed center c, compute Hlocal=sum(N*(P-c)*w), unchangedW; derivative quotient is translation-invariant in exact arithmetic. Pass projected LOCAL point and the same derivative normal into a local field accumulator. Re-adding c and then subtracting it in accumulate would discard recovered tiny coordinates. Keep planar/trimmed-face fields in the same chosen origin and apply fromCentre once. The difference P-c is itself binary64 arithmetic; require independent error accounting and ordinary controls rather than claiming exact local geometry. No shared core surfaceEvaluator change is justified merely because it has analogous source arithmetic.

A second possibility is a face-local anchor with a rigorously derived shift of the face's moment contribution into the body integration origin. That is a larger bookkeeping change and is not the initial recommendation. Do not sum moment tensors expressed about different anchors. Existing center/global mutable state and cached provider behavior must remain explicit.

## Acceptance and performance sequence

First diagnose with immutable baseline and oracle. Root chooses the correction only after actual branch/node/error evidence. Then registered tests should assert independent native material/symmetry/bounds, ordinary/reflected/cardinal controls, unchanged error/method/density behavior, input ownership, strict geometry/names/endpoints, and raw-vs-central limits. Relevant native mass/area tests and one final full Kernel run belong after source freeze. STEP default validation-property export is an actual traced consumer; demonstrate its readback before claiming external export repair. An upright Studio mass panel does not exercise native quadrature.

If an optimization is proposed, run the existing packages/barocss-cad/scripts/perf-bench.mjs BEFORE any product edit and AFTER the final candidate, same Node22, serial gate/host/build, selected cases and RUNS setting. Save baseline artifact, exact geometry fingerprint, native names/counts and timings. Existing runner creates fresh geometry each sample and fingerprints outside timed work; distinguish construction+first-mass from cached mass, and never subtract medians to claim pure mass timing. Add a narrowly scoped cold-quadrature case only under an explicit later edit grant if existing cases do not exercise this path. Pair the captured small fixture with an ordinary rational multi-span body to reveal per-pole/span overhead. A changed accuracy result must be compared to its independent oracle; do not demand bad old mass bits or hide changed values inside geometry-equality claims. Report raw repetitions, median/dispersion and workload limits. No speed or regression claim follows from this source-only plan.
