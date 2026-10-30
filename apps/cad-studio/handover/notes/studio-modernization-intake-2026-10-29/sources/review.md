---
work_id: studio-modernization-20261029
artifact_type: design_review
status: draft
owner_role: design-review
source_request: "cad studio 도 최신화 하는걸로 리뷰해줄 수 있어?"
last_updated: 2026-10-29
---

# CAD Studio 최신화 리뷰

**기존 UI 기반을 유지하면서 도구 탐색, 편집 패널, 숫자와 작업 상태의 우선순위를 정리하는 방향이 적합하다.** 모델이 차지하는 넓은 영역과 버전 비교의 직접적인 시각 피드백은 유지한다. 제품 코드는 변경하지 않았다.

기준은 `a5d1acfa7e6834951819eaaeeaf6da314cae9b8f`의 고정 소스다. 소스 27개를 hash/Git blob과 대조했다. 해당 commit에 보존된 작성자 실행 PNG 3개를 실제 열어 확인했다. 그중 2개는 1440×900 전체 화면이고, 나머지는 Versions 패널의 299×343 crop이다. 원래 실행은 `27500e219…`와 작성자 D323 project.ts 변경의 조합이다. 새 a5d1 브라우저 실행으로 부르지 않는다.

검토 종료 시 HEAD는 `d85558ce0031d812341d5871743f8535520eb8d4`였다. `apps/cad-studio/src`와 Studio package.json은 기준 a5d1 이후 변경이 없었다. GPU의 새 수정은 별도이며 이 리뷰의 런타임 수락에 포함하지 않는다.

보존된 작성자 실행 화면: 아래 이미지는 디자인 관찰 근거이며 이번 독립 실행 결과가 아니다.

![작성자가 보존한 CAD Studio 기본 모델 화면](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runtime/studio-ux-a5d1/apps/cad-studio/handover/notes/canonical-version-snapshot-2026-10-29/consumers/actual/01-starter-plate-loads.png)

## 후속 실제 화면 확인

사용자 추가 요청을 처리하는 동안 exact `d85558ce0031d812341d5871743f8535520eb8d4`의 새 격리 snapshot에서 공개 UI 6개 흐름을 확인했다. **PASS6 / FAIL0 / NOT_RUN1(Sketch)**. 초기 Model1440×900, tree body 선택, 기존 feature editor 열기/닫기(값 변경 없음), Render, Drawing, Model1280×800이다. page/console errors는0개다. 6개 PNG를 helper가 열었고 부모는 편집/도면/1280 화면을 직접 열었다.

- 1440×900에서도 Body 상세 뒤의 feature editor가 아래로 이어져 Apply 영역을 보려면 스크롤해야 했다. 버튼이 영구적으로 없거나 조작 불가하다는 뜻은 아니다.
- Drawing에서는 Sheet 설정과 일반 Body/Analysis가 오른쪽 두 열을 차지했다. SUX-2/5의 정보 우선순위·설정 영역 통합 근거를 보강한다.
- 1280×800에서 mode 버튼은 유지됐고 기본 형상 도구는 overflow로 이동했다. 가로 넘침은 없었다. 긴 아이콘열은 그대로였다.

Vite 실제 입력은 pinned source1042개(CAD422/Model311/GPU131/app178), workspace resolution420개, 원본 소스 escape0/자체dist0이다. 이번 snapshot은1156파일/17,110,442bytes, source manifest SHA `d4e347dab3298a4e4793a377f966bef8c58683b25796a339477bd746ff0b02b5`다. Chrome156.0.8078.48, guard1회·probe/acquire/release0, 소유 browser/server/context/process 정리를 기록했다. 이전 자산 누락/guard75 기록은 그대로 보존했다.

이것은 새 **기존 제품의 화면 관찰**이다. 현대화 제안의 구현, geometry 편집·Save/Open·오프라인 Render·CAD/GPU 성능 수락은 아니다. [새 화면 보고서](runtime-followup-072849.md), [각 흐름·소스·정리 근거](../../runs/studio-ux-20261029T072849/result.json).

## 현재 화면에서 보이는 문제

1. **상단 한 줄에 서로 다른 일이 섞여 있다.** 문서명, 기본 형상, 작업공간, Undo/Redo, 파일·프로젝트·내보내기가 모두 작은 아이콘으로 이어진다. 파일을 다루는 일과 모델을 편집하는 일을 빠르게 구분하기 어렵다는 디자인 판단이다.
2. **왼쪽 도구열은 길지만 분류 이름이 보이지 않는다.** 자주 쓰는 명령도 아이콘을 기억하거나 tooltip을 확인해야 한다. 소스에는 이미 명령 검색과 가용성 사유가 있다. 이를 찾기 쉽게 노출하면 된다.
3. **오른쪽 패널이 여러 목적을 한 열에 쌓는다.** Browser, Versions, Gravity, Part, Preview & Analysis가 이어진다. 선택 대상의 편집과 문서 관리·진단의 시각적 순서가 약하다.
4. **작은 글자와 비슷한 강조 수준이 화면을 조밀하게 만든다.** 소스는 기본 12px, 필드 라벨/카드 제목 11px, 일부 badge 10px다. 이는 접근성 실패 판정이 아니라 가독성 개선 근거다.

