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
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {PINS,FAMILY_NAMES,loadCurveEditAssets,proveCurveEditAsset,assertNative,assertBuffer,createNativeOptions,SourceCurveEditPixi3DHostError,runCurveEditSourceRefusals,runCurveEditTransportRefusals} from './examples/source-curve-control-polygon-pixi3d-fixture.mjs';
import {parseBaroCadSelectedUniformCurveSource} from '@barocss/cad-interop/native-selected-uniform-curve';
import {loadBaroCadSource} from '@barocss/cad-interop/native';
const data=resolve(process.cwd(),'packages/barocss-cad-interop/examples/source-curve-control-polygon-pixi3d-data'),output=process.env.LOADER1178_EVIDENCE,texts=new Map();
for(const pin of PINS){const bytes=readFileSync(resolve(data,pin.file));assert.equal(bytes.length,pin.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256);texts.set(pin.file,bytes.toString('utf8'));}
assert.equal(PINS.length,24);assert.equal(PINS.reduce((sum,pin)=>sum+pin.bytes,0),116232);
const assets=await loadCurveEditAssets(file=>texts.get(file)),native=[];
const parse=(source,options=createNativeOptions())=>parseBaroCadSelectedUniformCurveSource(source,options);
for(const family of FAMILY_NAMES){const asset=assets.get(family),proof=proveCurveEditAsset(asset);
 for(const [state,source,model] of [['original',asset.originalSource,proof.originalModel],['candidate',asset.candidateSource,proof.candidateModel]]){const value=parse(source);assertNative(value.model,model);assert.equal(value.selectedObjectIndex,1);assert.equal(value.parameters.length,129);assert.deepEqual(value.unrenderedObjectIds,['context_curve','context_plane']);native.push({family,state,degree:value.curve.degree,poles:value.curve.controlPoints.length,domain:value.domain});}}
