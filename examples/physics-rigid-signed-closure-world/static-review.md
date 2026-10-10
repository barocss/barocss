# #1384 source-only static review

대상: physics-signed-closure-world-1384 lane의 entry/policy/world controls, closure phase/apply/types, 작성된 World/island 소스. 소스를 읽었다. 실행·import·AST·solver·oracle·World·build·types·commit은 하지 않았다. 아래 줄 번호는 검토 시점이다.

## 실행 경로를 막는 결함

1. **entry.mjs:9 잘못된 export 경로.** zeroLiveSignedClosureStats는 closure-types.ts에 없다. live-phase.ts:10에 있다. entry의 경로를 바꿔야 한다. 이 상태면 module linking 단계에서 실패한다.
2. **policy-controls.mjs:11 dynamic velocity 누락.** cap fixture의 dynamic body에는 massKg만 있고 필수 velocityMps가 없다. 원래 validation.ts:134/23–25는 undefined를 거절한다. [0,0,0]을 넣어야 36 initial detections/ROW_CAP/solver0 guard에 도달한다.
3. **world-controls.mjs:18 late fixture velocity 누락.** dynamic a에도 velocityMps가 없다. constructor에서 거절되므로 accepted-first-step과 late outer-result guard를 검증하지 못한다. 계약에 고정한 [0,0,0]을 넣어야 한다. 그 이후 free-ready → velocity-ready → closure-ready → outer movement → commit 순서는 소스에서 확인했다. 실제 도달 여부는 미측정이다.

root에 세 결함을 즉시 전달했다. 마지막 소스 재읽기에서 **세 결함 모두 root가 수정한 것을 확인했다**. entry export는 live-phase.ts이고, 두 dynamic literal에 velocityMps:[0,0,0]이 있다. 처음 발견한 결함을 남겨 둔 기록이며, 현재 남은 실행 차단 결함은 아니다.

## 고정 계약의 아직 없는 control

4. **policy-controls.mjs:14는 부모 정상 JSON literal만 읽는다.** 부모 controls.mjs의 8/9-row admission/refusal, nonunit/mass/bounds, sparse input, result tamper, unknown getter receipt는 재사용하지 않는다. 새 world-controls의 solver fault 일부가 result/unknown 경로를 다루지만 이 admission guard를 대신하지 않는다. CONTRACT §7의 해당 guard를 source freeze 전에 추가하거나 root가 정확한 범위를 문서로 선택해야 한다. 수치 law를 바꾸는 요청이 아니다.
5. **observer 복사본 mutation guard가 없다.** world-controls.mjs:11은 getter snapshot mutation을 검사한다. observeAttempt와 observeStepAttempt는 자료를 배열에 push하거나 값을 던지며, callback에 전달된 body/row/point를 바꾸는 guard는 없다. 소스는 structuredClone을 사용하지만 해당 독립 control은 아직 없다.

## API 설명의 작은 불일치

6. **rows.ts:70의 exported buildLiveInitialProblem은 optional capture를 변경한다.** CONTRACT는 이 helper를 pure로 설명한다. 현재 2-argument 경로는 입력을 바꾸지 않는다. 3-argument 경로는 capture.problem/rowSources/initialDetections/tests를 바꾼다. 공개 export를 2-argument로 제한하고 별도 내부 scan 함수에서 capture를 사용하거나, root가 해당 내부 호출 경계를 명시해야 한다. 물리 알고리즘 차이는 없다.

## 확인한 사항

- root의 chain cap literal은 재읽기 시 cap[1]=b0/b2만 실패하도록 수정돼 있다. 이전 at[0]=protected b0/b1 결함은 현재 없다.
- apply.ts:42는 부모와 같이 applications:1을 반환한다. 1..9 adapter만 바뀌었으며 static 위치에는 0을 더하지 않는다. metadata/q/v/omega 복사와 원래 validateResult를 유지한다.
- live-phase.ts:40의 initial cap은 실제 solve:47보다 앞선다. 초기 36 hit가 있을 때 choices=[]다.
- 같은 PRE를 유지하고 새 apply copy를 매 choice 만든다. 전체 hypothesis scan → protected 우선 → 8-row cap → fresh PRE bound<0 → append 순서다. 다른 solver/normal query를 주입하지 않는다.
- mapLiveError는 instance+code+exact message만 변환한다. reflection 실패는 원래 unknown 값으로 돌아간다. observer Error/object/null은 같은 값이 전파되고 working apply 전에 중단된다.
- phase observer의 성공 자료 count=0, returned accepted working phase count=1이다. tentative finalBodies는 observer 전에 저장한다. World accepted getter의 commit은 outer movement/result 뒤에 있다.
- StepAttempt에서 free-ready는 velocity/final/points=null, velocity-ready는 final=null, closure-ready는 완성 frame을 갖는다. 미도달 phase를 accepted 자료로 만들지 않는다.
- 정책 helper의 전체 미보호 coverage는 Body 기반 phase가 보장한다. pure 누락 guard는 protected RowSource가 hypothesis에 없는 경우로 선택한 root 결정과 일치한다.

