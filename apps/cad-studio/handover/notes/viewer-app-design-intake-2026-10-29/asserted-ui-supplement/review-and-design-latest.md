# Viewer app 검토와 디자인 제안

작성: 2026-10-29. 제품 코드는 수정하지 않았다.

최신 상태: 최종 정적 시안의 미확인 7개 UI 항목은 assertion과 개별 결과 저장으로 PASS/FAIL0/NOT_RUN0을 확인했다. 제품 연동과 상태별 상세 설계는 남아 있어 시안은 draft다. [최신 receipt](../runs/viewer-design-asserted-20261029T063545/receipt.json).

검사 소스: `a386c8705beda2c72d215da61a55fd6119351ca2`의 격리 snapshot. 이후 다른 작업이 변경한 Studio 로드맵과 미추적 파일은 보존했다. 아래 디자인 판단은 실제 앱 화면을 보고 내린 제안이다. 새로운 회귀 결함으로 분류하지 않는다.

## 판단

Viewer app은 파일을 열고, 대상을 찾고, 값을 확인하고, 검토 결과를 전달하는 작업에 집중해야 한다. 현재 화면은 제목·파일 작업·뷰 조작이 세 줄로 나뉘고, 좌우 패널의 많은 항목에 같은 시각적 무게를 준다. 작은 아이콘과 경계선이 모델보다 먼저 보인다. 테마만 바꿔서는 이 문제가 풀리지 않는다.

실제 1440×900 화면에서는 상단 약 146 px와 좌우 252/280 px를 조작부가 사용한다. 완료된 8 mm 거리값은 검사 패널 아래로 밀린다. 화면의 A/B 선에는 수치가 없지만, 내려받은 PNG에는 8 mm가 표시된다. 표시 순서가 사용자의 작업 순서와 다르다.

## 권장 방향: 모델 중심 검토 화면

| 영역 | 제안 | 완료 기준 |
|---|---|---|
| 상단 | 56 px 단일 바. 파일명·원본/revision·열기·내보내기를 표시한다. | 파일 상태와 주요 작업을 한 줄에서 찾는다. 실패·미지원 정보도 읽을 수 있다. |
| 왼쪽 | 접을 수 있는 약 220 px 구조 트리. 선택·숨김·격리를 가까이 둔다. | 선택된 인스턴스와 원본을 구분한다. 긴 이름·깊은 구조를 처리한다. |
| 가운데 | 모델을 가장 크게 둔다. 뷰 조작은 작은 도구 모음으로 모은다. | 선택, 카메라 조작, 측정 중인 상태를 구분한다. 장식이 형상 판독을 가리지 않는다. |
| 오른쪽 | 약 280 px 작업별 검사 패널. 현재 결과를 먼저 둔다. | 거리·단위·대상 A/B를 스크롤 없이 읽는다. t/u/v·XYZ·공차는 펼쳐서 확인한다. |
| 측정 | 패널 상단과 모델 위에 값을 표시한다. | 화면과 PNG가 같은 원본 점·좌표계·단위를 사용한다. 점 간 거리임을 명시한다. |
| 작은 화면 | 좌우 패널을 한 번에 하나만 여는 drawer로 바꾼다. | 720×700에서 가로 넘침이 없다. Escape·포커스 복귀·키보드 탐색이 된다. |
| 시각 체계 | 밝은 회색 바탕, 읽기 쉬운 본문, 숫자 자리 정렬, 파란색 한 가지 강조색. | 선택·오류·비활성 상태를 색만으로 구분하지 않는다. 어두운 테마도 같은 정보 순서를 유지한다. |

기능을 숨겨 화면을 비우는 방식은 피한다. 현재 결과는 항상 보이고, 상세 계산값과 고급 설정은 필요할 때 펼친다. 그림자·둥근 카드·그라데이션의 추가보다 이 정보 구조가 먼저다.

## 기존 로드맵에 넣을 작업

아래 순서는 디자인과 제품 작업의 우선순위다. 심각도 P1/P2 결함 판정은 아니다.

