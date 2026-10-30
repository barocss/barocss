# D344 native quadrature 기준·후보 측정

동일한 benchmark byte와 입력 geometry로 기준 및 후보 측정을 완료했다. Heavy gate를 해제했다. 이 lane은 더 이상 heavy 작업을 실행하지 않는다.

| 사례 | 기준 batch median | 후보 batch median | 기준 query당 환산 | 후보 query당 환산 | median 변화 |
| --- | ---: | ---: | ---: | ---: | ---: |
| ordinary | 12.100709 ms | 12.08275 ms | 0.37814715625 ms | 0.3775859375 ms | 약 -0.15% |
| tiny | 10.509208 ms | 11.141584 ms | 0.32841275 ms | 0.3481745 ms | 약 +6.02% |

Node v22.19.0, 동일 machine, RUNS=7, WARMUP=3, BATCH=32, density 1, quadratureSegments 8을 사용했다. 각 batch는 새 BRep 32개에 첫 mass query를 실행한다. clone과 fixture 생성은 타이머 밖이다. query당 값은 batch median/32이며 개별 query 계측값이 아니다. 타이머에는 결과 배열 생성과 receipt 저장 1회도 포함된다. 실제 명령은 `run-baseline.sh`와 `run-candidate.sh`에 있다.

이는 local 기준·후보 한 쌍의 관측이다. tiny median은 약 6% 증가했으나 두 실행의 표본 범위가 겹친다. 7표본으로 통계적 유의성, tail SLO 또는 유의한 성능 regression을 판정하지 않는다. 속도 개선 주장도 하지 않는다. UI latency를 측정한 결과가 아니다. 기준 원시값과 후보 원시값은 각각 `baseline.json`, `candidate.json`에 있다.

## 입력과 정확도

ordinary와 tiny 모두 query 전후 입력이 바뀌지 않았다. 기준과 후보의 full native input JSON bytes, strict-check 결과, 모든 CP/weights/knots와 topology, names, bounds 및 wholePatch 분류가 정확히 같다. 두 fixture는 각각 solid 1개, closed shell 1개, faces 4개, edges 6개, vertices 4개이며 curved wholePatch 2개와 planar cap 2개를 가진다. 별도의 geometry 및 mass 관측은 `baseline-qualification.json`, `candidate/baseline-qualification.json`에 있다.

tiny의 기존 native V 6.180191251439208e-15 및 잘못된 Cxy는 보존했다. 후보 native V는 6.278163296415527e-15이며 C는 [.12345669999999997, -.23456779999999938, .3456789000000001]이다. 변경된 fingerprint는 mass receipt 변화이다. 입력 geometry 변화가 아니다. 기존 잘못된 V와 같아야 한다는 shape 비교를 정확도 oracle로 사용하지 않았다. 정확도 수용은 High의 독립 rational/대칭 적분 및 관련 correctness tests 범위이다. 이 성능 실행 자체는 정확도 oracle가 아니다.

## 동결 source

- 기준과 후보 benchmark: `37d81a207f097d7cb35d859200db64f716d0c38d30ed8a79b3d79e60ab4c39a9`
- 기준 quadrature source: `8ecf18b6338a403b9b541bd04716f9a9168bd45fc9a4ceeb00141e72cc9798a6`
- 후보 quadrature source: `696ec924bc4f1d7b74862533676af5e4c0b8a2a284a8a249ea7007dade4c8ed5`
- 후보 dist quadrature: `830606c3e8f1c28501188566a987b1caf71d0bbefecc9733b121794a51f86e57`
- solid-mass source: `19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac`
- native prismatic producer: `17f2b70b5ecbe0b1ab7912636d780fa1594469804f4af7fb48365212bc802f5a`

기준은 기존 built dist의 source/hash 일치 receipt를 재사용했다. 후보는 High의 candidate library build 완료 후 dist hash를 확인했다. benchmark source는 변경하지 않았다. 초기 경로 오류, 기존 unused 상수 lint 오류 및 앞선 baseline 원시값은 삭제하지 않았다. 최종 exact-script baseline을 별도로 다시 측정하여 후보와 비교했다.

이 lane의 저장소 변경은 perf-bench.mjs 하나뿐이다. Commit/push는 하지 않았다. STEP source map은 `/tmp/d344-model/step-consumer-source.md`에 있다. 실제 STEP 소비자 runtime/browser proof는 이 문서에서 PASS로 표시하지 않는다.
