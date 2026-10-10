# Render Editor: source edits, saved authority and displayed frames

## Task 1 — edit an original Sphere radius and roundtrip its source

Run from the repository root with Node 22+ and the existing app-local esbuild runtime. The runner reads ordinary public source export maps and transforms TypeScript; it does not install or publish packages.

```sh
node apps/library-docs/scripts/run-example.mjs apps/library-docs/scripts/snippets/render-editor-example.ts
```

The complete runnable file is shown below. Its expected values come from the fixed API and inputs. This CPU command succeeded on Node22.22.0 at the fixed source pin in #1270. Its native receipt records the actual output and zero own dist inputs. A successful CPU task does not prove browser pixels.


```ts
import { createRenderEditorSession, serializeRenderEditorDocument,
  parseRenderEditorDocument, inspectRenderSceneObjects, editRenderSceneObjectSource,
  RenderEditorError } from '@barocss/render-editor';
import type { RenderSceneDocumentV0 } from '@barocss/render-editor';
const source = `@scene sphere_demo { version: 1; background: #161c22; sphere #orb; }
#orb { radius: .75; translate: 0 0 0; color: #72c8bb; }`;
const document: RenderSceneDocumentV0 = { format: 'barocss-render-editor', version: 0,
  kind: 'gpu-scene', documentId: 'sphere_document', title: 'Sphere example',
  revision: 0, sourceVersion: 1, sceneSource: source,
  camera: { eye: [0, 1.3, 8], target: [0, 0, 0], up: [0, 1, 0],
    fovYDegrees: 45, near: 0.01, far: 100 } };
const session = createRenderEditorSession(document);
try {
  const nextSource = editRenderSceneObjectSource(source, 'orb', { radius: 1 });
  session.setDraftSource(nextSource);
  const candidate = session.prepareDraft('source');
  session.commitPrepared(candidate); // Explicit CPU-only acceptance.
  const accepted = session.getSnapshot().accepted;
  const reopened = parseRenderEditorDocument(serializeRenderEditorDocument(accepted));
  session.setDraftSource('not a scene');
  let refused = '';
  try { session.prepareDraft('source'); }
  catch (error) { if (!(error instanceof RenderEditorError)) throw error; refused = error.code; }
  if (accepted.revision !== 1 || inspectRenderSceneObjects(reopened.sceneSource)[0].radius !== 1 || refused !== 'SOURCE_REFUSED') throw new Error('Unexpected source edit');
  console.log(JSON.stringify({ task: 'render-editor-source-edit', acceptedRevision: accepted.revision,
    radius: inspectRenderSceneObjects(reopened.sceneSource)[0].radius,
    byteExactRoundtrip: reopened.sceneSource === accepted.sceneSource, refused,
    retainedRevision: session.getSnapshot().accepted.revision, rendered: false }, null, 2));
} finally { session.dispose(); }
```

The complete input is version0 `gpu-scene`, original Source1 text and an explicit camera. Sphere `orb` initially has radius0.75 scene units and no translation. The public AST editor changes its effective radius to1. The session stages that returned source; headless preparation and acceptance advances authoring to revision1.

Expect `acceptedRevision:1`, `radius:1`, `byteExactRoundtrip:true` and `rendered:false`. Serializing/parsing preserves the exact accepted original source string. Proposing `not a scene` gives `SOURCE_REFUSED` and `retainedRevision:1`. The invalid source remains draft data for correction; it does not replace accepted authoring/history.

## Task 2 — present a supported source edit and reopen a real file

Start the existing source-capable React app with its declared workspace dependencies:

```sh
pnpm --filter @barocss/render-editor-app dev
```

Open the printed source-mode URL. Its default Primitive study comes from `apps/render-editor/src/fixtures.ts`: `orb` radius0.75, `block` size1.25×1.5×1.25 and `post` radius0.48/height1.8. Select Sphere `orb`, enter radius1, then Apply. Resolve temporary camera navigation with Use view or Cancel view before file/history actions.

Expect the complete accepted source to contain the changed effective Sphere radius and a successful current presented revision. Both other objects remain source-authoritative. Undo restores the preceding authored radius; Redo reapplies it. Save a real version0 file, Open it in a fresh app, and inspect radius1 and the preserved camera. Do not save GPU IR/GLSL/buffers or treat a screenshot as editable scene authority.

Controller Apply returns an ok/error result. A refused source/camera presentation keeps accepted authoring/history. Failed compensation or context loss marks the display unavailable; explicit recovery reconstructs the accepted scene. The host owns files/routes/session disposal and download status.

## Related actual image

![Actual playground GPU scene rendering](/examples/gpu-scene.png)

This [playground image](/playground) shows the public GPU Scene render path that Render Editor orchestrates. It was captured from the playground, not from this React workbench or its saved-file/history protocol. The playground sample can differ from Primitive study; read its adjacent original input. No CAD editing, picking or editor recovery result follows from that image.

For the separate version1 one-Sphere/one-native-Surface task, use `apps/render-editor/src/mixed-fixtures.ts` and `apps/render-editor/README.md`. Native Surface scene-unit placement is display authoring; Sphere fields rewrite original scene source.

Source pin: `5f5ad866205a21510ac69552e704cc162fa253b5`. Public declarations: [API](./api) · [Exact public reference](./reference). Read [limits and errors](./limits) before changing the input profile.
