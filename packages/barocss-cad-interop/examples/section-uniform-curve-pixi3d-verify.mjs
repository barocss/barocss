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
import { resolve } from 'node:path';
import * as nativeModule from '@barocss/cad-interop/native-uniform-curve';
import { compileCadModel, buildVLinearSurfacePlaneSection, validateVLinearSurfacePlaneSection, curveDomain, sampleCurve, evaluateCurve, evaluateCurveD1 } from '@barocss/cad';
import { PINS, loadSectionAsset, assertNative, assertBuffer, proveSection, createNativeOptions } from './examples/section-uniform-curve-pixi3d-fixture.mjs';
const data = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/section-uniform-curve-pixi3d-data'), output = process.env.LOADER1142_EVIDENCE, texts = new Map();
for (const pin of PINS) { const bytes = readFileSync(resolve(data, pin.file)); assert.equal(bytes.length, pin.bytes); assert.equal(createHash('sha256').update(bytes).digest('hex'), pin.sha256); texts.set(pin.file, bytes.toString('utf8')); }
assert.equal(PINS.length, 5); assert.equal(PINS.reduce((sum, pin) => sum + pin.bytes, 0), 31991);
const asset = await loadSectionAsset(file => texts.get(file)), section = proveSection(asset);
const request = JSON.parse(texts.get('polynomial.authored-request.json')), owned = JSON.parse(texts.get('polynomial.owned-section.json'));
const independent = buildVLinearSurfacePlaneSection(request.surfaceAsset, request.planeAsset, request.options); validateVLinearSurfacePlaneSection(independent); validateVLinearSurfacePlaneSection(section);
assertNative(independent, owned, 'Independent complete native section'); assertNative(section, owned, 'Complete host section');
for (const [source, model, count] of [[request.surfaceAsset.source, section.originalModels[0], 3], [request.planeAsset.source, section.originalModels[1], 1], [asset.worldSource, section.world.model, 1]]) {
  const compiled = compileCadModel(source, { sourceVersion: 0 }); assert.equal(compiled.ok, true); assertNative(compiled.model, model, 'Whole original cold Model'); assert.equal(model.objects.length, count);
}
assertNative(asset.surfaceUV, section.pcurves.surface); assertNative(asset.planeUV, section.pcurves.plane); assert.equal(section.observations.length, 5);

const {parseBaroCadUniformCurveSource:parse,validateBaroCadUniformCurveSourceOptions:validate}=nativeModule;
assert.deepEqual(Object.keys(nativeModule).sort(),['BaroCadUniformCurveSourceError','parseBaroCadUniformCurveSource','validateBaroCadUniformCurveSourceOptions'].sort());
const native=parse(asset.worldSource,createNativeOptions()),samples=sampleCurve(section.world.curve,129);
assertNative(native.model,section.world.model);assertNative(native.domain,curveDomain(section.world.curve));
assertNative(native.parameters,samples.map(item=>item.parameter));assertNative(native.pointsMM,samples.map(item=>item.point));assert.equal(native.intervals.length,128);
for(const [index,sample] of samples.entries())for(let axis=0;axis<3;axis++)assert.ok(Object.is(native.positions[index*3+axis],Math.fround(sample.point[axis]*.001)));
for(const [index,original] of section.observations.entries()){assert.equal(native.parameters[index*32],original.parameter);assertNative(native.pointsMM[index*32],evaluateCurve(section.world.curve,original.parameter));assertNative(original.world.d1,evaluateCurveD1(section.world.curve,original.parameter));}
const input=createNativeOptions(),snapshot=validate(input);input.uniformCurveDisplay.count=2;assert.equal(parse(asset.worldSource,snapshot).parameters.length,129);
const endpoints=parse(asset.worldSource,{...createNativeOptions(),uniformCurveDisplay:{version:1,count:2}});assert.equal(endpoints.parameters.length,2);assertBuffer(endpoints.positions,Float32Array.from([native.positions.slice(0,3),native.positions.slice(-3)].flatMap(x=>Array.from(x))));
let getterCalls=0;const invalid=createNativeOptions();Object.defineProperty(invalid.uniformCurveDisplay,'count',{enumerable:true,get(){getterCalls++;return 129;}});
assert.throws(()=>validate(invalid),error=>error.name==='BaroCadUniformCurveSourceError'&&error.code==='OPTIONS');assert.equal(getterCalls,0);
for(const count of [1,130])assert.throws(()=>parse(asset.worldSource,{...createNativeOptions(),uniformCurveDisplay:{version:1,count}}),error=>error.code==='OPTIONS');
const summary={result:'whole-section-and-neutral-cpu-ok',pins:PINS,section,native,neutralCounts:[2,129],getterCalls,scope:'Node genuine native CPU only; actual Pixi target runtime executes in separate headed browser flow'};
writeFileSync(resolve(output,'summary.json'),JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify({result:summary.result,neutralCounts:summary.neutralCounts,getterCalls}));

