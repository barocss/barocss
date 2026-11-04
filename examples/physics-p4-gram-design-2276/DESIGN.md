# Pair-local Gram and mixed-determinant SAT design

Status: READ_ONLY_MATHEMATICAL_DESIGN. No candidate implementation, numerical operation, model/helper/reference/auditor/World/compiler/browser execution occurred. All ended cache, NodeSAT, position-proof and direct-grid candidates and their first failures remain unchanged. A new candidate is justified as an algebraic experiment, not as an established cost improvement.

## Exact representation to preserve

Use the unchanged original body preparation and common coordinate lifting. For ONE pair and ONE convention, let A0..A2 and B0..B2 be the actual integer basis columns, with their original positive denominators da,db. Let hA,hB and delta=CB-CA be the original common-lift integer extents and center difference, with coordinate denominator2^t. No column is normalized, divided by a GCD, replaced by a unit vector or assumed orthogonal. Raw quaternion bases are generally nonorthogonal.

Let Q=da*db and D=2^t*Q. Preserve that EXACT D for every original axis, not merely a rescaled equal physical margin. Axis order remains A0,A1,A2,B0,B1,B2, then Ai×Bj with i outer/j inner. Axis denominators for old near-parallel classification remain da,db,Q respectively.

## Bilinear and alternating coefficient tables

Compute AAij=Ai·Aj (six upper entries, symmetric references), BBij=Bi·Bj (six), ABij=Ai·Bj (nine). These are21 scalar Gram coefficients, not support radii. Also compute the six signed face-center projections delta·Ai and delta·Bj.

Fix cyclic vectors EA=(A1×A2,A2×A0,A0×A1), EB=(B1×B2,B2×B0,B0×B1). The27 SIGNED mixed coefficients are:

- TA[r,j]=EA[r]·Bj: nine AAB determinants.
- TB[i,r]=Ai·EB[r]: nine ABB determinants.
- TC[i,j]=(delta×Ai)·Bj: nine center determinants.

For Uij=Ai×Bj, the signed A-support projections over k=0,1,2 are:

| i | A_k·Uij |
|---|---|
|0|[0,-TA[2,j],+TA[1,j]]|
|1|[+TA[2,j],0,-TA[0,j]]|
|2|[-TA[1,j],+TA[0,j],0]|

The signed B-support projections over k=0,1,2 are:

| j | B_k·Uij |
|---|---|
|0|[0,+TB[i,2],-TB[i,1]]|
|1|[-TB[i,2],0,+TB[i,0]]|
|2|[+TB[i,1],-TB[i,0],0]|

The critical identity is Bk·(Ai×Bj)=Ai·(Bj×Bk), the NEGATIVE of Ai·(Bk×Bj). For A, Ak·(Ai×Bj)=(Ak×Ai)·Bj. For the center, delta·(Ai×Bj)=TC[i,j]. These identities hold for arbitrary integer vectors, including nonorthogonal, parallel and degenerate columns.

All tables are plain bounded coefficients local to this pair/convention. They are discarded before another pair or convention. No keyed memo, hit/miss path, saved radius, complete-key construction, Decimal Context/flag replay, cross-frame state or persistent support result exists. Extent weights are applied freshly to each requested axis, after the coefficient tables are built. Exact self-zero determinant terms may be omitted by their algebraic identity; no axis is omitted.

## All15 exact N,D,S values

For axis Ai, use S=AAii, A-support sum(hA[k]*abs(AAki)), B-support sum(hB[k]*abs(ABik)), and center abs(delta·Ai).

For axis Bj, use S=BBjj, A-support sum(hA[k]*abs(ABkj)), B-support sum(hB[k]*abs(BBkj)), and center abs(delta·Bj).

For cross axis Uij, Lagrange's identity gives S=AAii*BBjj-ABij². Use the signed projection tables above inside the original weighted absolute support sums and center abs(TCij).

For EVERY nonzero axis, assemble the SAME integer numerator as the direct method:

`N = supportA*db + supportB*da - center*Q`.

Its signed physical margin is N/(D*sqrt(S)). There is no fraction reduction or homogeneous rescaling. S is exactly the direct squared cross product, not an approximation. A negative Lagrange S is an error; never clamp it to0. Preserve exact-zero classification, the original nonzero edge near-parallel test S*10^24<axisDen², marginSign, strict signed-square first-minimum/tie behavior and every original axis index. A near-parallel nonzero edge remains visited and eligible under the old exact protocol. The original separate scalar Float64 selector remains unchanged and never consumes the exact winner to choose a normal/point.

