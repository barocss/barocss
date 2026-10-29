# D337 Studio 드라이버 준비

- 상태: SOURCE_PREPARED. `node --check` PASS.
- 브라우저, 빌드, 기하 런타임: NOT_RUN. Root 실행 승인을 기다린다.
- 소유 파일: `apps/cad-studio/test/trimmed-surface-reverse-browser.mjs`.
- D336 드라이버와 제품 코드는 수정하지 않았다.
- 실행 게이트: `D337_SOURCE_FROZEN=1`.
- 공개 Model `importSource`로 트림 없는 원본 파일을 만든다. 실제 Studio Trim by the curve가 160점 트림을 만든다.
- 주 흐름: outside → Reverse U → Undo/Redo → Reverse V → IGES/Thicken/Sew 거부 → Undo/Redo → Save → 새 컨텍스트 Open → 재선택.
- 추가 흐름: inside 160점, 오목한 160점, 비평면 160점 Reverse 거부와 유효 입력 재시도.
- 공개 compileCadModel 결과에서 direct object.geometry로 표면을 찾는다. 독립 쌍선형 리프트, 다각형 면적·중심, 재료 탐침으로 저장된 루프를 비교한다. 허용 오차는 1e-7이다.
- 표면 재료 면적은 표시 메시 면적 또는 솔리드 질량이 아니다. 별도 박스의 체적 420, 중심 [86,0.5,3.5], 키를 확인한다.
- Chrome 프로세스는 하나다. 컨텍스트를 순서대로 닫고 연다. 오류, 다운로드, watcher 변경, 소스 전후 해시와 정리 결과를 남긴다.
- 네이티브 파일은 승인된 UV, keep, ID, 소스 문자열을 포함한 문서 의미 일치를 확인한다. 두 번 Reverse의 비트 동일성은 요구하지 않는다.
