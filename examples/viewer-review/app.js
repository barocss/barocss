import { createViewer } from '@barocss/viewer';
import { parseBaroCadDocument } from '@barocss/cad-interop/document';

const canvas = document.querySelector('canvas'), status = document.querySelector('#status');
const list = document.querySelector('#geometry'), file = document.querySelector('#open');
window.addEventListener('unhandledrejection', event => {
  const reason = event.reason;
  status.textContent = 'Initialization failed: ' + (reason?.message || String(reason));
  console.error('Viewer review initialization:', reason?.message || String(reason), reason?.stack || '');
});
const original = await (await fetch('/document.json')).json();
const viewer = await createViewer(canvas, { mmToSceneUnit: 0.15, background: [0.025, 0.04, 0.065] });
const options = { native: { sourceVersion: 0, countU: 8, countV: 8, unitsPerMillimeter: 1,
  curveDisplay: { version: 1, chordToleranceMM: 0.02, maxSegments: 512, maxDepth: 16 } },
  basis: 'authored-xyz-matches-rhyup', bodyIds: ['body_0_surface', 'body_0_curve'] };
const key = ref => JSON.stringify(ref);
let message = 'Ready. Select geometry, set the view, then save a review file.';
function update() {
  const review = viewer.captureReviewState();
  status.textContent = message;
  document.querySelector('#state').textContent = JSON.stringify(review, null, 2);
  const state = viewer.getState();
  list.replaceChildren();
  for (const ref of [...state.surfaces.map(ref => ({ kind: 'surface', ...ref })),
    ...state.curves.map(ref => ({ kind: 'curve', ...ref }))]) {
    const row = document.createElement('li'), visible = document.createElement('input');
    visible.type = 'checkbox'; visible.checked = state.visibleGeometry.some(value => key(value) === key(ref));
    const name = ref.surfaceId ?? ref.curveId;
    visible.setAttribute('aria-label', 'Show ' + name);
    visible.addEventListener('change', () => act(() => viewer.setVisibleGeometry(visible.checked
      ? [...viewer.getState().visibleGeometry, ref]
      : viewer.getState().visibleGeometry.filter(value => key(value) !== key(ref))), 'Visibility changed.'));
    const select = document.createElement('button');
    select.textContent = 'Select ' + name; select.disabled = !visible.checked;
    select.setAttribute('aria-pressed', String(key(state.selectedGeometry) === key(ref)));
    select.addEventListener('click', () => act(() => viewer.selectGeometry(ref), 'Geometry selected.'));
    row.append(visible, select); list.append(row);
  }
}
function act(action, text) {
  try { action(); message = text; }
  catch (error) { message = 'Refused: ' + error.message; }
  update();
}
function load(mode) {
  const document = structuredClone(original);
  if (mode === 'revision') document.revision++;
  if (mode === 'other') document.documentId = 'other_review_document';
  viewer.loadDocument(parseBaroCadDocument(JSON.stringify(document)), options);
}
for (const mode of ['original', 'revision', 'other']) document.querySelector('#' + mode)
  .addEventListener('click', () => act(() => load(mode), 'Loaded ' + mode + ' document.'));
for (const [id, action] of Object.entries({ orbit: () => viewer.orbit(0.4, 0.2),
  pan: () => viewer.pan(0.2, 0), zoom: () => viewer.zoom(1.2), fit: () => viewer.fit(),
  clear: () => viewer.selectGeometry(null), show: () => viewer.setVisibleGeometry([
    ...viewer.getState().surfaces.map(ref => ({ kind: 'surface', ...ref })),
    ...viewer.getState().curves.map(ref => ({ kind: 'curve', ...ref }))]) }))
  document.querySelector('#' + id).addEventListener('click', () => act(action, 'Review changed.'));
document.querySelector('#save').addEventListener('click', () => act(() => {
  const review = viewer.captureReviewState();
  const url = URL.createObjectURL(new Blob([JSON.stringify(review, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url; link.download = 'viewer-review.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}, 'Review file saved.'));
file.addEventListener('change', async () => {
  const chosen = file.files[0];
  file.value = '';
  if (!chosen) return;
  try {
    if (chosen.size > 32768) throw new RangeError('Review file exceeds 32 KiB');
    const review = JSON.parse(await chosen.text());
    act(() => viewer.applyReviewState(review), 'Review file opened and applied.');
  } catch (error) { message = 'Refused: ' + error.message; update(); }
});
load('original');
for (const control of document.querySelectorAll('button, input')) control.disabled = false;
update();
// Read-only evidence access: browser validation still performs every change through public controls.
window.viewerReviewEvidence = { state: () => viewer.captureReviewState(),
  pixels: () => viewer.readPixels(), document: () => viewer.getState().document };
