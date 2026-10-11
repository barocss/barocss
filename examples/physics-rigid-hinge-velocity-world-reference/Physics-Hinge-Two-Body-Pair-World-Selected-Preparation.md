# HINGE2 World 구현 전 선택 — 조건부 준비 계약

## 상태와 목표

이 문서는 기존 #1179의 다음 구현 계약이다. 네 몸체와 두 관절을 1/120 s로 1,200단계 진행하는 실제 월드가 목표다. 14개 분리 보고 검증의 GO를 이 목표의 GO로 확대하지 않는다. 현재는 문서만 작성했다. 새 World 코드, 빌드, 타입 검사, 독립 수치 계산, 화면 검증은 실행하지 않았다.

선행 native는 `c8bb228130069d0597cd575d551862de460af9b5 → fe89b76572a2acc57b114d0488dea247ebf3b25f`다. 해당203개 새 경로의 정확한 Integration 채택은 `a59eaf877cde02b2138c54dc0be03dd4a6b295b7`에서 확인했다. 다음 코드 작성의 시작 조건을 충족했다. 현재 시작 기준 Integration `a59eaf877cde02b2138c54dc0be03dd4a6b295b7`에는 #1399와 #1179 자료가 각각 정확히 반영됐다. Render package와 kiosk의 작업 파일을 보존했다. 기존 #1399의 세 월드 NO-GO도 유지한다.

수치 시작 조건은 다음과 같다.

1. 실제 Integration의 해당 native 경로·mode·blob과 부모 관계를 확인한다. #1349의 채택 provider도 다시 소스 관계로 확인한다. 화면·저장·열기·복구 후속 검증은 시작 조건에 넣지 않는다.
2. Physics의 새 격리 작업 공간에서 실제 채택 기준과 소유 파일을 기록한다. 기존 전달 branch의203개 경로를 문서 추가로 바꾸지 않는다.
3. 아래 계약과 기존 제안의 고정 입력·규칙·수치 기준을 코드 전에 고정한다. 에이전트는 파일을 나눠 작성한다. Root는 실제 통합 소스와 참조·schema·오류·입력 전체를 고정한다.
4. 실제 영향 빌드·타입 검증과 해당 소비자의 실제 산출물 출처를 수치 호출 전에 공개한다. 이전 보고 검증을 월드 검증으로 재사용하지 않는다. 이미 완료한 보고14개와 부모93개는 다시 실행하지 않는다.

## Root가 선택한 재사용 경계

새 소유 경로는 `examples/physics-rigid-hinge-velocity-world-reference/**`다. 공개 package, root 설정, lock, Viewer 또는 부모 예제 코드는 수정하지 않는다. 기존 HINGE2 입력과 접촉 계산을 유지한다. 새 월드는 매 단계 angular update 한 번, motor 관절별 한 번, free integration 한 번, 접촉8회 뒤에 자세·속도 보정을 관절별 한 번 적용한다.

`advanceDrivenHingePairReference`를 접촉 뒤에 호출하지 않는다. 그 함수는 motor/free를 다시 실행한다. 기존 `projectHingePoseVelocityReference`와 `makeReport`를 사용하는 별도 작은 POSTCONTACT 조합을 만든다. 부모 함수와 계산 순서를 바꾸지 않는다. 기존 `makeDiagnostics`는 다섯 프레임과 정확한 키를 검사한다. 새 여섯 프레임을 그 함수에 넣지 않는다. 새 월드 진단 모듈에서 같은 측정·일 정의를 유지하고 POSTCONTACT 측정과 signed contactDeltaKJ를 명시한다.

원래 `groups.ts`는 몸체 소속과 값을 검사하지만 제출 순서를 고정하지 않는다. 새 소비자의 고정 실패 순서를 보장하기 위해 좁은 profile에 몸체 ID 순서 `pairA0,pairB0,pairA1,pairB1`와 관절 ID 순서 `hinge0,hinge1` 검사를 추가한다. 순서가 바뀐 입력은 새 profile 오류로 거절한다. 이는 새 고정 소비자의 admission 계약이며 기존 parser나 공개 API의 결과로 표시하지 않는다.

PAIR0과 PAIR1은 분리된 몸체를 사용한다. 각 provider carrier는 source cursor `n`, time `n*dt`, 실제 POSTCONTACT 값, 이전 accepted report 각도를 가진다. 전체 월드의 attempted cursor는 `n+1`이다. accepted report 각도만 다음 motor 입력이다. raw 각도는 별도 측정이다. 보정 J/K의 기준은 POSTCONTACT다. 접촉·motor 임펄스를 보정 보고에 다시 더하지 않는다.

