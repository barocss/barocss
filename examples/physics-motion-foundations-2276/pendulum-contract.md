---
work_id: physics-motion-foundations-2276
artifact_type: frozen-test-contract
owner_role: independent-algorithm-work
source_request: independent Physics/Motion algorithms; issue 2276
last_updated: 2026-11-01
title: Reduced planar pendulum contract
issue: 2276
status: candidate
scope: reduced-planar-pendulum-ode
evidence: parent-coordinated-source-and-emitted-tests
---

# Reduced planar pendulum contract — #2276

This is a local algorithm candidate. Test files state acceptance gates. This
document does not state that those gates have passed.

## Existing source and scope

- `packages/barocss-physics/src/joints.ts` parses fixed and hinge constraints.
  `dynamic-hinge-joint.ts:admitDynamicHingeScene` admits a resting dynamic pair
  with zero gravity. These laws are unchanged.
- `packages/barocss-cad-model/src/robot/dynamics.ts:rnea` computes inverse
  dynamics. `massMatrix` builds a mass matrix from Jacobians. `moveState`
  evaluates a prescribed motion profile. These functions are not time
  integrators for an unforced pendulum.
- The new entry is `createPlanarPendulum` in Physics. It has one angular
  coordinate and a fixed origin. It does not create a `PhysicsWorld` or call
  the World joint solver. It does not establish gravity pendulum support for
  a World hinge. It has no contacts, motor, friction, damping, CAD input,
  renderer, or external dependency.

## Coordinates and units

The frame is right handed. The pivot is `(0, 0, 0)`. Gravity points along
`-Y`. The fixed rotation axis is `+Z`. Angle zero points down. A positive
angle follows the right hand rule about `+Z`.

| Quantity | API field | Unit |
| --- | --- | --- |
| Mass | `massKg` | kg |
| Pivot to COM distance | `comDistanceM` | m |
| Axis moment | `inertia.kgM2` | kg m² |
| Gravity magnitude | `gravityMps2` | m/s² |
| Angle | `initialAngleRad`, `angleRad` | rad |
| Angular speed | `initialAngularVelocityRadps`, `angularVelocityRadps` | rad/s |
| Angular acceleration | `angularAccelerationRadps2` | rad/s² |
| Time | `fixedStepSeconds`, `timeSeconds` | s |
| Mechanical energy | `energyJ` | J |

`inertia.about` is required. With `com`, the specified scalar is the moment
about the axis parallel to `+Z` through the COM. The parallel-axis theorem
gives `I_p = I_com + m*l²`. With `pivot`, the specified scalar is `I_p`.
It must satisfy `I_p >= m*l²`. Zero COM inertia admits the ideal point-mass
case. No shape or inertia tensor is inferred from this scalar contract.

The equations are:

```text
r_com = (l sin(q), -l cos(q), 0)
I_p q'' = -m g l sin(q)
E = (I_p/2) w² + 2 m g l sin²(q/2)
```

The energy expression avoids subtraction of nearly equal numbers near zero.
The angle is unwrapped. The program does not clamp or wrap accepted angles.

## Integrator and bounds

The method is velocity Verlet for the autonomous separable Hamiltonian:

```text
w_half = w + (dt/2) a(q)
q_next = q + dt w_half
w_next = w_half + (dt/2) a(q_next)
```

The method has second-order global error for a smooth bounded solution. It
is symplectic in `(q, I_p*w)` and reversible in exact arithmetic. This does
not mean that it conserves the original energy exactly. Each call performs
one fixed step. There is no hidden substep, catch-up loop, or adaptive step.

| Input | Admitted interval |
| --- | --- |
| Mass | `[1e-6, 1e6]` kg |
| COM distance | `[1e-4, 100]` m |
| Gravity | `[0, 100]` m/s² |
| Specified COM or pivot inertia | `[0, 1e10]` kg m² |
| Derived pivot inertia | `[m*l², 1e10]` kg m² |
| Fixed step | `[1e-6, 1/30]` s |
| Initial and accepted angle | `[-1e6, 1e6]` rad |
| Initial and accepted angular speed | `[-1000, 1000]` rad/s |
| `maxSteps` | Integer `[1, 1000000]`; default `1000000` |

Every numeric input must be finite. Also,
`dt * sqrt(m*g*l/I_p) <= 0.05` is required. This bounds step size relative
to the small-angle frequency. The period and energy gates below cover the
listed librations. This step rule alone does not prove those tolerances for
every admitted mass, inertia, rotation, or near-separatrix trajectory.
Gravity zero admits uniform free rotation. A finite work budget can end
before a very slow pendulum completes a cycle.

Admission copies own data fields. It rejects unknown fields, accessors,
non-plain objects, missing required fields, NaN, infinity, and invalid
bounds. Accepted instances retain only numeric model values. All state
objects and COM arrays are new copies.

`step(dt)` must use the exact configured value. The complete candidate is
checked before state changes. A failure retains the previous angle, speed,
step index, time, and energy. Error codes use the existing `PhysicsError`:

