# @barocss/viewer

Experimental WebGL2 viewer for bounded BaroCAD Surface and sampled Curve previews. It uses the public
`@barocss/gpu` scene backend and `@barocss/cad-interop/native` loader. The viewer
does not evaluate NURBS for selection and does not change the native CAD model.

```js
import { createViewer } from '@barocss/viewer';

const viewer = createViewer(canvas, {
  mmToSceneUnit: 0.001, background: [0.04, 0.06, 0.1]
});
viewer.loadNative(sourceText, { sourceVersion: 0, countU: 8, countV: 8 });
viewer.orbit(0.3, 0.1);
const hit = viewer.pick(120, 80); // canvas-local CSS pixels
if (hit) viewer.select(hit.ref);
viewer.dispose();
```

For canvas camera input, call `const controls = viewer.attachPointerControls({
onError })` and later `controls.dispose()`. Primary drag orbits; Shift+primary
drag pans; the wheel zooms. A drag suppresses its following synthetic click,
while a click without drag still reaches the host's selection handler. The
adapter captures one pointer, uses canvas CSS pixels and the current camera,
and removes its listeners on disposal. The host owns the Viewer, canvas,
touch-action CSS and control lifetime. It does not select geometry or change
native measurements or display poses. The runnable `examples/viewer-scene`
uses this adapter with its existing click-to-select handler.

For focused canvas keys, give the host canvas `tabIndex=0`, then call
`const keys = viewer.attachKeyboardControls({ onError })` and later
`keys.dispose()`. Unmodified `F` fits the currently visible displayed
geometry; `Escape` clears current Surface or Curve selection. The adapter
listens only on the Viewer canvas and does not set focus or change native
source. Modified, repeated and composing keys are ignored. Failed fit is
reported to `onError` without preventing the browser default. The host owns
canvas focus and the adapter lifetime. `examples/viewer-scene` shows the
focused key flow beside its existing buttons and pointer controls.

`viewer.clear()` explicitly returns the caller canvas to a real blank GPU
frame. It clears displayed objects, native/model-set source, selection, poses
and measurements, while keeping the accepted camera, scale, background and
lighting. `getState().status` becomes `empty`, and `readPixels()` returns
the background after this explicit clear. Empty camera changes, resize and
null selection remain usable. An older pending `loadNativeUrl` result is
refused after a successful clear; the caller still owns network cancellation.
Later native, packet or qualified model-set loads use their usual validation.
The fresh Viewer retains its earlier no-renderer state until a load or clear.
The runnable `examples/viewer-clear` exercises this lifecycle in WebGL2.

For the bounded fluid display, load one qualified native Surface through
`loadModelSet` or `loadDocument`, then pass an actual Physics state through
`setFluidFrame`. The host supplies a context ID and owns the Physics world,
clock and reset:

```js
const state = world.getState();
viewer.setFluidFrame({ version: 0, contextId: 'water_generation_1',
  sceneRevision: state.sceneRevision, stepIndex: state.stepIndex,
  particleCount: state.particleCount, positionsM: state.positionsM });
// Later: world.step(1 / 120), then setFluidFrame with the new state.
viewer.setFluidFrame(null); // clear particles only
```

`ViewerFluidFrameV0` requires exactly 256 finite `Float64Array` XYZ metre
positions. Viewer copies them and converts each coordinate once with
`1000 * mmToSceneUnit` before calling GPU's public shared-depth particle API.
`getState().fluidFrame` returns a copy. Camera, selection, pose and visible
Surface changes present native geometry and particles in one GPU frame. Hiding
the sole Surface while particles remain is refused. A new context needs an
explicit layer clear or successful scene replacement. Resize retains the
layer; Viewer clear and successful replacement remove it. This first profile
does not admit legacy `loadNative`, raw packets, Curves, more than one Surface,
or a second canvas. The Surface is display geometry, not a certified fluid
collision obstacle. `examples/viewer-fluid-scene` exercises the actual Physics
and native Surface path in Chromium WebGL2.

## Selected native assembly instances

`loadAssembly(result, options)` admits one complete validated public CAD
assembly and 1 through 4 explicitly chosen existing instances. Loader's
`@barocss/cad-interop/assembly` entry reads the authored file. This synchronous
Viewer command prepares original previews, initial authored poses and camera,
then presents one complete candidate before changing accepted state:

```js
viewer.loadAssembly(assemblyResult, {
  native: { sourceVersion: 0, countU: 5, countV: 5,
    curveDisplay: { version: 1, chordToleranceMM: 0.01,
      maxSegments: 64, maxDepth: 8 } },
  basis: 'authored-xyz-matches-rhyup',
  instanceIds: ['child', 'surface_grandchild', 'shared_root', 'asset_b_instance']
});
const binding = viewer.getState().assemblyInstances[0];
const point = viewer.queryAssemblyInstancePoint({
  assemblyId: binding.assemblyId, assemblyRevision: binding.assemblyRevision,
  instanceId: binding.instanceId, reference: binding.reference,
  query: { kind: 'curve', parameter: 2 }
});
// point.originalLocalPointMM and point.assemblyPointMM have separate meanings.
```

`ViewerAssemblyLoadOptions` has exactly the own data fields `native`, `basis`
and `instanceIds`; accessors, symbols, extra or sparse entries refuse. Native
options use existing Viewer version/count/Curve budgets. Input units are fixed
at one original mm, not an additional caller scale. IDs are unique authored
ASCII IDs in caller order. `getState().assembly` retains the complete copied
native result; `assemblyInstances` records the selected ref, assembly identity
and revision, instance/parent/ancestors, full native reference, original local
and world matrices, and derived display pose. Original native/modelSet/document
fields become null, and documentBodies empty. The native result retains nested
source strings; it does not retain the original Assembly JSON wire text.

