# Gram 조합 실행 결과: 수학 PASS, 비용 NO_GO / ENDED

Root가 `p4-full-gram-b-01`을 한 번 실행했습니다. 6개 전체 응답, 6개 독립 감사와 새 메모리 검사는 PASS입니다. 고정 비용 기준은 NO_GO입니다. 이 후보는 ENDED이며 재측정·조정·새 후보 실행을 하지 않았습니다.

| 비용 항목 | ns |
|---|---:|
| parent6개 context CPU | 554815000 |
| 소유 Node 전체 수명 CPU | 244623000 |
| 보수적 합계 | 799438000 |
| 고정 통과 기준 | 695832300 |
| 저장 baseline | 773147000 |

Node CPU는 close/wait 뒤의 resource user/system 차이입니다. 시작·IO·종료 비용을 포함하며 child 자체 타이밍을 쓰지 않았습니다. 저장 Python baseline과 정확히 같은 경계라고 주장하지 않습니다. Baseline 재실행과 후보 재측정은0회입니다.

Parent 내부 합계는 compact382016000 + bridge21960000 + residual150839000ns입니다. Legacy admission1704000ns는 residual에 포함됩니다. 이를 다시 더하지 않습니다. 연산 수 감소를 CPU 비용 통과로 해석하지 않습니다.

## 실제 검사 범위

실제 wrapper는6frames attempted/returned,6proofCalls, compact/scalar432회,864convention models,12960axes를 기록합니다. SAT는808688operations/peak5814bits입니다. ColdQP/oldkernel/engineWorld0회, Node worker1개/요청6개/정상 reap, 독립 감사6개, 비용 판정1회입니다.

Outer summary의 `candidateChecksAttempted:0`은 그 필드를 증가시키지 않은 계측 결함입니다. 수학 실행0회를 뜻하지 않습니다. 실제 호출 수의 근거는 wrapper의6frames/6proofCalls와 보존한6개 in-call kernel 파일입니다. 실행된 코드와 보고서는 수정하지 않았습니다.

기존 V2 물리 leaf78888개가 닫힌 비교를 통과했습니다. case마다1447개 예외 경로를 검증·소비하고72개 인증서 이름 변경을 내려가 검사했습니다. 이전 실제 V3 응답과는 전체 leaf87942개가 exact이며 새 수치 예외0개입니다. 물리값과 인증서 메타데이터 모두 유지됐고 정규화·subtree 제외는 없습니다.

새 올바른 walker/reader를 쓴 감사에서 최대 실제 owned graph3441895B, 최대 walker auxiliary 예약5141988B, 최대 감사 예약 상한29290958B를 기록했습니다. Parent packet 실제 최대1114681B, wrapper packet 실제 최대1355058B입니다. Parent24MiB + Node/감사32MiB + transport8MiB의 기존64MiB 경계를 유지했습니다. 실제 관측과 예약 상한은 구분하며 RSS 증명은 아닙니다. 새 PASS는 이전 V3의 취소된347708B 관측값을 복구하지 않습니다.

## 별도 선행 증거

- Corrected owned-data helper: Root 최초 실행7개 순수 데이터 그룹 PASS. 독립 등록부와554644B/7324IDs가 일치하고, visited-depth/worklist50, auxiliary observed834816B/reserved1359352B를 기록했습니다. 이7개 그룹의 제한된 자격이며 이전 B 재감사가 아닙니다.
- R1: Root 최초 실행9calls +9prefix audits, ONE old Meter PASS.18models/270axes/378Gram/108face/486SIGNED,34701operations/peak1355bits입니다. Source end-authentication PASS입니다. 이 B를 위해 선행 검사를 반복하지 않았습니다.

첫 실패는 보존된 `one-cost-decision / CostGate / CONSERVATIVE_NATIVE_CPU_ENVELOPE_EXCEEDS_FIXED_695832300NS_GATE`입니다. Guard는 비용 거절로 exit1/FAIL을 반환했고, timeout은 없으며14993.598791ms 후 소유 group이 남지 않았습니다. 이를 물리 실패나 infrastructure 실패로 바꾸지 않습니다.

이것은 저장된6개 입력에 대한 독립 proof-cost 검사입니다. 실제 라이브러리 `src/stack/**` 구현·테스트·컴파일·API 검증을 대신하지 않습니다. 전체 경로/원래1200/API/desktop은 이 캠페인에서 NOT_RUN입니다. 기존 HOLD, 공차, 첫 실패와 이전 후보의 ENDED/메모리 취소 상태는 유지됩니다.

`SOURCE-01.tar.gz`는 실행 freeze가 지정한 workspace closure와 seal만 담습니다. 외부 Python/Node 바이너리는 메타데이터만 기록합니다. `PROOF-01.tar.gz`는 실제 B, helper/R1/M3와 guard의 명시 파일 목록입니다. 파일·아카이브 byte/SHA는 `ARCHIVE-MANIFEST-01.json`에 있습니다. 이번 문서/보존 작업은 JSON 읽기·해시·tar만 사용했고 수치·import·build·감사·재측정을 실행하지 않았습니다. Git stage/commit은 하지 않았습니다.
