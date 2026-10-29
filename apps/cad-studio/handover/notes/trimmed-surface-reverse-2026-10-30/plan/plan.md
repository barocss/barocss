# D337: functional roadmap08 comparison and recommended freeze

SOURCE PLAN ONLY, 2026-10-30 KST. Inspected source7ab1a23c9ed2aed24d8281430eff04591f118171, local/cad-dev, fixed worktree `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. Root D336 documentation WIP remains untouched. No build, test, browser, runtime reproduction, commit, push or product edit. Only `/tmp/d337-plan` planning artifacts were written. Independent Fraction arithmetic is PLANNING, not product evidence.

## Decision

Recommend A: one useful trim-preserving Reverse profile, immediately following D336. Qualify an affine planar support and one ordinary simple stored TrimLoop, including the public Trim-by-curve160-point producer, both axes, nonunit domains, and either keep flag. Reuse the existing native surface reversal and existing chart-rounding/numeric policy. Keep D336's other five consumer guards and unsupported-profile refusal.

This is a functional consumer extension, not another generic guard task. A reversed trimmed sheet remains trimmed and can be saved/reopened, instead of requiring intentional loss by Untrim. B is also a real gap, but it adds programmatic access to body operations already available in Studio. It ranks second for immediate visible modeling benefit.

| Candidate | Confirmed current capability | Actual gap | Rank / qualification |
|---|---|---|---|
| A trim-preserving Reverse | Native reverseSurfaceAxis already reverses coefficients and returns original/reversed parameter provenance; Model directOps/Studio already expose Reverse | D336 correctly refuses all nonempty trims; no transport of TrimLoop sidecars yet | 1. Useful bounded geometry profile; practical160-point public producer must remain admitted |
| B Part/API thicken/sew | Core CadPartFeature thicken/sew, Model nodes/conversion, editable thickness/tolerance and actual DirectInspector actions already exist | Shared Part/spec/KernelPart/StudioPart facade methods and command routing are absent | 2. Start with one thicken snapshot verb if selected; sewing is a later separate method |

Existing planar Offset face is not missing. Existing Direct thicken/sew UI is not missing. Affine/body-copy patterns and completed07 do not need rebuilding. Roadmap08 stays ahead of09. D333/D334/D335/D336 remain bounded delivered profiles, not whole08 completion.

## A: smallest practical contract

### API and ownership

Keep `directOps.reverseSurface(d,id,axis)` and the actual DirectPanel Reverse action. Untrimmed calls keep the current native path unchanged. For an admitted trimmed planar input, call existing `reverseSurfaceAxis` once and transport a copied trim sidecar before calling add(). Preserve the hidden original with its complete source/geometry/id/name/trim metadata. The new result has a fresh ordinary DirectObject ID/source and the existing name suffix (`u reversed` / `v reversed`) plus owned mapped trims. No alias to caller/source arrays; no mutation on failure. Preserve omission versus an empty trims array under the existing untrimmed contract.

A small Kernel helper composed with the existing reversal is preferable to a new arithmetic implementation in Model. Proposed purpose-specific public entry: `reverseTrimmedSurfaceAxis(surface, trimLoops, options)` -> existing reversal result plus owned `trimLoops` and a separate trim-transport report. Its internals reuse reverseSurfaceAxis, SectionRationalContext.nearest, existing exact planar predicates and chartRoundingBoundMM. This is a trim sidecar adapter, not a B-rep face/solid constructor. Do not enlarge the parent reversal's128-observation contract to disguise160 trim bindings; record trim bindings in a separate bounded report. Model calls this helper only for the admitted nonempty-trim profile. If root chooses a Model-only adapter instead, it must provide the same one-rounding/binding and topology contract; plain unchecked a+b-t is insufficient.

No new Part solid verb or shared Part facade is required for this surface-only operation. The existing public Kernel Surface API -> Model directOps API -> actual DirectPanel/commitDirect -> native document is the coherent consumer route. Do not invent a solid Part method to satisfy a layer checklist. There is no new saved node kind or document schema.

### Geometry profile

- Affine nondegenerate planar support: native degree1x1,2x2 control net, four equal positive represented weights. Reuse existing affine-plane admission/ExactAffinePlane logic. Keep original clamped finite positive U/V domains; nonzero and nonunit endpoints are supported. Do not infer that any coplanar bilinear net is affine. Native reversal's coordinate/identity/representability failures remain authoritative.
- One TrimLoop, `keep:'outside'|'inside'`,3..160 finite UV points with implicit closure, all within the original domain.160 is the current public producer's default sample count, not an invented polygon16 cap. The bound is an explicit first-profile qualification: no generic multiple-loop, curved-support or arbitrary-size saved-trim claim. Straight and curved original trimming curves are allowed insofar as their existing projected result is this stored simple polyline; the operation preserves that stored polyline, not the ideal original curve.
- Validate input plain/dense numeric fields and keep enum. Reject duplicate/repeated points, zero edges, nonadjacent crossing/touch/overlap, adjacent backtracking and zero area. Allow ordinary collinear forward samples: public160-point rectangular and concave outlines contain them. The current projectLoop uses floating crossesAny; add a shared bounded exact segment/simple-loop adapter using existing planar exact predicates where needed, without replacing the projector or building an arrangement engine. Do not reuse the3..16 native polygon qualifier directly: that would reject the public160 producer. Do not treat UV as world mm or impose coordinateAbs10000 on chart values; validate against actual finite domains and existing rational budgets.

### Reflection and original tolerances

Use r.provenance.parameterMaps for the selected axis: `q=a+(b-t)`; the other UV coordinate is copied unchanged. Compute the represented input's exact reflection with the existing rational context, then `nearest` once. Copy endpoint partners directly when t equals an endpoint. This follows `CadNumericPolicy.chartParameters = exact-or-one-rounding-certified-v1` and accepts ordinary fractional UV. DO NOT require exactFloat, a checksum, exact bitwise double reversal, integer/dyadic-only authored loops, or equality between rounded output and the exact rational reflection. All finite binary64 values are represented dyadics already; requiring the result to be exactly representable would reject common0.4->3.6 UV transport unnecessarily.

For affine support, derive the world displacement caused by this one chart rounding using existing chartRoundingBoundMM and/or exact affine rational lift. Keep the existing1e-7 mm native binding limit and1e-7 dimensionless UV binding meaning separate. Never increase either tolerance or silently snap/merge vertices. Refuse if a finite bound cannot be represented, exceeds the original binding tolerance, sends a point outside the domain, maps distinct points/edges to one point, or fails original/mapped world binding. The affine map makes line-segment displacement bounded by its endpoint displacement, so this profile avoids claiming global curved-surface fidelity from sparse samples.

After rounding, independently validate mapped loop simplicity, nonzero area and expected orientation reversal. Retain exactly one loop, its point count/order, and its keep flag. Winding reverses but keep does not flip: current material classification is orientation-independent parity. Compare nonselected coordinate bits unchanged. Require the rounding errors to remain within the existing bound and topology checks; do not merely compare area. A loop can have the same area at a wrong location.

Double U or double V reversal must preserve world material within the same original bound. It need not restore all UV/source bits: the native report explicitly declines double-reversal bit certification. Native file Save/Open of an accepted result, however, must retain the exact accepted stored UV arrays, IDs, flags and source bytes semantically. That is a file identity claim, distinct from mathematical involution.

### Remaining refusal boundaries

Curved/nonaffine support, multiple loops, malformed/oversized trim data, unmappable domains, rounding collapse, ambiguous/missing object refs and failed topology/binding refuse atomically with existing DIRECT_VALUE (pick failures keep DIRECT_PICK/native failure precedence). This is the selected admitted profile, not a claim that generic reversal is impossible.

D336 Split/Region/Extend/Intersection/visible IGES guards stay active for every nonempty trimmed result. Thicken/sew still refuse trimmed surfaces. A successful Reverse must not remove the metadata that enforces those boundaries. No trim clipping, trimmed IGES entity, dual-UV intersection material, solid mass, mesh optimization or global B-rep engine is added.

### Binding and editable state

Reverse axis is an enum, not a Dim. Keep flags, UV arrays and source IDs do not parameter-bind. Do not add fake scalar parameters. The existing direct edit is one Undo item, not an editable solid history feature. The user can apply the opposite axis, change poles/perform existing parameter-preserving refinements, Untrim intentionally, Undo/Redo, hide/show or Save/Open using the same direct object controls. Preserve source references and selection to the new object exactly as existing add() behavior; a failure leaves document, selection and Undo state unchanged.

## A: independent world-material oracle

The arithmetic artifact uses no CAD/projection/reversal helper. Support is the D336 nonunit-domain plane S(u,v)=[20+5u,-11+5v,3], u[-2,6],v[1,7], world[10,50]x[-6,24], area1200 and center[30,9,3].

Primary off-center rectangle hole: world[15,25]x[-1,9], UV[-1,1]x[2,4]. Keep outside area1100, area centroid[340/11,104/11,3]; keep inside area100, centroid[20,4,3]. U reflection4-u and V reflection8-v preserve the same world loop. This is the already working public160 producer geometry from D336, now used for positive functional proof.

Second asymmetric concave loop: world[[15,-1],[30,-1],[30,4],[22,4],[22,12],[15,12]]. Its authored hole area131 and center[5447/262,1121/262]; kept support area1069 and center[66553/2138,20479/2138,3]. Some UVs are0.4 and4.6; rounding examples in JSON show that valid reflection needs rounding but changes world positions only by ordinary tiny amounts. Do not require exact representability.

IMPORTANT: public Trim by curve samples160 equally spaced CURVE PARAMETERS. Six-segment corners do not all fall on those160 samples. The actual stored polyline intentionally approximates the design L. independent-oracle.json therefore separately computes the ideal160-point polyline from the authored six linear spans. Compare preserved material to the source's actual stored/lifted polyline, and keep the design131-area target as a separate projection-approximation fact. Never hide this difference by altering a tolerance or comparing only the ideal design.

For production binding, compare original and mapped lifted world trim vertices/segments under1e-7 plus the existing chart-rounding bound. Independently compute planar polygon area/centroid from their world coordinates (Green moments or exact Fraction on captured binary64) and classify world probes inside the hole/material away from boundaries. Check one interior removed point, one kept point and boundary positions after each axis and after Save/Open. Verify source and accepted loop point counts, flags and names, not only rendered pixels.

Existing trimmedMesh uses a64x64 domain grid with fixed triangle diagonals. A UV reversal can change sampled clipping/triangle layout even when the stored world material is preserved. Do not tighten sampled mesh area/centroid tolerance to1e-7 or claim exact mass from it. Record sampled mesh values separately; reuse the existing demonstrated bounded display comparison. D336's1100.081380233 sampled area is distinct from exact1100. Visual hole presence alone is not the geometry oracle.

Surface solid mass: NOT_APPLICABLE. Separate accepted witness box[80,-3,1]..[92,4,6] stays volume420, center[86,1/2,7/2], names n1.side0..3/n1.bottom/n1.top (or its actual stable feature prefix). This only proves the unrelated part stayed unchanged, not a solid made from the trimmed surface.

## A: minimal actual flow after affected tests

One browser, serial contexts, immutable source capsules. Use the public source import + Trim by curve, not an injected trim-only fixture for the main positive flow. Create the support, off-center rectangular curve and witness. Keep outside -> Reverse U -> actual lifted-loop/material oracle -> Undo/Redo -> Reverse V -> oracle -> Save/New/fresh Open -> exact accepted document/UV/identity and reselectable direct object. Keep inside and the concave160 polyline are focused second cases, with one short actual positive case if needed to close UI behavior.

From an accepted trimmed Reverse result, prove one D336 guard (e.g IGES no download) and thicken/sew refusal remain; reuse prior unchanged other-five receipts rather than repeating the full campaign. Exercise one unsupported profile/malformed-loop failure before allocation, then retry a valid reversal. Prove selection/Undo remain unchanged on failure. Native file preserves exact accepted stored arrays and hidden source; double reversal uses geometric tolerance rather than bit identity. All current investigation runtime is NOT_RUN.

## B: exact smallest alternative if root chooses the facade gap instead

Implement only whole-surface snapshot Thicken first. Proposed common API `Part.thickenSurface(surface: RawNurbsSurface, options:{thickness:Dim;side?:'normal'|'reverse'|'both'})`, creating a new body via existing #make, not acting on the selected solid. Proposed spec carries copied surface beside `values`; Kernel backend emits the existing CadPartFeature thicken. The same shared Part method is inherited by KernelPart and StudioPart. Add a Model command/helper route for the existing node; DirectInspector and API share admission/construction rather than duplicate behavior. Label the Model snapshot name explicitly (`Whole surface snapshot`, or the source's copied label). Bind thickness through the current editor fieldt; side is a nonbinding enum. Existing default40 grid/faceted representation and OFFSET_FOLDS refusal stay; no exact curved offset claim.

RawNurbsSurface contains exactly degreeU/degreeV,knotsU/knotsV,controlPoints,weights, owns copied arrays and has no direct object/source/reference lifetime. It means WHOLE untrimmed support by definition. Reject DirectObject wrappers, trims/objectId/extra fields instead of silently stripping them. When Studio or a context-aware API creates a snapshot from direct geometry, inspect DirectObject trims before geometryOf()/copy. A raw standalone Surface cannot reconstruct lost direct context; do not advertise it as accepting trimmed selections. Keep this distinction explicit in docs/types. No source edits update an accepted body snapshot automatically; native file stores the copied surface and thickness. Do not introduce live surface references in this API slice.

Current source already permits raw thicken and sew in CadPartFeature, Model doc and conversion. There is no dependency or schema need. Current Model editFields supports thickness and sew tolerance. Current shared API spec/Part methods have no thicken/sew case, while Studio apply assumes commandById exists, so adding a facade method without its command/helper route would be incomplete. Add build/check/binding and API exposure coverage, then use the existing actual DirectPanel flow + facade-generated native file to prove both consumers meet the same recipe/mass boundary.

B independent flat-plane oracle: the untrimmed40x30 plane atz3 thickened2 normal -> volume2400, center[30,9,4], boundsz3..5; reverse -> z1..3 centerz2; both -> z2..4 centerz3. Thickness3 normal -> volume3600 centerz4.5; edited parameter/native file retains source surface fields and stable feature prefix. Output is faceted by design; verify closed one-solid body and semantic file/name identity without calling it exact curved thicken. For later Sew, the natural-edge box surface fixture gives exact closed-body oracle and existing surface-index names, but do not add it to the same initial verb unnecessarily.

## Evidence references (relative to fixed worktree)

- apps/cad-studio/handover/roadmap.md:76-80 — delivered07, current08 and09 order; D336 guard scope and open functional support.
- packages/barocss-cad-model/src/engine/direct.ts:12-20,77-109,161-163 — DirectObject trim ownership, D336 guards, add/refine and current Reverse.
- packages/barocss-cad-model/src/engine/trim.ts:10-11,22-60,63-91,126-140 — stored polyline/keep, public160 producer, current checks and sampled clipping.
- packages/barocss-cad/src/nurbs/surfaces/surface-axis-reversal.ts:34-39,62-69,192-246,300-315 — original parameter map, native limits/domain/coefficient preservation, local tolerance and no double-reversal/global certificate.
- packages/barocss-cad/src/nurbs/curves/curve-reversal.ts:79-90 — guarded floating reflection in current parent; do not casually replace native internals.
- packages/barocss-cad/src/numeric-policy.ts:6-31,34-44 —1e-7 geometry/UV rules and exact-or-one-rounding/chartRoundingBoundMM.
- packages/barocss-cad/src/section-rational-internal.ts:12-24,50-71,111-145 — current bounded rational arithmetic, nearest rounding versus strict exactFloat.
- packages/barocss-cad/src/exact-proof/exact-affine-plane-internal.ts:19-32,44-58 — existing exact affine support admission and nearest chart policy; its64-point projection budget is not a160-point trim limit and must not be reused per-loop without an appropriate request-local adapter.
- packages/barocss-cad/src/intersect/own-affine-plane-loop-internal.ts:18-26 — existing degree1/equal-weight/affine/Gram admission.
- packages/barocss-cad/src/brep/planar-arrangement.ts:245-251 — existing exact homogeneous point/orientation primitives for finite UV without world-mm limits.
- packages/barocss-cad/src/core/math.ts:20-31,60-80 — finite clamped domains; no arbitrary +/-10000 UV-coordinate rule.
- packages/barocss-cad-model/test/direct-trim-guards.test.ts:49-65,93-117 — current exact/public160 negative cases and untrimmed positives; D337 must intentionally change only admitted Reverse behavior.
- apps/cad-studio/src/ui/DirectPanel.tsx:27-29,145-185 — existing error funnel, axis choices, Reverse/Untrim and thicken consumers.
- apps/cad-studio/src/ui/DirectInspector.tsx:22-37 — current whole-surface snapshots and explicit trimmed refusal for thicken/sew.
- packages/barocss-cad/src/part/part-model.ts:257-271 — existing Core thicken/sew feature contracts.
- packages/barocss-cad/src/part/part-shell.ts:16-29; packages/barocss-cad/src/brep/thicken-solid.ts:13-61 — native raw thicken/default40/faceted/fold behavior.
- packages/barocss-cad/src/part/part-mesh.ts:54-66 — existing sew2..64/tolerance limits.
- packages/barocss-cad-model/src/engine/doc.ts:407-408,566-567; engine/part.ts:174,291 — existing Model snapshot nodes/conversion.
- packages/barocss-cad-model/src/app/editFields.ts:532-533 — current thickness/tolerance editor fields.
- packages/barocss-cad/src/api/part.ts:140-216,245-273 — current facade methods, binding resolution, #make versus #act.
- packages/barocss-cad/src/api/spec.ts:31-57; api/kernel.ts:35-125,138-169 — current spec/backend/binding inventory; thicken/sew absent.
- packages/barocss-cad-model/src/api/studio.ts:40-64,73-89 — commandById route and Model parameter bindings; no thicken/sew route today.
- packages/barocss-cad-model/src/api/index.ts:12-15 — current shared option exports.

## Limits and next owner action

No new confirmed loss beyond already deliveredD336. This plan proposes positive functional support, not another speculative guard expansion. Root first completes D336 publication. Then freeze A or B and run one scoped producer/algorithm probe after an explicit runtime/heavy grant. A's rational rounding/topology adapter needs an independent geometry review; routine command/UI/tests use Medium. Do not present this plan's Fraction arithmetic or retainedD336 evidence as aD337 runtime PASS. Whole08, general curved/multi-loop trim transport, trimmed solid construction and release remain open.
