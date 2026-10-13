# Render Editor public entry contracts

| Entry | Workspace / release configuration |
| --- | --- |
| Root | `src/index.ts` / `dist/index.js` and declarations |
| `/react` | `src/react.tsx` / `dist/react.js` and declarations |
| `/style.css` | `src/style.css` / `dist/style.css` |

## Native Light document and session

Use the same unsuffixed API for directional and point workspaces. The catalog's `lights.profile` selects the supported kind; a session keeps that kind for its lifetime. Original native source/TEN/material authority and signed values remain in the document. See the [authoring guide](./guides#author-a-native-light-scene) and [format limits](./limits#native-light-format-and-bounds).

| Entry or method | Contract |
| --- | --- |
| `parseRenderNativeLightDocument(text)`, `prepareRenderNativeLightDocument(input)`, `serializeRenderNativeLightDocument(document)` | Parse, qualify and serialize complete original authorship. CPU qualification is not presentation. Use the signed codec for saved values. |
| `createRenderNativeLightRequest(document)` | Derive the actual original-source/TEN/material/light Viewer request without replacing authority with a sampled mesh. |
| `await createRenderNativeLightSession(canvas, document, {width, height})` | Create one required-WebGPU owned lifetime. Dispose it on host closure and dispose any late startup result after that closure. |
| `getSnapshot()`, `getStatus()`, `subscribe(listener)` | Read immutable authoring/view metadata and current presentation availability. `viewportCamera` is an owned local override or `null`; `viewDirty` distinguishes it from accepted authorship. |
| `setDraftText(text, expectedVersion)`, `prepareDraft(expectedVersion)` | Stage complete corrective text, then prepare against a fresh `getSnapshot().version`. Preparation alone does not present or accept. |
| `prepareOpen(text, expectedVersion)`, `prepareUndo(expectedVersion)`, `prepareRedo(expectedVersion)`, `await commitPrepared(candidate)` | Use the session-owned single-use transaction. Await acknowledgement; refusals retain accepted authorship. Open resets history; Apply/Undo/Redo keep an active local view. |
| `await navigateViewportCamera(camera, expectedVersion)`, `await resetViewportCamera(expectedVersion)` | Present a local view or the accepted scene camera without consuming drafts/history. A changed acknowledged view advances session/Viewer generations, not authored revisions. Exact signed-value no-ops make no scene replacement. |
| `await pickViewportBody(xPixel, yPixel, expectedVersion): Promise<string \| null>` | Read one qualified visible material-bound original body ID, or background `null`, using bounded integer top-left backing pixels. Preserve the exact snapshot and authoring/Save/view identities; do not request highlight or scene replacement. |
| `discardDraft(expectedVersion)`, `getSavePayload()`, `markSaved(payload)`, `dispose()` | Discard to accepted text; save accepted authorship and acknowledge only the exact issued payload after persistence; explicitly end the owned lifetime. |

