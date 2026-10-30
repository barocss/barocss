# D308 family common-denominator and equal-axis reuse — 2026-10-29

Runtime 5a8f839c23d59da27796d3335827b7c03a8c0655 changes only family error work. Context, exact rational primitives,
standalone axisError/finish and both standalone entrypoints are unchanged. One small
familyErrors routine computes common denominator terms once and reuses a completed
axis error only when exact coordinate envelope and constant flag both agree.

## Exact recurrence and authority

Factor, accumulated denominator error, the half-minimum guard and positive denominator
lower depend only on count/basis/min/max weight. They have identical operators/rounding
positions to the former per-axis path. Axis-specific numerator/residual/projection math
retains its original order. Equal scalar magnitude envelopes give the same independent
worst-case bound even when actual source functions differ; no coordinate correlation is
assumed. L1 still includes all three contributions separately, including reused values.

Source coefficients, geometry slots/IDs, domain/weight support, forced nonconstant family
flags, output conversion, budgets, tolerance and all false qualification flags stay unchanged.
The private R alias is read-only during arithmetic; every output axis gets fresh serialized
records. Prior-axis flag comparisons use familyDirect; q.compare stays on the same q ledger.
No new Context class, integer quantizer, runtime module, cap/tolerance change or dependency.

The earlier direct fixed128 arithmetic design is preserved as a comparison plan; it was
not implemented. Common deterministic work reuse gives the narrower change and retains
eta/non-grid/exact lower-difference handling automatically through existing arithmetic.

## Actual prior-build evidence and mandatory perf

Existing perf-bench native-bound-pad RUNS7 median26ms before and25ms after, fingerprint
37a018051624ef8e equal. This one rounded local pair gives no stable or Studio speedup claim.
Full native result Number fields use all64bit encodings including signed zero. Actual B-rep
bits, strict shape/count/name/diagnostic volume/centroid and every native proof field match
except10 explicitly listed changed ledger fields. Full family result except counts matches;
selected five standalone complete receipts/counts and two formal mass full-bit receipts
including their counts match. These are result comparisons, never source checksum tests.

Benchmark complete native179287->159588 operations,363775->327381work. Its D0 family phase
53915->34216operations. The distinct standard sourceZ0/U[1/16,5/16]xV[1/4,3/4] request drops
179831->160132operations, work325839, bits1187. Formal standard remains33095 including
source11544/local21551. Even retaining both full fresh source costs gives160132+33095=193227,
leaving6773 before outer coupling work. This is still planning arithmetic, not an executed
combined request. No source prefix is shared or subtracted; each fresh execution must be counted.

## Verification boundary

Node22.19.0 build/lint/code-shape pass. Focused35/35 passes (484.428875ms). Whole
kernel2156 total/2150 pass/0 fail/6 existing skips passes (246059.036125ms). Tools/refusals/
unchanged API SCOPED_PASS/docs68pages/53shots/4488KiB/852labels pass.

Independent expanded generic fractions plus ceil128 recompute all three old full axis
recurrences without common/reuse caches.30 envelope tuples cover zero,tiny,MIN_VALUE,
10000 predecessor/10000, unique axes/every equal-pair/all-equal. MIN_VALUE is stored directly.
Actual63 slots(54 curves/pcurves,9 Surfaces) and both original half-wall weight variants
retain full semantic/source checks. A reservation equal to the actual complete family count
passes and total-1 refuses BUDGET; no larger cap or weakened assertion.

Model/Studio/types/browser NOT RUN; latest whole consumer suites/types remain D299901b4ce45.
No new validation failure, source pin, schema migration, push/PR/release. Actual global source,
cap/whole-shell/reference geometry, reference-to-B-rep mass transfer and Part/product wrap
remain unqualified. Next D309 calls native binding and formal mass on the same owned frozen input with the
actual remaining operation reservation, counting both fresh source executions. Global source/
closure/reference work and consumer wiring remain separate later requirements. Original07->08->09 stays unchanged.
