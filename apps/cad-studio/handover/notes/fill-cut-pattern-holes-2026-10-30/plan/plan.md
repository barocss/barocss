# D345 candidate: bounded straight holes in the existing fill CUT reference mask

## Status and recommendation

SOURCE_ONLY / implementation, runtime, tests, benchmark and browser NOT_RUN. All D344 source remains frozen during root's browserrun02. Re-pin after D344 is qualified/published before implementing. This is the next ordinary08 consumer extension, not a new general region/Boolean engine or new queue. Existing07 is delivered;09/Electron15 remain separately queued. No whole08 completion claim.

Recommend extending the current FillFeaturePatternRegion snapshot with optional numeric holes, using the existing native straight-loop qualifier, exact segment/orientation predicates and point-mask walk. Keep ONE outer, worldXY, originalCUT source, unconditional originalseed, finite authored grid, original@index suffixes and snapshot lifetime. The useful first profile shares the EXISTING16total boundary-vertex allowance across outer+holes. This is deliberately smaller than arbitrary many16point holes and does not silently multiply the old mask work.

## Frozen public/data contract recommendation

```ts
type FillFeaturePatternRegion = {
  readonly points: readonly (readonly [number, number])[];
  readonly holes?: readonly (readonly (readonly [number, number])[])[];
};
```

`points` remains the implicit-closed outer ring. Each present hole is implicit-closed numericXY, qualified by the same native3..16 simple-loop contract. All coordinates are finite binary64 within the existing±10000policy. However aggregate vertices, outer plus every hole, must be<=16. Therefore for outerN vertices the maximumholecount is floor((16-N)/3), at most4; a16vertexouter accepts no holes and the effective largest singlehole is13 with a3vertexouter. Do not advertise a16vertexhole plus an outer under this first aggregate profile. Two rectangularholes with a rectangularouter use12vertices and are useful; the main asymmetric oracle below uses11.

Absent holes preserves exact old snapshot shape `{points}`. Recommend accepting `holes:[]` but canonicalizing it to omission, so no-hole authored behavior/saved recipes remain byte-compatible. Nonempty holes preserve authored loop/vertex order and winding in the numeric snapshot; membership is winding-independent. Unknown outerkeys/symbolfields/accessors, sparse/extra-field arrays, unknown holefields, nonnumericDim values in rawAPI and out-of-range inputs refuse before geometry work. Bound holes.length by the derived4 before enumeration/descriptors and sum all bounded ring lengths before exact qualification. Snapshot every admitted own data descriptor once and never reread caller objects. Own all nested coordinates in API/Core/Model outputs; no originalsketch reference survives.

Everyhole must be strictly inside outer. Holes must be pairwise disjoint, non-touching and non-nested. Refuse outer/hole edgecrossings, vertex/edge contacts, positivecollinearoverlap, sharedvertices, coincident/duplicate holes, selfintersection/backtracking/zeroarea and islands. Concave outer/holes remain allowed if the existing simple-loop qualifier certifies them. Existing qualifier's stated conservative refusals remain its contract; do not weaken it or add approximate repairs.

Additional grid referencepoint placement is included when outer classification is insideORboundary AND everyhole classification is outside. Hole boundary is excluded. The original(0,0) CUT stays unconditional even if its referencepoint lies inside/on a hole or outside the outer. Counts1x1/noadditionalplacement return originalseed as before, BUT region/source activity stillvalidate; malformedholes cannot bypass validation on an empty candidate set. Tool bodies are not clipped, and neither outer nor hole tests require fulltool containment. An admitted cutter may cross a hole boundary. It is a referencepoint mask, not a material-trimming region.

Grid count/count2/product<=64, represented offsets[i*spacing,j*spacing2,0], exactrational anchor+representedoffset (no Number sum rounding), j-major/i-minor enumeration, @i,j suffixes and sourcecut reuse remain unchanged. Removing a placement cannot compact or rename later placements. Positive publicspacings/currentCore spacingpolicy are not expanded.

## Exact qualification without a new engine

