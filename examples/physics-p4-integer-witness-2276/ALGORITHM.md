# Unit-mass global dyadic integer witness proof

Status: AUTHOR_SOURCE_ONLY_NOT_EXECUTED. This is a new exact proof algorithm. The ended bounded-codec candidate, its cost failure and all earlier sources/evidence remain immutable. No profiling, repeated timing, descriptor or meter backend change is included. Inherited bounded-codec arithmetic/GUARD-POLICY, prices,2M limit,8192-bit reduced/16385-bit raw limits, phases, physical gates, RNE, private tests and worker are unchanged.

## Input authority and scaling

The same own preparation admits exactly9 bodies,8 dynamic inverse masses EXACTLY1,24 translation DOF and36 position rows. Near-unit or other masses do not enter this algorithm. A and b are derived inside the proof from the actual represented input, never supplied by an oracle or legacy decoded model. The only untrusted index witness is native result.basisRows. Duplicates/unsorted/out-of-range/rank mismatches reject as before.

Every FINAL prepared A/b entry is a dyadic rational. Let P be their largest positive denominator, including b. Since the denominators are powers of two, P is a common denominator. Nevertheless the implementation checks exactDiv(P,d) for EVERY entry before scaling. Define Aint=P*A and bint=P*b. These are integers. No saved basis/answer, trial basis, matrix cache, alternate solver or fallback is used.

## One integer factorization

For the admitted witness S, form H=Aint_S*Aint_S^T and c=P*bint_S. Since unit-mass stationarity is u=A^T*lambda, the active equations are H*lambda=c. Build one integer augmented tableau directly, with no rational Gram matrix or per-row LCM. Perform the same no-swap fraction-free Bareiss elimination. Every coefficient pivot, including the last, must be positive. A zero pivot returns WITNESS_BASIS_DEPENDENT before back substitution, RHS consistency or native comparison. Every Bareiss division checks its exact zero remainder.

For nonempty independent S, the last COEFFICIENT pivot is det(H)>0. Back-substitute integer X=det*lambda using `X_i=exactDiv(rhs_i*det-sum(U_ij*X_j),U_ii)`. Integrality follows from adj(H)c, and every implemented division still checks exactness. Embed X in all36 rows with exact0 outside S. For empty S use det=1 and X=0; do not factor or accept without full primal checking.

## Global integer KKT proof

Let uNum=Aint_S^T*X_S and uDen=P*det>0. The complete solution is u=uNum/uDen and lambda=X/det.

- For EVERY one of36 rows, marginNum=Aint_i*uNum-bint_i*uDen. Its physical denominator is P*uDen>0. Check all margins nonnegative FIRST, including a ground row omitted from S.
- Check all36 X values nonnegative. Positive det makes these exactly the dual sign tests.
- Recompute EVERY stationarity column using ALL36 rows: stationNum=uNum-Aint^T*X. Its denominator is uDen. Require exact zero.
- Compute all36 compNum=X_i*marginNum_i. Their denominator is uDen². Require exact zero.
- Compute objectiveNum=sum(uNum_j²) and objectiveDen=2*uDen². This is the original unit-mass objective in kg*m².

Only after this complete proof normalize final u, lambda, margins and objective with the unchanged r.q. Proven stationarity/complementarity zeros are returned as canonical0/1; they are not projected or guessed. Keep the original full exact lambda/payload comparison: a unique primal does not imply a unique dual or active set.

## Boundaries

All coefficient scaling, Gram products, P*bint, Bareiss updates, determinant back substitution, P*det, full-row products/sums, X*marginNum and2*uDen² use the original priced checked integer wrappers. Each product/add/division is prebounded before allocation. A large unreduced common numerator/denominator may exceed16385bits even if a reduced value would fit; preserve that typed refusal. Never switch to the old rational reconstruction. Reduced final values retain8192-bit checks.

The old rational exact reconstruction and exact-KKT branch are removed. A separate nativeKkt function retains ONLY the old rational products needed to evaluate represented native u/lambda residuals and the unchanged1e-12 gates. All36 native rows, exact formatting, signed-zero behavior and RNE remain. Kernel9/certificate14/modelExactRPC schemas and the six declared physical-metadata exception paths remain unchanged.

Fresh G0, U0, A10 and B6 remain required in that order with the same immutable independent oracle/checkers. No old PASS is reused. One cost decision uses the original wider parent-plus-entire-child CPU envelope and695832300ns threshold. Algebra does not prove that the finite bank fits the work/bit limits or passes cost, and does not qualify a full1200-step World run. Author checks are source/syntax/hash only; Root performs all numerical execution.
