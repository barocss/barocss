// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  createPathBuilder } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 120, height: 90 }, dpr: 2 };
const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
/** @type {import('@barocss/canvas2d').PathFillV5} */
const red = { color: [1, 0, 0, 1], rule: 'evenodd' };
const commands = (/** @type {number} */ radius) =>
  createPathBuilder().roundRect(20, 15, 80, 60, radius).build();
let tree = createDisplayTree('RoundRectConsumer');
tree.stage.addChild(tree.createRect({ id: 'Back', layer: 0, transform: pose,
  width: 120, height: 90, fill: [0.25, 0.25, 0.25, 1] }));
let shape = tree.createPath({ id: 'Shape', layer: 1, transform: pose,
  commands: commands(20), fill: red });
tree.stage.addChild(shape);
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
  const sample = (/** @type {number} */ x, /** @type {number} */ y) =>
    ({ rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null });
  return { generation, sceneVersion: accepted.version, commands: shape.data.commands,
    center: sample(60, 45), corner: sample(25, 20), outside: sample(21, 16),
    pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  shape.onPointer('pointerdown', () => pointerLog.push(`g${generation}:Shape`));
  tree.stage.onPointer('pointerdown', () => pointerLog.push(`g${generation}:stage`));
}
function bind() {
  const currentCanvas = canvas;
  /** @param {PointerEvent} event */
  const onPointer = (event) => {
    const rect = currentCanvas.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) * options.logicalSize.width / rect.width,
      y: (event.clientY - rect.top) * options.logicalSize.height / rect.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit: renderer.hitTest(point) });
    show('Pointer');
  };
  currentCanvas.addEventListener('pointerdown', onPointer);
  return () => currentCanvas.removeEventListener('pointerdown', onPointer);
}
/** @param {number} radius */
function setRadius(radius) {
  shape.setPath({ commands: commands(radius), fill: red });
  const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render();
  show(`Radius ${radius}`);
}
async function save() {
  const data = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'round-rect-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(data).length} bytes`);
}
/** @param {string} data */
async function openText(data) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(data, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextShape;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const found = nextTree.get('Shape');
    if (found?.kind !== 'path') throw new Error('Shape missing from document');
    nextShape = found;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const oldRenderer = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; shape = nextShape; accepted = staged.scene;
  generation++; pointerLog = []; subscribe(); unbind = bind(); oldRenderer.dispose();
  show('Opened fresh canvas and tree');
}
subscribe(); unbind = bind();
document.querySelector('#shrink')?.addEventListener('click', () => setRadius(5));
document.querySelector('#expand')?.addEventListener('click', () => setRadius(20));
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => {
    show(`Open failed: ${/** @type {Error} */ (error).message}`);
  });
  openInput.value = '';
});
Object.assign(window, { __roundRectConsumer: { observe, setRadius, save, openText } });
show('Ready');
