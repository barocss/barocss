// @ts-check
import { createCanvas2DApplication, stringifySceneJSON } from '@barocss/canvas2d';
/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {import('@barocss/canvas2d').TickInfo} TickInfo */
/** @typedef {{token:number,callback:(timestampMS:number)=>void}} Scheduled */
const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
/** @type {Scheduled|null} */ let pending = null;
/** @type {Scheduled[]} */ const canceled = [];
let nextToken = 0;
let clockMS = 0;
let disposed = false;
let missingNumber = 0;
/** @type {string|null} */ let missingNext = null;
/** @type {string|null} */ let missingId = null;
let reentrantNext = false;
/** @type {'stop'|'dispose'|null} */ let batchNext = null;
/** @type {(()=>void)|null} */ let errorUnsubscribe = null;
/** @type {(()=>void)[]} */ const updateUnsubscribes = [];
/** @type {(()=>void)[]} */ const hostUnsubscribes = [];
/** @type {(()=>void)[]} */ const pointerUnsubscribes = [];
/** @type {string[]} */ const logs = [];
/** @type {TickInfo[]} */ const ticks = [];
/** @type {{code:string,message:string,sameDeliberateError:boolean,retainedDisplay:boolean}|null} */ let caught = null;
/** @type {string|null} */ let reentrantCode = null;
/** @type {{available:boolean,token?:number,unchanged?:boolean}|null} */ let replay = null;
/** @type {Record<string,string>|null} */ let disposedCodes = null;
/** @type {ReturnType<typeof readDisplay>|null} */ let terminalDisplay = null;
const deliberateError = new Error('Deliberate host update failure');
const redAsset = { width: 1, height: 1, pixels: new Uint8Array([255, 0, 0, 255]) };
const counts = { requests: 0, cancels: 0, steps: 0, deliveries: 0, updateCallbacks: 0,
  postRenderCallbacks: 0, manualRenderCalls: 0, registeredAssets: 0, pointerEvents: 0,
  hostListeners: 0, updateSubscriptions: 0, rawSubscriptions: 0, pointerSubscriptions: 0,
  errors: 0, replays: 0, disposeCalls: 0 };
/** @param {string} message */
function log(message) { logs.push(message); if (logs.length > 160) logs.shift(); }
/** @type {import('@barocss/canvas2d').FrameScheduler} */
const scheduler = {
  requestFrame(callback) {
    if (pending) throw new Error('Host scheduler already has one pending frame');
    const token = ++nextToken; pending = { token, callback }; counts.requests++; log(`request:${token}`); return token;
  },
  cancelFrame(token) {
    counts.cancels++; log(`cancel:${String(token)}`);
    const scheduled = pending;
    if (scheduled && scheduled.token === token) { canceled.push(scheduled); if (canceled.length > 16) canceled.shift(); pending = null; }
  },
};
const app = createCanvas2DApplication(canvas, { contextId: 'ApplicationConsumer', renderer: {
  logicalSize: { width: 160, height: 100 }, dpr: 2, backgroundColor: [0.2, 0.2, 0.2, 1] }, scheduler, autoStart: false });
const back = app.tree.createRect({ id: 'Back', layer: 0,
  transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 }, width: 160, height: 100, fill: [0.2, 0.2, 0.2, 1] });
