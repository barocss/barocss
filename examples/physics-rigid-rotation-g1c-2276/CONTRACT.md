---
work_id: physics-rigid-rotation-g1c-2276
artifact_type: finite-input-frame-qualification
status: implementation_authorized_execution_requires_parent_hash_freeze
owner_role: independent-physics-algorithm-work
source_request: qualify G1 input coordinates and downstream prerequisites without resuming held workers
last_updated: 2026-11-02
---

# G1c: finite coordinate and input checks

Parent authorizes this independent Work under the latest owner request. Old
Studio, manufacturing, equipment and worker HOLDs remain. No deployment,
publication, dependency download or legacy compatibility path is included.
Existing first failures and error gates remain immutable.

This campaign reuses the authenticated G1b M02 staged common-World Source and
strict NodeNext emitted public entry. It does not label either as an adopted
canonical package build. Verify all 262 staged pins, current original transfer
pins, the old successful M02 receipt and both saved validated reference rows
before loading a provider. Verify again after execution.

The parent freezes CASES.json and executable hashes before the first numerical
call. There are exactly eight new cases, each at dt=1/120 s, one initial read,
one empty-command step and one disposal per graph. Run Source first and then
Native only after Source physical PASS. Maximum: 16 Worlds, 16 reads, 16 steps,
16 disposals, 16 independent audits, six existing module coefficient pow calls.
There are no queries, recorder calls, fault injections or new builds. Drain
existing test observations after each step. No earlier physical prefix is rerun.

The base geometry is the previously qualified 1 kg box with half extents
[0.1,0.2,0.3] m and world omega [1,1,1] rad/s. CASES contains only:

1. Two proper cyclic permutations of body and world labels, with identity q.
2. Three world half-turns, about x, y and z. Body geometry stays fixed.
3. Two radial initial quaternions, q=[0,0,0,+/-(1-2^-21)]. Existing admission
   normalizes these exactly to positive/negative identity; no new tolerance.
4. Mass 4 kg and half extents multiplied by 1/2. Native power-of-two scaling
   preserves the actual diagonal moments. This is not a wider inertia range.

SI units and a right-handed XYZ frame apply. Quaternions are XYZW and map body
coordinates into world coordinates. Omega is in world coordinates. The model
retains authored q; the numeric state uses the existing normalization contract.

# Independent oracle and unchanged gates

Reuse saved bank-80-02.json and bank-120-02.json, including their full validated
Taylor/defect certificates and original provenance. No ODE, Decimal, trigonometry,
root or square-root evaluation is allowed in this campaign. An independent
stdlib Fraction audit derives mass, COM and inertia by volume monomial integrals
of actual native geometry. It derives proper R from the saved q by exact
homogeneous rational quaternion geometry. It checks angular momentum, energy,
q squared norm, COM and linear momentum independently of the solver.

For a proper cyclic P, R'=P R P^T, omega'=P omega, q'=[P q.xyz,q.w]. For a world
half-turn H, R'=H R and omega'=H omega; q'=q_H*q is an exact signed permutation
of four quaternion coordinates. Negative radial q negates the target quaternion
only. Mass4/length1/2 leaves true inertia and the reference rotation unchanged.
Transform interval endpoints exactly, including endpoint reversal on negation.
Both precision banks must enclose compatible targets with widths <=1e-24.

Keep world-L and energy gates 1e-12 absolute
+1e-12*max(1,abs(initial value),abs(current value)).
Keep squared-q norm <=1e-12, zero COM/linear momentum unchanged. Keep each R,
omega and q endpoint gate 1e-11 absolute +1e-12*abs(reference endpoint). Report
maximum actual errors and bounds. Do not claim measured convergence order:
there is only one time step per new case.

Native public outputs must equal Source words, except each graph's own checked
providerDigest. Check input immutability and detached public output ownership.
Deterministic word equality is separate from independent physical accuracy.

# Fixed resources and stop rule

Use the existing command-run 180 s process-group guard and the shared heavy
lane. Inner deadline is 170 s. Each reference process has a 10 s deadline.
Reference inputs <=64 KiB; saved rows <=32 KiB each; each result <=64 KiB.
Retained harness data <=32 MiB, reference logical data <=8 MiB with an 8192
unique-object traversal cap, evidence <=16 MiB, build allocation zero. These
are logical-data bounds, not claims about process RSS. Count Fraction arithmetic
operations; cap at 100000 per audit. No cap, iteration or tolerance increase.
Preserve the first failure with complete inputs/output and stop later cases.

# Adoption and next dependencies

PASS establishes only these eight finite inputs at one step. It does not prove
all admitted mass/extents/spin/dt values, G1a x/y-axisymmetric branches, near-equal
moments, long duration, arbitrary orientations or physical torque/contact/joint
coupling. Source PHASE-AUDIT records actual phase order and later finite tests.
Do not activate a fixed-scale triaxial kernel over the broad existing admission,
silently refuse formerly admitted shapes or retain the wrong anisotropic law
as a compatibility fallback. Canonical API adoption awaits the explicit range
contract and required downstream source/emitted integration checks.
