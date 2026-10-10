# Viewer: prepare native input and display it

## Task 1 — inspect the original midpoint before creating a Viewer

Run from the repository root with Node 22+ and the existing app-local esbuild runtime. The runner reads ordinary public source export maps and transforms TypeScript; it does not install or publish packages.

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/viewer-example.ts
```

The complete runnable file is shown below. Its expected values come from the fixed API and inputs. This CPU command succeeded on Node22.22.0 at the fixed source pin in #1270. Its native receipt records the actual output and zero own dist inputs. A successful CPU task does not prove browser pixels.


```ts
import { createViewer } from '@barocss/viewer';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { evaluateSurface } from '@barocss/cad';
const source = `@model panel_demo {
  version: 0; length-unit: mm;
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,0,40]],[[100,0,0],[100,0,40]]];
    weights: [[1,1],[1,1]];
  }
}`;
const result = parseBaroCadSource(source, { sourceVersion: 0,
  countU: 3, countV: 3, unitsPerMillimeter: 0.001 });
const surface = result.model.objects.find(object => object.kind === 'surface');
if (!surface || surface.kind !== 'surface') throw new Error('Expected native Surface');
const midpoint = evaluateSurface(surface, 0.5, 0.5);
if (midpoint[0] !== 50 || midpoint[1] !== 0 || midpoint[2] !== 20) throw new Error('Unexpected native midpoint');
console.log(JSON.stringify({ task: 'viewer-native-input', model: result.model.name,
  surface: surface.id, midpointMM: midpoint, sampledSurfaces: result.surfaces.length,
  factoryAvailable: typeof createViewer === 'function', viewerInstantiated: false,
  rendered: false }, null, 2));
```

Expect model `panel_demo`, Surface `panel`, one sampled Surface and `midpointMM:[50,0,20]`. Both knot domains are `[0,1]`; U=0.5/V=0.5 is the midpoint of the original 100×40 mm bilinear panel. Native coordinates have not been converted to scene units. The loader's display mesh is separately scaled by 0.001.

`factoryAvailable:true` means the public Viewer factory imported. `viewerInstantiated:false` and `rendered:false` are deliberate: this CPU task uses real CAD/loader APIs to prepare Viewer input. It uses no fake canvas and does not test Viewer presentation.

## Task 2 — display, clear and reload the same complete source

Use a genuine WebGL2 canvas in a configured browser source host. Supply `<canvas id="canvas" width="640" height="360" style="width:640px;height:360px"></canvas>` in the host HTML. Set the module's `source` to the exact complete model string in Task 1; do not replace it with sampled buffers.

```ts
import { createViewer } from '@barocss/viewer';
const source = `@model panel_demo {
  version: 0; length-unit: mm;
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,0,40]],[[100,0,0],[100,0,40]]];
    weights: [[1,1],[1,1]];
  }
}`;
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const viewer = createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.04, 0.06, 0.1] });
try {
  viewer.loadNative(source, { sourceVersion: 0, countU: 3, countV: 3 });
  viewer.fit();
  console.log(viewer.getState().status, viewer.getState().surfaces);
  viewer.clear();
  console.log(viewer.getState().status); // empty, with a real background frame.
  viewer.loadNative(source, { sourceVersion: 0, countU: 3, countV: 3 });
  viewer.fit();
} catch (error) {
  console.error(error);
}
canvas.tabIndex = 0;
canvas.style.touchAction = 'none';
const pointer = viewer.attachPointerControls({ onError: console.error });
const keyboard = viewer.attachKeyboardControls({ onError: console.error });
window.addEventListener('pagehide', () => {
  keyboard.dispose(); pointer.dispose(); viewer.dispose();
}, { once: true });
```

Expect `ready` with reference `{modelId:'panel_demo',surfaceId:'panel'}`, then `empty` after Clear, then the panel again after reload. Drag to orbit, Shift-drag to pan, and focus the canvas for F/Escape. A pick uses canvas-local CSS pixels and a sampled triangle; it cannot certify an exact native ray hit. A successful native midpoint evaluation from Task 1 cannot certify this screen flow.

An existing complete host is `examples/viewer-scene/README.md`; its source and compiled resolution, camera and file setup are recorded there. Do not run legacy compiled hosts before supplying their compiled dependencies.

## Related actual image

![CAD Surface displayed by the playground's GPU mesh path](/examples/cad-surface.png)

The [playground](/playground) shows original CAD input beside actual GPU mesh output. This image explains the native-to-display boundary. The capture uses the playground's renderer path, not the Viewer package or this exact Task 2 camera. Viewer frame/selection/lifecycle acceptance requires its own real canvas flow.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. Public declarations: [API](./api) · [Exact public reference](./reference). Read [limits and errors](./limits) before changing the input profile.
