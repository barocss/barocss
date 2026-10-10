# #1344 before-code contract — 2026-10-11

## Exact start and owned scope

Existing OPEN PHYS-ENGINE-CONTACT-14. Root independently verified exact1308 adoptiond6b552f98f4a509611ffce42a65080db063fdda0, oneparentb69ea25d, all58ONLYNEWmodes/blobs from63d20195→5f944460;38artifact hashes/decoded gzip and manifest89e005c04d48a0397cc4f92bfcf655ae2286b75897c11be457d5b36c8c4c8020 retained. Scoped1308CLOSED but1264physicalNO-GO remains. Newisolatedcodex/physics-signed-separation-1344 samebase d6b552f9. ONLY NEW examples/physics-rigid-signed-separation-reference/**; root/lock/packages/oldexamples/Integration untouched. New model is UNMEASURED.

First consumer is THREE named archived firstfailed PRE-coupled frames: ALIGNED5,OFFSET3,YAW4. Use actual1308/1264 raw/provenance beforepositions, notcandidatecurrentcache orregeneratedworld. Original contact rows stayexact6/6/7 inoriginalorder; addALL omittedpostoverlap pairs fromactual1308diagnosis, includingbelow2mm: ALIGNED b4/b5 andb6/b7; OFFSETb1/b2 andb6/b7; YAWb1/b2. New8/8/8rows remainunderoriginal8cap. Retrospective selection usesnamedfailurearchive; itisnotlivecontactpredictionorclosure. Ifactualrowset/hash/profiledoesnotmatch, REFUSE, nevertruncate/correctit.

Original1263 position solver and exactFractionreference stayimmutable andstillrejectnegative depth. Newownedcopies adaptdepthM→boundM/negativeboundsvalidationonly. Do not modifyoldkernel/world/positivecontrols. No candidate,reference/control/oracle/build/trial before rootactualfullsource/input/error/referencefreeze+measuredcommit;rootalone executes. No physicalgate/row/cap/tolerance changesafterfirsttrial.

## Private linear API and strict admission

New SignedPositionReferenceError(code,message), private solveSignedPositionReference(problem), validateSignedProblem(problem), validateSignedResult(problem,result). Result matchesold1263shape: {ok,status,activeMask?,active?,lambdaKgM?,translations?,primalMarginsM?,objectiveKgM2?,certificate?,gram,singularMasks,infeasibleMasks,enumeratedMasks,worldStepped:false}. SOLVEDfieldsareallpresentfinite; INFEASIBLEcontainsnoneoftheoptionalnumericresultfields, notnull-tozero. PuremathINFEASIBLEisrecorded, notexecutionexception. PhysicalcaseinfeasibleisfirstNO-GO.

Problem EXACTordinaryplainrecord keys bodies,rows; denseordinaryArraywithdataindices/noextrakeys/noholes. bodies1..9 records EXACT{id,inverseMass}; IDsnonemptyunique, inverseMass0or[1e-6,1e6]. Rows0..8 EXACT{aId,bId,normal,boundM}; distinctknownendpoints, normaldensefinite3/Math.hypotnormwithinoriginalEPS1e-12, finiteboundM in[-10,+10]m. Signedboundsinclude−0 and0 unchanged. No default/Number(null)/clamp. Redundantrowsallowedforliteralalgebraguards; actualselectedpairsuniquebyrowbuilder. Allinputsreadonly/copied, unknownaccessorexceptionsretainidentity.

EXACTerrorprecedence: missing/nonplain/malformedbody+rows/wrongfields/dense=>INVALID_INPUT / signed position reference input is invalid; length>9or>8=>PROFILE_LIMIT / signed position reference admits at most nine bodies and eight rows; emptybodies=>INVALID_INPUT / signed position reference requires at least one body; invalidID=>INVALID_INPUT / signed position reference body IDs must be nonempty and unique; invalidmass=>INVALID_INPUT / signed position reference inverse mass is invalid; invalidendpoint=>INVALID_INPUT / signed position reference row endpoints are invalid; normal=>INVALID_INPUT / signed position reference normal must be finite and unit length; bound=>INVALID_INPUT / signed position reference bound must be finite and between minus ten and ten metres. Finiteinvalidresult/certificate/staticzero/correctionnorm=>NUMERIC_LIMIT / signed position reference result is invalid. No unexpectedthrowmapping.

Kernel input wrapper validatesstrictschema BEFOREminimalcopiedoldkernel. Kernelthresholds LIMIT8,EPS1e-12,PIVOT1e-14,objectivetie1e-24 unchanged. Internalnewkernel onlyreplacesbody/rowvalidatorentry and everyRHS/margin depthMread withboundM. Original solveSystem/Gram/incidence/maskloop/pivotorder/reduction/order/objective/certificate/best-masktie logic unchanged; preserve anautomaticallycheckedsource-difference ledger BEFORE firstbuild. Newwrapper/result checksoutsidekernelcannotchangekernelarithmetic. Signedrow n·(u_b-u_a)>=boundM; negativeboundisavailablegap. Translationmetres, lambdaKgMkg*m (notforce/impulse), objective/complementaritykg*m². Max256masks, no extra rows/closure/passes/iterations/warmstarts/repair. Originalfiniteintermediate/tolerance semanticsretained; resultwrapperrefusesunsafeoutput.

## Fresh signed SAT API

Private inspectSignedBoxSAT(a:Body,b:Body) obtainscurrentrawposeaxis fresh. Both boxesalreadyadmittedoriginalparse/immutable1308rawrestore. NewwrapperstrictID/kind/shape/mass/p/q/v/omega/rawunit/bodybounds validationreusesoriginalhelpersoutsidequery; no callerq normalization. Invalidsupportedbody=>originalstructuralerrorifparserisused; otherwise PhysicsError INVALID_CONFIG / signed position reference requires admitted raw boxes. No non-box fallback.

QuerytakesaNEWownedcopyoforiginalsat-feature.ts arithmetic with explicitlyenumerated differences: remove overlap<-1e-12 earlyreturn only; preserveALL15axisorder and freshboxbasis/support/reduction; retainlength<1e-12 skip ORIGINAL; winnerfirstSTRICTmin unchanged; replacehit.penetrationclamp withsigned boundM=bestOverlap (noMath.max). Preserveoriginalpoint/supportthreshold1e-12/normalorientation signedDistance<0→flip (zero→positive), featurelabels/indices/radiusprojectionops anddiagnostic ties1e-12 (reportonly). Freshbasisandrawqno normalization. Newqueryneverusesoldpreviousnormalorindependentreferenceaxis.

Result exactkeys {normal,boundM,pointM,feature,label,candidateIndex,rawAxisLength,candidates,ambiguity}. Eachcandidate retainsoldfeature/axislength/skipped/null-overlapfields and addsfreshnormalizedaxis,orientednormal,radiusAM,radiusBM,signedDistanceM,overlapM. Skippedfieldsarenullexplicitly,notnumericallyzero. Actualwinnerfieldsfinite; noaxisresolved=>PhysicsError NUMERIC_LIMIT / signed position reference requires a fresh supported pre-SAT axis. Ambiguitykeeps exactminimumindices,withindiagnostic1e-12indices,skippedindices,tolerance,uniquePhysicalFeatureClaimed:false. No uniqueaxisclaimforties.

For originalnon-nullrows USE archivednormal/depthbits asnormal/bound, afterfreshoriginalinspectPairandpositivequerysamearithmeticexactmatch. For addedomittedpairsUSEfreshsignedquerychosenaxis/normal/signedmargin fromPREposes, notfailedpostaxis/oraclevalue. Requirefreshboundsstrictlynegative, actualdetectnull, supportedquery; raw/normalizedindependentchosen-axisagreement1e-12 andDecimal80/1201e-25, allties/report retained. Do notrequiremathematicallyuniquephysicalaxis: sameaxisindependentreferencevalidateswinner/skip/order; difference beyondfixedcomparisonisfirstNO-GO/unresolvedref asclassified,neverstalefallback.

## Rowbuilder and detached copy API

Private buildSignedArchivedProblem(m,archivedRow,preparedFrames) usesONLY authenticatedarchive/prebodies. Originalrows firstsameorder, appendedomissions lexicographicpairorder fromfixedlistsabove. BodyIDs/inversemasssame9canonicalorder. RowSelectionsrecordoriginal-versus-added tags/pairIDs,originalrowindexoraddedindex,freshPREselection,positiveoriginalinspectPair, archivefailureselectionsource. Beforeproblemcreation verifycurrentrowjoinmatchesfreshdetectorandactual1308classification, priorselectedpairproof, full36paircount. No Worldcreatedorstepped.

Private applySignedTranslationsOnce(preBodies,problem,result) returnsdeepcopiedhypotheticalbodies/rounding. RequireSOLVEDfinitecertificate/9translationsmatchingIDs, staticu EXACT0 andstaticbodybitsunchanged, per-bodycorrectionnorm<=10m (existingguard), originalcoordinate/bodybounds. SumoriginalprePosition+u ONCEFloat64; holdq/v/omega/shape/material/inertia/cursor/restexact. Preservebeforeinputbytes. Recordnominalu,roundedfinalposition,actualfinal-preDelta,residualdelta; never overwriteuncertainq/v withdefaults.

Hypotheticalpost is one detached translation application, notacceptedWorldstep. Original1308failedpost is onlyretrospectiverowselectionevidence; itdoesnotbecomenewhypotheticaloutput. ObserveALL36pairsPREandnewhypotheticalPOST independently. Actualcandidate normal axis/proxy/solverdata cannotseed independent expectedanswers.

## Frozen first-flow gates

Source/distinctrepeat/genuinecompiled source graph exactliveobjects/refusals/certs/rawFloat64LEagreement; old/privateSATqueryandnewkernelownedsource, ORIGINALconsumedPhysicshelperpathsallsourceorallactualdistwithnofakecopy. No runtimeWorld/projector/correctioncall. Actualsource/hash closureandemittedledgerprepublished, neverrewrittenatconsumerstart. CurrentwholePhysics/CADgraphpinnedfresh; historicalCADindexpinimmutable.

FirstactualaffectedCAD/Physicsbuild+strictnewtypes+ONEthree-sceneconsumer afterallsource/errors/inputs/referencecontrolscommitted+frozen; actualemittedledgerpublishedBEFOREconsumer. Order ALIGNED5,OFFSET3,YAW4; latergraphsrepeatonlyfirstfailureprefix. Max9actualFractionproblemsacrossgraphs;648PRE+hypotheticalpairchecks ifall3scenespass inall3graphs;72rowcorrespondences. CounterfactualgeometryqualityGOrequiresEVERY independentrawANDnormalizedpairpostdepth<=1e-12m. Thisexplicitnewtargetwasselectedbeforecodeandisunmeasured. No old2mmWorldlimitwidening or1263historical1e-9geometrytargetsubstitution.

Olddetector-versusraw,raw-versusnormalized,selectedaxis/margin/depth/ties agreement1e-12m andprecision80/1201e-25m. SolvertranslationcomponentvsindependentexactFraction<=1e-12m,objective<=1e-12kg*m²; actualprimal/stationarity/negative-lambda/complementarity<=1e-12 statedunits, independentrationalcertificatesEXACT0separate. CandidateFloat64residualisnotexactFractionzero. UniqueoptimizeragreementseparatefromtiesofactiveMask; recordallfeasiblebesttiesbutoldkernel'sfirstobjective<best-1e-24selectionunchanged. No tuning ifmask/oracle/roundedpostgatesfail. Allnumericvalidity/densebounds/staticcopyerrorrecordsretained.

## Literal controls and errors before first build

Old1263positive/nonnegative linear-controls.json retainedunchanged; oldsolver/reference negativeboundstillrejected (explicitolddepthM=-1guard). Newsourceownedlinear-controls.json adds:
1 twoequal1kgdynamic bodies,nootherforcing,normal[1,0,0],bound−1 =>u0/lambda0/mask0.
2 bodiesa,b,c equal inverseMass1: rowa/b +1m androwb/c −.1m same+X. Addedgaprowbecomesactiveundercontactforcing; independentFractionverifiesexactoptimum/cert, no guessedphysicalvelocity.
3 redundanttwoidenticalsignedrows−1, compatible; singularexcludedmasksrecorded; duplicatedpositive1 rownonnegativebehaviorunchanged.
4 static/staticnormal+Xbound−1 feasibleu0, bound+1 INFEASIBLE.
5 oppositesamepairnormals+X/-X bounds+1/+1 INFEASIBLE.
6 touchbound0/−0 preserveinputsignandfiniteu0.
7 nine-rowlimit, ten-bodylimit, null/NaN/Infinity/boolean/sparse/extra-key arrays/records/endpoints/mass/normal/bound±10boundaryandoutside10.0001/unsafeoutput/cert/statictranslation/10mcorrection-limit/reflectioncontrols.
Thesearepurelinearguards,notadditionalarchivedWorldcases. Freezeexactexpectedtypederror/code/order/schema ANDeveryliteralbeforeanycontrol/oracleevaluation. No parameter sweep. Explicitquerycontrols useexistingoriginalboxrawliteralsselectedbeforefreeze: separated/touch/overlap, signedDistancezeroorientation, qsign,parallel/skipped-axis/tie/non-box/nonfinite. Syntheticquery/observer/certificateguarddata excludedfromactualarchivedallpairGO.

## Independent references and ownership

Independent signed-linear-reference.py minimalcopyoforiginal1263linear-reference.py changesvalidation/RHSdepthM→boundM only; exactFractionalgorithm/order/cert unchanged, automaticminimaldiffcheckedprefreeze. Newstrictreferenceinputguard maywrapoldindependentcoreandlabelsdefectiveprotocolseparately. IndependentSAT/geometrysame-axiswrapperreuse qualified1308coverage-reference.py/oldindependentobserver mechanisms unchanged, sourcecopiedscopeonlyfornewquery/evaluations. Decodeoriginalrawbytes ratherthanJSONsignedzero; outputdoesnotbecomeoracleinput.

Onlynewownedprefix: rootCONTRACT/adoption/source-difference/completefreeze/nativeevidence/results; kernelworker signed-input.mjs,signed-linear-core.mjs,signed-linear-solver.mjs,signed-sat.ts,entry.ts,apply.mjs,row-builder.mjs; harnessworker archive.mjs,controls.mjs,linear-controls.json,bundle.mjs,runner.mjs,freeze.mjs,tsconfig.json,input-freeze.json,README.md; independentworker signed-linear-reference.py,reference.py,reference-controls.mjs. Fileownershipassigneddisjointlywhenhelperavailable, rootmayimplementsource-onlykernel inparallelwith1349. No workerexecutionbeforewholefreeze. No modifications to any oldsolver/reference/artifacts/publicAPI.

Referenceprotocolresolve precision/scalar/algebra andcopiesBEFOREphysicalNO-GOclassification. Corruptarchive/reference/null/unresolved/unknownexception/harnessfailures EXECUTION_FAILURE, notgeometryNO-GO. ValidphysicalINFEASIBLE/refusal orpostqualityfailure retainedandstop. No secondrowchoice/axis/cap/closure/solver/tolerance/input retry. GOONLYretrospectiveDetachedSignedRowsGO; liveRowClosureGO/fullWorldGO/publicPositionSolverGO/general36rowSolverGO/angular/friction/forcecalibration/stable10s/Viewer/cost/releasefalse/unmeasured. Existing1179/660 and oldphysicalNO-GOremain.

## Root static clarifications before full source freeze

Retain original candidate/Fraction kernel without an extra mask sweep or all-best-mask bookkeeping. Compare unique optimum/translations/objective/certificates independently of active-set representation; record native/reference activeMask and uniqueActiveSetClaimed:false. OriginalFloatobjective tie1e-24 versus exactFraction first-exact-best remain separate. Thissupersedes the earlier all-feasible-best-ties reporting phrase; no trialhasrun.

Archivebody936Braw streams do NOT preservehistoricalrow coefficientzero signs; rowmetadataexistsasJSON. Keep the EXACTrehydrated originalrowvalues (includingJSON+0) innewproblem. Freshqueryoriginalcontactrow normal/depth correspondence usesnumeric===, likeunchangedoldjoinRows; recordnegativezero flags andObject.is discrepancies separately. Do notclaimhistoricalrow signbits. Addedfreshsignedrows retainactualquerynormalbits/flags. Source/compiledliveproblem/zeroflags/bodyrawparity remainmandatory.

A non-nulltouchrow mayhaveclamped originaldepth0 whilefreshsignedminimumisnegativewithinoriginalseparationepsilon. Compare Math.max(0,fresh.boundM)===archiveddepth fororiginalrows, and preserveoriginaldepth asnewboundM. Do notclampaddednegative rows. Thisisfaithfuloriginalhit correspondence, notnewlawor changedgate.

Private strict types mayuseallowJs:true/checkJs:false forMJSinterop, no typed-MJS verificationclaim. Rootentryexportsprivatequery, originalinspectPair/parseBody/PhysicsError, ownedlinearAPI and onehypotheticalapply; originalimportsresolveonlyinside measuredsource/compiledbundles.

## Accepted bounded static validator and static-copy review

Resultguard recomputesGram BEFORE both SOLVED/INFEASIBLEstatusreturns; validatesstrictsortedunique singular masks andexclusioncounts, inactive lambda EXACT0 andactiveprimalmargins<=originalEPS. Selectedmaskmustnotbesingular. Thisdoesnotreplaysolveormasks; originalkernelunchanged. INFEASIBLEmathematicalproofremainsindependentFraction, notstructuralcounterchecks alone.

Static zero-correction retainscopiedposition EXACT ratherthanaddingzero; dynamicpositionssumPRE+uONCE unchanged. Recordnominalu/actualdelta andstaticbitpreservation. Addone explicit syntheticstatic-signedzero copyguard, excludedfromarchivedphysicalcasecount. No failedrow/input/poseisclampedorrepaired. Source-onlyaudit reportavailablefromC, no newnumericalexecution.

## Final selected fresh-query witness and original ID admission

Source/source-repeat/genuinecompiledwinnerindex/row/sourcebitparity EXACT. Independentlycomputeallraw/normalizedaxes BEFOREcandidatecomparison. Candidatechosenaxismustbeunskippedandwithin1e-12 ofindependenteligibleminimum; SAMEAXISradius/projection/normal/signedmargin1e-12 andDecimal80/1201e-25. Preserveindependentscalarwinner/alltiesandproducerwinner/alltiesSEPARATE; no cross-runtimeexactwinnergate oruniquephysicalaxisclaim. Validateproducer15-axisorder/freshwitnesses/STRICTfirstminimum initsown diagnostics. No preferredface, normalizedq substitution, stalefallback ortie repair.

PrivatequeryID usesunchangedoriginallimits.ID; onepureinvalid-IDqueryguardbeforefreeze. ScalarlinearIDsretaintheacceptednonemptyunique1263profile; no unannouncedIDregexextension there. All11harness+3reference+rootmodel files source-onlyready; no newqueries/models/solvers/oracles/controls/build/types executed. Three agents preparedindependentsubtasks;Creadonlycoreaudit fixesrecordedbeforefullsourcefreeze.

## First guard failure and numeric-literal comparison repair

Firstactualbuild/types0at8a9ec82c; firstconsumerexit1 in source/purecontrols original-nonnegative-static-support, physicalSignedProblems0. Originalunchangedkernelcorrectlyreturnsstatictranslation [0,-0,0], whereasJSONauthoredmathematicalexpectedtranslationis[0,+0,0]. Theharnessincorrectly useddeepStrictEqual againstJSONliterals. Originalstderr856B SHA99e58b81e7424bb7e11db80c0c49022294406f62e66bcbfb3c978502358b4784, logs/receipt/freeze/emitted/graph/failureJSON retained. No archivedactualscene orfreshqueryflow started.

ONLY expectedtranslationcomparison uses alreadydeclaredabsolute1e-12m numericgate, whichnaturallytreats±0asmathzero. No candidate outputnormalization ornewtolerance; actualsource/repeat/compiledlivebit/raw/zeroflagparity remainsEXACT. Originalkernel/independentreferences/literalinputs/physicalgeometrygatesunchanged. Freshactualsourcefreeze+commit/emittedmetadata beforeguardcontinuation; initialattemptnotfirstpass. No redundantbuild/types foronlyharnesscomparison+comments, retainactual8a9build/typesources.

## Second guard failure and exact pair-wire repair

At44262cc2 secondconsumerexit1/sourceguards/queryreferenceprotocol, physicalSignedProblems0/completedReports0. Exactstderr715B SHA61384276b05062625c1a4151c1dc8f8590bd226cce5e4efc3a0a18a659230e1b, logs/receipt/source/emitted/graph/failuregz retained. Source-onlycause: originalimportedrawState ALWAYSallocates936Bforninebodyframes; four two-bodycallers sent936B/1872hex insteaddeclared208B/416hex. No diagnosticoracle/modelreplay needed tofindthe fixedallocation mismatch.

ONLYfour senderexpressions incontrols+runner nowtake.subarray(0,208) beforehex. Originalencoder/reference/raw13schema/math/literals/query/solver/gates unchanged; FULLninebodyPRE+hyp936Bstreams unchanged. No paddingisaccepted byreference andno rawcomponentnormalizedorregenerated. Fresh671pinfreeze/commit/actualemittedmetadata BEFOREcontinuation; sameinitialpublicbuild/types8a9 retained becauseonlyruntimeharnesswire changed. Initialtwo guardfailures are NOT physicalNO-GO, andactualarchivedscene hasnotstarted.
