# G1c common World phase audit

Status: AUTHOR_READY / SOURCE_ONLY / READY_STOP.

Inspected checkout: `codex/physics-world-p5-2276`, HEAD
`a30dba781cd9e0c987e08b6b87d8d9b79389cdfd`.
Only this document is owned by this helper. No modules were evaluated. No
constructor, World step, numerical reference, build or test was run.
All proposed execution below is NOT_RUN. No public adoption is claimed.

## Current admission and frame

All paths below are relative to `packages/barocss-physics/src/` unless stated.

| Boundary | Source | Current fact |
|---|---|---|
| Model and frame | `model-admission.ts:38-47` | Copy model/options before reads; require right-handed xyz, local-to-world XYZW, m/kg/s/rad. |
| Rigid profile | `model-admission.ts:52-60` | Three rigid profiles; dt in [1/240,1/30]. Discrete/persistent permit direct or aabb; large requires aabb and has no joints. |
| Dynamic inertia | `model-admission.ts:70-78`, `validation.ts:111-136` | COM/body-local primitive inertia; scalar override only for spheres. Box moments derive from mass and half extents. Capsule moments are an isotropic proxy. Arbitrary local inertia tensors are not admitted. |
| Collider | `model-admission.ts:83-96` | Exactly one collider per body, identity-local transform. Dynamic sensors and non-dynamic CCD refuse. Non-large filter values are fixed. |
| Quaternion | `model-admission.ts:26-31,102`, `validation.ts:34-42` | Norm residual up to 1e-6 is admitted, then numeric Body q is normalized. Raw model q remains model data. A near-unit refusal is NOT the current behavior. |
| World angular vectors | `math.ts:17,36-42`, `world.ts:212-214` | q maps local to world. Rotation increments multiply q on the left. Tensor application rotates a world vector into local inertia and back. Initial/public omega, torque and angular impulse use this world frame. |
| Commands | `validation.ts:164-199` | Dense bounded commands, dynamic target for torque/impulse, one command of each kind per body. Torque and angular impulse may coexist. They expire after that step. |

The current model accepts unequal-moment boxes with general admitted q and
world omega. This range is much larger than the G1a/G1b literal plants. Their
private PASS receipts do not qualify that admission range.

## Actual common phase order

| Order | Source | Ownership and observation |
|---|---|---|
| 1 | `world.ts:160-204` | Lifecycle, recorder and budget checks; copy/parse commands; domain and special hinge/CCD admission; prepare recorder frames. |
| 2 | `world.ts:205-208` | Copy accepted bodies and sleep counters to candidate storage; wake large-profile bodies for actions. |
| 3 | `world.ts:209-215` | Each awake dynamic receives exactly one `I(q)^-1 (J + dt*tau)` angular kick. q is still the accepted pre-free orientation. |
| 4 | `world.ts:216-224`, `joint-motor.ts:4-35` | Motor changes candidate omega once, using accepted previous joint angle and current candidate omega. Preserve cap and equal/opposite pair semantics. |
| 5 | `world.ts:225-251` | Awake dynamic angular movement guard, then free orientation, then linear commands/gravity/position. Current free stage is `advanceOrientation(q,omega,dt)` at line 243; omega stays constant in this stage. |
| 6 | `world.ts:254-342` | CCD, bounds and contact passes. Geometry reads q. Point velocity reads omega. Normal/friction impulses change omega; persistent warm starts clone and update candidate cache. |
| 7 | `world.ts:343-355` | Joint projections occur in each solver pass. Disjoint profile instead has its postcontact stage and contact refusal. |
| 8 | `world.ts:356-381` | Sleeping/events, final body/contact checks, box CCD alignment, joint finite checks and motor reaction caps. |
| 9 | `world.ts:382-397` | Public state and recorder allocation complete before assignments. Commit bodies, contacts, events, joints, CCD, pairs, persistent points, sleep counters and cursor together. |

The candidate free-flow hook belongs at order 5. Derive any temporary momentum
from candidate q/omega AFTER kicks and motor. Return q and world omega together.
Do not retain an initial momentum authority or restore pre-contact momentum at
orders 6-9. Internal negative composition stages must not repeat/reverse a
command, motor, contact, projection, public clock or recorder frame.

