# Viewer public API

[Authored directional lights](./authored-directional-lights) — Complete native documents, raw materials and authored lights through the explicit asynchronous required-WebGPU facade.

The public package entry is `@barocss/viewer`. `createViewer(canvas:HTMLCanvasElement,options:ViewerOptions):Viewer` validates `mmToSceneUnit`, background RGB and optional lighting. Viewer is also a public class; prefer the factory for option validation.

## Core method contracts

| Method | Arguments / result | Boundary |
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

## Errors and ownership

Viewer admission uses errors from its validation and reached CAD/loader/GPU provider causes. Do not infer one universal Viewer error code from a message. Route caught errors through your host's diagnostics. `getState` distinguishes `empty`, `ready`, `context-lost`, `unavailable` and `disposed`. Control adapters each return `dispose()`; they own listeners, not the Viewer or canvas.

`packages/barocss-viewer/package.json` (Manifest and version; local source) · `packages/barocss-viewer/README.md` (Package task notes; local source)

## Authored directional-light WebGPU facade

`await createNativeDirectionalLightWebGPUViewer(canvas, input, { width, height })` creates `ViewerNativeDirectionalLightWebGPU`. This separate async factory requires WebGPU; it does not change synchronous `createViewer` defaults. The complete `ViewerNativeDirectionalLightInput` includes composition owner, original document source/TEN bindings, display, raw materials, light catalog and context. See the [complete recipe and lifetime contract](./authored-directional-lights).

- `originals`, `accepted`, `selected`, `status`, `canvas`: copied/frozen originals, accepted native metadata, selection and actual backend status
- `await replace(input)`, `await resize(width,height)`: inspect returned `UpdateResult.ok`; refusal is not successful adoption
- `await pick(x,y)`: backing-pixel selection with generation, full native ref and original TEN binding, or null ref/binding for background
- `select(ref|null)`: synchronous metadata selection with `UpdateResult`
- `await readPixels()`: top-left backing-pixel RGBA; not native geometry authority
- `dispose()`: idempotent; invalidates pending work. Explicit remount is required after device loss

`ViewerNativeDirectionalLightError` retains its code and provider cause. Public types also include `ViewerNativeDirectionalLightCode`, `ViewerNativeDirectionalLightOwner`, `ViewerNativeDirectionalLightAccepted` and `ViewerNativeDirectionalLightPick`. This addition is source-pinned separately to `78ff80606497875cf148c860e58a213b27dd0cf3`; the historical generated API catalog remains unchanged.
