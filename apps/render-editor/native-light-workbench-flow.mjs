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
for (const name of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLCanvasElement', 'Event', 'MouseEvent', 'File'])
  Object.defineProperty(globalThis, name, {value: dom.window[name], configurable: true});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const dialogs = []; let confirmation = true, fileChoosers = 0;
dom.window.confirm = message => {dialogs.push(message); return confirmation;};
const inputClick = dom.window.HTMLInputElement.prototype.click;
dom.window.HTMLInputElement.prototype.click = function () {if (this.type === 'file') fileChoosers++; return inputClick.call(this);};
const downloads = []; let latestBlob;
URL.createObjectURL = blob => {latestBlob = blob; return 'blob:controlled-test';}; URL.revokeObjectURL = () => {};
dom.window.HTMLAnchorElement.prototype.click = function () {downloads.push({name: this.download, blob: latestBlob});};
const controls = []; let startupGate = null, startupFailure = null;
globalThis.__lightWorkbenchViewer = async (_canvas, request) => {
  if (startupFailure) throw startupFailure;
  const gate = startupGate;
  const control = {initial: request, calls: [], disposed: 0, state: 'ready', wait: null, refusal: null};
  const viewer = {accepted: {generation: 1, owner: request.owner},
    get status() {return {backend: 'webgpu', state: control.state, width: 960, height: 600, generation: viewer.accepted.generation};},
    async replace(next) {
      control.calls.push(next); if (control.wait) await control.wait;
      if (control.refusal) return {ok: false, error: control.refusal};
      viewer.accepted = {generation: viewer.accepted.generation + 1, owner: next.owner}; return {ok: true};
    }, dispose() {control.disposed++; control.state = 'disposed';},
  };
  control.viewer = viewer; controls.push(control); if (gate) await gate; return viewer;
};
try {
  await build({stdin: {contents: `export * from './apps/render-editor/src/native-light-workbench';
export * from './apps/render-editor/src/native-light-fields';
export * from './apps/render-editor/src/native-light-workbench-flow';
export {createNativeSceneBase,createNativeSceneSeed} from './apps/render-editor/src/native-scene-seed';
export {prepareRenderNativeLightDocument,parseRenderNativeLightDocument,serializeRenderNativeLightDocument,serializeRenderNativeSceneDocument,serializeRenderNativeDirectionalLightDocument,parseRenderNativeDirectionalLightDocument} from '@barocss/render-editor';`,resolveDir: workspace},
    bundle: true, platform: 'node', format: 'esm', outfile: join(output, 'flow.mjs'),
    external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'radix-ui', 'class-variance-authority', 'clsx', 'tailwind-merge'],
    plugins: [{name: 'controlled-viewer-only', setup(builder) {
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
  const container = document.getElementById('root'); let mounted = await api.mountLightWorkbenchFlow(container, seed);
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

  console.log(JSON.stringify({result: 'PASS', scope: 'actual React + original codec/session; controlled Viewer, no GPU/physical-file proof', acceptedRevision: last.revision,
    lights: last.lights.lights.length, replacementCalls: controls[0].calls.length, legacyReplacements: legacyControl.calls.length, convertedLegacyRevision: editedLegacy.revision,
    cameraFlow, downloadsRequested: downloads.length, confirmationPrompts: dialogs.length, disposed: controls.map(value => value.disposed)}));
} finally {dom.window.close(); await rm(output, {recursive: true, force: true});}
