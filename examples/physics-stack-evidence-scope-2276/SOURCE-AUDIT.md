# Original evidence population: 소스 감사

결론: 공유280MiB main 한도는 원래 조건이다. 그대로 유지한다. 원래 매 단계의 전체 물리 기록·각 phase 참조 결과·body 원시 바이트·첫 실패는 필수였다. 반면 모든 성공 단계의 별도 RPC 요청/응답 원문과 전체 수치 occurrence의8바이트 sidecar 저장은 후일 private harness/complete 프로필에서 추가됐다. 첫16의195 wire-pair 비교도 후일 합성 검증 조건이다. 현재 동결 계약에는 이 추가 조건들이 명시돼 있으므로, 이 감사는 이를 삭제하거나 기존 NO_GO를 변경하는 승인이 아니다.

Root 후속 결정: 원래 저장 조건을 변경하지 않고, 새 코덱 개발도 진행하지 않는다. 진행 중인 stationary normal solver의 별도 물리 프로필은 이 감사의 승인 범위가 아니다. 기존 엄격한 full raw RPC+record JSON+ALLword 조건과 과거 NO_GO는 유지한다.

범위: 소스 읽기와 새 문서 작성만 수행했다. import/solver/World/reference/test/compiler/codec/압축/복호화/새 수치 실행은0이다. 큰 아카이브를 읽지 않았다. 저장 효과·성능·280MiB 적합성은 측정하거나 예측하지 않았다. Root가 별도 next contract를 결정한다.

## 1. 원래 한도와 필수 증거

| 항목 | 확인한 원래 근거 | 해석 |
|---|---|---|
| ALIGNED/OFFSET/YAW, 각1200, 첫 실패 중단 | `physics-stack-solver-2276/trajectory-contract.md:18–24,51–54` | 성공한 tail 재선택이나 실패 후 상태 전진은 불가하다. |
| 모든 시도·실패·body 원시 이진 operands | 같은 계약`:63–67` | 신선한 출력, 원본 recorder, source 전후 hash, case180s guard를 요구한다. |
| 모든 velocity/KKT·strict contacts·position·ledger·quality gate | 같은 계약`:36–54` | 저장 방식 검토가 독립 참조 호출이나 공차를 줄이는 근거는 아니다. |
| 전체 PRE/HYP·4phase·모든 row/result/reference/counter/failure/prior accepted | `physics-rigid-full-pair-position-world/CONTRACT.md:43,55` | 큰 참조 결과나 row를 성공 플래그/해시만으로 대체할 근거가 없다. 같은`:55`는 full36 exact Gram dump를 매 단계 추가하지 말라고 명시한다. |
| main280MiB, fixed20MiB, normal300MiB, 별도 emergency2MiB | 같은 계약`:55` | 이번 감사는 cap을 올리거나 별도 scene pool을 만들지 않는다. |

공유 여부는 실행 소스에서 확인된다. `trajectory-run.mjs:62`가 scene loop 밖에서 `budget={bytes:0}`를 만든다. `:120–121`가 세 scene recorder에 같은 객체를 준다. `:233`가 하나의 누적 bytes를 기록한다. 원 recorder `physics-rigid-full-pair-position-world/archive.mjs:10`은 그 객체에 JSON gzip+raw gzip를 합산하고293601280B를 검사한다. `physics-contact-boundary-2276/world-consumer.mjs:16,25–26`도 동일하다. 더 이른 full-pair `runner.mjs:15,26,33–34`도 graph/scene 바깥 budget 하나를 전달한다. 따라서280MiB를 scene마다 새로 주는 해석은 소스로 지지되지 않는다.

현재 complete는 이보다 더 좁은 ALL-normal 공유280MiB(고정 메타데이터도 포함)를 선택했다. 근거는 `physics-stack-complete-2276/CONTRACT.md:246–258`, 실행은 `run.py:81–92`의 단일 budget 파일이다. 이전 엄격 프로필의 실제 실패는 그대로 남는다.

