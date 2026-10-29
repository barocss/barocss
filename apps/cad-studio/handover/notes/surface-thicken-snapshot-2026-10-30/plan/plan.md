# D338 reserved proposal: public whole-surface snapshot Thicken

SOURCE PLAN ONLY. Reserved next decision only if D337 qualifies; root completes current D337 work first. Source inspected at481105e400d713e2b79f7160c307836fc65bd13a in local/cad-dev, fixed worktree `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`. The source is frozen for the current browser flow; no repository files were written. No runtime/heavy/build/test/browser/commit/push. Only `/tmp/d338-plan` artifacts were written. Independent arithmetic is PLANNING, not a product PASS.

## Outcome and priority

Confirmed source facts: thickenSolid already exists; CadPartFeature already has thicken; Model already stores the six-field surface snapshot, thickness Dim and side; Model conversion already emits Core thicken; DirectInspector already offers actual Thicken and rejects trimmed selections; the feature editor already exposes thickness. There is no shared Part.thicken method, FeatureSpec command, Kernel backend case, Model commandById route or shared API export for this operation today. This is the selected facade/consumer gap, not a missing geometry implementation.

Recommend one Thicken verb only. Sew's facade remains another valid08 consumer candidate, but adding it now doubles input-order/tolerance/name concerns unnecessarily. Generic exact face move/delete/replace, curved offset, trimmed thickening/sewing and broad trim/curve/fill extensions remain broader unsupported scopes. Existing planar Offset face, surface UI consumers and body patterns must not be rebuilt. This is no new confirmed defect and makes no performance claim.

## Public contract to freeze

```ts
export interface RawNurbsSurface {
  readonly degreeU: number;
  readonly degreeV: number;
  readonly knotsU: readonly number[];
  readonly knotsV: readonly number[];
  readonly controlPoints: readonly (readonly (readonly [number, number, number])[])[];
  readonly weights: readonly (readonly number[])[];
}
export interface ThickenOptions {
  t: Dim;
  side?: 'normal' | 'reverse' | 'both';
}
// Part.thicken(surface: RawNurbsSurface, options: ThickenOptions): this
// thickenSpec(surface, resolvedOptions): FeatureSpec
```

Use `thicken`, not `thickenSurface`: api-conventions§12 requires the existing palette/v2 verb and its values names. Use `t`, matching shell({t}), the existing thicken feature-editor keyt and the proposed command fieldt. This revises the earlier D337 alternative spelling to fit current repository vocabulary. No unit suffix. Do not name it offset or exactThicken.

Semantics: make one new body from a COPIED WHOLE untrimmed raw surface, on an empty or existing part. Use Part.#make, exactly as extrude/sketch-body creation, never #act/target(). The current selected body is not modified or consumed. The normal is du×dv. side defaultsnormal; reverse offsets against it; both uses half the total t each side. Omit side in authored recipes for defaultnormal, consistent with existing DirectInspector, unless root intentionally freezes explicitnormal in both backends. Side is an enum, not a bindable dimension. Onlyt binds. Native default40 sampling each way and fold/geometry refusal remain. The result is a faceted approximation on curved surfaces; it is not a new exact curved offset engine.

### Snapshot admission and ownership

A shared INTERNAL snapshot helper should capture exactly the six RawNurbsSurface own data fields, clone dense numeric arrays and then call existing validateSurface on a synthetic Surface identity. Reject unknown fields, extra metadata, accessors/sparse arrays/foreign containers where the new helper claims plain-data capture. Do not silently strip `trims`, `objectId`, `source`, `geometry`, `kind/id`, transform or wrapper fields. A full native Surface may be intentionally converted by a caller, but the declared raw API takes the six-field whole-surface recipe. Do not opportunistically accept a DirectObject or a live reference.

