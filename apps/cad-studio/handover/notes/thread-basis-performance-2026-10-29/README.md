---
work_id: D314-thread-performance
artifact_type: performance-and-correctness-evidence
status: verified
owner_role: geometry-reviewer
source_request: Measure thread performance and keep only a demonstrated improvement while preserving numerical and geometry contracts
last_updated: 2026-10-29
---

# Thread quadrature: measured selection

The retained change skips a cached boundary sample's `Math.hypot` when one absolute coordinate difference is strictly
greater than the best distance already found. The basis-table cache candidate was measured and rejected.
Retained runtime commit: `bb92da70b`.
The runtime baseline is D313 `f29df9217cf913cc1493f122a808075e5218d411`. Production changes are confined to
`packages/barocss-cad/src/brep/brep-mass-quadrature.ts`, four added lines and one removed line. There is no cache,
new tolerance, reordered sum, surface approximation or public API. The existing D290 early hit remains intact.

## Measured selection

All measurements use Node22.19.0 on the same local macOS host, one heavy process group at a time through the gate.
Each table entry is the existing bench's median of seven evaluations in a fresh Node process. Execution order was
A1(original), B1(basis), B2(basis), A2(original), C1(component bound), C2(component bound), A3(original).
External host load was not controlled. Logs contain rounded medians, not individual evaluation times or confidence
intervals. These are local workload observations, not Studio latency or a general speedup claim.

| Fixed case | A2 | C1 | Change | A3 | C2 | Change |
|---|---:|---:|---:|---:|---:|---:|
| Shaft thread | 543ms | 531ms | -2.2% | 529ms | 525ms | -0.8% |
| Tapped hole | 543ms | 536ms | -1.3% | 544ms | 548ms | +0.7% |
| Long shaft thread | 2060ms | 2005ms | -2.7% | 2134ms | 2044ms | -4.2% |
| Long tapped hole | 1295ms | 1259ms | -2.8% | 1305ms | 1270ms | -2.7% |
| Direct long construction | 19ms | 20ms | +1ms | 19ms | 21ms | +2ms |
| Fresh direct long construction + first mass | 272ms | 254ms | -6.6% | 273ms | 261ms | -4.4% |

The retained candidate has a repeatable benefit for the measured long-thread requests. Short cases and construction
alone do not establish a meaningful improvement. The last case times fresh construction plus its first mass query;
it is not mass alone. Do not subtract the construction median to infer a pure mass time. Construction-only cases
calculate their acceptance mass after the timer stops, in the bench fingerprint path. All seven processes retain
the same complete B-rep JSON and, for the new cases, mass-bit fingerprint per case.

The new fixed cases are a diameter6/pitch1 shaft of height90 with thread length60; a 30x30x40 plate with a radius2.5
hole tapped to diameter6/pitch1; and a direct diameter6/pitch1 thread of length60 at seat60. Existing short cases are
unchanged. The source bench includes the distinction between construction and construction plus first mass.

The baseline combined CPU profile (short shaft, short hole, direct fresh construction + first mass; seven runs each)
records11.41s total. `patchIntegrals` is0.10s and `spanBases` about0.04s. A direct488-face long thread makes948 basis-table
requests but has only two distinct tables,474 occurrences each. The64-entry call-local snapshot-key cache therefore
removes repeated work but does not remove a large measured cost. A1/B1/B2/A2 direct first-mass medians are271/274/272/272ms.
The cache produced no consistent improvement and is absent from the final source. Its source/module and negative
results remain in this folder.

The selected target is larger: `nearBoundary` self samples fall from1.07s to0.79s; `wholePatch` inclusive samples fall
from1.80s to1.48s in equivalent before/after profiles. Overall sampled time is11.41s then10.66s; GC and other work also
vary. These profiles support the intended reduction in boundary-scan cost without attributing every wall-time change
to that function. Other large costs remain surface evaluation, `basisInto`, Boolean inversion and GC.

## Preserved contract and proof boundary

For every previous sample that did not return, `bestD` is above `near` (or `near` isNaN). A component strictly greater
than `bestD` cannot produce a smaller norm or satisfy the early-hit comparison. Equality still executes the original
`Math.hypot`, so strict nearest-sample ties retain their original first winner. The three subtractions keep their
original order. Skipped samples do not call the surface evaluator. Every candidate that can win still uses the same
`Math.hypot`, the same threshold and the same strict-`<` nearest update. Golden-section refinement is unchanged.

