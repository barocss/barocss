import { createViewer, VIEWER_POSE_LIMITS } from '../../packages/barocss-viewer/dist/index.js';
import { loadBaroCadDocument } from '../../packages/barocss-cad-interop/dist/document.js';

const canvas = document.querySelector('#view');
const moveHandle = document.querySelector('#move-handle');
const yawHandle = document.querySelector('#yaw-handle');
const selectionFilter = document.querySelector('#selection-filter');
const fitSetButton = document.querySelector('#fit-set');
const clearFitSetButton = document.querySelector('#clear-fit-set');
const fitSetCount = document.querySelector('#fit-set-count');
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
let activeDrag = null;
let previewReport = null;
let activeYaw = null, yawPreviewReport = null;
let sampleCamera = null, sampleCoordinates = [];
let refusalReport = null, nonYReport = null, nonuniformReport = null;
let fitMembers = [];
const sameRef = (a, b) => a?.kind === b?.kind && a?.modelId === b?.modelId
  && (a?.kind === 'surface' ? a.surfaceId === b.surfaceId : a?.curveId === b?.curveId);
const shown = (state, ref) => state.visibleGeometry.some(value => sameRef(value, ref));
const eligible = ref => selectionFilter.value === 'all' || selectionFilter.value === ref.kind;
const filterName = () => selectionFilter.selectedOptions[0].textContent;
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
function translationValue(text, axis) {
  const trimmed = text.trim();
  if (!decimal.test(trimmed)) throw new Error(axis + ' must be a complete decimal in mm.');
  const value = Number(trimmed);
  if (!Number.isFinite(value) || Math.abs(value) > VIEWER_POSE_LIMITS.translationMm)
    throw new Error(axis + ' must be finite and within ±' + VIEWER_POSE_LIMITS.translationMm + ' mm.');
  return value;
}
function yawValue(text) {
  const trimmed = text.trim();
  if (!decimal.test(trimmed)) throw new Error('Yaw must be a complete decimal in degrees.');
  const value = Number(trimmed);
  if (!Number.isFinite(value) || Math.abs(value) > 180)
    throw new Error('Yaw must be finite and within ±180 degrees.');
  return value;
}
function scaleValue(text) {
  const trimmed = text.trim();
  if (!decimal.test(trimmed)) throw new Error('Scale must be a complete decimal ratio.');
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < VIEWER_POSE_LIMITS.scaleMin
      || value > VIEWER_POSE_LIMITS.scaleMax)
    throw new Error('Scale must be finite and within '
      + VIEWER_POSE_LIMITS.scaleMin + '..' + VIEWER_POSE_LIMITS.scaleMax + '.');
  return value;
}
function acceptedUniformScale(scale) {
  const [x, y, z] = scale;
  if (![x, y, z].every(Number.isFinite) || x !== y || y !== z)
    throw new Error('The accepted display scale is not uniform.');
  return x;
}
function acceptedYaw(rotation) {
  const [x, y, z, w] = rotation;
  const norm = Math.hypot(x, y, z, w);
  if (![x, y, z, w].every(Number.isFinite) || Math.abs(x) > 1e-9 || Math.abs(z) > 1e-9
      || Math.abs(norm - 1) > VIEWER_POSE_LIMITS.quaternionNormTolerance)
    throw new Error('The accepted rotation is not a pure Y-axis pose.');
  const degrees = 2 * Math.atan2(y, w) * 180 / Math.PI;
  if (Math.abs(degrees) > 180 + 1e-9)
    throw new Error('The accepted yaw is outside ±180 degrees.');
  return Math.max(-180, Math.min(180, degrees));
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
  try { action(); const notice = render(); say(label + (notice ? ' ' + notice : '')); }
  catch (error) { render(); say(label + ': ' + error.message, true); }
}
function fitMember(body, revision, epoch) {
  return { ref: { ...body.ref }, binding: structuredClone(body.binding), revision, epoch };
}
function currentFitMember(state, member) {
  return !disposed && state.status === 'ready' && member.epoch === sceneEpoch
    && state.document?.document.revision === member.revision && shown(state, member.ref)
    && state.documentBodies.some(body => sameRef(body.ref, member.ref)
      && JSON.stringify(body.binding) === JSON.stringify(member.binding));
}
function fitSetEligible(state) {
  return fitMembers.length >= 2 && fitMembers.length <= 4
    && fitMembers.every((member, index) => currentFitMember(state, member)
      && fitMembers.findIndex(value => sameRef(value.ref, member.ref)) === index);
}
function reconcileFitSet(state) {
  const before = fitMembers.length;
  fitMembers = fitMembers.filter(member => currentFitMember(state, member));
  return before === fitMembers.length ? ''
    : 'Removed ' + (before - fitMembers.length) + ' unavailable fit-set member(s).';
}
function changeFitSet(label, action) {
  if (disposed) return;
  const discarded = dirtyPoseDraft();
  try {
    action();
    const notice = render();
    say(label + (discarded ? ' Numeric draft discarded.' : '') + (notice ? ' ' + notice : ''));
  } catch (error) { say('Fit set refused: ' + error.message, true); }
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
function projectHandle(body) {
  const input = body.ref.kind === 'surface'
    ? { ...body.ref, u: 1.5, v: 1.5 } : { ...body.ref, t: 1 };
  const projection = viewer.projectNativePoint(input);
  if (projection && JSON.stringify(projection.documentBody) !== JSON.stringify(body.binding))
    throw new Error('The projected native point has a different document binding.');
  return projection;
}
function renderHandle(state) {
  const body = state.status === 'ready' && state.documentBodies.find(value =>
    sameRef(value.ref, state.selectedGeometry) && shown(state, value.ref));
  if (!body) { moveHandle.hidden = true; return; }
  try {
    const projection = projectHandle(body);
    if (!projection) { moveHandle.hidden = true; return; }
    moveHandle.style.left = projection.xCss + 'px';
    moveHandle.style.top = projection.yCss + 'px';
    moveHandle.dataset.bodyId = body.binding.bodyId;
    moveHandle.hidden = false;
  } catch (error) { moveHandle.hidden = true; say('Move handle unavailable: ' + error.message, true); }
}
function renderYawHandle(state) {
  const body = state.status === 'ready' && state.documentBodies.find(value =>
    sameRef(value.ref, state.selectedGeometry) && shown(state, value.ref));
  if (!body) { yawHandle.hidden = true; return; }
  try {
    const projection = projectHandle(body);
    const { pose } = selectedPose(state, body.ref);
    acceptedYaw(pose.rotationXYZW);
    acceptedUniformScale(pose.scale);
    const rect = canvas.getBoundingClientRect();
    if (!projection || projection.yCss < 17 || projection.yCss > rect.height - 17) {
      yawHandle.hidden = true; return;
    }
    const right = projection.xCss + 64, left = projection.xCss - 64;
    const x = right <= rect.width - 27 ? right : left >= 27 ? left : null;
    if (x === null) { yawHandle.hidden = true; return; }
    yawHandle.style.left = x + 'px';
    yawHandle.style.top = projection.yCss + 'px';
    yawHandle.dataset.bodyId = body.binding.bodyId;
    yawHandle.hidden = false;
  } catch { yawHandle.hidden = true; }
}
function translationEditor(state, selected, revision, epoch) {
  const { pose } = selectedPose(state, selected.ref);
  const yaw = acceptedYaw(pose.rotationXYZW);
  const uniformScale = acceptedUniformScale(pose.scale);
  const acceptedTranslationText = pose.translationMm.map(String);
  // Show a stable decimal while retaining the original quaternion when this draft is unchanged.
  const acceptedYawText = String(Number(yaw.toPrecision(12)));
  const acceptedScaleText = String(uniformScale);
  const section = document.createElement('section');
  section.className = 'translation-editor';
  const heading = document.createElement('h3');
  heading.textContent = 'Display pose';
  const note = document.createElement('p');
  note.textContent = 'X/Y/Z mm, Y yaw degrees and uniform scale about the authored origin. Display only; original CAD source stays unchanged.';
  const inputs = ['X', 'Y', 'Z'].map((axis, index) => {
    const label = document.createElement('label'), input = document.createElement('input');
    label.textContent = axis + ' (mm)';
    input.type = 'text'; input.inputMode = 'decimal'; input.value = acceptedTranslationText[index];
    input.dataset.accepted = input.value;
    input.setAttribute('aria-label', axis + ' display translation (mm)');
    label.append(input); section.append(label);
    return input;
  });
  const yawLabel = document.createElement('label'), yawInput = document.createElement('input');
  yawLabel.textContent = 'Yaw Y (deg)';
  yawInput.type = 'text'; yawInput.inputMode = 'decimal'; yawInput.value = acceptedYawText;
  yawInput.dataset.accepted = yawInput.value;
  yawInput.setAttribute('aria-label', 'Yaw display rotation (deg)');
  yawLabel.append(yawInput); section.append(yawLabel);
  const scaleLabel = document.createElement('label'), scaleInput = document.createElement('input');
  scaleLabel.textContent = 'Uniform scale (ratio)';
  scaleInput.type = 'text'; scaleInput.inputMode = 'decimal'; scaleInput.value = acceptedScaleText;
  scaleInput.dataset.accepted = scaleInput.value;
  scaleInput.setAttribute('aria-label', 'Uniform display scale (ratio)');
  scaleLabel.append(scaleInput); section.append(scaleLabel);
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
      const { motion, index, pose } = selectedPose(accepted, selected.ref);
      acceptedYaw(pose.rotationXYZW);
      acceptedUniformScale(pose.scale);
      const translation = inputs.map((input, axis) => input.value === acceptedTranslationText[axis]
        ? pose.translationMm[axis] : translationValue(input.value, 'XYZ'[axis]));
      const rotation = yawInput.value === acceptedYawText ? pose.rotationXYZW : (() => {
        const radians = yawValue(yawInput.value) * Math.PI / 180;
        return [0, Math.sin(radians / 2), 0, Math.cos(radians / 2)];
      })();
      const scale = scaleInput.value === acceptedScaleText ? pose.scale
        : Array(3).fill(scaleValue(scaleInput.value));
      const frame = motion.frame;
      const targetId = motion.bindings[index].targetId;
      const poses = frame.poses.map(pose => pose.targetId === targetId
        ? { ...pose, translation, rotation, scale } : pose);
      viewer.applyGeometryMotionFrame({ contextId: frame.contextId,
        timeSeconds: frame.timeSeconds, poses }, motion.bindings, { basis: motion.basis });
      render(); say('Display pose applied to ' + selected.binding.bodyId + '.');
    } catch (error) {
      // Keep the draft text in these live inputs so it can be corrected.
      publishProof(viewer.getState());
      say('Display pose refused: ' + error.message, true);
    }
  }, { signal: listener.signal });
  discard.addEventListener('click', () => {
    try {
      if (!section.isConnected) throw new Error('This property panel is stale.');
      const accepted = current(selected.ref, selected.binding.bodyId, revision, epoch);
      if (!shown(accepted, selected.ref) || !sameRef(accepted.selectedGeometry, selected.ref))
        throw new Error('The selected body is no longer visible and current.');
      render(); say('Display pose draft discarded.');
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
      assetId: body.binding.assetId, geometryId: body.binding.geometryId,
      selectionEligible: eligible(body.ref), selectEnabled: state.status === 'ready'
        && shown(state, body.ref) && eligible(body.ref),
      fitIncluded: fitMembers.some(member => sameRef(member.ref, body.ref)),
      fitEligible: state.status === 'ready' && !disposed && shown(state, body.ref) })),
    selectionFilter: selectionFilter.value,
    fitSet: fitMembers.map(member => ({ ...member, ref: { ...member.ref },
      binding: structuredClone(member.binding) })),
    fitSetCount: fitMembers.length, fitSetEligible: fitSetEligible(state),
    visible: state.visibleGeometry, selected: state.selectedGeometry, camera: state.camera,
    geometryMotion: state.geometryMotion,
    draft: [...properties.querySelectorAll('.translation-editor input')].map(input => input.value),
    handle: { visible: !moveHandle.hidden, xCss: moveHandle.hidden ? null : Number.parseFloat(moveHandle.style.left),
      yCss: moveHandle.hidden ? null : Number.parseFloat(moveHandle.style.top),
      dragging: activeDrag !== null },
    previewReport,
    yawHandle: { visible: !yawHandle.hidden,
      xCss: yawHandle.hidden ? null : Number.parseFloat(yawHandle.style.left),
      yCss: yawHandle.hidden ? null : Number.parseFloat(yawHandle.style.top),
      dragging: activeYaw !== null },
    yawPreviewReport,
    pixelHash, hitSamples, refusalReport, nonYReport, nonuniformReport, contexts: contexts.size,
    glErrors: [...contexts].map(context => context.getError()),
    resources: Object.fromEntries(Object.entries(resources).map(([kind, live]) => [kind, live.size])),
  }, null, 2);
}
function render() {
  if (activeDrag) cancelDrag();
  if (activeYaw) cancelYaw();
  const state = viewer.getState();
  const fitNotice = reconcileFitSet(state);
  const ready = state.status === 'ready' && state.document !== null;
  const revision = state.document?.document.revision, epoch = sceneEpoch;
  const rows = [];
  for (const body of ready ? state.documentBodies : []) {
    const visible = shown(state, body.ref), selected = sameRef(state.selectedGeometry, body.ref);
    const item = document.createElement('li');
    item.dataset.kind = body.ref.kind;
    item.dataset.modelId = body.ref.modelId;
    item.dataset.bodyId = body.binding.bodyId;
    item.dataset.selectionEligible = String(eligible(body.ref));
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
    select.textContent = 'Select'; select.disabled = !visible || !eligible(body.ref);
    select.setAttribute('aria-label', 'Select ' + body.binding.bodyId);
    select.addEventListener('click', () => run('Selection', () => {
      if (!shown(current(body.ref, body.binding.bodyId, revision, epoch), body.ref))
        throw new Error('This body is hidden.');
      if (!eligible(body.ref)) throw new Error('This body is excluded by the selection filter.');
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
    const includeLabel = document.createElement('label'), include = document.createElement('input');
    const member = fitMember(body, revision, epoch);
    include.type = 'checkbox'; include.disabled = !visible;
    include.checked = fitMembers.some(value => sameRef(value.ref, body.ref));
    include.setAttribute('aria-label', 'Include ' + body.binding.bodyId + ' in fit set');
    includeLabel.append(include, document.createTextNode('Include in fit set'));
    include.addEventListener('change', () => changeFitSet('Fit set updated.', () => {
      if (!item.isConnected) throw new Error('This fit-set row is detached.');
      const accepted = current(member.ref, member.binding.bodyId, member.revision, member.epoch);
      if (!currentFitMember(accepted, member))
        throw new Error('This fit-set body is hidden or its original binding changed.');
      const others = fitMembers.filter(value => !sameRef(value.ref, member.ref));
      if (include.checked) others.push(member);
      fitMembers = accepted.documentBodies.flatMap(value =>
        others.filter(token => sameRef(value.ref, token.ref)));
    }), { signal: listener.signal });
    actions.append(checkbox, select, fit); item.append(name, ids, actions, includeLabel); rows.push(item);
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
      catch (error) { say('Display pose unavailable: ' + error.message, true); }
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
  selectionFilter.disabled = disposed || !ready;
  fitSetButton.disabled = !fitSetEligible(state);
  clearFitSetButton.disabled = disposed || !ready || fitMembers.length === 0;
  fitSetCount.textContent = 'Fit set: ' + fitMembers.length + ' bodies';
  if (proof) {
    document.querySelector('#check-refusals').disabled = !ready;
    document.querySelector('#check-non-y').disabled = !ready || !selected;
    document.querySelector('#check-nonuniform').disabled = !ready || !selected;
    document.querySelector('#dispose-proof').disabled = disposed;
  }
  renderHandle(state);
  renderYawHandle(state);
  publishProof(state);
  return fitNotice;
}
function cancelDrag() {
  const drag = activeDrag;
  activeDrag = null;
  moveHandle.dataset.dragging = 'false';
  if (drag && moveHandle.hasPointerCapture(drag.pointerId)) {
    try { moveHandle.releasePointerCapture(drag.pointerId); } catch { /* Capture was already lost. */ }
  }
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]];
}
function unit(vector) {
  const length = Math.hypot(...vector);
  if (!Number.isFinite(length) || length === 0) throw new Error('Camera basis is unavailable.');
  return vector.map(value => value / length);
}
moveHandle.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || activeDrag || moveHandle.hidden) return;
  try {
    const state = viewer.getState();
    const body = state.documentBodies.find(value => sameRef(value.ref, state.selectedGeometry)
      && shown(state, value.ref));
    if (state.status !== 'ready' || !body) throw new Error('Select a current visible body.');
    const inputs = properties.querySelectorAll('.translation-editor input');
    if ([...inputs].some(input => input.value !== input.dataset.accepted))
      throw new Error('Apply or discard the numeric draft first.');
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY))
      throw new Error('Pointer coordinates must be finite.');
    const projection = projectHandle(body), rect = canvas.getBoundingClientRect();
    if (!projection || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)
        || rect.width <= 0 || rect.height <= 0) throw new Error('The native anchor is not on screen.');
    selectedPose(state, body.ref);
    moveHandle.setPointerCapture(event.pointerId);
    activeDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      ref: body.ref, binding: body.binding, revision: state.document.document.revision,
      epoch: sceneEpoch, cameraHash: JSON.stringify(state.camera),
      motionHash: JSON.stringify(state.geometryMotion), mmToSceneUnit: state.mmToSceneUnit,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height }, projection,
      proofState: proof ? JSON.stringify(state) : null,
      proofPixels: proof ? viewer.readPixels() : null };
    previewReport = null;
    moveHandle.dataset.dragging = 'true';
    event.preventDefault();
    say('Move preview. Release to apply.'); publishProof(state);
  } catch (error) { say('Move refused: ' + error.message, true); }
}, { signal: listener.signal });
moveHandle.addEventListener('pointermove', event => {
  const drag = activeDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!moveHandle.hasPointerCapture(drag.pointerId)) {
    cancelDrag(); renderHandle(viewer.getState()); say('Move cancelled: pointer capture lost.', true);
    return;
  }
  const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    cancelDrag(); renderHandle(viewer.getState()); say('Move cancelled: nonfinite pointer position.', true);
    return;
  }
  moveHandle.style.left = drag.projection.xCss + dx + 'px';
  moveHandle.style.top = drag.projection.yCss + dy + 'px';
  if (proof) {
    const pixels = viewer.readPixels();
    previewReport = { dx, dy, stateSame: JSON.stringify(viewer.getState()) === drag.proofState,
      pixelsSame: pixels.length === drag.proofPixels.length
        && pixels.every((byte, index) => byte === drag.proofPixels[index]) };
  }
  event.preventDefault();
  publishProof(viewer.getState());
}, { signal: listener.signal });
moveHandle.addEventListener('pointerup', event => {
  const drag = activeDrag;
  if (!drag || event.pointerId !== drag.pointerId) return;
  try {
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('Pointer displacement must be finite.');
    const accepted = current(drag.ref, drag.binding.bodyId, drag.revision, drag.epoch);
    const body = accepted.documentBodies.find(value => sameRef(value.ref, drag.ref));
    if (!body || JSON.stringify(body.binding) !== JSON.stringify(drag.binding)
        || !shown(accepted, drag.ref) || !sameRef(accepted.selectedGeometry, drag.ref)
        || JSON.stringify(accepted.camera) !== drag.cameraHash
        || JSON.stringify(accepted.geometryMotion) !== drag.motionHash
        || accepted.mmToSceneUnit !== drag.mmToSceneUnit)
      throw new Error('The accepted body, camera or pose changed during the drag.');
    if ([...properties.querySelectorAll('.translation-editor input')]
      .some(input => input.value !== input.dataset.accepted))
      throw new Error('Apply or discard the numeric draft first.');
    if (!projectHandle(body)) throw new Error('The native anchor is no longer on screen.');
    const rect = canvas.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
        || rect.left !== drag.rect.left || rect.top !== drag.rect.top
        || rect.width !== drag.rect.width || rect.height !== drag.rect.height)
      throw new Error('The canvas changed during the drag.');
    const distance = Math.hypot(dx, dy);
    if (distance > 256) throw new Error('Move must stay within 256 CSS px.');
    if (distance < 3) {
      cancelDrag(); renderHandle(accepted); publishProof(accepted); say('Move below 3 CSS px; no change.');
      return;
    }
    const camera = accepted.camera, depth = drag.projection.depthScene;
    const backward = unit(camera.eye.map((value, index) => value - camera.target[index]));
    const right = unit(cross(camera.up, backward)), up = cross(backward, right);
    const tangent = Math.tan(camera.fovYDegrees * Math.PI / 360);
    const horizontal = 2 * depth * tangent * (canvas.width / canvas.height) * dx / rect.width;
    const vertical = -2 * depth * tangent * dy / rect.height;
    const { motion, index, pose } = selectedPose(accepted, drag.ref);
    const translation = pose.translationMm.map((value, axis) => value
      + (right[axis] * horizontal + up[axis] * vertical) / accepted.mmToSceneUnit);
    const targetId = motion.bindings[index].targetId;
    const poses = motion.frame.poses.map(value => value.targetId === targetId
      ? { ...value, translation } : value);
    viewer.applyGeometryMotionFrame({ ...motion.frame, poses }, motion.bindings, { basis: motion.basis });
    cancelDrag(); render(); say('Moved ' + drag.binding.bodyId + ' in the view plane.');
  } catch (error) {
    cancelDrag(); const state = viewer.getState(); renderHandle(state); publishProof(state);
    say('Move refused: ' + error.message, true);
  }
  event.preventDefault();
}, { signal: listener.signal });
for (const type of ['pointercancel', 'lostpointercapture']) {
  moveHandle.addEventListener(type, event => {
    if (activeDrag?.pointerId !== event.pointerId) return;
    cancelDrag(); const state = viewer.getState(); renderHandle(state); publishProof(state);
    say('Move cancelled: ' + type + '.', true);
  }, { signal: listener.signal });
}
function cancelYaw() {
  const drag = activeYaw;
  activeYaw = null;
  yawHandle.dataset.dragging = 'false';
  if (drag && yawHandle.hasPointerCapture(drag.pointerId)) {
    try { yawHandle.releasePointerCapture(drag.pointerId); } catch { /* Capture was already lost. */ }
  }
}
function dirtyPoseDraft() {
  return [...properties.querySelectorAll('.translation-editor input')]
    .some(input => input.value !== input.dataset.accepted);
}
yawHandle.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || activeYaw || yawHandle.hidden) return;
  try {
    const state = viewer.getState();
    const body = state.documentBodies.find(value => sameRef(value.ref, state.selectedGeometry)
      && shown(state, value.ref));
    if (state.status !== 'ready' || !body) throw new Error('Select a current visible body.');
    if (dirtyPoseDraft()) throw new Error('Apply or discard the numeric draft first.');
    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY))
      throw new Error('Pointer coordinates must be finite.');
    if (!projectHandle(body)) throw new Error('The original anchor is not on screen.');
    const { pose } = selectedPose(state, body.ref);
    const yaw = acceptedYaw(pose.rotationXYZW);
    acceptedUniformScale(pose.scale);
    const rect = canvas.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
        || rect.width <= 0 || rect.height <= 0) throw new Error('Canvas CSS size is unavailable.');
    yawHandle.setPointerCapture(event.pointerId);
    activeYaw = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      baseX: Number.parseFloat(yawHandle.style.left), baseY: Number.parseFloat(yawHandle.style.top),
      ref: body.ref, binding: body.binding, revision: state.document.document.revision,
      epoch: sceneEpoch, cameraHash: JSON.stringify(state.camera),
      motionHash: JSON.stringify(state.geometryMotion), yaw,
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      proofState: proof ? JSON.stringify(state) : null,
      proofPixels: proof ? viewer.readPixels() : null };
    yawPreviewReport = null;
    yawHandle.dataset.dragging = 'true';
    event.preventDefault();
    say('Y yaw preview. Release to apply.'); publishProof(state);
  } catch (error) { say('Y yaw refused: ' + error.message, true); }
}, { signal: listener.signal });
yawHandle.addEventListener('pointermove', event => {
  const drag = activeYaw;
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!yawHandle.hasPointerCapture(drag.pointerId)) {
    cancelYaw(); renderYawHandle(viewer.getState()); say('Y yaw cancelled: pointer capture lost.', true);
    return;
  }
  const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) {
    cancelYaw(); renderYawHandle(viewer.getState()); say('Y yaw cancelled: nonfinite pointer position.', true);
    return;
  }
  yawHandle.style.left = drag.baseX + dx + 'px';
  yawHandle.style.top = drag.baseY + 'px';
  if (proof) {
    const pixels = viewer.readPixels();
    yawPreviewReport = { dx, dy, stateSame: JSON.stringify(viewer.getState()) === drag.proofState,
      pixelsSame: pixels.length === drag.proofPixels.length
        && pixels.every((byte, index) => byte === drag.proofPixels[index]) };
  }
  event.preventDefault();
  say('Y yaw preview: ' + (drag.yaw + dx / 2).toFixed(2) + '°');
  publishProof(viewer.getState());
}, { signal: listener.signal });
yawHandle.addEventListener('pointerup', event => {
  const drag = activeYaw;
  if (!drag || event.pointerId !== drag.pointerId) return;
  try {
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!Number.isFinite(dx) || !Number.isFinite(dy))
      throw new Error('Pointer displacement must be finite.');
    const state = current(drag.ref, drag.binding.bodyId, drag.revision, drag.epoch);
    const body = state.documentBodies.find(value => sameRef(value.ref, drag.ref));
    if (!body || JSON.stringify(body.binding) !== JSON.stringify(drag.binding)
        || !shown(state, drag.ref) || !sameRef(state.selectedGeometry, drag.ref)
        || JSON.stringify(state.camera) !== drag.cameraHash
        || JSON.stringify(state.geometryMotion) !== drag.motionHash)
      throw new Error('The accepted body, camera or pose changed during the drag.');
    if (dirtyPoseDraft()) throw new Error('Apply or discard the numeric draft first.');
    if (!projectHandle(body)) throw new Error('The original anchor is not on screen.');
    const rect = canvas.getBoundingClientRect();
    if (![rect.left, rect.top, rect.width, rect.height].every(Number.isFinite)
        || rect.left !== drag.rect.left || rect.top !== drag.rect.top
        || rect.width !== drag.rect.width || rect.height !== drag.rect.height)
      throw new Error('The canvas changed during the drag.');
    if (Math.abs(dy) > 24) throw new Error('Keep the Y yaw gesture within 24 CSS px vertically.');
    if (Math.abs(dx) > 160) throw new Error('Y yaw gesture must stay within 160 CSS px.');
    if (Math.abs(dx) < 2) {
      cancelYaw(); renderYawHandle(state); publishProof(state); say('Y yaw below 2 CSS px; no change.');
      return;
    }
    const yaw = drag.yaw + dx / 2;
    if (!Number.isFinite(yaw) || Math.abs(yaw) > 180)
      throw new Error('Y yaw must stay within ±180 degrees.');
    const { motion, index, pose } = selectedPose(state, drag.ref);
    acceptedYaw(pose.rotationXYZW);
    acceptedUniformScale(pose.scale);
    const radians = yaw * Math.PI / 180;
    const rotation = [0, Math.sin(radians / 2), 0, Math.cos(radians / 2)];
    const targetId = motion.bindings[index].targetId;
    const poses = motion.frame.poses.map(value => value.targetId === targetId
      ? { ...value, rotation } : value);
    viewer.applyGeometryMotionFrame({ ...motion.frame, poses }, motion.bindings, { basis: motion.basis });
    cancelYaw(); render(); say('Y yaw applied to ' + drag.binding.bodyId + '.');
  } catch (error) {
    cancelYaw(); const state = viewer.getState(); renderYawHandle(state); publishProof(state);
    say('Y yaw refused: ' + error.message, true);
  }
  event.preventDefault();
}, { signal: listener.signal });
for (const type of ['pointercancel', 'lostpointercapture']) {
  yawHandle.addEventListener(type, event => {
    if (activeYaw?.pointerId !== event.pointerId) return;
    cancelYaw(); const state = viewer.getState(); renderYawHandle(state); publishProof(state);
    say('Y yaw cancelled: ' + type + '.', true);
  }, { signal: listener.signal });
}
canvas.addEventListener('webglcontextlost', () => {
  cancelDrag(); cancelYaw(); const notice = render();
  say('Display handles unavailable: WebGL2 context lost.' + (notice ? ' ' + notice : ''), true);
}, { signal: listener.signal });
async function reload() {
  if (activeDrag) { cancelDrag(); renderHandle(viewer.getState()); }
  if (activeYaw) { cancelYaw(); renderYawHandle(viewer.getState()); }
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
    const notice = render();
    say('Loaded document revision ' + viewer.getState().document.document.revision + '.'
      + (notice ? ' ' + notice : ''));
  } catch (error) {
    if (!disposed && request === requestEpoch) {
      const notice = accepted ? render() : '';
      say((accepted ? 'Document accepted; view update refused: ' : 'Load refused: ')
        + error.message + (notice ? ' ' + notice : ''), true);
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
fitSetButton.addEventListener('click', () => {
  if (disposed) return;
  try {
    if (dirtyPoseDraft()) throw new Error('Apply or discard the numeric draft before fitting the set.');
    const state = viewer.getState();
    if (!fitSetEligible(state)) throw new Error('Fit set needs 2..4 unique current visible bodies.');
    const refs = state.documentBodies.filter(body =>
      fitMembers.some(member => sameRef(member.ref, body.ref))).map(body => ({ ...body.ref }));
    viewer.fitNativeDocumentBodies({ refs, documentRevision: state.document.document.revision });
    render(); say('Fit set applied to ' + refs.length + ' original document bodies.');
  } catch (error) { say('Fit set refused: ' + error.message, true); }
}, { signal: listener.signal });
clearFitSetButton.addEventListener('click', () => changeFitSet('Fit set cleared.', () => {
  fitMembers = [];
}), { signal: listener.signal });
selectionFilter.addEventListener('change', () => {
  if (disposed) return;
  const discarded = dirtyPoseDraft();
  run('Selection filter: ' + filterName() + '.'
    + (discarded ? ' Numeric draft discarded.' : ''), () => {
    const state = viewer.getState();
    if (state.status !== 'ready') return;
    if (state.selectedGeometry && !eligible(state.selectedGeometry)) viewer.selectGeometry(null);
  });
}, { signal: listener.signal });
canvas.addEventListener('click', event => run('Canvas selection', () => {
  const state = viewer.getState();
  if (state.status !== 'ready' || !state.document) return;
  const rect = canvas.getBoundingClientRect();
  const hit = viewer.pickGeometry({ xCss: event.clientX - rect.left, yCss: event.clientY - rect.top },
    { curveTolerancePx: 4, ...(selectionFilter.value === 'all'
      ? {} : { kinds: [selectionFilter.value] }) });
  const ref = hit && { kind: hit.kind, ...hit.ref };
  if (ref && (!shown(state, ref) || !state.documentBodies.some(body => sameRef(body.ref, ref))))
    throw new Error('The hit is not a current visible document body.');
  viewer.selectGeometry(ref);
}), { signal: listener.signal });
function dispose() {
  if (disposed) return;
  cancelDrag();
  cancelYaw();
  disposed = true; requestEpoch++; listener.abort(); viewer.dispose(); const notice = render();
  say('Viewer disposed.' + (notice ? ' ' + notice : ''));
}
if (proof) {
  document.querySelector('#lose-context-proof').addEventListener('click', () => {
    const context = [...contexts][0];
    const extension = context?.getExtension('WEBGL_lose_context');
    if (extension) extension.loseContext();
    else say('WEBGL_lose_context is unavailable.', true);
  }, { signal: listener.signal });
  document.querySelector('#check-nonuniform').addEventListener('click', () => {
    const before = viewer.getState(), beforePixels = viewer.readPixels();
    const motion = before.geometryMotion;
    const binding = motion?.bindings.find(value => sameRef(value.ref, before.selectedGeometry));
    if (!binding) { say('Nonuniform check needs a selected display pose.', true); return; }
    const poses = motion.frame.poses.map(pose => pose.targetId === binding.targetId
      ? { ...pose, scale: [1, 2, 1] } : pose);
    try {
      viewer.applyGeometryMotionFrame({ ...motion.frame, poses }, motion.bindings, { basis: motion.basis });
      render();
      const unavailable = !properties.querySelector('.translation-editor')
        && status.textContent.includes('not uniform');
      viewer.applyGeometryMotionFrame(motion.frame, motion.bindings, { basis: motion.basis });
      const after = viewer.getState(), afterPixels = viewer.readPixels();
      nonuniformReport = { unavailable, restored: JSON.stringify(before) === JSON.stringify(after)
        && beforePixels.length === afterPixels.length
        && beforePixels.every((byte, index) => byte === afterPixels[index]) };
      render(); say('Nonuniform scale unavailable; restored=' + nonuniformReport.restored);
    } catch (error) { render(); say('Nonuniform check refused: ' + error.message, true); }
  }, { signal: listener.signal });
  document.querySelector('#check-non-y').addEventListener('click', () => {
    const before = viewer.getState(), beforePixels = viewer.readPixels();
    const motion = before.geometryMotion;
    const binding = motion?.bindings.find(value => sameRef(value.ref, before.selectedGeometry));
    if (!binding) { say('Non-Y check needs a selected display pose.', true); return; }
    const angle = Math.PI / 8;
    const poses = motion.frame.poses.map(pose => pose.targetId === binding.targetId
      ? { ...pose, rotation: [Math.sin(angle), 0, 0, Math.cos(angle)] } : pose);
    try {
      viewer.applyGeometryMotionFrame({ ...motion.frame, poses }, motion.bindings, { basis: motion.basis });
      render();
      const unavailable = !properties.querySelector('.translation-editor')
        && status.textContent.includes('not a pure Y-axis pose');
      viewer.applyGeometryMotionFrame(motion.frame, motion.bindings, { basis: motion.basis });
      const after = viewer.getState(), afterPixels = viewer.readPixels();
      nonYReport = { unavailable, restored: JSON.stringify(before) === JSON.stringify(after)
        && beforePixels.length === afterPixels.length
        && beforePixels.every((byte, index) => byte === afterPixels[index]) };
      render(); say('Non-Y pose unavailable; restored=' + nonYReport.restored);
    } catch (error) { render(); say('Non-Y check refused: ' + error.message, true); }
  }, { signal: listener.signal });
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
    const detachedApply = properties.querySelector('.translation-editor button');
    if (detachedApply) {
      render();
      detachedApply.click();
      if (status.dataset.error === 'true' && status.textContent.includes('This property panel is stale.'))
        failures.push('detached-panel');
    }
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
