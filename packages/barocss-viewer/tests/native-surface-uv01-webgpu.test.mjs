/** #1581 focused consumer seam. CPU providers are genuine; the imported async
 * backend is controlled privately. No device, WGSL or pixel acceptance claimed. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, mkdtemp, statfs } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
export const copy = value => structuredClone(value);
export function signed(value) {
  if (typeof value === 'number') return Object.is(value, -0) ? '-0' : String(value);
  if (Array.isArray(value)) return '[' + value.map(signed).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.entries(value).map(([k, v]) => JSON.stringify(k) + ':' + signed(v)).join(',') + '}';
  return JSON.stringify(value);
}
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function frozen(value) { if (value && typeof value === 'object') { assert.ok(Object.isFrozen(value)); Object.values(value).forEach(frozen); } }
let serial = 0;
export async function loadModules(mode = 'source', evidence) {
  const disk = await statfs(root); assert.ok(disk.bavail * disk.bsize >= 500000000, 'Fresh 500000000 bytes free required');
  const dir = mode === 'source' ? 'src' : 'dist', ext = mode === 'source' ? 'ts' : 'js';
  const key = `barocss1581-${++serial}`;
  const state = { calls: [], instances: [], counts: {}, gate: null, pickGate: null, mountGate: null, selectionLoss: false, failure: null, failurePhase: null, mountPhase: 'ready', picked: undefined };
  globalThis[key] = state;
  const gpu = resolve(root, `packages/barocss-gpu/${dir}/index.${ext}`);
  const frame = resolve(root, `packages/barocss-gpu/${dir}/native-surface-uv01-frame.${ext}`);
  const proxy = `export * from ${JSON.stringify(gpu)};
    import {prepareNativeSurfaceUV01Frame as prepare} from ${JSON.stringify(frame)};
    const h=globalThis[${JSON.stringify(key)}];
    export async function mountNativeSurfaceUV01WebGPUViewport(canvas,input,options) {
      h.calls.push(['mount',input,options]); prepare(input,options.width,options.height);
      if(h.mountGate)await h.mountGate.promise;
      let raw=input,generation=1,selected=null,phase=h.mountPhase,width=options.width,height=options.height;
      const instance={canvas,get originals(){return raw},get selected(){return selected},
        get status(){return {backend:'webgpu',profile:'source0-native-surface-uv01-webgpu-v0',state:phase,generation,width,height,limits:{},resources:{}}},
        setPhase(value){phase=value},
        async updateFrame(input){h.calls.push(['update',input]);try{prepare(input,width,height);if(h.gate)await h.gate.promise;if(h.failure){const error=h.failure;h.failure=null;if(h.failurePhase)phase=h.failurePhase;return {ok:false,error}}raw=input;generation++;return {ok:true}}catch(error){return {ok:false,error}}},
        async resize(w,t){h.calls.push(['resize',w,t]);try{prepare(raw,w,t);if(h.gate)await h.gate.promise;if(h.failure){const error=h.failure;h.failure=null;if(h.failurePhase)phase=h.failurePhase;return {ok:false,error}}width=w;height=t;generation++;return {ok:true}}catch(error){return {ok:false,error}}},
        async readPixels(){h.calls.push(['read']);if(h.gate)await h.gate.promise;return new Uint8Array(width*height*4)},
        async pick(x,y){h.calls.push(['pick',x,y]);if(h.pickGate)await h.pickGate.promise;return h.picked??{generation,ref:raw.entries[0].ref}},
        select(ref){h.calls.push(['select',ref]);selected=ref;if(h.selectionLoss)phase='lost';return {ok:true}},
        dispose(){h.calls.push(['dispose']);phase='disposed'}
      };h.instances.push(instance);return instance;
    }`;
  const plugin = { name: 'private-uv01-seam', setup(b) {
    b.onResolve({ filter: /^@barocss\// }, args => {
      const [name, ...rest] = args.path.slice('@barocss/'.length).split('/');
      if (name === 'gpu' && !rest.length) return { path: 'controlled-gpu', namespace: 'private-test' };
      return { path: resolve(root, `packages/barocss-${name}/${dir}/${rest.join('/') || 'index'}.${ext}`) };
    });
    b.onResolve({ filter: /packages\/barocss-(viewer|gpu|cad-interop)\/src\/.+\.js$/ }, args => {
      const match = args.path.match(/packages\/barocss-(viewer|gpu|cad-interop)\/src\/(.+)\.js$/);
      return { path: resolve(root, `packages/barocss-${match[1]}/${dir}/${match[2]}.${ext}`) };
    });
    b.onLoad({ filter: /.*/, namespace: 'private-test' }, () => ({ contents: proxy, loader: 'js', resolveDir: root }));
    b.onLoad({ filter: /\.(ts|js)$/ }, async args => {
      if (!args.path.includes('/packages/barocss-')) return;
      let contents = await readFile(args.path, 'utf8');
      for (const name of ['prepareViewerNativeSceneAppearance', 'prepareBaroCadDocumentPrimitiveNativeRefsV2'])
        contents = contents.replace(new RegExp(`(function ${name}\\([^{}]*?\\)[^{]*\\{)`, 'g'), `$1 globalThis[${JSON.stringify(key)}].counts.${name}=(globalThis[${JSON.stringify(key)}].counts.${name}||0)+1;`);
      return { contents, loader: args.path.endsWith('.ts') ? 'ts' : 'js' };
    });
  } };
  const contents = `export * as viewer from './packages/barocss-viewer/${dir}/index.${ext}';
    export * as candidate from './packages/barocss-viewer/${dir}/native-surface-uv01-candidate.${ext}';
    export * as example from './examples/viewer-native-surface-uv01/app.ts';
    export * as gpu from './packages/barocss-gpu/${dir}/index.${ext}';`;
  const result = await build({ stdin: { contents, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, plugins: [plugin] });
  const folder = evidence ?? process.env.BAROCSS_1581_EVIDENCE ?? await mkdtemp(resolve(tmpdir(), 'barocss1581-')); await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, `${mode}-graph.json`), JSON.stringify(result.metafile, null, 2));
  const bundle = resolve(folder, `${mode}-${serial}.mjs`); await writeFile(bundle, result.outputFiles[0].text);
  return { ...await import(pathToFileURL(bundle).href), state, graph: result.metafile };
}
const err = (error, code) => { assert.equal(error.name, 'ViewerNativeSurfaceUV01Error'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024); return true; };
const bad = (result, code) => { assert.equal(result.ok, false); err(result.error, code); return result.error; };
const good = result => assert.deepEqual(result, { ok: true });
const dimensions = { width: 16, height: 8 };

