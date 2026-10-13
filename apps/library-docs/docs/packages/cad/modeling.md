# Model a part, edit it and reopen it

Use `cad.model()` to author a bounded solid part with named dimensions. Start with a polygon, rectangle or owned circle sketch, extrude it, cut it with a through-slab tool, intersect it with another extrusion, fuse two rectangular extrusions, or split it by height, and use supported edge chamfers. You do not choose a document version or author native IDs, revisions or reference records.

All dimensions below are **millimetres**. Use a TypeScript-capable workspace/bundler for source package entries; built ESM and declarations are a separate package build. Source adoption does not establish npm publication.

## Use the modeling workspace

Open **Model a part** (`#/model`). The [contextual workspace](https://github.com/barocss/barocss/commit/a5c881b0cbe9e99f5285613d474e5e63f29e9137) keeps the accepted preview in the center, with a **Browser** of authored features and named outputs on the left. Selecting a feature in the Browser or bottom feature strip does not rebuild the model. The strip shows existing feature order; it is not a reorder or rollback editor.

1. Choose **CREATE → Modeling examples → Resize a constrained plate**. Acknowledge replacement, then **Load example**. The existing accepted model remains until the new model is admitted.
2. Select **Sketch 01**, then **MODIFY → Edit dimensions**. Temporary options show **Profile X width** and **Profile Y height**. Type width **40**; the accepted preview stays unchanged while dimensions are pending.
3. Choose **Apply dimensions** to submit the batch. Successful acceptance closes the options and advances history. A refused edit keeps the previous model and leaves the options, draft and error available. **Cancel**, or unmodified **Escape** in a dimension input, discards the pending dimensions and closes the command. Unmodified **Enter** in a dimension input applies them.
4. Use **Undo/Redo** in the document bar. **Ctrl/Cmd-Z** and **Ctrl/Cmd-Shift-Z** also work while focus is in the workspace outside editable fields, with no pending dimensions or computation. These actions use the existing accepted-model history.

For other recipes, **MODIFY → Edit model dimensions** exposes the existing model-wide named drivers; selecting a feature does not make those drivers feature-local. Switching to an inspection or file panel retains drafts; **Resume dimension edit** returns to them. **Cancel computation** interrupts an active operation and retains pending dimensions. File replacement still requires its existing acknowledgment.

Use **INSPECT → Inspect selection** for accepted output details and approximate picked-face provenance; **INSPECT → Output bodies** for supported output display choices; and **INSPECT → Capabilities & limits** for the current boundary. **FILE → Save or open a model** contains the saved-data/file controls. **FILE → Export accepted STL** opens the existing independent output selector and export action. The example instructions below use these same panels.

This increment changes command organization, not native capability. It adds no sketch drawing, arbitrary feature editing, feature reorder or camera tools. Local React/controller checks cover command selection, draft retention, Apply/Cancel/Escape, history and stale completion. The later [scoped workspace screen checks](https://github.com/barocss/barocss/issues/1943#issuecomment-6157399564) cover the constrained-plate flow and round-post resize/picking on exact `f96a94a1`; they do not cover the new-part command below.

### Create your own rectangular part

Choose **CREATE → New rectangular part**. Enter **Width**, **Profile height** and **Thickness** in millimetres; the defaults are 32 × 24 × 8. These values author an origin-zero rectangle and extrusion with independent named `width`, `height` and `thickness` parameters, not an example-picker selection. **Authored model source** shows the exact intent that will be loaded.

The inputs are temporary creation settings, separate from pending edits of the current model. Existing model drafts block creation; **Review pending dimensions** lets you apply or cancel them first. **Cancel/Escape** closes the new-part command without changing the accepted document. A current document is replaced only by the explicit **Replace current model** action: download the accepted document first if needed, because successful replacement resets Undo history to one entry and does not save a file. With no accepted model, use **Create part**. The accepted preview stays visible until native admission succeeds; invalid dimensions, native refusal or display refusal preserve it. **Cancel computation** interrupts an active build.

After creation, use **MODIFY → Edit model dimensions** for the named profile sizes, or select **Extrude 01 → MODIFY → Edit extrusion** to change **Height · thickness**. Apply shows the accepted native shape and advances history; Undo/Redo use that history. **FILE → Save or open a model** downloads accepted authored intent and reopens it through the existing loader. The current download action saves accepted values only; unapplied edits are not saved.

Dimensions must be finite and greater than 0, up to 10000 mm; native exact-representability limits can still refuse a value. This command adds no sketch drawing or live draft-mesh preview. [#1951](https://github.com/barocss/barocss/issues/1951) tracks the focused software and actual new-part/file workflow separately; physical acceptance is pending until its exact-source Tester result.

### Edit an existing extrusion

For example, load **Create a round post**, select **Extrude 01**, then choose **MODIFY → Edit extrusion**. Its **Height · height** field edits the existing named height driver. Type a value and choose **Apply extrusion**; a refused edit retains the accepted model, draft and diagnostic. **Cancel/Escape** discards a current command's pending dimensions. Undo/Redo use the same accepted history.

Only direct named height/start-Z drivers are editable here. Authored literals, omitted start-Z = 0 and derived expressions are read-only; use **Review model dimensions** to edit the model's named drivers. One shared parameter can affect other fields or features, including a pocket's derived start coordinate. This is not an isolated feature edit or an expression-rewriting tool.

Options stay pinned to the feature chosen when the command opens, even if Browser selection changes. Unrelated pending dimensions are shown in the global editor rather than silently applied. A model or output-view change makes older options stale; reopen the command. Stale options cannot apply or discard newer drafts. The [local interaction scope](https://github.com/barocss/barocss/issues/1948) uses retained baseline packets and explicitly mocked edited geometry; the later [bounded round-post screen check](https://github.com/barocss/barocss/issues/1948#issuecomment-6157158440) covers the adopted command on exact `f96a94a1`.

## Open and space two translated gussets

<a :href="withBase('/examples/modeling-translated-gussets.ts')" download>Download the complete translated-gussets example</a>

The [adopted translation API](https://github.com/barocss/barocss/commit/31ad07d5234326bf68b937c070000e94d2c45501) creates an independently qualified copy of a direct extrusion. This example keeps the original **left** gusset and places **right** 48 mm along X. Each has certified volume **6912 mm³**; the constrained profile is 40 × 24 mm with an inclined edge, extruded 8 mm.

<<< ../../public/examples/modeling-translated-gussets.ts

Call `makeTranslatedGussets()` in a host using `@barocss/cad`, then obtain `initial.save()`. Alternatively, copy the exact [measured baseline saved model](https://github.com/barocss/barocss/blob/31ad07d5234326bf68b937c070000e94d2c45501/packages/barocss-cad/test/modeling-translation-evidence/initial.cad-model.json). In the Modeling workspace, choose **FILE → Save or open a model**, paste the text into **Saved model data**, acknowledge replacement, and choose **Open saved model**. Both convex outputs are displayed together. Edit the generic **spacing** dimension to 64 and Apply to move the copy; **width/height** drive the XY profile, while **offsetY/offsetZ** place the copy in Y/Z. Thickness remains 8 mm. There is no new picker preset.

Only one translation of a direct affine rectangle, polygon or constrained-polygon extrusion is supported, including an admitted extrusion start coordinate. Its result is terminal: do not Boolean, split, hole, chamfer or translate it again, or mix this graph with Boolean/finishing nodes. Circle, hole and orthogonal-cell parents are refused. Coordinates must remain within ±10000 mm and every translated coefficient must be exactly representable; the measured `spacing:0.1` edit refuses rather than rounding. A zero offset still creates a distinct named copy, not a union. Refusal preserves the accepted snapshot. Save stores authored intent; `cad.load(savedText)` rebuilds native geometry.

The [provider evidence](https://github.com/barocss/barocss/tree/31ad07d5234326bf68b937c070000e94d2c45501/packages/barocss-cad/test/modeling-translation-evidence) retains both genuine baseline previews, each 24 vertices/12 triangles. Existing serializer/receiver CPU replay admitted the complete **53,882-byte** pair, preserved each native body/face lineage, converted XYZ once and picked both bodies; four malformed controls retained the prior accepted display. Provider loading and Worker delivery were mocked in that replay. This documentation adds no native calls or adapter changes. Edited-state pixels, React interaction and physical file dialogs remain **unverified**.

### Export the right gusset as STL

The same download now includes `exportRightGusset(accepted)`, which calls the [adopted named-output API](https://github.com/barocss/barocss/commit/5c6dc223a9b9e6b88bc8134651366b23147bc7c4): `accepted.exportStl('right')`. Convert its immutable `bytes` with `Uint8Array.from(result.bytes)` and pass that array to your host's file-saving API. Importing the example performs no modeling or export; the CAD method itself writes no file or starts a download.

<a :href="withBase('/examples/modeling-translated-gusset-right.stl')" download>Download the measured right-gusset STL sample</a>

This exact retained sample is **684 bytes / 12 facets**, with authored XYZ bounds **[48, 0, 0]–[88, 24, 8] mm** and zero measured vertex displacement for this integer-coordinate specimen. It was exported and cold-rebuilt by [the bounded provider campaign](https://github.com/barocss/barocss/tree/5c6dc223a9b9e6b88bc8134651366b23147bc7c4/packages/barocss-cad/test/modeling-stl-evidence); this guide reuses those bytes without a new geometry run. `outputName`, `byteLength`, `triangleCount` and `maximumVertexDisplacementMM` describe the result. `details.encoding.vertexLosses` preserves original and Float32 coordinates; `details.native` retains native source/face lineage beside the file.

Only a named **convex-planar** output is supported. Hole, round-post and orthogonal-cell outputs refuse. Every export revalidates the complete native parent and checks all quantized facets; Float32 collapse refuses without partial STL bytes. Other coordinates can incur nonzero loss. The millimetre convention belongs to the caller/report because STL carries no units metadata, native IDs or UV trims. The checks do not certify watertightness, global topology after quantization, manufacturing tolerance or slicer acceptance. Keep `accepted.save()` for editable CAD Save/Open; STL is an approximate facet handoff. This addition does not establish browser download or viewer acceptance.

#### Download STL from the model editor

After opening the two-gusset saved model in **Model a part**, open **FILE → Export accepted STL**, choose **right · convex-planar** in **STL output**, then **Download STL**. The selector is independent of the visible bodies and selected face. The accepted native snapshot supplies the file; source, history and display stay unchanged. Apply or discard dimension drafts first. This also works for other supported primary convex outputs; hole, circle, orthogonal-cell and legacy outputs are unavailable.

An unavailable worker changes the action to **Recover accepted model and export STL** and explains the rebuild before you click. Recovery checks the accepted source and summary before export; a stale response, cancellation or refusal produces no file. The status reports byte/facet counts and maximum Float32 vertex displacement. Files use authored XYZ, an mm convention and at most40 facets; STL itself has no unit or editable model data. Browser disk persistence and slicer/manufacturing acceptance still require separate verification.


## Copy a finished two-chamfer rail

Finish one **32 × 24 × 8 mm** rail, then translate the finished result with an owned spacing driver. Each edge is selected from the shape it actually modifies: front chamfer1 mm, then back chamfer2 mm at Y=24. The copy starts at X=48.

<a :href="withBase('/examples/modeling-translated-finished-rail.ts')" download>Download the typed finished-rail example</a>

<<< ../../public/examples/modeling-translated-finished-rail.ts

Call `makeTranslatedFinishedRail()`, save its authored text with `pair.save()`, then use **FILE → Save or open a model → Choose model file → Open saved model** in **Model a part**, acknowledging replacement if needed. Generic Open shows both **left** and **right** convex outputs and the existing frontDistance, backDistance, backY and spacing controls. Change spacing48→64 with **Apply dimensions**, or call `spaceFinishedRail(pair)`. No extra preset or scene transform is needed.

The [adopted provider evidence](https://github.com/barocss/barocss/blob/f6e19f627c06b44d583cc7d110f91def11a3e508/packages/barocss-cad/test/modeling-finished-copy-evidence/verification.json) measured **6064 mm³ per output**, unchanged by spacing64; backDistance3 gave **5984 mm³**. Both genuine baseline previews have20 triangles. The consumer check replays those unchanged packets through the current serializer/controller/receiver with mocked provider delivery; edited pixels and physical file interaction for this rail remain unverified.

Translation is terminal and currently accepts a direct affine extrusion with at most two sequential owned chamfers. It rebuilds the copied native boundary with independent source lineage. Repeated translation, operations after the copy, unsupported ancestry and inexact/out-of-range coordinate sums can refuse; this is not an arbitrary Solid transform.

The existing [STL output action](#download-stl-from-the-model-editor) and named-convex `snapshot.exportStl(name)` API are available separately. This finished-rail campaign captured **no STL exports**. The runnable download therefore contains no export call, and the gusset STL sample must not be treated as a measured rail file.

## Resize a constrained plate

<a :href="withBase('/examples/modeling-constrained-profile.ts')" download>Download the complete constrained-profile example</a>

Choose **Resize a constrained plate** (`constrained-plate`) in the existing Modeling picker. Edit **Profile X width** and **Profile Y height**, then Apply. Thickness stays **8 mm**. Fixed corner targets and horizontal/vertical edges determine the rectangular profile; the initial fourth-point seed X=1 is solved to X=0 rather than treated as the finished corner.

<<< ../../public/examples/modeling-constrained-profile.ts

This is the exact [adopted #1835](https://github.com/barocss/barocss/issues/1835) `constrainedPlate` recipe on `c24b659fafe76ac02c5590e6d801d86e1af0cbfd`. Its authored `lockY:0` parameter remains internal to the preset, so the UI exposes only width/height. Generic imported graphs keep their own numeric controls; friendly labels and this filtering require the exact preset graph, constraints, driver set and sole `part` output. The callback owns its points and ordered constraints; this does not add interactive sketch drawing or a constraint-editing panel.

The measured native baseline is fully constrained (rank8, DOF0), with a consistent redundant final fixed-corner constraint. It qualifies a convex Solid with **6144 mm³**, 6 faces, 12 edges and 8 topology vertices. The provider separately measured width40 → **7680 mm³**, a genuine `lockY:1` native `CONFLICT` refusal, and height16 recovery → **4096 mm³** on the still-accepted baseline. Failed candidates do not replace accepted source, geometry or history. The conflict case is a test of the native contract, not a production control exposed by this preset.

Save retains authored points/constraints/parameters, not the solved native mesh or a scene cache. Reopen uses the existing cold loader. Even when the solved shape is rectangular, this constrained profile is not an authored rectangle and does not acquire rectangle-only union/difference/hole shortcuts. The existing exact native admission and convex display limits still apply.

The committed [provider evidence](https://github.com/barocss/barocss/tree/c24b659fafe76ac02c5590e6d801d86e1af0cbfd/packages/barocss-cad/test/modeling-constraints-evidence) includes the genuine **292,980-byte baseline transfer**, SHA256 `194b855ed3e862e76c2468cbbcb0d2f21f7b2eda0a217325fa95a32fee226721`, with **24 display vertices and 12 triangles**. The consumer replays that unchanged baseline preview through the real serializer/CPU receiver. Its provider/Worker responses and every edited-state display are explicitly mocked; they are not newly measured geometry. This consumer runs **zero new native calls**. CPU picking and state tests do not prove browser/GPU pixels or physical file dialogs. **External visual gate OPEN** under [#1865](https://github.com/barocss/barocss/issues/1865).

## Cut a top-entry pocket

<a :href="withBase('/examples/modeling-top-pocket.ts')" download>Download the complete typed top-entry pocket example</a>

Choose **Cut a top-entry pocket** in **Modeling examples**, acknowledge replacement and load it. Edit **Pocket depth downward from top Z=8**, **Tool Y origin** or **Tool Y span**, then Apply. The plate is 32 × 24 × 8 mm and the cutter's X extent stays 8..24 mm. The owned expression `from = 8 - depth` moves the bottom of the positive-height cutter while its top remains at Z=8. Depth4 leaves a 4 mm floor; depth6 leaves a 2 mm floor; depth8 makes a through-window. The existing underside-entry example still starts both extrusions at Z=0.

```ts
const model = cad.model(), depth = model.parameter('depth', 4);
const toolY = model.parameter('toolY', 8), toolSpanY = model.parameter('toolSpanY', 8);
const plate = model.sketch.rectangle({ min: [-0, 0], max: [32, 24] }).extrude(8);
const from = model.dimension.add(8, model.dimension.scale(depth, -1));
const tool = model.sketch.rectangle({ min: [8, toolY],
  max: [24, model.dimension.add(toolY, toolSpanY)] }).extrude(depth, { from });
const initial = model.build({ plate, tool, part: plate.cut(tool) });
const deeper = initial.withParameters({ depth: 6 });
```

The preset explicitly displays **part**, while **all outputs are validated**, including hidden plate and tool. All three remain authored and saved. Generic Open initially displays **tool**, the last canonical `part,plate,tool` output; choose part to inspect the pocket. That chooser only changes the displayed output. Exact graph, driver and output-map matching gates the friendly top-entry labels; similarly named imported dimensions keep generic labels. Apply/Discard, no-op, refusal, cancellation and Undo/Redo use the existing atomic session.


### Top-entry limits and evidence

The [adopted offset-extrusion provider](https://github.com/barocss/barocss/blob/ba6ccf1d52667564cf69db8763f185aa8c8fab76/packages/barocss-cad/test/modeling-offset-evidence/verification.json) measured part volumes **5632 mm³** at depth4/from4, **5376 mm³** at depth6/from2 and **5120 mm³** at depth8/from0. A full-width through cutter that leaves two bodies is refused; the accepted snapshot survives and can be edited again. Positive extrusion height, exact represented origin arithmetic, integer-box qualification, nonempty single-body material and the existing **64 panels** complete-display limit still apply. Native qualification can refuse otherwise plausible dimensions.

This consumer reuses the unchanged **46 genuine part packets**,184 vertices/92 triangles from the 1,514,483-byte provider transfer (SHA256 `c0a29404b5ffb8dc66eb9e6f8073b9e1545e94f3fe4c055d65ca95a9ca8fd536`). Raw XYZ, UVs, normals and triangle order remain unchanged before the existing single `[x,z,-y]` conversion. The genuine baseline part replay has a top-center ray hit at the Z=4 floor and a bottom ray hit at Z=0.

There are **no retained plate/tool meshes** or depth6/window preview packets in this capture. Full worker/controller tests use explicitly **mocked operand meshes and edited-state display data** alongside the genuine baseline part. Those tests establish software wiring and atomic state, not newly measured three-output native pictures. Production uses the actual existing samplers for all outputs. The consumer makes **zero new native calls**.

**External visual gate OPEN**: actual React interaction, three-output native display, changed-state pixels, device/GPU behavior and physical file dialogs remain separate acceptance work in [#1826](https://github.com/barocss/barocss/issues/1826). CPU replay and the scoped declaration-boundary build do not close that gate.

## Cut a slot in a bracket

<a :href="withBase('/examples/modeling-composition.ts')" download>Download the complete typed slotted-bracket example</a>

Choose **Cut a slot in a bracket** in **Modeling examples**, acknowledge replacement, then load it. The preset first fuses a32×8×8 base with an8×24×8 leg, then calls `bracket.cut(tool)` on that exact owned union result. **legWidth** edits the leg's X width. **slotX**, **slotY**, **slotWidth** and **slotSpanY** describe the rectangular through-slot. Apply commits the numeric batch only after native and display admission; Discard, Undo/Redo, refusal, cancellation and no-op behavior use the existing modeling session.

```ts
const model = cad.model(), legWidth = model.parameter('legWidth', 8);
const slotX = model.parameter('slotX', 16), slotY = model.parameter('slotY', 2);
const slotWidth = model.parameter('slotWidth', 8), slotSpanY = model.parameter('slotSpanY', 4);
const base = model.sketch.rectangle({ width: 32, height: 8 }).extrude(8);
const leg = model.sketch.rectangle({ min: [-0, 0], max: [legWidth, 24] }).extrude(8);
const bracket = base.union(leg);
const tool = model.sketch.rectangle({ min: [slotX, slotY],
  max: [model.dimension.add(slotX, slotWidth), model.dimension.add(slotY, slotSpanY)] }).extrude(8);
const initial = model.build({ bracket, slotted: bracket.cut(tool) });
const wider = initial.withParameters({ slotWidth: 12 });
```

The baseline exact integer-cell volumes are **bracket3072 and slotted2816 mm³**; `slotWidth:12` retains2688 mm³. These are restricted material volumes, not mesh-derived estimates. Empty and disconnected results refuse and leave the previous accepted snapshot usable. The provider's separate native campaign records recovery3328 and cold3200 mm³; the consumer does not resample those edited states.

Both named results remain saved. The preset explicitly selects **slotted**; generic Open selects the last validated saved output, without inferring meaning from its name. Output choice changes only visibility and never removes authoring outputs, numeric drafts or history. Renamed and final-only outputs are supported because the composed result carries its own complete, self-contained parent proof. Save stores authored intent and numeric parameters, not a prepared scene or native cache. Open rebuilds cold; it does not restore a serialized view selection.

### Bracket-slot receiver limits and evidence

This software preview accepts exactly the eight-node rectangular union → third-box difference chain, with a common Z=0..8 slab, at most5 X/Y planes and2 Z planes,16 cells,64 vertices,144 edges and64 complete panels per body. Other native-valid composed graphs remain outside this finite display boundary. The old six-node limits remain for all other modeling graphs. There is no general nested-Boolean renderer and no cap increase or partial preview.

Every named output and embedded parent is checked before acceptance. The receiver binds all three original support inventories, original0/1 contributors surviving through immediate-parent panels, original2 inward slot walls, exact reduced rational UV/XYZ charts, occupied-cell material, safe-integer volume/area and ordered raw triangles. A named parent must equal the embedded authority. The entire copied packet retains its2 MiB, occurrence/depth/string budgets; embedded and named occurrences both count. CPU picking returns actual generated face/source IDs and copied original/immediate-parent lineage in the current request context. It is an approximate sampled-triangle hit, not a new BRep edge.

The [adopted provider](https://github.com/barocss/barocss/blob/4cd5237c400784d8ce51cccbce02a22929832950/packages/barocss-cad/test/modeling-composition-evidence/verification.json) passed eight model calls and44 genuine raw Surface samples. Its2,334,314-byte research transfer includes duplicated evidence and is not a renderer DTO. The consumer separately captured only the missing14 bracket Surfaces from the exact retained body: **zero model calls, zero Boolean reconstructions**,56 vertices/28 triangles. The frozen historical runtime is tested commit `4fa8920a7f00c2bc8e78ae76664f8e957111f28f`; all268 emitted JS hashes were recovered exactly. The first attempt from the later adopted source differed in two unrelated private modules and was preserved before the corrected full-source emit. No emitted JS was hand-edited.

Together the genuine58 raw packets feed the real serializer and CPU receiver. The final compact DTO is measured in the consumer receipt, including the complete parent proof; none of the14 bracket packets is synthetic or borrowed from a signed-zero-different fixture. Raw XYZ, UVs, normals and triangle order are copied unchanged before the existing single `[x,z,-y]` conversion. Native qualification remains distinct from sampled display geometry. Controller changed-state display tests use an explicitly disclosed **baseline mock**; the producer's native edit receipts are separate evidence.

**External visual gate OPEN**: CPU rays through the opening and against material/cavity walls, receiving-realm authority, malformed transport and atomic mocked-worker tests do not establish physical WebGPU pixels, React interaction, device behavior or physical file-picker acceptance. No additional screen QA campaign is included in this software scope.

## 1. Make a plate

<<< ../../../scripts/snippets/modeling-api.ts#imports
<<< ../../../scripts/snippets/modeling-api.ts#plate

`rectangle({ width, height })` starts at XY `[0,0]`. Here its `height: depth` is the sketch's Y size, while `extrude(height)` is the solid's positive Z height. `makePlate()` returns an accepted snapshot; its named `bodies.part` output is a frozen `{family,native}` wrapper around the complete native Solid. A build requires at least one named output.

Parameter handles belong to their model. Use them directly wherever a point coordinate or dimension is accepted. A name is safe ASCII matching `[A-Za-z_][A-Za-z0-9_-]{0,47}`, excluding `__proto__`, `prototype` and `constructor`. A finite literal can be used instead of a parameter handle. Owned derived dimensions support bounded `model.dimension.add` and `model.dimension.scale` as described below. General formula strings and sketch constraints remain outside this authoring surface.

## Create and edit a round post

<a :href="withBase('/examples/modeling-circle.ts')" download>Download the complete typed round-post example</a>

Choose **Create a round post** in **Modeling examples**. Acknowledge replacement before loading it; the previous model is retained if loading refuses or is cancelled. **Diameter** and **Extrusion height** are the main fields. **Optional center coordinates** exposes center X/Y. These friendly fields appear only for the actual matching authored recipe; other imported models retain their generic numeric fields.

```ts
const model = cad.model();
const centerX = model.parameter('centerX', 2), centerY = model.parameter('centerY', -3);
const diameter = model.parameter('diameter', 8), height = model.parameter('height', 6);
const post = model.sketch.circle({
  center: [centerX, centerY],
  radius: model.dimension.scale(diameter, 0.5),
}).extrude(height);
const initial = model.build({ post });
const taller = initial.withParameters({ height: 9 });
const narrower = taller.withParameters({ diameter: 4 });
const reopened = cad.load(narrower.save());
```

The center is an XY coordinate and extrusion starts at Z=0. The owned expression `radius = diameter × 0.5` is saved as intent; there is no extra numeric radius parameter or formula text editor. Baseline center `[2,-3]`, diameter8 and height6 has native bounds `[-2,-7,0]..[6,1,6]`. Height9 changes the upper Z bound to9; diameter4 then gives `[0,-5,0]..[4,-1,9]`. These native bounds are separate from the sampled preview's measured position bounds.

Apply commits the numeric batch only after native and display admission. Discard restores accepted fields. Undo/Redo use the same history as the other presets; a no-op adds no revision/history. Save retains the graph, numeric drivers, owned expression and named `post` output, not meshes or native caches. Open rebuilds cold. The explicit preset selects `post`; generic Open still selects the last validated saved output without guessing from its name. All saved outputs are checked, including hidden ones.

### Round-post qualification and visible limits

The output is `{family:'stored-rational-circle-prism', native}`. It contains the original rational circle and three-face parent, the separate stored-boundary certificate and compiled whole-source lineage. It qualifies the **stored rational boundary**, not an ideal mathematical cylinder. **Certified volume is unavailable**. The parent's reference pi-volume/area and the sampled preview's original uncertified geometry/topology flags retain their own meanings; they are not promoted into certified mass values or an empty/zero result.

Circle radius and extrusion height must resolve to0.001..10000 mm, with generated poles inside native bounds. Exact stored cap/UV composition may still refuse otherwise plausible dimensions. The provider's decimal witness center `[.2,.2]`, diameter`.2`, height`.3` refuses with `CadModelError` NATIVE/extrude and the retained exact native GEOMETRY cause. Keep the previous snapshot on refusal; do not round, heal or retry a different chart. Circle shapes cannot enter cut, intersection, union, hole, split, chamfer or edge selection in this slice. Display also retains its own existing scene/Float32 limits and can refuse a natively valid shape.

The editor uses the genuine fixed-k4 native preview: **98 vertices, 64 triangles, three face ranges**, two closed-ring paths and one seam with two opposite uses on the same wall. Cap parameters and wall-panel UVs are the actual retained sampler values. Wall normals are native-midpoint faceted normals; no smooth/periodic claim or new sampling slider is implied. Approximate picks resolve the original cap/wall face and surface in the current request context, not a new CAD edge or certified measurement.

The original preview packet's legacy label is `right-handed-y-up`, but its position/normal arrays are **authored XYZ**. This finite adapter explicitly retains that original packet and its basis, partitions the unchanged face ranges, and sends raw XYZ arrays to the existing native-face preparation. **[x,z,-y] is applied exactly once**, with unchanged UVs and winding. The asymmetric center and height fixture verifies the transform; the old label does not establish a prior conversion. Closed-ring and repeated-seam provenance remain intact. This scope adds no visible edge-overlay system.

### Round-post evidence and remaining external gate

Adopted provider [#1677](https://github.com/barocss/barocss/issues/1677), pinned at [`65508ad8`](https://github.com/barocss/barocss/blob/65508ad878e156ddbc7426f106dd0ea7175c0655/packages/barocss-cad/src/modeling.ts), supplies the exact seven-call authoring recipe and its retained baseline. Consumer [#1683](https://github.com/barocss/barocss/issues/1683) reuses the measured **81,412-byte** native/save/summary/preview transfer, SHA256 `7338e8c36033d6a324760c9fc101d9509b73e89f223246395250c83cee6cc4e8`. Its preview contains genuine UV arrays; no reconstructed UV capture is claimed. The consumer adds no native campaign. The [provider receipt](https://github.com/barocss/barocss/blob/65508ad878e156ddbc7426f106dd0ea7175c0655/packages/barocss-cad/test/modeling-circle-evidence/verification.json) records eight model calls and one baseline preview in its first frozen campaign. They are separate from these CPU checks and do not measure full transitive work or speed savings.

The real worker serializer, receiver and scene/picker are exercised with a mocked Worker/provider replay. Only display identity/revision envelopes are rebound for replay; baseline positions, normals, UVs and ranges are preserved. Changed-state display geometry is explicitly a baseline mock, while parameter/history/refusal behavior is checked through the actual controller. CPU cap/wall rays and malformed range/UV/winding/seam/context controls are not GPU pixel evidence. Source/emitted example types and the scoped declaration-boundary build are recorded separately after execution.

**External visual gate OPEN:** actual editor browser/GPU/React interaction and physical Save/Open require external validation in #1683. Check diameter/height edits, cap and wall picks, refusal retention and reopened output on screen. Live Manual content or CPU rays alone do not complete that gate. Earlier pocket, union and hole visual gates remain separate.

## 2. Cut and chamfer the actual component

This complete example extrudes a convex pentagon and a rectangular cutter, retains both outside components, and chamfers the top/front edge of the positive-X component.

<<< ../../../scripts/snippets/modeling-api.ts#part

For the X cut, `negative` is the region on the lower-X side of the tool and `positive` is the region on its higher-X side. In this fixture they lie at `x ≤ 8` and `x ≥ upperX`. A Y cut has the corresponding lower-Y/higher-Y meaning. These names describe geometry, not volume signs, creation order, or a preferred component. The removed slab is between the tool's supports; the two outside components are separate Solids.

The cutter must cover the entire parent in its other directions. Here the tool keeps a literal height of 8 mm. Editing the parent height to 6 mm retains coverage; raising it to 10 mm refuses. This is a through-slab operation, not general Boolean subtraction or a cavity tool. An empty side cannot be a named Solid output or an operation parent.

`edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one()` describes the exact top/front X-parallel edge. `min` and `max` refer to bounds of the entire owning body; every endpoint must meet the query exactly. `.one()` records the unique-selection requirement; resolution happens when the chamfer is evaluated during build, edit or load. Zero or multiple matches refuse instead of choosing an arbitrary edge. It is a geometric query, not persistent topology naming. Edits can change which edge matches; inspect the returned native evidence when identity matters.

The chamfer uses an equal physical setback on both adjacent planes. It is not the diagonal width of the new face. Selection and setback still have to pass the native cardinal-edge, perpendicular-support and locality rules below.

## Chamfer two owned edges in sequence

<a :href="withBase('/examples/modeling-chamfer-chain.ts')" download>Download the complete typed two-chamfer example</a>

This rectangular part has two independently editable bevel distances. `frontDistance` and `backDistance` are equal physical setbacks on each edge's adjacent planes. `backY` is the **edge-selection Y coordinate**, not a bevel distance. The 32 × 24 × 8 mm blank starts at 6144 mm³.

<<< ../../public/examples/modeling-chamfer-chain.ts#two-chamfers

The first selector belongs to `blank`; the second selector is created from **`front`, the actual first chamfer result**, and is passed back to that same `front`. Do not reuse the blank's edge selector or append a second chamfer to the existing six-node cut example. This preset has four nodes: sketch → extrude → chamfer → chamfer, and one named output, `part`.

| Authored dimensions | First removed / retained (mm³) | Second removed / final (mm³) |
| --- | ---: | ---: |
| `frontDistance:1, backDistance:2` | 16 / 6128 | 64 / 6064 |
| `frontDistance:1, backDistance:3` | 16 / 6128 | 144 / 5984 |
| `frontDistance:2, backDistance:3` | 64 / 6080 | 144 / 5936 |

<<< ../../public/examples/modeling-chamfer-chain.ts#edit-chamfers

Each evaluated second chamfer resolves its selector against the first result available in that same candidate; an unchanged earlier result may be reused as described below. Saving the back-distance-3 state and loading it in a fresh process gives 5984 mm³; changing only `backDistance` back to 2 gives 6064 mm³. The independent front/back edits and authored save/load flow use the same snapshot API:

<<< ../../public/examples/modeling-chamfer-chain.ts#chamfer-workflow

In the editor, choose **Two chamfers on a part** under **Modeling examples**, acknowledge replacement and load. The fields explicitly distinguish the front/back bevel distances from `backY`, the edge-selection coordinate. Picker changes only configure a new example and clear the acknowledgment. A successful load replaces the old history and pending dimensions; refusal or cancellation retains the previous accepted scene, graph, drafts and history. Existing cut/chamfer, intersection and X/Y/Z split presets remain available.

### Two-chamfer limits and refusal

Only **two serial chamfers** are admitted, with the second parent and its selector owned by the actual first result. Sibling branches, a third chamfer and stale/foreign/copied selectors refuse. The total remains six nodes. This example demonstrates a directly extruded rectangle with opposite, noninteracting top edges; its original evidence does not establish a split/intersection plus two-chamfer combination, arbitrary-edge chamfer, fillet or topology remapping. The separately verified split-after-chamfer recipe is described below.

The existing native restrictions still apply: adjacent supports must be perpendicular signed world-axis planes; endpoints need the supported perpendicular end planes; positive local setbacks must satisfy the exact representation, qualification and work bounds. Being selectable does not prove an edge is chamferable.

Starting from `makeTwoChamferPart()` with `frontDistance:1`:

- `backY:0` asks for the original front/top edge, already removed by the first chamfer. It refuses with `CadModelError` code `SELECTION`, operation `chamfer`, rather than remapping to a nearby edge
- `backY:1` selects the new bevel/top edge, whose adjacent bevel support is not cardinal. It refuses with `NATIVE` / `chamfer`, preserving the original `ConvexPlanarSolidChamferError` cause with code `METRIC` and stage `chamfer`
- `backDistance:0` refuses with `PARAMETER` / `chamfer`; positive finite distance is required

All three preserve the prior accepted snapshot and saved text. Keep the actual error and its native cause rather than turning it into a successful approximation:

<<< ../../public/examples/modeling-chamfer-chain.ts#refused-chamfer

The [adopted two-chamfer source](https://github.com/barocss/barocss/blob/63f74623ddef0f44f9c6056c3e0b162e3f429f69/packages/barocss-cad/src/modeling.ts), [exact public fixture](https://github.com/barocss/barocss/blob/63f74623ddef0f44f9c6056c3e0b162e3f429f69/packages/barocss-cad/test/modeling-chamfer-chain-fixture.mjs) and [native receipt](https://github.com/barocss/barocss/blob/63f74623ddef0f44f9c6056c3e0b162e3f429f69/packages/barocss-cad/test/modeling-chamfer-chain-evidence/verification.json) record 8 model evaluations and 1 final-part tessellation, including fresh emitted load/re-edit. Each stage's removed-plus-retained volume is conserved, and the second native parent is exactly the first retained result. Provider counters cover direct work only; full transitive native coverage was not measured.

Lightweight tracing compares the same nine parameter/rectangle/extrude/edge/chamfer authoring calls and final named output in the editor, this download and the provider fixture. The unchanged 41,471-byte genuine baseline DTO is replayed through the actual controller/CPU scene with a mocked Worker. This establishes transport, output identity and approximate CPU picking, not new native execution or actual sample-worker/browser/GPU execution. Editor browser/GPU and physical file dialogs remain **UNRUN** in this consumer check; live manual deployment is a separate gate.

## Cut an underside pocket or through-window

<a :href="withBase('/examples/modeling-pocket.ts')" download>Download the complete typed underside-pocket example</a>

In the editor's **Model a part** route, choose **Cut an underside pocket** (`underside-pocket`), acknowledge replacement, then load it. The exact `recessedPlate` recipe creates `toolX:8`, `toolY:8`, `toolWidth:16`, `toolSpanY:8`, `depth:4` in that order. A 32 × 24 × 8 mm plate and the rectangular tool both begin at **Z=0**. The tool's upper XY corner uses owned `add` dimensions, and `plate.cut(tool)` returns the retained part. This is an underside-entry recess; it is not a top-entry pocket or a buried cavity. The old two-argument `cut(tool,{axis})` still returns its through-slab pair.

<<< ../../public/examples/modeling-pocket.ts

Edit the tool origin X/Y, X width, Y span and positive Z depth. Baseline depth4 retains **5632 mm³**; depth8 creates a through-window retaining **5120 mm³**. The provider also measured depth6 at5376 mm³. Apply uses the existing atomic parameter transaction, with Undo/Redo and refusal retention. Pending drafts require Apply or Discard before replacing the example. A refused empty or multiple-body candidate keeps the accepted part, saved text and history.

The preset selects `part`. `build({plate,tool,part})` preserves all three authored outputs; canonical saved order is `part,plate,tool`. Generic Open initially selects `tool`; choose `part` to inspect the pocket. This is not view restoration. The chooser changes only the displayed output, without changing dimensions, revision, history or saved outputs. Hidden plate/tool geometry cannot cover the opening, and all outputs are validated before any output tessellation. Files with another output map retain generic chooser wording.

### Material, panels and receiving checks

The `orthogonal-cell` result has exact positive safe-integer volume under its restricted integer-box contract. The adapter binds the trusted authored `difference` node to the same native operation, uses `insideA && !insideB`, and checks complete cell/signed-shell volume conservation with safe-integer products. It does not infer material from an output's name. Empty and multiple-body results are refused. This does not add arbitrary curved Boolean support or manufacturing-tolerance certification.

The complete preview ceiling is **64 panels**, distinct from the provider's72-panel limit. A 65-panel candidate refuses before any output tessellation; no truncation. Baseline has46 panels and the window32. Tool-contributed walls and the pocket ceiling retain `relativeOrientation:-1` against the original cutter faces. Ordered native pcurve cycles, four distinct UV corners, native vertex order, outward material winding and original Source0/model/surface/face lineage are preserved without array repair. Raw `part-xyz` coordinates pass through `[x,z,-y]` exactly once; approximate triangle picks retain generated-panel and contributing-operand identities.

### Evidence and open visual gate

The [adopted provider](https://github.com/barocss/barocss/blob/deced366e75be0f27a02602d7655c555d7f6167e/packages/barocss-cad/test/modeling-box-cut-evidence/verification.json) records its original eight-model campaign. After the unpublished consumer workspace was lost, a separately authorized replacement run generated fresh fixtures with **two model calls, one CPU preparation, one Boolean reconstruction and46 panel tessellations**. Those new baseline/window bytes match the historical transfer hashes. The historical consumer acceptance is not reused for reconstructed source.

The baseline retains actual helper position/normal/index arrays,184 vertices and92 triangles. The helper did not retain sampled UV arrays: replay copies the original native pcurve coefficients with exact identity/order checks and labels the raw packet adapted. The window is a genuine native body with **no retained tessellation**; its CPU projection is explicitly topology-derived. Convex operand fan projection uses a native-validation stub. Controller changed-state geometry is mocked except the exact baseline and the topology-derived depth8 window. These focused receiving-realm tests are not another native campaign.

CPU rays hit the baseline underside ceiling atZ4, the top atZ8 and inward side walls; rays through the window center miss from above and below, while the surrounding rim remains hittable. Malformed UV/cycle/winding, operation/volume mismatch, hidden-output tampering, stale context and cloned authority are refused. Source/emitted type checks and the qualified package-boundary build are separate software gates.

**External visual gate OPEN** in [#1653](https://github.com/barocss/barocss/issues/1653): actual editor browser/GPU/React interactions and physical Save/Open dialogs still need external screen verification. Live Manual verification proves documentation delivery only. The existing [hole](https://github.com/barocss/barocss/issues/1644), [union](https://github.com/barocss/barocss/issues/1647) and [wider renderer](https://github.com/barocss/barocss/issues/1119) gates remain separate.

## Fuse two rectangular extrusions

<a :href="withBase('/examples/modeling-union.ts')" download>Download the complete typed L-bracket example</a>

Choose **Fuse an L-bracket** (`union-bracket`) in **Modeling examples**, acknowledge replacement and load. This is the exact producer `unionBracket` recipe: a 32 × 8 mm base extruded 8 mm, plus a leg whose minimum is `[legMinX,legMinY]`, maximum is `[add(legMinX,legWidth),24]`, and extrusion height is `legHeight`. The four numeric fields distinguish the leg origin X/Y, width and extrusion height. The initial origins are signed `-0`, width is 8 mm and extrusion height is 8 mm. Moving the leg's minimum Y changes its length because its maximum Y remains 24 mm.

<<< ../../public/examples/modeling-union.ts#union-bracket

`base.union(leg)` takes two distinct direct rectangular XY extrusions owned by the same model. The five nodes are sketch → extrude, sketch → extrude, then union. `build({ base, leg, bracket })` retains all three output references. Importing the download does not evaluate or tessellate anything; invoke its functions only when native work is intended.

### Exact material volume and generated face identity

Both operands have `family: 'convex-planar'`; `bracket` has `family: 'orthogonal-cell'`. Narrow the family before reading the complete frozen native value.

<<< ../../public/examples/modeling-union.ts#qualified-union-output

The baseline union has exact restricted integer-cell volume **3072 mm³**: three occupied cells, one body and one shell, with 14 generated panels, 14 generated sources, 16 global native vertices and 28 global native edges. The editor represents its positive safe-integer volume as numerator `3072`, denominator `1`. This is the provider's integer-cell/oriented-shell material qualification, separate from derived preview triangles and approximate CPU picking. The hole family's **Certified volume unavailable** state remains `volumeMM3:null`; union volume is not substituted into it.

The private native bridge builds a new source-qualified box representation of each authored rectangle. A generated union panel identifies its body, shell, panel, source, model, surface and face, plus **every contributing operand face** with its source/shell/global-face/local-face/surface identity and exact rational UV corners. These generated operand faces are not the original convex parents' face IDs. A face hit reports that generated panel/source and all contributing native operand faces; it does not promise persistent naming across edits or an exact material-classifier result.

### Widen, join, refuse and recover

The following values were measured by the [frozen #1645 provider receipt](https://github.com/barocss/barocss/blob/16535777b4ef2d5ace64b97dbf834f6aff3d6425/packages/barocss-cad/test/modeling-union-evidence/verification.json), rather than inferred from editor preview tests:

| Accepted state | Edit from the preceding accepted state | Exact volume (mm³) | Generated panels |
| --- | --- | ---: | ---: |
| Baseline L-bracket | `legMinX:-0, legMinY:-0, legWidth:8, legHeight:8` | 3072 | 14 |
| Wider leg | `legWidth:12` | 3584 | 14 |
| Face-contact join | `legMinY:8` | 3584 | 14 |
| Recovery after both refusals | `legWidth:8, legMinY:-0` | 3072 | 14 |
| Fresh cold Open | Saved recovery state | 3072 | 14 |
| Taller stepped bracket after Open | `legHeight:16` | 4608 | 20 |

<<< ../../public/examples/modeling-union.ts#refused-union
<<< ../../public/examples/modeling-union.ts#edit-union

From the face-contact state, `legMinX:32` creates edge-only contact and refuses with `CadModelError` code `NATIVE`, operation `union`, and the original `AxisBoxSolidBooleanError` cause `CONTACT`. `legMinX:40` creates two disconnected bodies: the provider completes its native result, then the single-body authoring contract refuses with `SELECTION` / `union`, retaining that complete result as the cause. No component is silently chosen or dropped. Both refused candidates leave the same accepted face-contact snapshot, saved text and future reuse intact. Recovery is applied to that accepted snapshot.

Width/origin edits reuse feature indices 0 and 1 and evaluate 2, 3 and 4. The cold taller edit reuses 0, 1 and 2 and evaluates 3 and 4. Every evaluated union rebuilds its box assets even if an original convex parent was reused. These indices describe model-feature reuse, not total native-call savings or a performance guarantee.

### Select the bracket after Open

The preset explicitly selects `bracket` by its configured output ID. Generic Open preserves the existing policy: choose the last entry in the validated canonical saved output inventory. This file saves the outputs in `base, bracket, leg` order, so **Open initially selects `leg`; choose `bracket` in the output chooser** to inspect the union. The chooser displays the selected ID and family. This is not view restoration or a name-based guess.

All three outputs remain in the accepted summary and authored Save, including hidden operands. Every output is admitted before visibility is chosen. Choosing an output is a view-only display swap: it does not create a model revision or Undo/Redo entry, discard numeric drafts, or rewrite the file. Edits, Undo/Redo and Worker reconstruction retain the current choice when it still exists. A failed, cancelled or stale preparation retains the accepted model, scene, selection, drafts and history. Successful replacement still follows the existing acknowledgement and Apply/Discard rules.

<<< ../../public/examples/modeling-union.ts#save-reopen-union

Save contains the schema1 authored `union`, all four numeric drivers (including signed zeros), five nodes and three output references. It contains no native bodies, native IDs, mesh cache or prepared scene authority. `cad.load(saved)` rebuilds cold. The producer measured the recovered 3072 mm³ state reopening unchanged and then the taller 4608 mm³ result. The APIs do no filesystem I/O; physical Download → fresh picker Open remains a separate acceptance check.

### Complete native-panel preview, with a narrower display bound

The editor software adapter in [#1647](https://github.com/barocss/barocss/issues/1647) uses the existing modeling controller, output chooser and renderer. The Worker preflights **all outputs before any output tessellation**, including hidden operands, one-body union identity, complete panel/source inventories and the **64 complete generated panels** display ceiling. The native provider's maximum is **72 panels**. A 65-panel candidate refuses before any tessellation; never truncate or merge panels to evade the display limit.

At runtime each qualified native panel surface goes through `tessellateSurface` with `countU:2, countV:2`. Its genuine raw `part-xyz` packet is checked against native source/model/surface/face identity, native vertex association and order, pcurve endpoint UVs, normals and winding before copying plain arrays. The receiving adapter applies the existing `prepareKernelFacePreview` conversion `[x,z,-y]` exactly once. Full native objects and prepared authority do not cross the Worker boundary. Copied qualification, complete global topology and lineage remain distinct from the preview.

The receiving side checks every output, including hidden operands, and matches the authored output node, family, counts, positive safe-integer volume, identities and request document/revision/task context. Missing, duplicate or extra panels, forged family downgrades, stale references and cloned prepared scenes refuse. The display retains **1 scene unit = 1 mm** and the existing ±1000 scene-coordinate envelope. Native admission alone does not guarantee display admission; there is no automatic rescaling or substitute renderer.

### Connected-union limits and evidence boundary

Both operands must be distinct direct **authored rectangles**, not polygons that happen to look rectangular. Resolved corners must be integers within ±10000 mm; integer side lengths and positive extrusion heights are 1–10000 mm. Both extrusions start at Z=0. Parameters and owned add/scale dimensions are allowed when their resolved values satisfy these rules. Only one connected positive-volume union is admitted within the six-node envelope. Union nesting, edge queries on the union, mixed chamfer/split/cut/intersection/hole graphs, arbitrary solids, manufacturing tolerance and general Boolean support are outside this slice.

The [adopted provider](https://github.com/barocss/barocss/issues/1645), pinned at `16535777b4ef2d5ace64b97dbf834f6aff3d6425`, retains the [exact public fixture](https://github.com/barocss/barocss/blob/16535777b4ef2d5ace64b97dbf834f6aff3d6425/packages/barocss-cad/test/modeling-union-fixture.mjs) and its measured **8 model calls and 1 CPU preparation** in 3.534 seconds. That preparation includes **1 full Boolean revalidation and 14 panel tessellations**, producing 56 display vertices and 28 triangles. These counts cover the recorded bounded campaign; full transitive native work was not measured. The 524,722-byte genuine baseline transfer is SHA256 `ad9ac80fa7e48e598116ba2d9e5ab37b597e9f3e15081e98513aea3479d81e06`.

Consumer CPU replay adapts the retained helper positions/normals/indices only after checking its identity transform, native coordinates, native vertex order, indices and normals. The original tessellation UV arrays were not retained: replay copies matching genuine native pcurve endpoint coefficients in the known tessellation order. This is an **adapted replay**, not a newly measured raw packet. Convex operand previews use the real graph-derived fan algorithm with the native validator explicitly stubbed; they are not claimed as retained measured meshes. Changed-state meshes are mocked. The consumer adds **zero native model, validation or tessellation calls** to this verification campaign. Runtime projection still uses the real native tessellators.

The documentation checker verifies static recipe/receipt provenance and all 22 prior download bytes, and offers source/emitted typechecks for eleven public examples/snippets. It never executes the examples or native geometry. The separate CPU/controller suites cover L-interior hits, the missing upper-right quadrant, complete provenance and atomic state behavior; their exact run results belong in the consumer receipt.

**External visual gate OPEN:** actual editor browser/GPU pixels, React interaction and physical file-dialog acceptance remain **UNRUN** by these software checks. [#1647](https://github.com/barocss/barocss/issues/1647) keeps that gate open after software/Manual adoption; the prior hole gate [#1644](https://github.com/barocss/barocss/issues/1644) remains separate. Broader renderer [#1119](https://github.com/barocss/barocss/issues/1119) and roadmap [#534](https://github.com/barocss/barocss/issues/534), [#535](https://github.com/barocss/barocss/issues/535), [#551](https://github.com/barocss/barocss/issues/551) are not closed by CPU replay or Manual DOM readback. A bounded declaration-boundary editor build, exact-source Manual deployment and registry publication are separate outcomes; no new native or broad build campaign is implied.

## Intersect two extrusions into an overlap part

<a :href="withBase('/examples/modeling-intersection.ts')" download>Download the complete typed overlap example</a>

Use `blank.intersect(tool)` when the useful part is the common positive-volume region. Both operands must be distinct direct XY extrusions owned by the same model. This example intersects the same convex pentagonal blank with a 4 mm-high rectangle; it does not require through-slab coverage.

<<< ../../public/examples/modeling-intersection.ts#overlap

The sole named output is `snapshot.bodies.overlap`. Its exact expected volume is **2176 mm³**. Move the tool with one batch of X-bound edits; the resulting expected overlap volume is **1408 mm³**. Parameter values are absolute millimetres, so editing just one bound also changes the rectangle width.

<<< ../../public/examples/modeling-intersection.ts#edit-overlap

Call `shifted.save()` and pass that text to `reopenOverlap`. A returned snapshot and its named outputs remain immutable while a candidate rebuild is evaluated. Reopening repeats the native operation; it does not load a display cache. The downloadable `overlapWorkflow()` combines construction, batch edit, save, reopen and a 2 mm-height edit. Its typecheck is distinct from runtime execution.

Only one intersection is admitted. No cut-plus-intersection, repeated/nested intersection, same-handle self-intersection, union or arbitrary Boolean operation is implied. Native exact XYZ/UV representability, source charts, qualification and work budgets still apply. An intersection followed by chamfer is not demonstrated by this example.

A disjoint or touching-only result cannot be a Solid output. It throws `CadModelError` with code `SELECTION`, operation `intersect`, and an explicit native contact dimension (-1 for disjoint; 1/2 for touching in these positive-Z extrusions, with point contact dimension 0 reserved to the lower-level provider). Keep the previously accepted snapshot instead of inventing an empty body. Native qualification failures retain code `NATIVE` and the original cause; they are not converted into an empty result.

<<< ../../public/examples/modeling-intersection.ts#refused-overlap

In the editor, open **Modeling examples**, choose **Intersect two extrusions**, acknowledge replacement and load the example. Changing the selection alone does not replace the accepted model. A successful load replaces its history and pending dimensions; a refused or cancelled load keeps them. The original **Cut and chamfer a part** example remains the default, and Save/Open continues to use the original compatibility readers for legacy files.

The [current intersection source](https://github.com/barocss/barocss/blob/45f6687692b97ab245a15b27e85658c3c0a154d2/packages/barocss-cad/src/modeling.ts) and [native receipt](https://github.com/barocss/barocss/blob/45f6687692b97ab245a15b27e85658c3c0a154d2/packages/barocss-cad/test/modeling-intersection-evidence/verification.json) record **2176 → 1408 → fresh-process 1408 → height 2: 704 mm³**. Lightweight tracing establishes the same 11 public authoring calls, including signed zero, in the editor, this download and the provider fixture. The actual baseline native transport then passes the real controller and CPU picking. This is preserved native evidence plus a mocked-Worker replay; it is not a new execution of the sample worker or a browser run.

The engine dependency is [intersection #1614](https://github.com/barocss/barocss/issues/1614); the editor/manual consumer is [#1617](https://github.com/barocss/barocss/issues/1617). Source/type/controller validation does not establish browser/GPU pixels, physical Download → fresh picker Open → re-edit, manual deployment or npm publication. Those remain **UNRUN** until separately recorded.

## Split a part into lower and upper bodies

<a :href="withBase('/examples/modeling-split.ts')" download>Download the complete typed split-body example</a>

Use `blank.split({ axis: 'z', at: splitHeight })` to divide one direct XY extrusion at an editable Z height. `negative` means the region at `z ≤ at`; `positive` means `z ≥ at`, regardless of sketch winding. The two closed Solids meet at the split plane. Name them when building the model:

<<< ../../public/examples/modeling-split.ts#split-part

The accepted outputs are `snapshot.bodies.lower` and `snapshot.bodies.upper`. At `splitHeight: 2`, their exact volumes are **1792 / 5376 mm³**, with Z bounds **[0,2] / [2,8] mm**. Their `native` values are distinct bodies, not aliases of the original extrusion. Their total volume remains **7168 mm³**.

<<< ../../public/examples/modeling-split.ts#edit-split

`bisectPart(initial)` moves the plane to 4 mm, producing **3584 / 3584 mm³**. Save that snapshot, reopen its authored text, then call `raiseSplit(reopened)` to move the plane to 6 mm: **5376 / 1792 mm³**. The complete `splitPartWorkflow()` in the download shows this sequence. Each successful edit returns a new snapshot; the prior bodies and saved text remain unchanged.

The two-output example requires `0 < splitHeight < height`. At or beyond either end, one requested side is empty, so the rebuild refuses with `CadModelError` code `SELECTION`, operation `split`. Its original cause identifies `side`, native `status` and `sectionDimension` (-1 for outside, 2 for these tangent planes). Keep the previous snapshot, including both named outputs:

<<< ../../public/examples/modeling-split.ts#refused-split

A caller may instead build only a genuinely nonempty side from an outside/tangent split; that returns the provider's actual unchanged parent body. The two-output example never substitutes that side for an empty request. Other exact qualification/chart/budget failures remain native refusals with their original cause.

In **Modeling examples**, choose **Split a part**, keep **Z · lower / upper**, acknowledge replacement and load it. The original cut/chamfer default and overlap choice remain available. The existing controller owns replacement, cancellation, drafts and history; lower/upper flow through the same named-output display and selection path. A refused or cancelled load preserves the previously accepted model and pending dimensions.

This Z example splits a direct XY extrusion horizontally. The current API also supports X/Y planes as described next. A model may contain one split OR one cut OR one intersection, not a mixture. The fixed `plane: 'x+y'` miter has its own example below; arbitrary oblique planes and repeated/nested splits remain unsupported. The separate beveled-part example below extends split parents to one/two owned chamfers rooted at a direct extrusion. This example does not demonstrate chamfering a split side.

The [split source](https://github.com/barocss/barocss/blob/142f4e5d745e1494771a530e293b374d1d29bcb2/packages/barocss-cad/src/modeling.ts) and [native receipt](https://github.com/barocss/barocss/blob/142f4e5d745e1494771a530e293b374d1d29bcb2/packages/barocss-cad/test/modeling-split-evidence/verification.json) record the baseline, edit and fresh-process results above. Lightweight tracing compares the exact five parameter/sketch/extrude/split calls and named output mapping of this download, the editor and the provider fixture, including signed zero. The provider's two genuine baseline tessellations are replayed through the actual controller with a mocked Worker; both CPU geometries and approximate CPU picks retain their lower/upper identities. This is not a second native execution or an editor browser/GPU test.

Provider [#1619](https://github.com/barocss/barocss/issues/1619) and consumer [#1620](https://github.com/barocss/barocss/issues/1620) track their own evidence. Typed download checks, native producer evaluation, controller replay, actual browser/GPU pixels, physical file-picker acceptance, manual deployment and npm publication are separate gates; unexecuted gates remain **UNRUN**.

### Choose an X or Y split plane

<a :href="withBase('/examples/modeling-cardinal-split.ts')" download>Download the complete typed X/Y split example</a>

Use the same `split({ axis, at })` operation with world axis `'x'` or `'y'`. For closed outputs, `negative` occupies coordinates `≤ at` and `positive` coordinates `≥ at`; both include their shared boundary plane. Names describe the selected coordinate, not volume signs or screen-left/screen-right.

<<< ../../public/examples/modeling-cardinal-split.ts#cardinal-part

Call `makeCardinalSplit('x')` for an X plane, or `makeCardinalSplit('y')` for a Y plane. With `splitAt: 16`, both fixtures have **negative / positive = 4096 / 3072 mm³**. The X fixture's coordinate bounds are **[0,16] / [16,32] mm**. Moving either plane to 24 mm produces **5888 / 1280 mm³**; the total remains **7168 mm³**.

<<< ../../public/examples/modeling-cardinal-split.ts#edit-cardinal

`cardinalSplitWorkflow()` in the download performs the measured X construction → coordinate 24 → save → reopen → coordinate 16 sequence. The saved graph retains its axis, and the restored X outputs return to **4096 / 3072 mm³**. Changing a parameter moves the plane; it does not change the axis or swap the named output mapping.

In **Modeling examples → Split a part**, choose **X · negative / positive** or **Y · negative / positive**. The selector is explicitly for a **new example**. Changing it does not edit the accepted part, scene, pending dimensions or history, and it clears any replacement acknowledgment. A successful acknowledged load creates the selected example and resets its history. A refused or cancelled load retains the previous model, including its authored axis. The default Z choice still uses the exact `height`/`splitHeight` recipe and `lower`/`upper` names above; X/Y use `splitAt`, `rearX`, `height` and `negative`/`positive`.

Exact native representation still matters. On this **X** fixture, setting `rearX: 20` and `splitAt: 24` makes the sloped edge crossing require `Y = 80/3`, which is not exactly representable in binary64. The measured result is `CadModelError` code `NATIVE`, operation `split`, with original cause `ConvexPlanarSolidSplitError`, code `REPRESENTABILITY`, stage `crossing-representability`. Keep the old snapshot; do not snap or approximate the crossing.

<<< ../../public/examples/modeling-cardinal-split.ts#refused-cardinal

Outside/tangent empty-side requests retain the same `SELECTION` behavior as Z. This plain preset offers world X/Y/Z planes on a direct XY extrusion; the fixed `x+y` miter is a separate preset below. Arbitrary oblique planes, nested splits and mixed cut/intersection/split graphs remain unsupported. Split-after-chamfer has its own bounded example and evidence below.

The [cardinal split source](https://github.com/barocss/barocss/blob/72ba5eb5ba54a94666812ce99ebf5c10fd3f7290/packages/barocss-cad/src/modeling.ts) and [native receipt](https://github.com/barocss/barocss/blob/72ba5eb5ba54a94666812ce99ebf5c10fd3f7290/packages/barocss-cad/test/modeling-cardinal-split-evidence/verification.json) record the X/Y construction/edit results and fresh-process X sequence. Exact six-call authoring traces and output mappings match this download, the editor and the provider fixture for both X and Y. The genuine X baseline transport passes the existing controller and both negative/positive CPU picks. Y uses the producer's real native evidence plus authored recipe/routing/type checks, not a fabricated Y transport replay. No additional native campaign or editor GPU execution is implied.

Provider [#1622](https://github.com/barocss/barocss/issues/1622) and consumer [#1623](https://github.com/barocss/barocss/issues/1623) retain separate receipts. Actual editor browser/GPU pixels, physical file-picker acceptance and npm publication remain **UNRUN** by these checks; deployment is recorded separately.

## Split a finished beveled part

<a :href="withBase('/examples/modeling-chamfer-split.ts')" download>Download the complete typed beveled-part split example</a>

Chamfer the front and back top edges of a 32 × 24 × 8 mm rectangle, then split the **actual second chamfer result**. The second edge selection belongs to the first result. The split outputs belong to the finished part, not the original blank:

<<< ../../public/examples/modeling-chamfer-split.ts#beveled-split

`makeBeveledSplit('x')` starts at X16. `makeBeveledSplit('z')` starts at Z4. Both keep the same two bevels, with independent `frontDistance` and `backDistance` parameters. `splitAt` is the selected-axis **split coordinate**, not a bevel distance. The names `negative` and `positive` describe the lower/higher-coordinate sides, each including the shared boundary plane. The five authored features are sketch, extrusion, front chamfer, back chamfer and split.

| State | negative / positive (mm³) | Reused / evaluated model features |
| --- | --- | --- |
| Initial two-chamfer X16 | 3032 / 3032 | none / 0, 1, 2, 3, 4 |
| From initial, `splitAt:8` | 1516 / 4548 | 0, 1, 2, 3 / 4 |
| Then `backDistance:3` | 1496 / 4488 | 0, 1, 2 / 3, 4 |
| Cold reopen of X8/back3 | 1496 / 4488 | none / 0, 1, 2, 3, 4 |
| Reopened, `splitAt:16` | 2992 / 2992 | 0, 1, 2, 3 / 4 |
| Independent two-chamfer Z4 | 3072 / 2992 | none / 0, 1, 2, 3, 4 |

<<< ../../public/examples/modeling-chamfer-split.ts#edit-beveled-split

The complete `beveledSplitWorkflow()` performs the measured X sequence. Feature reuse is the existing private-prefix mechanism: moving the split preserves the finished bevel prefix, while changing the second bevel evaluates that bevel and the split. These arrays count model features, not elapsed time or all transitive native calls. The editor still tessellates accepted output bodies; saved files contain authored intent and reopen cold.

Starting from the accepted X8 snapshot, `splitAt:40` requests an empty positive side and throws `CadModelError` code `SELECTION`, operation `split`. Its original cause reports `side:'positive'`, `status:'outside'`, `sectionDimension:-1`. The previous saved text, bodies and evidence stay unchanged; the measured back-distance edit above succeeds from that same retained snapshot after refusal. Keep the actual error rather than fabricating an empty Solid:

<<< ../../public/examples/modeling-chamfer-split.ts#refused-beveled-split

In **Modeling examples**, select **Split a beveled part**. This new choice initializes **X · negative / positive**; choose **Z · negative / positive** for the Z4 recipe. Only X/Z are offered for this two-chamfer preset. The existing plain **Split a part** still offers X/Y/Z, including its unchanged Z `lower`/`upper` recipe. Axis or preset selection clears replacement acknowledgment without changing the accepted scene, dimensions, drafts or history. An acknowledged successful load resets history atomically; a refused or cancelled load preserves it. Apply, Undo/Redo and authored Save/Open use the same controller.

The current API accepts a split parent that is a direct extrusion or **one/two owned serial chamfers ultimately rooted at that extrusion**, subject to native qualification. The six-node total and one cut OR intersection OR split remain. Nested/repeated splits, cut/intersection-rooted chamfer chains, sibling/side jumps and arbitrary planes are unsupported. Chamfer perpendicular-support/locality and exact native representation limits still apply. The producer also measured a **separate one-chamfer Y12** case at 3056 / 3072 mm³; that is not a two-chamfer Y witness and is not silently substituted by this preset.

The [adopted split-after-chamfer source](https://github.com/barocss/barocss/blob/3a7b7ea2712c739f1d7bbc8774301f821027e9e6/packages/barocss-cad/src/modeling.ts), [exact dividedRail fixture](https://github.com/barocss/barocss/blob/3a7b7ea2712c739f1d7bbc8774301f821027e9e6/packages/barocss-cad/test/modeling-chamfer-split-fixture.mjs) and [native receipt](https://github.com/barocss/barocss/blob/3a7b7ea2712c739f1d7bbc8774301f821027e9e6/packages/barocss-cad/test/modeling-chamfer-split-evidence/verification.json) record 8 model calls and 2 baseline output tessellations, exact split-parent/source lineage and opposed section-cap uses. Full transitive native coverage was not measured.

Lightweight tracing compares the same ten public authoring calls and output references in the editor, download and provider fixture for X16 and Z4. The unchanged 82,509-byte genuine X16 transport is replayed through the actual controller with a mocked Worker, checking two CPU geometries and approximate picking of both named outputs. Z has provider-native evidence plus recipe/routing/type checks; it does not have a fabricated transport replay. No extra native campaign or actual sample-worker execution is implied. Provider [#1631](https://github.com/barocss/barocss/issues/1631) and consumer [#1632](https://github.com/barocss/barocss/issues/1632) retain separate evidence. Editor browser/GPU, physical file-picker flows and npm publication remain **UNRUN** by these checks; manual deployment is recorded separately.

## Keep a beveled split centered as width changes

<a :href="withBase('/examples/modeling-dimensions.ts')" download>Download the complete typed centered-split example</a>

A split coordinate can follow other dimensions without becoming another editable field. This recipe fixes the X plane at **width × 0.5 + offset**: widening the rail keeps the cut centered, while `offset` moves it relative to that center. It uses the same two owned chamfers and names both split outputs:

<<< ../../public/examples/modeling-dimensions.ts#centered-split

`model.dimension.scale(width, 0.5)` scales a length by a finite numeric, dimensionless factor. `model.dimension.add(..., offset)` adds two millimetre lengths. Each returns an opaque, frozen expression owned by that exact model. Pass it wherever a `CadDimension` is accepted; do not copy an expression or borrow one from another model. The expression is authored intent, not another feature node or a named numeric parameter.

In **Modeling examples → Keep a beveled split centered**, acknowledge replacement and load. The only numeric drivers are `width`, `offset`, `frontDistance` and `backDistance`. Width is the rail's X size; offset is the X displacement from its center. There is no `splitAt` input, axis switch or formula text editor for this preset. The existing **Split a beveled part** keeps its independent X/Z coordinate recipes unchanged. Picker changes, loading, drafts, cancellation, history and authored Save/Open retain their existing atomic behavior.

| Accepted state | Derived X plane (mm) | negative / positive (mm³) |
| --- | --- | --- |
| width32 / offset0 | 16 | 3032 / 3032 |
| offset4 | 20 | 3790 / 2274 |
| then width40 | 24 | 4548 / 3032 |
| offset0 after refusal | 20 | 3790 / 3790 |
| referenced offset−0, then fresh cold reopen | 20 | 3790 / 3790 |
| reopened, offset4 | 24 | 4548 / 3032 |

<<< ../../public/examples/modeling-dimensions.ts#edit-centered-split

Changing only `offset` reuses model features 0–3 and evaluates the split at index4. Changing `width` evaluates all five features because the sketch depends on it. Changing a referenced `offset` from +0 to −0 conservatively reevaluates the split even when the final plane is numerically identical. Authored zero signs are preserved, but ordinary IEEE addition/multiplication rules determine each computed result. Compare parameter key sets and values; insertion order is not an API promise. The saved file retains the formula tree and driving values, without evaluated geometry or a private reuse frame. Fresh `cad.load` evaluates all features; the editor still tessellates accepted outputs.

From the accepted width40/offset4 snapshot, `offset:40` puts the plane at X60 and requests an empty positive side. The measured result is `SELECTION` / `split` with the original positive/outside/sectionDimension−1 cause. The previous save, bodies and future reuse remain intact; offset0 succeeds from that same snapshot afterward:

<<< ../../public/examples/modeling-dimensions.ts#refused-centered-split

### Derived-dimension limits

Only add and scale are exposed. There is no string parser, `eval`, division, arbitrary function or scalar-parameter family. Scale's factor is a finite numeric scalar; negative and zero factors are allowed, while the resulting length must still satisfy the consuming operation. Length literals, referenced parameters and every intermediate/result must be finite and within **±10000 mm**. Resolution uses deterministic left-to-right/postorder JavaScript binary64 arithmetic, with no clamping or reassociation; overflow or an out-of-range intermediate refuses before native evaluation.

Each dimension allows at most **32 expression-tree nodes and depth6**, counting every literal/parameter/operator occurrence and repeated subtree occurrence. Formula validation precedes native evaluation and cache reuse. The existing six-feature, one cut/intersection/split, file-size, input-depth and native exactness limits still apply. Saving records only strict add/scale structure; unknown fields/operators, foreign or forged handles and malformed records refuse. Existing numeric/parameter files remain supported; legacy readers do not reinterpret formula records.

The [derived-dimension source](https://github.com/barocss/barocss/blob/d9d0aa93fdaf6700fd30282bc91656e40e59baf1/packages/barocss-cad/src/modeling.ts), [exact derivedRail fixture](https://github.com/barocss/barocss/blob/d9d0aa93fdaf6700fd30282bc91656e40e59baf1/packages/barocss-cad/test/modeling-dimensions-fixture.mjs) and [native receipt](https://github.com/barocss/barocss/blob/d9d0aa93fdaf6700fd30282bc91656e40e59baf1/packages/barocss-cad/test/modeling-dimensions-evidence/verification.json) preserve **9 observed model calls and 1 negative-body tessellation across two attempts**. The six source calls passed. The first cold call built successfully before a test-only parameter-key-order assertion failed; the corrected two-call emitted retry then passed. Runtime source was unchanged. This is not a first-run eight-call pass or a native timing claim.

Consumer tracing matches all13 public construction calls and nested formula ownership across editor/download/provider. Both output volumes and geometry come from provider-native results. The actual new baseline save/summary/negative mesh is preserved (41,830 bytes). Its full native-body hash equals the earlier #1631 baseline; after verifying that pinned parity, the CPU test combines it with that earlier positive mesh. This is an explicitly **geometry-equivalent adapted transport replay** through the real controller with a mocked Worker, not a new two-body tessellation or sample-worker run. Both original input hashes remain recorded. Provider [#1634](https://github.com/barocss/barocss/issues/1634) and consumer [#1635](https://github.com/barocss/barocss/issues/1635) retain separate receipts. Editor browser/GPU/React interaction, physical file-picker flows and npm publication remain **UNRUN** by these checks; manual deployment is separate.

## Split a 45° XY miter

<a :href="withBase('/examples/modeling-miter.ts')" download>Download the complete typed miter example</a>

A rectangular rail can be divided along the fixed vertical plane **X + Y = cutPosition**. This is a 45° XY miter: the plane runs along Z and the (+X, −Y) direction. `cutPosition` is a **coordinate-sum threshold in millimeters, not perpendicular distance**. Negative names the side below that sum; positive names the side above it. Both bodies share the cut boundary.

<<< ../../public/examples/modeling-miter.ts#miter

Choose **Modeling examples → Split a 45° XY miter**, acknowledge replacement, and load. This preset is a plain 32 × 24 × 8 mm extrusion with one **cutPosition · X + Y threshold (mm)** field. It has no bevels, axis selector or editable normal. All prior presets and their axis choices remain available. Selecting this option clears replacement acknowledgment without changing the accepted scene; loading succeeds atomically or retains the previous accepted model, pending dimensions and history on refusal/cancellation.

| Accepted state | X + Y threshold (mm) | Negative / positive volume (mm³) |
| --- | ---: | ---: |
| Initial rail | 24 | 2304 / 3840 |
| Move the cut | 32 | 3840 / 2304 |
| Recover after an outside-60 refusal | 28 | 3072 / 3072 |
| Save and reopen cold | 28 | 3072 / 3072 |
| Re-edit the reopened rail | 24 | 2304 / 3840 |

<<< ../../public/examples/modeling-miter.ts#edit-miter

`miterWorkflow()` performs the successful construction/edit/save/reopen sequence. The saved plane token and negative/positive output identities stay fixed while the numeric driver moves the cut. An accepted cut-position edit reuses the sketch/extrusion feature indices `[0,1]` and evaluates split `[2]`. Cold `cad.load` evaluates all three; accepted output tessellation still runs. These are model-feature counts, not native timing or a count of all transitive native work.

### Refuse an empty miter side without losing the rail

<<< ../../public/examples/modeling-miter.ts#refused-miter

At `cutPosition: 60`, requesting both outputs refuses with `CadModelError`, code `SELECTION`, operation `split`, and the original native cause: positive side, status `outside`, `sectionDimension: -1`. Keep the returned accepted snapshot and edit it to 28 to recover. The provider separately measured a lower tangent at signed −0: requesting only the positive side returns the unchanged 6144 mm³ parent, with section dimension1 at the vertical corner edge. That one-output tangent is a separate case, not this two-output preset; no empty Solid is fabricated. Upper-tangent behavior was not newly exercised.

### Fixed miter token and measured limits

Pass exactly one of `axis` or `plane`. The only non-cardinal token here is `plane: 'x+y'`; this is not a plane-expression parser. `at` uses existing owned dimensions and must resolve to a finite coordinate-sum length within ±10000 mm. Arbitrary normals, other diagonal equations, repeated/nested splits and mixed cut/intersection/split graphs remain unsupported. The six-feature limit and direct-XY-extrusion or its exact owned one/two-chamfer ancestry remain. Exact native affine/source/chart/crossing/pcurve/topology proofs can refuse an otherwise finite input, preserving the original cause; no rounding or clamping fallback is used.

The producer also measured a **separate symmetric two-chamfer parent**: opposite top edges each chamfered by 2 mm, then split at sum28, yielded **3008 / 3008 mm³** from a 6016 mm³ parent. This picker preset has no bevel toggle. That provider case does not certify arbitrary bevel combinations or an oblique post-split chamfer.

The [miter source](https://github.com/barocss/barocss/blob/a7bec3dd9f280b827200e2a6e34fc5bafed26e49/packages/barocss-cad/src/modeling.ts), [exact miterRail fixture](https://github.com/barocss/barocss/blob/a7bec3dd9f280b827200e2a6e34fc5bafed26e49/packages/barocss-cad/test/modeling-miter-fixture.mjs) and [native receipt](https://github.com/barocss/barocss/blob/a7bec3dd9f280b827200e2a6e34fc5bafed26e49/packages/barocss-cad/test/modeling-miter-evidence/verification.json) record the first campaign's **8 model calls and 2 baseline tessellations**. All four public construction calls and output mapping match the editor/download/provider recipe. The genuine **49,139-byte two-body baseline transport** passes the actual CPU controller, scene preparation and both named-output picks with a mocked Worker. This reuses measured geometry; it is not another native campaign or sample-worker execution. Provider [#1637](https://github.com/barocss/barocss/issues/1637) and consumer [#1639](https://github.com/barocss/barocss/issues/1639) retain separate receipts. Editor browser/GPU/React interaction, physical file-picker flows and npm publication remain **UNRUN** by these checks; Manual deployment is separate.

## Configure named rail finishes

<a :href="withBase('/examples/modeling-suppression.ts')" download>Download the complete typed configurable-finishes example</a>

Give the two owned chamfers stable application names, then choose which finishes contribute to the split rail. The three numeric parameters remain `frontDistance:1`, `backDistance:2` and `backY:24` mm. `backY` is an **edge-selection Y coordinate**, not a bevel distance. The blank is 32 × 24 × 8 mm, and the final split stays at X16 with named `negative` and `positive` outputs:

<<< ../../public/examples/modeling-suppression.ts#configurable-rail

The third chamfer argument supplies `{ name: 'frontFinish' }` or `{ name: 'backFinish' }`; a newly named chamfer starts active. The front selector belongs to `blank`, and the back selector belongs to the exact `front` result. The split follows the second result. Naming does not add features: the five features remain sketch → extrude → front chamfer → back chamfer → split. The ten public construction calls match the provider's `configurableRail` fixture.

### Choose one of four accepted-model configurations

`snapshot.withSuppression(edits)` returns a new accepted candidate after validating the whole requested batch. **`true` means the finish is off; `false` means it is on.** `snapshot.suppression` is a frozen, readonly map of named booleans, separate from the numeric millimetre parameters. Omitted names retain their previous flags; an unknown name or nonboolean value refuses instead of creating a feature.

<<< ../../public/examples/modeling-suppression.ts#finishing-states

| Finish choice | `frontFinish` suppressed | `backFinish` suppressed | negative / positive (mm³) |
| --- | --- | --- | --- |
| Both on | false | false | 3032 / 3032 |
| Front only | false | true | 3064 / 3064 |
| Back only | true | false | 3040 / 3040 |
| Both off | true | true | 3072 / 3072 |

These are measured native volumes with the initial 1/2/24 mm dimensions. They are not predictions for arbitrary numeric edits. Each split uses the exact selected qualified parent. A suppressed chamfer selects its unchanged parent as its output; its discarded bevel cap is absent from descendant source lineage. Its original, genuinely validated chamfer candidate remains diagnostic evidence, with `configuration.name`, `configuration.suppressed` and `configuration.output` (`'parent'` or `'chamfer-result'`). Feature metadata exposes the matching optional name and suppressed flag. Neither record is an editable native cache.

In **Modeling examples → Configure rail finishes**, acknowledge replacement and load. The **Rail finishes** controls offer **Both on**, **Front only**, **Back only** and **Both off** on the currently accepted rail. The three numeric fields keep their existing meanings; this preset has no axis selector or generic feature-authoring/reordering UI. Changing the picker alone clears replacement acknowledgment and leaves the accepted scene, drafts and history intact. A successful explicit replacement resets history; refusal or cancellation preserves it.

**Pending numeric drafts block finishing actions until Apply or Discard.** They are never silently discarded. A configuration action changes only the existing named flags, not dimensions, selectors, names, output references or graph ownership. Numeric Apply keeps the flags fixed. Undo/Redo uses one shared history for both numeric and finishing edits, including numeric edit → finishing change → numeric edit; each history step replays its original editing channel atomically. Refusal, cancellation, stale replies or display-preparation failure keep the previously accepted scene, saved intent and history.

<<< ../../public/examples/modeling-suppression.ts#numeric-finishes

This interleaved numeric sequence is an illustrative typed API example, not an additional native measurement. In the editor, choosing the already accepted configuration is a no-op: no Worker request, generation/revision change or history entry. The explicit API same-flags call is different: it returns a snapshot whose unchanged model features are all reused. A changed configuration conservatively evaluates all five model features. These counts are **model-feature indices only**, not timing, total transitive native calls or a native savings claim. Accepted output tessellation remains separate.

### Disabled finishes still validate and can refuse

Suppression is not an invalid-shape bypass. A disabled chamfer must still resolve a unique edge and satisfy positive-distance, cardinal-support, exactness, locality and native work limits, either by actual evaluation or legitimate reuse of an already validated result. Start with front on/back off, then try `backY:1`:

<<< ../../public/examples/modeling-suppression.ts#refused-finish

The measured result is `CadModelError` code **`NATIVE`**, operation **`chamfer`**, with the original **`ConvexPlanarSolidChamferError` / `METRIC` / `chamfer`** cause. The selector reaches the bevel/top edge with a non-cardinal adjacent support, even though the back finish is off. Keep the returned accepted `frontOnly` snapshot and original error/cause. Its bodies, saved text and flags remain unchanged; restoring both finishes from that same retained snapshot succeeds afterward.

### Save the flags and reopen cold

<<< ../../public/examples/modeling-suppression.ts#finishing-workflow

`save()` retains accepted named configuration and numeric values. `cad.load(saved)` validates the authored graph and rebuilds cold; saved text contains no native results, private reuse frame, recomputation report or display meshes. The editor's Save/Open and Worker reconstruction preserve the same flags. Browser file dialogs are separate from these string APIs.

Named chamfers serialize **paired `name`/`suppressed` fields** on their existing authored nodes. The envelope remains schema1; unnamed modeling files omit both fields and keep their existing authored bytes. Legacy readers remain separate and do not reinterpret these fields. Names obey the existing safe-ASCII naming rules and must be unique among named chamfers. Only existing named chamfers can be configured, with at most **two named chamfers** under the existing two-chamfer/six-feature bounds. Suppression does not authorize arbitrary feature deletion, reordered graphs, new Boolean combinations, unsupported parents or a third chamfer. Current owned-chain, split-parent and native qualification limits still apply.

The [adopted configuration source](https://github.com/barocss/barocss/blob/bf349441ec853a5349156d01a9e235e8b99e990e/packages/barocss-cad/src/modeling.ts), [exact configurableRail fixture](https://github.com/barocss/barocss/blob/bf349441ec853a5349156d01a9e235e8b99e990e/packages/barocss-cad/test/modeling-suppression-fixture.mjs) and [native receipt](https://github.com/barocss/barocss/blob/bf349441ec853a5349156d01a9e235e8b99e990e/packages/barocss-cad/test/modeling-suppression-evidence/verification.json) preserve the first campaign's **8 model calls and 1 negative-body tessellation**, including fresh emitted reopen and the back-only state. Both output volumes, exact parent/lineage behavior, no-op reuse and recovery after the disabled-finish refusal were measured. Full transitive native coverage was not measured; no timing or native savings claim follows.

The consumer's **41,901-byte baseline transfer** preserves the new actual saved intent, summary and measured negative mesh. Its full native-body hash matches the pinned #1631 baseline. Only under that measured parity does CPU replay combine it with #1631's earlier positive mesh: this is a **geometry-equivalent adapted transport replay** through the real controller with a **mocked Worker**. Both original input hashes are retained. The adapted baseline is not a fresh two-body tessellation, and mock displays used for other configuration-state controller tests are not newly tessellated native states. No extra native campaign or sample-worker execution is implied.

Provider [#1640](https://github.com/barocss/barocss/issues/1640) and consumer [#1642](https://github.com/barocss/barocss/issues/1642) retain separate receipts. Source/emitted types, recipe tracing, controller replay, actual browser/GPU/React interaction, physical file-picker flows, full-repository CI, Manual deployment and npm publication are separate gates. Browser/GPU/React, physical files, full-repository CI and npm publication remain **UNRUN** by the consumer checks; Manual deployment is recorded separately.

## 3. Read named outputs and evidence

<<< ../../../scripts/snippets/modeling-api.ts#outputs

After narrowing each output to `family: 'convex-planar'`, `bodies.part.native` is the finished chamfered Solid and `bodies.other.native` is the untouched negative-side component. Only names passed to `build()` appear in `bodies`. The entire authored graph is evaluated, including operations that are not named outputs. An unused invalid operation still refuses the build.

`parameters`, `suppression`, `features`, `evidence` and native bodies are read-only, frozen snapshot data. Features expose operation kinds and dependency indexes, plus optional named-chamfer configuration; evidence contains original kernel results for diagnosis. Neither is an editable graph API. Narrow the output family and pass its whole `native` Solid when calling matching native query/display adapters; a tessellated mesh or a renderer image does not replace it.

## 4. Edit parameters atomically

<<< ../../../scripts/snippets/modeling-api.ts#edit

`withParameters` applies a batch to a new candidate, reusing the unchanged feature prefix when it comes from the exact accepted snapshot. Adopt the returned snapshot only after success. There are no revision counters to manage. Previous snapshots remain unchanged, and an unknown parameter refuses rather than creating a new one. The first feature that references a changed parameter and every later feature are evaluated normally; earlier unchanged features may retain their frozen geometry/evidence by reference. This is conservative prefix reuse, not a general DAG scheduler or a speed guarantee.

For this part, changing `height` and `rearX` together uses `{ height: 6, rearX: 20 }`. Changing `setback` is an ordinary parameter edit. No builder, edge-handle or native ID from the original construction is needed to re-edit an accepted snapshot.

### Inspect feature reuse without assuming a timing gain

The readonly `snapshot.recomputation` report lists `reusedFeatures` and `evaluatedFeatures`, using the same zero-based indices as `snapshot.features`. It reports **model feature work only**: not total native calls, tessellation work, elapsed time or a measured speedup. The report is derived and is **excluded from saved authored text**.

<<< ../../public/examples/modeling-chamfer-chain.ts#inspect-recomputation

`withParameters` on the exact accepted snapshot can reuse its privately held, deeply frozen evaluation prefix; a same-flags `withSuppression` call can reuse the unchanged graph, while changed configuration conservatively evaluates all features. Source graph/options and parameter names stay admitted; numeric comparisons distinguish `+0` and `-0`. A failed edit leaves earlier snapshots, saved text and later reuse intact. There is no caller-imported, global or serialized geometry cache.

The [selective-regeneration source](https://github.com/barocss/barocss/blob/9722e3ab1f28daf17065aa9a5a9fec887faa9838/packages/barocss-cad/src/modeling.ts) and [native receipt](https://github.com/barocss/barocss/blob/9722e3ab1f28daf17065aa9a5a9fec887faa9838/packages/barocss-cad/test/modeling-regeneration-evidence/verification.json) establish these results for a **separate four-node producer fixture**. That fixture adds editable `width`, `height` and `unused` parameters to the three-parameter two-chamfer editor preset; those extra fields are not silently added to the existing preset.

| Producer fixture call | Reused feature indices | Evaluated feature indices | Exact part volume (mm³) |
| --- | --- | --- | ---: |
| Cold build | none | 0, 1, 2, 3 | 6064 |
| `backDistance:3` from initial | 0, 1, 2 | 3 | 5984 |
| `frontDistance:2` from back-edited snapshot | 0, 1 | 2, 3 | 5936 |
| `height:10` from initial | 0 | 1, 2, 3 | 7600 |
| `width:40` from initial | none | 0, 1, 2, 3 | 7580 |
| API same-value call on back-edited snapshot | 0, 1, 2, 3 | none | 5984 |
| Unused `+0` → `-0` after a native refusal | 0, 1, 2, 3 | none | 6064 |
| Fresh emitted load of back-edited save | none | 0, 1, 2, 3 | 5984 |
| Back distance restored to 2 after that load | 0, 1, 2 | 3 | 6064 |

The producer's 10 model calls include the actual `NATIVE`/`METRIC` chamfer refusal; the old accepted bodies/text and subsequent reuse survived it. One final-part tessellation was measured separately. These are model-feature and identity observations, not full transitive native coverage or a benchmark.

The existing editor benefits through its retained-snapshot `withParameters` path without a new editing flow. It filters entirely unchanged drafts before requesting any Worker operation, which is different from the explicit API no-op row above. **Accepted outputs still tessellate.** Explicit Open and fresh Worker reconstruction use `cad.load` and evaluate cold; cancellation or Worker loss discards the private frame, then reconstructs the accepted saved model before retrying the edit. Native or display-preparation refusal preserves the previously accepted data and history. Feature-work arrays are not added to the editor transport or shown as UI timing counters.

The consumer checks instrument exact snapshot identity with provider stubs and exercise the actual CPU controller's no-op, signed-zero and reconstruction paths. They do not rerun native geometry or establish editor browser/GPU behavior. Real reuse/cold identity proof belongs to the separately pinned producer receipt.

`CadModelError` has `code`, `operation`, `message` and, when present, the original native `cause`. Codes are `INPUT`, `PARAMETER`, `OWNERSHIP`, `CAPABILITY`, `SELECTION`, `FORMAT`, `BUDGET` and `NATIVE`. A wrapper error can arise before native evaluation; kernel refusals are wrapped as `NATIVE`. Handle the actual code/operation and keep the last accepted snapshot. Do not silently snap coordinates, switch cut sides or choose another edge after refusal.

## 5. Save authored intent and reopen it

<<< ../../../scripts/snippets/modeling-api.ts#persistence

`save()` returns authored text only: dimensions, operations, queries, optional named-chamfer configuration and named outputs. It does not serialize native results, certificates, evidence or display meshes. Your application writes that string to storage; neither `save()` nor `cad.load(text)` opens an OS file dialog or performs filesystem I/O.

`cad.load(text)` validates the bounded file and freshly evaluates its authored graph. The returned snapshot supports the same named outputs, `withParameters` and `withSuppression` methods. Internal envelope metadata identifies the file format; authors do not choose it or hand-edit identity/reference JSON. Unsupported envelopes, malformed or duplicate-key JSON, unknown fields and invalid graphs refuse.

This loader accepts files from this modeling API. Existing versioned feature documents retain their explicit legacy readers; there is no automatic migration through `cad.load`. See [historical serial-part files](./serial-part-v2) and [historical exact-prism files](./exact-prism-modeling) for those source-pinned contracts.

## Rectangular recess and through-window (provider API)

`plate.cut(tool)` returns one `CadShape` from two distinct direct integer rectangular XY extrusions. `plate.cut(tool,{axis:'x'|'y'})` retains the original through-slab `CadCut` pair. Omitting the second argument is meaningful; explicitly passing `undefined`, `null`, `{}`, extra fields or extra arguments refuses before geometry.

For a 32×24×8 mm plate, a tool spanning X8..24 and Y8..16, extruded4 mm, removes512 mm³ and retains5632 mm³. Both begin at Z=0, so this is an **underside recess**, not a top-entry pocket. Increasing depth to6 retains5376; depth8 creates a through-window retaining5120. Corners resolve to integers within ±10000 mm, with integer side lengths/heights1..10000. Owned add/scale dimensions may drive the bounds.

The complete named outputs keep `family:'orthogonal-cell'` with actual native material, source-qualified operand boxes and generated panel lineage. Original convex parent identity stays in diagnostic evidence. Empty or multi-body results are not converted into a shape: `SELECTION` / `cut` retains the full frozen native result as cause. A disjoint tool returns a newly qualified retained material body. All refused edits preserve previous saved text, bodies and future reuse.

The new saved node kind is `difference`, with parent/tool references. Cold load rebuilds the five-node graph. Depth edits reuse0/1/2 and evaluate3/4; tool XY edits reuse0/1 and evaluate2/3/4. These are model-feature indices, not measured total native savings. The old axis-cut schema and saved fixtures are unchanged.

**The editor software adapter now supports the bounded pocket/window workflow through [#1653](https://github.com/barocss/barocss/issues/1653).** It retains inward cut-tool orientation and native lineage, rejects forged convex/legacy packets, and validates every output before display. Complete preview requires at most64 panels; the native72-panel ceiling is not truncated. Actual browser/GPU/React and physical-file acceptance remain the **OPEN external visual gate** in #1653; the broader [#1119](https://github.com/barocss/barocss/issues/1119) renderer scope is not complete.

See the [complete typed primary-API example](https://github.com/barocss/barocss/blob/develop/packages/barocss-cad/CONCISE_API.md#cut-an-underside-recess-or-through-window). This five-node operation cannot mix with other Booleans, holes or chamfers, use an operation result as an operand, or expose convex edge queries. Translated-Z, cylindrical and arbitrary BRep cutters remain outside this scope.

## Supported shapes and useful refusals

| Operation | Admitted input | Refused or outside this surface |
| --- | --- | --- |
| Sketch | One simple strictly convex XY polygon, 3–8 straight segments; rectangle from `{width,height}` or `{min,max}`; owned circle from `{center,radius}` | Sketch holes, nonconvex/self-crossing cycles, arcs, numerical sketch constraints |
| Extrude | Positive +Z height up to 10000 mm; exact affine prism or separately qualified stored-rational circle boundary | Taper, sweep, nonpositive height, failed native/chart qualification; circle parents in finishing/Boolean operations |
| Cut with axis options | Two distinct direct XY extrusions; X or Y through-slab supports; full coverage by the remaining tool supports | Arbitrary cutter, cavity, union, chained cut parent, failed tool coverage |
| Cut without options | Two distinct direct integer authored rectangular XY extrusions from Z=0; one positive-volume orthogonal-cell result | Empty/multiple bodies, nesting/mixed graphs, top-entry or arbitrary cutters; complete display requires at most64 panels and external visual acceptance remains OPEN |
| Intersect | Two distinct same-model direct XY extrusions; positive-volume exact convex-planar overlap | Disjoint/touching-only results, same handle, cut-plus-intersection, repeated/nested intersection, union or general Boolean solids |
| Split | A direct XY extrusion or one/two owned serial chamfers rooted at it; world `axis: 'x'`, `'y'` or `'z'`, or fixed `plane: 'x+y'`, with a finite coordinate/coordinate-sum; each selected side must be nonempty | Arbitrary oblique plane, empty requested side, mixed cut/intersection/split graph, repeated/nested split |
| Hole | One direct origin-aligned rectangular extrusion with safe-integer width/depth/height, a strictly contained finite centre/radius and successful stored-rational qualification | Tangent/outside holes, nonrectangular or moved parents, repeated holes, mixed chamfer/split/cut/intersection; see the mounting-plate limits below |
| Rectangular difference | One same-model pair of direct integer rectangular extrusions; underside recess or through-window, one positive-volume result | Empty/multiple bodies, arbitrary curved operands; complete display requires at most64 panels |
| Union | Two distinct same-model direct authored rectangular XY extrusions with integer corners/sizes; one connected positive-volume integer-cell result, including face joins | Edge-only contact, disconnected bodies, nesting, union edge queries or mixed finishing/Boolean/hole graphs; display additionally requires at most 64 complete panels |
| Select | One exact cardinal-direction/endpoint-coordinate query on the same body | Zero/multiple matches, handles from another model/body, tolerance or persistent-topology matching |
| Chamfer | Up to two serial owned cardinal-edge chamfers; second parent/selector from the first result; perpendicular signed-axis adjacent supports and supported endpoints; positive local setback | Sibling/third chamfer, stale selectors, curved or arbitrary-angle chamfer, zero/excessive/touching/nonlocal setback; unmeasured feature combinations |
| Edit/load | Named finite-mm parameter batch or boolean suppression batch for existing named chamfers; admitted unchanged-prefix reuse on the exact snapshot, cold build/load, independent new snapshots | Partial accepted candidate, unknown/nonboolean flags, invalid suppressed operations, arbitrary graph editing, implicit migration or cached geometry acceptance |

A dimension being an ordinary integer is not enough to qualify an operation. The exact native XYZ, UV and chart constraints still apply. In the canonical part, combined `rearX:20` and `upperX:24` requires non-binary64 XYZ `80/3` and refuses; a `height:10` edit leaves the tool shorter than the parent and refuses coverage. `upperX:32` makes the selected positive side empty. Zero setback refuses the positive-dimension requirement; excessive setback refuses native locality. These are exactness and shape limits, not hidden tolerances or repair instructions.

### Initial resource bounds

`CadModelLimits` exposes these implementation bounds; they are not public version families. All limits apply together, and native operations retain their own tighter geometric/work budgets. Only one cut, intersection or split may appear in the same graph. One hole, one connected union or one rectangular difference may appear instead, without mixing Boolean/finishing operations. The explicit eight-node rectangular union → third-box difference chain is the bounded exception described above.

| Resource | Maximum |
| --- | ---: |
| Authored operation nodes | 6 normally;8 only for the exact union → slot chain |
| Sketches / extrusions / cuts / intersections / chamfers / splits / holes / unions / differences | 2 / 2 / 1 / 1 / 2 / 1 / 1 / 1 / 1 normally; the union → slot chain uses3 sketches and3 extrusions |
| Named parameters / outputs | 16 / 8 |
| Polygon points | 8 |
| Authored file UTF-8 bytes | 65536 (64 KiB) |
| Authored input depth | 12 |
| Absolute dimension or coordinate | 10000 mm |

Names are 1–48 characters. Inputs must be bounded own data: no accessors, symbols, sparse arrays or cycles. Extra fields refuse. Being below the graph/file limits does not guarantee native geometric admission, and the graph is not an unrestricted feature DAG.

## Evidence and current availability

Adopted engine source: [`4a2d2c5a`](https://github.com/barocss/barocss/blob/4a2d2c5a0d158d0b0a13a3ff85c38d8c57e439b4/packages/barocss-cad/src/modeling.ts). The [public fixture](https://github.com/barocss/barocss/blob/4a2d2c5a0d158d0b0a13a3ff85c38d8c57e439b4/packages/barocss-cad/test/modeling-fixture.mjs), [native verification receipt](https://github.com/barocss/barocss/blob/4a2d2c5a0d158d0b0a13a3ff85c38d8c57e439b4/packages/barocss-cad/test/modeling-evidence/verification.json) and [source/emitted/cold driver](https://github.com/barocss/barocss/blob/4a2d2c5a0d158d0b0a13a3ff85c38d8c57e439b4/packages/barocss-cad/scripts/modeling-consumer.mjs) record what was actually executed. This source is adopted on `develop`; engine adoption does not establish registry publication or manual deployment.

| State | Exact volume (mm³) | Engine evidence |
| --- | ---: | --- |
| Minimal 32 × 16 × 8 plate | 4096 | Final source replay |
| Canonical finished `part` / separate `other` | 3064 / 2048 | Preserved initial source campaign |
| Batch `height:6, rearX:20`, then save/load | 2488 | Initial source edit and final cold rebuild |
| Reopened batch-edited part, then `setback:2` | 2464 | Final cold re-edit |

The receipt preserves **15 initial-source evaluations** and **6 final evaluations**: source 1, emitted 1 and fresh-process cold 4. The initial source preceded array-admission/per-kind-limit hardening; the native geometry evaluator was unchanged. Final cold steps rebuilt the authored serial part and re-edited it. Do not describe all 21 evaluations as a fresh replay of the final source. Full package lint retained 27 existing errors, and the legacy consumer harness failed before imports on its inherited archive-name mismatch; the separate aggregate verifier also stopped after type/lightweight tests on a dependency-tooling failure before its lint step. Focused evidence is not a green whole-package claim.

The original cut/chamfer snippets were typechecked against this source and its already-emitted declarations. The intersection, split and two-chamfer examples have their own source-pinned provider checks and receipts; they do not rewrite the historical baseline evidence. The following optional check reads real native certificates if the host invokes it; the documentation check does **not** invoke it or run another native campaign:

<<< ../../../scripts/snippets/modeling-api.ts#checks

The quickstart's additional width/height sequence is typechecked, not a separately measured runtime fixture. Documentation typechecking is not another native run.

The independent [editor adoption #1612](https://github.com/barocss/barocss/issues/1612) is a separate consumer task. A working API or CPU/controller test does not establish browser/GPU pixels, physical Download → fresh picker Open → re-edit, docs deployment or npm publication. Those product/deployment gates remain separate and are **UNRUN** by this documentation check.

## Advanced and historical compatibility

- [CAD text language](./language): Source0–3 Curve/Surface and numeric-program reference; text `@extrude` is an open Surface, not this Solid extrusion
- [Historical Source0–3 complete programs](./language-workflows): preserved compiler inputs, outputs and exact source pins
- [Historical exact-prism workflow](./exact-prism-modeling): original versioned files and separate uncut-parent chamfer
- [Historical serial-part v2](./serial-part-v2): explicit fixed-role JSON, revisioned updates and legacy reader; retained without rewriting its evidence
- [Native capability reference](./capabilities): separate lower-level operations and their exact qualification/evidence

[Quickstart](./quickstart) · [CAD overview](./) · [Guides](./guides) · [API reference](./api)

<script setup>
import { withBase } from 'vitepress'
</script>

## Mounting plate with a through-hole

<a :href="withBase('/examples/modeling-hole.ts')" download>Download the complete typed mounting-plate example</a>

Choose **Mounting plate with a through-hole** (`mounting-plate`) in the existing modeling editor picker. This is the exact producer `mountingPlate` fixture: an 80 × 40 × 8 mm origin-aligned plate with a 5 mm radius through-hole centred at `[40,20]`. All six values are named numeric parameters. The sketch's `height: depth` is its Y size; `extrude(height)` is the solid's Z thickness.

<<< ../../public/examples/modeling-hole.ts#mounting-plate

The three authored nodes are sketch → extrude → hole. `blank.hole({ center, radius })` is owned by that direct rectangular extrusion. `build({ blank, plate })` preserves both outputs; hiding the blank does not remove it from the authored recipe or accepted summary. Importing the download does not evaluate or tessellate a model; call the exported functions when native work is intended.

### Read the two native families separately

All `snapshot.bodies[name]` values are frozen `{family,native}` wrappers. `blank` is `convex-planar`, with exact certified volume **25600 mm³**. `plate` is `stored-rational-plate-hole`; narrow its family before inspecting its unchanged native result.

<<< ../../public/examples/modeling-hole.ts#qualified-hole-output

The stored-rational qualification certifies one material component and a genus-one boundary: 7 faces, 10 native vertices, 15 edges, 9 loops and 30 directed edge uses. Its geometry authority is the stored-coefficient mathematical model. **Certified volume unavailable** is the hole's volume state (`volumeMM3:null` in the editor), distinct from legacy **Empty** and numeric zero. No certified ideal-cylinder/pi volume exists; analytic reference quantities in the original parent report are diagnostics, not certified mass.

The separately sampled native preview has **7 faces, 256 display vertices and 128 triangles**, using `segmentsPerQuarter:4`. Each cap keeps its two original loops and 20 annular panels; the cavity wall has 20 panels and inward normals. Its report remains `solid:false` and `topologyCertified:false`, even though the separate stored-rational native qualification certifies a Solid. Display vertices are not native topology vertices. The renderer uses genuine UVs, index ranges, original winding and native normals; it does not fill the cap aperture, invent convex fan diagonals or repair normals.

Face selection is approximate sampled-display selection. It reports the actual native face, surface, original loops and directed edge-use provenance. It does not turn a sampled hit into an exact material classifier result or a manufacturing certificate.

### Edit, refuse and recover on the accepted snapshot

<<< ../../public/examples/modeling-hole.ts#refused-hole
<<< ../../public/examples/modeling-hole.ts#edit-hole

The measured sequence first changes `radius:5` to `2.5`. A subsequent `width:81` candidate genuinely refuses with `CadModelError.code: NATIVE`, operation `hole`, and a `StoredPlateHoleSolidError` cause with code `GEOMETRY`: exact whole-curve stored-pole chart composition could not be qualified. The original accepted narrow snapshot remains usable. Applying `centerX:32.5, centerY:18.75` to the same accepted narrow snapshot succeeds. From this off-centre state, `radius:18.75` touches the plate boundary and refuses strict containment; the accepted geometry and saved text survive. A same-value API edit preserves the native wrapper/payload identity. The editor filters unchanged numeric drafts before sending a Worker request.

Exact clearances and all six material-classifier outcomes are recorded in the [frozen provider receipt](https://github.com/barocss/barocss/blob/0c7d6f2ff1d0df713aef483d9dda6bd1bf3ab34a/packages/barocss-cad/test/modeling-hole-evidence/verification.json). The successful radius/centre edits reuse model feature indices 0 and 1 and evaluate hole feature 2; this reports model-feature work only, not total native work or a timing/savings guarantee.

### Choose an output without changing the model

New mixed-family packets show one selected output ID and family. The mounting-plate preset explicitly selects `plate`; generic Open chooses the **last entry in the validated saved output inventory**, without guessing from names. Existing all-convex and legacy packets retain their show-all behavior. Every output is admitted before visibility is chosen, including hidden outputs.

Changing the output stages and atomically swaps only the display. Authored source, every saved output, accepted numeric data, model revision, Undo/Redo history and pending numeric drafts stay unchanged. Choosing the current output is a no-op. Edits, Undo/Redo and Worker reconstruction retain the chosen output when it still exists. A successful display swap clears stale face selection; failed, cancelled or stale display preparation preserves the accepted scene, selection and drafts. Existing replacement acknowledgement and Apply/Discard rules still apply to model changes.

Native admission and renderer admission have different bounds. The display preserves **1 scene unit = 1 mm**, with the existing ±1000 scene-coordinate, camera and normal limits. A natively valid larger or unsuitable shape may refuse display and leave the last accepted scene intact. There is no automatic rescaling or replacement renderer.

### Save authored intent, reopen and re-edit

<<< ../../public/examples/modeling-hole.ts#save-reopen-hole

The saved schema1 graph contains the `hole` operation, its numeric drivers and both named outputs. It contains no native IDs, native bodies, certificates or mesh cache. `cad.load(saved)` evaluates cold; after reopening the accepted off-centre state, changing radius from `2.5` back to `5` was measured successfully. Neither `save()` nor `cad.load()` performs filesystem I/O or opens a file dialog. Output visibility is a display choice and does not rewrite this saved recipe.

### Through-hole limits and evidence boundary

This first slice admits one hole on a **direct origin-aligned rectangle extrusion**. Width, depth and height must be safe integers from 1 to 10000 mm; centre and radius must be finite, strictly contained and qualified by the provider's represented-geometry and exact stored-UV rules. Parameter and owned derived-dimension handles are allowed. Merely staying below the numeric limits, using an integer, or appearing visually contained does not guarantee qualification. Tangent/outside holes, moved/nonrectangular parents, repeated holes, hole edge selection and mixed chamfer/split/cut/intersection graphs refuse. The existing six-node graph budget still applies.

The [adopted #1643 provider](https://github.com/barocss/barocss/issues/1643) is pinned at `0c7d6f2ff1d0df713aef483d9dda6bd1bf3ab34a`; its independently accepted candidate is `76f47a90609bbc998318f64eb1bea2ecd5a35336`, with tested product `81f5d206d9cb02fc4bced496b64e7de0154f1f98`. Its first campaign passed **9 model calls, 2 tessellations and 1 six-query material classification in 2.571 seconds**. This is a bounded recorded campaign, not a benchmark. The actual 277,591-byte baseline transfer is pinned to SHA256 `3ee3d585448a24ad6d8fcdbc3cddd927eb6e13b399db6a707444940080fc4024` and includes both genuine native bodies and meshes.

Consumer replay uses those actual baseline bytes with a mocked Worker, adapting only request-context envelopes when required. Mesh arrays, native bodies and provenance stay unchanged. Changed-state display tests are explicitly mocked, not newly tessellated native states. This consumer does not run another native model, tessellation or classifier campaign. The documentation checker statically checks the receipt/download and typechecks ten public examples/snippets against source or emitted declarations; it does not execute those examples.

[Consumer #1644](https://github.com/barocss/barocss/issues/1644) tracks software admission, CPU picking, editor source, numeric/history/refusal behavior and the Manual. Actual browser/GPU pixels, real editor interactions and physical file-dialog flows remain **UNRUN** by these checks and an external/open validation gate. The planned editor build uses the provider's hash-verified emitted declaration boundary, while runtime Vite/Worker bundles use actual source. The historical #1642 full-source and diagnostic timeouts remain unpassed; a package-boundary build does not erase them. Manual deployment, registry publication and that external visual gate are separate outcomes.
