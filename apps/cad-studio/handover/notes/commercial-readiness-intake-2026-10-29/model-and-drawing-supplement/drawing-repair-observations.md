---
work_id: drawing-repair-acceptance-20261029T131022
artifact_type: focused-repair-behavior-observation-with-procedure-failure
status: orchestration_fail_pinned_cpu_observations_preserved
owner_role: Sol-High-investigator
last_updated: 2026-10-29
---

# DA-DUP-1 수정 검사 — CPU 관측과 절차 실패

**전체 판정: FAIL_ORCHESTRATION_WITH_VALID_PINNED_CPU_OBSERVATIONS. clean independent acceptance는 NOT_QUALIFIED다.** 고정 `ccbdf285e357f53a9bb070f119d6e625e6cd3070`의 CPU/API 집중6그룹은 모두 PASS했다. 그러나 실행 직전 HEAD 일치 assertion이 실패했는데도 shell이 이어 `sh run.sh`를 실행했다. 이는 조사자의 진행 제어 오류다. target delta0이나 성공한 CPU 결과로 이 절차 실패를 없애지 않는다. 원시6PASS/firstFailure:null receipt는 그대로이며, 최상위 verification의 최초 실패는 pre-guard HEAD assertion이다.

새 runtime/API/재시도는 더 하지 않았다. 제품/타인 WIP/이전 증거를 수정하지 않았다. 원래091150 harnessFAIL과092450 PRODUCT_CONTRACT_FAIL의 세 receipt hash가 모두 유지됐다. 부모의 preflight/최신 state/ledger/report, 원래 두 보고서와 raw/parent receipts를 읽고 이 단일 cycle만 수행했다.

## 최초 실패와 실행 경위

준비 snapshot은 exactccbdf다. 준비 시 owner WIP는 `apps/cad-studio/test/browser-flow.mjs`, `.claude/`였고 snapshot에서 제외했다. 별도 Python preflight는 `git rev-parse HEAD`와 고정ccbdf가 같은지 assertion을 실행했다. assertion이 실패했지만 같은 shell 명령의 다음 줄 `sh run.sh`가 실행됐다. 상위 shell에 명시적 if/exit 또는 fail-fast 제어가 없었다.

실패 당시 실제 HEAD 문자열은 assertion 전에 저장되지 않았다. 첫 post-run 조회에서5907c393을 관측했고, 이후 read-only verification 시점에는564897679cf9e32798faf4c23aba2e89fcde12f9였다. 실패 순간의 HEAD를 이 둘 중 하나로 단정하지 않는다.5907의 변경은 owner browser-flow 관측과 Model test runner의 no-match stderr 출력이다. 이후5648976에는 owner 문서/증거가 추가됐다. 고정ccbdf→두 조회시점 모두 measurement/auto/issues/layout/callout/chat와 Drawing UI의 target runtime delta는0이다. **이 사실은 source 범위를 설명할 뿐 clean gate 수락을 복원하지 않는다.**

실제 실행은 own snapshot만 사용했고 gate acquire/build/run/EXIT release가 모두0이었다. heavy guard 자체는 한 번 통과했다(load7.27/slot1of3). 최초 preflight 실패 후 같은 finite 실행이 계속된 절차 오류를 `orchestration.json`에 기록했다. clean acceptance는 NOT_QUALIFIED로 남긴다. 앞으로 별도 승인된 실행이 있다면 선행조건 실패가 명시적 if/exit 또는 fail-fast shell로 다음 명령을 차단해야 한다. 이번 runner/원시 출력은 고치거나 재실행하지 않았다.

## 고정 source 검토

- `drawing/measurement.ts:41–77`은 같은 값이 아니라 양 끝점의 의존성을 비교한다. centre의 실제 circle/owner, explicit compound owner, pattern-copy와 방향이 있는 count를 구분한다. 공통 stock n0 하나만으로 n2/n5를 묶지 않는다.
- `drawing/issues.ts:599–619`는 같은 span bucket 안에서도 matching dependency를 찾는다. 독립 target 뒤에 있는 진짜 반복도 확인할 수 있다. `:647–671,706–708`의 hole 위치 검사는 coordinate-only givenAlong 대신 targetLocated/holeLocated를 사용한다.
- `drawing/auto.ts:239–294,322–330,400–414`는 같은 좌표의 독립 centre를 남기고 manual span bucket에도 dependency를 확인한다. manual 첫 hole이 다른 hole의 동일값 auto 위치를 막지 않게 한다.
- `drawing/callout.ts`는 formatted text와 별개로 authored compound location owner를 제공하고 instance의 실제 문서와 copy suffix를 보존한다. `chat/drawing.ts`의 drawingInputs/auto, `layout.ts`의 autoLayout, `useDrawingSheet.ts`와 `DrawingWorkspace.tsx`의 issue/fix/auto 경로가 locationOwner를 전달한다.
- hole-row/pcd-square-grid conformance의 **input은 수정 전후 같다.** 추가 독립 위치치수의 expected count와 crowded row가 바뀌었다. 이를 새 기하 공차나 입력 완화로 해석하지 않는다. conformance suite는 이번에 실행하지 않았다.

