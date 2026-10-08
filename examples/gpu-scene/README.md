# Local GPU scene example

Start source development from the repository root:

```sh
pnpm dev:gpu
```

The installed esbuild transforms the original `packages/barocss-gpu/src/index.ts`
graph in memory. Reload sees source edits without a package build or server
restart. The private workspace package entry points to src. No dist prebuild,
watcher or downloaded runtime is needed. The source host keeps a finite local
route list and strict CSP. The unified CAD editor uses the same source host via
`pnpm dev:cad`.

For a separate explicit artifact checkpoint, the existing static host remains:

```sh
pnpm --filter @barocss/gpu build:library
node examples/gpu-scene/server.mjs
```

Open `http://127.0.0.1:5180`. `PORT` can select another port. The server binds to
127.0.0.1 and serves only exact local example routes. It has no model endpoint.
The textarea is parsed as scene data; it is never evaluated as code or HTML.
Apply accepts valid changes and displays diagnostics for invalid changes while
keeping the accepted scene. Reset restores the authored sphere/box fixture.

Run the real browser evidence suite with the installed Chrome and bundled
Playwright (no browser download):

```sh
PW_DIR=/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm --filter @barocss/gpu test:browser
```

`BAROCSS_GPU_EVIDENCE_DIR` selects a retained evidence directory. Each fixture
retains source, validated scene, generated shaders, PNG, and JSON hashes/readback
assertions. Software WebGL is functional evidence, not physical GPU or performance
proof. Missing Chrome or WebGL2 fails the suite.

The additive host mesh example is at `/mesh.html` on the same loopback server.
It uses independently authored analytic/literal preview packets and explicit
millimetres-to-scene conversion. It does not import the CAD package or alter the
sphere/box source grammar. The host fixture documents its coordinate reorientation;
the renderer has no rotation or automatic camera fitting.

## Source1 rotation prototype

The CAD preview's minimal Example menu includes **GPU · Rotated box** at
`/#rotated-box`. It calls the original GPU compiler with explicit source1 and
uses the existing runtime mouse-orbit camera. See the GPU package README for
syntax, angle bounds and transform order.

Focused rerun (with existing Chrome and Playwright installations):

```sh
pnpm --filter @barocss/gpu build:library
PW_DIR=<installed-runtime> CHROME=<installed-chrome> BAROCSS_ROTATION_EVIDENCE=<output-dir> node examples/gpu-scene/rotation-smoke.mjs
```

The preview server also needs the existing built CAD module graph. The smoke
uses a fresh loopback port and closes its own server/browser. Screenshots and
index.json contain source, ranged AST, owned IR2/execution, camera, backend and
exact HEAD. Broader suites are deferred under the prototype policy.

## Source1 capped cylinder prototype

The root Example menu includes **GPU · Cylinder** at `/#cylinder`. It uses the
same explicit source1/IR2 path as rotation, with radius and full local Y height.
After the affected GPU build, run `examples/gpu-scene/cylinder-smoke.mjs` with
PW_DIR, CHROME and BAROCSS_CYLINDER_EVIDENCE. This short actual browser run also
checks unchanged source0/source1 sphere/box shader controls. The preview server
needs the existing built CAD graph; no native cylinder capability is claimed.

## Source1 capsule prototype

**GPU · Capsule** at `/#capsule` uses local start/end/radius and existing rigid
rotation. After the affected GPU build, run `examples/gpu-scene/capsule-smoke.mjs`
with PW_DIR, CHROME and BAROCSS_CAPSULE_EVIDENCE. One actual browser run checks
axis/oblique segment and rounded-end distances, source edits, retained invalid
frames and exact old source0/rotation/cylinder shader controls. It requires the
existing built CAD module graph for the preview server; no native CAD capability
or physical GPU performance is claimed.

## Source1 rounded-box prototype

**GPU · Rounded box** at `/#rounded-box` compiles the own ranged source1 grammar
through semantic/IR2/original GLSL. Size is outer size; radius is positive and at
most its smallest half extent, equality accepted. Run `rounded-box-smoke.mjs`
after the affected GPU build with existing PW_DIR/CHROME and
BAROCSS_ROUNDED_BOX_EVIDENCE. The preview needs the existing built CAD graph.
The short real source/structured/browser run retains actual corner-removal,
radius/orbit/equality/failure controls and exact native GPU compiler lineage.


