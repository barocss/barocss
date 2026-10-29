---
work_id: drawing-assistant-20261029
artifact_type: benchmark-and-acceptance-proposal
status: source-comparison-complete-runtime-not-run
owner_role: research-coordinator
source_request: 사용자가 전달한 Autodesk Assistant 도면 자동화 글을 BaroCSS 상용 CAD 로드맵에 연결
last_updated: 2026-10-29
---

# 자연어 도면 생성: 기존 도구를 연결한 검토 가능한 초안

BaroCSS의 다음 목표는 기존 Drawing 엔진과 Assistant 도구로 실제 부품의 검토 가능한 도면 초안을 완성하는 것이다. 새 도면 엔진부터 만들 필요가 있다는 근거는 없다. 이번 검토는 정확 `1266cdf24943acc5963bf5e346339e32c9f3da41`의 소스 비교다. 제품의 App 분리 WIP를 사용하거나 수정하지 않았다. **도면 runtime·browser·파일 roundtrip·live AI는 NOT_RUN**이다.

## 공식 글의 의미와 근거 범위

[Autodesk 공식 글](https://www.autodesk.com/products/fusion-360/blog/automate-drawing-creation-autodesk-assistant/)(James Krenisky, 2026-09-03)은 자연어로 규격·단위·용지·뷰·치수 설정을 돕고, 치수 배치·제조 의도·검토·승인은 사용자가 맡는 흐름을 소개한다. 이 글은 수치 성능이나 전체 GD&T 적합성의 검증 자료가 아니다. 연결된 영상은 보지 않았다. 아래 수락 예시는 이 글의 명령을 인용한 것이 아니다.

이 자료에서 도출한 제품 방향은 **자연어 요청 → 구조화된 도구 실행 → 검사 가능한 초안 → 사용자 검토·승인**이다. 자연어 해석과 도면 계산의 검증을 분리한다.

## 현재 기능과 후속 요구

| 대상 | 소스에서 확인한 현재 기능 | 필요한 최소 완료 증거 |
| --- | --- | --- |
| CAD Model | `set_drawing`, 결정적 배치 planner, `auto_dimension`, `drawing_issues`, 제한된 수정·공차 제안. SDK도 같은 Drawing 도구를 사용한다. | 기준 브래킷의 외형·홀 치수, 참조와 경고를 예상값과 대조한다. |
| Studio / Assistant | Drawing 도구 schema·dispatcher, proposal과 사용자 수락 경로, 편집 Undo/dirty 연결이 있다. | 승인 전 문서 불변, 수락·거절·Undo와 변경 요약을 실제 UI에서 확인한다. |
| 단위·규격·도면 세트 | 검사한 설정 경로는 mm, A4/A3 단일 sheet와 투상 설정이다. units/ISO/ASME preset은 해당 schema에 없다. | 기존 **CG5 / DR7(규격·inch), DR8(도면 세트)** 범위에서 명시적 계약과 파일 증거를 만든다. |
| 저장·교환 | `Part.drawing()`은 같은 sheet의 SVG, DXF R2000, PDF와 `pdfMissing`을 반환한다. native Save/Open 연결도 있다. | native roundtrip의 의미·참조 보존, 세 출력 hash·화면과 font 누락 기록이 필요하다. |

Auto는 assembly scope에서 명시적으로 거부된다. 자동 배치는 용지를 A3로 바꾸거나 뷰를 제외할 수 있다. 이는 현재 지원 범위이며 이번에 재현한 버그가 아니다. 전체 엔진에 단위·규격·조립 도면 기능이 전혀 없다는 주장으로 확대하지 않는다.

## 기존 로드맵에 붙일 하나의 수락 작업

**DA-1 제안:** 지정 브래킷의 A4/mm 도면 초안을 만들고 정면·평면·우측·등각뷰, 외형·홀 치수와 누락·참조 경고를 검토한다. fixture hash, 기준 치수와 원래 허용 오차를 실행 전에 고정한다.

기존 도구의 `set_drawing({scope:{kind:'part'},sheet:'A4',projection:'third',front:'y-',views:['front','top','right','iso'],scale:'auto'})` 후 `auto_dimension({layout:false})`를 사용한다. `layout:false`는 지정한 용지·배율·뷰를 유지하기 위한 조건이다. mm는 현재 계약이며 존재하지 않는 units 필드를 추가한 예시가 아니다.

1. 같은 입력을 proposal과 SDK 직접 경로에서 각각 확인한다. 직접 SDK 호출은 사용자 승인 시험과 구분한다. 승인 전 문서 불변과 수락·거절 결과를 기록한다.
2. 기준 치수·홀 callout을 비교하고 missing/lost/REMATCHED·겹침·남은 경고를 기록한다. 검사 오류 0을 제조 승인으로 해석하지 않는다.
3. native Save/Open 후 도면 의미와 참조를 비교한다. raw byte 동등성과 의미 동등성은 따로 기록한다.
4. 같은 sheet의 SVG/DXF/PDF hash, `pdfMissing`과 도면 화면을 하나의 receipt에 보존한다.

완료 상태는 **REVIEWABLE_DRAFT** 또는 구체적인 미해결 항목이다. 자동으로 APPROVED나 MANUFACTURING_READY를 부여하지 않는다. 최초 gate는 live AI 없이 기존 도구로 실행한다. 자연어 해석의 정확도는 이후 별도 범위다.

기존 **CG5/DR1–8, O26, RS7.6**에 연결한다. DR7/DR8은 별도 기능 범위로 유지한다. 독립 구현 대기열을 만들거나 진행 중인 App 분리의 우선순위를 바꾸지 않는다. 이번 결과는 요구·검증 공백이며 새 재현 결함은 없다. GitHub 결함 이슈를 만들지 않았다.

## 소스 근거

세부 함수·줄 번호와 17개 소스 hash는 [source-review.md](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/research/drawing-assistant-20261029/source-review.md)와 [evidence.json](/Users/user/Documents/ChatGPT/barocss/.omx/research/cad-commercial-readiness-20261029/research/drawing-assistant-20261029/evidence.json)에 있다. 줄 번호는 위 commit 기준이다. 실제 실행 PASS와 소스 연결 확인을 합산하지 않는다.
