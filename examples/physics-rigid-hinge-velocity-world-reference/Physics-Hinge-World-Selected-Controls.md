# HINGE2 World — 선택 검증 입력과 호출 수

아래 값은 실행 전 선택이다. 실제 결과는 미측정이다. [Root 준비 계약](Physics-Hinge-Two-Body-Pair-World-Selected-Preparation)과 [API 계약](Physics-Hinge-World-Selected-ABI)이 우선한다. Source/반복/실제 compiled 각각 적용하며 main1,200단계와 분리한다. setup이 실패하면 도달한 호출만 기록하며 cursor0으로 대체하지 않는다.

## 1. Selected fixed population

Only original four-body HINGE2 config: body order pairA0,pairB0,pairA1,pairB1; hinge order hinge0,hinge1. All original dt/gravity/material/radius/mass/anchors/axis/limits/motor values remain. The old groups parser checks membership/values, NOT permutation order. New profile must explicitly enforce both orders.

| Population | Fixed calls per graph | Purpose |
|---|---:|---|
| P0 public HINGE2 |1 constructor,0 step|Original refusal, no old trajectory replay. |
| C constructor negatives below |15 private constructors,0 step|Original structural errors plus new literal/order admission. |
| O bad options |2 private constructors,0 step|Extra field and own accessor; callback0. |
| W0 nominal/API/copy |1 private World;1 setup step +8 refused admission steps|Nonzero accepted cursor/diagnostics; query/copy/dispose controls. |
| R routing |4 fresh private Worlds;1 step each|+.001 angularImpulse on A0/B0/A1/B1, each separately. |
| T combined command |1 fresh private World;1 step|B1 torque+.001 then angularImpulse+.001, original order. |
| L late movement |1 fresh World;1 qualified setup +1 attempted step +1 empty recovery|B1 angularImpulse100000, original admitted endpoint; known angular-movement error. |
| H overload |2 fresh Worlds;1 qualified setup +1 attempted step each|B0 or B1 angularImpulse+.1. Independent disposition, not old CAP assumption. |
| U observer identity |3 fresh Worlds;1 qualified setup +1 attempted empty step each|Error/object/null throws after safe registration. |

Selected totals: P0 public constructor1; private constructor attempts29, of which12 named Worlds; private step attempts27 (including8 admission refusals). Private steps reaching calculation are at most19. Add one post-dispose bad-dt step; total attempts are at most28. Observer-throw attempts are separately counted; they do not become accepted outputs. Root selected this exact subset before code; no matrix of every malformed field/type is added. Four value-marker combinations or extra command cases require explicit count revision, not silent growth.

All physical short-step outputs, except source-defined admission/movement errors, use INDEPENDENT_CLASSIFY. Before reading candidate outputs, reference independently derives original command/motor/FREE/contact separation/POSTCONTACT/parent/report/cap. No PASS/CAP is preclaimed from detached or old World receipts. Correct bounded refusal proves its handling, not an accepted step or main World GO. Unresolved reference is EXECUTION_FAILURE. If a required setup cannot become independently qualified accepted cursor1, stop that control; do not fall back to cursor0.

## 2. Exact constructor controls

P0 original public createPhysicsWorld(HINGE2): original PhysicsError/INVALID_CONFIG/`dynamic pair supports one joint between two dynamic spheres`; unchanged input and0 callbacks. Original joints.ts37-39 supplies this first refusal.

Selected C literals, one edit each, no step:

| Name / edit | Code / message |
|---|---|
| config=null |INVALID_CONFIG / `world must be an object`|
| extra config field |INVALID_CONFIG / `world has an unsupported field`|
| body0 massKg=0 |INVALID_CONFIG / `massKg must be finite and in [0.000001, 1000000]`|
| body2.id=pairA0 |INVALID_CONFIG / `duplicate body ID`, original duplicate check before private profile|
| delete body array index0 |INVALID_CONFIG / NEW_PROFILE, requires new dense guard before map|
| delete joint array index1 |INVALID_CONFIG / PRIVATE_GROUP_PROFILE (old group guard), literal not silently generic parse error|
| swap body0/body1, IDs/positions otherwise intact |INVALID_CONFIG / NEW_PROFILE, NEW explicit order refusal|
| reverse hinge array, definitions unchanged |INVALID_CONFIG / NEW_PROFILE, NEW explicit order refusal|
| gravity=[0,-9.81,0] |INVALID_CONFIG / NEW_PROFILE|
| body0 massKg=2 |INVALID_CONFIG / NEW_PROFILE|
| body0 own inertia override equal default expression |INVALID_CONFIG / NEW_PROFILE; reject presence, not merely unequal parsed I|
| pairA1.positionM[2]=2 |INVALID_CONFIG / NEW_PROFILE|
| hinge1 axisWorld=[1,0,0] |INVALID_CONFIG / PRIVATE_GROUP_PROFILE|
| hinge1 motor targetSpeedRadps=.6 |INVALID_CONFIG / PRIVATE_GROUP_PROFILE|
| hinge1 aId=pairA0 |INVALID_CONFIG / PRIVATE_GROUP_PROFILE; no shared-body/chain admission|

