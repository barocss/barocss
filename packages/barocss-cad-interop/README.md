# @barocss/cad-interop

This experimental package turns BaroCSS CAD `PreviewPacket v0` data into
renderer buffers or a self-contained glTF 2.0 binary file (`.glb`). Its base
packet/GLB entry does not import CAD, GPU, Three.js, Babylon.js, or Pixi3D.
The `native` entry uses `@barocss/cad`; the `three` entry uses Three.js as an
optional peer dependency. The preview packet is shared by `@barocss/cad` and
`@barocss/gpu`.

## From CAD to a GLB

```js
import { tessellateSurface } from '@barocss/cad';
import { encodeCadPreviewGlb } from '@barocss/cad-interop';

const { packet, report } = tessellateSurface(surface, {
  countU: 16, countV: 16, revision: 1,
});
const glb = encodeCadPreviewGlb(packet); // ArrayBuffer
// In Node.js: writeFileSync('part.glb', new Uint8Array(glb));
```

Pass an array of 1..32 packets to put several surfaces in one GLB. Their
`surfaceId` values must be unique. Each surface becomes a separate mesh and node.

The CAD engine also emits `barocss-native-face-mesh` for native face previews.
Pass that result to the separate entry point:

```js
import { tessellateOwnPlateCircularHole } from '@barocss/cad';
import { encodeOwnNativeFaceMeshGlb, prepareOwnNativeFaceMesh } from '@barocss/cad-interop';

const { mesh: nativeMesh } = tessellateOwnPlateCircularHole(bundle, { context });
const prepared = prepareOwnNativeFaceMesh(nativeMesh, 'plate_display', 3);
const glb = encodeOwnNativeFaceMeshGlb(nativeMesh, 'plate_display', 3);
// prepared.packet is compatible with the shared CAD/GPU preview packet.
```

This path rotates CAD `part-xyz` into right-handed Y-up coordinates with
`(x, y, z) → (x, z, -y)`. The GLB node's `extras.barocss` keeps the result
context and each face's native ID, token, orientation, normal source, and
vertex/index ranges. These ranges identify display triangles. They do not
define native CAD edges or topology.

The output uses glTF's right-handed, Y-up coordinates and **metres**. CAD packet
positions in millimetres are multiplied by `0.001`. Normals and triangle order
are retained. The material is double-sided because CAD previews may be open
surfaces. Each node keeps `surfaceId`, `revision`, source unit, and the preview
marker in `extras.barocss`. Native CAD U/V parameters are stored in the custom
`_CAD_UV` vertex attribute. They are not texture coordinates. A target loader
may ignore that custom attribute.

## Load in a renderer

Three.js can parse the returned bytes directly:

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const gltf = await new GLTFLoader().parseAsync(glb, '');
scene.add(gltf.scene);
```

For Babylon.js, serve the GLB as `part.glb` and use its glTF loader:

```js
import { LoadAssetContainerAsync } from '@babylonjs/core/Loading/sceneLoader';
import '@babylonjs/loaders/glTF/2.0';

const container = await LoadAssetContainerAsync('/part.glb', scene);
container.addAllToScene();
```

Pixi3D's glTF loader can load the same served `part.glb` asset. PixiJS itself
is a 2D renderer; use a 3D extension or another glTF-capable engine to draw it.
Follow the loader API for the Pixi3D/PixiJS version in your application.

For an engine without a glTF loader, use owned typed arrays:

```js
import { prepareCadPreviewMesh } from '@barocss/cad-interop';

const { positions, normals, indices, parameters } =
  prepareCadPreviewMesh(packet, 0.001); // scene units per millimetre
// Upload the arrays to your renderer. `parameters` are native CAD U/V values.
```

The scale argument is required for direct buffers. The package does not choose
a camera, light, shader, or renderer state.

## Scope and verification

The input is the existing JSON-compatible `PreviewPacket v0`. Validation checks
the schema, array sizes, finite values, exact bounds, normals, triangle indices,
winding, and Float32 conversion before output. It rejects unsupported versions
and malformed meshes. Outputs own their data. Arbitrary JavaScript Proxy traps
are outside this data boundary.

The GLB contains a **tessellated display preview**. It does not contain the
original NURBS, CAD feature graph, B-Rep, or IGES data. Keep the native CAD
model for later editing or exact exchange.

Run `pnpm --filter @barocss/cad-interop test` for packet, GLB, and Three.js
checks. Run `pnpm --filter @barocss/cad-interop test:integration` for real
CAD surface and native face mesh → GPU packet → GLB → Three.js paths. A generated GLB also passed the
Khronos glTF Validator with no errors or warnings in the local integration
check. Babylon.js and Pixi3D loading are documented from their loader contracts;
they have not been run in this repository.

This package has public npm configuration, but it has not been published.
Version `0.0.0-experimental` marks the current API as experimental. Publication
requires a separate release decision and checks of that exact release artifact.

## Load native BaroCAD source

The optional `native` entry reads the existing CAD `@model` text. Use a
`.barocad` extension when serving that text as a file. This first loader accepts
only `sourceVersion: 0`, one to four native surfaces by default, and 2–17
samples on each surface axis. It compiles with `@barocss/cad` and retains the
exact input text and native NURBS model. By default, valid curves stay in
`model.objects` and appear in `unrenderedCurveIds` without display lines.

```js
import { parseBaroCadSource } from '@barocss/cad-interop/native';

