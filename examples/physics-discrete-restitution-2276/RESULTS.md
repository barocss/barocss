---
work_id: physics-discrete-restitution-2276
artifact_type: finite-selected-discrete-restitution-results
status: PASS_FINITE_DISCRETE_RESTITUTION
owner_role: independent-evidence-writer
source_request: Record completed finite discrete material restitution evidence
last_updated: 2026-11-03
---

선택한16개 유한 discrete restitution 사례가 Source와 Native에서 **PASS**입니다. 각 그래프는 World16개와 승인 step16회입니다. 전체32 Worlds/32 steps입니다.

API 실행 전에 독립 Fraction reference가 운동량 보존과 Newton 상대 분리 속도의2×2 선형 조건을 풀어 BANK-01.json을 만들었습니다. 이 reference는 엔진과 candidate 코드를 가져오지 않으며 출력 상태를 읽지 않습니다. fixed sphere/cube와 질량2/3kg sphere pair를 검사했습니다. 중력·마찰·CCD는 없습니다. 계수의 최솟값,0/1 끝값, 재료·입력 순서와0.5m/s 바로 아래/같음/바로 위 word를 포함합니다. 기존 법칙은 closing speed가 엄격히0.5보다 클 때만 restitution을 적용합니다.

reference01은 첫 대각 pivot0으로 setup FAIL했습니다. bank 생성과 World 호출 이전입니다. 원 소스와 실패 receipt는 evidence/reference-first-failure-01에 유지했습니다. reference02는 같은 두 조건에 exact row pivoting을 적용했습니다. 입력·gate·물리 법칙은 변경하지 않았습니다. 이 실패는 엔진 물리 실패가 아닙니다.

API는 이미 검증한1779dd871 sphere-pair runtime을 재사용했습니다. 그래프 import 전에 provider/source pin289개를 검사했습니다. 새 compilation과 production edit는 없습니다. 모든 실제 contact가 존재하고 CCD hit는0개입니다. Source/Native 상태는 검증한 provider identity만 정규화한 뒤 word 단위로 같습니다.

양쪽 그래프의 최대 잔차는 velocity4.440892098500626e-16m/s, impulse8.881784197001252e-16Ns, angular velocity0, energy1.3322676295501878e-15J, tangent-plane0입니다. 기존1e-10 motion/impulse/spin/energy gate와1e-12 tangent-plane gate를 유지했습니다.

이 결과는 위 유한 사례의 속도·충격량·에너지 검사입니다. 전체 dynamics, contact projection work, recorder의 새 범위, 엔진 전체, 브라우저 또는 렌더링을 인증하지 않습니다. P4 NO_GO는 그대로입니다.

기존 실행은 reference01 exit1, reference02 exit0, API01 exit0입니다. 세 command receipt와 소유 process group 종료를 보존했습니다. 이번 작업은 문서·해시·압축만 수행했습니다. 수치 재실행, stage, commit은 하지 않았습니다.

원시 입력/출력과 첫 실패, source bundle, 전체 Native provider 및 source pin closure는 [EVIDENCE-01.tar.gz](./EVIDENCE-01.tar.gz)에 있습니다. 모든 member와 archive SHA-256은 [EVIDENCE-ARCHIVE.json](./EVIDENCE-ARCHIVE.json)에 있습니다.
