# #1298 proposed source difference ledger

Status: SOURCE-ONLY DESIGN. No candidate source, world, build or trial is created by this ledger. Implementation waits for exact #1280 adoption and the selected new base. Root must freeze this ledger, private interfaces, precedence, inputs, errors and diagnostic conventions before code.

## Immutable sources and start boundary

- Original engine source base: `6bd3376d6943a8d84b83ca62b0031a9ec8927bea`.
- Qualified #1280 native: `43ea7abcb83475b3beee1ceafbb40e45c94c2551`.
- Qualified #1280 native manifest: `aa80b2a2c3dee24f9af44d6c9ac6baf364786f09a98914a4cb6c03098d1b6302`.
- Native paths: `examples/physics-rigid-capsule-ccd-reference/**`. They are private adopted implementation/data dependencies, not a public capsule API.
- Future ownership: ONLY NEW `examples/physics-rigid-capsule-face-world-reference/**`.
- Root must check the native ancestor and exact owned path modes/blobs at the selected Integration base. A CLOSED Issue or an available worktree does not establish adoption.
- Preserve original package files, fixture values, root/lock files, inherited dirty work, Viewer and Integration.

Read and pin the exact adopted versions before copying. All original package helper imports use the existing source or genuine emitted helpers under the existing build rules. The new candidate parser/CCD/world remain owned source in all three graphs.

## Exact copy and change boundary

| Original function or block | Owned destination | Proposed difference | Preserved behavior |
| --- | --- | --- | --- |
| `validation.ts::parseBody` | `candidate-validation.ts::parseCandidateBody` | Copy this function. Change only its `ccd` shape predicate to admit a dynamic capsule with `ccd:true` inside the private parser. Final world profile admission remains mandatory. | Original record/fields/id/kind/shape/pose/mass/material/quaternion/angular/inertia parsing, error ordering, defaults, copied data and `ccd:true` output. |
| Validation helpers used by `parseBody` | Existing original imports | Import original `record`, `fields`, `shape`, `vector`, `finite`, `friction`, `quaternion`, `angularVector`, `collisionFilter`, `error` as their exported visibility permits. If a required helper is private, copy the minimum dependency text with a separate hash/difference entry. | No new parser library, no deletion of `ccd`, no sphere substitution, no caller mutation. |
| `ccd.ts::CcdProfile` and `admitCcd` | `candidate-ccd.ts` | Add a private `capsule-face` discriminant with capsule/fixture indices and a detached qualified face snapshot. Select only after private world profile admission. | Original public variants are unchanged. Unsupported capsules never fall through to sphere or box CCD. |
| `ccd.ts::sweepSphere` | Existing original import, if still referenced by copied unreachable branches | No change. The new capsule branch never calls it. | Its existing `1e-9 m` sphere offset remains isolated from the capsule law. |
| #1280 face reference factory / `sweepFace` / `advanceHeadOnFaceStep` | Adopted private imports through an owned bridge | Reuse exact selected negative-X law and response. Supply the accepted start centre and the already staged velocity. | Original `.1/.2` dimensions, upright orientation, head-on admission, face witnesses, overlap threshold, zero restitution response and remaining-time arithmetic. No slop, bias or fraction repair. |
| `world.ts::publicState` | Copied `candidate-world.ts` | No change except path imports. | All existing body/CCD/contact/event/joint/counter fields are copied. Time remains `stepIndex * dt`. |
| `world.ts::createPhysicsWorld` structural constructor parsing | Copied `createCapsuleFaceCandidateWorld` | Substitute the private body parser and add the exact private scene admission boundary before CCD selection. | Original structural/type errors and original Body/default metadata. |
| `world.ts::step`, command boundary | Copied candidate step | After original active/dt/cursor guards, admit only an ordinary empty command array. Then run original `parseCommands` on that array. | Original default `commands=[]`, active/dt/cursor ordering and empty action map. All nonempty/malformed inputs use the frozen private command error. |
| `world.ts::step`, free integration | Copied candidate step | No algorithm change. Preserve the original staged copied-body integration and movement checks. | No world clock/body commit before CCD, contacts and final validation. |
| `world.ts::step`, CCD dispatch | Copied candidate step | Add one `capsule-face` branch at the original CCD location, before the ordinary contact passes. Overwrite only the dynamic working centre/linear velocity with the detached qualified full-step response. | No second advancement from the unconstrained endpoint. No orientation, angular velocity, fixture or material overwrite. |
| `world.ts::step`, discrete contact/solver/events | Copied candidate step | No change. | Original `SOLVER_PASSES`, `detect`, penetration limit, `solve`, impulses/friction, contact accumulation, pairs/stats and event transitions remain visible. |
| `world.ts::step`, final validation/commit | Copied candidate step | Add finite private diagnostic validation and commit the accepted diagnostic with the existing world transaction. | Original `validateResult`, all original error receipts, full prior accepted state on refusal and no partial commit. |
| `overlapSphere`, `raycast`, `dispose` | Copied candidate world | Preserve original query code/messages. Dispose any owned face reference together with world disposal. | Original body order/tie rules, copied state, query errors, `DISPOSED / world is disposed`, idempotent disposal. |

