# D343 Model consumer handoff

완료 범위: 기존 D342 역사적 mass-refusal 재검사, actual corrected Z-upright Offset 소비자·native/public/Model·파일 증거, 해당 circle 기대값만 수정, 새 longitudinal consumer test, 관련 Model 검증. D342 production guard는 수정하지 않았습니다. 커밋·푸시 없음.

## 보존한 첫 결과

- historical-first.log: 기존 helper/Offset38개 중36PASS2FAIL0SKIP. 기존 circle mass-refusal의 MissingExpectedRefusal2개를 원본 그대로 보존했습니다. polygon strict-invalid FACE_DISTANCE는 유지됐습니다.
- 그 뒤 old assertion 수정 전에 proof-first.log를 실행했습니다. 새 actual existing Offset 소비자1PASS0FAIL. actual-corrected-proof.json은 그 로그의 native B-rep/levels/CP/질량/파일 결과를 추출한 것입니다.
- 실제 request−5.00009, native lo.3456789/hi.34567890000000023, gap1/4503599627370496. Native strict-valid1solid/1closed shell, cap normal CP가 정확한 두 level에 있고 모든 normal CP가 interval 안에 있습니다. Tangent boundary footprint는 원본을 유지합니다.
- Kernel massPropertiesOf(actual Model partSnapshot output)는 representation upright/method closed-form입니다. Kernel/Model/public 모두 V6.278163296415536e−15, Cz.3456789000000001입니다. Exact Fraction midpoint3113598730459687/9007199254740992 및 실제 closed interval과 비교했습니다. Volume은 roundedπR²gap guide이며 exactπ가 아닙니다.
- Native B-rep quadrature는 별도 provider로 보존했습니다. V6.180191251439208e−15와 tangent centroid shift는 UNREPAIRED 관측입니다. 이 provider의 tiny relative volume/centroid 정확도를 두 longitudinal 공식 수정의 PASS로 주장하지 않습니다.

## 실제 consumer 변경과 최종 검증

- native-offset-face.test.ts의 strict-valid circle 역사적 mass refusal만 명시적 성공으로 바꿨습니다. Cache ordinary-retry→tiny-success도 확인합니다.
- offset-face-native.test.ts는 polygon의 FACE_DISTANCE 원자적 거절을 그대로 두고 circle만 actual strict-valid/native/Model/public 성공을 요구합니다. accept-or-refuse 조건으로 약화하지 않았습니다.
- 새 mass-longitudinal.test.ts는 Node-only 독립 BigInt arithmetic으로 midpoint를 만들고, 실제 command composition, source/selection 불변, strict native geometry, Kernel/Model/public positive volume/closed-interval centroid, native file 재개방을 검사합니다. Python prerequisite는 없습니다.
- affected-first.log:44PASS0FAIL0SKIP. 지정 selectors에 해당하는 mass-longitudinal, mass, deferred/frozen-mass, native-offset-face, offset-face-native 파일을 실행했습니다.
- types-first.log: Model type-check PASS.
- lint-first.log: 소유한 Model test3개 lint PASS.
- 최종 D342 guard SHA는 dcd035d18bf4c549b345f0e7054422b021a200e1c835fcb567f528b758bbaafc로 before/after byte-equal입니다.

## 다른 provider의 명시적 분류

provider-classifications.json/provider-summary.json은 X/Y/Z를 actual existing command로 관찰합니다. 이 파일은 mixed acceptance test가 아니라 분류 기록입니다.

- +X: source cap normal CP는 정확히5.1235467, opposite.1234567, d−5.00009, stored requested coordinate.1234567000000002. Guard는 ACCEPTED지만 실제 composition의 native output count는0입니다. 수정 성공으로 주장하지 않습니다.
- +Y: 정확한 cap4.7655222, opposite−.2345678, d−5.00009, stored requested coordinate−.23456779999999977. Guard ACCEPTED 후 실제 native output0입니다. 수정 성공으로 주장하지 않습니다.
- +Z: native output1, 실제 strict-valid/upright closed-form corrected result를 확인했습니다.
- 첫 classification reader는 X/Y의 빈 [0].brep를 읽어 harness TypeError로 잘못 분류했습니다. provider-classifications-first-reader.json/classify-first-reader.log를 보존했습니다. Reader만 고쳐 빈 actual output을 명시적으로 기록한 결과가 provider-classifications.json/classify-corrected-reader.log입니다. 제품 소스는 변경하지 않았습니다.