Display refs use `assembly.` followed by two lowercase hexadecimal digits per
instance ID character. Repeated parts keep original geometry IDs and distinct
instance namespaces. Preview coordinates/source/UVs/parameter domains remain
original local XYZ/mm. A unit quaternion and translation derived from the
validated row-major world matrix apply before `mmToSceneUnit` once. No Euler
angle addition, native scale, reflection or baked geometry is introduced. GPU's
translation limit is ±10000 mm, even though native assembly capacity is larger;
transformed positions must also meet ±1000 scene-unit and current GPU budgets.
The initial camera fits selected posed display geometry, not a certified
assembly hull. Invalid candidate or late allocation failure keeps the previous
source, bindings, camera, selection, layers, pixels and resources.

Copied geometryMotion exposes complete authored poses for inspection. Camera,
fit, visibility, picking and selection retain them. Motion frame overrides and
resetMotion refuse in assembly mode. Native curve picking resolves the original
selected part; approximate hits remain display queries. Legacy native measurement
and projectNativePoint methods refuse in this mode: use the revision-pinned
assembly command, which returns the original CAD query/report without changing
Viewer state. It accepts only admitted instance IDs and exact current assembly
revision/full part references. Hidden status and primary selection do not affect
read-only source inspection. Native document-bound methods remain document-only.

This first assembly profile refuses material commands and non-null fluid/cloth
frames. Successful generation resets earlier layers; failed replacement retains
them. A successful assembly load supersedes older pending Viewer source URL
loads. Later successful native/model-set/document/packet loads or clear drop
assembly metadata. Context loss retains copied assembly data for CPU queries
while GPU operations refuse; disposal clears assembly/bindings/authored poses
and rejects later queries. Native 32-instance capacity is separate from the
four-instance display limit. Editing, mates, exploded poses, multi-highlight,
Shell composition and physical certification are separate scopes.
`examples/viewer-assembly-scene` demonstrates selected hierarchy and read-only
local/world inspection on original revision0/1 files.

## Caller-owned cloth frames

After loading one qualified visible native Surface with `loadModelSet` or
`loadDocument`, submit a copied public Physics sheet state. The host owns time,
identity and the Physics world. Viewer performs no solver step:

```js
const state = clothWorld.getState();
viewer.setClothFrame({ version: 0, layerId: 'sheet_1', contextId: 'run_1',
  sceneRevision: state.sceneRevision, stepIndex: state.stepIndex,
  vertexCount: 289, triangleCount: 512,
  positionsM: state.positionsM, triangles: state.triangles });
viewer.setClothFrame(null); // clear only cloth and its accepted step cursor
```

`ViewerClothFrameV0` accepts exactly these nine own enumerable data fields.
Layer/context/revision tags are opaque ASCII identifiers matching
`[A-Za-z_][A-Za-z0-9_.:-]{0,127}`. Step is an integer from 0 through 240.
Positions are an ordinary same-realm Float64Array of 867 finite metre values;
triangles are an ordinary same-realm Uint16Array of 1536 canonical indices.
Both views require nonshared ArrayBuffer storage and no extra, accessor or
custom-prototype fields. Nonzero view offsets are allowed. Spoofed, proxied,
detached or incompatible views refuse without reading caller getters. Topology
is the fixed 17 by 17 row-major sheet: each cell `a=z*17+x` uses
`[a,a+17,a+1,a+1,a+17,a+18]`. No mesh repair or alternate winding is admitted.

Viewer owns independent copies and maps each original coordinate with
`metres * 1000 * mmToSceneUnit`, in that order, once. Converted coordinates must
be finite and within ±1000 scene units. Viewer preserves original signed-zero
bits; GPU alone lowers positions to Float32 and validates triangle areas and
normals. `getState().clothFrame` returns independent copies. A supplied frame
need not be certified Physics output; this method validates display admission.

The active layer/context/revision identity must stay unchanged until explicit
null clear or successful native replacement. Steps cannot decrease. Exact
same-step original data is an idempotent no-op after full validation; changed
same-step bits, including +0 versus -0, refuse. Resetting a world from step240
to step0 requires clearing cloth first. Validation and GPU refusal retain the
complete accepted native/derived state, pixels and resources.

Only one total qualified visible Surface and no Curves are admitted. Materials
and the existing 256-particle layer can coexist. Camera, selection, display
pose, fit and retain-visible updates carry a complete GPU FrameV1; native poses
move only native geometry while cloth stays in scene coordinates. Dedicated
material/particle updates and resize retain cloth. Hiding the sole Surface
requires clearing cloth first. Successful native/packet/source replacement or
Viewer clear drops cloth; failed, aborted or superseded loads retain it.
Context loss retains copied cloth metadata for inspection, but refuses layer
updates and clear. Dispose clears Viewer metadata and GPU resources; the caller
still owns its canvas and Physics world.

Cloth has no native CAD reference, pick hit, measurement or native bounds.
Native picking ignores cloth occlusion: a visually covered Surface can still
be picked. Native-only fit may clip cloth. Supply an explicit camera covering
both. Shared depth proves display coexistence, not physical collision or
fabric accuracy. `examples/viewer-cloth-scene` uses real public Physics
step0/60/240 in an explicit proof action; #981 owns separate playback.

For a qualified native Surface, compile an opaque CSS-shaped material with
`@barocss/gpu` and bind it through Viewer:

```js
import { compileMeshMaterial } from '@barocss/gpu';

const compiled = compileMeshMaterial(source);
if (!compiled.ok) throw new Error('Material source was refused');
const ref = viewer.getState().surfaces[0];
viewer.setSurfaceMaterial(ref, { material: compiled.material,
  uniforms: { timeSeconds: 1 } });
viewer.setSurfaceMaterial(ref, null); // restore default Surface appearance
```

