# D343 independent High review

Status: FINAL KERNEL SOURCE/ORACLE REVIEW COMPLETE at the three frozen hashes below. NO REQUIRED SOURCE FINDING. Reviewer does not execute runtime, tests, builds, browser or heavy jobs and does not edit repository files. Only `/tmp/d343-review` artifacts are owned by reviewer. Root full Kernel/Model/Studio/browser/file/publication qualification remains separate.

Baseline HEAD independently read as published D342 `4ce1b35c753952010eb6961c62ccd6c6490bd01e`; current initial solid-mass.ts still has the naive power-difference h2/h3 expressions. Refreshed plan correctly pins that publication and distinguishes final D342 browser native/Part/UI assertions from its historical initial driver gap.

Required scope: only the existing longitudinal h2/h3 formulas and independent registered Node tests. No D342 guard, NURBS/numeric policy, API/schema, geometry or global mass rewrite. Retain source ownership and all first failures. Final source/manifest and owner results will be reviewed separately; test existence is not PASS.

## Mathematical review before source exists

For a,b with h=b−a, exact integrals are J1=(b²−a²)/2=h*(a+b)/2 and J2=(b³−a³)/3=h*(a²+ab+b²)/3. Factoring removes subtraction of close rounded powers; using a/2+b/2 avoids unnecessary sum overflow. Finite modeling-coordinate intermediates for the reported normal-valued tiny gap fit binary64. This does not prove correct all-finite overflow/subnormal behavior of the public explicit-slab function.

Final centroid still divides accumulated area-weighted first moments by accumulated volume. Even with factored longitudinal integrals, one-ulp physical containment is NOT a universal theorem: area multiplication/division and multi-slab accumulation can contribute rounding. If the declared exact-binary64 controls show a remaining failure, preserve exact input/result and classify the responsible stage; do not clamp, weaken closed-interval containment or invent a minimum. Source verification and actual owner evidence are necessary.

An independent oracle must decode finite binary64 values with DataView/native BigInt, normalize rational fractions, evaluate DIRECT rational power differences rather than reusing the product's factorization, and compare represented results without Number(hugeBigInt)/Number(hugeBigInt). Tests should cover1/2/4/16ulp stored intervals both signs, ordinary exact intervals, and unequal-area multi-slabs whose expected centroid is the weighted slab moment ratio rather than the whole bounding-box midpoint. Midpoint ties can equal an interval endpoint; use closed containment.

Keep h3 tensor claims to well-conditioned controls. Downstream raw-to-central second-moment subtraction and world-coordinate section Green moments are separate, unchanged sources of error. Geometry and volume/mass accumulation can be byte/numerically unchanged while corrected centroid/inertia values change. Native SI bookkeeping must remain on the same execution path; no claim that its numerical accuracy is globally certified.

The unchanged D342 guard may admit the captured native-strict-valid circle when corrected mass also passes its same-interval/midpoint policy and actual result checks. Strict-invalid polygon still must refuse from native geometry. Historical circle-mass refusal test expectations may require test-only reclassification with independently checked actual success; do not alter production guard to force it. Actual Model/UI body fields and deferred mass completion must be checked, not only separate BRep quadrature mass.

## Final three-file source and hash receipt

Read `/tmp/d343-kernel/owned-sha256.json`, receipt.md, checks.json, baseline-focused.log and volume-mass-bit-comparison.json. Independently computed current SHA256 matches every manifest entry:

- `src/brep/solid-mass.ts`: `19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac`.
- `test/prismatic-mass-stability.test.mjs`: `e2a35eae04287ebcc639b27477e1c579a2380a7a4d16b272e0c92aca7e14022e`.
- `test/helpers/prismatic-mass-oracle.mjs`: `f13d49a735e1c124adedb550c4bed4b3301eb81406dcc6de35d3865a70d8a07b`.

Independent checksum of preserved baseline-solid-mass.ts AND the published4ce1b35c git blob matches baseline-source.json `a35e85acc917126bc94bdf7aa8a7c223c9e7540612efa57a49b975e1dc7fd586`. Baseline manifest test/helper hashes equal final hashes; no assertion/oracle change between baseline failure and candidate pass is evidenced. Production diff is solely the planned h2/h3 identities at lines54-55, with h split onto its own declaration. No changes to area integration, I0/mass accumulation, central subtraction, density/error behavior, method, native SI bookkeeping, public exports/schema or geometry construction. NativeOffsetFace and numeric-policy diff against published D342 is empty.

## Independent exact arithmetic review

Oracle lines2-7 normalize every rational with positive denominator and GCD; zero becomes0/1 and division by zero refuses. Lines18-23 decode finite stored binary64 sign/exponent/fraction correctly for normal/subnormal numbers; significand includes the hidden bit only for normal values. No large-integer Number quotient is used. Comparisons cross-multiply exact rationals. stepStored adjusts unsigned encodings in the opposite direction for negative finite nonzero fixture values, correctly stepping toward increasing numeric value for the declared away-from-zero windows; it is not a general cross-zero nextafter API.

