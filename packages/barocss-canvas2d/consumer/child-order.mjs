// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 120, height: 120 }, dpr: 2 };
const pose = (/** @type {number} */ x, /** @type {number} */ y) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
let tree = createDisplayTree('ChildOrderConsumer');
let team = tree.createContainer({ id: 'Team', layer: 0, transform: pose(0, 0) });
let red = tree.createRect({ id: 'Red', layer: 0, transform: pose(20, 20),
  width: 80, height: 80, fill: [1, 0, 0, 1] });
let blue = tree.createRect({ id: 'Blue', layer: 0, transform: pose(20, 20),
  width: 80, height: 80, fill: [0, 0, 1, 1] });
let green = tree.createRect({ id: 'Green', layer: 1, transform: pose(60, 60),
  width: 30, height: 30, fill: [0, 1, 0, 1] });
tree.stage.addChild(team); team.addChild(red); team.addChild(blue); team.addChild(green);
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
const samples = [[40, 40], [70, 70]];

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
  return { generation, order: team.children.map(child => child.id),
    scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y),
      hit: renderer.hitTest({ x, y })?.id ?? null })), pointerLog: [...pointerLog] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  red.onPointer('pointerdown', () => pointerLog.push('Red'));
  blue.onPointer('pointerdown', () => pointerLog.push('Blue'));
  team.onPointer('pointerdown', () => pointerLog.push('Team'));
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
/** @param {import('@barocss/canvas2d').DisplayHandle} child */
function moveLast(child) { team.setChildIndex(child, team.children.length - 1); submit(`Moved ${child.id} to end`); }
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { team.setChildIndex(red, team.children.length); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected index ${code}; retained ${JSON.stringify(observe()) === before}`);
  return code;
}
async function save() {
  const text = await serializeCanvasDocument(accepted, () => null);
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'child-order-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextTeam;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextRed;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextBlue;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextGreen;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const group = nextTree.get('Team'), r = nextTree.get('Red'), b = nextTree.get('Blue'), g = nextTree.get('Green');
    if (group?.kind !== 'container' || r?.kind !== 'rect' || b?.kind !== 'rect' || g?.kind !== 'rect' ||
        group.children.length !== 3 || !group.children.includes(r) || !group.children.includes(b) ||
        !group.children.includes(g)) throw new Error('Document does not contain the consumer objects');
    nextTeam = group; nextRed = r; nextBlue = b; nextGreen = g;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; team = nextTeam; red = nextRed; blue = nextBlue; green = nextGreen;
  accepted = /** @type {import('@barocss/canvas2d').Scene} */ (staged.scene);
  generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened editable child order');
}
subscribe(); unbind = bind();
document.querySelector('#red-last')?.addEventListener('click', () => moveLast(red));
document.querySelector('#blue-last')?.addEventListener('click', () => moveLast(blue));
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Open failed: ${error.code ?? 'ERROR'}`));
  openInput.value = '';
});
Object.assign(window, { __childOrderConsumer: { observe, moveLast, invalid, save, openText,
  get canvas() { return canvas; } } });
show('Ready with Blue over Red');
