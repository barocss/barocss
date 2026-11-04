# World 통합 계획 — 구현 전 SOURCE_ONLY

이 파일만 작성했다. World/솔버/기존 증거는 수정하지 않았다. 실행·import·컴파일·수치·브라우저 검사는 Root만 한다. private-04의 실제 `PRIVATE_FREE27_SOURCE_NATIVE_PHASE_CONFIRMED`는 FREE27 한 프레임의 후보 검증이다. 공개 World27, 32/256-step 궤적, 복원 또는 화면 PASS로 확대하지 않는다. 기존 baseline02의 step27 물리 실패와 private01–03의 최초 실패를 유지한다.

## 1. 라우팅과 호출 지점

- 기존 `rigid-persistent-box-v1`/bodycap4를 유지한다(`src/model-admission.ts:57`). 최초 통합은 검증 입력과 같은 direct broadphase로 한정한다. 같은 World의 모든 bodies가 dynamic/static box, awake, semantic unfiltered, sensor/CCD 없음, restitution/static+dynamic friction 모두 숫자0이고 joints가0이면 island 분기를 고정 선택한다. 양의 inverseMass/실제 inertia를 쓴다. fixture ID/질량/높이/예상하중/접촉 수로 선택하지 않는다. 동일 zero-material box subset의 AABB는 World 생성 시 명시적인 INVALID_CONFIG("frictionless island requires direct broadPhase")로 거부한다. AABB를 같은 coupled 입력의 old-law 우회로로 남기지 않는다. 다른 재료/형상/kinematic/joints의 기존 AABB 기능은 그대로 두되 새 island 자격으로 보고하지 않는다. 후보 호출 **후** 조건을 재분류하거나 catch에서 기존 solver로 돌아가지 않는다.
- `world.ts:185–218`의 stationary8 분기는 그대로 먼저 실행한다. 새 profile/factory/clock/recorder는 만들지 않는다. 기존 discrete/large/domain 분기도 바꾸지 않는다.
- `world.ts:253–308`의 command 처리, 실제 G1 회전, impulse/force/gravity, kick→drift를 **한 번** 유지한다. owner.prepareFrames도 기존 위치에서 한 번만 호출한다.
- FREE `next`가 완성된 뒤, 기존 pair pass0 **전**(`world.ts:317–329`) `prepareFrictionlessIsland(next,pairs,{jointCount:joints.length})`를 한 번 호출한다. 실제 sorted complete pairs(`:132–141`)를 전부 넘긴다. pair pruning/AABB/old warm start/old8×8 contact·position·joint loop를 island에 중복 적용하지 않는다.
- 최소 구조: prep용 `next`를 재할당 가능한 local로 바꾸고 island 반환 candidateBodies를 받는다. island contacts를 기존 found/후속 public mapping에 연결하고 pairStats를 실제 한 batch 통계로 설정한다. 새 cache는 빈 nextPersistentPoints로 유지한다. mode는 World 수명 동안 불변이므로 이전법 cache를 재사용하지 않는다.
- 후보의 completed pairContributions는 이미 실제 point applications에서 finish한 합이다. 이를 public mean×sum으로 재구성하거나 fake point contribution으로 다시 accumulator에 넣지 않는다. 기존 branch에서만 기존 accumulator.finish를 수행한다. island는 실제 완료 contribution의 finite/ID 검증과 후보의 독립 phase 검증 자료를 유지한다.

## 2. 단일 출력·commit 소유자

`world.ts:435–477`의 기존 activePairs/events→validateResult→publicState→owner.prepare→assignment-only commit을 공유한다. island가 World/identity/events/기록/stepIndex를 소유하지 않는다. joints/CCD/sensors는 선택 조건에서 없으므로 해당 출력은 빈 상태다. begin/stay/end와 collider ID mapping은 기존 공통 코드를 쓴다.

공개 contact는 후보가 만든 실제 post 대표점/normal, actual free-hit penetration, 실제 point λ의 진단 합, tangent0을 사용한다. post mean은 적용 force centroid가 아니다. 실제 point COM/arm/impulse/torque와 completed pair contributions를 분리한다. 한 global normal solve/한 full-pair position phase, 기존64 work/bit/rank/geometry/SI 한도를 바꾸지 않는다. High의 exact-isotropic identity와 applied certificate를 다시 구현하지 않는다.

## 3. P0 실패 계약

| 발생 위치 | 공개 phase / 보장 |
|---|---|
| lifecycle/owner/lifetime/command admission | 기존 우선순위·코드 유지; 선택 이전 guard 유지 |
| owner.prepareFrames 또는 byte/frame/command 한도 | prepare-output; WORLD_LIMIT은 budget; 실제 accepted cursor 유지 |
| G1/FREE 또는 island 준비/typed numerical·resource·geometry refusal | candidate; 원래 code 유지; fallback 금지 |
| 공통 validateResult/완료 contribution 검증 | validation |
| publicState/copy/events/log preparation | prepare-output |

현재 `guarded`의 명시 phase 보존은 **stationaryMode만** 허용한다(`world.ts:526`). 새 island에도 자신의 prep 경계에서 만든 candidate/validation/prepare-output/budget phase를 보존해야 한다. operation은 실제 step/record, domain rigid, accepted는 실패 전 stepIndex/time이다. 신규 외부 FailureDetails 필드를 만들지 않는다. private reached diagnostics는 private 증거로 보존하며 public Error에 없는 필드를 약속하지 않는다. 상속된 error.name은 PhysicsError일 수 있다. 알려진 오류는 canonical class/code/details로 검사하고 constructor-name 문자열을 고치지 않는다.

