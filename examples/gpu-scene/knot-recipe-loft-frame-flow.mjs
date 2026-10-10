/** #1405: whole authored recipe graph -> selective original edit -> CPU frame -> genuine cold Open.
 * Node22: node examples/gpu-scene/knot-recipe-loft-frame-flow.mjs --authored <MAIN0> --reference <MAIN0-result> --output <fresh-directory>
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {build} from 'esbuild';
import {prepareRecipeLoftFrame} from './knot-recipe-loft-frame-internal.mjs';

assert.equal(Number(process.versions.node.split('.')[0]),22);
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),args=process.argv.slice(2);
function arg(name){const at=args.indexOf(name);assert(at>=0&&args[at+1]&&!args[at+1].startsWith('--'),name+' required');return resolve(args[at+1]);}
const output=arg('--output'),authoredPath=arg('--authored'),referencePath=arg('--reference');await mkdir(output,{recursive:false});
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const authoredBytes=await readFile(authoredPath),referenceBytes=await readFile(referencePath);
assert.equal(authoredBytes.length,3906);assert.equal(hash(authoredBytes),'e5c935dc1836de37f9315c43ee201c5ba4ef57c8f0ecbbe05232a5f76ea92183');
assert.equal(referenceBytes.length,119813);assert.equal(hash(referenceBytes),'dfc9dada3762ac5067d934abeef53aaa5853262b3f0b5c5e783e377c1aa78d16');
const authoredText=new TextDecoder('utf-8',{fatal:true}).decode(authoredBytes);
const reference=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(referenceBytes)); // Pinned comparison only, not native-file admission.
const options={maximumSourceEdits:3,maximumRefinementInsertions:3,maximumLoftSections:3,maximumProducerEvaluations:7};
const gpuDir=resolve(repo,'packages/barocss-gpu'),cadDir=resolve(repo,'packages/barocss-cad');
const gpuManifest=JSON.parse(await readFile(resolve(gpuDir,'package.json'),'utf8'));
const cadManifest=JSON.parse(await readFile(resolve(cadDir,'package.json'),'utf8'));
const cadPath=resolve(output,'cad-source.mjs'),ordinary=resolve(output,'gpu-source.mjs');
const [cadBuild,gpuBuild]=await Promise.all([
 build({entryPoints:[resolve(cadDir,cadManifest.exports['.'].import)],bundle:true,platform:'node',format:'esm',target:'node22',outfile:cadPath,metafile:true}),
 build({entryPoints:[resolve(gpuDir,gpuManifest.exports['.'].import)],bundle:true,platform:'node',format:'esm',target:'node22',outfile:ordinary,metafile:true}),
]);
const cadGraph=Object.keys(cadBuild.metafile.inputs),gpuGraph=Object.keys(gpuBuild.metafile.inputs);
assert(cadGraph.some(path=>path.endsWith('/source-knot-recipe-loft-graph.ts')));
assert(gpuGraph.some(path=>path.endsWith('/primitive-frame-preflight.ts')));
assert(![...cadGraph,...gpuGraph].some(path=>/barocss-(cad|gpu)\/dist\//.test(path)),'Ordinary own providers cannot fall back to own emitted artifacts');
const cad=await import(pathToFileURL(cadPath).href),emitted=resolve(gpuDir,gpuManifest.publishConfig.exports['.'].import);
const providers=[{label:'source',path:ordinary,gpu:await import(pathToFileURL(ordinary).href)},
 {label:'emitted',path:emitted,gpu:await import(pathToFileURL(emitted).href)}];
const namespace=Object.keys(providers[0].gpu).sort();assert.deepEqual(namespace,Object.keys(providers[1].gpu).sort());
const dtsPath=resolve(gpuDir,gpuManifest.publishConfig.exports['.'].types),dts=await readFile(dtsPath,'utf8');
for(const name of ['preparePrimitiveSceneFrame','prepareSelectedUniformCurvePreview'])assert(dts.includes(name));
const cadSourceDts=await readFile(resolve(cadDir,'src/index.ts'),'utf8');
for(const name of ['parseSourceKnotRecipeLoftGraph','serializeSourceKnotRecipeLoftGraph','updateSourceKnotRecipeLoftGraph','validateSourceKnotRecipeLoftGraph','validateSourceKnotRecipeLoftGraphUpdate']){assert.equal(typeof cad[name],'function');assert(cadSourceDts.includes(name));}
const helperPath=resolve(repo,'examples/gpu-scene/knot-recipe-loft-frame-internal.mjs');
// Semantic value observation only. Preserve Binary64 signs, ordered arrays and original strings;
// object storage/alias layout is not native authority. No native exchange codec is introduced.
function nativeDigest(value){
 const digest=createHash('sha256'),size=number=>{const bytes=Buffer.alloc(4);bytes.writeUInt32BE(number);digest.update(bytes);};
 const text=value=>{const bytes=Buffer.from(value,'utf8');size(bytes.length);digest.update(bytes);};
 function visit(item){
  if(item===null){digest.update('z');return;}
  if(typeof item==='number'){assert(Number.isFinite(item));digest.update('n');const b=Buffer.alloc(8);b.writeDoubleBE(item);digest.update(b);return;}
  if(typeof item==='string'){digest.update('s');text(item);return;}
  if(typeof item==='boolean'){digest.update(item?'t':'f');return;}
  if(item===undefined){digest.update('u');return;}
  assert(item&&typeof item==='object');
  if(Array.isArray(item)){digest.update('a');size(item.length);for(const child of item)visit(child);return;}
  digest.update('o');const keys=Object.keys(item).sort();size(keys.length);for(const key of keys){text(key);visit(item[key]);}
 }
 visit(value);return digest.digest('hex');
}
const buffers=prepared=>prepared.primitives.map(part=>Object.fromEntries(['positions','normals','indices'].filter(key=>part[key]).map(key=>{
 const view=part[key];return[key,hash(Buffer.from(view.buffer,view.byteOffset,view.byteLength))];
})));
const ledger=[];
function counted(label,fn,args){try{const result=fn(...args);ledger.push({label,result:'accepted'});return result;}catch(error){ledger.push({label,result:'refused',name:error.name,code:error.code??null});throw error;}}
const nativeNames=['parseSourceKnotRecipeLoftGraph','serializeSourceKnotRecipeLoftGraph','updateSourceKnotRecipeLoftGraph','validateSourceKnotRecipeLoftGraph','validateSourceKnotRecipeLoftGraphUpdate','tessellateSurface'];
const measuredCad={...cad,...Object.fromEntries(nativeNames.map(name=>[name,(...args)=>counted('cad.'+name,cad[name],args)]))};
function measuredGpu(provider){return {...provider.gpu,...Object.fromEntries(['prepareSelectedUniformCurvePreview','preparePrimitiveSceneFrame'].map(name=>[name,(...args)=>counted(provider.label+'.'+name,provider.gpu[name],args)]))};}
let accepted=0,refused=0,getters=0,reflections=0,acceptedState=null;
const files=[],observations=[],failures=[];
async function retain(path,text){await writeFile(path,text);files.push({path,sha256:hash(await readFile(path))});}
async function retained(){for(const file of files)assert.equal(hash(await readFile(file.path)),file.sha256);}
function verify(record,revision){
 assert.deepEqual(Object.keys(record).sort(),['native','validationReport','surfacePreview','curvePreviews','prepared'].sort());
 assert.deepEqual(record.validationReport,record.native.report);assert.equal(record.native.document.revision,revision);
 assert.equal(record.prepared.primitives.length,4);assert.equal(record.prepared.bufferBytes,7356);
 assert.equal(record.surfacePreview.packet.positions.length,243);assert.equal(record.surfacePreview.packet.indices.length,384);assert.equal(record.surfacePreview.packet.revision,revision);
 assert.equal(record.prepared.frame.options.mmToSceneUnit,.01);assert.deepEqual(record.prepared.frame.options.translate,[0,0,0]);
 assert.deepEqual(record.prepared.frame.scene.entries.map(entry=>entry.ref),[{modelId:'constructed_model',geometryId:'constructed_surface'},...['copy_first','copy_middle','copy_last'].map(geometryId=>({modelId:'constructed_model',geometryId}))]);
 assert(record.curvePreviews.every(sample=>sample.count===129&&sample.model.objects.length===4&&sample.model.name==='constructed_model'&&sample.sourceVersion===0));
 for(let i=0;i<4;i++){const original=i===0?record.surfacePreview.packet.positions:record.curvePreviews[i-1].pointsMM.flat();assert.deepEqual(Array.from(record.prepared.primitives[i].positions),original.map(x=>Math.fround(x*.01)));}
 assert(Object.isFrozen(record.prepared.frame));assert(Object.isFrozen(record.prepared.primitives));
 assert.equal(record.native.terminal.report.insertionCount,0);assert.equal(record.native.terminal.report.directCounts.sourceInsertionCallCount,0);
 const d1=record.native.terminal.loft.report.derivativeObservations.filter(row=>row.result.kind==='refused');assert.equal(d1.length,3);assert(d1.every(row=>row.v===.5));
}
try{
 const baseline=counted('cad.parseSourceKnotRecipeLoftGraph',cad.parseSourceKnotRecipeLoftGraph,[authoredText,options]);accepted++;
 assert.deepEqual(baseline,reference,'Fresh whole public authored parse retains the qualified pinned native value');
 assert.deepEqual(baseline.document.assets.map(asset=>asset.sourceId),['source_b','source_c','source_a']);
 assert.deepEqual(baseline.document.sourceEdits.map(node=>node.id),['edit_a','edit_c','edit_b']);
 assert.deepEqual(baseline.document.terminal.sections,['edit_c','edit_b','edit_a']);
 const originalDigest=nativeDigest(baseline),originalSourceTexts=baseline.document.assets.map(asset=>asset.source);
 const request={expectedRevision:0,revision:1,nodeEdits:[{nodeId:'edit_b',edits:{poleEdits:[{index:3,zMM:4.5}]}}],refinementKnot:null,refinementSuppressed:null};
 assert.equal(baseline.document.sourceEdits.find(node=>node.id==='edit_b').edits.poleEdits[0].zMM,4.375);
 const update=counted('cad.updateSourceKnotRecipeLoftGraph',cad.updateSourceKnotRecipeLoftGraph,[baseline,request]);accepted++;
 const transactionReport=counted('cad.validateSourceKnotRecipeLoftGraphUpdate',cad.validateSourceKnotRecipeLoftGraphUpdate,[update]);accepted++;
 assert.deepEqual(transactionReport,update.transaction.report);assert.equal(update.result.document.revision,1);
 assert.deepEqual(update.transaction.report.changedSourceNodeIds,['edit_b']);assert.deepEqual(update.transaction.report.rebuiltRefinementNodeIds,['edit_b']);
 assert.equal(update.transaction.report.directCounts.sourceEditCallCount,1);assert.equal(update.transaction.report.directCounts.refinementInsertionCallCount,1);assert.equal(update.transaction.report.directCounts.terminalBuildCallCount,1);
 assert.equal(update.transaction.report.validationCounts.previousGraphRebuildCount,1);
 assert.equal(update.result.document.refinement.knot,.5);assert.equal(update.result.document.refinement.suppressed,false);
 for(const nodeId of ['edit_a','edit_c']){
  const scalarIndex=baseline.document.sourceEdits.findIndex(node=>node.id===nodeId),terminalIndex=baseline.document.terminal.sections.indexOf(nodeId);
  assert.deepEqual(update.result.sourceEdits[scalarIndex],baseline.sourceEdits[scalarIndex]);assert.deepEqual(update.result.refinement[terminalIndex],baseline.refinement[terminalIndex]);
 }
 assert.equal(nativeDigest(baseline),originalDigest);assert.deepEqual(update.result.document.assets.map(asset=>asset.source),originalSourceTexts);
 assert.notDeepEqual(update.result.terminal.loft.surface,baseline.terminal.loft.surface);
 const records=[];
 for(const provider of providers){const gpu=measuredGpu(provider),before=prepareRecipeLoftFrame(measuredCad,gpu,baseline),after=prepareRecipeLoftFrame(measuredCad,gpu,update.result);verify(before,0);verify(after,1);accepted+=2;
  assert.notDeepEqual(Array.from(before.prepared.primitives[0].positions),Array.from(after.prepared.primitives[0].positions));
  assert.notDeepEqual(Array.from(before.prepared.primitives[2].positions),Array.from(after.prepared.primitives[2].positions));
  assert.deepEqual(buffers(before.prepared)[1],buffers(after.prepared)[1]);assert.deepEqual(buffers(before.prepared)[3],buffers(after.prepared)[3]);
  const originalFrameDigest=nativeDigest(before.prepared.frame),first=before.prepared.primitives[0].positions[0];before.prepared.primitives[0].positions[0]=77;
  assert.equal(nativeDigest(before.prepared.frame),originalFrameDigest);assert.equal(nativeDigest(baseline),originalDigest);assert.notEqual(after.prepared.primitives[0].positions[0],77);before.prepared.primitives[0].positions[0]=first;
  records.push({provider:provider.label,before,after});
 }
 assert.deepEqual(buffers(records[0].before.prepared),buffers(records[1].before.prepared));assert.deepEqual(buffers(records[0].after.prepared),buffers(records[1].after.prepared));
 assert.deepEqual(records[0].before.prepared.frame,records[1].before.prepared.frame);assert.deepEqual(records[0].after.prepared.frame,records[1].after.prepared.frame);
 acceptedState={baseline,update,records};
 const optionsPath=resolve(output,'graph-options.json');await retain(optionsPath,JSON.stringify(options)+'\n');
 const cases=[];
 for(const [label,native,record]of [['baseline',baseline,records[0].before],['edited',update.result,records[0].after]]){
  const authoredPath=resolve(output,label+'.authored-graph.json'),text=counted('cad.serializeSourceKnotRecipeLoftGraph',cad.serializeSourceKnotRecipeLoftGraph,[native.document,options]);accepted++;
  assert(text.endsWith('\n'));if(label==='baseline')assert.equal(text,authoredText);
  await retain(authoredPath,text);await retain(resolve(output,label+'.construction.source0.css'),native.terminal.loft.source);
  cases.push({label,authoredPath,expected:{nativeDigest:nativeDigest(native),frameDigest:nativeDigest(record.prepared.frame),buffers:buffers(record.prepared),refs:record.prepared.frame.scene.entries.map(entry=>entry.ref),revision:native.document.revision}});
 }
 const stateDigest=nativeDigest({baseline,update}),stateBuffers=records.map(record=>({before:buffers(record.before.prepared),after:buffers(record.after.prepared)}));
 async function reject(label,fn,code,inspect){let error;try{fn();}catch(cause){error=cause;}assert(error,label+' must refuse');if(code)assert.equal(error.code,code);inspect?.(error);refused++;observations.push({label,name:error.name,code:error.code??null,message:error.message,cause:error.cause instanceof Error?{name:error.cause.name,message:error.cause.message}:null});assert.strictEqual(acceptedState.baseline,baseline);assert.equal(nativeDigest({baseline,update}),stateDigest);assert.deepEqual(records.map(record=>({before:buffers(record.before.prepared),after:buffers(record.after.prepared)})),stateBuffers);await retained();}
 await reject('malformed authored grammar',()=>counted('cad.parseSourceKnotRecipeLoftGraph',cad.parseSourceKnotRecipeLoftGraph,['{"format":',options]),'CODEC');
 await reject('stale graph revision',()=>counted('cad.updateSourceKnotRecipeLoftGraph',cad.updateSourceKnotRecipeLoftGraph,[baseline,{...request,expectedRevision:1}]),'REVISION');
 for(const [label,mutate]of [
  ['wrong graph terminal binding',value=>{value.bindings.sources[0].terminalSectionIndex=0;}],
  ['retained scalar sibling changed',value=>{value.sourceEdits[0].source+='\n';}],
  ['refinement receipt changed',value=>{value.refinement[0].curve.controlPoints[0][0]+=.125;}],
  ['nested terminal coefficient changed',value=>{value.terminal.loft.surface.controlPoints[0][0][0]+=.125;}],
 ]){const candidate=structuredClone(baseline);mutate(candidate);await reject(label,()=>counted('cad.validateSourceKnotRecipeLoftGraph',cad.validateSourceKnotRecipeLoftGraph,[candidate]),'OWNED');}
 const accessor=structuredClone(baseline);Object.defineProperty(accessor,'report',{enumerable:true,get(){getters++;return baseline.report;}});
 await reject('native accessor never invoked',()=>counted('cad.validateSourceKnotRecipeLoftGraph',cad.validateSourceKnotRecipeLoftGraph,[accessor]),'OWNED');
 const marker=new Error('Actual whole-graph reflection refusal');const proxy=new Proxy(baseline,{getPrototypeOf(){reflections++;throw marker;}});
 await reject('native actual reflection cause',()=>counted('cad.validateSourceKnotRecipeLoftGraph',cad.validateSourceKnotRecipeLoftGraph,[proxy]),'OWNED',error=>assert.strictEqual(error.cause,marker));assert.equal(getters,0);
 for(let i=0;i<providers.length;i++){const candidate=structuredClone(records[i].after.prepared.frame);candidate.scene.entries[1].ref=structuredClone(candidate.scene.entries[0].ref);
  await reject(providers[i].label+' duplicate candidate GPU reference',()=>counted(providers[i].label+'.preparePrimitiveSceneFrame',providers[i].gpu.preparePrimitiveSceneFrame,[candidate]),null,error=>assert(error instanceof Error));
 }
 // The real cold child code is filled from the separately owned private preparation before FIRST syntax.
 const coldCode="\nimport assert from 'node:assert/strict';\nimport { readFile } from 'node:fs/promises';\nimport { pathToFileURL } from 'node:url';\nimport { createHash } from 'node:crypto';\n\nassert.equal(Number(process.versions.node.split('.')[0]), 22, 'Actual fresh Node22 child required');\nconst cfg = JSON.parse(process.argv[1]);\nconst cad = await import(pathToFileURL(cfg.cadPath).href);\nconst { prepareRecipeLoftFrame } = await import(pathToFileURL(cfg.helperPath).href);\nassert.equal(typeof prepareRecipeLoftFrame, 'function');\nfor (const name of ['parseSourceKnotRecipeLoftGraph', 'validateSourceKnotRecipeLoftGraph', 'tessellateSurface'])\n  assert.equal(typeof cad[name], 'function', 'Actual public CAD source provider ' + name);\nconst optionsBytes = await readFile(cfg.optionsPath), options = JSON.parse(optionsBytes.toString('utf8'));\nconst sha256 = bytes => createHash('sha256').update(bytes).digest('hex');\n\n// Identical value algorithm to #1391: signed Binary64BE, UTF8 length prefixes,\n// ordered arrays and sorted own enumerable keys. This emits a digest, no codec.\nfunction nativeDigest(value) {\n  const digest = createHash('sha256');\n  const size = number => { const bytes = Buffer.alloc(4); bytes.writeUInt32BE(number); digest.update(bytes); };\n  const text = value => { const bytes = Buffer.from(value, 'utf8'); size(bytes.length); digest.update(bytes); };\n  function visit(item) {\n    if (item === null) { digest.update('z'); return; }\n    if (typeof item === 'number') { assert(Number.isFinite(item)); digest.update('n'); const bytes = Buffer.alloc(8); bytes.writeDoubleBE(item); digest.update(bytes); return; }\n    if (typeof item === 'string') { digest.update('s'); text(item); return; }\n    if (typeof item === 'boolean') { digest.update(item ? 't' : 'f'); return; }\n    if (item === undefined) { digest.update('u'); return; }\n    assert(item && typeof item === 'object');\n    if (Array.isArray(item)) { digest.update('a'); size(item.length); for (const child of item) visit(child); return; }\n    digest.update('o'); const keys = Object.keys(item).sort(); size(keys.length);\n    for (const key of keys) { text(key); visit(item[key]); }\n  }\n  visit(value); return digest.digest('hex');\n}\nassert.notEqual(nativeDigest(-0), nativeDigest(+0), 'Signed Number zeros remain independent');\nassert.notEqual(nativeDigest('-0'), nativeDigest('+0'), 'Source string signs remain independent');\nfunction sourceSnapshots(value) {\n  const rows = [];\n  function visit(item, path) {\n    if (typeof item === 'string') {\n      if (item.includes('@model')) {\n        const bytes = Buffer.from(item, 'utf8');\n        rows.push({ path, bytes: bytes.length, sha256: sha256(bytes), containsMinusZeroText: item.includes('-0'), containsPlusZeroText: item.includes('+0') });\n      }\n      return;\n    }\n    if (!item || typeof item !== 'object') return;\n    if (Array.isArray(item)) item.forEach((child, index) => visit(child, path + '[' + index + ']'));\n    else for (const key of Object.keys(item).sort()) visit(item[key], path + '.' + key);\n  }\n  visit(value, 'current'); return rows;\n}\nfunction frozenFrame(value) {\n  if (value && typeof value === 'object') {\n    assert(!ArrayBuffer.isView(value), 'Canonical frame is source data, not execution buffers');\n    assert(Object.isFrozen(value)); Object.values(value).forEach(frozenFrame);\n  }\n}\nconst callNames = ['parseSourceKnotRecipeLoftGraph', 'validateSourceKnotRecipeLoftGraph', 'tessellateSurface',\n  'prepareSelectedUniformCurvePreview', 'preparePrimitiveSceneFrame'];\nconst totals = Object.fromEntries(callNames.map(name => [name, 0]));\nconst ledgerRows = [], rows = [];\nfunction counted(namespace, names, calls) {\n  const facade = { ...namespace };\n  for (const name of names) {\n    assert.equal(typeof namespace[name], 'function', 'Actual direct provider ' + name);\n    facade[name] = (...args) => {\n      calls[name]++; totals[name]++;\n      return namespace[name](...args);\n    };\n  }\n  return facade;\n}\nfor (const provider of cfg.providers) {\n  const gpu = await import(pathToFileURL(provider.path).href);\n  assert.deepEqual(Object.keys(gpu).sort(), cfg.namespace, 'Actual ' + provider.label + ' public namespace');\n  for (const item of cfg.cases) {\n    const calls = Object.fromEntries(callNames.map(name => [name, 0]));\n    const cadProvider = counted(cad, callNames.slice(0, 3), calls);\n    const gpuProvider = counted(gpu, callNames.slice(3), calls);\n    const authoredBytes = await readFile(item.authoredPath), authoredText = authoredBytes.toString('utf8');\n    const current = cadProvider.parseSourceKnotRecipeLoftGraph(authoredText, options);\n    assert(current && typeof current === 'object');\n    assert.equal(current.document.revision, item.expected.revision);\n    assert.deepEqual(current.options, options);\n    const before = nativeDigest(current), sourcesBefore = sourceSnapshots(current);\n    assert(sourcesBefore.length > 0, 'Whole current retains complete Source0 strings');\n    assert.equal(before, item.expected.nativeDigest, 'Whole parsed current Binary64 digest');\n    const record = prepareRecipeLoftFrame(cadProvider, gpuProvider, current);\n    assert(record && record.native && record.prepared, 'Exact helper native/prepared result');\n    assert.equal(nativeDigest(current), before, 'Caller native authority remains unchanged');\n    assert.deepEqual(sourceSnapshots(current), sourcesBefore, 'Complete source bytes/signs remain unchanged');\n    assert.equal(nativeDigest(record.native), item.expected.nativeDigest, 'Whole helper native result, not validator REPORT');\n    assert.deepEqual(sourceSnapshots(record.native), sourcesBefore);\n    const prepared = record.prepared;\n    assert.equal(prepared.bufferBytes, 7356); assert.equal(prepared.primitives.length, 4);\n    assert.equal(prepared.frame.scene.entries.length, 4); assert.equal(prepared.frame.particles, null);\n    assert.deepEqual(prepared.frame.materials, []); frozenFrame(prepared.frame);\n    assert.equal(nativeDigest(prepared.frame), item.expected.frameDigest, 'Canonical frozen source frame Binary64 digest');\n    const refs = prepared.frame.scene.entries.map(entry => entry.ref);\n    assert.deepEqual(refs, item.expected.refs);\n    assert.equal(prepared.primitives[0].entry.packet.revision, item.expected.revision);\n    assert.equal(record.native.document.revision, item.expected.revision);\n    const buffers = prepared.primitives.map(primitive => Object.fromEntries(['positions', 'normals', 'indices']\n      .filter(name => primitive[name] !== undefined).map(name => {\n        const view = primitive[name]; assert(ArrayBuffer.isView(view));\n        return [name, sha256(Buffer.from(view.buffer, view.byteOffset, view.byteLength))];\n      })));\n    assert.deepEqual(buffers, item.expected.buffers, 'Independently regenerated execution bytes');\n    assert.deepEqual(calls, { parseSourceKnotRecipeLoftGraph: 1, validateSourceKnotRecipeLoftGraph: 1,\n      tessellateSurface: 1, prepareSelectedUniformCurvePreview: 3, preparePrimitiveSceneFrame: 1 }, 'Frozen direct public call counts');\n    ledgerRows.push({ provider: provider.label, case: item.label, calls });\n    rows.push({ provider: provider.label, case: item.label, revision: item.expected.revision,\n      nativeDigest: before, frameDigest: item.expected.frameDigest, buffers, refs, bufferBytes: prepared.bufferBytes,\n      authoredSHA256: sha256(authoredBytes), optionsSHA256: sha256(optionsBytes), sourceSnapshots: sourcesBefore, frozenFrame: true });\n  }\n}\nconsole.log(JSON.stringify({ node: process.version, rows, publicCallLedger: {\n  scope: 'Actual direct calls through injected public namespaces only; calls counted on entry', totals, rows: ledgerRows,\n  internalKernelTelemetry: false,\n  documentedReconstruction: ['Public parse evaluates one complete authored graph.',\n    'Whole current validator reconstructs one complete graph internally; that internal work is not counted as intercepted direct producer calls.',\n    'Each frame preflight revalidates the selected previews internally; this ledger counts its public boundary only.',\n    'No serializer, updater, history replay or raw-current reader is executed in this cold child.']\n} }));\n";
 const cold=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',coldCode,JSON.stringify({cadPath,helperPath,providers:providers.map(({label,path})=>({label,path})),namespace,optionsPath,cases})],{encoding:'utf8',maxBuffer:4*1024*1024}));
 await retained();assert.equal(nativeDigest(baseline),originalDigest);
 const expectedPath=resolve(output,'expected-value-observations.json');await retain(expectedPath,JSON.stringify({cases,cold},null,2)+'\n');
 observations.push({case:'whole-authored-selective-edit-and-cold-open',cases,cold,selective:update.transaction.report.directCounts,priorValidation:update.transaction.report.validationCounts,originalSourceIds:baseline.document.assets.map(asset=>asset.sourceId),refs:cases[0].expected.refs,bufferBytes:7356});
} catch(error){failures.push(String(error.stack??error));throw error;}
finally{
 const report={issue:1405,parent:'1614fdf964806f2ab76f018145b33323bfdaf73c',head:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),accepted,refused,getters,reflections,namespaceCount:namespace.length,failures,observations,files,publicCallLedger:ledger,
  sourceGraphs:{cad:cadGraph,gpu:gpuGraph},providers:{cadSource:{path:cadPath,sha256:hash(await readFile(cadPath))},gpuSource:{path:ordinary,sha256:hash(await readFile(ordinary))},gpuEmitted:{path:emitted,sha256:hash(await readFile(emitted))},gpuDeclarations:{path:dtsPath,sha256:hash(dts)}},actualGL:false,rawResultReader:false,
  limits:['Whole authored public graph codec preserves originals and literal recipes; whole current results retained in memory, not a public raw-result codec.',
   'Original mm/source/native/domain/UV/IDs stay separate from sampled Number packets and independently mutable F32/U16 execution; scale.01 once.',
   'Nine-by-nine D0/triangle normals and full-source uniform129 Curves, sampleVersion3; no analytic D1 smoothness or global-error certificate.',
   'Direct public call ledger excludes internal reconstruction/kernel telemetry; selective1/1/1 is distinct from prior whole rebuild and validators/serializers/cold parsers.',
   'No suppression/history/cap/native author campaigns, all-published CAD qualification, renderer/pixels/lifetime/device/currentRoot/Viewer/Loader/publication claim.']};
 await writeFile(resolve(output,'actual-result.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({issue:1405,accepted,refused,getters,reflections,namespaceCount:namespace.length,actualGL:false,failures}));
}
