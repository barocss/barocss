# D346 checkpoint: one certified nonstraight quadratic CUT path

Status: SOURCE_ONLY DESIGN, no product edit/build/test/browser/benchmark. Root has published D345 at024475e5e62457bb66c7b49c6f26138d0c1a3b88 and preserved intentional oldcurve refusal plus15straight behavioral cases under /tmp/d346-root. Reuse those receipts rather than duplicate a product baseline. Tiny standalone Node22 mathematical oracle WAS_RUN: /tmp/d346-plan/oracle.mjs→oracle-final.json, no CAD imports/heavy work.

## Contract recommendation

Keep the existing command, RawNurbsPath/FeatureSpec/Modelnode/schema and64copies/±10000coordinate/offset/positivespacing constraints. Preserve the valid legacydegree1 and exactmidpoint degree2 straight branch, chord endpoint handling, errors and represented Numberarithmetic bit-for-bit. Do not remove the midpoint certificate and continue chord interpolation.

New profile: exactly ONE clamped polynomial quadratic span,3finitepoles, weights[1,1,1], knots[a,a,a,b,b,b] with finitea<b. Geometry is the stored normalized Bernstein polynomial, independent of the affine parameter domain; do not silently treat a nonunit domain as nativeu0..1. Recommend a bakedworldXY curve with ALLpoles at the SAMEfiniteZ (not necessarilyZ0, because a pureconstant-Z translation changes no relativeplacement). No transformedobject wrapper, frame/trim metadata, rationalweights/arcs, closed source, multispan curved spline or tangenttoolrotation. ExistingstraightXYZ paths remain unchanged. Admitting nonconstant-Z quadratics would be mathematically similar but is explicitly outside this smallest profile.

Require the controltriangle's exactbinary64 XYorientation nonzero. Then derivativevectors are not parallel and the linear derivative nevervanishes on[0,1]; speedpositive and arc-length inverseunique. Zeroendpointderivatives/repeatedpoles/collinear-cusp/backtracking curvedprofiles refuse. Existingexactmidpoint straight curves still go through the oldbranch, including alloldparameterizations. No epsilonarea threshold or new minimumcurvature/speed.

Count1 stillvalidates raw/source/profile/currentoriginalCUT; it neednotforce full-total1e-7precision or an inverse. There are no additionalplacements but malformed/closed/unsupported sources cannot bypass admission. Negativespacing remains refused by Corepositive dim/APIpositive spec/Modelchecks; do not add reversedarc-length traversal. Targetdistance forcopyk is the exactvalue of the existing represented Number(k*spacing), not a new exactk*spacing convention. Firstoffset[0,0,0], allotheroffsetsrelative toACTUALP0, fixedorientation andstable@k names remain.

Translation invariance is conditional on representedgeometry: if a bakedtranslation preserves exactP1-P0/P2-P0 differences then offsets are identical; otherwise solve the slightlydifferent actualstored polynomial and remain within its positionalbound. Do not promise bitinvariance after arbitraryroundedworldtranslations or override changed source coordinates.

## Why simple chord/subdivision or the current diagnostic is insufficient

cad-curve-arc-length.ts43–55 explicitly reports aggregate estimator, not certifiedupperbound/globalbinary64 certificate. Its Gaussdifference alone is not admission proof. Quadratic chord/controlpolygon bounds converge only asO(N^-2): demanding1e-7for an ordinary20mmcurve can exceed the existing512subdivision envelope. A fixedsample polyline is not the curve and not this proposal.

Use a SINGLEQUADRATIC-specific rigorous speed integral enclosure, not a new generalarc-length engine.

## Mathematical enclosure and inversion

Normalize t∈[0,1]. Let v=2(P1-P0), d=2(P2-2P1+P0), A=d·d, B=v·d, C=v·v, Δ=AC-B²>0. Speed f(t)=sqrt(A*t²+2B*t+C). All polynomialcoefficients, orientation, minimumlocation clamp(-B/A) and squaredspeed extrema are exactrepresented-coordinate arithmetic. A positive lowerboundm for minspeed must be certified, not inferred from a rounded nearzero number.

For q=A*t+B:

- f''=Δ/f³.
- f''''=3Δ(4q²-Δ)/f⁷.
- Δ≤A*f² and q²≤A*f² imply |f''''|≤15*A²/m³ on the panel.

