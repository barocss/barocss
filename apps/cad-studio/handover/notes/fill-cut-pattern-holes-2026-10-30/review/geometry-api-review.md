# D345 bounded hole mask 독립 geometry/API 검토

판정: **동결 Kernel·Model source와 독립 oracle/test 검토 PASS. Blocking finding 없음.**

범위는 existing08 Fill CUT의 bounded world-XY reference-point mask다. full-tool containment, curved/frame/multiregion 지원 또는 whole08 완료를 뜻하지 않는다. 실제 Studio/browser와 root full/API qualification은 별도다.

검토 checkout `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, baseline `89b845615320f531b9f62154a3972cda30f90472`. 이 리뷰는 제품 source/test/동결 로그만 읽었다. runtime/tests/heavy/browser/build/commit/push 및 제품 소스 수정은 NOT_RUN이다. 보고서는 `/tmp/d345-review`에만 기록했다. D343/D344 artifacts는 수정하지 않았다.

## 권위 계약과 API

root의 고정 계약이 source plan의 empty-hole 권고를 덮어쓴다. **raw region.holes:[] 및 명시적 undefined는 INVALID**다. 반면 **SketchNode.holes:[]는 no-hole snapshot의 field omission**으로 처리한다. 이 차이는 Core min1 admission, Model snapshot 및 양쪽 tests와 일치한다. 기존 no-hole snapshot은 `{points}` 그대로다.

공유 `FillFeaturePatternRegion`에 readonly nested numeric XY holes만 추가한다. 기존 public spec/Part/Core/Model doc가 같은 type과 snapshot을 사용한다. 새 verb/backend/export/schema version 또는 dependency는 없다. count/product64, 기존 public positive spacing 및 Core signed-spacing 계약을 바꾸지 않는다.

각 ring은 기존 native3..16 simple straight-loop qualifier를 사용한다. 전체 outer+holes vertices<=16이며 holes max4는 최소3vertices에서 도출된다. 좌표는 기존 finite binary64 ±10000 policy다. 16-vertex outer와 추가 hole을 동시에 허용하지 않는다. 이것을 새로 측정한 최대 처리량이나 성능 한계로 표현하지 않는다.

## exact geometry 판정

각 ring 자체의 simple boundary와 기존 conservative refusal은 unchanged qualifier에 맡긴다. 새 cross-ring predicate는 이미 admitted exact points의4 orientation과 coordinate-order onSegment를 사용한다.

- strict opposite signs 양쪽이면 proper crossing이다.
- orientation0만으로 contact로 보지 않는다. finite segment의 양축 coordinate interval 안에 해당 endpoint가 있을 때만 boundary contact다.
- 따라서 disjoint collinear extensions는 허용하고 true overlap/shared vertex/T-contact는 거절한다.
- AABB가 겹치고 하나의 orientation이0이어도 finite contact가 없는 두 hole-edge case가 새 test에 있다. 단순 AABB separation만 검사하는 구현이 아니다.

cross-ring boundaries가 모두 disjoint이며 각 ring이 simple인 뒤, hole vertex 하나의 strict-inside-outer 분류는 ring 전체 containment에 충분하다. hole pair는 두 방향 representative classification을 모두 사용해 nesting을 거절한다. crossing만 검사해서 nested hole을 놓치는 경로가 없다. outer/hole touch, overlap, coincident/duplicate holes, nesting, self-cross/backtrack는 거절한다. 샘플링이나 epsilon은 없다.

3-way pointClass는 기존 exact ray/boundary arithmetic을 유지한다. 추가 cell은 outer inside 또는 boundary일 때만 검토하고, 어느 hole의 inside 또는 boundary이면 제외한다. winding과 hole order에 의존하지 않는다. 원래 seed는 mask를 보기 전 unconditional skip이므로 이미 있는 source CUT가 항상 유지된다.

## grid·work·ownership

reference는 **authored anchor + represented binary64 offset**의 exact rational sum이다. offset 자체는 기존 Number `i*spacing,j*spacing2` 값이며 실제 cutter placement도 같은 represented offset을 받는다. 이는 전체 tool body 또는 rounded world-coordinate centre가 mask 안에 들어가는지 검사하는 기능이 아니다. Number anchor+offset으로 먼저 반올림하는 의미로 바꾸지 않았다.

j-major/i-minor enumeration과 원래 `@i,j` suffix를 유지한다. 제외된 cell 때문에 뒤 cell의 index를 compact하지 않는다. count1/zero extra에서도 region snapshot과 active CUT source 검사는 끝난다.

구조적 accepted-input 한계는 다음과 같다.

- native intra-ring nonadjacent pairs와 모든 inter-ring pairs 합은 N(N−3)/2<=104.
- adjacent turn checks는 N<=16.
- representative containment edge visits는 최대52.
- 63 nonseed candidate가 최대16 edges를 방문하므로 mask edge visits<=1008.

대표점 qualification은 기존 outer-only보다 추가 work다. 이 수치를 동일 CPU 비용이나 benchmark PASS로 주장하지 않는다. bounded invalid-input copying/descriptor reflection과 accepted geometry work도 구분한다.

Core는 own data descriptors로 region/rings/points/anchor를 복사한다. sparse/extra/symbol/accessor fields를 거절하고 getter를 호출하지 않는다. 원래 caller ring/point를 geometry qualification이나 placement에서 다시 읽지 않는다. 새 exact helpers는 module-private이며 hot grid walk에 새 closures/callback allocation을 넣지 않는다.

## Model integration 검토

`fillRegionSnapshot`은 기존 rectangle/polygon/straight line-loop outer extraction을 유지하고 numeric/parameter-resolved straight holes를 같은 shared spec으로 보낸다. 모든 nested arrays와 coordinates가 새 owned numeric data다. live sketch reference나 association이 snapshot geometry로 들어가지 않는다.

holes<=4 및 total16을 line kind/start/coordinate를 읽기 전에 확인한다. curves, other regions, non-world-XY frame, on/association 및 suppressed source는 계속 거절한다. original hole sketch를 바꿔도 accepted feature는 그대로이고 explicit existing editor reselect 때만 새 snapshot을 만든다.

검토 중 picker의 기존 direct node.kind prefilter가 accessor를 호출할 수 있음을 owner에게 전달했다. 최종 source는 descriptor-based fillRegionSnapshot만 사용한다. source kind/hole/segment kind/start/coordinate/parameter getter0 tests가 이를 확인한다. 이는 기존 picker 경로의 작은 경계 보완이다.

existing create command는 검증 뒤 structuredClone(node)을 저장한다. saved-document shared guard는 suppressed/nested/pending fill nodes에도 shared spec을 적용한다. file/wire/flatten/reopen 경로에서 holes admission을 건너뛰는 새 경로는 없다. commands.ts production diff는 hint/empty text 두 문자열뿐이다. App/GPU/직접 편집 UI를 바꾸지 않는다.

## 독립 oracle와 실제 읽은 테스트

High가 실행한 `/tmp/d345-plan/oracle.mjs`는 CAD import 없는 integer classifier와 rational stock-minus-disjoint-prism moments다. source/output hash 연결을 `executed-oracle-sha256.json`으로 읽었다. source SHA `dacace43c2907a849d3c9dd8d01062adc53177dd6651eb97491c8700ddceaa42`, output SHA `4955c838aa6b2e179e49f9320a7a2c7a65afaf00800af9f201c15cd102f26185`다.

- spacingY10: cells[(0,0),(1,0),(2,0),(0,1),(3,1),(0,2),(3,2)],7cuts,V22950,C[545/18,6161/306,5]. plan의9265/306은 같은 reduced fraction이다.
- spacingY12:9cuts,V22650,C[9159/302,6007/302,5].

첫 oracle failure는 reduced fraction과 unreduced literal의 structural equality 오류였다. canonical expected string만 고쳤고 material formula/placement는 바꾸지 않았다. 첫 source/output은 보존했다.

Kernel 새9tests는 geometry V/C 외에 모든 expected cutter corners, native references, masked suffix 부재, native save/load/edit, winding/order, boundary/adjacent binary64/MIN_VALUE exact sum, unconditional seed, tool-crosses-hole case, collinear extension, four holes/total16, malformed topology, getter0 및 no-extra source activity를 검사한다. integer oracle를 fractional case에 적용한 첫 test 실수와 no-extra exact mass bit equality 실수는 보존하고 각 권위에 맞게 고쳤다. production tolerance를 늘리지 않았다.

Model 새6tests는 실제 profileOf producer의2holes, integer winding/physical moments,7→9 binding, source-edit independence와 explicit reselect, actual command/file/wire/flatten/nested/suppressed guards, empty-hole 차이 및 accessor0를 검사한다. 중복 구현만 검사하지 않고 실제 native corners/public names와 source/selection invariance를 확인한다.

읽은 owner logs:

- Kernel clean build, new9 PASS0FAIL0SKIP, existing related22 PASS0FAIL0SKIP, types/lint PASS.
- Model new6 PASS0FAIL0SKIP, affected87 PASS0FAIL0SKIP, types/lint PASS.
- old built source의 holes admission refusal(Core INPUT/API VALUE)은 baseline-first.json에 보존됐다.
- reviewer 자체 runtime/tests/heavy/browser는 NOT_RUN이다.

실제 mouse sketch authoring, preview/cancel/Apply/Undo/Redo, native Save/fresh Open 및 editor reselect의 Studio product proof는 아직 별도 PENDING이다. producer function test나 API/native file test를 그 browser PASS로 확대하지 않는다.

## 동결 SHA256

| Path | SHA256 |
|---|---|
| packages/barocss-cad/src/features/fill-cut-pattern.ts | 0fec3fd49214621265507db89229fe957cfa6aef2ad0e1ccf42150ebd1e0684f |
| packages/barocss-cad/test/fill-cut-pattern-holes.test.mjs | 4d8532335753f13244767c27666c404ebad61122341d65bc2f08c3697ecd5cfe |
| packages/barocss-cad/test/helpers/fill-cut-holes-oracle.mjs | 58316e6f154ecdc7014b7b800391a5b51d8517f71a688f42613bb7eebc6a6dd4 |
| packages/barocss-cad-model/src/engine/fillFeaturePattern.ts | ba0cf70af894f67e508d01a4ecfdcae8bc09476f8331fa6d2bef9da963ef2f05 |
| packages/barocss-cad-model/src/app/commands.ts | 2e446d417d4b70e67e015206a33f02750075e019871dc95c57acb5de02d5914c |
| packages/barocss-cad-model/test/fill-feature-pattern-holes.test.ts | 923a2a6b1f1e8fea5f64ae7f1091bd37641b39bef10bc21ee0bd8eae25710c71 |

6개 current source/test hash는 owner frozen hashes와 일치한다. D344 quadrature696ec924…/mass19ec118c…/cap17f2b70b…/benchmark37d81a20…도 불변임을 직접 hash로 확인했다. root full suite/API inventory/docs/publication은 이 source review와 별도 gate다.