`NEW_PROFILE` = `private hinge velocity World profile is unsupported`. `PRIVATE_GROUP_PROFILE` = unchanged `private multi-hinge reference requires literal HINGE2 fixture`. The dense body guard follows original array/length admission and precedes body mapping. Original G configuration/group failures retain their message; new order/hole/explicit inertia presence checks use NEW_PROFILE. Options error = `INVALID_CONFIG / private hinge velocity World options are invalid`; extra own field or accessor is rejected with accessor calls0. This is a selected new contract, not an old helper capability.

## 3. W0 accepted checkpoint and admission priority

W0 constructor uses original config and safe copied observer. Initially state cursor0/time0, joint reports angle0/motor0, diagnostics=null; store matches actual constructor state. The first empty step is independently classified. Only a fully validated RETURN establishes checkpoint S at cursor1/time1/120 with nonnull diagnostics and nonzero original pairStats. Save full copied store/raw416B before each subsequent guard.

Eight step guards on S; each exactly1 step attempt,0 motor/projection/report calls, callback0, full-store unchanged:

| Input | Code / exact message |
|---|---|
| step(1/100,null) |INVALID_STEP / `step must equal configured fixedStepSeconds` (dt first)|
| step(dt,null) |INVALID_COMMAND / `commands must be a dense array of at most 64`|
| step(dt,new Array(1)) |same dense-array message|
| angularImpulse record with deleted bodyId |INVALID_COMMAND / `command 0 has unsupported fields`|
| two angularImpulse commands targeting B1 |INVALID_COMMAND / `duplicate angularImpulse command for pairB1`|
| force targeting missing |INVALID_COMMAND / `command 0 targets an unknown or unsupported body`|
| zero impulse targeting A1 |INVALID_COMMAND / `dynamic hinge admits axis-aligned angular commands only`|
| B0 angularImpulse[.001,0,0] |same axis-only message|

Joint command admission runs hinge0 then hinge1 after one global parseCommands. No new mutation or queue. Do not claim8 separate numerical solves from8 input refusals. The proposed pure D guard is excluded. Do not export a new helper just to test the guard, add a state setter, or simulate3600 steps. Preserve original MAX_STEPS precedence. Actual limit reachability remains source-only/unrun for this bounded consumer.

## 4. Physical routing, late refusals and partial evidence

R/T start fresh original Worlds at cursor0. Each commanded body is addressed by stable ID, not tuple assumptions. Four R vectors are [0,0,.001] N*m*s; T uses B1 torque[0,0,.001] N*m first and B1 angularImpulse[0,0,.001] N*m*s second. The other pair still receives its original motor; never assert it is motionless. Independently validate routing, actual j, all phase frames/report/work/P-L/cap and authoritative angle.

L first reaches accepted cursor1. Its next command is B1 angularImpulse[0,0,100000], the unchanged original command cap. Original angular movement test yields NUMERIC_LIMIT/`pairB1 exceeded angular movement limit`; no new solver injection. Both motors have been attempted before integration. Earlier bodies may have completed FREE work, but global frames.freeBodies must remain null until all4 complete. Actual returned motor/projection/report progress must survive in `attempt.pairProgress`, while actual reached detection records remain in `attempt.contactChecks`. Counts distinguish phase entry from completed bodies/pairs; Use the selected ABI body-operation and returned-helper count convention. After refusal, one empty recovery is independently derived from S, not from attempted bodies; it proves discarded per-call command and correct accepted memory/cursor if it returns.

H uses B0 or B1 [0,0,.1] after accepted cursor1. Independently classify RETURN/CAP/earlier numeric; old .1 refusal and detached root0 CAP are not the new late-step expectation. If reference predicts an earlier refusal, preserve its actual first code/stage. If cap is reached, exact message is `hinge0 exceeded motor reaction limit` or `hinge1 exceeded motor reaction limit`, report-ready attempt.error stays null, and no store commits. Caps are enforced hinge0 then hinge1 only after required report construction; no scope/tolerance change follows observed results.

