// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  createPathBuilder } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 120, height: 90 }, dpr: 2 };
const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
/** @type {import('@barocss/canvas2d').PathStroke} */
const blue = { color: [0, 0, 1, 1], width: 6 };
/** @type {import('@barocss/canvas2d').PathFillV5} */
const red = { color: [1, 0, 0, 1], rule: 'evenodd' };
/** @param {number} sweep */
const arcCommands = sweep => createPathBuilder().arc(30, 45, 20, -Math.PI / 2, sweep).build();
const sectorCommands = () => createPathBuilder().arc(80, 45, 20, 0, Math.PI / 2)
  .lineTo(80, 45).closePath().build();
let tree = createDisplayTree('ArcConsumer');
tree.stage.addChild(tree.createRect({ id: 'Back', layer: -1, transform: pose,
  width: 120, height: 90, fill: [0.25, 0.25, 0.25, 1] }));
let arc = tree.createPath({ id: 'Arc', layer: 0, transform: pose,
  commands: arcCommands(Math.PI / 2), stroke: blue });
let sector = tree.createPath({ id: 'Sector', layer: 1, transform: pose,
  commands: sectorCommands(), fill: red });
tree.stage.addChild(arc); tree.stage.addChild(sector);
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
  return { generation, sceneVersion: accepted.version, arcCommands: arc.data.commands.length,
    quarter: sample(44, 31), outsideArc: sample(16, 31), sector: sample(90, 52),
    outsideSector: sample(70, 52), pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  arc.onPointer('pointerdown', event => pointerLog.push(`Arc:${event.target?.id}`));
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
      point, hit: renderer.hitTest(point) });
    show();
  };
  current.addEventListener('pointerdown', onPointer);
  return () => current.removeEventListener('pointerdown', onPointer);
}
function reverse() {
  arc.setPath({ commands: arcCommands(-Math.PI / 2), stroke: blue });
  accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show();
}
function invalid() {
  const before = JSON.stringify(arc.data.commands);
  let code = 'ACCEPTED';
  try { arc.setPath({ commands: [{ kind: 'M', x: 0, y: 0 }], stroke: blue }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  return { code, retained: JSON.stringify(arc.data.commands) === before };
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'arc-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 240; fresh.height = 180;
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextArc;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextSector;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const a = nextTree.get('Arc'), s = nextTree.get('Sector');
    if (a?.kind !== 'path' || s?.kind !== 'path') throw new Error('Paths missing');
    nextArc = a; nextSector = s;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer; canvas.replaceWith(fresh);
  canvas = fresh; renderer = staged.renderer; tree = nextTree; arc = nextArc; sector = nextSector;
  accepted = staged.scene; generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind(); show();
document.querySelector('#reverse')?.addEventListener('click', reverse);
document.querySelector('#invalid')?.addEventListener('click', () => { invalid(); show(); });
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => { const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText); openInput.value = ''; });
Object.assign(window, { __arcConsumer: { observe, reverse, invalid, save, openText } });
