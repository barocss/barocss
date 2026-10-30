---
work_id: studio-modernization-20261029
artifact_type: design_review
status: draft
owner_role: designer-source-review
source_request: "cad studio 도 최신화 하는걸로 리뷰해줄 수 있어?"
last_updated: 2026-10-29
---

# Studio 현대화: 소스 기반 디자인·UX 리뷰

최신화의 우선순위는 **도구를 찾는 방법, 편집 중 정보의 순서, 작업 상태의 구분**이다. 새 프레임워크는 필요하지 않다. 현재도 React 19, shadcn/Radix, cmdk, Tailwind, light/dark, 명령 검색, 반응형 overflow와 접는 dock이 있다. 오래된 인상을 만드는 후보는 작은 글자와 조작, 이름 없는 세로 아이콘 목록, 한 헤더에 섞인 파일·작업·내보내기 명령, Browser 뒤에 놓이는 편집 패널, 편집 중 사라지는 History, 모델 위의 분산된 상태 알림이다.

이는 **소스 근거에 따른 디자인 판단**이다. 실제 화면의 가림, 클릭 수, 대비 실패나 작업시간은 이 검토에서 확인하지 않았다. 다른 화면 검토 담당자의 결과와 합쳐 최종 우선순위를 정해야 한다. 선호를 제품 버그로 분류하지 않는다.

기준 commit: `a5d1acfa7e6834951819eaaeeaf6da314cae9b8f`. 저장소: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. 모든 제품 읽기는 exact `git -C … show COMMIT:path`로 고정했다. 제품·WIP·기존 증거·브랜치·탭·프로세스는 변경하지 않았다. build/test/browser/server는 **NOT_RUN**이다. Designer skill의 작업 메타데이터·상태·접근성 기준을 적용했다. scoped Studio AGENTS는 없고 root AGENTS는 이전에 읽은 것과 동일한 blob이다.

## 현재 흐름과 남겨야 할 기능

주요 흐름은 **명령 찾기 → 대상/참조 선택 → 값 또는 지원되는 이름 있는 파라미터 연결 → 미리보기 → Apply/Cancel → History 재편집/Undo/Redo → 저장**이다. 이 흐름은 이미 연결되어 있다.

- `App.tsx:1542–1591`은 현재 선택의 명령 가용성, 스케치 평면, 배치와 초기값을 결정한다. `Hud.tsx:54–74`에는 명령명, 선택/배치 단계, 값, 평가/미리보기/거부와 Apply/Cancel이 있다. Apply는 미리보기가 유효할 때 활성화된다.
- `App.tsx:1425–1467,1486–1494,1535–1539`은 빈 값/거부/미리보기와 준비 후 Apply 대기를 구분한다. 미리보기 이미지를 문서 적용으로 표현하면 안 된다.
- `NodeEditor`와 Parameters는 숫자 및 이름 있는 파라미터 연결을 지원한다. 조사한 입력은 일반 자유 수식 편집기가 아니다. 새 수식 엔진이나 임의 식 입력을 이미 지원하는 것처럼 제안하지 않는다.
- Sketch에는 평면·치수·constraints·DOF·open/over/under-defined 상태가 있다. Drawing에는 도구·시트·설정·참조 검사·내보내기가 있다. Render에는 Appearance/Lights/Scene/Source와 raster/path tracing이 있다. Assembly에는 인스턴스 배치와 mate 참조가 있다. 이 기능을 없거나 새로 만들어야 할 기능으로 쓰지 않는다.

## 로드맵 연결

현재 로드맵의 **15(제품 사용성),20(기즈모/preview/알림),21(도구·History 배치)**가 직접 범위다. 21에는 이미 분류 이름, 도구 검색, Browser와 History 개선이 들어 있다. 이번 제안은 그 작업을 구체화한다.

**05는 Viewer 앱 범위**이므로 Studio 변경의 주 작업으로 쓰지 않는다. 색·타이포그래피·일관된 조작 이름 정도만 함께 맞출 수 있다. **16은 정확도·거부·참조·단위의 별도 게이트**다. 보기 좋은 UI로 16이나 전체 commercial CAD 완료를 선언하지 않는다. 저장·버전·복구는 12의 기존 계약을 보존한다.

## 우선순위 개선안

### SUX-1. Expose command groups and command search — First

**사용자 작업:** Find the right tool after selecting a face, edge, profile or body.

**소스 근거:**