1. Capture plain owned loop/anchor data. Reuse qualifyNativePlanarLoopV1 separately for each ring; no integer-only restriction and no nativequalifier constant change.
2. Reuse exactPoint2FromXY/exactOrient2 and existing exactfinite segment classifier for inter-ring nonintersection. Important: classifyExactSegmentCrossingV1 deliberately returns boundary-or-collinear when ANYorientation iszero; that is not by itself a finite-segment contact. Preserve exactAABB-separated disjoint pairs, and refine remainingzero cases with the existing on-segment coordinate-order/orientation logic already used by fill's boundary classifier. Do not reject arbitrary disjoint collinearextensions, and do not implement an arrangement/clipper just to answer this yes/no question. A module-private thin wrapper around these existing predicates is sufficient; no new publicmath API or D340topology refactor is needed.
3. With simple disjoint boundaries, one strictinside representative holevertex classifies containment against outer. Inter-hole representative queries in BOTHdirections reject nesting; checking onlycrossings misses an entire nestedhole. This follows from connected simple Jordan boundaries; no floatingarea/centroid/interiorprobe is needed.
4. Generalize existing point walk to a3way outside/boundary/inside result, retaining its exactorientation/coordinate comparisons. Old no-hole placement is the same insideORboundary condition. Query hole loops only until the firstinside/boundary exclusion. No EPS, samples, tolerance expansion, general Boolean or newSectionRational budget.

Structural work under N<=16 and H<=4:

- Native per-ring nonadjacentedges: sum n_k(n_k-3)/2; all inter-ringedge pairs: sum n_i*n_j. Their sum is N(N-3)/2<=104, the old single16loop pair bound. Adjacentturn checks totalN<=16.
- Representativepoint edge visits are H*nOuter+(H-1)*(N-nOuter)=(H-1)N+nOuter<=52. This is a finite extra qualification step; do not claim identical totalCPU cost. A4orientation finite-segment wrapper uses at most416crossing orientations plus16turns and52representative orientations; if a wrapper deliberately recomputes orientations after the existing coarse classifier, record that bounded extra work honestly.
- At most63nonseed candidates visit at mostN16edges across all loops:<=1008point-edge visits, unchanged from the old worstcase mask. No raise of64grid/16loop/copy/arrangement/arithmetic limits.

The aggregate16choice is a boundedfirstprofile. If a future requirement needs16outer+16hole vertices, authorize a separate explicit aggregate-work extension; do not quietly repurpose another feature's165/200000limits or64copies as a holecount budget.

## Actual source/UI producer and lifecycle

Existing Model SketchNode already has holes:LoopSegment[][] and regions:LoopSegment[][] on rectangle/polygon/loop nodes. The Studio sketcher builds hole-bearing nodes NOW: profileOf classifies closed shapes by containment, keeps the firstouter, emits other containedclosed shapes through loopOf as holes, and refuses depth>1. Rectangle/polygon shapes produce straightline starts; circles produce arcs and remain unsupported for this mask. No new SketchStart.holes facade exists in the inspected publicSketchData builder, and adding one is not required: public fill API consumes rawnumericmask, while Studio consumes existing Modelsketch producer.

Studio's shape classification uses sampled/tolerant sketch helpers. It is a producer, NOT this feature's admission authority. Revalidate exact stored rings at capture/reselect. A GUI-produced touchinghole may remain a legitimate sketch for other features but must refuse this strictholemask. Keep otherregions, arbitraryframes/nonzeroZ, `on`/association, suppressedsource and curves unsupported. Do not silently flatten/discard them.

Model fillRegionSnapshot currently rejects ANYholes. Replace that specific exclusion with bounded straight-hole capture: every hole LoopSegment must be line; capture resolvednumericline starts with the same finite/parameter resolution contract as outer. Outer rectangle/polygon/line-loop extraction stays. Resolve Modelnumber or simpleparameter references to OWNEDnumericdata; no param/live refs survive. Apply own-data descriptor safeguards to the new nestedhole reading path and, where convenient, the shared outer-loop capture helper. Do not call getters to inspect kind/start/coordinate/parameter fields. `outline`, construction and sideTags remain editmetadata and are not holegeometry authority.

Creation and editor reselect already call the same fillRegionSnapshot→sharedfillFeaturePatternSpec. Existingfeature regionchoice stays `Current region snapshot` plus eligiblecurrent sketches; X/Yspacing and existingbinding/edit fields stay. Updating the sourcehole sketch does not change an accepted fill snapshot until explicitreselect. SourceCUT remains live/active through existing difference bodyref; bodycopy remains separate. Command emptyhint must stop saying without holes; tooltip should explain hole boundary exclusion/referencepoint-only/originalseed as usefulusersemantics. No broadApp/DirectPanel redesign.

Nativefile stores optionalholes in existing latestdocument node; no schema/version bump/migration. Existing fillPatternDocumentProblem visits suppressed/nested/pendingparts; the updated sharedspec must admit/reject holes there too. API/chat/worker/copy/flatten/reopen must not bypass snapshot admission. No newtoolshape/command verb is necessary.

