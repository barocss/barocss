---
work_id: physics-stack-solver-2276
artifact_type: frozen-solver-candidate-contract
status: ready_for_build
owner_role: independent-algorithm-work
source_request: implement and verify a first-frame eight-box solver without more iterations or relaxed tolerance
last_updated: 2026-11-01
---

# Coupled normal-contact candidate

Independent branch `codex/physics-stack-solver-2276` starts from
`7105c4755fcbf4f0cbc764b864a55bf550f741b3`. All previous branches, source,
physical failures, diagnostic gates and receipts are preserved. Existing
Physics, Studio and manufacturing workers remain on HOLD. This user request
authorizes this candidate in a separate Work; it does not activate them.
Only new files under this directory are owned. No old solver, root/lock,
public body cap, original fixture, friction coefficient or tolerance changes.
Use installed tools only. No dependencies, downloads, network writes or UI.
Remote develop remains12411c89b; the active CAD remote advanced to
5c820c3c343c9c1a1ab4ef05591928a543c4b083 during preparation. That is a read-only
context pointer, not an adopted dependency. This branch retains its exact base.

## Candidate law and fixed bounds

This is a normal-only instantaneous velocity projection on frozen contacts:
minimize the change of kinetic norm, subject to all directed normal speeds
being nonnegative. Input is at most9 bodies,8 dynamic bodies,48 dynamic
degrees of freedom and32 actual contact points. Static input velocities must
be zero. There is no gravity, support-chain, fixture ID, desired-rest state
or prior equilibrium impulse input to the runtime solver.

Whiten the mass and positive-definite world inverse-inertia metric. Use
rank-revealing row QR and a bounded primal active set. Keep all32 rows for
final verification even if an active equality basis has lower rank. The
same symmetric first patch is expected to have rank24, but that is a measured
output to verify, not a hardcoded rank or result.

| Fixed quantity | Bound |
| --- | --- |
| Total QR block factorizations, INCLUDING initial rank factorization | <=64 |
| Outer active-set iterations/changes | <=64; no extra polish loop |
| Rank threshold | 1e-12, fixed before execution |
| Closing normal speed | <=1e-10 m/s |
| Negative normal impulse | <=1e-10 N s |
| Absolute normal complementarity | <=1e-10 J |
| Stationarity residual | <=1e-10 in the declared kinetic metric |
| Candidate-vs-independent state, load and torque errors | <=1e-10 in SI |
| Loaded-row tangent speed for zero-tangent friction feasibility | <=1e-10 m/s |

Factorization and scalar/dot work caps are fixed in candidate-contract.md
before the first run. Two-pass orthogonalization is a fixed algebraic method,
not an adaptive refinement loop. Dense block work is counted separately;
equal iteration limits do not imply equal operation cost or performance.
No regularization changes the contact problem. A numeric or work refusal
returns copied original motion and no accepted impulses/certificate.

Tangential impulses are zero. A normal-only solve is not a general Coulomb
friction solve. A loaded row with tangent speed above the fixed gate refuses
any expansion that would label zero tangent impulse valid under mu1/.7.

## First gate: identical archived32-point island

Authenticate original ALIGNED initial+step1 and raw10296bytes through the
existing pinned data reader. Do not replay the old64-sweep solver. Preserve
the exact free positions, velocities, inverse inertia, directed point order,
point positions and normals. The fixture extractor verifies identity
orientations before converting local inverse inertia to the world matrix.

The independent oracle is the previous exact Fraction equilibrium receipt:
final dynamic velocity/spin zero; exact net linear impulse and torque for
each body, including the static reaction. Individual normal impulses are
not unique and are not compared against one selected corner distribution.
The oracle must never be passed into solveNormalContacts.

The independent verifier imports no candidate runtime/Jacobian/QR/residual
helper. It rebuilds linear/angular impulse effects and point velocities,
checks all32 constraints, candidate reports, force/torque sums, and impulse
work at the unchanged1e-10 gates. It checks tangent velocity, not only
zero-impulse cone inclusion. Prior independently checked OBB geometry stays
bound by its receipt and1e-9m witness gate.

Run synthetic candidate and verifier tests once per source/emitted graph,
then the authenticated first island: source solve2 (selected repeat) and
genuine emitted solve1. Reject source providers in the emitted graph.
Input/state mutation and nondeterminism are separate gates from physical
residuals. Negative controls include fake zero state/residuals, perturbed
impulse/torque, tangent slip, and consistent identity/order transformations.
All failures use fresh run IDs. Implementation-defect repairs may be bounded
and recorded; neither failure nor budget exhaustion permits parameter tuning.

## Conditional original-case expansion

No original World case runs before the first-island source/emitted and
independent gates pass. After that gate, separately freeze a private adapter
and selected case input/provider/geometry contracts. Public admission stays
unchanged. Reuse the existing private geometry, free integrator and one
full-pair position phase; replace only velocity solving in a detached copy.
Record the actual cold/cache policy and numerical work instead of labelling
it the original64-sweep implementation.

Case order: ALIGNED, then OFFSET, then YAW. A case may advance only within
the candidate's certified row/mass/inertia/tangent domain. A row count,
rank, residual, unsupported-slip or geometric failure stops its accepted
prefix. Do not silently select zero friction or discard a contact.
The selected original case has at most1200 steps at1/120s, preserving the
original full physical gates: penetration<=2mm; final2s vertical drift<=5mm,
horizontal displacement<=1cm, speed<=0.02m/s, spin<=0.02rad/s, tilt<=1degree,
finite state and no finite-floor escape. Original precise definitions prevail.
Report new candidate results separately from original failures ALIGNED960,
OFFSET315 and YAW243 and the current public three-box failures.

Any dynamic adapter still needs an independent geometric/kinetic verifier
and actual emitted provenance. If that preparation is absent, keep the
expansion NOT_RUN. Passing this candidate cannot close public#1572, activate
the public nine-body profile, resume held workers, or establish release or
hardware accuracy.
