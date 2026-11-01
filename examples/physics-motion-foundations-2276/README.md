---
work_id: physics-motion-foundations-2276
artifact_type: implementation-and-test-report
status: done
owner_role: independent-algorithm-work
source_request: independent Physics/Motion algorithms; issue 2276
last_updated: 2026-11-01
---

# Independent Physics/Motion foundation

The bounded algorithm work is implemented and tested locally. The supported
cases are listed below. General multibody dynamics and stable box stacks are
not qualified. The old Physics, Studio and manufacturing HOLDs remain in force.

Branch: `codex/physics-motion-foundations-2276`.
Worktree: `/Users/user/Documents/ChatGPT/barocss-physics-motion-2276`.
Base: develop `12411c89b9a0f9de7e5066a5ea8f3d292c9476a8`.
The remote develop and active `local/cad-dev` heads were checked before work.
The active branch was `8350c8e245ca2c35a71460c01e4be8772576661d` and had
unrelated STEP/roadmap changes. Its Physics and robot sources matched develop.
This work uses a separate checkout and changes no active worker's files.

The source contains no Studio or renderer dependency. Existing FK, IK,
trajectory, inverse-dynamics and contact algorithms were inspected and reused.
The retired `@barocss/motion` package remains retired.

## Changed code and public API

- `packages/barocss-physics/src/pendulum.ts`: new `createPlanarPendulum`.
  It integrates one fixed-axis rigid pendulum with velocity Verlet. The mass,
  COM distance, gravity and COM/pivot inertia are explicit SI inputs. The
  model has no contact, motor or damping. The existing World joint solver
  is not used by this API.
- `packages/barocss-physics/src/index.ts`: exports the new function and types.
- `packages/barocss-cad-model/src/robot/motion.ts`: rejects malformed or
  nonfinite path values, rates, profiles and query times. Expected refusals
  use existing error classes. Existing missing/nonpositive required-rate
  behavior remains `LIMITS_MISSING`.
- This example directory contains seven test files, the runner, a native public
  package consumer, contracts and execution records. The changeset records
  the two package changes. No dependency or lockfile change was needed.

Example public call:

```ts
import { createPlanarPendulum } from '@barocss/physics';

const dt = 1 / 120;
const pendulum = createPlanarPendulum({
  massKg: 2, comDistanceM: 0.6,
  inertia: { about: 'com', kgM2: 0.2 },
  gravityMps2: 9.80665,
  initialAngleRad: 1.5, initialAngularVelocityRadps: 0,
  fixedStepSeconds: dt,
});
const accepted = pendulum.step(dt);
pendulum.dispose();
```

The pivot is the origin. Angle zero points down `-Y`. Positive rotation
follows the right-hand rule about `+Z`. The angle is in radians. Time is
in seconds. State queries return copies. A refused step preserves accepted
state. Disposal is idempotent. The full bounds and error codes are in
[pendulum-contract.md](pendulum-contract.md).

## Results by stage

All results below were measured on macOS arm64, Node 22.19.0, esbuild
0.25.12 and TypeScript 5.9.3. These tools were already installed. No tool,
runtime package or external data was downloaded. Internal workspace links
point to this worktree. Exact commands, UTC execution times, exits, output
hashes and provider graphs are in [evidence](evidence/).

| Stage | Actual check | Result and limit |
| --- | --- | --- |
| 1: baseline | Original public disjoint hinge and 8-box admission | Both refuse with `INVALID_CONFIG`. This is a measured support limit, not physical GO. |
| 1: baseline | Unchanged original 3-box ALIGNED/OFFSET/YAW, 1200 steps each | ALIGNED meets that diagnostic's settling thresholds. OFFSET/YAW fail. Details below. |
| 2: kinematics | 7 new public-subpath tests; independent RP geometry and path formulas | PASS. No new FK/IK/trajectory solver. |
| 2: unit/frame boundary | 3 public source-adapter tests, off-origin 100 mm span and 90-degree rotation; stale source/revision refusal | PASS. This does not qualify a compiled CAD adapter or a Viewer flow. |
| 2: invalid motion | 25 new input tests | Before repair: 1 PASS, 24 FAIL. After repair: 25 PASS. |
| 2: compatibility | Existing RS2 and public RobotPath tests | 15/15 PASS. |
| 3: existing rigid dynamics | 3 new public tests: ballistic convergence, unequal-mass elastic impact, sphere spin | Source and emitted main graph PASS. Ballistic position remains first order. |
| 3: new reduced pendulum | 12 new tests, independent elliptic references, matched-time errors, refinement, 100 cycles, invalid/lifecycle inputs | Source and emitted main graph PASS for the fixed fixtures. |
| 4: sphere contact | 2 new tests: 3000-step support and 240-step sliding/rolling | Source and emitted main graph PASS. This does not qualify dynamic boxes. |
| 4: existing compatibility | Seven existing World/rotation/joint/hinge/persistent-box/friction consumers | Seven completed successfully after the recorded build-harness repair. They retain their original narrower criteria. |
| Public API | Real emitted JS and declarations; native Node `@barocss/physics` resolution through the publish manifest | Type check and execution PASS. No source alias in this consumer. This is local package staging, not publication. |
| Static checks | Full cad-model type check; new test files; strict Physics main emission; focused ESLint | PASS after the recorded test-type repair. ESLint: 0 errors, 2 diagnostic-console warnings. |
| 5: coupled systems/control | Contact/hinge prerequisites are not generally qualified | NOT_RUN. No controller or connected multibody support is added. |

