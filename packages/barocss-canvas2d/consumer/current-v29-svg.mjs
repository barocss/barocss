// @ts-check
/** @typedef {import('@barocss/canvas2d').DisplayTree} Tree */
/** @typedef {Pick<import('@barocss/canvas2d').Canvas2DRenderer,'updateScene'|'render'|'dispose'|'hitTest'>} Renderer */
/** @typedef {{created:number,deleted:number,live:number}} Resource */
/** @typedef {{gl:WebGL2RenderingContext,resources:Record<string,Resource>,errors:number[],check:()=>void,info:{version:unknown,renderer:unknown}}} Tracking */
/** @typedef {{canvas:HTMLCanvasElement,tree:Tree,renderer:Renderer,tracking:Tracking,disposed:boolean,final:any,unbind:(()=>void)|null}} LegacySession */
/** @typedef {{canvas:HTMLCanvasElement,tree:Tree,renderer:Renderer,tracking:Tracking,disposed:boolean,finalFrame:number[]|null,unbind:()=>void}} LinearSession */
/** @template {Element} T @param {string} selector @returns {T} */
function element(selector) { const found=document.querySelector(selector);if(!found)throw Error('Missing '+selector);return /** @type {T} */(found); }
import * as api from '@barocss/canvas2d';
import { LOGICAL_SIZE, createCurrentSVGFixture, applyCurrentSVGEdit,
  compareCurrentSVGSemantics, createTreeFromImportedSVG } from '../examples/canvas2d-scene/current-v29-svg-fixture.mjs';

