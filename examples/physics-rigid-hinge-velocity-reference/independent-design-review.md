# #1349 independent reference contract review

Status: SOURCE-ONLY CONTRACT DRAFT READY. Root accepted the native/scalar numeric choices stated below as absolute first-flow gates. They do not guarantee success across all original bounds; no later relaxation is permitted. No model, oracle, solver, controls, build or trial was executed for this review. Exact errors, branch-boundary policy and complete code/control/source freeze remain root decisions. Only this document was written.

## 1. Preserved evidence and scope

Read `/tmp/physics-1349-current.json` in full and the exact parent candidate, admission, profile, entry, independent Python and literal-control interfaces. Parent workspace: `/Users/user/.codex/worktrees/physics-coupled-hinge-1309/barocss`.

Preserve #1309 native `1381164c5752671c7f1197f27d8a8894537b01d9`, measured `830a911d333ab5f3a8a82c790068170a181b19dc`, manifest `b7f8ed96b71c2a14e976ff37423e01dee18027b94485e2fabeee74a3d977cbe0`. Its actual detached pose-only NO-GO remains: Lz `.2` to `.18421219880057702`; change `.015787801199422996 > 1e-7`. These are parent measurements, not new #1349 measurements.

Keep two original 1 kg, .1 m spheres, rest metadata, +Z axis, anchors ±.1 m, limits ±.8 rad, original motor metadata and dt `1/120`. No new anchor-coherence admission. No World, motor, original hinge projection, force/reaction interpretation, alternate pose or extra pose pass. A velocity change is intentional and must be reported for every component.

The #1309 candidate already returns its pose result without throwing its independent fixed-velocity momentum failure. A new composition can call that pose candidate once, preserve the returned pose, and then apply the declared velocity law. It must not call the old pose-only oracle with corrected velocities and treat its unchanged-velocity refusal as the new contract. Unknown candidate exceptions propagate. Original structural and output-bound errors remain original.

## 2. Reference request and output proposal

JSON lines request:

`{config,state,dt,beforeRawHex?,output?,afterRawHex?}`.

The complete original carrier, config, IDs, cursor, arrays, pair counters and raw13 restoration rules stay as in #1309. The source cursor range remains 0..3600; time is exactly `stepIndex*(1/120)`. Raw13 is two bodies ×13 Float64LE fields =208 bytes; JSON hex has416 characters. Reject malformed hex, wrong length, null, booleans, nonfinite numbers, sparse fields and JSON/raw disagreement. Preserve zero signs from raw buffers.

Reference stages:

1. Decode independent original inputs. Do not take candidate diagnostics or candidate target momentum as initial conditions.
2. Independently derive the single #1309 pose with Decimal80/120 and separately declared scalar atan2/sin/cos.
3. Assemble a declared binary row model from independently rounded expected poses, original velocities and independently derived original inertia.
4. Use exact Fraction arithmetic for rank, selected optimum and certificates of this binary model.
5. Observe actual output as measurement. Independently reconstruct its final-pose rows for a second certificate check, after it passes the independent pose comparison. Actual output does not define the expected pose or BEFORE targets.
6. Observe raw and separately normalized before/after geometry, momentum, objective and kinematics with Decimal80/120.

Reply shape proposal:

`{ok,resolved,executionFailure,metrics,violations,reference,certificate}`.

`resolved` requires Decimal agreement and scalar-repeat agreement. A missing, null, malformed or unresolved reply is EXECUTION_FAILURE. Valid resolved measurements which exceed a physical gate are NO-GO. Typed reference input refusals use `REFERENCE_INPUT`; unexpected exceptions remain visible. The consumer must require `resolved === true`, not merely a boolean field.

`reference` should contain independently derived pose, BEFORE physical P/L targets, binary rows/scales/H/x0, eligibility, exact rational optimum, and raw/normalized actual observations. Fractions must use canonical signed decimal numerator/positive denominator strings, reduced and with zero written `0/1`; a missing fraction is never implicit zero.