There are 53 distinct new Node tests. The 18 Physics main-entry tests were also run
against the genuine emitted main graph. Those additional executions are
not 18 additional independent test definitions. Emitted graphs have 41
inputs each, including the test, with zero Physics `src` providers.
Source/emitted numerical diagnostic objects match exactly on this runtime.
Deterministic replay checks are separate from the physical error checks.

### Numeric errors

The gates were fixed in [CONTRACT.md](CONTRACT.md),
[kinematics-contract.md](kinematics-contract.md),
[pendulum-contract.md](pendulum-contract.md), and
[contact-contract.md](contact-contract.md) before the corresponding runs.
The unit adapter gates were frozen in [units-contract.md](units-contract.md).

| Measurement | Measured error/result | Fixed acceptance |
| --- | --- | --- |
| CAD proxy units and off-origin pose | 100 mm ->0.1 m; measured admission/translation/round-trip error `0` for this fixture | `1e-9 m` / `1e-6 mm`; quaternion `1e-12` |
| RP FK, 20 off-origin poses | Max point error `2.8422e-14 mm`; inverse `3.1777e-14 mm`; rotation-entry error `0` | `1e-9 mm`; rotation `1e-12` |
| Reachable IK, 3 analytic targets | Max independent position residual `5.7934e-14 m`; max angle residual `6.084e-37 rad` | `1e-4 m`, `1e-3 rad`, joint limits respected |
| Unreachable IK | Residual `0.04000000000000001 m`; slide stops at `80 mm`; reached=false | Residual at least `0.0399 m`, limits respected |
| Mixed-unit trapezoid, 202 samples | Max Cartesian error `6.3553e-14 mm`; turn `3.3307e-16 rad`; slide `8.8818e-15 mm` | `1e-9 mm`, normalized/radian error `1e-12` |
| Ballistic position after 1 s | `81.750 / 40.875 / 20.4375 mm` at dt `1/60,1/120,1/240` | Coarsest error <83 mm; each ratio `1.99..2.01` |
| Ballistic energy error | `-0.8019675 / -0.40098375 / -0.200491875 J` | Measured discretization error; no conservation PASS claimed |
| Unequal-mass elastic impact | Momentum error `0 N s`; energy error `2.2205e-16 J` | `1e-10` in each SI unit |
| Uniform sphere spin, 1 s | Quaternion-component error `2.2205e-16` | `1e-11` |
| Pendulum A=1.5 rad, dt=1/120 | Period relative error `0.00264214%`; energy envelope error `0.0187680%` | Each <=1% |
| Pendulum same-time q/w, t=0.1/0.2/0.3 s | Max q error `1.39932e-5 rad`; max w error `1.66005e-4 rad/s` at dt=1/120 | `1e-3 rad`, `1e-2 rad/s` |
| Pendulum refinement | Period error ratios `4.00145,4.00061`; energy `4.00004,4.00001`; q/w errors also reduce by about 4 | Each ratio `3.2..4.8` |
| Pendulum A=2.5 rad, 100 cycles | Period error `0.000681902%`; max energy deviation `0.00329421 J` = `0.0155418%` | Each <=1%; all intermediate states sampled |
| Finite floor support, 3000 steps /25 s | Independent gap `0 m`; max support-impulse error `5.5512e-17 N s`; cumulative balance `2.5580e-12 N s` | `1e-10 m`, `1e-10 N s`, `1e-8 N s` |
| Sphere sliding/rolling | Final speed `0.7142857142857146 m/s`; spin `-3.571428571428573 rad/s`; energy `0.714285714285715 J` | Analytic `5/7`, `-25/7`, `5/7`, errors <=`1e-9` |
| Sphere contact work | Max independent impulse-work residual `1.5266e-16 J`; energy growth `0 J` | `1e-10 J` |