const source = await (await fetch('/two-surfaces.barocad')).text();
const result = parseBaroCadSource(source, {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
});
// result.model is native CAD data; result.surfaces contain display-only packets
// and owned renderer buffers. The original source is result.source.
```

For a URL, use the same neutral entry without creating a Three.js or Babylon.js
loader:

```js
import { loadBaroCadSource } from '@barocss/cad-interop/native';

const controller = new AbortController();
const result = await loadBaroCadSource('/two-surfaces.barocad', {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
}, { signal: controller.signal });
// result has the same source, model, surfaces, curves and unrenderedCurveIds
// as parseBaroCadSource. It owns ordinary data and needs no dispose call.
```

The parse options are required. Their values, including nested `curveDisplay`
values, and the transport fields are checked and copied before the request.
Later changes to those caller objects do not change the pending load. The
signal itself stays live so the caller can cancel. This URL path shares the
bounded transport, progress callback, abort and UTF-8 rules described below.
It does not import a renderer or change the native model. Run the affected
build and `node packages/barocss-cad-interop/test/native-url-loader.test.mjs`
from the workspace root for the included real-file local HTTP flow. The
`examples/neutral-native-url.html` browser page shows cancellation followed
by a successful load and the original object IDs.

`@barocss/cad-interop/three` is the Three.js adapter. Install `three` in the
host application, then add the returned group to a scene:

```js
import { BaroCADLoader } from '@barocss/cad-interop/three';

const loader = new BaroCADLoader({
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
});
const result = await loader.loadAsync('/two-surfaces.barocad');
scene.add(result.group);
// The same loader can parse already loaded text: loader.parse(source).
```

The returned `group` contains one `Mesh` per native surface, named by its
surface ID. Its `_CAD_UV` attribute contains native NURBS U/V parameters, not
texture UVs. The `model` and `source` are returned beside the group; the mesh
does not replace them. This first `@model` loader expects authored XYZ values
to be intended as right-handed Y-up. The CAD surface preview API keeps native
XYZ unchanged and labels its packet Y-up; it does not infer the author's up
axis. This loader applies the requested millimetre scale once and does not
rotate the surface. A Z-up `@model` needs an explicit frame conversion outside
this loader before display. The separate `part-xyz` native face mesh path above
does rotate its input once. Call `result.dispose()` when the display is no
longer needed. It removes the result group and disposes its own geometry and
materials, not the caller scene.

Invalid syntax throws `BaroCadSourceError` with compiler diagnostics and
source ranges. Unsupported source versions, surface counts, sample counts,
or unsafe Float32 display conversions throw before a result is returned.
File network errors reach the loader's `onError` callback or reject
`loadAsync`. Three.js is an optional peer dependency because the neutral
entry does not import it. The Babylon native adapter is described below;
Pixi3D currently uses the separate GLB path above.

Run `pnpm --filter @barocss/cad-interop test:native` to check the included
native source file, its model and display data, Three.js objects, and a local
URL load. Node.js 22 is used for this check.

## Load native source in Babylon.js

Install `@babylonjs/core@9.29.0` in the host application. The optional
`@barocss/cad-interop/babylon` entry is separate from the neutral and Three.js
entries. Set the caller's scene to right-handed mode before loading. The loader
checks this setting and never changes it:

```js
import { BaroCADBabylonLoader } from '@barocss/cad-interop/babylon';

