# D344 native whole-patch quadrature 보정 보고서 초안

상태는 **BOUNDED_QUALIFIED**이다. 실제 run-02와 root의 이미지 4개 scoped 검토가 PASS이다. 문서 구조 검사는 통과했다. 문서 commit 뒤 일반 push를 진행한다. 첫 run-01 실패와 검증 계약 수정 이력을 보존했으므로 clean first-run PASS로 표시하지 않는다.

게시 기준은 `c0fea1174f71fc4f9e83ac4f53978d09884e0ef1`이다. 초기 로컬 소스 checkpoint는 `fbf8a7afb555ee7302bd3c6a6ed9e034a9a8b51a`이며 구현·테스트·도구 7개 경로를 포함한다. 검증 계약 후속 checkpoint `28a80e8695a92e92e5e50f6a5d34c569a02c0e5f`는 이 중 테스트·driver 2개를 수정했다. 전체 distinct 구현 경로는 7개이다. 일반 push와 exact remote 확인은 이 문서 commit 뒤에 진행한다. Remote CI와 release는 NOT_RUN이다.

## 문제와 원인 범위

실제 accepted native cylinder의 두 cap level은 .3456789와 .34567890000000023이다. 원래 native geometry는 strict-valid solid 1개, closed shell 1개, faces 4개, edges 6개, vertices 4개이다. curved sides 2개는 wholePatch를 사용하고 planar caps 2개는 planar 경로를 사용한다. 실제 side Gauss nodes는 572개이고 meshed fallback은 없다.

기존 native provider는 V 6.180191251439208e-15와 C [.10042170557247179, -.26839177431837347, .3456789000000001]을 반환했다. normal C가 구간 안에 있다는 관측만으로 tangent C 오류를 찾을 수 없다.

동일 stored nodes의 독립 Fraction 계산은 다음 층을 분리했다.

| 계산 층 | V |
| --- | ---: |
| 독립 native basis와 exact products | 6.2781632964155324e-15 |
| 관측 basis와 exact native products | 6.2781632964155324e-15 |
| 관측 world Pw, 이후 sums는 exact | 6.382222331984455e-15 |
| 관측 world U-column sums, 이후 계산은 exact | 6.180191251439208e-15 |

마지막 층은 실제 tangent C 오류도 재현한다. 이 fixture에서 normal derivative 상대 오류는 최대 약 27.96%이다. 따라서 누적 전에 world homogeneous products와 column sums에서 정밀도를 잃는다는 제한된 원인을 확인했다. 모든 NURBS·trimmed·fallback 질량 오류의 일반 원인이라는 주장은 아니다.

## 수정

기존 body-global centre를 wholePatch weighted poles 생성 전에 뺀다. projected local 좌표는 private local field accumulator에 직접 전달한다. 다른 world-coordinate caller는 같은 body centre를 빼는 wrapper를 사용한다. 관측한 no-rest 경로는 closed-body 전체 기여를 모은 뒤 fromCentre를 한 번 적용한다. 기존 meshed/rest의 total·squared·cubed group 변환은 그대로이며, 모든 경로에서 무조건 1회 호출한다는 주장은 아니다. face마다 다른 origin으로 closed-body 공식을 적용하지 않는다.

native CP, weights, knots, domains, topology, names, bounds와 전체 stored mesh는 바뀌지 않는다. quadrature nodes·degree rules·basis·classifier·기하 정책·fallback·method·density·units·errors·cache·API shape·schema·dependency도 유지한다. 새로운 tolerance, 최소 두께, centroid clamp 또는 volume factor가 없다.

후보 native 관측은 V 6.278163296415527e-15와 C [.12345669999999997, -.23456779999999938, .3456789000000001]이며 method는 quadrature이다. geometry 동일성은 전체 stored data를 비교했고 hash만으로 판정하지 않았다.

## 검사 결과

