import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
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
expected.exports['./source-curve-knot-insertion']={types:'./src/nurbs/source-wide/source-curve-knot-insertion.ts',import:'./src/nurbs/source-wide/source-curve-knot-insertion.ts'};
expected.publishConfig.exports['./source-curve-knot-insertion']={types:'./dist/nurbs/source-wide/source-curve-knot-insertion.d.ts',import:'./dist/nurbs/source-wide/source-curve-knot-insertion.js'};
assert.deepEqual(interop.manifest,expected);assert.equal(Object.keys(interop.manifest.exports).length,39);
const codecPath=resolve(interop.directory,'src/qualified-body-json.ts'),codecHash=createHash('sha256').update(await readFile(codecPath)).digest('hex');
assert.equal(codecHash,'451ea4d17c7afce5adf9f5f81c33de3f96eafca297631cac2f73afd437ff1683');
function published(specifier,field){
 const name=specifier.split('/').slice(0,2).join('/'),item=packages.get(name),suffix=specifier.slice(name.length),key=suffix?'.'+suffix:'.';
 const target=item?.manifest.publishConfig?.exports?.[key]?.[field];assert.ok(target?.startsWith('./dist/'),'Actual published '+field+' entry required: '+specifier);return resolve(item.directory,target);
}
const resolutions=[];
const plugin={name:'actual-published-source-curve-knot-insertion',setup(builder){builder.onResolve({filter:/^@barocss\/(cad|cad-interop)(\/|$)/},args=>{const path=published(args.path,'import');resolutions.push({specifier:args.path,importer:relative(root,args.importer),target:relative(root,path)});return{path};});}};

