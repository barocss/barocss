# Common World adoption after the original full-stack gate

Status: READ_ONLY_SOURCE_PLAN. No package edit, import, compiler, test, helper,
solver or World call was made for this plan. Execution requires the preceding
complete contract's actual original-independent3×1200 PASS and an explicit
source freeze for this new API slice. A runtime-only1200 or hard16 prefix is
insufficient. Public admission is currently unchanged.

## Decision and present source boundary

Add one explicitly named **physical support profile** to the existing
`createPhysicsWorld(model, options)`. Working name:
`rigid-supported-cube-stack-v1`. Freeze its final name once, before source/tests.
It means unforced supported unit cubes with certified stationary loaded-contact
feasibility, not a user-selected solver, friction mode or arbitrary mechanism.
No iteration/QR/tolerance/seed/algorithm options are exposed.

Use an explicit profile rather than silently rerouting existing models. P0
already assigns admission and fixed numerical policy to support profiles
(`design/p0/CONTRACT.md:17–35,73–88`); `src/types.ts:101–109` and
`src/model-admission.ts:49–60` implement that choice. Auto-selecting this path
inside `rigid-discrete-v1` would change an existing model's behavior and identity
without a declared capability transition. Raising persistent-box's4-body cap
would also admit combinations this proof did not cover. Keep both unchanged.

The following current source is the implementation starting point, not a stale
P0 proposal:

| Files/lines under `packages/barocss-physics/` | Existing ownership or required boundary |
|---|---|
| `src/world.ts:91–162` | Sole World identity, body/joint/domain owners, clock, active pairs, cache and recorder ownership. No public `world-types.ts` exists; the public contract is `src/types.ts`. |
| `src/world.ts:164–209,417–433,470–523` | Lifecycle/budgets/command parsing, complete public-output and recording preparation, assignment-only shared commit, reentrancy guard and exclusive recorder bridge. Reuse these mechanisms. |
| `src/model-admission.ts:33–129`; `src/validation.ts:78–138` | Immutable SI model copy and primitive-body construction. The new capability must enter here; kernel admission alone is not public admission. |
| `src/stack/prepare-step.ts:49–156` | Pure unforced candidate, actual strict geometry/normal/full position phases and reached failure diagnostics. Owns no accepted World state, clock, command queue or recorder. |
| `src/stack/world-types.ts:53–108`; `src/stack/normal-bridge.ts:7–12,87–106` | Internal position/point ledger data. They remain private phase evidence; do not export them as a second public World/state schema. |
| `src/replay.ts:27–85`; `src/recording-owner.ts` | Attached recorder delegates the same World step, prepares bounded next log, and restores by creating the root World and replaying commands. There is no separate numerical replay engine. |
| `src/replay-validation.ts:32–90`; `src/replay-compare.ts` | Recording shape/model/profile admission and512/4096 limits; existing finite1e-12 comparison is replay reconstruction policy, not strict bitwise phase proof. |
| `src/index.ts`; `src/generate-provider.mjs:19–44`; `build-root.mjs:8–46` | Root exports the sole factory and canonical types. Manifest walks actual dependencies. Bundled root shares canonical `types`, `recording-owner`, `provider-manifest.generated` siblings with replay; preserve constructor/WeakMap identity. |

## Exact new capability admission

Introduce package-private `src/stack/model-profile.ts` for the new model and
command predicates. Call it only for the new explicit profile. Keep the generic
copy/schema/reference/unit/ID checks ahead of dependent profile reads. A proposed
minimal first profile is:

- Exactly8 dynamic1kg primitive-COM cubes, half extents[.25,.25,.25], plus exactly
  one static floor half extents[2,.1,2], pose[0,-.1,0]/identity quaternion. Derive
  inertia through the existing primitive parser; require represented inverse
  inertia24I and inverse mass1 before selecting the kernel.
- Fixed dt1/120, gravity[0,-9.81,0], restitution0, friction1/.7, direct broad
  phase, one identity-local collider/body, no filters beyond semantic defaults,
  no sensors, CCD, kinematic bodies, joints, motors, cloth or fluid. No forces,
  impulses, torques, angular impulses or target commands, including zero-vector
  commands. `step([])` and omitted commands are the only advancing input.
