# D325 A08/#2239 clipping 작성자 영수증 검토

**APPROVE_BOUNDED_AUTHOR_RECEIPTS.** exact `f841c0c34a1897a88fd75a14d5fe53521181f858`의 SDK scene-unit 닫힌 near/far 계약과 기록된 base-raster/CPU/native GPU pick 결과를 한정 수락한다. 새 실행은 없다. 현재 `fd3e0e3ad639ebd96dd1985e0a2c24810c52a6e5`의 GPU/Viewer 전체는 author와 delta0이지만 이것을 현재 전체 런타임 PASS로 확대하지 않는다. #2239의 기존 transfer closure는 수정 수락이 아니며 변경하지 않았다.

시작/종료 제품 상태는 untracked `.claude/`뿐이다. 최신 state/ledger/reporttail, root/scoped 지시와 roadmap D325/A08/#2239를 읽었다. 이전 `runs/viewer-001/receipt.json`의5463dbf 실제 WebGPU/CPU pick 불일치는 과거 증거로만 재사용한다. 현재 결함으로 재보고하지 않는다. 제품/state/ledger/기존 증거/프로세스/탭은 변경하지 않았다.

## 증거 결속

note의 보존 파일77개가 author f841 Git bytes와 모두 같다. root/consumer manifest 참조118개는 고유 경로76개/중복42개이며 size/hash 불일치0이다. root manifest 자체까지 포함한77개는 내용 hash51종이다. image16개는 내용 hash3종이며 baseline4소스+driver2의 gzip capsule6개도 해제 후 hash/원래 Git 내용에 결속된다. source/test/package15개를 author Git에서 읽었고, source-profile/final-source/candidate/baseline/capsule/driver44참조(고유 commit/path/content18) 불일치0을 확인했다. 이 숫자는 실행 검사 수가 아니다.

final native driver capsule은 실제 f841 committed browser driver와 같다. critical6 source hash와 API expected 전후 hash도 각각 f841/d855 Git에 맞는다. final receipt의 SDK12개, Core 결과, cameraGuard가 final-validation 요약과 정확히 같다. raw receipt 전체 hash가 pixel/depth/ref/instance/face 입력·출력을 묶는다. 독립 reread/hash 검토이며 새 실행이 아니다.

중요 결속 한계: author는 esbuild bundle inputCount581/hash `f0ca1580af1182884a05820d44699782ec75e39100a8e211d2f72a2b14b29a5c`를 기록했으나 실제 bundle bytes와581개 전체 metafile/input hash graph는 보존하지 않았다. critical6+driver 결속을 전체 sourcegraph로 부르지 않는다. GPU camera29는 `../dist/index.js`를 읽지만 emitted dist hash도 없다. GPU build/types exit0 영수증과 소스/driver hash를 emitted bytes 증명으로 대체하지 않는다. SDK11과 display26은 실제 own-source esbuild loader를 사용한다.

## 계약이 실제 경로에 도달하는가

- SDK `presenter.ts:175–182`가 caller의 near/far를 Core Camera에 전달하고 autoClip=false를 설정한다. mmToSceneUnit은 geometry에 적용되며 camera clip을 다시 scale하지 않는다. SDK는 perspective camera만 제공한다.
- Core `camera.ts:35–54`가 manual range를 검증하고 finite perspective depth 두 계수를 바꾼다. d를 forward axial depth라 하면 reversed depth는 `near*(far-d)/((far-near)*d)`다. near→1/far→0이다. orthographic은 기존 `(far-d)/(far-near)`이며 negative/−0 near를 허용한다. autoClip=true 기본 분기는 기존 scene-fit near와 infinite far를 유지한다.
- `viewer.ts:1819–1850`의 prepareCamera/clipCamera는 manual mode를 auto-fit으로 덮지 않는다. SDK `index.ts:2130–2142` CPU pick은 각 candidate의 axial depth로 `<near || >far`를 건너뛴 후 nearest를 갱신한다. clipped 앞면이 있어도 뒤 candidate 검색을 계속한다. raw Core raycast는 원래 geometric query로 남는다.
- `viewer.ts:574–578,1329–1332`는 실제 manual pick pipeline/fsManual을 선택한다. shader `pick.ts:20–28`은 fragment `@builtin(position).z`가0일 때 **depth test 값만** `bitcast<f32>(0x00800000u)`(2^-126)로 올린다. r32float raw output은0이며 IDzero만 background다. strictgreater와 draw order는 유지한다. cap entry도 추가됐지만 cap 전체는 수락하지 않는다.
- `viewer.ts:1911–1965`는 pick camera snapshot에 autoClip을 넣고 실제 map read→unmap 뒤 stale 검사→unproject/triangle/face 재구성을 한다. autoClip만 바뀐 pending hit도 거절한다.