The host owns time and uniform updates. The copied `getState().surfaceMaterials`
array lists every accepted binding in Surface order. `surfaceMaterial` keeps
the original one-binding query: it returns that binding when exactly one is
bound, or `null` when zero or multiple Surfaces are bound. The profile accepts
1–4 total qualified native Surface/Curve objects with at least one Surface
through `loadModelSet` or `loadDocument`. Distinct aliases may keep the same
original Surface ID. Curves retain their line appearance and selection.
Legacy `loadNative` and raw packets refuse material binding. Camera, fit and
display pose changes retain it through GPU's complete-frame update, including
an accepted fluid layer. Selecting the bound Surface or hiding it requires an
explicit clear of that Surface's material first. An unbound Surface may be
selected or hidden while other Surfaces remain bound. Particle-only updates
retain all accepted materials in the one-Surface fluid profile.
Successful scene replacement and Viewer clear remove it; failed requests keep
the accepted binding and pixels. `examples/viewer-surface-material` runs the
actual native/compiled-material/Physics path in Chromium WebGL2;
`examples/viewer-multi-material` checks separate bindings on two qualified
source0 models.

For a source0 file served over HTTP, call `await viewer.loadNativeUrl(url,
loadOptions, { signal, onProgress })`. The transport reports received bytes and
supports caller cancellation; the same native source, display limits and
state-reset rules as `loadNative` apply. Failed, aborted and superseded loads
retain the accepted scene. A newer URL call or successful `loadNative` or
`setPackets` prevents an older pending URL result from replacing it. The caller
owns the `AbortController`; disposal also prevents a pending result from
mounting a new scene. This API does not read CAD document v1 JSON.

For a bounded source0 model set, first call Loader's public
`loadBaroCadModelSet(manifest, options)`, then `viewer.loadModelSet(set)`.
To read the URLs and admit the result within Viewer's scene request generation,
call `await viewer.loadModelSetUrls(manifest, { baseURL, signal, onProgress })`.
The Loader owns URL, byte, progress, abort and parse validation. A newer Viewer
URL request, successful synchronous replacement or `clear()` prevents an older
model-set result from mounting; the caller still owns transport cancellation.
Failure retains the accepted scene and its Surface materials. The runnable
`examples/viewer-model-set-urls` exercises actual HTTP loads and request races.
The synchronous Viewer call accepts 1–4 total displayed Surfaces/Curves and
uses GPU's qualified primitive scene v2 in one canvas. It keeps original
native Surface and Curve IDs even when two source files use the same IDs.
In this mode, Viewer `modelId` is the GPU-safe source alias: Loader encodes
`-` as `.` while `getState().modelSet` keeps the original alias, URL,
Model name and source. `getState().native` is null for a model set.
The set must use one Curve sample version; `curveSampleVersion` reports it.
The caller owns network cancellation and the source set.

Camera fit, approximate screen picks, selection and display poses use the
qualified Viewer refs. Native distance resolves the accepted alias and
requires both points from that same source. It evaluates original authored
XYZ/mm and refuses cross-source pairs. A failed set or GPU candidate keeps
the last accepted source, camera, selection, measurements and pixels.
Successful scene replacement clears selection, poses and measurements and
supersedes a pending `loadNativeUrl`. This mode does not infer CAD document
placement or native topology. The runnable
`examples/viewer-model-set` uses two files with duplicate original IDs.

For a direct-geometry CAD document v1, first use Loader's public
`loadBaroCadDocument(url)` or `parseBaroCadDocument(text)`, then call
`viewer.loadDocument(result,{native,basis:'authored-xyz-matches-rhyup',
bodyIds})`. To read and admit in one call, use
`await viewer.loadDocumentUrl(url,{native,basis:'authored-xyz-matches-rhyup',
bodyIds},{signal,onProgress})`. This delegates to the same public document
Loader and applies the same selected-body Viewer admission. Loader enforces
HTTP(S), 2 MiB/4096 chunks, strict UTF-8 and byte progress. The caller owns
the AbortController and timeout. Failed, aborted, stale or disposed requests
cannot replace the accepted scene; a newer URL request supersedes an older
pending document or native URL request. A successful synchronous scene load
or `clear()` also supersedes it. The host must explicitly assert that its authored XYZ matches
the right-handed Y-up display basis; the document's opaque frame tag does not
make that claim. Loader selects 1–4 bodies in document order. A document with
more than four bodies requires explicit `bodyIds`. Viewer uses original
Surface/Curve IDs and an asset-derived qualified `modelId` (`-` becomes
`.`), then applies its own explicit `mmToSceneUnit` once.

`getState().document` is an owned copy of the authoritative result.
`getState().documentBodies` maps each displayed tagged ref to the exact
document/body/asset/revision/frame binding; screen picks and selection use
these refs. The old `native` and `modelSet` state fields are null in
document mode. Native point distance resolves a selected asset's original
Model and refuses cross-asset pairs. Display poses leave source, body
bindings and native measurements unchanged. Invalid document/options or GPU
admission keeps the prior scene; successful replacement resets selection,
poses and measurements. `clear()` removes document state. This profile
does not infer document placements, assemblies, topology or exact native
screen hits. The runnable `examples/viewer-document` uses one saved
six-body document with four selected bodies.

