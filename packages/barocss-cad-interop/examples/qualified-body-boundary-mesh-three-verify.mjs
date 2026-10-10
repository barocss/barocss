import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { access, mkdir, readFile, writeFile, statfs } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = process.cwd(), prefix = 'packages/barocss-cad-interop/', examples = resolve(root, prefix, 'examples');
const parent = '0f4ae42186fd6f5c12fe9a69a9c00b35de6ab734';
function argument(name) { const index = process.argv.indexOf(name); assert.ok(index >= 2 && process.argv[index + 1], name + ' required'); return process.argv[index + 1]; }
const mode = argument('--mode'), requested = argument('--output');
assert.ok(['source', 'compiled'].includes(mode)); assert.ok(isAbsolute(requested)); assert.equal(Number(process.versions.node.split('.')[0]), 22);
const output = resolve(requested); let present = false;
try { await access(output); present = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.equal(present, false, 'Preserve each FIRST in a new output directory'); await mkdir(output, { recursive: true });
const save = (name, value) => writeFile(resolve(output, name), JSON.stringify(value, null, 2) + '\n');
await save('command.json', { argv: process.argv, cwd: root, node: process.version, mode, parent });
const disk = await statfs(output); assert.ok(disk.bavail * disk.bsize >= 128 * 1024 * 1024, '128 MiB operational output reserve required');
const packages = new Map();
for (const suffix of ['cad', 'cad-interop']) {
  const directory = resolve(root, 'packages/barocss-' + suffix), manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  packages.set('@barocss/' + suffix, { directory, manifest });
  if (mode === 'source') { let exists = false; try { await access(resolve(directory, 'dist')); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; } assert.equal(exists, false, 'SOURCE FIRST before own builds'); }
}
const interop = packages.get('@barocss/cad-interop'), name = 'qualified-body-boundary-mesh-three';
const originalManifest = spawnSync('git', ['show', parent + ':' + prefix + 'package.json'], { cwd: root, encoding: 'utf8', timeout: 30000 }); assert.equal(originalManifest.status, 0);
const baseline = JSON.parse(originalManifest.stdout), expected = structuredClone(baseline); assert.equal(Object.keys(baseline.exports).length, 40);
expected.exports['./' + name] = { types: './src/' + name + '.ts', import: './src/' + name + '.ts' };
expected.publishConfig.exports['./' + name] = { types: './dist/' + name + '.d.ts', import: './dist/' + name + '.js' };
assert.deepEqual(interop.manifest, expected); assert.equal(Object.keys(interop.manifest.exports).length, 41);
const coreHash = createHash('sha256').update(await readFile(resolve(interop.directory, 'src/qualified-body-boundary-mesh.ts'))).digest('hex'); assert.equal(coreHash, '4fa1cb65e5df9a7fa72a33a3c37ae5ad8cf5209b11c971e32d1307f40934cea8');
const resolutions = [];
function published(specifier, field) {
  const packageName = specifier.split('/').slice(0, 2).join('/'), item = packages.get(packageName), suffix = specifier.slice(packageName.length), key = suffix ? '.' + suffix : '.';
  const target = item?.manifest.publishConfig?.exports?.[key]?.[field]; assert.ok(target?.startsWith('./dist/'), 'Actual published ' + field + ': ' + specifier); return resolve(item.directory, target);
}
const plugin = { name: 'actual-published-body-mesh-three', setup(builder) { builder.onResolve({ filter: /^@barocss\/(cad|cad-interop)(\/|$)/ }, args => { const path = published(args.path, 'import'); resolutions.push({ specifier: args.path, importer: relative(root, args.importer), target: relative(root, path) }); return { path }; }); } };

const consumer = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { Scene, OrthographicCamera, SphereGeometry, MeshBasicMaterial, Mesh, BufferGeometry, MeshNormalMaterial } from 'three';
import { BaroCADQualifiedBodyBoundaryMeshThreeLoader as Loader, BaroCadQualifiedBodyBoundaryMeshReadError } from '@barocss/cad-interop/qualified-body-boundary-mesh-three';
import { PINS, CAMERA, sameNative, stringifyNative, negativeZeroPaths, mutableRefs, intersection, assetFromTexts, errorReceipt, observeResult, checkResult, captureRows, createCallerLedger, captureCaller, runGuards } from './qualified-body-boundary-mesh-three-observer.mjs';
const output = process.env.LOADER1381_PRODUCT_OUTPUT, directory = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/qualified-body-boundary-mesh-three-data');
const texts = new Map(), records = [], allRows = [], events = [], calls = [], telemetry = [], intersections = [], guards = [];
let accepted = null, borrowedRow = null, callbacks = 0, cleanupCalls = 0, peakLivePairs = 0, lastOperation = 'boot';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function save(name, value) { writeFileSync(resolve(output, name), stringifyNative(value, 2)); }
function pinBytes(bytes, pin) { assert.equal(bytes.length, pin.bytes); assert.equal(hash(bytes), pin.sha256); }
function live() { return allRows.filter(row => row.geometryDisposals === 0 && row.materialDisposals === 0).length; }
function counts() { return { groups: records.length, pairs: allRows.length, livePairs: live(), peakLivePairs, callbacks, cleanupCalls, geometryDisposals: allRows.reduce((n,row) => n + row.geometryDisposals,0), materialDisposals: allRows.reduce((n,row) => n + row.materialDisposals,0) }; }
const scene = new Scene(), camera = new OrthographicCamera(CAMERA.left,CAMERA.right,CAMERA.top,CAMERA.bottom,CAMERA.near,CAMERA.far);
camera.position.fromArray(CAMERA.eye); camera.up.fromArray(CAMERA.up); camera.lookAt(...CAMERA.target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
const markerGeometry = new SphereGeometry(CAMERA.markerRadius,16,12), markerMaterial = new MeshBasicMaterial({color:0x00ff00}), marker = new Mesh(markerGeometry,markerMaterial);
marker.position.fromArray(CAMERA.markerPosition); scene.add(marker); scene.updateMatrixWorld(true);
const caller = createCallerLedger({scene,camera,marker}), initialCaller = captureCaller(caller), options = {unitsPerMillimeter:.001};
const loader = new Loader(options); options.unitsPerMillimeter = .01;
function checkAll() { for (const record of records) checkResult(record,{borrowedRow,callerGeometry:markerGeometry,callerMaterial:markerMaterial}); sameNative(captureCaller(caller),initialCaller); }
function invoke(entry,input,label) { lastOperation = label; const start = performance.now(), before = process.memoryUsage(), call = {label,entry,outcome:'pending'}; calls.push(call); try { const result = entry === 'read' ? loader.read(input) : loader.parse(input); call.outcome = 'accepted'; return result; } catch (error) { call.outcome = 'refused'; call.error = errorReceipt(error); throw error; } finally { telemetry.push({label,elapsedMilliseconds:performance.now()-start,before,after:process.memoryUsage()}); } }
function admit(asset,entry,label) {
  let result;
  try {
    result = invoke(entry,entry === 'read' ? asset.native : asset.text,label);
    const record = {asset,result,rows:observeResult(result),label,entry};
    assert.equal(result.data.sourceText,entry === 'read' ? null : asset.text);
    checkResult(record); assert.equal(result.group.parent,null);
    for (const row of record.rows) { assert.ok(row.object instanceof Mesh && row.geometry instanceof BufferGeometry && row.material instanceof MeshNormalMaterial); assert.equal(row.geometry.boundingBox,null); assert.equal(row.geometry.boundingSphere,null); }
    const mutable = mutableRefs(result.data); assert.equal(intersection(mutable,mutableRefs(asset.request)),0);
    for (const prior of records) { const count = intersection(mutable,mutableRefs(prior.result.data)); assert.equal(count,0); intersections.push({left:label,right:prior.label,count}); }
    allRows.push(...record.rows); peakLivePairs = Math.max(peakLivePairs,live()); events.push({type:'detached-staged',label,...counts()});
    const previous = accepted; scene.add(result.group); accepted = record; records.push(record); if(previous)previous.result.dispose(); callbacks++;
    scene.updateMatrixWorld(true); checkAll(); events.push({type:'installed',label,...counts()}); return record;
  } catch (error) { try { result?.dispose(); } catch (cleanupError) { events.push({type:'failed-candidate-cleanup-error',error:errorReceipt(cleanupError)}); } throw error; }
}
try {
  assert.equal(PINS.length,6); assert.equal(PINS.reduce((n,pin)=>n+pin.bytes,0),11288189);
  for (const pin of PINS) { const bytes = readFileSync(resolve(directory,pin.path)); pinBytes(bytes,pin); texts.set(pin.path,new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  const assets = new Map(['main','edited','single'].map(key=>[key,assetFromTexts(key,texts)]));
  const main = admit(assets.get('main'),'read','main-owned');
  const acceptedBefore = structuredClone(main.result.data), childrenBefore = [...scene.children], countersBefore = counts(), referenceBefore = mutableRefs(main.result.data);
  const guardResult = runGuards(loader,Loader,(control,error)=>{
    assert.ok(error instanceof BaroCadQualifiedBodyBoundaryMeshReadError); guards.push({name:control.name,error:errorReceipt(error),entry:control.name==='wrong-explicit-scale'?'constructor':control.name==='small-ancestor-cycle'?'read':'parse'});
    sameNative(main.result.data,acceptedBefore); sameNative(counts(),countersBefore); assert.equal(scene.children.length,childrenBefore.length); scene.children.forEach((child,i)=>assert.equal(child,childrenBefore[i]));
    const after = mutableRefs(main.result.data); assert.equal(after.size,referenceBefore.size); for(const item of after)assert.ok(referenceBefore.has(item)); checkAll();
  });
  assert.equal(guardResult.getterCalls,0); assert.equal(guardResult.refusals.length,4);
  const edited = admit(assets.get('edited'),'parse','edited-text'), single = admit(assets.get('single'),'parse','single-text');
  assert.ok(main.rows.some((row,i)=>row.positions.some((value,j)=>!Object.is(value,edited.rows[i].positions[j]))),'Edited actual upload values must differ');
  const savedPins = [];
  for (const record of [main,edited,single]) { const pin = PINS.find(row=>row.path===record.asset.key+'.mesh-result.json'), bytes = Buffer.from(stringifyNative(record.result.data.native)); pinBytes(bytes,pin); writeFileSync(resolve(output,pin.path),bytes); savedPins.push({...pin}); }
  const fresh = new Map(); for(const pin of PINS.filter(pin=>pin.path.startsWith('edited.'))) { const bytes = readFileSync(resolve(pin.path.endsWith('.mesh-result.json')?output:directory,pin.path)); pinBytes(bytes,pin); fresh.set(pin.path,new TextDecoder('utf-8',{fatal:true}).decode(bytes)); }
  const freshAsset = assetFromTexts('edited',fresh); sameNative(freshAsset.request,edited.asset.request); sameNative(freshAsset.native,edited.asset.native);
  const cold = admit(freshAsset,'parse','cold-edited-text'); sameNative(cold.result.data,edited.result.data);
  const values = rows => captureRows(rows).map(({geometryDisposals,materialDisposals,...value})=>value); sameNative(values(cold.rows),values(edited.rows));
  assert.equal(intersections.length,6); assert.equal(new Set(allRows.map(row=>row.object)).size,24); assert.equal(new Set(allRows.map(row=>row.geometry)).size,24); assert.equal(new Set(allRows.map(row=>row.material)).size,24);
  const buffers = allRows.flatMap(row=>[row.positionArray.buffer,row.normalArray.buffer,row.indexArray.buffer]); assert.equal(new Set(buffers).size,buffers.length);
  const beforeCleanup = records.map(record=>structuredClone(record.result.data));
  borrowedRow = cold.rows[0]; borrowedRow.object.geometry = markerGeometry; borrowedRow.object.material = markerMaterial; checkAll(); events.push({type:'borrowed-caller-pointers',label:cold.label,...counts()});
  // No Node renderer exists; the caller-owned pointers are never drawn before cleanup.
  for(let pass=0;pass<2;pass++) { cleanupCalls++; cold.result.dispose(); if(pass===0){accepted=null;callbacks++;} events.push({type:'cleanup',pass,...counts()}); }
  records.forEach((record,i)=>{sameNative(record.result.data,beforeCleanup[i]);checkResult(record,{borrowedRow,callerGeometry:markerGeometry,callerMaterial:markerMaterial});assert.equal(record.result.group.parent,null);assert.equal(record.result.group.children.length,0);});
  checkAll(); assert.deepEqual(scene.children,[marker]);
  for(const row of allRows){assert.equal(row.geometryDisposals,1);assert.equal(row.materialDisposals,1);}
  sameNative(counts(),{groups:4,pairs:24,livePairs:0,peakLivePairs:12,callbacks:5,cleanupCalls:2,geometryDisposals:24,materialDisposals:24}); assert.equal(peakLivePairs,Math.max(...events.map(row=>row.livePairs)));
  for(const pin of PINS)pinBytes(readFileSync(resolve(directory,pin.path)),pin); for(const pin of savedPins)pinBytes(readFileSync(resolve(output,pin.path)),pin);
  const summary = {result:'qualified-body-boundary-mesh-three-public-objects-ok',pins:PINS,totalOriginalBytes:11288189,cases:[main,edited,single].map(record=>({key:record.asset.key,data:record.result.data,target:captureRows(record.rows),negativeZeroPaths:negativeZeroPaths(record.result.data.native)})),cold:{key:'edited',sourceTextRole:'exact-text',savedPin:savedPins.find(pin=>pin.path==='edited.mesh-result.json'),wholeReadEqual:true,allTargetValuesEqual:true,independentFourthResources:true},savedPins,resources:captureRows(allRows),counts:counts(),events,admissions:calls,guards:guardResult,mutableReferenceIntersections:intersections,borrowedPointers:{faceId:borrowedRow.binding.faceId,currentGeometryIsCaller:borrowedRow.object.geometry===markerGeometry,currentMaterialIsCaller:borrowedRow.object.material===markerMaterial,originalGeometryDisposed:borrowedRow.geometryDisposals,originalMaterialDisposed:borrowedRow.materialDisposals,other23PointersUnchanged:allRows.filter(row=>row!==borrowedRow).every(row=>row.object.geometry===row.geometry&&row.object.material===row.material)},caller:captureCaller(caller),scope:'Four actual public target admissions, four exact early guards, captured original24pairs cleanup and borrowed caller pointers. Real Node Three objects only; no WebGL/DOM/shader/draw or public renderer certification. Static neutral-before-target order, not hidden constructor allocation telemetry.'};
  assert.equal(calls.length,4); assert.equal(guards.length,4); save('summary.json',summary); save('telemetry.json',{calls:telemetry,finalMemory:process.memoryUsage(),physicalResources:allRows.map(row=>({meshUUID:row.object.uuid,geometryUUID:row.geometry.uuid,materialUUID:row.material.uuid}))}); console.log(JSON.stringify({result:summary.result,...summary.counts,earlyGuards:4,getterCalls:0}));
} catch(error) { let callerFailureState; try { callerFailureState = captureCaller(caller); } catch(callerError) { callerFailureState = {captureError:errorReceipt(callerError)}; } save('first-failure.json',{error:errorReceipt(error),stack:error.stack??null,lastOperation,counts:counts(),calls,guards,events,caller:callerFailureState}); save('telemetry.json',{calls:telemetry,finalMemory:process.memoryUsage()}); throw error; }
`;

const observer = resolve(examples, 'qualified-body-boundary-mesh-three-observer.mjs'), virtualEntry = resolve(examples, 'qualified-body-boundary-mesh-three-private-consumer.mjs');
function graph(metafile, allowedExamples) {
  const inputs = Object.keys(metafile.inputs).map(path => resolve(root, path));
  const otherExamples = inputs.filter(path => (path.startsWith(resolve(root, 'examples') + '/') || [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'examples') + '/'))) && !allowedExamples.includes(path)); assert.deepEqual(otherExamples, [], 'Only exact own observer/runtime/virtual entries');
  const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/'))), ownSource = own.filter(path => path.includes('/src/')), ownCompiled = own.filter(path => path.includes('/dist/'));
  assert.equal(mode === 'source' ? ownCompiled.length : ownSource.length, 0);
  const folder = mode === 'source' ? 'src' : 'dist', extension = mode === 'source' ? '.ts' : '.js';
  for (const leaf of [name, 'qualified-body-boundary-mesh', 'qualified-body-boundary-mesh-json']) assert.ok(own.includes(resolve(interop.directory, folder, leaf + extension)), 'Actual selected own leaf ' + leaf);
  const three = inputs.filter(path => /\/node_modules\/.*three\//.test(path)), otherPeers = inputs.filter(path => /\/node_modules\/.*(?:babylon|pixi)/i.test(path)); assert.ok(three.length > 0); assert.deepEqual(otherPeers, []);
  return { ownSource: ownSource.map(path => relative(root, path)), ownCompiled: ownCompiled.map(path => relative(root, path)), threePeer: three.map(path => relative(root, path)), otherPeers, otherExamples };
}

try {
  const bundled = await build({ absWorkingDir: root, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true, stdin: { contents: consumer, resolveDir: examples, sourcefile: virtualEntry }, ...(mode === 'compiled' ? { plugins: [plugin] } : {}) });
  const cpuGraph = graph(bundled.metafile, [virtualEntry, observer]);
  const sdkSource = await readFile(resolve(interop.directory, 'src/' + name + '.ts'), 'utf8');
  const parseSites = [...sdkSource.matchAll(/parseBaroCadQualifiedBodyBoundaryMesh\s*\(/g)], readSites = [...sdkSource.matchAll(/readBaroCadQualifiedBodyBoundaryMesh\s*\(/g)]; assert.equal(parseSites.length, 1); assert.equal(readSites.length, 1);
  await writeFile(resolve(output, 'consumer-source.mjs'), consumer); await writeFile(resolve(output, 'consumer.bundle.mjs'), bundled.outputFiles[0].text); await save('consumer-metafile.json', bundled.metafile);
  await save('graphs.json', { mode, node: process.version, parent, maps: 41, coreHash, aliases: false, ...cpuGraph, resolutions, staticDelegation: { parseCallsites: 1, readCallsites: 1, scope: 'Static callsites, not dynamic kernel/constructor counters' } });
  const executed = spawnSync(process.execPath, ['--max-old-space-size=4096', '--input-type=module'], { cwd: root, input: bundled.outputFiles[0].text, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024, env: { ...process.env, LOADER1381_PRODUCT_OUTPUT: output } });
  await writeFile(resolve(output, 'consumer.stdout'), executed.stdout ?? ''); await writeFile(resolve(output, 'consumer.stderr'), executed.stderr ?? ''); await writeFile(resolve(output, 'consumer.exit'), String(executed.status) + '\n');
  await save('consumer.result.json', { status: executed.status, signal: executed.signal, error: executed.error ? { name: executed.error.name, code: executed.error.code ?? null, message: executed.error.message } : null, timeoutMilliseconds: 120000, heapMB: 4096 });
  process.stdout.write(executed.stdout ?? ''); process.stderr.write(executed.stderr ?? ''); assert.equal(executed.status, 0, 'FIRST public target object/file flow failed');
  if (mode === 'compiled') {
    for (const entry of Object.values(interop.manifest.publishConfig.exports)) { await access(resolve(interop.directory, entry.import)); await access(resolve(interop.directory, entry.types)); }
    const typeSource = `import { BaroCADQualifiedBodyBoundaryMeshThreeLoader, BaroCadQualifiedBodyBoundaryMeshReadError, BaroCadQualifiedBodyBoundaryMeshProjectionError, BaroCadQualifiedBodyBoundaryMeshDiagnosticCode } from '@barocss/cad-interop/qualified-body-boundary-mesh-three';
import type { BaroCadQualifiedBodyBoundaryMeshThreeResult, BaroCadQualifiedBodyBoundaryMeshThreeFaceBinding, BaroCadQualifiedBodyBoundaryMeshOptions, BaroCadQualifiedBodyBoundaryMeshRead, BaroCadQualifiedBodyBoundaryMeshProjectionDiagnosticCode } from '@barocss/cad-interop/qualified-body-boundary-mesh-three';
import type { QualifiedTranslatedStripBodyMeshResult, QualifiedTranslatedStripBodyMeshReport } from '@barocss/cad';
import type { Group, Mesh, BufferGeometry, MeshNormalMaterial } from 'three';
export function consume(text:string, owned:QualifiedTranslatedStripBodyMeshResult, options:BaroCadQualifiedBodyBoundaryMeshOptions):BaroCadQualifiedBodyBoundaryMeshThreeResult {
 const loader=new BaroCADQualifiedBodyBoundaryMeshThreeLoader(options), parsed=loader.parse(text), read=loader.read(owned);
 const data:BaroCadQualifiedBodyBoundaryMeshRead=parsed.data, native:QualifiedTranslatedStripBodyMeshResult=data.native, report:QualifiedTranslatedStripBodyMeshReport=data.validationReport, sourceText:string|null=data.sourceText;
 const group:Group=parsed.group, binding:BaroCadQualifiedBodyBoundaryMeshThreeFaceBinding=parsed.faceBindings[0], mesh:Mesh<BufferGeometry,MeshNormalMaterial>=binding.object;
 const positions:Float32Array=data.projection.chunks[0].positions, normals:Float32Array=data.projection.chunks[0].normals, indices:Uint32Array=data.projection.chunks[0].indices, uv:Float64Array=data.projection.chunks[0].nativeUV;
 const scale:0.001=data.projection.unitsPerMillimeter, renderer:false=data.profile.capabilities.renderer, objectId:string=binding.supportRef.objectId, sourceModelId:string=binding.supportRef.sourceModelId;
 if(false){
 // @ts-expect-error Readonly result field: same-value write.
 parsed.data=parsed.data;
 // @ts-expect-error Readonly binding array: same-value write.
 parsed.faceBindings[0]=parsed.faceBindings[0];
 // @ts-expect-error Readonly binding field: same-value write.
 binding.role=binding.role;
 // @ts-expect-error Copied support metadata is readonly.
 binding.supportRef.objectId=binding.supportRef.objectId;
 // @ts-expect-error Neutral profile limits remain deeply readonly.
 data.profile.limits.utf8Bytes=data.profile.limits.utf8Bytes;
 // @ts-expect-error Neutral profile capabilities remain deeply readonly.
 data.profile.capabilities.renderer=data.profile.capabilities.renderer;
 // @ts-expect-error Exact .001 option, not another scale.
 new BaroCADQualifiedBodyBoundaryMeshThreeLoader({unitsPerMillimeter:.01});
 }
 void[native,report,sourceText,group,mesh,positions,normals,indices,uv,scale,renderer,objectId,sourceModelId,read.data.sourceText];parsed.dispose();return parsed;
}
export function consumeError(error:unknown):unknown { if(error instanceof BaroCadQualifiedBodyBoundaryMeshReadError){const code:BaroCadQualifiedBodyBoundaryMeshDiagnosticCode=error.code;const cause:unknown=error.cause;return[code,cause,BaroCadQualifiedBodyBoundaryMeshDiagnosticCode.NATIVE];}if(error instanceof BaroCadQualifiedBodyBoundaryMeshProjectionError){const code:BaroCadQualifiedBodyBoundaryMeshProjectionDiagnosticCode=error.code;return code;}return null; }
`;
    const virtualType = resolve(examples, 'qualified-body-boundary-mesh-three-private-published-contract.mts'), compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true, skipLibCheck: true, types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] };
    const host = ts.createCompilerHost(compilerOptions), get = host.getSourceFile.bind(host), fileExists = host.fileExists.bind(host), readOriginal = host.readFile.bind(host), typeResolutions = [];
    host.getSourceFile = (path,version,onError,newFile) => resolve(path) === virtualType ? ts.createSourceFile(virtualType,typeSource,version,true,ts.ScriptKind.TS) : get(path,version,onError,newFile);
    host.fileExists = path => resolve(path) === virtualType || fileExists(path); host.readFile = path => resolve(path) === virtualType ? typeSource : readOriginal(path);
    host.resolveModuleNames = (names,containingFile) => names.map(specifier => { if (/^@barocss\/(cad|cad-interop)(\/|$)/.test(specifier)) { const path = published(specifier,'types'); typeResolutions.push({specifier,importer:relative(root,containingFile),target:relative(root,path)}); return {resolvedFileName:path,extension:ts.Extension.Dts,isExternalLibraryImport:true}; } return ts.resolveModuleName(specifier,containingFile,compilerOptions,host).resolvedModule; });
    const program = ts.createProgram([virtualType],compilerOptions,host), diagnostics = ts.getPreEmitDiagnostics(program).map(item => ({code:item.code,message:ts.flattenDiagnosticMessageText(item.messageText,'\n'),file:item.file?relative(root,item.file.fileName):null}));
    const ownDeclarations = program.getSourceFiles().map(file => resolve(file.fileName)).filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory,'src') + '/') || path.startsWith(resolve(item.directory,'dist') + '/'))), sourceFallbacks = ownDeclarations.filter(path => path.includes('/src/'));
    await save('published-types.json', {compiler:ts.version,strict:true,noEmit:true,skipLibCheck:true,diagnostics,sourceFallbacks,ownDeclarations:ownDeclarations.map(path=>relative(root,path)),typeResolutions,maps:41}); assert.deepEqual(diagnostics,[]); assert.deepEqual(sourceFallbacks,[]);
    for (const leaf of [name,'qualified-body-boundary-mesh']) assert.ok(ownDeclarations.includes(resolve(interop.directory,'dist',leaf+'.d.ts')));
    const browser = await build({absWorkingDir:root,entryPoints:[resolve(examples,name+'.mjs')],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,plugins:[plugin]});
    const browserGraph = graph(browser.metafile,[resolve(examples,name+'.mjs'),observer]); await writeFile(resolve(output,'browser.bundle.mjs'),browser.outputFiles[0].text); await save('browser-metafile.json',browser.metafile); await save('browser-graph.json',{mode,...browserGraph,resolutions});
  }
  console.log(JSON.stringify({mode,runtime:mode==='source'?'ordinary public source':'actual published emitted JS',types:mode==='compiled'?'strict selected published DTS':'unrun',browser:mode==='compiled'?'emitted bundle prepared; headed flow is separate':'Root source Vite headed flow remains separate'}));
} catch (error) { await save('runner-first-failure.json',{name:error.name,message:error.message,stack:error.stack??null}); throw error; }
