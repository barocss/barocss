# #1399 selected BEFORE-CODE contract

2026-10-11. Status: BEFORE-CODE SELECTED; no new math, import, parser/type, build, reference, control, solver or World run. Base1614fdf964806f2ab76f018145b33323bfdaf73c. Reuse this chat's clean managed1384 checkout on NEW codex/physics-full-pair-world-1399; original1384 native branch/a7bf69e2 and all source/evidence blobs remain immutable. Only NEW examples/physics-rigid-full-pair-position-world/**. Integration is sole develop writer. No product push, PR, deployment, package or release. Root owns contract/source/emitted freezes, actual executions, commits and remote receipts. Root+3 disjoint helpers write source ONLY until root complete actual source/input/error/reference freeze. No helper tests/imports/AST/type/build/solver/control/reference/World calls before that freeze.

## Root final overrides and ABI

This section supersedes every proposal or still-open clause below. Original1179/1264/1344/1384 failures remain immutable. Actual1384 native527a4407→a7bf69e2 adopted4ae895123bd37238599f1ad4f6b7db2a2b8e76ba:98NEW modes/blobs and67artifact/32decoded hashes verified. Current1614 ancestry and all1384blobs verified. Current Integration UI/file/recovery debt674/1254 does not block source. Native build and this actual flow remain mandatory.

### Kernel law and modules

Cold dual feasible method in the algorithm appendix is selected verbatim: lex first margin<-1e-12 entering; W sorted original indices; exact quotient tie smallest row; tD<=tP drop first; pending lambda retained; fulllambda u reconstruction; no retries, pseudoinverse, regularization or warmseed. Native default limits iterations1024,activeChanges1024,rankChecks2048,linearSolves2048,constraintTests262144,exactIntegerOperations1000000,reducedRationalBits8192,intermediateIntegerBits16385. Exact bit exhaustion WORK_LIMIT, never infeasible. Shared exact counter includes integer add/subtract/multiply/divide/remainder/reduction work. Native basis Gaussian partial maxabs first pivot ties, PIVOT1e-14*max(1,maxAbsG), infinitycondition<=1e12, factor/residual/direction gates as appendix. Schur delta< -1e-14*max(1,Gpp) is unsafe; abs(delta)<=that threshold or basis-cap requires exact relation probe. Exactly independent near-Schur is unsafe. Only normalized exact y>=0/A^Ty=0/sumy1/b^Ty>0 permits INFEASIBLE. Native exact dependency module is isolated; not a second general optimizer. General DOF3Ndynamic<=27; original8+floor24. Whole rows0..36,bodies1..9, originalmass0/[1e-6,1e6],normgate1e-12,bounds[-10,10],staticu+0/correctionnorm<=10m.

Owned kernel uses MJS to follow parent primitive: full-pair-input.mjs,full-pair-linear.mjs,full-pair-exact.mjs,full-pair-core.mjs,full-pair-solver.mjs; shared type declarations full-pair-types.ts. World modules reference-world.ts,global-island.ts,world-types.ts,full-pair-rows.ts,full-pair-apply.ts,full-pair-phase.ts. Independent reference reference.py,full-pair-reference.py,nine-row-reference.py,reference-controls.mjs. Root harness entry.mjs,literal-cases.mjs,policy-controls.mjs,world-controls.mjs,kernel-consumer.mjs,consumer.mjs,runner.mjs,bundle.mjs,archive.mjs,freeze.mjs,publish-emitted.mjs,run-native-gates.py,tsconfig.json,README.md and all contracts/pins/evidence.

Exports: solveFullPairPosition(problem),validateFullPairProblem(problem),validateFullPairResult(problem,result),FullPairPositionReferenceError,MESSAGES,DEFAULT_LIMITS; guard-only runFullPairCore(problem,limits=DEFAULT_LIMITS). No seed/options in solveFullPairPosition. Reduced core limits must have ALL default keys as own data, nonnegative safe integers<=defaults; otherwise INVALID_INPUT/workLimits. Problem shape exactly {bodies,rows}; each body{id,inverseMass}; each row{aId,bId,normal,boundM}. Arrays ordinary dense own-data arrays; records ordinary or null prototype, EXACT own string keys, descriptors own data only. Reject accessors WITHOUT invoking their getters. Proxy reflection unknown throws propagate same identity. Priority whole shape→overbody/rowcount→empty→body shape/IDs/mass in order→rowshape/endpoints/normal/bound in order. IDs nonempty strings unique (old primitive rule, no invented ID regex). Badmass/bound INVALID_INPUT, only counts PROFILE_LIMIT. Preserve all input bits/copies; static mass0 includes -0 admission but resultingstatic u canonical+0.

Kernel errorclass name FullPairPositionReferenceError with own code/message. Exact messages: input='full-pair position reference input is invalid'; limit='full-pair position reference admits at most nine bodies and thirty-six rows'; empty='full-pair position reference requires at least one body'; ids='full-pair position reference body IDs must be nonempty and unique'; mass='full-pair position reference inverse mass is invalid'; endpoints='full-pair position reference row endpoints are invalid'; normal='full-pair position reference normal must be finite and unit length'; bound='full-pair position reference bound must be finite and between minus ten and ten metres'; result='full-pair position reference result is invalid'; workLimits='full-pair position reference work limits are invalid'. Input errors INVALID_INPUT,limitPROFILE_LIMIT,malformedresults NUMERIC_LIMIT/result. All internal numeric/work failures produce structured statuses, no fake translations.

### Result and counters

EVERY result has EXACT keys: ok,status,basisRows,basisRank,dynamicDof,counters,trace,lastSafeIterate,translations,lambdaKgM,primalMarginsM,objectiveKgM2,certificate,infeasibilityCertificate,reason,worldStepped. worldStepped=false; basisRank=basisRows.length is ONLY working basis rank, not full-problemrank. SOLVED oktrue/reasonnull, translations[{id,u3}] full originalbodyorder; fullrowlambda,margins,objective and certificate{primalViolationM,negativeMultiplierKgM,complementarityKgM2,stationarityKgM}; infeasibilityCertnull. Otherstatuses okfalse and ALL translations/lambda/margins/objective/certificate null. INFEASIBLE has exactcert and reasonnull; unsafe/work have certnull and stable reason.

Exactcert={weights:string[],sumWeights:'1/1',dynamicDot:string[],boundDotM:string}; canonical reduced numerator/positive denominator,zero'0/1'; y dimensionless/fullrowlength; dynamicDot every DOF '0/1', exactpositive boundDotM in metres. Full validator verifies from originalproblem, not supplied certclaims. SOLVED fullcert uses all coefficients and unit1e-12, objective agreement1e-12, correction<=10m, staticzero. Malformed status/nullable fields/proof/counters/basis/trace/resultcopy NUMERIC_LIMIT/result. Input/source/result unknown getters/proxies throw original identity. Validators never accept null as numericzero.

Counters EXACT: iterations,activeChanges,rankChecks,linearSolves,constraintTests,factorizations,blockRightHandSides,exactIntegerOperations,exactPeakBits. All safe nonnegativeintegers and defaults/bounded dimensions checked. factorization/block RHS recorded honestly for augmented[r|I] block; factorization is one block with1+|W| RHS, not one scalar solve. Main5 increment BEFORE actual operation as algorithm appendix; exact operations share budget and peakbits. First exhausted budget returns WORK_LIMIT with reason 'budget:'+key; exactbit='budget:reducedRationalBits'/'budget:intermediateIntegerBits'; actual fullIEEEcycle='cycle'. Nativeunsafe reasons fixed enum: 'nonfinite','negative-step','negative-multiplier','pivot','condition','factor-residual','direction-residual','near-dependent-independent','dependent-basis','dependency-conversion','uncertified-infeasibility','iterate-certificate','result-certificate','translation-bound'. No dynamic exception string as numeric reason.

Trace entry EXACT {iteration,enteringRow,basisBefore,basisAfter,action,blocker,stepKgM,schurInverseKg,condition,exactDependent}; action add/drop/dependent-drop/infeasible/unsafe/work-limit; nullable unreached scalars, never Infinity. Trace<=iterations+1; basis arrays originalrow indices no duplicates, sorted. LastSafeIterate EXACT {uDynamic,lambdaKgM,pendingRow,pendingLambdaKgM,basisRows}; finite copy/current safe internaliterate, initialzero exists; pendingRow null ifnone. Diagnostics are not a usable solution. Result/validator produces copies; no caller mutation. Core's numeric certificate work is counted in core constraintTests. Subsequent pure validators and phase apply validate again and are explicitly separate validation calls, not relabelled core solver iterations/rank work. Exact verifier accepts a separate meter so revalidation never edits core counters; harness records validator calls separately. Full-partial u is never Worldapplied.

### World phase and failure authority

ALL eligible immutable PRE pairs have one UNCLAMPED fresh signed bound including detector touches/smallnegativegap. ScanallPRE detect+signed observations beforefirst out-of-range[-10,10] lex RANGE refusal withsolve0. Preserve original15axis/rawq/cutoff/strictmin and SAME PRE normal, no independentexpectedaxisinput, no row omission/clamp/warm/futurequery. Current inputs/profile/oldvelocity64/commands/free/warm/cold/contact/cache/events/pointFINAL/outerbounds preserved. Oneproblem→onesolve→freshPRE+u hypothetical→fullpostscan→copiedobserver→oneworkingapply. New overlaps>1e-12 refuse NONPENETRATION without another solve. Hypothesis absent after SOLVED apply refusal remainsnull; no fabricated frame.

