---
work_id: physics-rigid-rotation-g1-2276
artifact_type: read-only-current-core-integration-map
status: AUTHOR_READY_SOURCE_ONLY_BASELINE_NOT_RUN
owner_role: current-core-integration-audit
source_request: map existing angular ownership and affected consumers before a frozen G1 baseline
last_updated: 2026-11-02
---

# Decision boundary

This is a source map at `357caa03fe3db1d1fe4939c979c9429314f6fa5f` plus the
parent's separately preserved impulse results and roadmap work. No candidate,
algorithm, reference equation, acceptance gate or execution population is
selected here. High owns CONTRACT/CASES. The unchanged current provider must
first be frozen and its G1 baseline reproduced under a separately authorized
finite ledger. No production file was edited. Module evaluation, constructors,
fixture construction, numerical calls, builds and World steps are all zero.

The current public rigid model admits rectangular boxes with unequal principal
moments and general initial world angular velocity. The free stage updates
angular velocity for commands/motors, then changes orientation while retaining
that velocity. No torque-free gyroscopic stage exists in that path. Existing
sphere-spin checks do not establish anisotropic free-rotation accuracy.

# Public data to candidate ownership

| Boundary | Exact current source and symbol | Relevant facts |
|---|---|---|
| Public model/state | `packages/barocss-physics/src/types.ts`: `RigidBody` dynamic variant, `InitialRigidState`, `BodyState`, `PhysicsCommand`, `PhysicsState` | Initial/public state contain `orientationXYZW` and world `angularVelocityRadps`. Inertia is model data, not an exposed body-state field. Commands carry world `torqueNm` or `angularImpulseNms`. |
| Pure admission | `src/model-admission.ts:33` `admitModel` | Copies raw model/options before dependent reads. Dynamic bodies require COM/body-local `primitive-com` or `sphere-isotropic` inertia. One identity-local collider per rigid body. Model quaternion norm is checked; parser constructs the numeric body directly. No old World/config converter. |
| Numeric body construction | `src/validation.ts:78` `parseBody` | Sphere scalar inertia or scalar override; box principal diagonal from mass and half extents; capsule currently receives three equal proxy moments. `quaternion` normalizes admitted input. Body owns `inverseMass`, `inverseInertiaLocal`, optional scalar/diagonal moments and copied angular state. Static/kinematic bodies have zero inverse inertia and are excluded from dynamic angular updates. |
| Internal record | `src/internal-types.ts`: `Body extends PhysicsBodyState` | Stores orientation, world omega and local inverse moments. There is no angular-momentum accumulator, gyro cache, integrator clock or history field. |
| Per-step copy | `src/validation.ts:145` `copyBody`; `src/world.ts:205` | `next = bodies.map(copyBody)` copies shape, position, velocity, quaternion, omega, diagonal moments, inverse moments and filter. Accepted bodies are not the work buffers. |
| Tensor operations | `src/math.ts:36` `inverseInertia`, `:40` `inertia` | Both transform vectors through the current body orientation and local inverse moments. These are current shared numeric helpers, not a new G1 oracle. `advanceOrientation` is a pure quaternion update also used by geometric joint corrections. |

`getModel()` returns copied original model data. Internal admission can normalize
the quaternion, so a candidate-local quantity must use the actual numeric Body,
not assume the raw initial model quaternion equals accepted internal storage.
There is sufficient current Body data to derive angular momentum locally for
one candidate attempt. A new accepted hidden momentum field, persistent solver
cache, recording field, owner or clock is not required by this data model.
This does not select how the new numerical stage will update orientation/omega.

A derived temporary must have an explicit phase owner. Do not attach it to a
Body through an unreviewed spread property or store it in a module/WeakMap.
That would survive `bodies = next`, create a second state contract and burden
failure rollback/reconstruction/disposal. A temporary must not later overwrite
angular impulses already applied by a motor, contact or joint.

# Exact rigid step order and downstream consumers

`src/world.ts` currently performs these stages inside the one guarded step:

1. Lifecycle/recorder/budget checks; copy commands; `parseCommands`; domain,
   dynamic-hinge/disjoint-hinge and CCD angular-command preflight.
2. Recorder `prepareFrames`, copied candidate bodies, motor impulse slots and
   candidate sleep counters. Large-profile `wakeForActions` precedes motion.