if (new URLSearchParams(location.search).get("linear") === "1") {
  await startLinearConsumer();
} else {
const options = { logicalSize: LOGICAL_SIZE, dpr: 1 };
const status = element('#status'), output = element('#observation');
const fixture = createCurrentSVGFixture(api);
/** @type {LegacySession[]} */ const sessions = [];
/** @type {(()=>void)[]} */ const subscriptions = [];
const urls = new Set();
/** @type {LegacySession} */ let original;
/** @type {LegacySession|null} */ let opened = null;
let ready = false, disposed = false, revision = 0, opens = 0, saves = 0;
/** @type {string|null} */ let firstSVG = null;
/** @type {string|null} */ let lastSVG = null;
/** @type {string|null} */ let openedSVG = null;
/** @type {unknown} */ let comparison = null;
/** @type {string|null} */ let failure = null;
/** @type {any} */ let refusal = null;
/** @type {{name:string,hit:string|null,trusted:boolean}[]} */ const pointerLog = [];
const lifecycle = { creates: 0, disposes: 0, binds: 0, unbinds: 0, uploads: 0 };

// Observe the real context's allocations; every wrapper calls the original WebGL method.
/** @param {HTMLCanvasElement} canvas */
function trackContext(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw Error('WebGL2 unavailable');
  /** @type {Record<string,Resource>} */ const resources = {};
    /** @type {number[]} */ const errors = [];
    const methods = /** @type {Record<string,(...args:any[])=>any>} */(/** @type {unknown} */(gl));
  for (const name of ['Buffer', 'VertexArray', 'Shader', 'Program', 'Texture', 'Framebuffer', 'Renderbuffer']) {
    const live = new Set(), row = resources[name] = { created: 0, deleted: 0, live: 0 };
    const create = methods['create' + name].bind(gl), remove = methods['delete' + name].bind(gl);
    methods['create' + name] = (...args) => { const object = create(...args); if (object) { live.add(object); row.created++; row.live = live.size; } return object; };
    methods['delete' + name] = object => { remove(object); if (live.delete(object)) { row.deleted++; row.live = live.size; } };
  }
  const checkedGL = gl;
  function check() { const code = checkedGL.getError(); if (code !== checkedGL.NO_ERROR) errors.push(code); }
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const info = { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
  return { gl, resources, errors, check, info };
}
/** @param {LegacySession} session */
function pixels(session) {
  const { gl } = session.tracking;
  return fixture.samples.map(sample => {
    const x = Math.floor(sample.point.x), y = Math.floor(sample.point.y);
    const bytes = new Uint8Array(4);
    gl.readPixels(x, session.canvas.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return { ...sample, rgba: [...bytes], hit: session.renderer.hitTest(sample.point)?.id ?? null };
  });
}
/** @param {LegacySession|null} session */
function readSession(session) {
  if (!session) return null;
  if (session.disposed) return { ...session.final, disposed: true, resources: session.tracking.resources, errors: session.tracking.errors };
  const result = { scene: session.tree.snapshot(), samples: pixels(session), resources: session.tracking.resources,
    errors: session.tracking.errors, disposed: false };
  session.tracking.check();
  return result;
}
/** @param {HTMLCanvasElement} canvas @param {Tree} tree @param {string} name */
function makeSession(canvas, tree, name) {
  const tracking = trackContext(canvas);
  let renderer;
  try { renderer = api.createCanvas2D(canvas, options); renderer.updateScene(tree.snapshot()); renderer.render(); }
  catch (error) { renderer?.dispose(); tracking.check(); throw error; }
  /** @type {LegacySession} */ const session = { canvas, tree, renderer, tracking, disposed: false, final: null, unbind: null };
  /** @param {PointerEvent} event */
  const onPointer = event => {
    if (disposed || session.disposed) return;
    const bounds = canvas.getBoundingClientRect();
    const point = { x: (event.clientX - bounds.left) * LOGICAL_SIZE.width / bounds.width,
      y: (event.clientY - bounds.top) * LOGICAL_SIZE.height / bounds.height };
    const hit = renderer.hitTest(point);
    tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit });
    pointerLog.push({ name, hit: hit?.id ?? null, trusted: event.isTrusted });
    show('Pointer dispatched');
  };
  canvas.addEventListener('pointerdown', onPointer); lifecycle.binds++;
  session.unbind = () => { canvas.removeEventListener('pointerdown', onPointer); lifecycle.unbinds++; };
  sessions.push(session); lifecycle.creates++;
  return session;
}
/** @param {LegacySession|null} session */
function disposeSession(session) {
  if (!session || session.disposed) return;
  session.final = structuredClone(readSession(session));
  session.unbind?.(); session.renderer.dispose(); session.tracking.check();
  session.disposed = true; lifecycle.disposes++;
}
function observe() {
  return { ready, disposed, revision, opens, saves, firstSVG, lastSVG, openedSVG, comparison, failure, refusal,
    lifecycle: { ...lifecycle }, activeRenderers: sessions.filter(s => !s.disposed).length,
    pointers: [...pointerLog], original: readSession(original), opened: readSession(opened),
    contexts: sessions.map(s => ({ disposed: s.disposed, resources: s.tracking.resources, errors: s.tracking.errors, info: s.tracking.info })) };
}
/** @param {string} message */
function show(message) {
  status.textContent = message;
  const state = observe();
  output.textContent = JSON.stringify({ ...state, firstSVG: firstSVG?.length, lastSVG: lastSVG?.length,
    openedSVG: openedSVG?.length, original: state.original && { ...state.original, scene: 'Retained tree' },
    opened: state.opened && { ...state.opened, scene: 'Retained tree' } }, null, 2);
}
function requireActive() { if (disposed) throw Error('Consumer disposed'); }
function save() {
  requireActive();
  const result = api.exportSceneSVG(original.tree.snapshot(), LOGICAL_SIZE);
  if (!result.ok) throw Error('Fixture export refused: ' + JSON.stringify(result.diagnostics));
  if (firstSVG === null) firstSVG = result.svg;
  lastSVG = result.svg; saves++;
  const url = URL.createObjectURL(new Blob([result.svg], { type: 'image/svg+xml' })); urls.add(url);
  const link = document.createElement('a'); link.href = url; link.download = `scene29-${revision}.svg`;
  link.click(); URL.revokeObjectURL(url); urls.delete(url);
  show('SVG downloaded');
  return result;
}
/** @param {string} text */
async function openText(text) {
  requireActive();
  if (new TextEncoder().encode(text).length > 1048576) throw Error('Host SVG input exceeds 1 MiB');
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw Error('Malformed SVG');
  const imported = api.importSVGElement(document.documentElement);
  const nextComparison = compareCurrentSVGSemantics(original.tree.snapshot(), imported.scene);
  const tree = createTreeFromImportedSVG(imported.scene, api);
  const canvas = window.document.createElement('canvas'); canvas.id = 'opened';
  const next = makeSession(canvas, tree, 'opened');
  const previous = opened;
  /** @type {HTMLCanvasElement} */(element('#opened')).replaceWith(canvas); opened = next;
  disposeSession(previous); openedSVG = text; comparison = nextComparison; opens++; failure = null;
  show('SVG opened in a new retained tree');
}
function edit() {
  requireActive(); applyCurrentSVGEdit(original.tree);
  original.renderer.updateScene(original.tree.snapshot()); original.renderer.render(); revision++;
  show('Original paint edited');
}
function refuse() {
  requireActive();
  const before = observe();
  /** @param {LegacySession|null} session */
  const readFull = session => {
    if (!session) return null;
    const bytes = new Uint8Array(session.canvas.width * session.canvas.height * 4);
    const gl = session.tracking.gl;
    gl.readPixels(0, 0, session.canvas.width, session.canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return bytes;
  };
  const beforeFrames = [readFull(original), readFull(opened)];
  const candidate = structuredClone(original.tree.snapshot());
  const group = candidate.nodes.find(node => node.kind === 'group');
  if (!group) throw Error('Fixture group missing');
  group.pivot = { x: 1, y: 0 };
  const result = api.exportSceneSVG(candidate, LOGICAL_SIZE);
  if (result.ok) throw Error('Unsupported nonzero pivot unexpectedly exported');
  const after = observe();
  const afterFrames = [readFull(original), readFull(opened)];
  const fullFramesEqual = beforeFrames.every((bytes, index) => bytes === null ? afterFrames[index] === null :
    bytes.length === afterFrames[index]?.length && bytes.every((value, channel) => value === afterFrames[index]?.[channel]));
  refusal = { diagnostics: result.diagnostics, candidateOnly: true, fullFrameBytes: beforeFrames.map(bytes => bytes?.length ?? 0), fullFramesEqual,
    retained: JSON.stringify(before.original) === JSON.stringify(after.original) &&
      JSON.stringify(before.opened) === JSON.stringify(after.opened) && before.firstSVG === after.firstSVG &&
      before.lastSVG === after.lastSVG && before.openedSVG === after.openedSVG };
  if (!refusal.retained || !fullFramesEqual) throw Error('Refusal changed an accepted frame/tree/file');
  show('Unsupported export refused; both accepted frames retained'); return refusal;
}
function dispose() {
  if (disposed) return;
  disposeSession(original); disposeSession(opened);
  for (const remove of subscriptions) remove();
  for (const url of urls) URL.revokeObjectURL(url); urls.clear();
  disposed = true; ready = false; document.documentElement.dataset.svgReady = 'disposed'; show('Disposed');
}
/** @param {EventTarget} target @param {string} name @param {EventListener} handler */
function listen(target, name, handler) {
  target.addEventListener(name, handler); subscriptions.push(() => target.removeEventListener(name, handler));
}
/** @param {()=>unknown} handler */
function action(handler) { return () => { try { handler(); } catch (error) { failure = String(error); show('Operation failed'); } }; }
original = makeSession(/** @type {HTMLCanvasElement} */(element('#original')), fixture.tree, 'original');
listen(element('#save'), 'click', action(save));
listen(element('#edit'), 'click', action(edit));
listen(element('#refuse'), 'click', action(refuse));
listen(element('#dispose'), 'click', dispose);
const input = /** @type {HTMLInputElement} */(element('#open'));
listen(element('#open-button'), 'click', () => input.click());
listen(input, 'change', async () => {
  const file = input.files?.[0]; input.value = ''; if (!file) return;
  lifecycle.uploads++;
  try { await openText(await file.text()); } catch (error) { failure = String(error); show('Open refused'); }
});
listen(window, 'pagehide', dispose);
Object.assign(window, { __currentSVGConsumer: { observe, save, openText, edit, refuse, dispose } });
ready = true; document.documentElement.dataset.svgReady = 'ready'; show('Ready');

}

async function startLinearConsumer() {
  const { serializeCanvasDocument, stageCanvasDocument } = await import('../dist/document.js');
  const size = { width: 320, height: 220 }, opts = { logicalSize: size, dpr: 1 };
  const pose = (x = 0, y = 0, scaleX = 1, scaleY = 1, rotation = 0) => ({ x, y, scaleX, scaleY, rotation });
  /** @param {number} w @param {number} h @returns {import('@barocss/canvas2d').PathCommand[]} */
  const box = (w, h) => [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: w, y: 0 },
    { kind: 'L', x: w, y: h }, { kind: 'L', x: 0, y: h }, { kind: 'Z' }];
  /** @type {import('@barocss/canvas2d').PathCommand[]} */ const commands = [...box(80, 40), { kind: 'M', x: 35, y: 15 }, { kind: 'L', x: 45, y: 15 },
    { kind: 'L', x: 45, y: 25 }, { kind: 'L', x: 35, y: 25 }, { kind: 'Z' }];
  /** @param {import('@barocss/canvas2d').Color} color @param {number} [end] @returns {Pick<Parameters<Tree['createPath']>[0],'commands'|'fill'>} */
  const paint = (color, end = 80) => ({ commands, fill: { rule: 'evenodd', linear: {
    from: { x: 0, y: 0 }, to: { x: end, y: 0 }, startColor: [1, 0, 0, 1], endColor: color } } });
  const tree = api.createDisplayTree('LinearSVGScene');
  tree.stage.addChild(tree.createPath({ id: 'Background', layer: 0, transform: pose(),
    commands: box(320, 220), fill: { rule: 'nonzero', color: [32 / 255, 40 / 255, 56 / 255, 1] } }));
  const group = tree.createContainer({ id: 'LinearGroup', layer: 1, transform: pose(15, 10), alpha: 0.5 });
  group.addChild(tree.createPath({ id: 'LinearPath', layer: 0, transform: pose(25, 20, 1.2, 0.8, Math.PI / 12), ...paint([0, 0, 1, 1]) }));
  tree.stage.addChild(group);
  tree.stage.addChild(tree.createPath({ id: 'C2DLinearGradient1', layer: 2, transform: pose(220, 130),
    commands: box(45, 35), fill: { rule: 'nonzero', color: [0, 1, 0, 1] } }));
  let disposed = false;
  /** @type {LinearSession} */ let original;
  /** @type {LinearSession|null} */ let restored = null;
  /** @type {Tree|null} */ let draft = null;
  /** @type {string|null} */ let nativeText = null;
  /** @type {string|null} */ let nativeURL = null;
  let linearExports = 0;
  let svgSaves = 0, jsonSaves = 0, nativeOpens = 0, jsonOpens = 0, originalEdits = 0, restoredEdits = 0;
  /** @type {any} */ let refusal = null;
  /** @type {string|null} */ let failure = null;
  /** @type {string|null} */ let lastSVG = null;
  /** @type {string|null} */ let lastDocument = null;
  /** @type {number[]|null} */ let nativePixels = null;
  /** @type {LinearSession[]} */ const sessions = [];
  /** @type {Tracking[]} */ const contexts = [];
  /** @type {{name:string,point:import('@barocss/canvas2d').Point,hit:string|null,trusted:boolean}[]} */ const pointers = [];
  /** @type {(()=>void)[]} */ const subscriptions = [];
  const urls = new Set();
  const lifecycle = { creates: 0, disposes: 0, binds: 0, unbinds: 0, svgUploads: 0, jsonUploads: 0 };
  const status = element('#status'), output = element('#observation');
  const nativeImage = /** @type {HTMLImageElement} */(element('#native-svg')), scratch = document.createElement('canvas');
  const active = () => { if (disposed) throw Error('Consumer disposed'); };
  /** @param {HTMLCanvasElement} canvas @returns {Tracking} */
  function track(canvas) {
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false,
      preserveDrawingBuffer: true, stencil: true });
    if (!gl) throw Error('WebGL2 unavailable');
    /** @type {Record<string,Resource>} */ const resources = {};
    /** @type {number[]} */ const errors = [];
    const methods = /** @type {Record<string,(...args:any[])=>any>} */(/** @type {unknown} */(gl));
    for (const name of ['Buffer', 'VertexArray', 'Shader', 'Program', 'Texture', 'Framebuffer', 'Renderbuffer']) {
      const live = new Set(), row = resources[name] = { created: 0, deleted: 0, live: 0 };
      const create = methods['create' + name].bind(gl), remove = methods['delete' + name].bind(gl);
      methods['create' + name] = (...args) => { const object = create(...args); if (object) { live.add(object); row.created++; row.live = live.size; } return object; };
      methods['delete' + name] = object => { remove(object); if (live.delete(object)) { row.deleted++; row.live = live.size; } };
    }
    const check = () => { const code = gl.getError(); if (code !== gl.NO_ERROR) errors.push(code); };
    const debug = gl.getExtension('WEBGL_debug_renderer_info');
    const tracking = { gl, resources, errors, check, info: { version: gl.getParameter(gl.VERSION),
      renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) } };
    contexts.push(tracking); return tracking;
  }
  /** @param {LinearSession} session @returns {number[]} */
  function fullFrame(session) {
    if (session.disposed) return [...(session.finalFrame ?? [])];
    const bytes = new Uint8Array(size.width * size.height * 4), gl = session.tracking.gl;
    gl.readPixels(0, 0, size.width, size.height, gl.RGBA, gl.UNSIGNED_BYTE, bytes); session.tracking.check();
    return [...bytes];
  }
  /** @param {LinearSession} session @param {string} name */
  function bind(session, name) {
    /** @param {PointerEvent} event */
    const handler = event => {
      if (disposed || session.disposed) return;
      const rect = session.canvas.getBoundingClientRect();
      const point = { x: (event.clientX - rect.left) * size.width / rect.width,
        y: (event.clientY - rect.top) * size.height / rect.height };
      const hit = session.renderer.hitTest(point);
      session.tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point, hit });
      pointers.push({ name, point, hit: hit?.id ?? null, trusted: event.isTrusted }); show('Pointer dispatched');
    };
    session.canvas.addEventListener('pointerdown', handler); lifecycle.binds++;
    let done = false;
    session.unbind = () => { if (done) return; done = true;
      session.canvas.removeEventListener('pointerdown', handler); lifecycle.unbinds++; };
  }
  /** @param {HTMLCanvasElement} canvas @param {Tree} nextTree @param {string} name @param {Renderer|null} [preparedRenderer] @param {Tracking} [tracking] @returns {LinearSession} */
  function admit(canvas, nextTree, name, preparedRenderer = null, tracking = track(canvas)) {
    let renderer = preparedRenderer;
    try { renderer ??= api.createCanvas2D(canvas, opts); renderer.updateScene(nextTree.snapshot()); renderer.render(); }
    catch (error) { renderer?.dispose(); tracking.check(); throw error; }
    /** @type {LinearSession} */ const session = { canvas, tree: nextTree, renderer, tracking, disposed: false, unbind: () => {}, finalFrame: null };
    sessions.push(session); lifecycle.creates++; bind(session, name); return session;
  }
  /** @param {LinearSession|null} session */
  function close(session) {
    if (!session || session.disposed) return;
    session.finalFrame = fullFrame(session); session.unbind?.(); session.renderer.dispose(); session.tracking.check();
    session.disposed = true; lifecycle.disposes++;
  }
  /** @param {LinearSession|null} session */
  function read(session) {
    return session && { scene: session.tree.snapshot(), canonical: api.stringifySceneJSON(session.tree.snapshot()),
      disposed: session.disposed, resources: session.tracking.resources, errors: session.tracking.errors };
  }
  function observe() {
    return { mode: 'linear', ready: !disposed, disposed, linearExports, svgSaves, jsonSaves, nativeOpens, jsonOpens,
      originalEdits, restoredEdits, lastSVG, lastDocument, nativeText, nativePixels, refusal, failure,
      draft: draft?.snapshot() ?? null, lifecycle: { ...lifecycle }, pointers: [...pointers],
      original: read(original), restored: read(restored), activeRenderers: sessions.filter(s => !s.disposed).length,
      scratch: { width: scratch.width, height: scratch.height }, activeURLs: urls.size,
      contexts: contexts.map(tracking => ({ resources: tracking.resources, errors: tracking.errors, info: tracking.info })) };
  }
  /** @param {string} message */
  function show(message) {
    status.textContent = message; const state = observe();
    output.textContent = JSON.stringify({ ...state, lastSVG: lastSVG?.length, lastDocument: lastDocument?.length,
      nativeText: nativeText?.length, nativePixels: nativePixels ? 'Native image pixels retained' : null,
      original: state.original && { ...state.original, scene: 'Retained tree', canonical: 'Canonical Scene29' },
      restored: state.restored && { ...state.restored, scene: 'Retained tree', canonical: 'Canonical Scene29' } }, null, 2);
  }
  /** @param {string} text @param {string} type @param {string} filename */
  function download(text, type, filename) {
    const url = URL.createObjectURL(new Blob([text], { type })); urls.add(url);
    const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
    URL.revokeObjectURL(url); urls.delete(url);
  }
  function editOriginal() {
    active(); const path = original.tree.get('LinearPath');
    if (path?.kind !== 'path') throw Error('LinearPath missing');
    path.setPath(paint([0, 1, 0, 1])); original.renderer.updateScene(original.tree.snapshot()); original.renderer.render();
    originalEdits++; show('Original gradient changed to green');
  }
  function saveSVG() {
    active(); linearExports++; const result = api.exportSceneLinearSVG(original.tree.snapshot(), size);
    if (!result.ok) throw Error('Linear export refused: ' + JSON.stringify(result.diagnostics));
    lastSVG = result.svg; svgSaves++; download(lastSVG, 'image/svg+xml', 'linear-scene.svg'); show('Linear SVG downloaded'); return result;
  }
  /** @param {string} text */
  async function openNativeText(text) {
    active(); if (new TextEncoder().encode(text).length > 1048576) throw Error('SVG exceeds 1 MiB');
    const parsed = new DOMParser().parseFromString(text, 'image/svg+xml');
    if (parsed.querySelector('parsererror')) throw Error('Malformed SVG');
    if (parsed.querySelector('script,image,foreignObject') || [...parsed.querySelectorAll('*')].some(element =>
      [...element.attributes].some(attr => /href|^on/i.test(attr.name)))) throw Error('External SVG content refused');
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' })); urls.add(url);
    nativeImage.src = url;
    let failed = false;
    try { await nativeImage.decode(); active(); scratch.width = size.width; scratch.height = size.height;
      const context = scratch.getContext('2d'); if (!context) throw Error('2D unavailable');
      context.drawImage(nativeImage, 0, 0, size.width, size.height);
      nativePixels = [...context.getImageData(0, 0, size.width, size.height).data];
      } catch (error) { failed = true; URL.revokeObjectURL(url); urls.delete(url); throw error; }
    finally { let cleanupError;
      try { scratch.width = 0; } catch (error) { cleanupError = error; }
      try { scratch.height = 0; } catch (error) { cleanupError ??= error; }
      if (!failed && cleanupError) throw cleanupError;
    }
    if (nativeURL) { URL.revokeObjectURL(nativeURL); urls.delete(nativeURL); }
    nativeURL = url; nativeText = text; nativeOpens++; show('Native SVG file displayed');
  }
  async function saveJSON() {
    active(); const text = await serializeCanvasDocument(original.tree.snapshot(), () => null); active();
    lastDocument = text; jsonSaves++; download(text, 'application/json', 'linear-scene-document.json'); show('Scene29 document downloaded'); return text;
  }
  /** @param {string} text */
  async function openJSONText(text) {
    active(); const canvas = document.createElement('canvas'); canvas.id = 'opened'; const tracking = track(canvas);
    const staged = await stageCanvasDocument(text, canvas, opts);
    if (disposed) { staged.renderer.dispose(); tracking.check(); throw Error('Consumer disposed'); }
    let next;
    try { const nextTree = api.createDisplayTreeFromScene(staged.scene);
      const found = nextTree.get('LinearPath'); if (found?.kind !== 'path') throw Error('LinearPath missing');
      next = admit(canvas, nextTree, 'restored', staged.renderer, tracking);
    } catch (error) { staged.renderer.dispose(); tracking.check(); throw error; }
    const previous = restored; /** @type {HTMLCanvasElement} */(element('#opened')).replaceWith(canvas); restored = next; close(previous);
    jsonOpens++; show('Fresh editable Scene29 document opened');
  }
  function editRestored() {
    active(); const path = restored?.tree.get('LinearPath'); if (path?.kind !== 'path') throw Error('Restored LinearPath missing');
    path.setPath(paint([0, 0, 1, 1], 100)); if (!restored) throw Error("Restored session missing"); restored.renderer.updateScene(restored.tree.snapshot()); restored.renderer.render();
    restoredEdits++; show('Restored gradient endpoint and blue stop edited');
  }
  function refuseRadial() {
    active(); const before = api.stringifySceneJSON(original.tree.snapshot()), frame = fullFrame(original);
    const originalTree = original.tree, originalRenderer = original.renderer;
    draft = api.createDisplayTreeFromScene(original.tree.snapshot()); const path = draft.get('LinearPath');
    if (path?.kind !== 'path') throw Error('Draft LinearPath missing');
    path.setPath({ commands: path.data.commands, fill: { rule: 'evenodd', radial: {
      center: { x: 40, y: 20 }, radius: 20, startColor: [1, 0, 0, 1], endColor: [0, 0, 1, 1] } } });
    linearExports++; const result = api.exportSceneLinearSVG(draft.snapshot(), size);
    if (result.ok) throw Error('Radial draft unexpectedly exported');
    const after = fullFrame(original);
    refusal = { diagnostics: result.diagnostics, retained: before === api.stringifySceneJSON(original.tree.snapshot()),
      identitiesRetained: original.tree === originalTree && original.renderer === originalRenderer,
      fullFrameBytes: frame.length, fullFrameEqual: frame.every((value, index) => value === after[index]), draftRetained: !!draft.get('LinearPath') };
    if (!refusal.retained || !refusal.fullFrameEqual || !refusal.identitiesRetained) throw Error('Radial refusal changed accepted scene');
    show('Radial export refused; accepted linear scene and draft retained'); return refusal;
  }
  function dispose() {
    if (disposed) return; close(original); close(restored); disposed = true;
    for (const remove of subscriptions) remove();
    for (const url of urls) URL.revokeObjectURL(url); urls.clear(); nativeURL = null;
    nativeImage.removeAttribute('src'); scratch.width = 0; scratch.height = 0;
    for (const control of document.querySelectorAll('button,input')) /** @type {HTMLButtonElement|HTMLInputElement} */(control).disabled = true;
    document.documentElement.dataset.svgReady = 'disposed'; show('Disposed');
  }
  /** @param {EventTarget} element @param {string} type @param {EventListener} handler */
  function listen(element, type, handler) { element.addEventListener(type, handler);
    subscriptions.push(() => element.removeEventListener(type, handler)); }
  /** @param {()=>unknown} handler */
  const action = handler => () => { void Promise.resolve().then(async () => { await handler(); }).catch(error => {
    failure = String(error); show('Operation refused'); }); };
  original = admit(/** @type {HTMLCanvasElement} */(element('#original')), tree, 'original');
  listen(element('#save'), 'click', action(saveSVG));
  listen(element('#edit'), 'click', action(editOriginal));
  listen(element('#refuse'), 'click', action(refuseRadial));
  listen(element('#save-json'), 'click', action(saveJSON));
  listen(element('#edit-restored'), 'click', action(editRestored));
  listen(element('#dispose'), 'click', dispose);
  const svgInput = /** @type {HTMLInputElement} */(element('#open')), jsonInput = /** @type {HTMLInputElement} */(element('#open-json'));
  listen(element('#open-button'), 'click', () => svgInput.click());
  listen(element('#open-json-button'), 'click', () => jsonInput.click());
  listen(svgInput, 'change', action(async () => { const file = svgInput.files?.[0]; svgInput.value = ''; if (!file) return;
    lifecycle.svgUploads++; await openNativeText(await file.text()); }));
  listen(jsonInput, 'change', action(async () => { const file = jsonInput.files?.[0]; jsonInput.value = ''; if (!file) return;
    lifecycle.jsonUploads++; await openJSONText(await file.text()); }));
  listen(window, 'pagehide', dispose);
  Object.assign(window, { __svgLinearConsumer: { observe, saveSVG, openNativeText, saveJSON, openJSONText,
    editOriginal, editRestored, refuseRadial, fullFrame, dispose,
    get original() { return original; }, get restored() { return restored; }, get draft() { return draft; },
    get nativeImage() { return nativeImage; }, get scratch() { return scratch; } } });
  document.documentElement.dataset.svgReady = 'ready'; show('Linear SVG ready');
}
