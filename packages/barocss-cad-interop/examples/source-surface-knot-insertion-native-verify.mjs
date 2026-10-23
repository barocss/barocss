import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root=process.cwd(),prefix='packages/barocss-cad-interop/',examples=resolve(root,prefix,'examples');
const parent='a00224258c15e00d0dee04ba82312db207648a92';
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
assert.equal(Object.keys(baseline.exports).length,42);assert.equal(Object.keys(baseline.publishConfig.exports).length,42);
expected.exports['./source-surface-knot-insertion']={types:'./src/nurbs/source-wide/source-surface-knot-insertion.ts',import:'./src/nurbs/source-wide/source-surface-knot-insertion.ts'};
expected.publishConfig.exports['./source-surface-knot-insertion']={types:'./dist/nurbs/source-wide/source-surface-knot-insertion.d.ts',import:'./dist/nurbs/source-wide/source-surface-knot-insertion.js'};
assert.deepEqual(interop.manifest,expected);assert.equal(Object.keys(interop.manifest.exports).length,43);
const codecPath=resolve(interop.directory,'src/qualified-body-json.ts'),codecHash=createHash('sha256').update(await readFile(codecPath)).digest('hex');
assert.equal(codecHash,'451ea4d17c7afce5adf9f5f81c33de3f96eafca297631cac2f73afd437ff1683');
function published(specifier,field){
 const name=specifier.split('/').slice(0,2).join('/'),item=packages.get(name),suffix=specifier.slice(name.length),key=suffix?'.'+suffix:'.';
 const target=item?.manifest.publishConfig?.exports?.[key]?.[field];assert.ok(target?.startsWith('./dist/'),'Actual published '+field+' entry required: '+specifier);return resolve(item.directory,target);
}
const resolutions=[];
const plugin={name:'actual-published-source-surface-knot-insertion',setup(builder){builder.onResolve({filter:/^@barocss\/(cad|cad-interop)(\/|$)/},args=>{const path=published(args.path,'import');resolutions.push({specifier:args.path,importer:relative(root,args.importer),target:relative(root,path)});return{path};});}};

const dedicatedCodecHash=createHash('sha256').update(await readFile(resolve(interop.directory,'src/source-surface-knot-insertion-json.ts'))).digest('hex');
assert.equal(dedicatedCodecHash,'d38734339a0d11a43a688683c6376b2df8b08dc60824ae155750e723e1ead5c5');

const consumer=String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {parseBaroCadSourceSurfaceKnotInsertion as parse,readBaroCadSourceSurfaceKnotInsertion as read,BaroCadSourceSurfaceKnotInsertionReadError,BaroCadSourceSurfaceKnotInsertionDiagnosticCode} from '@barocss/cad-interop/source-surface-knot-insertion';
import {SourceSurfaceKnotInsertionError} from '@barocss/cad';
const output=process.env.LOADER1374_PRODUCT_OUTPUT,directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples/source-surface-knot-insertion-native-data');
const pins=[
 {file:'main.result.json',bytes:77795,sha256:'e587630319800a4be7d8a3a9915d3a8a92c478162c64f22acbf480a25dd5a856'},
 {file:'main.independent-tensor-identity.json',bytes:3782,sha256:'cd639c5948198d77833350f04f1e36a2862087e94d500b1c7d03639ae035825d'},
 {file:'secondary.result.json',bytes:88560,sha256:'88d8d508642a85ffc51d72b9cf82fe69157d1cdffe04f7ff43f99c2b7594abcf'},
 {file:'secondary.independent-tensor-identity.json',bytes:4378,sha256:'670a452e1e590aa5303344b27d1956d95c57b2c433ef5ab7b722841def16c789'},
 {file:'c0.result.json',bytes:27121,sha256:'79aa6d0583a32d185e0ff77dd7fc42689b364344a7ba52867d2a823e978a59fc'},
 {file:'c0.independent-tensor-identity.json',bytes:877,sha256:'03274c7b994acf3e7999a681c1789e28f98aadd998c7e6aa638c3079fd16ed4a'},
 {file:'capacity.result.json',bytes:544240,sha256:'db028c424b7791233f03e352598b9a9ae180f6e87017367734cde6d9c51390b4'},
 {file:'capacity.independent-tensor-identity.json',bytes:64212,sha256:'71e51ab165393373c67b2fc9895314cdafc5b216612fc1538057e8ce194afd71'},
];