const moving = app.tree.createSprite({ id: 'Moving', layer: 1,
  transform: { x: 10, y: 30, scaleX: 1, scaleY: 1, rotation: 0 }, imageId: 'Red',
  width: 8, height: 20, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
app.tree.stage.addChild(back); app.tree.stage.addChild(moving);
app.renderer.setImageAsset('Red', redAsset); counts.registeredAssets++;
app.render(); counts.manualRenderCalls++;
let acceptedScene = stringifySceneJSON(app.tree.snapshot());
let acceptedX = moving.data.transform.x;
/** @param {unknown} error */
function codeOf(error) { return error instanceof Error && 'code' in error ? String(error.code) : error instanceof Error ? error.name : String(error); }
/** @param {Point} point */
function sample(point) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable'); const bytes = new Uint8Array(4);
  gl.readPixels(Math.floor(point.x * 2), canvas.height - Math.floor(point.y * 2) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return { point, rgba: [...bytes], hit: app.renderer.hitTest(point)?.id ?? null };
}
function readDisplay() {
  return { acceptedX, acceptedScene, samples: [15, 25, 35, 45, 55, 65, 105, 145].map(x => sample({ x, y: 40 })),
    back: sample({ x: 140, y: 80 }), assetBytes: [...(app.renderer.getImageAsset('Red')?.pixels ?? [])] };
}
function displayFingerprint() { return JSON.stringify(disposed ? terminalDisplay : readDisplay()); }
function observe() {
  return { disposed, running: app.running, scheduler: 'controlled deferred callbacks', clockMS,
    pendingToken: pending?.token ?? null, canceledTokens: canceled.map(item => item.token),
    counts: { ...counts }, sceneVersion: app.tree.snapshot().version, treeX: moving.data.transform.x,
    treeImageId: moving.data.imageId, treeScene: stringifySceneJSON(app.tree.snapshot()),
    treeMatchesAcceptedScene: stringifySceneJSON(app.tree.snapshot()) === acceptedScene,
    display: disposed ? terminalDisplay : readDisplay(), displayCachedBeforeDispose: disposed,
    logs: [...logs], ticks: ticks.map(info => ({ ...info })), caught, reentrantCode, replay, disposedCodes,
    missingId, backing: { width: canvas.width, height: canvas.height } };
}
/** @param {string} message */
function show(message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2); }
/** @param {TickInfo} info @param {string} name */
function updated(info, name) { counts.updateCallbacks++; log(`f${info.frame}:${name}:treeX=${moving.data.transform.x}`); }
/** @param {import('@barocss/canvas2d').TickListener} listener @param {number} priority */
function subscribe(listener, priority) {
  const stop = app.onUpdate(listener, priority); counts.updateSubscriptions++; let active = true;
  const unsubscribe = () => { if (!active) return; active = false; counts.updateSubscriptions--; stop(); };
  updateUnsubscribes.push(unsubscribe); return unsubscribe;
}
subscribe(info => {
  updated(info, 'high'); ticks.push(info); if (ticks.length > 20) ticks.shift();
  const action = batchNext; batchNext = null;
  if (action === 'stop') { log(`f${info.frame}:stop-in-update`); app.stop(); }
  if (action === 'dispose') { log(`f${info.frame}:dispose-in-update`); dispose(); }
}, 50);
subscribe(info => {
  updated(info, 'tie-first'); moving.setPosition(moving.data.transform.x >= 100 ? 10 : moving.data.transform.x + 10, 30);
  if (missingNext) { moving.setImageSource(missingNext); missingId = missingNext; missingNext = null; log(`f${info.frame}:tree-asset=${missingId}`); }
}, 0);
subscribe(info => updated(info, 'tie-second'), 0);
subscribe(info => {
  updated(info, 'last');
  if (reentrantNext) { reentrantNext = false;
    try { app.render(); reentrantCode = 'ACCEPTED'; } catch (error) { reentrantCode = codeOf(error); }
    log(`f${info.frame}:reentrant=${reentrantCode}`);
  }
}, -99);
const removeRaw = app.ticker.onTick(info => {
  counts.postRenderCallbacks++; acceptedScene = stringifySceneJSON(app.tree.snapshot()); acceptedX = moving.data.transform.x;
  const painted = sample({ x: acceptedX + 4, y: 40 });
  log(`f${info.frame}:raw-after-render:x=${acceptedX}:hit=${painted.hit}:rgba=${painted.rgba.join(',')}`);
}, -100);
counts.rawSubscriptions++;
/** @param {() => void} action @param {string} message */
function controlled(action, message) {
  if (disposed) return; const before = displayFingerprint();
  try { action(); show(message); }
  catch (error) { counts.errors++; caught = { code: codeOf(error), message: error instanceof Error ? error.message : String(error),
    sameDeliberateError: error === deliberateError, retainedDisplay: displayFingerprint() === before }; show(`Caught ${caught.code}`); }
}
function start() { controlled(() => app.start(), 'Started; one frame is queued'); }
function stop() { controlled(() => app.stop(), 'Stopped; no frame is queued'); }
function resume() { controlled(() => app.start(), 'Resumed; next ticker delta is zero'); }
/** @param {number} incrementMS */
function step(incrementMS = 16) {
  if (disposed) return; const scheduled = pending;
  if (!scheduled) { show('No queued frame; use Start or Resume'); return; }
  if (!Number.isFinite(incrementMS) || incrementMS < 0) throw new RangeError('Use a nonnegative finite clock increment');
  const before = displayFingerprint(); pending = null; clockMS += incrementMS; counts.steps++; counts.deliveries++;
  try { scheduled.callback(clockMS); show(disposed ? 'Disposed during update batch' : 'Delivered controlled scheduler callback'); }
  catch (error) { counts.errors++; caught = { code: codeOf(error), message: error instanceof Error ? error.message : String(error),
    sameDeliberateError: error === deliberateError, retainedDisplay: displayFingerprint() === before }; show(`Frame stopped: ${caught.code}`); }
}
function render() { controlled(() => { app.render(); counts.manualRenderCalls++;
  acceptedScene = stringifySceneJSON(app.tree.snapshot()); acceptedX = moving.data.transform.x; }, 'Manually submitted and rendered the current tree'); }
function armMissing() { if (disposed) return; missingNext = `Missing${++missingNumber}`; show(`Next update uses unregistered ${missingNext}`); }
function repair() { const id = missingId; if (disposed || !id) return;
  controlled(() => { app.renderer.setImageAsset(id, redAsset); counts.registeredAssets++; app.start(); }, 'Registered missing asset and queued a restart frame'); }
function armError() {
  if (disposed) return; errorUnsubscribe?.();
  errorUnsubscribe = subscribe(info => { updated(info, 'deliberate-error'); throw deliberateError; }, -20);
  show('Next frame will throw the same deliberate error after tree movement');
}
function recover() { if (disposed) return; errorUnsubscribe?.(); errorUnsubscribe = null;
  controlled(() => app.start(), 'Unsubscribed deliberate error and queued a restart frame'); }
function armReentrant() { if (disposed) return; reentrantNext = true; show('Last update will try app.render()'); }
function armStopInUpdate() { if (disposed) return; batchNext = 'stop'; show('High update will stop scheduling; current batch can complete'); }
function armDisposeInUpdate() { if (disposed) return; batchNext = 'dispose'; show('High update will dispose the Application'); }
function replayCanceled() {
  const scheduled = canceled[canceled.length - 1];
  if (!scheduled) { replay = { available: false }; show('No canceled callback has been captured'); return replay; }
  const before = JSON.stringify({ display: disposed ? terminalDisplay : readDisplay(), tree: stringifySceneJSON(app.tree.snapshot()),
    updates: counts.updateCallbacks, rendered: counts.postRenderCallbacks, running: app.running });
  counts.replays++; scheduled.callback(clockMS + 16);
  const after = JSON.stringify({ display: disposed ? terminalDisplay : readDisplay(), tree: stringifySceneJSON(app.tree.snapshot()),
    updates: counts.updateCallbacks, rendered: counts.postRenderCallbacks, running: app.running });
  replay = { available: true, token: scheduled.token, unchanged: before === after };
  show('Replayed a canceled scheduler callback as a controlled lifetime check'); return replay;
}
function probeDisposed() {
  const actions = { onUpdate: () => app.onUpdate(() => {}), start: () => app.start(), stop: () => app.stop(),
    render: () => app.render(), rendererRender: () => app.renderer.render(), tickerStart: () => app.ticker.start() };
  /** @type {Record<string,string>} */ const codes = {};
  for (const [name, action] of Object.entries(actions)) {
    try { action(); codes[name] = 'ACCEPTED'; } catch (error) { codes[name] = codeOf(error); }
  }
  disposedCodes = codes; return { ...codes };
}
function cpuAfterDispose() { if (!disposed) return null;
  moving.setPosition(moving.data.transform.x + 5, 30); show('Edited the exposed CPU tree handle after disposal'); return moving.data.transform; }
function dispose() {
  counts.disposeCalls++; if (disposed) return;
  terminalDisplay = readDisplay(); disposed = true;
  for (const remove of hostUnsubscribes.splice(0)) remove();
  for (const remove of pointerUnsubscribes.splice(0)) { remove(); counts.pointerSubscriptions--; }
  for (const remove of updateUnsubscribes.splice(0)) remove(); errorUnsubscribe = null;
  removeRaw(); counts.rawSubscriptions--;
  try { app.dispose(); } catch (error) { counts.errors++; log(`dispose-error:${codeOf(error)}`); }
  probeDisposed();
  for (const button of Array.from(document.querySelectorAll('button'))) button.disabled = true;
  show('Disposed owned ticker/renderer and host listeners; CPU tree remains accessible');
}
for (const handle of [moving, back]) {
  pointerUnsubscribes.push(handle.onPointer('pointerdown', event => log(`pointer:${handle.id}:${event.target?.id}`))); counts.pointerSubscriptions++;
}
pointerUnsubscribes.push(app.tree.stage.onPointer('pointerdown', event => log(`pointer:stage:${event.target?.id ?? 'none'}`))); counts.pointerSubscriptions++;
const onPointer = (/** @type {PointerEvent} */ event) => {
  if (disposed) return; counts.pointerEvents++; const rect = canvas.getBoundingClientRect();
  const viewport = { x: (event.clientX - rect.left) * 160 / rect.width, y: (event.clientY - rect.top) * 100 / rect.height };
  app.tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId,
    point: app.renderer.viewportToWorld(viewport), hit: app.renderer.hitTest(viewport) }); show('Forwarded real pointerdown');
};
canvas.addEventListener('pointerdown', onPointer); counts.hostListeners++;
hostUnsubscribes.push(() => { canvas.removeEventListener('pointerdown', onPointer); counts.hostListeners--; });
const actions = { start, step: () => step(), 'long-step': () => step(1000), stop, resume, render,
  missing: armMissing, repair, throw: armError, recover, reentrant: armReentrant,
  'stop-batch': armStopInUpdate, 'dispose-batch': armDisposeInUpdate, replay: replayCanceled, dispose };
for (const [id, action] of Object.entries(actions)) {
  const button = document.querySelector(`#${id}`); button?.addEventListener('click', action); counts.hostListeners++;
  hostUnsubscribes.push(() => { button?.removeEventListener('click', action); counts.hostListeners--; });
}
Object.assign(window, { __canvas2dApplicationConsumer: { observe, start, stop, resume, step, render, dispose,
  probeActions: Object.freeze({ armMissing, repair, armError, recover, armReentrant, armStopInUpdate,
    armDisposeInUpdate, replayCanceled, probeDisposed, cpuAfterDispose }),
  get app() { return app; }, get canvas() { return canvas; }, get counts() { return { ...counts }; }, get logs() { return [...logs]; } } });
show('Ready: stopped Application and controlled scheduler');