Types and copied ABI are World appendix selected. RowSource EXACT {rowIndex,pairKey,aIndex,bIndex,selection}; pairObservations same without rowIndex; selection oldcompact7keys. Attempt EXACT {preBodies,pairs,initialDetections,pairObservations,problem,rowSources,result,hypotheticalBodies,rounding,finalPairObservations,failurePair,workingApplicationCount,error}; problem/result/hyp/rounding nullable untilreached,0 apply beforeobserver. All33? onlydeclaredfields; no oldchoices. Stats EXACT {tests,hits,rows,signedPreQueries,solverCalls,postPairTests,maxTranslationM,workingApplicationCount,solverCounters,certificate}; certificate nullable,defaultzero9counters. Getter names getFullPairPositionStats/getFullPairPositionAttempt/getStepLedger plus oldstate/global/warm/cache/query/step/dispose. ObserveStepAttempt 3original reachedstages; phaseobserverdefault/guardonlysolve notpublicconfig. Bothsuccess/failure callback copied once beforeapply; callbackthrow wins sameidentity. ErrorRecord same parent safe catch reflection, fallback {kind:'unexpected-error',name:'ThrownValue',message:'Unexpected non-Error exception'}, knownPhysicsError own class/code/message recorded. Catch maps EXACT knownkernelclass+code+message; unknownthrows sameidentity. Observer itself outsidephasecatch on success, so no doublecallback.

FULL_PAIR_ERRORS exact from World appendix selected. Range onlyfreshWorld. KernelinputmapsINPUT,overcountmapsPROFILE,resultmapsRESULT; SATknownclass/code/message mapsGEOMETRY. Numericresultstatusvalidated first then INFEASIBLE/NUMERIC_UNSAFE/WORK_LIMIT. Preserveparentphase-order/witness/penetration/originalWorlderrors and dt/command precedence. Failure phase callback called even reached PRE refusal withcurrentcaptureddata. Whole accepted snapshot/cache/events/counters/ledger/step/time unchanged on anyphase/observer/lateouterfailure. Commands percall,noqueue. Staticfullbodybitcopy, q/v/omega/materialheld; onlydynamicPREp+u. KKTlambda kg*m notimpulse. Originalpoint netNs=normal*FINALnormalNs+FINALtangentNs, not FINAL-warm. Energy/budgets exactsameas1384 ledger; nofrictionper-update/energyconservation/calibratedforceclaim.

### Independent reference contract

Selected C method: input-only exact elasticLP PhaseI with variableIDs uPlus[d],uMinus[d],t,slacks[m] in THAT order; tableau actual exact updatedpivot, Blandenter smallestnegative reducedcost and minimumratio leave smallestBASICvariableID. Initial maxb<=0 u0; else smallestmaxbrowt+allslacksexceptthatrow. Exact t>0 onlyfullFarkaschecks certifiesINFEASIBLE. PhaseII startingindependentlyfeasibleu, greedy tight independentrows originalorder; independent exact primalQp directions/fullblocks, smallestnegativeλ release, minimumexact blockingratio/smallestrowtie. sortW everyadd/drop. p!=0 alpha1 with a blocker AT alpha1 adds first blocker, otherwise justfullstep thennext direction. Repeatedstationarybasis p0→REFERENCE_WORK_LIMIT/cycle; transition4096/pivot4096,each reducedrational8192bits, intermediate16385bits enforced beforemultiplication/addbounds and afterreduction through ownedhelpers. No alternate solver/restart/normalization/floatingPIVOT. Reference bit/work/numericalunresolved is EXECUTION_FAILURE, never fakeINFEASIBLE. EXACT Fraction coefficients original IEEE; allfullrows KKT0; independentoptimum uniqueu/objectif, λ/basis neednotmatch. Nine-start exact9row512 mask ref crosschecks independentcoldfullalgorithm in SAME onegate; old256sourceunchanged.

Reference expected computations are COLD EACH request; NO cache/memo/reused basis/result across source/repeat/compiled orsteps. Native result read only AFTER expected isderived. opkernel EXACT {op:'kernel',scope:'nine-start'|'full-pair',problem,result}; resultnull means expected-only protocolguard, notnativeGO. Reply EXACT {ok,resolved,executionFailure,referenceStatus,metrics,reference,violations}. Ref SOLVED fullu,λ,margins,objectif,exactcert;counters lpPivots,qpTransitions,rankTests,factorizations,primalRowTests,peakRationalBits andmaskcrosscheck ifnine. Reportfinite numericpluscanonicalexact fractions andnull overflowwithstatus, never0replacement; nofull36exactGram dumpperstep. Native actualcert exactFraction residualseparate. Expectedprooflevel/root1e-12u/objective/cert, correctionbound separate fromlinearfeasibility. Native unsafe/work refsolved isn't statusmismatch: correct saferefusal/no functionalGO; nativeINFEASIBLE requires its ownexactwitness+independentinfeasible, falsecertresolvedviolation. Native9startMUSTSOLVED+referencebothGO beforemainWorld, no later9capadaptation.

opworld EXACT {op:'world',scene,stepIndex,config,preBodies,preRawHex,problem,rowSelections,result,hypBodies,hypRawHex}. Requiredallpairs/rows/same originalPRE coefficient/mass/IDs/selectedaxischecked with unchangedparent compact_pair/selection_difference/Decimal80/120. Expected rowbound alwaysunclamped exceptkernel nine-start separatelyauthentic old8rows+onequery. Hypbothnull allowedunreachedstage afternumericrefusal/afterSOLVEDapplyrefusal; truehypchecks oneIEEEPREp+u, held q/v/w/meta/staticfull104B thenfresh allpairraw+normalized. Finalphase-success bothdepth<=1e-12,precision<=1e-25. Knownphysicalrefusal remainsNO-GO evenreferenceok. opstep-ledger EXACT original1384 fields/outcome/4rawframes, delegatedUNCHANGED parentstep_ledger. Partialunreachedframes onlystored, notmadecomplete.

Malformedprotocol codeREFERENCE_INPUT/message 'full-pair world reference request is invalid'; malformedJSON REFERENCE_JSON/message 'full-pair world reference line must be valid JSON'. Unknownop/bool/nullnumeric/missing/extrafields/sparse/invalidraw/proofschema errorinput (getJSONshape only), parsedliteral reference resource statusREFERENCE_WORK_LIMIT orREFERENCE_BIT_LIMIT resolvedfalse/executionFailuretrue. Structured reply failuremetricsnull, noMathfallback. Preserve originalledgeraliases messages internally but wrapper catches ONLY known protocolerror and rethrowsnewmessage; unknown errors executionfailure notswallowed. Native unsafe controls independentlycheck exactfeasible but nosolutionacceptance; corelimit0 independentreferenceexpectedsolved and honestWORK countsguardonly.

### Literals, first consumers and evidence

A's15 groups selected WITHoverride: L03 frozen indexedrawPRErecipe ONLY, query firstauthorizedfullfrozenexecution. L09alsoactual two-dynamic+X/.1 and [1,1e-8,0]/.100000001 near-independent defaultbudgetunsafe guard. L10 invalidmass INVALID_INPUT notPROFILE. L12pureinvalidbound INVALID_INPUT; freshWorldout-of-range RANGE. L13 applyguard uses genuinely SOLVED zero-row input ratherthan fabricatedallnullablekernelresult. L14badresultvariants startgenuinecopiedvalidatedresult. L15corelimit0 honestWORK; injected result statuses separatetransactiononly, uncertified INFEASIBLE RESULT. Everycopy/getter/proxy/observer/unknownError-object-null/dispose/commands/warm/cold/late-movement fixedparentcontrols retained separately. No claimgenuineconditioning guardfromsyntheticinjection. Allcases fixedbeforeexecution; noadding afterfailure.

Rootmustrecordactual source/source-repeat/genuineoriginalPhysicsDIST bundles and completeimporthashes, no brittleCADextraexportgate in thisWorld. Parentoriginalfixture ALIGNED/OFFSET/YAW identical bytes,8dynamic+.5mcubes+staticfloor,gravityY-9.81,dt1/120,1200steps10s, baseline960settlingexistingexactgates. Rootorderedflow source→repeat→compiled, eachgraph kernelcontrols/referenceguards/nine-start then World3scenes. FIRST9startfailure stopsmainWorld. SourceWorldeachscene firstfailureprefix; subsequentgraphs runsameprefix/sourceparity only, notsuccessfulcampaignreplay. Dist graphactualoriginalPhysicsDISTnotfakecopy/originalSRC; privatecandidate remainsprivate source. Firstunknown/harness/refunresolved EXEFAIL stops; physicalnumericrefusal/qualityfailureNO-GO persists untouched; noinput/norm/RHS/tie/material/tolerance/law/budget tuning. No moreoptionalcampaign.

