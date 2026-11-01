---
work_id: physics-stack-solver-2276
artifact_type: independent-candidate-verification-contract
status: staged_kkt_api_not_run
owner_role: independent-verification
source_request: retain first-patch oracle verification and add a separate normal KKT checker without an invented trajectory oracle
last_updated: 2026-11-01
---

# Independent first-patch verification

## Staged second API

The first source and genuine emitted runs used the earlier frozen verifier
and its ten tests. Their receipts keep those exact source hashes. The parent
preserved the first strict emitted `TS7006` failure and applied explicit
callback parameter types before the successful second emitted attempt.
Those explicit types remain in this staged source.

This stage adds `verifyNormalKkt(problem, candidate)`. It reuses the same
private independent impulse reconstruction, fixed-pose point velocity,
normal complementarity, reported-state/residual consistency, impulse-work,
and loaded tangent-slip checks. It does not accept or manufacture an oracle.
`verifyNormalSolution(problem, candidate, oracle)` keeps its mandatory
independent oracle and original report behavior.

The new return type is `NormalKktVerificationReport`. It has
`oracleQualification: NOT_EVALUATED` and omits `oracleMatched`,
`sourceReceiptSha256`, and all four oracle-error maxima. Unevaluated oracle
errors are not shown as measured zeros. Its other fields are `passed`,
`normalKktPassed`, `zeroTangentFrictionFeasible`, `candidateReportsMatched`,
`bodies`, `rows`, `maxima`, `energy`, and `violations`.

Its physical maxima are `closingNormalSpeedMps`,
`negativeNormalImpulseNs`, `complementarityJ`, `loadedTangentSpeedMps`,
`reportedVelocityErrorMps`, `reportedAngularVelocityErrorRadps`,
`reportedResidualError`, and `impulseWorkErrorJ`. All original `1e-10` gates
and nine-body/32-point limits remain. There is no solver or iteration change.

A KKT-only pass means the returned normal update satisfies the measured
residual/state/work checks at that supplied pose. It does not supply an
independent trajectory, expected support load, collision-geometry proof,
or original physical acceptance. `normalKktPassed=true` with loaded tangent
slip still gives `zeroTangentFrictionFeasible=false` and `passed=false`.
The parent must freeze and authenticate any trajectory profile separately.

Four new candidate-free tests check explicit absent-oracle reporting,
a valid nonzero separating state and forged zero output, bad impulse and
row reports, and loaded slip. The earlier ten tests remain. This staged
version has14tests and has not been run by its author. The parent owns its
new source/emitted test and numerical receipts.

The parent freezes the candidate and authenticated fixture before execution.
This lane owns only `verification.ts`, `verification.test.ts`, and this
contract. It edits no candidate, existing World, private solver, historical
receipt, physical tolerance, body cap, or iteration cap. The parent runs all
tests and numerical calls. No run is claimed by this contract.

## Exact evidence boundary

The initial eligible input is the authenticated original ALIGNED step1 free
pose with nine bodies and32actual normal-contact points. The parent fixture
uses the prior Fraction equilibrium receipt from
`examples/physics-motion-nogo-2276/evidence/equilibrium-study-01/result.json`.
Its authentication and32independent OBB geometry witnesses remain necessary.
The verifier does not infer valid contact geometry from the point producer.

The independent oracle is final zero linear/angular velocity for every body,
zero net torque for every body, net upward impulse `s` for each dynamic cube,
and net downward impulse `8*s` for the static floor. The stopping speed is
the saved binary64 value represented by the exact Fraction
`5890708312600609/72057594037927936`. It is not silently replaced by a newly
multiplied `g*dt`.

The parent converts authenticated Fraction receipt fields into the oracle
DTO. IDs are only map keys. This verifier does not infer a load from an ID
suffix and does not take expected states or loads from candidate output.

The32normal rows are redundant. Four corners of a vertical face supply
only three independent relative normal constraints. Eight such interfaces
have expected rank24. A checkerboard corner impulse change has zero
resultant and torque, so individual normal impulses are not unique.
The verifier compares final states, net loads, and physical residuals. It
does not require per-point equality with the symmetric Fraction witness.
No minimum-norm impulse contract is inferred.

## API and independent arithmetic

```text
verifyNormalSolution(problem, candidate, oracle) -> VerificationReport
```

`problem` has bodies with ID, COM, free linear/angular velocity, inverse
mass, and world inverse inertia. It has directed point rows with IDs,
world point, and unit normal from A to B. `candidate` follows the structural
normal-solver result DTO. `oracle.bodies` contains independent final
velocities, net linear impulses, and net angular impulses, keyed by ID.
An optional `sourceReceiptSha256` records parent-provided provenance; this
pure verifier cannot replace the parent's file authentication.

The verifier imports no candidate module, candidate type, matrix builder,
Jacobian, QR routine, active-set routine, or residual helper. Its own vectors
and structural DTOs are local. Work is bounded by nine bodies and32points.
Candidate QR work remains separately limited to64total factorizations by
the parent/candidate contract; this verifier performs no QR or contact solve.