- Original models start with zero dynamic linear/angular velocity. Retain the
  current finite pose, quaternion and geometry admission, then the kernel's
  per-step bounded geometry/work/normal/tangent/position refusal gates. Do not
  replace poses with ALIGNED/OFFSET/YAW templates. Model/collider IDs stay opaque
  under P0's existing ASCII/length/uniqueness rule, and array order is retained.
  No `b0`, floor-name, scene label, support-chain index or equilibrium seed check.
- First public lifetime is at most1200 host steps, matching the paid original
  duration. Keep global `MAX_STEPS=3600` for existing profiles; select a separate
  narrower new-profile limit. Step1201 refuses WORLD_LIMIT before command reads.
  A longer lifetime needs its own extension gate, not implicit use of3600.

These are physical and software bounds, not evidence that all finite initial
poses complete. The certified full trajectory population remains the original
three scenes. Other admitted-shaped inputs may refuse when the bounded method
cannot certify a step; unsupported loaded slip never triggers another solver.
Creation must document this conditional completion boundary. Do not claim
general friction, restitution impacts, moving platforms, mechanisms, G1
anisotropic rotation, forced stacks or cross-domain coupling from this profile.

In `types.ts`, add the profile literal to `RigidProfileId` and an exact
`WorldOptions` branch with `broadPhase:'direct'`. `index.ts` needs no new factory
or numerical export. In `model-admission.ts`, add profile recognition and an
exact9-body/zero-joint branch, returning a private capability discriminator.
Do not change the old4/32/64-body branches, shared SOLVER_PASSES8, manifold8,
normal QR64, work/bit ceilings, materials or generic command budgets. No public
admission occurs until this implementation and its root API gates pass.

## One World step and public output

In `world.ts`, branch after active/ownership/budget checks and complete generic
command parsing, then enforce the empty-command profile rule before any candidate
or recorder-frame allocation. The restriction is shared with recording admission
so a stored unsupported command fails before reconstruction. Keep existing error
precedence for old profiles. There is no persistent command queue today: the
caller supplies a copied per-call array. A refusal retains the caller data and
does not enqueue, clear or silently apply those commands on a later call.

For the new profile, call `prepareStackStep(bodies,dt,gravity)` once, before the
old integration/contact region. Never integrate in common World and then call
the kernel: the kernel already integrates. Never fall through to old8×8 contact
solving, warm starting, sleep, joint projection, CCD or position correction on
success or refusal. This is an explicitly admitted phase path inside the SAME
World, not a second public World/clock and not a fallback engine. Existing
profiles retain their current algorithms.

Prepare the successful next public observations in a pure private helper such
as `src/stack/public-output.ts`, without changing the paid numerical phase law:

1. Keep kernel candidateBodies in original body order. Copy to current public
   `BodyState` via the existing orientation→orientationXYZW mapping and
   sleepingfalse; preserve every finite binary64 word. Model identity is copied
   authored SI data, not a normalized replacement model.
2. Produce one public pair contact per actual frozen velocity geometry patch,
   in the existing body-ID pair order. Its A→B normal is the actual patch normal;
   point is the arithmetic mean of actual frozen patch points in their retained
   order; normal impulse is the sum of corresponding actual final point-ledger
   impulses in that same order; tangential impulse is the actual zero vector.
   This pair summary does not reproduce each point's torque and is not the
   all-point phase certificate. Do not claim it is a resultant force application
   point or calibrated mechanical load.
3. Public `penetrationM` must keep a named actual measurement. Minimal path
   without changing the paid prepare result: read-only `detect` on each patch's
   corresponding **freeBodies** pair using the same original detector and copy
   its SAT penetration. Assert the pair/hit identity and finite bounds. Do not
   measure after position correction, substitute a witness depth silently, or
   publish a fabricated zero. This output-only duplicate observation must not
   mutate bodies or run strict-line construction/solve again. Alternatively,
   carrying the already computed SAT/mean metadata through an additive private
   return is possible, but it changes the provider/result boundary and requires
   its own explicit requalification; do not sneak it into the paid old result.
