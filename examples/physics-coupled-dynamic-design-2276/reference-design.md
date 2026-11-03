# Independent reference and finite qualification bank

Status: METHOD_PROPOSAL_ONLY. No executable generator or numerical result is included. Root must approve this method and budgets before implementation. The reference imports no candidate, stage, solver, geometry builder or saved target. Its output is data and certificates, never a seed for the engine.

## Independent physical equations

Retain the existing normalized-Hamilton native line/box geometry observer. Derive the three columns of world K by virtual unit impulses: for each world basis e, deltaV=e, deltaOmega=6*(r cross e), and contact response deltaV+deltaOmega cross r. Derive native frame coordinates by exact Fraction dot products. Solve the complete3x3 sticking equations by Gaussian elimination and classify static margin exactly. Do not copy the candidate quadratic K formula, adjugate solve, Schur polynomial, Sturm chain or root interval as oracle input.

For dynamic reference work solve the complete linear physical system at parameter s directly, by outward80- and120-digit Decimal Gaussian elimination:

```
k*N+c*T=-un
s*c^T*N+(s*D+(1-s)*I)*T=-s*ut
g(s)=T dot T-qD*N*N
```

Here s is a rational dyadic interval or point, not a candidate root. The normal row is unscaled. For s>0 this is equivalent to adding `(1-s)/s` to the two tangential diagonal entries of K. At s0 the tangential equation is T0, so N=-un/k. At s1 it is the complete sticking system. This formulation uses physical equations and Gaussian elimination directly, without computing the candidate quartic/adjugate. It also supplies J, final velocity and work independently.

Directed Decimal means actual interval endpoints with ROUND_FLOOR/ROUND_CEILING on every operation and conversion, not merely agreement of two round-to-nearest answers. Compute square-root lower/upper bounds with directed operations and verify their squared inequalities; do not rely on Decimal.sqrt honoring a changed context rounding mode. Exact rational endpoint conversion and independent Fraction point solves can verify disputed signs. A zero-containing pivot causes a subdivision or typed reference refusal, never unchecked division. The fixed80/120 precision is not increased after a failure.

## Reference existence and uniqueness

Do not accept bisection on one sign change as proof that other roots do not exist. Independently cover the whole[0,1] parameter domain by outward interval Gaussian solves. Cells with g excluding0 are root-free. On a remaining cell, differentiate the physical system `L(s)*x(s)=rhs(s)` and solve `L*x'=rhs'-L'*x` using a second outward Gaussian solve; then enclose `g'=2*T dot T'-2*qD*N*N'`. A strictly signed derivative and opposite endpoint signs prove a unique root in that cell. A root-free interval may also be proved by monotonicity and same-sign endpoint bounds. Cells crossing0 derivative without another exclusion are subdivided. Do not infer monotonicity from point samples.

Require all of[0,1] to be accounted for, with exactly one certified physical crossing and all other cells excluded. For each retained crossing prove positive N, positive slip and physical cone/opposition using the original equations. If interval dependency prevents complete coverage, report REFERENCE_UNRESOLVED. Do not borrow candidate Sturm uniqueness to turn this into PASS. Reconcile the independent root interval with the candidate only after each method has completed its own proof; their intersection must be nonempty and presented J/error gates must agree.

Proposed reference cap per input is4096 total binary interval splits,2048 terminal cells, depth128, at most32768 complete3x3 interval Gaussian solves across both precisions and derivatives, and16384-bit Fraction intermediates. These are separate reference proof-work caps, not an engine iteration budget. Every split/solve is charged once, including discarded cells and failed pivot attempts. A narrower root interval or the rounding proof may require further subdivision only inside these same caps. Keep the complete root/reference command within the existing180s/16MiB campaign bounds. Summarize rejected cell certificates with a bounded coverage tree; do not emit unbounded iteration transcripts.

## Fixed bank and staging

The physical bank remains exactly the three authenticated original models: before/static, at/exact-static-boundary, after/dynamic-required. No generated velocity or height adjustment is allowed. Before/at must retain all qualified static target words. For after, independently record actual native axes, p/COM/arm, virtual-column K, exact sticking target/load/margin, material words/qD, closing and normal-denominator feasibility, complete interval coverage, dynamic N/T/J/final-slip/work enclosures, and independently rounded binary64 cells. No solved matrix or target enters the candidate API.

Pure implementation qualification, before any World, adds a fixed arithmetic/control bank separate from those physical inputs:

1. Exact original before, at and after helper calls, input data pinned before every call.
2. Degree reduction and exact dyadic interior root, using a private polynomial-test export only; no production geometry seed.
3. Positive root rejected for H<0; roots outside(0,1); two admissible roots; repeated root; endpoint root. These are root-classifier tests, not claims that all arise in the supported box lane.
4. Original after physical inputs with one malformed native point/frame or non-cold/profile field per existing admission bank; typed refusal before application.
5. Fixed RNE cells at ordinary values, binade transition, subnormal transition and exact midpoint parity; ambiguous enclosure must refuse, never choose a neighbor.
6. Injected exact bit, rational-work, integer-work, gcd and subdivision exhaustion through private test limits only. Production frozen limits are immutable; these controls must not alter runtime policy.

The exact literal coefficients/intervals and expected reasons for arithmetic tests must be authored and frozen before executing them; this document does not claim that an uninstantiated test ran. Keep the physical World census at3World/3steps per graph, stop first failure, and run the unchanged geometry, physical and cone observers before any new target/root observer. A new observer independently checks actual pre-warm inputs, static priority, dynamic enclosures, first actual J plus63zero calls, cache plane, per-query/final binding and actual producer/event agreement. Its additions cannot remove or weaken old gates. Public transaction/wire, warm, browser dynamic and performance remain separate later qualifications.
