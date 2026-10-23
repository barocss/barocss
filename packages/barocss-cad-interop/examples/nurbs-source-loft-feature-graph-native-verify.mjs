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
const plugin = { name: 'actual-published-nurbs-source-loft', setup(builder) {
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
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {
  parseBaroCadNurbsSourceLoftFeatureGraph,
  readBaroCadNurbsSourceLoftFeatureGraph,
  parseBaroCadNurbsSourceLoftFeatureGraphUpdate,
  readBaroCadNurbsSourceLoftFeatureGraphUpdate,
  BaroCadNurbsSourceLoftReadError,
  BaroCadNurbsSourceLoftDiagnosticCode,
} from '@barocss/cad-interop/nurbs-source-loft-feature-graph';
import {NurbsSourceLoftFeatureGraphError} from '@barocss/cad';
const output=process.env.LOADER1330_EVIDENCE;
const directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples/nurbs-source-loft-feature-graph-native-data');
const pins=[
  {file:'main-revision0.authored.json',bytes:2927,sha256:'c2504c0e257860b092145c804345471fa0c4079cb6bdb85af6319b222a3f09ed',role:'authored'},
  {file:'main-revision0.whole-graph-result.json',bytes:52312,sha256:'f6285395c97bdb4bf14cc271a15589810aa68fe311386f61e3950158a9116dba',role:'graph',negativeZeros:301},
  {file:'main-revision1-middle-z-weight.whole-update-wrapper.json',bytes:56753,sha256:'d114b02b3dbf9337eea812c6062a8fdd1b718d41b2805205ba40006ceaf62b4a',role:'update',negativeZeros:302},
  {file:'main-revision2-suppressed.whole-update-wrapper.json',bytes:40743,sha256:'c9ff6cca9344d27d32b9135b55ded0224912413bb3c6241657f13023b05f1ebc',role:'update',negativeZeros:200},
  {file:'main-revision5-semantic-noop.whole-update-wrapper.json',bytes:56766,sha256:'7e080eb7c8626096537af15fcd941c12ae4d6c93bceaa7c3e25f9966b1f1f42b',role:'update',negativeZeros:302},
];
const graphFields=['document','options','originalSources','evaluatedNodes','loft','bindings','report'];
const limits={utf8Bytes:2097152,utf16Units:2097152,values:1048576,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128};
function profile(role){return{schema:'barocss-nurbs-source-loft-feature-graph-ingestion',version:0,packetRole:role,nativeSchema:role==='graph'?'barocss-nurbs-source-loft-feature-graph':'barocss-nurbs-source-loft-feature-graph-transaction',nativeVersion:0,sourceFrame:'authored-xyz-no-axis-conversion',lengthUnit:'mm',ownership:'independent-copied-cpu-data-gc',limits,capabilities:{graph:true,updateReceipt:role==='update',renderer:false,url:false,byteInput:false,smoothLoft:false,topology:false,solid:false,boolean:false,manufacturing:false,publication:false}};}
function equal(a,b,path='$'){if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Native bits/value mismatch at '+path);return;}assert.equal(Array.isArray(a),Array.isArray(b),path);assert.deepEqual(Object.keys(a),Object.keys(b),path+' fields/order');for(const key of Object.keys(b))equal(a[key],b[key],path+'.'+key);}
function refs(value,set=new Set(),mutableOnly=false){if(value&&typeof value==='object'&&!set.has(value)&&(!mutableOnly||!Object.isFrozen(value))){set.add(value);for(const item of Object.values(value))refs(item,set,mutableOnly);}return set;}
function intersections(left,right){let count=0;for(const item of left)if(right.has(item))count++;return count;}
function zeros(value,path='$',result=[]){if(typeof value==='number'&&Object.is(value,-0))result.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))zeros(item,path+'.'+key,result);return result;}
function frozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert.ok(Object.isFrozen(value));for(const item of Object.values(value))frozen(item,seen);}
function signJSON(value,space){return JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+String.fromCharCode(10);}
function pinBytes(bytes,pin){assert.equal(bytes.length,pin.bytes,pin.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,pin.file);}
function graphOf(native,role){return role==='graph'?native:native.result;}
function matchingReport(native,role){return role==='graph'?native.report:native.transaction.report;}
const readers={graph:{parse:parseBaroCadNurbsSourceLoftFeatureGraph,read:readBaroCadNurbsSourceLoftFeatureGraph},update:{parse:parseBaroCadNurbsSourceLoftFeatureGraphUpdate,read:readBaroCadNurbsSourceLoftFeatureGraphUpdate}};
const originals=new Map(),admissions=[],pairs=[],rows=[],publicCalls=[];let attempts=0,successes=0,getterCalls=0;
function invoke(role,entry,input,label){attempts++;publicCalls.push({index:attempts,role,entry,label});const result=readers[role][entry](input);successes++;return result;}
function checkAdmission(result,reference,input,text,pin,label){
  assert.deepEqual(Object.keys(result),['native','validationReport','profile','sourceText']);equal(result.native,reference);equal(result.validationReport,matchingReport(reference,pin.role));equal(result.profile,profile(pin.role));frozen(result.profile);assert.equal(result.sourceText,text);
  assert.ok(!Object.isFrozen(result.native));assert.ok(!Object.isFrozen(result.validationReport));
  assert.deepEqual(Object.keys(result.native),pin.role==='graph'?graphFields:['result','transaction']);
  const graph=graphOf(result.native,pin.role);assert.deepEqual(Object.keys(graph),graphFields);
  if(pin.role==='update'){assert.deepEqual(Object.keys(result.native.transaction),['request','report']);assert.deepEqual(Object.keys(result.native.transaction.request),['previousDocument','options','edits']);}
  assert.equal(zeros(result.native).length,pin.negativeZeros);assert.equal(graph.originalSources.length,1);assert.equal(graph.originalSources[0].source.length,1566);assert.equal(graph.originalSources[0].model.objects.length,4);assert.equal(graph.evaluatedNodes.length,3);assert.equal(graph.report.receiptCounts.sourceEditReceiptCount,3);
  assert.equal(graph.evaluatedNodes[1].nodeId,'edit_middle');assert.equal(graph.evaluatedNodes[1].evaluation.curve.id,'section_middle');assert.equal(graph.report.sourceFrame,'authored-xyz-no-axis-conversion');
  for(const key of ['smoothLoft','G1','G2','persistentTopologyBinding','topologyCertified','solid','globalBinary64ErrorCertified','manufacturing','editorDisplay','publication'])assert.equal(graph.report.quality[key],false);
  if(graph.loft.status==='suppressed'){assert.equal(graph.loft.evaluation,null);assert.equal(graph.report.receiptCounts.activeLoftReceiptCount,0);}else{assert.equal(graph.loft.status,'active');assert.ok(graph.loft.evaluation);assert.equal(graph.loft.evaluation.model.objects.length,4);assert.equal(graph.report.receiptCounts.activeLoftReceiptCount,1);}
  if(pin.file.includes('middle-z-weight'))assert.deepEqual([result.validationReport.directCounts.sourceEditEvaluationCount,result.validationReport.directCounts.loftEvaluationCount],[1,1]);
  if(pin.file.includes('suppressed'))assert.deepEqual([result.validationReport.directCounts.sourceEditEvaluationCount,result.validationReport.directCounts.loftEvaluationCount],[0,0]);
  if(pin.file.includes('semantic-noop')){assert.equal(result.validationReport.noOp,true);assert.deepEqual([result.validationReport.directCounts.sourceEditEvaluationCount,result.validationReport.directCounts.loftEvaluationCount],[0,0]);assert.equal(graph.document.revision,5);}
  const mutable=refs(result,new Set(),true),inputIntersection=intersections(mutable,refs(input)),reportIntersection=intersections(refs(result.native),refs(result.validationReport));assert.equal(inputIntersection,0);assert.equal(reportIntersection,0);
  for(const previous of admissions){const count=intersections(mutable,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}
  admissions.push({label,result,mutable,inputIntersection,reportIntersection});
}
assert.deepEqual(Object.keys(BaroCadNurbsSourceLoftDiagnosticCode).sort(),['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'].sort());
assert.equal(pins.reduce((sum,pin)=>sum+pin.bytes,0),209501);
for(const pin of pins){const bytes=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),reference=JSON.parse(text);originals.set(pin.file,{pin,text,reference});}
for(const pin of pins.filter(pin=>pin.role!=='authored')){
  const{text,reference}=originals.get(pin.file),referenceBefore=structuredClone(reference);
  const parsed=invoke(pin.role,'parse',text,pin.file+':text');checkAdmission(parsed,reference,text,text,pin,pin.file+':text');
  const input=structuredClone(reference),inputBefore=structuredClone(input);
  const copied=invoke(pin.role,'read',input,pin.file+':owned');checkAdmission(copied,reference,input,null,pin,pin.file+':owned');equal(input,inputBefore);
  const written=Buffer.from(signJSON(parsed.native),'utf8');pinBytes(written,pin);writeFileSync(resolve(output,pin.file),written);const coldText=readFileSync(resolve(output,pin.file),'utf8');assert.equal(coldText,text);
  const cold=invoke(pin.role,'parse',coldText,pin.file+':cold');checkAdmission(cold,reference,coldText,coldText,pin,pin.file+':cold');
  const parsedBefore=structuredClone(parsed),coldBefore=structuredClone(cold),nativeReportBefore=structuredClone(matchingReport(copied.native,pin.role));
  graphOf(input,pin.role).originalSources[0].source+=' ';equal(copied.native,reference);
  graphOf(copied.native,pin.role).originalSources[0].source+=' ';graphOf(copied.native,pin.role).evaluatedNodes[1].evaluation.curve.controlPoints[0][2]+=1;
  if(pin.role==='graph')copied.validationReport.quality.publication=true;else copied.validationReport.directCounts.sourceEditEvaluationCount+=1;
  equal(matchingReport(copied.native,pin.role),nativeReportBefore);equal(parsed,parsedBefore);equal(cold,coldBefore);equal(reference,referenceBefore);
  const graph=graphOf(parsed.native,pin.role);
  rows.push({pin,writtenPin:{file:pin.file,bytes:written.length,sha256:createHash('sha256').update(written).digest('hex')},native:parsed.native,validationReport:parsed.validationReport,profile:parsed.profile,sourceText:parsed.sourceText,negativeZeroPaths:zeros(parsed.native),retainedReceiptCounts:graph.report.receiptCounts,directCounts:pin.role==='update'?parsed.validationReport.directCounts:null,loftStatus:graph.loft.status,copyMutationIsolated:true});
}
const initial=originals.get('main-revision0.whole-graph-result.json').reference,authored=originals.get('main-revision0.authored.json').reference,middle=originals.get('main-revision1-middle-z-weight.whole-update-wrapper.json').reference;
equal(authored,initial.document);assert.equal(zeros(authored).length,1);assert.equal(successes,12);assert.equal(pairs.length,66);
const accepted=admissions.at(-1).result,acceptedBefore=structuredClone(accepted),acceptedRefs=refs(accepted),refusals=[];
function errorReceipt(error){const row={name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};if(error?.cause!==undefined)row.cause=error.cause instanceof Error?{name:error.cause.name,code:error.cause.code??null,message:error.cause.message,cause:error.cause.cause??null}:error.cause;return row;}
function refuse(name,role,entry,input,code,native=false){const previousSuccesses=successes;let error;try{invoke(role,entry,input,name);}catch(cause){error=cause;}assert.ok(error instanceof BaroCadNurbsSourceLoftReadError,name);assert.equal(error.code,code,name);assert.ok(error.message.length<=1024);if(native){assert.ok(error.cause instanceof NurbsSourceLoftFeatureGraphError);assert.equal(error.cause.code,'OWNED');}assert.equal(successes,previousSuccesses);equal(accepted,acceptedBefore);const now=refs(accepted);assert.equal(now.size,acceptedRefs.size);for(const ref of now)assert.ok(acceptedRefs.has(ref));assert.equal(zeros(accepted.native).length,302);refusals.push({name,role,entry,error:errorReceipt(error),acceptedRetained:true,getterCalls});}
refuse('wrong-graph-text-primitive','graph','parse',0,'INPUT');
refuse('wrong-update-text-primitive','update','parse',0,'INPUT');
refuse('malformed-json','graph','parse','{','JSON');
refuse('decoded-escaped-duplicate','update','parse','{"result":{},"\\u0072esult":{}}','JSON');
refuse('wrong-graph-owned-primitive','graph','read',0,'INPUT');
refuse('wrong-update-owned-primitive','update','read',0,'INPUT');
const schema=structuredClone(initial);schema.report.schema='unknown';refuse('wrong-graph-schema','graph','read',schema,'SCHEMA');
const version=structuredClone(middle);version.transaction.report.version=1;refuse('wrong-update-transaction-version','update','read',version,'SCHEMA');
const getter=structuredClone(initial);Object.defineProperty(getter,'report',{enumerable:true,get(){getterCalls++;return initial.report;}});refuse('graph-own-getter','graph','read',getter,'OWNED');assert.equal(getterCalls,0);
const cyclic=structuredClone(middle);cyclic.transaction.request.previousDocument=cyclic;refuse('update-own-cycle','update','read',cyclic,'OWNED');
refuse('raw-utf16-over-cap','graph','parse',' '.repeat(limits.utf16Units+1),'BUDGET');
refuse('raw-utf8-over-cap','update','parse','é'.repeat(limits.utf8Bytes/2+1),'BUDGET');
const mutations=[
  {name:'original-source-mismatch',role:'graph',original:initial,path:'$.originalSources[0].source',change:value=>{value.originalSources[0].source+=' ';}},
  {name:'selected-curve-value-mismatch',role:'graph',original:initial,path:'$.evaluatedNodes[1].evaluation.curve.controlPoints[0][2]',change:value=>{assert.equal(value.evaluatedNodes[1].evaluation.curve.controlPoints[0][2],1);value.evaluatedNodes[1].evaluation.curve.controlPoints[0][2]=2;}},
  {name:'binding-revision-mismatch',role:'graph',original:initial,path:'$.bindings.nodes[1].revision',change:value=>{assert.equal(value.bindings.nodes[1].revision,0);value.bindings.nodes[1].revision=1;}},
  {name:'transaction-direct-count-mismatch',role:'update',original:middle,path:'$.transaction.report.directCounts.sourceEditEvaluationCount',change:value=>{assert.equal(value.transaction.report.directCounts.sourceEditEvaluationCount,1);value.transaction.report.directCounts.sourceEditEvaluationCount=2;}},
];
for(const mutation of mutations){const candidate=structuredClone(mutation.original);mutation.change(candidate);const before=structuredClone(candidate);refuse(mutation.name,mutation.role,'read',candidate,'NATIVE',true);equal(candidate,before);refusals.at(-1).mutationPath=mutation.path;}
assert.equal(refusals.length,16);assert.equal(attempts,28);assert.equal(successes,12);assert.equal(getterCalls,0);
for(const pin of pins)pinBytes(readFileSync(resolve(directory,pin.file)),pin);
const summary={result:'nurbs-source-loft-public-file-copy-ok',pins,totalOriginalBytes:209501,completeReceiptBytes:206574,authoredProvenance:{native:authored,negativeZeroPaths:zeros(authored),wholeInitialDocumentEqual:true,publicAdmission:false},rows,counts:{attempts,successes,refusals:16,getterCalls,mutableReferencePairs:pairs.length},publicCalls,mutableReferenceIntersections:pairs,inputAndReportIntersections:admissions.map(item=>({label:item.label,input:item.inputIntersection,report:item.reportIntersection})),refusals,acceptedRetained:true,nativeCallEvidence:'Only actual public reader attempts are runtime-counted. The verifier separately checks one source callsite for each matching whole validator; it does not report native execution telemetry.',scope:'Four complete original Graph/Update receipts/text+owned+private native-only sign-preserving file reopen/12 successes/16 refusals/copies; authored fifth is provenance only; no direct producer/update/authored parse/engine/URL/public serializer'};
writeFileSync(resolve(output,'summary.json'),signJSON(summary,2));
console.log(JSON.stringify({result:summary.result,attempts,successes,refusals:16,mutableReferencePairs:pairs.length,getterCalls}));
`;

const bundle = await build({ absWorkingDir: root, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true,
  stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'nurbs-source-loft-public-consumer.mjs' },
  ...(mode === 'compiled' ? { plugins: [plugin] } : {}),
});
const wrapperSource = await readFile(resolve(packages.get('@barocss/cad-interop').directory, 'src/features/nurbs-source-loft-feature-graph.ts'), 'utf8');
const nativeCallsiteEvidence = { source: 'packages/barocss-cad-interop/src/nurbs-source-loft-feature-graph.ts', graphCallsites: [...wrapperSource.matchAll(/validateNurbsSourceLoftFeatureGraph\s*\(/g)].length, updateCallsites: [...wrapperSource.matchAll(/validateNurbsSourceLoftFeatureGraphUpdate\s*\(/g)].length, kind: 'static source callsites, not runtime telemetry' };
assert.equal(nativeCallsiteEvidence.graphCallsites,1);assert.equal(nativeCallsiteEvidence.updateCallsites,1);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
const ownSource = own.filter(path => path.includes('/src/')), ownCompiled = own.filter(path => path.includes('/dist/'));
assert.ok(own.length > 0);assert.equal(mode === 'source' ? ownCompiled.length : ownSource.length, 0);
const runtimeFolder = mode === 'source' ? 'src' : 'dist', runtimeExtension = mode === 'source' ? '.ts' : '.js';
for (const [suffix, leaf] of [['cad-interop','nurbs-source-loft-feature-graph'],['cad-interop','qualified-body-json'],['cad','nurbs-source-loft-feature-graph']]) {
  const required = resolve(root, 'packages/barocss-' + suffix, runtimeFolder, leaf + runtimeExtension);
  assert.ok(own.includes(required), 'Actual public authority in graph: ' + relative(root, required));
}
const peers = inputs.filter(path => /(?:node_modules\/.*(?:three|babylon|pixi)|barocss-gpu)/i.test(path));assert.deepEqual(peers, []);
await writeFile(resolve(output, 'consumer-source.mjs'), consumer);
await writeFile(resolve(output, 'consumer.bundle.mjs'), bundle.outputFiles[0].text);
await writeFile(resolve(output, 'consumer-metafile.json'), JSON.stringify(bundle.metafile, null, 2));
await writeFile(resolve(output, 'graphs.json'), JSON.stringify({ mode, node: process.version, ownSource:ownSource.map(path=>relative(root,path)),ownCompiled:ownCompiled.map(path=>relative(root,path)),ownSourceCount:ownSource.length,ownCompiledCount:ownCompiled.length,enginePeers:peers,resolutions,nativeCallsiteEvidence }, null, 2));
const run = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: bundle.outputFiles[0].text, encoding: 'utf8', timeout:30000, maxBuffer:16*1024*1024, env:{...process.env,LOADER1330_EVIDENCE:output} });
await writeFile(resolve(output,'consumer.stdout'),run.stdout??'');await writeFile(resolve(output,'consumer.stderr'),run.stderr??'');
await writeFile(resolve(output,'consumer.exit'),String(run.status));
await writeFile(resolve(output,'consumer.result.json'),JSON.stringify({status:run.status,signal:run.signal,error:run.error?{name:run.error.name,code:run.error.code??null,message:run.error.message,stack:run.error.stack??null}:null,timeoutMs:30000},null,2));
process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');assert.equal(run.status,0,'Actual public NURBS source Loft consumer failed');

if(mode==='compiled') {
  const interop=packages.get('@barocss/cad-interop'),development=interop.manifest.exports,publishedMap=interop.manifest.publishConfig.exports;
  const baselineRun=spawnSync('git',['show','4ccbb8101024a485158b13a3430db37b07d75aab:packages/barocss-cad-interop/package.json'],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(baselineRun.status,0);
  const baseline=JSON.parse(baselineRun.stdout);assert.equal(Object.keys(baseline.exports).length,36);
  assert.deepEqual(Object.keys(development).sort(),[...Object.keys(baseline.exports),'./nurbs-source-loft-feature-graph'].sort());
  assert.deepEqual(Object.keys(development).sort(),Object.keys(publishedMap).sort());
  for(const key of Object.keys(baseline.exports)){assert.deepEqual(development[key],baseline.exports[key]);assert.deepEqual(publishedMap[key],baseline.publishConfig.exports[key]);}
  assert.deepEqual(development['./nurbs-source-loft-feature-graph'],{types:'./src/features/nurbs-source-loft-feature-graph.ts',import:'./src/features/nurbs-source-loft-feature-graph.ts'});
  assert.deepEqual(publishedMap['./nurbs-source-loft-feature-graph'],{types:'./dist/features/nurbs-source-loft-feature-graph.d.ts',import:'./dist/features/nurbs-source-loft-feature-graph.js'});
  for(const entry of Object.values(publishedMap)){await access(resolve(interop.directory,entry.import));await access(resolve(interop.directory,entry.types));}
  const typeSource=await readFile(resolve(examples,'nurbs-source-loft-feature-graph-native-contract.ts'),'utf8');
  const virtual=resolve(interop.directory,'examples/nurbs-source-loft-private-published-type-consumer.mts');
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
  await writeFile(resolve(output,'published-types.json'),JSON.stringify({compiler:ts.version,strict:true,noEmit:true,skipLibCheck:true,diagnostics,sourceFallbacks,ownDeclarations:ownDeclarations.map(path=>relative(root,path)),typeResolutions,baselineMaps:36,currentMaps:Object.keys(development).length},null,2));
  assert.deepEqual(diagnostics,[]);assert.deepEqual(sourceFallbacks,[]);
  for(const suffix of ['cad','cad-interop'])assert.ok(ownDeclarations.includes(resolve(root,'packages/barocss-'+suffix+'/dist/nurbs-source-loft-feature-graph.d.ts')));
}
console.log(JSON.stringify({mode,publicRuntime:mode==='source'?'ordinary source':'actual emitted JS',types:mode==='compiled'?'actual emitted strict selected declarations':'unrun'}));