scene.useRightHandedSystem = true;
const loader = new BaroCADBabylonLoader(scene, {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
});
const result = await loader.loadAsync('/two-surfaces.barocad');
// Or parse text already in memory: loader.parse(source).
// result.model and result.source retain the native CAD data.
// result.meshes contain Babylon display meshes.
result.dispose(); // Releases only meshes and material created by this result.
```

The Babylon adapter uses the same native source reader as the Three.js adapter.
It accepts sourceVersion 0 with 1–4 surfaces and 2–17 samples per axis by
default. Native curves stay in `model.objects` and `unrenderedCurveIds` unless
the caller explicitly enables Curve display below.
Each Babylon mesh has qualified `metadata.barocss` with the model and surface
IDs. `nativeParameters` is an owned copy of the NURBS U/V samples. It is not a
texture UV buffer. Scene mesh names are display labels and need not be unique.

Authored `@model` XYZ must be intended as right-handed Y-up. The native surface
packet keeps those XYZ values unchanged, and this loader applies the requested
millimetre scale once. It does not apply the separate `part-xyz` face-mesh
rotation. Wrong scene handedness, invalid source/options, unsafe Float32 data,
and failed URL requests return no new scene objects. Successful results own
their meshes and one material. `dispose()` is idempotent and leaves the caller's
scene, engine, other meshes, and other materials alive. A caller who adds other
resources to the scene remains responsible for them.

The included `examples/babylon-native.mjs` uses Babylon's CPU `NullEngine` to
show the source-to-mesh path. Run
`pnpm --filter @barocss/cad-interop test:babylon` for the actual native file,
Babylon mesh data, local URL loading, refusal cases, and disposal checks.
`NullEngine` does not prove visible browser rendering or GPU performance.

## Opt-in native Curve display

Use the same `curveDisplay` option with `parseBaroCadSource`, `BaroCADLoader`,
or `BaroCADBabylonLoader`. This mode accepts Curve-only and mixed models with
1–4 total Curve/Surface objects. The original source, model, object order,
IDs, knots, weights, signed zero, and parameter domains remain authoritative.
Default calls still display surfaces only.

```js
const options = {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 },
};
const result = new BaroCADLoader(options).parse(source);
scene.add(result.group); // Surface Mesh plus native Curve Line objects
// result.curves holds the CAD661 sample records and renderer-unit Float32 XYZ.
// result.model and result.source retain the original native input.
result.dispose();
```

Three.js returns `Line` children. Babylon.js returns `LinesMesh` objects in
`result.meshes` and requires a caller-owned right-handed scene. Curve metadata
has the original Curve ID, native sample parameters and native intervals;
these are not texture UVs or certified B-Rep edges. The positions use authored
XYZ with millimetres scaled once. Z-up source needs an explicit host transform.
`curveDisplay` requires a finite `chordToleranceMM` in 1e-7..1000, integer
`maxSegments` in 1..1024 and integer `maxDepth` in 0..16. CAD661 also requires
degree 1..3, 2..16 poles, at most eight positive clamped spans, and its own
native input guards. Total display Curve points are limited to 4096 and
segments to 4092. Invalid samples, generated ID prefix conflicts, unsafe
Float32 positions and collapsed display segments reject the whole candidate
before target objects are created. Fixed generated prefixes are `bcv0c0` through
`bcv0c3`, based on original object order; a model or object ID matching a
prefix or starting with that prefix plus `_` is rejected.

These lines are display approximations from actual native adaptive samples.
The report contains finite chord estimates and local observations. It does
not certify a global tolerance, topology edge, smoothness or manufacturing
accuracy. Run `pnpm --filter @barocss/cad-interop build:library` and then
`pnpm --filter @barocss/cad-interop test:curve` for the included real source
files, Three/Babylon objects, local URL loading, disposal and bounded refusals.

## Cancel a native URL load

The Three and Babylon adapters each add `loadAbortable(url, transport)`.
This explicit method leaves their existing `load` and `loadAsync` methods
unchanged. The transport object is separate from native parse options:

```js
const controller = new AbortController();
const pending = loader.loadAbortable('/curve-display.barocad', {
  signal: controller.signal,
  onProgress({ url, loadedBytes, declaredTotalBytes }) {
    // Byte progress for this URL only; not CAD geometry progress.
  },
});
// On model change before completion: controller.abort().
const result = await pending;
result.dispose();
```

The signal can be omitted. `onProgress` may return `false` to stop loading;
that and signal cancellation reject with `name: 'AbortError'` and
`code: 'ABORT_ERR'`. A thrown callback error is passed to the caller unless
the signal has also been aborted. Independent loads do not cancel each other.
An abort after display creation but before delivery disposes only that new
result. A caller's scene, engine, existing result, and abort controller remain
the caller's property.

The method reads at most 262144 actual bytes and 4096 streamed chunks. A
valid `Content-Length` is reported as a hint and can trigger early refusal;
the actual byte count is still checked. It rejects responses without a
readable stream instead of allocating an unbounded fallback buffer. UTF-8 is
decoded strictly. Invalid URL, transport fields, HTTP status, source text,
byte count, and decode errors reject before returning a result. The method
does not set a timeout; the caller controls cancellation. Run
`pnpm --filter @barocss/cad-interop test:abortable` after the affected build
for the real local-file HTTP cancellation and resource flow.

References: [Babylon.js package](https://www.npmjs.com/package/@babylonjs/core),
[Babylon.js right-handed scene guidance](https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF/),
[Babylon.js custom mesh documentation](https://doc.babylonjs.com/features/featuresDeepDive/mesh/creation/custom/).

References: [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html),
[Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html),
[Babylon.js glTF loader](https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF/),
[Pixi3D glTF loading](https://github.com/jnsmalm/pixi3d).
