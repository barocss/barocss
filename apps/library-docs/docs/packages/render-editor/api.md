# Render Editor public entry contracts

| Entry | Workspace / release configuration |
| --- | --- |
| Root | `src/index.ts` / `dist/index.js` and declarations |
| `/react` | `src/react.tsx` / `dist/react.js` and declarations |
| `/style.css` | `src/style.css` / `dist/style.css` |

## Source document and session

| Signature | Input / return | Ownership and errors |
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

[Session signatures/types](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/src/session.ts) · [Controller/presenter contracts](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/src/controller.ts)

## Mixed public families

`RENDER_MIXED_DOCUMENT_LIMITS`, `RenderMixedDocumentError`, `copyRenderMixedDocument`, `parseRenderMixedDocument`, `serializeRenderMixedDocument`, `prepareRenderMixedDocument` and their document/preparation types describe the separate mixed format.

`RENDER_MIXED_SESSION_LIMITS`, `createRenderMixedSession`, `createRenderMixedController` and their snapshot/candidate/presenter/action types expose full-frame authoring. Draft setters include title, Sphere source, scene/asset source, camera, display, asset reference and complete native asset. Matching candidate/history/recovery/temporary-camera lifetimes remain explicit.

`prepareRenderNativeSourceImport(source)` returns qualified original inventory for an explicit Surface choice. `queryRenderMixedSurfacePoint(document,u,v)` returns copied/frozen original source association and native point in mm. `duplicateRenderMixedDocument(input,documentId,title)` requalifies a copy with a different host document identity and revision0 while preserving original native IDs/source.

`deriveRenderCameraInteraction(camera,interaction)` derives an owned validated orbit/pan/zoom camera. CSS deltas/dimensions are host gesture data; it adds no geometry or picking kernel.

`inspectRenderMixedSphereSource`, `editRenderMixedSphereSource`, `inspectRenderSceneObjects`, `editRenderSceneObjectSource`, `addRenderSceneObjectSource`, `removeRenderSceneObjectSource` expose source-authoritative compiler/AST edits. Their patch/property types are re-exported; implementation helpers are not root APIs.

[Exact root export graph](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/src/index.ts) · [Mixed session signatures](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/src/mixed-session.ts) · [Mixed document types](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/src/mixed-document.ts)

## React exports

`RenderEditor`, `SourcePanel`, `ObjectPanel`, `CameraPanel`, `DiagnosticsPanel`, `SceneViewport`, `createSceneViewportPresenter` and the mixed React family are available from `/react`. `RenderMixedEditor`, `MixedSceneViewport` and `createMixedViewportPresenter` connect the whole mixed frame path. Props/slots remain host composition; `onAction` requests file actions and performs no I/O.

[React root and props](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/src/react.tsx) · [Mixed React exports](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/src/mixed-react.tsx)

## Disposal

Controller disposal releases its presenter and subscriptions. Viewport disposal removes owned renderer/listeners/resize observation. Session disposal releases CPU lifecycle. The host owns the canvas/DOM and must close its session explicitly.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/README.md)
