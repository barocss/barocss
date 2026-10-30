# D302 unchanged native D0 bound: independent static review

Status: read-only, 2026-10-29. Reviewed the frozen `/tmp` certificate/test draft, the plan `/tmp/barocss-wrap-native-contract-next.md` and the actual existing core/math.ts basis/point/evaluator code. No source edit, build, lint, test, feature probe or subagent was made. The D302 draft is not treated as integrated or runtime-validated by this note.

Snapshots:
- `/tmp/barocss-native-d0-draft/core/native-d0-bound.ts`: SHA-256 a3516b5739bf0b4fd517f72d2ec99940f051bd2dfd63e3d6f0aae0d06ea89ba7
- matching test draft: SHA-256 fd10c7b381efe8d429d89e356a0019018a378cf763bf57de3700bf57be027069
- actual `packages/barocss-cad/src/core/math.ts`: SHA-256 90613a0504b96bd31a0869af1193299b088df99e4ada0f135eaf78c5bff992bf

## Result

No material false-acceptance defect was found in the reviewed forward-error recurrence, admitted operation template, final finite guards, constant-axis rule or single-call resource accounting. The theorem is conditional on the stated binary64 nearest-rounding model and unchanged stored coefficients. The exact source family is deliberately narrow; no multispan/derivative/pcurve-binding/B-rep/mass claim follows.

## Template admission and actual branches

The certificate requires a valid native Curve of degree1..3 with degree+1 poles, or a valid degreeU1..3 by degreeV1 Surface with exactly one span per axis. Native validation supplies finite numeric points, positive weights and complete clamped knots; the added range checks narrow weights to[.5,1] and coordinates to[-10000,10000]. Domains lie in[-1,1] and their width is checked with exact q arithmetic to be exactly.5 or1.

For a one-span clamped curve, count=degree+1. Both endpoint and interior span-selection paths choose span=degree. Every active left knot is the domain left endpoint and every active right knot is the domain right endpoint. Therefore all exact active distance values are in[0,h], h in{.5,1}, and the exact denominator r+l is h at every recurrence location. scale=Math.max(1,abs(left),abs(right)) is exactly1. Dividing an already represented finite distance by1 changes no value, and the nonfinite-distance fallback is unreachable.

The certificate's positive denominator lower bound excludes denominator===0, so the evaluator's zero-fraction branch is also unreachable. This is justified for this template, not assumed for arbitrary knot vectors. Negative domains, signed-zero endpoints and subnormal finite parameters do not invalidate the exact ordering or distance bounds.

An original five-pole/two-span half-wall is explicitly rejected by the pole-count gate. Certifying a copied quarter does not by itself certify evaluateSurface on the original half-wall, especially its span-selection branch at the repeated interior knot. That later transfer still needs its own operation-path proof.

## Rounding function and outward arithmetic

For a finite exact elementary pre-rounding result x, the stated model `|RN(x)-x| <= u*|x|+eta`, u=2^-53, eta=2^-1074, is conservative for normal/subnormal results. The model must not be applied across an unexcluded overflow; the admitted small-input/degree limits and finite guards provide the separate argument below.

Every positive error arithmetic operation uses q exactly and then ceils to the128-bit dyadic grid. The original eta is stored exactly; when quantized it may become a much larger2^-128 contribution, which is conservative rather than an underflow omission. Multiplication, addition and division are monotone in their nonnegative bound inputs. `lowerDifference` performs the exact subtraction of an exact lower source value and an upper error; it does not round a denominator lower bound upward. The q.bound conversion retains the exact fraction and rounds its Number upper bound upward.

## Distances/fractions and basis saved branch

With ed>=rho(1), the two rounded subtractions differ from their exact distances by at most ed. The computed sum differs from h by at most `eSum=2ed+rho(1+2ed)`. The draft uses.5-eSum as a conservative lower denominator for both admitted widths. The fraction difference satisfies

`|rhat/shat-r/h| <= (ed+eSum)/(.5-eSum)`

because r/h is in[0,1]. A separate `rho((1+ed)/(.5-eSum))` covers rounding the division itself. Neither a Sterbenz-exact subtraction nor a computed partition of unity is assumed.

For each previous-level basis error E and fraction error f, one rounded product error is bounded by

`P(E)=E+f*(1+E)+rho((1+f)*(1+E))`.

In the actual loop the saved branch is one such product, and the assigned basis value is saved plus another such product. `2P+rho(2+2P)` bounds that addition and also dominates the saved-only final basis entry. Starting at E0=0 and iterating exactly degree times therefore covers every native recurrence entry, including the first saved=0 case. All buffers read by the native loop were assigned earlier in the same call/level sequence; this matches basis() and basisInto, not a replacement Bernstein evaluator.

For surfaces, the native expression first multiplies the two computed basis values, then multiplies by the weight. The draft's tensor bound `Eu+Ev+EuEv+rho((1+Eu)(1+Ev))` covers that first multiplication in precisely that order.

## Factors, ordered partial sums and projection

For weight maximum M and basis error Eb, the factor bound `Ef=M*Eb+rho(M*(1+Eb))` is valid. For coordinate magnitude A, the rounded term error is `Et=A*Ef+rho(A*(M+Ef))`.

