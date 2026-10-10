// @ts-check
import { createCanvas2DApplication, createDisplayTree, stringifySceneJSON } from '@barocss/canvas2d';
import { parseCanvasDocument, serializeCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';
/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {{token:number,callback:(timestampMS:number)=>void}} Scheduled */
/** @typedef {{timestampMS:number,nextToken:number,pending:Scheduled|null}} Clock */
/** @typedef {{canvas:HTMLCanvasElement,app:import('@barocss/canvas2d').Canvas2DApplication,
 * rect:import('@barocss/canvas2d').RectHandle,sprite:import('@barocss/canvas2d').SpriteHandle,
 * glyph:import('@barocss/canvas2d').GlyphRunHandle,group:import('@barocss/canvas2d').ContainerHandle,
 * frame:import('@barocss/canvas2d').FrameHandle,assets:Map<string,import('@barocss/canvas2d').ImageAssetInput>,
 * scene:import('@barocss/canvas2d').Scene|null,clock:Clock,generation:number,
 * before:{running:boolean,treeScene:string,ids:string[],hit:string|null,assetCount:number},unbind:()=>void}} Session */
const contextId = 'InitialSceneConsumer';
const rendererOptions = { logicalSize: { width: 320, height: 200 }, dpr: 2 };
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) => ({ x, y, scaleX: 1, scaleY: 1, rotation: 0 });
const spriteAsset = { width: 2, height: 2, pixels: new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 255, 255, 0, 255, 0, 255]) };
const white = new Uint8Array(64);
for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (x === 0 || x === 3 || y === 2) white.fill(255, (y * 4 + x) * 4, (y * 4 + x) * 4 + 4);
const glyphAsset = { width: 4, height: 4, pixels: white };
const sourceAssets = new Map([['SpriteAtlas', spriteAsset], ['GlyphAtlas', glyphAsset]]);
const authored = createDisplayTree(contextId);
authored.stage.addChild(authored.createRect({ id: 'Back', layer: 0, transform: pose(), width: 320, height: 200, fill: [0.2, 0.2, 0.2, 1] }));
const frame = authored.createFrame({ id: 'Frame', layer: 1, transform: { ...pose(25, 20), rotation: 0.08 },
  width: 260, height: 150, fill: [0, 0, 0, 0], clip: true });
const group = authored.createContainer({ id: 'Group', layer: 0, transform: pose(10, 10), mask: { commands: [
  { kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 220, y: 0 }, { kind: 'L', x: 220, y: 85 },
  { kind: 'L', x: 140, y: 85 }, { kind: 'L', x: 140, y: 140 }, { kind: 'L', x: 0, y: 140 }, { kind: 'Z' }] } });
group.addChild(authored.createRect({ id: 'Rect', layer: 0, transform: pose(10, 20), width: 14, height: 24, fill: [1, 0.5, 0, 1] }));
group.addChild(authored.createSprite({ id: 'Sprite', layer: 1, transform: pose(160, 20), width: 40, height: 40,
  imageId: 'SpriteAtlas', opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 }));
group.addChild(authored.createGlyphRun({ id: 'Glyph', layer: 2, transform: pose(80, 20), atlasId: 'GlyphAtlas', text: 'H',
  baseline: 0, opacity: 1, sampling: 'nearest', glyphs: [{ sourceRect: { x: 0, y: 0, width: 4, height: 4 },
    x: 0, y: 0, width: 24, height: 24, textStart: 0, textEnd: 1 }] }));