export function runJoinChecks(m) {
  const input = m.example.createSeedInput(), before = signed(input); m.state.counts = {};
  const joined = m.candidate.prepareUV01Candidate(input, 1, null);
  assert.deepEqual(m.state.counts, { prepareViewerNativeSceneAppearance: 1, prepareBaroCadDocumentPrimitiveNativeRefsV2: 1 });
  assert.equal(signed(input), before); assert.equal(Object.isFrozen(input), false);
  frozen(joined.originals); frozen(joined.accepted); assert.notEqual(joined.originals, input);
  assert.equal(joined.accepted.document.revision, input.source.result.document.revision);
  assert.deepEqual(joined.accepted.bindings.map(row => row.binding), input.source.bindings);
  assert.equal(joined.gpuRequest.entries.length, 2);
  const refs = input.display.visibleGeometry;
  assert.equal(refs[0].surfaceId, refs[1].surfaceId); assert.notEqual(refs[0].modelId, refs[1].modelId);
  for (const entry of joined.gpuRequest.entries) {
    const row = joined.accepted.bindings.find(row => row.ref.modelId === entry.ref.modelId);
    const asset = input.source.result.document.assets.find(asset => asset.id === row.binding.assetId);
    const item = input.materials.find(item => item.ref.modelId === entry.ref.modelId);
    const motion = input.display.motion;
    const target = motion.bindings.find(binding => binding.ref.modelId === entry.ref.modelId).targetId;
    const pose = motion.frame.poses.find(pose => pose.targetId === target);
    assert.equal(entry.geometry.source, asset.source); assert.equal(entry.geometry.revision, 0);
    assert.notEqual(row.binding.assetRevision, 0); assert.equal(Object.keys(row.binding).length, 10);
    assert.equal(entry.geometry.countU, input.source.options.native.countU);
    assert.equal(entry.geometry.countV, input.source.options.native.countV);
    assert.equal(entry.material.source, item.source); assert.deepEqual(entry.uniforms, item.uniforms ?? {});
    assert.deepEqual(entry.transform, { translationMm: pose.translation, rotationXYZW: pose.rotation, scale: pose.scale });
  }
  assert.deepEqual(joined.gpuRequest.options, { mmToSceneUnit: input.context.mmToSceneUnit, translate: [0,0,0],
    background: input.context.background, camera: input.display.camera, lighting: input.lighting });
  assert.equal(Object.hasOwn(joined.originals.materials[0], 'uniforms'), false);
  assert.ok(Object.values(joined.originals.materials[1].uniforms).some(value => Object.is(value, -0)));
  const reordered = copy(input); reordered.materials.reverse();
  assert.equal(signed(m.candidate.prepareUV01Candidate(reordered, 2, null).gpuRequest), signed(joined.gpuRequest));
  // One actual final GPU CPU admission proves this consumer request is accepted by unchanged providers.
  const frame = m.gpu.prepareNativeSurfaceUV01Frame(joined.gpuRequest, dimensions.width, dimensions.height);
  assert.equal(frame.draws.length, 2);
  return { input, joined, counts: { prepareViewerNativeSceneAppearance: 1, prepareBaroCadDocumentPrimitiveNativeRefsV2: 1 } };
}

