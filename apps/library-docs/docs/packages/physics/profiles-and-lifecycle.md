# Physics profiles and lifecycle

Choose the numerical profile before creating a world. A larger body-count limit does not enable
all smaller-profile features. Admission limits describe allowed inputs; numerical evidence covers
the named cases only. This page describes the current unreleased branch, without a publication or
active CAD adoption claim. Start with the [package overview](./) and [unit contract](./units-and-frames).

## Rigid world profiles

All rigid-world profiles use `createPhysicsWorld(model, options)` from `@barocss/physics`. Unless a narrower
profile fixes the step, `fixedStepSeconds` is in `[1/240, 1/30]` s. `step(commands?)` uses the configured value and takes no time argument. The world admits at most 3600 accepted steps and requires at least one dynamic body.

| Selection | Capacity and combinations | Numerical scope and evidence route |
| --- | --- | --- |
| `profile:'rigid-discrete-v1'` | 1–32 spheres, oriented boxes or capsules; optional `broadPhase:'aabb'` | One contact point per pair and eight solver passes. Primitive contacts are not exact CAD collision. See the package's `examples/physics-scene` probes and [verification](/reference/physics-verification). |
| `profile:'rigid-persistent-box-v1'` | At most four bodies; no `large-v1` or box-pair CCD | Up to four clipped points for face-normal box contacts and bounded impulse reuse. Edge/edge and non-box pairs use the one-point path. Recorded centred and 0.05 m offset fixtures do not qualify arbitrary stacks. |
| `profile:'rigid-large-v1'` | 1–64 bodies; requires `broadPhase:'aabb'`; requires an empty `joints` array, CCD and persistent boxes | Fixed collision filters and contact-island sleep. The named 63-sphere floor probe is a capacity case, not a general 64-body stack certificate. |
| Anchored fixed or hinge joints | At most eight records. Each static/kinematic A connects to a uniquely jointed dynamic B | Body-local initial anchors must coincide within `1e-6` m. A hinge uses unit `axisWorld` and limits within ±π/2 that include zero. Connected bodies do not collide. |
| One dynamic fixed joint | Exactly two dynamic spheres, no other bodies or joints | Inverse mass/inertia distribute corrections. The recorded equal-mass impulse fixture does not qualify general joint networks. |
| One concentric dynamic hinge | Exactly two dynamic spheres at the same centre; zero gravity, zero initial motion, identity orientation, zero local anchors | Planar angular commands along the hinge axis only. An optional motor drives relative B/A speed with equal and opposite impulses. |
| One offset dynamic hinge | Exactly two 1 kg spheres of radius 0.1 m; centres at ±0.1 m on X; opposing 0.1 m local X anchors | Fixed +Z hinge, limits `[-0.8,0.8]`, zero gravity and 1/120 s step. Motor target 0.5 rad/s, impulse cap 0.0001 N·m·s and reaction cap 0.01 N·m·s. This is one fixture. |
| Two disjoint dynamic hinges | Exactly four 1 kg spheres of radius 0.1 m, forming the offset pair at Z=0 and Z=1 m | `rigid-discrete-v1`, direct broad phase, zero gravity, exact identity initial quaternions, zero initial motion, restitution 0, friction 1/0.7. Both hinges use the offset limits/motor above. Only empty commands; cross-component contact refuses. See the bounded evidence below. |
| Sphere/static-box CCD | One CCD dynamic sphere and 1–8 static nonsensor oriented boxes; no joints or other bodies | Conservative expanded-box sweep. Rounded corners can produce early hits. |
| Dynamic-sphere-pair CCD | Exactly two nonsensor dynamic spheres, exactly one with `ccd:true`; zero gravity, no joints | Relative sphere sweep. `colliderId` denotes the other dynamic sphere's collider. |
| Axis-aligned-box-pair CCD | One CCD dynamic box and one static nonsensor box, both axis-aligned; no joints or persistent boxes | Nonzero angular commands refuse. Contact-induced rotation refuses the candidate. This covers the named thin-box fixture. |