A3node Simpson panel[a,b] therefore has |trueIntegral-S|≤(b-a)^5*M4/2880. Add directed/root-evaluation and arithmeticenclosures; the estimate/remainder interval, not the difference of tworules, is authority. Adaptively bisect panels under the existing arcdiagnostic envelope:512subdivisions,16integrationdepth,16384speed-evaluation calls; retain original64placement limit. Use the explicit one-planner-query200000checked-step/8192bit allocation in scalar-work.md. It adopts existingceilingvalues but is notan assertion that theoldlinefeature or a wholeStudioaction already hadthisscope. These are ceilings, not resetperpanel/copy. Illconditioning may exhaust a bound and atomically refuse; no hiddenminspeed/expandedtolerance/piecewisechord fallback.

Construct a reusable orderedprefix atlas with summedlower/upperlength bounds. It is request-aware: coarsedirectedchord/controlpolygon bounds mayalreadyprove targetfit, and unusedtails neednot be refinedto1e-7. See scalar-work.md. Targetfit must be certified d≤totalLower; if d>totalUpper refusePARAMETER as tooLong. If inside the residual endpointuncertainty, refine or refuse explicitly when the same request budget is exhausted. Never compare d with a roundedmidpoint estimate or clamp a slightlytooLongtarget to the endpoint. Straightendpoint exact oldbehavior remains.

For eachtarget perform bracketed inversequeries using the atlas and onepartialpanel enclosure. Atmidpointm, ifd<Llower(m), moveupperparameter; ifd>Lupper(m), movelower. If d lies INSIDEthe certifiedprefixinterval, then |s(m)-d|≤max(d-Llower,Lupper-d). Since curveworlddistance is no larger than arclength, this directly bounds the worldpoint error WITHOUT dividing by a smallspeed. A parameterbracket can instead stop when its exactderivativeL1hull*parameterwidth is smallenough. Neither criterion needs arbitrarydense sampling. Sharednode/work ceilings bound allinversequeries; no percopybudget reset.

Evaluate relativeBezieroffset EXACTLY as2t(1-t)(P1-P0)+t²(P2-P0), then round outputcoordinates once with certifiedL1roundingresidual. Require arc-residualupper+offsetroundingL1upper≤existinglinearTolerance1e-7. Aim at quarter of that tolerance internally to leave ample output/conversion margin; this partitions the same budget, not a new geometrytolerance. No authoredpoles/knots/nativegeometry are rewritten. Compute actualboundingoffset policy before anybodycopy/Boolean.

### Scalar arithmetic implementation boundary — concrete choice

The chosen checked dyadic integer-sqrt enclosure and whole-feature counter contract are in scalar-work.md. No assumedMath.sqrt/log, no absolute80bit productfloor, no percopyreset. It distinguishes integrationdepth16 from inverseiterations and adopts existingceiling VALUES as an explicit newcurved requestscope, not a claim that thelegacyline already used thosecounters. Count1/earlytarget calls mayretain broadtotal-lengthbounds; request-awareprefixrefinement avoids needlessfulltail work. The implementationmustaudit the statedoperation costs and whole64target behavior before anyruntimeclaim. This is a concrete design awaiting root/reviewerfinaldecision, not productcode.

## Shared Model geometry authority and API boundary — one explicit decision

Sourcefacts: KernelcurveCutOffsets is NOT exported from package root/api; @barocss/cad packageexports permit onlyroot,api,internal/native-si-mass (package.json5–6). Model cannot legitimately import @barocss/cad/features/curve-cut-pattern. ModelcurvePatternPathLength(value):number is an existing exportedModelhelper and Modelproblem duplicates everychordplacement at100–118. Keeping this duplicate fornewcurves would produce a different geometryauthority.

Recommend ONE new read-onlyquery export from @barocss/cad/api, e.g. `planCurveFeaturePatternPath(raw, spacing, count)` with plainowned result `{ offsets, length: { lower, upper, estimate } }`. Rootapprovedname is planCurveFeaturePatternPath; no path/node/specschema field is added. Corecase and existingcurveCutOffsets adapter consume the SAMEinternalplanner. Modelnewcurved admission/currentlive source/eligibility/problem call the SAMEquery; no duplicatedSimpson/length/inverse. Kernelowns admission/refusal reasons within existingINPUT/CAPABILITY/PARAMETER (no newBUDGETpubliccode) and numericalprofile, Modelmaps them through its currentVALUE/friendlyboundary. rootmustaccount for this deliberateAPIexport in inventory; no packageexports/dependency change or privatepath bypass.

