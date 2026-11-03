# 검증 결과와 재검토 경로

현재 README.md와 실행 소스는 AUTHOR03의 frozen 입력입니다. 이를 바꾸지 않았습니다. 최신 실행 결과는 RESULTS.md와 RESULTS.json을 사용합니다.

실제 실행은 AUTHOR03 → build01 → desktop01 → audit01입니다. Desktop6/6과 실제 browser 데이터 독립 관찰자15회는 PASS입니다. 동적 물리는 NO_GO입니다. after는 정상적인 미지원 거부이며 물리 PASS가 아닙니다.

검토자는 EVIDENCE-ARCHIVE.json의 각 archive와 logical member SHA/byte를 확인할 수 있습니다. SOURCE part는 frozen workspace 원본1840개와 AUTHOR03을 보관합니다. PROOF part는 실제 실행 산출물, 완전한 DAG, 감사 입력·출력, screenshot3개, 명령 guard3개, AUTHOR01/02/03, 원본03 source/build01 recovery와 withdrawn04 proposal을 보관합니다. 외부 tool binary는 포함하지 않습니다. 이미 frozen tool pin과 명령 영수증을 사용합니다.

recovery/author-03-build-01/index.json은03 원본의 logical 경로를 보존 파일에 연결합니다. recovery/author-04-proposal-withdrawn/index.json은 실행하지 않은04 제안을 연결합니다.04는 실행용 freeze가 아닙니다. Root의 stale-read 정정이 최종 사실입니다. 실제03에는 model 필드가 이미 있었습니다.

각 archive는 비압축16MiB 이하입니다. 상한을 늘리지 않았습니다. 모든 part의 aggregate는 별도로 명시합니다. archive는 일반 file member만 사용합니다. symlink나 외부 file 참조는 없습니다. 다운로드·설치·배포·Git 변경·새 수치 실행은 수행하지 않았습니다. 서버53020과53001은 건드리지 않았습니다.
