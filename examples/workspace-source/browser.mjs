import { Viewer, nativeSource, runCPUFlow, requireValue } from './flow.mjs';

export const sourceLabel = 'source-default-1010';
const canvas = document.querySelector('#view');
const status = document.querySelector('#status');
const label = document.querySelector('#source-label');
const controls = [...document.querySelectorAll('button')];
label.textContent = sourceLabel;
const hash = bytes => bytes.reduce((value, byte) => Math.imul(value ^ byte, 16777619) >>> 0, 2166136261);
let viewer;
let proof = { ok: false, sourceLabel };

function show() {
  window.sourceProof = proof;
  status.textContent = JSON.stringify(proof, null, 2);
  fetch('/browser-proof', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify(proof) }).catch(() => {});
}
async function restore() {
  viewer.loadNative(nativeSource, { sourceVersion: 0, countU: 8, countV: 8 });
  viewer.fit();
  proof.status = viewer.getState().status;
  proof.currentHash = hash(await viewer.readPixels());
}
async function clear() {
  viewer.clear();
  proof.status = viewer.getState().status;
  proof.currentHash = hash(await viewer.readPixels());
  requireValue(proof.currentHash === proof.blankHash, 'Clear did not restore blank pixels');
}
function dispose() {
  viewer.dispose();
  proof.status = viewer.getState().status;
  requireValue(proof.status === 'disposed', 'Viewer dispose status is missing');
  proof.disposedRefused = false;
  try { viewer.clear(); } catch { proof.disposedRefused = true; }
  requireValue(proof.disposedRefused, 'Disposed Viewer accepted clear');
  document.querySelector('#clear').disabled = true;
  document.querySelector('#restore').disabled = true;
  document.querySelector('#dispose').disabled = true;
}
async function runSourceFlow() {
  viewer?.dispose();
  controls.forEach(control => { control.disabled = false; });
  proof = { ok: false, sourceLabel, cpu: runCPUFlow() };
  viewer = await Viewer.createViewer(canvas, { mmToSceneUnit: 0.03, background: [0.025, 0.045, 0.075],
    lighting: { ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1] } });
  viewer.clear();
  proof.blankHash = hash(await viewer.readPixels());
  await restore();
  proof.nativeHash = proof.currentHash;
  const state = viewer.getState();
  requireValue(state.status === 'ready' && state.surfaces.length === 1
    && state.surfaces[0].surfaceId === 'quarter_cylinder' && proof.nativeHash !== proof.blankHash,
    'Native Surface did not produce an actual GPU frame');
  const ref = state.surfaces[0];
  proof.distanceMM = viewer.measureNativeSurfacePoints({ ...ref, u: 0, v: 0 },
    { ...ref, u: 1, v: 1 }).distanceMM;
  requireValue(proof.distanceMM > 30, 'Native Surface measurement failed');
  await clear();
  proof.clearHash = proof.currentHash;
  await restore();
  requireValue(proof.currentHash === proof.nativeHash, 'Restore changed native display pixels');
  proof.restoredHash = proof.currentHash;
  proof.ok = true;
  show();
  return proof;
}
async function action(callback) {
  try { await callback(); } catch (error) { proof.ok = false; proof.error = error.stack || error.message; }
  show();
}
window.runSourceFlow = () => action(runSourceFlow);
document.querySelector('#run').onclick = window.runSourceFlow;
document.querySelector('#clear').onclick = () => action(clear);
document.querySelector('#restore').onclick = () => action(restore);
document.querySelector('#dispose').onclick = () => action(dispose);
window.addEventListener('pagehide', () => viewer?.dispose(), { once: true });
action(runSourceFlow);
