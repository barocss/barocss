// @ts-check
import { Canvas2DError, createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 320, height: 200 }, dpr: 2 };
/** @type {import('@barocss/canvas2d').ImageAssetInput} */
const asset = { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255,
]) };
const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
let tree = createDisplayTree('DisplayConsumer');
let team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(40, 50) });
let red = tree.createSprite({ id: 'Red', layer: 0, transform: pose(), imageId: 'RGBA2',
  width: 40, height: 40, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
let blue = tree.createSprite({ id: 'Blue', layer: 1, transform: pose(20, 0), imageId: 'RGBA2',
  width: 40, height: 40, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(team); team.addChild(red); team.addChild(blue);

/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('RGBA2', asset);
/** @type {import('@barocss/canvas2d').SceneV6} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string | null} */
let oldDisposeCode = null;
let stopped = false;
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const points = [[50, 60], [70, 80], [90, 80], [50, 40], [110, 80]];

/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 context missing');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * options.dpr, canvas.height - y * options.dpr - 1,
    1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  return { generation, editable: !stopped, canvasSize: [canvas.width, canvas.height],
    scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
    stageIds: tree.stage.children.map(child => child.id),
    childIds: team.children.map(child => child.id),
    handleKinds: { Team: tree.get('Team')?.kind ?? null, Red: tree.get('Red')?.kind ?? null,
      Blue: tree.get('Blue')?.kind ?? null },
    assetBytes: [...(renderer.getImageAsset('RGBA2')?.pixels ?? [])], oldDisposeCode,
    samples: points.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null })) };
}
/** @param {string} message */
function show(message) {
  status.textContent = message;
  if (!stopped) output.textContent = JSON.stringify(observe(), null, 2);
}
/** @param {string} label */
function submit(label) {
  accepted = tree.snapshot();
  renderer.updateScene(accepted); renderer.render();
  show(label);
}
function requireAuthoring() { if (stopped) throw new Canvas2DError('DISPOSED', 'renderer is disposed'); }
function move() { requireAuthoring(); team.setTransform(pose(60, 50)); submit('Moved Team to x=60'); }
function anchor() { requireAuthoring(); red.setAnchor(0.5, 0.5); submit('Centered Red anchor'); }
function resetAnchor() { requireAuthoring(); red.setAnchor(0, 0); submit('Reset Red anchor'); }
function layer() { requireAuthoring(); red.setLayer(2); submit('Raised Red to layer 2'); }
function equal() { requireAuthoring(); red.setLayer(1); submit('Equal layers; Blue remains later'); }
function reorder() { requireAuthoring(); team.removeChild(red); team.addChild(red); submit('Re-added Red last'); }
function invalid() {
  requireAuthoring();
  const before = JSON.stringify(observe());
  /** @type {string[]} */
  const codes = [];
  for (const edit of [
    () => red.setAnchor(-0, 0),
    () => {
      const detached = tree.createContainer({ id: 'Detached', layer: 0, transform: pose() });
      detached.addChild(detached);
    },
    () => team.addChild(tree.createSprite({ ...red.data, id: 'Blue' })),
    () => team.addChild(createDisplayTree('Foreign').createSprite({ ...red.data, id: 'Foreign' })),
  ]) {
    try { edit(); codes.push('ACCEPTED'); }
    catch (error) { codes.push(/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code); }
  }
  const same = JSON.stringify(observe()) === before;
  show(`Rejected edits ${codes.join(',')} · retained ${same}`);
}
async function save() {
  if (stopped) return;
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'display-tree-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  if (stopped) return;
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  if (staged.scene.version !== 6) {
    staged.renderer.dispose();
    throw new Canvas2DError('UNSUPPORTED_FEATURE', 'this display-tree consumer opens Scene v6 only');
  }
  /** @type {import('@barocss/canvas2d').DisplayTree} */
  let restored;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */
  let restoredTeam;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */
  let restoredRed;
  /** @type {import('@barocss/canvas2d').SpriteHandle} */
  let restoredBlue;
  try {
    restored = createDisplayTreeFromScene(staged.scene);
    const teamHandle = restored.get('Team');
    const redHandle = restored.get('Red');
    const blueHandle = restored.get('Blue');
    if (teamHandle?.kind !== 'container' || redHandle?.kind !== 'sprite' ||
        blueHandle?.kind !== 'sprite') {
      throw new Canvas2DError('UNSUPPORTED_FEATURE', 'consumer requires Team, Red and Blue handles');
    }
    if (restored.stage.children.length !== 1 || restored.stage.children[0] !== teamHandle ||
        teamHandle.children.length !== 2 || !teamHandle.children.includes(redHandle) ||
        !teamHandle.children.includes(blueHandle)) {
      throw new Canvas2DError('UNSUPPORTED_FEATURE', 'consumer requires Team with Red and Blue children');
    }
    restoredTeam = teamHandle; restoredRed = redHandle; restoredBlue = blueHandle;
  } catch (error) { staged.renderer.dispose(); throw error; }
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = restored; team = restoredTeam; red = restoredRed; blue = restoredBlue;
  accepted = staged.scene;
  generation++;
  old.dispose();
  try { old.render(); }
  catch (error) { oldDisposeCode = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Opened editable v${accepted.version} tree with ${staged.assets.size} asset`);
}
function dispose() {
  if (stopped) return;
  const before = observe();
  renderer.dispose(); stopped = true;
  let code = null;
  try { renderer.render(); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  output.textContent = JSON.stringify({ ...before, finalDisposeCode: code }, null, 2);
  status.textContent = `Disposed: ${code}`;
  for (const control of Array.from(document.querySelectorAll('button, input'))) {
    /** @type {HTMLButtonElement | HTMLInputElement} */ (control).disabled = true;
  }
}

/** @type {Record<string, () => void>} */
const actions = { move, anchor, 'reset-anchor': resetAnchor, layer, equal, reorder, invalid, dispose };
for (const [id, action] of Object.entries(actions)) {
  document.querySelector(`#${id}`)?.addEventListener('click', action);
}
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
document.querySelector('#open')?.addEventListener('change', () => {
  const file = openInput.files?.[0];
  if (!file) return;
  void file.text().then(openText).catch(error => {
    show(`Rejected Open: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`);
  });
  openInput.value = '';
});
Object.assign(window, { __displayTreeConsumer: { observe, move, anchor, resetAnchor,
  layer, equal, reorder, invalid, save, openText, dispose, get tree() { return tree; } } });
show('Ready: public display tree and compiled package entries');
