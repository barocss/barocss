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

### Export native source as a portable display GLB

Use the `native` entry to put several authored objects in one GLB. The export
requires metre output (`unitsPerMillimeter: 0.001`) and an explicit source-text
choice:

```js
import { baroCadSourceToGLB } from '@barocss/cad-interop/native';

const glb = baroCadSourceToGLB(source, {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { chordToleranceMM: 0.1, maxSegments: 128, maxDepth: 16 },
}, { includeSourceText: false });
// In Node.js: writeFileSync('model.glb', new Uint8Array(glb));
```

The export accepts 1–4 total source0 objects. Surfaces become triangle meshes.
With `curveDisplay`, Curves become glTF `LINE_STRIP` primitives with sequential
sample indices. A Curve-only source needs `curveDisplay`. Without it, mixed
source Curves appear in `asset.extras.barocss.unrenderedCurveIds` and have no
display geometry. Surface U/V values use the custom `_CAD_UV` attribute and
are not texture UVs. Curve node extras retain original sample parameters and
intervals. Asset extras retain the model name, version, object IDs and order,
millimetre source unit, metre display unit, and authored XYZ/Y-up intent.
The exporter scales native millimetres to metres once and does not rotate
the authored frame. Output is at most 1 MiB.

`includeSourceText: true` adds the exact text under `asset.extras.barocss.source`
with `format: 'barocad-source0'` and `role: 'untrusted-native-reference'`.
Treat this text as untrusted input if you later compile it. GLB JSON numbers
do not preserve the lexical spelling of `-0`; the optional text does. The GLB
contains sampled display geometry, not authoritative native NURBS, a B-Rep,
or a source-identity certificate. Run
`node packages/barocss-cad-interop/test/native-glb.test.mjs` after the affected
package build to check real source0 → saved GLB → local HTTP → Three.js
`GLTFLoader.loadAsync`.

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

## Read a direct-geometry CAD document

The optional `./document` entry reads the CAD document v1 wrapper through
the public `@barocss/cad` document parser:

```js
import { loadBaroCadDocument, parseBaroCadDocument } from '@barocss/cad-interop/document';

const controller = new AbortController();
const result = await loadBaroCadDocument('https://example.test/part.cad-document.json', {
  signal: controller.signal,
  onProgress: ({ loadedBytes }) => console.log(loadedBytes),
});
// Use parseBaroCadDocument(text) when the host already owns the file text.
const body = result.bodyBindings[0];
const asset = result.compiledAssets.find(item => item.assetId === body.assetId);
const geometry = asset.model.objects.find(item => item.id === body.geometryId);
```

Supply an absolute HTTP(S) URL. The result contains a copied authored
document, exact embedded source0 text, compiled native Models, asset-qualified
body bindings and the CAD report. The source text is authoritative; Models
and bindings are derived. Document file version 1 does not change embedded
sourceVersion 0. Original geometry IDs may repeat in different assets, so
resolve them with `assetId`. The direct-geometry profile requires mm/rad,
authored XYZ and empty feature, parameter, constraint, placement and cache
arrays. This entry creates no renderer objects or automatic frame transform.

The document URL reader allows at most 2 MiB and 4096 response chunks,
requires strict UTF-8, and reports transport bytes. CAD enforces the document
schema and embedded source limits. An abort or `onProgress` returning `false`
rejects with `AbortError`/`ABORT_ERR`; malformed documents keep the prior
result unchanged. `CadDocumentError.code` gives the CAD parse or reference
diagnostic. The original `./native` source0 reader keeps its 262144-byte cap
and does not accept document JSON. Run
`node examples/document-v1-verify.mjs` after building CAD and interop for the
actual generated-file and local HTTP check. This neutral result does not imply
Three, Babylon, Pixi3D or GPU document rendering.

### Display selected document bodies in own GPU v2

`prepareBaroCadDocumentPrimitiveNativeRefsV2(result, options)` checks the
complete CAD document result and returns owned original-ID Surface packets or
Curve v0/v1 samples. It selects all bodies when the document has at most four.
A document with 5–16 bodies requires `bodyIds`: a unique, existing list of
1–4 IDs. The output follows the authored body order, even if the selection
list has another order. Selected assets must fit the native source preview
producer's 1–4 object limit. Failure returns no partial projection.