## Source-level work map, not a timing result

The direct model constructs nine cross vectors. Each visited axis performs its squared-norm dot; each nonzero axis additionally performs six support dots and one center dot. Thus dot3 count is15+7*M, where M is the number of nonzero axes.

The factored model uses21 Gram dots,27 signed mixed/center dots and six face-center dots:54 dot3 evaluations. It still constructs nine cross vectors: three EA,three EB,three delta×Ai. Cross norms additionally need nine scalar Lagrange identities (two products and one subtraction each). The original Ai×Bj vectors are not needed by this integer diagnostic path; their full direct definition remains the independent oracle.

Under the admitted full-rank body profile, all six face axes are nonzero. Let E be nonzero edge axes. If exact self-zero support terms are omitted, and every weighted term uses one multiplication/one addition, the unchanged old SAT Meter gives the following model-only counts BEFORE the common minimum-comparison work: direct543+62*E; factored552+16*E. The unchanged18 coordinate/pair preparation operations are included. For E=9 these are1101 versus696; for E=6 they are915 versus648. These are analytical operation counts, not executed counters, CPU predictions or a guaranteed gain. Degenerate literal inputs can do more work in the factored method. Big-integer operand sizes, extra Lagrange products, interval gates, scalar work, allocation and full-reference overhead remain decisive.

Every performed dot/cross/product/sum/subtract/shift/compare uses the SAME immutable SAT Meter/prices, one2M TOTAL allowance and16384-bit prebounds. No arithmetic moves outside that boundary. The raw products in AAii*BBjj and ABij² can exceed the limit even when direct cross cancellation would fit; preserve a typed refusal, with no direct-SAT fallback, larger cap or changed normal. Exact final identity does not prove all intermediate expressions fit.

## Required independent gate before authoring a full candidate

Freeze a small R1 literal bank and its scope before any execution. It must exercise identity/parallel zero axes, unequal extent weights, nonzero center in all components, signed body/order reversals, nonzero near-parallel edges, and a raw nonorthogonal basis. A useful admitted raw control is q=(.5,.5,.5,.5+2^-42): exact AA01=-epsilon*(1+epsilon), not0. A near-parallel control qB=(0,0,2^-50,1) must retain its nonzero edge. Any artificial large-integer guard control must be declared as a private algebra boundary test, not an admitted runtime body or a changed original frame.

The independent author must use the OLD DIRECT cross/dot equations, never the new Gram/triple expressions as its sole oracle. Compare Gram21, signed mixed27, signed face-center6 and all15 exact N,D,S/axisDen/index values; then compare every zero/near/sign/first-minimum/tie report. N,D,S alone are insufficient: absolute supports/center can hide an incorrect global determinant sign. Original body preparation can be reused as an authenticated component, explicitly not described as a newly independent native geometry oracle.

Only a successful frozen R1 gate and source review can authorize a new full six-frame reference combination. Existing direct-grid R0 and integer position proof remain byte-identical components. Since N,D,S are identical, the existing direct-grid interval protocol/words need no new numerical exception; actual changed arithmetic counters belong to source/summary metadata. Compare all full V3 physical/certificate leaves and run the unchanged independent V3 validator. Do not inherit a prior whole-combination PASS or cost.

One future cost decision retains the saved773147000ns baseline and695832300ns threshold using parent core plus entire owned integer-proof Node lifetime. No SAT Node port, per-pair IPC, baseline rerun, timing retune, cache revival or precision increase is permitted. Full original32-point strict geometry, normal/KKT,36-row position, ledger,quality, immutable provider integration and original1200/180s gates remain separate blockers even after any cost GO. No speed, API, external feature or whole-engine qualification is claimed here.

## Inspected primary sources

- physics-p4-sat-2276/integer_sat.py: direct prepare, solve_model, sum_support, signed-square winner and old Meter.
- physics-p4-radical-compact-2276/backend.py and CONTRACT.md: unchanged six fields/strict cells/gates/scalar closure.
- physics-world-p4-2276/README.md: support-radius v1/v2/v3 ended at cost NO_GO; v3 explicitly ends that cache approach.
- physics-p4-node-sat-2276/RESULTS.md and CONTRACT.md: ended Node relocation, not a new arithmetic algorithm.
- Root's actual V3 full6 result: all numerical/independent PASS followed by fixed COST_NO_GO794129000ns; no timing was rerun for this design.