const limits={utf8Bytes:4194304,utf16Units:4194304,values:1048576,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128};
const profile={schema:'barocss-source-surface-knot-insertion-ingestion',version:0,nativeSchema:'barocss-source-surface-knot-insertion-report',nativeVersion:0,sourceFrame:'authored-xyz-no-axis-conversion',lengthUnit:'mm',parameterFrame:'original-native-surface-uv',ownership:'independent-copied-cpu-data-gc',limits,capabilities:{nativeSourceInsertion:true,copiedWholeReceipt:true,renderer:false,url:false,byteInput:false,publicSerializer:false,dispose:false,genericRefinement:false,globalShape:false,globalBinary64:false,g1g2:false,topology:false,solid:false,manufacturing:false,editorDisplay:false,persistentTopology:false,publication:false}};
const fields=['request','source','originalModel','model','originalSurface','surface','provenance','report'];
const originals=new Map(),admissions=[],pairs=[],rows=[],calls=[],refusals=[],telemetry=[];
let attempts=0,successes=0,nativeRefusals=0,getterCalls=0;
const started=performance.now();
function memory(){const m=process.memoryUsage();return{rss:m.rss,heapUsed:m.heapUsed,heapTotal:m.heapTotal,external:m.external};}
function same(a,b,path='$'){
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Whole value/sign mismatch at '+path);return;}
 assert.equal(Array.isArray(a),Array.isArray(b),path);assert.deepEqual(Object.keys(a),Object.keys(b),path+' fields/order');for(const key of Object.keys(a))same(a[key],b[key],path+'.'+key);
}
function refs(value,set=new Set(),mutableOnly=false){if(value&&typeof value==='object'&&!set.has(value)&&(!mutableOnly||!Object.isFrozen(value))){set.add(value);for(const item of Object.values(value))refs(item,set,mutableOnly);}return set;}
function intersection(a,b){let count=0;for(const item of a)if(b.has(item))count++;return count;}
function zeros(value,path='$',result=[]){if(typeof value==='number'&&Object.is(value,-0))result.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))zeros(item,path+'.'+key,result);return result;}
function frozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert.ok(Object.isFrozen(value),'Profile must be deeply frozen');for(const item of Object.values(value))frozen(item,seen);}
function signed(value,space){return JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+'\n';}
function save(file,value){writeFileSync(resolve(output,file),signed(value,2),{flag:'wx'});}
function pinBytes(bytes,pin){assert.equal(bytes.length,pin.bytes,pin.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,pin.file);}
function errorReceipt(error,depth=0){const result={name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};if(error?.cause!==undefined)result.cause=error.cause instanceof Error&&depth<8?errorReceipt(error.cause,depth+1):error.cause;return result;}
function invoke(entry,input,label){
 attempts++;const call={index:attempts,entry,label,outcome:'pending'},before=memory(),start=performance.now();calls.push(call);
 try{const result=entry==='parse'?parse(input):read(input);successes++;call.outcome='accepted';return result;}
 catch(error){call.outcome='refused';call.error=errorReceipt(error);throw error;}
 finally{telemetry.push({index:attempts,label,elapsedMilliseconds:performance.now()-start,memoryBefore:before,memoryAfter:memory()});}
}
function c0Witness(native){
 const observation=native.report.observations[6];assert.ok(Object.is(observation.u,-0));assert.ok(Object.is(observation.v,0));assert.equal(observation.refinedD1.status,'refused-c0');assert.equal(observation.refinedD1.name,'Error');assert.equal(observation.refinedD1.reason,'First derivative is not defined at an exact C0 interior knot');assert.equal(observation.refinedD1.value,null);assert.equal(observation.relativeDuDifference,null);assert.equal(observation.relativeDvDifference,null);
 return{index:6,u:observation.u,v:observation.v,refinedD1:structuredClone(observation.refinedD1),relativeDuDifference:null,relativeDvDifference:null};
}
function nativeFacts(native,key){
 assert.deepEqual(Object.keys(native),fields);const p=native.provenance,r=native.report,selected=p.selectedObjectIndex;
 assert.equal(native.request.sourceVersion,0);assert.equal(native.request.maximumObservations,1024);assert.equal(r.schema,'barocss-source-surface-knot-insertion-report');assert.equal(r.version,0);assert.equal(r.sourceVersion,0);assert.equal(r.lengthUnit,'mm');assert.equal(r.objectCount,3);
 same([native.originalModel.objects.length,native.model.objects.length],[3,3]);same(native.originalSurface,native.originalModel.objects[selected]);same(native.surface,native.model.objects[selected]);
 for(let index=0;index<3;index++)if(index!==selected)same(native.originalModel.objects[index],native.model.objects[index]);for(const name of ['name','version','lengthUnit'])same(native.originalModel[name],native.model[name]);
 same(p.parameterMap,{kind:'identity',formula:'u=s;v=t',uD1Factor:1,vD1Factor:1});assert.equal(p.axis,native.request.axis);assert.equal(r.axis,p.axis);assert.equal(p.patches.length,3);assert.equal(r.patchCount,3);assert.deepEqual(p.patches.map(patch=>patch.field).sort(),['control-points',native.request.axis==='u'?'knots-u':'knots-v','weights'].sort());
 const otherKnots=native.request.axis==='u'?'knotsV':'knotsU';same(native.originalSurface[otherKnots],native.surface[otherKnots]);
 let reconstructed=native.request.source,priorStart=reconstructed.length;const ordered=[...p.patches].sort((a,b)=>b.startUTF16-a.startUTF16);
 const sourceSpans=[];for(const patch of ordered){assert.ok(Number.isInteger(patch.startUTF16)&&Number.isInteger(patch.endUTF16)&&patch.startUTF16>=0&&patch.startUTF16<patch.endUTF16&&patch.endUTF16<=priorStart);assert.equal(native.request.source.slice(patch.startUTF16,patch.endUTF16),patch.originalText);sourceSpans.push({field:patch.field,startUTF16:patch.startUTF16,endUTF16:patch.endUTF16,originalText:patch.originalText,replacementText:patch.replacementText});reconstructed=reconstructed.slice(0,patch.startUTF16)+patch.replacementText+reconstructed.slice(patch.endUTF16);priorStart=patch.startUTF16;}
 assert.equal(reconstructed,native.source);assert.equal(r.sourceSizes.original.utf16,native.request.source.length);assert.equal(r.sourceSizes.original.utf8,Buffer.byteLength(native.request.source));assert.equal(r.sourceSizes.candidate.utf16,native.source.length);assert.equal(r.sourceSizes.candidate.utf8,Buffer.byteLength(native.source));
 same([r.stations.u.length,r.stations.v.length],{main:[9,5],secondary:[7,8],c0:[5,3],capacity:[32,31]}[key]);assert.equal(r.observations.length,r.stations.u.length*r.stations.v.length);
 for(const axis of ['u','v']){const values=r.stations[axis];assert.ok(Object.is(values[0],p.domain[axis][0]));assert.ok(Object.is(values.at(-1),p.domain[axis][1]));for(let index=1;index<values.length;index++)assert.ok(values[index-1]<values[index]);}
 let evaluated=0,refused=0;
 for(const[index,observation]of r.observations.entries()){
  assert.ok(Object.is(observation.u,r.stations.u[Math.floor(index/r.stations.v.length)]));assert.ok(Object.is(observation.v,r.stations.v[index%r.stations.v.length]));
  for(const state of [observation.originalD1,observation.refinedD1])if(state.status==='evaluated'){evaluated++;for(const field of ['point','du','dv'])assert.ok(Array.isArray(state.value[field]));}else{refused++;assert.equal(state.status,'refused-c0');assert.equal(state.name,'Error');assert.equal(state.reason,'First derivative is not defined at an exact C0 interior knot');assert.equal(state.value,null);}
  if(observation.originalD1.status==='refused-c0'||observation.refinedD1.status==='refused-c0'){assert.equal(observation.relativeDuDifference,null);assert.equal(observation.relativeDvDifference,null);}
 }
 const counts=r.directCounts;assert.equal(counts.observationCount,r.observations.length);assert.equal(counts.surfaceD0Count,2*r.observations.length);assert.equal(counts.surfaceD1AttemptCount,2*r.observations.length);assert.equal(counts.surfaceD1EvaluatedCount,evaluated);assert.equal(counts.surfaceD1RefusedCount,refused);assert.equal(counts.coefficientInsertionCallCount,p.strips.length);assert.equal(r.stripCount,p.strips.length);
 for(const name of ['curveD0Count','curveD1AttemptCount','sourceWriterCallCount','publicRefinementCallCount','rationalOperationCount'])assert.equal(counts[name],0);
 assert.equal(r.quality.geometricValidity,'not-certified');assert.equal(r.quality.localShapeObservations,true);for(const name of ['topologyCertified','solid','globalShapeErrorCertified','globalBinary64ErrorCertified','g1g2Certified','manufacturingToleranceCertified','editorDisplayCertified','persistentTopologyBindingCertified','publication'])assert.equal(r.quality[name],false);assert.ok(Object.values(r.preservation).every(value=>value===true));
 assert.equal(r.limits.maximumFileUTF16,4194304);assert.equal(r.limits.maximumFileUTF8,4194304);assert.equal(r.limits.ownValues,1048576);
 const signs=zeros(native);assert.equal(signs.length,{main:32,secondary:46,c0:61,capacity:4273}[key]);
 return{modelObjectCounts:[3,3],selectedObjectIndex:selected,axis:p.axis,stations:{u:r.stations.u.length,v:r.stations.v.length},observationCount:r.observations.length,storedD0:counts.surfaceD0Count,storedD1Attempts:counts.surfaceD1AttemptCount,storedD1Evaluated:evaluated,storedD1Refused:refused,storedStripCalls:p.strips.length,sourceReconstructedFromThreeOriginalASTRanges:true,sourceSpans,c0Witness:key==='c0'?c0Witness(native):null};
}
function tensorFacts(tensor,key){
 assert.deepEqual(Object.keys(tensor),['cellCount','coefficientCount','storedNonzero','wholeIdealTensorIdentity','cells']);assert.equal(Object.hasOwn(tensor,'actualStoredExact'),false);assert.equal(Object.hasOwn(tensor,'storedExact'),false);assert.equal(tensor.wholeIdealTensorIdentity,true);assert.equal(tensor.cells.length,tensor.cellCount);
 same([tensor.cellCount,tensor.coefficientCount,tensor.storedNonzero],{main:[8,960,820],secondary:[9,1080,936],c0:[2,96,21],capacity:[225,3600,0]}[key]);
 let coefficients=0,storedNonzero=0;for(const cell of tensor.cells){assert.deepEqual(Object.keys(cell),['uDomain','vDomain','idealAllCoefficientsZero','coefficientCount','actualNonzeroCoefficients','maximumActualResidual','witness','actualResidualSHA256']);assert.equal(cell.idealAllCoefficientsZero,true);assert.ok(/^[a-f0-9]{64}$/.test(cell.actualResidualSHA256));coefficients+=cell.coefficientCount;storedNonzero+=cell.actualNonzeroCoefficients;}
 assert.equal(coefficients,tensor.coefficientCount);assert.equal(storedNonzero,tensor.storedNonzero);
 return{wholeOriginalTensorRetained:true,declaredCellCountsAgree:true,oracleRecomputed:false,residualHashRecomputed:false,storedExactFieldAbsent:true,scope:'Pinned original summary/witness/hash cells only; no new stored-exact flag or polynomial proof'};
}
function checkAdmission(result,reference,input,text,key,label){
 assert.deepEqual(Object.keys(result),['native','validationReport','profile','sourceText']);same(result.native,reference);same(result.validationReport,reference.report);same(result.profile,profile);frozen(result.profile);assert.equal(result.sourceText,text);assert.ok(!Object.isFrozen(result.native)&&!Object.isFrozen(result.validationReport));
 const inputRefs=refs(input),nativeRefs=refs(result.native),reportRefs=refs(result.validationReport);assert.equal(intersection(nativeRefs,inputRefs),0);assert.equal(intersection(reportRefs,inputRefs),0);assert.equal(intersection(nativeRefs,reportRefs),0);
 const mutable=refs(result,new Set(),true);for(const previous of admissions){const count=intersection(mutable,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}
 const nativeSigns=zeros(result.native);assert.equal(nativeSigns.length,{main:32,secondary:46,c0:61,capacity:4273}[key]);same(nativeSigns,zeros(reference));
 admissions.push({label,key,result,mutable,negativeZeroPaths:zeros(result),sourceTextRole:text===null?'owned-null':'exact-text',wholeNativeEqual:true,wholeReportEqual:true,inputAliases:0,nativeReportAliases:0});
}
try{
 assert.ok(output&&isAbsolute(output));assert.deepEqual(Object.keys(BaroCadSourceSurfaceKnotInsertionDiagnosticCode).sort(),['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'].sort());assert.equal(pins.reduce((sum,pin)=>sum+pin.bytes,0),810965);
 for(const pin of pins){const bytes=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);originals.set(pin.file,{pin,text,reference:JSON.parse(text)});}
 for(const key of ['main','secondary','c0','capacity']){
  const{pin,text,reference}=originals.get(key+'.result.json'),tensorRecord=originals.get(key+'.independent-tensor-identity.json'),tensor=tensorRecord.reference,tensorBefore=structuredClone(tensor);
  const tensorEvidence=tensorFacts(tensor,key),parsed=invoke('parse',text,key+':text');checkAdmission(parsed,reference,text,text,key,key+':text');const facts=nativeFacts(parsed.native,key);
  const input=structuredClone(reference),inputBefore=structuredClone(input),owned=invoke('read',input,key+':owned');checkAdmission(owned,reference,input,null,key,key+':owned');same(input,inputBefore);
  const written=Buffer.from(signed(parsed.native),'utf8');pinBytes(written,pin);writeFileSync(resolve(output,pin.file),written,{flag:'wx'});const coldText=readFileSync(resolve(output,pin.file),'utf8');assert.equal(coldText,text);
  const cold=invoke('parse',coldText,key+':cold');checkAdmission(cold,reference,coldText,coldText,key,key+':cold');
  const parsedBefore=structuredClone(parsed),coldBefore=structuredClone(cold),ownedBefore=structuredClone(owned);
  input.surface.controlPoints[0][0][0]+=1;same(owned,ownedBefore);
  const reportValue=owned.validationReport.version;owned.validationReport.version=reportValue+1;same(owned.native,reference);same(parsed,parsedBefore);same(cold,coldBefore);owned.validationReport.version=reportValue;
  const nativeValue=owned.native.surface.controlPoints[0][0][0];owned.native.surface.controlPoints[0][0][0]=nativeValue+1;same(owned.validationReport,reference.report);same(parsed,parsedBefore);same(cold,coldBefore);owned.native.surface.controlPoints[0][0][0]=nativeValue;same(owned,ownedBefore);same(tensor,tensorBefore);
  rows.push({key,pin,tensorPin:tensorRecord.pin,tensor,tensorEvidence,native:parsed.native,validationReport:parsed.validationReport,profile:parsed.profile,sourceText:parsed.sourceText,negativeZeroPaths:zeros(parsed.native),savedPin:{file:pin.file,bytes:written.length,sha256:pin.sha256},nativeFacts:facts,callerMutationIsolated:true});
  save('positive-'+key+'.json',{key,pin,savedPin:rows.at(-1).savedPin,nativeFacts:facts,nativeNegativeZeros:zeros(parsed.native).length,storedNonzero:tensor.storedNonzero,wholeValueReportSourceSignEqual:true});
  console.log(JSON.stringify({positive:key,observations:facts.observationCount,negativeZeros:zeros(parsed.native).length,storedNonzero:tensor.storedNonzero}));
 }
 assert.equal(successes,12);assert.equal(pairs.length,66);
 const stored=rows.reduce((sum,row)=>{for(const name of ['observationCount','storedD0','storedD1Attempts','storedD1Evaluated','storedD1Refused','storedStripCalls'])sum[name]+=row.nativeFacts[name];return sum;},{observationCount:0,storedD0:0,storedD1Attempts:0,storedD1Evaluated:0,storedD1Refused:0,storedStripCalls:0});
 same(stored,{observationCount:1108,storedD0:2216,storedD1Attempts:2216,storedD1Evaluated:858,storedD1Refused:1358,storedStripCalls:32});
 const accepted=admissions.map(item=>item.result),acceptedBefore=structuredClone(accepted),acceptedRefs=refs(accepted),acceptedZeros=zeros(accepted);
 function retained(){same(accepted,acceptedBefore);const current=refs(accepted);assert.equal(current.size,acceptedRefs.size);for(const value of current)assert.ok(acceptedRefs.has(value));same(zeros(accepted),acceptedZeros);for(const pin of pins)pinBytes(readFileSync(resolve(directory,pin.file)),pin);for(const row of rows)pinBytes(readFileSync(resolve(output,row.savedPin.file)),row.savedPin);}
 function refuse(name,entry,input,code,native=false,path=null){
  let error;const successfulBefore=successes;try{invoke(entry,input,name);}catch(cause){error=cause;}
  const receipt={name,entry,error:error?errorReceipt(error):null,eligibleWholeValidator:native,mutationPath:path,getterCalls,acceptedRetained:false};refusals.push(receipt);save('refusal-first-'+String(refusals.length).padStart(2,'0')+'.json',receipt);
  assert.ok(error instanceof BaroCadSourceSurfaceKnotInsertionReadError,name+': unexpected acceptance/error; stop without alternative mutation');assert.equal(error.code,code,name);assert.ok(error.message.length<=1024);
  if(native){assert.ok(error.cause instanceof SourceSurfaceKnotInsertionError);assert.equal(error.cause.code,'OWNED');assert.equal(error.cause.message,'Source Surface knot insertion: Owned source, Models, net, strip receipts, patches, stations, observations, counts or sizes changed');assert.equal(error.cause.cause,undefined);nativeRefusals++;}
  else assert.equal(error.cause,undefined,'Predeclared direct dedicated codec/early guard errors have no added cause layer');
  assert.equal(successes,successfulBefore);assert.equal(getterCalls,0);retained();receipt.acceptedRetained=true;save('refusal-'+String(refusals.length).padStart(2,'0')+'.json',receipt);console.log(JSON.stringify({refusal:name,code:error.code,getterCalls}));
 }
 const main=originals.get('main.result.json').reference,c0=originals.get('c0.result.json').reference;
 // Eight fixed public early controls, before any matching whole call.
 refuse('parse-wrong-kind','parse',0,'INPUT');refuse('read-wrong-kind','read',0,'INPUT');refuse('malformed-json','parse','{','JSON');refuse('escaped-lone-surrogate','parse','"\\ud800"','JSON');refuse('nonfinite-number','parse','1e400','JSON');
 refuse('wrong-eight-field-root','read',{},'SCHEMA');const schema=structuredClone(main);schema.report.schema='unknown';refuse('report-wrong-schema','read',schema,'SCHEMA');const version=structuredClone(main);version.report.version=1;refuse('report-wrong-version','read',version,'SCHEMA');
 // Seven inherited codec controls; quota controls are records, not root arrays.
 refuse('raw-utf16-over-cap','parse',' '.repeat(limits.utf16Units+1),'BUDGET');refuse('raw-utf8-over-cap','parse','é'.repeat(limits.utf8Bytes/2+1),'BUDGET');refuse('decoded-duplicate-report','parse','{"report":0,"\\u0072eport":1}','JSON');
 const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){getterCalls++;return 1;}});refuse('small-enumerable-getter','read',getter,'OWNED');const cycle={};cycle.self=cycle;refuse('small-ancestor-cycle','read',cycle,'OWNED');
 refuse('per-occurrence-work-over-cap','read',{padding:Array(1024).fill(Array(1024).fill(0))},'BUDGET');refuse('canonical-byte-over-cap','read',{padding:Array(16).fill('x'.repeat(262144))},'BUDGET');
 const mutations=[
  {name:'candidate-source',base:main,path:'$.source',change(value){value.source+=' ';}},
  {name:'control-point-patch',base:main,path:'$.provenance.patches[1].replacementText',change(value){assert.equal(value.provenance.patches[1].field,'control-points');value.provenance.patches[1].replacementText+=' ';}},
  {name:'c0-refused-reason',base:c0,path:'$.report.observations[6].refinedD1.reason',change(value){c0Witness(value);value.report.observations[6].refinedD1.reason+=' changed';}},
 ];
 save('mutation-plan.json',{matchingEligibleAttemptLimit:15,mutations:mutations.map(({name,path})=>({name,path})),scope:'Exactly three measured independent owned mutations; no search or producer calls'});
 for(const mutation of mutations){const value=structuredClone(mutation.base);mutation.change(value);const before=structuredClone(value);refuse(mutation.name,'read',value,'NATIVE',true,mutation.path);same(value,before);}
 assert.equal(attempts,30);assert.equal(successes,12);assert.equal(refusals.length,18);assert.equal(nativeRefusals,3);assert.equal(successes+nativeRefusals,15);assert.equal(getterCalls,0);retained();
 const summary={result:'source-surface-knot-insertion-public-file-copy-ok',pins,totalOriginalBytes:810965,rows,admissions:admissions.map(({label,key,negativeZeroPaths,sourceTextRole,wholeNativeEqual,wholeReportEqual,inputAliases,nativeReportAliases})=>({label,key,negativeZeroPaths,sourceTextRole,wholeNativeEqual,wholeReportEqual,inputAliases,nativeReportAliases})),counts:{publicAttempts:attempts,successes,refusals:18,getterCalls,mutableReferencePairs:pairs.length,nativeRefusalOutcomes:nativeRefusals,eligibleWholeValidatorAttempts:successes+nativeRefusals},publicCalls:calls,mutableReferenceIntersections:pairs,refusals,storedNativeAuthorWork:stored,acceptedRetained:true,nativeCallEvidence:'Actual public outcome ledger plus static one matching whole-validator callsite. Fifteen is eligible-attempt arithmetic, not dynamic kernel telemetry. Stored D0/D1/strip counters retain author work; no direct consumer D0/D1/insertion/oracle calls.',scope:'Twelve complete public reader admissions, eighteen fixed refusals, four exact signed native cold files and four unchanged tensor comparison artifacts. No renderer, direct provider construction, source rewrite, tensor recomputation or new global/stored-exact certificate.'};
 save('summary.json',summary);save('telemetry.json',{calls:telemetry,elapsedMilliseconds:performance.now()-started,memory:memory()});console.log(JSON.stringify({result:summary.result,attempts,successes,refusals:18,eligibleWholeValidatorAttempts:15,getterCalls}));
}catch(error){save('first-failure.json',{error:errorReceipt(error),stack:error.stack??null,attempts,successes,nativeRefusals,getterCalls,publicCalls:calls,rows,refusals});save('telemetry-first-failure.json',{calls:telemetry,elapsedMilliseconds:performance.now()-started,memory:memory()});throw error;}

