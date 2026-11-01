---
work_id: physics-stack-solver-2276
artifact_type: frozen-normal-candidate-contract
status: ready_for_build
owner_role: independent-algorithm-work
source_request: solve the identical first eight-box32-point velocity island without more iterations or relaxed gates
last_updated: 2026-11-01
---

# Private coupled normal velocity candidate

This module is a new example, not a production Physics API. It changes no
World, old private solver, fixture, body cap, friction law or position phase.
The first target is the authenticated original ALIGNED first-frame32points.
Expected normal numerical rank is24 of48dynamic DOFs. This expectation is a
test assertion, never a runtime branch. Runtime has no gravity, support-chain
oracle, expected velocity, body-name interpretation or fixture import.

## Model and interfaces

`solveNormalContacts(NormalProblem):NormalSolverResult` is exported from
candidate.ts. A body contains id,positionM,velocityMps,angularVelocityRadps,
inverseMass,inverseInertiaWorld (symmetric positive-definite3x3 for dynamics).
A point contains opaque globally unique id,aId,bId,pointM,normalAtoB. All
values are SI; A receives minus normal impulse and B receives plus. Static
bodies have inverse mass/inertia0 and MUST have zero input motion. Nonzero
static motion is a numerical/profile refusal; no infeasible0start is used.

Bounds:1..9bodies,1..8dynamic bodies,0..32points,<=48dynamic DOFs; inverse
mass[1e-6,1e6], inertia entries<=1e6, positions<=10000m, component velocities
and rates<=1000, contact arm components<=10m, normal unit within1e-12.
Dynamic inverse inertia must be exactly symmetric and its Cholesky diagonal
residual pivots>1e-12*max(1,maxMatrixEntry). No quaternion convention is
introduced: the caller supplies the world inverse inertia tensor.

The result copies every admitted body, position and inertia. On success it
changes only linear/angular velocities, returns impulses in input point
order and row residuals keyed by the same point IDs. No individual impulse
must equal a chosen equilibrium witness: redundant contact loads need not be
unique. Failures return original admitted body motion copies with null
impulses/residuals/certificate. Malformed input before admission returns an
empty body list. Unknown thrown exceptions propagate; only candidate numeric
and work refusals map to NUMERIC or ITERATION_LIMIT.

## Algorithm frozen before execution

Factor the inverse mass/inertia blocks as F*F^T. Use v=F*x and the actual
weighted normal Jacobian A=J*F. Solve the strictly convex homogeneous QP
min0.5||x-xFree||^2 subject A*x>=0. A zero velocity vector is a generic
feasible initialization for this homogeneous model; it is not a rest target.

Initial rank-revealing row QR greedily pivots the largest residual norm, with
input row index as exact tie breaker. It retains a maximal independent
working basis and keeps ALL original rows for feasibility/certification.
Use two fixed modified-Gram-Schmidt passes and a direct triangular multiplier
solve. Numerical rank gate is1e-12*max(1,maxOriginalRowNorm). No exact rank
theorem or Farkas proof is inferred from floating QR.

The initial QR is also the first outer iteration's block solve. Each later
outer iteration has at most one QR. Compute the active equality minimizer;
advance from the feasible iterate to its first blocking inactive constraint,
or drop the smallest-index active row whose multiplier<-1e-10. A full step
with no negative multiplier goes directly to final certification. No extra
QR, iterative refinement, polishing, coordinate sweeps, parameter retries or
warm seeds follow. Tiny negative multipliers within the fixed1e-10gate are
clamped to0 once, then full stationarity and all original constraints must
still pass. Rank ambiguity, lost feasibility or failed certification refuses.

## Gates and fixed work

Final closing normal speed<=1e-10m/s, negative impulse<=1e-10N*s,
abs(lambda*vn)<=1e-10J and whitened stationarity<=1e-10sqrt(J).
Original physical gates remain unchanged. Row tangentSpeedMps is the norm
of relative point velocity minus n*(n dot relative velocity). Loaded means
strictly lambda>0. zeroTangentFeasible is true iff max loaded tangent speed
<=1e-10m/s. Success is SOLVED_NORMAL_ONLY even when this flag is false.
Only a frame passing the independent zero-tangent criterion may claim that
zero friction impulses are feasible. No general friction contact is solved.

| Work counter | Hard maximum per call |
| --- | ---: |
| outerIterations |64 |
| blockQrFactorizations INCLUDING initial |64 |
| activeChanges |64 |
| rankTests |2048 |
| dotProducts |400000 |
| dotScalarProducts (sum of dot lengths) |32000000 |
| vectorUpdates (scalar axpy entries) |10000000 |
| triangularTerms |40000 |
| constraintTests |4096 |

Exhaustion returns ITERATION_LIMIT; no bad residual is accepted. Cholesky and
initial/final linear work are included in counters. QR rank, final active-row
count and dynamic DOFs are reported separately. Fixed small scalar validation,
array allocation, cross products and square roots are dimension bounded and
not falsely described as counted dots. Dense QR cost is different from64old
point sweeps; no same-wall-clock, same-operation-count or performance GO is
claimed. There is no option to increase a budget.

## Verification boundary

No tests, numeric imports or candidate calls are run by the author before
parent source freeze. Synthetic source and genuine emitted-module tests use
the same candidate tests. The archive adapter and independent verifier have
separate owners. First-frame acceptance requires the independent Fraction
equilibrium witness, physical impulse/torque reconstruction and all original
normal gates. The prior64-sweep failure remains immutable. Further original
scenes may run only after that first target passes. Existing HOLDs remain.
