# barocss CAD roadmap

## 전체 실행 색인 — 2026-10-27

이 번호는 기존 작업의 공통 색인이다. 새 작업 큐나 일괄 실행 승인이 아니다.
실제 배정은 기존 단일 기록의 `roadmapExecution.tasks`만 사용한다.
기존 CG·DR·K·O·R·RS·PB·V 및 이슈 ID는 그대로 유지한다.
번호 순서가 모든 작업의 직렬 실행 순서를 뜻하지는 않는다. 독립 소스는 병렬로 만든다.
같은 기능은 **Kernel/GPU/CAD → CAD Model·API → Studio/Viewer 실제 소비 → 제품 통합**까지 닫는다.
잘못된 성공, 단위·좌표·참조 손실과 실제 오류는 해당 기능 안에서 먼저 해결한다.

상태를 구분한다: **소스 완료 / 필요한 검사 완료 / 실제 화면·파일 완료 / 제품 완료**.
이 네 상태를 합쳐 쓰지 않는다. 기존 유효한 PASS는 반복하지 않는다.
현재 제품 코드의 한정 완료 기준은 CG1 `7a62d6df`, G15 `28a62d2e`, Studio UI5 `ca10a3a8`, CG2 `4bff492c`이다. CG2 제품 build/docs는 통과했고 실제 UI·파일은 공통433에서 확인했다.
제품의 문서 commit은 새 기능 실행 결과가 아니다. 전체 로봇·전체 G15 품질·제조는 미완료다.

### 현재 마감할 항목

| 번호 | 작업·기존 ID | 현재 상태와 다음 행동 | 담당 | 완료 조건 |
|---|---|---|---|---|
| 01 | 독립 공차 프레임 — CG5 DR-6 | 기반·교정 검사와 실제 Add/편집/숨김/Move·Save/New/Open/SVG·삭제를 마쳤다. 전용 상태행의 안내/표제란 비중첩·실입력도87327에서 PASS·전반환했다. 기존 reader가 standalone을 버리는 문제를 확인했다. 최신 reader/writer의 필드 보존과 raw 입력 검사를 완성해 제품에 연결한다. | Drawings → API | 같은 view/ID·view-mm 위치와 paper-mm 기호를 보존한다. 실제 Save/New/Open/SVG 뒤 정상 제품 통합. 원 5PASS/1FAIL과 교정 결과는 출처를 나눠 유지한다. |
| 02 | 도면 사용 문서 연결 | 독립 프레임과 기존 point datum target 설명을 현재 도면 문서에 작성하고 공통 소스에 채택했다. 최종 문서 배치와 제품 연결을 마감한다. 전체 GD&T 완료로 쓰지 않는다. | Docs + Drawings | 뷰·위치·모호한 선택·없는/숨긴 참조·저장/출력 경계를 설명하고 01의 실제 결과와 맞춘다. 04의 같은 최종 문서 배치로 닫는다. |
| 03 | 절삭 피처 선형 반복 — CG2 | 공통433에서 invalid 거부·적용·Undo/Redo·실제 Save/New/Open을 확인했다. 정확 16경로는 제품 `4bff492c`에 no-ff 통합했다. 제품 CAD build와 수정 후 docs는 `13e9c835`에서 통과했다. 최초 stale preview와 문서 거부 코드 차이 실패는 보존한다. 별도 제품 브라우저는 NOT_RUN이다. | Kernel/Model + Outer + API | 원 절삭 도구만 반복한다. 60×30×10에서 4×4 관통 컷3개의 표시 잔류17520mm³·외곽·참조를 보존한다. 전체 기하·릴리스 수락으로 확대하지 않는다. |
| 04 | 실제 API 문서·그림·탐색 구조 | 실제 Kernel API3사례·JPEG3와 메뉴/Studio6안내를 공통에 채택했다. 새 Model 기본 샘플/실제3결과·별도그림은 소유 후보f4→189다. 새8샘플/3producer는 PASS이나 전체164는159PASS/2FAIL/3CANCELLED다. spring은Kernel교정,CLI는별도환경확인으로 닫고 최종공개목록·docs/site·제품을 한 배치로 마감한다. | Docs + API | 기존 URL·앵커를 보존한다. 새 공개 목록을 의미 검토하고 최종 공통 SHA에서 check/site 한 배치와 필요한 desktop 페이지를 확인한다. 24-case gallery는 이3사례로 완료 처리하지 않는다. |
| 05 | Viewer 제품 마감과 다음 리뷰 전달 | 기존 SDK/React 앱·조립·named views·원본 점 검사·아이콘 UI는 공통 채택, 제품은 미채택이다. 소유 워크는 키보드·작은 화면·파일 실패 보존, 조립품 거리·리뷰 저장/복원을 완료했다고 보고했다. 새 정상 commit과 실제 파일·자원 반환을 확인 중이며 제품 완료로 합치지 않는다. 제한 IGES와 파일 닫기는 남은 범위를 구분한다. | Viewer + API/Docs | 기존 정상 묶음은 04와 제품에 연결한다. 새 PNG는 실제 좌표/DPR·일반/측정 이미지·오류 시 accepted 보존을 확인한 별도 정상 commit으로 닫는다. 중단된 packaging/config/hook은 재개하지 않는다. |
| 06 | GPU 소유 결과 인계와 다음 GPU 기능 | PT soft visibility `fe2637f4`, RenderTarget `607f7d0`, sized target `8de2f6ac`는 소유 새필수배치·공개PNG·정리를 마쳤다. sized target은 실제 Chrome DPR2 에뮬레이션도 별도 확인했다. GLB subset은 교정 `5d8b7757`에서 emit294/CPU18/lint3·합성 WebGPU 공개 사례를 마치고 전반환했다. target.asTexture `2a35e9b6`는 소유 emit·새 WebGPU 회귀·lint5·합성 공개 예제와 자원 반환을 마쳤다. 초기 sandbox 실패는 보존한다. GLB 내장 텍스처는 `29fd0191`의 첫 emit 실패를 보존하고 교정 `d4e2c3ec`에서 새 검사와 합성 PNG/JPEG 공개 예제를 통과했다. 일반 glTF나 제품 통합 수락은 아니다. | GPU; 병합은 사용자가 지정한 다른 위치 | 최신 직접 지시대로 정상 commit·원 실패·PNG·한계를 인계한다. 이 root 제품에 자동 병합하지 않는다. 후보 소스 완료를 실행/품질 완료로 쓰지 않는다. 다음 항목은 승인된 GPU 소유 로드맵과 정확 범위로 이어간다. |

03은 공통 실제 화면·파일과 제품 build/docs를 마쳤다. 독립 도면의 최신 reader/writer 저장 보호를 다음 기능으로 연결한다. 02·04·기존05는 최종 공통 공개 목록·문서·제품 배치로 닫는다. 완료한 흐름은 반복하지 않는다.
05의 독립 소유 구현과06의 승인된 소유 작업은 병렬로 진행할 수 있다. native/build/generator heavy 실행은 한 창만 쓴다.
01의 소스 핀을 사용할 때 공통 소스를 바꾸지 않는다. 번호화 문서 반영은 안전 checkpoint의 문서 전용 창으로 조정한다.

### 남은 기능 묶음

아래 항목은 기존 로드맵의 범위 색인이다. 실제 다음 한 기능은 선행 조건과 기존 승인 범위를 확인해 배정한다.
이미 존재하는 기능은 다시 만들지 않는다. 기존의 한정 지원을 유지하면서 실제 공백만 확장한다.

| 번호 | 작업·기존 ID | 남은 범위 | 담당·선행 조건 | 완료 조건 |
|---|---|---|---|---|
| 07 | 고급 모델링 — CG1 | 일반 가이드/다중 단면 로프트, 경계 표면, 가변/면 필렛, 드래프트, 리브, 문자·엠보싱·wrap, 나선/실제 나사의 남은 지원 범위. | Kernel → Model/API → Outer. K02 다중 단면 로프트 `0d2e1abc`, K03 Bezier Coons `51a59aaa`, K04 필렛 `65f1a678`, K05 드래프트 `b5b425c9`, K06 리브 `9c22d37f`, K07 제한 직사각 양각/음각 `01bd6b35`는 정상 소스 완료·실행 NOTRUN이다. 공유 실행/통합은03 마감 뒤 정확 한 기능부터. | 지원 프로필·원공차·참조·독립 기대를 고정하고 편집·파일·제품까지 연결. 이미 완료된 bounded loft를 재구현하지 않는다. |
| 08 | 피처 패턴·직접 편집·표면 — CG2 | 곡선/채우기 패턴, 면 이동·삭제·교체, thicken/offset/knit/trim/extend의 남은 범위. | Kernel/Model + Outer. 03과 기존 affine/Boolean/표면 provider 재사용. | body 복사와 feature 반복을 구분하고 원 이력·소실/모호 참조·실패 atomicity를 보존한다. |
| 09 | 고급 스케치 — CG3 | spline 핸들·conic·문자·block과 진단/편집의 미완료 소비 경로. 치수 표현식은 기존 결정 조건을 유지한다. | Kernel/Model + Outer. 기본2D→3D·돌출 컷의 기존 완료 근거 재사용. | 실제 제약·DOF/충돌/비수렴을 구분한다. 원 입력·치수·좌표와 편집 후 파일 결과를 보존한다. |
| 10 | 조립 확장 — CG4 | 유연한 하위 조립, 반복 occurrence 참조, 조립 피처, 승인된 motion/대형 조립 범위. | Model/Outer + Kernel/GPU. 같은 revision의 배치/관절 기반이 선행. | 계층·part-local/world/display 변환과 반복 인스턴스를 보존한다. pose 표시를 동역학 완료로 쓰지 않는다. |
| 11 | 도면 확장 — CG5 DR-6/7/8 | 남은 GD&T/복합 프레임, ISO/ASME 스타일·인치 표시, 도면 세트. | Drawings. 01과 필요한 geometry/reference 기반이 선행. | 실제 sheet/SVG·파일·정상 제품을 닫는다. 한 프레임·기호 시험을 전체 규격 적합성이나 제조 수락으로 올리지 않는다. |
| 12 | 파일·버전·협업 — CG6 | 기존 저장·분기·merge·linked part의 기능별 파일 흐름을 완성하고, 공유·댓글·동시 편집은 서버/계정/호스팅 결정 뒤에 진행한다. | Model/API + Outer; 필요한 인프라 소유·승인이 선행. | 실제 디스크/프로젝트 파일·revision·충돌/실패 복구를 확인한다. 기존 버전 기능을 새 구현으로 다시 배정하지 않는다. |
| 13 | 교환과 손실 표시 — CG7 | STEP AP242 조립/PMI, glTF/USDZ 등 형식별 지원 프로필과 독립 읽기. Parasolid 읽기는 기존 사용자 결정 조건을 유지한다. | Kernel/API + 기존 교환 소유자. | 형상만 저장한 결과와 계층/반복 배치/PMI/이력 보존을 구분한다. 단위·scale·손실을 명시한다. 자체 writer/reader 일치만으로 독립 수락하지 않는다. |
| 14 | 생산 기능 — CG8 | 생산 CAM/postprocessor·판금 DXF nesting은 현재 미리보기와 별개인 후속 계획이다. | 기존 Kernel/Model/제조 소유자; 별도 범위·입력·승인 조건. | NOT FOR PRODUCTION을 완료로 바꾸지 않는다. P2·PG11 조건을 이 번호로 해제하지 않는다. 새 구현 자동 착수 없음. |
| 15 | 제품 사용성 — CG9 | 표시 단위, 한국어 UI, 접근성, 안내·desktop 구성의 남은 범위. | Outer/Viewer + 각 기반 소유자; 현재 기능 완료 뒤 좁은 소비 공백부터. | 긴 상시 설명을 줄이고 아이콘·짧은 툴팁·현재 값으로 기능을 구분한다. 단위·오류·필수 경고는 유지한다. 중단된 package/hook 작업을 우회하지 않는다. |
| 16 | 정확도·강건성·API/참조 — CG10, R7, #2210/#2215 | 재현 가능한 잘못된 성공/손실, sketch 출력·revolve admission, SSI/pcurve·근사 오차·이름/참조 진화의 남은 범위. | Kernel/API/Model/GPU의 실제 producer·consumer 소유자. 결함은 해당 기능에서 우선 처리. | 원공차·입력·오차/지원 경계를 고정한다. 단위 변환은 한 경계에서만 한다. 기존 언어/DSL·GUI·공개 API가 같은 typed core를 소비한다. 새 DSL/solver 설치나 중단 K9 재개 승인이 아니다. |
| 17 | 경로 묶음·가상 클립 — PB0–PB4 | 현재 두 경로/한 클립의 한정 구현과 파일/원자성 근거를 유지한다. 다중 클립·분기·굽힘/간격·길이의 공학 조건은 후속 범위다. | Model/API + GPU + Outer; 기존 stable handle·revision 계약 재사용. | 연관 sweep을 같은 후보로 재생성해 전부 성공할 때만 채택한다. Cancel·stale·한 멤버 실패 시 기존 전체 결과 보존. 자동 충돌 회피/케이블 동역학으로 확대하지 않는다. |
| 18 | 관절·로봇 — J1/J2, R1/D1/R2, RS6/RS7/P4 | 같은2R 입력/리비전 연결 → 관절·한계/폐루프 → 제한 자유 진자 → 다링크·접촉·제어 → 독립 교환·제품. 기존6단계 계획을 따른다. | Kernel/Model/API/Outer/GPU; 자유동역학은 기존 Physics 소유·지원 프로필 확인이 선행. | 기구학·지정 재생·정적 토크·자유 동역학을 구분한다. 같은 질량/관성·프레임·단위·참조와 실제 파일을 사용한다. paused Physics/Motion 자동 재개 없음. |
| 19 | 가상 실험·다물리·실측 — Stage0–6 | 기반 → 공통 실험 계약 → 제한 진자 → 기계/로봇/접촉/제어 → 구조·열 → 유체·전기 → 실측 피드백의 기존7단계. | 각 기존 기반/해석/실측 소유자. 미래 단계의 소유·입력·지원·승인을 먼저 정한다. | 입력/선언값/계산값/실측을 구분하고 독립 기대·보존/수렴·오차·파일로 확인한다. 현재 정적 결과·화면을 일반 solver 검증으로 올리지 않는다. 새 엔진/의존성·중단 작업 자동 착수 없음. |
| 20 | 기즈모·핸들 드래그 UI/UX·렌더링 (2026-10-27 사용자 관찰) | ① 치수 화살표(w·h 등)를 끄는 동안 뒤 기능(구멍)이 사라졌다가 멈추면 돌아온다: 드래그 중 미리보기를 끌린 기능까지만 계산하는 `rolled` 경로 때문. 제안: 전체 미리보기 시간을 재서 느릴 때(예: 120 ms 초과)만 줄인다. ② 필렛 화살표를 끄는 중 값이 다른 숫자로 튄다: 실패 값을 마지막 성공 값으로 되돌리는 wall/lastOk가 늦게 도착한 이전 프레임 결과로 갱신되는 것으로 의심, 재현·확정 필요. ③ 구멍·기즈모 드래그가 끊긴다: 매 프레임 Kernel 미리보기를 기다려야 화면이 바뀐다. 먼저 드래그 중 미리보기 1회 시간과 화면 갱신 간격을 측정하고, 즉시 화면 변환과 Kernel 결과 반영을 분리한다. ④ 화살표 드래그 결과는 Apply 전까지 미리보기일 뿐이라는 점이 화면에서 잘 드러나지 않고, 매번 Apply를 눌러야 해서 불편하다(사용자, 같은 날). 함께 검토할 안: 화살표·기즈모를 놓으면 바로 적용(한 번의 Undo로 되돌림), Enter로 적용·Esc로 취소, 다른 곳을 누르면 적용, 값 입력 명령만 Apply 유지. 명령마다 어느 방식이 맞는지 정하고 실제 Studio에서 확인한다. ⑤ (해결) 복구 Restore가 진행 중 명령·미리보기를 남겨 옛 몸체가 보이고 기즈모가 새 몸체 위치에 뜨던 문제는 `7174b010f`에서 고쳤다. | Outer/Studio + GPU(렌더 성능). 기존 handle·gizmo·preview 경로 재사용. | 실제 Studio에서 각 현상을 재현한 원 증거를 남기고, 수정 후 같은 조작으로 확인한다. 측정값(미리보기 ms, 프레임 간격)을 기록하고 체감 개선을 수치로 남긴다. 새 엔진·solver 없음. |
| 21 | Studio 도구 사이드바 배치 (2026-10-27 사용자 요청) | 왼쪽 도구 막대가 약 76개 명령(생성 42·수정 24·패턴 5·검사 4·결합 등)을 세로 한 줄로 늘어놓아 스크롤해야 찾는다. 권장안: 카테고리별 구분 라벨이 있는 2~3열 아이콘 격자로 넓혀 보통 화면 높이에서 스크롤 없이 보이게 한다. 대안: 카테고리 아이콘 + 펼침 패널, 상단 리본. 함께: 하단 History 막대가 아이콘만 있는 40px 띠이고 명령·스케치 중에는 숨겨져 "없어진 것처럼" 보인다(사용자 관찰). 이름 기본 표시, 편집 중에도 흐리게 유지 등을 검토한다. 20번과 함께 UI 묶음으로 처리한다. | Outer/Studio. 기존 TOOL_GROUPS·명령 정의 재사용, 새 UI 라이브러리 없음. | 보통 화면(예: 1440×900)에서 모든 카테고리가 스크롤 없이 보이고, 뷰포트 폭 감소와 단축키·툴팁 동작을 실제 Studio에서 확인한다. |

사용자 정정: 아직 릴리스가 없으므로 최신 reader/writer만 기준으로 삼는다. 구 미출시 바이너리 호환과 장기 migration을 위해 schema5를 강제하지 않는다. 현재 일반 schema3과 route schema4를 유지하고 standalone/composite의 raw 입력 검사와 필드 보존을 구현한다. 실제 사용자 파일과 snapshot key/id/parent/bytes는 보존한다. 기존 Model448→3b8 및 Drawing 후보 정상 commit은 이력으로 남기고 필요한 정확 delta만 새 계약에 맞춰 연결한다. Outer 저장·복구, 합동 실행·파일 흐름·제품은 아직 미완료다.

공통16의 공개 API 방향은 [설계 기록](api-public-model-direction-20261027.md)에 있다. CAD Model을 사용자 편집 원본과 기본 Part/Assembly 진입점으로 삼고 커널은 독립 계산 계층으로 유지한다. 메서드별 계약/파일/API 호환 이행과 물리적 패키지 통합은 아직 완료·확정되지 않았다. 명칭 변경만으로 이 과제를 닫지 않는다.

### 제품 완료와 인계의 공통 조건

1. 기능의 입력·단위·좌표·참조·지원/거부 계약을 고정한다.
2. 기존 기반을 재사용해 같은 기능의 전체 소스를 정상 commit한다.
3. 필요한 영향 검사와 실제 소비/파일 흐름을 한 배치로 닫는다. 원 FAIL과 NOTRUN은 보존한다.
4. 검토된 정확 delta만 제품에 통합하고 필수 제품 검사와 제한을 기록한다. 명시적 소유 인계 예외인06은 다른 통합 위치로 전달한다.
5. 실제 Codex core 남음이5% 이하면 기존 조건부 중단·정상 인계 commit·허용된 feature branch push·원격 SHA 확인·cad PAUSED를 수행한다. reset/credits 소비나 force/main/develop rewrite는 하지 않는다.

사용자 지시로 P2 제조인수는 활성 추적과 정기 보고에서 제외한다. 과거 HOLD·미수락·FAIL은 이력으로 보존하며 PASS로 바꾸지 않는다. PG11 입력과 PG12의 한정 positive도 새 기능 완료가 아니다.
optional G15d.4, 측정 후 보류한 LOD와 기존 BVH는 새 개발로 자동 배정하지 않는다.
공유/댓글 인프라, 새 solver·runtime dependency, Physics/Motion 및 packaging/config/hook의 기존 중단은 유지한다.
상세·옛 실행 기록은 아래에 보존한다. 이 색인과 단일 작업 기록의 최신 상태가 옛 진행형 문구보다 우선한다.


Current as of 2026-10-27, after the scoped CAD integration checkpoints. This file is the one place for **what we do, in what order, and
when each item is done**. It replaces Codex's continuation roadmap of 2026-10-22/23, which is at `0eabecf7f` and on
`codex/cad-coordinator-handover-20261022`.

Details and contracts live in the decision logs: `decisions.md` (kernel, D), `decisions-outer.md` (outer, O),
`decisions-gpu.md` (GPU, G). Each lane's README §0 block says where that lane stands. How the work is run (lanes,
coordinator, verification tiers) is in `notes/claude-resume-2026-10-23/`.

**The goal (owner, updated 2026-10-25):** Design objects and test selected real-world or virtual-world behaviour in one project. Define materials, joints, forces, environment and controls, predict bounded outcomes, and compare designs with controlled measurements where applicable. Extend support through explicit experiment profiles.

The manufacturing objective is retained as a delivery track: AI takes a brief to a manufacturable, buyable product.
A9 remains its first end-to-end run. This wider goal does not close A9, P2, actual fastening/material/stock decisions,
manufacturing HOLD items or any recorded FAIL, interrupted run or uncompleted qualification.

This top-level scope update supersedes earlier goal and CAE exclusion statements only. The lane queues and
historical checkpoints below remain records; this patch does not adopt candidate source, change a past result,
authorize a new runtime window, or automatically start a gallery, browser or manufacturing acceptance run.

## Foundation before Studio (owner order, 2026-10-26)

Implement and verify the basic functions in Kernel, GPU, CAD and CAD Model before completing their Studio workflow.
These foundation lanes can work in parallel when their files and resources do not conflict. This is a gate for each
feature, not a requirement to finish every future engine feature before any Studio work.

| Gate | Required result | Owner and completion evidence |
|---|---|---|
| 1. Foundation contract | State supported inputs, units, coordinate frames, stable references and explicit failure results. Reuse existing functions before adding another implementation. | Kernel, GPU, CAD and CAD Model owners agree on the producer/consumer boundary and exact owned files. |
| 2. Basic implementation | Implement the admitted operation and preserve accepted data on invalid input, stale results or partial failure. | The owning engine or Model has focused tests with independent numeric or identity references where applicable; preserve the first failure and original tolerances. |
| 3. Cross-layer verification | Verify the actual producer output at its consumer, including parameter changes, serialization and reference loss. | Confirm the bound source and required build/type checks. A screenshot, mock or same writer/reader agreement cannot replace the missing engine contract. |
| 4. Studio completion | Connect the verified operation to public controls, feedback and document transactions. | The Studio owner runs the required actual browser flow, Undo/Redo and file roundtrip, checks console and views the captured PNGs. |
| 5. Integration | Adopt the reviewed commits and run the required affected product checks. | The coordinator records exact source and product commits, remaining limits and the next ready task. |

The delivery unit is one complete feature: its foundation contract, full source implementation, required checks,
actual consumer workflow and product integration. Source commits, a RED reproduction and a single passing test
are intermediate checkpoints. Finish independent source pieces in parallel, then run the required affected checks
as one planned verification batch. Carry relevant results forward; repeat a check only for a changed input, new
failure or remaining risk. Keep first failures and required engine/browser/file evidence. Do not switch to another
feature merely because one test passed, or skip checks to call a feature complete.

Owner correction: concentrate resources on roadmap implementation. Do not turn verification preparation,
repeated audits or new diagnostic tests into separate work streams. Preserve necessary checks and first
failures, reuse unchanged passing results, and finish the feature source before its one affected batch.

Current order (2026-10-27): finish complete features, then integrate their reviewed normal commits.
Local product `ca10a3a8` includes the completed bounded CG1 copied-guide workflow, the
G15 light-field/Studio/file-flow slice at `28a62d2e`, and the Studio guidance reduction at
`1c80f8c1`. Their required product checks passed. Metadata `75123a0a` retains the portable
handoff and actual G15 BCAD/PNG evidence; it is not a new execution result. Existing CAD build,
selected cubic-circle and earlier GPU receipts retain their own scope. Whole G15 quality,
robot, free-forward dynamics and manufacturing acceptance remain open.

The current cut completes the copied-guide loft in CAD Model and Studio. Model source
`1cc2cb5` / `dd48fb9` / `fb03045` and Studio `fe1afa05` were adopted as exact child deltas.
The original native11 PASS and Model type4 FAIL remain recorded. The normal two-file repair
passed command7, Model/Studio types and production9 lint. A collector used the wrong cwd when
reading saved lint paths; its original failure remains, and only the never-run public builder
continued. The builder passed without repeating the other checks.

The first actual Studio flow found only None in the Guide list after a direct-only import.
App-only repair `f476d132` was adopted as `49420da6`; it snapshots current shown direct data
at Loft start without changing the geometry memo policy. Corrected Studio types/App1 lint
passed once. Actual desktop D0 Open, original guide import, Guide (copied), Preview/Apply,
Undo/Redo and real Save/New/Open then passed. Before/preview/undo files match in all1216 bytes;
applied/redo/reopened files match in all3127 bytes. Original sketches and direct objects stay
unchanged. Frames and cubic controls are copied world-mm snapshots, not live curve references.
Root viewed both final PNGs. Original product and tool failures remain preserved; native
quantitative accuracy and manufacturing acceptance are separate.

The external inventory at `4800600ee` adds6, removes0 and changes5 exposures: the two public
loft input types, copied-guide helpers, framed sections, the stored LoftSection, three StudioPart
loft method exposures and ModelNode/isSolidNode guide types. Existing6654 rows and the other
five top-level fields stay identical. Existing compiler-symbol names and numeric pairs do not
change. Only these reviewed rows were synchronized. Documentation/site at `3751a3ac` and
required product documentation at `7a62d6df` passed; the scoped CG1 delivery is integrated.

Kernel owns Model API implementation; the coordinator owns API design, contract resolution
and integration. G15 Studio shadow consumption uses qualified GPU point PCSS `33a0fa9`,
Model fields/one shared validator `009b92c`, and normal Studio `8453010` plus `498c36f`.
Root source `2e1d4c04` passed Model5, Studio4, both types and production3 lint. The first
Studio type failure remains recorded; test-only child `8c0498c` corrected its array narrowing,
and only the failed type check and never-run lint continued. Actual desktop independent SUN
selection, point/spot radius, rejected drafts and second caster, Undo/Redo, real Save/Open
and public PNG export completed. The 13 saved BCAD files and exported PNG preserve accepted values and non-render
document data. Reopened JSON is equal; its bytes differ only in the `render.camera` key order.
Root viewed four actual PNGs. Whole shadow quality, performance and G15-accept remain open.