## 병렬 파일 소유 계획

| 작성자 | 새 경로 안의 책임 | 완료 조건 |
| --- | --- | --- |
| A | profile/options/errors/types/copy, angular/motor/free/contact 단계, POSTCONTACT adapter, diagnostics | 정확한 API·키·오류·관절 순서, 기존 contact 산술과 부모 함수 보존 |
| B | World 생성·transaction/store/query, 고정 controls·raw codec·소비자 비교 | 전체 rollback, 미측정 결과의 독립 분류, 실제 상태·프레임·처음 실패 보존 |
| C | 독립 입력 기반 binary64/Decimal/Fraction 참조와 protocol controls | 실제 candidate FREE/POSTCONTACT를 예상의 초기값으로 쓰지 않음; 두 관절과 no-contact 분리 검사 |
| Root | graph/bundle/provenance, 저장·자원 제어, 실행·자료 감사, Issue/Wiki | 실제 소스 고정 후 gate를 순서대로 실행; SOURCE/반복/실제 compiled 전체 증거 비교 |

World와 모델 코드는 위 시작 조건이 충족된 뒤 작성한다. 지금 세 에이전트는 API·controls·증거 저장 계약만 서로 다른 문서에서 병렬로 준비했다. 새 이슈는 만들지 않는다. 기존 #1179와 부모 #660을 유지한다.

## 결과 판정과 이후 소비자

새 nominal trace의 strict cap 거절은 물리 World NO-GO다. 분리 보고 control의 예상 cap 거절 통과와 구분한다. 원본1,200단계/10s, anchor2mm, axis1도 및 부모의 더 강한 단계별 수치 기준은 유지한다. 첫 물리 실패를 보존하며 입력·규칙·상한·허용 오차를 바꾸지 않는다. 실행·protocol·저장 오류는 수치 NO-GO와 구분한다.

실제 세 경로의 전체1,200단계 수치 GO 후 Viewer recorded-frame 소비자를 검증한다. Accepted frame만 재생하며 ID/자세/각도·임펄스·단위·play/pause/자연 종료·자원 정리를 확인한다. 공개 범용 엔진, contact와 joint의 전체 조합, Box3D 동등성, 하중 보정, 성능, 발행은 후속 목표다.

## 구체 API·관찰·오류 선택

연결된 ABI 문서의 새 키·리터럴·관찰 순서를 선택한다. 이전 World 제안의 키 목록은 이 선택으로 대체한다. 부모 모터와 projection의 기존 키·오류는 유지한다.

- Adapter 파일 `postcontact-pair.ts`의 내부 export는 `projectPostContactPairReference`다. 새 `candidate.ts`만 World 생성 함수를 export한다. 공개 package의 export는 바꾸지 않는다.
- `getTransactionSnapshot()`은 accepted hidden store를 독립 복사한다. 복구 또는 setter를 제공하지 않는다. 실패 전후의 전체 cache·sleep·진단·cursor를 실제 값으로 비교한다.
- `pairProgress`는 실제 motor/projection/report 반환을 보존한다. 호출 전 `calls`, 성공 반환 후 `completedCalls`, 실제 global ordinal과 결과를 따로 기록한다. `pairs`의 완료 진단은 여전히 atomic이다.
- `contactChecks`는 기존 detect의 실제 반환32개를 복사한다. 수치 참조는 그 반환과 무관하게 원본 입력에서 분리 여부를 확인한다. 검증을 위해 producer detect를 추가 호출하지 않는다.
- 원래 result validation과 새 full-displacement/diagnostics 검사는 calculation catch 안이다. 성공 callback은 보고 준비 후, hinge0 cap/hinge1 cap과 commit 전이다. 정확히 알려진 calculation 오류는 마지막 완료 attempt callback 후 원래 값을 다시 던진다. unknown 값은 검사하거나 직렬화하지 않는다. Observer 오류는 원래 identity를 유지한다.
- 관절1의 global 몸체 index2/3을 두 몸체 helper에 전달하지 않는다. local Joint는 index0/1이며 global ID와 writeback 경로는 별도다.

선택한 새 오류는 `INVALID_CONFIG / private hinge velocity World profile is unsupported`, `INVALID_CONFIG / private hinge velocity World options are invalid`, `NUMERIC_LIMIT / private hinge velocity World contact profile is unsupported`, `NUMERIC_LIMIT / private hinge velocity World diagnostics are invalid`, `NUMERIC_LIMIT / private hinge velocity World result is invalid`다. 기존 구조·command·query·DISPOSED·parent 오류가 앞서 발생하면 그 오류를 유지한다. 수치 참조의 불일치를 producer 오류로 바꾸지 않는다.

