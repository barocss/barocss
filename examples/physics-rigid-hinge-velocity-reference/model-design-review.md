# #1349 BEFORE-CODE model freeze draft

Status: source reading and mathematical reasoning ONLY. No candidate/reference code, build, solve, oracle or trial ran during this preparation.
Root selects/publishes this contract before implementation. Owned implementation scope: ONLY NEW examples/physics-rigid-hinge-velocity-reference/** in a new isolated lane.
Actual #1309 native1381164c / measured830a911d / manifestb7f8ed96 is preserved; root is verifying exact adoption0836f3e78fcc98021b6204ba3d16cbae3f309213. Adoption and #1294/#1279 immutable proof are start gates.
The actual admitted counterexample lost Lz .2→.18421219880057702kg*m²/s while anchor gap .015787801199422996m→0. All v/omega bits stayed fixed. It is FIRST in this new consumer, never excluded.

## 1. Exact private API and admission/error order

projectHingePoseVelocityReference(config:PhysicsWorldConfig,state:PhysicsState,dt:number) returns detached {bodies,poseReport,diagnostics}. No World/options/motor/reaction/impulse API.
Retain the exact #1309 two-body rest config/profile and full copied state carrier: group0/1 IDs in A,B order; original1kg/.1sphere default inertia/material; +Z hinge;±.1anchors;±.8limits; original motor metadata; dt1/120; gravity0; Z1/private or canonicalZ0; no extra scene modes.
Do not add initial anchor-coherence, zero-velocity, pure-spin or raw quaternion XY restrictions. #1309 raw admission accepts finite unit raw poses within original bounds; its inconsistent-anchor counterexample remains admitted.
The constructor-free #1309 admission helper may be called unchanged. Original rest parsing/joints precede exact raw13 overwrite. Dense carrier/cursor/time/IDs/vector/bounds rules remain; no Number(null), implicit zero or caller normalization.
Error precedence is fixed:
1. dt!==1/120: original PhysicsError INVALID_STEP / private hinge velocity step must equal 1/120.
2. Original config/body/joint structural errors: preserve class/code/message; sparse-body private guard maps at its existing position.
3. Exact old #1309 profile receipt maps to INVALID_CONFIG / private hinge velocity profile is unsupported.
4. Exact old #1309 raw-pose receipt maps to NUMERIC_LIMIT / private hinge velocity archived pose is invalid.
5. Original pose helper output bounds/errors remain unchanged; exact old #1309 private result receipt maps to NUMERIC_LIMIT / private hinge velocity result is invalid.
6. New malformed/nonfinite linear coefficients, dimensions, targets or nonpositive weights: NUMERIC_LIMIT / private hinge velocity row system is invalid.
7. New pivot/condition/inverse/linear/KKT safety failure, including dependent or inconsistent systems: NUMERIC_LIMIT / private hinge velocity solve is unsafe.
8. Original final-body bounds/errors remain unchanged. Nonfinite/unsafe new output/diagnostics after that check: NUMERIC_LIMIT / private hinge velocity result is invalid.
Bridge only exact known old private receipts and the original PhysicsError class. Unexpected getters/proxies/thrown values propagate unchanged. All work occurs on copies; no partial output on refusal.

## 2. One original pose call and fixed targets

Call adopted projectCoupledHingeCandidate ONCE. It returns poses before any external momentum qualification; its source does not reject the measured L drift. Its original validateResult/finite guards and errors remain in force.
Do not import/call old projectOnce, projectDynamicHingeJoint, World or motor. Do not invoke the old pose oracle's momentum gate as a candidate step or suppress its failure. Reuse unchanged pose algebra, not a qualified momentum claim.
Compute BEFORE masses/inertia/raw velocities, C and P/L from original input/rest metadata, never from the returned candidate diagnostics. Preserve the original arithmetic order and exact native inertia 0.4*1*.1**2 bits; do not substitute literal.004.
Original origin O=.5*(configA.positionM+configB.positionM). Fixed C=(mA*pA+mB*pB)/(mA+mB), using BEFORE positions. Preserve target P_before and L_O_before including orbital+spin terms.
Use the equivalent centered angular row target L_C_target=L_O_before-cross(C-O,P_before); final coefficients use p_i_prime-C. This is an explicit row operation using fixed BEFORE C/P, not a new target from corrected bodies.
All reported/gated angular momentum still uses the unchanged original O. Rounded row operation cancellation can produce a frozen refusal; it is not repaired.
Hold returned quaternions/positions fixed during the velocity solve. Local offsets rA/rB use original rotate at held q and original anchors.

## 3. Row order, scaling and limit eligibility

Unknown order x=[vAx,vAy,vAz,omegaAx,omegaAy,omegaAz,vBx,vBy,vBz,omegaBx,omegaBy,omegaBz].
Row labels/order: P.x,P.y,P.z,Lcenter.x,Lcenter.y,Lcenter.z,anchor.x,anchor.y,anchor.z,hinge.x,hinge.y; eligible active stop is row12 named stop.upper or stop.lower.
Physical equalities: mA*vA+mB*vB=P_before; sum(cross(p_i_prime-C,m_i*v_i)+I_i*omega_i)=L_C_target; vA+cross(omegaA,rA)-vB-cross(omegaB,rB)=0; (omegaB-omegaA).x/y=0.
Scales: m0=1kg,r0=.1m,v0=1m/s,omega0=v0/r0=10rad/s,J0=m0*v0²=1J,P0=m0*v0,L0=m0*r0*v0. y has v/v0 and omega/omega0 in the same column order.
Scaled H diagonal: m_i*v0²/J0 in translational slots, I_i*omega0²/J0 in angular slots. Scaled P/L/anchor/hinge rows divide physical equations by P0/L0/v0/omega0 respectively.
Let S(r)w=r cross w. P blocks: [mA*v0/P0 Id,0,mB*v0/P0 Id,0]. Lcenter blocks: [mA*v0/L0 S(pA_prime-C),IA*omega0/L0 Id,mB*v0/L0 S(pB_prime-C),IB*omega0/L0 Id].
Anchor blocks: [Id,-omega0/v0 S(rA),-Id,+omega0/v0 S(rB)]. Hinge rows select omegaB-omegaA x/y. RHS order is P/P0,L_C_target/L0,then five zeros.
Eligibility uses the PRE raw wrapped twist and its original clamp target from the single pose call: target===upper→upper; target===lower→lower; otherwise interior. Never use reported angle, corrected final angle, slop, velocity sign, dt lookahead or future pose to declare eligibility.
The actual orbital-loss input theta/target=.7999999999999999 is INTERIOR. Slightly-outside upper/lower literals independently exercise eligible stops; its proximity to.8 is not an eligibility exception.
For upper D*y=omegaBz_scaled-omegaAz_scaled<=0; lower has opposite sign. Stop RHS=0. Interior has no stop row.
Identity only when every computed scaled A*y0 component === corresponding b (numeric equality, no tolerance) AND eligible D*y0<=0. Return copied original v/omega fields bit-for-bit; do not round-trip them through scaling.
Otherwise solve11equalities. If eligible D*yEquality>0, solve exactly one12-row system from ORIGINAL y0 with stop appended. Otherwise retain equality solution. No active-to-inactive retry, iteration, extra pose call or tuning.
With y=y0+Hhat^-1*Ahat^T*lambda, K=Ahat*Hhat^-1*Ahat^T and K*lambda=b-Ahat*y0. Active lambdaStop=-mu with conventional inequality mu>=0. Freeze this sign, stationarity and complementarity.

## 4. Rank conditions and native numeric rules

For homogeneous12-row equations, the stop plus transverse rows imply common omega. P=0 and anchor velocity=0 imply vA=-omega cross h/2, vB=-vA for equal mass m=1, h=rA-rB.
Let d=pB_prime-pA_prime. Remaining angular equation is B*omega=0 with B=2I Id+(m/2)[(d dot h)Id-h*dTranspose]. Exact closure d=h makes B positive definite with minimum eigenvalue>=2I.
Rounded closure remains nonsingular when m*|h|*|d-h|<2I. Existing positive spherical I, fixed.1anchors/unit q and final anchor gate1e-9 yield ample analytic margin (~.008kg*m² versus <=2.1e-10kg*m²). Check/report this sufficient margin; no input-coherence or small-world-coordinate restriction is required.
Thus real11-row rank is11 and adding either signed stop gives rank12 under those conditions. Zero radius/mass/inertia is not a supported profile. Synthetic deficient/inconsistent row systems remain algebra guards, not new scenes.
All matrices/vectors must be ordinary dense finite arrays of exact11/12 by12 sizes. Freeze scalar assembly order: rows ascending, columns ascending, sums ascending body/column order; canonical structural zero is+0. Inputs/returned raw fields are not rewritten to canonical zero.
Native solve uses deterministic partial-pivot Gaussian elimination on [K|rhs|Id]: choose max-abs remaining column pivot; first CURRENT row index wins ties; swap whole augmented rows. No column permutation. Fixed forward elimination then back substitution; solve RHS and inverse from the same elimination, no retry/regularization/dropped rows/pseudoinverse.
Compute normInfK before elimination. Refuse if any |pivot|<=1e-12*max(1,normInfK), any arithmetic becomes nonfinite, or condInfEstimate=normInfK*normInfComputedInverse>1e12. These are predeclared safety guards, not accuracy guarantees or exact rank tests.
Require ||K*lambda-rhs||Inf and ||K*inverse-Id||Inf<=1e-10. Require normalized equality residual, stationarity residual, negative-mu violation and |mu*g| each<=1e-10. For interior omit stop fields; inactive eligible mu=0. Identity has zero multipliers and no factorization stage.
Native residuals are floating values, not exact Fraction zeros. Reference separately proves exact rank, KKT and objective for independently authored binary coefficients; candidate outcome must never be used as oracle initial data.
After velocity conversion, call original validateResult on copied bodies before new result checks. Recompute physical constraints and original-O P/L. Physical gates remain P/L1e-7, anchor speed1e-9m/s, transverse/outward stop rate1e-9rad/s, pose/COM/raw-normalized/Decimal gates from1309.

## 5. Exact result fields, independent comparison and controls

poseReport retains ONLY jointId,finalAngleRad,targetAngleRad. New diagnostics keys: sourceStepIndex,sourceTimeSeconds,poseEvaluations(1),poseDiagnostics,targets,linearProblem,projection,before,after,velocityDeltasMps,angularVelocityDeltasRadps,changedRawComponents,objectiveJ,energyChangeJ.
targets={originM,centerM,linearMomentumVectorKgMps,angularMomentumAboutOriginVectorKgM2ps,centeredAngularMomentumVectorKgM2ps}; linearProblem={rowLabels,rows,targets,weights,initialScaledVelocity}; projection={branch,limitEligibility,activeStop,finalScaledVelocity,lambdaDimensionless,stages,certificate}.
branch is identity/equality/active-stop; limitEligibility is interior/upper/lower; stages record rowCount,pivotRowPermutation,pivotValues,normInfK,condInfEstimate,linearResidualInf,inverseResidualInf. Certificate records equalityResiduals,stationarityResiduals,rankSufficientMarginKgM2 and optional signedStopRateScaled/muDimensionless/complementarity when eligible. No null numeric fields; no fabricated factorization metrics in identity.
before/after retain actual pose/anchor/COM/P/orbital+spin L/energy fields; after additionally records anchorRelativeVelocityMps,transverseRelativeRateRadps and optional eligibleOutwardRateRadps. All outputs deeply copied, finite and bounded. Formal multipliers are not calibrated impulses/reactions.
Independent coefficient agreement: |candidate-reference|<=1e-12*max(1,abs(reference)); native inertia exact bits; pose agreement1e-12; corrected v agreement1e-10m/s,omega1e-9rad/s,objective1e-10J. Raw/normalized and Decimal80/120 roles remain separate; energy finite/nonnegative with recorded change, no conservation gate.
Freeze named actual cases: orbital-loss-admitted-FIRST; archived196/197-g0/g1-private/public-canonical(24); rest-signed-zero-identity; inside-limit; slight-upper-closing/opening; slight-lower-closing/opening; exact-target-zero-rate; common-COM/P; equal-opposite-spin; known-orbital-plus-spin; q-sign/Z1/canonical-Z0; admitted-inconsistent-anchors.
Stop literals: theta=+.80000001 (upper) or-.80000001 (lower); qA=[0,0,-sin(theta/4),cos(theta/4)],qB=[0,0,sin(theta/4),cos(theta/4)]; centres[-.1*cos(theta/2),0,Z]/[.1*cos(theta/2),0,Z]; v=0. Upper closing omegaA_z=-.5,omegaB_z=.5; upper opening reverses signs; lower closing reverses upper-closing signs and lower opening reverses lower-closing signs. exact-target-zero-rate uses the upper-outside pose with all v/omega=0, so PRE clamped target is exactly.8 and identity has eligible signed rate0. These are authored literals, not a new executed result.
Freeze named refusal/guard cases: dt-before-null-config; original-zero-mass; original-structural-field; sparse-config-body/joint; unsupported-valid-profile; sparse/null/nonfinite/raw-ID/cursor/time; original-pose-output-bounds; original-final-velocity/angular-bounds; unknown-getter/proxy identity; pure-row-duplicate-consistent/inconsistent; pure-weight-zero/nonfinite; pivot-boundary; condition-cap; KKT-sign-corruption; output-copy/raw-zero restoration; reference-unresolved/null/corrupt archive/hash/source/emitted.
Pure linear guards use declared row adapter only and are labelled synthetic. No extra physical profiles/worlds. Exact boundary identity/stop behavior and coefficient/zero sign data are literals frozen before code; no posttrial substitutions.

## 6. Execution and claim boundary

Before implementation root posts final API/model/rows/solver/error/control/reference contract and complete original adopted dependency pins. Before builds/trials freeze all actual new source/reference/control/import data and measured commit. Post actual emitted ledger after original CAD/Physics build and strict types.
ONE bounded source/distinct-repeat/genuine-compiled consumer: counterexample FIRST, same24archive records, then literals. Preserve first physical failure and stop; later graphs consume only identical frozen prefix. Source parity includes raw changed fields and errors; independent unresolved/corrupt/archive/harness errors are EXECUTION_FAILURE.
No changes after failure to gates/rows/coherence/inertia/pose passes/conditioning/velocity caps. Detached GO only; World/motor/reaction/network/10s/Viewer/cost/public API/release requires another contract after exact adoption. Root owns Issue/Wiki/commits/execution.
