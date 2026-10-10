# GPU

`@barocss/gpu` compiles a bounded scene language, prepares display geometry, and provides original WebGL2 renderers for its admitted preview profiles. Its manifest version is `0.0.0`.

Use the SDF path for a small scene of spheres, boxes and the explicit source1 primitives. Use the mesh path for a CAD PreviewPacket. Use the general Engine APIs for CPU geometry, hierarchy, rays, clips and binding preparation. These paths have different inputs and limits.

| Task | Start here |
| --- | --- |
| Compile and display a small source scene | [Quickstart](./quickstart) |
| Convert a native Surface packet into scene units | [CAD mesh guide](./guides#display-a-cad-surface) |
| Handle edits and resource cleanup | [Update guide](./guides#replace-a-scene-safely) |
| Choose an exported function or data type | [API](./api) |
| Find a runnable repository host | [Examples](./examples) |
| Diagnose refusal or context loss | [Limits and errors](./limits) |

## Source, mesh and image

A native CAD model retains authored geometry. A packet contains an approximate sampled mesh. A pose changes display placement. A rendered image contains pixels. Keep these records separate. A visible mesh does not certify a native Solid, and pixels cannot recover editable source.

The package's workspace root and `/source` entries both select `src/index.ts`. Use a TypeScript-capable transformer with normal package resolution. The complete `publishConfig` map selects emitted JavaScript and declarations for a separate built-package checkpoint. Local public configuration does not establish an npm release.

## Current Engine boundary

The fixed parent exposes CPU Engine preparation and query APIs. It does **not** export the general Engine renderer from [#1183](https://github.com/barocss/barocss/issues/1183) or its textured renderer from [#1184](https://github.com/barocss/barocss/issues/1184). Their latest receipts describe prepared browser fixtures with actual graphics acceptance unrun. Do not use those isolated branches as an available public runtime.

Read the shared [coordinate](../../concepts/coordinates), [ownership](../../concepts/ownership) and [version](../../concepts/versions) contracts before combining packages.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. [Manifest](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/package.json), [public root](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/src/index.ts), [package README](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-gpu/README.md). Fixed-SHA links identify that snapshot; this native local commit may not yet be available on the remote. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
