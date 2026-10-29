# D326 project / serialized Open 작성자 증거 검토

판정: **APPROVE_BOUNDED_AUTHOR_RECEIPTS**. exact `1266cdf24943acc5963bf5e346339e32c9f3da41`의 selected project/serialized-document Open ownership 소스와 작성자 증거를 제한적으로 수락한다. 독립 runtime PASS 또는 모든 A05/A06 완료를 뜻하지 않는다. 이번 검토에서는 build/test/browser/server를 실행하지 않았다.

검토 저장소는 `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`이다. 실제 현재 HEAD는 `78095403992cc5ffb9b27f7bc3d6d986eda12f0c`, dirty는 untracked `.claude/`뿐이다. state/ledger/report, root 및 scoped 지침, 현재 roadmap:29,1683–1693을 읽었다. A05 다른 형식·stage, A06 worker sender는 기존 후속 범위다. DA-DUP-1 delta0에는 새 drawing 재현을 추가하지 않았다. 제품·WIP·기존 증거·원장·브랜치는 변경하지 않았다. 아래 행은 작성자 커밋 기준이다.

## 실제 Open 연결과 guard

- `apps/cad-studio/src/storage/VersionsPanel.tsx:82–91`의 실제 Close/Open/Check 버튼은 `useProject` actions에 연결된다. `storage/project.ts:25–35`는 store bytes를 기존 `readStudioFile`로 읽고 missing/refusal을 유지한다. `handleStore.ts:62` 이하의 adapter read가 실제 File bytes를 제공한다. helper-only 교체가 아니다.
- `storage/useProject.ts:51–60`의 owner는 opaque request, project session, store, path 및 App scope를 검사한다. picker→store adoption→refresh는 같은 request를 유지한다(:65–84,105–115). late selection이 새 권한을 만들지 않는다. Close/detach는 기존 part/log가 비어도 먼저 request/session을 무효화한다(:116–118).
- `useProject.ts:120–139`: readPart 완료 후 guard가 먼저 실행된다. current일 때만 tag/path/offered를 갱신하고 onOpened를 호출한다. callback이 반환한 실제 accepted App scope를 받아 자기 dispatch를 stale로 오인하지 않는다. 이어 versions/autosave/linked의 각 await 후 guard가 metadata·offer·late error를 차단한다. manual Check는 현재 scope를 읽으며 새 Open intent를 만들지 않는다(:179–185).
- `App.tsx:384–399,582–599`: 모든 document dispatch는 Open scope와 D322 save dispatch token을 갱신한다. project onOpened는 기존 replaceDoc를 호출한 뒤 accepted scope를 동기 반환한다. 지연 fit도 그 scope를 검사한다. `replaceDoc:2028–2034`의 기존 work invalidation/commit/detach/cancel 경로가 유지된다. New 버튼(:3601)과 실제 Model file input(:3634)이 이 경로를 사용한다.
- `App.tsx:2179–2182,2243–2261`: serialized `.bcad`/`.json`/extensionless 경로는 arrayBuffer 및 readStudioFile의 각 await 다음에 scope를 검사한다. stale error도 catch에서 억제한다. acceptedDoc을 실제 교체한 뒤 그 document/scope/dispatch를 verifyOpened에 전달한다. 다른 형식의 import/stage 전체를 이 guard가 보호한다고 수락하지 않는다.
- `App.tsx:2458–2477`: reference followup은 실제 accepted document identity, opaque scope, D322 dispatch token을 검사한다. engine.part 및 verifyReferences의 두 await 뒤 current 검사를 통과해야 ref problems/update/dirty를 바꾼다. 같은 nodes 또는 JSON 값 동등성을 소유권으로 쓰지 않는다. print/render 보존과 기존 codec/reference key 경로를 유지한다. native reference-remap negative case는 별도 미실행이다.

D321 replacement/Stop/Undo entry와 D322 Save receipt/tag/functional updater 순서는 유지된다. D326 diff는 Save 구현을 교체하지 않으며 focused의 기존 Save9도 재사용한다. 이것은 이전 증거의 전체 확장이 아니며 모든 중첩 async 작업을 일반적으로 보호한다는 판정도 아니다.

## 원래 실패와 테스트 수

작성자 note: `apps/cad-studio/handover/notes/project-open-ownership-2026-10-29/`.

