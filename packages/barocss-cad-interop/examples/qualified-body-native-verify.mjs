import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const examples = resolve(root, 'packages/barocss-cad-interop/examples');
function argument(name) { const index = process.argv.indexOf(name); assert.ok(index >= 0 && process.argv[index + 1], name + ' required'); return process.argv[index + 1]; }
const mode = argument('--mode'), output = resolve(argument('--output'));
assert.ok(['source', 'compiled'].includes(mode));
assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Node22 required');
await mkdir(output, { recursive: true });
const packages = new Map();
for (const suffix of ['cad', 'cad-interop']) {
  const directory = resolve(root, 'packages/barocss-' + suffix);
  const manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  packages.set('@barocss/' + suffix, { directory, manifest });
  if (mode === 'source') {
    let exists = false;
    try { await access(resolve(directory, 'dist')); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    assert.equal(exists, false, 'Run source checkpoint before own builds');
  }
}
function published(specifier, field) {
  const name = specifier.split('/').slice(0, 2).join('/'), item = packages.get(name);
  const suffix = specifier.slice(name.length), key = suffix ? '.' + suffix : '.';
  const target = item?.manifest.publishConfig?.exports?.[key]?.[field];
  assert.ok(target?.startsWith('./dist/'), 'Actual public emitted entry required: ' + specifier);
  return resolve(item.directory, target);
}
const resolutions = [];
const plugin = { name: 'actual-published-qualified-body', setup(builder) {
  builder.onResolve({ filter: /^@barocss\/(cad|cad-interop)(\/|$)/ }, args => {
    const path = published(args.path, 'import');
    resolutions.push({ specifier: args.path, importer: relative(root, args.importer), target: relative(root, path) });
    return { path };
  });
} };

// This consumer is bundled through the ordinary public entry in source mode.
// Node file work belongs to the example, not the public reader.
const consumer = String.raw`
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  parseBaroCadQualifiedTranslatedStripBody as parse,
  readBaroCadQualifiedTranslatedStripBody as read,
  BaroCadQualifiedBodyReadError,
  BaroCadQualifiedBodyDiagnosticCode,
} from '@barocss/cad-interop/qualified-body';
import { QualifiedTranslatedStripBodyError } from '@barocss/cad';
const output = process.env.LOADER1321_EVIDENCE;
const directory = resolve(process.cwd(), 'packages/barocss-cad-interop/examples/qualified-body-native-data');
const PINS = [
  {file:'bodymain.owned-body.json',bytes:2001336,sha256:'f9d9d0914659c3bca8b6ee362da1c8c822543b88c4a28c4e2ca0b6de27a6be48'},
  {file:'edited.owned-body.json',bytes:2011758,sha256:'c103947b30bbb1a2f39f48c4f8a79aa987c1fd4489f8ca924a3b44ed0f6b4ba4'},
  {file:'nonuni.owned-body.json',bytes:2044025,sha256:'1098d4c4d6395cc7ccaf3a36bef3c51bf2b651c5e8637854940103f09bcbb6cb'},
];
const rootFields=['base','ends','volume','options','models','vertices','edges','faces','shell','body','proof','observations','report'];
function equal(actual, expected, path='$') {
  if (actual === null || expected === null || typeof actual !== 'object' || typeof expected !== 'object') {
    assert.ok(Object.is(actual,expected), 'Native bits/value mismatch at '+path); return;
  }
  assert.equal(Array.isArray(actual),Array.isArray(expected),path);
  assert.deepEqual(Object.keys(actual),Object.keys(expected),path+' fields/order');
  for(const key of Object.keys(expected))equal(actual[key],expected[key],path+'.'+key);
}
function refs(value, set=new Set()) {
  if(value!==null&&typeof value==='object'&&!set.has(value)) {
    set.add(value);for(const item of Object.values(value))refs(item,set);
  }
  return set;
}
function intersection(left,right) { let count=0;for(const value of left)if(right.has(value))count++;return count; }
function zeros(value,path='$',result=[]) {
  if(typeof value==='number'&&Object.is(value,-0))result.push(path);
  else if(value!==null&&typeof value==='object')for(const [key,item]of Object.entries(value))zeros(item,path+'.'+key,result);
  return result;
}
function signJSON(value, space) { return JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+String.fromCharCode(10); }
function pinBytes(bytes,pin) { assert.equal(bytes.length,pin.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256); }
function deeplyFrozen(value,seen=new Set()) { if(value===null||typeof value!=='object'||seen.has(value))return;seen.add(value);assert.ok(Object.isFrozen(value));Object.values(value).forEach(item=>deeplyFrozen(item,seen)); }
const limits={utf8Bytes:2097152,utf16Units:2097152,values:1048576,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128};
const profile={schema:'barocss-qualified-translated-strip-body-ingestion',version:0,nativeSchema:'barocss-qualified-translated-strip-body',nativeVersion:0,sourceFrame:'authored-xyz-no-axis-conversion',lengthUnit:'mm',volumeUnit:'mm3',uvLengthUnit:'dimensionless',ownership:'independent-copied-cpu-data-gc',limits,capabilities:{nativeRestrictedBody:true,renderer:false,url:false,byteInput:false,genericSolid:false,boolean:false,worldPointQuery:false,manufacturing:false,exchange:false,publication:false}};
assert.deepEqual(Object.keys(BaroCadQualifiedBodyDiagnosticCode).sort(),['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'].sort());
let attempts=0, successes=0, getterCalls=0;
const admissions=[], publicCalls=[], intersections=[], rows=[], originals=[];
function invoke(entry,input,label) { attempts++;publicCalls.push({index:attempts,entry,label});const result=entry==='parse'?parse(input):read(input);successes++;return result; }
function checkAdmission(result,reference,input,sourceText,label) {
  assert.deepEqual(Object.keys(result),['native','validationReport','profile','sourceText']);
  equal(result.native,reference);equal(result.validationReport,reference.report);equal(result.profile,profile);
  assert.equal(result.sourceText,sourceText);assert.deepEqual(Object.keys(result.native),rootFields);
  assert.equal(zeros(result.native).length,60);
  assert.deepEqual(result.native.models.map(item=>item.model.objects.length),[16,2]);
  assert.equal(result.native.faces.length,6);assert.equal(result.native.edges.length,12);assert.equal(result.native.vertices.length,8);
  assert.equal(result.native.faces.reduce((sum,face)=>sum+face.loop.uses.length,0),24);
  assert.equal(result.native.proof.vertexLinks.length,8);assert.equal(result.native.proof.material.sixFaceImages.length,6);
  assert.equal(result.native.report.quality.restrictedSolid,true);assert.equal(result.native.report.quality.genericBoolean,false);
  assert.equal(result.native.report.sourceFrame,'authored-xyz-no-axis-conversion');assert.equal(result.native.report.uvLengthUnit,'dimensionless');
  const mutable=refs({native:result.native,validationReport:result.validationReport});
  const inputRefs=refs(input), ownReportIntersection=intersection(refs(result.native),refs(result.validationReport));
  assert.equal(ownReportIntersection,0);assert.equal(intersection(mutable,inputRefs),0);
  for(const previous of admissions){const count=intersection(mutable,previous.refs);assert.equal(count,0);intersections.push({left:label,right:previous.label,count});}
  admissions.push({result,label,refs:mutable});
  // The published profile is deeply frozen; immutable sharing is allowed.
  deeplyFrozen(result.profile);
}
assert.equal(PINS.reduce((sum,pin)=>sum+pin.bytes,0),6057119);
for(const pin of PINS) {
  const bytes=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),reference=JSON.parse(text),before=structuredClone(reference);
  originals.push({pin,text,reference});
  const parsed=invoke('parse',text,pin.file+':text');checkAdmission(parsed,reference,text,text,pin.file+':text');
  const copied=invoke('read',reference,pin.file+':owned');checkAdmission(copied,reference,reference,null,pin.file+':owned');equal(reference,before);
  const written=Buffer.from(signJSON(parsed.native),'utf8');pinBytes(written,pin);
  const reopenedFile=resolve(output,pin.file);writeFileSync(reopenedFile,written);
  const reopenedText=readFileSync(reopenedFile,'utf8');assert.equal(reopenedText,text);
  const cold=invoke('parse',reopenedText,pin.file+':cold');checkAdmission(cold,reference,reopenedText,reopenedText,pin.file+':cold');
  const preservedParsed=structuredClone({native:parsed.native,report:parsed.validationReport}),preservedCold=structuredClone({native:cold.native,report:cold.validationReport});
  copied.native.models[0].source+=' ';copied.native.base.lowerWall.binding.section.originalModels[0].objects[0].knots[0]=123;
  copied.validationReport.quality.genericBoolean=true;
  equal(reference,before);equal({native:parsed.native,report:parsed.validationReport},preservedParsed);equal({native:cold.native,report:cold.validationReport},preservedCold);
  assert.equal(copied.native.report.quality.genericBoolean,false,'Separate report cannot mutate native.report');
  rows.push({pin,writtenPin:{file:pin.file,bytes:written.length,sha256:createHash('sha256').update(written).digest('hex')},negativeZeroPaths:zeros(parsed.native),native:parsed.native,validationReport:parsed.validationReport,profile:parsed.profile,copyMutationIsolated:true});
}
const aliasInput=structuredClone(originals[0].reference),use=aliasInput.faces[0].loop.uses[0];
equal(aliasInput.edges[0].uses[0],use);aliasInput.edges[0].uses[0]=use;
assert.equal(aliasInput.faces[0].loop.uses[0],aliasInput.edges[0].uses[0]);
const aliased=invoke('read',aliasInput,'whole-aliased-use');checkAdmission(aliased,originals[0].reference,aliasInput,null,'whole-aliased-use');
assert.notEqual(aliased.native.faces[0].loop.uses[0],aliased.native.edges[0].uses[0]);
const accepted=aliased,acceptedRefs=refs(accepted),acceptedBefore=structuredClone(accepted);
const refusals=[];
function receipt(error) { const result={name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};if(error?.cause!==undefined)result.cause={name:error.cause?.name??null,code:error.cause?.code??null,message:error.cause?.message??String(error.cause)};return result; }
function refuse(name,entry,input,code,native=false) {
  const beforeAttempts=attempts,beforeSuccesses=successes;let error;
  try {invoke(entry,input,name);}catch(cause){error=cause;}
  assert.ok(error instanceof BaroCadQualifiedBodyReadError,name);assert.equal(error.code,code,name);assert.ok(error.message.length<=1024);
  if(native){assert.ok(error.cause instanceof QualifiedTranslatedStripBodyError);assert.equal(error.cause.code,'OWNED');}
  assert.equal(attempts,beforeAttempts+1);assert.equal(successes,beforeSuccesses);
  equal(accepted,acceptedBefore);const now=refs(accepted);assert.equal(now.size,acceptedRefs.size);for(const value of now)assert.ok(acceptedRefs.has(value));
  assert.equal(zeros(accepted.native).length,60);refusals.push({name,entry,error:receipt(error),acceptedRetained:true,getterCalls});
}
refuse('wrong-text-primitive','parse',0,'INPUT');
refuse('malformed-json','parse','{','JSON');
refuse('decoded-escaped-duplicate','parse','{"report":{},"\\u0072eport":{}}','JSON');
refuse('escaped-lone-surrogate','parse','"\\ud800"','JSON');
refuse('nonfinite-json','parse','1e400','JSON');
refuse('raw-utf16-over-cap','parse',' '.repeat(limits.utf16Units+1),'BUDGET');
refuse('raw-utf8-over-cap','parse','é'.repeat(limits.utf8Bytes/2+1),'BUDGET');
const accessor=structuredClone(originals[0].reference);Object.defineProperty(accessor,'report',{enumerable:true,get(){getterCalls++;return originals[0].reference.report;}});
refuse('own-getter','read',accessor,'OWNED');assert.equal(getterCalls,0);
const cyclic=structuredClone(originals[0].reference);cyclic.base=cyclic;refuse('own-cycle','read',cyclic,'OWNED');
const schema=structuredClone(originals[0].reference);schema.report.schema='unknown';refuse('wrong-native-schema','read',schema,'SCHEMA');
const version=structuredClone(originals[0].reference);version.report.version=1;refuse('wrong-native-version','read',version,'SCHEMA');
refuse('wrong-owned-primitive','read',0,'INPUT');
for(const [name,mutate]of[
  ['stored-source-changed',value=>{value.models[0].source+=' ';}],
  ['material-proof-changed',value=>{value.proof.material.embeddedClosedBoundary=false;}],
  ['qualified-support-ref-changed',value=>{value.faces[0].supportRef.objectId=value.edges[0].curveRef.objectId;}],
  ['unsupported-quality-claim',value=>{value.report.quality.genericBoolean=true;}],
]){const candidate=structuredClone(originals[0].reference),before=structuredClone(candidate);mutate(candidate);const changed=structuredClone(candidate);refuse(name,'read',candidate,'NATIVE',true);equal(candidate,changed);assert.notDeepEqual(candidate,before);}
assert.equal(refusals.length,16);assert.equal(successes,10);assert.equal(attempts,26);assert.equal(getterCalls,0);
for(const original of originals)pinBytes(readFileSync(resolve(directory,original.pin.file)),original.pin);
const summary={result:'qualified-body-public-file-copy-ok',pins:PINS,rows,aliasedWholeUse:{structuralEquality:true,inputAlias:true,outputAlias:false,callerAlias:false},publicCalls,counts:{attempts,successes,refusals:refusals.length,getterCalls},mutableReferenceIntersections:intersections,refusals,acceptedRetained:true,nativeCallEvidence:'One actual public validator callsite per eligible reader admission is checked statically; this consumer records public API attempts, not native validator telemetry.',scope:'Three complete literal native donors/text+owned+private file reopen/one whole-Use alias/16 genuine refusals/independent CPU copies only; no renderer, URL, byte entry, producer replay or public serializer'};
writeFileSync(resolve(output,'summary.json'),signJSON(summary,2));
console.log(JSON.stringify({result:summary.result,attempts,successes,refusals:refusals.length,donorBytes:6057119,getterCalls}));
`;

const bundle = await build({ absWorkingDir: root, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true,
  stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'qualified-body-public-consumer.mjs' },
  ...(mode === 'compiled' ? { plugins: [plugin] } : {}),
});
const wrapperSource = await readFile(resolve(packages.get('@barocss/cad-interop').directory, 'src/qualified-body.ts'), 'utf8');
const nativeCallsiteEvidence = { source: 'packages/barocss-cad-interop/src/qualified-body.ts', callsites: [...wrapperSource.matchAll(/validateQualifiedTranslatedStripBody\s*\(/g)].length, kind: 'static source callsite count, not runtime telemetry' };
assert.equal(nativeCallsiteEvidence.callsites, 1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
const ownSource = own.filter(path => path.includes('/src/')), ownCompiled = own.filter(path => path.includes('/dist/'));
assert.ok(own.length > 0);assert.equal(mode === 'source' ? ownCompiled.length : ownSource.length, 0);
for (const leaf of ['qualified-body', 'qualified-body-json', 'qualified-translated-strip-body'])assert.ok(own.some(path => path.endsWith('/'+leaf+(mode==='source'?'.ts':'.js'))), 'Actual public authority in graph: '+leaf);
const peers = inputs.filter(path => /(?:node_modules\/.*(?:three|babylon|pixi)|barocss-gpu)/i.test(path));assert.deepEqual(peers, []);
await writeFile(resolve(output, 'consumer-source.mjs'), consumer);
await writeFile(resolve(output, 'consumer.bundle.mjs'), bundle.outputFiles[0].text);
await writeFile(resolve(output, 'consumer-metafile.json'), JSON.stringify(bundle.metafile, null, 2));
await writeFile(resolve(output, 'graphs.json'), JSON.stringify({ mode, node: process.version, ownSource:ownSource.map(path=>relative(root,path)),ownCompiled:ownCompiled.map(path=>relative(root,path)),ownSourceCount:ownSource.length,ownCompiledCount:ownCompiled.length,enginePeers:peers,resolutions,nativeCallsiteEvidence }, null, 2));
const run = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: bundle.outputFiles[0].text, encoding: 'utf8', timeout:30000, maxBuffer:16*1024*1024, env:{...process.env,LOADER1321_EVIDENCE:output} });
await writeFile(resolve(output,'consumer.stdout'),run.stdout??'');await writeFile(resolve(output,'consumer.stderr'),run.stderr??'');
await writeFile(resolve(output,'consumer.exit'),String(run.status));
await writeFile(resolve(output,'consumer.result.json'),JSON.stringify({status:run.status,signal:run.signal,error:run.error?{name:run.error.name,code:run.error.code??null,message:run.error.message,stack:run.error.stack??null}:null,timeoutMs:30000},null,2));
process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');assert.equal(run.status,0,'Actual public qualified Body consumer failed');

