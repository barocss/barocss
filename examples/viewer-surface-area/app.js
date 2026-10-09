import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadDocument } from '../../packages/barocss-cad-interop/dist/document.js';
import { createCadGeometryReference, queryCadDocumentSurfaceArea,
  validateCadDocumentSurfaceArea } from '../../packages/barocss-cad/dist/index.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const canvas = document.querySelector('#view');
const label = document.querySelector('#length');
const status = document.querySelector('#status');
const contexts = new Set(), browserErrors = [], resources = {};
window.addEventListener('error', event => browserErrors.push(event.message));
window.addEventListener('unhandledrejection', event => browserErrors.push(String(event.reason)));
const getContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
  const context = getContext.call(this, kind, ...args);
  if (kind === 'webgl2' && context) contexts.add(context);
  return context;
};
for (const type of ['Buffer', 'Program', 'VertexArray', 'Framebuffer', 'Texture', 'Renderbuffer', 'Shader']) {
  const live = new Set(), prototype = WebGL2RenderingContext.prototype;
  resources[type] = live;
  const create = prototype[`create${type}`], remove = prototype[`delete${type}`];
  prototype[`create${type}`] = function (...args) {
    const value = create.apply(this, args);
    if (value) live.add(value);
    return value;
  };
  prototype[`delete${type}`] = function (value) {
    live.delete(value);
    return remove.call(this, value);
  };
}

const areaOptions = { region: null, absoluteToleranceMM2: 1e-6, relativeTolerance: 1e-8,
  maximumEvaluations: 16384, maximumSubdivisions: 128, maximumDepth: 8 };
const request = { native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001 },
  basis: 'authored-xyz-matches-rhyup', bodyIds: ['plane_body'] };
