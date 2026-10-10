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
const plugin = { name: 'actual-published-translated-strip-world-points', setup(builder) {
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
import{readFileSync,writeFileSync}from'node:fs';
import{resolve}from'node:path';
import{createHash}from'node:crypto';
import{
 parseBaroCadTranslatedSurfaceStripWorldPointClassification as parse,
 readBaroCadTranslatedSurfaceStripWorldPointClassification as read,
 BaroCadTranslatedStripWorldPointReadError,
 BaroCadTranslatedStripWorldPointDiagnosticCode,
}from'@barocss/cad-interop/translated-strip-world-points';
import{TranslatedSurfaceStripWorldPointError}from'@barocss/cad';
const output=process.env.LOADER1333_EVIDENCE,directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples/translated-strip-world-points-native-data');
const pins=[
 {file:'oldedit_0.point-result.json',bytes:694318,sha256:'a58f6696312fa5753bfb77cd44ff91fa0508116f5eb049a2a0ed807dd9dc3634',role:'result'},
 {file:'newedit_0.point-result.json',bytes:694695,sha256:'4112d69d5d50bbc105ee6d57cfedb83a023dd622e3daf891a7d188ed8d392ac2',role:'result'},
 {file:'zeroL_0.point-result.json',bytes:266018,sha256:'9099a5b0e1c62c9553ab29db47d2936719893275f5b7c9ebada7d864297ece7f',role:'result'},
 {file:'zeroL_0.independent-oracle.json',bytes:5733,sha256:'e85b6f78cf01778743ad269b4ec66fe76294d482419eb0a5090a8574dbdb2768',role:'oracle'},
];
const nativeFields=['volume','queries','options','classifications','proof','report'];
const limits={utf8Bytes:1048576,utf16Units:1048576,values:1048576,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128};
const profile={schema:'barocss-translated-strip-world-point-ingestion',version:0,nativeSchema:'barocss-translated-surface-strip-world-points',nativeVersion:0,sourceFrame:'authored-xyz-no-axis-conversion',lengthUnit:'mm',uvLengthUnit:'dimensionless',ownership:'independent-copied-cpu-data-gc',limits,capabilities:{sourceRegion:true,worldPoints:true,body:false,brep:false,solid:false,renderer:false,picking:false,url:false,byteInput:false,boolean:false,manufacturing:false,exchange:false,publication:false}};
function equal(a,b,path='$'){if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Native bits/value mismatch '+path);return;}assert.equal(Array.isArray(a),Array.isArray(b));assert.deepEqual(Object.keys(a),Object.keys(b),path+' fields/order');for(const key of Object.keys(a))equal(a[key],b[key],path+'.'+key);}
function refs(value,set=new Set(),mutableOnly=false){if(value&&typeof value==='object'&&!set.has(value)&&(!mutableOnly||!Object.isFrozen(value))){set.add(value);for(const item of Object.values(value))refs(item,set,mutableOnly);}return set;}
function intersections(a,b){let count=0;for(const value of a)if(b.has(value))count++;return count;}
function zeros(value,path='$',result=[]){if(typeof value==='number'&&Object.is(value,-0))result.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))zeros(item,path+'.'+key,result);return result;}
function frozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert.ok(Object.isFrozen(value));for(const item of Object.values(value))frozen(item,seen);}
function signJSON(value,space){return JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+String.fromCharCode(10);}
function pinBytes(bytes,pin){assert.equal(bytes.length,pin.bytes,pin.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,pin.file);}
const originals=new Map(),admissions=[],pairs=[],rows=[],publicCalls=[];let attempts=0,successes=0,getterCalls=0;
function invoke(entry,input,label){attempts++;publicCalls.push({index:attempts,entry,label});const result=entry==='parse'?parse(input):read(input);successes++;return result;}
function checkAdmission(result,reference,input,text,pin,label){
 assert.deepEqual(Object.keys(result),['native','validationReport','profile','sourceText']);equal(result.native,reference);equal(result.validationReport,reference.report);equal(result.profile,profile);frozen(result.profile);assert.equal(result.sourceText,text);assert.ok(!Object.isFrozen(result.native));assert.ok(!Object.isFrozen(result.validationReport));assert.deepEqual(Object.keys(result.native),nativeFields);assert.equal(zeros(result.native).length,24);
 const report=result.validationReport;assert.equal(report.schema,profile.nativeSchema);assert.equal(report.version,0);assert.equal(report.lengthUnit,'mm');assert.equal(report.sourceFrame,'authored-xyz-no-axis-conversion');assert.equal(report.quality.exactRegionMembershipCertified,true);assert.equal(report.quality.sourceDefinedRegionAuthority,true);
 for(const key of['nativeBodyTopologyCertified','BRepBoundaryMappingCertified','solid','generalCurvedSolidCertified','globalBinary64EvaluationErrorCertified','manufacturingToleranceCertified','rendererPickingCertified','booleanCertified'])assert.equal(report.quality[key],false);
 for(const key of['toleranceUsed','nativeD0EqualityAuthority','squareRootApproximationUsed','rayUsed','pointProjectionPerformed','snapPerformed','iterativeRefinementPerformed'])assert.equal(report.numericPolicy[key],false);
 assert.equal(report.limits.maximumQueries,16);assert.equal(result.native.options.maximumQueries,16);
 const mutable=refs(result,new Set(),true),inputIntersection=intersections(mutable,refs(input)),reportIntersection=intersections(refs(result.native),refs(result.validationReport));assert.equal(inputIntersection,0);assert.equal(reportIntersection,0);
 for(const previous of admissions){const count=intersections(mutable,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}
 admissions.push({label,result,mutable,inputIntersection,reportIntersection});
}
assert.deepEqual(Object.keys(BaroCadTranslatedStripWorldPointDiagnosticCode).sort(),['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'].sort());assert.equal(pins.reduce((sum,pin)=>sum+pin.bytes,0),1660764);
for(const pin of pins){const bytes=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);originals.set(pin.file,{pin,text,reference:JSON.parse(text)});}
for(const pin of pins.filter(pin=>pin.role==='result')){
 const{text,reference}=originals.get(pin.file),before=structuredClone(reference);
 const parsed=invoke('parse',text,pin.file+':text');checkAdmission(parsed,reference,text,text,pin,pin.file+':text');
 const input=structuredClone(reference),inputBefore=structuredClone(input),copied=invoke('read',input,pin.file+':owned');checkAdmission(copied,reference,input,null,pin,pin.file+':owned');equal(input,inputBefore);
 const written=Buffer.from(signJSON(parsed.native),'utf8');pinBytes(written,pin);writeFileSync(resolve(output,pin.file),written);const coldText=readFileSync(resolve(output,pin.file),'utf8');assert.equal(coldText,text);const cold=invoke('parse',coldText,pin.file+':cold');checkAdmission(cold,reference,coldText,coldText,pin,pin.file+':cold');
 const parsedBefore=structuredClone(parsed),coldBefore=structuredClone(cold),nativeReportBefore=structuredClone(copied.native.report);
 input.proof.source.lowerSourceId+='changed';equal(copied.native,reference);
 copied.native.proof.source.lowerSourceId+='changed';copied.native.queries[0].pointMM[0]+=1;copied.validationReport.quality.solid=true;
 equal(copied.native.report,nativeReportBefore);equal(parsed,parsedBefore);equal(cold,coldBefore);equal(reference,before);
 rows.push({pin,writtenPin:{file:pin.file,bytes:written.length,sha256:createHash('sha256').update(written).digest('hex')},native:parsed.native,validationReport:parsed.validationReport,profile:parsed.profile,sourceText:parsed.sourceText,negativeZeroPaths:zeros(parsed.native),copyMutationIsolated:true});
}
assert.equal(successes,9);assert.equal(pairs.length,36);
const old=originals.get('oldedit_0.point-result.json').reference,fresh=originals.get('newedit_0.point-result.json').reference,zero=originals.get('zeroL_0.point-result.json').reference,oracle=originals.get('zeroL_0.independent-oracle.json').reference;
equal(old.queries[0].pointMM,[10,6.75,1]);equal(fresh.queries[0].pointMM,old.queries[0].pointMM);assert.equal(old.classifications[0].status,'outside');assert.equal(fresh.classifications[0].status,'inside');
equal(zero.classifications,oracle.classifications);equal(zero.report.counts,oracle.counts);equal(zero.report.boundaryRoleCounts,oracle.roles);equal(zero.report.methodCounts,oracle.methods);equal(zero.report.spanQueryCounts,oracle.spans);equal(zero.proof.source,oracle.source);equal(oracle.counts,{inside:1,outside:2,boundary:4});assert.equal(oracle.method,'independent-exact-binary64-fractions-and-sign-of-surd-squares');
let constantWitnesses=0,unrepresentedRoots=0;
for(const proof of zero.proof.queries){equal(proof.classification,zero.classifications.find(row=>row.queryId===proof.queryId));for(const side of['lower','upper']){const witness=proof[side];assert.equal(witness.method,'constant-remainder');equal(witness.L,{numerator:'0',denominator:'1'});assert.equal(witness.LSign,0);const k=BigInt(witness.K.numerator),sign=k===0n?0:k>0n?1:-1;assert.equal(witness.resultSign,sign);constantWitnesses++;}assert.equal(proof.root.method,'quadratic-unique-monotone');if(proof.root.tExact===null){assert.equal(proof.root.nativeUExact,null);unrepresentedRoots++;}}
assert.equal(constantWitnesses,14);assert.equal(unrepresentedRoots,5);assert.equal(zero.report.methodCounts['constant-remainder'],14);assert.equal(old.queries.length+fresh.queries.length+zero.queries.length,9);
const accepted=admissions.at(-1).result,acceptedBefore=structuredClone(accepted),acceptedRefs=refs(accepted),refusals=[];
function errorReceipt(error){const row={name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};if(error?.cause!==undefined)row.cause=error.cause instanceof Error?{name:error.cause.name,code:error.cause.code??null,message:error.cause.message,cause:error.cause.cause??null}:error.cause;return row;}
function refuse(name,entry,input,code,native=false){const previousSuccesses=successes;let error;try{invoke(entry,input,name);}catch(cause){error=cause;}assert.ok(error instanceof BaroCadTranslatedStripWorldPointReadError,name);assert.equal(error.code,code,name);assert.ok(error.message.length<=1024);if(native){assert.ok(error.cause instanceof TranslatedSurfaceStripWorldPointError);assert.equal(error.cause.code,'OWNED');}assert.equal(successes,previousSuccesses);equal(accepted,acceptedBefore);const now=refs(accepted);assert.equal(now.size,acceptedRefs.size);for(const ref of now)assert.ok(acceptedRefs.has(ref));assert.equal(zeros(accepted.native).length,24);refusals.push({name,entry,error:errorReceipt(error),acceptedRetained:true,getterCalls});}
refuse('wrong-text-primitive','parse',0,'INPUT');refuse('wrong-owned-primitive','read',0,'INPUT');
refuse('malformed-json','parse','{','JSON');refuse('decoded-escaped-duplicate','parse','{"volume":{},"\\u0076olume":{}}','JSON');refuse('escaped-lone-surrogate','parse','"\\ud800"','JSON');refuse('nonfinite-json','parse','1e400','JSON');
refuse('raw-utf16-over-family-cap','parse',' '.repeat(limits.utf16Units+1),'BUDGET');refuse('raw-utf8-over-family-cap','parse','é'.repeat(limits.utf8Bytes/2+1),'BUDGET');
// Corrected control: OLD694318 +dense5x80000 reaches1094357; zeroL would not exceed1MiB.
const padded=structuredClone(old);padded.privateQuotaPadding=Array.from({length:5},()=> 'x'.repeat(80000));
const paddedBefore=structuredClone(padded),canonical=Buffer.from(signJSON(padded),'utf8');
assert.equal(canonical.length,1094357);assert.ok(canonical.length>limits.utf8Bytes&&canonical.length<=2097152);assert.ok(signJSON(padded).length>limits.utf16Units&&signJSON(padded).length<=2097152);
refuse('owned-canonical-over-family-cap','read',padded,'BUDGET');equal(padded,paddedBefore);
refusals.at(-1).canonicalControl={donor:'oldedit_0.point-result.json',originalBytes:694318,paddingStrings:5,paddingUnitsPerString:80000,canonicalUtf8Bytes:canonical.length,canonicalUtf16Units:signJSON(padded).length,sharedTransientCap:2097152,familyAcceptedCap:1048576};
const getter=structuredClone(zero);Object.defineProperty(getter,'report',{enumerable:true,get(){getterCalls++;return zero.report;}});refuse('own-getter','read',getter,'OWNED');assert.equal(getterCalls,0);
const cyclic=structuredClone(zero);cyclic.volume=cyclic;refuse('own-cycle','read',cyclic,'OWNED');
const schema=structuredClone(zero);schema.report.schema='unknown';refuse('wrong-native-schema','read',schema,'SCHEMA');const version=structuredClone(zero);version.report.version=1;refuse('wrong-native-version','read',version,'SCHEMA');
const mutations=[
 {name:'classification-status-mismatch',path:'$.classifications[0].status',change:value=>{assert.equal(value.classifications[0].status,'boundary');value.classifications[0].status='inside';}},
 {name:'constant-remainder-sign-mismatch',path:'$.proof.queries[0].lower.resultSign',change:value=>{assert.equal(value.proof.queries[0].lower.resultSign,0);value.proof.queries[0].lower.resultSign=1;}},
 {name:'original-source-coefficient-mismatch',path:'$.proof.source.spans[0].xBernstein[1].numerator',change:value=>{assert.equal(value.proof.source.spans[0].xBernstein[1].numerator,'3');value.proof.source.spans[0].xBernstein[1].numerator='4';}},
 {name:'false-solid-claim',path:'$.report.quality.solid',change:value=>{assert.equal(value.report.quality.solid,false);value.report.quality.solid=true;}},
];
for(const mutation of mutations){const candidate=structuredClone(zero);mutation.change(candidate);const before=structuredClone(candidate);refuse(mutation.name,'read',candidate,'NATIVE',true);equal(candidate,before);refusals.at(-1).mutationPath=mutation.path;}
assert.equal(attempts,26);assert.equal(successes,9);assert.equal(refusals.length,17);assert.equal(getterCalls,0);for(const pin of pins)pinBytes(readFileSync(resolve(directory,pin.file)),pin);
const summary={result:'translated-strip-world-points-public-file-copy-ok',pins,totalOriginalBytes:1660764,rows,counts:{attempts,successes,refusals:17,getterCalls,mutableReferencePairs:pairs.length},publicCalls,mutableReferenceIntersections:pairs,inputAndReportIntersections:admissions.map(item=>({label:item.label,input:item.inputIntersection,report:item.reportIntersection})),refusals,acceptedRetained:true,editPair:{pointMM:old.queries[0].pointMM,oldStatus:old.classifications[0].status,newStatus:fresh.classifications[0].status,totalQueries:9},oracle:{native:oracle,sourceClassificationsReportExact:true,constantWitnesses,unrepresentedRoots,noIrrationalNativeUInvented:true,publicAdmission:false},nativeCallEvidence:'Runtime counts are public reader attempts only. Static source checks record one matching whole validator callsite and family guard ordering, without native execution telemetry.',scope:'Three full native originals/text+owned+private sign-preserving file reopen/9success/17refusals/36mutablepairs/retainedindependentoracle; no constructor/parentbuilder/producerreplay/engine/URL/publicserializer'};
writeFileSync(resolve(output,'summary.json'),signJSON(summary,2));console.log(JSON.stringify({result:summary.result,attempts,successes,refusals:17,mutableReferencePairs:pairs.length,getterCalls}));
`;

const bundle = await build({ absWorkingDir: root, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true,
  stdin: { contents: consumer, resolveDir: resolve(root, 'packages/barocss-cad-interop'), sourcefile: 'translated-strip-world-points-public-consumer.mjs' },
  ...(mode === 'compiled' ? { plugins: [plugin] } : {}),
});
const wrapperSource = await readFile(resolve(packages.get('@barocss/cad-interop').directory, 'src/translated-strip-world-points.ts'), 'utf8');
const nativeCallsiteEvidence = { source: 'packages/barocss-cad-interop/src/translated-strip-world-points.ts', callsites: [...wrapperSource.matchAll(/validateTranslatedSurfaceStripWorldPointClassification\s*\(/g)].length, kind: 'static source callsite count, not runtime telemetry' };
assert.equal(nativeCallsiteEvidence.callsites, 1);
const sourceTree=ts.createSourceFile('translated-strip-world-points.ts',wrapperSource,ts.ScriptTarget.ES2022,true,ts.ScriptKind.TS);
function functionBody(name){const declaration=sourceTree.statements.find(item=>ts.isFunctionDeclaration(item)&&item.name?.text===name);assert.ok(declaration?.body,name+' must exist');return declaration.body.getText(sourceTree);}
function inOrder(body,tokens){let previous=-1;for(const token of tokens){const index=body.indexOf(token);assert.ok(index>previous,'Static guard order: '+token);previous=index;}return true;}
const raw=functionBody('parseFamilyText'),copy=functionBody('copyFamilyData'),admit=functionBody('admit');
const familyGuardEvidence={
 rawBoundsBeforeDecode:inOrder(raw,['text.length > FAMILY_LIMITS.utf16Units','scalarUtf8Bytes(text)','bytes > FAMILY_LIMITS.utf8Bytes','parseQualifiedBodyJson(text)']),
 canonicalCopyGuardBeforeReturn:inOrder(copy,['copyQualifiedBodyOwnData(input)','canonicalUtf8Bytes','canonicalUtf16Units','return copied.value']),
 candidateCopyBeforeSchemaBeforeNative:inOrder(admit,['copyFamilyData(value)','requireNativeSchema(native)','validateTranslatedSurfaceStripWorldPointClassification(native)']),
 reportCopiedWithSameFamilyGuard:admit.includes('copyFamilyData(actualReport)'),acceptedUTF8:1048576,acceptedUTF16:1048576,sharedTransientCopyUTF8:2097152,sharedTransientCopyUTF16:2097152,
 kind:'static source ordering, not runtime allocation/native telemetry',
};
assert.equal(familyGuardEvidence.reportCopiedWithSameFamilyGuard,true);
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
const ownSource = own.filter(path => path.includes('/src/')), ownCompiled = own.filter(path => path.includes('/dist/'));
assert.ok(own.length > 0);assert.equal(mode === 'source' ? ownCompiled.length : ownSource.length, 0);
const runtimeFolder=mode==='source'?'src':'dist',runtimeExtension=mode==='source'?'.ts':'.js';
for(const[suffix,leaf]of[['cad-interop','translated-strip-world-points'],['cad-interop','qualified-body-json'],['cad','translated-surface-strip-world-points']])assert.ok(own.includes(resolve(root,'packages/barocss-'+suffix,runtimeFolder,leaf+runtimeExtension)),'Actual public authority '+suffix+'/'+leaf);
const peers = inputs.filter(path => /(?:node_modules\/.*(?:three|babylon|pixi)|barocss-gpu)/i.test(path));assert.deepEqual(peers, []);
await writeFile(resolve(output, 'consumer-source.mjs'), consumer);
await writeFile(resolve(output, 'consumer.bundle.mjs'), bundle.outputFiles[0].text);
await writeFile(resolve(output, 'consumer-metafile.json'), JSON.stringify(bundle.metafile, null, 2));
await writeFile(resolve(output, 'graphs.json'), JSON.stringify({ mode, node: process.version, ownSource:ownSource.map(path=>relative(root,path)),ownCompiled:ownCompiled.map(path=>relative(root,path)),ownSourceCount:ownSource.length,ownCompiledCount:ownCompiled.length,enginePeers:peers,resolutions,nativeCallsiteEvidence,familyGuardEvidence }, null, 2));
const run = spawnSync(process.execPath, ['--input-type=module'], { cwd: root, input: bundle.outputFiles[0].text, encoding: 'utf8', timeout:30000, maxBuffer:16*1024*1024, env:{...process.env,LOADER1333_EVIDENCE:output} });
await writeFile(resolve(output,'consumer.stdout'),run.stdout??'');await writeFile(resolve(output,'consumer.stderr'),run.stderr??'');
await writeFile(resolve(output,'consumer.exit'),String(run.status));
await writeFile(resolve(output,'consumer.result.json'),JSON.stringify({status:run.status,signal:run.signal,error:run.error?{name:run.error.name,code:run.error.code??null,message:run.error.message,stack:run.error.stack??null}:null,timeoutMs:30000},null,2));
process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');assert.equal(run.status,0,'Actual public World XYZ classification consumer failed');

if(mode==='compiled') {
  const interop=packages.get('@barocss/cad-interop'),development=interop.manifest.exports,publishedMap=interop.manifest.publishConfig.exports;
  const baselineRun=spawnSync('git',['show','4ccbb8101024a485158b13a3430db37b07d75aab:packages/barocss-cad-interop/package.json'],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(baselineRun.status,0);
  const baseline=JSON.parse(baselineRun.stdout);assert.equal(Object.keys(baseline.exports).length,36);
  assert.deepEqual(Object.keys(development).sort(),[...Object.keys(baseline.exports),'./translated-strip-world-points'].sort());
  assert.deepEqual(Object.keys(development).sort(),Object.keys(publishedMap).sort());
  for(const key of Object.keys(baseline.exports)){assert.deepEqual(development[key],baseline.exports[key]);assert.deepEqual(publishedMap[key],baseline.publishConfig.exports[key]);}
  assert.deepEqual(development['./translated-strip-world-points'],{types:'./src/translated-strip-world-points.ts',import:'./src/translated-strip-world-points.ts'});
  assert.deepEqual(publishedMap['./translated-strip-world-points'],{types:'./dist/translated-strip-world-points.d.ts',import:'./dist/translated-strip-world-points.js'});
  for(const entry of Object.values(publishedMap)){await access(resolve(interop.directory,entry.import));await access(resolve(interop.directory,entry.types));}
  const typeSource=await readFile(resolve(examples,'translated-strip-world-points-native-contract.ts'),'utf8');
  const virtual=resolve(interop.directory,'examples/translated-strip-world-points-private-published-type-consumer.mts');
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
  assert.ok(ownDeclarations.some(path=>path.endsWith('/translated-strip-world-points.d.ts')));assert.ok(ownDeclarations.some(path=>path.endsWith('/translated-surface-strip-world-points.d.ts')));
}
console.log(JSON.stringify({mode,publicRuntime:mode==='source'?'ordinary source':'actual emitted JS',types:mode==='compiled'?'actual emitted strict selected declarations':'unrun'}));
