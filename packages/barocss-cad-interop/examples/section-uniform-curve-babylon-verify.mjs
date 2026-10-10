import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd(), examples = resolve(root, 'packages/barocss-cad-interop/examples');
const args = process.argv, mode = args[args.indexOf('--mode') + 1], output = resolve(args[args.indexOf('--output') + 1]);
assert.ok(['source', 'compiled'].includes(mode)); assert.ok(Number(process.versions.node.split('.')[0]) >= 22); await mkdir(output, { recursive: true });
const packages = new Map();
for (const name of ['cad', 'cad-interop']) {
  const directory = resolve(root, 'packages/barocss-' + name), manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  packages.set('@barocss/' + name, { directory, manifest });
  if (mode === 'source') { let exists = false; try { await access(resolve(directory, 'dist')); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; } assert.equal(exists, false, 'Run source before own dist'); }
}
function published(name, field) {
  const packageName = name.split('/').slice(0, 2).join('/'), item = packages.get(packageName), suffix = name.slice(packageName.length), key = suffix ? '.' + suffix : '.';
  const target = item?.manifest.publishConfig?.exports?.[key]?.[field]; assert.ok(target?.startsWith('./dist/')); return resolve(item.directory, target);
}
const resolutions = [], plugin = { name: 'actual-published-own-entry', setup(builder) {
  builder.onResolve({ filter: /^@barocss\/(cad|cad-interop)(\/|$)/ }, args => { const path = published(args.path, 'import'); resolutions.push({ specifier: args.path, importer: relative(root, args.importer), path: relative(root, path) }); return { path }; });
} };
const consumer = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { LinesMesh } from '@babylonjs/core/Meshes/linesMesh.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer.js';
import * as loaderModule from '@barocss/cad-interop/babylon-uniform-curve';
import * as nativeModule from '@barocss/cad-interop/native-uniform-curve';
import { compileCadModel, buildVLinearSurfacePlaneSection, validateVLinearSurfacePlaneSection, curveDomain, sampleCurve, evaluateCurve, evaluateCurveD1 } from '@barocss/cad';
import { PINS, loadSectionAsset, assertNative, assertBuffer, proveSection } from './examples/section-uniform-curve-babylon-fixture.mjs';
import { createSectionUniformBabylonHost } from './examples/section-uniform-curve-babylon-checkpoint.mjs';
import { runUniformBabylonRuntimeCheckpoint } from './test/babylon-uniform-curve.test.mjs';
const data = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/section-uniform-curve-babylon-data'), output = process.env.LOADER1138_EVIDENCE, texts = new Map();
for (const pin of PINS) { const bytes = readFileSync(resolve(data,pin.file)); assert.equal(bytes.length,pin.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256); texts.set(pin.file,bytes.toString('utf8')); }
assert.equal(PINS.length,5); assert.equal(PINS.reduce((sum,pin)=>sum+pin.bytes,0),31991);
const asset = await loadSectionAsset(file=>texts.get(file)), section=proveSection(asset);
const request=JSON.parse(texts.get('polynomial.authored-request.json')), owned=JSON.parse(texts.get('polynomial.owned-section.json'));
const independent=buildVLinearSurfacePlaneSection(request.surfaceAsset,request.planeAsset,request.options);validateVLinearSurfacePlaneSection(independent);validateVLinearSurfacePlaneSection(section);
assertNative(independent,owned,'Independent whole section');assertNative(section,owned);
for(const [source,model,count] of [[request.surfaceAsset.source,section.originalModels[0],3],[request.planeAsset.source,section.originalModels[1],1],[asset.worldSource,section.world.model,1]]){
 const compiled=compileCadModel(source,{sourceVersion:0});assert.equal(compiled.ok,true);assertNative(compiled.model,model);assert.equal(model.objects.length,count);
}
assertNative(asset.surfaceUV,section.pcurves.surface);assertNative(asset.planeUV,section.pcurves.plane);assert.equal(section.observations.length,5);
const focusedRuntime=await runUniformBabylonRuntimeCheckpoint(loaderModule,nativeModule,asset.worldSource);
assert.deepEqual(Object.keys(nativeModule).sort(),['BaroCadUniformCurveSourceError','parseBaroCadUniformCurveSource','validateBaroCadUniformCurveSourceOptions'].sort());
const engine=new NullEngine(), scene=new Scene(engine);scene.useRightHandedSystem=true;
const marker=MeshBuilder.CreateSphere('caller-marker',{diameter:.00024,segments:8},scene),markerGeometry=marker.geometry,markerMaterial=new StandardMaterial('caller-green',scene);marker.material=markerMaterial;
const caller={mesh:0,geometry:0,material:0,scene:0,engine:0};for(const [name,resource] of Object.entries({mesh:marker,material:markerMaterial,scene,engine}))resource.onDisposeObservable.add(()=>caller[name]++);
const markerDispose=markerGeometry.dispose;markerGeometry.dispose=function(...args){caller.geometry++;return markerDispose.apply(this,args);};
let callbacks=0;const host=createSectionUniformBabylonHost({scene,onChange(record){callbacks++;assert.equal(host.accepted,record);for(const old of host.records)if(old!==record)for(const row of old.resources){assert.equal(row.meshDisposals,1);assert.equal(row.geometryDisposals,1);assert.equal(row.materialDisposals,1);}}});
const observations=[];
function inspect(){
 const record=host.accepted;assert.ok(record);assertNative(record.section,independent);assertNative(record.native.model,section.world.model);
 const line=record.result.line;assert.ok(line instanceof LinesMesh);assert.ok(line.material instanceof ShaderMaterial);assert.equal(line.parent,null);assert.equal(line.isEnabled(),true);assert.deepEqual(scene.meshes,[marker,line]);
 const positions=line.getVerticesData(VertexBuffer.PositionKind),indices=line.getIndices();assert.equal(positions.length,387);assert.equal(line.getTotalVertices(),129);assert.equal(indices.length,256);assertBuffer(positions,record.native.positions);
 assert.deepEqual(Array.from(indices),Array.from({length:128},(_,i)=>[i,i+1]).flat());
 assertNative(line.color.asArray(),[40/255,201/255,235/255]);assertNative(record.native.domain,curveDomain(section.world.curve));
 const samples=sampleCurve(section.world.curve,129);assertNative(record.native.parameters,samples.map(x=>x.parameter));assertNative(record.native.pointsMM,samples.map(x=>x.point));assert.equal(record.native.intervals.length,128);
 for(const [i,sample] of samples.entries())for(let axis=0;axis<3;axis++)assert.ok(Object.is(positions[i*3+axis],Math.fround(sample.point[axis]*.001)));
 for(const [i,original] of section.observations.entries()){assert.equal(record.native.parameters[i*32],original.parameter);assertNative(record.native.pointsMM[i*32],evaluateCurve(section.world.curve,original.parameter));assertNative(original.world.d1,evaluateCurveD1(section.world.curve,original.parameter));}
 assertNative(line.position.asArray(),[0,0,0]);assertNative(line.rotation.asArray(),[0,0,0]);assertNative(line.scaling.asArray(),[1,1,1]);
 const observation={state:record.state,section:structuredClone(record.section),native:structuredClone(record.native),readout:structuredClone(record.readout),targetPositions:Array.from(positions),targetIndices:Array.from(indices)};observations.push(observation);return observation;
}
host.load(asset);const first=inspect(),accepted=host.accepted,refs={section:accepted.section,native:accepted.native,result:accepted.result,buffer:accepted.result.line.getVerticesData(VertexBuffer.PositionKind),indices:accepted.result.line.getIndices(),meshes:[...scene.meshes]};
const synchronous=host.runRefusals(asset);assert.equal(synchronous.refusals.length,17);assert.equal(synchronous.getterCalls,0);assert.equal(host.accepted,accepted);assert.equal(host.allResources.length,2);
let requests=0;const server=createServer((request,response)=>{requests++;const bytes=Buffer.from(asset.worldSource);response.writeHead(200,{'Content-Type':'text/plain; charset=utf-8','Content-Length':bytes.length});response.end(bytes);});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port+'/polynomial.actual-world.source0.css';let transport;
try{
 transport=await host.runTransportRefusals(url);assert.equal(transport.refusals.length,5);assert.equal(transport.getterCalls,0);assert.equal(host.accepted,accepted);
 assert.equal(accepted.section,refs.section);assert.equal(accepted.native,refs.native);assert.equal(accepted.result,refs.result);assert.equal(accepted.result.line.getVerticesData(VertexBuffer.PositionKind),refs.buffer);assert.equal(accepted.result.line.getIndices(),refs.indices);assert.deepEqual(scene.meshes,refs.meshes);
 const fresh=await loadSectionAsset(file=>readFileSync(resolve(data,file),'utf8'));await host.coldReopen(fresh,url);const cold=inspect();for(const field of ['section','native','readout','targetPositions','targetIndices'])assertNative(cold[field],first[field],'Cold exact '+field);
}finally{await new Promise(resolve=>server.close(resolve));}
assert.equal(host.records.length,2);assert.equal(host.allResources.length,3);assert.equal(host.counts.peakLiveTriples,2);
for(const key of ['mesh','geometry','material'])assert.equal(new Set(host.allResources.map(row=>row[key])).size,3);
host.dispose();host.dispose();assert.equal(host.accepted,null);assert.equal(callbacks,3);assert.equal(host.counts.liveTriples,0);assert.deepEqual(scene.meshes,[marker]);assert.deepEqual(caller,{mesh:0,geometry:0,material:0,scene:0,engine:0});
for(const row of host.allResources){assert.equal(row.meshDisposals,1);assert.equal(row.geometryDisposals,1);assert.equal(row.materialDisposals,1);assertBuffer(row.positionArray,row.positions);assertBuffer(row.indexArray,row.indices);assert.equal(row.mesh.isDisposed(),true);assert.equal(row.geometry.isDisposed(),true);}
for(const record of host.records){validateVLinearSurfacePlaneSection(record.section);assertNative(record.section,independent);assertNative(record.native.model,section.world.model);assertBuffer(record.result.positions,record.native.positions);}
const summary={result:'section-uniform-babylon-source-or-compiled-cpu-ok',pins:PINS,focusedRuntime,observations,synchronous,transport,counts:host.counts,HTTPrequests:requests,callbacks,caller,scope:'Whole original section/cold Models/dualUV/new Babylon public runtime/NullEngine/local HTTP/refusals/lifetime. Browser and published declaration proof separate.'};
writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({result:summary.result,counts:host.counts,HTTPrequests:requests,callbacks,caller}));
// Explicit teardown by test caller occurs after the retained-caller evidence above.
scene.dispose();engine.dispose();
`;
const options = { absWorkingDir: root, bundle: true, format: 'esm', target: 'es2022', write: false, metafile: true, ...(mode === 'compiled' ? { plugins: [plugin] } : {}) };
const compiled = await build({ ...options, stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'section1138-public-consumer.mjs' }, platform: 'node' });
function graph(result) { const inputs = Object.keys(result.metafile.inputs).map(path => resolve(root, path));
  const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
  const source = own.filter(path => path.includes('/src/')), dist = own.filter(path => path.includes('/dist/'));
  assert.ok(own.length > 0); assert.equal(mode === 'source' ? dist.length : source.length, 0); return { sourceCount: source.length, compiledCount: dist.length, ownSource: source.map(path => relative(root, path)), ownCompiled: dist.map(path => relative(root, path)) };
}
const graphs = { mode, node: process.version, consumer: graph(compiled), resolutions };
if (mode === 'source') {
  const browser = await build({ ...options, entryPoints: [resolve(examples, 'section-uniform-curve-babylon.mjs')], platform: 'browser' }); graphs.browser = graph(browser);
  const config = await build({ ...options, entryPoints: [resolve(examples, 'section-uniform-curve-babylon.config.mjs')], platform: 'node', packages: 'external' });
  await writeFile(resolve(output, 'browser-metafile.json'), JSON.stringify(browser.metafile, null, 2)); await writeFile(resolve(output, 'config-metafile.json'), JSON.stringify(config.metafile, null, 2));
}
await writeFile(resolve(output, 'graphs.json'), JSON.stringify(graphs, null, 2)); await writeFile(resolve(output, 'consumer-metafile.json'), JSON.stringify(compiled.metafile, null, 2));
const execution = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: compiled.outputFiles[0].text, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOADER1138_EVIDENCE: output } });
await writeFile(resolve(output, 'consumer.stdout'), execution.stdout ?? ''); await writeFile(resolve(output, 'consumer.stderr'), execution.stderr ?? ''); await writeFile(resolve(output, 'consumer.exit'), String(execution.status));
process.stdout.write(execution.stdout ?? ''); process.stderr.write(execution.stderr ?? ''); assert.equal(execution.status, 0, 'Actual public consumer failed');
if (mode === 'compiled') {
  const interop = packages.get('@barocss/cad-interop'), development = interop.manifest.exports, publishedMap = interop.manifest.publishConfig.exports;
  assert.deepEqual(Object.keys(development).sort(), Object.keys(publishedMap).sort()); assert.ok(Object.keys(development).length >= 30); assert.ok(development['./babylon-uniform-curve']);
  for (const [key, entry] of Object.entries(publishedMap)) { assert.equal(development[key].import, entry.import.replace('/dist/', '/src/').replace(/\.js$/, '.ts')); assert.equal(entry.types, entry.import.replace(/\.js$/, '.d.ts')); await access(resolve(interop.directory, entry.import)); await access(resolve(interop.directory, entry.types)); }
  const typeFile = resolve(interop.directory, 'test/babylon-uniform-curve.types.ts'), compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true, skipLibCheck: true, types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] }, host = ts.createCompilerHost(compilerOptions), typeResolutions = [];
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    if (/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)) { const path = published(name, 'types'); typeResolutions.push({ name, importer: relative(root, containingFile), target: relative(root, path) }); return { resolvedFileName: path, extension: ts.Extension.Dts, isExternalLibraryImport: true }; }
    return ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule;
  });
  const program = ts.createProgram([typeFile], compilerOptions, host), diagnostics = ts.getPreEmitDiagnostics(program).map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'), file: item.file ? relative(root, item.file.fileName) : null }));
  const files = program.getSourceFiles().map(file => resolve(file.fileName)), own = files.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/'))), sourceFallbacks = own.filter(path => path.includes('/src/'));
  const types = { compiler: ts.version, strict: true, noEmit: true, skipLibCheck: true, diagnostics, sourceFallbacks, ownDeclarations: own.map(path => relative(root, path)), peerDeclarations: files.filter(path => path.includes('/node_modules/') && path.endsWith('.d.ts')).length, resolutions: typeResolutions, maps: Object.keys(development).length, scope: 'New optional entry and native validator with transitive CAD declarations; normal peer resolution, no full peer or all-entry runtime certificate' };
  await writeFile(resolve(output, 'published-types.json'), JSON.stringify(types, null, 2)); assert.deepEqual(diagnostics, []); assert.deepEqual(sourceFallbacks, []); assert.ok(own.some(path => path.endsWith('/babylon-uniform-curve.d.ts')));
}
console.log(JSON.stringify({ mode, consumerSource: graphs.consumer.sourceCount, consumerCompiled: graphs.consumer.compiledCount, publishedTypes: mode === 'compiled' ? 'checked' : 'unrun' }));
