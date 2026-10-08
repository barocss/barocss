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
visibility with the same four-object document scene.

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

`pickGeometry({xCss,yCss},{curveTolerancePx?})` compares displayed Surface
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
