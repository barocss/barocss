# @barocss/viewer

Experimental WebGL2 viewer for bounded BaroCAD Surface previews. It uses the public
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

`getState().native` contains a copied native model and the exact source string.
`getState().packets` contains copied, unscaled preview packets for native or
generic input.
The current GPU scene backend requires distinct original `surfaceId` values
across all entries, including entries from different models.
Native Surface packets keep authored right-handed Y-up millimetres, surface IDs,
and original U/V parameter values. `mmToSceneUnit` converts each display XYZ
once. The generic `setPackets` entry has `{modelId, packet}` and no claimed
native model. Use a unique `(modelId, surfaceId)` pair for each surface.

The camera uses scene units. `fit`, `setView`, `orbit`, `pan`, and `zoom` update
the camera without editing native geometry. `fit` encloses the scaled packet
bounds with a 30% sphere margin at a 45-degree vertical FOV. It uses a minimum
0.01 scene-unit radius for planar or degenerate bounds and sets near/far around
the full sphere. `pick` tests displayed triangles
and returns `approximate: true`, the surface reference, triangle index,
interpolated native U/V, scene position and a same-depth ambiguity flag. It is
not a CAD face or BRep query.

Limits: one canvas and WebGL2 context; 1..4 Surface packets, at most 4096 total
vertices and 24576 indices; source text at most 65536 characters; native grid
counts 2..17; canvas at most 4096 pixels per side and 4194304 pixels total.
`resize(width, height)` takes intrinsic pixel dimensions; it never multiplies
them by device pixel ratio.
Only `.barocad` source version 0 and preview packet version 0 are supported.
Curves remain in the native model but are not displayed. The caller owns the
canvas and source text; `dispose()` releases only viewer-owned GPU resources.
After WebGL context loss, `getState().status` reports `context-lost`; dispose and
create a new Viewer to render again.
No npm publication or release is implied by the public package metadata.