CAD1mm equals GPUworld1. Point/spot shadow radius passes unchanged; only existing intensity
uses size squared times .05. False, zero, omission and current caster budgets are preserved.
Normal usage-doc child `1e7a9fb` was adopted at `c91c35de`. Its first external inventory adds
one shared validator and changes four light-type exposures; the other6661 exposures, five
other top fields and all367 raw compiler-symbol pairs stay identical. Only the five reviewed
rows are synchronized. The first common docs/site batch and two actual documentation pages
passed. Product `28a62d2e` emitted288 GPU files (144 JavaScript and144 declarations), retained
240 older files separately, and passed its first required docs check. One actual product scene
using the original reopened BCAD was captured; root viewed both native PNGs, and11 observed
served source modules matched Git/disk. Errors and warnings were zero. The scoped slice is
complete; it does not establish PCSS causality, general shadow quality or performance.
Do not repeat the already valid Model/Studio/GPU or full browser checks.

Studio guidance reduction is complete in product `ca10a3a8`: remove the persistent sketch
hint bar and repeated help, keep tool names, units, errors and Apply/Cancel. The first affected
Studio type/lint5 batch and one basic desktop Model/Sketch/HUD/Render flow passed; root viewed
three actual PNGs. Product docs passed once. No geometry Apply, Save, export or G15 regression
was repeated. Viewer icon-toolbar cleanup and native-point inspection have actual owner flows
and root document/assembly PNG review; their source is adopted separately, product still pending.

GPU's next active source work is `GPU-G15BC-PT-SOFT-SHADOW-01`: connect existing point/spot
radius to the path tracer's bounded visibility filter. Preserve16-float light storage, R0 RNG,
centre BRDF/falloff/cone and existing occlusion. This is not a full area-radiance integral.
Native execution is not started. Optional G15d.4, LOD/BVH holds and existing budgets remain.

The next independent Kernel implementation is CG2 linear cut-feature repetition. The public
`linearFeaturePattern(options)` repeats the difference that directly produced the current
solid, using the existing axis/count/mm parameter conventions and affine/Boolean operations.
It does not copy the whole body or discard later features. Existing body patterns remain.
The fixed reference is a60x30x10 box with three separate4x4 through cuts:17520mm3 remains,
with unchanged outer bounds. Core `05d4315`, actual Model consumer `50397c0` and Studio History icon `9ee0fd2` are source-complete and statically reviewed. Runtime remains NOTRUN.
The temporary Model facade guard is removed only in the completed normal50397c0 candidate. The current common/product cut does not yet contain these candidates.
Adopt the whole exact source before one combined affected batch; do not treat source completion as runtime support.
The real Model node/evaluate/save source contract is complete. Studio source consumes its existing generic command/HUD/editor and adds only the missing History icon.
Unsupported current cuts retain their refusal behavior until the qualified feature is adopted. Actual Studio/file execution follows the pinned common source.

Viewer's ten normal deltas through `df7d7fdd` are adopted in the aggregate; the app tree is
exactly the owner's tested source. Only the stopped provider-build README section stays omitted.
First common public-surface documentation and product adoption remain. No packaging/config/hook
work is resumed. Standalone drawing frames `d68d6e49` plus `ac53b888` are adopted at `b4261d23`,
with the root dimension-clearance fix preserved. Its first native batch reached5 PASS/1 FAIL:
a consumer fixture's exact radius/axis search found no circle. The starter defines the hole;
its absence or a numerical cause is not established. The owner repairs only the same-hole/view
fixture lookup. Later types/lint are NOTRUN; original assertions and product tolerances stay.

Docs normal `2eff93c5` retains3 actual API mesh/mass cases and3 native JPEGs; the original
input-metadata guard failure is preserved and corrected in `e27b4682`. Keep35 existing URLs
and anchors while the owner finishes the approved sidebar hierarchy/H2-H3 outline. Adopt the
final normal docs delta, review the new Viewer/Drawing public inventory, then run one common
check/site batch and necessary desktop page flow. No geometry recalculation or mobile run.

Reuse existing basic functions. Wider datum targets, auto-rematching, arbitrary assemblies,
new renderers/solvers and manufacturing certification are not implied. Keep independent source
work parallel, serialize the shared heavy execution lane and preserve paused/HOLD scopes.

## Joint and robot completion plan (owner update, 2026-10-27)

Direct owner instruction: add the remaining joint and robot work to this roadmap and continue it.
Use the existing O24, RS1–RS7, R1 and experiment tracks below. This section orders their remaining
work and completion gates; it does not create a second task queue. The coordinator records exact
owners, files and ready dependencies in the existing task record. Do not ask the owner to assign
each routine step. Continue current valid work while independent source pieces proceed in parallel.

**Current boundary:** basic joints, robot samples, prescribed pose/playback, bounded serial support,
mass/inertia and selected static-gravity checks exist. Universal and Cylindrical have bounded support;
do not describe them as wholly absent or as general robot/loop support. The Model two-link static
regression passed its selected eight declarations, including the three-pose comparison. It does not
establish forward free motion, contact, friction, motor control or complete robot acceptance.
The SSI source and its scoped product checks are complete at product `4c474e8b`; they do not close
these joint and robot gates. Reuse existing receipts and preserve their source/input boundaries.

| Order and existing track | Owning boundary | Remaining implementation and completion gate |
|---|---|---|
| 1. CAD → Model → GPU joint consumer | API/Outer coordinate the existing joint/robot document; Kernel supplies geometry/mass; GPU supplies display/pick | Reuse one existing bounded two-link case and its independent poses. Bind design revision, body/occurrence, joint frames, material density, COM, inertia and units. After a dimension or pose edit, compare Model transforms and GPU display/selection with the same evaluated output. Check invalid/stale updates preserve accepted data, then public Undo/Redo and actual Save/Open. Reuse the existing mm/g/degree and static-torque references; do not silently mix authored density2.5 with the Model material2.7 case. A rendered pose alone does not close this gate. |
| 2. O24 joint kinds, limits and relations | Outer/API producers with Kernel/GPU consumers only where needed | Close a concrete missing supported case in Cylindrical, Universal or O24(e), using current source and receipts before choosing it. State each DoF, axis, frame, angular/linear limit, driver/follower and supported export. Check gear/rack/screw ratio and sign, instance identity, deleted references and typed unsupported results. Keep existing Lock/Auto behavior and PG-4 in the same track. Do not add a duplicate joint implementation or replace a refusal with a guessed pose. |
| 3. RS6 closure and RS7 mechanism | Outer closure core; API/GPU shared consumers; Kernel existing blade features | Complete the admitted loop and coupled-input profile. Preserve the chosen branch through a full turn, reverse motion and extrema. Check independent closure residuals, unreachable/singular/over-limit inputs and collision handling within the declared path-checker scope. Every consumer uses the same solved pose. Then complete RS7 Save/Open, playback/scrub, stable repeated occurrences, Drawing/BOM/export and the required renderer checks. Do not pose each blade independently to hide an open loop. |
| 4. First free rigid-body experiment | Existing Physics owner after ownership and supported-profile confirmation; Kernel/API provide mass/frame contracts | Start with the existing planned D1: fixed support, one revolute axis, known rigid body, explicit initial angle, gravity and zero friction. Keep COM tensor separate from inertia about the pivot. Convert MMGS to solver units once. Compare with `Ip·θ̈ = −m·g·l·sinθ` and, only for small angles, `T = 2π√(Ip/(m·g·l))`. Freeze error limits before execution; check period, energy, joint/constraint error, reactions and time-step convergence. This is new forward-motion evidence, separate from static holding torque. |
| 5. Multi-link dynamics, contact and control | Existing Physics/robot owners after the admitted single-body profile | Extend one bounded two-link profile before broader mechanisms. Check independent equations, energy, gravity sign and constraint reactions. Then admit contact/friction/impact, actuator torque and speed limits, control period, saturation and tracking error as separate profiles. Report unsupported combinations explicitly. Physical accuracy needs separate sourced inputs and controlled measurements; animation and inverse-dynamics torque do not establish it. |
| 6. P4 robot delivery and independent exchange | API/Outer with GPU, Drawings and Docs | Use the same design revision for geometry, joint tree, inertials, collision approximation, displayed pose, motion, BOM and exports. Read the supported export independently and compare scale, frames, limits, inertials and asset identity. Complete public edit/save/reopen/run/cancel and stale-result handling. Keep measured validation and manufacturing acceptance as their own gates. |

For every row, keep four states visible: source implemented, independent numerical/reference checks,
actual consumer/file flow, and product adoption with its required checks. Record the remaining unsupported
range next to the result. Source review of Float32 conversion, display-edge grouping, preview cancellation
or failure recovery identifies a check to resolve; it is not by itself a confirmed defect.

Start with the next ready dependency in orders1–3. The first execution step is to bind the existing
two-link document and available oracle/receipts across CAD, Model and GPU, then implement only an
observed contract gap in the owning module. Source work comes before its one necessary affected batch.
Do not repeat unchanged PASS cases or turn preparation into another work stream. Orders4–5 require
the existing Physics ownership/profile gate; this update does not resume paused Physics/Motion,
install a solver/dependency, authorize hardware control or clear P2/PG11 manufacturing holds.


## Goal and staged expansion (2026-10-25)

The long-term goal is one project in which users design an object, define an experiment, predict its behaviour,
and compare the result with other designs or controlled measurements. Design, selection, experiment setup and
result review stay connected in the same document and Canvas workflow. Experiment definitions and large result
files belong to the project and refer to a design revision; they need not all be embedded in the CAD document.

An experiment profile must distinguish real-world physical models from intentional virtual-world rules. A virtual
effect is not evidence of physical accuracy. Each supported experiment has a bounded purpose, inputs and operating
range. This roadmap does not claim that new solvers are implemented or authorize immediate solver dependencies.

The existing goal of a manufacturable, buyable product remains a delivery track within this wider goal. Keep A9,
P2, manufacturing checks and the recorded engineering input decisions. Their completion does not establish the
accuracy of a dynamics, structural, thermal or fluid prediction.

The shared foundation binds the project, stable design targets and assembly occurrences to a source revision,
units and coordinate frames. CAD-to-solver boundaries must state conversions, mass and inertia reference frames,
and approximation losses. Keep display geometry, collision proxies and mass models distinct. A changed source
revision must make the validity of previous results clear.

| Stage | User outcome | Required predecessor or contract | Exit condition |
|---|---|---|---|
| 0. Stabilize the current foundation | Save exact designs and reproduce existing supported behaviour | Complete the current API and Kernel corrections and their assigned impact checks; preserve original failures | Assigned impact checks and integration are complete; original failures remain visible. This is foundation evidence, not physical accuracy. |
| 1. Establish shared experiments | Save targets, materials, mass, joints, loads, environment and requested outputs; rerun and compare | Stable target/occurrence IDs, revision, units, coordinates and explicit missing-input or unsupported-condition results | Missing and unsupported inputs are explicit; saved experiments rerun and compare against the bound design revision, with stale results identified. |
| 2. Complete the first rigid-body experiment | Predict a physical pendulum's period, angle and static holding torque | Stage 1 and an explicitly supported pendulum profile: pivot and centre-of-mass placement, inertia about the pivot, gravity moments and constraint reactions; confirm Physics ownership before assigning implementation | Verify forward free motion from initial conditions separately from inverse-dynamics torque. Check independent period and torque references, time-step convergence, energy and joint errors; use separate measurements to establish the physical range. |
| 3. Extend to mechanisms and robots | Predict linkage motion, loads, motor needs and supported contacts | Stage 2 plus explicit joint, loop and contact contracts; distinguish kinematics, dynamics and control | Check kinematics, dynamics and control separately; calibrate friction, contact, actuator saturation and sensor delay within the admitted range. |
| 4. Add structural and thermal experiments | Predict deflection, stress, vibration, temperature and thermal expansion | Sourced material properties, loads, restraints and thermal boundary conditions; start with small reference problems | Start with reference cases such as a cantilever and one cooling solid; check mesh/time convergence and compare with measurements before expansion. |
| 5. Add fluids, electrical and coupled experiments | Predict flow loads, motor current and heating, and interactions with deformation or control | Individually checked field solvers, compatible input/output units and time synchronization before coupling | Check each solver and then coupled conservation, exchange-period error and stability. Visual effects are not engineering flow or temperature predictions. |
| 6. Connect measurements and design exploration | Compare sensor and simulated results, explore parameters and judge alternative designs | Recorded run provenance, measurement contracts and known validity ranges; separate calibration from validation data | Keep calibration and validation data separate, report uncertainty and compare alternatives within known ranges; no digital-twin claim without real inputs. |

After the shared foundation, independent field work can proceed in parallel. Coupled experiments require both
the individual models and their coupling to be checked. Preserve the existing historical entries below; use this
sequence to place future work without treating source implementation as physical validation or product acceptance.

### First implementation boundary

First bind experiment targets, assembly occurrences and design revisions to sourced material, mass, full inertia,
loads, constraints and requested outputs. Admit only a supported solver profile and report missing inputs or
unsupported geometry and joints. Do not fill absent density or inertia with invented values. Convert CAD mm/g/degrees
to solver units at one declared boundary, recording inertia axes, reference points and approximation losses.

The new common experiment workflow and additional solver support are planned work, not implemented capabilities.
Existing Physics sources have bounded admission conditions; they do not establish a general CAD assembly solver.
Confirm Physics ownership and the actual hinge/gravity/inertia path before implementing the first pendulum.
The supported profile must consistently relate the pivot-to-centre-of-mass offset, inertia about the pivot,
gravity moment and constraint reactions. No new runtime dependency, WASM, public solver API or storage schema is
approved by this roadmap update alone.

Static source review has not established free-pendulum rotation for the fixed-support/dynamic-body hinge.
In the inspected path, angular velocity is updated through torque, impulse and motor inputs. Accepting gravity,
updating linear velocity and projecting joint-anchor positions and velocities do not by themselves establish
gravity-driven angular motion about the pivot. This inference is limited to the no-contact, zero-command case
with zero initial angular velocity; that case has not been executed or reproduced. It is a support question,
not a confirmed defect in an admitted profile.

Model's inverse-dynamics torque calculation for prescribed angles, velocities and accelerations is separate from
forward free-motion prediction from an initial angle. Neither that torque result nor a UI animation completes
the planned pendulum experiment. Physics ownership is still unconfirmed; this roadmap assigns no new solver work.

## Reliability priorities from research index 2214

