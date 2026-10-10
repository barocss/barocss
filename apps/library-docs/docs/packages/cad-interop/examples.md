# CAD Interop: retain native source and own target display objects

Use the neutral loader to preserve complete native data and derive bounded previews. Use a target adapter when the application already owns a Three, Babylon or Pixi3D scene. The adapter owns its loaded objects/resources; the application keeps its renderer, camera, scene and unrelated objects.

## Parse complete source and derive a preview

Use a TypeScript-capable bundler with the workspace `@barocss/cad-interop` and CAD dependencies. This complete Source0 input contains a Surface and a Curve with a nonunit knot domain.

```ts
import { parseBaroCadSource, BaroCadSourceError } from '@barocss/cad-interop/native';
import type { BaroCadParseOptions } from '@barocss/cad-interop/native';

const source = `@model panel_demo {
  version: 0; length-unit: mm;
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,0,40]],[[100,0,0],[100,0,40]]];
    weights: [[1,1],[1,1]];
  }
  @curve #edge {
    type: nurbs; degree: 1; knots: [-3,-3,7,7];
    control-points: [[0,0,0],[100,0,0]]; weights: [1,1];
  }
}`;
const options: BaroCadParseOptions = {
  sourceVersion: 0, countU: 3, countV: 3, unitsPerMillimeter: 0.001,
  nativeCapacity: { version: 1, maximumObjects: 16 },
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 64, maxDepth: 8 },
};
let accepted = parseBaroCadSource(source, options);
console.log(accepted.model.name); // panel_demo.
console.log(accepted.surfaces.map(surface => surface.surfaceId)); // ['panel'].
console.log(accepted.curves.map(curve => curve.curveId)); // ['edge'].
function applySource(text: string) {
  try { accepted = parseBaroCadSource(text, options); }
  catch (error) {
    if (error instanceof BaroCadSourceError) console.error(error.diagnostics);
    else throw error;
  }
}
```

`source` retains complete original text and `model` retains original coefficients/IDs. The 3×3 Surface preview contains9 XYZ vertices and 8 triangles. Native width 100 mm becomes 0.1 display unit at the declared scale. Curve samples retain original parameters in `[-3,7]`; they are not normalized texture coordinates. Without explicit Curve display options, the native Curve stays in the Model but has no derived display line.

Assignment happens only after successful parsing. A refused candidate leaves the host's accepted result intact. Neutral results are copied CPU data and have no target renderer to dispose. Preview buffers are derived approximations, not replacement native authoring.

## Add a loaded Group to a caller-owned Three scene {#run-the-existing-three-host}

The `/three` entry requires the compatible Three peer (`^0.186.1` in this package profile). The application supplies the Scene, camera and renderer through its ordinary browser bundler. Use the full `source` and `options` above:

```ts
import { Scene, PerspectiveCamera, WebGLRenderer } from 'three';
import { BaroCADLoader } from '@barocss/cad-interop/three';

const scene = new Scene();
const camera = new PerspectiveCamera(45, 640 / 360, 0.001, 10);
camera.position.set(0.2, 0.15, 0.2);
camera.lookAt(0.05, 0, 0.02);
const renderer = new WebGLRenderer();
renderer.setSize(640, 360);
document.body.append(renderer.domElement);
const loader = new BaroCADLoader(options);
const loaded = loader.parse(source);
scene.add(loaded.group);
renderer.render(scene, camera);
// When this model closes: loaded.dispose().
// When the application closes: renderer.dispose() and remove its canvas.
```

The Group contains the original Surface Mesh and the requested Curve Line, with names `panel` and `edge`. The native Model still contains both objects. Surface `_CAD_UV` data contains native parameters rather than texture UVs. Target picking on a sampled line/triangle is a display query, not an exact native intersection.

For replacement, parse the candidate before removing the accepted Group. Keep the old result if parsing/admission fails. On success, attach the candidate and dispose the previous result at your host's presentation boundary. `loaded.dispose()` removes its Group and releases owned geometry/materials; it does not destroy your Scene, camera, renderer or unrelated objects.

## Load a URL with caller-owned cancellation

```ts
import { loadBaroCadSource, BaroCadLoadAbortError } from '@barocss/cad-interop/native';
const controller = new AbortController();
try {
  const loaded = await loadBaroCadSource('/part.barocad', options, { signal: controller.signal });
  console.log(loaded.model.name);
} catch (error) {
  if (!(error instanceof BaroCadLoadAbortError)) throw error;
}
// On cancellation or document close: controller.abort().
```

The host serves complete Source0 text at its URL and owns selection, cancellation and stale-response decisions. Transport success is not native admission; both must succeed before replacing accepted content. Choosing a different target requires that target's public adapter and supported peer/basis, not a cast of the Three result.

![Original CAD Surface displayed through a derived GPU mesh](/examples/cad-surface.png)

The [CAD Surface example](/playground#cad-surface) shows original source beside a derived GPU mesh. This picture illustrates model/mesh/image roles; it uses a different Surface and render path from the Three example above. It is not a Three, Babylon, Pixi3D or exported-file result.

[API](./api) · [Public signatures](./reference) · [Limits and errors](./limits)
