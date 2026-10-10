// @ts-check
import { createCanvas2D, createDisplayTree, createDisplayTreeFromScene, stringifySceneJSON } from '@barocss/canvas2d';
import { serializeCanvasDocument, parseCanvasDocument, exportCanvasDocumentPNG } from '@barocss/canvas2d/document';
/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {{canvas:HTMLCanvasElement,renderer:import('@barocss/canvas2d').Canvas2DRenderer,
 * tree:import('@barocss/canvas2d').DisplayTree,group:import('@barocss/canvas2d').ContainerHandle,
 * frame:import('@barocss/canvas2d').FrameHandle,scene:import('@barocss/canvas2d').Scene,
 * generation:number,unbind:()=>void}} Session */
const options = { logicalSize: { width: 320, height: 240 }, dpr: 2 };
const pose = (/** @type {number} */ x = 0, /** @type {number} */ y = 0) =>
  ({ x, y, rotation: 0, scaleX: 1, scaleY: 1 });
/** @param {boolean} wider @returns {import('@barocss/canvas2d').PolygonMask} */
function maskData(wider = false) {
  const leg = wider ? 90 : 60, bar = wider ? 70 : 50;
  return { commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 160, y: 0 },
    { kind: 'L', x: 160, y: bar }, { kind: 'L', x: leg, y: bar },
    { kind: 'L', x: leg, y: 160 }, { kind: 'L', x: 0, y: 160 }, { kind: 'Z' }] };
}
const redPixels = new Uint8Array(64);
for (let i = 0; i < 16; i++) redPixels.set(i === 9 ? [0, 0, 0, 0] : [255, 0, 0, 255], i * 4);
const glyphPixels = new Uint8Array(384);
for (let y = 1; y <= 10; y++) for (let x = 1; x <= 6; x++) {
  if (x === 1 || x === 6 || y === 5 || y === 6) glyphPixels.fill(255, (y * 8 + x) * 4, (y * 8 + x) * 4 + 4);
}
const assets = { Red: { width: 4, height: 4, pixels: redPixels }, GlyphAtlas: { width: 8, height: 12, pixels: glyphPixels } };
/** @returns {import('@barocss/canvas2d').PolygonMask} */
function innerMask() { return { commands: [{ kind: 'M', x: 0, y: 0 }, { kind: 'L', x: 130, y: 0 },
  { kind: 'L', x: 130, y: 130 }, { kind: 'L', x: 0, y: 130 }, { kind: 'Z' }] }; }
/** @param {number} width @param {number} height @param {boolean} triangle @returns {import('@barocss/canvas2d').PolygonMask} */
function smallMask(width, height, triangle = false) { return { commands: [{ kind: 'M', x: 0, y: 0 },
  { kind: 'L', x: width, y: 0 }, ...(triangle ? [] : [{ kind: /** @type {const} */ ('L'), x: width, y: height }]),
  { kind: 'L', x: 0, y: height }, { kind: 'Z' }] }; }
const innerPose = { ...pose(30, 15), rotation: 0.15, scaleX: 0.95, scaleY: 1.1 };
const tree = createDisplayTree('NestedMaskConsumer');
tree.stage.addChild(tree.createRect({ id: 'Back', layer: 0, transform: pose(), width: 320, height: 240, fill: [0.2, 0.2, 0.2, 1] }));
const frame = tree.createFrame({ id: 'Frame', layer: 1, transform: { ...pose(160, 120), rotation: 0.12, scaleX: -1.05, scaleY: 0.9 },
  pivot: { x: 90, y: 80 }, width: 180, height: 160, fill: [0, 0, 0, 0], clip: true });
const group = tree.createContainer({ id: 'Outer', layer: 0, transform: { ...pose(8, 8), rotation: -0.08 }, mask: maskData() });
const inner = tree.createContainer({ id: 'Inner', layer: 0, transform: innerPose, mask: innerMask(),
  hitArea: { x: -40, y: -40, width: 200, height: 200 } });
