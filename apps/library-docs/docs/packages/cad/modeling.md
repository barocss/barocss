# Model a part, edit it and reopen it

Use `cad.model()` to author a bounded solid part with named dimensions. Start with a sketch, extrude it, cut it with a through-slab tool, intersect it with another extrusion, or split it by height, and use supported edge chamfers. You do not choose a document version or author native IDs, revisions or reference records.

All dimensions below are **millimetres**. Use a TypeScript-capable workspace/bundler for source package entries; built ESM and declarations are a separate package build. Source adoption does not establish npm publication.

## 1. Make a plate

<<< ../../../scripts/snippets/modeling-api.ts#imports
<<< ../../../scripts/snippets/modeling-api.ts#plate

`rectangle({ width, height })` starts at XY `[0,0]`. Here its `height: depth` is the sketch's Y size, while `extrude(height)` is the solid's positive Z height. `makePlate()` returns an accepted snapshot; its named `bodies.part` output is the complete native Solid. A build requires at least one named output.

Parameter handles belong to their model. Use them directly wherever a point coordinate or dimension is accepted. A name is safe ASCII matching `[A-Za-z_][A-Za-z0-9_-]{0,47}`, excluding `__proto__`, `prototype` and `constructor`. A finite literal can be used instead of a parameter handle. Owned derived dimensions support bounded `model.dimension.add` and `model.dimension.scale` as described below. General formula strings and sketch constraints remain outside this authoring surface.

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

The accepted outputs are `snapshot.bodies.lower` and `snapshot.bodies.upper`. At `splitHeight: 2`, their exact volumes are **1792 / 5376 mm³**, with Z bounds **[0,2] / [2,8] mm**. They are distinct native bodies, not aliases of the original extrusion. Their total volume remains **7168 mm³**.

<<< ../../public/examples/modeling-split.ts#edit-split

`bisectPart(initial)` moves the plane to 4 mm, producing **3584 / 3584 mm³**. Save that snapshot, reopen its authored text, then call `raiseSplit(reopened)` to move the plane to 6 mm: **5376 / 1792 mm³**. The complete `splitPartWorkflow()` in the download shows this sequence. Each successful edit returns a new snapshot; the prior bodies and saved text remain unchanged.

The two-output example requires `0 < splitHeight < height`. At or beyond either end, one requested side is empty, so the rebuild refuses with `CadModelError` code `SELECTION`, operation `split`. Its original cause identifies `side`, native `status` and `sectionDimension` (-1 for outside, 2 for these tangent planes). Keep the previous snapshot, including both named outputs:

<<< ../../public/examples/modeling-split.ts#refused-split

A caller may instead build only a genuinely nonempty side from an outside/tangent split; that returns the provider's actual unchanged parent body. The two-output example never substitutes that side for an empty request. Other exact qualification/chart/budget failures remain native refusals with their original cause.

In **Modeling examples**, choose **Split a part**, keep **Z · lower / upper**, acknowledge replacement and load it. The original cut/chamfer default and overlap choice remain available. The existing controller owns replacement, cancellation, drafts and history; lower/upper flow through the same named-output display and selection path. A refused or cancelled load preserves the previously accepted model and pending dimensions.

This Z example splits a direct XY extrusion horizontally. The current API also supports X/Y planes as described next. A model may contain one split OR one cut OR one intersection, not a mixture. Oblique planes and repeated/nested splits remain unsupported. The separate beveled-part example below extends split parents to one/two owned chamfers rooted at a direct extrusion. This example does not demonstrate chamfering a split side.

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

Outside/tangent empty-side requests retain the same `SELECTION` behavior as Z. This plain example admits world X/Y/Z planes on a direct XY extrusion: no oblique plane, nested split or mixed cut/intersection/split graph. Split-after-chamfer has its own bounded example and evidence below.

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

## 3. Read named outputs and evidence

<<< ../../../scripts/snippets/modeling-api.ts#outputs

`bodies.part` is the finished chamfered Solid; `bodies.other` is the untouched negative-side component. Only names passed to `build()` appear in `bodies`. The entire authored graph is evaluated, including operations that are not named outputs. An unused invalid operation still refuses the build.

`parameters`, `features`, `evidence` and native bodies are read-only, frozen snapshot data. Features expose operation kinds and dependency indexes; evidence contains original kernel results for diagnosis. Neither is an editable graph API. Keep the whole native Solid when calling supported native query/display adapters; a tessellated mesh or a renderer image does not replace it.

## 4. Edit parameters atomically

<<< ../../../scripts/snippets/modeling-api.ts#edit

`withParameters` applies a batch to a new candidate, reusing the unchanged feature prefix when it comes from the exact accepted snapshot. Adopt the returned snapshot only after success. There are no revision counters to manage. Previous snapshots remain unchanged, and an unknown parameter refuses rather than creating a new one. The first feature that references a changed parameter and every later feature are evaluated normally; earlier unchanged features may retain their frozen geometry/evidence by reference. This is conservative prefix reuse, not a general DAG scheduler or a speed guarantee.