Do not change `advanceOrientation` into a body-aware integrator. Its other
callers are geometric corrections with dt=1: `dynamic-hinge-joint.ts:71-72`,
`dynamic-anchor-pair.ts:35`, `disjoint-hinge/pose.ts:18-19`.

Downstream dependencies are concrete:

- `collision.ts:179-191,204-224`: point velocities, effective inertia, normal
  and friction angular kicks. `persistent-box-contact.ts:10-19` has the same
  q/omega dependency for warm starts and point solves.
- `joints.ts:83-118`: fixed projection zeroes omega; hinge projection retains
  axis speed and can zero it at a limit. Projection replaces q and reports
  `I(q_corrected)*(omega_after-omega_before)`. This report is the existing
  algorithmic reaction, not an independent anisotropic momentum-balance proof.
- `joints.ts:37-39`: general dynamic/dynamic pair joints are sphere-only.
  A static/kinematic A can have a dynamic box B; that path needs qualification.
- `world.ts:238,357`: sleeping skips free motion; later sleeping may zero omega.
  Free-flow temporary values must not survive those decisions.
- `world.ts:203,369-370`: rotating-box CCD remains excluded by current command
  and axis-alignment checks. G1 does not qualify general rotating CCD.

Existing pre-free bounds are finite omega components <=1000 and
`norm(omega)*dt <=10` (`world.ts:239-241`). Final body checks require finite
component-bounded omega and q norm residual <=1e-12
(`collision.ts:227-234`). The final validator does not repeat the dt-scaled
angular bound. A recomputed free-flow omega therefore needs the selected safety
checks before downstream consumers; do not tighten public admission silently.

## Recorder and checkpoint ownership

`world.ts:38-49` copies q/omega and downstream reports to public output.
`world.ts:465-485` permits recorder attach only at step zero and enforces one
exclusive owner, including cached public step calls. The accepted recording is
changed only at the shared commit.

`replay.ts:34-52` records the model/options, command frames and final public
state. `replay.ts:67-85` restores by creating a new World and replaying every
frame, then comparing final state. This is the current checkpoint mechanism;
there is no direct numerical state restore setter in this inspected API.
`serializeRecording` and `deserializeRecording` also reconstruct temporary
Worlds (`replay.ts:89-97`). Count their constructors and replay steps if selected.

`replay-compare.ts:1-5` uses relative numeric tolerance 1e-12. Replay agreement
does not establish physical truth, raw-sign equality or independent accuracy.
Candidate q/omega needs no new accepted momentum cache or recording field.
Provider changes need the real regenerated provider identity. Preserve stale
provider refusal; do not rewrite historical recording identity.

## Small finite integration gate proposal

Freeze exact recipes, oracle outputs, tolerances, source/native graph pins and
the total constructor/step/fault ledger before execution. These are proposed
test leaves, not authority to run a broad existing campaign.