The original parser's early capsule CCD refusal is the narrow admitted difference. Adding capsule to the parser predicate is not a general private world admission: valid but out-of-profile shapes or scenes still fail the private scene boundary. The original public `parseBody` and public world continue to refuse the unchanged capsule fixture.

## Proposed constructor order

1. Original world record/allowed-field/type validation; original invalid mode value messages.
2. Original fixed-step/gravity parsing and body-array structural bounds.
3. `parseCandidateBody` in original body order. Its sole original-body change is capsule CCD admission. Preserve all other original body errors and capsule inertia defaults.
4. Original dynamic-body/unique-ID checks and original joint structural parsing.
5. Private scene predicate: one original-size dynamic capsule with `ccd:true`; one static finite thin box; zero gravity; zero capsule angular velocity; identity capsule orientation; exact original mass/material; no joints, sensors, filters, large/persistent/broad-phase modes. Only identity or the literal yaw `.2` box orientation is supported. Freeze the permitted box dimensions/centre and optional empty-joint property convention before code.
6. Build an exact #1280 private snapshot from parsed copied Bodies. Original box motion is zero. The internal revision is fixed and valid; it is not a caller-facing world revision.
7. Qualify the initial negative face, tangential footprint and head-on direction against the adopted law. An admitted overlap preserves `INITIAL_OVERLAP`; unsupported initial geometry maps to the private config error.
8. Initialize existing state/cache/event/stat fields and a detached initial diagnostic. No world step or response is executed in constructor admission.

Do not invoke a general original CCD fallback after the new private profile is rejected. Do not run dynamic hinge admission or motor stages to admit this scene. Their copied loops may remain unreachable under the private predicate.

## Staged step and CCD mapping

The accepted start is `bodies[capsuleIndex]`. The original free integration builds `next`; it is an unconstrained candidate. Under this profile, gravity and commands are zero, so staged velocity equals the admitted start velocity. The face sweep starts at the accepted start centre, not the unconstrained endpoint. The response consumes the whole input `dt` and returns its own final centre/velocity. Assign these returned fields into `next[capsuleIndex]` once. Do not add a second remaining-time displacement to `next`.

The #1280 `Hit.bodyId` is **the static fixture ID**: `sweepFace` returns `s.box.id`. The world hit must therefore be mapped explicitly:

```text
PhysicsCcdHit.bodyId                = accepted capsule.id
PhysicsCcdHit.fixtureId             = qualified Hit.bodyId == static box.id
PhysicsCcdHit.toiFraction           = qualified Hit.toiFraction
PhysicsCcdHit.normalFixtureToBody   = copied qualified normalFixtureToCapsule
```

The original discrete contact normal points A-to-B. For sorted `b0 -> floor`, it points towards the box and has the opposite direction to the CCD fixture-to-capsule normal. Do not reuse one normal field in the other record without its required direction.

A clear sweep has `hit=null`, no `ccdHits`, `hitTimeSeconds=0` and `remainingTimeSeconds=dt` in the accepted diagnostic. Its TOI/fraction fields remain null. A touching sweep has a real hit with fraction/time zero, including the adopted touching/departing case. Do not treat a zero hit time as a clear result.

## Original discrete contact path must remain