Exact basis factors are nonnegative and partition unity. Thus every exact partial weighted denominator sum is<=M; every exact coordinate partial numerator sum has absolute value<=A*M even with mixed-sign poles. The ordered accumulation recurrence includes the old sum error, current term error and rounding of the next addition using that exact partial-sum magnitude. It does not incorrectly assume the computed basis partitions unity or that mixed-sign partial sums are bounded by the final sum.

Let D,T bound final denominator/numerator errors and m be the exact minimum weight. The guard D<=m/2 and exact subtraction lower=m-D ensure a positive computed denominator. The unrounded rational projection error is

`<= (T+A*D)/(m-D)`

because the exact projected coordinate lies in[-A,A]. The final division rounding magnitude is bounded by `(A*M+T)/(m-D)`, giving the draft's extra rho term. The three axis errors are added outward to an L1 bound and compared exactly with the unchanged requested budget.

## Finite-range guards are sound

The new guards f<=1, final basis/tensor error<=1 and D<=m/2 support a finite/positive native path rather than assuming it. One independent coarse bootstrap is available without evaluating samples:

- rho(1) rounded on this grid is2^-53+2^-128, hence below2^-52. The computed bound eSum is far below1/4, so the distance-fraction denominator stays above1/4 and its pre-division magnitude below8.
- Applying that finite fraction bound plus the f<=1 certificate gives each computed fraction<=2 in magnitude. Starting from1, at most three small saved/product/add levels have a trivial coarse bound such as125; all intermediate operations are far below overflow before the sharper E bound is used.
- With U degree<=3 and V degree1, the tensor/factor magnitudes remain below a small fixed thousands-scale coarse bound. Eight coordinate terms with A<=10000 remain finite by a large margin.
- After the accumulated error proof, the projected denominator is at least m/2>=1/4. The numerator and its bound are finite at these fixed magnitudes, so the division and core's finite checks succeed.

These gross bounds are intentionally loose; they establish legality of using rho. The actual accepted error is the exact outward recurrence, not this coarse sketch or a hand estimate. Constant-axis restoration does not skip those finite/positive checks.

## Constant axes and cached evaluators

`ranges` uses Object.is against the first full stored coordinate, exactly matching the full authored invariant in curvePoint/surfacePoint and the cached constant predicates. Flattening the tensor in row-major order does not change that invariant. Only after the ordinary factor/sum/projection proof is completed does the returned axis bound become0. Mixed+0/-0 coefficients do not qualify. A genuinely constant negative-zero axis is restored to that exact stored value by the native code.

curveEvaluator uses the same factor/sum order and rewrites all basis buffer entries needed on every call. surfaceEvaluator reuses U/V basis buffers only when Object.is matches the last successfully computed parameter; reuse does not add rounding or accumulate error. A failed basis is not cached. Both paths have the same D0 bound while the source coefficients remain unchanged.

The certificate returns its own deeply frozen source snapshot. A consumer must evaluate that unchanged source or prove the actual evaluator source remains all-field identical. It cannot apply the certificate to a mutable curve after edits, to a stale cached evaluator whose captured source differs, or to a mathematically equivalent reparameterization without a separate binding argument.

## Ownership, one ledger and unsupported branches

Own-data copying rejects accessors, hidden/symbol/extra fields, foreign prototypes and malformed dense arrays. Source/receipt arrays and exact bounds are deeply frozen and independent of caller geometry/options. One Context is used for fractions, both surface axes, all three projected coordinates and all receipt conversions. No q context is restarted per axis or per sum. Existing200000 q/direct,8192-bit and1048576 arithmetic-work ceilings remain; options can only tighten them.

The work counter conservatively includes q operations plus its GCD/search subcounts and direct operations. Some q subwork is already inside q.operations, so this is an overcount rather than an unsafe omission. The established bounded q-checkpoint timing qualification remains: a small q chunk can run before the next aggregate check on a refusing request, while no successful certificate returns over its cap.

The module explicitly refuses other degrees, multiple spans, V degree>1, exact widths other than.5/1, translated domains outside[-1,1], weights/poles outside the family and insufficient requested error/operation budgets. It supplies D0 only; derivatives, pcurve binding, topology and mass remain false. A later combined binding request must account for all curve/surface certificates and model/Lipschitz terms together; separate successful certificates are not a fresh allowance for every coedge.

## Test evidence boundary and useful follow-ups

The ten test definitions use an independent exact Bernstein oracle rather than the certificate's q arithmetic. They include degree1..3, mixed signs, range limits, finite subnormal parameters/coordinates, negative domains, weighted tensors, cached repeated U/V, actual quarter producer data, Object.is constant/mixed zeros, owned snapshots and typed refusal/limit boundaries. The comments correctly label finite sample comparisons as regressions; the operation recurrence supplies the global authority.

No test was executed by this reviewer. Useful additional regressions are native domain[.5,1], a cross-zero shifted exact domain such as[-.75,.25], and an apparently width.5 Number subtraction whose exact represented span is not.5 (for example endpoints.1 and.6). The latter must refuse because admission uses q subtraction. The current native-quarter fixture is a direct quarter arc; it is not a claim that the distinct second half-wall weight or original repeated-knot evaluator path has been certified.
