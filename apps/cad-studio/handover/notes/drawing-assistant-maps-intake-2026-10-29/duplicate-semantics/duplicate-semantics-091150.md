---
work_id: drawing-duplicate-semantics-20261029T091150
artifact_type: focused-semantic-review
status: done_with_runtime_limit
owner_role: Sol-High-investigator
last_updated: 2026-10-29
---

# d3/d9 삭제 의미 검토

**판정:** 두 치수는 독립적으로 작성한 두 구멍의 Y 위치를 각각 기술한다. 값15와 기준 feature n0를 공유한다는 조건만으로 d9 삭제를 제안한 것은 **P2 도면 치수 누락 결함**이다. 이는 소스·모델 의존성·현재 baseline 관측에 근거한 최소 판정이다. 편집 후 실제 치수/coverage 차등 검사는 실행되지 않았다. 제조 정확도 수락은 없다.

대상은 exact `5c965a118705210023229523f2bc46d4251c010f`다. 시작/종료 HEAD가 같다. 제품 상태는 untracked `.claude/`만 있다. `1266cdf24943acc5963bf5e346339e32c9f3da41`→현재 CAD/CAD-model delta는0이다. root AGENTS.md와 지정 handoff/autonomy 지시, roadmap의 DA-1/CG5/DR1–8/O26/RS7.6 intake를 읽었다. 제품·기존 증거·state/ledger는 변경하지 않았다. 새 문제의 외부 dedup/report는 부모 책임이다.

## 1. 현재 baseline에서 직접 관측한 사실

현재 소스를 새 snapshot에 고정하고 기존 accepted.bcad를 읽었다. `before-current.json`은 d3와 d9 모두 resolved/text15임을 기록한다. checker는 `DUPLICATE dims[d3,d9]`, fix `remove d9`를 반환한다. 현재의 삭제 **제안**을 재현했다. 현재 fix API는 다시 호출하지 않았다. 기존1266 DA1c accepted fix가 d9를 실제 삭제한 사실은 원래 보존 영수증에서만 재사용한다.

| 치수 | 구멍 작성 경로 | 참조·측정 | 기존 표시 |
| --- | --- | --- | --- |
| d3 | n1 circle center[25,15] → n2 extrude → n3 difference | top vertical, `n0.leg1.a|n2.side0#2` center, 모델Y | 15 |
| d9 | n4 circle center[15,20] → n5 extrude → n6 difference | right horizontal, `n0.leg0.a|n5.side0#2` center, 모델Y | 15 |

도면 치수는 CAD 구속조건이 아니다. 여기서는 서로 다른 입력의 위치를 기록하는 참조치수다. 첫 hole plane은 normal+Z/xAxis+X이며, 둘째는 normal+X/xAxis+Y다. fixture에는 독립 상수 center 두개가 있다. `parameters={}`이고 같은 center 값을 강제하는 constraint/parameter/pattern relation이 없다. 이후 difference 연산은 원래 구멍을 두번째 구멍과 묶는 위치 관계를 만들지 않는다.

근거: fixture `test/fixtures/sheet-l-bracket.calls.json:30–68,72–110`; 변환 `src/engine/part.ts:110–120`; 투영 `src/drawing/views.ts:21–27`, axis mapping `src/drawing/auto.ts:379–384`; 참조 해석 `src/drawing/dimensions.ts:68–76,169–175`.

## 2. 공개 API 단일 편집과 최초 실패

새 fixture 사본에서 exported `dispatchTool(...,'features',{action:'edit',index:4,feature:…})`를 한 번 호출했다. 변경은 n4.center[0]의15→17 하나다. 이것은 제안 재생/도구 테스트가 사용하는 공개 dispatcher이며 session approval/UI 경로 검사가 아니다. 새 fix/proposal/browser 검사는 하지 않았다.

공개 편집은 `isError=false`, `changed=true`, `built=true`, solids1을 반환했다. 저장된 edit-result/edited-document를 읽는 정적 검사에서 모델 nodes 변화가 `/nodes/4/center/0` 단 한곳임을 확인했다. API의 반올림된 face summary는 n2.side0 centre[25,15,0.75], n5.side0 centre[0.75,17,20]를 기록한다. 이는 첫 구멍을 유지한 채 둘째 구멍 위치를 편집할 수 있음을 지지한다. 반올림 summary를 정확 기하 측정으로 사용하지 않았다.