`certificate` should distinguish exact rational model facts from Float64 output agreement: rank, selected row count, exact optimum, exact stationarity/primal/complementarity checks, and decoded Float64 primal/stationarity residuals. Do not describe a finite Float64 residual as exact equality.

## 3. Physical rows and signs

Use DOF order `x=[vAx,vAy,vAz,wAx,wAy,wAz,vBx,vBy,vBz,wBx,wBy,wBz]`.

Let `R(a)u = a×u`. Let `o` be the unchanged original pair-config rest midpoint. Preserve private Z1 and canonical Z0 origins explicitly. Root selects a FIXED BEFORE mass COM `C` as the linear row origin; actual raw/normalized momentum diagnostics retain original `o`. Let `rA`, `rB` be the final raw-quaternion rotated original local anchors. Let final body centres be `pA'`, `pB'`.

Freeze row order:

| Rows | Matrix blocks `[vA,wA,vB,wB]` | Target | Physical unit |
| --- | --- | --- | --- |
| 0..2, Pxyz | `[mA I,0,mB I,0]` | BEFORE total P | kg m/s |
| 3..5, Lxyz | `[mA R(pA'-C),IA I,mB R(pB'-C),IB I]` | `LbeforeO-(C-o)×Pbefore` | kg m²/s |
| 6..8, anchor xyz | `[I,-R(rA),-I,+R(rB)]` | zero | m/s |
| 9, transverse x | `[0,-exᵀ,0,+exᵀ]` | zero | rad/s |
| 10, transverse y | `[0,-eyᵀ,0,+eyᵀ]` | zero | rad/s |
| optional11, upper stop | `[0,-ezᵀ,0,+ezᵀ]` | zero | rad/s |
| optional11, lower stop | negative upper row | zero | rad/s |

The anchor signs follow `vA+wA×rA-vB-wB×rB=0`. Swapping both signs preserves zero equality but would change the published certificate convention. Freeze one convention. The centred L rows reduce large common-offset coefficients. Independently derive C and the shifted target from BEFORE input and the declared scalar operation order; do not substitute a candidate centre or AFTER momentum. Preserve original-o physical P/L gates. The target transformation's binary rounding is explicit.

The inequality is `D*x<=0`. With the chosen formula `x=x0+H^-1 Aᵀ lambda`, the active stop equality multiplier is `lambdaD=-mu<=0`, where the conventional inequality multiplier `mu>=0`. Freeze this sign; do not clip an incorrect multiplier.

Solve11 equality rows first. If an eligible inequality is violated, solve once with the signed zero-rate row appended. At most two declared active choices; no convergence loop, row dropping, regularization, pseudoinverse or alternative pose. Record both model evaluations and selected branch. A stop solve is not a second pose evaluation.

## 4. Stop eligibility and boundary risk

Recommended exact eligibility: derive the original raw BEFORE twist; clamp once; choose upper iff the pre-pose clamped target is exactly the original upper Float64 limit, lower iff exactly lower, otherwise no stop. Do not reselect using final measured theta, candidate report, reported archived angle, slop or future prediction.

IMPORTANT: the genuine parent counterexample has raw theta and target `.7999999999999999`. Under the Issue's exact target rule it has NO eligible upper stop, despite authored joint report `.8`. It remains the first genuine momentum-coupling input. It cannot stand in for an active upper-stop control. Separate slightly-outside inputs clamp to exact +.8/- .8 and exercise upper/lower braking. An exact-bound authored label alone is insufficient; freeze the expected computed branch per literal.

Freeze a zero-rate tie policy before code. Suggested mathematical canonical choice: equality optimum with `D*x<=0` is inactive, including exact zero. A positive outward rate selects active. Exact rational and Float64 values can differ in sign near zero; do not silently introduce a rate slop after a trial. If root permits both branches at a numerically unresolved zero boundary, it must explicitly require the same unique optimum, valid multiplier, complementarity and unchanged gates, and label that permission before code. Otherwise branch disagreement is execution/refusal evidence, not a hidden retry.