Retain current math limits: native degrees1..5 below each pole count,2..16 poles each axis/256total; positive weights[1e-6,1e6], geometry coordinates within1e6 and finite clamped nondecreasing knots/positive domain. Do not replace these with D337 affine-only or +/-10000 UV limits. Thickness alone follows Core dim: finite positive <=10000 mm. Add no minimum0.1, no new epsilon, cumulative offset cap or grid option. Existing geometry may still refuse a positive tiny wall or bad normal through current meshing/geometry rules. Do not change weld or normal fallback tolerances.

The new snapshot is self-contained. Caller arrays and source documents remain unchanged; mutating the supplied arrays or a returned document copy cannot change an already accepted feature. No source-object lifetime, live reference, source deletion guard or dependency epoch is required. Label API-created Model nodes `Whole surface snapshot` (or another fixed explicit copied-source label). Direct selection retains its copied source name for the user, with an explanatory hint that subsequent source edits do not update this body. Source and body have independent histories.

A raw standalone snapshot cannot reconstruct direct metadata already discarded by a caller. Its API contract explicitly means whole support; do not advertise it as accepting a trimmed selected object. The context-aware UI extractor must check original DirectObject metadata BEFORE geometryOf()/six-field copying: one unique selected surface, current source, no nonempty trim, and malformed non-array trim containers refuse rather than bypass. Empty array or omitted trims means whole surface. Preserve D336/D337 selected-surface semantics. New refusal admission is required by this new route, not a claim to have reproduced another legacy bug.

Do not silently broaden this into a whole-document validation/migration project. Existing native raw thicken recipes and legacy reader policy are a separate source contract; only claim strictness for the new facade/command/helper paths unless Core/admission is intentionally and independently extended. Positive native file retention is required. No schema or saved-node change is required.

## Exact minimal wiring

1. **Shared API spec:** add ThickenOptions/RawNurbsSurface and `thickenSpec` to `packages/barocss-cad/src/api/spec.ts`, with discriminant `{command:'thicken', surface:RawNurbsSurface, values:{t:number,side:...}}`. The raw surface is a side payload like extrude.sketch/curve.path, not a value flattened into generic strings. Capture it once via the internal helper. Validate t and side. Unknown side/invalid dimensions are typed facade VALUE; existing parameter lookup rules remain. Geometry fields do not bind. No public quality/grid option.
2. **Shared Part:** add `.thicken(surface,options)` using #spec(options,...) then #make. Both KernelPart and StudioPart inherit it; do not add two divergent methods. Preserve #make's chosen-body/TOOL callback behavior. This must work as the one new tool inside existing subtract callback, and preserve prior bodies. Use explicit .body(newKey) for mass in a part with multiple bodies, as existing constructors do.
3. **Kernel backend:** add one featuresOf case emitting existing `{id:nextId(doc,'thicken'),kind:'thicken',surface:ownedSnapshot,thickness:values.t,side?}`. Add `BINDS.thicken.t = [0,['thickness']]`. Do not consume target or synthesize geometry/sketch nodes. Backend apply already evaluates before returning, leaving input doc unchanged on refusal. Core thicken dispatch and algorithms remain.
4. **Model command/helper:** add commandById('thicken') with fields t andside and one internal construction helper. API context may supply `thickenSnapshot:{surface,name}`; UI context may resolve one current selected direct object into the same owned snapshot. Ctx raw snapshot branch works with no existing body or direct module loaded. available/build must not depend on the caller having a body selected. build returns existing `withNode(...,{kind:'thicken',name,surface,thickness:t,side?})`.
5. **Studio backend:** set that context payload from spec.surface with fixed API snapshot label. Add `BINDS.thicken.t = [0,'t']`, using the existing editFields thickness key. The ordinary command route must exist: current apply dereferences commandById(spec.command), so exporting a method alone is incomplete. Raw API and selected-direct calls use the same geometry/snapshot checks. Existing source name is UI label only, not a topology reference.
6. **DirectInspector reuse:** replace its local six-field surface-copy/build code with the shared extractor/construction route. Preserve original direct source visibility/history semantics (thicken currently retains the direct source; sew hides its sources). Prefer opening the existing command preview/Apply path for this new normal command, seeded with current DirectPanel thickness/side, so native fold/geometry failures are evaluated before accepted document/Undo mutation. Reuse App.start/active preview ownership; do not invent another async evaluation lane. Keep all new context checks before copying metadata. On failure, preserve selection and avoid a pending Undo entry; clear selection only after accepted commit. This may need a narrow callback from App to initialize the command using the selected surface id and supplied values. Do not redesign the whole DirectPanel.
7. **Editor/chat:** retain existing t field; add a side choice to existing thicken editFields so all declared public options remain editable after native reopen. Add `thicken` SPECS entry withname/surface/thickness/side to chat/checkNode plus the shared strict surface check where appropriate; current checkNode reportsUnknown feature kind for thicken despite the existing saved node. Register command docs/tool fields via current generation workflow. Do not expose arbitrary raw blobs or a new sew command in this slice.
8. **Exports/docs/API inventory:** export new option/type/spec through cad/api and re-export options/types through cad-model/api. Add README/examples on whole-surface snapshot/faceted result/t binding. Generate and review actual exposure/refusal/tool inventory delta. Do not hand-edit expected API checks without reviewing exact added/changed rows. No package dependency, lockfile, root config or migration change.