1. **측정 결과의 가시성 + 화면 구조 개선.** ROADMAP 1.1/2.3 후속 작업. 기존 8 mm fixture로 데스크톱과 작은 화면에서 결과·단위·A/B를 확인한다. 선택 없음/선택 있음/측정 중/측정 완료/실패 상태를 각각 정의한다.
2. **조립품 거리의 화면 표시와 측정 PNG.** ROADMAP 1.1/3.2/3.4 연결 작업. 실제 앱은 조립품 거리를 계산하고 리뷰 파일에 복원한다. 그러나 A/B 오버레이와 측정 PNG는 문서 측정 경로만 사용한다. 조립품 원본/인스턴스 변환을 반영한 좌표로 화면과 파일을 검증한다. 최소 간격·간섭 검사로 부르지 않는다.
3. **받은 리뷰를 여는 안내.** ROADMAP 1.3/2.1 후속 작업. 필요한 원본 identity/revision과 정렬된 대상 ID를 보여 준다. 같은 대상을 다른 순서로 선택한 경우도 설명한다. 원본이 맞을 때만 명시적 subset 적용을 제공한다. 다른 revision을 조용히 연결하지 않는다.
4. **조립품 매개변수 입력 안내.** ROADMAP 3.1/2.2 후속 작업. 원본 t/u/v 범위와 필드별 오류를 보여 준다. 문서 검사 패널과 같은 기준을 사용한다. 이번에는 소스 차이만 확인했으며 범위 밖 입력의 실행 실패는 확인하지 않았다.
5. **기존 미완료 작업 유지.** 실제 사용자 파일(2.5/4.4), 4개 표시 한도 확대(4.2), 복구 실패 전달(4.3), 표시 단면/비교(5.2)는 기존 과제다. 단면은 SDK clipping/picking 계약과 #2239에 연결한다. 현재 제한된 IGES 지원을 없는 기능으로 취급하지 않는다.

제품 시각 변경은 1번부터 진행할 수 있다. 조립품 결과 전달과 리뷰 복원 안내는 별도 기능 완료 조건으로 관리한다. 디자인 시안은 이 동작들이 제품에 구현됐다는 증거가 아니다.

## 증거

- **CPU PASS 133, FAIL 0, SKIP 0.** 기존 앱 테스트 18개 파일. Presenter/DOM double을 사용하므로 픽셀·기기 복구 검증과 다르다. [receipt](../runs/viewer-app-state-20261029/receipt.json)
- **실제 소스 빌드 PASS.** 입력 676개, 자체 소스 581개, 자체 dist 0개. [input audit](../runs/viewer-app-browser-20261029/input-audit.json)
- **Chrome/WebGPU 공개 UI 흐름 PASS.** 문서 점 간 8 mm, 조립품 변환 후 √234 mm, 리뷰 파일 다운로드/복원, 실제 측정 PNG, 숨김/격리, 작은 화면 패널/키보드, 잘못된 JSON 거부 후 기존 상태 유지. 숫자 허용오차와 범위는 개별 receipt에 보존했다. [문서 receipt](../runs/viewer-app-browser-20261029/receipt.json), [조립품 receipt](../runs/viewer-app-browser-20261029/assembly/receipt.json)
- 첫 시도는 테스트 도구가 기본 admission 대상을 잘못 가정해 실패했다. 해당 결과를 [first-attempt](../runs/viewer-app-browser-20261029/first-attempt/)에 보존했다. 제품 실패로 세지 않았다.
- **미검증:** 실제 고객 파일, 임의 형식 가져오기, 모든 GPU, 자연 device loss/OOM, 장시간 자원, OS 파일 대화상자, 배포. 새 데이터 손상·비동기 늦은 읽기 결함은 이번 검토에서 확정하지 않았다.

소스 위치와 자세한 판단: [상태·파일 검토](viewer-app-state-review.md), [실제 UI 검토](viewer-app-ux-runtime-review.md).

## 디자인 산출물

[디자인 brief](../design/viewer-app-20261029/brief.md)와 standalone concept을 별도로 작성한다. 모형과 8.000 mm는 디자인 예시다. 실제 CAD 엔진 렌더나 계산 결과로 취급하지 않는다. 제품 통합은 수행하지 않는다. 시안의 브라우저 검증 상태와 경로는 [검증 기록](../design/viewer-app-20261029/verification.json)을 기준으로 한다.

[HTML 시안](../design/viewer-app-20261029/concept.html), [밝은 데스크톱](../design/viewer-app-20261029/desktop.png), [어두운 데스크톱](../design/viewer-app-20261029/desktop-dark.png), [작은 화면](../design/viewer-app-20261029/compact.png), [작은 화면 검사 패널](../design/viewer-app-20261029/compact-inspection.png)을 보존했다. 부모 검토자도 이 네 이미지를 실제 열어 확인했다. 상단 높이 56 px, 두 크기의 가로 넘침 없음, 측정값 가시성을 확인했다.

단독 시안의 첫 guarded 검사에서 19개 동작/배치 항목이 통과한 뒤 검색 필터가 실패했다. SVG symbol과 control의 중복 ID가 원인이었다. 최종 HTML은 ID를 분리했고 중복 ID 0개와 JS 구문 성공을 정적으로 확인했다. 재검증은 공유 gate가 높은 부하에서 exit75로 거절하여 **NOT_RUN**이다. 구조 drawer의 Escape 포커스 복귀·reduced-motion·전체 console 무오류도 해당 첫 실행에서 도달하지 못했다. 스크린샷은 시각 변화가 없는 최종 ID 수정 전 버전이다. 따라서 산출물은 **시각 검토가 끝난 draft**이며 최종 HTML의 전체 상호작용 PASS가 아니다. 최초 CUA 미지원·Node18 실행 실패와 전용 서버/브라우저/lease 종료도 검증 기록에 남겼다.

