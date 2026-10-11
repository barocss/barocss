# #1179 동결 전 모델·consumer 교차 검토

상태: SOURCE-ONLY 완료. 저장 소스를 읽었다. import/parser/AST/test/build/reference/수치/model/World는 실행하지 않았다. repo 파일은 수정하지 않았다.

## 결론

현재 A 모델과 B consumer/controls에서 구체적인 cross-API 차단 문제를 찾지 못했다. 이전의 projection-ready 부분 보고 문제는 A의 atomic assignment 이동으로 해결됐다. root의 actual source freeze 후 첫 build/trial로 진행할 수 있다. 이 검토는 numerical GO가 아니다.

## 확인한 정합성

| 항목 | 현재 소스 근거 |
|---|---|
| 고정14/첫 genuine | `fixtures.mjs`는 genuine-orbital FIRST, rest/signedzero/endpoints/네 stop directions/두 impulse/torque+impulse/Z1, overload LAST다. genuine와 overload는 CAP_REFUSAL이다. consumer는 원래208B BEFORE 버퍼와 genuine literal의 일치를 확인한다. old after/result는 seed가 아니다. |
| 원래 단계와 authority | candidate는 unchanged parent preparation→original command/parser/angular-only admission→options 순서다. source/angular→original motor once→original FREE→adopted projection once다. input.carrier report를 그대로 motor 인자로 준다. FREE carrier는 raw13만 바꾸고 report/cursor/meta를 유지한다. |
| null/atomic report | 완료한 A/B frame만 해당 stage 뒤에 복사한다. jointReport/bodyCorrections/reportCap은 makeDiagnostics 성공 뒤 energy/work와 함께 저장하고 report-ready로 전환한다. 그 전 거절에서는 다섯 보고 필드가 null이다. C의 마지막 완료 단계 규칙과 맞는다. |
| cap/단위 | report는 FREE baseline의 original sub→scalar scale J/K다. KB/JB를 report에 넣고 j는 별도다. finite report helper는 cap을 적용하지 않는다. cap helper는 실제 norm>.01만 거절한다. ±.01 equality, 그보다 큰 값과 nonfinite vector의 pure controls가 분리돼 있다. 새 linear cap이 없다. |
| signed work | native spin midpoint는 source→angular와 angular→motor에 각각 sub/add/dot, `.5*I` multiply, A/B sum 순서를 쓴다. motor midpoint/residual/free ΔK/projection ΔK는 signed다. diagnostics validator의 nonnegative 검사는 phase KE와 objective에만 적용한다. |
| callback 우선순위 | options는 parent+commands 뒤에 등록된다. admission/options 실패는 callback0이다. known later error는 copied reached attempt 한 번과 실제 같은 error 재throw다. unknown received value는 serialization/callback 없이 전파한다. 성공 callback과 cap은 catch 밖에 있다. observer throw는 cap보다 먼저 나오며 cap에서 두 번째 callback이 없다. cap attempt.error는 null이다. |
| output/attempt 대응 | consumer는 실제 returned bodies와 diagnostics.projected frame/complete parent bodies, report/target을 검사한다. callback이 있으면 frames/motor/projection/corrections/energy/work/cap/calls/report도 비교한다. C는 RETURN의 top-level report를 내부 comparison view에 연결하고 producer schema를 바꾸지 않는다. |
| CAP의 actual proof | output=null이므로 outputAttemptCorrespondence는 null을 허용한다. report-ready attempt에는 full frame/report/work/cap/complete parent projection이 필요하다. pairMetricErrors는 attempt에 metrics가 없으므로 null이다. parentActualQualified와 다른 complete actual checks는 null을 허용하지 않는다. |
| first mismatch 분류 | consumer는 unknown thrown value, invalid schema, unresolved reference를 EXECUTION_FAILURE로 저장하고 원래 값을 다시 던진다. resolved mismatch/mandatory disposition 차이는 NO_GO로 기록하고 다음 named case를 중지한다. earlier known numerical error는 CAP로 바꾸지 않는다. mandatory expected CAP도 accepted-output count로 올리지 않는다. |
| raw/sign | bodies208B/commands24B-per-vector 원래 순서로 보관한다. input raw와 commands raw의 불변을 검사한다. raw zero witness와 non-body negative-zero paths를 별도로 저장한다. decoded JSON만으로 모든 signed-zero equality를 주장하지 않는다. |
| copy | model은 each occurrence에 새 copy를 만든다. pure report copy, observer mutation, returned bodies/frames/report/parent branches의 native mutation controls가 있다. JSON 참조 comparison은 object alias/throw identity proof를 대신하지 않는다. |
| helper 호출 수 | +.9/-.9은 parent preparation+original motor direct helper로만 실행하도록 작성됐다. projection0이며14 table에 추가하지 않는다. perpendicularly admitted boundary/report/cap data guards도 separately counted다. late error/defaults/copy/observer controls의 실제 staged calls는 counts에 누적한다. parent93과 World는 호출하지 않는다. |
| typed proxy 경계 | parent bridge는 변경되지 않는다. 새 known error checker는 own DATA descriptors만 읽고 판별 실패/반사 오류 시 실제 받은 값을 보존한다. consumer ordinary marker controls는 stronger inherited typed-proxy identity를 주장하지 않는다. |

## 물리 예측과 source 검토의 한계

- genuine와 overload의 실제 CAP_REFUSAL은 아직 측정하지 않았다. 이전 detached spin 또는 ideal overload 식이 새로운 출력의 증거는 아니다.
- 첫 earlier parent/body/system/diagnostic refusal가 나오면 reached stage/nulls와 실제 code/message를 저장해야 한다. mandatory CAP 기대를 변경하거나 작은 입력으로 교체하지 않는다.
- mode/source/repeat/genuinecompiled, exact source/adoption/raw/input pins, actual build/type/emitted와 오류 영수증은 root의 다음 실제 gate다.
- matched CAP는 staged report 의미 qualification이다. accepted World step 또는 1200-step/Viewer/public/release GO가 아니다.

## 검토한 소스

`/Users/user/.codex/worktrees/physics-hinge-motor-1179/barocss/examples/physics-rigid-hinge-motor-reference/` 아래 candidate.ts, motor-stages.ts, report.ts, diagnostics.ts, copy.ts, options.ts, errors.ts, types.ts, fixtures.mjs, raw.mjs, consumer.mjs, controls.mjs.

원래 명령/profile/error 우선순위를 확인할 때 같은 tree의 `packages/barocss-physics/src/joints.ts`, `validation.ts`와 채택된 #1349/#1309 admission/profile 소스를 읽었다. 새 helper/알고리즘 또는 추가 campaign을 제안하지 않는다.
