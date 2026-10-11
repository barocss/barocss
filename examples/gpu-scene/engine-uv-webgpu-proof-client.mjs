/** #1184 actual-device proof client. Offline bundling does not execute a GPU. */
import { compileEngineUVTextureMaterial, mountEngineUVTextureWebGPUViewport, EngineUVWebGPUError } from '../../packages/barocss-gpu/src/index.ts';
import { createEngineUVProofFixture, serializeEngineUVProofOriginals } from './engine-uv-webgpu-proof-fixture.mjs';

const PARENT = 'b803640306acf130aeb6274df8ae12d6cda6f8d8';
const LOG_LIMIT = 128, ORIGINAL_LIMIT = 262144, RECEIPT_LIMIT = 4194304;
const clone = value => structuredClone(value), signed = serializeEngineUVProofOriginals;
const root = document.getElementById('proof-root');
if (!root) throw new Error('Proof HTML requires main#proof-root');
const element = (tag, text, parent = root) => { const value = document.createElement(tag); if (text !== undefined) value.textContent = text; parent.append(value); return value; };
function requireValue(value, message) { if (!value) throw new Error(message); }
function equal(a, b, message) { requireValue(signed(a) === signed(b), message); }
const boundedText = value => String(value).slice(0, 1024);
function errorDetails(value, depth = 0, seen = new Set()) {
  if (value === undefined) return { kind: 'undefined' };
  if (value === null || typeof value !== 'object') return { kind: typeof value, value: boundedText(value) };
  if (depth >= 8 || seen.has(value)) return { kind: 'bounded-or-cyclic-cause' };
  seen.add(value);
  const result = { name: boundedText(value.name ?? 'Object'), code: value.code == null ? null : boundedText(value.code), message: boundedText(value.message ?? 'Actual non-Error cause') };
  for (const field of ['start', 'end']) if (Number.isFinite(value[field])) result[field] = value[field];
  const cause = Object.getOwnPropertyDescriptor(value, 'cause');
  result.cause = cause && 'value' in cause ? { own: true, data: errorDetails(cause.value, depth + 1, seen) } : { own: false };
  if (Array.isArray(value)) result.diagnostics = value.slice(0, 8).map(item => errorDetails(item, depth + 1, seen));
  if (Array.isArray(value.errors)) result.errors = value.errors.slice(0, 8).map(item => errorDetails(item, depth + 1, seen));
  if (Array.isArray(value.messages)) result.compilationMessagesFromActualErrorCause = value.messages.slice(0, 8).map(item => {
    const message = { type: boundedText(item.type), message: boundedText(item.message) };
    for (const field of ['lineNum', 'linePos', 'offset', 'length']) if (Number.isFinite(item[field])) message[field] = item[field];
    return message;
  });
  return result;
}
function receiptJSON(value) {
  let work = 0;
  function visit(item, depth) {
    requireValue(++work <= 262144 && depth <= 48, 'Receipt work/depth exceeds its limit');
    if (typeof item === 'number') { requireValue(Number.isFinite(item), 'Receipt requires finite numbers'); return Object.is(item, -0) ? '-0' : JSON.stringify(item); }
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item);
    if (Array.isArray(item)) return '[' + item.map(child => visit(child, depth + 1)).join(',') + ']';
    requireValue(item && Object.getPrototypeOf(item) === Object.prototype, 'Receipt requires plain data');
    return '{' + Object.keys(item).sort().map(key => JSON.stringify(key) + ':' + visit(item[key], depth + 1)).join(',') + '}';
  }
  const text = visit(value, 0);
  requireValue(new TextEncoder().encode(text).length <= RECEIPT_LIMIT, 'Receipt exceeds4MiB'); return text;
}
async function digest(bytes) { const buffer = bytes.slice().buffer; return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', buffer)), value => value.toString(16).padStart(2, '0')).join(''); }
function pushBounded(list, item) { if (list.length === LOG_LIMIT) list.shift(); list.push(item); }

let fixture = createEngineUVProofFixture(0), manifest = null, manifestSHA256 = null, manifestReady = false;
let active = null, busy = false, firstFailure = null, actualGPU = false, sequence = 0, nextInstance = 1;
let lastPhysical = null, savedEnvelope = null, remounted = false, disposedAll = false;
const instances = [], observations = [], consoleObservations = [], originalStates = [];
const stages = { mount: 'UNRUN', pixels: Object.fromEntries(Array.from({ length: 6 }, (_, phase) => [phase, 'UNRUN'])),
  physicalInitial: { left_instance: 'UNRUN', right_instance: 'UNRUN', background: 'UNRUN' },
  changes: Object.fromEntries(Array.from({ length: 5 }, (_, phase) => [phase + 1, 'UNRUN'])),
  refusalReference: 'UNRUN', refusalCamera: 'UNRUN', save: 'UNRUN', fileRemount: 'UNRUN', remountPixels: 'UNRUN', doubleDisposal: 'UNRUN' };
const style = element('style', 'body{font:14px system-ui;margin:20px;max-width:1000px;background:#f6f7f9;color:#17212b}button{margin:4px;padding:8px}section{background:white;border:1px solid #ccd3db;padding:12px;margin:14px 0}canvas{display:block;outline:1px solid #677b8b;margin:12px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:360px;overflow:auto}label{display:block;margin:8px 0}.note{color:#526171}');
void style;
element('h1', 'Authored EngineUV WebGPU — one device proof flow');
element('p', 'Prepared data is separate from actual device results. Source IDs do not name screen sides. Generic fallback is unsupported.').className = 'note';
const controlPanel = element('section'), canvasPanel = element('section'), expectedPanel = element('section'), resultPanel = element('section');
const stageText = element('strong', 'PREPARED / DEVICE UNRUN', controlPanel), buttonPanel = element('div', undefined, controlPanel);
const buttons = {};
function button(name, label, handler) { const value = element('button', label, buttonPanel); value.type = 'button'; value.onclick = () => action(name, handler); buttons[name] = value; return value; }
const fileLabel = element('label', 'Original file from Save (private envelope;256KiB maximum)', controlPanel), fileInput = element('input', undefined, fileLabel);
fileInput.type = 'file'; fileInput.accept = '.json,application/json';
const statusText = element('pre', 'No actual viewport mounted.', controlPanel);
element('h2', 'Independent declarations — fixed before readback', expectedPanel);
const expectedText = element('pre', undefined, expectedPanel);
element('h2', 'Actual observations', resultPanel);
const actualText = element('pre', 'UNRUN', resultPanel);
function currentEnvelope() { return { format: 'private-engineuv-webgpu-proof-originals', version: 0, phase: fixture.phase,
  scene: clone(fixture.scene), textureBindings: clone(fixture.textureBindings), authoredMaterials: clone(fixture.authoredMaterials), options: clone(fixture.options) }; }
function publicCompanion(current) {
  return { format: 'barocss-gpu-engine-uv-texture-material-bindings', version: 0, sceneId: current.scene.id,
    bindings: current.authoredMaterials.map(entry => {
      const result = compileEngineUVTextureMaterial(entry.source);
      requireValue(result.ok, 'Actual source compiler refused: ' + JSON.stringify(result.diagnostics ?? []));
      return { materialId: entry.materialId, material: result.material, uniforms: clone(entry.uniforms) };
    }) };
}
function expectedOriginals(current) { return { scene: current.scene, textureBindings: current.textureBindings, materialBindings: publicCompanion(current) }; }
function ready() { requireValue(active && active.viewport && active.viewport.status.state === 'ready', 'A ready actual viewport is required'); return active.viewport; }
function snapshot(instance = active) { return instance ? { instanceId: instance.id, status: instance.viewport?.status ?? instance.lastStatus,
  selected: instance.viewport?.selected ?? null, referenceDropped: instance.viewport === null } : null; }
function record(operation, value) { pushBounded(observations, { sequence: ++sequence, operation, time: new Date().toISOString(), phase: fixture.phase, instanceId: active?.id ?? null, value }); refresh(); }
function refresh() {
  stageText.textContent = firstFailure ? 'FAILED — retained evidence; no automatic retry' : actualGPU ? 'ACTUAL DEVICE OBSERVED — FLOW NOT AUTOMATICALLY PASS' : 'PREPARED / DEVICE UNRUN';
  statusText.textContent = JSON.stringify({ phase: fixture.phase, active: snapshot(), stages, firstFailure }, null, 2);
  expectedText.textContent = JSON.stringify({ phase: fixture.phase, width: fixture.options.width, height: fixture.options.height, oracle: fixture.oracle,
    pointerTargets: fixture.oracle.identities.map(item => ({ backingPixel: item.point, expectedRef: item.ref })) }, null, 2);
  actualText.textContent = JSON.stringify(observations.slice(-8), null, 2);
  const blocked = busy || !!firstFailure;
  if (buttons.initialize) buttons.initialize.disabled = blocked || !manifestReady || instances.length > 0;
  if (buttons.read) buttons.read.disabled = blocked || !active || disposedAll;
  if (buttons.next) { buttons.next.disabled = blocked || !active || fixture.phase >= 3 || stages.pixels[fixture.phase] !== 'PASS' || !initialPhysicalDone(); buttons.next.textContent = 'Next authored phase ' + Math.min(fixture.phase + 1, 3); }
  if (buttons.resize) buttons.resize.disabled = blocked || !active || fixture.phase !== 3 || stages.pixels[3] !== 'PASS';
  if (buttons.hide) buttons.hide.disabled = blocked || !active || fixture.phase !== 4 || stages.pixels[4] !== 'PASS';
  for (const name of ['refuse-reference', 'refuse-camera', 'save']) if (buttons[name]) buttons[name].disabled = blocked || !active || fixture.phase !== 5 || stages.pixels[5] !== 'PASS';
  if (buttons.reopen) buttons.reopen.disabled = blocked || !active || remounted || stages.save !== 'PASS' || stages.refusalReference !== 'PASS' || stages.refusalCamera !== 'PASS';
  if (buttons.dispose) buttons.dispose.disabled = busy || instances.length === 0 || disposedAll;
  if (buttons.download) buttons.download.disabled = busy || !manifestReady;
}
function initialPhysicalDone() { return Object.values(stages.physicalInitial).every(value => value === 'PASS'); }
async function action(name, operation) {
  if (busy) return;
  busy = true; refresh(); const startedAt = new Date().toISOString();
  try { await operation(); record(name, { completed: true, startedAt, endedAt: new Date().toISOString() }); }
  catch (cause) {
    const details = errorDetails(cause);
    if (!firstFailure) firstFailure = { operation: name, time: new Date().toISOString(), details };
    record(name, { completed: false, startedAt, endedAt: new Date().toISOString(), error: details }); console.error(name, cause);
  } finally { busy = false; refresh(); }
}
function verifyAccepted(viewport, current, generation) {
  const status = viewport.status;
  requireValue(status.backend === 'webgpu' && status.profile === 'engine-opaque-unlit-uv-texture-program-wgsl-v0' && status.state === 'ready', 'Actual required backend/profile is not ready');
  requireValue(status.generation === generation && status.width === current.options.width && status.height === current.options.height, 'Accepted generation or dimensions differ');
  requireValue(Object.keys(status.limits).length === 13 && Object.values(status.limits).every(value => Number.isSafeInteger(value) && value > 0), 'Thirteen actual positive device limits required');
  equal(status.resources, current.oracle.resources, 'Actual logical ledger differs from independent arithmetic');
  equal(viewport.originals, expectedOriginals(current), 'Accepted complete original triple differs');
}
async function mount(current, label) {
  const canvas = element('canvas', undefined, canvasPanel); canvas.width = current.options.width; canvas.height = current.options.height;
  canvas.setAttribute('aria-label', label); canvas.style.width = current.options.width + 'px'; canvas.style.height = current.options.height + 'px';
  const companion = publicCompanion(current), viewport = await mountEngineUVTextureWebGPUViewport(canvas, current.scene, current.textureBindings, companion, current.options);
  const instance = { id: nextInstance++, viewport, canvas, label, disposal: [], pointer: null, lastStatus: null }; instances.push(instance);
  if (viewport.status.backend === 'webgpu' && viewport.status.state === 'ready') actualGPU = true;
  verifyAccepted(viewport, current, 1);
  instance.pointer = event => {
    if (busy || firstFailure || active !== instance || disposedAll) return;
    void action('physical-pointer', async () => {
      requireValue(event.isTrusted, 'Synthetic pointer events cannot qualify physical proof');
      const rect = canvas.getBoundingClientRect(); requireValue(rect.width > 0 && rect.height > 0, 'Visible canvas rectangle is required');
      const x = Math.floor((event.clientX - rect.left) * canvas.width / rect.width), y = Math.floor((event.clientY - rect.top) * canvas.height / rect.height);
      const before = viewport.status.generation, hit = await viewport.pick(x, y), result = viewport.select(hit.ref);
      requireValue(result.ok, 'Actual picked reference selection refused');
      requireValue(hit.generation === before && viewport.status.generation === before, 'Physical pick/select changed generation');
      equal(viewport.selected, hit.ref, 'Actual selected reference differs from identity result');
      const declared = fixture.oracle.identities.find(item => Math.abs(item.point[0] - x) <= 1 && Math.abs(item.point[1] - y) <= 1);
      if (declared) {
        equal(hit.ref, declared.ref, 'Actual physical hit differs from predeclared source reference');
        if (fixture.phase === 0 && instance.id === 1) stages.physicalInitial[declared.ref?.nodeId ?? 'background'] = 'PASS';
      }
      lastPhysical = { instanceId: instance.id, generation: before, ref: hit.ref, point: [x, y] };
      record('actual-identity', { trusted: event.isTrusted, actor: 'BROWSER_TRUSTED_POINTER_ACTOR_REQUIRES_ROOT_PROVENANCE',
        clientPoint: [event.clientX, event.clientY], rectangle: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
        backing: [canvas.width, canvas.height], point: [x, y], declaration: declared ?? null, hit, selected: viewport.selected,
        qualifiesDeclaredTarget: !!declared });
    });
  };
  canvas.addEventListener('pointerdown', instance.pointer);
  return instance;
}
async function measure() {
  const viewport = ready(), declaration = clone(fixture.oracle);
  record('pre-readback-declaration', { options: fixture.options, oracle: declaration });
  const pixels = await viewport.readPixels(), width = fixture.options.width, height = fixture.options.height;
  requireValue(pixels instanceof Uint8Array && pixels.length === width * height * 4, 'Actual full RGBA size differs');
  const windows = [...declaration.samples, declaration.background].map(sample => {
    const values = []; let maximumRGBError = 0, alphaPass = true;
    for (let dy = -sample.radius; dy <= sample.radius; dy++) for (let dx = -sample.radius; dx <= sample.radius; dx++) {
      const x = sample.center[0] + dx, y = sample.center[1] + dy;
      requireValue(x >= 0 && y >= 0 && x < width && y < height, 'Predeclared window is outside backing store');
      const actual = Array.from(pixels.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));
      const rgbError = Math.max(...actual.slice(0, 3).map((value, channel) => Math.abs(value - sample.rgba[channel])));
      maximumRGBError = Math.max(maximumRGBError, rgbError); alphaPass &&= actual[3] === 255;
      values.push({ point: [x, y], actual, expected: sample.rgba, rgbError });
    }
    return { nodeId: sample.nodeId, center: sample.center, radius: sample.radius, maximumRGBError, alphaPass, pass: alphaPass && maximumRGBError <= declaration.tolerance, pixels: values };
  });
  const pass = windows.every(window => window.pass), fullRGBASHA256 = await digest(pixels);
  if (remounted) stages.remountPixels = pass ? 'PASS' : 'FAIL'; else stages.pixels[fixture.phase] = pass ? 'PASS' : 'FAIL';
  record('actual-window-results', { width, height, toleranceRGB: declaration.tolerance, alpha: 255, fullRGBASHA256, windows, pass });
  requireValue(pass, 'Actual readback differs from independent predeclared oracle');
}
async function change(nextPhase, resizeOnly = false) {
  const viewport = ready(), next = createEngineUVProofFixture(nextPhase), before = viewport.status.generation;
  requireValue(nextPhase === fixture.phase + 1, 'Authored phases must advance in order');
  record('pre-change-declaration', { phase: next.phase, options: next.options, oracle: next.oracle });
  let result;
  if (resizeOnly) {
    equal({ scene: next.scene, textureBindings: next.textureBindings, authoredMaterials: next.authoredMaterials },
      { scene: fixture.scene, textureBindings: fixture.textureBindings, authoredMaterials: fixture.authoredMaterials }, 'Resize must retain the same originals');
    result = await viewport.resize(next.options.width, next.options.height);
  } else result = await viewport.updateFrame(next.scene, next.textureBindings, publicCompanion(next));
  if (!result.ok) throw result.error;
  verifyAccepted(viewport, next, before + 1); fixture = next; lastPhysical = null;
  active.canvas.style.width = next.options.width + 'px'; active.canvas.style.height = next.options.height + 'px';
  if (nextPhase === 5) requireValue(viewport.selected === null, 'Hidden selected source was not cleared');
  stages.changes[nextPhase] = 'PASS'; originalStates.push(currentEnvelope());
  record('accepted-authored-phase', { phase: fixture.phase, actual: snapshot(), originals: viewport.originals });
}
function nestedCode(error, name, code) {
  const pending = [error], seen = new Set();
  while (pending.length && seen.size < 32) { const value = pending.shift(); if (!value || typeof value !== 'object' || seen.has(value)) continue; seen.add(value);
    if (value.name === name && value.code === code) return true;
    if (Object.hasOwn(value, 'cause')) pending.push(value.cause); if (Array.isArray(value.errors)) pending.push(...value.errors);
  }
  return false;
}
async function refusal(kind) {
  const viewport = ready(), before = { status: viewport.status, selected: viewport.selected, originals: viewport.originals }, pixels = await viewport.readPixels();
  const scene = clone(fixture.scene), textures = clone(fixture.textureBindings), material = publicCompanion(fixture);
  if (kind === 'reference') textures.bindings[0].textureId = 'absent_image'; else scene.camera.near = 0;
  const result = await viewport.updateFrame(scene, textures, material);
  requireValue(!result.ok && result.error instanceof EngineUVWebGPUError, 'Expected actual typed runtime refusal');
  requireValue(result.error.code === (kind === 'reference' ? 'REFERENCE' : 'SCENE'), 'Actual refusal outer phase differs');
  requireValue(nestedCode(result.error, kind === 'reference' ? 'EngineTextureBindingsError' : 'EngineSceneError', kind === 'reference' ? 'REFERENCE' : 'CAMERA'), 'Actual nested provider cause differs');
  const after = { status: viewport.status, selected: viewport.selected, originals: viewport.originals }, retained = await viewport.readPixels();
  equal(after, before, 'Accepted size/generation/selection/originals changed after refusal');
  requireValue(retained.length === pixels.length && retained.every((value, index) => value === pixels[index]), 'Full accepted RGBA changed after refusal');
  stages[kind === 'reference' ? 'refusalReference' : 'refusalCamera'] = 'PASS';
  record('actual-refusal-retention', { kind, error: errorDetails(result.error), actual: after.status, retainedOriginals: true,
    retainedGenerationSizeSelection: true, retainedFullRGBA: true, fullRGBASHA256: await digest(retained), lateGPUFailure: 'UNRUN' });
}
function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' })), anchor = element('a', undefined);
  anchor.href = url; anchor.download = filename; anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function disposeReference(instance) {
  const viewport = instance.viewport;
  requireValue(viewport !== null && instance.disposal.length === 0, 'Disposal requires the held actual reference');
  const before = viewport.originals;
  for (let count = 1; count <= 2; count++) {
    viewport.dispose(); const status = viewport.status;
    requireValue(status.state === 'disposed' && viewport.selected === null, 'Actual reference disposal did not reach disposed');
    equal(viewport.originals, before, 'Disposal changed original CPU authority');
    instance.disposal.push({ count, status, originalsRetained: true }); instance.lastStatus = status;
    record('actual-reference-disposal', { instanceId: instance.id, count, status, originalsRetained: true, physicalDriverCleanup: 'UNRUN' });
  }
  if (instance.pointer) instance.canvas.removeEventListener('pointerdown', instance.pointer);
  instance.pointer = null; instance.viewport = null;
}
button('initialize', 'Initialize actual required WebGPU', async () => {
  requireValue(instances.length === 0 && manifestReady, 'Initialize once after manifest admission');
  active = await mount(fixture, 'Initial actual EngineUV viewport'); stages.mount = 'PASS'; originalStates.push(currentEnvelope());
  record('actual-mount', { actual: snapshot(), actualGPU: true, nativeCompilationMessages: 'NOT_EXPOSED_BY_API',
    scopeResults: 'NOT_EXPOSED_BY_API; successful mount completed runtime checks', screenProof: 'REQUIRES_ROOT_CAPTURE' });
});
button('read', 'Read predeclared windows', measure);
button('next', 'Next authored phase 1', async () => { requireValue(fixture.phase < 3 && initialPhysicalDone(), 'Complete initial physical targets and authored sequence'); await change(fixture.phase + 1); });
button('resize', 'Resize only to320×256 (phase4)', async () => { requireValue(fixture.phase === 3, 'Resize follows phase3'); await change(4, true); });
button('hide', 'Hide physically selected left_instance (phase5)', async () => {
  const viewport = ready(); requireValue(fixture.phase === 4 && viewport.selected?.nodeId === 'left_instance'
    && lastPhysical?.instanceId === active.id && lastPhysical.generation === viewport.status.generation && lastPhysical.ref?.nodeId === 'left_instance', 'Physically pick left_instance in the current phase before hiding');
  await change(5);
});
button('refuse-reference', 'Refuse absent texture reference', () => refusal('reference'));
button('refuse-camera', 'Refuse near0 and retain fullRGBA', () => refusal('camera'));
button('save', 'Save complete signed originals', async () => {
  ready(); savedEnvelope = currentEnvelope(); const text = signed(savedEnvelope) + '\n';
  requireValue(new TextEncoder().encode(text).length <= ORIGINAL_LIMIT, 'Original file exceeds256KiB');
  const sha256 = await digest(new TextEncoder().encode(text)); download('engineuv-proof-originals.phase' + fixture.phase + '.json', text); stages.save = 'PASS';
  record('original-save-download-request', { phase: fixture.phase, bytes: new TextEncoder().encode(text).length, sha256,
    actualFileSaved: 'REQUIRES_ROOT_OR_REOPENED_FILE', privateEnvelope: true, publicCodec: false });
});
button('reopen', 'Reopen selected real file on a second canvas', async () => {
  const file = fileInput.files[0]; requireValue(file && file.size <= ORIGINAL_LIMIT, 'Choose an actual original file of at most256KiB');
  const text = await file.text(); requireValue(new TextEncoder().encode(text).length <= ORIGINAL_LIMIT, 'Original text exceeds256KiB');
  const parsed = JSON.parse(text);
  equal(Object.keys(parsed).sort(), ['authoredMaterials', 'format', 'options', 'phase', 'scene', 'textureBindings', 'version'], 'Private file fields differ');
  requireValue(parsed.format === 'private-engineuv-webgpu-proof-originals' && parsed.version === 0, 'Unknown private original envelope');
  const next = createEngineUVProofFixture(parsed.phase), expected = { format: parsed.format, version: 0, phase: next.phase, scene: next.scene,
    textureBindings: next.textureBindings, authoredMaterials: next.authoredMaterials, options: next.options };
  equal(parsed, expected, 'File must retain the exact known fixture phase for its independent oracle');
  requireValue(savedEnvelope !== null, 'Save originals before reopening'); equal(parsed, savedEnvelope, 'Reopened file differs from the actual saved phase');
  const previous = active, mounted = await mount(next, 'Same-page file-remount actual viewport');
  disposeReference(previous);
  active = mounted; fixture = next; remounted = true; lastPhysical = null; previous.canvas.hidden = true;
  stages.fileRemount = 'PASS'; record('actual-original-file-reopen', { filename: boundedText(file.name), bytes: file.size,
    sha256: await digest(new TextEncoder().encode(text)), recompiledFullCSS: true, trustedSavedIR: false, samePageRemount: true,
    freshBrowserProcess: 'UNRUN', previousInstanceId: previous.id, actual: snapshot() });
});
button('dispose', 'Dispose each held actual reference twice', async () => {
  for (const instance of instances) {
    if (instance.viewport !== null) disposeReference(instance);
  }
  disposedAll = true; stages.doubleDisposal = instances.length === 2 && instances.every(instance => instance.disposal.length === 2) ? 'PASS' : 'UNRUN';
});
function report() {
  const clientSteps = stages.mount === 'PASS' && Object.values(stages.pixels).every(value => value === 'PASS') && initialPhysicalDone()
    && Object.values(stages.changes).every(value => value === 'PASS') && ['refusalReference', 'refusalCamera', 'save', 'fileRemount', 'remountPixels', 'doubleDisposal'].every(name => stages[name] === 'PASS');
  return { format: 'private-engineuv-webgpu-proof-receipt', version: 0, preparedManifest: manifest, preparedManifestSHA256: manifestSHA256,
    preparedAssetHashesVerifiedInBrowser: false, actualGPU, overall: firstFailure ? 'FAILED' : clientSteps ? 'CLIENT_STEPS_RECORDED_REQUIRES_ROOT_REVIEW' : 'INCOMPLETE', stages: clone(stages),
    accepted: currentEnvelope(), originalStates, observations, consoleObservations, firstFailure,
    instances: instances.map(instance => ({ instanceId: instance.id, label: instance.label, status: instance.viewport?.status ?? instance.lastStatus, disposal: instance.disposal })),
    support: { nativeCompilationMessages: 'NOT_EXPOSED_BY_API', screen: 'REQUIRES_ROOT_CAPTURE', nativeConsole: 'REQUIRES_ROOT_LIVE_CONSOLE',
      consoleObservations: 'JavaScript calls observed by this page; not a complete native DevTools log', deviceLoss: 'UNRUN', startupFallback: 'UNSUPPORTED',
      lateGPUFailure: 'UNRUN', physicalDriverCleanup: 'UNRUN', driverMemory: 'UNMEASURED', freshBrowser: 'UNRUN', integratedConsumer: 'UNRUN', publication: false } };
}
button('download', 'Download separate-stage observations', async () => {
  record('receipt-download-request', { automaticPass: false }); download('engineuv-webgpu-proof-receipt.json', receiptJSON(report()) + '\n');
});

