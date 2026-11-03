# 실제 lifecycle desktop 결과

새 native lifecycle provider의 desktop 검사7/7은 PASS입니다. 실제 browser 원본과 lifecycle 데이터의 독립 비교도 PASS입니다. 원본 물리 관찰자15회도 PASS입니다. 전체 동적 P03은 NO_GO입니다.

| 범위 | 실제 결과 | 명령 실행 시간 |
|---|---|---:|
| 기존 UI를 사용한 실제 새 build | PASS | 841.178209 ms |
| 실제 desktop GPU와 lifecycle | PASS · 7/7 | 10627.237083 ms |
| 원본 browser 데이터와 독립 관찰자 | PASS · lifecycle 비교 + 물리15회 | 2963.121875 ms |

각 guard는 exit0입니다. timeout, stopReason, 잔류 owned process group은 없습니다. 시간은 이 한 번의 명령 실행 시간입니다. 성능 보장은 아닙니다.

Chrome156.0.8078.80에서1280/1440/1920을 검사했습니다. page/console/network 오류는 모두0입니다. 정확한 primitive 치수와 pose, 실제 native marker, projection, 접촉점 표와 별도 pair wrench 표를 확인했습니다. Root는 새 실제1440 PNG가 기존 static PNG와 byte가 같은 것을 확인했습니다. 기존 UI를 그대로 재사용했고 실제 물리 출력도 같습니다. Root는 기존 동일 화면을 보았습니다. 새 이미지 생성이나 author browser 재실행은 없었습니다.

실제 census는 World3개, step시도3회, accepted2회, impulse적용128회, query22회, point19개, anchor검사513회, 기록169개입니다. before/at은 첫 cold 정적 구간만 통과했습니다. after는 적용 전에 COUPLED_DYNAMIC_REQUIRED로 거부됐습니다. 원본 model/state/private cache/clock/recording이 유지됐습니다. 이 거부는 동적 물리 PASS가 아닙니다.

실제3개 World의 dispose 직전 public state, 전체 private snapshot과 model을 원본 browser caseOutputs와 비교했습니다. 결과는 원본 word가 같습니다. UI는 recorder를 먼저 dispose하므로 owner는 N/A입니다. bulk read는2회이며 원본16회 상한을 유지합니다. 실제 capture3회, duplicate0회입니다. 반환 copy를 바꿔도 두 번째 read의 저장 word는 그대로였습니다. 추가 World, step, query, impulse는 없습니다.

실제 trace와 lifecycle의 공유 allowance는16MiB-minus64KiB 이내입니다. cell/copy allowance와 직렬화 데이터의 상한입니다. RSS 측정이 아닙니다. 실제 raw stats는 RESULTS.json과 원본 report에 보관합니다. 생존 World 참조가 UI에서 노출되지 않으므로 browser disposed-getter와 cleared-storage 검사는 NOT_RUN입니다. 기존 Node 증거를 browser 증거로 바꾸지 않았습니다.

실제 원본 report는10,750,608B입니다. SHA256은17112d119832717511cbcb169252d94ad021dbe035165fdf4966b7e20ae0e610입니다. report-pin.json이 이를 인증합니다. 완전한 원본 browser DAG는532,144B이며 SHA256은e63284880020f5b43f1dc1b7f6f7a6da6ad0b22134b8a8382e2c859a43f42873입니다. request는2,557,412B이며 receipt SHA256은75fb81c745e385baf622e263ab3bea83c8f7ab19da68258cd95c1be38d6a3093입니다. Request 원문은 별도 보관하지 않았습니다. 독립 감사는 원본 전체 DAG와 report의 hash, 입력·terminal·census·전체 packet 대응을 확인했습니다. 기존1M fragment 상한과15개 관찰자는 그대로 사용했습니다.

실행한 AUTHOR-FREEZE-01.json의 SHA256은ca0c2bc36495334a56bacaa599e63fd5834544a72713f8f7569ee64e77891da2입니다. Frozen workspace2401개와 installed tool metadata357개를 유지했습니다. 기존 UI03 소스와 README는 바꾸지 않았습니다. 실제 새 provider emitted closure를 사용했습니다. Source Physics로 바꾸지 않았습니다.

표시 triangle은 DISPLAY ONLY입니다. CAD 표면 검증이 아닙니다. Browser wire/restore, 다음 interval, transaction, warm support, mobile은 NOT_RUN입니다. Node lifecycle/P2의 기존 검증은 별도 증거입니다. Studio·제조·장비 HOLD, 과거 실패, 원본 cone 실패0.1410596011492487은 그대로입니다. Promotion은 BLOCKED입니다. 배포와 release는 하지 않았습니다.

모든 원본 비압축 tar는 각각16MiB 이하입니다. 전체2401 입력과 실행 증거는 여러 part에 나눕니다. aggregate는 별도 기록하며 단일16MiB 이하라고 주장하지 않습니다. ARCHIVE-FORECAST.json은 생성 전 tar/PAX/hardlink overhead 예측입니다. EVIDENCE-ARCHIVE.json은 실제 크기·SHA와 모든 logical member의 원본 경로·SHA·복원 경로를 기록합니다. Gzip은 저장용 전달 형식입니다. 압축을 해제하면 원본 tar와 정확히 같습니다. GZIP-TRANSPORT-01.json으로 이를 확인합니다.
