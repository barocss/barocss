import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = process.cwd(), examples = resolve(root, 'packages/barocss-cad-interop/examples');
const position = process.argv.indexOf('--output');
assert.ok(position >= 0 && process.argv[position + 1], '--output ABS_DIR is required');
assert.ok(isAbsolute(process.argv[position + 1]), 'External output must be absolute');
const output = resolve(process.argv[position + 1]), compiled = process.argv.includes('--compiled');
assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Node22 is required');
await mkdir(output, { recursive: true });
const packages = new Map();
for (const suffix of ['cad', 'cad-interop']) {
  const directory = resolve(root, 'packages/barocss-' + suffix);
  const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  packages.set('@barocss/' + suffix, { directory, manifest });
  if (!compiled) {
    let exists = false;
    try { await access(resolve(directory, 'dist')); exists = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    assert.equal(exists, false, 'FIRST source flow must precede own builds');
  }
}
function published(specifier, field) {
  const name = specifier.split('/').slice(0, 2).join('/'), item = packages.get(name);
  const suffix = specifier.slice(name.length), key = suffix ? '.' + suffix : '.';
  const target = item?.manifest.publishConfig?.exports?.[key]?.[field];
  assert.ok(target?.startsWith('./dist/'), 'Actual published entry required: ' + specifier);
  return resolve(item.directory, target);
}
const resolutions = [];
const publishedPlugin = { name: 'actual-wide-source-published-entries', setup(builder) {
  builder.onResolve({ filter: /^@barocss\/(cad|cad-interop)(\/|$)/ }, args => {
    const path = published(args.path, 'import');
    resolutions.push({ specifier: args.path, importer: relative(root, args.importer), target: relative(root, path) });
    return { path };
  });
} };
const modeOptions = compiled ? { plugins: [publishedPlugin] } : {};

// The loopback server and file writer belong to this private example consumer.
// The same actual checkpoint performs source and emitted CPU flows.
const consumer = String.raw`
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Scene, OrthographicCamera, Mesh, SphereGeometry, MeshBasicMaterial } from 'three';
import { CASE_KEYS, PINS, loadCase, assertNative, assertBuffer, stringifyNative } from './wide-source-surface-three-fixture.mjs';
import { createWideSourceSurfaceThreeHost } from './wide-source-surface-three-checkpoint.mjs';
const output=process.env.LOADER1340_EVIDENCE, directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples');
const sha=value=>createHash('sha256').update(value).digest('hex');
const files=new Map(PINS.map(pin=>[pin.file,{pin,bytes:readFileSync(resolve(directory,pin.file))}]));
for(const{pin,bytes}of files.values()){assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256);}
assert.equal(PINS.length,8);assert.equal(PINS.reduce((sum,pin)=>sum+pin.bytes,0),301165);
const requests=[];
const server=createServer((request,response)=>{
  const url=new URL(request.url,'http://127.0.0.1'),file=decodeURIComponent(url.pathname.slice(1)),item=files.get(file);
  if(!item){response.statusCode=404;response.end();return;}
  const row={index:requests.length,file,bytes:item.bytes.length,method:request.method,responseClosed:false};requests.push(row);
  response.setHeader('Content-Type',file.endsWith('.css')?'text/plain; charset=utf-8':'application/json; charset=utf-8');
  response.setHeader('Content-Length',item.bytes.length);response.on('close',()=>row.responseClosed=true);response.end(item.bytes);
});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const baseURL='http://127.0.0.1:'+server.address().port;
const scene=new Scene(),camera=new OrthographicCamera(),markerGeometry=new SphereGeometry(1,8,6),markerMaterial=new MeshBasicMaterial({color:0x00ff00}),marker=new Mesh(markerGeometry,markerMaterial);scene.add(marker);
const caller={geometryDisposals:0,materialDisposals:0};markerGeometry.addEventListener('dispose',()=>caller.geometryDisposals++);markerMaterial.addEventListener('dispose',()=>caller.materialDisposals++);
const cameraProfiles={
degree5:{position:[20.862000274658204,29.591999816894532,.872000389099121],quaternion:[.26267957968900363,.2908011371886961,-.08337125990040256,.9162332508956379],halfX:.48921154960939894,halfY:.34788376861112813,near:.00000510000228881836,far:10.200004577636719,marker:[19.9439998626709,30.43350019454956,.132500057220459],scale:.007650003433227539},
maximum:{position:[20.314525000572207,29.675274999380115,.5626500010490417],quaternion:[.26267957968900263,.29080113718869693,-.08337125990040249,.916233250895638],halfX:.19589872917408213,halfY:.13930576296823619,near:.0000025575000047683716,far:5.115000009536743,marker:[19.854174999713898,30.097262500166895,.19181250035762787],scale:.0038362500071525574}};
let family=null,callbackCount=0;
function cameraState(){return{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),projection:camera.projectionMatrix.toArray(),world:camera.matrixWorld.toArray(),markerPosition:marker.position.toArray(),markerScale:marker.scale.toArray()};}
function setFamily(key){const frame=cameraProfiles[key];camera.position.fromArray(frame.position);camera.quaternion.fromArray(frame.quaternion);camera.up.set(0,1,0);camera.left=-frame.halfX;camera.right=frame.halfX;camera.top=frame.halfY;camera.bottom=-frame.halfY;camera.near=frame.near;camera.far=frame.far;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);marker.position.fromArray(frame.marker);marker.scale.setScalar(frame.scale);family=key;}
const host=createWideSourceSurfaceThreeHost({scene,onChange(record){callbackCount++;assert.equal(host.accepted,record);if(record&&family!==record.family)setFamily(record.family);for(const previous of host.records)if(previous!==record)for(const row of previous.resources){assert.equal(row.geometryDisposals,1,'Previous owned geometry released before callback');assert.equal(row.materialDisposals,1,'Previous owned material released before callback');}assert.equal(marker.parent,scene);assert.deepEqual(caller,{geometryDisposals:0,materialDisposals:0});}});
const pins=[];
async function readText(file,pin){const response=await fetch(baseURL+'/'+file),bytes=new Uint8Array(await response.arrayBuffer());assert.equal(response.status,200);assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256);assert.equal(response.headers.get('content-length'),String(pin.bytes));assert.equal(response.headers.get('content-type'),file.endsWith('.css')?'text/plain; charset=utf-8':'application/json; charset=utf-8');pins.push({...pin,status:response.status,contentType:response.headers.get('content-type'),contentLength:response.headers.get('content-length')});return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
function refs(value,set=new Set()){if(value!==null&&typeof value==='object'&&!set.has(value)){set.add(value);for(const item of Object.values(value))refs(item,set);}return set;}
function zeros(value,path='$',paths=[]){if(typeof value==='number'&&Object.is(value,-0))paths.push(path);else if(value!==null&&typeof value==='object')for(const[key,item]of Object.entries(value))zeros(item,path+'.'+key,paths);return paths;}
function rowValues(row){return{surfaceId:row.surfaceId,attributes:Object.fromEntries(Object.entries(row.attributes).map(([name,entry])=>[name,{values:[...entry.values],itemSize:entry.attribute.itemSize,type:entry.array.constructor.name}])),indices:[...row.indices],indexType:row.indexArray.constructor.name,geometryDisposals:row.geometryDisposals,materialDisposals:row.materialDisposals};}
function checkTarget(record){assert.equal(record.result.group.parent,scene);assert.equal(record.resources.length,2);assert.equal(record.result.model.objects.length,3);assertNative(record.result.model.objects.map(object=>object.id),['context_curve','target_surface','context_plane']);assertNative(record.result.unrenderedCurveIds,['context_curve']);assert.equal(record.result.curves.length,0);assert.equal(record.result.group.children.length,2);for(const row of record.resources){assert.equal(row.object.parent,record.result.group);assert.equal(row.object.visible,true);assertBuffer(row.object.matrix.elements,[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);const surface=record.result.surfaces.find(item=>item.surfaceId===row.surfaceId);assert.ok(surface);for(const[name,data]of[['position',surface.mesh.positions],['normal',surface.mesh.normals],['_CAD_UV',surface.mesh.parameters]]){const entry=row.attributes[name];assert.equal(row.geometry.getAttribute(name),entry.attribute);assert.equal(entry.attribute.array,entry.array);assert.notEqual(entry.array,data);assertBuffer(entry.array,data);assertBuffer(entry.values,data);assert.equal(entry.array.constructor.name,'Float32Array');}assert.equal(row.indexArray,surface.mesh.indices);assert.equal(row.geometry.getIndex(),row.indexAttribute);assert.equal(row.indexAttribute.array,row.indexArray);assertBuffer(row.indices,surface.mesh.indices);assert.equal(row.indexArray.constructor.name,'Uint16Array');assert.equal(row.attributes.position.attribute.count,153);assert.equal(row.attributes.normal.attribute.count,153);assert.equal(row.attributes._CAD_UV.attribute.count,153);assert.equal(row.indices.length,768);assert.equal(row.geometryDisposals,0);assert.equal(row.materialDisposals,0);}}
function retained(){const record=host.accepted;return{record,model:record.model,result:record.result,proof:record.proof,readout:record.readout,asset:record.asset,values:structuredClone({source:record.source,model:record.model,resultSource:record.result.source,resultModel:record.result.model,surfaces:record.result.surfaces,proof:record.proof,readout:record.readout,sourceEdit:record.sourceEdit,asset:record.asset}),sceneChildren:[...scene.children],groupChildren:[...record.result.group.children],camera:cameraState(),rows:record.resources.map(row=>({row,attributes:Object.fromEntries(Object.entries(row.attributes).map(([name,entry])=>[name,{attribute:entry.attribute,array:entry.array,values:Array.from(entry.array)}])),indexAttribute:row.indexAttribute,indexArray:row.indexArray,indices:[...row.indices]}))};}
function checkRetained(before){assert.equal(host.accepted,before.record);const record=host.accepted;for(const field of ['model','result','proof','readout','asset'])assert.equal(record[field],before[field]);assertNative({source:record.source,model:record.model,resultSource:record.result.source,resultModel:record.result.model,surfaces:record.result.surfaces,proof:record.proof,readout:record.readout,sourceEdit:record.sourceEdit,asset:record.asset},before.values);assert.deepEqual(scene.children,before.sceneChildren);assert.deepEqual(record.result.group.children,before.groupChildren);assertNative(cameraState(),before.camera);checkTarget(record);for(const item of before.rows){for(const[name,entry]of Object.entries(item.attributes)){assert.equal(item.row.geometry.getAttribute(name),entry.attribute);assert.equal(entry.attribute.array,entry.array);assertBuffer(entry.array,entry.values);}assert.equal(item.row.geometry.getIndex(),item.indexAttribute);assert.equal(item.indexAttribute.array,item.indexArray);assertBuffer(item.indexArray,item.indices);}assert.deepEqual(caller,{geometryDisposals:0,materialDisposals:0});}
const phases=[];
function recordPhase(label){const record=host.accepted;checkTarget(record);phases.push({label,assetKey:record.assetKey,state:record.state,source:record.source,model:record.model,proof:record.proof,sourceEdit:record.sourceEdit,readout:record.readout,camera:cameraState(),resources:record.resources.map(rowValues),nativeNegativeZeroPaths:zeros(record.proof.edit),modelNegativeZeroPaths:zeros(record.model)});return record;}
let sourceRefusals,transportRefusals,cold;
try{
 const assets=new Map();for(const key of CASE_KEYS)assets.set(key,await loadCase(key,readText));assert.equal(pins.length,8);
 const degree5=assets.get('degree5'),maximum=assets.get('maximum');host.loadOriginal(degree5);recordPhase('degree5-original');const before=retained(),pairsBefore=host.allResources.length;
 let sourceCallbacks=0;sourceRefusals=await host.runRefusals(degree5,()=>{sourceCallbacks++;checkRetained(before);assert.equal(host.allResources.length,pairsBefore);});assert.equal(sourceCallbacks,9);assert.equal(sourceRefusals.refusals.length,9);assert.equal(sourceRefusals.getterCalls,0);assert.ok(sourceRefusals.acceptedRetained);
 const transportURL=baseURL+'/'+degree5.pins.find(pin=>pin.file.endsWith('complete-original.source0.css')).file,expectedDeltas=[0,1,1,1,0],transportDeltas=[];let cursor=requests.length;
 transportRefusals=await host.runTransportRefusals(transportURL,()=>{checkRetained(before);assert.equal(host.allResources.length,pairsBefore);const delta=requests.length-cursor;assert.equal(delta,expectedDeltas[transportDeltas.length]);transportDeltas.push(delta);cursor=requests.length;});assert.equal(transportRefusals.refusals.length,5);assert.equal(transportRefusals.getterCalls,0);assert.ok(transportRefusals.acceptedRetained);assert.deepEqual(transportDeltas,expectedDeltas);
 host.applyEdit(degree5);recordPhase('degree5-edited');host.loadOriginal(maximum);recordPhase('maximum-original');host.applyEdit(maximum);const edited=recordPhase('maximum-edited');
 const editedSnapshot=structuredClone({model:edited.model,proof:edited.proof,readout:edited.readout,source:edited.source,resources:edited.resources.map(row=>({surfaceId:row.surfaceId,attributes:Object.fromEntries(Object.entries(row.attributes).map(([name,entry])=>[name,[...entry.values]])),indices:[...row.indices]}))});
 const fresh=await loadCase('maximum',readText);assertNative(fresh,maximum,'Fresh complete maximum family differs');const coldURL=baseURL+'/'+fresh.pins.find(pin=>pin.file.endsWith('complete-candidate.source0.css')).file;await host.coldReopen(fresh,coldURL,{});const reopened=recordPhase('cold-reopen');assertNative({model:reopened.model,proof:reopened.proof,readout:reopened.readout,source:reopened.source,resources:reopened.resources.map(row=>({surfaceId:row.surfaceId,attributes:Object.fromEntries(Object.entries(row.attributes).map(([name,entry])=>[name,[...entry.values]])),indices:[...row.indices]}))},editedSnapshot,'Whole cold native/readout/buffers differ');cold={freshWholeAssetEqual:true,wholeProofReadoutBuffersEqual:true,cameraEqual:true};assertNative(phases[3].camera,phases[4].camera);
 for(const asset of assets.values()){const ownedPin=asset.pins.find(pin=>pin.file.endsWith('owned-result.json')),candidatePin=asset.pins.find(pin=>pin.file.endsWith('complete-candidate.source0.css'));const ownedBytes=Buffer.from(stringifyNative(asset.owned,0),'utf8'),candidateBytes=Buffer.from(asset.candidateSource,'utf8');for(const[pin,bytes]of[[ownedPin,ownedBytes],[candidatePin,candidateBytes]]){assert.equal(bytes.length,pin.bytes);assert.equal(sha(bytes),pin.sha256);writeFileSync(resolve(output,pin.file.split('/').at(-1)),bytes);assertBuffer(readFileSync(resolve(output,pin.file.split('/').at(-1))),bytes);}}
 const nativeBeforeCleanup=host.records.map(record=>structuredClone({source:record.source,model:record.model,proof:record.proof,readout:record.readout}));host.dispose();host.dispose();assert.equal(host.accepted,null);assert.deepEqual(scene.children,[marker]);assert.equal(callbackCount,6);assert.equal(host.records.length,5);assert.equal(host.allResources.length,10);assert.equal(new Set(host.allResources.map(row=>row.geometry)).size,10);assert.equal(new Set(host.allResources.map(row=>row.material)).size,10);assert.equal(host.allGroups.length,5);assert.equal(new Set(host.allGroups).size,5);assert.equal(host.counts.pairs,10);assert.equal(host.counts.livePairs,0);assert.equal(host.counts.peakLivePairs,4);assert.equal(host.counts.callbacks,6);
 for(const[index,record]of host.records.entries()){assertNative({source:record.source,model:record.model,proof:record.proof,readout:record.readout},nativeBeforeCleanup[index]);assert.equal(record.result.group.parent,null);assert.equal(record.result.group.children.length,0);for(const row of record.resources){assert.equal(row.geometryDisposals,1);assert.equal(row.materialDisposals,1);for(const[name,entry]of Object.entries(row.attributes)){assert.equal(row.geometry.getAttribute(name),entry.attribute);assert.equal(entry.attribute.array,entry.array);assertBuffer(entry.array,entry.values);}assert.equal(row.geometry.getIndex(),row.indexAttribute);assert.equal(row.indexAttribute.array,row.indexArray);assertBuffer(row.indexArray,row.indices);}}
 assert.deepEqual(caller,{geometryDisposals:0,materialDisposals:0});assert.equal(marker.geometry,markerGeometry);assert.equal(marker.material,markerMaterial);assert.equal(marker.parent,scene);assert.equal(pins.length,12);assert.equal(requests.length,16);
 phases.push({label:'cleanup',accepted:null,counts:{...host.counts},caller:{...caller},resources:host.allResources.map(rowValues),nativeCPUReadable:true,camera:cameraState()});
 const summary={result:'wide-whole-source-Three-CPU-flow-ok',options:{sourceVersion:0,countU:17,countV:9,unitsPerMillimeter:.001},pins,phases,sourceRefusals,transportRefusals,transportDeltas,cold,counts:{...host.counts},caller,cleanup:{allGroupsDetached:true,actualGeometryDisposals:host.allResources.map(row=>row.geometryDisposals),actualMaterialDisposals:host.allResources.map(row=>row.materialDisposals),nativeCPUReadable:true},limits:'Actual CPU public provider/neutral/Three resources/HTTP/file proof only. No Node DOM/GPU/pixel or dynamic native allocation telemetry.'};writeFileSync(resolve(output,'summary.json'),stringifyNative(summary));writeFileSync(resolve(output,'http-ledger.json'),JSON.stringify({baseURL,requests},null,2));writeFileSync(resolve(output,'physical-resources.json'),JSON.stringify(host.allResources.map(row=>({surfaceId:row.surfaceId,geometryUuid:row.geometry.uuid,materialUuid:row.material.uuid})),null,2));console.log(JSON.stringify({result:summary.result,phases:phases.length,pairs:10,groups:5,peakLivePairs:host.counts.peakLivePairs,callbacks:callbackCount,sourceRefusals:sourceRefusals.refusals.length,transportRefusals:transportRefusals.refusals.length,pins:pins.length,literalRequests:requests.length,caller}));
}finally{host.dispose();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
`;

function graphReceipt(bundle, label) {
  const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
  const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
  const ownSource = own.filter(path => path.includes('/src/')), ownCompiled = own.filter(path => path.includes('/dist/'));
  assert.ok(own.length > 0);
  assert.equal(compiled ? ownSource.length : ownCompiled.length, 0, label + ' public closure mode');
  for (const leaf of ['source-surface-control-net-wide', 'native', 'three']) assert.ok(own.some(path => path.endsWith('/' + leaf + (compiled ? '.js' : '.ts'))), 'Actual authority leaf: ' + leaf);
  const oldExamples = inputs.filter(path => path.startsWith(examples + '/') && !path.split('/').at(-1).startsWith('wide-source-surface-three'));
  assert.deepEqual(oldExamples, []);
  return { label, compiled, node: process.version, ownSourceCount: ownSource.length, ownCompiledCount: ownCompiled.length, ownSource: ownSource.map(path => relative(root, path)), ownCompiled: ownCompiled.map(path => relative(root, path)), oldExampleImports: oldExamples };
}
const bundle = await build({ absWorkingDir: root, stdin: { contents: consumer, resolveDir: examples, sourcefile: 'wide-source-surface-three-private-consumer.mjs' }, bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', metafile: true, ...modeOptions });
await writeFile(resolve(output, 'consumer-source.mjs'), consumer);
await writeFile(resolve(output, 'consumer.bundle.mjs'), bundle.outputFiles[0].text);
await writeFile(resolve(output, 'consumer-metafile.json'), JSON.stringify(bundle.metafile, null, 2));
await writeFile(resolve(output, 'graphs.json'), JSON.stringify(graphReceipt(bundle, 'CPU consumer'), null, 2));
const browser = await build({ absWorkingDir: root, entryPoints: [resolve(examples, 'wide-source-surface-three.mjs')], bundle: true, write: false, platform: 'browser', format: 'esm', target: 'es2022', metafile: true, ...modeOptions });
await writeFile(resolve(output, 'browser.bundle.mjs'), browser.outputFiles[0].text);
await writeFile(resolve(output, 'browser-metafile.json'), JSON.stringify(browser.metafile, null, 2));
await writeFile(resolve(output, 'browser-graphs.json'), JSON.stringify(graphReceipt(browser, 'browser composition; execution unrun'), null, 2));
await writeFile(resolve(output, 'public-resolutions.json'), JSON.stringify(resolutions, null, 2));
const configurationPath = resolve(examples, 'wide-source-surface-three.config.mjs');
// Retain the owned config's original file base when saving its external bundle.
const configuration = await build({ absWorkingDir: root, entryPoints: [configurationPath], define: { 'import.meta.url': JSON.stringify(pathToFileURL(configurationPath).href) }, bundle: true, write: false, platform: 'node', format: 'esm', target: 'es2022', metafile: true, ...modeOptions });
await writeFile(resolve(output, 'browser-config.mjs'), configuration.outputFiles[0].text);
await writeFile(resolve(output, 'config-metafile.json'), JSON.stringify(configuration.metafile, null, 2));
const run = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: bundle.outputFiles[0].text, encoding: 'utf8', timeout: 60000, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOADER1340_EVIDENCE: output } });
await writeFile(resolve(output, 'consumer.stdout'), run.stdout ?? '');
await writeFile(resolve(output, 'consumer.stderr'), run.stderr ?? '');
await writeFile(resolve(output, 'consumer.exit'), String(run.status));
await writeFile(resolve(output, 'consumer.result.json'), JSON.stringify({ status: run.status, signal: run.signal, error: run.error ? { name: run.error.name, code: run.error.code ?? null, message: run.error.message } : null, timeoutMs: 60000 }, null, 2));
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? '');
assert.equal(run.status, 0, 'Actual public wide Source CPU consumer failed');

