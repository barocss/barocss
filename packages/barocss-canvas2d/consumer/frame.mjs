// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const options = { logicalSize: { width: 180, height: 140 }, dpr: 2 };
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
let tree = createDisplayTree('FrameConsumer');
let team = tree.createContainer({ id: 'Team', layer: 1, transform: pose() });
let frame = tree.createFrame({ id: 'Window', layer: 0, transform: pose(20, 20),
  width: 60, height: 60, fill: [1, 0, 0, 1], clip: true });
let overhang = tree.createRect({ id: 'Overhang', layer: 1, transform: pose(40, 20),
  width: 40, height: 40, fill: [0, 0, 1, 1] });
const paper = tree.createRect({ id: 'Paper', layer: 0, transform: pose(),
  width: 180, height: 140, fill: [1, 1, 1, 1] });
tree.stage.addChild(paper); tree.stage.addChild(team); team.addChild(frame); frame.addChild(overhang);
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
const samples = [[30, 30], [70, 50], [90, 50], [110, 50]];
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
    frame: frame.data, children: frame.children.map(child => `${child.kind}:${child.id}`),
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y }) })), log: [...log] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  const born = generation;
  frame.onPointer('pointerdown', event => log.push(`g${born}:frame:${event.target?.id}`));
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
function toggleClip() {
  frame.setFrame({ width: frame.data.width, height: frame.data.height,
    fill: frame.data.fill, clip: !frame.data.clip });
  submit(`Clip ${frame.data.clip ? 'on' : 'off'}`);
}
function invalid() {
  const before = JSON.stringify(observe());
  let code = 'ACCEPTED';
  try { frame.setFrame({ width: 0, height: 60, fill: [1, 0, 0, 1], clip: true }); }
  catch (error) { code = /** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code; }
  show(`Rejected frame ${code}; retained ${JSON.stringify(observe()) === before}`);
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'frame-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextTeam;
  /** @type {import('@barocss/canvas2d').FrameHandle} */ let nextFrame;
  /** @type {import('@barocss/canvas2d').RectHandle} */ let nextOverhang;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const group = nextTree.get('Team'), window = nextTree.get('Window'), child = nextTree.get('Overhang');
    if (group?.kind !== 'container' || window?.kind !== 'frame' || child?.kind !== 'rect' ||
        !group.children.includes(window) || !window.children.includes(child)) {
      throw new Error('Document does not contain the frame and child');
    }
    nextTeam = group; nextFrame = window; nextOverhang = child;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind(); const old = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; team = nextTeam; frame = nextFrame; overhang = nextOverhang;
  accepted = /** @type {import('@barocss/canvas2d').SceneV6} */ (staged.scene);
  generation++; log = []; subscribe(); unbind = bind(); old.dispose();
  show('Opened editable frame tree');
}
subscribe(); unbind = bind();
document.querySelector('#toggle')?.addEventListener('click', toggleClip);
document.querySelector('#invalid')?.addEventListener('click', invalid);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
input.addEventListener('change', () => {
  const file = input.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => show(`Rejected Open: ${/** @type {Error} */ (error).message}`));
  input.value = '';
});
Object.assign(window, { __frameConsumer: { observe, toggleClip, invalid, save, openText,
  get tree() { return tree; }, get canvas() { return canvas; }, get renderer() { return renderer; } } });
show('Ready: public frame handle');
