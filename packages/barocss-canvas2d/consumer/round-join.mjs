// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, createPathBuilder } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 100 }, dpr: 2 };
const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const blue = /** @type {import('@barocss/canvas2d').Color} */ ([0, 0, 1, 1]);
/** @param {number} y */
const commands = y => createPathBuilder().polyline([{ x: 30, y }, { x: 40, y }, { x: 40, y: y + 20 }]).build();
let tree = createDisplayTree('JoinConsumer');
tree.stage.addChild(tree.createRect({ id: 'Back', layer: -1, transform: pose,
  width: 100, height: 100, fill: [0.25, 0.25, 0.25, 1] }));
let bevel = tree.createPath({ id: 'Bevel', layer: 0, transform: pose,
  commands: commands(20), stroke: { color: blue, width: 10, cap: 'butt' } });
let round = tree.createPath({ id: 'Round', layer: 1, transform: pose,
  commands: commands(55), stroke: { color: blue, width: 10, join: 'round' } });
let turned = tree.createPath({ id: 'Turned', layer: 2,
  transform: { x: 70, y: 20, scaleX: 1.5, scaleY: 0.75, rotation: Math.PI / 4 },
  commands: createPathBuilder().polyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }]).build(),
  stroke: { color: blue, width: 10, cap: 'round', join: 'round' } });
tree.stage.addChild(bevel); tree.stage.addChild(round); tree.stage.addChild(turned);
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
  return { generation, sceneVersion: accepted.version,
    joins: [bevel.data.stroke?.join, round.data.stroke?.join, turned.data.stroke?.join],
    bevelExterior: sample(43, 17), roundExterior: sample(43, 52),
    bevelCenter: sample(40, 20), roundCenter: sample(40, 55),
    bevelEmpty: sample(45, 15), roundEmpty: sample(45, 50),
    turnedBounds: turned.getWorldBounds(), turnedLocalBounds: turned.getLocalBounds(),
    pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  round.onPointer('pointerdown', event => pointerLog.push(`Round:${event.target?.id}`));
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
  round.setPath({ commands: commands(55), stroke: { color: blue, width: 10, cap: 'butt', join: 'bevel' } });
  accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show();
}
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { round.setPath({ commands: commands(55), stroke: { color: blue, width: 10,
    cap: 'butt', join: /** @type {import('@barocss/canvas2d').PathJoin} */ ('invalid') } }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  return { code, retained: JSON.stringify(observe()) === before };
}
function invalidView() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { renderer.setView({ panX: 0, panY: 0, zoom: 65 }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  renderer.render();
  return { code, retained: JSON.stringify(observe()) === before };
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'round-join-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 200; fresh.height = 200;
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextBevel;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextRound;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextTurned;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const b = nextTree.get('Bevel'), r = nextTree.get('Round'), t = nextTree.get('Turned');
    if (b?.kind !== 'path' || r?.kind !== 'path' || t?.kind !== 'path') throw new Error('Paths missing');
    nextBevel = b; nextRound = r; nextTurned = t;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer; canvas.replaceWith(fresh);
  canvas = fresh; renderer = staged.renderer; tree = nextTree;
  bevel = nextBevel; round = nextRound; turned = nextTurned;
  accepted = staged.scene; generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind(); show();
document.querySelector('#edit')?.addEventListener('click', edit);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => { const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText); openInput.value = ''; });
Object.assign(window, { __roundJoinConsumer: { observe, edit, invalid, invalidView, save, openText } });
