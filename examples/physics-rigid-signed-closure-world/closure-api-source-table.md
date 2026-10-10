# #1384 최종 API·오류·입력 사례

기준: 새 lane의 CONTRACT.md §§1–8, root commit 9e43e0adcbd993d19e4baf7eb55a31c590b893a9. 이 문서는 소스 검토 결과다. 새 실행 결과가 아니다. 최종 CONTRACT가 이 문서보다 우선한다.

## API와 상태

`createCandidateWorld(config,{solve?,observeAttempt?})`는 기존 World API를 유지한다. 새 getter는 `getLiveSignedClosureStats`, `getLiveSignedClosureAttempt`, `getStepLedger`다. 모두 ensureActive 후 복사본을 반환한다. 초기값은 zero/null/null이다. query 주입은 없다.

`runLiveSignedClosurePhase(workingBodies,sortedPairs,options={}) → {stats,attempt}`는 World 소유 working 배열만 변경한다. 성공 observer가 반환한 후 dynamic 위치를 한 번 적용한다. 순수 함수라고 부르지 않는다. 별도 순수 helper는 `buildLiveInitialProblem`, `applyLiveTranslationsOnce`, `chooseAddedPair`, `zeroLiveSignedClosureStats`다.

`CompactSelection={normal,boundM,candidateIndex,pointM,rawAxisLength,label,feature}`. `PairObservation={pairKey,aIndex,bIndex,selection}`. `RowSource`는 이 필드에 `kind:'initial'|'added'`를 더한다. pairKey는 `aId+'\u0000'+bId`다. PRE body 순서와 기존 eligible lex pair 순서를 유지한다.

`Choice={index,problem,rowSources,solution,hypBodies,rounding,hypSelections,failurePair}`. `Attempt={preBodies,pairs,initialDetections,initialRows,choices,finalBodies,rounding,workingApplicationCount,error}`. initialRows는 hit **수**다. initialDetections는 모든 PRE pair의 null 또는 원래 normal/penetration/pointM을 저장한다. 미도달 solution/hyp/final/rounding은 null이다. observer/getter/result 자료는 분리된 복사본이다.

Stats: tests,hits,initialRows,rows,choices,hypothesisPairTests,signedPreQueries,enumeratedMasks,singularMasks,infeasibleMasks,activeMask,maxTranslationM,primalViolationM,negativeMultiplierKgM,complementarityKgM2,stationarityKgM,workingApplicationCount. tests/hits는 **초기** 검사/접촉 수다. masks 수는 도달 choice의 합이고 activeMask/certificate는 마지막 solve 값이다. 초기 activeMask=null. global positionSweeps=1, positionTests=tests, positionHits=hits.

## 고정 경계와 우선순위

기존 64 velocity sweeps와 ONE position phase를 유지한다. 부모 apply는 정확히 9 bodies만 허용한다. 새 owned wrapper만 1..9를 허용하며, 같은 dynamic PRE+u 연산과 static 위치의 무가산 복사를 사용한다. signed solver 자체는 이미 1..9다. q/v/omega/metadata를 유지한다.

모든 초기 detect를 완료한다. nonnull touch도 row다. 초기 row는 원래 normal/depth bits를 쓴다. fresh PRE의 `normal===original.normal` 및 `Math.max(0,boundM)===penetration`을 확인한다. 추가 row만 unclamped boundM<0을 쓴다. 초기 >8이면 solve 전에 거절한다. 매 choice는 같은 PRE에서 새 hypothesis를 만든다. 전체 hypothesis 검사 후 protected 실패가 우선이다. 그 다음 lex 첫 미보호 pair를 고른다. 8 rows이면 추가 query/solve 전에 cap 오류다. 기존 row는 바꾸지 않는다. 추가 solve마다 한 row가 필요하다. 최대 9 choices다. boundM<=1e-12는 통과한다.

우선순위: 원래 disposed/dt/cursor/command/free bounds → island/witness → closure input/pairs → 전체 initial detect/correspondence → initial cap → whole problem/solver/result/infeasible → apply/전체 hypothesis → protected → growth cap → fresh PRE contradiction → next-choice bound → observer → working apply → outer movement/result → commit.

## 정확한 오류

모두 기존 `PhysicsError('NUMERIC_LIMIT',message)`다.

| LIVE_ERRORS 키 | message |
|---|---|
| INPUT | private live signed closure input is invalid |
| PROFILE | private live signed closure profile is unsupported |
| ROW_CAP | private live signed closure exceeds eight rows |
| GEOMETRY | private live signed closure requires fresh matching box geometry |
| INFEASIBLE | private live signed closure constraints are infeasible |
| RESULT | private live signed closure result is invalid |
| PROTECTED | private live signed closure left a protected pair unresolved |
| CONTRADICTION | private live signed closure added pair is not separated at PRE |
| CHOICES | private live signed closure exceeds nine choices |

