import * as PathCanvasAPI from '@barocss/canvas2d';
import { serializeCanvasDocument, stageCanvasDocument } from '@barocss/canvas2d/document';

const sourceProfile = 'a833201e3b5d03f07dc9a46bb7ef407619e2de0b';
const contextId = 'PathEditScene';
const size = { width: 320, height: 200 }, dpr = 2;
const view = { panX: 10, panY: 6, zoom: 0.95 };
const identity = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const parentPose = { x: 30, y: 22, scaleX: 1.1, scaleY: 0.9, rotation: 0.12 };
const cubicPose = { ...identity, x: 130, y: 20, rotation: -0.08 };
const markerPose = { ...identity, x: 260, y: 156 };
const fills = {
  QuadraticPath: { color: [0.12, 0.65, 0.78, 1], rule: 'evenodd' },
  CubicPath: { color: [0.55, 0.35, 0.82, 1], rule: 'evenodd' },
};
const stroke = { color: [0.92, 0.96, 1, 1], width: 3 };
const normalizedStroke = { ...stroke, cap: 'butt', join: 'bevel', dash: { lengths: [], offset: 0 }, miterLimit: 4 };
const markerColor = [0.25, 0.85, 0.45, 1];
const options = { logicalSize: size, dpr, backgroundColor: [0.063, 0.094, 0.125, 1] };
const slots = [
  { id: 'q-control', label: 'Q control', pathId: 'QuadraticPath', keys: ['cx', 'cy'] },
  { id: 'c1-control', label: 'C first control', pathId: 'CubicPath', keys: ['c1x', 'c1y'] },
  { id: 'c2-control', label: 'C second control', pathId: 'CubicPath', keys: ['c2x', 'c2y'] },
];
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function fail(message) { throw new PathCanvasAPI.Canvas2DError('INVALID_SCENE', message); }
function checksum(pixels) {
  let hash = 2166136261;
  for (const byte of pixels) hash = Math.imul(hash ^ byte, 16777619) >>> 0;
  return 'fnv1a32:' + hash.toString(16).padStart(8, '0');
}
function fullPaint(data, commands) {
  return { commands, ...(Object.hasOwn(data, 'fill') ? { fill: data.fill } : {}),
    ...(Object.hasOwn(data, 'stroke') ? { stroke: data.stroke } : {}) };
}
function commandsOf(input, key, kind) {
  const commands = input[key];
  if (!Array.isArray(commands) || !equal(commands.map(command => command?.kind), ['M', kind, 'L', 'L', 'Z'])) {
    fail(`${key} requires the complete M/${kind}/L/L/Z command array`);
  }
  return commands;
}
function parseInput(source) {
  let input;
  try { input = JSON.parse(source); } catch { fail('Path input must be a complete JSON object'); }
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 2 ||
      !Object.hasOwn(input, 'quadratic') || !Object.hasOwn(input, 'cubic')) {
    fail('Path input requires exactly quadratic and cubic command arrays');
  }
  commandsOf(input, 'quadratic', 'Q'); commandsOf(input, 'cubic', 'C');
  return input;
}
function initialTree(input) {
  const tree = PathCanvasAPI.createDisplayTree(contextId);
  const parent = tree.createContainer({ id: 'ParentPathGroup', layer: 0, transform: parentPose });
  parent.addChild(tree.createPath({ id: 'QuadraticPath', layer: 0, transform: identity,
    commands: input.quadratic, fill: fills.QuadraticPath, stroke }));
  parent.addChild(tree.createPath({ id: 'CubicPath', layer: 1, transform: cubicPose,
    commands: input.cubic, fill: fills.CubicPath, stroke }));
  tree.stage.addChild(parent);
  tree.stage.addChild(tree.createRect({ id: 'UnrelatedMarker', layer: 1, transform: markerPose,
    width: 34, height: 20, fill: markerColor }));
  return tree;
}
function plainDefaults(data) {
  return data.visible === true && data.alpha === 1 && data.hitMode === 'auto' && data.pivot == null;
}
function inspectScene(scene) {
  const tree = PathCanvasAPI.createDisplayTreeFromScene(scene);
  const parent = tree.get('ParentPathGroup'), q = tree.get('QuadraticPath'), c = tree.get('CubicPath');
  const marker = tree.get('UnrelatedMarker');
  if (scene.version !== 29 || scene.contextId !== contextId || tree.stage.children.length !== 2 ||
      parent?.kind !== 'container' || marker?.kind !== 'rect' ||
      tree.stage.children[0] !== parent || tree.stage.children[1] !== marker ||
      parent.children.length !== 2 || parent.children[0] !== q || parent.children[1] !== c ||
      q?.kind !== 'path' || c?.kind !== 'path') fail('Document does not contain this example path family');
  if (!equal(parent.data.transform, parentPose) || parent.data.layer !== 0 || !plainDefaults(parent.data) ||
      parent.data.mask != null || parent.data.hitArea != null ||
      !equal(marker.data.transform, markerPose) || marker.data.layer !== 1 || !plainDefaults(marker.data) ||
      marker.data.width !== 34 || marker.data.height !== 20 || !equal(marker.data.fill, markerColor)) {
    fail('Document parent or unrelated Marker differs from this example');
  }
  for (const [path, layer, pose, kind, key] of [[q, 0, identity, 'Q', 'quadratic'], [c, 1, cubicPose, 'C', 'cubic']]) {
    const data = path.data;
    commandsOf({ [key]: data.commands }, key, kind);
    if (data.layer !== layer || !equal(data.transform, pose) || !plainDefaults(data) ||
        !equal(data.fill, fills[path.id]) || !equal(data.stroke, normalizedStroke)) {
      fail('Document path paint or transform differs from this example');
    }
  }
  return tree;
}
function makeCanvas() {
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Actual example output');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', zIndex: '0' });
  return canvas;
}
function capture(renderer) {
  const image = renderer.captureImageAsset();
  return { width: image.width, height: image.height, byteCount: image.pixels.byteLength, rgbaChecksum: checksum(image.pixels) };
}
function overlayModel(session) {
  const project = (pathId, local) => session.renderer.worldToViewport(session.tree.get(pathId).toWorld(local));
  const controls = slots.map(slot => {
    const command = session.tree.get(slot.pathId).data.commands[1];
    const local = { x: command[slot.keys[0]], y: command[slot.keys[1]] };
    return { id: slot.id, label: slot.label, pathId: slot.pathId, commandIndex: 1,
      fields: [...slot.keys], local, viewport: project(slot.pathId, local) };
  });
  const guides = ['QuadraticPath', 'CubicPath'].map(pathId => {
    const commands = session.tree.get(pathId).data.commands, curve = commands[1];
    const locals = pathId === 'QuadraticPath'
      ? [{ x: commands[0].x, y: commands[0].y }, { x: curve.cx, y: curve.cy }, { x: curve.x, y: curve.y }]
      : [{ x: commands[0].x, y: commands[0].y }, { x: curve.c1x, y: curve.c1y },
        { x: curve.c2x, y: curve.c2y }, { x: curve.x, y: curve.y }];
    return locals.map(local => project(pathId, local));
  });
  return { controls, guides };
}
function sessionFromScene(scene) {
  const tree = inspectScene(scene), canvas = makeCanvas();
  const renderer = PathCanvasAPI.createCanvas2D(canvas, options);
  try {
    renderer.setView(view); renderer.updateScene(tree.snapshot()); renderer.render();
    const session = { canvas, renderer, tree, scene: tree.snapshot(), frame: capture(renderer) };
    session.overlay = overlayModel(session);
    return session;
  } catch (error) { renderer.dispose(); throw error; }
}

