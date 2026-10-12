# Model a part, edit it and reopen it

Use `cad.model()` to author a bounded solid part with named dimensions. Start with a sketch, extrude it, cut it with a through-slab tool, intersect it with another extrusion, or split it by height, and use supported edge chamfers. You do not choose a document version or author native IDs, revisions or reference records.

All dimensions below are **millimetres**. Use a TypeScript-capable workspace/bundler for source package entries; built ESM and declarations are a separate package build. Source adoption does not establish npm publication.

## 1. Make a plate

<<< ../../../scripts/snippets/modeling-api.ts#imports
<<< ../../../scripts/snippets/modeling-api.ts#plate

`rectangle({ width, height })` starts at XY `[0,0]`. Here its `height: depth` is the sketch's Y size, while `extrude(height)` is the solid's positive Z height. `makePlate()` returns an accepted snapshot; its named `bodies.part` output is the complete native Solid. A build requires at least one named output.

Parameter handles belong to their model. Use them directly wherever a point coordinate or dimension is accepted. A name is safe ASCII matching `[A-Za-z_][A-Za-z0-9_-]{0,47}`, excluding `__proto__`, `prototype` and `constructor`. A finite literal can be used instead of a parameter handle. Parameter expressions and constraints are not part of this initial authoring surface.

## 2. Cut and chamfer the actual component

This complete example extrudes a convex pentagon and a rectangular cutter, retains both outside components, and chamfers the top/front edge of the positive-X component.

<<< ../../../scripts/snippets/modeling-api.ts#part

For the X cut, `negative` is the region on the lower-X side of the tool and `positive` is the region on its higher-X side. In this fixture they lie at `x ≤ 8` and `x ≥ upperX`. A Y cut has the corresponding lower-Y/higher-Y meaning. These names describe geometry, not volume signs, creation order, or a preferred component. The removed slab is between the tool's supports; the two outside components are separate Solids.

The cutter must cover the entire parent in its other directions. Here the tool keeps a literal height of 8 mm. Editing the parent height to 6 mm retains coverage; raising it to 10 mm refuses. This is a through-slab operation, not general Boolean subtraction or a cavity tool. An empty side cannot be a named Solid output or an operation parent.

`edges({ parallelTo: 'x', at: { y: 0, z: 'max' } }).one()` describes the exact top/front X-parallel edge. `min` and `max` refer to bounds of the entire owning body; every endpoint must meet the query exactly. `.one()` records the unique-selection requirement; resolution happens when the chamfer is evaluated during build, edit or load. Zero or multiple matches refuse instead of choosing an arbitrary edge. It is a geometric query, not persistent topology naming. Edits can change which edge matches; inspect the returned native evidence when identity matters.

The chamfer uses an equal physical setback on both adjacent planes. It is not the diagonal width of the new face. Selection and setback still have to pass the native cardinal-edge, perpendicular-support and locality rules below.

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

In **Modeling examples**, choose **Split a part by height**, acknowledge replacement and load it. The original cut/chamfer default and overlap choice remain available. The existing controller owns replacement, cancellation, drafts and history; lower/upper flow through the same named-output display and selection path. A refused or cancelled load preserves the previously accepted model and pending dimensions.

This API admits one horizontal split of a direct XY extrusion. A model may contain one split OR one cut OR one intersection, not a mixture. Arbitrary planes, X/Y split axes, repeated/nested splits and split parents made by other operations are outside this surface. This example does not demonstrate chamfering a split side.