위 1–3의 외형과 비교 화면의 강점은 실제 보존 이미지에서 관찰했다. 활성 명령의 상세 입력이 화면 아래로 밀리는 빈도, 작업시간, keyboard/focus, 좁은 창의 실제 겹침은 이번에 독립 실행하지 않았다.

## 먼저 바꿀 네 가지

| 순서 | 개선안 | 근거와 최소 완료 조건 | 기존 로드맵 |
|---|---|---|---|
| 1 | **이름 있는 도구 분류와 검색** | 기존 registry/palette를 사용한다. 자주 쓰는 명령과 현재 선택에서 가능한 명령을 이름으로 찾는다. 거부·비활성 사유도 읽을 수 있다. | 21, 15, 20 |
| 2 | **현재 명령을 Inspector 맨 위에 고정** | 명령명 → 선택한 참조 → 값/단위 → 미리보기 상태 → Apply/Cancel 순서다. 상세 내용만 스크롤한다. 현재 명령이 Browser·Versions 아래로 밀리지 않게 한다. | 20, 21, 15 |
| 3 | **치수와 파라미터 연결의 가독성** | 작업 글자 13–14px를 디자인 목표로 삼고, 숫자·단위·연결된 이름·아직 적용하지 않은 값을 구분한다. 기존 정밀도·공차·단위 변환은 보존한다. | 15, 20, 16 |
| 4 | **편집·계산·저장 상태와 행동을 분리** | Preview Cancel, 본 계산 Stop, import/repair Cancel, queued Apply, 미저장, 저장·복구를 서로 다른 의미로 표시한다. 기존 D321/D322의 수락·거부·소유권 규칙을 유지한다. | 20, 15, 12, 16 |

입력은 현재 숫자와 이름 있는 파라미터 연결이 확인된 범위다. 임의 자유 수식 편집기가 이미 구현됐다고 가정하지 않는다. 디자인 변경으로 새 수식 엔진이나 편집 계약을 추가하지 않는다.

## 권장 화면 구조

| 위치 | 역할 |
|---|---|
| 공통 파일 바 | 문서/프로젝트명, 저장 상태, Undo/Redo, 열기·저장·내보내기 |
| 작업별 명령 바 | Model/Sketch/Render/Drawing의 현재 문맥과 이름 있는 도구 묶음, 명령 검색 |
| 객체·피처 탐색 | 기존 Browser/History에서 현재 대상과 편집 위치를 설명한다. 작업 중에도 최소한의 이름·문맥은 남긴다. |
| 중앙 | 모델·스케치·도면과 선택/미리보기 피드백을 크게 유지한다. |
| 작업 Inspector | 선택 대상 또는 현재 명령의 입력과 참조를 우선한다. Versions·Analysis 등은 목적별로 접거나 전환한다. |
| 고정 상태 영역 | 현재 작업의 계산/거부/오류와 가능한 행동. 파일 저장 상태와 형상의 최신 여부를 구분한다. |

이는 배치 제안이며 구현 시안이나 제품 적용 결과가 아니다. 패널을 이동할 때 작업공간별 데이터 구조를 유지한다. 조립 인스턴스를 선택하면 기존 배치·mate 참조와 좌표계를 우선 표시한다. 새 Assembly 작업공간이 이미 있다고 표현하지 않는다.

다음 단계에서는 다음 세 항목을 함께 맞춘다.

- **History의 문맥 연속성:** 현재 피처 이름과 편집 위치를 보여 준다. 기존 History는 명령/Sketch/Render 중 숨겨지는 경로가 있다. 읽기 전용 요약을 유지해도 계산 중 허용하지 않는 편집은 계속 거부한다.
- **작업공간별 하나의 설정 영역:** Drawing의 내부 설정 패널과 바깥 Inspector가 모델 영역을 동시에 압박하지 않도록 역할을 정한다. Render의 frozen still과 현재 형상은 구분한다.
- **키보드와 작은 창:** tooltip의 이름/사유를 focus로도 확인하고, Escape의 대상·패널 닫기 후 focus 복귀를 명시한다. 비모달 Inspector에 일괄 focus trap을 넣지 않는다.

## 유지할 장점과 기능

