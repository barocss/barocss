---
work_id: physics-stack-solver-2276
artifact_type: frozen-conditional-world-contract
status: ready_for_build
owner_role: independent-algorithm-work
source_request: extend only after the identical 32-contact equilibrium gate passes
last_updated: 2026-11-01
---

# Conditional private trajectory

The first archived island passed source and genuine emitted candidate gates.
The initial strict-emission type failure remains in first-emitted-01. Two
explicit callback type annotations repaired compilation, without a numerical
parameter change. The next verifier version adds an oracle-free KKT API;
it must pass its own tests and repeat the first oracle gate before World use.

Use the exact original `fixture(scene)` for ALIGNED, OFFSET, YAW, in that
order. Each case is separately bounded at 1200 steps, dt=1/120s. Stop that
case at its first profile, numerical, independent geometry or quality failure.
Do not discard rows, advance a failed state, relax a gate, substitute mu=0,
or claim an unexecuted terminal window. Keep both the World transaction count
and the independently accepted prefix: an observer may reject a transaction
after the private World has internally accepted it.

Keep the old private nine-body factory, integrator, geometry construction,
and exactly one full-pair position phase byte-identical. A hash-checked build
transform replaces only the complete velocity solve method, including warm
application. New velocity solving is cold on every step. Cache data is for
reporting only. Original 64-sweep and warm-start behavior is not claimed.
The adapter admits only the existing isotropic 1kg half-.25m cubes with
inverse inertia 24I and unchanged mu1/.7, plus the original static floor.
24I is rotation invariant; no matrix symmetrization or orientation threshold
is needed. All detected velocity points are supplied; >32 refuses before solve.

Independently check every admitted velocity solve by signed impulses,
torques, point velocities and impulse work at 1e-10. This check has explicit
oracle qualification NOT_EVALUATED: there is no analytic trajectory reference.
Require zero loaded-row tangent speed within 1e-10 to qualify the original
positive-friction material using zero tangent impulse. Use the pinned prior
Decimal80/120 OBB support/slab/line witness functions on every actual point,
retaining their 1e-9m gates and 1e-60 precision agreement. Signed support gap
uses the existing <=1e-9 test; penetration is measured separately.

Reuse the unchanged independent full-pair position reference and phase-ledger
reference. Their original precision, 1e-12m nonpenetration, bit-preservation,
free-integration and momentum/accounting gates remain authoritative. The
normal candidate's tighter velocity KKT gates are additional. No result from
the new candidate replaces these older tests.

Reuse the unchanged Decimal80/120 geometry quality evaluator on initial and
each accepted frame, with its exact step960 state as the 8s baseline. All
physical thresholds and final-window definitions are original. A full case
GO requires 1200 independently accepted steps with no failure.

Source and emitted-candidate graphs run once each. The latter uses actual
TypeScript-emitted candidate/verification/adapter JS; old private World and
Physics helpers remain source providers, which is recorded explicitly.
Compare decoded record and raw-body hashes per case across these graphs.
This is candidate emission parity, not a full public package build or API GO.
The first-patch repeat separately evaluates deterministic reproduction.

Save every attempted transaction, failure and raw binary body operands in a
fresh output directory using the prior recorder and its unchanged 280MiB
compressed budget. All source providers are hashed before execution and
rechecked afterward. A 180s per-case wall guard yields an execution refusal,
never a numerical pass. No resumed partial case may hide its first refusal.
Public admission, release, Studio, manufacturing and prior HOLDs stay unchanged.

## First preparation failure and exact operand comparison

world-source-01 attempted one ALIGNED transaction. A deep-strict JSON-fixture
comparison then refused because eight normal components were fresh -0 but
archived JSON0. The World accepted one step; independent acceptance stayed0.
This failed guard attempt and emergency evidence remain immutable. Neither
the solver nor a physical gate failed or was qualified by that attempt.

Before the next fresh run, the comparison now requires exact body binary
frame SHA agreement with the saved free-frame receipt and exact DTO values,
allowing only +/-0 identity differences in contact-normal components. Every
such location/sign is recorded. Other numeric/layout changes still refuse.
No runtime operand is converted: the solver receives fresh signed normals.
The archived JSON cannot certify original normal-zero bits. New point positions
and normals additionally have an explicit little-endian binary64 hex record.
This is serialization accounting, not a residual tolerance change.

## Review correction: secondary execution errors

Read-only review found that an earlier physical failure could hide a later
thrown reference/assertion/archive error in the runner's catch. None of the
four saved source02 attempts or their emitted02 counterparts took this path:
all their reference replies are resolved, with no execution-failure flags.
Those numerical and first-failure receipts remain unchanged.

The corrected runner retains both the first physical failure and a secondary
executionFailure, and aborts the campaign on any execution exception. An
unresolved reference envelope now throws before physical classification.
Three focused error-path tests cover both failure orders and resolved physical
rejection versus unresolved execution. Fresh source03/emitted03 World runs
check the composed runner after this change. No candidate, geometry, iteration
budget, tolerance, original fixture or expected physical result changed.
