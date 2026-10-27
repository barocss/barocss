import { createViewer } from '@barocss/viewer';
import { compileMeshMaterial } from '@barocss/gpu';
import { parseSource, readSource, admitSource } from './source.js';
import { createPngExport } from './png-export.js';
import { createReviewFile, readReviewFile, ReviewSourceMismatchError, REVIEW_FILE_LIMIT } from './review-file.js';
import { addNamedReview, renameNamedReview, removeNamedReview, getNamedReview, namedReviewCandidate } from './named-reviews.js';
import { inspectDocumentPoint } from './native-inspection.js';
import { inspectDocumentGeometry, geometryInspectionDefaults } from './geometry-inspection.js';
import { prepareInspectedDistancePoint, measureInspectedDistance } from './inspection-distance.js';
import { handleCameraKey } from './keyboard-controls.js';
import { prepareAssemblyPoint, retainVisibleAssemblyPoints, measureAssemblyPointPair } from './assembly-points.js';

export const sameRef = (a, b) => a?.kind === b?.kind && a?.modelId === b?.modelId
  && (a?.surfaceId ?? a?.curveId) === (b?.surfaceId ?? b?.curveId);
const surfaceKey = ref => JSON.stringify([ref.modelId, ref.surfaceId]);
const presets = {
  blue: '@shader #viewer_blue { @fragment { color: #2867D8; } }',
  copper: '@shader #viewer_copper { @fragment { color: #B87333; } }',
};
const viewDirections = {
  iso: { direction: [1, 1, 1].map(value => value / Math.sqrt(3)), up: [0, 1, 0] },
  front: { direction: [0, 0, 1], up: [0, 1, 0] },
  top: { direction: [0, 1, 0], up: [0, 0, -1] },
  right: { direction: [1, 0, 0], up: [0, 1, 0] },
};
const summary = value => value && ({ kind: value.kind, label: value.label, id: value.id,
  revision: value.revision, catalog: value.catalog });
const emptyMeasurement = () => ({ active: false, points: [], result: null, error: '' });
const pointRef = input => input.kind === 'surface'
  ? { kind: input.kind, modelId: input.modelId, surfaceId: input.surfaceId }
  : { kind: input.kind, modelId: input.modelId, curveId: input.curveId };

// File data is copied by the codec before this check. SDK validation remains the
// authority for the complete review and is always run before applying a match.
function checkReviewSceneForUser(saved, current) {
  if (saved.kind !== current.kind || saved.id !== current.id || saved.revision !== current.revision
    || saved.mmToSceneUnit !== current.mmToSceneUnit)
    throw new Error('Review scene or scale differs. Open the original CAD file used for this review.');
  if (saved.members.length !== current.members.length
    || saved.members.some((member, index) => member !== current.members[index])) {
    const target = current.kind === 'assembly' ? 'instances' : 'bodies';
    throw new Error(`Loaded ${target} differ. Use Choose ${target} to load the same ${target} as the review.`);
  }
}

// Validate against the target review visibility without changing the current scene.
export function prepareAssemblyReviewMeasurement(viewer, measurement, visibleGeometry) {
  if (measurement === null || measurement === undefined) return null;
  const state = viewer.getState();
  for (const input of [measurement.first, measurement.second]) {
    const binding = state.assemblyInstances.find(value => value.instanceId === input.instanceId);
    if (!binding || !visibleGeometry.some(ref => sameRef(ref, binding.ref)))
      throw new Error('Review points must reference admitted and visible instances.');
  }
  const result = viewer.measureAssemblyPoints(measurement.first, measurement.second);
  if (result.distanceMM !== measurement.distanceMM)
    throw new Error('Review distance differs from the original assembly points.');
  const point = value => ({ instanceId: value.instanceId, assemblyId: value.assemblyId,
    assemblyRevision: value.assemblyRevision, reference: structuredClone(value.reference),
    worldMatrix: [...value.worldMatrix], query: structuredClone(value.query),
    originalLocalPointMM: [...value.originalLocalPointMM], assemblyPointMM: [...value.assemblyPointMM] });
  return { points: [point(result.first), point(result.second)], distance: result.distanceMM };
}

function assemblyPointQuery(point) {
  return { assemblyId: point.assemblyId, assemblyRevision: point.assemblyRevision,
    instanceId: point.instanceId, reference: structuredClone(point.reference), query: structuredClone(point.query) };
}