inner.addChild(tree.createSprite({ id: 'Sprite', layer: 0, transform: pose(-25, -25), imageId: 'Red', width: 160, height: 160,
  anchorX: 0, anchorY: 0, opacity: 1, sampling: 'nearest' }));
inner.addChild(tree.createPath({ id: 'Gradient', layer: 1, transform: pose(), commands: [
  { kind: 'M', x: 65, y: 0 }, { kind: 'L', x: 145, y: 0 }, { kind: 'L', x: 145, y: 65 }, { kind: 'L', x: 65, y: 65 }, { kind: 'Z' },
  { kind: 'M', x: 85, y: 8 }, { kind: 'L', x: 85, y: 24 }, { kind: 'L', x: 105, y: 24 }, { kind: 'L', x: 105, y: 8 }, { kind: 'Z' },
], fill: { rule: 'nonzero', linear: { from: { x: 65, y: 0 }, to: { x: 145, y: 0 }, startColor: [0, 1, 0, 1], endColor: [0, 0, 1, 1] } } }));
inner.addChild(tree.createGlyphRun({ id: 'Glyph', layer: 2, transform: pose(8, 40), atlasId: 'GlyphAtlas', text: 'H', baseline: 0,
  opacity: 1, sampling: 'nearest', glyphs: [{ sourceRect: { x: 0, y: 0, width: 8, height: 12 }, x: 0, y: 0, width: 24, height: 36, textStart: 0, textEnd: 1 }] }));
inner.addChild(tree.createPath({ id: 'Stroke', layer: 3, transform: pose(), commands: [{ kind: 'M', x: -20, y: 110 }, { kind: 'L', x: 150, y: 110 }],
  stroke: { width: 6, color: [1, 1, 0, 1] } }));
group.addChild(inner); frame.addChild(group); tree.stage.addChild(frame);
tree.stage.addChild(tree.createRect({ id: 'ZeroSibling', layer: 2, transform: pose(14, 210), width: 40, height: 18, fill: [0, 0, 1, 1] }));
const single = tree.createContainer({ id: 'OneSibling', layer: 3, transform: pose(72, 210), mask: smallMask(35, 18, true) });
single.addChild(tree.createSprite({ id: 'OneSprite', layer: 0, transform: pose(), width: 38, height: 18, imageId: 'Red',
  sourceRect: { x: 1, y: 0, width: 1, height: 1 }, opacity: 1, sampling: 'nearest', anchorX: 0, anchorY: 0 })); tree.stage.addChild(single);
const two = tree.createContainer({ id: 'TwoSiblingOuter', layer: 4, transform: pose(132, 210), mask: smallMask(60, 18) });
const twoInner = tree.createContainer({ id: 'TwoSiblingInner', layer: 0, transform: pose(10, 0), mask: smallMask(40, 18, true) });
twoInner.addChild(tree.createPath({ id: 'TwoFill', layer: 0, transform: pose(), commands: smallMask(50, 18).commands,
  fill: { rule: 'nonzero', color: [0, 1, 1, 1] } })); two.addChild(twoInner); tree.stage.addChild(two);
let canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('#scene'));
let requestedGeneration = 1;
let disposed = false;
/** @type {Session|null} */ let session = null;
/** @type {ReturnType<typeof sessionObservation>|null} */ let terminal = null;
/** @type {{code:string,retained:boolean}|null} */ let failure = null;
/** @type {{byteLength:number,filename:string}|null} */ let saved = null;
/** @type {{bytesEqualPrevious:boolean|null,commandsEqualPrevious:boolean|null,idsEqualPrevious:boolean|null}|null} */ let opened = null;
/** @type {{byteLength:number,width:number,height:number}|null} */ let png = null;
/** @type {string[]} */ const pointerLog = [];
/** @type {(()=>void)[]} */ const hostUnbind = [];
/** @type {'open'|'png'|null} */ let temporary = null;
/** @type {(()=>void)[]} */ const waiters = [];
const counts = { rendererCreated: 0, rendererDisposed: 0, liveRenderers: 0, maxRenderers: 0,
  binds: 0, unbinds: 0, pointerEvents: 0, edits: 0, errors: 0, ignored: 0, pngCanvases: 0, disposeCalls: 0,
  contextLosses: 0, contextRestores: 0 };
