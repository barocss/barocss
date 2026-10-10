# Create an authored GPU scene session

Use a TypeScript-capable workspace host. This headless example accepts an authored empty Source1 scene. It does not mount a GPU framebuffer.

```ts
import { createRenderEditorSession, serializeRenderEditorDocument } from '@barocss/render-editor';
import type { RenderSceneDocumentV0 } from '@barocss/render-editor';

const document: RenderSceneDocumentV0 = {
  format: 'barocss-render-editor', version: 0, kind: 'gpu-scene',
  documentId: 'scene_one', title: 'Scene one', revision: 0, sourceVersion: 1,
  sceneSource: '@scene scene_one { version: 1; background: #161c22; }',
  camera: {
    eye: [0, 1.3, 8], target: [0, 0, 0], up: [0, 1, 0],
    fovYDegrees: 45, near: 0.01, far: 100,
  },
};
const session = createRenderEditorSession(document);
try {
  session.setDraftSource('@scene scene_one { version: 1; background: #24313b; }');
  const candidate = session.prepareDraft('source');
  session.commitPrepared(candidate); // Explicit CPU-only acceptance.
  const saved = serializeRenderEditorDocument(session.getSnapshot().accepted);
  console.log(saved);
} finally { session.dispose(); }
```

For a visible editor, mount `RenderEditor` with a controller and real presenter as shown in [the guide](./guides#mount-a-visible-editor). In that path, only successful presentation authorizes the controller's accepted transaction. Headless acceptance does not prove a displayed frame.

Save the serialized original document, not compiler IR, GLSL or a screen image. The host owns file download and the meaning of saved status.

[Manifest and version](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/package.json) · [Package task notes](https://github.com/barocss/barocss/blob/5f5ad866205a21510ac69552e704cc162fa253b5/packages/barocss-render-editor/README.md)