## Torus source1 prototype

Select Torus in the editor, then Apply scene. Source version1 is explicit; an
invalid source/version change keeps the accepted view. The shared CAD gallery
has `/#torus` with a local-Y camera and mouse orbit. Ring and tube radii are
scene units. Use `major-radius:1; minor-radius:.25;` and keep0<minor<major with
sum<=1000, including Float32. This is the GPU scene language, not CAD geometry.

Focused verification after the GPU build:

```sh
BAROCSS_TORUS_EVIDENCE=/tmp/barocss-torus-prototype node examples/gpu-scene/torus-smoke.mjs
```

Set PW_DIR and CHROME to the installed Playwright runtime and browser. This one
actual flow records generated helper distances, hole/annulus pixels, rotation,
orbit, invalid update retention, source-editor adoption and unchanged source0
shader bytes. Broader validation is deferred.

## Native Surface region and parameter reversal consumer (#680/#694)

`surface-region-reversal-flow.mjs` consumes the actual compiled own CAD/GPU APIs
and weighted nonunit `rational_panel` source. It extracts U2.5..4.5/V12..18,
reverses the original U parameter axis, saves/reopens each original native source,
and shows both real Surface packets in one own-GPU scene with display-only offsets.
An explicit Y-facing camera inspects this XZ fixture. Native reversed normals/
winding, physical display transforms and topology/face-sense certification remain
separate. It records original UV/IDs, independent reflected-point correspondence,
real uploaded arrays/culling/pixels, invalid native/source/display retention and
owned cleanup. No private editor/Loader/native algorithm or shared/root changes.

Set a unique `BAROCSS_REGION_GPU_EVIDENCE`, optional `BAROCSS_REGION_GPU_PORT`, then
run `node examples/gpu-scene/surface-region-reversal-flow.mjs`. Use the existing
compiled compatible CAD/GPU dependencies and press **Run native region GPU flow**
at the printed loopback URL. This consumer build/run checkpoint does not establish
commercial accuracy, general trims/Boolean/solids or npm publication.

## Actual Curve operations on our GPU (#791)

```sh
BAROCSS_CURVE_OP_EVIDENCE=/absolute/unique/output \
BAROCSS_CURVE_OP_DEPS=/absolute/compiled/provider/repo \
node examples/gpu-scene/curve-operations-flow.mjs
```

The explicit provider repository supplies actual manifest-declared compiled CAD
and GPU APIs. The collector bundles those read-only compiled inputs and records
hashes/metafiles; it does not copy dependency sources/dist into this worktree or
build provider packages. Its two committed input fixtures come from original
native676/686 producers; hashes/provenance are beside them.

One saved native file/API/browser flow calls reverseCurve/extractCurveInterval/
refineCurveWide and their owned validators, saves/reopens actual original/output
source0 and signed-zero-safe result JSON, then validates/samples those real files.
Weighted5-pole/domain-3..7 reversal mapsu=4-t with negative D1; interval[-1,4]
retains originalt across the actual C0 knot. The native knot1 D1 guard stays.
Original cubic31/domain[-0,26] plus11 three-fold insertions actually produces64p/
68knots, preserving domain/declared coefficient/knot lineage. Few mapped native
point/D1 observations are local, not global shape certification.

Four actual qualifiedv2 Line entries display original5/reversed5/interval5/native
refined64. The first three declare samplingv0; operation-produced64 declaresv1.
Original31 is retained but not drawn. Original/native IDs/source/weights/knots/
domains/-0 stay distinct from host namespaces/offsets/colors and derivedFloat32.
Explicit authored-XYZ-to-RHYup basis and mmToSceneUnit.01 are used once; there is
no fake Surface packet or native rotation/retagging. Actual GL position buffers,
visible colors, original/report retention, wrong-version/source binding refusal,
resize and zero owned resources are observed. The successful scoped flow used
34/34/18/111 samples, not a maximum sampling capacity campaign. Native operations,
GPU consumer, Integration and publication receipts remain separate. No new reader,
parent/packed/parity/gallery/performance or topology/solid/manufacturing claim.

