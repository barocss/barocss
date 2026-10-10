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
import { readFileSync,writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { Scene } from 'three';
import { PINS,FAMILY_NAMES,loadCurveEditAssets,proveCurveEditAsset,assertNative,assertBuffer } from './examples/source-curve-control-polygon-three-fixture.mjs';
import { createSourceCurveControlPolygonThreeHost } from './examples/source-curve-control-polygon-three-checkpoint.mjs';
import { runSelectedUniformCurveRuntimeCheckpoint } from './test/selected-uniform-curve.test.mjs';
import { parseBaroCadSelectedUniformCurveSource } from '@barocss/cad-interop/native-selected-uniform-curve';
const data=resolve(process.cwd(),'packages/barocss-cad-interop/examples/source-curve-control-polygon-three-data'), output=process.env.LOADER1151_EVIDENCE, texts=new Map();
for(const pin of PINS){const bytes=readFileSync(resolve(data,pin.file));assert.equal(bytes.length,pin.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256);texts.set(pin.file,bytes.toString('utf8'));}
assert.equal(PINS.length,24);assert.equal(PINS.reduce((s,p)=>s+p.bytes,0),116232);
const assets=await loadCurveEditAssets(file=>texts.get(file));const native=[];
for(const name of FAMILY_NAMES){const asset=assets.get(name);proveCurveEditAsset(asset);const value=parseBaroCadSelectedUniformCurveSource(asset.originalSource,{sourceVersion:0,unitsPerMillimeter:.001,uniformCurveDisplay:{version:1,count:129},curveId:'target_curve'});assert.equal(value.model.objects.length,3);assert.equal(value.selectedObjectIndex,1);assert.equal(value.parameters.length,129);assert.deepEqual(value.unrenderedObjectIds,['context_curve','context_plane']);native.push({name,degree:value.curve.degree,poles:value.curve.controlPoints.length,domain:value.domain});}
const focusedRuntime=await runSelectedUniformCurveRuntimeCheckpoint(assets.get(FAMILY_NAMES[0]));
const scene=new Scene();let callbacks=0;const host=createSourceCurveControlPolygonThreeHost({scene,onChange(){callbacks++;}});host.loadOriginal(assets.get(FAMILY_NAMES[0]));
function retained(){const r=host.accepted,a=r.result.line.geometry.getAttribute('position');return{record:r,result:r.result,geometry:r.result.line.geometry,material:r.result.line.material,attribute:a,array:a.array,data:Array.from(a.array),readout:structuredClone(r.readout),children:[...scene.children],callbacks};}
function check(before){const r=host.accepted;assert.equal(r,before.record);assert.equal(r.result,before.result);assert.equal(r.result.line.geometry,before.geometry);assert.equal(r.result.line.material,before.material);assert.equal(r.result.line.geometry.getAttribute('position'),before.attribute);assert.equal(before.attribute.array,before.array);assertBuffer(before.array,before.data);assertNative(r.readout,before.readout);assert.deepEqual(scene.children,before.children);assert.equal(callbacks,before.callbacks);}
const before=retained(), refusals=host.runRefusals(assets.get(FAMILY_NAMES[0]),()=>check(before),assets.get('cold_candidate_reedit').request);assert.equal(refusals.length,21);check(before);
const requests=[];const server=createServer((request,response)=>{const file=decodeURIComponent(new URL(request.url,'http://localhost').pathname.slice(1)),pin=PINS.find(p=>p.file===file);if(!pin){response.statusCode=404;response.end();return;}const bytes=readFileSync(resolve(data,file));requests.push({file,bytes:bytes.length,status:200});response.setHeader('Content-Type',file.endsWith('.css')?'text/plain; charset=utf-8':'application/json; charset=utf-8');response.setHeader('Content-Length',bytes.length);response.end(bytes);});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const url=file=>'http://127.0.0.1:'+server.address().port+'/'+file;
let transport,cold=0;try{
 let last=0;const deltas=[];transport=await host.runTransportRefusals(url(FAMILY_NAMES[0]+'.complete-original.source0.css'),()=>{check(before);deltas.push(requests.length-last);last=requests.length;});assert.equal(transport.length,5);assert.deepEqual(deltas,[0,1,1,1,0]);
 host.apply(assets.get(FAMILY_NAMES[0]));let saved=retained();let coldTexts=new Map(texts);for(const pin of PINS.filter(p=>p.file.startsWith(FAMILY_NAMES[0]+'.')))coldTexts.set(pin.file,readFileSync(resolve(data,pin.file),'utf8'));let fresh=(await loadCurveEditAssets(file=>coldTexts.get(file))).get(FAMILY_NAMES[0]);await host.coldReopen(fresh,url(fresh.family+'.complete-candidate.source0.css'));assertNative(host.accepted.readout,saved.readout);assertBuffer(host.accepted.native.positions,saved.data);cold++;
 host.apply(assets.get('cold_candidate_reedit'));saved=retained();coldTexts=new Map(texts);for(const pin of PINS.filter(p=>p.file.startsWith('cold_candidate_reedit.')))coldTexts.set(pin.file,readFileSync(resolve(data,pin.file),'utf8'));fresh=(await loadCurveEditAssets(file=>coldTexts.get(file))).get('cold_candidate_reedit');await host.coldReopen(fresh,url(fresh.family+'.complete-candidate.source0.css'));assertNative(host.accepted.readout,saved.readout);assertBuffer(host.accepted.native.positions,saved.data);cold++;
 for(const name of ['quintic_actual_native_profile','exact_noop_unusual_decimal_minus_zero','real_minus_zero_coordinate_edit','actual_64_poles_all_256_fields_changed']){host.loadOriginal(assets.get(name));host.apply(assets.get(name));}
 const CPU=host.records.map(r=>structuredClone(r.readout));assert.equal(host.records.length,13);host.dispose();host.dispose();assert.equal(host.accepted,null);assert.equal(host.allResources.length,14);assert.equal(host.counts.livePairs,0);assert.equal(host.counts.peakLivePairs,2);assert.equal(callbacks,14);assert.equal(scene.children.length,0);for(const row of host.allResources){assert.equal(row.geometryDisposals,1);assert.equal(row.materialDisposals,1);}host.records.forEach((r,i)=>assertNative(r.readout,CPU[i]));assert.equal(requests.length,5);
 const summary={result:'complete-source-selected-curve-cpu-ok',pins:PINS,native,focusedRuntime,refusals,transport,cold,requests,counts:host.counts,callbacks,resources:host.allResources.map(r=>({geometryDisposals:r.geometryDisposals,materialDisposals:r.materialDisposals})),fullNativeCPUReadable:true,scope:'Actual ordinary public source/compiled CAD whole editor/validators/files/cold/selected native+Three CPU/actual local HTTP/lifetime. No Renderer/browser/pixels/mock/constructorfault certificate.'};writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({result:summary.result,refusals:refusals.length,transport:transport.length,cold,requests:requests.length,counts:host.counts}));
}finally{await new Promise(done=>server.close(done));}