Retain the complete ordinary eight-pass nonpersistent path after CCD. Every original pair is still tested. With the admitted two bodies and no AABB mode, there is one eligible pair per pass, `eligiblePairs=8`, `candidatePairs=8`, `aabbTests=0` on an accepted step. No pair is removed because CCD hit it.

Retain original `detect(capsule, box)` / `capsuleBox`, contact point/normal/depth, `solve` and its original position correction, normal impulse, angular velocity update and friction arithmetic. The adopted law has no hidden position slop. Original discrete correction is a separate visible stage and must not be bypassed or relabelled as the selected-face response.

Before freeze, declare these reporting rules:

- Record the qualified face result before the discrete passes and the actual final staged/accepted pose after them.
- Record every actual contact field, accumulated normal/tangent impulses and event. No fabricated zero-contact receipt is permitted.
- An original detector may return no contact at a tiny positive binary gap, or a contact at zero/tiny positive penetration. No new epsilon changes that detector decision.
- If a contact exists, its penetration, normal, point, impulse and tangent impulse are finite and copied. Measure final signed gap independently. Do not insist that recorded assembly/contact depth is an exact final-pose gap.
- If the original discrete solver breaks the frozen pose/face gates, retain its actual first result/refusal as NO-GO. Do not reset angular velocity, restore orientation, zero impulses or clamp position to make a comparison pass.
- Angular/contact-friction behavior remains unqualified even if a literal trial records zero impulses.

## Proposed step error precedence

| Order | Trigger | Exact receipt or disposition |
| --- | --- | --- |
| 1 | World already disposed | Original `PhysicsError DISPOSED / world is disposed`. |
| 2 | Wrong configured step argument | Original `INVALID_STEP / step must equal configured fixedStepSeconds`. |
| 3 | Original step cursor limit | Original `WORLD_LIMIT / world step limit reached`. |
| 4 | Any nonempty or malformed private command input | `INVALID_COMMAND / private capsule face world commands are unsupported`. Do not parse a nonempty command first and let a generic target error change this precedence. |
| 5 | Current accepted/staged movement no longer supports the fixed selected face | `NUMERIC_LIMIT / private capsule face world step is unsupported`. |
| 6 | Admitted initial/staged overlap below `-1e-12 m` | Original `INITIAL_OVERLAP / Initial capsule overlaps a box`. Preserve the adopted law's geometry-before-overlap precedence. |
| 7 | Qualified nonfinite/unsafe face result, diagnostic or private result | `NUMERIC_LIMIT / private capsule face world result is invalid`. |
| 8 | Original free-integration, discrete-contact or final `validateResult` error | Original PhysicsError identity/code/message. |
| 9 | Unknown reflection/helper/harness exception | Propagate the original thrown value. Do not classify it as physical NO-GO or replace it while reading diagnostic metadata. |

Steps 5-8 describe phase boundaries, not permission to reorder original free integration or its limits. Freeze the exact error map at each real call site. Map only known expected #1280 profile/movement/numeric codes/messages in the applicable constructor or step context. `STALE_SNAPSHOT` from an impossible internal revision and unexpected codes are not a capsule physical refusal fallback.

Constructor receipts: original structural/type errors remain original; otherwise `INVALID_CONFIG / private capsule face world profile is unsupported`. Admitted overlap remains the original overlap receipt. Public query errors and original body-parser refusal controls are separate controls, not candidate mappings.

## Private accepted diagnostic and retention

Proposed extra private getter: `getCapsuleFaceStepDiagnostics()`. It does not add fields to public `PhysicsState`. Initial value is null. Each accepted step returns a deep copied finite record with:

```text
acceptedStepIndex, stepSeconds
startCenterM, startVelocityMps
hit: null | { dynamicBodyId, fixtureId, fraction, normal, pointM, segmentPointM }
hitTimeSeconds, remainingTimeSeconds
faceFinalCenterM, faceFinalVelocityMps
acceptedCenterM, acceptedVelocityMps
```

Nullable fields are explicitly null. Numeric comparisons never coerce null or an absent field into zero. Keep raw Float64 bits, including signed zero, in the consumer archive. JSON snapshots alone do not retain zero signs.

