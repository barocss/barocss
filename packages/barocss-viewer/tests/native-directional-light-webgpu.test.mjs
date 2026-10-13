/** #1580 software-only contract tests. CPU/source providers are real. The private
 * imported mount replacement and #1579 software platform never prove device pixels. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';
import { tmpdir } from 'node:os';
import { createSoftwarePlatform, deferred, reached, frozen, independent, signed, copy } from '../../barocss-gpu/tests/native-directional-light-webgpu-viewport.test.mjs';
export { signed, copy };
export const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
let serial = 0;
export async function loadModules(mode = 'source', mock = true, evidence) {
  const dir = mode === 'source' ? 'src' : 'dist', ext = mode === 'source' ? 'ts' : 'js';
  const key = `barocss1580-${++serial}`;
  const state = { calls: [], counts: {}, instances: [], mountGate: null, updateGate: null, pickGate: null, selectionLoss: false, readGate: null, nextFailure: null, mountFailure: null, mountPhase: null, disposeFailure: null, picked: undefined };
  globalThis[key] = state;
  const gpu = resolve(root, `packages/barocss-gpu/${dir}/index.${ext}`);
  const frame = resolve(root, `packages/barocss-gpu/${dir}/native-directional-light-webgpu-frame.${ext}`);
  const proxy = `export * from ${JSON.stringify(gpu)};
    import {prepareNativeDirectionalLightWebGPUFrame as prepare} from ${JSON.stringify(frame)};
    const h=globalThis[${JSON.stringify(key)}];
    export async function mountNativeDirectionalLightWebGPUViewport(canvas,input,options) {
      h.calls.push(['mount',input,options]); prepare(input,options.width,options.height);
      if(h.mountFailure) throw h.mountFailure;
      if(h.mountGate) await h.mountGate.promise;
      let raw=input, generation=1, selected=null, phase=h.mountPhase || 'ready', width=options.width,height=options.height;
      const instance={canvas,get originals(){return raw},get selected(){return selected},
        get status(){return {backend:'webgpu',profile:'qualified-surface-authored-directional-webgpu-v0',state:phase,generation,width,height,limits:{},resources:{}}},
        setPhase(value){phase=value},
        async updateFrame(input){h.calls.push(['update',input]);try{prepare(input,width,height);if(h.updateGate)await h.updateGate.promise;if(h.nextFailure){const error=h.nextFailure;h.nextFailure=null;return {ok:false,error}}raw=input;generation++;return {ok:true}}catch(error){return {ok:false,error}}},
        async resize(w,t){h.calls.push(['resize',w,t]);try{prepare(raw,w,t);if(h.updateGate)await h.updateGate.promise;if(h.nextFailure){const error=h.nextFailure;h.nextFailure=null;return {ok:false,error}}width=w;height=t;generation++;return {ok:true}}catch(error){return {ok:false,error}}},
        async readPixels(){h.calls.push(['read']);if(h.readGate)await h.readGate.promise;return new Uint8Array(width*height*4)},
        async pick(x,y){h.calls.push(['pick',x,y]);if(h.pickGate)await h.pickGate.promise;return h.picked===undefined?{generation,ref:raw.frame.scene.entries[0].ref}:h.picked},
        select(ref){h.calls.push(['select',ref]);selected=ref;if(h.selectionLoss)phase='lost';return {ok:true}},
        dispose(){h.calls.push(['dispose']);phase='disposed';if(h.disposeFailure)throw h.disposeFailure}
      };h.instances.push(instance);return instance;
    }`;
  const plugin = { name: 'private-contract-boundaries', setup(b) {
    b.onResolve({ filter: /^@barocss\// }, args => {
      const [name, ...rest] = args.path.slice('@barocss/'.length).split('/');
      if (name === 'gpu' && !rest.length && mock) return { path: 'gpu-private', namespace: 'test' };
      return { path: resolve(root, `packages/barocss-${name}/${dir}/${rest.join('/') || 'index'}.${ext}`) };
    });
    b.onResolve({ filter: /packages\/barocss-(viewer|gpu|cad-interop)\/src\/.+\.js$/ }, args => {
      const match = args.path.match(/packages\/barocss-(viewer|gpu|cad-interop)\/src\/(.+)\.js$/);
      return { path: resolve(root, `packages/barocss-${match[1]}/${dir}/${match[2]}.${ext}`) };
    });
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: proxy, loader: 'js', resolveDir: root }));
    b.onLoad({ filter: /\.(ts|js)$/ }, async args => {
      if (!args.path.includes('/packages/barocss-')) return;
      let contents = await readFile(args.path, 'utf8');
      for (const name of ['prepareViewerNativeSceneAppearance', 'prepareBaroCadDocumentPrimitiveNativeRefsV2', 'preparePrimitiveSceneFrame', 'prepareNativeDirectionalLightProgramWGSL']) {
        contents = contents.replace(new RegExp(`(function ${name}\\([^{}]*?\\)[^{]*\\{)`,'g'), `$1 globalThis[${JSON.stringify(key)}].counts.${name}=(globalThis[${JSON.stringify(key)}].counts.${name}||0)+1;`);
      }
      return { contents, loader: args.path.endsWith('.ts') ? 'ts' : 'js' };
    });
  } };
  const contents = `export * as viewer from './packages/barocss-viewer/${dir}/index.${ext}';
    export * as candidate from './packages/barocss-viewer/${dir}/native-directional-light-candidate.${ext}';
    export * as example from './examples/viewer-native-directional-lights/controller.ts';
    export * as gpu from './packages/barocss-gpu/${dir}/index.${ext}';
    export * as interop from './packages/barocss-cad-interop/${dir}/document.${ext}';`;
  const result = await build({ stdin: { contents, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, plugins: [plugin] });
  if (evidence) { await mkdir(evidence, { recursive: true }); await writeFile(resolve(evidence, `${mode}-${mock ? 'mock' : 'platform'}-graph.json`), JSON.stringify(result.metafile, null, 2)); }
  const bundleDir = evidence ?? await mkdtemp(resolve(tmpdir(), 'barocss1580-'));
  const bundle = resolve(bundleDir, `${mode}-${mock ? 'mock' : 'platform'}-${serial}.mjs`);
  await writeFile(bundle, result.outputFiles[0].text);
  const modules = await import(pathToFileURL(bundle).href);
  return { ...modules, state, mode };
}
const err = (error, code) => { assert.equal(error.name, 'ViewerNativeDirectionalLightError'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024); return true; };
const failed = (result, code) => { assert.equal(result.ok, false); err(result.error, code); return result.error; };
const good = result => assert.deepEqual(result, { ok: true });
const dimensions = { width: 16, height: 8 };

export async function runPreparationChecks(m) {
  const { candidate, example, state, interop } = m;
  const input = example.createSeedInput(), untouched = signed(input);
  state.counts = {};
  const prepared = candidate.prepareLightCandidate(input, 1, null);
  assert.equal(state.counts.prepareViewerNativeSceneAppearance, 1);
  assert.equal(state.counts.prepareBaroCadDocumentPrimitiveNativeRefsV2, 1);
  assert.equal(state.counts.preparePrimitiveSceneFrame, 1);
  const providerCounts = { ...state.counts };
  assert.equal(signed(input), untouched); assert.equal(Object.isFrozen(input), false);
  frozen(prepared.originals); frozen(prepared.accepted); independent(input, prepared.originals);
  assert.deepEqual(Object.keys(prepared.accepted).sort(), ['owner','document','inventory','visibleGeometry','bindings','generation'].sort());
  assert.equal(prepared.accepted.document.revision, 5); assert.ok(Object.is(prepared.accepted.owner.revision, -0));
  const refs = input.display.visibleGeometry;
  assert.equal(refs[0].surfaceId, refs[1].surfaceId); assert.notEqual(refs[0].modelId, refs[1].modelId);
  const entries = interop.prepareBaroCadDocumentPrimitiveNativeRefsV2(input.source.result, input.source.options);
  assert.deepEqual(prepared.accepted.bindings.map(row => row.binding), entries.map(entry => entry.binding));
  for (let i = 0; i < entries.length; i++) {
    assert.equal(Object.keys(prepared.accepted.bindings[i].binding).length, 10);
    assert.deepEqual(prepared.gpuRequest.frame.scene.entries[i].packet, entries[i].packet);
    assert.deepEqual(prepared.gpuRequest.frame.scene.entries[i].transform.translationMm, input.display.motion.frame.poses[i].translation);
  }
  assert.equal(Object.hasOwn(prepared.gpuRequest.frame.options, 'lighting'), false);
  assert.deepEqual(Object.keys(prepared.gpuRequest.frame.options).sort(), ['mmToSceneUnit','translate','background','camera'].sort());
  assert.deepEqual(prepared.gpuRequest.frame.options.translate, [0,0,0]);
  assert.deepEqual(prepared.gpuRequest.frame.options.camera, input.display.camera);
  assert.deepEqual(prepared.gpuRequest.frame.options.background, input.context.background);
  assert.deepEqual(prepared.gpuRequest.frame.materials[0].binding.uniforms, {});
  assert.ok(Object.is(prepared.gpuRequest.frame.materials[1].binding.uniforms.amount, -0));
  assert.equal(signed(prepared.gpuRequest.lights), signed(input.lights));
  const subset = copy(input); subset.display.visibleGeometry = [refs[1]]; subset.materials = [subset.materials[1]];
  state.counts = {}; const one = candidate.prepareLightCandidate(subset, 2, refs[1]);
  assert.equal(one.accepted.inventory.length, 2); assert.equal(one.gpuRequest.frame.scene.entries.length, 1);
  assert.equal(state.counts.prepareViewerNativeSceneAppearance, 1); assert.equal(state.counts.preparePrimitiveSceneFrame, 2);
  const subsetCounts = { ...state.counts };
  const reject = (edit, code) => { const bad = copy(input); edit(bad); assert.throws(() => candidate.prepareLightCandidate(bad, 2, null), error => err(error, code)); };
  reject(x => { x.display.visibleGeometry = []; }, 'BUDGET');
  reject(x => { x.display.visibleGeometry[0].modelId = 'foreign'; }, 'SOURCE');
  reject(x => { x.source.bindings.pop(); }, 'SOURCE');
  reject(x => { x.source.bindings[0].assetRevision++; }, 'SOURCE');
  reject(x => { x.owner.revision = 0; }, 'OWNER');
  reject(x => { x.owner.id = 'different'; }, 'OWNER');
  reject(x => { x.appearance = {}; }, 'INPUT');
  reject(x => { x.display.visibleGeometry = [x.display.visibleGeometry[0]]; }, 'SOURCE');
  reject(x => { x.display.visibleGeometry = [x.display.visibleGeometry[0]]; x.materials.pop(); x.display.motion.frame.poses[1].scale = [0,1,1]; }, 'SOURCE');
  reject(x => { x.materials[0].binding.uniforms.unknown = 1; }, 'SOURCE');
  reject(x => { x.source.result.document.assets[0].source += ' invalid'; }, 'SOURCE');
  let getters = 0; const accessor = copy(input); Object.defineProperty(accessor.owner, 'id', { enumerable: true, get() { getters++; return 'bad'; } });
  assert.throws(() => candidate.prepareLightCandidate(accessor, 1, null), error => err(error, 'INPUT')); assert.equal(getters, 0);
  for (const thrown of [undefined, new Error('raw reflection')]) {
    const proxy = new Proxy({}, { getPrototypeOf() { throw thrown; } });
    assert.throws(() => candidate.prepareLightCandidate(proxy, 1, null), error => { err(error,'INPUT'); assert.ok(Object.hasOwn(error,'cause')); assert.equal(error.cause,thrown); return true; });
  }
  assert.throws(() => candidate.prepareLightCandidate(vm.runInNewContext('({})'),1,null), error => err(error,'INPUT'));
  const cyclic = {}; cyclic.self = cyclic; assert.throws(() => candidate.copyOwn(cyclic), error => err(error,'INPUT'));
  assert.throws(() => candidate.copyOwn({ value: 'a'.repeat(262145) }), error => err(error,'BUDGET'));
  assert.throws(() => candidate.copyOwn({ a: Array(4097).fill(0) }), error => err(error,'BUDGET'));
  assert.throws(() => candidate.copyOwn(Object.fromEntries(Array.from({length:65},(_,i)=>['k'+i,0]))), error => err(error,'BUDGET'));
  for (const path of ['materials','lights','visible','bindings']) {
    const wide = copy(input); let enumerated = false; const array = new Proxy(Array(5).fill(0), { ownKeys() { enumerated = true; throw new Error('elements visited'); } });
    if(path==='materials') wide.materials=array; if(path==='lights') wide.lights.lights=array;
    if(path==='visible') wide.display.visibleGeometry=array; if(path==='bindings') wide.source.bindings=array;
    assert.throws(()=>candidate.prepareLightCandidate(wide,1,null),error=>err(error,'BUDGET')); assert.equal(enumerated,false);
  }
  // Real document reconstruction covers the accepted endpoints and hidden Curve refusal.
  for (const count of [1,4]) {
    const document=copy(input.source.result.document);
    document.assets=Array.from({length:count},(_,i)=>({...copy(document.assets[i%2]),id:'asset_'+i}));
    document.bodies=Array.from({length:count},(_,i)=>({...copy(document.bodies[i%2]),id:'body_'+i,assetId:'asset_'+i}));
    const result=interop.parseBaroCadDocument(signed(document)), options=copy(input.source.options);
    const entries=interop.prepareBaroCadDocumentPrimitiveNativeRefsV2(result,options);
    const endpoint=copy(input); endpoint.source={kind:'document',result,options,bindings:entries.map(e=>e.binding)};
    endpoint.display.motion=null; endpoint.display.visibleGeometry=entries.map(e=>({kind:'surface',modelId:e.ref.modelId,surfaceId:e.ref.geometryId}));endpoint.materials=[];
    assert.equal(candidate.prepareLightCandidate(endpoint,1,null).accepted.inventory.length,count);
  }
  const curveDoc=copy(input.source.result.document);
  curveDoc.assets[0].source=curveDoc.assets[0].source.replace('@surface #shared_patch', '@curve #hidden_curve { type:nurbs; degree:1; knots:[0,0,1,1]; control-points:[[0,0,0],[1,1,1]]; weights:[1,1]; } @surface #shared_patch');
  curveDoc.bodies.push({id:'hidden_body',name:'Hidden Curve',kind:'direct-geometry-object',assetId:curveDoc.assets[0].id,geometryId:'hidden_curve'});
  const curveInput=copy(input);curveInput.source.result=interop.parseBaroCadDocument(signed(curveDoc));
  curveInput.source.options.native.curveDisplay={chordToleranceMM:.1,maxSegments:16,maxDepth:4};
  curveInput.source.bindings=interop.prepareBaroCadDocumentPrimitiveNativeRefsV2(curveInput.source.result,curveInput.source.options).map(e=>e.binding);
  curveInput.display.motion=null;
  assert.throws(()=>candidate.prepareLightCandidate(curveInput,1,null),error=>err(error,'SOURCE'));
  const saved = example.encodeComposition(input), reopened = example.decodeComposition(saved);
  assert.ok(saved.includes('"revision":-0')); assert.equal(signed(reopened), signed(input));
  assert.deepEqual(candidate.prepareLightCandidate(reopened,1,null).gpuRequest, prepared.gpuRequest);
  assert.equal(Object.hasOwn(JSON.parse(saved),'gpuRequest'), false);
  return { providerCounts, subsetCounts, input, saved, expected: prepared.gpuRequest };
}

export async function runFacadeChecks(m) {
  const { viewer, example, state } = m, input = example.createSeedInput();
  let v = await viewer.createNativeDirectionalLightWebGPUViewer({}, input, dimensions);
  assert.equal(v.accepted.generation,1); frozen(v.originals); independent(v.originals,v.originals);
  good(v.select(input.display.visibleGeometry[1])); assert.equal(state.calls.at(-1)[1].modelId,input.display.visibleGeometry[1].modelId);
  state.selectionLoss=true;
  const priorSelection=v.selected;
  failed(v.select(null),'STATE');
  assert.deepEqual(v.selected,priorSelection);
  state.selectionLoss=false; v.dispose();
  v=await viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions);

  let reentrant;
  const observed=new Proxy(copy(input),{getPrototypeOf(target){reentrant=v.select(null);return Object.getPrototypeOf(target)}});
  good(await v.replace(observed)); failed(reentrant,'BUSY'); v.dispose(); v=await viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions); good(v.select(input.display.visibleGeometry[1]));
  const before = v.accepted, oldOriginals = signed(v.originals), update = copy(input);
  update.owner.revision=1; update.lights.revision=1; update.lights.lights.reverse();
  state.updateGate=deferred(); const pending=v.replace(update);
  update.lights.lights[0].label='caller mutation'; assert.equal(v.accepted,before); assert.equal(signed(v.originals),oldOriginals);
  failed(await v.replace(input),'BUSY'); failed(await v.resize(8,8),'BUSY'); failed(v.select(null),'BUSY');
  await assert.rejects(v.pick(0,0),error=>err(error,'BUSY')); await assert.rejects(v.readPixels(),error=>err(error,'BUSY'));
  assert.equal(v.accepted,before); failed(v.select(null),'BUSY');
  const freeze = Object.freeze;
  // No post-presentation copy/freezing is allowed in the success commit section.
  Object.freeze = () => { throw new Error('post-presentation freeze'); };
  try { state.updateGate.resolve(); good(await pending); } finally { Object.freeze=freeze; state.updateGate=null; }
  assert.equal(v.accepted.generation,2); assert.equal(v.originals.lights.lights[0].label,'Blue +Z');
  assert.deepEqual(v.selected,input.display.visibleGeometry[1]);
  const accepted=v.accepted;
  const bad=copy(input); bad.owner.id='wrong'; failed(await v.replace(bad),'OWNER'); assert.equal(v.accepted,accepted);
  const cause=new Error('backend cause'); cause.code='RENDER'; cause.spans=[{line:3}]; state.nextFailure=cause;
  const refused=failed(await v.replace(input),'GPU'); assert.equal(refused.cause,cause); assert.equal(refused.message,cause.message); assert.equal(v.accepted,accepted);
  state.nextFailure=cause; failed(await v.resize(9,9),'GPU'); assert.equal(v.accepted,accepted);
  good(await v.resize(9,9)); assert.equal(v.accepted.generation,3);
  assert.equal((await v.readPixels()).length,9*9*4);
  const picked=await v.pick(0,0); assert.equal(picked.ref.modelId,input.display.visibleGeometry[0].modelId); assert.equal(Object.keys(picked.binding).length,10);
  state.picked={generation:3,ref:null}; assert.deepEqual(await v.pick(0,0),{generation:3,ref:null,binding:null});
  state.picked={generation:2,ref:null}; await assert.rejects(v.pick(0,0),error=>err(error,'STATE'));
  state.picked={generation:3,ref:{modelId:'unknown',geometryId:'shared_patch'}}; await assert.rejects(v.pick(0,0),error=>err(error,'STATE'));
  state.picked=undefined; state.pickGate=deferred(); const pickPending=v.pick(0,0); failed(await v.replace(input),'BUSY'); state.pickGate.resolve(); await pickPending; state.pickGate=null;
  const hide=copy(input); hide.display.visibleGeometry=[hide.display.visibleGeometry[0]]; hide.materials=[hide.materials[0]];
  good(await v.replace(hide)); assert.equal(v.selected,null);
  for(const count of [0,4]) { const lights=copy(input); lights.lights.lights=Array.from({length:count},(_,i)=>({...copy(input.lights.lights[0]),nodeId:'node'+i,enabled:i%2===0})); good(await v.replace(lights)); }
  const f32=copy(input); f32.lights.lights[0].intensity=1e-50; const f32Result=await v.replace(f32); failed(f32Result,'GPU');
  // A completed backend promise must not adopt candidate metadata after device loss.
  const stable=v.accepted;
  state.updateGate=deferred(); const interrupted=v.replace(input);
  state.instances.at(-1).setPhase('lost'); state.updateGate.resolve();
  failed(await interrupted,'STATE'); state.updateGate=null; assert.equal(v.accepted,stable);
  failed(await v.replace(input),'STATE');
  v.dispose(); assert.equal(v.status.state,'disposed');
  v=await viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions);
  // Device loss during readback or a pick must reject the stale asynchronous result.
  state.readGate=deferred(); const interruptedRead=v.readPixels();
  state.instances.at(-1).setPhase('lost'); state.readGate.resolve();
  await assert.rejects(interruptedRead,error=>err(error,'STATE')); state.readGate=null;
  v.dispose();
  v=await viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions);
  state.pickGate=deferred(); const interruptedPick=v.pick(0,0);
  state.instances.at(-1).setPhase('lost'); state.pickGate.resolve();
  await assert.rejects(interruptedPick,error=>err(error,'STATE')); state.pickGate=null;
  v.dispose();
  v=await viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions);
  const stableResize=v.accepted;
  state.updateGate=deferred(); const interruptedResize=v.resize(11,11);
  state.instances.at(-1).setPhase('lost'); state.updateGate.resolve();
  failed(await interruptedResize,'STATE'); state.updateGate=null; assert.equal(v.accepted,stableResize);
  failed(await v.replace(input),'STATE');
  v.dispose(); assert.equal(v.selected,null); assert.equal(v.status.state,'disposed'); failed(await v.replace(input),'DISPOSED'); v.dispose();
  v=await viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions); const retained=v.accepted;
  state.updateGate=deferred(); const late=v.replace(input); v.dispose(); state.updateGate.resolve(); failed(await late,'DISPOSED'); state.updateGate=null; assert.equal(v.accepted,retained); assert.equal(v.selected,null);
  // A mount resolving in a lost state must not expose a live facade.
  state.mountPhase='lost';
  try {
    await assert.rejects(viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions),
      error=>err(error,'STATE'));
    assert.equal(state.instances.at(-1).status.state,'disposed');
  } finally { state.mountPhase=null; }
  // Constructor failure after successful mount must dispose the newly owned backend.
  state.mountGate=deferred(); const mounting=viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions);
  Object.freeze=()=>{throw new Error('factory freeze')};
  try { state.mountGate.resolve(); await assert.rejects(mounting,/factory freeze/); } finally { Object.freeze=freeze; state.mountGate=null; }
  assert.equal(state.instances.at(-1).status.state,'disposed');
  const cleanup=new Error('factory cleanup');state.disposeFailure=cleanup;state.mountGate=deferred();
  const combined=viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions), primary=new Error('factory construction');
  Object.freeze=()=>{throw primary};
  try { state.mountGate.resolve(); await assert.rejects(combined,error=>{err(error,'GPU');assert.ok(error.cause instanceof AggregateError);assert.deepEqual(error.cause.errors,[primary,cleanup]);return true;}); }
  finally { Object.freeze=freeze;state.mountGate=null;state.disposeFailure=null; }
  state.mountFailure=cause;await assert.rejects(viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions),error=>{err(error,'GPU');assert.equal(error.cause,cause);return true;});state.mountFailure=null;
  v=await viewer.createNativeDirectionalLightWebGPUViewer({},input,dimensions);state.readGate=deferred();const reading=v.readPixels();v.dispose();state.readGate.resolve();await assert.rejects(reading,error=>err(error,'DISPOSED'));state.readGate=null;
  return { calls: state.calls.map(call=>call[0]), counts: {...state.counts} };
}

export async function runControllerChecks(m) {
  const { example,state }=m, input=example.createSeedInput();
  const c=example.createLightEditorController({},dimensions); await c.start(input);
  const before=c.save(); c.edit('red-key',{label:'Draft red',enabled:false}); assert.equal(c.save(),before);
  good({ok:true}); await c.apply(); assert.equal(c.state.accepted.owner.revision,1); assert.equal(c.state.accepted.document.revision,5);
  const saved=c.save(); assert.equal(JSON.parse(saved).lights.lights[0].label,'Draft red');
  c.ambient(2); await assert.rejects(c.apply()); assert.equal(c.save(),saved); assert.equal(c.state.draft.ambientStrength,2); c.ambient(.2);
  const failedDraft=signed(c.state.draft); state.nextFailure=new Error('controller refused'); await assert.rejects(c.apply()); assert.equal(c.save(),saved); assert.equal(signed(c.state.draft),failedDraft);
  await assert.rejects(c.openText('{"bad":1}')); assert.equal(c.save(),saved); assert.equal(signed(c.state.draft),failedDraft);
  let read=0; await assert.rejects(c.open({size:4194305,async text(){read++;return saved}})); assert.equal(read,0);
  await c.openText(before); assert.ok(Object.is(c.state.accepted.owner.revision,-0));
  c.edit('blue-fill',{intensity:.3}); await c.apply(); const second=c.save(); assert.equal(JSON.parse(second).owner.revision,1);
  assert.equal(JSON.parse(second).document.revision,5); assert.ok(Object.is(JSON.parse(second).materials[1].uniforms.amount,-0));
  const ids=[c.add(),c.add()]; assert.notEqual(ids[0],ids[1]); assert.throws(()=>c.add());
  for(const light of c.state.draft.lights) c.remove(light.nodeId); await c.apply(); assert.equal(JSON.parse(c.save()).lights.lights.length,0);
  await c.resize(12,6); await c.pick(0,0); c.selectSurface(null); c.dispose(); c.dispose(); assert.equal(c.state.closed,true);
  state.mountGate=deferred(); const late=example.createLightEditorController({},dimensions); const starting=late.start(input); late.dispose(); state.mountGate.resolve(); await starting; state.mountGate=null;
  assert.equal(state.instances.at(-1).status.state,'disposed'); assert.equal(late.state.accepted,null);
  return { second };
}

export async function runSoftwarePlatformChecks(m) {
  const input=m.example.createSeedInput(), h=createSoftwarePlatform(); let v;
  try {
    m.state.counts={};v=await m.viewer.createNativeDirectionalLightWebGPUViewer(h.canvas,input,dimensions);
    const mountProviderCounts={...m.state.counts};
    assert.equal(mountProviderCounts.prepareViewerNativeSceneAppearance,1);assert.equal(mountProviderCounts.prepareBaroCadDocumentPrimitiveNativeRefsV2,1);
    assert.equal(mountProviderCounts.preparePrimitiveSceneFrame,2);assert.equal(mountProviderCounts.prepareNativeDirectionalLightProgramWGSL,2);
    assert.equal(h.records.adapterRequests.length,1); assert.equal(h.records.passes[0].draws.length,2);
    const pick=await v.pick(1,0); assert.equal(pick.ref.modelId,input.display.visibleGeometry[1].modelId);
    assert.equal((await v.readPixels()).length,16*8*4);
    const before=v.accepted; const cause=h.failNext('createBuffer'); failed(await v.replace(input),'GPU'); assert.equal(v.accepted,before);
    good(await v.resize(12,6)); assert.equal(v.accepted.generation,2);
    const gate=h.gateNext('workDone'); const pending=v.replace(input); await reached(h,'workDone',h.calls.get('workDone')-1); v.dispose(); gate.resolve(); failed(await pending,'DISPOSED');
    assert.equal(v.status.state,'disposed'); h.assertReleased();
    const lostPlatform=createSoftwarePlatform();let lostViewer;
    try {
      lostViewer=await m.viewer.createNativeDirectionalLightWebGPUViewer(lostPlatform.canvas,input,dimensions);
      const retained=lostViewer.accepted;lostPlatform.lost.resolve({reason:'destroyed',message:'software device loss'});
      await Promise.resolve();await Promise.resolve();assert.equal(lostViewer.status.state,'lost');
      failed(await lostViewer.replace(input),'STATE');assert.equal(lostViewer.accepted,retained);
      lostViewer.dispose();lostPlatform.assertReleased();
    } finally {if(lostViewer && lostViewer.status.state!=='disposed')lostViewer.dispose();lostPlatform.restore();}
    return { softwareOnly:true, adapterRequests:h.records.adapterRequests.length, submissions:h.records.submissions.length, cause: cause.message, mountProviderCounts, deviceLoss:'software-only retained metadata, actual lost status' };
  } finally { if(v && v.status.state!=='disposed')v.dispose();h.restore(); }
}
export async function runDomChecks(m) {
  const {JSDOM}=await import('jsdom');
  const domDir=await mkdtemp(resolve(tmpdir(),'barocss1580-dom-'));
  const previous=Object.fromEntries(['document','window','Option','__exampleDOM'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  const savedError=console.error,savedCreate=URL.createObjectURL,savedRevoke=URL.revokeObjectURL;
  try {
const code=(await build({entryPoints:[root+'/examples/viewer-native-directional-lights/app.ts'],bundle:true,platform:'node',format:'esm',write:false,
 plugins:[{name:'private-dom-controller-reference',setup(b){b.onResolve({filter:/^\.\/controller\.js$/},()=>({path:'controller',namespace:'private'}));b.onLoad({filter:/.*/,namespace:'private'},()=>({contents:'export const createLightEditorController=(...args)=>globalThis.__exampleDOM.create(...args);'}));}}]})).outputFiles[0].text;
