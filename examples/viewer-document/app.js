import { createViewer } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadDocument } from '../../packages/barocss-cad-interop/dist/document.js';
import { loadBaroCadModelSet } from '../../packages/barocss-cad-interop/dist/model-set.js';

const canvas = document.querySelector('#view');
const output = document.querySelector('#status');
const viewer = await createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.015, 0.02, 0.03] });
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
  const posedHash = hash(await viewer.readPixels());
  const scanHits = () => {
    const found = new Map();
    for (let y = 6; y < canvas.height && found.size < 4; y += 4) {
      for (let x = 6; x < canvas.width && found.size < 4; x += 4) {
        const hit = viewer.pickGeometry({ xCss: x, yCss: y }, { curveTolerancePx: 4 });
        if (hit) found.set(`${hit.kind}:${hit.ref.modelId}`, hit);
      }
    }
    return found;
  };
  const hits = scanHits();
  assert(hits.size === 4, `Expected four selected body screen hits: ${[...hits.keys()].join(', ')}`);
  const secondCurve = hits.get('curve:asset_b');
  const resolvedBody = viewer.getState().documentBodies.find(value =>
    value.ref.kind === 'curve' && value.ref.modelId === secondCurve.ref.modelId
      && value.ref.curveId === secondCurve.ref.curveId);
  assert(resolvedBody?.binding.bodyId === 'body_1_curve', 'Screen ref did not resolve to original body');
  viewer.selectGeometry({ kind: 'curve', ...secondCurve.ref });
  const selectedHash = hash(await viewer.readPixels());
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
  const surfaceHit = hits.get('surface:asset.a');
  const surfacePointInput = { kind: 'surface', ...surfaceHit.ref,
    u: surfaceHit.parameterUV[0], v: surfaceHit.parameterUV[1] };
  const curvePointInput = { kind: 'curve', ...secondCurve.ref, t: secondCurve.parameterApprox };
  const beforeProjection = viewer.getState(), pixelsBeforeProjection = hash(await viewer.readPixels());
  const surfaceAnchor = viewer.projectNativePoint(surfacePointInput);
  const curveAnchor = viewer.projectNativePoint(curvePointInput);
  assert(surfaceAnchor && curveAnchor && surfaceAnchor.documentBody?.bodyId === 'body_0_surface'
    && curveAnchor.documentBody?.bodyId === 'body_1_curve'
    && surfaceAnchor.documentBody.documentRevision === 5
    && curveAnchor.documentBody.assetRevision === 7
    && surfaceAnchor.xCss >= 0 && surfaceAnchor.xCss <= canvas.getBoundingClientRect().width
    && curveAnchor.yCss >= 0 && curveAnchor.yCss <= canvas.getBoundingClientRect().height
    && curveAnchor.depthScene > 0 && curveAnchor.occlusion === 'not-tested'
    && curveAnchor.approximate === true
    && JSON.stringify(viewer.getState()) === JSON.stringify(beforeProjection)
    && hash(await viewer.readPixels()) === pixelsBeforeProjection,
  'Native measurement point projection changed state or lost qualified binding');
  const copiedAnchor = viewer.projectNativePoint(curvePointInput);
  copiedAnchor.documentBody.bodyId = 'caller-edited-copy';
  assert(viewer.projectNativePoint(curvePointInput).documentBody.bodyId === 'body_1_curve',
    'Projected document binding was not copied');
  const cameraBeforeProjection = viewer.getState().camera;
  viewer.orbit(0.12, 0.04);
  const cameraAnchor = viewer.projectNativePoint(curvePointInput);
  assert(cameraAnchor && Math.abs(cameraAnchor.xCss - curveAnchor.xCss) > 1
    && JSON.stringify(cameraAnchor.point.pointMM) === JSON.stringify(curveAnchor.point.pointMM),
  'Camera movement did not move the projected anchor');
  viewer.setView(cameraBeforeProjection);
  const shifted = poses(refs);
  shifted.poses.forEach((pose, index) => {
    if (refs[index].modelId === 'asset_b') pose.translation = [9, 0, 0];
  });
  viewer.applyGeometryMotionFrame(shifted, bindings(refs), { basis: 'part-xyz-matches-rhyup' });
  const posedAnchor = viewer.projectNativePoint(curvePointInput);
  assert(posedAnchor && Math.abs(posedAnchor.xCss - curveAnchor.xCss) > 1
    && JSON.stringify(posedAnchor.point.pointMM) === JSON.stringify(curveAnchor.point.pointMM),
  'Display pose changed native point or did not move the label anchor');
  poseDocument(refs);
  const cameraBeforeOutside = viewer.getState().camera;
  viewer.setView({ ...cameraBeforeOutside, eye: [0, 0, 6], target: [0, 0, 12] });
  const outsideFrustum = viewer.projectNativePoint(curvePointInput) === null;
  viewer.setView(cameraBeforeOutside);
  assert(outsideFrustum, 'Valid point behind the camera did not return null');
  const beforeBadProjection = viewer.getState(), pixelsBeforeBadProjection = hash(await viewer.readPixels());
  let badParameterRefused = false, badPointRefused = false, hiddenNativeRefused = false;
  try { viewer.projectNativePoint({ ...curvePointInput, t: 100000 }); }
  catch { badParameterRefused = true; }
  try { viewer.projectNativePoint({ ...curvePointInput, modelId: 'foreign' }); }
  catch { badPointRefused = true; }
  try { viewer.projectNativePoint({ kind: 'curve', modelId: 'asset.a', curveId: 'skip_path_native', t: 0 }); }
  catch { hiddenNativeRefused = true; }
  assert(badParameterRefused && badPointRefused && hiddenNativeRefused
    && JSON.stringify(viewer.getState()) === JSON.stringify(beforeBadProjection)
    && hash(await viewer.readPixels()) === pixelsBeforeBadProjection,
  'Invalid native point projection changed state or pixels');
  let crossRefused = false;
  try {
    viewer.measureNativeCurvePoints(
      { modelId: 'asset.a', curveId: 'guide_path_native', t: -3 },
      { modelId: 'asset_b', curveId: 'guide_path_native', t: 7 });
  } catch { crossRefused = true; }
  assert(crossRefused, 'Cross-asset native distance accepted');
  const beforeInvalid = viewer.getState(), pixelsBeforeInvalid = hash(await viewer.readPixels());
  let badBodyRefused = false, badBasisRefused = false;
  try { viewer.loadDocument(result, { ...options, bodyIds: ['missing_body'] }); }
  catch { badBodyRefused = true; }
  try { viewer.loadDocument(result, { ...options, basis: 'authored-xyz-no-axis-conversion' }); }
  catch { badBasisRefused = true; }
  assert(badBodyRefused && badBasisRefused
    && JSON.stringify(viewer.getState()) === JSON.stringify(beforeInvalid)
    && hash(await viewer.readPixels()) === pixelsBeforeInvalid,
  'Invalid document candidate changed accepted scene');
  viewer.selectGeometry(refs[0]);
  viewer.setVisibleGeometry(refs.slice(1).reverse());
  const threeVisible = viewer.getState();
  const threeHits = scanHits();
  assert(threeVisible.visibleGeometry.length === 3
    && JSON.stringify(threeVisible.visibleGeometry) === JSON.stringify(
      accepted.visibleGeometry.filter(ref => JSON.stringify(ref) !== JSON.stringify(refs[0])))
    && threeVisible.selectedGeometry === null && threeVisible.documentBodies.length === 4
    && !threeHits.has('curve:asset.a') && threeHits.has('surface:asset_b'),
  'Hidden Curve remained selectable or visible');
  let hiddenSelectRefused = false, hiddenFitRefused = false;
  try { viewer.selectGeometry(refs[0]); } catch { hiddenSelectRefused = true; }
  try { viewer.fitGeometry(refs[0]); } catch { hiddenFitRefused = true; }
  assert(hiddenSelectRefused && hiddenFitRefused, 'Hidden Curve accepted selection or fit');
  const firstCurveHit = hits.get('curve:asset.a');
  const firstCurvePointInput = { kind: 'curve', ...firstCurveHit.ref, t: firstCurveHit.parameterApprox };
  let hiddenProjectionRefused = false;
  try { viewer.projectNativePoint(firstCurvePointInput); } catch { hiddenProjectionRefused = true; }
  assert(hiddenProjectionRefused && viewer.projectNativePoint(surfacePointInput) !== null,
    'Hidden Curve projected or visible Surface lost its anchor');
  viewer.setVisibleGeometry([refs[2]]);
  viewer.fit();
  const isolated = viewer.getState();
  const isolatedHits = scanHits();
  assert(isolated.visibleGeometry.length === 1 && isolatedHits.size === 1
    && isolatedHits.has('curve:asset_b'), 'One-object visibility or fit failed');
  viewer.setVisibleGeometry([]);
  const hiddenAll = viewer.getState(), hiddenAllHash = hash(await viewer.readPixels());
  assert(hiddenAll.status === 'ready' && hiddenAll.visibleGeometry.length === 0
    && hiddenAll.documentBodies.length === 4 && hiddenAll.document !== null,
  'Hiding all unloaded the accepted document');
  let emptyFitRefused = false;
  try { viewer.fit(); } catch { emptyFitRefused = true; }
  assert(emptyFitRefused && JSON.stringify(viewer.getState()) === JSON.stringify(hiddenAll)
    && hash(await viewer.readPixels()) === hiddenAllHash,
  'Fit on hidden scene changed state or pixels');
  const hiddenMeasurement = viewer.measureNativeCurvePoints(
    { modelId: 'asset_b', curveId: 'guide_path_native', t: -3 },
    { modelId: 'asset_b', curveId: 'guide_path_native', t: 7 });
  assert(hiddenMeasurement.distanceMM === same.distanceMM,
    'Hidden geometry lost native measurement');
  const beforeBadVisibility = viewer.getState(), beforeBadVisibilityHash = hash(await viewer.readPixels());
  let duplicateRefused = false, foreignRefused = false, malformedRefused = false;
  try { viewer.setVisibleGeometry([refs[0], refs[0]]); } catch { duplicateRefused = true; }
  try { viewer.setVisibleGeometry([{ ...refs[0], modelId: 'foreign' }]); } catch { foreignRefused = true; }
  try { viewer.setVisibleGeometry([{ ...refs[0], extra: true }]); } catch { malformedRefused = true; }
  assert(duplicateRefused && foreignRefused && malformedRefused
    && JSON.stringify(viewer.getState()) === JSON.stringify(beforeBadVisibility)
    && hash(await viewer.readPixels()) === beforeBadVisibilityHash,
  'Invalid visibility candidate changed state or pixels');
  viewer.setVisibleGeometry(refs);
  viewer.fit();
  const restoredHits = scanHits();
  assert(restoredHits.size === 4 && viewer.getState().geometryMotion !== null
    && viewer.getState().document.document.assets[0].source === originalSource[0]
    && viewer.projectNativePoint(firstCurvePointInput) !== null,
  'Show all lost qualified hits, display poses or native source');
  viewer.clear();
  let clearedProjectionRefused = false;
  try { viewer.projectNativePoint(curvePointInput); } catch { clearedProjectionRefused = true; }
  assert(viewer.getState().status === 'empty' && viewer.getState().document === null
    && viewer.getState().documentBodies.length === 0
    && viewer.getState().visibleGeometry.length === 0 && clearedProjectionRefused,
  'Clear retained document projection authority');
  const blankHash = hash(await viewer.readPixels());
  assert(hiddenAllHash === blankHash, 'All-hidden frame did not match explicit blank background');
  viewer.loadNative(originalSource[0], { sourceVersion: 0, countU: 8, countV: 8,
    curveDisplay: native.curveDisplay });
  const singleSource = viewer.getState();
  assert(singleSource.native?.model.name === 'authored_part'
    && singleSource.document === null && singleSource.visibleGeometry.length > 0
    && singleSource.visibleGeometry.length === singleSource.surfaces.length + singleSource.curves.length,
  'Legacy single-source load changed');
  const sourceAnchor = viewer.projectNativePoint({ kind: 'surface', ...singleSource.surfaces[0],
    u: surfacePointInput.u, v: surfacePointInput.v });
  assert(sourceAnchor && sourceAnchor.documentBody === null,
    'Single-source native Surface projection failed');
  const singleSourceHash = hash(await viewer.readPixels());
  viewer.setVisibleGeometry([]);
  assert(viewer.getState().status === 'ready' && hash(await viewer.readPixels()) === blankHash,
    'Legacy single-source hide did not keep authority or blank the viewport');
  viewer.setVisibleGeometry(singleSource.visibleGeometry);
  assert(hash(await viewer.readPixels()) === singleSourceHash,
    'Legacy single-source show did not restore displayed geometry');
  viewer.clear();
  const modelSet = await loadBaroCadModelSet({ format: 'barocad-model-set', version: 0,
    entries: [{ aliasId: 'asset_a', url: 'model-a.barocad', options: native },
      { aliasId: 'asset-b', url: 'model-b.barocad', options: native }] },
  { baseURL: location.href });
  viewer.loadModelSet(modelSet);
  const acceptedSet = viewer.getState();
  assert(acceptedSet.modelSet?.entries.length === 2
    && acceptedSet.document === null && acceptedSet.visibleGeometry.length === 4,
  'Legacy qualified model-set load changed');
  const setAnchor = viewer.projectNativePoint({ kind: 'surface', ...acceptedSet.surfaces[0],
    u: 0.5, v: 0.5 });
  assert(setAnchor && setAnchor.documentBody === null,
    'Qualified model-set native Surface projection failed');
  viewer.clear();
  viewer.loadDocument(result, options);
  const synchronousHash = hash(await viewer.readPixels());
  const documentUrl = new URL('/document.cad-document.json', location.href).href;
  const slowDocumentUrl = new URL('/slow-document.cad-document.json', location.href).href;
  const progress = [];
  await viewer.loadDocumentUrl(documentUrl, options,
    { onProgress: event => progress.push(event.loadedBytes) });
  assert(progress.length > 0 && progress.at(-1) === 3172
    && hash(await viewer.readPixels()) === synchronousHash
    && viewer.getState().documentBodies.length === 4,
  'Document URL did not match synchronous admission or byte progress');
  const retainedUrlState = async () => ({ state: JSON.stringify(viewer.getState()),
    pixels: hash(await viewer.readPixels()) });
  const refusesWithoutChange = async (url, displayOptions, transport) => {
    const before = await retainedUrlState();
    let refused = false;
    try { await viewer.loadDocumentUrl(url, displayOptions, transport); } catch { refused = true; }
    assert(refused && JSON.stringify(await retainedUrlState()) === JSON.stringify(before),
      'Refused document URL changed accepted scene or pixels');
  };
  await refusesWithoutChange(new URL('/missing.cad-document.json', location.href).href, options);
  await refusesWithoutChange(new URL('/invalid.cad-document.json', location.href).href, options);
  await refusesWithoutChange('data:application/json,{}', options);
  await refusesWithoutChange(documentUrl, { ...options, basis: 'wrong' });
  await refusesWithoutChange(documentUrl, { ...options, bodyIds: ['missing_body'] });
  const aborted = new AbortController();
  const abortedLoad = viewer.loadDocumentUrl(slowDocumentUrl, options, { signal: aborted.signal });
  abortedLoad.catch(() => {}); // Observed below, after an awaited pixel capture.
  aborted.abort();
  const beforeAbort = await retainedUrlState();
  let abortCode = null;
  try { await abortedLoad; } catch (error) { abortCode = error.code; }
  assert(abortCode === 'ABORT_ERR' && JSON.stringify(await retainedUrlState()) === JSON.stringify(beforeAbort),
    'Caller abort replaced accepted document');
  const staleDocument = viewer.loadDocumentUrl(slowDocumentUrl, options)
    .then(() => null, error => error.code);
  await viewer.loadDocumentUrl(documentUrl, options);
  const staleCode = await staleDocument;
  assert(staleCode === 'ABORT_ERR' && viewer.getState().documentBodies.length === 4,
    'Newer URL failed to supersede old document URL');
  const pendingDocument = viewer.loadDocumentUrl(slowDocumentUrl, options)
    .then(() => null, error => error.code);
  viewer.loadDocument(result, options);
  const synchronousCode = await pendingDocument;
  assert(synchronousCode === 'ABORT_ERR' && hash(await viewer.readPixels()) === synchronousHash,
    'Synchronous document did not supersede pending URL');
  const pendingNative = viewer.loadNativeUrl(new URL('/model-a.barocad', location.href).href,
    { sourceVersion: 0, countU: 8, countV: 8, curveDisplay: native.curveDisplay })
    .then(() => null, error => error.code);
  await viewer.loadDocumentUrl(documentUrl, options);
  const nativeCode = await pendingNative;
  assert(nativeCode === 'ABORT_ERR' && viewer.getState().documentBodies.length === 4,
    'Document URL did not supersede pending native URL');
  const pendingClear = viewer.loadDocumentUrl(slowDocumentUrl, options)
    .then(() => null, error => error.code);
  viewer.clear();
  const clearCode = await pendingClear;
  assert(clearCode === 'ABORT_ERR' && viewer.getState().status === 'empty',
    'Clear did not supersede pending document URL');
  const disposableCanvas = document.createElement('canvas');
  disposableCanvas.width = 800; disposableCanvas.height = 480;
  const disposable = await createViewer(disposableCanvas, { mmToSceneUnit: 0.15,
    background: [0.015, 0.02, 0.03] });
  const pendingDispose = disposable.loadDocumentUrl(slowDocumentUrl, options);
  disposable.dispose();
  let disposeRefused = false;
  try { await pendingDispose; } catch { disposeRefused = true; }
  assert(disposeRefused, 'Disposed Viewer admitted pending document URL');
  await viewer.loadDocumentUrl(documentUrl, options);
  const restored = viewer.getState();
  assert(restored.documentBodies.length === 4 && restored.selectedGeometry === null
    && restored.nativeMeasurement === null && restored.visibleGeometry.length === 4,
  'Document replacement did not reset state');
  poseDocument(refs);
  const finalSurfaceAnchor = viewer.projectNativePoint(surfacePointInput);
  const finalCurveAnchor = viewer.projectNativePoint(curvePointInput);
  assert(finalSurfaceAnchor && finalCurveAnchor, 'Final document labels fell outside the canvas');
  const placeLabel = (selector, anchor, label) => {
    const element = document.querySelector(selector);
    element.style.left = `${anchor.xCss}px`;
    element.style.top = `${anchor.yCss}px`;
    element.textContent = label;
  };
  placeLabel('#surface-label', finalSurfaceAnchor, 'Surface · native point');
  placeLabel('#curve-label', finalCurveAnchor, `${same.distanceMM.toFixed(2)} mm · native chord`);
  window.viewerDocumentProof = { ok: true, documentBytes: new TextEncoder().encode(
    await (await fetch('/document.cad-document.json')).text()).length,
    sourceBytes: originalSource.map(source => new TextEncoder().encode(source).length),
    documentId: restored.document.document.documentId, documentRevision: restored.document.document.revision,
    assetRevisions: restored.document.document.assets.map(asset => asset.revision),
    bodyIds: restored.documentBodies.map(value => value.binding.bodyId),
    refs: restored.documentBodies.map(value => value.ref), hitKinds: [...hits.keys()],
    resolvedBody: resolvedBody.binding.bodyId, posedHash, selectedHash, blankHash,
    sameAssetDistanceMM: same.distanceMM, hiddenNativeDistanceMM: hidden.distanceMM,
    crossRefused, badBodyRefused, badBasisRefused, hiddenAllHash,
    hiddenMeasurementMM: hiddenMeasurement.distanceMM, duplicateRefused,
    foreignRefused, malformedRefused, hiddenSelectRefused, hiddenFitRefused,
    emptyFitRefused, restoredHitKinds: [...restoredHits.keys()],
    surfaceAnchor: { xCss: finalSurfaceAnchor.xCss, yCss: finalSurfaceAnchor.yCss,
      bodyId: finalSurfaceAnchor.documentBody.bodyId },
    curveAnchor: { xCss: finalCurveAnchor.xCss, yCss: finalCurveAnchor.yCss,
      bodyId: finalCurveAnchor.documentBody.bodyId },
    cameraAnchorMoved: true, poseAnchorMoved: true, outsideFrustum,
    badParameterRefused, badPointRefused, hiddenNativeRefused,
    hiddenProjectionRefused, clearedProjectionRefused,
    sourceAndModelSetProjection: true,
    retainedHash: pixelsBeforeInvalid, singleSourceAndModelSetCompatible: true,
    documentUrl: { progressCount: progress.length, finalBytes: progress.at(-1),
      synchronousPixelsMatch: true, refusalRetention: true, abortCode, staleCode,
      synchronousCode, nativeCode, clearCode, disposeRefused } };
  output.textContent = JSON.stringify(window.viewerDocumentProof, null, 2);
} catch (error) {
  window.viewerDocumentProof = { ok: false, error: error.stack || error.message };
  output.textContent = JSON.stringify(window.viewerDocumentProof, null, 2);
}
