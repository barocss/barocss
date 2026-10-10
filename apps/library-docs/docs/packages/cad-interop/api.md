# Loader API

Read the [complete public signature reference](./reference) for exact exported functions, types and public class members. This task page explains their support, ownership, errors and lifecycle.


Choose an actual declared entry from the manifest. The root is neutral; optional renderer entries require their corresponding peer. Workspace import/types select source. The complete publication map provides the corresponding built JS/type targets; a source-browser result does not verify emitted types.

## Complete NURBS Loft graphs and updates

The optional `@barocss/cad-interop/nurbs-source-loft-feature-graph` entry provides `parseBaroCadNurbsSourceLoftFeatureGraph`, `readBaroCadNurbsSourceLoftFeatureGraph`, and their `Update` counterparts. The [complete ingestion guide](./loft-graph-ingestion) explains each packet role, independent validation reports, copied ownership and limits. This newer entry has a separate availability note; the inventory below retains the earlier reference snapshot.

## Native and Three signatures

```ts
parseBaroCadSource(source: string, options: BaroCadParseOptions): BaroCadNativeResult
loadBaroCadSource(url: string, options: BaroCadParseOptions,
  transport?: BaroCadLoadTransportOptions): Promise<BaroCadNativeResult>
new BaroCADLoader(options: BaroCadParseOptions, manager?: LoadingManager)
loader.parse(source: string): BaroCadThreeResult
loader.loadAbortable(url: string,
  transport: BaroCadLoadTransportOptions): Promise<BaroCadThreeResult>
```

This is a signature summary, not executable source. `BaroCadParseOptions` requires sourceVersion0,countU,countV,unitsPerMillimeter; optional curveDisplay and nativeCapacity add explicit versioned profiles. `BaroCadNativeResult` retains source, native Model, diagnostics[], surfaces, curves and unrenderedCurveIds. Each Surface contains packet/report/mesh; each Curve contains actual sample records and Float32 positions. `BaroCadThreeResult` adds Group and idempotent `dispose()`.

`BaroCadLoadTransportOptions` accepts optional live AbortSignal and `onProgress(event):void|false`. Progress contains url,loadedBytes and optional declaredTotalBytes. Neutral parse options are snapshotted before URL work. Named renderer loaders retain constructor options until parsing after fetch.

## Other target hosts

`new BaroCADBabylonLoader(scene,options)` takes the caller Babylon Scene; the host selects a right-handed scene. Its parse result owns created meshes. `new BaroCADPixi3DLoader(options)` returns a result whose root the caller attaches to Stage. Both have their own declarations and disposal semantics. Do not infer a Three Group from a Babylon/Pixi result or mix the peer versions.

## Public entry inventory

At the reference snapshot, the map has 35 entries, including its root. Names below come from the actual source entry's exports and re-exports. Private transport, curve-pick and native parser helpers that are not exported through a public entry are excluded. Root values do not require target-peer imports; entry file existence is distinct from all-entry runtime coverage.