큰 모델 영역, 버전 비교의 초록색 추가 형상과 체적 badge는 유지한다. badge의 수치 정확도는 이번 디자인 검토에서 재계산하지 않았다.

React19/shadcn/Radix/cmdk, light/dark, 접는 dock, 명령 검색, overflow 도구, 숫자 단위, named parameter binding, 미리보기·거부·적용 상태, Sketch constraints/DOF, Drawing 도구와 Render/assembly 관련 기능은 이미 있다. 이를 새로 필요한 전체 기능으로 등록하지 않는다. 기존 컴포넌트로 정보 구조와 표시 순서를 고치는 범위가 우선이다.

Viewer와는 타이포그래피·색의 역할·버튼·focus 규칙을 맞출 수 있다. Studio의 직접 작업은 로드맵 **15/20/21**에 연결한다. **05는 Viewer**, **16은 정확도·참조·거부**, **12는 저장·버전·복구**의 별도 수락 범위다.

## 구현 후 필요한 검증

1. 한 실제 모델에서 도구 찾기 → 참조 선택 → 값/파라미터 변경 → 미리보기 → 적용/취소 → Undo/Redo를 끝낸다.
2. Sketch 치수/constraint, Drawing annotation, 조립 참조 선택에서 같은 정보 순서를 확인한다. 기존 지원 범위를 사용한다.
3. 1440×900과 1280×800에서 값·단위·참조·Apply/Cancel을 읽고 조작한다. 900px급 창은 별도 축소 정책을 정의한다.
4. 키보드로 명령을 찾고, 거부 사유를 읽고, 취소 후 canvas로 돌아간다. 대비·focus·screen-reader는 실제 검사한다.
5. UI 이동 후에도 Save/Open, Stop/refusal, 실패 시 accepted state 보존은 기존 별도 게이트를 유지한다. 화면 개선만으로 이 검사를 통과 처리하지 않는다.

## 실행 증거와 한계

- **소스 검토 완료:** exact a5d1, 27개 소스의 hash/blob 확인. [소스 상세](source-review.md), [소스 기록](source-evidence.json).
- **작성자 화면 관찰 완료:** 보존 PNG 3개를 helper와 부모 검토자가 실제 열었다. [화면 관찰](runtime-review.md), [화면 출처·범위](runtime-evidence.json).
- **최초/승인된 repair UI 흐름: NOT_RUN(역사 기록).** 첫 시도는 우리 snapshot에 exported `cad-model/samples/rows/*.json`이 누락된 setup 오류였다. 제품 FAIL로 세지 않았다. 원래 로그·manifest를 보존했다.
- **자산 보완 완료:** corrected snapshot 1,169파일, manifest SHA `c7330b8c9fe8923cf487e3aa1c331e811e0dad5a266814ff5ea2c068859f0680`. 승인된 별도 재실행은 shared guard가 높은 부하에서 exit75로 거부했다. 새 Vite/Chrome는 시작되지 않았고 우회·추가 재시도도 없었다.
- 초기 Vite가 기록한 일부 입력 경로 감사와 완전한 앱 실행은 다르다. corrected snapshot의 실제 전체 import/build/browser 검증은 남아 있다. 상세 명령·최초 실패·cleanup은 위 runtime 기록에 있다.
- 제품, GPU WIP, 사용자 파일·탭·서버는 변경하지 않았다. 이 리뷰는 CAD 기하·성능·자원·고객 파일·배포 또는 상용 CAD 전체 수락이 아니다.

## 근거 위치

아래 링크는 고정 snapshot 파일이다.

- [도구와 명령·dock 연결](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runtime/studio-ux-a5d1/apps/cad-studio/src/App.tsx:3640)
- [현재 명령·선택·입력·Apply/Cancel](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runtime/studio-ux-a5d1/apps/cad-studio/src/ui/Hud.tsx:54)
- [글자·필드·도구열 스타일](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runtime/studio-ux-a5d1/apps/cad-studio/src/styles.css:15)
- [파라미터 연결](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runtime/studio-ux-a5d1/apps/cad-studio/src/ui/ParametersPanel.tsx:26)
- [dock 구조](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/runtime/studio-ux-a5d1/apps/cad-studio/src/layout/Dock.tsx:14)

작업별 도구/문맥 구분은 [Fusion Workspaces 공식 문서](https://help.autodesk.com/view/fusion360/ENU/?contextId=GS-WORKSPACES)를 참고했다. 선택 입력·숫자 입력과 미리보기·수락·취소의 구분은 [Onshape Dialogs 공식 문서](https://cad.onshape.com/help/Content/Home/dialogs.htm)를 참고했다. 위 배치와 우선순위는 BaroCSS 소스·화면을 검토한 디자인 판단이며, 외부 문서가 BaroCSS의 기능 지원이나 수락을 증명하지 않는다.
