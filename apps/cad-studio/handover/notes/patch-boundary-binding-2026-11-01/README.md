# D417 — Reject proven surface boundary mismatches

Status: **BOUNDED QUALIFIED**. Tier: **full**. Base `c5fe3dcda`. [Counts, commands and scope](qualification.json) are the numeric record. Sol High owns geometry, exact mathematics, producer ownership and independent review; Sol Medium owns ordinary verification, the typed error adapter and actual Studio driver.

## Reproduced defect

The #2266 limit assessment first found a defect inside the original limits. An independent degree (1,2), 4×3, unit-weight surface is exactly `S(u,v)=(u,v,1+tent(u))`, with `e=1/256`; the tent rises to 1 at e and returns to 0 at 2e. Its authored box edges stay on z=1. Uniform boundary samples miss the short tent. Original normal/strict checks and wholePatch accept it; mass and STEP report the flux of mismatched faces while the mesh misses the peak.

This is an invalid boundary binding accepted as a solid. The reported flux is not a volume error of a valid solid. The same-parameter z discrepancy is 1 mm; the closest edge-point/surface distance is `1/sqrt(65537)`, about 0.00390622 mm, not 1 mm. The original code reports no gap despite a declared tolerance of 1e-7 mm.

## Bounded correction

A private exact proof targets a uniform-weight tensor extrusion of a Cartesian piecewise-linear graph. At graph breaks and straight-edge endpoints within that edge's own coordinate interval, it compares the height residual with a global slope bound using reduced rationals. `delta² > tolerance²(1+L²)` proves that a point of the incident edge is farther than its declared tolerance from the entire surface. Otherwise it makes no invalidity claim. Coordinate permutations, parameter/edge reversal, common weights, local trims and exact threshold cases are covered.

Normal/strict checking and direct mass, area, quadrature, tessellation, STEP reading and writing refuse before caches or fallbacks can conceal the contradiction. Proof-budget exhaustion remains CAPABILITY. The public part evaluator preserves GEOMETRY/CAPABILITY only for the actual central KernelError class and the exact new source; unknown, spoofed and legacy paths retain their behavior. No message substring is used as error authority.

The declared edge tolerance is intentionally stricter in this family than the legacy loose sampled check. No tolerance is widened and no geometry is repaired. NURBS limits, fitters, splitting, schemas, dependencies and public signatures are unchanged. This does not certify general surface binding or whole-patch classification.

## Mesh conversion contract and performance

A live scan initially regresses B9 cached queries. Failed full-suite, isolated and scratch-filter measurements remain FAIL in the qualification. No benchmark deadline was widened.

For fresh native 2×2 output from `brepFromTriangles`, the producer now fixes its owned B-rep/face/surface record properties, face list and knot arrays after complete validation. Only then does a private record permit skipping this one proof: fixed degree 1 and 4+4 knots can never enter its valid graph family. Inputs, other nested coordinate/weight data, raw caller B-reps and FacetPatch data are not frozen. Copies/transforms do not inherit the record. This is an intentional runtime restriction on this producer's headers and knots, documented in the package and API docs. Structural edits require a deep copy; shallow copies can share fixed objects. Numeric caches already treat each B-rep as a value, so coordinate edits also require a new value for evaluation.

B9's cached pair returns below its original 1 ms deadline. The separate complete constructor comparison measures about 55 ms extra work on 40,000 triangles in one fixed observation; all serialized geometry bytes match. This cost is recorded rather than hidden outside B9's timer. Mutable raw values still incur a live scan; there is no general constant-time cache claim or geometry/mass certificate.

## Verification and actual Studio

The qualification separates the full geometry checkpoint, later error-only adapter checks, overlapping focused tests, independent mathematical/ownership probes and two mutation groups. The full run is not repeated after the error-only adapter. An order-sensitive API inventory initially fails: complete AST review finds only union-member order differences, independently checked with canaries. Exactly those representations are refreshed; the generator and semantic types are unchanged. Only two existing generated refusal-catalog rows are synchronized.

Actual run01 passes four automated states: flat STEP box; valid nonplanar roof; invalid STEP refusal with the exact roof document retained; and STL cube → mm → Auto STEP preparation → Cancel. Passive observation of the real worker reply checks the prepared native planes; no response is mocked. Root and independent review accept the geometry and owned-producer preview, but reject the 'unexpected kernel failure' prefix on the expected refusal.

After the narrow typed adapter fix, run02 repeats only the roof-Open prerequisite and failed refusal stage. The expected reason is visible without that prefix, and the roof/document remain exact. Both reviewers accept the two images. Flat/STL successes remain separately scoped run01 evidence; this is not a final-source whole-four-state rerun. Both runs preserve frozen sources, record no page/console errors or downloads, and close all owned resources.

## Preserved failures and remaining scope

The numeric record retains the original wrong success, two test-factory/oracle mistakes, cached-performance regressions and failed prototypes, a producer/inspector import preflight error, initial API/catalog failures and run01's classification defect. None is relabelled as a historical pass. Raw logs, images, generated STEP/JSON and large byte comparisons remain under `/tmp`.

No OCP reinstall, external reader download, paid call, outbound Save/export download, full R5/RB campaign, CI, release or develop integration was run. Source hashes detect changes; they are not geometric ground truth. #2263/#2266 remain open for their wider acceptance, and #2262 is not implemented. Degree/pole widening is deferred. The owner raised roadmap size; future status updates should remain short and link to this item rather than duplicate its record.