예기치 않은 Error/object/null은 wrapper로 바꾸지 않고 동일 값으로 전달한다. 모든 실패는 bodies/contacts/events/activePairs/cache/sleepFrames/clock/model/owner.recording/commandCount/호출자 commands를 유지한다. guarded.finally가 running을 해제한다. allocations/callback/encoding은 commit 전이며 commit은 기존 assignment만 수행한다. 후보가 입력을 변경하지 않는다는 private 보증도 별도로 유지한다.

## 4. 실제 검증 순서

1. Root의 private isotropy/adversarial·phase 검증을 먼저 닫는다. 자연스러운 rotated anisotropic rectangle의 exact tensor symmetry NUMERIC_LIMIT은 후보 경계의 실패 보증이다. 실제 public 입력을 고정하고 admission 후 candidate 단계에서 발생하는지 확인한다. unsupported refusal을 성공이라고 부르지 않는다.
2. Root가 World 최소 edit를 별도 승인한다. 현재 소스/old canonical/입력·도구·최초 실패를 먼저 보존한다. 새 provider manifest→strict Source→실제 canonical build/closure를 인증한다. root/replay가 같은 types/RecordingOwner를 쓰는지 확인한다. private NodeNext emission을 canonical public build로 재명명하지 않는다.
3. **먼저 새 public Source/Native 120Hz 32-prefix**를 실제 초기 모델에서 실행한다. 동결된 기존 coupled oracle(최대33states)을 그대로 쓴다. actual full states/ALLwords, SourceNative provider 문자열만 정규화한 parity, 첫 coupled contact와 독립 global velocity/position/geometry/energy를 확인한다. private FREE27 데이터나 예상 미래 pose를 World에 주지 않는다.
4. recorder4→실제 restore4→continuation을 실제 step 수에 포함한다. 자연 typed refusal은 state/model/clock/log/owner 유지와 정확한 phase/operation을 검사한다. 자연 입력이 계속 unsupported이면 다음 empty도 같은 refusal이어야 하며 성공 retry를 꾸미지 않는다. 성공 continuation과 one-shot unknown Error/object/null은 별도 test-owned provider copy에서 실제 candidate/output/log 경계에 fault를 넣고 clean control과 비교한다. shipping hook/캐시 reset은 없다. 진단 copy와 canonical ordinary graph의 byte identity는 구분한다.
5. 32-prefix PASS 후에만 **별도 256 follow-on 계약/oracle**를 고정한다. 원래33state oracle을 수정하거나 256까지 통과한 것으로 해석하지 않는다. 초기부터256 연속 state와 모든 실패·복원·output gate를 새 authority로 저장한다. StageA separated120×256와 gravity-fall e0는 독립 기존 oracle로 새 알고리즘을 재검증한다. e>0 pair는 기존 분기 smoke, stationary8은 짧은 compile/wiring/body-word 회귀만 수행한다. 영향 없는3600을 반복하지 않는다.
6. 같은 실제 Native provider/input 해시로256 desktop을 **같은 기능 단계**에서 검사한다. 기존 FIXED dynamic UI의 coherent reset/GPU direct readback/physics-only clock/fullword POST를 새 source adapter에서 재사용한다. 실제 운동·coupled contact/지지·GPU pixel 변화·독립 corner/marker·별도 KE/PE·257states를 검사한다. numerical PASS만으로 기능 완료를 보고하지 않는다.

## 5. 동결 입력과 harness 충돌

- 기존 baseline.mjs의 Source 경로는 **old** public-source01이고 Native는 currentdist다. World 변경 후 그대로 돌려 새 Source/Native 자격이라고 부를 수 없다. 원본을 보존하고 새 adoption runner에서 새 Source+canonical Native의 명시 경로를 고정한다.
- private capture helper는 baseline02의 **원래** provider hash를 요구한다. currentdist를 새 build로 덮으면 기존 fresh-native capture는 의도대로 거부한다. private03/04 paid FREE packet과 원래 provider copies/compile receipts를 먼저 보존하며 hash 검사를 느슨하게 만들지 않는다. 재사용은 DATA 검증이지 새 World 실행이 아니다.
- old StageA/old QR trajectories와 개별 λ는 새 cold global 알고리즘의 equality oracle이 아니다. old 실패·golden은 그대로 두고 동일 물리 gate의 새 결과를 만든다. 새 Source와 새 Native끼리는 ALLword parity를 요구한다. 아직 실행하지 않은 새 결과를 만들지 않는다.
- World import가 provider closure/digest를 바꾸므로 과거 recording의 provider identity는 STALE_SNAPSHOT이어야 한다. root/replay identity를 정규화해 restore를 통과시키지 않는다. recorder512/4096/128KiB/1MiB, bodycap4, 2MiB wire/16MiB evidence, 170inner/180outer와 모든 공차는 그대로다.

현재 결정: 계획만 준비됨. World edit/새 public32/256/desktop은 NOT_RUN이다. 일반 dynamic8, friction/restitution/tilted off-center·CCD remainder·joint 확장, Studio/manufacturing/mobile/deployment/release를 승인하지 않는다.
