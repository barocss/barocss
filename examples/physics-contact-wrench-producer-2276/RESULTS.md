---
work_id: physics-contact-wrench-producer-2276
artifact_type: source-private-contact-wrench-producer-results
status: EXECUTED_PASS_SOURCE_PRIVATE_PRODUCER
owner_role: independent-evidence-writer
source_request: Preserve executed source-private producer proof and bounded coverage
last_updated: 2026-11-03
---

SOURCE_PRIVATE persistent producer의 실행 범위가 **PASS**입니다. package 또는 public runtime으로 promote하지 않았습니다.

실제 build01과 run01이 PASS했습니다. World3개, 시도8회, 승인 step6개입니다. 전체 시도 trace는 application800회, query58개/point100개, anchor check2700개를 기록했습니다. 기록1411개와 trace byte5231589를 구분해 보존합니다. 초기 packet과 승인된6개 interval의 독립 observer packet7개가 PASS했습니다. 승인 interval의 observer event는798개이며 전체 시도 trace count와 혼동하지 않습니다.

초기/승인 geometry, 실제 application에서 누적한 pair별 linear/world-origin angular impulse, 작용·반작용, step momentum/spin/work/projection ledger를 독립 observer가 확인했습니다. known/unknown refusal 뒤 state/log 보존, retry와 clean control 비교, restore prefix/continue, 초기·승인 vector mutation isolation도 private 실행에서 통과했습니다. 기존 phase 실패의 body trajectory word 비교는 report-only regression이며 새 물리 oracle가 아닙니다.

독립 observer 전체 최대값은 producer linear impulse 차이3.0986497386532196e-17Ns, producer world-origin moment 차이9.14326337620988e-18Nms, step momentum1.3710178116784048e-16Ns, step world-origin angular ledger6.899222678939896e-17Nms, energy ledger2.483949147885245e-16J, actual tangent-plane6.009235071419252e-21Ns입니다. producer linear/moment reciprocity 잔차는0입니다. 모든 원래 이름의 maxima와 단위가 제곱인 geometry 지표는 RESULTS.json에 그대로 보존합니다.

**실제 warm application은0회이며 changing-frame nonzero warm friction은 NOT_COVERED입니다.** 성공한 codec 검사는 private pure recording2/BCPHREC2 helper 범위입니다. 실제 공개 serialize/deserialize 성공 경로는 NOT_RUN입니다. Native·public·desktop·performance도 NOT_RUN입니다. 이 한계를 private control PASS로 지우지 않습니다. 기존 P4 NO_GO와 보존된 앞선 실패는 그대로입니다.

DAG encoding은 trace의 공유 구조를 저장할 뿐 물리 event를 제거하지 않습니다. 전체 pools/references, encoder/독립 decoder, codec rejection/process logs와 stored/expanded byte guard를 archive에 보존했습니다. 기존 forecast는 과거 packet의 encoding 측정이며 새 physics proof나 runtime performance 결과로 바꾸지 않습니다. archive 압축률을 원래16MiB uncompressed 한계의 대체값으로 사용하지 않습니다.

전체 own source/stage/B modules/entry/manifest/source bundle, pins와 검토 freeze, traces/DAG pools/observer/codec logs, authenticated source closure와 build/run command receipt2개는 [EVIDENCE-01.tar.gz](./EVIDENCE-01.tar.gz)에 있습니다. [EVIDENCE-ARCHIVE.json](./EVIDENCE-ARCHIVE.json)은 모든 member/archive SHA-256을 기록합니다. 이번 패키징은 수치 테스트를 실행하지 않았고 protected source·implementation·실패를 변경하지 않았습니다. stage/commit도 하지 않았습니다.
