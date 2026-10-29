# D324 / A07 / #2237 delayed GPU pick 증거 검토

판정: **APPROVE_BOUNDED_AUTHOR_RECEIPTS**. exact `d85558ce0031d812341d5871743f8535520eb8d4`의 소스, CPU 테스트 및 선택 native 실행 로그가 제한된 ownership 수정을 뒷받침한다. 이번 검토는 소스·보존 산출물 대조만 했다. 독립 runtime PASS는 아니다.

확인한 현재 HEAD는 `4c6d42260ff9607945efcef7e24cfe38f79c264b`이다. 저장소는 `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`이며 dirty 항목은 untracked `.claude/`뿐이다. root/scoped 규칙, state/ledger, 현재 roadmap:26–28,1616–1627을 읽었다. 제품·기존 증거·state·ledger를 변경하지 않았다. 아래 행은 작성자 커밋 기준이다.

## 실제 경로와 ownership

- `packages/barocss-gpu/src/viewer/viewer.ts:297–299,700–717,766–793`: private `pickSceneRevision`은 성공한 add/remove, nonempty clear, attached mesh의 승인된 instance 교체 때 증가한다. remove는 slot을 -1로 바꾸고 mesh의 instance/material/map GPU 자원을 해제한다. absent remove와 빈 clear는 revision을 증가시키지 않는다.
- `src/viewer/scene.ts:182–197,264,317–325`: `packInstances`는 새 CPU data와 matrix를 만든다. setter는 validation/packing → 이전 buffer destroy → 새 instances 할당 → owner 통지 순서다. 같은 크기·같은 좌표라도 승인된 replacement는 새 ownership이다. null→null은 ownership 변경이 아니며 detached slot=-1은 revision을 올리지 않는다. validation 또는 이전 buffer release가 throw하면 assignment/통지 전에 멈춘다. 이는 정의된 입력·실패 사례 범위이며 모든 외부 mutation의 transactional 보장은 아니다.
- `viewer.ts:1875–1879,1883–1944`: public `pick()`은 하나의 read buffer를 위해 순차 실행한다. 실제 pickNow는 제출 전 revision/camera/clip/canvas/transform 상태를 보관한다. 실제 GPU map 완료 후 세 read range를 읽고 **unmap을 먼저 수행**한다(:1921–1924). 그 다음 revision/기존 camera·clip·canvas·transform guard가 stale 결과를 거부한다(:1928–1931). 현재 mesh와 instance index로 metadata를 재구성하는 단계(:1933–1944)보다 앞이다. 따라서 승인된 교체/재배열/축소/ABA와 membership 변경 뒤의 예전 index를 새 소유자로 해석하지 않는다. helper-only 수정이 아니다.
- `viewer.ts:2221–2246`: dispose는 geometry/mesh/pick buffer·texture/device 등을 해제한다. 이번 신규 revision 수정은 dispose 중 pending native map의 성공·취소 계약을 추가하지 않았다. native 증거는 pending pick이 끝난 뒤 dispose한 cleanup이다. **dispose-during-pending-readback은 미검증**이며 clear/remove와 같은 수락으로 확장하지 않는다.

## CPU mock과 native 증거 구분

역사적 `runs/gpu-001/delayed-pick.json`은 baseline `5463dbf...`의 CPU reconstruction + fake GPU readback 재현이다. 변경된 결과를 현재 장애로 해석하지 않는다. 작성자의 새 baseline은 부모 `a5d1acfa7e6834951819eaaeeaf6da314cae9b8f`에 고정된다.

| 보존된 증거 | 제한된 결과 |
|---|---|
| `unit/baseline-test.mjs`, `baseline.log`, `baseline-exits.txt` | emit0, CPU control1 PASS/shrink1 FAIL/skip0. 원래 TypeError `Cannot read properties of undefined (reading '0')`와 stack 보존. 실제 GPU baseline은 아님. |
| `tests/pick-instance-readback.test.mjs:19–61,63–159` | 실제 pickNow/Camera/Geometry/Mesh, stub transport/draw/visibility. unchanged; replacement/reorder/shrink/null/remove/clear/ABA; camera/clip/base guard; invalid setter/null no-op/detached/no-op removal/release failure. 각 mapped request unmap1, shrink 후 같은 read buffer 재사용을 검사. point 공차는 원래 `1e-5`. |
| `unit/cpu-final.log`, `final-exits.txt` | 정상 등록된 47개 파일, **357 PASS / 0 FAIL / 0 SKIP**. top-level343+nested14. 신규15는 이 357에 이미 포함되며 기존342와 합쳐진 수다. 별도 신규15 rerun은 없다. baseline2는 동일 행동의 과거 재현이므로 추가하지 않는다. emit/types0, lint0. |
| `consumers/native-first.txt`, `native-first/receipt.json` | **선택 test1 PASS / fail0 / skip0, 내부 group6**. six tests가 아니다. Chrome156.0.8078.48, DPR1, 실제 raster+public pick. before-fix native는 NOT_RUN. |

native exact driver는 `tests/pick-instance-readback-browser.test.mjs`이며 보존 gzip을 풀었을 때 exact d855 test bytes와 일치한다. :30–61은 GPUBuffer native method를 wrapper로 관찰한다. 원래 receiver/args로 native mapAsync를 호출하고 **native Promise가 fulfilled된 뒤 반환만 지연**한다. getMappedRange/unmap은 원래 결과를 전달한다. GPU bytes·ID·depth·submit/draw 결과를 대체하지 않는다. 따라서 실제 pipeline을 controlled instrumentation으로 관찰한 증거다. 자연 지연/드라이버 실패·device-loss 증거는 아니다. 이 검토에서 wrapper를 실행하지 않았다.

