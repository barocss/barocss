---
work_id: physics-stack-stationary-world-2276
artifact_type: verification
status: done_bounded_local
owner_role: independent-physics-algorithm-work
source_request: qualify the original stack through the common World and desktop rendering
last_updated: 2026-11-04
---

# Stationary eight-cube profile: bounded local PASS

The new public `rigid-stationary-cube-stack-v1` profile uses the sole
`createPhysicsWorld(model, options)`, common clock, recorder and restore path.
It qualifies equilibrium maintenance, not falling, bouncing or collapsing
eight-body dynamics. All previous QR solver failures, HOLDs, original limits
and first failure records remain historical evidence. No deployment or release.

## Independent physics before public integration

The exact stationary solver receives the actual 32 generated points. It
constructs nonnegative exact rational impulses and checks all 48 dynamic DOFs,
32 primal rows and complementarity before returning zero motion. An independent
Python Fraction checker checks the full certificate without running triangle
selection. There is no expected-pose table, rest threshold or QR fallback.
Rounded Number impulses are diagnostics; exact applied ratios are separate.

The unchanged first32 Float reference measures maximum closing speed
8.326672684688674e-17 m/s, complementarity 2.0421164759198977e-17 J, velocity
and net-impulse error 6.938893903907228e-17 SI, and impulse-work error
1.3877787807814457e-17 J. These are first32 measurements, not full-trajectory
maxima. Exact frozen-J balances are zero; true-lever/rounded checks stay separate.
Source/Native bank32 and independent positive/negative controls pass.
The initial strict compile failure is preserved in `same32-01`; erased type
fixes precede the actual successful `same32-02` execution.

The private complete campaign `physics-stack-stationary-complete-2276/evidence/full-01/campaign-result.json`
reports `ORIGINAL_INDEPENDENT_PHYSICS_3600_CONFIRMED`: ALIGNED, OFFSET and YAW
each accept 1200 contiguous steps, with all original contacts/world/position,
ledger and quality checks, additional Fraction checks, complete archive recovery,
final authentication and clean child closure. Each scene observes 1201 states;
241 terminal states and the original step960 baseline are retained.
Owner times are 97.19414512510411 / 104.71290179085918 /
132.82949437503703 seconds under the original 170-second scene/180-second owner
limits. Shared evidence is 186002682 / 293601280 bytes with the original
2097152-byte reserve. No global64MiB or process RSS qualification follows.

Exact pre-public source inputs are retained in
`physics-stack-stationary-complete-2276/baseline/full-01-sealed-inputs.tar.gz`,
SHA256 `fd0be1c46bd207804b3e00ac5c21d8d025072a09af3bd01ac26d4162b7a7cdf5`.
Later public source changes do not rewrite that campaign's PINS or receipts.

## Public API, failures and recording

Canonical build15 passes. Strict NodeNext Source and actual emitted root/replay
each pass 11 public/output groups and all three 1200-step runs. Every initial
and accepted public body word equals the independently qualified private trace.
`public-native-01` failed on a missing evidence directory before any engine call;
`public-native-02` and `public-source-01` are separate successful runs.

Source/Native fault banks each pass six groups at frames/candidate/output/log/
commit boundaries. Known and unknown failures preserve state, clock, model and
recording; retry, restore and continuation pass. Root/replay cross-provider
identity checks pass separately. Instrumented copies are example-only tests,
not production providers. Public recording caps remain 512 frames and 1MiB;
the 1200-step trace is an observation, not a PhysicsRecording.

The independent one-step 0.0001m gap case passes with actual nonzero displacement.
Both Source/Native public gap fault banks pass six groups, including 20 injected
throws, exact nonzero candidate parity, rollback, clean retry and restore.
One further continuation agrees with a clean control. This does not qualify a
second independent gap step or a 1200-step gap trajectory.

## Actual desktop execution

`output/playwright/stationary-stack/desktop-formal-01` contains actual Chrome
WebGPU ALIGNED/OFFSET/YAW runs, each 1200 steps and 1201 captured body frames.
All three are `DESKTOP_SCENE_OBSERVED_AND_WORD_EQUAL`; actual byte streams equal
the paid private traces. One page uses four Worlds total (zero-step reset plus
three scenes) and 3600 accepted steps. The Worker alone owns World/time.
Step/play/pause/reset, contact markers, camera and 1280/1440/1920 desktop widths
are checked. GPU submissions contain nine bodies/eight contact markers; submitted
vertices and marker centers have independent display-only geometry checks.
Display tolerance1e-6m is not a relaxation of physical tolerances.
No page/console/network errors. Source integrity passes; owned proof browser
closes. Screenshots establish rendering only. No mobile test.
The complete desktop proof directory contains3620100 bytes, below its unchanged
16MiB bound; this is retained proof size, not process memory.

## Scope and next dependency

Admission requires eight1kg cubes with half extents0.25m, primitive COM inertia,
yaw-only orientation and zero motion, the fixed original floor/materials,
g=[0,-9.81,0], dt=1/120, direct broad phase, empty commands and no joints/domains.
The actual directed 32-point chain and exact witness must pass at runtime.
Unsupported poses can refuse; greedy witness failure does not prove general
infeasibility. IDs/scene names do not select a saved solution.

The persistent-box profile remains at four bodies with unchanged8x8 loops.
General eight-body motion, frictional settling, restitution, contact topology
changes, arbitrary mass/inertia, connected mechanisms and real equipment remain
NO_GO or unqualified. The existing1/2-body impact now also passes11 real checks
in the current Native desktop build; see `physics-motion-desktop-2276/RESULTS.md`.
Next: qualify gravity-driven normal motion on a small island before extending moving multi-body scope. Numerical and desktop
motion checks belong to each such stage; no Studio/manufacturing/equipment work.

## Actual commands

All numerical/browser commands use installed Node22, existing gates and the
owned180s wrapper; no install, download, tolerance/iteration increase or deploy.

```
node examples/physics-stack-stationary-world-2276/run.mjs native public-native-02
node examples/physics-stack-stationary-world-2276/run.mjs source public-source-01
node examples/physics-stack-stationary-world-2276/fault-run.mjs source examples/physics-stack-stationary-world-2276/evidence/public-source-01/source-modules public-fault-source-01
node examples/physics-stack-stationary-world-2276/fault-run.mjs native packages/barocss-physics/dist public-fault-native-01
node examples/physics-stationary-stack-viewer-2276/scene/server.mjs desktop-formal-01
node examples/physics-stationary-stack-viewer-2276/browser-run.mjs desktop-formal-01 ALIGNED
node examples/physics-stationary-stack-viewer-2276/browser-run.mjs desktop-formal-01 OFFSET
node examples/physics-stationary-stack-viewer-2276/browser-run.mjs desktop-formal-01 YAW
```

Source/native runner arguments and actual frozen commands in receipts are
authoritative. Gap fault and cross-provider tests require the explicit provider
and SHA bindings recorded in their admission notes/owned command receipts.
