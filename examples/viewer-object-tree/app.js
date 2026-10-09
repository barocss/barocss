import { createViewer, VIEWER_POSE_LIMITS } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadDocument } from '../../packages/barocss-cad-interop/dist/document.js';

const canvas = document.querySelector('#view');
const list = document.querySelector('#bodies');
const properties = document.querySelector('#properties');
const status = document.querySelector('#status');
const proofOutput = document.querySelector('#proof');
const proofControls = document.querySelector('#proof-controls');
const buttons = Object.fromEntries(['fit-all', 'show-all', 'hide-all', 'reload', 'clear']
  .map(id => [id, document.querySelector('#' + id)]));
const proof = new URLSearchParams(location.search).has('proof');
const contexts = new Set(), resources = {};
if (proof) {
  const getContext = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
    const context = getContext.call(this, kind, ...args);
    if (kind === 'webgl2' && context) contexts.add(context);
    return context;
  };
  for (const kind of ['Buffer', 'Program', 'VertexArray', 'Framebuffer', 'Texture', 'Renderbuffer', 'Shader']) {
    const live = new Set(), prototype = WebGL2RenderingContext.prototype;
    const create = prototype['create' + kind], remove = prototype['delete' + kind];
    resources[kind] = live;
    prototype['create' + kind] = function (...args) {
      const value = create.apply(this, args);
      if (value) live.add(value);
      return value;
    };
    prototype['delete' + kind] = function (value) {
      live.delete(value);
      return remove.call(this, value);
    };
  }
}

const viewer = createViewer(canvas, { mmToSceneUnit: 0.11, background: [0.015, 0.02, 0.03] });
const native = { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 1,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } };
const options = { native, basis: 'authored-xyz-matches-rhyup',
  bodyIds: ['body_1_surface', 'body_0_curve', 'body_1_curve', 'body_0_surface'] };
const listener = new AbortController();
let sceneEpoch = 0, requestEpoch = 0, disposed = false;
let sampleCamera = null, sampleCoordinates = [];
let refusalReport = null;
const sameRef = (a, b) => a?.kind === b?.kind && a?.modelId === b?.modelId
  && (a?.kind === 'surface' ? a.surfaceId === b.surfaceId : a?.curveId === b?.curveId);