```js
import { loadBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 }
  from '@barocss/cad-interop/document';
import { mountPrimitiveSceneV2 } from '@barocss/gpu';

const result = await loadBaroCadDocument(documentURL);
const projected = prepareBaroCadDocumentPrimitiveNativeRefsV2(result, {
  native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', // Explicit host assertion for this target.
  bodyIds: ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface'],
});
const entries = projected.map((entry, index) => {
  const { binding, ...primitive } = entry;
  return { ...primitive, color: colors[index], transform: poses[index] };
});
const display = mountPrimitiveSceneV2(canvas, { version: 2, entries }, gpuOptions);
// Call display.dispose() when finished. The host keeps its canvas and CAD result.
```

Each binding retains `documentId`, document revision, body/asset IDs, asset
revision, original `Model.name`, geometry kind/ID and document/source frames.
`ref.geometryId` is the original packet/sample ID. `ref.modelId` is an
asset-scoped GPU display namespace: an asset ID's `-` becomes `.`. CAD asset
IDs cannot contain `.`, so the encoding is injective. This does not change
the source text, native Model, body reference, Curve DTO or packet ID.
Document `authored-xyz-no-axis-conversion` does not itself declare Y-up. The
host must assert that its authored frame matches this right-handed Y-up GPU
target, choose the scene's mm scale and supply colors/poses/camera. There is
no automatic axis mapping, assembly placement, feature evaluation or exact
pick identity. The neutral package imports no GPU module and creates no
WebGL resource.

`examples/document-gpu-v2-fixture.mjs` generates the actual 3,172-byte
`document-gpu-v2.cad-document.json` with two source0 assets and six body
references. `node examples/document-gpu-v2-verify.mjs` checks the compiled
file, HTTP read, source/ID/revision retention and refusal. The
`examples/document-gpu-v2.html` Vite example displays four selected bodies
on one WebGL2 canvas, checks uploaded buffers/pixels, rejected updates and
owned GPU disposal. Build CAD, GPU and interop before running these examples.

### Display selected document bodies in Three.js

The optional `./three-document` entry composes the same validated body
selection with the existing source0 `BaroCADLoader`. It returns one Three
`root` Group and bindings in authored body order. Each binding contains the
original document/asset/body/native IDs, revisions and frames, the selected
`Mesh` or `Line`, its asset Group and the asset-scoped display ref. The
`Object3D.name` remains the original native geometry ID. Use the binding to
distinguish the same Curve or Surface ID in different assets.

```js
import { loadBaroCadDocument } from '@barocss/cad-interop/document';
import { createBaroCadDocumentThreeDisplay }
  from '@barocss/cad-interop/three-document';

const cad = await loadBaroCadDocument(documentURL);
const display = createBaroCadDocumentThreeDisplay(cad, {
  native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', // Host assertion, not a document certificate.
  bodyIds: ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface'],
});
scene.add(display.root);
// The host may set display-only poses on display.root.children.
// This does not create CAD assembly placements.
display.dispose(); // Detach and release only adapter-owned objects.
```

One asset Group is created for each selected source asset. The underlying
source adapter constructs the bounded whole source0 Model and then detaches
unselected children from the display root. Its result still owns their
geometry and materials until `dispose()`, which is idempotent. The caller
keeps its Scene, renderer, canvas, camera, lights and unrelated children. A
failed candidate releases staged adapter resources and does not replace a
prior accepted display. The neutral `./document` entry remains free of a
Three runtime import. This composite does not add exact native-parameter
picking or change the old `BaroCADLoader`.

`node examples/document-three-v1-verify.mjs` checks the actual 3,172-byte
document over local HTTP, selected objects/positions, atomic failure and
disposal. `examples/document-three-v1.html` renders the two selected Lines
and two Meshes in headed Chromium/WebGL2, with caller display-only poses and
pixel/readback checks. The `native` option applies the explicit millimetre
scale once in the existing Three loader. Document authored XYZ alone does
not certify a right-handed Y-up frame; the host must assert the matching
basis or supply its own external frame mapping.

### Display selected document bodies in Babylon.js