- [src/App.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/App.tsx:282) — exact commit 줄 282, 283, 3640, 3667. Five TOOL_GROUPS feed a single vertical rail; groups have separators without visible labels.
- [src/styles.css](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/styles.css:176) — exact commit 줄 176, 178, 499, 500. 44px one-column scroll rail; small-height rules shrink tool hit boxes.
- [src/ui/Palette.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/Palette.tsx:14) — exact commit 줄 14, 27. Existing cmdk/Radix command search with availability reasons.
- [src/ui/ToolsTray.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/ToolsTray.tsx:12) — exact commit 줄 12, 55. Already measures available width and moves trailing items into More tools.

**디자인 판단:** Categories, short labels and a visible Find command entry should reduce icon recall and scrolling. Use the existing command registry and availability semantics; group overflow by task, not by accidental rightmost order.

**최소 완료 조건:** All existing categories and Find command are visible at 1440x900; current selection opens the same command by rail/search; keyboard sees name, shortcut and refusal reason; no command is lost at 900px.

**미확인:** Actual discovery time, required icon density, touch use and width tradeoff need observed UI work.

**연결:** 21, 15, 20, 16 availability/refusal preservation.

### SUX-2. Keep the active editing transaction at the top of one inspector — First

**사용자 작업:** Select references, enter dimensions, inspect preview and Apply/Cancel without losing the command.

**소스 근거:**

- [src/App.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/App.tsx:3553) — exact commit 줄 3553, 3555, 3674, 3883, 3891. Active Hud floats if dock not docked; otherwise Browser precedes Hud and then inspector/PreviewSection.
- [src/layout/Dock.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/layout/Dock.tsx:14) — exact commit 줄 14, 22. Single scroll column or plain overlay sheet.
- [src/ui/Hud.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/Hud.tsx:54) — exact commit 줄 54, 74. Command title, placement/selection steps, fields, inline refusal and Apply/Cancel already exist.

**디자인 판단:** Pin current command title, reference summary and accepted/draft state before Browser; independently scroll details and keep Apply/Cancel reachable. Fold nonessential panels during commands with an explicit way back.

**최소 완료 조건:** Long commands keep reference slots and Apply/Cancel visible at 1440x900 and 900x700; canvas selection remains usable; switching read-only panels does not reset typed values; refused preview never appears applied.

**미확인:** Whether current command is actually below fold for each common file is browser proof, not established by source order alone.

**연결:** 20, 21, 15, 16 accepted-state preservation.

### SUX-3. Make precision, units and parameter binding readable and consistent — First

**사용자 작업:** Change one dimension or bind it to a named parameter without mistaking a draft for an accepted value.

**소스 근거:**

- [src/styles.css](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/styles.css:15) — exact commit 줄 15, 137, 219, 230. 12px base, 11px field labels/card headings, 10px preview badge.
- [src/ui/Hud.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/Hud.tsx:12) — exact commit 줄 12, 36, 43, 50. 26px text-xs mono controls; numeric/choice/text/file semantics and mm/degree/ratio suffixes.
- [src/App.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/App.tsx:3963) — exact commit 줄 3963, 3988. NodeEditor stores typed draft, numeric input, named parameter binding dropdown, Apply/Reset.
- [src/ui/ParametersPanel.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/ParametersPanel.tsx:1) — exact commit 줄 1, 4, 26, 45, 55, 64. Named numeric parameters/configurations exist; numeric validation and blur/Enter commits.

**디자인 판단:** Use a coherent 13-14px working text scale, larger key values, tabular numeric alignment and consistent labelled units; visibly separate typed draft, evaluated value and binding. Prefer a labelled named-parameter action over a small unexplained f glyph.

**최소 완료 조건:** Long names, negative/zero/decimal values, blank draft and mm/degree/ratio units stay legible without clipping; bind/unbind preserves the current supported core behavior; no precision/tolerance or unit conversion is changed merely for appearance.

**미확인:** Inspected editors are numeric plus named binding. General arbitrary formula entry is not established and must not be promised. Contrast and screen-reader output require actual verification.

**연결:** 15, 20 dimension handle/value editing, 16 unit/precision contracts.

### SUX-4. Separate preview cancellation, computation Stop and save/recovery state — First

**사용자 작업:** Know whether a change is a preview, accepted but rebuilding, dirty, saved or refused; stop the correct operation.

**소스 근거:**

- [src/App.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/App.tsx:1254) — exact commit 줄 1254, 1486, 1494, 1535, 1539, 3561, 3563, 3701, 3706, 3850, 3879. Cancel preview, queued Apply when busy, dirty dot, stage/main work bars, footer compute text, recovery and error toasts are separate state surfaces.
- [src/ui/Hud.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/Hud.tsx:56) — exact commit 줄 56, 74. Preview/refused/evaluating badge and disabled Apply already exist.
- [src/styles.css](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/styles.css:258) — exact commit 줄 258, 301, 304, 529. Viewport hint, toast/recovery stack and computation work bar occupy separate overlay locations.