**최초 실패:** runner가 drawing 전체 deep equality를 요구했다. 정상 편집 경로는 참조20곳에 `sig`를 추가하므로 assertion `drawing input should be retained`가 실패했다. `chat/toolKit.ts:82–83,106–107`의 captureSignatures/refreshSignatures 경로다. 저장된 JSON을 비교하면 drawing 변화는20개 sig 추가뿐이다. 기존 edge/near/at/ID/place는 동일하다. 이 정상 metadata 추가를 제품 참조변경이나 회귀로 분류하지 않는다.

실행 receipt의 FAIL은 그대로다. 이후 치수 재해석/coverage 단계는 NOT_RUN이다. 원래 runner를 수정·재실행하지 않았고, 실패 뒤 kernel/API도 호출하지 않았다. `analyze-saved.py`는 이미 저장된 JSON을 읽는 정적 보완만 한다.

| 증거 단계 | 상태 |
| --- | --- |
| 현재 baseline d3/d9 중복삭제 제안 | PASS, exact current |
| 공개 편집의 단일 모델 node 변경 | API 성공 관측, 보존 JSON으로 검증 |
| runner 전체 | FAIL: 과한 drawing 전체 동일성 가정 |
| 편집 후 실제 d3/d9 표시값·DUPLICATE 차등 | NOT_RUN |
| 삭제된 annotation set의 편집 후 실제 coverage | NOT_RUN |
| 기존 API9/fix/browser 통과 batch 재실행 | NOT_RUN |

## 3. 독립 판단과 결함 경계

`issues.ts:601–612`는 모델 축, rounded low/high, count로 key를 만든다. 두 치수의 endpoint feature 집합은 d3={n0,n2}, d9={n0,n5}다. `:610,621–626`의 disjoint 예외는 공통 재료 feature n0 때문에 작동하지 않는다. 공유 stock 기준은 두 target hole의 위치가 같은 설계 의도로 묶였다는 증거가 아니다. 같은 구멍의 동일 endpoint를 다른 정투상에서 반복한 경우와 이 입력은 다르다.

d9 삭제 후에도 남는 n5 참조는 d10(right vertical, Z20)과 d11(직경5.5)이다. d3는 n2만 참조한다. 이 annotation set에는 둘째 구멍의 Y 위치 또는 첫 구멍과의 명시적 동일 위치 관계가 없다. 도면에 그려진 좌표의 일치만으로 독립 위치값을 치수로 지정했다고 수락할 수 없다. 따라서 최소 결함은 **별도 target의 위치치수에 동일 span/shared-stock을 근거로 삭제 remedy를 제공**하는 것이다.

coverage의 소스도 이 판단을 보강한다. `issues.ts:635–644` givenAlong은 축별 endpoint 수치만 모으고 feature 의존성을 보존하지 않는다. `:682–684`는 해당 수치가 있으면 hole 위치를 covered로 본다. 따라서 d3의Y15가 다른 hole의Y15까지 충족할 수 있다. 기존1266 fix 후 checker0과 일치하는 소스 설명이다. 이번에 편집 후 실제 coverage를 실행했다는 주장은 아니다.

소스상 기대되는 대조 결과는 첫 hole의 d3=15, 둘째 hole의 d9=17이며 pair duplicate가 없어지는 것이다. 이 예상값을 실제 런타임 결과로 기재하지 않는다. 이번 근거는 독립 위치정보 삭제의 설계 결함을 확정하지만 edited-model geometry/annotation resolver의 전체 정확도는 수락하지 않는다.

