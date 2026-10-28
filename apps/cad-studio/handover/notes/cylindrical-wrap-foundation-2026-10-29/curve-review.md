# D297 cubic rational composition: mathematical/static review

No blocking defect was found in the current temporary source or its contract. Inspected `/tmp/barocss-wrap-curve-candidate/packages/barocss-cad/src/features/cylindrical-wrap-curve.ts` and `/tmp/barocss-wrap-curve-candidate.md`. No source/candidate edit, AST execution, build, test, geometry probe or browser action was performed. Only this /tmp report was written.

## Exact composition and positivity

For u(t)=(1−t)u0+t*u1, quadraticBasis correctly returns Bernstein degree2 coefficients for (1−u)², 2u(1−u), and u². In particular the mixed coefficient of 2u(1−u) is u0(1−u1)+u1(1−u0), not twice either one term. The degree(2,1) product21 uses the correct binomial factors:

    c0=a0*b0
    c1=(a0*b1+2*a1*b0)/3
    c2=(2*a1*b1+a2*b0)/3
    c3=a2*b1.

The code forms each original homogeneous source pole as (cp_x*w,cp_y*w,cp_z*w,w), and sums the six source terms with those exact rational basis-product coefficients. It checks all coefficient weights nonnegative and each of the four partition sums exactly1. Admitted u/v endpoints are within [0,1], including reversed endpoints, so the coefficient construction has no extrapolation. Positive source weights imply positive exact cubic denominator coefficients; the explicit check is valid.

Reversing start/end does not invalidate these formulas or require a change of binomial signs. It gives the reversed parameter correspondence. The returned degree1 pcurve stores start then end, while the cubic uses the same t=[0,1]. It must not be independently reversed again for coedge sense. One constant UV coordinate is supported; identical UV endpoints and collapsed stored Cartesian endpoints are explicitly refused.

This composition applies to a general admitted six-pole degree(2,1) rational patch. It does not classify a cylinder. The contract correctly assigns source/face provenance, original/global UV normalization, radial axis/thickness and topology to a later adapter.

## Stored model and residual bound

storedCurve converts each exact denominator coefficient with q.nearest and each Cartesian pole with q.nearest(N_i/D_i), unless a copied endpoint table overrides pole0 or pole3. readStored then reconstructs actual represented homogeneous coefficients as cpStored*weightStored. Thus it does not accidentally certify an ideal homogeneous coefficient while returning a different Cartesian/weight product. Both endpoint overrides enter the subsequent full residual.

For one axis, crossResidual computes exactly:

    E(t)=Nhat(t)*D(t)−N(t)*Dhat(t).

The product of two cubic Bernstein polynomials uses C(3,i)*C(3,j)/C(6,i+j), with the correct CUBIC and SEXTIC arrays. Its seven coefficients have degree6. The index order in the two products is consistent; no missing transpose or reversed sign affects the result. A sign reversal would be immaterial after absolute value, but here the recorded sign already matches the documented identity.

Let m=min exact D_i>0 and mhat=min stored Dhat_i>0. Positive Bernstein bases give D(t)>=m and Dhat(t)>=mhat. Therefore:

    |Nhat/Dhat−N/D| = |E|/(D*Dhat)
                      <= max_i|E_i|/(m*mhat).

Summing the three nonnegative axis bounds is a conservative upper bound on Euclidean distance over the entire interval. Exact rational comparison against the error budget precedes the outward binary64 bound report. Primitive eN/eW values are diagnostic only; approval correctly uses the cross residual, preserving cancellation. The returned proof certifies exact rational functions represented by stored coefficients, not the floating operations of arbitrary native evaluators. globalEvaluatorErrorCertified=false and topologyCertified=false are appropriate limits.

## Budget, ownership and refusal boundaries