const output = /** @type {HTMLElement} */ (document.querySelector('#observation'));
const status = /** @type {HTMLElement} */ (document.querySelector('#status'));
const input = /** @type {HTMLInputElement} */ (document.querySelector('#open'));
/** @param {unknown} error */
function codeOf(error) { return error instanceof Error && 'code' in error ? String(error.code) : error instanceof Error ? error.name : String(error); }
/** @param {number} token */
function current(token) { return !disposed && token === requestedGeneration; }
/** @param {Session} s @param {Point} viewport */
function sample(s, viewport) {
  const hit = s.renderer.hitTest(viewport)?.id ?? null, hits = s.renderer.hitTestAll(viewport).map(item => item.id);
  if (viewport.x < 0 || viewport.y < 0 || viewport.x >= 320 || viewport.y >= 240) return { viewport, rgba: null, hit, hits };
  const gl = s.canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error('WebGL2 unavailable'); const bytes = new Uint8Array(4);
  if (gl.isContextLost()) return { viewport, rgba: null, hit, hits };
  gl.readPixels(Math.floor(viewport.x * 2), s.canvas.height - Math.floor(viewport.y * 2) - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, bytes);
  return { viewport, rgba: [...bytes], hit, hits };
}
/** @param {import('@barocss/canvas2d').DisplayTree} tree */
function getInner(tree) { const handle = tree.get('Inner'); if (handle?.kind !== 'container') throw new Error('Inner group missing'); return handle; }
/** @param {Session} s */
function pointsFor(s) {
  const inner = getInner(s.tree);
  const outer = (/** @type {Point} */ point) => s.renderer.worldToViewport(s.group.toWorld(point));
  const child = (/** @type {Point} */ point) => s.renderer.worldToViewport(inner.toWorld(point));
  return { both: outer({ x: 25, y: 110 }), outerOnly: outer({ x: 10, y: 20 }), innerOnly: outer({ x: 100, y: 110 }),
    neither: outer({ x: 145, y: 145 }), gradient: child({ x: 80, y: 10 }), nonzeroHole: child({ x: 95, y: 15 }),
    gradientOuterRejected: child({ x: 90, y: 40 }), gradientInnerRejected: child({ x: 138, y: 10 }),
    glyphOpaque: child({ x: 12.5, y: 50.5 }), glyphTransparent: child({ x: 18.5, y: 50.5 }),
    groupArea: child({ x: 25, y: 75 }), stroke: child({ x: 15, y: 110 }), frameOutside: child({ x: 10, y: 129 }),
    zeroSibling: { x: 34, y: 218 }, oneSibling: { x: 80, y: 215 }, oneOutside: { x: 104, y: 225 },
    twoSibling: { x: 147, y: 215 }, twoOutside: { x: 177, y: 225 }, background: { x: 20, y: 20 } };
}
/** @param {Session} s */
function samplesFor(s) { return Object.fromEntries(Object.entries(pointsFor(s)).map(([key, point]) => [key, sample(s, point)])); }
/** @param {import('@barocss/canvas2d').ContainerHandle} handle */
function contour(handle) {
  const mask = handle.data.mask;
  return { id: handle.id, commands: mask?.commands ?? [], world: mask?.commands.flatMap(command => {
    if (command.kind !== 'M' && command.kind !== 'L') return [];
    const point = handle.toWorld({ x: command.x, y: command.y });
    return [{ x: Math.fround(point.x), y: Math.fround(point.y) }];
  }) ?? [] };
}
/** @param {import('@barocss/canvas2d').DisplayHandle} handle @returns {string[]} */
function idsFor(handle) { return [handle.id, ...('children' in handle ? handle.children.flatMap(idsFor) : [])]; }
/** @param {Session} s */
function sessionObservation(s) {
  const inner = getInner(s.tree), gl = s.canvas.getContext('webgl2');
  const masks = { outer: s.group.data.mask ?? null, inner: inner.data.mask ?? null };
  const assetBytes = Object.fromEntries(Object.keys(assets).map(id => [id, [...(s.renderer.getImageAsset(id)?.pixels ?? [])]]));
  const stack = [contour(s.group), contour(inner)].filter(value => value.commands.length > 0);
  return { generation: s.generation, version: s.scene.version, ids: s.tree.stage.children.flatMap(idsFor), masks, contours: stack,
    innerTransform: inner.data.transform, outerTransform: s.group.data.transform, frame: s.frame.data,
    innerHitArea: inner.data.hitArea, innerBounds: inner.getWorldBounds(), outerBounds: s.group.getWorldBounds(),
    points: pointsFor(s), samples: samplesFor(s), assetBytes,
    initialExpectedTopIds: { both: 'Sprite', outerOnly: 'Back', innerOnly: 'Back', neither: 'Back',
      gradient: 'Gradient', nonzeroHole: 'Sprite', glyphOpaque: 'Glyph', glyphTransparent: 'Sprite', groupArea: 'Inner',
      stroke: 'Stroke', frameOutside: 'Back', zeroSibling: 'ZeroSibling', oneSibling: 'OneSprite', twoSibling: 'TwoFill' },
    contextLost: !!gl?.isContextLost(), maxFragmentUniformVectors: gl && !gl.isContextLost() ? gl.getParameter(gl.MAX_FRAGMENT_UNIFORM_VECTORS) : null,
    sceneMatchesTree: stringifySceneJSON(s.scene) === stringifySceneJSON(s.tree.snapshot()),
    backing: { width: s.canvas.width, height: s.canvas.height } };
}
function observe() { return { disposed, requestedGeneration, temporary, counts: { ...counts }, failure, saved, opened, png,
  pointerLog: [...pointerLog], accepted: session ? sessionObservation(session) : terminal }; }
