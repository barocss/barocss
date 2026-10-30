# Cylindrical wrap assembly cache review

Scope: read-only static review of the frozen private assembly module and its test. No source/test edits, feature probes, build, lint or tests were run for this review. This review does not turn the diagnostic into a qualified solid or certify native floating-point evaluation/mass.

Reviewed file snapshots:
- `packages/barocss-cad/src/features/cylindrical-wrap-assembly.ts`: SHA-256 39355c9150cb9ca7d504f06005a0b9071f82b8028e6054b536d0760ef2288833
- `packages/barocss-cad/test/cylindrical-wrap-assembly.test.mjs`: SHA-256 4c5321d61e189fdb8b321ddd3a40892e35ff7a7f823472e60e77d5a6c91c1f67

## Finding: aggregate acceptance cap is enforced after a helper finishes

At assembly lines 405–406, `horizontalBase` invokes `composeCylindricalWrapCurve` without its available `maxOperations` option, then adds the returned exact-operation count with `countHelpers`. `Context.check` (lines 103–104) correctly refuses an accepted aggregate over 200,000. However, a request that already consumed most of that aggregate can run one more composer with the composer's full independent 200,000-operation allowance before refusal.

This is a bounded refused-request execution overshoot, not an accepted receipt undercount or a geometry false acceptance. Each helper still has its own fixed rational/GCD/bit limits. If the claimed 200,000 limit is a strict global execution limit, compute the remaining aggregate allowance before the call, refuse if none remains, and pass that allowance through `maxOperations`; retain the post-call aggregation as a second check. Charging a finished helper afterward cannot enforce a pre-execution global cap. No change was made here.

The accepted aggregate does include the source carrier's rational work (line 528), every cache-miss horizontal composition (405–406), and the assembly's own q context. Horizontal hits genuinely reuse exact XY coefficients and certified errors instead of silently starting another context. Carrier fixed-integer work is separately included in the work counter; it is not represented as rational operations.

## No material cache/binding defect found in the reviewed source

- **U-span template identity and canonical reversal (400–418):** source extraction constrains the quarter to native U[0,0.5], and ring admission keeps endpoints strictly interior. Thus the numeric-string unordered U key has no signed-zero alias. A hit can only refer to the same two U endpoints. Reversing the cubic poles and weights preserves the unit clamped cubic basis. A fresh pcurve retains the actual start/end native UV and canonical edge t direction; coedge sense remains independent.
- **Horizontal V transfer (368–375, 410–418):** the admitted source is exactly V-independent in XY and weights and affine in Z. The template's X/Y coefficient residual bounds therefore remain valid at another constant V. Replacing every stored Z pole by the one nearest represented exact axial value gives an exactly constant rational Z function. Its exact rounding error is added to the retained X/Y bound. The old template's Z residual is not incorrectly transferred.
- **Shared endpoint radial values (377–398):** a horizontal whole-span XY certificate also bounds its endpoint at that U for every V of this extrusion. A later cached ray must retain bit-identical stored XY. Keeping the older error when the stored point is identical remains conservative because that older error already bounds the same exact source ray.
- **Vertical direct cubic (420–431):** at fixed native U the source is constant XY and exactly affine in native V. The cubic uses uniform weights and a degree-elevated affine exact-Z target. The maximum absolute per-control Z storage residual bounds the entire Bernstein interval, including reversed V direction. Adding the exact/cached XY ray error is a valid world L1 bound. Candidate Number interpolation is accepted only when exactly equal to the rational target; otherwise q.nearest is used.
- **Angular guard reuse (246–257):** reused XY poles and weights are checked bit for bit, with reversal. Reversing t reverses and negates the angular numerator polynomial; applying the authored U direction sign leaves the certified signed minimum unchanged. The cached proof contains no V-specific Z assertion. Constant Z is checked again before reuse.
- **Exact factor-2 outer clone (439–450, 465–467):** finite binary64 multiplication by two is exact here, and output range checks prevent overflow. The outer source also uses that exact diag(2,2,1) transform. Its L1 operator norm is two, so `outerError = 2*base.error` is conservative. The unchanged tolerance/16 and tolerance/8 admission gates agree with this bound; weights and endpoint table values remain identical as required.
- **Diagnostic boundary (565–568):** `solidQualified`, `representedVolumeCertified`, `globalEvaluatorErrorCertified` and `generalTextSupported` remain false. Strict B-rep checks and analytic boundary regularity are not represented as mass or floating-point certificates.

## Test coverage observations (not executed)

The frozen tests structurally cover horizontal cache reuse with different V, reversed horizontal parameter direction, a separate stroke and counter, copied source records, canonical pcurve direction on reversed coedges, exact radial cloning, unchanged tolerance budgets and aggregate accepted counters. Sample comparisons are explicitly regression/wiring checks, not the full-span certificate.

The existing nonzero-Z fixture uses z0=7, height=32 and dyadic V, so its axial values are exactly representable. It does not exercise a nonzero axial rounding error after transfer. This is a focused test gap, not a found defect in `axialAt` or `horizontalBase`. A later test can use non-dyadic represented z0/height/V and assert the exact residual receipt includes that rounding without changing the budget.

The many-components refusal test does not isolate the late global-cap issue above. No run result is inferred from reading its expected refusal.
