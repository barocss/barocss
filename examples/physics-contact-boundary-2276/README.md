---
work_id: physics-contact-boundary-2276
artifact_type: bounded-contact-construction-and-docs-review-report
status: strict-contact-fixtures-and-prefix-pass_full-stack-no-go
owner_role: independent-algorithm-work
source_request: fix contact boundary construction without relaxed gates or legacy paths; review Physics and Motion documentation
last_updated: 2026-11-01
---

# 접촉 경계 수정과 문서 검토

현재 `face-contact.ts`의 접촉점 구성을 직접 수정했다. 이전 구현 선택 옵션이나
호환용 fallback은 추가하지 않았다. 기존 HOLD, 공차, 최초 실패 기록은 보존했다.
작업 브랜치는 `codex/physics-contact-boundary-2276`, 부모는
`8d7474ba0b4df5367dbeee93b3a95cb777dcac48`이다. 문서 사이트 코드는 수정하지 않았다.

## 변경과 수학적 기준

기존 clipped 점·선택·중복 제거·순서·ID·법선을 유지한다. 선택한 점의 최종
binary64 중점을 실제 두 OBB의 엄격한 선 구간으로 검증한다. 정규화된 quaternion의
회전 행렬은 정확한 유리수의 `q·q` 분모로 계산한다. slab에는 여유를 더하지 않는다.

점이 경계를 만족하지 못하면 같은 patch 내부 방향의 인접 표현 값으로 구성한다.
각 점에 최대16회이며, 각 surface witness와 중점의 이동은 기존1e-12m 이하다.
직선의 실제 A 출구/B 진입 면, 실제 surface 중점 거리도 함께 검사한다.
구성한 이상적 점이 아니라 반환할 float 중점을 다시 검증한다. 인증할 수 없으면
기존 NUMERIC_LIMIT로 거부한다. 정상 방향 솔버와 위치 보정 알고리즘은 변경하지 않았다.

고정 상한은 face당 유리수 연산200000, metered BigInt 연산2000000, 정수16384bits다.
GCD 반복도 계수한다. 고정 차원 검증·IEEE 필드 읽기·bit 길이 확인은 별도로 제한된다.
독립 기준은 원래 Decimal80/120 함수다. 엄격 교차 boolean, 거리1e-9m,
정밀도 차이1e-60, paired witness1e-12m, 정상 속도·상보성1e-10 기준을 유지했다.
이는 성능이나 모든 기하 입력의 완전한 지원을 증명하지 않는다.

## 실패점부터 수행한 독립 검증

baseline-01은 원래4자세/128행의 실패77개를 재현했다. 첫 수정은 이128행을
소스와 실제 tsc 출력에서 통과했지만, 다음 World 실행에서 다른 조건 누락이 드러났다.
ALIGNED4의 한 행은 두 상자와 교차해도 실제 surface 중점 오차가0.168962m였고,
OFFSET2에서는0.125m 오차와 별도1행의80/120자리 판정 불일치가 나왔다.
첫 수정은 이 확장 사례를 통과하지 못했다. 그 코드 버전·기록을 그대로 보존했다.

두 자세를 추가한 baseline-02는6자세/192행에서79개 실패,1개 미해결,
112개 통과를 재현했다. 미해결 행을 통과로 처리하지 않았다. 두 번째 수정은
누락됐던 실제 중점·출구/진입 면 검사를 추가했다. 공차와 연산 상한은 그대로다.

| 고정 자세 | 수정 전 실패/미해결 | 최종 독립 결과 | 최대 점 이동 |
| --- | ---: | --- | ---: |
| ALIGNED1 | 0/0 | 32/32 통과 | 0m |
| ALIGNED2 | 31/0 | 32/32 통과 | 3.925231146709438e-17m |
| OFFSET1 | 14/0 | 32/32 통과 | 3.925231146709438e-17m |
| YAW1 | 32/0 | 32/32 통과 | 3.1031676915590914e-16m |
| ALIGNED4 | 1/0 | 32/32 통과 | 3.925231146709438e-17m |
| OFFSET2 | 1/1 | 32/32 통과 | 3.925231146709438e-17m |

최종192행은 소스와 실제 컴파일된 기하 경로에서 모두 통과했다. ID·순서·점 수·
법선의 원본 이진 값은 유지했다. 최대 실제 중점 오차는2.81191119989596e-17m다.
고정 자세에서 최대 반올림은5회였고, face당 최대 연산은5211유리수,
383233metered BigInt, 최고 정수 크기는2005bits였다.

새 기하 테스트12개와 기존 기하 control37개, paired surface 기준48건이 각
소스/컴파일 경로에서 통과했다. 실행 오류 테스트4개도 통과했다. 이 숫자는
서로 다른 검증 종류이며, 전체 엔진이나 장비 검증의 점수로 합치지 않는다.

## 원래 적층 사례의 재검증 범위

원래8개 정육면체·바닥·중력·마찰1/.7·dt1/120s를 유지했다. 직전 검증한 cold
정상 솔버를 하나만 사용하고, 전체 접촉점을 유지했다. 정상 방향 반복/QR 상한64와
원래 full-pair 위치 보정·독립 phase accounting·품질 검사도 유지했다.

