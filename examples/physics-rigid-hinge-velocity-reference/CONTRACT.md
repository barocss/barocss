# #1349 before-code contract — 2026-10-11

## Authority and immutable dependencies

Root selects the existing OPEN PHYS-ENGINE-JOINT-03. Base d6b552f98f4a509611ffce42a65080db063fdda0; branch codex/physics-hinge-velocity-1349. Exact #1309 adoption0836f3e78fcc98021b6204ba3d16cbae3f309213 contains all59native modes/blobs from63d20195→1381164c. Forty manifest artifacts, decoded gzip and raw hashes remain. Original pose-only L loss0.015787801199422996>1e-7 is retained. #1294 diagnostic and external #1279 HEAD0de27c archive remain explicit dependencies; no historical source pin rewrite or producer replay. Current UI/files/recovery674/1254 are pending and do not block available code.

ONLY NEW examples/physics-rigid-hinge-velocity-reference/**. No old examples/packages/root/lock/policy/Integration edits. Root owns source commits/full graph/error/input/reference freeze, actual build/types/emitted freeze/ONE flow/evidence/remotes. Three workers own disjoint files and preserve others' changes. No worker build, candidate, solver, oracle, control, trial, commit or remote mutation before root full freeze. Source-only implementation begins after this contract is published. Native GO is unmeasured and cannot imply a World/motor/public engine/release.

## Selected composition and private API

Private projectHingePoseVelocityReference(config:PhysicsWorldConfig,state:PhysicsState,dt:number) returns copied {bodies,poseReport,diagnostics}. Export original PhysicsError, ERRORS, and pure solveDimensionlessVelocity/validateVelocityCertificate guards. No callback or solver injection in physical API.

Use the exact adopted projectCoupledHingeCandidate ONCE. It returns pose-only momentum loss as data; no momentum exception is caught or suppressed. Keep its exact corrected p/q and poseReport, unchanged original output bounds and unknown errors. Then compute the velocity projection below. Never call World/projectOnce/projectDynamicHingeJoint/motor or duplicate the pose algebra. No new anchor-coherence admission. Original two1kg/.1m spheres, metadata/+Z axis/±.1anchors/±.8limits/motor metadata/dt1/120 remain. Original sphere inertia operation is 0.4*massKg*radiusM**2, not nominal .004. Carrier step/time stays original, no stepped state returned.

Error precedence and EXACT new messages: dt first INVALID_STEP / private hinge velocity step must equal 1/120. Then original structural parser errors unchanged. Only exact known old private profile/pose/result errors map respectively to INVALID_CONFIG / private hinge velocity profile is unsupported; NUMERIC_LIMIT / private hinge velocity archived pose is invalid; NUMERIC_LIMIT / private hinge velocity result is invalid. Original physical body-bound errors remain unchanged (including pairB0 position exceeded bounds). Pure linear malformed dimensions/finite/dense/H<=0 => NUMERIC_LIMIT / private hinge velocity linear data is invalid. Finite unsafe reciprocal/Gram/pivot/inverse/condition => NUMERIC_LIMIT / private hinge velocity system is singular or unsafe. Finite invalid primal/stationarity/stop-sign/complementarity/certificate/objective => NUMERIC_LIMIT / private hinge velocity certificate is invalid. Final nonfinite new result => NUMERIC_LIMIT / private hinge velocity result is invalid; original validateResult physical bounds run on final bodies. Only known exact errors bridge; unknown thrown Error/object/null retains identity. Preserve all input bytes and previous/reference records on refusal.

## Physical law, signs and fixed units

DOF order [vAx,vAy,vAz,wAx,wAy,wAz,vBx,vBy,vBz,wBx,wBy,wBz]. Hdiag=[mA×3,IA×3,mB×3,IB×3], x0 exact original velocities, objective .5 sum H_j*(x_j-x0_j)^2 in J.

Original rest origin O is config midpoint. Fixed BEFORE mass COM C and BEFORE P/L_O are computed in original body order with original scalar helper operations. Use centered L target L_O_before-cross(C-O,P_before) and final p'-C coefficients; actual physical momentum diagnostics retain original O. This is a stated linear row operation, not a target recomputed from candidate output. Original centered-target rounding is recorded.

Let R(r)z=r cross z. Rows ordered Pxyz (0..2), Lxyz (3..5), anchorXYZ (6..8), transverseX/Y (9/10), optional signed stopZ (11). Physical blocks:
P=[mA I,0,mB I,0], b=Pbefore.
L=[mA R(pA'-C),IA I,mB R(pB'-C),IB I], b=L_O_before-cross(C-O,Pbefore).
Anchor=[I,-R(rA),-I,+R(rB)], b0, where r_i=rawRotate(q_i',originalAnchor_i).
Transverse=[0,-ex/ey,0,+ex/ey], b0.
Upper stopD=[0,-ez,0,+ez], lower stop negativeD, inequality D*x<=0.

Sdiag velocity1/omega10; row divisors Tdiag P1×3,L literalbinary .1×3,anchor1×3,rate10×2(+stop10). E0=1J. Ad_ij=(A_ij*S_j)/T_i; bd_i=b_i/T_i; Hd_j=(H_j*S_j)*S_j/E0; y0_j=x0_j/S_j. Never retain physical H with scaled angular unknowns. Scalar summation is ascending index, no FMA/reordered reductions. Physical multiplier lambda_i=E0*lambdaDimensionless_i/T_i; active signed multiplier<=0 (mu=-lambda>=0), never clip. Preserve both physical and dimensionless rows.

Eligibility uses the PRE-pose target obtained by original BEFORE wrapped raw angle and one clamp: EXACT target===upper or lower, else none. Use original poseReport.targetAngleRad, not final rounded angle or authored report. Genuine old failure has target .7999999999999999 and is INTERIOR. No slop/snapping/future prediction. Solve11equalities first. If eligible signed outward rate>0 EXACT in native result, append its zero-rate row and solve once. <=0 including exactzero is inactive. No adaptive boundary policy; reference branch discrepancy is retained as failure. Maximum2active choices, not a convergence loop.

## Bounded linear algorithm and certificates

Pure solveDimensionlessVelocity(problem) input EXACT keys {a,b,h,y0,stopKind,stopRow}; a11×12,b11,h12,y0 12, stopKind none|upper|lower, stopRow[] fornone or12numbers otherwise. Plain dense finite data only; positive h; no extra keys. Literal algebra guards use this interface and do not expand physical profile. Result fields EXACT {y,lambda,activeStop,identity,solveAttempts,phases,objectiveDimensionless,certificate}. Eachphase includes rowIds/rowCount,pivots,inverse,normInf,conditionInf,lambda,y,residuals; accepted numeric pivot count is not exactrank. Certificate physicaladapter tags are separate.

Identity is EXACT ascending-index Ad*y0-b===0 allrows and eligible Dd*y0<=0. Preserve all original x0 v/omega bits then; solveAttempts0. Fraction optimum still compared, and physical/numeric gates still run. No tolerance identity branch.

Gram G_ik=sum_j (Ad_ij/Hd_j)*Ad_kj, rhs_i=bd_i-sum Ad_ij*y0_j. Deterministic Gaussian partialpivot, first maximumabsolute pivot/lowerindextie. Factor one augmented [G|rhs|I] by fixed ascending operations to produce solution and inverse; bounded inverse columns are condition guards, not extra model decisions. Refuse any nonfinite intermediate or unsafe positive H reciprocal. Refuse pivot<=1e-12*max(1,normInfG), then conditionInf=normInfG*normInfInverse>1e12. No pseudoinverse/regularization/droppedrow/retry. Numeric rank is acceptedpivot count; independent Fraction checks exactrank11/12.

Return y=y0+Hd^-1 Ad^T lambda. Fixed primal/stationarity/negative-mu/complementarity gates1e-10 dimensionless. Active signed lambda<=1e-10 and conventional mu negative magnitude<=1e-10; inactive multiplier0. Objective finite nonnegative; no clipping. validateVelocityCertificate(problem,result) validates dense schema and recomputed residuals/objective/active choice at the same frozen gates; separate pure tamper controls, no injection. Any actual physical profile refusal or failed gate stops the first graph and repeats only that prefix. These absolute rules do not guarantee every admitted finite extreme input passes.

## Exact diagnostics schema

poseReport keeps only old jointId/finalAngleRad/targetAngleRad. diagnostics keys EXACT {poseStage,before,after,velocityCorrections,projection,changedComponents,identityVelocityBitsPreserved,poseLawEvaluations,sourceStepIndex,sourceTimeSeconds}.
poseStage is copied original pose-only diagnostics, explicitly historical intermediate fixed-velocity momentum; do not relabel it final. before/after retain old metric keys (relativeAngleRad,anchorAM/BM,anchorGapM,axisDeviationRad,quaternionNormError,limitExcessRad,COM/P/orbitalL/spinL/totalL vectors,energyJ) and add anchorVelocityAMps/BMps,anchorRelativeVelocityMps,relativeAngularVelocityRadps. velocityCorrections={linearMps:[Vec3,Vec3],angularRadps:[Vec3,Vec3]}. changedComponents two bodies×6booleans from Object.is on original v/omega; signedzero counts as bit change. poseLawEvaluations1 and source cursor retained.
projection keys EXACT {dofOrder,rowIds,physicalA,physicalB,physicalH,physicalX0,columnScales,rowDivisors,dimensionlessA,dimensionlessB,dimensionlessH,dimensionlessX0,centerOfMassOriginM,originalOriginM,stopKind,physicalStopRow,dimensionlessStopRow,result,physicalLambda,objectiveJ}. All arrays and nested outputs independently copied, numericvaluesfinite. Stopnone uses tag none and emptyrows, not null converted tozero. Corrected velocities intentionallychangebits and are reported; onlyidentity retainsallbits.

## First literal inputs and guard split

For EACH source/repeat/genuinecompiled graph: FIRST unchanged orbitalLossCandidateControl.input from adopted1309; THEN eight original archive records matching archiveGraph, ordered exactly historicalselectRecords (196/197×two groups×private/canonical). Total24 authentic archivecalls acrossthreegraphs, not24pergraph. THEN22literal actualcandidatecases:
15 original literalCandidateControls inputs in originalorder (rest, signedzero, coherentinside, exactupper, exactlower, slightupper, slightlower,qsign,Z1,canonicalpair1Z0,commonCOM/commonv,nonzeroP,equaloppositespin,orbital,orbital+spin); use oldinputs only, not oldoracle or expected velocity-unchangedgate.
Add four stop literals from oldslight-upper/lower-excess copies: upper-outward wAz=-1,wBz=+1; upper-inward +1/-1; lower-outward +1/-1; lower-inward -1/+1, all otheromega componentszero.
Add two interior-rate literals from restinginput: wAz=-1/wBz=+1 and reversed, no stop.
Add one transverse-rate literal fromrest: wA=[1,0,0],wB=[0,1,0], no stop. No newmass/axis/posecanonicalization. Source-derived expectedbranch tags upper/lower/none and active/inactive asnamed are frozen; originalslightzero cases testinactiveexactzero. Originalexactupper/lower andorbital areinteriorunderactualtargetrounding, not stop proofs. No measuredvelocity output ispredefined.
If allpass:31candidateoutputspergraph/93total. Firstfailure freezesprefix. Zero successfulphysicalcalls in refusalcontrols; originalbodyboundrefusalcalls are countedseparately. Purealgebra/refprotocolcontrols areseparate and cannot inflatephysicalcoverage.

Freeze purelinear input/refusal literals BEFOREfirstbuild: basis rows e0..e10 in12DOF,hall1,y0all0; compatible and incompatible duplicate finalrow; h0/negative/null/NaN/MIN_VALUE; near-dependent finalrow=e9+1e-7*e10 causing Gram pivot1e-14 underfixedthreshold; dense/null/sparse/extra-key shapes; stopupper e11 and y0e11=±1/0 exerciseactive/inactive/tie, withsamebasis. Certificate tamper y/null/NaN/lambda sign/objective/activebranch/unknownkey/copy, allfixedmessagesabove. No high-boundphysicalscene inventedforrankcontrols. Typedphysicalerrors reuseoriginal22inputrefusals+unknowngetteridentity and newexactbridge constants; earlierparentsrefproof authenticated, not replayed.

## Independent reference and actual gate semantics

Independentreference authors geometry/rows/H/x0 from ORIGINAL request only. Candidate rows mayonlybecomparedafterexpectedoptimumiscomputed. ExactFraction optimum/rank/primal/stationarity/stopKKTcert0 applies to independentlyconstructedbinarymodel, not roundedFloat64x. Independentlyobservevalidatedactualframeandlabelseparatecertificate; itcannotreplaceexpectedpose/referenceinitial. Originalbinaryinertia exactbits retained; separateidealgeometricDecimalinertia convention remains explicitlylabelled.

JSON-linesrequest {config,state,dt,beforeRawHex?,output?,afterRawHex?}; reply {ok,resolved,executionFailure,metrics,violations,reference,certificate}. resolved MUSTtrue; null/malformed/unresolved isEXECUTION_FAILURE. Known validphysicalrefusal/failedphysicalgate isNO-GO. Unknownthrow remainsvisibleunchanged; no blanketNUMERICLIMITsuccess. Retain immutableparentnative/artifact/417historicalpins/external1279beforeframes, originalcompressed/decoded hashes. CurrentwholeCAD/Physicsgraphpinsarefresh, oldCADindexpinremainsimmutableandmaydiffer.

Agreement gates selectedbeforecode: expectedp/q1e-12; independentlyderiveddimensionlesscoeffA/H/b/y0 each absdiff<=1e-12*max(1,abs(referenceScalar)); nativeIexactbits; DOF/order/scales/eligibilityexacttags; linearvelocityabs1e-10m/s, angular1e-9rad/s, objectiveabs1e-10J. Decimal80/1201e-25perunit andscalartranscendentalrepeat1e-12separate. Raw/normalizedgeometryagreement1e-12. No relativeobjectivefallback or silentcert0claimonactualbinaryoutput.

PhysicalrawANDnormalized: anchor/angle/report/limit/qnorm<=1e-9, axis<=1degree, COMchange<=1e-12m, Pchange<=1e-7kgm/s, totalorbital+spinLchange<=1e-7kgm²/s. NEW anchorrelativevelocitynorm<=1e-9m/s, transverserelativeomeganorm<=1e-9rad/s, eligiblesignedoutwardrate<=1e-9rad/s. None-stoprecordsfiniterelativeZrate and explicitnoneeligibility. Energyfinite/nonnegative, BEFORE/AFTERdifferenceandobjectiveJrecorded; noenergyconservationclaim. Fullprofilebounds/condthresholddonotguaranteetheseaccuracies; preservefirstfailurewithoutrelaxation.

## Source, build and one flow

Three separategraphs and exactlive/rawFloat64LEparity. Source/repeatoriginalsrc0dist; compiledalloriginalconsumedhelpers genuinefreshdist0src; adoptedprivatepose/helpersandnewcandidateownedsource. ForbidruntimeWorld/motor/island/oldprojectOnce/projectDynamicHingeJoint definitions/calls; TypeScriptdeadimports tree-shaken. Recordactualmoduleclosure rather thanold10count. Nativeencodedraw13=208B/pair, preservezero signs inbefore/afterstream; JSONnotbitproof. Mutateactualreturnedcopiedbody/report/diagnostics/matrix/certificates once, nosecondlawcall. Keeporiginalcallerinputs/config/carrier/raw unchanged.

Fullmeasuredsourcefreeze includesallownimplementation/literals/errors/reference/control, currentwholeCAD/Physics/package/compiler/rootmetadata/build-local, originalactualhelperclosureandadopted1309/1294source/artifacts, external1279exactarchive/pins. Measuredcommitbeforefirstbuild; rootactualoriginalCAD/Physicsbuild+strictnewtypes, thenactualemittedledgerpublishedBEFOREONEconsumer. Harnessverifyexistingemittedledger,neverrecreateit. Node22.22.0/ignoredownlinks/dist. Savefirststdout/stderr/receipt/rawpartialoutput. Compiler-onlyrepairsifneededmustpreserveoriginalsource/firstlogsandfreshfreeze, beforeanynumericalexecution. Afterfirstphysicalfailure no law/tolerance/cap/row/input tuning orretry. NOViewer/cost/world/longstep/productpush/PR/deploy/npm/release.

## Disjoint source-only implementation owners

B rigid_goal_audit ONLY profile.ts,candidate.ts,rows.ts,linear-solver.ts,diagnostics.ts,entry.ts.
A capsule_face_implementation ONLY archive.mjs,controls.mjs,literal-cases.mjs,bundle.mjs,runner.mjs,freeze.mjs,tsconfig.json,input-freeze.json,README.md.
C capsule_independent_oracle ONLY reference.py,reference-controls.mjs.
Root ONLY CONTRACT.md,adoption/provenance/complete-sourcefreeze/measuredcommits/emitted/nativeevidence/results. Allpathsbelownewownedprefix. Runtime/control/reference execution is root-only afterwholefreeze. Independentguardinputdetails/errors mustappearverbatiminsource/input-freezebeforefirstbuild; no missinglatefill.

GOONLYdetachedPoseVelocityMomentumGO onnamedinputs; World/motor/reaction/networks/10s/Viewer/publicengine/cost/releasefalse/unmeasured. Existing1344separateretrospectivedetachedsignedrowproof canprogressindependentlyonceitsfullcontractisfrozen. Old1309physicalNO-GO neveroverwritten.

## Root final clarifications before code

The root exact schema/messages and22literal list above supersede differing draft names/counts. Partialpivot is fixed forwardelimination ofaugmented[G|rhs|I], thenbacksubstitution; samefactorization forallcolumns, notGaussJordan/retry. Add mandatory normInf(G*lambda-rhs)<=1e-10 andnormInf(G*inverse-I)<=1e-10 to eachnonidentityacceptedphase. Recordthese underphase.residuals {linear,inverse}; certificate {primal,stationarity,negativeMu,complementarity,objective} hasfinite residualnorms. Finalselectedresultonly, inactive lambda vectorlength11, active12, identity11zeros. Phases preserveequalitystage evenifactivechosen. Refusecertificatefailure with exact certificate message; unknownthrowsnotremapped.

Physicalprojection adds rankSufficientMarginKgM2=2I-m*|h|*|d-h|, withh=rA-rB,d=pB'-pA'; thisis a statedrounded-closure sufficientbound, notnativeexactrank. Recordfinitevalue independently, no newinitialcoherenceprofile. Nativeacceptedpivotcount andindependentexactrankremainseparate. Diagnostics schema addsthisonekey underprojection. Candidate poseStage containsoldlawEvaluations1/unchangedbitsforpose-onlyphase, notfinalcorrectedvelocities.

For reference branchboundary: exactFraction binary optimum andnative equality solutionchooseinactive atoutward<=0, active only>0. No permissivebothbranches policy. Anydisagreement is recorded asmodelcomparisonNO-GO, notprotocolmalformation, unlessreferenceitselfunresolved. Validfiniteinputmayrefuseorviolateabsoluteaccuracy; nofull-boundssuccesspromise.

Rootreviewedallthree independentdrafts source-only; no new codeorcomputation hasrun. Mathematical rankargument: exactclosedanchors andpositiveI makeactive12-rowhomogeneousrigidrotation momentumblockpositive-definite;11rowsleaveonehinge DOF. Rounded sufficientboundaboveisobservedratherthanassumed. ExactFractionrankcheckedforeachactualbinarymatrix. No rawXY/initialanchorcoherence/small-world exclusionwasadded.

## Static safety clarification before complete source freeze

Positive-H reciprocal finite scan runs BEFORE identity in both native solve and certificate validator; MIN_VALUE weight refuses system even if initial equality residual is exactlyzero. This is a safety input check, not a factorization or another model evaluation. Freeze the additional pure unsafe-reciprocal-identity guard with all b/y0zero and h0=MIN_VALUE, existing system message. Compatible/incompatible duplicate fixtures force b0=1, so their rank guard cannot be bypassed by identity. No new physical mass/inertia profile or numerical gate changes. These choices were made in source review before any build/solver/oracle/control.

Own128k input-freeze data was authored by Python JSON reads of immutable parent1309/input-freeze.json and deepcopy of the15 literal inputs+orbital input, with ONLY seven declared spin mutations. It did not import/execute JS data modules or evaluate a candidate, solver, oracle or control. Runtime authored original data and raw codecs retain the two named negative-zero paths; JSON alone is not a bit proof.

## First compiler failure and type-only repair

At7b45fda430ef404eb4bb504af2ad7327a514d1ea first originalCAD/Physicsbuild0; firststricttypes2/TS2345 linear-solver.ts92:707: Object.hasOwn(resultValue.phases,i) loses the prior Array.isArray refinement inside a callback. Preserve exactinitialsource486pinfreeze/log(stdout164B SHAe29794046f19d1012d5cd6a560ebdc04b660100e11a4b5fdb93c22f5617d70c1), stderr0/receipt. Add ONLY TypeScript unknown[] assertion at the already validated array argument. No emittedruntime controlflow/arithmetic/profile/literal/reference/gate change. Freshsourcefreeze+commit beforetyperecheck; zero candidate/solver/oracle/control executionsbeforethisrepair. Publicbuildsource7b45remainsrecorded; no redundantpublicbuild forprivateerasedtypeassertion.

## First consumer guard failure and internal representation repair

At5110f376 initialconsumerexit1 in source/guards, physicalCalls0. Failedpuregenuineprediction returned REFERENCE_INPUT /hinge velocity reference input is invalid. Originalstdout0/stderr1236B SHAab8e1a27adcce2f4f29bc44c3c1ae2dec6879c1d7fae97269f264a54641498d9/receipt/execution-failure/source/emitted ledgers preserved. ONE same-input standalone pure-reference diagnostic (no candidate law call) capturedexactresponse. Source-only diagnosis: no-output prediction uses internalDecimal body_records; finalbounds scan wronglypassesinternalDecimal tostrict external finite(int/float) validator.

RepairONLY finalbounds entry finite(public(x)) viaexisting internalserializer, plusexplanatorycomment. Externalfinite/null/boolean/nonfinite admission, actualinputs, independentmodel/coefficients/solver/literals/allnumericgates unchanged. Thisisreferenceprotocol/executionfailure, notphysicalNO-GO. Rootfreshsourcefreeze/commit andupdatedactualemittedmetadataBEFOREcontinuingguardconsumer; initialfirstfailure is notfirstpass. No candidate31-caseflow hadstarted. Originalbuildsource7b45/typesource5110remainrecorded; no affectedTS/runtimechangesrequiringanotherbuild/typegate.