이 검토는 source/control/API 검토다. 물리 통과, actual error receipt, 수치 정확도 또는 World GO를 증명하지 않는다.

## 두 번째 검토: 새 consumer/reference 자료

root가 추가한 sparse/admission/result-tamper/getter controls와 observer mutation control을 읽었다. 기존 항목 4의 주요 refusal/tamper/unknown coverage와 항목 5는 추가됐다. build helper의 내부 capture 경계는 root가 문서로 명시한다고 선택했다. validated INFEASIBLE 주입은 syntheticSolverFault:true로 표시되어 실제 문제의 일반 feasibility 증거로 쓰지 않는다. 부모 정상/negative kernel literal 자료는 수정하지 않았다.

새 실제 결함은 다음과 같다. 제품 소스는 편집하지 않았고 root에 각각 전달했다.

1. **consumer.mjs:23 / archive.mjs:10 — budget 실패를 같은 제한 writer로 다시 저장한다.** 최초 write가 `live signed world evidence budget exceeded`를 던지면 catch의 writer.write도 같은 상한에서 다시 거절될 수 있다. 그러면 current accepted/stages/attempt와 partialReport 저장 없이 finally dispose로 간다. budget의 마지막 prefix와 실패를 보존하는 별도 bounded emergency receipt 경로가 필요하다.
2. **consumer.mjs:14 / reference.py:312,360 부근 — 독립 growth 답을 실제 다음 row/refusal과 비교하지 않는다.** reference는 growthCheck.expectedAction/pairKey를 반환하지만 consumer는 violations와 마지막 depth만 확인한다. reference의 previousChoiceRows 검사는 prefix+one append만 확인한다. 따라서 이전 독립 hypothesis의 lex winner가 아닌 다른 PRE-separated pair를 append해도 이 gate는 잡지 못한다. next.rowSources[-1].pairKey를 이전 독립 pairKey와 비교하고, protected/row-cap 답은 실제 typed refusal과 비교해야 한다. 추가 solver나 geometry seed는 필요하지 않다.
3. **reference.py:256–268 — actualCertificateExact의 의미가 다르다.** exact Fraction residual을 float certificate로 바꾼 뒤 Fraction.from_float(value)로 되돌린 문자열이다. 이는 정확한 residual이 아니라 반올림된 binary64 값의 rational 표현이다. exact 문자열은 원래 Fraction에서 만들고, 기존 Float64 comparison gate는 그대로 둘 수 있다.
4. **consumer.mjs:14 / reference.py:340–346 — SOLVED partial choice의 hyp null.** phase는 valid SOLVED solution을 보존한 후 apply/result bounds에서 거절할 수 있다. hypBodies는 아직 null이다. consumer가 solution!==null만 확인하고 complete choice request를 보내면 reference는 raw_bodies(null,null)에서 REFERENCE_INPUT을 반환한다. 물리 거절이 execution failure로 바뀐다. hypothesis 미도달 SOLVED는 partial 자료로 보존하고 complete observer request를 보내지 않아야 한다. INFEASIBLE/null hypothesis 경로는 별도 허용된 protocol 그대로다.

반환/request key 일치는 확인했다: choice의 14 keys, rowSelections=RowSource[], previousChoiceRows, step-ledger의 op/scene/stepIndex/outcome/ledger/raw 및 raw before/free/velocity/final이 맞는다. resolved!==true 또는 executionFailure!==false는 실행 실패로 처리한다. valid resolved violations는 quality NO-GO로 남는다. 마지막 accepted choice의 raw/normalized depth를 1e-12로 검사하며 intermediate hypothesis depth 자체를 모두 실패로 처리하지 않는다.

bundle은 실제 다른 source/source-repeat/compiled 파일을 만들고 own source 포함, legacy phase/relaxation/retrospective builder 부재를 확인한다. runner는 controls 앞에 source pins와 사전 emitted 파일 hashes를 읽는다. rawBodies는 body 수×104 bytes를 쓴다. reference-controls.mjs는 검토 시점에 아직 없었으므로 그 export/interface의 완료 확인은 하지 않았다.

## Root source-only disposition before first execution

Entry export/mandatory dynamic zero velocities/cap fixture protected-priority defect fixed. Added frozen sparse/admission/tamper/unknowngetter and observer-mutation controls. buildLiveInitialProblem internal3argcapture is explicitly not pure. Emergency last-prefix bypasses normal storage budget; normal main280MiB/fixed20MiB/emergency2MiB scopes explicit. Consumer compares prior independent growth action/pair key to actual appended row and finalprotected/cap disposition. C preserves exact Fraction residual strings and supports reachedSOLVED/unreachedhypnull as partialcertificate-only. All changes occurred BEFORE first module/model/reference/control/type/build/World execution; they are source fixes, not pass evidence.