| 구분 | 결과 |
| --- | --- |
| 기존 알고리즘 등록 회귀 | 11개 중 6 PASS, 5 FAIL 보존 |
| 후보 등록 Kernel 회귀 | 11 PASS |
| 관련 Kernel | 81 PASS: mass/area 65개와 명시적 SI/boundary 16개 |
| Root 전체 Kernel | 2,336 PASS, 0 FAIL, 기존 SKIP 6개, 총 2,342개 |
| Kernel build/types/narrow lint/code-shape | PASS |
| 새 Model STEP 소비자 | 2 PASS |
| 관련 기존 Model | 23 PASS |
| Model 전체 types 및 새 테스트 lint | PASS, lint warnings 0개 |
| Studio types/Vite/driver lint | PASS, 기존 Vite warnings 및 console lint warning 1개 보존 |
| API inventory/agent tools/refusals | Root 보고 PASS, API shape 추가 0·제거 0·기존 변경 0 |
| 독립 수치·소스 검토 | 동결 진단과 shared-origin 계약 PASS. 구현 전 범위 |
| 최종 구현 review | 동결 source 696ec924… PASS, blocking finding 없음 |
| 실제 Studio STEP 브라우저 | run-02 PASS, root 이미지 4개 scoped UI-presence 검토 PASS |
| Metadata box 계약 후속 | focused 2 PASS·Model types·새 test/driver 검사 PASS. 제품 src 불변으로 기존 gate 재사용 |
| 문서 구조 gate | PASS |
| 문서 commit/push | 증거 파일 확인 뒤 진행 |
| 전체 Model·광범위 Studio suite·remote CI·release | 이번 전달에서 NOT_RUN |

Focused·related 검사는 전체 Kernel과 겹치므로 총 검사 수에 더하지 않는다. 독립 oracle의 정확한 권위는 stored native Gauss nodes에서 V/X/Y와 관련 derivative 계산이다. exact π, exact integration, 모든 11 integral fields, area sqrt, central inertia, 모든 finite 입력이나 fallback 전체를 증명하지 않는다.

## STEP 제품 경로

실제 Export STEP은 문서를 worker에 보내 exportStudioStep을 호출한다. Model은 BRep만 Kernel exportStep에 전달한다. upright mass나 nativeMassWire 결과를 override로 전달하지 않는다. 기본 geometric validation properties는 raw brepMassProperties(b, 1)와 brepSurfaceArea를 읽는다. 따라서 이미 수정된 D343 upright UI mass를 D344 native provider의 제품 증거로 재사용할 수 없다.

Node 소비자 검사는 번역된 R3/H5.00009 source에 실제 Offset command -5.00009를 적용했다. witness420의 합계가 tiny 기여를 숨기지 않도록 target만 내보냈다. STEP 기본 metadata는 독립 native-node reference와 맞으며 mm·mm²·mm³를 기록한다. 숫자 formatter는 binary64의 문자열을 사용한다. 이 fixture의 strict import는 solid/shell 1개, faces 4개, names와 exact cap levels를 유지했다.

Imported raw mass는 별도 provider로 기록했다. 이 fixture에서는 side wholePatch 2개를 사용하고 V가 같았다. Cxy 소수점 값은 별도 관측이다. 이를 모든 imported trimmed/fallback provider나 일반 STEP migration의 승인으로 확대하지 않는다. 실제 run-02는 target-only 사례에서 mouse·Offset Apply·toolbar·download·Undo/Redo·native Save/fresh Open을 확인했다.

## 성능 관측

같은 동결 benchmark, Node22.19.0, warm-up 3 batches, 측정 7 batches, batch당 fresh BRep 32개를 사용했다. setup/clone은 타이머 밖이다. 타이머에는 첫 mass query loop, 결과 배열 생성과 receipt 저장 1회가 들어간다. query당 값은 batch median/32이다.

| 사례 | 기준 ms/query | 후보 ms/query | local median 변화 |
| --- | ---: | ---: | ---: |
| ordinary | 0.37814715625 | 0.3775859375 | -0.15% |
| tiny | 0.32841275 | 0.3481745 | +6.02% |

7표본 한 쌍으로 유의성, 성능 acceptance, UI latency 또는 tail SLO를 판정하지 않는다. 속도 개선 주장도 없다. 이번 보정은 정확도를 우선한다. 기준·후보 입력 bytes가 같으며, mass receipt fingerprint 변화는 geometry 변화로 분류하지 않았다.

## 보존한 이력과 동결

