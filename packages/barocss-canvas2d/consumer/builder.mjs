// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene,
  createPathBuilder, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 240, height: 160 }, dpr: 2 };
const pose = (x = 0, y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
/** @type {import('@barocss/canvas2d').PathFillV5} */
const red = { color: [1, 0, 0, 1], rule: 'evenodd' };
/** @type {import('@barocss/canvas2d').PathFillV5} */
const blue = { color: [0, 0, 1, 1], rule: 'evenodd' };
let tree = createDisplayTree('BuilderConsumer');
let team = tree.createContainer({ id: 'Team', layer: 0, transform: pose() });
let rectangle = tree.createPath({ id: 'Rectangle', layer: 0, transform: pose(),
  commands: createPathBuilder().rect(20, 20, 60, 60).build(), fill: red });
let circle = tree.createPath({ id: 'Circle', layer: 1, transform: pose(),
  commands: createPathBuilder().circle(140, 60, 20).build(), fill: blue });
tree.stage.addChild(team); team.addChild(rectangle); team.addChild(circle);
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
const openInput = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
const samples = [[30, 30], [90, 30], [140, 60], [163, 60], [172, 60]];

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
  return { generation, scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
    children: team.children.map(child => `${child.kind}:${child.id}`), circleCommands: circle.data.commands,
    samples: samples.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null })),
    log: [...log] };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
function subscribe() {
  const born = generation;
  circle.onPointer('pointerdown', event => log.push(`g${born}:path:${event.target?.id}`));
  team.onPointer('pointerdown', event => log.push(`g${born}:group:${'id' in event.currentTarget ? event.currentTarget.id : 'stage'}`));
  tree.stage.onPointer('pointerdown', () => log.push(`g${born}:stage`));
}
function bind() {
  const currentCanvas = canvas;
  /** @param {PointerEvent} event */
  const onPointer = (event) => {
    const rect = currentCanvas.getBoundingClientRect();
    const point = { x: (event.clientX - rect.left) * options.logicalSize.width / rect.width,
      y: (event.clientY - rect.top) * options.logicalSize.height / rect.height };
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit: renderer.hitTest(point) });
    show('Dispatched pointerdown');
  };
  currentCanvas.addEventListener('pointerdown', onPointer);
  return () => currentCanvas.removeEventListener('pointerdown', onPointer);
}
function grow() {
  circle.setPath({ commands: createPathBuilder().circle(140, 60, 30).build(), fill: blue });
  const next = tree.snapshot(); renderer.updateScene(next); accepted = next; renderer.render();
  show('Circle radius is 30');
}
async function save() {
  const text = await serializeCanvasDocument(accepted, id => renderer.getImageAsset(id));
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'builder-document.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  show(`Saved ${new TextEncoder().encode(text).length} bytes`);
}
/** @param {string} text */
async function openText(text) {
  const fresh = document.createElement('canvas'); fresh.id = 'scene';
  const staged = await stageCanvasDocument(text, fresh, options);
  /** @type {import('@barocss/canvas2d').DisplayTree} */ let nextTree;
  /** @type {import('@barocss/canvas2d').ContainerHandle} */ let nextTeam;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextRectangle;
  /** @type {import('@barocss/canvas2d').PathHandle} */ let nextCircle;
  try {
    nextTree = createDisplayTreeFromScene(staged.scene);
    const group = nextTree.get('Team'), rect = nextTree.get('Rectangle'), round = nextTree.get('Circle');
    if (group?.kind !== 'container' || rect?.kind !== 'path' || round?.kind !== 'path' ||
        group.children.length !== 2 || !group.children.includes(rect) || !group.children.includes(round)) {
      throw new Error('Document does not have the consumer objects');
    }
    nextTeam = group; nextRectangle = rect; nextCircle = round;
  } catch (error) { staged.renderer.dispose(); throw error; }
  unbind();
  const oldRenderer = renderer;
  canvas.replaceWith(fresh); canvas = fresh; renderer = staged.renderer;
  tree = nextTree; team = nextTeam; rectangle = nextRectangle; circle = nextCircle;
  accepted = /** @type {import('@barocss/canvas2d').SceneV6} */ (staged.scene);
  generation++; log = []; subscribe(); unbind = bind(); oldRenderer.dispose();
  show('Opened editable builder scene');
}
subscribe(); unbind = bind();
document.querySelector('#grow')?.addEventListener('click', grow);
document.querySelector('#save')?.addEventListener('click', () => { void save(); });
openInput.addEventListener('change', () => {
  const file = openInput.files?.[0]; if (!file) return;
  void file.text().then(openText).catch(error => {
    show(`Rejected Open: ${/** @type {import('@barocss/canvas2d').Canvas2DError} */ (error).code ?? 'ERROR'}`);
  });
  openInput.value = '';
});
Object.assign(window, { __builderConsumer: { observe, grow, save, openText,
  get tree() { return tree; }, get canvas() { return canvas; }, get renderer() { return renderer; } } });
show('Ready: public path builder and compiled package entries');
