# HINGE2 World — 선택 API와 단계 계약

문서 선택만 완료했다. 구현·빌드·수치·화면 검증은 아직 없다. 시작 조건과 충돌 시 우선순위는 [Root 준비 계약](Physics-Hinge-Two-Body-Pair-World-Selected-Preparation)을 따른다. 아래 경로·행은 읽은 소스의 위치다. 실제 채택 provider의 hash는 코드 전 별도로 고정한다. 추가 dense body guard와 explicit inertia override presence 거절은 Root 계약을 따른다.

## 1. Source authorities

Paths below are real local source paths. Line references describe the current files read for this proposal.

- **W** = `/Users/user/.codex/worktrees/physics-multi-hinge/barocss/examples/physics-rigid-multi-hinge-reference/reference-world.ts`: public copy20–41; constructor44–113; admission116–122; angular127–133; motor134–141; free142–170; contacts189–259; old per-pass joint projection260–265; events267–278; bounds/reaction/caps279–292; commit293–303; queries305–335; dispose336–337.
- **G** = `/Users/user/.codex/worktrees/physics-multi-hinge/barocss/examples/physics-rigid-multi-hinge-reference/groups.ts`: fixture7–18; group parsing21–41; inspection-only Z translation44–47.
- **M** = `/Users/user/.codex/worktrees/physics-hinge-motor-1179/barocss/examples/physics-rigid-hinge-motor-reference/`: `candidate.ts`18–22 admission and74–81 observer/cap; `motor-stages.ts`18–58 operation order; `report.ts`12–53 report/cap; `diagnostics.ts`16–55 operations and79–110 exact five-frame validation; `types.ts`8–53 schemas; `errors.ts`16–35 known-error boundary; `options.ts`7–17 strict options.
- **V** = `/Users/user/.codex/worktrees/physics-hinge-motor-1179/barocss/examples/physics-rigid-hinge-velocity-reference/`: `candidate.ts`11–41 one projection; `profile.ts`8–16 exact errors and42–54 inherited bridge; `diagnostics.ts`4–23 pair measurements.
- **P** = `/Users/user/.codex/worktrees/physics-multi-hinge/barocss/packages/barocss-physics/src/`: `validation.ts`164–201 command parser,205–235 queries; `dynamic-hinge-joint.ts`37–46 angular admission; `collision.ts`227–239 final validation; `types.ts`123–131 internal Body/Hit.

Parents stay unchanged. New prefix: `examples/physics-rigid-hinge-velocity-world-reference/**` only.

## 2. API and constructor order

Select `createHingeVelocityWorldCandidate(config, privateOptions={})` with methods:

| Method | Selected behavior |
|---|---|
| `getState()` | Original W public copy and exact state keys. |
| `step(dt,commands=[])` | Original per-call commands; no queue. Return independent accepted public state. |
| `overlapSphere(query)` / `raycast(query)` | Original W queries against accepted bodies. |
| `getDiagnostics()` | New copied accepted diagnostic; initially null; no attempted data. |
| `getTransactionSnapshot()` | New read-only copied hidden-store hook below; no restore/write path. |
| `dispose()` | Original repeated disposal; clear new accepted diagnostic. |

Every method except dispose begins with original ensureActive. After disposal: original `DISPOSED / world is disposed`.

Keep original structural/body parsing and G configuration/group checks. Then add a new narrow check BEFORE any transaction and before options admission: body IDs exactly `[pairA0,pairB0,pairA1,pairB1]`, joint IDs exactly `[hinge0,hinge1]` in submitted order. Do not sort or repair input. G accepts body permutations and maps hinges in submitted order; it does not prove this order. Preserve original parser errors before this new check. Select new `INVALID_CONFIG / private hinge velocity World profile is unsupported` for the extra order/profile check. Admit only `{}` or own-data `{observeAttempt:function}` after all constructor/profile checks; select `INVALID_CONFIG / private hinge velocity World options are invalid`. These NEW literals require Root freeze.

Public state keys stay `{stepIndex,timeSeconds,bodies,contacts,events,joints,ccdHits,pairStats}`. Internal mass/material remain in copied diagnostic bodies and hidden snapshot; do not add them to public state. Report angle is accepted memory, initially0; no raw-angle replacement or new memory bound.

## 3. Phase order and POSTCONTACT boundary

Preserve W step priority: ensureActive → exact dt → MAX_STEPS → parseCommands once → hinge0 axis admission → hinge1 axis admission. Copy accepted store. Global angular body order0..3; original motor hinge0 then hinge1 from accepted report angles; original global free integration body0..3. Capture SOURCE/ANGULAR/MOTOR/FREE only after a complete full-body stage.

