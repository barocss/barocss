---
work_id: cad-review-continuation-20261022
artifact_type: feature-delivery-followup
status: in_progress
owner_role: CAD Coordinator
source_request: "로드맵을 계속 검증하면서 기능 구현 일을 분배"
last_updated: 2026-10-22
---

# 기능 연결과 다음 작업

목표는 같은 CAD 문서/Canvas에서 사용할 수 있는 기능이다.
현재 상태·정확한 기준·검사 슬롯은 [state.yaml](../state.yaml)을 따른다.
이 기록은 첫 [기능 배정](feature-delivery-assignments-2026-10-22.md)을 이어간다.
feature-orchestrator와 company-delivery-owner를 계속 적용한다.

## 결정과 의존성

FRk3 Model 기능은 native 1f0와 실제 화면/파일 증거0f1을 인수하고 로컬115818에 통합했다.
FRk4 Kernel native는5ede/evidence270a로 전달되었으며 Model 연결은 Kernel Work가 이어 맡는다.
Model은 A9-13 부품 도면 범위를 수정한다. '모든 인스턴스를 부품 도면에 추가'는 잘못된 표현이다.
A9-13은 다른 부품의 형상/치수가 부품 도면에 섞이는 문제를 바로잡는다.
GPU 다섯 표시 모드는 c18의 네 matrix 조합과 두 실제 App 흐름 증거73db를 인수한다.
다음 GPU 기능은 WebGL2의 기본 조립 인스턴스 표시/선택 연결이다.
FRk4 Model 연결과 A9-13은 파일 lease로 분리한다. App은 GPU의 좁은 연결 범위다.
인계 결과를 직렬로 통합하고, 새 전체 창은1340e3607965178ce9686bd205b29f5d24ca7012에서 실행한다.
해당 창의 실행 상태와 결과는 state/evidence에 기록한다. native 검사 수치를 이 창의 결과로 재사용하지 않는다.

## 운영

코디네이터는 제품/의존성/기존 UI 방향을 기존 인계에 맞춰 정했다.
세 기존 Work가 구현과 필요한 검증을 맡는다. 새 계획·설계·검사 Work는 만들지 않는다.
출시 단계는 범위 밖이므로 실행하지 않는다. 현재 QA/통합 창과 이후 화면 슬롯은 직렬로 운영한다.
native 기능, 로컬 코드 통합, 실제 화면/파일, 전체 통합 인수를 구분한다.
whole G21, 전체 FR 완료 및 A9 전체 수용은 아직 완료가 아니다.

## Kernel 후속 지시 원문

배정 이후 머신 부하가 크게 증가해1340 전체 창의 Model suite를 중단했다.
중단 전 끝난 build/Kernel42/GPU149/consumer3만 실제 결과로 보존한다.
Model 전체 suite 수나 전체 browser 성공은 없다. 새 검사 실행은 부하 회복 후 직렬 배정한다.
세 Work의 소스 구현/리뷰는 계속하며 partial checkpoint는 완료로 승격하지 않는다.
Kernel의 추가 lease는 engine/evaluate.ts의 frame 양끝/병합 bend 표시와
app/weldmentCommands.ts의 curved 경로 명시적 거부 부분에만 한정한다.
Model에게 같은 파일 경계를 전달했다. 상세 실행 상태는 state.yaml을 따른다.

FRk4 native 코드5ede2e218aa6347cc78872828cbd6e813dd571e9와 evidence270a89f108087a656511f61d63b2c9369e3c96e2를 받았습니다. 소유 범위, revolve holes, arc/bend 보고 및 지원 한계, 75+3+3 native 검사 보고를 검토했습니다. 별도 Studio 기능 완료라고 보지는 않습니다. FRk5로 넘어가기 전에 이 FRk4를 기존 편집기까지 연결하세요.