RootownaffectedCAD/Physicsbuild once andstrictprivateTS once AFTERcompleteactualsource/input/error/reference freeze andmeasuredcommit; MJSallowJs/checkJsfalse explicit. ActualownemittedNONEMPTYALLCAD+Physics paths/hash/bytes frozenbeforefirstconsumer; successfulbuild/type sourceandcurrentconsumer identitiesseparateifnonmathsyntaxrepaireverneeded. Retain FIRSTfailures/actualstderr andonlyprovennonmathrepair withfreshfullfreeze. Nohelperparser/oracle/modeltests beforefreeze.

Evidencebudget main280MiB,fixed20MiB,totalnormal300MiB,emergency2MiBseparate. Streaming gzipJSONL+raw13full104B/body; completecurrentPRE/hyp/4phaseframes/allfullrows/result/reference/counter/failure/prioraccepted metadata/raw preserved. CompactSAT only7fields; parentquerystillfull15axis andindependent80/120recompute. Do notdumpfull36exactGram eachstep. Beforewriteoverbudget recordEXEFAIL 'full-pair world evidence budget exceeded', stopnoanotherphysicalstep andretaincurrentprefix/copiedattempt/emergency<=2MiB. Verifyactual67? NEWmanifest countsnotpredetermined, actualGitblobs/decodedgz/traceoffsets/hash/modes/scopednewdelta beforehandoff. Beforetrial rootchecksfree spaceforselectedstorage; nootherwork cleanup. Existing canonical1384hardlinks neverwritten/truncated/replayed; newoutpath freshonly.

Workingoutputs stillUNMEASURED. No fullengine/Box3Dparity/public4body/Viewer4frame/forcecalibration/sceneperformance/releaseGO; futureexisting1310/1179 consumersretainownscope. RootWiki/Issue updateaftermeaningfulcontract/result. PlanneronlyNEWissue number/title;1399alreadyreported,no newmessage.

## Immutable source-only preparation appendices

These appendices explain derivations and originalpreparedliterals; rootoverridesABOVEapply. Their old 'proposal' or 'rootpending' status is historical, not anotherpermissiongate. No helpermay silently change rootvalues.

# #1399 cold dual active-set 제안

상태: SOURCE-ONLY 제안. 새 계산·구현·solver·reference·World 실행은 없다. root가 BEFORE-CODE 계약과 모든 수치·오류·입력·작업 한도를 최종 선택한다. #1384의 ROW_CAP 실패는 유지한다.

## 1. 방법과 범위

**한 가지 방법:** cold dual-feasible active set. 매 solve는 `u=0, λ=0, W=[]`에서 시작한다. 전체 inequality 배열은 끝까지 유지한다. W는 선형 독립인 tight working basis이며, full constraints의 일부를 삭제하는 배열이 아니다. 후보가 basis/λ/u seed를 공급하지 않는다.