## 2. 원래 실제 recorder가 쓴 내용

`physics-rigid-full-pair-position-world/archive.mjs:4–6`의 rawBodies는 body마다 position3/velocity3/orientation4/angularVelocity3, 총13개 DoubleLE=104B를 쓴다. `:9`의 capture는 state/global/warm/cache/position/attempt/ledger를 포함한다. `:10`의 writer는 Native JSON 한 줄과 전달받은 raw 배열을 각각 gzip로 저장한다. 원래도 JSON 내부 body와 별도 body raw 사이에 표현상 중복은 있었다. 새 감사가 이를 원래 없던 중복으로 분류하지 않는다.

`trajectory-run.mjs:139`는 initial state와 quality, initial raw bodies를 저장한다. `:213–217`은 before, event, pointOperandF64leHex, firstPatchComparison, velocityCheck, contactGeometry, stages, positionAttempt, positionCheck, ledgerCheck, quality, producerError, after, failure를 한 JSON record에 저장한다. raw에는 before, 각 stage ledger의 free/velocity/final, after를 넣는다. stage별 존재 필드의 순회이므로 이를 임의로 “정확히4개의 유일한 배열”로 축소해서 해석하면 안 된다.

더 이른 full-pair `consumer.mjs:30–31`은 before/stage raw뿐 아니라 attempt PRE/HYP raw도 별도 추가한다. 같은`:33`은 emergency에 acceptedRawHex와 reached stages/attempts를 넣는다. 따라서 원래 body raw/PRE/HYP bits 요구를 단순 JSON만 남기는 방식으로 없앨 수 없다. 중복 frame을 참조화하려면 원래의 순서·길이·모든 raw 바이트를 다시 복원하는 별도 검증이 필요하다.

각 원래 참조 호출과 저장된 결과는 다음과 같다.

| 작업 | 원래 실제 호출 | 원래 record 안의 결과 |
|---|---|---|
| Normal KKT | `trajectory-run.mjs:160–162` | `velocityCheck`, `event` (`:216–217`) |
| Strict contacts | `:165–177` | `contactGeometry`, source points/event/stages |
| Position world | `:179–188` | `positionAttempt`, `positionCheck`; 모든 problem/row/result/PRE/HYP |
| Phase ledger | `:190–197` | `stages`, `ledgerCheck`; before/free/velocity/final과 impulses |
| Quality | `:133–139,199–204` | initial/step `quality`, state/after; 실제960 baseline |
| 첫 실행 실패 | `:220–222` | emergency의 failure/stages/attempts/events/accepted |

수정된 boundary consumer도 `world-consumer.mjs:107–112`에서 같은 전체 record/raw를 보존하고,`:117–119`에서 first/secondary execution failure와 emergency를 보존한다. 원래 기록은 얇은 status-only 로그가 아니다.

## 3. 원본과 나중 private population의 구분