export async function runRefusalChecks(m) {
  const input = m.example.createSeedInput();
  for (const key of Object.keys(input.source.bindings[0])) {
    const stale = copy(input), value = stale.source.bindings[0][key];
    stale.source.bindings[0][key] = typeof value === 'number' ? value + 1 : value + '_stale';
    await assert.rejects(m.viewer.createNativeSurfaceUV01WebGPUViewer({}, stale, dimensions), error => err(error, 'SOURCE'));
  }
  assert.equal(m.state.calls.length, 0, 'All TEN refusals precede mount');
  for (const mutate of [
    value => value.materials.pop(),
    value => { value.materials[1].ref = copy(value.materials[0].ref); },
    value => { value.materials[1].ref.modelId = 'foreign'; },
    value => { value.display.visibleGeometry.pop(); },
  ]) { const value = copy(input); mutate(value); assert.throws(() => m.candidate.prepareUV01Candidate(value, 1, null), error => err(error, 'MATERIAL')); }
  const subset = copy(input); subset.display.visibleGeometry.pop(); subset.materials.pop();
  const reduced = m.candidate.prepareUV01Candidate(subset, 1, input.display.visibleGeometry[1]);
  assert.equal(reduced.accepted.bindings.length, 2); assert.equal(reduced.gpuRequest.entries.length, 1); assert.equal(reduced.selected, null);
  for (const mutate of [value => { value.source.options.native.countU = 18; }, value => { value.source.options.native.unitsPerMillimeter = 2; },
    value => { value.display.motion.frame.poses[1].scale = [0,1,1]; }, value => { value.source.result.document.assets[0].source += 'different'; }]) {
    const value = copy(input); mutate(value); assert.throws(() => m.candidate.prepareUV01Candidate(value, 1, null), error => err(error, 'SOURCE'));
  }
  const nullMaterial = copy(input); nullMaterial.materials[0] = null;
  await assert.rejects(m.viewer.createNativeSurfaceUV01WebGPUViewer({}, nullMaterial, dimensions), error => err(error, 'INPUT'));
  const invalid = copy(input); invalid.materials[0].source = '@shader broken';
  assert.throws(() => m.candidate.prepareUV01Candidate(invalid, 1, null), error => err(error, 'MATERIAL') && Array.isArray(error.cause));
  let getters = 0; const accessor = copy(input); Object.defineProperty(accessor, 'owner', { enumerable: true, get() { getters++; return input.owner; } });
  assert.throws(() => m.candidate.prepareUV01Candidate(accessor, 1, null), error => err(error, 'INPUT')); assert.equal(getters, 0);
  const proxy = new Proxy({}, { ownKeys() { throw undefined; } });
  assert.throws(() => m.candidate.prepareUV01Candidate(proxy, 1, null), error => err(error, 'INPUT') && Object.hasOwn(error, 'cause') && error.cause === undefined);
  const budget = copy(input); budget.materials = Array(5).fill(null);
  assert.throws(() => m.candidate.prepareUV01Candidate(budget, 1, null), error => err(error, 'BUDGET'));
  const noUniform = copy(input); noUniform.materials[0].uniforms = undefined;
  assert.throws(() => m.candidate.prepareUV01Candidate(noUniform, 1, null), error => err(error, 'INPUT'));
  const badUniform = copy(input); badUniform.materials[0].uniforms = { unexpected: 1 };
  await assert.rejects(m.viewer.createNativeSurfaceUV01WebGPUViewer({}, badUniform, dimensions), error => err(error, 'GPU'));
}

