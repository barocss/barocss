---
work_id: physics-box-slab-boundaries-2276
artifact_type: finite-box-slab-evidence-index
status: PASS_FINITE_BOX_SLAB_SIGN_AND_DESKTOP_RENDER
owner_role: independent-evidence-writer
source_request: Preserve finite slab boundaries, quaternion sign repair and actual desktop proof
last_updated: 2026-11-03
---

선택한 finite box/static-box CCD와 desktop rendering은 **PASS**입니다. baseline과 sign02, 실패한 regression 설정, 실제 Native regression 및 Source GPU rendering을 별도 범위로 보존했습니다.

- [RESULTS.md](./RESULTS.md), [RESULTS.json](./RESULTS.json): 실제 counts,0잔차, 회전 부호 수정 및 남은 한계.
- [CONTRACT.md](./CONTRACT.md), [AMENDMENT-02.md](./AMENDMENT-02.md): 원래 범위와 명시적 sign 수정.
- [preview.png](./preview.png): 이미 생성된1440 desktop screenshot의 수정 없는 복사본.
- [EVIDENCE-01.tar.gz](./EVIDENCE-01.tar.gz), [EVIDENCE-ARCHIVE.json](./EVIDENCE-ARCHIVE.json): 전체 own evidence, old/current provider/source, rendering 자료와13개 command receipt/hash.

baseline01은 Source/Native 각각18 Worlds/22 steps/creation refusal4회입니다. sign API02는 각각20 Worlds/24 steps/creation refusal2회입니다. 각 실행의 command refusal은 그래프당2회이며 잔차는 모두0입니다. 기존 gate와 cap은 유지했습니다.

render01은 Source public World/recorder와 실제 public Viewer GPU에서9개 check/4개 preset,1280/1440/1920을 통과했습니다. Native GPU·CAD Studio·기울어진 box·일반 contact geometry·제조/장비·전체 G2/P4의 증거로 확장하지 않습니다. 기존 HOLD와 P4 NO_GO를 유지합니다.

이 문서는 완료된 결과를 기록하도록 갱신했습니다. FREEZE-01이 pin한 원래 README는 archive에 별도로 보존되어 있습니다. FREEZE-02에는 README pin이 없습니다. 두 freeze와 역사적 pin은 그대로이며 이 문서 변경으로 refresh하지 않았습니다. historical receipt 재현에는 저장한 원래 README가 필요합니다. 수치/browser 재실행·stage·commit은 하지 않았습니다.
