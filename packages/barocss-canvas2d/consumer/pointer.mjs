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
let tree = createDisplayTree('PointerConsumer');
let team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(40, 50) });
let red = tree.createSprite({ id: 'Red', layer: 0, transform: pose(), imageId: 'RGBA2',
  width: 40, height: 40, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
let blue = tree.createSprite({ id: 'Blue', layer: 1, transform: pose(-20, 0), imageId: 'RGBA2',
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
/** @type {import('@barocss/canvas2d').DisplayTree | null} */
let oldTree = null;
/** @type {string[]} */
let log = [];
let stopBlue = false;
/** @type {() => void} */
let offBlueSecond = () => {};
/** @type {() => void} */
let unbindCanvas = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[30, 60], [50, 60], [70, 60], [50, 80]];

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
  return { generation, scene: stringifySceneJSON(accepted),
    treeScene: stringifySceneJSON(tree.snapshot()),
    teamX: team.data.transform.x, childIds: team.children.map(child => child.id),
    canvasSize: [canvas.width, canvas.height], assetBytes: [...(renderer.getImageAsset('RGBA2')?.pixels ?? [])],
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null })),
    log: [...log] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
/** @param {import('@barocss/canvas2d').DisplayPointerEvent} event @param {number} subscribedGeneration */
function entry(event, subscribedGeneration) {
  const current = 'id' in event.currentTarget ? event.currentTarget.id : 'stage';
  return `g${subscribedGeneration}:${event.type}:${event.target?.id ?? 'null'}:${current}:${event.pointerId}`;
}
function subscribeTree() {
  const subscribedGeneration = generation;
  blue.onPointer('pointerdown', event => {
    log.push(`${entry(event, subscribedGeneration)}:first`);
    if (stopBlue) event.stopPropagation();
  });
  offBlueSecond = blue.onPointer('pointerdown', event => log.push(`${entry(event, subscribedGeneration)}:second`));
  red.onPointer('pointerdown', event => log.push(entry(event, subscribedGeneration)));
  team.onPointer('pointerdown', event => log.push(entry(event, subscribedGeneration)));
  tree.stage.onPointer('pointerdown', event => log.push(entry(event, subscribedGeneration)));
  for (const type of /** @type {const} */ (['pointerup', 'pointermove', 'pointercancel'])) {
    tree.stage.onPointer(type, event => log.push(entry(event, subscribedGeneration)));
  }
}
function bindCanvas() {
  const targetCanvas = canvas;
  const handlers = /** @type {Record<string, (event: PointerEvent) => void>} */ ({});
  const types = /** @type {const} */ (['pointerdown', 'pointerup', 'pointermove', 'pointercancel']);
  for (const type of types) {
    handlers[type] = event => {
      const rect = targetCanvas.getBoundingClientRect();
      const point = { x: (event.clientX - rect.left) * options.logicalSize.width / rect.width,
        y: (event.clientY - rect.top) * options.logicalSize.height / rect.height };
      try {
        tree.dispatchPointer({ type: /** @type {import('@barocss/canvas2d').PointerEventType} */ (type),
          pointerId: event.pointerId, point, hit: renderer.hitTest(point) });
        if (log.length > 64) log = log.slice(-64);
        show(`Dispatched ${type}`);
      } catch (error) {
        show(`Rejected pointer: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`);
      }
    };
    targetCanvas.addEventListener(type, handlers[type]);
  }
  return () => {
    for (const type of types) targetCanvas.removeEventListener(type, handlers[type]);
  };
}
/** @param {string} message */
function submit(message) { accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show(message); }
function move() { team.setTransform(pose(60, 50)); submit('Moved Team to x=60'); }
function reorder() { red.setLayer(1); team.removeChild(red); team.addChild(red); submit('Red is above Blue'); }
function stop() { stopBlue = !stopBlue; show(`Blue stops propagation: ${stopBlue}`); }
function unsubscribe() { offBlueSecond(); offBlueSecond(); show('Unsubscribed Blue second listener'); }
function clear() { log = []; show('Cleared event log'); }
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'pointer-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
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
        blueHandle?.kind !== 'sprite' || restored.stage.children.length !== 1 ||
        restored.stage.children[0] !== teamHandle || teamHandle.children.length !== 2 ||
        !teamHandle.children.includes(redHandle) || !teamHandle.children.includes(blueHandle)) {
      throw new Canvas2DError('UNSUPPORTED_FEATURE', 'consumer requires Team with Red and Blue sprites');
    }
    restoredTeam = teamHandle; restoredRed = redHandle; restoredBlue = blueHandle;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbindCanvas();
  oldTree = tree;
  const oldRenderer = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = restored; team = restoredTeam; red = restoredRed; blue = restoredBlue;
  accepted = /** @type {import('@barocss/canvas2d').SceneV6} */ (staged.scene);
  generation++;
  stopBlue = false;
  subscribeTree();
  unbindCanvas = bindCanvas();
  oldRenderer.dispose();
  show(`Opened editable v6 pointer tree with ${staged.assets.size} asset`);
}

subscribeTree();
unbindCanvas = bindCanvas();
const actions = { move, reorder, stop, unsubscribe, clear };
for (const [id, action] of Object.entries(actions)) document.querySelector(`#${id}`)?.addEventListener('click', action);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0];
  if (!file) return;
  void file.text().then(openText).catch(error => {
    show(`Rejected Open: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`);
  });
  openInput.value = '';
});
Object.assign(window, { __pointerConsumer: { observe, move, reorder, stop, unsubscribe, clear,
  save, openText, get tree() { return tree; }, get oldTree() { return oldTree; },
  get canvas() { return canvas; }, get renderer() { return renderer; } } });
show('Ready: public pointer delivery and compiled package entries');