## Independent asymmetric oracle

Use stock[0,60]x[0,40]x[0,10], original rectangularCUT[7,10]x[6,11]x[0,10]. Toolvolume150; stockvolume24000, stockcenter[30,20,5]. Referenceanchor is AUTHORED[8,8], deliberately not the cuttercenter[8.5,8.5]. Grid4columnsx3rows, spacing12x10. This avoids calling an inferred toolcenter authority.

Outerrectangle points[[4,4],[52,4],[52,36],[4,36]]. HoleArectangle[[20,16],[34,16],[34,30],[20,30]]. HoleBtriangle[[42,6],[46,6],[44,10]]. N=4+4+3=11.

Referencepoints are integer[8+12i,8+10j]. Exclude(1,1),(1,2) ON HoleAleftboundary; exclude(2,1),(2,2) INSIDEHoleA; exclude(3,0) INSIDEHoleB. All otheroutergrid cells survive, with unconditionalseed included:

```
[(0,0),(1,0),(2,0),(0,1),(3,1),(0,2),(3,2)]
```

Seven disjointCUT prisms, V=24000-7*150=22950. SumcutcenterX=167.5 andY=119.5; remainingC=[9265/306,6161/306,5]. Exactinteger/rational point-in-polygon oracle imports noCAD code. Verify all expectedtoolcorners/materialwitnesses and originalgrid suffixes, not V alone. In particular @1,0/@2,0/@3,1/@0,2/@3,2 staytheirindices; masked @3,0 neverbecomes anothername.

Edit Yspacing10→12. HoleAthen excludes only(1,1),(2,1), HoleBstill excludes(3,0); row2referenceY32 isoutsideHoleA. NineCUTs, V22650,C=[9159/302,6007/302,5]. This is a nontrivialeditableholeinteraction with stable survivingnames. For a no-hole reselect all12CUTs return; V22200,C=[(720000-150*(12*8.5+12*18))/22200,(480000-150*(12*8.5+10*12))/22200,5]. Formula usesoriginalspacing10; explicitly choose currenteditingstate when computingreselect expectedvalues.

Separate boundarycontrols: a hole containing/on seedreference must STILLretain originalseed. A cutter whose reference lies outsideholes but whose bodycrosses a holeboundary stays admitted. A point one representable step on each side of a holeedge must classify by exactbinary64 withoutnewtolerance. Reversedouter/holewindings and authoredholeorder produce sameplacements/geometry/suffixes. Coordinate±10000/tinyfinite/subnormal adversaries retain existing nativeproof behavior; no integer-only productcontract.

## Tests and actual Studio proof plan

Kernel: extend current fill-cut-pattern tests with inlineholes, above independentcell/mass/C/corner/name oracle, deepownedfrozeninputs, bothwindings/order, outeredgeincluded/holeedgeexcluded, fractionalnearboundary, disjointextensionsegments, allinvalidtopologies/aggregate16boundary, count1/nomaskedextras/sourceactivity and nohole exactregression. Keep Core+/publicspec refusalcode mappings as existing INPUT/CAPABILITY/PARAMETER→publicVALUE contracts, no invented code. Add cap-independent nativeSave/read query references.

Model: extend existing API-fill test with actual profileOf outer+rect+triangle producer, parameterresolvedholepoints, UIcommandCtxrawmask and picker/reselect routes, sourceeditsnapshotindependence, explicitreselect effect, spacingbindings, nativefile/wire/flatten/nested/suppressedmalformedhole admission, accessorcallcount0/extraarrayfield/unknownkey failures and atomicdoc/selection/Undostate. Oldraw`holes:[]` rejection test must become canonicalemptyholes acceptance; other oldbadregions remain. Existing16pointnohole profile and ordinaryD335tests must stay.

Actual Studio: oneChrome/serialcontexts and sourcecapsules; use existing sketchtools to author a DEFAULTworldXY outerrectangle plus nestedstraightrectangle and triangle, then FinishSketch. Clear faceassociation/base selection first; a sketch authoredon the CUTcap has `on` and remains unsupported. Observe savedSketchNode.holes.length2 from readonly__studioDoc to prove realproducer, not justdrawn pixels. Select originalCUTbody, open Fillcutpattern, choose thatRegionsnapshot, anchor8/8, counts4x3, spacing12/10. Verify7cuts/V/C/names/nativegeometry and visibleexcludedzones. PreviewCancel leavessource/doc/selection/history unchanged; reopenApply, Undo/Redo, nativeSave/New/freshOpen and editablefields.

