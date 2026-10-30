# D344 동결 구현·독립 테스트 검토

판정: **PASS. Blocking finding 없음.**

수치 정확도 범위는 지정 native cylinder의 stored-node V/X/Y 및 등록된 ordinary/reflected/cardinal controls다. 전체 central inertia, extreme geometry 또는 모든 quadrature 정확도의 승인은 아니다. 실제 browser/product flow는 이 검토 시점 **NOT_RUN**이다.

검토 checkout: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, published baseline `c0fea1174f71fc4f9e83ac4f53978d09884e0ef1`. 현재 구현은 아직 WIP다. 이 리뷰는 source/test/oracle 및 다른 담당자의 동결 로그를 읽었다. runtime/tests/heavy/build/perf/browser 실행, 제품 소스 수정, commit/push를 하지 않았다. D343 artifacts 및 `/tmp/d344-review/numerical-scope-review.md`는 수정하지 않았다.

## 동결 hash

High `owned-sha256.json`과 현재 파일 hash를 직접 비교했다. 모두 MATCH다.

| Path | SHA256 |
|---|---|
| packages/barocss-cad/src/brep/brep-mass-quadrature.ts | 696ec924bc4f1d7b74862533676af5e4c0b8a2a284a8a249ea7007dade4c8ed5 |
| packages/barocss-cad/test/native-quadrature-conditioning.test.mjs | 2f6c907cca86b9692a0f86c7ce5ceaa8fa0d4cfdc6505a2c9cbf29942082c606 |
| packages/barocss-cad/test/helpers/native-quadrature-oracle.mjs | 240bdab4bc858bec60d2bb97a991f3224403bfcb2a66424f42a34a99582d4a81 |
| packages/barocss-cad/test/fixtures/native-quadrature-thin-cylinder.json | d9ca158a6c6dfb5d91d900af55ad5b39b0decd1b7c4b78aa06be240a7ccc5ce6 |

solid-mass source `19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac`와 cap source `17f2b70b5ecbe0b1ab7912636d780fa1594469804f4af7fb48365212bc802f5a`는 불변이다. benchmark source는 old/new 공통 `37d81a207f097d7cb35d859200db64f716d0c38d30ed8a79b3d79e60ab4c39a9`다.

## 구현 검토

production diff는 진단된 whole-patch arithmetic과 private accumulator 연결에 한정된다.

- 기존 `accumulate`는 world point에서 동일 body-global center를 뺀 뒤 private `accumulateLocal`을 부른다. 기존 field expressions와 multiplication 순서는 유지한다. 따라서 planar Green, trimmed/rest 및 mixed facet callers의 origin 계약은 바뀌지 않는다.
- whole-patch Pw는 native P를 읽어 `(P-centre)*w`를 저장한다. 원본 native pole/weight/curve/surface 배열은 대입하지 않는다. W는 그대로다. center subtraction이 homogeneous weighted products와 U-column sums 이전에 온다.
- projected point는 이미 local이다. patchPoint가 이를 direct local field에 전달한다. world center를 다시 더하고 빼는 경로가 없으므로 회복된 tiny coordinate를 다시 잃지 않는다.
- quadrature rules, knot spans, basis 및 derivative recurrence, quotient/cross, face sense와 composite weights, area expression은 그대로다. 새 callback이나 per-sample array allocation은 없다. 기존 point3 scratch 제거는 private bookkeeping 변경이다.
- 모든 face는 하나의 body-global origin으로 field를 더한다. per-face anchor 또는 open-face moment 이동 공식은 추가하지 않는다.
- `fromCentre`와 dispatch/classification/fallback은 변경하지 않는다. no-rest path는 합쳐진 closed-body total을 한 번 world로 옮긴다. meshed path의 기존 total/squared/cubed 배열별 변환 및 Richardson bookkeeping도 같은 origin에서 그대로 유지된다. 모든 경로에서 함수 호출이 무조건 한 번이라는 주장은 하지 않는다.
- density/MMGS/SI handling, method/options/errors는 solid-mass의 기존 경로를 사용한다. classifier tolerance, minimum thickness, centroid clamp, volume factor, native geometry rewrite, shared surface evaluator 변경 또는 새 public export는 없다.

이번 변경은 기존 source 분석의 승인된 body-global local homogeneous + local accumulator 계약에 맞는다. 공통 origin 누락, double subtraction, double reflection 또는 새 API 경계 문제는 찾지 못했다.

## 독립 test/oracle 검토

등록된 oracle helper는 CAD product를 import하지 않는다. exact binary64 rational helper와 independent quadratic/linear Bernstein 식을 사용한다. fixture의 실제 모든 native side poles/positive weights, knots, paired rulings 및 face sense를 확인한다. 고정 13×11 Gauss nodes/weights에서 affine-mapped stored parameters를 만든 뒤 572 samples의 side V/X/Y를 exact rational arithmetic으로 더한다. 생산의 새 local-Pw 구현을 oracle에 복사하지 않는다.