The pendulum reference does not use another copy of the stepper or the
finest run as truth. AGM and fixed Simpson quadrature give the elliptic
period. An inverted elliptic flight-time integral gives matched-time angle
and angular speed. Independent geometric potential and kinetic energy
give the energy envelope. At tiny amplitude, a separate Taylor potential
avoids cancellation. These checks do not certify all admitted parameters,
continuous rotations, or motion near the separatrix.

### Preserved failures and NO_GO

1. [Input first failure](evidence/inputs-before-01/motion-input.stdout): 24/25
   tests failed before the motion repair. No original test or tolerance was
   changed to conceal that failure. Final result:
   [25/25 PASS](evidence/inputs-final-01/motion-input.stdout).
2. [Compatibility first failure](evidence/physics-compatibility-01/persistent-box-probe.stderr):
   the runner emitted only the main graph, but the old consumer also imports
   `replay.js`. It failed before that consumer's numerical work. The runner
   now emits the replay graph too. Only the two remaining consumers were
   run in [the corrected attempt](evidence/physics-compatibility-02/commands.json).
3. [Type first failure](evidence/types-01/example-types.stdout): one new test
   inferred an incompatible union for an array of limit records. An explicit
   `TimedPath['limits'][]` annotation fixed the test. Package types were
   already green and were not repeated. [Example types then passed](evidence/types-02/commands.json).
4. [Unchanged mini-stack output](evidence/baseline-01/original-mini-stacks.stdout):
   OFFSET max late horizontal displacement `0.10636958 m`; YAW
   `0.10806532 m`, both above `0.01 m`. Both also exceed the `0.02 m/s`
   late speed gate. OFFSET exceeds the angular-speed gate. The diagnostic
   exits 0 because all steps complete, while its physical verdict is
   `BOUNDED_SETTLING_NO_GO`. Contact depth is producer-reported here,
   not an independent SAT result. Original 8-box #1399/#1572 acceptance
   remains NO_GO; the current persistent public profile refuses 9 bodies.
5. #1489's historical step-77 one-ULP mismatch remains unresolved. Candidate
   `7178434a...` is absent from this local object database. The current
   develop public admission refusal was measured instead. No archived
   native numerical campaign was repeated. #1490 live Viewer is NOT_RUN.

The old two-box probe passes only its original criteria and fixture. It
does not override the measured three-box failure or the original eight-box
failure. Neither an exit code nor deterministic replay establishes accuracy.

## Reproduce

Use Node >=22 and the repository's existing installed esbuild/TypeScript.
Do not install or download automatically. From the worktree root, use a new
run ID for every attempt. The runner refuses to overwrite an earlier run.
Acquire and release the existing heavy gate in the same shell for each
suite. Actual invocations used installed Node 22.19.0; full command arrays
are in every `evidence/<run>/commands.json`.

```sh
node examples/physics-motion-foundations-2276/run.mjs baseline baseline-new
node examples/physics-motion-foundations-2276/run.mjs kinematics kinematics-new
node examples/physics-motion-foundations-2276/run.mjs units units-new
node examples/physics-motion-foundations-2276/run.mjs tests dynamics-new
node examples/physics-motion-foundations-2276/run.mjs compiled emitted-new
node examples/physics-motion-foundations-2276/run.mjs contact contact-new
node examples/physics-motion-foundations-2276/run.mjs contact-compiled contact-emitted-new emitted-new
node examples/physics-motion-foundations-2276/run.mjs public-package public-new emitted-new
node examples/physics-motion-foundations-2276/run.mjs robot-compatibility robot-new
node examples/physics-motion-foundations-2276/run.mjs compatibility compatibility-new
node examples/physics-motion-foundations-2276/run.mjs types types-new
node examples/physics-motion-foundations-2276/run.mjs lint lint-new
```

`baseline` retains the original mini-stack diagnostic's physical NO_GO
fields. It is not an all-physics success command. These are explicit local
automated suites. They are not registered as a new CI job or root test gate.

## Remaining dependencies

General connected joints, gravity-driven World hinges, dynamic box contact,
stable eight-box stacks, contact/control composition, arbitrary CAD collision,
and cross-platform bit replay remain unqualified. A justified contact-law
change needs independent geometry, full energy/work accounting and the
unchanged original cases before admission can expand. #1489 needs its exact
runtime/reference decision before public activation. #1490 depends on that
activation and is outside this algorithm work.

Low-level timed paths still require stable object contents after their first
cached evaluation. Mutation of a cached path is not qualified; the existing
high-level RobotPath snapshot behavior passed its own tests. This work does
not claim a new general immutable cache contract.

Source code exists, local source execution passed, emitted main API execution
passed, and selected old consumers passed. Full Physics subpath packaging,
the full workspace build/CI, Integration adoption, Studio use, publication,
deployment and release were not performed. No machine or measured hardware
was used. There is no claim of equipment prediction or manufacturing safety.
