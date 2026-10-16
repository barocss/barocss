# GPU limits and errors

## Scene source budget

| Resource | Bound |
| --- | --- |
| Source | 64 KiB UTF-8 |
| Objects | 32 |
| Style rules / declarations | 128 / 512 |
| Coordinates | Absolute value at most 1000 scene units |
| Dimensions | Positive and at most 1000; relevant Float32 dimensions remain positive |
| Rotation | Source1 only, finite explicit degrees in −360..360 |
| SDF steps / distance / epsilon in `compileScene` shader text | 128 / 100 / 0.001 |
| Generated shader source | 65536 bytes |
| `showScene` tessellation | `segments` 8..128 around a curved primitive (default 48) |
| Viewer canvas | Backing sides capped at the device's `maxTextureDimension2D`; device pixel ratio capped at 2 by default |

The SDF limits describe the shader text `compileScene` still generates; the viewer does not execute it and draws tessellated meshes instead, so very small accepted objects still cover pixels when they are large enough on screen. These are algorithm/admission limits, not hardware throughput guarantees.

## Mesh packet and conversion

PreviewPacket v0 (for `prepareMesh` and `compileGpu({kind:'mesh'})`) accepts 4..4096 vertices and 2..7938 triangles. Arrays are dense plain numeric arrays; positions/normals use XYZ triples and parameters use native U/V pairs. Indices address existing vertices. Normals have unit length within `1e-5`, and triangle winding agrees with every incident normal. XYZ values remain within ±1e6 mm; packet bounds equal actual position minima/maxima.

`mmToSceneUnit` must be finite and positive. Translation components remain within ±1000 scene units; color/background components use 0..1. Conversion refuses nonfinite coordinates, nonzero values lost to zero during scaling or Float32 conversion, unsafe scene coordinates, and collapsed display triangles. Legitimate zero or cancellation is distinct from conversion loss. Admission does not guarantee lossless pose/translation arithmetic.

Optional camera and lighting use their own public contracts. A camera must keep eye/target distinct, up nonsingular, near/far separable in Float32 and its matrices finite. Do not bypass a camera refusal by retagging units.

## Error handling

| Operation | Failure contract | Host action |
| --- | --- | --- |
| `compileGpu` | `{ok:false,diagnostics}` | Display code/message/range; keep accepted source |
| `parseScene` | `SceneError` with source diagnostics | Mark the actual source range |
| Packet/options/camera preparation | `RangeError` | Keep native input; revise explicit options |
| `createViewer` without WebGPU, an adapter or a canvas context | Rejects with `ViewerError` (`webgpu-unavailable`, `no-adapter`, `no-context`) | Report it; this package has no fallback renderer |
| First `showScene` source | `SceneViewError` with `diagnostics` | Display them; nothing was added |
| Later `view.update` | `{ok:false,diagnostics}` | Keep accepted source; the shown scene stays |
| `materialShader` | `{ok:false,diagnostics}` | Keep the accepted shader material |
| `validateMeshMaterialBinding` | `MeshMaterialError` (code `UNIFORM`, …) | Keep the accepted shader material |
| GPU errors outside a check, failed shader material compile | Reported to `ViewerOptions.onError` (default `console.error`) | Inspect the WGSL and params |
| Device loss | Recovered by the viewer; `onRecover`, `stats.deviceLosses` | No host action; native data stays with the host |
| Calls after `viewer.dispose()` / `view.dispose()` | `ViewerError('disposed')` / `SceneViewError` | Stop calls; create a new viewer if needed |

The compiler's diagnostic ranges use UTF-16 offsets and one-based line/column. Mesh diagnostics can provide `dataPath` instead of a source range. General Engine APIs use their own exported error classes and diagnostic code objects; inspect those values instead of parsing message text.

## Capability boundary

The library is experimental. No general CSS compatibility, arbitrary shaders, universal CAD rendering, certified geometric accuracy, broad hardware support or production performance is claimed. Native CAD validity, display mesh quality and image quality are separate outcomes. The catalog's Engine CPU APIs do not establish an available general Engine graphics runtime; the viewer is a mesh viewer, not that runtime. #1183/#1184 remain qualified isolated work with actual GL acceptance unrun in their latest receipts.

---

Source snapshot: local Git `e532fc3037f9c1e13819b61d63de06164c50128f` (the WebGPU viewer; the earlier renderers were removed after `5f5ad866205a21510ac69552e704cc162fa253b5`). `packages/barocss-gpu/package.json` (Manifest; local source), `packages/barocss-gpu/src/index.ts` (public root; local source), `packages/barocss-gpu/README.md` (package README; local source). Source paths identify that fixed local snapshot. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