owner의 새 test 정의와 browser driver는 source-only로 읽었다. 준비 때 별도 qualification은 scoped path에서 NOT_FOUND였다. 실행 후 concurrent owner 작업에서 qualification summary가 나타나 한 사본/hash를 보존했다. owner의 Model248/63, UI/native 등 주장은 이번6그룹에 합산하거나 독립 PASS로 올리지 않았다. 이는 author 실행이 없다는 주장이 아니다.

## 실제 고정 CPU/API 관측

raw resolved 값/refs/issues를 각 verdict 전에 저장했다. public edit 뒤에도 실제 결과를 먼저 저장하고 정상 sig metadata를 판정했다. 기존처럼 drawing 전체 동등성을 요구하는 harness 오판은 반복하지 않았다.

| 집중 그룹 | 실제 고정ccbdf 결과 | 원시 상태 |
| --- | --- | --- |
| 원래 독립15/15 | d3 top/n2=15, d9 right/n5=15 모두 유지. pair DUPLICATE 없음 | PASS |
| d9 없는 같은 좌표 | 기존 after.bcad의10개 annotation에서 right HOLE_NOT_LOCATED1 | PASS |
| 공개 auto_dimension | layout:false로 d3/d9 두 target 위치15/15를 생성·보존 | PASS |
| 단일 공개 edit | n4.center[0]15→17만 변경. d3=15 유지/d9=17. pair duplicate 없음. d9 없는 설정은 right 누락 경고1 | PASS |
| 진짜 same-target 정투상 반복 | 같은 n2 target을 topY/rightY로 반복. manual→auto, auto→manual에서 auto 제거. auto→auto에서는 later auto 제거 | PASS |
| manual과 독립 auto | 첫 hole의 manual-top은 정확히 유지되고 둘째 hole의 equal15 auto 위치가 남음 | PASS |

6그룹은 한 finite fixture profile의 그룹 수다. 독립 테스트6개 또는 브라우저6개로 세지 않는다. 세 정투상 priority variant도 다섯번째 그룹 안의 대조다. 모두 기존 real projection/표준 drawing settings를 사용했으며 synthetic kernel/projection injection은 없다. public same-target remove는 `applyFix`로 해당 settings만 처리했다.

공개 model edit1회, public `runDrawingTool(...auto_dimension,{layout:false})`2회, same-target settings removal3회다. fix_drawing/proposal/API9/이전 visual batch/whole suite는 실행하지 않았다. missing-d9 입력은 원래DA1c after.bcad이며 새 fix 호출로 만들지 않았다. unequal 대조는 지원되는 `drawingInputs(editedDoc, retainedSettings)`를 사용했다.

manual subset에서 자동 ID는 재할당될 수 있다. 예를 들어 둘째 target의 위치는 d8로 생성됐다. 이 대조는 target ref와 view/axis를 확인하며 d9라는 문자열만으로 의도를 판정하지 않는다. 원래 저장된11개에서는 d3/d9 ID와 target을 그대로 확인했다.

실제 edit의 nodes는 n4.center[0] 하나를 제외하고 deepStrictEqual이며 parameters도 같다. drawing은 알려진20개 reference `sig` 추가만 허용했다. 나머지 edge/near/at/ID/place/배열 순서/타입은 exact deepStrictEqual이다. 추가sig는 final body의 원래 `signaturesOf → toSig` metadata format과 비교했다. 이는 geometry metric oracle이 아니다.

원래 d1/d7 TEXT_OVER_LINES2는 남는다. targeted duplicate/location 수리와 별개의 기존 layout issue이며 이번에 고치거나 새 결함으로 보고하지 않는다. checker 전체0, 제조 충분성 또는 도면 전체 수락을 주장하지 않는다.

## 원래 정책·source graph·원시 보존

새 numerical tolerance는 없다. exact authored15/17, display string, ID/ref와 deep equality 계약으로 비교했다. 제품 helper의 SAME1e-6은 기존 checker 정책과 같고, callout3자리 formatting 및 toSig의 원래 metadata rounding도 변경하지 않았다. 기하 정확도/제조 공차를 이 숫자로 수락하지 않는다.

