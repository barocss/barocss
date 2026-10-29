# D343 — 프리즘 길이 방향 질량 적분과 소비자 검증

상태는 **BOUNDED_QUALIFIED**다. 최종 소스의 Kernel·Model 검사와 실제 Studio run-03이 정해진 범위에서 통과했다. Root가 화면 네 장을 별도로 확인했다. 최종 문서 gate, 문서 commit과 push는 아직 pending이다. Run-01과 run-02의 실제 실패는 모두 보존했으며, 처음부터 제품 검증이 통과했다고 표시하지 않는다.

기준은 배포된 D342 `4ce1b35c753952010eb6961c62ccd6c6490bd01e`다. 로컬 source commit은 최초 `f9c17c146…`의 11개 파일, circle 후속 `3177950c4…`의 두 파일, cap 후속 `e1ff873c4…`의 세 파일이다. 세 commit의 서로 다른 구현 경로는 총 14개다. 최신 전체 SHA는 `e1ff873c4e0de4dca628c6486c5e99e7b8bcc591`이며 아직 push하지 않았다.

## 결과와 수정 범위

보존한 사례는 반지름 3, 높이 5.00009인 원기둥을 `[0.1234567, -0.2345678, 0.3456789]`로 옮기고 위쪽 면에 `-5.00009` Offset을 적용한 것이다. 실제 native interval은 `[0.3456789, 0.34567890000000023]`이다. 간격은 `1 / 4503599627370496` mm로 양수이며 4 ulp다. 기존 함수가 계산한 법선 중심 0.34375는 물체 밖이었다.

Kernel은 기존 `h = b - a`를 유지하고 두 길이 방향 적분을 인수분해했다. 식은 `h2 = h * (a / 2 + b / 2)`, `h3 = h * (a*a + a*b + b*b) / 3`이다. 단면 적분, 합산 순서, 밀도와 오류 계약, method, geometry, 공차와 native SI 경로를 바꾸지 않았다. 독립 Node oracle은 binary64를 BigInt rational로 해석하고 원래 거듭제곱 적분으로 기대값을 만든다. 제품 식을 기대값으로 복사하지 않는다. 중심 오차와 실제 closed interval 포함 여부를 별도로 검사한다.

보정된 법선 중심은 `0.3456789000000001`로 정확한 midpoint이며 실제 interval 안에 있다. Node 공개 Part의 tiny volume은 `6.278163296415536e-15` mm³, 실제 Studio raw volume은 `6.278163296415537e-15` mm³다. 두 runtime 사이의 1 ulp 차이를 bit 동일성으로 주장하지 않는다. 각각 독립된 represented-endpoint midpoint와 rounded-circle volume guide를 통과했다. π는 반올림된 guide이며 exact π 증명이 아니다.

질량 보정 뒤 기존 consumer 문제도 드러났다. X/Y 회전 원기둥은 prospective guard를 통과해도 실제 Boolean이 target을 없애고 witness만 남길 수 있었다. 이제 공유 Offset build는 기존 Extrude/Boolean candidate를 만든 뒤 `validateNativeOffsetResult`를 통과한 경우에만 반환한다. 정확한 recipe와 마지막 target key/ref, 실제 strict-valid 1 solid / 1 closed shell, full cap support level, strict boundary normal interval, 제한된 tangent extent, 실제 Model mass를 묶는다. Witness가 target을 대신하지 못하며 ordinary retry 성공도 유지한다.

이 검사는 해당 Offset build 시점의 postcondition이다. 저장되는 새 Offset feature나 일반 Boolean/file/edit 검증기가 아니다. 이후 임의 parameter 변경, direct feature 편집이나 다른 파일 경로에서 자동으로 다시 실행된다고 주장하지 않는다. Normal/extent 검사도 전체 재료 동일성, 임의 side surface 내부, tangent centroid, inertia나 quadrature 정확도의 증명은 아니다.