| 원본 기록 | 수락 범위 |
|---|---|
| `baseline.log`, `baseline-exit.txt`, `baseline-source/` | exact f841 hook/codecs + controlled DirHandle transport: **1 PASS / 6 FAIL / 0 SKIP**, exit1. Close/New/B 후 old A acceptance 및 versions/autosave/linked metadata 오염을 보존한다. 실제 App UI 증거와 구분한다. |
| `consumers/baseline-first*`, `first-observation.json` | B mass가 아직 pending일 때 snapshot을 잡은 setup/schedule FAIL, exit1. A hold는 시작하지 못했다. 제품 재현이 아니다. 원래 driver와 raw 실패를 보존했다. |
| `consumers/baseline-second*`, `baseline-validation.json` | 정상 B control 뒤 원래 native A read 반환을 놓았을 때 live B(volume2184/name/path/version/history)가 A(volume1000)로 바뀐 실제 selected1 FAIL, skip0. 원래 저장된 B bytes는 그대로이며 disk data loss 증거는 아니다. |
| `unit/d326-focused-first.log` | 24 PASS, final reopen/manual Check source repairs 전 checkpoint. 숨기거나 최종29와 합산하지 않는다. |
| `unit/d326-focused-final.log` | 29 PASS/0 FAIL/0 SKIP = project20 + 기존 Save9. |
| `unit/d326-studio-all.log` | **423 PASS/0 FAIL/0 SKIP**. focused29를 포함한다. 고유 전체 count는 423이며 423+29+24가 아니다. |
| `unit/validation.json`, types/lint/syntax 로그 | types0/scopedlint0/driver syntax0 작성자 기록. 해당 원본 로그는 비어 있다. exit 요약과 함께 해석하며 독립 실행으로 주장하지 않는다. |
| `consumers/final-first.txt` | **selected5 PASS/0 FAIL/0 SKIP**, exit0, 약43.1초. 이 note의 final TAP에 별도 starter test는 없다. startup/normal B controls를 여섯 번째 독립 test로 집계하지 않는다. |

`test/project-open-ownership.test.ts:133–346`은 actual hook+codecs를 controlled directory transport와 callback fixture로 검사한다. stale error/selection/refresh/cancellation, accepted scope handoff, external File intent/dispatch와 informational linked Check도 포함된다. 이 fixture 자체는 App Undo/dirty/recovery UI 증거가 아니다. final 소스 검토에서 발견한 reopen owner/manual Check gap은 최종 실행 전에 수정되어 있고 earlier24 기록은 남아 있다. 이 note에 별도 compiler/lint fixture failure는 기록되어 있지 않다.

## 실제5개와 retained bytes 독립 대조

exact driver `test/project-open-ownership-browser.mjs:12–48`은 원래 native directory/File/Blob receiver·args·return을 전달한다. 선택한 owned A read는 native arrayBuffer가 fulfilled된 뒤 반환만 지연한다. UI에서 실제 생성·저장한 A/B bytes를 쓰며 가짜 document/result를 주입하지 않는다. `:114–115`의 file input은 UI-saved A bytes를 `setInputFiles`로 제공한다. 실제 hidden input/change→public Open 경로지만 OS filechooser나 실제 external folder 동작 증거는 아니다.

선택 cases는 project A→B, project A→New C, project A→Close, file A→New C, file A→project B이다. 각 test는 자체 context/고유 OPFS namespace를 쓴다. 각 case 내부 old/new ownership 비교는 **같은 context**다. fresh-context 재Open 수락이 아니다.

보존된 five raw receipt를 독립 parse했다. before/after 모두 doc, body, fileName, dirty, recovery, history, project, activePath, versions, offered 필드가 실제 존재한다. 모든 해당 값이 before/after에서 같다. History는 실제 HTMLDivElement와 nonempty BUTTON rows이고 control에서 label type도 검사한다. undefined==undefined 비교를 증거로 쓰지 않았다. B는 active B.bcad/version B/volume2184를 유지한다. New C는 activePath null/dirty true/실제 recovery JSON/volume792를 유지한다. Close는 B 문서는 유지하고 project/path/version binding을 비운다. offer null→null은 기존 값 유지 관측이며 nonempty offer 보존의 native 증명은 아니다.

