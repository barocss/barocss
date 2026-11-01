# D348 보고 — Feature editor 치수 편집에서 스케치 식별 보존

로드맵 09(고급 스케치)의 첫 한정 항목이다. 소스 커밋은 `a85968f2c`다.

## 무엇이 문제였나

구속된 외곽선 스케치의 치수를 feature editor에서 바꾸면 다음이 일어났다.

- 노드 id, construction, 대상 본체(`on`)가 사라졌다.
- 다른 loop(구멍·부착 원)가 있으면 외곽 측면 ID가 e1..e6에서 e11..e16으로 다시 매겨졌다.
- 그 결과 뒤 fillet 참조가 끊겼다.

실제 Studio run00에서도 Apply가 "The selected edge no longer exists"로 거절되어 문서가 바뀌지 않았다. 사용자는 이 치수를 아예 바꿀 수 없었다.

## 수정

재열기한 주 외곽선(측면·원 ID 포함)에 치수를 적용한다. 기존 노드의 `plane`, `on`, `construction`과 공통 노드 필드를 유지한다. 측면 ID가 없던 옛 노드에는 ID를 새로 붙이지 않는다. Kernel·schema·의존성 변경은 없다.

## 검증

- **Model**: 새 테스트 5개가 통과했다. 기준선에서는 1개만 통과하고 4개가 실패했다. 영향 범위 65/65 PASS, 감사 후 수정분 11/11 PASS, 타입·lint PASS다.
- **Studio**: 단위 테스트 28/28 PASS, 타입 PASS다.
- **독립 Opus 감사**: PASS다. 13종 치수 23회 편집에서 수정본 실패 0, 기준선 실패 23이었다.
- **실제 Studio run01**: PASS다. 다음을 확인했다.
  - 치수 편집 두 번(60→70, 20→25)
  - 값 0 거절
  - Undo/Redo
  - 스케치 재열기(치수·construction 유지)
  - native Save/새 열기 두 번
  - 독립 Python Fraction 검증 5회(최대 부피 차 1.09e-11)
  - 오류 0, 소스 980개가 커밋과 같음
- **이미지**: Root가 직접 확인했다.

## 남은 한계

- 측면 ID가 없는 옛 노드에서는 특정 그리기 순서일 때 구멍 위치 이름이 바뀌어 명시적으로 거절된다(기존 결함, 감사 F1).
- 연결(associative) 스케치에는 치수 필드가 없다.
- Studio의 재열기→Finish 경로는 node extras와 `on`을 잃을 수 있다(감사 S1). 코드 읽기만 했고 미검증이다.

전체 Kernel/Model/Studio 검사, 원격 CI, 성능 측정, 릴리스는 NOT_RUN이다.