Longitudinal expectations at line35 use direct rational power differences, not the production factorization. Rectangle section moments at lines38-41 are independent polynomial antiderivatives. The10moment contributions at48 have the correct A/X/Y/XX/YY/XY combinations and longitudinal degrees. Centroid uses the full accumulated first moment divided by volume; central tensors subtract exact V*c_i*c_j, with negative products of inertia and density divided by1000 for g/cm³→g/mm³. The test-only exact density model is not a claim that the production rounded coefficient has exact real-unit arithmetic.

No arithmetic or independence defect found. Test oracle contains no production imports. Its test-only fixed fixtures do not need a public configurable rational budget or new product API.

## Test contract and scope review

Test source uses existing public prismaticExtrude explicit z0/z1, asserts their bit patterns and deep-freezes source sections/endpoints before querying mass. This avoids accidental b=a+(b−a) fixture reconstruction. verifyNormal retains BOTH an8stored-step exact-rational centroid error check AND mandatory physical closed-interval containment; no tolerance can bypass the containment assertion. The area4 rectangle permits direct unchanged volume/mass bit checks. All32positive/negative1/2/4/16step cases around.3456789,1,1024,9999 are registered and preserve midpoint ties at endpoints.

Ordinary intervals test the independently integrated full tensor under the existing1e−7 comparison. Two unequal-area slab fixtures explicitly require their exact weighted centroid to differ from the overall bounding-box midpoint; actual normal centroid and tensor must match weighted moments. The circle case is an explicit interval with native section construction and exact normal symmetry; pi is a rounded volume guide only. Density/no-positive-volume error contracts remain tested. The circle's tangent center is0 in this Kernel fixture; it is not a replacement for actual translated Model/Offset composition evidence.

No test clamp, policy relaxation, new minimum or broad global guarantee was introduced. These fixed1ulp fixtures PASS per owner evidence; they do not establish universal1ulp containment for every possible section area or multi-slab accumulation. Downstream central-inertia subtraction, 2D Green moments, overflow/subnormal extremes and other mass providers remain outside the conclusion.

## Supplied runtime evidence, not reviewer execution

Owner baseline build PASS, focused44tests25PASS19FAIL0SKIP. Read original first failure: captured-positive centroid.34375 is outside[.3456789,.34567890000000023]. Candidate build PASS, focused44/44PASS, related68/68PASS across prismatic-solid/part-model/mass-polyhedral/native-si-boundary, types/package lint/code-shape/test lint PASS. Reviewer did not rerun any of these.

Read shared result-bit comparison:43recorded baseline/candidate cases all retain identical volume AND mass bits. Captured rectangle/circle normal center changes from.34375 to.3456789000000001. The shared43 count is correct: the reflected multi-case test stopped on its first baseline failure before recording its two ordinary siblings, so this is not an assertion that every candidate observation has a baseline pair. Bit comparison is arithmetic evidence, not a native geometry checksum; geometry preservation follows the narrow source scope and frozen input checks, while actual composition qualification remains separate.

Full Kernel suite, final actual Model/Part/UI, browser, file and publication proof are NOT_RUN by this reviewer and were pending in the owner receipt. A focused/related PASS does not replace those gates.

## D342 circle source boundary and consumer caution

Reread unchanged Model nativeOffsetFace circle qualification. atLevel at194-196 and actual quarter selection at212 require every original cap arc control point's normal coordinate to equal the stored cap level exactly. Cap boundary vertex normal levels are constant and all cap support poles equal that plane at233-236. Every ruled side control row has exact common normal endpoint levels and exact equal tangent ruling coordinates at244-246. Side-base→complete cap binding requires quotient residual0 at253. Tangential circle reproduction itself is the existing whole-curve1e−7 quotient bound, not exact point identity.

This is stronger than merely observing a few original normal points within tolerance. Nevertheless, it qualifies the input and a separate prospective target. It does not certify the actual later native Boolean output. Rotated X/Y analytic/near-axis results can have normal drift, different representation/provider or cap trimming, and a tiny retained gap can be much smaller than those errors. Do not turn all historical rotated-circle errors into expected success because the prospective prismatic center now passes.

For the captured Z-upright case, require actual constant cap/curve/support normal levels and retained interval, one native closed solid/strict validity, actual tangent footprint, Model/public mass center in that interval and independent expected midpoint. Classify actual output provider and preserve original source/selection/file behavior. X/Y cases need their own actual boundary/support and normal-range evidence or remain scoped refusals/separate findings. Raw trimmed-face support poles may extend tangentially beyond a physical face; check their support plane plus actual trim boundary, not an unjustified full-pole bounding-box condition. Keep strict-invalid rectangle refusal and ordinary retries intact.

Final verdict: NO REQUIRED SOURCE FINDING in the frozen Kernel formula/oracle/test slice. Approval here is source-only and bounded; root owns the remaining consumer and product decision.