4. Derive pair events from current and prior actual contact-pair membership using
   the existing sorted begin/stay/end logic. No sensors/joints/CCD/domain outputs
   are invented; their arrays are empty by admission. Report direct assembly
   pairStats from the actual complete pair population (36 eligible/candidate,
   no AABB tests), defining this new profile's **single assembly** accounting;
   do not label final position scans as extra velocity assemblies.
5. Build all next public copies/events/accepted bookkeeping, and call the existing
   `owner.prepareFrames/owner.prepare` within their original bounds before
   commit. Publish state, contacts, events, active pair history, clock and prepared
   recording with nonthrowing assignments together. No callback, log append,
   encoder, getter or allocation may throw between physical and recording commit.

The contact mapping is NEW public-output behavior and needs fixed independent
mapping tests; old phase receipts do not qualify it. The proposed duplicate
detector observation must be included in root API wall/CPU receipts. If its
semantics or cost is unsuitable, settle an additive private-output contract
before implementation rather than removing contacts or reusing expected data.

Map known StackStepFailure/phase refusals into the SAME canonical PhysicsError
family with copied operation/phase/domain/IDs/accepted cursor. Preserve code and
refusal meaning: unsupported model INVALID_CONFIG, any stack command
INVALID_COMMAND, lifecycle/budget codes unchanged, bounded candidate failure
NUMERIC_LIMIT or existing ITERATION_LIMIT. Do not introduce a second public
error constructor or return candidate bodies on failure. Root's existing
`guarded` enrichment currently coarsens NUMERIC_LIMIT to validation
(`world.ts:478–486`); preserve explicit new-path candidate/validation/
prepare-output details in the narrow new branch while keeping old precedence.
Unexpected thrown values retain identity; do not catch-all into NUMERIC_LIMIT.
Internal reached diagnostics can remain private error data and immutable
evidence; they are not public committed state or a required shipped test hook.

## Recorder, restore and duration boundary

Reuse `recordingWorlds`, `RecordingOwner`, `createPhysicsRecorder`, and root-based
restore. `owner.prepareFrames` constructs only an unaccepted candidate log;
the accepted log is appended by the shared World commit only after successful
physical/output validation. A failure at frame preflight, candidate, public
copy, encoding or before commit retains state/time/events/model identity/log
bytes/frame count/command count and continuation behavior. Recorder-exclusive
WORLD_OWNED, attach-at-step0, permanent detach and disposal rules remain.

**Do not raise recording limits to record1200.** Existing caps are512 frames,
4096 total commands,128KiB encoded model,1MiB recording
(`design/p0/CONTRACT.md:244–270`; `replay-validation.ts:36–58`). Public unrecorded
World may run1200. Recording qualification uses a bounded prefix within all
caps; restore reexecutes it through the same new profile, verifies final state,
then continues in the same World owner. To check continuation beyond512, detach
the recorder and continue the restored World; do not reattach midstream or
invent a checkpoint/setState escape. At frame513 or earlier actual byte cap,
typed refusal is a recording capability boundary, not a physical failure.

Add the new profile/empty-command checks to recording validation through the
shared predicate. Keep the binary BCPHREC1 codec/schema1, raw finite number bits
and no migration. Restore still checks exact model/options/provider/source
identity before isolated replay and disposes the candidate on any failure.
Source and emitted provider digests identify different graphs; do not bypass
STALE_SNAPSHOT to move an old provider's recording into a new build. Reuse
original1e-12 finite replay comparison as its contract, and add stricter
same-provider word equality as this adoption test's independent assertion.
Do not change replay tolerance to mask a new branch discrepancy.

## Minimal verification and release boundary

Reuse qualified internal complete-path phase proof when kernel mathematics and
inputs are unchanged. Verify the new public boundary with these bounded gates,
then the explicitly frozen original public1200 population. No production test
hook is required: public outputs and immutable paid evidence are enough for
body-frame equality; the paid internal diagnostics carry separate phase proof.