EditYspacingto12 viaexistingfeatureeditor, verify9cuts and independentoracle. Edit originalhole sketch (numericrectangleposition/size or polygonvertex tools), verify acceptedfill staysunchanged; explicitly reselect samechangedsketch, verify capturedsnapshot andplacements change with samefeatureid/stablesurvivingnames. Undo/Redo+SavefreshOpen repeat. Include malformed/touching/out-of-budget source refusal/retry and witnessbody preservation. Use actualcommand UI/worker acceptance; noauthorhooks. Browserflow is PENDING, not a sourcePASS.

## Scoped ownership after D344 publication

HighKernel owner: features/fill-cut-pattern.ts and focusedKerneltests; optionally a tiny internalhelper only if existingpredicate reuse cannotremainprivate. NoBRep/arrangementengine edits orlimits. MediumModel owner: engine/fillFeaturePattern.ts, commandhint/emptytext in app/commands.ts, API/Modeltests; editFields only if realwiringrequires it (currentlysharedreselectalreadyworks). Publictype follows optionalholes automatically; no gratuitous Part/backend/facade/newmethod rewrite. MediumStudio owner: existingcandidate tests/newboundedbrowserdriver; App/sketchproducer stays unchanged unless an actualconsumer defect is confirmed. Rootowns APIinventory/docs/roadmap/build/fullgate/publication. Explicitfileownership before implementation; preserveotherwriters.

## Evidence/source references

All paths below refer to the fixedworktree, source-only currentlines. No cited source was executed for this plan.

- packages/barocss-cad/src/features/fill-cut-pattern.ts:6–43 numericdescriptor snapshot/native3..16simpleloop;50–73 exactboundary/inclusion/referencepointsum/j-major originalsuffix enumeration.
- packages/barocss-cad/src/exact-proof/native-planar-loop-qualification-v1.ts:34–100 exactfinitebinary64 loops/selfcross/backtracking/winding and current16bound.
- packages/barocss-cad/src/exact-proof/exact-segment-crossing-v1.ts:20–35 four-exactorientation classifier and deliberateboundary grouping.
- packages/barocss-cad/src/brep/planar-arrangement.ts:37–43 existing exactpoint/orientation;254–258 existinginternalexports. Noarrangement execution is needed.
- packages/barocss-cad/src/nurbs/surfaces/trimmed-surface-split-topology.ts:8–28 existingexactcoordinate-order/on-segment/contact semantics as sourceprecedent, not a requirement to import the splitengine orchangeD340.
- packages/barocss-cad/src/api/spec.ts:104,230–235 publicoptions/sharedsnapshot/64candidate cells.
- packages/barocss-cad/src/part/part-model.ts:1929–1943 actualsnapshot→placements→originalcutsource→toolreuse; emptyplacements stillresolvecutsource.
- packages/barocss-cad-model/src/engine/doc.ts:263,274,294–299 existingline/arc holes and sketchtypes;332 existingfillnode ownsregiontype.
- packages/barocss-cad-model/src/engine/fillFeaturePattern.ts:9–45 worldXY/noholes exclusion/resolvedsnapshot;48–55 picker;57–88 allsaved/nestedsnapshot admission.
- packages/barocss-cad-model/src/app/commands.ts:795–808 actualFillfields/build/deepcopy;app/editFields.ts:568–574 sharedsnapshotreselect/currentchoice/spacingediting.
- packages/barocss-cad-model/src/sketch/loops.ts:19–32 shapeNode;116–124 line/arc loopOf;129–158 actualcontainedclosedshape→holesproducer/islandrefusal/sideTags.
- apps/cad-studio/src/sketch/useSketchActions.ts:117–149 actualFinish→profileOf→worldplane/sourceassociation/preservedids/commit route.
- apps/cad-studio/src/app/sketchControls.ts:1–20 toolinventory;switchTool closedshape retention. apps/cad-studio/src/ui/SketchPanel.tsx:89–94 exactrectangleX/Y/width/heightfields.
- packages/barocss-cad/src/api/sketch.ts:111–128 publicSketchData hasnoholesbuilderfield: do not invent an existingAPI that is absent.
- packages/barocss-cad/test/fill-cut-pattern.test.mjs and packages/barocss-cad-model/test/api-fill-feature-pattern.test.ts existingindependentD335fixture/admission/ownership/selector/file/reselect tests;apps/cad-studio/test/fill-pattern-candidate.test.ts and fill-cut-pattern-browser.mjs existingactualcandidate/UIworkflow toextend.