Goldfarb–Idnani 계열의 dual method는 [quadprog 공식 문서](https://search.r-project.org/CRAN/refmans/quadprog/html/solve.QP.html)에 설명되어 있다. 아래 규칙은 이 private scope의 제안이다. 해당 패키지의 구현·의존성을 복사하지 않는다.

static DOF를 제거한다. dynamic 좌표를 body 입력 순서, x/y/z 순서로 나열한다. `D=M^-1`는 각 dynamic body의 원래 inverseMass를 세 좌표에 반복한 대각행렬이다. 각 row의 dynamic incidence는 A의 a endpoint에 `-normal`, b endpoint에 `+normal`이다. static endpoint 계수는 없다. full 문제는

`min .5*uᵀ M u,  A*u >= b`, `G=A*D*Aᵀ`.

일반 1..9-body kernel의 dynamic DOF d는 최대27이다. basis 크기는 d를 넘기지 않는다. 원래 8dynamic+floor scene에서는 d=24다. **rank=24 또는 rank=d라고 가정하지 않는다.** 실제 rank는 더 낮을 수 있다. 서로 연결된 all-dynamic incidence의 translation nullspace도 있으나, 이를 근거로 일반 admission을 8dynamic으로 줄이지 않는다. 36×36 full Gram을 full rank로 역산하지 않는다.

M은 dynamic DOF에서 양의 정부호다. 원래 full feasible set이 비어 있지 않으면 primal optimum은 유일하다. multiplier와 basis는 유일할 필요가 없다. Float64 certificate tolerance만으로 정확한 feasible set 또는 정확한 최적해를 증명할 수는 없다. full-row 독립 Fraction reference의 별도 gate가 필요하다.

## 2. 고정 순서와 iteration

1. whole input을 원래 dense/plain/finite/ID/mass/unit-normal/bound guard로 검증한다. 새 한도만 rows0..36이다. full rows의 입력 index를 영구 ID로 쓴다. World는 eligible pair의 기존 lex 순서를 공급한다. 모든 static u는 정확히0이다.
2. 정확히 zero dynamic incidence인 row는 원래 binary64 계수의 dyadic 값으로 확인한다. b>0이면 단일-row exact Farkas witness를 검증하고 INFEASIBLE을 반환한다. b<=0이면 full row에 남겨 둔다. 이 검사에서 작은 값으로0을 만들지 않는다.
3. `λ[0..n-1]=+0`, `W=[]`, pending p 없음. u는 매 단계 full input row 순서로 `u_k=D_k*Σ_i A_ik*λ_i`를 새로 만든다. 이전 u에 누적 translation을 적용하지 않는다.
4. **enter:** 전체 n margins `A_i*u-b_i`를 입력 index 순서로 계산한다. W 밖에서 margin `<-1e-12 m`인 첫 row를 p로 고른다. largest-violation heuristic은 사용하지 않는다. W의 tight residual이1e-12를 넘으면 NUMERIC_UNSAFE다. 후보가 없으면 §6의 full certificate를 검사한다.
5. pending p의 λp는 처음0이며 partial drop 이후에는 유지한다. W는 매 add/drop 후 입력 index 오름차순으로 정렬한다. 아래 inner direction을 계산한다. inner가 끝날 때까지 다른 entering row를 고르지 않는다.

**enter tolerance의 한계:** 위1e-12는 원래 numerical feasibility gate다. 정확한 모델의 bound를 변경하는 값이 아니다. 매우 작은 모순을 native tolerance가 놓치면 독립 exact reference가 status/optimum mismatch로 NO-GO를 낸다. 따라서 모든 infeasibility를 native가 찾아낸다고 주장하지 않는다. root가 exact-positive entering을 대신 선택하려면 이를 BEFORE-CODE에 별도로 고정해야 한다. 이후 trial에서 바꾸지 않는다.

## 3. direction과 blocker

W가 비어 있으면 `r=[]`, `z=D*A_pᵀ`. 그렇지 않으면

`G_WW*r=G_Wp`, `z=D*(A_pᵀ-A_Wᵀ*r)`, `δ=A_p*z`.

정확한 대수에서 `A_W*z=0`, `δ=zᵀ*M*z>=0`이다. dual direction은 W에서 `-r`, p에서 `+1`이다. 이 부호를 뒤집지 않는다.

- 안전하게 independent인 δ>0 방향: `tP=(b_p-A_p*u)/δ`.
- **leave/blocker:** rj>0인 W row만 λ가 감소한다. 각 `t_j=λ_j/r_j`의 최소를 tD로 고른다. 정확히 같은 Float64 quotient면 **원래 row index가 작은 row**가 먼저 나간다. tie epsilon은 없다. 후보가 없으면 tD는 내부 infinity sentinel이며, finite output에는 쓰지 않는다.
- tP<tD이면 full step: λW를 `λj-tP*rj`, λp를 `λp+tP`로 계산하고 u를 full λ에서 재구성한다. p를 W에 추가한다. pending을 해제한다.
- tD<=tP이면 partial step: 같은 순서로 λ를 계산하고 blocker λ만 정확히+0으로 설정한 뒤 W에서 제거한다. u를 full λ에서 재구성한다. pending p와 λp를 유지한다. 같은 p로 direction을 다시 계산한다. **동일한 tP/tD이면 drop이 우선**이다. 다음 안전한 방향이 full step0을 요구하면 그0 add도 하나의 iteration/change로 센다.
- 다른 λ가 음수가 되면 일괄 clamp하지 않는다. 선택한 blocker의 구조적0 설정 외에는 λ<0, 음수 t, nonfinite intermediate, 허용 residual 초과를 NUMERIC_UNSAFE로 반환한다. tP/tD 비율과 모든 방향 성분은 사용 전에 finite 여부를 검사한다.

작업 한도는 연산 전에 확인한다. 각 step은 새 λ/u/W를 temporary로 만든다. finite/dual/stationarity/tight guards가 모두 통과한 후 내부 iterate를 교체한다. 실패 상태의 u는 usable solution으로 반환하지 않는다. World 위치 적용은 SOLVED 뒤 한 번만 한다.

## 4. near dependence와 exact Farkas

Float64 작은 pivot, 작은 δ, singular factorization은 **INFEASIBLE 증거가 아니다**. 다음 작은 exact 모듈만 허용한다. 일반 exact native optimizer는 만들지 않는다.

1. δ가 near-zero인 경우 또는 p 추가가 dynamic basis cap을 넘기는 경우, 원래 A와 D의 binary64 값을 정확한 dyadic rational로 읽는다. 현재 W의 exact weighted Gram과 RHS를 만든다. bounded rational Gaussian elimination으로 `rExact`를 구한다. W 자체가 exact dependent이거나 exact 작업 한도를 넘으면 usable solution을 만들지 않는다.
2. `A_pᵀ-A_Wᵀ*rExact`를 원래 dynamic 좌표에서 **정확히0**인지 확인한다. 0이 아니면 near-dependent independent 방향이다. 숫자를0으로 바꾸지 않고 NUMERIC_UNSAFE로 끝낸다. 단순히 작은 Schur complement를 이유로 row를 버리지 않는다.
3. exact dependent일 때 rExact에 양수가 있으면 해당 row는 blocker 후보다. exact r를 finite Float64 방향으로 변환한 후 동일한 partial-drop 규칙을 적용한다. 이 branch의 tP는 내부 infinity다. 실제 exact z는0이다. 정확히 nonzero인 rational이 Float64 0으로 변하거나 부호를 잃으면 NUMERIC_UNSAFE다. u는 full λ에서 재구성하고 전체 stationarity/tight guards로 그 변환의 rounding을 검사한다. 변환이 unsafe면 NUMERIC_UNSAFE다. 이후 작은 basis로 pending p를 다시 처리한다.
4. exact dependent이고 모든 rExact<=0이면 full witness를 만든다: `y_p=1`, `y_W=-rExact`, 나머지0. exact positive 합으로 나누어 `Σy=1`로 정규화한다. 다음 세 조건을 원래 **모든 dynamic A 계수와 모든 b**에서 정확히 재검증한다: `y>=0`, `Aᵀ*y=0`, `bᵀ*y>0`.
5. 세 조건을 모두 만족해야 INFEASIBLE이다. y numerator/denominator와 exact dot product를 decimal integer strings로 저장한다. Float 잔차<=epsilon만으로 이 status를 만들지 않는다. `bᵀ*y<=0`이면 증거가 아니므로 NUMERIC_UNSAFE다. exact witness는 원래 full inequality 모순만 증명한다. 실제 box 비겹침이나 회전까지 불가능하다는 주장은 하지 않는다.

Exact dependency construction이 실패하면 다른 optimizer, pseudoinverse, regularization, row removal, pivot 재시도 또는 threshold 변경을 실행하지 않는다. 별도의 independent Fraction verifier도 witness를 입력의 exact coefficient에서 확인해야 한다.

## 5. 제안하는 BEFORE-CODE 수치·작업 한도

아래 값은 아직 실행으로 충분성을 확인하지 않았다. root 선택과 source freeze가 필요하다.

| 항목 | 한 가지 제안 |
|---|---|
| native full primal/negative λ/complementarity/stationarity | 원래 단위별1e-12 유지 |
| Gram basis factorization | deterministic partial-pivot Gaussian; maxabs pivot, 첫 index tie; forward elimination/back substitution |
| factorization order | sorted W; augment `[G_WW | G_Wp | I]`, 같은 factor로 r와 inverse 검사 |
| unsafe pivot | abs(pivot)<=1e-14*max(1,maxAbs(G_WW)); 원래 부모 scalar를 명시적으로 재사용 |
| condition | normInf(G)*normInf(inverse)>1e12이면 NUMERIC_UNSAFE; 정확도 보장은 아님 |
| factor RHS residual | `normInf(G*r-g)/max(1,normInf(G)*normInf(r)+normInf(g))<=1e-12` |
| inverse residual | `normInf(G*inverse-I)<=1e-12` (dimensionless); 원래 primal 단위 gate와 구분 |
| near-dependent direction | δ<=1e-14*max(1,Gpp) 또는 basis cap이면 exact relation probe; δ가 유의하게 음수이면 NUMERIC_UNSAFE |
| direction orthogonality | `max_i abs(A_Wi*z)/max(1,max_i abs(G_ip),max_i sum_j abs(G_ij*r_j))<=1e-12` |
| Schur consistency | `abs(δ-zᵀMz)/max(1,abs(δ),abs(zᵀMz),abs(Gpp))<=1e-12`; 소거 오차를 보정하지 않음 |
| iterations / activeChanges | 각각 최대1024; direction attempt 하나 / 실제 add 또는 drop 하나 |
| rankChecks | 최대2048; native Schur 판단 하나와 exact relation probe 하나를 각각 셈 |
| linearSolves | 최대2048; native augmented block solve 하나와 exact dependency solve 하나를 각각 셈 |
| constraintTests | 최대262144; full margin 검사, W tight 검사 및 최종 full 검사에서 평가한 각 row를 셈 |
| exact integer arithmetic operations | 최대1000000; 곱·나눗셈·gcd remainder도 연산 전에 셈 |
| exact reduced integer bit size | 각 numerator/denominator 최대8192; reduced operands의 곱/합 intermediate 최대16385bits를 연산 전에 제한 |
| zero-progress cycle | 동일 sorted W/p/full λ/u binary64 state 재방문 시 WORK_LIMIT(reason cycle); basis만 같다고 cycle로 보지 않음 |

행렬 합산은 W index 오름차순, dynamic 좌표 입력 순서, dot component x/y/z 순서다. augmented block은 한 factorization/linearSolves1로 센다. 실제 RHS 수 `1+|W|`와 factorizations도 별도 diagnostics에 기록한다. exact block은 RHS1이며 추가 linearSolves1이다. block solve로 많은 RHS를 숨기거나 벡터 solve1회라고 설명하지 않는다. 조건 평가용 inverse는 같은 augmented block에서 구하며 추가 재시도는 없다.

direction을 시작하기 전에 iterations+1, Schur 검사 전에 rankChecks+1, exact probe 직전에 추가 rankChecks+1, 각 block 직전에 linearSolves+1, row 평가 전에 constraintTests+1, add/drop 직전에 activeChanges+1을 확인한다. exact 모듈은 각 integer operation 전에 shared exact counter를 확인하고 reduction 뒤8192bit를 확인한다. 연산 전 예상 intermediate가16385bit를 넘으면 시작하지 않는다. 먼저 도달한 한도가 WORK_LIMIT reason이다. denial 이후 추가 direction/solve/row 검사는 없다. 첫 raw input admission은 이 algorithm work와 별도다.

위 표는36 rows 모두를 풀거나 original1200 steps를 통과한다는 보장이 아니다. exact bit/operation limit에 걸리면 WORK_LIMIT이며 INFEASIBLE이 아니다. pivot/condition/nonfinite/residual 실패는 NUMERIC_UNSAFE다. 형식/admission 오류는 별도 typed input/profile 오류다. scalar와 조건 gate를 통과해도 마지막 full dimensional certificate가 실패할 수 있다.

0×0 basis는 역행렬을 계산하지 않는다. d=0에서는 zero-incidence exact 검사가 모순을 증명하거나 u0/full gate를 검사한다. 모든 output 숫자는 finite다. infinity는 branch의 내부 sentinel만 허용한다.

## 6. SOLVED와 certificate

pending 없음 상태에서 u를 full λ로 마지막 재구성한다. 모든 n inequalities, full λ>=0 tolerance, 전체 complementarity, dynamic `M*u-Aᵀλ`, objective를 원래 coefficient와 입력 순서로 다시 계산한다. full row matrix는 W로 대체하지 않는다. 네 certificate는 각각 m,kg*m,kg*m²,kg*m 단위를 유지하고1e-12 이하일 때만 SOLVED다. correction norm<=10m와 staticu0도 확인한다. bound 초과가 원래 inequality infeasibility라는 뜻은 아니다.

SOLVED는 native finite numerical certificate를 가진 결과다. 독립 reference는 candidate W/λ/u를 expected optimum seed로 사용하지 않는다. 정확한 primal optimum과 full KKT/certificate를 별도로 구하고 u/objective1e-12 agreement를 검사한다. 비유일 λ/W를 같게 강제하지 않는다. 첫9-row genuine input은 별도512-mask exact reference로 비교할 수 있지만 full36에2^36 enumeration은 하지 않는다.

상태: SOLVED / **exact witness가 검증된** INFEASIBLE / NUMERIC_UNSAFE / WORK_LIMIT. 마지막 두 상태의 translations/objective/λ는 usable answer가 아닌 null이어야 한다. finite diagnostics와 마지막 safe iterate는 분리해서 저장한다. 원래 immutable full problem, 모든 index/change/counter와 최초 reason을 보존한다. exhaustion·singularity·작업 한도를 infeasibility로 다시 이름 붙이지 않는다.

## 7. 구현 경계와 남은 root 결정

새 owned modules: whole input/types/errors, Float dual kernel, small exact dependency/Farkas verifier, full result validator를 분리한다. 원래8-row enumerating kernel과 signed SAT/apply provider는 수정하지 않는다. 입력 getters/proxy가 던진 unknown 값은 동일한 값으로 전파한다. 원래 #1384 archived PRE와 실제 adopted hash부터 검증한다.

World successor는 all36 fresh PRE signed rows/ONE solve/ONE fresh PRE+u/전체hyp scan을 쓴다. 원래64 velocity sweeps, q/v/omega, static bits, contact/cache/events, 외부 movement/result guards와 atomic commit은 유지한다. solver partial result 또는 WORK_LIMIT를 World에 적용하지 않는다.

root가 실행 전에 반드시 최종 고정할 사항: 정확한 API/errors와 status payload; all-pair UNCLAMPED b 정책과 old touch-clamp의 명시적 차이; distant bound<-10 profile 거절; 위 numeric scale/residual formula/enter scalar; work counters와 atomic checks; dependent blocker conversion; rational payload/bit-budget; tie/cycle receipt; source/compiled copies; first9-row input과 fullWorld first-failure flow. 이 문서는 broad engine rank, 모든 feasible input의 성공, finite iteration theorem, 실제1200 World GO 또는 성능을 주장하지 않는다.


---

# #1399 cold independent reference proposal

SOURCE-ONLY. Read the current full-pair Wiki/Issue plan and saved #1384 schema/first ALIGNED record. No code, calculation, model/reference import, solver, control, build/type, AST or World execution. Only this proposal was written. Root must select all final rules before implementation.

## 1. Authentic input and mathematical scope

Restore adopted source ALIGNED153 attempt.preBodies from its indexed936B raw13 frame. Copy the last native8-row problem and row-source records. The ninth b6/b7 row is created by the adopted native fresh SAT on THAT PRE only during the first authorized new execution. Do not substitute the already recorded independent selection or the last hypothetical axis/RHS. Parent schema is Attempt{preBodies,pairs,initialDetections,initialRows,choices,...}; Choice{index,problem,rowSources,solution,hypBodies,rounding,hypSelections,failurePair}. Frozen original axes/coefficient provenance is required.

Primitive input:1..9 bodies,0..36 rows; inverseMass0 or[1e-6,1e6],unit normal1e-12,signed bound[-10,+10]m. Static DOF are eliminated, static u remains exact0. Let dynamic d=3*Ndynamic<=27, main eight dynamic+floor d24. Build A with -normal on A endpoint,+normal on B endpoint; b=boundM; H diagonal reciprocal inverseMass. Minimize .5uᵀHu subject Au>=b. Decode every actual binary coefficient exactly to Fraction; never normalize coefficients or silently scale model targets.

All36 inequalities remain present, even when a working basis omits redundant/inactive rows. Positive H gives a unique feasible primal u/objective; lambda and active basis can differ. Full Gram PSD/rank<=d is not an invertible36-row system. Selected halfspaces are conservative fixed-q geometry, not a global optimum over alternate separating axes/rotations. Root must select raw signed versus original-contact clamp semantics and distant-gap refusal before code.

## 2. Separate actual9-row512 start reference

Create an OWNED9-row validation wrapper and512-mask reference scope, preserving old8-row256 source. Reuse unchanged dimension-independent Fraction elimination/incidence/certificate arithmetic. Enumerate exactly masks0..511 for the authentic ninth-row problem, report singular/infeasible/feasible masks and all minimum-objective ties. Do not assert one unique active mask. Full primal,stationarity,nonnegative multipliers,complementarity exact0; compare native u/objective1e-12. No extra original World run or speculative ninth-axis computation now.

The9-row reference is the bounded start and independent cross-check for the full algorithm. It does not expand to2^36 or become another cap-patch campaign. After its selected gate, the same child uses the independent full36 method below and then the named World flow.

## 3. Cold full36 exact method: LP feasibility then primal QP

This is deliberately different from native dual active-set search. No native multiplier,workingRows,basis,u,mask or prior-step state initializes it.

### Phase I: exact elastic LP, Bland simplex

Solve min t with t>=0,u free,Au+t*1>=b. Split u=uPlus-uMinus, add nonnegative slack s. Equality columns are [A,-A,1,-I],RHS b,cost only t. At most2d+1+m<=91 variables and m<=36 equations.

If max b<=0, u0/t0 is feasible. Otherwise choose the smallest-index row k attaining max b; initial basis contains t and every slack except s_k. It has t=max b, s_i=t-b_i>=0. This is an explicit input-only feasible basis; no preliminary candidate solve or arbitrary artificial preferred basis.

Use exact rational tableau pivots. Enter smallest variable ID with negative reduced cost; leave by exact minimum positive ratio, ties smallest BASIC variable ID (Bland). IDs/order and whether tableau updates or refactoring are used must be frozen. No EPS comparisons, perturbation,regularization or condition threshold in this exact method. Native numerical safety is a separate fact.

If optimum t=0, reconstruct a feasible u from the LP variables. If optimum t>0, obtain dual y independently from the final LP basis and verify ALL exact conditions: y>=0,Aᵀy=0,sum(y)=1,bᵀy=t>0. This is a genuine Farkas certificate of infeasibility for the selected halfspaces. Weights y are dimensionless, infeasibility margin bᵀy is metres; they are not position lambda kg*m or force. A singular pivot, work exhaustion or failure to find this witness cannot yield INFEASIBLE.

### Phase II: feasible-start exact primal active set

Start only from Phase I's independently feasible u. Choose a greedy original-row-order rank-independent subset W of exact tight rows. Solve the equality-constrained search direction using H and A_W: minimize .5pᵀHp+(Hu)ᵀp subject A_W p=0. Factor only this independent basis, never whole36 Gram. Use exact zero/nonzero rank with deterministic first-nonzero Fraction elimination; no copied native floating pivot threshold.

For p!=0, take alpha=min(1, min_i[(A_i u-b_i)/(-A_i p)] for nonworking A_i p<0), exact arithmetic. Pick smallest row index among blockers; update u and add the blocker. A true dependent row cannot block a direction orthogonal to its working span; check that algebra rather than removing its inequality.

For p=0, derive working lambda from Hu=A_Wᵀlambda. If all lambda>=0, extend by zero to all m rows and certify optimum. Otherwise release the smallest-index working row whose lambda is negative. This primal release/blocker order differs from native dual violation entry. Keep all full-row margins and exact objective throughout.

Degenerate zero-length steps need an explicit bounded policy. Proposal: record stationary working-basis repeats (at p0 the equality optimum is unique for that basis); a repeated stationary basis gives REFERENCE_WORK_LIMIT/cycle, not infeasibility. Also impose the finite transition budget below. Do not assert universal finite success of the proposed QP tie rule without a proof; never add a post-trial alternate method or restart.

### Full exact certificate

For SOLVED verify every row Au-b>=0,lambda>=0,lambda_i*(Au-b)_i=0,Hu-Aᵀlambda=0,static u0 and objective .5uᵀHu. Report exact residual0 separately from the rounded native result's rational residuals. Strict convexity establishes unique primal optimum, not unique dual weights. For INFEASIBLE verify the independent y witness above with all original coefficients; candidate ray may only be compared afterwards.

## 4. Status and budget proposals

Freeze independent Phase I<=4096 simplex pivots and Phase II<=4096 working transitions/factorizations, plus maximum8192-bit numerator/denominator for any rational operand. These are proposed BEFORE-trial bounds, not a promise all finite admitted extremes succeed. Count row tests,rank tests,tableau pivots,QP factorizations,adds/drops and peak rational bits separately. No enumeratedMasks on the36-row algorithm.

Exact reference statuses: SOLVED,INFEASIBLE,REFERENCE_WORK_LIMIT,REFERENCE_BIT_LIMIT. The last two are unresolved reference EXECUTION_FAILURE, never INFEASIBLE. Native statuses remain SOLVED,certified INFEASIBLE,NUMERIC_UNSAFE,WORK_LIMIT. Native finite safety/work refusal can be physical NO-GO even when the independent exact problem is feasible. No safe-output convention may use a zero solution or null-to-number conversion.

A floating ray with merely small Aᵀy is not an exact Farkas proof. To call native INFEASIBLE certified, require its exact decoded-coefficient witness or independently confirmed exact reference witness; keep approximate witness residuals distinctly labelled. Root must select the standalone native verification contract. Numerical inability must remain NUMERIC_UNSAFE/WORK_LIMIT when no genuine certificate exists.

For bounded practical workload, one full-row reference problem per reached World position phase, not per alternate basis or candidate retry. Repeated source/compiled requests may reuse an immutable FULL identical-input-hash expected result only if root explicitly freezes this memo policy; it is a cold result reuse, not a warm basis. Key must include exact bodies/masses/all ordered rows/source+algorithm identity and zero bits. Check each actual native result separately and report requests,distinct cold solves,cache hits honestly. No success may depend on a hash-only equality assumption without validating stored bytes. No runtime timing target here.

Stream compact per-problem output/phase frames; no unbounded in-RAM exact-history arrays. Retain exact optimum/cert/witness, counters and full input hash with the first failed prefix. New budget/refusal/parser and proof-storage decisions must be pinned before code. If actual selected inputs exceed reference work/storage, record EXECUTION_FAILURE; do not tune limits after a physical result.

## 5. Exact request and response proposal

`{op:'kernel',scope:'nine-start'|'full-pair',problem,result?}`. Exact problem keys bodies,rows; body{id,inverseMass}; row{aId,bId,normal,boundM}. No basis/warmseed/preferredRows field. Strict plain/dense/finite/nonboolean values,unique IDs,distinct endpoints and copied raw Float64 zero conventions. An optional native result is accessed only AFTER the independent expected result is derived.

Reply `{ok,resolved,executionFailure,referenceStatus,metrics,reference,violations}`. Reference stores exact u,lambda,objective,full margins,rank/counters and certificate OR Farkas witness. Canonical reduced numerator/positive-denominator strings,zero0/1. Metrics name translationDifferenceM,objectiveDifferenceKgM2,primalViolationM,negativeMultiplierKgM,complementarityKgM2,stationarityKgM; numeric unavailable fields are null with status/reached flags, never zero. Native and reference status fields remain separate. Malformed request is REFERENCE_INPUT; invalid JSON REFERENCE_JSON; resource-unresolved has its own code and no physical success. Exact messages need root selection.

World wrapper request should bind original decoded PRE bodies/raw104*n/config plus all-pair compact native selections, problem,result,hyp/raw and source phase metadata. Independently check every eligible pair/selection/row from PRE, then exact QP, then ONE PRE+u rounding and final all-pair geometry. Native axes/solution do not seed expected geometry; the observed axis index can identify the independently checked near-tied axis, not define the independent minimum. No last failed POST input.

Reuse adopted SAT/coverage and point-ledger algebra unchanged where appropriate. Raw+normalized Decimal80/120 geometry agreement1e-12m,precision1e-25m,finalized closure depth1e-12m; original World2mm,finite floor/q/body/settling gates remain separate. P/L accounting1e-7 includes gravity/commands/actual point FINAL impulses and position orbital artifact; no queue,energy conservation or force calibration claim. Static/q/v/omega raw-bit retention and actual rounded delta are mandatory.

## 6. Complete guard families to instantiate before code

- Genuine ninth start,0/8/9/36 rows,1/2/9 bodies,all dynamic versus floor; nonzero signed bounds and mass weights.
- Duplicate/redundant consistent rows,opposite inconsistent rows,zero dynamic coefficient static/static positive bound,rank-deficient feasible rows and certified Farkas ray.
- Nonunique lambda/working basis with unique u/objective; row permutation preserving mathematical optimizer,while native deterministic graph parity uses one frozen order.
- Native conditioning unsafe versus exact feasible; deterministic work/bit/cycle refusal, no fallback; certificate tamper/inactive multipliers/full-row omission/false infeasible witness.
- Null/bool/nonfinite/sparse/extra-key IDs/endpoints/mass/normal/bound/rational fields; missing status/reached data; copied input/output and unknown Error/object/null/getter identity.
- Raw signed zeros,static exact u0,correction10m/outer total movement,one fresh PRE application,held q/v/omega/all-row geometry/metadata.

These are kernel/protocol guards, not more physical scenes. Exact literals,counters,status/error priorities and algorithm budgets must be selected by root. The same child proceeds to original ALIGNED/OFFSET/YAW1200steps only after its bounded kernel start gate; no indefinite detached series or successful World replay. Old8-row source, #1384 cap NO-GO and public/Viewer/engine scope limits stay immutable.


---

# #1399 World and phase ABI proposal

Status: SOURCE-ONLY PROPOSAL. No new solver, reference, control, build or World ran. Root must select the algorithm, rank policy, numeric rules and reference before code.

## 1. Source boundary and start

Read sources: `/Users/user/.codex/worktrees/physics-signed-closure-world-1384/barocss/examples/physics-rigid-signed-closure-world/`. Current full-pair Wiki: `/tmp/barocss-physics-wiki-814/Physics-Full-Pair-CPU-Position-Solver-Plan.md`.

The Wiki records exact #1384 native `a7bf69e2d7b6e75b99df7207aa91874ed71e032e` adoption at `4ae895123bd37238599f1ad4f6b7db2a2b8e76ba`. It preserves ROW_CAP NO-GO and separate Integration validation. Root must retain that adoption receipt and all native hashes before start. First detached input is the immutable ALIGNED153 PRE with its current eight rows and fresh ninth PRE row. That nine-row start is a kernel gate; the following World phase builds every eligible PRE row and does not keep an eight-plus-one selection rule.

Only NEW `examples/physics-rigid-full-pair-position-world/**`. Public packages, parents, Viewer, root files and locks stay with their owners. The private body limit is 1..9; public persistent/Viewer limits do not change.

## 2. One phase in the existing World transaction

| Order | Required behavior | Actual parent source |
|---|---|---|
| 1 | ensureActive, exact dt, step limit, parse this call's commands; no queue | reference-world.ts:140–146 |
| 2 | Copy accepted bodies; preserve original angular command, motor, quaternion, linear integration arithmetic | reference-world.ts:147–196 |
| 3 | Emit copied `free-ready`; assemble current contacts, initialize all points, warm compatible patches once | reference-world.ts:218–220; global-island.ts:125–158 |
| 4 | Run original 64 global velocity sweeps and original point order; copy actual FINAL point accumulators | global-island.ts:159–174 |
| 5 | Copy velocityBodies and actual point ledger; emit copied `velocity-ready` | reference-world.ts:221–223 |
| 6 | Replace only projectPositions: all fresh PRE signed rows, one whole solve, one hypothetical application from that PRE, all-pair postcheck, then one working application | global-island.ts:177–186 |
| 7 | Preserve assembly contacts/cache/events; emit copied `closure-ready`; whole accepted-to-final movement, original result and other outer checks | reference-world.ts:224–264 |
| 8 | Commit all accepted state and diagnostic values together, then cursor increments | reference-world.ts:265–283 |

No growing rows, repeated solve, new contact velocity pass, position warm seed, past active basis, failed POST normal, or cumulative translation. The current original pair list excludes static/static, orders endpoint IDs lexically, then sorts pairs (reference-world.ts:101–111). Preserve it. The main eight-dynamic-plus-floor scene has 36 eligible pairs. Kernel literals may contain static/static constraints even though this World pair list excludes them.

## 3. Proposed pure problem and output

`solveFullPairPosition(problem: FullPairProblem): FullPairResult` is synchronous and pure. Admission owns dense ordinary arrays/records, own-data fields, finite values, lengths, IDs and copies. Exact error precedence must be frozen by root. No candidate seed or preferred basis input.

```
FullPairProblem = {
  bodies: Array<{id: string, inverseMass: number}>, // 1..9, original body order
  rows: Array<{aId: string, bId: string, normal: Vec3, boundM: number}> // 0..36
}
```

Mass profile: inverseMass is 0 or [1e-6,1e6] kg^-1. Unit normal gate 1e-12. Signed bound is [-10,+10] m. Preserve every input coefficient and row bit. Static u is zero. Dynamic correction norm is at most 10 m. Minimize `0.5 sum(|u|²/inverseMass)` in kg*m² subject to every `normal dot (uB-uA) >= boundM`. Do not invert the whole Gram as full rank. For the main scene dynamic DOF is 24; dependent rows remain constraints.

Proposed result discriminant and fields:

```
common = {status, counters: WorkCounters, rank: number|null,
          activeBasisRows: number[], uniqueActiveSetClaimed: false}
SOLVED = common & {
  status:'SOLVED', translations:Array<{id:string,u:Vec3}>,
  lambdaKgM:number[], primalMarginsM:number[], objectiveKgM2:number,
  certificate:{primalViolationM,negativeMultiplierKgM,
               complementarityKgM2,stationarityKgM}
}
INFEASIBLE = common & {status:'INFEASIBLE', infeasibilityCertificate:<root-selected proof>}
NUMERIC_UNSAFE = common & {status:'NUMERIC_UNSAFE', reason:<frozen reason>}
WORK_LIMIT = common & {status:'WORK_LIMIT', reason:<frozen exhausted budget>}
```

Failure variants have no usable translations, optimum, lambda or margins. No null-to-number conversion. SOLVED supplies one lambda and margin per full row, including inactive/dependent rows. Basis and multipliers may differ from the independent optimum representation; dynamic u and objective remain the numerical agreement targets. `activeBasisRows` are diagnostics, not a trusted certificate or a seed. Root may choose a smaller result schema, but must freeze it before code.

`WorkCounters = {iterations, activeChanges, rankChecks, linearSolves, constraintTests}`: nonnegative integers for actual work. Root must define increment points and hard limits. No enumeratedMasks/singularMasks counters from the old enumerating algorithm. Full certificate checks use every row with unit-specific 1e-12 gates. A rejected pivot, dependent working row, singular matrix or exhausted budget is not certified infeasibility.

## 4. Fresh signed row semantics

`buildFullPairProblem(preBodies, sortedPairs)` returns `{problem,rowSources,initialDetections,pairObservations}`. Each row source records rowIndex, endpoint indices/IDs, pairKey and detached fresh selection `{candidateIndex,label,feature,normal,boundM,pointM,rawAxisLength}`. Each eligible pair gets exactly one row. The selection uses original 15-axis order, original cutoff and strict minimum at the current post-velocity PRE poses. No normalization of input q.

**Proposed explicit choice: use the unclamped fresh signed bound for ALL rows.** A touch or detector-tolerance hit with a small negative signed margin keeps that negative margin. Do not use `Math.max(0,boundM)` for initial hits. This differs from #1384 initial-row admission and needs root approval before code. Preserve the original detect result separately for diagnostic hit counts and same-axis comparison. Numeric equality gates do not canonicalize signed zero.

Far PRE bound outside [-10,+10] refuses the phase, even if the row would be slack at zero u. Scan and archive all eligible PRE pairs first, then refuse the first out-of-range pair in sorted order. No clipping, row omission or RHS rescaling. No solver call on this refusal. Root must select this bounded refusal or a declared wider profile before code; the current proposal retains the planned 10 m profile.

Fresh fixed-axis constraints can be conservative. Certified infeasibility describes this chosen linear problem; it does not prove that no nonlinear box placement exists. A SOLVED problem whose rounded output fails full geometry refuses without another solve.

## 5. Phase, counters and copied attempts

Proposed API: `runFullPairPositionPhase(workingBodies, sortedPairs, options) -> {stats,attempt}`. `options` may retain the parent's private synchronous solve hook for guard controls and copied `observeAttempt`; default uses the new pure solver. Neither is public PhysicsWorldConfig. Root must confirm the hook or remove it and select alternative malformed-output controls.

```
FullPairPositionAttempt = {
  preBodies, pairs, initialDetections, pairObservations,
  problem:null|FullPairProblem, rowSources,
  result:null|FullPairResult,
  hypotheticalBodies:null|Body[], rounding:null|Rounding[],
  finalPairObservations, failurePair:null|string,
  workingApplicationCount:0|1,
  error:null|{kind:'typed-refusal'|'unexpected-error',name,code?,message}
}
```

Null means a phase did not produce that value. Do not fabricate a zero result, empty successful scan or accepted final pose. Capture the full problem before solve; validate the result/certificate before any application. Apply dynamic p+u once from fresh PRE. Static positions are copied bit-for-bit, with no addition. Hold q/v/omega and all other body fields. Archive nominal u, actual decoded delta, rounded final and addition roundoff. Hypothetical scan covers every eligible pair once, including ties. Success observer runs on a deep copy before working application. Known failure observer receives the reached attempt with count0; unknown observer throws propagate the original Error/object/null without another callback or commit. Root freezes exact callback precedence and primitive error metadata handling.

Stats proposal: `{tests,hits,rows,signedPreQueries,solverCalls,postPairTests,maxTranslationM,workingApplicationCount,solverCounters,certificate}`. Initial default is explicit zero values and null certificate. `tests` counts fresh original PRE detects; `hits` counts non-null detects including touch. `rows`/`signedPreQueries` count all eligible signed PRE queries, not hits. `solverCalls` is 0 or 1 per attempt. `postPairTests` counts actual post scans. Keep separate native and independent observer work. Old global stats retain positionSweeps=1, positionTests=tests, positionHits=hits after phase success. No grown-row count replaces hits. Counters for failed attempts belong to observer evidence; accepted getters keep their prior values.

## 6. World ABI and atomic state

Proposed new private getters: `getFullPairPositionStats()` and `getFullPairPositionAttempt()`. Keep getStepLedger/getState/step/query/dispose/getWarmCacheStats/getWarmCacheSnapshot/getGlobalContactStats. Every getter calls ensureActive and returns detached data. Initial new stats zero, attempt null, ledger null. Do not expose the old LiveSignedClosure type under a new meaning.

Keep exact StepLedger fields: beforeBodies/freeBodies/velocityBodies/finalBodies/fixedStepSeconds/gravityMps2/actions/points. Keep StepAttempt stages free-ready, velocity-ready, closure-ready and actual null partial fields. On position refusal only free-ready and velocity-ready exist. On outer refusal closure-ready contains the actual attempted final pose; accepted getters remain old.

PointLedger keeps actual endpoint indices/IDs/positions, pairKey/pointId/family/pointM/normal and warm/final accumulators. Current-step endpoint impulse is `J=normal*final.normalNs+final.tangentNs`; A receives -J, B +J. It is not final-minus-warm. Do not use the unweighted contact mean for torque. Preserve the original point helper and all 64 velocity arithmetic. Position multipliers kg*m are not impulses Ns. Preserve phase P/L accounting (commands/gravity, point impulses, position orbital change), aggregate contact deltaK only.

Single commit owns bodies, contacts, events, jointStates, ccdHits, pairStats, activePairs, persistentPoints, sleepFrames, globalStats, warmCacheStats, new position stats/attempt, complete StepLedger and stepIndex. Failure/observer throw changes none. Commands exist only in this step's parsed Map. Dispose clears accepted diagnostics and retains original DISPOSED precedence. Late total accepted-to-final movement >10 m maps to new RESULT error before commit, followed by original validateResult ordering.

## 7. Proposed exact new refusal bridge and precedence

All new World physical phase refusals use original PhysicsError code NUMERIC_LIMIT. Suggested frozen FULL_PAIR_ERRORS messages (root must select):

| Key | Proposed message |
|---|---|
| INPUT | private full-pair position input is invalid |
| PROFILE | private full-pair position profile is unsupported |
| RANGE | private full-pair position signed bound exceeds the admitted range |
| GEOMETRY | private full-pair position requires fresh matching box geometry |
| INFEASIBLE | private full-pair position constraints are infeasible |
| NUMERIC_UNSAFE | private full-pair position solve is numerically unsafe |
| WORK_LIMIT | private full-pair position solve exceeded its work limit |
| RESULT | private full-pair position result is invalid |
| NONPENETRATION | private full-pair position result left an overlapping pair |

Preserve original `private global contact island phase order is invalid`, feature-witness and penetration messages. Preserve ensureActive -> exact dt -> step limit -> current command parsing -> free numeric limits -> original assembly/witness -> PRE geometry/range -> solve status -> result/certificate -> copied phase observer -> working application -> copied closure-ready observer -> total movement -> original outer validation -> commit. Unknown errors retain identity. Root must freeze admission-field priority, reference failure classification and whether failure observer is called on PRE refusal. Reference unresolved/protocol errors are EXECUTION_FAILURE; resolved numerical violations are NO-GO; certified infeasibility, unsafe solve and budget limit stay distinct.

## 8. New module ownership and frozen literals

All modules below are new under the declared prefix. Suggested split, with exact filenames for root adoption:

- World owner: reference-world.ts, global-island.ts, world-types.ts. Minimal copy of #1384 plus one phase call, new getters and transactional fields.
- Model owner: full-pair-types.ts, full-pair-input.ts, full-pair-rows.ts, full-pair-apply.ts, full-pair-phase.ts, full-pair-solver.ts, full-pair-basis.ts, full-pair-linear.ts, full-pair-certificate.ts. Root selects algorithm details and may merge helpers before freeze; no parent kernel copy or edit.
- Harness owner: entry.ts, archive.mjs, frames.mjs, controls.mjs, literal-cases.mjs, consumer.mjs, bundle.mjs, runner.mjs, freeze.mjs, tsconfig.json, input-freeze.json, README.md. Authenticate parent raw/hash archives; preserve first failure prefix across source/repeat/genuine compiled.
- Independent reference owner: reference.py, full-pair-reference.py, nine-row-reference.py, reference-controls.mjs. Exact nine-row 512-mask start only; separate full-row cold algorithm. No candidate basis/u seed, no 2^36 enumeration. Root selects final reference paths/schema.
- Root: CONTRACT.md, parent/adoption/provenance receipts, actual source and emitted freezes, execution and native handoff.

Before-code literal list must include: actual ninth-row PRE; 0/8/9/36 rows; a full dependent coherent set with unique primal and nonunique lambda; dependent incompatible bounds with checked infeasibility proof; static zero RHS feasible and positive RHS infeasible; mass endpoints and invalid reciprocal safety; rank/conditioning refusal separate from infeasibility; work-limit at a frozen budget boundary; row permutation/coefficient/copy and result tamper; small negative touch bound without clamp; far bound at +/-10 and outside the range; static -0 preservation; original command/noqueue routing; copied getter mutation; observer Error/object/null identity; prior accepted nonzero cache/cursor/ledger retention; late wholemovement refusal. No new physical trial or computed expected result is supplied by this proposal.

After algorithm/ABI/error/literal/reference choices are complete: exact adoption gate, complete source/error/input/reference freeze and measured source commit, one build/strict types, root-published actual emitted ledger, detached nine-row start GO, then same child original three 1200-step/10 s World flows. First physical failure is persisted without tuning. Independent full geometry and u/objective gates remain 1e-12; precision remains 1e-25; original World quality gates remain unchanged.

Unresolved root choices: active-set law and cold initialization; rank/dependence/conditioning definitions; tie and anti-cycle rules; work budget; infeasibility proof schema; exact new error priority; all-unclamped touch admission; far-row refusal; private solve-hook retention; independent full-row algorithm and observed cost acceptance. No proposed choice is measured GO.

## Appendix A. Root selections and literal inputs

Root has selected: ALL eligible PRE bounds remain unclamped, including touch; scan all PRE pairs, then RANGE-refuse the first lexically sorted out-of-range pair with solverCalls=0; retain private guard-only solve/observeAttempt and observeStepAttempt hooks; accept the exact FULL_PAIR_ERRORS messages above; keep late wholemovement RESULT and original global/witness errors. General kernel has at most 27 dynamic DOF; the original scene has 24. Rank, numeric algorithm, budget and reference choices remain pending. These selections supersede the open choices in the earlier sections.

Further root selection: only INTERNAL `runFullPairCore(problem,limits)` accepts default or reduced nonnegative integer budgets. `solveFullPairPosition(problem)` always uses defaults, with no options or seed. The internal control may reduce the iteration budget to zero; it does not widen the numeric profile. New strict kernel admission uses own-data descriptors without invoking getters, and keeps the normal-unit gate. Original World body reads remain unchanged. Typed bridge recognition requires the original PhysicsError identity plus exact code/message; unknown getter or thrown values propagate unchanged.

The following are source-authored inputs, not computed expected outputs. Vec3 literals are binary64 inputs as written. The author has not imported or run any model. A label such as INFEASIBLE requires the selected algorithm's checked certificate; it does not authorize a fabricated certificate. Numeric rank and work expectations remain pending where stated.

### Shared exact data notation

- `M9`: bodies a,b,c,d,e,f,g,h,i in that order; a.inverseMass=0, each other inverseMass=1.
- `D3`: bodies a,b,c in that order, each inverseMass=1.
- `S2`: bodies a,b in that order, each inverseMass=0.
- `X=[1,0,0]`, `NX=[-1,0,0]`. Every row is `{aId,bId,normal,boundM}`; no other row fields.
- `STAR8`: pairs ab,ac,ad,ae,af,ag,ah,ai, each with X and boundM=0.
- `PAIRS36`, in this exact order: ab,ac,ad,ae,af,ag,ah,ai,bc,bd,be,bf,bg,bh,bi,cd,ce,cf,cg,ch,ci,de,df,dg,dh,di,ef,eg,eh,ei,fg,fh,fi,gh,gi,hi. `ZERO36` uses X and boundM=0 for every listed pair.
- Kernel IDs a..i are synthetic IDs. They do not rename any archived body. An archive fixture keeps its original floor/b0..b7 IDs and coefficient bits.

### At most 15 core input groups

| ID | Exact input or exact immutable selector | Expected semantic/gate label; no optimum asserted |
|---|---|---|
| L01 | bodies `[{id:'a',inverseMass:0},{id:'b',inverseMass:1}]`; rows `[]` | Zero-row valid kernel input. Full copied output and static-zero rules. No division, rank or solve work may be invented. |
| L02 | M9 + STAR8 | Valid eight-row boundary. All rows retained; compare full certificates and copies. No old enumeration required. |
| L03 | Parent `evidence/native-13ab386a/source-ALIGNED.jsonl.gz`, record `{kind:'step',scene:'ALIGNED',step:153}`; preserve `attempt.preBodies`, last archived eight-row problem and all row bits. Append ONLY a fresh current PRE query for b6/b7 after independent query agreement. Use `source-ALIGNED.f64le.gz` and manifest raw cursor, not JSON for historical signed-zero claims. | Genuine nine-row kernel start; no injected solver and no failed POST input. Dedicated 512-mask reference gate. Before input freeze, archive adapter must publish the exact source/decoded hashes, raw cursor and the newly queried ninth row. This draft does not fill them with inferred values. |
| L04 | M9 + ZERO36 | Valid full 36-row coherent dependent set. Keep every inequality. Unique primal/nonunique multiplier distinction; no demand for a unique basis or matching lambda bits. |
| L05 | M9 + ZERO36, with row ab changed to X/boundM=1, row bc changed to X/boundM=1, row ac changed to NX/boundM=1; every other row stays exact | Full 36-row inconsistent constraints. Require independently checked infeasibility proof. Singular basis alone is insufficient. |
| L06 | D3; rows ab/X/1, bc/X/1, ac/X/2, in that order | Coherent exact linear dependency. All three constraints stay in the problem. No regularization, truncation or preferred-basis seed. |
| L07 | S2; one row ab/X/0. Separate same-body-profile variant has ab/X/-1 | Static-only zero/negative RHS feasible semantics. No inverseMass reciprocal on static bodies. Static translations and body bits retained. |
| L08 | S2; one row ab/X/1 | Static-only contradictory constraint. Certified INFEASIBLE only with the selected proof; not NUMERIC_UNSAFE merely because Gram is zero. |
| L09 | D3; rows ab/X/0, ac/X/0, bc/[1,1e-13,0]/0. Exact-rank companion changes only the third normal to X. | Finite near-dependence versus exact dependence. Norm admission must be checked. Final conditioning/rank disposition is root-pending; neither input is automatically declared infeasible. Retain coefficient bits and actual rank work. |
| L10 | bodies a.inverseMass=1e-6,b.inverseMass=1e6; row ab/X/1. Admission variants change only a.inverseMass to -1,5e-7,2000000 or Number.MIN_VALUE. | Valid mass endpoints; the four variants are PROFILE refusals under the selected interval, before solve. Unsafe reciprocal controls inside the admitted interval require the final linear algorithm's own numeric fixture, not a mass-profile widening. |
| L11 | Pure rows use M9/STAR8 with only ab.boundM respectively +0,-0,-1e-13. Geometry variants: dynamic box a center[0,0,0],static box b center[2,0,0] or [2.0000000000001,0,0], both half[1,1,1],identity XYZW[0,0,0,1],v/omega[0,0,0]. Feed the fresh selected signed margin unchanged. | Unclamped touching and slightly separated semantics. Original detect remains a separate observation. Do not assign its tolerance classification or compute the selected margin in this draft. Preserve signed-zero metadata and source/compiled input bits. |
| L12 | Pure one-row problem: bodies a.static,b.dynamic inverseMass1; ab/X with boundM each of -10,+10,-10.0001,+10.0001. World geometry companion: dynamic box a center[0,0,0],static boxes b center[13,0,0],c center[-13,0,0],all half[1,1,1],identity q,v/omega0. | Exact range endpoints admitted; outside endpoints RANGE refuse. World test archives ALL eligible PRE queries, refuses first sorted out-of-range pair, solverCalls0. No row omission/clamp, even when the bound is negative. No exact fresh margin is precomputed here. |
| L13 | Prepared body copy: static a.positionM[-0,+0,-0],dynamic b.positionM[1,0,0],qidentity,v/omega0; authored zero translations for both. No solver call. | Explicit apply-copy guard, not a physical solve. Static has no addition and keeps all position bits; dynamic follows one original binary64 addition. Record nominal/actual/rounding values rather than canonicalize. |
| L14 | Valid L02 problem given to guard-only solve hook. Returned malformed SOLVED variants: translations=null; one u component=null; lambda array with a hole; one full margin=null; objective=NaN; certificate=null; margins array omits one row; wrong translation ID. Mutate only one field per receipt, starting from a genuine validated L02 result obtained in the frozen flow. Admission variants put an own accessor instead of inverseMass, normal, or boundM, with a getter that increments a canary and throws if called. | Injected result-validation faults only, expected RESULT. Admission rejects accessors with canary still zero. Not evidence of physical infeasibility, unsafe arithmetic, optimizer behavior or World quality. Stop before working application and preserve accepted data. |
| L15 | Genuine internal work guard: bodies a,b both inverseMass=1; one row ab/X/boundM=0.1; call runFullPairCore with iteration budget0, all other budgets at defaults. Separate valid L02 phase guard-only hook returns INFEASIBLE without proof, NUMERIC_UNSAFE, WORK_LIMIT, or throws Error('1399-solve-marker'), object `{marker:'1399-solve-marker'}`, null. Observer separately throws those same identities on copied attempts. | Internal budget guard expects WORK_LIMIT with honest work counters, not infeasibility or physical failure. Invalid proof => RESULT. Injected unsafe/work payloads map only after structural validation and exact class/code/message checks. Those injected payloads prove transaction mapping only. Unknown throws propagate unchanged. Root finalizes failure payload schema and limit field names before freeze. |

L14/L15 fault hooks run only in separate guard controls, never the genuine archived input or the three main World flows. L15's reduced-budget core call is a genuine work guard with no physical World. The full default budget and genuine numeric-unsafe fixture remain pending conditioning arithmetic and counter definitions. Do not claim L15's injected unsafe status measures that missing numeric fixture. Freeze final literal names/values before implementation/trial; do not add them dynamically after a failure.

### Original World controls retained as a separate list

Use the actual original configurations/actions frozen by #1384 controls; copy no synthetic kernel input into the main scene. Retain: exactdt and disposed precedence; command array/record/field/target/duplicate/vector validation; actions affect only the current step; original phase-order/witness/penetration errors; facewarm compatibility and cold edge routing; real nonzero accepted cursor/cache/ledger followed by a refusal; late whole accepted-to-final movement and outer bounds; copied getter/observer mutation; unknown getter/proxy/observer Error-object-null identity; original raw/source/repeat/genuine-compiled first prefix parity. New status faults, apply-only signed-zero guards and algebra literals keep separate call counts. Every main accepted position attempt has one solver call and one working application; PRE range refusal has zero solver calls and no closure-ready frame.
