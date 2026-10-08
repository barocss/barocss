// @ts-check
import { createCanvas2D, createDisplayTree, createTicker,
  stringifySceneJSON } from '@barocss/canvas2d';

/** @type {import('@barocss/canvas2d').Canvas2DOptions} */
const options = { logicalSize: { width: 160, height: 100 }, dpr: 2 };
/** @type {HTMLCanvasElement} */
const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
const renderer = createCanvas2D(canvas, options);
renderer.setImageAsset('RGBA2', { width: 2, height: 2, pixels: new Uint8Array([
  255, 0, 0, 255, 0, 0, 0, 0,
  0, 0, 255, 255, 0, 255, 0, 255,
]) });
/** @param {number} x @param {number} y */
const pose = (x, y) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const tree = createDisplayTree('TickerConsumer');
const sprite = tree.createSprite({ id: 'Moving', layer: 0, transform: pose(20, 20),
  imageId: 'RGBA2', width: 40, height: 40, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
tree.stage.addChild(sprite);
let accepted = tree.snapshot();
renderer.updateScene(accepted); renderer.render();
const ticker = createTicker();
/** @type {import('@barocss/canvas2d').TickInfo[]} */
let history = [];
let disposed = false;
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const samplePoints = [[30, 30], [70, 30]];

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
  return { running: ticker.running, disposed, x: sprite.data.transform.x,
    scene: stringifySceneJSON(accepted), treeScene: stringifySceneJSON(tree.snapshot()),
    canvasSize: [canvas.width, canvas.height], history: history.map(info => ({ ...info })),
    samples: samplePoints.map(([x, y]) => ({ x, y, rgba: pixel(x, y), hit: renderer.hitTest({ x, y })?.id ?? null })) };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
/** @param {import('@barocss/canvas2d').TickInfo} info */
ticker.onTick(info => {
  history.push(info);
  const x = Math.min(60, sprite.data.transform.x + Math.min(20, info.deltaMS * 2));
  sprite.setTransform(pose(x, 20));
  accepted = tree.snapshot();
  renderer.updateScene(accepted); renderer.render();
  if (x >= 60) ticker.stop();
  show(ticker.running ? `Rendered frame ${info.frame}` : `Stopped at frame ${info.frame}`);
});
function start() { ticker.start(); show('Started ticker'); }
function stop() { ticker.stop(); show('Stopped ticker'); }
function resume() { ticker.start(); show('Resumed ticker'); }
function reset() {
  ticker.stop();
  sprite.setTransform(pose(20, 20));
  accepted = tree.snapshot(); renderer.updateScene(accepted); renderer.render();
  history = [];
  show('Reset sprite');
}
function dispose() {
  ticker.dispose(); disposed = true;
  for (const id of ['start', 'stop', 'resume', 'reset', 'dispose']) {
    /** @type {HTMLButtonElement} */ (document.querySelector(`#${id}`)).disabled = true;
  }
  show('Disposed ticker');
}
const actions = { start, stop, resume, reset, dispose };
for (const [id, action] of Object.entries(actions)) document.querySelector(`#${id}`)?.addEventListener('click', action);
Object.assign(window, { __tickerConsumer: { observe, start, stop, resume, reset, dispose,
  get ticker() { return ticker; }, get tree() { return tree; }, get renderer() { return renderer; } } });
show('Ready: public ticker and explicit renderer updates');