function show(/** @type {string} */ message) { status.textContent = message; output.textContent = JSON.stringify(observe(), null, 2);
  for (const button of Array.from(document.querySelectorAll('button'))) button.disabled = disposed; input.disabled = disposed; }
function fingerprint() { return JSON.stringify(session ? { scene: stringifySceneJSON(session.scene), accepted: sessionObservation(session) } : null); }
function bind(/** @type {Session} */ s) {
  counts.binds++; const unsubscribe = s.tree.stage.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:stage:${event.target?.id ?? 'none'}`));
  /** @type {(()=>void)[]} */ const listeners = [unsubscribe];
  for (const id of ['Back', 'Frame', 'Outer', 'Inner', 'Sprite', 'Gradient', 'Glyph', 'Stroke', 'ZeroSibling', 'OneSprite', 'TwoFill']) {
    const handle = s.tree.get(id); if (handle) listeners.push(handle.onPointer('pointerdown', event => pointerLog.push(`g${s.generation}:${id}:${event.target?.id}`)));
  }
  const onPointer = (/** @type {PointerEvent} */ event) => {
    if (disposed || session !== s) return; counts.pointerEvents++; const rect = s.canvas.getBoundingClientRect();
    const viewport = { x: (event.clientX - rect.left) * 320 / rect.width, y: (event.clientY - rect.top) * 240 / rect.height };
    s.tree.dispatchPointer({ type: 'pointerdown', pointerId: event.pointerId, point: s.renderer.viewportToWorld(viewport), hit: s.renderer.hitTest(viewport) });
    show('Dispatched real pointerdown');
  };
  const onLoss = (/** @type {Event} */ event) => { event.preventDefault(); if (!disposed && session === s) { counts.contextLosses++; show('Context lost; pixel readback is unavailable'); } };
  const onRestore = () => { if (!disposed && session === s) { counts.contextRestores++; s.renderer.render(); show('Rendered accepted masks after context restoration'); } };
  s.canvas.addEventListener('pointerdown', onPointer);
  s.canvas.addEventListener('webglcontextlost', onLoss); s.canvas.addEventListener('webglcontextrestored', onRestore); let done = false;
  return () => { if (done) return; done = true; counts.unbinds++; s.canvas.removeEventListener('pointerdown', onPointer);
    s.canvas.removeEventListener('webglcontextlost', onLoss); s.canvas.removeEventListener('webglcontextrestored', onRestore); for (const stop of listeners) stop(); };
}
/** @param {unknown} error @param {string} before */
function refused(error, before) { counts.errors++; failure = { code: codeOf(error), retained: fingerprint() === before }; show(`Refused ${failure.code}`); return failure; }
/** @param {(outer:import('@barocss/canvas2d').ContainerHandle,inner:import('@barocss/canvas2d').ContainerHandle)=>void} change */
function edit(change) {
  const s = session; if (!s || disposed) return false; const token = ++requestedGeneration, before = fingerprint();
  /** @type {Session|null} */ let next = null; let admitted = false;
  try {
    const tree = createDisplayTreeFromScene(s.scene), group = tree.get('Outer'), frame = tree.get('Frame');
    if (group?.kind !== 'container' || frame?.kind !== 'frame') throw new Error('Mask topology missing');
    change(group, getInner(tree)); const scene = tree.snapshot(); s.renderer.updateScene(scene); admitted = true; s.renderer.render();
    next = { ...s, tree, group, frame, scene, generation: token, unbind: () => {} };
    next.unbind = bind(next); session = next; s.unbind(); counts.edits++; failure = null; show('Accepted public group edit'); return true;
  } catch (error) {
    if (next && session !== next) next.unbind();
    if (admitted && session === s) { try { s.renderer.updateScene(s.scene); s.renderer.render(); } catch { /* Retention is measured below. */ } }
    refused(error, before); return false;
  }
}
function removeOuter() { return edit(outer => outer.setMask(null)); }
function restoreOuter() { return edit(outer => outer.setMask(maskData())); }
function removeInner() { return edit((outer, inner) => inner.setMask(null)); }
function restoreInner() { return edit((outer, inner) => inner.setMask(innerMask())); }
function restoreBoth() { return edit((outer, inner) => { outer.setMask(maskData()); inner.setMask(innerMask()); inner.setTransform(innerPose); }); }
function disjoint() { return edit((outer, inner) => inner.setPosition(120, 100)); }
let thirdNumber = 0;
function thirdAncestor() {
  const s = session; if (!s || disposed) return null; requestedGeneration++; const before = fingerprint();
  // This sibling chain keeps two masks even while the main controls remove one.
  const inner = s.tree.get('TwoSiblingInner');
  if (inner?.kind !== 'container') throw new Error('Two-mask sibling group missing');
  try {
    const child = s.tree.createContainer({ id: `Third${++thirdNumber}`, layer: 4, transform: pose(),
      visible: false, alpha: 0, mask: smallMask(10, 10) });
    inner.addChild(child);
    failure = { code: 'ACCEPTED', retained: fingerprint() === before }; show('Third mask admitted'); return failure;
  } catch (error) { return refused(error, before); }
}
/** @type {WEBGL_lose_context|null} */ let contextExtension = null;
function loseContext() {
  const s = session; if (!s || disposed) return false;
  contextExtension = s.canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context') ?? null;
  if (!contextExtension) { show('WEBGL_lose_context is unavailable'); return false; }
  contextExtension.loseContext(); return true;
}
function restoreContext() { if (!session || disposed || !contextExtension) return false; contextExtension.restoreContext(); return true; }
function releaseTemporary() { temporary = null; for (const resolve of waiters.splice(0)) resolve(); }
/** @param {number} token @param {'open'|'png'} operation */
async function acquireTemporary(token, operation) { while (temporary && current(token)) await new Promise(resolve => waiters.push(() => resolve(undefined)));
  if (!current(token)) return false; temporary = operation; return true; }
function disposeRenderer(/** @type {import('@barocss/canvas2d').Canvas2DRenderer} */ renderer) { renderer.dispose(); counts.rendererDisposed++; counts.liveRenderers--; }
/** @param {import('@barocss/canvas2d').DisplayTree} tree @param {Map<string,import('@barocss/canvas2d').ImageAssetInput>} images @param {number} token */
function fresh(tree, images, token) {
  const group = tree.get('Outer'), frame = tree.get('Frame');
  if (group?.kind !== 'container' || frame?.kind !== 'frame') throw new Error('Frame or MaskGroup missing');
  const nextCanvas = document.createElement('canvas'); nextCanvas.id = 'scene';
  const renderer = createCanvas2D(nextCanvas, options); counts.rendererCreated++; counts.liveRenderers++;
  counts.maxRenderers = Math.max(counts.maxRenderers, counts.liveRenderers);
  try { for (const [id, image] of images) renderer.setImageAsset(id, image);
    const scene = tree.snapshot(); renderer.updateScene(scene); renderer.render();
    return { canvas: nextCanvas, renderer, tree, group, frame, scene, generation: token, unbind: () => {} };
  } catch (error) { disposeRenderer(renderer); throw error; }
}
function adopt(/** @type {Session} */ next) { next.unbind = bind(next); const old = session;
  canvas.replaceWith(next.canvas); canvas = next.canvas; session = next; failure = null; contextExtension = null; if (old) { old.unbind(); disposeRenderer(old.renderer); } }
/** @param {string} text @param {number|null} reservedToken */
async function openText(text, reservedToken = null) {
  if (disposed) return; const token = reservedToken ?? ++requestedGeneration; if (!current(token)) return;
  const before = fingerprint(), previous = session; let acquired = false;
  /** @type {Session|null} */ let next = null;
  try {
    const parsed = await parseCanvasDocument(text); if (!current(token)) { counts.ignored++; return; }
    const tree = createDisplayTreeFromScene(parsed.scene), group = tree.get('Outer'), frame = tree.get('Frame');
    const sprite = tree.get('Sprite'), glyph = tree.get('Glyph');
    if (parsed.scene.version !== 26 || group?.kind !== 'container' || frame?.kind !== 'frame' ||
        sprite?.kind !== 'sprite' || glyph?.kind !== 'glyphRun' || sprite.data.imageId !== 'Red' || glyph.data.atlasId !== 'GlyphAtlas' ||
        !frame.children.includes(group) || !group.children.includes(getInner(tree)) || !getInner(tree).children.includes(sprite) || !getInner(tree).children.includes(glyph) || parsed.assets.size !== 2 ||
        !parsed.assets.has('Red') || !parsed.assets.has('GlyphAtlas')) throw new Error('Document polygon fixture topology differs');
    for (const [id, kind] of /** @type {const} */ ([['Back', 'rect'], ['Gradient', 'path'], ['Stroke', 'path'],
      ['ZeroSibling', 'rect'], ['OneSibling', 'container'], ['OneSprite', 'sprite'],
      ['TwoSiblingOuter', 'container'], ['TwoSiblingInner', 'container'], ['TwoFill', 'path']])) {
      if (tree.get(id)?.kind !== kind) throw new Error(`Document is missing ${kind} ${id}`);
    }
    acquired = await acquireTemporary(token, 'open'); if (!acquired || !current(token)) { counts.ignored++; return; }
    next = fresh(tree, parsed.assets, token);
    const prior = previous && sessionObservation(previous);
    const now = sessionObservation(next);
    opened = { bytesEqualPrevious: prior ? JSON.stringify(prior.assetBytes) === JSON.stringify(now.assetBytes) : null,
      commandsEqualPrevious: prior ? JSON.stringify(prior.masks) === JSON.stringify(now.masks) : null,
      idsEqualPrevious: prior ? JSON.stringify(prior.ids) === JSON.stringify(now.ids) : null };
    adopt(next); releaseTemporary(); acquired = false; show('Opened polygon mask and authoritative atlas bytes on a fresh canvas');
  } catch (error) { if (next && session !== next) { next.unbind(); disposeRenderer(next.renderer); }
    if (current(token)) refused(error, before); else counts.ignored++;
  } finally { if (acquired) releaseTemporary(); }
}
function serialize(/** @type {Session} */ s) { return serializeCanvasDocument(s.scene, id => s.renderer.getImageAsset(id)); }
function download(/** @type {Blob} */ blob, /** @type {string} */ name) { const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
async function save() { const s = session; if (!s || disposed) return; const token = requestedGeneration;
  const text = await serialize(s); if (!current(token) || session !== s) return;
  const filename = 'nested-mask-document.json'; download(new Blob([text], { type: 'application/json' }), filename);
  saved = { filename, byteLength: new TextEncoder().encode(text).length }; show('Saved accepted mask scene and assets'); return text; }
async function exportPNG() {
  const s = session; if (!s || disposed) return; const token = requestedGeneration; let acquired = false;
  try { const text = await serialize(s); if (!current(token) || session !== s) return;
    acquired = await acquireTemporary(token, 'png'); if (!acquired || !current(token) || session !== s) return;
    const result = await exportCanvasDocumentPNG(text, options, () => { if (!current(token)) throw new Error('PNG canceled'); counts.pngCanvases++; return document.createElement('canvas'); });
    if (!current(token) || session !== s) return; releaseTemporary(); acquired = false;
    download(result.blob, 'nested-mask.png'); png = { byteLength: result.blob.size, width: result.backingSize.width, height: result.backingSize.height };
    show('Exported accepted mask scene to PNG'); return png;
  } catch (error) { if (current(token)) show(`PNG failed: ${codeOf(error)}`); }
  finally { if (acquired) releaseTemporary(); }
}
function dispose() { counts.disposeCalls++; if (disposed) return; const s = session;
  if (s) { terminal = sessionObservation(s); s.unbind(); disposeRenderer(s.renderer); } session = null; disposed = true; requestedGeneration++;
  for (const resolve of waiters.splice(0)) resolve(); for (const remove of hostUnbind.splice(0)) remove(); show('Disposed nested-mask fixture and listeners'); }
const actions = { 'remove-outer': removeOuter, 'restore-outer': restoreOuter, 'remove-inner': removeInner,
  'restore-inner': restoreInner, restore: restoreBoth, disjoint, third: thirdAncestor, lose: loseContext, context: restoreContext,
  save: () => { void save().catch(error => show(`Save failed: ${codeOf(error)}`)); }, png: () => { void exportPNG(); }, dispose };
for (const [id, action] of Object.entries(actions)) { const button = document.querySelector(`#${id}`); button?.addEventListener('click', action);
  hostUnbind.push(() => button?.removeEventListener('click', action)); }