For this part, changing `height` and `rearX` together uses `{ height: 6, rearX: 20 }`. Changing `setback` is an ordinary parameter edit. No builder, edge-handle or native ID from the original construction is needed to re-edit an accepted snapshot.

### Inspect feature reuse without assuming a timing gain

The readonly `snapshot.recomputation` report lists `reusedFeatures` and `evaluatedFeatures`, using the same zero-based indices as `snapshot.features`. It reports **model feature work only**: not total native calls, tessellation work, elapsed time or a measured speedup. The report is derived and is **excluded from saved authored text**.

<<< ../../public/examples/modeling-chamfer-chain.ts#inspect-recomputation

Only `withParameters` on the exact accepted snapshot can reuse its privately held, deeply frozen evaluation prefix. Source graph/options and parameter names stay admitted and unchanged; comparisons distinguish `+0` and `-0`. A failed edit leaves earlier snapshots, saved text and later reuse intact. There is no caller-imported, global or serialized geometry cache.

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

`save()` returns authored text only: dimensions, operations, queries and named outputs. It does not serialize native results, certificates, evidence or display meshes. Your application writes that string to storage; neither `save()` nor `cad.load(text)` opens an OS file dialog or performs filesystem I/O.

`cad.load(text)` validates the bounded file and freshly evaluates its authored graph. The returned snapshot supports the same named outputs and `withParameters` method. Internal envelope metadata identifies the file format; authors do not choose it or hand-edit identity/reference JSON. Unsupported envelopes, malformed or duplicate-key JSON, unknown fields and invalid graphs refuse.

This loader accepts files from this modeling API. Existing versioned feature documents retain their explicit legacy readers; there is no automatic migration through `cad.load`. See [historical serial-part files](./serial-part-v2) and [historical exact-prism files](./exact-prism-modeling) for those source-pinned contracts.

## Supported shapes and useful refusals

| Operation | Admitted input | Refused or outside this surface |
| --- | --- | --- |
| Sketch | One simple strictly convex XY polygon, 3–8 straight segments; rectangle from `{width,height}` or `{min,max}` | Holes, nonconvex/self-crossing cycles, arcs, numerical sketch constraints |
| Extrude | Positive +Z height up to 10000 mm; exact affine native prism qualification | Taper, sweep, nonpositive height or nonrepresentable native/chart lift |
| Cut | Two distinct direct XY extrusions; X or Y through-slab supports; full coverage by the remaining tool supports | Arbitrary cutter, cavity, union, chained cut parent, failed tool coverage |
| Intersect | Two distinct same-model direct XY extrusions; positive-volume exact convex-planar overlap | Disjoint/touching-only results, same handle, cut-plus-intersection, repeated/nested intersection, union or general Boolean solids |
| Split | A direct XY extrusion or one/two owned serial chamfers rooted at it; world `axis: 'x'`, `'y'` or `'z'` with a finite coordinate; each selected side must be nonempty | Oblique plane, empty requested side, mixed cut/intersection/split graph, repeated/nested split |
| Select | One exact cardinal-direction/endpoint-coordinate query on the same body | Zero/multiple matches, handles from another model/body, tolerance or persistent-topology matching |
| Chamfer | Up to two serial owned cardinal-edge chamfers; second parent/selector from the first result; perpendicular signed-axis adjacent supports and supported endpoints; positive local setback | Sibling/third chamfer, stale selectors, curved or arbitrary-angle chamfer, zero/excessive/touching/nonlocal setback; unmeasured feature combinations |
| Edit/load | Named finite-mm parameter batch; admitted unchanged-prefix reuse on the exact snapshot, cold build/load, independent new snapshots | Partial accepted candidate, arbitrary graph editing, implicit migration or cached geometry acceptance |

A dimension being an ordinary integer is not enough to qualify an operation. The exact native XYZ, UV and chart constraints still apply. In the canonical part, combined `rearX:20` and `upperX:24` requires non-binary64 XYZ `80/3` and refuses; a `height:10` edit leaves the tool shorter than the parent and refuses coverage. `upperX:32` makes the selected positive side empty. Zero setback refuses the positive-dimension requirement; excessive setback refuses native locality. These are exactness and shape limits, not hidden tolerances or repair instructions.

### Initial resource bounds

`CadModelLimits` exposes these implementation bounds; they are not public version families. All limits apply together, and native operations retain their own tighter geometric/work budgets. Only one cut, intersection or split may appear in the same graph.

| Resource | Maximum |
| --- | ---: |
| Authored operation nodes | 6 |
| Sketches / extrusions / cuts / intersections / chamfers / splits | 2 / 2 / 1 / 1 / 2 / 1 |
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