The optional `./babylon-document` entry uses the same validated body
selection and the existing source0 `BaroCADBabylonLoader`. Pass a live,
caller-owned Babylon Scene with `useRightHandedSystem = true`. The result
contains one root `TransformNode`, an asset node for each selected source
asset, and bindings in authored body order. Each binding retains original
document, asset, body and native geometry IDs, revisions and frames, the
selected Babylon `Mesh` or `LinesMesh`, and the asset-scoped display ref.
Use the binding because two assets can contain the same native geometry ID.

```js
import { loadBaroCadDocument } from '@barocss/cad-interop/document';
import { createBaroCadDocumentBabylonDisplay }
  from '@barocss/cad-interop/babylon-document';

scene.useRightHandedSystem = true;
const cad = await loadBaroCadDocument(documentURL);
const display = createBaroCadDocumentBabylonDisplay(scene, cad, {
  native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', // Assertion supplied by the host.
  bodyIds: ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface'],
});
// The host may set display-only poses on display.assetNodes.
display.dispose(); // Release adapter-owned meshes and nodes only.
```

The source adapter creates each selected asset's bounded whole source0
Model. This entry disables unselected meshes and keeps them owned until
`dispose()`. A failed candidate releases its staged meshes and nodes and
does not replace an accepted display. `dispose()` is idempotent; it keeps
the caller's Scene, Engine, canvas, camera and unrelated meshes. The
neutral `./document` entry has no Babylon runtime import. This entry does
not add exact native-parameter picking or CAD assembly placements.

`node examples/document-babylon-v1-verify.mjs` checks the 3,172-byte
document over local HTTP with Babylon NullEngine, including selection,
source identity, atomic refusal and disposal. The
`examples/document-babylon-v1.html` Vite example renders two selected
LinesMeshes and two Surface Meshes in headed Chromium/WebGL2 and checks
uploaded positions and pixels. The native option applies the explicit
millimetre scale once in the existing Babylon loader. Document authored
XYZ does not certify a right-handed Y-up frame; the host must assert this
basis or apply its own external frame mapping.

### Export selected document bodies as a display GLB

The optional `./document-glb` entry exports 1–4 selected document1 bodies
through the existing bounded glTF 2.0 binary writer. It reuses the same
source-backed selection as `./document`. The output contains derived Surface
triangles and sampled Curve line strips in metres. Each node has a unique
body-based name and `extras.barocss` with the original document, asset,
body, Model and geometry IDs. The returned report keeps authored body order
and maps each body to its actual glTF node index, primitive mode, native ref,
units and frame. The writer places Surface nodes before Curve nodes.

```js
import { loadBaroCadDocument } from '@barocss/cad-interop/document';
import { exportBaroCadDocumentDisplayGlb }
  from '@barocss/cad-interop/document-glb';

const cad = await loadBaroCadDocument(documentURL);
const { glb, report } = exportBaroCadDocumentDisplayGlb(cad, {
  native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', // Assertion supplied by the host.
  bodyIds: ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface'],
});
const imported = await gltfLoader.parseAsync(glb, '');
console.log(report.mappings);
```

This 1 MiB display asset omits native source text, exact NURBS coefficients,
unselected bodies and authoring records. `report.preserved`,
`report.approximated`, `report.omitted` and `report.unsupported` state its
losses. `_CAD_UV` contains native Surface parameters, not texture UVs.
Curve parameters and intervals are display metadata; JSON normalizes
negative zero. The original document retains exact source text and native
data. The host must assert that authored XYZ matches right-handed Y-up;
no axis conversion or assembly placement is inferred. Invalid selection,
unsafe geometry or excess output size refuses without changing prior
bytes or the original document. This external derived bridge does not
replace CAD's canonical IGES document writer or enable editable NURBS
roundtrip.

`node examples/document-glb-v1-verify.mjs` reads the 3,172-byte document
over local HTTP, checks report/GLB buffers and old source0 GLB hash, then
loads the output with Three `GLTFLoader`. `examples/document-glb-v1.html`
renders the four imported bodies in headed Chromium/WebGL2 and checks
actual pixels, failed export retention and caller-owned scene resources.

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

### Explicit wide Curve sample version 1