frame.addChild(group); authored.stage.addChild(frame);
const initialInput = authored.snapshot();
const initialCanonical = stringifySceneJSON(initialInput);
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
/** @type {Session|null} */ let session = null;
/** @type {Session|null} */ let staged = null;
let requestedGeneration = 1;
let disposed = false;
/** @type {WEBGL_lose_context|null} */ let contextExtension = null;
/** @type {ReturnType<typeof liveObservation>|null} */ let terminal = null;
/** @type {{code:string,retained:boolean}|null} */ let failure = null;
/** @type {{sceneEqual:boolean,idsEqual:boolean,bytesEqual:boolean,samplesEqual:boolean}|null} */ let opened = null;
/** @type {{filename:string,byteLength:number}|null} */ let saved = null;
/** @type {{width:number,height:number,byteLength:number}|null} */ let png = null;
/** @type {boolean|null} */ let inputIndependent = null;
/** @type {(()=>void)[]} */ const hostUnbind = [];
/** @type {string[]} */ const log = [];
/** @type {import('@barocss/canvas2d').TickInfo[]} */ const ticks = [];
/** @type {'open'|'png'|null} */ let temporary = null;
/** @type {(()=>void)[]} */ const waiters = [];
const counts = { appsCreated: 0, appsDisposed: 0, liveApps: 0, maxLiveApps: 0, assetRegistrations: 0,
  renderAttempts: 0, manualAdmissions: 0, automaticFrames: 0, requests: 0, cancels: 0, steps: 0,
  pointerEvents: 0, bindings: 0, unbindings: 0, errors: 0, ignored: 0, pngCanvases: 0, contextLosses: 0, contextRestores: 0, disposeCalls: 0 };
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @param {unknown} error */
function codeOf(error) { return error instanceof Error && 'code' in error ? String(error.code) : error instanceof Error ? error.name : String(error); }
/** @param {number} token */
function current(token) { return !disposed && token === requestedGeneration; }
/** @param {import('@barocss/canvas2d').DisplayHandle} handle @returns {string[]} */
function ids(handle) { return [handle.id, ...('children' in handle ? handle.children.flatMap(ids) : [])]; }
/** @param {Session} s @param {Point} point */
function sample(s, point) {
  const hit = s.app.renderer.hitTest(point)?.id ?? null;
  const gl = s.canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable'); const bytes = new Uint8Array(4);
  if (gl.isContextLost()) return { point, rgba: null, hit };
  gl.readPixels(Math.floor(point.x * 2), s.canvas.height - Math.floor(point.y * 2) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return { point, rgba: [...bytes], hit };
}
/** @param {Session} s */
function pointsFor(s) {
  const local = (/** @type {Point} */ point) => s.app.renderer.worldToViewport(s.group.toWorld(point));
  return { rectOld: local({ x: 15, y: 30 }), rectNext: local({ x: 25, y: 30 }), rectThird: local({ x: 35, y: 30 }),
    rectCurrent: local({ x: s.rect.data.transform.x + 5, y: 30 }), spriteRed: local({ x: s.sprite.data.transform.x + 10, y: s.sprite.data.transform.y + 10 }),
    spriteTransparent: local({ x: s.sprite.data.transform.x + 30, y: s.sprite.data.transform.y + 10 }),
    spriteBlue: local({ x: s.sprite.data.transform.x + 10, y: s.sprite.data.transform.y + 30 }),
    glyphOpaque: local({ x: 83, y: 29 }), glyphTransparent: local({ x: 89, y: 23 }), notch: local({ x: 180, y: 115 }), background: { x: 10, y: 10 } };
}
/** @param {Session} s */
function samplesFor(s) { return Object.fromEntries(Object.entries(pointsFor(s)).map(([key, point]) => [key, sample(s, point)])); }
/** @param {Session} s */
function liveObservation(s) {
  const assetBytes = Object.fromEntries([...s.assets.keys()].sort().map(id => [id, [...(s.app.renderer.getImageAsset(id)?.pixels ?? [])]]));
  return { generation: s.generation, running: s.app.running, pendingToken: s.clock.pending?.token ?? null, beforeAdmission: s.before,
    scene: s.scene && stringifySceneJSON(s.scene), treeScene: stringifySceneJSON(s.app.tree.snapshot()), version: s.app.tree.snapshot().version,
    ids: s.app.tree.stage.children.flatMap(ids), rect: s.rect.data, sprite: s.sprite.data, mask: s.group.data.mask,
    assetBytes, points: pointsFor(s), samples: samplesFor(s), contextLost: !!s.canvas.getContext('webgl2')?.isContextLost() };
}
function observe() { return { disposed, requestedGeneration, counts: { ...counts }, initialCanonical, inputIndependent,
  failure, opened, saved, png, temporary, ticks: ticks.map(info => ({ ...info })), log: [...log],
  accepted: session ? liveObservation(session) : terminal, candidate: staged ? liveObservation(staged) : null }; }
function show(/** @type {string} */ message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2);
  for (const button of Array.from(document.querySelectorAll('button'))) button.disabled = disposed; input.disabled = disposed; }
