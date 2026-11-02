---
work_id: physics-p4-position-v2-2276
artifact_type: bounded-evidence-results
status: PASS_OFFLINE_FULL_COLD_POSITION_V2
owner_role: independent-evidence-writer
source_request: Preserve completed bounded P4 evidence and proof boundaries
last_updated: 2026-11-03
---

오프라인 full cold-position V2 범위가 PASS입니다. 이 결과로 전체 P4 상태를 변경하지 않습니다.

저장 프레임6개에서 새 cold QP6회, compact/scalar432회, 숫자 word2592개, 보존 payload leaf17394개를 검증했습니다. World0회입니다. lambda/KKT/수정값/선택/점/tie를 포함한 전체 보존 물리 응답이 저장 authority와 정확히 일치했습니다. 메타데이터 변경만 명시적으로 허용했습니다.

certificate는 각 값의 binary64 rounding cell 안에 엄격히 들어가며 폭은 정확한 십진1e-25 이하입니다. 물리 gate는 기존에 표현된 binary64 1e-12를 유지합니다. 모호한 경계는 PASS로 바꾸지 않습니다. exact SAT winner의 외부 feature 검증은 NOT_QUALIFIED입니다.

core 관찰기 CPU는773147000ns, 전체 CPU는1016861000ns, wall은1036200792ns입니다. setup/decode/출력/audit는 전체 경계에 포함됩니다. 중첩 시간은 서로 더하지 않습니다. 과거885643000ns는 시간 경계가 달라 성능 비교 기준으로 쓰지 않습니다.

기존 명령은 exit0로 끝났습니다. guard 경과 시간은1163.534541ms입니다. 180000ms deadline과 정리 시간은 별도 경계입니다. 종료 시 소유 child/process group은 없었습니다. 이번 문서·압축 작업은 수치 계산을 다시 실행하지 않았습니다.

기존 실행 명령:

```sh
/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-position-v2-2276/run.py position-01
```

32-point line/paired witness, phase ledger/quality, 전체 비용 및1200-step P4는 미검증입니다. 전체 P4는 NO_GO입니다. API·렌더링 검증은 NOT_RUN입니다.

원시 증거와 기존 command receipt는 [EVIDENCE-01.tar.gz](./EVIDENCE-01.tar.gz)에 보존했습니다. 파일별 SHA-256은 [EVIDENCE-ARCHIVE.json](./EVIDENCE-ARCHIVE.json)에 있습니다. 기존 source/contract/dependencies/README와 원래 schema·실패 증거는 변경하지 않았습니다.