The [split source](https://github.com/barocss/barocss/blob/142f4e5d745e1494771a530e293b374d1d29bcb2/packages/barocss-cad/src/modeling.ts) and [native receipt](https://github.com/barocss/barocss/blob/142f4e5d745e1494771a530e293b374d1d29bcb2/packages/barocss-cad/test/modeling-split-evidence/verification.json) record the baseline, edit and fresh-process results above. Lightweight tracing compares the exact five parameter/sketch/extrude/split calls and named output mapping of this download, the editor and the provider fixture, including signed zero. The provider's two genuine baseline tessellations are replayed through the actual controller with a mocked Worker; both CPU geometries and approximate CPU picks retain their lower/upper identities. This is not a second native execution or an editor browser/GPU test.

Provider [#1619](https://github.com/barocss/barocss/issues/1619) and consumer [#1620](https://github.com/barocss/barocss/issues/1620) track their own evidence. Typed download checks, native producer evaluation, controller replay, actual browser/GPU pixels, physical file-picker acceptance, manual deployment and npm publication are separate gates; unexecuted gates remain **UNRUN**.

## 3. Read named outputs and evidence

<<< ../../../scripts/snippets/modeling-api.ts#outputs

`bodies.part` is the finished chamfered Solid; `bodies.other` is the untouched negative-side component. Only names passed to `build()` appear in `bodies`. The entire authored graph is evaluated, including operations that are not named outputs. An unused invalid operation still refuses the build.

`parameters`, `features`, `evidence` and native bodies are read-only, frozen snapshot data. Features expose operation kinds and dependency indexes; evidence contains original kernel results for diagnosis. Neither is an editable graph API. Keep the whole native Solid when calling supported native query/display adapters; a tessellated mesh or a renderer image does not replace it.

## 4. Edit parameters atomically

<<< ../../../scripts/snippets/modeling-api.ts#edit

`withParameters` applies a batch to a new candidate and rebuilds all authored operations. Adopt the returned snapshot only after success. There are no revision counters to manage. Previous snapshots remain unchanged, and an unknown parameter refuses rather than creating a new one. This is a bounded full rebuild, not a selective-work or incremental-performance promise.

For this part, changing `height` and `rearX` together uses `{ height: 6, rearX: 20 }`. Changing `setback` is an ordinary parameter edit. No builder, edge-handle or native ID from the original construction is needed to re-edit an accepted snapshot.

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
| Split | One direct XY extrusion; `axis: 'z'` with a finite split height; each selected side must be nonempty | Arbitrary plane or X/Y axis, empty requested side, mixed cut/intersection/split graph, repeated/nested split |
| Select | One exact cardinal-direction/endpoint-coordinate query on the same body | Zero/multiple matches, handles from another model/body, tolerance or persistent-topology matching |
| Chamfer | One cardinal edge; perpendicular signed-axis adjacent supports, valence-three endpoints, perpendicular end supports; positive local setback | Repeated/multi-edge chamfer, curved or arbitrary-angle chamfer, zero/excessive/touching/nonlocal setback |
| Edit/load | Named finite-mm parameter batch; complete bounded rebuild into a new snapshot | Partial accepted candidate, arbitrary graph editing, implicit migration or cached geometry acceptance |

A dimension being an ordinary integer is not enough to qualify an operation. The exact native XYZ, UV and chart constraints still apply. In the canonical part, combined `rearX:20` and `upperX:24` requires non-binary64 XYZ `80/3` and refuses; a `height:10` edit leaves the tool shorter than the parent and refuses coverage. `upperX:32` makes the selected positive side empty. Zero setback refuses the positive-dimension requirement; excessive setback refuses native locality. These are exactness and shape limits, not hidden tolerances or repair instructions.

### Initial resource bounds

`CadModelLimits` exposes these implementation bounds; they are not public version families. All limits apply together, and native operations retain their own tighter geometric/work budgets. Only one cut, intersection or split may appear in the same graph.

| Resource | Maximum |
| --- | ---: |
| Authored operation nodes | 6 |
| Sketches / extrusions / cuts / intersections / chamfers / splits | 2 / 2 / 1 / 1 / 1 / 1 |
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

The original cut/chamfer snippets were typechecked against this source and its already-emitted declarations. The intersection and split examples have their own source-pinned provider checks and receipts; it does not rewrite the historical baseline evidence. The following optional check reads real native certificates if the host invokes it; the documentation check does **not** invoke it or run another native campaign:

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
