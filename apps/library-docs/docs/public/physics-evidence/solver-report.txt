---
work_id: physics-stack-solver-2276
artifact_type: bounded-solver-verification-report
status: first_patch_pass_trajectory_geometry_no_go
owner_role: independent-algorithm-work
source_request: preserve HOLD and tolerances; solve the same32-contact equilibrium before stack expansion
last_updated: 2026-11-01
---

# 32접촉점 솔버 후보와 적층 검증

같은 32개 접촉점의 첫 ALIGNED 패치에서 평형 검증을 통과했다.
원래 적층의 장시간 안정성은 **NO_GO**다. ALIGNED의 독립 수락 범위는
첫 1단계다. OFFSET과 YAW는 첫 단계의 엄격한 접촉 직선 witness 검사에서
중단했다. 소스와 실제 컴파일된 후보는 같은 결과와 이진 body 기록을 냈다.
이 일치는 물리 정확도와 별도 증거다.

브랜치는 `codex/physics-stack-solver-2276`, 부모는
`7105c4755fcbf4f0cbc764b864a55bf550f741b3`다. 변경 범위는 이 새 디렉터리다.
기존 Physics·Studio·제조 HOLD, Motion 은퇴, 공개 body 제한, 원본 코드와
최초 실패 기록을 유지했다. 새 런타임 의존성·추가 다운로드·보안 변경은 없다.
원격 게시나 업로드는 하지 않았다.
GitHub 게시·제품 통합·공개 패키지 API 변경·화면·장비 제어는 실행하지 않았다.

## 구현과 고정 기준

`candidate.ts`는 질량·관성으로 가중한 정상 방향 속도 QP를 푼다.
고정된 접촉 위치에서 운동에너지 norm의 변화가 최소인 속도를 구한다.
QR로 독립 행 기저를 만들고, 제한된 active set으로 비음수 충격량을 구한다.
검증에는 종속 행을 포함한 실제 32개 행을 모두 사용한다.
중력·지지 순서·기준 평형해·원하는 정지 자세를 솔버에 넣지 않는다.

SI 단위, 오른손 XYZ 좌표계, A에서 B 방향의 단위 법선을 사용한다.
충격량은 A에 `-lambda*n`, B에 `+lambda*n`으로 작용한다.
접촉 위치·관성은 world 좌표다. 솔버는 고정 pose의 순간 속도 문제이며
시간 간격을 입력받지 않는다. 적층 어댑터의 기존 시간 간격은 1/120 s다.

초기 분해를 포함한 QR 상한 64, 외부 반복 상한 64를 유지한다.
rank 기준은 1e-12다. 닫힘 속도·음수 충격량·상보성·stationarity·독립 상태
오차는 각 계약의 SI 단위에서 1e-10이다. 접촉 기하의 거리 기준 1e-9 m,
Decimal80/120 비교 1e-60, 기존 위치 보정·품질 기준도 유지했다.
정확한 입력 한계와 모든 연산 상한은 `candidate-contract.md`에 있다.
새 QR의 연산 비용은 기존 64회 점별 sweep과 다르다. 같은 성능을 주장하지 않는다.

접선 충격량은 0이다. 하중이 있는 모든 행의 접선 속도가 1e-10 m/s 이하여야
기존 마찰 1/.7에서 이 결과를 수락한다. 일반 마찰 솔버로 확대하지 않는다.

## 같은 첫 패치의 독립 평형 비교

원본 ALIGNED의 initial+step1 기록과 raw10296 bytes를 인증했다.
전체 압축 입력의 hash와 이전 전체 decoded 인증 기록도 확인했다.
기존 Fraction 평형 증명은 body별 최종 속도·각속도·순충격량·순토크의 기준이다.
그 기준은 runtime 솔버에 전달하지 않는다. 개별 점의 하중 분포는 유일하지 않아
한 가지 코너 분포와 동일할 것을 요구하지 않는다.

독립 검증기는 후보의 Jacobian·QR·잔차 함수를 사용하지 않는다.
실제 좌표와 부호가 있는 충격량으로 body 변화, 점 속도, 일과 운동에너지의
관계를 다시 계산한다. 이는 장시간 에너지 보존 검증이 아니다.

| 측정값 | 독립 계산의 최대 오차/잔차 | 고정 기준 |
| --- | ---: | ---: |
| 닫힘 정상 속도 | 3.885780586188048e-16 m/s | 1e-10 m/s |
| 음수 정상 충격량 | 0 N s | 1e-10 N s |
| 절대 상보성 | 9.529876887626191e-17 J | 1e-10 J |
| 기준 평형 속도 | 1.8041124150158794e-16 m/s | 1e-10 m/s |
| 기준 평형 각속도 | 4.996003610813204e-16 rad/s | 1e-10 rad/s |
| 순충격량 | 1.8041124150158794e-16 N s | 1e-10 N s |
| 순토크 충격량 | 2.0816681711721685e-17 N m s | 1e-10 N m s |
| 하중 행의 접선 속도 | 1.1775693440128314e-16 m/s | 1e-10 m/s |
| 충격량 일의 일치 오차 | 3.469446951953614e-18 J | 1e-10 J |

