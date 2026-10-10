# @barocss/cad-interop

This experimental package turns BaroCSS CAD `PreviewPacket v0` data into
renderer buffers or a self-contained glTF 2.0 binary file (`.glb`). Its base
packet/GLB entry does not import CAD, GPU, Three.js, Babylon.js, or Pixi3D.
The `native` entry uses `@barocss/cad`; the `three` entry uses Three.js as an
optional peer dependency. The preview packet is shared by `@barocss/cad` and
`@barocss/gpu`.

## Select document bodies from a complete native asset

[The document example](./examples/document-native-capacity-three.html) keeps one
complete five-Curve source in a native document and displays four selected
bodies. It uses the public `document` and `three-document` entries. The native
capacity profile is fixed at sixteen objects per asset; body selection retains
its independent limit of four. The request uses reversed IDs, while returned
bindings follow authored document body order.

The document and its source remain caller-held native authority. Asset-qualified
`ref.modelId` is distinct from the original Model name. Display geometry uses
one `0.001` scene-units-per-millimetre conversion and an explicit caller basis
assertion. The wrapper prepares all five geometry/material pairs for the asset,
detaches the unselected fifth child and retains its CPU resources until the
document display is disposed. Four objects attach to the Scene. Calling the
result's `dispose()` twice releases all five pairs once, including the detached
child; it does not dispose the caller Scene, renderer, canvas or marker.

Workspace development imports now resolve source TypeScript. Use Node22 and
the existing esbuild/Vite transformers; no package prebuild or source alias is
required for these source consumer commands:

```sh
node packages/barocss-cad-interop/examples/document-native-capacity-three-verify.mjs
pnpm exec vite --config packages/barocss-cad-interop/examples/document-native-capacity-three-vite.config.mjs --host 127.0.0.1 --port 5194 --strictPort
```

