import assert from 'node:assert/strict';
import {access,mkdir,readFile,writeFile,statfs,realpath} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const SELF=fileURLToPath(import.meta.url),EXAMPLES=dirname(SELF),ROOT=resolve(EXAMPLES,'../../..');
const PARENT='13e5cea743d80763841661d0230eb647a040d352';
const PREFIX='exact-paired-vlinear-surface-intersection-result',ENTRY='@barocss/cad-interop/'+PREFIX;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const within=(file,directory)=>file===directory||file.startsWith(directory+'/');
async function exists(file){try{await access(file);return true;}catch(error){if(error.code!=='ENOENT')throw error;return false;}}
async function filePin(file){const bytes=await readFile(file);return{file:relative(ROOT,file),bytes:bytes.length,sha256:hash(bytes)};}
function git(...args){const result=spawnSync('git',args,{cwd:ROOT,encoding:'utf8',timeout:30000,maxBuffer:16*1024*1024});assert.equal(result.status,0,result.stderr||'Immutable Git read failed');return result.stdout;}
function retainedManifest(current,expected){
  for(const [actual,old] of [[current.exports,expected.exports],[current.publishConfig.exports,expected.publishConfig.exports]]){
    const oldKeys=Object.keys(old);assert.deepEqual(Object.keys(actual).filter(key=>Object.hasOwn(old,key)),oldKeys,'Original and selected map relative order');
    for(const key of oldKeys)assert.deepEqual(actual[key],old[key],'Retained map value '+key);
  }
  assert.deepEqual(Object.keys(current.exports),Object.keys(current.publishConfig.exports),'Current development/published keys agree');
  assert.deepEqual({...current,exports:expected.exports,publishConfig:{...current.publishConfig,exports:expected.publishConfig.exports}},expected,'Only independently added maps may differ');
}

const common=String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseBaroCadExactPairedVLinearSurfaceIntersectionResult as parse,readBaroCadExactPairedVLinearSurfaceIntersectionResult as read,
  BaroCadExactPairedVLinearSurfaceIntersectionReadError as ReadError,BaroCadExactPairedVLinearSurfaceIntersectionDiagnosticCode as DiagnosticCode}
  from '@barocss/cad-interop/exact-paired-vlinear-surface-intersection-result';
import {ExactPairedVLinearSurfaceIntersectionError as NativeError} from '@barocss/cad';
const directory=process.env.LOADER1505_DATA_DIRECTORY;
const cases=[{key:'main',file:'main-result.json'},{key:'edited',file:'edited-result.json'}];
const pins=[
 {file:'main-result.json',bytes:24608,sha256:'63b19b6f27a0ca4933ba4128b2a0654f1e67666e2aac8ae6432f5e1fb1173b08'},
 {file:'edited-result.json',bytes:25608,sha256:'a7e4186f7f001c2258e11b1658072ce852adf7fef1a52825ecd97310a92647f2'},
 {file:'main-request.json',bytes:2096,sha256:'8c0911c7f73259f95998ae81882c47b962322c6b99bd91b74f323c74d53ea9b0'},
 {file:'edited-request.json',bytes:2104,sha256:'556f61703cdf2371be98b2940b3ac28b93ad658121822b55e98021f8082ddf80'},
];
const profile={schema:'barocss-exact-paired-vlinear-surface-intersection-result-ingestion',version:0,nativeSchema:'barocss-exact-paired-vlinear-surface-intersection-report',nativeVersion:0,
 sourceFrame:'authored-xyz-no-axis-conversion',worldLengthUnit:'mm',uvLengthUnit:'dimensionless',parameterFrame:'original-a-u',sourceQualification:'original-source-id-asset-index-and-model-object-index',ownership:'independent-copied-cpu-data-gc',
 limits:{utf8Bytes:4194304,utf16Units:4194304,values:1048576,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128},
 capabilities:{nativeWholeValidation:true,copiedWholeReceipt:true,renderer:false,url:false,byteInput:false,publicSerializer:false,dispose:false,sourceEdit:false,sampling:false,intersectionConstruction:false,genericIntersection:false,allBranchesOutsideInterval:false,trimFace:false,topology:false,body:false,solid:false,globalError:false,manufacturing:false,persistentNaming:false,editor:false,publication:false}};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const signed=(value,space)=>JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+'\n';