`;

const virtualEntry=resolve(examples,'source-surface-knot-insertion-private-consumer.mjs');
const bundled=await build({absWorkingDir:root,bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true,stdin:{contents:consumer,resolveDir:examples,sourcefile:virtualEntry},...(mode==='compiled'?{plugins:[plugin]}:{})});
const inputs=Object.keys(bundled.metafile.inputs).map(path=>resolve(root,path));
const otherExamples=inputs.filter(path=>(path.startsWith(resolve(root,'examples')+'/')||[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'examples')+'/')))&&path!==virtualEntry);assert.deepEqual(otherExamples,[],'Only exact own absolute virtual consumer; no old example imports');
const own=inputs.filter(path=>[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'src')+'/')||path.startsWith(resolve(item.directory,'dist')+'/'))),ownSource=own.filter(path=>path.includes('/src/')),ownCompiled=own.filter(path=>path.includes('/dist/'));
assert.ok(own.length>0);assert.equal(mode==='source'?ownCompiled.length:ownSource.length,0);
const folder=mode==='source'?'src':'dist',extension=mode==='source'?'.ts':'.js';
for(const[suffix,leaf]of [['cad-interop','source-surface-knot-insertion'],['cad-interop','source-surface-knot-insertion-json'],['cad','source-surface-knot-insertion']])assert.ok(own.includes(resolve(root,'packages/barocss-'+suffix,folder,leaf+extension)),'Actual public authority in graph: '+suffix+'/'+leaf);
const peers=inputs.filter(path=>path.includes('/node_modules/')||path.includes('/barocss-gpu/'));assert.deepEqual(peers,[],'Renderer-free public closure requires zero runtime peers');
const wrapperSource=await readFile(resolve(interop.directory,'src/nurbs/source-wide/source-surface-knot-insertion.ts'),'utf8');
const callsites=[...wrapperSource.matchAll(/validateSourceSurfaceKnotInsertion\s*\(/g)].map(match=>({offset:match.index,line:wrapperSource.slice(0,match.index).split('\n').length}));assert.equal(callsites.length,1);
const guardOffset=wrapperSource.indexOf('requireNativeSchema(native)');assert.ok(guardOffset>=0);
const nativeCallsiteEvidence={callsites,kind:'Static matching-validator callsite and guard ordering only; no instrumented runtime kernel counter',schemaGuardOffset:guardOffset,schemaGuardBeforeCall:guardOffset<callsites[0].offset};assert.equal(nativeCallsiteEvidence.schemaGuardBeforeCall,true);
await writeFile(resolve(output,'consumer-source.mjs'),consumer);await writeFile(resolve(output,'consumer.bundle.mjs'),bundled.outputFiles[0].text);await writeFile(resolve(output,'consumer-metafile.json'),JSON.stringify(bundled.metafile,null,2));
await writeFile(resolve(output,'graphs.json'),JSON.stringify({mode,node:process.version,parent,ownSource:ownSource.map(path=>relative(root,path)),ownCompiled:ownCompiled.map(path=>relative(root,path)),ownSourceCount:ownSource.length,ownCompiledCount:ownCompiled.length,peers,resolutions,nativeCallsiteEvidence,virtualEntry:relative(root,virtualEntry),otherExamples,codecHash,dedicatedCodecHash,baselineMaps:42,currentMaps:43},null,2));
const executed=spawnSync(process.execPath,['--max-old-space-size=4096','--input-type=module'],{cwd:root,input:bundled.outputFiles[0].text,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024,env:{...process.env,LOADER1374_PRODUCT_OUTPUT:output}});
await writeFile(resolve(output,'consumer.stdout'),executed.stdout??'');await writeFile(resolve(output,'consumer.stderr'),executed.stderr??'');await writeFile(resolve(output,'consumer.exit'),String(executed.status)+'\n');
await writeFile(resolve(output,'consumer.result.json'),JSON.stringify({status:executed.status,signal:executed.signal,error:executed.error?{name:executed.error.name,code:executed.error.code??null,message:executed.error.message}:null,timeoutMilliseconds:240000,heapMB:4096},null,2));process.stdout.write(executed.stdout??'');process.stderr.write(executed.stderr??'');assert.equal(executed.status,0,'FIRST public Surface knot insertion file flow failed');

if(mode==='compiled'){
 for(const entry of Object.values(interop.manifest.publishConfig.exports)){await access(resolve(interop.directory,entry.import));await access(resolve(interop.directory,entry.types));}
 const typeSource=await readFile(resolve(examples,'source-surface-knot-insertion-native-contract.ts'),'utf8'),virtualType=resolve(examples,'source-surface-knot-insertion-private-published-contract.mts');
 const compilerOptions={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,skipLibCheck:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']};
 const host=ts.createCompilerHost(compilerOptions),get=host.getSourceFile.bind(host),fileExists=host.fileExists.bind(host),readOriginal=host.readFile.bind(host),typeResolutions=[];
 host.getSourceFile=(path,version,onError,newFile)=>resolve(path)===virtualType?ts.createSourceFile(virtualType,typeSource,version,true,ts.ScriptKind.TS):get(path,version,onError,newFile);
 host.fileExists=path=>resolve(path)===virtualType||fileExists(path);host.readFile=path=>resolve(path)===virtualType?typeSource:readOriginal(path);
 host.resolveModuleNames=(names,containingFile)=>names.map(name=>{if(/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)){const path=published(name,'types');typeResolutions.push({name,importer:relative(root,containingFile),target:relative(root,path)});return{resolvedFileName:path,extension:ts.Extension.Dts,isExternalLibraryImport:true};}return ts.resolveModuleName(name,containingFile,compilerOptions,host).resolvedModule;});
 const program=ts.createProgram([virtualType],compilerOptions,host),diagnostics=ts.getPreEmitDiagnostics(program).map(item=>({code:item.code,message:ts.flattenDiagnosticMessageText(item.messageText,'\n'),file:item.file?relative(root,item.file.fileName):null}));
 const ownDeclarations=program.getSourceFiles().map(file=>resolve(file.fileName)).filter(path=>[...packages.values()].some(item=>path.startsWith(resolve(item.directory,'src')+'/')||path.startsWith(resolve(item.directory,'dist')+'/'))),sourceFallbacks=ownDeclarations.filter(path=>path.includes('/src/'));
 await writeFile(resolve(output,'published-types.json'),JSON.stringify({compiler:ts.version,strict:true,noEmit:true,skipLibCheck:true,diagnostics,sourceFallbacks,ownDeclarations:ownDeclarations.map(path=>relative(root,path)),typeResolutions,baselineMaps:42,currentMaps:43},null,2));assert.deepEqual(diagnostics,[]);assert.deepEqual(sourceFallbacks,[]);
 for(const[suffix,leaf]of [['cad-interop','source-surface-knot-insertion'],['cad','source-surface-knot-insertion']])assert.ok(ownDeclarations.includes(resolve(root,'packages/barocss-'+suffix,'dist',leaf+'.d.ts')),'Actual published selected declarations required');
}
console.log(JSON.stringify({mode,runtime:mode==='source'?'ordinary public source':'actual published emitted JS',types:mode==='compiled'?'strict selected emitted declarations':'unrun'}));