The neutral and Three.js native loaders can opt in to CAD #696's wide Curve
samples while keeping the source format at version 0. The existing three-field
`curveDisplay` option still selects the old 16-pole sample version 0.

```js
const result = await new BaroCADLoader({
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 },
}).loadAbortable('/curve-wide-v1.barocad', {});
scene.add(result.group);
// result.curves[0].sample.report.dto.version === 1
result.dispose();
```

Version 1 admits CAD's bounded positive open-clamped degree 1–3 Curves with
2–64 original poles, at most 70 knots and at most 64 nonzero spans. Loader
limits requested segments to 1–4092 and aggregate display output to 4096
points/4092 segments across at most four source0 objects. The old Surface
sample grid, source byte/chunk limits and original authored XYZ/Y-up frame do
not change. The display Line uses Float32 XYZ scaled once from native
millimetres; original source, IDs, coefficient bits, knots and parameter
intervals stay in the native result. The line and approximate pick do not
become a certified topology edge or exact NURBS intersection.

Babylon also accepts version 1 through the same neutral result in a caller-owned
right-handed Scene. It creates a `LinesMesh` with original parameter metadata;
its approximate chord pick retains the original Curve ID. Display GLB export
also accepts explicit version 1; Pixi3D continues to reject Curve display. The package example
`examples/curve-wide-v1.barocad` is the exact 2631-byte source0 fixture from
the integrated CAD #696 flow. Run `node examples/curve-wide-v1-verify.mjs`
after building CAD and this package for the compiled native/Three acceptance
checks. Serve `examples/curve-wide-v1.html` through a browser module server
for the visible Three.js WebGL2 line, native parameter pick, invalid-source
retention and caller-owned Scene disposal checks.

`examples/curve-wide-v1-babylon.html` shows the same source0 Curve in a real
Babylon WebGL2 Scene. Its `LinesMesh` is derived display data. A failed load
leaves the previously accepted Scene intact, and result disposal leaves the
caller Scene, Engine and unrelated meshes in place.

The same explicit version 1 options can export a portable **display GLB**:

```js
import { baroCadSourceToGLB } from '@barocss/cad-interop/native';
const source = await (await fetch('/curve-wide-v1.barocad')).text();
const options = {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 },
};
const glb = baroCadSourceToGLB(source, options, { includeSourceText: true });
// A standard glTF 2.0 loader reads a LINE_STRIP, not editable NURBS.
```

The GLB stores `curveSampleVersion:1` in asset metadata and `sampleVersion:1`
with original Curve ID, parameters and intervals on each Curve node. It may
store up to 4093 points per v1 Curve under the unchanged aggregate Loader
budget and 1 MiB GLB limit; legacy v0 GLB output remains byte-identical.
GLB JSON converts lexical `-0` to `0`. `includeSourceText:true` retains the
exact source text only as an untrusted reference. The caller owns imported
renderer objects and their disposal. Run
`node examples/curve-wide-v1-glb-verify.mjs` after the package build for an
actual source-file → GLB → HTTP → Three `GLTFLoader` flow. Serve
`examples/curve-wide-v1-glb.html` for the visible browser WebGL2 line and
bad-source prior-frame check.

## Inspect a native Curve display hit

The target entries can associate an actual picked line segment with its
original Curve sample interval:

```js
import { resolveBaroCadThreeCurvePick } from '@barocss/cad-interop/three';
// Or resolveBaroCadBabylonCurvePick from @barocss/cad-interop/babylon.

const hit = raycaster.intersectObject(curveLine)[0] ?? null;
const pick = resolveBaroCadThreeCurvePick(result, hit);
if (pick) {
  console.log(pick.curveId, pick.interval, pick.parameterApprox);
  console.log(pick.displayPoint, pick.worldPoint, pick.nativePointMM);
}
```

`displayPoint` is on the selected Float32 display chord in local renderer
units. `worldPoint` applies the current finite invertible affine target
transform. `nativePointMM` evaluates the original accepted CAD Curve at
`parameterApprox` in authored XYZ millimetres. The parameter is interpolated
across the selected sample interval; it is **not** an exact Curve/ray
intersection. It is not a Surface UV or a native B-Rep edge. A null hit or
an accepted Surface hit returns null. Foreign objects, disposed results,
changed display geometry/index data, unsafe transforms and accessor-based
hit fields reject. Native identity comes from private creation bindings, not
mutable names, metadata or a later edit to the returned model.

