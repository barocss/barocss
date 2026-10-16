import { createViewer } from '/gpu.js';
import { quarterCylinder, asymmetric, meshOptions } from '/mesh-fixtures.js';
const canvas = document.querySelector('#mesh'), status = document.querySelector('#status');
const viewer = await createViewer(canvas, { background: meshOptions.background, camera: { up: [0, 1, 0], position: [0, 0, 6], target: [0, 0, 0] } });
let mesh = null;
// A host packet in millimetres, scaled and moved into the scene.
function show(packet, mmToSceneUnit, translate) {
  const positions = packet.positions.map((v, i) => v * mmToSceneUnit + translate[i % 3]);
  mesh?.remove();
  mesh = viewer.add({ positions, normals: packet.normals, indices: packet.indices }, { material: { color: meshOptions.color, doubleSided: true } });
  status.textContent = 'Mesh accepted.';
}
show(quarterCylinder(), 0.1, [-0.5, -1.5, 0]);
viewer.fit();
document.querySelector('#cylinder').onclick = () => show(quarterCylinder(), 0.1, [-0.5, -1.5, 0]);
document.querySelector('#patch').onclick = () => show(structuredClone(asymmetric), meshOptions.mmToSceneUnit, meshOptions.translate);
window.addEventListener('pagehide', () => viewer.dispose(), { once: true });