측정 rank는 48 DOF 중 24였다. QR 1회, 외부 반복 1회, active 변경 0회였다.
dot 2930회/스칼라 곱 129252개, vector update 72576개를 기록했다.
후보 자체 stationarity 측정은 1.942890293094024e-16 sqrt(J)다.
후보 자체 잔차와 위 독립 재구성 잔차는 별도 값으로 보존했다.

기존 최초 진단 행의 닫힘 속도 0.0040639119536177174 m/s와 상보성
0.0005373978089614024 J는 지우지 않았다. 위 표는 새 후보의 전체 32행 최대다.
이 비교가 기존 8-box의 나중 붕괴 원인 전체를 증명하지는 않는다.

핵심 기록은 `evidence/first-source-02/result.json`과
`evidence/first-emitted-03/result.json`이다. 앞선 source01/emitted02도 보존했다.
두 소스 실행은 각각 2회 반복했고, 두 emitted 실행은 각각 1회 실행했다.
실행 중 반복 비교, 입력 불변성, 독립 평형 비교가 모두 통과했다.

## 통과 범위에서 수행한 원래 적층 확장

기존 private World의 적분기·접촉 생성·단일 full-pair 위치 보정은 그대로
사용했다. 기록한 source transform이 속도 solve 전체와 warm 적용만 대체한다.
후보는 매 단계 cold solve를 수행한다. 공개 World를 변경한 결과가 아니다.
어댑터는 기존 1kg, half-.25m 정육면체 8개와 정적 바닥, 회전 불변 관성 24I,
원래 재료와 실제 접촉점 수를 검사한다. 접촉점을 버리거나 합치지 않는다.

| 사례 | 시도/World 내부 수락 단계 | 독립 수락 prefix | 첫 새 NO_GO | 해당 풀이의 QR 수 |
| --- | ---: | ---: | --- | ---: |
| ALIGNED | 2/2 | 1 | 2단계, 31/32행 직선 witness 실패 | 1 |
| OFFSET | 1/1 | 0 | 1단계, 14/32행 직선 witness 실패 | 7 |
| YAW | 1/1 | 0 | 1단계, 32/32행 직선 witness 실패 | 5 |

ALIGNED 첫 단계도 QR 1회였다. 도달한 네 풀이의 정상 방향 KKT, 독립
위치 보정 기준, phase ledger, 해당 시점의 원래 품질 검사는 통과했다.
최대 닫힘 속도는 7.902537135448789e-16 m/s, 상보성은
1.5356404625889343e-16 J다. 이 통과가 접촉 기하 실패를 무효화하지 않는다.

접촉점의 slab 거리와 support gap은 약 1e-17~1e-16 m로 거리 기준 안에
있었다. 그러나 경계 밖 점을 지나는 법선 직선이 엄격한 OBB side slab과
교차하지 않았다. 교차가 없으므로 midpoint witness도 만들 수 없었다.
80/120자리 판정은 일치했다. 이를 거시적 기하 오류나 붕괴 원인으로
단정하지 않는다. 정확한 경계 수치는 `newgeometry-nogo-analysis.md`에 있다.
검사 조건이나 기하 생성기를 바꾸어 이 실패를 통과시키지 않았다.

최종 기록은 `evidence/world-source-03/result.json`과
`evidence/world-emitted-03/result.json`이다. 사례별 decoded JSON/raw body
hash, 수치 결과와 최초 실패가 일치한다. 이전 source02/emitted02도 같은
결과이며 그대로 남겼다. emitted graph는 실제 tsc 출력의 후보·검증기·어댑터를
사용한다. 기존 World와 Physics helper는 소스다. 전체 공개 패키지의 emitted
빌드나 API 통합 통과로 해석하면 안 된다.

모든 사례가 8초 이전에 중단됐다. 원래 8~10초의 1200단계 품질 판정과
장시간 에너지·시간 간격 수렴은 검증하지 못했다. 원래 ALIGNED960,
OFFSET315, YAW243 실패, 공개 3-box 실패, 2-hinge NO_GO는 유지한다.

## 파일과 실제 실행

