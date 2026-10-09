// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  createPathBuilder } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 100, height: 80 }, dpr: 2 };
const pose = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const blue = /** @type {import('@barocss/canvas2d').Color} */ ([0, 0, 1, 1]);
/** @param {number} y */
const commands = y => createPathBuilder().polyline([{ x: 20, y }, { x: 50, y }]).build();
let tree = createDisplayTree('CapConsumer');
tree.stage.addChild(tree.createRect({ id: 'Back', layer: -1, transform: pose,
  width: 100, height: 80, fill: [0.25, 0.25, 0.25, 1] }));
let butt = tree.createPath({ id: 'Butt', layer: 0, transform: pose,
  commands: commands(20), stroke: { color: blue, width: 10 } });
let square = tree.createPath({ id: 'Square', layer: 1, transform: pose,
  commands: commands(40), stroke: { color: blue, width: 10, cap: 'square' } });
let round = tree.createPath({ id: 'Round', layer: 2, transform: pose,
  commands: commands(60), stroke: { color: blue, width: 10, cap: 'round' } });
let rotated = tree.createPath({ id: 'Rotated', layer: 3,
  transform: { x: 75, y: 20, scaleX: 1.5, scaleY: 0.75, rotation: Math.PI / 2 },
  commands: createPathBuilder().polyline([{ x: 0, y: 0 }, { x: 20, y: 0 }]).build(),
  stroke: { color: blue, width: 10, cap: 'round' } });
tree.stage.addChild(butt); tree.stage.addChild(square); tree.stage.addChild(round); tree.stage.addChild(rotated);
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
    caps: [butt.data.stroke?.cap, square.data.stroke?.cap, round.data.stroke?.cap],
    buttEnd: sample(16, 20), squareEnd: sample(16, 40), roundEnd: sample(16, 60),
    squareCorner: sample(16, 36), roundCorner: sample(16, 56),
    rotatedStart: sample(75, 14), rotatedOutside: sample(75, 11),
    center: sample(35, 20), background: sample(35, 30),
    squareBounds: square.getWorldBounds(), roundBounds: round.getWorldBounds(),
    rotatedBounds: rotated.getWorldBounds(), rotatedLocalBounds: rotated.getLocalBounds(),
    pointerLog: [...pointerLog] };
}
function show() { output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  square.onPointer('pointerdown', event => pointerLog.push(`Square:${event.target?.id}`));
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
  round.setPath({ commands: commands(60), stroke: { color: blue, width: 10, cap: 'butt' } });
  accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render(); show();
}
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { square.setPath({ commands: commands(40), stroke: { color: blue, width: 10,
    cap: /** @type {import('@barocss/canvas2d').PathCap} */ ('bad') } }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  return { code, retained: JSON.stringify(observe()) === before };
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'stroke-cap-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); show();
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene'; fresh.width = 200; fresh.height = 160;
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextButt;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextSquare;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextRound;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextRotated;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const b = nextTree.get('Butt'), s = nextTree.get('Square'), r = nextTree.get('Round'),
      t = nextTree.get('Rotated');
    if (b?.kind !== 'path' || s?.kind !== 'path' || r?.kind !== 'path' || t?.kind !== 'path') {
      throw new Error('Paths missing');
    }
    nextButt = b; nextSquare = s; nextRound = r; nextRotated = t;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer; canvas.replaceWith(fresh);
  canvas = fresh; renderer = staged.renderer; tree = nextTree;
  butt = nextButt; square = nextSquare; round = nextRound; rotated = nextRotated;
  accepted = staged.scene; generation++; pointerLog = []; subscribe(); unbind = bind(); old.dispose(); show();
}
subscribe(); unbind = bind(); show();
document.querySelector('#edit')?.addEventListener('click', edit);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => { const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText); openInput.value = ''; });
Object.assign(window, { __strokeCapConsumer: { observe, edit, invalid, save, openText } });
