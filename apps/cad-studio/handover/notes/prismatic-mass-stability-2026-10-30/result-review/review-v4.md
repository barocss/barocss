# D343 cap source identity 독립 검토 v4

판정: **동결 v4 소스 검토 PASS. Blocking finding 없음. fresh full Kernel 및 실제 Studio 후속 검증은 별도 PENDING.**

Checkout `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, branch `local/cad-dev`. 검토 시작 checkpoint `3177950c40077de5b91c9965376636769417d830`에는 v3 circle 수정이 있다. 이 리뷰는 제품 소스 수정, heavy test, browser, commit/push를 실행하지 않았다.

## product 실패 경계와 보존

v3 보고서 `/tmp/d343-result-review/review-v3.md`를 변경하지 않았다. SHA256 `c0dd2a4eb7f0488afe6d0f3c23e43e0eb0911888458c732aeae221335d215a42`이다.

실제 Studio run-02는 tiny Offset preview/Apply와 corrected mass를 통과했지만 public face name uniqueness에서 FAIL했다. `/tmp/d343-studio/run-02/04-captured-thin-native.raw.json`을 읽었다. SHA256 `a4a669f0a634bd7957b66569aa6a396ce28042268b3542f6babb28f07ef3fb8f`이다.

- target b7: native solid/shell 각각 1개, closed shell 1개.
- 실제 public/Model volume `6.278163296415536e-15`, Cz `.3456789000000001`.
- native cap names `n1.bottom#1`, `n1.bottom#2`였고 public names는 `['n1.bottom','n1.bottom','n1.side0']`였다. Native subface 번호는 다르지만 공개 reference alias는 충돌했다.
- root가 failure image를 확인하고 browser/server를 닫았다. 이 리뷰는 raw JSON만 읽었고 screenshot/browser는 다시 실행하지 않았다.

run-02 FAIL을 수치 mass PASS와 분리한다. public unique-name assertion을 제거하거나 expected ambiguity로 바꾸지 않는다. 수정 후 Save/Open public reference 안정성은 실제 후속 flow가 확인해야 한다.

## 원인과 정확한 계약

`PrismaticCapSource`는 authored height z와 material regions 및 tag를 보관한다. normalize는 slab endpoint Set의 exact membership으로 source를 유지한다(`prismatic-solid.ts:55`). transform은 slab endpoint와 cap source에 같은 z 산술을 적용한다. Boolean도 exact level로 slab을 만들고 surviving cap sources를 보존한다.

그런데 B-rep cap 이름 선택(`prismatic-solid.ts:267`)은 기존에 `abs(cp.z-z)<=tol`을 사용했다. 두 distinct surviving levels가 기존 tolerance보다 가까우면 첫 source가 양 cap을 이름 붙인다. `/tmp/d343-cap-identity/lowlevel-baseline.json`의 실제 raw cap sources는 이미 `.3456789 → n1.bottom`, `.34567890000000023 → n6.bottom`으로 다르다. 손실은 raw cap provenance가 아니라 B-rep 이름 선택에서 발생한다.

Model display mesh는 `mesh.ts:64`에서 #suffix를 제거하고 `mesh.ts:129-132`에서 base names를 전달한다. 따라서 같은 base tag에 #1/#2를 붙여도 공개 reference alias는 복구되지 않는다. 각 stored level에서 원래 source tag를 골라야 한다.

## 동결 수정의 검토

production diff는 comment와 **`cp.z === z` 한 predicate**다. 이 exact 비교는 authored stored-height provenance를 사용한다. geometric tolerance, cap endpoint, slab normalization, native surface, curve, material region, mass 공식은 바꾸지 않는다. 새 epsilon, minimum, fallback proximity 또는 name suffix 체계가 없다.

기존 `.find()`의 source 배열 순서와 `cp.regions.some(inRegion)` 조건은 그대로다. 따라서 같은 exact level에서는 noncontaining source를 건너뛰고 첫 containing source가 우선하는 계약이 유지된다. exact level에 source가 없으면 기존 generated top/bottom fallback을 사용한다. 다른 nearby level의 source를 빌리지 않는다.