### Parameter/refusal behavior

Only t is Dim and lands directly at thickness in both documents. Initialunknown parameter keeps PARAMETER_UNKNOWN. T edits re-evaluate the existing snapshot; invalidT/fold/normal/mesh errors keep Core mapped codes and leave immutable facade input unchanged. Binding side/geometry is outside the declared type; test a casted Param there as invalid input rather than inventing a new parameter system. Core `part-shell.ts` keeps PARAMETER for out-of-range/positive thickness and CAPABILITY with `[OFFSET_FOLDS]` for fold refusal, or its existing GEOMETRY mapping. Public spec can refuse a bad initialt with VALUE consistently before either backend. Do not rewrite errors as generic success or replace a fold by an empty body.

Core fold check handles degrees<=3 by existing patch curvature search and higher degree by existing64grid. Retain it byte-for-byte. Positive t alone does not certify all surface normal regularity or global offset nonintersection. A body only qualifies if existing native construction/checkBrep accepts it. Curved default40 facets remain approximation, not an exact smooth surface mass certificate.

## Independent geometry / mass / name oracle

See independent-oracle.py/.json. No production imports. Main qualified profile is the nonunit-domain40x30 plane from D336/D337 atz3 with normal+Z: S(u,v)=[20+5u,-11+5v,3], u[-2,6],v[1,7].

- t2 normal: volume2400, centroid[30,9,4], bounds[10,-6,3]..[50,24,5].
- t2 reverse: volume2400, centroid[30,9,2], boundsz1..3.
- t2 both: volume2400, centroid[30,9,3], boundsz2..4.
- t3 normal after parameter/editor edit: volume3600, centroid[30,9,4.5], boundsz3..6.

Assert one closed valid solid, exact expected planar bounds and a clear numerical volume/centroid tolerance matching existing flat tests (existing Core flat volume uses1e-6; native UI mass/centroid can use existing1e-7 if observed valid). This is planar geometry; no curved exactness claim. Use real native face names from the current mesh producer: default `<stable feature id>.facet<group>`, with six groups expected for this plane. Confirm actual grouping before freezing exactname receipts; do not rename them top/bottom. Preserve the exact accepted name set through t edits, Undo/Redo and native file; inspect correct side locations as well as count. Native triangle source order is existing behavior.

Separate witness box[80,-3,1]..[92,4,6]: volume420, centroid[86,1/2,7/2], stable original names; adding thicken preserves it. A part with both bodies has two outputs, not one union or duplicate stock body. Verify `.body(newKey)` and tool-callback focus semantics deliberately.