실제 브라우저 실패로 두 후속 수정을 추가했다. Circle 사전 조건은 bounding half-span의 exact 등호 대신 유한한 양수 여부를 확인한다. 원형 권위는 기존 전체 rational whole-circle proof이며 ellipse 거절도 유지한다. Cap provenance는 `cp.z === z`로 stored height를 선택한다. 같은 높이의 region membership, first-containing 우선순위와 fallback은 그대로다. 이름을 제외한 native geometry·mass·recipe는 재생 비교에서 정확히 같았다. 새 공차, 최소 두께, 좌표 수정이나 centroid clamp는 없다.

## 최종 엔지니어링 검사

| 단계 | 결과와 범위 |
|---|---|
| Kernel 원본 집중 검사 | 25 PASS, 19 FAIL, 0 SKIP. 첫 오류를 보존했다. |
| Kernel 질량 보정 | 집중 44 PASS, 관련 68 PASS. 공통 기록 43개의 volume/mass bit는 그대로다. |
| Cap identity owner | 집중 8 PASS, 관련 105 PASS, build/types/narrow lint PASS. |
| 최종 Root Kernel 전체 | **2,325 PASS, 0 FAIL, 기존 SKIP 6개 / 등록 2,331개**. 최초 전체 2,317 PASS / 기존 SKIP 6개 / 등록 2,323개 기록도 남겼다. |
| 최종 영향 Model | **86 PASS, 0 FAIL, 0 SKIP**. 전체 Model types와 변경 test lint PASS. Public cap의 고유성·선택 비모호성·파일 재개방 이름을 포함한다. |
| 독립 source review | Kernel formula/oracle 및 최종 v4 cap identity에 blocking finding 없음. 리뷰가 runtime을 실행한 것은 아니다. |
| API·Studio | 최초 9개 gate PASS. Chat 23개, types, generated/API 계약과 변경 없는 driver lint는 명시적으로 재사용했다. Circle·cap 수정 후 Studio Vite rebuild도 PASS다. |

Full Model suite와 full Studio suite는 NOT_RUN이다. 집중·관련·전체 단계의 겹치는 검사 수를 합쳐 새로운 총계로 만들지 않는다. Vite PASS가 경고 없는 build를 뜻하지 않으며 driver lint는 오류 0개와 `no-console` 경고 1개다.

공개 inventory는 Model app 함수 `validateNativeOffsetResult` 하나를 추가했다. Exposure는 6,833개에서 6,834개로 늘었다. 삭제 0, 기존 **shape** 변경 0, presentation-only 변경 0이다. Private 구현의 동작은 결함을 고치기 위해 의도적으로 바뀌었다. Circle/cap 후속에서 추가 export는 없으며 새 node/schema/persistence format도 없다.

## 실제 Studio run-03과 화면 검토

최종 checkpoint의 run-03은 PASS다. 공개 API 시드를 실제 viewport mouse로 선택하고 정확한 `-5.00009`를 입력했다. Preview와 Apply, raw height/from 및 source prefix, accepted pick 비움, Undo/Redo, native Save/fresh Open, 별도 ordinary `+2` control을 검사했다. Public group은 고유 3개, native physical face는 4개로 각각 유지됐으며 파일 재개방 후 이름도 같았다. Witness `b4`의 이름과 420 mm³ / 중심 `[86, 0.5, 3.5]` control은 기록된 허용오차 안에서 유지됐다.

실행 수는 Chrome 1개, serial context 3개, 관측 state 14개, native read 6회, 독립 Fraction oracle 4회, 실제 Studio mass read 4회, 실제 mouse pick 2회, accepted selection 검사 2회, native file 1개와 download 1회다. State 14개를 등록 test 14개라고 부르지 않는다.

Source capsule은 generation 전 13개 subset에서 시작해 generation 후 bundle input 728개를 동결했다. After와 cleanup 후도 각각 728개로 일치했다. 이것을 generation 전 전체 served graph의 증명으로 확대하지 않는다. Page error, console error, watched source change는 모두 0개다. 세 context, browser와 server는 모두 닫혔다.

