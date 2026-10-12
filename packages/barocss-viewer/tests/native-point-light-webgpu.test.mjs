/** #1621 software-only contract tests. CPU/source providers are real. The private
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
  const key = `barocss1621-${++serial}`;
  const state = { calls: [], counts: {}, instances: [], mountGate: null, updateGate: null, pickGate: null, readGate: null, nextFailure: null, mountFailure: null, disposeFailure: null, picked: undefined };
  globalThis[key] = state;
  const gpu = resolve(root, 'packages/barocss-gpu/src/index.ts');
  const frame = resolve(root, 'packages/barocss-gpu/src/native-point-light-webgpu-frame.ts');
  const proxy = `export * from ${JSON.stringify(gpu)};
    import {prepareNativePointLightWebGPUFrame as prepare} from ${JSON.stringify(frame)};
    const h=globalThis[${JSON.stringify(key)}];
    export async function mountNativePointLightWebGPUViewport(canvas,input,options) {
      h.calls.push(['mount',input,options]); prepare(input,options.width,options.height);
      if(h.mountFailure) throw h.mountFailure;
      if(h.mountGate) await h.mountGate.promise;
      let raw=input, generation=1, selected=null, phase='ready', width=options.width,height=options.height;
      const instance={canvas,get originals(){return raw},get selected(){return selected},
        get status(){return {backend:'webgpu',profile:'qualified-surface-authored-point-webgpu-v0',state:phase,generation,width,height,limits:{},resources:{}}},
        setPhase(value){phase=value},
        async updateFrame(input){h.calls.push(['update',input]);try{prepare(input,width,height);if(h.updateGate)await h.updateGate.promise;if(h.nextFailure){const error=h.nextFailure;h.nextFailure=null;return {ok:false,error}}raw=input;generation++;return {ok:true}}catch(error){return {ok:false,error}}},
        async resize(w,t){h.calls.push(['resize',w,t]);try{prepare(raw,w,t);if(h.updateGate)await h.updateGate.promise;if(h.nextFailure){const error=h.nextFailure;h.nextFailure=null;return {ok:false,error}}width=w;height=t;generation++;return {ok:true}}catch(error){return {ok:false,error}}},
        async readPixels(){h.calls.push(['read']);if(h.readGate)await h.readGate.promise;return new Uint8Array(width*height*4)},
        async pick(x,y){h.calls.push(['pick',x,y]);if(h.pickGate)await h.pickGate.promise;return h.picked===undefined?{generation,ref:raw.frame.scene.entries[0].ref}:h.picked},
        select(ref){h.calls.push(['select',ref]);selected=ref;return {ok:true}},
        dispose(){h.calls.push(['dispose']);phase='disposed';if(h.disposeFailure)throw h.disposeFailure}
      };h.instances.push(instance);return instance;
    }`;
  const plugin = { name: 'private-contract-boundaries', setup(b) {
    b.onResolve({ filter: /^@barocss\// }, args => {
      const [name, ...rest] = args.path.slice('@barocss/'.length).split('/');
      if (name === 'gpu' && !rest.length && mock) return { path: 'gpu-private', namespace: 'test' };
      return { path: resolve(root, `packages/barocss-${name}/${name==='viewer'?dir:'src'}/${rest.join('/') || 'index'}.${name==='viewer'?ext:'ts'}`) };
    });
    b.onResolve({ filter: /packages\/barocss-(viewer|gpu|cad-interop)\/src\/.+\.js$/ }, args => {
      const match = args.path.match(/packages\/barocss-(viewer|gpu|cad-interop)\/src\/(.+)\.js$/);
      return { path: resolve(root, `packages/barocss-${match[1]}/${match[1]==='viewer'?dir:'src'}/${match[2]}.${match[1]==='viewer'?ext:'ts'}`) };
    });
    b.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: proxy, loader: 'js', resolveDir: root }));
    b.onLoad({ filter: /\.(ts|js)$/ }, async args => {
      if (!args.path.includes('/packages/barocss-')) return;
      let contents = await readFile(args.path, 'utf8');
      for (const name of ['prepareViewerNativeSceneAppearance', 'prepareBaroCadDocumentPrimitiveNativeRefsV2', 'preparePrimitiveSceneFrame', 'prepareNativePointLightProgramWGSL']) {
        contents = contents.replace(new RegExp(`(function ${name}\\([^{}]*?\\)[^{]*\\{)`,'g'), `$1 globalThis[${JSON.stringify(key)}].counts.${name}=(globalThis[${JSON.stringify(key)}].counts.${name}||0)+1;`);
      }
      return { contents, loader: args.path.endsWith('.ts') ? 'ts' : 'js' };
    });
  } };
  const contents = `export * as viewer from './packages/barocss-viewer/${dir}/index.${ext}';
    export * as candidate from './packages/barocss-viewer/${dir}/native-point-light-candidate.${ext}';
    export * as example from './examples/viewer-native-directional-lights/controller.ts';
    export * as gpu from './packages/barocss-gpu/src/index.ts';
    export * as interop from './packages/barocss-cad-interop/src/document.ts';`;
  const result = await build({ stdin: { contents, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, plugins: [plugin] });
  if (evidence) { await mkdir(evidence, { recursive: true }); await writeFile(resolve(evidence, `${mode}-${mock ? 'mock' : 'platform'}-graph.json`), JSON.stringify(result.metafile, null, 2)); }
  const bundleDir = evidence ?? await mkdtemp(resolve(tmpdir(), 'barocss1621-'));
  const bundle = resolve(bundleDir, `${mode}-${mock ? 'mock' : 'platform'}-${serial}.mjs`);
  await writeFile(bundle, result.outputFiles[0].text);
  const modules = await import(pathToFileURL(bundle).href);
  return { ...modules, state, mode, example: { createSeedInput() {
    const input=modules.example.createSeedInput();
    input.format='barocss-viewer-native-point-light-input';
    input.lights.format='barocss-gpu-native-point-lights'; input.lights.profile='native-world-point-linear-v0';
    input.lights.lights=input.lights.lights.map((light,i)=>{const {directionScene,...rest}=light;assert.equal(directionScene.length,3);return {...rest,positionScene:i?[2,-0,3]:[-2,-0,4],rangeScene:i?7:5};});
    // Non-unit native conversion and nonuniform poses must never transform point lights.
    input.context.mmToSceneUnit=.25;
    return input;
  } } };
}
const err = (error, code) => { assert.equal(error.name, 'ViewerNativePointLightError'); assert.equal(error.code, code); assert.ok(error.message.length <= 1024); return true; };
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
  return { providerCounts, subsetCounts, input, expected: prepared.gpuRequest };
}

export async function runFacadeChecks(m) {
  const { viewer, example, state } = m, input = example.createSeedInput();
  let v = await viewer.createNativePointLightWebGPUViewer({}, input, dimensions);
  assert.equal(v.accepted.generation,1); frozen(v.originals); independent(v.originals,v.originals);
  good(v.select(input.display.visibleGeometry[1])); assert.equal(state.calls.at(-1)[1].modelId,input.display.visibleGeometry[1].modelId);
  let reentrant;
  const observed=new Proxy(copy(input),{getPrototypeOf(target){reentrant=v.select(null);return Object.getPrototypeOf(target)}});
  good(await v.replace(observed)); failed(reentrant,'BUSY'); v.dispose(); v=await viewer.createNativePointLightWebGPUViewer({},input,dimensions); good(v.select(input.display.visibleGeometry[1]));
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
  state.instances.at(-1).setPhase('lost'); assert.equal(v.status.state,'lost'); failed(await v.replace(input),'STATE'); assert.ok(v.accepted);
  v.dispose(); assert.equal(v.selected,null); assert.equal(v.status.state,'disposed'); failed(await v.replace(input),'DISPOSED'); v.dispose();
  v=await viewer.createNativePointLightWebGPUViewer({},input,dimensions); const retained=v.accepted;
  state.updateGate=deferred(); const late=v.replace(input); v.dispose(); state.updateGate.resolve(); failed(await late,'DISPOSED'); state.updateGate=null; assert.equal(v.accepted,retained); assert.equal(v.selected,null);
  // Constructor failure after successful mount must dispose the newly owned backend.
  state.mountGate=deferred(); const mounting=viewer.createNativePointLightWebGPUViewer({},input,dimensions);
  Object.freeze=()=>{throw new Error('factory freeze')};
  try { state.mountGate.resolve(); await assert.rejects(mounting,/factory freeze/); } finally { Object.freeze=freeze; state.mountGate=null; }
  assert.equal(state.instances.at(-1).status.state,'disposed');
  const cleanup=new Error('factory cleanup');state.disposeFailure=cleanup;state.mountGate=deferred();
  const combined=viewer.createNativePointLightWebGPUViewer({},input,dimensions), primary=new Error('factory construction');
  Object.freeze=()=>{throw primary};
  try { state.mountGate.resolve(); await assert.rejects(combined,error=>{err(error,'GPU');assert.ok(error.cause instanceof AggregateError);assert.deepEqual(error.cause.errors,[primary,cleanup]);return true;}); }
  finally { Object.freeze=freeze;state.mountGate=null;state.disposeFailure=null; }
  state.mountFailure=cause;await assert.rejects(viewer.createNativePointLightWebGPUViewer({},input,dimensions),error=>{err(error,'GPU');assert.equal(error.cause,cause);return true;});state.mountFailure=null;
  v=await viewer.createNativePointLightWebGPUViewer({},input,dimensions);state.readGate=deferred();const reading=v.readPixels();v.dispose();state.readGate.resolve();await assert.rejects(reading,error=>err(error,'DISPOSED'));state.readGate=null;
  v.dispose();
  return { calls: state.calls.map(call=>call[0]), counts: {...state.counts} };
}

export async function runSoftwarePlatformChecks(m) {
  const input=m.example.createSeedInput(), h=createSoftwarePlatform(); let v;
  try {
    m.state.counts={};v=await m.viewer.createNativePointLightWebGPUViewer(h.canvas,input,dimensions);
    assert.equal(v.status.profile,'qualified-surface-authored-point-webgpu-v0');
    const mountProviderCounts={...m.state.counts};
    assert.equal(mountProviderCounts.prepareViewerNativeSceneAppearance,1);assert.equal(mountProviderCounts.prepareBaroCadDocumentPrimitiveNativeRefsV2,1);
    assert.equal(mountProviderCounts.preparePrimitiveSceneFrame,2);assert.equal(mountProviderCounts.prepareNativePointLightProgramWGSL,2);
    assert.equal(h.records.adapterRequests.length,1); assert.equal(h.records.passes[0].draws.length,2);
    const pick=await v.pick(1,0); assert.equal(pick.ref.modelId,input.display.visibleGeometry[1].modelId);
    assert.equal((await v.readPixels()).length,16*8*4);
    const before=v.accepted; const cause=h.failNext('createBuffer'); failed(await v.replace(input),'GPU'); assert.equal(v.accepted,before);
    good(await v.resize(12,6)); assert.equal(v.accepted.generation,2);
    const gate=h.gateNext('workDone'); const pending=v.replace(input); await reached(h,'workDone',h.calls.get('workDone')-1); v.dispose(); gate.resolve(); failed(await pending,'DISPOSED');
    assert.equal(v.status.state,'disposed'); h.assertReleased();
    const lostPlatform=createSoftwarePlatform();let lostViewer;
    try {
      lostViewer=await m.viewer.createNativePointLightWebGPUViewer(lostPlatform.canvas,input,dimensions);
      const retained=lostViewer.accepted;lostPlatform.lost.resolve({reason:'destroyed',message:'software device loss'});
      await Promise.resolve();await Promise.resolve();assert.equal(lostViewer.status.state,'lost');
      failed(await lostViewer.replace(input),'STATE');assert.equal(lostViewer.accepted,retained);
      lostViewer.dispose();lostPlatform.assertReleased();
    } finally {if(lostViewer && lostViewer.status.state!=='disposed')lostViewer.dispose();lostPlatform.restore();}
    return { softwareOnly:true, adapterRequests:h.records.adapterRequests.length, submissions:h.records.submissions.length, cause: cause.message, mountProviderCounts, deviceLoss:'software-only retained metadata, actual lost status' };
  } finally { if(v && v.status.state!=='disposed')v.dispose();h.restore(); }
}

export async function runPointChecks(m) {
  const {viewer,example,gpu,candidate}=m, input=example.createSeedInput();
  const prepared=candidate.prepareLightCandidate(input,1,null);
  assert.deepEqual(prepared.gpuRequest.lights,input.lights);
  assert.deepEqual(prepared.gpuRequest.lights.lights.map(l=>[l.positionScene,l.rangeScene]),[[[-2,-0,4],5],[[2,-0,3],7]]);
  assert.equal(prepared.gpuRequest.frame.options.mmToSceneUnit,.25);
  assert.deepEqual(prepared.gpuRequest.frame.scene.entries[1].transform.scale,[1.1,.9,1]);
  assert.ok(Object.is(prepared.gpuRequest.lights.lights[0].positionScene[1],-0));
  const runtimeNames=Object.keys(viewer).filter(name=>name.includes('PointLight'));
  assert.deepEqual(runtimeNames.sort(),['ViewerNativePointLightError','createNativePointLightWebGPUViewer']);
  for(const name of ['prepareLightCandidate','copyOwn','freezeOwn','refKey','refuse'])assert.equal(Object.hasOwn(viewer,name),false);
  assert.equal(typeof viewer.createNativeDirectionalLightWebGPUViewer,'function');
  const v=await viewer.createNativePointLightWebGPUViewer({},input,dimensions), before=v.accepted;
  const invalid=[
    x=>{x.lights.lights[0].positionScene[0]=1e6+1;}, x=>{x.lights.lights[0].positionScene[1]=-1e6-1;},
    x=>{x.lights.lights[0].rangeScene=0;}, x=>{x.lights.lights[0].rangeScene=-1;},
    x=>{x.lights.lights[0].rangeScene=.000999;}, x=>{x.lights.lights[0].rangeScene=1e6+1;},
    x=>{x.lights.lights[0].colorLinearRGB[0]=-Number.EPSILON;}, x=>{x.lights.lights[0].colorLinearRGB[1]=1.01;},
    x=>{x.lights.lights[0].intensity=1.01;}, x=>{x.lights.ambientStrength=-.1;},
    x=>{x.lights.lights[0].enabled=false;x.lights.lights[0].rangeScene=0;},
    x=>{x.lights.lights[1].nodeId=x.lights.lights[0].nodeId;},
    x=>{x.lights.profile='native-world-directional-linear-v0';}, x=>{x.lights.lights[0].directionScene=[1,0,0];},
    x=>{x.lights.lights[0].kind='spot';},
  ];
  for(const mutate of invalid){const bad=copy(input);mutate(bad);const failure=failed(await v.replace(bad),'GPU');assert.ok(failure.cause);assert.equal(v.accepted,before);}
  for(const value of [NaN,Infinity,-Infinity])for(const field of ['positionScene','rangeScene','colorLinearRGB','intensity']){
    const bad=copy(input);if(Array.isArray(bad.lights.lights[0][field]))bad.lights.lights[0][field][0]=value;else bad.lights.lights[0][field]=value;
    failed(await v.replace(bad),'INPUT');assert.equal(v.accepted,before);
  }
  const tooMany=copy(input);tooMany.lights.lights=Array.from({length:5},(_,i)=>({...copy(input.lights.lights[0]),nodeId:'p'+i}));
  failed(await v.replace(tooMany),'BUDGET');assert.equal(v.accepted,before);
  for(const rangeScene of [.001,1e6]){
    const edge=copy(input);edge.lights.lights[0]={...edge.lights.lights[0],positionScene:[-1e6,-0,1e6],rangeScene,colorLinearRGB:[0,1,-0],intensity:0,enabled:false};
    good(await v.replace(edge));assert.equal(signed(v.originals.lights),signed(edge.lights));
  }
  const edited=copy(input);edited.lights.lights[0].positionScene=[3,-0,-2];edited.lights.lights[0].rangeScene=9;
  edited.lights.lights[1].enabled=false;good(await v.replace(edited));assert.deepEqual(v.originals.lights,edited.lights);
  const raw=gpu.prepareNativePointLights(edited.lights);assert.deepEqual(raw.execution[0].positionScene,[3,-0,-2]);
  v.dispose();
  return {invalidCases:invalid.length+12+1,rawWorldValuesPreserved:true};
}

export async function runSettledLossChecks(m) {
  const {viewer,example,state}=m, input=example.createSeedInput();
  for(const kind of ['replace','resize','readPixels','pick']){
    const v=await viewer.createNativePointLightWebGPUViewer({},input,dimensions), before=v.accepted;
    const gate=deferred(), field=kind==='readPixels'?'readGate':kind==='pick'?'pickGate':'updateGate';state[field]=gate;
    const pending=kind==='replace'?v.replace(input):kind==='resize'?v.resize(9,9):kind==='pick'?v.pick(0,0):v.readPixels();
    // Backend continuation settles first, then loss happens before the facade resumes.
    gate.resolve();queueMicrotask(()=>state.instances.at(-1).setPhase('lost'));
    if(kind==='replace'||kind==='resize')failed(await pending,'STATE');else await assert.rejects(pending,e=>err(e,'STATE'));
    assert.equal(v.accepted,before);assert.equal(v.status.state,'lost');state[field]=null;v.dispose();
  }
  // A real failed GPU result outranks the secondary unavailable status, retaining its cause.
  const failing=await viewer.createNativePointLightWebGPUViewer({},input,dimensions), failureBefore=failing.accepted;
  const cause=new Error('pending device loss');cause.code='DEVICE_LOST';state.nextFailure=cause;state.updateGate=deferred();
  const refused=failing.replace(input);state.updateGate.resolve();queueMicrotask(()=>state.instances.at(-1).setPhase('lost'));
  assert.equal(failed(await refused,'GPU').cause,cause);assert.equal(failing.accepted,failureBefore);state.updateGate=null;failing.dispose();
  // Input ownership is fixed before the asynchronous initial mount completes.
  state.mountGate=deferred();const changing=copy(input), expected=signed(changing);
  const pending=viewer.createNativePointLightWebGPUViewer({},changing,dimensions);changing.lights.lights[0].positionScene[0]=999;
  state.mountGate.resolve();const v=await pending;state.mountGate=null;assert.equal(signed(v.originals),expected);v.dispose();
  return {settledLossFences:4,mountSnapshot:true};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  assert.equal(Number(process.versions.node.split('.')[0]),22,'Use Node22');
  const mode=process.env.VIEWER_TEST_MODE??'source';assert.ok(['source','dist'].includes(mode));
  const m=await loadModules(mode,true,process.env.VIEWER_TEST_EVIDENCE), modeName=mode==='dist'?'emitted Viewer with original dependency sources':'source';
  if(mode==='dist')test('source/emitted public namespace parity',async()=>assert.deepEqual(Object.keys((await loadModules('source')).viewer).sort(),Object.keys(m.viewer).sort()));
  test(`${modeName}: original source/TEN/material preparation`,()=>runPreparationChecks(m));
  test(`${modeName}: point validation and world-space authority`,()=>runPointChecks(m));
  test(`${modeName}: atomic facade, full-pair identity, BUSY and disposal`,()=>runFacadeChecks(m));
  test(`${modeName}: settled loss and initial snapshot`,()=>runSettledLossChecks(m));
  test(`${modeName}: actual Viewer/point GPU on deterministic software platform`,async()=>runSoftwarePlatformChecks(await loadModules(mode,false)));
}