export async function runFacadeChecks(m) {
  const { viewer: api, state } = m, input = m.example.createSeedInput();
  const viewer = await api.createNativeSurfaceUV01WebGPUViewer({}, input, dimensions);
  const original = signed(viewer.originals), accepted = viewer.accepted, chosen = input.display.visibleGeometry[1];
  good(viewer.select(chosen)); frozen(viewer.originals);
  const transient=await api.createNativeSurfaceUV01WebGPUViewer({},input,dimensions);
  good(transient.select(chosen));
  const priorSelection=transient.selected;
  state.selectionLoss=true;
  bad(transient.select(null),'STATE');
  assert.deepEqual(transient.selected,priorSelection);
  assert.equal(transient.status.state,'lost');
  state.selectionLoss=false; transient.dispose();
 assert.notEqual(viewer.originals, viewer.originals);
  state.gate = deferred(); const next = copy(input); next.owner.revision++;
  const update = viewer.replace(next); next.materials[0].source = 'mutated after await';
  assert.equal(viewer.accepted, accepted); assert.equal(signed(viewer.originals), original);
  bad(await viewer.replace(input), 'BUSY'); bad(await viewer.resize(8, 8), 'BUSY'); bad(viewer.select(null), 'BUSY');
  await assert.rejects(viewer.pick(0, 0), error => err(error, 'BUSY'));
  await assert.rejects(viewer.readPixels(), error => err(error, 'BUSY'));
  state.gate.resolve(); good(await update); state.gate = null;
  assert.equal(viewer.accepted.generation, 2); assert.equal(viewer.originals.owner.revision, input.owner.revision + 1);
  assert.equal(viewer.originals.materials[0].source, input.materials[0].source); assert.deepEqual(viewer.selected, chosen);
  const second = viewer.accepted, secondOriginal = signed(viewer.originals), primary = { refusal: 'exact cause' };
  state.failure = primary; assert.equal(bad(await viewer.replace(input), 'GPU').cause, primary);
  assert.equal(viewer.accepted, second); assert.equal(signed(viewer.originals), secondOriginal);
  const stale = copy(input); stale.source.bindings[0].assetRevision++;
  bad(await viewer.replace(stale), 'SOURCE'); assert.equal(viewer.accepted, second);
  const picked = await viewer.pick(0, 0); assert.deepEqual(picked.ref, input.display.visibleGeometry[0]); assert.deepEqual(picked.binding, input.source.bindings[0]);
  state.picked = { generation: 2, ref: { modelId: chosen.modelId, geometryId: chosen.surfaceId } };
  assert.deepEqual((await viewer.pick(1, 1)).binding, input.source.bindings[1]);
  state.picked = { generation: 1, ref: null }; await assert.rejects(viewer.pick(0,0), error => err(error, 'STATE'));
  state.picked = { generation: 2, ref: { modelId: 'foreign', geometryId: chosen.surfaceId } }; await assert.rejects(viewer.pick(0,0), error => err(error, 'STATE'));
  state.picked = { generation: 2, ref: null }; assert.deepEqual(await viewer.pick(0,0), { generation: 2, ref: null, binding: null });
  state.picked = undefined; state.pickGate = deferred(); const pendingPick = viewer.pick(0,0);
  bad(await viewer.replace(input), 'BUSY'); state.pickGate.resolve(); await pendingPick; state.pickGate = null;
  good(await viewer.resize(8,8)); assert.equal(viewer.accepted.generation, 3); assert.equal((await viewer.readPixels()).length, 256);
  const subset = copy(input); subset.display.visibleGeometry.pop(); subset.materials.pop(); good(await viewer.replace(subset)); assert.equal(viewer.selected, null);
  state.gate = deferred(); const pending = viewer.replace(input), prior = viewer.accepted;
  viewer.dispose(); assert.equal(viewer.status.state, 'disposed'); assert.equal(viewer.selected, null);
  state.gate.resolve(); bad(await pending, 'DISPOSED'); state.gate = null; assert.equal(viewer.accepted, prior);
  viewer.dispose(); bad(await viewer.replace(input), 'DISPOSED');
  const lost = await api.createNativeSurfaceUV01WebGPUViewer({}, input, dimensions);
  state.gate = deferred(); const reading = lost.readPixels(); state.instances.at(-1).setPhase('lost'); state.gate.resolve();
  await assert.rejects(reading, error => err(error, 'STATE')); state.gate = null;
  bad(await lost.replace(input), 'STATE'); assert.equal(lost.status.state, 'lost'); lost.dispose();
  for (const method of ['replace', 'resize']) {
    const terminal = await api.createNativeSurfaceUV01WebGPUViewer({}, input, dimensions);
    const cause = { terminal: method, cleanup: ['retained'] };
    state.failure = cause; state.failurePhase = 'failed';
    const result = method === 'replace' ? await terminal.replace(input) : await terminal.resize(8,8);
    assert.equal(bad(result, 'GPU').cause, cause); assert.equal(terminal.accepted.generation, 1);
    assert.equal(terminal.status.state, 'failed'); terminal.dispose(); state.failurePhase = null;
  }
  state.mountPhase = 'lost';
  await assert.rejects(api.createNativeSurfaceUV01WebGPUViewer({}, input, dimensions), error => err(error, 'STATE'));
  assert.equal(state.instances.at(-1).status.state, 'disposed'); state.mountPhase = 'ready';
  return state.calls.map(call => call[0]);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  test('genuine original two-Surface source/TEN/material seam', async () => runJoinChecks(await loadModules()));
  test('ten stale pins and strict material/own-data refusals', async () => runRefusalChecks(await loadModules()));
  test('controlled awaited facade, refusal retention and disposal', async () => runFacadeChecks(await loadModules()));
}