Root는 preview, thin 결과 Iso, fresh Open의 thin Iso, visible ordinary control Iso의 네 이미지를 확인했다. 별도 판정은 **SCOPED_VISUAL_AND_PRODUCT_FLOW_PASS**다. 화면은 실제 UI·renderer 존재와 흐름만 확인한다. Float32 bounds나 pixel로 4 ulp 두께·cap identity·정확한 geometry·raw mass를 증명하지 않는다. 이 수치 권위는 native coefficients와 네 독립 oracle 검사다.

## 보존한 첫 실패와 재개방

Model의 역사적 기대값은 처음 36 PASS / 2 FAIL이었다. 실제 Z corrected command/native/Model/public/file 성공을 먼저 확인한 뒤 낡은 circle mass-refusal 기대값만 바꿨다. Strict-invalid polygon의 FACE_DISTANCE 거절은 유지한다.

Actual-result 집중 검사는 0/6 → 4/6 → 6/6 PASS를 거쳤다. 이후 통합이 79 PASS / 2 FAIL을 내면서 v1 검토를 재개방했다. Ordinary X/Y `+2`가 vertex endpoint 조건에서 거절됐기 때문이다. 미사용 SIDE support pole을 material bound로 본 다음 시도도 7 PASS / 1 FAIL이었다. 최종 direct 검사는 8 PASS, v2 통합은 83 PASS다. 예전 source PASS로 이후 runtime 실패를 덮지 않았다.

Run-01은 원래 cap 선택에는 성공했으나 preview가 `[VALUE] Offset face: the native circular cap needs one finite circular bound.`로 거절됐다. 당시 phase label은 viewport pick에 남았지만 실제 timeout은 preview였다. Chrome native half-span은 3과 3.0000000000000004, Node는 3과 3이었다. 특정 Math 내부 원인까지 입증하지 않았으며 기존 whole-circle proof를 유지한 채 사전 등호를 고쳤다. High 집중 26개와 영향 Model 86개가 통과했다. Captured STEP 시도의 거절과 잘못된 support 가정도 첫 로그와 함께 보존했다.

Run-02는 preview/Apply와 raw corrected mass에 성공했지만 public 이름이 `n1.bottom`, `n1.bottom`, `n1.side0`으로 중복됐다. 물리 face 4개와 논리 group 3개가 다른 것은 정상이나, 두 cap의 public alias 충돌은 실제 결함이었다. Unique-name 검사를 제거하지 않고 exact-height provenance를 수정했다. 이후 새 Kernel 전체, 새 Model 검사와 run-03이 통과했다. 두 실패 run도 page/console/watch error 0개 및 완전한 cleanup을 기록했다. 모든 첫 기록과 v1–v4 source review를 보존한다.

## 미해결 범위와 다음 순서

Native B-rep quadrature는 **UNREPAIRED**다. 같은 tiny native 원기둥에서 체적 `6.180191251439208e-15` mm³와 이동한 tangent centroid를 기록했으며 rounded circle guide보다 체적이 약 1.56% 작다. Upright provider가 통과했다고 이 provider의 정확도를 승인하지 않는다. 일반 central inertia, 2D Green 적분, overflow/subnormal 극한, 다른 provider, generic naming/material 보증과 성능도 D343 결론 밖이다.

다음 source-only 계획은 기존 roadmap16/CG10의 native quadrature conditioning이며 STEP 소비자 경로도 포함한다. 구현·검증 완료가 아니다. 이 미해결 16 정확도 작업이 remaining ordinary 08보다 앞선다. 08은 열려 있고 09는 08 뒤이며 Electron 15는 대기 상태다. 새 병렬 queue는 만들지 않는다.

최종 문서 검사는 통과했다. 파일 출처와 staged 공백 검사를 마친 뒤 문서를 commit하고 일반 push를 진행한다. Remote CI, release, full Model/Studio suites, 성능 benchmark는 NOT_RUN이다. Hash는 출처 증거이며 geometry나 제품 검증을 대신하지 않는다.
