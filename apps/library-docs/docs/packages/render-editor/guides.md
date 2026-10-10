# Apply whole source and camera transactions

## Mount a visible editor

```tsx
import type { RenderEditorSession } from '@barocss/render-editor';
import { createRenderEditorController } from '@barocss/render-editor';
import { RenderEditor } from '@barocss/render-editor/react';
import '@barocss/render-editor/style.css';

// session is a caller-owned validated session.
const mountEditor = (session: RenderEditorSession) => {
  const controller = createRenderEditorController(session);
  return { controller, view: <RenderEditor controller={controller} onError={console.error} /> };
};
```

The React viewport attaches the real source1 GPU presenter. Give the host a defined workspace size. The host owns menus/routes/files and disposes the controller/session when closed. Viewport unmount releases its owned rendering resources, preserving caller CPU authoring.

## Separate draft, preparation and accepted display

Session setters stage source/camera. `prepareDraft('source'|'camera'|'both')` compiles and creates a session-bound candidate. Controller `apply()` presents it before authoring/history acceptance and returns `{ok:true}` or `{ok:false,error}`. Check the returned result.

`presentedRevision` is separate from accepted document revision. A direct headless commit while attached makes explicit recovery necessary before the next visible transaction. Source Apply uses source update; camera Apply uses camera update. Combined changes need compensating recovery if the later update refuses. Failed recovery keeps CPU authority and marks presentation unavailable.

## Edit objects without rewriting unrelated source

`inspectRenderSceneObjects` reads effective public compiler results. `editRenderSceneObjectSource`, `addRenderSceneObjectSource` and `removeRenderSceneObjectSource` use the actual compiler AST and original source ranges. Stage returned source through the session, then Apply the complete draft. Byte-equal effective edits preserve source. Incomplete object input is retained separately through `setDraftObjectSource(null)` and blocks whole Apply/file decisions.

## Navigate a temporary camera

`previewCamera(camera)` presents the accepted source with a temporary camera. It is not authored history or saved state. Use view restores accepted presentation, stages the chosen camera and runs complete Apply once. Cancel view restores accepted presentation and retains drafts. Resolve the preview before file/history/authoring actions. Invalid hidden fields can refuse Use view.

## Prepare a mixed document

```ts
import { parseRenderMixedDocument, prepareRenderMixedDocument,
  serializeRenderMixedDocument } from '@barocss/render-editor';
const qualifyFile = (text: string) => {
  const document = parseRenderMixedDocument(text);
  const prepared = prepareRenderMixedDocument(document);
  return serializeRenderMixedDocument(prepared.document);
};
```

The codec validates schema. Preparation separately compiles both complete original sources, resolves the selected original model/Surface and produces the bounded shared-depth frame. Preserve hidden native inventory and declared source association. Surface placement is original CAD mm × scene units/mm, then authored translation in scene units; this is display placement, not native coefficient editing.

Use `createRenderMixedSession`/`createRenderMixedController` and `RenderMixedEditor` for actual mixed authoring. Native import requires an explicit original Surface choice. Sphere source edits and native Surface display position remain different drafts. `queryRenderMixedSurfacePoint(document,u,v)` queries the applied original Surface in millimetres at original parameters; it is not a rendered pick.

## Own Save/Open and recovery

Serialize accepted authority after resolving pending drafts with Apply/Discard/Cancel. Keep file-read staleness, cancellation and download status in the host. Explicit controller recovery reconstructs the accepted frame through the current provider. Old pixels are not promised after context loss. CPU retained state, current provider frame recovery and actual disk persistence are separate facts.

`packages/barocss-render-editor/package.json` (Manifest and version; local source) · `packages/barocss-render-editor/README.md` (Package task notes; local source)
