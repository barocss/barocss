# D302 unchanged-native D0 forward-error certificate — 2026-10-29

Runtime source: 2f727cdd6f724b67584cf24d9b73e23bd6261f1d. A private core helper certifies the existing native position evaluator over
every finite binary64 parameter in explicitly admitted closed domains. The evaluator itself is unchanged.
It is not a replacement evaluator, a sampled acceptance test, a wrap Part or product feature.

## Actual operation path and supported source

Curve admission requires one clamped Bezier span, degree1..3, degree+1 poles. Surface admission requires one
clamped degreeU1..3 by degreeV1 tensor patch. Each exact stored span width is0.5 or1 with endpoints inside
[-1,1], so core/math.ts basisInto uses exact scale1 and its nonfinite subtraction fallback is unreachable.
All current own fields are copied/validated; coordinates are within10000 and weights[0.5,1]. Unsupported
multi-span/repeated-interior source half-walls are explicitly outside this first certificate. No source
knots/poles/weights, geometry evaluator, tolerance, public index or runtime dependency changes.

The proof follows actual distance subtraction, fraction division, saved-branch Cox-de Boor updates,
surface tensor multiplication, weighted factors, ordered coordinate/denominator sums and final projection.
It uses rho(B)=2^-53*B+2^-1074, including absolute subnormal error. Each nonnegative bound operation rounds
outward to a fixed128 dyadic fraction. Positive denominator differences are exact lower bounds, never
upward-rounded lower bounds. Explicit fraction/basis finite-range and D<=minimumWeight/2 guards exclude
zero/nonfinite native projection. Exact weighted basis partial sums bound numerator/denominator accumulation
without assuming a floating partition of unity.

The final per-axis bound is(T+A*D)/(minimumWeight-D), plus final division rounding. Only the exact full-pole
Object.is constant-axis predicate used by core/math permits a zero axis bound; the normal finite/positive
path is still proved first. Cached curve/surface evaluators retain the same bounded arithmetic, including
repeated parameters. The target is exact rational evaluation of the unchanged stored coefficients at the
represented input parameter. No derivative/normal, inverse, pcurve range/binding, topology or mass is certified.

One combined rational/direct ledger is capped at200000 operations,8192-bit integers and1048576 arithmetic
work. Counters include bound quantization and outward Number conversion. Native own-data copying/validation
has its separate finite limits; counts do not measure every CPU instruction or latency. Optional maxOperations
and L1 error budget only tighten; the default/max error budget stays the existing native linear floor1e-7.
SUPPORT rejects an unproved family or too-tight requested bound; BUDGET rejects resource exhaustion.

Bounds are in the source coordinate units. A pcurve Curve uses original parameter coordinate units; its
numbers cannot be added directly to a world-length tolerance without carrier Lipschitz/range proof. This
helper deliberately leaves pcurveBinding:false. A native error certificate must be consumed and combined
with stored-model residuals before any whole-B-rep evaluator/binding guarantee can change.

## Verification and recorded bounds

Node22.19.0 first build/changed lint and focused22/22 pass (3108.717833 ms), including10 new D0 blocks,
existing math tests and existing error-code registry checks. Independent generic BigInt rational Bernstein
oracles compare actual unchanged evaluateCurve/curveEvaluator/evaluateSurface/surfaceEvaluator on dyadic,
non-dyadic binary64, MIN_VALUE, endpoints, reversed/negative domains, native quarter and repeated cached
parameters. Mixed signs, exact negative-zero restoration/mixed zeros, extreme coordinates/weights, own
getter/malformed/unsupported templates, late/tight limits and no-alias freezing are covered. Those numerical
observations are regressions; the operation recurrence supplies the global argument. Independent static
review found no material false acceptance within this stated family. No source checksum test is added.

Whole kernel2119 total/2113 pass/0 fail/6 existing skips passes (247123.052458 ms). Code-shape/generated
tools/refusals and unchanged six-rule API inventory SCOPED_PASS pass. Docs pass68 pages/53 shots/4488 KiB/
852 labels. No public surface or API baseline changes.

* actual-native-R10-H30-original-quarter: L1<=9.381302440636469e-12, exact/direct operations43306, work76778.

* actual-native-composed-diagonal-cubic: L1<=5.924682966381498e-12, exact/direct operations41492, work74548.

* actual-native-affine-pcurve-in-parameter-coordinate-units: L1<=1.03944630680531e-14, exact/direct operations18804, work31752.

* allowed-extreme-mixed-sign-cubic: L1<=9.092726571681435e-09, exact/direct operations35613, work62803.

* allowed-extreme-mixed-sign-3x1-tensor: L1<=2.0843327064320024e-08, exact/direct operations55289, work99283.

Each record is a separate source-bound request, excluding native source/composition/assembly/moment costs.
Their counters must not be summed into an alleged accepted200k complete wrap operation. Both exact/outward
bounds and complete input data are in selected-receipts.json. No throughput or precision-of-complete-wrap
claim follows from these D0 bounds.

Model/Studio/browser/performance are NOT RUN for D302. Their last whole1824/1824 and365/365 plus types
remain D299901b4ce45. No push, PR or release. Next D303 is a single bounded family envelope on actual native
objects, including the original two-span half-walls, preserving repeated pcurve IDs by slot/full data rather
than renaming/dedup. Then complete native pcurve range/Lipschitz/residual binding, original closure and a
chosen full source/added-band mass reference remain before product wiring. Owner07->08->09 is unchanged.
