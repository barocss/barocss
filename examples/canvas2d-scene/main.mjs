import { createCanvas2D, parseSceneJSON, stringifySceneJSON } from '../../packages/barocss-canvas2d/dist/index.js';
import { initialScene, initialSceneV0, initialSceneV2, initialSceneV3, initialSceneV4 } from './scene.mjs';
import { imageAssets } from './image-assets.mjs';
import { SceneHistory } from './scene-history.mjs';
import { findSceneNode, listSceneNodes, removeSelected, translateSelected } from './scene-interaction.mjs';

const canvas = document.querySelector('#scene');
const status = document.querySelector('#status');
const selectedLabel = document.querySelector('#selected');
const errorLabel = document.querySelector('#error');
const selectionBox = document.querySelector('#selection-box');
const pathHandles = document.querySelector('#path-handles');
const undoButton = document.querySelector('#undo');
const redoButton = document.querySelector('#redo');
const moveRightButton = document.querySelector('#move-right');
const widthButton = document.querySelector('#width-plus');
const heightButton = document.querySelector('#height-plus');
const rotateButton = document.querySelector('#rotate-plus');
const deleteButton = document.querySelector('#delete-selected');
const snapInput = document.querySelector('#snap');
const objectList = document.querySelector('#object-list');
const selectionStatus = document.querySelector('#selection-status');
let scene = structuredClone(initialSceneV4);
let view = { panX: 0, panY: 0, zoom: 1 };
let selected = null;
let selectedIds = new Set();
let gesture = null;
let controlDrag = null;
let renderer = createCanvas2D(canvas, { logicalSize: { width: 800, height: 480 }, dpr: Math.min(4, Math.max(0.5, devicePixelRatio || 1)) });
for (const [id, asset] of imageAssets) renderer.setImageAsset(id, asset);
const history = new SceneHistory(renderer, scene);