3. Dynamic, awake bodies receive external angular impulse and torque through
   `inverseInertia`. The existing arithmetic executes even with no action.
4. `driveDisjointHingeMotors` or `driveHingeMotor`/`driveDynamicHingeMotor` changes
   candidate omega using previous accepted joint-angle report memory.
5. Free motion: the current angular guard, `advanceOrientation`, linear commands,
   gravity, displacement guard and position update. Kinematic movement follows
   its own branch. Sleeping large-profile dynamics skip this motion.
6. CCD, broad phase and eight contact/joint passes. Contact warm starts/solver
   impulses and joint pose corrections can change omega and/or orientation.
7. Disjoint postcontact projection/report caps; sleeping update; contacts/events;
   final numeric checks; public state and recorder output/log preparation.
8. Assignment-only shared commit, then the sole `stepIndex++` and return.

The G1 integration boundary is the body-aware free-motion stage, after the
existing angular actions/motors and before downstream contact/joint consumers.
Its exact algorithm/order remains a CONTRACT decision. Changing the semantics
of `advanceOrientation` itself would also change pose-correction calls which
pass an angle vector with `dt=1`; those are not free-body time integration.
There is no justification here to rewrite that shared geometric helper.

| Consumer | Exact symbols/files | Impact to review |
|---|---|---|
| Point contact | `collision.ts` `solve`, `validateResult` | Uses current omega for contact-point velocity and current q for inverse inertia; normal and friction impulses update omega. Geometry also consumes q. A stale or post-contact-restored free-stage momentum would invalidate these changes. |
| Persistent box contact | `persistent-box-contact.ts` `warmStartPoint`, `solvePersistentPoint`, `correctPersistentPair` | Candidate `nextPersistentPoints` clones prior impulse values/tangent arrays before mutation. Contact impulse cache is accepted only at shared commit. Preserve its ownership and warm-start order. |
| Motor | `joint-motor.ts` `driveHingeMotor`, `driveDynamicHingeMotor` | World-axis effective inertia, speed and equal/opposite angular changes. Current motor order and impulse/reaction caps are separate existing contracts. |
| Static/kinematic-A joint | `joints.ts` `projectJoint` | Can admit a dynamic box as B. Fixed/hinge projection changes q and omega, then reports `inertia(b, omegaAfter-omegaBefore)` at the corrected body orientation. Anisotropic report meaning needs explicit review; this audit does not replace it with a new law. |
| Dynamic pair joint | `dynamic-fixed-joint.ts`, `dynamic-hinge-joint.ts`, `dynamic-anchor-pair.ts` | Dynamic/dynamic admission is limited to two spheres; pose helpers use `advanceOrientation` geometrically and alter omega. They are compatibility boundaries, not anisotropic-box qualification. |
| P3 special stage | `disjoint-hinge/{admission,stage,postcontact,projection,pose,report}.ts` | Four exact primitive spheres; previous report drives motors; candidate pose/velocity projections then reports/caps. Do not repeat angular/motor/free/contact stages or add gyro state to that qualified phase ledger. |
| Sleep/filter/bounds | `sleep.ts`, `scene-profile.ts`, `broadphase.ts` | Wake actions, candidate sleep counters, contact islands and q-dependent bounds retain their order. `updateSleeping` can zero omega. Do not apply an earlier derived momentum after that zeroing. |
| CCD | `ccd.ts`, `ccd-box.ts` `axisAlignedBox`, `rejectAngularBoxCommand` | Box-pair CCD requires axis alignment and nearly zero omega; nonzero angular commands refuse. Candidate and post-contact alignment checks must remain. G1 does not enable general rotating-box CCD. |

# Guards, error ownership and tests required before integration claims

These are existing cutoffs, not proposed new error gates:

- `validation.ts` initial omega components: finite and within ±1000 rad/s.
  `parseCommands` admits one command of each kind per dynamic body; torque
  components are bounded by ±1e6 N·m and angular impulse by ±1e5 N·m·s.
- `world.ts:239` pre-orientation guard: finite omega, each component at most1000,
  and `hypot(omega)*dt <= 10`. It throws canonical `NUMERIC_LIMIT` before q moves.
- `collision.ts:227` `validateResult`: final omega is finite/component-bounded;
  q is finite with unit-norm residual at most1e-12. It does not repeat the
  dt-scaled angular-displacement guard after a new omega recomputation.
