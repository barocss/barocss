# D349 보고 — 스케치 재열기→Finish에서 본체·노드 필드 보존

로드맵 09의 두 번째 한정 항목이다(D348 감사 S1). 소스 커밋은 `e8befb6cc`다.

## 무엇이 문제였나

본체 위에 그린 스케치를 다시 열고, 아무것도 바꾸지 않은 채 Finish만 해도 다음 필드가 사라졌다.

- `on`(스케치를 그린 본체)
- 노드 부가 필드(suppressed, held, bought 등)

그 결과 이 스케치로 Extrude, Revolve, Sweep을 할 때 Join/Cut 선택(Operation)이 나오지 않았다. 실제 Studio 기준선 run00에서도 `on`이 사라지는 것을 확인했다.

## 수정

제자리 Finish 결과에 저장돼 있던 노드 부가 필드와 `on`을 유지한다. 연결(associative) 스케치는 기존 동작 그대로 자기 `on`을 쓴다. Studio 파일 하나만 바꿨다.

## 검증

- **Studio hook 테스트**: 영향 범위 37/37 PASS. 새 테스트 2개는 수정 전 코드에서 실패한다. 타입·lint PASS.
- **독립 Opus 감사**: PASS. 평가 문서와 커밋 문서가 같은지 확인하는 단언을 추가했다.
- **실제 Studio run02**: PASS. 다음을 확인했다.
  - 변경 없는 Finish
  - 점 편집
  - Operation 선택 표시(join/new/cut)
  - Cut 결과 부피 22125
  - Undo/Redo
  - native Save와 새 열기 두 번
  - 독립 Python 검증 6회
  - 오류 0
  - 소스 980개가 커밋과 같음
- **이미지**: Root가 직접 확인했다.

run01은 드라이버 문제(Extrude에 쓰인 스케치의 history 경로)로 실패했다. 해당 경로를 고친 run02를 정식 실행으로 삼고, run01 기록은 보존했다.

## 남은 한계

- 변경 없는 Finish에서 JSON 키 순서가 바뀐다. 내용은 같다.
- chat `edit_feature`로 노드 전체를 교체할 때는 `id`만 유지된다(별도 메모, 변경 안 함).

전체 검사, Vite build, 원격 CI, 성능 측정, 릴리스는 NOT_RUN이다.