For U, register a callback at construction with external mode normal→throw after qualified setup. Error('1179-world-observer-marker'), object{marker:'1179-world-observer-marker'}, null are separate Worlds. Attempt step is empty. If calculation reaches report-ready, callback1 before cap/commit and identical thrown value wins. If known calculation fails first, retain its true completed stage/progress; do not fabricate report-ready. No unknown value is put into attempt.error or serialized. These observer controls prove identity/callback/full-store retention only; no unknown marker is sent to the reference. Qualified setup is separate from the throwing step. Every refused attempt retains S. Inherited typed PhysicsError proxy code/message side effects stay outside the ordinary identity guarantee.

No selected genuine input is known to force a pair1 parent error after pair0 projection succeeds. Thus do NOT promise that particular live branch is measured. Runtime must preserve each actually reached pairProgress and parent output; Do not add a separate synthetic failure campaign to claim an actual late-pair physics failure. Global projectedBodies exists only after both pair projections finish. Nested pairProgress/contactChecks keys follow the selected ABI and Root contract; no old atomic-pair-only substitution.

## 5. Copied full accepted store and snapshot hook

Select read-only private `getTransactionSnapshot()`, with no input, setter or restore. Exact12 keys: `{stepIndex,timeSeconds,bodies,contacts,events,joints,ccdHits,pairStats,activePairs,persistentPoints,sleepFrames,diagnostics}`. Maps are copied entry arrays in actual insertion order. Do not sort them or add disposed/jointStates keys. Bodies retain internal inertia/material values. The getter must ensureActive.

For every step refusal and query error compare all snapshot fields with S, plus full raw416B and negative-zero witnesses; public getState alone is insufficient. Accepted diagnostics, remembered target angles, motor reports, cursor1 and counts must retain their prior values. Under the selected no-contact profile, activePairs/persistentPoints are empty and sleepFrames are0; empty→empty equality does NOT prove nonempty-cache rollback. State that scope honestly rather than creating interacting fixtures.

W0 copy controls use no extra law call: mutate supplied config after constructor (keep an independent original input for reference); mutate copied observer frames, pairProgress/contactChecks and parent coefficients/reports; mutate returned state bodies/q/joint vectors/stats and accepted diagnostics/store snapshots after setup. Fresh getters/store/raw remain identical to S, independent branches stay detached. No world-reaction calculation is performed to create expected copies.

## 6. Queries and disposal on W0

Queries inspect accepted S only, never last attempted progress. Four positive calls: overlapSphere center[0,0,0]/[0,0,1],radius.2; raycast origin[-2,0,0]/[-2,0,1],direction[1,0,0],maxDistance4. Expected own pair IDs and nearest A ID/distance are independently checked from accepted original sphere geometry and original scalar operation order; no fixed bit claim for literal distance1.8. Radius1 is excluded: it can include the other group.

Three exact query negatives, each0 callback/full-store unchanged: overlap(null)→INVALID_QUERY/`query must be a plain object`; overlap radius0→`radiusM must be finite and in [0.0001, 1000]`; ray direction[1,1,0]→`direction must be a unit 3-vector`. Query vectors retain original array-index read behavior; do not claim getter-free nested vector access from top-level descriptor admission.

Dispose twice, both succeed. Then call getState, step(bad dt/nullcommands), overlap(null), raycast(null), getDiagnostics, getTransactionSnapshot once each. Every one must fail first with original PhysicsError/DISPOSED/`world is disposed`, callback0. Do not inspect disposed hidden joint/counter contents through a new bypass: old dispose clears bodies/contact/cache but leaves some old joint/counters; rejected getters are the guarantee. New private getters must also ensureActive. Query result mutation cannot affect S; dispose does not count as a physical step.


## 자료 경계

Control 자료는 fixed64MiB 안에서32MiB 이하로 제한한다. 전체 자원은 main1,024/fixed64/emergency8MiB다. 정확한 provider 채택·before-code addendum·전체 actual source freeze 후 실제 영향 build/types와 산출물 출처를 확인한다. Admission·계산 진입·accepted commit·observer throw·query·dispose·참조·parent solve 수를 따로 기록한다. 이전14/93개를 다시 실행하지 않는다.