`viewer.setVisibleGeometry(refs)` replaces the complete visible subset with
0–4 tagged Surface/Curve refs already admitted in the scene. The copied
`getState().visibleGeometry` follows scene order. Hidden objects stay in the
native/document inventory and keep their display poses and native measurement
authority. Rendering, screen picking, selection and fit use visible objects
only. Hiding a selected object clears selection. Hiding all shows the
background while `status` stays `ready` and source data remains loaded;
`fit()` then refuses until an object is shown. Camera controls and pixel reads
still work. A successful scene replacement shows all admitted objects, while
`clear()` removes them. Invalid refs or a failed GPU update retain the prior
scene and pixels. This controls Viewer display only; it does not edit a CAD
assembly or create a native section view. `examples/viewer-document` exercises
visibility with the same four-object document scene. The standalone
`examples/viewer-object-tree` host turns copied current document-body
bindings into an interactive list. It uses public selection, visibility and
fit methods and shows only original identity and revision properties.

`viewer.projectNativePoint({kind:'surface',modelId,surfaceId,u,v})` or its
tagged Curve form with `curveId,t` projects one accepted, visible native
parameter point to canvas-local CSS coordinates. It returns the evaluated
original `pointMM`, posed display position, positive camera depth, and a
copied document-body binding when present. The projection is approximate
display data and does not test whether another object covers the point.
A valid point outside the camera frustum returns `null`; invalid, hidden or
unknown refs throw without changing Viewer state. The caller owns any DOM
labels, source/revision checks and label removal after a scene change. Native
measurements remain authored XYZ/mm and do not change when projected.
`examples/viewer-document` places two caller-owned labels over the actual
WebGL scene.

For one visible current CAD document body, `viewer.fitNativeDocumentBody({
ref, documentRevision })` uses the public CAD original control-pole bounds
instead of displayed vertices. Pass a tagged `ref` from
`getState().documentBodies` and its current binding revision. Viewer checks
the complete native body binding, applies its accepted display pose to all
eight bounds corners, and changes only the camera. Hidden, stale and
non-document input is refused. This optional fit is conservative and can
leave empty margin; it is not tight geometry extrema or a certified
floating-point containment proof. Existing `fit()` and `fitGeometry()` still
frame displayed geometry. `examples/viewer-native-bounds` shows both modes
with an authentic weighted Curve and document revision edit.

`viewer.fitNativeDocumentBodies({ refs, documentRevision })` frames an explicit
set of two to four visible bodies in the same current CAD document. Pass
qualified refs from `getState().documentBodies` and the current revision.
Viewer validates each original body binding and combines their control-pole
hulls after each accepted display pose. The call changes only the camera.
Duplicate, hidden, foreign and stale refs are rejected. It does not add
unlisted bodies or infer assembly placement. A one-body fit uses
`fitNativeDocumentBody`; `fit()` still frames displayed geometry.

`examples/viewer-curve-length` combines a source-qualified CAD Curve
arc-length estimate with `projectNativePoint` in one own-GPU canvas. The
caller moves its DOM label after camera and display pose changes. The
original endpoint chord remains a separate native point distance. The
estimator is heuristic and does not certify global error.

`examples/viewer-surface-area` shows the original unposed CAD Surface
parametric-area estimate beside a qualified Viewer document body. The host
rechecks the body revision before showing its DOM label. Camera and display
pose changes leave the native value unchanged; an accepted document revision
updates both scene and label. The estimate is heuristic and distinct from
display triangle area.

For explicit Surface mesh lighting, pass an optional GPU `MeshLighting` value
at creation: `lighting:{ambientStrength:0.12,directionalStrength:0.78,
direction:[0.8,0.4,-0.7]}`. Each strength is in 0..1 and their sum is at most
1; the finite nonzero direction is in renderer-world Y-up coordinates.
`getState().lighting` returns a copy or `null`. Omitting lighting preserves the
previous shader and pixels. Curve lines remain unlit in Surface-only, mixed
and wide v1 primitive scenes. Lighting never changes original CAD geometry or
native measurements.

To display genuine native Curve samples in the same scene, opt in during load:

```js
viewer.loadNative(sourceText, { sourceVersion: 0, countU: 8, countV: 8,
  curveDisplay: { chordToleranceMM: 2, maxSegments: 256, maxDepth: 10 } });
const hit = viewer.pickGeometry({ xCss: 120, yCss: 80 }, { curveTolerancePx: 4 });
// hit.kind is 'surface' or 'curve'; neither kind changes selection by itself.
```

For a native Curve with up to 64 poles, explicitly request the v1 sample path:

```js
viewer.loadNative(wideSourceText, { sourceVersion: 0, countU: 8, countV: 8,
  curveDisplay: { version: 1, chordToleranceMM: 0.002,
    maxSegments: 4092, maxDepth: 10 } });
// getState().curveSampleVersion is 1; unversioned Curve display reports 0.
```

The v1 sample uses GPU's versioned primitive scene. `curveSampleVersion` is
`null` when no Curve is displayed. The unversioned v0 call keeps its original
GPU path and 1024-segment request limit. Both profiles retain the same
approximate picking, selection and caller-owned Motion display behavior;
native source, knots and measurements remain in authored millimetres.

The original three-field load still renders only Surfaces. With `curveDisplay`,
Loader's complete native sampling result goes to GPU's mixed primitive scene;
Curves are not fabricated as Surface packets. `getState().curves` lists the
qualified displayed Curve IDs. Curve-only source0 Models can be displayed and
fitted. `getState().packets` and `surfaces` remain Surface-only. `select` and
`pick` remain Surface-only, including in a mixed scene.

`selectGeometry({kind:'surface',modelId,surfaceId})` or
`selectGeometry({kind:'curve',modelId,curveId})` highlights one currently
displayed qualified object. Pass `null` to clear it. The copied
`getState().selectedGeometry` records either kind. The existing `select(ref)`
remains Surface-only: it updates both its old `selected` field and the new
tagged field. Selecting a Curve sets the old Surface-only `selected` field to
`null`. Neither pick method changes selection. Invalid or hidden references
retain selection and pixels; a successful scene replacement clears both
selection fields. This display highlight does not select native topology.