function fingerprint() { return JSON.stringify(session ? liveObservation(session) : null); }
/** @param {unknown} error @param {string} before */
function refused(error, before) { counts.errors++; failure = { code: codeOf(error), retained: fingerprint() === before }; show(`Refused ${failure.code}`); return failure; }
/** @param {Session} s */
function retire(s) { s.unbind(); s.app.dispose(); counts.appsDisposed++; counts.liveApps--; }
function discardCandidate() { if (staged) { retire(staged); staged = null; } }
/** @param {HTMLCanvasElement} target @param {import('@barocss/canvas2d').Scene} source @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} assets @param {number} generation */
function createSession(target, source, assets, generation) {
  /** @type {Clock} */ const clock = { timestampMS: 0, nextToken: 0, pending: null };
  /** @type {import('@barocss/canvas2d').FrameScheduler} */ const scheduler = {
    requestFrame(callback) { if (clock.pending) throw new Error('One pending controlled frame expected');
      const token = ++clock.nextToken; clock.pending = { token, callback }; counts.requests++; return token; },
    cancelFrame(token) { const pending = clock.pending; if (pending && pending.token === token) clock.pending = null; counts.cancels++; },
  };
  const app = createCanvas2DApplication(target, { contextId, renderer: rendererOptions, scheduler, autoStart: false, initialScene: source });
  counts.appsCreated++; counts.liveApps++; counts.maxLiveApps = Math.max(counts.maxLiveApps, counts.liveApps);
  try {
    const rect = app.tree.get('Rect'), sprite = app.tree.get('Sprite'), glyph = app.tree.get('Glyph'), group = app.tree.get('Group'), frame = app.tree.get('Frame');
    if (rect?.kind !== 'rect' || sprite?.kind !== 'sprite' || glyph?.kind !== 'glyphRun' || group?.kind !== 'container' || frame?.kind !== 'frame') throw new Error('Initial fixture topology differs');
    /** @type {Session} */ const s = { canvas: target, app, rect, sprite, glyph, group, frame, assets, scene: null, clock, generation,
      before: { running: app.running, treeScene: stringifySceneJSON(app.tree.snapshot()), ids: app.tree.stage.children.flatMap(ids),
        hit: app.renderer.hitTest({ x: 60, y: 60 })?.id ?? null, assetCount: [...assets.keys()].filter(id => app.renderer.getImageAsset(id)).length }, unbind: () => {} };
    const removeUpdate = app.onUpdate(info => { log.push(`update:${info.frame}:delta=${info.deltaMS}`); ticks.push(info);
      s.rect.setPosition(s.rect.data.transform.x >= 60 ? 10 : s.rect.data.transform.x + 10, 20); });
    const removeRaw = app.ticker.onTick(info => { s.scene = app.tree.snapshot(); counts.automaticFrames++; log.push(`after-render:${info.frame}:Rect=${s.rect.data.transform.x}`); }, -100);
    /** @type {(()=>void)[]} */ const listeners = [removeUpdate, removeRaw];
    for (const id of ['Back', 'Frame', 'Group', 'Rect', 'Sprite', 'Glyph']) { const handle = app.tree.get(id);
      if (handle) listeners.push(handle.onPointer('pointerdown', event => log.push(`g${s.generation}:${id}:${event.target?.id}`))); }
    listeners.push(app.tree.stage.onPointer('pointerdown', event => log.push(`g${s.generation}:stage:${event.target?.id ?? 'none'}`)));
    const onPointer = (/** @type {PointerEvent} */ event) => { if (disposed || session !== s) return; counts.pointerEvents++;
      const bounds = target.getBoundingClientRect(); const point = { x: (event.clientX - bounds.left) * 320 / bounds.width, y: (event.clientY - bounds.top) * 200 / bounds.height };
      app.tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point: app.renderer.viewportToWorld(point), hit: app.renderer.hitTest(point) }); show('Forwarded real pointerdown to the copied tree'); };
    const onLoss = (/** @type {Event} */ event) => { event.preventDefault(); if (session === s && !disposed) { counts.contextLosses++; show('Context lost; pixel readback is unavailable'); } };
    const onRestore = () => { if (session === s && !disposed) { counts.contextRestores++; app.renderer.render(); show('Context restored; current samples are shown'); } };
    target.addEventListener('pointerdown', onPointer); target.addEventListener('webglcontextlost', onLoss); target.addEventListener('webglcontextrestored', onRestore);
    counts.bindings++; let detached = false;
    s.unbind = () => { if (detached) return; detached = true; counts.unbindings++; for (const stop of listeners) stop();
      target.removeEventListener('pointerdown', onPointer); target.removeEventListener('webglcontextlost', onLoss); target.removeEventListener('webglcontextrestored', onRestore); };
    return s;
  } catch (error) { app.dispose(); counts.appsDisposed++; counts.liveApps--; throw error; }
}
/** @param {Session} s @param {string|null} omit */
function registerAssets(s, omit = null) { for (const [id, asset] of s.assets) if (id !== omit && !s.app.renderer.getImageAsset(id)) {
  s.app.renderer.setImageAsset(id, asset); counts.assetRegistrations++; } }
