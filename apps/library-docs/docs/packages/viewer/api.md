# Viewer public API

Only `@barocss/viewer` is exported. `createViewer(canvas:HTMLCanvasElement,options:ViewerOptions):Viewer` validates `mmToSceneUnit`, background RGB and optional lighting. Viewer is also a public class; prefer the factory for option validation.

## Core method contracts

| Signature | Arguments / result | Boundary |
| --- | --- | --- |
| `loadNative(source, options): void` | Complete Source0 text, sample counts, optional matching Curve display profile. | Real loader admission; no source mutation. |
| `loadNativeUrl(url, options, transport?): Promise<void>` | URL plus native display options and caller transport. | Stale replacement refuses; caller owns cancellation. |
| `loadDocument(result, options): void` | Qualified CAD document plus basis/native options. | Retains original document and derived packets separately. |
| `loadModelSet(result): void` | Qualified loader result. | Full source-owned references, not arbitrary filenames. |
| `getState(): ViewerState` | Independent copied authority, display and lifecycle state. | A snapshot cannot mutate future state. |
| `pick(xCss,yCss): ViewerPick \| null` | Canvas-local CSS point. | Approximate displayed Surface triangle and U/V. |
| `pickGeometry(point, options?): ViewerGeometryPick \| null` | CSS point; optional kinds and Curve tolerance. | Sampled Surface/Curve result; may be ambiguous. |
| `select(ref \| null): void`, `selectGeometry(ref \| null): void` | Current visible qualified geometry. | Mode/material/lifecycle restrictions apply. |
| `setView(camera)`, `orbit(a,e)`, `pan(x,y)`, `zoom(factor)` | Camera; radians for orbit, scene units for pan. | Admission refuses invalid poses; no native edit. |
| `resize(width,height): void`, `readPixels(): Uint8Array` | Backing size; fresh RGBA buffer from live frame. | Context/mode/lifecycle errors reach host. |
| `clear(): void`, `dispose(): void` | Explicit blank frame; release owned resources. | Dispose is idempotent; later GPU operations refuse. |

## Additional public profile methods

Native queries: `measureNativeSurfacePoints`, `measureNativeCurvePoints`, `measureNativeSurfaceCurvePoints`, `measureNativePoints`, `projectNativePoint`, `queryAssemblyInstancePoint`.

Profile admission: `loadAssembly`, `loadShellGraph`, `loadUniformCurvePreview`, `loadSelectedUniformCurvePreview`, `loadMixedDepthScene`, `loadQualifiedFaceScene`, `replaceNativeScene`, `setPackets`, `loadModelSetUrls`, `loadDocumentUrl`.

Qualified inspection: `pickShell`, `pickQualifiedFace`, `sampleQualifiedFace`, `measureQualifiedFacePoints`, `projectQualifiedFacePoint`, `fitQualifiedFace`, `fitNativeDocumentBody`, `fitNativeDocumentBodies`.

Display: `setVisibleGeometry`, `setSurfaceMaterial`, `setFluidFrame`, `setClothFrame`, `applyMotionFrame`, `applyGeometryMotionFrame`, `resetMotion`, `fit`, `fitGeometry`, `attachPointerControls`, `attachKeyboardControls`.

These methods are profile-specific. The retained pose method names do not create an active Motion package.

[Exact public method signatures, arguments and exported Viewer types](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/src/index.ts) · [Public sample result fields re-exported by root](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/src/qualified-face-native-sample.ts)

## Errors and ownership

Viewer admission uses errors from its validation and reached CAD/loader/GPU provider causes. Do not infer one universal Viewer error code from a message. Route caught errors through your host's diagnostics. `getState` distinguishes `empty`, `ready`, `context-lost`, `unavailable` and `disposed`. Control adapters each return `dispose()`; they own listeners, not the Viewer or canvas.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-viewer/README.md)
