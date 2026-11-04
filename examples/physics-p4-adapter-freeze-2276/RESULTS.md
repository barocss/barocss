---
work_id: physics-p4-adapter-freeze-2276
artifact_type: bounded-evidence-results
status: PASS_P4_ADAPTER_BYTE_EQUIVALENCE
owner_role: independent-evidence-writer
source_request: Preserve completed bounded P4 evidence and proof boundaries
last_updated: 2026-11-03
---

바이트 동등성 PASS입니다. 두 입력은 서로 다른 해시로 인증했습니다. 같은 교체 규칙을 적용한 출력은 바이트 단위로 같습니다.

World0회, step0회, candidate0회, geometry0회, build0회, Git 읽기5회입니다. 유일한 변경은 교체되는 solve 영역 안의 명시적 `, 0` 인수입니다. 기존 adapter의 원본 해시 검사는 그대로입니다. 이 결과는 현재 입력의 자동 채택이나 P4 물리 검증을 뜻하지 않습니다.

바이트 비교만 수행한 기존 결과입니다. 물리 오차·공차·성능 검증은 NOT_RUN입니다.

숫자 공차와 관찰기 CPU 비교는 적용하지 않습니다.

기존 명령은 exit0로 끝났습니다. guard 경과 시간은115.6525ms입니다. 180000ms deadline과 정리 시간은 별도 경계입니다. 종료 시 소유 child/process group은 없었습니다. 이번 문서·압축 작업은 수치 계산을 다시 실행하지 않았습니다.

기존 실행 명령:

```sh
/Users/user/.volta/tools/image/node/22.19.0/bin/node examples/physics-p4-adapter-freeze-2276/verify.mjs verify-01
```

32-point line/paired witness, phase ledger/quality, 전체 비용 및1200-step P4는 미검증입니다. 전체 P4는 NO_GO입니다. API·렌더링 검증은 NOT_RUN입니다.

원시 증거와 기존 command receipt는 [EVIDENCE-01.tar.gz](./EVIDENCE-01.tar.gz)에 보존했습니다. 파일별 SHA-256은 [EVIDENCE-ARCHIVE.json](./EVIDENCE-ARCHIVE.json)에 있습니다. 기존 source/contract/dependencies/README와 원래 schema·실패 증거는 변경하지 않았습니다.
