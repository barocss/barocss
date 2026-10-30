# D346 Model 최종 검사

상태는 MODEL_SCOPED_PASS_STUDIO_PENDING입니다. Heavy 게이트를 해제했습니다. Node 22.19.0에서 새 검사 8개와 관련 검사 89개, 총 97개가 통과했습니다. 실패와 SKIP은 없습니다. 전체 Model 타입 검사와 소유 4개 파일 lint도 통과했습니다.

첫 새 검사 8개는 통과했습니다. 첫 관련 검사에서는 88개가 통과하고 1개가 실패했습니다. 기존의 비중점 공선 3점 입력은 계속 VALUE로 거절하지만, 공유 쿼리의 noncollinear/cusp 문구로 바뀌었습니다. 승인된 두 assertion은 오류 클래스, VALUE 및 새 구체적 이유를 검사합니다. 유효한 기존 취소 및 subnormal 중점 검사는 그대로 유지했고 최종 실행에서 통과했습니다.

첫 타입 실패는 새 검사 파일의 중복 spread와 기존 lib에 없는 findLastIndex 사용이었습니다. 첫 lint 실패는 미사용 import 2개였습니다. Object.assign, 명시적 역방향 반복문 및 import 제거로 수정했습니다. 형상 기준과 허용 오차를 바꾸지 않았습니다. 첫 로그, 이전 기존 검사 소스 및 assertion diff를 보존했습니다.

새 curved admission은 실제 간격과 개수로 공유 쿼리를 호출합니다. 길이 estimate를 허용 기준으로 쓰지 않습니다. Raw 입력과 live objectId는 getter 없이 읽고, 기존 64점 입력 한도를 복사 전에 검사합니다. 알려진 공유 VALUE 오류만 Model VALUE로 바꾸며 예상하지 못한 내부 예외는 다시 던집니다.

이 결과는 공개 Part, native BRep, Model 명령, live 소스 편집, 독립 위치·재료 기준 및 파일 검증 범위입니다. 실제 Studio Apply 선택 초기화나 전체 UI 검증은 포함하지 않습니다. 드라이버는 변경하지 않았고 실제 브라우저는 아직 실행하지 않았습니다. Core scalar/work 증명은 High의 v2 검사·감사 범위이며 Model 97개 결과로 확대하지 않습니다.

정확한 소스 해시와 로그 경로는 verification.json에 있습니다. Core 재빌드, Studio 빌드 및 전체 Model 검사는 이 단계에서 실행하지 않았습니다.
