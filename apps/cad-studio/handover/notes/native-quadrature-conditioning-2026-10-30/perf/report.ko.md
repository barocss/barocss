# D344 native quadrature 기준 측정

기준 측정을 완료했다. 후보 측정은 NOT_RUN이다. 이 결과는 게시된 기존 알고리즘의 성능 기준이며, 기존 native mass 오류를 승인하는 결과가 아니다. Heavy gate는 해제했다. 저장소 수정은 `packages/barocss-cad/scripts/perf-bench.mjs` 한 파일이다.

| 사례 | batch median | query당 환산 | 표본 |
| --- | ---: | ---: | --- |
| ordinary | 12.100709 ms | 0.37814715625 ms | 7 |
| tiny | 10.509208 ms | 0.32841275 ms | 7 |

각 사례는 warm-up 3 batches 뒤 측정 7 batches를 실행했다. 한 batch는 32개의 fresh BRep에 첫 native mass query를 한 번씩 수행했다. prepare는 fixture 생성과 deep clone을 타이머 밖에서 실행했다. 타이머에는 query loop, 결과 배열 생성 및 receipt WeakMap 저장 1회가 포함된다. query당 값은 batch median을 32로 나눈 값이다. 각 query를 별도 측정한 값은 아니다. 원시 7표본은 `baseline.json`에 있다. 이는 UI latency 또는 tail SLO 증명이 아니다.

두 사례는 공개 prismatic producer를 사용한다. radius는 3이고 XY 번역은 [.1234567, -.2345678]이다. ordinary 높이는 5.00009이다. tiny의 실제 native normal interval은 [.3456789, .34567890000000023]이다. density 1, quadratureSegments 8을 사용했다. Node는 v22.19.0이다. CPU와 OS는 `baseline-report.json`에 기록했다. 기존 dist source hash를 High의 old-algorithm 재현 receipt와 확인하여 재사용했다. 별도 library build는 하지 않았다.

## Geometry와 정확도 분리

각 fixture는 strict-valid solid 1개, closed shell 1개, physical faces 4개, edges 6개, vertices 4개, loops 4개, coedges 12개이다. 곡면 wholePatch 2개와 정확한 constant-Z planar cap 2개를 확인했다. wholePatch 분류, checkBrep, area 및 qualification mass query는 별도 객체에서 실행했다. 측정 객체는 새 identity이므로 기존 quadrature WeakMap의 결과를 재사용하지 않는다.

query 전후 full input JSON이 같았다. CP, weights, knots와 topology 전체는 `ordinary-input-brep.json`과 `tiny-input-brep.json`에 보존했다. 기준과 후보는 이 입력과 이름/ID/counts를 정확히 유지해야 한다. tiny fixture의 face surface, edge curve, vertex 좌표는 실제 D343 native 입력과 ID/name을 제외하고 정확히 같았다. 전체 byte는 이름/ID 차이 때문에 같지 않다. geometry checksum만으로 정확도를 판정하지 않았다. topology, cap level, closed 상태, branch, 좌표 및 독립 represented-number context를 함께 기록했다.

기존 tiny native quadrature 관측은 V 6.180191251439208e-15, C [.10042170557247179, -.26839177431837347, .3456789000000001]이다. tangent centroid 오류를 재현했다. 별도 prismatic context는 V 6.278163296415536e-15이다. Python Fraction으로 실제 저장된 endpoints의 span과 midpoint를 계산했다. rounded pi circle guide와 비교한 기존 native V 차이는 약 -1.5605%이다. 이 값과 prismatic provider는 독립 rational native circle 적분의 대체물이 아니다. High가 정확도 판정을 소유한다.

## 도구 변경과 검사

기존 case/CLI와 ms/fp 필드를 유지했다. 새 두 case에만 untimed `.prepare()`, WARMUP/BATCH, `rawDuration`, `median`, `perQuery`, `unit: ms`를 추가했다. shape mode는 BRep 반환 의미를 유지한다. mass fingerprint는 후보의 정확도 수정으로 바뀔 수 있다. 예상 DIFF를 geometry 실패 또는 속도 regression으로 자동 해석하지 않는다. 알려진 잘못된 baseline mass와 shape volume이 같아야 한다고 요구하지 않는다.

node --check는 PASS이다. narrow lint는 0 errors, 기존 console warnings 5개이다. 첫 lint의 기존 unused XZ 상수는 제거했다. unused XZ 정리 후 최종 script로 기존 알고리즘을 다시 측정했다. 최종 측정 및 동결 SHA는 37d81a207f097d7cb35d859200db64f716d0c38d30ed8a79b3d79e60ab4c39a9이다. 기준과 후보는 정확히 같은 benchmark byte를 사용한다. 이전 baseline 원시값과 SHA는 별도 파일에 보존했다. 첫 syntax command는 package 경로를 중복하여 MODULE_NOT_FOUND를 냈고 올바른 경로에서 통과했다. 제품 실패가 아니다.

production quadrature SHA는 8ecf18b6338a403b9b541bd04716f9a9168bd45fc9a4ceeb00141e72cc9798a6, solid-mass SHA는 19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac로 유지했다. 후보 build와 측정은 같은 Node, machine, case 순서, RUNS=7, WARMUP=3, BATCH=32를 사용해야 한다. 후보 source에 맞춘 library build가 필요하다. 최종 raw/geometry 비교 후에만 제한된 성능 변화율을 보고한다. 아직 성능 개선 주장은 없다.
