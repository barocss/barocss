# Actual clean World results

소스와 실제 NodeNext 컴파일 경로에서 원래 세 입력을 모두 통과했습니다. 실제 동적 마찰 after도 승인됐습니다. 전체 엔진이나 장시간 적층 PASS는 아닙니다.

| 검증 | 실제 결과 |
|---|---|
| 첫 host build 01 | NO_GO · ESM 범위 누락으로 CommonJS 출력. 컴파일 exit 0, World 0회 |
| 별도 build 02 | PASS · stage/emitted의 ESM 범위 명시, 원래 C 출력 바이트 일치 |
| Source / NodeNext Native | 각각 World 3개, 시도 3회, 승인 3회 |
| 실제 적용 | 각 경로 192회: 사례마다 전체 J 1회와 0 충격량 63회 |
| 실제 기하 관측 | 각 경로 query 30회, 반환점 27개, anchor 검사 729회 |
| 독립 관찰자 | 각 경로 18회 PASS |
| Source/Native 비교 | 전체 26개 파일의 원본 바이트 일치. 정규화 없음 |

after의 실제 producer와 몸체에서 측정한 값은 두 경로에서 같습니다.

| 측정 | 실제 값 | 기존 기준 |
|---|---:|---:|
| 법선 접촉 속도 잔차 | 2.245727290605634e-18 m/s | 1e-10 m/s |
| 마찰 크기 잔차 | 3.26936304418379e-18 N·s | 1e-12 N·s |
| 최대 마찰 반대 방향 잔차 | 3.2620547630988122e-18 N·s | 1e-12 N·s |
| 최종 접선 속도의 하한 | 0.14415413024243495 m/s | 1e-10 m/s 초과 |
| 실제 중점 일 | -0.019189277255532176 J | 기존 에너지·일·수동성 기준 통과 |

위 소수는 저장된 독립 유리수·구간 결과의 표시입니다. 판정에는 실행 전 고정된 기준과 원래 정밀 결과를 사용했습니다. before·at의 전체 정적 결과와 인증서도 이전 원본과 일치합니다. 실제 접촉점·캐시·몸체 변화·이벤트 합계·producer wrench를 각각 검증했습니다. 계산 후보의 자체 잔차만으로 판정하지 않았습니다.

World·producer·private-phase·lifecycle·C 정적 솔버 소스는 검증된 조상과 같습니다. 새 shared production 산술 코어는 고정된 import 경로 변경만 적용했습니다. 시험 진입점과 독립 기준 코드는 실제 runtime import에 없습니다. 첫 모듈 형식 실패는 원본 stage·emit·로그와 함께 보존했습니다. 02는 stage/emitted에만 type:module을 명시하며 원본 폴더의 package 범위는 바꾸지 않았습니다.

TypeScript strict·declaration·noEmitOnError와 실제 소비자 검사를 실행했습니다. 기존 조상과 같은 skipLibCheck=true 및 private-phase/replay-validation 두 파일의 기존 nocheck 범위는 유지했습니다. 새 면제는 없으며 전체 host가 엄격한 타입 검사 대상이었다고 주장하지 않습니다.

실제 예측 census와 결과가 일치합니다: 각 경로 records 243, applications 192, queries 30, points 27, anchors 729. 공유 진단 데이터는 853375 bytes입니다. 기존 180초·16 MiB·8×8 상한과 공차는 그대로입니다. Source 실행은 6022.910458 ms, Native는 5815.4675 ms였으며 성능 보장은 아닙니다.

이 결과는 단일 cold 접촉의 첫 구간만 포함합니다. 동적 적용 후 실패 원자성, wire/restore, 다음 성공 구간, warm·다점·일반 관성, 동적 화면과 원래 8-box 장시간 안정성은 별도 검증입니다. 실제 장비 예측과 제조 안전성은 주장하지 않습니다. 공개 패키지 채택·배포·릴리즈는 하지 않았습니다.