/** Own the SDK lifetime and commands. React owns every screen element. */
export function createViewerController({ canvas, stage, onChange }) {
  let viewer, active = null, candidate = null, admitted = [], admissionIds = [];
  let startupState = 'starting', startupFailure = '', deviceStatus = '', disposed = false, startCalled = false, search = '';
  let documentEpoch = 0, reviewEpoch = 0, frameGeneration = 0, lastGuard;
  let png, pointerControls, keyboardControls, resizeObserver;
  let appearanceTarget = '', appearancePreset = 'default', appearanceBinding;
  let admissionError = '', status = 'Starting Viewer…', statusError = false, statusVersion = 0;
  let resizeFailed = false, resizeErrorVersion = -1;
  let exportStatus = '', exportBusy = false;
  let reviewBusy = false, reviewOperation = 0;
  let lightingError = '';
  let measurement = emptyMeasurement();
  let assemblyInspection = null;
  let assemblyPoints = [null, null];
  let assemblyDistance = null, assemblyDistanceError = '';
  let documentInspection = null;
  let geometryInspection = null;
  let namedViews = [], namedGeneration = 0, namedOperation = 0, namedBusy = false, namedViewError = '';
  let pickFilter = 'all';
  const listeners = [];
  const reviewUrls = new Set();
  const loaded = () => Boolean(active && viewer && startupState === 'available' && !disposed);
  const guard = () => {
    const rect = canvas.getBoundingClientRect();
    return JSON.stringify({ review: loaded() ? viewer.captureReviewState() : null,
      materials: viewer?.getState().surfaceMaterials ?? [], lighting: viewer?.getState().lighting ?? null, measurement,
      assemblyPoints, assemblyDistance,
      width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height });
  };
  function recordFrame() {
    const current = guard();
    if (current !== lastGuard) { frameGeneration++; lastGuard = current; }
    return current;
  }
  function message(text, error = false) { status = text; statusError = error; statusVersion++; }
  function projectedMeasurement(rect) {
    const overlay = { width: rect.width, height: rect.height, points: [] };
    if (!viewer) return overlay;
    measurement.points.forEach((point, index) => {
      // Projection is a display annotation. It does not test occlusion or change the framebuffer.
      try {
        const projected = viewer.projectNativePoint(point.input);
        if (projected) overlay.points.push({ label: index === 0 ? 'A' : 'B',
          xCss: projected.xCss, yCss: projected.yCss });
      } catch { /* A lost GPU context can make a display annotation unavailable. */ }
    });
    return overlay;
  }
  function refresh() {
    if (disposed) return;
    const state = viewer?.getState() ?? null;
    let appearanceNote = 'Load a Surface to change its appearance.';
    let viewPreset = null;
    const rect = canvas.getBoundingClientRect();
    let measurementOverlay = { width: rect.width, height: rect.height, points: [] };
    let pointMeasurementActions = { canSetA: false, canSetB: false, secondReason: 'Set point A first.' };
    if (state) {
      recordFrame();
      const retainedPoints = active?.kind === 'assembly' ? retainVisibleAssemblyPoints(assemblyPoints, state) : [null, null];
      if (retainedPoints.some((point, index) => point !== assemblyPoints[index])) {
        assemblyDistance = null; assemblyDistanceError = '';
      }
      assemblyPoints = retainedPoints;
      const instance = active?.kind === 'assembly'
        ? state.assemblyInstances.find(binding => sameRef(binding.ref, state.selectedGeometry)) : null;
      if (!instance) assemblyInspection = null;
      else if (assemblyInspection?.instanceId !== instance.instanceId) {
        const query = active.catalog.find(row => row.id === instance.instanceId)?.nativeQuery;
        if (query) inspectAssemblyPoint(instance, query);
      }
      const body = active?.kind === 'document'
        ? state.documentBodies.find(entry => sameRef(entry.ref, state.selectedGeometry)) : null;
      if (!body) { documentInspection = null; geometryInspection = null; }
      else {
        const entry = active.catalog.find(row => row.id === body.binding.bodyId);
        if (documentInspection?.bodyId !== body.binding.bodyId && entry?.nativeQuery)
          inspectDocumentBodyPoint(body, entry.nativeQuery);
        if (geometryInspection?.bodyId !== body.binding.bodyId)
          geometryInspection = { bodyId: body.binding.bodyId, label: entry?.name ?? body.binding.bodyId,
            kind: body.ref.kind, options: geometryInspectionDefaults(body.ref.kind), result: null, error: '', busy: false };
      }
      if (measurement.points.some(point => !state.visibleGeometry.some(ref => sameRef(ref, pointRef(point.input))))) {
        measurement = emptyMeasurement();
        message('Distance cleared because a measured body was hidden.');
      }
      const canSetA = Boolean(body && documentInspection?.bodyId === body.binding.bodyId
        && documentInspection.result && state.visibleGeometry.some(ref => sameRef(ref, body.ref)));
      const first = measurement.points[0];
      const secondReason = !first ? 'Set point A first.' : first.input.modelId !== body?.ref.modelId
        ? 'Choose a point in the same asset as point A.' : '';
      pointMeasurementActions = { canSetA, canSetB: canSetA && !secondReason, secondReason };
      measurementOverlay = projectedMeasurement(rect);
      if (!state.surfaces.some(ref => surfaceKey(ref) === appearanceTarget))
        appearanceTarget = state.surfaces[0] ? surfaceKey(state.surfaces[0]) : '';
      const ref = state.surfaces.find(ref => surfaceKey(ref) === appearanceTarget);
      const tagged = ref && { kind: 'surface', ...ref };
      const binding = ref && state.surfaceMaterials.find(entry =>
        entry.ref.modelId === ref.modelId && entry.ref.surfaceId === ref.surfaceId);
      const stamp = JSON.stringify([appearanceTarget, binding || null]);
      if (stamp !== appearanceBinding) {
        appearancePreset = binding
          ? Object.keys(presets).find(key => presets[key] === binding.binding.material.source) || 'default' : 'default';
        appearanceBinding = stamp;
      }
      if (active?.kind === 'assembly') appearanceNote = 'Material changes are unavailable for assembly instances.';
      else if (ref) appearanceNote = !state.visibleGeometry.some(value => sameRef(value, tagged))
        ? 'Show this Surface first.' : sameRef(state.selectedGeometry, tagged)
          ? 'Clear the Surface selection before applying.' : binding
            ? 'Choose Default to enable Surface selection and hiding.' : 'Changes apply to this session.';
      if (loaded()) {
        const camera = viewer.captureReviewState().camera;
        const offset = camera.eye.map((value, index) => value - camera.target[index]);
        const distance = Math.hypot(...offset);
        viewPreset = Object.entries(viewDirections).find(([, view]) =>
          view.direction.every((value, index) => Math.abs(value - offset[index] / distance) < 1e-6)
          && view.up.every((value, index) => Math.abs(value - camera.up[index]) < 1e-6))?.[0] ?? null;
      }
    }
    onChange({ ready: loaded(), startupState, startupFailure, deviceStatus, active: summary(active), admitted: [...admitted], state,
      search, candidate: summary(candidate), admissionIds: [...admissionIds], admissionError,
      status, statusError, exportStatus, exportBusy, reviewBusy, viewPreset, appearanceTarget,
      appearancePreset, appearanceNote, lightingCapabilities: viewer?.getLightingCapabilities() ?? null,
      lightingError, measurement: structuredClone(measurement), measurementOverlay,
      pointMeasurementActions,
      assemblyInspection: assemblyInspection ? structuredClone(assemblyInspection) : null,
      assemblyPoints: structuredClone(assemblyPoints),
      assemblyDistance, assemblyDistanceError,
      documentInspection: documentInspection ? structuredClone(documentInspection) : null,
      geometryInspection: geometryInspection ? structuredClone(geometryInspection) : null,
      namedViews: namedViews.map(entry => entry.name), namedBusy, namedViewError, pickFilter });
  }
  function inspectAssemblyPoint(binding, query) {
    try {
      const result = viewer.queryAssemblyInstancePoint({ assemblyId: binding.assemblyId,
        assemblyRevision: binding.assemblyRevision, instanceId: binding.instanceId,
        reference: binding.reference, query });
      assemblyInspection = { instanceId: binding.instanceId, query: { ...query }, result, error: '' };
      if (assemblyDistanceError && assemblyPoints.every(Boolean)) updateAssemblyDistance();
    } catch (error) {
      const previous = assemblyInspection?.instanceId === binding.instanceId ? assemblyInspection : null;
      assemblyInspection = { instanceId: binding.instanceId, query: previous?.query ?? { ...query },
        result: previous?.result ?? null, error: error?.message || String(error) };
    }
  }
  function updateAssemblyDistance() {
    assemblyDistance = null; assemblyDistanceError = '';
    if (!assemblyPoints.every(Boolean)) return;
    try { assemblyDistance = measureAssemblyPointPair(viewer, assemblyPoints); }
    catch (error) { assemblyDistanceError = error?.message || String(error); }
  }
  function inspectDocumentBodyPoint(binding, query) {
    const bodyId = binding.binding.bodyId;
    const body = active.catalog.find(row => row.id === bodyId);
    if (!body?.nativeDomain) { documentInspection = null; return; }
    try {
      const result = inspectDocumentPoint(active, viewer.getState(), query);
      documentInspection = { bodyId, label: body.name, query: { ...query },
        domain: structuredClone(body.nativeDomain), result, error: '' };
    } catch (error) {
      const previous = documentInspection?.bodyId === bodyId ? documentInspection : null;
      documentInspection = { bodyId, label: body.name, query: previous?.query ?? { ...query },
        domain: structuredClone(body.nativeDomain), result: previous?.result ?? null,
        error: error?.message || String(error) };
    }
  }
  function measuredPoint(input, point) {
    const state = viewer.getState();
    const binding = state.documentBodies.find(body => sameRef(body.ref, pointRef(input)))?.binding;
    const name = active.catalog.find(body => body.id === binding?.bodyId)?.name
      || input.surfaceId || input.curveId;
    return { input, label: name + (binding ? ' · ' + binding.assetId : ''), kind: input.kind,
      pointMM: [...point.pointMM], parameterLabel: input.kind === 'surface'
        ? `u = ${input.u.toPrecision(7)}, v = ${input.v.toPrecision(7)}` : `t = ${input.t.toPrecision(7)}` };
  }
  function pickMeasurement(hit) {
    try {
      if (!hit) throw new Error('Choose a point on visible geometry.');
      if (hit.ambiguous) throw new Error('This point is ambiguous. Choose another point.');
      const input = hit.kind === 'surface'
        ? { kind: 'surface', ...hit.ref, u: hit.parameterUV[0], v: hit.parameterUV[1] }
        : { kind: 'curve', ...hit.ref, t: hit.parameterApprox };
      const first = measurement.points[0];
      if (first && first.input.modelId !== input.modelId)
        throw new Error('Choose the second point in the same asset as point A.');
      if (!first) {
        const projected = viewer.projectNativePoint(input);
        if (!projected) throw new Error('Choose a point inside the view.');
        measurement = { active: true, points: [measuredPoint(input, projected.point)], result: null, error: '' };
        message('Point A set. Choose point B in the same asset.');
      } else {
        const result = viewer.measureNativePoints(first.input, input);
        measurement = { active: false, points: [measuredPoint(first.input, result.first), measuredPoint(input, result.second)],
          result: { distanceMM: result.distanceMM }, error: '' };
        message('Distance measured in native millimetres.');
      }
    } catch (error) {
      measurement = { ...measurement, error: error?.message || String(error) };
      message(measurement.error, true);
    }
    refresh();
  }
  function run(action, text) {
    if (!loaded()) return;
    try { action(); message(text); }
    catch (error) { message(error?.message || String(error), true); }
    refresh();
  }
  function pickAt(event) {
    const rect = canvas.getBoundingClientRect();
    return viewer.pickGeometry({ xCss: event.clientX - rect.left, yCss: event.clientY - rect.top },
      { kinds: pickFilter === 'all' ? ['surface', 'curve'] : [pickFilter] });
  }
  function captureSnapshot() {
    const native = measurement.result ? { first: measurement.points[0].input,
      second: measurement.points[1].input, distanceMM: measurement.result.distanceMM,
      metric: 'straight-line', space: 'native-authored', certification: 'not-certified' } : null;
    return { review: viewer.captureReviewState(), measurement: native,
      ...(viewer.getLightingCapabilities().supported ? { lighting: viewer.getState().lighting } : {}) };
  }
  function captureAssemblyMeasurement(review) {
    if (active.kind !== 'assembly' || assemblyDistance === null || !assemblyPoints.every(Boolean)) return null;
    const measurement = { first: assemblyPointQuery(assemblyPoints[0]), second: assemblyPointQuery(assemblyPoints[1]),
      distanceMM: assemblyDistance, metric: 'straight-line', space: 'assembly-space-xyz', certification: 'not-certified' };
    prepareAssemblyReviewMeasurement(viewer, measurement, review.visibleGeometry);
    return measurement;
  }
  function applySnapshot(candidate) {
    const restored = viewer.applyMeasuredReviewState(candidate);
    lightingError = '';
    measurement = restored ? { active: false,
      points: [measuredPoint(candidate.measurement.first, restored.first), measuredPoint(candidate.measurement.second, restored.second)],
      result: { distanceMM: restored.distanceMM }, error: '' } : emptyMeasurement();
  }
  async function changeNamedViews(action, text) {
    if (!loaded() || reviewBusy || namedBusy) return false;
    const source = active, epoch = reviewEpoch, before = recordFrame(), version = frameGeneration, listVersion = namedGeneration;
    const operation = ++namedOperation;
    namedBusy = true; refresh();
    try {
      const snapshot = captureSnapshot(), next = action(snapshot);
      viewer.validateMeasuredReviewState(namedReviewCandidate(snapshot));
      // Use the actual file codec to check the complete list's snapshot and 32 KiB export budget.
      const file = await createReviewFile(snapshot.review, snapshot.measurement, active.source, snapshot.lighting,
        next, undefined, active.origin);
      if (new TextEncoder().encode(JSON.stringify(file) + '\n').byteLength > REVIEW_FILE_LIMIT)
        throw new Error('Review files must be 32 KiB or smaller.');
      if (disposed || source !== active || epoch !== reviewEpoch || operation !== namedOperation) return false;
      if (before !== recordFrame() || version !== frameGeneration || listVersion !== namedGeneration)
        throw new Error('The view or saved views changed. Try again.');
      namedViews = next; namedGeneration++; namedViewError = ''; message(text); return true;
    } catch (error) {
      if (!disposed && source === active && epoch === reviewEpoch && operation === namedOperation) {
        namedViewError = error?.message || String(error); message(namedViewError, true);
      }
      return false;
    } finally { if (operation === namedOperation) { namedBusy = false; refresh(); } }
  }
  function chooseBodies(next, defaults = next.defaultBodyIds) {
    candidate = next; admissionError = '';
    admissionIds = defaults.filter(id => next.catalog.some(body => body.id === id && body.supported));
    refresh();
  }
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }
  function cancelCandidate() {
    documentEpoch++; candidate = null; admissionIds = []; admissionError = ''; refresh();
  }
  const evidence = {
    state: () => viewer?.getState(), review: () => loaded() ? viewer.captureReviewState() : null,
    pixels: () => viewer?.readPixels(), document: () => viewer?.getState().document,
    source: () => active ? structuredClone(active.source) : null,
    namedViews: () => structuredClone(namedViews),
  };
  const api = {
    async start() {
      if (startCalled || disposed) return;
      startCalled = true; refresh();
      const listenerStart = listeners.length;
      try {
        const created = await createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.026, 0.033, 0.045],
          onDeviceEvent(event) {
            if (disposed || startupState === 'failed') return;
            if (event.type === 'lost') {
              if (deviceStatus !== 'WebGPU recovery failed') deviceStatus = 'WebGPU device lost';
            }
            // Candidate event name; the GPU recovery-failure contract is not connected yet.
            else if (event.type === 'recovery-failed') deviceStatus = 'WebGPU recovery failed';
            else if (event.type === 'recreated') deviceStatus = 'WebGPU device recreated';
            else return;
            refresh();
          } });
        if (disposed) { created.dispose(); return; }
        viewer = created;
        const controlError = error => { message(error?.message || String(error), true); refresh(); };
        listen(window, 'keydown', event => {
          if (event.target !== canvas || event.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
          if (handleCameraKey(event, { canvas, viewer, isLoaded: loaded, onError: controlError })) return;
          if (event.repeat) return;
          if (event.shiftKey && event.key.toLowerCase() === 'f') {
            event.preventDefault(); event.stopPropagation(); api.fitSelected(); return;
          }
          if (event.target === canvas && event.key === 'Escape' && measurement.active) {
            event.preventDefault(); event.stopPropagation(); api.cancelMeasurement();
          }
        }, { capture: true });
        pointerControls = viewer.attachPointerControls({ onError: controlError });
        keyboardControls = viewer.attachKeyboardControls({ onError: controlError });
        listen(canvas, 'pointerdown', event => {
          if (event.isPrimary && event.button === 0) canvas.focus({ preventScroll: true });
        });
        // The SDK installs capture-phase drag-click suppression before the host pick handler.
        for (const type of ['pointermove', 'wheel', 'keydown']) listen(canvas, type, event => {
          if (event.defaultPrevented) refresh();
        }, type === 'wheel' ? { passive: true } : undefined);
        listen(canvas, 'click', event => {
          if (!loaded() || event.button !== 0) return;
          if (measurement.active) {
            try {
              pickMeasurement(pickAt(event));
            } catch (error) {
              measurement = { ...measurement, error: error?.message || String(error) };
              message(measurement.error, true); refresh();
            }
            return;
          }
          run(() => {
            const hit = pickAt(event);
            if (hit?.ambiguous) throw new Error('The pick is ambiguous. Choose another point.');
            viewer.selectGeometry(hit ? { kind: hit.kind, ...hit.ref } : null);
          }, 'Selection updated.');
        });
        png = createPngExport({ viewer, canvas, isLoaded: loaded, frameGuard: recordFrame,
          generation: () => frameGeneration, onChange(value) {
            exportBusy = value.busy; exportStatus = value.status; refresh();
          } });
        resizeObserver = new ResizeObserver(() => {
          const rect = stage.getBoundingClientRect();
          if (disposed || rect.width <= 0 || rect.height <= 0) return;
          const scale = Math.min(devicePixelRatio || 1, 2, 4096 / rect.width, 4096 / rect.height,
            Math.sqrt(4194304 / (rect.width * rect.height)));
          const width = Math.max(1, Math.floor(rect.width * scale));
          const height = Math.max(1, Math.floor(rect.height * scale));
          if (!resizeFailed && canvas.width === width && canvas.height === height) return;
          try {
            viewer.resize(width, height);
            resizeFailed = false;
            if (statusVersion === resizeErrorVersion) message('Viewport resized.');
          } catch (error) {
            resizeFailed = true;
            message(error?.message || String(error), true);
            resizeErrorVersion = statusVersion;
          }
          refresh();
        });
        resizeObserver.observe(stage);
        window.cadViewerEvidence = evidence;
        startupState = 'available'; message('Open a CAD document to begin.'); refresh();
      } catch (error) {
        if (disposed) return;
        const failedViewer = viewer; viewer = undefined;
        startupState = 'failed';
        deviceStatus = '';
        startupFailure = ['WEBGPU_UNAVAILABLE', 'NO_ADAPTER'].includes(error?.code)
          ? 'WebGPU unavailable' : 'Viewer could not start';
        message(startupFailure, true);
        // Startup may fail after only some controls, listeners, or observers exist.
        for (const cleanup of [() => png?.dispose(), () => pointerControls?.dispose(),
          () => keyboardControls?.dispose(), () => resizeObserver?.disconnect(),
          ...listeners.splice(listenerStart), () => failedViewer?.dispose()]) {
          try { cleanup(); } catch { /* Continue releasing the remaining resources. */ }
        }
        png = pointerControls = keyboardControls = resizeObserver = undefined;
        if (window.cadViewerEvidence === evidence) delete window.cadViewerEvidence;
        console.error('CAD Viewer initialization:', error); refresh();
      }
    },
    beginDocumentPick() { if (startupState === 'available') documentEpoch++; },
    cancelDocumentPick() { documentEpoch++; },
    async openDocument(file) {
      if (startupState !== 'available') return;
      const request = ++documentEpoch;
      try {
        const next = await readSource(file);
        if (request !== documentEpoch || disposed) return;
        chooseBodies(next);
      } catch (error) { if (request === documentEpoch && !disposed) {
        message('Document not opened: ' + error.message, true); refresh();
      } }
    },
    async openSample(kind = 'document') {
      if (startupState !== 'available') return;
      const request = ++documentEpoch;
      try {
        const response = await fetch(kind === 'assembly' ? '/sample.cad-assembly.json' : '/sample.cad-document.json');
        if (!response.ok) throw new Error('The sample is unavailable.');
        const text = await response.text();
        if (request !== documentEpoch || disposed) return;
        chooseBodies(parseSource(text, kind === 'assembly' ? 'Sample assembly' : 'Sample document'));
      } catch (error) { if (request === documentEpoch && !disposed) { message(error.message, true); refresh(); } }
    },
    openBodies() { if (loaded()) { documentEpoch++; chooseBodies(active, admitted); } },
    cancelCandidate,
    closeDocument() {
      if (!loaded()) return false;
      let previous;
      try { previous = viewer.captureReviewState(); viewer.clear(); }
      catch (error) {
        let detail = error?.message || String(error);
        if (previous) {
          try { viewer.applyReviewState(previous); }
          catch (recoveryError) { detail += `. View recovery failed: ${recoveryError?.message || String(recoveryError)}`; }
        }
        message('Document not closed: ' + detail, true); refresh(); return false;
      }
      active = candidate = null; admitted = []; admissionIds = []; admissionError = '';
      measurement = emptyMeasurement(); assemblyInspection = null; assemblyPoints = [null, null];
      assemblyDistance = null; assemblyDistanceError = ''; documentInspection = null; geometryInspection = null;
      namedViews = []; namedGeneration++; namedOperation++; namedBusy = false; namedViewError = '';
      reviewBusy = false; reviewOperation++; documentEpoch++; reviewEpoch++; frameGeneration++;
      appearanceTarget = ''; appearancePreset = 'default'; appearanceBinding = undefined;
      lightingError = ''; pickFilter = 'all'; search = '';
      png?.cancel();
      exportStatus = '';
      message('Document closed.'); refresh(); return true;
    },
    toggleAdmission(id, checked) {
      if (!candidate?.catalog.some(body => body.id === id && body.supported)) return;
      if (checked && !admissionIds.includes(id) && admissionIds.length < 4) admissionIds = [...admissionIds, id];
      if (!checked) admissionIds = admissionIds.filter(value => value !== id);
      refresh();
    },
    /** @param {{ targetId: string, replacedId: string } | null} replacement */
    admit(replacement = null) {
      if (!candidate || !viewer) return;
      try {
        let ids = [...admissionIds];
        if (replacement) {
          const { targetId, replacedId } = replacement;
          if (candidate !== active || ids.length !== 4 || admitted.length !== 4
            || ids.some((id, index) => id !== admitted[index]) || !ids.includes(replacedId)
            || ids.includes(targetId) || !candidate.catalog.some(row => row.id === targetId && row.supported))
            throw new Error('The replacement is no longer available. Choose again.');
          ids = ids.map(id => id === replacedId ? targetId : id);
        }
        const sameDocument = candidate === active;
        const previous = replacement ? viewer.captureReviewState() : null;
        try { admitSource(viewer, candidate, ids); }
        catch (error) {
          if (previous) {
            try { viewer.applyReviewState(previous); }
            catch (recoveryError) {
              throw new Error(`Replacement failed: ${error?.message || String(error)}. View recovery failed: ${recoveryError?.message || String(recoveryError)}`);
            }
          }
          throw error;
        }
        active = candidate; admitted = ids; candidate = null; admissionIds = [];
        measurement = emptyMeasurement(); lightingError = '';
        assemblyInspection = null;
        if (!sameDocument) { assemblyPoints = [null, null]; assemblyDistance = null; assemblyDistanceError = ''; }
        else {
          assemblyPoints = retainVisibleAssemblyPoints(assemblyPoints, viewer.getState());
          updateAssemblyDistance();
        }
        documentInspection = null;
        geometryInspection = null;
        namedViews = []; namedGeneration++; namedOperation++; namedBusy = false; namedViewError = '';
        reviewBusy = false; reviewOperation++;
        pickFilter = 'all';
        documentEpoch++; reviewEpoch++; frameGeneration++;
        appearanceBinding = undefined; appearanceTarget = ''; search = '';
        message(active.kind === 'assembly' ? 'Assembly opened. Select an occurrence to inspect its original placement.'
          : 'Document opened. Drag to orbit. Shift+drag to pan.'); refresh();
      } catch (error) { admissionError = error.message; refresh(); }
    },
    setSearch(value) { search = value; refresh(); },
    setPickFilter(value) {
      if (!loaded()) return;
      if (!['all', 'surface', 'curve'].includes(value)) { message('Choose All, Surface or Curve.', true); refresh(); return; }
      pickFilter = value;
      message(value === 'all' ? 'Viewport picks include Surfaces and Curves.'
        : `Viewport picks include only ${value === 'surface' ? 'Surfaces' : 'Curves'}.`);
      refresh();
    },
    saveNamedView(name) {
      if (measurement.active) { namedViewError = 'Finish or cancel point selection before saving a view.'; refresh(); return Promise.resolve(false); }
      return changeNamedViews(snapshot => addNamedReview(namedViews, { name, ...snapshot }, snapshot.review.scene), 'Saved view added.');
    },
    renameNamedView(name, nextName) {
      return changeNamedViews(snapshot => renameNamedReview(namedViews, name, nextName, snapshot.review.scene), 'Saved view renamed.');
    },
    deleteNamedView(name) {
      return changeNamedViews(snapshot => removeNamedReview(namedViews, name, snapshot.review.scene), 'Saved view deleted.');
    },
    restoreNamedView(name) {
      if (!loaded() || reviewBusy || namedBusy) return;
      try {
        const entry = getNamedReview(namedViews, name, viewer.captureReviewState().scene);
        applySnapshot(namedReviewCandidate(entry)); namedViewError = '';
        message('Saved view restored: ' + name);
      } catch (error) { namedViewError = error?.message || String(error); message(namedViewError, true); }
      refresh();
    },
    startMeasurement() {
      if (!loaded()) return;
      if (active.kind === 'assembly') { message('Native distance measurement is unavailable in assembly mode.', true); refresh(); return; }
      measurement = { ...emptyMeasurement(), active: true };
      message('Distance: choose point A on the model.'); refresh();
      canvas.focus({ preventScroll: true });
    },
    cancelMeasurement() {
      measurement = emptyMeasurement(); message('Distance selection cancelled.'); refresh();
    },
    clearMeasurement() {
      // The public SDK retains its last query cache. Never clear the CAD scene to clear a UI tool.
      measurement = emptyMeasurement(); message('Distance cleared.'); refresh();
    },
    select(ref) { run(() => viewer.selectGeometry(ref), ref ? 'Body selected.' : 'Selection cleared.'); },
    setVisibility(ref, checked) { run(() => {
      const current = viewer.getState();
      viewer.setVisibleGeometry(checked ? [...current.visibleGeometry, ref]
        : current.visibleGeometry.filter(value => !sameRef(value, ref)));
    }, 'Visibility updated.'); },
    fit() { run(() => viewer.fit(), 'View fitted.'); },
    fitSelected() { run(() => {
      const selected = viewer.getState().selectedGeometry;
      if (!selected) throw new Error('Select a visible body or instance first.');
      viewer.fitGeometry(selected);
    }, 'Selected geometry fitted in an isometric view.'); },
    standardView(name) { run(() => {
      const view = viewDirections[name];
      if (!view) throw new Error('Choose a standard view.');
      const camera = viewer.captureReviewState().camera;
      const distance = Math.hypot(...camera.eye.map((value, index) => value - camera.target[index]));
      viewer.setView({ ...camera, eye: camera.target.map((value, index) => value + distance * view.direction[index]), up: [...view.up] });
    }, name === 'iso' ? 'Isometric view.' : name[0].toUpperCase() + name.slice(1) + ' view.'); },
    showAll() { run(() => {
      const state = viewer.getState();
      viewer.setVisibleGeometry([...state.surfaces.map(ref => ({ kind: 'surface', ...ref })),
        ...state.curves.map(ref => ({ kind: 'curve', ...ref }))]);
    }, 'All loaded bodies shown.'); },
    hideSelected() { run(() => {
      const state = viewer.getState();
      viewer.setVisibleGeometry(state.visibleGeometry.filter(ref => !sameRef(ref, state.selectedGeometry)));
    }, 'Selected body hidden.'); },
    isolateSelected() { run(() => {
      const selected = viewer.getState().selectedGeometry;
      if (!selected) throw new Error('Select a body first.');
      viewer.setVisibleGeometry([selected]);
    }, 'Selected body isolated.'); },
    setAppearanceTarget(value) { appearanceTarget = value; refresh(); },
    setAppearancePreset(value) { appearancePreset = value; refresh(); },
    inspectAssemblyPoint(query) {
      if (!loaded() || active.kind !== 'assembly') return;
      const binding = viewer.getState().assemblyInstances.find(value => sameRef(value.ref, viewer.getState().selectedGeometry));
      if (!binding) { message('Select a loaded assembly instance first.', true); refresh(); return; }
      inspectAssemblyPoint(binding, query);
      message(assemblyInspection.error || assemblyDistanceError || 'Original native point inspected in part and assembly coordinates.',
        Boolean(assemblyInspection.error || assemblyDistanceError));
      refresh();
    },
    setAssemblyPoint(endpoint) {
      if (!loaded() || active.kind !== 'assembly' || !['a', 'b'].includes(endpoint)) return;
      try {
        const point = prepareAssemblyPoint(viewer, assemblyInspection);
        assemblyPoints = assemblyPoints.map((old, index) => index === (endpoint === 'a' ? 0 : 1) ? point : old);
        updateAssemblyDistance();
        message(assemblyDistanceError || `Point ${endpoint.toUpperCase()} set.`, Boolean(assemblyDistanceError));
      } catch (error) {
        assemblyDistance = null; assemblyDistanceError = error?.message || String(error);
        message(assemblyDistanceError, true);
      }
      refresh();
    },
    clearAssemblyPoints() { assemblyPoints = [null, null]; assemblyDistance = null; assemblyDistanceError = ''; refresh(); },
    inspectDocumentPoint(query) {
      if (!loaded() || active.kind !== 'document') return;
      const state = viewer.getState();
      const body = state.documentBodies.find(entry => sameRef(entry.ref, state.selectedGeometry));
      if (!body) { message('Select a visible document body first.', true); refresh(); return; }
      inspectDocumentBodyPoint(body, query);
      message(documentInspection?.error || 'Original native point inspected in authored millimetres.', Boolean(documentInspection?.error));
      refresh();
    },
    setInspectedMeasurementPoint(endpoint) {
      if (!loaded() || active.kind !== 'document') return;
      try {
        if (endpoint === 'a') {
          const point = prepareInspectedDistancePoint(active, viewer.getState(), documentInspection);
          // Preparing A leaves the SDK's last successful distance cache intact.
          measurement = { active: true, points: [measuredPoint(point.input, point.point)], result: null, error: '' };
          message('Point A set from the evaluated native point. Choose point B.');
        } else if (endpoint === 'b') {
          const first = measurement.points[0];
          if (!first) throw new Error('Set point A first.');
          const { point, result } = measureInspectedDistance(viewer, active, documentInspection, first.input);
          measurement = { active: false,
            points: [measuredPoint(first.input, result.first), measuredPoint(point.input, result.second)],
            result: { distanceMM: result.distanceMM }, error: '' };
          message('Distance measured from evaluated native points.');
        } else throw new Error('Choose distance point A or B.');
      } catch (error) {
        measurement = { ...measurement, error: error?.message || String(error) };
        message(measurement.error, true);
      }
      refresh();
    },
    async calculateDocumentGeometry(input) {
      if (!loaded() || active.kind !== 'document' || !geometryInspection || geometryInspection.busy) return;
      const context = geometryInspection, source = active, ref = viewer.getState().selectedGeometry;
      const options = { ...input };
      context.busy = true; context.error = ''; refresh();
      try {
        // Give the busy state a rendering opportunity before the bounded synchronous CAD query.
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (disposed || active !== source || geometryInspection !== context
          || !sameRef(viewer.getState().selectedGeometry, ref)) return;
        const result = inspectDocumentGeometry(active, viewer.getState(), options);
        context.result = result;
        context.options = { absoluteTolerance: result.absoluteTolerance, relativeTolerance: result.relativeTolerance };
        message(context.kind === 'curve' ? 'Original Curve length estimated.' : 'Original Surface area estimated.');
      } catch (error) {
        if (!disposed && active === source && geometryInspection === context) {
          context.error = error?.message || String(error); message(context.error, true);
        }
      } finally {
        if (!disposed && geometryInspection === context) { context.busy = false; refresh(); }
      }
    },
    applyLighting(input) {
      if (!loaded()) return;
      try { viewer.setLighting(input); lightingError = ''; message('Lighting applied.'); }
      catch (error) { lightingError = error?.message || String(error); message(lightingError, true); }
      refresh();
    },
    resetLighting() { api.applyLighting(null); },
    applyAppearance() { run(() => {
      if (active.kind === 'assembly') throw new Error('Material changes are unavailable for assembly instances.');
      const ref = viewer.getState().surfaces.find(ref => surfaceKey(ref) === appearanceTarget);
      if (!ref) throw new Error('Choose a loaded Surface.');
      if (appearancePreset === 'default') viewer.setSurfaceMaterial(ref, null);
      else {
        if (!Object.hasOwn(presets, appearancePreset)) throw new Error('Choose an appearance.');
        const compiled = compileMeshMaterial(presets[appearancePreset]);
        if (!compiled.ok) throw new Error('The appearance could not be compiled.');
        viewer.setSurfaceMaterial(ref, { material: compiled.material, uniforms: {} });
      }
    }, 'Appearance applied.'); },
    async downloadReview() {
      if (!loaded() || reviewBusy || namedBusy) return;
      if (measurement.active) { message('Finish or cancel point selection before saving.', true); refresh(); return; }
      const request = ++reviewEpoch, before = recordFrame(), version = frameGeneration, listVersion = namedGeneration;
      const operation = ++reviewOperation;
      reviewBusy = true; refresh();
      try {
        const snapshot = captureSnapshot();
        const assemblyMeasurement = captureAssemblyMeasurement(snapshot.review);
        const file = await createReviewFile(snapshot.review, snapshot.measurement, active.source, snapshot.lighting, namedViews,
          active.kind === 'assembly' ? assemblyMeasurement : undefined, active.origin);
        if (request !== reviewEpoch || disposed) return;
        if (before !== recordFrame() || version !== frameGeneration || listVersion !== namedGeneration)
          throw new Error('The view or saved views changed. Save the review again.');
        const text = JSON.stringify(file) + '\n';
        if (new TextEncoder().encode(text).byteLength > REVIEW_FILE_LIMIT) throw new Error('Review files must be 32 KiB or smaller.');
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        reviewUrls.add(url);
        const link = document.createElement('a'); link.href = url; link.download = 'viewer-review.json'; link.click();
        setTimeout(() => { URL.revokeObjectURL(url); reviewUrls.delete(url); }, 1000);
        message('Review saved.');
      } catch (error) { if (request === reviewEpoch && !disposed) message('Review not saved: ' + error.message, true); }
      finally { if (operation === reviewOperation) { reviewBusy = false; refresh(); } }
    },
    beginReviewPick() { reviewEpoch++; },
    cancelReviewPick() { reviewEpoch++; },
    async openReview(file) {
      const request = ++reviewEpoch;
      if (!file || !loaded()) return;
      const before = recordFrame(), version = frameGeneration, listVersion = namedGeneration;
      try {
        if (file.size > REVIEW_FILE_LIMIT) throw new Error('Review files must be 32 KiB or smaller.');
        const text = await file.text();
        if (request !== reviewEpoch || disposed) return;
        const read = await readReviewFile(text, active.source, active.origin);
        const { candidate, legacy } = read;
        if (request !== reviewEpoch || disposed) return;
        if (before !== recordFrame() || version !== frameGeneration || listVersion !== namedGeneration)
          throw new Error('The view or saved views changed. Open the review again.');
        checkReviewSceneForUser(candidate.review.scene, viewer.captureReviewState().scene);
        viewer.validateMeasuredReviewState(candidate);
        if (Object.hasOwn(read, 'namedViews'))
          for (const entry of read.namedViews) viewer.validateMeasuredReviewState(namedReviewCandidate(entry));
        const assemblyRestored = active.kind === 'assembly'
          ? prepareAssemblyReviewMeasurement(viewer, read.assemblyMeasurement, candidate.review.visibleGeometry) : null;
        applySnapshot(candidate);
        if (active.kind === 'assembly') {
          assemblyPoints = assemblyRestored?.points ?? [null, null];
          assemblyDistance = assemblyRestored?.distance ?? null; assemblyDistanceError = '';
        }
        if (Object.hasOwn(read, 'namedViews')) { namedViews = read.namedViews; namedGeneration++; }
        namedViewError = '';
        message(legacy ? 'View restored. This file has no saved measurement.' : 'Review opened.'); refresh();
      } catch (error) { if (request === reviewEpoch && !disposed) {
        const detail = error instanceof ReviewSourceMismatchError
          && (error.code === 'SOURCE_KIND_MISMATCH' || error.code === 'SOURCE_HASH_MISMATCH' || error.code === 'SOURCE_ORIGIN_MISMATCH')
          ? 'The CAD source differs. Open the original CAD file, then reopen this review.'
          : error?.message || String(error);
        message('Review not opened: ' + detail, true); refresh();
      } }
    },
    exportImage(includeMeasurement = false) {
      if (!loaded() || !png) return;
      if (includeMeasurement && !measurement.result) {
        message('Complete a distance measurement before exporting its annotation.', true); refresh(); return;
      }
      const overlay = includeMeasurement ? { ...projectedMeasurement(canvas.getBoundingClientRect()),
        distanceMM: measurement.result.distanceMM } : undefined;
      return png.exportImage({ overlay });
    },
    dispose() {
      if (disposed) return;
      disposed = true; documentEpoch++; reviewEpoch++;
      png?.dispose(); pointerControls?.dispose(); keyboardControls?.dispose();
      resizeObserver?.disconnect(); listeners.splice(0).forEach(remove => remove());
      viewer?.dispose();
      for (const url of reviewUrls) URL.revokeObjectURL(url);
      reviewUrls.clear();
      if (window.cadViewerEvidence === evidence) delete window.cadViewerEvidence;
    },
  };
  listen(window, 'pagehide', event => {
    documentEpoch++; reviewEpoch++; png?.cancel();
    if (!event.persisted) api.dispose();
  });
  return api;
}
