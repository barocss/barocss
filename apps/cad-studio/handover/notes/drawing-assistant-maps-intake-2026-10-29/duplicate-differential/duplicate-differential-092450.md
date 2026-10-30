---
work_id: drawing-duplicate-differential-20261029T092450
artifact_type: focused-runtime-differential
status: defect_reproduced
owner_role: Sol-High-investigator
last_updated: 2026-10-29
---

# DA-DUP-1 미실행 차등 검사 완료

**결과:** exact `4428c79a87a6f0152db1cc00e73bcd68735aac2e`에서 첫 구멍의 d3는15를 유지했고, 둘째 구멍의 d9만15→17로 바뀌었다. 이 pair의 DUPLICATE는 사라졌다. d9가 없는 기존 도면은 두 구멍이Y15일 때 issues[]를 반환하지만, 둘째 구멍을Y17로 옮기면 `HOLE_NOT_LOCATED` right1개를 반환한다. **독립 target의 위치 누락을 같은 좌표값으로 숨기는 coverage 결함을 실제 런타임에서 확인했다.** 기존 P2 DA-DUP-1의 보강 증거다. 새 결함 이슈나 수정 수락은 아니다.

## 원래 실패와 새 실행의 구분

091150 원래 receipt는 FAIL 그대로다. 이번 준비 전후 hash가 같음을 확인했다. 당시 실패 원인은 정상 sig20개 추가를 거부한 harness 가정이었다. 이 보고서는 원래 FAIL을 PASS로 바꾸지 않는다. 별도 새 runner와 출력 폴더로 당시 NOT_RUN이었던 차등만 실행했다.

latest state.json/issue-ledger.json, source root/scoped 지시, roadmap의 DA-DUP-1 등록을 읽었다. 시작/종료 HEAD는4428c79a로 같고 제품 dirty는 untracked `.claude/`뿐이다. CAD/Model의5c965→4428 delta0이며 owner repair는 없다. existing#2243 댓글6492887434/CG5/O26/RS7.6 등록은 부모 기록으로 재사용했다. 외부 게시나 재전송은 하지 않았다.

## 실제 입력과 보존 순서

기존 accepted.bcad를 읽고 공개 exported dispatcher `features {action:'edit', index:4, feature:…}`를 한 번 호출했다. n4.center[0]만15→17로 바꿨다. 원래 circle profile/plane/radius, 다른 nodes와 parameters를 유지했다. dispatcher는 proposal 재생/도구 테스트 경로이며 Studio approval/UI 검사가 아니다.

runner는 편집 반환값과 edited document를 먼저 저장한 뒤 즉시 `drawingInputs → issueContext → drawingIssues`의 실제 resolved 값/참조/issues/holes를 저장했다. 그 다음 기존 DA1c after.bcad(d9없음)를 읽어 equal-coordinate 결과를 저장했다. unequal 대조는 지원되는 `drawingInputs(editedDoc, readDrawing(retainedDoc.drawing))` overload로 **같은 기존 annotation set**을 편집 모델에 투영했다. 문서/geometry를 대체하거나 새 fix/removal API를 호출하지 않았다. 각 raw 결과는 assertion 판정 전에 보존됐다.

실행 직후 receipt를 `receipt-runtime-original.json`으로 byte 보존했다. `receipt.json`의 추가 inputControls와 `public-api-input-controls.json`은 실행 뒤 provenance 설명이며 run1/최초 실패/판정을 변경하지 않는다. 원본문서·설정·policy hash와 실제 public API 경로를 이곳에 명시했다.

주요 raw 파일: `before-edit-resolved.json`, `edit-input.json`, `edit-result.json`, `edited-document.json`, `after-edit-resolved.json`, `equal-coordinate-retained-coverage.json`, `unequal-coordinate-retained-coverage.json`, `observations-before-verdict.json`.

## 결과와 판정

| 조건 | 실제 결과 | 판정 |
| --- | --- | --- |
| 단일 authored 입력/기존 reference 의미필드 | n4.center[0] 하나만15→17; 기존 edge/near/at/ID/place 유지 | PASS, 지원 계약 |
| 정상 metadata | 알려진 reference20곳에만 sig 추가; final-body signature와 원래 toSig 변환의 exact deepStrictEqual | PASS, metadata 계약 |
| 전체11개 치수의 차등 | d3=15→15, d9=15→17; 다른 표시값 동일; pair DUPLICATE 없음 | PASS, 독립 의존성 |
| d9없는 기존10개 annotation, holeY15/15 | checker issues[]; 위치 누락 경고0 | **FAIL, 제품 coverage 계약** |
| 같은10개 annotation, holeY15/17 | right `HOLE_NOT_LOCATED` 1개; retained10개 표시값 유지 | PASS, 음성 대조 |

이 표의 행은 한 fixture/한 finite 실행의 조건이다. 별도 테스트5개 또는 새 shape profile로 세지 않는다. receipt의 checkgroup은3PASS/1FAIL이다. signature 검사는 첫 support group 안에 포함된다. 전체 상태는 `DEFECT_REPRODUCED_EQUAL_COORDINATE_COVERAGE_FAIL`이며 run exit1이다. 실행 자체는 완료됐고 harness/support failure는 없다. 최초 실패는 equal-coordinate 위치 누락 경고를 기대했지만 없었던 **PRODUCT_CONTRACT** assertion이다. 경고 없음은 gate 성공으로 세지 않는다.