CCD stops at the earliest admitted hit with a `1e-9` m inward offset. It does not integrate the
remaining fraction of that step. Initial overlap/touch uses the discrete path. Capsule CCD, general
oriented-box CCD and arbitrary moving-body networks are outside these profiles.

An anchored hinge motor uses `motor:{targetSpeedRadps,maxImpulseNms,maxReactionNms}`. Target speed
is within ±2 rad/s. Its positive motor impulse cap is at most 0.05 N·m·s and its positive reaction cap
is at most 1 N·m·s. It stops pushing outward at a hinge limit. Exceeding the reaction cap gives
`NUMERIC_LIMIT`; it is not a material break-strength model. The offset profile fixes narrower values.

The public persistent-box limit remains four bodies. Private nine-body studies do not raise it or
activate the original eight-box experiment. The disjoint-hinge profile has a separate qualification;
it does not admit connected two-link mechanisms. Keep historical NO_GO results and unresolved causes alongside later
bounded results in [Physics verification](/reference/physics-verification).

### Use the selected disjoint-hinge model

Both directed pairs have local anchors `[0.1,0,0]` and `[-0.1,0,0]` m. The
centres are `[-0.1,0,0]`, `[0.1,0,0]`, `[-0.1,0,1]` and `[0.1,0,1]` m.
Initial quaternions must be exactly `[+0,+0,+0,1]`; normalization aliases and
negative-zero quaternion components refuse. No body is shared between joints.
The existing common World owns both pairs and one accepted clock.

<<< @/../samples/physics-docs.test.mjs#disjoint-hinge-fixture

Use the imports and `worldOptions` from the [overview](./). The helper above
also uses its `freeModel()` and `freeBody()` data builders. Empty arrays are
the supported command input for this profile. Nonempty angular commands along
the axis also refuse. Do not substitute a prescribed motion path.

<<< @/../samples/physics-docs.test.mjs#disjoint-hinge-step

