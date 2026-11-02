---
work_id: physics-motion-foundations-2276
artifact_type: frozen-test-contract
owner_role: independent-algorithm-work
source_request: independent Physics/Motion algorithms; issue 2276
last_updated: 2026-11-01
title: Bounded sphere contact checks
issue: 2276
status: candidate-unrun
scope: existing-physics-world-sphere-contact
evidence: parent-coordinated-source-and-emitted-tests-required
---

# Contact slice — #2276

This candidate adds two public `@barocss/physics` tests. It changes no
contact, World, joint, solver, iteration, or admission law. The profile,
reference formulas, and tolerances were sent to the parent before a run.
The two tests use 3240 successful World steps in total.

## Fixed profile

The step is `1/120 s`. Gravity is `(0,-9.81,0) m/s²`. The finite static
floor has center `(0,-0.1,0) m` and half extents `(2,0.1,2) m`; its top
is `y=0`. The dynamic uniform sphere has mass `2 kg`, radius `0.2 m`,
initial center `(0,0.2,0) m`, zero initial spin, and zero restitution.
There are no joints, sensors, CCD, sleeping mode, or persistent manifold.
Both bodies have static friction `0.25` and dynamic friction `0.2`.

Test 1 starts at rest and runs 3000 steps. Test 2 starts with `vx=1 m/s`
and runs 240 steps. The sphere remains inside the finite floor footprint;
the test checks its radius margin against the input floor dimensions.

## Independent geometry, impulse, and energy references

The geometric gap is `sphere.center.y - radius - floorTop`. This value
comes from body geometry and fixed input dimensions. The checks do not use
reported contact depth or reported contact points as a geometric oracle.

At rest, the normal support impulse is `m*g*dt`. Tangential impulse and
motion are zero. Summed support impulse balances the gravitational impulse
over the complete 3000 steps. These are contact impulses; no joint
correction impulse is converted to a physical force.

For sliding, the independent uniform-sphere inertia is `I=2*m*r²/5`.
While slip remains positive, Coulomb friction gives:

```text
vx(t) = v0 - mu_dynamic*g*t
wz(t) = -5*mu_dynamic*g*t/(2*r)
x(t) = v0*t - mu_dynamic*g*t²/2
```

The first 12 steps lie before the ideal rolling transition
`t_roll=2*v0/(7*mu_dynamic*g)`. The final rolling state follows from the
friction impulse and the no-slip condition:
`vx=5*v0/7`, `wz=-vx/r`, and `K_final=5*K_initial/7`.
The position tolerance allows the existing first-order position update.
The checks do not require exact continuous positions from that update.

For every step, the public contact impulse is signed onto the sphere.
Linear impulse balances `m*(v_after-v_free)` after the known gravity kick.
Angular impulse uses the exact physical arm `(0,-r,0)`, not a reported
producer point. The Coulomb cone uses `|J_t| <= mu_static*J_n`.
In the first 12 steps, `J_tx=-mu_dynamic*m*g*dt` is also checked.

Kinetic energy is computed from returned velocities and the independent
uniform-sphere inertia. Reported inertia is not the reference.
Impulse work is `J dot (v_free+v_after)/2 + torqueImpulse dot
(w_before+w_after)/2`. It must equal the kinetic energy change from the
free state to the contact-resolved state. Accepted mechanical energy must
not grow. The support gap is checked at every step.

## Frozen tolerances

| Quantity | Absolute tolerance |
| --- | --- |
| Independent support gap | `1e-10 m` |
| Stationary speed/spin and sliding speed/spin | `1e-10` in their SI units |
| Normal impulse, linear balance, angular balance | `1e-10` in their SI units |
| Resting tangential impulse | `1e-12 N s` |
| Cumulative vertical support balance | `1e-8 N s` |
| Resting energy drift, per-step energy growth, impulse-work residual | `1e-10 J` |
| Sliding position error at the first 12 steps | `1e-3 m` |
| Final rolling speed, spin, no-slip residual, and energy | `1e-9` in their SI units |

The resting test also checks copied body/contact arrays, retained state
after a bad step, idempotent disposal, and refusal after disposal. These
checks add no successful World steps.

## Evidence boundary and deferred box behavior

These tests admit a dynamic sphere on one finite static box floor. They
do not validate dynamic box support, box friction, box stacks, arbitrary
contact networks, or long-term rolling over edges. Dynamic-box testing is
deferred. The current single-point box contact and optional persistent
manifold require their own independent geometric and work references.

The original three-box baseline remains `NO_GO`: offset `106.37 mm` and
yaw-case `108.07 mm` exceed the `10 mm` gate. The eight-box profile remains
refused. No tolerance, iteration count, cap, or original #1489/#1572 test
changes are part of this slice. A passing sphere slice cannot change those
box outcomes into acceptance.

The candidate has not been run by its author. The parent owns source and
emitted-public-graph runs and the resulting evidence status.