/** @param {Session} s */
function admit(s) { counts.renderAttempts++; s.app.render(); s.scene = s.app.tree.snapshot(); counts.manualAdmissions++; }
/** @param {Session} next */
function adopt(next) { const old = session; canvas.replaceWith(next.canvas); canvas = next.canvas; session = next; contextExtension = null;
  if (old) retire(old); failure = null; }
function register() { const s = session; if (!s || disposed) return; requestedGeneration++; discardCandidate(); const before = fingerprint();
  try { registerAssets(s); admit(s); show('Registered both atlases and manually admitted the restored tree'); } catch (error) { refused(error, before); } }
function start() { if (!session || disposed) return; session.app.start(); show('Queued one controlled frame'); }
function stop() { if (!session || disposed) return; session.app.stop(); show('Stopped controlled scheduling'); }
function step() { const s = session; if (!s || disposed || !s.clock.pending) return; requestedGeneration++; discardCandidate(); const before = fingerprint();
  const scheduled = s.clock.pending; s.clock.pending = null; s.clock.timestampMS += 16; counts.steps++;
  try { scheduled.callback(s.clock.timestampMS); show('Delivered update, then automatic admission/render'); } catch (error) { refused(error, before); } }
function editRestored() { const s = session; if (!s || disposed || !s.scene) return false; requestedGeneration++; discardCandidate(); const before = fingerprint();
  try { s.rect.setPosition(s.rect.data.transform.x + 5, 20); s.rect.setRect({ width: 14, height: 24, fill: [0, 1, 0, 1] });
    s.sprite.setPosition(s.sprite.data.transform.x + 5, s.sprite.data.transform.y + 5); admit(s); show('Edited the owned Rect and Sprite handles'); return true;
  } catch (error) { refused(error, before); return false; } }
function missingCandidate() { const s = session; if (!s || disposed || !s.scene || temporary) return; discardCandidate(); const token = ++requestedGeneration, before = fingerprint();
  const target = document.createElement('canvas'); target.id = 'scene'; staged = createSession(target, s.scene, s.assets, token);
  try { registerAssets(staged, 'GlyphAtlas'); admit(staged); show('Candidate unexpectedly admitted without the glyph atlas'); }
  catch (error) { refused(error, before); } return failure; }
function repairCandidate() { if (!staged || disposed || staged.generation !== requestedGeneration) return false; const next = staged, before = fingerprint();
  try { registerAssets(next); admit(next); staged = null; adopt(next); show('Repaired the host candidate, then swapped the stopped Application'); return true; }
  catch (error) { refused(error, before); return false; } }
function releaseTemporary() { temporary = null; for (const resolve of waiters.splice(0)) resolve(); }
/** @param {number} token @param {'open'|'png'} operation */
async function acquireTemporary(token, operation) { while (temporary && current(token)) await new Promise(resolve => waiters.push(() => resolve(undefined)));
  if (!current(token)) return false; temporary = operation; return true; }
/** @param {string} text @param {number|null} reservedToken */
async function openText(text, reservedToken = null) { if (disposed) return; discardCandidate(); const token = reservedToken ?? ++requestedGeneration;
  if (!current(token)) { counts.ignored++; return; } const before = fingerprint(), previous = session; let acquired = false;
  /** @type {Session|null} */ let next = null;
  try { const parsed = await parseCanvasDocument(text); if (!current(token)) { counts.ignored++; return; }
    if (parsed.assets.size !== 2 || !parsed.assets.has('SpriteAtlas') || !parsed.assets.has('GlyphAtlas')) throw new Error('Fixture requires two atlases');
    acquired = await acquireTemporary(token, 'open'); if (!acquired || !current(token)) { counts.ignored++; return; }
    const target = document.createElement('canvas'); target.id = 'scene'; next = createSession(target, parsed.scene, parsed.assets, token);
    registerAssets(next); admit(next); const prior = previous && liveObservation(previous), now = liveObservation(next);
    opened = { sceneEqual: !!prior && prior.scene === now.scene, idsEqual: !!prior && JSON.stringify(prior.ids) === JSON.stringify(now.ids),
      bytesEqual: !!prior && JSON.stringify(prior.assetBytes) === JSON.stringify(now.assetBytes), samplesEqual: !!prior && JSON.stringify(prior.samples) === JSON.stringify(now.samples) };
    adopt(next); releaseTemporary(); acquired = false; show('Opened bytes into a fresh stopped Application and copied tree');
  } catch (error) { if (next && session !== next) retire(next); if (current(token)) refused(error, before); else counts.ignored++; }
  finally { if (acquired) releaseTemporary(); } }