## Actual64-pole edit and wide reversal (#842)

```sh
BAROCSS_WIDE_OP_EVIDENCE=/absolute/unique/output \
BAROCSS_WIDE_OP_DEPS=/absolute/compiled/provider/repo \
node examples/gpu-scene/wide-operations-flow.mjs
```

Use the actual compiled CAD/GPU manifest entries. The host reads the committed
#791 operation-produced64-pole source and its genuine #686 refinement record;
provider code is not copied or rebuilt. Original31 is retained and not drawn.
`editCurveControlPolygonWide` changes pole32 Y/weight and explicitly requests
pole0 Y=-0; `reverseCurveWide` reverses that edited Curve. Their owned validators,
saved/cold-reopened source0/JSON, native mapped point/D1 observations and C0 refusal
remain separate from sampling and GPU display. Source formatting is regenerated,
not a promise to restore original caller file bytes.

Three qualified scene2 entries all declare sample1. Original/edited keep the
same native `op_wide` ID with distinct model namespaces; reversal has its actual
derived ID. Host offsets/colors and mm scale0.01 do not alter native geometry.
Actual buffers, visible colors, wrong-version/source/ref refusal retention,
resize/reset and double-dispose are inspected in one source/file/WebGL2 flow.
The actual run used64/64/64 poles and111/124/124 sample points. These are local
observations, not full capacity, global error, topology, solid or performance
certification. Integration, Loader/Viewer adoption and publication are separate.

## Actual three-section loft Surface + sections (#853)

```sh
BAROCSS_LOFT_EVIDENCE=/absolute/unique/output \
BAROCSS_LOFT_DEPS=/absolute/compiled/provider/repo \
node examples/gpu-scene/three-section-loft-flow.mjs
```

Authentic native847 equal_curved_middle source/owned data supply three compatible
quadratic three-pole sections. Public buildThreeSectionLoftSurface and its owned
validator produce the actual Surface atV0/.5/1. Public middle-pole Z edit3→3.25mm
then rebuilds a distinct native Surface. Original/edited source0 and signed-zero
owned records save/cold-reopen; original caller file bytes remain separate.

Existing qualified scene2 displays the actual9×9 Surface packet and three
original section sample0 Curves (17/33/17 points). Native U[-0,2]/V[0,1], original
coefficients/weights/IDs/report and generated homogeneous poles stay distinct
from sampled buffers and host appearance. Explicit RH-Y-up/mm scale0.15 is used;
section display Z offset0.03mm exposes coincident curves without native editing.
Actual uploads/pixels, edited frame change, owned-result/packet/ref/fifth-entry
refusal retention, resize/reset and double-dispose are observed. One actual
source/file/WebGL2 flow is the proof, not arbitrary section count/guides/sweep,
B-Rep edges, G1/G2, solid, global error or manufacturing certification.

## One qualified Surface material in a mixed native scene (#837)

```sh
BAROCSS_QUALIFIED_MATERIAL_EVIDENCE=/absolute/unique/output \
BAROCSS_QUALIFIED_MATERIAL_DEPS=/absolute/compiled/CAD/provider/repo \
node examples/gpu-scene/qualified-material-flow.mjs
```

Build the affected local GPU package first; the consumer reads its compiled
GPU and the explicit compiled CAD provider. Two genuine plane Surfaces retain
the same native ID with different qualified model refs; a real native XY Line
shares their canvas/context/depth. Bind only the first Surface using the existing
opaque material language. Caller time0/1/2 matches independently computed linear
color/light/gamma while the other Surface/Line pixels and all geometry uploads
stay unchanged. Reset restores exact legacy pixels. Invalid refs/Curve/IR/uniform/
overlay and injected program allocation failures retain the accepted whole frame.
The same flow exercises scene replacement and viewport material/empty/clear/
restore/resize/disposal. Injection is not hardware exhaustion; no program/buffer
reuse, Viewer adoption, publication or performance certificate is claimed.