For each actual point, it assigns `-lambda*n` to A and `+lambda*n` to B.
The angular impulse is `(point - inputCOM) cross signedImpulse`. It sums
these physical impulses before reconstructing each final body velocity:

```text
v_final = v_free + inverseMass * sum(J)
w_final = w_free + inverseInertiaWorld * sum(r cross J)
```

Each row's final relative point velocity is computed from these reconstructed
body states at the same fixed input pose. Normal velocity is its dot product
with the input normal. Tangent velocity is the remaining vector. Candidate
body values and claimed residuals are compared separately. Candidate model
positions, inverse masses, and inverse inertia values must remain input-equal.

An additional independent impulse-work check uses the same fixed pose:
`sum(lambda*(vn_free+vn_final)/2) = K_final-K_free`.
Kinetic energy uses the physical mass and a separate explicit3x3adjugate
inversion of world inverse inertia. It does not use candidate whitening or
factorization. The eligible profile's static floor is stationary.

## Frozen gates

Every absolute gate below is `1e-10` in the stated SI unit. These checks do
not change the candidate rank threshold `1e-12` or any old physical gate.

| Independent quantity | Gate |
| --- | --- |
| Candidate state versus signed-impulse reconstruction | Component linear/angular error `<=1e-10 m/s`, `rad/s` |
| Reconstructed state versus Fraction body oracle | Component linear/angular error `<=1e-10 m/s`, `rad/s` |
| Net body/floor linear and angular impulse versus oracle | Component error `<=1e-10 N s`, `N m s` |
| Negative normal impulse | `max(0,-lambda)<=1e-10 N s` |
| Closing normal velocity | `max(0,-vn)<=1e-10 m/s` |
| Normal complementarity | `abs(lambda*vn)<=1e-10 J` |
| Claimed row/certificate normal and tangent residuals | Absolute discrepancy `<=1e-10` in each field's SI unit |
| Impulse-work identity | Absolute error `<=1e-10 J` |
| Loaded-row tangent speed for zero tangent impulse | Euclidean norm `<=1e-10 m/s` |

A loaded row means strictly positive returned `lambda`, including a tiny
positive value. Candidate `zeroTangentFeasible` must use that same rule.
The candidate's reported stationarity metric must also be finite,
nonnegative, and `<=1e-10 sqrt(J)`; the independent physical state check is
the primary stationarity evidence here. The verifier does not claim to
reproduce the candidate's whitening metric.

Normals must be unit length within `1e-10`. World inverse inertia must be
finite, symmetric within `1e-10`, and positive definite for a dynamic body.
A zero-inverse-mass body must have zero inverse inertia. All DTO numbers
must be finite and all IDs/endpoints/counts must be valid. Malformed input
throws `RangeError`. A well-formed numerical disagreement returns an explicit
report with `passed=false` and measured violations.

## Friction and expansion

The candidate solves normal impulses only. Its tangent impulse is zero.
For this fixed material profile (`mu_static=1`, `mu_dynamic=0.7`), zero lies
inside the friction cone. Cone membership alone does not satisfy the
friction law when a loaded contact is slipping. Therefore a pass also
requires independently measured zero tangent speed within the fixed gate.

`normalKktPassed` is separate from `zeroTangentFrictionFeasible`,
`oracleMatched`, `candidateReportsMatched`, and the aggregate `passed`.
Only the exact authenticated first patch can be admitted by the
`verifyNormalSolution` aggregate with that oracle.
The synthetic tests do not expand that admission.

A first ALIGNED normal-only pass does not qualify the original1200-step
ALIGNED trajectory, OFFSET, YAW, warm friction, position correction, or full
World orchestration. An OFFSET or YAW patch requires its own authenticated
geometry, independent feasible witness or reference, and loaded-row tangent
law check. If tangential slip is present, the full friction problem needs
its own candidate and frozen reference. No extra normal iterations or
tolerance change can substitute for those requirements.

The original first normal residual and original ALIGNED/OFFSET/YAW physical
failures remain unchanged. Existing workers stay on HOLD. This verifier
does not activate public Physics or any old private owner.

## Predetermined anti-self-confirmation tests

The test fixture is a separate synthetic nine-body/eight-interface chain
with four exact corners per interface and stopping speed `0.08 m/s`.
Its symmetric closed-form witness is authored directly in the test, not
returned by the candidate. Ten tests cover:

1. Zero body states, expected support loads, and impulse work.
2. A distinct valid checkerboard impulse distribution with the same body states.
3. Bad impulses hidden behind claimed zero state and residuals.
4. Forged reported linear or angular velocity with unchanged impulses.
5. Negative normal impulses and false row reports.
6. Loaded tangent slip despite normal complementarity and zero-cone membership.
7. Altered geometry and reversed normals.
8. Consistent body/row permutation and opaque ID renaming.
9. Fixed-model mutation, failed solve, NaN, and invalid counts.
10. Incomplete or altered independent body/load oracle.

The tests call only this verifier. They do not import or execute the
candidate. Test and numerical results belong to the parent's exact frozen
source and execution receipt.