if (compiled) {
  const interop = packages.get('@barocss/cad-interop');
  const baselineRun = spawnSync('git', ['show', 'd96315f09b9e161f5bab1f57282efe013db2bb2a:packages/barocss-cad-interop/package.json'], { cwd: root, encoding: 'utf8', timeout: 30000 });
  assert.equal(baselineRun.status, 0);
  const baseline = JSON.parse(baselineRun.stdout);
  assert.equal(Object.keys(baseline.exports).length, 37);
  assert.deepEqual(interop.manifest.exports, baseline.exports);
  assert.deepEqual(interop.manifest.publishConfig.exports, baseline.publishConfig.exports);
  for (const entry of Object.values(interop.manifest.publishConfig.exports)) { await access(resolve(interop.directory, entry.import)); await access(resolve(interop.directory, entry.types)); }
  const typeSource = String.raw`
import { editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit, type SourceSurfaceControlNetWideRequest, type SourceSurfaceControlNetWideResult, type SourceSurfaceControlNetWideReport } from '@barocss/cad';
import { parseBaroCadSource, type BaroCadParseOptions, type BaroCadNativeResult, type BaroCadLoadTransportOptions } from '@barocss/cad-interop/native';
import { BaroCADLoader, type BaroCadThreeResult } from '@barocss/cad-interop/three';
export function publicWideSourceContract(request: SourceSurfaceControlNetWideRequest, url: string, transport: BaroCadLoadTransportOptions): Promise<BaroCadThreeResult> {
  const edit: SourceSurfaceControlNetWideResult = editSourceSurfaceControlNetWide(request);
  const report: SourceSurfaceControlNetWideReport = validateSourceSurfaceControlNetWideEdit(edit);
  const options: BaroCadParseOptions = { sourceVersion: 0, countU: 17, countV: 9, unitsPerMillimeter: .001 };
  const native: BaroCadNativeResult = parseBaroCadSource(edit.source, options);
  const loader = new BaroCADLoader(options), target: BaroCadThreeResult = loader.parse(edit.source);
  const position: Float32Array = native.surfaces[0].mesh.positions;
  const parameters: Float32Array = native.surfaces[0].mesh.parameters;
  void [edit.originalModel.objects, edit.model.objects, edit.surface.degreeU, edit.patches[0].replacementText, report.directCounts.derivativeSuccessCount, target.group.children, position, parameters, transport.signal];
  target.dispose();
  return loader.loadAbortable(url, transport);
}
`;
  const virtual = resolve(examples, 'private-wide-source-published-contract.mts');
  const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true, skipLibCheck: true, types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] };
  const host = ts.createCompilerHost(compilerOptions), get = host.getSourceFile.bind(host), exists = host.fileExists.bind(host), read = host.readFile.bind(host), typeResolutions = [];
  host.getSourceFile = (path, version, onError, newFile) => resolve(path) === virtual ? ts.createSourceFile(virtual, typeSource, version, true, ts.ScriptKind.TS) : get(path, version, onError, newFile);
  host.fileExists = path => resolve(path) === virtual || exists(path);
  host.readFile = path => resolve(path) === virtual ? typeSource : read(path);
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    if (/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)) { const path = published(name, 'types'); typeResolutions.push({ name, importer: relative(root, containingFile), target: relative(root, path) }); return { resolvedFileName: path, extension: ts.Extension.Dts, isExternalLibraryImport: true }; }
    return ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule;
  });
  const program = ts.createProgram([virtual], compilerOptions, host);
  const diagnostics = ts.getPreEmitDiagnostics(program).map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'), file: item.file ? relative(root, item.file.fileName) : null }));
  const ownDeclarations = program.getSourceFiles().map(file => resolve(file.fileName)).filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
  const sourceFallbacks = ownDeclarations.filter(path => path.includes('/src/'));
  await writeFile(resolve(output, 'published-types.json'), JSON.stringify({ compiler: ts.version, strict: true, noEmit: true, skipLibCheck: true, diagnostics, sourceFallbacks, ownDeclarations: ownDeclarations.map(path => relative(root, path)), typeResolutions, maps: 37 }, null, 2));
  await writeFile(resolve(output, 'published-type-consumer.mts'), typeSource);
  assert.deepEqual(diagnostics, []); assert.deepEqual(sourceFallbacks, []);
  for (const leaf of ['source-surface-control-net-wide', 'native', 'three']) assert.ok(ownDeclarations.some(path => path.endsWith('/' + leaf + '.d.ts')));
}
console.log(JSON.stringify({ mode: compiled ? 'compiled' : 'source', scope: 'Actual CPU file/HTTP/Three object flow; browser composition saved, headed execution belongs to Root', types: compiled ? 'actual emitted selected declarations' : 'unrun' }));
