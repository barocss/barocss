# D337 결과

상태: BOUNDED_QUALIFIED. 평면 곡면의 단순 trim 루프1개를 유지하며 Reverse하는 범위를 검증했다. 전체08 완료를 뜻하지 않는다.

- 소스:481105e400d713e2b79f7160c307836fc65bd13a. 드라이버 수정:7cd5726657b7823356f213dbe8e35c40422499d2.
- Kernel: 집중8PASS, 관련19PASS. 전체2237PASS/0FAIL/기존6SKIP. 빌드·타입·린트 PASS.
- Model:33PASS/0FAIL, 타입 PASS. 이전 NOT_RUN 인계 기록은 보존했다.
- High 검토: NO_REQUIRED_FINDINGS. 소스12개 범위이며 검토자 런타임은 NOT_RUN.
- API: 공개 이름 추가7/삭제0/변경0. 기존6규칙 SCOPED_PASS. package export-map 키·스키마·core checks는 변경 없음.
- 실제 Chrome/WebGPU run-02: 단일 FULL_FLOW PASS. 관찰29개이며 테스트29개가 아니다. 컨텍스트6개를 순서대로 사용했다. 오류·콘솔 오류·소스 변경은0이다.

실제 Trim by the curve가 생성한160점을 사용했다. U/V축, outside/inside, 오목 루프를 검증했다. 재료 면적1100/100을 유지했다. 오목한 저장 루프 면적130.95906250000002와 설계 면적131은 구분했다. 기존1e-7 UV·세계좌표 기준은 각각 유지했다.

IGES·Thicken·Sew·비평면 Reverse 거부4개를 확인했다. Thicken/Sew는 각각 실행 대상1개인 상태에서 거부했다. 문서·선택이 유지됐으며 추가 Undo 항목은 없었다. 비평면 거부 뒤 Undo/Redo와 유효 입력 재시도도 통과했다. native 저장·다운로드1회와 새 Open에서 승인 UV·keep·ID·소스의 의미 일치를 확인했다. 바이트 동일성은 주장하지 않는다. 별도 solid의 keyb1·부피420·중심[86,.5,3.5]은 유지됐다.

run-01은 브라우저·서버 실행 전에 virtual stdin 경로 ENOENT로 실패했다. 정확한 기록을 보존하고 경로 제외를 수정했다. 별도 cp 상대경로 오류도 원문을 보존했다. 제품 실패로 분류하지 않는다.

생성 전9개 입력은 실행 직전 목록의 해당 입력과 일치했다. 실행 직전720개 입력은 실행 후·정리 후 일치했다. 전체 served graph 검증은 아니다. Manifest와 원본·압축 해시를 제공한다. 최종 문서 검사 상태는 qualification.json을 따른다. 일반 곡면·여러 루프, trim IGES·solid, 전체 Model/Studio/GPU/Viewer, 성능·원격 CI·릴리스는 수락하지 않았다. 남은08을09보다 먼저 진행한다. Electron15는 대기 상태다.