Make the new diagnostic a local `nextDiagnostic` and assign it only with the original commit of bodies, contacts, events, joint/CCD records, pair stats, active pairs, persistent points, sleeping state and step cursor. A step refusal leaves the previous accepted diagnostic and every existing accepted state/cache/stat/raw bit unchanged. A failed attempt may be persisted by a separately frozen consumer-only copied observer; it must not overwrite the accepted diagnostic. Observer mutation cannot change working bodies, and observer exceptions abort before commit and propagate.

The face-law reference must not retain caller arrays. World construction input, getter results, returned hits, CCD normals, contacts and diagnostic arrays are all detached. Query/disposal semantics remain the original world semantics.

## Full versus two-half comparison

Use two worlds configured before construction: full `dt=1/120`; half `dt=1/240`. The private constructor must explicitly permit both frozen steps. Original dt structural bounds are unchanged.

Compare final accepted body centre/velocity, original shape/ccd/material/inertia metadata, fixed orientation/static box, and physical elapsed time within the existing gates. Check each world's own cursor exactly: full cursor 1, half cursor 2. Check each clock against its actual `stepIndex * configuredDt` operation.

Do not deep-compare the entire last `PhysicsState` between these worlds. Step-local `ccdHits`, fractions, time diagnostics, event phases and cursors can differ. Full first-hit fraction is nominal `.3588`; first-half fraction is `.7176`; second-half touching hit may be fraction zero. The physical comparison is the first absolute contact time: `stepStartTime + hitTimeSeconds` for the first hit of the contact episode. A later touching hit does not replace or add to that first time. The expected first time is nominal `.00299 s` in both worlds under the unchanged original gates.

At most one additional stationary step after contact is a declared transaction/clock control. Record its actual discrete contact/event transition; do not infer contact presence from the analytic touching band.

## Contract items that require explicit freeze

1. **Whole-state half-step wording is inconsistent if interpreted literally.** Full and half worlds have different cursors and potentially different last event/CCD records. The field-specific comparison above resolves this without changing numerical gates.
2. **Fixed-step scope must include the half-step world.** The first fixture remains exact `1/120`; the half control has an explicitly derived configured `1/240`. A constructor that hardcodes only the original step prevents the required control.
3. **Zero angular velocity after original discrete solving needs a rule.** The fixed face profile admits zero spin. The ordinary solver can produce a tiny nonzero spin from an actual tiny impulse, especially under yaw. No repair is allowed. Freeze whether a nonzero final spin is an immediate physical gate failure or makes the next step an unsupported current profile. Preserve and report the actual value; no new angular calibration follows.
4. **Box and optional-joint scope is not fully literal in the current prose.** Freeze whether only original centre/half extents are admitted, and whether absent joints and an explicit empty `joints:[]` are equivalent. The minimum recommended box is original `[0,0,0]` / `[.001,1,1]` with identity or the one literal yaw. No arbitrary box campaign is needed.
5. **Constructor and step mapping differ.** A #1280 movement refusal during initial geometry qualification is private `INVALID_CONFIG`; the same expected refusal during a step is private `NUMERIC_LIMIT`. Original structural parsing stays before these maps. Do not implement a generic catch-all code map.

These are source design choices to freeze before implementation, not measured failures. The native #1280 result, original public capsule-world refusal and all existing contact/hinge NO-GOs remain unchanged.

## Required later verification boundary

After exact #1280 adoption, full candidate source/error/input/difference freeze and measured-source commit: one unchanged original CAD/Physics build, strict private types and one source/source-repeat/genuine compiled-original consumer. Run the original fixture, the already declared literal face controls, full/half comparison and at most one rest step. Preserve exact first compiler/harness/physical failures separately. No tuning, additional model/world campaign, force calibration, Viewer, publication or release.

Only `privateSelectedCapsuleFaceWorldGO` can be established. Keep `fullWorldCCDGO=false`, `configurableCapsuleSweepGO=false`, `rigidAngularResponseMeasured=false`, `contactFrictionMeasured=false`.

## Root final choices

Chosen base b8d4fb1; exact46native modes/blobs retained. Capsule angular velocity must be exactly zero after discrete solve or physical NO-GO. Literal box centre/dimensions and identity/yaw.2 only. Empty/absent joints equivalent. Full/half compare body/elapsed/firstabsolutehit with owncursor1/2, not entirestate. Never rewrite old1280wholeCADindex freeze.