if(mode==='compiled') {
  const interop=packages.get('@barocss/cad-interop'),development=interop.manifest.exports,publishedMap=interop.manifest.publishConfig.exports;
  const baselineRun=spawnSync('git',['show','2cb2f890d19cfb628c899be10b5b77eec0e25bd4:packages/barocss-cad-interop/package.json'],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(baselineRun.status,0);
  const baseline=JSON.parse(baselineRun.stdout);assert.equal(Object.keys(baseline.exports).length,35);
  assert.deepEqual(Object.keys(development).sort(),[...Object.keys(baseline.exports),'./qualified-body'].sort());
  assert.deepEqual(Object.keys(development).sort(),Object.keys(publishedMap).sort());
  for(const key of Object.keys(baseline.exports)){assert.deepEqual(development[key],baseline.exports[key]);assert.deepEqual(publishedMap[key],baseline.publishConfig.exports[key]);}
  assert.deepEqual(development['./qualified-body'],{types:'./src/qualified-body.ts',import:'./src/qualified-body.ts'});
  assert.deepEqual(publishedMap['./qualified-body'],{types:'./dist/qualified-body.d.ts',import:'./dist/qualified-body.js'});
  for(const entry of Object.values(publishedMap)){await access(resolve(interop.directory,entry.import));await access(resolve(interop.directory,entry.types));}
  const typeSource=await readFile(resolve(examples,'qualified-body-native-contract.ts'),'utf8');
  const virtual=resolve(interop.directory,'examples/qualified-body-private-published-type-consumer.mts');
  const compilerOptions={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,skipLibCheck:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']};
  const host=ts.createCompilerHost(compilerOptions),get=host.getSourceFile.bind(host),exists=host.fileExists.bind(host),readFileOriginal=host.readFile.bind(host),typeResolutions=[];
  host.getSourceFile=(path,version,onError,newFile)=>resolve(path)===virtual?ts.createSourceFile(virtual,typeSource,version,true,ts.ScriptKind.TS):get(path,version,onError,newFile);
  host.fileExists=path=>resolve(path)===virtual||exists(path);host.readFile=path=>resolve(path)===virtual?typeSource:readFileOriginal(path);
  host.resolveModuleNames=(names,containingFile)=>names.map(name=>{
    if(/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)){const path=published(name,'types');typeResolutions.push({name,importer:relative(root,containingFile),target:relative(root,path)});return{resolvedFileName:path,extension:ts.Extension.Dts,isExternalLibraryImport:true};}
    return ts.resolveModuleName(name,containingFile,compilerOptions,host).resolvedModule;
  });
  const program=ts.createProgram([virtual],compilerOptions,host),diagnostics=ts.getPreEmitDiagnostics(program).map(item=>({code:item.code,message:ts.flattenDiagnosticMessageText(item.messageText,'\n'),file:item.file?relative(root,item.file.fileName):null}));
  const files=program.getSourceFiles().map(file=>resolve(file.fileName)),ownDeclarations=files.filter(path=>[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'src')+'/')||path.startsWith(resolve(item.directory,'dist')+'/'))),sourceFallbacks=ownDeclarations.filter(path=>path.includes('/src/'));
  await writeFile(resolve(output,'published-types.json'),JSON.stringify({compiler:ts.version,strict:true,noEmit:true,skipLibCheck:true,diagnostics,sourceFallbacks,ownDeclarations:ownDeclarations.map(path=>relative(root,path)),typeResolutions,baselineMaps:35,currentMaps:Object.keys(development).length},null,2));
  assert.deepEqual(diagnostics,[]);assert.deepEqual(sourceFallbacks,[]);
  assert.ok(ownDeclarations.some(path=>path.endsWith('/qualified-body.d.ts')));assert.ok(ownDeclarations.some(path=>path.endsWith('/qualified-translated-strip-body.d.ts')));
}
console.log(JSON.stringify({mode,publicRuntime:mode==='source'?'ordinary source':'actual emitted JS',types:mode==='compiled'?'actual emitted strict selected declarations':'unrun'}));