## 5. Inertia, scaling and operation order

Physical H is diagonal `[mA×3,IA×3,mB×3,IB×3]`, and the objective is `.5*(x-x0)ᵀ H (x-x0)` in joules.

Native sphere inertia must retain original `validation.ts:118` operation `0.4 * massKg * radiusM ** 2`. Decode the actual resulting Float64 into Fraction and Decimal. Do not replace it with `1/inverseInertia`, a nominal literal `.004`, quaternion-dependent inverse-axis inertia, or unrounded Decimal geometry. Independent pose correction still uses the original quaternion-dependent inverse-axis helper algebra as in #1309; velocity H uses the positive isotropic physical sphere inertia.

Old #1294/#1309 observation uses the independent geometric inertia `(2/5)*MASS*RADIUS²` with decoded `.1`. Preserve that observer if reused unchanged. For #1349 solver/objective/kinematics, explicitly add the original parsed binary inertia observation. Record the tiny inertia-convention difference; do not claim exact coefficient equality between these two definitions. Physical momentum gates can be checked with both conventions, with their original absolute tolerance unchanged.

Use fixed units `m0=1 kg,r0=.1 m,v0=1 m/s,w0=10 rad/s,E0=1 J,P0=1 kg m/s,L0=.1 kg m²/s`. Define column scale S with v entries1, w entries10, `x=S*y`. Row divisors T are P0×3, L0×3, v0×3, w0×2, optional w0.

Then `Ad=T^-1*A*S`, `bd=T^-1*b`, `Hd=Sᵀ*H*S/E0`, `y0=S^-1*x0`. Transform all four; keeping physical H after scaling angular unknowns gives a different law. The objective is unchanged after multiplying the dimensionless objective by E0. Declare whether `.1` row scaling uses literal binary `.1` or exact rational1/10; native/reference must share the selected basis.

Recommended binary operation freeze: ascending row/column order; scalar multiply/add in the declared order; no fused multiply-add; no reordered reduction; original parser inertia independently derived. The oracle builds coefficients itself. Candidate rows are only compared as output and cannot provide oracle coefficients. Fraction treats every finite decoded binary coefficient/H/target/x0 exactly.

Separate BEFORE ideal momentum from native binary accumulated momentum targets. The native row solver necessarily uses decoded rounded targets; Fraction certifies that declared binary problem. Decimal independently checks actual BEFORE/AFTER physical momentum. Do not call rounding of target sums a physical momentum reset.

## 6. Rank, safety and certificate proposal

For positive masses/inertias and exactly closed final anchors, the11-row model leaves one internal hinge-rate DOF. Six rigid-body momentum conditions plus five relative hinge kinematic conditions are independent. The optional signed stop row removes the remaining hinge DOF and gives12 rows. This is a structural argument, not measured rank of rounded matrices. Every actual independently assembled binary matrix must still get an exact Fraction rank check. Raw quaternions and Float64 anchor closure can perturb coefficients; do not assume rank from a detector flag.

Use Gram `G=Ad*Hd^-1*Adᵀ`. Exact reference solves can use independent rational elimination with first nonzero pivot and canonical row order. Native solver should use one declared factorization with deterministic pivot order and lower-index tie breaks. It may refuse unsafe arithmetic. Refusal is not a physical success and must retain input/output isolation.

Root's accepted native numeric choices, reviewed before code:

- Dimensionless Gaussian partial pivot: select the first maximum absolute pivot, lower-index ties; freeze scalar summation order.
- Refuse pivot `<=1e-12*max(1,||G||inf)`.
- Refuse `||G||inf*||G^-1||inf>1e12`. Factor once; bounded inverse-column solves for conditioning are guard work, not extra model choices. A pivot ratio alone is not a condition-number certificate. Finite checks must cover every factor/inverse/norm field.
- Refuse finite overflow/underflow and nonpositive/unsafe inertia. Original physical profile forbids inertia override; unsafe/zero inertia controls belong to the pure linear interface.
- Float64 primal, stationarity, negative-mu and complementarity residual gates<=1e-10 dimensionless. Exact independent rational selected-optimum certificate is zero; these are separate claims.

