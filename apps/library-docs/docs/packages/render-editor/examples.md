# Render Editor: original scene source and accepted presentation

A source document stores original GPU Scene text and camera. The session holds drafts/history. The controller presents prepared changes before committing authoring. Rendered pixels and compiler buffers are derived output, not saved scene authority.

Use the workspace package with a TypeScript-capable host. `/react` requires a compatible React 19.2.3 peer and a browser. This package is separate from the React screen-spec renderer in [Render](/packages/render/).

## Create a complete source document

```ts
import { createRenderEditorSession, editRenderSceneObjectSource } from '@barocss/render-editor';
import type { RenderSceneDocumentV0 } from '@barocss/render-editor';

const sceneDocument: RenderSceneDocumentV0 = {
  format: 'barocss-render-editor', version: 0, kind: 'gpu-scene',
  documentId: 'sphere_document', title: 'Sphere', revision: 0, sourceVersion: 1,
  sceneSource: `@scene sphere_demo {
    version: 1; background: #161c22; sphere #orb;
  }
  #orb { radius: .75; translate: 0 0 0; color: #72c8bb; }`,
  camera: { eye: [0, 1.3, 8], target: [0, 0, 0], up: [0, 1, 0],
    fovYDegrees: 45, near: 0.01, far: 100 },
};
const session = createRenderEditorSession(sceneDocument);
const nextSource = editRenderSceneObjectSource(sceneDocument.sceneSource, 'orb', { radius: 1 });
session.setDraftSource(nextSource);
```

The public source editor uses the actual compiler AST/effective properties. `orb` remains the original object ID. The change stages radius 1 scene unit without accepting it yet. No-op effective edits preserve original bytes. This is original source editing, not a mesh or transform-gizmo operation.

## Mount and apply through the controller

The host supplies a container with a defined workspace size and its ordinary TSX entry:

```html
<div id="root" style="height:760px"></div>
<script type="module" src="./main.tsx"></script>
```

Use the session from the complete document above:

```tsx
import { createRoot } from 'react-dom/client';
import { createRenderEditorController } from '@barocss/render-editor';
import { RenderEditor } from '@barocss/render-editor/react';
import '@barocss/render-editor/style.css';

const controller = createRenderEditorController(session);
const root = createRoot(document.getElementById('root')!);
root.render(<RenderEditor controller={controller} onError={console.error}
  onAction={action => console.log('Host file request:', action)} />);
window.addEventListener('pagehide', () => {
  root.unmount(); controller.dispose(); session.dispose();
}, { once: true });
```

The viewport attaches the public GPU presenter. A host control can request Apply after that viewport has mounted:

```ts
const outcome = controller.apply('both');
if (!outcome.ok) console.error(outcome.error);
```

Apply compiles/prepares the complete draft, presents it, then commits the session. A successful radius edit advances accepted revision to1. The controller's `presentedRevision` is separate from accepted revision; inspect both when diagnosing a failed display.

Invalid source or camera does not overwrite accepted authoring/history. A later presentation failure can require compensation or explicit recovery. Context loss can make presentation unavailable while CPU authoring remains retained. Check the controller action's ok/error result instead of treating preparation as acceptance. Mounting this component in a new host remains a host integration task; the GPU image below does not certify its file/history/recovery behavior.

## Serialize source, not rendered output

```ts
import { serializeRenderEditorDocument, parseRenderEditorDocument,
  inspectRenderSceneObjects } from '@barocss/render-editor';
const accepted = session.getSnapshot().accepted;
const saved = serializeRenderEditorDocument(accepted);
const reopened = parseRenderEditorDocument(saved);
console.log(inspectRenderSceneObjects(reopened.sceneSource));
```

After successful Apply, the reopened effective `orb` radius is1. The file retains original source and camera; it does not contain IR, GLSL, GPU buffers or screenshots. The host owns download, file reading, cancellation and saved-status policy. Resolve drafts before replacement and preserve accepted data on a refused Open.

Temporary camera previews also remain separate from authoring. Use view stages the chosen camera and runs complete Apply; Cancel view restores accepted presentation and retains drafts. Hidden invalid fields can block Use view. Dispose controller/presenter resources and caller-owned sessions when closing the document.

## Interpret a scene image and a mixed document

![GPU Scene output from the interactive example](/examples/gpu-scene.png)

The [GPU Scene example](/playground#gpu-scene) renders original Source1 input through the GPU package. This image shows the render path the editor orchestrates; it is not an editor Save/Open or recovery result.

A version 1 mixed document is a separate profile with one original Sphere scene and one selected native CAD Surface. Sphere fields rewrite scene source; Surface placement transforms display geometry after the explicit mm-to-scene conversion. Complete original native source/weights/knots/IDs remain separate. A native Surface point query uses original U/V and returns mm, not a screen pick. See the [mixed editing guide](./guides#prepare-a-mixed-document) for the complete boundary.
