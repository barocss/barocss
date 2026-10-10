## Status: READY for one bounded private face-sweep reference; freeze before code/trials

Parent: original #1179 `CAPSULE_THIN_CCD` admission refusal. This lane is independent of the contact-position work. Engine #1179/family #660 remain OPEN. Managed checkout `/Users/user/.codex/worktrees/physics-capsule-ccd/barocss`, exact base `6bd3376d6943a8d84b83ca62b0031a9ec8927bea`.

### Question and minimum gap

Can the unchanged original fast upright capsule reach a selected finite static box face at the analytic first-contact time, stop its closing translation with zero restitution, and account for the remaining step time without crossing the face?

The current public `createUprightCapsuleQuery` fixes radius at **0.15 m** and centreline half length at **0.35 m**. It exposes no dimension or capsule-orientation input. The original fixture is radius **0.1 m**, half length **0.2 m**, upright and zero-spin. It cannot be represented by that public profile. Do not resize the fixture, change the public marker/constants, or claim the public query's hit is rigid-world CCD acceptance.

The retained original world admission evidence refuses this capsule at validation.ts96 with `INVALID_CONFIG / ccd is supported for dynamic spheres or boxes only and must be true` (original engine evidence summary83/source4822/compiled4785). The later static-box sphere-only check also exists, but it is not this recorded first refusal. Preserve the actual recorded refusal. This issue constructs no PhysicsWorld and steps no world.

Minimum new work is a PRIVATE selected head-on face sweep and a separate fixed-orientation translational response consumer. It uses the original dimensions and existing original math/detector/error helpers. It does not need a general capsule sweep, rotating-capsule law, manifold, angular response or a new public API.

### Immutable first fixture and units

Read `fixtures().find(f => f.id === 'CAPSULE_THIN_CCD').input` from adopted `examples/physics-rigid-engine-reference/fixtures.mjs` without changing it:

- `dt = 1/120 s`, gravity `[0,0,0] m/s^2`.
- Dynamic `b0`: radius `0.1 m`, half length `0.2 m`, centre `[-0.4,0,0] m`, velocity `[100,0,0] m/s`, mass `1 kg`, restitution `0`, friction `{static:1,dynamic:0.7}`, `ccd:true`, identity orientation and zero angular velocity from original defaults.
- Static `floor`: centre `[0,0,0] m`, half extents `[0.001,1,1] m`, identity orientation, restitution `0`, original friction unchanged.

Unconstrained travel is `[5/6,0,0] m`, which crosses the thin obstacle. Nominal analytic clearance is `0.4-0.001-0.1 = 0.299 m`; contact time is **0.00299 s**, full-step fraction **0.3588**, centre at contact **[-0.101,0,0] m**, and remaining time **0.005343333333333333 s**. Use the exact decoded binary input values in the independent oracle; these decimal figures are nominal analytic expectations with the frozen error gates below.

### Private API and admitted profile

Proposed private API: `createRigidCapsuleFaceReference(snapshot)` with `sweep({revision,centerM,velocityMps,stepSeconds})`, copied `getSnapshot()`, and idempotent `dispose()`. A separate `advanceHeadOnFaceStep(initial, sweepResult, stepSeconds)` returns a detached hypothetical centre/velocity/time accounting record. Neither function creates a world or modifies caller data.

Private profile name: `rigid-capsule-linear-face-v1`; one original-size upright capsule and ONE static box. Capsule orientation is fixed identity and angular velocity is zero. Box motion is zero. The selected box face is local axis X; velocity must be stationary, directly approaching, or directly departing along that face normal. The capsule's entire tangential footprint must fit inside the finite face. Radius/half length remain the original literals; no caller overrides.

The canonical case is axis aligned. One explicit derived control may yaw the box by `0.2 rad` about world Y and rotate the initial centre/velocity by the same original rotation, preserving dimensions. Its capsule remains upright; the local Y axis is unchanged. Freeze its literal inputs before trial. This qualifies only that selected face profile, not arbitrary oriented-box edge/corner CCD.

Reject angular motion, moving boxes, nonzero tangent travel, edge/corner approach or footprint outside the selected face as `INVALID_CONFIG` (snapshot/profile) or `INVALID_QUERY` (movement query). Proposed exact messages must be pinned with all sources: `Private capsule face profile is unsupported`, `Private capsule face movement is unsupported`. Do not silently fall back to the public fixed-size query or a different contact feature.

### Sweep, response and error boundaries

The face sweep uses a closed-form supporting-plane gap and head-on closing speed. It must independently verify that its contact lies within the declared finite face. Initial signed capsule/box gap below `-1e-12 m` refuses with original `PhysicsError INITIAL_OVERLAP / Initial capsule overlaps a box`; touching within `1e-12 m` produces fraction0; zero/departing travel with positive gap produces null. Contact beyond the step produces null. No hidden position slop, velocity bias or contact-fraction clamp repairs a failed result.

