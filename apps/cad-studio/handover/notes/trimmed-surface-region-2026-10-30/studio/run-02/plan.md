# D341 source-only proposal: material-preserving trimmed Extract region

## Status and order

SOURCE PLAN ONLY. No candidate, test, build, browser or heavy operation ran for this plan. No repository file was changed. Inspected fixed checkout `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, `local/cad-dev`, observed HEAD `5a8515aa0af0b74524670b75467b35cadececbfa` with concurrent D340 work. Root owns D340 integration and qualification. Start D341 implementation only after root has accepted the concrete D340 handoff and fixed its actual base. This proposal does not change D340 acceptance or publication status.

The live roadmap file still describes D340 as a source-only plan. That row is stale relative to the current implementation/review work, but it remains authoritative about order: remaining08 precedes09, delivered07 is not reopened, and Electron15 remains queued. Read-only current source, rather than that stale D340 status sentence, establishes this next consumer gap.

## Recommendation

Implement **Extract region that preserves one admitted original stored trim loop**, using the existing rectangular native region producer and D340 exact material machinery. Keep the current four U/V range controls and command. Return one object per positive interior-connected material component of `original material INTERSECT requested rectangle`.

This is the smallest useful next08 slice because it closes one remaining D336 guard with already available native geometry and proofs. It is not a new solid verb, a second clipping engine, arbitrary curved trim support or an extension of D340 into a multi-loop/repeated-operation closure claim.

## Current source evidence and priority triage

| Candidate | Current evidence | Decision |
|---|---|---|
| Trimmed Extract region | `packages/barocss-cad-model/src/engine/direct.ts:185-187` still calls `wholeSurfaceOf` and creates one untrimmed object. README explicitly says region refuses trims. The existing UI already has u/v from/to and Extract region at `apps/cad-studio/src/ui/DirectPanel.tsx:179-184`. | Select this bounded consumer extension. |
| Move/rotate/scale existing direct surfaces | `direct.ts:320-349` already transforms native geometry and retains object trim sidecars in the same UV chart. | Do not rebuild an existing transform/copy feature. A reproduced defect would need a separate exact contract. |
| Whole Thicken/Sew | D338/D339 have existing owned snapshot facades and qualified bounded flows in roadmap08. | Do not repeat their completed profiles. Trim solids/sewing require new topology/volume obligations. |
| Trimmed Extend | `direct.ts:282-302` currently samples, extends tangent rows and refits a bicubic support. That changes parameterization and geometry, so copying old UV masks would not establish material binding. | Defer until an explicit chart/transport/error proof exists. |
| General offset, face delete/replace, curved sewing, broader curve/fill patterns | Roadmap08 retains these wider gaps; none is supplied by the new D340 material graph alone. | Keep in08, but do not expand D341 into one of these families. |
| Advanced sketch / Electron desktop | Roadmap09 follows08; Electron is queued under15. | Do not start in this slice. |

Relevant existing native producer:

- `cad/src/nurbs/surfaces/surface-region.ts:199` exports `extractSurfaceRegion`. It snapshots and validates input/options, uses the original numerical chart, and admits existing native degrees/grids/IDs.
- `:235-259` requires ordered requested intervals inside the closed original domain, preserves original endpoint bits when equal, validates all helper IDs, and checks the existing observation grid before native staging. Do not sort/clamp ranges or invent a public tolerance.
- `:263-287` invokes unchanged native `splitSurfaceAtParameter` at most four times and retains the requested side after each actual split. This is already the correct restriction lineage; do not call the new trimmed Split repeatedly to implement a crop.
- `:288-305` adopts the final native coefficients/source/domain and retains the existing point/D1 observations. Full-domain copy has zero split operations. The original report explicitly remains local/not-certified; D341 adds its own bounded material proof beside it.
- D340 internal `trimmed-surface-split-binding.ts:75-110` already certifies an actual bilinear child against an arbitrary subrectangle of an original exact affine frame. It is not mathematically limited to one cut, so it can certify the actual final region support after all native operations.
- D340 `arrangementRegionsExact` admits <=165 submitted segments, disables the approximate bbox and uses exact signed area/nesting. A crop needs only original trim + requested rectangle: <=164 segments. Its existing input limit need not increase.

## Frozen proposed input and output contract

Input remains the existing `SurfaceRegionOptions` (`surfaceId`, `uInterval`, `vInterval`, `resultIdPrefix`) plus one owned trim loop. Native parent admission/refusal precedence and native return/source/report remain unchanged. Trim admission matches D340: original degree1x1, 2x2 poles, equal positive weights, exact affine rank two; one own finite simple3..160-point stored loop, inside/outside; all original UV points in the closed **original** domain; positive original material area. Ordinary fractional binary64 chart values and nonunit domains are mandatory. Do not require the final native child to be exactly affine, or generated intersections to be exactly representable.

Suggested producer name: `extractTrimmedSurfaceRegion`. Suggested result extends `ExtractedSurfaceRegionResult` with:

```
components: { surfaceId: string; componentIndex: number; trimLoops: OwnedSurfaceAxisTrimLoop[] }[]
trimRegion: { input profile; requested/effective domain; originalMaterialAreaUV;
  croppedMaterialAreaUV; usedSupportProof; rounding/native observations;
  actual work and fixed limits; bounded quality fields }
