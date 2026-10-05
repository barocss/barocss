import { mountScene } from '/gpu.js';

const canvas = document.querySelector('#scene');
const source = document.querySelector('#source');
const status = document.querySelector('#status');
const initial = source.value;
let renderer;
try {
  renderer = mountScene(canvas, initial);
  status.textContent = 'Scene accepted.';
} catch (error) {
  status.textContent = String(error);
}
function apply() {
  if (!renderer) { status.textContent = 'WebGL2 renderer unavailable. Reload to retry.'; return; }
  const result = renderer.update(source.value);
  status.textContent = result.ok ? 'Scene accepted.' : String(result.error);
}
document.querySelector('#apply').addEventListener('click', apply);
document.querySelector('#reset').addEventListener('click', () => { source.value = initial; apply(); });
window.addEventListener('pagehide', () => renderer?.dispose(), { once: true });
