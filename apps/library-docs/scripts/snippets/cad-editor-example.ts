import { parseCadDocument, evaluateSurface } from '@barocss/cad';
import { parseBaroCadSource } from '@barocss/cad-interop/native';
import { createCadEditorSession, CadEditorError } from '@barocss/cad-editor';
const source = `@model panel_demo {
  version: 0; length-unit: mm;
  @surface #panel {
    type: nurbs; degree-u: 1; degree-v: 1;
    knots-u: [0,0,1,1]; knots-v: [0,0,1,1];
    control-points: [[[0,0,0],[0,0,40]],[[100,0,0],[100,0,40]]];
    weights: [[1,1],[1,1]];
  }
}`;
const text = JSON.stringify({ schema: 'barocss-cad-document', version: 1,
  profile: 'direct-geometry', documentId: 'panel_document', revision: 0,
  units: { length: 'mm', angle: 'rad' }, nativeFrame: 'authored-xyz-no-axis-conversion',
  assets: [{ id: 'panel_asset', revision: 0, role: 'authored-native-source',
    sourceVersion: 0, sourceFrame: 'authored-xyz-no-axis-conversion', source }],
  bodies: [{ id: 'panel_body', name: 'Panel', kind: 'direct-geometry-object',
    assetId: 'panel_asset', geometryId: 'panel' }],
  features: [], parameters: [], constraints: [], placements: [], derivedCaches: [] });
const session = createCadEditorSession(parseCadDocument(text).document);
try {
  session.selectSurfacePole({ bodyId: 'panel_body', uIndex: 1, vIndex: 1 });
  session.stageSurfacePoleField('zMM', '60');
  const before = session.getSnapshot().accepted.document.revision;
  const candidate = session.prepareApply();
  if (!candidate) throw new Error('Expected effective candidate');
  session.acceptCandidate(candidate.token); // CPU-only acceptance, no Viewer frame claim.
  const accepted = session.getSnapshot().accepted.document;
  session.stageSurfacePoleField('zMM', 'not-a-number');
  let refused = '';
  try { session.prepareApply(); }
  catch (error) { if (!(error instanceof CadEditorError)) throw error; refused = error.code; }
  const native = parseBaroCadSource(accepted.assets[0].source, {
    sourceVersion: 0, countU: 3, countV: 3, unitsPerMillimeter: 1 });
  const surface = native.model.objects.find(object => object.kind === 'surface');
  if (!surface || surface.kind !== 'surface') throw new Error('Expected accepted native Surface');
  const cornerMM = evaluateSurface(surface, 1, 1);
  if (cornerMM[0] !== 100 || cornerMM[1] !== 0 || cornerMM[2] !== 60) throw new Error('Native coefficient edit missing');
  const capture = session.serializeAccepted();
  const reopened = createCadEditorSession(parseCadDocument(capture.text).document);
  try {
    if (accepted.revision !== before + 1 || !refused || reopened.getSnapshot().accepted.document.revision !== accepted.revision) throw new Error('Unexpected native edit');
    console.log(JSON.stringify({ task: 'cad-editor-native-edit', beforeRevision: before,
      acceptedRevision: accepted.revision, assetRevision: accepted.assets[0].revision,
      bodyId: accepted.bodies[0].id, cornerMM, refused,
      reopenedRevision: reopened.getSnapshot().accepted.document.revision,
      rendered: false }, null, 2));
  } finally { reopened.dispose(); }
} finally { session.dispose(); }
