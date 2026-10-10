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
