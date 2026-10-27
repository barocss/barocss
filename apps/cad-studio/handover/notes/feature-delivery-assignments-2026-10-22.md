---
work_id: cad-review-continuation-20261022
artifact_type: feature-delivery-brief
status: ready_for_build
owner_role: CAD Coordinator
source_request: "두 스킬을 적용해서 세 Work에 기능 구현 중심으로 다시 배정"
last_updated: 2026-10-22
---

# 기능 구현 중심 배정

## 목표와 결정

기존 CAD 문서와 Canvas에서 사용할 수 있는 기능을 완성한다.
feature-orchestrator로 소유권과 의존성을 정한다.
company-delivery-owner로 구현 결과와 완료 기준을 정한다.
검사는 기능 과제에 포함한다. 검사 준비만으로 기능 완료를 선언하지 않는다.
현재 상태와 전송 결과의 단일 기록은 [state.yaml](../state.yaml)이다.

## 현재 단계와 담당 결과

- Kernel: FRk3 native 체크포인트 수신. 다음 구현은 D164 FRk4 곡선/절곡 프레임.
- Model: 공유 seam native 체크포인트 수신. 다음 구현은 기존 편집기의 FRk3 생성/편집/저장 연결.
- GPU: cf9 WebGPU 영상 실패 수신. 다음 구현은 원인 수정과 기존 화면의 다섯 표시 모드 연결.
- Coordinator: 기존 결과를 직렬로 검토·통합한다. native 완료와 통합 검증을 구분한다.

## 의존성과 파일 경계

Model은 자신의 19930fca 위에 정확한 Kernel 81fbc252를 정상 merge한 뒤 시작한다.
Kernel은 자신의 81fbc252에서 FRk4를 구현한다.
GPU는 자신의 29af1972와 기존 fixture WIP를 보존하며 진행한다.
App.tsx는 GPU의 표시 모드 연결에만 이번 창의 독점 lease를 부여한다.
Model은 기존 FrameSections UI와 Model 명령/문서 경로를 담당한다.
A1 recovery는 이번 창의 App 수정 대상이 아니다.
무거운 검사 예약 순서는 GPU → Model → Kernel/core 필요분 → Coordinator 통합 창이다.
실제 실행에는 정확한 불변 SHA와 별도 lease가 필요하다.

## 적용한 스킬과 생략한 단계

기능 목표/제품 범위, 소유권/의존성, 기존 UI 사용 방향은 코디네이터가 기존 인계에서 확정했다.
세 기존 Work가 구현과 필요한 검증을 담당한다.
새 제품 기획 Work, 별도 설계 Work, 새 검증 Work는 만들지 않는다.
독립된 디자인 산출물은 기존 UI 재사용 때문에 생략한다.
출시 단계는 사용자 요청 범위에 없으므로 실행하지 않는다.
통합/QA 인수는 실제 결과 수신 뒤 코디네이터가 기록한다.

## 미해결 사항

WebGPU 영상 실패의 원인은 아직 확정되지 않았다.
FRk3 화면/파일 인수, FRk4 native 인수, G21 화면 인수는 아직 실행 전이다.
아래 지시는 검사 성공이나 제품 통합을 뜻하지 않는다.

## Kernel에 보낼 지시 원문

사용자가 feature-orchestrator와 company-delivery-owner를 적용해 세 Work를 기능 구현 중심으로 재배정하라고 지시했습니다. 이번 배정은 구현과 필요한 검증을 하나의 기능 과제로 묶습니다. 검사 도구/준비 문서만을 최종 산출물로 삼지 마세요. 기존 Work에서 진행하고 다른 Work의 수정은 보존하세요. 새 채팅/Issue를 만들지 말고 reset/stash/amend/rebase, 원격 push/PR/merge, 배포, 라이브 모델/다운로드는 하지 마세요. 한 기능 체크포인트를 제출한 뒤 다음 배정을 기다리세요.

