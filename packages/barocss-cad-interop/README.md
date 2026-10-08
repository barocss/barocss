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
only `sourceVersion: 0`, one to four native surfaces, and 2–17 samples on each
surface axis. It compiles with `@barocss/cad` and retains the exact input text
and native NURBS model. Valid curves stay in `model.objects` and appear in
`unrenderedCurveIds`; this version does not draw them.

```js
import { parseBaroCadSource } from '@barocss/cad-interop/native';

const source = await (await fetch('/two-surfaces.barocad')).text();
const result = parseBaroCadSource(source, {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
});
// result.model is native CAD data; result.surfaces contain display-only packets
// and owned renderer buffers. The original source is result.source.
```

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
does not replace them. The compiler's surface preview packet is already
right-handed Y-up, so this path applies the requested millimetre scale once
without rotating it. The separate native face mesh path above has its own
`part-xyz` rotation. Dispose each child mesh's geometry and material when it
is no longer needed.

Invalid syntax throws `BaroCadSourceError` with compiler diagnostics and
source ranges. Unsupported source versions, surface counts, sample counts,
or unsafe Float32 display conversions throw before a result is returned.
File network errors reach the loader's `onError` callback or reject
`loadAsync`. Three.js is an optional peer dependency because the neutral
entry does not import it. Babylon.js and Pixi3D native source adapters are
future work; their GLB loading path above is separate.

Run `pnpm --filter @barocss/cad-interop test:native` to check the included
native source file, its model and display data, Three.js objects, and a local
URL load. Node.js 22 is used for this check.

References: [glTF 2.0 specification](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html),
[Three.js GLTFLoader](https://threejs.org/docs/pages/GLTFLoader.html),
[Babylon.js glTF loader](https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF/),
[Pixi3D glTF loading](https://github.com/jnsmalm/pixi3d).