원본 native geometry를 arithmetic authority로 사용하므로 잘못된 old provider mass bits를 정답으로 고정하지 않는다. fixed stored-node authority와 exact integration/exact pi는 구분한다. Z expected midpoint는 native paired prism interval에 근거한 별도 symmetry authority다. area sqrt와 모든 raw/central tensor를 exact oracle로 검증한다는 주장은 없다.

새 11 tests의 의미 있는 범위를 읽었다.

- accepted captured tiny cylinder의 V는 native exact-node authority에 대해 약1e-11 relative scale로 검사한다. centroid 세 축은 기존1e-7 policy로 검사하고 normal centroid는 strict native interval 안에 있어야 한다. old 약.02/.03 tangent bias와 약1.56% volume error를 검출한다.
- 실제 side2 wholePatch와 meshed=false를 확인한다. native strict structure와 input deep equality를 확인한다.
- identity, normal reflection, thin X/Y cardinal permutations는 transformed expected centroid의 **모든 축**을 확인한다. X-thin V만으로 side 정확도를 대신하지 않는다. transformBrep의 실제 sense/loop handling을 쓰며 determinant를 다시 곱하지 않는다.
- normal recenter는 represented gap이 그대로 남는지 exact 확인하고 midpoint를 별도1e-30 한계로 확인한다.
- ordinary .001 및5.00009/7.00009 간격, 음수 from, density7.85 scaling과 invalid density refusal, explicit quadratureSegments=0 tessellated method/volumeBound 계약을 검사한다.
- captured fixture와 source B-rep는 clone/읽기 경로만 사용한다. global/private/cache mutation 또는 복구 hook이 없다.

old built source에서 등록 11 tests가 **6 PASS, 5 FAIL**였고 동일 tests가 candidate에서 **11 PASS, 0 FAIL**다. receipt에 따르면 candidate를 위해 assertion을 약화하거나 테스트를 수정하지 않았다. 이 old/new 구분과 첫 실패 로그를 보존했다.

## 읽은 실행 근거

다음은 담당자가 실행한 로그/JSON을 읽은 결과다. 리뷰 세션이 재실행한 결과는 아니다.

- High clean build, new focused11, related mass/area65 + explicit native SI/boundary16 = **81 PASS**, types/lint/code-shape PASS.
- candidate native observation: V `6.278163296415527e-15`, C `[.12345669999999997,-.23456779999999938,.3456789000000001]`, method quadrature. native source unmodified, old/new mesh의 모든 stored 값과 strict check exact equal. typed-array-vs-JSON-object 첫 harness 실패는 보존하고 JSON-normalized 비교로 정정했다.
- root `/tmp/d344-kernel/full-root-first.log`: **2336 PASS, 0 FAIL, 6 existing SKIP, 2342 total**, duration253810.84675ms. full suite PASS를 전체 수치 정확도 정리로 확대하지 않는다.
- Medium `/tmp/d344-model/verification.json`: new default STEP tests2 + existing affected23 = **25 PASS**. Model/Studio types, Vite와 lint PASS. API export/generated checks는 root가 PASS를 보고했다. API surface는 production diff에서도 불변이다.
- Node STEP evidence는 실제 Offset target의 default native validation metadata와 strict import의4-face/4-ULP names를 확인한다. 이 검토는 source/verification boundary를 읽었으며 실제 mouse/worker/download browser flow를 대신하지 않는다.

## 성능 근거의 한계

`/tmp/d344-perf/comparison.json`을 읽었다. 같은 benchmark, Node22,7 measured batches, batch32 fresh uncached queries 조건이다. input bytes, strict check, topology/names/bounds/wholePatch classification이 old/new 동일하다. mass receipt 변경에 따른 fingerprint 변경을 geometry 변경으로 잘못 분류하지 않았다.

ordinary median 약−.15%, tiny median 약+6.02%가 관측됐다. 이는 한 로컬 old/new pair의7 batches다. 유의한 speedup/regression, tail SLO, UI latency 또는 일반 성능 향상은 주장하지 않는다. baseline은 production 편집 전에 확보됐고 candidate와 benchmark hash가 같다.

## 최종 범위

동결 구현과 독립 등록 oracle/test는 지정 수치 수정에 충분히 연결돼 있다. source 검토 PASS이며 blocking finding은 없다. 다만 full11fields exactness, central inertia, nonfinite/extreme geometry, 모든 surface/trim 경로의 universal quadrature accuracy는 미보증이다. 수정 후 actual browser/제품 qualification, checkpoint 및 publication은 root의 별도 단계다. 리뷰 세션의 runtime/tests/heavy/perf/browser: **NOT_RUN**.