:85–140의 six groups는 unchanged, matrix replacement, reorder, shrink, instances-null, mesh-removal이다. 각 baseline capture pixel은 실제 `[255,64,32,255]`, size320×240, public pick instance1/triangle0/face71이다. unchanged는 원래 hit를 유지하고 변경5개는 delayed null이다. fresh pick은 현재 instance1/0/null 또는 replacement mesh를 반환하며 face71/triangle0 및 finite point/depth를 검사한다. point의 새 위치에 대한 수치 정확도 시험은 아니다. delayed 뒤 selected buffer unmap1, fresh reuse 뒤 unmap2가 모든 group에 기록되어 있다.

## adapter, hash, 실패 기록과 보존 범위

**adapter 정정:** driver:81–83은 별도 availability `requestAdapter()`의 vendor/architecture를 기록한다. 실제 Viewer는 :88의 createViewer에서 자신의 adapter/device를 만든다. 기록의 Apple/metal-3를 **실제 Viewer adapter의 직접 식별값**이라고 수락하지 않는다. actual native WebGPU rendering/picking 관측은 유효하지만 Viewer adapter identity는 UNKNOWN이다. Chrome version은 실제 browser.version 기록이다.

작성자 note `apps/cad-studio/handover/notes/gpu-pick-instance-ownership-2026-10-29/`의 qualification manifest47개 + consumer manifest16개 = 총63개 참조이며 **고유47개**다. 16개 중복 참조를 제거했다. 모두 exact Git의 bytes/길이/SHA256과 일치한다. 현재 filesystem 보존 파일도 같은 bytes다. 두 PNG는 같은 SHA256의 동일 이미지다. 독립 시각 산출물은 하나이며 이 검토에서도 실제 두 붉은 삼각형을 확인했다.

- native driver SHA256: `5939c7d77118ecceaacfa99c76bdd9fd7b1a63eeec65c447bc880d41490d8213`
- driver gzip: `c42aa17a6ebb7930d9f1c21628488b3e1b981ef083cdd36868c8746f329e3dc2`
- native raw receipt: `61e1e14bd0e22f9db01295b5224fffb56c706b04934c66165d5027298985c8e0`
- source profile: `29fba9a0f625afe98f41f6d079f21c3b4cdba1520887d1d832df0e1a08f36a86`
- both PNG: `675c0ce485d4373862b2368056bb516a8b2ac7cc45bdda4e7dfe15be97286e44`
- viewer source: `1c1df2143fe714569fe40b7aa27e6772faca9f44c9c50a9cca56194467b052a8`
- scene source: `f7e17275a2efb6c8b9d5bf73c89e61902f94a9f01541476ce07c79baf59954d5`
- CPU test: `471f03427c52724fca953434e2db52bbb32267a16b658222c0f40ebc217fed5b`

source baseline gzip2개는 exact a5d1 viewer/scene과 일치한다. 최종 qualification의 source6개 hash도 exact d855와 일치한다. source-profile은 critical source2개/dist2개와 producer emit0을 연결한다. dist bytes 자체나 전체 imported graph capsule은 이 note에 보존되지 않았다. **소스·driver·baseline capsule의 독립 hash 검증**과 **실행 당시 dist hash에 대한 작성자 기록**을 구분한다. 전체 runtime graph 독립 검증을 주장하지 않는다.

원래 CPU fail은 보존되어 있다. 이 note의 emit/lint/syntax/native first 기록에는 추가 compile/lint/harness fail이 없다. `api-review/old-expected-check.json`의 IV001 FAIL은 숨기지 않는다. 기존 @internal sceneMoved optional Mesh argument가 root/source/viewer 세 노출의 선언에 나타난 변경이다. reviewed-delta/adoption은 정확히3개 선언 변경과 새 member/exposure0을 기록하고 expected를 갱신한다. 최종 CLI/API/docs pass는 작성자 qualification 및 docs exit 기록 범위로 수락한다. candidate generation exit와 check PASS를 혼동하지 않는다.

cleanup은 group별 six Viewer dispose, context/browser/server close, runner49501 exit 및 gate 해제의 작성자 기록이다. VRAM 또는 드라이버 자원 bytes 측정이 아니다. 페이지 오류는 빈 배열이다.

## 현재 delta와 다음 checkpoint

현재 scene.ts와 두 pick test는 exact d855와 같다. 이후 viewer.ts/camera.ts/shaders/pick.ts 변경이 있다(검토 폴더 source delta 3파일, +75/-18). 작성자 d855 native 결과를 현재 GPU 전체 실행 수락으로 확장하지 않는다. 현재 clipping/camera 수정으로 새 regression을 추정하지도 않는다.

다른 adapter/browser/DPR, native before-fix, native ABA/clear/invalid-setter/dispose-pending matrix, whole suites/remote CI, 모든 material/visibility/geometry mutation, recovery/device-loss/VRAM/OOM/performance는 **NOT_RUN 또는 이 qualification 밖**이다. #2237의 transfer closure는 현재 fix 수락 근거가 아니다. DA-DUP-1 delta0으로 새 drawing 재현도 하지 않았다.

다음 checkpoint는 이 제한된 receipt 수락을 원장에 반영하는 부모 작업이다. 범위를 확장할 때만 실제 Viewer adapter identity와 해당 native lifecycle case의 새 증거가 필요하다. 없는 dist/graph를 재구성하거나 새 실행을 시작하지 않고 이번 검토를 종료한다.