## 독립 참조와 저장 경계의 Root 선택

참조는 원래 입력에서 여섯 단계를 계산한다. 실제 FREE·POSTCONTACT·PROJECTED frame을 예상 계산의 초기값으로 쓰지 않는다. 이전 accepted 상태는 앞 단계의 독립 검증을 통과한 뒤 다음 호출의 원본 입력이 된다. 원래 네 cross-pair를8회 검사한다. 실제 detector hit 또는 독립 분리 검사에서 touch/contact를 발견하면 nominal World NO-GO로 유지한다. interacting-contact 참조를 이 실행에 추가하지 않는다.

#1349 부모 참조의 실제 성공 reply는9개 키 `ok,resolved,executionFailure,metrics,violations,reference,certificate,transcendentals,zeroAuthority`를 가진다. #1179 outer8-key envelope와 다르다. 새 `pairReplies[0,1]`에는 부모 성공·safe refusal의 실제 전체 schema와 모든 nested proof를 그대로 보존한다. 새로운 compact parent schema를 만들지 않는다. 실제 World wrapper의 입출력 키와 safe protocol 오류는 연결된 참조 문서에서 고정한다.

Runtime output 계획 한도는 main1,024MiB, fixed64MiB, emergency8MiB, 합계1,096MiB다. SOURCE request 최대256KiB·reply512KiB·compact receipt4KiB를 선택했다. 1,200단계 IPC의 계획 상한900MiB와 receipt4.6875MiB, raw frame·initial 여유를1,024MiB에 포함한다. Controls는 fixed 안에서32MiB 이하로 별도 계산한다. 압축률이나 alias 절약을 SOURCE 한도 산정에 사용하지 않았다. 이전 제안의64/8/2MiB, helper 초기256/32/4MiB, Root의 중간512/64/8MiB 계획을 이 코드 전 선택으로 대체한다. 두 관절의 전체 actual attempt/output, 중복된 실제 progress, 전체 부모 증명과 negative-zero 경로를 유지하므로 중간 line 한도를 늘렸다. 새 World 실행이나 실제 초과 결과를 근거로 바꾼 값이 아니다. 이는 실제 World 크기를 측정한 값이나 모든 finite 입력에 대한 크기 보장이 아니다.

전체 실제 native payload는 raw IPC에 보존한다. JSONL receipt는 그 byte range·hash·호출·도달 단계·판정만 연결한다. 요약에 전체 observations 배열을 다시 넣지 않는다. Repeat와 genuine compiled는 실제 호출·독립 reply·raw를 비교한 뒤에만 검증된 SOURCE bytes를 alias로 참조한다. 첫 차이는 실제 divergent request/reply/raw와 primary failure를 emergency에 보존한다. 중간 실패 prefix·stderr·LF fragment·child code/signal을 지우지 않는다. 한도를 넘으면 실행 오류로 중단하며 새 허용값으로 같은 성공 prefix를 반복하지 않는다.

Runtime budget은 이 소비자의 저장 파일 한도다. Git proof archive의 추가 복사와 부모 Fraction allocator의 내부 메모리 한도로 주장하지 않는다. 실행 전에 실제 저장 여유와 fresh 경로를 확인하고 archive의 실제 byte 수를 별도로 기록한다. Source와 emitted provenance, 논리 사례 수와 실제 호출 수, saved output과 process exit는 서로 구분한다.

## 증거 schema의 충돌 해결과 실행 전 잔여 조건

세 병렬 문서의 제안 중 다음 값을 선택한다. 이 목록은 각 문서의 더 단순한 proposal보다 우선한다.