let viewer;
try {
  const documents = await Promise.all([1, 2].map(revision =>
    loadBaroCadDocument(new URL(`/document/${revision}`, location.href).href)));
  const measurements = documents.map((cad, index) => {
    const { reference } = createCadGeometryReference(cad, { bodyId: 'plane_body' });
    const area = queryCadDocumentSurfaceArea(cad, reference, areaOptions);
    const source = cad.document.assets.find(asset => asset.id === reference.assetId)?.source;
    assert(reference.documentId === 'surface_area_doc' && reference.documentRevision === index + 1
      && reference.bodyId === 'plane_body' && reference.assetId === 'asset_0'
      && reference.assetRevision === index + 1 && reference.geometryId === 'plane_nonunit'
      && area.source === source && same(validateCadDocumentSurfaceArea(cad, area), area.report)
      && same(area.report.originalDomains, { u: [-3, 7], v: [2, 5] })
      && same(area.report.region, { u: [-3, 7], v: [2, 5] })
      && area.report.criterion === 'aggregate-cell-estimator-not-certified-upper-bound'
      && area.report.quality.globalErrorCertified === false
      && Math.abs(area.areaEstimateMM2 - [6, 12][index]) < 1e-7
      && area.errorEstimateMM2 >= 0
      && Object.is(area.geometry.controlPoints[0][0][2], -0),
    `Original revision ${index + 1} Surface area was not validated`);
    return { cad, reference, area, source };
  });
  viewer = createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.015, 0.02, 0.03] });
  let current = null;
  const checkBinding = () => {
    const state = viewer.getState();
    const body = state.documentBodies[0];
    assert(state.status === 'ready' && state.surfaces.length === 1 && state.curves.length === 0
      && state.documentBodies.length === 1 && body.ref.kind === 'surface'
      && body.binding.documentId === current.reference.documentId
      && body.binding.documentRevision === current.reference.documentRevision
      && body.binding.bodyId === current.reference.bodyId
      && body.binding.assetId === current.reference.assetId
      && body.binding.assetRevision === current.reference.assetRevision
      && body.binding.geometryId === current.reference.geometryId
      && body.ref.surfaceId === current.reference.geometryId,
    'Viewer scene does not match the current original Surface area reference');
    return body.ref;
  };
  const areaLabel = () => `Native unposed Surface area estimate: ${current.area.areaEstimateMM2.toFixed(6)} mm² · ` +
    `heuristic estimator: ${current.area.errorEstimateMM2.toExponential(3)} mm² · ` +
    `original U[-3, 7] V[2, 5] · document revision ${current.reference.documentRevision} · global error not certified`;
  const positionLabel = () => {
    const ref = checkBinding();
    const anchor = viewer.projectNativePoint({ ...ref, u: 2, v: 3.5 });
    if (anchor === null) { label.style.display = 'none'; return null; }
    label.textContent = areaLabel();
    label.style.left = `${anchor.xCss}px`;
    label.style.top = `${anchor.yCss}px`;
    label.style.display = 'block';
    return anchor;
  };
  const adopt = candidate => {
    validateCadDocumentSurfaceArea(candidate.cad, candidate.area);
    viewer.loadDocument(candidate.cad, request);
    current = candidate;
    viewer.fit();
    return positionLabel();
  };
  const firstAnchor = adopt(measurements[0]);
  const initialHash = hash(viewer.readPixels());
  assert(firstAnchor && firstAnchor.documentBody?.bodyId === 'plane_body'
    && firstAnchor.xCss >= 0 && firstAnchor.xCss <= canvas.clientWidth
    && firstAnchor.yCss >= 0 && firstAnchor.yCss <= canvas.clientHeight
    && firstAnchor.approximate === true && firstAnchor.occlusion === 'not-tested'
    && label.style.display === 'block', 'Original Surface or caller label was not visible');
  const originalArea = JSON.stringify(measurements[0].area);
  let hit = null;
  for (let y = 4; y < canvas.height && !hit; y += 4) {
    for (let x = 4; x < canvas.width && !hit; x += 4) {
      hit = viewer.pickGeometry({ xCss: x, yCss: y });
    }
  }
  assert(hit?.kind === 'surface' && same(hit.ref, { modelId: checkBinding().modelId,
    surfaceId: checkBinding().surfaceId }), 'Qualified Surface had no screen hit');
  viewer.pan(0.03, 0.01);
  const cameraAnchor = positionLabel();
  assert(cameraAnchor && Math.abs(cameraAnchor.xCss - firstAnchor.xCss) > 0.1
    && same(cameraAnchor.point.pointMM, firstAnchor.point.pointMM)
    && Math.abs(parseFloat(label.style.left) - cameraAnchor.xCss) < 0.1,
  'Caller label did not follow the camera');
  const ref = checkBinding();
  const beforeSelectionHash = hash(viewer.readPixels());
  viewer.selectGeometry(ref);
  const selectedHash = hash(viewer.readPixels());
  assert(selectedHash !== beforeSelectionHash && same(viewer.getState().selectedGeometry, ref),
    'Surface selection did not update Viewer display');
  viewer.applyGeometryMotionFrame({ contextId: 'surface-area', timeSeconds: 1,
    poses: [{ targetId: 'plane', translation: [0.3, 0, 0], scale: [1.5, 0.75, 1] }] },
  [{ contextId: 'surface-area', targetId: 'plane', ref }],
  { basis: 'part-xyz-matches-rhyup' });
  const posedAnchor = positionLabel();
  const posedHash = hash(viewer.readPixels());
  assert(posedAnchor && Math.abs(posedAnchor.xCss - cameraAnchor.xCss) > 1
    && same(posedAnchor.point.pointMM, firstAnchor.point.pointMM)
    && JSON.stringify(measurements[0].area) === originalArea
    && label.textContent.includes('6.000000 mm²') && posedHash !== selectedHash,
  'Display pose changed original area or did not move the caller label');

  const secondAnchor = adopt(measurements[1]);
  const revision2Hash = hash(viewer.readPixels());
  assert(secondAnchor && viewer.getState().document.document.revision === 2
    && label.textContent.includes('12.000000 mm²')
    && label.textContent.includes('document revision 2')
    && JSON.stringify(measurements[0].area) === originalArea
    && measurements[0].source === documents[0].document.assets.find(asset => asset.id === 'asset_0').source
    && revision2Hash !== posedHash,
  'Current revision 2 area, scene or caller label did not replace revision 1');
  const stableState = viewer.getState(), stableHash = revision2Hash;
  const stableLabel = label.textContent, stablePosition = [label.style.left, label.style.top];
  const candidates = [
    () => queryCadDocumentSurfaceArea(documents[1], measurements[0].reference, areaOptions),
    () => createCadGeometryReference(documents[1], { bodyId: 'missing_body' }),
    () => queryCadDocumentSurfaceArea(documents[1], measurements[1].reference,
      { ...areaOptions, region: { u: [7, -3], v: [2, 5] } }),
    () => validateCadDocumentSurfaceArea(documents[1],
      { ...measurements[1].area, areaEstimateMM2: 999 }),
    () => viewer.projectNativePoint({ ...checkBinding(), modelId: 'foreign', u: 2, v: 3.5 }),
  ];
  let refused = 0;
  for (const candidate of candidates) {
    try { candidate(); } catch { refused++; }
  }
  assert(refused === candidates.length && same(viewer.getState(), stableState)
    && hash(viewer.readPixels()) === stableHash && label.textContent === stableLabel
    && same([label.style.left, label.style.top], stablePosition)
    && measurements[1].source === documents[1].document.assets.find(asset => asset.id === 'asset_0').source,
  'Invalid area or projection candidate changed accepted state, source, label or pixels');

  viewer.setVisibleGeometry([]);
  let hiddenRefused = false;
  try { viewer.projectNativePoint({ ...ref, u: 2, v: 3.5 }); }
  catch { hiddenRefused = true; label.style.display = 'none'; }
  assert(hiddenRefused && label.style.display === 'none' && viewer.getState().status === 'ready',
    'Hidden Surface retained a caller label anchor');
  viewer.setVisibleGeometry([checkBinding()]);
  assert(positionLabel() !== null, 'Restored Surface did not restore the label');
  viewer.clear();
  label.style.display = 'none';
  label.textContent = '';
  let clearedRefused = false;
  try { viewer.projectNativePoint({ ...ref, u: 2, v: 3.5 }); }
  catch { clearedRefused = true; }
  assert(clearedRefused && viewer.getState().status === 'empty'
    && viewer.getState().document === null && label.style.display === 'none',
  'Clear retained the old Surface or label');
  viewer.dispose(); viewer.dispose();
  const remaining = Object.fromEntries(Object.entries(resources).map(([type, live]) => [type, live.size]));
  const glError = [...contexts][0]?.getError();
  assert(contexts.size === 1 && contexts.has(getContext.call(canvas, 'webgl2'))
    && glError === 0 && Object.values(remaining).every(count => count === 0)
    && document.querySelectorAll('canvas').length === 1 && document.body.contains(canvas)
    && browserErrors.length === 0,
  `WebGL2 or disposal failed: ${JSON.stringify({ contexts: contexts.size, glError, remaining, browserErrors })}`);
  const result = { ok: true, references: measurements.map(value => value.reference),
    areaMM2: measurements.map(value => value.area.areaEstimateMM2),
    estimatorMM2: measurements.map(value => value.area.errorEstimateMM2),
    originalDomains: measurements[0].area.report.originalDomains,
    criterion: measurements[1].area.report.criterion,
    globalErrorCertified: measurements[1].area.report.quality.globalErrorCertified,
    initialHash, beforeSelectionHash, selectedHash, posedHash, revision2Hash,
    firstAnchor: { xCss: firstAnchor.xCss, yCss: firstAnchor.yCss },
    cameraAnchor: { xCss: cameraAnchor.xCss, yCss: cameraAnchor.yCss },
    posedAnchor: { xCss: posedAnchor.xCss, yCss: posedAnchor.yCss },
    secondAnchor: { xCss: secondAnchor.xCss, yCss: secondAnchor.yCss },
    refused, hiddenRefused, clearedRefused, contextCount: contexts.size,
    glError, remaining, browserErrors,
    limits: 'Two actual canonical revisions of one unposed parametric Surface; local Chromium WebGL2; estimator is heuristic and global error is not certified.' };
  viewer = createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.015, 0.02, 0.03] });
  const restoredAnchor = adopt(measurements[1]);
  assert(restoredAnchor && contexts.size === 1 && hash(viewer.readPixels()) !== 0,
    'Visible revision 2 Surface did not return after teardown');
  result.restoredScene = true;
  window.addEventListener('pagehide', () => viewer.dispose(), { once: true });
  window.viewerSurfaceAreaProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  const recorded = await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
  assert(recorded.ok, 'Browser result was not recorded');
} catch (error) {
  viewer?.dispose();
  const result = { ok: false, error: error.stack || error.message, browserErrors };
  window.viewerSurfaceAreaProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  try { await fetch('/result', { method: 'POST', body: JSON.stringify(result) }); } catch { /* server failed */ }
}