**디자인 판단:** Use one persistent operation/status region and one inline command result. Keep file dirty/save status distinct from geometry freshness. Name Stop and explain its existing rollback effect instead of presenting every operation as Cancel. Move actionable recovery/refusals out of selectable model area.

**최소 완료 조건:** A user distinguishes preview Cancel, main rebuild Stop, import/repair Cancel, queued Apply, dirty and recovery offer. Existing D321/D322 ownership behavior and all necessary warnings/actions are preserved. No success is shown before acceptance.

**미확인:** Occlusion frequency, severity ordering and simultaneous-state combinations need actual UI evidence; no runtime bug is asserted here.

**연결:** 20 notifications and preview meaning, 15, 12 save/recovery, 16 failure/refusal truth.

### SUX-5. Give each workspace one contextual control area — Next

**사용자 작업:** Move from Model to Sketch, Drawing, Render or assembly inspection while retaining orientation and selection meaning.

**소스 근거:**

- [src/App.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/App.tsx:3567) — exact commit 줄 3567, 3574, 3672, 3883, 3891. Model/Sketch/Render/Drawing share one mode group; Sketch is active editing state with Finish. Outer dock always mounts separately.
- [src/ui/DrawingWorkspace.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/DrawingWorkspace.tsx:720) — exact commit 줄 720, 750, 783, 784. Drawing supplies its own tools, sheet, settings/export panel and hint.
- [src/drawing/drawing.css](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/drawing/drawing.css:4) — exact commit 줄 4, 10. Drawing has its own 248px absolute panel within the stage.
- [src/ui/RenderPanel.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/RenderPanel.tsx:170) — exact commit 줄 170, 200. Existing raster/path-trace state and Appearance/Lights/Scene/Source tabs; path-trace output is a frozen still.
- [src/ui/InstancePanel.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/InstancePanel.tsx:20) — exact commit 줄 20, 44. 해당 작업의 기존 UI 연결과 상태를 확인했다.
- [src/ui/MatePanel.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/MatePanel.tsx:48) — exact commit 줄 48, 69, 161, 179. 해당 작업의 기존 UI 연결과 상태를 확인했다.

**디자인 판단:** Keep current workspaces but give active task a clear heading/breadcrumb and contextual tools. Bring Drawing settings into the shared context area or explicitly replace the outer inspector; show assembly instance/reference/placement first on instance selection. Preserve advanced source/render controls behind their existing advanced entry.

**최소 완료 조건:** Only one active settings column competes with the canvas; Sketch plane/Finish/Cancel remain explicit; Drawing sheet/selected annotation/export are easy to find; assembly world/local coordinates and mate references stay distinguished; frozen render still is never presented as live geometry.

**미확인:** Exact duplicate panel width and compact overlap must be measured on actual screens; new workspace categories are not required.

**연결:** 15, 20, 21, 16 scope/reference clarity, 05 Viewer only as visual vocabulary reference.

### SUX-6. Keep named history and source context available while editing — Next

**사용자 작업:** Understand which feature is being edited, what precedes it and what Undo/Redo will affect.

**소스 근거:**

- [src/App.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/App.tsx:3016) — exact commit 줄 3016, 3017, 3174, 3189, 3683, 3699. History names default off; History hidden during sketch/active/Render; Browser tree supports bodies/features and collapse.
- [src/styles.css](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/styles.css:242) — exact commit 줄 242, 250, 270. 40px history strip, 28px icon chips; labels optional; cramped stage hides history.

**디자인 판단:** Show feature name and edit breadcrumb by default for the current step; keep a compact read-only history summary while a command is active rather than losing orientation. Use Browser hierarchy and history for different jobs without duplicating every field.

**최소 완료 조건:** Current feature/rollback boundary are visible in idle/edit/sketch modes; history cannot mutate unrelated work while D321 refusal applies; Undo/Redo labels describe the accepted change; keyboard access and narrow-window summary remain available.

**미확인:** Full stack depth and behavior on large user models are not established by this source review.

**연결:** 21 history, 15, 16 origin ownership.

### SUX-7. Unify keyboard, focus and compact-panel behavior — Next

**사용자 작업:** Complete a command with keyboard or a narrow screen without losing focus or invoking Apply twice.

**소스 근거:**

