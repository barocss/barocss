import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { access, mkdir, readFile, writeFile, statfs } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root=process.cwd(),prefix='packages/barocss-cad-interop/',examples=resolve(root,prefix,'examples');
const parent='d9a4a6203b5c9f4f2114b7fb329a1a024083551a';
function argument(name){const index=process.argv.indexOf(name);assert.ok(index>=2&&process.argv[index+1],name+' required');return process.argv[index+1];}
const mode=argument('--mode'),requested=argument('--output');
assert.ok(['source','compiled'].includes(mode));assert.ok(isAbsolute(requested),'Absolute fresh output required');
assert.ok(Number(process.versions.node.split('.')[0])>=22,'Node22 required');
const output=resolve(requested);let exists=false;
try{await access(output);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
assert.equal(exists,false,'Keep each FIRST capture in a new output directory');await mkdir(output,{recursive:true});
const disk=await statfs(output),availableOutputBytes=disk.bavail*disk.bsize;assert.ok(availableOutputBytes>=128*1024*1024,'128 MiB operational output reserve required');
await writeFile(resolve(output,'output-space.json'),JSON.stringify({availableOutputBytes,minimumReserveBytes:128*1024*1024},null,2)+'\n');
await writeFile(resolve(output,'command.json'),JSON.stringify({argv:process.argv,cwd:root,node:process.version,mode,parent},null,2)+'\n');
const packages=new Map();
for(const suffix of ['cad','cad-interop']){
 const directory=resolve(root,'packages/barocss-'+suffix),manifest=JSON.parse(await readFile(resolve(directory,'package.json'),'utf8'));packages.set('@barocss/'+suffix,{directory,manifest});
 if(mode==='source'){let present=false;try{await access(resolve(directory,'dist'));present=true;}catch(error){if(error.code!=='ENOENT')throw error;}assert.equal(present,false,'FIRST source flow must precede own builds');}
}
const interop=packages.get('@barocss/cad-interop');
const baselineRun=spawnSync('git',['show',parent+':'+prefix+'package.json'],{cwd:root,encoding:'utf8',timeout:30000});
assert.equal(baselineRun.status,0,'Actual immutable parent manifest required');const baseline=JSON.parse(baselineRun.stdout),expected=structuredClone(baseline);
assert.equal(Object.keys(baseline.exports).length,38);assert.equal(Object.keys(baseline.publishConfig.exports).length,38);
expected.exports['./translated-strip-interval-boolean']={types:'./src/translated-strip-interval-boolean.ts',import:'./src/translated-strip-interval-boolean.ts'};
expected.publishConfig.exports['./translated-strip-interval-boolean']={types:'./dist/translated-strip-interval-boolean.d.ts',import:'./dist/translated-strip-interval-boolean.js'};
assert.deepEqual(interop.manifest,expected);assert.equal(Object.keys(interop.manifest.exports).length,39);
const codecPath=resolve(interop.directory,'src/qualified-body-json.ts'),codecHash=createHash('sha256').update(await readFile(codecPath)).digest('hex');
assert.equal(codecHash,'451ea4d17c7afce5adf9f5f81c33de3f96eafca297631cac2f73afd437ff1683');
function published(specifier,field){
 const name=specifier.split('/').slice(0,2).join('/'),item=packages.get(name),suffix=specifier.slice(name.length),key=suffix?'.'+suffix:'.';
 const target=item?.manifest.publishConfig?.exports?.[key]?.[field];assert.ok(target?.startsWith('./dist/'),'Actual published '+field+' entry required: '+specifier);return resolve(item.directory,target);
}
const resolutions=[];
const plugin={name:'actual-published-translated-strip-interval-boolean',setup(builder){builder.onResolve({filter:/^@barocss\/(cad|cad-interop)(\/|$)/},args=>{const path=published(args.path,'import');resolutions.push({specifier:args.path,importer:relative(root,args.importer),target:relative(root,path)});return{path};});}};

const consumer=String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseBaroCadTranslatedStripIntervalBoolean as parse,readBaroCadTranslatedStripIntervalBoolean as read,BaroCadTranslatedStripIntervalBooleanReadError,BaroCadTranslatedStripIntervalBooleanDiagnosticCode} from '@barocss/cad-interop/translated-strip-interval-boolean';
import {TranslatedStripIntervalBooleanError} from '@barocss/cad';
const output=process.env.LOADER1345_PRODUCT_OUTPUT,directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples/translated-strip-interval-boolean-native-data');
const pins=[
 {file:'disjoint-union.full-result.json',bytes:7983259,sha256:'1cde6cc3220033b809bdf36fc5ba1772734d126c4a3efd55723f0a3107001ba1'},
 {file:'disjoint-union.independent-interval-volume-oracle.json',bytes:4899,sha256:'9bf069df025b921dec0c4bea6a8eb440057ff27a6d7242202d3e64e0126308db'},
 {file:'partial-intersection.full-result.json',bytes:5981493,sha256:'80dcf7358d30e8cd22e9f976cab9c3fb3ae7948ba6105b7fd1da2a1415af5173'},
 {file:'partial-intersection.independent-interval-volume-oracle.json',bytes:3839,sha256:'e346fc105e211fa4e55d6804c1104d406ccc6b2390b0ce0cdfb28d7b33c7f571'},
 {file:'equal-independent-sources-difference.full-result.json',bytes:3982395,sha256:'239a90733fdb9e55865ffb7246ea7f899c5bc3c1a2afbf39a32b7abe6ae8d607'},
 {file:'equal-independent-sources-difference.independent-interval-volume-oracle.json',bytes:1514,sha256:'3e5050fd4acbace3ed5bb30a07e9ecd8bd803c383e44213650133bb46393165d'},
];
const keys=['disjoint-union','partial-intersection','equal-independent-sources-difference'];
const limits={utf8Bytes:12582912,utf16Units:12582912,values:4194304,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128};
const profile={schema:'barocss-translated-strip-interval-boolean-ingestion',version:0,nativeSchema:'barocss-translated-strip-interval-boolean',nativeVersion:0,sourceFrame:'authored-xyz-no-axis-conversion',lengthUnit:'mm',volumeUnit:'mm3',uvLengthUnit:'dimensionless',ownership:'independent-copied-cpu-data-gc',limits,capabilities:{nativeIntervalBoolean:true,copiedWholeReceipt:true,renderer:false,url:false,byteInput:false,publicSerializer:false,dispose:false,genericBoolean:false,arbitraryCurvedSolid:false,globalC1:false,globalBinary64:false,manufacturing:false,publication:false}};
const fields=['a','b','options','proof','outputs','total','report'];
const originals=new Map(),admissions=[],pairs=[],rows=[],publicCalls=[],refusals=[],telemetry=[];
let attempts=0,successes=0,nativeRefusals=0,getterCalls=0,lastAttempt=null;
const started=performance.now();
function same(a,b,path='$'){
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Whole value/sign mismatch at '+path);return;}
 assert.equal(Array.isArray(a),Array.isArray(b),path);assert.deepEqual(Object.keys(a),Object.keys(b),path+' fields/order');for(const key of Object.keys(a))same(a[key],b[key],path+'.'+key);
}
function refs(value,set=new Set(),mutableOnly=false){if(value&&typeof value==='object'&&!set.has(value)&&(!mutableOnly||!Object.isFrozen(value))){set.add(value);for(const item of Object.values(value))refs(item,set,mutableOnly);}return set;}
function intersect(a,b){let count=0;for(const value of a)if(b.has(value))count++;return count;}
function zeros(value,path='$',result=[]){if(typeof value==='number'&&Object.is(value,-0))result.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))zeros(item,path+'.'+key,result);return result;}
function frozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert.ok(Object.isFrozen(value),'Profile must be deeply frozen');for(const item of Object.values(value))frozen(item,seen);}
function signed(value,space){return JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+'\n';}
function save(file,value){writeFileSync(resolve(output,file),signed(value,2),{flag:'wx'});}
function memory(){const value=process.memoryUsage();return{rss:value.rss,heapUsed:value.heapUsed,heapTotal:value.heapTotal,external:value.external};}
function pinBytes(bytes,pin){assert.equal(bytes.length,pin.bytes,pin.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,pin.file);}
function errorReceipt(error,depth=0){const result={name:error?.name??null,code:error?.code??null,path:error?.path??null,message:error?.message??String(error)};if(error?.cause!==undefined)result.cause=error.cause instanceof Error&&depth<16?errorReceipt(error.cause,depth+1):error.cause;return result;}
function invoke(entry,input,label){
 attempts++;const call={index:attempts,entry,label,outcome:'pending'};publicCalls.push(call);const before=memory(),start=performance.now();lastAttempt={label,entry};
 try{const result=entry==='parse'?parse(input):read(input);successes++;call.outcome='accepted';return result;}
 catch(error){call.outcome='refused';call.error=errorReceipt(error);throw error;}
 finally{telemetry.push({index:attempts,label,elapsedMilliseconds:performance.now()-start,memoryBefore:before,memoryAfter:memory()});}
}
function bodyFacts(body){assert.equal(Object.keys(body).length,13);same(body.models.map(item=>item.model.objects.length),[16,2]);assert.equal(body.vertices.length,8);assert.equal(body.edges.length,12);assert.equal(body.faces.length,6);return{fieldCount:13,modelObjectCounts:[16,2],vertices:8,edges:12,faces:6};}
function nativeFacts(native,key){
 assert.deepEqual(Object.keys(native),fields);assert.equal(native.report.schema,'barocss-translated-strip-interval-boolean');assert.equal(native.report.version,0);
 const expected={'disjoint-union':[2,3,320,'1040'],'partial-intersection':[1,3,240,'260'],'equal-independent-sources-difference':[0,1,160,'0']}[key];
 assert.equal(native.outputs.length,expected[0]);assert.equal(native.proof.plan.slabs.length,expected[1]);assert.equal(native.report.outputBodyCount,expected[0]);assert.equal(native.report.slabCount,expected[1]);assert.equal(native.report.empty,expected[0]===0);assert.equal(zeros(native).length,expected[2]);
 same(native.total.exactVolumeMM3,{numerator:expected[3],denominator:'1'});same(native.report.exactVolumeMM3,native.total.exactVolumeMM3);
 const operands=[bodyFacts(native.a),bodyFacts(native.b)],outputs=native.outputs.map(item=>{assert.deepEqual(Object.keys(item),['index','interval','lower','upper','recipe','body']);return bodyFacts(item.body);});
 for(const name of ['restrictedIntervalBooleanCertified','regularizedMaterialCertified','actualOutputBodiesQualified','fullOperandsRetained','parentFlagsUnchanged','originalEndpointBitsPreserved'])assert.equal(native.report.quality[name],true);
 for(const name of ['genericBoolean','arbitraryCurvedSolidCertified','globalC1','globalBinary64EvaluationErrorCertified','manufacturingToleranceCertified','publication'])assert.equal(native.report.quality[name],false);
 assert.equal(native.report.lengthUnit,'mm');assert.equal(native.report.volumeUnit,'mm3');return{outputs:expected[0],slabs:expected[1],negativeZeroCount:expected[2],operands,outputBodies:outputs,emptySuccessfulRole:expected[0]===0};
}
function oracleFacts(native,oracle){
 assert.deepEqual(Object.keys(oracle),['endpointGroups','slabs','intervals','commonAreaMM2','checks','accounting']);same(oracle.endpointGroups,native.proof.plan.endpointGroups);same(oracle.slabs,native.proof.plan.slabs);same(oracle.intervals,native.proof.plan.outputs);same(oracle.checks,native.proof.outputVolumeChecks);same(oracle.accounting,native.proof.volumeAccounting);same(oracle.commonAreaMM2,['130','1']);same(native.proof.commonMap.areaFactorMM2,{numerator:oracle.commonAreaMM2[0],denominator:oracle.commonAreaMM2[1]});same(oracle.accounting.actualResultExactVolumeMM3,native.total.exactVolumeMM3);return{wholeOracleRetained:true,wholeOutputPlansEqual:true,exactAccountingEqual:true,newOracleMath:false};
}
function checkAdmission(result,reference,input,text,key,label,entry){
 assert.deepEqual(Object.keys(result),['native','validationReport','profile','sourceText']);same(result.native,reference);same(result.validationReport,reference.report);same(result.profile,profile);frozen(result.profile);assert.equal(result.sourceText,text);assert.ok(!Object.isFrozen(result.native)&&!Object.isFrozen(result.validationReport));
 const inputRefs=refs(input),nativeRefs=refs(result.native),reportRefs=refs(result.validationReport);assert.equal(intersect(nativeRefs,inputRefs),0);assert.equal(intersect(reportRefs,inputRefs),0);assert.equal(intersect(nativeRefs,reportRefs),0);
 const mutable=refs(result,new Set(),true);for(const previous of admissions){const count=intersect(mutable,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}
 const negativeZeroPaths=zeros(result.native);same(negativeZeroPaths,zeros(reference));
 admissions.push({label,key,entry,result,mutable,refs:refs(result),negativeZeroPaths,sourceTextRole:text===null?'owned-null':'exact-literal'});lastAttempt=null;
}
function retained(){
 for(const item of admissions){const original=originals.get(item.key+'.full-result.json');same(item.result.native,original.reference);same(item.result.validationReport,original.reference.report);same(item.result.profile,profile);frozen(item.result.profile);assert.equal(item.result.sourceText,item.sourceTextRole==='owned-null'?null:original.text);same(zeros(item.result.native),item.negativeZeroPaths);const now=refs(item.result);assert.equal(now.size,item.refs.size);for(const ref of now)assert.ok(item.refs.has(ref));}
 for(const pin of pins)pinBytes(readFileSync(resolve(directory,pin.file)),pin);
 for(const row of rows)pinBytes(readFileSync(resolve(output,row.savedPin.file)),row.savedPin);
}
const nativeErrors=[
 {name:'TranslatedStripIntervalBooleanError',code:'OWNED',path:null,message:'Translated-strip interval Boolean: Whole interval Boolean reconstruction refused',cause:{name:'TranslatedStripIntervalBooleanError',code:'PARENT',path:null,message:'Translated-strip interval Boolean: Complete actual operand Body validation refused',cause:{name:'QualifiedTranslatedStripBodyError',code:'OWNED',path:null,message:'Qualified translated-strip Body: Owned parents/source models/global topology/local-global refs/material/native values/counters/claims changed'}}},
 ...Array(3).fill({name:'TranslatedStripIntervalBooleanError',code:'OWNED',path:null,message:'Translated-strip interval Boolean: Owned full operands/common map/donors/slabs/recipes/actual Bodies/sources/proofs/volumes/IDs/counters/sizes changed'}),
];
try{
 assert.deepEqual(Object.keys(BaroCadTranslatedStripIntervalBooleanDiagnosticCode).sort(),['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'].sort());assert.equal(pins.reduce((sum,pin)=>sum+pin.bytes,0),17957399);
 for(const pin of pins){const bytes=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);originals.set(pin.file,{pin,text,reference:JSON.parse(text)});}
 for(const key of keys){
  const{pin,text,reference}=originals.get(key+'.full-result.json'),oracleRecord=originals.get(key+'.independent-interval-volume-oracle.json'),oracle=oracleRecord.reference,oracleBefore=structuredClone(oracle);
  const parsed=invoke('parse',text,key+':text');checkAdmission(parsed,reference,text,text,key,key+':text','parse');
  const input=structuredClone(reference),inputBefore=structuredClone(input),owned=invoke('read',input,key+':owned');checkAdmission(owned,reference,input,null,key,key+':owned','read');same(input,inputBefore);
  const bytes=Buffer.from(signed(parsed.native),'utf8');pinBytes(bytes,pin);writeFileSync(resolve(output,pin.file),bytes,{flag:'wx'});const coldText=readFileSync(resolve(output,pin.file),'utf8');assert.equal(coldText,text);
  const cold=invoke('parse',coldText,key+':cold');checkAdmission(cold,reference,coldText,coldText,key,key+':cold','parse');
  input.report.quality.genericBoolean=true;same(owned.native,reference);same(owned.validationReport,reference.report);
  owned.validationReport.quality.genericBoolean=true;same(owned.native,reference);same(parsed.native,reference);same(parsed.validationReport,reference.report);same(cold.native,reference);same(cold.validationReport,reference.report);owned.validationReport.quality.genericBoolean=false;
  owned.native.report.quality.genericBoolean=true;same(owned.validationReport,reference.report);same(parsed.native,reference);same(cold.native,reference);owned.native.report.quality.genericBoolean=false;
  same(owned.native,reference);same(owned.validationReport,reference.report);same(oracle,oracleBefore);
  rows.push({key,native:parsed.native,validationReport:parsed.validationReport,profile:parsed.profile,sourceText:parsed.sourceText,oracle,pin,oraclePin:oracleRecord.pin,savedPin:{...pin},negativeZeroPaths:zeros(parsed.native),nativeFacts:nativeFacts(parsed.native,key),oracleEvidence:oracleFacts(parsed.native,oracle),callerMutationIsolated:true});
  console.log(JSON.stringify({accepted:key,outputs:parsed.native.outputs.length,slabs:parsed.native.proof.plan.slabs.length}));
 }
 assert.equal(successes,9);assert.equal(pairs.length,36);retained();
 function refuse(name,entry,input,code,{nativeIndex=null,codecMessage=null}={}){
  let error;const before=successes;try{invoke(entry,input,name);}catch(cause){error=cause;}
  const receipt={name,entry,error:error?errorReceipt(error):null,eligibleWholeValidator:nativeIndex!==null,getterCalls,acceptedRetained:false};refusals.push(receipt);save('refusal-'+String(refusals.length).padStart(2,'0')+'.json',receipt);
  assert.ok(error instanceof BaroCadTranslatedStripIntervalBooleanReadError,'Unexpected public acceptance/error; preserve FIRST and stop');assert.equal(error.code,code,name);assert.ok(error.message.length<=1024);assert.equal(successes,before);assert.equal(getterCalls,0);
  if(nativeIndex!==null){assert.ok(error.cause instanceof TranslatedStripIntervalBooleanError);same(errorReceipt(error.cause),nativeErrors[nativeIndex]);nativeRefusals++;}
  else if(['JSON','OWNED','BUDGET'].includes(code)){assert.ok(error.cause instanceof BaroCadTranslatedStripIntervalBooleanReadError,'Exact dedicated codec error cause required');assert.equal(error.cause.code,code);if(codecMessage)assert.equal(error.cause.message,codecMessage);}
  else assert.equal(error.cause,undefined);
  retained();receipt.acceptedRetained=true;lastAttempt=null;console.log(JSON.stringify({refused:name,code:error.code}));
 }
 refuse('parse-wrong-kind','parse',0,'INPUT');refuse('read-wrong-kind','read',0,'INPUT');refuse('malformed-json','parse','{','JSON');refuse('escaped-lone-surrogate','parse','"\\ud800"','JSON');refuse('nonfinite-number','parse','1e400','JSON');refuse('wrong-root-shape','read',{unexpected:0},'SCHEMA');
 const union=originals.get('disjoint-union.full-result.json').reference;
 const schema=structuredClone(union);schema.report.schema='unknown';refuse('wrong-report-schema','read',schema,'SCHEMA');const version=structuredClone(union);version.report.version=1;refuse('wrong-report-version','read',version,'SCHEMA');
 refuse('raw-utf16-over-cap','parse',' '.repeat(12582913),'BUDGET',{codecMessage:'Raw JSON UTF16 code-unit budget exceeded'});refuse('raw-utf8-over-cap','parse','é'.repeat(6291457),'BUDGET',{codecMessage:'Raw JSON UTF8 byte budget exceeded'});refuse('decoded-duplicate-key','parse','{"x":1,"\\u0078":2}','JSON',{codecMessage:'Duplicate decoded JSON key'});
 const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){getterCalls++;return 1;}});refuse('small-enumerable-getter','read',getter,'OWNED',{codecMessage:'Getter or hidden own data refused'});
 const cycle={};cycle.self=cycle;refuse('small-ancestor-cycle','read',cycle,'OWNED',{codecMessage:'Own ancestor cycle refused'});
 refuse('per-occurrence-work-envelope','read',{padding:Array(8192).fill(Array(512).fill(0))},'BUDGET',{codecMessage:'Owned occurrence/depth budget exceeded'});
 refuse('canonical-byte-envelope','read',{padding:Array(49).fill('x'.repeat(262144))},'BUDGET',{codecMessage:'Owned canonical JSON plus newline budget exceeded'});
 const mutations=[
  {name:'operand-source-binding',path:'$.a.models[0].source',change(value){assert.equal(typeof value.a.models[0].source,'string');value.a.models[0].source+=' ';}},
  {name:'selected-slab',path:'$.proof.plan.slabs[0].selected',change(value){assert.equal(value.proof.plan.slabs[0].selected,true);value.proof.plan.slabs[0].selected=false;}},
  {name:'output-body-source-binding',path:'$.outputs[0].body.models[0].source',change(value){assert.equal(value.outputs.length,2);value.outputs[0].body.models[0].source+=' ';}},
  {name:'false-generic-certificate',path:'$.report.quality.genericBoolean',change(value){assert.equal(value.report.quality.genericBoolean,false);value.report.quality.genericBoolean=true;}},
 ];
 for(const[index,mutation]of mutations.entries()){const candidate=structuredClone(union);mutation.change(candidate);const before=structuredClone(candidate);refuse(mutation.name,'read',candidate,'NATIVE',{nativeIndex:index});same(candidate,before);}
 assert.equal(attempts,28);assert.equal(successes,9);assert.equal(refusals.length,19);assert.equal(nativeRefusals,4);assert.equal(successes+nativeRefusals,13);assert.equal(getterCalls,0);retained();
 const summary={result:'translated-strip-interval-boolean-public-file-copy-ok',pins,totalOriginalBytes:17957399,rows,admissionEvidence:admissions.map(({label,key,entry,sourceTextRole,negativeZeroPaths})=>({label,key,entry,sourceTextRole,negativeZeroPaths,wholeNativeReportProfileTextCompared:true,inputAndReportIndependent:true})),counts:{publicAttempts:attempts,successes,refusals:19,getterCalls,mutableReferencePairs:pairs.length,nativeRefusalOutcomes:nativeRefusals,eligibleWholeValidatorAttempts:successes+nativeRefusals},publicCalls,mutableReferenceIntersections:pairs,refusals,acceptedRetained:true,nativeCallEvidence:'Public outcome ledger and static one matching whole-validator callsite. Thirteen is eligible-attempt arithmetic, not dynamic kernel telemetry. No direct consumer builder/evaluator calls; native internal reconstruction remains real.',scope:'Nine complete admissions, nineteen frozen public refusals including quota RECORD envelopes, three exact signed native cold files and full independent oracle comparison data. One complete native/report/profile/sourceText per case; all nine full results compared directly without repeated dumps. No renderer or generic certificate.'};
 save('summary.json',summary);save('telemetry.json',{elapsedMilliseconds:performance.now()-started,memory:memory(),publicCalls:telemetry,scope:'Operational public-call elapsed/RSS, separate from normative native evidence; no performance guarantee'});console.log(JSON.stringify({result:summary.result,...summary.counts}));
}catch(error){save('first-failure.json',{error:errorReceipt(error),stack:error.stack??null,attempts,successes,nativeRefusals,getterCalls,lastAttempt,publicCalls,rows,refusals});save('telemetry.json',{elapsedMilliseconds:performance.now()-started,memory:memory(),publicCalls:telemetry});throw error;}