과제: FRk4 공통 CAD 편집기 연결 — 중공 원호/절곡 프레임의 생성·편집·저장·재열기.
정확한 시작: clean270a89f108087a656511f61d63b2c9369e3c96e2에 코디네이터 통합115818f239302003cc5830a1c2c551482b3cbdb8을 정상 merge하고 새 기준 SHA를 보고하세요. Model FRk3 화면/필드 연결이 포함된 기준입니다. FRk4 Kernel 입력/출력 계약과 기존 A9/FRk3를 유지합니다.
추가 소유 lease(이번 기능 한정): packages/barocss-cad-model/src/engine/doc.ts, part.ts, elements.ts; src/chat/features.ts, tools.ts; src/app/frameCommands.ts, editFields.ts; src/frames/skeleton.ts, welds.ts; FRk4 연결을 위한 해당 package의 새/기존 관련 test. 기존 packages/barocss-cad/** 소유는 유지합니다. Model 담당에게 동일한 파일 경계를 전달했습니다.
Model의 A9-13은 drawing/**, chat/drawing.ts, DrawingWorkspace.tsx에서 진행 중입니다. 그 파일과 engine/evaluate.ts, App.tsx, styles.css, viewport, GPU, 공통 browser runner, root/lock은 수정하지 마세요. 다른 파일이 실제로 필요하면 정확한 파일과 필요한 변경 하나를 알려주세요. lease 밖 파일을 묵시적으로 고치지 마세요.
구현: Model FrameNode/segment/bends 문서 타입, Kernel forwarding과 결과/참조 ID, strict v2 입력/describe, 공통 생성·재편집 필드를 연결하세요. 기존 Frame/Structural member 도구와 속성 편집을 사용해 through/center 원호와 tangent bend를 최소 입력으로 만들 수 있게 하세요. 별도 기능 에디터나 새 3D 스케치 시스템은 만들지 마세요. 저장/worker/cache에서 arc/bend 필드가 소실되지 않게 하고, 원호를 직선으로 조용히 처리하지 마세요. 명시적 지원 한계를 사용자 문구로 표시합니다.
완료 기준:
1. 기존 CAD 화면/공통 명령에서 round-tube 중공 원호를 생성하고 through 또는 center/반지름 관련 입력을 재편집하면 실제 한 문서/Canvas의 형상이 갱신됩니다.
2. 직선–bend–직선이 한 부재로 생성됩니다. developed length/cut-list와 body 식별이 실제 결과를 따르고, 일반 직선 부재 ID는 유지됩니다.
3. 같은 입력이 v2 도구를 통과하며 unknown/invalid/unsupported arc/bend는 명시적으로 거부됩니다.
4. Undo/Redo, Save/Open, 재편집과 실제 worker 평가에서 필드/형상/보고가 보존됩니다. 기존 I/H/채널 및 공유 seam accounting을 깨뜨리지 않습니다.
5. 소스/types/lint와 관련 작은 회귀를 기능에 포함하고, 고정 SHA에서 실제 생성→재편집→Save/Open을 확인합니다. native75를 새 소비자 SHA 결과로 재사용하지 마세요.
검사 슬롯: GPU c18 실행은 종료/반환 보고를 받았습니다. 코디네이터가 결과 통합 후 창 검증을 예약할 예정이므로 지금은 구현/작은 검사만 진행하세요. browser/전체suite는 exact source SHA를 제출하면 직렬 배정합니다. 검사 준비 문서만으로 이 과제를 끝내지 마세요.
보고: merge 후 baseline, task/tested/evidence SHA, 실제 기능 전후와 지원 범위, 수정/dirty 경로, 실행/미실행/첫 실패를 제출한 뒤 한 checkpoint에서 멈추세요. 다른 Work의 WIP는 보존하고 reset/stash/amend/rebase, 새 Issue/채팅, remote/live-model/download는 하지 마세요.

## Model 후속 지시 원문

FRk3 사용자 기능을 인수했습니다. task/tested 1f0a28759070fd8b259baec5cd0647e7bbbce1ed, evidence 0f1caf9b712824b9528f8fb566ef889de92f594b의 24개 증거 해시를 확인했습니다. 실제 palette/편집/Undo/Redo/다운로드 Save/파일 Open 코드를 검토했고 I/H 화면과 저장 필드도 확인했습니다. native43/43, types/lint, 실제 WebGPU DPR1 두 bounded flow 통과를 해당 SHA의 근거로 인정합니다. 로컬 통합 SHA는 115818f239302003cc5830a1c2c551482b3cbdb8입니다. 통합 후 전체 flow를 새로 통과했다고 주장하지는 않습니다.

다음 기능 과제: A9-13 — 부품 도면의 범위를 선택한 자기 부품으로 바로잡기.
원문 기준: decisions-outer.md A9 S0의 A9-13. 현재 base frame 도면에 cover Ø60와 shaft Ø20 등 다른 인스턴스 형상/치수가 섞이는 결함입니다. '모든 인스턴스를 기본 부품 도면에 추가'는 잘못된 이전 표현이며 폐기합니다.
정확한 기준: clean 현재 evidence0f1에 통합115818f239302003cc5830a1c2c551482b3cbdb8을 정상 merge하고, 결과 baseline SHA를 먼저 기록하세요. FRk3/A9 공유 seam 구현과 실제 결과를 보존하세요.
소유: packages/barocss-cad-model/** 및 apps/cad-studio/src/ui/DrawingWorkspace.tsx, 필요한 기존 drawing 전용 src/ui 소비자. App.tsx/styles.css/viewport/GPU/Kernel/공유 browser-flow/root/lock은 제외합니다. 공통 STEP/assembly exporter에서 instances를 전역 제거하지 마세요. drawingInputs, drawing B-rep/project/section/worker·v2 소비자 범위를 한 기능으로 연결하세요.
동작: part 도면은 base 또는 명시적으로 선택한 part의 형상과 치수만 사용합니다. 조립 도면은 기존 BOM/balloon 의미와 instance 식별을 유지합니다. 기존 scope 선택이 있으면 사용하고, 없다면 DrawingWorkspace의 최소한의 명시적 부품/조립 범위만 허용합니다. default, 저장 필드/기존 파일 처리, UI/v2 동작 계약을 짧게 먼저 기록한 뒤 구현하세요. 새 도면 에디터나 A9-4의 일반 옵션 확대를 하지 마세요. 사용자가 직접 배치한 치수를 임의로 삭제하지 마세요.
완료 기준:
1. base frame+plate+shaft+cover 입력에서 base 부품 도면과 drawing.auto에 다른 part의 형상/Ø60·Ø20 등이 섞이지 않습니다.
2. part 지정 도면도 해당 part만 그립니다. 같은 부품의 인스턴스 위치/회전과 다른 부품 추가가 part 도면의 형상·자동치수를 오염시키지 않습니다.
3. 기존 assembly/BOM/balloon 번호와 인스턴스 대응을 보존합니다. 조립 범위에서 개별 부품의 모든 치수를 무분별하게 자동 생성하지 않습니다.
4. 기존 도면 UI, v2 도구, SVG/PDF/DXF 등 해당 도면 출력에서 범위가 일치합니다. Save/Open·재편집 후 범위와 참조가 유지됩니다.
5. 실제 화면에서 부품 도면을 열어 범위를 확인하고 도면 산출물을 저장합니다. 관련 Model/Studio types/lint 및 영향 검사를 기능 과제에 포함합니다.
검사: 그림/도구/worker/파일 범위의 관련 작은 회귀를 사용하세요. 새 일반 검사 프레임워크를 만들지 마세요. browser/전체suite는 GPU의 cad-g21-c18-display-20261022 실행 뒤 직렬 슬롯입니다. 지금은 기능 구현과 작은 검사만 진행하고 immutable source SHA가 준비되면 화면 실행을 요청하세요.
한 기능 checkpoint로 baseline/task/tested/evidence SHA, 실제 기능 전후, source/dirty 경로, 검사·미실행·첫 실패, 범위/지원 한계를 보고하고 멈추세요. 다른 Work의 변경은 보존하고 reset/stash/amend/rebase 또는 새 Issue/채팅/remote/live-model 작업은 하지 마세요.

## GPU 후속 지시 원문

표시 모드 c18 기능의 최종 증거 보존을 마친 뒤 다음 기능을 이어가세요. 현재 matrix/App 실행 결과와 다음 소스를 섞지 말고 evidence commit을 먼저 보고하세요.

다음 기능: G21 WebGL2 instance bridge — 기존 조립 문서의 배치 부품을 WebGL2에서도 표시하고 선택.
기준: tested c18d08e771d391ea7545c53903e4b2d31bac8ede의 production 내용을 유지하고 현재 통합115818f239302003cc5830a1c2c551482b3cbdb8을 정상 merge하세요. 증거 commit을 먼저 보존한 다음 merge 후 정확한 baseline SHA를 보고합니다. 미확정 원본 fixture WIP는 원래 d5ec에 그대로 보존하고 깨끗한 기능 checkout에서 진행하세요.
소유: packages/barocss-gpu/**, apps/cad-studio/src/viewport/**. App.tsx는 instance 표시 지원 상태/오류 이유와 기존 viewport 호출 연결에 필요한 부분만 연장 lease입니다. styles.css는 그 상태 제어에 필요한 최소 범위만 허용합니다. Model/CAD, DrawingWorkspace/FrameSections, recovery/save/history writer, root/lock/공유 runner는 제외합니다.
구현: 기존 instance packet, placement/pose와 원본 형상 자원을 재사용해 WebGL2에 배치 부품을 그리세요. 기존 문서의 선택/변환/숨김 의미를 유지하고, hit의 instance/body/face/edge 원본 ID가 정확해야 합니다. 별도 조립 에디터/scene 모델이나 외부 렌더러를 추가하지 마세요.
완료 기준:
1. 동일 부품의 서로 다른 위치·회전 인스턴스 둘 이상과 다른 부품이 기존 CAD Canvas에서 올바른 위치/크기로 보입니다. 가려진 부품과 실제 hidden 인스턴스가 올바르게 처리됩니다.
2. 기존 편집기로 인스턴스를 이동·회전하고 선택하면 화면과 instance ID가 일치합니다. 가장 앞의 유지된 면/단면 cap 선택이 다른 인스턴스로 바뀌지 않습니다.
3. 일반 조립 표시와 clip/cutout에서 기존 WebGPU와 WebGL2의 형상/선택 의미를 대조합니다. GPU 정확 ID/pick authority와 단위/좌표계는 유지합니다.
4. 실제 Save/Open 후 instance placement와 참조가 보존되고 다시 선택/편집됩니다. 문서/Undo 구조를 새로 만들지 않습니다.
5. ordinary base body의 다섯 표시 모드와 G20 결과를 회귀시키지 않습니다. 이번 목표는 기본 조립 표시/선택 bridge입니다. 아직 검증하지 않은 instance display-mode 조합, silhouette/isolate-hide는 명시적 미지원으로 남기고 whole G21 완료라고 보고하지 마세요.
검사: 구현과 관련 작은 GPU/viewport 검사, build/types/lint를 한 기능 과제로 수행합니다. exact source SHA가 준비되면 실제 WebGL2/기존 WebGPU 조립 비교와 Save/Open의 짧은 화면 슬롯을 요청하세요. 지금은 새 browser/전체suite/벤치 lease가 없습니다. 코디네이터 통합 창과 직렬 예약합니다. 기존 fixture/runner를 최소 확장하고 검사 준비를 별도 최종 산출물로 삼지 마세요.
보고: baseline/task/tested/evidence SHA, 소유/변경/보존dirty, 전후 사용자 동작, 실제 검사/미실행/첫 실패, 지원 범위를 제출하고 한 checkpoint에서 멈추세요. 새 채팅/Issue, reset/stash/amend/rebase, remote/release/live-model/download는 하지 마세요.

