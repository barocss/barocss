# Actual dynamic contact desktop results

동적 after 상태를 선택한 데스크탑 GPU 검사 7개, 실제 브라우저 원본의 독립 물리 검사 18개와 Node 비교 패킷 6개를 모두 통과했습니다. 단일 접촉점의 첫 구간만 검증했습니다.

| 캠페인 | GPU 화면 선택 | 실제 화면 검사 | 독립 물리 검사 | 전체 복호화 패킷 비교 |
|---|---|---:|---:|---:|
| desktop-01 | before1 | 7/7 PASS | 18회 PASS | 6개 PASS |
| desktop-02 | after1 | 7/7 PASS | 18회 PASS | 6개 PASS |

각 캠페인은 같은 원래 세 입력을 새 브라우저에서 실행했습니다. 각각 World 3개, 시도 3회, 승인 3회, 실제 적용 192회, query 30회, 반환점 27개, anchor 검사 729회, 진단 기록 243개입니다. 두 캠페인의 합계를 하나의 3-World 상한으로 표현하지 않습니다.

Chrome 156.0.8078.80에서 가로 1280·1440·1920px을 검사했습니다. 두 GPU view의 실제 픽셀, 상자의 실제 치수·pose, 접촉 marker·projection, 접촉점 표와 별도 충격량 표를 확인했습니다. resize·카메라·표시 선택은 물리를 다시 진행하지 않았습니다. 페이지·콘솔·네트워크 오류는 두 캠페인 모두 0개입니다. Root는 실제 desktop-02의 1440px PNG에서 after1 선택을 직접 확인했습니다.

원래 desktop-01은 after의 실제 승인 상태·pose를 검사했지만, GPU 해상도 검사와 PNG는 before1을 선택했습니다. 이 범위를 보존하고, 별도 render continuation에서 after1을 선택했습니다. 앱·Viewer·Physics·입력·8×8 반복과 공차는 바꾸지 않았습니다. 새 캠페인도 같은 3-World 상한과 180초·16 MiB 기준을 사용했습니다.

Source Physics로 대체하지 않고 실제 host build-02의 NodeNext emitted JS closure를 로드했습니다. 브라우저가 저장한 실제 여섯 패킷을 기존 Native Node의 전체 복호화 패킷과 비교했습니다. 수치·필드·provider·진단 ID를 제거하거나 바꾸지 않았습니다. DAG 파일의 사전 배치는 달라도 전체 원본 데이터와 이진64 word는 같습니다. 이후 세 사례의 초기 기하·물리, 승인 후 기하·물리 ledger·마찰·독립 gold target을 각각 검사했습니다.

실제 dispose 직전 캡처 3개와 반환 copy 격리를 확인했습니다. 캡처 API는 두 번 읽었습니다. 실제 저장 원본과 report의 완전한 SHA를 대응시켰습니다. browser refs가 노출되지 않아 dispose 후 getter 검사는 NOT_RUN입니다. 기존 Node 검증을 브라우저 검증으로 바꾸지 않았습니다. 데이터/cell/copy 상한을 검사했으며 RSS를 측정한 것은 아닙니다.

desktop-02 report는 12595744 bytes, 원본 DAG는 767194 bytes입니다. 정확한 SHA는 RESULTS.json에 있습니다. report·원본 capture·패킷·독립 관찰자 결과를 모두 보존했습니다. 원래 audit runner는 실행하지 않았습니다. 별도 audit-browser-02는 남은 spawn timeout을 정수로 내리는 수정만 적용했으며 시간 상한과 수치 검사는 그대로입니다. 첫 독립 audit의 외부 실행 게이트 거부도 별도 NOT_RUN 기록으로 남겼습니다. 정상 admission 후 저장된 원본을 검사했으며 그 거부 때문에 World를 다시 실행하지 않았습니다.

display triangle은 화면용 primitive이며 CAD native surface 증거가 아닙니다. 화면은 물리 정답의 기준으로 쓰지 않았습니다. 브라우저 wire·두 번째 성공 구간·이전 구간 캐시 재사용·여러 접촉점·원래 8-box 장시간 안정성·공개 패키지 채택·장비 예측은 미검증 또는 기존 NO_GO입니다. 모바일은 사용자 지시에 따라 실행하지 않았습니다. HOLD·공차·최초 실패를 유지했고 배포·릴리즈는 하지 않았습니다.