const dom=new JSDOM(await readFile(root+'/examples/viewer-native-directional-lights/index.html','utf8'),{url:'http://127.0.0.1:4180/'});
globalThis.document=dom.window.document;globalThis.window=dom.window;globalThis.Option=dom.window.Option;
const diagnostics=[];const originalError=console.error;console.error=error=>diagnostics.push(error);
const created=[],revoked=[];
const originalCreate=URL.createObjectURL,originalRevoke=URL.revokeObjectURL;
URL.createObjectURL=blob=>{assert.ok(blob.size>0);created.push(blob);return 'blob:example-'+created.length;};URL.revokeObjectURL=url=>revoked.push(url);
let downloaded=0;dom.window.HTMLAnchorElement.prototype.click=function(){assert.equal(this.download,'native-directional-lights.json');downloaded++;};
let controller;
globalThis.__exampleDOM={create(...args){controller=m.example.createLightEditorController(...args);return controller;}};
const el=id=>document.getElementById(id);
const fire=(id,type='click')=>el(id).dispatchEvent(new dom.window.Event(type,{bubbles:true}));
const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
for(let setup=0;setup<2;setup++){
 await writeFile(resolve(domDir,'app-'+setup+'.mjs'),code);await import(pathToFileURL(resolve(domDir,'app-'+setup+'.mjs')).href);
 const mounts=m.state.calls.filter(c=>c[0]==='mount').length;
 assert.equal(el('apply').disabled,true);fire('start');await settle();
 assert.equal(m.state.calls.filter(c=>c[0]==='mount').length,mounts+1);
 assert.equal(el('lights').options.length,2);assert.equal(el('apply').disabled,false);
 el('label').value='DOM edited';fire('label','change');assert.equal(controller.state.draft.lights[0].label,'DOM edited');
 fire('apply');await settle();assert.equal(controller.state.accepted.owner.revision,1);
 el('intensity').value='';fire('intensity','change');assert.match(el('error').textContent,/finite decimal/);
 fire('save');await settle();assert.equal(downloaded,setup+1);
 const generation=controller.state.accepted.generation;
 el('width').value='640';el('height').value='480';fire('resize');await settle();assert.equal(controller.state.accepted.generation,generation+1);
 const disposals=m.state.calls.filter(c=>c[0]==='dispose').length;
 fire('dispose');await settle();assert.equal(controller.state.closed,true);
 assert.equal(m.state.calls.filter(c=>c[0]==='dispose').length,disposals+1);
 fire('start');dom.window.dispatchEvent(new dom.window.Event('pagehide'));await settle();
 assert.equal(m.state.calls.filter(c=>c[0]==='mount').length,mounts+1);
 assert.equal(m.state.calls.filter(c=>c[0]==='dispose').length,disposals+1);
}
assert.equal(created.length,2);assert.equal(revoked.length,2);
const c=m.example.createLightEditorController({}, {width:8,height:8});let notified=0;const notifyCause=new Error('subscriber failure');
c.subscribe(()=>{notified++;throw notifyCause;});await c.start();assert.equal(c.state.pending,false);assert.ok(c.state.accepted);assert.ok(c.state.error instanceof AggregateError);
const cleanupCause=new Error('cleanup failure');m.state.disposeFailure=cleanupCause;assert.throws(()=>c.dispose(),error=>error.cause===cleanupCause);
const count=notified;c.dispose();assert.equal(notified,count);assert.equal(c.state.closed,true);assert.equal(c.state.accepted,null);
assert.ok(c.state.error instanceof AggregateError);assert.ok(c.state.error.errors.some(error=>error.cause===cleanupCause));m.state.disposeFailure=null;
const d=m.example.createLightEditorController({}, {width:8,height:8});await d.start();const text=d.save();
let resolveText;const read=new Promise(resolve=>resolveText=resolve);const before=m.state.calls.filter(c=>c[0]==='update').length;
const pending=d.open({size:text.length,text:()=>read});d.dispose();resolveText(text);await assert.rejects(pending,/disposed/);
assert.equal(m.state.calls.filter(c=>c[0]==='update').length,before);
console.error=originalError;assert.equal(diagnostics.length,2);URL.createObjectURL=originalCreate;URL.revokeObjectURL=originalRevoke;dom.window.close();

  return {softwareOnly:true,domSetups:2,downloadHandlers:downloaded,revokedURLs:revoked.length,subscriberFailureRetained:true,cleanupFailureRetained:true,disposedFileReadNoReplacement:true};
  } finally {
    console.error=savedError;URL.createObjectURL=savedCreate;URL.revokeObjectURL=savedRevoke;
    for(const [key,descriptor] of Object.entries(previous)){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
  }
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert.equal(Number(process.versions.node.split('.')[0]),22,'Use Node22');
  const m=await loadModules('source');
  test('real original-document/TEN/raw preparation and bounded own-data admission',()=>runPreparationChecks(m));
  test('private GPU import: async transaction, full-pair picking, retention and lifecycle',()=>runFacadeChecks(m));
  test('example draft/file/re-edit and late initial mount disposal',()=>runControllerChecks(m));
  test('example DOM wiring repeats without duplicate listeners and retains cleanup errors',()=>runDomChecks(m));
  test('actual Viewer/GPU runtime on explicitly software-only platform',async()=>runSoftwarePlatformChecks(await loadModules('source',false)));
}