The actual geometry path validates surface/curve points and weights; evaluators require finite returned coordinates
(`core/math.ts` validatePoint, project and projectXYZ). Tests also compare exceptional diagnostic inputs rather than
assuming that all private helper callers are admitted geometry. The component-bound premise was checked on the
executed Node22.19.0/V8 engine with729 boundary combinations plus10,000 finite binary64 triples. Other JS engines were
not executed. This is not an exhaustive proof of every engine's `Math.hypot` implementation.

The five dedicated tests invoke the actual built private predicate. A memory-only export grants test access after
relative imports are relocated; production exports remain unchanged. An independent pre-optimization full scan
provides the reference. Tests compare returned/thrown outcomes and every surface-evaluator argument bit in order:
threshold and adjacent floats, first ties, no-hit refinement, evaluator failure,NaN, infinities, overflow,
subnormal values, signed zero, negative thresholds and120 varied cached grids. No source checksum or source byte
expectation is pinned by the suite.

`compare-local.mjs` loads the frozen original module independently of the retained module, then compares full
raw11 results at8/16 segments, meshed/squared/cubed/dropped state, public mass, area and native SI bits. It compares
the actual boundary decision and surface-refinement argument trace too. Eleven fixtures pass: short and long shaft
and tapped hole, direct long thread, left thread, polynomial/rational bump, multi-span shifted domain, signed-zero
domain and the existing frozen22-face partial-trim bevel pair. Input arrays remain equal. A repeated direct raw
query after in-place pole/knot/weight edits also matches. Public comparisons use fresh clones because the existing
public mass path has a B-rep-keyed immutable-value cache.

`capture-actual.mjs` separately constructs all six benchmark outputs in before/after Node processes with the actual
original/retained quadrature module in the normal graph. It compares every geometry/name/control/knot/weight/vertex
Number bit, all mass/native SI/area bits, validity and body/face/edge/vertex counts. Full records are preserved in
`actual-before.json.gz` and `actual-after.json.gz`; both complete bit trees are equal. Other geometry records and the
full partial-trim boundary trace are gzip-compressed without changing their decompressed bytes.

## Verification and retained failures

- Full Node22 library build: PASS (`build-bound.txt`).
- Kernel lint and code-shape: PASS (`lint.txt`).
- Focused six files:27 pass,0 fail,0 skip (`focused-final.tap`), including the five new predicate tests.
- Old-module raw11/mass/area/nativeSI/actual boundary trace:11 fixtures PASS (`equivalence.json`).
- Separate actual construction/geometry comparison: six cases PASS (`actual-comparison.json`).
- Final full build and kernel2198total/2192pass/0fail/6existing skips PASS;247815.458666ms (`full-kernel-test.txt`).
- Model1833/1833 PASS,0fail/skip;232937.926667ms (`full-model-test.txt`).
- Studio365/365 PASS,0fail/skip;28517.577459ms (`full-studio-test.txt`).
- Generated tools/refusals/unchanged API six-rule check and docs PASS:68pages/54shots/4668KiB/858labels (`docs-final.txt`).
- Consumer types retain D313 coverage: public contracts are unchanged and were not re-run. Browser flows: NOT RUN here; D313 wrap has its separate actual product receipt.
- Parent retained runtime at `bb92da70b`; this lane made no commit, push, PR or release.

The first build launch did not execute: its log path was one directory too high, and zsh rejected a reserved
`status` variable. Corrected both and completed the full build; `build-first-launch-failure.txt` retains the original
output. The first extra construction-snapshot harness failed to resolve an absolute file path from a data URL.
Changing it to a file URL fixed the harness; `capture-before-first-failure.txt` retains that error. These were harness
launch failures, not numerical or geometry differences. The five predicate tests and the27-test final run passed on
their first executions. The source snapshots in this folder are evidence, not alternate production modules.

Reproduce after the required build, from the repository root, through the heavy gate:

```sh
RUNS=7 BASE=/tmp/thread-before.json node packages/barocss-cad/scripts/perf-bench.mjs save shaft-thread,tapped-hole,shaft-thread-long,tapped-hole-long,direct-thread-long-construction,direct-thread-long-construction-first-mass
node apps/cad-studio/handover/notes/thread-basis-performance-2026-10-29/compare-local.mjs ./bound-brep-mass-quadrature.mjs
```

Use the preserved original/retained modules in separate processes for paired/reversed measurements. Restore the
retained full-build module afterwards. `baseline-identity.json`, `performance-comparison.json`, `validation.json`
and `artifact-manifest.json` give the baseline, medians, check scope and exact artifact hashes.