For a qualified hit, `tHit=dt*toiFraction`, `remaining=dt-tHit`, `centerHit=center0+velocity*tHit`. The declared e=0 HEAD-ON translational response removes closing normal velocity; its tangent component is already zero by admission. Advance the remaining time using the returned velocity. This is a fixed-orientation response contract: original mass/material values remain metadata, and angular/contact-friction dynamics are UNMEASURED. No multiplier is represented as a calibrated force or rigid angular impulse.

Nonfinite calculations, fraction/time outside their admitted interval, or a post-response gap below `-1e-12 m` refuse with `NUMERIC_LIMIT / Private capsule face result is invalid`. Invalid/revision-stale queries and initial-overlap refusals must retain exact snapshot/previous accepted consumer state. Query failure is not a partial state commit. Disposal uses original `PhysicsError DISPOSED`; freeze its exact message. Unknown/unexpected exceptions propagate and are not reclassified as physical refusals.

### Independent oracle and literal gates

Implement an independent stdlib Decimal80/120 oracle from scalar poses and actual radius/half length. Derive segment-to-OBB distance by breakpoints of each local coordinate at the box halfspaces, minimizing the resulting piecewise quadratic on the finite centreline. Do not import the query's 100-pass ternary distance routine or reuse its advancement result. Report witness membership, distances, signed gaps and tie/flat-distance ambiguity without requiring a unique centreline witness.

Freeze these gates before execution:

- Decimal80/120 distance/TOI/time differences `<=1e-25` in the stated units.
- Original fixture analytic contact-time error `<=1e-12 s`, fraction error `<=1e-12`, contact-centre/witness/face-membership error `<=1e-12 m`, normal unit/orientation error `<=1e-12`.
- At contact, signed gap in `[-1e-12,+1e-12] m`; after response, no penetration beyond `1e-12 m`, closing normal speed magnitude `<=1e-12 m/s`, and exact preserved fixed orientation/static box.
- `tHit+remaining` agrees with the input step within `1e-12 s`; no negative remaining time or time beyond the original step.
- One full `1/120 s` step versus two composed `1/240 s` steps: final centre and velocity agree within `1e-12 m` and `1e-12 m/s`; total contact time agrees within `1e-12 s`.
- Source/source-repeat/genuine compiled-original-helper query and private reference outputs, original fixture bits, snapshot copies and typed error/copy/disposal receipts agree. Preserve raw Float64 signed zeros where applicable.

Literal controls: exact original head-on, the selected yaw-derived head-on case, initially touching, initial overlap, contact beyond remaining travel, zero/departing motion, half-step composition, stale revision, input/snapshot mutation, nonfinite/time error, and explicit angular/moving/tangent/edge-corner profile refusals. No parameter sweep or general-purpose CCD claim follows.

### Dependencies, source freeze and actual flow

Original dependencies are already adopted: `capsule-query.ts`, `capsule-query/{types,profile,admission,geometry,sweep,snapshot}.ts`, `capsule-query-error.ts`, original `types.ts`, `math.ts`, `limits.ts`, `validation.ts`, `collision.ts`, `capsule-contact.ts`, `ccd.ts`, package public entry/build rules and the original fixture. Pin exact source/emitted hashes and Node version before actual execution.

Use current public query unchanged in its OWN 0.15/0.35 profile as an API/lifecycle control. It must explicitly refuse the new private profile tag. Its direct axis-wall contact is nominal fraction0.2988, not original-fixture fraction0.3588. Record that distinction. Reuse actual original capsule `detect` for distance/contact sanity at start and contact; do not equate a discrete endpoint check with continuous collision qualification. Retain the already measured original world capsule admission refusal instead of rerunning a world campaign.

One dedicated Physics lane owns ONLY NEW `examples/physics-rigid-capsule-ccd-reference/**`: private profile/admission, selected face sweep, translational response, independent reference, literal controls, entry/bundle/consumer, README and evidence. Suggested files: `profile.ts`, `admission.ts`, `face-sweep.ts`, `response.ts`, `reference.py`, `controls.mjs`, `entry.ts`, `bundle.mjs`, `runner.mjs`, `CONTRACT.md`, source/input freeze JSON and `evidence/**`.

After root creates the Issue/Wiki scope and freezes complete private/reused sources: run original affected Physics build/private strict types, then ONE source/repeat/genuine compiled-original-helper consumer. No PhysicsWorld/candidate construction or step, no contact-lane dependency, no public profile/source changes, no benchmark/refinement campaign beyond the literal two-half-step control, and no browser/Viewer work.

### Disposition

GO means only the selected original-size fixed-orientation face sweep/remaining-time contract passed its analytic, distance, bit/copy/error and graph gates. `fullWorldCCDGO=false`, `rigidAngularResponseMeasured=false`, `contactFrictionMeasured=false`. A public configurable capsule sweep or world CCD admission/response requires a separately frozen interface and actual qualification. Preserve original #1179 capsule refusal and contact NO-GOs. Root owns Issue/Wiki and exact sole adoption; no product push/PR/release/publication.