Open `http://127.0.0.1:5194/packages/barocss-cad-interop/examples/document-native-capacity-three.html`.
The saved-file verifier checks original bytes, public whole-owned validation,
native parameters, body bindings, refusal retention and actual resource events.
Its private observer calls the real interop loader for only the pinned source,
listens to actual instances and restores the loader method in `finally`.
It does not patch global Three geometry/material classes or add a runtime API.
Source execution is separate from published compiled JS/types and held packed
consumer [#801](https://github.com/barocss/barocss/issues/801).
[#990](https://github.com/barocss/barocss/issues/990) records actual verification
and later Integration; [#1017](https://github.com/barocss/barocss/issues/1017)
owns the SDK source/compiled checkpoint reconciliation.

## Public Pixi3D SDK host

The [Pixi3D host](./examples/sdk-pixi3d-host.html) uses the declared
`@barocss/cad-interop/pixi3d` entry with Pixi3D `2.5.0` and PixiJS `7.2.4`.
It loads two unchanged complete source0 files: five native Curves and five
native Surfaces. The explicit native capacity profile is fixed at sixteen
objects per Model. Curve display uses v1; the Surface grid is 8×8, and
`unitsPerMillimeter: 0.001` scales derived buffers once. Original sources,
Models, geometry IDs and native parameters remain authoritative. Surface
native U/V is retained in the neutral packet, separate from Pixi texture UV.
Camera fitting or separating display roots changes only host display state.

The caller owns its Application, Stage, renderer, canvas, camera, lights and
unrelated objects. Loaded results own their roots, meshes, geometry and
materials. Attach `result.root` to the Stage; call `result.dispose()` to release
only that result. Disposal is idempotent. The example has explicit refusal and
disposal controls and retains accepted sources and frames on rejected input.
The [typed consumer](./examples/sdk-pixi3d-host-contract.ts) shows the actual
public options/result types and caller Stage shape. PixiJS 8 is outside this
pinned profile. Document selection, model-set, assembly and GLB retain their
independent limits.

From the workspace root, after the CAD and interop library builds:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/cad-interop build:library
pnpm exec vite --config packages/barocss-cad-interop/examples/sdk-pixi3d-host-vite.config.mjs --host 127.0.0.1 --port 5193 --strictPort
```

Open `http://127.0.0.1:5193/packages/barocss-cad-interop/examples/sdk-pixi3d-host.html`.
The saved config scans only this host and optimizes its pinned browser peers;
it adds no package entry aliases or dependencies. Current workspace public
exports resolve to `src/*.ts`, so the saved host and NodeNext type command
consume source. Library builds do not switch bare imports to compiled maps.
Separate `publishConfig` JS/type maps and #1017 track explicit published-map
verification without a new code-start gate. [#1008](https://github.com/barocss/barocss/issues/1008)
records historical compiled JS/type/browser results at its fixed native commit
and the later Integration stage. Those results do not prove current workspace
source execution, independent tarball installation
or npm publication. [#801](https://github.com/barocss/barocss/issues/801) stays
deferred. The current [manual](https://github.com/barocss/barocss/wiki/Loader-Manual)
and [roadmap](https://github.com/barocss/barocss/wiki/Loader-Product-Roadmap)
record ready and completed work.

## Public Babylon SDK host

The [Babylon host](./examples/sdk-babylon-host.html) imports
`BaroCADBabylonLoader` from the declared `@barocss/cad-interop/babylon` entry.
It loads one complete native file with five original Surfaces over HTTP, using
the explicit `nativeCapacity: { version: 1, maximumObjects: 16 }` profile and
`unitsPerMillimeter: 0.001`. Source text, native Models and native Surface U/V
remain CAD authority; camera fit and renderer buffers are derived host data.
The [typed consumer](./examples/sdk-babylon-host-contract.ts) uses the public
native options and actual Babylon Scene/result types.

Use the declared Babylon.js `9.29.0` peer. The caller creates a live Scene with
`useRightHandedSystem = true` and owns its engine, canvas, camera, lights and
unrelated objects. The loaded result owns its meshes and shared material;
`dispose()` releases those resources once even when called twice. Failed loads
do not replace an accepted caller display. The example includes refusal and
disposal controls. Its capacity profile applies to native source loading;
document selection, model-set, assembly and GLB retain their separate limits.

From the workspace root, after the CAD and interop library builds:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/cad-interop build:library
pnpm exec vite --config packages/barocss-cad-interop/examples/sdk-babylon-host-vite.config.mjs --host 127.0.0.1 --port 5192 --strictPort
```

Open `http://127.0.0.1:5192/packages/barocss-cad-interop/examples/sdk-babylon-host.html`.
The saved config scans only this example and uses declared public exports
without source or dist aliases. Current workspace exports resolve to `src/*.ts`,
so this command and the NodeNext type check consume source. Library builds do
not switch bare imports to compiled exports. Separate `publishConfig` JS/type
maps and #1017 track explicit published-map validation without a new code gate. [#1007](https://github.com/barocss/barocss/issues/1007)
records the exact typed/browser evidence and later Integration stage.
The native #1007 receipt records compiled workspace JS/types at its fixed
native commit; it does not prove current workspace source execution. Independent packed consumption in
[#801](https://github.com/barocss/barocss/issues/801) stays deferred; npm registry
publication is a separate result. See the current
[Loader manual](https://github.com/barocss/barocss/wiki/Loader-Manual) and
[roadmap](https://github.com/barocss/barocss/wiki/Loader-Product-Roadmap).

## Current SDK quickstart

Choose the entry by the input you have. These are the package's declared public
ESM entries; the root entry is renderer-neutral. Install only the optional peers
for your chosen renderer: Three.js `0.186.1` (declared `^0.186.1`), Babylon.js
`9.29.0`, or Pixi3D `2.5.0` with PixiJS `7.2.4`. The `native` and higher-level CAD
entries use `@barocss/cad`.

In this workspace, ordinary public imports and package `types` select `src/*.ts`,
including transitive CAD imports. Vite or a standard TypeScript-capable transformer
resolves the source files and their internal `.js` specifiers. Development needs
no CAD/interop prebuild, source condition, or package alias. Plain Node cannot
resolve those internal `.js` imports to `.ts` by itself.

The API links below refer to emitted `dist/*.d.ts` declarations for the published
package layout. Those files are produced by the separate library build. Workspace
source types and the `publishConfig` JS/type export maps are separate entry choices;
a source browser run does not check the emitted declaration files.

| Input and result | Public entry and API |
|---|---|
| PreviewPacket v0 → owned buffers or display GLB | `@barocss/cad-interop`: [prepareCadPreviewMesh](./dist/packet.d.ts), [encodeCadPreviewGlb](./dist/glb.d.ts); native face mesh uses [prepareOwnNativeFaceMesh](./dist/native-face.d.ts) / [encodeOwnNativeFaceMeshGlb](./dist/glb.d.ts) |
| Native source0 `@model` text → source, native Model, sampled previews | `@barocss/cad-interop/native`: [parseBaroCadSource / loadBaroCadSource](./dist/native.d.ts) |
| Same native text → Three Group / Babylon meshes / Pixi Container3D | `@barocss/cad-interop/three`: [BaroCADLoader](./dist/three.d.ts); `/babylon`: [BaroCADBabylonLoader](./dist/babylon.d.ts); `/pixi3d`: [BaroCADPixi3DLoader](./dist/pixi3d.d.ts) |
| Native CAD document text → document and selected body refs | `/document`: [parseBaroCadDocument / loadBaroCadDocument / prepareBaroCadDocumentPrimitiveNativeRefsV2](./dist/document.d.ts) |
| Native document → selected Three display | `/three-document`: [createBaroCadDocumentThreeDisplay / loadBaroCadDocumentThreeDisplay](./dist/three-document.d.ts); `/babylon-document` and `/pixi3d-document` provide their named display adapters |
| Model-set manifest → qualified loaded source files / primitive refs | `/model-set`: [loadBaroCadModelSet / prepareBaroCadModelSetPrimitiveNativeRefsV2](./dist/model-set.d.ts) |
| Native assembly text → evaluated assembly / Three instances | `/assembly`: [parseBaroCadAssembly / loadBaroCadAssembly](./dist/assembly.d.ts); `/three-assembly`: [createBaroCadAssemblyThreeDisplay](./dist/three-assembly.d.ts); `/babylon-assembly` and `/pixi3d-assembly` provide their named adapters |
| Authored Boolean extrusion graph → native evaluation / derived mesh and properties | `/boolean-extrusion-feature-graph`: [readBaroCadBooleanExtrusionFeatureGraph / loadBaroCadBooleanExtrusionFeatureGraph](./dist/boolean-extrusion-feature-graph.d.ts); `/boolean-extrusion-feature-mesh`: [deriveBaroCadBooleanExtrusionFeatureMesh](./dist/boolean-extrusion-feature-mesh.d.ts); `/boolean-extrusion-feature-properties`: [deriveBaroCadBooleanExtrusionFeatureProperties](./dist/boolean-extrusion-feature-properties.d.ts) |
| Native source / selected document / owned Boolean result → display GLB | `/native`: [baroCadSourceToGLB](./dist/native.d.ts); `/document-glb`: [exportBaroCadDocumentDisplayGlb](./dist/document-glb.d.ts); `/boolean-mesh-glb`: [exportBaroCadBooleanDisplayGlb](./dist/boolean-mesh-glb.d.ts); `/boolean-extrusion-glb`: [exportBaroCadBooleanExtrusionDisplayGlb](./dist/boolean-extrusion-glb.d.ts) |

Start with typed native options. This profile loads the complete five-member
example directly; each returned native ID still names an authored object.

```ts
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import type { BaroCadParseOptions } from '@barocss/cad-interop/native';

const options: BaroCadParseOptions = {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 },
  nativeCapacity: { version: 1, maximumObjects: 16 },
};
const source = await (await fetch('/part.barocad')).text();
const native = parseBaroCadSource(source, options);
// Keep native.source and native.model as authority; previews are derived data.
```

Use the same `source` and `options` with a caller-owned host. The complete
[typed consumer](./examples/sdk-quickstart-contract.ts) shows the host types.

```ts
import { BaroCADLoader } from '@barocss/cad-interop/three';
const display = new BaroCADLoader(options).parse(source);
scene.add(display.group); // caller's Three Scene
// Later: display.dispose(); releases its Group, geometries and materials.
```

```ts
import { BaroCADBabylonLoader } from '@barocss/cad-interop/babylon';
scene.useRightHandedSystem = true; // caller's Babylon Scene
const display = new BaroCADBabylonLoader(scene, options).parse(source);
// Meshes are already in scene. Later: display.dispose().
```

```ts
import { BaroCADPixi3DLoader } from '@barocss/cad-interop/pixi3d';
const display = new BaroCADPixi3DLoader(options).parse(source);
app.stage.addChild(display.root); // caller's Pixi Application
// Later: display.dispose(); releases only the loaded display resources.
```

The caller owns the Scene/Stage, renderer/engine, canvas, camera, lights and
unrelated objects. Result disposal is idempotent. Neutral results contain owned
CPU data and need no renderer disposal. Native source0 uses millimetres and
preserves authored XYZ; `0.001` means metres per millimetre. The host must intend
right-handed Y-up for these adapters. Camera fitting and gallery poses are host
state. Surface native U/V and Curve sample parameters identify native evaluations;
they are not texture UVs. Pixi retains Surface native U/V in its neutral packet.
The separate native face-mesh `part-xyz` path performs its documented axis rotation.

Without `nativeCapacity`, Curve display admits 1–4 total native objects;
Surface-only display admits 1–4 Surfaces and retains unrendered Curves. The
explicit profile is exactly `{ version: 1, maximumObjects: 16 }`, counts all native
objects, and keeps the existing aggregate sampling and Float32 refusal guards.
It is not a configurable object budget. Curve display without a `version` uses
v0; explicit `version: 1` uses the bounded wide sampler. Pixi requires v1.
Surface grids remain 2–17 samples per axis. Document selection retains its
four-body cap; model-set loading retains four source entries and primitive
projection retains four total objects. Assembly validation retains its separate
CAD limits of four parts and 32 instances; this quickstart does not test that
instance envelope. Selecting one body can still prepare a whole larger asset
and allocate unselected adapter resources, which the returned display owns
and disposes. Native source-to-GLB still admits
at most four total native objects. GLB is a sampled display artifact; keep native
source for editing.

Catch parse failures before replacing accepted state: invalid options or preview
limits throw, compiler failures carry `BaroCadSourceError.diagnostics`, and URL
loads can fail on HTTP, bounded UTF-8 transport or `BaroCadLoadAbortError`. Neutral
`loadBaroCadSource(url, options, transport)` copies parse options, including nested
profiles, before fetching. Named renderer URL loaders parse their stored options
after fetching; do not mutate pending renderer options. Use `loadAbortable` for
the explicit bounded transport; existing Three/Babylon `loadAsync` paths retain
their existing transport behavior.

Run the public-export Three source host from the workspace root with the existing
workspace dependencies. No CAD or interop prebuild is required. It reads the
already committed full source, shows all five IDs, and has refusal and disposal
controls:

```sh
pnpm exec vite --config packages/barocss-cad-interop/examples/sdk-quickstart-vite.config.mjs --host 127.0.0.1 --port 5191 --strictPort
```

Open [the Three quickstart](http://127.0.0.1:5191/packages/barocss-cad-interop/examples/sdk-quickstart-three.html).
Its source is [sdk-quickstart-three.mjs](./examples/sdk-quickstart-three.mjs).
[The Loader manual](https://github.com/barocss/barocss/wiki/Loader-Manual) and
[product roadmap](https://github.com/barocss/barocss/wiki/Loader-Product-Roadmap)
record current scope and next work.

For the separate compiled SDK checkpoint, use Node 22 and build CAD then interop
once to produce this checkout's published JS and declarations:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/cad-interop build:library
node packages/barocss-cad-interop/examples/sdk-entry-checkpoint-verify.mjs --output /tmp/barocss-sdk-entry-checkpoint
```

The [checkpoint verifier](./examples/sdk-entry-checkpoint-verify.mjs) selects actual
`publishConfig` export maps transitively, including CAD, through the existing
[workspace published resolver](../../examples/workspace-source/probe.mjs).
It checks neutral/Three compiled JS on the original five-member source and uses
TypeScript's compiler API to check the actual emitted public declarations and
normal peer typings. Its saved evidence records public resolutions, CAD/interop
`dist` inputs with no own source fallback, declaration paths, diagnostics, and
actual native/buffer/refusal/disposal observations. These builds serve this explicit
verification; they are not a prerequisite for the source host above.
[Checkpoint #1017](https://github.com/barocss/barocss/issues/1017) keeps the source
Three browser flow and compiled JS/declaration checks as separate evidence. It
does not run a new Babylon/Pixi source host or establish a tarball installation.

The checkpoint requires the original public entries and the optional
`native-uniform-curve` entry, matching development/publication key sets and exact
source-to-emitted JS/type paths. It checks every current mapped file and records
the actual entry count, allowing further legitimate additive entries. File
existence is not all-entry runtime or declaration parity; the runtime/type
consumer remains scoped to native/Three with transitive CAD.
Own-file evidence covers CAD/interop `src` and `dist`; peer declarations under
`node_modules` are counted separately and are not own source fallback.

[Capacity #982](https://github.com/barocss/barocss/issues/982#issuecomment-6079670371)
passed native Three/Babylon/Pixi direct complete-file flows;
[its integrated receipt](https://github.com/barocss/barocss/issues/982#issuecomment-6080581477)
reran the Three flow. [Quickstart #988](https://github.com/barocss/barocss/issues/988)
recorded an earlier compiled workspace/type/Three host handoff. The Babylon/Pixi
public host Issues [#1007](https://github.com/barocss/barocss/issues/1007) and
[#1008](https://github.com/barocss/barocss/issues/1008) also have native compiled
host handoffs. Those historical results do not establish their local integration
or current source host verification. This quickstart's current source browser
checkpoint is scoped to Three. Local code adoption is recorded separately;
current integrated execution remains pending.
The independent packed consumer [#801](https://github.com/barocss/barocss/issues/801)
remains deferred. These examples do not establish npm registry publication.
The API details and earlier operation receipts below retain their original
verification scope; use this section for current admission and entry selection.

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

### Read authored CAD assemblies over HTTP

The optional neutral `./assembly` entry calls the public CAD assembly0
parser. `parseBaroCadAssembly(text)` accepts an authored file without a
network request. `loadBaroCadAssembly(url, transport?)` accepts HTTP(S),
reads UTF-8 in bounded chunks and returns the same native result. It does
not create renderer objects.

```js
import { loadBaroCadAssembly } from '@barocss/cad-interop/assembly';

const controller = new AbortController();
const assembly = await loadBaroCadAssembly(assemblyURL, {
  signal: controller.signal,
  onProgress: event => { /* observed byte count */ },
});
// The host may pass assembly to an explicit renderer adapter.
```

This URL path reuses the existing document transport limit of 2 MiB and
4,096 chunks. Native CAD assembly files can be as large as 16 MiB, so a
larger valid file is refused by this URL helper; the native parser remains
available for caller-owned text. The transport checks Content-Length and
actual bytes, rejects invalid UTF-8 and supports AbortSignal and a progress
callback that returns `false` to stop. The callback may also throw its own
error. A successful load checks cancellation before and after native parse.
The caller decides which completed request becomes its current scene.
`node examples/assembly-url-verify.mjs` exercises actual chunked HTTP,
native point/file validation, composed Three display and bounded refusals.

### Display native CAD assembly instances in Three.js

The optional `./three-assembly` entry consumes a public CAD assembly0 result.
Use `parseCadAssembly` from `@barocss/cad` to read an authored assembly file.
The adapter validates the complete result before it creates Three objects.
It uses the existing source0 and selected-document Three loaders for each
qualified part reference. The assembly owns each instance pose; the source
owns its geometry and original Curve or Surface ID.

```js
import { parseCadAssembly } from '@barocss/cad';
import { createBaroCadAssemblyThreeDisplay }
  from '@barocss/cad-interop/three-assembly';

const text = await (await fetch(assemblyURL)).text();
const assembly = parseCadAssembly(text);
const display = createBaroCadAssemblyThreeDisplay(assembly, {
  native: { sourceVersion: 0, countU: 8, countV: 8,
    unitsPerMillimeter: 0.01,
    curveDisplay: { version: 1, chordToleranceMM: 0.02,
      maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup',
});
scene.add(display.root);
// Bindings include instance ID, ancestry, qualified native reference and
// the original Mesh or sampled Curve Line.
display.dispose();
```

The native evaluated matrix is row-major, acts on column-vector points and
already includes every parent pose. Each instance Group is a flat child of
the returned root. Its rotation is copied from that matrix; only its mm
translation is multiplied by `unitsPerMillimeter`. The existing loader
scales the source geometry once. The adapter does not re-evaluate Euler
angles, bake poses into geometry or apply parent transforms a second time.
Shared native part references create separate owned display objects with
distinct instance bindings. The host must assert a matching right-handed
Y-up scene; native authored XYZ alone does not certify that basis.

`dispose()` detaches the root and releases only adapter-owned geometry and
materials. It is safe to call twice. A rejected candidate leaves the
previous caller scene unchanged. `node examples/assembly-three-verify.mjs`
checks an actual #863 file, five original-to-assembly point witnesses,
shared parts and colliding geometry IDs, eight refusals, an empty assembly
and disposal. `examples/assembly-three.html` fetches the same file and
checks placed Mesh/Line pixels, a native point against the Three world
matrix, failure retention and cleanup in WebGL2. Other targets and an
assembly URL transport API need separate contracts.

### Display native planar Boolean contours in Three.js

The optional `./three-boolean-contours` entry consumes a fully validated
public CAD coplanar linear-face Boolean result. It displays each native
selected world Curve fragment as a source-backed Three `Line`, grouped by
component and outer or hole loop. It retains each fragment's native source
pointer, original operand-qualified contributor, parameter intervals,
traversal sense and dimensionless UV pcurve metadata in a binding.

```js
import { validateCoplanarFaceBoolean } from '@barocss/cad';
import { createBaroCadBooleanThreeContours }
  from '@barocss/cad-interop/three-boolean-contours';

const region = await (await fetch(regionURL)).json();
validateCoplanarFaceBoolean(region);
const display = createBaroCadBooleanThreeContours(region, {
  native: { sourceVersion: 0, countU: 8, countV: 8,
    unitsPerMillimeter: 0.01,
    curveDisplay: { version: 1, chordToleranceMM: 0.02,
      maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', // Host assertion.
});
scene.add(display.root);
display.dispose();
```

The adapter uses each native fragment's one-Curve extracted source0 file.
It checks the fragment's source-chunk pointer, then composes the existing
`BaroCADLoader` for that extracted Curve. A full #881 world source chunk can
contain one support and up to 15 Curves; the older Curve display loader
admits at most four objects. The adapter leaves the native chunk unchanged.
It does not draw the support Surface or fill the region. UV area is
dimensionless metadata, not world area. The result is an outline preview,
not a planar face or solid. `examples/boolean-three.html` reads saved #881
hole, separated-component, empty and two-source results through HTTP and
checks actual WebGL2 lines, roles, refusals and disposal. The matching Node
flow is `node examples/boolean-three-verify.mjs`. The caller owns the
Scene, renderer, camera and unrelated objects.

### Display native filled planar Boolean material in Three.js

The optional `./three-boolean-mesh` entry consumes the public CAD #887
raw authored-XYZ/mm mesh after full native validation. It draws one owned
Three Mesh for each material component, including holes and disconnected
parts. It uses the native triangle indices and oriented normals. It does
not turn the complete support Surface into a displayed result.

```js
import { validateCoplanarFaceBooleanMesh } from '@barocss/cad';
import { createBaroCadBooleanThreeMesh }
  from '@barocss/cad-interop/three-boolean-mesh';

const nativeMesh = await (await fetch(meshURL)).json();
validateCoplanarFaceBooleanMesh(nativeMesh);
const display = createBaroCadBooleanThreeMesh(nativeMesh, {
  unitsPerMillimeter: 0.01,
  basis: 'authored-xyz-matches-rhyup', // Host assertion.
});
scene.add(display.root);
display.dispose();
```

The adapter scales positions once into scene units and copies native
normals, `_CAD_UV` parameters and triangle indices. `_CAD_UV` is
dimensionless CAD parameter data, not texture UV. Bindings keep the
native mesh/support/evaluation/operand/source IDs and each component's
outer/hole loops, vertex and triangle IDs. Original `boundaryPaths` are
separate from triangulation's internal display diagonals and bridges;
the latter are not CAD edges. Empty material returns zero Meshes.
`examples/boolean-mesh-three.html` loads saved #887 hole, separated and
empty meshes over HTTP and checks actual Three WebGL2 fill, hole exclusion,
refusal and caller-owned resources. The matching Node flow is
`node examples/boolean-mesh-three-verify.mjs`. This is a derived preview,
not a native Surface, solid, B-Rep or manufacturing certificate.

### Read a native Boolean extrusion feature graph

The optional `./boolean-extrusion-feature-graph` entry reads the authored
CAD graph0 text. It returns the original text and the complete evaluated
native result from the public CAD parser. The host can read and retain file
bytes itself. Neither reader chooses a renderer.

```js
import { readFileSync } from 'node:fs';
import { readBaroCadBooleanExtrusionFeatureGraph }
  from '@barocss/cad-interop/boolean-extrusion-feature-graph';

const text = readFileSync('part.authored-graph.json', 'utf8');
const accepted = readBaroCadBooleanExtrusionFeatureGraph(text, {
  maximumParameterResolutions: 8,
  maximumFeatureEvaluations: 4,
});
console.log(accepted.authoredText, accepted.native.report.summary);
```

`authoredText` retains whitespace and signed-zero spelling. `native` is a
separate owned CPU result with the original graph, evaluated Face/Boolean/
extrusion geometry, dependency order and revision-qualified bindings. The
CAD parser enforces strict JSON, UTF-8, a 1 MiB file envelope and native
graph/options budgets. The reader calls it once. A separate call to
`validateBooleanExtrusionFeatureGraph` performs another full native rebuild.
Use the public CAD `updateBooleanExtrusionFeatureGraph` and
`serializeBooleanExtrusionFeatureGraph` for explicit edits and authored-only
save; evaluated geometry is not editing authority. This reader does not
convert the graph into a direct-geometry document, mesh or GLB.

After building CAD and interop, run
`node examples/boolean-extrusion-feature-graph-verify.mjs --source <saved-903-directory>`
with the seven authentic #903 authored files. It checks file hashes,
native geometry, a real height edit and cold read, prior-data retention and
refusals. It does not prove a renderer or npm publication.

The same subpath also exports `loadBaroCadBooleanExtrusionFeatureGraph` for
absolute HTTP(S) URLs. It reads a bounded byte stream with fatal UTF-8
decoding, then calls the text reader once. The returned DTO is the same.

```js
import { loadBaroCadBooleanExtrusionFeatureGraph }
  from '@barocss/cad-interop/boolean-extrusion-feature-graph';

const controller = new AbortController();
const accepted = await loadBaroCadBooleanExtrusionFeatureGraph(
  'https://example.test/part.authored-graph.json',
  { maximumParameterResolutions: 8, maximumFeatureEvaluations: 4 },
  { signal: controller.signal, onProgress(event) {
    console.log(event.loadedBytes, event.declaredTotalBytes);
  } },
);
```

The URL reader enforces the native 1 MiB file limit on both declared and
received bytes, at most 4,096 chunks, and the existing abort/progress
contract. Callback `false` aborts; a callback error propagates unless the
signal was aborted. Abort is checked before and during download and after
parsing. It cannot interrupt synchronous native evaluation. The host still
owns original response bytes if it needs to preserve them separately.
Run `node examples/boolean-extrusion-feature-graph-url-verify.mjs --source
<saved-903-directory>` after the affected builds for seven actual saved
files over local HTTP, 21 progress events and 14 refusal cases. No
renderer, packed npm or publication follows from this URL flow.

The same direct and URL readers also accept the seven saved CAD #915
parameter lifecycle graph files. They preserve the final authored parameter
table, revision and complete evaluated native result. The host can call
the public CAD `transactBooleanExtrusionFeatureGraphParameters` on a loaded
result, serialize only the edited authored graph and cold-read it through
the same URL reader. Run
`node examples/boolean-extrusion-parameter-lifecycle-loader-verify.mjs --source
<saved-915-directory>` after the CAD and interop builds. This checks the
seven original authored files against current results rebuilt from their
authored document and options, a new height
5→6 edit, cold HTTP read and refusal retention. The separate CAD #922
feature-node lifecycle and renderer output are not part of this check.

The current CAD graph reports `distances[]` and `summary.extrusions[]` even
for one extrusion. Historical authored single-output files still parse with
an explicit four-feature budget. Their old singular-field OWNED CACHE results
must be rebuilt from authored intent; they are not accepted current results.
For a shared Boolean region with three or four independent extrusion leaves,
pass an explicit six- or seven-feature budget. Each leaf has its own feature
ID, output slot and native evaluation. The reader does not merge sibling
Shells into an assembly or a Solid.

### Derive a filled Shell from a qualified authored graph output

The optional `./boolean-extrusion-feature-mesh` entry selects one evaluated
`normal-extrusion` from a complete native Boolean feature graph. The caller
must provide its exact graph ID, revision, feature ID and output slot. The
bridge validates the entire owned graph, calls CAD's native Shell tessellator,
validates its complete result, and returns a copied qualified binding beside
the derived mesh. It does not choose a feature by array position.

```js
import { loadBaroCadBooleanExtrusionFeatureGraph }
  from '@barocss/cad-interop/boolean-extrusion-feature-graph';
import { deriveBaroCadBooleanExtrusionFeatureMesh }
  from '@barocss/cad-interop/boolean-extrusion-feature-mesh';
import { createBaroCadBooleanExtrusionThreeMesh }
  from '@barocss/cad-interop/three-boolean-extrusion-mesh';

const read = await loadBaroCadBooleanExtrusionFeatureGraph(url, {
  maximumParameterResolutions: 8, maximumFeatureEvaluations: 4,
});
const derived = deriveBaroCadBooleanExtrusionFeatureMesh(read.native, {
  graphId: read.native.document.id,
  revision: read.native.document.revision,
  featureId: 'extrusion_feature', // An exact ID from this authored graph.
  outputSlotId: 'extrusion_slot',
}, {
  meshId: 'shell_mesh', maximumVertices: 384, maximumTriangles: 288,
  maximumEdgePaths: 192, maximumNativeSamples: 1024,
});
const display = createBaroCadBooleanExtrusionThreeMesh(derived.nativeMesh, {
  unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup',
});
scene.add(display.root);
scene.add(display.edgeRoot); // Optional true native Curve paths.
display.dispose();
```

Keep `read.authoredText` and the graph for edits and later saves. The Shell
mesh is display data in authored XYZ/mm. Its binding retains the original
graph/revision/feature/slot and scoped native/source references. Face-local
triangles and true native Curve paths remain separate from display diagonals.
The host owns the Scene, renderer and source file. The same neutral mesh can
be passed to the existing Babylon and pinned Pixi3D Shell adapters with their
own explicit basis/scale requirements.

Run `node examples/boolean-extrusion-feature-mesh-verify.mjs --source
<saved-922-directory> --topology <saved-903-directory>` after building CAD and
interop. It checks six authentic #922 replacement revisions plus authentic
hole/empty #903 files over local HTTP against paired native results and direct
CAD meshes rebuilt from historical authored intent. `examples/boolean-extrusion-feature-mesh-three.html` loads two
exact copied #922 authored files over HTTP for actual Three WebGL2 revision,
true-edge, refusal and disposal checks. The graph remains native editing
authority; this bridge does not certify a Surface, Solid or volume.

The same qualified graph result can feed the existing Babylon Shell adapter
without another parser or tessellator:

```js
import { createBaroCadBooleanExtrusionBabylonMesh }
  from '@barocss/cad-interop/babylon-boolean-extrusion-mesh';

scene.useRightHandedSystem = true;
const babylonDisplay = createBaroCadBooleanExtrusionBabylonMesh(
  scene, derived.nativeMesh, {
    unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup',
  });
babylonDisplay.edgeRoot.setEnabled(true); // Optional true Curve paths.
babylonDisplay.dispose();
```

Run `node examples/boolean-extrusion-feature-mesh-babylon-verify.mjs --source
<saved-922-directory>` for the actual six-file HTTP/NullEngine consumer.
`examples/boolean-extrusion-feature-mesh-babylon.html` reads the two exact
copied authored revisions over HTTP and checks live Babylon WebGL2 pixels,
true-edge display, refusal retention and owned cleanup. The caller owns its
Scene, Engine, canvas and original authored graph.

The pinned Pixi3D 2.5.0/PixiJS 7.2.4 adapter accepts the same derived mesh:

```js
import { createBaroCadBooleanExtrusionPixi3DMesh }
  from '@barocss/cad-interop/pixi3d-boolean-extrusion-mesh';

const pixiDisplay = createBaroCadBooleanExtrusionPixi3DMesh(
  derived.nativeMesh, {
    unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup',
  });
app.stage.addChild(pixiDisplay.root);
app.stage.addChild(pixiDisplay.edgeRoot); // Optional true Curve paths.
pixiDisplay.dispose();
```

`examples/boolean-extrusion-feature-mesh-pixi3d.html` loads the two exact
authored revisions over HTTP. It checks real Pixi WebGL2 face buffers,
separate true Curve LineStrip paths, changed revision pixels, refusal
retention and owned cleanup. The host keeps its Application, stage, canvas
and authored source. This pinned path does not imply PixiJS v8 support.

For the actual CAD #927 fan-out files, run
`node examples/boolean-extrusion-fanout-verify.mjs --source <saved-927-directory>`.
It checks all six exact authored files and current paired results through
direct and local HTTP reads. It selects every leaf by graph, revision,
feature and output slot, and compares each derived mesh with CAD's direct
tessellation and whole-mesh validator. It also checks the single-output
array case, three edited height states, a fourth independent leaf, three
genuine empty leaves, invalid sibling selections and prior accepted data.
`examples/boolean-extrusion-fanout-three.html` loads three exact copied #927
authored files over HTTP. It displays each sibling in real Three WebGL2,
checks distinct height and edited frames, checks empty frames, and exercises
true Curve edges, invalid selections and owned display cleanup. These are
separate output displays; they do not certify a joined CAD assembly or Solid.

### Display each authored fan-out output in Babylon.js

The same graph reader and qualified mesh bridge can feed the existing
`./babylon-boolean-extrusion-mesh` adapter. Select one exact feature and
output slot per display. The host owns its right-handed Scene, Engine,
canvas and authored graph. Use the explicit `authored-xyz-matches-rhyup`
basis and `0.001` scene units per millimetre. The shared Face and Boolean
results remain native inputs; overlapping extrusion leaves are separate
Shell displays.

Run `node examples/boolean-extrusion-fanout-babylon-verify.mjs --source
<saved-927-directory>` after the CAD and interop builds. It reads all six
exact #927 saved authored files and current paired results through local
HTTP, then checks each selected leaf against direct CAD tessellation and
Babylon NullEngine face, CAD UV and true Curve edge buffers. The local test
server closes each response connection because native evaluation between
requests can outlast a keep-alive interval. This does not change the public
URL reader. `examples/boolean-extrusion-fanout-babylon.html` loads the three
copied authentic #927 files in headed Babylon WebGL2 and measures original,
edited and empty sibling frames, separate true edges, refusals and owned
cleanup. This example does not add a Babylon file loader or claim a joined
assembly, Solid or package publication.

### Display each authored fan-out output in pinned Pixi3D

Use the same public graph reader, exact qualified per-leaf mesh bridge and
`./pixi3d-boolean-extrusion-mesh` adapter. The host owns the pinned Pixi3D
2.5.0/PixiJS 7.2.4 Application, stage, canvas and authored graph. Pass
`{ unitsPerMillimeter: 0.001, basis: 'authored-xyz-matches-rhyup' }` for
each separate native Shell. Attach its filled `root`; attach its `edgeRoot`
only when true native Curve LineStrip paths should appear. CAD UV is copied
source metadata, not Pixi texture UV. Shared Face and Boolean inputs do
not turn the sibling displays into a joined solid.

After the CAD and interop builds, run
`node examples/boolean-extrusion-fanout-pixi3d-verify.mjs --source
<saved-927-directory>`. It checks all six exact #927 authored files against
current paired owned results over direct and local HTTP reads, all 17
qualified leaves against direct CAD tessellation, three genuine empty
outputs and invalid selection retention. It does not initialize Pixi in
Node. `examples/boolean-extrusion-fanout-pixi3d.html` uses the three copied
#927 graphs in headed pinned Pixi WebGL2. It checks face/edge buffers,
original and edited sibling pixels, empty frames, true edge overlay,
refusals and owned cleanup while retaining the caller's Application. Its
group view spaces the display roots so overlapping siblings remain visible;
this host presentation offset does not change native mesh coordinates.
This does not prove PixiJS v8, independent packed npm consumption,
publication, mass properties or general Solid support.

### Measure one qualified native extrusion output

The optional neutral `./boolean-extrusion-feature-properties` entry selects
one exact current graph/revision/feature/output slot. It validates the whole
native graph, calls CAD's construction-property measure on that selected
extrusion and validates the complete owned property result. It returns the
qualified binding beside the native result. The existing mesh bridge uses
the same strict selector; property measurement does not tessellate a mesh.

```js
import { deriveBaroCadBooleanExtrusionFeatureProperties }
  from '@barocss/cad-interop/boolean-extrusion-feature-properties';

const { binding, nativeProperties } = deriveBaroCadBooleanExtrusionFeatureProperties(
  read.native,
  { graphId: read.native.document.id, revision: read.native.document.revision,
    featureId: 'leaf_middle', outputSlotId: 'leaf_slot_1' },
  { maximumBoundarySegments: 64, maximumSurfaceEvaluations: 8 },
);
console.log(binding.featureId, nativeProperties.report.areaMM2,
  nativeProperties.report.volumeMM3, nativeProperties.report.centroidMM);
```

The result owns authored XYZ millimetre coordinates, square-millimetre area,
cubic-millimetre volume, geometric centroid and source/component/Shell/loop
identity. A genuinely empty output has area and volume zero and centroid
`null`. Each sibling is measured separately; overlapping siblings are not
one union volume. A geometric centroid need not lie inside the material.
This is a bounded native construction estimate, not density, mass, inertia,
a sewn Solid or a manufacturing certificate. Scene pose and display scale do
not change the native measurement.

Run `node examples/boolean-extrusion-feature-properties-verify.mjs --source
<saved-927-directory> --topology <saved-903-directory>` after the public CAD
and interop builds. The example compares each selected result to direct CAD
measurement and whole validation on real saved authored graphs. Historical
single-output owned caches are rebuilt from their authored documents. The
separate #931 off-centre-hole property file does not carry this graph's
qualified feature identity, so it is not presented as graph-bridge evidence.
Graph validation, CAD measurement's parent validation and the property
validator's reconstruction are separate native work.

### Display native filled Boolean extrusion Shells in Three.js

The optional `./three-boolean-extrusion-mesh` entry consumes the complete
validated CAD #896 filled Shell mesh. It creates one Group per native Shell
and one face-local Three Mesh per native face range. It uses native triangle
indices and hard normals. Dimensionless CAD UV is stored in `_CAD_UV`, not
texture `uv`. A separate `edgeRoot` contains only true native Curve paths.
Attach it when the host wants visible CAD edges; display diagonals and
bridges are never promoted into CAD edges.

```js
import { createBaroCadBooleanExtrusionThreeMesh }
  from '@barocss/cad-interop/three-boolean-extrusion-mesh';

const nativeMesh = await (await fetch(meshURL)).json();
const display = createBaroCadBooleanExtrusionThreeMesh(nativeMesh, {
  unitsPerMillimeter: 0.001,
  basis: 'authored-xyz-matches-rhyup', // Assert the host frame.
});
scene.add(display.root);
scene.add(display.edgeRoot); // Optional true-edge overlay.
display.dispose();
```

The adapter validates the entire native result and converts mm to metres
once, with no axis change. `shells`, `faces`, `edges` and `internalEdges`
retain copied native Shell, face, Curve, source and display lineage. Empty
material creates no display objects. The adapter owns only its Three
resources; disposing it leaves the caller Scene intact. Run
`node examples/boolean-extrusion-three-verify.mjs --source <saved-896-directory>`
with the six-file #896 integration output. `examples/boolean-extrusion-three.html`
uses the same saved files over HTTP for actual WebGL2 checks. This display
is not an editable native Surface, sewn Solid, native inverse or volume proof.

### Display native filled planar Boolean material in Babylon.js

The optional `./babylon-boolean-mesh` entry consumes the same public #887
raw authored-XYZ/mm result in a live right-handed Babylon Scene. It validates
the complete native result, then creates one owned filled Mesh per material
component. The caller supplies the explicit mm-to-scene-unit scale and a
matching Y-up basis assertion. It copies native positions, normals, triangle
indices and dimensionless `_CAD_UV` parameters; `_CAD_UV` is a custom CAD
attribute, not texture UV.

```js
import { createBaroCadBooleanBabylonMesh }
  from '@barocss/cad-interop/babylon-boolean-mesh';

const display = createBaroCadBooleanBabylonMesh(scene, nativeMesh, {
  unitsPerMillimeter: 0.01,
  basis: 'authored-xyz-matches-rhyup',
});
display.dispose();
```

Bindings retain the native mesh/support/evaluation/operand/source IDs and
component/loop/triangle/vertex IDs. True `boundaryPaths` stay separate from
internal display diagonals and bridges. Empty material creates zero Meshes.
The caller owns the Scene, Engine, canvas, camera and unrelated objects.
`examples/boolean-mesh-babylon.html` verifies actual WebGL2 fill, hole
exclusion, separated components, refusal and disposal over HTTP. The matching
Node/NullEngine flow is `node examples/boolean-mesh-babylon-verify.mjs`.
This is a derived preview, not a native Surface, solid or B-Rep certificate.

### Display native filled Boolean extrusion Shells in Babylon.js

The optional `./babylon-boolean-extrusion-mesh` entry consumes the complete
validated CAD #896 filled Shell mesh in a live caller-owned right-handed
Babylon Scene. It creates one TransformNode per native Shell and one filled
Mesh per native face range. The meshes use exact native face triangle slices,
hard normals and dimensionless `_CAD_UV`, never texture UV. A separate
`edgeRoot` starts disabled. Enable it to show LinesMeshes through the three
saved D1 samples on each true native Curve edge. Display diagonals and
bridges never become CAD edge lines.

```js
import { createBaroCadBooleanExtrusionBabylonMesh }
  from '@barocss/cad-interop/babylon-boolean-extrusion-mesh';

const display = createBaroCadBooleanExtrusionBabylonMesh(scene, nativeMesh, {
  unitsPerMillimeter: 0.001,
  basis: 'authored-xyz-matches-rhyup',
});
display.edgeRoot.setEnabled(true); // Optional true-edge overlay.
display.dispose();
```

Positions convert from authored XYZ/mm to metres once, with no axis change.
Bindings retain copied native Shell, face, edge, Curve, source and evaluation
identities. Empty material creates no child display objects. Adapter disposal
leaves the caller Scene/Engine/canvas intact. Run
`node examples/boolean-extrusion-babylon-verify.mjs --source <saved-896-directory>`
for the authentic file/NullEngine flow. `examples/boolean-extrusion-babylon.html`
uses the same saved files over HTTP for actual WebGL2 checks. Edge LinesMeshes
are sampled polylines, not exact continuous native Curves. This display is
not an editable native Surface, sewn Solid or certified volume.

### Display native filled Boolean extrusion Shells in pinned Pixi3D

The optional `./pixi3d-boolean-extrusion-mesh` entry consumes the complete
validated CAD #896 filled Shell mesh in Pixi3D 2.5.0 with PixiJS 7.2.4.
It creates one owned Container3D per Shell and one Mesh3D per native face
range with exact triangle indices and hard normals. The caller asserts a
matching right-handed Y-up view and fixed 0.001 scene units/mm.

```js
import { createBaroCadBooleanExtrusionPixi3DMesh }
  from '@barocss/cad-interop/pixi3d-boolean-extrusion-mesh';

const display = createBaroCadBooleanExtrusionPixi3DMesh(nativeMesh, {
  unitsPerMillimeter: 0.001,
  basis: 'authored-xyz-matches-rhyup',
});
app.stage.addChild(display.root);
app.stage.addChild(display.edgeRoot); // Optional true Curve line overlay.
display.dispose();
```

The separate edge root holds one pinned Pixi LineStrip Mesh3D for each
true native Curve path through its three saved D1 samples. It starts
detached. Display diagonals and bridges are metadata only. Native CAD UV
is copied into face binding metadata; Pixi texture UV is unset. Shell,
face, edge, Curve, source and evaluation IDs stay in copied bindings.
Empty material creates no face or edge objects. Disposal releases only
adapter objects and keeps the caller Application/stage/camera/canvas.
`examples/boolean-extrusion-pixi3d.html` uses the exact saved #896 files
over HTTP for an actual pinned Pixi WebGL2 check. The lines are sampled
display polylines, not exact continuous CAD Curves or a sewn Solid.

### Display native filled planar Boolean material in pinned Pixi3D

The optional `./pixi3d-boolean-mesh` entry consumes the same public #887
raw authored-XYZ/mm result in Pixi3D 2.5.0 with PixiJS 7.2.4. It validates
the complete native result and creates one owned unlit, double-sided Mesh3D
per material component. A host supplies an explicit mm-to-scene-unit scale
and asserts its right-handed Y-up view matches authored XYZ.

```js
import { createBaroCadBooleanPixi3DMesh }
  from '@barocss/cad-interop/pixi3d-boolean-mesh';

const display = createBaroCadBooleanPixi3DMesh(nativeMesh, {
  unitsPerMillimeter: 0.01,
  basis: 'authored-xyz-matches-rhyup',
});
app.stage.addChild(display.root);
display.dispose();
```

The adapter copies native positions, normals and component triangle indices.
Each binding retains native mesh/support/evaluation/operand/source and
component/loop/triangle/vertex IDs. `cadParametersUV` holds the native
dimensionless Float32 CAD parameters separately; Pixi's `uvs` texture
attribute is unused. Original `boundaryPaths` remain distinct from internal
display diagonals and bridges. Empty material creates zero Meshes. The
caller owns the Application, stage, renderer, camera, canvas and unrelated
children. `examples/boolean-mesh-pixi3d.html` verifies actual Pixi WebGL2
fill, hole exclusion, separated components, refusal and disposal over HTTP.
This is a derived preview, not a native Surface, solid or B-Rep certificate.

### Export native filled planar Boolean material as a display GLB

The optional `./boolean-mesh-glb` entry consumes the same fully validated
#887 raw authored-XYZ/mm mesh. It writes one derived glTF triangle node per
material component. glTF positions use metres and its right-handed Y-up
basis, so the caller asserts that authored XYZ matches that basis. No
source0 Surface or preview packet is created from the Boolean region.

```js
import { exportBaroCadBooleanDisplayGlb }
  from '@barocss/cad-interop/boolean-mesh-glb';

const { glb, report } = exportBaroCadBooleanDisplayGlb(nativeMesh, {
  unitsPerMillimeter: 0.001,
  basis: 'authored-xyz-matches-rhyup',
});
await writeFile('boolean-material.glb', Buffer.from(glb));
```

Native normals and component triangle indices remain in the display asset.
Dimensionless CAD parameters use custom `_CAD_UV`, never texture UV. Node
`extras.barocss` and the report keep source/operand/component/loop/triangle
IDs and original boundary paths distinct from display diagonals and bridges.
Empty material writes a zero-node GLB. The output omits editable native
Curves, Surfaces, pcurves and a solid certificate. The 1 MiB writer limit
still applies. `examples/boolean-mesh-glb-verify.mjs` checks exact saved
#887 data and writes GLBs; `examples/boolean-mesh-glb.html` loads those
saved files over HTTP with Three GLTFLoader and checks actual WebGL2 pixels.
Run the verifier with `--output /tmp/barocad-boolean-glb`, then stage its
three `.display.glb` files under `examples/boolean-mesh-glb-data/` while
serving the package examples with Vite. Remove that staging directory after
the browser check. The generated binary files are not part of the package.

### Export native filled Boolean extrusion Shells as display GLB

The optional `./boolean-extrusion-glb` entry consumes the complete validated
CAD #896 filled Shell mesh. It writes one derived triangle node per native
Shell and one separate sampled line node per true native Curve edge path.
Face indices and hard normals come from the native mesh; dimensionless CAD
UV uses custom `_CAD_UV`, never texture UV. The line nodes join the three
saved Curve D1 sample points; they are not exact continuous native Curves.

```js
import { exportBaroCadBooleanExtrusionDisplayGlb }
  from '@barocss/cad-interop/boolean-extrusion-glb';

const { glb, report } = exportBaroCadBooleanExtrusionDisplayGlb(nativeMesh, {
  unitsPerMillimeter: 0.001,
  basis: 'authored-xyz-matches-rhyup',
});
await writeFile('boolean-shells.glb', Buffer.from(glb));
```

The writer converts authored XYZ/mm to right-handed Y-up metres once.
Asset and node `extras.barocss` retain original Shell, face, edge, Curve,
source and evaluation IDs. Display diagonals and bridges remain separate
metadata, never true edge line nodes. Empty material gives a valid zero-node
GLB. The output is bounded to 1 MiB and omits editable native CAD and a
sewn Solid certificate. Run `examples/boolean-extrusion-glb-verify.mjs`
with `--source <saved-896-directory> --output <saved-glb-directory>`, then
temporarily stage its `.display.glb` files and the authentic hole input under
`examples/boolean-extrusion-glb-data/` to use
`examples/boolean-extrusion-glb.html` over HTTP. Remove the staged files
after the browser check. Generated GLB files are not package source.

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

For an HTTP(S) document URL, `./three-document` also has an abortable
target entry. It uses the same bounded neutral document reader and returns
the same detached display result:

```js
import { loadBaroCadDocumentThreeDisplay }
  from '@barocss/cad-interop/three-document';

const controller = new AbortController();
const display = await loadBaroCadDocumentThreeDisplay(documentURL, {
  native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup',
  bodyIds: ['body_0_curve', 'body_0_surface'],
}, { signal: controller.signal, onProgress: event => { /* HTTP bytes only */ } });
scene.add(display.root); // The host decides whether this request is still current.
display.dispose();
```

A winning abort before or after Three allocation rejects with
`AbortError`/`ABORT_ERR` and releases any staged display. It leaves prior
caller scene objects alone. Progress describes document bytes, not CAD
geometry. The host still decides which of several successful requests to
mount. `examples/document-three-url-v1.html` checks the HTTP, abort,
resource and prior-frame behavior in a headed Three WebGL2 scene.

For a direct Three host that must frame an unknown-sized native document,
`examples/document-native-bounds-three.html` reads the document once,
creates qualified CAD references for four selected bodies and queries the
public `queryCadDocumentBounds` control-pole box for each. The two assets
contain identical geometry, so the host applies explicit display-only X
poses to separate them. It scales each original authored XYZ/mm box once,
adds the corresponding host pose, and sets its own orthographic camera
before mounting `createBaroCadDocumentThreeDisplay` from that same
document result. Run the focused source/reference check after building
CAD and interop:

```sh
node packages/barocss-cad-interop/examples/document-native-bounds-verify.mjs
```

The page compares selected native references with the target bindings and
Float32 display positions, then checks visible pixels, invalid candidate
retention and adapter-owned disposal. This control hull is conservative
source-space data. It is neither a tight shape bound nor a transformed
display box or centre of mass. The host still owns the camera, scene,
canvas, colors and any display poses. Viewer `fitGeometry` uses displayed
geometry through a separate contract.

### Display native CAD assembly instances in Babylon.js

The optional `./babylon-assembly` entry consumes the same public CAD
assembly0 result as the Three adapter. The caller provides a live Babylon
Scene with `useRightHandedSystem = true` and asserts that authored XYZ
matches its Y-up display basis.

```js
import { loadBaroCadAssembly } from '@barocss/cad-interop/assembly';
import { createBaroCadAssemblyBabylonDisplay }
  from '@barocss/cad-interop/babylon-assembly';

const assembly = await loadBaroCadAssembly(assemblyURL);
const display = createBaroCadAssemblyBabylonDisplay(scene, assembly, {
  native: { sourceVersion: 0, countU: 8, countV: 8,
    unitsPerMillimeter: 0.01,
    curveDisplay: { version: 1, chordToleranceMM: 0.02,
      maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup',
});
display.dispose();
```

The adapter validates the complete native assembly before it creates
Babylon objects. Each authored instance selects one unchanged qualified
Curve or Surface body through the existing document adapter. Its node uses
the native evaluated world matrix once. The CAD row-major elements are
reordered for Babylon's matrix layout; only mm translation is multiplied
by `unitsPerMillimeter`. The source loader scales vertices once. Instance
nodes are flat children of the returned root, so the caller may apply an
additional display-only transform to that root. Bindings retain the native
assembly revision, instance/ancestor IDs, full part reference and original
world matrix. Babylon stores target matrix elements as float32 in this
runtime, so rendered coordinates can differ slightly from native binary64
points. Shared native parts have distinct owned target objects.

`dispose()` releases only adapter-owned nodes, meshes and materials. It
keeps the caller Scene, Engine, camera and unrelated meshes. The actual
`assembly-babylon-verify.mjs` flow checks the #863 file with Babylon
NullEngine, five native-to-target point witnesses, caller root movement,
refusal retention and owned disposal. `assembly-babylon.html` checks the
same source in a headed Babylon/WebGL2 canvas. This adapter does not add
native mates, exact Curve tessellation or other renderer targets.

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

## Uniform original Curve source preview

The optional `@barocss/cad-interop/native-uniform-curve` entry provides bounded
uniform samples of one original source0/mm Curve of degree 1..5. It uses the
public CAD compiler, `curveDomain` and `sampleCurve` with the authored domain.
The compiler retains authority over source syntax, IDs, knots, poles, weights
and coordinate limits.

```ts
import {
  parseBaroCadUniformCurveSource,
  BaroCadUniformCurveSourceError,
} from '@barocss/cad-interop/native-uniform-curve';

const display = parseBaroCadUniformCurveSource(source, {
  sourceVersion: 0,
  unitsPerMillimeter: 0.001,
  uniformCurveDisplay: { version: 1, count: 17 },
});
// display.model retains the complete original single Curve.
// display.pointsMM uses native millimetres; display.positions uses renderer units.
// display.parameters and display.intervals retain original parameter values.
```

Options require exactly these own enumerable data fields at both levels, with
a plain or null prototype. Accessors, hidden, inherited, symbol and extra fields
refuse before source work. Count is an integer in 2..129 and scale is finite
and positive. The result contains an independent options snapshot and copied
native points, domain, parameters and adjacent intervals, plus derived
`Float32Array` positions. Original endpoint parameter bits, including signed
zero, follow the actual CAD sampler. Native Model sign bits remain unchanged.

Each position component is scaled once. Nonfinite values, nonzero-to-zero
binary64 or Float32 conversion and adjacent collapsed target XYZ refuse the
complete candidate. Narrow domains whose requested samples repeat a parameter
also refuse. Legitimate zero and safe Float32 subnormal components remain valid
when the complete segments stay distinct.

`BaroCadUniformCurveSourceError` exposes `code`, `diagnostics` and `cause`.
Compiler refusals retain the actual diagnostic array; sampling exceptions
retain the actual cause.

| Code | Refusal boundary |
| --- | --- |
| `OPTIONS` | Option structure, profile version, count or scale |
| `SOURCE` | Original CAD compiler refusal |
| `PROFILE` | Compiled Model is outside the single original Curve profile |
| `SAMPLING` | Actual domain/sampler exception or sample count mismatch |
| `PARAMETERS` | Domain, endpoint bits, ordering or parameter range |
| `POSITIONS` | Native, scaled or Float32 component safety |
| `SEGMENTS` | Adjacent target XYZ collapse |

The result identifies `mode: 'uniform-original-parameter'` and quality
`approximateDisplay: true`, `adaptiveErrorBound: false`,
`geometricValidity: 'not-certified'`, `topologyCertified: false`, `solid: false`.
The caller owns this CPU data through garbage collection. Development imports
resolve this optional entry to source; its publication map names the emitted
JavaScript and declaration files.

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

Both Curve display profiles also refuse a nonzero native coordinate when its
positive unit-scale product becomes binary64 zero, before Float32 conversion.
For example, native `1e-320` scaled by `1e-10` now throws the existing
`RangeError: BaroCAD Curve position is unsafe in renderer Float32 units`.
This previously accepted component loss is rejected. Legitimate zero values,
original Model sign bits and safe small conversions are preserved. Run the
focused source check with Node 22:
`node packages/barocss-cad-interop/test/curve-position-binary64-underflow.test.mjs --output EVIDENCE_DIR`.

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
also accepts explicit version 1. Pinned Pixi3D has a separate v1 line path;
the package example
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

With no `curveDisplay`, the supported profile is 1–4 source0 Surfaces with
`countU` and `countV` from 2 to 17. The adapter creates one owned `Mesh3D` for each Surface and
returns exact `{ surfaceId, mesh }` pairs in `renderedSurfaces`. Native Curves
remain in `model` and `unrenderedCurveIds`. Explicit `curveDisplay.version:1`
also renders bounded source0 Curves as Pixi3D `LINE_STRIP` meshes with copied
Float32 positions and sequential indices. `renderedCurves` binds each mesh
to the loaded output Curve ID, native parameters/intervals and sample report.
The older three-field Curve display profile still refuses. There is no Pixi
Curve pick API. The source0 authored XYZ/Y-up intent is retained. The explicit
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
`examples/curve-operations-pixi3d.html` loads the actual #792 public CAD
reversal, interval and wide-refinement output sources over HTTP into one
Pixi3D 2.5.0/PixiJS 7.2.4 Application. It checks native IDs, sample-v1
parameters, copied buffers, visible lines, refusal/retention and owned
disposal. The host applies an explicit display rotation and poses; native
source coordinates do not change. The document adapter has a separate selected-body contract below.

### Display selected document Surfaces and Curves in Pixi3D

The optional `./pixi3d-document` entry composes the same source-backed
document body selection as `./document` with the pinned source0 Pixi3D
adapter. It accepts 1–4 selected Surface or sample-v1 Curve bodies in
authored order. A selected Curve requires explicit `native.curveDisplay`
version 1. Without that option, the earlier Surface-only path remains.
The three-field v0 Curve display option still refuses. A document with
more than four bodies needs explicit `bodyIds`. Unselected native objects
remain in the authoritative Model and outside the visible display tree.

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

To select Curves, opt into the bounded sample-v1 display profile:

```js
const mixed = createBaroCadDocumentPixi3DDisplay(cad, {
  native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
    curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup',
  bodyIds: ['body_0_curve', 'body_0_surface', 'body_1_curve', 'body_1_surface'],
});
app.stage.addChild(mixed.root);
mixed.dispose();
```

The result contains one owned root, one node per selected asset and
bindings with original document/asset/body/revision/frame/geometry IDs,
the asset-scoped ref, actual `Mesh3D` and asset node. The source adapter
constructs the bounded whole source Model. It keeps any unselected
Surface and Curve meshes outside the visible result tree until owned disposal.
Failed candidates release staged resources and keep an accepted display.
`dispose()` is idempotent and does not destroy the caller Application,
renderer, stage, camera, canvas or unrelated children. The caller must
assert that authored XYZ matches the target right-handed Y-up display
frame; the document does not certify this or define CAD assembly poses.
Curve lines are display samples, not native topology or exact picks.
PixiJS v8 is outside this entry's profile.

`examples/document-pixi3d-v1.html` reads the actual 3,172-byte document
over local HTTP and renders two selected Surface meshes in one Pixi3D
2.5.0/PixiJS 7.2.4 WebGL2 canvas. It also checks a second source with an
unselected Surface, source IDs/scale, refusal, staged cleanup and owned
disposal. This optional Pixi entry requires a browser runtime.

`examples/document-pixi3d-v2.html` uses the same document and explicit
sample-v1 to render two selected Surfaces and two selected Curves in one
Pixi3D canvas. Its four bindings follow authored body order, even when
`bodyIds` are requested out of order. Asset-qualified refs distinguish
the repeated native geometry IDs. The example checks hidden unselected
Curves, native sample parameters, one-time scaling, invalid selections,
later-asset cleanup and caller-owned resources.

### Display native assembly instances in Pixi3D

The optional `./pixi3d-assembly` entry consumes a validated CAD assembly0
result. It uses the pinned Pixi3D 2.5.0/PixiJS 7.2.4 document adapter to
create a separate source-backed `Mesh3D` for every authored instance.
`./assembly` can load the native assembly over HTTP before display.

```js
import { loadBaroCadAssembly } from '@barocss/cad-interop/assembly';
import { createBaroCadAssemblyPixi3DDisplay }
  from '@barocss/cad-interop/pixi3d-assembly';

const assembly = await loadBaroCadAssembly(assemblyURL);
const display = createBaroCadAssemblyPixi3DDisplay(assembly, {
  native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.01,
    curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', // Assertion supplied by the host.
});
app.stage.addChild(display.root);
// The host may move display.root without changing native assembly poses.
display.dispose();
```

Bindings keep assembly revision, instance/parent/ancestor IDs, the complete
qualified part reference and original native world matrix. Each flat child
of the owned root carries one already evaluated instance pose. The adapter
converts matrix element order for Pixi3D and scales only translation from mm;
the source adapter scales mesh positions. Pixi's target transforms use
Float32 display precision. The original CAD result and caller Application,
stage, renderer, canvas and unrelated children remain caller-owned.
`examples/assembly-pixi3d.html` checks the actual six-instance #863 file,
native-to-target points, WebGL2 pixels, refusal and disposal. PixiJS v8,
native geometry editing and package publication are outside this entry.

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

## CAD Curve operation consumer in Three.js

`examples/curve-operations-fixture.mjs` calls the public CAD Curve reversal,
interval extraction and wide refinement operations. The first two use one
weighted five-pole Curve on the nonunit domain `[-3, 7]`. The third uses the
public #686 joined 31-pole producer and refines it to 64 poles. Each public
validator checks the owned operation result. The example keeps the original
Curve, source0 text, coefficients, signed zero, parameter maps and report.
Only the three output Curves become sampled display Lines.

After building `@barocss/cad` and `@barocss/cad-interop`, run:

```sh
node packages/barocss-cad-interop/examples/curve-operations-generate.mjs /tmp/barocss-curve-operations-evidence
node packages/barocss-cad-interop/examples/curve-operations-verify.mjs /tmp/barocss-curve-operations-evidence
```

The generator saves owned JSON results and original/output source0 text.
The verifier reopens them. The generator writes the three output `.barocad` files in
`examples/curve-operations-data/`. Serve
`examples/curve-operations-three.html` through the local Vite browser server.
The page reads those files over HTTP and displays them with the existing
Three `BaroCADLoader` and explicit `curveDisplay.version:1`. Its host uses
authored XYZ, a camera from +Y with +Z up, and 0.001 scene units/mm. Invalid
version, display capacity and source candidates leave accepted Lines and
pixels intact. Disposal releases only adapter-owned Three objects.

The Lines approximate native Curves. Three vertices do not replace native
parameters or prove an error bound, topology, a solid or manufacturing
quality. This is one Three.js consumer; it does not establish Babylon,
Pixi3D, GLB or npm publication for these three operations.

### Load the same operation outputs in Babylon.js

`examples/curve-operations-babylon-verify.mjs` reads the same three output
source0 files with the compiled Babylon loader in a right-handed NullEngine
Scene. It checks `LinesMesh` vertices, sample-v1 parameters, output native
Curve IDs and a display hit. The hit identifies the Curve in the loaded
output source. The host follows the retained CAD operation provenance to the
pre-operation input Curve ID.

After building CAD and this package, run:

```sh
node packages/barocss-cad-interop/examples/curve-operations-babylon-verify.mjs
```

Serve `examples/curve-operations-babylon.html` through the local Vite browser
server for the actual Babylon.js WebGL2 display. The host supplies a live
right-handed Scene, authored XYZ camera, explicit 0.001 scene units/mm and
display-only colors/poses. The page checks three visible output Lines, six
invalid candidates, prior-pixel retention and adapter-owned disposal. This
example uses the existing Babylon v1 adapter; it adds no target API or new
claim about exact native picking, topology, another renderer or publication.

## CAD wide Curve edit consumer in Three.js

`examples/curve-wide-edit-generate.mjs` cold-reads the committed actual
64-pole refined source from the Curve operation example. It calls public
CAD `editCurveControlPolygonWide` to replace pole 5 Y and pole 63 weight.
The verifier checks the owned edit report, all unrequested coefficient
bits, original ID/knots/domain and signed zero. It confirms that the saved
`examples/curve-wide-edit-data/edited.barocad` exactly matches the public
operation output and that the neutral sample-v1 reader accepts both
sources. Run it after building CAD and interop:

```sh
node packages/barocss-cad-interop/examples/curve-wide-edit-generate.mjs
```

Serve `examples/curve-wide-edit-three.html` through the local Vite browser
server. It loads original and edited source0 files over HTTP with the
existing Three adapter. Both retain native Curve ID `joined_refined_64`;
the two adapter results own separate source text, sampled Lines and
disposal. The caller sets display-only poses/colors, authored XYZ camera
and 0.001 scene units/mm. Native edit coefficients/report and sample
parameters remain separate from Float32 display vertices. This is one
actual edit consumer, not a native control-net renderer, exact pick,
global shape certificate or npm publication.

## CAD wide Curve reversal consumer in Three.js

`examples/curve-wide-reversal-generate.mjs` cold-reads the committed actual
64-pole #804 edited source. It calls public CAD `reverseCurveWide` with a
distinct derived Curve ID. The verifier checks the owned result, copied
control/weight bits, retained domain endpoint signs, the decreasing
parameter map, local point/negative-D1 observations and the exact saved
`examples/curve-wide-reversal-data/reversed.barocad` text. Run it after
building CAD and interop:

```sh
node packages/barocss-cad-interop/examples/curve-wide-reversal-generate.mjs
```

Serve `examples/curve-wide-reversal-three.html` through the local Vite
browser server. It loads edited and reversed source0 files over HTTP into
separate owned Three Lines. The caller sets colors/poses, authored XYZ
camera and 0.001 scene units/mm. The sampled endpoints run in opposite
orders; native parameters and reversal provenance remain separate from
Float32 display vertices. Invalid candidates retain the accepted scene,
and disposal releases only adapter-owned objects. This is one actual
wide-reversal consumer, not a global shape, topology, solid,
manufacturing-quality or npm publication certificate.

## CAD three-section loft consumer in Three.js

`examples/loft-three-data/sections.barocad` contains three original native
Curve sections with the same U basis and a distinct curved middle section.
`examples/loft-three-generate.mjs` cold-reads that source, calls public CAD
`buildThreeSectionLoftSurface`, validates its owned result and local
V=0/.5/1 section observations, and checks the exact saved four-object
`examples/loft-three-data/loft.barocad` output. Run it after building CAD
and interop:

```sh
node packages/barocss-cad-interop/examples/loft-three-generate.mjs
```

Serve `examples/loft-three.html` through the local Vite browser server.
The existing Three adapter loads the Surface and three sampled Curves over
HTTP in one caller Scene. The page compares Mesh/Line buffers with neutral
source0 results, draws three host-colored sections over the Surface, tests
invalid and injected staging failures, and releases only adapter-owned
objects. Native interpolation and parameter evidence stay separate from
Float32 display meshes. This proves one same-basis three-section loft
consumer. It does not prove arbitrary lofts, B-Rep/solid quality,
other targets or npm publication.

## Edited-middle three-section loft consumer in Three.js

`examples/loft-three-edited-generate.mjs` reads the original three sections
and uses public CAD `editCurveControlPolygonWide` to change one Z coefficient
in the middle Curve. It then calls `buildThreeSectionLoftSurface` with the
edited Curve. The verifier checks the edit report, unchanged coefficient
bits, signed zero, local Surface observations and exact saved source0 text
in `examples/loft-three-data/edited_middle.barocad` and `edited_loft.barocad`.
Run it after building CAD and interop:

```sh
node packages/barocss-cad-interop/examples/loft-three-edited-generate.mjs
```

Serve `examples/loft-three-edited.html` through the local Vite browser
server. The existing Three adapter loads the original and edited lofts as
separate source-owned results. The caller supplies display poses, colors,
camera and 0.001 scene units/mm. The page checks source-to-buffer values,
the visible change, invalid candidate refusal, retained pixels after a
staging failure and adapter-owned disposal. The native edit and loft
observations remain separate from Float32 display meshes. This shows one
edited-middle rebuild; it makes no claim about arbitrary edits, global
shape, solids, other targets or npm publication.

## Native Curve arc length beside a Three Line

`examples/curve-arc-length-data/revision1.cad-document.json` is the saved
canonical document produced by the CAD Curve arc-length example. The direct
Three host selects its original radius-2 mm rational quarter Curve. It
reads the document once, creates a current qualified CAD reference, calls
public `queryCadDocumentCurveArcLength` and validates the owned result.
The existing document adapter displays a separate sampled Line from the
same accepted document. Run the focused source and target check after
building CAD and interop:

```sh
node packages/barocss-cad-interop/examples/curve-arc-length-three-verify.mjs
```

Serve `examples/curve-arc-length-three.html` through the local Vite browser
server for the actual Three/WebGL2 view. The host shows the native length
estimate, heuristic estimator and original interval beside the sampled
Line. It checks source/target bindings, buffers, visible pixels, invalid
candidate retention and owned disposal. The display Line's chord sum is
kept separate from the native derivative-integrated estimate. The
estimator is not a certified global error bound, and this example makes
no claim about general dimensions, other targets or npm publication.

## Parameterized native Curves in Three.js

`examples/curve-parameterization-three-data/` holds four exact source0
outputs from the integrated CAD #947 demo: three methods applied to the
same five authored XYZ points and one point-edited chord-length result.
The Node verifier reads the original CAD evidence, checks fixture SHA,
validates each saved owned result with public CAD, cold-compiles source0,
and checks native Curve/sample identity against the existing neutral and
Three loaders. Run it after building CAD and interop:

```sh
node packages/barocss-cad-interop/examples/curve-parameterization-three-verify.mjs /Users/user/.barocss-ai/v3/evidence-947-cad/integration/demo-output
```

Serve `examples/curve-parameterization-three.html` with the local Vite
server. It fetches the saved files over HTTP and shows four colored Lines
in a headed Three.js WebGL2 view. The caller offsets only the display
Groups to make overlapping Curves visible. It checks native ID and
parameter lineage, Float32 sample buffers, invalid-candidate frame
retention and adapter-owned disposal. The Lines are display samples;
the original source0 native Curves and CAD owned results carry the
construction authority. This example does not establish true arc length,
global shape accuracy, Surface or Solid behavior, other target parity,
or npm release readiness.

## Interpolated native Surface grids in Three.js

`examples/surface-interpolation-three-data/` holds six byte-exact CAD #946
source0 outputs. Five can produce 8×8 display meshes. The valid native
coincident-XYZ Surface must refuse preview because its sampled triangles
collapse. The Node verifier checks each original authored grid and owned
Surface with public CAD, cold source0 compilation, exact source hashes,
five neutral/Three mesh buffers and the one authentic display refusal:

```sh
node packages/barocss-cad-interop/examples/surface-interpolation-three-verify.mjs /Users/user/.barocss-ai/v3/evidence-946-cad/integration/demo-output
```

Serve `examples/surface-interpolation-three.html` through the local Vite
server for the headed Three.js WebGL2 flow. It fetches all six files over
HTTP, spaces only the five accepted display Groups, checks each visible
Mesh, retains the frame after invalid candidates, and disposes only the
adapter-owned meshes. The original native Surface U/V grids and
coefficients remain authoritative. The 8×8 meshes do not replace the
16×16 native construction, certify fit or regularity, create a Solid,
or establish other engine or npm release readiness.

## Fixed-weight native Curves in Babylon.js

`examples/weighted-curve-babylon-data/` holds seven byte-exact CAD #949
source0 files. Six have bounded display Lines; the valid native
coincident-XYZ Curve must refuse a collapsed Float32 display segment.
The Node verifier reads the original authored points, supplied weights
and complete owned results. It calls the public CAD validator, cold
compiles each source, compares neutral Curve samples with Babylon
NullEngine Lines, and checks the real weight-change and local common
weight-scale probes:

```sh
node packages/barocss-cad-interop/examples/weighted-curve-babylon-verify.mjs /Users/user/.barocss-ai/v3/evidence-949-cad/integration/demo-output
```

Serve `examples/weighted-curve-babylon.html` through a local Vite server
for the headed Babylon.js WebGL2 flow. The caller uses a right-handed
scene, supplies display colors and positions, fetches all seven saved
files over HTTP, checks six visible Lines and the one display refusal,
then verifies invalid-candidate frame retention and owned disposal.
The original native Curves and supplied weights remain authoritative;
Lines are sampled display only. This example does not fit unknown
weights, certify global shape or arc length, create a Solid, or establish
other engine or npm release readiness.

## Compatible multi-section lofts in Babylon.js

`examples/multi-section-loft-babylon-data/` holds six byte-exact CAD #952
source0 outputs. Five compatible-section loft Surfaces produce 8×8
display meshes. The valid native coincident-section loft must refuse
collapsed preview triangles. The Node verifier checks original authored
sections and complete owned results with public CAD, cold source0
compilation, exact file hashes, five neutral/Babylon NullEngine buffers,
the real middle-section edit and the authentic display refusal:

```sh
node packages/barocss-cad-interop/examples/multi-section-loft-babylon-verify.mjs /Users/user/.barocss-ai/v3/evidence-952-cad/integration/demo-output
```

Serve `examples/multi-section-loft-babylon.html` through the local Vite
server for the headed Babylon.js WebGL2 flow. It fetches all six saved
files over HTTP, displays five separate native-bound meshes, checks
invalid-candidate frame retention and releases only adapter-owned
objects. The original section Curves, compatible U bases and complete
loft Surface remain authoritative. The 8×8 meshes do not certify
arbitrary section matching, guides, caps, Shell/Solid quality, other
engine parity or npm release readiness.

## Native translational Sweep Surfaces in Three.js

`examples/translational-sweep-three-data/` holds six byte-exact CAD #934
source0 files. Each retains its original profile Curve, rail Curve and
fixed-orientation rational translational Sweep Surface. Five produce 8×8
display meshes; the valid native zero-translation Surface must refuse
collapsed display triangles. The Node verifier checks the six original
owned results with the public CAD validator, cold source0 compilation,
exact file hashes, native Surface probes, five neutral/Three mesh buffers,
the real numeric rail edit and the authentic display refusal:

```sh
node packages/barocss-cad-interop/examples/translational-sweep-three-verify.mjs /Users/user/.barocss-ai/v3/evidence-934-cad/integration/demo-output
```

Serve `examples/translational-sweep-three.html` through the local Vite
server for the headed Three.js WebGL2 flow. It fetches all six saved files
over HTTP, spaces only the five accepted display Groups, checks their
visible Meshes, retains the frame after invalid candidates, and releases
only adapter-owned resources. The original profile, rail, native Sweep
Surface and U/V domains remain authoritative. Constructor Curves are not
B-Rep boundaries. The 8×8 meshes do not certify moving frames, global
regularity, caps, Shell/Solid quality, other engine parity or npm release.

## Native affine Curve and Surface copies in Three.js

`examples/affine-geometry-three-data/` holds seven byte-exact CAD #958
source0 files. Each preserves its original Curve or Surface and one new
native affine copy with a distinct ID. The Node verifier compares the
original authored transform, complete owned result, public CAD validator,
cold source0 model and each neutral/Three Line or Mesh buffer:

```sh
node packages/barocss-cad-interop/examples/affine-geometry-three-verify.mjs /Users/user/.barocss-ai/v3/evidence-958-cad/integration/demo-output
```

Serve `examples/affine-geometry-three.html` through a local Vite server
for the headed Three.js WebGL2 flow. It fetches all seven saved files
through HTTP and shows fourteen separately bound original/copy objects.
The caller spaces display rows and source groups; native source XYZ,
coefficients, domains and units do not change. The browser checks each
visible Line/Mesh, refusal retention and adapter-owned disposal.
Determinant parity and native derivatives do not certify B-Rep face
orientation, Solid quality, other target parity or npm release.

## Atomic native linear geometry patterns in Babylon.js

`examples/linear-geometry-pattern-babylon-data/` holds six byte-exact CAD #964
complete source0 patterns and eighteen producer-saved original/copy pair
sources. `manifest.json` pins each file SHA-256, original and copied native
IDs, count and raw XYZ/mm spacing. The complete native Model stays the
authority. Each copied member is an actual affine result from the original
seed; a Babylon instance or display pose is not a native copy.

The current `BaroCADBabylonLoader` accepts at most four objects in one
source. It correctly refuses each complete five-member source for display.
The example cold-compiles and validates each full result, then uses the
producer's two-object pair sources for those display projections. It
shows the original seed once and every copy by exact native ID. Other
seed meshes made while loading the pairs remain hidden and are disposed
with their pair result. The seed-only one-member source loads directly.
This composition does not expand the loader's source limit or change CAD
geometry.

```sh
node packages/barocss-cad-interop/examples/linear-geometry-pattern-babylon-verify.mjs /Users/user/.barocss-ai/v3/evidence-964-cad/integration/demo-output
```

The Node flow checks all owned native results, full and pair source bytes,
neutral/Babylon buffers and caller resource survival. Serve
`examples/linear-geometry-pattern-babylon.html` through Vite for the headed
Babylon 9.29.0 WebGL2/HTTP flow. The browser fetches each pinned source,
shows the 24 native members, verifies independently visible Line/Mesh
objects, tests refusal retention and disposes only adapter-owned meshes
and materials. Display gallery offsets do not change native mm spacing;
the adapter applies 0.001 scene units/mm once in a right-handed Y-up Scene.
This does not prove direct five-object loading, own GPU adoption, assembly,
union, circular patterns, Solid quality or npm publication.

## Authored-axis native circular patterns in Pixi3D

`examples/circular-geometry-pattern-pixi3d-data/` contains seven byte-exact
CAD #967 complete source0 patterns, eighteen genuine original/copy pair
sources and one original owned result for browser refusal checks. The
manifest pins file SHA-256 values, member IDs, authored and normalized axes,
axis origins, signed angles and each native matrix. The complete native
Model and public circular-pattern validator remain the authority.

The example reads complete sources directly when they contain at most four
objects. The two five-member sources exceed the current display limit and
correctly refuse direct loading. Their saved pair sources show the original
seed once and every actual copied member. Extra pair seed displays stay
hidden and are disposed with their result. This produces 25 selected
members and 31 adapter-owned meshes without expanding the loader limit.

```sh
node packages/barocss-cad-interop/examples/circular-geometry-pattern-pixi3d-verify.mjs <saved-CAD-967-output-directory>
```

The Node flow checks native owned reconstruction, full/pair source bytes,
matrices, native D0/D1 observations and neutral previews. Serve
`examples/circular-geometry-pattern-pixi3d.html` through Vite for the actual
Pixi3D 2.5.0/PixiJS 7.2.4 WebGL2/HTTP flow. It compares original native data
with target Line/Mesh buffers, checks every member's visible pixels,
refusal retention and double disposal. Native U/V remains in the neutral
packet; it is not a Pixi texture UV attribute. The adapter scales raw
XYZ/mm by 0.001 once; a +Z camera and gallery translations affect display
pose only. Direct five-object loading, own GPU consumption, feature-tree
patterns, assembly, union, Solid quality and publication are separate.

## Opt in to complete native source0 Models

The optional `nativeCapacity` profile lets the existing neutral and named
native adapters read a complete source0 Model with up to sixteen objects.
The fixed profile matches the CAD compiler's declaration limit:

```js
const options = {
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.1, maxSegments: 512, maxDepth: 16 },
  nativeCapacity: { version: 1, maximumObjects: 16 },
};

const native = parseBaroCadSource(completeSource, options);
// native.model keeps every original object in source order.
// Use the same options with BaroCADLoader, BaroCADBabylonLoader,
// or the pinned BaroCADPixi3DLoader.
```

`BaroCadNativeCapacityV1` is exported by the existing `./native` entry.
The profile must contain exactly the own data fields `version: 1` and
`maximumObjects: 16`. Other versions/counts, getters, missing/extra fields,
foreign prototypes and symbols refuse. Validation makes an independent
profile snapshot and leaves caller data unchanged. The neutral URL reader
already snapshots parse options before fetching; named renderer URL loaders
retain their existing constructor-option timing.

Omitting `nativeCapacity` preserves legacy admission: Curve display requires
1–4 total native objects; Surface-only display requires 1–4 Surfaces and
retains unrendered Curves. With the profile, all native objects count toward
1–16, including unrendered Curves. Curve-only files still require
`curveDisplay`; Pixi3D still requires its explicit v1 form. This option does
not change native basis, source version, sample algorithms, Float32 refusal
or the requested mm conversion.

| Bound per parse result | Complete-source profile |
|---|---|
| Native source | 16 declarations, 262144 UTF-8 bytes; existing compiler AST/token guards |
| Curve display total | 4096 points and 4092 segments; existing v0/v1 per-Curve limits |
| Surface grid | 2–17 samples per axis |
| Surface allocation envelope | 4624 vertices, 8192 triangles, 24576 indices; prechecked before previews |
| Native IDs | Source order and IDs retained; generated sample prefix conflicts still refuse |

Each complete five-member source now produces five selected target objects
when it passes preview checks. No original/copy pair projection is needed.
The caller still owns the Scene/Stage, engine, camera and unrelated resources;
each loader result owns only the display objects/resources it creates.

Document selected-body limits, assembly instance limits, model-set asset
counts and own-GPU projection limits stay separate. A selected document body
may now prepare a larger underlying asset when this profile is requested;
unselected prepared resources remain owned by the result and are disposed.
Native source-to-GLB still refuses more than four total native objects.

`examples/native-capacity-verify.mjs` checks the four hash-pinned complete
CAD #964/#967 files and public native/neutral authority. The focused contract
checks are in `test/native-capacity.test.mjs`. The Three, Babylon and Pixi3D
`examples/native-capacity-*.html` pages consume those complete sources
directly and check all native member buffers, visible pixels, refusal
retention and owned cleanup. The independent packed consumer remains #801;
this profile does not establish registry publication or global CAD quality.


## Replace a complete native source in a Three host

The saved `examples/host-replacement-three.html` host uses the public
`@barocss/cad-interop/three` abortable loader. It retains the displayed source
while a candidate loads. Each result keeps the complete original Model and
owns its five display Lines, geometries and materials. The host owns request
generations, Scene membership, camera, renderer, canvas and an unrelated marker.

```js
const generation = ++latestGeneration;
const controller = new AbortController();
const next = await loader.loadAbortable(url, {
  signal: controller.signal,
  onProgress: event => showBytes(event.loadedBytes),
});
if (generation !== latestGeneration) {
  next.dispose(); // A successful earlier request may finish later.
} else {
  scene.add(next.group); // Results arrive detached.
  const previous = accepted;
  accepted = next;
  previous?.dispose(); // Release the old display before the next render.
  renderer.render(scene, camera);
}
```

Keep the accepted result on an abort, HTTP failure or invalid native source.
The loader does not choose the latest request or mount a Group into a Scene.
A host may cancel an earlier request with its AbortController; the example
also leaves one earlier request active to demonstrate stale-success cleanup.
Native parsing is synchronous; an HTTP progress abort does not prove that a
native evaluation can be interrupted. Constructor option timing is unchanged.

This host uses the byte-exact `linear-geometry-pattern-babylon-data/`
`five_quarter_x_copies.barocad` and `spacing_edit_same_roles.barocad` files.
They retain `quarter_pattern`, five Curve IDs, rational basis and native
parameters while copy spacing changes from 2 mm to 3 mm. The display scale is
0.001 scene units/mm. Fixed capacity v1 admits the five original objects;
Curve display v1 derives their polylines. Display buffers remain a preview.

Run with Node 22 and existing workspace dependencies:

```sh
node packages/barocss-cad-interop/examples/host-replacement-verify.mjs
node packages/barocss-cad-interop/examples/host-replacement-server.mjs --port 5195
```

Open `http://127.0.0.1:5195/packages/barocss-cad-interop/examples/host-replacement-three.html`.
Use the six buttons in order. The local example server sends an actual
128-byte first chunk and holds the remaining native source until an explicit
release request. It records actual request/chunk/end/close events. The flow
checks abort retention, native edit adoption, out-of-order completion,
invalid-source/HTTP refusal and idempotent resource cleanup. It keeps the
original native source and Model readable after their display is released.

The server uses a scoped Vite middleware entry and normal public source
exports. The Node verifier applies the existing esbuild source transform in
memory and records the actual CAD/interop source inputs with zero own dist
inputs. Source development requires no package prebuild, aliases or custom
conditions. This example is a workspace source consumer; explicit published
JS/types checks and the held independent packed consumer #801 remain separate.

## Complete Solid mass and stored principal moments in Three

`examples/solid-mass-principal-three.html` preserves all original Boolean panels while showing native total or Body mass, centroid, stored inertia tensor, sorted principal moments and observed degeneracy clusters. Body selection changes property readout while the complete display and its resource identities remain fixed. Repeated moments retain `axesUnique:false`; empty material retains null centroid/tensor/axes. Canonical directions are stored-tensor numerical results, with the full exact mass/conversion proof preserved.

The example uses 51 unchanged native producer files and ordinary public source entries, `measureAxisBoxSolidBooleanMass` / `analyzeAxisBoxSolidPrincipalInertia` and their whole validators. Its fixed caller camera keeps authored XYZ, one mm conversion and default Three normal materials. Full original Model/Body/Shell/source qualification remains available after owned target disposal.

```sh
node packages/barocss-cad-interop/examples/solid-mass-principal-three-verify.mjs --output /absolute/private/evidence
pnpm exec vite --config packages/barocss-cad-interop/examples/solid-mass-principal-three.config.mjs --host 127.0.0.1 --port 5231 --strictPort
```

Open `/packages/barocss-cad-interop/examples/solid-mass-principal-three.html`. Follow the buttons from rect total through disjoint total/Body selection, nonunique cube, empty material, cold reopening and cleanup. Native author verification, exact local merge, integrated UI/file checks and npm publication are separate receipts in Issue1131.

## Complete integer Boolean results in Three

The [complete Boolean example](./examples/axis-box-boolean-three.html) loads all
native panels of the saved union, cavity, through-hole, severed and empty results.
It retains both original seven-object operand Models, each five-object panel
Model, all Body/Shell/void references and the original World XYZ queries. Its
source inputs come from one coherent CAD point-classification result set.

Each whole panel goes through public `BaroCADLoader.parse` with sourceVersion0,
countU2/countV2, unitsPerMillimeter0.001 and nativeCapacity version1/maximumObjects16.
With `curveDisplay` omitted, the four original Curves remain unrendered and one
Surface Mesh owns one geometry/material pair. The host uses fixed cameras in the
original XYZ frame. Its cavity view changes the camera while all panels remain
attached; ordinary depth occlusion remains visible.

The native integer Boolean/material report and the derived Float32 display have
separate authority. An open panel is not independently a Solid. Native original
queries, including an extreme finite outside point, are inspected as data;
the example does not provide exact screen picking or a general Solid kernel.

Run this focused source checkpoint with Node22 before building CAD/interop dist:

```sh
node packages/barocss-cad-interop/examples/axis-box-boolean-three-verify.mjs --output EVIDENCE_DIR
pnpm exec vite --config packages/barocss-cad-interop/examples/axis-box-boolean-three.config.mjs --host 127.0.0.1 --port 5214 --strictPort
```

Open `http://127.0.0.1:5214/packages/barocss-cad-interop/examples/axis-box-boolean-three.html`.
Use the example controls for complete replacement, the declared camera presets,
refusal retention, empty acceptance, cold reopening and double cleanup. Disposal
releases only example target results; the caller Scene, renderer, cameras,
canvas and green marker remain owned by the host.

[Issue1114](https://github.com/barocss/barocss/issues/1114) records the frozen
inputs/limits and the actual native versus integration evidence. The theoretical
72-panel/144-pair staging limits do not establish arbitrary GPU capacity or
performance; the largest original case contains60 panels. Package publication
and the held independent packed-consumer check remain separate.

### Original section world Curve in Three

The optional `@barocss/cad-interop/three-uniform-curve` entry provides a plain `BaroCADUniformCurveLoader`. Its constructor accepts `{sourceVersion:0,unitsPerMillimeter:0.001,uniformCurveDisplay:{version:1,count:129}}`. `parse(source)` retains the complete uniform native result and owns one Three Group/Line; `loadAsync(url,transport={})` uses the existing bounded source reader and accepts an AbortSignal/progress callback. Repeated `result.dispose()` releases only its owned geometry/material. The public `validateBaroCadUniformCurveSourceOptions(input)` returns an independent validated options snapshot. Existing adaptive Three loaders keep their contracts.

The `section-uniform-curve-three` example validates and cold reconstructs the complete original V-linear section, both parent Models and the two dimensionless UV charts. It draws only the original world Curve, sampled at129 native parameters, with one mm conversion. Run the source checkpoint before library builds: `node packages/barocss-cad-interop/examples/section-uniform-curve-three-verify.mjs --mode source --output EVIDENCE_DIR`. After the affected CAD/interop library builds, use `--mode compiled` for the new published JS/declaration checkpoint. Start its own host with `pnpm exec vite --config packages/barocss-cad-interop/examples/section-uniform-curve-three.config.mjs` and open `/packages/barocss-cad-interop/examples/section-uniform-curve-three.html` on5239. Executed native/browser evidence, integrated verification and npm publication are tracked separately in Issue1089 and the Loader Wiki.


## Select a uniform Curve from a complete Source0 file

Optional `@barocss/cad-interop/native-selected-uniform-curve` exports `parseBaroCadSelectedUniformCurveSource` and descriptor-safe `validateBaroCadSelectedUniformCurveSourceOptions`. Optional `@barocss/cad-interop/three-selected-uniform-curve` exports plain `BaroCADSelectedUniformCurveLoader`, `parse`, bounded `loadAsync`, detached owned Group/Line and idempotent `dispose`. Options are `{sourceVersion:0,unitsPerMillimeter:0.001,uniformCurveDisplay:{version:1,count:129},curveId:'target_curve'}`. Select by the original ID, retain the full source/Model, selected ordinal and unrendered sibling IDs. The selected Curve is separately copied; native parameters, mm points, intervals and Float32 positions remain available. Original one-Curve uniform APIs keep their profile.

The selected profile is one source0/mm Model with 1..16 objects, selected degree1..5/2..64 poles/at most70 knots, coordinates within1e6mm and weights1e-6..1e6. Actual CAD compilation owns Source0 UTF16/UTF8 limits. Uniform count2..129 and original domain include both endpoints. Numerical and Float32 loss/collapse checks can refuse a display. Quality remains approximate, without adaptive error, geometry, topology or Solid certification. Only the selected Curve is drawn; siblings retain native CPU data.

`examples/source-curve-control-polygon-three.html` uses24 unchanged actual CAD source-edit originals: quartic, quintic, no-op, signed-zero, cold re-edit and maximum64poles/256changed fields. Genuine source editor and whole owned-result validators retain all original source spans/Model objects, native observations and signed-zero bits. It replaces the selected Line only after complete candidate checks, cold reopens the whole candidate file and applies its saved re-edit request. Edited geometry does not inherit a section/UV proof or update a live document/parametric recipe. Refusal keeps accepted data/resources/frame; disposal captures only owned geometry/material, preserving caller replacements. Native, local integration and npm publication are separate states.


### Uniform original Curve in Babylon

Import `BaroCADUniformCurveBabylonLoader` from `@barocss/cad-interop/babylon-uniform-curve`. Supply explicit uniform options and an existing live right-handed Babylon Scene:

```ts
const loader = new BaroCADUniformCurveBabylonLoader({
  sourceVersion: 0, unitsPerMillimeter: 0.001,
  uniformCurveDisplay: { version: 1, count: 129 },
});
const result = await loader.loadAsync(originalSourceURL, scene, { signal });
// The Scene-registered Line starts disabled. Validate your native context before display.
result.line.setEnabled(true);
// The complete original native data remain readable after idempotent cleanup.
result.dispose();
```

`parse(source, scene)` and `loadAsync(url, scene, transport)` preserve the full neutral uniform result. Constructor options are independently validated snapshots. Only the world Curve is drawn; original parents and dimensionless parameter charts remain separate native data. The adapter owns its LinesMesh, geometry and explicit material, preserves caller resources and releases each owned resource once. Original XYZ and the requested unit conversion are retained. This plain loader does not claim adaptive chord error, native picking or certified Solid topology.

The independently runnable `examples/section-uniform-curve-babylon.html` loads the five original section files, reconstructs the whole parent/proof context, inspects native observations, exercises refusal retention and cold reopening, then disposes twice. Use the matching Vite config (port5248) and focused `section-uniform-curve-babylon-verify.mjs --mode source|compiled --output EVIDENCE_DIR`. Source verification runs before own CAD/interop dist; compiled verification uses actual published JS/declarations.

## Original section context in the Pixi3D uniform Curve loader

Import `BaroCADUniformCurvePixi3DLoader` from `@barocss/cad-interop/pixi3d-uniform-curve`. Pass explicit native uniform options and call `parse(source)` or `loadAsync(url, transport)`. The result retains the complete neutral uniform data and owns a detached `root` with one `mesh`. The caller creates its Pixi renderer and Camera, assigns `result.mesh.material.camera`, validates its original context, then attaches the root.

The adapter uses Pixi3D2.5.0/PixiJS7.2.4 LINE_STRIP with original XYZ and one explicit scale conversion. Constant normals are shader inputs. Uniform samples give an approximate display; there is no adaptive chord-error or adjustable-width guarantee. `dispose()` is idempotent and releases the captured owned root, mesh, geometry and material. Caller replacements and children stay alive; caller children detach when the owned container is destroyed. The caller Application, Stage, renderer and Camera remain caller-owned.

The [independent example](./examples/section-uniform-curve-pixi3d.html) retains both complete parent Models, both dimensionless UV charts and the full original section proof. It draws only the world Curve. The [contract](https://github.com/barocss/barocss/wiki/Loader-Section-Uniform-Curve-Pixi3D) records the five originals, real camera, refusals, cold reopen and resource checks. Pixi peer initialization requires a genuine browser; Node verifies native CPU data and bundle/type graphs separately.

From the workspace root run the example verifier with `--mode source --output ABSOLUTE_EVIDENCE_DIR` before own CAD/interop builds. Run the source Vite config and genuine browser flow. After affected library builds, use `--mode compiled` and start the same config with `LOADER1142_COMPILED_BUNDLE=ABSOLUTE_EVIDENCE_DIR/browser.bundle.mjs` for the actual published-entry browser flow. These checks and local exports do not publish npm packages.

## Selected complete Source0 Curve in Babylon

The optional entry @barocss/cad-interop/babylon-selected-uniform-curve exports
BaroCADSelectedUniformCurveBabylonLoader. Pass explicit sourceVersion:0,
unitsPerMillimeter:0.001, uniformCurveDisplay:{version:1,count:129}, and the
original curveId. parse(source, scene) and loadAsync(url, scene, transport)
require a live Babylon Scene with useRightHandedSystem:true.

The result retains the complete source and Model, selected original object
ordinal and copied Curve, unrendered sibling IDs, native domain, parameters,
millimeter samples, intervals and display quality. Its one identity LinesMesh
is registered in the caller Scene and initially disabled. Validate the complete
candidate before enabling its line and replacing the previous result. The
target position buffer is a distinct Float32 copy, scaled once. Uniform native
parameter intervals are approximate display samples.

dispose() releases the original captured LinesMesh, Geometry and explicit
ShaderMaterial once. Caller geometry/material replacements, children, Scene,
Engine and camera remain caller owned. Native CPU data remain readable.

examples/source-curve-control-polygon-babylon.html demonstrates whole original
mixed-file selection, genuine source edits, both cold reopen checkpoints and
refused-candidate retention using the unchanged CAD-produced files. The source
and emitted public consumers use source-curve-control-polygon-babylon-verify.mjs.
Source edits retain full source/proof authority; they do not preserve obsolete
section UV associations or certify topology, a Solid or global display error.

## Selected complete Source0 Curve in Pixi3D

The optional pixi3d-selected-uniform-curve entry exports
BaroCADSelectedUniformCurvePixi3DLoader. Use explicit sourceVersion:0,
unitsPerMillimeter:0.001, uniformCurveDisplay:{version:1,count:129}, and the
original curveId. parse(source) and loadAsync(url, transport) retain complete
Source0 and Model, selected original ordinal/Curve, unrendered sibling IDs,
original domain, parameters, millimeter points, intervals and display quality.

The actual Pixi3D2.5/PixiJS7 browser target is one detached identity Container3D
with one Mesh3D. Positions are copied Float32 values, scaled once. Sequential
indices use LINE_STRIP; unlit +Z normals are shader inputs and are not native
Curve normals. Assign caller camera/lighting and validate the complete candidate
before attaching it and replacing the previous captured result.

dispose() releases original captured root, mesh, geometry and material once.
Caller children and geometry/material replacements remain caller owned. Native
CPU data remain readable. Genuine Pixi peer initialization requires its browser
image environment; neutral data/type/composition checks in Node are separate
from actual target construction and resource lifetime checks.

examples/source-curve-control-polygon-pixi3d.html demonstrates unchanged complete
CAD-produced files, source edits and two cold reopen checkpoints. Its verifier
keeps actual Node native-data checks and genuine browser SDK checks distinct.
Source edits retain whole original native authority and do not preserve obsolete
section UV associations or certify topology, a Solid or global display error.


## Original signed-sweep XY arcs in Three

`examples/xy-angle-arc-three.html` uses the existing `native-uniform-curve`
and `three-uniform-curve` entries with forty unchanged CAD-produced files.
Each of the ten cases retains its complete original Source0, authored request,
owned native artifact and independent rational-angle witness.

CAD `verifyXYAngleArcArtifact(original)` returns the full copied original
`artifact` and a separate portable verification `report`.
`validateXYAngleArcArtifactVerification(verification)` checks the whole result.
The original source, Model, Curve coefficients and report remain unchanged.
The example retains exact original CSS-to-artifact binding and uses that CSS
for native sampling and the displayed Line. Fresh builder results and the old
strict validator are separate runtime observations. Portable verification does
not claim fresh construction has identical bits across runtimes.

The native readout keeps authored mm/rad units, signed sweep, direction,
original domain, D0/D1 observations, seam policy and construction quality.
A separate section shows portable field rules and their units and bounds.
Uniform native parameters are not angles or uniform arc-length samples.
Interior C0 derivative refusals remain refusals. Copied full-turn endpoints
keep `periodic:false`; sampled observations do not certify a global circle.

The host checks the complete original artifact, portable report and detached
Group/Line before admission. It releases previous captured geometry/material
before its callback. Cold reopen reads all four original files and compares
complete native data, verification, target positions and the displayed frame.
Refusal preserves the accepted data and resources. Double cleanup preserves
caller resources and readable native CPU data. The existing BufferAttribute
uses that result's own Float32 positions; its copy contract is unchanged.

Use `xy-angle-arc-three-verify.mjs` for the bounded source and emitted public
consumers. This example adds no loader entry, workplane editor, constraints,
region or Solid support. Native completion, local integration checks and npm
publication are recorded separately.


## Original signed-sweep XY arcs in Babylon.js

`examples/xy-angle-arc-babylon.html` uses the existing `babylon-uniform-curve`
entry with forty unchanged CAD-produced files. Each case retains the complete
original Source0, authored mm/rad request, native artifact and rational-angle
witness. CAD `verifyXYAngleArcArtifact(original)` returns the unchanged copied
artifact and a separate portable report. The whole verification validator checks
both. The example binds the original CSS to the artifact before native sampling.
Fresh construction and the old strict validator remain separate runtime controls.

Authored angle radians differ from the original rational Curve parameter.
Uniform native samples do not represent uniform angles or arc length. True C0
derivative refusals stay visible. A full turn has a copied seam and remains
nonperiodic. The portable numerical association report states field rules,
units and bounds; it does not replace the saved construction report.

The caller provides a live right handed Scene. The existing options-only
`BaroCADUniformCurveBabylonLoader` parses the original source in that Scene.
Its initially disabled LinesMesh has 129 vertices, 256 paired line indices,
copied Float32 positions and an explicit ShaderMaterial. The host validates
complete CPU and target data before enabling the candidate. It releases the
previous captured line, geometry and material before its callback. Cold reopen
reads all four unchanged files and the public source URL. Refusal retains
accepted data, resources and the displayed frame. Double cleanup preserves
caller Scene, Engine, camera and readable native CPU arrays.

Use `xy-angle-arc-babylon-verify.mjs` for bounded source and emitted public
consumers. This example adds no loader entry, workplane editor, constraints,
region or Solid support. Native verification, current integration and npm
publication are recorded separately.

## Original XY angle-arc artifacts in Pixi3D

The example loads ten unchanged original CAD signed-sweep XY angle-arc artifacts.
It uses the existing `@barocss/cad-interop/pixi3d-uniform-curve` entry.
The saved construction artifact and its separate portable verification report
stay visible beside the original source, native Curve context and display line.

```sh
pnpm exec vite --config packages/barocss-cad-interop/examples/xy-angle-arc-pixi3d.config.mjs --host 127.0.0.1
```

Open `http://127.0.0.1:5282/packages/barocss-cad-interop/examples/xy-angle-arc-pixi3d.html`.
The caller owns the PixiJS application, stage, renderer, camera and lighting.
The host validates each detached result, attaches it, releases the previous
captured root/mesh/geometry/material, and then reports the accepted change.
Refused candidates preserve the accepted source, native data and display.
The controls exercise the original files, shared transport refusals, cold
reopen and double cleanup while the caller's green marker remains visible.

Native rational parameters are not authored radian angles. Uniform native
samples provide an approximate display line; they are not uniform angle or
arc-length samples. Derived shader normals are not CAD Curve normals.
Copied full-turn endpoints remain nonperiodic, and native C0 derivative
refusals remain visible. Portable numerical association is separate from
producer authentication and a same-runtime bit replay.

```sh
node packages/barocss-cad-interop/examples/xy-angle-arc-pixi3d-verify.mjs --mode source --output /tmp/loader1200-source
```

The Node probe checks public CAD and neutral CPU data. Run the example in an
actual PixiJS7/Pixi3D2.5 browser to check rendering and target lifetime.

## Original multi-span Surface Plane sections in Three

`examples/multispan-section-three.html` loads fourteen unchanged CAD files.
It shows the original global World Curve beside complete Support Surface and
Plane previews. The readout retains both whole parent Models, unrendered Curve
siblings, dual dimensionless UV, span lineage, proof bounds and observations.

Use CAD `buildMultiSpanVLinearSurfacePlaneSection` and
`validateMultiSpanVLinearSurfacePlaneSection` to check the complete original
section. The example checks exact original file binding and compares the saved
result with a fresh construction in the same runtime before target allocation.
This bounded section authority is specific to its admitted V-linear inputs.

The existing `three-uniform-curve` loader displays 129 native parameter samples
of the degree-four World Curve. The existing `three` loader previews every
Surface in each original parent with `countU:17`, `countV:9`. Both use explicit
`sourceVersion:0` and `unitsPerMillimeter:0.001`. UV pcurves remain dimensionless
CPU data. Triangle normals are approximate display data. Native C0 derivative
refusals remain visible; a smooth-looking Line does not certify regularity.

The host checks complete native and target data before it replaces an accepted
result. Actual public refusals retain the accepted data and resources. Cold
reopen reads all seven final-family files, then uses public World `loadAsync`
and parent `loadAbortable` methods. Double cleanup releases only captured owned
resources once. Caller Scene, camera, renderer and resources remain usable.

Use `multispan-section-three-verify.mjs --mode source --output <directory>`
before own package builds. After the affected builds, use `--mode compiled` for
actual published entry and declaration consumers. Run from the repository root
with Node 22 or later. This example does not add an SDK entry or extend native
section, trim, topology or Solid contracts. Native verification, integrated
verification and npm publication have separate receipts.


### Original multi-span Surface–Plane sections in Babylon.js

The independent `examples/multispan-section-babylon.html` host uses the existing
public Babylon Surface and uniform Curve loaders. It retains all fourteen
original files and complete parent Models, including unused Curve siblings and
an extra Support Surface. Native World/dual UV/span proof/C0 derivative refusals
stay separate from approximate uniform line and triangle preview data.

Run the source flow before building the two libraries:

```sh
node packages/barocss-cad-interop/examples/multispan-section-babylon-verify.mjs --mode source --output /tmp/loader1222-source
pnpm exec vite --config packages/barocss-cad-interop/examples/multispan-section-babylon.config.mjs
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/cad-interop build:library
node packages/barocss-cad-interop/examples/multispan-section-babylon-verify.mjs --mode compiled --output /tmp/loader1222-compiled
LOADER1222_COMPILED_BUNDLE=/tmp/loader1222-compiled/browser.bundle.mjs pnpm exec vite --config packages/barocss-cad-interop/examples/multispan-section-babylon.config.mjs
```

The caller owns the actual right-handed Scene, Engine, camera, light and marker.
Surface results register enabled meshes; the host disables them immediately and
qualifies the whole original context before enabling a candidate. World LinesMesh
starts disabled and owns an explicit ShaderMaterial. Two Support meshes share
one StandardMaterial; disposal observes each unique material once. Original UV
is CPU data and Surface metadata, never a World trace or texture UV attribute.
The host demonstrates replacement, genuine refusals, cold source URL loading
and repeated cleanup while preserving caller resources. The source CPU flow uses
real Babylon NullEngine objects; actual renderer/frame checks require the headed
browser. Native completion, local integration and registry publication are separate.

## Inspect original Surface curvature in a Babylon host

`examples/native-surface-curvature-babylon.html` reads six original source,
query and result files. It loads the complete rational cylinder through the
public Babylon adapter into a caller-owned right-handed Scene. Original
Surface coefficients, U/V domains and native data remain available.

Public `evaluateSurfaceCurvature` and `evaluateSurfaceD2` query the accepted
original Surface. The readout shows original U/V, D2, point in millimetres,
unit normal, mean and principal curvature in 1/mm, Gaussian curvature in
1/mm² and the actual numeric policy. Negative zero stays visible. This API
has no separate whole-result validator. These are local native observations;
global regularity, Face/Solid orientation and certification have separate
contracts.

The source0 preview uses grid8 and 0.001 scene units/mm. Its 64 vertices and
98 triangles retain native U/V data. The example displays a point marker at
native point × 0.001 and a normal line of declared length0.0008 scene units
(0.8mm). Marker radius is 0.00008. Magenta point and yellow normal use an
explicit overlay: rendering group1, depth function ALWAYS and depth writes
disabled. The source preview and fixed camera keep their original placement.

Four original cylinder queries replace only the two owned annotations.
Native validation and complete candidate preparation occur before the query
readout changes. Babylon creates meshes in the caller Scene; candidates are
disabled during synchronous preparation. Real mesh/material disposal events
and geometry instance calls track each owned resource. Double cleanup
releases the preview and annotations once. Independent original source,
Model and native query data remain readable. Caller Engine, Scene, camera,
canvas and green marker stay live.

The original sphere has four valid local native queries. Its complete grid8
preview raises the actual collapsed-triangle refusal. The example retains
the accepted cylinder and query after this refusal. Invalid U/V, malformed
native Surface and forged object identity also preserve the accepted state.

Run from a source workspace with Node22 and installed dependencies:

```sh
node packages/barocss-cad-interop/examples/native-surface-curvature-babylon-verify.mjs --output /tmp/baro-babylon-surface-curvature
pnpm exec vite --config packages/barocss-cad-interop/examples/native-surface-curvature-babylon.config.mjs --host 127.0.0.1 --port 5202 --strictPort
```

Open `/packages/barocss-cad-interop/examples/native-surface-curvature-babylon.html`.
The fixture declares exact hashes for all six copied producer files. Only
two CAD text data routes serve original disk bytes; public module imports
use ordinary source resolution. NullEngine verifies native data and resource
behavior. Actual headed HTTP/WebGL2 pixels, published JavaScript/types,
packed installation and registry publication each need separate evidence.

## Inspect original Surface curvature in a Pixi3D host

`examples/native-surface-curvature-pixi3d.html` reads six original source,
query and result files. The public Pixi3D loader creates the complete original
cylinder preview. The caller supplies the Application, renderer, Stage,
camera, canvas and green marker.

Public `evaluateSurfaceCurvature` and `evaluateSurfaceD2` query the accepted
original Surface. The readout shows native U/V, point in millimetres, D2,
unit normal, mean and principal curvature in 1/mm, Gaussian curvature in
1/mm² and returned metric/discriminant fields. Original saved Gaussian `-0`
is preserved. This API returns local native observations. Global regularity,
Face/Solid orientation and engineering certificates have separate contracts.

Source0 grid8 uses 0.001 scene units/mm. The original preview has 64 vertices
and 98 triangles; native U/V and coefficients remain available. Each query
creates a separate point sphere of radius0.00008 and a normal line with
length0.0008 scene units (0.8mm). Point position is native point × 0.001.
Point and normal materials use explicit overlays with depth tests and depth
writes disabled. The fixed camera and original preview placement stay intact.

The complete native query and candidate annotation pair are prepared while
roots are detached. The example then attaches the pair and releases the
previous pair before render. Real instance destroy wrappers track owned
roots, meshes, geometry and materials. Four queries create five roots and
nine mesh/geometry/material resources. Double cleanup releases each once.
Original source, Model, Surface and native query data remain readable.
Caller Application, Stage, renderer, Camera and marker remain live.

The original sphere has four valid local curvature queries. Its complete
grid8 preview raises the actual collapsed-triangle refusal. Invalid U/V,
malformed native Surface and a forged original object reference preserve the
accepted cylinder, query, annotations and frame.

Run from a source workspace with Node22 and installed dependencies:

```sh
node packages/barocss-cad-interop/examples/native-surface-curvature-pixi3d-verify.mjs --output /tmp/baro-pixi-surface-curvature
pnpm exec vite --config packages/barocss-cad-interop/examples/native-surface-curvature-pixi3d.config.mjs --host 127.0.0.1 --port 5203 --strictPort
```

Open `/packages/barocss-cad-interop/examples/native-surface-curvature-pixi3d.html`.
The fixture declares exact hashes for six copied producer files. Only two
CAD text data routes serve original disk bytes. Public module imports use
ordinary source resolution. The Node flow checks native and neutral API
behavior. Actual Pixi controller lifetime and HTTP/WebGL2 pixels are browser
checks. Published JavaScript/types, packed installation and registry release
require separate evidence.

## Complete Source0 Surface editing in Three.js

The [complete-source editing example](examples/source-surface-control-net-three.html)
uses the public CAD `editSourceSurfaceControlNet` operation and its whole-result
validator before replacing a Three.js preview. It preserves the complete original
asset: Unicode text, comments, unchanged literal spans, model identity, object
order, sibling geometry and the selected Surface's edit proof.

Use the returned **whole `result.source` and `result.model`** as the edited asset.
The nested `result.edit.source` and `result.edit.model` describe only the selected
Surface. They are an independent native child proof and cannot replace the full
asset. The example checks this boundary before allocating a candidate preview.

Five unchanged original producer cases cover weighted numeric edits, signed zero,
no-op literal spelling, the maximum 64 scalar patches, and a cold candidate
re-edit. Both Surface previews use an 8x8 grid with one 0.001 mm-to-display scale.
The degree 1 and degree 5 sibling Curves remain in the complete native Model and are
listed as unrendered; this Surface-only example does not enable curveDisplay.

An edit request must match the accepted full source. Native editing, whole-owned
proof, independent cold compilation and neutral display validation finish before
a detached Three Group is accepted. Refused input retains the accepted full
source/model, readout, scene and owned resources. Replacement and final double
cleanup release only the example's own geometry/materials. Caller scene, camera,
renderer, canvas and marker remain usable.

Run the focused source/Three CPU verifier with Node 22:

```sh
node packages/barocss-cad-interop/examples/source-surface-control-net-three-verify.mjs --output /absolute/evidence-directory
pnpm exec vite --config packages/barocss-cad-interop/examples/source-surface-control-net-three.config.mjs --host 127.0.0.1 --port 5205 --strictPort
```

Open `/packages/barocss-cad-interop/examples/source-surface-control-net-three.html`.
The served Source0 files are the actual complete originals and candidates. Apply
the five edit cases, reopen the whole candidate, exercise the refusal controls,
then dispose twice. The fixed camera permits direct original/candidate frame
comparison; signed-zero and no-op edits preserve rendered geometry.

This is source0 native editing and a Three.js display consumer. It does not certify
geometric validity, topology, Solid status, manufacturing tolerance or editor
display. Build/source/browser evidence is separate from compiled public entries,
packed consumption, other engines and npm publication.

### Inspect stored trim UV beside the original Support Surface

The `native-trim-uv-classification-three.html` example retains a complete
eight-object Source0 Model: one Support Surface and seven native Curves.
It shows the whole untrimmed Support Surface and reads the stored trim graph
through the existing public CAD classifier. The dimensionless UV graph is
native data. It does not become a world-space line, filled Face or trimmed mesh.

```ts
import {
  classifyVLinearSurfacePlaneTrimUV,
  validateVLinearSurfacePlaneTrimUVClassification,
} from '@barocss/cad';
import { BaroCADLoader } from '@barocss/cad-interop/three';

const classification = classifyVLinearSurfacePlaneTrimUV(
  originalRequest.trim, originalRequest.queries, originalRequest.options,
);
validateVLinearSurfacePlaneTrimUVClassification(classification);

const display = new BaroCADLoader({
  sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  nativeCapacity: { version: 1, maximumObjects: 16 },
}).parse(originalRequest.trim.world.source);
// curveDisplay is omitted: all seven Curves remain in display.model.
// display.unrenderedCurveIds includes the original degree-four cut.
scene.add(display.group);
```

Classification validates the complete owned parent proof. The Three result
retains the original source and Model while deriving one 64-vertex,
98-triangle display at the chosen scale. Native source, qualified Face IDs,
UV sidecars and classification remain the query authority. The display does
not certify ideal Plane side, topology, Solid or manufacturing tolerance.

Three genuine groups supply 36 byte-pinned original files and nine queries.
The primary query at `u=0.5`, `v=0.30000000000000004` reaches its explicit
subdivision cap and returns `uncertain` for both Faces. This is a successful
result. Finite UV outside the chart and a zero subdivision budget are also
supported success states; do not turn them into binary material guesses.

The host prepares each candidate detached, checks whole source/bindings and
native/neutral data, then replaces the accepted display and readout. It
releases the previous geometry/material before rendering. Refused native
queries, forged proofs, invalid source/options and explicit host binding
errors retain the accepted asset. The two host binding errors belong to this
example; they are not public CAD diagnostic codes. Cold reopening retains the
whole edited source and native graph. Double cleanup releases each owned pair
once and preserves the caller Scene, camera, renderer, canvas and marker.

Use Node 22 with the existing workspace dependencies, before library builds:

```sh
node packages/barocss-cad-interop/examples/native-trim-uv-classification-three-verify.mjs --output /tmp/barocss-trim-uv-proof
pnpm exec vite --config packages/barocss-cad-interop/examples/native-trim-uv-classification-three.config.mjs --host 127.0.0.1 --port 5206 --strictPort
```

Open `http://127.0.0.1:5206/packages/barocss-cad-interop/examples/native-trim-uv-classification-three.html`.
After the initial dyadic case, run refusals, load the primary case, load the
edited case, cold reopen it, then clean up twice. The fixed original-coordinate
camera shows the Support Surface; the readout preserves each UV query and its
qualified classifications. Original CSS files are served as exact plain-text
bytes. The verifier records actual source resolution and Three CPU resource
events; the browser separately observes HTTP bytes, real pixels and lifetime.
This workspace source example does not establish published JS/types, editor
Save/Open recovery, other targets, packed consumer #801 or npm release.


### Original multi-span Surface–Plane sections in Pixi3D

`examples/multispan-section-pixi3d.html` loads the unchanged original World Curve and complete Surface/Plane Models. It shows all17 native observations, four-span lineage, dual dimensionless UV, whole Models and genuine C0 derivative refusals. Parent Curves stay native and unrendered. Native UV is retained in `surface.mesh.parameters`; it is not a texture UV or a World line.

The example uses the existing public `BaroCADPixi3DLoader` and `BaroCADUniformCurvePixi3DLoader` entries. World uses129 original uniform samples and sequential Uint16 `LINE_STRIP` indices. Each Surface has a separate material. Results qualify while detached before attach; replacement, refused inputs, cancelled loads, fresh original URL loads and double cleanup retain caller resources. Surface cleanup retains its existing current-geometry/material ownership policy; this example does not substitute caller resources into owned results.

Run from the workspace with Node22 and the pinned PixiJS7.2.4/Pixi3D2.5 peers:

```sh
node packages/barocss-cad-interop/examples/multispan-section-pixi3d-verify.mjs --mode source --output /tmp/barocss-loader1238-source
pnpm exec vite --config packages/barocss-cad-interop/examples/multispan-section-pixi3d.config.mjs
```

Open `http://127.0.0.1:5297/multispan-section-pixi3d.html`. Follow the buttons through refused inputs, cancelled loads, nonuniform original, cold reopen and double cleanup. The caller Sphere remains green. World visibility can be toggled independently; native data stays unchanged.

The source verifier runs before CAD/interop builds and uses ordinary native CPU APIs without a fake Pixi DOM. For actual emitted JS and selected published declarations, build the two libraries and run:

```sh
pnpm --filter @barocss/cad build:library
pnpm --filter @barocss/cad-interop build:library
node packages/barocss-cad-interop/examples/multispan-section-pixi3d-verify.mjs --mode compiled --output /tmp/barocss-loader1238-compiled
BAROCSS_LOADER1238_MODE=compiled BAROCSS_LOADER1238_COMPILED_DIR=/tmp/barocss-loader1238-compiled pnpm exec vite --config packages/barocss-cad-interop/examples/multispan-section-pixi3d.config.mjs
```

The caller host initializes the real depth buffer before each frame while preserving the prior depth write mask. Materials explicitly use its Camera and LightingEnvironment. Global camera/lighting, renderer, Stage, canvas and caller resources remain outside adapter disposal. Approximate display geometry and dimensionless native proof are shown separately; no trimmed fill, Solid, manufacturing or npm release certificate follows from this example.

## Original multi-span trim UV classification in Three

The independent `examples/multispan-trim-uv-three.html` host reads the unchanged
original multi-span trim request and owned-result files. It shows each original
query, selected span/domain/pole indices, original parameter bracket, subdivision
steps and two qualified Face classifications beside the complete untrimmed
Support Surface. The original Model8 retains its seven unrendered Curves.
Native UV values remain dimensionless. Cap0 remains successful `uncertain`.

Run the source host from the repository root with Node22:

```sh
pnpm exec vite --config packages/barocss-cad-interop/examples/multispan-trim-uv-three.config.mjs
```

Open `http://127.0.0.1:5298/packages/barocss-cad-interop/examples/multispan-trim-uv-three.html`.
Use the buttons in order: source refusals, transport refusals, joins, cap0,
fresh file reopen and double cleanup. The host verifies original byte/SHA pins,
complete native ownership, actual Three buffers and fixed camera/frame retention.
The caller marker survives cleanup. The complete native readout remains available.
The preview does not produce a clipped fill, a sewn BRep, a Body or a Solid.

This example uses the existing public CAD classifier/validator, neutral native
parser and Three loader. It adds no CAD or adapter API. Product integration,
publication and later screen/file/recovery validation have separate receipts.

## Original multi-span trim UV classification in Babylon.js

The independent `examples/multispan-trim-uv-babylon.html` host reads the original multi-span classification beside its complete, untrimmed Support Surface. It uses the existing public CAD and Babylon.js loaders.

Sixteen unchanged files contain nine authored queries, the complete Model8 source, both original parent sources and seven dimensionless UV sidecars. The seven Curves remain in the native model. The host displays original spans, lower-span joins, parameter brackets, subdivision steps and both qualified Face classifications. Cap0 is a successful `uncertain` result.

The Surface preview uses the original17×9 grid. It does not turn UV data into World lines or clip the Surface. The source and readout remain available after owned resources are released. The caller keeps its camera, scene, renderer and marker.

The ordered flow checks11 genuine input refusals and5 shared transport refusals, reads all three cases, then loads12 fresh original files and the public whole-parent source URL. It checks the native data, camera, full frame and actual resource lifetime before double cleanup.

From the repository root with Node22, run the source verifier before building the CAD and interop packages:

```sh
node packages/barocss-cad-interop/examples/multispan-trim-uv-babylon-verify.mjs --mode source --output <fresh-source-evidence>
pnpm exec vite --config packages/barocss-cad-interop/examples/multispan-trim-uv-babylon.config.mjs
```

After the affected builds, check the emitted public entries and use their browser bundle:

```sh
node packages/barocss-cad-interop/examples/multispan-trim-uv-babylon-verify.mjs --mode compiled --output <fresh-compiled-evidence>
LOADER1288_COMPILED_BUNDLE=<fresh-compiled-evidence>/browser.bundle.mjs pnpm exec vite --config packages/barocss-cad-interop/examples/multispan-trim-uv-babylon.config.mjs
```

The actual host uses port5299 at `/packages/barocss-cad-interop/examples/multispan-trim-uv-babylon.html`. CPU checks and genuine WebGL2 target checks have separate receipts. Issue#1288 and the Loader Wiki record the actual native commit, executed gates and first errors. Native delivery, local integration and publication are separate states.

## Original multi-span trim UV classification in Pixi3D

The independent `examples/multispan-trim-uv-pixi3d.html` host reads the original multi-span classification beside its complete, untrimmed Support Surface. It uses the existing public CAD and Pixi3D loaders.

Sixteen unchanged files contain nine authored queries, the complete Model8 source, both original parent sources and seven dimensionless UV sidecars. The seven Curves remain in the native model. The host displays original spans, lower-span joins, parameter brackets, subdivision steps and both qualified Face classifications. Cap0 is a successful `uncertain` result.

The Surface preview uses the original17×9 grid. It does not turn UV data into World lines or clip the Surface. The source and readout remain available after owned resources are released. The caller keeps its camera, scene, renderer and marker.

The ordered flow checks11 genuine input refusals and5 shared transport refusals, reads all three cases, then loads12 fresh original files and the public whole-parent source URL. It checks the native data, camera, full frame and actual resource lifetime before double cleanup.

From the repository root with Node22, run the source verifier before building the CAD and interop packages:

```sh
node packages/barocss-cad-interop/examples/multispan-trim-uv-pixi3d-verify.mjs --mode source --output <fresh-source-evidence>
pnpm exec vite --config packages/barocss-cad-interop/examples/multispan-trim-uv-pixi3d.config.mjs
```

After the affected builds, check the emitted public entries and use their browser bundle:

```sh
node packages/barocss-cad-interop/examples/multispan-trim-uv-pixi3d-verify.mjs --mode compiled --output <fresh-compiled-evidence>
LOADER1289_COMPILED_BUNDLE=<fresh-compiled-evidence>/browser.bundle.mjs pnpm exec vite --config packages/barocss-cad-interop/examples/multispan-trim-uv-pixi3d.config.mjs
```

The actual host uses port5300 at `/packages/barocss-cad-interop/examples/multispan-trim-uv-pixi3d.html`. CPU checks and genuine WebGL2 target checks have separate receipts. Issue#1289 and the Loader Wiki record the actual native commit, executed gates and first errors. Native delivery, local integration and publication are separate states.

## Inspect an exact lower-strip Face in Three.js

[Issue #1299](https://github.com/barocss/barocss/issues/1299) defines this external host.
Open `examples/exact-lower-strip-face-three.html` with its dedicated Vite config.
The two complete original files retain one Support and four native Curves each.
Read the forward/reverse Face, oriented Uses, exact bindings and original native observations.
The visible Surface remains the whole untrimmed Support. Native UV values are dimensionless.
Individual Face certificates do not define a sewn Body, Solid or clipped display fill.

Use Node22 and the repository's installed optional Three peer. From the repository root:

```sh
node packages/barocss-cad-interop/examples/exact-lower-strip-face-three-verify.mjs --mode source --output /tmp/loader1299-source
pnpm exec vite --config packages/barocss-cad-interop/examples/exact-lower-strip-face-three.config.mjs
```

Run the source verifier before building the CAD and interop libraries. The emitted verifier
uses `--mode compiled` and a fresh output directory. Set `LOADER1299_COMPILED_BUNDLE`
to that directory's `browser.bundle.mjs` to serve the same host from actual emitted entries.
The host checks original files, native/input refusals, transport refusal, replacement,
fresh whole-source reload and double cleanup. It retains complete native CPU authority.
Only the owned Three resources are disposed. Caller objects and the camera remain available.
This is a local runnable host; package publication and current composed acceptance are separate.

## Replace complete native CAD files in a Babylon host

[Issue #1300](https://github.com/barocss/barocss/issues/1300) defines this external host.
Open `examples/host-replacement-babylon.html` through its real local HTTP server.
Two unchanged complete native files contain the same five rational Curve IDs.
The authored copy spacing changes from 2 mm to 3 mm; the whole native Model stays authoritative.
The caller chooses the current request generation and controls the render boundary.
Each candidate is disabled before qualification; a late older success is disposed.

Use Node22 and the repository's installed optional Babylon peer. From the repository root:

```sh
node packages/barocss-cad-interop/examples/host-replacement-babylon-verify.mjs --mode source --output /tmp/loader1300-source
node packages/barocss-cad-interop/examples/host-replacement-babylon-server.mjs
```

Run the source verifier before building the CAD and interop libraries. The emitted verifier
uses `--mode compiled` and a fresh output directory. Set `LOADER1300_COMPILED_BUNDLE`
to that directory's `browser.bundle.mjs` for the same host from actual emitted public entries.
Real chunked HTTP demonstrates progress cancellation, current-file replacement, an older
success after the newer response, HTTP404 retention and double cleanup.
Only owned Lines, geometries and automatic materials are disposed. Caller resources survive.
Native curve parameters and source units remain separate from scaled display coordinates.
This is a caller workflow; it adds no Loader manager or general transaction guarantee.
Package publication and current composed acceptance remain separate.

## Original exact lower-strip Face in Babylon (#1313)

This independent host reads 22 unchanged CAD originals for the low and high Face.
It checks the saved and fresh complete native certificates and 80 observations.
The Model keeps one Support and four unrendered Curve siblings.
The preview shows the complete, untrimmed Support; native UV remains CAD metadata.
Face orientation does not change display triangles or certify a general Solid.

Use Node 22. Run source verification before building this checkout's libraries:

```sh
node packages/barocss-cad-interop/examples/exact-lower-strip-face-babylon-verify.mjs --mode source --output /tmp/loader1313-source
pnpm exec vite --config packages/barocss-cad-interop/examples/exact-lower-strip-face-babylon.config.mjs
```

Open the printed host URL. Follow refusals, transport, high Face, cold reload and cleanup.
The host checks all native data, copied buffers, its fixed camera and full frame.
It stages Babylon candidates while disabled and prepares their real materials.
It releases each owned Mesh, Geometry and material once and retains caller resources.
For emitted verification, build CAD and interop, then use `--mode compiled`.
Serve its generated browser bundle with `LOADER1313_COMPILED_BUNDLE`.
This is a selected original-data consumer, not an all-peer or manufacturing certificate.
Source/emitted proof and exact local adoption remain separate from npm publication.

## Original exact lower-strip Face in Pixi3D (#1314)

This independent host reads 22 unchanged CAD originals for the low and high Face.
It checks the saved and fresh complete native certificates and 80 observations.
The Model keeps one Support and four unrendered Curve siblings.
The preview shows the complete, untrimmed Support; native UV remains CAD metadata.
Face orientation does not change display triangles or certify a general Solid.

Use Node 22. Run source verification before building this checkout's libraries:

```sh
node packages/barocss-cad-interop/examples/exact-lower-strip-face-pixi3d-verify.mjs --mode source --output /tmp/loader1314-source
pnpm exec vite --config packages/barocss-cad-interop/examples/exact-lower-strip-face-pixi3d.config.mjs
```

Open the printed host URL. Follow refusals, transport, high Face, cold reload and cleanup.
The host checks all native data, copied buffers, its fixed camera and full frame.
Node verification covers CAD and neutral data; actual Pixi resources need a browser.
It releases each owned root, Mesh, Geometry and material once and retains caller resources.
For emitted verification, build CAD and interop, then use `--mode compiled`.
Serve its generated browser bundle with `LOADER1314_COMPILED_BUNDLE`.
This is a selected original-data consumer, not an all-peer or manufacturing certificate.
Source/emitted proof and exact local adoption remain separate from npm publication.


## Qualified translated-strip Body: native CPU ingestion

Use the optional `@barocss/cad-interop/qualified-body` entry for the complete
qualified translated-strip Body result. It reconstructs the original native
Body through the public CAD validator. It does not create renderer resources.

```js
import {
  parseBaroCadQualifiedTranslatedStripBody,
  readBaroCadQualifiedTranslatedStripBody,
} from '@barocss/cad-interop/qualified-body';

const accepted = parseBaroCadQualifiedTranslatedStripBody(completeJsonText);
const independent = readBaroCadQualifiedTranslatedStripBody(accepted.native);
```

The result keeps the complete thirteen-field native Body, an independent
validation report, explicit ingestion profile and original text (or `null`
for owned-data input). The native report identifies the actual version 0
qualified translated-strip family. There is no new envelope inside the native
artifact. Both Models (16 and 2 objects), all complete parents, six Faces,
twelve Edges, eight Vertices, twenty-four Uses and the entire material proof
remain. Authored XYZ, mm, mm3 and dimensionless UV are unchanged.

Accepted native values are independent mutable CPU copies with garbage
collection ownership. A caller mutation or a failed admission cannot change
another accepted result. Acyclic aliases are copied and charged per occurrence;
cycles are refused. Keep the original text for exact file bytes. Ordinary
`JSON.stringify` loses numeric negative zero and is not the original codec.

Text must be strict JSON with valid scalar Unicode, finite represented numbers,
unique decoded keys and no trailing data. Own data must have plain records or
dense arrays, enumerable data descriptors and no getters, symbols or hidden
properties. Raw text UTF8 and UTF16 limits are each 2 MiB. Own canonical signed
JSON including its final newline is bounded separately. Admission limits are
1,048,576 value occurrences, depth 64, 64 record fields, 8,192 array elements,
262,144 string units and 128 key units. Existing Source0, document and feature
transport limits remain unchanged. Refused getters are not invoked; arbitrary
Proxy reflection is not covered by that promise.

`BaroCadQualifiedBodyReadError` distinguishes INPUT, JSON, OWNED, BUDGET,
SCHEMA and NATIVE. Authoritative NATIVE failures retain the actual CAD error
as `cause`. Native direct-work counters exclude parent and internal rebuild
work; they are not total reader CPU work or a time guarantee.

The native restricted Solid/material certificate retains its actual authority.
Generic Solid, Boolean, WorldXYZ query, filled boundary display, manufacturing,
exchange, URL/cancellation and byte overloads are unsupported by this entry.
The executable `qualified-body-native-verify.mjs` uses three complete original
files and checks source/emitted admission, copy independence and real refusals.
Package configuration and local adoption do not imply npm publication.

### Complete source NURBS Loft Graph and update receipts

The optional `@barocss/cad-interop/nurbs-source-loft-feature-graph` entry reads
complete saved CAD Graph results and complete selective update wrappers.
It calls the matching public CAD whole validator for every eligible read.
The native authored-document parser is a separate existing CAD API.

```ts
import {
  parseBaroCadNurbsSourceLoftFeatureGraph,
  readBaroCadNurbsSourceLoftFeatureGraph,
  parseBaroCadNurbsSourceLoftFeatureGraphUpdate,
  readBaroCadNurbsSourceLoftFeatureGraphUpdate,
} from '@barocss/cad-interop/nurbs-source-loft-feature-graph';
const graph = parseBaroCadNurbsSourceLoftFeatureGraph(savedGraphText);
const graphCopy = readBaroCadNurbsSourceLoftFeatureGraph(graph.native);
const update = parseBaroCadNurbsSourceLoftFeatureGraphUpdate(savedUpdateText);
const updateCopy = readBaroCadNurbsSourceLoftFeatureGraphUpdate(update.native);
```

Each result has `native`, `validationReport`, `profile`, and `sourceText`.
Native data and the actual validator report are independent mutable CPU copies.
They share no mutable objects with the input, each other, or another read.
The profile is deeply frozen. Text reads retain exact admitted text;
own-data reads return `sourceText: null`.

The Graph retains complete Sources, Models, source-edit receipts, selected
Curves, stations, weights, qualified bindings, and native reports.
The update also retains the previous authored document, options, edits,
complete next Graph, and the actual selective transaction report.
Graph receipt counts describe retained receipts; transaction direct counts
have their own native work scope. Neither is Loader runtime telemetry.
Suppressed Loft evaluation can be null. A semantic no-op remains a no-op.
Authored XYZ/mm and represented finite numbers, including `-0`, are retained.
V degree 1 and piecewise C0 do not establish smooth G1 or G2.

Raw complete-result text and canonical native copies each use the explicit
2 MiB UTF-8 and UTF-16 caps. Native authored 1 MiB and aggregate Source
262144 limits stay separate. Work quotas apply to each parse or copy pass.
The strict codec rejects malformed JSON, decoded duplicate keys, invalid
Unicode scalars, nonfinite numbers, getters, cycles, hidden fields, and
foreign data. Acyclic aliases are copied separately per occurrence.
The reader preserves actual CAD errors as native failure causes.

There is no renderer, URL or byte entry, public serializer, topology or
Solid authority, Boolean operation, manufacturing or publication API here.
The file example uses unchanged native originals and a private signed-zero
writer. Source and emitted checks cover complete file reopen, independent
copies, the real suppressed/no-op receipts, and genuine refusals.

### Complete translated-strip World XYZ classification results

The optional `@barocss/cad-interop/translated-strip-world-points` entry reads
complete saved native source-region classification results.
It calls the actual public CAD whole validator for each eligible read.

```ts
import {
  parseBaroCadTranslatedSurfaceStripWorldPointClassification,
  readBaroCadTranslatedSurfaceStripWorldPointClassification,
} from '@barocss/cad-interop/translated-strip-world-points';
const result = parseBaroCadTranslatedSurfaceStripWorldPointClassification(text);
const copy = readBaroCadTranslatedSurfaceStripWorldPointClassification(result.native);
```

Each result has `native`, `validationReport`, `profile`, and `sourceText`.
The complete native data and actual validator report are independent mutable
CPU copies. They share no mutable objects with input or other reads.
The profile is deeply frozen. Text reads preserve exact admitted text;
own-data reads return `sourceText: null`.

The reader retains the whole volume, original Sources and Models, exact
query coordinates, classifications, root selectors, rational remainder and
sign witnesses, reports, native work scopes, and original file-size metadata.
Inside/outside/boundary describes the declared source-defined region.
Exact irrational native U can be null. No rounded native U is invented.
An internal span join is not automatically a material boundary.
Authored XYZ/mm and dimensionless UV remain unchanged, including numeric `-0`.
This family does not establish Body, BRep, Solid, picking or collision authority.

Raw UTF-8 bytes and UTF-16 units each have a 1 MiB family cap before decode.
Canonical copied native JSON plus newline also has a 1 MiB cap before
native work. The unchanged shared copy helper has a transient 2 MiB guard;
this is separate from the accepted 1 MiB family cap. Work quotas apply per pass.
Strict JSON rejects malformed data, decoded duplicate keys, invalid Unicode
scalars and nonfinite numbers. Own data rejects getters, cycles, hidden fields,
foreign records and sparse arrays. Acyclic aliases are copied per occurrence.
Actual CAD failure causes are retained by the named reader error.

There is no URL, byte-input, public serializer or renderer-resource API here.
The example preserves unchanged original files and an independent oracle,
and uses a private signed-zero writer for complete saved-file reopen.
Source and emitted checks cover the real outside-to-inside edit and exact
quadratic boundary witnesses, independent copies and genuine refused inputs.

## Complete degree-five Surface edits in Three

The `wide-source-surface-three` example uses the existing complete-source CAD
wide Surface writer and the public native/Three loaders. It keeps the whole
mixed Source0 Model, both Surfaces and the unrendered context Curve.

Its two literal input families retain native U/V degree5: a six-by-six grid
with coordinates beyond the older narrow editor profile, and a sixteen-by-sixteen
grid with256poles/1024 changed scalar fields. The original eight files are
copied unchanged. A saved mesh or selected Surface alone is not the source asset.

The display options are explicit:

```js
const options = {
  sourceVersion: 0,
  countU: 17,
  countV: 9,
  unitsPerMillimeter: 0.001,
};
```

No new nativeCapacity, curveDisplay or public SDK entry is required. Each native
Surface packet has153vertices/256triangles. Display positions/normals/native-UV
copies are Float32; indices are Uint16. Native XYZ/mm and the original Model
remain separate from the display buffers; scaling occurs once.

The whole edit validator returns an independent report. Preserve the complete
edit result, original/candidate source, Models, patch spans, scalar provenance,
unselected siblings, knot/domain/grid values and numeric signed zero.
Stored native D0/D1 observations are retained. Triangle normals use sampled D0
and area-weighted triangle sums; they are not analytic D1 or smoothness proof.

Actual native refusals include weight0 (`NATIVE` with the original weight Error),
missing Surface (`TARGET`), own getter/nonfinite scalar (`INPUT`, getters0), and
changed owned patch/source (`OWNED`). Host binding and transport failures retain
the current accepted native data, buffers, caller resources and camera.

The example stages complete candidate data before replacing the accepted result.
Its source and emitted verifier records the literal files, whole native values,
actual target buffers, cold source loading, refused replacements and ownership.
Current local adoption, integrated acceptance and registry publication are separate.
No smooth Loft, persistent recipe/topology binding, Solid, manufacturing or
publication certificate follows from this display. Packed consumer #801 remains held.

## Qualified translated-strip Body boundary mesh

The optional `@barocss/cad-interop/qualified-body-boundary-mesh` entry reads complete native mesh results and prepares six independent CPU display chunks.
It uses the native whole-result validator. It retains the complete Body, original source Models, authority packet, Edge paths, Face samples, proof and report.

```ts
import { parseBaroCadQualifiedBodyBoundaryMesh, readBaroCadQualifiedBodyBoundaryMesh } from '@barocss/cad-interop/qualified-body-boundary-mesh';
const read = parseBaroCadQualifiedBodyBoundaryMesh(text, { unitsPerMillimeter: 0.001 });
const copied = readBaroCadQualifiedBodyBoundaryMesh(read.native, { unitsPerMillimeter: 0.001 });
```

Both functions require the explicit fixed `0.001` scale. Other scales are refused.
The result contains `native`, an independent `validationReport`, a deeply frozen `profile`, exact `sourceText` (or `null` for owned input), and `projection`.
Each projection retains the original Face ID, role, orientation and qualified support reference.
Position and facet-normal arrays are Float32; original native UV is Float64; local and authority/sample/triangle indices are UInt32.
Native quantization, additional scale/upload and total display-to-authority gaps are separate observed values in mm.
Facet normals describe approximate triangles. Native evaluated and refused-C0 derivative states remain unchanged.

Strict JSON and safe own-data copies use separate 4 MiB UTF8/UTF16/canonical-native budgets and 4,194,304 values per pass.
Duplicate decoded keys, nonfinite numbers, invalid scalar Unicode, getters, cycles and unsupported own data are refused; numeric `-0` is retained.
The older qualified Body reader keeps its separate 2 MiB limits.
All mutable returned data is independently owned. Only frozen profile metadata is shared.
This entry has no renderer, URL/byte loader, serializer or disposal API.
It does not certify global geometric error, mesh embedding, a new Solid, manufacturing or publication.

`examples/qualified-body-boundary-mesh-verify.mjs` checks the three original complete files, copies, private signed-file round trips and scoped refusals.
`examples/qualified-body-boundary-mesh-contract.ts` checks the public reader and typed projection declarations.

## Complete-source Curve knot insertion receipts (#1362)

This optional reader accepts complete-source Curve knot insertion receipts.
Optional entry: `@barocss/cad-interop/source-curve-knot-insertion`.
Read complete saved native receipts through `parseBaroCadSourceCurveKnotInsertion(text)` or
`readBaroCadSourceCurveKnotInsertion(ownedData)`.
Both return `{ native, validationReport, profile, sourceText }`.
`native` retains all eight fields: request, source, originalModel, model,
originalCurve, curve, provenance and report. The matching whole CAD validator
returns only a report; that report is retained as an independent mutable copy.
Exact admitted text stays in sourceText; owned-data reads return null there.
Only the deeply frozen metadata profile can be shared between calls.

Strict JSON and descriptor copies use the unchanged private 2MiB/1M codec.
Raw UTF8 and UTF16, canonical signed JSON plus newline and each copy pass are bounded.
Finite represented numbers and numeric -0 are preserved; getters, cycles,
decoded duplicate keys and unsupported own data refuse before eligible native work.
The public read error has INPUT/JSON/OWNED/BUDGET/SCHEMA/NATIVE codes.
Codec and native errors keep their actual cause; no Body error is the primary knot-reader error.

Original Source0, candidate Source0, full ordered Models and unrelated siblings remain intact.
All three UTF16 AST array patches and untouched comments/Unicode/CRLF are retained.
Native parameterMap remains identity u=t with d1Factor1; no reparameterization occurs.
The 128-station limit is the original/refined span-union schedule, not a uniform sample count.
Four retained cases contain 147 reported stations and actual before/refined D0/D1 unions.
The reader adds no direct evaluator calls; whole validation still reconstructs native work.
Native C0 refusal values and relative derivative differences stay null where reported.

Independent ideal homogeneous identity and actual stored binary64 exactness are separate.
The rational degree-five main oracle reports actualStoredExact=false; other selected oracles report true.
These facts do not turn native geometricValidity/not-certified into global shape certification.
Global shape/binary64/G1G2/topology/Solid/manufacturing/editor/persistent/publication flags are retained.

The example file checkpoint uses four complete result files plus four unchanged math oracles (259171B).
Each result follows text parse, owned read and private signed native-only save/reopen.
Twelve successful admissions and sixteen bounded refusals preserve whole data, -0 and independent ownership.
Source/emitted public JS, selected declarations, exact file SHA and actual first failures are checked separately.
This entry has no renderer, URL, byte input, serializer, dispose or direct insertion API.
Current composed validation, packed consumer #801 and npm/release acceptance remain separate.

### Restricted interval Boolean receipt reader

The optional `@barocss/cad-interop/translated-strip-interval-boolean` entry reads complete native interval Boolean receipts.

```ts
import { parseBaroCadTranslatedStripIntervalBoolean, readBaroCadTranslatedStripIntervalBoolean } from '@barocss/cad-interop/translated-strip-interval-boolean';
const fromText = parseBaroCadTranslatedStripIntervalBoolean(savedNativeJson);
const fromOwned = readBaroCadTranslatedStripIntervalBoolean(fromText.native);
```

Each result contains `native`, `validationReport`, `profile`, and `sourceText`.
Text reads retain the exact admitted text. Owned reads use `sourceText: null`.
The complete seven-field native result and actual report are independent CPU copies.
The reader calls the matching native whole validator once per eligible read.
An empty difference is a successful result; both complete operands and proof remain.

This fixed family accepts at most 12MiB of raw or canonical JSON plus one newline.
Each traversal permits at most 4,194,304 values; nested Body and source limits remain native limits.
The older qualified Body reader keeps its 2MiB and 1M-value limits.
Finite binary64 values, numeric `-0`, Unicode, IDs, source and rational strings are retained.
Accessors, cycles, duplicate decoded keys and over-budget data are refused.

`BaroCadTranslatedStripIntervalBooleanReadError` uses INPUT, JSON, OWNED, BUDGET, SCHEMA or NATIVE.
Native refusal keeps the actual native error as its cause.
The profile is frozen. Native and report copies remain readable without a renderer.

This entry provides no URL loading, public serialization, engine objects or disposal API.
It provides no general Boolean, global continuity, manufacturing or release certificate.
The example verifier checks original union, intersection and empty difference receipts.
The typed example uses the optional public entry and the published declarations.
Examples require Node.js 22.

## Qualified Body boundary meshes in Three

Import `BaroCADQualifiedBodyBoundaryMeshThreeLoader` from
`@barocss/cad-interop/qualified-body-boundary-mesh-three`.

Construct it with `{ unitsPerMillimeter: 0.001 }`. Call `parse(text)`
or `read(wholeResult)` to validate a complete native boundary mesh.

Each result contains `data`, `group`, `faceBindings` and `dispose()`.
The detached Group has six Face Meshes in native order.
Position and normal attributes use independent Float32 arrays.
Triangle indices use independent Uint32 arrays.
Full native UV, remaps and conversion measurements remain in CPU data.

The `data` field retains the complete neutral read and its profile.
Facet normals are approximate. Native certificates remain unchanged.
Successful object creation does not certify a renderer or manufacture.

The host attaches the Group and checks its actual renderer and frame.
Stage the candidate before replacing the previous visible result.
Call `dispose()` to release captured geometry and materials once.
Repeated cleanup is safe. Caller scenes, cameras and resources stay owned
by the caller. Replacing a Mesh resource does not transfer its ownership.

The example preserves full receipts and exact native JSON files.
It checks actual Three frames, copies and resource cleanup.
Source and emitted package validation are separate from publication.

This optional entry adds no URL loader or byte transport.
Examples require Node.js 22.

## Complete source Surface knot insertion receipt

Use the optional `@barocss/cad-interop/source-surface-knot-insertion` entry:

```ts
import {
  parseBaroCadSourceSurfaceKnotInsertion,
  readBaroCadSourceSurfaceKnotInsertion,
} from '@barocss/cad-interop/source-surface-knot-insertion';

const saved = parseBaroCadSourceSurfaceKnotInsertion(jsonText);
const copied = readBaroCadSourceSurfaceKnotInsertion(saved.native);
```

Both functions keep the complete eight-field native result and a separate
whole-validation report. Each eligible read validates the whole result once.
The result is `{ native, validationReport, profile, sourceText }`.
`sourceText` is the exact admitted JSON text, or `null` for owned data.
Native and report are independent mutable CPU copies; profile is deeply frozen.

The dedicated limits are 4 MiB UTF8/UTF16 and 1,048,576 values per copy pass.
Strict JSON, numeric `-0`, original/candidate Source, all Model objects, knot
slots, AST patches, native D1 refusals and qualification flags are retained.
Ideal tensor identity and rounded stored residuals remain separate evidence.
This entry does not insert knots, render, smooth C0 knots, dispose caller
resources, or certify global shape, topology, Solid or manufacturing.


### Qualified Body boundary mesh — Babylon

The optional `@barocss/cad-interop/qualified-body-boundary-mesh-babylon` entry exports `BaroCADQualifiedBodyBoundaryMeshBabylonLoader`. Pass explicit `{ unitsPerMillimeter: 0.001 }` and a live Babylon 9.29 Scene with `useRightHandedSystem = true`. Its `parse(text)` and `read(input)` call the complete neutral reader once and return `{ data, meshes, faceBindings, dispose }`.

Each result owns six initially disabled Scene-registered Mesh objects, separate Float32 position/normal data and Uint32 indices, and six original Geometry/StandardMaterial objects. The full native receipt, independent validation report, CPU projection, native Float64 UV and original qualification remain in `data`. No UV buffer is uploaded. Materials are opaque, unlit purple with both sides visible; facet normals remain an approximation.

The caller owns shader preparation, staging and rendering. Real WebGL2 with unsigned-int index support is the bounded display profile. NullEngine CPU arrays do not certify GPU buffers or draws. `dispose()` releases the captured original resources once, preserves foreign geometry/material replacements, and does not dispose the caller Scene, Engine, Camera, canvas or child resources. CPU data remains readable after disposal.

See `examples/qualified-body-boundary-mesh-babylon.html` and its config, observer and verifier for the original MAIN, edited, single-span and fresh-file flow. The entry adds no source editing, resampling, welding, axis conversion, global error, new Solid, manufacturing or publication guarantee.
