# Shared arithmetic actual results

생산 회귀와 독립 산술 경계 검증은 PASS입니다. 실제 World·브라우저 동적 마찰은 NOT_RUN입니다.

| 단계 | 실제 결과 | 호출 범위 |
|---|---|---|
| 고정 리터럴 입력 변환 | PASS | 계산 후보·World 0회 |
| 최초 strict build 01 | NO_GO · TS18048 | 계산 후보·World 0회 |
| 별도 strict build 02 | NO_GO · TS4060/TS4058 | 계산 후보·World 0회 |
| 별도 strict build 03 | PASS · 선언·소비자·실제 import 경로 | 계산 후보·World 0회 |
| 생산 Source / NodeNext Native | 각각 PASS | 각각 13회, 상한 16회 |
| 생산 원본 비교 | PASS | 각 경로의 전체 14개 파일이 이전 결과와 정확히 일치 |
| 독립 산술 Source / NodeNext Native | 각각 PASS | 각각 52회, 별도 상한 64회 |
| 산술 원본 비교 | PASS | 전체 52개 결과와 입력 은행, 53개 파일 일치 |

생산 after 계산은 241975개 정수 연산으로 완료했습니다. 상한 262144는 바꾸지 않았습니다. gcd 23153회, 유리수 생성 771회, 최대 1297비트, 분할과 최대 지수는 각각 66입니다. 완료하지 못한 이전 후보의 gcd 계수와 비교해서 개선율을 주장하지 않습니다.

생산 전체 결과·증명·모든 계수의 원본 일치 오차는 0바이트입니다. 알려진 다항식 인수와 IEEE 반올림 셀을 사용하는 별도 관찰자가 52개 결과를 각각 검사했습니다. 허용치를 실행 후 변경하지 않았습니다. 정해진 보수적 거부와 낮춘 한도 초과는 각각 고정 기대 결과로 판정했습니다. 한도 상향 요청은 산술 context를 만들기 전에 거부했습니다.

생산 runtime import는 6개 JS 파일이며 시험 모듈은 없습니다. 시험 import는 4개 JS 파일입니다. 두 경로는 같은 실제 math-core.js를 참조합니다. Source도 같은 stage의 math-core.ts를 사용했습니다. 일반 물리 입력에서 시험 한도를 선택할 수 없습니다.

AUTHOR 01의 531개 해시, continuation 02의 567개 해시와 continuation 03의 593개 해시를 Root가 확인했습니다. 첫 실패 기록과 수정 전 파일은 그대로입니다. 03은 callback의 non-null 표시와 반환 타입 표기만 바꿨습니다. strict·declaration·noEmitOnError 검사는 유지했습니다.

정확한 명령·guard 결과·입력 및 출력 해시는 RESULTS.json과 ROOT-QUALIFICATION-01.json에 있습니다. 이 유한 검증은 모든 다항식·수치 입력의 증명이 아닙니다. 실제 접촉 적용, 실패 시 상태 보존, recorder·복원·연속 실행, 동적 화면, warm·다점·일반 관성·원래 8-box 장시간 안정성은 별도 게이트입니다. 공개 API 반영과 전체 엔진 완료는 선언하지 않습니다.