This short example verifies API use. The separate original 1,200-step campaign
and its precise source/emitted boundaries are in [verification](/reference/physics-verification#p3-disjoint-hinge-qualification).
It does not establish arbitrary joint networks, contact coupling, a convergence
order, cross-runtime equality or measured machine accuracy.

### Rigid input bounds

The model declares all entity arrays, including empty `joints`, `cloths`, `fluids` and `sourceBindings`.
Rigid profiles refuse nonempty cloth/fluid arrays. Each rigid body has exactly one collider with an identity
local transform. `ccd`, sensor flags, geometry, material and collision filters belong to the collider.
The body declares mass/inertia for dynamics and its explicit `initial` state. State carries numerical motion;
read copied `getModel()` data for initial conditions, collider geometry and source bindings.

Body IDs are unique ASCII identifiers with at most 64 characters and a starting letter.
Each position component is within ±10000 m. Velocity components are within ±1000 m/s and gravity
components within ±1000 m/s². Mass is `1e-6`–`1e6` kg. Sphere radius, box half extents and capsule
length parameters are `1e-4`–1000 m. Restitution is 0–1. Explicit material friction satisfies
`0 <= dynamic <= static <= 2`; supply both coefficients, including zero values.

A step accepts at most 64 dense plain-object commands. Each body can receive one command of each
applicable kind. Force and torque components are bounded by ±`1e6` N or N·m; linear and angular
impulse components by ±`1e5` N·s or N·m·s. Angular velocity components are within ±1000 rad/s.
A candidate refuses movement or measured penetration above 10 m, or angular displacement above
10 rad per step. Limits are numerical guards, not recommended physical operating conditions.

## Separate numerical profiles

These entry points do not increase `PhysicsWorld` capacity or share its contacts. `/replay` delegates to one
rigid World through an attached recorder. `/fluid-cad` delegates to the fluid solver with a static CAD box; it is an
adapter. Fluid and cloth own separate state and clocks. They do not exchange forces with the rigid world or with
each other. Calling each `step` in turn does not provide a combined, atomic physical step.

Lifecycle also differs today: rigid, cloth and the independent reduced pendulum reference have idempotent `dispose()`. Fluid and CAD fluid
throw `DISPOSED` on a second disposal. Do not assume one lifecycle contract across the current factories.

| Entry and selection | Step and capacity | Boundary |
| --- | --- | --- |
| Independent example `createPlanarPendulum`, outside the public root | Step `1e-6`–`1/30` s; `dt * naturalFrequency <= 0.05`; `maxSteps` integer 1–1000000, default 1000000 | One reduced angle, velocity Verlet, no contacts, motors or damping. Pivot +Z, gravity −Y. No `reset()` method. |
| Root `createUprightCapsuleQuery`, `upright-capsule-box-v1` | 0–32 immutable static boxes; query displacement norm at most 2 m | Fixed upright capsule: radius 0.15 m, half segment 0.35 m. Scene box centres ±10 m, half extents 0.0001–5 m; query centres ±5 m. A sweep does not advance a world. |
| Root `createUprightCapsuleController`, `upright-capsule-controller-v1` | Exactly 1/120 s; at most 240 steps | Uses the bounded capsule query, −Y gravity, 0.002 m skin, 0.1 m step limit and 10° walkable slope. No general dynamic obstacles. |
| `/fluid`, version 1 or version 2 visual viscosity | Exactly 256 particles in a 0.7 × 1.3 × 0.5 m basin; 1/120 s; 3600 steps | Version 2 requires `visualViscosity:{kind:'xsph',coefficient:0.15}`. No calibrated viscosity, emitters or moving obstacles. |
| `/cloth`, `pinned-sheet-sphere-v1` | Fixed 289 vertices and 512 triangles; 1/120 s; 240 host steps | Two pinned corners and one static sphere. Visual settings; no fabric calibration, self-collision, tearing or arbitrary meshes. |
| `/fluid-cad`, version 1 water | Same version 1 water limits and one static axis-aligned CAD box proxy | Exact source/revision checks on step and reset. No version 2 viscosity combination or moving CAD obstacle. |
| `/replay` | At most 512 frames, 4096 total commands, 128 KiB canonical model and 1 MiB binary recording including its 8-byte magic | Bounded accepted rigid command log. Equality on restore does not establish physical accuracy. |

## Own the clock and retain accepted state

`PhysicsWorld.step(commands?)` advances one configured step. It does not read wall time or change
the step size to match display refresh. The host can accumulate elapsed display time and request
whole fixed steps, subject to its own work budget. A dropped display frame does not authorize a
larger Physics step.

`getState()` and successful `step()` return independent copies, including nested body vectors,
contacts, events, joints, CCD hits and pair counts. Editing returned arrays does not edit the world.
The world commits only an accepted candidate. An invalid command or numerical candidate
leaves the last accepted state available. Do not hide refusal with an automatic retry or a changed gate.

<<< @/../samples/physics-docs.test.mjs#refusal-and-lifecycle

This sample uses the imports, `dt`, `worldOptions` and `freeModel()` fixture shown on the [overview](./).
Its `hasCode(code)` helper accepts only `error instanceof PhysicsError && error.code === code`.
The test checks refusal after one accepted step, edits returned data, then checks the retained world.
`dispose()` is idempotent. Later reads, queries and steps give `DISPOSED`. The rigid world has no
public reset or arbitrary state setter. Create a new world for a new initial condition.

## Handle typed refusals

| Code | Caller action |
| --- | --- |
| `INVALID_CONFIG` | Correct the input model or select a supported profile before creating another instance. |
| `INVALID_STEP` | For separate domain or reference APIs that take `dt`, supply their configured step. A numeric argument to the rigid root `step` gives `INVALID_COMMAND`. |
| `INVALID_COMMAND` / `INVALID_QUERY` | Correct the command or query; do not alter accepted state to conceal the refusal. |
| `WORLD_LIMIT` | The admitted step, frame or command budget is exhausted. Choose an explicit new session. |
| `NUMERIC_LIMIT` | Stop advancing this model. Record the first failed input and the retained state before investigating. |
| `STALE_SOURCE` | Re-admit the CAD source/revision explicitly before replacing the binding. |
| `WORLD_OWNED` | Advance through the attached recorder; reads and queries remain available. |
| `STALE_SNAPSHOT` | Model, source, configuration or provider identity differs. Restore only against the intended matching identity. |
| `INVALID_SNAPSHOT` | Reject malformed, unsupported or damaged replay data. |
| `INITIAL_OVERLAP` / `ITERATION_LIMIT` | Capsule-query refusal: initial penetration or unresolved bounded search. This is not a partial valid sweep. |
| `DISPOSED` | Create a new instance. A disposed object cannot resume. |

State has `identity`, tagged query results use collider IDs, and bodies report `orientationXYZW`.
Contacts use `bodyAId`, `bodyBId`, `colliderAId`, `colliderBId`, `normalImpulseNs` and
`tangentImpulseOnBNs`. Joint reactions use `linearImpulseOnBNs` and `angularImpulseOnBNms`.
`PhysicsError.details` identifies the operation, phase, domain, entity IDs and last accepted step/time.

Use `PhysicsError.code` for branching. Error messages supply context and are not a stable protocol.
The root and fluid/cloth/fluid-cad subpaths share the error constructor within one installed package
instance. Do not assume `instanceof` identity across versions, realms or separate source/compiled bundles.

## Restore a command log, not arbitrary state

Attach `createPhysicsRecorder(world)` at step0, before any World step. The recorder supplies
`step(commands?)`, `getState()`, copied `saveRecording()` and `dispose()`. The configured `dt` owns time;
`step` takes no step-size argument. A direct or cached `world.step` call and a second attachment refuse with
`WORLD_OWNED`. World reads and queries remain available.

Recorder disposal detaches it without disposing the World. Dispose both objects when finished. World disposal
invalidates its recorder. Disposal releases recording/options references; no garbage-collection timing or
out-of-memory recovery guarantee follows. An advanced World cannot acquire a new recording history.

`restorePhysicsRecording(recording,{model,options,providerDigest})` validates complete recording shape and bounds
before expected model, configuration and provider identity. Source revisions are model `sourceBindings` data.
Use the intended current World's `getState().identity.providerDigest` as the external expected provider digest.
Restore reconstructs an isolated World, replays indexed accepted commands and compares final state at `1e-12`
absolute/relative numeric tolerance. It returns `{world,recorder}` only on success. Dispose both objects.
The command frame and log budgets are checked before candidate calculation. Final state, returned copy and
complete bounded encoding are prepared before the nonthrowing shared physical/log commit.
Changed identity gives `STALE_SNAPSHOT`; damaged data gives `INVALID_SNAPSHOT`.

Persist with `serializePhysicsRecording(recording):Uint8Array` and read with `deserializePhysicsRecording(bytes)`.
The wire format is ASCII `BCPHREC1` followed by bounded canonical typed encoding. It preserves binary64 number
bits, including `-0`. The decoder refuses JSON, unknown tags, nonfinite numbers, truncated/trailing bytes and
unsupported versions. Record keys use canonical ASCII order; arrays retain their order.
There is no old-version migration, arbitrary body-state import or bitwise cross-platform trajectory promise.

<<< @/../samples/physics-docs.test.mjs#replay-import

<<< @/../samples/physics-docs.test.mjs#replay-wire

P2_DONE_LOCALSELECTED: public source05/emitted05 pass11/11 each; test-only preparation faults pass15/15 each
across four step preparation points plus attach output preparation, each in three rigid profiles. Native03 passes staged published maps, strict positive/negative
declarations, shared ownership registry, CAD release consumer and four README blocks. Ordinary probes and foundation
checks pass21 per source/emitted graph; documentation samples pass174/174 in run03. Final recording callers pass3 per graph; documentation build/site/link receipts are docs-check/build/links-01. Historical P1b receipts apply only to their original providers.
Whole-engine acceptance remains NO_GO.

Keep a source-run receipt separate from a compiled-consumer receipt. Workspace aliases can resolve
source even after a build. A compiled check must resolve each transitive package through its published
entry map; the compiled root also needs sibling `dist/types.js`. See
[Physics verification](/reference/physics-verification) for provenance and the accepted evidence stages.
Neither replay equality nor a plausible animation validates contact loads, control hardware or manufacturing.
