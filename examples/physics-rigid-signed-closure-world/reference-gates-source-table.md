# #1384 independent reference gates

SOURCE-ONLY. No implementation/calculation/module/oracle/solver/World/control/build/type run. Only this ledger was written. Read actual #1264 world/island/consumer/fixtures/phase/input contracts and point-contact source. Actual adoption1a4278a8 matches current #1344 Python blobs: reference c783f0b319ab897763d57c8162e1e3d40cb859d0, Fraction767fc817663a83c98e6840945ca44b0f126e28f3. Parent retrospective GO and old World NO-GO stay distinct.

## Protocol to freeze

Choice request: `{op:'choice',scene,stepIndex,choiceIndex,config,preBodies,preRawHex,problem,rowSelections,hypBodies,hypRawHex,result,previousChoiceRows}`. Each selection has rowSourceKind initial|added,pair IDs, compact `{normal,boundM,candidateIndex,pointM,rawAxisLength,label,feature}`. Raw13=104B/body; main9=936B, pair=208B. Strict finite/dense/ID/JSON-byte agreement; no fixed936B pair wire. Null hypothesis only when unreached, never numeric zero.

Independently derive PRE geometry; verify initial sorted original/clamped rows, added negative PRE gap, unchanged prior coefficients and ONE lex-first unprotected append. Actual problem is checked against these inputs then passed to unchanged adopted Fraction oracle. Candidate solution/axis does not define expected geometry or optimum. Check one rounded PRE+u hypothesis, held q/v/omega/static bits, all36 pairs and protected-failure-before-append rule. No future archives/oracle-selected rows/cumulative apply.

Reply `{ok,resolved,executionFailure,status,metrics,reference,violations}`. Reference `{exactLinear,prePairs,hypPairs,rowChecks,growthCheck}`; compact pair depth/margin in raw+normalized modes, chosen-axis and diagnostic skip/tie indices. Metrics: translationDifferenceM,objectiveDifferenceKgM2,primalViolationM,negativeMultiplierKgM,complementarityKgM2,stationarityKgM,maxPreAxisDifferenceM,maxHypDepthRawM,maxHypDepthNormalizedM,precisionMaxDifferenceM; booleans roundedFinalMatches,heldBitsMatch,growthMatches. Unreached fields null+stageReached=false. Valid INFEASIBLE is resolved physical NO-GO; malformed/null/unresolved protocol is EXECUTION_FAILURE.

Step request `{op:'step-ledger',scene,stepIndex,outcome,ledger,raw}`. Root's exact ledger keys: beforeBodies,freeBodies,velocityBodies,finalBodies,fixedStepSeconds,gravityMps2,actions,points. Raw has matching before/free/velocity/final frames. Actions are Array<[id,parsedAction]>. Points contain IDs/indices,pairKey,pointId,family,pointM,normal,aPositionM,bPositionM,warm{normalNs,tangentNs},final{normalNs,tangentNs}. Guard bodies1..9; physical main9. finalBodies is attempted staging; never substitute prior accepted bodies on refusal. If phases are missing, archive partial attempt, do not fabricate complete-ledger input.

Ledger reply same protocol; reference P,Lorb,Lspin,Ltotal,K,U for four phases, external budgets and artifacts. Metrics separately name free/velocity/step LinearMomentumResidualKgMps and AngularMomentumResidualKgM2ps,positionAngularArtifactKgM2ps,positionVelocityBitsHeld,pointLedgerMatches,precisionDifferencesByUnit. Root must freeze exact messages/schema before code.

## Accounting without hidden conservation assumptions

Fixed O=[0,0,0]. P=Σdynamic m v; L=Σ[(p-O)×m v+Iworld(q)omega]. Decode parsed binary inertia; named cubes local diagonal1/24. Label raw/normalized tensor conventions; do not treat inverse-inertia operator or positional lambda as calibrated physical inertia/force. Floor has no invented dynamic mass.

Jg=m g dt; Jcmd=impulseNs+forceN dt; tauCmd=angularImpulseNms+torqueNm dt. Independently verify angular update at BEFORE q, angular advance BEFORE linear commands, and actual free v/omega. Free orbital budget uses BEFORE p×(Jg+Jcmd), plus actual integration displacement×m vFREE. Orientation-only transport at held BEFORE omega and command transport from independently predicted deltaOmega are separate; defining all unexplained actual deltaL as artifact would be tautological.

