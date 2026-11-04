# Common World admission delta for the stationary cube stack

Status: PLAN_ONLY; implementation is forbidden until Root's NEW exact-stationary
original ALIGNED/OFFSET/YAW3×1200 independent physical gate passes. Current
stationary-library run02 has Source/Native51 physical cases per graph (same32,
refusals/repeats and three-scene1/16), not the full-duration/public World exit.
No import, build, test, numerical call or package edit was made for this plan.
Only this new file is written. Existing contracts/pins/first failures/HOLDs stay.

This narrows the older unimplemented
`examples/physics-stack-complete-2276/API-ADOPTION-PLAN.md` to the actual new
stationary solver. Use its shared-owner/recording design, but do not carry its
old QR trajectory hashes forward as a new equality oracle.

## One new option, one existing model/factory

Proposed final capability name: `rigid-stationary-cube-stack-v1`. Freeze that
literal before implementation. It names supported physical input, not a solver
selection knob. Add it to `RigidProfileId` at `src/types.ts:101` and add a
`WorldOptions` arm `{profile:'rigid-stationary-cube-stack-v1',
fixedStepSeconds:number,broadPhase:'direct'}` at105–109. Runtime requires exactly
1/120. No new PhysicsModel version, body/collider type, World class, root factory,
legacy alias, tolerance/iteration switch or fallback is needed. `src/index.ts:1–2`
already exports the types and sole `createPhysicsWorld`.

Keep `rigid-persistent-box-v1`'s4-body cap at model-admission.ts:56 and its8×8
path unchanged. Keep discrete32, large64 and visual/domain/joint/CCD profiles.
The new branch admits exactly9 bodies,8 dynamic+1 static, and zero joints; it
does not raise any existing profile's limit or auto-reroute its models.

## Structural creation gate versus runtime proof

Add a small private `src/stack/stationary-profile.ts` predicate shared by model
and recording admission. Keep generic copy/exact-schema/SI/ID/reference checks
first (`model-admission.ts:38–48,62–96,120–128`). Its new profile checks are:

- Exactly8 dynamic primitive-COM1kg box bodies with half extents[.25,.25,.25],
  inverse mass1 and represented inverse inertia[24,24,24] from the EXISTING
  parser (`validation.ts:120–137`). Exactly1 static floor with half extents
  [2,.1,2], position[0,-.1,0], identity quaternion. No compound/local transform.
- Original gravity[0,-9.81,0], dt1/120, restitution0, static/dynamic friction1/.7,
  direct broad phase, one identity-local collider/body, false sensors/CCD,
  semantic no-filter values category1/mask65535, no joints/motors/cloth/fluid.
- Every dynamic initial linear/angular velocity is exactly numeric zero. Signed
  zeros remain allowed data; preserve their model identity and initial words.
  Dynamic orientation is YAW ONLY: authored x===0 and z===0, and the existing
  unit quaternion gate/normalization remains (`validation.ts:34–42`). No epsilon
  tilt removal, angle extraction or angle limit derived from a scene. Both
  quaternion signs are valid. Floor orientation retains the original identity
  rule. Do not manufacture a replacement normalized input model.
- Dynamic centres remain finite within the existing +/-10000m coordinate bound.
  No b0/floor ID pattern, array reordering, height-stack template, expected
  support load, scene label, COM rectangle lookup or known feasible pose table.
  IDs/collider IDs stay opaque and globally unique. Valid sourceBindings remain
  inert provenance under the existing rules; no live CAD update/watch is enabled.

Convert the three paid scenarios from their ORIGINAL authored input quaternion,
not by relabeling an already normalized runtime body frame as a fresh model.
parseBody normalizes on creation; repeated normalization is not assumed bitwise
idempotent. Require public initial-state words to match the paid initial words.
Do not bypass the parser, inject state or patch golden values to repair a mismatch.

Creation validates this structure; it does not run a speculative step, discover
a solution, snap boxes into contact or guarantee completion for every such
pose. Runtime still requires the actual8-interface connected floor chain,
4 original points/interface,32 total, exactly vertical signed normals and a
bounded nonnegative exact witness. Arbitrary yaw/offset/gap/overlap/edge/rank
inputs can be structurally admitted and then refuse. That is conditional
completion, not general8-box dynamics or a feasibility promise. Current
prepare-step.ts:52–83 enforces the exact material/mass/floor/dt/gravity/zero
BEFORE-motion boundary; the public helper adds explicit yaw-only creation.

Every accepted step must retain zero linear/spin motion from its actual exact
certificate. Do not snap a nonzero residual before the next call. Runtime
NO_WITNESS is a bounded greedy miss, not proof of infeasibility; unsupported
graph/normal and resource refusal never select QR/persistent solving. The old
QR remains a separate private solver, not this profile's fallback.