`math.ts:43–53`의 Float64 projection은 `lights.ts:134–137` packFrame에서 Float32로 변환된다. shader의 z==0은 **양자화된 fragment viewport depth**의 정확0이다. 모든 analytic far-plane point가 임의의 floating profile에서 정확0이 된다는 증명이 아니다. min-normal 치환은 새 geometric tolerance나 다른 양의 depth의 clamp가 아니다. 이 소스와 단일 정수 경계 관측으로 일반 경계 정확도를 선언하지 않는다.

manual finite의 visible grid/positive SSAO/contact/enabled DoF는 CLIP_INVALID, active/creating pathtrace와 trace creation은 PATH_TRACE_UNSUPPORTED로 제한된다(`viewer.ts:1825–1880`). async creation 후 unpublished session dispose/finally pending 해제도 있다. CPU에서는 실제 session factory에 구조적 fake device/pipeline/work controls를 사용했다. 해당 refusal/ownership 근거는 shader/native effects 결과가 아니다.

## 실제 author 결과와 원래 numerical policy

SDK native는 정면 depth6 square 하나를 scales1/.001 두 번 만들었다. 각 scale에 control(near.01/far100), near제외(7/100), far제외(.01/5), closednear(6/12), closedfar(3/6), restored를 관측했다. visible 경우 covered9600/ref audit/audit_patch/distanceScene6이고 제외 경우 covered0/picknull이다. readPixels는307200bytes이며 중심 RGBA는 visible[51,138,201,255]/excluded[9,14,23,255]다. center shared triangle edge의 approximate/ambiguous=true를 보존한다.

별도 public Core native triangle은 automatic/finite manual 모두 face71/triangle0/duplicate instance0을 반환했다. manual3..6의 raw depth는0이고 point는[0.009099255856655188,−0.009099255856655025,0]이다. GPU pick은 pixel center(+0.5)를 사용하므로 이 raw point를 SDK CPU의 canvas160/120 중앙점과 같은 numeric oracle로 비교하지 않는다. Core world point의 독립 수치 수락도 없다.

native guard는 원래 mapAsync 호출/receiver/args/result를 유지한 뒤 fulfilled return만 보류했다(`browser driver:101–129`). autoClip false→true 동안 delayedpick은null/unmap1, manual 복원 freshpick은depth0/face71/instance0/unmap2다. 이는 실제 GPU bytes를 지어낸 mock 결과는 아니지만 자연 readback failure/device-loss/OOM의 증거도 아니다. 이번 검토는 보존 driver를 읽었고 prototype instrumentation을 실행하지 않았다.

원래 policy를 변경하지 않았다. SDK CPU close1e-10, accepted projection slack1e-12, raw Core ray z1e-9, native SDK distance `<1e-8`, 기존 GPU camera close1e-5다. native coverage는 background RGB 절대차 합>12, visible>100/excluded===0이다. coverage/중심색과 PNG 동일성을 전체 pixel-byte identity로 확대하지 않는다. SDK admission의1e-4≤near<far≤10000, finite, 원래 Float32 OpenGL endpoint 검사1e-3/axes1e-5도 유지한다. 이는 Core reversed projection 전체에 대한 새 공차가 아니다.

**시각 reread:** baseline near-excludes PNG에는 blue square가 남고 final near-excludes에는 배경만 있다. final closed-far에는 blue square, Core exact-far에는 red triangle이 보인다. 위4개 PNG를 실제 열었다. 보존 PNG를 읽은 결과이며 새 browser/UI/geometry 검사는 아니다.

## 개수·실패·SKIP 경계