Fold fixture reuses current radius10 quarter cylinder from r11-3, parameterizationnormal points toward the axis. t12normal andt21both must retain CAPABILITY/[OFFSET_FOLDS] refusal before facade return/Apply. A normalt2 mathematical quarter-annulus has volume90pi and a reverset2 one110pi; existing faceted approximation has its original2e-3/1% bound from scoped old tests. The plan JSON lists these as optional analytic controls, not a request to broaden D338 curved qualification. Do not retain the old weak either-side formula as new semantic proof. A fold negative case plus flat positive profile is sufficient for the initial slice.

Snapshot lifetime: create from direct surface, then move/edit/delete the source using current direct API. Accepted thicken remains exactly based on its saved six-field snapshot. This is intentional independent ownership, not stale live behavior. Test source namechanges/hidden state do not silently rewrite the snapshot. Native save stores original copied NURBS coefficients and t/reference, then rebuilds the same body on Open. Semantic document equality and raw-byte identity are separate claims.

## Minimal tests and actual editable/file flow

Focused tests before browser:

- Kernel API empty-part/three-side creation, owned dense surface snapshot, no source/options mutation, invalidfields/trims/wrappers/nonfinite/malformedgrid/degree/weights refusal, t parameter edit and fold errors, body-add/tool callback focus, native CadPart save/read and stable names.
- Model API parity with same rawsurface, sameone existing node+label/side/t binding, helper parity with selected-direct context, public trimmedDirectObject refusal BEFORE copying (including malformed trims and duplicate selected ID), current command discovery/checkNode docs, invalid edits atomic, native encode/read identity and side/t editable fields. Existing Core positive/fold tests are control receipts; do not rerun the whole geometry suite merely for acknowledgment.
- Studio affected adapter/preview tests prove existing ownership and accepted-state behavior. New implementation uses routine Medium; independent geometry/source review verifies no algorithm/tolerance change.

Actual flow after D337 qualification and D338 checks: one browser/serialcontexts/source capsules. Create or open a public-facade-generated .bcad with a named t parameter and flat surface snapshot. Also exercise actual DirectPanel Thicken through the shared command path with t2normal: preview2400/centroid, Cancel/retry/Apply, Undo/Redo. Edit t to3 ->3600; edit sideboth ->centroidz3/bounds1.5..4.5 for total3. Save/New/freshOpen, exact accepted snapshot fields/t binding/side/stable names, reopen editable fields. Make one unsupported trimmedselection and one quarter-cylinder fold attempt; no accepted document/Undo mutation, then retry valid flat. Prove copied-source lifetime on one actual source edit, with body unchanged; do not imply live association. Retain all first failures and resumed-prefix distinctions.

Both public facade-generated file and actual Studio-selected-source helper must reach the same existing Core algorithm. Merely calling thickenSolid(rawSurface) or counting a new API method does not qualify the Model/Studio consumer. Conversely, existing DirectPanelbody success alone does not prove new facade/spec/binding wiring. Record these boundaries separately.

## Exact source references