- `pairProgress`는 ABI 문서의 `{jointId,motor,projection,report,calls,completedCalls,lastCall}`에 `projectedRawHex`를 추가한다. 이 값은 실제 projection이 반환한 후에만208B hex이며 그 전에는 null이다. 참조 제안의 간단한 `stage/projection/report` 형태는 사용하지 않는다. `report`는 기존 `makeReport` 반환값이며 전체 PairDiagnostic으로 바꾸지 않는다.
- `contactChecks`는 `{pass,pairIndex,aId,bId,aPositionM,bPositionM,hit}`다. 위치는 기존 detect/solve 호출 전 복사한다. hit는 그 실제 detect 반환값을 즉시 복사한다. 성공 경로는 원래32개 null hit다. 독립 최종 cross-pair4개 확인을 이 producer 호출 개수에 더하지 않는다.
- `negativeZeroPaths`는 request top-level의 `{sourceState,commands,attempt,output}`다. 각 배열은 해당 own-data root에 상대적인 JSON Pointer 문자열이다. 빈 root는 빈 배열이다. Initial-only 요청도 같은 네 키를 쓰며 sourceState만 실제 경로를 포함한다. 나머지 세 배열은 비어 있다. 중복·존재하지 않는 경로·숫자0이 아닌 대상은 protocol INPUT 오류다. Body/command raw와 겹치면 부호도 일치해야 한다.
- 실제 부모 성공 reply9개 키를 새 outer8개 키로 padding하거나 합치지 않는다. 부모 safe refusal shape도 그대로 남긴다. 알려진 원래 오류와 독립 protocol 오류의 code/message를 혼동하지 않는다.
- raw stdout가 한도를 넘거나 LF 없는 불완전 조각이면 resource 실행 오류로 보존한다. 소비자는 새 요청을 보내지 않고 child를 종료한다. 실제로 받은 바이트와 pipe 종료·code/signal·trailing fragment를 기록한다. 완전한 reply/EOF를 주장하지 않는다. 중단 전 prefix를 버리거나 새 budget으로 다시 실행하지 않는다.

새 wrapper의 nested metrics 키·단위·null 규칙, safe failure21개 tuple, 종료 receipt와 controls 수는 아래 부록에서 선택했다. 에이전트 응답이나 추가 승인을 기다리는 상태가 아니다. 실제 채택 기준을 확인한 뒤, 해당 소스의 provider blob·원래 nested 증명 schema·선택한 reference authority/expectedRefusal·protocol controls26개와 실제 provider 관계를 before-code addendum에 기록한다. 이어 실제 작성한 전체 소스와 입력·오류·참조·산출물 관계를 execution freeze에 고정한다. 선택 문서와 실제 소스 고정은 서로 다른 자료다.

현재 단계는 **상세 준비 선택과 native 채택 확인 완료; 새 구현 시작**이다. Integration 화면 검증을 추가 대기 조건으로 만들지 않는다. 확인한 선행 채택 기준의 새 격리 작업 공간에서 파일별로 병렬 구현한다.

## 나중에 남을 제품 검증

이 소비자는 분리된 두 힌지의 첫 전체 월드 검증이다. 접촉과 관절의 상호작용을 통과했다고 표시하지 않는다. #1399의 resting contact 지지·회전 응답, discrete gap·lever arm 일관성은 기존 실패 자료에서 이어갈 별도 모델 질문이다. 원인 판정과 새 법칙은 아직 없다.

현재 공개 엔진의 16-body drops, 8-box stack, fast capsule, joint/contact 조합, replay·restore·lifecycle와 비용 검증은 [Physics-3D-Engine-Target](Physics-3D-Engine-Target)의 별도 완료 조건이다. 물·입자 시각 시뮬레이션과 cloth 등 extension 목표도 로드맵에 남긴다. 이 World 계약이나 분리 보고 GO를 그 목표의 완료로 표시하지 않는다.

## Controls의 최종 선택

연결된 controls 문서를 사용하되 다음 선택이 그 문서의 제안보다 우선한다.

