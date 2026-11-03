# 실행 결과와 복원 절차

Frozen README.md의 NOT_RUN은 작성 당시 기록입니다. 이를 바꾸지 않았습니다. 최신 실행 결과는 RESULTS.md/json과 실제 guard3개를 사용합니다. 실제 실행 순서는 AUTHOR01 → build01 → desktop01 → audit01입니다. Desktop7/7, genuine lifecycle 원본 비교, 기존 물리 관찰자15회는 PASS입니다. 동적 물리는 NO_GO입니다.

SOURCE part는 frozen workspace2401개와 AUTHOR01을 원래 logical 경로로 보관합니다. 새 actual lifecycle native closure, 기존 frozen UI03, 모든 SDK 입력과 기존 qualification 입력을 포함합니다. 외부 compiler binary는 넣지 않습니다.357개 tool pin metadata를 유지합니다. PROOF part는 실제 bundle/metafile/build receipt, 완전한 원본 DAG, report/report-pin, 원본 lifecycle raw subtree export, decoded 감사 입력·출력, screenshot3개와 guard3개의 모든 파일을 보관합니다. 새 실행이나 원본 소스 수정은 없습니다.

검토자는 EVIDENCE-ARCHIVE.json과 SOURCE-RECOVERY.json의 경로·byte·SHA를 사용합니다. 같은 archive 안에서 byte/SHA가 같은 파일만 앞선 regular member에 대한 표준 tar hardlink로 저장할 수 있습니다. 각 logical member의 내용과 hash는 같습니다. link는 같은 archive의 앞선 실제 member만 가리킵니다. 외부 파일과 symlink는 없습니다.

GZIP-TRANSPORT-01.json은 저장용 전달 map입니다. 각 .tar.gz를 해제한 뒤 원본 .tar의 byte/SHA를 기존 EVIDENCE-ARCHIVE.json과 비교합니다. 이어 모든 logical member를 해당 index와 비교합니다. 상한은 압축 전 tar마다16MiB입니다. 여러 part의 aggregate는 별도로 명시합니다. serialized/cell/copy bound는 RSS가 아닙니다. 원본 tar와 index/forecast는 그대로 local에 보존합니다. Root가 Git 작업을 담당합니다. raw tar 대신 압축 archive를 저장할 수 있습니다.

원본 UI와 기존53020/53001, 새53040 서버는 작성자가 건드리지 않았습니다. 추가 World/reference/build/browser/observer/decoder 실행은 없습니다. 포트 수동 preview의 재시작은 Root만 담당합니다. 배포·모바일·release·mainDocs 변경은 없습니다. 모든 HOLD와 과거 실패는 그대로입니다.
