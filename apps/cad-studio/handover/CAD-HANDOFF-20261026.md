# CAD 인수인계 — 진행 중 체크포인트

아직 전체 일시 중지나 최종 GitHub push를 하지 않았습니다. 이 문서는 2026-10-26 작업 중의 작은 복구 기록입니다. 당시 Codex core 잔여33%, secondary unknown이며, 유효 창의 잔여5% 이하일 때만 사용자 승인 마감 절차를 시작합니다.

현재 코드와 결과는 [체크포인트 JSON](cad-coordinator-checkpoint-20261026.json)에 있습니다. 이는 기존 단일 작업 목록의 내보내기이며 별도 실행 큐가 아닙니다. 재개 시 실제 branch/HEAD와 담당 Work의 착수·완료·차단을 대조하세요. 같은 host의 상세 기록 위치도 JSON에 있습니다. 전체 raw·PNG는 이 작은 묶음에 포함하지 않았습니다.

## 제품과 미완료 변경

이 문서 이전 제품은 f104745440effc54ad2c75b5bc043cbba7227495입니다. 검증된 GPU camera readback과 정규식 시험 수정의 정확2파일을 local noff 채택했습니다. 후보/제품 tree와 파일 bytes·foreign33·CAD818은 같았습니다. 필수 제품 docs 검사는 환경 capacity 대기이며, 최종 제품 PASS가 아닙니다. 이 문서 커밋이 제품 HEAD를 바꾸므로 이후 검사는 실제 새 HEAD에 결속해야 합니다.

공유 소스1a7f22666에는 제품에 없는 Sketch 수정과 아직 검증 중인 revolve/Drawing 시험이 섞여 있습니다. 전체 aggregate를 제품에 통째로 합치지 마세요. 검증된 parent-child delta만 선택하고 실패 revolve와 결합 문서는 분리합니다.

## 확인한 결과와 다음 순서

- Enter가10.0000004를10으로 바꾸던 문제를 최소 수정했습니다. 실제 Enter/Finish/다운로드/Open 후 driving10.0000004, 독립 길이10.000000419678194, 잔차1.97e-8mm로 기존1e-7 안입니다. [실제 저장파일](evidence-20261026/B-fixed-enter.bcad)과 [다시 연 뒤 저장파일](evidence-20261026/B-fixed-open-roundtrip.bcad)은 geometry·driving이 같고 ID/nextId 때문에 전체 bytes는 다릅니다. 이것만으로 전체 솔버나 제조 정확도를 보증하지 않습니다.
- 좁은 focus 입력의 선두 잘림은 별도 최소 grid 수정 후 실제 가시성 검증 대기입니다. served 소스와 disk가 달라 새 브라우저 단계는 NOTRUN입니다. HTTP200을 결속 PASS로 바꾸지 말고 서버 소유자가 정확 가용성을 고칩니다.
- revolve 원 시험은4PASS1FAIL입니다. 근접 공간 EPS로 실제 내부 극점을 지우는 중간안은 거부했습니다. exact cyclic 대안을 채택했으나 원 test80/좌표/기대 체적/공차의 새 실행 확인이 필요합니다.
- Drawing 원 시험은2PASS1FAIL입니다. 파생 길이의 비트 동등성 가정4개만 abs1e-9mm/paper-mm로 교정했습니다. 새 단계는 guard75·Node0으로 종료돼 새 시험 결과는 없습니다. 저장값·문자·명목·제품 공차는 그대로입니다.
- 다음은 실제 gate 가용 슬롯 확인→정확 소유 source refresh→Kernel affected build/원5case→Drawing 새3case→변경 Panel Studio type→관련 문서/사이트·필수 제품 docs입니다. 충돌 없는 브라우저/읽기는 별도로 진행합니다. 완료 검사를 이유 없이 반복하지 않습니다.

## 운영과 최종 마감

Work 책임자가 내부 agents와 필요한 agent-browser 실제 화면·파일·PNG·console 검증을 맡고, root는 shared source·제품 통합을 맡습니다. 각 Work는 자기 기존 branch의 정상 commit으로 전달합니다. 타인 WIP·지원 서버·탭·프로필을 보존합니다. 올바른 identity는 easylogic<cyberuls@gmail.com>입니다.

기존 roadmap의 기반→공통 실험 계약→제한 진자→기계/로봇/접촉 제어→구조/열→유체/전기→실측 피드백 순서를 유지합니다. 현 정적 토크·과거 기록은 freeforward·실측·제조 또는 Stage1 전체 완료가 아닙니다. Physics archived Work·solver/profile과 기존 HOLD를 임의 해제하지 않습니다.

잔여5% 이하이면 새 일과 자동 다음 착수를 중지하고 안전 checkpoint/반환을 받습니다. 검증된 변경만 통합하고 필요한 최소 검사와 이 기록을 정상 commit합니다. 사용자가 승인한 origin feature branch에 정상 push한 뒤 remote SHA를 확인하고 기존 cad 자동화를 PAUSED로 전환합니다. force/main-develop rewrite·태그/release·임의 PR·credits/reset은 하지 않습니다. 최종 원격 SHA와 실제 pause 수신/반환은 아직 없으므로 완료라고 적지 않습니다.
