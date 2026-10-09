// @ts-check
import { createCanvas2D, createDisplayTree, createSpriteAnimation, createSpriteAtlas,
  createTicker, loadImageURL, stringifySceneJSON } from '@barocss/canvas2d';

/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {{ tree: import('@barocss/canvas2d').DisplayTree,
 * parent: import('@barocss/canvas2d').ContainerHandle, actor: import('@barocss/canvas2d').SpriteHandle,
 * tokens: import('@barocss/canvas2d').SpriteHandle[], renderer: import('@barocss/canvas2d').Canvas2DRenderer,
 * animation: import('@barocss/canvas2d').SpriteAnimation, ticker: import('@barocss/canvas2d').Canvas2DTicker,
 * accepted: import('@barocss/canvas2d').Scene, unbind: () => void }} Session */
const options = { logicalSize: { width: 320, height: 200 }, dpr: 2 };
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) =>
  ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const initialPose = pose(20, 32);
const frameNames = ['Red', 'Blue', 'Green'];
const atlasEntries = frameNames.map((name, index) => ({ name,
  sourceRect: { x: index * 8, y: 0, width: 8, height: 8 }, durationMS: 100 }));
const tokenRects = [
  { id: 'Token1', x: 100, y: 32, width: 20, height: 20 },
  { id: 'Token2', x: 180, y: 65, width: 20, height: 20 },
  { id: 'Token3', x: 230, y: 125, width: 20, height: 20 },
];
const atlasURL = new URL('./game-atlas.png', import.meta.url).href;
const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const scoreOutput = /** @type {HTMLElement} */ (document.querySelector('#score'));
/** @type {Session | null} */ let session = null;
/** @type {'loading' | 'ready' | 'canceled' | 'error' | 'disposed'} */ let state = 'loading';
let disposed = false;
let generation = 0;
let score = 0;
/** @type {Set<string>} */ const collected = new Set();
/** @type {{ pointerId: number, offset: Point } | null} */ let drag = null;
let lastPointerId = -1;
/** @type {AbortController | null} */ let loader = null;
/** @type {{ timer: number, resolve: () => void } | null} */ let loadGate = null;
let loadDelayMS = 0;
/** @type {string[]} */ const routes = [];
/** @type {string[]} */ const hover = [];
/** @type {import('@barocss/canvas2d').TickInfo[]} */ const tickHistory = [];
/** @type {null | { code: string, retained: boolean }} */ let refusal = null;
/** @type {ReturnType<typeof liveObservation> | null} */ let terminal = null;
/** @type {(() => void)[]} */ const hostUnbind = [];
const pendingFrames = new Set();
const counts = { loadsStarted: 0, loadsDecoded: 0, loadsIgnored: 0, rendererCreations: 0,
  frameRequests: 0, frameCancels: 0, nativeCallbacks: 0, tickCallbacks: 0,
  submits: 0, renders: 0, steps: 0, resets: 0, pointerEvents: 0, pickups: 0,
  staleCallbacks: 0, disposeCalls: 0, errors: 0 };