| author 기록 | 검토한 범위 |
| --- | --- |
| native baseline | selected1, pass0/fail1/skip0. near7과far5에서 covered9600/CPU null. 최초9600≠0 제품 실패 보존 |
| final native | selected1, pass1/fail0/skip0. SDK12관측+Core/guard가 같은 테스트 안에 있음 |
| GPU normal CPU | 최초357중355PASS/2FAIL. partial test owner에 Camera가 없어 autoClip 읽기 실패 |
| GPU related final | display26/camera29 모두PASS. 각각 전체 이름26/29개가 최초357에 포함되므로 합산하지 않음 |
| SDK CPU | 최초10중8PASS/2fixtureFAIL(background.top). 실제 Core setter 사용 후10PASS, admission 추가 최종11PASS |
| producer/metadata | build/types/lint/docs reported exit0; compile failure 보고 없음. 최초 harness lint no-this-alias와 API IV001 expected18/actual19는 보존 |

최종 wholeGPU runner는 없다. SDK11은 별도 신규 test file의 실제11개이며 집중 반복10+10+11을31개로 더하지 않는다. native12관측을12tests로 세지 않는다. browser driver는 CHROME/PW_DIR 누락이면 assertion이며, `requestAdapter`가 없을 때 명시적 SKIP 경로(`:42–43`)도 있다. 이 author native 실행의 실제skip은0이다. 새 SDK package script는 이 CPU file만 등록한다. 일반 affected CI의 runtime 제외와 remoteCI NOT_RUN은 유지된다.

availability adapter는 driver의 별도 requestAdapter가 보고한 Apple metal-3이다. 실제 SDK/Core Viewer가 선택한 device의 identity는 **UNKNOWN**이다. Chrome156.0.8078.48/DPR1의 선택 profile 수락과 다른 adapters/browsers/DPR 수락을 구분한다.

## 미수락과 다음 checkpoint

CPU off-axis(point[3,0,0], axial6 vs distance√45), 두 square 앞범위밖/뒤범위안, Core orthographic/negative-near 전환은 CPU source fixture 근거다. **native off-axis/orthographic/two-square/near·far 경계를 가로지르는 polygon**은 NOT_RUN이다. native 전체 near/far crossing polygon clipping/임의 f32 ratio·nextafter/세계좌표 공차·caps/probe/masks/effects/pathtrace combinations도 수락하지 않는다. 이번 source review에서 새 결함을 확정하지 않았다.

전체581 input graph/emitted dist binding은 미보존 gap이다. 범위를 확장할 때 그 결속과 요청된 missing native profile만 추가해야 한다. 같은 selected native 성공을 반복할 이유는 없다. 그 외에는 기존 D326 receipt 검토 또는 DA-DUP-1 새 repairSHA 수락 순서를 유지한다. #2239를 재개하거나 상태를 바꾸지 않는다.

독립 build/test/browser/server/heavy guard/runtime는 모두 NOT_RUN. 설치/liveAI/agent/product edit/remote post 없음. 이번 단일 note와 참조 검토 후 종료한다. reviewer의 정적 수집기 최초 KeyError(driver)는 baseline profile이 sources/driverCapsule 구조인 점을 잘못 가정한 오류였다. 실제 schema를 읽고 hash 수집만 보완했으며 제품/런타임 재시도는 없다.

[검증 JSON](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/verification/d325-viewer-clipping-receipt-review.json) · [전체 hash audit](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/d325-receipt-review-20261029T095520/hash-audit.json) · [보존 raw값 대조](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/d325-receipt-review-20261029T095520/retained-data-comparison.json) · [test-name 중복 대조](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/d325-receipt-review-20261029T095520/test-count-review.json)

## 핵심 author source SHA256

| 파일 | SHA256 |
| --- | --- |
| `packages/barocss-gpu/src/viewer/camera.ts` | `73d7f311c4e0f65d3755be2364d26dd8dfdf8e39bd894a2757bce39d0ab6ee0a` |
| `packages/barocss-gpu/src/viewer/viewer.ts` | `3a67717a03e84782b247d1eb6d0f02d000b84b98134be8df38159b7c994a0c24` |
| `packages/barocss-gpu/src/viewer/shaders/pick.ts` | `f56f935d60c540ee3f4fbe40038e459405fb856c63452eaff729acdbe1d36c4b` |
| `packages/barocss-viewer/src/presenter.ts` | `2c321cd8753dacc1332cdb491d068ec0636fabf616fca60b687c702bba30f54f` |
| `packages/barocss-viewer/src/index.ts` | `ec81a4222a69b3859fbe16203c07cc1606fa99aa504c8fa521a3ea0c3f114a91` |