`;
const options = { absWorkingDir: root, bundle: true, format: 'esm', target: 'es2022', write: false, metafile: true, ...(mode === 'compiled' ? { plugins: [plugin] } : {}) };
const compiled = await build({ ...options, stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'section1142-public-consumer.mjs' }, platform: 'node' });
function graph(result) { const inputs = Object.keys(result.metafile.inputs).map(path => resolve(root, path));
  const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
  const source = own.filter(path => path.includes('/src/')), dist = own.filter(path => path.includes('/dist/'));
  assert.ok(own.length > 0); assert.equal(mode === 'source' ? dist.length : source.length, 0); return { sourceCount: source.length, compiledCount: dist.length, ownSource: source.map(path => relative(root, path)), ownCompiled: dist.map(path => relative(root, path)) };
}
const graphs = { mode, node: process.version, consumer: graph(compiled), resolutions };
const browser=await build({...options,entryPoints:[resolve(examples,'section-uniform-curve-pixi3d.mjs')],platform:'browser'});graphs.browser=graph(browser);
await writeFile(resolve(output,'browser-metafile.json'),JSON.stringify(browser.metafile,null,2));
if(mode==='compiled')await writeFile(resolve(output,'browser.bundle.mjs'),browser.outputFiles[0].text);
const config=await build({...options,entryPoints:[resolve(examples,'section-uniform-curve-pixi3d.config.mjs')],platform:'node',packages:'external'});
await writeFile(resolve(output,'config-metafile.json'),JSON.stringify(config.metafile,null,2));
await writeFile(resolve(output, 'graphs.json'), JSON.stringify(graphs, null, 2)); await writeFile(resolve(output, 'consumer-metafile.json'), JSON.stringify(compiled.metafile, null, 2));
const execution = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: compiled.outputFiles[0].text, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: { ...process.env, LOADER1142_EVIDENCE: output } });
await writeFile(resolve(output, 'consumer.stdout'), execution.stdout ?? ''); await writeFile(resolve(output, 'consumer.stderr'), execution.stderr ?? ''); await writeFile(resolve(output, 'consumer.exit'), String(execution.status));
process.stdout.write(execution.stdout ?? ''); process.stderr.write(execution.stderr ?? ''); assert.equal(execution.status, 0, 'Actual public consumer failed');
if (mode === 'compiled') {
  const interop = packages.get('@barocss/cad-interop'), development = interop.manifest.exports, publishedMap = interop.manifest.publishConfig.exports;
  assert.deepEqual(Object.keys(development).sort(), Object.keys(publishedMap).sort()); assert.ok(development["./pixi3d-uniform-curve"]);
  for (const [key, entry] of Object.entries(publishedMap)) { assert.equal(development[key].import, entry.import.replace('/dist/', '/src/').replace(/\.js$/, '.ts')); assert.equal(entry.types, entry.import.replace(/\.js$/, '.d.ts')); await access(resolve(interop.directory, entry.import)); await access(resolve(interop.directory, entry.types)); }
  const typeFile = resolve(interop.directory, 'test/pixi3d-uniform-curve.types.ts'), compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true, skipLibCheck: true, types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] }, host = ts.createCompilerHost(compilerOptions), typeResolutions = [];
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    if (/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)) { const path = published(name, 'types'); typeResolutions.push({ name, importer: relative(root, containingFile), target: relative(root, path) }); return { resolvedFileName: path, extension: ts.Extension.Dts, isExternalLibraryImport: true }; }
    return ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule;
  });
  const program = ts.createProgram([typeFile], compilerOptions, host), diagnostics = ts.getPreEmitDiagnostics(program).map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'), file: item.file ? relative(root, item.file.fileName) : null }));
  const files = program.getSourceFiles().map(file => resolve(file.fileName)), own = files.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/'))), sourceFallbacks = own.filter(path => path.includes('/src/'));
  const types = { compiler: ts.version, strict: true, noEmit: true, skipLibCheck: true, diagnostics, sourceFallbacks, ownDeclarations: own.map(path => relative(root, path)), peerDeclarations: files.filter(path => path.includes('/node_modules/') && path.endsWith('.d.ts')).length, resolutions: typeResolutions, maps: Object.keys(development).length, scope: 'New optional entry and native validator with transitive CAD declarations; normal peer resolution, no full peer or all-entry runtime certificate' };
  await writeFile(resolve(output, 'published-types.json'), JSON.stringify(types, null, 2)); assert.deepEqual(diagnostics, []); assert.deepEqual(sourceFallbacks, []); assert.ok(own.some(path => path.endsWith('/pixi3d-uniform-curve.d.ts')));
}
console.log(JSON.stringify({ mode, consumerSource: graphs.consumer.sourceCount, consumerCompiled: graphs.consumer.compiledCount, publishedTypes: mode === 'compiled' ? 'checked' : 'unrun' }));