For a direct caller-owned `ViewerPoseFrame`, bind each target to exactly one displayed surface:

```js
const frame = { contextId: 'part-demo', timeSeconds: 2, poses: [
  { targetId: 'part-a', translation: [20, 0, 0] },
  { targetId: 'part-b', translation: [-20, 0, 0] },
] };
const bindings = [
  { contextId: frame.contextId, targetId: 'part-a', ref: viewer.getState().surfaces[0] },
  { contextId: frame.contextId, targetId: 'part-b', ref: viewer.getState().surfaces[1] },
];
viewer.applyMotionFrame(frame, bindings,
  { basis: 'part-xyz-matches-rhyup' });
viewer.fit();
viewer.resetMotion();
```

The basis declaration means the caller's part XYZ/mm axes already match Viewer
right-handed Y-up/mm axes. Viewer does not infer an axis change. Translation is
in millimetres. The display order is native scale, quaternion rotation,
translation, then the shared `mmToSceneUnit` conversion. The GPU applies the
inverse scale to normals before rotation. Missing TRS parts use identity values.
`ViewerPoseFrame` and `VIEWER_POSE_LIMITS` are exported by Viewer. The frame
has exact `contextId`, `timeSeconds` and 1..4 unique target poses. It keeps
the accepted direct-frame shape: no wire version field is added. Time is
0..3600 seconds, translation is ±10000 mm, scale is 0.001..100 and rotation
is unit XYZW within 1e-9. Viewer has no dependency on a clip package.
`applyMotionFrame` requires a complete, one-to-one binding for the current
1..4 surfaces and frame poses. Invalid input or a rejected GPU update retains
the last accepted scene. `getState().motion` copies the frame, bindings, and
display poses separately from native data and preview packets. `resetMotion`
restores the identity display pose and keeps the camera and selection. A
successful `loadNative` or `setPackets` also clears the Motion pose. Sampling
and playback time remain with the caller.

`applyGeometryMotionFrame(frame, bindings, {basis:'part-xyz-matches-rhyup'})`
accepts one tagged Surface or Curve binding for every displayed object. It uses
the same caller-owned Viewer pose frame and TRS limits as `applyMotionFrame`.
`getState().geometryMotion` copies the accepted frame, bindings and display
poses. A successful call to either Motion method clears the other pose state.
`resetMotion()` and successful scene replacement clear both. Curve GPU pixels,
fit, approximate `pickGeometry()` and selection follow the tagged display pose;
native point measurements stay in authored XYZ/mm.

`fitGeometry({kind:'surface',modelId,surfaceId})` or
`fitGeometry({kind:'curve',modelId,curveId})` frames one currently displayed
object from its accepted packet or Curve sample. It follows the active display
pose and changes only the camera. The tagged reference must exactly match a
displayed object; hidden or stale refs are rejected. `fit()` still frames the
whole scene. Curve fitting uses sampled display bounds, not certified native
Curve bounds.

`getState().native` contains a copied native model and the exact source string.
For two points on the accepted native model, call
`measureNativeSurfacePoints({modelId,surfaceId,u,v}, {modelId,surfaceId,u,v})`.
The method uses the public CAD Surface evaluator on the original U/V knot
domains. It returns the two original parameters and native XYZ/mm points,
`distanceMM`, `space: 'native-authored'`, and
`certification: 'not-certified'`. `getState().measurement` contains a copied
last accepted result. A successful new load clears it. Invalid input leaves
the previous measurement, camera, selection, native data and pixels intact.
`setPackets` has no native model, so it cannot support this measurement.
An approximate `pick()` U/V can be passed to the method, but the pick remains
an approximate display selection. This result does not include a display pose
or assembly placement and does not drive a CAD dimension.

`measureNativeCurvePoints({modelId,curveId,t}, {modelId,curveId,t})` likewise
evaluates two original native Curve parameters and returns their XYZ/mm points
and straight chord `distanceMM`. The copied result uses
`metric: 'straight-chord'`, `space: 'native-authored'`, and
`certification: 'not-certified'`. It is not length along a Curve. The last
accepted result is separate at `getState().curveMeasurement`; a successful
new model load clears it. Curves remain hidden unless `curveDisplay` is given.
Invalid requests retain both measurement records and the scene.

`measureNativeSurfaceCurvePoints(surface, curve)` evaluates one original
Surface U/V and one original Curve t from the same accepted native Model.
Its copied native XYZ/mm points and Euclidean `distanceMM` use
`metric: 'straight-line'`, `space: 'native-authored'`, and
`certification: 'not-certified'`. The result is separate at
`getState().surfaceCurveMeasurement`. It is not a path along the Surface or
Curve. Invalid requests preserve all three measurement records and the scene;
successful model or packet acceptance clears all three.

`measureNativePoints(first, second)` accepts exact tagged records
`{kind:'surface',modelId,surfaceId,u,v}` or
`{kind:'curve',modelId,curveId,t}` in either order. It evaluates both
original native points and returns tagged refs, parameters, XYZ/mm, finite
`distanceMM`, `metric:'straight-line'`, `space:'native-authored'`, and
`certification:'not-certified'`. The copied latest result is available at
`getState().nativeMeasurement`. All three older pair-specific methods also
update this latest field while retaining their own last-result fields.
A generic call updates only the latest field. The caller owns any history.
Invalid, stale, wrong-kind or out-of-domain inputs leave all accepted state
and pixels unchanged; a successful scene replacement clears all four fields.
This is not Curve arc length, Surface geodesic, display/assembly distance or
a certified dimension.