/** @param {Session} s */
function serialize(s) { if (!s.scene) throw new Error('No accepted Scene to save'); return serializeCanvasDocument(s.scene, id => s.app.renderer.getImageAsset(id)); }
/** @param {Blob} blob @param {string} filename */
function download(blob, filename) { const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function save() { const s = session; if (!s || disposed || !s.scene) return; const token = requestedGeneration;
  const text = await serialize(s); if (!current(token) || session !== s) return; const filename = 'initial-scene-document.json';
  download(new Blob([text], { type: 'application/json' }), filename); saved = { filename, byteLength: new TextEncoder().encode(text).length }; show('Saved accepted Scene and all atlas bytes'); return text; }
async function exportPNG() { const s = session; if (!s || disposed || !s.scene || staged) return; const token = requestedGeneration; let acquired = false;
  try { const text = await serialize(s); if (!current(token) || session !== s) return; acquired = await acquireTemporary(token, 'png'); if (!acquired || !current(token)) return;
    const result = await exportCanvasDocumentPNG(text, rendererOptions, () => { if (!current(token)) throw new Error('PNG canceled'); counts.pngCanvases++; return document.createElement('canvas'); });
    if (!current(token) || session !== s) return; releaseTemporary(); acquired = false; download(result.blob, 'initial-scene.png');
    png = { width: result.backingSize.width, height: result.backingSize.height, byteLength: result.blob.size }; show('Exported the accepted v1 document to PNG'); return png;
  } catch (error) { if (current(token)) show(`PNG failed: ${codeOf(error)}`); } finally { if (acquired) releaseTemporary(); } }
function loseContext() { if (!session || disposed) return false; contextExtension = session.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context') ?? null;
  if (!contextExtension) return false; contextExtension.loseContext(); return true; }
function restoreContext() { if (disposed || !contextExtension) return false; contextExtension.restoreContext(); return true; }
function dispose() { counts.disposeCalls++; if (disposed) return; const s = session; if (s) { terminal = liveObservation(s); retire(s); } discardCandidate();
  session = null; disposed = true; requestedGeneration++; for (const resolve of waiters.splice(0)) resolve(); for (const stop of hostUnbind.splice(0)) stop(); show('Disposed owned Applications and host listeners'); }
const actions = { register, start, step, stop, edit: editRestored, missing: missingCandidate, repair: repairCandidate, discard: () => { discardCandidate(); show('Discarded host candidate'); },
  save: () => { void save().catch(error => show(`Save failed: ${codeOf(error)}`)); }, png: () => { void exportPNG(); }, lose: loseContext, restore: restoreContext, dispose };
for (const [id, action] of Object.entries(actions)) { const button = document.querySelector(`#${id}`); button?.addEventListener('click', action); hostUnbind.push(() => button?.removeEventListener('click', action)); }
const onOpen = () => { const file = input.files?.[0]; if (!file || disposed) return; discardCandidate(); const token = ++requestedGeneration, before = fingerprint();
  void file.text().then(text => { if (!current(token)) { counts.ignored++; return; } return openText(text, token); }).catch(error => { if (current(token)) refused(error, before); }); input.value = ''; };
input.addEventListener('change', onOpen); hostUnbind.push(() => input.removeEventListener('change', onOpen));
Object.defineProperty(window, 'initialSceneFixture', { value: Object.freeze({ observe, register, start, step, stop, editRestored, missingCandidate,
  repairCandidate, discardCandidate, openText, save, exportPNG, loseContext, restoreContext, dispose,
  points() { return session ? pointsFor(session) : null; }, samples() { return session ? samplesFor(session) : null; },
  debug() { return session ? { scene: session.app.tree.snapshot(), beforeAdmission: { ...session.before } } : null; },
  documentText() { return session?.scene ? serialize(session) : Promise.resolve(null); }, get canvas() { return canvas; }
}), writable: false, configurable: false });
session = createSession(canvas, initialInput, sourceAssets, requestedGeneration);
const callerFrame = initialInput.nodes.find(node => node.id === 'Frame');
if (callerFrame?.kind === 'frame') { const callerGroup = callerFrame.children.find(node => node.id === 'Group');
  if (callerGroup?.kind === 'group') { const callerRect = callerGroup.children.find(node => node.id === 'Rect'); if (callerRect?.kind === 'rect') callerRect.transform.x = 123; } }
inputIndependent = stringifySceneJSON(session.app.tree.snapshot()) === initialCanonical;
show('Stopped copied tree is ready; renderer still has empty accepted state until asset registration and Render');
