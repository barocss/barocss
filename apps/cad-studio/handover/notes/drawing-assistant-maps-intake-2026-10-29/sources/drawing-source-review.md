---
work_id: drawing-assistant-20261029
artifact_type: source-review
status: done
owner_role: source-reviewer
source_request: Autodesk Assistant 도면 자동화 소개를 기존 BaroCSS Drawing·API·agent 경로와 비교
last_updated: 2026-10-29
---

# Drawing assistant: 기존 기능과 남은 완료 증거

**결론:** BaroCSS에는 이미 결정적 도면 planner, Auto dimension, issue checker와 공개 assistant tool 연결이 있다. 새 자연어 도면 시스템부터 만들 필요가 있다는 결론은 근거가 없다. 먼저 기존 구조화된 경로로 실제 부품의 검토 가능한 도면 초안을 완성하는 gate가 필요하다.

기준 commit은 `1266cdf24943acc5963bf5e346339e32c9f3da41`이다. 제품 저장소는 `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`이다. 모든 제품 확인은 명시한 commit의 git show/grep이다. 현재 App 분리 WIP는 사용하지 않았다. 제품/기존 증거 수정, build/test/browser/server/live AI 실행은 없다. **실제 실행 NOT_RUN**이다. 줄 번호는 기준 commit에 속한다. 아래 상대 제품 경로의 기준은 위 저장소다.