- Joint reactions and motor caps are checked before output/commit. Box CCD has
  its separate post-contact alignment refusal.

A new recomputed omega must reach the existing safety boundary before another
stage consumes it. Required controls include finite/component failure and the
existing dt-scaled angular-limit failure after recomputation, with accepted
cursor/state unchanged. A source-only injected nonfinite candidate value is a
validator control, not a naturally observed physical NO_GO or genuine OOM.
The exact finite recipes/call budgets belong to the later freeze.

Also freeze controls for an unknown throw after one body's prepared q/omega,
a later-body failure, output-copy failure and recorder-log preparation failure.
Read current state/model after failure, retain raw signs, and compare the next
valid step with a never-failed control. Check all accepted contacts/events,
joint reports, sleep counters, persistent impulses and recording frames remain
unchanged, not only pose/omega. Returned state/model mutation must not change
accepted inertia or orientation. Guard reentrancy, recorder-owned direct/cached
step refusal and canonical `PhysicsError` identity remain common-World rules.

# Output, recorder and hidden-work boundary

`world.ts` `publicState` copies q/omega, contacts, joint reactions and report
values. `getState` allocates a fresh copy; the successful step prepares that
copy and `owner.prepare` before assigning bodies/caches/cursor. Unknown errors
propagate unchanged. The wrapper `guarded` enriches only canonical PhysicsError
with accepted cursor and operation/domain details. `dispose` clears bodies,
joints, caches and recorder/domain ownership.

`recording-owner.ts` has one shared WeakMap capability table. `replay.ts`
records model/options, command frames and final public state. `restoreRecording`
constructs one World and replays all frames. Serialization and deserialization
also reconstruct an extra temporary World; these are real constructors/steps
and must be counted in any future G1 recorder gate. No hidden replay runs may
be called DATA checks.

`replay-validation.ts` checks q/omega state fields; `replay-compare.ts` retains
its current numeric replay comparison. These are not independent physical or
raw-sign truth. A local derived momentum requires no wire-schema change.
Provider changes must produce the actual new provider digest. Old provider
recordings must not be made current by rewriting identity or weakening stale
checks. Preserve the original provider/recording receipts for historical claims.

# Existing proof/caller inventory

| Inspected entry | Actual scope and G1 relevance |
|---|---|
| `examples/physics-motion-foundations-2276/world.test.ts:53` | One sphere spin at fixed dt1/120 for120steps after an angular impulse; exact-spin quaternion and copied model inertia observation. The matched-time dt refinement earlier in this file is ballistic translation, not anisotropic spin. |
| `examples/physics-scene/rotation-probe.mjs` | Sphere impulse/torque, expiry, world-frame quaternion product, scalar override, copy/refusal/dispose checks. Direct native import. No general-box free-top test. |
| `examples/physics-scene/oriented-colliders-probe.mjs` | An axisymmetric rectangular box with offset contact, q-dependent geometry, queries/copies and atomic angular refusal. Its contact smoke checks cannot replace a torque-free G1 baseline. |
| `box-point-probe.mjs`, `persistent-box-probe.mjs`, `friction-stack-probe.mjs`, `large-scene-probe.mjs` | Cubic box-point/persistent contact, spherical friction, and spherical large-scene sleep/filter/copy boundaries. Preserve their exact old contracts and first failures; a cube impact result does not establish anisotropic box dynamics. |
| `joints-probe.mjs`, `hinge-motor-probe.mjs`, `dynamic-fixed-pair-probe.mjs`, `dynamic-hinge-motor-probe.mjs`, `offset-hinge-probe.mjs` | Downstream angular reactions, planar caps and failure behavior. Dynamic-pair paths are sphere-limited. Static-A box possibilities require separate law/profile review. |
| `thin-box-ccd-probe.mjs`, `ccd-probe.mjs`, `ccd-pair-probe.mjs` | Existing angular exclusions and sphere CCD. No permission to widen CCD in G1. |
| `replay-probe.mjs`; `examples/physics-world-p2-2276/{public.test,fault.test}.mjs` | Genuine owner/copy/reconstruction and injected precommit failure controls. Existing helpers add Worlds/steps; count them before selection. |
| `examples/physics-world-p3-2276/{fixture,compare,compat}.mjs` | Exact original/rename/permute sphere phase/cap/report/raw-bit authority. General anisotropic behavior is outside that bank. |
| `examples/physics-rigid-contact-reference/fixtures.mjs` | ALIGNED/OFFSET/YAW dynamic cubes have literal equal half extents. The finite static floor is not a dynamic anisotropic body. These original P4 fixtures/archives remain immutable. |
| `examples/physics-rigid-full-pair-position-world/reference-controls.mjs`; `physics-rigid-signed-closure-world/reference-controls.mjs` | Manually authored orientation-only anisotropic ledger controls retain old free-q/omega expectations. They classify their historical reference protocol; they do not supply a new gyroscopic trajectory oracle. Do not edit/relabel the old controls to manufacture G1 PASS. |
| `apps/library-docs/samples/physics-docs.test.mjs` and current Physics pages | Public model/rigid/replay consumers, units/frame semantics and bounded support descriptions. They do not add a matched-spin off-axis reference. The whole175-sample runner is not a selected G1 command. |