- Public constructor1회, private constructor29회(거절17회·짧은 World12개)다. Dispose 전 step27회에는 admission 거절8회와 calculation 진입 최대19회가 있다. Dispose 후 bad-dt step1회를 더해 전체 step attempt 최대28회다. 실제로 setup이 실패하면 도달한 개수만 기록한다. Source/반복/실제 compiled 각각 실행하며 main1,200단계와 분리한다.
- DATA-only step-limit helper3회 제안은 제외한다. 테스트를 위해 새 guard export나 accepted cursor setter를 만들지 않는다. 기존 MAX_STEPS guard를 보존하며3,600단계의 실제 limit 도달은 이 소비자에서 미검증이다.
- Snapshot은 ABI의 `getTransactionSnapshot()`과12개 키를 사용한다. controls 제안의 `getTransactionStore`, `jointStates`, `disposed`, key-sorted Map은 쓰지 않는다. 실제 insertion-order entry 배열과 `joints`를 유지한다. Dispose 후 이 getter도 같은 DISPOSED 오류다.
- W0는 positive query4회·negative query3회, Dispose 후 query2회다. Dispose 후 getter3회와 step1회는 별도다. Copy 검사·store getter의 실제 호출 수는 proof에서 기록한다. 의도한 계산이나 law 호출을 추가하지 않는다.
- New body array dense 검사는 원래 array/길이 검사 뒤, body map 전에 적용한다. Hole은 새 World profile 오류다. Body/hinge 순서와 default와 같은 explicit inertia override presence는 새 profile로 거절한다. 기존 G configuration/group 검사에서 먼저 거절한 gravity/mass/Z/axis/motor/membership 오류는 원래 `private multi-hinge reference requires literal HINGE2 fixture` 문구를 유지한다. 기존 오류를 새 문구로 바꾸는 bridge를 만들지 않는다.
- `.1` overload는 독립 참조로 실제 순서대로 분류한다. B1의 angularImpulse100000은 원래 command 한도 안에서 late angular-movement 거절을 검사한다. 실패 뒤 empty recovery의 원본은 retained accepted cursor1이다.
- Observer Error/object/null control은 exact identity·callback·전체 retained store를 검사한다. Unknown marker를 참조 요청으로 직렬화하지 않는다. setup은 독립 검증하고, throw 시 안전한 copied attempt를 별도로 보존한다. 해당 throw control을 새 accepted numerical step이나 독립적인 unknown-value 수치 검증으로 표시하지 않는다.
- 기본 no-contact profile에서 activePairs/persistentPoints는 비어 있고 sleepFrames는0이다. 이 값들의 유지 검사를 nonempty cache rollback의 증명으로 확대하지 않는다. Genuine pair1 projection 실패를 만들기 위해 몸체·solver를 주입하지 않는다. 도달한 실제 progress만 보존한다.

## 마지막 실행 경계

선택 참조 문서의 새 nested 키·단위·null 규칙과 safe wrapper21개 failure tuple을 선택한다. 원래 helper 제안의 이전 pairProgress·budget는 위 Root 선택으로 대체한다. Initial-only 요청과 World-step 요청, 실제 부모9-key 성공/거절 shape는 서로 구분한다.

Overflow가 생기면 새 요청0회, stdin 종료, child SIGTERM을 적용한다. close가5,000ms 안에 오지 않으면 SIGKILL을 한 번 적용한다. 그 뒤5,000ms 동안 실제 pipe 종료를 수집한다. 아직 종료되지 않은 pipe는 incompleteEOF로 기록하고 새 physics 실행을 시작하지 않는다. 받은 실제 raw prefix·primary failure·signal·LF fragment를 보존한다. 기록하려던 전체 payload의 hash를 실제 저장된 prefix의 hash로 바꾸지 않는다. 각 transport buffer 한도8MiB, emergency 저장8MiB는 별도 상한이다. complete child drain이 없으면 GRAPH_NO_COMPLETE_PROOF다.

전체 source/input/error/reference/schema/emitted 핀은 실제 채택한 새 작업 공간의 before-code addendum과 execution freeze에서 각각 기록한다. 정확한 선행 native adoption은 확인했다. 새 World의 전체 실행 소스 고정과 실제 검증은 별도다. 위 문서는 상세 준비 결과이며 새 World 구현·계산을 실행하지 않았다.

## 부록과 검토 한계

- [선택 API·단계·진단·트랜잭션](Physics-Hinge-World-Selected-ABI)
- [선택 입력·오류·수명·복사 검증](Physics-Hinge-World-Selected-Controls)
- [독립 참조·wire·자료·자원 선택](Physics-Hinge-World-Selected-Reference)
- [authority·expectedRefusal·initial 문법 선택](Physics-Hinge-World-Selected-Reference-Grammar)
- [독립 protocol controls26개](Physics-Hinge-World-Selected-Protocol-Controls)
- [이전 계약 제안과 수치 기준](Physics-Hinge-Two-Body-Pair-World-Contract-Proposal)

세 문서의 source-only 검토에서는 구체적인 물리 법칙 충돌을 찾지 않았다. 실제 실행 검증은 아니다. `angularUpdates=4/freeIntegrations=4`는 몸체별 작업 수이며 전체 단계는 각각 한 번이다. 전체4몸체 frame은 해당 단계가 모두 끝나야 존재한다. 실패한 angular/free 단계의 임의 중간 몸체 자세를 모두 저장했다고 주장하지 않는다. `contactChecks`는 실제 detect가 반환한 뒤에만 추가한다. `hit:null`은 실제 null 반환이다. 미도달·던진 호출을 null hit로 채우지 않는다. `pairStats`의 attempted 수와 반환 기록의 수가 다를 수 있다.