const consumer=String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseBaroCadSourceCurveKnotInsertion as parse,readBaroCadSourceCurveKnotInsertion as read,BaroCadSourceCurveKnotInsertionReadError,BaroCadSourceCurveKnotInsertionDiagnosticCode} from '@barocss/cad-interop/source-curve-knot-insertion';
import {SourceCurveKnotInsertionError} from '@barocss/cad';
const output=process.env.LOADER1362_PRODUCT_OUTPUT,directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples/source-curve-knot-insertion-native-data');
const pins=[
 {file:'main.result.json',bytes:15053,sha256:'3a57ad95493787359b449d1f238678729738fdcf105ec5e45863afb3f3420931'},
 {file:'main.independent-math-oracle.json',bytes:29914,sha256:'69c54eaae68744b53603aa738c1c87730986257805573ed65acf3a7db8a389f7'},
 {file:'quartic.result.json',bytes:10710,sha256:'70f3cbb79b2eec332f5429627fc3c995bf1b0bf822e74f06eefc9fe46a101eb4'},
 {file:'quartic.independent-math-oracle.json',bytes:10189,sha256:'870cbd9f60db496f0e7dec6335fdddfd94f0e135b2c4183bda34891de8dac7cc'},
 {file:'c0.result.json',bytes:11381,sha256:'8c5f3880a5754bade66e42c55c43eedffcecf5c84b896a971ad880ac28af5256'},
 {file:'c0.independent-math-oracle.json',bytes:9961,sha256:'18d6a9b14a7b807d79b6622a7ad0dfc3d20a79841bc49778278ee6fb93fa0555'},
 {file:'capacity.result.json',bytes:70643,sha256:'918142d080497fc95949e0199fd4f7f92036df1107e4fa933e0b91d0c78a5566'},
 {file:'capacity.independent-math-oracle.json',bytes:101320,sha256:'40aeb35466e2e7800324b4bdc40d42c2aaad4b67a263cd8cef39c8b0d2717188'},
];
const limits={utf8Bytes:2097152,utf16Units:2097152,values:1048576,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128};
const profile={schema:'barocss-source-curve-knot-insertion-ingestion',version:0,nativeSchema:'barocss-source-curve-knot-insertion-report',nativeVersion:0,sourceFrame:'authored-xyz-no-axis-conversion',lengthUnit:'mm',parameterFrame:'original-native-curve-parameter',ownership:'independent-copied-cpu-data-gc',limits,capabilities:{nativeSourceInsertion:true,copiedWholeReceipt:true,renderer:false,url:false,byteInput:false,publicSerializer:false,dispose:false,genericRefinement:false,globalShape:false,globalBinary64:false,g1g2:false,topology:false,solid:false,manufacturing:false,editorDisplay:false,persistentTopology:false,publication:false}};
const fields=['request','source','originalModel','model','originalCurve','curve','provenance','report'];
const originals=new Map(),admissions=[],pairs=[],rows=[],calls=[],refusals=[];
let attempts=0,successes=0,nativeRefusals=0,getterCalls=0;
function same(a,b,path='$'){
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Whole value/sign mismatch at '+path);return;}
 assert.equal(Array.isArray(a),Array.isArray(b),path);assert.deepEqual(Object.keys(a),Object.keys(b),path+' fields/order');for(const key of Object.keys(a))same(a[key],b[key],path+'.'+key);
}
function refs(value,set=new Set(),mutableOnly=false){if(value&&typeof value==='object'&&!set.has(value)&&(!mutableOnly||!Object.isFrozen(value))){set.add(value);for(const item of Object.values(value))refs(item,set,mutableOnly);}return set;}
function intersect(a,b){let count=0;for(const item of a)if(b.has(item))count++;return count;}
function zeros(value,path='$',result=[]){if(typeof value==='number'&&Object.is(value,-0))result.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))zeros(item,path+'.'+key,result);return result;}
function frozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert.ok(Object.isFrozen(value),'Profile must be deeply frozen');for(const item of Object.values(value))frozen(item,seen);}
function signed(value,space){return JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+'\n';}
function save(file,value){writeFileSync(resolve(output,file),signed(value,2),{flag:'wx'});}
function pinBytes(bytes,pin){assert.equal(bytes.length,pin.bytes,pin.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,pin.file);}
function errorReceipt(error,depth=0){const result={name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};if(error?.cause!==undefined)result.cause=error.cause instanceof Error&&depth<8?errorReceipt(error.cause,depth+1):error.cause;return result;}
function invoke(entry,input,label){attempts++;const call={index:attempts,entry,label,outcome:'pending'};calls.push(call);try{const result=entry==='parse'?parse(input):read(input);successes++;call.outcome='accepted';return result;}catch(error){call.outcome='refused';call.error=errorReceipt(error);throw error;}}
function nativeFacts(native,key){
 assert.deepEqual(Object.keys(native),fields);const report=native.report,p=native.provenance,selected=p.selectedObjectIndex;
 assert.equal(native.request.sourceVersion,0);assert.equal(native.request.maximumObservations,128);assert.equal(report.schema,'barocss-source-curve-knot-insertion-report');assert.equal(report.version,0);assert.equal(report.sourceVersion,0);assert.equal(report.lengthUnit,'mm');
 assert.equal(native.originalModel.objects.length,3);assert.equal(native.model.objects.length,3);assert.equal(report.objectCount,3);
 same(native.originalCurve,native.originalModel.objects[selected]);same(native.curve,native.model.objects[selected]);
 for(let index=0;index<3;index++)if(index!==selected)same(native.originalModel.objects[index],native.model.objects[index]);
 for(const field of ['name','version','lengthUnit'])same(native.originalModel[field],native.model[field]);
 same(p.parameterMap,{kind:'identity',formula:'u=t',d1Factor:1});assert.equal(p.patches.length,3);assert.deepEqual(p.patches.map(patch=>patch.field).sort(),['control-points','knots','weights']);
 let rebuilt=native.request.source,priorStart=rebuilt.length;
 for(const patch of [...p.patches].sort((a,b)=>b.startUTF16-a.startUTF16)){
  assert.ok(Number.isInteger(patch.startUTF16)&&Number.isInteger(patch.endUTF16)&&patch.startUTF16>=0&&patch.startUTF16<patch.endUTF16&&patch.endUTF16<=priorStart);
  assert.equal(native.request.source.slice(patch.startUTF16,patch.endUTF16),patch.originalText);rebuilt=rebuilt.slice(0,patch.startUTF16)+patch.replacementText+rebuilt.slice(patch.endUTF16);priorStart=patch.startUTF16;
 }
 assert.equal(rebuilt,native.source);assert.equal(report.sourceSizes.original.utf16,native.request.source.length);assert.equal(report.sourceSizes.original.utf8,Buffer.byteLength(native.request.source));assert.equal(report.sourceSizes.candidate.utf16,native.source.length);assert.equal(report.sourceSizes.candidate.utf8,Buffer.byteLength(native.source));
 const count={main:9,quartic:5,c0:5,capacity:128}[key];assert.equal(report.observations.length,count);assert.ok(Object.is(report.observations[0].parameter,p.domain[0]));assert.ok(Object.is(report.observations.at(-1).parameter,p.domain[1]));
 let evaluated=0,refused=0;
 for(const[index,observation]of report.observations.entries()){
  if(index)assert.ok(report.observations[index-1].parameter<observation.parameter);
  for(const state of [observation.originalD1,observation.refinedD1])if(state.status==='evaluated'){evaluated++;assert.ok(Array.isArray(state.value.point)&&Array.isArray(state.value.derivative));}else{refused++;assert.equal(state.status,'refused-c0');assert.equal(state.name,'Error');assert.equal(state.reason,'First derivative is not defined at an exact C0 interior knot');assert.equal(state.value,null);}
  if(observation.originalD1.status==='refused-c0'||observation.refinedD1.status==='refused-c0')assert.equal(observation.relativeDerivativeDifference,null);
 }
 const counts=report.directCounts;assert.equal(counts.observationCount,count);assert.equal(counts.curveD0Count,count*2);assert.equal(counts.curveD1AttemptCount,count*2);assert.equal(counts.curveD1EvaluatedCount,evaluated);assert.equal(counts.curveD1RefusedCount,refused);
 for(const field of ['sourceWriterCallCount','publicRefinementCallCount','loftCallCount','rationalOperationCount'])assert.equal(counts[field],0);
 assert.equal(report.quality.geometricValidity,'not-certified');assert.equal(report.quality.localShapeObservations,true);
 for(const field of ['topologyCertified','solid','globalShapeErrorCertified','globalBinary64ErrorCertified','g1g2Certified','manufacturingToleranceCertified','editorDisplayCertified','persistentTopologyBindingCertified','publication'])assert.equal(report.quality[field],false);
 assert.ok(Object.values(report.preservation).every(value=>value===true));
 if(key==='capacity')for(const value of [.5,.125,.0625,.5625])assert.ok(report.observations.some(observation=>Object.is(observation.parameter,value)));
 return {observations:count,storedD0:count*2,storedD1Attempts:count*2,storedD1Evaluated:evaluated,storedD1Refused:refused,originalPoles:native.originalCurve.controlPoints.length,refinedPoles:native.curve.controlPoints.length};
}
function checkAdmission(result,reference,input,text,key,label){
 assert.deepEqual(Object.keys(result),['native','validationReport','profile','sourceText']);same(result.native,reference);same(result.validationReport,reference.report);same(result.profile,profile);frozen(result.profile);assert.equal(result.sourceText,text);assert.ok(!Object.isFrozen(result.native)&&!Object.isFrozen(result.validationReport));
 const inputRefs=refs(input),nativeRefs=refs(result.native),reportRefs=refs(result.validationReport);assert.equal(intersect(nativeRefs,inputRefs),0);assert.equal(intersect(reportRefs,inputRefs),0);assert.equal(intersect(nativeRefs,reportRefs),0);
 const mutable=refs(result,new Set(),true);for(const previous of admissions){const count=intersect(mutable,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}
 const signPaths=zeros(result.native);assert.equal(signPaths.length,{main:18,quartic:18,c0:40,capacity:685}[key]);same(signPaths,zeros(reference));
 admissions.push({label,key,result,mutable,negativeZeroPaths:zeros(result)});return nativeFacts(result.native,key);
}
try{
 assert.deepEqual(Object.keys(BaroCadSourceCurveKnotInsertionDiagnosticCode).sort(),['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'].sort());
 assert.equal(pins.reduce((sum,pin)=>sum+pin.bytes,0),259171);
 for(const pin of pins){const bytes=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);originals.set(pin.file,{pin,text,reference:JSON.parse(text)});}
 for(const key of ['main','quartic','c0','capacity']){
  const{pin,text,reference}=originals.get(key+'.result.json'),oracleRecord=originals.get(key+'.independent-math-oracle.json'),oracle=oracleRecord.reference,oracleBefore=structuredClone(oracle);
  assert.equal(oracle.idealWholePiecewiseHomogeneousIdentity,true);assert.equal(oracle.actualStoredExact,key!=='main');same(oracle.priorMultiplicity,reference.provenance.priorMultiplicity);
  const generated=reference.provenance.steps.flatMap(step=>step.generatedPoles.map(pole=>pole.refinedPoleIndex));same(oracle.generated.map(pole=>pole.index),generated);
  assert.ok(Object.is(oracle.spans[0].domain[0],reference.provenance.domain[0]));assert.ok(Object.is(oracle.spans.at(-1).domain[1],reference.provenance.domain[1]));
  const parsed=invoke('parse',text,key+':text'),facts=checkAdmission(parsed,reference,text,text,key,key+':text');
  const input=structuredClone(reference),inputBefore=structuredClone(input),owned=invoke('read',input,key+':owned');checkAdmission(owned,reference,input,null,key,key+':owned');same(input,inputBefore);
  const written=Buffer.from(signed(parsed.native),'utf8');pinBytes(written,pin);writeFileSync(resolve(output,pin.file),written,{flag:'wx'});const coldText=readFileSync(resolve(output,pin.file),'utf8');assert.equal(coldText,text);
  const cold=invoke('parse',coldText,key+':cold');checkAdmission(cold,reference,coldText,coldText,key,key+':cold');
  const parsedBefore=structuredClone(parsed),coldBefore=structuredClone(cold),ownedBefore=structuredClone(owned);
  input.curve.controlPoints[0][0]+=1;same(owned,ownedBefore);
  const reportValue=owned.validationReport.maximumPointDifferenceMM;owned.validationReport.maximumPointDifferenceMM=reportValue+1;same(owned.native,reference);same(parsed,parsedBefore);same(cold,coldBefore);owned.validationReport.maximumPointDifferenceMM=reportValue;
  const nativeValue=owned.native.curve.controlPoints[0][0];owned.native.curve.controlPoints[0][0]=nativeValue+1;same(owned.validationReport,reference.report);same(parsed,parsedBefore);same(cold,coldBefore);owned.native.curve.controlPoints[0][0]=nativeValue;same(owned,ownedBefore);same(oracle,oracleBefore);
  rows.push({key,pin,oraclePin:oracleRecord.pin,oracle,native:parsed.native,validationReport:parsed.validationReport,profile:parsed.profile,sourceText:parsed.sourceText,negativeZeroPaths:zeros(parsed.native),savedPin:{file:pin.file,bytes:written.length,sha256:pin.sha256},nativeFacts:facts,callerMutationIsolated:true});
 }
 assert.equal(successes,12);assert.equal(pairs.length,66);
 const stored=rows.reduce((total,row)=>{for(const key of ['observations','storedD0','storedD1Attempts','storedD1Evaluated','storedD1Refused'])total[key]+=row.nativeFacts[key];return total;},{observations:0,storedD0:0,storedD1Attempts:0,storedD1Evaluated:0,storedD1Refused:0});
 same(stored,{observations:147,storedD0:294,storedD1Attempts:294,storedD1Evaluated:170,storedD1Refused:124});
 const accepted=admissions.map(item=>item.result),acceptedBefore=structuredClone(accepted),acceptedRefs=refs(accepted),acceptedZeros=zeros(accepted);
 function retained(){same(accepted,acceptedBefore);const current=refs(accepted);assert.equal(current.size,acceptedRefs.size);for(const value of current)assert.ok(acceptedRefs.has(value));same(zeros(accepted),acceptedZeros);for(const pin of pins)pinBytes(readFileSync(resolve(directory,pin.file)),pin);}
 function refuse(name,entry,input,code,native=false,path=null){
  let error;const successfulBefore=successes;try{invoke(entry,input,name);}catch(cause){error=cause;}
  const receipt={name,entry,error:error?errorReceipt(error):null,eligibleWholeValidator:native,mutationPath:path,getterCalls};refusals.push(receipt);save('refusal-'+String(refusals.length).padStart(2,'0')+'.json',receipt);
  assert.ok(error instanceof BaroCadSourceCurveKnotInsertionReadError,name+': unexpected acceptance/error; stop without alternative mutation');assert.equal(error.code,code,name);assert.ok(error.message.length<=1024);
  if(native){assert.ok(error.cause instanceof SourceCurveKnotInsertionError);assert.equal(error.cause.code,'OWNED');assert.equal(error.cause.message,'Source Curve knot insertion: Owned source, Models, coefficients, patches, native observations, counts or sizes changed');assert.equal(error.cause.cause,undefined);nativeRefusals++;}
  else if(['JSON','OWNED','BUDGET'].includes(code)){assert.equal(error.cause?.name,'BaroCadQualifiedBodyReadError');assert.equal(error.cause?.code,code);}
  assert.equal(successes,successfulBefore);assert.equal(getterCalls,0);retained();receipt.acceptedRetained=true;
 }
 const main=originals.get('main.result.json').reference,c0=originals.get('c0.result.json').reference;
 refuse('parse-wrong-kind','parse',0,'INPUT');refuse('read-wrong-kind','read',0,'INPUT');
 refuse('malformed-json','parse','{','JSON');refuse('decoded-duplicate-report','parse','{"report":{},"\\u0072eport":{}}','JSON');
 refuse('escaped-lone-surrogate','parse','"\\ud800"','JSON');refuse('nonfinite-number','parse','1e400','JSON');
 refuse('raw-utf16-over-cap','parse',' '.repeat(limits.utf16Units+1),'BUDGET');refuse('raw-utf8-over-cap','parse','é'.repeat(limits.utf8Bytes/2+1),'BUDGET');
 const getter=structuredClone(main);Object.defineProperty(getter,'report',{enumerable:true,get(){getterCalls++;return main.report;}});refuse('whole-report-getter','read',getter,'OWNED');
 const cycle=structuredClone(main);cycle.request=cycle;refuse('whole-request-cycle','read',cycle,'OWNED');
 const schema=structuredClone(main);schema.report.schema='unknown';refuse('report-wrong-schema','read',schema,'SCHEMA');
 const version=structuredClone(main);version.report.version=1;refuse('report-wrong-version','read',version,'SCHEMA');
 const mutations=[
  {name:'candidate-source',base:main,path:'$.source',change(value){value.source+=' ';}},
  {name:'patch-replacement',base:main,path:'$.provenance.patches[0].replacementText',change(value){value.provenance.patches[0].replacementText+=' ';}},
  {name:'selected-coefficient',base:main,path:'$.curve.controlPoints[0][0]',change(value){value.curve.controlPoints[0][0]+=1;}},
  {name:'refined-c0-reason',base:c0,path:'$.report.observations[2].refinedD1.reason',change(value){assert.equal(value.report.observations[2].refinedD1.status,'refused-c0');assert.equal(value.report.observations[2].refinedD1.value,null);assert.equal(value.report.observations[2].relativeDerivativeDifference,null);value.report.observations[2].refinedD1.reason+=' changed';}},
 ];
 for(const mutation of mutations){const value=structuredClone(mutation.base);mutation.change(value);const before=structuredClone(value);refuse(mutation.name,'read',value,'NATIVE',true,mutation.path);same(value,before);}
 assert.equal(attempts,28);assert.equal(successes,12);assert.equal(refusals.length,16);assert.equal(nativeRefusals,4);assert.equal(successes+nativeRefusals,16);assert.equal(getterCalls,0);retained();
 const summary={result:'source-curve-knot-insertion-public-file-copy-ok',pins,totalOriginalBytes:259171,rows,admissions:admissions.map(({label,key,result,negativeZeroPaths})=>({label,key,result,negativeZeroPaths})),counts:{publicAttempts:attempts,successes,refusals:16,getterCalls,mutableReferencePairs:pairs.length,nativeRefusalOutcomes:nativeRefusals,eligibleWholeValidatorAttempts:successes+nativeRefusals},publicCalls:calls,mutableReferenceIntersections:pairs,refusals,storedNativeAuthorWork:stored,acceptedRetained:true,nativeCallEvidence:'Actual public outcome ledger plus static one matching whole-validator callsite. Sixteen is eligible-attempt arithmetic, not dynamic kernel telemetry. Stored D0/D1 counters retain author work; no direct consumer D0/D1/insertion calls.',scope:'Twelve complete public reader admissions, sixteen frozen refusals, four exact signed native cold files and full four oracle comparison data. No renderer, direct provider construction, insertion math, source rewrite or new global certificate.'};
 save('summary.json',summary);console.log(JSON.stringify({result:summary.result,attempts,successes,refusals:16,eligibleWholeValidatorAttempts:16,getterCalls}));
}catch(error){save('first-failure.json',{error:errorReceipt(error),stack:error.stack??null,attempts,successes,nativeRefusals,getterCalls,publicCalls:calls,rows,refusals});throw error;}
`;

const virtualEntry=resolve(examples,'source-curve-knot-insertion-private-consumer.mjs');
const bundled=await build({absWorkingDir:root,bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true,stdin:{contents:consumer,resolveDir:examples,sourcefile:virtualEntry},...(mode==='compiled'?{plugins:[plugin]}:{})});
const inputs=Object.keys(bundled.metafile.inputs).map(path=>resolve(root,path));
const otherExamples=inputs.filter(path=>(path.startsWith(resolve(root,'examples')+'/')||[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'examples')+'/')))&&path!==virtualEntry);assert.deepEqual(otherExamples,[],'Only exact own absolute virtual consumer; no old example imports');
const own=inputs.filter(path=>[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'src')+'/')||path.startsWith(resolve(item.directory,'dist')+'/'))),ownSource=own.filter(path=>path.includes('/src/')),ownCompiled=own.filter(path=>path.includes('/dist/'));
assert.ok(own.length>0);assert.equal(mode==='source'?ownCompiled.length:ownSource.length,0);
const folder=mode==='source'?'src':'dist',extension=mode==='source'?'.ts':'.js';
for(const[suffix,leaf]of [['cad-interop','source-curve-knot-insertion'],['cad-interop','qualified-body-json'],['cad','source-curve-knot-insertion']])assert.ok(own.includes(resolve(root,'packages/barocss-'+suffix,folder,leaf+extension)),'Actual public authority in graph: '+suffix+'/'+leaf);
const peers=inputs.filter(path=>path.includes('/node_modules/')||path.includes('/barocss-gpu/'));assert.deepEqual(peers,[],'Renderer-free public closure requires zero runtime peers');
const wrapperSource=await readFile(resolve(interop.directory,'src/nurbs/source-wide/source-curve-knot-insertion.ts'),'utf8');
const callsites=[...wrapperSource.matchAll(/validateSourceCurveKnotInsertion\s*\(/g)].map(match=>({offset:match.index,line:wrapperSource.slice(0,match.index).split('\n').length}));assert.equal(callsites.length,1);
const guardOffset=wrapperSource.indexOf('requireNativeSchema(native)');assert.ok(guardOffset>=0);
const nativeCallsiteEvidence={callsites,kind:'Static matching-validator callsite and guard ordering only; no instrumented runtime kernel counter',schemaGuardOffset:guardOffset,schemaGuardBeforeCall:guardOffset<callsites[0].offset};assert.equal(nativeCallsiteEvidence.schemaGuardBeforeCall,true);
await writeFile(resolve(output,'consumer-source.mjs'),consumer);await writeFile(resolve(output,'consumer.bundle.mjs'),bundled.outputFiles[0].text);await writeFile(resolve(output,'consumer-metafile.json'),JSON.stringify(bundled.metafile,null,2));
await writeFile(resolve(output,'graphs.json'),JSON.stringify({mode,node:process.version,parent,ownSource:ownSource.map(path=>relative(root,path)),ownCompiled:ownCompiled.map(path=>relative(root,path)),ownSourceCount:ownSource.length,ownCompiledCount:ownCompiled.length,peers,resolutions,nativeCallsiteEvidence,virtualEntry:relative(root,virtualEntry),otherExamples,codecHash,baselineMaps:38,currentMaps:39},null,2));
const executed=spawnSync(process.execPath,['--max-old-space-size=8192','--input-type=module'],{cwd:root,input:bundled.outputFiles[0].text,encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,env:{...process.env,LOADER1362_PRODUCT_OUTPUT:output}});
await writeFile(resolve(output,'consumer.stdout'),executed.stdout??'');await writeFile(resolve(output,'consumer.stderr'),executed.stderr??'');await writeFile(resolve(output,'consumer.exit'),String(executed.status)+'\n');
await writeFile(resolve(output,'consumer.result.json'),JSON.stringify({status:executed.status,signal:executed.signal,error:executed.error?{name:executed.error.name,code:executed.error.code??null,message:executed.error.message}:null,timeoutMilliseconds:120000,heapMB:8192},null,2));process.stdout.write(executed.stdout??'');process.stderr.write(executed.stderr??'');assert.equal(executed.status,0,'FIRST public knot insertion file flow failed');

if(mode==='compiled'){
 for(const entry of Object.values(interop.manifest.publishConfig.exports)){await access(resolve(interop.directory,entry.import));await access(resolve(interop.directory,entry.types));}
 const typeSource=await readFile(resolve(examples,'source-curve-knot-insertion-native-contract.ts'),'utf8'),virtualType=resolve(examples,'source-curve-knot-insertion-private-published-contract.mts');
 const compilerOptions={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,skipLibCheck:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']};
 const host=ts.createCompilerHost(compilerOptions),get=host.getSourceFile.bind(host),fileExists=host.fileExists.bind(host),readOriginal=host.readFile.bind(host),typeResolutions=[];
 host.getSourceFile=(path,version,onError,newFile)=>resolve(path)===virtualType?ts.createSourceFile(virtualType,typeSource,version,true,ts.ScriptKind.TS):get(path,version,onError,newFile);
 host.fileExists=path=>resolve(path)===virtualType||fileExists(path);host.readFile=path=>resolve(path)===virtualType?typeSource:readOriginal(path);
 host.resolveModuleNames=(names,containingFile)=>names.map(name=>{if(/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)){const path=published(name,'types');typeResolutions.push({name,importer:relative(root,containingFile),target:relative(root,path)});return{resolvedFileName:path,extension:ts.Extension.Dts,isExternalLibraryImport:true};}return ts.resolveModuleName(name,containingFile,compilerOptions,host).resolvedModule;});
 const program=ts.createProgram([virtualType],compilerOptions,host),diagnostics=ts.getPreEmitDiagnostics(program).map(item=>({code:item.code,message:ts.flattenDiagnosticMessageText(item.messageText,'\n'),file:item.file?relative(root,item.file.fileName):null}));
 const ownDeclarations=program.getSourceFiles().map(file=>resolve(file.fileName)).filter(path=>[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'src')+'/')||path.startsWith(resolve(item.directory,'dist')+'/'))),sourceFallbacks=ownDeclarations.filter(path=>path.includes('/src/'));
 await writeFile(resolve(output,'published-types.json'),JSON.stringify({compiler:ts.version,strict:true,noEmit:true,skipLibCheck:true,diagnostics,sourceFallbacks,ownDeclarations:ownDeclarations.map(path=>relative(root,path)),typeResolutions,baselineMaps:38,currentMaps:39},null,2));assert.deepEqual(diagnostics,[]);assert.deepEqual(sourceFallbacks,[]);
 for(const[suffix,leaf]of [['cad-interop','source-curve-knot-insertion'],['cad','source-curve-knot-insertion']])assert.ok(ownDeclarations.includes(resolve(root,'packages/barocss-'+suffix,'dist',leaf+'.d.ts')),'Actual published selected declarations required');
}
console.log(JSON.stringify({mode,runtime:mode==='source'?'ordinary public source':'actual published emitted JS',types:mode==='compiled'?'strict selected emitted declarations':'unrun'}));
