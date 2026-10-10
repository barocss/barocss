# #1384 API and phase table — source only

Read Integration HEAD527a4407207e32a801365f1b59c071469948aa19. Root verified #1344 adoption1a4278a8fc4a1e84cbf73591027f55e591678571. No model/code execution or repository write ran.

Source root `/Users/user/.barocss-ai/v3/integration/`: W=`examples/physics-rigid-coupled-position-world/reference-world.ts`; I=`global-island.ts`, T=`phase-types.ts`, C=`coupled-phase.ts` in that folder. P=`packages/barocss-physics/src/persistent-box-contact.ts`; V=`validation.ts` in that package.

## API and commands

Current factory: createPhysicsWorld(config:PhysicsWorldConfig,privateOptions:CoupledOptions={}) [W47]. Options currently solve?/observeAttempt? [T15–18], never public config fields. Keep getState(), step(dt,commands=[]), overlapSphere(query), raycast(query), dispose() [types.ts115–120; W136–290], copied getWarmCacheStats/Snapshot and getGlobalContactStats [W131–135]. New copied/ensureActive getters: getLiveSignedClosureStats() initialzero; getLiveSignedClosureAttempt() initialnull; getStepLedger() initialnull. Public package/types unchanged.

Commands belong to ONE step. parseCommands creates a new local Map [V164–200]; there is NO queue/enqueue API or retained pending command. A failed command is not replayed next step.

StepLedger EXACT: {beforeBodies,freeBodies,velocityBodies,finalBodies,fixedStepSeconds,gravityMps2,actions:Array<[id,parsedAction]>,points:PointLedger[]}. Bodies/actions/points are detached copies. Commit only after outer checks.

## Phase sequence

| Phase | Source / selected copied delta |
|---|---|
| Active→dt→step-limit→parse commands | W138–143, before working allocation. |
| Accepted copy | W144–147; beforeBodies before actions. |
| Angular commands | W148–154; original inverseInertia(angularImpulse+torque*dt). Joint/motor branches are unreachable in this profile. |
| Free integration | W163–190: angularguard/q update, impulse then gravity+force velocity update, movementguard, p+=v*dt. freeBodies before warm. |
| Velocity assembly | W201/I91–119: fresh sorted-pair detect and copied feature geometry. |
| Warm then64 sweeps | I123–161: ALL point initialization before ALL warm; reverse point order on odd sweeps. Capture velocityBodies/pointledger after solve, before closure. |
| Live position closure | Replace ONLY W203/I165–173. Immutable PRE=velocityBodies; each hypothesis uses fresh PREcopy. No extra velocity/cache work. |
| Contacts/cache/events | W204–222/I188–210: assemblygeometry+final accumulated impulses, not finalpenetration. Added position rows make no contacts/events. Queries use final accepted bodies. |
| Guard→atomic commit | W223–256: full accepted→final movement, originalvalidateResult/reports/caps; then finalBodies+ledger and every accepted field. |

PointLedger fields: aId,bId,aIndex,bIndex,pairKey,pointId,family,pointM,normal,aPositionM,bPositionM,warm:{normalNs,tangentNs},final:{normalNs,tangentNs}. Order: frozen patch then original point order. Positions/normal/point are assembly values. Copy warm at initialization BEFORE accumulator mutation. Cold=authoredzero; reusedface=actualpriorcopy. Face reuse is whole current/prior key equality; edges cold [warm-cache.ts14–23]. No cached-tangent rotation/reprojection.

## Actual impulse ledger

J=normal*normalNs+tangentNs at the actual frozen point. P6–13 applies −J to A, +J to B; spin signs −(point−pA)×J and +(point−pB)×J through original inverseInertia. normal is A→B; tangent is a world vector.

Warm applies FULL cached J once [P29–31]. Updates apply normal*(next−old), then nextTangent−oldTangent [P38–58]. Normalzero skips apply; tangent speed<1e-12 skips tangent update. Preserve arithmetic.

NET step J is normal*FINALnormalNs+FINALtangentNs, NOT final−warm: warm was applied this step. Floor can be A or B; use actual endpoint signs. Floor torque uses EACH point crossed with its signed dynamic-side impulse. Contact pointM is an UNWEIGHTED mean [I190–201]; it cannot reconstruct torque.

before→free accounts commands/gravity/integration; free→velocity accounts actual point impulses; velocity→final records positional orbital artifact with q/v/omega held. Position KKT lambda kg*m is not impulse. No globalL/energy conservation or calibrated-force claim.

## Atomic state and errors

W242–255 commits global/warm stats, oldcoupled replacementstats/attempt, bodies,contacts,events,joints,CCD,pairStats,activePairs,persistentPoints,sleepFrames,cursor. Add acceptedclosurestats/attempt/ledger at SAME commit. Failure retains ALL prior fields/getters. Failed choices are copied observer receipts, not accepted ledger. Keep original disposal/ensureActive [W289–290].

Preserve verbatim original parser/limits/errors via pinned imports: constructor W49–90; body V6–138; commands V164–200; queries V202–236. Step precedence: DISPOSED / `world is disposed`, INVALID_STEP / `step must equal configured fixedStepSeconds`, WORLD_LIMIT / `world step limit reached`, then commands. Command order: densearray≤64→plainrecord→fields→target→duplicatekind→vector. Accessor command/query fields are typed descriptor refusals; unrelated helper/proxy/callback throws retain identity.

Known phase NUMERIC_LIMIT messages: `contact penetration exceeded limit` [I104]; `private feature contact requires valid box witnesses` [geometry-adapter.ts6,28–37]; `private global contact island phase order is invalid` [I13,214]. Old C7–12,44–78 maps ONLY known PositionReferenceError PROFILE_LIMIT/INVALID_INPUT/INFEASIBLE to `private coupled position profile is unsupported` / `private coupled position input is invalid` / `private coupled position constraints are infeasible`; bad result/combinedmovement uses `private coupled position result is invalid` [W226]. Unknown values rethrow; observer throw may win inside failure handler [C63–76]. New mappings/messages require root freeze.

## Minimal deltas / open choices

NEW copied world/island/types only. Preserve integration, persistent helper,64sweeps,warm,assembly,queries/transactions. Replace one position phase; add copied pointledger without helper arithmetic changes. OWN apply wrapper1..9 replaces parentexact9 restriction with same dynamicaddition/staticcopy semantics (root-selected), parent untouched.

Freeze new cap/infeasible/unsafe/unsupported/alreadyprotected errors; attempt callback payload/precedence; ledgergetter guard after64/beforeclosure; closure stats/count meanings and newdiagnostic disposal. Preserve velocity pairStats; count hypothesis scans/PREqueries/masks/choices separately. Fault hooks are private/explicit, not config. No retrospective ADDED_PAIRS/futurearchive/oracle seed. Full source/error/reference freeze before implementation/trials.