**실제 보존 `.bcad` 파일의 독립 bytes 비교**도 했다. five case 모두 held-original-A bytes = normal control의 실제 saved A bytes이며, B before/after bytes가 같다. B 파일의 parsed JSON 의미도 normal B control doc과 같다. IDs/nodes/outputs를 포함한 전체 parsed 문서를 비교했으며, 일반적인 파일 변환의 byte identity와 혼동하지 않는다. 이 파일은 asset-free plain JSON(예 A/B657 bytes)이다. 확장자가 bcad여도 mesh/blob binary container 검증이 아니다. inline JSON state와 보존 원본 파일 bytes 확인을 분리했다.

driver:138–149와 raw trace에서 native-read-return은 release-requested 뒤에 있다. held checkpoint는 fulfilled=true/returned=false, after는 returned=true다. 다음 MessageChannel task와 UI frames 및 fresh/massReady 상태를 관찰한다. 원래 operation Promise는 **NOT_EXPOSED**다. 소스상 plain-JSON finite microtask continuation의 stale guard에 한정한 completion 관측이다. arbitrary blob/crypto/linked I/O 완료 또는 자연 OS failure 증명으로 확대하지 않는다. source/trace sequence로 순서를 판정하며 파일 timestamp만으로 제품 완료를 추정하지 않는다.

## 무결성·현재 delta·한계

root artifact-manifest144 + consumer manifest118 + baseline source-manifest7 = **269개 참조, 고유144개 경로, 중복125개**다. 모두 exact Git bytes의 길이/SHA256과 일치한다. 현재 filesystem에 보존된 파일도 exact bytes와 같다. final capsule4개는 gzip hash/raw hash 모두 맞고 exact1266 App/useProject/OpenScope/driver와 같다. baseline App/useProject capsule은 exact f841과 같다. baseline driver2개는 당시 각 profile hash와 일치하며 최종 driver와 서로 다름을 보존한다.

주요 SHA256:

- App: `6523603f2d1e417ace3cbb2c93c77f46e384286593f2b87d81457b7d82e24c66`
- useProject: `4cfc5b96100c382ea06056c85c8c80843f6efc64622b60e43c8711458dfbaa63`
- OpenScope: `ea2098e7834673157f929f525732f5261ac9ea74d8209290e7306f0420b89839`
- project test: `58a200217c860617af8b8ac63cd282c3df9baa469eb3405b4acf99295031ba45`
- final browser driver: `010ab5211ff822ed58a777fbe77bcdf4a068b21ffeb9f22dde34f2035cc55027`
- inventory: `9a0c0fa5ed7acc0a864b575839aad05ff39e6a0b820f564730aa1ae0a4b0a695`

source profiles는 critical sources/capsules를 연결하지만 Vite가 실행한 전체 import graph와 emitted runtime bundle을 보존하지 않는다. 따라서 전체 graph 독립 검증은 미완료다. cleanup5개는 owned namespace 제거 후 NotFound 확인, context/browser/server close를 기록한다. runner97413 exit/gate 해제는 작성자 validation 기록이다. 새 cleanup 실행은 하지 않았다.

현재 useProject/OpenScope/두 focused driver는 동일하다. App은 이후 refactor로 크게 변경되었다(+212/-2178). d326 결과를 현재 refactored controller runtime 증거로 쓰지 않는다. 이 diff 자체로 새 regression도 추정하지 않는다.

**NOT_RUN/범위 밖:** 다른 형식 STEP/STL/OBJ/IGES/.barocad 및 stage A05, worker sender A06, native folder/reopen/manualCheck/reference remap negative/metadata-linked stalls, fileA→fileB 일반 matrix, blob/crypto/mesh container, 외부 folder/tab/crash, 전체 Kernel/Model/GPU/browser/remote CI, performance/memory. transfer closure #2236/#2242 등은 수락 근거가 아니며 이슈를 변경하지 않았다.

다음 checkpoint는 부모가 이 bounded author-receipt 수락과 남은 A05/A06 범위를 원장에 반영하는 것이다. 현재 refactored App 수락이나 나머지 async 경로를 검증하려면 그 범위의 별도 exact-source 증거가 필요하다. 이번 사이클은 기존 note와 참조의 source/log/hash/retained-file 검토로 종료한다.