const save=(file,value)=>writeFileSync(resolve(output,file),signed(value,2),{flag:'wx'});
function same(a,b,path='$',ordered=true){
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Whole value/sign mismatch '+path);return;}
 assert.equal(Array.isArray(a),Array.isArray(b),path+' rank');const ak=Object.keys(a),bk=Object.keys(b);
 if(ordered||Array.isArray(a))assert.deepEqual(ak,bk,path+' ordered keys');else{assert.equal(ak.length,bk.length);for(const key of ak)assert.ok(Object.hasOwn(b,key),path+' key '+key);}
 for(const key of ak)same(a[key],b[key],path+'.'+key,ordered);
}
function refs(value,set=new Set(),mutable=false){if(value&&typeof value==='object'&&!set.has(value)){if(mutable&&Object.isFrozen(value))return set;set.add(value);for(const item of Object.values(value))refs(item,set,mutable);}return set;}
function intersect(a,b){let n=0;for(const value of a)if(b.has(value))n++;return n;}
function zeros(value,path='$',out=[]){if(typeof value==='number'&&Object.is(value,-0))out.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))zeros(item,path+'.'+key,out);return out;}
function frozen(value,seen=new Set()){if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);assert.ok(Object.isFrozen(value));for(const item of Object.values(value))frozen(item,seen);}}
function errorReceipt(error,depth=0){
 const object=error!==null&&(typeof error==='object'||typeof error==='function'),value={name:object?(error.name??null):null,code:object?(error.code??null):null,message:object?(error.message??String(error)):String(error),thrownType:error===null?'null':typeof error,causeOwn:object&&Object.hasOwn(error,'cause')};
 if(object&&error.context!==undefined)value.context=structuredClone(error.context);
 if(value.causeOwn){const cause=error.cause;value.causeKind=cause===undefined?'undefined':cause===null?'null':typeof cause;if(cause instanceof Error&&depth<16)value.cause=errorReceipt(cause,depth+1);else if(cause!==undefined)value.cause=cause;}
 return value;
}
function pin(bytes,expected){assert.equal(bytes.length,expected.bytes,expected.file);assert.equal(hash(bytes),expected.sha256,expected.file);}
function digest(read){return{native:hash(Buffer.from(signed(read.native))),report:hash(Buffer.from(signed(read.validationReport))),profile:hash(Buffer.from(signed(read.profile))),sourceText:read.sourceText===null?null:hash(Buffer.from(read.sourceText)),whole:hash(Buffer.from(signed(read)))};}
function point(value){assert.ok(Array.isArray(value));assert.equal(value.length,3);for(const n of value)assert.ok(Number.isFinite(n));}
function nativeFacts(native){
 assert.deepEqual(Object.keys(native),['request','originalModels','world','pcurves','proof','observations','report']);
 const{request,report}=native;assert.deepEqual(Object.keys(request),['assets','uAInterval','options']);
 assert.deepEqual(Object.keys(request.options),['evaluationId','worldCurveId','pcurveAId','pcurveBId','maximumObservations']);assert.equal(request.options.maximumObservations,5);
 assert.equal(request.assets.length,2);same(native.originalModels.map(model=>model.objects.length),[3,3]);same(native.originalModels.map(model=>model.name),['intersection_model','intersection_model']);
 assert.equal(report.schema,'barocss-exact-paired-vlinear-surface-intersection-report');assert.equal(report.version,0);assert.equal(native.proof.schema,'barocss-exact-paired-vlinear-surface-intersection');assert.equal(native.proof.version,0);
 for(let index=0;index<2;index++){
  const asset=request.assets[index],model=native.originalModels[index],selection=report.selections[index],objectIndex=index===0?1:2,uv=native.pcurves[index===0?'a':'b'];
  assert.deepEqual(Object.keys(asset),['sourceId','source','surface']);assert.equal(typeof asset.source,'string');assert.equal(selection.assetIndex,index);assert.equal(selection.sourceId,asset.sourceId);
  assert.equal(selection.sourceField,'request.assets['+index+'].source');assert.equal(selection.modelField,'originalModels['+index+']');assert.equal(selection.objectIndex,objectIndex);assert.equal(selection.modelName,model.name);assert.equal(selection.surfaceId,'support');same(model.objects[objectIndex],asset.surface);
  assert.ok(model.objects.some(x=>x.kind==='curve'&&x.id==='curve_sibling'));assert.ok(model.objects.some(x=>x.kind==='surface'&&x.id==='native_wide_sibling'));
  same(uv.support,selection);assert.equal(uv.coordinateSystem,'original-native-uv');assert.equal(uv.lengthUnit,'dimensionless');assert.equal(uv.parameterFrame,'original-a-u');assert.equal(uv.embeddedZ,0);assert.equal(uv.curve.degree,4);assert.equal(uv.curve.controlPoints.length,5);assert.equal(uv.curve.knots.length,10);
 }
 assert.notEqual(request.assets[0].sourceId,request.assets[1].sourceId);assert.equal(native.world.sourceVersion,0);assert.equal(typeof native.world.source,'string');assert.equal(native.world.model.objects.length,1);same(native.world.model.objects[0],native.world.curve);
 assert.equal(native.world.curve.degree,4);assert.equal(native.world.curve.controlPoints.length,5);assert.equal(native.world.curve.knots.length,10);assert.equal(native.observations.length,5);
 for(let index=0;index<5;index++){
  const row=native.observations[index];assert.equal(row.index,index);assert.ok(Number.isFinite(row.parameter));
  for(const key of ['world','pcurveA','pcurveB']){point(row[key].d0);assert.deepEqual(Object.keys(row[key].d1),['point','derivative']);point(row[key].d1.point);point(row[key].d1.derivative);}
  for(const key of ['surfaceA','surfaceB']){point(row[key].d0);assert.deepEqual(Object.keys(row[key].d1),['point','du','dv']);for(const field of ['point','du','dv'])point(row[key].d1[field]);}point(row.chainA);point(row.chainB);
 }
 const trueFlags=['exactStoredCoefficientBinding','bothOriginalUVPreserved','completeOriginalSourcesRetained','uniqueOnAdmittedInterval','exactWholeModelGapZero','nativeObservationsSeparate'];for(const[field,value]of Object.entries(report.quality))if(typeof value==='boolean')assert.equal(value,trueFlags.includes(field));
 assert.equal(report.sourceFrame,'authored-xyz-no-axis-conversion');assert.equal(report.worldLengthUnit,'mm');assert.equal(report.uvLengthUnit,'dimensionless');assert.equal(report.parameterFrame,'original-a-u');assert.equal(report.quality.ownership,'independent-copied-cpu-data-gc');
 const paths=zeros(native);same(paths,['$.originalModels.0.objects.0.controlPoints.0.0','$.originalModels.0.objects.2.controlPoints.0.0.2','$.originalModels.1.objects.0.controlPoints.0.0.2','$.originalModels.1.objects.1.controlPoints.0.0']);
 return{modelObjectCounts:[3,3],selections:structuredClone(report.selections),observationCount:5,negativeZeroCount:paths.length,storedNativeAuthorCounts:structuredClone(report.directCounts),quality:structuredClone(report.quality),limits:structuredClone(report.limits),workScope:report.workScope};
}
function check(read,literal,text){
 assert.deepEqual(Object.keys(read),['native','validationReport','profile','sourceText']);same(read.native,literal);same(read.validationReport,literal.report);same(read.profile,profile);frozen(read.profile);assert.equal(read.sourceText,text);
 assert.equal(Object.isFrozen(read.native),false);assert.equal(Object.isFrozen(read.validationReport),false);assert.equal(intersect(refs(read.native),refs(read.validationReport)),0);same(zeros(read.native),zeros(literal));return nativeFacts(read.native);
}
`;

const primary=String.raw`
const output=process.env.LOADER1505_PRODUCT_OUTPUT,rows=[],admissions=[],pairs=[],calls=[],refusals=[],telemetry=[],originals=new Map();
let attempts=0,successes=0,nativeRefusals=0,getterCalls=0,last='boot';
function invoke(entry,input,label,eligible){
 last=label;const call={index:++attempts,entry,label,eligibleWholeAttempt:eligible,outcome:'pending'},before=process.memoryUsage(),start=performance.now();calls.push(call);
 try{const readValue=entry==='parse'?parse(input):read(input);successes++;call.outcome='accepted';return readValue;}
 catch(error){call.outcome='refused';call.error=errorReceipt(error);throw error;}
 finally{telemetry.push({index:attempts,label,elapsedMilliseconds:performance.now()-start,before,after:process.memoryUsage()});}
}
function remember(result,literal,input,text,key,label){
 save('admission-first-'+label.replace(':','-')+'.json',{key,label,actualRead:result,call:calls.at(-1)});
 const facts=check(result,literal,text);for(const tree of [result.native,result.validationReport])assert.equal(intersect(refs(tree),refs(input)),0);
 const mutable=refs(result,new Set(),true);for(const previous of admissions){const count=intersect(mutable,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}
 admissions.push({label,key,result,mutable,negativeZeroPaths:zeros(result.native),sourceTextRole:text===null?'owned-null':'exact-text',digest:digest(result)});return facts;
}
try{
 assert.ok(output&&directory&&isAbsolute(output)&&isAbsolute(directory));assert.equal(pins.reduce((n,row)=>n+row.bytes,0),54416);same(Object.keys(DiagnosticCode).sort(),['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'].sort());
 for(const expected of pins){const bytes=readFileSync(resolve(directory,expected.file));pin(bytes,expected);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);originals.set(expected.file,{pin:expected,text,literal:JSON.parse(text)});}
 for(const descriptor of cases){
  const original=originals.get(descriptor.file),literal=original.literal,parsed=invoke('parse',original.text,descriptor.key+':text',true),facts=remember(parsed,literal,original.text,original.text,descriptor.key,descriptor.key+':text');
  const owned=invoke('read',literal,descriptor.key+':owned',true);remember(owned,literal,literal,null,descriptor.key,descriptor.key+':owned');
  const readsBefore=structuredClone([parsed,owned]),before=literal.proof.version;assert.equal(before,0);literal.proof.version=1;assert.ok(!Object.is(literal.proof.version,before));same([parsed,owned],readsBefore);literal.proof.version=before;same(parsed.native,literal);
  const bytes=Buffer.from(signed(parsed.native));pin(bytes,original.pin);writeFileSync(resolve(output,descriptor.file),bytes,{flag:'wx'});assert.equal(readFileSync(resolve(output,descriptor.file),'utf8'),original.text);
  rows.push({key:descriptor.key,native:parsed.native,validationReport:parsed.validationReport,profile:parsed.profile,sourceText:parsed.sourceText,resultPin:original.pin,savedPin:original.pin,negativeZeroPaths:zeros(parsed.native),nativeFacts:facts,
   callerMutation:{path:'$.proof.version',before,after:1,submittedToNative:false,restored:true,acceptedRetained:true}});
 }
 assert.equal(successes,4);assert.equal(pairs.length,6);
 const requests=Object.fromEntries(cases.map(({key})=>{const original=originals.get(key+'-request.json'),value=structuredClone(original.literal);same(value,original.literal);assert.equal(intersect(refs(value),refs(original.literal)),0);same(value,rows.find(row=>row.key===key).native.request,'$.request-association',false);same(zeros(value),[]);return[key,value];}));
 const comparisonData={requests,nativeAdmissions:0,editorCalls:0,association:'Same object key membership/Object.is values; arrays ordered. Original/copy/saved evidence retains its own order.'};
 const dataBefore=structuredClone(comparisonData),dataRefs=refs(comparisonData),accepted=admissions.map(row=>row.result),before=structuredClone(accepted),acceptedRefs=refs(accepted),signs=zeros(accepted);
 function retained(){
  same(accepted,before);const now=refs(accepted);assert.equal(now.size,acceptedRefs.size);for(const item of now)assert.ok(acceptedRefs.has(item));same(zeros(accepted),signs);
  same(comparisonData,dataBefore);const dataNow=refs(comparisonData);assert.equal(dataNow.size,dataRefs.size);for(const item of dataNow)assert.ok(dataRefs.has(item));
  for(const expected of pins)pin(readFileSync(resolve(directory,expected.file)),expected);for(const row of rows)pin(readFileSync(resolve(output,row.savedPin.file)),row.savedPin);
 }
 const main=rows[0].native;
 function refuse(name,entry,input,code,message,eligible=false,path=null){
  let error,threw=false,unexpectedRead;const prior=successes;
  try{unexpectedRead=invoke(entry,input,name,eligible);}catch(cause){threw=true;error=cause;}
  const receipt={name,entry,threw,error:threw?errorReceipt(error):null,getterCalls,eligibleWholeAttempt:eligible,path,acceptedRetained:false,failedMetrics:null,...(!threw?{unexpectedRead}:{})};
  refusals.push(receipt);save('refusal-first-'+String(refusals.length).padStart(2,'0')+'.json',receipt);
  assert.equal(threw,true,'Unexpected public acceptance; stop and retain FIRST');assert.ok(error instanceof ReadError);assert.equal(error.code,code);assert.equal(error.message,message);assert.ok(error.message.length<=1024);
  if(eligible){
   assert.equal(Object.hasOwn(error,'cause'),true);assert.ok(error.cause instanceof NativeError);assert.equal(error.cause.code,'OWNED');assert.equal(error.cause.message,'Exact paired V-linear intersection: Complete original sources/Models/World/UVs/coefficients/observations/counts/report differ from reconstruction');
   same(error.cause.context,{phase:'owned',assetIndex:null,stationIndex:null,directCounts:main.report.directCounts});assert.equal(Object.hasOwn(error.cause,'cause'),false);nativeRefusals++;
  }else assert.equal(Object.hasOwn(error,'cause'),false,'Selected direct early/codec errors have no cause');
  assert.equal(successes,prior);assert.equal(getterCalls,0);retained();receipt.acceptedRetained=true;save('refusal-'+String(refusals.length).padStart(2,'0')+'.json',receipt);
 }
 const nativeMessage='Whole native exact paired V-linear Surface intersection validation refused the copied data';
 const mutations=[
  {name:'world-source-space',path:'$.world.source',before:main.world.source,after:main.world.source+' ',change(value){same(value.world.source,main.world.source);value.world.source+=' ';}},
  {name:'pcurve-a-namespace',path:'$.pcurves.a.support.assetIndex',before:0,after:1,change(value){assert.equal(value.pcurves.a.support.assetIndex,0);value.pcurves.a.support.assetIndex=1;}},
  {name:'false-solid',path:'$.report.quality.solid',before:false,after:true,change(value){assert.equal(value.report.quality.solid,false);value.report.quality.solid=true;}},
 ];
 save('mutation-plan.json',{mutations:mutations.map(({name,path,before,after})=>({name,path,before,after})),primaryEligibleAttempts:7,freshChildEligibleAttempts:2,scope:'Three frozen nonnoop MAIN whole changes; no request/producer changes'});
 for(const mutation of mutations){const value=structuredClone(main);mutation.change(value);assert.ok(!Object.is(mutation.before,mutation.after));same(value.request,main.request);const snapshot=structuredClone(value);refuse(mutation.name,'read',value,'NATIVE',nativeMessage,true,mutation.path);same(value,snapshot);}
 refuse('parse-kind','parse',{},'INPUT','Exact paired V-linear Surface intersection result text must be a string');
 refuse('read-array','read',[],'INPUT','Exact paired V-linear Surface intersection result owned data must be a record');
 refuse('empty-root','read',{},'SCHEMA','A complete exact paired V-linear Surface intersection result record with the exact seven fields is required');
 const wrongSchema=structuredClone(main);wrongSchema.report.schema='unsupported';refuse('report-schema','read',wrongSchema,'SCHEMA','The native exact paired V-linear Surface intersection report schema and version 0 are required');
 refuse('decoded-duplicate','parse','{"k":0,"\\u006b":1}','JSON','Duplicate decoded JSON key');
 refuse('lone-unicode','parse','{"k":"\\ud800"}','JSON','Unpaired Unicode surrogate refused');
 refuse('nonfinite-number','parse','{"k":1e400}','JSON','Nonfinite JSON number refused');
 const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){getterCalls++;return 1;}});refuse('enumerable-getter','read',getter,'OWNED','Getter or hidden own data refused');
 const symbolic={};symbolic[Symbol('key')]=1;refuse('symbol-key','read',symbolic,'OWNED','Symbolic own keys refused');
 const cycle={};cycle.self=cycle;refuse('ancestor-cycle','read',cycle,'OWNED','Own ancestor cycle refused');
 refuse('record-occurrence-budget','read',{chunks:Array.from({length:128},()=>Array(8192).fill(0))},'BUDGET','Owned occurrence/depth budget exceeded');
 assert.equal(attempts,18);assert.equal(successes,4);assert.equal(refusals.length,14);assert.equal(nativeRefusals,3);assert.equal(calls.filter(call=>call.eligibleWholeAttempt).length,7);retained();
 const childOutput=resolve(output,'fresh-process');mkdirSync(childOutput);const childBundle=process.env.LOADER1505_CHILD_BUNDLE;assert.ok(childBundle&&isAbsolute(childBundle));
 const childArgs=['--max-old-space-size=4096',childBundle],spawned=spawnSync(process.execPath,childArgs,{cwd:process.cwd(),encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,
  env:{...process.env,LOADER1505_CHILD_OUTPUT:childOutput,LOADER1505_SAVED_DIRECTORY:output,LOADER1505_PRIMARY_PID:String(process.pid)}});
 writeFileSync(resolve(childOutput,'first.stdout'),spawned.stdout??'',{flag:'wx'});writeFileSync(resolve(childOutput,'first.stderr'),spawned.stderr??'',{flag:'wx'});writeFileSync(resolve(childOutput,'first.exit'),String(spawned.status)+'\n',{flag:'wx'});
 save('fresh-process-execution.json',{command:[process.execPath,...childArgs],primaryPID:process.pid,pid:spawned.pid??null,status:spawned.status,signal:spawned.signal,error:spawned.error?errorReceipt(spawned.error):null,timeoutMilliseconds:180000,heapMiB:4096,maxBufferBytes:16*1024*1024,scope:'Actual separate Node22 child; not same-process reset'});
 process.stdout.write(spawned.stdout??'');process.stderr.write(spawned.stderr??'');assert.equal(spawned.status,0,'FIRST fresh child public parse failed');
 const child=JSON.parse(readFileSync(resolve(childOutput,'summary.json'),'utf8'));assert.notEqual(child.pid,process.pid);assert.equal(child.parentPID,process.pid);assert.equal(child.ppid,process.pid);assert.equal(child.node,process.version);same(child.execArgv,process.execArgv);assert.equal(child.attempts,2);assert.equal(child.successes,2);assert.equal(child.mutablePairs.length,1);
 for(const row of child.rows){const normative=rows.find(value=>value.key===row.key);same(row.read,{native:normative.native,validationReport:normative.validationReport,profile:normative.profile,sourceText:normative.sourceText});same(row.digest,digest(row.read));same(row.negativeZeroPaths,normative.negativeZeroPaths);}
 assert.ok(child.mutablePairs.every(pair=>pair.count===0));retained();
 const counts={primaryAttempts:18,primarySuccesses:4,primaryRefusals:14,primaryEligibleWholeAttempts:7,freshChildAttempts:2,freshChildSuccesses:2,freshChildEligibleWholeAttempts:2,
  combinedAttempts:20,combinedSuccesses:6,combinedRefusals:14,combinedEligibleWholeAttempts:9,primaryMutablePairs:6,childMutablePairs:1,getterCalls};
 save('summary.json',{result:'exact-paired-vlinear-surface-public-file-copy-freshprocess-ok',pins,totalOriginalBytes:54416,rows,comparisonData,
  admissions:admissions.map(({label,key,negativeZeroPaths,sourceTextRole,digest})=>({label,key,negativeZeroPaths,sourceTextRole,digest})),freshChildRows:child.rows,counts,
  publicCalls:calls,freshChildCalls:child.calls,refusals,mutablePairs:pairs,childMutablePairs:child.mutablePairs,acceptedRetained:true,
  callEvidence:'Public attempt ledgers and one static matching callsite. Eligible arithmetic is not dynamic instrumentation of inherited native reconstruction/compilation/observations. No cross-process reference equality claim.',
  failedMetricScope:'Reader throws expose no partial codec metrics; failedMetrics null records unavailable data, never zero work.'});
 save('telemetry.json',{calls:telemetry,primaryPID:process.pid,childPID:child.pid,finalMemory:process.memoryUsage()});console.log(JSON.stringify({ok:true,...counts}));
}catch(error){save('first-failure.json',{error:errorReceipt(error),stack:error?.stack??null,last,attempts,successes,nativeRefusals,getterCalls,calls,rows,refusals});throw error;}
`;

const child=String.raw`
const output=process.env.LOADER1505_CHILD_OUTPUT,saved=process.env.LOADER1505_SAVED_DIRECTORY,parentPID=Number(process.env.LOADER1505_PRIMARY_PID),rows=[],accepted=[],mutablePairs=[],calls=[];
let attempts=0,successes=0;
try{
 assert.ok(output&&saved&&directory&&isAbsolute(output)&&isAbsolute(saved)&&isAbsolute(directory));assert.ok(Number.isInteger(parentPID));assert.notEqual(process.pid,parentPID);assert.equal(process.ppid,parentPID);
 for(const descriptor of cases){
  const expected=pins.find(row=>row.file===descriptor.file),bytes=readFileSync(resolve(saved,descriptor.file)),original=readFileSync(resolve(directory,descriptor.file));pin(bytes,expected);pin(original,expected);assert.ok(bytes.equals(original));
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),literal=JSON.parse(text),call={index:++attempts,key:descriptor.key,entry:'parse',eligibleWholeAttempt:true,outcome:'pending'};calls.push(call);let result;
  try{result=parse(text);successes++;call.outcome='accepted';}catch(error){call.outcome='refused';call.error=errorReceipt(error);throw error;}
  save('admission-first-'+descriptor.key+'.json',{key:descriptor.key,actualRead:result,call});check(result,literal,text);assert.equal(intersect(refs(result.native),refs(literal)),0);assert.equal(intersect(refs(result.validationReport),refs(literal)),0);
  const mutable=refs(result,new Set(),true);for(const previous of accepted){const count=intersect(mutable,previous.mutable);assert.equal(count,0);mutablePairs.push({left:descriptor.key,right:previous.key,count});}
  accepted.push({key:descriptor.key,mutable});rows.push({key:descriptor.key,read:result,savedPin:expected,negativeZeroPaths:zeros(result.native),digest:digest(result),sourceTextRole:'exact-text',fullNativeReportObjectIs:true,profileDeepFrozen:true});
 }
 assert.equal(attempts,2);assert.equal(successes,2);assert.equal(mutablePairs.length,1);
 save('summary.json',{pid:process.pid,ppid:process.ppid,parentPID,node:process.version,execArgv:process.execArgv,attempts,successes,rows,calls,mutablePairs,scope:'Two actual public parse admissions from authentic saved files in a genuine new process'});
 console.log(JSON.stringify({childPID:process.pid,attempts,successes}));
}catch(error){save('first-failure.json',{error:errorReceipt(error),stack:error?.stack??null,attempts,successes,calls,rows});throw error;}
`;

export async function main(argv=process.argv.slice(2)){
  assert.equal(Number(process.versions.node.split('.')[0]),22);assert.equal(argv.length,3);assert.equal(argv[1],'--output');assert.ok(isAbsolute(argv[2]));
  const mode=argv[0]==='--source'?'source':argv[0]==='--emitted'?'emitted':null;assert.ok(mode,'Use --source or --emitted');
  const output=resolve(argv[2]);assert.equal(within(output,ROOT),false,'Output outside product tree');assert.equal(await exists(output),false,'Fresh FIRST output only');
  await mkdir(output,{recursive:true});const save=(file,value)=>writeFile(resolve(output,file),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
  await save('command.json',{argv:process.argv,cwd:process.cwd(),root:ROOT,node:process.version,mode,parent:PARENT,pid:process.pid});
  const packages=new Map(),resolutions=[];
  try{
    const disk=await statfs(output);assert.ok(disk.bavail*disk.bsize>=512*1024*1024,'512MiB output reserve');git('merge-base','--is-ancestor',PARENT,'HEAD');
    for(const suffix of ['cad','cad-interop']){
      const directory=resolve(ROOT,'packages/barocss-'+suffix),manifest=JSON.parse(await readFile(resolve(directory,'package.json'),'utf8'));
      const baseline=JSON.parse(git('show',PARENT+':packages/barocss-'+suffix+'/package.json')),expected=structuredClone(baseline);
      if(suffix==='cad-interop'){
        assert.equal(Object.keys(baseline.exports).length,51);assert.equal(Object.keys(baseline.publishConfig.exports).length,51);
        expected.exports['./'+PREFIX]={types:'./src/'+PREFIX+'.ts',import:'./src/'+PREFIX+'.ts'};
        expected.publishConfig.exports['./'+PREFIX]={types:'./dist/'+PREFIX+'.d.ts',import:'./dist/'+PREFIX+'.js'};
      }
      retainedManifest(manifest,expected);if(mode==='source')assert.equal(await exists(resolve(directory,'dist')),false,'Source FIRST before own library builds');
      packages.set('@barocss/'+suffix,{directory,manifest,baseline});
    }
    const interop=packages.get('@barocss/cad-interop'),importer=createRequire(resolve(interop.directory,'package.json'));
    const codecHash=hash(await readFile(resolve(interop.directory,'src/qualified-body-json.ts')));assert.equal(codecHash,'451ea4d17c7afce5adf9f5f81c33de3f96eafca297631cac2f73afd437ff1683');
    const dedicatedCodecPin=await filePin(resolve(interop.directory,'src/'+PREFIX+'-json.ts'));
    function published(specifier,field){
      const name=specifier.split('/').slice(0,2).join('/'),item=packages.get(name),tail=specifier.slice(name.length),key=tail?'.'+tail:'.';
      const target=item?.manifest.publishConfig?.exports?.[key]?.[field];assert.ok(typeof target==='string'&&target.startsWith('./dist/'),'Actual published '+field+' required '+specifier);
      const file=resolve(item.directory,target);assert.ok(within(file,resolve(item.directory,'dist')));return file;
    }
    const publishedPlugin={name:'actual-published-exact-paired-vlinear-result',setup(builder){builder.onResolve({filter:/^@barocss\/(cad|cad-interop)(\/|$)/},args=>{
      const file=published(args.path,'import');resolutions.push({specifier:args.path,importer:relative(ROOT,args.importer),target:relative(ROOT,file),field:'import'});return{path:file};
    });}};
    const {build}=importer('esbuild');
    async function graph(metafile,virtual){
      const rawInputNames=Object.keys(metafile.inputs),inputs=rawInputNames.map(name=>resolve(ROOT,name));
      assert.ok(inputs.includes(virtual),'Absolute virtual self entry required');
      const own=inputs.filter(file=>[...packages.values()].some(item=>within(file,resolve(item.directory,mode==='source'?'src':'dist'))));
      assert.ok(own.length>0);assert.ok(inputs.every(file=>own.includes(file)||file===virtual),'No peers/private/old examples/DIST/source fallback');
      for(const file of own)assert.equal(await realpath(file),file,'Actual physical own path');
      const source=inputs.filter(file=>[...packages.values()].some(item=>within(file,resolve(item.directory,'src'))));
      const emitted=inputs.filter(file=>[...packages.values()].some(item=>within(file,resolve(item.directory,'dist'))));assert.equal(mode==='source'?emitted.length:source.length,0);
      const ext=mode==='source'?'.ts':'.js',folder=mode==='source'?'src':'dist';
      for(const[suffix,leaf]of [['cad-interop',PREFIX],['cad-interop',PREFIX+'-json'],['cad','exact-paired-vlinear-surface-intersection']])assert.ok(own.includes(resolve(ROOT,'packages/barocss-'+suffix,folder,leaf+ext)),'Actual family leaf '+leaf);
      const externalImports=Object.values(metafile.inputs).flatMap(row=>row.imports.filter(item=>item.external).map(item=>item.path));
      for(const specifier of externalImports)assert.ok(['node:assert/strict','node:fs','node:path','node:crypto','node:child_process'].includes(specifier),'Only actual declared Node builtin '+specifier);
      const filePins=[];for(const file of own)filePins.push(await filePin(file));
      return{rawInputNames,absoluteVirtualEntry:virtual,ownSource:source.map(file=>relative(ROOT,file)),ownEmitted:emitted.map(file=>relative(ROOT,file)),ownSourceCount:source.length,ownEmittedCount:emitted.length,aliases:false,peers:[],privateModules:[],externalImports,filePins};
    }
    const primaryEntry=resolve(EXAMPLES,PREFIX+'-private-primary-consumer.mjs'),childEntry=resolve(EXAMPLES,PREFIX+'-private-fresh-consumer.mjs');
    const primaryText=common+primary,childText=common+child;
    await writeFile(resolve(output,'primary-source.mjs'),primaryText,{flag:'wx'});await writeFile(resolve(output,'fresh-child-source.mjs'),childText,{flag:'wx'});
    const prepare=(text,entry)=>build({absWorkingDir:ROOT,bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true,stdin:{contents:text,resolveDir:EXAMPLES,sourcefile:entry},...(mode==='emitted'?{plugins:[publishedPlugin]}:{})});
    const primaryBundle=await prepare(primaryText,primaryEntry),primaryGraph=await graph(primaryBundle.metafile,primaryEntry),childBundle=await prepare(childText,childEntry),childGraph=await graph(childBundle.metafile,childEntry);
    assert.equal(primaryBundle.outputFiles.length,1);assert.equal(childBundle.outputFiles.length,1);
    const primaryPath=resolve(output,'primary.bundle.mjs'),childPath=resolve(output,'fresh-child.bundle.mjs');
    await writeFile(primaryPath,primaryBundle.outputFiles[0].contents,{flag:'wx'});await writeFile(childPath,childBundle.outputFiles[0].contents,{flag:'wx'});
    await save('primary-metafile.json',primaryBundle.metafile);await save('fresh-child-metafile.json',childBundle.metafile);
    const wrapperPath=resolve(interop.directory,'src/'+PREFIX+'.ts'),wrapper=await readFile(wrapperPath,'utf8');
    const callsites=[...wrapper.matchAll(/validateExactPairedVLinearSurfaceIntersection\s*\(/g)].map(match=>({offset:match.index,line:wrapper.slice(0,match.index).split('\n').length}));
    const guardOffset=wrapper.indexOf('requireNativeSchema(native)');assert.equal(callsites.length,1);assert.ok(guardOffset>=0&&guardOffset<callsites[0].offset);
    await save('graphs.json',{mode,parent:PARENT,node:process.version,primary:primaryGraph,freshChild:childGraph,resolutions,codecHash,dedicatedCodecPin,
      baselineMaps:51,currentMaps:Object.keys(interop.manifest.exports).length,staticWholeCallEvidence:{callsites,guardBeforeCall:true,scope:'One static matching callsite plus actual public attempt ledgers; not inherited kernel telemetry'}});
    const started=Date.now(),executed=spawnSync(process.execPath,['--max-old-space-size=4096',primaryPath],{cwd:ROOT,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,
      env:{...process.env,LOADER1505_PRODUCT_OUTPUT:output,LOADER1505_CHILD_BUNDLE:childPath,LOADER1505_DATA_DIRECTORY:resolve(EXAMPLES,PREFIX+'-data')}});
    await writeFile(resolve(output,'primary.stdout'),executed.stdout??'',{flag:'wx'});await writeFile(resolve(output,'primary.stderr'),executed.stderr??'',{flag:'wx'});await writeFile(resolve(output,'primary.exit'),String(executed.status)+'\n',{flag:'wx'});
    await save('primary-execution.json',{status:executed.status,signal:executed.signal,pid:executed.pid??null,error:executed.error?{name:executed.error.name,code:executed.error.code??null,message:executed.error.message}:null,heapMiB:4096,timeoutMilliseconds:180000,maxBufferBytes:16*1024*1024,elapsedMilliseconds:Date.now()-started});
    process.stdout.write(executed.stdout??'');process.stderr.write(executed.stderr??'');assert.equal(executed.status,0,'FIRST public primary/fresh-child flow failed');
    if(mode==='emitted'){
      const mapPins=[];
      for(const [name,item]of packages)for(const [key,pair]of Object.entries(item.manifest.publishConfig.exports))for(const field of ['import','types']){
        const specifier=name+(key==='.'?'':key.slice(1)),file=published(specifier,field);mapPins.push({package:name,key,field,...await filePin(file)});
      }
      const typeFile=resolve(EXAMPLES,PREFIX+'-contract.ts'),typeSource=await readFile(typeFile,'utf8'),physicalTypeSourcePin=await filePin(typeFile),virtual=resolve(EXAMPLES,PREFIX+'-private-published-contract.mts');
      await writeFile(resolve(output,'published-type-consumer.mts'),typeSource,{flag:'wx'});
      const ts=importer('typescript'),options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,skipLibCheck:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']};
      const host=ts.createCompilerHost(options),originalGet=host.getSourceFile.bind(host),originalExists=host.fileExists.bind(host),originalRead=host.readFile.bind(host),typeResolutions=[];
      host.getSourceFile=(file,languageVersion,onError,createNew)=>resolve(file)===virtual?ts.createSourceFile(virtual,typeSource,languageVersion,true,ts.ScriptKind.TS):originalGet(file,languageVersion,onError,createNew);
      host.fileExists=file=>resolve(file)===virtual||originalExists(file);host.readFile=file=>resolve(file)===virtual?typeSource:originalRead(file);
      host.resolveModuleNames=(names,containing)=>names.map(specifier=>{
        if(/^@barocss\/(cad|cad-interop)(\/|$)/.test(specifier)){const file=published(specifier,'types');typeResolutions.push({specifier,importer:relative(ROOT,containing),target:relative(ROOT,file),field:'types'});return{resolvedFileName:file,extension:ts.Extension.Dts,isExternalLibraryImport:true};}
        return ts.resolveModuleName(specifier,containing,options,host).resolvedModule;
      });
      const program=ts.createProgram([virtual],options,host),diagnostics=ts.getPreEmitDiagnostics(program).map(item=>({code:item.code,message:ts.flattenDiagnosticMessageText(item.messageText,'\n'),file:item.file?relative(ROOT,item.file.fileName):null}));
      const allFiles=program.getSourceFiles().map(row=>resolve(row.fileName)),ownDeclarations=allFiles.filter(file=>[...packages.values()].some(item=>within(file,resolve(item.directory,'src'))||within(file,resolve(item.directory,'dist'))));
      const sourceFallbacks=ownDeclarations.filter(file=>[...packages.values()].some(item=>within(file,resolve(item.directory,'src'))));const declarationPins=[];
      for(const file of allFiles)if(file!==virtual)declarationPins.push(await filePin(file));
      await save('published-types.json',{compiler:ts.version,strict:true,noEmit:true,skipLibCheck:true,virtual,physicalTypeSourcePin,diagnostics,sourceFallbacks,ownDeclarations:ownDeclarations.map(file=>relative(ROOT,file)),declarationPins,typeResolutions,
        baselineMaps:51,currentMaps:Object.keys(interop.manifest.exports).length,mapPins,scope:'All current JS/DTS byte pins; selected physical type consumer semantic acceptance only'});
      assert.deepEqual(diagnostics,[]);assert.deepEqual(sourceFallbacks,[]);
      for(const[suffix,leaf]of [['cad','exact-paired-vlinear-surface-intersection'],['cad-interop',PREFIX],['cad-interop',PREFIX+'-json']])assert.ok(ownDeclarations.includes(resolve(ROOT,'packages/barocss-'+suffix,'dist',leaf+'.d.ts')),'Actual selected declaration '+leaf);
    }
    console.log(JSON.stringify({mode,runtime:mode==='source'?'ordinary-public-source':'actual-published-JS',freshProcess:'Actual distinct Node22 child with two file parse admissions',types:mode==='emitted'?'strict-selected-published-DTS':'UNRUN'}));
  }catch(error){await save('verifier-first-failure.json',{name:error?.name??null,message:error?.message??String(error),stack:error?.stack??null,mode,parent:PARENT,resolutions});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