Point netJ=normal*FINALnormalNs+FINALtangentNs, NOT final-minus-warm: warm+all deltas telescopes to final, with roundoff recorded. Actual endpoint signs -J to A,+J to B. Internal point torques cancel; external floor torque uses actual pointM×signed dynamic J, never the mean public contact point. Warm+64 sweeps are the whole velocity phase; new position rows do not get velocity work.

Closure holds v/omega/P bits. Position artifact=Σ(actual final-pPRE)×m vPRE. Full-step budget includes external terms, independently constrained orientation/integration artifacts and this positional term. No isolated global L conservation gate.

K=.5Σ(m|v|²+omega·Iworld omega), U=-Σm g·(p-O). Record phase deltaK/deltaU, gravity geometric workΣm g·deltaPosition, aggregate contact deltaK including warm/normal/friction. No microhistory: separate friction/normal work unmeasured. K finite/nonnegative; U may be signed. No energy conservation/reaction/force-calibration claim.

## SI gates

| Check | Fixed gate |
| --- | --- |
| Fraction u/objective; rational certificate |1e-12m /1e-12kg m²; exact cert0 separately |
| Float64 KKT |1e-12 in named m,kg m,kg m² |
| PRE axis/margin/raw-normalized depth |1e-12m; ties diagnostic |
| Closure all36 POST raw AND normalized |depth<=1e-12m |
| New Decimal80/120 |1e-25 per stated unit |
| Phase/full-step P,L residual vector norms |1e-7kg m/s,1e-7kg m²/s |
| Old World pair/floor/halfspace |2mm, finite footprint/no escape |
| Old normalized observer / q norm |old precision1e-12; q1e-9; producer q1e-12 retained |
| At/after960 exact8s baseline |vertical drift5mm,horizontal from initial1cm,v.02m/s,omega.02rad/s,tilt1degree |
| Producer limits |u and full accepted→working movement10m; original body bounds |

Old observer TOUCH_M1e-10/normalized q stays unchanged; new closure gates are separate. Time=stepIndex*(1/120), not stepIndex/120. Missing8s baseline unresolved. Raw zero signs authoritative; historic JSON row signs are not raw proof.

## Bounded proof and literals

Stream gzip JSONL/raw, retain current step/choice only. Store metadata once; full copied PRE/hyp/final frames+offsets/hashes, every reached problem/result/Fraction optimum+cert, compact selections and point ledgers. All-axis80/120 recomputation is transient; no15-axis-per-pair archive. Separate36initial detects,36per-choice scans,PRE queries,masks,applications; old velocity pairStats36 stays separate. Max9 choices/8rows/256masks;9scene-graphs×1200steps bound. Target proof<300MB; freeze storage-budget EXECUTION_FAILURE before disk exhaustion, preserve reached prefix, never drop receipts to claim GO.

Data-only ledger literals: zero source; nonzero P/L+gravity; force+impulse; torque+angularImpulse; internal same-point ±J; off-centre floor torque; warm2/final3 proves net3; tangent/mixed J; positional shift parallel/perpendicular v; signed-zero/static/qsign; orientation-only transport; null/bool/nonfinite/ID/index/pairKey/raw-length failures; mean-point/wrong-sign/final-minus-warm/artifact/phase spoof; copied-output mutation. These are guards, not extra Worlds.

Closure guards:0/8/initial9 rows, one append, cap before next solve, protected failure, infeasible/static, immutable PRE/no cumulative apply, unknown Error/object/null, observer copy/throw and late combined movement refusal after nonzero accepted cursor/cache/counters. Commands are per-step input, NOT queue: different kinds merge, duplicate same kind rejects, unsupported target rejects, next empty call does not replay prior/failed commands.

ALIGNED→OFFSET→YAW; first physical refusal/quality failure fixes identical source/repeat/compiled prefix. Failed attempt stays separate; prior accepted bodies/cache/contacts/events/global/warm/closure stats/ledger/cursor retained atomically. Only all3×1200steps qualifies named liveSignedClosureWorldBaseGO; public engine/Viewer/cost/release and old scopes remain separate.