const shown = (state, ref) => state.visibleGeometry.some(value => sameRef(value, ref));
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function translationValue(text, axis) {
  const trimmed = text.trim();
  if (!decimal.test(trimmed)) throw new Error(axis + ' must be a complete decimal in mm.');
  const value = Number(trimmed);
  if (!Number.isFinite(value) || Math.abs(value) > VIEWER_POSE_LIMITS.translationMm)
    throw new Error(axis + ' must be finite and within ±' + VIEWER_POSE_LIMITS.translationMm + ' mm.');
  return value;
}
const say = (message, error = false) => {
  status.textContent = message;
  status.dataset.error = String(error);
};
function current(ref, bodyId, revision, epoch) {
  if (disposed || epoch !== sceneEpoch) throw new Error('This body list is stale. Reload it.');
  const state = viewer.getState();
  if (state.status !== 'ready' || state.document?.document.revision !== revision
      || !state.documentBodies.some(body => sameRef(body.ref, ref)
        && body.binding.bodyId === bodyId && body.binding.documentRevision === revision))
    throw new Error('The accepted document body changed.');
  return state;
}
function run(label, action) {
  if (disposed) return;
  try { action(); render(); say(label); }
  catch (error) { render(); say(label + ': ' + error.message, true); }
}
function property(name, value) {
  const dt = document.createElement('dt'), dd = document.createElement('dd');
  dt.textContent = name; dd.textContent = String(value);
  return [dt, dd];
}
function selectedPose(state, ref) {
  const motion = state.geometryMotion;
  if (!motion || motion.basis !== 'part-xyz-matches-rhyup'
      || motion.bindings.length !== state.documentBodies.length
      || motion.displayPoses.length !== motion.bindings.length
      || motion.bindings.some((binding, index) => !sameRef(binding.ref, state.documentBodies[index].ref)))
    throw new Error('The accepted complete body pose frame is unavailable.');
  const index = motion.bindings.findIndex(binding => sameRef(binding.ref, ref));
  if (index < 0) throw new Error('The selected body has no current display pose.');
  return { motion, index, pose: motion.displayPoses[index] };
}
function translationEditor(state, selected, revision, epoch) {
  const { pose } = selectedPose(state, selected.ref);
  const section = document.createElement('section');
  section.className = 'translation-editor';
  const heading = document.createElement('h3');
  heading.textContent = 'Display translation';
  const note = document.createElement('p');
  note.textContent = 'X/Y/Z in mm. Display only; original CAD source stays unchanged.';
  const inputs = ['X', 'Y', 'Z'].map((axis, index) => {
    const label = document.createElement('label'), input = document.createElement('input');
    label.textContent = axis + ' (mm)';
    input.type = 'text'; input.inputMode = 'decimal'; input.value = String(pose.translationMm[index]);
    input.setAttribute('aria-label', axis + ' display translation (mm)');
    label.append(input); section.append(label);
    return input;
  });
  const actions = document.createElement('div');
  actions.className = 'actions';
  const apply = document.createElement('button'), discard = document.createElement('button');
  apply.textContent = 'Apply'; discard.textContent = 'Discard';
  apply.addEventListener('click', () => {
    try {
      if (!section.isConnected) throw new Error('This property panel is stale.');
      const accepted = current(selected.ref, selected.binding.bodyId, revision, epoch);
      if (!shown(accepted, selected.ref) || !sameRef(accepted.selectedGeometry, selected.ref))
        throw new Error('The selected body is no longer visible and current.');
      const translation = inputs.map((input, index) => translationValue(input.value, 'XYZ'[index]));
      const { motion, index } = selectedPose(accepted, selected.ref);
      const frame = motion.frame;
      const targetId = motion.bindings[index].targetId;
      const poses = frame.poses.map(pose => pose.targetId === targetId
        ? { ...pose, translation } : pose);
      viewer.applyGeometryMotionFrame({ contextId: frame.contextId,
        timeSeconds: frame.timeSeconds, poses }, motion.bindings, { basis: motion.basis });
      render(); say('Display translation applied to ' + selected.binding.bodyId + '.');
    } catch (error) {
      // Keep the draft text in these live inputs so it can be corrected.
      publishProof(viewer.getState());
      say('Display translation refused: ' + error.message, true);
    }
  }, { signal: listener.signal });
  discard.addEventListener('click', () => {
    try {
      if (!section.isConnected) throw new Error('This property panel is stale.');
      const accepted = current(selected.ref, selected.binding.bodyId, revision, epoch);
      if (!shown(accepted, selected.ref) || !sameRef(accepted.selectedGeometry, selected.ref))
        throw new Error('The selected body is no longer visible and current.');
      render(); say('Display translation draft discarded.');
    } catch (error) { say('Discard refused: ' + error.message, true); }
  }, { signal: listener.signal });
  actions.append(apply, discard); section.prepend(note); section.prepend(heading);
  section.append(actions);
  return section;
}
function publishProof(state) {
  if (!proof) return;
  proofControls.hidden = false;
  let pixelHash = null;
  const hitSamples = [];
  if (state.status === 'ready') {
    const bytes = viewer.readPixels();
    let value = 2166136261;
    for (const byte of bytes) value = Math.imul(value ^ byte, 16777619) >>> 0;
    pixelHash = value;
    const camera = JSON.stringify(state.camera);
    if (sampleCamera !== camera) {
      sampleCamera = null;
      sampleCoordinates = [];
      if (state.visibleGeometry.length === 4 && state.selectedGeometry === null) {
        sampleCamera = camera;
        const rect = canvas.getBoundingClientRect();
        for (let y = 4; y < rect.height && sampleCoordinates.length < 4; y += 6) {
          for (let x = 4; x < rect.width && sampleCoordinates.length < 4; x += 6) {
            const hit = viewer.pickGeometry({ xCss: x, yCss: y }, { curveTolerancePx: 4 });
            const ref = hit && { kind: hit.kind, ...hit.ref };
            if (ref && !sampleCoordinates.some(sample => sameRef(sample.ref, ref)))
              sampleCoordinates.push({ ref, xCss: x, yCss: y });
          }
        }
      }
    }
    for (const sample of sampleCoordinates) {
      const hit = viewer.pickGeometry({ xCss: sample.xCss, yCss: sample.yCss }, { curveTolerancePx: 4 });
      if (hit && sameRef({ kind: hit.kind, ...hit.ref }, sample.ref)) hitSamples.push(sample);
    }
  } else {
    sampleCamera = null;
    sampleCoordinates = [];
  }
  proofOutput.textContent = JSON.stringify({
    status: state.status, documentId: state.document?.document.documentId ?? null,
    documentRevision: state.document?.document.revision ?? null,
    documentSourceHash: state.document ? (() => {
      let value = 2166136261;
      for (const byte of new TextEncoder().encode(JSON.stringify(state.document.document)))
        value = Math.imul(value ^ byte, 16777619) >>> 0;
      return value;
    })() : null,
    sourceBytes: state.document?.document.assets.map(asset => new TextEncoder().encode(asset.source).length) ?? [],
    bodies: state.documentBodies.map(body => ({
      kind: body.ref.kind, modelId: body.ref.modelId, bodyId: body.binding.bodyId,
      assetId: body.binding.assetId, geometryId: body.binding.geometryId })),
    visible: state.visibleGeometry, selected: state.selectedGeometry, camera: state.camera,
    geometryMotion: state.geometryMotion,
    draft: [...properties.querySelectorAll('.translation-editor input')].map(input => input.value),
    pixelHash, hitSamples, refusalReport, contexts: contexts.size,
    glErrors: [...contexts].map(context => context.getError()),
    resources: Object.fromEntries(Object.entries(resources).map(([kind, live]) => [kind, live.size])),
  }, null, 2);
}
function render() {
  const state = viewer.getState();
  const ready = state.status === 'ready' && state.document !== null;
  const revision = state.document?.document.revision, epoch = sceneEpoch;
  const rows = [];
  for (const body of ready ? state.documentBodies : []) {
    const visible = shown(state, body.ref), selected = sameRef(state.selectedGeometry, body.ref);
    const item = document.createElement('li');
    item.dataset.kind = body.ref.kind;
    item.dataset.modelId = body.ref.modelId;
    item.dataset.bodyId = body.binding.bodyId;
    item.setAttribute('aria-selected', String(selected));
    const name = document.createElement('strong'), ids = document.createElement('small');
    name.textContent = body.binding.bodyId + ' · ' + body.ref.kind;
    ids.textContent = body.ref.modelId + ' / ' + body.binding.assetId + ' / ' + body.binding.geometryId;
    const actions = document.createElement('div');
    actions.className = 'actions';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox'; checkbox.checked = visible;
    checkbox.setAttribute('aria-label', 'Show ' + body.binding.bodyId);
    checkbox.addEventListener('change', () => run('Visibility', () => {
      const accepted = current(body.ref, body.binding.bodyId, revision, epoch);
      const subset = accepted.documentBodies.map(value => value.ref).filter(ref =>
        sameRef(ref, body.ref) ? checkbox.checked : shown(accepted, ref));
      viewer.setVisibleGeometry(subset);
    }), { signal: listener.signal });
    const select = document.createElement('button');
    select.textContent = 'Select'; select.disabled = !visible;
    select.setAttribute('aria-label', 'Select ' + body.binding.bodyId);
    select.addEventListener('click', () => run('Selection', () => {
      if (!shown(current(body.ref, body.binding.bodyId, revision, epoch), body.ref))
        throw new Error('This body is hidden.');
      viewer.selectGeometry(body.ref);
    }), { signal: listener.signal });
    const fit = document.createElement('button');
    fit.textContent = 'Fit'; fit.disabled = !visible;
    fit.setAttribute('aria-label', 'Fit ' + body.binding.bodyId);
    fit.addEventListener('click', () => run('Body fit', () => {
      if (!shown(current(body.ref, body.binding.bodyId, revision, epoch), body.ref))
        throw new Error('This body is hidden.');
      viewer.fitGeometry(body.ref);
    }), { signal: listener.signal });
    actions.append(checkbox, select, fit); item.append(name, ids, actions); rows.push(item);
  }
  list.replaceChildren(...rows);
  const title = document.createElement('h2');
  title.textContent = 'Properties';
  properties.replaceChildren(title);
  const selected = ready && state.documentBodies.find(body => sameRef(body.ref, state.selectedGeometry));
  if (selected) {
    const values = document.createElement('dl'), binding = selected.binding;
    values.append(...property('Body', binding.bodyId), ...property('Kind', selected.ref.kind),
      ...property('Model alias', selected.ref.modelId), ...property('Asset', binding.assetId),
      ...property('Asset revision', binding.assetRevision), ...property('Geometry', binding.geometryId),
      ...property('Document', state.document.document.documentId),
      ...property('Document revision', revision), ...property('Source frame', binding.sourceFrame),
      ...property('Native frame', binding.nativeFrame), ...property('Source unit', state.sourceUnit));
    properties.append(values);
    if (shown(state, selected.ref)) {
      try { properties.append(translationEditor(state, selected, revision, epoch)); }
      catch (error) { say('Display translation unavailable: ' + error.message, true); }
    }
  } else {
    const empty = document.createElement('span');
    empty.textContent = 'Select a visible body.';
    properties.append(empty);
  }
  buttons['fit-all'].disabled = !ready || state.visibleGeometry.length === 0;
  buttons['show-all'].disabled = !ready || state.visibleGeometry.length === state.documentBodies.length;
  buttons['hide-all'].disabled = !ready || state.visibleGeometry.length === 0;
  buttons.reload.disabled = disposed;
  buttons.clear.disabled = disposed || state.status === 'empty';
  if (proof) {
    document.querySelector('#check-refusals').disabled = !ready;
    document.querySelector('#dispose-proof').disabled = disposed;
  }
  publishProof(state);
}
async function reload() {
  const request = ++requestEpoch;
  let accepted = false;
  say('Loading document…');
  try {
    const result = await loadBaroCadDocument(new URL('/document.cad-document.json', location.href).href);
    if (disposed || request !== requestEpoch) return;
    viewer.loadDocument(result, options);
    accepted = true;
    sceneEpoch++;
    const refs = viewer.getState().documentBodies.map(body => body.ref);
    viewer.applyGeometryMotionFrame({ contextId: 'object-tree', timeSeconds: 0,
      poses: refs.map((ref, index) => ({ targetId: 'body-' + index,
        translation: [index < 2 ? -10 : 10, index % 2 === 0 ? 7 : -7, 0] })) },
    refs.map((ref, index) => ({ contextId: 'object-tree', targetId: 'body-' + index, ref })),
    { basis: 'part-xyz-matches-rhyup' });
    viewer.fit();
    render();
    say('Loaded document revision ' + viewer.getState().document.document.revision + '.');
  } catch (error) {
    if (!disposed && request === requestEpoch) {
      if (accepted) render();
      say((accepted ? 'Document accepted; view update refused: ' : 'Load refused: ')
        + error.message, true);
    }
  }
}
buttons['fit-all'].addEventListener('click', () => run('Fit all', () => viewer.fit()), { signal: listener.signal });
buttons['show-all'].addEventListener('click', () => run('Show all', () =>
  viewer.setVisibleGeometry(viewer.getState().documentBodies.map(body => body.ref))), { signal: listener.signal });