부모 SignedPositionReferenceError의 **instance+code+정확한 message** 모두 확인한다. PROFILE_LIMIT/MESSAGES.limit→PROFILE. INVALID_INPUT/MESSAGES.input,empty,ids,mass,endpoints,normal,bound→INPUT. NUMERIC_LIMIT/MESSAGES.result→RESULT. 검증된 INFEASIBLE 결과→INFEASIBLE. fresh SAT의 실제 PhysicsError에서 FEATURE_INPUT_MESSAGE 또는 AXIS_MESSAGE만 GEOMETRY로 변환한다. 나머지는 같은 thrown value를 다시 던진다. Error/object/null, 같은 code의 다른 message도 바꾸지 않는다. observer가 던진 값은 실패 observer에서도 그대로 우선한다.

## 데이터 전용 literal 표

정책 입력 공통값: IDs b0..b8, 모든 36 eligible pair의 정렬된 hypothesis, 기본 bound=0. chain rows는 b0/b1,…,b7/b8의 8개다. selection의 다른 필드는 normal[1,0,0],index0,point[0,0,0],axisLength1,label A.face.0,feature face-a/axisA0이다. 이 자료는 정책 guard이며 물리 증거가 아니다.

| 입력 변경 | 기대 |
|---|---|
| rows[], 모든 bound=0 또는 -0.1 | 추가 pair 없음 |
| 미보호 b0/b2 bound=1e-12 | 추가 pair 없음 |
| 미보호 b0/b2 bound=2e-12 | b0/b2 선택 |
| rows[], b0/b1과 b0/b2 bound=2e-12 | lex b0/b1 선택 |
| row b1/b2, b0/b1과 b1/b2 bound=2e-12 | PROTECTED |
| chain8 rows, b0/b2 bound=2e-12 | ROW_CAP |
| hypothesis 중복/순서 반전/누락/null numeric | INPUT |
| prefix row 계수 교체 또는 row 없이 다음 solve | INPUT 또는 CHOICES의 해당 guard; 재시도 금지 |

실제 cap 입력: .25 half의 9 boxes를 모두 [0,0,0]에 둔다. 8 dynamic mass1+1 static, identity q, v/w0, e0. 36 nonnull 초기 detect→ROW_CAP, solve0. 새 protected 물리 입력은 만들지 않는다.

순수 apply: 1/2/9 bodies, zero rows, bounded u, static negative-zero 위치. static은 위치에 0을 더하지 않는다. q/v/w/metadata 및 입력 불변을 확인한다. malformed result/ID/static nonzero u/길이10 초과→RESULT; 원래 좌표 bounds 오류는 원래 메시지를 유지한다.

World fault: 원래 STACK2는 dynamic2+floor의 **3 bodies**다. 한 accepted step 후 nonzero cursor/cache/64-sweep counters를 저장한다. 실제 mapped solver 오류, 검증된 INFEASIBLE, malformed result, observer Error/object/null을 각 guard로 구분한다. 원래 accepted bodies/contacts/events/cache/stats/ledger/cursor/time 전부 유지한다. getter mutation과 observer mutation은 내부 상태에 영향을 주지 않는다.

별도 late-bound literal은 CONTRACT §8 그대로다: dt1/30,gravity0,a[0,.25,0],wall[9.75,.25,0],z-floor[0,-.1,0]. 첫 empty step 후 두 번째 impulse[300,0,0]. closure가 성공해도 outer total movement>10m→RESULT; earlier refusal이면 late-bound 통과 증거로 쓰지 않는다.

## 소스 근거

아래 경로는 새 lane repository 기준이다. 부모 파일은 변경하지 않는다.

| 파일:line | SHA256 / 확인한 경계 |
|---|---|
| signed-separation-reference/signed-input.mjs:1,7 | 5b457a602f89c0182f661302a5e4b6491711d5d7be7f0b390af7f93115e7a951 / 정확한 messages, dense schema,1..9/8 |
| signed-separation-reference/apply.mjs:8 | 01b7d13b6c4b7d423a53df13f24b617afe43ecdc7866587fcf0191b82395b0dd / 정확히9-only, dynamic PRE+u/static copy |
| signed-separation-reference/signed-sat.ts:114 | 2ae6a57ec0de1bd3db13812f02789572c5eacff85e9e2a0a9f2454a301933dea / fresh raw-q strict minimum |
| coupled-position-world/reference-world.ts:201,224,242 | ca253faf466a293168378ceaf25137b50d338e5f394997945e441ed6ecf7eba1 / phase, outer movement, atomic commit |
| rigid-contact-reference/fixtures.mjs:8 | ca760b2945d246de1e2f32cb4763ef58bf95e87422b6d4545682c20abb3a1ac0 / 고정 original scene |

표의 signed-separation-reference와 coupled-position-world 앞에는 examples/physics-rigid-를 붙인다. rigid-contact-reference 앞에는 examples/physics-를 붙인다. root의 complete source freeze에서 실제 hash를 다시 고정한다. 이 문서는 새 수치 결과, 성능 또는 World GO를 주장하지 않는다.