| Gate | Concrete assertions |
|---|---|
| Admission/identity | Original three models convert to public SI schema without body renaming/reordering. Primitive inertia and normalized initial quaternion words equal paid internal initial frames. Distinct collider IDs resolve correctly. Global entity IDs/units/frame/revision/unknown fields/getters/symbols/sparse/custom prototypes and all unsupported combinations refuse. Wrong mass/shape/material/floor/dt/gravity/joint/CCD/sensor/filter/domain or initial motion never widens admission. No scene name or expected pose is read by engine. |
| Commands/lifecycle | All five nonempty command kinds, including zero vectors, unknown target, duplicate and combined-invalid cases; no command retained/applied later. DISPOSED/REENTRANT/WORLD_OWNED/budget precedence, step1201 refusal, readonly queries/state/model copies, idempotent disposal. A refused attempt followed by valid[] continuation matches an untouched control, beyond a snapshot-only check. |
| Public mapping | Literal small synthetic FrozenStackPatch/PointLedger bank: A/B signs, pair sorting, point order, impulse sum, mean, SAT-vs-witness depth distinction, signed zeros, collider ownership, begin/stay/end. Verify against independent analytic sums/known vector words, not helper calling itself. No extra integration or solving; all-point torque proof is separate. |
| Transaction faults | Reuse P2's **test-only provider-copy** fault pattern, not shipping hooks: frame preflight, after candidate, before public copy, log encoding, before shared commit. Include unknown Error/object/null identity. Check state and recording bytes unchanged, ownership released correctly where applicable, and next bounded continuation equal control. Exercise new branch; do not rerun unrelated passed profiles without a changed dependency. |
| Recording | Attach0/exclusive owner/direct-step refusal; binary save/decode/restore with signed-zero model/state, modified final state rejection, stale provider/model/options/revision, truncated/trailing wire; source and actual Native bounded record–restore–continue. At/beyond512/4096/byte limits retain state/log; invalid restored commands are rejected before running physics. No1200-recording claim. |
| Whole Source public API | Actual source root and `/replay`, genuine current schema, fresh new-profile admission/command/failure/public output tests. Compare original full public1200 body words frame-by-frame to paid internal same-scene evidence; public identity/contact/event fields have their own asserted mapping and cannot equal a private diagnostics DTO by accident. Record differences in observation schema explicitly; no phase exclusions from old proof. |
| Genuine Native root API | Build actual canonical root/replay/declarations once after source freeze; audit provider closure and imports including all stack .mjs/.d.mts; import the actual dist root and replay entries (not an emitted private candidate or source alias). Prove one PhysicsError and one recording WeakMap across bundled root/replay. Run same bounded API/recording checks and frozen original public1200 body-frame parity; compare Source/Native public field/word results with graph-specific identity sidecars separate. |
| Existing profiles | Focused old persistent cap4/refused5, discrete32, large64, domain/joint/CCD dispatch and8×8 behavior controls relevant to changed admission/branch/shared commit. Preserve P3/P5 specializations and old failures. Historical P1b tests import removed replay APIs; use current P2/current-root tests, not stale suite execution as a release gate. |

The public1200 runner uses only `createPhysicsWorld`, `getModel/getState`,
`step([])`, queries and dispose. It loads paid expected body frames in the harness
and compares exact public position/velocity/orientation/spin words, with the
orientation field-name mapping explicit. It does not inject phase observers,
expected impulses or state into the product. This verifies adoption determinism
and output ownership, while the preceding internal complete proof establishes
strict phases at those identical numerical inputs. An unexpected new numerical
path/word difference stops that argument and needs an independently reviewed
phase comparison; do not claim old diagnostics prove a changed solver.

Implementation files are limited to current `types.ts`, `model-admission.ts`,
`world.ts`, the two new private profile/output helpers, necessary replay
validation import, current provider generation/build closure if actually needed,
new scoped adoption tests/receipts and current `README.md`/`ROADMAP.md` capability
rows. Leave frozen P0 contract/catalogue and all old receipts unchanged; add a
current support-profile addendum rather than editing their historical status.
No root API overload, alias, separate World class, legacy dispatch fallback,
standalone public stack factory or example runtime import is added. Recorder
and query code changes are only those required by this exact profile.

Docs may mark this profile adopted only after actual Source/genuine Native/root
API/recording/restore/continuation gates pass. Keep original physical3600 proof,
public World1200 equality, recorder<=512 capability, Source/Native provenance,
optional strict64/RSS certification and desktop integration as separate results.
CAD/Studio/manufacturing/equipment HOLDs stay read-only. No screen change,
mobile test, deployment, hardware control, release or HOLD resumption follows
from this plan or the internal full-stack PASS.