The query also supports legacydiagnostictrue-lengthbounds via exactsegment norms, enlarged toinclude theunchangedlegacyNumberestimate; its oldoffset/endpointleaf is unchanged andCorelegacyfastpath pays no newcost. No zero-widthtrue-lengthclaim from roundedhypot. ModelcurvePatternPathLength keeps itsNumberreturn and unchangedlegacybranch; newcurved return is only documented `length.estimate` (midpoint of certifiedenclosure). Modelplacement/tooLong checks MUST use sharedintervalplanner and offsets, not thatNumber. Existingraw/live sourceownership, documentvalidation, suppressed/nested/pendingparts/currentobject/name binding stay. Sharedpublicquery owns a plainnumericdescriptor snapshot (unknownfields/sparse/accessor/nonfinite refusal) so callers cannot mutate a path after qualification. Currentrawspec pathaliases need tracing duringimplementation; do not claim alreadyownedrawcallback data from currentcurveFeaturePatternSpec, which returns o.path unchanged.

Eligibilitycurrentlycalls pathlength. A curvedcertificate has higherCPUcost than a chord; do not introduce unboundeddrag/sourceMap caching to hide it. First measure actualscoped cost if needed, then reuse an immutablecurrentdoc/source proof with boundedretention. No performance claim or cachearchitecture is chosen here.

## Executed independent bounded oracle

oracle.mjs uses NOproductimports, exactBigInt fixedpoint speed-sqrt bounds at2^-80,40bitdyadicparametergrid and rigorousuniformSimpsonM4 bounds. 128panels give certifiedtotalintervals andinverse residuals. No nativegeometry/source execution occurred. Analytic sqrt/asinh evaluation is a separate Numbercrosscheck, not its certificate.

1. Authorable P0(0,0),P1(20,0),P2(20,20): exactminsquaredspeed800, m≥28, M4≤7000. True total in[32.46450479343963,32.464504811548714]. Closedformtotal=20+10sqrt2*asinh1; halfpositionB(.5)=(15,5), not chordmidpoint(10,10). Distance10offset≈[9.804642846917092,1.6361454649667142], certifiedtruepointdistance≤4.634e-9; distance20≈[17.287138970530407,7.980960868337377], bound≤6.626e-9.534speedcalls/128panels/64inverseiterationsTOTALfor2targets. Finaloraclealsoadds exactrational→displayedbinary64L1rounding error; initialarc-only version ispreserved asoracle-v1.mjs/oracle-v1.json.
2. Genuinelyasymmetric P2(24,18),sameP0/P1: m≥29,M4≤3400; total[32.95184910225117,32.95184911104702]. At10≈[9.863370390345974,1.3846589155193532],error≤1.541e-9; at20≈[18.30421261214178,6.547013804851535],error≤3.258e-9.531speedcalls.
3. LiveP1edit(20,5),P2(20,20): m≥26,M4≤3500; total[30.809778558485117,30.809778567539656]. At10≈[9.363978407378582,3.4406030049848866],error≤1.768e-9; at20≈[16.95102866855327,9.81108693115009],error≤5.379e-9.537speedcalls.

Exactdyadiccandidateparameters/offsetnumerators and fullbounds/work are in oracle-final.json. These are ballcenters WITHresidualradius, not asserted exacttargets. Actualproductionposition plus oraclebound must satisfy old1e-7. A Decimal80analyticintegral/inverse is a useful independentadditionalcrosscheck; it is not automatically an intervalcertificate unless its arithmetic/logrounding is bounded. Root/Medium can compare it against thesecertifiedenclosures.

For stock60x40x10 and seedCUT[7,10]x[6,11]x[0,10], three disjoint3x5x10CUTs giveV23550. Firstmoments use actualrelative offsets above and seedcenter[8.5,8.5,5]. Initialcurved center≈[30.238268905621354,20.15848976857768,5]; liveP1edit≈[30.243216515439922,20.13533955454691,5]. Oraclecentroid uncertainty from the two curvepositions is<7.2e-11. Fullcorners/fixedorientation/name@1/@2/materialwitnesses remain necessary; V alone cannot prove curvedplacement. Root already confirms fractionaldiagonal-line nativeCUT vertices are unquantized under currentconsumer.

## Acceptance and ownership proposal

HighKernel: curve-cut-pattern.ts + oneprivate quadraticcertificate module/scalarhelper ifneeded; api/spec.ts/APIindex for the SINGLEexplicitsharedquery; tests/newindependentoracle. Keep oldstraight calculation body/order as a frozenleaf and root's15case baseline differential. No generalCurveD1/arclengthdiagnostic/Boolean/Partengine rewrite.

MediumModel: engine/curveFeaturePattern.ts sharednewprofile route, commandhint/emptychoice text and editfields onlywhereactuallyneeded, newtests forraw/live/nested/ownership/sourcechange/atomicrefusal. ExistingcurvePatternPathLength Numbertype stays; sharedplan is actualendpoint/placementauthority. MediumStudio: existingline→Makecurves→Directmiddlepoleedit actualflow. Rootowns API/fullgates/docs/publication and soleheavy scheduling.

