# Loader API

Choose an actual declared entry from the manifest. The root is neutral; optional renderer entries require their corresponding peer. Workspace import/types select source. The complete publication map provides the corresponding built JS/type targets; a source-browser result does not verify emitted types.

## Complete NURBS Loft graphs and updates

The optional `@barocss/cad-interop/nurbs-source-loft-feature-graph` entry provides `parseBaroCadNurbsSourceLoftFeatureGraph`, `readBaroCadNurbsSourceLoftFeatureGraph`, and their `Update` counterparts. The [complete ingestion guide](./loft-graph-ingestion) explains each packet role, independent validation reports, copied ownership and limits. This newer entry has its own availability note.

## Native and Three contracts

```ts
parseBaroCadSource(source: string, options: BaroCadParseOptions): BaroCadNativeResult
loadBaroCadSource(url: string, options: BaroCadParseOptions,
  transport?: BaroCadLoadTransportOptions): Promise<BaroCadNativeResult>
new BaroCADLoader(options: BaroCadParseOptions, manager?: LoadingManager)
loader.parse(source: string): BaroCadThreeResult
loader.loadAbortable(url: string,
  transport: BaroCadLoadTransportOptions): Promise<BaroCadThreeResult>
```

These method contracts describe inputs and returned ownership. `BaroCadParseOptions` requires sourceVersion0,countU,countV,unitsPerMillimeter; optional curveDisplay and nativeCapacity add explicit versioned profiles. `BaroCadNativeResult` retains source, native Model, diagnostics[], surfaces, curves and unrenderedCurveIds. Each Surface contains packet/report/mesh; each Curve contains actual sample records and Float32 positions. `BaroCadThreeResult` adds Group and idempotent `dispose()`.

`BaroCadLoadTransportOptions` accepts optional live AbortSignal and `onProgress(event):void|false`. Progress contains url,loadedBytes and optional declaredTotalBytes. Neutral parse options are snapshotted before URL work. Named renderer loaders retain constructor options until parsing after fetch.

## Other target hosts

`new BaroCADBabylonLoader(scene,options)` takes the caller Babylon Scene; the host selects a right-handed scene. Its parse result owns created meshes. `new BaroCADPixi3DLoader(options)` returns a result whose root the caller attaches to Stage. Both have their own declarations and disposal semantics. Do not infer a Three Group from a Babylon/Pixi result or mix the peer versions.

## Root packet and display GLB

`copyCadPreviewPacket` validates/copies packet data. `prepareCadPreviewMesh` derives owned buffers using explicit conversion options. `encodeCadPreviewGlb` emits a display artifact for its admitted packet. Native face mesh uses `prepareOwnNativeFaceMesh` and `encodeOwnNativeFaceMeshGlb` with its separate frame and topology lineage. Use the [packet and loader guides](./guides) before adapting one path to another.

GLB bytes contain display geometry, not a universal native CAD document. Optional embedded native text remains an untrusted reference. The native source-to-GLB object cap remains separate from native16 renderer admission.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad-interop/package.json` (Manifest; local source), `packages/barocss-cad-interop/src/index.ts`, `packages/barocss-cad-interop/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
