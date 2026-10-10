# Load native source and display it in Three

Use the repository workspace with Node22+ and its existing TS-capable browser host. Public `@barocss/cad-interop/*` imports select source and transitive CAD source without a prebuild, alias or source condition. Plain Node alone does not resolve the internal `.js` specifiers to `.ts`.

## Parse neutral native data

```ts
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import type { BaroCadParseOptions } from '@barocss/cad-interop/native';

const options: BaroCadParseOptions = {
  sourceVersion: 0,
  countU: 8, countV: 8,
  unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 },
  nativeCapacity: { version: 1, maximumObjects: 16 },
};
const response = await fetch('/part.barocad');
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const source = await response.text();
const native = parseBaroCadSource(source, options);
console.log(native.model.name, native.model.objects.map(object => object.id));
```

Serve your actual native source0 text at `/part.barocad`, or use [the authentic saved five-Curve example](./examples#run-the-existing-three-host). This fetch is host code; for bounded transport/cancellation use [the neutral URL loader](./guides#load-a-url-and-cancel-it).

The result retains exact `source`, native `model`, Surface packets/reports/buffers, Curve samples/positions and `unrenderedCurveIds`. Neutral results own CPU data and need no renderer `dispose()` call. Surface-only mode without `curveDisplay` retains unrendered Curves. Curve-only display requires an explicit Curve profile.

## Add adapter-owned objects to a caller-owned Scene

```ts
import { Scene } from 'three';
import { BaroCADLoader } from '@barocss/cad-interop/three';

const scene = new Scene();
const display = new BaroCADLoader(options).parse(source);
scene.add(display.group);
// Your renderer and camera display the Scene.
// On replacement or teardown:
display.dispose();
```

The adapter uses the selected Three peer; the actual repository checkpoint uses Three0.186.1, with manifest range `^0.186.1`. You supply the renderer, canvas, camera and render loop. Surface children are Mesh objects; enabled Curve children are Line objects. They retain native IDs in source order. `dispose()` detaches/clears the owned Group and releases its geometry/material resources once. It preserves the caller Scene and unrelated objects.

`unitsPerMillimeter:0.001` means metres per mm. The host must intend the declared right-handed Y-up convention. Do not scale twice or treat camera fit as a native model edit.

## Understand capacity before loading

Without `nativeCapacity`, Curve display admits1..4 total native objects. Surface-only mode admits1..4 Surfaces and retains unrendered Curves. The explicit profile is exactly version1/maximumObjects16; it counts rendered and unrendered native objects. It does not change source syntax, sample/Float32 limits or separate document/model-set/GLB budgets.

Next: [atomic replacement](./guides#replace-a-display-after-success), [run the saved host](./examples#run-the-existing-three-host), or [error boundaries](./limits).

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad-interop/package.json` (Manifest; local source), [public root](/packages/cad-interop/reference#declarations-9cb9edb1215a), `packages/barocss-cad-interop/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