실제 before/after resolved d3는 target `n0.leg1.a|n2.side0#2`, d9는 `n0.leg0.a|n5.side0#2`를 유지한다. 첫 hole은 top[25,15], 둘째는 right[15,20]→[17,20]다. 저장된 raw value도 d3=15, d9=17이다. 반올림 face summary를 기하 oracle로 사용하지 않았다.

## 소스와 의미

`issues.ts:601–612,621–626`의 duplicate key는 axis/span/count가 같고 feature 집합이 disjoint가 아니면 삭제 remedy를 만든다. 이 입력은 공통 stock n0 때문에 별도 hole target n2/n5가 같은 측정으로 처리된다. 같은 hole의 정투상 반복과 구분하지 못한다.

`issues.ts:635–644`는 축별 endpoint 좌표만 모은다. `:682–684`는 그 좌표가 있으면 hole을 located로 본다. d9를 삭제한 annotation set의 Y15는 첫 hole d3에서 온다. 둘째 hole은 d10의Z20과 d11의직경5.5만 남는다. 이번15/15→15/17 결과는 feature target 대신 같은 수치의 존재가 coverage를 결정한다는 소스 설명을 실제로 뒷받침한다.

치수 resolver `drawing/dimensions.ts:68–76,169–175`는 이름이 같은 현재 edge의 중심을 해석한다. 실제 d9가17로 바뀐 결과는 두 위치치수가 별도 입력을 기술한다는 이전 소스 판단을 보강한다. 전체 수치/제조 정확도를 입증하지는 않는다.

## source 결속·공차·cleanup

현재 committed CAD/Model/config/fixtures/assets2767개를 새 own Git archive snapshot에 고정했다. 파일별 Git blob/SHA256 일치와 workspace link2개의 내부 target을 확인했다. 실제 bundle681=고정 제품소스680+own runner1, mutable dist0/외부 제품소스0이다. manifest와 compiled-input audit를 보존했다. 기존 Nodev22.19.0/esbuild0.25.12 도구만 사용했고 설치는 없다. 실행 binary/script SHA256은 run-inputs.json에 있다.

새 numerical tolerance는 없다. authored integer15→17, 표시 문자열15/17, ID/reference, deepStrictEqual 계약을 비교했다. 제품 원래 SAME=1e-6과 toSig의 원래 metadata rounding은 변경하지 않았다. `signaturesOf(final body edge) → toSig`는 정상 sig refresh 검증용이며 독립 geometry accuracy oracle이 아니다. 이 rounding을 의미필드 정규화나 치수 정확도 판정에 쓰지 않았다.

명령은 own 폴더의 `sh run.sh` 한 번이다. 같은 shell에서 `gate.sh acquire heavy 30 drawing-duplicate-differential`0, build0, run1, EXIT release0이다. gate load17.19/slot1of2. 재시도0, 서버/브라우저 시작0. API9/fix/proposal/browser batch는 반복하지 않았다. 입력·출력·stderr·첫 실패·cleanup·sourcegraph와 hash manifest를 보존했다.

수동치수0이라 manual reference preservation NOT_TESTED다. StudioUI/Undo/PDFreader/native roundtrip/liveAI/remoteCI/제조 공차 정확도는 NOT_RUN 또는 NOT_CLAIMED다. 제품/state/ledger/기존 증거는 변경하지 않았다. 구현·push·PR·외부 보고 없음.

**다음 checkpoint:** 기존 DA-DUP-1 우선순위에서 owner가 독립15/15 위치치수를 보존하고 feature-aware coverage를 수정한 뒤, 정확 repaired SHA에서 이 차등과 진짜 정투상 반복/manual-auto 정책을 확인한다. 이번 검사는 결함 재현이며 수정 수락이 아니다. 이 단일 gate 후 종료한다.

## 고정 소스 SHA256

경로 prefix는 `packages/barocss-cad-model/`이다. 줄 번호는 exact4428 snapshot 기준이다.

| 파일 | SHA256 |
| --- | --- |
| `src/drawing/issues.ts` | `6674bbfff06533d96f27bc142e21cacb10e1dd3a9598e5bd10a41a2ffe21fe0c` |
| `src/drawing/dimensions.ts` | `7fa01279b49f182b96b83e9025d72dafaa5d4e95bfe1109b6e3b0926b8220ad2` |
| `src/drawing/auto.ts` | `158e078a8699a8594466bf82a2cf94174679742d1edfb8ed3317460a86a2032a` |
| `src/chat/drawing.ts` | `c9fc5598d31be0648e58b28fd1d1b2735350e52949324bb10817fe70459d65d8` |
| `src/chat/toolKit.ts` | `298efaaf6c56a718b11b04fb648d33bcf4caad2cdd6af765ffa5eb03a34b7643` |
| `src/engine/references.ts` | `6b1025adf425bec626417f1e8f52f713cc9bfdd6bad9b8bc94c09da7f729b9b3` |
| `src/engine/rematch.ts` | `07430488b09482369daeec34ebfe64dcf853ff9c9dc9a6b6db0b0dc77ebdb583` |
| `test/fixtures/sheet-l-bracket.calls.json` | `4452e164457bcb22cc50093a2b52094d40ddcc3374f6423ee1571bff44dd11a5` |