const onOpen = () => { const file = input.files?.[0]; if (!file || disposed) return; const token = ++requestedGeneration, before = fingerprint();
  void file.text().then(text => { if (!current(token)) { counts.ignored++; return; } return openText(text, token); })
    .catch(error => { if (current(token)) refused(error, before); }); input.value = ''; };
input.addEventListener('change', onOpen); hostUnbind.push(() => input.removeEventListener('change', onOpen));
Object.defineProperty(window, 'nestedMaskFixture', { value: Object.freeze({ observe, removeOuter, restoreOuter,
  removeInner, restoreInner, restoreBoth, disjoint, thirdAncestor, loseContext, restoreContext, save, openText, exportPNG, dispose,
  get canvas() { return canvas; }, points() { return session ? pointsFor(session) : null; },
  samples() { return session ? samplesFor(session) : null; },
  /** @param {Point} point */ probe(point) { return session ? sample(session, point) : null; },
  documentText() { return session ? serialize(session) : Promise.resolve(null); },
  debug() { return session ? { scene: structuredClone(session.scene), outer: session.group.data, inner: getInner(session.tree).data, frame: session.frame.data } : null; }
}), writable: false, configurable: false });
adopt(fresh(tree, new Map(Object.entries(assets)), requestedGeneration)); show('Ready: two inherited masks and zero/one/two-mask reset siblings');