각 Node22 stage는 별도 serial heavy acquire/EXIT release를 사용했습니다. 최종 gate-final.txt: holder none, slots0. 추가 heavy 작업은 없습니다. API/Studio/browser는 root 단계이며 여기서는 NOT_RUN입니다.

소유 source hash는 final-owned.sha256입니다. Full Kernel 결과는 root 별도 gate 증거이며 이 Model44개로 대신하지 않습니다.

## 최종 actual-result 안전성 보완과 통합 v2

이 절은 위 초기44개/guard-byte-equal 단계 뒤의 승인된 추가 범위입니다. 원본 D342 prospective guard의 근거와 corrected Z 소비자 증거는 유지합니다. 별도 High 소유 helper 파일에는 새 actual-result 검사 함수가 추가됐으므로 최종 파일 전체 SHA를 예전dcd035d…로 주장하지 않습니다. Core3파일은 변경하지 않았습니다.

제 소유 profileCommands.ts wiring은 기존 resolveNativeOffsetFace/validateNativeOffsetDistance와 기존 Extrude.build를 유지합니다. Candidate가 만들어지면 validateNativeOffsetResult(ctx,candidate,profile,d)를 호출하고, 이 검사가 성공해야 candidate를 반환합니다. High는 helper와 native-offset-result.test.ts를 소유합니다.

제 actual command +X/+Y 회귀는 nearfull−5.00009의 빈 target을 반드시 FACE_DISTANCE로 거절하고 source/selection을 보존해야 합니다. 같은 context의 +2 retry는 실제 strict-valid1closed solid와 올바른 normal bounds/positive Model mass/interval 내 centroid를 요구합니다. Z captured success는 그대로 strict하게 검사합니다. accept-or-refuse로 바꾸지 않았습니다.

최초 전체 통합(final-result-first.log)은81개 중79PASS2FAIL이었습니다. 실패는 +X/+Y의 ordinary+2 retry에 새 helper가 'both intended stored target levels must survive the actual composition'를 반환한 것입니다. Nearfull reject와 Z corrected success는 통과했습니다. 당시 types/lint는 PASS였으며 모든 첫 로그와 exit는 보존했습니다.

High v2는 직접8PASS/types/lint 뒤 source freeze했습니다. 최종 통합 결과:

- final-result-v2-first.log:83PASS0FAIL0SKIP.
- 실행 selectors: native-offset-face, offset-face-native, native-offset-result, mass-longitudinal, mass.test(ordinary/deferred/frozen mass 포함), face-commands, feature-handles, sketch-profile-precision, o10-body-keys.
- final-result-v2-types-first.log: 전체 Model type-check PASS.
- final-result-v2-lint-first.log: wiring/helper와 영향을 받은 test4개 narrow lint PASS.
- final-result-v2-first.exit: tests0/types0/lint0.
- 소유 source diff --check PASS.
- gate-final-result-v2.txt: holder none/slots0. Root API/Studio 단계로 sole heavy를 넘겼습니다.

최종 source hash는 final-result-v2-sources.sha256입니다. profileCommands8a1fdc9a…, High helper096d95ed…, High newtestcc4c890f…, own offset testa6aac6af…, mass-longitudinale025ae57…, native-offset-faceaad1c22a…입니다.

브라우저 driver는7facd870…로 변경 없이 동결했습니다. API/Studio/actual browser는 제 단계에서 NOT_RUN입니다. X/Y native quadrature/Boolean를 longitudinal repair의 mass 정확도 PASS로 일반화하지 않습니다. 새 actual-result guard는 이전 X/Y 빈 target 성공을 막고 실제 ordinary retry는 보존합니다. Native quadrature thin 상대오차 관측도 여전히 별도 UNREPAIRED입니다.
