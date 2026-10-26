import { createViewer } from '@barocss/viewer';
import { compileMeshMaterial } from '@barocss/gpu';
import { parseDocument, readDocument, loadOptions } from './document.js';
import { createPngExport } from './png-export.js';

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
const summary = value => value && ({ label: value.label, id: value.id,
  revision: value.revision, catalog: value.catalog });

/** Own the SDK lifetime and commands. React owns every screen element. */
export function createViewerController({ canvas, stage, onChange }) {
  let viewer, active = null, candidate = null, admitted = [], admissionIds = [];
  let starting = true, disposed = false, startCalled = false, search = '';
  let documentEpoch = 0, reviewEpoch = 0, frameGeneration = 0, lastGuard;
  let png, pointerControls, keyboardControls, resizeObserver;
  let appearanceTarget = '', appearancePreset = 'default', appearanceBinding;
  let admissionError = '', status = 'Starting Viewer…', statusError = false;
  let exportStatus = '', exportBusy = false;
  const listeners = [];
  const reviewUrls = new Set();
  const loaded = () => Boolean(active && viewer && !disposed);
  const guard = () => JSON.stringify({ review: loaded() ? viewer.captureReviewState() : null,
    materials: viewer?.getState().surfaceMaterials ?? [], width: canvas.width, height: canvas.height });
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
    if (state) {
      recordFrame();
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
      if (ref) appearanceNote = !state.visibleGeometry.some(value => sameRef(value, tagged))
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
      status, statusError, exportStatus, exportBusy, viewPreset, appearanceTarget,
      appearancePreset, appearanceNote });
  }
  function run(action, text) {
    if (!loaded()) return;
    try { action(); message(text); }
    catch (error) { message(error?.message || String(error), true); }
    refresh();
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
        const next = await readDocument(file);
        if (request !== documentEpoch || disposed) return;
        chooseBodies(next);
      } catch (error) { if (request === documentEpoch && !disposed) {
        message('Document not opened: ' + error.message, true); refresh();
      } }
    },
    async openSample() {
      const request = ++documentEpoch;
      try {
        const response = await fetch('/sample.cad-document.json');
        if (!response.ok) throw new Error('The sample is unavailable.');
        const text = await response.text();
        if (request !== documentEpoch || disposed) return;
        chooseBodies(parseDocument(text, 'Sample document'));
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
        viewer.loadDocument(candidate.result, loadOptions(ids));
        active = candidate; admitted = ids; candidate = null; admissionIds = [];
        documentEpoch++; reviewEpoch++; frameGeneration++;
        appearanceBinding = undefined; appearanceTarget = ''; search = '';
        message('Document opened. Drag to orbit. Shift+drag to pan.'); refresh();
      } catch (error) { admissionError = error.message; refresh(); }
    },
    setSearch(value) { search = value; refresh(); },
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
    applyAppearance() { run(() => {
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
    downloadReview() { run(() => {
      const url = URL.createObjectURL(new Blob([JSON.stringify(viewer.captureReviewState(), null, 2) + '\n'], { type: 'application/json' }));
      reviewUrls.add(url);
      const link = document.createElement('a'); link.href = url; link.download = 'viewer-review.json'; link.click();
      setTimeout(() => { URL.revokeObjectURL(url); reviewUrls.delete(url); }, 1000);
    }, 'Review saved.'); },
    beginReviewPick() { reviewEpoch++; },
    cancelReviewPick() { reviewEpoch++; },
    async openReview(file) {
      const request = ++reviewEpoch;
      if (!file || !loaded()) return;
      const before = recordFrame(), version = frameGeneration;
      try {
        if (file.size > 32768) throw new Error('Review files must be 32 KiB or smaller.');
        const text = await file.text();
        if (request !== reviewEpoch || disposed) return;
        if (before !== guard() || version !== frameGeneration) throw new Error('The view changed. Open the review again.');
        run(() => viewer.applyReviewState(JSON.parse(text)), 'Review opened.');
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
