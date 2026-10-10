import * as api from '@barocss/canvas2d';
import { LOGICAL_SIZE, createCurrentSVGFixture, applyCurrentSVGEdit,
  compareCurrentSVGSemantics, createTreeFromImportedSVG } from '../examples/canvas2d-scene/current-v29-svg-fixture.mjs';

const options = { logicalSize: LOGICAL_SIZE, dpr: 1 };
const status = document.querySelector('#status'), output = document.querySelector('#observation');
const fixture = createCurrentSVGFixture(api), sessions = [], subscriptions = [], urls = new Set();
let original, opened = null, ready = false, disposed = false, revision = 0, opens = 0, saves = 0;
let firstSVG = null, lastSVG = null, openedSVG = null, comparison = null, failure = null, refusal = null;
const pointerLog = [], lifecycle = { creates: 0, disposes: 0, binds: 0, unbinds: 0, uploads: 0 };

// Observe the real context's allocations; every wrapper calls the original WebGL method.
function trackContext(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true,
    antialias: false, preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw Error('WebGL2 unavailable');
  const resources = {}, errors = [];
  for (const name of ['Buffer', 'VertexArray', 'Shader', 'Program', 'Texture', 'Framebuffer', 'Renderbuffer']) {
    const live = new Set(), row = resources[name] = { created: 0, deleted: 0, live: 0 };
    const create = gl['create' + name].bind(gl), remove = gl['delete' + name].bind(gl);
    gl['create' + name] = (...args) => { const object = create(...args); if (object) { live.add(object); row.created++; row.live = live.size; } return object; };
    gl['delete' + name] = object => { remove(object); if (live.delete(object)) { row.deleted++; row.live = live.size; } };
  }
  function check() { const code = gl.getError(); if (code !== gl.NO_ERROR) errors.push(code); }
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  const info = { version: gl.getParameter(gl.VERSION), renderer: gl.getParameter(debug ? debug.UNMASKED_RENDERER_WEBGL : gl.RENDERER) };
  return { gl, resources, errors, check, info };
}
function pixels(session) {
  const { gl } = session.tracking;
  return fixture.samples.map(sample => {
    const x = Math.floor(sample.point.x), y = Math.floor(sample.point.y);
    const bytes = new Uint8Array(4);
    gl.readPixels(x, session.canvas.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
    return { ...sample, rgba: [...bytes], hit: session.renderer.hitTest(sample.point)?.id ?? null };
  });
}
function readSession(session) {
  if (!session) return null;
  if (session.disposed) return { ...session.final, disposed: true, resources: session.tracking.resources, errors: session.tracking.errors };
  const result = { scene: session.tree.snapshot(), samples: pixels(session), resources: session.tracking.resources,
    errors: session.tracking.errors, disposed: false };
  session.tracking.check();
  return result;
}
function makeSession(canvas, tree, name) {
  const tracking = trackContext(canvas);
  let renderer;
  try { renderer = api.createCanvas2D(canvas, options); renderer.updateScene(tree.snapshot()); renderer.render(); }
  catch (error) { renderer?.dispose(); tracking.check(); throw error; }
  const session = { canvas, tree, renderer, tracking, disposed: false, final: null, unbind: null };
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
function disposeSession(session) {
  if (!session || session.disposed) return;
  session.final = structuredClone(readSession(session));
  session.unbind(); session.renderer.dispose(); session.tracking.check();
  session.disposed = true; lifecycle.disposes++;
}
function observe() {
  return { ready, disposed, revision, opens, saves, firstSVG, lastSVG, openedSVG, comparison, failure, refusal,
    lifecycle: { ...lifecycle }, activeRenderers: sessions.filter(s => !s.disposed).length,
    pointers: [...pointerLog], original: readSession(original), opened: readSession(opened),
    contexts: sessions.map(s => ({ disposed: s.disposed, resources: s.tracking.resources, errors: s.tracking.errors, info: s.tracking.info })) };
}
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
  window.document.querySelector('#opened').replaceWith(canvas); opened = next;
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
    bytes.length === afterFrames[index].length && bytes.every((value, channel) => value === afterFrames[index][channel]));
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
function listen(target, name, handler) {
  target.addEventListener(name, handler); subscriptions.push(() => target.removeEventListener(name, handler));
}
function action(handler) { return () => { try { handler(); } catch (error) { failure = String(error); show('Operation failed'); } }; }
original = makeSession(document.querySelector('#original'), fixture.tree, 'original');
listen(document.querySelector('#save'), 'click', action(save));
listen(document.querySelector('#edit'), 'click', action(edit));
listen(document.querySelector('#refuse'), 'click', action(refuse));
listen(document.querySelector('#dispose'), 'click', dispose);
const input = document.querySelector('#open');
listen(document.querySelector('#open-button'), 'click', () => input.click());
listen(input, 'change', async () => {
  const file = input.files?.[0]; input.value = ''; if (!file) return;
  lifecycle.uploads++;
  try { await openText(await file.text()); } catch (error) { failure = String(error); show('Open refused'); }
});
listen(window, 'pagehide', dispose);
Object.assign(window, { __currentSVGConsumer: { observe, save, openText, edit, refuse, dispose } });
ready = true; document.documentElement.dataset.svgReady = 'ready'; show('Ready');