`getState().packets` contains copied, unscaled preview packets for native or
generic input.
The current GPU scene backend requires distinct original `surfaceId` values
across all entries, including entries from different models.
Native Surface packets keep authored right-handed Y-up millimetres, surface IDs,
and original U/V parameter values. `mmToSceneUnit` converts each display XYZ
once. The generic `setPackets` entry has `{modelId, packet}` and no claimed
native model. Use a unique `(modelId, surfaceId)` pair for each surface.

The camera uses scene units. `fit`, `setView`, `orbit`, `pan`, and `zoom` update
the camera without editing native geometry. `fit` encloses the current displayed
Surface vertices and sampled Curve points, including Curve-only scenes, with a
30% sphere margin at a 45-degree vertical FOV. It uses a minimum
0.01 scene-unit radius for planar or degenerate bounds and sets near/far around
the full sphere. `pick` tests displayed triangles
and returns `approximate: true`, the surface reference, triangle index,
interpolated native U/V, scene position and a same-depth ambiguity flag. It is
not a CAD face or BRep query.

`pickGeometry({xCss,yCss},{curveTolerancePx?,kinds?})` compares displayed Surface
triangles and native sampled Curve line segments. The default Curve tolerance
is 4 CSS pixels; the accepted range is 0.5..16. Segments are clipped to the
camera frustum, tested against nearer opaque Surfaces and associated in screen
space with perspective-correct interpolation. A Curve result identifies its
qualified ref, sample segment, original parameter interval, approximate
parameter, displayed scene point, separately evaluated native XYZ/mm point,
scene depth, screen distance and ambiguity. It is not an exact ray/Curve
intersection, certified boundary, trim or topology result. Surface results
carry `kind:'surface'` and otherwise retain the `pick` fields. This call does
not change selection.

The exported `ViewerGeometryPickOptions.kinds` admits a dense ordinary array
of zero through two unique entries, `'surface'` and/or `'curve'`. Omit it to
query both kinds. `[]` returns `null` after point, options, canvas and lifecycle
validation. Explicit `kinds: undefined`, duplicate or unknown kinds, sparse arrays,
extra fields and accessors refuse. Only admitted kinds take part in hit ordering
and ambiguity. Visible opaque Surfaces still occlude Curves when `'surface'`
is excluded. Filters do not change visibility, poses, camera or selection;
`pick(xCss,yCss)` remains Surface-only.

Limits: one canvas and WebGL2 context; 1..4 total displayed Surface/Curve
objects; Surface packets at most 4096 total vertices and 24576 indices,
v0 sampled Curves at most 4096 total points and 4092 segments, or v1 at most
16388 total points and 16384 segments with a 4092-segment Loader request per
Curve; source text at
most 65536 characters; native grid
counts 2..17; canvas at most 4096 pixels per side and 4194304 pixels total.
`resize(width, height)` takes intrinsic pixel dimensions; it never multiplies
them by device pixel ratio.
Only `.barocad` source version 0 and preview packet version 0 are supported.
Unversioned Curve display uses the v0/16-pole profile; explicit display
version 1 accepts the native wide/64-pole profile. The caller owns the
canvas and source text; `dispose()` releases only viewer-owned GPU resources.
After WebGL context loss, `getState().status` reports `context-lost`; dispose and
create a new Viewer to render again.
No npm publication or release is implied by the public package metadata.

## Workspace development and explicit compiled checkpoints

Development main/types and the public root export resolve to source TypeScript.
Use a TS-capable bundler or runner with ordinary `@barocss/viewer` imports.
Plain Node does not automatically map internal `.js` source imports to `.ts`.
The complete `publishConfig` map targets emitted dist JS/declarations; local
configuration is not publication. Node22 `pnpm -r --filter @barocss/viewer... build:library` emits the affected dependencies and Viewer declarations.

Explicit compiled verification must resolve every transitive own package entry
through its published dist map, rather than bundle a dist root with source
workspace dependencies. The cloth example server has a separately labelled
compiled proof mode and records its actual input graph. Ordinary source mode
uses normal package resolution with no source aliases or custom condition.


## Selected native Shell graph

`loadShellGraph(graph, { basis: 'authored-xyz-matches-rhyup', entries })` displays zero through four current normal-extrusion graph leaves. Each entry supplies an exact `ref` (`graphId`, `graphRevision`, `featureId`, `outputSlotId`), bounded public native `mesh` options, RGB `color` and `edges: null` or `{ color }`. Viewer validates the complete current graph and uses the existing public Loader derivation to produce each original native mesh. It does not accept a foreign cached mesh as graph authority.

`getState().shell` copies `{ graph, scene, boundsScene }`. The native graph keeps authored intent and original embedded native source, not the original JSON whitespace. Derived display bounds are not certified native bounds. Zero selected entries and selected genuine empty leaves both have null bounds and empty status; their copied provenance differs. They retain the prior camera. Filled candidates fit their complete display bounds before one atomic same-canvas presentation. A failure keeps the accepted scene/camera/pixels. Existing successful loads and Clear replace Shell mode only after their GPU candidate succeeds.

Shell mode supports view/orbit/pan/zoom, attached camera controls, fit, resize and readPixels. Fit refuses when no filled bounds exist. This first mode has no Shell picking or selection. Primitive picking, non-null selection, visibility, individual/document fit, native primitive measurements/projection, assembly point queries, motion and Surface materials refuse. Null selection and null fluid/cloth frames are live no-ops; non-null simulation layers refuse. Primitive lists and bindings stay empty. Context loss retains copied CPU Shell data, retires its owned Shell backend while GL is lost, and refuses GPU operations; Dispose clears Shell state and releases the backend. No automatic context restoration, Solid/topology certification, hidden-line certification, assembly placement or editor transaction is implied.