The pick holds the same exclusive operation lock and rejects competing mutation/query. It does not add a `pending` snapshot variant or notify a new revision; the app owns its pending-input state. Capture the expected version before the read and recheck host/viewport lifetime before using the returned ID. CSS-to-backing mapping belongs to the host, and the Light workbench keeps its row on a miss. See [selection coordinate and lifecycle limits](./limits#canvas-body-selection-limits).

**Set scene camera** is an app action, not an additional session method: once all fields are clean, it authors the acknowledged local view through one ordinary whole-scene Apply. The [adopted session source](https://github.com/barocss/barocss/blob/ee461c114d34c02fae513b2adff84313e3466109/packages/barocss-render-editor/src/native-light-session.ts) defines the current contracts and preserves provider causes. Software tests do not certify physical GPU/pointer/file behavior.

### Portable material authority

The Light workbench's [body-material transfer](./guides#import-and-export-a-body-material) composes existing APIs rather than adding material-import methods to `RenderNativeLightSession`. Its private selection/staging helpers are not package exports.

| Existing entry | Contract |
| --- | --- |
| `parseRenderMaterialDocument(text)`, `prepareRenderMaterialDocument(input)`, `serializeRenderMaterialDocument(document)` | Strict portable shader-source/supplied-uniform qualification and signed-value serialization. Keep original source, omitted overrides and signed zero; parsing is not presentation. |
| `deriveRenderMaterialAssignment(target, portable)` | Derive a qualified material retaining the destination envelope, ID, title and revision while copying only portable source and supplied uniforms. The caller still owns the full scene body binding. |
| `createRenderMaterialSession(material)` and `setDraftMaterial(source, uniforms)` | Strictly validate and stage both fields atomically. Read actual dirty state before `prepareDraft()`; preparation provides one next embedded revision, not a Viewer acknowledgement. Dispose temporary sessions in `finally`. |

The app publishes imported fields only after complete scene qualification and performs no separate material commit/history. Its ordinary whole-scene Apply later owns presentation and acceptance; export serializes the accepted binding without marking the scene saved. This is host composition, not a new portable schema, shader editor or global asset link. See the immutable [material document/assignment source](https://github.com/barocss/barocss/blob/f4d66c12781e370d1d6ab0e214cd911079313eba/packages/barocss-render-editor/src/material-document.ts), [material session](https://github.com/barocss/barocss/blob/f4d66c12781e370d1d6ab0e214cd911079313eba/packages/barocss-render-editor/src/material-session.ts) and [transfer limits](./limits#portable-material-transfer-limits).

## Source document and session

| Method | Input / return | Ownership and errors |
| --- | --- | --- |
| `validateRenderEditorDocument(input:unknown): RenderSceneDocumentV0` | Exact version0 document, original Source1 source and camera. | Frozen owned result; schema/bytes/compiler/camera errors. |
| `parseRenderEditorDocument(text): RenderSceneDocumentV0` | JSON text → validated document. | Original source preserved; file limits apply. |
| `serializeRenderEditorDocument(document): string` | Accepted original authority → JSON. | No IR/GL/pixels persisted. |
| `compileRenderEditorSource(source): RenderEditorMetadata` | Source1 string → copied scene/object/range metadata. | SOURCE_REFUSED preserves bounded diagnostics. |
| `createRenderEditorSession(initial): RenderEditorSession` | Validated initial document. | Own CPU drafts/history/candidates; no DOM/clock. |
| `createRenderEditorController(session, presenter?): RenderEditorController` | Caller session and optional presenter. | Apply/Open/history/recovery actions return ok/error result. |
| `normalizeRenderEditorError(error, code?): RenderEditorError` | Unknown error → bounded host diagnostic. | Error codes are stable; message is explanatory. |

Session methods: `getSnapshot`, `subscribe`, `setDraftSource`, `setDraftObjectSource`, `setDraftCamera`, `setActiveObject`, `prepareDraft`, `prepareOpen`, `prepareUndo`, `prepareRedo`, `commitPrepared`, `discardDraft`, `markSaved`, `dispose`. `commitPrepared(candidate,beforeCommit?)` locks mutation and commits only after its synchronous callback succeeds. Stale/foreign/reused candidates refuse.

Controller methods: `getSnapshot`, `subscribe`, `attachPresenter`, `detachPresenter`, `apply`, `open`, `undo`, `redo`, `recover`, `previewCamera`, `applyCameraPreview`, `cancelCameraPreview`, `presentationUnavailable`, `dispose`.

## Mixed public families

`RENDER_MIXED_DOCUMENT_LIMITS`, `RenderMixedDocumentError`, `copyRenderMixedDocument`, `parseRenderMixedDocument`, `serializeRenderMixedDocument`, `prepareRenderMixedDocument` and their document/preparation types describe the separate mixed format.

`RENDER_MIXED_SESSION_LIMITS`, `createRenderMixedSession`, `createRenderMixedController` and their snapshot/candidate/presenter/action types expose full-frame authoring. Draft setters include title, Sphere source, scene/asset source, camera, display, asset reference and complete native asset. Matching candidate/history/recovery/temporary-camera lifetimes remain explicit.

`prepareRenderNativeSourceImport(source)` returns qualified original inventory for an explicit Surface choice. `queryRenderMixedSurfacePoint(document,u,v)` returns copied/frozen original source association and native point in mm. `duplicateRenderMixedDocument(input,documentId,title)` requalifies a copy with a different host document identity and revision0 while preserving original native IDs/source.

`deriveRenderCameraInteraction(camera,interaction)` derives an owned validated orbit/pan/zoom camera. CSS deltas/dimensions are host gesture data; it adds no geometry or picking kernel.

`inspectRenderMixedSphereSource`, `editRenderMixedSphereSource`, `inspectRenderSceneObjects`, `editRenderSceneObjectSource`, `addRenderSceneObjectSource`, `removeRenderSceneObjectSource` expose source-authoritative compiler/AST edits. Their patch/property types are re-exported; implementation helpers are not root APIs.

## React exports

`RenderEditor`, `SourcePanel`, `ObjectPanel`, `CameraPanel`, `DiagnosticsPanel`, `SceneViewport`, `createSceneViewportPresenter` and the mixed React family are available from `/react`. `RenderMixedEditor`, `MixedSceneViewport` and `createMixedViewportPresenter` connect the whole mixed frame path. Props/slots remain host composition; `onAction` requests file actions and performs no I/O.

## Disposal

Controller disposal releases its presenter and subscriptions. Viewport disposal removes owned renderer/listeners/resize observation. Session disposal releases CPU lifecycle. The host owns the canvas/DOM and must close its session explicitly.

`packages/barocss-render-editor/package.json` (Manifest and version; local source) · `packages/barocss-render-editor/README.md` (Package task notes; local source)
