import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadDocument } from '../../packages/barocss-cad-interop/dist/document.js';
import { loadBaroCadModelSet } from '../../packages/barocss-cad-interop/dist/model-set.js';

const canvas = document.querySelector('#view');
const output = document.querySelector('#status');
const viewer = createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.015, 0.02, 0.03] });
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 1,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const options = { native, basis: 'authored-xyz-matches-rhyup',
  bodyIds: ['body_1_surface', 'body_0_curve', 'body_1_curve', 'body_0_surface'] };
const poses = refs => ({ contextId: 'document-v1', timeSeconds: 1,
  poses: refs.map((ref, index) => ({ targetId: `body-${index}`,
    translation: [ref.modelId === 'asset.a' ? -8 : 8, 0, 0] })) });
const bindings = refs => refs.map((ref, index) =>
  ({ contextId: 'document-v1', targetId: `body-${index}`, ref }));
const poseDocument = refs => {
  viewer.applyGeometryMotionFrame(poses(refs), bindings(refs), { basis: 'part-xyz-matches-rhyup' });
  viewer.fit();
};

try {
  const result = await loadBaroCadDocument(new URL('/document.cad-document.json', location.href).href);
  const originalSource = result.document.assets.map(asset => asset.source);
  const blankBefore = viewer.getState();
  assert(blankBefore.status === 'empty' && result.document.bodies.length === 6,
    'Actual six-body document missing');
  viewer.loadDocument(result, options);
  const accepted = viewer.getState();
  assert(accepted.status === 'ready' && accepted.document?.document.documentId === 'document_gpu_v2'
    && accepted.document.document.revision === 5 && accepted.native === null
    && accepted.modelSet === null && accepted.surfaces.length === 2 && accepted.curves.length === 2,
  'Selected document scene missing');
  assert(JSON.stringify(accepted.document.document.assets.map(asset => asset.revision)) === '[2,7]'
    && JSON.stringify(accepted.documentBodies.map(value => value.binding.bodyId))
      === '["body_0_curve","body_0_surface","body_1_curve","body_1_surface"]',
  'Body order or revisions changed');
  assert(accepted.documentBodies.every(value =>
    value.binding.geometryId === (value.ref.kind === 'surface' ? value.ref.surfaceId : value.ref.curveId)
    && value.binding.nativeFrame === 'authored-xyz-no-axis-conversion'
    && value.binding.sourceFrame === 'authored-xyz-no-axis-conversion'
    && value.binding.documentRevision === 5
    && value.binding.assetRevision === (value.binding.assetId === 'asset-a' ? 2 : 7)
    && value.binding.modelId === 'authored_part'),
  'Original native geometry/frame binding changed');
  assert(originalSource.every(source => new TextEncoder().encode(source).length === 643)
    && accepted.document.compiledAssets.every(asset =>
      Object.is(asset.model.objects[0].controlPoints[0][1], -0)),
  'Original source or signed zero changed');
  assert(accepted.curves[0].modelId === 'asset.a' && accepted.curves[1].modelId === 'asset_b'
    && accepted.curves[0].curveId === accepted.curves[1].curveId
    && accepted.surfaces[0].surfaceId === accepted.surfaces[1].surfaceId,
  'Qualified duplicate original IDs changed');
  const copy = viewer.getState();
  copy.document.document.assets[0].source = 'caller-edited-copy';
  assert(viewer.getState().document.document.assets[0].source === originalSource[0],
    'State did not copy document source');
  const refs = accepted.documentBodies.map(value => value.ref);
  poseDocument(refs);
  const posedHash = hash(viewer.readPixels());
  const hits = new Map();
  for (let y = 6; y < canvas.height && hits.size < 4; y += 4) {
    for (let x = 6; x < canvas.width && hits.size < 4; x += 4) {
      const hit = viewer.pickGeometry({ xCss: x, yCss: y }, { curveTolerancePx: 4 });
      if (hit) hits.set(`${hit.kind}:${hit.ref.modelId}`, hit);
    }
  }
  assert(hits.size === 4, `Expected four selected body screen hits: ${[...hits.keys()].join(', ')}`);
  const secondCurve = hits.get('curve:asset_b');
  const resolvedBody = viewer.getState().documentBodies.find(value =>
    value.ref.kind === 'curve' && value.ref.modelId === secondCurve.ref.modelId
      && value.ref.curveId === secondCurve.ref.curveId);
  assert(resolvedBody?.binding.bodyId === 'body_1_curve', 'Screen ref did not resolve to original body');
  viewer.selectGeometry({ kind: 'curve', ...secondCurve.ref });
  const selectedHash = hash(viewer.readPixels());
  assert(selectedHash !== posedHash && viewer.getState().selectedGeometry?.modelId === 'asset_b',
    'Document Curve selection failed');
  viewer.fitGeometry({ kind: 'surface', ...hits.get('surface:asset.a').ref });
  const singleCamera = viewer.getState().camera;
  viewer.fit();
  assert(JSON.stringify(singleCamera) !== JSON.stringify(viewer.getState().camera),
    'One selected document body fit did not differ');
  const same = viewer.measureNativeCurvePoints(
    { modelId: 'asset_b', curveId: 'guide_path_native', t: -3 },
    { modelId: 'asset_b', curveId: 'guide_path_native', t: 7 });
  assert(same.distanceMM > 0 && same.space === 'native-authored', 'Same-asset native distance failed');
  const hidden = viewer.measureNativeCurvePoints(
    { modelId: 'asset.a', curveId: 'skip_path_native', t: 0 },
    { modelId: 'asset.a', curveId: 'skip_path_native', t: 1 });
  assert(hidden.distanceMM > 0 && !accepted.documentBodies.some(value =>
    value.binding.geometryId === 'skip_path_native'),
  'Hidden native object in a selected asset lost inspection');
  let crossRefused = false;
  try {
    viewer.measureNativeCurvePoints(
      { modelId: 'asset.a', curveId: 'guide_path_native', t: -3 },
      { modelId: 'asset_b', curveId: 'guide_path_native', t: 7 });
  } catch { crossRefused = true; }
  assert(crossRefused, 'Cross-asset native distance accepted');
  const beforeInvalid = viewer.getState(), pixelsBeforeInvalid = hash(viewer.readPixels());
  let badBodyRefused = false, badBasisRefused = false;
  try { viewer.loadDocument(result, { ...options, bodyIds: ['missing_body'] }); }
  catch { badBodyRefused = true; }
  try { viewer.loadDocument(result, { ...options, basis: 'authored-xyz-no-axis-conversion' }); }
  catch { badBasisRefused = true; }
  assert(badBodyRefused && badBasisRefused
    && JSON.stringify(viewer.getState()) === JSON.stringify(beforeInvalid)
    && hash(viewer.readPixels()) === pixelsBeforeInvalid,
  'Invalid document candidate changed accepted scene');
  viewer.clear();
  assert(viewer.getState().status === 'empty' && viewer.getState().document === null
    && viewer.getState().documentBodies.length === 0, 'Clear retained document state');
  const blankHash = hash(viewer.readPixels());
  viewer.loadNative(originalSource[0], { sourceVersion: 0, countU: 8, countV: 8,
    curveDisplay: native.curveDisplay });
  assert(viewer.getState().native?.model.name === 'authored_part'
    && viewer.getState().document === null, 'Legacy single-source load changed');
  viewer.clear();
  const modelSet = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0,
    entries: [{ aliasId: 'asset_a', url: 'model-a.barocad', options: native },
      { aliasId: 'asset-b', url: 'model-b.barocad', options: native }] },
  { baseURL: location.href });
  viewer.loadModelSet(modelSet);
  assert(viewer.getState().modelSet?.entries.length === 2
    && viewer.getState().document === null, 'Legacy qualified model-set load changed');
  viewer.clear();
  viewer.loadDocument(result, options);
  const restored = viewer.getState();
  assert(restored.documentBodies.length === 4 && restored.selectedGeometry === null
    && restored.nativeMeasurement === null, 'Document replacement did not reset state');
  poseDocument(refs);
  window.viewerDocumentProof = { ok: true, documentBytes: new TextEncoder().encode(
    await (await fetch('/document.cad-document.json')).text()).length,
    sourceBytes: originalSource.map(source => new TextEncoder().encode(source).length),
    documentId: restored.document.document.documentId, documentRevision: restored.document.document.revision,
    assetRevisions: restored.document.document.assets.map(asset => asset.revision),
    bodyIds: restored.documentBodies.map(value => value.binding.bodyId),
    refs: restored.documentBodies.map(value => value.ref), hitKinds: [...hits.keys()],
    resolvedBody: resolvedBody.binding.bodyId, posedHash, selectedHash, blankHash,
    sameAssetDistanceMM: same.distanceMM, hiddenNativeDistanceMM: hidden.distanceMM,
    crossRefused, badBodyRefused, badBasisRefused,
    retainedHash: pixelsBeforeInvalid, singleSourceAndModelSetCompatible: true };
  output.textContent = JSON.stringify(window.viewerDocumentProof, null, 2);
} catch (error) {
  window.viewerDocumentProof = { ok: false, error: error.stack || error.message };
  output.textContent = JSON.stringify(window.viewerDocumentProof, null, 2);
}
