---
work_id: physics-persistent-impact-2276
artifact_type: warm-cache-contract
status: frozen_before_execution
last_updated: 2026-11-03
---

This separate regression preserves the original contract, cases, API runner and results.
No source change, threshold change, iteration change or tolerance change is authorized here.

Use the actual public World and recorder. One axis-aligned unit cube has mass2kg,
primitive COM inertia, center[0,.5,0], and zero initial velocity/spin. A finite static
floor has center[0,-.5,0], half extents[2,.5,2]. Floor restitution.25, cube restitution.8,
zero friction, gravity[0,-9.81,0], persistent box profile, dt1/120s, direct broad phase.

Step1 has no commands. Gravity gives closing speed9.81/120, below the strict.5 threshold.
Expected cube velocity/spin zero, support Jn=2*9.81/120=.1635Ns, zero tangent impulse,
and center height.5m. This accepted step must leave a nonzero prior warm cache.

Save the actual warmed recording. Restore it through the public replay API (one
World and one accepted replay step). Compare restored state/log exactly. Then apply
impulse[0,-4,0]Ns to both clean and restored recorders. Represented free closing speed
s=2+9.81/120. Newton restitution gives outgoing upward speed s*.25 and impulse
Jn=2*s*1.25. The target must use the pre-warm velocity for every manifold point.
Reference values use Newton velocity ratio, momentum and energy; no iterative oracle.

A third accepted step has no command. Expected free upward velocity=s*.25-9.81/120,
zero spin, no contact impulse, and height=.5+dt*(s*.25-9.81/120). This checks that the
prior rebound target is cleared for flight. Clean/restored continue states and logs
must match exactly.

In a separate warmed recorder, inject the identical marker Error from Math.sqrt only
when the actual stack includes solvePersistentPoint. That call follows its normal
impulse application. Refuse the impact command, restore Math.sqrt in finally, and
require the same Error object. State, clock and complete log must match the warmed
pre-call snapshot exactly. Retry the impact then continue; both states and complete
logs must equal the clean control. This also checks nonzero warm-cache retention.

Gates: velocity, omega, normal impulse, momentum, angular momentum, gap and energy
residuals <=1e-10 SI; tangent impulse <=1e-12Ns. Positive restitution branch must be
strictly positive with no comparison epsilon. Source/Native actual states and logs
must match after replacing only the validated graph's providerDigest. Save represented
binary64 inputs, states, recordings, counts, maxima and first failure. Stack paths are
saved separately from provider parity. Stop at the first unexpected failure.

Per graph exact plan:3 Worlds (clean, restored, fault),9 accepted steps:
clean3; restored replay1+impact1+flight1; fault support1+retry1+flight1. Hard limits:8 Worlds,16 accepted steps,16MiB evidence
per graph. Two graphs total6 Worlds,18 accepted steps,2 unknown refusals. Build is
provided by the existing independently owned strict NodeNext/canonical public build.
No execution is part of authoring this contract.