See `examples/viewer-shell-scene` for the original authored graph consumer and bounded actual verification flow. Native implementation and separate local Integration acceptance are distinct.


## Single original Curve uniform preview

`loadUniformCurvePreview(dto, { basis: 'authored-xyz-matches-rhyup' })` accepts the public GPU `UniformCurvePreview` DTO0. Prepare it with `prepareUniformCurvePreview({ source, count })`. Viewer reconstructs the exact original Source0/native Model through the public validator and displays its one original Curve. This is the explicit nonadaptive profile `native-uniform-curve-v0`, not an adaptive error-tolerance certificate or a fabricated Loader result.

`getState().uniformCurve` returns an independent copy; `curveSampleVersion` is2. Original source/model/Curve IDs and Float64 observations remain separate from lowered Float32 display data. Viewer keeps its existing original-ID profile and refuses wider GPU IDs rather than aliasing them. This command accepts exactly one Curve, counts2..129, degree1..5/poles2..64/source64KiB. The independently available selected full-Model DTO1/sampleVersion3 is outside this command.

Fit, approximate screen picking, selection, visibility, geometry display pose and camera controls use the observed points. Native Curve measurements and native-point projection use the original current Curve and public CAD evaluation. Counts do not certify global approximation error, extrema, topology or exact raster/native picking. A new generation is admitted as one complete GPU candidate before copied state changes. A refusal keeps the old source/camera/pixels; successful replacement and Clear reset the old mode/layers. Uniform context loss keeps CPU provenance, retires the owned backend while GL is lost, and refuses GPU use after caller restoration until a fresh Viewer is made. Dispose clears this mode and remains idempotent.

See `examples/viewer-uniform-curve-scene` for original saved Source0 files and the bounded Viewer consumer. Native implementation, actual author verification and separate local Integration are recorded separately.

## Original native scene with initial display settings

`replaceNativeScene(candidate)` stages original authority, display pose, visibility and camera together. Its version0 source is either `{ kind: 'native', source, options, basis: 'authored-xyz-matches-rhyup' }` or `{ kind: 'document', result, options, bindings }`. Document input keeps the complete canonical result and uses the public Loader projection to rebuild selected original source previews. Supply all selected public `BaroCadDocumentPrimitiveBindingV2` records as expected pins; exact document/asset revisions, original model/geometry identity and frames must match. Display namespaces use the asset IDs; binding model names remain original. These are declared revision pins, not content hashes or a source history certificate.

The exact `display` record has `motion`, `visibleGeometry` and `camera`. Motion is null or `{ frame, bindings, basis: 'part-xyz-matches-rhyup' }` using the existing complete Geometry Motion contract for every admitted object, including hidden ones. Visibility is a unique subset of the1..4 admitted refs. An explicit camera is copied; null fits visible posed observations and refuses if all are hidden. An all-hidden candidate with a valid explicit camera keeps admitted native inventory. Native source and measurement coordinates remain original-local; display transforms apply mmToSceneUnit once.

One qualified GPU candidate succeeds before CPU state commits. Failed source/settings/allocation keep the prior source, display state, pixels and layers. Accepted replacement clears prior selection, measurements, materials and simulation modes. This first input does not restore appearance, model-set packets, assembly, Shell, uniform or SDF modes. A separate accepted generation and Clear reset its lifecycle ownership. Context loss keeps copied CPU authority and retires its backend while GL is lost; caller restoration does not remount it. Dispose clears this replacement generation's authority and inventory. See `examples/viewer-native-scene-replacement` for original file and display-setting verification. Render Editor Save/Open acceptance remains a separate consumer result.


### Selected uniform Curve with the complete original model

`loadSelectedUniformCurvePreview(dto, {basis: 'authored-xyz-matches-rhyup'})`
consumes public GPU `SelectedUniformCurvePreview` DTO1. Prepare it with
`prepareSelectedUniformCurvePreview({source, curveId, count})`. The complete
unchanged Source0/mm Model0 has1..4 original objects; only the named Curve is
drawn, fitted, picked and posed. Native degree1..5/count2..129 observations
are uniform display data, not an adaptive error certificate. No source
truncation, alias or fabricated native result is used.

`getState().selectedUniformCurve` holds an independent complete DTO1/model
copy; `uniformCurve` remains the old DTO0 field and is null in this mode.
`curveSampleVersion` is3 for this displayed Curve. Original unselected
Surfaces/Curves stay CPU authority. Existing native Surface/Curve/mixed-point
measurements may inspect them under current model/domain/ref limits; this
does not draw them or include them in fit. Projection/visibility/selection/
pose/picking use only the displayed selected Curve; hidden selected native
projection returns null after ref/domain validation. Approximate Curve picks
evaluate the original Curve at their estimated parameter.

Admission validates/reconstructs the complete source, prepares the selected
GPU candidate and commits CPU state only after presentation. A refusal keeps
the previous complete frame/source/layers. Success clears other source modes
and layers and advances the request generation. Other successful loads and
Clear reset DTO1; failed loads retain it. Context loss retires owned handles
and retains CPU source/native queries, with sticky GPU refusal after caller
restoration. Dispose clears this mode's source, inventory and measurements.
No automatic context recreation, retained-object rendering or material/
particle/cloth co-display is promised. See the independent selected-source
example under `examples/viewer-selected-uniform-curve-scene`.


### Original Sphere and native Surface with shared depth

`loadMixedDepthScene(input)` takes strict `ViewerMixedDepthInputV0`: version0,
complete original `sphereSource` (Source1), complete original `nativeSource`
(Source0/mm), existing three-field `native` options, selected original Surface
ref, Surface RGB, `nativeTranslateScene`, explicit camera and authored XYZ basis.
Only that Surface and the single Sphere are drawn. Public Loader rebuilds the
Surface packet from the complete original CAD model; a supplied foreign packet
is not accepted as native authority.

