// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 140, height: 80 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
let tree = createDisplayTree('ReparentConsumer');
let a = tree.createContainer({ id: 'A', layer: 0, transform: pose(0, 0) });
let b = tree.createContainer({ id: 'B', layer: 0, transform: pose(70, 0) });
let red = tree.createRect({ id: 'Red', layer: 0, transform: pose(10, 10),
  width: 40, height: 40, fill: [1, 0, 0, 1] });
let yellow = tree.createRect({ id: 'Yellow', layer: 0, transform: pose(0, 0),
  width: 60, height: 60, fill: [1, 1, 0, 1] });
tree.stage.addChild(a); tree.stage.addChild(b); a.addChild(red); b.addChild(yellow);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').Scene} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[20, 20], [90, 20]];

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
  return { generation, a: a.children.map(child => child.id), b: b.children.map(child => child.id),
    redLocal: red.data.transform, scene: stringifySceneJSON(accepted),
    treeScene: stringifySceneJSON(tree.snapshot()),
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  red.onPointer('pointerdown', () => pointerLog.push('Red'));
  a.onPointer('pointerdown', () => pointerLog.push('A'));
  b.onPointer('pointerdown', () => pointerLog.push('B'));
  tree.stage.onPointer('pointerdown', () => pointerLog.push('stage'));
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const onPointer = event => {
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * options.logicalSize.width / bounds.width,
      y: (event.clientY - bounds.top) * options.logicalSize.height / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point, hit: renderer.hitTest(point) });
    show('Dispatched pointerdown');
  };
  current.addEventListener('pointerdown', onPointer);
  return () => current.removeEventListener('pointerdown', onPointer);
}
/** @param {string} message */
function submit(message) {
  const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message);
}
/** @param {import('@barocss/canvas2d').ContainerHandle} target */
function move(target) {
  tree.reparentChild(red, target, target.children.length);
  submit(`Moved Red to ${target.id}`);
}
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { tree.reparentChild(red, a.children.includes(red) ? b : a, 99); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected move ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
async function save() {
  const text = await serializeCanvasDocument(accepted, () => null);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'reparent-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextA;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextB;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextRed;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextYellow;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const groupA = nextTree.get('A'), groupB = nextTree.get('B');
    const r = nextTree.get('Red'), y = nextTree.get('Yellow');
    if (groupA?.kind !== 'container' || groupB?.kind !== 'container' ||
        r?.kind !== 'rect' || y?.kind !== 'rect' ||
        !groupB.children.includes(y) ||
        !(groupA.children.includes(r) || groupB.children.includes(r))) {
      throw new Error('Document does not contain the consumer objects');
    }
    nextA = groupA; nextB = groupB; nextRed = r; nextYellow = y;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; a = nextA; b = nextB; red = nextRed; yellow = nextYellow;
  accepted = /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene);
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened editable parents');
}
subscribe(); unbind = bind();
document.querySelector('#to-b')?.addEventListener('click', () => move(b));
document.querySelector('#to-a')?.addEventListener('click', () => move(a));
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __reparentConsumer: { observe, move, invalid, save, openText,
  get canvas() { return canvas; } } });
show('Ready with Red under A');