These are pre-code choices, not a measured safety guarantee. A condition bound1e12 with binary64 arithmetic can still amplify errors beyond the requested physical velocity/kinematic gates. Final result guards and independent comparison remain required; unsafe admitted data must not be silently repaired. Exact Fraction full-rank and conditioning can independently audit the returned finite native estimate, without using candidate matrix input to define the expected optimum.

Exact Fraction certificate claims: full row rank, exact feasible rational optimum, exact stationarity for the selected equality rows, objective and eligible inequality/KKT sign/complementarity. The Float64 returned x is rounded and generally does NOT make exact Fraction `A*x-b=0`. Require exact rational optimum plus bounded decoded Float64 agreement; do not demand impossible exact zero and then weaken it during execution.

For an actual output-frame certificate, reconstruct A from validated actual p/q, independently preserve BEFORE targets and H, and check its rational optimum/Float64 agreement. Also compare against the independently predicted frame. This separates pose discrepancy from velocity-solver discrepancy without accepting candidate pose as initial data.

## 7. Agreement and physical gates

Retain #1309 raw and normalized anchor/angle/report/limit/qnorm<=1e-9, axis<=1degree, COM change<=1e-12 m, P change<=1e-7 kg m/s and total orbital+spin L change<=1e-7 kg m²/s. Raw/normalized geometry agreement<=1e-12. Decimal80/120 algebra difference<=1e-25; scalar atan2/sin/cos/repeat comparison<=1e-12, separately labelled. Fractions do not certify transcendental accuracy.

Add final raw AND normalized anchor relative speed<=1e-9 m/s, transverse hinge-rate norm<=1e-9 rad/s and eligible signed outward rate<=1e-9 rad/s. Ineligible stop rate must be recorded as null eligibility plus a finite relative Z rate; null may not pass a numeric-zero check.

Root accepts expected linear velocity component agreement<=1e-10 m/s, angular component<=1e-9 rad/s, and objective absolute agreement<=1e-10 J. Independently expected p/q errors remain<=1e-12. These are absolute first-flow gates; no numerical trial here establishes their feasibility over all original bounds. Velocities near the original1000 bounds can produce objective/energy near1e6 J, where ordinary accumulation may exceed the absolute1e-10 J agreement gate. Preserve an honest first failure; no relative fallback or later relaxation is authorized. Do not reuse one unlabelled max error across units.

Root accepts coefficient comparison: independently derive dimensionless A/H/b/x0 and require each scalar error<=`1e-12*max(1,abs(referenceScalar))`; preserve original inertia value EXACT Float64 bits, row/DOF/scale/eligibility tags EXACT, and candidate source/repeat/compiled coefficient bits EXACT. Keep original physical gates separately. Large C subtraction can stress final L coefficients; no silent coefficient tolerance or row rebuild fallback is allowed.

Energy must be finite and nonnegative; record BEFORE/AFTER energy difference and projection objective. No general energy conservation, motor work or restitution claim. Record exact changed-component bit masks and numeric delta arrays; the identity branch alone retains all v/omega bits including signed zeros. A corrected case can keep some components unchanged. Boolean diagnostic claims cannot replace byte comparisons.

Root selects identity when EXACT scaled native equality residual is zero and eligible outward rate<=0. Preserve all x0 bits then. The independent reference must separately replay the declared scalar binary evaluation for this branch; Decimal/Fraction zero is a different predicate. Fraction optimum comparison and physical/numeric gates still apply. A tolerance-based approximate-feasible branch is not authorized.

## 8. First consumer and literal coverage