## Minimum production files and exact integration seam

| File and current line | Required delta after full gate |
|---|---|
| `src/types.ts:101–109` | New profile literal/options arm only; existing model/state/command schemas stay. |
| `src/model-admission.ts:49–60,97–129` | Recognize the literal, require direct/dt, exact9 body/zero joint branch, call new structural predicate after normal parser/reference validation. Preserve all old branches and immutable admitted model. |
| NEW `src/stack/stationary-profile.ts` | Structural checks, empty-command rule and new-profile1200 lifetime constant; no expected scene data or external imports. |
| `src/world.ts:96,106–110,164–208` | Select private capability and1200 limit; after unchanged lifecycle/ownership/budget/copy/parse checks, reject nonempty commands and enter prepareStackStep once BEFORE old integration. |
| NEW `src/stack/public-output.ts`; `src/world.ts:37–57,390–433` | Prepare pair observations/events/public copies/recording BEFORE assignment-only commit. Reuse existing publicState field mapping and collider ownership. |
| `src/world.ts:470–487` | Preserve new-path candidate/prepare-output phase details instead of its current generic NUMERIC_LIMIT=>validation rewrite; do not change old-profile precedence. |
| `src/replay-validation.ts:46–51` | After existing parseCommands, apply the same profile empty-command rule before reconstruction. No replay numerical engine. |
| `src/generate-provider.mjs:19–44`, `build-root.mjs:8–18,48–63` | Regenerate actual source/emitted closure and declarations after freeze; retain canonical shared types/recording-owner/manifest and existing stack.mjs copies. Change build code only for a demonstrated missing import/emit boundary. |

No required numerical edits to stationary-normal/normal-bridge/strict-line/full
pair solver are part of public adoption. Their paid internal proof can be reused
only if actual numerical inputs, execution law and resulting body words agree.
No production import of examples, Python Fraction checker or test core is allowed.

## Commands, public output and one commit

There is NO persistent command queue in the present World. `step(commands=[])`
copies this call's array, parses it, then consumes no caller-owned mutation
(`world.ts:164–181`). Add the empty-command rule immediately after generic
parsing and before candidate/frame allocation. Reject force, impulse, torque,
angularImpulse and kinematicTarget, INCLUDING zero vectors. A malformed command
still follows generic parsing precedence. Refusal never clears, applies later
or silently stores the caller array. Recording prevalidation shares the rule.

Call prepareStackStep exactly once on the accepted bodies/dt/gravity. It owns
unforced integration, strict geometry, exact stationary normal certificate and
full cold position solve. Do not integrate again or fall into the old rigid
contact/warm/sleep/joint/CCD loops after success or failure. Common World alone
keeps stepIndex/time, bodies, contacts/events and recording owner.

Public observations require a frozen NEW output contract, not an assumed
equality to private diagnostics:

1. Bodies keep original order and every position/velocity/orientation/spin word;
   existing publicState maps orientation to orientationXYZW and sleepingfalse.
2. One pair Contact per actual velocity-geometry patch: actual A-to-B normal,
   arithmetic mean of its4 frozen points in retained order, normalImpulseNs
   defined as the retained-order sum of that pair's RNE diagnostic point
   normalNs, zero tangent vector. This Number summary is NOT the exact APPLIED
   rational certificate or a force-resultant application point. Exact ratios
   remain internal evidence; do not silently substitute the rounded row values
   into the physical update. No public ratio/QR/debug schema is needed.
3. penetrationM must be the actual original free-pose SAT observation. Minimal
   paid-result-preserving option: repeat pure detect on the immutable freeBodies
   pair, require a matching hit/pair, copy its finite penetration. This is an
   output observation, not a second solve/strict-line construction. Include its
   cost in public receipts. If carrying the existing detection forward instead,
   freeze that additive private result change and requalify it explicitly.
4. Use existing sorted pair begin/stay/end logic (`world.ts:392–400`). PairStats
   describe the one direct velocity assembly (36 eligible/candidate,0 AABB),
   not the later position scans. Joint/CCD/domain arrays are empty by admission.

Prepare all candidate bookkeeping, publicState, owner.prepareFrames and
owner.prepare while accepted World/log data remain untouched. Then commit
candidate bodies/observations/pair history/clock/recording by nonthrowing
assignments, like world.ts:417–433. No callbacks, encoders or allocations between
physical and log commit. Static words stay copied. Failed geometry/witness/
position/output/log work retains state, clock, contacts/events, history, model
identity, input commands, log bytes/count and continuation behavior. Original
known/unknown error identity policy remains; never convert every thrown value
into a numerical refusal. RESOURCE_LIMIT maps to ITERATION_LIMIT while the
exact stationary status/reason stays available in private failure evidence
(`normal-bridge.ts:138–141`); runtime unsupported/greedy refusal remains
NUMERIC_LIMIT without a false general-INFEASIBLE claim.