| Condition | Code |
| --- | --- |
| Configuration or reflection failure | `INVALID_CONFIG` |
| Step differs from configured step | `INVALID_STEP` |
| Step budget exhausted | `WORLD_LIMIT` |
| Candidate exceeds numeric bounds | `NUMERIC_LIMIT` |
| Read or step after disposal | `DISPOSED` |

Disposal is idempotent, like `PhysicsWorld.dispose()`.

## Predetermined checks

The plan and tolerances were sent to the parent agent before any test run.
The checks use `m=2 kg`, `l=0.6 m`, `I_com=0.2 kg m²`, and
`g=9.80665 m/s²`, unless a test explicitly states another model.

The independent finite-amplitude reference is
`T = 4 K(sin(A/2)) / sqrt(m*g*l/I_p)`. The test computes `K` by the
arithmetic-geometric mean (at most 32 iterations). It also computes the
same integral by composite Simpson quadrature with 4096 intervals.
Their relative agreement must be at most `1e-11` for each tested amplitude.
Neither reference advances the pendulum state. No finest-step trajectory
is used as ground truth.

Period measurement uses interpolated descending zero crossings. The first
crossing and the crossing ten or one hundred full cycles later define the
average period. All intermediate states contribute to the energy envelope.
The envelope uses an independent energy measurement, not the reported
`energyJ`: kinetic energy is `I_p*w²/2`, and potential energy is measured
from the COM height as `m*g*(l + comPositionM[1])`. Initial energy comes
from the input angle and speed. For amplitudes below `1e-6 rad`, the test
uses the independent Taylor potential `mgl(q²/2-q⁴/24+q⁶/720)` to avoid
height cancellation. Every reported energy must agree with this independent
measurement within `1e-12 J + 1e-12*abs(independent energy)`.

The angle and speed oracle uses a separate elliptic time-of-flight integral
on the first quarter cycle. Set `k=sin(A/2)` and solve
`t = integral(phi..pi/2) du/sqrt(1-k²sin²(u)) / sqrt(mgl/I_p)`.
Then `q=2*asin(k*sin(phi))` and
`w=-sqrt(2*(mgl/I_p)*(cos(q)-cos(A)))`. The test uses fixed Simpson
quadrature with 4096 intervals and 64 bisections. It checks the final
integral against 2048 intervals and checks the time residual. Both time
differences must be at most `1e-12 s`. The oracle does not use an ODE
stepper or a production trajectory. The final values are compared at
identical physical times `0.1`, `0.2`, and `0.3 s` for amplitude `1.5 rad`.

| Check | Gate |
| --- | --- |
| Ten cycles at amplitudes `1e-4`, `0.5`, `1.5`, `2.5` rad, `dt=1/120 s` | Period relative error `<=1%`; energy deviation from initial energy `<=max(1e-20 J, 1% of initial energy)` |
| Ten cycles at `1.5 rad`, `dt=1/120, 1/240, 1/480 s` | Each adjacent coarse/fine period-error ratio and energy-error ratio is `[3.2, 4.8]`, consistent with order two |
| Angle and speed at `0.1`, `0.2`, `0.3 s`, `dt=1/120, 1/240, 1/480 s` | Maximum angle error `<=1e-3 rad`; maximum speed error `<=1e-2 rad/s`; adjacent coarse/fine maximum-error ratios for each quantity are `[3.2, 4.8]` |
| One hundred cycles at `2.5 rad`, `dt=1/120 s` | Same period and energy gates |
| Zero initial angle and speed | Angle, speed, and energy stay exactly zero |
| Initial angle `1e-12 rad` | Initial energy is positive and agrees with independent Taylor potential `mgl(q²/2-q⁴/24)` to `1e-14` relative; absolute energy deviation `<=1e-20 J` |
| COM versus equivalent pivot inertia | States compare exactly for 100 steps |
| Uniform rod | Initial acceleration matches `-3g/(2L)` at `q=pi/2` |
| Zero gravity | Constant angular speed and energy; angle follows uniform rotation |
| Same input on separate instances | Exact equality for 1000 steps on the same JS runtime |
| Invalid inputs, step, work, and numeric candidates | Expected error and complete retained state |
| Caller mutates input or returned output | Instance state remains independent |

Diagnostics report all period errors, independent energy errors, trajectory
angle and speed errors, quadrature differences, and inversion residuals.
The energy and trajectory measurement rules and thresholds were fixed
before the parent numerical gate.

The deterministic check applies to the same runtime and operation order.
It does not claim bitwise equality across different JavaScript engines or
platform implementations of transcendental functions. The near-zero
absolute threshold tests finite arithmetic and failure behavior; it is
not a one-percent relative-energy claim at that tiny energy.

## Evidence boundary

This candidate needs the parent-coordinated TypeScript and test gate.
There is no browser, CAD, GPU, contact, World hinge, manufacturing, product,
release, or deployment acceptance in this contract.