The Three helper consumes `Line.raycast`'s `intersection.index` for the
adapter's non-indexed line. The Babylon helper consumes `PickingInfo.faceId`
for this adapter's one-submesh `CreateLines` index pairs. Import Babylon's
`@babylonjs/core/Culling/ray.js` when using `scene.pick`. Run the affected
build, then `node packages/barocss-cad-interop/test/curve-pick.test.mjs`
from the workspace root for genuine source and both SDK ray flows. The
`examples/curve-pick.html` page provides one click readout in each browser
renderer.

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

## Native Pixi3D Surface adapter

`@barocss/cad-interop/pixi3d` exports `BaroCADPixi3DLoader` for Pixi3D
2.5.0 with PixiJS 7.2.4 (`pixi3d/pixi7`). This optional entry reads native
source0 `@model` text directly. It does not use a glTF round trip. PixiJS v8
is not in the supported profile. Importing the neutral, Three or Babylon
entry does not import Pixi3D.

```js
import { BaroCADPixi3DLoader } from '@barocss/cad-interop/pixi3d';

const loader = new BaroCADPixi3DLoader({
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
});
const result = await loader.loadAbortable('/two-surfaces.barocad', { signal });
app.stage.addChild(result.root);
// Original model, surface IDs, native U/V and unrendered Curve IDs stay in result.
result.dispose();
```

The supported profile is 1–4 source0 Surfaces with `countU` and `countV`
from 2 to 17. The adapter creates one owned `Mesh3D` for each Surface and
returns exact `{ surfaceId, mesh }` pairs in `renderedSurfaces`. Native Curves
remain in `model` and `unrenderedCurveIds`; `curveDisplay` is rejected for
this adapter. The source0 authored XYZ/Y-up intent is retained. The explicit
scale changes millimetres to caller units once. Native U/V stays in the
neutral Surface packet and is never declared as texture UV. Float32 display
positions and triangles are derived data, not editable CAD geometry.

`loadAbortable` uses the existing 262144-byte/4096-chunk bounded transport,
strict UTF-8, progress and abort contract. `loadAsync` is the same bounded
load without transport options. Bad source/version/options and failed target
construction reject before a result is returned. Staged Pixi resources are
released on construction failure or late abort; an existing accepted result
is untouched. `dispose()` removes the result's root and releases its own
meshes, geometry and materials once. The caller owns the Application,
renderer, stage, camera, lights, controllers and unrelated children.

Run `examples/pixi3d-native.html` through a browser module server to see the
two Surface preview, original IDs, invalid-source retention and disposal.

### Display selected document Surfaces in Pixi3D

The optional `./pixi3d-document` entry composes the same source-backed
document body selection as `./document` with the pinned source0 Pixi3D
Surface adapter. It accepts 1–4 selected Surface bodies in authored order
and refuses a selected Curve or any `curveDisplay` option. A document with
more than four bodies needs explicit `bodyIds`. Unselected native Curves
remain in the authoritative Model; the adapter does not draw them.

```js
import { loadBaroCadDocument } from '@barocss/cad-interop/document';
import { createBaroCadDocumentPixi3DDisplay }
  from '@barocss/cad-interop/pixi3d-document';

const cad = await loadBaroCadDocument(documentURL);
const display = createBaroCadDocumentPixi3DDisplay(cad, {
  native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 },
  basis: 'authored-xyz-matches-rhyup', // Assertion supplied by the host.
  bodyIds: ['body_0_surface', 'body_1_surface'],
});
app.stage.addChild(display.root);
// The host may set display-only poses on display.assetNodes.
display.dispose();
```

The result contains one owned root, one node per selected asset and
bindings with original document/asset/body/revision/frame/Surface IDs,
the asset-scoped ref, actual `Mesh3D` and asset node. The source adapter
constructs the bounded whole source Model. It keeps any unselected
Surface meshes outside the visible result tree until owned disposal.
Failed candidates release staged resources and keep an accepted display.
`dispose()` is idempotent and does not destroy the caller Application,
renderer, stage, camera, canvas or unrelated children. The caller must
assert that authored XYZ matches the target right-handed Y-up display
frame; the document does not certify this or define CAD assembly poses.
PixiJS v8 and Curve rendering are outside this entry's profile.