The initial new-profile lifetime is1200, matching its required paid duration;
step1201 gives WORLD_LIMIT before reading commands. Keep shared MAX_STEPS3600
for existing profiles (`limits.ts:5`). Do not infer longer support from it.

## Recorder, identity and genuine root qualification

Reuse the exclusive RecordingOwner/WeakMap bridge (`world.ts:499–521`), current
recorder (`replay.ts:27–64`) and root-created restore (`replay.ts:67–85`). Attach
at0, direct World step while attached=>WORLD_OWNED, one permanent detach,
idempotent disposal. There is no setState/checkpoint or second advancing owner.

Caps remain512 frames,4096 commands,128KiB model and1MiB complete binary
BCPHREC1 recording. Record a bounded prefix, save/decode/restore/continue in
the same profile, then detach if testing unrecorded continuation past512.
Frame513/earlier byte-cap refusal preserves physical/log state. Do NOT raise
recording limits or silently truncate history to show a1200 recorded sample.
No same-provider identity exception: source and emitted provider digests differ;
old-provider recording remains STALE_SNAPSHOT. Revision/sourceBinding/units/
frame/options/model identity stays exact. Model raw quaternion/signed-zero
identity remains distinct from normalized runtime state. Existing1e-12 replay
comparison is unchanged; new same-provider word assertions are an additional
adoption test, not a replay tolerance change.

Freeze these bounded tests before production edits:

- Admission: original three models, opaque reordered IDs/colliders, yaw/q-sign,
  signed zeros; wrong counts/mass/extents/inertia/floor/material/g/dt/filter/
  sensor/CCD/joints/domains, even tiny nonzero x/z quaternion tilt, nonzero
  initial motion, malformed getters/symbols/units/references. Include structurally
  valid but unsupported geometry that refuses on first step with retained state.
- Commands/transaction: every command kind and zero vector, invalid target/data,
  lifecycle/owner/budget precedence; explicit refused-call then valid continuation
  comparison. Test-only provider-copy faults at frame preflight, after candidate,
  before output, log encoding and before commit; unchanged state AND log AND
  continued behavior. Accepted-state overlap/raycast/read queries retain opaque
  collider ownership and do not step the clock. No shipping fault hook or
  expected-frame injection.
- Mapping: literal pair/point/impulse sums, A/B/collider ownership, mean/order,
  free SAT penetration versus corrected pose, signed zero, pair events and stats.
  Exact internal witness remains distinct from rounded public contact summary.
- Root/replay: source entry and genuine built dist root/replay/declarations,
  one PhysicsError and shared recorder WeakMap, binary round-trip/restore,
  stale/corrupt/nonempty-command recording rejection before numerical replay,
  <=512 limits and continued Source/Native public word equality. Reuse current
  P2 provider-copy fault pattern rather than stale removed replay APIs.
- Duration: after the internal full gate, actual PUBLIC World original3×1200
  body words must match the NEW paid stationary provider's frames, with no
  numerical test hook. Contacts/events/identity need their separate new mapping
  assertions. Old QR body/impulse hashes are historical. Focused old cap4/refuse5,
  discrete32/large64 and affected shared transaction/profile controls stay.

## Actual desktop route after public gates

Use a NEW `examples/physics-stack-world-2276/scene/` sample and localhost server;
do not alter the existing impact/lab scene or open tabs. Reuse the direct
common-World/recorder model-input pattern in
`physics-persistent-impact-2276/scene/scenario.mjs:1–22`, owned package resolver/
server at server.mjs:7–22, and Viewer display/motion boundary at
display.mjs:48–66. New scene imports ONLY package root/replay/Viewer and inert
public model data, never prepareStackStep or an archived trajectory. Bind to
127.0.0.1 with a fresh available port and record the actual URL/source closure.

Present original ALIGNED/OFFSET/YAW as explicit sample inputs through the new
public profile. Start paused; reset creates a new World. Unrecorded stepping
can reach1200; a separate visible recording mode stops at512/byte limit and
uses verified restore. Display ONLY accepted body poses, convert m->mm once,
copy XYZW, keep caller-owned animation timing and camera independent of step.
No explanation overlay or new solver controls. Desktop checks bind actual
accepted state/time/step, GPU pixels, pause/step/reset, refusal retention,
record/save/restore/continue and Source/genuine Native provenance; screenshots
alone are not physical proof. No mobile test, Studio/CAD integration, equipment,
manufacturing activation, deployment or HOLD resumption is included.