기존 6 PASS/5 FAIL, 잘못된 작업 경로의 첫 build 시도, typed-array와 JSON 형태 비교 오류, 실행하지 않은 SI 테스트 이름, benchmark syntax command의 중복 상대 경로와 기존 unused 상수 lint 오류를 보존했다. 이들은 제품 실패와 구분했다. 실제 존재하는 SI/boundary 파일은 별도 16 PASS로 검사했다. 최종 benchmark bytes로 기준을 다시 측정한 뒤 후보와 비교했다. 최종 Node STEP 단계에는 첫 runtime 실패가 없었다. 실제 run-01은 mouse selection·Offset·tiny export 전에 실패했다. 첫 ordinary STEP의 metadata box max Z는 5.345768900000001이고 authored native cap은 5.3457689였다. High의 실제 파일 probe와 독립 box review가 source/import의 strict geometry·CP·cap level·names가 정확함을 확인했다. 곡면 extrema 평가의 1-ULP 외측 확장으로, metadata box를 cap plane과 exact 동일시한 oracle이 과도했다.

새 Model test와 driver만 수정했다. Metadata box는 finite·ordered여야 하고 모든 native vertices와 normal endpoints를 strict하게 포함해야 한다. Normal 외측 확장은 기존 CadNumericPolicy.linearTolerance 1e-7 이하여야 한다. Native/import cap levels·4-ULP 간격·strict closure/counts/names·V/C reference 검사는 유지했다. Core·STEP writer·quadrature·benchmark는 바꾸지 않았다. 첫 파일·실패·이미지·source checkpoint를 보존했다.

## 실제 run-02

Chrome 1개, serial contexts 2개, observations 10개, native reads 4개, 실제 STEP exports 3개와 native Save 1개로 downloads 4개 및 native file 1개를 기록했다. 실제 mouse pick 1개와 Offset 1개, Undo/Redo, fresh native Open을 수행했다. 이 수는 테스트 수가 아니다.

실제 tiny 다운로드 metadata는 V 6.278163296415527e-15와 C [.12345670000000014, -.23456779999999966, .3456789000000001]이다. Tiny export와 fresh-Open export metadata는 parsed semantic 값이 정확히 같다. Native/import cap levels는 정확히 [.3456789, .34567890000000023]이며 strict-valid faces 4개와 names를 유지했다. Tiny metadata box max Z .3456789000000003은 정당한 1-ULP 외측 enclosure이며 authored cap plane이 아니다.

Root는 original STEP·preview·tiny STEP·fresh STEP 이미지 4개를 직접 확인했다. Scoped visual PASS는 UI presence와 동작만 의미한다. 이미지나 반올림된 label은 4-ULP 두께 또는 raw native mass를 증명하지 않는다. 다운로드 metadata의 독립 검사와 strict geometry readback이 별도 권위이다.

Page errors·console errors·watched source changes는 0이다. Initial subset 14개에서 frozen source 978개로 확장했고 after/cleanup 978개 hash가 일치했다. 모든 context·browser·server를 닫았다.

동결 source SHA는 quadrature `696ec924bc4f1d7b74862533676af5e4c0b8a2a284a8a249ea7007dade4c8ed5`, mass `19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac`, cap `17f2b70b5ecbe0b1ab7912636d780fa1594469804f4af7fb48365212bc802f5a`, benchmark `37d81a207f097d7cb35d859200db64f716d0c38d30ed8a79b3d79e60ab4c39a9`이다.

근거는 [Kernel 검증](kernel/receipt.md), [원인 분석](kernel/diagnosis.md), [성능 비교](perf/comparison.ko.md), [Model 검증](model/verification.ko.md), [구현 검토](review/implementation-review.md), [bbox 계약 검토](review/step-box-review.md), [실제 흐름과 이미지 검토](root/flow-review-run02.json)에 있다. 원본 로그는 gzip으로 보존하며 source-provenance.json이 저장 위치와 원본 해시를 연결한다.

이 native quadrature 결함은 제한된 범위에서 검증됐고 문서 구조 검사도 통과했다. 문서 commit과 일반 push는 증거 파일 확인 뒤 진행한다. 다음은 ordinary remaining08이며 /tmp/d345-plan의 High 작업은 source-only 계획이다. 구현 완료가 아니다. 그 실제 남은 gap은 증거로 결정해야 한다. D344는 item16 전체 또는 native quadrature 전체 완료를 뜻하지 않는다. 09는 08 이후이며 Electron15는 queue에 남아 있다.

최종 문서 구조 검사는 통과했다. 저장된 증거와 공백 검사를 마친 뒤 문서를 commit하고 일반 push를 진행한다. 원격 HEAD는 push 후 별도로 확인한다.