export async function runExampleChecks(m) {
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM(await readFile(resolve(root, 'examples/viewer-native-surface-uv01/index.html'), 'utf8'));
  const rootElement = dom.window.document.body, element = id => dom.window.document.getElementById(id);
  try {
    const first = m.example.setupExample(rootElement);
    m.state.mountGate = deferred(); const mounting = first.start(); first.dispose();
    m.state.mountGate.resolve(); await mounting; m.state.mountGate = null;
    assert.equal(first.state.accepted, null); assert.equal(first.state.closed, true);
    assert.equal(m.state.instances.at(-1).status.state, 'disposed');
    const second = m.example.setupExample(rootElement); await second.start();
    const before = m.state.instances.at(-1).originals.entries[0].material.source;
    await second.apply();
    assert.equal(m.state.instances.at(-1).originals.entries[0].material.source, before, 'Untouched CRLF source retained');
    const accepted = second.state.accepted;
    element('material-source').value = '@shader invalid';
    await assert.rejects(second.apply()); assert.equal(second.state.accepted, accepted);
    assert.equal(element('material-source').value, '@shader invalid'); assert.notEqual(element('error').textContent, '');
    element('material-source').value = before.replace('surface_u01', 'surface_v01');
    await second.apply(); assert.equal(second.state.accepted.owner.revision, 2);
    assert.equal(second.state.accepted.document.revision, 5);
    assert.deepEqual(second.state.accepted.bindings, accepted.bindings);
    const pick = await second.pick(0,0); assert.deepEqual(second.state.selected, pick.ref);
    const mounts = m.state.calls.filter(call => call[0] === 'mount').length;
    second.dispose(); element('start').dispatchEvent(new dom.window.Event('click'));
    await Promise.resolve(); assert.equal(m.state.calls.filter(call => call[0] === 'mount').length, mounts);
  } finally { dom.window.close(); }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  test('small example Apply and late initial mount cleanup', async () => runExampleChecks(await loadModules()));
}
