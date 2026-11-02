---
work_id: physics-p4-node-sat-2276
artifact_type: bounded-evidence-results
status: NUMERIC_EQ_PASS_NODE_COST_NO_GO
owner_role: independent-evidence-writer
source_request: Preserve completed bounded evidence and its first failure
last_updated: 2026-11-03
---

전체 저장 물리 응답의 수치 동등성은 PASS입니다. 비용 판정은 **NO_GO**입니다.

프레임6개, cold QP6회, compact/scalar432회, 축12960개, 숫자 word2592개, 보존 payload leaf17394개를 검증했습니다. World0회입니다. lambda/KKT/수정값/선택/점/tie를 포함한 보존 물리 payload가 저장 authority와 일치했습니다. 원래 QP 한계와 물리 gate를 유지했습니다. certificate 폭은 정확한 십진1e-25 이하이며 각 binary64 rounding cell 안에 엄격히 들어갑니다. 기존 물리1e-12 gate를 유지합니다.

비용 후보 값1084838000ns는 parent observer core397992000ns와 **소유 Node child 전체 수명 CPU686846000ns**의 합입니다. 저장 baseline은773147000ns입니다. 후보 경계가 보수적으로 더 넓으므로 정확히 같은 경계라고 주장하지 않습니다. 요청별 child CPU는 중첩 attribution이며 gate에 사용하지 않았습니다. 시작·종료 비용을 뺀 값으로 바꾸지 않았습니다. 요구한10% 개선을 충족하지 못했습니다.

한 번의 저장 baseline 비교입니다. baseline 재실행, 후보 재측정 또는 추가 조정은 하지 않았습니다. 비용 실패와 전체 reply·source transfer diff를 보존했습니다. 전체 parent+child CPU는1421289000ns입니다. 최종 summary 쓰기는 관찰기 시간 경계에서 제외합니다.

Node worker1개를 시작했습니다. 요청/응답445개, stdout/stderr EOF, trailing stdout0byte, exit0 및 reap을 확인했습니다. 종료는 clean입니다. 바깥 명령은 비용 NO_GO 때문에 exit1입니다. 이것은 물리 payload 실패로 바꾸어 해석하지 않습니다.

32-point line/paired witness, ledger/quality, 전체1200-step P4 및 전체 궤적 비용은 미검증입니다. 독립 geometry NO_GO도 해결하지 않았습니다. 전체 P4는 NO_GO입니다. API 확장과 렌더링 PASS를 주장하지 않습니다.

기존 실행 명령:

```sh
/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-node-sat-2276/run.py node-01
```

기존 command receipt는 모든 소유 process group의 종료를 기록합니다. 이번 패키징은 수치 테스트를 실행하지 않았습니다. 전체 증거는 [EVIDENCE-01.tar.gz](./EVIDENCE-01.tar.gz), 파일별 SHA-256은 [EVIDENCE-ARCHIVE.json](./EVIDENCE-ARCHIVE.json)에 있습니다. 기존 파일과 첫 실패는 유지했습니다.