source와 geometry를 다시 쓰거나 public selectors를 우회하지 않는다. raw source tags에서 native face names와 edge references로 연결되는 기존 경로를 고친다. 같은 authored recipe를 저장하고 다시 평가할 때 이 조건은 deterministic하다. 실제 Save/Open 확인은 별도 product gate다.

## 새 테스트와 읽은 결과

새 `prismatic-cap-identity.test.mjs`는 공개 Core 생성/변환/Boolean/B-rep/selectors를 사용한다. production global/cache/private hook을 바꾸지 않는다. 8개 case는 다음 계약을 확인한다.

- 양수/음수 4 ULP interval, tolerance보다 작은 일반 gap, ordinary interval의 exact lower/upper tags.
- native strict closure와 Core public facing selectors의 distinct authored cap references.
- 실제 captured translated difference의 raw sources와 native names가 `n1.bottom`/`n6.bottom`으로 유지됨.
- same-level noncontaining-first 및 multiple containing source의 first-wins.
- nearby-only source가 반대 cap을 이름 붙이지 않고 기존 fallback을 사용함.

High가 동결 소스에서 실행한 로그를 읽었다.

- second build: PASS. 처음 build/focused는 cwd edit 실패로 old product source를 실행한 이력이며 final candidate 증거로 쓰지 않는다. `first-build-note.md`와 원본 로그가 보존됐다.
- `/tmp/d343-cap-identity/focused-third.log`: **8 PASS, 0 FAIL, 0 SKIP**. SHA256 `7d4ae4b135cc5d77a3e9c099066902fb6195554d9e40d65e158de3d8c1ea2f61`.
- `/tmp/d343-cap-identity/related-third.log`: **105 PASS, 0 FAIL, 0 SKIP**.
- High Kernel type-check 및 narrow lint: PASS. final receipt와 비어 있는 error 로그를 확인했다.
- `/tmp/d343-cap-identity/after.json`은 실제 run-02 accepted recipe를 fixed build로 재생한다. `geometry-mass-comparison.json`은 public names `[n1.side0,n1.bottom,n6.bottom]`, unique 3을 기록한다. lowlevel solid/mass, 실제 recipe 및 이름을 제외한 native B-rep는 exact-equal이다. 이는 Node 소비자 재생 증거이며 actual browser Save/Open 증거와 구분한다.
- 새 test의 rounded-pi mass guide는 exact equality가 1~2 arithmetic ulp 차이를 내자 8*Number.EPSILON relative 비교로 고쳤다. 이는 test mass guide의 오차 한계이며 production geometry/naming tolerance는 아니다. 이름 및 stored-height assert는 exact이다.

새 Core production 파일 변경이 있으므로 이전 full Kernel PASS만으로 최종 승인할 수 없다. fresh build/focused 뒤 **fresh full Kernel**이 필요하다. 이 보고서 시점 full Kernel, 새 Model/API/Studio build 및 실제 Save/Open/Undo/Redo reference 안정성은 root/Medium 단계 **PENDING**이다. 이 리뷰에서 직접 실행한 테스트/브라우저는 **NOT_RUN**이다.

## 동결 SHA256 및 한계

| Path | SHA256 |
|---|---|
| packages/barocss-cad/src/features/prismatic-solid.ts | 17f2b70b5ecbe0b1ab7912636d780fa1594469804f4af7fb48365212bc802f5a |
| packages/barocss-cad/test/prismatic-cap-identity.test.mjs | 01fbec53bd5d2b4c7423d75e7f186f0d93848155ea44d95c034f98a824923dbc |
| packages/barocss-cad/src/brep/solid-mass.ts | 19ec118c7f6096f738d246e5ca46095b42dd9bf7f67e341bcc6f735690141eac |
| packages/barocss-cad-model/src/app/nativeOffsetFace.ts | 2112393a89e38f9ff02e6fc3aaa2be6446e9bca31e87f1b2d4129c83b083c847 |

Core mass 및 v3 circle qualifier/actual result guard는 불변이다. 본 수정은 cap reference source identity에 한정한다. 전체 public naming 체계, 임의 STEP roundtrip alias, generic Boolean 정확도 또는 quadrature tiny-volume/tangent-centroid/inertia를 보증하지 않는다. quadrature 문제는 별도 **UNREPAIRED**다.