| 저장·검증 요소 | 원본 소스 | 나중 소스 | 분류 |
|---|---|---|---|
| 모든 참조 호출과 전체 parsed reply | `observer.mjs:8–16`가 요청 JSON 전송 후 응답 JSON.parse; trajectory record에 reply 보존 | current record에도 그대로 reply 보존 | 원래 필수 coverage |
| 성공 단계마다 raw RPC request/reply 파일 | 원 observer에는 file/archive 호출이 없다 (`physics-rigid-contact-diagnostic/observer.mjs:1–20`) | library `io.mjs:54,61–64`가 별도 파일로 저장; complete `reference.mjs:18–19,24–25`가 전 요청/응답을 stream append | 후일 추가한 별도 wire population |
| record의 모든 numeric occurrence 해시 | 원 recorder는 JSON/raw hash만 (`archive.mjs:10`) | library `io.mjs:10–15,93–103`은 모든 numeric occurrence를 해시한다. 당시 JSON/raw 파일 외에 ALLword buffer 자체는 저장하지 않는다. | 후일 private parity 검증 |
| record의 모든 numeric occurrence8B 저장 | 원 recorder에는 전체 word sidecar가 없다 | native-CRC `archive.mjs:48–60`은 JSON+ALL DoubleBE words+bodyRaw+pointRaw를 물리적으로 함께 저장·복원 | 후일 complete 저장 표현 |
| 최초 ALIGNED1 문제 bits | 원 trajectory `:156–159`, 계약`:70–85` | 그대로 원래 gate에 해당 | 원래의 first-patch identity; 첫16 wire와 다름 |
| 첫16 wire195쌍·전체 record parity | 최초 trajectory 계약에는16-prefix/195pair 규정이 없다 | hard16 pipeline `CONTRACT.md:35–53`; complete `CONTRACT.md:192–198`; driver`:58–73,139–150` | 후일 새 합성 검증의 동결 조건 |
| 전체1200 wire byte 복원 | 원래는 live 호출+parsed result record; 별도 raw wire가 없음 | complete `CONTRACT.md:181–190,208–228`, `reference.mjs:18,25`, driver`:137–147` | 현재 complete 프로필은 추가 coverage를 명시적으로 요구 |

위 “후일 추가”는 현재 마음대로 없애도 된다는 뜻이 아니다. 현재 complete `CONTRACT.md:136–138,186–190,239–258`은 모든 record/raw/RPC 저장과 전체 수치 bits 복원을 조건으로 고정했다. 새 원본-범위 프로필을 선택하려면 Root의 별도 명시 결정과 새 source freeze가 필요하다. 이전 frozen source와 NO_GO는 그대로 보존해야 한다.

## 4. 현재 full record가 이미 포함하는 구성

현재 `driver.mjs:96–104`에서 request를 만들고, 반환된 네 parsed reply를 record에 넣는다. record의 `prepared`에는 후보 native 문제/result/position attempt/point ledger/phase bodies가 있다. 구체적 중복 관계는 다음과 같다. 이는 값의 출처 대응이지 모든 raw wire span의 바이트 동일성을 증명하지 않는다.

- contacts request의 freeBodies/pointLedger는 `prepared.diagnostics`에 있다.
- world request의 problem/rowSelections/result/PRE/HYP는 `prepared.diagnostics.positionAttempt`에 있다. PRE/HYP raw hex는 별도 body word들과 대응한다.
- ledger request의 before/free/velocity/final/points는 prepared와 prior/candidate bodies에 있다. material/config/scene/step/outcome/gravity/dt/actions 등 wrapper 필드도 복원 범위에 포함해야 한다.
- quality request의 state는 `after`, initial은 initial record, referenceAt8s는 실제960 commit state다. 후속 step의 raw request에는 반복 initial/baseline이 포함된다.
- contacts/world/ledger/quality replies는 각각 `contactGeometry/positionCheck/ledgerCheck/quality`로 record 안에 있다.
- pointOperandF64leHex와 별도 pointRaw도 같은 실제 point/normal words를 표현한다. bodyRaw와 record의 여러 phase/body occurrence도 중복될 수 있다.

현재 `driver.mjs:63–66`은 record의 모든 숫자를 다시 DoubleBE로 해시/저장하고,`:141–150`은 복원된 body/point raw 및 최초16의 JSON/word/raw/wire를 독립 비교한다. 이는 JSON에 body가 있다는 이유로 원래 raw bits 요구가 자동 충족된다고 가정하지 않는 설계다.

raw RPC와 record JSON은 다른 직렬화다. 원 geometry Python은 `trajectory-reference.py:120`의 기본 json.dumps spacing/escaping을 쓴다. Position Python은 `reference.py:359`의 compact separators를 쓴다. Node record는 JSON.stringify다. `physics-stack-evidence-refs-2276/inspect-record.mjs:34–43`도 canonical projection==record target과 원 raw span 존재 여부를 별도로 검사한다. parsed reply가 record에 있다는 사실만으로 원문 공백/소수 표기/Unicode escape/키 순서/개행까지 복원됐다고 할 수 없다. 해시만 남겨도 원문이 복원되는 것은 아니다.