| Leaf | Minimal finite observation | Independent acceptance target |
|---|---|---|
| Kick/free/expiry | One no-contact triaxial box, dt=1/120, q identity, half extents [.1,.2,.3], mass 1, omega [1,1,1]. Step 1 applies world J=[.001,0,0] AND tau=[0,.12,0]; step 2 has no command. | Independently compute local box moments. At each kick `L+ = L- + J + dt*tau`; free flow preserves this world L within the frozen tolerance. Compare final q/omega to a separately generated high-precision piecewise kick/free reference. On step 2 there is no second kick. A terminal omega increment alone is insufficient because anisotropic free omega changes. |
| Frame | Repeat the same two-step physical plant under one frozen exact proper axis permutation and transformed q/omega/J/tau. Add one nonidentity q case. | Transform final physical q/omega/L back and compare to the original/reference. This exposes local/world swap and left/right product mistakes; do not use implementation tensor helpers as the oracle. |
| Motor then projection | One admitted static-A/dynamic-box hinge, COM anchors, principal world axis, broad limits; one capped motor step and one next step. | Use scalar principal inertia to compute the cap and angle before the limit. Verify one motor impulse, one dt of pose, existing projection/reaction report, and no repeated motor kick inside free substeps. A separate fixed-joint step must keep projected q and zero omega after free flow. |
| Contact then next free | One rectangular box/static sphere offset frictionless contact, no joint/CCD. Freeze geometry with an independent contact oracle. Continue one separated free step if the frozen recipe yields separation. | Verify nonzero angular response from the contact arm and reported impulse. Use the emitted terminal q/omega as the next free initial condition in the independent reference. Do not reapply precontact L. If separation is not established in authoring, select a new frozen recipe rather than skipping its contact. |
| Record/restore/continue | Attach at zero to the two-step kick plant. Save after step 1; restore that recording; run empty step 2 on original and restored recorders. | Both end states and independently checked physical values agree. Frames/cursor advance once per public step. Verify current identity, copied output isolation and cached direct-step WORLD_OWNED refusal. One restore of one frame adds one constructor and one replay step. Avoid serialize/deserialize here unless separately counted. |
| Natural rejection | Two separated boxes, first benign, second with finite admitted input causing angular movement refusal; recorder attached at zero. | Failure is canonical NUMERIC_LIMIT with accepted cursor unchanged. Body/state/model and saved recording remain unchanged. Next valid step matches a never-failed control. This exposes a later-body failure after earlier candidate preparation. |
| Controlled precommit fault | Separate test-only source overlays: throw after candidate free q/omega preparation; then throw during final recorder preparation. One attempt per site, then one valid continuation with controls. | Preserve throw identity for unknown errors and all accepted state/recording/caches/cursor. Continuation agrees with control. Fault injection is validator evidence, not a natural physical failure or native production PASS. |

A two-box failure leaf must use a command/movement recipe that admission accepts
and the current numeric guard rejects; freeze the exact failure point. Do not
claim a post-free guard is exercised by a pre-free rejection. If a new free
solver adds convergence failure or temporary allocations, separately freeze one
finite failure control at that new boundary. No loops that search for failures.

## Profile prerequisites before public adoption

1. Resolve the actual admitted anisotropic range, including mass/extents,
   near-equal moments, normalized q, zero/nonzero spin and dt endpoints. Exact
   z-axis symmetry or the one triaxial .1s plant does not prove x/y symmetry or
   general admission. Require a separately frozen physical accuracy/range gate.
2. Qualify the common stage first on the selected discrete direct graph. Claim
   persistent-box or large only after their affected bounds, warm-start,
   sleep/wake/filter and continuation leaves pass. A common callsite alone is
   source evidence, not runtime profile qualification. Large has no joints;
   dynamic-pair and disjoint-hinge contracts remain sphere compatibility cases.
3. Preserve exact isotropic sphere/cube/capsule-proxy arithmetic and previously
   qualified receipts. Reuse valid receipts; select only affected new checks.
   Do not require old incorrect anisotropic trajectories to remain identical.
4. Run the frozen new leaves on staged source and genuine current emitted/root
   providers, each with actual graph/identity labels. Strict NodeNext compile
   PASS and source numerical PASS remain separate from root/native adoption.
5. Preserve old first failures, tolerances and raw artifacts. New failure means
   stop that frozen gate and record its first fail. Do not relax tolerances or
   replace fixtures after observing results under the same evidence identity.

Existing caller evidence is narrower: the foundation sphere spin
(`examples/physics-motion-foundations-2276/world.test.ts:53-57`) and sphere
torque expiry (`examples/physics-scene/rotation-probe.mjs:29-32`) do not qualify
anisotropic free flow. Existing P2 recorder tests use actual constructor/replay
work; do not run/import them merely to inspect counts. Preserve old P3/P4
isotropic/contact evidence without relabelling it as G1c integration proof.

Studio, manufacturing and equipment remain HOLD. General contact accuracy,
connected anisotropic mechanisms, G2 rotating CCD, G4 conditioning, public API
range adoption and product acceptance remain separate gates. No deployment,
legacy engine, fallback engine, release or broad test run is selected here.

READY_STOP: document authoring complete; all new runtime gates NOT_RUN.