buttons['hide-all'].addEventListener('click', () => run('Hide all', () =>
  viewer.setVisibleGeometry([])), { signal: listener.signal });
buttons.reload.addEventListener('click', reload, { signal: listener.signal });
buttons.clear.addEventListener('click', () => run('Cleared', () => {
  requestEpoch++; viewer.clear(); sceneEpoch++;
}), { signal: listener.signal });
canvas.addEventListener('click', event => run('Canvas selection', () => {
  const state = viewer.getState();
  if (state.status !== 'ready' || !state.document) return;
  const rect = canvas.getBoundingClientRect();
  const hit = viewer.pickGeometry({ xCss: event.clientX - rect.left, yCss: event.clientY - rect.top },
    { curveTolerancePx: 4 });
  const ref = hit && { kind: hit.kind, ...hit.ref };
  if (ref && (!shown(state, ref) || !state.documentBodies.some(body => sameRef(body.ref, ref))))
    throw new Error('The hit is not a current visible document body.');
  viewer.selectGeometry(ref);
}), { signal: listener.signal });
function dispose() {
  if (disposed) return;
  disposed = true; requestEpoch++; listener.abort(); viewer.dispose(); render(); say('Viewer disposed.');
}
if (proof) {
  document.querySelector('#check-refusals').addEventListener('click', () => {
    const before = viewer.getState(), beforePixels = viewer.readPixels();
    const failures = [];
    const hidden = before.documentBodies.find(body => !shown(before, body.ref));
    if (hidden) {
      try { viewer.selectGeometry(hidden.ref); } catch { failures.push('hidden'); }
    }
    const foreign = { ...before.documentBodies[0].ref, modelId: 'foreign' };
    try { viewer.selectGeometry(foreign); } catch { failures.push('foreign'); }
    if (before.geometryMotion) {
      const motion = before.geometryMotion;
      const wrong = motion.bindings.map((binding, index) => index === 0
        ? { ...binding, ref: { ...binding.ref, modelId: 'foreign' } } : binding);
      try { viewer.applyGeometryMotionFrame(motion.frame, wrong, { basis: motion.basis }); }
      catch { failures.push('motion-binding'); }
    }
    try { current(before.documentBodies[0].ref, before.documentBodies[0].binding.bodyId,
      before.document.document.revision, sceneEpoch - 1); } catch { failures.push('stale'); }
    const after = viewer.getState(), afterPixels = viewer.readPixels();
    refusalReport = { failures, retained: JSON.stringify(before) === JSON.stringify(after)
      && beforePixels.length === afterPixels.length
      && beforePixels.every((byte, index) => byte === afterPixels[index]) };
    render();
    say('Refusal checks: ' + failures.join(', ') + '; retained=' + refusalReport.retained);
  }, { signal: listener.signal });
  document.querySelector('#dispose-proof').addEventListener('click', dispose,
    { signal: listener.signal });
}
window.addEventListener('beforeunload', dispose, { signal: listener.signal });
window.viewerObjectTreeProbe = { viewer, reload, dispose,
  contextCount: () => contexts.size,
  resourceCounts: () => Object.fromEntries(Object.entries(resources).map(([kind, live]) => [kind, live.size])),
  glError: () => [...contexts].map(context => context.getError()) };
render();
reload();