## 5. Lossless signed-zero metadata의 성립 조건과 남은 검증

Finite binary64를 Native JSON으로 쓸 때 특히 -0 부호가 소실된다. 원 trajectory 계약`:72–85`가 실제 이 문제와 point/normal raw hex 추가를 기록한다. 원래부터 JSON0만으로 원래 normal-zero bits를 인증하지 않았다.

전체8B sidecar의 물리 저장을 sparse -0 occurrence metadata로 바꾸는 방안은 별도 lossless 표현 후보로 검토할 수 있다. 단, 다음 조건이 모두 필요하다. 여기서는 구현·일반 적합성·추가 PASS를 주장하지 않는다.

1. 입력은 현재 허용된 finite plain record graph여야 한다. Native JSON byte sequence와 키/배열 occurrence 순서를 보존한다. nonzero finite Number의 JSON parse 왕복이 원래 DoubleBE와 같음을 모든 leaf에 대해 검증한다. 비유한 값·BigInt·undefined 처리·accessor/proxy·sparse/cycle를 새로 허용하지 않는다.
2. -0은 값별 집합이 아니라 각 구조적 occurrence별 ordinal/path로 기록한다. 같은 객체가 여러 JSON 경로에 나타나면 각각 필요하다. 복원 후 기존 ALL8B sidecar를 원래 순서로 재생성하고 기존 word hash와 모든 바이트를 비교해야 한다. 부호 정보를 원래 JSON0에서 나중에 추측할 수 없다.
3. 원래 body/PRE/HYP/phase/point raw 요구는 남는다. 물리적으로 참조화해도 기존 raw concatenation의 순서·길이·바이트가 전부 복원돼야 한다. signed-zero map만으로 누락한 raw phase나 row/result/reference를 대체하지 않는다.
4. JSON alias identity는 별도다. 현재 fingerprint는 type/key/UTF16/alias IDs/DoubleBE를 본다 (`fingerprint.mjs:5–21`). JSON+zero metadata는 alias 복원을 자동 제공하지 않는다. live producer pre/post clone fingerprint와 failure metadata의 정직한 aliasIdentityRestored=false를 유지한다.
5. 이미 존재하는 failure helper는 finite graph를 검사하고 occurrence별 -0 path를 저장·복원한다 (`failure-evidence.mjs:30–63,66–87`). 이는 bounded failure envelope에 대한 근거다. full record archive·stream framing·사전할당·backpressure·CRC/SHA·초과/잘못된 path·truncation·새 합성 prefix를 자동 인증하지 않는다.
6. 최초16의 전체 JSON·ALLword·body/point raw·195 wire-pair parity를 그대로 유지하는지 새 고정 controls와 fresh combined prefix로 확인해야 한다. 모든1200 raw RPC를 생략하는 원본-범위 프로필은 단순 sparse-zero 인코딩과는 별도의 population 결정이다. 현재 complete 계약에서는 허용되지 않는다.

따라서 가능한 후속 판단은 둘로 분리한다. (A) 현재 full logical population을 전부 재생성하는 lossless 표현 변경, (B) 원래 필수 population을 따르는 새 프로필과 후일 추가 wire population의 별도 범위 선언. 어느 쪽도 이 감사가 승인하지 않는다. Root가 next contract와 검증을 정한다. 공유280MiB·공차·모든 독립 gate와 첫 실패는 유지한다. 기존 엄격 profile 및 종료된 codec 후보의 NO_GO를 지우거나 재분류하지 않는다.

## 읽은 소스 기준

모든 경로는 이 worktree의 `examples/` 아래다. 표의 짧은 `archive.mjs`, `observer.mjs` 등은 각 행에서 명시한 디렉터리를 뜻한다. SOURCE-READBACK.json은 읽은 파일의 현재 바이트 hash를 묶는다. 실행 증거가 아니라 문서 근거의 소스 식별이다.
