/** Node 22: real React/codec/session, controlled Viewer. No GPU or physical file proof. */
import assert from 'node:assert/strict';
import {readFile, mkdir, rm} from 'node:fs/promises';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const app = dirname(fileURLToPath(import.meta.url)), workspace = resolve(app, '../..');
const output = join(app, '.generic-light-flow'); await mkdir(output, {recursive: true});
const dom = new JSDOM('<!doctype html><div id="root"></div>', {url: 'http://localhost/material.html?workbench=lights'});
const domNames = ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLCanvasElement', 'Event', 'MouseEvent', 'File', 'Element', 'Node', 'NodeFilter', 'MutationObserver', 'CustomEvent', 'HTMLSelectElement'];
const previousDomGlobals = new Map([...domNames, 'getComputedStyle', 'IS_REACT_ACT_ENVIRONMENT'].map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
for (const name of domNames)
  Object.defineProperty(globalThis, name, {value: dom.window[name], configurable: true});
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const dialogs = []; let confirmation = true, fileChoosers = 0;
dom.window.confirm = message => {dialogs.push(message); return confirmation;};
const inputClick = dom.window.HTMLInputElement.prototype.click;
dom.window.HTMLInputElement.prototype.click = function () {if (this.type === 'file') fileChoosers++; return inputClick.call(this);};
const downloads = [], createdUrls = [], revokedUrls = []; let latestBlob, downloadFailure = null;
URL.createObjectURL = blob => {latestBlob = blob; const url = 'blob:controlled-test-' + createdUrls.length; createdUrls.push(url); return url;};
URL.revokeObjectURL = url => {revokedUrls.push(url);};
dom.window.HTMLAnchorElement.prototype.click = function () {
  if (downloadFailure) throw downloadFailure;
  downloads.push({name: this.download, blob: latestBlob});
};
// Read-only instrumentation captures the genuine controller, never a replacement session.
const flowControllers = [], previousControllerObserver = Object.getOwnPropertyDescriptor(globalThis, '__observeLightFlowController');
Object.defineProperty(globalThis, '__observeLightFlowController', {configurable: true, value: controller => {flowControllers.push(controller);}});
const controls = []; let startupGate = null, startupFailure = null, navigationDom = null, mounted = null;
let failed = false, firstError, activeSurfaceLedger = null;
const cleanupErrors = [];
globalThis.__lightWorkbenchViewer = async (_canvas, request) => {
  if (startupFailure) throw startupFailure;
  const gate = startupGate;
  _canvas.width = 960; _canvas.height = 600;
  const control = {initial: request, calls: [], picks: [], pickResult: null, disposed: 0, state: 'ready', wait: null, refusal: null, prepare: null};
  const viewer = {accepted: {generation: 1, owner: request.owner},
    get status() {return {backend: 'webgpu', state: control.state, width: 960, height: 600, generation: viewer.accepted.generation};},
    async replace(next) {
      control.calls.push(next);
      if (control.prepare) {try {control.prepare(next);} catch (error) {return {ok: false, error};}}
      if (control.wait) await control.wait;
      if (control.refusal) return {ok: false, error: control.refusal};
      viewer.accepted = {generation: viewer.accepted.generation + 1, owner: next.owner}; return {ok: true};
    }, async pick(x, y) {control.picks.push([x, y]); return control.pickResult ? control.pickResult(x, y)
      : {generation: viewer.accepted.generation, ref: null, binding: null};},
    select() {assert.fail('Inspector selection does not call Viewer.select');},
    dispose() {control.disposed++; control.state = 'disposed';},
  };
  control.viewer = viewer; controls.push(control); if (gate) await gate; return viewer;
};
try {
  await build({stdin: {contents: `export * from './apps/render-editor/src/native-light-workbench';
export * from './apps/render-editor/src/native-light-fields';
export * from './apps/render-editor/src/native-light-workbench-flow';
export {deriveNativeLightFramingCamera} from './apps/render-editor/src/native-light-framing';
export {createNativeSceneBase,createNativeSceneSeed} from './apps/render-editor/src/native-scene-seed';
export {prepareViewerNativeSceneAppearance} from '@barocss/viewer';
export {deriveRenderCameraInteraction,createRenderNativeLightRequest,prepareRenderNativeLightDocument,parseRenderNativeLightDocument,serializeRenderNativeLightDocument,serializeRenderNativeSceneDocument,serializeRenderNativeDirectionalLightDocument,parseRenderNativeDirectionalLightDocument,prepareRenderMaterialDocument,parseRenderMaterialDocument,serializeRenderMaterialDocument,deriveRenderMaterialAssignment,RENDER_MATERIAL_LIMITS,prepareRenderNativeSourceImport} from './packages/barocss-render-editor/src/index';`,resolveDir: workspace},
    bundle: true, platform: 'node', format: 'esm', outfile: join(output, 'flow.mjs'),
    external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'radix-ui', 'class-variance-authority', 'clsx', 'tailwind-merge'],
    plugins: [{name: 'controlled-viewer-only', setup(builder) {
      builder.onResolve({filter: /^\.\/native-light-controller$/}, () => ({path: 'observed-light-controller', namespace: 'light-flow-observer'}));
      builder.onLoad({filter: /.*/, namespace: 'light-flow-observer'}, () => ({contents: `import {createNativeLightController as actual} from ${JSON.stringify(join(app, 'src/native-light-controller.ts'))};
export function createNativeLightController() {const controller = actual(); globalThis.__observeLightFlowController(controller); return controller;}`, resolveDir: workspace}));
      builder.onResolve({filter: /^@barocss\/viewer$/}, () => ({path: 'controlled-viewer', namespace: 'test'}));
      builder.onLoad({filter: /.*/, namespace: 'test'}, () => ({contents: `export * from ${JSON.stringify(join(workspace, 'packages/barocss-viewer/src/index.ts'))};
export const createNativeDirectionalLightWebGPUViewer = (...args) => globalThis.__lightWorkbenchViewer(...args);
export const createNativePointLightWebGPUViewer = (...args) => globalThis.__lightWorkbenchViewer(...args);`, resolveDir: workspace}));
    }}]});
  const api = await import(pathToFileURL(join(output, 'flow.mjs')).href), {act} = await import('react');
  const sourceText = await readFile(join(app, 'public/reference-panel.barocad'), 'utf8');
  const seed = api.createLightStudy(sourceText);
  const original = api.serializeRenderNativeLightDocument(seed);
  const form = api.addLightFields(api.readLightFields(seed));
  // Product light duplication: independent ID, complete exact draft values, cap and no mutation.
  const copiedFields = api.duplicateLightFields(form, form.lights[0].nodeId);
  assert.equal(copiedFields.lights.length, form.lights.length + 1);
  assert.notEqual(copiedFields.lights.at(-1).nodeId, form.lights[0].nodeId);
  assert.deepEqual(copiedFields.lights.at(-1).vector, form.lights[0].vector);
  assert.deepEqual(copiedFields.lights.at(-1).color, form.lights[0].color);
  assert.notStrictEqual(copiedFields.lights.at(-1).vector, form.lights[0].vector);
  assert.deepEqual(form.lights[0].label, 'Directional 1');
  assert.throws(() => api.duplicateLightFields(form, 'missing-light'));
  assert.throws(() => api.duplicateLightFields(api.addLightFields(copiedFields), form.lights[0].nodeId));
  form.lights[1].vector = ['-0', '2', '-4']; form.lights[1].color = ['.3', '.5', '.8'];
  const candidate = api.applyLightFields(seed, form);
  assert(Object.is(candidate.lights.lights[1].directionScene[0], -0));
  assert.deepEqual(candidate.nativeDocument, seed.nativeDocument); assert.deepEqual(candidate.surfaceMaterials, seed.surfaceMaterials);
  for (const change of [value => {value.lights[1].vector = ['0', '0', '0'];}, value => {value.lights[1].nodeId = value.lights[0].nodeId;}, value => {value.ambient = '';}, value => {value.lights[1].intensity = '1.1';},
    value => {value.ambient = 'NaN';}, value => {value.lights[1].vector[0] = 'Infinity';},
    value => {value.lights[1].color[0] = '-.01';}, value => {value.lights[1].color[2] = '1.01';}]) {
    const invalid = structuredClone(form); change(invalid); assert.throws(() => api.applyLightFields(seed, invalid));
    assert.equal(api.serializeRenderNativeLightDocument(seed), original);
  }
  const four = api.addLightFields(api.addLightFields(form)); assert.equal(four.lights.length, 4);
  assert.throws(() => api.addLightFields(four));
  const ambientOnly = api.applyLightFields(seed, {...api.readLightFields(seed), ambient: '-0', lights: []});
  assert.equal(ambientOnly.lights.lights.length, 0); assert(Object.is(ambientOnly.lights.ambientStrength, -0));
  const disabledLight = structuredClone(form); disabledLight.lights[1].enabled = false;
  assert.equal(api.applyLightFields(seed, disabledLight).lights.lights[1].enabled, false);
  const container = document.getElementById('root'); mounted = await api.mountLightWorkbenchFlow(container, seed);
  const text = () => container.textContent;
  const button = name => [...container.querySelectorAll('button')].find(node => node.textContent.trim() === name || node.getAttribute('aria-label') === name);
  const click = async name => {const target = button(name); assert(target, 'Missing button ' + name); assert(!target.disabled, 'Disabled button ' + name); await act(async () => target.click());};
  const edit = async (label, value) => {const input = container.querySelector(`[aria-label="${label}"]`); assert(input, label); await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new dom.window.Event('input', {bubbles: true}));
  });};
  const file = (contents, name = 'lights.json') => ({name, size: new TextEncoder().encode(contents).length, arrayBuffer: async () => new TextEncoder().encode(contents).buffer});
  const selectFile = async value => {const input = container.querySelector('input[type="file"]'); Object.defineProperty(input, 'files', {value: [value], configurable: true}); await act(async () => input.dispatchEvent(new dom.window.Event('change', {bubbles: true})));};
  assert(text().includes('WebGPU · ready')); await click('Add directional'); await edit('Direction X', '-0'); await edit('Direction Y', '2'); await edit('Direction Z', '-4'); await edit('Light label', 'Fill light');
  await act(async () => container.querySelector('[aria-label="Light enabled"]').click()); await click('Apply');
  assert.equal(controls[0].calls.length, 1); assert(text().includes('Accepted 1')); await click('Save accepted');
  const first = await downloads.at(-1).blob.text(); const firstDocument = api.parseRenderNativeLightDocument(first);
  assert.equal(firstDocument.lights.lights.length, 2); assert(Object.is(firstDocument.lights.lights[1].directionScene[0], -0));
  assert.equal(firstDocument.lights.lights[1].enabled, false);
  assert.deepEqual(firstDocument.nativeDocument, seed.nativeDocument); assert.deepEqual(firstDocument.display, seed.display);
  await edit('Intensity', '.4'); confirmation = false; const choosersBeforeDecline = fileChoosers, callsBeforeDecline = controls[0].calls.length;
  await click('Open'); assert.equal(fileChoosers, choosersBeforeDecline); assert.equal(controls[0].calls.length, callsBeforeDecline);
  assert.equal(container.querySelector('[aria-label="Intensity"]').value, '.4'); assert(text().includes('Accepted 1')); assert(text().includes('Unapplied draft'));
  await click('Save accepted'); assert.equal(await downloads.at(-1).blob.text(), first); confirmation = true; await click('Discard');
  await edit('Direction Y', '0'); await edit('Direction Z', '0'); await click('Apply');
  assert(text().includes('Accepted 1')); assert.equal(controls[0].calls.length, 1); assert.equal(container.querySelector('[aria-label="Direction X"]').value, '-0');
  await click('Discard'); await click('Remove light'); await click('Apply'); assert(text().includes('Accepted 2'));
  await click('Undo'); assert(text().includes('Accepted 3')); assert(text().includes('2 / 4 directional'));
  await click('Redo'); assert(text().includes('Accepted 4')); assert(text().includes('1 / 4 directional'));
  await click('Open'); await selectFile(file(first)); assert(text().includes('Accepted 1')); assert(button('Undo').disabled);
  await edit('Ambient strength', '.4'); controls[0].refusal = new Error('Controlled presentation refusal'); await click('Apply');
  assert(text().includes('Accepted 1')); assert.equal(container.querySelector('[aria-label="Ambient strength"]').value, '.4');
  controls[0].refusal = null; await click('Apply'); assert(text().includes('Accepted 2'));
  let release; controls[0].wait = new Promise(resolve => {release = resolve;}); await edit('Ambient strength', '.5');
  await act(async () => button('Apply').click()); assert(button('Apply').disabled); assert(button('Open').disabled);
  await act(async () => {release(); await controls[0].wait;}); controls[0].wait = null; assert(text().includes('Accepted 3'));
  await click('Open'); await edit('Ambient strength', '.6'); const count = controls[0].calls.length;
  await selectFile(file(first)); assert(text().includes('STALE_CANDIDATE')); assert.equal(controls[0].calls.length, count); await click('Discard');
  await click('Save accepted'); const last = api.parseRenderNativeLightDocument(await downloads.at(-1).blob.text()); assert.equal(last.lights.ambientStrength, .5);
  await click('Open'); let releaseRead; const delayed = {name: 'delayed.json', size: first.length, arrayBuffer: () => new Promise(resolve => {releaseRead = resolve;})};
  await selectFile(delayed); await mounted.dispose(); await act(async () => releaseRead(new TextEncoder().encode(first).buffer)); assert.equal(controls[0].calls.length, count); assert.equal(controls[0].disposed, 1);
  mounted = await api.mountLightWorkbenchFlow(container, last); assert(text().includes('Accepted 3'));
  controls[1].state = 'lost'; await act(async () => {await new Promise(resolve => setTimeout(resolve, 350));});
  assert(text().includes('Presentation unavailable (lost)')); assert(!button('Save accepted').disabled);
  await click('Save accepted'); assert(text().includes('Download requested; saved marker could not be acknowledged.'));
  await click('Remount accepted scene'); assert.equal(controls[1].disposed, 1); assert(text().includes('Accepted 3')); assert(button('Undo').disabled);
  await mounted.dispose(); assert.equal(controls[2].disposed, 1);
  startupFailure = new Error('WebGPU unavailable'); mounted = await api.mountLightWorkbenchFlow(container, last);
  assert(text().includes('Presentation unavailable (unavailable)')); assert(button('Apply').disabled); await mounted.dispose(); startupFailure = null;
  let finishStartup; startupGate = new Promise(resolve => {finishStartup = resolve;});
  mounted = await api.mountLightWorkbenchFlow(container, last); await mounted.dispose();
  await act(async () => {finishStartup(); await startupGate;}); startupGate = null; assert.equal(controls[3].disposed, 1);

  // Explicit legacy import reuses genuine V0 providers; ordinary V1 Open stays strict.
  const legacySeed = api.createNativeSceneSeed(api.createNativeSceneBase(sourceText, seed.surfaceMaterials[0].material, seed.display.camera,
    {ambientStrength: -0, directionalStrength: .6, direction: [2, -0, -4]}, {documentId: 'legacy-import', title: 'Legacy scene'}));
  const legacy = {...legacySeed, revision: -0}, legacyText = api.serializeRenderNativeSceneDocument(legacy);
  mounted = await api.mountLightWorkbenchFlow(container, last); const legacyControl = controls[4];
  await edit('Ambient strength', '.4'); await click('Apply'); await edit('Ambient strength', '.45'); await click('Apply'); await click('Undo');
  assert(text().includes('Accepted 6')); assert(!button('Undo').disabled); assert(!button('Redo').disabled);
  const historyCalls = legacyControl.calls.length;
  await click('Open'); await selectFile(file(legacyText)); assert(text().includes('Accepted 6')); assert.equal(legacyControl.calls.length, historyCalls);
  await click('Import legacy Native scene'); await selectFile(file(first)); assert(text().includes('Legacy Native scene import refused')); assert.equal(legacyControl.calls.length, historyCalls);
  await click('Import legacy Native scene'); await selectFile(file('{invalid')); assert(text().includes('Legacy Native scene import refused')); assert.equal(legacyControl.calls.length, historyCalls);
  await click('Import legacy Native scene'); await selectFile(file(JSON.stringify({...legacy, profile: 'unsupported-legacy-profile'}))); assert(text().includes('DOCUMENT_VERSION')); assert.equal(legacyControl.calls.length, historyCalls);
  let oversizedReads = 0; await click('Import legacy Native scene'); await selectFile({name: 'oversized.json', size: 2097153, arrayBuffer: async () => {oversizedReads++; return new ArrayBuffer(0);}});
  assert.equal(oversizedReads, 0); assert(text().includes('DOCUMENT_BYTES')); assert.equal(legacyControl.calls.length, historyCalls);
  assert(!button('Undo').disabled); assert(!button('Redo').disabled);
  await edit('Ambient strength', '.7'); confirmation = false; const importChoosers = fileChoosers;
  await click('Import legacy Native scene'); assert.equal(fileChoosers, importChoosers); assert.equal(container.querySelector('[aria-label="Ambient strength"]').value, '.7');
  confirmation = true; await click('Import legacy Native scene'); await act(async () => container.querySelector('input[type="file"]').dispatchEvent(new dom.window.Event('cancel', {bubbles: true})));
  assert(text().includes('File selection cancelled.')); await selectFile(file(legacyText)); assert(text().includes('STALE_CANDIDATE')); assert.equal(legacyControl.calls.length, historyCalls);
  await click('Import legacy Native scene'); await edit('Ambient strength', '.8'); await selectFile(file(legacyText)); assert(text().includes('STALE_CANDIDATE')); assert.equal(legacyControl.calls.length, historyCalls);
  legacyControl.refusal = new Error('Controlled legacy import refusal'); await click('Import legacy Native scene'); await selectFile(file(legacyText));
  assert.equal(legacyControl.calls.length, historyCalls + 1); assert(text().includes('Accepted 6')); assert.equal(container.querySelector('[aria-label="Ambient strength"]').value, '.8');
  await click('Discard'); assert(!button('Undo').disabled); assert(!button('Redo').disabled);
  legacyControl.refusal = null; await click('Import legacy Native scene'); await selectFile(file(legacyText));
  assert.equal(legacyControl.calls.length, historyCalls + 2); assert(text().includes('Legacy directional scene migrated')); assert(button('Undo').disabled); assert(button('Redo').disabled);
  assert.equal(container.querySelector('[aria-label="Ambient strength"]').value, '-0');
  const importedRequest = legacyControl.calls.at(-1);
  assert.deepEqual(importedRequest.owner, {id: 'legacy-import', revision: -0});
  assert.deepEqual(importedRequest.source.result.document, legacy.nativeDocument); assert.deepEqual(importedRequest.display.camera, legacy.display.camera);
  assert.deepEqual(importedRequest.context, {mmToSceneUnit: legacy.display.mmToSceneUnit, background: legacy.display.background});
  assert.deepEqual(importedRequest.lights.lights[0], {nodeId: 'legacy-directional', label: 'Legacy directional', enabled: true, directionScene: [2, -0, -4], colorLinearRGB: [1, 1, 1], intensity: .6});
  await click('Save accepted'); const convertedText = await downloads.at(-1).blob.text(), converted = api.parseRenderNativeLightDocument(convertedText);
  assert.equal(converted.version, 2); assert(Object.is(converted.revision, -0)); assert(Object.is(converted.lights.ambientStrength, -0));
  assert.deepEqual(converted.nativeDocument, legacy.nativeDocument); assert.deepEqual(converted.nativeOptions, legacy.nativeOptions); assert.deepEqual(converted.surfaceMaterials, legacy.surfaceMaterials);
  const {lighting: legacyLighting, ...legacyDisplay} = legacy.display; assert.equal(legacyLighting.directionalStrength, .6); assert.deepEqual(converted.display, legacyDisplay);
  await click('Open'); await selectFile(file(convertedText)); await edit('Ambient strength', '.3'); await click('Apply'); await click('Save accepted');
  const editedLegacy = api.parseRenderNativeLightDocument(await downloads.at(-1).blob.text()); assert.equal(editedLegacy.revision, 1); assert.equal(editedLegacy.lights.ambientStrength, .3);
  assert.deepEqual(editedLegacy.nativeDocument, legacy.nativeDocument); assert.deepEqual(editedLegacy.lights.lights[0].directionScene, [2, -0, -4]);
  await click('Import legacy Native scene'); let finishLegacyRead;
  await selectFile({name: 'late-legacy.json', size: legacyText.length, arrayBuffer: () => new Promise(resolve => {finishLegacyRead = resolve;})});
  assert(button('Open').disabled); assert(button('Import legacy Native scene').disabled); const acceptedLegacyCalls = legacyControl.calls.length;
  await mounted.dispose(); await act(async () => finishLegacyRead(new TextEncoder().encode(legacyText).buffer));
  assert.equal(legacyControl.calls.length, acceptedLegacyCalls); assert.equal(legacyControl.disposed, 1);
  // The preferred route starts with an explicit kind choice, then uses one generic vocabulary.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {assert.equal(url, './reference-panel.barocad'); return {ok: true, text: async () => sourceText};};
  let pointControl;
  try {
    const mountsBeforeChoice = controls.length;
    mounted = await api.mountLightWorkbenchFlow(container);
    assert(text().includes('Choose the kind')); assert.equal(controls.length, mountsBeforeChoice);
    await click('Start point workspace'); pointControl = controls.at(-1);
    assert.equal(pointControl.initial.format, 'barocss-viewer-native-point-light-input'); assert(text().includes('Light workbench · point'));
    assert(!button('Add directional')); assert(button('Add point'));
    await click('Add point'); await edit('Position X', '-0'); await edit('Position Y', '2'); await edit('Position Z', '-4');
    await edit('Range', '8'); await edit('Light label', 'Point fill'); await click('Apply'); await click('Save accepted');
    const pointFirstText = await downloads.at(-1).blob.text(), pointFirst = api.parseRenderNativeLightDocument(pointFirstText);
    assert.equal(pointFirst.lights.profile, 'native-world-point-linear-v0');
    assert.deepEqual(pointFirst.lights.lights[1].positionScene, [-0, 2, -4]); assert.equal(pointFirst.lights.lights[1].rangeScene, 8);
    const pointFields = api.readLightFields(pointFirst), fullPoints = api.addLightFields(api.addLightFields(pointFields));
    assert.equal(fullPoints.lights.length, 4); assert.throws(() => api.addLightFields(fullPoints));
    for (const mutate of [f => {f.lights[0].range='0';},f => {f.lights[0].range='1000001';},f => {f.lights[0].range='NaN';},
      f => {f.lights[0].vector[0]='Infinity';},f => {f.lights[0].vector[0]='-1000001';},f => {f.lights[0].color[1]='1.01';}]) {
      const bad=structuredClone(pointFields); mutate(bad); assert.throws(()=>api.applyLightFields(pointFirst,bad));
      assert.equal(api.serializeRenderNativeLightDocument(pointFirst),pointFirstText);
    }
    await edit('Ambient strength', '.3'); await click('Apply'); await edit('Ambient strength', '.4'); await click('Apply'); await click('Undo');
    assert(!button('Undo').disabled); assert(!button('Redo').disabled); await click('Save accepted');
    const pointBeforeRefusal = await downloads.at(-1).blob.text(), pointCalls = pointControl.calls.length;
    await edit('Range', ''); confirmation=false; const beforeNew=controls.length, beforeChooser=fileChoosers;
    await click('New directional'); await click('Open'); assert.equal(controls.length,beforeNew); assert.equal(fileChoosers,beforeChooser);
    assert.equal(container.querySelector('[aria-label="Range"]').value,''); confirmation=true;
    await click('Open'); await selectFile(file(first)); assert(text().includes('fixed light kind')); assert.equal(pointControl.calls.length,pointCalls);
    assert.equal(container.querySelector('[aria-label="Range"]').value,'');
    const mixed=JSON.parse(pointFirstText); mixed.lights.lights[0].directionScene=[1,0,0];
    await click('Open'); await selectFile(file(JSON.stringify(mixed))); assert.equal(pointControl.calls.length,pointCalls);
    await click('Import legacy Native scene'); await selectFile(file(legacyText)); assert(text().includes('fixed light kind')); assert.equal(pointControl.calls.length,pointCalls);
    await click('Save accepted'); assert.equal(await downloads.at(-1).blob.text(),pointBeforeRefusal);
    await click('Discard'); assert(!button('Undo').disabled); assert(!button('Redo').disabled);
    await click('Open'); await act(async()=>container.querySelector('input[type="file"]').dispatchEvent(new dom.window.Event('cancel',{bubbles:true})));
    assert(text().includes('File selection cancelled.')); await selectFile(file(pointFirstText)); assert.equal(pointControl.calls.length,pointCalls);
    // A pending refusal is still a refused transaction with correctable point text and old save identity.
    let releasePoint; pointControl.wait=new Promise(resolve=>{releasePoint=resolve;}); pointControl.refusal=new Error('Pending point refusal');
    await edit('Range','9'); await act(async()=>button('Apply').click()); assert(button('New directional').disabled);
    await act(async()=>{releasePoint();await pointControl.wait;}); pointControl.wait=null;
    assert.equal(container.querySelector('[aria-label="Range"]').value,'9'); await click('Save accepted');
    assert.equal(await downloads.at(-1).blob.text(),pointBeforeRefusal); pointControl.refusal=null; await click('Apply'); await click('Save accepted');
    const pointSaved=api.parseRenderNativeLightDocument(await downloads.at(-1).blob.text());
    await mounted.dispose(); assert.equal(pointControl.disposed,1);
    mounted=await api.mountLightWorkbenchFlow(container,pointSaved); const pointFresh=controls.at(-1);
    await click('Open'); await selectFile(file(api.serializeRenderNativeLightDocument(pointSaved)));
    assert.equal(pointFresh.calls.length,1); assert(button('Undo').disabled); await edit('Position X','4'); await click('Apply'); await click('Save accepted');
    const pointSecond=api.parseRenderNativeLightDocument(await downloads.at(-1).blob.text());
    assert.deepEqual(pointSecond.nativeDocument,pointSaved.nativeDocument); assert.deepEqual(pointSecond.surfaceMaterials,pointSaved.surfaceMaterials);
    assert.deepEqual(pointSecond.display,pointSaved.display); assert.equal(pointSecond.lights.lights[0].positionScene[0],4);
    await click('Add point'); await click('Add point'); assert(button('Add point').disabled); await click('Apply');
    for(let i=0;i<4;i++)await click('Remove light'); await click('Apply'); assert(text().includes('0 / 4 point'));
    await click('Undo'); assert(text().includes('4 / 4 point'));
    // Accepted new-workspace choice creates a new lifetime; it is not a cross-backend Open.
    startupFailure=new Error('New directional workspace unavailable');
    await click('New directional'); assert.equal(pointFresh.disposed,1);
    assert(text().includes('No scene has been accepted in this workspace.'));
    assert(!text().includes('Accepted data is retained.')); assert(button('Save accepted').disabled);
    startupFailure=null; await click('Retry workspace'); assert(text().includes('Light workbench · directional'));
    assert(button('Add directional')); assert(!button('Add point'));
    const preferredDirectional=controls.at(-1), strictV1={...seed,version:1,profile:'canonical-native-directional-lights-v1'};
    const strictText=api.serializeRenderNativeDirectionalLightDocument(strictV1);
    const strictParsed=api.parseRenderNativeDirectionalLightDocument(strictText);
    await click('Open'); await selectFile(file(strictText)); assert(text().includes('Legacy directional scene migrated'));
    assert.deepEqual(preferredDirectional.calls.at(-1).lights,strictParsed.lights);
    await click('Save accepted'); const genericReopened=api.parseRenderNativeLightDocument(await downloads.at(-1).blob.text());
    assert.deepEqual(genericReopened.nativeDocument,strictParsed.nativeDocument); assert.deepEqual(genericReopened.surfaceMaterials,strictParsed.surfaceMaterials);
    assert.deepEqual(genericReopened.display,strictParsed.display); assert.deepEqual(genericReopened.lights,strictParsed.lights);
    assert.throws(()=>api.parseRenderNativeDirectionalLightDocument(api.serializeRenderNativeLightDocument(genericReopened)));
    await mounted.dispose(); assert.equal(preferredDirectional.disposed,1);
  } finally {globalThis.fetch=originalFetch;}

  // Authored camera is part of the same real provider-backed form and session for both kinds.
  // Controlled Viewers acknowledge software transactions only; they do not prove pixels or file I/O.
  const cameraFlow = [];
  const cameraEntries = camera => [
    ...['eye', 'target', 'up'].flatMap(vector => ['X', 'Y', 'Z'].map((axis, index) =>
      ['Camera ' + vector + ' ' + axis, camera[vector][index]])),
    ['Vertical FOV (degrees)', camera.fovYDegrees], ['Near clip (scene units)', camera.near], ['Far clip (scene units)', camera.far],
  ];
  const inputValue = label => {
    const input = container.querySelector(`[aria-label="${label}"]`); assert(input, 'Missing input ' + label); return input.value;
  };
  const assertCamera = camera => {for (const [label, value] of cameraEntries(camera)) assert.equal(inputValue(label), value, label);};
  const editCamera = async camera => {for (const [label, value] of cameraEntries(camera)) await edit(label, value);};
  const saveText = async () => {await click('Save accepted'); return downloads.at(-1).blob.text();};
  const assertHistory = () => {assert(!button('Undo').disabled); assert(!button('Redo').disabled);};
  const unloadBlocked = () => {
    const event = new dom.window.Event('beforeunload', {cancelable: true}); dom.window.dispatchEvent(event); return event.defaultPrevented;
  };
  const assertAuthorship = (actual, expected) => {
    for (const key of ['nativeDocument', 'nativeOptions', 'surfaceMaterials']) assert.deepEqual(actual[key], expected[key], key);
    const actualDisplay = {...actual.display}, expectedDisplay = {...expected.display};
    delete actualDisplay.camera; delete expectedDisplay.camera;
    assert.deepEqual(actualDisplay, expectedDisplay);
    assert.equal(Object.hasOwn(actual.surfaceMaterials[1].material.uniforms, 'amount'), false, 'Omitted uniform stays omitted');
    assert(Object.is(actual.display.poses[0].translationMM[1], -0), 'Unedited pose signed zero survives');
  };
  const cameraDraft = {eye: ['2', '3', '6'], target: ['-0', '-.5', '0'], up: ['-0', '2', '-0'],
    fovYDegrees: '55', near: '.025', far: '120'};
  const invalidCameras = [
    ['empty coordinate', camera => {camera.eye[0] = '';}, /finite decimal/],
    ['blank coordinate', camera => {camera.target[1] = ' ';}, /finite decimal/],
    ['NaN up', camera => {camera.up[0] = 'NaN';}, /finite decimal/],
    ['infinite coordinate', camera => {camera.eye[2] = 'Infinity';}, /finite decimal/],
    ['eye bounds', camera => {camera.eye[0] = '1000.01';}, /Camera.eye.*bounded/],
    ['target bounds', camera => {camera.target[0] = '-1000.01';}, /Camera.target.*bounded/],
    ['coincident eye and target', camera => {camera.target = [...camera.eye];}, /eye-target separation/],
    ['tiny separation', camera => {camera.eye = ['0', '0', '0']; camera.target = ['0', '0', '.00001'];}, /eye-target separation/],
    ['zero up', camera => {camera.up = ['0', '0', '-0'];}, /up length/],
    ['tiny up', camera => {camera.up = ['0', '.0000001', '0'];}, /up length/],
    ['parallel up', camera => {camera.eye = ['0', '0', '6']; camera.target = ['0', '0', '0']; camera.up = ['0', '0', '2'];}, /axes are singular/],
    ['near-parallel up', camera => {camera.eye = ['0', '0', '6']; camera.target = ['0', '0', '0']; camera.up = ['.00000001', '0', '1'];}, /axes are singular/],
    ['low FOV', camera => {camera.fovYDegrees = '9.99';}, /FOV/],
    ['high FOV', camera => {camera.fovYDegrees = '100.01';}, /FOV/],
    ['empty clipping', camera => {camera.near = '';}, /finite decimal/],
    ['nonfinite clipping', camera => {camera.far = '-Infinity';}, /finite decimal/],
    ['zero near', camera => {camera.near = '0';}, /clipping/],
    ['near below bound', camera => {camera.near = '.00001';}, /clipping/],
    ['far above bound', camera => {camera.far = '10000.01';}, /clipping/],
    ['equal clipping', camera => {camera.far = camera.near;}, /clipping/],
    ['reversed clipping', camera => {camera.near = '121';}, /clipping/],
    ['Float32 clipping collapse', camera => {camera.near = '1'; camera.far = '1.00000001';}, /Float32 clipping planes collapse/],
    ['Float32 depth conditioning', camera => {camera.near = '.0001'; camera.far = '10000';}, /Float32 projection/],
  ];
  globalThis.fetch = async url => {assert.equal(url, './reference-panel.barocad'); return {ok: true, text: async () => sourceText};};
  try {
    for (const kind of ['directional', 'point']) {
      const owned = structuredClone(api.createLightStudy(sourceText, kind));
      // A source-declared default must remain omitted while camera and light values change.
      delete owned.surfaceMaterials[1].material.uniforms.amount;
      const cameraSeed = api.prepareRenderNativeLightDocument(owned).document;
      const seedText = api.serializeRenderNativeLightDocument(cameraSeed), seedFields = api.readLightFields(cameraSeed);
      const authoredFields = structuredClone(seedFields);
      authoredFields.camera = structuredClone(cameraDraft); authoredFields.lights[0].vector = ['-0', '2', '-4'];
      authoredFields.lights[0].intensity = '.4';
      const authored = api.applyLightFields(cameraSeed, authoredFields);
      assertAuthorship(authored, cameraSeed);
      assert.deepEqual(authored.display.camera, {eye: [2, 3, 6], target: [-0, -.5, 0], up: [-0, 2, -0], fovYDegrees: 55, near: .025, far: 120});
      assert(Object.is(authored.display.camera.target[0], -0)); assert(Object.is(authored.display.camera.up[0], -0));
      assert(Object.is(authored.display.camera.up[2], -0)); assert.equal(authored.display.camera.up[1], 2);
      const vectorKey = kind === 'point' ? 'positionScene' : 'directionScene', vectorLabel = kind === 'point' ? 'Position ' : 'Direction ';
      assert.deepEqual(authored.lights.lights[0][vectorKey], [-0, 2, -4]);
      assert.equal(api.readLightFields(authored).camera.target[0], '-0');
      assert.equal(api.lightFieldsDirty(authoredFields, cameraSeed), true);
      for (const [name, mutate, diagnostic] of invalidCameras) {
        const invalid = structuredClone(authoredFields); mutate(invalid.camera); const before = structuredClone(invalid);
        assert.throws(() => api.applyLightFields(cameraSeed, invalid), diagnostic, kind + ': ' + name);
        assert.deepEqual(invalid, before, 'Validation must retain corrective strings: ' + name);
        assert.equal(api.serializeRenderNativeLightDocument(cameraSeed), seedText, 'Validation must not alter accepted authorship');
      }
      // Even very large valid raw up magnitude belongs to authorship, not an app normalization.
      const largeUp = structuredClone(authoredFields); largeUp.camera.up = ['-0', '1e200', '0'];
      assert.deepEqual(api.applyLightFields(cameraSeed, largeUp).display.camera.up, [-0, 1e200, 0]);
      mounted = await api.mountLightWorkbenchFlow(container, cameraSeed); const cameraControl = controls.at(-1);
      assert.equal(cameraControl.initial.format, 'barocss-viewer-native-' + kind + '-light-input');
      assert(text().includes('Scene camera')); assertCamera(seedFields.camera); assert.equal(await saveText(), seedText); assert.equal(unloadBlocked(), false);
      await editCamera(cameraDraft);
      for (const [index, axis] of ['X', 'Y', 'Z'].entries()) await edit(vectorLabel + axis, authoredFields.lights[0].vector[index]);
      await edit('Intensity', '.4'); assert(text().includes('Unapplied draft')); assert.equal(unloadBlocked(), true);
      assert.equal(await saveText(), seedText, 'Save excludes both camera and light draft text');
      await click('Apply'); assert.equal(cameraControl.calls.length, 1, 'Combined camera/light Apply uses one replacement');
      const authoredText = await saveText(), acceptedAuthored = api.parseRenderNativeLightDocument(authoredText);
      assert.equal(acceptedAuthored.revision, cameraSeed.revision + 1);
      assert.deepEqual(acceptedAuthored.display.camera, authored.display.camera); assert.deepEqual(acceptedAuthored.lights.lights, authored.lights.lights);
      assertAuthorship(acceptedAuthored, cameraSeed);
      const request = cameraControl.calls.at(-1);
      assert.deepEqual(request.display.camera, acceptedAuthored.display.camera); assert.deepEqual(request.lights, acceptedAuthored.lights);
      assert.deepEqual(request.source.result.document, cameraSeed.nativeDocument); assert.deepEqual(request.source.options, cameraSeed.nativeOptions);
      assert.deepEqual(request.context, {mmToSceneUnit: cameraSeed.display.mmToSceneUnit, background: cameraSeed.display.background});
      await click('Undo'); assert.equal(cameraControl.calls.length, 2); assertCamera(seedFields.camera);
      assert.equal(inputValue('Intensity'), seedFields.lights[0].intensity); assert(button('Undo').disabled, 'Combined Apply has exactly one history entry');
      const undone = api.parseRenderNativeLightDocument(await saveText());
      assert.deepEqual(undone.display.camera, cameraSeed.display.camera); assert.deepEqual(undone.lights.lights, cameraSeed.lights.lights);
      await click('Redo'); assert.equal(cameraControl.calls.length, 3); assertCamera(api.readLightFields(acceptedAuthored).camera);
      assert.equal(inputValue('Intensity'), '0.4'); assert(button('Redo').disabled);
      await edit('Camera eye X', '4'); await edit('Intensity', '.5'); await click('Apply'); await click('Undo'); assertHistory();
      const retainedText = await saveText(), retained = api.parseRenderNativeLightDocument(retainedText), retainedFields = api.readLightFields(retained);
      const retainedCalls = cameraControl.calls.length;
      assert.deepEqual(retained.display.camera, acceptedAuthored.display.camera); assert.deepEqual(retained.lights.lights, acceptedAuthored.lights.lights);
      // Invalid camera text must keep a simultaneous, valid light correction and both history branches.
      for (const [label, value] of [['Camera eye X', ''], ['Camera target X', '1001'], ['Camera up Y', '0'], ['Vertical FOV (degrees)', '101']]) {
        await edit(label, value); await edit('Intensity', '.42'); await click('Apply');
        assert.equal(cameraControl.calls.length, retainedCalls); assert.equal(inputValue(label), value); assert.equal(inputValue('Intensity'), '.42');
        assert.equal(await saveText(), retainedText); await click('Discard'); assertCamera(retainedFields.camera); assertHistory();
      }
      await edit('Camera eye X', '3'); await edit('Intensity', ''); await click('Apply');
      assert.equal(cameraControl.calls.length, retainedCalls); assert.equal(inputValue('Camera eye X'), '3'); assert.equal(inputValue('Intensity'), '');
      assert.equal(await saveText(), retainedText); await click('Discard'); assertCamera(retainedFields.camera); assertHistory();
      // Camera-only drafts participate in unload and every ordinary replacement confirmation.
      await edit('Camera eye X', '-0'); assert.equal(unloadBlocked(), true);
      confirmation = false; const beforePrompts = dialogs.length, beforeChoosers = fileChoosers, beforeMounts = controls.length;
      for (const action of ['Open', 'Import legacy Native scene', 'New directional', 'New point', 'Back to materials']) await click(action);
      assert.equal(dialogs.length, beforePrompts + 5); assert.equal(fileChoosers, beforeChoosers); assert.equal(controls.length, beforeMounts);
      assert.equal(cameraControl.calls.length, retainedCalls); assert.equal(inputValue('Camera eye X'), '-0');
      assert.equal(await saveText(), retainedText); confirmation = true; await click('Discard'); assertHistory(); assert.equal(unloadBlocked(), false);
      await click('Open'); await edit('Camera eye X', '3'); await selectFile(file(authoredText));
      assert(text().includes('STALE_CANDIDATE')); assert.equal(cameraControl.calls.length, retainedCalls); assert.equal(inputValue('Camera eye X'), '3');
      await edit('Intensity', '.43'); await click('Open');
      await act(async () => container.querySelector('input[type="file"]').dispatchEvent(new dom.window.Event('cancel', {bubbles: true})));
      assert(text().includes('File selection cancelled.')); assert.equal(inputValue('Camera eye X'), '3'); assert.equal(inputValue('Intensity'), '.43');
      await selectFile(file(authoredText)); assert(text().includes('STALE_CANDIDATE')); assert.equal(cameraControl.calls.length, retainedCalls);
      assert.equal(await saveText(), retainedText); await click('Discard'); assertHistory();
      cameraControl.refusal = new Error('Controlled combined camera/light refusal');
      await edit('Vertical FOV (degrees)', '58'); await edit('Intensity', '.44'); await click('Apply');
      assert.equal(cameraControl.calls.length, retainedCalls + 1); assert(text().includes('PRESENTATION_REFUSED'));
      assert.equal(inputValue('Vertical FOV (degrees)'), '58'); assert.equal(inputValue('Intensity'), '.44');
      assert.equal(await saveText(), retainedText); await click('Discard'); assertCamera(retainedFields.camera); assertHistory();
      let releaseCamera; cameraControl.wait = new Promise(resolve => {releaseCamera = resolve;});
      await edit('Vertical FOV (degrees)', '62'); await edit('Intensity', '.45'); await act(async () => button('Apply').click());
      assert.equal(cameraControl.calls.length, retainedCalls + 2); assert.equal(unloadBlocked(), true);
      for (const label of ['Apply', 'Discard', 'Undo', 'Redo', 'Open', 'Save accepted', 'Import legacy Native scene', 'New directional', 'New point', 'Back to materials', 'Add ' + kind, 'Remove light'])
        assert(button(label).disabled, 'Pending transaction fences ' + label);
      for (const [label] of cameraEntries(cameraDraft)) assert(container.querySelector(`[aria-label="${label}"]`).disabled, 'Pending camera field ' + label);
      assert(container.querySelector('[aria-label="Intensity"]').disabled);
      await act(async () => {button('Apply').click(); button('Open').click(); button('New point').click();});
      assert.equal(cameraControl.calls.length, retainedCalls + 2, 'Repeated pending clicks cannot start another transaction');
      await act(async () => {releaseCamera(); await cameraControl.wait;}); cameraControl.wait = null;
      assert(text().includes('PRESENTATION_REFUSED')); assert.equal(inputValue('Vertical FOV (degrees)'), '62'); assert.equal(inputValue('Intensity'), '.45');
      assert.equal(await saveText(), retainedText); await click('Discard'); assertHistory(); assertCamera(retainedFields.camera);
      cameraControl.refusal = null; await edit('Vertical FOV (degrees)', '62'); await edit('Intensity', '.45'); await click('Apply');
      assert.equal(cameraControl.calls.length, retainedCalls + 3); assert(button('Redo').disabled);
      const composedText = await saveText(), composed = api.parseRenderNativeLightDocument(composedText);
      assert.equal(composed.revision, retained.revision + 1); assert.equal(composed.display.camera.fovYDegrees, 62); assert.equal(composed.lights.lights[0].intensity, .45);
      assertAuthorship(composed, cameraSeed); await mounted.dispose(); assert.equal(cameraControl.disposed, 1);
      // Fresh preferred-route lifetime must use its chooser to load authored camera, then re-edit it.
      const mountsBeforeChoice = controls.length; mounted = await api.mountLightWorkbenchFlow(container);
      assert(text().includes('Choose the kind')); assert.equal(controls.length, mountsBeforeChoice); await click('Start ' + kind + ' workspace');
      const freshCamera = controls.at(-1); assert.equal(freshCamera.initial.format, 'barocss-viewer-native-' + kind + '-light-input');
      await click('Open'); await selectFile(file(composedText)); assert.equal(freshCamera.calls.length, 1);
      assertCamera(api.readLightFields(composed).camera); assert.equal(inputValue('Intensity'), '0.45');
      assert(button('Undo').disabled); assert(button('Redo').disabled); assert.equal(await saveText(), composedText);
      await edit('Camera eye X', '-0'); await edit('Intensity', '.6'); await click('Apply');
      assert.equal(freshCamera.calls.length, 2); const reedited = api.parseRenderNativeLightDocument(await saveText());
      assert.equal(reedited.revision, composed.revision + 1); assert(Object.is(reedited.display.camera.eye[0], -0));
      assert.deepEqual(reedited.display.camera.up, [-0, 2, -0]); assert.equal(reedited.lights.lights[0].intensity, .6); assertAuthorship(reedited, composed);
      // Give the old lifetime both history branches before allowing a replacement to complete late.
      await edit('Camera target Y', '-.75'); await edit('Intensity', '.55'); await click('Apply'); await click('Undo'); assertHistory();
      const beforeLateText = await saveText(), beforeLate = api.parseRenderNativeLightDocument(beforeLateText);
      let releaseLateCamera; freshCamera.wait = new Promise(resolve => {releaseLateCamera = resolve;});
      await edit('Vertical FOV (degrees)', '70'); await edit('Intensity', '.62'); await act(async () => button('Apply').click());
      assert(button('Open').disabled); const oldCalls = freshCamera.calls.length;
      await mounted.dispose(); assert.equal(freshCamera.disposed, 1);
      mounted = await api.mountLightWorkbenchFlow(container, beforeLate); const afterLate = controls.at(-1);
      await act(async () => {releaseLateCamera(); await freshCamera.wait;}); freshCamera.wait = null;
      assert.equal(freshCamera.calls.length, oldCalls); assert.equal(freshCamera.disposed, 1); assert.equal(afterLate.calls.length, 0);
      assertCamera(api.readLightFields(beforeLate).camera); assert.equal(inputValue('Intensity'), '0.6');
      assert.equal(await saveText(), beforeLateText, 'Late presentation cannot publish into the current lifetime');
      assert(button('Undo').disabled); assert(button('Redo').disabled);
      // A late chooser read is also inert after its owning camera/light workspace is disposed.
      let releaseCameraRead; await click('Open');
      await selectFile({name: 'late-camera.json', size: composedText.length, arrayBuffer: () => new Promise(resolve => {releaseCameraRead = resolve;})});
      assert(button('Apply').disabled); assert(button('Open').disabled); assert(button('New directional').disabled);
      await mounted.dispose(); mounted = await api.mountLightWorkbenchFlow(container, cameraSeed); const afterRead = controls.at(-1);
      await act(async () => releaseCameraRead(new TextEncoder().encode(composedText).buffer));
      assert.equal(afterLate.calls.length, 0); assert.equal(afterLate.disposed, 1); assert.equal(afterRead.calls.length, 0);
      assertCamera(seedFields.camera); assert.equal(await saveText(), seedText); await mounted.dispose(); assert.equal(afterRead.disposed, 1);
      cameraFlow.push({kind, invalidCameraCases: invalidCameras.length, combinedReplacements: cameraControl.calls.length,
        freshChooserReplacements: freshCamera.calls.length, reopenedRevision: composed.revision, reeditedRevision: reedited.revision});
    }
  } finally {confirmation = true; globalThis.fetch = originalFetch;}

  // Body IDs, never duplicate labels or native geometry names, own the six corrective strings.
  const bodyFlow = [], A = 'body_preview_a', B = 'body_preview_b';
  const bodyEntries = body => ['position', 'scale'].flatMap(key => ['X', 'Y', 'Z'].map((axis, index) =>
    ['Body ' + key + ' ' + axis + (key === 'position' ? ' (mm)' : ''), body[key][index]]));
  const assertBody = body => {for (const [label, value] of bodyEntries(body)) assert.equal(inputValue(label), value, body.bodyId + ': ' + label);};
  const editBody = async body => {for (const [label, value] of bodyEntries(body)) await edit(label, value);};
  const selectBody = async bodyId => {await click('Edit body ' + bodyId); assert.equal(button('Edit body ' + bodyId).getAttribute('aria-pressed'), 'true');};
  const assertBodies = async bodies => {for (const body of bodies) {await selectBody(body.bodyId); assertBody(body);}};
  const poseFor = (document, bodyId) => document.display.poses.find(pose => pose.bodyId === bodyId);
  const assertBodyAuthority = (actual, expected) => {
    for (const key of ['nativeDocument', 'nativeOptions', 'surfaceMaterials']) assert.deepEqual(actual[key], expected[key], key);
    for (const key of ['mmToSceneUnit', 'background', 'visibleBodyIds', 'basis']) assert.deepEqual(actual.display[key], expected.display[key], key);
    assert.deepEqual(actual.display.poses.map(pose => pose.bodyId), expected.display.poses.map(pose => pose.bodyId), 'Accepted pose order is independent of target order');
    for (const pose of expected.display.poses) assert.deepEqual(poseFor(actual, pose.bodyId).rotationXYZW, pose.rotationXYZW, 'Raw XYZW for ' + pose.bodyId);
    assert.equal(Object.hasOwn(actual.surfaceMaterials[0].material.uniforms, 'amount'), false, 'Omitted authored uniform stays omitted');
  };
  // This is the same public appearance boundary used by both actual light providers.
  // Only the Viewer acknowledgement is controlled; this preparation is genuine CPU provider work.
  const prepareBodyAppearance = request => api.prepareViewerNativeSceneAppearance({version: 1,
    source: request.source, display: request.display,
    appearance: {lighting: {ambientStrength: 1, directionalStrength: 0, direction: [0, 0, 1]}, materials: request.materials}}, request.context);
  const errorTree = (error, depth = 0) => !error || depth > 6 || typeof error !== 'object' ? String(error)
    : {name: error.name, message: error.message, code: error.code, cause: error.cause === undefined ? null : errorTree(error.cause, depth + 1)};
  const invalidBodies = [
    ['unknown identity', fields => {fields.bodies[0].bodyId = 'foreign_body';}],
    ['geometry is not identity', fields => {fields.bodies[0].bodyId = 'reference_panel';}],
    ['asset is not identity', fields => {fields.bodies[0].bodyId = 'preview_b';}],
    ['label is not identity', fields => {fields.bodies[0].bodyId = 'Repeated Surface';}],
    ['duplicate identity', fields => {fields.bodies[1].bodyId = fields.bodies[0].bodyId;}],
    ['missing identity', fields => {fields.bodies.pop();}],
    ['sparse identity', fields => {delete fields.bodies[0];}],
    ['missing position coordinate', fields => {fields.bodies[0].position.pop();}],
    ['extra scale coordinate', fields => {fields.bodies[1].scale.push('1');}],
    ['reordered identities', fields => {fields.bodies.reverse();}],
    ...['', ' ', 'NaN', 'Infinity', '-Infinity', '1e', '0x10', '10000.01', '-10000.01'].map(value =>
      ['position ' + JSON.stringify(value), fields => {fields.bodies[0].position[0] = value;}]),
    ...['', 'NaN', 'Infinity', '0', '-0', '-1', '.0009', '100.01'].map(value =>
      ['scale ' + JSON.stringify(value), fields => {fields.bodies[1].scale[2] = value;}]),
  ];
  globalThis.fetch = async url => {assert.equal(url, './reference-panel.barocad'); return {ok: true, text: async () => sourceText};};
  try {
    for (const kind of ['directional', 'point']) {
      const raw = structuredClone(api.createLightStudy(sourceText, kind));
      raw.nativeDocument.bodies.forEach(body => {body.name = 'Repeated Surface';});
      raw.nativeOptions.bodyIds = [B, A]; // Deliberately differs from original poses [A, B].
      raw.display.visibleBodyIds = [B];
      raw.surfaceMaterials = raw.surfaceMaterials.filter(item => item.target.bodyId === B);
      delete raw.surfaceMaterials[0].material.uniforms.amount;
      const quaternion = [-0, Math.sin(.2) * (1 + 2e-10), -0, Math.cos(.2) * (1 + 2e-10)];
      raw.display.poses.find(pose => pose.bodyId === B).rotationXYZW = quaternion;
      const preparedSeed = api.prepareRenderNativeLightDocument(raw), bodySeed = preparedSeed.document;
      const bodySeedText = api.serializeRenderNativeLightDocument(bodySeed), bodyFields = api.readLightFields(bodySeed);
      assert.deepEqual(bodyFields.bodies.map(body => body.bodyId), [B, A]);
      assert.deepEqual(bodyFields.bodies.map(body => Object.keys(body).sort()), [['bodyId', 'position', 'rotation', 'scale'], ['bodyId', 'position', 'rotation', 'scale']]);
      assert.equal(new Set(preparedSeed.entries.map(entry => entry.binding.bodyId)).size, 2);
      assert.equal(new Set(preparedSeed.entries.map(entry => entry.binding.assetId)).size, 2);
      assert(preparedSeed.entries.every(entry => entry.binding.modelId === 'cloth_reference_981' && entry.binding.geometryId === 'reference_panel'));
      assert.equal(bodyFields.bodies[0].position[1], '-0'); assert.equal(bodyFields.bodies[1].position[1], '-0');
      const bodyDraft = structuredClone(bodyFields);
      bodyDraft.bodies[0].position = ['1050', '-0', '80']; bodyDraft.bodies[0].scale = ['1.2', '.8', '1.1'];
      const posed = api.applyLightFields(bodySeed, bodyDraft);
      assertBodyAuthority(posed, bodySeed); assert.deepEqual(poseFor(posed, A), poseFor(bodySeed, A), 'Hidden unedited body remains exact');
      assert.deepEqual(poseFor(posed, B).translationMM, [1050, -0, 80]); assert.deepEqual(poseFor(posed, B).scale, [1.2, .8, 1.1]);
      assert.deepEqual(poseFor(posed, B).rotationXYZW, quaternion); assert(Object.is(poseFor(posed, B).rotationXYZW[0], -0));
      assert.notEqual(Math.hypot(...quaternion), 1, 'Fixture distinguishes raw quaternion from normalized output');
      assert.equal(api.lightFieldsDirty(bodyDraft, bodySeed), true);
      for (const [name, mutate] of invalidBodies) {
        const invalid = structuredClone(bodyDraft); mutate(invalid); const before = structuredClone(invalid);
        assert.throws(() => api.applyLightFields(bodySeed, invalid), undefined, kind + ': ' + name);
        assert.deepEqual(invalid, before, 'Refusal retains corrective body text: ' + name);
        assert.equal(api.serializeRenderNativeLightDocument(bodySeed), bodySeedText);
      }
      const boundary = structuredClone(bodyDraft); boundary.bodies[0].position = ['-10000', '10000', '-0']; boundary.bodies[0].scale = ['.001', '100', '1'];
      const atBounds = api.applyLightFields(bodySeed, boundary);
      assert.deepEqual(poseFor(atBounds, B).translationMM, [-10000, 10000, -0]); assert.deepEqual(poseFor(atBounds, B).scale, [.001, 100, 1]);
      const validRequest = api.createRenderNativeLightRequest(posed), validAppearance = prepareBodyAppearance(validRequest);
      assert.equal(validAppearance.inventory.length, 2); assert.equal(validAppearance.prepared.primitives.length, 1);
      assert.deepEqual(validAppearance.source.result.document, bodySeed.nativeDocument);
      assert.deepEqual(validAppearance.source.bindings, validRequest.source.bindings);
      assert.deepEqual(validAppearance.context, {mmToSceneUnit: bodySeed.display.mmToSceneUnit, background: bodySeed.display.background});
      assert.deepEqual(validRequest.display.motion.frame.poses.find(pose => pose.targetId === 'body:' + B).rotation, quaternion);
      // Follow #1471's witnessed identity-q X overwrite, not a tiny addition swallowed by an existing coordinate.
      const tinyFields = structuredClone(bodyFields); tinyFields.bodies[1].position[0] = '1e-50';
      const tiny = api.applyLightFields(bodySeed, tinyFields), tinyRequest = api.createRenderNativeLightRequest(tiny);
      assert.equal(poseFor(tiny, A).translationMM[0], 1e-50, 'Genuine document/request structural admission precedes provider refusal');
      let providerError = null; try {prepareBodyAppearance(tinyRequest);} catch (error) {providerError = error;}
      const providerOutcome = {structuralAdmission: true, refused: providerError !== null, error: errorTree(providerError)};
      assert(providerError, 'Predicted X=1e-50 provider witness was admitted; report actual outcome instead of claiming underflow');
      assert.match(JSON.stringify(providerOutcome.error), /underflow/i, 'Preserve actual unexpected refusal cause instead of inventing pose law');
      assert.equal(api.serializeRenderNativeLightDocument(bodySeed), bodySeedText);

      const empty = api.prepareRenderNativeLightDocument({...bodySeed, display: {...bodySeed.display, poses: []}}).document;
      const emptyText = api.serializeRenderNativeLightDocument(empty), emptyFields = api.readLightFields(empty);
      assert.deepEqual(emptyFields.bodies, [B, A].map(bodyId => ({bodyId, position: ['0', '0', '0'], scale: ['1', '1', '1'], rotation: ['0', '0', '0', '1']})));
      assert.deepEqual(api.applyLightFields(empty, emptyFields).display.poses, []);
      const lexical = structuredClone(emptyFields); lexical.bodies[0].position = ['+0.00', '0e3', '0.000']; lexical.bodies[1].scale = ['1.00', '1e0', '+1'];
      assert.deepEqual(api.applyLightFields(empty, lexical).display.poses, [], 'Lexical edits with identical signed values do not expand identity intent');
      const cameraOnly = structuredClone(emptyFields); cameraOnly.camera.fovYDegrees = '55';
      assert.deepEqual(api.applyLightFields(empty, cameraOnly).display.poses, []);
      const lightOnly = structuredClone(emptyFields); lightOnly.lights[0].intensity = '.4';
      assert.deepEqual(api.applyLightFields(empty, lightOnly).display.poses, []);
      const signed = structuredClone(emptyFields); signed.bodies[0].position[0] = '-0';
      const signedDocument = api.applyLightFields(empty, signed);
      assert.deepEqual(signedDocument.display.poses, [
        {bodyId: B, translationMM: [-0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]},
        {bodyId: A, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]},
      ]);
      assert.deepEqual(signedDocument.display.visibleBodyIds, [B]); assert.equal(api.readLightFields(signedDocument).bodies[0].position[0], '-0');
      const nonzero = structuredClone(emptyFields); nonzero.bodies[1].position[2] = '50'; nonzero.bodies[1].scale[0] = '1.1';
      const expanded = api.applyLightFields(empty, nonzero);
      assert.deepEqual(expanded.display.poses.map(pose => pose.bodyId), [B, A]);
      assert.deepEqual(poseFor(expanded, B), {bodyId: B, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]});
      assert.deepEqual(poseFor(expanded, A), {bodyId: A, translationMM: [0, 0, 50], rotationXYZW: [0, 0, 0, 1], scale: [1.1, 1, 1]});
      assert.equal(api.serializeRenderNativeLightDocument(empty), emptyText);

      mounted = await api.mountLightWorkbenchFlow(container, empty); const emptyControl = controls.at(-1);
      assertBody(emptyFields.bodies[0]); assert.equal(button('Edit body ' + B).getAttribute('aria-pressed'), 'true');
      assert(button('Edit body ' + A).textContent.includes('Hidden'));
      assert(button('Edit body ' + A).textContent.includes('Repeated Surface')); assert(button('Edit body ' + B).textContent.includes('Repeated Surface'));
      assert.equal(await saveText(), emptyText); const beforeSelection = text();
      await selectBody(A); await selectBody(B); assert.equal(text(), beforeSelection); assert.equal(emptyControl.calls.length, 0);
      assert.equal(unloadBlocked(), false); assert(button('Apply').disabled); assert.equal(await saveText(), emptyText);
      for (const [label, value] of [['Body position X (mm)', '+0.00'], ['Body scale X', '1.0']]) {
        await edit(label, value); assert(text().includes('Unapplied draft')); await click('Apply');
        assert.equal(emptyControl.calls.length, 0, 'Lexical body no-op must not present or create history');
        assert.equal(await saveText(), emptyText); assertBody(emptyFields.bodies[0]);
        assert(button('Apply').disabled); assert(button('Undo').disabled); assert(button('Redo').disabled); assert.equal(unloadBlocked(), false);
      }
      await edit('Vertical FOV (degrees)', '55'); await click('Apply');
      assert.deepEqual(api.parseRenderNativeLightDocument(await saveText()).display.poses, []);
      await edit('Intensity', '.4'); await click('Apply');
      assert.deepEqual(api.parseRenderNativeLightDocument(await saveText()).display.poses, []);
      await edit('Body position X (mm)', '-0'); await click('Apply');
      assert.deepEqual(api.parseRenderNativeLightDocument(await saveText()).display.poses, signedDocument.display.poses);
      await click('Undo'); assert.deepEqual(api.parseRenderNativeLightDocument(await saveText()).display.poses, []);
      await click('Redo'); assert.deepEqual(api.parseRenderNativeLightDocument(await saveText()).display.poses, signedDocument.display.poses);
      await mounted.dispose(); assert.equal(emptyControl.disposed, 1);

      mounted = await api.mountLightWorkbenchFlow(container, bodySeed); const bodyControl = controls.at(-1);
      bodyControl.prepare = prepareBodyAppearance;
      assert.equal(bodyControl.initial.format, 'barocss-viewer-native-' + kind + '-light-input');
      assertBody(bodyFields.bodies[0]); assert.equal(await saveText(), bodySeedText);
      // Both valid and invalid raw drafts survive local body selection, independently of the light selection.
      await edit('Body position X (mm)', '1e'); await edit('Body scale Z', ''); await edit('Camera eye X', '3'); await edit('Intensity', '.41');
      await selectBody(A); assertBody(bodyFields.bodies[1]); await edit('Body position X (mm)', '-0950.00'); await edit('Body scale Y', '1.050');
      await selectBody(B); assert.equal(inputValue('Body position X (mm)'), '1e'); assert.equal(inputValue('Body scale Z'), '');
      await selectBody(A); assert.equal(inputValue('Body position X (mm)'), '-0950.00'); assert.equal(inputValue('Body scale Y'), '1.050');
      assert.equal(inputValue('Camera eye X'), '3'); assert.equal(inputValue('Intensity'), '.41'); assert.equal(bodyControl.calls.length, 0);
      assert.equal(await saveText(), bodySeedText); assert.equal(unloadBlocked(), true);
      await click('Add ' + kind); await edit('Light label', 'Independent light selection'); await selectBody(B);
      assert.equal(inputValue('Light label'), 'Independent light selection'); assert.equal(inputValue('Body position X (mm)'), '1e');
      await click('Discard'); assert.equal(button('Edit body ' + B).getAttribute('aria-pressed'), 'true');
      await assertBodies(bodyFields.bodies); assertCamera(bodyFields.camera); assert.equal(inputValue('Intensity'), bodyFields.lights[0].intensity);
      assert.equal(bodyControl.calls.length, 0); assert.equal(unloadBlocked(), false);
      const combinedFields = structuredClone(bodyDraft);
      combinedFields.bodies[1].position[0] = '-950'; combinedFields.bodies[1].scale[1] = '1.05';
      combinedFields.camera = structuredClone(cameraDraft); combinedFields.lights[0].vector = ['-0', '2', '-4']; combinedFields.lights[0].intensity = '.4';
      for (const body of combinedFields.bodies) {await selectBody(body.bodyId); await editBody(body);}
      await editCamera(combinedFields.camera);
      const vectorLabel = kind === 'point' ? 'Position ' : 'Direction ';
      for (const [index, axis] of ['X', 'Y', 'Z'].entries()) await edit(vectorLabel + axis, combinedFields.lights[0].vector[index]);
      await edit('Intensity', '.4'); assert.equal(bodyControl.calls.length, 0); assert.equal(await saveText(), bodySeedText);
      await click('Apply'); assert.equal(bodyControl.calls.length, 1, 'Body/camera/light Apply is one complete replacement');
      const combinedText = await saveText(), combined = api.parseRenderNativeLightDocument(combinedText), expectedCombined = api.applyLightFields(bodySeed, combinedFields);
      assert.equal(combined.revision, bodySeed.revision + 1); assert.deepEqual(combined.display, expectedCombined.display);
      assert.deepEqual(combined.lights.lights, expectedCombined.lights.lights); assertBodyAuthority(combined, bodySeed);
      assert.deepEqual(bodyControl.calls[0], api.createRenderNativeLightRequest(combined));
      await click('Undo'); assert.equal(bodyControl.calls.length, 2); assert(button('Undo').disabled, 'Combined transaction made exactly one history entry');
      const undoneBody = api.parseRenderNativeLightDocument(await saveText()); assert.deepEqual(undoneBody.display, bodySeed.display); assert.deepEqual(undoneBody.lights.lights, bodySeed.lights.lights);
      await assertBodies(bodyFields.bodies); assertCamera(bodyFields.camera);
      await click('Redo'); assert.equal(bodyControl.calls.length, 3); assert(button('Redo').disabled);
      await assertBodies(api.readLightFields(combined).bodies); assertCamera(api.readLightFields(combined).camera);
      await selectBody(B); await edit('Body position Z (mm)', '95'); await edit('Camera eye X', '4'); await edit('Intensity', '.5'); await click('Apply'); await click('Undo'); assertHistory();
      const retainedBodyText = await saveText(), retainedBody = api.parseRenderNativeLightDocument(retainedBodyText), retainedBodyFields = api.readLightFields(retainedBody);
      const retainedBodyCalls = bodyControl.calls.length;
      await selectBody(B); await edit('Body position Y (mm)', '-0.0'); await edit('Body scale X', '1.20');
      await edit('Vertical FOV (degrees)', '55.0'); await edit('Intensity', '0.40'); await click('Apply');
      assert.equal(bodyControl.calls.length, retainedBodyCalls); assert.equal(await saveText(), retainedBodyText);
      assertHistory(); assertBody(retainedBodyFields.bodies[0]); assertCamera(retainedBodyFields.camera);
      assert.equal(inputValue('Intensity'), '0.4'); assert.equal(unloadBlocked(), false);
      for (const [label, value] of [['Body position X (mm)', ''], ['Body position Z (mm)', '10001'], ['Body scale X', '0'], ['Body scale Y', '-1']]) {
        await selectBody(B); await edit(label, value); await edit('Camera eye X', '3'); await edit('Intensity', '.42');
        await selectBody(A); await edit('Body position Z (mm)', '25'); await click('Apply');
        assert.equal(bodyControl.calls.length, retainedBodyCalls); assert.equal(inputValue('Body position Z (mm)'), '25');
        await selectBody(B); assert.equal(inputValue(label), value); assert.equal(inputValue('Camera eye X'), '3'); assert.equal(inputValue('Intensity'), '.42');
        assert.equal(await saveText(), retainedBodyText); await click('Discard'); assertHistory(); await assertBodies(retainedBodyFields.bodies);
      }
      for (const [label, value] of [['Camera eye X', ''], ['Intensity', '']]) {
        await selectBody(B); await edit('Body position X (mm)', '1100'); await edit(label, value); await click('Apply');
        assert.equal(bodyControl.calls.length, retainedBodyCalls); assert.equal(inputValue('Body position X (mm)'), '1100'); assert.equal(inputValue(label), value);
        assert.equal(await saveText(), retainedBodyText); await click('Discard'); assertHistory();
      }
      // Real complete-scene admission, including hidden bodies, must refuse the structurally valid tiny pose.
      await selectBody(A); await edit('Body position X (mm)', '1e-50'); await edit('Camera eye X', '3'); await edit('Intensity', '.43'); await click('Apply');
      assert.equal(bodyControl.calls.length, retainedBodyCalls + 1); assert(text().includes('PRESENTATION_REFUSED'));
      assert.equal(inputValue('Body position X (mm)'), '1e-50'); assert.equal(inputValue('Camera eye X'), '3'); assert.equal(inputValue('Intensity'), '.43');
      assert.equal(await saveText(), retainedBodyText); await click('Discard'); assertHistory();
      // Body-only dirty state protects all replacement exits; selection itself never invalidates a chooser ticket.
      await selectBody(B); await edit('Body position X (mm)', '1100'); confirmation = false;
      const bodyPrompts = dialogs.length, bodyChoosers = fileChoosers, bodyMounts = controls.length;
      for (const action of ['Open', 'Import legacy Native scene', 'New directional', 'New point', 'Back to materials']) await click(action);
      assert.equal(dialogs.length, bodyPrompts + 5); assert.equal(fileChoosers, bodyChoosers); assert.equal(controls.length, bodyMounts);
      assert.equal(bodyControl.calls.length, retainedBodyCalls + 1); assert.equal(inputValue('Body position X (mm)'), '1100'); confirmation = true;
      await click('Discard'); assertHistory(); await click('Open'); await edit('Body position X (mm)', '1120'); await selectFile(file(combinedText));
      assert(text().includes('STALE_CANDIDATE')); assert.equal(bodyControl.calls.length, retainedBodyCalls + 1); assert.equal(inputValue('Body position X (mm)'), '1120');
      await click('Open'); await act(async () => container.querySelector('input[type="file"]').dispatchEvent(new dom.window.Event('cancel', {bubbles: true})));
      await selectFile(file(combinedText)); assert(text().includes('STALE_CANDIDATE')); assert.equal(bodyControl.calls.length, retainedBodyCalls + 1);
      assert.equal(await saveText(), retainedBodyText); await click('Discard'); assertHistory();
      bodyControl.refusal = new Error('Controlled pending body/camera/light refusal');
      await selectBody(B); await edit('Body position X (mm)', '1150'); await edit('Camera eye X', '3'); await edit('Intensity', '.44');
      await selectBody(A); await edit('Body scale Z', '1.2');
      let releaseBody; bodyControl.wait = new Promise(resolve => {releaseBody = resolve;}); await act(async () => button('Apply').click());
      assert.equal(bodyControl.calls.length, retainedBodyCalls + 2); assert.equal(unloadBlocked(), true);
      for (const label of ['Apply', 'Discard', 'Undo', 'Redo', 'Open', 'Save accepted', 'Import legacy Native scene', 'New directional', 'New point', 'Back to materials', 'Add ' + kind, 'Remove light', 'Edit body ' + A, 'Edit body ' + B])
        assert(button(label).disabled, 'Pending body transaction fences ' + label);
      for (const [label] of [...bodyEntries(bodyFields.bodies[0]), ...cameraEntries(cameraDraft), ['Intensity']])
        assert(container.querySelector(`[aria-label="${label}"]`).disabled, 'Pending field ' + label);
      await act(async () => {button('Apply').click(); button('Edit body ' + B).click(); button('Open').click();});
      assert.equal(bodyControl.calls.length, retainedBodyCalls + 2); assert.equal(button('Edit body ' + A).getAttribute('aria-pressed'), 'true');
      await act(async () => {releaseBody(); await bodyControl.wait;}); bodyControl.wait = null;
      assert(text().includes('PRESENTATION_REFUSED')); assert.equal(inputValue('Body scale Z'), '1.2'); await selectBody(B);
      assert.equal(inputValue('Body position X (mm)'), '1150'); assert.equal(inputValue('Camera eye X'), '3'); assert.equal(inputValue('Intensity'), '.44');
      assert.equal(await saveText(), retainedBodyText); await click('Discard'); assertHistory(); await assertBodies(retainedBodyFields.bodies);
      bodyControl.refusal = null; await selectBody(B); await edit('Body position X (mm)', '1150'); await edit('Camera eye X', '3'); await edit('Intensity', '.44'); await click('Apply');
      assert.equal(bodyControl.calls.length, retainedBodyCalls + 3); assert(button('Redo').disabled);
      const bodySavedText = await saveText(), bodySaved = api.parseRenderNativeLightDocument(bodySavedText); assertBodyAuthority(bodySaved, bodySeed);
      assert.equal(bodySaved.revision, retainedBody.revision + 1); assert.equal(poseFor(bodySaved, B).translationMM[0], 1150);
      await mounted.dispose(); assert.equal(bodyControl.disposed, 1);

      const bodyMountsBeforeChoice = controls.length; mounted = await api.mountLightWorkbenchFlow(container);
      assert(text().includes('Choose the kind')); assert.equal(controls.length, bodyMountsBeforeChoice); await click('Start ' + kind + ' workspace');
      const freshBody = controls.at(-1); freshBody.prepare = prepareBodyAppearance;
      await click('Open'); await selectFile(file(bodySavedText)); assert.equal(freshBody.calls.length, 1);
      assert(button('Undo').disabled); assert(button('Redo').disabled); assert.equal(await saveText(), bodySavedText);
      await selectBody(B); assertBody(api.readLightFields(bodySaved).bodies[0]);
      await edit('Body position Y (mm)', '-0'); await edit('Body position X (mm)', '1200'); await edit('Body scale Z', '1.15');
      await edit('Camera target X', '-0'); await edit('Intensity', '.6'); await click('Apply'); assert.equal(freshBody.calls.length, 2);
      const bodyReeditedText = await saveText(), bodyReedited = api.parseRenderNativeLightDocument(bodyReeditedText);
      assert.equal(bodyReedited.revision, bodySaved.revision + 1); assert.equal(poseFor(bodyReedited, B).translationMM[0], 1200);
      assert(Object.is(poseFor(bodyReedited, B).translationMM[1], -0)); assert.equal(poseFor(bodyReedited, B).scale[2], 1.15);
      assert.deepEqual(poseFor(bodyReedited, A), poseFor(bodySaved, A)); assertBodyAuthority(bodyReedited, bodySaved);
      assert.equal(bodyReedited.lights.lights[0].intensity, .6); assert(Object.is(bodyReedited.display.camera.target[0], -0));
      await edit('Body position Z (mm)', '90'); await click('Apply'); await click('Undo'); assertHistory();
      const beforeLateBodyText = await saveText(), beforeLateBody = api.parseRenderNativeLightDocument(beforeLateBodyText);
      let releaseLateBody; freshBody.wait = new Promise(resolve => {releaseLateBody = resolve;});
      await edit('Body position X (mm)', '1250'); await edit('Camera eye X', '4'); await edit('Intensity', '.62'); await act(async () => button('Apply').click());
      const lateBodyCalls = freshBody.calls.length; assert(button('Edit body ' + A).disabled); await mounted.dispose(); assert.equal(freshBody.disposed, 1);
      mounted = await api.mountLightWorkbenchFlow(container, beforeLateBody); const afterLateBody = controls.at(-1);
      await act(async () => {releaseLateBody(); await freshBody.wait;}); freshBody.wait = null;
      assert.equal(freshBody.calls.length, lateBodyCalls); assert.equal(afterLateBody.calls.length, 0);
      await assertBodies(api.readLightFields(beforeLateBody).bodies); assertCamera(api.readLightFields(beforeLateBody).camera);
      assert.equal(await saveText(), beforeLateBodyText, 'Disposed body transaction cannot publish into a newer lifetime');
      assert(button('Undo').disabled); assert(button('Redo').disabled);
      await click('Open'); let releaseBodyRead;
      await selectFile({name: 'late-body.json', size: bodySavedText.length, arrayBuffer: () => new Promise(resolve => {releaseBodyRead = resolve;})});
      assert(button('Edit body ' + A).disabled); assert(button('Apply').disabled); assert(button('Open').disabled);
      await mounted.dispose(); mounted = await api.mountLightWorkbenchFlow(container, bodySeed); const afterBodyRead = controls.at(-1);
      await act(async () => releaseBodyRead(new TextEncoder().encode(bodySavedText).buffer));
      assert.equal(afterLateBody.calls.length, 0); assert.equal(afterLateBody.disposed, 1); assert.equal(afterBodyRead.calls.length, 0);
      assert.equal(await saveText(), bodySeedText); assertBody(bodyFields.bodies[0]);
      // Same ID survives a reordered accepted inventory; a removed target reconciles to the remaining original ID.
      const reordered = api.prepareRenderNativeLightDocument({...bodySeed, nativeOptions: {...bodySeed.nativeOptions, bodyIds: [A, B]}}).document;
      await click('Open'); await selectBody(A); await selectBody(B); await selectFile(file(api.serializeRenderNativeLightDocument(reordered)));
      assert.equal(afterBodyRead.calls.length, 1, 'Local selection must not stale a whole-file chooser');
      assert.equal(button('Edit body ' + B).getAttribute('aria-pressed'), 'true'); assertBody(bodyFields.bodies[0]);
      const onlyA = api.prepareRenderNativeLightDocument({...bodySeed, nativeOptions: {...bodySeed.nativeOptions, bodyIds: [A]},
        display: {...bodySeed.display, poses: [poseFor(bodySeed, A)], visibleBodyIds: [A]}, surfaceMaterials: []}).document;
      await click('Open'); await selectFile(file(api.serializeRenderNativeLightDocument(onlyA)));
      assert.equal(afterBodyRead.calls.length, 2); assert(!button('Edit body ' + B));
      assert.equal(button('Edit body ' + A).getAttribute('aria-pressed'), 'true'); assertBody(api.readLightFields(onlyA).bodies[0]);
      assert.equal(onlyA.nativeDocument.bodies.length, 2, 'Qualification, not native inventory size, controls target rows');
      assert(button('Undo').disabled); assert(button('Redo').disabled); await mounted.dispose(); assert.equal(afterBodyRead.disposed, 1);
      bodyFlow.push({kind, invalidBodyCases: invalidBodies.length, providerOutcome, emptyPoseReplacements: emptyControl.calls.length,
        combinedReplacements: bodyControl.calls.length, freshChooserReplacements: freshBody.calls.length,
        savedRevision: bodySaved.revision, reeditedRevision: bodyReedited.revision});
    }
  } finally {confirmation = true; globalThis.fetch = originalFetch;}

  // Existing embedded materials belong to full body bindings, even when their material IDs repeat.
  // Reuse the actual compiler/material session and native appearance provider; only Viewer delivery is controlled.
  const materialFlow = [];
  const bindingFor = (document, bodyId) => document.surfaceMaterials.find(item => item.target.bodyId === bodyId);
  const materialRow = (fields, bodyId) => fields.materials.find(item => item.target.bodyId === bodyId);
  const uniformRow = (fields, bodyId, name = 'amount') => materialRow(fields, bodyId).uniforms.find(item => item.name === name);
  const uniformInput = name => container.querySelector(`[aria-label="Uniform ${name}"]`);
  const overrideInput = name => container.querySelector(`[aria-label="Override uniform ${name}"]`);
  const override = async (name, enabled) => {
    const input = overrideInput(name); assert(input, 'Missing override ' + name); assert(!input.disabled);
    if (input.checked !== enabled) await act(async () => input.click());
    assert.equal(overrideInput(name).checked, enabled);
  };
  const assertMaterialFields = row => {
    for (const uniform of row.uniforms) {
      assert.equal(inputValue('Uniform ' + uniform.name), uniform.value);
      assert.equal(overrideInput(uniform.name).checked, uniform.override);
      assert.equal(uniformInput(uniform.name).disabled, !uniform.override);
    }
  };
  const withMaterial = (base, updates, outerRevision = base.revision) => {
    const expected = structuredClone(base); expected.revision = outerRevision; expected.lights.revision = outerRevision;
    for (const [bodyId, uniforms] of updates) {
      const material = bindingFor(expected, bodyId).material; material.revision++; material.uniforms = uniforms;
    }
    return expected;
  };
  const invalidMaterialFields = [
    ['missing binding', fields => {fields.materials.pop();}],
    ['sparse binding', fields => {delete fields.materials[0];}],
    ['duplicate binding', fields => {fields.materials[1] = structuredClone(fields.materials[0]);}],
    ['reordered binding', fields => {fields.materials.reverse();}],
    ['material identity', fields => {fields.materials[0].documentId = 'foreign-material';}],
    ['material revision', fields => {fields.materials[0].revision++;}],
    ...['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'modelId', 'geometryId'].map(key =>
      ['qualified target ' + key, fields => {const target = fields.materials[0].target; target[key] = typeof target[key] === 'number' ? target[key] + 1 : 'foreign';}]),
    ['missing uniform', fields => {fields.materials[0].uniforms.pop();}],
    ['sparse uniform', fields => {delete fields.materials[0].uniforms[0];}],
    ['invented uniform', fields => {fields.materials[0].uniforms[0].name = 'foreign';}],
    ['duplicate uniform', fields => {fields.materials[0].uniforms[1].name = 'amount';}],
    ['reordered uniform', fields => {fields.materials[0].uniforms.reverse();}],
    ['forged minimum', fields => {Object.assign(fields.materials[0].uniforms[0], {min: -100, override: true, value: '-2'});}],
    ['forged maximum', fields => {Object.assign(fields.materials[0].uniforms[0], {max: 100, override: true, value: '2'});}],
    ['nonboolean override', fields => {fields.materials[0].uniforms[0].override = 'true';}],
    ...['', ' ', '1e', 'NaN', 'Infinity', '-Infinity', '0x10', '-1.01', '1.01'].map(value =>
      ['active text ' + JSON.stringify(value), fields => {Object.assign(fields.materials[0].uniforms[0], {override: true, value});}]),
  ];
  globalThis.fetch = async url => {assert.equal(url, './reference-panel.barocad'); return {ok: true, text: async () => sourceText};};
  try {
    for (const kind of ['directional', 'point']) {
      const raw = structuredClone(api.createLightStudy(sourceText, kind));
      raw.nativeDocument.bodies.forEach(body => {body.name = 'Repeated Surface';});
      raw.display.camera.up = [-0, 2, -0];
      raw.display.poses[1].rotationXYZW = [-0, Math.sin(.2) * (1 + 2e-10), -0, Math.cos(.2) * (1 + 2e-10)];
      for (const item of raw.surfaceMaterials) Object.assign(item.material, {documentId: 'shared-look', title: 'Repeated material', revision: 7,
        shaderSource: '// Original independently owned material.\n@shader #shared_look {\n  @uniform amount: float(-1, 1, 0);\n  @uniform gain: float(0, 2, 1);\n  @fragment { color: mix(#ff0000, #0000ff, clamp(amount * gain, 0, 1)); }\n}\n', uniforms: {}});
      const materialSeed = api.prepareRenderNativeLightDocument(raw).document;
      const materialSeedText = api.serializeRenderNativeLightDocument(materialSeed), materialFields = api.readLightFields(materialSeed);
      assert.equal(new Set(materialSeed.nativeDocument.bodies.map(body => body.name)).size, 1);
      assert.equal(new Set(materialSeed.surfaceMaterials.map(item => item.target.geometryId)).size, 1);
      assert.equal(new Set(materialSeed.surfaceMaterials.map(item => item.material.documentId)).size, 1);
      assert.deepEqual(materialFields.materials.map(row => row.target), materialSeed.surfaceMaterials.map(item => item.target));
      assert.deepEqual(materialFields.materials.map(row => [row.documentId, row.revision]), [['shared-look', 7], ['shared-look', 7]]);
      for (const row of materialFields.materials) assert.deepEqual(row.uniforms, [
        {name: 'amount', override: false, value: '0', min: -1, max: 1, defaultValue: '0'},
        {name: 'gain', override: false, value: '1', min: 0, max: 2, defaultValue: '1'},
      ]);
      assert.deepEqual(api.applyLightFields(materialSeed, materialFields), materialSeed, 'Reading cannot materialize defaults');
      for (const [name, mutate] of invalidMaterialFields) {
        const invalid = structuredClone(materialFields); mutate(invalid); const retained = structuredClone(invalid);
        assert.throws(() => api.applyLightFields(materialSeed, invalid), undefined, kind + ': ' + name);
        assert.deepEqual(invalid, retained, 'Material validation retains draft: ' + name);
        assert.equal(api.serializeRenderNativeLightDocument(materialSeed), materialSeedText);
      }
      const inactive = structuredClone(materialFields); uniformRow(inactive, A).value = 'Infinity';
      uniformRow(inactive, A).defaultValue = '.5';
      assert.deepEqual(api.applyLightFields(materialSeed, inactive), materialSeed, 'Inactive text and UI default hints cannot replace source authority');
      for (const [textValue, numericValue] of [['+0', 0], ['-0', -0], ['-1', -1], ['1', 1]]) {
        const single = structuredClone(materialFields); Object.assign(uniformRow(single, A), {override: true, value: textValue});
        assert.deepEqual(api.applyLightFields(materialSeed, single), withMaterial(materialSeed, [[A, {amount: numericValue}]]), 'Only full selected binding changes');
      }
      const explicitDefault = structuredClone(materialFields); Object.assign(uniformRow(explicitDefault, A, 'gain'), {override: true, value: '1.0'});
      const explicit = api.applyLightFields(materialSeed, explicitDefault);
      assert.deepEqual(explicit, withMaterial(materialSeed, [[A, {gain: 1}]]), 'Explicit shader default is real authorship');
      const lexical = api.readLightFields(explicit); uniformRow(lexical, A, 'gain').value = '+1e0';
      assert.deepEqual(api.applyLightFields(explicit, lexical), explicit, 'Numeric formatting retains original embedded revision');
      const omitted = api.readLightFields(explicit); Object.assign(uniformRow(omitted, A, 'gain'), {override: false, value: '1e'});
      assert.deepEqual(api.applyLightFields(explicit, omitted), withMaterial(explicit, [[A, {}]]));

      mounted = await api.mountLightWorkbenchFlow(container, materialSeed); const materialControl = controls.at(-1);
      const preparedMaterials = []; materialControl.prepare = request => {preparedMaterials.push(prepareBodyAppearance(request));};
      assert.equal(materialControl.initial.format, 'barocss-viewer-native-' + kind + '-light-input');
      const materialSection = container.querySelector('[aria-label="Body material"]'); assert(materialSection);
      assert.match(materialSection.textContent, /amount/); assert.match(materialSection.textContent, /-1/);
      assert.match(materialSection.textContent, /default\s*0/i); assert.match(materialSection.textContent, /gain/); assert.match(materialSection.textContent, /default\s*1/i);
      assert.match(materialSection.textContent, /Range -1 to 1/); assert.match(materialSection.textContent, /Range 0 to 2/);
      assertMaterialFields(materialRow(materialFields, A)); assert.equal(await saveText(), materialSeedText);
      await selectBody(B); await selectBody(A); assert(button('Apply').disabled); assert.equal(unloadBlocked(), false); assert.equal(materialControl.calls.length, 0);
      await override('amount', true); await edit('Uniform amount', '1e'); await override('amount', false);
      assert.equal(inputValue('Uniform amount'), '1e'); assert(uniformInput('amount').disabled);
      await selectBody(B); await override('gain', true); await edit('Uniform gain', '1.250');
      await selectBody(A); assert.equal(inputValue('Uniform amount'), '1e'); await override('amount', true);
      assert.equal(inputValue('Uniform amount'), '1e'); assert.equal(await saveText(), materialSeedText); await click('Apply');
      assert.equal(materialControl.calls.length, 0); await selectBody(B); assert.equal(inputValue('Uniform gain'), '1.250');
      await click('Discard'); await selectBody(A); assertMaterialFields(materialRow(materialFields, A));
      await selectBody(B); assertMaterialFields(materialRow(materialFields, B)); await selectBody(A);
      await override('amount', true); await click('Apply');
      const plusText = await saveText(), plus = api.parseRenderNativeLightDocument(plusText);
      assert.deepEqual(plus, withMaterial(materialSeed, [[A, {amount: 0}]], materialSeed.revision + 1));
      assert.equal(materialControl.calls.length, 1); assert(button('Redo').disabled);
      await edit('Uniform amount', '-0'); await click('Apply');
      const minusText = await saveText(), minus = api.parseRenderNativeLightDocument(minusText);
      assert.deepEqual(minus, withMaterial(plus, [[A, {amount: -0}]], plus.revision + 1));
      assert(Object.is(bindingFor(minus, A).material.uniforms.amount, -0));
      await edit('Uniform amount', '-0.00'); await click('Apply'); assert.equal(materialControl.calls.length, 2);
      assert.equal(await saveText(), minusText); assert.equal(inputValue('Uniform amount'), '-0');
      await edit('Uniform amount', '1e'); await override('amount', false); await click('Apply');
      const defaultText = await saveText(), defaulted = api.parseRenderNativeLightDocument(defaultText);
      assert.deepEqual(defaulted, withMaterial(minus, [[A, {}]], minus.revision + 1));
      assert.equal(inputValue('Uniform amount'), '0'); assert(uniformInput('amount').disabled);
      await click('Undo'); assert.deepEqual(api.parseRenderNativeLightDocument(await saveText()).surfaceMaterials, minus.surfaceMaterials);
      await click('Redo'); assert.deepEqual(api.parseRenderNativeLightDocument(await saveText()).surfaceMaterials, defaulted.surfaceMaterials);

      // Reset whole-scene history, then combine two independent materials with body/camera/light in one Apply.
      await click('Open'); await selectFile(file(materialSeedText)); assert(button('Undo').disabled); assert(button('Redo').disabled);
      const beforeCombinedCalls = materialControl.calls.length;
      await selectBody(A); await override('amount', true); await edit('Uniform amount', '-.5');
      await edit('Body position X (mm)', '-950'); await edit('Body scale Y', '1.05');
      await selectBody(B); await override('gain', true); await edit('Uniform gain', '1.25'); await edit('Body position Z (mm)', '50');
      await selectBody(A); assert.equal(inputValue('Uniform amount'), '-.5'); await selectBody(B); assert.equal(inputValue('Uniform gain'), '1.25');
      await edit('Camera eye X', '3'); await edit('Intensity', '.4'); assert.equal(await saveText(), materialSeedText); await click('Apply');
      assert.equal(materialControl.calls.length, beforeCombinedCalls + 1, 'Two materials/body/camera/light use one replacement');
      const combinedText = await saveText(), combined = api.parseRenderNativeLightDocument(combinedText);
      const expectedCombined = withMaterial(materialSeed, [[A, {amount: -.5}], [B, {gain: 1.25}]], materialSeed.revision + 1);
      poseFor(expectedCombined, A).translationMM[0] = -950; poseFor(expectedCombined, A).scale[1] = 1.05;
      poseFor(expectedCombined, B).translationMM[2] = 50; expectedCombined.display.camera.eye[0] = 3; expectedCombined.lights.lights[0].intensity = .4;
      assert.deepEqual(combined, expectedCombined, 'Unedited source/TEN/raw rotation/Up/visibility/override omissions remain exact');
      assert.deepEqual(materialControl.calls.at(-1), api.createRenderNativeLightRequest(combined));
      const mapping = api.prepareRenderNativeLightDocument(combined).materials, appearance = preparedMaterials.at(-1);
      assert.equal(appearance.prepared.primitives.length, 2);
      assert.notEqual(mapping[0].ref.modelId, mapping[1].ref.modelId, 'Actual provider qualifies duplicate authored geometry names');
      for (const mapped of mapping) {
        const primitive = appearance.prepared.primitives.find(item => item.entry.ref.modelId === mapped.ref.modelId && item.entry.ref.geometryId === mapped.ref.surfaceId);
        assert(primitive?.material, 'Qualified body receives its own provider material');
        assert.deepEqual(primitive.material.uniforms, mapped.preparation.sample.uniforms);
        assert.deepEqual(primitive.material.material, mapped.preparation.sample.material);
      }
      await click('Undo'); assert(button('Undo').disabled, 'No separate material-history transaction');
      const undone = api.parseRenderNativeLightDocument(await saveText());
      assert.deepEqual(undone, {...materialSeed, revision: combined.revision + 1, lights: {...materialSeed.lights, revision: combined.revision + 1}});
      await click('Redo'); assert(button('Redo').disabled);
      assert.deepEqual(api.parseRenderNativeLightDocument(await saveText()).surfaceMaterials, combined.surfaceMaterials);
      await selectBody(A); await edit('Uniform amount', '.5'); await click('Apply'); await click('Undo'); assertHistory();
      const retainedText = await saveText(), retained = api.parseRenderNativeLightDocument(retainedText), retainedFields = api.readLightFields(retained);
      const retainedCalls = materialControl.calls.length;
      for (const invalid of ['', '1e', 'NaN', 'Infinity', '-Infinity', '-1.01', '1.01']) {
        await selectBody(A); await edit('Uniform amount', invalid); await edit('Body position X (mm)', '-960');
        await edit('Camera eye X', '4'); await edit('Intensity', '.42');
        await selectBody(B); await edit('Uniform gain', '1.50'); await click('Apply');
        assert.equal(materialControl.calls.length, retainedCalls); assert.equal(inputValue('Uniform gain'), '1.50');
        await selectBody(A); assert.equal(inputValue('Uniform amount'), invalid); assert.equal(inputValue('Body position X (mm)'), '-960');
        assert.equal(inputValue('Camera eye X'), '4'); assert.equal(inputValue('Intensity'), '.42'); assert.equal(await saveText(), retainedText);
        await click('Discard'); assertHistory(); assertMaterialFields(materialRow(retainedFields, A));
      }
      // A material draft invalidates an earlier chooser ticket and protects ordinary replacement exits.
      await edit('Uniform amount', '-.4'); confirmation = false;
      const promptsBeforeMaterial = dialogs.length, choosersBeforeMaterial = fileChoosers, mountsBeforeMaterial = controls.length;
      for (const action of ['Open', 'Import legacy Native scene', 'New directional', 'New point', 'Back to materials']) await click(action);
      assert.equal(dialogs.length, promptsBeforeMaterial + 5); assert.equal(fileChoosers, choosersBeforeMaterial); assert.equal(controls.length, mountsBeforeMaterial);
      assert.equal(inputValue('Uniform amount'), '-.4'); confirmation = true; await click('Discard');
      await click('Open'); await edit('Uniform amount', '-.3'); await selectFile(file(combinedText));
      assert(text().includes('STALE_CANDIDATE')); assert.equal(materialControl.calls.length, retainedCalls);
      assert.equal(inputValue('Uniform amount'), '-.3'); assert.equal(await saveText(), retainedText); await click('Discard'); assertHistory();

      materialControl.refusal = new Error('Controlled pending material/body/camera/light refusal');
      await edit('Uniform amount', '-.4'); await edit('Body position X (mm)', '-975'); await edit('Camera eye X', '4'); await edit('Intensity', '.44');
      await selectBody(B); await edit('Uniform gain', '1.50');
      let releaseMaterial; materialControl.wait = new Promise(resolve => {releaseMaterial = resolve;}); await act(async () => button('Apply').click());
      assert.equal(materialControl.calls.length, retainedCalls + 1); assert.equal(unloadBlocked(), true);
      for (const action of ['Apply', 'Discard', 'Undo', 'Redo', 'Open', 'Save accepted', 'Import legacy Native scene', 'New directional', 'New point', 'Back to materials', 'Add ' + kind, 'Remove light', 'Edit body ' + A, 'Edit body ' + B])
        assert(button(action).disabled, 'Pending material fence: ' + action);
      for (const name of ['amount', 'gain']) {assert(overrideInput(name).disabled); assert(uniformInput(name).disabled);}
      for (const label of ['Body position X (mm)', 'Camera eye X', 'Intensity']) assert(container.querySelector(`[aria-label="${label}"]`).disabled);
      await act(async () => {button('Apply').click(); button('Open').click(); button('Edit body ' + A).click(); overrideInput('gain').click();});
      assert.equal(materialControl.calls.length, retainedCalls + 1); assert.equal(button('Edit body ' + B).getAttribute('aria-pressed'), 'true');
      await act(async () => {releaseMaterial(); await materialControl.wait;}); materialControl.wait = null;
      assert(text().includes('PRESENTATION_REFUSED')); assert.equal(inputValue('Uniform gain'), '1.50'); assert(overrideInput('gain').checked);
      await selectBody(A); assert.equal(inputValue('Uniform amount'), '-.4'); assert.equal(inputValue('Body position X (mm)'), '-975');
      assert.equal(inputValue('Camera eye X'), '4'); assert.equal(inputValue('Intensity'), '.44'); assert.equal(await saveText(), retainedText);
      await click('Discard'); assertHistory(); assertMaterialFields(materialRow(retainedFields, A));
      materialControl.refusal = null; await edit('Uniform amount', '-.4'); await selectBody(B); await edit('Uniform gain', '1.50'); await click('Apply');
      assert.equal(materialControl.calls.length, retainedCalls + 2); assert(button('Redo').disabled);
      const savedText = await saveText(), saved = api.parseRenderNativeLightDocument(savedText);
      assert.deepEqual(saved, withMaterial(retained, [[A, {amount: -.4}], [B, {gain: 1.5}]], retained.revision + 1));
      await mounted.dispose(); assert.equal(materialControl.disposed, 1);

      const mountsBeforeChoice = controls.length; mounted = await api.mountLightWorkbenchFlow(container);
      assert(text().includes('Choose the kind')); assert.equal(controls.length, mountsBeforeChoice); await click('Start ' + kind + ' workspace');
      const freshMaterial = controls.at(-1); freshMaterial.prepare = prepareBodyAppearance;
      await click('Open'); await selectFile(file(savedText)); assert.equal(freshMaterial.calls.length, 1);
      assert(button('Undo').disabled); assert(button('Redo').disabled); assert.equal(await saveText(), savedText);
      await selectBody(B); assertMaterialFields(materialRow(api.readLightFields(saved), B)); await edit('Uniform gain', '1.75'); await click('Apply');
      const reeditedText = await saveText(), reedited = api.parseRenderNativeLightDocument(reeditedText);
      assert.deepEqual(reedited, withMaterial(saved, [[B, {gain: 1.75}]], saved.revision + 1));
      assert.equal(freshMaterial.calls.length, 2); await edit('Uniform gain', '1.9'); await click('Apply'); await click('Undo'); assertHistory();
      const beforeLateText = await saveText(), beforeLate = api.parseRenderNativeLightDocument(beforeLateText);
      await selectBody(A); await edit('Uniform amount', '.7');
      let releaseLateMaterial; freshMaterial.wait = new Promise(resolve => {releaseLateMaterial = resolve;}); await act(async () => button('Apply').click());
      const lateCalls = freshMaterial.calls.length; assert(uniformInput('amount').disabled); await mounted.dispose(); assert.equal(freshMaterial.disposed, 1);
      mounted = await api.mountLightWorkbenchFlow(container, beforeLate); const afterLateMaterial = controls.at(-1);
      await act(async () => {releaseLateMaterial(); await freshMaterial.wait;}); freshMaterial.wait = null;
      assert.equal(freshMaterial.calls.length, lateCalls); assert.equal(afterLateMaterial.calls.length, 0);
      assert.equal(await saveText(), beforeLateText); assertMaterialFields(materialRow(api.readLightFields(beforeLate), A));
      assert(button('Undo').disabled); assert(button('Redo').disabled); await mounted.dispose();

      // Maximum embedded revision refuses only a real change, before either backend receives a replacement.
      const maximalRaw = structuredClone(materialSeed); bindingFor(maximalRaw, A).material.revision = 2147483647;
      bindingFor(maximalRaw, A).material.uniforms = {amount: 0};
      const maximal = api.prepareRenderNativeLightDocument(maximalRaw).document;
      mounted = await api.mountLightWorkbenchFlow(container, maximal); const maxControl = controls.at(-1);
      await edit('Uniform amount', '+0.0'); await click('Apply'); assert.equal(maxControl.calls.length, 0); assert(button('Undo').disabled);
      await edit('Ambient strength', '.3'); await click('Apply'); await edit('Ambient strength', '.4'); await click('Apply'); await click('Undo'); assertHistory();
      const maxRetainedText = await saveText(), maxCalls = maxControl.calls.length;
      await edit('Uniform amount', '.2'); await selectBody(B); await override('gain', true); await edit('Uniform gain', '1.1');
      await edit('Camera eye X', '4'); await click('Apply'); assert.equal(maxControl.calls.length, maxCalls); assert.match(text(), /revision.*maximum/i);
      assert.equal(inputValue('Uniform gain'), '1.1'); await selectBody(A); assert.equal(inputValue('Uniform amount'), '.2');
      assert.equal(inputValue('Camera eye X'), '4'); assert.equal(await saveText(), maxRetainedText); await click('Discard'); assertHistory();
      await mounted.dispose(); assert.equal(maxControl.disposed, 1);

      // No binding is synthesized for a visible unbound or hidden body; its ordinary transform controls remain.
      for (const hidden of [false, true]) {
        const unavailableRaw = structuredClone(materialSeed); unavailableRaw.surfaceMaterials = [bindingFor(unavailableRaw, B)];
        if (hidden) unavailableRaw.display.visibleBodyIds = [B];
        const unavailable = api.prepareRenderNativeLightDocument(unavailableRaw).document, unavailableText = api.serializeRenderNativeLightDocument(unavailable);
        assert.deepEqual(api.readLightFields(unavailable).materials.map(row => row.target.bodyId), [B]);
        mounted = await api.mountLightWorkbenchFlow(container, unavailable); const unavailableControl = controls.at(-1);
        await selectBody(A); assert(!uniformInput('amount')); assert(!overrideInput('amount'));
        assert.match(container.querySelector('[aria-label="Body material"]').textContent, /no |not |unavailable|hidden|noneditable|non-editable/i);
        assert(!container.querySelector('[aria-label="Body position X (mm)"]').disabled);
        await selectBody(B); assertMaterialFields(materialRow(api.readLightFields(unavailable), B)); await selectBody(A);
        assert.equal(await saveText(), unavailableText); assert.equal(unavailableControl.calls.length, 0);
        await edit('Body position X (mm)', '-925'); await click('Apply');
        const unboundEdited = api.parseRenderNativeLightDocument(await saveText());
        assert.deepEqual(unboundEdited.surfaceMaterials, unavailable.surfaceMaterials); assert.deepEqual(unboundEdited.display.visibleBodyIds, unavailable.display.visibleBodyIds);
        assert.equal(poseFor(unboundEdited, A).translationMM[0], -925); await mounted.dispose(); assert.equal(unavailableControl.disposed, 1);
      }
      materialFlow.push({kind, invalidMaterialCases: invalidMaterialFields.length, bindingIds: materialFields.materials.map(row => row.target.bodyId),
        embeddedDocumentId: 'shared-look', initialEmbeddedRevision: 7, combinedEmbeddedRevisions: combined.surfaceMaterials.map(item => item.material.revision),
        materialReplacements: materialControl.calls.length, freshChooserReplacements: freshMaterial.calls.length,
        savedRevision: saved.revision, reeditedRevision: reedited.revision, maxRevisionRefusedBeforeViewer: maxControl.calls.length === maxCalls});
    }
  } finally {confirmation = true; globalThis.fetch = originalFetch;}

  // #1646: bounded actual DOM input, public camera math, genuine session/request
  // and appearance admission. Historical authoring flows above keep their own counts.
  navigationDom = api.installLightNavigationFlowDom();
  const navigationFlow = [];
  const cameraStatus = () => container.querySelector('[aria-label="Viewport camera status"]').textContent;
  const flushNavigation = async () => {await act(async () => {navigationDom.flushFrames();});};
  const pointer = async (canvas, type, x, y, shift = false) => {await act(async () => {navigationDom.pointer(canvas, type, x, y, shift);});};
  const wheel = async (canvas, delta, mode = 0) => {await act(async () => {navigationDom.wheel(canvas, delta, mode);});};
  const interaction = (camera, kind, deltaX, deltaY) => api.deriveRenderCameraInteraction(camera, {kind, deltaX, deltaY, width: 900, height: 600});
  const zoomView = (camera, factor) => api.deriveRenderCameraInteraction(camera, {kind: 'zoom', factor});
  const assertViewRequest = (request, document, camera) => {
    const expected = api.createRenderNativeLightRequest(document);
    assert.deepEqual(request, {...expected, display: {...expected.display, camera}});
    assert.equal(Object.isFrozen(request.display.camera), true);
  };
  for (const kind of ['directional', 'point']) {
    const raw = structuredClone(api.createLightStudy(sourceText, kind));
    Object.assign(raw.surfaceMaterials[0].material, {
      shaderSource: '@shader #navigation_material { @uniform amount: float(0, 1, 0); @fragment { color: mix(#ff0000, #0000ff, amount); } }',
      uniforms: {amount: .2},
    });
    const viewSeed = api.prepareRenderNativeLightDocument(raw).document;
    const viewSeedText = api.serializeRenderNativeLightDocument(viewSeed), counts = {view: 0, authored: 0};
    const track = control => {
      control.prepare = prepareBodyAppearance;
      const replace = control.viewer.replace;
      control.viewer.replace = request => {
        const owner = control.viewer.accepted.owner;
        if (request.owner.id === owner.id && Object.is(request.owner.revision, owner.revision)) {
          counts.view++; assert(counts.view <= 12, kind + ': focused navigation replacement cap');
        } else counts.authored++;
        return replace(request);
      };
      return control;
    };
    mounted = await api.mountLightWorkbenchFlow(container, viewSeed);
    let viewControl = track(controls.at(-1)), canvas = container.querySelector('canvas');
    assert.equal(cameraStatus(), 'Scene view'); assert(button('Scene camera').disabled); assert(button('Set scene camera').disabled);
    assert.equal(await saveText(), viewSeedText); assert.equal(unloadBlocked(), false);
    await selectBody(viewSeed.surfaceMaterials[0].target.bodyId);
    const corrective = [['Camera eye X', ''], ['Intensity', '1e'], ['Body position X (mm)', '-'], ['Uniform amount', 'NaN']];
    for (const [label, value] of corrective) await edit(label, value);
    const assertCorrective = () => {for (const [label, value] of corrective) assert.equal(inputValue(label), value, label);};
    assert(button('Set scene camera').disabled); assert.equal(unloadBlocked(), true);

    let releaseFirst; viewControl.wait = new Promise(resolve => {releaseFirst = resolve;});
    await pointer(canvas, 'pointerdown', 140, 125); assert.equal(document.activeElement, canvas);
    assert.equal(navigationDom.captures(), 1); assert(button('Open').disabled, 'An active drag fences file replacement before presentation');
    await pointer(canvas, 'pointermove', 160, 135); assert.equal(navigationDom.pendingFrames(), 1);
    const firstView = interaction(viewSeed.display.camera, 'orbit', 20, 10);
    await flushNavigation(); // View 1: first orbit while ACK remains pending.
    assert.equal(counts.view, 1); assertViewRequest(viewControl.calls.at(-1), viewSeed, firstView);
    for (const action of ['Apply', 'Discard', 'Undo', 'Redo', 'Open', 'Save accepted', 'New directional', 'New point', 'Set scene camera', 'Scene camera'])
      assert(button(action).disabled, 'Pending view fences ' + action);
    const firstCallCount = viewControl.calls.length;
    await pointer(canvas, 'pointermove', 170, 140);
    await pointer(canvas, 'pointermove', 176, 137, true);
    await wheel(canvas, -24, 1);
    await pointer(canvas, 'pointerup', 176, 137, true);
    await flushNavigation(); assert.equal(viewControl.calls.length, firstCallCount, 'One in-flight request holds all newer motion');
    assert.equal(navigationDom.pendingFrames(), 0); assert.equal(navigationDom.captures(), 0);
    const accumulated = zoomView(interaction(interaction(firstView, 'orbit', 10, 5), 'pan', 6, -3), Math.exp(24 * 16 * .001));
    await act(async () => {releaseFirst(); await viewControl.wait;}); viewControl.wait = null;
    assert.equal(navigationDom.pendingFrames(), 1, 'Only the latest accumulated target is queued');
    await flushNavigation(); // View 2: coalesced orbit + Shift-pan + line-wheel zoom.
    assert.equal(counts.view, 2); assert.equal(viewControl.calls.length, firstCallCount + 1);
    assertViewRequest(viewControl.calls.at(-1), viewSeed, accumulated);
    assert.equal(cameraStatus(), 'User view'); assertCorrective(); assert.equal(await saveText(), viewSeedText);
    assert(button('Set scene camera').disabled); assert(!button('Apply').disabled); assert(!button('Discard').disabled);
    assert.equal(navigationDom.pendingFrames(), 0);

    // Cancellation before RAF costs no presentations and removes capture/queued work.
    for (const cancel of ['pointercancel', 'lostpointercapture', 'canvas blur', 'window blur', 'Escape']) {
      const calls = viewControl.calls.length;
      await pointer(canvas, 'pointerdown', 140, 125); await pointer(canvas, 'pointermove', 143, 127);
      assert.equal(navigationDom.pendingFrames(), 1);
      await act(async () => {
        if (cancel === 'canvas blur') canvas.dispatchEvent(new dom.window.Event('blur'));
        else if (cancel === 'window blur') dom.window.dispatchEvent(new dom.window.Event('blur'));
        else if (cancel === 'Escape') canvas.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true}));
        else navigationDom.pointer(canvas, cancel, 143, 127);
      });
      await flushNavigation(); assert.equal(viewControl.calls.length, calls, cancel);
      assert.equal(navigationDom.captures(), 0); assert.equal(navigationDom.pendingFrames(), 0);
      assert(!button('Open').disabled); assertCorrective();
    }
    for (const releaseBeforeResize of [false, true]) {
      const calls = viewControl.calls.length;
      await pointer(canvas, 'pointerdown', 140, 125); await pointer(canvas, 'pointermove', 146, 130);
      if (releaseBeforeResize) await pointer(canvas, 'pointerup', 146, 130);
      navigationDom.setRect({left: 50, top: 30, width: 800, height: 500});
      await flushNavigation(); assert.equal(viewControl.calls.length, calls, 'Changed CSS rectangle refuses queued input before dispatch');
      assert.equal(navigationDom.captures(), 0); assert.equal(navigationDom.pendingFrames(), 0);
      assert(!button('Open').disabled); assertCorrective();
      navigationDom.setRect({left: 40, top: 25, width: 900, height: 600});
    }
    await click('Pan'); assert.equal(button('Pan').getAttribute('aria-pressed'), 'true');
    await pointer(canvas, 'pointerdown', 150, 135); await pointer(canvas, 'pointermove', 145, 139); await pointer(canvas, 'pointerup', 145, 139);
    await flushNavigation(); // View 3: selected Pan mode.
    let local = interaction(accumulated, 'pan', -5, 4);
    assertViewRequest(viewControl.calls.at(-1), viewSeed, local); assert.equal(counts.view, 3);
    await click('Zoom in'); await flushNavigation(); // View 4: accessible zoom button.
    local = zoomView(local, 1.15); assertViewRequest(viewControl.calls.at(-1), viewSeed, local);
    assertCorrective(); assert.equal(await saveText(), viewSeedText); assert(button('Set scene camera').disabled);
    await click('Open'); const chooserCalls = viewControl.calls.length;
    await pointer(canvas, 'pointerdown', 140, 125); await pointer(canvas, 'pointermove', 155, 132); await wheel(canvas, -30);
    await flushNavigation(); assert.equal(viewControl.calls.length, chooserCalls); assert.equal(navigationDom.captures(), 0);
    assertCorrective();
    await act(async () => container.querySelector('input[type="file"]').dispatchEvent(new dom.window.Event('cancel', {bubbles: true})));
    await click('Help'); await wheel(canvas, -30); await flushNavigation(); assert.equal(viewControl.calls.length, chooserCalls);
    await click('Help'); assertCorrective();
    await click('Scene camera'); // View 5: separate acknowledged reset, even with corrective strings.
    assert.equal(cameraStatus(), 'Scene view'); assert(button('Scene camera').disabled); assertCorrective();
    assertViewRequest(viewControl.calls.at(-1), viewSeed, viewSeed.display.camera); assert.equal(await saveText(), viewSeedText);
    await click('Discard'); assert.equal(unloadBlocked(), false); assert(button('Undo').disabled); assert(button('Redo').disabled);
    await click('Zoom out'); await flushNavigation(); // View 6: second accessible zoom direction.
    local = zoomView(viewSeed.display.camera, 1 / 1.15);
    assertViewRequest(viewControl.calls.at(-1), viewSeed, local); assert.equal(cameraStatus(), 'User view');
    assert.equal(unloadBlocked(), false, 'Local navigation alone is not unsaved authorship');
    // #1693 reuses this already-counted local view; staging adds no presentation or file transport.
    const beforeRotationView = flowControllers.at(-1).getSession().getSnapshot(), beforeRotationCalls = viewControl.calls.length;
    await click('Rotate +90°');
    assert.equal(flowControllers.at(-1).getSession().getSnapshot(), beforeRotationView);
    assert.equal(viewControl.calls.length, beforeRotationCalls); assert.equal(cameraStatus(), 'User view');
    assert(!button('Apply').disabled); await click('Discard');
    assert.deepEqual(flowControllers.at(-1).getSession().getSnapshot().viewportCamera, beforeRotationView.viewportCamera);
    assert.equal(viewControl.calls.length, beforeRotationCalls); assert.equal(cameraStatus(), 'User view');
    assert(!button('Set scene camera').disabled); const setCalls = viewControl.calls.length;
    await click('Set scene camera'); // Authored call, not a navigation replacement.
    assert.equal(viewControl.calls.length, setCalls + 1); assert.equal(cameraStatus(), 'Scene view'); assert(button('Set scene camera').disabled);
    await act(async () => button('Set scene camera').click()); assert.equal(viewControl.calls.length, setCalls + 1);
    const setText = await saveText(), setDocument = api.parseRenderNativeLightDocument(setText);
    assert.deepEqual(setDocument, {...viewSeed, revision: viewSeed.revision + 1,
      display: {...viewSeed.display, camera: local}, lights: {...viewSeed.lights, revision: viewSeed.revision + 1}});
    assertCamera(api.readLightFields(setDocument).camera); assert(!button('Undo').disabled); assert(button('Redo').disabled);

    await click('Orbit'); await pointer(canvas, 'pointerdown', 140, 125); await pointer(canvas, 'pointermove', 147, 122); await pointer(canvas, 'pointerup', 147, 122);
    await flushNavigation(); // View 7: independent local view retained through Apply/Undo/Redo.
    local = interaction(setDocument.display.camera, 'orbit', 7, -3);
    assertViewRequest(viewControl.calls.at(-1), setDocument, local);
    await edit('Ambient strength', '.33');
    let retainedText, retained;
    for (const action of ['Apply', 'Undo', 'Redo']) {
      await click(action); retainedText = await saveText(); retained = api.parseRenderNativeLightDocument(retainedText);
      assertViewRequest(viewControl.calls.at(-1), retained, local); assert.equal(cameraStatus(), 'User view');
      assert.deepEqual(retained.display.camera, setDocument.display.camera);
      assert.equal(retained.lights.ambientStrength, action === 'Undo' ? viewSeed.lights.ambientStrength : .33);
    }
    viewControl.refusal = new Error('Controlled local navigation refusal');
    await wheel(canvas, -25); await flushNavigation(); // View 8: recoverable refusal clears busy/queued work.
    assert.equal(counts.view, 8); assert(text().includes('PRESENTATION_REFUSED')); assert.equal(cameraStatus(), 'User view');
    assert.equal(navigationDom.pendingFrames(), 0); assert(!button('Open').disabled); assert(!button('Set scene camera').disabled);
    assert.equal(await saveText(), retainedText); viewControl.refusal = null;
    const incoming = {...retained, documentId: `navigation_open_${kind}`,
      lights: {...retained.lights, sourceId: `navigation_open_${kind}`}, display: {...retained.display, camera: viewSeed.display.camera}};
    const openText = api.serializeRenderNativeLightDocument(incoming);
    viewControl.refusal = new Error('Controlled navigation Open refusal');
    await click('Open'); await selectFile(file(openText)); assert(text().includes('PRESENTATION_REFUSED'));
    assert.equal(cameraStatus(), 'User view'); assert.equal(await saveText(), retainedText); viewControl.refusal = null;
    await click('Open'); await selectFile(file(openText));
    assert.equal(cameraStatus(), 'Scene view'); assert(button('Undo').disabled); assert(button('Redo').disabled);
    assert.equal(await saveText(), openText); assertCamera(api.readLightFields(incoming).camera);

    let releaseCancelled; viewControl.wait = new Promise(resolve => {releaseCancelled = resolve;});
    await pointer(canvas, 'pointerdown', 140, 125); await pointer(canvas, 'pointermove', 150, 129); await flushNavigation(); // View 9.
    const acknowledgedAfterCancel = interaction(incoming.display.camera, 'orbit', 10, 4);
    assertViewRequest(viewControl.calls.at(-1), incoming, acknowledgedAfterCancel);
    await pointer(canvas, 'pointermove', 175, 145); await pointer(canvas, 'pointercancel', 175, 145);
    assert.equal(navigationDom.captures(), 0); assert.equal(navigationDom.pendingFrames(), 0); assert(button('Open').disabled);
    await act(async () => {releaseCancelled(); await viewControl.wait;}); viewControl.wait = null;
    await flushNavigation(); assert.equal(counts.view, 9); assert.equal(cameraStatus(), 'User view'); assert(!button('Open').disabled);
    assert.equal(await saveText(), openText, 'Cancellation retains the ACK without authoring queued motion');
    let releaseLost; viewControl.wait = new Promise(resolve => {releaseLost = resolve;});
    await wheel(canvas, -20); await flushNavigation(); // View 10: ACK followed by live loss.
    assertViewRequest(viewControl.calls.at(-1), incoming, zoomView(acknowledgedAfterCancel, Math.exp(.02)));
    viewControl.state = 'lost';
    await act(async () => {releaseLost(); await viewControl.wait;}); viewControl.wait = null;
    assert(text().includes('Presentation unavailable (lost)')); assert.equal(cameraStatus(), 'User view');
    assert(button('Zoom in').disabled); assert.equal(await saveText(), openText);
    assert.equal(navigationDom.pendingFrames(), 0); assert.equal(navigationDom.captures(), 0);
    const lostControl = viewControl;
    await click('Remount accepted scene'); assert.equal(lostControl.disposed, 1);
    viewControl = track(controls.at(-1)); canvas = container.querySelector('canvas');
    assert.equal(cameraStatus(), 'Scene view'); assert.equal(await saveText(), openText);

    for (const lateRefusal of [false, true]) {
      const old = viewControl, oldCanvas = canvas; let releaseLate;
      old.wait = new Promise(resolve => {releaseLate = resolve;});
      if (lateRefusal) old.refusal = new Error('Disposed late navigation refusal');
      await pointer(oldCanvas, 'pointerdown', 140, 125); await pointer(oldCanvas, 'pointermove', 145, 128); await flushNavigation(); // Views 11 and 12.
      await pointer(oldCanvas, 'pointermove', 155, 135); const oldCalls = old.calls.length;
      await mounted.dispose(); assert.equal(old.disposed, 1); assert.equal(navigationDom.captures(), 0); assert.equal(navigationDom.pendingFrames(), 0);
      mounted = await api.mountLightWorkbenchFlow(container, incoming); viewControl = track(controls.at(-1)); canvas = container.querySelector('canvas');
      await pointer(oldCanvas, 'pointerdown', 140, 125); await pointer(oldCanvas, 'pointermove', 160, 135); await wheel(oldCanvas, -25);
      await act(async () => {releaseLate(); await old.wait;}); old.wait = null;
      await flushNavigation(); assert.equal(old.calls.length, oldCalls); assert.equal(viewControl.calls.length, 0);
      assert.equal(navigationDom.pendingFrames(), 0); assert.equal(navigationDom.captures(), 0);
      assert.equal(cameraStatus(), 'Scene view'); assert.equal(await saveText(), openText);
      assert(!text().includes('Disposed late navigation refusal')); assert(!button('Zoom in').disabled);
    }
    assert.equal(counts.view, 12); assert.equal(counts.authored, 6);
    await mounted.dispose(); assert.equal(viewControl.disposed, 1);
    assert.equal(navigationDom.pendingFrames(), 0); assert.equal(navigationDom.captures(), 0);
    navigationFlow.push({kind, viewReplacements: counts.view, authoredReplacements: counts.authored,
      coalescedPresentations: 2, cancellationCases: 6, queuedRectangleRefusals: 2, lateCompletionCases: 2, pendingFrames: navigationDom.pendingFrames(), captures: navigationDom.captures()});
  }

  // #1650: 36 named pure cases; each calls the real fitter once. Projection uses
  // independent original CAD hulls and the GPU's prepared Float32 camera matrices.
  // The React cases below separately cap *all* new replacements at eight per kind,
  // including the three authored/history setup replacements and refused/late ones.
  const framingChecks = [], framingFlow = [];
  const frameViewport = {width: 900, height: 600, backingWidth: 960, backingHeight: 600};
  const makeFramingSeed = kind => {
    const raw = structuredClone(api.createLightStudy(sourceText, kind));
    raw.nativeDocument.bodies.forEach(body => {body.name = 'Repeated Surface';});
    raw.display.camera = {eye: [2, 3, 6], target: [-0, -.5, 0], up: [-0, 2, -0], fovYDegrees: 55, near: .025, far: 120};
    Object.assign(poseFor(raw, A), {translationMM: [-8200, 900, -1500],
      rotationXYZW: [Math.SQRT1_2, -0, -0, Math.SQRT1_2], scale: [1.3, .7, .8]});
    const q = Math.SQRT1_2 * (1 + 2e-10);
    Object.assign(poseFor(raw, B), {translationMM: [7300, -0, 2100], rotationXYZW: [-0, -0, q, q], scale: [.65, 1.4, 1.1]});
    return api.prepareRenderNativeLightDocument(raw).document;
  };
  const close = (actual, expected, message, tolerance = 1e-10) => assert(Math.abs(actual - expected) <= tolerance, message + ': ' + actual + ' vs ' + expected);
  const unitView = camera => {
    const offset = camera.eye.map((value, index) => value - camera.target[index]), length = Math.hypot(...offset);
    return offset.map(value => value / length);
  };
  const assertFramingProjection = (document, camera, ids, viewport, previous) => {
    assert.deepEqual(camera.up, previous.up, 'Raw Up magnitude and signed zero survive framing');
    assert.equal(camera.fovYDegrees, previous.fovYDegrees);
    const direction = unitView(camera); unitView(previous).forEach((value, index) => close(direction[index], value, 'Current orientation ' + index));
    const inspected = api.inspectLightFramingFlow(document, camera, ids, viewport);
    assert.deepEqual(inspected.map(item => item.bodyId), ids);
    const points = [];
    for (const item of inspected) {
      assert.equal(item.report.geometryAuthority, 'original-native-control-hull');
      assert.equal(item.report.quality.boundsSemantics, 'conservative-control-hull-not-tight-geometry-extrema');
      assert.equal(item.corners.length, 8);
      assert.deepEqual(item.boundsMM, {min: [-700, -550, -700], max: [700, -550, 700]});
      for (const pin of ['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'geometryId'])
        assert.deepEqual(item.reference[pin], item.binding[pin], 'Original bounds pin ' + pin);
      assert.equal(item.binding.modelId, 'cloth_reference_981'); assert.equal(item.binding.geometryId, 'reference_panel');
      for (const corner of item.corners) {
        points.push(corner.worldScene);
        assert([...corner.worldScene, corner.depth, ...corner.clip, ...corner.ndc].every(Number.isFinite));
        assert(corner.clip[3] > 0 && corner.depth > camera.near && corner.depth < camera.far, 'Every corner has positive depth and clipping slack');
        assert(Math.abs(corner.ndc[0]) <= 1 / 1.2 + 2e-5 && Math.abs(corner.ndc[1]) <= 1 / 1.2 + 2e-5,
          'Actual Float32 corner projection retains the declared 1.2 margin');
        assert(corner.ndc[2] > -1 && corner.ndc[2] < 1, 'Actual prepared projection clips retain every corner');
      }
    }
    for (let axis = 0; axis < 3; axis++) close(camera.target[axis],
      (Math.min(...points.map(point => point[axis])) + Math.max(...points.map(point => point[axis]))) / 2, 'Control-hull center ' + axis);
    return inspected;
  };
  const pureFrame = (name, document, camera, viewport = frameViewport, bodyId, refuses = false) => {
    framingChecks.push({name, outcome: refuses ? 'refused' : 'projected'});
    assert(framingChecks.length <= 36, 'Focused framing pure-case cap');
    if (refuses) {assert.throws(() => api.deriveNativeLightFramingCamera(document, camera, viewport, bodyId), undefined, name); return;}
    return api.deriveNativeLightFramingCamera(document, camera, viewport, bodyId);
  };
  const framingSeed = makeFramingSeed('directional'), framingSeedText = api.serializeRenderNativeLightDocument(framingSeed);
  const framingCamera = framingSeed.display.camera;
  const fitA = pureFrame('qualified off-origin A', framingSeed, framingCamera, frameViewport, A);
  const inspectedA = assertFramingProjection(framingSeed, fitA, [A], frameViewport, framingCamera);
  // Literal 90-degree X/Z expectations are separate from both fitter and pose oracle.
  inspectedA[0].corners[0].worldScene.forEach((value, axis) => close(value, [-9.11, 1.46, -1.885][axis], 'Original A corner rotation ' + axis));
  const fitB = pureFrame('raw signed nonunit-tolerance Z rotation and nonuniform B', framingSeed, framingCamera, frameViewport, B);
  const inspectedB = assertFramingProjection(framingSeed, fitB, [B], frameViewport, framingCamera);
  inspectedB[0].corners[0].worldScene.forEach((value, axis) => close(value, [8.07, -.455, 1.33][axis], 'Original B corner rotation ' + axis));
  assert.notDeepEqual(inspectedA[0].reference, inspectedB[0].reference, 'Repeated geometry IDs remain distinct original body/asset references');
  assert.notEqual(Math.hypot(...poseFor(framingSeed, B).rotationXYZW), 1, 'Fixture retains raw accepted quaternion tolerance');
  const fitAll = pureFrame('all visible original bodies', framingSeed, framingCamera);
  assertFramingProjection(framingSeed, fitAll, [A, B], frameViewport, framingCamera);
  assert.notDeepEqual(fitAll, fitB, 'All is not a substituted selected body');
  const portrait = {...frameViewport, backingWidth: 600, backingHeight: 960};
  const fitPortrait = pureFrame('backing aspect differs from CSS aspect', framingSeed, framingCamera, portrait);
  assertFramingProjection(framingSeed, fitPortrait, [A, B], portrait, framingCamera);
  assert(Math.hypot(...fitPortrait.eye.map((value, axis) => value - fitPortrait.target[axis]))
    > Math.hypot(...fitAll.eye.map((value, axis) => value - fitAll.target[axis])), 'Portrait backing needs a larger fit');
  const highDpi = {...frameViewport, backingWidth: 1920, backingHeight: 1200};
  const fitHighDpi = pureFrame('equal backing aspect at different resolution', framingSeed, framingCamera, highDpi);
  assert.deepEqual(fitHighDpi, fitAll); assertFramingProjection(framingSeed, fitHighDpi, [A, B], highDpi, framingCamera);
  const hiddenRaw = structuredClone(framingSeed); hiddenRaw.display.visibleBodyIds = [B]; hiddenRaw.surfaceMaterials = hiddenRaw.surfaceMaterials.filter(item => item.target.bodyId === B);
  const hidden = api.prepareRenderNativeLightDocument(hiddenRaw).document;
  const fitHidden = pureFrame('all excludes hidden original body', hidden, framingCamera);
  assert.deepEqual(fitHidden, fitB); assertFramingProjection(hidden, fitHidden, [B], frameViewport, framingCamera);
  const unboundRaw = structuredClone(framingSeed); unboundRaw.surfaceMaterials = unboundRaw.surfaceMaterials.filter(item => item.target.bodyId === B);
  const unbound = api.prepareRenderNativeLightDocument(unboundRaw).document;
  const fitUnbound = pureFrame('all excludes visible unbound original body', unbound, framingCamera);
  assert.deepEqual(fitUnbound, fitB); assertFramingProjection(unbound, fitUnbound, [B], frameViewport, framingCamera);
  const identityRaw = structuredClone(framingSeed); identityRaw.display.poses = [];
  const identity = api.prepareRenderNativeLightDocument(identityRaw).document;
  const fitIdentity = pureFrame('omitted poses retain native identity intent', identity, framingCamera, frameViewport, A);
  assertFramingProjection(identity, fitIdentity, [A], frameViewport, framingCamera);
  const pointFramingSeed = makeFramingSeed('point');
  const fitPoint = pureFrame('point uses the same qualified geometry fit', pointFramingSeed, framingCamera, frameViewport, B);
  assert.deepEqual(fitPoint, fitB); assertFramingProjection(pointFramingSeed, fitPoint, [B], frameViewport, framingCamera);
  const smallRaw = structuredClone(framingSeed);
  Object.assign(poseFor(smallRaw, B), {scale: [.001, .002, .003], translationMM: [0, -0, 0]});
  const small = api.prepareRenderNativeLightDocument(smallRaw).document;
  const fitSmall = pureFrame('Native minimum positive scale remains admitted', small, framingCamera, frameViewport, B);
  assertFramingProjection(small, fitSmall, [B], frameViewport, framingCamera);
  const distantRaw = structuredClone(framingSeed); distantRaw.display.mmToSceneUnit = .02;
  const distant = api.prepareRenderNativeLightDocument(distantRaw).document;
  const fitDistant = pureFrame('no unrelated Source1 100-unit travel limit', distant, framingCamera, frameViewport, A);
  assert(Math.hypot(...fitDistant.target) > 100); assertFramingProjection(distant, fitDistant, [A], frameViewport, framingCamera);
  for (const [name, patch] of [['zero CSS width', {width: 0}], ['nonfinite CSS height', {height: NaN}],
    ['fractional backing size', {backingWidth: 960.5}], ['oversized backing axis', {backingHeight: 4097}],
    ['oversized backing area', {backingWidth: 4096, backingHeight: 4096}]])
    pureFrame(name, framingSeed, framingCamera, {...frameViewport, ...patch}, undefined, true);
  for (const [name, patch] of [['degenerate current camera', {target: framingCamera.eye}], ['zero current Up', {up: [0, -0, 0]}]])
    pureFrame(name, framingSeed, {...framingCamera, ...patch}, frameViewport, undefined, true);
  for (const [name, document, bodyId] of [['missing selected body', framingSeed, 'foreign_body'],
    ['geometry ID is not a selected body', framingSeed, 'reference_panel'], ['hidden selected body', hidden, A], ['unbound selected body', unbound, A]])
    pureFrame(name, document, framingCamera, frameViewport, bodyId, true);
  pureFrame('empty material-bound population', {...framingSeed, surfaceMaterials: []}, framingCamera, frameViewport, undefined, true);
  for (const pin of ['documentId', 'documentRevision', 'bodyId', 'assetId', 'assetRevision', 'modelId', 'geometryId']) {
    const stale = structuredClone(framingSeed), target = stale.surfaceMaterials[1].target;
    target[pin] = typeof target[pin] === 'number' ? target[pin] + 1 : 'foreign_' + target[pin];
    pureFrame('mismatched original material pin ' + pin, stale, framingCamera, frameViewport, B, true);
  }
  pureFrame('ambiguous duplicate material binding', {...framingSeed, surfaceMaterials: [framingSeed.surfaceMaterials[1], framingSeed.surfaceMaterials[1]]}, framingCamera, frameViewport, B, true);
  let framingGetterReads = 0;
  const accessorViewport = {...frameViewport}; Object.defineProperty(accessorViewport, 'width', {enumerable: true, get() {framingGetterReads++; return 900;}});
  pureFrame('dimension accessor never executes', framingSeed, framingCamera, accessorViewport, undefined, true);
  const accessorCamera = {...framingCamera}; Object.defineProperty(accessorCamera, 'up', {enumerable: true, get() {framingGetterReads++; return [0, 1, 0];}});
  pureFrame('camera accessor never executes', framingSeed, accessorCamera, frameViewport, undefined, true);
  const accessorDocument = {...framingSeed}; Object.defineProperty(accessorDocument, 'display', {enumerable: true, get() {framingGetterReads++; return framingSeed.display;}});
  pureFrame('document accessor never executes', accessorDocument, framingCamera, frameViewport, undefined, true);
  pureFrame('throwing dimension reflection is recoverable', framingSeed, framingCamera,
    new Proxy(frameViewport, {ownKeys() {throw new Error('Controlled dimension reflection refusal');}}), undefined, true);
  const hugeRaw = structuredClone(framingSeed); hugeRaw.display.mmToSceneUnit = 1;
  pureFrame('derived camera outside actual camera limits', hugeRaw, framingCamera, frameViewport, B, true);
  assert.equal(framingChecks.length, 36); assert.equal(framingGetterReads, 0);
  assert.equal(api.serializeRenderNativeLightDocument(framingSeed), framingSeedText, 'All accepted signed authoring authority remains immutable');

  for (const kind of ['directional', 'point']) {
    const frameSeed = kind === 'directional' ? framingSeed : pointFramingSeed;
    const seedText = api.serializeRenderNativeLightDocument(frameSeed), replacementCounts = {view: 0, authored: 0, total: 0};
    const trackFrame = control => {
      control.prepare = prepareBodyAppearance;
      const replace = control.viewer.replace;
      control.viewer.replace = request => {
        replacementCounts.total++; assert(replacementCounts.total <= 8, kind + ': eight total framing-flow replacements');
        const owner = control.viewer.accepted.owner;
        if (request.owner.id === owner.id && Object.is(request.owner.revision, owner.revision)) replacementCounts.view++;
        else replacementCounts.authored++;
        return replace(request);
      };
      return control;
    };
    navigationDom.setRect({left: 40, top: 25, width: frameViewport.width, height: frameViewport.height});
    mounted = await api.mountLightWorkbenchFlow(container, frameSeed);
    let frameControl = trackFrame(controls.at(-1)), canvas = container.querySelector('canvas');
    await selectBody(B); assert(!button('Frame selected').disabled); assert(!button('Frame all').disabled);
    assert.equal(await saveText(), seedText); assert.equal(unloadBlocked(), false);
    const corrective = [['Camera eye X', ''], ['Intensity', '1e'], ['Body position X (mm)', '-'], ['Uniform amount', 'NaN']];
    const stageCorrective = async () => {for (const [label, value] of corrective) await edit(label, value);};
    const assertCorrective = () => {for (const [label, value] of corrective) assert.equal(inputValue(label), value, 'Framing retains ' + label);};
    const assertSelected = () => assert.equal(button('Edit body ' + B).getAttribute('aria-pressed'), 'true');
    const assertBlockedFrames = reason => {for (const label of ['Frame selected', 'Frame all']) assert(button(label).disabled, reason + ': ' + label);};
    await stageCorrective(); await click('Frame selected'); // 1: accepted selected fit.
    assert.equal(replacementCounts.total, 1);
    let local = frameControl.calls.at(-1).display.camera;
    assertViewRequest(frameControl.calls.at(-1), frameSeed, local);
    assertFramingProjection(frameSeed, local, [B], frameViewport, frameSeed.display.camera);
    assertCorrective(); assertSelected(); assert.equal(await saveText(), seedText); assert.equal(cameraStatus(), 'User view');
    assert(button('Undo').disabled); assert(button('Redo').disabled); assert(button('Set scene camera').disabled);
    const firstGeneration = frameControl.viewer.accepted.generation;
    await click('Frame selected'); assert.equal(replacementCounts.total, 1); assert.equal(frameControl.viewer.accepted.generation, firstGeneration);
    assertCorrective(); assertSelected(); assert.equal(await saveText(), seedText);

    // Drag and queued navigation fences are exercised without flushing a new presentation.
    await pointer(canvas, 'pointerdown', 140, 125); assertBlockedFrames('active drag');
    await pointer(canvas, 'pointermove', 148, 130); assert.equal(navigationDom.pendingFrames(), 1); assertBlockedFrames('queued navigation');
    await act(async () => {button('Frame selected').click(); button('Frame all').click(); navigationDom.pointer(canvas, 'pointercancel', 148, 130);});
    await flushNavigation(); assert.equal(replacementCounts.total, 1); assert.equal(navigationDom.captures(), 0); assert.equal(navigationDom.pendingFrames(), 0);
    await click('Help'); assertBlockedFrames('Help'); await act(async () => {button('Frame all').click();}); await click('Help');
    await click('Open'); assertBlockedFrames('file chooser'); await act(async () => {button('Frame selected').click();});
    await act(async () => container.querySelector('input[type="file"]').dispatchEvent(new dom.window.Event('cancel', {bubbles: true})));
    assert.equal(replacementCounts.total, 1); assertCorrective(); assertSelected();
    canvas.width = 480; await click('Frame selected');
    assert(text().includes('PRESENTATION_REFUSED')); assert.equal(replacementCounts.total, 1); assertCorrective();
    canvas.width = frameViewport.backingWidth;
    navigationDom.setRect({left: 40, top: 25, width: 0, height: 600}); await click('Frame all');
    assert(text().includes('DOCUMENT_INPUT')); assert.equal(replacementCounts.total, 1); assertCorrective();
    navigationDom.setRect({left: 40, top: 25, width: frameViewport.width, height: frameViewport.height});

    await click('Discard'); assert.equal(unloadBlocked(), false, 'Framing alone does not dirty authoring');
    let releaseAuthored; frameControl.wait = new Promise(resolve => {releaseAuthored = resolve;});
    await edit('Ambient strength', '.3'); await act(async () => button('Apply').click()); // 2: first authored edit.
    assertBlockedFrames('pending author operation'); await act(async () => {button('Frame all').click();});
    await act(async () => {releaseAuthored(); await frameControl.wait;}); frameControl.wait = null;
    assert.deepEqual(frameControl.calls.at(-1).display.camera, local, 'Apply retains framed local view');
    await edit('Ambient strength', '.4'); await click('Apply'); // 3: second authored edit.
    assert.deepEqual(frameControl.calls.at(-1).display.camera, local);
    await click('Undo'); // 4: both history branches exist, local fit is retained.
    assert.deepEqual(frameControl.calls.at(-1).display.camera, local); assertHistory();
    const retainedText = await saveText(), retained = api.parseRenderNativeLightDocument(retainedText);
    assert.deepEqual(retained, {...frameSeed, revision: frameSeed.revision + 3, lights: {...frameSeed.lights, revision: frameSeed.revision + 3, ambientStrength: .3}});
    await stageCorrective(); assertSelected();
    frameControl.refusal = new Error('Controlled framing presentation refusal');
    let releaseRefusal; frameControl.wait = new Promise(resolve => {releaseRefusal = resolve;});
    await act(async () => button('Frame all').click()); // 5: pending recoverable refusal.
    assert.equal(replacementCounts.total, 5); assertBlockedFrames('pending framing');
    const refusedCamera = frameControl.calls.at(-1).display.camera;
    assertViewRequest(frameControl.calls.at(-1), retained, refusedCamera);
    assertFramingProjection(retained, refusedCamera, [A, B], frameViewport, local);
    for (const label of ['Apply', 'Discard', 'Undo', 'Redo', 'Open', 'Save accepted', 'Import legacy Native scene', 'New directional', 'New point',
      'Back to materials', 'Edit body ' + A, 'Edit body ' + B, 'Scene camera', 'Set scene camera', 'Zoom in', 'Zoom out'])
      assert(button(label).disabled, 'Pending framing fences ' + label);
    for (const [label] of corrective) assert(container.querySelector(`[aria-label="${label}"]`).disabled, 'Pending framing field ' + label);
    await act(async () => {button('Frame selected').click(); button('Frame all').click(); button('Apply').click(); button('Open').click(); button('Edit body ' + A).click();});
    await pointer(canvas, 'pointerdown', 140, 125); await pointer(canvas, 'pointermove', 155, 135); await wheel(canvas, -30); await flushNavigation();
    assert.equal(replacementCounts.total, 5); assert.equal(navigationDom.captures(), 0); assert.equal(navigationDom.pendingFrames(), 0);
    await act(async () => {releaseRefusal(); await frameControl.wait;}); frameControl.wait = null;
    assert(text().includes('PRESENTATION_REFUSED')); assertCorrective(); assertSelected(); assert.equal(cameraStatus(), 'User view');
    assert.equal(await saveText(), retainedText); assert(button('Undo').disabled); assert(button('Redo').disabled);
    frameControl.refusal = null; await click('Frame all'); // 6: same scope retries after refusal.
    assert.equal(replacementCounts.total, 6); assert.deepEqual(frameControl.calls.at(-1).display.camera, refusedCamera);
    local = frameControl.calls.at(-1).display.camera;
    assertViewRequest(frameControl.calls.at(-1), retained, local); assertCorrective(); assertSelected();
    assert.equal(await saveText(), retainedText); assert(button('Undo').disabled); assert(button('Redo').disabled);
    const allGeneration = frameControl.viewer.accepted.generation;
    await click('Frame all'); assert.equal(replacementCounts.total, 6); assert.equal(frameControl.viewer.accepted.generation, allGeneration);
    assertCorrective(); assertSelected(); assert.equal(await saveText(), retainedText);
    await click('Discard'); assertHistory(); await stageCorrective();

    for (const lateRefusal of [false, true]) {
      const old = frameControl, oldCanvas = canvas; let releaseLateFrame;
      old.wait = new Promise(resolve => {releaseLateFrame = resolve;});
      if (lateRefusal) old.refusal = new Error('Disposed late framing refusal');
      await act(async () => button(lateRefusal ? 'Frame all' : 'Frame selected').click()); // 7 and 8: disposed completion cases.
      const oldCalls = old.calls.length; assertBlockedFrames('late pending framing');
      await mounted.dispose(); assert.equal(old.disposed, 1); assert.equal(navigationDom.captures(), 0); assert.equal(navigationDom.pendingFrames(), 0);
      mounted = await api.mountLightWorkbenchFlow(container, retained); frameControl = trackFrame(controls.at(-1)); canvas = container.querySelector('canvas');
      await pointer(oldCanvas, 'pointerdown', 140, 125); await pointer(oldCanvas, 'pointermove', 150, 130); await wheel(oldCanvas, -20);
      await act(async () => {releaseLateFrame(); await old.wait;}); old.wait = null; await flushNavigation();
      assert.equal(old.calls.length, oldCalls); assert.equal(old.disposed, 1); assert.equal(frameControl.calls.length, 0);
      assert.equal(cameraStatus(), 'Scene view'); assertCamera(api.readLightFields(retained).camera);
      assert(!text().includes('Disposed late framing refusal')); assert(!button('Frame all').disabled);
      assert.equal(await saveText(), retainedText); assert(button('Undo').disabled); assert(button('Redo').disabled);
      assert.equal(navigationDom.pendingFrames(), 0); assert.equal(navigationDom.captures(), 0);
    }
    assert.deepEqual(replacementCounts, {view: 5, authored: 3, total: 8});
    frameControl.state = 'lost'; await act(async () => {await new Promise(resolve => setTimeout(resolve, 350));});
    assertBlockedFrames('unavailable Viewer'); assert.equal(replacementCounts.total, 8);
    await mounted.dispose(); assert.equal(frameControl.disposed, 1);
    assert.equal(navigationDom.pendingFrames(), 0); assert.equal(navigationDom.captures(), 0);
    framingFlow.push({kind, ...replacementCounts, repeatNoOpCases: 2, disposedCompletionCases: 2,
      pendingFrames: navigationDom.pendingFrames(), captures: navigationDom.captures()});
  }

  // #1654: exactly ten new pointer sequences per kind; provider identities are
  // derived from actual accepted preparation, never screen-space surrogate picks.
  const selectionFlow = [];
  for (const kind of ['directional', 'point']) {
    const pickSeed = api.createLightStudy(sourceText, kind), pickText = api.serializeRenderNativeLightDocument(pickSeed);
    const entries = api.prepareRenderNativeLightDocument(pickSeed).entries.filter(entry => entry.kind === 'surface');
    assert.equal(entries.length, 2); assert.equal(entries[0].binding.geometryId, entries[1].binding.geometryId);
    assert.notEqual(entries[0].ref.modelId, entries[1].ref.modelId);
    const firstId = entries[0].binding.bodyId, secondId = entries[1].binding.bodyId;
    navigationDom.setRect({left: 40, top: 25, width: 900, height: 600});
    mounted = await api.mountLightWorkbenchFlow(container, pickSeed);
    const pickControl = controls.at(-1), canvas = container.querySelector('canvas');
    pickControl.prepare = prepareBodyAppearance;
    const hit = index => ({generation: pickControl.viewer.accepted.generation,
      ref: {kind: 'surface', modelId: entries[index].ref.modelId, surfaceId: entries[index].ref.geometryId}, binding: entries[index].binding});
    pickControl.pickResult = () => hit(1);
    const selected = () => [...container.querySelectorAll('button')].find(node => node.getAttribute('aria-label')?.startsWith('Edit body ')
      && node.getAttribute('aria-pressed') === 'true').getAttribute('aria-label').slice(10);
    let sequences = 0;
    const start = async (x = 140, y = 125, shift = false) => {sequences++; assert(sequences <= 10, kind + ': ten pointer-sequence cap'); await pointer(canvas, 'pointerdown', x, y, shift);};
    const finish = async (x = 140, y = 125) => pointer(canvas, 'pointerup', x, y);
    const cleanTransport = () => {assert.equal(navigationDom.captures(), 0); assert.equal(navigationDom.pendingFrames(), 0);};
    await selectBody(firstId); await edit('Body position X (mm)', '-');
    await selectBody(secondId); await edit('Body position X (mm)', '1e'); await selectBody(firstId);
    await edit('Intensity', 'NaN'); await edit('Camera eye X', '');
    assert.equal(await saveText(), pickText);
    let releaseNormal; const normalRelease = new Promise(resolve => {releaseNormal = resolve;});
    pickControl.pickResult = () => normalRelease;
    await start(); await finish(); // 1: actual UI hit after the normal delayed capture-release event.
    await pointer(canvas, 'lostpointercapture', 140, 125);
    assert(button('Open').disabled, 'Normal capture release does not cancel or finish the pending click read');
    await act(async () => {releaseNormal(hit(1)); await normalRelease;});
    assert.equal(selected(), secondId); assert.equal(inputValue('Body position X (mm)'), '1e');
    assert.deepEqual(pickControl.picks, [[106, 100]]); assert.equal(pickControl.calls.length, 0); cleanTransport();
    await selectBody(firstId); assert.equal(inputValue('Body position X (mm)'), '-'); await selectBody(secondId);
    pickControl.pickResult = () => ({generation: pickControl.viewer.accepted.generation, ref: null, binding: null});
    await start(); await pointer(canvas, 'pointermove', 142, 126); assert.equal(navigationDom.pendingFrames(), 0); await finish(142, 126); // 2
    assert.equal(selected(), secondId); assert.deepEqual(pickControl.picks.at(-1), [108, 101]); assert.equal(pickControl.calls.length, 0); cleanTransport();
    assert.equal(inputValue('Intensity'), 'NaN'); assert.equal(inputValue('Camera eye X'), ''); assert.equal(await saveText(), pickText);

    await start(); await pointer(canvas, 'pointermove', 142, 126); await pointer(canvas, 'pointermove', 150, 129); await finish(150, 129);
    await flushNavigation(); // 3: threshold crossing includes the complete +10,+4 movement.
    assert.equal(pickControl.calls.length, 1); assert.equal(pickControl.picks.length, 2);
    const movedCamera = interaction(pickSeed.display.camera, 'orbit', 10, 4);
    assertViewRequest(pickControl.calls[0], pickSeed, movedCamera); cleanTransport();
    await start(); await pointer(canvas, 'pointermove', 146, 125); await pointer(canvas, 'pointermove', 140, 125); await finish();
    await flushNavigation(); // 4: maximum excursion exceeded even though the release returned to origin.
    assert.equal(pickControl.picks.length, 2); assert(pickControl.calls.length <= 2); cleanTransport();
    const callsAfterDrags = pickControl.calls.length;
    await start(140, 125, true);
    await act(async () => navigationDom.pointer(canvas, 'pointerup', 140, 125, false, {ctrlKey: true, altKey: true, metaKey: true})); // 5
    assert.equal(pickControl.picks.length, 2); assert.equal(pickControl.calls.length, callsAfterDrags); cleanTransport();
    await start(); await pointer(canvas, 'pointermove', 141, 125); await pointer(canvas, 'pointercancel', 141, 125); await finish(141, 125); // 6
    assert.equal(pickControl.picks.length, 2); assert.equal(pickControl.calls.length, callsAfterDrags); cleanTransport();
    await start(40.5, 125); await finish(39.5, 125); // 7: outside backing bounds without a drag or clamping.
    assert.equal(pickControl.picks.length, 2); assert.equal(pickControl.calls.length, callsAfterDrags); cleanTransport();
    assert.equal(selected(), secondId); assert.equal(await saveText(), pickText);

    let releasePick; const pickGate = new Promise(resolve => {releasePick = resolve;});
    pickControl.pickResult = () => pickGate;
    await start(); await finish(); // 8: pending input is fenced; cancelled/resized completion cannot select A.
    assert.equal(pickControl.picks.length, 3);
    for (const name of ['Open', 'Apply', 'Frame all', 'Frame selected', 'Scene camera']) assert(button(name).disabled, 'Pending query fences ' + name);
    await act(async () => canvas.dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true, cancelable: true})));
    assert(button('Open').disabled, 'Cancelling input does not pretend the provider query ended');
    navigationDom.setRect({left: 42, top: 25, width: 900, height: 600});
    await act(async () => {releasePick(hit(0)); await pickGate;});
    assert.equal(selected(), secondId); assert(!button('Open').disabled); cleanTransport();
    navigationDom.setRect({left: 40, top: 25, width: 900, height: 600});
    pickControl.pickResult = () => {throw new Error('Controlled identity readback failure');};
    await start(); await finish(); // 9: rejected query retains every field and releases busy.
    assert(text().includes('PRESENTATION_REFUSED')); assert.equal(selected(), secondId); assert(!button('Open').disabled);
    assert.equal(inputValue('Body position X (mm)'), '1e'); assert.equal(inputValue('Intensity'), 'NaN');
    assert.equal(inputValue('Camera eye X'), ''); assert.equal(await saveText(), pickText); cleanTransport();

    let releaseLate; const lateGate = new Promise(resolve => {releaseLate = resolve;}); pickControl.pickResult = () => lateGate;
    await start(); await finish(); // 10: old lifetime completion cannot select the fresh workspace.
    await mounted.dispose(); assert.equal(pickControl.disposed, 1); cleanTransport();
    mounted = await api.mountLightWorkbenchFlow(container, pickSeed); const freshControl = controls.at(-1);
    assert.equal(selected(), firstId);
    await act(async () => {releaseLate(hit(1)); await lateGate;});
    assert.equal(selected(), firstId); assert.equal(freshControl.picks.length, 0); assert.equal(freshControl.calls.length, 0);
    assert(!button('Open').disabled); assert.equal(await saveText(), pickText); cleanTransport();
    assert.equal(pickControl.picks.length, 5); assert.equal(pickControl.calls.length, callsAfterDrags);
    assert.equal(sequences, 10); await mounted.dispose(); assert.equal(freshControl.disposed, 1);
    selectionFlow.push({kind, pointerSequences: sequences, picks: pickControl.picks, viewReplacements: callsAfterDrags,
      sourceAndDraftsRetained: true, staleCompletions: 2, captures: navigationDom.captures(), pendingFrames: navigationDom.pendingFrames()});
  }

  // #1676: exactly sixteen transport attempts and six Viewer replacements per kind.
  // Pure qualification cases below do not open a chooser, read a file, or present.
  const materialTransferFlow = [];
  for (const kind of ['directional', 'point']) {
    const raw = structuredClone(api.createLightStudy(sourceText, kind));
    raw.display.camera.up = [-0, 2, -0];
    for (const binding of raw.surfaceMaterials) Object.assign(binding.material, {
      documentId: 'shared-look', title: 'Destination metadata stays here', revision: 7,
      shaderSource: '// Original source, including its whitespace.\n@shader #original {\n  @uniform amount: float(-1, 1, 0);\n  @fragment { color: mix(#ff0000, #0000ff, clamp(amount, 0, 1)); }\n}\n',
      uniforms: {amount: .25},
    });
    const transferSeed = api.prepareRenderNativeLightDocument(raw).document;
    const transferText = api.serializeRenderNativeLightDocument(transferSeed), transferFields = api.readLightFields(transferSeed);
    const portable = api.prepareRenderMaterialDocument({...bindingFor(transferSeed, A).material,
      documentId: 'foreign-portable', title: 'Never adopts this title', revision: 145,
      shaderSource: '// Imported text is retained verbatim.\n@shader #portable {\n  @uniform signed: float(-1, 1, 0);\n  @uniform explicit: float(0, 2, 1);\n  @uniform omitted: float(0, 3, 2);\n  @fragment { color: mix(#00ff00, #0000ff, clamp(signed * explicit, 0, 1)); }\n}\n',
      uniforms: {explicit: 1, signed: -0},
    }).document;
    const portableText = api.serializeRenderMaterialDocument(portable), portableFile = file(portableText, 'foreign.material.json');
    const originalMaterial = bindingFor(transferSeed, A).material;
    assert.equal(api.selectedLightMaterial(transferSeed, A), bindingFor(transferSeed, A), 'Selection returns the existing complete binding');
    assert.equal(new Set(transferSeed.surfaceMaterials.map(binding => binding.material.documentId)).size, 1);
    assert.throws(() => api.prepareRenderMaterialDocument({...originalMaterial, shaderSource: portable.shaderSource}), undefined,
      'New source cannot be paired with the old supplied uniform');
    assert.throws(() => api.prepareRenderMaterialDocument({...originalMaterial, uniforms: portable.uniforms}), undefined,
      'New supplied uniforms cannot be paired with the old source');
    const staged = api.stageLightMaterialFields(transferSeed, transferFields, A, portable);
    assert.notEqual(staged, transferFields); assert.notEqual(materialRow(staged, A), materialRow(transferFields, A));
    assert.equal(materialRow(staged, B), materialRow(transferFields, B), 'Repeated material ID never fans out');
    for (const key of ['ambient', 'lights', 'bodies', 'camera']) assert.equal(staged[key], transferFields[key], key + ' is retained exactly');
    assert.equal(materialRow(staged, A).shaderSource, portable.shaderSource);
    assert.deepEqual(materialRow(staged, A).suppliedOrder, ['explicit', 'signed']);
    assert.deepEqual(materialRow(staged, A).uniforms, [
      {name: 'signed', override: true, value: '-0', min: -1, max: 1, defaultValue: '0'},
      {name: 'explicit', override: true, value: '1', min: 0, max: 2, defaultValue: '1'},
      {name: 'omitted', override: false, value: '2', min: 0, max: 3, defaultValue: '2'},
    ]);
    const expectedFirst = structuredClone(transferSeed);
    Object.assign(bindingFor(expectedFirst, A).material, {shaderSource: portable.shaderSource, uniforms: portable.uniforms, revision: 8});
    assert.deepEqual(api.applyLightFields(transferSeed, staged), expectedFirst);
    assert.deepEqual(transferFields, api.readLightFields(transferSeed), 'Staging never mutates prior raw fields');
    assert.equal(api.serializeRenderNativeLightDocument(transferSeed), transferText);
    assert.equal(api.stageLightMaterialFields(transferSeed, transferFields, A, originalMaterial), transferFields,
      'Exact no-op retains the original form object');
    const invalidPortable = [
      ['unknown document key', {...portable, extra: true}],
      ['missing codec field', Object.fromEntries(Object.entries(portable).filter(([key]) => key !== 'profile'))],
      ['malformed source', {...portable, shaderSource: '@shader #broken {'}],
      ['unknown uniform key', {...portable, uniforms: {unknown: .5}}],
      ['out-of-range uniform', {...portable, uniforms: {signed: 2}}],
      ['nonnumeric uniform', {...portable, uniforms: {signed: '0'}}],
    ];
    for (const [reason, badPortable] of invalidPortable) {
      const beforeFields = structuredClone(transferFields), beforePortable = structuredClone(badPortable);
      assert.throws(() => api.stageLightMaterialFields(transferSeed, transferFields, A, badPortable), undefined, reason);
      assert.deepEqual(transferFields, beforeFields, reason + ': no partial source or uniform state');
      assert.deepEqual(badPortable, beforePortable, reason + ': no input mutation');
      assert.equal(api.serializeRenderNativeLightDocument(transferSeed), transferText);
    }
    for (const ceiling of ['material', 'scene']) {
      const maximum = structuredClone(transferSeed);
      if (ceiling === 'material') bindingFor(maximum, A).material.revision = 2147483647;
      else {maximum.revision = 2147483647; maximum.lights.revision = 2147483647;}
      const acceptedMaximum = api.prepareRenderNativeLightDocument(maximum).document, fieldsMaximum = api.readLightFields(acceptedMaximum);
      const retainedMaximum = structuredClone(fieldsMaximum);
      assert.throws(() => api.stageLightMaterialFields(acceptedMaximum, fieldsMaximum, A, portable), /revision|maximum/i, ceiling + ' ceiling');
      assert.deepEqual(fieldsMaximum, retainedMaximum);
      assert.equal(api.stageLightMaterialFields(acceptedMaximum, fieldsMaximum, A, bindingFor(acceptedMaximum, A).material), fieldsMaximum,
        ceiling + ': a no-op needs no next revision');
    }
    for (const unavailable of ['hidden', 'unbound']) {
      const unavailableRaw = structuredClone(transferSeed);
      unavailableRaw.surfaceMaterials = unavailableRaw.surfaceMaterials.filter(binding => binding.target.bodyId !== A);
      if (unavailable === 'hidden') unavailableRaw.display.visibleBodyIds = [B];
      const unavailableDocument = api.prepareRenderNativeLightDocument(unavailableRaw).document;
      const unavailableFields = api.readLightFields(unavailableDocument), retainedFields = structuredClone(unavailableFields);
      assert.throws(() => api.stageLightMaterialFields(unavailableDocument, unavailableFields, A, portable), undefined, unavailable);
      assert.deepEqual(unavailableFields, retainedFields);
    }
    for (const invalidTarget of ['ambiguous binding', 'foreign model pin']) {
      const invalidDocument = structuredClone(transferSeed);
      if (invalidTarget === 'ambiguous binding') invalidDocument.surfaceMaterials.push(structuredClone(bindingFor(invalidDocument, A)));
      else bindingFor(invalidDocument, A).target.modelId = 'foreign-model';
      const retainedDocument = structuredClone(invalidDocument);
      assert.throws(() => api.selectedLightMaterial(invalidDocument, A), undefined, invalidTarget);
      assert.deepEqual(invalidDocument, retainedDocument);
    }

    const attempts = [], transferControls = [], urlStart = createdUrls.length;
    let presentations = 0, readCount = 0;
    const countAttempt = label => {attempts.push(label); assert(attempts.length <= 16, kind + ': sixteen transport cap');};
    const mountTransfer = async document => {
      mounted = await api.mountLightWorkbenchFlow(container, document);
      const control = controls.at(-1), replace = control.viewer.replace;
      control.prepare = prepareBodyAppearance;
      control.viewer.replace = request => {presentations++; assert(presentations <= 6, kind + ': six presentation cap'); return replace(request);};
      transferControls.push(control); return control;
    };
    const session = () => flowControllers.at(-1).getSession();
    const snapshot = () => session().getSnapshot();
    const draft = () => api.readLightWorkbenchFlowDraft(container);
    const materialInput = () => {const input = container.querySelector('[aria-label="Open material file"]'); assert(input); return input;};
    const deliverMaterial = async value => {
      const input = materialInput(); Object.defineProperty(input, 'files', {value: value ? [value] : [], configurable: true});
      await act(async () => input.dispatchEvent(new dom.window.Event('change', {bubbles: true})));
      assert.equal(input.value, '', 'Same-file reselection remains possible');
    };
    const beginImport = async label => {countAttempt(label); await click('Import material…');};
    const importFile = async (label, value) => {await beginImport(label); await deliverMaterial(value);};
    const assertUnchanged = (before, rawDraft, label) => {
      assert.equal(snapshot(), before, label + ': exact actual session snapshot retained');
      assert.deepEqual(draft(), rawDraft, label + ': every raw visible field retained');
      assert.equal(presentations, 0, label + ': no Viewer work');
    };
    let transferControl = await mountTransfer(transferSeed);
    await selectBody(A);
    const initialSnapshot = snapshot(), initialDraft = draft();
    assert.equal(initialSnapshot.unsaved, true); assert.equal(initialSnapshot.canUndo, false); assert.equal(initialSnapshot.canRedo, false);

    await beginImport('cancel and empty selection'); // 1
    await act(async () => materialInput().dispatchEvent(new dom.window.Event('cancel', {bubbles: true})));
    await deliverMaterial(undefined); assertUnchanged(initialSnapshot, initialDraft, 'cancel');
    assert(!button('Import material…').disabled); assert(!button('Export accepted material').disabled);

    await beginImport('selection away and back'); // 2
    await selectBody(B); await selectBody(A);
    await deliverMaterial({...portableFile, arrayBuffer: async () => {readCount++; return new TextEncoder().encode(portableText).buffer;}});
    assert.equal(readCount, 0, 'Selection epoch refuses before read even after returning to the same body');
    assert.match(text(), /STALE_CANDIDATE/); assertUnchanged(initialSnapshot, initialDraft, 'selection epoch');

    await beginImport('changed corrective form'); // 3
    await edit('Intensity', '1e'); await edit('Body position X (mm)', '-'); await edit('Camera eye X', '');
    const correctiveDraft = draft();
    await deliverMaterial({...portableFile, arrayBuffer: async () => {readCount++; return new TextEncoder().encode(portableText).buffer;}});
    assert.equal(readCount, 0); assert.match(text(), /STALE_CANDIDATE/); assertUnchanged(initialSnapshot, correctiveDraft, 'corrective form');
    assert(button('Import material…').disabled); assert(!button('Export accepted material').disabled);
    await click('Discard');
    const cleanSnapshot = snapshot(), cleanDraft = draft();
    const refusedFiles = [
      ['reported size', {name: 'reported.material.json', size: api.RENDER_MATERIAL_LIMITS.fileBytes + 1,
        arrayBuffer: async () => {assert.fail('Reported oversize must refuse before reading');}}],
      ['actual size', {name: 'actual.material.json', size: 1, arrayBuffer: async () => new Uint8Array(api.RENDER_MATERIAL_LIMITS.fileBytes + 1).buffer}],
      ['invalid UTF-8', {name: 'utf8.material.json', size: 2, arrayBuffer: async () => new Uint8Array([0xc3, 0x28]).buffer}],
      ['read failure', {name: 'failure.material.json', size: 1, arrayBuffer: async () => {throw new Error('Controlled material read failure');}}],
      ['malformed JSON', file('{"format":', 'invalid.material.json')],
    ];
    for (const [label, refusedFile] of refusedFiles) { // 4..8
      await beginImport(label);
      const movedFocus = container.querySelector('[aria-label="Intensity"]'); movedFocus.focus();
      await deliverMaterial(refusedFile); assertUnchanged(cleanSnapshot, cleanDraft, label);
      assert.equal(document.activeElement, movedFocus, 'Failure must preserve intentionally moved focus');
      assert(container.querySelector('[role="alert"]'), label + ': actionable error');
      assert(!button('Import material…').disabled);
    }
    await importFile('valid atomic source and uniforms', portableFile); // 9
    assert.equal(snapshot(), cleanSnapshot, 'Import stages only private form state');
    assert.equal(presentations, 0); assert(button('Undo').disabled); assert(button('Redo').disabled);
    assert(!uniformInput('amount')); assert.equal(inputValue('Uniform signed'), '-0');
    assert.equal(overrideInput('explicit').checked, true); assert.equal(overrideInput('omitted').checked, false);
    assert.equal(inputValue('Uniform omitted'), '2'); assert.match(container.querySelector('[aria-label="Body material"]').textContent, /Range -1 to 1/);
    assert.equal(container.querySelector('[aria-label="Body material"]').querySelectorAll('textarea').length, 0, 'Import does not expose a shader editor');
    await selectBody(B); assertMaterialFields(materialRow(transferFields, B)); await selectBody(A);
    assert.equal(inputValue('Uniform signed'), '-0'); assert.equal(snapshot().accepted, cleanSnapshot.accepted);
    const stagedDraft = draft();
    countAttempt('export accepted while material is staged'); await click('Export accepted material'); // 10
    assert.equal(downloads.at(-1).name, 'shared-look.material.json');
    assert.equal(await downloads.at(-1).blob.text(), api.serializeRenderMaterialDocument(originalMaterial));
    assert.equal(snapshot(), cleanSnapshot); assert.deepEqual(draft(), stagedDraft); assert.equal(snapshot().unsaved, true);

    transferControl.refusal = new Error('Controlled portable material presentation refusal');
    await click('Apply'); // Presentation 1: failed delivery retains source plus uniforms and accepted authority.
    assert.equal(presentations, 1); assert.match(text(), /PRESENTATION_REFUSED/);
    assert.deepEqual(snapshot().accepted, transferSeed); assert.deepEqual(draft(), stagedDraft);
    assert.equal(snapshot().canUndo, false); assert.equal(snapshot().canRedo, false);
    transferControl.refusal = null; await click('Apply'); // Presentation 2: one accepted whole-scene transaction.
    expectedFirst.revision = transferSeed.revision + 1; expectedFirst.lights.revision = expectedFirst.revision;
    assert.deepEqual(snapshot().accepted, expectedFirst); assert.equal(snapshot().canUndo, true); assert.equal(snapshot().canRedo, false);
    assert.equal(bindingFor(snapshot().accepted, A).material.revision, 8);
    assert.deepEqual(bindingFor(snapshot().accepted, B), bindingFor(transferSeed, B));
    assert(Object.is(bindingFor(snapshot().accepted, A).material.uniforms.signed, -0));
    assert.equal(Object.hasOwn(bindingFor(snapshot().accepted, A).material.uniforms, 'omitted'), false);
    await edit('Intensity', '1e'); const exportSnapshot = snapshot(), exportDraft = draft(), downloadCount = downloads.length;
    countAttempt('accepted export transport failure'); downloadFailure = new Error('Controlled material anchor failure'); // 11
    try {await click('Export accepted material');} finally {downloadFailure = null;}
    assert.equal(downloads.length, downloadCount, 'A failed transport is not reported as a completed download');
    assert.equal(await latestBlob.text(), api.serializeRenderMaterialDocument(bindingFor(expectedFirst, A).material));
    assert.equal(snapshot(), exportSnapshot); assert.deepEqual(draft(), exportDraft); assert.equal(snapshot().unsaved, true);
    assert.equal(document.querySelectorAll('a[download]').length, 0, 'Failure removes its temporary link');
    await click('Discard');
    await click('Undo'); // Presentation 3.
    assert.deepEqual(snapshot().accepted.surfaceMaterials, transferSeed.surfaceMaterials);
    assert.equal(snapshot().canUndo, false); assert.equal(snapshot().canRedo, true, 'Import plus Apply created one history entry');
    await click('Redo'); // Presentation 4.
    assert.deepEqual(snapshot().accepted.surfaceMaterials, expectedFirst.surfaceMaterials);
    assert.equal(snapshot().accepted.revision, transferSeed.revision + 3);
    const noOpSnapshot = snapshot(), noOpDraft = draft();
    await importFile('exact no-op same-file reselection', portableFile); // 12: identical source and supplied values despite foreign metadata.
    assert.equal(snapshot(), noOpSnapshot); assert.deepEqual(draft(), noOpDraft);
    assert(button('Apply').disabled); assert.equal(presentations, 4);
    countAttempt('accepted scene Save'); await click('Save accepted'); // 13
    const savedText = await downloads.at(-1).blob.text(), savedDocument = api.parseRenderNativeLightDocument(savedText);
    assert.equal(downloads.at(-1).name, transferSeed.documentId + '.light-scene.json');
    assert.deepEqual(savedDocument, noOpSnapshot.accepted); assert.equal(snapshot().unsaved, false);
    assert.equal(unloadBlocked(), false);
    await mounted.dispose(); assert.equal(transferControl.disposed, 1);
    transferControl = await mountTransfer(transferSeed);
    countAttempt('fresh same-kind scene Open'); await click('Open'); await selectFile(file(savedText, 'saved.light-scene.json')); // 14, presentation 5.
    assert.deepEqual(snapshot().accepted, savedDocument); assert.equal(snapshot().canUndo, false); assert.equal(snapshot().canRedo, false);
    await selectBody(A); assert.equal(inputValue('Uniform signed'), '-0'); assert.equal(overrideInput('omitted').checked, false);
    await edit('Uniform signed', '.5'); await click('Apply'); // Presentation 6.
    const reedited = structuredClone(savedDocument); reedited.revision++; reedited.lights.revision++;
    Object.assign(bindingFor(reedited, A).material, {revision: 9, uniforms: {explicit: 1, signed: .5}});
    assert.deepEqual(snapshot().accepted, reedited); assert.equal(presentations, 6);

    for (const lifecycle of ['loss', 'disposal']) { // 15 and 16; no cancellation fiction or extra presentation.
      await mounted.dispose(); assert.equal(transferControl.disposed, 1);
      transferControl = await mountTransfer(transferSeed); await selectBody(A);
      const heldControl = transferControl, heldSnapshot = snapshot(), heldDraft = draft();
      let releaseHeld; const held = new Promise(resolve => {releaseHeld = resolve;});
      await importFile('held read after ' + lifecycle, {name: 'held.material.json', size: portableFile.size, arrayBuffer: () => held});
      for (const label of ['Import material…', 'Export accepted material', 'Open', 'Save accepted', 'New directional', 'New point', 'Help'])
        assert(button(label).disabled, 'Held material read fences ' + label);
      const chooserCount = fileChoosers, calls = heldControl.calls.length;
      await act(async () => {button('Import material…').click(); button('Open').click(); materialInput().dispatchEvent(new dom.window.Event('cancel', {bubbles: true}));});
      assert.equal(fileChoosers, chooserCount); assert(button('Open').disabled, 'Cancel cannot release an active read');
      if (lifecycle === 'loss') {
        heldControl.state = 'lost';
        await act(async () => {await new Promise(resolve => setTimeout(resolve, 350));});
        await act(async () => {releaseHeld(new TextEncoder().encode(portableText).buffer); await held;});
        assert.equal(snapshot().accepted, heldSnapshot.accepted); assert.deepEqual(draft(), heldDraft);
        assert.equal(snapshot().canUndo, false); assert.equal(snapshot().canRedo, false);
        assert(!button('Save accepted').disabled, 'Owning failed read releases busy after loss');
        assert(button('Import material…').disabled); assert(button('Export accepted material').disabled);
      } else {
        await mounted.dispose(); assert.equal(heldControl.disposed, 1);
        transferControl = await mountTransfer(savedDocument); const freshSnapshot = snapshot(), freshDraft = draft();
        await act(async () => {releaseHeld(new TextEncoder().encode(portableText).buffer); await held;});
        assert.equal(snapshot(), freshSnapshot); assert.deepEqual(draft(), freshDraft);
        assert(!button('Import material…').disabled); assert(!text().includes('held.material.json'));
      }
      assert.equal(heldControl.calls.length, calls); assert.equal(presentations, 6);
    }
    await mounted.dispose(); assert.equal(transferControl.disposed, 1);
    // Let each existing URL owner's real delayed revocation run; this is DOM transport cleanup only.
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 1050));});
    const ownedUrls = createdUrls.slice(urlStart);
    assert.equal(ownedUrls.length, 3, 'Two material export attempts plus one whole-scene Save');
    for (const url of ownedUrls) assert.equal(revokedUrls.filter(value => value === url).length, 1, 'Exactly one revocation for ' + url);
    assert.equal(document.querySelectorAll('a[download]').length, 0);
    assert.equal(attempts.length, 16); assert.equal(presentations, 6);
    assert(transferControls.every(control => control.disposed === 1));
    materialTransferFlow.push({kind, transportAttempts: attempts.length, attempts, presentations,
      pureInvalidPortableCases: invalidPortable.length, revisionCeilings: 2, noneditableTargets: 2, invalidQualifiedTargets: 2,
      capturedBinding: A, repeatedMaterialId: 'shared-look', originalMaterialRevision: 7, reeditedMaterialRevision: 9,
      ownedObjectUrls: ownedUrls.length, revokedObjectUrls: ownedUrls.length,
      instrumentation: 'read-only actual controller/session observation', proof: 'software only; no GPU pixels or physical-file persistence'});
  }

  // #1693: private helper calls, new Viewer replacements and Save/Open transports
  // have separate hard budgets. All older regression counts above remain unchanged.
  const rotationFlow = [];
  const axes = {x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1]};
  const scalarText = value => Object.is(value, -0) ? '-0' : String(value);
  const rotationRow = (fields, bodyId) => fields.bodies.find(body => body.bodyId === bodyId);
  const rotationNumbers = row => row.rotation.map(Number);
  const vectorClose = (actual, expected, label, tolerance = 2e-12) => {
    actual.forEach((value, index) => assert(Math.abs(value - expected[index]) <= tolerance,
      label + '[' + index + ']: ' + value + ' != ' + expected[index]));
  };
  // Independent geometric oracle: Rodrigues operates on vectors, not Hamilton products.
  // Normalization here interprets orientation for comparison; it never rewrites authored q.
  const rodrigues = (vector, axis, angle) => {
    const cosine = Math.cos(angle), sine = Math.sin(angle), dot = vector.reduce((sum, value, i) => sum + value * axis[i], 0);
    const cross = [axis[1] * vector[2] - axis[2] * vector[1], axis[2] * vector[0] - axis[0] * vector[2], axis[0] * vector[1] - axis[1] * vector[0]];
    return vector.map((value, i) => value * cosine + cross[i] * sine + axis[i] * dot * (1 - cosine));
  };
  const initialVector = (vector, quaternion) => {
    const length = Math.hypot(...quaternion.slice(0, 3));
    return length === 0 ? vector : rodrigues(vector, quaternion.slice(0, 3).map(value => value / length), 2 * Math.atan2(length, quaternion[3]));
  };
  const quaternionVector = (vector, quaternion) => {
    const [x, y, z, w] = quaternion, norm = quaternion.reduce((sum, value) => sum + value * value, 0);
    return [
      ((w*w+x*x-y*y-z*z)*vector[0] + 2*(x*y-z*w)*vector[1] + 2*(x*z+y*w)*vector[2]) / norm,
      (2*(x*y+z*w)*vector[0] + (w*w-x*x+y*y-z*z)*vector[1] + 2*(y*z-x*w)*vector[2]) / norm,
      (2*(x*z-y*w)*vector[0] + 2*(y*z+x*w)*vector[1] + (w*w-x*x-y*y+z*z)*vector[2]) / norm,
    ];
  };
  const assertRotationOracle = (before, after, axis, frame, degrees, label) => {
    for (const vector of [[1, 0, 0], [0, 1, 0], [.2, -.3, .8]]) {
      const delta = value => rodrigues(value, axes[axis], degrees * Math.PI / 180);
      const expected = frame === 'local' ? initialVector(delta(vector), before) : delta(initialVector(vector, before));
      vectorClose(quaternionVector(vector, after), expected, label);
    }
    assert(Math.abs(Math.hypot(...before) - Math.hypot(...after)) <= 8e-16, label + ': raw norm is retained');
  };
  const selectRotation = async (label, value) => {
    const element = container.querySelector(`[aria-label="${label}"]`); assert(element, label);
    await act(async () => {element.value = value; element.dispatchEvent(new dom.window.Event('change', {bubbles: true}));});
  };
  const visibleRotation = () => {
    const output = container.querySelector('[aria-label="Body rotation XYZW"]'); assert(output);
    assert.equal(output.tagName, 'OUTPUT'); return output.textContent.split(', ');
  };
  for (const kind of ['directional', 'point']) {
    const raw = structuredClone(api.createLightStudy(sourceText, kind));
    raw.nativeDocument.bodies.forEach(body => {body.name = 'Repeated Surface';});
    raw.nativeOptions.bodyIds = [B, A];
    const magnitude = 1 + 2e-10, sine = Math.sin(.37), cosine = Math.cos(.37);
    const importedQ = [1, 2, 3].map(value => -value * sine / Math.sqrt(14) * magnitude).concat(-cosine * magnitude);
    Object.assign(poseFor(raw, B), {rotationXYZW: importedQ, translationMM: [1050, -0, 80], scale: [1.2, .8, 1.1]});
    const rotationSeed = api.prepareRenderNativeLightDocument(raw).document;
    const rotationText = api.serializeRenderNativeLightDocument(rotationSeed), rotationFields = api.readLightFields(rotationSeed);
    const preparedRotation = api.prepareRenderNativeLightDocument(rotationSeed);
    assert.equal(new Set(preparedRotation.entries.map(entry => entry.binding.geometryId)).size, 1);
    assert.equal(new Set(preparedRotation.entries.map(entry => entry.binding.bodyId)).size, 2);
    assert.notEqual(Math.hypot(...importedQ), 1, 'Fixture exposes authored normalization');
    const cases = [], results = new Map();
    const stageCase = (label, base, fields, bodyId = B, axis = 'z', frame = 'local', degrees = '90') => {
      cases.push(label); assert(cases.length <= 36, kind + ': 36 actual helper invocation cap');
      const beforeFields = structuredClone(fields), beforeBase = api.serializeRenderNativeLightDocument(base);
      try {return api.stageLightBodyRotation(base, fields, bodyId, axis, frame, degrees);}
      finally {
        assert.deepEqual(fields, beforeFields, label + ': original corrective form is immutable');
        assert.equal(api.serializeRenderNativeLightDocument(base), beforeBase, label + ': accepted authorship is immutable');
      }
    };
    for (const axis of ['x', 'y', 'z']) for (const frame of ['local', 'world']) for (const degrees of [-90, 90]) {
      const label = [axis, frame, degrees].join('/');
      const staged = stageCase(label, rotationSeed, rotationFields, B, axis, frame, String(degrees));
      results.set(label, staged);
      const changed = rotationRow(staged, B), q = rotationNumbers(changed);
      assert.notEqual(staged, rotationFields); assert.notEqual(changed, rotationRow(rotationFields, B));
      assert.equal(rotationRow(staged, A), rotationRow(rotationFields, A), 'Repeated geometry IDs do not fan out');
      for (const key of ['position', 'scale']) assert.equal(changed[key], rotationRow(rotationFields, B)[key]);
      for (const key of ['ambient', 'camera', 'lights', 'materials']) assert.equal(staged[key], rotationFields[key]);
      assert(q[3] < 0, label + ': imported negative q is not sign-canonicalized');
      assert.notEqual(Math.hypot(...q), 1, label + ': tolerance is not normalized away');
      assertRotationOracle(importedQ, q, axis, frame, degrees, label);
      const admitted = api.applyLightFields(rotationSeed, staged);
      assert.deepEqual(poseFor(admitted, A), poseFor(rotationSeed, A));
      assert.deepEqual(poseFor(admitted, B), {...poseFor(rotationSeed, B), rotationXYZW: q});
      for (const key of ['nativeDocument', 'nativeOptions', 'surfaceMaterials', 'lights']) assert.deepEqual(admitted[key], rotationSeed[key]);
      assert.deepEqual({...admitted.display, poses: []}, {...rotationSeed.display, poses: []});
      prepareBodyAppearance(api.createRenderNativeLightRequest(admitted));
    }
    const signedRaw = structuredClone(rotationSeed);
    poseFor(signedRaw, B).rotationXYZW = [-0, -Math.sin(.2) * magnitude, -0, -Math.cos(.2) * magnitude];
    const signedSeed = api.prepareRenderNativeLightDocument(signedRaw).document, signedFields = api.readLightFields(signedSeed);
    const emptySeed = api.prepareRenderNativeLightDocument({...rotationSeed, display: {...rotationSeed.display, poses: []}}).document;
    const emptyFields = api.readLightFields(emptySeed);
    for (const degrees of ['+0', '-0', '+360', '-360']) {
      const signed = stageCase('raw identity ' + degrees, signedSeed, signedFields, B, 'y', 'world', degrees);
      assert.equal(signed, signedFields); assert.deepEqual(api.applyLightFields(signedSeed, signed), signedSeed);
      assert(Object.is(poseFor(signedSeed, B).rotationXYZW[0], -0)); assert(poseFor(signedSeed, B).rotationXYZW[3] < 0);
      const omitted = stageCase('omitted identity ' + degrees, emptySeed, emptyFields, B, 'x', 'local', degrees);
      assert.equal(omitted, emptyFields); assert.deepEqual(api.applyLightFields(emptySeed, omitted).display.poses, []);
    }
    const expandedFields = stageCase('empty pose expansion', emptySeed, emptyFields);
    const expandedRotation = api.applyLightFields(emptySeed, expandedFields);
    assert.deepEqual(expandedRotation.display.poses.map(pose => pose.bodyId), [B, A]);
    assert.deepEqual(poseFor(expandedRotation, A), {bodyId: A, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]});
    assertRotationOracle([0, 0, 0, 1], poseFor(expandedRotation, B).rotationXYZW, 'z', 'local', 90, 'empty pose expansion');
    const firstRotation = results.get('z/local/90');
    const repeated = stageCase('compose current draft', rotationSeed, firstRotation, B, 'x', 'world', '-90');
    const repeatedQ = rotationNumbers(rotationRow(repeated, B));
    assertRotationOracle(rotationNumbers(rotationRow(firstRotation, B)), repeatedQ, 'x', 'world', -90, 'compose current draft');
    assert.notDeepEqual(repeatedQ, rotationNumbers(rotationRow(results.get('x/world/-90'), B)), 'Second command never restarts from accepted q');
    const corrective = structuredClone(rotationFields);
    rotationRow(corrective, B).position = ['+1050.00', '-0', '80.000']; rotationRow(corrective, B).scale = ['1.200', '.8', '1.1'];
    rotationRow(corrective, A).position[0] = '1e'; corrective.camera.eye[0] = ''; corrective.lights[0].intensity = 'NaN';
    const corrected = stageCase('retain unrelated corrective fields', rotationSeed, corrective);
    assert.equal(rotationRow(corrected, A), rotationRow(corrective, A));
    for (const key of ['camera', 'lights', 'materials']) assert.equal(corrected[key], corrective[key]);
    assert.equal(rotationRow(corrected, B).position, rotationRow(corrective, B).position);
    assert.equal(rotationRow(corrected, B).scale, rotationRow(corrective, B).scale);
    assert.throws(() => api.applyLightFields(rotationSeed, corrected));
    const unsafeRaw = structuredClone(rotationSeed);
    poseFor(unsafeRaw, B).rotationXYZW = [0, 0, -Math.sin(Math.PI / 8) * magnitude, Math.cos(Math.PI / 8) * magnitude];
    const unsafeSeed = api.prepareRenderNativeLightDocument(unsafeRaw).document;
    const invalidRotations = [
      ...['', 'NaN', 'Infinity', '360.01', '-360.01'].map(degrees => ({label: 'invalid degrees ' + JSON.stringify(degrees), degrees})),
      {label: 'wrong axis', axis: 'w'}, {label: 'wrong frame', frame: 'camera'}, {label: 'geometry is not original body', bodyId: 'reference_panel'},
      {label: 'unsafe current component', mutate: fields => {rotationRow(fields, B).rotation = ['0', '0', '0', '1.1'];}},
      {label: 'unsafe current norm', mutate: fields => {rotationRow(fields, B).rotation = ['.1', '0', '0', '1'];}},
      {label: 'unsafe composed component', base: unsafeSeed, degrees: '45'},
      {label: 'invalid selected scale', mutate: fields => {rotationRow(fields, B).scale[0] = '0';}},
      {label: 'actual selected-pose provider underflow', bodyId: A, axis: 'x', mutate: fields => {rotationRow(fields, A).position[0] = '1e-50';}},
    ];
    for (const test of invalidRotations) {
      const base = test.base ?? rotationSeed, invalid = structuredClone(api.readLightFields(base)); test.mutate?.(invalid);
      let refusal;
      try {stageCase(test.label, base, invalid, test.bodyId ?? B, test.axis ?? 'z', test.frame ?? 'local', test.degrees ?? '90');}
      catch (error) {if (error instanceof assert.AssertionError) throw error; refusal = error;}
      assert(refusal, test.label + ': actual helper must refuse');
      if (test.label.includes('provider underflow')) assert.match(JSON.stringify(errorTree(refusal)), /underflow/i);
    }
    assert.equal(cases.length, 36); assert.equal(new Set(cases).size, 36);
    assert.equal(api.serializeRenderNativeLightDocument(rotationSeed), rotationText);

    let presentations = 0, transports = 0;
    const rotationControls = [];
    const trackRotation = control => {
      control.prepare = prepareBodyAppearance;
      const replace = control.viewer.replace;
      control.viewer.replace = request => {presentations++; assert(presentations <= 6, kind + ': six new rotation presentations'); return replace(request);};
      rotationControls.push(control); return control;
    };
    const mountRotation = async document => {mounted = await api.mountLightWorkbenchFlow(container, document); return trackRotation(controls.at(-1));};
    const rotationSnapshot = () => flowControllers.at(-1).getSession().getSnapshot();
    const rotationDraft = () => api.readLightWorkbenchFlowDraft(container);
    const saveRotation = async () => {transports++; assert(transports <= 4); return saveText();};
    const assertRotationBlocked = reason => {
      for (const label of ['Stage rotation', 'Rotate −90°', 'Rotate +90°']) assert(button(label).disabled, reason + ': ' + label);
      for (const label of ['Rotation axis', 'Rotation frame', 'Rotate by (degrees)']) assert(container.querySelector(`[aria-label="${label}"]`).disabled, reason + ': ' + label);
    };
    let rotationControl = await mountRotation(rotationSeed);
    const initialRotationSnapshot = rotationSnapshot();
    assert.equal(inputValue('Rotation axis'), 'z'); assert.equal(inputValue('Rotation frame'), 'local'); assert.equal(inputValue('Rotate by (degrees)'), '90');
    assert.deepEqual(visibleRotation(), rotationRow(rotationFields, B).rotation);
    const advanced = [...container.querySelectorAll('details')].find(node => node.textContent.includes('Advanced quaternion'));
    assert(advanced); assert.equal(advanced.open, false);
    assert.equal(advanced.querySelectorAll('input, textarea, select, [contenteditable="true"]').length, 0, 'Advanced quaternion is not an authoring surface');
    await selectRotation('Rotation axis', 'x'); await selectRotation('Rotation frame', 'world'); await edit('Rotate by (degrees)', '1e');
    assert(button('Apply').disabled, 'Unfinished command preference is not authored dirty state');
    await selectBody(A); assert.equal(inputValue('Rotate by (degrees)'), '90'); await selectBody(B);
    assert.equal(inputValue('Rotate by (degrees)'), '1e'); assert.equal(inputValue('Rotation axis'), 'x'); assert.equal(inputValue('Rotation frame'), 'world');
    await click('Stage rotation'); assert.equal(inputValue('Rotate by (degrees)'), '1e'); assert.deepEqual(visibleRotation(), rotationRow(rotationFields, B).rotation);
    assert.equal(rotationSnapshot(), initialRotationSnapshot); assert.equal(presentations, 0);
    await edit('Rotate by (degrees)', '90');
    const oldStage = button('Stage rotation');
    await act(async () => {button('Edit body ' + A).click(); oldStage.click();});
    assert.deepEqual(visibleRotation(), rotationRow(rotationFields, A).rotation, 'Old selection event cannot rotate newly selected body');
    await selectBody(B); assert.deepEqual(visibleRotation(), rotationRow(rotationFields, B).rotation, 'Old selection event cannot rotate former body');
    await selectRotation('Rotation axis', 'z'); await selectRotation('Rotation frame', 'local');
    for (const degrees of ['+0', '-0', '+360', '-360']) {
      await edit('Rotate by (degrees)', degrees); await click('Stage rotation');
      assert.equal(inputValue('Rotate by (degrees)'), degrees); assert.deepEqual(visibleRotation(), rotationRow(rotationFields, B).rotation);
      assert.equal(rotationSnapshot(), initialRotationSnapshot); assert(button('Apply').disabled); assert.equal(presentations, 0);
    }
    await click('Help'); assertRotationBlocked('Help'); await click('Help');
    const rotationCanvas = container.querySelector('canvas');
    await pointer(rotationCanvas, 'pointerdown', 140, 125); assertRotationBlocked('active navigation');
    await pointer(rotationCanvas, 'pointermove', 148, 130); assertRotationBlocked('queued navigation');
    await pointer(rotationCanvas, 'pointercancel', 148, 130); await flushNavigation(); assert.equal(presentations, 0);
    await edit('Rotate by (degrees)', '90'); await edit('Body position X (mm)', '1e'); await click('Stage rotation');
    assert.equal(inputValue('Body position X (mm)'), '1e'); assert.equal(inputValue('Rotate by (degrees)'), '90');
    assert.deepEqual(visibleRotation(), rotationRow(rotationFields, B).rotation); assert.equal(rotationSnapshot(), initialRotationSnapshot);
    await edit('Rotate by (degrees)', '-0'); await click('Stage rotation');
    assert.equal(inputValue('Body position X (mm)'), '1e', 'Identity command does not consume invalid selected corrective text');
    assert.deepEqual(visibleRotation(), rotationRow(rotationFields, B).rotation); assert.equal(rotationSnapshot(), initialRotationSnapshot);
    await edit('Rotate by (degrees)', '90');
    await edit('Body position X (mm)', '+1050.00'); await edit('Body scale X', '1.200');
    await selectBody(A); await edit('Body position X (mm)', '1e'); await selectBody(B);
    await edit('Camera eye X', ''); await edit('Intensity', 'NaN'); await click('Stage rotation');
    assert.deepEqual(visibleRotation(), rotationRow(firstRotation, B).rotation);
    assert.equal(inputValue('Body position X (mm)'), '+1050.00'); assert.equal(inputValue('Body scale X'), '1.200');
    assert.equal(inputValue('Camera eye X'), ''); assert.equal(inputValue('Intensity'), 'NaN');
    await click('Apply'); assert.equal(presentations, 0, 'Unrelated invalid fields still block the whole scene');
    assert.deepEqual(visibleRotation(), rotationRow(firstRotation, B).rotation);
    await selectBody(A); assert.equal(inputValue('Body position X (mm)'), '1e');
    await edit('Body position X (mm)', rotationRow(rotationFields, A).position[0]); await selectBody(B);
    await edit('Camera eye X', '2'); await edit('Intensity', '.4');
    await selectRotation('Rotation axis', 'x'); await selectRotation('Rotation frame', 'world'); await click('Rotate −90°');
    assert.deepEqual(visibleRotation(), rotationRow(repeated, B).rotation, 'Shortcut composes onto the staged quaternion');
    const combinedRotationFields = structuredClone(repeated); combinedRotationFields.camera.eye[0] = '2'; combinedRotationFields.lights[0].intensity = '.4';
    const expectedRotation = structuredClone(api.applyLightFields(rotationSeed, combinedRotationFields));
    const stagedRotationDraft = rotationDraft();
    assert.equal(await saveRotation(), rotationText, 'Transport 1: Save while staged is accepted-only');
    assert.deepEqual(rotationDraft(), stagedRotationDraft); assert.equal(rotationSnapshot().canUndo, false);
    let releaseRotation; rotationControl.wait = new Promise(resolve => {releaseRotation = resolve;});
    rotationControl.refusal = new Error('Controlled pending degree-rotation refusal');
    await act(async () => button('Apply').click()); // Presentation 1.
    assertRotationBlocked('pending Apply'); assert.equal(presentations, 1);
    assert(button('Open').disabled); assert(button('Save accepted').disabled);
    await act(async () => {button('Stage rotation').click(); button('Rotate +90°').click(); releaseRotation(); await rotationControl.wait;});
    rotationControl.wait = null;
    assert.deepEqual(rotationDraft(), stagedRotationDraft); assert.deepEqual(rotationSnapshot().accepted, rotationSeed);
    assert.equal(rotationSnapshot().canUndo, false); assert.equal(rotationSnapshot().canRedo, false);
    assert.match(text(), /PRESENTATION_REFUSED/);
    rotationControl.refusal = null; await click('Apply'); // Presentation 2.
    expectedRotation.revision++; expectedRotation.lights.revision++;
    assert.deepEqual(rotationSnapshot().accepted, expectedRotation);
    assert.equal(rotationSnapshot().canUndo, true); assert.equal(rotationSnapshot().canRedo, false);
    assert.deepEqual(rotationControl.calls.at(-1), api.createRenderNativeLightRequest(expectedRotation));
    await click('Undo'); // Presentation 3.
    assert.deepEqual(rotationSnapshot().accepted.display, rotationSeed.display); assert.deepEqual(rotationSnapshot().accepted.lights.lights, rotationSeed.lights.lights);
    assert.equal(rotationSnapshot().canUndo, false, 'Both rotations plus camera/light changes create one history entry');
    assert.equal(rotationSnapshot().canRedo, true); assert.deepEqual(visibleRotation(), rotationRow(rotationFields, B).rotation);
    await click('Redo'); // Presentation 4.
    assert.deepEqual(rotationSnapshot().accepted.display, expectedRotation.display); assert.equal(rotationSnapshot().canRedo, false);
    assert.deepEqual(visibleRotation(), rotationRow(repeated, B).rotation);
    const savedRotationText = await saveRotation(), savedRotation = api.parseRenderNativeLightDocument(savedRotationText); // Transport 2.
    assert.deepEqual(savedRotation, rotationSnapshot().accepted); assert.equal(rotationSnapshot().unsaved, false);
    assert.deepEqual(poseFor(savedRotation, B).rotationXYZW, repeatedQ);
    await mounted.dispose(); assert.equal(rotationControl.disposed, 1);
    rotationControl = await mountRotation(rotationSeed);
    transports++; assert.equal(transports, 3); await click('Open'); assertRotationBlocked('Open chooser');
    await selectFile(file(savedRotationText, 'rotated.light-scene.json')); // Transport 3, presentation 5.
    assert.deepEqual(rotationSnapshot().accepted, savedRotation); assert.equal(rotationSnapshot().canUndo, false); assert.equal(rotationSnapshot().canRedo, false);
    assert.deepEqual(visibleRotation(), rotationRow(repeated, B).rotation);
    await selectBody(A); await selectRotation('Rotation axis', 'y'); await selectRotation('Rotation frame', 'local'); await click('Rotate +90°');
    const secondQ = [0, Math.sin(Math.PI / 4), 0, Math.cos(Math.PI / 4)];
    assert.deepEqual(visibleRotation(), secondQ.map(scalarText));
    await click('Apply'); // Presentation 6.
    const finalRotationText = await saveRotation(), finalRotation = api.parseRenderNativeLightDocument(finalRotationText); // Transport 4.
    assert.deepEqual(finalRotation, rotationSnapshot().accepted); assert.equal(finalRotation.revision, savedRotation.revision + 1);
    assert.deepEqual(poseFor(finalRotation, B), poseFor(savedRotation, B));
    assert.deepEqual(poseFor(finalRotation, A), {...poseFor(savedRotation, A), rotationXYZW: secondQ});
    for (const key of ['nativeDocument', 'nativeOptions', 'surfaceMaterials']) assert.deepEqual(finalRotation[key], rotationSeed[key]);
    assert.deepEqual(finalRotation.display.camera, savedRotation.display.camera); assert.deepEqual(finalRotation.lights.lights, savedRotation.lights.lights);
    assert.equal(presentations, 6); assert.equal(transports, 4);
    const beforeLoss = rotationSnapshot(), beforeLossDraft = rotationDraft(); rotationControl.state = 'lost';
    await act(async () => {await new Promise(resolve => setTimeout(resolve, 350));}); assertRotationBlocked('lost presentation');
    assert.equal(rotationSnapshot(), beforeLoss); assert.deepEqual(rotationDraft(), beforeLossDraft);
    const detachedStage = button('Stage rotation'); await mounted.dispose(); assert.equal(rotationControl.disposed, 1);
    // A stale actual startup completes after disposal; no extra replacement/transport is invented.
    let releaseStartup; startupGate = new Promise(resolve => {releaseStartup = resolve;});
    await mountRotation(rotationSeed); const staleStartup = rotationControls.at(-1);
    await mounted.dispose(); startupGate = null;
    rotationControl = await mountRotation(finalRotation); const freshSnapshot = rotationSnapshot(), freshDraft = rotationDraft();
    await act(async () => {detachedStage.click(); releaseStartup(); await Promise.resolve();});
    assert.equal(staleStartup.disposed, 1); assert.equal(rotationSnapshot(), freshSnapshot); assert.deepEqual(rotationDraft(), freshDraft);
    assert.equal(rotationSnapshot().canUndo, false); assert.equal(rotationSnapshot().canRedo, false);
    assert.equal(presentations, 6); assert.equal(transports, 4); assert.equal(navigationDom.pendingFrames(), 0); assert.equal(navigationDom.captures(), 0);
    await mounted.dispose(); assert(rotationControls.every(control => control.disposed === 1));
    rotationFlow.push({kind, helperCases: cases.length, cases, presentations, saveOpenTransports: transports,
      oracle: 'independent Rodrigues/vector comparison; raw quaternion norm/sign checked separately',
      historyEntries: 1, staleStartupCompletions: 1, instrumentation: 'read-only actual controller/session',
      proof: 'software only; no GPU pixels, native picker or physical #1573 acceptance'});
  }

  // #1734: 32 direct real derivations, <=12 replacements and four transports per kind.
  const bodyCommandFlow = [];
  for (const kind of ['directional', 'point']) {
    const raw = structuredClone(api.createLightStudy(sourceText, kind));
    raw.surfaceMaterials[1].material.documentId = raw.surfaceMaterials[0].material.documentId;
    raw.surfaceMaterials[1].material.uniforms.amount = -0;
    poseFor(raw, B).rotationXYZW = [-0, 0, 0, -1];
    const commandSeed = api.prepareRenderNativeLightDocument(raw).document;
    const seedText = api.serializeRenderNativeLightDocument(commandSeed);
    const cases = [];
    const bodyCase = (label, document, bodyId, action, reserved = []) => {
      cases.push(label); assert(cases.length <= 32, kind + ': direct body helper ceiling');
      const before = structuredClone(document);
      try {return api.deriveLightBodyCommand(document, bodyId, action, reserved);}
      finally {assert.deepEqual(document, before, label + ': caller document immutable');}
    };
    const refuseBody = (...args) => {
      let error; try {bodyCase(...args);} catch (cause) {if (cause instanceof assert.AssertionError) throw cause; error = cause;}
      assert(error, args[0] + ': real derivation must refuse'); return error;
    };
    const copyA = bodyCase('duplicate A', commandSeed, A, 'duplicate');
    const copyB = bodyCase('duplicate B repeated material/geometry IDs', commandSeed, B, 'duplicate');
    for (const [result, originalId] of [[copyA, A], [copyB, B]]) {
      const oldBody = commandSeed.nativeDocument.bodies.find(item => item.id === originalId);
      const newBody = result.document.nativeDocument.bodies.find(item => item.id === result.selectedBodyId);
      assert.equal(result.generatedIds.length, 3); assert.equal(new Set(result.generatedIds).size, 3);
      assert.equal(newBody.geometryId, oldBody.geometryId); assert.notEqual(newBody.assetId, oldBody.assetId);
      const oldAsset = commandSeed.nativeDocument.assets.find(item => item.id === oldBody.assetId);
      const newAsset = result.document.nativeDocument.assets.find(item => item.id === newBody.assetId);
      assert.deepEqual(newAsset, {...oldAsset, id: newBody.assetId, revision: 0});
      assert.deepEqual(result.document.nativeDocument.assets.slice(0, 2), commandSeed.nativeDocument.assets);
      assert.deepEqual(poseFor(result.document, result.selectedBodyId), {...poseFor(commandSeed, originalId), bodyId: result.selectedBodyId});
      const oldMaterial = commandSeed.surfaceMaterials.find(item => item.target.bodyId === originalId).material;
      const newMaterial = result.document.surfaceMaterials.find(item => item.target.bodyId === result.selectedBodyId).material;
      assert.deepEqual(newMaterial, {...oldMaterial, documentId: result.generatedIds[2], revision: 0});
      assert.deepEqual(result.document.lights, commandSeed.lights); assert.deepEqual(result.document.display.camera, commandSeed.display.camera);
      assert.equal(result.document.revision, commandSeed.revision); assert.equal(result.document.nativeDocument.revision, commandSeed.nativeDocument.revision + 1);
      const prepared = api.prepareRenderNativeLightDocument(result.document);
      for (const binding of result.document.surfaceMaterials) {
        const actual = prepared.entries.find(entry => entry.binding.bodyId === binding.target.bodyId).binding;
        for (const key of Object.keys(binding.target)) assert.equal(binding.target[key], actual[key], key);
      }
      prepareBodyAppearance(api.createRenderNativeLightRequest(result.document));
    }
    const empty = api.prepareRenderNativeLightDocument({...commandSeed, display: {...commandSeed.display, poses: []}}).document;
    assert.deepEqual(bodyCase('duplicate omitted poses', empty, B, 'duplicate').document.display.poses, []);
    const removedA = bodyCase('remove A orphan asset', commandSeed, A, 'remove');
    assert.deepEqual(removedA.document.nativeDocument.assets, [commandSeed.nativeDocument.assets[1]]);
    assert.equal(removedA.selectedBodyId, B);
    const reorderedCopy = api.prepareRenderNativeLightDocument({...copyB.document,
      surfaceMaterials: [...copyB.document.surfaceMaterials].reverse()}).document;
    const removedCopy = bodyCase('remove independent copy with reversed material order', reorderedCopy, copyB.selectedBodyId, 'remove');
    assert.equal(removedCopy.selectedBodyId, A, 'select the first surviving Inspector row, not the first material');
    assert.deepEqual(removedCopy.document.surfaceMaterials.map(binding => binding.target.bodyId), [B, A]);
    assert.deepEqual(removedCopy.document.nativeDocument.assets, commandSeed.nativeDocument.assets);
    assert.deepEqual(removedCopy.document.display, commandSeed.display);
    const sourceWithSurfaces = ids => {
      const surface = sourceText.match(/ {2}@surface #reference_panel \{[\s\S]*?\n {2}\}/)?.[0];
      assert(surface, 'fixture contains its original Surface declaration');
      return sourceText.replace(/\}\s*$/, ids.map(id => surface.replace('#reference_panel', '#' + id)).join('\n') + '\n}\n');
    };
    const shared = structuredClone(commandSeed), sharedAsset = shared.nativeDocument.assets[0];
    sharedAsset.source = sourceWithSurfaces(['shared_panel']);
    shared.nativeDocument.assets = [sharedAsset];
    Object.assign(shared.nativeDocument.bodies[1], {assetId: sharedAsset.id, geometryId: 'shared_panel'});
    Object.assign(shared.surfaceMaterials[1].target, {assetId: sharedAsset.id, assetRevision: sharedAsset.revision, geometryId: 'shared_panel'});
    const sharedResult = bodyCase('remove shared source body', api.prepareRenderNativeLightDocument(shared).document, A, 'remove');
    assert.deepEqual(sharedResult.document.nativeDocument.assets, [sharedAsset]);
    const sibling = structuredClone(commandSeed);
    sibling.nativeDocument.assets[0].source = sourceWithSurfaces(['sibling_panel']);
    sibling.nativeDocument.bodies.push({...sibling.nativeDocument.bodies[0], id: 'hidden_sibling', geometryId: 'sibling_panel'});
    const siblingResult = bodyCase('unselected sibling retains asset', api.prepareRenderNativeLightDocument(sibling).document, A, 'remove');
    assert.deepEqual(siblingResult.document.nativeDocument.assets, sibling.nativeDocument.assets);
    assert(siblingResult.document.nativeDocument.bodies.some(item => item.id === 'hidden_sibling'));
    assert.deepEqual(bodyCase('remove omitted poses', empty, A, 'remove').document.display.poses, []);
    const reservedCopy = bodyCase('reserved IDs survive undo', commandSeed, B, 'duplicate', copyB.reservedIds);
    assert(reservedCopy.generatedIds.every(id => !copyB.generatedIds.includes(id)));
    const baselineIds = [...api.lightBodyReservedIds(commandSeed)];
    const reservations = length => baselineIds.concat(Array.from({length: length - baselineIds.length}, (_, i) => 'reserved_' + i));
    assert.equal(bodyCase('exact 2048 union', commandSeed, B, 'duplicate', reservations(2045)).reservedIds.length, 2048);
    assert.equal(bodyCase('remove at reservation limit', commandSeed, B, 'remove', reservations(2048)).reservedIds.length, 2048);
    const full = bodyCase('four-body capacity reached', copyB.document, A, 'duplicate', copyB.reservedIds);
    refuseBody('fifth body refused', full.document, A, 'duplicate');
    const manyBodies = structuredClone(commandSeed);
    const extraSurfaces = ['unselected_panel_0', 'unselected_panel_1', 'unselected_panel_2'];
    // Four admitted sources, each with four distinct Surfaces: both inventory caps are reached.
    for (let i = 2; i < 4; i++) manyBodies.nativeDocument.assets.push({...manyBodies.nativeDocument.assets[0], id: 'unselected_asset_' + i});
    for (const [index, asset] of manyBodies.nativeDocument.assets.entries()) {
      asset.source = sourceWithSurfaces(extraSurfaces);
      const geometries = index < 2 ? extraSurfaces : ['reference_panel', ...extraSurfaces];
      for (const [j, geometryId] of geometries.entries()) manyBodies.nativeDocument.bodies.push({...manyBodies.nativeDocument.bodies[0],
        id: 'unselected_' + index + '_' + j, assetId: asset.id, geometryId});
    }
    assert.equal(manyBodies.nativeDocument.bodies.length, 16);
    refuseBody('sixteen bodies and four assets refuse duplicate', api.prepareRenderNativeLightDocument(manyBodies).document, B, 'duplicate');
    const maximum = structuredClone(commandSeed); maximum.nativeDocument.revision = 2147483647;
    maximum.surfaceMaterials.forEach(item => {item.target.documentRevision = maximum.nativeDocument.revision;});
    const maximumDocument = api.prepareRenderNativeLightDocument(maximum).document;
    refuseBody('native revision max duplicate', maximumDocument, B, 'duplicate');
    refuseBody('native revision max remove', maximumDocument, B, 'remove');
    refuseBody('unknown duplicate', commandSeed, 'foreign_body', 'duplicate');
    refuseBody('unknown remove', commandSeed, 'foreign_body', 'remove');
    const hidden = api.prepareRenderNativeLightDocument({...commandSeed,
      display: {...commandSeed.display, visibleBodyIds: [B]}, surfaceMaterials: commandSeed.surfaceMaterials.filter(item => item.target.bodyId === B)}).document;
    refuseBody('hidden duplicate', hidden, A, 'duplicate'); refuseBody('hidden remove', hidden, A, 'remove');
    const unbound = api.prepareRenderNativeLightDocument({...commandSeed, surfaceMaterials: commandSeed.surfaceMaterials.filter(item => item.target.bodyId === B)}).document;
    refuseBody('unbound duplicate', unbound, A, 'duplicate'); refuseBody('unbound remove', unbound, A, 'remove');
    refuseBody('last editable body', removedA.document, B, 'remove');
    refuseBody('unknown command', commandSeed, B, 'hide');
    refuseBody('non-array reservations', commandSeed, B, 'duplicate', null);
    refuseBody('sparse reservations', commandSeed, B, 'duplicate', new Array(1));
    let reservationReads = 0; const accessor = [];
    Object.defineProperty(accessor, '0', {enumerable: true, get() {reservationReads++; return 'forbidden';}});
    refuseBody('accessor reservations', commandSeed, B, 'duplicate', accessor); assert.equal(reservationReads, 0);
    const symbolic = []; symbolic[Symbol('extra')] = 'x';
    refuseBody('symbol reservations', commandSeed, B, 'duplicate', symbolic);
    refuseBody('invalid reservation ID', commandSeed, B, 'duplicate', ['invalid id']);
    refuseBody('oversize reservations', commandSeed, B, 'duplicate', reservations(2049));
    refuseBody('resulting reservation union overflow', commandSeed, B, 'duplicate', reservations(2046));
    const unsafe = structuredClone(commandSeed); poseFor(unsafe, A).translationMM[0] = 1e-50;
    const unsafeError = refuseBody('actual posed Float32 admission', api.prepareRenderNativeLightDocument(unsafe).document, B, 'duplicate');
    assert.match(JSON.stringify(errorTree(unsafeError)), /underflow/i);
    assert.equal(cases.length, 32); assert.equal(new Set(cases).size, 32); assert.equal(api.serializeRenderNativeLightDocument(commandSeed), seedText);

    let presentations = 0, transports = 0; const commandControls = [];
    const trackCommands = control => {
      control.prepare = prepareBodyAppearance; const replace = control.viewer.replace;
      control.viewer.replace = request => {presentations++; assert(presentations <= 12, kind + ': body command presentation ceiling'); return replace(request);};
      commandControls.push(control); return control;
    };
    const mountCommands = async value => {mounted = await api.mountLightWorkbenchFlow(container, value); return trackCommands(controls.at(-1));};
    const commandSession = () => flowControllers.at(-1).getSession(), commandSnapshot = () => commandSession().getSnapshot();
    const commandDraft = () => api.readLightWorkbenchFlowDraft(container);
    const saveCommands = async () => {transports++; assert(transports <= 4); return saveText();};
    const selectedCommandBody = () => [...container.querySelectorAll('[aria-label^="Edit body "]')].find(node => node.getAttribute('aria-pressed') === 'true')?.getAttribute('aria-label').slice(10);
    const maxOuter = api.prepareRenderNativeLightDocument({...commandSeed, revision: 2147483647, lights: {...commandSeed.lights, revision: 2147483647}}).document;
    let control = await mountCommands(maxOuter);
    assert(button('Duplicate body').disabled); assert(button('Remove body').disabled); assert(button('Add Surface…').disabled); assert.equal(presentations, 0); await mounted.dispose();
    control = await mountCommands(hidden); assert(button('Duplicate body').disabled); assert(button('Remove body').disabled);
    await selectBody(B); assert(button('Remove body').disabled, 'Last editable visible material body');
    assert.equal(presentations, 0); await mounted.dispose();
    control = await mountCommands(commandSeed); await selectBody(B);
    const clean = commandSnapshot(); await edit('Body position X (mm)', '1e');
    assert(button('Duplicate body').disabled); assert(button('Remove body').disabled);
    const corrective = commandDraft(); await act(async () => {button('Duplicate body').click(); button('Remove body').click();});
    assert.deepEqual(commandDraft(), corrective); assert.equal(commandSnapshot(), clean); assert.equal(presentations, 0);
    await click('Discard'); await selectBody(B);
    await click('Help'); assert(button('Duplicate body').disabled); await click('Help');
    const staleDuplicate = button('Duplicate body'); await act(async () => {button('Edit body ' + A).click(); staleDuplicate.click();});
    assert.equal(presentations, 0); assert.equal(commandSnapshot().accepted, clean.accepted); await selectBody(B);
    assert.equal(await saveCommands(), seedText); // Transport 1: known accepted baseline.
    const beforeRefusal = commandSnapshot(), beforeRefusalDraft = commandDraft();
    let release; control.wait = new Promise(resolve => {release = resolve;}); control.refusal = new Error('Controlled body duplicate refusal');
    await act(async () => {button('Duplicate body').click(); button('Edit body ' + A).click();}); // Replacement 1.
    assert.equal(selectedCommandBody(), B, 'Pending command fences same-act competing row selection');
    assert(button('Remove body').disabled); assert(button('Open').disabled); assert(button('Apply').disabled);
    await act(async () => {release(); await control.wait;}); control.wait = null; control.refusal = null;
    assert.equal(commandSnapshot().accepted, beforeRefusal.accepted); assert.equal(commandSnapshot().canUndo, beforeRefusal.canUndo);
    assert.equal(commandSnapshot().canRedo, beforeRefusal.canRedo); assert.equal(commandSnapshot().unsaved, beforeRefusal.unsaved);
    assert.equal(commandSnapshot().dirty, false); assert.deepEqual(commandDraft(), beforeRefusalDraft); assert.equal(selectedCommandBody(), B);
    assert(!container.querySelector('[aria-label="Body command recovery"]'));
    await click('Duplicate body'); // 2.
    const firstCopy = selectedCommandBody(), firstCopyDoc = commandSnapshot().accepted;
    assert.notEqual(firstCopy, B); assert.equal(firstCopyDoc.nativeDocument.revision, commandSeed.nativeDocument.revision + 1);
    assert.equal(firstCopyDoc.revision, commandSeed.revision + 1); assert.equal(commandSnapshot().canUndo, true);
    assert.deepEqual(poseFor(firstCopyDoc, firstCopy), {...poseFor(commandSeed, B), bodyId: firstCopy});
    assert.deepEqual(commandSnapshot().viewportCamera, beforeRefusal.viewportCamera);
    await click('Undo'); // 3: generated IDs remain reserved.
    assert.equal(commandSnapshot().canUndo, false); assert.equal(commandSnapshot().canRedo, true);
    control.state = 'lost'; await act(async () => {await new Promise(resolve => setTimeout(resolve, 350));});
    await click('Remount accepted scene'); assert.equal(control.disposed, 1); control = trackCommands(controls.at(-1));
    assert.equal(commandSnapshot().canUndo, false); assert.equal(commandSnapshot().canRedo, false); await selectBody(B);
    await click('Duplicate body'); // 4: a fresh branch must not reuse the removed copy identity.
    const secondCopy = selectedCommandBody(); assert.notEqual(secondCopy, firstCopy); assert.equal(commandSnapshot().canRedo, false);
    const savedText = await saveCommands(), saved = api.parseRenderNativeLightDocument(savedText); // Transport 2.
    const originalMaterial = saved.surfaceMaterials.find(item => item.target.bodyId === B).material;
    const copiedMaterial = saved.surfaceMaterials.find(item => item.target.bodyId === secondCopy).material;
    assert.notEqual(originalMaterial.documentId, copiedMaterial.documentId); assert(Object.is(copiedMaterial.uniforms.amount, -0));
    await click('Remove body'); // 5.
    assert(!commandSnapshot().accepted.nativeDocument.bodies.some(item => item.id === secondCopy)); assert.notEqual(selectedCommandBody(), secondCopy);
    await click('Undo'); // 6.
    assert(commandSnapshot().accepted.nativeDocument.bodies.some(item => item.id === secondCopy));
    await click('Redo'); // 7.
    assert(!commandSnapshot().accepted.nativeDocument.bodies.some(item => item.id === secondCopy));
    await mounted.dispose(); control = await mountCommands(commandSeed);
    transports++; await click('Open'); assert(button('Duplicate body').disabled);
    await selectFile(file(savedText)); // Transport 3 / replacement 8, actual fresh chooser.
    assert.deepEqual(commandSnapshot().accepted, saved); assert.equal(commandSnapshot().canUndo, false);
    await selectBody(secondCopy); await edit('Uniform amount', '.6'); await edit('Body position X (mm)', '950'); await click('Apply'); // 9.
    const edited = commandSnapshot().accepted;
    assert.equal(edited.surfaceMaterials.find(item => item.target.bodyId === secondCopy).material.uniforms.amount, .6);
    assert.deepEqual(edited.surfaceMaterials.find(item => item.target.bodyId === B).material, originalMaterial);
    assert.deepEqual(edited.nativeDocument, saved.nativeDocument); assert.equal(poseFor(edited, secondCopy).translationMM[0], 950);
    assert.deepEqual(edited.lights.lights, saved.lights.lights);
    const beforeLoss = commandSnapshot(); control.wait = new Promise(resolve => {release = resolve;}); control.refusal = new Error('Controlled lost body remove');
    await act(async () => button('Remove body').click()); // 10.
    control.state = 'lost'; await act(async () => {release(); await control.wait;}); control.wait = null;
    assert.equal(commandSnapshot().accepted, beforeLoss.accepted); assert.equal(commandSnapshot().canUndo, beforeLoss.canUndo);
    assert.equal(commandSnapshot().canRedo, beforeLoss.canRedo); assert.equal(commandSnapshot().unsaved, beforeLoss.unsaved);
    assert(commandSnapshot().dirty); assert(container.querySelector('[aria-label="Body command recovery"]'));
    for (const label of ['Apply', 'Open', 'Import material…', 'Duplicate body', 'Remove body', 'New point', 'New directional', 'Frame all']) assert(button(label).disabled, label + ': recovery fence');
    assert.equal(commandSession().getSavePayload().text, api.serializeRenderNativeLightDocument(beforeLoss.accepted));
    assert(!button('Save accepted').disabled);
    await click('Remount accepted scene'); assert.equal(control.disposed, 1);
    control = trackCommands(controls.at(-1));
    assert.equal(commandSnapshot().dirty, false); assert.equal(commandSnapshot().canUndo, false); assert(!container.querySelector('[aria-label="Body command recovery"]'));
    // This lifetime imported saved copy_2; remove reservations are retained through remount.
    await selectBody(B); await click('Duplicate body'); // 11.
    const thirdCopy = selectedCommandBody(); assert.notEqual(thirdCopy, secondCopy);
    assert.equal(thirdCopy, firstCopy, 'Successful Open resets historical reservations; remount alone did not');
    const finalText = await saveCommands(), finalDocument = api.parseRenderNativeLightDocument(finalText); // Transport 4.
    assert.deepEqual(finalDocument, commandSnapshot().accepted); assert.equal(commandSnapshot().unsaved, false);
    assert(button('Duplicate body').disabled, 'Four assets/bodies at capacity');
    let releaseStale; control.wait = new Promise(resolve => {releaseStale = resolve;});
    await act(async () => button('Remove body').click()); // 12: held completion after disposal.
    await mounted.dispose(); assert.equal(control.disposed, 1);
    const oldControl = control; control = await mountCommands(commandSeed); const fresh = commandSnapshot(), freshDraft = commandDraft();
    await act(async () => {releaseStale(); await oldControl.wait;});
    assert.equal(commandSnapshot(), fresh); assert.deepEqual(commandDraft(), freshDraft); assert.equal(selectedCommandBody(), A);
    assert.equal(commandSnapshot().canUndo, false); assert.equal(commandSnapshot().dirty, false);
    assert.equal(presentations, 12); assert.equal(transports, 4);
    assert.equal(navigationDom.pendingFrames(), 0); assert.equal(navigationDom.captures(), 0);
    await mounted.dispose(); assert(commandControls.every(item => item.disposed === 1));
    bodyCommandFlow.push({kind, helperCases: cases.length, cases, presentations, saveOpenTransports: transports,
      readyRefusal: true, unavailableRecovery: true, staleCommandCompletion: true,
      proof: 'actual Native derivations and owned React/session; controlled Viewer/file transport only'});
  }

  // #1809 fixture factory is extracted verbatim by the cheap admission-only preflight.
  function surfaceImportFixtures(api, sourceText, kind) {
    const raw = structuredClone(api.createLightStudy(sourceText, kind));
    raw.surfaceMaterials[1].material.documentId = raw.surfaceMaterials[0].material.documentId;
    raw.surfaceMaterials[1].material.uniforms.amount = -0;
    raw.display.poses[1].rotationXYZW = [-0, 0, 0, -1];
    const seed = api.prepareRenderNativeLightDocument(raw).document;
    const declaration = sourceText.match(/ {2}@surface #reference_panel \{[\s\S]*?\n {2}\}/)?.[0];
    assert(declaration, 'actual original Surface declaration');
    const sourceWith = ids => sourceText.replace(/\}\s*$/, ids.map(id => declaration.replace('#reference_panel', '#' + id)).join('\n') + '\n}\n');
    const source = sourceWith(['imported_panel']).replace('@model cloth_reference_981', '@model imported_model')
      .replace('version: 0;', 'version: 0; /* original spelling and comments stay */\n');
    const curve = '@model curve_only { version: 0; length-unit: mm; @curve #path { type: nurbs; degree: 1; knots: [0,0,1,1]; control-points: [[-0,0,0],[1,2,3]]; weights: [1,1]; } }';
    const empty = api.prepareRenderNativeLightDocument({...seed, display: {...seed.display, poses: []}}).document;
    const hidden = api.prepareRenderNativeLightDocument({...seed, display: {...seed.display, visibleBodyIds: ['body_preview_b']},
      surfaceMaterials: seed.surfaceMaterials.filter(item => item.target.bodyId === 'body_preview_b')}).document;
    const unbound = api.prepareRenderNativeLightDocument({...seed,
      surfaceMaterials: seed.surfaceMaterials.filter(item => item.target.bodyId === 'body_preview_b')}).document;
    const maximum = structuredClone(seed); maximum.nativeDocument.revision = 2147483647;
    maximum.surfaceMaterials.forEach(item => {item.target.documentRevision = 2147483647;});
    const maxNative = api.prepareRenderNativeLightDocument(maximum).document;
    const maxOuter = api.prepareRenderNativeLightDocument({...seed, revision: 2147483647, lights: {...seed.lights, revision: 2147483647}}).document;
    const assets = structuredClone(seed);
    for (let i = 2; i < 4; i++) {
      assets.nativeDocument.assets.push({...assets.nativeDocument.assets[0], id: 'unselected_asset_' + i});
      assets.nativeDocument.bodies.push({...assets.nativeDocument.bodies[0], id: 'unselected_body_' + i, assetId: 'unselected_asset_' + i});
    }
    const assetCap = api.prepareRenderNativeLightDocument(assets).document;
    const selected = structuredClone(seed);
    selected.nativeDocument.assets[0].source = sourceWith(['selected_c', 'selected_d']);
    for (const id of ['selected_c', 'selected_d']) {
      selected.nativeDocument.bodies.push({...selected.nativeDocument.bodies[0], id, geometryId: id});
      selected.nativeOptions.bodyIds.push(id); selected.display.visibleBodyIds.push(id);
      selected.display.poses.push({...selected.display.poses[0], bodyId: id});
      selected.surfaceMaterials.push({target: {...selected.surfaceMaterials[0].target, bodyId: id, geometryId: id}, material: selected.surfaceMaterials[0].material});
    }
    const selectionCap = api.prepareRenderNativeLightDocument(selected).document;
    const both = structuredClone(assetCap);
    const extra = ['extra_0', 'extra_1', 'extra_2'];
    for (const [index, asset] of both.nativeDocument.assets.entries()) {
      asset.source = sourceWith(extra);
      for (const [j, geometryId] of extra.entries())
        both.nativeDocument.bodies.push({...both.nativeDocument.bodies[0], id: 'body_' + index + '_' + j, assetId: asset.id, geometryId});
    }
    const bothCaps = api.prepareRenderNativeLightDocument(both).document;
    return {seed, empty, hidden, unbound, maxNative, maxOuter, assetCap, selectionCap, bothCaps,
      source, curve, tooMany: sourceWith(['extra_0', 'extra_1', 'extra_2', 'extra_3']), unsafe: source.replaceAll('-700', '0.' + '0'.repeat(49) + '1')};
  }
  const surfaceImportFlow = [];
  for (const kind of ['directional', 'point']) {
    const fixtures = surfaceImportFixtures(api, sourceText, kind), {seed: importSeed, source: importSource} = fixtures;
    const originalText = api.serializeRenderNativeLightDocument(importSeed), cases = [];
    activeSurfaceLedger = {kind, cases, presentations: 0, transports: 0, lifetimes: 0};
    const addition = (label, value = importSeed, bodyId = B, source = importSource, surfaceId = 'imported_panel', reservations = []) => {
      cases.push(label); assert(cases.length <= 24, 'Surface helper ceiling'); const before = structuredClone(value);
      try {return api.deriveLightSurfaceAddition(value, bodyId, source, surfaceId, reservations);}
      finally {assert.deepEqual(value, before, label + ': original immutable');}
    };
    const refuses = (...args) => {let error; try {addition(...args);} catch (cause) {if (cause instanceof assert.AssertionError) throw cause; error = cause;}
      assert(error, args[0] + ': actual provider refuses'); return error;};
    const byA = addition('selected A material and actual second Surface', importSeed, A);
    const reordered = api.prepareRenderNativeLightDocument({...importSeed, surfaceMaterials: [...importSeed.surfaceMaterials].reverse()}).document;
    const byB = addition('selected B with repeated IDs and reversed bindings', reordered);
    for (const [result, originalBody] of [[byA, A], [byB, B]]) {
      const expectedMaterial = importSeed.surfaceMaterials.find(item => item.target.bodyId === originalBody).material;
      assert.deepEqual(result.document.surfaceMaterials.at(-1).material, {...expectedMaterial, documentId: result.generatedIds[2], revision: 0});
      assert.equal(result.document.nativeDocument.assets.at(-1).source, importSource);
      assert.equal(result.document.nativeDocument.bodies.at(-1).geometryId, 'imported_panel');
      assert.deepEqual(result.document.nativeDocument.assets.slice(0, 2), importSeed.nativeDocument.assets);
      assert.deepEqual(result.document.nativeDocument.bodies.slice(0, 2), importSeed.nativeDocument.bodies);
      assert.deepEqual(result.document.display.poses.slice(0, 2), importSeed.display.poses);
      assert.deepEqual(result.document.display.poses.at(-1), {bodyId: result.selectedBodyId, translationMM: [0, 0, 0], rotationXYZW: [0, 0, 0, 1], scale: [1, 1, 1]});
      assert.deepEqual(result.document.lights, importSeed.lights); assert.deepEqual(result.document.display.camera, importSeed.display.camera);
      assert.equal(result.document.revision, importSeed.revision); assert.equal(result.document.nativeDocument.revision, importSeed.nativeDocument.revision + 1);
      const prepared = api.prepareRenderNativeLightDocument(result.document);
      for (const binding of result.document.surfaceMaterials) {
        const actual = prepared.entries.find(entry => entry.binding.bodyId === binding.target.bodyId).binding;
        for (const key of Object.keys(binding.target)) assert.equal(binding.target[key], actual[key]);
      }
      prepareBodyAppearance(api.createRenderNativeLightRequest(result.document));
    }
    assert.deepEqual(addition('omitted identity poses stay omitted', fixtures.empty).document.display.poses, []);
    const reserved = addition('reserved successful identities are not reused', importSeed, B, importSource, 'imported_panel', byB.reservedIds);
    assert(reserved.generatedIds.every(id => !byB.generatedIds.includes(id)));
    const baselineIds = [...api.lightBodyReservedIds(importSeed)];
    const reservations = length => baselineIds.concat(Array.from({length: length - baselineIds.length}, (_, i) => 'reserve_' + i));
    assert.equal(addition('exact complete 2048 reservation union', importSeed, B, importSource, 'imported_panel', reservations(2045)).reservedIds.length, 2048);
    refuses('malformed original source', importSeed, B, '@model invalid');
    refuses('real curve-only source', importSeed, B, fixtures.curve, 'path');
    refuses('unknown Surface', importSeed, B, importSource, 'invented');
    refuses('source code-unit limit', importSeed, B, 'a'.repeat(65537));
    refuses('source UTF-8 limit before code-unit limit', importSeed, B, 'é'.repeat(32769));
    refuses('unknown selected body', importSeed, 'unknown');
    refuses('hidden selected body', fixtures.hidden, A);
    refuses('unbound selected body', fixtures.unbound, A);
    const forged = structuredClone(importSeed); forged.surfaceMaterials[1].target.modelId = 'foreign_model';
    refuses('forged qualified material target', forged);
    refuses('maximum native revision', fixtures.maxNative);
    refuses('four assets', fixtures.assetCap);
    refuses('four selected bodies with only two assets', fixtures.selectionCap);
    assert.equal(fixtures.bothCaps.nativeDocument.bodies.length, 16);
    refuses('sixteen bodies and four assets together', fixtures.bothCaps);
    refuses('non-array reservations', importSeed, B, importSource, 'imported_panel', null);
    let reads = 0; const accessor = []; Object.defineProperty(accessor, '0', {enumerable: true, get() {reads++; return 'forbidden';}});
    refuses('accessor reservation is not evaluated', importSeed, B, importSource, 'imported_panel', accessor); assert.equal(reads, 0);
    refuses('result reservation union overflow', importSeed, B, importSource, 'imported_panel', reservations(2046));
    const unsafeError = refuses('actual Float32 underflow refuses import', importSeed, B, fixtures.unsafe);
    assert.match(JSON.stringify(errorTree(unsafeError)), /underflow/i);
    assert.equal(api.prepareRenderNativeSourceImport(fixtures.tooMany).surfaces.length, 5);
    refuses('inspection is not five-Surface display admission', importSeed, B, fixtures.tooMany, 'reference_panel');
    assert.equal(addition('provider does not invent outer revision increment', fixtures.maxOuter).document.revision, 2147483647);
    assert.equal(cases.length, 24); assert.equal(new Set(cases).size, 24); assert.equal(api.serializeRenderNativeLightDocument(importSeed), originalText);

    let presentations = 0, transports = 0; const owned = [], attempts = [];
    activeSurfaceLedger = {kind, cases, attempts, get presentations() {return presentations;}, get transports() {return transports;}, get lifetimes() {return owned.length;}};
    const track = control => {control.prepare = prepareBodyAppearance; const replace = control.viewer.replace;
      control.viewer.replace = request => {presentations++; assert(presentations <= 10); return replace(request);}; owned.push(control); assert(owned.length <= 5); return control;};
    const mountImport = async value => {mounted = await api.mountLightWorkbenchFlow(container, value); return track(controls.at(-1));};
    const snapshot = () => flowControllers.at(-1).getSession().getSnapshot();
    const draft = () => api.readLightWorkbenchFlowDraft(container);
    const dialog = () => document.querySelector('[data-testid="light-add-dialog"]');
    const dialogButton = label => [...dialog().querySelectorAll('button')].find(node => node.textContent.trim() === label);
    const dialogClick = async label => {const target = dialogButton(label); assert(target && !target.disabled, label); await act(async () => target.click());};
    const pickSurface = async () => {const target = dialog().querySelector('[aria-label="Surface to add"]'); await act(async () => {target.value = 'imported_panel'; target.dispatchEvent(new dom.window.Event('change', {bubbles: true}));});};
    const transport = label => {transports++; attempts.push(label); assert(transports <= 18);};
    const choose = async (label, value, cancel = false) => {
      transport(label); await dialogClick('Choose CAD source'); const input = dialog().querySelector('input[type="file"]');
      if (cancel) {await act(async () => input.dispatchEvent(new dom.window.Event('cancel'))); return;}
      Object.defineProperty(input, 'files', {value: value ? [value] : [], configurable: true});
      await act(async () => input.dispatchEvent(new dom.window.Event('change', {bubbles: true})));
    };
    const sourceFile = () => file(importSource, 'original.barocad');
    const saveImport = async label => {transport(label); return saveText();};
    const selectedId = () => [...container.querySelectorAll('[aria-label^="Edit body "]')].find(node => node.getAttribute('aria-pressed') === 'true')?.getAttribute('aria-label').slice(10);
    const noChange = (before, fields) => {assert.equal(snapshot(), before); assert.deepEqual(draft(), fields); assert.equal(presentations, 0);};
    let control = await mountImport(importSeed); await selectBody(B);
    await edit('Body position X (mm)', '1e'); assert(button('Add Surface…').disabled); await click('Discard');
    const staleTrigger = button('Add Surface…'); await act(async () => {button('Edit body ' + A).click(); staleTrigger.click();});
    assert.equal(dialog(), null); await selectBody(B);
    const before = snapshot(), beforeDraft = draft(); await click('Add Surface…');
    for (const label of ['Apply', 'Open', 'Save accepted', 'New point', 'Duplicate body', 'Frame all']) assert(button(label).disabled, label + ': modal fence');
    await act(async () => {button('Edit body ' + A).click(); button('Help').click();}); assert.equal(selectedId(), B);
    await choose('valid original multi-Surface candidate', sourceFile()); await pickSurface();
    assert.match(dialog().textContent, /imported_model/); assert.equal(dialog().querySelectorAll('[aria-label="Source objects"] li').length, 2);
    const candidateName = () => dialog().querySelector('[aria-label="Surface to add"]')?.value;
    await choose('chooser cancel retains candidate', null, true); assert.equal(candidateName(), 'imported_panel');
    await choose('empty selection retains candidate', null); assert.equal(candidateName(), 'imported_panel');
    let oversizedReads = 0;
    await choose('reported oversize never reads', {name: 'large', size: 65537, arrayBuffer: async () => {oversizedReads++; return new ArrayBuffer(0);}});
    assert.equal(oversizedReads, 0); assert.match(dialog().textContent, /65536/);
    let decodeCalls = 0; const decode = TextDecoder.prototype.decode;
    TextDecoder.prototype.decode = function (...args) {decodeCalls++; return decode.apply(this, args);};
    try {await choose('actual oversize refuses before decode', {name: 'actual-large', size: 1, arrayBuffer: async () => new ArrayBuffer(65537)});}
    finally {TextDecoder.prototype.decode = decode;}
    assert.equal(decodeCalls, 0);
    await choose('fatal UTF-8 retains candidate', {name: 'invalid-utf8', size: 2, arrayBuffer: async () => new Uint8Array([0xc3, 0x28]).buffer});
    await choose('rejected read retains candidate', {name: 'unreadable', size: 1, arrayBuffer: async () => {throw new Error('Controlled source read failure');}});
    await choose('malformed source retains candidate', file('@model invalid', 'bad.barocad'));
    assert.equal(candidateName(), 'imported_panel'); noChange(before, beforeDraft);
    let resolveRead; await choose('held read closed before completion', {name: 'held', size: importSource.length, arrayBuffer: () => new Promise(resolve => {resolveRead = resolve;})});
    await dialogClick('Cancel'); assert.equal(dialog(), null); assert.equal(document.activeElement, button('Add Surface…'));
    await act(async () => resolveRead(new TextEncoder().encode(importSource).buffer)); noChange(before, beforeDraft);
    await click('Add Surface…'); await choose('valid source before stale Add disposal', sourceFile()); await pickSurface();
    let release; control.wait = new Promise(resolve => {release = resolve;});
    await act(async () => dialogButton('Add Surface').click()); // 1: hold and dispose actual submitted Add.
    assert(dialogButton('Cancel').disabled);
    await act(async () => {dialog().dispatchEvent(new dom.window.KeyboardEvent('keydown', {key: 'Escape', bubbles: true})); dialogButton('Cancel').click();});
    assert(dialog()); assert.equal(snapshot().accepted, before.accepted);
    const staleControl = control; await mounted.dispose(); control = await mountImport(importSeed);
    const fresh = snapshot(); await act(async () => {release(); await staleControl.wait;}); assert.equal(snapshot(), fresh); assert.equal(dialog(), null);
    await selectBody(B); await click('Add Surface…'); await choose('valid source ready-refusal then retry', sourceFile()); await pickSurface();
    const beforeRefusal = snapshot(), refusalDraft = draft(); control.refusal = new Error('Controlled Surface Add refusal');
    await dialogClick('Add Surface'); // 2.
    assert.equal(snapshot().accepted, beforeRefusal.accepted); assert.equal(snapshot().canUndo, false); assert.equal(snapshot().dirty, false);
    assert.equal(snapshot().unsaved, beforeRefusal.unsaved); assert.deepEqual(draft(), refusalDraft); assert.equal(candidateName(), 'imported_panel');
    assert.match(dialog().textContent, /PRESENTATION_REFUSED/); control.refusal = null;
    await dialogClick('Add Surface'); // 3.
    assert.equal(dialog(), null); const addedId = selectedId(), added = snapshot().accepted;
    assert.equal(addedId, byB.selectedBodyId); assert.equal(added.revision, importSeed.revision + 1);
    assert.equal(added.nativeDocument.revision, importSeed.nativeDocument.revision + 1);
    assert.deepEqual(added, {...byB.document, surfaceMaterials: [byB.document.surfaceMaterials[1], byB.document.surfaceMaterials[0], byB.document.surfaceMaterials[2]],
      revision: added.revision, lights: {...byB.document.lights, revision: added.revision}});
    assert.deepEqual(snapshot().viewportCamera, beforeRefusal.viewportCamera); assert(snapshot().canUndo);
    await click('Undo'); // 4.
    assert.equal(snapshot().canUndo, false); assert(snapshot().canRedo); assert.equal(snapshot().accepted.nativeDocument.bodies.length, 2);
    await click('Redo'); // 5.
    assert.equal(snapshot().canRedo, false); await selectBody(addedId);
    const savedText = await saveImport('accepted added scene Save'), saved = api.parseRenderNativeLightDocument(savedText);
    await mounted.dispose(); control = await mountImport(importSeed);
    transport('fresh same-kind chooser Open'); await click('Open'); await selectFile(file(savedText)); // 6.
    assert.deepEqual(snapshot().accepted, saved); assert.equal(snapshot().canUndo, false); await selectBody(addedId);
    await edit('Body position X (mm)', '125'); await edit('Uniform amount', '.6'); await click('Apply'); // 7.
    assert.equal(poseFor(snapshot().accepted, addedId).translationMM[0], 125);
    assert.deepEqual(snapshot().accepted.nativeDocument, saved.nativeDocument);
    assert.deepEqual(snapshot().accepted.surfaceMaterials.slice(0, 2), saved.surfaceMaterials.slice(0, 2));
    assert.equal(snapshot().accepted.surfaceMaterials.at(-1).material.uniforms.amount, .6);
    const editedText = await saveImport('accepted new body re-edit Save'), edited = api.parseRenderNativeLightDocument(editedText);
    await selectBody(B); await click('Add Surface…'); await choose('valid source before lost Add', sourceFile()); await pickSurface();
    control.wait = new Promise(resolve => {release = resolve;}); control.refusal = new Error('Controlled lost Surface Add');
    const beforeLoss = snapshot(); await act(async () => dialogButton('Add Surface').click()); // 8.
    control.state = 'lost'; await act(async () => {release(); await control.wait;});
    assert.equal(snapshot().accepted, beforeLoss.accepted); assert.equal(snapshot().canUndo, beforeLoss.canUndo); assert(snapshot().dirty);
    assert.match(dialog().textContent, /recovery required/); await dialogClick('Cancel');
    assert(container.querySelector('[aria-label="Body command recovery"]')); assert(!button('Save accepted').disabled);
    assert.equal(flowControllers.at(-1).getSession().getSavePayload().text, api.serializeRenderNativeLightDocument(beforeLoss.accepted));
    await click('Remount accepted scene'); assert.equal(control.disposed, 1); control = track(controls.at(-1));
    assert.equal(snapshot().canUndo, false); assert.equal(snapshot().dirty, false);
    await selectBody(B); await click('Add Surface…');
    await choose('held source read lost and disposed', {name: 'held-lost', size: importSource.length, arrayBuffer: () => new Promise(resolve => {resolveRead = resolve;})});
    control.state = 'lost'; await act(async () => {await new Promise(resolve => setTimeout(resolve, 350));}); await mounted.dispose();
    control = await mountImport(edited); const lastFresh = snapshot(), lastDraft = draft();
    await act(async () => resolveRead(new TextEncoder().encode(importSource).buffer)); assert.equal(snapshot(), lastFresh); assert.deepEqual(draft(), lastDraft); assert.equal(dialog(), null);
    await selectBody(B); await click('Add Surface…'); await choose('post-recovery source Add', sourceFile()); await pickSurface(); await dialogClick('Add Surface'); // 9.
    assert.notEqual(selectedId(), addedId); assert.equal(snapshot().accepted.nativeDocument.bodies.length, 4);
    assert.deepEqual(api.parseRenderNativeLightDocument(await saveImport('final accepted Save')), snapshot().accepted);
    assert.equal(transports, 18); assert.equal(presentations, 9); assert.equal(owned.length, 5);
    assert.equal(navigationDom.pendingFrames(), 0); assert.equal(navigationDom.captures(), 0);
    await mounted.dispose(); assert(owned.every(value => value.disposed === 1)); assert.equal(dialog(), null);
    surfaceImportFlow.push({kind, helperCases: cases.length, cases, presentations, transports, attempts, lifetimes: owned.length,
      priorCandidateRetention: true, byteGuardBeforeDecode: true, ownedRecovery: true, staleReadAndAdd: true,
      proof: 'actual source/derivation/React/session with controlled Viewer and file transport'});
  }

  console.log(JSON.stringify({result: 'PASS', scope: 'actual React + original codec/session; controlled Viewer, no GPU/physical-file proof', acceptedRevision: last.revision,
    lights: last.lights.lights.length, replacementCalls: controls[0].calls.length, legacyReplacements: legacyControl.calls.length, convertedLegacyRevision: editedLegacy.revision,
    cameraFlow, bodyFlow, materialFlow, navigationFlow, framingChecks, framingFlow, selectionFlow, materialTransferFlow, rotationFlow, bodyCommandFlow, surfaceImportFlow,
    downloadsRequested: downloads.length, confirmationPrompts: dialogs.length, disposed: controls.map(value => value.disposed)}));
} catch (cause) {failed = true; firstError = cause; console.error('Original Light flow failure:', cause); console.error('Active Surface ledger:', JSON.stringify(activeSurfaceLedger));}
finally {
  for (const cleanup of [() => mounted?.dispose(), async () => {
    // Radix restores focus in a deferred task. Keep the original DOM realm alive
    // until that cleanup has dispatched, before restoring global constructors.
    await new Promise(resolve => setTimeout(resolve, 0));
  }, () => navigationDom?.dispose(), () => {
    if (previousControllerObserver) Object.defineProperty(globalThis, '__observeLightFlowController', previousControllerObserver);
    else Reflect.deleteProperty(globalThis, '__observeLightFlowController');
  }, () => dom.window.close(), () => {
    for (const [name, descriptor] of previousDomGlobals) {if (descriptor) Object.defineProperty(globalThis, name, descriptor); else Reflect.deleteProperty(globalThis, name);}
  }, () => rm(output, {recursive: true, force: true})]) {
    try {await cleanup();} catch (cause) {cleanupErrors.push(cause);}
  }
}
if (cleanupErrors.length) console.error('Light flow cleanup failures:', cleanupErrors);
if (failed) throw firstError;
if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'Light flow cleanup failed.');
