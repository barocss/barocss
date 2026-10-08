import { createCanvas2D, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { initialScene, initialSceneV0, initialSceneV2, initialSceneV3, initialSceneV4 } from './scene.mjs';
import { imageAssets } from './image-assets.mjs';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const selectedLabel = document.querySelector('#selected');
const errorLabel = document.querySelector('#error');
const selectionBox = document.querySelector('#selection-box');
const pathHandles = document.querySelector('#path-handles');
let scene = structuredClone(initialSceneV4);
let view = { panX: 0, panY: 0, zoom: 1 };
let selected = null;
let gesture = null;
let controlDrag = null;
let renderer = createCanvas2D(canvas, { logicalSize: { width: 800, height: 480 }, dpr: Math.min(4, Math.max(0.5, devicePixelRatio || 1)) });
for (const [id, asset] of imageAssets) renderer.setImageAsset(id, asset);
renderer.updateScene(scene);
renderer.render();

function findNode(id, nodes = scene.nodes, parentX = 0, parentY = 0) {
  for (const node of nodes) {
    if (node.id === id) return { node, parentX, parentY };
    if (node.children) {
      const found = findNode(id, node.children, parentX + node.transform.x, parentY + node.transform.y);
      if (found) return found;
    }
  }
  return null;
}
function updateSelection() {
  selectedLabel.textContent = selected ? `${selected.kind}: ${selected.id}` : 'No selection';
  selectionBox.style.display = 'none';
  if (!selected) return;
  const found = findNode(selected.id);
  if (!found || found.node.kind === 'line' || found.node.kind === 'path' ||
      found.node.kind === 'glyphRun' || found.node.transform.rotation !== 0) return;
  const { node, parentX, parentY } = found;
  selectionBox.style.left = `${view.panX + (parentX + node.transform.x) * view.zoom}px`;
  selectionBox.style.top = `${view.panY + (parentY + node.transform.y) * view.zoom}px`;
  selectionBox.style.width = `${node.width * node.transform.scaleX * view.zoom}px`;
  selectionBox.style.height = `${node.height * node.transform.scaleY * view.zoom}px`;
  selectionBox.style.display = 'block';
}
function updateHandles() {
  pathHandles.replaceChildren();
  for (const pathId of ['FilledBadge', 'PathRibbon']) {
    const found = findNode(pathId);
    if (!found) continue;
    const { node, parentX, parentY } = found;
    node.commands.forEach((command, commandIndex) => {
      const controls = command.kind === 'Q' ? [['cx', 'cy', 'quadratic']] :
        command.kind === 'C' ? [['c1x', 'c1y', 'cubic'], ['c2x', 'c2y', 'cubic']] : [];
      for (const [xField, yField, style] of controls) {
        const handle = document.createElement('div');
        handle.className = `control-handle ${style}`;
        handle.dataset.handle = `${commandIndex}:${xField}`;
        handle.title = `${node.id} ${xField}/${yField}`;
        handle.style.left = `${view.panX + (parentX + node.transform.x + command[xField]) * view.zoom}px`;
        handle.style.top = `${view.panY + (parentY + node.transform.y + command[yField]) * view.zoom}px`;
        handle.addEventListener('pointerdown', event => {
          event.preventDefault(); event.stopPropagation();
          controlDrag = { pathId, commandIndex, xField, yField, clientX: event.clientX, clientY: event.clientY,
            x: command[xField], y: command[yField] };
        });
        pathHandles.append(handle);
      }
    });
  }
}
function draw() {
  renderer.updateScene(scene);
  renderer.setView(view);
  renderer.render();
  updateSelection();
  updateHandles();
  status.textContent = `v${scene.version} · Zoom ${Math.round(view.zoom * 100)}% · DPR ${canvas.width / 800} · ${scene.nodes.length} frames`;
  errorLabel.textContent = '';
}
window.addEventListener('pointermove', event => {
  if (!controlDrag) return;
  const { node } = findNode(controlDrag.pathId);
  const command = node.commands[controlDrag.commandIndex];
  const oldX = command[controlDrag.xField], oldY = command[controlDrag.yField];
  command[controlDrag.xField] = controlDrag.x + (event.clientX - controlDrag.clientX) / view.zoom;
  command[controlDrag.yField] = controlDrag.y + (event.clientY - controlDrag.clientY) / view.zoom;
  try { draw(); } catch (error) {
    command[controlDrag.xField] = oldX; command[controlDrag.yField] = oldY;
    errorLabel.textContent = `${error.code || 'ERROR'}: ${error.message}`;
  }
});
window.addEventListener('pointerup', () => { controlDrag = null; });
window.addEventListener('pointercancel', () => { controlDrag = null; });
function point(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
canvas.addEventListener('pointerdown', event => {
  const p = point(event);
  selected = renderer.hitTest(p);
  gesture = { x: p.x, y: p.y, selectedId: selected?.id ?? null, panX: view.panX, panY: view.panY,
    nodeX: selected ? findNode(selected.id).node.transform.x : 0,
    nodeY: selected ? findNode(selected.id).node.transform.y : 0 };
  canvas.setPointerCapture(event.pointerId);
  updateSelection();
});
canvas.addEventListener('pointermove', event => {
  if (!gesture) return;
  const p = point(event), dx = p.x - gesture.x, dy = p.y - gesture.y;
  if (gesture.selectedId) {
    const found = findNode(gesture.selectedId);
    found.node.transform.x = gesture.nodeX + dx / view.zoom;
    found.node.transform.y = gesture.nodeY + dy / view.zoom;
  } else view = { ...view, panX: gesture.panX + dx, panY: gesture.panY + dy };
  draw();
});
function endGesture() { gesture = null; }
canvas.addEventListener('pointerup', endGesture);
canvas.addEventListener('pointercancel', endGesture);
function zoomAt(nextZoom, x = 400, y = 240) {
  const zoom = Math.min(64, Math.max(0.05, nextZoom));
  const worldX = (x - view.panX) / view.zoom, worldY = (y - view.panY) / view.zoom;
  view = { panX: x - worldX * zoom, panY: y - worldY * zoom, zoom };
  draw();
}
canvas.addEventListener('wheel', event => {
  event.preventDefault(); const p = point(event);
  zoomAt(view.zoom * (event.deltaY < 0 ? 1.1 : 1 / 1.1), p.x, p.y);
}, { passive: false });
document.querySelector('#zoom-in').addEventListener('click', () => zoomAt(view.zoom * 1.25));
document.querySelector('#zoom-out').addEventListener('click', () => zoomAt(view.zoom / 1.25));
document.querySelector('#reset').addEventListener('click', () => {
  scene = structuredClone(initialSceneV4); view = { panX: 0, panY: 0, zoom: 1 }; selected = null; draw();
});
document.querySelector('#open-v3').addEventListener('click', () => {
  scene = structuredClone(initialSceneV3); view = { panX: 0, panY: 0, zoom: 1 }; selected = null; draw();
});
document.querySelector('#open-v2').addEventListener('click', () => {
  scene = structuredClone(initialSceneV2); view = { panX: 0, panY: 0, zoom: 1 }; selected = null; draw();
});
document.querySelector('#open-v1').addEventListener('click', () => {
  scene = structuredClone(initialScene); view = { panX: 0, panY: 0, zoom: 1 }; selected = null; draw();
});
document.querySelector('#open-v0').addEventListener('click', () => {
  scene = structuredClone(initialSceneV0); view = { panX: 0, panY: 0, zoom: 1 }; selected = null; draw();
});
document.querySelector('#save').addEventListener('click', () => {
  const blob = new Blob([stringifySceneJSON(scene)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'canvas2d-scene.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
document.querySelector('#open').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try { const next = parseSceneJSON(await file.text()); renderer.updateScene(next); scene = next; selected = null; draw(); }
  catch (error) { errorLabel.textContent = `${error.code || 'ERROR'}: ${error.message}`; }
  event.target.value = '';
});
window.__canvas2dDebug = {
  get scene() { return structuredClone(scene); }, get view() { return { ...view }; },
  hit(point) { return renderer.hitTest(point); },
  pathObservation(id = 'PathRibbon') { return renderer.getPathObservation(id); },
  fillObservation(id = 'FilledBadge') { return renderer.getFillObservation(id); },
  capabilities() { return renderer.getCapabilities(); },
  getImageAsset(id) { return renderer.getImageAsset(id); },
  setImageAsset(id, value) { renderer.setImageAsset(id, value); renderer.render(); },
  removeImageAsset(id) { renderer.removeImageAsset(id); },
  resizeDpr(dpr) { renderer.resize({ width: 800, height: 480 }, dpr); renderer.render(); updateSelection(); updateHandles(); },
  setScene(next) { renderer.updateScene(next); scene = structuredClone(next); draw(); },
  setView(next) { renderer.setView(next); view = { ...next }; draw(); },
  pixel(x, y) { const gl = canvas.getContext('webgl2'); const p = new Uint8Array(4);
    gl.readPixels(x, canvas.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return [...p]; },
  recreate() { renderer.dispose(); renderer = createCanvas2D(canvas,
    { logicalSize: { width: 800, height: 480 }, dpr: Math.min(4, Math.max(0.5, devicePixelRatio || 1)) });
    for (const [id, asset] of imageAssets) renderer.setImageAsset(id, asset);
    draw(); },
};
draw();
