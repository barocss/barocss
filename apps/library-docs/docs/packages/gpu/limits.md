# GPU limits and errors

## Scene source and SDF budget

| Resource | Bound |
| --- | --- |
| Source | 64 KiB UTF-8 |
| Objects | 32 |
| Style rules / declarations | 128 / 512 |
| Coordinates | Absolute value at most 1000 scene units |
| Dimensions | Positive and at most 1000; relevant Float32 dimensions remain positive |
| Rotation | Source1 only, finite explicit degrees in −360..360 |
| SDF steps / distance / epsilon | 128 / 100 / 0.001 |
| Shader source | 65536 bytes |
| Drawing buffer | Integer sides 1..4096 and at most 4194304 pixels |

Small accepted geometry may fall below the ray epsilon and produce no visible pixels. These are algorithm/admission limits, not hardware throughput guarantees.

## Mesh packet and conversion

PreviewPacket v0 accepts 4..4096 vertices and 2..7938 triangles. Arrays are dense plain numeric arrays; positions/normals use XYZ triples and parameters use native U/V pairs. Indices address existing vertices. Normals have unit length within `1e-5`, and triangle winding agrees with every incident normal. XYZ values remain within ±1e6 mm; packet bounds equal actual position minima/maxima.

`mmToSceneUnit` must be finite and positive. Translation components remain within ±1000 scene units; color/background components use 0..1. Conversion refuses nonfinite coordinates, nonzero values lost to zero during scaling or Float32 conversion, unsafe scene coordinates, and collapsed display triangles. Legitimate zero or cancellation is distinct from conversion loss. Admission does not guarantee lossless pose/translation arithmetic.

Optional camera and lighting use their own public contracts. A camera must keep eye/target distinct, up nonsingular, near/far separable in Float32 and its matrices finite. Do not bypass a camera refusal by retagging units.

## Error handling

| Operation | Failure contract | Host action |
| --- | --- | --- |
| `compileGpu` | `{ok:false,diagnostics}` | Display code/message/range; keep accepted source |
| `parseScene` | `SceneError` with source diagnostics | Mark the actual source range |
| Packet/options/camera preparation | `RangeError` | Keep native input; revise explicit options |
| Mount, allocation or context loss | `GPUError` | Report the actual backend failure; recover with a new lifecycle |
| Live scene `update` / `setCamera` | `{ok:false,error}` | Retain accepted state; inspect context health |
| Calls after renderer disposal | Failure | Stop calls; create a new renderer if needed |

The compiler's diagnostic ranges use UTF-16 offsets and one-based line/column. Mesh diagnostics can provide `dataPath` instead of a source range. General Engine APIs use their own exported error classes and diagnostic code objects; inspect those values instead of parsing message text.

## Capability boundary

The library is experimental. No general CSS compatibility, arbitrary shaders, universal CAD rendering, certified geometric accuracy, broad hardware support or production performance is claimed. Native CAD validity, display mesh quality and image quality are separate outcomes. The catalog's Engine CPU APIs do not establish an available general Engine graphics runtime. #1183/#1184 remain qualified isolated work with actual GL acceptance unrun in their latest receipts.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-gpu/package.json` (Manifest; local source), [public root](/packages/gpu/reference#declarations-5523de18ed63), `packages/barocss-gpu/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