function findNode(id, nodes = scene.nodes) { return findSceneNode(id, nodes); }
function selectHit(hit, toggle = false, preserveMulti = false) {
  if (toggle && hit) {
    if (selectedIds.has(hit.id)) selectedIds.delete(hit.id);
    else selectedIds.add(hit.id);
  } else if (hit && (!preserveMulti || !selectedIds.has(hit.id))) selectedIds = new Set([hit.id]);
  else if (!hit) selectedIds.clear();
  const id = toggle && hit && selectedIds.has(hit.id) ? hit.id : [...selectedIds].at(-1);
  const node = id ? findNode(id)?.node : null;
  selected = node ? { id, kind: node.kind } : null;
  updateSelection();
}
function updateObjectList() {
  const focusedId = document.activeElement?.dataset.nodeId;
  objectList.replaceChildren(...listSceneNodes(scene.nodes).map(item => {
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.nodeId = item.id;
    button.style.marginLeft = `${item.depth * 12}px`;
    button.textContent = `${item.name} · ${item.kind} · ${item.id} · layer ${item.layer}`;
    button.setAttribute('aria-pressed', String(selectedIds.has(item.id)));
    button.addEventListener('click', event => selectHit({ id: item.id, kind: item.kind }, event.shiftKey));
    row.append(button);
    return row;
  }));
  if (focusedId) [...objectList.querySelectorAll('button')]
    .find(button => button.dataset.nodeId === focusedId)?.focus();
}
function updateSelection() {
  selectedLabel.textContent = selectedIds.size > 1 ? `${selectedIds.size} selected: ${[...selectedIds].join(', ')}` :
    selected ? `${selected.kind}: ${selected.id}` : 'No selection';
  selectionStatus.textContent = selectedLabel.textContent;
  moveRightButton.disabled = selectedIds.size === 0;
  deleteButton.disabled = selectedIds.size === 0;
  const single = selectedIds.size === 1 ? findNode(selected.id)?.node : null;
  widthButton.disabled = !single || !['rect', 'image', 'frame'].includes(single.kind);
  heightButton.disabled = widthButton.disabled;
  rotateButton.disabled = !single || !['rect', 'image', 'path', 'line', 'glyphRun'].includes(single.kind);
  selectionBox.style.display = 'none';
  if (!single) { updateObjectList(); return; }
  const found = findNode(selected.id);
  if (!found || found.node.kind === 'group' || found.node.kind === 'line' ||
      found.node.kind === 'path' || found.node.kind === 'glyphRun' ||
      found.node.transform.rotation !== 0 ||
      found.parentMatrix.some((value, index) => index < 4 && value !== [1, 0, 0, 1][index])) {
    updateObjectList(); return;
  }
  const { node, parentX, parentY } = found;
  selectionBox.style.left = `${view.panX + (parentX + node.transform.x) * view.zoom}px`;
  selectionBox.style.top = `${view.panY + (parentY + node.transform.y) * view.zoom}px`;
  selectionBox.style.width = `${node.width * node.transform.scaleX * view.zoom}px`;
  selectionBox.style.height = `${node.height * node.transform.scaleY * view.zoom}px`;
  selectionBox.style.display = 'block';
  updateObjectList();
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
function reconcileSelection() {
  for (const id of selectedIds) if (!findNode(id)) selectedIds.delete(id);
  const id = [...selectedIds].at(-1);
  const node = id ? findNode(id)?.node : null;
  selected = node ? { id, kind: node.kind } : null;
}
function draw() {
  renderer.updateScene(scene);
  renderer.setView(view);
  renderer.render();
  reconcileSelection();
  updateSelection();
  updateHandles();
  status.textContent = `v${scene.version} · Zoom ${Math.round(view.zoom * 100)}% · DPR ${canvas.width / 800} · ${scene.nodes.length} frames`;
  undoButton.disabled = !history.canUndo;
  redoButton.disabled = !history.canRedo;
  errorLabel.textContent = '';
}
function showError(error) { errorLabel.textContent = `${error.code || 'ERROR'}: ${error.message}`; }
function commitEdit(edit) {
  try { scene = history.commit(edit); draw(); return true; }
  catch (error) { showError(error); return false; }
}
function replaceScene(next) {
  try {
    scene = history.replace(next);
    view = { panX: 0, panY: 0, zoom: 1 }; selected = null; selectedIds.clear();
    draw();
  } catch (error) { showError(error); }
}
window.addEventListener('pointermove', event => {
  if (!controlDrag) return;
  const drag = controlDrag;
  const x = drag.x + (event.clientX - drag.clientX) / view.zoom;
  const y = drag.y + (event.clientY - drag.clientY) / view.zoom;
  const edit = candidate => {
    const command = findNode(drag.pathId, candidate.nodes).node.commands[drag.commandIndex];
    command[drag.xField] = x; command[drag.yField] = y;
  };
  try { scene = history.preview(edit); drag.finalEdit = edit; draw(); }
  catch (error) { showError(error); }
});
window.addEventListener('pointerup', () => {
  if (controlDrag?.finalEdit) commitEdit(controlDrag.finalEdit);
  controlDrag = null;
});
window.addEventListener('pointercancel', () => {
  if (controlDrag?.finalEdit) { scene = history.restore(); draw(); }
  controlDrag = null;
});
function point(event) { const rect = canvas.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; }
canvas.addEventListener('pointerdown', event => {
  const p = point(event);
  const hit = renderer.hitTest(p);
  selectHit(hit, event.shiftKey, true);
  if (event.shiftKey) return;
  gesture = { x: p.x, y: p.y, hit, selectedIds: hit ? new Set(selectedIds) : null,
    snap: snapInput.checked, panX: view.panX, panY: view.panY };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', event => {
  if (!gesture) return;
  const p = point(event), dx = p.x - gesture.x, dy = p.y - gesture.y;
  if (gesture.selectedIds) {
    if (dx === 0 && dy === 0) return;
    const drag = gesture;
    const edit = candidate => translateSelected(candidate, drag.selectedIds,
      dx / view.zoom, dy / view.zoom, drag.snap);
    try { scene = history.preview(edit); drag.finalEdit = edit; draw(); }
    catch (error) { showError(error); }
  } else {
    view = { ...view, panX: gesture.panX + dx, panY: gesture.panY + dy };
    draw();
  }
});
canvas.addEventListener('pointerup', () => {
  if (gesture?.finalEdit) commitEdit(gesture.finalEdit);
  else if (gesture?.hit) selectHit(gesture.hit);
  gesture = null;
});
canvas.addEventListener('pointercancel', () => {
  if (gesture?.finalEdit) { scene = history.restore(); draw(); }
  gesture = null;
});
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
function undo() { scene = history.undo(); draw(); }
function redo() { scene = history.redo(); draw(); }
undoButton.addEventListener('click', undo);
redoButton.addEventListener('click', redo);
moveRightButton.addEventListener('click', () => {
  if (!selectedIds.size) return;
  const ids = new Set(selectedIds);
  commitEdit(candidate => translateSelected(candidate, ids, 10, 0, snapInput.checked));
});
function resizeSelected(field) {
  if (selectedIds.size !== 1 || !selected) return;
  const id = selected.id;
  commitEdit(candidate => { findNode(id, candidate.nodes).node[field] += 10; });
}
widthButton.addEventListener('click', () => resizeSelected('width'));
heightButton.addEventListener('click', () => resizeSelected('height'));
rotateButton.addEventListener('click', () => {
  if (selectedIds.size !== 1 || !selected) return;
  const id = selected.id;
  commitEdit(candidate => {
    const pose = findNode(id, candidate.nodes).node.transform;
    const next = pose.rotation + Math.PI / 12;
    pose.rotation = next > 2 * Math.PI ? next - 2 * Math.PI : next;
  });
});
function deleteSelection() {
  if (!selectedIds.size) return;
  const ids = new Set(selectedIds);
  if (commitEdit(candidate => { candidate.nodes = removeSelected(candidate.nodes, ids); })) {
    selectedIds.clear(); selected = null; draw();
  }
}
deleteButton.addEventListener('click', deleteSelection);
window.addEventListener('keydown', event => {
  if (event.target instanceof HTMLElement &&
      (event.target.matches('input,textarea,select') || event.target.isContentEditable)) return;
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && (event.key.toLowerCase() === 'z' || event.key.toLowerCase() === 'y')) {
    event.preventDefault();
    if (event.key.toLowerCase() === 'y' || event.shiftKey) redo(); else undo();
    return;
  }
  if (modifier || event.altKey || !selectedIds.size) return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault(); deleteSelection(); return;
  }
  const step = event.shiftKey || snapInput.checked ? 10 : 1;
  const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0],
    ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
  if (!delta) return;
  event.preventDefault();
  const ids = new Set(selectedIds);
  commitEdit(candidate => translateSelected(candidate, ids, delta[0], delta[1], snapInput.checked));
});
document.querySelector('#reset').addEventListener('click', () => replaceScene(initialSceneV4));
document.querySelector('#open-v3').addEventListener('click', () => replaceScene(initialSceneV3));
document.querySelector('#open-v2').addEventListener('click', () => replaceScene(initialSceneV2));
document.querySelector('#open-v1').addEventListener('click', () => replaceScene(initialScene));
document.querySelector('#open-v0').addEventListener('click', () => replaceScene(initialSceneV0));
document.querySelector('#save').addEventListener('click', () => {
  const blob = new Blob([stringifySceneJSON(history.scene)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'canvas2d-scene.json'; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
document.querySelector('#open').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  try { replaceScene(parseSceneJSON(await file.text())); }
  catch (error) { showError(error); }
  event.target.value = '';
});
window.__canvas2dDebug = {
  get scene() { return structuredClone(scene); }, get acceptedScene() { return history.scene; },
  get selectedIds() { return [...selectedIds]; }, get snap() { return snapInput.checked; },
  get history() { return { position: history.position, length: history.length,
    canUndo: history.canUndo, canRedo: history.canRedo }; },
  get view() { return { ...view }; },
  hit(point) { return renderer.hitTest(point); },
  pathObservation(id = 'PathRibbon') { return renderer.getPathObservation(id); },
  fillObservation(id = 'FilledBadge') { return renderer.getFillObservation(id); },
  capabilities() { return renderer.getCapabilities(); },
  getImageAsset(id) { return renderer.getImageAsset(id); },
  setImageAsset(id, value) { renderer.setImageAsset(id, value); renderer.render(); },
  removeImageAsset(id) { renderer.removeImageAsset(id); },
  resizeDpr(dpr) { renderer.resize({ width: 800, height: 480 }, dpr); renderer.render(); updateSelection(); updateHandles(); },
  setScene(next) { scene = history.replace(next); draw(); },
  select(id, toggle = false) {
    const node = id ? findNode(id)?.node : null;
    selectHit(node ? { id, kind: node.kind } : null, toggle);
  },
  setSnap(value) { snapInput.checked = !!value; },
  commit(edit) { scene = history.commit(edit); draw(); },
  undo() { scene = history.undo(); draw(); },
  redo() { scene = history.redo(); draw(); },
  setView(next) { renderer.setView(next); view = { ...next }; draw(); },
  pixel(x, y) { const gl = canvas.getContext('webgl2'); const p = new Uint8Array(4);
    gl.readPixels(x, canvas.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, p); return [...p]; },
  recreate() { renderer.dispose(); renderer = createCanvas2D(canvas,
    { logicalSize: { width: 800, height: 480 }, dpr: Math.min(4, Math.max(0.5, devicePixelRatio || 1)) });
    for (const [id, asset] of imageAssets) renderer.setImageAsset(id, asset);
    history.attachRenderer(renderer);
    draw(); },
};
draw();