- [src/ui/Tooltip.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/Tooltip.tsx:16) — exact commit 줄 16, 34. Global tooltip trigger observes mouseover/mousedown/window blur, not original-control focus events.
- [src/layout/Dock.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/layout/Dock.tsx:16) — exact commit 줄 16, 22. Compact dock uses plain aside/sheet and toggle; no local Escape/focus return policy.
- [src/layout/ChatColumn.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/layout/ChatColumn.tsx:21) — exact commit 줄 21, 35. Resize handle has separator semantics and pointer drag; local keyboard resize handling not present.
- [src/ui/Palette.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/Palette.tsx:14) — exact commit 줄 14, 27. 해당 작업의 기존 UI 연결과 상태를 확인했다.
- [src/ui/ShortcutHelp.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/ShortcutHelp.tsx:16) — exact commit 줄 16, 35. 해당 작업의 기존 UI 연결과 상태를 확인했다.
- [src/ui/Hud.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/ui/Hud.tsx:28) — exact commit 줄 28, 73. 해당 작업의 기존 UI 연결과 상태를 확인했다.
- [src/App.tsx](/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b/apps/cad-studio/src/App.tsx:2592) — exact commit 줄 2592, 2604. 해당 작업의 기존 UI 연결과 상태를 확인했다.

**디자인 판단:** Reuse existing Radix dialogs/menus, and define which panels are modal or nonmodal. Tooltip names/reasons must also appear on focus; compact closing returns focus; keyboard resize gets a defined alternative. Preserve existing shortcut scope and native Enter protections.

**최소 완료 조건:** Keyboard can find tool, select reference, type value, inspect refusal, Apply/Cancel and return to canvas. Escape has one defined target per state; focus does not fall behind a closed panel; tool reasons do not depend only on hover. Modal behavior is explicit, not assumed for every inspector.

**미확인:** Actual focus order, screen-reader output and contrast remain NOT_RUN. These source observations are improvement candidates, not a claimed accessibility certification failure.

**연결:** 15 accessibility, 20, 21, 16 refusal visibility.

## 구체적인 배치 방향

파일명·저장 상태·Undo/Redo·Open/Save/Export는 조용한 공통 헤더에 둔다. 작업 선택과 자주 쓰는 명령은 이름이 있는 묶음으로 분리한다. 중심은 모델 또는 도면이며, 활성 편집 패널은 한 곳에서 먼저 보인다. 선택하지 않은 고급 옵션은 접되 값·단위·거부 사유는 숨기지 않는다. Chat은 현재처럼 필요할 때 열되 모델 작업 영역을 영구적으로 압박하지 않게 한다. 이 검토는 새 마케팅 화면이나 카드 격자를 제안하지 않는다.

공통 상태의 표시 우선순위는 ① 현재 작업과 대상,② 미리보기/적용/계산 상태와 가능한 행동,③ 현재 값과 단위,④ 파일 dirty/저장 위치,⑤ 진단 상세다. 복구·원본 불일치처럼 판단이 필요한 항목은 작은 장식 토스트로 축소하지 않는다. 현재의 거부·원본 보존과 D321/D322 수명 규칙을 그대로 지켜야 한다.

큰 글자/간격을 적용할 때는 viewport가 과도하게 줄지 않는지 실제로 확인한다. 제안한 13–14px 작업 글자는 디자인 목표이며 실제 접근성 합격 수치가 아니다. 기존 light/dark 둘 다 계층을 고칠 수 있다. 색을 밝게 바꾸는 것만으로 현대화가 끝나지는 않는다.

## 구현 전에 정할 사항과 검증 경계

- 활성 command가 있을 때 Browser와 Inspector 중 무엇을 접을지, 그 상태를 작업 종료 후 되돌릴지 정한다.
- Sketch의 Finish/Cancel과 Model/Render/Drawing 이동 시 draft 처리 규칙을 명시한다. 보기 전환으로 편집 결과가 적용된 것처럼 보이면 안 된다.
- compact inspector를 modal로 할지 nonmodal로 할지 정하고 focus/Escape/return 정책을 그 선택에 맞춘다. 모든 inspector에 focus trap을 강제하지 않는다.
- 한 번의 모델 편집, 한 번의 Sketch 치수/constraint 편집, 한 번의 Drawing annotation, 한 번의 assembly reference 선택에서 같은 정보 순서를 확인한다. 이것은 향후 화면 검증 조건이며 이번에 실행하지 않았다.
- Undo/Redo, Save/Open, 계산 중 refusal/Stop, 실패 후 accepted state 보존과 실제 파일·자원 검증은 별도 기능 게이트로 남긴다.

제품 코드는 수정하지 않았다. 새 프레임워크·solver·저장 schema·public API·전체 App 재작성은 권하지 않는다. 화면 검증과 테스트는 다른 담당자의 증거를 사용하며 이 소스 검토는 여기서 종료한다.