`examples/document-pixi3d-v1.html` reads the actual 3,172-byte document
over local HTTP and renders two selected Surface meshes in one Pixi3D
2.5.0/PixiJS 7.2.4 WebGL2 canvas. It also checks a second source with an
unselected Surface, source IDs/scale, refusal, staged cleanup and owned
disposal. This optional Pixi entry requires a browser runtime.

## Neutral model set

`@barocss/cad-interop/model-set` composes 1–4 separate native source0 files
without creating renderer objects or renaming native Models. The v0 manifest
has only `format`, `version` and `entries`; each entry has a unique ASCII
`aliasId`, an HTTP(S) URL and explicit native parse options. Relative URLs
require an explicit absolute HTTP(S) `baseURL`.

```js
import { loadBaroCadModelSet } from '@barocss/cad-interop/model-set';

const set = await loadBaroCadModelSet({
  format: 'barocad-model-set', version: 0,
  entries: [
    { aliasId: 'left', url: 'left.barocad', options: {
      sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    } },
    { aliasId: 'right', url: 'right.barocad', options: {
      sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    } },
  ],
}, { baseURL: 'https://example.test/models/' });
// Use set.entries[0].aliasId with the original result.model and geometry IDs.
```

Each returned entry contains `{ aliasId, url, result }`, where `result` is
the unchanged neutral native loader result. Aliases qualify a composition
reference; they do not become Model or geometry IDs. Source text, signed zero,
native U/V, authored XYZ/Y-up intent and source0 millimetres remain exact.
Each entry chooses its own display scale. The set supplies no placement,
common physical frame, assembly constraints or renderer resources.

The loader snapshots manifest/options before loading, fetches sources in order
and returns a set only after every source succeeds. Invalid aliases, versions,
URL schemes/options, failed member loads, progress cancellation and caller
abort reject without a partial set. An earlier accepted set remains with its
caller. `onProgress` reports member and aggregate transport bytes, not
geometry progress. Each source uses the existing 262144-byte/4096-chunk
strict UTF-8 transport; four sources cap the set at 1048576 bytes. Results
are plain owned data and need no renderer `dispose()`. See
`examples/model-set-native.html` for a two-file browser readout.

### Project qualified sets into a display scene

`prepareBaroCadModelSetDisplay(set)` copies at most four total source0
Surface packets and gives each copy a unique ASCII display `surfaceId`.
Each `{ packet, binding }` contains exact `aliasId`, original `modelId`,
original `surfaceId`, source URL and derived `displaySurfaceId`. The input
native Models, packets and IDs stay unchanged. Invalid packet/native bindings
and wider sets reject before any GPU work. This neutral helper does not import
`@barocss/gpu` or allocate WebGL objects.

`examples/model-set-gpu.html` passes these copies to the existing own GPU
`mountMeshScene` API. The example supplies the second asset's display
translation explicitly. The translation is not a native CAD placement or an
assembly relation. A GPU packet label is not a native identity; resolve it
through the binding before any native query. Viewer native measurement and
multi-model adoption remain separate work.

### Project mixed Surface and Curve sets

`prepareBaroCadModelSetPrimitiveDisplayV1(set)` accepts a model set with 1–4
total native objects. Every object must have a Surface packet or a sampled
Curve. It returns ordered, owned `surface` and `curve` entries. Each entry has
a unique `binding.displayGeometryId`, plus the original `aliasId`, `modelId`,
`geometryId`, `geometryKind` and source URL. Surface packet IDs are qualified
for display. Curve samples keep their complete validated CAD v0/v1 DTO, native
Curve ID, source parameters and signed-zero values; only the binding gets a
qualified display label. No native Model or input packet is changed.

```js
import { loadBaroCadModelSet, prepareBaroCadModelSetPrimitiveDisplayV1 }
  from '@barocss/cad-interop/model-set';

const set = await loadBaroCadModelSet(manifest, { baseURL: location.href });
const display = prepareBaroCadModelSetPrimitiveDisplayV1(set);
for (const entry of display) {
  // Use entry.binding to map a display object back to its native CAD object.
  // Pass entry.sample or entry.packet to the selected renderer adapter.
}
```