Read [index 2214](https://github.com/barocss/barocss/issues/2214) and its CAD 2210, robotics 2211,
character-motion 2212 and GPU 2213 bodies as research inputs. Their remote `c3ae0d5d` baseline differs from
this local execution tree. Choose bounded current-source checks before claiming an old failure persists or
adopting a comparator. No new kernel, engine, runtime dependency, WASM, paused owner, hardware control or
manufacturing/FEA hold is activated by this roadmap update.

Finish the current setup documentation/site/product slice while independent owners close observed label and
camera problems. Then prioritize false-success and information-loss gates ahead of speculative acceleration.

| Priority | Owner and existing work | Next bounded result and gate |
|---|---|---|
| P0 CAD Boolean acceptance | Kernel after its R1 regression; reuse issue 2205 seed and existing robustness runner | Reproduce one exact current-source cylinder/box graze seed. Keep validate, finite mass, independent volume, tessellation and roundtrip outcomes separate. Preserve the original tolerance and input. A historical 1e-5 TODO is not the requested 1e-6 seed. Only a reproduced unsupported/invalid success leads to a minimal guard or geometry fix. OCCT remains an optional independent comparator, not a new kernel dependency. |
| P0 robot/export loss | API with existing joint tree/export owners; issues 2189, 2209 and 2211 | Preserve supported warnings and assumptions across shared export boundaries. The current source review found joint-tree notes omitted by robotParts; a bounded notes-preservation patch/test is selected. Treat unknown materials, omitted loops, unsupported couplings and hull proxies as separate loss cases; do not silently mark them dynamics-ready. |
| P0 GPU acceptance and stale results | Existing GPU owner after its current FOV/camera work; issue 2213 | Reconcile actual G20.2 evidence, then map pose/geometry/camera/clip/request/device generations at real async consumers. A stale result must not overwrite accepted selection or native data. Reuse existing CPU and BVH references. Do not replace missing broad acceptance with one leak or screenshot case. |
| P0 exchange meaning | API and current exchange owners; issues 539, 2203 and 2210 | Test one nested assembly with a repeated definition against explicit occurrence/placement expectations. Distinguish shape-only STEP from assembly/history preservation and report flattening or unsupported data. Independent read-back is a later selected target; own writer-reader agreement is not independent validation. |
| P1 edit references and sketch diagnostics | Existing CAD/Outer owners; issues 1657, 1658, 2193 and 2210 | Reuse stable feature/face/edge names. A changed/split/deleted reference resolves correctly or remains unresolved instead of editing another face. Keep DOF/conflict/redundancy, convergence and valid geometry distinct. Do not add a second naming system or assume a missing solver. |
| P2 online robot trajectory | Current robot consumer after joint/profile/loss gates; issue 2211 | Nonzero velocity/acceleration retargeting and synchronization are separate from existing rest-to-rest S-curves. Select local state-to-state only; reject cloud waypoint paths. Validate the generated path rather than reusing straight-sweep coverage outside its profile. Pinocchio/Coal/Ruckig/MuJoCo are comparison candidates pending scope, version and terms; do not port/install all of them. |
| Conditional character motion | Confirm existing consumer, provider and owner first; issue 2212 | Separate rigid part transforms from skin deformation and root-motion/clock authority. Select an asset/weight provider before a small playback/blending/foot-contact comparison. Preserve paused Motion/Rendering work. ozz, IK and DQS are candidates, not implementations or a fix for an unverified old bulge. |
| Hold: new BVH, LOD or speculative culling | Preserve existing G9/G14/G20-G25 decisions | BVH and instance reuse already exist. Keep measured LOD deferral; reopen only for a measured workload and fixed correctness/resource budgets. CPU submit, queue wall time, GPU timestamp, tracked bytes and driver memory are different measures. |

The existing test-only R1 slice at `9be20c5e` passed its three selected BRep/COM/static-moment and axis-inertia
assertions with authored density. It is not a Model 2R solver, forward dynamics or physical validation.
Keep engine proposals and benchmark targets as unexecuted candidates until their own source, ownership,
license, fixture, command and acceptance conditions are fixed. Record pass, fail, unsupported and not_run.

## CAD result acceptance: review 2215

[Review 2215](https://github.com/barocss/barocss/issues/2215) is a source audit of remote
`c3ae0d5`, not a new runtime result or an instruction to replace the kernel. Recheck each
finding against the current source. Keep the shared B-rep, rational/analytic geometry,
representation-specific Boolean paths, existing numerical solvers and bounded paired-surface
providers. Do not restart paused work or add an external dependency under this review.

The next reliability work is result acceptance first, intersection evidence next, then
approximation/error and public support contracts. The active task list remains the existing
coordinator record; this section defines scope and completion gates, not a second queue.

| Order | Scope and owner | Small completion gate |
| --- | --- | --- |
| P0 sketch output, API with Outer consumer | In `sketch/profile.ts`, preserve solver-approved domain coefficients; keep display rounding separate. Preserve the meaning of NONCONVERGENCE instead of reporting a proof of conflicting constraints. Reuse issues 1588/1590 and the existing solver. | Recompute residuals from the actual returned points/arcs after the public adapter, including an anchor beyond six decimal places and non-integer length/angle. Keep original tolerances, rank/DOF attribution and normal sketches. Test nonconvergence separately from conflict. Validate the affected Studio edit/save/reopen flow. |
| P0 revolve admission, Kernel | Replace only the fixed-sample signed-radius admission with line endpoint and directed-arc extrema checks. Keep endpoint poles, supported axial segments, current profile envelope and explicit refusals. | A tangent between old sample angles, contact on both sides of epsilon, arbitrary axis/origin, and normal endpoint/pole cases agree with a frozen analytic expectation. The direct mass API is a separate consumer; do not claim it is fixed by a shape-only gate. |
| P1 SSI and stitching, Kernel/API | Under issues 1657/535, keep termination, residual, unprocessed candidates and the 3D/dual-UV relationship through the operation boundary. Reuse the bounded providers from 1426/1499 where their profile applies. | Disjoint, transverse, small loop, near-tangent, narrow span, boundary and budget cases distinguish completed evidence from uncertain/unsupported results. A new `complete` label alone is not evidence. Preserve pcurve information or report the supported seam explicitly. |
| P1 approximation and error, Kernel | Preserve analytic sweep versus RMF faceted sweep. Make chord/tangent and integration-error evidence explicit; freeze a loft seam/correspondence when the supported input requires it. Reuse rolling-ball refinement/refusal. | One frozen high-risk profile meets its declared error and topology/reference criteria, or is explicitly refused. Watertight mesh, sampled strict checks and quadrature method names are not global accuracy certificates. Do not enlarge tolerances to hide a lost gap or feature. |
| P1 references, API/Outer/Drawings | Reuse issue 1658 generated/modified/deleted one-to-many evolution and existing ambiguous-reference refusal. | Edit, split, merge, symmetric candidate and deletion cases retain the intended reference or remain visibly unresolved, without editing a different face. |
| P1 API and exchange meaning, API/Docs | Describe the fluent subset, wider feature kernel and qualification provider separately. Preserve raw STEP number import versus unit-normalizing adapters, mixed-face approximation and assembly flattening/loss notices under 539/2210. | A frozen supported example and mm/metre/inch context retain physical size and stated representation. Shape-only interchange is not assembly/history preservation. No broad API deprecation or serialization migration follows automatically. |

The original source reads identified the sketch rounding/diagnostic seam and sampled revolve
admission. Their subsequent reproductions, corrections and bounded checks are recorded in **Order now**. The selected current Boolean
1e-6 grazing seed completed its six existing stages on source `123ff9`; that does not close
all historical 2205 cases or prove a general curved Boolean envelope.

Continue the current J2/Drawing verification and scoped integration; do not replace closure
with new candidates. R1 two-link verification may proceed independently: preserve the old
CAD density-2.5 fixture, and bind a new Model test to its actual declared al6061 density 2.7,
with fixed 0.864/0.432 g masses and independent holding-torque expectations. This is an
explicit comparison-condition conversion, not a new density API or a solver change.

### Delivery and cross-owner resolution

Each Work commits its permitted changes in its existing owned checkout/branch and returns
its task ID, base/commit SHA, exact paths, verification/NOT RUN and shared evidence. The
coordinator checks the exact parent-to-child delta and integrates the commit. Do not send
patches as the normal handoff or merge an unrelated branch ancestry. Preserve existing WIP,
protected branches, old receipts and paused/HOLD scopes; do not rewrite historical commits.

A unit/frame/contract mismatch needs an owner and a resolution path: check the producer and
consumer contracts, place an explicit conversion at one boundary, freeze an independent
example, verify it, then integrate. The coordinator mediates cross-owner choices. Do not
leave a fixable mismatch as a permanent note, invent missing units, apply the same conversion
twice, loosen tolerances or call an unknown result successful. A real external restriction
still needs its exact cause, unblock condition and a useful independent next task.

## Workflow completion cases from SolidCraft

Use [SolidCraft's roadmap](https://github.com/tangency-labs/solidcraft/blob/main/ROADMAP.md),
[0.23.0](https://github.com/tangency-labs/solidcraft/releases/tag/v0.23.0),
[0.22.1](https://github.com/tangency-labs/solidcraft/releases/tag/v0.22.1), its
[naming contract](https://github.com/tangency-labs/solidcraft/blob/main/docs/book/src/dev/naming.md)
and [configuration contract](https://github.com/tangency-labs/solidcraft/blob/e02ef3246f69b8a0c54cc3f3995b2d6950e5af7a/docs/configurations.md)
as comparison evidence. A release note, an in-progress milestone and our own executed
result are different evidence. Do not copy its old header date, agent-hour estimates,
completion labels, engine or implementation into our schedule or acceptance claim.

| Candidate or regression | Lead and existing scope | First delivery gate |
| --- | --- | --- |
| Export mesh quality, small feature candidate | API lead, Outer UI and existing Kernel export boundary | Pass a bounded export-quality setting from Studio through worker/Model to the existing `exportStl` `segmentsPerQuarter` option. Keep viewport quality independent and preserve current defaults. Export a small curved/hole fixture at two fixed qualities; inspect actual downloaded STL triangle count, physical mm size, winding/closure and the preset's stated error criterion/budget. A display-mesh fallback must stay visible as fallback and cannot claim the requested kernel quality. Preserve lump handling and the source-revision sidecar. |
| Separate drill and effective thread depth, small feature candidate | Outer lead with API/Hole and Drawings consumers | Audit existing cosmetic and modelled thread paths; extend the Studio Hole contract only where needed. Freeze separate depths in mm and their validation before code. A blind hole with a shorter effective thread retains drill geometry while callout/preview/export report the intended thread depth. Preserve legacy documents, invalid-input rollback and actual versus cosmetic-thread meaning. Do not invent a machining allowance or new thread engine. |
| Associative sketch edit chain | API/Outer; reuse issues 531, 1658 and 2215 | Project a face, offset its profile, extrude/cut, edit the source dimension, then split or delete the source face. Keep the intended target or ask for explicit repair; never silently attach to a nearby face. Include Undo/Redo and real Save/Open. |
| Atomic configuration row | API lead; reuse issues 533, 2047 and 2188 | Audit existing configurations/variability first. Select one row that changes dimensions, feature activation and material together. Success must bind model/BOM/drawing/export to that row and revision; failure rolls the whole change back, including undo and saved state. Do not build a second table or assume the existing table has none of these paths. |
| Boundary regression pack | Existing Kernel/Outer scope, not a new engine | Test similar edges on two bodies after a height edit, repeated split lineage/name growth, and the current positive-to-zero-to-positive distance contract. Keep current zero-length refusal explicit; a new zero-length solver behavior needs its own bounded support decision. Do not report SolidCraft's old defect as ours. |
| Section display and selection agreement | GPU; attach to issue 2213 | Compare visible cap, behind-cut colour/edge/hover and selection on the same revision in WebGPU and WebGL2, plus preview versus exact cut. Keep display caps distinct from native topology and do not add a new BVH or LOD task. |

These are additions to workflow depth, not six new implementation epics. Close the current
J2/Drawing/robot-warning batch and the selected 2215 sketch/revolve acceptance work first.
The first two rows become implementation tasks only after an exact data/ownership contract
and current-source gap are frozen. Rows three through six extend existing acceptance cases.
For later sheet-metal and frame work, qualify edit/regenerate to unfold or cut-list to
Drawing/export as one flow, and keep unimplemented joins/trims/cut lists conditional.

## Shared route bundles and virtual clips (Zip Ties)

User research and planning request, 2026-10-26. This is a new bounded editing workflow,
not an implemented routing or cable-physics feature. Reference interaction:
[ComfyUI Zip Ties](https://github.com/safzanpirani/comfyui-zip-ties), which stores ties as
workflow layout data and lets a user move or rotate several links together. For 3D CAD,
[SOLIDWORKS routing through clips](https://help.solidworks.com/2023/English/SolidWorks/sldpiping/t_routing_through_clips.htm)
and [Inventor harness settings](https://help.autodesk.com/cloudhelp/2026/ENU/Inventor-Help/files/GUID-EA41610E-ACFF-4F8B-9A05-339CA9CAEB1A.htm)
provide established examples of shared route points, individual route offsets and separate
centerline/sweep displays. These references are product documentation, not our runtime proof.

The proposed interaction is: select two existing 3D routes, add one virtual clip, drag its
XYZ handle to reshape the selected route handles together, preview both swept bodies, then
Apply once. Each route keeps its own identity, profile and end connections. A clip is initially
an editing constraint with no manufactured body or BOM item. Later explicit real clamp parts
must have their own geometry and component identity.

Current reusable code includes direct curve poles and movePole, the XYZ skeleton editor's
preview/Apply/Undo pattern, existing Pipe/Sweep construction and Viewer picking/overlays.
Current Sweep copies a direct curve's arrays. It does not retain a live route dependency.
Therefore grouped handles alone cannot promise that old swept bodies follow later edits.
Keep legacy snapshots unchanged; only a new explicit bundle may carry the new regeneration link.

| Stage / task | Lead and exact responsibility | Completion gate |
| --- | --- | --- |
| PB0 — route/clip contract | API owns persistent input and atomic document contract; GPU owns handle/pick/preview contract; Outer owns the later editor | Record stable route/object/feature identities, chosen handle keys, source revision, clip position and per-member offsets in model mm. Fixed control-point topology only in the first slice. Missing or changed handles are stale/refused, with no automatic reassignment. The Model core source is adopted after static review; actual foundation checks and the later GPU/Studio gesture remain separate gates. |
| PB1 — two routes, one clip | Outer editor after the current STL source slice returns; API producer and GPU interaction support have separate files | Translate one common XYZ handle and apply the same delta to the chosen handle of each route. Preserve clip-local offsets and untouched endpoints. Show individual members and their errors. No automatic packing, branching, global spacing guarantee, clip rotation or physics in this first editor. |
| PB2 — regenerate and commit atomically | API/Kernel existing evaluation path; Outer applies one complete candidate document | Regenerate both explicitly linked sweeps using their own profiles. Commit only if all members succeed on the current revision. One member failure, Cancel or stale completion leaves the complete previous document/results unchanged. One Undo/Redo restores all members together. Real Save/New/Open preserves membership, references and geometry inputs. |
| PB3 — richer route control | GPU/Outer after PB1–PB2 actual acceptance | Multiple clips, selective branches and clip orientation/section arrangement, with explicit local-frame continuity and source/version checks. Measure crossings, section clearance and bend constraints on fixed fixtures. Do not call simple XYZ offsets a general parallel-curve or collision-free solution. |
| PB4 — engineering qualification | Kernel/API, with existing Drawings/BOM/export consumers | Separate rigid pipe straight lengths/elbows from manually shaped cable paths. Specify and verify applicable bend radius, clearances, lengths, connector directions and manufacturing rules before claiming them. Cable sag, tension, fixed-length dynamics, contact or automatic obstacle routing need separate ownership and approval. Do not resume paused Physics or add a solver here. |

PB1–PB2 require real desktop browser selection/drag/preview/Apply, visible failures, PNG owner/root
inspection and console collection, plus independent native geometry and actual downloaded-file
roundtrip checks. A preview, screenshot or source fixture alone is not route acceptance. Preserve
tolerances, first failures and unmeasured items. The current one-route XYZ native/Viewer checks
remain one-route evidence; they are not bundle-editing proof.

Scheduling: finish the checked product closeout and the in-flight STL-quality producer/UI source
batch first. Independent route-contract reading can continue now. Do not assign simultaneous edits
to the same App/editor files. Keep the existing single coordinator task record authoritative;
PB1 source implementation starts only after the exact input contract and file ownership are assigned.

## CAD-to-simulation handoff: issue 2209 planning boundary

Reference [issue 2209](https://github.com/barocss/barocss/issues/2209) after the current editable-CAD,
setup, joint-input and two-link slices. It is research and planning, not authorization to install Intrinsic,
add a runtime dependency, change Physics ownership or release an adapter. Native CAD parameters and feature
history stay authoritative; visual meshes, collision shapes, URDF/USD and runtime scenes are derived assets
bound to the same source revision. SimReady here is a proposed barocss contract, not NVIDIA certification or
an established Intrinsic import schema.

| Slice | Reuse and owner | Admission and completion boundary |
|---|---|---|
| SR0: compatibility and existing contracts | API coordinates existing Kernel/Outer/GPU/Docs evidence; issues 2189 and 2193 | Read actual owned paths and source/producer/dependency identities, link/joint/frame bindings and target capabilities. Record supported, approximate, unsupported and unknown fields before assigning implementation. No duplicate package or source of truth. |
| SR1: runtime-free unit/frame/inertial checks | Reuse existing BRep/axis/R1 oracles and issue 2193 envelope | Check 100 mm to 0.1 m, mass g to kg and inertia g mm squared to kg m squared with factor 1e-9 exactly once. Use asymmetric fixtures for tensor rotation, COM reference and parallel axes. Refuse missing/double conversions, reflections treated as rotations, invalid tensors and unknown density. Exact source scope remains a future assignment. |
| SR2: visual/collision and joint tree | Reuse issue 2189; keep external-asset import issue 2191 separate | Permit declared bounded approximations while checking frame, scale, revision and collider completeness. Reject cycles, self-parent, missing links, zero axes, reversed limits and unsupported dependent joints. Separate authored zero, preview, belief, simulated and measured states. |
| SR3: derived-asset lifecycle and independent read-back | Reuse issues 2188, 2193, 2203 and 2204 | CAD changes invalidate dependent assets. Cancellation, duplicate or late results cannot replace accepted data. Export one admitted profile, read it independently and reopen after relocation; compare units, bounds, joints, inertials and asset paths/hashes. XML or STEP success is not runtime compatibility. |
| IA0: optional Intrinsic decision | Issue 2209, after separate adoption review | Confirm actual import path and immutable runtime/CLI/container/asset identities, per-component terms, environment and limits. Check geometry, kinematics, dynamics and sim/belief separately; define geometry rebuild/reinitialization. Installation, deployment and real hardware remain outside this roadmap update. |

Use geometry-only, kinematics-ready and dynamics-ready as distinct profiles. Required unknown physics or
verification cannot be promoted to dynamics-ready. Existing experiment records do not silently migrate to a
new schema. Preserve assumptions, density sources, coordinate conventions, losses and the first failures.
The issue's research barocss commit and pinned Intrinsic commit are not this execution baseline or an import
receipt. Intrinsic is not a CAD kernel, image-to-CAD reconstruction system or a prerequisite for current J2/R1.
Physics ownership and the free-pendulum contract remain unresolved; no solver/profile change follows here.

## Completion gates for virtual experiments

Use four separate gates for each bounded experiment. Record the supported inputs, predicted quantities, time range,
assumptions and acceptance limits before execution. A gate applies only to the stated experiment profile and range.

| Gate | Required evidence |
|---|---|
| Source implementation | The input checks, supported physical model, units, target references and failure paths are implemented and reviewed. Source existence is not an execution result. |
| Numerical verification | Compare with independent analytic or reference solutions. Check time-step and mesh convergence where applicable, conservation or constraint errors, and computational cost. Retain the original inputs, solver version, settings, outputs and failed runs. Passing tests establishes only the checks performed. |
| Measured validation | Compare predictions with controlled, repeated physical measurements for the intended use. State instrument uncertainty, input uncertainty, residual error and the supported operating range. Keep calibration data separate from validation data. Numerical verification does not replace this gate. |
| Product-flow acceptance | A user can define, save, reopen, run, cancel and compare the experiment against its design revision. Missing inputs, unsupported conditions, failed or incomplete runs and stale results are visible. This gate does not widen the validated physical range. |

Separate geometry approximation, discretization error, model error and input or measurement uncertainty. Report
error and runtime together when changing a time step, mesh or solver setting. Distinguish an engineering physics
profile from authored virtual-world rules. A plausible animation or a successful source test is not evidence of
predictive accuracy.

Keep every result bound to reproducible design inputs, material and mass-property sources, occurrence, revision,
loads, constraints and solver settings. A change to these inputs must trigger an explicit validity or stale-result
decision. Retain warnings, refusals, non-convergence, cancellations and the original FAIL records. Existing
manufacturing holds remain in force until their own inputs and acceptance conditions are resolved.

The first physical pendulum remains a planned experiment. Existing hinge, inertia and gravity sources do not yet
establish a supported end-to-end CAD pendulum. Record unsupported combinations as implementation gaps before
claiming period, angle or holding-torque predictions. This roadmap does not establish new solver APIs or a storage
schema.

## Reporting experiment progress

Report the change, its physical or user effect, the evidence and limits, then the next roadmap step. State the
current gate explicitly. Preserve commands, immutable source references and raw results with the evidence; do not
use their presence as a substitute for the outcome. A source review, visual result, numerical PASS and measured
validation are different results and must remain separate.

## Order now (2026-10-27)

Latest coordinator checkpoint supersedes the earlier status paragraphs below:

- Local product `d470649cd88c441ed944dc5e0bb96374f397a799` contains Viewer review-state save/restore. Source/default-export type, CPU5, actual file/browser flow and required product docs passed. Compiled Viewer/package release remains unqualified.
- Kernel SSI source `515b2aee37496d5a72059bf9b80d5007bdd50cfb` is adopted at `59eeb67e6e0099a53d6e61e2895b479089122757`. Its first affected CAD build, two test files (7 PASS) and production1 lint passed. Old818/new818 outputs differ only in `dist/intersect/surface-intersection.js`. This protects typed failure/finite admission and existing open/closed/tangent cases; it does not certify global SSI completeness.
- Route Model bindings and the pointer/session bridge are implemented. The first public flow produced two sweeps and a real saved baseline, then stopped at entry after an unresolved modifier-selection issue. The entry-only correction `4fdbfc76be39a5067cfff15cf4864e33b207546e` exposes the existing member selectors for two document curves. Reuse that exact saved baseline and complete the still-unrun Create/drag/Apply/Undo/Redo/file flow; preserve the original failure.
- Parameter-bound Drawing reference source and its caption/narrow-panel follow-up passed their scoped native/browser checks. The prior Save snapshot timeout remains cause-unknown. Reuse unchanged proof and close product integration rather than run the old flow again.
- Assembly review consumer `3c7be14dfba3dbeb217bc511d0a534489c6f2241` passed its changed public tree/pick/visibility/file flow. It reuses the SDK source entry; no new assembly engine, compiled package or larger-scene claim follows.
- Reviewed inventory adds 9 and changes 10 rows (6629 to 6638); the other6619 rows and non-exposure fields remain byte-identical. Source docs `c520fa0195ff76cc27078fb9a4326f565be5755b` preserve Pin/setup/material-preview text. Close the current docs/site batch and exact product adoption after the consumer returns.
- Next engine delivery is the already closed G15c progressive path-tracing source plus its captured sample-count correction. Keep it separate from the passed DoF checks. Viewer material consumption is independent source work; pack/config/hook investigation was stopped by the owner and is not a predecessor.

Each feature still follows foundation contract, complete source, one necessary affected batch, real consumer and exact product integration. The earlier records below retain their original proof boundaries; they are not new assignments or complete-project claims.


The current checked local product is `f1c6b178cd2ef9ae6bc87123e4434d204c3d08b3`.
STL quality is complete for its scoped seven-file feature, including actual downloads and required product docs.
The G15d.3 depth-of-field feature source is now closed across GPU core, Model and its existing Studio consumer;
new-source runtime checks and product adoption remain. Route-bundle core preserves its Kernel2 result; its
remaining out-of-range move test uses a valid accepted fixture and the existing producer refusal contract.
STL quality is separately qualified at `26917a5429b7e2cf0b9f8dd6052ef6892f42d5ce`; its docs/site and page checks
are in progress before product adoption. Its Model, Studio and actual exported-file checks are already accepted.
Drawing parameter callout display and the affected native/type/lint batch pass; reference roundtrip is not complete.
A separate single Save-button click produced one file and a responsive page; the older repeated-download timeout
remains preserved with unknown cause. Do not treat that tool-flow result as a repaired product defect.
Route-bundle Model Create/Move/Detach and admission source69fe4c6, plus Kernel foundation test source0b841158,
are adopted into the aggregate after static review. Their execution validation is NOT RUN. Close that foundation
batch before opening the later Studio tie gesture; no new language, routing solver or physics is included.
Its 19-path associative-sketch/clip-readback merge preserves the product-only portable handoff
files, foreign33 and CAD818. The first affected product GPU emit passed: 272 outputs emitted,
5 changed and 240 retained outputs unchanged; do not call every one of the existing 512 files
fresh. Mandatory product check-docs passed with 34 pages, 0 being-written, 47 figures, 3755 KB,
739 labels and empty stderr. The original metadata preparation failure is separate from the
first actual compiler PASS. No CAD rebuild was needed for this slice. Remote push is not done.

The previous checked product `3307c88b3a33c3b1fb78d14e887d08ccd9ca5c46` and its earlier
seven-path merge `91e96a23` contains sketch coefficient/diagnostic precision, Enter/value visibility,
exact revolve admission, Drawing compatibility tests and the Sketches guide. The first affected
product CAD build, one selected endpoint regression and the mandatory final product documentation
check passed. Fresh CAD output bytes/kinds/modes matched the candidate. The product's portable
handoff files and 33 foreign regular files remain preserved. Keep these checks at their actual
source refs; do not repeat them for the next Model/UI-only slice.

At common source `1a7f2266`, the affected CAD build and five frozen revolve regressions passed.
The production-file lint, final Studio type check and corrected Drawing compatibility tests also
passed. Desktop checks preserved `10.0000004` through Enter/Finish/Save/Open, and confirmed the
focused value is fully visible at the two selected dock widths. Common check-docs, site build and
the changed Sketches page display passed. Keep original failures and their distinct source refs.

The direct CAD-to-Viewer revolve case recorded independent expected volume
`1.3483831066349072`, actual direct volume `1.348383106634906` and B-rep volume
`1.348383106634922`, within the original relative `1e-12` limit. A tangent input was refused.
Three inspected WebGPU views showed no obvious missing visible surface. This used the default
B-rep validation checks; the original raw field called `strictBrep` was corrected in a sidecar.
An additional `strict: true` check was not run. This is not Studio revolve-authoring, full-normal,
physical or manufacturing acceptance.

The existing public Sketch-to-Extrude and face-Sketch-to-Cut/Through-all flow passed in desktop
agent-browser: a 40 by 20 by 8 mm plate, internal 10 by 10 mm profile, underside opening,
Undo/Redo and real download/New/Open. This bounded flow remains separate from associative edits.

**Next observed repair: `SC-ASSOCIATIVE-EDIT-01`.** A public Box 40 by 24 by 8 mm, top-face outline,
inward offset 2 and depth-4 ring cut gave volume 6720. Changing the box width to 60 left the
stored outline at 40/36 and gave 10560 instead of the associative expectation 10240. Undo,
Redo and actual Save/Open retained the observed result. Body references and cut links remained
present; this is not evidence of a lost stored face ID, because that recipe was not stored.
Outer owns the bounded repair, with API reviewing the persistent producer/consumer contract.
Use an explicit new associative action and existing named references; do not reinterpret old
snapshot sketches or add a second naming engine. Missing or ambiguous inputs must require repair
instead of silently producing an old or unrelated profile. Freeze the original failing file and
numerical/geometry expectations before a minimal commit and the same public workflow check.

**Associative repair checkpoint:** the explicit **Link face outline + inset** source at `51e7af55`
passed the frozen public case: 40 mm gives 6720 mm³; width 60 mm, Redo and real Save/New/Open
all give 10240 mm³. Actual Undo restores 6720 mm³. Passive/manual-edit Cancel preserves the
saved document; passive Finish preserves the sketch ID, recipe, default body target and cut link,
while refreshing the stored outline cache to 60/56. This does not reinterpret legacy snapshots.
The original native 14 passed at `51e7af55`. Its first Model type check failed with three test-shape
diagnostics; preserve that failure and the unrun Studio/lint stages. Normal test-only corrections
in `203c87a8` and `342e293f` fixed the missing annotations/required frame arrays. Model and Studio
types and exact production-seven-file lint passed at `342e293f`, with no production-byte change.
The reviewed inventory adds two public entries and changes four optional-field rows; all other
6623 entries and the other five top-level values are unchanged. The first check-docs at `e456e7f3`
failed because the generated Model BAD_REFERENCE row omitted its new engine source location.
The normal one-cell generated correction at `a3997f36` passed check-docs and site build. Assigned
Sketches and Refusals pages then passed actual desktop CUA display, link and scroll checks;
the original local server bind denial and its browser NOT RUN remain separate. No agent-browser
CLI execution is claimed for this CUA supplement. The first 234 MJS fallback warnings remain preserved.

At `6d981f2e`, the new associative Drawing tests passed 2/2 and Model types passed without errors.
Its separate actual Drawing screen preserved the saved document and displayed the 60/56 mm linked
outline and 4 mm step. The Kernel XYZ interpolated holed-sweep tests also passed 2/2 at that source;
three actual WebGPU views showed the two openings, with no obvious missing visible face. This is
not exact curved-volume, all-normal, physical or manufacturing acceptance. Keep the original
Drawing wait timeout and unrecorded measurements at their actual boundaries.

A collapsed inset was refused before committing the candidate document. The old NodeEditor hint
incorrectly suggested Undo. The context-only action adopted at `0214a8a0` preserves the error code,
title and detail, and now says the design was not changed. App-only lint and the actual narrow
new-hint browser case passed at `8273cb61`; the earlier full file workflow was not repeated.

The new clip-only GPU readback regression reproduced an old stale hit in both CPU and actual
Apple Metal WebGPU after the native map completed. The normal two-line fix `84ab7d99`, adopted
through `8273cb61`, returns null for the same controlled case. Fresh scoped emit, the new CPU case,
actual WebGPU case and exact two-file lint passed. Preserve the original lint module-resolution
failure and its config-path-only correction. This is controlled consumer continuation, not a
natural GPU latency or performance measurement. It does not resume paused FOV/BVH/LOD work.

Next integrate this checked Model/UI/test/docs/GPU slice and the already-passed fillet regression
into the product. Preserve the product-only portable handoff files and foreign WIP. No CAD rebuild
is needed because CAD production is unchanged. The product's ignored GPU Viewer output is old,
so run its first affected original library emit, distinguish actually emitted files from retained
ones, and finish the mandatory product documentation check. Those required product steps are now
complete at `5ed2c690`; retain each original source-bound check instead of rerunning it.

Previously adopted setup Save/Open/Use/Run/Bind, historical records and Pin comparison retain
separate contracts. Actual calculation creates a new result; imported records remain historical.
Material snapshots preserve used density versus catalogue declarations without authenticating
them. The product already contains J2, export-note and bounded R1 checks. None of these establish
forward free motion or measured accuracy. Physics ownership, manufacturing holds and paused work
remain in force. The single coordinator task record, not historical prose below, controls dispatch.

### Near-term delivery ownership (2026-10-26)

Each row is a bounded delivery slice, with source, numerical, screen/file and product gates kept separate.
Independent source work and isolated browser checks proceed in parallel. Native/build/generator contention and
shared integration stay serial. Owners use agent-browser for needed checks without a new central browser
approval; preserve other sessions and record actual source, input, URL and screenshots.

| Slice | Owner | Current source state | Required next evidence |
|---|---|---|---|
| Close the verified sketch/revolve product slice | Kernel product build/selected endpoint; Docs mandatory check; API integration | Product `3307c88b` has the affected build, selected endpoint and final docs PASS | Preserve exact receipts and old/new outputs; do not repeat completed checks without a relevant change. |
| Repair associative face-sketch edits | Outer implementation/browser; API integration; Docs page verification | Explicit link, native14, corrected type/lint, reviewed inventory, docs/site/pages, Drawing2 and narrow refusal-hint checks passed at their distinct refs | Local product adoption, first affected GPU emit and mandatory product documentation check; preserve legacy behavior and first failures. |
| Preserve drill versus tap-depth contracts | API/Outer producer contract; Drawings consumer | Existing compatibility tests remain preserved; Drawings now reads the actual consumer boundary | Agree separate depth limits in mm, backward defaults and Drawing/text implications before implementation; do not repeat old tests. |
| Separate export mesh quality | Kernel public option contract; API/Outer consumer | Model and Studio source, independent rim-error checks and actual STL downloads are accepted | Finish the separate qualification docs/site/page and exact product adoption. Preserve Automatic default16, explicit8/16/32 and BRep-only refusal. No broad triangle-budget guarantee. |
| GPU stale-readback protection | Existing GPU owner | New clip-only CPU and actual WebGPU RED-to-GREEN, scoped emit and exact lint passed; shared normal commits adopted | Refresh the first affected product output with the existing tsc-only build contract; preserve retained outputs, old camera evidence and first lint failure. No new BVH/LOD or paused FOV work. |
| Admit the first free pendulum profile | Confirm Physics ownership first; Kernel/API supply mass/frame contracts | No solver implementation assigned | Agree pivot/COM placement, pivot inertia, gravity moment, reactions and units; then check independent period, energy, time-step convergence and joint errors. Physical validation needs separate measurements. |

The local pin and setup UI state is not saved by CAD document Save. A matching imported historical record is
not a recalculation. Current material declarations and FNV staleness labels are not authenticity evidence.
After each slice, update its actual evidence and select the next ready dependency; do not leave an empty
lane queue or generate unreviewed features simply to keep a lane busy.

Stage 1 still covers a bounded static holding-torque calculation for one connected open revolute or continuous
joint with explicit pose, gravity and known material. Nested moving-part occurrences remain refused. This is
not free-motion prediction or completion of Stage 1. Establish Physics ownership and the mass, coordinate-frame,
unit and fixed-pivot contract before implementing a pendulum solver. Do not infer measured accuracy from the
current numerical, input-consistency, recorded-source or UI checks.

## Historical lane order (2026-10-25, owner: "필요한 것들 로드맵에 추가 해서 진행해줘")

The table below retains the earlier lane order and checkpoint narrative. Use the current delivery checkpoint
above and the staged expansion for current priorities. The coordinator adopts each bounded checkpoint serially
and runs the required product docs check.

| Lane | Now | Next | Then |
|---|---|---|---|
| Kernel | R7.3b/R7.7b adopted in `bd60b578b`; CG1.1 core, parallel non-affine polygon extension and CG1.1c circle/ellipse loft adopted (`a52d6c46b` / `da74a7fa9` / `33f47b8a4`); bounded mixed line/arc loft CG1.1d is also adopted (`b21910b43`): revised oriented43 tests pass; original build/types/lint and two unchanged test files retain their source scope | CG1.2 bounded conic quadratic guide is adopted (`b7b0f0e08`): repaired oriented56 and actual candidate/product consumer types pass; original f7d7 build/lint/unchanged tests retain their execution scope. Mixed-profile guide CG1.2b is in source development. General curved profiles, guide rails, Studio/v2 adapters and CG2 patterns remain; use RS7 as a consumer | PG-3 profiling remains prepared; R7.3d and K17 stay in separate windows |
| Outer | O24(a)/(b)/(c), RS6 core and O24(d)-1 fastened adopted (`69983467e`); fresh product Model64/Studio10 and both type checks pass | O24(d)-2 ball adopted (`d753cfc2f`): native Model59/Studio12 and both types passed at `5d75cb5a`; single test declaration repair `09a868163` passed owned lint. Shared RS6 Studio playback is adopted (`cda369b94`); Universal is adopted (`71f4ee9d6`): native Model62/Studio16, types2 and lint pass; actual product types/docs pass. Universal robot decomposition/loops remain typed unsupported. Cylindrical `67ce4648f` is source-reviewed; native remains | O24(e) relations and CG4 flexible subassemblies/patterns; RO diagnostic remains optional |
| GPU | G15d.2 bloom adopted (`621c7dc6f`, merge `cba255347`). G14 quiet section samples give mixed results (5.89 ms PASS, 7.43 ms FAIL against 6 ms); an excluded run ended above load 10. No new code checkpoint | Keep G14: separate surface/cap/output contributions before choosing an optimization; then G15d.3 → G15c → G15d.4 | G15-accept on the P1 engine |
| API | R7.7d, P2 G/B/A/C and bounded RS6 facade/Studio adapters adopted (`930f74ae9` / `cda369b94`); candidate Model31/Studio5, types2 and lint pass, and adopted source bytes match | Prioritize P2 engineering failures with existing approved inputs; separate code defects from actual stock/material/connector decisions. RS6 browser case is source-ready; finite passive bounds and check/sweep/CCD retain refusals | PG12 four-screw sample positive is separate from ten last-run manufacturing failures and PG11 |
| Docs | R7 docs and R7.6 scoped inventory checks adopted (`422f900d5`); intentional motion and face-datum API deltas reviewed | CAD API gallery source `68c4b97bb` and peer review are ready: generate actual 24 native cases and 25 mesh/SVG assets, then build and inspect the site. Update RS6 user docs and its stale executable sample together; keep the example visible | Document RS7 from implemented features; preserve the owner preview and artifacts |
| Drawings (CG5) | DR-6a, R7 consumers and bounded DR-6b face datums adopted (`3a253b620`). Original `8e7306835` native12 and retained-Drawing WebGL2 starter/case pass. Type-only repair `465165443` passes types2/owned12 lint; actual combined product types pass | P2 label-placement source `b3b50cff1` passed source peer review; native remains. Implement real multi-view balloon anchors; Outer authors assembly dimensions. Keep all required dimensions and strict issue checks | DR-6 targets/scope/reorient/standalone/composite; DR-7/DR-8 and broader GD&T remain |
| Data (CG6) | idle: VA-1/VA-2 done (merge df8761f1e); what is left (sharing, comments, multi-user) waits on the owner | — | — |
| Coordinator | R7, P2 G/B, CG1.1 bounded core and O24(d)-1 fastened adopted; actual product Model64/Studio10 and both type checks pass | P2 A/C example scope is adopted. CG1.1c is adopted. RS6 repaired facade and bounded Ball are adopted; R7.6 scoped checks and CG1.1d are adopted; bounded RS6 Studio motion adapters are adopted in `cda369b94`; Drawing face datums are adopted in `3a253b620`; Universal and bounded CG1.2 are adopted (`71f4ee9d6` / `b7b0f0e08`); next are actual API gallery generation, P2 drawing fixes, Cylindrical native and RS6 browser; one runtime writer | RS7 staged acceptance joins existing O24/RS6/CG work; keep recorded exceptions and owner input decisions |

## Codex lane ownership and R7 readiness (2026-10-24)

The owner transferred the Claude branches to Codex on this machine. This supersedes protocol.md's 2026-10-23
Claude-ownership prohibition. Work stays local. Each lane uses its existing worktree, preserves its handover branch and works on explicitly assigned Codex checkpoint branches. This coordinator
alone merges immutable qualified checkpoints with `--no-ff`, one at a time, and runs the docs check after each merge.
The six dedicated Works are separate; the older Codex worktrees are not their working directories.

The checkpoint narrative in this section is historical preparation. Its old pending/not-adopted statements are preserved records. Use **Order now** and **Where we are** for current adoption and work order.

| Lane | Work chat | Existing worktree | Preserved handover branch |
|---|---|---|---|
| Kernel | 01a16e2f-fd09-7ea3-b47e-e1243e1b3498 | studio-constraints-371737 | claude/kernel-r73b-r77b |
| Outer | 01a16e30-2fb2-7a31-8011-258896c32342 | studio-mates-cbde0e | claude/cad-outer-lane-531d5a |
| GPU | 01a16e30-68c5-7ae2-a500-33133dc9b2b4 | compassionate-turing-e88276 | claude/gpu-lane-2026-10-23 |
| API | 01a16e30-a0fe-7ea3-b7d9-944480088a55 | confident-fermi-29a815 | claude/api-lane-2026-10-24 |
| Docs | 01a16e30-d6e2-7030-a266-fdeb12dc9b9f | fervent-hopper-d9c6b2 | claude/fervent-hopper-d9c6b2 |
| Drawings | 01a16e31-1757-7e83-b62c-436a517d1dc7 | cad-drawings-cg5 | claude/drawings-cg5 |

The worktrees above are under `/Users/user/github/barocss/barocss/.claude/worktrees/`. Integration remains
`barocss-cad-gpu-review-efbb2c`, branch `review/cad-gpu-engine-2026-10-14`.

**Fixed R7 preparation base:** `c9cd4a8caa98b51570e7e02aaa94d637a523061d`, branch
`codex/cad-r7-preparation-20261024`, worktree `codex-r7-preparation-20261024` under the worktree directory above.
This isolated base combines adopted product code `af40fbbe87be51232c85c9a7be41a3c7c1d11c4e` and kernel
`a9d777a7ebdd2e0fc09b2a11689182f41a0c95bc`. At creation it was preparation only. The immutable base stays fixed; its reviewed R7 descendants were later qualified at66395 and adopted through `bd60b578b`.
The owner's direct Kernel-chat request on 2026-10-24 authorizes fixing this base and preparing consumer migrations.
The base's `notes/r7-window-2026-10-24/README.md`, `ownership.json` and `field-map.json` fix the 354 contextual
renames, MMGS contracts, final spring rule and exact shared-file leases.

Outer/API/Docs/Drawings were instructed to preserve the current direct task's source on its original branch first,
then use their existing worktrees with `codex/cad-r7-{outer,api,docs,drawings}-20261024` branches at that exact base.
Do not carry P2 or unrelated feature WIP into those branches. Coordinator retains browser-flow; Outer receives
explicit App/chat/node-bench/mesh-bench leases; Docs owns its candidate generators/text; Drawings owns its omitted
consumers. GPU completed a read-only impact review. On 2026-10-25 the owner explicitly approved only the demonstrated R7 field-name compatibility patch and related checks in 19 assigned GPU consumer/test files. Rendering optimization, formulas and tolerances remain outside that approval.
Final qualification occurs on an isolated assembled consumer aggregate; source-ready patches are not product
acceptance. The later adopted O24(b) checkpoint `67a5622cd` is an explicit Outer supplement to the
fixed base, not a base rewrite: Outer must reconcile it in its R7 branch and the aggregate must include it before
promotion. No unverified connector WIP is authorized by this supplement. The later adopted Boolean figure checkpoint `5237df391` is an explicit Docs supplement under
the same rule. Preserve any R7 WIP before merging it in the Docs branch, port its facade field reads, and qualify
both supplements in the final aggregate. The adopted 3D checkpoint `f1b1819e9` is another explicit Docs supplement; its generators and native scene checks must work with the R7 consumers too. The immutable base itself does not move. No preparation branch is merged into product while any required consumer checkpoint is unqualified.

**R7.3b/R7.7b coordinated batch: locally adopted.** Frozen `66395f7b0cb7df180e1bd8687773abaeb130c38c` passed the required same-SHA qualification and was merged once with `--no-ff` into product as `bd60b578b02ba903ce38cf7582f28077aec14af2`. Product check-docs passes:34 pages,0 being written,47 shots,3755KB,704 labels. At that R7 adoption, the product tree equalled the qualified tree except the retained product roadmap. The current product also contains the CG1.1, P2 G/B and O24(d)-1 checkpoints recorded below. All32 foreign untracked files retain their bytes and modes. Preparation HEAD and old frozen refs remain fixed.

- Kernel:1749 PASS/0 FAIL/6 existing conditional SKIP; properties2200 PASS. Fingerprint869 canonical bytes match; exactly3 historical refusal-message strict differences and2 existing RB TODOs remain.
- GPU: fresh build/types/lint and CPU304, packed3, browser34 pass. Outer: actual Model/Studio types, lint0 errors, Studio build, whole Model1287 and Studio310 pass. Native eager/deferred/placed Save/New/Open, four readers, Preview/Apply stale guards and time replay pass within their source-dev scope.
- Docs:75 samples pass; scenes command reports427212 bytes, site175 files, docs check passes. Final dist1110 is bound to the same frozen source.
- Root full unfiltered Studio: WebGPU306/306 and WebGL2306/306 pass at66395. Harness page-error reporting is empty. Original Vite RO messages occur twice per backend; cause UNKNOWN and messages remain preserved. WebGPU exact detached-driver exit is NOT RECORDED; its harness/wrapper/acquire/release exits are0 and termination is observed. WebGL2 actual driver exit is0.
- This qualifies the coordinated R7 source adoption with recorded exceptions. It does not establish P2 manufacturing acceptance, built-dist UI, a precise runtime graph, live LLM behavior or R7.3d completion. Original failed runs, Outer temporary-bundle/input-graph preservation limits and all historical evidence remain unchanged.

P2 G/B are adopted and R reproduced the previous VALUE failure. A ran with its original eleven product failures; A-check stayed NOT RUN. C build and same-document check passed PG12 with four real screws, while ten product failures remained. C enclosure38 and engineering10 tests passed. Its original direct type command failed; the separate strict source-mapped command passed without source changes. A and C were separately adopted by `f58d1a310` and `db588717a`, with docs checks after each merge. The actual combined product passed the strict example type program (850 listed files); no new full example build/check or manufacturing PASS is claimed. Native example evidence stays labelled exact A/C. Manufacturing and PG11 remain open. Drawing DR-6b and GPU feature WIP stay separate. RO diagnostic source is ready; its optional runtime has no priority over this queue.

### Historical R7 preparation and hold records

The records below describe earlier checkpoints and their status at that time. Their pending/HOLD/NOT RUN statements are historical; the66395 qualification and product adoption above are the current R7 authority. The earlier hold required compatible immutable checkpoints from all participants:


- Kernel: native SI dfb, stored fixtures b567/d788, fit19b, native-split oracle f932, output wallTime/preview c57 and temporary Model T-slot consumer1d832 are assembled. Packed-consumer metadata/context and named numerical-v0 compatibility reaches a complete actual pack/runtime/external-TypeScript pass at9f3314006; its9 source and1643 evidence hashes are reviewed. Same-head scoped lint has0 errors and9 existing warnings. The13-stage final Kernel execution plan is prepared, not executed.
- Outer: public angular/storage552e, reports c327, native adapter6b1, fit8fc, private worker provenance d1f7, Rebuildtime b9, B2 duty/harness23e, detached gear/pose metadata d419 and Orient3f6d are assembled. Their focused/native/UI receipts have explicit SHA boundaries. minClearance fraction-versus-time and remaining mechanical/CAM/Print/material/reference quantities are active; L3 public report/duty consumption is a separate API lease.
- API: angular1d31/B1d22/P1-time431 and public EvalResult wallTime b564 are assembled. Exactb564 passes Model39, client4, actual Model/Studio types and scoped lint; the Studio environment reused three existing declared UI modules without source/dependency changes. The temporary13-file time lease is returned. Next is exact B2/metadata consumption, including the nonzero gear test and L3 tool/scripted duty boundary. P2 remains excluded.
- Docs: B1d38 samples70/70, scenes and site build passed at that lane SHA; fit prose d322 is assembled. The lane now consumes exact688eeacf for B2/metadata prose and sample bindings. Generated tools/refusals and the next whole samples/scenes/build wait for final matching producers. The user's frozen5173 preview remains preserved.
- Drawings: fit3c78 is assembled, with Drawing127, actual Model/Studio types, MCP4 and WebGPU6/WebGL2 6 passing on that exact SHA. Independent DXF remains12mm/INSUNITS4 at scale1/2. Final aggregate types/flows are not inferred from this earlier lane result. DR-6b stays excluded.
- GPU: initial compatibility1205 is assembled. Exactdf3/c57 approximation compatibility requires no source change and passes focused CPU/type/report checks; renderer and aggregate qualification remain separate. CAM/Print wait for actual Outer producers. G14, DoF1fdd and progressive still tracing537626e76 stay on separate feature branches under the owner's later roadmap-resume instruction; they are not imported into R7 or product implicitly.

The isolated qualification branch is `codex/cad-r7-qualification-20261025` in the preparation worktree.
Latest isolated preparation is frozen at `e4f3b38ba43268fbc92ed7f766b461a0d83a964a`, ref `codex/cad-r7-frozen-repair-qualification-20261025`. The prior `f9a78054645590fc665809a5e862d0c335c39cdd` ref and evidence remain preserved.
It assembles the residual contracts, Drawing baseline0f56, Docs B1d38, Outer angular552e/public reports c327/native SI6b1, API B1d22, Kernel storedb567/d788/native SIdfb/fit19b and Split oraclef932. Shared browser-flow migration4b709 remains WIP NOT VERIFIED until its real flows run.
Current preparation also includes raw DraftField/Face eda447, analysis wall dd1c/analysis draft df9a, API scalar-map2a46/ThicknessLimits061/casting limits82cb, Kernel quote c2e/cd19 and BOM bound8452, GPU CAM c479, CastingDraftLimits975 with g6 matching7c601, and casting tolerance898. Source and evidence hashes were reviewed before serial no-ff preparation merges; generated tools/refusals still drift. BOM8452 passes23 focused checks and owned lint at Node22.23.3, including actual output_bom JSON/bytes/hash and known/null/omitted/positive-zero mass bounds. Its new base-bound positive uses base.others; a new known-bound frame-member fixture was NOT RUN. Casting898 passes10 focused checks and lint at22.23.3. g6 matching7c601 passes15 checks at22.22.0; this is not final22.23.3 evidence. Lane-local foreign type failures remain in their original receipts. None of these results establishes final aggregate qualification.

The public/native solver boundary is implemented in API4806494b and assembled in preparation. Default checkDesign/sizeDesign and document entries use canonical PublicDuty in seconds/degrees/MMGS; invalid inputs throw the existing BAD_VALUES BarocssError. Explicit native modules retain the original parser/solver/provenance and radians/SI/hours contract. Seventeen source and112 evidence hashes were checked; native-reachable source482 files are byte-identical to the prior d3 native proof. Final4806 has Model7/Studio11/Docs5 focused passes, actual types pass and lint has zero errors/one existing warning. The earlier d3 error-return failure and0378 readonly-moves type failure remain recorded. Prior native24/build/writer evidence is source-bound reuse, not a new4806 run. MIN_VALUE serviceLife still underflows in the original conversion; general Float64 round-trip preservation is not proved. The seventeen-file lease, including the Docs sample, is returned.

P02 weld producer05526769b and Drawing consumer998736ff, P04 holee2cd383 and P05 stock850ed0f are reviewed and assembled. The weld producer's original foreign query type failure remains separate from consumer types passing. P04 keeps all eight frozen O7 fixture hashes; its expected reader maps four old snapshot keys only in the test. P05 changes allowance.mm to allowance.value with the same mm values. Its three source/eight log/three runtime hashes and eight protected fixtures were checked; Model11/Studio6 focused checks, actual types and lint pass at its own22.23.3 SHA. These are lane checkpoint results, not aggregate qualification.
BOM total373 is reviewed and assembled with nine source and998 evidence hashes,14 focused checks, lint and actual Model/Studio types passing at its own Node22.23.3 checkpoint. Interference818 is reviewed and assembled with ten source hashes and ten runtime/check/rung artifacts:40 focused checks, existing RUNG8/9/11 five-trial subsets and44 killed mutants pass at its own SHA. This is not whole-ladder or aggregate proof. The coordinator initially resolved two rung artifacts at the wrong relative root and completed their hash verification after the preparation merge; the receipt preserves that review failure and correction. Future review-to-merge scripts must stop on any review failure.

P08 undercut9b340b53 and P11 assembly8093e075 are reviewed and assembled: focused15 and25 checks, actual types and owned lint pass at their own Node22.23.3 checkpoints. Production changes preserve the original source after exact field-name reversal. Initial runner-log hashes are exact append-only prefixes of completed logs; both stages and original receipts are preserved. Required runner hashes were verified before preparation merges. Each postmerge docs check still reports only the known tools/refusals drift. These focused results are not final aggregate proof.

R01 draft public value3d8fe6cf, R03/R04 duration3ccc78b7/ebef7fc8, P12 chord49a627e4, P13 withinAngle9423c578 and P06A extent6f23065b are reviewed and assembled. R01 source7/fixtures9/evidence16/outputs3, each report-time ZIP47 plus protected13 and native archive1490 bytes, P06A source4/evidence990, and P12/P13 source/log/runner bindings were checked. P13 preserves the first19 PASS/1 FAIL and a five-test repair after adding missing pre-existing ok:true to a new test expectation; it does not claim a new twenty-test pass. Its long clamp test is bound to unchanged source. All final whole checks remain NOT RUN.

R05 Trial timing, P10 alignment, P09A/B clearance quantities/timing, P06B CLI follow-up, P07 solidification and R09 image width are reviewed and assembled. R09 keeps V1/V2 results separate, preserves physical/pixel oracles, and has zero lint errors with32 parent-line-bound warnings. Its first report-finalizer assertion was corrected without source/test reruns; only its tool diagnostic survives, not a full original shell log. P07 has five focused passes at its own SHA. All are preparation results, not product or final aggregate qualification. The new solver/mesh contract makes the narrow solveIk/IkResult calculation boundary explicit and assigns loop/mesh field consumers without changing equations or tolerance.

The reviewed L1 loop residual checkpoint1f728801 and R02A sampled face chord metadata checkpoint16b5934 are assembled through no-ff merges a8742ee6 and93d64c92. Their27 and16 focused passes belong to their own immutable SHAs. The generic inertia result and direct gear phase contract is recorded at0a7fa896: Kernel owns the two-file public inertia egress change; API owns the five-file already-degree phase name change. GPU owns the remaining two-file Team chord metadata consumer. R02B56fcc8c57 is also reviewed and assembled: two sources,31 evidence files and two focused checks at its own SHA. API gear aee184 is reviewed and assembled: five owned sources, eight protected files,50 evidence artifacts and634 runtime Git inputs;12 focused checks pass at that checkpoint. Its original undefined-versus3-degree failure is preserved. Both are preparation evidence only. The gravityOf/movesOf canonical input and typed-refusal contract is fixed atad05190; API95092 is reviewed and assembled with three sources,20 protected files,49 evidence artifacts and633 runtime Git inputs. Its16 focused passes belong to its own SHA. Kernel generic inertia085983 is reviewed and assembled with two sources, five protected sources and2945 evidence hashes. Its seven focused passes preserve the first strict-zero failure and wrong Frame type diagnostics; existing native/public tolerances remain unchanged. All assigned runtime producer leases are returned. Docs e2d12786 is reviewed and assembled: three Markdown sources, six generator inputs, four runtime trees and23 external evidence hashes. The first common run at f9a completed Kernel13 and GPU package qualification, while Outer found three required failures: Studio lint's inherited unused import, the Model shared-bead worker test's outdated request/receive contract, and Studio's old nesting-kerf test key. Outer native-worker Save/New/Open/readers, Preview/Apply and evaluation-time browser replays passed within their source-dev WebGL2 scope. Root's full Studio WebGPU/WebGL2 flows did not run. The first run remains NOT QUALIFIED. Kernel's six conditional skips, two pre-existing RB TODOs and three historical refusal-message differences remain explicit exceptions.

The narrow repairs are reviewed and assembled at e4f3: Kernel2cf removes one unused import and changes the CLI test's expected key; GPU73bd repairs one worker test's protocol/order/receiver and local type boundary. Kernel focused lint/CLI and GPU focused test/types/lint pass at their own checkpoints. Their original failures and capture/probe incidents remain recorded. Both preparation merges pass check-docs34pages/47shots/704labels. These focused passes do not establish whole qualification at e4f3. Kernel13 is complete and reviewed at the immutable new SHA: whole1749 PASS/0 FAIL/6 existing conditional SKIP; fingerprint869 canonical bytes match while the three approved historical refusal-message differences remain; RB has two unchanged unresolved TODOs and no new failures; properties2200, source/emitted/cold, actual packed consumers and independent exchange pass. All thirteen command and release exits are zero. The coordinator verified3813 evidence hashes,2835 tracked source hashes and404 source-to808 dist files. GPU, Outer, Docs and Root full Studio browser qualification follow serially. No R7 product source is adopted yet.

The owner requested maximum verified local integration and immediate P2 progress after R7. Independent P2 general API4606, dynamic-fields B e663 and example A f174 source checkpoints and verification plans are reviewed; runtime validation remains queued. The existing shipped M3 sample contains socket cap length5. PG-12 must verify actual row/source/fastener use rather than retain a blanket data-absence claim. Its three-file source-only follow-up is approved after review of fifteen source references and the existing sample binding; runtime remains NOT RUN. PG-11 connector input and remaining manufacturing, interference, drawing, CAM and mass requirements remain open. No product acceptance is implied. Drawing DR-6b checkpoint56d2 is source-reviewed separately: eleven owned files, six protected files and nineteen external evidence hashes. All runtime checks remain NOT RUN; its focused validation plan is being prepared. It is excluded from this R7 assembly.

Generated tools/refusals were regenerated once with the completed producers; their original drift failures remain recorded. Current preparation check-docs passes. Root full browser quantity flows remain NOT RUN. Quote567 retains the disclosed loss of its initial complete raw logs; partial initial diagnostics and final exact-head checks survive. New e4f3 whole qualification is running and remains **NOT QUALIFIED**. R7 source and P2 remain outside product.

- At exact `eb4a0487c4c0e3ef17101fb021a7867e41a164ca`, model/Studio types pass, whole model has1208 PASS /11 FAIL /0 SKIP of1219, docs61/61 pass, and O24(b) Save/Open8 assertions pass.
- At `3f7006abcdecb290d0406d062758832be02cce29`, the seven bounded Kernel/Outer repair groups pass30/30. This is a focused rerun, not a rerun of all1219. Four frozen-SI model failure groups remain unresolved.
- At `78be079e8cb8ac4b453abdbdc10f50c6d0a9be28`, whole Studio completes:298 PASS /3 FAIL /0 SKIP of301, exit1. Studio types and docs pass. Failures are the A7.5 replay mutant and frozen MJCF/URDF strings. The original eb4 interrupted run(exit143) is preserved separately; stale facts caused an assertion before child cleanup, repaired in the bounded MCP test checkpoint.

Preserve the70g budget and rejected decision; actual fixture mass is about76.945699g. Do not weaken tolerance,
byte assertions or refusal expectations. Keep first failures. The unfinished public robot units and field-name
contract also block product R7 adoption even if focused compatibility checks pass. P2 stays held until product validation.

### Historical residual work assignments (2026-10-25, before final qualification)

The owner explicitly requested continued lane instructions and a single fully checked R7 assembly. Contract checkpoint
`77d5ac1bca0042c0a086f83f26ad602ad14e3af8` in isolated preparation adds
`notes/r7-window-2026-10-24/residual-contract.md`; it applies the existing approved MMGS/degree/latest-schema rules.
This is a contract checkpoint, not completed consumer code or product adoption. All six existing Works received their
bounded next tasks at that exact base and preserve their previous checkpoints.

| Work | Active scope | Dependency / completion condition |
|---|---|---|
| Kernel | P06A, P06B+CLI and P07 reviewed and assembled; all leases returned | Final thirteen-step run waits for one immutable aggregate; no repeated readiness checks |
| Outer | P08/P10/P11/P12/P13 reviewed and assembled; new five-file loop residual lease | Same solver scalar and native joint coordinates; general mixed row norm is not relabelled as a pure distance |
| API | R03/R04/R05 reviewed and assembled; remaining mass/gear/move boundary plan active | Separate public projections from exact native calculation contracts; no source changes before a file lease |
| Docs | Source-ready a8b and returned metadata sample; read-only R01 draft-row ownership map | Generate tools/refusals once after final matching producers, then same-SHA samples/scenes/build |
| Drawings | R01 and R09 reviewed and assembled; all leases returned | Focused V1/V2 image tests pass; actual browser and final same-SHA qualification remain NOT RUN |
| GPU | P09A/B reviewed and assembled; new R02 mesh metadata three-file then Team view two-file lease | Sampled chordDepth metadata and public chordTolerance projection preserve values, precision and raw calculation boundaries |
| Coordinator | Serial reviewed preparation, shared browser-flow, contracts | Close remaining families; freeze one SHA; run full required suites and actual flows before R7 product window |

Public and stored turning quantities use degrees, force N, turning moment N·mm, gravity mm/s², time seconds,
mass g and inertia g·mm². Native robot files retain format SI; raw FK/dynamics remain internal radians/SI.
Default gravity preserves9.80665m/s² as9806.65mm/s²; explicit9810 remains a separate input. No aliases, schema bump, tolerance loosening or frozen-native-pin regeneration is authorized. A7.5 test-only checkpoint
`6b7e58d3b` is adopted in preparation `3795e938b`; focused5/5 passed, without a new whole Studio result. Kernel/Outer angular storage at6ced passes15/15; this is a focused result, not a whole suite or the later0632 result.
Product R7 and P2 remain HOLD. The354-row kernel map was not complete: audits additionally found T-slot cellSize, profile/decimate wallTime, approximation maxSampledDeviation, P1 duration/treeTime, and public nested coupling rotation. Each has a bounded producer/consumer assignment. Natural option name deg remains explicitly allowed by conventions. Kernel fit human µm text stays correctly labelled and unchanged while JSON quantities use mm.

The coordinator must record the complete immutable set and shared field/unit map before the serial window. Verify
all consumers together before describing the R7 aggregate as integrated. Keep qualified independent milestones
moving while the R7 window is held. Do not broaden focused proof into full browser, product or release acceptance.

## Where we are

Integration is `review/cad-gpu-engine-2026-10-14`, local only. Current R7 source merge: `bd60b578b` from qualified66395; current tip is in `git log`. The older windows below remain historical records.

| | |
|---|---|
| Current R7 window | Frozen66395: Kernel/GPU/Model/Studio/Docs and full WebGPU306/WebGL2306 reviewed; adopted by `bd60b578b`, product docs check passes. Known exceptions and P2 manufacturing gaps remain explicit. P2 G/B and bounded A/C example sources are adopted. CG1.1b and CG1.1c polygon/conic extensions are adopted in `da74a7fa9` / `33f47b8a4`; bounded Ball is adopted in `d753cfc2f`; R7.6 scoped inventory and CG1.1d mixed curves are adopted; bounded RS6 Studio motion adapters are adopted in `cda369b94`. Candidate Model31/Studio5 and both types pass; actual React/RAF/browser acceptance remains. Drawing face datums are adopted in `3a253b620` with original scoped native/UI proof and new product consumer types. Bounded Universal and CG1.2 quadratic guide are adopted in `71f4ee9d6` / `b7b0f0e08` with actual product types/docs. Mixed-profile guide source, Cylindrical native, P2 fixes, API visual generation and GPU windows remain. |
| Historical content | develop (#2185) + Codex's work squashed (`99da385a1`, no evidence files) + the GPU lint fix |
| Flow at dc4b196e3 | the full flow on WebGPU 288/288 (the O19 regression fixed). Lanes paused at their usage limits (2026-10-24 evening): to merge — outer RS3 (a) on its tip, GPU RS2 part 1 `b7869913d` (not a79d3df3f, unverified), API's branch tip 26d268974 (integration merge only); kernel's fold is a patch in the shared notes (r73a-b2-part2-fold-wip.patch, unverified); rb9/product-brief/0 and /2's R4 records after fc3fde052: checked by the coordinator — only the STEP text's hash moves (the fillet node's stored signature gains `n`, so the document revision in the STEP header changes); bodies, B-reps, keys, rebuild and STL identical |
| WebGL2 | the full flow on WebGL2 at a90db6fa3 (GPU lane): 286/288, the two failures O19's regression (176, 183), fixed in dc4b196e3 |
| Earlier fully verified commit | `1f43a0818`, 2026-10-24, after K16 (a track boundary): builds, types, lint, model 1051/1051, studio 286/286, gpu 201/201, kernel 1715/1722 (only native-split), RB and props pass, full flow 287/287 on WebGPU. Before it: `16eabdd8e` (S9) |
| Integration window at `99da385a1` | builds and tsc pass; gpu 179/179; kernel 1597/1608 (4 real failures); model 902/915; studio 166/187; studio lint 1 error (fixed since); browser flow not run |

Done, per area (see the logs):
- **Kernel core:** R1–R12c, track K and PKG.
- **Frames:** FR1–FR4, FRa–FRg, FRk1, FRk2, FRk3 (I/H, tapered channels, D172), FRk4 (curved and bent members, D173/D174) and FRk5 (weld gaps and notches, D175). FRk5 has open items below.
- **Shared weld seams:** D170.
- **Robots:** RM1–RM9 (joint tree from the mates by their free twists, FK and sliders, link inertia, URDF, MJCF, SDF, USD, collision sweep and continuous collision, workspace map, IK, the four-bar loop), RD1–RD3, RD9 (robot-check), RD10's deterministic part (robot-size). Compared with #2189 (robot CAD research), the open parts are O12–O14 below.
- **Manufacturing:** AM1–AM7, IM1–IM8, CNC1–CNC8.
- **Drawings and exchange:** R11b DXF and R14 drawings.
- **AI collaboration:** A1–A8.
- **Robustness:** RB1–RB4.
- **GPU:** G1–G20.2, plus G21's display modes, curved silhouettes and isolate/fade.
- **Codex review fixes:** REVIEW-K1, M1, M2, M3 and G1.
- **A9, built but not accepted end to end:**
  - A9-1 to A9-6, A9-8, A9-9 and A9-10 are built.
  - A9-13 (the part drawing draws every instance) is built.
  - A9-7's native cross-part housing context is built.

## Phase 0: only what a green baseline needs, now

Owner (2026-10-23): fix Codex's leftovers only where the roadmap needs them, and go by our own roadmap
("codex 가 남긴 문제가 로드맵에 필요 없으면 안해도 돼, 너만의 로드맵으로 가"). Phase 0 is therefore only what stops the
suites from loading or passing, so that the roadmap's work can be verified. The rest is folded into Phase 1 items or
moved to Later.

| # | Problem | Lane | Exit |
|---|---|---|---|
| S1 | **done** O149. **Import cycle in cad-model.** Codex's `chat/outputs.ts` makes `commands` undefined at load. Whole test files fail: chat, decimate, frame, palette, palette-rank, sheet and cageEdit. | outer | Those files load and pass; public paths unchanged |
| S2 | **done** O150, O153. **Rows rule (b) fixtures.** The tests and the cad-cli/cad-mcp paths still pass agent-written rows, which rule (b) refuses. | outer | Fixtures load rows through person files; raw `rows` still refused; rule unchanged. The P2 merge-by-id fix rides along |
| S3 | **done** O154 (load_rows to `features`; additive). **The frozen v2 contract test.** Codex changed tools without updating `tools-v2.json`. | outer, then owner if breaking | Diff written: additive → update with a record; breaking → owner decides |
| S4 | **done** O151, O152. Failures still left after S1 and S2 | outer | Each fixed or assigned with a cause |
| S5 | Kernel failures from the window: frk-3's dropped oracle, stale S0 expectations, sweep dropping holes | kernel | **done**: D176 `b0e22e572`. The V notch moves to K1 |
| S6 | Studio lint | GPU | **done**: `59582a911` |
| S9 | Window and full browser flow at one commit | coordinator | **done** at `16eabdd8e` (2026-10-24, the new account's first window): builds, types and lint pass; model 1028/1028, studio 286/286, gpu 195/195, kernel 1677/1684 (6 skipped; the one failure is the known native-split test), RB no new finding (the three graze/helical TODOs as before), properties pass; full browser flow 287/287 on WebGPU. Not covered: the K16 patch (not committed yet), gpu `test:browser` after R7.3a batch 1, the flow on WebGL2. The new "last fully verified" commit. **Earlier, window at 9b4e90f3e (2026-10-24, after R5 and G12a):** builds, types, lint, model 993/993, studio 274/274, gpu 189/189, kernel 1648/1655 (only the native-split test, as before), RB and props pass; flow 276/280, failing 72 and 273 (G12a, with the GPU lane), 207 (test fixed in d2d62a94e, outer) and 252 (GPU, G12). S9 closes when a rerun of those four passes. Earlier, window at 218c5604a: builds, types, lint, model 964, studio 250, gpu 189, kernel 1640/1647 (the Node pin), RB no NEW, properties pass; flow 269/272 (144, 166 fixed after it in cf8ce8fd9; 258 on WebGPU with the GPU lane). Next window after O7b and D206 |

Moved out of Phase 0:
- the V notch precision regression goes to K1 (same quadrature file as FRk6);
- the model review's P3 findings are fixed when a roadmap item touches that code (the owner's no-nested-functions rule still applies there);
- REVIEW-A1 (recovery metadata before the blob write) goes to Later.

## Phase 1: the roadmap, per lane (starts as each lane's Phase 0 items close)

### Kernel lane: finish the frame track (FRk)

| # | Item | Exit |
|---|---|---|
| K1 | **done** D177 (the V notch ribbon), D178 (FRk6, 5.7 → 1.1 s), D179 (the ribbon on facet rims). **FRk6** ordered-trim speed. From Codex's unverified WIP `abb697f2`: hoist `stripSpanD1`'s closure and per-element callbacks first (owner rule). Includes the V notch mass regression (rel 1.42e-11 against 1e-11 since the import), in the same quadrature code. | Member5 mass at 1e-9, the reversal case, the general fallback and the frame regression set pass; the round-cornered table ≤ 2 s (one corner was 1.2–1.5 s, the table 5.7 s). D177 |
| K2 | kernel side **done** D182 (the notch builds; case files in conformance/frk/); the flow and the WebGPU black canvas are the GPU lane's. **FRk5 leftovers.** The notch screen/file flow, and the WebGPU failure Codex retained (with the GPU lane for the viewport part). | The notch made, saved and reopened in the app on both renderers |
| K3 | **done** D180 (88.6° → 21.6°). **FRk7** SubD display folds inside single B-spline faces (`surfaceTriangles`) | The pipe clamp's worst fold under 25° (88.6° now) |
| K4 | **done** D181. **FRk8a** the bearing housing's shoulder checked against the row's Da max, read from the housing's faces | A typed refusal when it doesn't fit |
| K5 | closed, not needed (D178 met the speed). **FRk8b's second half** (exact-trim integration), only if K1 still needs speed | — |
| K6 | **done** D183. **FRk9** acceptance by the agent: a welded table with gussets, caps and beads; a tapered-I portal; a bent-tube rail | `conformance/frk/accept-*` pass through v2 tools |

| K7 | **done** D184. The r6 sphere-intersect ȳ pin (D179's open item) against a closed form | Pin or kernel corrected, with a record |
| K8 | **done** D185 (55 → 15 s). Profile F5: the A9 shaft's cnc-turning manufacturability report takes about 50 s | The cause found; kernel fixes made in the kernel, cad-model causes routed to the outer lane |
| K9 | stopped by decision: D186, D187 built or typed; the rest recorded. The RB TODOs: the cylinder-box graze cases ("1 nm graze, wrong body"), then helical × helical | A correct body, or a typed refusal; never a wrong body |

### Outer lane: A9, brief → buyable, manufacturable product

| # | Item | Exit |
|---|---|---|
| O1 | **done** (the coordinator window at 218c5604a: cad-model 964/964 with every A9 test, studio 250/250). Verify A9-1, A9-2, A9-5/6 and A9-13, A9-4, A9-10/A9-8 in the full suites (Codex checked them only in focused runs) | Their tests pass in the Phase 0 window |
| O2 | **done** O175 flow step. **A9-11** the Studio download flow (CSV and outputs with their sources) | The flow step downloads, reopens and matches |
| O3 | **done** O158. **The A9 brief** fixture: the default shaft's key clashes with the 6204 (115 mm³) | The key or the bearing moved; the clearance map shows no clash |
| O4 | **waits on the owner** (a person-supplied rows file). **A9-7** linked bearing housing in the app: the GPU lane ports the UI (G-lane item below); the outer lane owns the model side | Linked-bearing success flow. **Needs a real person-supplied row/fit file from the owner**; never a generated one |
| O5 | **done** O159, O164, O165 (automated end to end; the owner's own acceptance with a real file still pending). **The A9 acceptance run** (`test/a9-acceptance.test.ts`, `conformance/a9`) | Brief → part, drawings, BOM, CSV, manufacturing outputs and purchase list, all through v2 tools; reopened identical |
| O5a | A9 findings from O159: F1 madeBodies (**done** O160; GPU display G-R6), F2 each hole drilled once (**done** O161), F3 the Ø47 bore as a circular pocket or a typed refusal, F4 a clearance hole in the cover (owner-free choice (b)) | Each with an oracle |
| O6 | Open items: aligned sections for off-axis features (**done** O178); a welded-fabrication DFM profile (A9-12, needs sourced rules; waits on the owner) | Decide, then build or close |

### GPU lane: viewer track G21–G25

| # | Item | Exit |
|---|---|---|
| G1 | **done** G-R2. **A9-7 UI**, ported from Codex's `8789e468`: Housing path, linked BOM refusal CSV, useAssembly faceTable. Its tests move to `apps/cad-studio/test`. | The no-row flow as before; linked success with the owner's file (O4) |
| G2 | **done** G-R3, G-R4, G-R5 (overcut; found and fixed the pocket offset, O157); flow step authored. **G23 CNC preview** from Codex's source `5c9f861f`: App, Viewport and renderer connections and tests | Material removal shown on both renderers; NOT FOR PRODUCTION kept |
| G3 | **done** G-R7, G-R13 (Display popover), G-R15 (both renderers). **G21 rest**: silhouettes, isolate/hide in every display mode, the WebGL2 instance display | Each mode on both renderers, picks unchanged |
| G4 | **done** G-R38 (steps 273, 274 on both renderers: the clearance states, the print layers, Save/Open). Earlier: made-bodies previews G-R6; G23 CNC and K2 on both renderers G-R14. **G22** the clearance map on screen (states overlap/contact/touching/designed/near/clear) and **G23** print layers: dual-renderer and Save/Open acceptance | Flow steps on WebGPU and WebGL2 |
| G5 | **done** G-R8, G-R9, G-R16. **G24** 3D PMI, using the outer lane's glyph builders | Annotations placed, picked and saved |
| G6 | **done** G-R10–G-R12, G-R17, G-R18 (access map on WebGPU as a GPU estimate; thickness stays on the CPU, owner rule: the CPU is authoritative; scan deviation G25c deferred). **G25** GPU analyses | Each analysis matches its CPU result within its stated tolerance |
| G7 | **done** G-R19, G-R20. Antialiased cap edges | — |

### Next items (2026-10-23)
| # | Lane | Item |
|---|---|---|
| O7 | outer | **done** O7a–O7e (fe2bb2d3b, and this merge: casting rules as rows, enclosure kept as the library's own, D2). **Owner decision 2026-10-23 (option 3): built-in tables → sample rows.** `FASTENER_SIZES` (app/fasteners.ts), the casting allowances and die-casting thresholds in `library/builtin/materials.json`, leave the code (the M2–M5 boss/insert variants in `enclosure.json` stay the library's own estimates — owner, 2026-10-23, option D2 — like tslot-20's M5 values, option C) and ship as example rows files, each row with its source. A table is used only once the person loads its file (rows rule (b)). Drawn shape follows the document's rows; a size with no row is a typed refusal. No schema bump and no legacy migration (owner, 2026-10-23: unreleased, so documents track the latest schema); O7a's fixtures are the equivalence oracle — with the sample rows loaded they give today's results. Other `STANDARD_TABLES` entries are reported before conversion; formulas (ISO 68-1 minor diameter) stay. Order: after O179 and R3, before R4 |
| O8 | outer | **done** O8 5bca3663a (merged a19a54ae2). After the kernel's separate-bodies checkpoint (K10b: lumps touching along a line or at a point become separate solids of one output, as a disjoint union already does): STL/3MF exports and print checks per lump (a position-welded mesh would read a line touch as non-manifold), a "lumps touch along a line or at a point" DFM flag (it brings back, as a warning on the result, the words of the old union refusal "The bodies only touch along an edge or a point", which D204 retires), and the lump count on the BOM row |
| O9 | outer | **done** O9 (engine lanes, sources on outputs, REVIEW-A1; the existing hand-written guards audited, moved in R4b). **Results tied to their revision** (from #2188 M2): every worker reply (a command's preview, placed-part bodies, drawing views, CAM/print/clearance) is checked against the document revision it was computed from before it is shown; a late reply never overwrites a newer state; drawings and exports carry their source revision. Includes REVIEW-A1 (recovery reports success before the mesh blob is stored) and the robot bundles (URDF, MJCF, SDF, USD: their source revision, input digest and the hand-set values, #2189 M4). After O7 |
| O10 | outer + GPU | **done** (step A one body key, B the rebuild report, C the Rebuild panel and query.rebuild; the kernel profile D228; the GPU frame costs G-R39). **Rebuild-cost diagnostics, read-only** (from #2188 M3): per feature, the time and the kernel calls of the last evaluation; dependency cycles and mate problems listed with their source revision; a studio panel and a v2 query action for the agent (the per-turn budget kept). The GPU lane adds per-body frame cost by display mode (**done** G-R39: trackFrameCost/frameCosts). Fix first: a placed copy's body key differs by producer (studio i1/b2, clearance worker i1/b1) — one key scheme for every producer. Diagnostics never change geometry or history. The baseline R4's caching is measured against. After O9 |
| O11 | outer | **done** (UI `0e628d44e`, guard on setDoc `e5de80943`; K vs F open with the owner) — **Model and agent side done** (`9d4b22dc0`, `5deea84b5`: inputs, bindings, variantOf from the one master, A → B → A equal to fresh evaluations byte for byte, INPUT_* refusals, assembly.inputs/variants with their gates, 23,446 of 25,000 per turn); the UI after G12b. **Assembly-level variability** (from #2188 M1): a few named top-level inputs (name, type, unit, range, default) bound explicitly to dimensions, feature suppression, component choice and mates; variants regenerated from the one master and still editable; full regeneration the correctness oracle. Grows today's part-level `configurations`. After R4 |
| K12 | kernel | **done** (D235–D239): fuzz 25, 74, 110, 119 and 170 build; 51 built already; 85 a correct refusal (D205); the nudge findings recorded, open; fingerprint b6e18fab. D240 measured the opening time (report only) |
| K13 | kernel | **done** (D242–D244; pure speed, fingerprint b6e18fab unchanged): open time in Node, frames 13.2 → 10.4 s, spring 4.1 → 3.2 s, worm pair 2.7 → 1.9 s, A9 5.4 → 4.2 s. What stays: the spring's own mesh (1.2 s), the quadrature's tessellation (O18 removes it at open), the Boolean's other stages; a shared mesh/mass tessellation cache is a later proposal |
| K14 | kernel | **done** (D245–D254, stopped at the fix budget): the four seeds without findings (a WRONG and four INVALIDs fixed); the fuzz's APPROX status for an honest tessellated bound; seven causes fixed; refusals 18/13/11/13 on seeds 25/26/23/24; fingerprint cf100676. The open robust refusals are K15 |
| K15 | kernel | **done** (D257–D265): 25#62, 26#115, 24#185, 26#184, 26#47, 26#79, 25#170, s2#112 and 24#97 build; a turned-over wrapping face is now refused (D263); the fillet's [RADIUS_EXCEEDS_FACE] (D264); refusals 54 → 45 over the four seeds, no findings; fingerprint 6fe8417d. Open: 25#49 (K16), 26#34, 25#190 and near-degenerate/exact-contact classes |
| K16 | kernel | **done** (D260–D276, closing record `ca9c6b0c4`): slice(1) landed; the commutativity check (D271) and its six fixed (D273–D275); fuzz refusals 45 → 38, no findings; fingerprint dbc1ad33 (869); open: 24:125 (one-sided), 23:114's root (now refused at its non-manifold intermediate), 23:9, B ∪ B, K15's list. **The Boolean features' self-union** (D260): the first tool part is united with itself since a306e499d; without it Booleans 443 → 241 and corpus time −15 to −20 %, but r12c-fits (a nominal a few ulps past Ø50), r12-2's flat DXF (49 vs 52 entities) and r10-b (a pinned refusal now building) lean on the extra rebuild. Explain each, then land slice(1). **Checkpoint 2 in** (`6374a7351`, T2): slice(1) D268, D269, D270; kernel 1680/1687 (only native-split), RB no new, fuzz refusals 45 → 39 (11/9/10/9), fingerprint 4e3603b7 (869 cases; 23:13 now builds, 23:9 near-degenerate now refused, open). Left: the commutativity RB property, the closing record. **Commutativity check in** (`d582529b0`, D271, `pnpm rb:commute`): 2456 union/intersection nodes, 2412 the same, 37 refused both ways, 0 differ; 7 TODO: 24:125 one-sided, 24:165's root mixed, and 5 intermediates invalid in both orders without a refusal (23:114, 23:170, 24:51, 24:96, 24:165 r.a). The 5 are fixed before K16 closes (coordinator, 2026-10-24: a silent-invalid class) |
| O12 | outer | **Model, exports and agent side done** (`7bbf31c67`; MuJoCo 6.7e-16 m, usd-core 6.1e-17, check_urdf parses; SDF only by our reader); the sliders' and viewport's frames after G12b. **Tool and sensor frames** (#2189 M1): named frames on a link with a local pose (a TCP, a camera), kept apart from the joints; FK, IK, the workspace map and the sliders report the tool frame; URDF, MJCF, SDF and USD write each as a fixed child link; a frame on a missing or stale link is refused, typed. After O11 |
| O13 | coordinator | **done** (2026-10-23, owner's go-ahead for the downloads): MuJoCo 3.3.0 already closed RM4's and RM5's external read (O38, worst 1.1e-16 and 2.2e-16); now urdfdom 6.0.2 (`brew install urdfdom`) `check_urdf` parses urdf-2r, urdf-gears and arm-6r (cad-cli urdf) with the expected link trees, and MuJoCo's urdf-oracle on urdf-2r copied to another folder still passes (1.1e-16: the mesh paths are relative). **External read-back of the robot exports** (#2189 M4) |
| O14 | outer | **Model and agent side done** (`61b020f52`: the `mounts` row kind with MOUNT_LIMITS, the `mount` command, MOUNT_* refusals; samples: two NSK units sourced, NEMA 17/23 estimates pending their PDFs); the UI after G12b. **Mounts from datasheet rows** (#2189 M3): servo, motor and bearing mount profiles whose hole spacing, pilot, shaft height and clearance come from a person-supplied datasheet rows file (rows rule b, each value with its source); bound to the link through O11's named inputs. After O12 |
| O15 | outer | **deferred by the owner** (2026-10-23: "O15 는 다음에 하고 다른 것 부터 하자"; the tool and script are committed and inert, the dry run passed, the live runs not made — the CLI account was at its weekly limit). **RD10's L3 run** (owner's go-ahead 2026-10-23): the protocol of O46's S0 — a live model (the studio chat's default, claude-opus-5-5, through `claude -p` and cad-mcp) given the arm-3r sizing brief with a `robot_check` chat tool added for that run only (the per-turn budget kept); at least 3 runs; success only by a fresh harness run, never the model's word; rounds and margins compared with the scripted sizer's trace. Budget: at most US$25 of reported usage in all, a run stopped past US$8 or the turn cap. Comes back when the owner says |
| W0 | coordinator | **done** 736851196: the old documentation site removed; a new VitePress skeleton for the CAD stack (sidebar.mjs, page outlines, check:docs). Owner, 2026-10-23: "전부다 지우고 문서사이트를 다시 시작해도 좋아" |
| W1 | docs | **in progress** — all 32 pages written (`9d268fcd0`, none "Being written"; 16 samples pass; refusal codes and .bcad fields generated and checked). Left: the features gaps (SubD cage, sheet flat pattern, image tracing) and the studio shots after G12. the docs lane (its own session, branch claude/fervent-hopper-d9c6b2, worktree fervent-hopper-d9c6b2) writes every page from the code as it is: introduction and concepts → studio guide → AI agent → packages → reference → screenshots; code samples from running tests; "Being written" count to 0 |
| G11 | GPU | **done** (G-R42, `09ef149d4`, notes/g11-scene-profile.md): 11 heavy scenes on WebGPU and WebGL2 hold 60 Hz (p95 16.7 ms), main-thread 2.2–3.9 ms, WebGPU GPU ≤ 5.0 ms, so at least 3× headroom; no culling/LOD/instancing work. Was: **Measure, then decide** (the Later list's "after G25, when need is measured"): with O10's frame costs and the bench, profile the heaviest real scenes (the A9 assembly, the 120-bracket pattern, the large gallery parts) on both renderers; report where frame time goes; propose occlusion culling, LOD or other work only where a measured budget is missed |
| G12 | GPU | **done** (G12a–G12f, `9c6fd1f13`: three columns, the right dock, one preview mode, the shell and every panel on shadcn/ui + Tailwind v4; full flow 286/286 on both renderers). Was: **In progress:** G12a (three columns, `4220de61c`) and G12b (the right dock on shadcn/ui + Tailwind v4, `b51113a98`; flow 279/280 on both renderers) merged; G12c (preview mode, compact text, collapsible headers) and G12d (layout flow step, lint, R1 bench) next. **Studio layout, owner 2026-10-23**; from G12b on, built on shadcn/ui + Tailwind v4 (owner 2026-10-24: "shadcn + Tailwind v4"; Radix primitives, Resizable for the chat and dock widths, the existing dark tokens mapped to shadcn's variables, the generated cad icons kept) ("이 방향으로 해줘"; the floating previews overlapped the BOM panel, text-heavy, not tidy): one right-hand dock holding the inspector, BOM, Rebuild and the previews/analysis as tabs or collapsible sections, nothing floating over another panel, long content scrolling inside the dock; the previews (CNC, print layers, clearance, analysis maps) as one mode chosen at a time with only its settings shown; a one-line status and colour-chip legend by default, the long notes behind "Details" or an (i); a flow check that no two panels intersect at 1440/1280/1024/800. Before G11's follow-ups |
| G12f | GPU | **done** (`b5accd77c`, `9c6fd1f13`) — **The shell onto shadcn** (after G12e): the top bar, the Tools rail (ToolButton, ToolsTray), the view bar, the history bar, the section bar, the timeline, Tooltip, the context menu, the command palette, the shortcut help and the command HUD, on src/components/ui (Radix Tooltip, DropdownMenu/ContextMenu, Command where they fit); labels kept or reported old → new; R1 bench rows rerun |
| R1d | GPU | **done** (G-R49, `c30bbaece`: HUD typing 4 keys App 10 → 1, placing 30 moves 76 → 16, section drag 121 → 61) — **HUD typing and placing without App renders** (found in G12f, from before it): 4 HUD keystrokes render App 10 times, 30 pointer moves while placing render it 114 times; the HUD values and the placing pointer move into a store (like poseStore) read by SceneViewport and the HUD, the preview evaluation off that store; App renders at most once per evaluated result. After G12f, before G13 |
| G13 | GPU | **done** (G-R50, `26eb57498`; MuJoCo TCP at zero and after a quarter turn; App renders unchanged per pose) — **Robot frames in the viewport** (O12's UI, after G12d): a `frames` prop on Viewport.tsx drawn as small RGB triads with a name label, fed from poseStore inside the viewport (no App re-render per pose, R1c), data from the outer lane's `framePoses`; a flow check of the arm-6r TCP triad at the zero pose and after a quarter turn |
| O16 | outer | **done** (`e5de80943`; every panel on shadcn, the last batch included) — **Panels done** (Library, BOM, Parameters, drawing settings, Joints, Mates, Instance, Rebuild, References, Skeleton, Cage, Direct, Sketch, Render, Variants); last batch after O18: BriefPanel, DraftsPanel, SpecifyPanel, MeshRepairPanel, CutListDialog, FlatPatternDialog, MapLegend. The dock's panel contents (with G12), moved panel by panel onto G12's shadcn components (owner 2026-10-24): the BOM table's columns at the dock's width (no wrapped item names), the panels' long texts moved into "Details", one text style for status, limits and legends across src/ui |
| O17 | outer | **done** (`54d187fef`, `5641e7edb`): the chat on useChat through StudioTransport, shadcn-style messages, tools and linked proposal cards; scripted turns through createChat (flow steps 61–63); O17c's collapsed Thinking line, **unverified against the live CLI** until the owner allows one live turn; deps ai 7.0.137, @ai-sdk/react 4.0.140, @shadcn/helpers 0.2.0, zod 4.6.5, undici pinned 7.30.0. **Chat on the AI SDK, owner 2026-10-24** ("shadcn 쓰면 … ai 채팅도 쉽게 붙일 수 있어", ui.shadcn.com/docs/helpers/ai-sdk). After G12b: the chat column's insides on `useChat` (`ai`, `@ai-sdk/react`) with a client-side `ChatTransport` over the existing `/api/chat/turn` SSE. The chat server's protocol stays, because cad-mcp, the A/B harness and robotL3 use it. Messages, tool calls and reasoning render with shadcn's AI components; proposals become tool parts with approval (accept/reject, the risk badge); conflicts are re-proposed as now (A7). The flow's scripted chat steps and the docs' scripted shots move to `@shadcn/helpers/ai-sdk` `createChat()` transports, offline and deterministic. Labels kept or reported old → new; refusals and autonomy unchanged |
| O18 | outer | **done** (`e5de80943`, design P: the part's masses pushed after its reply, readers show … until they land, patched by mass ref; an edit right after opening the spring answers in 0.1–0.4 s instead of ~2.1 s; placed parts keep inline masses) — **Mass on request** (measured by the outer lane, recorded under D240 in decisions-outer.md): the worker's reply spreads each body (`MeshSender.pack`), so a lazy getter would still run the quadrature at open; nothing shows mass until the inspector, BOM, mass panel or agent asks. After G12b: the wire leaves mass out and a `mass(bodyKey)` worker call fills the readers, made async. Saves the spring's 2.05 s and the worm pair's 0.61 s at open (D240). Values byte-identical when read |
| O19 | outer (+ kernel for cad's side) | **done** (the regression at 7c8c6c038 — flow 176, 183 — fixed in `fc3fde052`, merge dc4b196e3: a display edge or face carrying several kernel names isn't sent as expect; closed rims and merged faces get no kernel check until signatures per kernel name, a follow-up); (kernel `78a84d506` D277; outer merge 7c8c6c038: node.sigs → expect, the agent's accept re-matches one clear candidate or refuses with candidates, verifyOpened handles REFERENCE_MOVED). **Stored edge names checked against their signatures** (found by the API lane in R7.4b, finding 4): a sketch without `sideTags` (what commands and add_features write) names its walls by position, so a polygon vertex inserted upstream makes a fillet's stored `side1|side2` silently round another corner — measured: a square's (40,40) fillet moved to (40,0), in both cores. The studio's fillet node carries `sigs`, but evaluation never compares them (only the edit tool's rematch does). Exit: a typed refusal when a stored edge no longer matches its signature (never another edge), with the vertex-insert case as the test. **Kernel half done** (`78a84d506`, D277: `expect`, [REFERENCE_MOVED]; fingerprint byte-identical). **Design agreed (2026-10-24):** the check sits where names resolve, in the kernel — fillet/chamfer/shell/draft take an optional `expect` (the stored signature, rematch.ts's shape and tolerances) and refuse typed (`[REFERENCE_MOVED]`-like) on a mismatch; kernel half right after K16 closes (it fixes the field shape in a D record), then outer wires part.ts (node.sigs → expect), the held/verifyReferences path and the tests |
| O20 | outer | **done** (`650c75873`, merge 730ab70ea: givenValues on the agent's and facade's path; split's and mirror's at, a tapped hole's Ø, a fastener's length — now refused when not offered; the derive list pinned). **The agent's given values kept through a command's derive** (found by the API lane, 2026-10-24): run_command split with `{axis: 'x', at: 2}` on a 10 mm box builds at 5 (the middle), no warning — split's `derive` in app/commands.ts moves `at` whenever the axis is among the changed keys, and runTool passes every given key as changed. Exit: a given value is never replaced (split and every other command with a derive audited), each with an agent-path test |
| O21 | outer | **done** (merge dc4b196e3: engine/parameters.ts, set_parameters as features.parameters, 23,682 of 25,000 per turn). **The agent can make and set parameters** (found by the API lane in R7.4d's design): no v2 action creates or sets a named parameter today (only raw `{ parameter }` nodes and O11's assembly inputs); a `set_parameters`-style action (create, set, bind through editFields' rule), the per-turn budget kept; plus a core `withParameters(doc, edits) → doc` that the tool and the facade both call. After R7.7a |
| K17 | kernel | **A suppressed flag in the part document** (R7.4d): the studio's History toggle has `suppressed: true`, the kernel document has none, so the kernel facade refuses suppression (UNAVAILABLE). Low priority, after R7.3 |
| O22 | outer | **done** (`111b2b8d9`, merge b15abb336: gear tooth zones and planar loop pins as designed contact, a real crash still reported; LOOP_OPEN for looped robots; every RS1 demo motion clear). **Designed contact isn't a collision in check path** (found by the docs lane in RS4): the samples' demo motions sweep clear for arm-2r, scara, arm-6r and pan-tilt, but gripper and gear-joint (meshing gears) and four-bar (the loop-closure pin) report contact from s 0, because the sweep skips only parent–child pairs; and gantry-ppp's ram really meets its X carriage (sample geometry). Exit: gear-meshed pairs and loop-closure pins treated as designed contact (as the clearance map's "designed"), a real crash between them still reported (tested); the gantry sample fixed; RS1's test requires every demo motion to pass check_path clear |
| O23 | outer | **Saved motions' `default` limits converted** (found by the docs lane): timedPathOf/motionOf convert per-joint limits deg↔rad but `default` keeps k = 1, so the RS1 samples' demo motions (all on `default`) play ≈ 57× too fast; apply `default` per joint where used; tests: default ≡ per-joint duration, a default-limits round trip, a sample's duration pinned |
| O24 | outer (+ kernel where geometry is needed, GPU for the studio's pickers) | **(a)/(b)/(c) adopted; (d)/(e) incomplete.** The first (d) slice, fastened, is adopted in `69983467e`: connector origins and X/Z axes align, with 0 DoF. Existing Lock keeps its captured placement. Ball is also adopted in `d753cfc2f`: connector origins coincide with three rotational freedoms; bounded robot/UI/v2/save-read tests pass. Universal is adopted in `71f4ee9d6` with two rotational freedoms at coincident connector origins. Its robot decomposition and loops remain unsupported. Next, add cylindrical and the remaining kinds needed by RS7; limits and typed refusals are part of each kind. Fastened alone does not close RS7. The existing cam export refusal stays. **Joints and mates to commercial breadth** (owner, 2026-10-24: "관절,메이트 확장 넣어서 하자"). Today mates relate only flat faces, round faces and origin planes (coincident, distance, angle, concentric, tangent, lock), and the joint kind is read from the motion left free. Add, P1's needs first: (a) a slider-crank — a closed loop with a sliding joint — and a cam–follower relation; (b) mate connectors: a frame at any point, axis or vertex (an edge's midpoint, a hole's centre, a sketch point) to mate frames, as Onshape/Fusion do; (c) more references: edges, vertices, spherical and conical faces; (d) explicit joint kinds a person can pick (ball, universal, screw, pin-slot, planar, cylindrical), each with limits; (e) relations: rack–pinion (the parallel gripper), screw (turn → slide), gear across instances. Each with the agent's v2 actions (budget kept), URDF/MJCF where the format has it, and a refusal where it doesn't |
| RS6 | outer (core), GPU (playback), API (facade) | **Core, bounded API Motion facade and shared Studio motion adapters adopted (`930f74ae9` / `cda369b94`); actual React/RAF/browser and remaining closed-motion validation remain.** Close each sampled pose before path checks and playback. Motion.duration/poseAt/problems now use existing closure for supported loops and return public degree/mm driver inputs after checking preceding segment branches. Facade check/sweep/CCD and finite passive loop bounds retain typed LOOP_OPEN. Facade candidate and actual product selected26 tests and both types pass. Studio adapter candidate `6419a71de` adds Model31/Studio5 focused passes, both types and lint0; adopted production bytes match that candidate. Studio uses already closed native values for FK while recorded/saved waypoints stay driver-only. The exact new public `motionPlaybackAt` inventory entry is reviewed; all previous6604 entries remain. This is not actual React/RAF/browser, cross-store atomicity or RS7 acceptance. RS7 adds coupled loops with several drive inputs, stable branch selection, limits and typed refusal at unreachable or singular poses. Independent closed-loop playback, saved-path round trips and both renderers must pass before consumer completion. Unsupported loops keep their refusal |
| O25 | outer | **The agent can colour and finish bodies** (found by the AI evaluation, 2026-10-24): Codex runs on long prompts (the cathedral, a tractor) tried actions that don't exist (`appearance`, `color`) and wrote colours into part names instead ("black chevron tyre, yellow rim"); a v2 action that sets a body's appearance (a look-* preset, a colour, G15a's finish/clearcoat), the per-turn budget kept |
| O26 | outer | **Headroom in the per-turn tool budget**: the agent's tools list plus prompt is at about 24,130 of the owner's 25,000 characters, with O25 (appearance), CG6's version actions, CG5's drawing steps and O24 (b)–(e) still to add. Make room without breaking v2: move long hints behind `describe`, shorten repeated text, measure per group; target ≤ 21,000 before the next additions, so each addition reports its cost against real headroom |
| K10 | kernel | **done** D188–D196: RB5 fuzz harness; empty operands; six INVALID fixed; the KNOWN crescent; refusal triage |
| K10b | kernel | **done** D197–D210, D206 (fuzz s1 refusals 31 → 16, s2 29 → 14; INVALID 0, WRONG 0 on both; touching lumps are separate bodies). the 17 robust refusals of valid inputs (D197 on), then the 8 near-degenerate; separate lumps on exact contact as separate bodies |
| K11 | kernel | **done** D211 (turningOf 8.1 → 4.4 s; D1 calls 4.22 M → 1.40 M). F5's remainder (the turning report's first-derivative evaluations) |
| O5b | outer | **done** — A9 findings: F8 drawings (**done** O170–O174), F9 fasteners as bought lines (**done** O176), F10 base members in the BOM (**done** O169), F6/F7 (**done** O167/O168) |
| G8 | GPU | **done** G-R21: GPU contour for curved silhouettes, dirty-run block writes, clip flags kept; the two App findings moved to R1 |
| G9 | GPU | **done** G-R22: r16uint triangle key, 15.8 MiB at 1080p, 63.3 at 4K (key collision ~1/65 535 per pair, measured) |
| G10 | GPU | **done** G-R23: the full flow on WebGL2; analysis maps (thickness, draft, 3-axis access) and the mould's parting line and halves are WebGPU only, and WebGL2 says so |

### Robot samples and motion (owner, 2026-10-24)

The owner: "로봇 관련해서 좀 더 다양한 샘플, 예제를 만들어봐야하지 않아? 관절 움직임 같은거라던가?", then "로봇 샘플 확장(RS1–RS4)을 로드맵에 넣고 각 줄에 나눠서 진행해줘". The robot features (RM1–RM9, O12, G13) work, but only a few test fixtures exercise them, and a pose is shown one slider at a time.

| # | Lane | Item |
|---|---|---|
| RS1 | outer (+ GPU for the studio's sample menu) | **Samples done** (merge dc4b196e3: samples/robots, 8 robots with a demo motion each; the gripper on meshing gears, a parallel-jaw one a follow-up); the Samples list is GPU's. **Sample robots**: ready-to-open robot documents — a 2R planar arm, a SCARA, a 6R arm, a Cartesian gantry (PPP), a pan-tilt camera head (a sensor frame), a parallel gripper (two coupled fingers), a four-bar linkage (a closed loop) and a gear-driven joint; geometry and joints only (no standards rows: rule (b)). Each tested: its joint tree, FK at a few poses against a closed form, its URDF/MJCF read back by urdfdom/MuJoCo. The studio opens them from a **Samples** list (GPU, the shell) |
| RS2 | GPU (+ outer for a core interpolation function) | **done** (merges 553edb8a8, 21fa93073, 0832a8fd2: the Motion row, saved motions, the Samples list, WebM video of a motion and the Render timeline). **Joint motion playback**: waypoints played as motion over time (joint-space interpolation, the core function a pure `poseAt(doc, path, t)` from outer), play/pause, a time scrubber, loop, speed; a collision during playback marked on the bodies; no App re-render per frame (poseStore, as R1c/G13); flow steps on both renderers. Video export of the motion folds in here (the Later list's turntable/explode video). **Decided (2026-10-24):** motions are saved — `robot.motions?: Record<name, RobotPath>` (RobotPath { waypoints, profile?, limits? }, timed by ccd's timePath like Check path), the session waypoints are the unsaved draft with "Save as motion"; the shown pose and play state stay UI-only (no undo, not stored); core `poseAt(tree, path, t)`, `pathDuration`, `checkPath` (outer); RS3's set_pose/play return data the studio previews, waypoint/check_path work on robot.motions; the Motion row in the Joints card, the contact tint from toi, WebM video as checkpoint 2 (GPU) |
| RS3 | outer | **Design approved** (robot/verbs.ts: RobotView built once, sync verbs the tools and the facade share, byte-identical replies; set_pose, waypoint, check_path, play in degrees and mm; steps (a) verbs, (b) actions). **The agent moves the robot**: chat can set a joint, record a waypoint, run check path and play the path; first audit what the v2 actions already do, add only what's missing; the per-turn budget kept |
| RS4 | docs | **Robot docs examples**: the robots page per sample (its joints, a pose, an export), shots of the samples and of playback; samples run under test:samples |
| RS5 | API | **Part 1 done** (merge 183c8e51d: joints, setJoints, pose, path check, inertia, gravity, the four exports; byte-equal to the tools on arm-6r; replies still echo the tools' radians, for R7.7); poseAt and motions after RS2. **The robot on the facade**: assembly(...).robot() — joints(), pose(values) → frame and link poses, path(waypoints).check(), poseAt(t), exports — over the core functions, byte-equal to the tools; feeds RS4's samples |
| RS7 | outer (mechanism), kernel (blade geometry), GPU (controls/playback), API and drawings/docs | **Added and authorized, 2026-10-25. Rotor head and swashplate integration example.** Build in the stages below. CG1.1 bounded core and O24(d)-1 fastened are adopted; bounded ball and Universal are adopted in `d753cfc2f` / `71f4ee9d6`; Cylindrical and robot-ready Universal remain. The integrated example is not implemented or accepted yet |

### Real products (owner, 2026-10-24)

The owner: "지금은 각각의 기능별 잘 돌아가는지 샘플들만 만들었는데, 실제로 좀 제대로된 제품을 모델링 해봐야하지 않을까? 자동차 엔진? 전자 부품? 거대한 기계, 로봇 등등?", then "P1–P4를 엔진부터 차례로 로드맵에 넣고 진행해줘. 막히는 것은 로드맵 항목으로 만들어줘."

Each product is built end to end — parts, assembly, mates and motion, mass, interference, drawings, BOM and manufacturing outputs — as a deterministic, rerunnable build (`examples/products/<id>/`, written on the facade where it reaches, the core functions where it doesn't; the documents it writes open in the studio). Every point where the build can't go on, or goes on only by a workaround, becomes its own roadmap item below (PG-n), routed to its owner lane; the product resumes when it's fixed. Standard parts' sizes come only from person-supplied rows (rule b): the shipped sample rows where they fit, otherwise the gap is listed and the owner asked. PCB/ECAD stays deferred (owner, 2026-10-19): P2's board is a sized placeholder. A live-agent run of the same briefs (brief → product) comes after, with the owner's token budget.

| # | Lane | Product | What it tests |
|---|---|---|---|
| P1 | API (builds), gaps to their owners | **Milestone 2 done** (merge fd850e907: assembled, the slider-crank cycle closed, a certified sweep at 0.239 mm least clearance, 5.13 kg, balance 0.628; checkEngine(doc) and brief.md ready for P1-L3; run 120 s end to end); milestone 3 outputs adopted (`db363291b54914827c0c0579089dc387353b0723`). These are scripted checkpoints; remaining product gaps and live-agent acceptance stay separate. **Milestone 1 done** (merge of `7f58931d9`: 21 parts, 9.2 s); milestone 2 was subsequently completed as recorded above. **A single-cylinder four-stroke engine**: crankshaft (with counterweights), connecting rod, piston with rings and pin, finned cylinder block, head with valves and ports, camshaft, cam followers, crankcase halves, fasteners | complex solids (fin patterns, fillets, sweeps, shells), the slider-crank and the cam train as a mechanism (a closed loop, gear-timed cam 2:1), interference through a cycle, masses and balance, drawings, the BOM, CNC and casting reports |
| P2 | API, gaps to owners | **An electronics enclosure** (restored example A and PG12 C sources adopted; ten product checks still fail, so manufacturing is not accepted): a handheld device's two-part moulded housing with bosses, snap fits, ribs, a battery bay, connector openings from connector rows, a heat sink with fins, the board as a sized placeholder | thin walls, draft, moulding DFM, connector rows, fits between halves, an exploded assembly |
| P3 | API, gaps to owners | **A large machine**: a gantry CNC router — a welded frame, linear rails, carriages, a gantry, motor mounts from mount rows, ball screws, many fasteners (hundreds of parts) | scale (opening, evaluation and display time with hundreds of parts), frames and the cut list, mounts, the BOM at size, the drawing set |
| P4 | API (+ outer for sizing), gaps to owners | **A real 6-axis robot arm**: link castings, joint housings for strain-wave gearboxes, motor mounts, bearings, a cable path, a tool flange | robot-size and robot-check on real link masses, motion (RS2), URDF/MJCF read back, manufacturing outputs of each link |

| P1-L3 | outer (harness, the agent side), API (the brief and the oracle from P1's build) | **A live AI run of the engine brief** (owner, 2026-10-24: "P1(엔진) 스크립트 버전이 끝나면 실제 AI 실행을 해봐. 예산은 모두 합쳐 US$25 이하, 한 번에 US$8을 넘으면 멈춰."): after P1's scripted build is done, Codex (owner, 2026-10-24: "AI 실행하는건 codex 로 해줘도 돼"; `codex exec` 0.156.1 with cad-mcp as its MCP server), or the studio chat's default model through O15's harness gets the engine brief and works through the v2 tools only; success is judged by a fresh harness run against P1's own checks (parts, mechanism, masses, outputs), never the model's word; every place it fails or works around becomes a PG item; usage logged per run; on Codex no token cap (owner, 2026-10-24: "codex 는 토큰 상관 없이 쓸 수 있어"), so several runs are fine; **on Claude at most US$25 in all, a run stopped past US$8** |

Gaps found (PG-n, added as they're found):

| # | Lane | Gap | Found in |
|---|---|---|---|
| PG-1 | API | **done** (`f7f82af77`): a Boolean's tool callback with several verbs (fins patterned in the tool) refused BODY_AMBIGUOUS; StudioPart lacked gear, gearMesh, spring, fastener and loadRows | P1 parts |
| PG-2 | owner | Rows missing from the shipped samples: the spark plug's M14 × 1.25 thread, the main bearings (stand-ins: a plain plug hole, bushings marked as stand-ins in the BOM) — needs a person-supplied rows file | P1 parts |
| PG-3 | kernel (measure first) | The engine head (45 features: fins, dome, ports, seats, guides) evaluates in 5.0 s and the valve spring in 1.85 s; profile before P3's hundreds of parts | P1 parts |
| PG-4 | outer (O24 e) | A gear on a part locked to a shaft isn't coupled: gearCouplings reads only the joint child's own gears, silently (workaround: the gear as a body of the shaft part) | P1 assembly |
| PG-5 | outer (O24 a) | No cam–follower: a follower in a guide bore driven by a lobe's profile (lift as a function of cam angle) for pose and sweep, then the follower–valve push (workaround: followers locked on the base circle, left out of the sweep) | P1 assembly |
| PG-6 | outer | sweep_path checks display meshes (quality 8: chord 0.135 mm at r 28), so a 0.1 mm piston fit reads as contact at 0° (workaround: sweep at quality 24); the sweep needs a tolerance tied to the fits, or exact geometry near contact | P1 assembly |
| PG-7 | outer (O24 a) — **done** (`15bb4e98d`, merge 06dd90883) | A slider-crank loop (slides and chains in the loop) refused by closureOf ([NOT_ONE_LOOP], it takes three turning joints only); the API lane's check.ts closes it by damped Gauss–Newton on the loop's own mates (720° in 5° steps, residual 1e-10 mm), a reference to lift | P1 assembly |
| PG-8 | outer | The agent can't lock a part (add_mate writes no rel); the facade's lockDoc mirrors the studio's Lock and can move into assembly/edit.ts | P1 assembly |
| PG-11 | owner / API | Actual connector-row, placement, required-body and plug/cable keep-out decisions remain open. PG11 stays false and the recorded P2_CONNECTOR_ROWS_REQUIRED refusal remains. Shipped example bytes are not new owner input | P2 checkpoint `7a30ddcac` |
| PG-12 | API | Shipped M3 cap length5 exists. Exact C8eb native checks verified four bound screws, producer/document identity and independent geometry; bounded A/C source adopted (`db588717a`). Ten remaining product failures and PG11 still block manufacturing acceptance. No new M3 row is requested; original failures remain | Original `7a30ddcac`; native C8eb; source adoption `db588717a` |

### Photoreal rendering G15 (owner, 2026-10-24)

The owner: "우리가 만든 것에 대한 GPU 렌더링은 실제로 어느정도 까지 실사 렌더링이 되는거야? 만약에 엔진을 만들어서 보여주는거면 실제 엔진의 느낌이 나야하잖아", then "G15(재질 사실감, 조명·그림자, 점진 경로 추적, 후처리)를 로드맵에 넣고 RS2 다음에 GPU 줄이 진행해줘. 엔진 렌더를 인수 기준으로 해줘."

Today (the Render workspace, WebGPU): metallic/roughness materials with presets, colour textures, sun/point/spot lights, an environment map's blurred levels for ambient and reflection, one sun's hard shadow map, occlusion, ACES tone mapping, @shader materials, props, turntable, PNG export. Missing for a real product's look: surface detail, layered and anisotropic materials, soft and multiple shadows, inter-reflection and indirect light, a physically converged image, camera effects.

| # | Lane | Item |
|---|---|---|
| G15a | GPU | **Material realism**: procedural normal and roughness detail made in our own code (cast, sand-cast, machined, turned, brushed, knurled, bead-blasted), anisotropic metal, a clearcoat layer (painted parts), rubber, chrome, oil-film; presets combining them; no texture downloads |
| G15b | GPU | **Light and shadow**: a properly prefiltered environment (split-sum specular, irradiance), procedural studio environments (softboxes, a cyclorama), soft shadows (PCF/PCSS) for every shadowing light, contact shadows |
| G15c | GPU | **Progressive path tracing** for stills: a WebGPU compute path tracer over the scene's meshes (a BVH, the same materials as G15a), accumulating until stopped, with a denoiser of our own; Export image uses it when chosen; the raster view stays interactive |
| G15d | GPU | **d.1 done** (merge e52628ae9: AgX, grading, vignette, the POST section; +0.17 ms GPU at 2880×1800). **Post** (owner, 2026-10-24, to the GPU lane: "GPU 후처리 다음 작업들 올려줘도 좋을 것 같아"; today the output pass does SSAO, exposure + ACES, outlines, background, sRGB, 4× MSAA, OIT, shadow maps): **G15d.1** vignette, colour grading (neutral, warm studio, cool) and an AgX tone map beside ACES, in the output pass, a Post section in the Render panel; **G15d.2** bloom (half-resolution threshold, dual-filter chain, before tone mapping; Render only); **G15d.3** depth of field (circle of confusion from depth, click to focus, half-resolution gather; Render only); **G15d.4** temporal accumulation for a resting camera (measure first, optional). Each step a bench row; modelling unchanged (post off), the Render orbit ≤ 16.7 ms at 1440p |
| G15-accept | GPU + API | **Acceptance: the P1 engine rendered** — a still of the assembled engine (cast block and head with their fins, machined faces, a steel crank, a painted case) and a turntable, judged against real engine photos by the owner |

Order (agreed with the GPU lane, 2026-10-24): after RS2 — G15d.1, then G15a, G15b, G15d.2–3, G15c, G15d.4. The built-in look per material id (waiting on the owner) is decided inside G15a and put to the owner then.

### Toward commercial grade (2026-10-24; the owner's order: CG1, CG2, CG5, CG6 first)

The owner asked "상용 수준으로 갈려면 로드맵에 더 많이 추가해야하는 것들이 있어?". Compared with SolidWorks, Fusion and Onshape, by what the studio's own docs list today. The owner: "CG1·CG2(모델링), CG5(도면), CG6(파일 저장·버전)부터 로드맵 순서에 넣고 진행해줘." Those four are ordered (below); the rest wait. FEM/CAE and PCB were excluded by earlier decisions. The 2026-10-25 experiment scope update moves structural, thermal, fluid and coupled-physics work into long-term staged planning; PCB remains deferred. No new solver implementation or dependency is implied.

Order and owners: **CG1/CG2** — kernel (the geometry: loft with rails and non-parallel sections, boundary surfaces, variable/face fillets, draft from any direction and a parting line, rib, emboss and text, wrap, helical threads and helices, feature patterns, face move/delete/replace, thicken/offset/knit/trim/extend) right after the R7.3b + R7.7b window and before R7.3d; outer adds the studio commands and v2 actions per feature as the kernel lands it; GPU adds pickers where a new reference kind needs one. **CG5** (drawings) — the new drawings lane (session "CG5 도면 줄", branch claude/drawings-cg5, worktree cad-drawings-cg5, flow port 52791, decisions-drawings.md DR-n; it owns cad-model src/drawing/** and the Drawing workspace): DR-1 detail views (**done**, merge eea20c995) → DR-2 broken views (**done**, merge c5da2fa32) → DR-3 half and offset sections (**done**, merge 20085bd98) → DR-4 revolved and removed sections (**done**, merge `c8400355d`) → DR-5 title blocks and revision tables (**done**, native `4ec4053b9`) → DR-6 full GD&T (**partial**: DR-6a control characteristics/modifiers adopted at `c31386e9a`; face datums, targets and standalone/composite frames remain) → DR-7 ISO/ASME presets (style values only) and inch display → DR-8 drawing sets. **CG6** (storage and versions) — V1–V3, S1, S2 **done** (merge ad45714cc: the version log, compare, three-way merge; a project folder on disk or in the browser's private file system; the Project & versions card; Save and autosave into a project); S3 **done** (merge 1dd6254c9: branches and merge in the card, compare tint fallback, new parts detach from the project's file); S4 **done** (merge 93e70b1ba: placed parts linked to project files, changed ones offered through Revision waiting / Accept); agent version actions VA-1/VA-2 are also adopted (merge `df8761f1e`); sharing/comments and multi-user editing wait on the owner (a server, accounts, hosting); the docs lane writes "Projects and versions". The new data lane (session "CG6 데이터 줄", decisions-data.md DA-n, flow port 52891): a project folder on disk (File System Access, fallback), autosave, named versions with restore and compare, branches with typed merge conflicts; sharing/comments and multi-user later. Design first.

| # | Area | Gap |
|---|---|---|
| CG1 | Modelling | CG1.1 bounded polygon, circle/ellipse and homothetic mixed line/arc loft adopted (`a52d6c46b` / `da74a7fa9` / `33f47b8a4` / `b21910b43`); general curves and Studio/v2 adapters remain; CG1.2 bounded conic quadratic guide adopted (`b7b0f0e08`); mixed-profile guide and general rails remain for RS7; boundary surfaces; variable-radius and face fillets; draft along any pull direction and from a parting line; rib; emboss/deboss and text on faces; wrap; modelled (helical) threads beside cosmetic ones; helix and spiral curves |
| CG2 | Modelling | Feature patterns (a feature, not a body), patterns along a curve and fill patterns; move/delete/replace face on solids (direct editing); thicken and offset surfaces, knit, trim and extend (surface modelling) |
| CG3 | Sketch | Splines with handles, conics, sketch text, sketch blocks; dimension expressions (waiting on the owner) |
| CG4 | Assembly | Subassemblies (flexible), component patterns with stable occurrence references (RS7.4), assembly features (a cut across parts), a motion study (time-based drive with contacts and plots), large-assembly modes (P3 measures need) |
| CG5 | Drawings | Bounded DR-6b face datums adopted (`3a253b620`): explicit face/near, lost-face diagnosis, sheet/PMI and save/read. Native12/retained WebGL2 case and repaired/product types pass in their recorded scopes. DR-6 targets/scope/reorient/standalone/composite and broader GD&T remain; detail/broken/section views, title/revisions, ISO/ASME presets and inch drawings stay in their own items |
| CG6 | Data | Real file storage beyond the browser (a local folder or cloud), versions with branches and compare, sharing and comments, multi-user editing |
| CG7 | Exchange | STEP AP242 assemblies with PMI in and out, glTF/USDZ export for web and AR, Parasolid x_t (reading only, if the owner wants it) |
| CG8 | Manufacturing | Production CAM: toolpaths with a post-processor (G-code) beyond the preview's NOT FOR PRODUCTION; sheet-metal DXF nesting |
| CG9 | Product | Units beyond MMGS for display (inch), a Korean UI, onboarding/tutorials, a desktop build, accessibility |
| CG10 | Robustness | Healing of imported geometry; the kernel's open robust refusals (fuzz 38) toward zero; tolerant modelling |


### RS7: rotor head and swashplate (owner, 2026-10-25)

The owner asked to add the capabilities needed for the attached rotor-head image and develop them.
Use O24, RS6 and CG1/CG2/CG4/CG5 for the shared features. RS7 is their integration example.
The image gives a mechanism reference. It gives no dimensions, material data or load cases.
Start with a declared synthetic three-blade example. Record all chosen dimensions and units.
Do not treat the example as a copy of a known rotor or as a manufactured aircraft part.

| Stage | Work and owner | Completion condition |
|---|---|---|
| RS7.1 | Outer: explicit connectors and O24(d) joint kinds | Fastened first; then ball, universal and cylindrical as the chosen mechanism needs. Record each allowed DoF, frame, limit and refusal. Keep old Lock and Auto behavior. Use independent joint fixtures before the assembly |
| RS7.2 | Kernel: CG1 blade geometry; outer exposes each feature as it lands | CG1.1 supports exactly two affine-corresponding convex polygon sections in non-parallel planes; CG1.1b also supports non-affine convex polygon correspondence on parallel frames with identical axes and positive plane spacing. CG1.1c adds exact circles and loft-only inline ellipses on those parallel frames, with linear centres/radii and a canonical +X seam. CG1.1d adds corresponding line/arc contours under positive uniform in-plane scale and translation on identical parallel frames. General non-homothetic curves, nonparallel conics, more sections and Studio/v2 adapters remain. CG1.2 adds guide rails for a blade. Check section interpolation, closed B-rep, mass, bounds and stable names. Keep independent analytic solids and malformed-input cases. CG2 feature patterns remain a separate feature |
| RS7.3 | Outer: RS6 coupled loops; API/GPU: shared consumers | One assembly drives shaft azimuth, collective travel and two cyclic tilt inputs. Solve the pitch links and every blade together. Preserve the selected assembly branch through a complete turn and reversals. Do not pose blades separately to hide an open loop |
| RS7.4 | Outer and GPU: CG4 assembly reuse and motion study | Repeat blade/grip/link subassemblies with stable instance references. Flexible occurrences retain their own joint state. Show each blade pitch against azimuth, play/pause and scrub through the shared core. Keep the existing poseStore render boundary |
| RS7.5 | Coordinator with the lanes: integrated acceptance | Run the cases below at one immutable SHA, then Save/Open and replay the same stored assembly through Studio, facade and v2 actions. Check WebGPU and WebGL2. Report actual coverage and typed refusals separately |
| RS7.6 | Drawings and API: existing CG5/output path | Produce assembly and part views, BOM, exploded view and required fit/datum annotations from the same document. Use declared sample data. Real bought-part rows and manufacturing acceptance keep the existing provenance gates |

The first CG1.1 core checkpoint is adopted from `2b720537a` by merge `a52d6c46b`. Its native checks
passed: build, package types, four-file lint, 45 tests (14 in the new file and 31 existing), and
Model/Studio consumer type checks. The first `fd625c07b` build failure is preserved. These are focused
checks; no new whole-kernel or browser qualification is claimed. O24(d)-1 is adopted in `69983467e`. After the one-line recorder fix, the actual merged product passed Model64 and Studio10 focused tests, both type checks and docs checks. The original Studio8PASS/2FAIL and its source remain preserved. These are native/component-recorder checks, not a real-browser qualification. The first merged docs check failed because the generated VALUE-code folder list lacked `assembly`; refreshing that generated line resolved the drift without changing runtime code.
P2 G/B and bounded A/C example sources are adopted. The exact C PG12 positive checks do not clear the ten remaining manufacturing checks or PG11. This general work is not replaced by RS7.
CG1.1b is adopted from `b8ce8a7f6` by merge `da74a7fa9`. Its exact-SHA focused native window passed 49 tests (18 oriented-loft and 31 existing), fresh kernel build, package types and three changed-file lint. All 405 kernel source files and 810 emitted files were checked. The adopted kernel source tree equals that tested source; product build artifacts were not rebuilt. Unchanged public type shape did not require duplicate consumer type checks. Curved profiles, guide rails, multisection oriented loft and Studio/v2 adapters remain.
CG1.1c is adopted from `736b4cd04` by merge `33f47b8a4`. Exact candidate checks passed: fresh kernel build, package types, four-file lint, 62 tests (13 new conic cases), and both candidate consumer types. The adopted kernel source equals the tested 406-file source; 812 candidate emitted files were verified. Both actual product Model/Studio consumer type checks also pass after this public input extension. Product dist and whole/browser flows were not rebuilt or rerun. Circle/ellipse side interpolation, seam, direction, typed negatives and document JSON Save/Read passed in the focused native window. Guide rails, general non-homothetic arcs, nonparallel conics and oriented multisection/smooth loft remain.
RS6 bounded Motion facade is adopted from `1b2b86032` (production source `c7d0c900c`) by merge `930f74ae9`. Candidate selected26 tests, both consumer types and five-file lint pass. The actual product with its newer Kernel also passes selected26 and both types. Original c7d0 slider-selector25PASS/1FAIL remains; repair selects the authored bore prismatic component through its dummy link with exact identity assertions. These are native geometry/path and type checks, not Studio/browser, full compiler graph, passive-bound or collision certification. The first merged docs check failed on generated LOOP_OPEN documentation; the existing generator refreshed that single row for the remaining sweep/CCD refusal and the new robot call site. Raw failure logs remain.
Source work can proceed in separate lanes. Builds, tests and browser runs use one runtime writer.
Use focused regressions for each feature. Run a full integration window when the required checkpoints are ready.
CG1/CG2 remain ahead of R7.3d. A stage is complete only after its own code and required evidence are adopted.

Acceptance cases:

- At neutral cyclic, collective travel changes all three blade pitches with the declared symmetry.
- At fixed collective, the two cyclic axes give the declared sign and phase of pitch over shaft azimuth.
  Use an independent geometric oracle for the actual linkage. A small-angle sinusoid is only a labelled limit case.
- Check a complete 0–360 degree turn, seam continuity, reverse playback, input extrema and repeated poses.
  Check all closure residuals with the existing tolerance policy. Refuse unreachable, over-limit or singular input.
- Keep designed bearing/hinge contact separate from an actual link or blade collision. A sampled clear path
  does not prove continuous clearance unless the existing path checker supplies that proof.
- Save/Open preserves geometry, frames, references, joint kinds, limits, drive inputs and motion. Check
  stale/deleted references and edits with atomic typed refusal; no silent replacement or independent blade fallback.
- Keep geometric/kinematic acceptance separate from fatigue, strength, aerodynamics and airworthiness.
  Those physical predictions require their own future solver profiles and validation under the experiment track; they are not RS7 acceptance evidence. Export a supported joint exactly, or return its existing typed refusal.


## Phase R: refactoring, once the current items close (owner, 2026-10-23)

The owner asked for one refactoring pass when the features are reasonably complete: code that is only laid out flat is
hard to find later, similar logic is likely duplicated, and UI code concentrated in one component hurts rendering.
It starts per lane when that lane's current items close (K10b/K11, O6, G8–G10) and after a green coordinator window.

Measured at 64df1c081 (lines): `App.tsx` 2905 with 110 `useState` and 252 hooks in one component; `Viewport.tsx` 1382;
`renderer.ts` 1172; `gpuRenderer.ts` 1081; cad-model `chat/tools.ts` 1698; gpu `viewer/viewer.ts` 2272; kernel
`part-model.ts` 4480.

R0 (the survey) is **done**: `notes/refactor-survey-2026-10-23.md` has the evidence, file:line, for every step below.
Order inside a lane is lowest risk first: duplicate copies, then hot-path allocations, then splits of big files, then folder moves.

| # | Lane | Item |
|---|---|---|
| R1 | GPU | **done** G-R24–G-R34 (LOADED): pick 129 → 47 ms, ghosted orbit 19.6 → 2.7, pose 23.4 → 4.0, explode 27.8 → 8.7, section drag 30.8 → 5.9; per-frame pose, explode and section in an external store; on WebGPU the exact section follows the drag's release. The studio's re-renders. `Viewport.tsx`: the per-frame `setTick` (449) re-renders the whole viewport. Move the projected overlay into a child that owns the tick; give the print-mode props stable identities; build the `viewState` Map only when `transforms` changes; cache the view-projection in studio `camera.ts` `project`; wrap Viewport in `memo` with stable App callbacks. `App.tsx` (2905 lines, 110 `useState`): state into domain hooks/contexts, so each panel subscribes only to its slice. First targets from G8: pick 121–151 ms (budget 90; 63 ms in the outliner's 120 rows) and the ghosted orbit re-rendering every step. Render counts before and after on the same flow |
| R2 | GPU | **done** G-R29 (per-frame allocations), G-R35 (displayPolicy.ts), G-R36 (shaders/ and scene.ts split), G-R37 (gpu folders). Per-frame allocations in the viewer and both renderers (dynamic-offset arrays, `packFrame`/`packOutput` reuse, `pipelineKey` cached on the mesh, closures and `[a,b]` arrays, `JSON.stringify` keys); then one studio display-policy module shared by `renderer.ts` and `gpuRenderer.ts` (theme, mode factors, dash, accent, face/edge state, instance sharing and matrix, bounds); then `viewer.ts`/`shaders.ts` split behind the facade; then the 98 top-level gpu files into folders (deep `dist/` test paths fixed in the same commit) |
| R3 | outer | **done** R3a–R3e (tools.ts 1,699 → 236 lines; the tools list and prompt byte-identical throughout). `chat/tools.ts` → `chat/part/*` + `toolKit` + `toolDefinitions` (plan approved, R3a–R3e), with the shared patterns the survey found; the tools list and prompt byte-identical |
| R6 | GPU | **done** G-R40: 65 gpu-scene flows kept and green through examples/gpu-scene/run-flows.mjs, 13 retired (missing research inputs). Was: the examples/gpu-scene flows fail before R2d's move too (some can't find packages/barocss-cad/src/types.js, others assert a git-diff file list against an old base). Triage them: still worth keeping and fix, or retire with a record |
| R4 | outer | **done** — batches A–D merged (`4a6b4f46f`, `c4e88e070`, `7b47c27dd`, `0e339b9f6`): the R4.0 fingerprint byte-identical at every batch; util/, analysis/, bom/, engine/schema/, engine/placement, evaluateTree, one material registry, editRows, robot/eigen; placed-output snapshots kept per copy (6R arm stepFor 131 → 3 ms); engine/ imports nothing from chat/. Rule (from #2188 M1): every cache or incremental path is checked against a full re-evaluation on the same fixtures, and where the dependencies are not known it re-evaluates in full or refuses, never skips on a guess. cad-model duplicates: util/ (round, guards, units, nextFreeId), one `boundsOf`, one `bodyMass`, one material registry, generic `editRows`, `engine/placement.ts` (fixes engine → assembly), one instance-evaluation helper, the kernel's `symmetricEigen3`; then `evaluate.ts` (notes split, evaluateDoc/evaluatePart merged, `placedOutputs` and frame geometry computed once); then folder moves with `export *` shims (analysis/, BOM out of team/, document-schema types out of chat/, rb9 out of src) |
| R4b | outer | **Guards done** (`2b287478c`; useCageEditor, section, bearing edit, placed parts, proposal diff, mould, the drawing sheet on O9 lanes; App's command preview and useAssembly's readFaces kept, recorded why); the shared panel pieces and the `DrawingWorkspace` split go with O16 onto shadcn. Was: `src/ui`: shared panel pieces; `DrawingWorkspace` split; the six hand-written stale-reply guards (App section/bearing/placed/preview/proposalDiff/mould, useCageEditor, useAssembly, useDrawingSheet, DrawingWorkspace) moved onto O9's engine lanes, one caller per checkpoint, behaviour unchanged |
| R5 | kernel | **done** (D212–D233; R5.4 folders in four batches, D229–D231 and D233; the fingerprint script committed as D232; 855 cases byte-identical at every batch) — R5.1, R5.2, R5.3 done (D212–D227: copies gathered, hot-path allocations out, part-model.ts 4443 → 3627 lines; the 855-case fingerprint byte-identical at every batch); R5.4 (folders) batches 1–3 done (D229–D231); batch 4 next. Exact copies first (vec3, Gauss–Legendre, `guardKnots`/`mapParameter`, `same`, the perpendicular frame, checked arithmetic); hot-path allocations (`rolling-ball` station solvers, `brep-mass-quadrature` nearest-4, `surface-intersection` all-pairs → the existing BVH, tessellate refinement); `part-model.ts` `operation()` split by family, then the other top-5 files; folders (part-model-only families first; modeling, sketch and planar-solids last, because of the 20 trap tests); the convex-planar templates as one factory; last, the admission boilerplate behind a budget object |
| R7 | all (the facade: API lane, own session, branch claude/api-lane-2026-10-24) | **API consistency and an object facade** (owner 2026-10-24: "겉 api 는 객체 형태로"). The core stays data + functions: JSON documents, `verb(doc, options) → result`, classes only for stateful resources (gpu Viewer, caches, editors), one typed error shape `{ code, message, where }` across cad, cad-model and gpu (cad's 163 per-module Error classes and the bracketed strings folded in). Over it, an immutable object facade in each package (owner 2026-10-24, "cad-model 만 api 가 있는거야? … 제대로 해줘"): `@barocss/cad/api` (a kernel part over CadPartDocument/evaluateCadPart, replacing createCadModel), `@barocss/cad-model/api` (the same verbs plus the studio layer: materials, rows, assemblies, variants) and `@barocss/gpu/api` (an immutable `scene()` whose `.data` is JSON; Viewer stays the stateful object and shows it), one shared selector set and one BarocssError, meshes passed by structural match with no package importing another; for people and the docs (references: replicad for TS ergonomics and the sketcher, build123d for result-as-data, selectors and Plane/Location, Manifold for immutability, FeatureScript for stable queries), each method adding a feature node and calling the core, `.doc` always the JSON; the agent stays on the JSON tools. Steps: R7.1 the public API inventory (docs lane, generated), R7.2 the conventions doc (coordinator), R7.3 the core (errors, cad's result methods to functions; fingerprint byte-identical), R7.4 the part facade with typed selectors, R7.5 the assembly facade, R7.5b the gpu facade (scene() and its display; `.meshes()` as plain `{ key, positions, normals, indices }` matching gpu's GeometryInput, no conversion needed: the Viewer is already Z-up and the packets' `right-handed-y-up` tag is a label nothing acts on, per the GPU lane on 2026-10-24; R7.3 renames the tag to say what it means), R7.6 the docs samples on the facade |
| R7.1 | docs | **done** (`26d4730d7`): the public API inventory, `apps/library-docs/scripts/api-inventory.mjs` |
| R7.2 | coordinator | **done**, owner-approved 2026-10-24 (`e5e5bdc53`): `handover/api-conventions.md` §1–§12 (core data + functions, MMGS, results as data, classes for resources, one BarocssError, the facades, §10 common data formats, §11 cad-model's part wraps cad's, §12 the agent's command names) |
| R7.3a | kernel, outer, GPU (each its package) | **cad-model done** (batch 1 merge 326edd70b, batch 2 merge 9be3fe6bf: 94 throws coded, the refusal table 145 → 254 codes from refusal()/problem()/coded() calls); **gpu done** (merge 3e14b0aeb, G-R52; batch 3 merge 15beb31f7, G-R57: 61 public input refusals coded, 40 internal throws plain by design); **cad** batch 1 done (`43ccf24df`, D272: BarocssError in core/barocss-error.ts, all 171 classes on it, 11 codeless classes given codes; fingerprints R5 4e3603b7 and R4 d1f8bb3c byte-identical), batch 2 next. **Errors to one shape** (§6): BarocssError `{ code, message '[CODE] …', where?, details? }` with each package's codes as one union; cad's 152 per-module classes, cad-model's 19 classes and 35 bracketed-string returns, gpu's 36 classes and `{ ok }` returns; validators `check… → Problem[]`; the refusal table generated from the unions. Fingerprints byte-identical (messages unchanged). Outer starts now; kernel after K16; GPU after G13 |
| R7.3b | kernel (then outer, API) | **Coordinated batch adopted** (`bd60b578b`, qualified66395; exceptions above). Historical design: **Design approved** (2026-10-24, the kernel's r73b-r77b-kernel-design.md): output and snapshot methods → free functions (massPropertiesOf, surfaceAreaOf, checkOutput, exportStl/exportStep, flatPatternOf, outputOf, reevaluate, saveCadPart), mass MMGS everywhere; lands with R7.7b on the branch claude/kernel-r73b-r77b, then outer (R7.7a 2/4), API (R7.7d) and docs branch from it and merge in one window, followed by a full window. **Results as data, MMGS** (§2, §4): CadPartOutput's and CadPartSnapshot's methods become functions (`massPropertiesOf`, `exportStep(output)`, `reevaluate`…); public mass in g, g/cm³, g·mm²; cad-model's `bodyMass` inertia in g·mm²; the facades' adapters drop their conversions. The one intended value change, recorded per field; the studio's display unchanged |
| R7.3c | outer (cad-model), GPU (gpu) | **cad-model done** (`e3a9b6dd0`, merge 730ab70ea: boundsOf, exportStudioStep, assembly/edit.ts core verbs, engine/vec3; mass with R7.3b) and **gpu done** (G-R53). **One function per concept** (§3, §10.2): mass (outer, 2026-10-24: cad-model's four mass computations — bodyMass, massProperties, bom/core, robot/inertia — fold together with the R7.3b follow-up, so the last-ulp change and the MMGS change are one value change, one record and one fingerprint move), bounds (`boxOf` declared twice), STEP (`stepFor` → `exportStudioStep(doc, options)`), the Vec3/Mat3 declarations where they cross a package (**gpu done**, G-R53: one src/core/geometry-types.ts; cad's Vector3 → kernel, cad/src/api's → API, cad-model's 8 → outer); rotate's default pivot (the studio: the body's centre, the kernel: the origin; found in R7.4b, finding 5 — one default, recorded, then the facade gets rotate) |
| R7.3d | kernel + GPU | Size (kernel, 2026-10-24): only 117 of cad's 401 source files are reachable from the live engine (part-model, src/api, src/io); 284 are reachable only through index.ts exports (createCadModel, old document versions, the native proof APIs) and hold 141 of the 171 error classes — the audit decides retire or keep per module. createCadModel's tests mapped by the API lane (merge 26fab1a59, api-facade-design.md: the modelling covered by cad/test/api-legacy-coverage.test.mjs; the rest tests the old API itself and retires with it). **Legacy out** (§8, §10.1): createCadModel retired once `@barocss/cad/api` covers its tests; the ~30 `evaluate…Document`/`…FeatureGraph` old-version paths; the y-up packet tag renamed in gpu and the kernel's core/packet.ts together. Scope (coordinator, 2026-10-24, from G-R52): the CAD mm mesh packet path only — cad core/packet.ts and its preview builders, gpu mesh-packet.ts, gpu-compiler, kernel-face-preview, barocss-cad-interop's packet reader — to `right-handed-z-up`, no alias; gpu's primitives and engine scene are truly Y-up and stay; pinned evidence JSON untouched; barocss-cad-interop and barocss-viewer (unowned) given to the GPU lane for this rename |
| R7.4a | API | **One part implementation** (§11): cad-model's `part()` wraps cad's; verbs and options on the v2 command names (§12); the oracle unchanged |
| R7.4b | API | **done** (`5cd3af988`, merge 887f638fd; api tests 21/21 in each package). **Part growth**: cylinder, sketch → extrude/revolve, chamfer, shell, union/subtract/intersect, patterns, a body chooser; Plane/Location; a selector-stability test (an upstream edit re-evaluated, the same named edge still picked or a typed refusal) |
| R7.7 | all | **Coordinated consumer batch adopted** (`bd60b578b`, qualified66395; exceptions above). Contract: **No unit suffixes anywhere** (owner, 2026-10-24, widening R7.4c; conventions §2): (a) outer — the robot tools' radians (forward_kinematics' input, every robot reply's joint values) to degrees in step 4, with the facade's RS5 replies in the same window; the agent's tool arguments (`nearMM` → `near`, `toolMM` → `toolDiameter`, `layerMM` → `layerHeight`, `limitDeg` → `overhangLimit`, `bendDeg` → `bendAngle`; tools-v2.json refreshed in place with a record, the per-turn budget kept), rows file fields (~53, the sample rows and validators), cad-model's options and results (with its R7.3b follow-up); (b) kernel — the core's options and results, together with R7.3b (kg → g is the same fields: one change, one record); (c) GPU — gpu's options (cpuMs → cpuTime, stepMM → step, fovYRadians → fovY) and its stored scene/engine formats (rotateDegrees → rotation, fovYDegrees → fovY, timeSeconds → time, translationMm → translation; pointsMM/positionsMM with the kernel's window); byte counts keep …Bytes, mmToSceneUnit stays; (d) API — the facades' results (`massG` → `mass` …) after the cores; docs — every page, the tool and refusal tables. Renames recorded old → new per field; values unchanged except R7.3b's units. **Documents too** (owner, 2026-10-24): the part document's stored fields (`rotationDeg`, `lengthMM`, `upToMM`, `startDeg` …) by the kernel, the studio document's by outer, gpu's scene formats by GPU — renamed in place under the latest-schema rule, no alias or migration, fixtures and conformance regenerated, the fingerprints' moved names recorded |
| R7.4d | API | **done** (merge 25eb8561f: studio and kernel backends, api-parameters 5/5 and 3/3; sketch values and Location stay numbers until after R7.7). **Design approved** (`8bb34d75b`, api-facade-design.md: bindings through editFields' bind, PARAMETER_UNBINDABLE, withParameters as a function, configurations, features()/suppressed(); expressions out, pending the owner). **Parameters on the facade**: named parameters and expressions in place of numbers, named features and suppression, withParameters as a function over the doc; writes the studio's own parameter/configuration nodes byte-equal to the Parameters panel and the agent's tools (design first, coordinator review) |
| R7.5 | API | **done** (`2e96fcdef`, merge 8571ceff3; cad-model api 25/25). Finding 7 (add_part, place_part, add_mate and set_frames write inline in async tool handlers; make them `verb(doc, options) → doc` core functions both the tools and the facade call) goes to the outer lane with R7.3c. **Assembly facade** (cad-model): placing parts, mates, inputs and variants (O11), frames (O12) |
| R7.4c | API | **done** (`411678699`, merge 9e42e6ca2; samples 31/31). **Option names without unit suffixes** (owner, 2026-10-24; conventions §2, §12 amended): the facades' inputs take the agent's value names (`box({ w, d, h })`, `cylinder({ r, h })`, `mass({ density })`), results keep unit names (`massG`, `volumeMM3`); documents' stored names unchanged; the docs samples follow |
| R7.5b | API (GPU reviews) | **done** (`a45717b72`, merge 2e79a11db; show() 2/2 on hardware and SwiftShader; display lines are `lines`, §10.3 aligned). **gpu facade growth**: materials by id (§10.6), edges as lines, a camera view; `show()` browser check on both backends |
| R7.6 | docs + API | **Part 1 done** (`0b4848932`, merge45c94eb09). **Scoped Part 2 adopted** (`422f900d5`): current-product fixtures84 pass; only expected NOTGENERATED IV001 remained before generating the reviewed baseline. Exact baseline `7d00bb5d7` and candidate/product docs pass. Checks cover EX001/EX002/EX003/DA001/IV001/IV002 only; full conventions, nested JSON, units, immutability and runtime remain NOT_PROVEN. Original b9dc27EX003 and 9b9c one whitespace fixture failure remain preserved |

Rules: each R step is behaviour-preserving and its own checkpoint; no public export renamed without a re-export (saved
documents and package paths keep resolving); the touched package suites, lint and types per step, and the full window
plus the full flow at the end of the phase. Render counts and frame times are recorded in the decision logs, not as
evidence files.

## Item index (one line each; the /lanes pane shows the owner's Korean title after " · ko: ")

- **S1** — Import cycle in cad-model · ko: cad-model import 순환 해결
- **S2** — Rows rule (b) test fixtures and CLI paths · ko: 행 규칙 (b) 테스트 픽스처와 CLI 경로
- **S3** — Frozen v2 tool-contract test · ko: 고정된 v2 도구 계약 테스트
- **S4** — Remaining failures after S1–S2 · ko: S1–S2 뒤 남은 실패 정리
- **S5** — Kernel failures from the first window · ko: 첫 검증에서 나온 커널 실패
- **S6** — Studio lint error · ko: 스튜디오 린트 오류
- **S9** — Full window and browser flow at one commit (the "last fully verified" commit) · ko: 한 커밋에서 전체 검증과 브라우저 흐름 전체 (마지막 전부 검증된 커밋)
- **K1** — FRk6: ordered-trim speed (5.7 → 1.1 s) · ko: FRk6: 순서 있는 트림 속도 (5.7 → 1.1초)
- **K2** — FRk5 leftovers: notch cases on a tee · ko: FRk5 남은 것: T자 이음의 노치 경우
- **K3** — FRk7: SubD display folds · ko: FRk7: SubD 표시 접힘
- **K4** — FRk8a: bearing housing shoulder against Da max · ko: FRk8a: 베어링 하우징 턱을 Da max와 비교
- **K5** — FRk8b second half (not needed) · ko: FRk8b 후반 (필요 없음)
- **K6** — FRk9: weldment acceptance by the agent · ko: FRk9: 에이전트가 용접 구조물 인수 검사
- **K7** — r6 sphere-intersect pin against a closed form · ko: r6 구 교차 고정값을 닫힌 해와 비교
- **K8** — F5: cnc-turning report speed (55 → 15 s) · ko: F5: CNC 선반 보고서 속도 (55 → 15초)
- **K9** — Graze cases (1 nm, 10 µm, 1 µm) · ko: 스치는 경우들 (1 nm, 10 µm, 1 µm)
- **K10** — Fuzz harness and its first findings · ko: fuzz 도구와 첫 발견들
- **K10b** — Fuzz refusals: robust, near-degenerate, touching lumps · ko: fuzz 거부 줄이기: 안정성, 거의 퇴화, 맞닿은 덩어리
- **K12** — Near-degenerate refusals and the pole-safe map (fuzz 170) · ko: 거의 퇴화한 입력의 거부 정리와 극점 안전 매핑 (fuzz 170)
- **K13** — Opening time: box test in the Boolean, the NURBS basis, quadrature and tessellation cost · ko: 열기 시간 단축: 불리언 상자 검사, NURBS 기저 함수, 질량 적분·테셀레이션 비용
- **K14** — A fresh fuzz round: new seeds, triage, fix the robust refusals · ko: 새 fuzz 시험: 새 시드로 돌려 분류하고 견고성 거부 고치기
- **K15** — K14's open robust refusals · ko: K14에서 남은 견고성 거부 사례 고치기
- **K16** — Remove the Boolean features' self-union, explaining what relied on it · ko: 불리언 피처의 자기 합집합 제거 (의존하던 3곳 해명)
- **K11** — F5 remainder: the turning report's derivatives · ko: F5 나머지: 선반 보고서의 미분 계산
- **O1** — Verify the A9 items in the full suites · ko: A9 항목을 전체 테스트에서 확인
- **O2** — A9-11: Studio download flow · ko: A9-11: 스튜디오 다운로드 흐름
- **O3** — A9 brief fixture: key against bearing clash · ko: A9 브리프 픽스처: 키와 베어링 간섭
- **O4** — A9-7: linked bearing housing in the app (needs a person's rows file) · ko: A9-7: 앱의 연결된 베어링 하우징 (사람이 준 행 파일 필요)
- **O5** — A9 acceptance run, end to end · ko: A9 인수 실행, 처음부터 끝까지
- **O5a** — A9 findings F1–F5: made bodies, holes, bore, tool size, housing · ko: A9 발견 F1–F5: 만든 바디, 구멍, 보어, 공구 크기, 하우징
- **O5b** — A9 findings F6–F10: drawings, fasteners, BOM base members · ko: A9 발견 F6–F10: 도면, 체결구, BOM 기본 부재
- **O6** — Aligned sections; welded DFM profile (waits on the owner) · ko: 기울어진 단면; 용접 DFM 프로필 (오너 대기)
- **O7** — Built-in tables → person-loaded sample rows · ko: 내장 규격표 → 사람이 불러오는 예시 행 파일
- **O8** — Touching lumps: per-lump exports, DFM warning, BOM count · ko: 맞닿은 덩어리: 덩어리별 내보내기, DFM 경고, BOM 개수
- **O9** — Results tied to their revision; REVIEW-A1 · ko: 결과를 계산한 리비전에 묶기; 복구 결함 REVIEW-A1
- **O10** — Rebuild-cost diagnostics, read-only · ko: 재계산 비용 진단 (읽기 전용)
- **O11** — Assembly-level variability · ko: 조립품 수준 변형 (최상위 입력으로 제품군)
- **O12** — Robot tool and sensor frames · ko: 로봇 공구·센서 좌표계 (TCP, 카메라)
- **O13** — External read-back of the robot exports · ko: 로봇 내보내기를 외부 도구로 다시 읽어 확인 (urdfdom, MuJoCo)
- **O15** — RD10 L3: a live model sizes the 3-DoF arm · ko: RD10 실제 모델 실행: AI가 3자유도 팔 크기 정하기
- **O14** — Robot mounts from datasheet rows · ko: 데이터시트 행으로 만드는 서보·모터·베어링 마운트
- **R6** — Triage the stale examples/gpu-scene flows · ko: 오래된 gpu-scene 예제 흐름 정리 (고치거나 은퇴)
- **R7** — API consistency and an object facade over the core · ko: API 일관성 정리와 객체형 겉 API
- **P1** — A real product: single-cylinder four-stroke engine · ko: 실제 제품: 단기통 4행정 엔진
- **P1-L3** — A live AI run of the engine brief (≤ US$25, a run stopped past US$8) · ko: 실제 AI로 엔진 브리프 만들기 (총 25달러 이하, 1회 8달러 넘으면 중단)
- **P2** — A real product: electronics enclosure · ko: 실제 제품: 전자기기 외함
- **P3** — A real product: large machine (gantry CNC router) · ko: 실제 제품: 대형 기계 (갠트리 CNC 라우터)
- **P4** — A real product: 6-axis robot arm · ko: 실제 제품: 실제 6축 로봇 팔
- **G15** — Photoreal rendering: material realism, light and shadow, progressive path tracing, post; accepted on the P1 engine render · ko: 실사 렌더링: 재질 사실감, 조명·그림자, 점진 경로 추적, 후처리 (엔진 렌더로 인수)
- **RS1** — Sample robots (8 kinds, opened from a Samples list) · ko: 샘플 로봇 묶음 (8종, 샘플 목록에서 열기)
- **RS2** — Joint motion playback (and motion video) · ko: 관절 움직임 재생 (경유 자세를 시간에 따라 재생, 영상 내보내기)
- **RS3** — The agent moves the robot (joints, waypoints, check and play) · ko: 에이전트가 채팅으로 로봇을 움직이기
- **RS4** — Robot docs examples · ko: 로봇 문서 예제와 화면
- **RS5** — The robot on the facade · ko: 겉 API에서 로봇 다루기
- **CG1–CG10** — Commercial-grade work: CG1/CG2/CG5/CG6 ordered; bounded CG1 loft steps adopted; remaining scopes follow their rows · ko: 상용 기능 개발: 모델링·스케치·도면·데이터 우선, 검증한 로프트 단계 채택
- **R7.1** — Public API inventory · ko: 공개 API 목록 자동 추출
- **R7.2** — API conventions (approved) · ko: API 규약 (승인됨)
- **R7.3a** — Errors to one BarocssError shape in all three packages · ko: 세 패키지 오류를 BarocssError 하나로
- **R7.3b** — Results as data, MMGS units; coordinated batch adopted bd60b578b · ko: 결과는 데이터로, 단위는 MMGS로
- **R7.3c** — One function per concept (mass, bounds, STEP, vectors) · ko: 개념마다 함수 하나 (질량, 경계, STEP, 벡터)
- **R7.3d** — Legacy APIs out (createCadModel, old document versions, the y-up tag) · ko: 옛 API 정리 (createCadModel, 옛 문서 버전, y-up 이름표)
- **R7.4a** — One part implementation; verbs on the agent's command names · ko: 부품 구현 하나로, 동사는 에이전트 명령 이름으로
- **R7.4b** — Part facade growth with a selector-stability test · ko: 부품 겉 API 확장과 선택자 안정성 검사
- **R7.4c** — Facade option names without unit suffixes · ko: 겉 API 입력 옵션 이름에서 단위 접미사 빼기 (결과에는 유지)
- **R7.7** — No unit suffixes anywhere (tool arguments, core options, rows fields, results); coordinated batch adopted bd60b578b · ko: 단위 접미사 전부 빼기 (도구 인자, 핵심 함수 옵션, 행 필드, 결과 이름)
- **R7.4d** — Parameters, expressions and suppression on the facade · ko: 겉 API의 매개변수·식·피처 억제
- **R7.5** — Assembly facade · ko: 조립품 겉 API
- **R7.5b** — gpu facade growth · ko: gpu 겉 API 확장
- **R7.6** — Facade docs and scoped inventory drift checks adopted · ko: 문서를 겉 API로, API 목록을 검사에 포함
- **W0** — Documentation site cleared and its skeleton set up · ko: 문서 사이트 비우고 새 뼈대 만들기
- **W1** — Documentation written from the current code · ko: 지금 코드 기준으로 문서 전부 새로 쓰기
- **G11** — Measure the heaviest scenes, then decide on culling or LOD · ko: 가장 무거운 장면을 재고 나서 컬링·LOD 필요 여부 판단
- **G12** — Studio layout: one dock, one preview mode, compact legends, no overlaps · ko: 스튜디오 화면 정리: 오른쪽 도킹 하나, 미리보기는 하나씩, 짧은 범례, 겹침 없음
- **G12f** — The studio's shell (top bar, rails, bars, menus, palette, HUD) onto shadcn · ko: 화면 틀(상단 바, 도구 막대, 각종 바, 메뉴, 팔레트, HUD)을 shadcn으로
- **R1d** — HUD typing and placing without re-rendering the App · ko: HUD 입력·배치 중 App 다시 그리기 없애기 (렌더링 성능)
- **G13** — Robot tool and sensor frames drawn in the viewport · ko: 로봇 공구·센서 프레임을 뷰포트에 표시
- **O16** — Panel contents tidied for the dock · ko: 도킹 안 패널 내용 정리 (BOM 표 폭, 긴 설명 접기, 문구 스타일 통일)
- **O17** — The chat on the AI SDK (useChat over our SSE, shadcn AI components, scripted chats for flows) · ko: AI SDK 기반 채팅 (기존 SSE 위의 useChat, shadcn AI 컴포넌트, 흐름 검사용 대본 채팅)
- **O18** — Mass on request (the worker sends mass only when asked) · ko: 질량은 요청할 때만 계산 (열기 시간 단축)
- **O23** — Saved motions' default limits converted per joint (samples played 57× too fast) · ko: 저장된 움직임의 기본 한계값 단위 변환 (샘플이 57배 빨리 재생되던 문제)
- **O24** — Joints and mates to commercial breadth (mate connectors, edges/vertices/spheres/cones, joint kinds, rack–pinion/screw/cam, slider-crank) · ko: 관절·메이트를 상용 수준으로 (메이트 커넥터, 모서리·꼭짓점·구·원뿔 참조, 관절 종류, 랙·피니언/나사/캠, 크랭크-피스톤)
- **RS6** — Core and bounded Motion facade adopted; Studio and remaining loop validation remain · ko: 폐루프 핵심·모션 API 일부 채택, 스튜디오·나머지 검증 경로 남음
- **RS7** — Rotor head and swashplate: blade geometry, explicit joints, coupled loops, playback and outputs · ko: 로터 헤드·스와시플레이트 통합 예제 (블레이드·관절·폐루프·재생·출력)
- **O26** — Headroom in the per-turn tool budget (24,130 of 25,000 → ≤ 21,000) · ko: 에이전트 도구 설명 글자 수 여유 확보 (24,130/25,000 → 21,000 이하)
- **O25** — The agent can colour and finish bodies (an appearance action) · ko: 에이전트가 바디 색과 마감을 정할 수 있게 (외관 동작)
- **O22** — Designed contact (meshing gears, loop pins) isn't a collision in check path; the gantry sample fixed · ko: 경로 검사에서 설계된 접촉(맞물린 기어, 고리 핀)은 충돌로 보지 않기; 갠트리 샘플 수정
- **O21** — The agent can make and set parameters · ko: 에이전트가 매개변수를 만들고 값을 바꿀 수 있게
- **K17** — A suppressed flag in the part document · ko: 부품 문서에 피처 억제 표시
- **O20** — The agent's given values kept through a command's derive (split's at) · ko: 명령의 자동 계산이 에이전트가 준 값을 덮어쓰지 않게 (분할 위치)
- **O19** — Stored edge names checked against their signatures (no silent wrong corner) · ko: 저장된 모서리 이름을 서명과 대조 (엉뚱한 모서리 처리 방지)
- **G1** — A9-7 UI port · ko: A9-7 UI 이식
- **G2** — G23: CNC preview · ko: G23: CNC 가공 미리보기
- **G3** — G21: display modes, silhouettes, isolate and hide · ko: G21: 표시 모드, 실루엣, 격리와 숨기기
- **G4** — G22: clearance map on screen · ko: G22: 화면의 간극 지도
- **G5** — G24: 3D PMI · ko: G24: 3D PMI
- **G6** — G25: GPU analyses (thickness, draft, access) · ko: G25: GPU 분석 (두께, 구배, 접근성)
- **G7** — Antialiased cap edges · ko: 단면 뚜껑 가장자리 안티앨리어싱
- **G8** — Performance regression check · ko: 성능 회귀 점검
- **G9** — Cap sample memory · ko: 단면 뚜껑 샘플 메모리
- **G10** — Full browser flow on WebGL2 · ko: WebGL2로 브라우저 흐름 전체
- **R1** — Studio re-renders: Viewport and the App split · ko: 스튜디오 다시 그리기: 뷰포트와 App 나누기
- **R2** — Viewer per-frame allocations, shared renderer code, viewer.ts split, gpu folders · ko: 뷰어 매 프레임 할당, 렌더러 공통 코드, viewer.ts 나누기, gpu 폴더
- **R3** — chat/tools.ts split by action group · ko: chat/tools.ts를 동작 그룹별로 나누기
- **R4** — cad-model duplicates, layering and folders · ko: cad-model 중복, 계층, 폴더 정리
- **R4b** — src/ui shared panel pieces; DrawingWorkspace split · ko: src/ui 공통 패널 조각; DrawingWorkspace 나누기
- **R5** — Kernel duplicates, hot paths, part-model split, folders · ko: 커널 중복, 핫패스, part-model 나누기, 폴더

## Later (on the roadmap, not started)

- **REVIEW-A1**: **done** in O9 (the recovery copy is written after its mesh blobs). · ko: 복구가 메시 저장 전에 성공을 보고하는 결함 (지금은 O9에 포함)
- **RB5–RB8:** fuzzing, the CI corpus, STEP import hardening and the nightly ABC sweep. RB6 and RB8 need downloads, which need the owner's permission. · ko: fuzz, CI 코퍼스, STEP 가져오기 강화, 야간 ABC 점검 (RB6·RB8은 다운로드 허락 필요)
- **Live AI runs:** RB9 live trials, RD10 L3 and the A7/A8 live comparison. They need a token budget from the owner. · ko: 실제 AI 실행 시험 (토큰 예산 필요)
- **Opening time:** measured in D240 (frames 13–14 s in Node, 11 s of it the 120 frame Booleans; the spring's and worm's time in mass quadrature and tessellation); the kernel's share is K13. · ko: 열기 시간: D240에서 측정 완료, 커널 몫은 K13
- **`.barocad` only** — **done** (merge 24353d870, G-R58; flow step 288) (owner, 2026-10-24): the studio's Open stops treating `.cad` as our curve/surface source (a generic extension other CAD programs use); GPU lane (App.tsx open), docs lane (studio/files.md). · ko: 우리 소스 확장자는 .barocad 하나만 (.cad는 받지 않음)
- **New part resets the camera** (G14, G-R54/G-R56): a new part keeps the last part's saved view today, so flow steps 74 and 270 depend on what ran before; a user-visible change, so later. · ko: 새 부품을 만들면 시점을 기본값으로 (흐름 순서 의존 해소, 화면 동작 변화라 나중에)
- **After G25, when need is measured:** occlusion culling, progressive photoreal rendering, turntable and explode video. · ko: 가려진 물체 생략, 점진 사실적 렌더링, 회전·분해 영상 (필요가 확인되면)
- **Publication:** gpu's entries — **done** (merge 9f66ec3e4, G-R61: tsc-only build, one module graph, a tarball consumer test) — (`@barocss/gpu` was one bundle, `@barocss/gpu/viewer` unbundled tsc output, so each has its own Viewer, ViewerError and BarocssError and `instanceof` fails across them; GPU lane, after R7.7c: bundles with the shared core external, a consumer test), the cad-model package build, the docs inventory (`check:docs` drift for @barocss/gpu), the A6.5 legal review, release. Only when the owner asks. · ko: cad-model 패키지 빌드, 문서 목록, 법률 검토, 릴리스 (오너가 요청할 때만)
- **A gallery site of prompts and their results** (owner, 2026-10-24: planned, not now): users' prompts with the models the AI made, renders and per-element scores; the AI evaluation stores its runs gallery-ready in ~/.cache/barocss-ai-eval/ (prompt, .bcad, a render, score.json, an index) so the site can read them. · ko: 사용자 프롬프트와 결과물을 모은 갤러리 사이트 (나중에)
- **After the whole roadmap:** the full spec and conformance suite, and a fresh-AI reimplementation test (owner's experiment). · ko: 전체 명세와 적합성 시험, 새 AI가 다시 구현해 보는 실험

## Waiting on the owner

P2 is a split follow-up, not a blanket hold on code. The last C run also reported no stock loaded for heat-sink CAM and unknown board/cell material mass. Check existing approved inputs first; do not infer that all local data is absent. Code and drawing defects proceed separately from required input decisions.

- P2 PG-11: actual connector row, placement, required bodies and plug/cable keepout inputs remain open. The shipped M3 sample already includes cap length5; C8eb connects that existing row for PG-12, with runtime verification complete: PG12 four-screw checks pass, while ten product failures and PG11 remain open. No new M3 row is requested. PG-12 evidence and the remaining manufacturing/interference/drawing/CAM/mass failures must be judged separately. · ko: P2 커넥터 실제 입력 결정 (PG-11); 기존 M3 길이 5와 실제 나사 4개는 검증 통과 (PG-12)
- O11's UI: fold part-level configurations into the assembly's variants (F) or keep them separate in Parameters (K). Built as K for now; F is an adapter change. The outer lane's mock: one Variants card in the dock listing Master, variants and (under F) part configs with a source chip. · ko: O11 UI — 부품 구성(configurations)을 조립품 변형에 합칠지(F) 따로 둘지(K) (지금은 K로 구현)
- Two PDFs for O14's sample mount rows: Bondtech's 17HS datasheet (NEMA 17 pilot) and a NEMA 23 maker drawing; until then both rows are estimates, every field unchecked. · ko: O14 견본 장착 행용 PDF 2개 (NEMA 17·23 치수) 다운로드 허락
- One live chat turn to check whether the CLI emits thinking deltas for O17c's reasoning display (O17c is built to tolerate their absence and marked unverified until then). · ko: O17c 생각 과정 표시 확인용 실제 채팅 1턴 (허락 필요)
- A person-supplied row/fit file for A9-7/A9's acceptance (O4, O5). · ko: A9-7·A9 인수 검사용 사람이 준 행·끼워맞춤 파일 (O4, O5)
- Oblique-end weld beads stay refused (BEAD_ANGLE) until there is an independent oracle. · ko: 비스듬한 끝 용접 비드는 독립 오라클이 생길 때까지 거부
- A v3 decision, if S3 finds a breaking v2 change. · ko: S3에서 v2 호환이 깨지면 v3 결정
- Permissions and budgets: RD3 PDFs, RB6/RB8 downloads, live-model runs, the A6.5 legal review. · ko: 허락과 예산: RD3 PDF, RB6/RB8 다운로드, 실제 모델 실행, 법률 검토
- The 3MF slicer check (open the exported 3MF in PrusaSlicer or Bambu). · ko: 3MF를 슬라이서(PrusaSlicer, Bambu)에서 열어 확인
- Dimension expressions (`W/2 + 3`) in documents: today a value is a number or `{ parameter }`, neither document stores an expression; adding one is a schema change for the kernel and the studio. · ko: 문서에 치수 식(W/2+3 같은)을 저장할지 (지금은 숫자나 매개변수 이름만)
- P1's rows (PG-2): a rows file for the spark plug thread (M14 × 1.25) and the engine's main bearings, from a source the owner supplies; until then stand-ins. · ko: 엔진용 행 파일 (점화 플러그 M14×1.25 나사, 메인 베어링) — 사람이 준 자료 필요
- CG6's sharing, comments and multi-user editing: they need a server, accounts and hosting (a self-hosted sync service or a cloud provider) — whether, and how. · ko: 공유·댓글·여러 사람 동시 편집 — 서버·계정·호스팅이 필요 (할지, 어떻게 할지)
- A built-in display look per material id — the GPU lane's proposal (G15a): steel → machined; ss304 → brushed; al6061, ti64 → machined in their colour; brass → turned; a380, a356, zamak3, az91d → cast; grey-iron → sand-cast; pa12 → blasted; abs, pc, pp, petg, pom, pla, resin → plain plastic; only where a body has no appearance of its own. (al6061's colour, …) in gpu, or scenes keep registering their own looks (today: none; O75 keeps look ids apart from material ids; R7.5b finding 10; the GPU lane recommends none in gpu: looks stay with the app or the person). · ko: 재료 id마다 기본 표시 모양(색)을 gpu에 둘지, 장면이 직접 등록할지

## Off the roadmap (owner decisions)

**Long-term experiment scope update (2026-10-25):** CAE, including structural/FEM, meshing, thermal, fluid and
mould-fill work, moves from the earlier exclusion into bounded future stages. RD4–RD8 remain held until their
scope and execution are explicitly assigned. No new solver is implemented by this change.

PCB/ECAD (deferred), DWG/SAT reading (deferred; DWG writing no-go) and FRf2 sibling-part frames (refused) remain
unchanged. Standing:
- no WASM and no new runtime dependencies in the packages (cad, cad-model, gpu); the studio app's UI may use UI libraries (owner, 2026-10-24);
- no standards text or built-in tables;
- rows rule (b);
- v2 tools only;
- the icon font is never bundled;
- benchmarks against Tailwind only.

Ball adoption `d753cfc2f` includes the exact current-product forwardport and the one-line test declaration repair `09a868163`. Original `5d75cb5a` focused Model59/Studio12 and Model/Studio types pass; the first owned lint fails on prefer-const and remains preserved. Only that lexical declaration changed, and the repaired owned10-file lint passes. Candidate production and all unchanged selected inputs retain the original native evidence; these results are not a new whole-suite or browser run at the repaired SHA. Ball loops, other moving-anchor combinations and unsupported robot decompositions retain typed refusals. This is not RS7 or manufacturing acceptance.

CG1.1d mixed line/arc loft is adopted from `a8ce2c996` by merge `b21910b43`. The original `5e8eedf0b` build, package types, three-file lint and unchanged part-model/side-tags tests retain their execution scope. Its 73PASS/1FAIL remains: the nonuniform negative fixture encountered an arc-centre guard before the expected later scale guard. The repair fixes only that case with independent literal inputs and an anchored typed refusal. The revised oriented file passes all43 tests; source407 and original fresh dist814 are byte/mode identical before and after. Product kernel source equals that candidate and product docs pass. This is not a rerun of all74 tests or whole/browser acceptance.

R7.6 inventory baseline contains6604 unique exposures/variants across3 packages with TypeScript5.9.3, including type, value, type+value and asset spaces. CadPartOutput42 and CadPartSnapshot5 direct properties pass the scoped anchor rule. Intentional public API changes require a reviewed expected-inventory delta. The original inventory child is included in check-docs; individual child logs/read graph are not independently instrumented.

CG1.2 bounded guide adoption (`b7b0f0e08`) supports exactly two same-axis parallel conic frames, a quadratic world-space translation rail with cap seam endpoints and a midplane middle control. Exact rational NURBS and independent mass tests apply to this scope. General rails, nonparallel sections, multiple sections, smooth lofts, Studio/v2 feature adapters and RS7 acceptance remain. The original f7d7 86PASS/1FAIL is preserved; repaired oriented56 is separate. Repeated dist postflight scans were not run.


## Viewer SDK and app delivery (dedicated Work, updated 2026-10-27)

The owner assigned a new Viewer Work, `01a1787c-a71c-7000-a102-4988e3481ec0`.
It owns `@barocss/viewer`, the user-approved React/shadcn `apps/cad-viewer` app, and related bounded examples. Presenter reuses
`@barocss/gpu/viewer`; the existing GPU Work retains the common renderer. CAD
Studio currently consumes the GPU core directly. A GPU or Studio feature does
not automatically expose a Viewer SDK option. Reuse existing loading, controls,
picking, native measurements, lifecycle and bounded assembly APIs.

| Order | Complete feature and gate |
|---|---|
| V1 | Consistent public load/control/state/error/dispose contract with explicit units, revisions and capability refusals. First assigned slice: compact camera/visibility/selection review state bound to the current supported document or assembly. Validate before applying; retain accepted state on failure. |
| V2 | One external-host inspect flow using existing navigation, selection, visibility and supported native queries. A screen approximation remains distinct from a native measurement. |
| V3 | Link the supported assembly tree and viewport selection/visibility. Preserve hierarchy, local/world transforms and repeated-instance identity; retain current 1-4 selected-instance limits. |
| V4 | Expose existing GPU material, light, environment and post options through explicit SDK capabilities and refusal behavior. Do not add a second renderer. |
| V5 | Resume a source-bound review with saved views, annotations, supported measurements and capture. Complete a small embedding example without adding a CAD editor or solver. |
| V6 | Improve measured bottlenecks in the proven flow. Reuse BVH and keep the existing LOD measurement hold. |

V1 review-state source is in its recorded scoped product; V2 assembly consumption has its own
source/browser receipt. The owner then approved the standalone Viewer app. Its native Surface/Curve
point measurement has a normal app commit `b579aa620`; root integration is still separate.
CURRENT `VIEWER-APP-MEASURED-REVIEW-RESTORE-01` binds saved points and native parameters,
units, model/source revision, view and selection/visibility to a real Save/Open workflow. Reject a
mismatched or malformed review before changing accepted state. NEXT follows V4's existing GPU
capabilities, with explicit supported options and refusals; do not create a second renderer.
Controlled prototype-mutated race experiments remain distinct from unmodified public flow evidence.
The stopped packaging/config/hook follow-up stays stopped. The coordinator reviews exact normal
commits and owns product integration; independent source work can proceed while heavy execution
uses the existing shared lane. These checkpoints do not claim arbitrary assembly or physical accuracy.

Current feature checkpoint: DoF source has its first GPU emit, CPU2, GPU8 and
public Studio focus/blur/pick/cancel/file roundtrip evidence at `22d592`. The
required affected Model/Studio batch and product integration remain. Drawing
parameter/reference source is adopted as `14bbc19f3`; the current compact
History, DoF callback, STL quality and route admission code are preserved. Its
new reference-review UI and parameter file flow still require their first
affected checks. Reuse unchanged passing evidence; do not rerun old flows.

2026-10-27 추적 범위 정정: 사용자 요청에 따라 P2 제조인수의 활성 추적과 정기 보고를 제외한다. 기존 미수락/HOLD와 실패 기록은 보존하며 PASS로 바꾸지 않는다.