No existing matched-time, multi-dt anisotropic spin qualification was found in
these inspected active rotation tests/probes. Historical reference/control
names are not evidence that the current public free-rotation trajectory passed.

# Preserve physically isotropic arithmetic

P3 spheres have scalar primitive inertia. Original P4 dynamic cubes have equal
primitive principal moments. Current capsules use a declared isotropic proxy;
G1 must not silently replace that proxy with calibrated capsule inertia.

Where the frozen G1 design identifies actual isotropic numeric inertia, retain
the current action/motor/free-quaternion arithmetic and order exactly. Even
mathematically equivalent zero-action shortcuts or rotated-tensor simplification
can change signed-zero/raw bits. Identify physical inertia from admitted data,
not fixture IDs, a legacy flag, an archive detector or an alternate engine.
The new source/native provider identities remain explicit even when the old
physical payload is preserved. Exact unchanged cube/sphere evidence is a
compatibility boundary; it does not qualify unequal-moment boxes.

# Bounded work proposal and available tools

No command below was run. Parent must first freeze High's CONTRACT/CASES,
current source/native providers, baseline/oracle closure, error/resource gates
and complete actual call ledger. Preserve the baseline first failure before
any implementation. Do not run old broad campaign modes to discover counts.

Available local tools are Node22 at
`/Users/user/.volta/tools/image/node/22.19.0/bin/node`, the installed native
`node_modules/esbuild/bin/esbuild`, TypeScript `lib/tsc.js` plus `_tsc.js`, and
the existing `physics-world-p5-2276/command-run.mjs` owned-group guard. Use the
existing heavy gate and fresh evidence IDs. No dependency install is needed.

After separate authorization, an individual source test can be bundled with
the installed esbuild binary and an explicit current-root alias, then selected
by `node --test --test-name-pattern` on that fresh bundle. The foundation spin
leaf has the exact name `sphere inertia and finite rotation agree with angular
impulse and exact spin`. Direct native probes use `node <probe-path>` only after
a fresh genuine provider build and explicit constructor/step census. Their
module top levels execute Worlds. Source compilation alone is not that runtime
proof. The existing foundation runner's `tests`/`compiled` modes include more
leaves; they are not an automatic bounded G1 selection.

Expected minimal implementation review surface is the common rigid free stage
in `world.ts` and a private numeric leaf if High chooses one. `math.ts`, numeric
Body parsing/copying and public types can remain existing interfaces unless a
specific reviewed need is demonstrated. Contact/joint/cache/report files above
are downstream review and verification dependencies, not blanket edit targets.
P5 domain kernels take their earlier separate branch and do not execute rigid
free motion; no cloth/fluid solver or CAD package change follows from G1.

`build-root.mjs` already resolves only the canonical root types, recording-owner
and provider-manifest siblings as externals. Preserve that one Error/registry
identity in source and true published-native graphs; do not replace it with a
source fallback. Any actual package build/provider regeneration is parent-owned
and separately frozen. Docs/site/product or full caller campaigns are separate
work, not implied by this source map.

# Checkpoint

This document is the only authored output. All baseline and new G1 numerical,
fault, recorder, compatibility, source/native and performance results remain
NOT_RUN. Reference formulas, exact cases, thresholds and candidate method remain
with High/parent review. The completed private instantaneous impulse operator
advances no orientation and is not reopened by this free-rotation audit.
