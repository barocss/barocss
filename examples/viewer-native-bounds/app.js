import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadDocument, prepareBaroCadDocumentPrimitiveNativeRefsV2 }
  from '../../packages/barocss-cad-interop/dist/document.js';
import { createCadGeometryReference, queryCadDocumentBounds,
  validateCadDocumentBounds } from '../../packages/barocss-cad/dist/index.js';

const assert = (value, message) => { if (!value) throw new Error(message); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
const canvas = document.querySelector('#view'), label = document.querySelector('#length');
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

const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 0.001,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const request = { native, basis: 'authored-xyz-matches-rhyup',
  bodyIds: ['middle_section_body', 'loft_surface_body'] };
const corners = bounds => {
  const points = [];
  for (const x of [bounds.min[0], bounds.max[0]])
    for (const y of [bounds.min[1], bounds.max[1]])
      for (const z of [bounds.min[2], bounds.max[2]]) points.push([x, y, z]);
  return points;
};
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = a => a.map(value => value / Math.hypot(...a));
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const inCamera = (points, camera) => {
  const backward = unit(subtract(camera.eye, camera.target));
  const forward = backward.map(value => -value);
  const right = unit(cross(camera.up, backward));
  const up = cross(backward, right);
  const tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
  const aspect = canvas.width / canvas.height;
  return points.every(point => {
    const offset = subtract(point, camera.eye), depth = dot(offset, forward);
    return depth >= camera.near - 1e-8 && depth <= camera.far + 1e-8
      && Math.abs(dot(offset, right) / (depth * tangent * aspect)) <= 1 + 1e-8
      && Math.abs(dot(offset, up) / (depth * tangent)) <= 1 + 1e-8;
  });
};
const unionTarget = points => [0, 1, 2].map(axis =>
  (Math.min(...points.map(point => point[axis]))
    + Math.max(...points.map(point => point[axis]))) / 2);
const near = (a, b) => a.every((value, index) => Math.abs(value - b[index]) < 1e-9);
const posedCorner = point => {
  // One accepted test pose: 90-degree Z rotation after nonuniform XYZ scale.
  const [x, y, z] = point;
  return [(0.3 - 0.8 * y) * 0.15, (0.2 + 1.2 * x) * 0.15, z * 0.15];
};
const retained = (viewer, action, name) => {
  const state = viewer.getState(), pixels = hash(viewer.readPixels());
  let refused = false;
  try { action(); } catch { refused = true; }
  assert(refused && same(viewer.getState(), state) && hash(viewer.readPixels()) === pixels,
    `${name} changed accepted state or pixels`);
};
let viewer;
try {
  const documents = await Promise.all([1, 2].map(revision =>
    loadBaroCadDocument(new URL(`/document/${revision}`, location.href).href)));
  const sourceSnapshots = documents.map(value => JSON.stringify(value));
  const bounds = documents.map((cad, index) => request.bodyIds.map(bodyId => {
    const { reference } = createCadGeometryReference(cad, { bodyId });
    const result = queryCadDocumentBounds(cad, reference);
    assert(same(validateCadDocumentBounds(cad, result), result.report)
      && result.report.geometryAuthority === 'original-native-control-hull'
      && result.report.quality.globalBinary64ContainmentCertified === false
      && result.extrema.length === 6 && reference.documentRevision === index + 1,
    `Original bounds for revision ${index + 1} ${bodyId} were not validated`);
    return result;
  }));
  assert(bounds[0][0].boundsMM.max[1] === 4
    && bounds[1][0].boundsMM.max[2] > bounds[0][0].boundsMM.max[2]
    && bounds[1][1].boundsMM.max[2] > bounds[0][1].boundsMM.max[2],
  'Actual weighted Curve and edited loft bounds are missing');

  viewer = createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.015, 0.02, 0.03] });
  const empty = viewer.getState();
  let emptyRefused = false;
  try { viewer.fitNativeDocumentBody({ ref: { kind: 'curve', modelId: 'loft_bounds_asset',
    curveId: bounds[0][0].reference.geometryId }, documentRevision: 1 }); }
  catch { emptyRefused = true; }
  assert(emptyRefused && same(viewer.getState(), empty), 'Empty Viewer accepted a native document fit');
  let emptySetRefused = false;
  try { viewer.fitNativeDocumentBodies({ refs: [{ kind: 'curve', modelId: 'loft_bounds_asset',
    curveId: bounds[0][0].reference.geometryId }, { kind: 'surface', modelId: 'loft_bounds_asset',
    surfaceId: bounds[0][1].reference.geometryId }], documentRevision: 1 }); }
  catch { emptySetRefused = true; }
  assert(emptySetRefused && same(viewer.getState(), empty),
    'Empty Viewer accepted a native document body-set fit');
  viewer.loadDocument(documents[0], request);
  const bodies1 = viewer.getState().documentBodies;
  assert(bodies1.length === 2 && bodies1[0].ref.kind === 'curve' && bodies1[1].ref.kind === 'surface'
    && bodies1.every((body, index) => body.binding.bodyId === request.bodyIds[index]
      && body.binding.documentRevision === 1
      && body.binding.assetId === bounds[0][index].reference.assetId
      && body.binding.geometryId === bounds[0][index].reference.geometryId),
  'Viewer lost selected original document-body identities');
  const curveRef = bodies1[0].ref, surfaceRef = bodies1[1].ref;
  const curveFit = { ref: curveRef, documentRevision: 1 };
  const surfaceFit = { ref: surfaceRef, documentRevision: 1 };
  const bodySetFit = { refs: [curveRef, surfaceRef], documentRevision: 1 };
  const displayedCurve = prepareBaroCadDocumentPrimitiveNativeRefsV2(documents[0], request)
    .find(entry => entry.kind === 'curve' && entry.binding.bodyId === 'middle_section_body');
  assert(displayedCurve?.kind === 'curve', 'Selected Loader Curve sample is missing');
  const sampleMaximumY = Math.max(...displayedCurve.sample.pointsMM.map(point => point[1]));
  assert(sampleMaximumY < 3.5 && bounds[0][0].boundsMM.max[1] - sampleMaximumY > 0.5,
    'Display samples were not distinct from the original control hull');
  viewer.fitGeometry(curveRef);
  const displayCamera = viewer.getState().camera;
  viewer.fitNativeDocumentBody(curveFit);
  const nativeCamera = viewer.getState().camera;
  const sourceCorners = corners(bounds[0][0].boundsMM).map(point => point.map(value => value * 0.15));
  assert(!same(displayCamera, nativeCamera) && inCamera(sourceCorners, nativeCamera),
    'Original control-pole hull did not determine the Viewer camera');
  viewer.fit();
  const displayedSetCamera = viewer.getState().camera;
  const surfaceCorners = corners(bounds[0][1].boundsMM).map(point => point.map(value => value * 0.15));
  viewer.fitNativeDocumentBodies(bodySetFit);
  const bodySetCamera = viewer.getState().camera;
  const bothCorners = [...sourceCorners, ...surfaceCorners];
  assert(inCamera(bothCorners, bodySetCamera)
    && near(bodySetCamera.target, unionTarget(bothCorners))
    && !same(bodySetCamera, nativeCamera) && !same(bodySetCamera, displayedSetCamera),
  'Two-body original hull did not determine an independent union camera');
  viewer.fitNativeDocumentBody(curveFit);
  const firstHash = hash(viewer.readPixels());
  let hit = null;
  for (let y = 5; y < canvas.height && !hit; y += 3)
    for (let x = 5; x < canvas.width && !hit; x += 3)
      hit = viewer.pickGeometry({ xCss: x, yCss: y }, { curveTolerancePx: 4 });
  assert(hit?.kind === 'curve' || hit?.kind === 'surface', 'Original bounds camera has no visible geometry hit');
  viewer.selectGeometry(curveRef);
  const selectedHash = hash(viewer.readPixels());
  assert(same(viewer.getState().selectedGeometry, curveRef) && selectedHash !== firstHash,
    'Qualified Curve selection failed');
  const beforePoseBounds = JSON.stringify(bounds[0]);
  const q = Math.SQRT1_2;
  viewer.applyGeometryMotionFrame({ contextId: 'native-bounds', timeSeconds: 1,
    poses: [{ targetId: 'middle', translation: [0.3, 0.2, 0], rotation: [0, 0, q, q],
      scale: [1.2, 0.8, 1] }, { targetId: 'loft' }] },
  [{ contextId: 'native-bounds', targetId: 'middle', ref: curveRef },
    { contextId: 'native-bounds', targetId: 'loft', ref: surfaceRef }],
  { basis: 'part-xyz-matches-rhyup' });
  viewer.fitNativeDocumentBody(curveFit);
  const posedCamera = viewer.getState().camera;
  const posedCorners = corners(bounds[0][0].boundsMM).map(posedCorner);
  assert(inCamera(posedCorners, posedCamera) && !same(posedCamera, nativeCamera)
    && JSON.stringify(bounds[0]) === beforePoseBounds,
  'Current display pose was not applied once to unchanged original bounds');
  viewer.fitNativeDocumentBodies(bodySetFit);
  const posedSetCamera = viewer.getState().camera;
  assert(inCamera([...posedCorners, ...surfaceCorners], posedSetCamera)
    && near(posedSetCamera.target, unionTarget([...posedCorners, ...surfaceCorners]))
    && !same(posedSetCamera, bodySetCamera)
    && same(viewer.getState().selectedGeometry, curveRef),
  'The two-body fit lost an independent display pose');
  viewer.fitNativeDocumentBody(surfaceFit);
  const surfaceCamera = viewer.getState().camera;
  assert(inCamera(corners(bounds[0][1].boundsMM).map(point => point.map(value => value * 0.15)), surfaceCamera)
    && !same(surfaceCamera, posedCamera), 'Original Surface body bounds did not fit');
  retained(viewer, () => viewer.fitNativeDocumentBody({ ...curveFit, extra: true }), 'Extra field');
  let getterCalls = 0;
  const getter = { ...curveFit };
  Object.defineProperty(getter, 'documentRevision', { enumerable: true, get() { getterCalls++; return 1; } });
  retained(viewer, () => viewer.fitNativeDocumentBody(getter), 'Accessor');
  assert(getterCalls === 0, 'Native fit evaluated a getter');
  retained(viewer, () => viewer.fitNativeDocumentBody({ ref: { ...curveRef, modelId: 'foreign' },
    documentRevision: 1 }), 'Unknown body');
  retained(viewer, () => viewer.fitNativeDocumentBodies({ ...bodySetFit, refs: [curveRef] }),
    'One body in set');
  retained(viewer, () => viewer.fitNativeDocumentBodies({ ...bodySetFit, refs: [curveRef, curveRef] }),
    'Duplicate bodies in set');
  retained(viewer, () => viewer.fitNativeDocumentBodies({ ...bodySetFit,
    refs: [curveRef, surfaceRef, curveRef, surfaceRef, curveRef] }), 'Five bodies in set');
  retained(viewer, () => viewer.fitNativeDocumentBodies({ ...bodySetFit, extra: true }),
    'Extra body-set field');
  const sparseRefs = [curveRef, , surfaceRef];
  retained(viewer, () => viewer.fitNativeDocumentBodies({ ...bodySetFit, refs: sparseRefs }),
    'Sparse body-set refs');
  let setGetterCalls = 0;
  const getterRefs = [curveRef, surfaceRef];
  Object.defineProperty(getterRefs, '0', { enumerable: true, get() { setGetterCalls++; return curveRef; } });
  retained(viewer, () => viewer.fitNativeDocumentBodies({ ...bodySetFit, refs: getterRefs }),
    'Accessor body-set ref');
  assert(setGetterCalls === 0, 'Body-set fit evaluated an accessor');
  retained(viewer, () => viewer.fitNativeDocumentBodies({ ...bodySetFit,
    refs: [{ ...curveRef, modelId: 'foreign' }, surfaceRef] }), 'Foreign body in set');
  retained(viewer, () => viewer.fitNativeDocumentBodies({ ...bodySetFit,
    refs: [{ ...curveRef, curveId: 'missing' }, surfaceRef] }), 'Unknown body in set');
  viewer.setVisibleGeometry([surfaceRef]);
  retained(viewer, () => viewer.fitNativeDocumentBody(curveFit), 'Hidden body');
  retained(viewer, () => viewer.fitNativeDocumentBodies(bodySetFit), 'Hidden body in set');
  viewer.setVisibleGeometry([curveRef, surfaceRef]);
  assert(viewer.getState().documentBodies.length === 2, 'Visibility changed original body inventory');
  viewer.loadDocument(documents[1], request);
  const bodies2 = viewer.getState().documentBodies;
  const curveFit2 = { ref: bodies2[0].ref, documentRevision: 2 };
  const bodySetFit2 = { refs: bodies2.map(body => body.ref), documentRevision: 2 };
  retained(viewer, () => viewer.fitNativeDocumentBody(curveFit), 'Stale revision');
  retained(viewer, () => viewer.fitNativeDocumentBodies(bodySetFit), 'Stale body-set revision');
  viewer.fitNativeDocumentBodies(bodySetFit2);
  const revisedSetCamera = viewer.getState().camera;
  const revisedCorners = bounds[1].flatMap(value => corners(value.boundsMM)
    .map(point => point.map(component => component * 0.15)));
  assert(inCamera(revisedCorners, revisedSetCamera)
    && near(revisedSetCamera.target, unionTarget(revisedCorners))
    && !same(revisedSetCamera, bodySetCamera), 'Revised two-body source hull did not fit');
  viewer.fitNativeDocumentBody(curveFit2);
  const editedCamera = viewer.getState().camera;
  assert(inCamera(corners(bounds[1][0].boundsMM).map(point => point.map(value => value * 0.15)), editedCamera)
    && !same(editedCamera, nativeCamera)
    && sourceSnapshots.every((snapshot, index) => JSON.stringify(documents[index]) === snapshot),
  'Revision2 fit lost original bounds or changed caller documents');
  const source = documents[1].document.assets[0].source;
  viewer.loadNative(source, { sourceVersion: 0, countU: 8, countV: 8 });
  retained(viewer, () => viewer.fitNativeDocumentBody(curveFit2), 'Non-document scene');
  retained(viewer, () => viewer.fitNativeDocumentBodies(bodySetFit2), 'Non-document scene for body set');
  viewer.loadDocument(documents[1], request);
  viewer.fitNativeDocumentBody(curveFit2);
  viewer.clear();
  const clearState = viewer.getState(), clearHash = hash(viewer.readPixels());
  let clearRefused = false;
  try { viewer.fitNativeDocumentBody(curveFit2); } catch { clearRefused = true; }
  assert(clearRefused && same(viewer.getState(), clearState) && hash(viewer.readPixels()) === clearHash,
    'Cleared Viewer accepted a native document fit');
  let clearSetRefused = false;
  try { viewer.fitNativeDocumentBodies(bodySetFit2); } catch { clearSetRefused = true; }
  assert(clearSetRefused && same(viewer.getState(), clearState)
    && hash(viewer.readPixels()) === clearHash,
  'Cleared Viewer accepted a native document body-set fit');
  viewer.loadDocument(documents[1], request);
  viewer.fitNativeDocumentBody(curveFit2);
  const beforeLossCamera = viewer.getState().camera;
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }));
  let contextLostRefused = false;
  try { viewer.fitNativeDocumentBody(curveFit2); } catch { contextLostRefused = true; }
  assert(contextLostRefused && viewer.getState().status === 'context-lost'
    && same(viewer.getState().camera, beforeLossCamera),
  'Lost WebGL2 context accepted a native document fit');
  let contextLostSetRefused = false;
  try { viewer.fitNativeDocumentBodies(bodySetFit2); } catch { contextLostSetRefused = true; }
  assert(contextLostSetRefused && viewer.getState().status === 'context-lost'
    && same(viewer.getState().camera, beforeLossCamera),
  'Lost WebGL2 context accepted a native document body-set fit');
  viewer.dispose(); viewer.dispose();
  let disposedRefused = false;
  try { viewer.fitNativeDocumentBody(curveFit2); } catch { disposedRefused = true; }
  assert(disposedRefused && viewer.getState().status === 'disposed',
    'Disposed Viewer accepted a native document fit');
  let disposedSetRefused = false;
  try { viewer.fitNativeDocumentBodies(bodySetFit2); } catch { disposedSetRefused = true; }
  assert(disposedSetRefused && viewer.getState().status === 'disposed',
    'Disposed Viewer accepted a native document body-set fit');
  const remaining = Object.fromEntries(Object.entries(resources).map(([type, live]) => [type, live.size]));
  const glError = [...contexts][0]?.getError();
  assert(contexts.size === 1 && contexts.has(getContext.call(canvas, 'webgl2')) && glError === 0
    && Object.values(remaining).every(count => count === 0)
    && document.querySelectorAll('canvas').length === 1 && document.body.contains(canvas)
    && browserErrors.length === 0, 'Viewer resource/context/browser error');
  const result = { ok: true, documentIds: bounds.map(entry => entry[0].reference.documentId),
    bodyIds: request.bodyIds, controlMaximumYMM: 4, sampledMaximumYMM: sampleMaximumY,
    curveBoundsRevision1: bounds[0][0].boundsMM, curveBoundsRevision2: bounds[1][0].boundsMM,
    surfaceBoundsRevision1: bounds[0][1].boundsMM,
    cameras: { display: displayCamera, original: nativeCamera, posed: posedCamera,
      surface: surfaceCamera, revision2: editedCamera,
      displayedSet: displayedSetCamera, bodySet: bodySetCamera,
      posedSet: posedSetCamera, revision2Set: revisedSetCamera },
    firstHash, selectedHash, screenHitKind: hit.kind,
    refused: ['empty', 'extra', 'getter', 'unknown', 'hidden', 'stale', 'non-document',
      'clear', 'context-lost', 'disposed'], contextLostRefused, disposedRefused,
    getterCalls, setGetterCalls, emptySetRefused, clearSetRefused,
    contextLostSetRefused, disposedSetRefused,
    bodySetRefused: ['one', 'duplicate', 'five', 'extra', 'sparse', 'getter', 'foreign', 'unknown',
      'hidden', 'stale', 'non-document', 'clear', 'context-lost', 'disposed'],
    sourceUnchanged: true, oneContext: contexts.size === 1,
    glError, remaining, browserErrors,
    limits: 'One current body or an explicit set of 2..4 visible current CAD document Curve/Surface bodies; original positive-rational control-pole hull; local Chromium WebGL2; neither tight extrema nor global floating containment is certified.' };
  viewer = createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.015, 0.02, 0.03] });
  viewer.loadDocument(documents[1], request);
  viewer.fitNativeDocumentBodies(bodySetFit2);
  assert(contexts.size === 1 && hash(viewer.readPixels()) !== 0,
    'Visible revision2 body did not return after teardown');
  label.textContent = `Two original body hulls · revision 2 · Curve max Z ${bounds[1][0].boundsMM.max[2]} mm`;
  label.style.left = '20px'; label.style.top = '20px'; label.style.display = 'block';
  result.restoredScene = true;
  window.addEventListener('pagehide', () => viewer.dispose(), { once: true });
  window.viewerNativeBoundsProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  const recorded = await fetch('/result', { method: 'POST', body: JSON.stringify(result) });
  assert(recorded.ok, 'Browser result was not recorded');
} catch (error) {
  viewer?.dispose();
  const result = { ok: false, error: error.stack || error.message, browserErrors };
  window.viewerNativeBoundsProof = result;
  status.textContent = JSON.stringify(result, null, 2);
  try { await fetch('/result', { method: 'POST', body: JSON.stringify(result) }); } catch { /* server failed */ }
}