| 단계 | 변경 파일 | 실행과 결과 |
| --- | --- | --- |
| 계약·입력 | CONTRACT.md, 각 contract, extract-fixture.py | fixture-01 인증 통과 |
| 솔버·기준 | candidate.ts/test, verification.ts/test, first-frame.ts | 후보 13개+독립 검증 14개 테스트 통과; 같은 패치 평형 통과 |
| 적층 연결 | world-adapter.ts, trajectory-entry.ts, trajectory-run.mjs | 소스/실제 emitted 후보에서 위 NO_GO 재현 |
| 기하 기준 | trajectory-reference.py, geometry 분석 문서 | 기존 독립 함수·기준 유지; 모든 실제 행 검사 |
| 실행 오류 | trajectory-errors.mjs/test | 오류 경로 3개 통과; 기존 물리 실패와 후속 실행 오류를 각각 보존 |
| 기록 | run.mjs, audit.py, evidence/ | 명령·종료 상태·source hash·최초 실패·수치 보존 |

서로 다른 테스트는 총 30개다. 단계별 소스/컴파일 반복을 포함한 테스트 실행은
103개다. 첫 fixture solve 6회, World의 후보 호출은 전체 시도에서 17회였다.
이 호출 수에는 첫 영 부호 비교 실패의 1회와 실행 경로 수정 후의 재검증을
포함한다. 단위 테스트 내부의 후보 호출 수와는 별도다.

실제로 실행한 주요 명령은 아래와 같다. Node22 경로는 설치된 도구를 사용한다.
이미 사용한 run ID는 덮어쓸 수 없다. 재현에는 새 ID를 사용한다.

```sh
NODE=/Users/user/.volta/tools/image/node/22.19.0/bin/node
$NODE examples/physics-stack-solver-2276/run.mjs fixture fixture-01
$NODE examples/physics-stack-solver-2276/run.mjs source-tests source-tests-02
$NODE examples/physics-stack-solver-2276/run.mjs source-first first-source-02
$NODE examples/physics-stack-solver-2276/run.mjs emitted first-emitted-03
$NODE examples/physics-stack-solver-2276/run.mjs error-tests error-tests-01
$NODE examples/physics-stack-solver-2276/run.mjs world-source world-source-command-03
$NODE examples/physics-stack-solver-2276/run.mjs world-emitted world-emitted-command-03 examples/physics-stack-solver-2276/evidence/world-source-03/result.json
python3 -B examples/physics-stack-solver-2276/audit.py --output examples/physics-stack-solver-2276/evidence/audit-01.json
```

작업 디렉터리는 `/Users/user/Documents/ChatGPT/barocss-physics-motion-2276`이다.
무거운 실행은 기존 lane gate의 heavy 슬롯을 획득하고 같은 shell에서 해제했다.
실제 전체 인수·Node 경로·종료 코드는 각 command 디렉터리의 commands.json에 있다.

## 보존한 준비 실패와 제한

- first-emitted-01: TS7006 타입 표기 오류. callback 타입만 명시한 후 새 시도로 통과했다.
- world-source-01: JSON0과 실제 법선 -0의 strict 비교 실패. 원본을 보존했다.
  새 비교는 법선 영 부호 차이만 따로 기록한다. body raw hash와 나머지 값은
  정확히 일치해야 한다. runtime 값을 바꾸지 않는다. 새 point/normal은 f64 hex도 저장한다.
- world-emitted-01: type-only import가 기존 MJS 선언 누락 graph를 따라가 strict 빌드에
  실패했다. 새 어댑터에서 같은 구조의 local DTO 타입으로 분리했다. 기존 graph는 미수정이다.
- 검토에서 발견한 실행 오류 은폐 경로는 고쳤다. 이전 물리 실패를 유지하면서 후속
  실행 오류도 기록하고 중단한다. 관측한 기존 정상 응답의 수치 결과는 바뀌지 않았다.
- `python3 -B .ai/check.py`는 PyYAML 부재로 validation 전에 실패했다.
  의존성을 설치하지 않았다. 이 legacy 구조 검사는 통과로 보고하지 않는다.

각 실행의 source.json과 graph.json이 당시 파일 버전을 식별한다. 타입·검증 API·
실행 경로 수정의 순서는 계약 문서에 기록했다. 최종 source/evidence 목록과 hash는
manifest.json에, 범위·기존 입력 보존·기록 비교는 evidence/audit-01.json에 있다.

## 다음 의존성과 남은 NO_GO

다음 단계는 고정된 접촉점의 side-slab 경계와 직선 witness를 함께 만족하는
접촉점 생성·증명 방법이다. 기존 실패와 엄격한 판정을 보존한 별도 설계가 필요하다.
그 전에는 적층을 더 진행하거나 기준을 완화하지 않는다.

실행으로 검증한 지원 범위는 명시된 첫 32점 ALIGNED 패치, 테스트한 작은 수학
사례, ALIGNED의 독립 1단계 prefix다. 일반 Coulomb 마찰, 임의 다물체 접촉,
공개 9-body API, 2-hinge 재활성화, 제어, 전체 엔진 완성은 NO_GO다.
실제 장비와의 일치·제조 안전성은 실측 검증이 없다.
