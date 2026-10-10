---
outline: 2
---
# @barocss/render-editor public signatures

Package version: `0.0.0-experimental`. Declaration snapshot: `5f5ad866205a`.

Use [task API guidance](./api), [examples](./examples) and [limits](./limits) for semantics, ownership, errors and lifecycle. These signatures come from actual public entry exports. They do not prove execution or general support beyond those guides. Unannotated returns/types are inferred by the source checker; peer type-checking and emitted declaration equivalence did not run. Private/protected members and implementation bodies are excluded.

## Public declaration groups

Choose a public declaration group. File paths and the exact local commit are provenance; no unavailable GitHub URL is required.

### controller.ts {#declarations-cf976af88b6c}

Local source: `packages/barocss-render-editor/src/controller.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[PresentationResult](#presentationresult) · [RenderEditorActionResult](#rendereditoractionresult) · [RenderEditorController](#rendereditorcontroller) · [RenderEditorControllerSnapshot](#rendereditorcontrollersnapshot) · [RenderEditorPresenter](#rendereditorpresenter) · [createRenderEditorController](#createrendereditorcontroller)

### document.ts {#declarations-0aaebec2c379}

Local source: `packages/barocss-render-editor/src/document.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RENDER_EDITOR_LIMITS](#render_editor_limits) · [RenderEditorMetadata](#rendereditormetadata) · [RenderEditorObjectMetadata](#rendereditorobjectmetadata) · [RenderSceneDocumentV0](#renderscenedocumentv0) · [compileRenderEditorSource](#compilerendereditorsource) · [parseRenderEditorDocument](#parserendereditordocument) · [serializeRenderEditorDocument](#serializerendereditordocument) · [validateRenderEditorDocument](#validaterendereditordocument)

### errors.ts {#declarations-f955e258f76a}

Local source: `packages/barocss-render-editor/src/errors.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RenderEditorError](#rendereditorerror) · [RenderEditorErrorCode](#rendereditorerrorcode) · [normalizeRenderEditorError](#normalizerendereditorerror)

### index.ts {#declarations-7ff934513450}

Local source: `packages/barocss-render-editor/src/index.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[PreparedRenderMixedDocument](#preparedrendermixeddocument) · [PresentationResult](#presentationresult) · [RENDER_EDITOR_LIMITS](#render_editor_limits) · [RENDER_MIXED_DOCUMENT_LIMITS](#render_mixed_document_limits) · [RENDER_MIXED_SESSION_LIMITS](#render_mixed_session_limits) · [RenderCameraInteraction](#rendercamerainteraction) · [RenderEditorActionResult](#rendereditoractionresult) · [RenderEditorApplyMode](#rendereditorapplymode) · [RenderEditorController](#rendereditorcontroller) · [RenderEditorControllerSnapshot](#rendereditorcontrollersnapshot) · [RenderEditorError](#rendereditorerror) · [RenderEditorErrorCode](#rendereditorerrorcode) · [RenderEditorMetadata](#rendereditormetadata) · [RenderEditorObjectMetadata](#rendereditorobjectmetadata) · [RenderEditorPreparedCandidate](#rendereditorpreparedcandidate) · [RenderEditorPresenter](#rendereditorpresenter) · [RenderEditorPurpose](#rendereditorpurpose) · [RenderEditorSession](#rendereditorsession) · [RenderEditorSessionSnapshot](#rendereditorsessionsnapshot) · [RenderMixedActionResult](#rendermixedactionresult) · [RenderMixedController](#rendermixedcontroller) · [RenderMixedControllerSnapshot](#rendermixedcontrollersnapshot) · [RenderMixedDocumentAssetV1](#rendermixeddocumentassetv1) · [RenderMixedDocumentDisplayV1](#rendermixeddocumentdisplayv1) · [RenderMixedDocumentError](#rendermixeddocumenterror) · [RenderMixedDocumentErrorCode](#rendermixeddocumenterrorcode) · [RenderMixedDocumentMetadata](#rendermixeddocumentmetadata) · [RenderMixedDocumentV1](#rendermixeddocumentv1) · [RenderMixedPreparedCandidate](#rendermixedpreparedcandidate) · [RenderMixedPresentationResult](#rendermixedpresentationresult) · [RenderMixedPresenter](#rendermixedpresenter) · [RenderMixedSession](#rendermixedsession) · [RenderMixedSessionPurpose](#rendermixedsessionpurpose) · [RenderMixedSessionSnapshot](#rendermixedsessionsnapshot) · [RenderMixedSpherePatch](#rendermixedspherepatch) · [RenderMixedSphereProperties](#rendermixedsphereproperties) · [RenderMixedSurfacePointResult](#rendermixedsurfacepointresult) · [RenderNativeSourceImport](#rendernativesourceimport) · [RenderSceneDocumentV0](#renderscenedocumentv0) · [RenderSceneObjectKind](#rendersceneobjectkind) · [RenderSceneObjectPatch](#rendersceneobjectpatch) · [RenderSceneObjectProperties](#rendersceneobjectproperties) · [addRenderSceneObjectSource](#addrendersceneobjectsource) · [compileRenderEditorSource](#compilerendereditorsource) · [copyRenderMixedDocument](#copyrendermixeddocument) · [createRenderEditorController](#createrendereditorcontroller) · [createRenderEditorSession](#createrendereditorsession) · [createRenderMixedController](#createrendermixedcontroller) · [createRenderMixedSession](#createrendermixedsession) · [deriveRenderCameraInteraction](#deriverendercamerainteraction) · [duplicateRenderMixedDocument](#duplicaterendermixeddocument) · [editRenderMixedSphereSource](#editrendermixedspheresource) · [editRenderSceneObjectSource](#editrendersceneobjectsource) · [inspectRenderMixedSphereSource](#inspectrendermixedspheresource) · [inspectRenderSceneObjects](#inspectrendersceneobjects) · [normalizeRenderEditorError](#normalizerendereditorerror) · [parseRenderEditorDocument](#parserendereditordocument) · [parseRenderMixedDocument](#parserendermixeddocument) · [prepareRenderMixedDocument](#preparerendermixeddocument) · [prepareRenderNativeSourceImport](#preparerendernativesourceimport) · [queryRenderMixedSurfacePoint](#queryrendermixedsurfacepoint) · [removeRenderSceneObjectSource](#removerendersceneobjectsource) · [serializeRenderEditorDocument](#serializerendereditordocument) · [serializeRenderMixedDocument](#serializerendermixeddocument) · [validateRenderEditorDocument](#validaterendereditordocument)

### mixed-camera-navigation.ts {#declarations-9f8c525645b2}

Local source: `packages/barocss-render-editor/src/mixed-camera-navigation.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RenderCameraInteraction](#rendercamerainteraction) · [deriveRenderCameraInteraction](#deriverendercamerainteraction)

### mixed-controller.ts {#declarations-bea97f98df05}

Local source: `packages/barocss-render-editor/src/mixed-controller.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RenderMixedActionResult](#rendermixedactionresult) · [RenderMixedController](#rendermixedcontroller) · [RenderMixedControllerSnapshot](#rendermixedcontrollersnapshot) · [RenderMixedPresentationResult](#rendermixedpresentationresult) · [RenderMixedPresenter](#rendermixedpresenter) · [createRenderMixedController](#createrendermixedcontroller)

### mixed-document.ts {#declarations-8867ea2c9777}

Local source: `packages/barocss-render-editor/src/mixed-document.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RENDER_MIXED_DOCUMENT_LIMITS](#render_mixed_document_limits) · [RenderMixedDocumentAssetV1](#rendermixeddocumentassetv1) · [RenderMixedDocumentDisplayV1](#rendermixeddocumentdisplayv1) · [RenderMixedDocumentError](#rendermixeddocumenterror) · [RenderMixedDocumentErrorCode](#rendermixeddocumenterrorcode) · [RenderMixedDocumentV1](#rendermixeddocumentv1) · [copyRenderMixedDocument](#copyrendermixeddocument) · [parseRenderMixedDocument](#parserendermixeddocument) · [serializeRenderMixedDocument](#serializerendermixeddocument)

### mixed-duplicate.ts {#declarations-217e94d6df39}

Local source: `packages/barocss-render-editor/src/mixed-duplicate.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[duplicateRenderMixedDocument](#duplicaterendermixeddocument)

### mixed-frame.ts {#declarations-46665a1e39aa}

Local source: `packages/barocss-render-editor/src/mixed-frame.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[PreparedRenderMixedDocument](#preparedrendermixeddocument) · [RenderMixedDocumentMetadata](#rendermixeddocumentmetadata) · [prepareRenderMixedDocument](#preparerendermixeddocument)

### mixed-react.tsx {#declarations-ac9669117634}

Local source: `packages/barocss-render-editor/src/mixed-react.tsx` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[MixedSceneViewport](#mixedsceneviewport) · [RenderMixedEditor](#rendermixededitor) · [RenderMixedEditorProps](#rendermixededitorprops) · [createMixedViewportPresenter](#createmixedviewportpresenter)

### mixed-session.ts {#declarations-6e602b9cef07}

Local source: `packages/barocss-render-editor/src/mixed-session.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RENDER_MIXED_SESSION_LIMITS](#render_mixed_session_limits) · [RenderMixedPreparedCandidate](#rendermixedpreparedcandidate) · [RenderMixedSession](#rendermixedsession) · [RenderMixedSessionPurpose](#rendermixedsessionpurpose) · [RenderMixedSessionSnapshot](#rendermixedsessionsnapshot) · [createRenderMixedSession](#createrendermixedsession)

### mixed-sphere-source.ts {#declarations-5698fa31eaac}

Local source: `packages/barocss-render-editor/src/mixed-sphere-source.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RenderMixedSpherePatch](#rendermixedspherepatch) · [RenderMixedSphereProperties](#rendermixedsphereproperties) · [editRenderMixedSphereSource](#editrendermixedspheresource) · [inspectRenderMixedSphereSource](#inspectrendermixedspheresource)

### mixed-surface-point.ts {#declarations-2e99f01314ae}

Local source: `packages/barocss-render-editor/src/mixed-surface-point.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RenderMixedSurfacePointResult](#rendermixedsurfacepointresult) · [queryRenderMixedSurfacePoint](#queryrendermixedsurfacepoint)

### mixed-viewport.ts {#declarations-986f3e8f0b9f}

Local source: `packages/barocss-render-editor/src/mixed-viewport.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[createMixedViewportPresenter](#createmixedviewportpresenter)

### native-source-import.ts {#declarations-aa59b0114ec3}

Local source: `packages/barocss-render-editor/src/native-source-import.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RenderNativeSourceImport](#rendernativesourceimport) · [prepareRenderNativeSourceImport](#preparerendernativesourceimport)

### react.tsx {#declarations-ff49b1eb9943}

Local source: `packages/barocss-render-editor/src/react.tsx` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[CameraPanel](#camerapanel) · [DiagnosticsPanel](#diagnosticspanel) · [MixedSceneViewport](#mixedsceneviewport) · [ObjectPanel](#objectpanel) · [RenderEditor](#rendereditor) · [RenderEditorPanelProps](#rendereditorpanelprops) · [RenderEditorProps](#rendereditorprops) · [RenderMixedEditor](#rendermixededitor) · [RenderMixedEditorProps](#rendermixededitorprops) · [SceneViewport](#sceneviewport) · [SourcePanel](#sourcepanel) · [createMixedViewportPresenter](#createmixedviewportpresenter) · [createSceneViewportPresenter](#createsceneviewportpresenter)

### scene-object-source.ts {#declarations-ba06cf56f88d}

Local source: `packages/barocss-render-editor/src/scene-object-source.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RenderSceneObjectKind](#rendersceneobjectkind) · [RenderSceneObjectPatch](#rendersceneobjectpatch) · [RenderSceneObjectProperties](#rendersceneobjectproperties) · [addRenderSceneObjectSource](#addrendersceneobjectsource) · [editRenderSceneObjectSource](#editrendersceneobjectsource) · [inspectRenderSceneObjects](#inspectrendersceneobjects) · [removeRenderSceneObjectSource](#removerendersceneobjectsource)

### scene-viewport.ts {#declarations-cbc75d1f57da}

Local source: `packages/barocss-render-editor/src/scene-viewport.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[createSceneViewportPresenter](#createsceneviewportpresenter)

### session.ts {#declarations-0c75caeb5a00}

Local source: `packages/barocss-render-editor/src/session.ts` at `5f5ad866205a21510ac69552e704cc162fa253b5`.

[RenderEditorApplyMode](#rendereditorapplymode) · [RenderEditorPreparedCandidate](#rendereditorpreparedcandidate) · [RenderEditorPurpose](#rendereditorpurpose) · [RenderEditorSession](#rendereditorsession) · [RenderEditorSessionSnapshot](#rendereditorsessionsnapshot) · [createRenderEditorSession](#createrendereditorsession)

## @barocss/render-editor

Entry: `packages/barocss-render-editor/src/index.ts`. declared development type entry.

### addRenderSceneObjectSource {#addrendersceneobjectsource}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function addRenderSceneObjectSource(source: string, kind: RenderSceneObjectKind, newId: string): string;
```

</details>

Local declaration: `packages/barocss-render-editor/src/scene-object-source.ts:174` at `5f5ad866205a`.

### compileRenderEditorSource {#compilerendereditorsource}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function compileRenderEditorSource(source: string): RenderEditorMetadata;
```

</details>

Local declaration: `packages/barocss-render-editor/src/document.ts:81` at `5f5ad866205a`.

### copyRenderMixedDocument {#copyrendermixeddocument}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function copyRenderMixedDocument(input: unknown): RenderMixedDocumentV1;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-document.ts:150` at `5f5ad866205a`.

### createRenderEditorController {#createrendereditorcontroller}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function createRenderEditorController(session: RenderEditorSession, initialPresenter?: RenderEditorPresenter): RenderEditorController;
```

</details>

Local declaration: `packages/barocss-render-editor/src/controller.ts:50` at `5f5ad866205a`.

### createRenderEditorSession {#createrendereditorsession}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function createRenderEditorSession(initial: RenderSceneDocumentV0): RenderEditorSession;
```

</details>

Local declaration: `packages/barocss-render-editor/src/session.ts:61` at `5f5ad866205a`.

### createRenderMixedController {#createrendermixedcontroller}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function createRenderMixedController(session: RenderMixedSession, initial?: RenderMixedPresenter): RenderMixedController;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-controller.ts:28` at `5f5ad866205a`.

### createRenderMixedSession {#createrendermixedsession}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function createRenderMixedSession(initial: RenderMixedDocumentV1): RenderMixedSession;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-session.ts:110` at `5f5ad866205a`.

### deriveRenderCameraInteraction {#deriverendercamerainteraction}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function deriveRenderCameraInteraction(camera: MeshCamera, interaction: RenderCameraInteraction): MeshCamera;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-camera-navigation.ts:55` at `5f5ad866205a`.

### duplicateRenderMixedDocument {#duplicaterendermixeddocument}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function duplicateRenderMixedDocument(input: unknown, documentId: string, title: string): RenderMixedDocumentV1;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-duplicate.ts:6` at `5f5ad866205a`.

### editRenderMixedSphereSource {#editrendermixedspheresource}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function editRenderMixedSphereSource(source: string, objectId: string, patch: RenderMixedSpherePatch): string;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-sphere-source.ts:101` at `5f5ad866205a`.

### editRenderSceneObjectSource {#editrendersceneobjectsource}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function editRenderSceneObjectSource(source: string, objectId: string, patch: RenderSceneObjectPatch): string;
```

</details>

Local declaration: `packages/barocss-render-editor/src/scene-object-source.ts:131` at `5f5ad866205a`.

### inspectRenderMixedSphereSource {#inspectrendermixedspheresource}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function inspectRenderMixedSphereSource(source: string): RenderMixedSphereProperties;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-sphere-source.ts:94` at `5f5ad866205a`.

### inspectRenderSceneObjects {#inspectrendersceneobjects}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function inspectRenderSceneObjects(source: string): readonly RenderSceneObjectProperties[];
```

</details>

Local declaration: `packages/barocss-render-editor/src/scene-object-source.ts:120` at `5f5ad866205a`.

### normalizeRenderEditorError {#normalizerendereditorerror}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function normalizeRenderEditorError(error: unknown, code?: RenderEditorErrorCode): RenderEditorError;
```

</details>

Local declaration: `packages/barocss-render-editor/src/errors.ts:30` at `5f5ad866205a`.

### parseRenderEditorDocument {#parserendereditordocument}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function parseRenderEditorDocument(text: string): RenderSceneDocumentV0;
```

</details>

Local declaration: `packages/barocss-render-editor/src/document.ts:123` at `5f5ad866205a`.

### parseRenderMixedDocument {#parserendermixeddocument}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function parseRenderMixedDocument(text: string): RenderMixedDocumentV1;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-document.ts:187` at `5f5ad866205a`.

### PreparedRenderMixedDocument {#preparedrendermixeddocument}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface PreparedRenderMixedDocument {
  readonly document: RenderMixedDocumentV1;
  readonly metadata: RenderMixedDocumentMetadata;
  /** Actual full original-source native model, including unrendered objects. */
  readonly model: Model;
  /** Derived display only. Persist document, never this frame/packet as native authority. */
  readonly frame: MixedDepthFrameV0;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-frame.ts:16` at `5f5ad866205a`.

### prepareRenderMixedDocument {#preparerendermixeddocument}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function prepareRenderMixedDocument(input: unknown): PreparedRenderMixedDocument;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-frame.ts:33` at `5f5ad866205a`.

### prepareRenderNativeSourceImport {#preparerendernativesourceimport}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function prepareRenderNativeSourceImport(source: string): RenderNativeSourceImport;
```

</details>

Local declaration: `packages/barocss-render-editor/src/native-source-import.ts:13` at `5f5ad866205a`.

### PresentationResult {#presentationresult}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type PresentationResult = {ok: true} | {ok: false; error: Error; recovered: boolean};
```

</details>

Local declaration: `packages/barocss-render-editor/src/controller.ts:8` at `5f5ad866205a`.

### queryRenderMixedSurfacePoint {#queryrendermixedsurfacepoint}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function queryRenderMixedSurfacePoint(document: unknown, u: number, v: number): RenderMixedSurfacePointResult;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-surface-point.ts:22` at `5f5ad866205a`.

### removeRenderSceneObjectSource {#removerendersceneobjectsource}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function removeRenderSceneObjectSource(source: string, objectId: string): string;
```

</details>

Local declaration: `packages/barocss-render-editor/src/scene-object-source.ts:195` at `5f5ad866205a`.

### RENDER_EDITOR_LIMITS {#render_editor_limits}

<details><summary>Show VariableDeclaration signature</summary>

```ts
export const RENDER_EDITOR_LIMITS: Readonly<{ fileBytes: 262144; sourceBytes: 65536; historyEntries: 32; historyBytes: number; }>;
```

</details>

Local declaration: `packages/barocss-render-editor/src/document.ts:5` at `5f5ad866205a`.

### RENDER_MIXED_DOCUMENT_LIMITS {#render_mixed_document_limits}

<details><summary>Show VariableDeclaration signature</summary>

```ts
export const RENDER_MIXED_DOCUMENT_LIMITS: Readonly<{ fileBytes: 524288; sourceBytes: 65536; sourceCodeUnits: 65536; sampleMin: 2; sampleMax: 17; }>;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-document.ts:4` at `5f5ad866205a`.

### RENDER_MIXED_SESSION_LIMITS {#render_mixed_session_limits}

<details><summary>Show VariableDeclaration signature</summary>

```ts
export const RENDER_MIXED_SESSION_LIMITS: Readonly<{ historyEntries: 32; historyBytes: number; }>;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-session.ts:10` at `5f5ad866205a`.

### RenderCameraInteraction {#rendercamerainteraction}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderCameraInteraction =
  | { readonly kind: 'orbit' | 'pan'; readonly deltaX: number; readonly deltaY: number; readonly width: number; readonly height: number }
  | { readonly kind: 'zoom'; readonly factor: number };
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-camera-navigation.ts:5` at `5f5ad866205a`.

### RenderEditorActionResult {#rendereditoractionresult}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderEditorActionResult = {ok: true} | {ok: false; error: RenderEditorError};
```

</details>

Local declaration: `packages/barocss-render-editor/src/controller.ts:20` at `5f5ad866205a`.

### RenderEditorApplyMode {#rendereditorapplymode}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderEditorApplyMode = 'source' | 'camera' | 'both';
```

</details>

Local declaration: `packages/barocss-render-editor/src/session.ts:9` at `5f5ad866205a`.

### RenderEditorController {#rendereditorcontroller}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorController {
  readonly session: RenderEditorSession;
  getSnapshot(): RenderEditorControllerSnapshot;
  subscribe(listener: () => void): () => void;
  attachPresenter(presenter: RenderEditorPresenter): RenderEditorActionResult;
  detachPresenter(presenter: RenderEditorPresenter): void;
  apply(mode?: RenderEditorApplyMode): RenderEditorActionResult;
  open(text: string): RenderEditorActionResult;
  undo(): RenderEditorActionResult;
  redo(): RenderEditorActionResult;
  recover(): RenderEditorActionResult;
  previewCamera(camera: MeshCamera): RenderEditorActionResult;
  applyCameraPreview(): RenderEditorActionResult;
  cancelCameraPreview(): RenderEditorActionResult;
  presentationUnavailable(error: Error): void;
  dispose(): void;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/controller.ts:21` at `5f5ad866205a`.

### RenderEditorControllerSnapshot {#rendereditorcontrollersnapshot}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorControllerSnapshot {
  readonly presentedRevision: number | null;
  readonly presentationError: RenderEditorError | null;
  readonly cameraPreview: MeshCamera | null;
  readonly disposed: boolean;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/controller.ts:14` at `5f5ad866205a`.

### RenderEditorError {#rendereditorerror}

<details><summary>Show ClassDeclaration signature</summary>

```ts
export class RenderEditorError extends Error {
  readonly code: RenderEditorErrorCode;
  readonly diagnostics: readonly GpuDiagnostic[];
  constructor(code: RenderEditorErrorCode, message: string, diagnostics?: readonly GpuDiagnostic[]);
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/errors.ts:19` at `5f5ad866205a`.

### RenderEditorErrorCode {#rendereditorerrorcode}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderEditorErrorCode =
  | 'DOCUMENT_INPUT' | 'DOCUMENT_VERSION' | 'DOCUMENT_BYTES' | 'SOURCE_REFUSED'
  | 'STALE_CANDIDATE' | 'PRESENTATION_REFUSED' | 'HISTORY_LIMIT' | 'DISPOSED';
```

</details>

Local declaration: `packages/barocss-render-editor/src/errors.ts:3` at `5f5ad866205a`.

### RenderEditorMetadata {#rendereditormetadata}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorMetadata {
  readonly name: string;
  readonly pipeline: 'sdf';
  readonly sourceVersion: 1;
  readonly objects: readonly RenderEditorObjectMetadata[];
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/document.ts:23` at `5f5ad866205a`.

### RenderEditorObjectMetadata {#rendereditorobjectmetadata}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorObjectMetadata {
  readonly id: string;
  readonly type: SceneObject1['type'];
  readonly range: SourceRange | null;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/document.ts:18` at `5f5ad866205a`.

### RenderEditorPreparedCandidate {#rendereditorpreparedcandidate}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorPreparedCandidate {
  readonly document: RenderSceneDocumentV0;
  readonly metadata: RenderEditorMetadata;
  readonly mode: RenderEditorApplyMode;
  readonly purpose: RenderEditorPurpose;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/session.ts:11` at `5f5ad866205a`.

### RenderEditorPresenter {#rendereditorpresenter}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorPresenter {
  present(candidate: RenderEditorPreparedCandidate, previous: RenderSceneDocumentV0): PresentationResult;
  recover(document: RenderSceneDocumentV0): PresentationResult;
  dispose(): void;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/controller.ts:9` at `5f5ad866205a`.

### RenderEditorPurpose {#rendereditorpurpose}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderEditorPurpose = 'apply' | 'open' | 'undo' | 'redo';
```

</details>

Local declaration: `packages/barocss-render-editor/src/session.ts:10` at `5f5ad866205a`.

### RenderEditorSession {#rendereditorsession}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorSession {
  getSnapshot(): RenderEditorSessionSnapshot;
  subscribe(listener: () => void): () => void;
  setDraftSource(source: string): void;
  setDraftObjectSource(source: string | null): void;
  setDraftCamera(camera: MeshCamera): void;
  setActiveObject(id: string | null): void;
  prepareDraft(mode?: RenderEditorApplyMode): RenderEditorPreparedCandidate;
  prepareOpen(text: string): RenderEditorPreparedCandidate;
  prepareUndo(): RenderEditorPreparedCandidate | null;
  prepareRedo(): RenderEditorPreparedCandidate | null;
  commitPrepared(candidate: RenderEditorPreparedCandidate, beforeCommit?: () => void): void;
  discardDraft(): void;
  markSaved(revision: number): void;
  dispose(): void;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/session.ts:32` at `5f5ad866205a`.

### RenderEditorSessionSnapshot {#rendereditorsessionsnapshot}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorSessionSnapshot {
  readonly accepted: RenderSceneDocumentV0;
  readonly metadata: RenderEditorMetadata;
  readonly draftSource: string;
  readonly draftCamera: MeshCamera;
  readonly sourceDirty: boolean;
  readonly objectInputInvalid: boolean;
  readonly cameraDirty: boolean;
  readonly activeObjectId: string | null;
  readonly diagnostics: readonly GpuDiagnostic[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly savedRevision: number | null;
  readonly disposed: boolean;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/session.ts:17` at `5f5ad866205a`.

### RenderMixedActionResult {#rendermixedactionresult}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderMixedActionResult = {ok:true}|{ok:false;error:RenderMixedDocumentError};
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-controller.ts:14` at `5f5ad866205a`.

### RenderMixedController {#rendermixedcontroller}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedController {
  readonly session:RenderMixedSession;
  getSnapshot():RenderMixedControllerSnapshot;
  subscribe(listener:()=>void):()=>void;
  attachPresenter(presenter:RenderMixedPresenter):RenderMixedActionResult;
  detachPresenter(presenter:RenderMixedPresenter):void;
  apply():RenderMixedActionResult;open(text:string):RenderMixedActionResult;undo():RenderMixedActionResult;redo():RenderMixedActionResult;recover():RenderMixedActionResult;
  previewCamera(camera:MeshCamera):RenderMixedActionResult;
  applyCameraPreview():RenderMixedActionResult;
  cancelCameraPreview():RenderMixedActionResult;
  presentationUnavailable(error:Error):void;dispose():void;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-controller.ts:15` at `5f5ad866205a`.

### RenderMixedControllerSnapshot {#rendermixedcontrollersnapshot}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedControllerSnapshot {readonly presentedRevision:number|null;readonly presentationError:RenderMixedDocumentError|null;readonly cameraPreview:MeshCamera|null;readonly disposed:boolean}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-controller.ts:13` at `5f5ad866205a`.

### RenderMixedDocumentAssetV1 {#rendermixeddocumentassetv1}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedDocumentAssetV1 {
  readonly assetId: string;
  /** Declared source association, not a historical content certificate. */
  readonly revision: number;
  readonly sourceVersion: 0;
  readonly source: string;
  readonly modelId: string;
  readonly surfaceId: string;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-document.ts:24` at `5f5ad866205a`.

### RenderMixedDocumentDisplayV1 {#rendermixeddocumentdisplayv1}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedDocumentDisplayV1 {
  readonly mmToSceneUnit: number;
  readonly translate: readonly [number, number, number];
  readonly color: readonly [number, number, number];
  readonly countU: number;
  readonly countV: number;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-document.ts:34` at `5f5ad866205a`.

### RenderMixedDocumentError {#rendermixeddocumenterror}

<details><summary>Show ClassDeclaration signature</summary>

```ts
export class RenderMixedDocumentError extends Error {
  readonly code: RenderMixedDocumentErrorCode;
  constructor(code: RenderMixedDocumentErrorCode, message: string, cause?: unknown);
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-document.ts:15` at `5f5ad866205a`.

### RenderMixedDocumentErrorCode {#rendermixeddocumenterrorcode}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderMixedDocumentErrorCode = 'INPUT' | 'VERSION' | 'BYTES' | 'SOURCE' | 'QUALIFICATION' | 'NATIVE' | 'GPU';
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-document.ts:12` at `5f5ad866205a`.

### RenderMixedDocumentMetadata {#rendermixeddocumentmetadata}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedDocumentMetadata {
  readonly sceneName: string;
  readonly objectId: string;
  readonly assetId: string;
  readonly assetRevision: number;
  readonly modelId: string;
  readonly surfaceId: string;
  readonly nativeObjects: readonly {readonly id: string; readonly kind: 'surface' | 'curve'}[];
  readonly vertexCount: number;
  readonly triangleCount: number;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-frame.ts:5` at `5f5ad866205a`.

### RenderMixedDocumentV1 {#rendermixeddocumentv1}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedDocumentV1 {
  readonly format: 'barocss-render-editor';
  readonly version: 1;
  readonly kind: 'mixed-depth';
  readonly documentId: string;
  readonly title: string;
  readonly revision: number;
  readonly profile: 'sdf-sphere-native-surface-v0';
  readonly sourceVersion: 1;
  readonly sceneSource: string;
  readonly camera: MeshCamera;
  readonly asset: RenderMixedDocumentAssetV1;
  readonly display: RenderMixedDocumentDisplayV1;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-document.ts:42` at `5f5ad866205a`.

### RenderMixedPreparedCandidate {#rendermixedpreparedcandidate}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedPreparedCandidate {
  readonly prepared: PreparedRenderMixedDocument;
  readonly purpose: RenderMixedSessionPurpose;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-session.ts:13` at `5f5ad866205a`.

### RenderMixedPresentationResult {#rendermixedpresentationresult}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderMixedPresentationResult = {ok:true} | {ok:false;error:Error;retained:boolean};
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-controller.ts:7` at `5f5ad866205a`.

### RenderMixedPresenter {#rendermixedpresenter}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedPresenter {
  present(prepared:PreparedRenderMixedDocument, previous:PreparedRenderMixedDocument):RenderMixedPresentationResult;
  recover(prepared:PreparedRenderMixedDocument):RenderMixedPresentationResult;
  dispose():void;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-controller.ts:8` at `5f5ad866205a`.

### RenderMixedSession {#rendermixedsession}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedSession {
  getSnapshot(): RenderMixedSessionSnapshot;
  subscribe(listener: () => void): () => void;
  setDraftTitle(title: string): void;
  setDraftSphereSource(source: string | null): void;
  setDraftSource(kind: 'scene' | 'asset', text: string): void;
  setDraftCamera(camera: MeshCamera): void;
  setDraftDisplay(display: RenderMixedDocumentDisplayV1): void;
  setDraftAssetReference(modelId: string, surfaceId: string): void;
  setDraftNativeAsset(source: string, modelId: string, surfaceId: string): void;
  discardDraft(): void;
  prepareDraft(): RenderMixedPreparedCandidate;
  prepareOpen(text: string): RenderMixedPreparedCandidate;
  prepareUndo(): RenderMixedPreparedCandidate | null;
  prepareRedo(): RenderMixedPreparedCandidate | null;
  commitPrepared(candidate: RenderMixedPreparedCandidate, beforeCommit?: () => void): void;
  markSaved(revision: number): void;
  dispose(): void;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-session.ts:32` at `5f5ad866205a`.

### RenderMixedSessionPurpose {#rendermixedsessionpurpose}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderMixedSessionPurpose = 'apply' | 'open' | 'undo' | 'redo';
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-session.ts:11` at `5f5ad866205a`.

### RenderMixedSessionSnapshot {#rendermixedsessionsnapshot}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedSessionSnapshot {
  readonly accepted: RenderMixedDocumentV1;
  readonly prepared: PreparedRenderMixedDocument;
  /** Owned draft data. Numeric camera/display values can await validation. */
  readonly draft: RenderMixedDocumentV1;
  readonly dirty: boolean;
  readonly sphereInputInvalid: boolean;
  readonly diagnostics: RenderMixedDocumentError | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly savedRevision: number | null;
  readonly disposed: boolean;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-session.ts:18` at `5f5ad866205a`.

### RenderMixedSpherePatch {#rendermixedspherepatch}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedSpherePatch {
  readonly radius?: number;
  readonly translate?: readonly [number, number, number];
  readonly color?: string;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-sphere-source.ts:11` at `5f5ad866205a`.

### RenderMixedSphereProperties {#rendermixedsphereproperties}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedSphereProperties {
  readonly objectId: string;
  readonly radius: number;
  readonly translate: readonly [number, number, number];
  readonly color: string;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-sphere-source.ts:5` at `5f5ad866205a`.

### RenderMixedSurfacePointResult {#rendermixedsurfacepointresult}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedSurfacePointResult {
  readonly documentId: string;
  readonly documentRevision: number;
  readonly assetId: string;
  /** Declared source association, not a historical content certificate. */
  readonly assetRevision: number;
  readonly sourceVersion: 0;
  readonly modelId: string;
  readonly surfaceId: string;
  readonly domain: { readonly u: readonly [number, number]; readonly v: readonly [number, number] };
  readonly parameters: { readonly u: number; readonly v: number };
  readonly pointMM: readonly [number, number, number];
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-surface-point.ts:7` at `5f5ad866205a`.

### RenderNativeSourceImport {#rendernativesourceimport}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderNativeSourceImport {
  readonly sourceVersion: 0;
  readonly source: string;
  readonly modelId: string;
  readonly objects: readonly { readonly id: string; readonly kind: 'surface' | 'curve' }[];
  readonly surfaces: readonly { readonly id: string }[];
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/native-source-import.ts:4` at `5f5ad866205a`.

### RenderSceneDocumentV0 {#renderscenedocumentv0}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderSceneDocumentV0 {
  readonly format: 'barocss-render-editor';
  readonly version: 0;
  readonly kind: 'gpu-scene';
  readonly documentId: string;
  readonly title: string;
  readonly revision: number;
  readonly sourceVersion: 1;
  readonly sceneSource: string;
  readonly camera: MeshCamera;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/document.ts:7` at `5f5ad866205a`.

### RenderSceneObjectKind {#rendersceneobjectkind}

<details><summary>Show TypeAliasDeclaration signature</summary>

```ts
export type RenderSceneObjectKind = SceneObject1['type'];
```

</details>

Local declaration: `packages/barocss-render-editor/src/scene-object-source.ts:6` at `5f5ad866205a`.

### RenderSceneObjectPatch {#rendersceneobjectpatch}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderSceneObjectPatch {
  readonly translate?: XYZ;
  readonly rotateDegrees?: XYZ;
  readonly color?: string;
  readonly radius?: number;
  readonly size?: XYZ;
  readonly height?: number;
  readonly start?: XYZ;
  readonly end?: XYZ;
  readonly majorRadius?: number;
  readonly minorRadius?: number;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/scene-object-source.ts:22` at `5f5ad866205a`.

### RenderSceneObjectProperties {#rendersceneobjectproperties}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderSceneObjectProperties {
  readonly objectId: string;
  readonly type: RenderSceneObjectKind;
  readonly translate: XYZ;
  readonly rotateDegrees: XYZ;
  readonly color: string;
  readonly radius?: number;
  readonly size?: XYZ;
  readonly height?: number;
  readonly start?: XYZ;
  readonly end?: XYZ;
  readonly majorRadius?: number;
  readonly minorRadius?: number;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/scene-object-source.ts:8` at `5f5ad866205a`.

### serializeRenderEditorDocument {#serializerendereditordocument}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function serializeRenderEditorDocument(document: RenderSceneDocumentV0): string;
```

</details>

Local declaration: `packages/barocss-render-editor/src/document.ts:133` at `5f5ad866205a`.

### serializeRenderMixedDocument {#serializerendermixeddocument}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function serializeRenderMixedDocument(document: RenderMixedDocumentV1): string;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-document.ts:198` at `5f5ad866205a`.

### validateRenderEditorDocument {#validaterendereditordocument}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function validateRenderEditorDocument(input: unknown): RenderSceneDocumentV0;
```

</details>

Local declaration: `packages/barocss-render-editor/src/document.ts:99` at `5f5ad866205a`.

## @barocss/render-editor/react

Entry: `packages/barocss-render-editor/src/react.tsx`. declared development type entry.

### CameraPanel {#camerapanel}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function CameraPanel({controller, onError, showApply = true}: RenderEditorPanelProps & {showApply?: boolean}): React.JSX.Element;
```

</details>

Local declaration: `packages/barocss-render-editor/src/react.tsx:101` at `5f5ad866205a`.

### createMixedViewportPresenter {#createmixedviewportpresenter}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function createMixedViewportPresenter(canvas: HTMLCanvasElement, onUnavailable?: (error:Error)=>void): RenderMixedPresenter&{resize(width:number,height:number):RenderMixedPresentationResult;readPixels():Uint8Array};
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-viewport.ts:5` at `5f5ad866205a`.

### createSceneViewportPresenter {#createsceneviewportpresenter}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function createSceneViewportPresenter(canvas: HTMLCanvasElement, onUnavailable?: (error: Error) => void): RenderEditorPresenter & {resize(width: number, height: number): void; readPixels(): Uint8Array};
```

</details>

Local declaration: `packages/barocss-render-editor/src/scene-viewport.ts:7` at `5f5ad866205a`.

### DiagnosticsPanel {#diagnosticspanel}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function DiagnosticsPanel({controller, onError, onCorrectObject, objectCorrectionLabel = 'Edit object properties'}: RenderEditorPanelProps & {onCorrectObject?: () => void; objectCorrectionLabel?: string}): React.JSX.Element;
```

</details>

Local declaration: `packages/barocss-render-editor/src/react.tsx:122` at `5f5ad866205a`.

### MixedSceneViewport {#mixedsceneviewport}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function MixedSceneViewport({controller,onError,onCameraHelp}: RenderMixedEditorProps): React.JSX.Element;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-react.tsx:25` at `5f5ad866205a`.

### ObjectPanel {#objectpanel}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function ObjectPanel({controller}: RenderEditorPanelProps): React.JSX.Element;
```

</details>

Local declaration: `packages/barocss-render-editor/src/react.tsx:91` at `5f5ad866205a`.

### RenderEditor {#rendereditor}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function RenderEditor({controller, header, toolbar, onError, onAction, projectBrowser, onObjectHelp, onCameraHelp, navigationDisabled}: RenderEditorProps): React.JSX.Element;
```

</details>

Local declaration: `packages/barocss-render-editor/src/react.tsx:141` at `5f5ad866205a`.

### RenderEditorPanelProps {#rendereditorpanelprops}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorPanelProps {controller: RenderEditorController; onError?: (error: RenderEditorError) => void; onCameraHelp?: () => void; navigationDisabled?: boolean}
```

</details>

Local declaration: `packages/barocss-render-editor/src/react.tsx:17` at `5f5ad866205a`.

### RenderEditorProps {#rendereditorprops}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderEditorProps extends RenderEditorPanelProps {
  header?: ReactNode;
  toolbar?: ReactNode;
  onAction?: (action: 'new' | 'open' | 'save') => void;
  projectBrowser?: ReactNode;
  onObjectHelp?: () => void;
}
```

</details>

Local declaration: `packages/barocss-render-editor/src/react.tsx:18` at `5f5ad866205a`.

### RenderMixedEditor {#rendermixededitor}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function RenderMixedEditor({controller,onError,onCameraHelp,onSphereHelp,projectBrowser}: RenderMixedEditorProps): React.JSX.Element;
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-react.tsx:71` at `5f5ad866205a`.

### RenderMixedEditorProps {#rendermixededitorprops}

<details><summary>Show InterfaceDeclaration signature</summary>

```ts
export interface RenderMixedEditorProps {controller:RenderMixedController;onError?:(error:RenderMixedDocumentError)=>void;onCameraHelp?:()=>void;onSphereHelp?:()=>void;projectBrowser?:ReactNode}
```

</details>

Local declaration: `packages/barocss-render-editor/src/mixed-react.tsx:15` at `5f5ad866205a`.

### SceneViewport {#sceneviewport}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function SceneViewport({controller, onError, onCameraHelp, navigationDisabled = false}: RenderEditorPanelProps): React.JSX.Element;
```

</details>

Local declaration: `packages/barocss-render-editor/src/react.tsx:28` at `5f5ad866205a`.

### SourcePanel {#sourcepanel}

<details><summary>Show FunctionDeclaration signature</summary>

```ts
export function SourcePanel({controller, onError, onManualEdit, showApply = true}: RenderEditorPanelProps & {onManualEdit?: () => void; showApply?: boolean}): React.JSX.Element;
```

</details>

Local declaration: `packages/barocss-render-editor/src/react.tsx:75` at `5f5ad866205a`.

## @barocss/render-editor/style.css

Entry: `packages/barocss-render-editor/src/style.css`. declared development type entry.

Stylesheet entry. It has no JavaScript symbol namespace.

Local declaration paths and SHA record provenance. GitHub source links are exposed only when that exact commit is confirmed remotely. Reference extraction is not a registry, tarball, emitted-JS or browser acceptance result.
