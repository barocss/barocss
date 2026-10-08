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

To display genuine native Curve samples in the same scene, opt in during load:

```js
viewer.loadNative(sourceText, { sourceVersion: 0, countU: 8, countV: 8,
  curveDisplay: { chordToleranceMM: 2, maxSegments: 256, maxDepth: 10 } });
const hit = viewer.pickGeometry({ xCss: 120, yCss: 80 }, { curveTolerancePx: 4 });
// hit.kind is 'surface' or 'curve'; neither kind changes selection by itself.
```

The original three-field load still renders only Surfaces. With `curveDisplay`,
Loader's complete native sampling result goes to GPU's mixed primitive scene;
Curves are not fabricated as Surface packets. `getState().curves` lists the
qualified displayed Curve IDs. Curve-only source0 Models can be displayed and
fitted. `getState().packets` and `surfaces` remain Surface-only. `select` and
`pick` remain Surface-only, including in a mixed scene.

For a sampled Motion frame, bind each Motion target to exactly one displayed surface:

```js
import { createMotionClip, sampleMotionClip } from '@barocss/motion';

const clip = createMotionClip(clipInput);
const bindings = [
  { contextId: clip.contextId, targetId: 'part-a', ref: viewer.getState().surfaces[0] },
  { contextId: clip.contextId, targetId: 'part-b', ref: viewer.getState().surfaces[1] },
];
viewer.applyMotionFrame(sampleMotionClip(clip, 2), bindings,
  { basis: 'part-xyz-matches-rhyup' });
viewer.fit();
viewer.resetMotion();
```

The basis declaration means the Motion part XYZ/mm axes already match Viewer
right-handed Y-up/mm axes. Viewer does not infer an axis change. Translation is
in millimetres. The display order is native scale, quaternion rotation,
translation, then the shared `mmToSceneUnit` conversion. The GPU applies the
inverse scale to normals before rotation. Missing TRS parts use identity values.
`applyMotionFrame` requires a complete, one-to-one binding for the current
1..4 surfaces and frame poses. Invalid input or a rejected GPU update retains
the last accepted scene. `getState().motion` copies the frame, bindings, and
display poses separately from native data and preview packets. `resetMotion`
restores the identity display pose and keeps the camera and selection. A
successful `loadNative` or `setPackets` also clears the Motion pose. Sampling
and playback time remain with the caller.

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
sampled Curves at most 4096 total points and 4092 segments; source text at
most 65536 characters; native grid
counts 2..17; canvas at most 4096 pixels per side and 4194304 pixels total.
`resize(width, height)` takes intrinsic pixel dimensions; it never multiplies
them by device pixel ratio.
Only `.barocad` source version 0, preview packet version 0 and the current
native Curve sample v0/16-pole profile are supported. The caller owns the
canvas and source text; `dispose()` releases only viewer-owned GPU resources.
After WebGL context loss, `getState().status` reports `context-lost`; dispose and
create a new Viewer to render again.
No npm publication or release is implied by the public package metadata.