## 후속 확인 — 06:28 UTC heartbeat

기존 로컬 제품 로드맵 `apps/cad-studio/handover/roadmap.md:1544–1560`과 별도 Viewer intake 문서에서 위 개선안의 기존 05/V1/V2/V3/V5 및 앱 ROADMAP 연결을 확인했다. 기록은 작업 트리의 미커밋 상태이며 구현·제품 수락은 아니다. 기존 D322 저장 정확성 작업 순서는 유지됐다. [원문·hash·줄 근거](../verification/viewer-app-roadmap-intake-20261029T062845.json).

동일한 최종 HTML(def73380...)을 새 소유 브라우저에서 1440×900/720×700으로 렌더했다. 부모 검토자도 새 PNG 두 개를 실제 열어 확인했다. 다만 검사 도구가 7개 boolean을 console.log로만 출력하고 assert/throw/return을 하지 않아 개별 결과가 보존되지 않았다. 실행 exit0을 개별 PASS로 해석하지 않는다. 현재 상태는 **RUN_COMPLETED_OUTCOMES_NOT_PRESERVED**, 기능별 판정은 미수락이다. 기존 gate75는 이전 시도의 기록으로 보존했다. 이번에는 gate1회 획득·실행·소유 서버/브라우저/lease 종료까지 완료했다. 제품과 최종 HTML·이전 증거는 변경하지 않았다. [후속 receipt](../runs/viewer-design-recheck-20261029T062845/receipt.json).

다음 사이클은 결과 객체 반환과 assert/throw가 있는 새 검사 도구를 준비한 뒤 이 7개 조건만 검증한다. 실제 앱의 이미 통과한 검사 묶음은 반복하지 않는다.

## 후속 확인 — 06:35 UTC heartbeat

최종 HTML hash `def73380d19dd49d1ca353e35ac212f5931cbd3a647efb05e10e943474a2a34d`를 바꾸지 않고 미확인 UI 7개를 assertion 기반으로 확인했다. **PASS7 / FAIL0 / NOT_RUN0**, 최초 실패 없음. 검색(데스크톱/작은 화면), fit/orbit의 예시 UI 상태 연결, 구조 drawer Escape 포커스 복귀, reduced-motion의0s 전환, page/console errors 빈 배열을 실제 값과 함께 보존했다. 이는 정적 SVG 시안의 동작이며 실제 CAD 카메라·모델·GPU·파일·내보내기 수락이 아니다.

기록기는 먼저 pure Node에서 false assertion의 FAIL·최초실패·이후 NOT_RUN 저장을 확인했다. 각 성공/실패를 즉시 JSON 파일에 썼다. 기존06:28 결과 누락과 최초검색실패는 수정하거나 PASS로 소급하지 않았다. shared gate1회 획득, browser1회 실행, 소유 서버/브라우저/lease 종료와 포트58237 listener없음을 기록했다. 제품·시안·기존 증거는 변경하지 않았다. [이번 receipt](../runs/viewer-design-asserted-20261029T063545/receipt.json).

제품 HEAD는27500e219로 이동했고 Viewer app/SDK/GPU 경로는a386 이후 변경이 없다. 과거 앱 CPU/build/UI 결과를 새 실행으로 부르거나 반복하지 않았다. Viewer 제안 intake는 해당 commit에 포함됐다. 별도 Studio late Save 변경은 author change 존재만 확인했으며 독립 소스/receipt 검토 전이다. 다음 조사로 넘긴다.

## 공식 제품 문서에서 확인한 참고 범위

선택한 대상에 연결된 측정 정보와 수치의 시각적 대응은 [Onshape Measure 공식 문서](https://cad.onshape.com/help/Content/View/measure_tool.htm)에서 확인했다. 구조 탐색·속성·측정/검사 도구의 역할 구분은 [Autodesk Viewer Tools 공식 문서](https://help.autodesk.com/cloudhelp/ENU/ADSKVIEWER-Help/files/ADSKVIEWER_Help_AutodeskViewerTools_html.html)에서 확인했다. 두 문서는 작업 구분을 검토하는 참고 자료다. 위 레이아웃 수치·색상·우선순위는 BaroCSS 실제 화면에 대한 디자인 제안이며, 외부 문서가 BaroCSS 지원이나 수락을 증명하지 않는다.