최소 remedy/완료 기준은 독립 target의 위치치수를 보존하고, 삭제 전 같은 measurement dependency 또는 명시적 locating relation을 확인하는 것이다. 값/공통 stock 일치만으로 삭제하지 않는다. 별도 승인 실행에서는 참조 sig 추가를 허용하면서 편집 직후 raw resolved details를 먼저 기록해야 한다. 동일값15/15에서도 두 독립 위치 annotation을 보존하고,15/17에서는 target에 맞는 표시와 pair 중복 없음이 필요하다. d9가 없는 경우 무관한 feature의 같은 좌표값만으로 위치 coverage를 충족시키면 안 된다. 기존의 진짜 같은 치수 정투상 반복 제거와 manual/auto 정책은 별도 회귀 조건으로 유지한다. 제품 수정은 하지 않았다.

## 4. 실행 결속과 제한

현재 Git archive의 source/config/fixtures/assets2767개를 own snapshot에 저장하고 각 Git blob/SHA256를 확인했다. workspace link2개는 모두 snapshot 안이다. 실제 bundle681 inputs=고정 제품소스680+own runner1, 외부 제품소스0/dist0이다. 실행 도구는 기존 Node22.19.0과 esbuild0.25.12이며 binary/script/version/hash는 run-inputs.json에 있다. 도구 설치는 없다.

명령은 own run 폴더의 `sh run.sh` 단 한회다. 같은 shell에서 heavy30 acquire0 → build0 → run1 → EXIT release0이었다. gate는 load13.55/slot1을 기록한다. 서버/브라우저는 시작하지 않았다. 최초 실패와 모든 입력·출력·stderr·sourcegraph·cleanup을 보존했다. 새 기하 공차는 만들거나 빌리지 않았다. 제품의 원래 SAME=1e-6은 변경하지 않았으며 metric 정확도 판정으로 확대하지 않았다.

수동치수는0이므로 manual preservation은 NOT_TESTED다. StudioUI/Undo/PDFreader/postfix native roundtrip/제조 공차·수치 정확도/liveAI/remote CI/release는 이번 범위 밖이다. 제품수정·push·PR·외부 게시 없음. 이 단일 의미 gate 후 종료한다.

증거 폴더: `runs/drawing-duplicate-semantics-20261029T091150/`. 원시 `receipt.json`이 FAIL의 기준이다. `saved-output-analysis.json`은 저장된 결과에 대한 정적 보완이다. 두 결과를 합쳐 PASS로 바꾸지 않는다.

## 고정 소스 SHA256

아래 경로 prefix는 `packages/barocss-cad-model/`이다. 줄 번호는 exact5c965 snapshot 기준이다.

| 파일 | SHA256 |
| --- | --- |
| `test/fixtures/sheet-l-bracket.calls.json` | `4452e164457bcb22cc50093a2b52094d40ddcc3374f6423ee1571bff44dd11a5` |
| `src/drawing/issues.ts` | `6674bbfff06533d96f27bc142e21cacb10e1dd3a9598e5bd10a41a2ffe21fe0c` |
| `src/drawing/auto.ts` | `158e078a8699a8594466bf82a2cf94174679742d1edfb8ed3317460a86a2032a` |
| `src/drawing/dimensions.ts` | `7fa01279b49f182b96b83e9025d72dafaa5d4e95bfe1109b6e3b0926b8220ad2` |
| `src/drawing/views.ts` | `82d4904d98fa93fa5c31a89afb561cd25823ec82c3e4be6dfaf92191d7d7adfd` |
| `src/chat/part/features.ts` | `28a829e07d3bb674682e5f36914259f1215f87b94fe6f2d45816ef6ad44c4564` |
| `src/chat/toolKit.ts` | `298efaaf6c56a718b11b04fb648d33bcf4caad2cdd6af765ffa5eb03a34b7643` |
| `src/engine/part.ts` | `a5b4ef9186f5393ae731727b06f0780b6964cce8fb9d6fa97bb9fdd2c681f391` |
| `src/engine/references.ts` | `6b1025adf425bec626417f1e8f52f713cc9bfdd6bad9b8bc94c09da7f729b9b3` |
| `src/chat/drawing.ts` | `c9fc5598d31be0648e58b28fd1d1b2735350e52949324bb10817fe70459d65d8` |
| `test/drawing-issues.test.ts` | `13c0edfc454093291d0fdd99e666a4308fccc5cf365399b2da7d4d5c74331124` |