```

All components reference `parent.surface.id` and the same unchanged parent source. Canonical exact outer-ring order assigns componentIndex. Each component stores an inside CCW outer and outside CW holes. Existing TrimLoop[] AND semantics therefore encode its material. Each object gets separately owned loops and UV arrays. A rectangular whole retained component must still keep an explicit outer mask; it must not bypass the existing trim guards.

**Empty crop policy, fixed by root steering:** atomically refuse with typed DOMAIN and a short no-positive-material reason. A crop with no material must preserve the original object, visibility, selection, sources and Undo state. Do not hide the original while producing no result. The helper may have obtained an owned native support during staging, but that source is never published. This differs from D340, where an empty side is ordinary because the other side still preserves the original positive material. An already wholly empty original retains D340's explicit admission refusal. A successful D341 result therefore always has at least one positive-area component and a used-support proof.

Model routes nonempty trims through the new producer; undefined/empty trims retain the exact old native route. Missing/ambiguous object IDs, malformed sidecars and all producer failures preserve the accepted document, selection, old source and Undo state. Map one new typed diagnostic family into existing DIRECT_VALUE. Do not leak the Split-specific error class as a Region public result. Reuse internal math with an exact code-preserving wrapper or a small neutral private admission/proof leaf, while preserving all existing D340 messages, counts and limits. Do not alter D337 merely to share validation.

## Exact material algorithm and finite bounds

1. Call the existing native region producer once. Build the exact original affine frame from its owned original snapshot and the requested crop rectangle from its **effective** native domain.
2. Admit/copy the original trim in the original chart. It is ordinary for some or all trim vertices to lie outside the crop. Do not reuse D340's child-domain admission test on these original points.
3. Call `arrangementRegionsExact([{polygon:0,ring:cropRectangle},{polygon:1,ring:originalTrim}], [], 2)`. Select faces with `w0 != 0` and either `w1 != 0` for inside or `w1 == 0` for outside. Original-domain rectangle and four full-domain cuts are unnecessary. Do not raise the exact leaf's165-segment cap to accommodate such an implementation.
4. Retain every selected positive-area interior component, with exact holes and exact canonical order. Strict simple ring/topological representability checks remain. Exact pinches that cannot be represented by ordinary component loops refuse atomically. No area/sliver epsilon drops material.
5. Compute `croppedMaterialAreaUV` from selected exact outers and holes. It is not generally equal to original material area. Refuse zero cropped material atomically; require `0 < cropped <= original` for success. Full-domain requests additionally require exact equality. Independent rectangle oracle below is the acceptance authority for the cropped area and moments. Do not copy D340's total-area equality blindly into Region.
6. Round each new exact vertex once with the existing nearest-ties-to-even authority. Preserve equal original endpoints and requested rectangle boundaries; share one mapping per exact vertex globally. Check finite/effective-domain membership, distinctness, each ring's simplicity/orientation, and all inter-ring incidence/containment relationships against the exact graph. A generated near-boundary point may not be clamped to force success.

Derived request bounds for n<=160:

- Submitted segments S=n+4<=164; complete pair tests<=164*163/2=13366. The existing shared exact165/13530 guard remains unchanged and D341 applies its tighter counts.
- A straight trim edge intersects the boundary of a convex rectangle in at most two isolated points unless coincident. Thus proper/new crossings<=2n. Input trim vertices and four rectangle corners give `V<=3n+4<=484` for the **whole** arrangement, including unselected outside faces.
- Contact/coincidence proof: for each straight trim segment, intersect its geometry with the rectangle boundary. For a noncoincident segment the result has at most two points. For a coincident segment the result can include one closed interval, whose two endpoints supply all necessary split locations. Count these intersection/overlap-endpoint incidences per trim segment; total C<=2n. New interior split points on trim segments are a subset of these incidences, so I<=C. New noncorner split vertices on rectangle edges are also a subset, so J<=C. An original trim vertex touching a rectangle edge is counted in C but adds only a rectangle split. A rectangle corner on a trim segment is counted in C but adds only a trim split. Thus trim subedges<=n+I, rectangle subedges<=4+J, and merging coincident subedges can only reduce the total. Therefore `E<=n+4+I+J<=5n+4<=804`. This argument handles corner contacts, endpoint contacts and collinear overlap without assuming general position.
- All bounded-face boundary occurrences<=2E<=1608. At least three vertices per strict positive-area outer gives components<=floor(1608/3)=536. Individual simple ring<=484 is conservative. These are derived source bounds, not measured maxima.
- The existing private topology helper hard-codes326 at `trimmed-surface-split-topology.ts:38-52`. Do not silently keep that D340 value for Region or globally relabel D340 limits. Allow a small private request profile/explicit ring bound, while D340 still checks its exact326/651/1302/434 contract before material processing. No public tuning option is added.
- Allocate one fixed request arrangement context, one material arithmetic context and one binding/rounding context (or another fixed named set agreed before implementation). Preserve200000 operation/GCD and8192-bit caps. No context per vertex, ring, component or native split. Report raw topology work separately. Pathological exact arithmetic can refuse through these unchanged ceilings; ordinary public160 fixtures below must pass.

High implementation review must recheck the contact/coincident-edge derivation before freezing the new bounds. If that proof needs a larger structural bound, revise the derivation before implementation; do not truncate graph output or increase arithmetic/tolerance limits.

## Native final-support and rounding proof

For a used final support, reuse the D340 proof against the **original** exact affine authority and final effective domain:

- Positive actual native weights; exact projected corners form a strictly convex positive quadrilateral; all nine degree2x2 projected Jacobian Bernstein coefficients are strictly positive. This rules out positive UV material on a collapsed/folded used support.
- Whole final-child coefficient residual `H-W*A`, degree elevated to2x2, gives `Bchild = max coefficient L1 residual / min positive weight`. This checks accumulated native rounding across up to four splits against the original authority. Summing four local parent observation tolerances is not a whole-region certificate.
- For each exact/stored UV vertex, require one joint `Bchild + |du|*Lu + |dv|*Lv <= old1e-7` and UV displacement<=old1e-7. Do not spend1e-7 for each stage/axis/component. Keep local native evaluator checks supplementary and separate.
- Empty material refuses before used-support regularity/binding or Model publication. Never publish an untrimmed object or a source-only hide action for that staged support.
- No claim of global binary64 evaluator accuracy, arbitrary curved embedding, B-rep topology, solid mass or repeated-operation closure follows. Preserve all native region128 and native split128 ceilings and D337160.

## Independent Node-only oracle and acceptance fixtures

Extend the existing **test-only** normalized BigInt slab oracle, without importing product predicates, clipping, arrangements or SectionRationalContext. Keep the oracle's algorithm independent from Kernel half-edges.

For rectangular crops, the D340 slab levels need one real addition: include exact sweep-coordinate levels where every nonparallel trim edge crosses the crop's two **perpendicular** boundary lines, as well as all original vertex levels and crop selected-axis endpoints. Without these switch levels, `max(left,cropMin)` or `min(right,cropMax)` can change formula within a slab and yield incorrect polynomial integrals.

At a slab midpoint, form inside/complement intervals from all original edges, intersect each interval with the crop's perpendicular range, and choose its line/constant endpoints. The added switch levels make that choice fixed through the slab. Integrate width, t*width and (right^2-left^2)/2 exactly. Join adjacent intervals only through positive exact overlap at a common level. No point-only bridging. Return exact component areas and first moments/centroids; compare output stored polygons separately at the original1e-7 practical fixture tolerances. Do not infer a universal area tolerance from the point bound.

Mandatory source: the existing public closed degree1 eight-span U-curve used by D340, passed through actual `trimByCurve` to obtain its actual stored160 UV loop. Same support `S(u,v)=[20+5u,-11+5v,3]`, U[-2,6], V[1,7]. Do not substitute the ideal eight points for the public loop oracle input.

| Crop (ideal world guide; UV uses represented binary64 bounds) | Expected ideal material guide | Purpose |
|---|---|---|
| U[-1.6,5], V[1.4,3.7], world x12..45,y-4..7.5 | Inside1 component A150. Outside2 components: isolated pocket A20 centered[25,6.25,3], other A209.5; total229.5. | Four actual native splits; outside pocket survives; no artificial bridge. |
| U[-.8,2.8], V[3.7,5], world x16..34,y7.5..14 | Inside2 components A32.5 each, centroids[18.5,10.75,3] and[31.5,10.75,3]. Outside1 A52 centered[25,10.75,3]. | Multiple positive components from one requested support; correct AND masks. |
| U[-1.6,5], V[1.4,6.2], world x12..45,y-4..20 | Entire U removal inside crop: inside A240; outside1 component with one hole, A552. | Hole encoding and strict nesting, all four boundaries interior. |
| U[.4,1.6], V[3.8,4.6], world x22..28,y8..12 | Oracle inside0 components -> atomic DOMAIN/DIRECT_VALUE refusal; outside one explicit rectangular component A24. | Empty crop preserves original/selection/sources; no phantom support; whole retained material still masked. |
| Original full domain | Inside A240; outside A960 with one hole; native operationCount0. | Native full-copy authority and exact original-material equality. |

All values in this table are **ideal decimal guides**, not captured actual160 oracle results. Exact represented cuts and native producer values remain authoritative. Compute the other centroids with the independent oracle, not by copying production outputs.

Additional focused controls: CW/CCW canonical equality; each crop boundary through a vertex, along a segment, at an original-domain endpoint; crop wholly inside/outside loop; original loop lying wholly outside crop (inside refuses, outside retains whole crop); small positive retained sliver; generated intersections rounding to a shared stored vertex (atomic TOPOLOGY refusal); distinct component contact/nesting change refusal; ordinary nonexact-affine final native child accepted under coefficient proof; translated tiny used collapsed final support refusal; empty crop refuses before publication even if its staged support is collapsed; input ownership/accessors/multiple-loop/self-cross/backtrack/duplicate; invalid/reversed/out-of-domain ranges; missing/ambiguous IDs; owned output arrays and old untrimmed-route behavior.

Use this concrete maximum-input comb fixture; growth beyond326 is feasible, not speculative:

- Original chart U[-3,3], V[-1,158], original world map [20+5u,-11+5v,3]. It is exactly affine, degree1x1/equal weights and within the old XYZ bounds.
- Make zigzag vertices `p_i=[i%2===0 ? -1 : 2, i]` for i=0..156 (157 vertices). Close from p156 with `[-2,156],[-2,78],[-2,0]`, then p0 implicitly. This yields exactly160 distinct vertices; the middle left-spine vertex is forward collinear. The monotone-y zigzag and left spine give a simple polygon.
- Crop U[0,1], V[-.5,157]. All four boundaries are strict original-domain interiors. The156 zigzag segments each cross both crop U boundaries at different exact heights:312 new crossings. No other edge crosses the crop and no corner/vertex coincides.
- Therefore expected whole-arrangement V=160+4+312=476 and E=164+2*312=788. These are exact combinatorial predictions pending execution and remain below484/804. This explicitly proves why copying D340's whole-arrangement326/651 guards would reject an ordinary valid input.
- Inside has78 separate clipped teeth; each has UV area1 and centroid [4/9,2k+1] for k=0..77. World area per tooth is25, total1950. The corresponding outside crop has79 positive bands. Verify these predictions with the independent rectangle slab oracle before using them as product assertions; do not source them from Kernel arrangement.

Record actual arrangement/binding/material counts. This is a bounded capacity check, not a performance campaign. Keep old D340 focused tests only if the small shared internal profile/admission code actually changes; reuse unaffected native and product receipts.

## Actual Studio and native file gate

Use current Trim + REGION controls. From the public160 original, apply the first crop for inside and outside; select each material component and compare independent stored-world polygon area/centroid, not only a display mesh or count. Preserve original hidden source/sidecar and an unrelated witness solid/names. Demonstrate Undo restoring exact original trims and Redo restoring all components as one action.

Save/New/fresh Open retains object order/IDs/name/source/geometry/keep/UV and shared support references. Reselect a result, rename or make an existing mask-preserving source move, save/reopen again. Exercise the empty inside crop: short refusal, no accepted change to original visibility/selection/source or Undo; no untrimmed support appears. A refused invalid/rounding-collapse/unsupported profile likewise preserves the accepted state, followed by a valid retry. Existing Thicken/Sew/IGES/unsupported intersection guards still refuse new nonempty trims.

No new UI panel, async preview, schema, dependency, WASM, B-rep engine or precision knob. No kernel/helper or decoded-file result substitutes for this actual flow.

## Ownership and stop boundary

- High Kernel owner: new trimmed region adapter, narrow shared internal admission/profile/proof changes if needed, root API exports/types, exact bounds/certificates and focused tests. No modification to native insertion/region/split geometry, tolerances, D337 contract or ordinary Number Boolean behavior.
- Medium Model owner: existing `surfaceRegion` routing, atomic component publication/ownership and registered Node22 tests; optional existing README update only after API contract freezes. No Python spawn in default test registration.
- Root: exact base/API inventory, serial heavy gate and integration, actual Studio/file oracle receipts, current roadmap/evidence publication. Independent High review checks the new bounds and rectangle oracle switch levels before product qualification.

If ordinary public160 four-boundary crops cannot fit the old rational ceilings, report the first exact failing context and seek a bounded arithmetic reuse/caching improvement. Do not reset contexts, reduce input160, add a hidden tiny-area threshold or raise tolerances. If final region support certification fails for an ordinary input, preserve the failure and revise only the new consumer proof; do not claim native parent bug from its explicitly not-certified contract.

This completes one additional08 consumer profile only. Curved/multi-loop trims, trim-preserving Extend/SSI/IGES, trim solids/sewing, broader fill patterns, advanced sketch09 and Electron15 remain outside D341.
