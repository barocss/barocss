// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const options = { logicalSize: { width: 120, height: 80 }, dpr: 2 };
const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const blue = /** @type {import('@barocss/canvas2d').Color} */ ([0, 0, 1, 1]);
/** @type {import('@barocss/canvas2d').PathCommand[]} */
const commands = [{ kind: 'M', x: 10, y: 40 }, { kind: 'L', x: 50, y: 40 }, { kind: 'L', x: 50, y: 70 }];
/** @param {number} miterLimit */
const paint = miterLimit => ({ commands, stroke: { color: blue, width: 8,
  cap: /** @type {const} */ ('butt'), join: /** @type {const} */ ('miter'),
  dash: { lengths: [], offset: 0 }, miterLimit } });
let tree = createDisplayTree('MiterConsumer');
tree.stage.addChild(tree.createRect({ id: 'Back', layer: -1, transform: pose,
  width: 120, height: 80, fill: [0.25, 0.25, 0.25, 1] }));
let miter = tree.createPath({ id: 'Miter', layer: 0, transform: pose, ...paint(4) });
/** @param {number} miterLimit */
const transformedPaint = miterLimit => ({
  commands: /** @type {import('@barocss/canvas2d').PathCommand[]} */ ([
    { kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 20, y: 0 }, { kind: 'L', x: 20, y: 12 }]),
  stroke: { color: blue, width: 6, cap: /** @type {const} */ ('round'),
    join: /** @type {const} */ ('miter'), dash: { lengths: [25, 10], offset: 0 }, miterLimit } });
let turned = tree.createPath({ id: 'Turned', layer: 1,
  transform: { x: 86, y: 12, scaleX: 1.25, scaleY: 0.75, rotation: Math.PI / 4 },
  ...transformedPaint(4) });
tree.stage.addChild(miter); tree.stage.addChild(turned);
tree.stage.addChild(tree.createPath({ id: 'Resource', layer: -2,
  transform: { x: -300, y: -300, scaleX: 1, scaleY: 1, rotation: 0 },
  commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 20, y: 0 }],
  stroke: { color: blue, width: 100, cap: 'round', join: 'bevel',
    dash: { lengths: [], offset: 0 }, miterLimit: 4 } }));
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
  return { generation, sceneVersion: accepted.version, join: miter.data.stroke?.join,
    miterLimit: miter.data.stroke?.miterLimit, tip: sample(53, 37), core: sample(45, 40), transformedTip: sample(107, 31),
    turnedBounds: turned.getWorldBounds(), pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  miter.onPointer('pointerdown', event => pointerLog.push(`Miter:${event.target?.id}`));
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
/** @param {number} limit */
function edit(limit) {
  miter.setPath(paint(limit)); turned.setPath(transformedPaint(limit));
  accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show();
}
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { miter.setPath(paint(17)); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  return { code, retained: JSON.stringify(observe()) === before };
}
function rejectedView() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { renderer.setView({ panX: 0, panY: 0, zoom: 64 }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  renderer.render();
  return { code, retained: JSON.stringify(observe()) === before };
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'miter-join-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 240; fresh.height = 160;
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextMiter;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextTurned;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const m = nextTree.get('Miter'), t = nextTree.get('Turned');
    if (m?.kind !== 'path' || t?.kind !== 'path') throw new Error('Paths missing');
    nextMiter = m; nextTurned = t;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer; canvas.replaceWith(fresh);
  canvas = fresh; renderer = staged.renderer; tree = nextTree;
  miter = nextMiter; turned = nextTurned;
  accepted = staged.scene; generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind(); show();
document.querySelector('#fallback')?.addEventListener('click', () => edit(1));
document.querySelector('#miter')?.addEventListener('click', () => edit(4));
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => { const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText); openInput.value = ''; });
Object.assign(window, { __miterJoinConsumer: { observe, edit, invalid, rejectedView, save, openText } });
