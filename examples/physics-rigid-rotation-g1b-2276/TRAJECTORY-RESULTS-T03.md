# G1b: 0.1-second trajectory and state preservation

The named profile passed. This result combines the saved T02 Source PASS with a fresh Native completion. The earlier T02 campaign remains a resource FAIL. There was no single successful run of all 16 Worlds.

The plant is one 1 kg box with primitive-COM inertia and half extents [0.1, 0.2, 0.3] m. Initial orientation is the identity quaternion. Initial world angular velocity is [1, 1, 1] rad/s. Gravity and translation are zero. There are no contacts, joints, domains or CCD.

The three trajectories use time steps of 1/60, 1/120 and 1/240 second for 6, 12 and 24 steps. Time comparisons use the exact sums of the recorded binary64 time steps. The nominal horizon is 0.1 second. Five controls test principal rotation about x, y and z, zero spin, and a negative initial quaternion. Each control runs one step at 1/120 second.

| Actual path | Worlds | Accepted steps | Independent state audits | Failure controls | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Saved T02 staged common-World Source | 8 | 47 | 55 | 10 | PASS |
| Fresh NodeNext emitted public entry | 8 | 47 | 55 | 10 | PASS |

The fresh completion ran no Source module, World or coefficient calculation. It used the same authenticated M02 providers and strict NodeNext output. It ran no new build or emit and used no Source fallback. Current package activation and the canonical build root remain NOT_RUN.

The following maxima are identical for the two qualified paths.

| Quantity | Maximum error | Unchanged limit |
| --- | ---: | --- |
| angularMomentum (kg*m^2/s) | 8.688303184260071e-17 | 2e-12 |
| rotationalEnergy (J) | 1.355245257925628e-16 | 2e-12 |
| quaternionSquaredNorm (dimensionless) | 2.937723408598743e-16 | 1e-12 |
| linearMomentum (kg*m/s) | 0 | 1e-12 |
| comPosition (m) | 0 | 1e-12 |
| Reference omega component | 2.154505342319026e-14 | 1e-11 + 1e-12 × abs(reference) |
| Reference R component | 3.553155138080568e-14 | 1e-11 + 1e-12 × abs(reference) |
| Reference q component | 1.697760950549119e-14 | 1e-11 + 1e-12 × abs(reference) |

| Grid | Steps | Maximum R error | Maximum world-omega error (rad/s) | Maximum q error |
| --- | ---: | ---: | ---: | ---: |
| T01-dt60 | 6 | 3.553155138080568e-14 | 2.154505342319026e-14 | 1.697760950549119e-14 |
| T02-dt120 | 12 | 4.026136982277312e-16 | 2.208926377901755e-15 | 1.885839088718693e-16 |
| T03-dt240 | 24 | 6.84375557606673e-16 | 3.39886227694751e-15 | 3.269374362279035e-16 |

All 36 matched-time refinement checks in each path are below the predeclared 1e-11 floor. No measured convergence order is established. The 1.8 reduction criterion and the floor were fixed before execution. [The result JSON](TRAJECTORY-RESULTS-T03.json) contains exact rational errors, limits and locations.

Each path passed four command refusals, three unknown faults with the original Error object, and three numeric guards after the free-flow calculation. Accepted public state, clock, caller data and private cache identities and Map contents remained unchanged. The scheduled first step then passed. No extra recovery World, step or duplicate state audit was added.

The Native helper totals were observed: 49 general flows, 1,323 midpoint stages, 5,292 Newton updates and direct 3×3 solves, and 15,876 pivots. All 55 public frames and 139,552 recorded F64 words match the saved Source outputs. Each path retains its own verified provider digest.

The independent reference uses volume-integral inertia and validated Taylor integration at Decimal precisions 80 and 120. Its certificates include the full degree-64 defect and Picard bounds. The completed 44 windows and four saved M02 windows were reused exactly. Six principal targets use the qualified G1a bank with proper cyclic conjugation.

The fresh Native reference ran no new ODE, Decimal, square-root, inertia-integral or algebraic-root calculation. It performed 41,367 Fraction operations for the new audits. The study totals are 23,634,120 Decimal operations, 150,809 Fraction operations and 96 endpoint square roots. They remain inside the original limits. Clock labels use nearest-ties-even binary64 rounding. ODE time uses the exact sum of native time-step operands.

The first failures remain available:

- M01: an axisymmetry-only assertion in the reference, before any World.
- T01: the initial state was compared with itself in the harness. No physical step ran.
- T02: the later Native path reached the reference limit of 8,192 objects. Source had already passed.
- Native authentication 01: the parent input list omitted the controls pin. World and reference calls were zero.

Their sources, receipts and archives remain unchanged. T02 ran 13 Worlds and 90 accepted steps, including Source's 47 steps and the partial Native's 43 steps. The fresh Native completion added 8 Worlds and 47 steps. This repeat was required to observe the final Native helper totals and resource checks. Source and target integration were not repeated. Historical calls are not relabelled as one 16-World run.

The Native reference's peak owned charge was 8,204,673 B under its 8,388,608 B limit. The harness peak was 5,124,048 B under the same limit. The 8,192-object guard and all byte and time limits stayed unchanged. The outer guard completed in 29.883 seconds; internal execution took 27.945 seconds. Cleanup passed and no owned process group remained. These values include hashing, files and transport. They are not performance benchmarks or RSS/heap measurements.

The executed command uses installed Node 22:

`NODE22 examples/physics-world-p5-2276/command-run.mjs g1b-native-completion-guard-02 . NODE22 examples/physics-rigid-rotation-g1b-2276/native-completion.mjs --run-id g1b-native-completion-02 --freeze ABS/NATIVE-COMPLETION-FREEZE-02.json --token 414fffd9bc2ffd65185057ff702a755d2806f773f940a3b762d1fc9921bf96ba --authorize-native-completion`

The existing heavy gate owned the run. The guard receipt contains the full literal command, timestamps, process and closure records. This records an executed command; it does not request a repeat of the immutable run.

[The Native archive](NATIVE-COMPLETION-ARCHIVE-02.json) preserves every output with exact byte verification. [The Source proof](T02-SOURCE-COMPLETE-PROOF.json) preserves all 55 Source audit associations and the raw frames and traces. Report and archive work read closed DATA only. It ran no World or physical reference.

Remaining NO_GO or NOT_RUN items include wider admitted inputs and frames, longer horizons, torque, motors, contact, projection, joints, recording, coupling, canonical builds and production activation. The original 8-box stack remains NO_GO. General connected mechanisms remain unqualified. The next dependency is G1 adoption, range, frame and downstream qualification. P4, G2, P6 and P7 remain open.

Existing HOLD, tolerances, original NO_GO cases and first failures remain. No develop merge, push, deployment or release occurred. This work makes no hardware-prediction or manufacturing-safety claim.
