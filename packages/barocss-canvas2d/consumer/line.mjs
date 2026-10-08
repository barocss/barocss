// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const options = { logicalSize: { width: 180, height: 140 }, dpr: 2 };
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
let tree = createDisplayTree('LineConsumer');
let team = tree.createContainer({ id: 'Team', layer: 0, transform: pose() });
let paper = tree.createRect({ id: 'Paper', layer: 0, transform: pose(),
  width: 180, height: 140, fill: [1, 1, 1, 1] });
let line = tree.createLine({ id: 'Edge', layer: 1, transform: pose(),
  x1: 20, y1: 40, x2: 100, y2: 40, width: 12, stroke: [0, 0, 1, 1] });
tree.stage.addChild(team); team.addChild(paper); team.addChild(line);
/** @type {HTMLCanvasElement} */
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let renderer = createCanvas2D(canvas, options);
/** @type {import('@barocss/canvas2d').SceneV6} */
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
let generation = 1;
/** @type {string[]} */ let log = [];
/** @type {() => void} */ let unbind = () => {};
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[40, 40], [40, 50], [120, 60], [120, 80]];
/** @param {number} x @param {number} y */
function pixel(x, y) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 context missing');
  const bytes = new Uint8Array(4);
  gl.readPixels(x * options.dpr, canvas.height - y * options.dpr - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
function observe() {
  return { generation, scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
    line: line.data, children: team.children.map(child => `${child.kind}:${child.id}`),
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y }) })), log: [...log] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  const born = generation;
  line.onPointer('pointerdown', event => log.push(`g${born}:line:${event.target?.id}`));
  team.onPointer('pointerdown', () => log.push(`g${born}:team`));
  tree.stage.onPointer('pointerdown', () => log.push(`g${born}:stage`));
}
function bind() {
  const current = canvas;
  /** @param {PointerEvent} event */
  const onPointer = (event) => {
    const bounds = current.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * options.logicalSize.width / bounds.width,
      y: (event.clientY - bounds.top) * options.logicalSize.height / bounds.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit: renderer.hitTest(point) });
    show('Dispatched pointerdown');
  };
  current.addEventListener('pointerdown', onPointer);
  return () => current.removeEventListener('pointerdown', onPointer);
}
/** @param {string} message */
function submit(message) { const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render(); show(message); }
function edit() {
  line.setLine({ x1: 120, y1: 20, x2: 120, y2: 100, width: 12, stroke: [0, 1, 0, 1] });
  submit('Changed to vertical green line');
}
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { line.setLine({ x1: 20, y1: 40, x2: 20, y2: 40, width: 12, stroke: [0, 0, 1, 1] }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected line ${code}; retained ${JSON.stringify(observe()) === before}`);
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'line-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextTeam;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextPaper;
  /** @type {import('@barocss/canvas2d').LineHandle} */ let nextLine;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const group = nextTree.get('Team'), background = nextTree.get('Paper'), edge = nextTree.get('Edge');
    if (group?.kind !== 'container' || background?.kind !== 'rect' || edge?.kind !== 'line' ||
        !group.children.includes(background) || !group.children.includes(edge)) {
      throw new Error('Document does not contain the line and rectangle');
    }
    nextTeam = group; nextPaper = background; nextLine = edge;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; team = nextTeam; paper = nextPaper; line = nextLine;
  accepted = /** @type {import('@barocss/canvas2d').SceneV6} */ (staged.scene);
  generation++; log = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened editable line tree');
}
subscribe(); unbind = bind();
document.querySelector('#edit')?.addEventListener('click', edit);
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
input.addEventListener('change', () => {
  const file = input.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Rejected Open: ${/** @type {Error} */ (error).message}`));
  input.value = '';
});
Object.assign(window, { __lineConsumer: { observe, edit, invalid, save, openText,
  get tree() { return tree; }, get canvas() { return canvas; }, get renderer() { return renderer; } } });
show('Ready: public line handle');
