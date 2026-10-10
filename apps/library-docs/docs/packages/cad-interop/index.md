# CAD interop and Loader

`@barocss/cad-interop` connects native CAD source and documents to neutral display data, optional renderer adapters and display GLB exports. Its manifest version is `0.0.0-experimental`.

The root entry is renderer-neutral. Optional entries use the selected peer engine. Choose an entry by your actual input, not by a desired output filename:

| Input | Entry family | Next task |
| --- | --- | --- |
| PreviewPacket v0 | Root packet/GLB exports | [API](./api) |
| Native source0 `.barocad` text | `/native`, `/three`, `/babylon`, `/pixi3d` | [Quickstart](./quickstart) |
| One original Curve / one selected Curve | `*-uniform-curve`, `*-selected-uniform-curve` | [Curve guide](./guides#choose-a-curve-sampling-profile) |
| Native CAD document | `/document`, named `*-document` adapters | [Document guide](./guides#load-documents-and-assemblies-as-their-own-formats) |
| Native assembly / model-set manifest | `/assembly`, named `*-assembly`, `/model-set` | [Composition guide](./guides#load-documents-and-assemblies-as-their-own-formats) |
| Authored Boolean extrusion graph | Graph, mesh, properties and named display entries | [API entry inventory](./api#public-entry-inventory) |

## Preserve the native record

Native source text and Model are authoritative. Samples, Float32 buffers, meshes and GLB are derived. A renderer result can own display objects without owning the caller's Scene, renderer, canvas, camera or lights. Display cleanup must preserve those host resources.

The Surface packet path preserves authored XYZ, declares right-handed Y-up and converts mm once. The separate native face-mesh `part-xyz` path has a different explicit axis mapping. Native parameters are not texture UVs. Retain owning asset/body IDs when selecting or composing results.

Workspace imports and types select source entries through standard TS transformation. Emitted publication maps are separate built JS/type checkpoints. Neither a local public manifest nor a successful workspace browser establishes an npm release or independent packed installation. [#801](https://github.com/barocss/barocss/issues/801) remains a separate held packed-consumer task.

Use [limits/errors](./limits) before enabling complete-source capacity or combining documents. The native default4, explicit16, selected-body4 and assembly32 envelopes are different contracts.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad-interop/package.json` (Manifest; local source), [public root](/packages/cad-interop/reference#declarations-9cb9edb1215a), `packages/barocss-cad-interop/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