## Actual Physics frames with native shared depth (#850)

```sh
BAROCSS_PARTICLE_DEPS=/absolute/compiled/CAD-and-Physics/provider/repo \
BAROCSS_PARTICLE_EVIDENCE=/absolute/unique/output \
node examples/gpu-scene/particle-layer-flow.mjs
```

Build only the affected local GPU package first. The example consumes integrated
Physics813 compiled `/fluid` and CAD read-only. Its exact256-particle waterRev1
recipe generates0/60/240 states through240 host-requested steps; the supplied
raw Float64 metre SHA hashes must match. Original metre state/diagnostics/files
are separate from the host's one conversion `metres *1000 *.001`, GPU DTO and
actual Float32 upload checksum.

A real native plane Surface and the particles share one camera/context/depth
frame. Moving that same Surface offscreen via a display-only pose exposes more
cyan pixels (actual3195 occluded versus3686 unobstructed), demonstrating true
occlusion. These are pixel counts, not individual visible particle counts.
Actual POINTS256 calls/uploads/context-revision-step retention, invalid input/
camera/getter/regression/resource refusal, particle-only clear/exact native
restore, explicit reset/new generation, resize and viewport empty/restore/disposal
are checked in one source/API/WebGL2 flow. Allocation refusal is injected, not
physical exhaustion. Three upload/draw timings include full native restaging and
presentation; they exclude Physics and capture and are not a performance study.
The Surface is a display occluder, not a Physics obstacle or exact CAD collision.
Viewer851/play-pause-step-reset/parent814 adoption remains separate.

## Native Surface area is separate from display scale (#866)

```sh
BAROCSS_AREA_DEPS=/absolute/compiled/provider/repo \
BAROCSS_AREA_EVIDENCE=/absolute/unique/output \
node examples/gpu-scene/surface-area-flow.mjs
```

The two committed files are authentic native859 canonical document revisions,
not manually invented Surface results. Public current references select only
plane_body/asset_0/plane_nonunit; other bodies stay unselected and intact. Public
native Surface-area query/whole-owned validation yields6mm² then12mm² after the
actual authored width edit. Original U[-3,7]/V[2,5], source/coefficients/negative
zero/references/cells/report and saved native results remain separate from a
5×5 display packet and Float32 buffers.

A display-only scale[1.5,0.75,1] changes actual buffers/pixels/bounds while the
native area property remains6mm². The original native property is unposed
parametrized area, not triangle area or world/display area. Actual revision2
adoption stages native result and GPU frame before changing the property. Stale
reference, forged native result, invalid pose/packet and injected program refusal
retain prior native/property/frame. Resize and double disposal keep source data
and release owned resources. The property exposes a heuristic, non-certified
estimator; it is not trimmed/union/B-Rep/solid/volume/mass/COM or manufacturing
accuracy. Exact provider entry hashes/metafiles and fixture hashes are recorded.

## Complete native/material/particle frame (#868)

```sh
BAROCSS_COMPLETE_FRAME_DEPS=/absolute/compiled/CAD/provider/repo \
BAROCSS_COMPLETE_FRAME_EVIDENCE=/absolute/unique/output \
node examples/gpu-scene/complete-frame-flow.mjs
```

Build the affected local GPU package with Node22 first. The actual flow uses
two same-native-ID Surfaces under different model refs and a native Line. One
Surface gets the existing opaque source material at caller time1. A complete
camera/pose/material/particle update retains that binding and native/source/UV
ownership; a new model namespace binds against candidate refs. The actual850
step0 scene-unit layer is copied fixture data, not a repeated Physics solver.

Independent linear/light/gamma and default-object pixels, native GL uploads,
POINTS256, copied queries, wrong ref/Curve/duplicate/getter/IR/uniform/camera/
particle/profile and injected program failure retention are observed. Explicit
null clears particles, old update resets material, and viewport empty/clear/
restore/resize/double-dispose have no stale bindings or resources. This is one
actual source/API/WebGL2 flow, not Viewer adoption, selected-material overlay,
all-target parity, buffer reuse or performance certification.