Keep eight original contact passes and four eligible cross-group pairs in W's actual sorted order: `(pairA0,pairA1)`, `(pairA0,pairB1)`, `(pairA1,pairB0)`, `(pairB0,pairB1)`. Remove ONLY W260–265 old joint projection and its reaction accumulation. Keep detect/solve/maps/events arithmetic. No old projectJoint call remains in the new executed graph. Nominal original stats32/32/0 remain separate from projection counts.

Capture POSTCONTACT after the full contact loop. Select no-contact guard after actual contact processing and before new pair projections: any actual detector hit, including touch, refuses the narrow profile. Record the original hit/outcome first; no extra solve or retry. Select `NUMERIC_LIMIT / private hinge velocity World contact profile is unsupported`. Independent geometric quality disagreement stays a harness NO-GO, not a producer error invented by the reference.

Selected internal adapter: `projectPostContactPairReference(pairConfig,pairCarrier,dt)` composes exactly ONE unchanged V.projectHingePoseVelocityReference call, returns its copied `{bodies,poseReport,diagnostics}`, and has no motor/free/contact call. It is internal, not a World method. Pair0 then pair1, disjoint writeback. Local Joint indices0/1 are mandatory: M.makeReport indexes `free[joint.aIndex]` and corrections[joint.bIndex]; passing global hinge1 indices2/3 would be wrong.

Each pairConfig is original admitted rest config at its REAL Z0/Z1. Carrier uses source cursor n/time=n*dt, prior accepted joint report memory, and exact POSTCONTACT raw13 fields. Its contacts/events/ccdHits=[] and pairStats0 are an internal envelope, never global accepted counters. No coordinate normalization in simulation/reference. New report uses unchanged M.makeReport(localJoint,postContactPair,projectedPair,parentTargetAngle,motorJ). J=mΔv and K=parsed scalarI Δomega use POSTCONTACT baseline. No call to M.advanceDrivenHingePairReference: that repeats angular/motor/free stages.

## 4. Exact accepted diagnostics and attempt choice

Accepted diagnostic exact keys:
`{sourceStepIndex,sourceTimeSeconds,acceptedStepIndex,acceptedTimeSeconds,fixedStepSeconds,frames,pairs,contactPasses,pairStats,calls,contactChecks}`.

frames exact `{sourceBodies,angularBodies,motorBodies,freeBodies,postContactBodies,projectedBodies}`; each is an independent four-internal-Body copy. pairs exact two records in hinge0/hinge1 order. Complete PairDiagnostic keys:
`{jointId,aId,bId,acceptedReportAngleRad,rawSourceAngleRad,rawFreeAngleRad,rawPostContactAngleRad,rawFinalAngleRad,parsedActions,motor,projection,jointReport,bodyCorrections,energyByPhase,work,reportCap,metrics,calls}`.

Nested selected keys:
- parsedActions: two unchanged `{bodyId,torqueNm,angularImpulseNms}` records, absent values null.
- motor: unchanged eight M.types keys.
- projection: unchanged `{bodies,poseReport,diagnostics}` and its native certificate/result; no field substitution.
- jointReport: `{id,kind,aId,bId,angleRad,linearImpulseNs,angularImpulseNms,motorImpulseNms}`.
- bodyCorrections: two `{bodyId,linearImpulseNs,angularImpulseNms}`.
- reportCap: `{angularReactionNormNms,maxReactionNms,exceedsCap}`.
- energyByPhase: `{sourceJ,angularJ,motorJ,freeJ,postContactJ,projectedJ}`.
- work: original eight M.types work keys plus `contactDeltaKJ`; projectionDeltaKJ becomes projectedJ-postContactJ; contactDeltaKJ=postContactJ-freeJ. Keep signed deltas/work and exact leaf grouping. No conservation or calibrated load claim.
- metrics: `{source,angular,motor,free,postContact,projected}`; each unchanged V.measureBodies key set. Real rest midpoint is fixed measurement origin, including Z1.
- global calls: `{angularUpdates,freeIntegrations,motorCalls,projectionCalls,reportCalls}`; nominal4/4/2/2/2. Pair calls `{motorCalls,projectionCalls,reportCalls}` nominal1/1/1. Increment attempted call counters just before that call, not on success. contactPasses counts completed passes0..8; contactChecks records actual detect calls, not additional calls.

New World diagnostics must own the six-frame validator and calculations. Do NOT pass six frames to M.makeDiagnostics or alias POSTCONTACT as FREE: M.diagnostics validates exactly five frames/keys. Reuse its operation definitions unchanged, with the declared extra contact metric/delta only.

Attempt exact outer keys:
`{stage,sourceStepIndex,sourceTimeSeconds,attemptedStepIndex,attemptedTimeSeconds,acceptedReportAnglesRad,parsedActions,frames,pairs,pairProgress,contactPasses,pairStats,calls,contactChecks,error}`.
Stage enum: admitted/angular-ready/motor-ready/free-ready/contact-ready/pair0-ready/pair1-ready/report-ready. Unreached whole frames null. `pairs=[null,null]` until each complete pair report/diagnostic succeeds; assign all pair report fields atomically. projectedBodies remains null until both pairs finish. Reached pair0 data survives pair1 failure.