`;
const options = { absWorkingDir: root, bundle: true, format: 'esm', target: 'es2022', write: false, metafile: true, ...(mode === 'compiled' ? { plugins: [plugin] } : {}) };
const compiled = await build({ ...options, stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'source1151-public-consumer.mjs' }, platform: 'node' });
function graph(result) { const inputs = Object.keys(result.metafile.inputs).map(path => resolve(root, path));
  const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
  const source = own.filter(path => path.includes('/src/')), dist = own.filter(path => path.includes('/dist/'));
  assert.ok(own.length > 0); assert.equal(mode === 'source' ? dist.length : source.length, 0); return { sourceCount: source.length, compiledCount: dist.length, ownSource: source.map(path => relative(root, path)), ownCompiled: dist.map(path => relative(root, path)) };
}
const graphs = { mode, node: process.version, consumer: graph(compiled), resolutions };
const browser=await build({...options,entryPoints:[resolve(examples,'source-curve-control-polygon-three.mjs')],platform:'browser'});graphs.browser=graph(browser);
await writeFile(resolve(output,'browser-metafile.json'),JSON.stringify(browser.metafile,null,2));
if(mode==='compiled')await writeFile(resolve(output,'browser.bundle.mjs'),browser.outputFiles[0].text);
const config=await build({...options,entryPoints:[resolve(examples,'source-curve-control-polygon-three.config.mjs')],platform:'node',packages:'external'});
await writeFile(resolve(output,'config-metafile.json'),JSON.stringify(config.metafile,null,2));
await writeFile(resolve(output, 'graphs.json'), JSON.stringify(graphs, null, 2)); await writeFile(resolve(output, 'consumer-metafile.json'), JSON.stringify(compiled.metafile, null, 2));
const execution = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: compiled.outputFiles[0].text, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOADER1151_EVIDENCE: output } });
await writeFile(resolve(output, 'consumer.stdout'), execution.stdout ?? ''); await writeFile(resolve(output, 'consumer.stderr'), execution.stderr ?? ''); await writeFile(resolve(output, 'consumer.exit'), String(execution.status));
process.stdout.write(execution.stdout ?? ''); process.stderr.write(execution.stderr ?? ''); assert.equal(execution.status, 0, 'Actual public consumer failed');
if (mode === 'compiled') {
  const interop = packages.get('@barocss/cad-interop'), development = interop.manifest.exports, publishedMap = interop.manifest.publishConfig.exports;
  assert.deepEqual(Object.keys(development).sort(), Object.keys(publishedMap).sort()); assert.ok(development["./three-selected-uniform-curve"]); assert.ok(development["./native-selected-uniform-curve"]);
  for (const [key, entry] of Object.entries(publishedMap)) { assert.equal(development[key].import, entry.import.replace('/dist/', '/src/').replace(/\.js$/, '.ts')); assert.equal(entry.types, entry.import.replace(/\.js$/, '.d.ts')); await access(resolve(interop.directory, entry.import)); await access(resolve(interop.directory, entry.types)); }
  const typeFile = resolve(interop.directory, 'test/selected-uniform-curve.types.ts'), compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true, skipLibCheck: true, types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] }, host = ts.createCompilerHost(compilerOptions), typeResolutions = [];
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    if (/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)) { const path = published(name, 'types'); typeResolutions.push({ name, importer: relative(root, containingFile), target: relative(root, path) }); return { resolvedFileName: path, extension: ts.Extension.Dts, isExternalLibraryImport: true }; }
    return ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule;
  });
  const program = ts.createProgram([typeFile], compilerOptions, host), diagnostics = ts.getPreEmitDiagnostics(program).map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'), file: item.file ? relative(root, item.file.fileName) : null }));
  const files = program.getSourceFiles().map(file => resolve(file.fileName)), own = files.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/'))), sourceFallbacks = own.filter(path => path.includes('/src/'));
  const types = { compiler: ts.version, strict: true, noEmit: true, skipLibCheck: true, diagnostics, sourceFallbacks, ownDeclarations: own.map(path => relative(root, path)), peerDeclarations: files.filter(path => path.includes('/node_modules/') && path.endsWith('.d.ts')).length, resolutions: typeResolutions, maps: Object.keys(development).length, scope: 'Both new optional selected entries and transitive CAD declarations; normal peer resolution, not full peer/all-entry runtime certificate' };
  await writeFile(resolve(output, 'published-types.json'), JSON.stringify(types, null, 2)); assert.deepEqual(diagnostics, []); assert.deepEqual(sourceFallbacks, []); assert.ok(own.some(path => path.endsWith('/three-selected-uniform-curve.d.ts')));
}
console.log(JSON.stringify({ mode, consumerSource: graphs.consumer.sourceCount, consumerCompiled: graphs.consumer.compiledCount, publishedTypes: mode === 'compiled' ? 'checked' : 'unrun' }));