Native positions become `positionMM * mmToSceneUnit + nativeTranslateScene`.
The translation is in scene units. The original Sphere already uses scene units
and receives neither this scale nor translation. Source1-derived background
and shading apply to the mixed mode; Viewer background/lighting configuration
remains for other modes. `getState().mixedDepth` copies the complete original
native result and accepted public mixed frame, including the exact Sphere text.
Existing native Surface/Curve/mixed-point measurements can inspect all retained
original CAD objects, including CPU-only objects that are not drawn.

An explicit camera is required. Initial fit, primitive picking/projection/
selection, visibility, motion, materials, particles and cloth operations refuse
in this mode. The profile supports one Sphere and one Surface, at most289
Surface vertices/512triangles and1024 backing pixels per axis. Camera-inside,
Sphere clipping and travel limits come from the public GPU profile.

View/orbit/pan/zoom update the complete mixed frame and commit only on success.
Resize checks the provider's structured result. Cross-mode failure restores an
old mixed frame through public `updateFrame(getFrame())`; no private GPU target
or nonexistent `render()` is used. If recovery also fails, CPU authority stays,
but status is `unavailable` and GPU operations refuse. This status differs from
an actual `context-lost` event and requires a fresh Viewer. Available Clear
stages an empty primitive viewport before removing mixed metadata. Context
loss retires owned handles during loss and retains copied CPU data under sticky
GPU refusal. Dispose clears mixed source/inventory/measurements.

The bounded example is `examples/viewer-mixed-depth-scene`. A mixed framebuffer
is derived display; it does not certify native CAD intersection, full SDF
accuracy, parent topology, Physics, editor persistence or publication.


## Independent original Face assets

`loadQualifiedFaceScene(input)` takes `ViewerQualifiedFaceInputV0`: version0,
`basis: 'authored-xyz-matches-rhyup'`, 2–6 complete `assets`, `countU`,
`countV`, explicit `camera` and `translateScene`. Each asset has a unique
`sourceId`, complete original Source0 text, matching native `FaceBundle` and
RGB color. Public GPU preparation recompiles every original Model0, compares
its native values with the Face geometry, validates the forward Face and
tessellates its original Surface. Repeated local Face and Curve IDs remain
qualified by `sourceId`. This display does not form a global Shell or Solid.

Viewer applies its `mmToSceneUnit` once, followed by scene-unit translation.
Viewer background applies to this mode. `getState().qualifiedFaceScene`
returns a copy of the complete accepted scene and all original assets. The
old primitive inventory is empty. Legacy unqualified native queries refuse
this mode because local model and geometry IDs can repeat across assets.
Fit, primitive picking, selection, visibility, motion and simulation or
material layers also refuse. Callers can inspect each copied asset with
public CAD APIs under its explicit `sourceId`.

Camera changes and resize check complete GPU transaction results. CPU state
and URL generation commit after successful presentation. Failed recovery
retains CPU authority and reports `unavailable`; retained pixels are not
guaranteed in that status. Clear stages an empty primitive viewport. Actual
context loss retires the owned backend while the context is lost, retains
CPU copies and keeps GPU operations blocked after caller restoration.
Dispose clears the Face scene. The bounded original-file consumer is
`examples/viewer-qualified-face-scene`.

### Pinned native point distances across Face assets

`measureQualifiedFacePoints(first, second)` reads two original native points
from the current qualified Face scene. Each input pins `sourceId`, the exact
`expectedSource` text, `faceId`, original `modelId` and `geometryId`. A Surface
input uses `kind: 'surface', u, v`; a Curve input uses `kind: 'curve', t`.
Only plain own data fields are accepted. Original parameter domains apply.

The result copies both inputs and adds `pointMM` and `pointScene` to each.
`distanceMM` is the original authored XYZ straight chord. `distanceScene` is
that distance multiplied by the accepted scene scale. Point coordinates apply
scale and then scene translation once. The result reports the explicit basis
and `certification: 'not-certified'`. It does not measure arc length or geodesic
length. Same-source pairs are supported.

This query writes no measurement, selection, camera or GPU state. A changed
original source rejects an old content pin. Camera, color and sampling changes
keep unchanged source pins valid. Retained CPU authority remains queryable
after context loss or presentation failure; GPU operations stay blocked.
Clear, a successful mode replacement and Dispose remove this query scope.

### Project qualified points for caller-owned labels

`projectQualifiedFacePoint(input)` uses the same exact original source pin as
`measureQualifiedFacePoints`. It returns a version0 copied point with `xCss`,
`yCss` and positive `depthScene`, or `null` outside the accepted camera clip
interval or view rectangle. Source and parameter validation runs first.

Coordinates start at the canvas bounding-box top-left and use logical CSS
pixels with y down. Projection uses the backing width/height aspect ratio,
then maps to the current CSS bounding-box size. Right and bottom boundaries
are inclusive. Use a borderless, padding-free, axis-aligned canvas and overlay
for content alignment. Empty CSS size and sizes above4096 pixels refuse.

This analytic camera projection is approximate. It does not read GPU depth or
test occlusion. A projected label can lie behind another Face. The result says
`approximate: true` and `occlusion: 'not-tested'`; it does not certify a native
screen hit. The SDK writes no label, measurement or GPU state. Projection
refuses context loss or unavailable presentation, including after caller
restoration. CPU native measurement remains available under retained authority.

The example owns numbered point labels and a native-mm chord label. Labels
follow accepted camera/CSS changes and disappear for offscreen or stale points,
Clear, mode changes, unavailable display and Dispose. Its Help explains the
projection limit separately from concise visible label text.