- errorBudget defaults to CadNumericPolicy.linearTolerance (1e−7); explicit values are finite, positive and no greater than that same floor. A looser caller budget cannot approve a binding. The later adapter must apply a smaller relevant B-rep representative tolerance where required.
- Source weights and generated weights stay inside the positive native range [1e−6,1e6]. Minimum denominator checks precede division by the product bound. Source and returned curves pass existing native validation; there is no weight normalization or source pole replacement.
- A single Context/SectionRationalContext is created and reused for composition, nearest conversion, stored readback, residual products and final bound conversion. Original operation/GCD/8192-bit guards remain in effect. maxOperations only tightens to a positive safe integer <=200000; checks during work and before return prevent an approved proof above that limit. No new contexts divide the work.
- surfaceSnapshot, line and options read bounded own plain records/arrays through data descriptors; getters, symbols, hidden/extra fields, sparse arrays and foreign prototypes are refused. Source/control rows, UV values and optional table endpoints are copied. The top-level catch preserves module refusals and translates untrusted inspection failures to the module's typed INPUT error.
- The result is independent of input objects. Its readonly TypeScript fields are not a runtime freezing promise; the contract explicitly disclaims proof validity after the caller mutates returned data. Binding/topology consumers must preserve that ownership boundary.

Identical actual degree/knots/domain/weight vectors remain a later radial-side construction condition. Deterministic nearest storage gives matching weights when source weight fields and UV inputs are identical, but the adapter must check those actual bits and geometric correspondence rather than infer them from a proof label. No carrier/side/trim/solid or glyph acceptance follows from this curve-only certificate.

## Applied native-domain follow-up review

The actual `src/features/cylindrical-wrap-curve.ts`, its three added regression cases, `/tmp/barocss-wrap-curve-native-domain-candidate.md`, and `test/cylindrical-wrap-foundation.test.mjs` were read after the follow-up was applied. No blocker was found. This supersedes the earlier unit-source admission limit in the first review; the unchanged cubic product/residual proof still operates on exact normalized coordinates.

The source snapshot preserves `[a,a,a,b,b,b]` and `[c,c,d,d]`, including the exact original stored endpoint numbers. For degree2 U the right-end index degree+1 is3; for degree1 V it is2. The per-knot equality checks enforce one clamped span. The helper then computes du=b−a and dv=d−c within the same q context, requires them positive and <=Number.MAX_VALUE by exact comparisons, and normalizes each native endpoint only as exact `(uv−start)/span`. The normalized endpoint range is checked exactly; there is no Number division, clamp, rewritten unit-knot Surface or intermediate rounded normalized UV.

Let the returned native pcurve be p(t)=(1−t)p0+t*p1. Exact affine normalization A obeys A(p(t))=(1−t)A(p0)+t*A(p1). Consequently the unchanged Bernstein composition represents `S_original(pcurve_native(t))`, not the surface evaluated at an accidentally doubled/local UV. The world Curve and pcurve both retain edge parameter t=[0,1], while the pcurve control coordinates remain native Surface U/V. Those are distinct domains and are not mixed by the code. Reversed native endpoints remain algebraically valid and retain their shared t direction. The original unit-domain positive contract is the special case a=c=0,b=d=1.

Finite source knot endpoints alone do not guarantee an acceptable span. An exact width above Number.MAX_VALUE is explicitly refused before normalization; zero/reversed/nonfinite spans are refused. A finite exact width need not itself be representable as one binary64 number: no exactFloat(span) or rounded-width gate is used, and the exact rational denominator handles that case. Endpoint pcurve coordinates additionally respect the existing native Curve Point range ±1e6, independently of the source/world spatial range10000. Underlying rational operation/GCD/bit limits continue to bound extreme but finite ratios.

The U[0,0.5] foundation fixture connects the original cylinder's direct-copy quarter/iso row to the map's exact original-U nodes, then passes those native U values into the composer. For that retained quarter the composer's internal U normalization is `2*u_native`, while the returned pcurve keeps `u_native`; this is the correct correspondence. Its endpoint table reuses prior stored world endpoints, and those overrides remain part of the full stored cp*w residual. No source quarter pole/weight/knot or original body is rewritten by this connection.

The fixture's Number curve/surface/trigonometric evaluations and observation slack are explicitly regression observations, separate from production interval/coefficient approval. Its strict B-rep check, one-body assertion and cylinder volume concern the original source body only. It creates curves/pcurves and shared endpoint data, not a wrapped B-rep or solid; its final aggregate-budget/wrapped-solid disclaimer is accurate. Authored unit/nonunit/reversed/decimal-span/overflow regression assertions were read, not executed by this reviewer. Root owns the current build/lint/focused results.