function editor(panel, initial, callbacks = {}) {
  let accepted = initial, gesture = null, disposed = false, contextUnavailable = false;
  let generation = 0, frameCount = 1, history = null, historyPosition = 1;
  let savedDocument = null;
  const listeners = [];
  const originalStyle = { position: panel.style.position, width: panel.style.width, aspectRatio: panel.style.aspectRatio };
  Object.assign(panel.style, { position: 'relative', width: '100%', aspectRatio: '8 / 5' });
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 320 200'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  Object.assign(svg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '2' });
  const guides = ['QuadraticPath', 'CubicPath'].map(() => {
    const path = document.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('fill', 'none'); path.setAttribute('stroke', '#d0dce5'); path.setAttribute('stroke-width', '0.8');
    path.setAttribute('stroke-dasharray', '3 3'); svg.appendChild(path); return path;
  });
  const buttons = slots.map(slot => {
    const button = document.createElement('button'); button.type = 'button';
    button.setAttribute('aria-label', slot.label); button.title = slot.label; button.dataset.pathControl = slot.id;
    Object.assign(button.style, { position: 'absolute', width: '20px', height: '20px', padding: '0',
      border: '2px solid #f0f6fa', borderRadius: '50%', transform: 'translate(-50%, -50%)',
      background: slot.pathId === 'QuadraticPath' ? '#29b5d5' : '#a483ed', cursor: 'grab', touchAction: 'none', zIndex: '3' });
    return button;
  });
  panel.append(accepted.canvas, svg, ...buttons);
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options); listeners.push([target, type, handler, options]);
  }
  function notifyError(error) {
    if (!disposed) { try { callbacks.onError?.(error); } catch { /* The host must not throw from native events. */ } }
  }
  function sourceOf(session = accepted) {
    return JSON.stringify({ quadratic: session.tree.get('QuadraticPath').data.commands,
      cubic: session.tree.get('CubicPath').data.commands }, null, 2);
  }
  function report() {
    return structuredClone({
      backend: 'Public Canvas2D renderer · authored Q/C control editor', sourceProfile,
      sceneVersion: accepted.scene.version, contextId, parent: accepted.tree.get('ParentPathGroup').data,
      paths: ['QuadraticPath', 'CubicPath'].map(id => ({ id, ...accepted.tree.get(id).data })),
      unrelatedMarker: { id: 'UnrelatedMarker', ...accepted.tree.get('UnrelatedMarker').data },
      controls: accepted.overlay.controls, logicalSize: size, backingSize: { width: accepted.canvas.width, height: accepted.canvas.height },
      dpr, view, frame: accepted.frame, frameCount, available: !disposed && !contextUnavailable,
      history: { canUndo: Boolean(history && historyPosition === 1), canRedo: Boolean(history && historyPosition === 0) },
      dragging: gesture?.slot.id ?? null, savedDocument,
    });
  }
  function publish() {
    if (!disposed) { try { callbacks.onChange?.(report(), sourceOf()); } catch (error) { notifyError(error); } }
  }
  function refresh(session = accepted) {
    for (const [index, points] of session.overlay.guides.entries()) {
      guides[index].setAttribute('d', points.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' '));
    }
    session.overlay.controls.forEach((control, index) => {
      buttons[index].style.left = control.viewport.x / size.width * 100 + '%';
      buttons[index].style.top = control.viewport.y / size.height * 100 + '%';
    });
  }
  function live() {
    if (disposed) throw new PathCanvasAPI.Canvas2DError('DISPOSED', 'Path editor is disposed');
    if (contextUnavailable) throw new PathCanvasAPI.Canvas2DError('CONTEXT_LOST', 'Path editor context is unavailable');
  }
  function disposeSession(session) {
    for (let index = listeners.length - 1; index >= 0; index--) {
      const [target, type, handler, opts] = listeners[index];
      if (target === session.canvas) { target.removeEventListener(type, handler, opts); listeners.splice(index, 1); }
    }
    session.renderer.dispose(); session.canvas.remove();
  }
  function releaseCapture(current) {
    try { if (current.button.hasPointerCapture(current.pointerId)) current.button.releasePointerCapture(current.pointerId); }
    catch { /* A cancelled native pointer may already be released. */ }
  }
  function cancelGesture() {
    const current = gesture;
    if (!current) return;
    gesture = null; releaseCapture(current); disposeSession(current.preview);
    if (!disposed) refresh();
  }
  function rectOf(canvas) {
    const r = canvas.getBoundingClientRect();
    if (!Number.isFinite(r.width) || !Number.isFinite(r.height) || r.width <= 0 || r.height <= 0) fail('Canvas CSS size must be positive');
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }
  function guard(current) {
    return !disposed && !contextUnavailable && accepted === current.base && generation === current.generation &&
      accepted.canvas.width === current.backing.width && accepted.canvas.height === current.backing.height &&
      equal(rectOf(accepted.canvas), current.rect) && equal(view, current.view) &&
      equal(accepted.tree.get('ParentPathGroup').data.transform, current.parentPose) &&
      equal(accepted.tree.get(current.slot.pathId).data.transform, current.pathPose);
  }
  function promote(next) {
    const prior = accepted;
    next.canvas.style.zIndex = '0'; prior.canvas.replaceWith(next.canvas);
    accepted = next; frameCount++; contextUnavailable = false;
    disposeSession(prior); bindContext(next); refresh();
  }
  function bindContext(session) {
    listen(session.canvas, 'webglcontextlost', () => {
      if (!disposed && accepted === session) { contextUnavailable = true; cancelGesture(); }
    });
    listen(session.canvas, 'webglcontextrestored', () => {
      if (!disposed && accepted === session) {
        try { session.frame = capture(session.renderer); contextUnavailable = false; refresh(); }
        catch (error) { contextUnavailable = true; notifyError(error); }
      }
    });
  }
  function begin(event, slot, button) {
    if (disposed || event.button !== 0 || gesture) return;
    let preview;
    try {
      live(); const rect = rectOf(accepted.canvas);
      const path = accepted.tree.get(slot.pathId), command = path.data.commands[1];
      const pointerLocal = path.toLocal(accepted.renderer.viewportToWorld({
        x: (event.clientX - rect.left) / rect.width * size.width,
        y: (event.clientY - rect.top) / rect.height * size.height,
      }));
      preview = sessionFromScene(accepted.scene);
      preview.canvas.style.zIndex = '1'; panel.insertBefore(preview.canvas, svg);
      gesture = { base: accepted, preview, candidate: null, slot, button, pointerId: event.pointerId,
        generation, rect, backing: { width: accepted.canvas.width, height: accepted.canvas.height },
        view: { ...view }, parentPose: accepted.tree.get('ParentPathGroup').data.transform,
        pathPose: path.data.transform,
        grabOffset: { x: command[slot.keys[0]] - pointerLocal.x, y: command[slot.keys[1]] - pointerLocal.y } };
      button.setPointerCapture(event.pointerId); event.preventDefault();
    } catch (error) {
      if (gesture) cancelGesture(); else if (preview) disposeSession(preview);
      notifyError(error);
    }
  }
  function move(event) {
    const current = gesture;
    if (!current || event.pointerId !== current.pointerId) return;
    try {
      if (!guard(current)) { cancelGesture(); return; }
      event.preventDefault();
      const viewport = { x: (event.clientX - current.rect.left) / current.rect.width * size.width,
        y: (event.clientY - current.rect.top) / current.rect.height * size.height };
      const local = current.base.tree.get(current.slot.pathId).toLocal(current.base.renderer.viewportToWorld(viewport));
      const tree = PathCanvasAPI.createDisplayTreeFromScene(current.base.scene);
      const path = tree.get(current.slot.pathId), data = path.data, commands = data.commands;
      commands[1] = { ...commands[1], [current.slot.keys[0]]: local.x + current.grabOffset.x,
        [current.slot.keys[1]]: local.y + current.grabOffset.y };
      path.setPath(fullPaint(data, commands));
      const scene = tree.snapshot(); inspectScene(scene);
      const overlay = overlayModel({ tree, renderer: current.preview.renderer });
      current.preview.renderer.updateScene(scene); current.preview.renderer.render();
      current.preview.tree = tree; current.preview.scene = scene; current.preview.frame = capture(current.preview.renderer);
      current.preview.overlay = overlay;
      current.candidate = current.preview; refresh(current.preview);
    } catch (error) { cancelGesture(); notifyError(error); }
  }
  function finish(event) {
    const current = gesture;
    if (!current || event.pointerId !== current.pointerId) return;
    try {
      if (!guard(current) || !current.candidate || equal(current.base.scene, current.candidate.scene)) { cancelGesture(); return; }
      current.candidate.frame = capture(current.candidate.renderer);
      const pair = { before: structuredClone(current.base.scene), after: structuredClone(current.candidate.scene) };
      gesture = null; releaseCapture(current);
      promote(current.candidate); history = pair; historyPosition = 1; generation++;
      publish();
    } catch (error) { if (gesture) cancelGesture(); notifyError(error); }
  }
  function update(source) {
    live(); cancelGesture(); generation++;
    const input = parseInput(source);
    const candidate = PathCanvasAPI.createDisplayTreeFromScene(accepted.scene);
    for (const [id, key] of [['QuadraticPath', 'quadratic'], ['CubicPath', 'cubic']]) {
      const path = candidate.get(id);
      path.setPath(fullPaint(path.data, input[key]));
    }
    const next = sessionFromScene(candidate.snapshot());
    promote(next); history = null; historyPosition = 1; publish();
    return report();
  }
  async function action(id) {
    live(); cancelGesture();
    if (id === 'save-document') {
      const token = ++generation, scene = structuredClone(accepted.scene);
      const documentText = await serializeCanvasDocument(scene, () => null);
      if (disposed || token !== generation) return { report: report() };
      const document = JSON.parse(documentText);
      savedDocument = { format: document.format, version: document.version,
        byteCount: new TextEncoder().encode(documentText).length, assetCount: document.assets.length };
      return { report: report(), documentText, filename: 'path-edit.canvas.json' };
    }
    if (id === 'undo' || id === 'redo') {
      const position = id === 'undo' ? 0 : 1;
      if (!history || position === historyPosition) fail('No completed drag is available for this action');
      generation++;
      const next = sessionFromScene(position === 0 ? history.before : history.after);
      promote(next); historyPosition = position; publish();
      return report();
    }
    fail('Unknown path editor action');
  }
  function dispose() {
    if (disposed) return;
    disposed = true; generation++; cancelGesture(); observer.disconnect();
    for (const [target, type, handler, opts] of listeners) target.removeEventListener(type, handler, opts);
    listeners.length = 0;
    disposeSession(accepted); svg.remove(); buttons.forEach(button => button.remove());
    Object.assign(panel.style, originalStyle); history = null; savedDocument = null;
  }
  slots.forEach((slot, index) => {
    const button = buttons[index];
    listen(button, 'pointerdown', event => begin(event, slot, button));
    listen(button, 'pointermove', move); listen(button, 'pointerup', finish);
    listen(button, 'pointercancel', event => { if (gesture?.pointerId === event.pointerId) cancelGesture(); });
    listen(button, 'lostpointercapture', event => { if (gesture?.pointerId === event.pointerId) cancelGesture(); });
  });
  listen(window, 'keydown', event => { if (event.key === 'Escape') cancelGesture(); });
  listen(window, 'blur', cancelGesture); listen(window, 'resize', cancelGesture);
  const observer = new ResizeObserver(() => {
    if (gesture) { try { if (!guard(gesture)) cancelGesture(); } catch { cancelGesture(); } }
  });
  observer.observe(panel); bindContext(accepted); refresh();
  return { update, report, action, dispose };
}

export function createPathEditExample(panel, sourceJSON, callbacks = {}) {
  const session = sessionFromScene(initialTree(parseInput(sourceJSON)).snapshot());
  try { return editor(panel, session, callbacks); }
  catch (error) { session.renderer.dispose(); session.canvas.remove(); throw error; }
}

export async function openPathEditExample(freshPanel, documentText, callbacks = {}) {
  const canvas = makeCanvas();
  const staged = await stageCanvasDocument(documentText, canvas, options);
  try {
    if (staged.assets.size !== 0) fail('Path editor documents must contain no image assets');
    const tree = inspectScene(staged.scene);
    staged.renderer.setView(view); staged.renderer.render();
    const session = { canvas, renderer: staged.renderer, tree, scene: tree.snapshot(), frame: capture(staged.renderer) };
    session.overlay = overlayModel(session);
    return editor(freshPanel, session, callbacks);
  } catch (error) { staged.renderer.dispose(); canvas.remove(); throw error; }
}