`examples/model-set-primitive-v1.html` loads two exact copies of the wide
Curve v1 fixture and one two-Surface source through local HTTP. The Three
native loader places two Lines and two Meshes in one caller Scene even when
both Curves have the native ID `wide_64`. The example tests invalid input,
the four-object cap, prior-scene retention and adapter-owned disposal. Run it
through the package's Vite browser server. For a CPU-only check, run
`node examples/model-set-primitive-v1-verify.mjs` after building CAD and this
package. The existing Surface-only helper and example remain valid. Own GPU
one-scene qualified identity is tracked separately in issue #746; this
projection does not change that GPU scene contract or add CAD placement.

### Use original native IDs with own GPU scene v2

`prepareBaroCadModelSetPrimitiveNativeRefsV2(set)` applies the same mixed-set
validation and four-object limit as the display projection. It returns owned
Surface packets and full Curve v0/v1 samples with their **original** native
IDs. Each entry has `ref:{modelId,geometryId}`: `modelId` is the unique
model-set alias with `-` encoded as `.` for GPU v2's identifier grammar;
the mapping is injective because model-set aliases cannot contain `.`.
`geometryId` is the original Surface or Curve ID. The
separate `binding` preserves source URL, original Model name and the #743
qualified display label. A display-renamed Surface packet from #743 is not a
valid original-ID packet for GPU v2.

```js
import { loadBaroCadModelSet, prepareBaroCadModelSetPrimitiveNativeRefsV2 }
  from '@barocss/cad-interop/model-set';
import { mountPrimitiveSceneV2 } from '@barocss/gpu';

const set = await loadBaroCadModelSet(manifest, { baseURL: location.href });
const projected = prepareBaroCadModelSetPrimitiveNativeRefsV2(set);
const entries = projected.map((entry, index) => {
  const { binding, ...native } = entry;
  return { ...native, color: colors[index], transform: placements[index] };
});
const display = mountPrimitiveSceneV2(canvas, { version: 2, entries }, gpuOptions);
// The host owns the canvas and calls display.dispose() when the display ends.
```

The neutral Loader package does not import GPU or choose colors, pose, camera
or scene units. The GPU host supplies an explicit mm-to-scene scale and optional
per-entry display transform. The refs are caller-scoped display namespaces;
they do not establish CAD assembly placement, document revision, topology or
exact picking. A failed projection returns no partial array and does not
mutate the prior set. A failed GPU update retains its prior accepted scene.
The host owns the GPU handle and releases its resources through `dispose()`;
neutral copies use ordinary CPU memory.

`examples/model-set-gpu-v2.html` loads two source0 files with the same native
Model name, wide Curve ID and Surface ID through local HTTP. It first checks
GPU v1's duplicate-ID refusal, then displays both Curves and Surfaces with
public GPU v2 on one WebGL2 canvas. It checks actual uploaded positions,
visible colors, retained pixels after bad refs and GPU resource disposal.
After building CAD, GPU and this package, run the example through this
package's Vite browser server. `node examples/model-set-gpu-v2-verify.mjs`
checks the neutral projection over local HTTP without creating GPU resources.

## CAD Surface operation consumer in Three.js

`examples/surface-region-reversal-generate.mjs` uses the public `@barocss/cad`
operations to extract the U `[2.5, 4.5]`, V `[12, 18]` region of the weighted
`rational_panel` Surface, then reverses that region's U parameter axis. It
checks the returned source0 text by compiling each generated Model and saves
both operation outputs and their input Models as `.barocad` fixtures.

Run `node examples/surface-region-reversal-generate.mjs` after building
`@barocss/cad`. Serve this package's `examples/surface-region-reversal.html`
through a browser module server after building `@barocss/cad-interop`. The
page loads the two generated output files through `BaroCADLoader`, displays
both Surfaces in Three.js, and reports their original IDs, domains, source
text, parameter reversal, display scale and resource lifetime. The scene
translations are example display positions, not CAD placement data.
