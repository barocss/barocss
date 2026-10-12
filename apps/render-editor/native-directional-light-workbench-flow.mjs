/** Node 22: real React/codec/session, controlled Viewer. No GPU or physical file proof. */
import assert from 'node:assert/strict';
import {readFile, mkdir, rm} from 'node:fs/promises';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
const app = dirname(fileURLToPath(import.meta.url)), workspace = resolve(app, '../..');
const output = join(app, '.directional-light-flow'); await mkdir(output, {recursive: true});
const dom = new JSDOM('<!doctype html><div id="root"></div>', {url: 'http://localhost/material.html?workbench=directional-lights'});
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
  const control = {calls: [], disposed: 0, state: 'ready', wait: null, refusal: null};
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
  await build({stdin: {contents: `export * from './apps/render-editor/src/native-directional-light-workbench';
export * from './apps/render-editor/src/native-directional-light-fields';
export * from './apps/render-editor/src/native-directional-light-workbench-flow';
export {parseRenderNativeDirectionalLightDocument,serializeRenderNativeDirectionalLightDocument} from '@barocss/render-editor';`,resolveDir: workspace},
    bundle: true, platform: 'node', format: 'esm', outfile: join(output, 'flow.mjs'),
    external: ['react', 'react-dom', 'react-dom/*', 'lucide-react', 'radix-ui', 'class-variance-authority', 'clsx', 'tailwind-merge'],
    plugins: [{name: 'controlled-viewer-only', setup(builder) {
      builder.onResolve({filter: /^@barocss\/viewer$/}, () => ({path: 'controlled-viewer', namespace: 'test'}));
      builder.onLoad({filter: /.*/, namespace: 'test'}, () => ({contents: `export * from ${JSON.stringify(join(workspace, 'packages/barocss-viewer/src/index.ts'))};
export const createNativeDirectionalLightWebGPUViewer = (...args) => globalThis.__lightWorkbenchViewer(...args);`, resolveDir: workspace}));
    }}]});
  const api = await import(pathToFileURL(join(output, 'flow.mjs')).href), {act} = await import('react');
  const seed = api.createDirectionalLightStudy(await readFile(join(app, 'public/reference-panel.barocad'), 'utf8'));
  const original = api.serializeRenderNativeDirectionalLightDocument(seed);
  const form = api.addDirectionalLightFields(api.readDirectionalLightFields(seed));
  form.lights[1].direction = ['-0', '2', '-4']; form.lights[1].color = ['.3', '.5', '.8'];
  const candidate = api.applyDirectionalLightFields(seed, form);
  assert(Object.is(candidate.lights.lights[1].directionScene[0], -0));
  assert.deepEqual(candidate.nativeDocument, seed.nativeDocument); assert.deepEqual(candidate.surfaceMaterials, seed.surfaceMaterials);
  for (const change of [value => {value.lights[1].direction = ['0', '0', '0'];}, value => {value.lights[1].nodeId = value.lights[0].nodeId;}, value => {value.ambient = '';}, value => {value.lights[1].intensity = '1.1';},
    value => {value.ambient = 'NaN';}, value => {value.lights[1].direction[0] = 'Infinity';},
    value => {value.lights[1].color[0] = '-.01';}, value => {value.lights[1].color[2] = '1.01';}]) {
    const invalid = structuredClone(form); change(invalid); assert.throws(() => api.applyDirectionalLightFields(seed, invalid));
    assert.equal(api.serializeRenderNativeDirectionalLightDocument(seed), original);
  }
  const four = api.addDirectionalLightFields(api.addDirectionalLightFields(form)); assert.equal(four.lights.length, 4);
  assert.throws(() => api.addDirectionalLightFields(four));
  const ambientOnly = api.applyDirectionalLightFields(seed, {ambient: '-0', lights: []});
  assert.equal(ambientOnly.lights.lights.length, 0); assert(Object.is(ambientOnly.lights.ambientStrength, -0));
  const disabledLight = structuredClone(form); disabledLight.lights[1].enabled = false;
  assert.equal(api.applyDirectionalLightFields(seed, disabledLight).lights.lights[1].enabled, false);
  const container = document.getElementById('root'); let mounted = await api.mountDirectionalLightWorkbenchFlow(container, seed);
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
  const first = await downloads.at(-1).blob.text(); const firstDocument = api.parseRenderNativeDirectionalLightDocument(first);
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
  await click('Save accepted'); const last = api.parseRenderNativeDirectionalLightDocument(await downloads.at(-1).blob.text()); assert.equal(last.lights.ambientStrength, .5);
  await click('Open'); let releaseRead; const delayed = {name: 'delayed.json', size: first.length, arrayBuffer: () => new Promise(resolve => {releaseRead = resolve;})};
  await selectFile(delayed); await mounted.dispose(); await act(async () => releaseRead(new TextEncoder().encode(first).buffer)); assert.equal(controls[0].calls.length, count); assert.equal(controls[0].disposed, 1);
  mounted = await api.mountDirectionalLightWorkbenchFlow(container, last); assert(text().includes('Accepted 3'));
  controls[1].state = 'lost'; await act(async () => {await new Promise(resolve => setTimeout(resolve, 350));});
  assert(text().includes('Presentation unavailable (lost)')); assert(!button('Save accepted').disabled);
  await click('Save accepted'); assert(text().includes('Download requested; saved marker could not be acknowledged.'));
  await click('Remount accepted scene'); assert.equal(controls[1].disposed, 1); assert(text().includes('Accepted 3')); assert(button('Undo').disabled);
  await mounted.dispose(); assert.equal(controls[2].disposed, 1);
  startupFailure = new Error('WebGPU unavailable'); mounted = await api.mountDirectionalLightWorkbenchFlow(container, last);
  assert(text().includes('Presentation unavailable (unavailable)')); assert(button('Apply').disabled); await mounted.dispose(); startupFailure = null;
  let finishStartup; startupGate = new Promise(resolve => {finishStartup = resolve;});
  mounted = await api.mountDirectionalLightWorkbenchFlow(container, last); await mounted.dispose();
  await act(async () => {finishStartup(); await startupGate;}); startupGate = null; assert.equal(controls[3].disposed, 1);
  console.log(JSON.stringify({result: 'PASS', scope: 'actual React + original codec/session; controlled Viewer, no GPU/physical-file proof', acceptedRevision: last.revision,
    lights: last.lights.lights.length, replacementCalls: controls[0].calls.length, downloadsRequested: downloads.length, confirmationPrompts: dialogs.length, disposed: controls.map(value => value.disposed)}));
} finally {dom.window.close(); await rm(output, {recursive: true, force: true});}
