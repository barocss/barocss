import { mountMesh } from '/gpu.js';
import { quarterCylinder, asymmetric, meshOptions } from '/mesh-fixtures.js';
const canvas = document.querySelector('#mesh'), status = document.querySelector('#status');
let renderer;
try { renderer = mountMesh(canvas, quarterCylinder(), { ...meshOptions, mmToSceneUnit: 0.1, translate: [-0.5,-1.5,0] }); status.textContent = 'Mesh accepted.'; }
catch (error) { status.textContent = error.message; }
for (const [id, fixture, translate] of [['cylinder',quarterCylinder,[-0.5,-1.5,0]], ['patch',()=>structuredClone(asymmetric),meshOptions.translate]]) document.querySelector(`#${id}`).onclick = () => {
  if (!renderer) return;
  const result = renderer.update(fixture(), { ...meshOptions, mmToSceneUnit: id === 'cylinder' ? 0.1 : meshOptions.mmToSceneUnit, translate }); status.textContent = result.ok ? 'Mesh accepted.' : result.error.message;
};
window.addEventListener('pagehide', () => renderer?.dispose(), { once: true });