`;

const virtualEntry=resolve(examples,'translated-strip-interval-boolean-private-consumer.mjs');
const bundled=await build({absWorkingDir:root,bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true,stdin:{contents:consumer,resolveDir:examples,sourcefile:virtualEntry},...(mode==='compiled'?{plugins:[plugin]}:{})});
const inputs=Object.keys(bundled.metafile.inputs).map(path=>resolve(root,path));
const otherExamples=inputs.filter(path=>(path.startsWith(resolve(root,'examples')+'/')||[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'examples')+'/')))&&path!==virtualEntry);assert.deepEqual(otherExamples,[],'Only exact own absolute virtual consumer; no old example imports');
const own=inputs.filter(path=>[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'src')+'/')||path.startsWith(resolve(item.directory,'dist')+'/'))),ownSource=own.filter(path=>path.includes('/src/')),ownCompiled=own.filter(path=>path.includes('/dist/'));
assert.ok(own.length>0);assert.equal(mode==='source'?ownCompiled.length:ownSource.length,0);
const folder=mode==='source'?'src':'dist',extension=mode==='source'?'.ts':'.js';
for(const[suffix,leaf]of [['cad-interop','translated-strip-interval-boolean'],['cad-interop','translated-strip-interval-boolean-json'],['cad','translated-strip-interval-boolean']])assert.ok(own.includes(resolve(root,'packages/barocss-'+suffix,folder,leaf+extension)),'Actual public authority in graph: '+suffix+'/'+leaf);
const peers=inputs.filter(path=>path.includes('/node_modules/')||path.includes('/barocss-gpu/'));assert.deepEqual(peers,[],'Renderer-free public closure requires zero runtime peers');
const wrapperSource=await readFile(resolve(interop.directory,'src/translated-strip-interval-boolean.ts'),'utf8');
const callsites=[...wrapperSource.matchAll(/validateTranslatedStripIntervalBoolean\s*\(/g)].map(match=>({offset:match.index,line:wrapperSource.slice(0,match.index).split('\n').length}));assert.equal(callsites.length,1);
const guardOffset=wrapperSource.indexOf('requireNativeSchema(native)');assert.ok(guardOffset>=0);
const nativeCallsiteEvidence={callsites,kind:'Static matching-validator callsite and guard ordering only; no instrumented runtime kernel counter',schemaGuardOffset:guardOffset,schemaGuardBeforeCall:guardOffset<callsites[0].offset};assert.equal(nativeCallsiteEvidence.schemaGuardBeforeCall,true);
await writeFile(resolve(output,'consumer-source.mjs'),consumer);await writeFile(resolve(output,'consumer.bundle.mjs'),bundled.outputFiles[0].text);await writeFile(resolve(output,'consumer-metafile.json'),JSON.stringify(bundled.metafile,null,2));
await writeFile(resolve(output,'graphs.json'),JSON.stringify({mode,node:process.version,parent,ownSource:ownSource.map(path=>relative(root,path)),ownCompiled:ownCompiled.map(path=>relative(root,path)),ownSourceCount:ownSource.length,ownCompiledCount:ownCompiled.length,peers,resolutions,nativeCallsiteEvidence,virtualEntry:relative(root,virtualEntry),otherExamples,codecHash,baselineMaps:38,currentMaps:39},null,2));
const executed=spawnSync(process.execPath,['--max-old-space-size=4096','--input-type=module'],{cwd:root,input:bundled.outputFiles[0].text,encoding:'utf8',timeout:240000,maxBuffer:4*1024*1024,env:{...process.env,LOADER1345_PRODUCT_OUTPUT:output}});
await writeFile(resolve(output,'consumer.stdout'),executed.stdout??'');await writeFile(resolve(output,'consumer.stderr'),executed.stderr??'');await writeFile(resolve(output,'consumer.exit'),String(executed.status)+'\n');
await writeFile(resolve(output,'consumer.result.json'),JSON.stringify({status:executed.status,signal:executed.signal,error:executed.error?{name:executed.error.name,code:executed.error.code??null,message:executed.error.message}:null,timeoutMilliseconds:240000,heapMB:4096},null,2));process.stdout.write(executed.stdout??'');process.stderr.write(executed.stderr??'');assert.equal(executed.status,0,'FIRST public interval Boolean file flow failed');

if(mode==='compiled'){
 for(const entry of Object.values(interop.manifest.publishConfig.exports)){await access(resolve(interop.directory,entry.import));await access(resolve(interop.directory,entry.types));}
 const typeSource=await readFile(resolve(examples,'translated-strip-interval-boolean-native-contract.ts'),'utf8'),virtualType=resolve(examples,'translated-strip-interval-boolean-private-published-contract.mts');
 const compilerOptions={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,skipLibCheck:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']};
 const host=ts.createCompilerHost(compilerOptions),get=host.getSourceFile.bind(host),fileExists=host.fileExists.bind(host),readOriginal=host.readFile.bind(host),typeResolutions=[];
 host.getSourceFile=(path,version,onError,newFile)=>resolve(path)===virtualType?ts.createSourceFile(virtualType,typeSource,version,true,ts.ScriptKind.TS):get(path,version,onError,newFile);
 host.fileExists=path=>resolve(path)===virtualType||fileExists(path);host.readFile=path=>resolve(path)===virtualType?typeSource:readOriginal(path);
 host.resolveModuleNames=(names,containingFile)=>names.map(name=>{if(/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)){const path=published(name,'types');typeResolutions.push({name,importer:relative(root,containingFile),target:relative(root,path)});return{resolvedFileName:path,extension:ts.Extension.Dts,isExternalLibraryImport:true};}return ts.resolveModuleName(name,containingFile,compilerOptions,host).resolvedModule;});
 const program=ts.createProgram([virtualType],compilerOptions,host),diagnostics=ts.getPreEmitDiagnostics(program).map(item=>({code:item.code,message:ts.flattenDiagnosticMessageText(item.messageText,'\n'),file:item.file?relative(root,item.file.fileName):null}));
 const ownDeclarations=program.getSourceFiles().map(file=>resolve(file.fileName)).filter(path=>[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'src')+'/')||path.startsWith(resolve(item.directory,'dist')+'/'))),sourceFallbacks=ownDeclarations.filter(path=>path.includes('/src/'));
 await writeFile(resolve(output,'published-types.json'),JSON.stringify({compiler:ts.version,strict:true,noEmit:true,skipLibCheck:true,diagnostics,sourceFallbacks,ownDeclarations:ownDeclarations.map(path=>relative(root,path)),typeResolutions,baselineMaps:38,currentMaps:39},null,2));assert.deepEqual(diagnostics,[]);assert.deepEqual(sourceFallbacks,[]);
 for(const[suffix,leaf]of [['cad-interop','translated-strip-interval-boolean'],['cad','translated-strip-interval-boolean']])assert.ok(ownDeclarations.includes(resolve(root,'packages/barocss-'+suffix,'dist',leaf+'.d.ts')),'Actual published selected declarations required');
}
console.log(JSON.stringify({mode,runtime:mode==='source'?'ordinary public source':'actual published emitted JS',types:mode==='compiled'?'strict selected emitted declarations':'unrun'}));
