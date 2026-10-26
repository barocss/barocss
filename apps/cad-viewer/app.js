import { createViewer } from '@barocss/viewer';
import { compileMeshMaterial } from '@barocss/gpu';
import { parseDocument, readDocument, loadOptions } from './document.js';
import { attachPngExport } from './png-export.js';

const $ = id => document.getElementById(id);
const canvas = $('viewport'), stage = $('viewport-stage');
let viewer, active = null, candidate = null, admitted = [];
let documentEpoch = 0, reviewEpoch = 0, frameGeneration = 0, lastGuard;
let png, pointerControls, keyboardControls, resizeObserver;
let appearanceBinding, appearanceTarget;
const sameRef = (a, b) => a?.kind === b?.kind && a?.modelId === b?.modelId
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
const loaded = () => Boolean(active && viewer);
const guard = () => JSON.stringify({ review: loaded() ? viewer.captureReviewState() : null,
  materials: viewer?.getState().surfaceMaterials ?? [], width: canvas.width, height: canvas.height });
function recordFrame() {
  const current = guard();
  if (current !== lastGuard) { frameGeneration++; lastGuard = current; }
  return current;
}
function status(text, error = false) {
  $('status').textContent = text;
  $('status').dataset.level = error ? 'error' : 'info';
}
function run(action, text) {
  try { action(); status(text); }
  catch (error) { status(error?.message || String(error), true); }
  render();
}
function bindingFor(ref, state = viewer.getState()) {
  return state.documentBodies.find(body => sameRef(body.ref, ref))?.binding;
}
function titleFor(ref, state = viewer.getState()) {
  const binding = bindingFor(ref, state);
  return active?.catalog.find(body => body.id === binding?.bodyId)?.name
    || ref.surfaceId || ref.curveId;
}
function materialFor(ref, state) {
  return ref.kind === 'surface' && state.surfaceMaterials.find(entry =>
    entry.ref.modelId === ref.modelId && entry.ref.surfaceId === ref.surfaceId);
}
function renderBodies(state) {
  const list = $('body-list'), filter = $('body-search').value.trim().toLowerCase();
  const groups = new Map();
  list.replaceChildren();
  for (const body of active?.catalog ?? []) {
    if (filter && ![body.name, body.id, body.geometryId, body.assetId].join(' ').toLowerCase().includes(filter)) continue;
    if (!groups.has(body.assetId)) {
      const group = document.createElement('section'); group.className = 'asset-group';
      const heading = document.createElement('div'); heading.className = 'asset-heading';
      const name = document.createElement('span'); name.textContent = body.assetId;
      const count = document.createElement('small');
      const bodies = active.catalog.filter(value => value.assetId === body.assetId);
      count.textContent = `${bodies.filter(value => state.documentBodies.some(entry => entry.binding.bodyId === value.id)).length} / ${bodies.length}`;
      heading.append(name, count);
      const children = document.createElement('div'); children.className = 'asset-bodies';
      group.append(heading, children); list.append(group); groups.set(body.assetId, children);
    }
    const entry = state.documentBodies.find(value => value.binding.bodyId === body.id);
    const ref = entry?.ref, visible = ref && state.visibleGeometry.some(value => sameRef(value, ref));
    const bound = ref && materialFor(ref, state);
    const row = document.createElement('div');
    row.className = 'body-row' + (entry && !visible ? ' is-hidden' : '');
    row.dataset.bodyId = body.id;
    row.dataset.selected = String(Boolean(ref && sameRef(state.selectedGeometry, ref)));
    row.dataset.admitted = String(Boolean(entry));
    const show = document.createElement('input');
    show.type = 'checkbox'; show.className = 'body-visibility'; show.checked = Boolean(visible);
    show.disabled = !entry || Boolean(bound);
    show.setAttribute('aria-label', 'Show ' + body.name);
    show.title = bound ? 'Clear the Surface material before hiding it.' : !entry ? 'Choose this body in Manage bodies.' : 'Show body';
    show.addEventListener('change', () => run(() => {
      const current = viewer.getState();
      viewer.setVisibleGeometry(show.checked ? [...current.visibleGeometry, ref]
        : current.visibleGeometry.filter(value => !sameRef(value, ref)));
    }, 'Visibility updated.'));
    const select = document.createElement('button');
    select.type = 'button'; select.className = 'body-select';
    select.disabled = !visible || Boolean(bound);
    select.setAttribute('aria-label', 'Select ' + body.name);
    select.setAttribute('aria-pressed', row.dataset.selected);
    select.title = bound ? 'Clear the Surface material before selecting it.' : body.geometryId;
    const name = document.createElement('span'); name.textContent = body.name;
    const detail = document.createElement('small'); detail.textContent = entry ? body.geometryId : 'Not loaded';
    select.append(name, detail);
    select.addEventListener('click', () => run(() => viewer.selectGeometry(ref), body.name + ' selected.'));
    const kind = document.createElement('span'); kind.className = 'body-kind';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 20 20'); icon.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', body.kind === 'surface'
      ? 'M3 6 13 3 17 14 7 17Z M6 5 10 16 M10 4 14 15 M5 10 15 7 M6 14 16 11'
      : 'M3 15C4 2 14 18 17 5 M3 14v2 M16 5h2');
    icon.append(path); kind.append(icon);
    kind.title = body.kind;
    row.append(show, kind, select); groups.get(body.assetId).append(row);
  }
  if (!list.childElementCount) {
    const note = document.createElement('p'); note.className = 'list-empty';
    note.textContent = active ? 'No matching bodies.' : 'Open a document to view its bodies.';
    list.append(note);
  }
  $('body-count').textContent = loaded() ? `${admitted.length} / ${active.catalog.length} loaded` : 'No document';
}
function renderSelection(state) {
  const ref = state.selectedGeometry, details = $('selection-details');
  details.replaceChildren();
  $('selection-empty').hidden = Boolean(ref);
  details.hidden = !ref;
  if (!ref) return;
  const binding = bindingFor(ref, state);
  const rows = [['Name', titleFor(ref, state)], ['Type', ref.kind === 'surface' ? 'Surface' : 'Curve'],
    ['Geometry', ref.surfaceId ?? ref.curveId], ['Body', binding?.bodyId],
    ['Asset', binding?.assetId], ['Asset revision', binding?.assetRevision],
    ['Document', active.id], ['Revision', active.revision], ['Units', 'mm']];
  for (const [label, value] of rows) {
    const term = document.createElement('dt'), description = document.createElement('dd');
    term.textContent = label; description.textContent = String(value ?? '—');
    details.append(term, description);
  }
}
function renderAppearance(state) {
  const target = $('appearance-target'), previous = target.value;
  target.replaceChildren();
  for (const ref of state.surfaces) {
    const option = document.createElement('option');
    option.value = surfaceKey(ref); option.textContent = titleFor({ kind: 'surface', ...ref }, state);
    target.append(option);
  }
  if (state.surfaces.some(ref => surfaceKey(ref) === previous)) target.value = previous;
  const ref = state.surfaces.find(ref => surfaceKey(ref) === target.value);
  const tagged = ref && { kind: 'surface', ...ref };
  const binding = tagged && materialFor(tagged, state);
  const stamp = JSON.stringify(binding || null);
  if (target.value !== appearanceTarget || stamp !== appearanceBinding) {
    $('appearance-preset').value = binding
      ? Object.keys(presets).find(key => presets[key] === binding.binding.material.source) || 'default' : 'default';
    appearanceTarget = target.value; appearanceBinding = stamp;
  }
  const visible = tagged && state.visibleGeometry.some(value => sameRef(value, tagged));
  const selected = tagged && sameRef(state.selectedGeometry, tagged);
  const reason = !ref ? 'Load a Surface to change its appearance.' : !visible
    ? 'Show this Surface first.' : selected ? 'Clear the Surface selection before applying.' : '';
  target.disabled = !ref; $('appearance-preset').disabled = !ref;
  $('apply-appearance').disabled = Boolean(reason);
  $('appearance-note').textContent = reason || (binding
    ? 'Choose Default to enable Surface selection and hiding.' : 'Changes apply to this session.');
}
function render() {
  if (!viewer) return;
  recordFrame();
  const state = viewer.getState(), ready = loaded();
  $('document-title').textContent = active?.label || 'Untitled session';
  $('document-tab-title').textContent = active?.label || 'No document';
  $('document-tab-title').title = active?.label || 'No document';
  $('document-subtitle').textContent = active ? `${active.id} · revision ${active.revision}` : 'No document open';
  $('empty-state').hidden = ready;
  for (const id of ['save-review', 'open-review', 'fit-all', 'show-all', 'rechoose-bodies', 'body-search']) $(id).disabled = !ready;
  for (const id of ['hide-selected', 'isolate-selected', 'clear-selection']) $(id).disabled = !state.selectedGeometry;
  const isolateBlocked = Boolean(state.selectedGeometry && state.surfaceMaterials.some(entry =>
    !sameRef({ kind: 'surface', ...entry.ref }, state.selectedGeometry)));
  $('isolate-selected').disabled ||= isolateBlocked;
  $('isolate-selected').title = isolateBlocked ? 'Clear material overrides on other bodies before isolating.' : 'Show only the selected body';
  $('fit-all').disabled = !ready || state.visibleGeometry.length === 0;
  const camera = ready ? viewer.captureReviewState().camera : null;
  const offset = camera?.eye.map((value, index) => value - camera.target[index]);
  const distance = offset && Math.hypot(...offset);
  for (const [name, view] of Object.entries(viewDirections)) {
    const button = $('view-' + name); button.disabled = !ready;
    button.setAttribute('aria-pressed', String(Boolean(camera
      && view.direction.every((value, index) => Math.abs(value - offset[index] / distance) < 1e-6)
      && view.up.every((value, index) => Math.abs(value - camera.up[index]) < 1e-6))));
  }
  $('session-meta').textContent = ready ? `${state.visibleGeometry.length} visible · ${admitted.length} loaded · mm` : 'Ready';
  renderBodies(state); renderSelection(state); renderAppearance(state); png?.refresh();
}