[Autodesk 공식 소개](https://www.autodesk.com/products/fusion-360/blog/automate-drawing-creation-autodesk-assistant/)에 대한 부모의 원문 확인 요지는 자연어로 규격·단위·sheet·뷰·치수 설정을 초안화하고, 제조 의도와 치수 배치·검토·승인은 사용자가 맡는 흐름이다. 이는 workflow 소개이며 전체 GD&T나 완성 제조도면 수락·수치 성능을 보증하는 근거가 아니다. 본 agent는 원문을 추가 조회하지 않았다. 아래 gate 예시는 이 글의 명령을 인용한 것이 아니다.

## 기존 roadmap에 먼저 연결

`apps/cad-studio/handover/roadmap.md:57,79,894,1221,1229`는 CG5/DR1–8을 나눈다. detail/broken/section/title/revision과 bounded GD&T를 전체 규격 적합성으로 올리지 않도록 명시한다. DR7 ISO/ASME style·inch와 DR8 drawing sets는 별도 후속 범위다. `:1149` O26은 agent tool budget에 CG5 drawing steps를 포함하고, `:1252` RS7.6은 같은 document에서 part/assembly drawing과 필요한 fit/datum을 요구한다. 이 문서는 roadmap 완료 상태를 갱신하지 않는다. API와 실제 파일·화면 수락은 구분한다.

## 이미 있는 일곱 기능

| 기능 | 정확 source 경로·함수·줄 | 수락 가능한 source 결론 |
| --- | --- | --- |
| 1. 도면 설정과 뷰 | `packages/barocss-cad-model/src/chat/drawing.ts:62-65,177-198,209-219` `set_drawing`/`setDrawingProblem`; `src/api/part.ts:468-475` | part/assembly scope, A4/A3, standard scale/auto, first/third projection, front orientation, front/top/right/iso, tolerancing/title를 구조화해 설정한다. unknown/invalid 입력은 거부한다. front/top은 필수 기본이며 right/iso가 선택이다. 단위·규격 preset API까지 있다는 뜻은 아니다. |
| 2. 결정적 배치 planner | `src/drawing/layout.ts:61,85,197-239` `chooseViews`/`frontByInformation`/`autoLayout`; `src/chat/drawing.ts:130-139` | 정보량으로 front를 선택하고 view room·scale·sheet 후보를 평가한다. A4에서 A3로 확대하거나 불필요 view를 제외할 수 있다. readable/dropped/남은 issue를 반환하므로 Auto를 고정 A4·네 view 보장으로 해석하면 안 된다. |
| 3. Auto 치수 | `src/drawing/auto.ts:241` `autoDimensions`; `src/chat/drawing.ts:124-139`; `apps/cad-studio/src/ui/DrawingWorkspace.tsx:590-612`; `src/ui/drawing/DimensionsList.tsx:16` | 외형·step·홀 위치/pitch/callout 등을 초안화한다. 자체 auto 치수는 갱신하고 manual 치수는 보존한다. `layout:false`는 현재 sheet/scale/views를 유지하며 치수만 만든다. assembly scope Auto는 명시 거부한다. |
| 4. 검사와 수정·재참조 경고 | `src/drawing/issues.ts:228,257-273,721,789-799`; `src/chat/drawing.ts:118,141-164` | lost dimension/frame, text overlap/line collision/offsheet, 누락/중복 등을 검사한다. 재매칭 참조는 REMATCHED 경고로 의도 확인을 요구한다. fix_drawing은 같은 bounded fix-round를 재평가하고 개선된 sheet를 유지한다. 제조 의도나 모든 치수의 충분성을 증명하는 checker는 아니다. |
| 5. 제조 주석과 상세 view | `src/drawing/options.ts:11-22,77-122`; `src/chat/drawing.ts:43-60,166-175` | title block/revision, datum/target/frame, section/detail/break/table 옵션과 tolerance suggestion이 있다. 추정과 data 기반 suggestion을 구분하며, 치수가 매달린 section/detail 의미 변경은 거부한다. revision row가 승인 기록을 자동 생성하지 않는다. bounded GD&T를 전체 지원으로 부르지 않는다. |
| 6. assistant/tool과 SDK 연결 | `src/chat/toolDefinitions.ts:7,22,312,377`; `src/chat/groups.ts:97`; `src/chat/tools.ts:91-99,229-237`; `src/api/part.ts:468-475` | drawing_issues/tolerance_suggestions/auto_dimension/fix_drawing/accept_tolerances/set_drawing이 tool schema와 dispatch에 포함된다. `Part.drawingSettings`/`autoDimension`도 같은 runDrawingTool을 쓴다. agent drawing 변경은 propose와 사용자 승인 대상으로 gate된다. 단순 helper만 있고 agent에 미연결이라는 결론은 틀리다. |
| 7. 문서 저장과 교환 출력 | `src/api/outputs.ts:72-91` `drawingDoc`/`drawingOf`; `apps/cad-studio/src/App.tsx:1037-1042,2038-2056,2248-2255,3693` | `Part.drawing()`이 issue reply와 같은 sheet의 SVG/DXF R2000/PDF 및 pdfMissing을 반환한다. UI Drawing 변경은 Undo/dirty와 문서 drawing에 연결되고 Save/Open은 전체 doc encode/readDrawing 경로다. 실제 roundtrip bytes·export 시각 결과는 이번 검토에서 실행하지 않았다. |

위 `src/` 축약 경로는 `packages/barocss-cad-model/src/`다. UI 표시 여부, engine 가능 범위, agent tool schema를 각각 확인했으며 같은 기능의 실제 UI/runtime PASS로 합산하지 않았다.

Studio chat transport는 `apps/cad-studio/src/chat/transport.ts:1`의 `/api/chat/turn`, `useStudioChat.ts:120`의 useChat 경로이고 App은 `:2372`에서 cad-model acceptProposal을 호출한다. 이번 한정 pass는 live provider가 tool을 고르는 동작이나 endpoint 전체를 실행/검증하지 않았다. agent 도면 명령의 schema/dispatcher/approval와 Studio 수락 호출까지의 source 연결을 확인한 범위다.

## 최대 세 가지 공백·미확인

1. **규격·단위·도면 세트 범위:** inspected set_drawing schema와 handler에 units/ISO/ASME preset이 없고 A4/A3 단일 sheet 설정이다. model/view 좌표는 mm 계약이다. DR7/DR8 후속과 일치한다. 다른 독립 엔진이 인치나 규격을 전혀 처리하지 못한다는 전역 부재 주장으로 확대하지 않는다.
2. **planner의 범위와 수동 참조 보존:** automatic component dimension은 assembly scope에서 거부된다. Auto layout은 요청 A4/뷰를 바꿀 수 있으며 manual reference가 묶인 orientation/scope/detail/section 변경은 거부될 수 있다. 이 정책은 source에 명시된 제한이다. 버그로 분류하지 않는다. 고정 네 view/A4 작업은 `set_drawing` 후 `auto_dimension({layout:false})` 경로로 시험해야 한다.
3. **현재 commit의 도면 완료 증거 미확인:** schema와 source 연결은 확인했지만 실제 브래킷의 검토 가능한 치수 배치, 수정 후 올바른 참조, native Save/Open 보존, SVG/DXF/PDF의 일치·font 누락, 사용자 proposal 수락/거절은 이번 실행 증거가 없다. 자연어 이해와 제조 승인도 NOT_RUN이다. checker 오류 0만으로 제조 준비 완료를 선언하지 않는다.

## 다음 최소 gate — 자연어 호출 없는 하나의 작업

**새 수락 예시:** 현재의 명시한 브래킷 fixture에서 A4/mm 정면·평면·우측·등각 view와 외형/홀 치수를 초안으로 만들고 누락·참조를 검토한다. fixture source/hash와 expected overall/hole 치수·허용 tolerance를 런 전에 고정한다. 임의 부품에 대한 전역 보장은 아니다.

기존 구조화된 tool/API만 쓴다. `set_drawing({scope:{kind:'part'},sheet:'A4',projection:'third',front:'y-',views:['front','top','right','iso'],scale:'auto'})` 뒤 `auto_dimension({layout:false})`를 **proposal ops**로 만든다. 초안/issue reply를 확인하고 사용자가 수락하기 전 native document가 바뀌지 않았음을 확인한다. SDK 직접경로 비교는 `Part.drawingSettings(...).autoDimension({layout:false}).drawing()`이다. API 직접 호출 자체는 chat 승인 gate가 아니므로 제품 사용자 승인 시험과 구분한다.

이후 `drawing_issues`로 missing/lost/REMATCHED/겹침과 남은 warning을 기록한다. 기준 치수와 fixture의 홀 callout을 사람이 대조한다. 필요한 수정은 기존 Drawing 편집/명시적 fix만 적용하며 자동 수정의 unresolved 항목을 숨기지 않는다. native Save/Open 후 drawing 의미·참조와 같은 sheet의 SVG/DXF/PDF를 확인하고 pdfMissing을 기록한다.

**완료 증거 하나:** 위 한 fixture의 고정 source와 실제 입력 ops, proposal 전/수락 후 문서 hash, 예상/실제 치수 및 issue 목록, native roundtrip semantic diff, 세 export hash와 최종 sheet screenshot을 묶은 하나의 receipt다. raw byte 동등성과 semantic 동등성은 분리한다. gate 결과는 `REVIEWABLE_DRAFT` 또는 구체 남은 문제다. 자동으로 `APPROVED`/`MANUFACTURING_READY`라고 쓰지 않는다. 이번 cycle은 이 gate 정의까지만 완료했고 실행하지 않았다.
