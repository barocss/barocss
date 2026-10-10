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

This standalone browser recipe has not been executed for #1295. The Task 1 CPU receipt remains separate. Use a shell with Node22+ and the existing app-local esbuild/TypeScript runtime. No dependency installation or package prebuild is part of this recipe. Start from the repository root.

### Save the host and entry

Create the ignored local directory:

```sh
mkdir -p apps/library-docs/docs/.vitepress/cache/manual-viewer
```

Save this complete HTML as `apps/library-docs/docs/.vitepress/cache/manual-viewer/index.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Viewer native panel</title>
  <style>
    body { font: 16px system-ui; margin: 20px; }
    canvas { display: block; width: 640px; height: 360px; }
  </style>
</head>
<body>
  <h1>Viewer native panel</h1>
  <p>Open the browser developer console to inspect the task results.</p>
  <canvas id="canvas" width="640" height="360" aria-label="Viewer native panel"></canvas>
  <script type="module" src="./bundle.js"></script>
</body>
</html>
```

Save the following complete module as `apps/library-docs/docs/.vitepress/cache/manual-viewer/entry.ts`. Keep it standalone with ordinary bare public package imports. The snapshot fallback refuses relative consumer imports; do not add imports from another local entry or an internal package helper.

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

### Bundle and serve

Run this one-off command from the repository root in the same Node22+ shell:

```sh
node --input-type=module <<'JS'
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bundleExample } from './apps/library-docs/scripts/example-runtime.mjs';
if (Number(process.versions.node.split('.')[0]) < 22) throw new Error('Use Node22 or later');
const directory = resolve('apps/library-docs/docs/.vitepress/cache/manual-viewer');
const { result, provenance } = await bundleExample(resolve(directory, 'entry.ts'), 'browser');
await writeFile(resolve(directory, 'bundle.js'), result.outputFiles[0].contents);
console.log(JSON.stringify(provenance, null, 2));
JS
```

This command transforms the entry and writes browser ESM; it does not execute a canvas API in Node. The helper resolves actual public source export maps and verifies consumed source against pin `5f5ad866205a21510ac69552e704cc162fa253b5`. If current package trees differ, it materializes that exact Git snapshot in its ignored cache. It uses no moving branch, source alias or custom source condition. A missing pinned Git object or changed cache is a setup refusal; do not substitute current source silently.

Start the existing Python static server from the repository root:

```sh
python3 -m http.server 52939 --bind 127.0.0.1 --directory apps/library-docs/docs/.vitepress/cache/manual-viewer
```

Open [http://127.0.0.1:52939/](http://127.0.0.1:52939/). Python serves `index.html` and `bundle.js`; the browser executes the module on a genuine WebGL2 canvas. If the port is occupied, preserve the other process and choose a free port in both the command and URL. Close the page for its owned cleanup, then press Ctrl+C in the server terminal. This server runs only until stopped; it is not a documentation deployment.



Expect the console to report `ready` with reference `{modelId:'panel_demo',surfaceId:'panel'}`, then `empty` after Clear. After the module completes, expect the reloaded panel. Clear and reload submit frames synchronously, so the browser need not show the intermediate blank image. Drag to orbit, Shift-drag to pan, and focus the canvas for F/Escape. A pick uses canvas-local CSS pixels and a sampled triangle; it cannot certify an exact native ray hit. A successful native midpoint evaluation from Task 1 cannot certify this screen flow.

An existing complete host is `examples/viewer-scene/README.md`; its source and compiled resolution, camera and file setup are recorded there. Do not run legacy compiled hosts before supplying their compiled dependencies.

## Related actual image

![CAD Surface displayed by the playground's GPU mesh path](/examples/cad-surface.png)

The [playground](/playground) shows original CAD input beside actual GPU mesh output. This image explains the native-to-display boundary. The capture uses the playground's renderer path, not the Viewer package or this exact Task 2 camera. Viewer frame/selection/lifecycle acceptance requires its own real canvas flow.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. Public declarations: [API](./api) · [Exact public reference](./reference). Read [limits and errors](./limits) before changing the input profile.
