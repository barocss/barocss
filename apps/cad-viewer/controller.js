import { createViewer } from '@barocss/viewer';
import { compileMeshMaterial } from '@barocss/gpu';
import { parseSource, readSource, admitSource } from './source.js';
import { createPngExport } from './png-export.js';
import { createReviewFile, readReviewFile, REVIEW_FILE_LIMIT } from './review-file.js';
import { addNamedReview, renameNamedReview, removeNamedReview, getNamedReview, namedReviewCandidate } from './named-reviews.js';

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

/** Own the SDK lifetime and commands. React owns every screen element. */
export function createViewerController({ canvas, stage, onChange }) {
  let viewer, active = null, candidate = null, admitted = [], admissionIds = [];
  let starting = true, disposed = false, startCalled = false, search = '';
  let documentEpoch = 0, reviewEpoch = 0, frameGeneration = 0, lastGuard;
  let png, pointerControls, keyboardControls, resizeObserver;
  let appearanceTarget = '', appearancePreset = 'default', appearanceBinding;
  let admissionError = '', status = 'Starting Viewer…', statusError = false;
  let exportStatus = '', exportBusy = false;
  let reviewBusy = false;
  let lightingError = '';
  let measurement = emptyMeasurement();
  let assemblyInspection = null;
  let namedViews = [], namedGeneration = 0, namedBusy = false, namedViewError = '';
  const listeners = [];
  const reviewUrls = new Set();
  const loaded = () => Boolean(active && viewer && !disposed);
  const guard = () => JSON.stringify({ review: loaded() ? viewer.captureReviewState() : null,
    materials: viewer?.getState().surfaceMaterials ?? [], lighting: viewer?.getState().lighting ?? null, measurement,
    width: canvas.width, height: canvas.height });
  function recordFrame() {
    const current = guard();
    if (current !== lastGuard) { frameGeneration++; lastGuard = current; }
    return current;
  }
  function message(text, error = false) { status = text; statusError = error; }
  function refresh() {
    if (disposed) return;
    const state = viewer?.getState() ?? null;
    let appearanceNote = 'Load a Surface to change its appearance.';
    let viewPreset = null;
    const rect = canvas.getBoundingClientRect();
    const measurementOverlay = { width: rect.width, height: rect.height, points: [] };
    if (state) {
      recordFrame();
      const instance = active?.kind === 'assembly'
        ? state.assemblyInstances.find(binding => sameRef(binding.ref, state.selectedGeometry)) : null;
      if (!instance) assemblyInspection = null;
      else if (assemblyInspection?.instanceId !== instance.instanceId) {
        const query = active.catalog.find(row => row.id === instance.instanceId)?.nativeQuery;
        if (query) inspectAssemblyPoint(instance, query);
      }
      if (measurement.points.some(point => !state.visibleGeometry.some(ref => sameRef(ref, pointRef(point.input))))) {
        measurement = emptyMeasurement();
        message('Distance cleared because a measured body was hidden.');
      }
      measurement.points.forEach((point, index) => {
        // Projection is a display annotation. It does not test occlusion or change the framebuffer.
        try {
          const projected = viewer.projectNativePoint(point.input);
          if (projected) measurementOverlay.points.push({ label: index === 0 ? 'A' : 'B',
            xCss: projected.xCss, yCss: projected.yCss });
        } catch { /* A lost GPU context can make a display annotation unavailable. */ }
      });
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
    onChange({ ready: loaded(), starting, active: summary(active), admitted: [...admitted], state,
      search, candidate: summary(candidate), admissionIds: [...admissionIds], admissionError,
      status, statusError, exportStatus, exportBusy, reviewBusy, viewPreset, appearanceTarget,
      appearancePreset, appearanceNote, lightingCapabilities: viewer?.getLightingCapabilities() ?? null,
      lightingError, measurement: structuredClone(measurement), measurementOverlay,
      assemblyInspection: assemblyInspection ? structuredClone(assemblyInspection) : null,
      namedViews: namedViews.map(entry => entry.name), namedBusy, namedViewError });
  }
  function inspectAssemblyPoint(binding, query) {
    try {
      const result = viewer.queryAssemblyInstancePoint({ assemblyId: binding.assemblyId,
        assemblyRevision: binding.assemblyRevision, instanceId: binding.instanceId,
        reference: binding.reference, query });
      assemblyInspection = { instanceId: binding.instanceId, query: { ...query }, result, error: '' };
    } catch (error) {
      const previous = assemblyInspection?.instanceId === binding.instanceId ? assemblyInspection : null;
      assemblyInspection = { instanceId: binding.instanceId, query: previous?.query ?? { ...query },
        result: previous?.result ?? null, error: error?.message || String(error) };
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
  function captureSnapshot() {
    const native = measurement.result ? { first: measurement.points[0].input,
      second: measurement.points[1].input, distanceMM: measurement.result.distanceMM,
      metric: 'straight-line', space: 'native-authored', certification: 'not-certified' } : null;
    return { review: viewer.captureReviewState(), measurement: native,
      ...(viewer.getLightingCapabilities().supported ? { lighting: viewer.getState().lighting } : {}) };
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
    namedBusy = true; refresh();
    try {
      const snapshot = captureSnapshot(), next = action(snapshot);
      viewer.validateMeasuredReviewState(namedReviewCandidate(snapshot));
      // Use the actual file codec to check the complete list's snapshot and 32 KiB export budget.
      const file = await createReviewFile(snapshot.review, snapshot.measurement, active.source, snapshot.lighting, next);
      if (new TextEncoder().encode(JSON.stringify(file) + '\n').byteLength > REVIEW_FILE_LIMIT)
        throw new Error('Review files must be 32 KiB or smaller.');
      if (disposed || source !== active || epoch !== reviewEpoch) return false;
      if (before !== recordFrame() || version !== frameGeneration || listVersion !== namedGeneration)
        throw new Error('The view or saved views changed. Try again.');
      namedViews = next; namedGeneration++; namedViewError = ''; message(text); return true;
    } catch (error) {
      if (!disposed && source === active) { namedViewError = error?.message || String(error); message(namedViewError, true); }
      return false;
    } finally { namedBusy = false; refresh(); }
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
      try {
        const created = await createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.026, 0.033, 0.045] });
        if (disposed) { created.dispose(); return; }
        viewer = created;
        const controlError = error => { message(error?.message || String(error), true); refresh(); };
        listen(window, 'keydown', event => {
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
              const rect = canvas.getBoundingClientRect();
              pickMeasurement(viewer.pickGeometry({ xCss: event.clientX - rect.left, yCss: event.clientY - rect.top }));
            } catch (error) {
              measurement = { ...measurement, error: error?.message || String(error) };
              message(measurement.error, true); refresh();
            }
            return;
          }
          run(() => {
            const rect = canvas.getBoundingClientRect();
            const hit = viewer.pickGeometry({ xCss: event.clientX - rect.left, yCss: event.clientY - rect.top });
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
          if (canvas.width === width && canvas.height === height) return;
          try { viewer.resize(width, height); }
          catch (error) { message(error?.message || String(error), true); }
          refresh();
        });
        resizeObserver.observe(stage);
        window.cadViewerEvidence = evidence;
        starting = false; message('Open a CAD document to begin.'); refresh();
      } catch (error) {
        starting = false; message('Viewer could not start: ' + (error?.message || String(error)), true);
        console.error('CAD Viewer initialization:', error); refresh();
      }
    },
    beginDocumentPick() { documentEpoch++; },
    cancelDocumentPick() { documentEpoch++; },
    async openDocument(file) {
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
    toggleAdmission(id, checked) {
      if (!candidate?.catalog.some(body => body.id === id && body.supported)) return;
      if (checked && !admissionIds.includes(id) && admissionIds.length < 4) admissionIds = [...admissionIds, id];
      if (!checked) admissionIds = admissionIds.filter(value => value !== id);
      refresh();
    },
    admit() {
      if (!candidate || !viewer) return;
      try {
        const ids = [...admissionIds];
        admitSource(viewer, candidate, ids);
        active = candidate; admitted = ids; candidate = null; admissionIds = [];
        measurement = emptyMeasurement(); lightingError = '';
        assemblyInspection = null;
        namedViews = []; namedGeneration++; namedViewError = '';
        documentEpoch++; reviewEpoch++; frameGeneration++;
        appearanceBinding = undefined; appearanceTarget = ''; search = '';
        message(active.kind === 'assembly' ? 'Assembly opened. Select an occurrence to inspect its original placement.'
          : 'Document opened. Drag to orbit. Shift+drag to pan.'); refresh();
      } catch (error) { admissionError = error.message; refresh(); }
    },
    setSearch(value) { search = value; refresh(); },
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
      message(assemblyInspection.error || 'Original native point inspected in part and assembly coordinates.', Boolean(assemblyInspection.error));
      refresh();
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
      reviewBusy = true; refresh();
      try {
        const snapshot = captureSnapshot();
        const file = await createReviewFile(snapshot.review, snapshot.measurement, active.source, snapshot.lighting, namedViews);
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
      finally { reviewBusy = false; refresh(); }
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
        const read = await readReviewFile(text, active.source);
        const { candidate, legacy } = read;
        if (request !== reviewEpoch || disposed) return;
        if (before !== recordFrame() || version !== frameGeneration || listVersion !== namedGeneration)
          throw new Error('The view or saved views changed. Open the review again.');
        viewer.validateMeasuredReviewState(candidate);
        if (Object.hasOwn(read, 'namedViews'))
          for (const entry of read.namedViews) viewer.validateMeasuredReviewState(namedReviewCandidate(entry));
        applySnapshot(candidate);
        if (Object.hasOwn(read, 'namedViews')) { namedViews = read.namedViews; namedGeneration++; }
        namedViewError = '';
        message(legacy ? 'View restored. This file has no saved measurement.' : 'Review opened.'); refresh();
      } catch (error) { if (request === reviewEpoch && !disposed) {
        message('Review not opened: ' + error.message, true); refresh();
      } }
    },
    exportImage() { return png?.exportImage(); },
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
