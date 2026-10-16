import { createViewer, showScene } from '/gpu.js';

const canvas = document.querySelector('#scene');
const source = document.querySelector('#source');
const status = document.querySelector('#status');
const example = document.querySelector('#scene-example');
const initial = source.value;
const torus = '@scene ring { version:1; torus #ring; }\n#ring { major-radius:1; minor-radius:.25; color:#7cd8ca; }';
// The scene language is Y up; the source header picks its version.
const front = { position: [0, 0, 6], target: [0, 0, 0], up: [0, 1, 0], fovY: 45 };
const above = { position: [0, 6, 0], target: [0, 0, 0], up: [0, 0, -1], fovY: 45 };
const viewer = await createViewer(canvas, { camera: front });
let view = null;
const message = diagnostics => diagnostics.map(d => d.message).join('; ');
function apply() {
  Object.assign(viewer.camera, example.value === 'torus' ? above : front);
  if (view) {
    const result = view.update(source.value);
    status.textContent = result.ok ? 'Scene accepted.' : message(result.diagnostics);
    return;
  }
  try { view = showScene(viewer, source.value, { fit: false }); status.textContent = 'Scene accepted.'; }
  catch (error) { status.textContent = error.diagnostics ? message(error.diagnostics) : String(error); }
}
example.addEventListener('change', () => {
  source.value = example.value === 'torus' ? torus : initial;
  status.textContent = 'Example staged. Apply scene to render it.';
});
document.querySelector('#apply').addEventListener('click', apply);
document.querySelector('#reset').addEventListener('click', () => { example.value = 'baseline'; source.value = initial; apply(); });
window.sceneExample = { viewer, get view() { return view; } };
window.addEventListener('pagehide', () => viewer.dispose(), { once: true });
apply();