| Import suffix | Public names and declaration source |
| --- | --- |
| `@barocss/cad-interop` | [Declarations](/packages/cad-interop/reference#declarations-9cb9edb1215a): `copyCadPreviewPacket`, `prepareCadPreviewMesh`, `CadPreviewPacket`, `PreparedCadMesh`, `encodeCadPreviewGlb`, `encodeOwnNativeFaceMeshGlb`, `prepareOwnNativeFaceMesh`, `PreparedNativeFaceMesh`, `NativeFaceBinding` |
| `@barocss/cad-interop/native` | [Declarations](/packages/cad-interop/reference#declarations-d539b844fcdd): `BaroCadCurveDisplayV0`, `BaroCadCurveDisplayV1`, `BaroCadNativeCapacityV1`, `BaroCadParseOptions`, `BaroCadSurfacePreview`, `BaroCadCurvePreview`, `BaroCadNativeResult`, `BaroCadGlbExportOptions`, `BaroCadSourceError`, `validateBaroCadParseOptions`, `parseBaroCadSource`, `baroCadSourceToGLB`, `loadBaroCadSource`, `BaroCadLoadAbortError`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |
| `@barocss/cad-interop/native-uniform-curve` | [Declarations](/packages/cad-interop/reference#declarations-4328ed8aab4c): `BaroCadUniformCurveSourceDiagnosticCode`, `BaroCadUniformCurveDisplayV1`, `BaroCadUniformCurveSourceOptions`, `BaroCadUniformCurveSourceResult`, `BaroCadUniformCurveSourceError`, `validateBaroCadUniformCurveSourceOptions`, `parseBaroCadUniformCurveSource` |
| `@barocss/cad-interop/three-uniform-curve` | [Declarations](/packages/cad-interop/reference#declarations-70a14d1d3fb3): `BaroCadUniformCurveThreeResult`, `BaroCADUniformCurveLoader`, `BaroCadUniformCurveSourceOptions`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |
| `@barocss/cad-interop/document` | [Declarations](/packages/cad-interop/reference#declarations-3670c94495df): `BaroCadDocumentPrimitiveOptionsV2`, `BaroCadDocumentPrimitiveBindingV2`, `BaroCadDocumentPrimitiveRefV2`, `BaroCadDocumentPrimitiveEntryV2`, `prepareBaroCadDocumentPrimitiveNativeRefsV2`, `parseBaroCadDocument`, `loadBaroCadDocument`, `CadDocumentResult`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |
| `@barocss/cad-interop/boolean-extrusion-feature-graph` | [Declarations](/packages/cad-interop/reference#declarations-e3a8400b1e61): `BaroCadBooleanExtrusionFeatureGraphRead`, `readBaroCadBooleanExtrusionFeatureGraph`, `loadBaroCadBooleanExtrusionFeatureGraph`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |
| `@barocss/cad-interop/boolean-extrusion-feature-mesh` | [Declarations](/packages/cad-interop/reference#declarations-09ff92108013): `BaroCadBooleanExtrusionFeatureSelection`, `BaroCadBooleanExtrusionFeatureMesh`, `deriveBaroCadBooleanExtrusionFeatureMesh` |
| `@barocss/cad-interop/boolean-extrusion-feature-properties` | [Declarations](/packages/cad-interop/reference#declarations-be00959627a4): `BaroCadBooleanExtrusionFeatureProperties`, `deriveBaroCadBooleanExtrusionFeatureProperties` |
| `@barocss/cad-interop/assembly` | [Declarations](/packages/cad-interop/reference#declarations-a27d1d069dc1): `parseBaroCadAssembly`, `loadBaroCadAssembly`, `CadAssemblyResult`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |
| `@barocss/cad-interop/document-glb` | [Declarations](/packages/cad-interop/reference#declarations-1772f800251d): `BaroCadDocumentGlbMappingV1`, `BaroCadDocumentDisplayGlbReportV1`, `BaroCadDocumentDisplayGlbResultV1`, `exportBaroCadDocumentDisplayGlb` |
| `@barocss/cad-interop/boolean-mesh-glb` | [Declarations](/packages/cad-interop/reference#declarations-fa38c7266caf): `BaroCadBooleanDisplayGlbOptions`, `BaroCadBooleanDisplayGlbMapping`, `BaroCadBooleanDisplayGlbReport`, `BaroCadBooleanDisplayGlbResult`, `exportBaroCadBooleanDisplayGlb` |
| `@barocss/cad-interop/boolean-extrusion-glb` | [Declarations](/packages/cad-interop/reference#declarations-3de957caca50): `BaroCadBooleanExtrusionDisplayGlbOptions`, `BaroCadBooleanExtrusionDisplayGlbShellMapping`, `BaroCadBooleanExtrusionDisplayGlbEdgeMapping`, `BaroCadBooleanExtrusionDisplayGlbReport`, `BaroCadBooleanExtrusionDisplayGlbResult`, `exportBaroCadBooleanExtrusionDisplayGlb` |
| `@barocss/cad-interop/three-document` | [Declarations](/packages/cad-interop/reference#declarations-9c14955ceaea): `BaroCadDocumentThreeBindingV1`, `BaroCadDocumentThreeResultV1`, `createBaroCadDocumentThreeDisplay`, `loadBaroCadDocumentThreeDisplay` |
| `@barocss/cad-interop/three-assembly` | [Declarations](/packages/cad-interop/reference#declarations-a1f4fec4af69): `BaroCadAssemblyThreeOptions`, `BaroCadAssemblyThreeBinding`, `BaroCadAssemblyThreeResult`, `createBaroCadAssemblyThreeDisplay` |
| `@barocss/cad-interop/three-boolean-contours` | [Declarations](/packages/cad-interop/reference#declarations-3d24fd2468ee): `BaroCadBooleanThreeContourOptions`, `BaroCadBooleanThreeContourBinding`, `BaroCadBooleanThreeContourResult`, `createBaroCadBooleanThreeContours` |
| `@barocss/cad-interop/three-boolean-mesh` | [Declarations](/packages/cad-interop/reference#declarations-21e6bdbc02db): `BaroCadBooleanThreeMeshOptions`, `BaroCadBooleanThreeMeshBinding`, `BaroCadBooleanThreeMeshResult`, `createBaroCadBooleanThreeMesh` |
| `@barocss/cad-interop/three-boolean-extrusion-mesh` | [Declarations](/packages/cad-interop/reference#declarations-e5142ce5615d): `BaroCadBooleanExtrusionThreeMeshOptions`, `BaroCadBooleanExtrusionThreeShellBinding`, `BaroCadBooleanExtrusionThreeFaceBinding`, `BaroCadBooleanExtrusionThreeEdgeBinding`, `BaroCadBooleanExtrusionThreeMeshResult`, `createBaroCadBooleanExtrusionThreeMesh` |
| `@barocss/cad-interop/three` | [Declarations](/packages/cad-interop/reference#declarations-49768bd01742): `BaroCadThreeResult`, `BaroCADLoader`, `resolveBaroCadThreeCurvePick`, `BaroCadCurveDisplayPick` |
| `@barocss/cad-interop/babylon` | [Declarations](/packages/cad-interop/reference#declarations-e0798ca0522e): `BaroCadBabylonResult`, `BaroCADBabylonLoader`, `resolveBaroCadBabylonCurvePick`, `BaroCadCurveDisplayPick` |
| `@barocss/cad-interop/babylon-document` | [Declarations](/packages/cad-interop/reference#declarations-88be7e4f6b2b): `BaroCadDocumentBabylonBindingV1`, `BaroCadDocumentBabylonResultV1`, `createBaroCadDocumentBabylonDisplay` |
| `@barocss/cad-interop/babylon-assembly` | [Declarations](/packages/cad-interop/reference#declarations-f30d8880f34d): `BaroCadAssemblyBabylonOptions`, `BaroCadAssemblyBabylonBinding`, `BaroCadAssemblyBabylonResult`, `createBaroCadAssemblyBabylonDisplay` |
| `@barocss/cad-interop/babylon-boolean-mesh` | [Declarations](/packages/cad-interop/reference#declarations-4309df70a2f9): `BaroCadBooleanBabylonMeshOptions`, `BaroCadBooleanBabylonMeshBinding`, `BaroCadBooleanBabylonMeshResult`, `createBaroCadBooleanBabylonMesh` |
| `@barocss/cad-interop/babylon-boolean-extrusion-mesh` | [Declarations](/packages/cad-interop/reference#declarations-bf9b6104111b): `BaroCadBooleanExtrusionBabylonMeshOptions`, `BaroCadBooleanExtrusionBabylonShellBinding`, `BaroCadBooleanExtrusionBabylonFaceBinding`, `BaroCadBooleanExtrusionBabylonEdgeBinding`, `BaroCadBooleanExtrusionBabylonMeshResult`, `createBaroCadBooleanExtrusionBabylonMesh` |
| `@barocss/cad-interop/pixi3d` | [Declarations](/packages/cad-interop/reference#declarations-32b4e3dfed9b): `BaroCadPixi3DResult`, `BaroCADPixi3DLoader` |
| `@barocss/cad-interop/pixi3d-document` | [Declarations](/packages/cad-interop/reference#declarations-7a0e79e48773): `BaroCadDocumentPixi3DBindingV1`, `BaroCadDocumentPixi3DResultV1`, `createBaroCadDocumentPixi3DDisplay` |
| `@barocss/cad-interop/pixi3d-assembly` | [Declarations](/packages/cad-interop/reference#declarations-9756473e539a): `BaroCadAssemblyPixi3DOptions`, `BaroCadAssemblyPixi3DBinding`, `BaroCadAssemblyPixi3DResult`, `createBaroCadAssemblyPixi3DDisplay` |
| `@barocss/cad-interop/pixi3d-boolean-mesh` | [Declarations](/packages/cad-interop/reference#declarations-c457bd9047cb): `BaroCadBooleanPixi3DMeshOptions`, `BaroCadBooleanPixi3DMeshBinding`, `BaroCadBooleanPixi3DMeshResult`, `createBaroCadBooleanPixi3DMesh` |
| `@barocss/cad-interop/pixi3d-boolean-extrusion-mesh` | [Declarations](/packages/cad-interop/reference#declarations-373e06b9eef2): `BaroCadBooleanExtrusionPixi3DMeshOptions`, `BaroCadBooleanExtrusionPixi3DShellBinding`, `BaroCadBooleanExtrusionPixi3DFaceBinding`, `BaroCadBooleanExtrusionPixi3DEdgeBinding`, `BaroCadBooleanExtrusionPixi3DMeshResult`, `createBaroCadBooleanExtrusionPixi3DMesh` |
| `@barocss/cad-interop/model-set` | [Declarations](/packages/cad-interop/reference#declarations-3dda776aea6f): `BaroCadModelSetManifest`, `BaroCadModelSetProgress`, `BaroCadModelSetLoadOptions`, `BaroCadModelSetEntry`, `BaroCadModelSetResult`, `BaroCadModelSetDisplayBinding`, `BaroCadModelSetDisplayEntry`, `BaroCadModelSetPrimitiveDisplayBinding`, `BaroCadModelSetPrimitiveDisplayEntryV1`, `BaroCadModelSetPrimitiveNativeRefV2`, `BaroCadModelSetPrimitiveNativeEntryV2`, `loadBaroCadModelSet`, `prepareBaroCadModelSetDisplay`, `prepareBaroCadModelSetPrimitiveDisplayV1`, `prepareBaroCadModelSetPrimitiveNativeRefsV2` |
| `@barocss/cad-interop/native-selected-uniform-curve` | [Declarations](/packages/cad-interop/reference#declarations-4e859894d540): `BaroCadSelectedUniformCurveSourceOptions`, `BaroCadSelectedUniformCurveSourceResult`, `validateBaroCadSelectedUniformCurveSourceOptions`, `parseBaroCadSelectedUniformCurveSource`, `BaroCadUniformCurveSourceError`, `BaroCadUniformCurveDisplayV1`, `BaroCadUniformCurveSourceDiagnosticCode` |
| `@barocss/cad-interop/three-selected-uniform-curve` | [Declarations](/packages/cad-interop/reference#declarations-f6cf7bd3841d): `BaroCadSelectedUniformCurveThreeResult`, `BaroCADSelectedUniformCurveLoader`, `BaroCadSelectedUniformCurveSourceOptions`, `BaroCadSelectedUniformCurveSourceResult`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |
| `@barocss/cad-interop/babylon-uniform-curve` | [Declarations](/packages/cad-interop/reference#declarations-ca20c3c31bbf): `BaroCadUniformCurveBabylonResult`, `BaroCADUniformCurveBabylonLoader`, `BaroCadUniformCurveSourceOptions`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |
| `@barocss/cad-interop/pixi3d-uniform-curve` | [Declarations](/packages/cad-interop/reference#declarations-e55bb56f629d): `BaroCadUniformCurvePixi3DResult`, `BaroCADUniformCurvePixi3DLoader`, `BaroCadUniformCurveSourceOptions`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |
| `@barocss/cad-interop/babylon-selected-uniform-curve` | [Declarations](/packages/cad-interop/reference#declarations-030730c681d0): `BaroCadSelectedUniformCurveBabylonResult`, `BaroCADSelectedUniformCurveBabylonLoader`, `BaroCadSelectedUniformCurveSourceOptions`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |
| `@barocss/cad-interop/pixi3d-selected-uniform-curve` | [Declarations](/packages/cad-interop/reference#declarations-b6ecf740a386): `BaroCadSelectedUniformCurvePixi3DResult`, `BaroCADSelectedUniformCurvePixi3DLoader`, `BaroCadSelectedUniformCurveSourceOptions`, `BaroCadLoadProgress`, `BaroCadLoadTransportOptions` |

## Root packet and display GLB

`copyCadPreviewPacket` validates/copies packet data. `prepareCadPreviewMesh` derives owned buffers using explicit conversion options. `encodeCadPreviewGlb` emits a display artifact for its admitted packet. Native face mesh uses `prepareOwnNativeFaceMesh` and `encodeOwnNativeFaceMeshGlb` with its separate frame and topology lineage. See the linked declarations for exact options/results before adapting one path to another.

GLB bytes contain display geometry, not a universal native CAD document. Optional embedded native text remains an untrusted reference. The native source-to-GLB object cap remains separate from native16 renderer admission.

---

Source snapshot: local Git `5f5ad866205a21510ac69552e704cc162fa253b5`. `packages/barocss-cad-interop/package.json` (Manifest; local source), [public root](/packages/cad-interop/reference#declarations-9cb9edb1215a), `packages/barocss-cad-interop/README.md` (package README; local source). Source references identify that fixed snapshot. This native source commit is local-only; public declaration references open in this portal. Local source is the authority for this manual.

[Overview](./) · [Quickstart](./quickstart) · [Guides](./guides) · [API](./api) · [Examples](./examples) · [Limits](./limits)
