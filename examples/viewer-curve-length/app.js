import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadDocument } from '../../packages/barocss-cad-interop/dist/document.js';
import { createCadGeometryReference, queryCadDocumentCurveArcLength,
  validateCadDocumentCurveArcLength } from '../../packages/barocss-cad/dist/index.js';

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

const cadOptions = { interval: null, absoluteToleranceMM: 1e-7, relativeTolerance: 1e-8,
  maximumEvaluations: 4096, maximumSubdivisions: 128, maximumDepth: 12 };
const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const request = { native, basis: 'authored-xyz-matches-rhyup', bodyIds: ['quarter_body'] };
let viewer;
try {
  const cad = await loadBaroCadDocument(new URL('/document', location.href).href);
  const source = cad.document.assets.find(asset => asset.id === 'quarter_asset').source;
  const { reference } = createCadGeometryReference(cad, { bodyId: 'quarter_body' });
  const length = queryCadDocumentCurveArcLength(cad, reference, cadOptions);
  const originalLength = JSON.stringify(length);
  assert(reference.documentId === 'arc_length_doc' && reference.documentRevision === 1
    && reference.bodyId === 'quarter_body' && reference.assetId === 'quarter_asset'
    && reference.assetRevision === 1 && reference.geometryId === 'quarter_original'
    && length.source === source && same(validateCadDocumentCurveArcLength(cad, length), length.report)
    && same(length.report.interval, [0, 1])
    && length.report.criterion === 'aggregate-panel-estimator-not-certified-upper-bound'
    && length.report.quality.globalErrorCertified === false
    && Math.abs(length.estimatedLengthMM - Math.PI) < 1e-6
    && length.errorEstimateMM > 0 && length.errorEstimateMM <= 1e-7,
  'Original current-document Curve arc-length estimate was not validated');

  viewer = createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.015, 0.02, 0.03] });
  viewer.loadDocument(cad, request);
  const state = viewer.getState();
  const body = state.documentBodies[0];
  assert(state.status === 'ready' && state.curves.length === 1 && state.surfaces.length === 0
    && state.curveSampleVersion === 1 && state.documentBodies.length === 1
    && body.ref.kind === 'curve' && body.binding.documentId === reference.documentId
    && body.binding.documentRevision === reference.documentRevision
    && body.binding.bodyId === reference.bodyId && body.binding.assetId === reference.assetId
    && body.binding.assetRevision === reference.assetRevision
    && body.binding.geometryId === reference.geometryId
    && body.ref.curveId === reference.geometryId,
  'Viewer lost the selected native Curve body binding');
  const ref = body.ref;
  const point = { ...ref, t: 0.5 };
  const curve = { modelId: ref.modelId, curveId: ref.curveId };
  const chord = viewer.measureNativeCurvePoints({ ...curve, t: 0 }, { ...curve, t: 1 });
  assert(chord.space === 'native-authored' && chord.distanceMM > 0
    && chord.distanceMM < length.estimatedLengthMM - 0.1,
  'Original endpoint chord was confused with Curve arc length');

  viewer.fit();
  const labelText = `Native arc-length estimate: ${length.estimatedLengthMM.toFixed(9)} mm · ` +
    `heuristic estimator: ${length.errorEstimateMM.toExponential(3)} mm · ` +
    `original interval [${length.report.interval.join(', ')}] · global error not certified`;
  const positionLabel = () => {
    const anchor = viewer.projectNativePoint(point);
    if (anchor === null) { label.style.display = 'none'; return null; }
    label.textContent = labelText;
    label.style.left = `${anchor.xCss}px`;
    label.style.top = `${anchor.yCss}px`;
    label.style.display = 'block';
    return anchor;
  };
  const firstAnchor = positionLabel();
  const initialHash = hash(viewer.readPixels());
  assert(firstAnchor && firstAnchor.documentBody?.bodyId === reference.bodyId
    && firstAnchor.xCss >= 0 && firstAnchor.xCss <= canvas.clientWidth
    && firstAnchor.yCss >= 0 && firstAnchor.yCss <= canvas.clientHeight
    && firstAnchor.approximate === true && firstAnchor.occlusion === 'not-tested'
    && label.style.display === 'block' && label.textContent === labelText,
  'Viewer Curve or caller label was not visible');
  let hit = null;
  for (let y = 4; y < canvas.height && !hit; y += 3) {
    for (let x = 4; x < canvas.width && !hit; x += 3) {
      hit = viewer.pickGeometry({ xCss: x, yCss: y }, { curveTolerancePx: 4 });
    }
  }
  assert(hit?.kind === 'curve' && same(hit.ref, { modelId: ref.modelId, curveId: ref.curveId }),
    'Sampled Curve had no qualified screen hit');
  viewer.orbit(0.12, 0.04);
  const cameraAnchor = positionLabel();
  assert(cameraAnchor && Math.abs(cameraAnchor.xCss - firstAnchor.xCss) > 0.1
    && same(cameraAnchor.point.pointMM, firstAnchor.point.pointMM)
    && Math.abs(parseFloat(label.style.left) - cameraAnchor.xCss) < 0.1,
  `Host label did not follow the camera projection: ${JSON.stringify({ firstAnchor, cameraAnchor, cssLeft: label.style.left })}`);
  viewer.selectGeometry(ref);
  const selectedHash = hash(viewer.readPixels());
  assert(selectedHash !== initialHash && same(viewer.getState().selectedGeometry, ref),
    'Curve selection did not update Viewer display');
  viewer.applyGeometryMotionFrame({ contextId: 'curve-length', timeSeconds: 1,
    poses: [{ targetId: 'quarter', translation: [0.3, 0, 0] }] },
  [{ contextId: 'curve-length', targetId: 'quarter', ref }],
  { basis: 'part-xyz-matches-rhyup' });
  const posedAnchor = positionLabel();
  assert(posedAnchor && Math.abs(posedAnchor.xCss - cameraAnchor.xCss) > 1
    && same(posedAnchor.point.pointMM, firstAnchor.point.pointMM)
    && JSON.stringify(length) === originalLength
    && source === cad.document.assets.find(asset => asset.id === reference.assetId).source,
  `Display pose changed native arc length or failed to move label: ${JSON.stringify({ cameraAnchor, posedAnchor })}`);

  const stableState = viewer.getState(), stableHash = hash(viewer.readPixels());
  const stableLabel = label.textContent, stablePosition = [label.style.left, label.style.top];
  const candidates = [
    () => queryCadDocumentCurveArcLength(cad, { ...reference, documentRevision: 2 }, cadOptions),
    () => createCadGeometryReference(cad, { bodyId: 'missing_body' }),
    () => queryCadDocumentCurveArcLength(cad, reference, { ...cadOptions, interval: [1, 0] }),
    () => validateCadDocumentCurveArcLength(cad, { ...length, estimatedLengthMM: 999 }),
    () => viewer.projectNativePoint({ ...point, modelId: 'foreign' }),
  ];
  let refused = 0;
  for (const candidate of candidates) {
    try { candidate(); } catch { refused++; }
  }
  assert(refused === candidates.length && same(viewer.getState(), stableState)
    && hash(viewer.readPixels()) === stableHash && label.textContent === stableLabel
    && same([label.style.left, label.style.top], stablePosition)
    && JSON.stringify(length) === originalLength
    && cad.document.assets.find(asset => asset.id === reference.assetId).source === source,
  'Invalid candidate changed the accepted measurement, label, source or scene');

  viewer.setVisibleGeometry([]);
  let hiddenRefused = false;
  try { positionLabel(); } catch { hiddenRefused = true; label.style.display = 'none'; }
  assert(hiddenRefused && label.style.display === 'none' && viewer.getState().status === 'ready',
    'Hidden Curve retained a caller label anchor');
  viewer.setVisibleGeometry([ref]);
  assert(positionLabel() !== null, 'Restored Curve did not restore label anchor');
  viewer.clear();
  label.style.display = 'none';
  label.textContent = '';
  let clearedRefused = false;
  try { viewer.projectNativePoint(point); } catch { clearedRefused = true; }
  assert(clearedRefused && viewer.getState().status === 'empty'
    && viewer.getState().document === null && label.style.display === 'none',
  'Clear retained the old Curve or label');
  viewer.dispose(); viewer.dispose();
  const remaining = Object.fromEntries(Object.entries(resources).map(([type, live]) => [type, live.size]));
  const glError = [...contexts][0]?.getError();
  assert(contexts.size === 1 && contexts.has(getContext.call(canvas, 'webgl2'))
    && glError === 0 && Object.values(remaining).every(count => count === 0)
    && document.querySelectorAll('canvas').length === 1 && document.body.contains(canvas)
    && browserErrors.length === 0,
  `WebGL2 or lifecycle evidence failed: ${JSON.stringify({ contexts: contexts.size, glError, remaining, browserErrors })}`);
  const result = { ok: true, reference, sourceRetained: true,
    originalInterval: length.report.interval, criterion: length.report.criterion,
    globalErrorCertified: length.report.quality.globalErrorCertified,
    estimatedLengthMM: length.estimatedLengthMM, errorEstimateMM: length.errorEstimateMM,
    analyticDifferenceMM: Math.abs(length.estimatedLengthMM - Math.PI),
    chordMM: chord.distanceMM, labelText, initialHash, selectedHash,
    firstAnchor: { xCss: firstAnchor.xCss, yCss: firstAnchor.yCss },
    cameraAnchor: { xCss: cameraAnchor.xCss, yCss: cameraAnchor.yCss },
    posedAnchor: { xCss: posedAnchor.xCss, yCss: posedAnchor.yCss },
    refused, hiddenRefused, clearedRefused, contextCount: contexts.size,
    glError, remaining, browserErrors,
    limits: 'One canonical revision1 Curve body, source0 sampled display, local Chromium WebGL2; estimator is heuristic and global error is not certified.' };
  // The proof tears down its first Viewer. Reopen the accepted document in the
  // same caller canvas so the running example keeps showing the measured Curve.
  viewer = createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.015, 0.02, 0.03] });
  viewer.loadDocument(cad, request);
  viewer.fit();
  const restoredAnchor = positionLabel();
  assert(restoredAnchor && contexts.size === 1 && hash(viewer.readPixels()) !== 0,
    'Visible demonstration did not return after the teardown check');
  result.restoredScene = true;
  window.addEventListener('pagehide', () => viewer.dispose(), { once: true });
  window.viewerCurveLengthProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  const recorded = await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
  assert(recorded.ok, 'Browser result was not recorded');
} catch (error) {
  viewer?.dispose();
  const result = { ok: false, error: error.stack || error.message, browserErrors };
  window.viewerCurveLengthProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  try { await fetch('/result', { method: 'POST', body: JSON.stringify(result) }); } catch { /* server failed */ }
}