과제: FRk4 — 속이 빈 단면의 곡선 프레임과 절곡 부재를 Kernel에서 실제 형상으로 생성.
기준: 현재 clean evidence HEAD 81fbc252556b961198b14c106b3796606df6494f, FRk3 코드/검사 87cb0a9f8bf81d4c2c93f36741cb985f2c94dcb2. 이 기준에서 시작하고 정확한 부모/작업 SHA를 기록하세요. FRk3 native를 Model이 소비하도록 전달했습니다. FRk3의 7개 i-beam 필드/기존 channel 기본값/API와 A9 공유 seam API는 고정합니다. FRk3 Model/UI 연결은 Model 담당입니다.
소유: packages/barocss-cad/**. 관련 Kernel D-record는 기존 decisions.md에만 덧붙일 수 있습니다. Model, App.tsx, src/ui, viewport, GPU, 공유 runner/root/lock은 수정하지 마세요.
구현: D164 FRk4 계약대로 revolve의 내부 구멍과 부분 회전 cap 구멍을 지원하고, through/center arc skeleton 및 bends:[{point,radius}]를 기존 frame 경로에 연결하세요. 단면의 시작 접선 배치, straight+bend+straight 하나의 부재, centroidal developed length/cut-list 보고를 구현하세요. 분석으로 끝내지 말고 production 코드를 완성하세요. 구현 전에 그 과제 안에서 입력/보고/face-role 계약을 짧게 고정하세요. 기존 계약과 충돌하면 그 부분만 질문하고 독립 구현은 계속하세요.
완료 기준:
1. 중공 단면의 부분 원호에 실제 bore wall과 구멍 있는 cap이 생기고 닫힌 유효 B-rep가 생성됩니다.
2. through와 center arc, 직선-굽힘-직선 부재가 기존 frame 문서 경로에서 재평가됩니다. 단면 방향/끝 접선과 developed length가 맞습니다.
3. Pappus A*r_centroid*theta 및 bent length 기반 독립 값과 체적/질량이 일치합니다. 현재 수치 기준을 완화하지 마세요.
4. ARC_MEMBER, BEND_RADIUS, BUTT_ON_CURVED_MEMBER 거부를 명시적으로 유지하고, 기존 직선/FRk3/A9를 보존합니다.
5. Model 담당이 바로 연결할 수 있는 정확한 타입/입력/출력 예시와 지원 한계를 코드 체크포인트와 함께 인계합니다. Kernel native 완료를 Studio 화면 완료라고 보고하지 마세요.
검사: 변경 경로 build/types/lint와 필요한 FRk4/회귀 검사를 구현 과제에 포함하세요. B-rep core 변경이면 전체 Kernel 검사는 필요하지만 직렬 heavy 슬롯을 요청한 뒤 실행하세요. 지금은 heavy 슬롯 없음; GPU가 다음 예약입니다. 장기 검사를 기다리는 동안 구현은 계속합니다. 별도 검사 프레임워크를 만들지 마세요.
보고: baseline/task/tested/evidence SHA, 소유/변경/dirty 경로, 실제 구현 전후, 실행/미실행 검사와 첫 실패를 제출하세요. FRk3 소비자가 API 결함을 재현하면 그 수정은 이 Work가 우선 지원합니다.

## Model에 보낼 지시 원문

사용자가 feature-orchestrator와 company-delivery-owner를 적용해 세 Work를 기능 구현 중심으로 재배정하라고 지시했습니다. 이번 배정은 구현과 필요한 검증을 하나의 기능 과제로 묶습니다. 검사 도구/준비 문서만을 최종 산출물로 삼지 마세요. 기존 Work에서 진행하고 다른 Work의 수정은 보존하세요. 새 채팅/Issue를 만들지 말고 reset/stash/amend/rebase, 원격 push/PR/merge, 배포, 라이브 모델/다운로드는 하지 마세요. 한 기능 체크포인트를 제출한 뒤 다음 배정을 기다리세요.

과제: FRk3 사용자 기능 — 기존 CAD 편집기에서 I/H 빔과 경사 플랜지 채널을 생성·편집·저장·다시 열 수 있게 연결.
받은 결과: 공유 seam task/tested 249f5cf2c6bde062c699939a3fd4ad388b19c2ce, evidence 19930fca721bdbba4b392bf8bd47740727d651a3의 57/57 및 types/lint 보고를 받았습니다. native 완료로 기록하며 통합 인수는 별도입니다. 그 구현과 7c4 정책/atomic accounting/placement 수정은 보존하세요.
정확한 기준: clean 현재 HEAD 19930fca721bdbba4b392bf8bd47740727d651a3에 Kernel evidence 81fbc252556b961198b14c106b3796606df6494f를 정상 merge하세요. Kernel 코드 87cb0a9f8bf81d4c2c93f36741cb985f2c94dcb2가 FRk3 API입니다. merge 후 기준 SHA를 먼저 기록하세요. cherry-pick으로 정책/API 선행 의존성을 누락하지 마세요. 충돌하면 양쪽 내용을 보존하고 해당 파일을 보고하세요.
소유: packages/barocss-cad-model/**, apps/cad-studio/src/ui/FrameSections.tsx 및 필요한 기존 src/ui 프레임 편집 소비자. Kernel/GPU/viewport/App.tsx/styles.css/공유 browser-flow/root/lock 수정은 제외합니다. 이번 과제에는 Model의 src/app/frameCommands.ts, editFields.ts, engine/doc.ts, chat/features.ts·tools.ts와 section library/file 경로를 포함합니다.
구현: MemberSection/InlineSection, strict v2 fields와 describe/help, sectionLabel, frame/frame-member 생성·재편집, 사용자 section library/table의 I/H 및 channel 입력을 끝까지 연결하세요. 기존 LibraryPanel/FrameSections와 공통 명령/편집 패널을 사용하세요. 별도 기능 에디터는 만들지 마세요.
API: i-beam은 height,width,web,flange,rootRadius,toeRadius,flangeSlope 모두 필수이며 0도 명시합니다. channel의 새 toeRadius/flangeSlope만 생략 시 0입니다. slope는 rise/run, flange는 overhang midpoint 두께입니다. 표준 수치 내장 없이 사용자 행/출처/estimate 규칙을 보존하세요. 새 section의 weld/bead 지원은 기존 V1 제한을 그대로 표시하고 unsupported를 수치 성공으로 바꾸지 마세요.
완료 기준:
1. 기존 화면에서 I/H와 경사 channel을 선택하고 치수를 입력하면 같은 문서/Canvas에 생성됩니다.
2. 기존 편집으로 치수/parameter를 바꾸면 형상·label·cut-list가 갱신됩니다. 공통 undo/redo가 동작합니다.
3. Save/Open 후 필드와 형상이 보존되고 다시 편집됩니다. 기존 channel의 생략 의미와 명시적 I의 0을 잃지 않습니다.
4. 같은 입력을 v2 도구로 생성·수정할 수 있고 unknown/missing/invalid 필드는 실제 도구 경로에서 거부됩니다.
5. 영향 검사가 통과하며 공유 seam의 atomic refusal/placement/불완전 whole-part accounting은 유지됩니다. 문서/검사 코드만 제출하면 기능 완료가 아닙니다.
검사: Model+Studio 관련 types/lint, 영향 단위 및 저장/재편집 검사를 함께 수행하세요. 실제 공통 화면 생성→편집→undo/redo→Save/Open→재편집도 이 과제의 완료 기준입니다. browser/전체 suite는 고정 SHA를 보고한 뒤 직렬 슬롯을 배정받아 실행합니다. GPU 다음에 예약합니다. 기존 테스트 runner에 필요한 작은 case만 쓰고 준비 전용 새 단계를 만들지 마세요.
A1 recovery production/App 수정은 계속 보류합니다. App.tsx는 이번 창에서 GPU의 표시 모드 연결 전용입니다. 공유 seam 통합/다음 A9 진행은 코디네이터가 맡습니다.
보고: 정확한 baseline/task/tested/evidence SHA, 사용자 기능 전후, 실제 화면/파일 결과와 미실행 항목, 첫 실패 및 preserved dirty 경로. Kernel API 결함은 재현 입력과 함께 즉시 전달하세요.

## GPU에 보낼 지시 원문

사용자가 feature-orchestrator와 company-delivery-owner를 적용해 세 Work를 기능 구현 중심으로 재배정하라고 지시했습니다. 이번 배정은 구현과 필요한 검증을 하나의 기능 과제로 묶습니다. 검사 도구/준비 문서만을 최종 산출물로 삼지 마세요. 기존 Work에서 진행하고 다른 Work의 수정은 보존하세요. 새 채팅/Issue를 만들지 말고 reset/stash/amend/rebase, 원격 push/PR/merge, 배포, 라이브 모델/다운로드는 하지 마세요. 한 기능 체크포인트를 제출한 뒤 다음 배정을 기다리세요.

과제: G21 표시 모드 사용자 기능 — 기존 CAD 화면의 Views 제어로 다섯 표시 모드를 실제로 사용하도록 완성하고, 현재 WebGPU 영상 실패를 해결.
받은 결과: cf9ca66177632720b88b782894bb828f9691a0f4의 4조합 실행과 evidence HEAD 29af197287467aea3963db24a353441d6f0ad486을 받았습니다. WebGL2 DPR1/2 각각13/13, WebGPU DPR1 quarter/octant 및 DPR2 octant 실패를 보존합니다. 첫 실패 quarter 486/307200=0.158203% > 0.1%, 원인은 아직 미확정입니다. 이전 슬롯은 종료/반환된 것으로 기록합니다.
기준: 현재 29af197287467aea3963db24a353441d6f0ad486에서 시작하세요. backend ae70bd67728c2790e5fd540622b6ad33c564b9b4, harness cf9를 구분합니다. 현재 unstaged packages/barocss-gpu/tests/fixtures/cad-display-browser.ts는 작성자 미확정 WIP로 보존하세요. 임의 reset/restore/stash 또는 새 구현과 무차별 stage를 하지 마세요. 변경 전 patch/hash를 별도 증거로 보존하고, clean scratch와 원래 checkout을 분리해서 보고하세요.
소유: packages/barocss-gpu/**, apps/cad-studio/src/viewport/**. 추가로 이번 기능에 한해 apps/cad-studio/src/App.tsx의 displayMode session state, 기존 Views 제어, Viewport prop 전달과 명시적 unsupported 안내만 독점 lease를 부여합니다. apps/cad-studio/src/styles.css는 그 제어의 스타일만 허용합니다. Model의 src/ui/FrameSections 및 Model package, recovery writer/helpers, 일반 undo/save 코드의 변경은 제외합니다. App은 다른 Work가 수정하지 않습니다.
구현: shaded-edges(기본), hidden-removed, hidden-dashed, wireframe, x-ray를 기존 화면의 하나의 제어에 연결하세요. 모드 선택은 화면 상태이며 모델 형상/문서 dirty/history를 바꾸지 않습니다. 지원하지 않는 작업 공간/overlay/instance 조합은 잘못 렌더링하지 말고 제어에서 이유를 명시하고 안전한 기본 모드를 사용하세요.
현재 영상 실패는 보존된 quarter 비교/oracle PNG와 실제 depth/cap 경로로 원인을 구분한 뒤 원인 파일을 수정하세요. 0.1% 등의 기준을 통과 목적만으로 완화하거나 실패 증거를 덮어쓰지 마세요. 비교 oracle가 잘못된 경우에도 독립 기하 근거와 변경 이유를 남겨야 합니다.
완료 기준:
1. 실제 CAD 화면에서 다섯 모드를 선택할 수 있고 선택 상태와 화면이 일치합니다.
2. default 복귀, 전후 front/cap/body/edge 선택 ID와 native pick 의미가 유지됩니다. wireframe의 tessellation 대각선은 노출하지 않습니다.
3. hidden dash 6/4 CSS, x-ray alpha<=0.25 및 G20 cap/depth/occlusion 기준을 보존합니다.
4. 모드 변경 후에도 같은 문서의 편집/undo/redo/Save/Open이 정상입니다. 모드 자체가 저장된 모델 변경이 되지 않습니다.
5. 양 renderer DPR1/2 영향 결과와 실제 App 제어의 짧은 사용 흐름을 정확한 새 SHA에서 보고합니다. cf9 실패는 그대로 남기고 수정 후 결과를 별도로 기록합니다.
이 기능 완료가 whole G21 완료는 아닙니다. silhouettes/isolate-hide/WebGL2 instance bridge 등은 남은 범위를 명시하며 별도 기능 배정까지 확대하지 마세요.
검사: source 수정과 관련 작은 회귀/build/types/lint를 같은 기능 과제에서 진행하세요. PNG 읽기/기존 로그 원인 분석은 바로 진행 가능합니다. 다음 heavy 슬롯은 GPU 우선 예약이지만 현재 실행 lease는 없습니다. 구현한 불변 task SHA와 좁은 실제 화면/4조합 실행 계획을 보내면 코디네이터가 즉시 직렬 슬롯을 배정합니다. 다른 Work와 heavy 검사를 겹치지 마세요. 새 검사 프레임워크/준비 전용 checkpoint를 목표로 삼지 마세요.
보고: baseline/task/tested/evidence SHA, 수정한 실제 기능/실패 원인, 실행/미실행 검사, 첫 실패, 기존 WIP 보존 경로. 기능 구현이 막히면 필요한 소유 파일/의존성 하나를 구체적으로 알려주세요.