Root selects per source/repeat/compiled graph: unchanged genuine admitted #1309 orbital-loss INPUT FIRST, then the eight original archive rows matching that archive producer graph (196/197×two groups×private/canonical origins), then frozen literals. Thus all24 authentic parent archive records are processed across the three consumer graphs, not24 per consumer graph. Make this interpretation explicit in the final Issue/contract, whose phrase “same24 archived records” is otherwise ambiguous. Do not label the first input `expectedPhysicalNoGo:true` under the new law; preserve its old failure separately and let new measurements decide.

All archive bodies must come from BEFORE raw records, not old projected outputs. Preserve source step/time, group IDs, origin conventions and all13 raw fields; original archive byte hashes and metadata pins remain immutable. Across source/repeat/compiled graphs, matching parent archive bodies were already proven byte equal modulo the explicit origin conventions. Compare the same first-counterexample/eight-archive/literal prefix with only declared archiveGraph labels differing. First primary failure stops that graph; repeat only the same frozen prefix. Unknown, archive, malformed reference or harness failure is EXECUTION_FAILURE.

Suggested positive model literals:

- Rest, signed-zero rest, identity common translation velocity, interior coherent pose and interior inconsistent anchors.
- Nonzero P; known orbital L; known orbital+spin L; equal/opposite spin; common COM and common velocity; q-sign equivalence; private Z1 and canonical Z0.
- Upper and lower slight-excess poses with outward relative Z rates (active), inward rates (inactive), zero rates (boundary).
- Interior positive/negative relative Z rates (ineligible stop), and already-feasible final anchor velocity identity cases.
- Nonzero transverse relative spin and nonzero anchor relative velocity, requiring correction while BEFORE P/L is retained.

Each literal needs a source-derived expected branch/zero/nonzero P/L/kinematic property before code. Do not manufacture an already-corrected expected output to replace a real input. Symbolic expected properties can be frozen without pretending to know unmeasured decimal velocities.

Pure linear guards, explicitly not physical scenes: dense12DOF input, positive H; zero/negative/nonfinite/unsafe H;11 full-rank rows;12 with stop; duplicate/dependent rows with consistent and inconsistent targets; malformed/null/sparse matrix/RHS/certificate; multiplier sign reversal; invalid branch label; wrong objective or changed mask; unbounded/unsafe pivot or condition. Freeze exact error code/message and precedence. No arbitrary-mass/axis physical admission is needed to exercise these algebra guards.

Reference comparator guards: null/boolean numeric output, truncated raw hex, changed source cursor, wrong ID, missing certificate, forged row order/scales/H, null inactive stop conversion, wrong inertia convention, altered BEFORE target, copied-output mutation, nonfinite diagnostics. Use intentionally altered comparator data only as guard receipts, clearly distinct from actual candidate measurements.

Input/control admission precedes model calls. Each real case uses one original pose composition and at most two declared velocity active choices. Refusal controls must count successful laws separately; pure guard calls cannot inflate physical coverage. Every output/certificate/diagnostic is copied, input bytes unchanged; constructor/world/motor flags remain false.

## 9. Required pre-code decisions

Root should resolve these before authoring/freeze:

1. Select exact pre-clamp-target eligibility and a rational-vs-Float64 zero boundary branch policy.
2. Select original binary inertia and separate retained analytic observer conventions; freeze all scales and operation order.
3. Select factorization, pivot/condition rule, pure guard API and exact refusal messages.
4. Select exact Fraction certificate vs bounded Float64 agreement fields, with independent expected-frame and validated actual-frame checks named separately.
5. Select identity feasibility definition and changed-bit masks; corrected v/omega cannot be labelled unchanged.
6. Freeze the selected eight matching archive inputs per graph/24 total, genuine counterexample first, literal list, error precedence and unit-specific diagnostic gates.

No source-only proposal here supplies #1349 measured GO, world/motor support, a public engine repair or release acceptance. Preserve all parent NO-GO receipts.