- apps/cad-studio/handover/api-conventions.md:195-203 — names match palette/v2 command and commandvalues; no unit suffix.
- packages/barocss-cad/src/api/part.ts:22-28,139-149,245-273 — common backend, constructorverbs, #spec parameter resolution, #make versus#act.
- packages/barocss-cad/src/api/spec.ts:31-57,63-82,107-108,132-176 — current discriminants/options/positive fields, sketch side payload andt vocabulary; no thicken case.
- packages/barocss-cad/src/api/kernel.ts:13-17,33-50,138-175,180-201 — newkindid, constructor feature write, binding tables and evaluate-before-return.
- packages/barocss-cad/src/api/index.ts:1-20; packages/barocss-cad-model/src/api/index.ts:12-15 — exposure seam.
- packages/barocss-cad/src/part/part-model.ts:257-258,1015-1019 — existing Core rawsurface/thickness/side and finitepositive<=10000 dim semantics.
- packages/barocss-cad/src/part/part-shell.ts:16-29 — existing rawsnapshot ->thickenSolid and error mapping.
- packages/barocss-cad/src/core/math.ts:9-39,60-80 — current coordinate/weight/degree/pole/domain limits.
- packages/barocss-cad/src/brep/thicken-solid.ts:13-61 — existing side/default40/normal fallback/fold/mesh construction.
- packages/barocss-cad/src/blend/offset-cavity.ts:114-134 — original fold-check policies; unchanged.
- packages/barocss-cad/src/mesh/mesh-brep.ts:18-27,31-40,84-112 — existing weld/triangle/group behavior andfacet names.
- packages/barocss-cad-model/src/engine/doc.ts:407-408; engine/part.ts:174 — existing Model node andconversion.
- packages/barocss-cad-model/src/app/editFields.ts:79-110,532-533 — ordinary binding machinery and existing thickness/tolerance editor.
- packages/barocss-cad-model/src/app/commands.ts:43,45-53,437,977 — Ctx, scalar fields, registration andcommandwrappers.
- packages/barocss-cad-model/src/api/studio.ts:40-64,73-99 — commandById dependency, contextpayload pattern andModel binding table.
- packages/barocss-cad-model/src/chat/features.ts:20-67,116-142 — checkNode has no thicken schema today; newroute must be registered.
- apps/cad-studio/src/ui/DirectInspector.tsx:22-28 — existing copied-source thickenaction andtrimrefusal, prior to proposed shared route.
- apps/cad-studio/src/ui/DirectPanel.tsx:175-180 — existing Thickness/Side controls andaction.
- apps/cad-studio/src/App.tsx:1085-1134 — current owned command start/preview route; reuse it.
- packages/barocss-cad-model/src/api/core.ts:19-29 — facade evaluation throws onfailure andexisting mass fields.
- packages/barocss-cad/test/thicken-solid.test.mjs:11-23 — existingflat/curved rawCorepositive controls.
- packages/barocss-cad/test/r11-3.test.mjs:91-99 — existingquarter normal/both fold semantics and boundedcurved mass.

## Limits

No new geometry algorithm, exact curved offset, trim support, associative surface reference, Sew facade, general face editing, performance, full-suite, browser, remote CI/release or whole08 acceptance. Native closed-body approximation and source snapshot ownership retain current limits. D338 remains a reserved decision until root completes D337. This source plan requires no clarification from the sleeping user.


## Proposed implementation ownership after D337 publication

- **Medium Kernel/API worker:** owns `packages/barocss-cad/src/api/{spec,part,kernel,index}.ts`, one small internal rawsurface snapshot helper if needed, and focused new Kernel API tests. Contract export is RawNurbsSurface / ThickenOptions / thickenSpec / inheritedPart.thicken. Reuse validateSurface and existing thicken feature/algorithm. Do not edit Core thicken geometry/tolerance or root manifests. To avoid a second public utility, Model can reuse public thickenSpec for the owned six-field snapshot validation; the helper need not be separately exported.
- **Medium Model/Studio worker:** owns one Model thicken command/construction/context extractor module, Ctx+commands registration, Model api/studio+index, checkNode/chat registration, thicken editFields sidechoice, DirectInspector/App callback integration and affected Model/Studio tests. Uses the frozen thickenSpec payload rather than a second rawsurface admission implementation. Owns no Kernel API files. Preserve existing direct-source semantics and normal command preview/Apply ownership.
- **Root serial owner:** coordinates exact cross-package interface, integrates/checkpoints, API metadata/tool/refusal inventory and expected snapshot after reviewing the delta, docs/evidence/native flow and publication. Preserve active D337 docs/evidence WIP.
- **High geometry/source reviewer after workers:** read-only review of snapshot context retention, fold/error/binding consistency and source ownership; no geometry redesign or heavy work unless root grants it.

Workers are not alone in the shared checkout and must preserve each other's changes. No concurrent edits to the same file. Kernel/API export definitions freeze before the Model worker relies on them; preparatory Model source/test mapping can run independently. Core/Model/Studio validation receipts remain separate. Actual browser work follows source checkpoint, one sole heavy grant and immutable source capsule; no edits during the flow.
