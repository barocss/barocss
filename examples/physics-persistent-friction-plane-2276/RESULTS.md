---
work_id: physics-persistent-friction-plane-2276
artifact_type: bounded-evidence-results
status: OBSERVED_NO_GO_TANGENT_PLANE
owner_role: independent-evidence-writer
source_request: Preserve completed bounded evidence and its first failure
last_updated: 2026-11-03
---

실제 Native public World의 접선 평면 조건이 **NO_GO**입니다. 수정이나 새 물리 범위 인증은 하지 않았습니다.

World1개에서 승인 step2회를 실행했습니다. 독립 Fraction audit는 반환된 binary64 word를 정확한 유리수로 해석합니다. step1의 |n·T|는7.301517802332167e-22Ns로1e-12Ns gate를 통과했습니다. step2는7.191714115138252e-9Ns로 같은 gate를 초과했습니다. 첫 cold step과 다음 warm step을 구분해 원시 상태와 실패를 보존했습니다. baseline의 이전 independentAudit=NOT_RUN 필드는 고치지 않았습니다. 완료된 독립 audit를 별도 파일로 보존했습니다.

별도의 exact line audit도 public paired witness를 NO_GO로 판정했습니다. step1의 약8.508678180235096e-6m와 step2의 약5.6915981142408475e-5m 간격은1e-12m gate를 초과했습니다. 두 line은 각각 두 box를 통과합니다. 이 사실로 대응하는 표면 점이 같아지지는 않습니다. 정확한 유리수 간격은 원래 audit JSON에 있습니다.

**검사 범위는 승인된 public aggregate point/normal/impulse입니다.** 내부 PRE force와 모든 숨은 manifold point를 완전히 검사한 결과가 아닙니다. tangent-plane 관찰만으로 witness geometry를 인증하지 않습니다. 공개 물리 NO_GO를 유지합니다.

기존 명령의 exit0은 실패 관찰과 audit 파일 저장이 완료되었다는 뜻입니다. 물리 PASS가 아닙니다. 전체 Native provider-dist와 원래 source/provider manifest를 보존했습니다. candidate 호출0회이며 core·contract·증거를 바꾸지 않았습니다.

기존 실행 명령:

```sh
/Users/user/.volta/tools/image/node/22.19.0/bin/node examples/physics-persistent-friction-plane-2276/baseline.mjs baseline-01
/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-persistent-friction-plane-2276/geometry-audit.py examples/physics-persistent-friction-plane-2276/evidence/baseline-01
```

기존 command receipt는 모든 소유 process group의 종료를 기록합니다. 이번 패키징은 수치 테스트를 실행하지 않았습니다. 전체 증거는 [EVIDENCE-01.tar.gz](./EVIDENCE-01.tar.gz), 파일별 SHA-256은 [EVIDENCE-ARCHIVE.json](./EVIDENCE-ARCHIVE.json)에 있습니다. 기존 파일과 첫 실패는 유지했습니다.