Registeredtests: (a) old15behavior cases exactsame includingtranslated/nonuniformstraight/endpoints/errors; (b) actualnoncollinear polynomial positions vs independentcertifiedballs, total/bounds/remainders/rounding; (c) main/asymmetric/liveedit/nonunitknots/representedP0translation; (d) count1 stillsourcevalidation, tooLongaboveupper, ambiguousendpointrefusal/retry, negativespacing/zero/copieslimit; (e) exactcusp/zeroderivative/closed/rational/multicurved/frame/metadata/accessor/sparse fields; (f) atmostrequest-local caps, retainedfirstfailure and no partialdoc/nativepublication; (g) sharedAPI→Core→Model equaloffsets/livecurrentowner/hiddenrename/Move/Stretch/deleteguard/nestedfile/Undo sourceIDs; no independentModelchord fallback.

ActualoneChrome/serialcontexts: author a singleworldXYlineP0→P2 in existingSketch, Makecurves creates3polemidpointquadratic, selectDirectControlpoint1 and editX20/Y0. SelectoriginalCUT, chooseactualpath in Pathcutpattern, spacing10/count3, previewCancel/retryApply. Verifyindependentoffsetballs/allcutcorners/fixedorientation/nativeclosedsolid/V/C/stable@1/@2/witness420/selectionclear. Editspacing; liveeditP1to(20,5); wholepathtranslatepreservingrelativegeometry; explicittooLongrefusalwithdoc/selection/historyunchanged andvalidretry. Undo/Redo, SavefreshOpen, reselectedpath/editablefields/sourceIDs. Noauthorhooks/newcurveUI needed. Runtime/browser PENDING untilrootapproves numerical/APIcontract and implementationgates.

## Main risks and refusal boundaries

- Certifiedsqrt and actualwork accounting are the remaining implementationproof work; merely using Math.sqrt/Gaussdifference is insufficient.
- Nearcusp regularcurves may exceed existingdepth/workcaps. Explicitatomicconditioning/BUDGETrefusal is honest; no claim of allquadratics/count64 success.
- Endpointintervaluncertainty is differentfrom genuinelytooLong. Refine or refuse, never use roundedlengthestimate asadmission.
- CurrentModel/Kernelrawpath admission reads callerfields; an ownednewprofile snapshot is needed. Preserve validlegacybehavior, classify getterrejection as an explicitownershipboundary rather than silently claiming theoldhelperalreadydidit.
- A robustinverse position bound does not certify newBRep Boolean families or arbitrarytranscendentalerror/centralinertia/performance. Toolgeometry/order/names remain existingengines.

## Frozen source references and limits of this checkpoint

- features/curve-cut-pattern.ts:24–75 oldrawadmission/midpointleaf/chordlength/relativeoffset/endpoint behavior; no curvedauthority exists thereyet.
- api/spec.ts:238–242 existingpositive spacing/count/options and currentlyaliasedrawpath; part/part-model.ts:1946–1957 existingoriginalCUT reuse, fixedorientation, count1sourcevalidation and@k names.
- package.json:5–6 permittedroot/api/internalSI exports: nofeature wildcardimport is available toModel.
- nurbs/curves/cad-curve-arc-length.ts:22–61 diagnosticoptions/uncertifiedestimator/16384eval512subdivision16depth policy; these are notexistingPathcutworkcontracts.
- section-rational-internal.ts:4–24 privatecheckedwork200000/bit8192/GCD200000 and nearest/upwardconversionmethods: proposedcombinedbudget cannot resetcontextpercopy.
- cad-model/src/engine/curveFeaturePattern.ts:16–48 oldNumberlength;52–73 livebase-documentresolver/metadata/sourceownership;84–118 duplicatedchordlength/placement checks. Newcurvedbranch mustdelegateallnumericdecisions.
- cad-model/src/engine/direct.ts:54–58 importSource existingsourceproducer; hidden/renamed sourceIDs, strictcurrentreference and preflightguard behaviorremainexistingD334 contracts.
- test/curve-cut-pattern.test.mjs: oldnonunit/translatedstraight/nativeendpoint/ownership/limitcontrols. Root's15frozenexistingplacements are a differentialbaseline, not a curvedoracle.

Paths above are relative to thefixedworktree packages as named. Productsource/edit/build/test/browser areNOT_RUNhere. Onlystandaloneindependentmathoracle wasexecuted. No performancebenchmark or integer-only productrestriction isproposed. ExistingApp successfulApply selectionclear doesnotyetinclude curve-feature-pattern; witnessselectionclear in theplannedactualflow is an acceptanceCHECK, not an alreadydeliveredclaim or permission to preemptivelyeditApp.
