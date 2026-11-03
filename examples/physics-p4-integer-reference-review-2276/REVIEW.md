# Independent integer KKT mathematical review

Status: DESIGN_REVIEW_ONLY. This review uses only the proposed mathematical
specification. The reviewer did not read candidate/native implementation,
execute numerical code, run a helper/reference/audit/compiler, or call World.
Implementation inspection: NOT_RUN. Numerical verification: NOT_RUN. Source
wiring, counters, runtime qualification, A10/B6 and cost: NOT_RUN for this new
architecture. All earlier PASS/NO_GO, cost failures and limits remain unchanged.

## Scaling result

No scaling error was found, subject to the exact domain conditions below.
For the objective one half of uᵀu and constraints Au≥b, KKT requires
u=Aᵀλ, λ≥0, Au−b≥0 and λᵢ(Au−b)ᵢ=0. Here W is exactly I.

Let A=Aint/P and b=bint/P, with positive integer P and integer coefficients.
For the untrusted supplied row set S, the active equations imply

```
(Aint_S Aint_Sᵀ / P²) λ_S = bint_S / P
H λ_S = c,  H = Aint_S Aint_Sᵀ,  c = P bint_S.
```

If the supplied rows are independent, H is positive definite. With no row
swaps and the specified exact Bareiss recurrence, positive coefficient pivots
give the final coefficient pivot det(H)>0. Denote it by det. The integer
augmented upper system U|rhs has the same solution as H|c. Set X=det·λ_S.
The proposed back substitution is therefore

```
X_i = exactDiv(rhs_i·det − Σ(j>i) U_ij X_j, U_ii).
```

Exact divisibility follows from X=adj(H)c, an integer vector. A nonzero
remainder in an executed division must be a typed refusal, not rounding.
Embed X into all36 rows, with exact zero outside S. The proposed quantities are

```
uNum = Aintᵀ X,       uDen = P·det > 0,
u = uNum/uDen,        λ = X/det,
marginNum = Aint·uNum − bint·uDen,
Au−b = marginNum/(P·uDen),
stationNum = uNum − Σ(all36 rows) Aint_rowᵀ X_row,
u−Aᵀλ = stationNum/uDen,
λ_i(Au−b)_i = X_i·marginNum_i/(det·P·uDen),
objective = Σ uNum_j²/(2·uDen²).
```

All denominators shown are positive. Thus integer signs, zero stationarity
and zero complementarity are the correct full KKT tests. The objective is
strictly convex in u, so a feasible KKT solution has the unique primal u. This
does not establish a unique full dual λ or an exact saved-payload match.

## Six required conditions and caveats

1. **P must clear the final actual coefficients.** Taking the maximum dyadic
   denominator works because dyadic denominators are powers of two. However,
   the maximum denominator of raw input scalars alone need not clear a
   coefficient produced by multiplying or combining those scalars. Choose P
   from the final exact A,b, or exact-divide and validate every final
   coefficient against the proposed P. Refuse a failed division. Never round
   or replace a coefficient. Preserve the independently admitted geometry.

2. **Coefficient rank comes first.** Validate S as the untrusted original
   witness; do not sort, deduplicate, repair or search another basis. Check
   positive coefficient pivots, including the last pivot, before classifying
   augmented-RHS disagreement or comparing observed output. Use the last
   coefficient pivot, not an RHS cell, as det. Every Bareiss and back
   substitution division must be exact. Handle empty S separately; there is
   no last pivot in that case. A dependent witness must retain the declared
   rank-first refusal even if its RHS is inconsistent.

3. **Delayed normalization does not remove integer guards.** All raw values
   and proposed operations remain bounded by16385bits before allocation.
   Check products, shifts and sum/subtraction growth, including P·bint,
   P·det, bint·uDen, X·marginNum, the square/sum objective and2·uDen².
   Only after complete integer KKT may final fractions be normalized and
   presented. Every final reduced numerator/denominator still obeys8192bits,
   with the unchanged exact strings and RNE checks. Algebra alone does not
   prove that the original bank fits the raw-bit or2M work limits. Refuse
   rather than enlarge a bound, retry, search or hide an operation.

4. **Unique primal does not mean unique dual.** Zero-embed X outside S and
   check all36 multiplier signs, margins and complementarity products plus
   full24-component stationarity. A different valid dual may yield the same
   unique u yet differ from the saved λ payload. Keep the original complete
   exact/native payload comparison, including the observed basis and λ.
   Do not normalize, repair or substitute saved values to obtain equality.

5. **Empty or incomplete witnesses still need every primal row.** For empty
   S, det=1, X=0 and u=0 are mathematically valid only if every b_i≤0.
   Otherwise the full primal test must refuse. In the fixed omitted-ground
   control, a violated ground row must produce the declared primal refusal
   before any observed translation or λ comparison. No inactive row may be
   dropped from the complete36-row problem.

6. **The unit-mass profile must be exact.** W=I is valid only when each of
   the8 admitted dynamic masses is exactly the required unit value. A
   tolerance-admitted mass near1 is insufficient for this formula. Retain
   the original9-body/8-dynamic/24-DOF/36-row domain and independently
   prepared A,b. This derivation is not a general variable-mass proof.

## Evidence boundary

The formula is coherent under these conditions. This document does not verify
an implementation, guard placement, meter wiring, allocation, runtime result
or performance. The fixed2M/8192-reduced/16385-raw bounds and original allocation,
time, transport, evidence and physical gates are unchanged. The same immutable
independent A10/B6 checkers and full saved-payload comparison remain required.
Root alone runs actual qualification after the source freeze. No World, API,
baseline, mobile, deployment or whole1200-step claim follows from this review.