| 사례 | 소스/컴파일 공통 prefix | 최대 QR/풀이 | 최대 독립 닫힘 속도 | 최대 상보성 |
| --- | --- | ---: | ---: | ---: |
| ALIGNED | 16/16 통과 | 1 | 1.054392670760619e-15m/s | 3.016881029213819e-16J |
| OFFSET | 16/16 통과 | 11 | 8.35871629753124e-16m/s | 2.353675197446504e-16J |
| YAW | 16/16 통과 | 3 | 7.597458302814675e-16m/s | 1.7977308790694733e-16J |

각 단계의 모든 접촉선·정상 KKT·접선 속도·위치 폐합·운동량/일·해당 시점의
기존 품질 기준이 통과했다. decoded 기록과 raw body hash가 두 경로에서 일치했다.
컴파일 경로는 실제 tsc 출력의 기하·정상 솔버·검증기·어댑터를 사용한다.
원래 private World와 일부 Physics helper는 소스다. 전체 공개 패키지 빌드나
공개9-body API 통합이 통과한 결과가 아니다.

별도 source02 실행은 ALIGNED308단계까지 독립 수락한 후180초 한도에 도달했다.
이 시간 한도는 늘리지 않았다. 당시 한도 처리에서 다음 사례로 진행할 수 있던
실행기 결함을 확인해 해당 실험만 종료했고, 그 기록과 다음 사례의 부분 기록을
보존했다. 수정한 실행기는 실행 한도와 후속 예외를 별도로 기록하고 중단한다.
16단계 비교는 실행기 수정 후 선택한 재현 구간이다. 원래1200단계 성공 기준을
16단계로 바꾼 것이 아니다. `selectedPrefixPassed`와 `privateTrajectoryGO`를 분리했다.

원래8~10초의 안정성 기준은 미실행이며 **NO_GO**다. 역사적 ALIGNED960,
OFFSET315, YAW243 및2-hinge NO_GO도 유지한다. 실측·기계 예측·제조 안전성은
검증하지 않았다. 장시간 판정을 위해 독립 기준 실행 비용을 개선할 작업이 남았다.

## 실제 명령과 기록

설치된 Node22와 도구만 사용했다. 새 의존성·다운로드·보안 변경·원격 게시는 없다.
무거운 실행은 기존 heavy lane gate를 같은 shell에서 획득/해제했다.

```sh
NODE=/Users/user/.volta/tools/image/node/22.19.0/bin/node
$NODE examples/physics-contact-boundary-2276/run.mjs baseline baseline-02
$NODE examples/physics-contact-boundary-2276/run.mjs geometry-source geometry-source-02
$NODE examples/physics-contact-boundary-2276/run.mjs geometry-emitted geometry-emitted-02 examples/physics-contact-boundary-2276/evidence/geometry-source-02
$NODE examples/physics-contact-boundary-2276/run.mjs error-tests error-tests-02
$NODE examples/physics-contact-boundary-2276/run.mjs world-source world-source-03
$NODE examples/physics-contact-boundary-2276/run.mjs world-emitted world-emitted-01 examples/physics-contact-boundary-2276/evidence/world-source-03/world-result.json
```

작업 디렉터리는 `/Users/user/Documents/ChatGPT/barocss-physics-motion-2276`이다.
사용한 run ID는 덮어쓰지 않는다. 각 디렉터리에 명령·종료 상태·raw 출력·
source hash·실제 provider graph가 있다. World admission은 성공 상태 외에
검증한 기하/솔버/독립 기준의 hash를 비교한다. 실행기 변경은 오류 테스트 기록에
별도로 연결한다. 변경 파일과 전체 기록의 hash는 manifest.json에 있다.

이전8d 커밋의 오류 helper/test는 있었지만 실제 runner에 연결되지 않았다는
사실도 확인했다. 기존 README의 연결 완료 주장은 정정이 필요하다. 이전 commit은
바꾸지 않았고, 새 실행기는 실제 `inspectAttempt`와 종료 검사 경로를 사용한다.
새 회귀 테스트가 물리 실패 뒤 실행 예외와 시간 한도 중단을 확인한다.

## 문서 사이트 검토

[검토 보고서](docs-review.md)에 실제 로컬 route·소스 위치·우선순위·수락 기준을 기록했다.
`apps/library-docs`에는 기존 Robot 설명이 있으나 Physics 전용 package 페이지와
탐색 경로가 없다. 제안은5개 문서 묶음이다.

1. Physics 개요와 구현·지원·검증 상태 표.
2. 단위·좌표계·관성·충격량과 CAD 변환 경계.
3. 지원 프로필·공개 API·생명주기·거부와 상태 보존.
4. Robot Motion 가이드: FK/IK·궤적·재생·역동역학·순동역학·접촉·제어 구분.
5. 독립 검증 기준, 재현 명령, 수치 오차와 남은 NO_GO.

기존 Robot/CAD Model 문서는 재사용하고, 은퇴한 Motion 패키지는 복원하지 않는다.
로컬 독립 pendulum API와 CAD를 통한 자유 운동 workflow의 planned 상태도 나눠 쓴다.
배포 workflow는 다른 docs 경로를 가리키므로 실제 host·배포 revision 연결은 미확인이다.
이번 요청은 검토다. 사이트 페이지·nav·배포는 수정하지 않았다.