function selectedBodyIds() {
  return [...$('admission-list').querySelectorAll('input:checked')].map(input => input.value);
}
function syncAdmission() {
  const ids = selectedBodyIds();
  $('admission-count').textContent = `${ids.length} of 4 bodies selected`;
  $('admit-document').disabled = ids.length < 1 || ids.length > 4;
  for (const input of $('admission-list').querySelectorAll('input')) {
    const body = candidate.catalog.find(body => body.id === input.value);
    input.disabled = !body.supported || (!input.checked && ids.length >= 4);
  }
}
function chooseBodies(next, defaults = next.defaultBodyIds) {
  candidate = next;
  $('candidate-title').textContent = next.label;
  $('candidate-meta').textContent = `${next.id} · revision ${next.revision} · ${next.catalog.length} bodies`;
  $('admission-error').textContent = '';
  $('admission-list').replaceChildren();
  for (const body of next.catalog) {
    const row = document.createElement('label'); row.className = 'admission-row';
    const input = document.createElement('input'); input.type = 'checkbox'; input.value = body.id;
    input.checked = body.supported && defaults.includes(body.id);
    input.disabled = !body.supported;
    input.setAttribute('aria-label', 'Load ' + body.name);
    input.addEventListener('change', syncAdmission);
    const text = document.createElement('span'), name = document.createElement('strong'), detail = document.createElement('small');
    name.textContent = body.name; detail.textContent = body.supported ? `${body.kind} · ${body.geometryId}` : body.reason;
    text.append(name, detail); row.append(input, text); $('admission-list').append(row);
  }
  syncAdmission();
  if (!$('admission-dialog').open) $('admission-dialog').showModal();
}
async function openDocument(file) {
  const request = ++documentEpoch;
  try {
    const next = await readDocument(file);
    if (request !== documentEpoch) return;
    chooseBodies(next);
  } catch (error) { if (request === documentEpoch) status('Document not opened: ' + error.message, true); }
}
function downloadReview() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(viewer.captureReviewState(), null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'viewer-review.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

for (const id of ['open-document', 'empty-open']) $(id).addEventListener('click', () => {
  documentEpoch++; $('document-file').click();
});
$('document-file').addEventListener('change', () => {
  documentEpoch++;
  const file = $('document-file').files[0]; $('document-file').value = '';
  if (file) openDocument(file);
});
$('document-file').addEventListener('cancel', () => { documentEpoch++; });
$('open-sample').addEventListener('click', async () => {
  const request = ++documentEpoch;
  try {
    const response = await fetch('/sample.cad-document.json');
    if (!response.ok) throw new Error('The sample is unavailable.');
    const text = await response.text();
    if (request !== documentEpoch) return;
    chooseBodies(parseDocument(text, 'Sample document'));
  } catch (error) { if (request === documentEpoch) status(error.message, true); }
});
$('rechoose-bodies').addEventListener('click', () => { documentEpoch++; chooseBodies(active, admitted); });
$('cancel-document').addEventListener('click', () => { documentEpoch++; candidate = null; $('admission-dialog').close(); });
$('admission-dialog').addEventListener('cancel', () => { documentEpoch++; candidate = null; });
$('admit-document').addEventListener('click', () => {
  if (!candidate) return;
  try {
    const ids = selectedBodyIds();
    if (ids.length < 1 || ids.length > 4) throw new Error('Choose between 1 and 4 bodies.');
    viewer.loadDocument(candidate.result, loadOptions(ids));
    active = candidate; admitted = ids; candidate = null;
    documentEpoch++; reviewEpoch++; frameGeneration++;
    appearanceBinding = undefined; appearanceTarget = undefined;
    $('body-search').value = ''; $('admission-dialog').close();
    status('Document opened. Drag to orbit. Shift+drag to pan.'); render();
  } catch (error) { $('admission-error').textContent = error.message; }
});
$('body-search').addEventListener('input', render);
$('fit-all').addEventListener('click', () => run(() => viewer.fit(), 'View fitted.'));
for (const [name, view] of Object.entries(viewDirections)) $('view-' + name).addEventListener('click', () => run(() => {
  const camera = viewer.captureReviewState().camera;
  const distance = Math.hypot(...camera.eye.map((value, index) => value - camera.target[index]));
  viewer.setView({ ...camera, eye: camera.target.map((value, index) => value + distance * view.direction[index]), up: [...view.up] });
}, name === 'iso' ? 'Isometric view.' : name[0].toUpperCase() + name.slice(1) + ' view.'));
$('show-all').addEventListener('click', () => run(() => {
  const state = viewer.getState();
  viewer.setVisibleGeometry([...state.surfaces.map(ref => ({ kind: 'surface', ...ref })),
    ...state.curves.map(ref => ({ kind: 'curve', ...ref }))]);
}, 'All loaded bodies shown.'));
$('clear-selection').addEventListener('click', () => run(() => viewer.selectGeometry(null), 'Selection cleared.'));
$('hide-selected').addEventListener('click', () => run(() => {
  const state = viewer.getState();
  viewer.setVisibleGeometry(state.visibleGeometry.filter(ref => !sameRef(ref, state.selectedGeometry)));
}, 'Selected body hidden.'));
$('isolate-selected').addEventListener('click', () => run(() => {
  const selected = viewer.getState().selectedGeometry;
  if (!selected) throw new Error('Select a body first.');
  viewer.setVisibleGeometry([selected]);
}, 'Selected body isolated.'));
$('appearance-target').addEventListener('change', render);
$('apply-appearance').addEventListener('click', () => run(() => {
  const ref = viewer.getState().surfaces.find(ref => surfaceKey(ref) === $('appearance-target').value);
  if (!ref) throw new Error('Choose a loaded Surface.');
  const preset = $('appearance-preset').value;
  if (preset === 'default') viewer.setSurfaceMaterial(ref, null);
  else {
    if (!Object.hasOwn(presets, preset)) throw new Error('Choose an appearance.');
    const compiled = compileMeshMaterial(presets[preset]);
    if (!compiled.ok) throw new Error('The appearance could not be compiled.');
    viewer.setSurfaceMaterial(ref, { material: compiled.material, uniforms: {} });
  }
}, 'Appearance applied.'));
$('save-review').addEventListener('click', () => run(downloadReview, 'Review saved.'));
$('open-review').addEventListener('click', () => { reviewEpoch++; $('review-file').click(); });
$('review-file').addEventListener('change', async () => {
  const request = ++reviewEpoch, file = $('review-file').files[0]; $('review-file').value = '';
  if (!file || !loaded()) return;
  const before = recordFrame(), version = frameGeneration;
  try {
    if (file.size > 32768) throw new Error('Review files must be 32 KiB or smaller.');
    const text = await file.text();
    if (request !== reviewEpoch) return;
    if (before !== guard() || version !== frameGeneration) throw new Error('The view changed. Open the review again.');
    run(() => viewer.applyReviewState(JSON.parse(text)), 'Review opened.');
  } catch (error) { if (request === reviewEpoch) status('Review not opened: ' + error.message, true); }
});
$('review-file').addEventListener('cancel', () => { reviewEpoch++; });

try {
  viewer = await createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.026, 0.033, 0.045] });
  const controlError = error => { status(error?.message || String(error), true); render(); };
  pointerControls = viewer.attachPointerControls({ onError: controlError });
  keyboardControls = viewer.attachKeyboardControls({ onError: controlError });
  canvas.addEventListener('pointerdown', event => {
    if (event.isPrimary && event.button === 0) canvas.focus({ preventScroll: true });
  });
  for (const type of ['pointermove', 'wheel', 'keydown']) canvas.addEventListener(type, event => {
    if (event.defaultPrevented) render();
  }, type === 'wheel' ? { passive: true } : undefined);
  canvas.addEventListener('click', event => {
    if (!loaded() || event.button !== 0) return;
    run(() => {
      const rect = canvas.getBoundingClientRect();
      const hit = viewer.pickGeometry({ xCss: event.clientX - rect.left, yCss: event.clientY - rect.top });
      if (hit?.ambiguous) throw new Error('The pick is ambiguous. Choose another point.');
      viewer.selectGeometry(hit ? { kind: hit.kind, ...hit.ref } : null);
    }, 'Selection updated.');
  });
  png = attachPngExport({ viewer, canvas, button: $('export-png'), status: $('export-status'),
    isLoaded: loaded, frameGuard: recordFrame, generation: () => frameGeneration });
  resizeObserver = new ResizeObserver(() => {
    const rect = stage.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const scale = Math.min(devicePixelRatio || 1, 2, 4096 / rect.width, 4096 / rect.height,
      Math.sqrt(4194304 / (rect.width * rect.height)));
    const width = Math.max(1, Math.floor(rect.width * scale));
    const height = Math.max(1, Math.floor(rect.height * scale));
    if (canvas.width === width && canvas.height === height) return;
    run(() => viewer.resize(width, height), loaded() ? 'Viewport resized.' : 'Open a CAD document to begin.');
  });
  resizeObserver.observe(stage);
  for (const id of ['open-document', 'empty-open', 'open-sample']) $(id).disabled = false;
  status('Open a CAD document to begin.'); render();
  window.cadViewerEvidence = {
    state: () => viewer.getState(), review: () => loaded() ? viewer.captureReviewState() : null,
    pixels: () => viewer.readPixels(), document: () => viewer.getState().document,
  };
} catch (error) {
  status('Viewer could not start: ' + (error?.message || String(error)), true);
  console.error('CAD Viewer initialization:', error);
}
window.addEventListener('pagehide', event => {
  documentEpoch++; reviewEpoch++; png?.cancel();
  if (event.persisted) return;
  png?.dispose(); pointerControls?.dispose(); keyboardControls?.dispose();
  resizeObserver?.disconnect(); viewer?.dispose();
});
