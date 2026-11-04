# 실제 정적 접촉 desktop 결과

AUTHOR03/build01 실행 결과는 PASS입니다. whole P03 동적 물리는 NO_GO입니다.

| 범위 | 실제 결과 | 실행 시간 |
|---|---|---:|
| 실제 GPU bundle build | PASS | 842.665834 ms |
| Desktop browser 검사 | PASS · 6/6 | 9838.711166 ms |
| 실제 browser 원본 데이터 독립 감사 | PASS · 원본 관찰자15회 | 2249.327375 ms |

시간은 이 한 번의 명령 실행 시간입니다. 성능 보장은 아닙니다. 각 guard는 exit0이며 timeout, stopReason, 잔류 owned process group이 없습니다.

Chrome156.0.8078.80에서1280/1440/1920 화면을 확인했습니다. 실제 GPU box, pose, collider 치수, native marker, projection, 접촉점 표, 별도 pair wrench 표, 카메라와 저장 화면 선택을 검사했습니다. page/console/network 오류는 모두0입니다. Root는 실제1440 screenshot도 보았습니다.

실제 전체 이력은 World3개, step시도3회, accepted2회입니다. 기록169개, impulse적용128회, query22회, point19개, anchor검사513회입니다. before/at은 첫 cold 구간에서 정적 접촉을 통과했습니다. after는 적용 전에 COUPLED_DYNAMIC_REQUIRED로 거부했습니다. state/model/clock/private cache/recording 원본이 유지됐습니다. 이 거부는 동적 물리 PASS가 아닙니다.

before/at의 실제 contact velocity residual과 static cone excess는 원본 독립 관찰자에서0입니다. 최대 current tangent-plane residual은1.8973538018496328e-19 Ns입니다. 최대 represented normal norm-squared residual은3.958934816492807e-16입니다. ledger와 다른 항목의 원본 maxima는 RESULTS.json에 그대로 기록했습니다. 이 값은 새로 관찰자를 실행해 얻은 값이 아닙니다.

원본 browser request는2,557,412B입니다. receipt SHA256은147eb0ac49d7a271ccfef4e70972c26457f6b44ec1b194bc4c6aea61da931105입니다. Request 원문은 별도로 보관하지 않았습니다. 전체 원본 데이터는 unchanged SHA/pool DAG로 보관했습니다. DAG는532,144B이며 SHA256은5ed22114850604ada27a22b671a1cd3de4942d41586dcf1679a300e39535b65e입니다. 감사는 이 파일의 hash와 전체 DAG를 확인한 뒤 원본 관찰자를 실행했습니다.

실제로 실행한 freeze는 AUTHOR-FREEZE-03.json입니다. SHA256은0e3b3470f1900707422bd12e60e57c8da3a59609c7baef60d9bcd8741699cdaf입니다. Root의 초기 preflight는 오래된 소스를 읽었습니다. 실제03에는 model 진단 필드가 이미 있었습니다. 소스 버그나 browser 실패는 없었습니다. 작성 중인04 제안은 별도 보존한 뒤 현재 소스를03으로 복원했습니다. 현재1840개 pin은03과 같습니다. 실제 실행은 모두03/build01을 사용했습니다. 과거 recovery 문서의 preflight review 표시는 이 정정 기록과 함께 읽어야 합니다.

표시 triangle은 정확한 primitive 치수를 사용한 DISPLAY ONLY입니다. CAD 표면 검증이 아닙니다. 다음 구간, warm support, wire/restore, mobile은 NOT_RUN입니다. Studio·제조·장비 HOLD는 그대로입니다. 동적 물리와 promotion은 NO_GO입니다. 원본 cone 실패0.1410596011492487도 그대로입니다. 배포와 release는 수행하지 않았습니다.

SOURCE/PROOF archive의 각 비압축 크기 상한은16MiB입니다. 전체 frozen workspace 입력1840개는 분할 SOURCE에 포함합니다. 실제 bundle/metafile, 전체 proof, 독립 감사, screenshot, guard3개와03/04 recovery는 PROOF에 포함합니다. ARCHIVE-FORECAST.json은 생성 전 예측입니다. EVIDENCE-ARCHIVE.json은 실제 archive SHA, 크기, aggregate와 모든 logical member의 원본 경로·SHA·크기를 기록합니다.