source/config/fixtures/assets2774개를 exactccbdf Git archive에 고정하고 각각 Git blob/SHA256를 확인했다. workspace link2개는 snapshot 안이다. 실제 bundle682=고정 제품소스681+own runner1이며 모두 manifest hash와 일치했다. live product import0/dist0/외부 source escape0이다. 당시 mutable browser-flow, 이후 viewport/styles WIP와 owner 문서 변경은 이 실행의 compiled input이 아니다. 설치된 Node22.19.0/esbuild0.25.12의 도구/binary/runner hash를 기록했고 설치는 없다.

원시 `receipt.json`은 **PASS_BOUNDED_COMMITTED_REPAIR_ACCEPTANCE / sixPASS / firstFailure:null** 그대로다. 이는 선택된 고정 source의 동작 관측 기록이다. `verification.json`은 **FAIL_ORCHESTRATION_WITH_VALID_PINNED_CPU_OBSERVATIONS / cleanIndependentAcceptance NOT_QUALIFIED**다. 전체 절차 상태는 이 상위 FAIL을 따른다. 둘을 합쳐 전체 PASS로 바꾸지 않는다.

원래 실패 hash:

- 091150 receipt: `c4a393c5fe601d7a98e6445da795315f721a6c16533dc156a3e4aab8f67a8009`
- 092450 receipt: `76c51c3480ef0041c87b729e24fcdea32e538828e5d166dd12f8cebd92ed262d`
- 092450 runtime-original: `384f924045ea5887a6d25888edf993045c0c371d535107e0d35b4f246c0fd1d6`

세 hash를 이번 read-only verification에서도 확인했다. 기존 rawFAIL은 소급 변경하지 않았다. 최초 preflight traceback/진행 오류, 명령, 새 입력·출력·bundle graph·cleanup·source/artifact manifest를 own run에 보존한다. 재시도0, 서버/브라우저 시작0, own lease release0이다.

## 수락 경계와 다음 checkpoint

고정ccbdf에서 DA-DUP-1의 핵심 수리 동작과 준비한 true-repeat/manual-auto 대조를 관측했다. 그러나 **깨끗한 독립 acceptance gate는 통과하지 못했다.** 부모는 CPU 근거와 절차 실패를 함께 기록해야 한다. 이 cycle의 추가 실행은 없다.

실제 StudioUI/Undo/Redo/PDF/독립 geometry oracle/postfix native roundtrip/compound·assembly·section·pattern 전체 matrix는 NOT_RUN 또는 NOT_CLAIMED다. 이번 manual 근거도 준비한 subset에만 적용한다. 제품 수정/타인 WIP 수정/새 finding issue/외부 게시/배포는 없다. 다음 clean 수락은 별도 승인된 fail-fast preflight/정확snapshot gate가 필요하며, 시점과 우선순위는 부모/owner가 정한다.

[최상위 verification](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/drawing-repair-acceptance-20261029T131022/verification.json) · [원시 CPU receipt](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/drawing-repair-acceptance-20261029T131022/receipt.json) · [절차 첫 실패](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/drawing-repair-acceptance-20261029T131022/orchestration.json) · [compiled input 결속](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runs/drawing-repair-acceptance-20261029T131022/compiled-input-verification.json)

## 핵심 source SHA256

| 파일 | SHA256 |
| --- | --- |
| `packages/barocss-cad-model/src/drawing/measurement.ts` | `193b3fc9bdcc01b77991f385dd65bd6c8604bdb512dced385d9bf8329b011d21` |
| `packages/barocss-cad-model/src/drawing/auto.ts` | `25e1cdfbb2ef960062c60d835b7868f7afd319b0a1fa761b2c66014c1a44e6fc` |
| `packages/barocss-cad-model/src/drawing/issues.ts` | `ec7e077ac0d07e546cee291b7920889f917b1b98336a1bf82abb34a9e5b2e7ae` |
| `packages/barocss-cad-model/src/drawing/layout.ts` | `f7a4499d90a2873bcfa8340c1e29d9d45d5694173e92f4dae81bc2dc15d8daae` |
| `packages/barocss-cad-model/src/drawing/callout.ts` | `fdef87e9915d085e3506d6c425430a015b3a64e5ba41f3c0c8e90493cb44ecac` |
| `packages/barocss-cad-model/src/chat/drawing.ts` | `8edb682363afc5800b2b3d60ba660235ea40149806ebd8d94cbd8dfa197ccbb2` |