for (const level of ['warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...values) => { pushBounded(consoleObservations, { time: new Date().toISOString(), level, details: values.slice(0, 8).map(value => typeof value === 'object' ? errorDetails(value) : boundedText(value)) }); original(...values); };
}
window.addEventListener('error', event => { pushBounded(consoleObservations, { time: new Date().toISOString(), level: 'window-error', details: [boundedText(event.message)] }); });
window.addEventListener('unhandledrejection', event => { pushBounded(consoleObservations, { time: new Date().toISOString(), level: 'unhandled-rejection', details: [errorDetails(event.reason)] }); });
refresh();
void action('read-preparation-manifest', async () => {
  // The sole fetch is the declared manifest at this same page origin.
  const response = await fetch('./manifest.json', { cache: 'no-store' }); requireValue(response.ok, 'Prepared manifest fetch refused');
  const bytes = new Uint8Array(await response.arrayBuffer()); requireValue(bytes.length <= 1048576, 'Prepared manifest exceeds1MiB');
  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  requireValue(parsed.parent === PARENT && parsed.stage === 'PREPARED_ONLY' && parsed.actualGPU === false, 'Prepared manifest anchor/stage differs');
  const expectedAssets = ['index.html', 'client.mjs', 'oracle.json', 'original-scene.json', 'original-texture-bindings.json', 'original-authored-materials.json', 'original.0.material.css', 'original.1.material.css'];
  requireValue(Array.isArray(parsed.files) && parsed.files.length === expectedAssets.length, 'Prepared asset count differs');
  equal(parsed.files.map(file => file.path).sort(), [...expectedAssets].sort(), 'Only declared same-origin assets are admitted');
  requireValue(parsed.files.every(file => Number.isSafeInteger(file.bytes) && file.bytes >= 0 && /^[a-f0-9]{64}$/.test(file.sha256)), 'Prepared file pins are malformed');
  manifest = parsed; manifestSHA256 = await digest(bytes); manifestReady = true;
  record('prepared-manifest-admitted', { parent: parsed.parent, sha256: manifestSHA256, assets: parsed.files, actualGPU: false });
});
