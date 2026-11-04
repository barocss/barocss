---
work_id: physics-p4-compact-v2-2276
artifact_type: bounded-evidence-results
status: PASS_OFFLINE_COMPACT_V2_PROTOCOL_SUBSET
owner_role: independent-evidence-writer
source_request: Preserve completed bounded P4 evidence and proof boundaries
last_updated: 2026-11-03
---

오프라인 compact V2 부분 범위가 PASS입니다. 새 certificate와 원래 물리 payload를 검증했습니다.

저장 프레임6개에서 record432개, scalar432회, 숫자 word2592개, 보존 payload leaf13926개를 검증했습니다. World0회, QP0회입니다. 원래9개 payload 필드는 유지했습니다. precisionMaxDifferenceM 한 필드만 satCertificateV2로 교체했습니다. 기존 schema와 증거는 바꾸지 않았습니다.

certificate는 각 값의 binary64 rounding cell 안에 엄격히 들어가며 폭은 정확한 십진1e-25 이하입니다. 물리 gate는 기존에 표현된 binary64 1e-12를 유지합니다. 모호한 경계는 PASS로 바꾸지 않습니다. exact SAT winner의 외부 feature 검증은 NOT_QUALIFIED입니다.

전체 관찰기 CPU는594844000ns, wall은604923125ns입니다. setup/authentication, scalar+SAT, record 출력과 독립 audit를 포함하며 최종 summary 인코딩·쓰기는 제외합니다. 완전한 position/QP 범위와 같은 시간 경계가 아니므로 속도 향상이나 total cost GO를 주장하지 않습니다.

기존 명령은 exit0로 끝났습니다. guard 경과 시간은664.197792ms입니다. 180000ms deadline과 정리 시간은 별도 경계입니다. 종료 시 소유 child/process group은 없었습니다. 이번 문서·압축 작업은 수치 계산을 다시 실행하지 않았습니다.

기존 실행 명령:

```sh
/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-compact-v2-2276/run.py compact-01
```

32-point line/paired witness, phase ledger/quality, 전체 비용 및1200-step P4는 미검증입니다. 전체 P4는 NO_GO입니다. API·렌더링 검증은 NOT_RUN입니다.

원시 증거와 기존 command receipt는 [EVIDENCE-01.tar.gz](./EVIDENCE-01.tar.gz)에 보존했습니다. 파일별 SHA-256은 [EVIDENCE-ARCHIVE.json](./EVIDENCE-ARCHIVE.json)에 있습니다. 기존 source/contract/dependencies/README와 원래 schema·실패 증거는 변경하지 않았습니다.
