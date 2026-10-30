# Thread evaluation: cached-boundary early hit (2026-10-28)

A cached boundary sample already within the existing distance limit settles `nearBoundary` as true. Returning there
avoids scanning the remaining samples. One line changes in `brep-mass-quadrature.ts`; the same `Math.hypot`, limit,
failed-search nearest sample/tie rule and golden-section refinement remain. No surface evaluator is called in that
sample loop, so early success does not change an evaluator's cache state. There is no new allocation, dependency,
geometry approximation or tolerance. The source baseline is `8dbd64aed`.

## Workloads and conditions

The existing `packages/barocss-cad/scripts/perf-bench.mjs` workloads, unchanged:

- `shaft-thread`: diameter6 shaft, height30; pitch1, modelled thread length12 on its cylindrical face.
- `tapped-hole`: 30×30×10 plate, radius2.5 hole; diameter6, pitch1 modelled internal thread.

Node22.19.0 on the same local macOS host. Each figure is the median of seven evaluations in a fresh Node process.
Order: A1, B1, restore A/build, A2, restore B/build, B2. Heavy work launched by this chat runs serially through the
local gate. External machine load is not controlled (gate load readings around18–20); these are local observations,
not statistical confidence intervals or Studio interaction latency. The initial five-run exploration was628/609ms;
use the paired results below for the comparison. Shape-check runs also calculate validity/mass and are not timing
samples for this table.

## Paired results

| Workload | A1 | B1 | Change | A2 | B2 | Change |
|---|---:|---:|---:|---:|---:|---:|
| Shaft thread | 641ms | 559ms | −12.8% | 674ms | 581ms | −13.8% |
| Tapped hole | 662ms | 576ms | −13.0% | 649ms | 572ms | −11.9% |

Separate three-run V8 CPU profiles: total sampled time4.60→4.32s; `nearBoundary` self time about0.42→0.21s
(9.2%→4.8% of sampled time). This supports the intended reduction in sample scanning. It does not assign every
wall-clock difference to that function; GC and external load also vary.

## Preserved results

Both A/B comparisons have the same whole-B-rep JSON fingerprints from the existing bench:
`63f2e23cc5a7c377` (shaft), `6e50cceb4849e3d5` (hole). Shape comparison passes. A separate snapshot also compares
body/face/edge/vertex counts, every face/edge ID and name, and the binary64 representation of every mass-property
number (including signed zero, centroid and inertia). Both cases are identical at every recorded bit.

| Workload | Valid | Bodies | Faces | Edges | Vertices | Volume, before = after |
|---|---|---:|---:|---:|---:|---:|
| Shaft thread | yes | 1 | 102 | 206 | 108 | 776.7432737085509mm³ |
| Tapped hole | yes | 1 | 92 | 202 | 112 | 8763.53687464151mm³ |

The first temporary mass comparison failed with `AssertionError [ERR_ASSERTION]: Expected values to be strictly
deep-equal`, showing `+ value: -0` / `- value: 0`. JSON had normalised the readable baseline value while its explicit
`8000000000000000` bit string was intact. Only readable values are now JSON-normalised on both sides; all binary64
bit strings still compare exactly. The corrected comparison passes. This is a result comparison for performance
acceptance, not a test pinned to source-file checksums. No source checksum test was added.

## Verification and limits

Final whole kernel:1974 total,1968 pass,0 fail,6 existing skips. Build and whole kernel lint pass. Related Model
thread/fastener/depth tests pass23/23; agent-tools/refusals and whole docs checks pass. Whole Model/Studio and browser
flows were not repeated for this optimisation; D289 records the earlier full window. See D290 for that proof boundary. An independent read-only review
found no semantic change in success/failure, tie handling, evaluator caches or the whole-patch choice consumed by
STEP bounds. Other workloads and the earlier upper thread timing range are not remeasured. No Studio latency,
WebGL2/mobile, GPU, release or global performance claim is made.

Reproduce from `packages/barocss-cad`, after the required build, on each side of this one-line change:

```sh
BASE=/tmp/thread-before.json RUNS=7 node scripts/perf-bench.mjs save shaft-thread,tapped-hole
# Rebuild with the candidate before compare.
BASE=/tmp/thread-before.json RUNS=7 node scripts/perf-bench.mjs compare shaft-thread,tapped-hole
SHAPE=/tmp/thread-shape.json node scripts/perf-bench.mjs shape-save shaft-thread,tapped-hole
# Save shape on A; compare it on B.
SHAPE=/tmp/thread-shape.json node scripts/perf-bench.mjs shape-compare shaft-thread,tapped-hole
```

Raw paired logs, CPU profiles, shape records and full mass-bit snapshots remain in the session scratch directory
(`/tmp/barocss-thread-*`); they are not committed as product assets.
