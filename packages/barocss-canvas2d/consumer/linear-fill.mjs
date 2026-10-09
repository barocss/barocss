// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const options = { logicalSize: { width: 140, height: 90 }, dpr: 2 };
const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
/** @type {import('@barocss/canvas2d').PathCommand[]} */
const commands = [
  { kind: 'M', x: 10, y: 10 }, { kind: 'L', x: 110, y: 10 },
  { kind: 'L', x: 110, y: 50 }, { kind: 'L', x: 10, y: 50 }, { kind: 'Z' },
  { kind: 'M', x: 45, y: 25 }, { kind: 'L', x: 55, y: 25 },
  { kind: 'L', x: 55, y: 35 }, { kind: 'L', x: 45, y: 35 }, { kind: 'Z' },
];
/** @param {boolean} edited */
const paint = edited => ({ commands, fill: {
  rule: /** @type {const} */ ('evenodd'), linear: {
    from: { x: 10, y: 10 }, to: { x: edited ? 70 : 90, y: 10 },
    startColor: /** @type {import('@barocss/canvas2d').Color} */ (edited ? [0, 1, 0, 1] : [1, 0, 0, 1]),
    endColor: /** @type {import('@barocss/canvas2d').Color} */ ([0, 0, 1, 0]),
  } } });
let tree = createDisplayTree('LinearConsumer');
const resourceParent = tree.createContainer({ id: 'ResourceParent', layer: -2,
  transform: { x: -1e6, y: -1e6, scaleX: 100, scaleY: 100, rotation: 0 } });
resourceParent.addChild(tree.createPath({ id: 'Resource', layer: 0,
  transform: { x: -1e6, y: -1e6, scaleX: 1, scaleY: 1, rotation: 0 },
  commands, fill: { rule: 'evenodd', linear: { from: { x: 10, y: 10 }, to: { x: 90, y: 10 },
    startColor: [1, 0, 0, 1], endColor: [0, 0, 1, 0] } } }));
tree.stage.addChild(resourceParent);
tree.stage.addChild(tree.createRect({ id: 'Back', layer: -1, transform: pose,
  width: 140, height: 90, fill: [0.25, 0.25, 0.25, 1] }));
const frame = tree.createFrame({ id: 'Clip', layer: 0,
  transform: { ...pose, x: 10, y: 10 }, width: 100, height: 60,
  fill: [0, 0, 0, 0], clip: true });
let path = tree.createPath({ id: 'Gradient', layer: 0, transform: pose, ...paint(false) });
frame.addChild(path); tree.stage.addChild(frame);
/** @type {HTMLCanvasElement} */ let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').Scene} */ let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let pointerLog = [];
/** @type {() => void} */ let unbind = () => {};
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * 2, canvas.height - y * 2 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  /** @param {number} x @param {number} y */
  const sample = (x, y) => ({ pixel: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null });
  return { generation, version: accepted.version, start: sample(25, 25),
    middle: sample(60, 25), transparent: sample(105, 25), hole: sample(60, 40),
    clipped: sample(115, 25), pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  path.onPointer('pointerdown', event => pointerLog.push(`Gradient:${event.target?.id}`));
  tree.get('Back')?.onPointer('pointerdown', event => pointerLog.push(`Back:${event.target?.id}`));
  tree.stage.onPointer('pointerdown', event => pointerLog.push(`stage:${event.target?.id}`));
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const onPointer = event => {
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * options.logicalSize.width / bounds.width,
      y: (event.clientY - bounds.top) * options.logicalSize.height / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
      point, hit: renderer.hitTest(point) }); show();
  };
  current.addEventListener('pointerdown', onPointer);
  return () => current.removeEventListener('pointerdown', onPointer);
}
function edit() {
  path.setPath(paint(true)); accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show();
}
/** @param {number} alpha */
function parentAlpha(alpha) {
  const parent = tree.get('Clip');
  if (parent?.kind !== 'frame') throw new Error('Clip frame missing');
  parent.setAlpha(alpha); accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show();
}
function mirrored() {
  const previous = path.data.transform;
  path.setTransform({ x: 120, y: 0, scaleX: -1, scaleY: 1, rotation: 0 });
  renderer.updateScene(tree.snapshot()); renderer.render();
  const sample = { left: { pixel: pixel(45, 25), hit: renderer.hitTest({ x: 45, y: 25 })?.id ?? null },
    right: { pixel: pixel(105, 25), hit: renderer.hitTest({ x: 105, y: 25 })?.id ?? null } };
  path.setTransform(previous); renderer.updateScene(tree.snapshot()); renderer.render();
  return sample;
}
function invalid() {
  const before = JSON.stringify(observe()); let code = 'ACCEPTED';
  try { path.setPath({ commands, fill: { ...paint(false).fill, linear: {
    ...paint(false).fill.linear, to: { x: 10, y: 10 } } } }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  return { code, retained: JSON.stringify(observe()) === before };
}
function rejectedView() {
  const before = JSON.stringify(observe()); let code = 'ACCEPTED';
  try { renderer.setView({ panX: 1e6, panY: 1e6, zoom: 64 }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  renderer.render(); return { code, retained: JSON.stringify(observe()) === before };
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'linear-fill-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 280; fresh.height = 180;
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextPath;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const found = nextTree.get('Gradient');
    if (found?.kind !== 'path') throw new Error('Gradient path missing');
    nextPath = found;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer; canvas.replaceWith(fresh);
  canvas = fresh; renderer = staged.renderer; tree = nextTree; path = nextPath;
  accepted = staged.scene; generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind(); show();
document.querySelector('#edit')?.addEventListener('click', edit);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => { const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText); openInput.value = ''; });
Object.assign(window, { __linearFillConsumer: { observe, edit, parentAlpha, mirrored,
  invalid, rejectedView, save, openText } });
