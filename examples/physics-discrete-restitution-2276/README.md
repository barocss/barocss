---
work_id: physics-discrete-restitution-2276
artifact_type: finite-selected-discrete-restitution-evidence-index
status: PASS_FINITE_DISCRETE_RESTITUTION
owner_role: independent-evidence-writer
source_request: Record completed finite discrete material restitution evidence
last_updated: 2026-11-03
---

이 폴더는 서로 다른 두 재료의 restitution을 discrete public API에서 검사한 유한 증거입니다.

- [CONTRACT.md](./CONTRACT.md): 실행 전에 고정한 범위와 기존 gate.
- [BANK-01.json](./BANK-01.json): API 전에 만든16-case 독립 Fraction 기준.
- [REFERENCE-CORRECTION-02.md](./REFERENCE-CORRECTION-02.md): 보존한 zero-pivot setup 실패와 exact row pivot 보정.
- [RESULTS.md](./RESULTS.md), [RESULTS.json](./RESULTS.json): 실제 Source/Native16 Worlds/16 steps씩의 결과.
- [EVIDENCE-01.tar.gz](./EVIDENCE-01.tar.gz), [EVIDENCE-ARCHIVE.json](./EVIDENCE-ARCHIVE.json): 원시 증거,3개 command receipt와 provider/source 해시.

PASS는 선택한 one-step, centered, friction-free, gravity-free, no-CCD 사례에만 적용합니다. 전체 엔진·브라우저·렌더링·P4 qualification을 뜻하지 않습니다. 이 문서 작성은 수치 실행을 추가하지 않았습니다.