**Selected partial evidence:**
1. `pairProgress` fixed two entries, each exact `{jointId,motor,projection,report,calls,completedCalls,lastCall,projectedRawHex}`. motor/projection/report initially null; assign successful outputs after each call. report, when returned, is the unchanged helper output `{jointReport,bodyCorrections,reportCap}`. `calls` and `completedCalls` each have `{motorCalls,projectionCalls,reportCalls}` with per-pair values0/1: increment calls immediately before entering the helper, completedCalls only after it returns. `lastCall` is null initially or `{operation,ordinal,outcome}`: operation motor/projection/report; ordinal1/2 is that operation's actual global invocation ordinal; outcome started/returned/known-refused. Mark known-refused only for an exactly classified error from that helper. A later diagnostics error does not relabel a returned report. This retains hinge0 motor if hinge1 motor fails, projection if report fails, and report if pair diagnostics fail, without publishing a fabricated complete PairDiagnostic. A called-but-not-returned helper is never counted as completed.
2. `contactChecks` is an append-only returned-call array `{pass,pairIndex,aId,bId,aPositionM,bPositionM,hit}`. pass0..7, pairIndex0..3. Copy positions before the original detect/solve; append only after detect actually returns. hit is null or copied original `{normal,penetration,pointM}`. Never pad an unreached/thrown call. Accepted narrow success has32 null hits. `projectedRawHex` is null until actual projection returns, then208B raw hex.
Root selected the exact additions above. Complete pair diagnostics remain atomic. Global angularUpdates/freeIntegrations are body-operation counts; each whole global stage runs once.

## 5. Observer placement and error priority

Select calculation catch around original staging, contact profile refusal, pair projections/reports, six-frame diagnostics/events, original W.validateResult, report finite checks, and final accepted-to-projected displacement<=10m. Then:
- known calculation error: set safe own-data `{name:'PhysicsError',code,message}`, emit ONE copied last-complete attempt outside catch, rethrow original received value;
- unknown received value: rethrow unchanged immediately; no reflection/serialization/callback;
- success: emit ONE copied report-ready attempt outside catch BEFORE hinge0 cap then hinge1 cap, BEFORE commit;
- cap refusal: attempt.error remains null; no second callback;
- observer throw (Error/object/null): propagates unchanged and wins over a pending known failure or later cap. All accepted fields retained.
Admission failures have callback0; later callback at most1. Original typed-proxy bridge boundary V.profile42–49 remains inherited; do not promise to restore a value that a parent reflection already replaced.

Preserve original error class/message priorities: W118 `INVALID_STEP / step must equal configured fixedStepSeconds`; W119 `WORLD_LIMIT / world step limit reached`; P command parser then angular-admission `INVALID_COMMAND / dynamic hinge admits axis-aligned angular commands only`; W158/166 per-body `NUMERIC_LIMIT / <id> exceeded angular movement limit` and `<id> exceeded step displacement limit`; W204 `contact penetration exceeded limit`; P.collision body bounds/orientation then `unsafe contact result`; W285/M.report `unsafe joint reaction`; W290/M.report `hinge0 exceeded motor reaction limit` before hinge1 equivalent. Parent V exact profile/pose/result/linear/system/certificate literals remain unchanged. New six-frame schema/final full displacement selects `NUMERIC_LIMIT / private hinge velocity World diagnostics are invalid` and `NUMERIC_LIMIT / private hinge velocity World result is invalid`, respectively; freeze before trial. Canonical original validateResult precedes these new final guards. Complete report checks may fail earlier inside the pair builder, matching the detached helper call order.

## 6. Hidden-store snapshot and one commit

Select `getTransactionSnapshot()` exact keys:
`{stepIndex,timeSeconds,bodies,contacts,events,joints,ccdHits,pairStats,activePairs,persistentPoints,sleepFrames,diagnostics}`.
Bodies are full copied internal Body values; joints are copied accepted jointStates. Map fields are copied arrays of `[key,value]` in actual insertion order, never sorted/canonicalized: activePairs value `{aId,bId,kind}`; persistentPoints value `{normalNs,tangentNs}`. sleepFrames copied. Initially original stores plus diagnostics:null. Do not expose mutable Map objects, options/callback/config references or an attempted-state setter. No attempt getter/store; observer is the attempt channel.

Single commit retains W293–302 ordering and adds accepted diagnostics only after every check/cap. Time is `(n+1)*dt`. Failure retention proof compares ALL snapshot keys, public state, raw bytes, getter copies and source cursor. Commands are local and discarded; no retained pending action. Immutable config/groups/pairs are constructor data, not step mutations. Queries and both getters ensureActive first. Snapshot reads add no physical operations.