/** @param {unknown} error */
function codeOf(error) {
  return error instanceof Error && 'code' in error ? String(error.code)
    : error instanceof Error ? error.name : String(error);
}
/** @param {string[]} log @param {string} item */
function log(log, item) { log.push(item); if (log.length > 80) log.shift(); }
/** @param {Point} viewport */
function readPixel(viewport) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable');
  const bytes = new Uint8Array(4);
  gl.readPixels(Math.floor(viewport.x * options.dpr), canvas.height - Math.floor(viewport.y * options.dpr) - 1,
    1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return [...bytes];
}
/** @param {Session} s @param {Point} viewport */
function sample(s, viewport) {
  return { point: viewport, rgba: readPixel(viewport), hit: s.renderer.hitTest(viewport)?.id ?? null,
    hits: s.renderer.hitTestAll(viewport).map(hit => hit.id) };
}
/** @param {Session} s */
function liveObservation(s) {
  const toViewport = (/** @type {Point} */ local) => s.renderer.worldToViewport(s.actor.toWorld(local));
  const actorOpaque = toViewport({ x: 8, y: 16 });
  const actorTransparent = toViewport({ x: 28, y: 4 });
  return { sceneVersion: s.accepted.version, actorId: s.actor.id, frameIndex: s.animation.frameIndex,
    frameName: frameNames[s.animation.frameIndex], playing: s.animation.playing, tickerRunning: s.ticker.running,
    actorPosition: { x: s.actor.data.transform.x, y: s.actor.data.transform.y },
    sourceRect: s.actor.data.sourceRect, parentTransform: s.parent.data.transform,
    actorOpaque: sample(s, actorOpaque), actorTransparent: sample(s, actorTransparent),
    fixedBackground: sample(s, { x: 12, y: 12 }),
    tokens: tokenRects.map((rect, index) => ({ ...rect, visible: s.tokens[index].data.visible,
      viewportCenter: s.renderer.worldToViewport(s.parent.toWorld({ x: rect.x + 10, y: rect.y + 10 })),
      sample: sample(s, s.renderer.worldToViewport(s.parent.toWorld({ x: rect.x + 10, y: rect.y + 10 }))) })),
    capture: lastPointerId < 0 ? null : s.tree.getPointerCapture(lastPointerId)?.id ?? null,
    domCapture: lastPointerId >= 0 && canvas.hasPointerCapture(lastPointerId),
    sceneMatchesTree: stringifySceneJSON(s.accepted) === stringifySceneJSON(s.tree.snapshot()) };
}
function observe() {
  return { state, disposed, generation, score, collected: [...collected], atlasURL, loadDelayMS,
    backing: { width: canvas.width, height: canvas.height }, dpr: options.dpr,
    pendingFrames: pendingFrames.size, dragging: drag !== null, lastPointerId,
    counts: { ...counts }, routes: [...routes], hover: [...hover], ticks: tickHistory.map(info => ({ ...info })),
    refusal: refusal && { ...refusal }, scene: session ? liveObservation(session) : terminal };
}
/** @param {string} message */
function show(message) {
  status.textContent = message; scoreOutput.textContent = `${score} / 3`;
  output.textContent = JSON.stringify(observe(), null, 2);
  for (const id of ['play', 'pause', 'step', 'reset', 'invalid', 'missing']) {
    const button = /** @type {HTMLButtonElement} */ (document.querySelector(`#${id}`));
    button.disabled = disposed || !session;
  }
  /** @type {HTMLButtonElement} */ (document.querySelector('#load')).disabled = disposed || !!session || state === 'loading';
  /** @type {HTMLButtonElement} */ (document.querySelector('#cancel-load')).disabled = disposed || state !== 'loading';
  /** @type {HTMLButtonElement} */ (document.querySelector('#dispose')).disabled = disposed;
}
/** @param {Session} s */
function submit(s) {
  if (disposed || session !== s) return;
  const next = s.tree.snapshot(); s.renderer.updateScene(next); s.accepted = next; counts.submits++;
  s.renderer.render(); counts.renders++;
}
function clearDrag() {
  const id = drag?.pointerId ?? lastPointerId;
  drag = null;
  if (id >= 0) {
    session?.tree.releasePointer(id);
    if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  }
}
function pause() {
  if (!session || disposed) return;
  session.ticker.stop(); session.animation.pause(); show('Paused');
}
function play() {
  if (!session || disposed || document.hidden) return;
  session.animation.play(); session.ticker.start(); show('Playing');
}
function step() {
  const s = session; if (!s || disposed) return;
  pause(); s.animation.play(); s.animation.advance(100); s.animation.pause(); counts.steps++;
  submit(s); show('Advanced 100 ms while paused');
}
function reset() {
  const s = session; if (!s || disposed) return;
  pause(); clearDrag(); s.animation.seek(0); s.actor.setTransform(initialPose);
  for (const token of s.tokens) token.setVisible(true);
  score = 0; collected.clear(); refusal = null; counts.resets++; submit(s); show('Reset actor, tokens and score');
}
/** @param {Session} s */
function pickup(s) {
  const center = { x: s.actor.data.transform.x + 16, y: s.actor.data.transform.y + 16 };
  const index = tokenRects.findIndex(rect => !collected.has(rect.id) &&
    center.x >= rect.x && center.x < rect.x + rect.width && center.y >= rect.y && center.y < rect.y + rect.height);
  if (index < 0) return;
  const token = s.tokens[index]; token.setVisible(false); collected.add(token.id);
  score = collected.size; counts.pickups++; submit(s);
}
/** @param {Session} s */
function bindInput(s) {
  /** @type {(() => void)[]} */ const unsubscribe = [];
  unsubscribe.push(s.actor.onPointer('pointerdown', event => {
    if (drag || disposed || session !== s) return;
    const local = s.parent.toLocal(event.point);
    drag = { pointerId: event.pointerId, offset: {
      x: local.x - s.actor.data.transform.x, y: local.y - s.actor.data.transform.y } };
    s.tree.capturePointer(event.pointerId, s.actor);
  }));
  unsubscribe.push(s.actor.onPointer('pointermove', event => {
    if (drag?.pointerId !== event.pointerId || disposed || session !== s) return;
    const local = s.parent.toLocal(event.point);
    s.actor.setPosition(Math.max(0, Math.min(244, local.x - drag.offset.x)),
      Math.max(0, Math.min(142, local.y - drag.offset.y))); submit(s);
  }));
  unsubscribe.push(s.actor.onPointer('pointerup', event => {
    if (drag?.pointerId === event.pointerId && session === s && !disposed) pickup(s);
  }));
  for (const handle of [s.actor, s.parent, ...s.tokens, s.tree.get('Back'), s.tree.stage]) {
    if (!handle) continue;
    for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) {
      unsubscribe.push(handle.onPointer(type, event => log(routes,
        `${event.pointerId}:${type}:${event.target?.id ?? 'none'}:${'id' in handle ? handle.id : 'stage'}`)));
    }
  }
  for (const handle of [s.actor, ...s.tokens]) {
    for (const type of /** @type {const} */ (['pointerenter', 'pointerleave'])) {
      unsubscribe.push(handle.onHover(type, event => log(hover, `${event.pointerId}:${type}:${handle.id}`)));
    }
  }
  /** @param {PointerEvent} event */
  const pointer = event => {
    if (disposed || session !== s) return;
    counts.pointerEvents++; lastPointerId = event.pointerId;
    const bounds = canvas.getBoundingClientRect();
    const viewport = { x: (event.clientX - bounds.left) * options.logicalSize.width / bounds.width,
      y: (event.clientY - bounds.top) * options.logicalSize.height / bounds.height };
    const world = s.renderer.viewportToWorld(viewport);
    try {
      s.tree.dispatchPointer({ type: /** @type {import('@barocss/canvas2d').PointerEventType} */ (event.type),
        pointerId: event.pointerId, point: world, hit: s.renderer.hitTest(viewport) });
      if (event.type === 'pointerdown' && drag?.pointerId === event.pointerId) canvas.setPointerCapture(event.pointerId);
      if (event.type === 'pointermove') {
        s.tree.dispatchHover({ pointerId: event.pointerId, point: world, hit: s.renderer.hitTest(viewport) });
      }
    } catch (error) {
      counts.errors++; pause(); clearDrag(); show(`Pointer failed: ${codeOf(error)}`); return;
    } finally {
      if ((event.type === 'pointerup' || event.type === 'pointercancel') && drag?.pointerId === event.pointerId) clearDrag();
    }
    show(`Received ${event.type}`);
  };
  const lostCapture = (/** @type {PointerEvent} */ event) => {
    if (drag?.pointerId === event.pointerId) { clearDrag(); show('Released lost pointer capture'); }
  };
  for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) {
    canvas.addEventListener(type, pointer);
  }
  canvas.addEventListener('lostpointercapture', lostCapture);
  return () => {
    for (const type of /** @type {const} */ (['pointerdown', 'pointermove', 'pointerup', 'pointercancel'])) {
      canvas.removeEventListener(type, pointer);
    }
    canvas.removeEventListener('lostpointercapture', lostCapture);
    for (const unbind of unsubscribe) unbind();
  };
}
function releaseGate() {
  if (!loadGate) return;
  const gate = loadGate; loadGate = null; clearTimeout(gate.timer); gate.resolve();
}
function cancelLoad() {
  if (disposed || state !== 'loading') return;
  generation++; loader?.abort(); loader = null; releaseGate(); state = 'canceled'; show('Canceled atlas load');
}
/** @param {number} delayMS */
async function load(delayMS = 0) {
  if (!Number.isFinite(delayMS) || delayMS < 0 || delayMS > 1000) throw new RangeError('delayMS must be 0..1000');
  if (disposed || session) return;
  if (state === 'loading' && loader) cancelLoad();
  const current = ++generation; const controller = new AbortController(); loader = controller;
  loadDelayMS = delayMS; state = 'loading'; counts.loadsStarted++; show('Loading same-origin PNG atlas');
  try {
    const asset = await loadImageURL(atlasURL, { signal: controller.signal }); counts.loadsDecoded++;
    // The test gate holds a real decoded HTTP result before any renderer is created.
    if (delayMS > 0 && current === generation && !disposed) {
      await new Promise(resolve => {
        const finish = () => { loadGate = null; resolve(undefined); };
        loadGate = { timer: window.setTimeout(finish, delayMS), resolve: finish };
      });
    }
    if (disposed || current !== generation || controller.signal.aborted) { counts.loadsIgnored++; return; }
    if (asset.width !== 32 || asset.height !== 8) throw new Error('Expected the 32×8 fixture atlas');
    const tree = createDisplayTree('AtlasGame');
    tree.stage.addChild(tree.createRect({ id: 'Back', layer: 0, transform: pose(),
      width: 320, height: 200, fill: [0.125, 0.15625, 0.21875, 1] }));
    const parent = tree.createContainer({ id: 'World', layer: 1,
      transform: { ...pose(36, 28), scaleX: 1.1, scaleY: 0.9, rotation: 0.14 } });
    tree.stage.addChild(parent);
    const tokens = tokenRects.map(rect => tree.createSprite({ id: rect.id, layer: 0,
      transform: pose(rect.x, rect.y), imageId: 'GameAtlas', sourceRect: { x: 24, y: 0, width: 8, height: 8 },
      width: rect.width, height: rect.height, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 }));
    for (const token of tokens) parent.addChild(token);
    const actor = tree.createSprite({ id: 'Actor', layer: 1, transform: initialPose,
      imageId: 'GameAtlas', sourceRect: { x: 0, y: 0, width: 8, height: 8 },
      width: 32, height: 32, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 });
    parent.addChild(actor);
    const atlas = createSpriteAtlas('GameAtlas', { width: asset.width, height: asset.height }, atlasEntries);
    const animation = createSpriteAnimation(actor, atlas.sequence(frameNames));
    const renderer = createCanvas2D(canvas, options); counts.rendererCreations++;
    /** @type {import('@barocss/canvas2d').FrameScheduler} */
    const scheduler = {
      requestFrame(callback) {
        counts.frameRequests++;
        const token = requestAnimationFrame(timestampMS => {
          pendingFrames.delete(token); counts.nativeCallbacks++;
          if (disposed || current !== generation) { counts.staleCallbacks++; return; }
          callback(timestampMS);
        });
        pendingFrames.add(token); return token;
      },
      cancelFrame(token) { counts.frameCancels++; pendingFrames.delete(token); cancelAnimationFrame(/** @type {number} */ (token)); },
    };
    const ticker = createTicker(scheduler);
    /** @type {Session} */
    const s = { tree, parent, actor, tokens, renderer, animation, ticker, accepted: tree.snapshot(), unbind: () => {} };
    try {
      renderer.setImageAsset('GameAtlas', asset); renderer.updateScene(s.accepted); counts.submits++;
      renderer.render(); counts.renders++;
    } catch (error) { ticker.dispose(); animation.dispose(); renderer.dispose(); throw error; }
    session = s; score = 0; collected.clear(); terminal = null; state = 'ready';
    s.unbind = bindInput(s);
    ticker.onTick(info => {
      if (disposed || session !== s || current !== generation) return;
      counts.tickCallbacks++; tickHistory.push(info); if (tickHistory.length > 20) tickHistory.shift();
      try { animation.advance(info.deltaMS); submit(s); show('Playing with capped deltaMS'); }
      catch (error) { counts.errors++; pause(); clearDrag(); show(`Tick failed: ${codeOf(error)}`); }
    });
    show('Ready: drag the actor or Play its animation');
  } catch (error) {
    if (disposed || current !== generation || controller.signal.aborted) { counts.loadsIgnored++; return; }
    counts.errors++; state = 'error'; show(`Load failed: ${codeOf(error)}`);
  } finally { if (current === generation) loader = null; }
}
/** @param {Session} s */
function fingerprint(s) {
  return JSON.stringify({ scene: stringifySceneJSON(s.accepted), tree: stringifySceneJSON(s.tree.snapshot()),
    actor: s.actor.data, samples: liveObservation(s) });
}
/** @param {(s: Session) => void} operation */
function reject(operation) {
  const s = session; if (!s || disposed) return null;
  pause(); clearDrag(); const before = fingerprint(s); let code = 'ACCEPTED';
  try { operation(s); } catch (error) { code = codeOf(error); }
  s.renderer.render(); counts.renders++; refusal = { code, retained: fingerprint(s) === before };
  show(`Refused candidate: ${code}`); return { ...refusal };
}
function invalidCrop() {
  return reject(s => s.actor.setSourceRect({ x: 0, y: 0, width: 0, height: 8 }));
}
function missingAsset() {
  return reject(s => {
    const candidate = structuredClone(s.accepted);
    const parent = candidate.nodes.find(node => node.id === 'World');
    if (parent?.kind !== 'group') throw new Error('World missing');
    const actor = parent.children.find(node => node.id === 'Actor');
    if (actor?.kind !== 'image') throw new Error('Actor missing');
    actor.imageId = 'MissingAtlas'; s.renderer.updateScene(candidate);
  });
}
function dispose() {
  counts.disposeCalls++; if (disposed) return;
  clearDrag(); const s = session;
  if (s) {
    s.ticker.dispose(); s.animation.dispose(); s.unbind(); terminal = liveObservation(s); s.renderer.dispose();
  }
  session = null; disposed = true; generation++; loader?.abort(); loader = null; releaseGate();
  for (const unbind of hostUnbind.splice(0)) unbind(); state = 'disposed'; show('Disposed: reload this page to create a new game');
}
function visibility() {
  if (document.hidden) { pause(); clearDrag(); if (!disposed) show('Paused on visibility loss'); }
}
document.addEventListener('visibilitychange', visibility);
hostUnbind.push(() => document.removeEventListener('visibilitychange', visibility));
const actions = { play, pause, step, reset, invalid: invalidCrop, missing: missingAsset, dispose,
  load: () => { void load(); }, 'cancel-load': cancelLoad };
for (const [id, action] of Object.entries(actions)) {
  const button = document.querySelector(`#${id}`); button?.addEventListener('click', action);
  hostUnbind.push(() => button?.removeEventListener('click', action));
}
Object.defineProperty(window, 'game', { value: Object.freeze({ observe, play, pause, step, reset, dispose,
  invalidCrop, missingAsset, load, cancelLoad,
  /** @param {Point} point */
  probe(point) { const s = session; return s ? sample(s, point) : null; },
  get canvas() { return canvas; } }), writable: false, configurable: false });
const requestedDelay = Number(new URL(location.href).searchParams.get('delayMS') ?? 0);
void load(Number.isFinite(requestedDelay) && requestedDelay >= 0 && requestedDelay <= 1000 ? requestedDelay : 0);