let accepted=null;const records=[];
function make(asset,source,edit){const result=parse(source);return{asset,source,edit,native:result,readout:structuredClone({source,model:result.model,native:result,edit})};}
function original(asset){proveCurveEditAsset(asset);accepted=make(asset,asset.originalSource,null);records.push(accepted);return accepted;}
function apply(asset){if(accepted?.source!==asset.request.source)throw new SourceCurveEditPixi3DHostError('SOURCE_BINDING','The authored edit request must bind the accepted complete original source');const proof=proveCurveEditAsset(asset);assertNative(accepted.native.model,proof.originalModel);accepted=make(asset,asset.candidateSource,proof.edited);records.push(accepted);return accepted;}
original(assets.get(FAMILY_NAMES[0]));const before=accepted,beforeData=structuredClone(accepted);function retained(){assert.equal(accepted,before);assertNative(accepted,beforeData);}
const refusals=runCurveEditSourceRefusals(assets.get(FAMILY_NAMES[0]),parse,apply,retained,assets.get('cold_candidate_reedit').request);assert.equal(refusals.length,20);retained();
const requests=[];const server=createServer((request,response)=>{const file=decodeURIComponent(new URL(request.url,'http://localhost').pathname.slice(1)),pin=PINS.find(pin=>pin.file===file);if(!pin){response.statusCode=404;response.end();return;}const bytes=readFileSync(resolve(data,file));requests.push({file,bytes:bytes.length,status:200});response.setHeader('Content-Type',file.endsWith('.css')?'text/plain; charset=utf-8':'application/json; charset=utf-8');response.setHeader('Content-Length',bytes.length);response.end(bytes);});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const url=file=>'http://127.0.0.1:'+server.address().port+'/'+file;
const ordinaryOptions={sourceVersion:0,countU:2,countV:2,unitsPerMillimeter:.001};let transport,cold=0;
try{
 let last=0;const deltas=[];transport=await runCurveEditTransportRefusals(settings=>loadBaroCadSource(url(FAMILY_NAMES[0]+'.complete-original.source0.css'),ordinaryOptions,settings),()=>{retained();deltas.push(requests.length-last);last=requests.length;});assert.deepEqual(deltas,[0,1,1,1,0]);
 async function coldReopen(asset){const previous=accepted,proof=proveCurveEditAsset(asset);assert.equal(previous.source,asset.candidateSource);assertNative(previous.edit,proof.edited);const loaded=await loadBaroCadSource(url(asset.family+'.complete-candidate.source0.css'),ordinaryOptions);assert.equal(loaded.source,asset.candidateSource);assertNative(loaded.model,proof.candidateModel);accepted=make(asset,loaded.source,proof.edited);assertNative(accepted.readout,previous.readout);assertBuffer(accepted.native.positions,previous.native.positions);records.push(accepted);cold++;}
 apply(assets.get(FAMILY_NAMES[0]));let fresh=(await loadCurveEditAssets(file=>readFileSync(resolve(data,file),'utf8'))).get(FAMILY_NAMES[0]);await coldReopen(fresh);
 apply(assets.get('cold_candidate_reedit'));fresh=(await loadCurveEditAssets(file=>readFileSync(resolve(data,file),'utf8'))).get('cold_candidate_reedit');await coldReopen(fresh);
 for(const family of ['quintic_actual_native_profile','exact_noop_unusual_decimal_minus_zero','real_minus_zero_coordinate_edit','actual_64_poles_all_256_fields_changed']){original(assets.get(family));apply(assets.get(family));}
 assert.equal(records.length,13);assert.equal(requests.length,5);assert.equal(cold,2);const CPU=records.map(record=>structuredClone(record.readout));accepted=null;records.forEach((record,index)=>assertNative(record.readout,CPU[index]));
 const summary={result:'complete-source-selected-curve-native-cpu-ok',pins:PINS,native,refusals,transport,cold,requests,records:records.length,sourceAndNativeReadable:true,targetExecuted:false,scope:'Actual public CAD whole editor/validators/selected-neutral/native shared transport/files/cold/HTTP; no Pixi peer initializer, SDK target, renderer, allocation or GPU lifetime certificate.'};writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({result:summary.result,pins:PINS.length,refusals:refusals.length,transport:transport.length,cold,requests:requests.length,targetExecuted:false}));
}finally{await new Promise(done=>server.close(done));}
`;
const options = { absWorkingDir: root, bundle: true, format: 'esm', target: 'es2022', write: false, metafile: true, ...(mode === 'compiled' ? { plugins: [plugin] } : {}) };
const compiled = await build({ ...options, stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'source1178-public-consumer.mjs' }, platform: 'node' });
function graph(result) { const inputs = Object.keys(result.metafile.inputs).map(path => resolve(root, path));
  const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
  const source = own.filter(path => path.includes('/src/')), dist = own.filter(path => path.includes('/dist/'));
  assert.ok(own.length > 0); assert.equal(mode === 'source' ? dist.length : source.length, 0); return { sourceCount: source.length, compiledCount: dist.length, ownSource: source.map(path => relative(root, path)), ownCompiled: dist.map(path => relative(root, path)) };
}
assert.ok(!Object.keys(compiled.metafile.inputs).some(path=>/node_modules\/(pixi3d|pixi\.js|@pixi)\//.test(path)),'Node native consumer must not import Pixi peers');
const graphs = { mode, node: process.version, consumer: graph(compiled), resolutions };
const browser=await build({...options,entryPoints:[resolve(examples,'source-curve-control-polygon-pixi3d.mjs')],platform:'browser'});graphs.browser=graph(browser);assert.ok(Object.keys(browser.metafile.inputs).some(path=>path.endsWith(mode==='source'?'src/pixi3d-selected-uniform-curve.ts':'dist/pixi3d-selected-uniform-curve.js')),'Actual new public SDK browser closure required');
await writeFile(resolve(output,'browser-metafile.json'),JSON.stringify(browser.metafile,null,2));
if(mode==='compiled')await writeFile(resolve(output,'browser.bundle.mjs'),browser.outputFiles[0].text);
const config=await build({...options,entryPoints:[resolve(examples,'source-curve-control-polygon-pixi3d.config.mjs')],platform:'node',packages:'external'});
await writeFile(resolve(output,'config-metafile.json'),JSON.stringify(config.metafile,null,2));
await writeFile(resolve(output, 'graphs.json'), JSON.stringify(graphs, null, 2)); await writeFile(resolve(output, 'consumer-metafile.json'), JSON.stringify(compiled.metafile, null, 2));
const execution = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: compiled.outputFiles[0].text, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOADER1178_EVIDENCE: output } });
await writeFile(resolve(output, 'consumer.stdout'), execution.stdout ?? ''); await writeFile(resolve(output, 'consumer.stderr'), execution.stderr ?? ''); await writeFile(resolve(output, 'consumer.exit'), String(execution.status));
process.stdout.write(execution.stdout ?? ''); process.stderr.write(execution.stderr ?? ''); assert.equal(execution.status, 0, 'Actual public consumer failed');
if (mode === 'compiled') {
  const interop = packages.get('@barocss/cad-interop'), development = interop.manifest.exports, publishedMap = interop.manifest.publishConfig.exports;
  assert.deepEqual(Object.keys(development).sort(), Object.keys(publishedMap).sort()); assert.ok(development["./pixi3d-selected-uniform-curve"]); assert.ok(development["./native-selected-uniform-curve"]);
  const baseline=JSON.parse(spawnSync('git',['show','9e76d317b3eaaf18014c4503c8603bbb3c40334a:packages/barocss-cad-interop/package.json'],{cwd:root,encoding:'utf8'}).stdout); for(const [key,entry] of Object.entries(baseline.exports)){assert.deepEqual(development[key],entry);assert.deepEqual(publishedMap[key],baseline.publishConfig.exports[key]);}assert.equal(Object.keys(development).length,Object.keys(baseline.exports).length+1);
  for (const [key, entry] of Object.entries(publishedMap)) { assert.equal(development[key].import, entry.import.replace('/dist/', '/src/').replace(/\.js$/, '.ts')); assert.equal(entry.types, entry.import.replace(/\.js$/, '.d.ts')); await access(resolve(interop.directory, entry.import)); await access(resolve(interop.directory, entry.types)); }
  const typeFile = resolve(interop.directory, 'test/selected-uniform-curve-pixi3d.types.ts'), compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true, skipLibCheck: true, types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] }, host = ts.createCompilerHost(compilerOptions), typeResolutions = [];
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    if (/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)) { const path = published(name, 'types'); typeResolutions.push({ name, importer: relative(root, containingFile), target: relative(root, path) }); return { resolvedFileName: path, extension: ts.Extension.Dts, isExternalLibraryImport: true }; }
    return ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule;
  });
  const program = ts.createProgram([typeFile], compilerOptions, host), diagnostics = ts.getPreEmitDiagnostics(program).map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'), file: item.file ? relative(root, item.file.fileName) : null }));
  const files = program.getSourceFiles().map(file => resolve(file.fileName)), own = files.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/'))), sourceFallbacks = own.filter(path => path.includes('/src/'));
  const types = { compiler: ts.version, strict: true, noEmit: true, skipLibCheck: true, diagnostics, sourceFallbacks, ownDeclarations: own.map(path => relative(root, path)), peerDeclarations: files.filter(path => path.includes('/node_modules/') && path.endsWith('.d.ts')).length, resolutions: typeResolutions, maps: Object.keys(development).length, scope: 'Both new optional selected entries and transitive CAD declarations; normal peer resolution, not full peer/all-entry runtime certificate' };
  await writeFile(resolve(output, 'published-types.json'), JSON.stringify(types, null, 2)); assert.deepEqual(diagnostics, []); assert.deepEqual(sourceFallbacks, []); assert.ok(own.some(path => path.endsWith('/pixi3d-selected-uniform-curve.d.ts')));
}
console.log(JSON.stringify({ mode, consumerSource: graphs.consumer.sourceCount, consumerCompiled: graphs.consumer.compiledCount, publishedTypes: mode === 'compiled' ? 'checked' : 'unrun' }));
