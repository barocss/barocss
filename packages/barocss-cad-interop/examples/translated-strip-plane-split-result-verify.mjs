import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { access, mkdir, readFile, writeFile, statfs } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

import {pathToFileURL} from 'node:url';
async function main(){
const root=process.cwd(),prefix='packages/barocss-cad-interop/',examples=resolve(root,prefix,'examples');
const parent='ddbd947b852fa709e91b2f7c9510c0061e35ce86';
function argument(name){const index=process.argv.indexOf(name);assert.ok(index>=2&&process.argv[index+1],name+' required');return process.argv[index+1];}
const modeFlag=process.argv[2],mode=modeFlag==='--source'?'source':modeFlag==='--emitted'?'emitted':null,requested=argument('--output');
assert.ok(mode,'Use --source or --emitted');assert.ok(isAbsolute(requested),'Absolute fresh output required');
assert.equal(Number(process.versions.node.split('.')[0]),22);assert.equal(process.argv.length,5,'Use --source|--emitted --output ABS_FRESH');assert.equal(process.argv[3],'--output');
assert.equal(root,'/Users/user/.codex/worktrees/translated-strip-split-loader-1450/barocss','Selected immutable author required');
const output=resolve(requested);let exists=false;
try{await access(output);exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
assert.equal(exists,false,'Keep each FIRST capture in a new output directory');await mkdir(output,{recursive:true});const disk=await statfs(output);assert.ok(disk.bavail*disk.bsize>=512*1024*1024,'512MiB output reserve required');
await writeFile(resolve(output,'command.json'),JSON.stringify({argv:process.argv,cwd:root,node:process.version,mode,parent},null,2)+'\n');
const packages=new Map();
for(const suffix of ['cad','cad-interop']){
 const directory=resolve(root,'packages/barocss-'+suffix),manifest=JSON.parse(await readFile(resolve(directory,'package.json'),'utf8'));packages.set('@barocss/'+suffix,{directory,manifest});
 if(mode==='source'){let present=false;try{await access(resolve(directory,'dist'));present=true;}catch(error){if(error.code!=='ENOENT')throw error;}assert.equal(present,false,'FIRST source flow must precede own builds');}
}
const interop=packages.get('@barocss/cad-interop');
const baselineRun=spawnSync('git',['show',parent+':'+prefix+'package.json'],{cwd:root,encoding:'utf8',timeout:30000});
assert.equal(baselineRun.status,0,'Actual immutable parent manifest required');const baseline=JSON.parse(baselineRun.stdout),expected=structuredClone(baseline);
assert.equal(Object.keys(baseline.exports).length,49);assert.equal(Object.keys(baseline.publishConfig.exports).length,49);
expected.exports['./translated-strip-plane-split-result']={types:'./src/translated-strip-plane-split-result.ts',import:'./src/translated-strip-plane-split-result.ts'};
expected.publishConfig.exports['./translated-strip-plane-split-result']={types:'./dist/translated-strip-plane-split-result.d.ts',import:'./dist/translated-strip-plane-split-result.js'};
assert.deepEqual(interop.manifest,expected);assert.equal(Object.keys(interop.manifest.exports).length,50);
const codecPath=resolve(interop.directory,'src/qualified-body-json.ts'),codecHash=createHash('sha256').update(await readFile(codecPath)).digest('hex');
assert.equal(codecHash,'451ea4d17c7afce5adf9f5f81c33de3f96eafca297631cac2f73afd437ff1683');
function published(specifier,field){
 const name=specifier.split('/').slice(0,2).join('/'),item=packages.get(name),suffix=specifier.slice(name.length),key=suffix?'.'+suffix:'.';
 const target=item?.manifest.publishConfig?.exports?.[key]?.[field];assert.ok(target?.startsWith('./dist/'),'Actual published '+field+' entry required: '+specifier);return resolve(item.directory,target);
}
const resolutions=[];
const plugin={name:'actual-published-translated-strip-plane-split-result',setup(builder){builder.onResolve({filter:/^@barocss\/(cad|cad-interop)(\/|$)/},args=>{const path=published(args.path,'import');resolutions.push({specifier:args.path,importer:relative(root,args.importer),target:relative(root,path)});return{path};});}};

const dedicatedCodecHash=createHash('sha256').update(await readFile(resolve(interop.directory,'src/translated-strip-plane-split-result-json.ts'))).digest('hex');
assert.equal(dedicatedCodecHash,'cf0560a0b536ab105fe6150b418d7104b1cb5a6c47e5d0203757595c7370e703');


const common=String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {parseBaroCadTranslatedStripPlaneSplitResult as parse,readBaroCadTranslatedStripPlaneSplitResult as read,BaroCadTranslatedStripPlaneSplitReadError,BaroCadTranslatedStripPlaneSplitDiagnosticCode} from '@barocss/cad-interop/translated-strip-plane-split-result';
import {TranslatedStripPlaneSplitError} from '@barocss/cad';
const directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples/translated-strip-plane-split-result-data');
const cases=[{"key":"main","file":"main-cut-y3-result.json","negativeZeros":122},{"key":"edited","file":"second-cut-only-y4-result.json","negativeZeros":122}];
const pins=[
 {file:'main-cut-y3-result.json',bytes:2137460,sha256:'7afc644a94c60d96223331903695dc7ce19ec34c8216ee317cf07635cde75092'},
 {file:'second-cut-only-y4-result.json',bytes:2136691,sha256:'fd0666f817cd5fe936ef9a0109b020db007ff8995fda6e7004cb12c17fa80821'},
 {file:'main-cut-y3-request.json',bytes:694207,sha256:'08578e808d9d2eddcd4feca18e1c429bef0ca84631fc762a1198f725a6e52207'},
 {file:'second-cut-only-y4-request.json',bytes:694207,sha256:'081db77086c8ab991fa30e0dc6e2f072ce73960e27f86dc8a844e538eacbde5e'},
 {file:'one-cut-only-edit-request.json',bytes:846,sha256:'91d0ff4972e3bae00ed78b5787fd6acc7656679cc52f174010287870ed1a8d0d'},
 {file:'one-cut-only-edit-result.json',bytes:8608,sha256:'b29cae9bf5f06f2fe6d4315353f09358b838e896e58f28762375184bb4024295'},
 {file:'main-cut-y3.authored.json',bytes:8240,sha256:'b558f2f4bb29d97080032e74c1839e75558c3a04bd28c8966ecad5d5b0910a56'},
 {file:'second-cut-only-y4.authored.json',bytes:8240,sha256:'f9607e0f355f73bbf60f0aed942d94926580e9d9553add8f915e32dc55c7fa6a'},
];
const profile={"schema":"barocss-translated-strip-plane-split-result-ingestion","version":0,"nativeSchema":"barocss-translated-strip-plane-split","nativeVersion":0,"sourceFrame":"authored-xyz-no-axis-conversion","lengthUnit":"mm","parameterFrame":"retained-original-curve-and-surface-domains-with-dimensionless-uv","sourceQualification":"retained-source-field-component-index-and-original-model-selection","ownership":"independent-copied-cpu-data-gc","limits":{"utf8Bytes":12582912,"utf16Units":12582912,"values":4194304,"depth":64,"recordFields":64,"arrayElements":8192,"stringUnits":262144,"keyUnits":128},"capabilities":{"nativeWholeValidation":true,"copiedWholeReceipt":true,"renderer":false,"url":false,"byteInput":false,"publicSerializer":false,"dispose":false,"sourceEdit":false,"sampling":false,"bodyConstruction":false,"splitOperation":false,"genericSplitBody":false,"arbitraryPlaneCut":false,"booleanOperation":false,"globalError":false,"newSolid":false,"manufacturing":false,"persistentNaming":false,"editor":false,"publication":false}};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const signed=(value,space)=>JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+'\n';
const save=(file,value)=>writeFileSync(resolve(output,file),signed(value,2),{flag:'wx'});
function same(a,b,path='$'){if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Whole value/sign mismatch '+path);return;}assert.equal(Array.isArray(a),Array.isArray(b));assert.deepEqual(Object.keys(a),Object.keys(b));for(const key of Object.keys(a))same(a[key],b[key],path+'.'+key);}
function association(a,b,path='$'){
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Association value/sign mismatch '+path);return;}
 assert.equal(Array.isArray(a),Array.isArray(b),path+' rank');const ak=Object.keys(a),bk=Object.keys(b);assert.equal(ak.length,bk.length,path+' key count');
 if(Array.isArray(a)){assert.equal(a.length,b.length);assert.deepEqual(ak,bk,path+' array positions');}
 else for(const key of ak)assert.ok(Object.hasOwn(b,key),path+' missing '+key);
 for(const key of ak)association(a[key],b[key],path+'.'+key);
}
function refs(value,set=new Set(),mutableOnly=false){if(value&&typeof value==='object'&&!set.has(value)&&(!mutableOnly||!Object.isFrozen(value))){set.add(value);for(const item of Object.values(value))refs(item,set,mutableOnly);}return set;}
function intersect(a,b){let count=0;for(const value of a)if(b.has(value))count++;return count;}
function zeros(value,path='$',out=[]){if(typeof value==='number'&&Object.is(value,-0))out.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))zeros(item,path+'.'+key,out);return out;}
function frozen(value,seen=new Set()){if(value&&typeof value==='object'&&!seen.has(value)){seen.add(value);assert.ok(Object.isFrozen(value));for(const item of Object.values(value))frozen(item,seen);}}
function errorReceipt(error,depth=0){const value={name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};if(error?.context!==undefined)value.context=structuredClone(error.context);if(Object.hasOwn(error??{},'cause'))value.cause=error.cause instanceof Error&&depth<16?errorReceipt(error.cause,depth+1):error.cause;return value;}
function pinBytes(bytes,pin){assert.equal(bytes.length,pin.bytes,pin.file);assert.equal(hash(bytes),pin.sha256,pin.file);}
function readDigest(value){return{native:hash(Buffer.from(signed(value.native))),report:hash(Buffer.from(signed(value.validationReport))),profile:hash(Buffer.from(signed(value.profile))),sourceText:value.sourceText===null?null:hash(Buffer.from(value.sourceText)),whole:hash(Buffer.from(signed(value)))};}
function check(value,literal,text,descriptor){assert.deepEqual(Object.keys(value),['native','validationReport','profile','sourceText']);same(value.native,literal);same(value.validationReport,literal.report);same(value.profile,profile);frozen(value.profile);assert.equal(value.sourceText,text);assert.ok(!Object.isFrozen(value.native)&&!Object.isFrozen(value.validationReport));assert.equal(intersect(refs(value.native),refs(value.validationReport)),0);same(zeros(value.native),zeros(literal));assert.equal(zeros(value.native).length,descriptor.negativeZeros);return nativeFacts(value.native,descriptor.key);}
const bodyKeys=['base','ends','volume','options','models','vertices','edges','faces','shell','body','proof','observations','report'];
const recipeKeys=['lowerSection','upperSection','lowerBinding','upperBinding','lowerWall','upperWall','cap','base','ends','volume','body'];
function storedRecipe(body){
 const lower=body.base.lowerWall,upper=body.base.upperWall;
 return{lowerSection:lower.binding.section.options,upperSection:upper.binding.section.options,lowerBinding:lower.binding.options,upperBinding:upper.binding.options,
 lowerWall:lower.options,upperWall:upper.options,cap:body.ends.cap.options,base:body.base.options,ends:body.ends.options,volume:body.volume.options,body:body.options};
}
function storedAssets(body){return[body.base.lowerWall.binding.section.surfaceAsset,body.base.upperWall.binding.section.surfaceAsset,body.base.lowerWall.binding.section.planeAsset];}
function bodyFacts(body){
 assert.deepEqual(Object.keys(body),bodyKeys);assert.equal(body.report.schema,'barocss-qualified-translated-strip-body');assert.ok(Object.is(body.report.version,0));
 assert.equal(body.models.length,2);same(body.models.map(row=>row.model.objects.length),[16,2]);assert.equal(body.vertices.length,8);assert.equal(body.edges.length,12);assert.equal(body.faces.length,6);
 assert.equal(body.faces.reduce((n,face)=>n+face.loop.uses.length,0),24);assert.equal(new Set(body.faces.map(face=>face.loop.id)).size,6);
 assert.equal(body.proof.vertexLinks.length,8);assert.equal(body.proof.vertexLinks.reduce((n,link)=>n+link.cornerArcs.length,0),24);assert.equal(body.observations.length,24);
 assert.equal(body.shell.faceIds.length,6);assert.equal(body.body.shellIds.length,1);assert.equal(body.shell.closed,true);assert.equal(body.body.closed,true);assert.equal(body.body.restrictedSolidCertified,true);
 for(const row of body.models){assert.equal(row.sourceVersion,0);assert.equal(typeof row.source,'string');assert.equal(typeof row.sourceId,'string');}
 return{modelObjectCounts:body.models.map(row=>row.model.objects.length),vertexCount:8,edgeCount:12,faceCount:6,useCount:24,loopCount:6,vertexLinkCount:8,cornerArcCount:24,shellCount:1,bodyCount:1};
}
function nativeFacts(native,key){
 assert.deepEqual(Object.keys(native),['request','cutModel','proof','outputs','bindings','report']);const {request,report}=native;
 assert.deepEqual(Object.keys(request),['body','cutAsset','options']);assert.deepEqual(Object.keys(request.options),['evaluationId','maximumOutputBodies','maximumProducerDelegations','outputRecipes']);
 assert.equal(request.options.maximumOutputBodies,2);assert.equal(request.options.maximumProducerDelegations,22);assert.equal(request.options.outputRecipes.length,2);
 for(const recipe of request.options.outputRecipes){assert.equal(Object.keys(recipe).length,11);for(const name of recipeKeys)assert.ok(Object.hasOwn(recipe,name));}
 assert.equal(report.schema,'barocss-translated-strip-plane-split');assert.ok(Object.is(report.version,0));assert.equal(report.sourceFrame,'authored-xyz-no-axis-conversion');assert.equal(report.lengthUnit,'mm');assert.equal(report.volumeUnit,'mm3');
 assert.deepEqual(Object.keys(request.cutAsset),key==='main'?['sourceId','source','surface']:['source','sourceId','surface']);
 assert.equal(native.cutModel.objects.length,3);assert.equal(report.selectedCutObjectIndex,1);association(native.cutModel.objects[1],request.cutAsset.surface);assert.equal(request.cutAsset.surface.id,report.cutSurfaceId);assert.equal(request.cutAsset.sourceId,report.cutSourceId);
 assert.deepEqual(Object.keys(native.proof),['cut','intervals','outputMaterial','volume','generatedIds']);assert.deepEqual(Object.keys(native.bindings),['original','cut','faceLineage','edgeLineage','vertexLineage','directionConvention','namingAuthority']);
 const originalBody=bodyFacts(request.body);assert.equal(native.outputs.length,2);const outputs=native.outputs.map((row,index)=>{assert.deepEqual(Object.keys(row),['index','side','recipe','body']);assert.equal(row.index,index);assert.equal(row.side,index===0?'below-y':'above-y');association(row.recipe,request.options.outputRecipes[index]);return bodyFacts(row.body);});
 same(native.bindings.cut.effectiveOrientations,['reverse','forward']);same(native.bindings.cut.outwardNormalYSigns,[1,-1]);assert.equal(native.bindings.cut.boundaryMaps.length,4);
 assert.equal(native.bindings.faceLineage.length,6);assert.equal(native.bindings.edgeLineage.length,12);assert.equal(native.bindings.vertexLineage.length,8);
 assert.equal(native.bindings.directionConvention,'parent-stored-use-order-already-includes-face-orientation');assert.equal(native.bindings.namingAuthority,'explicit-source-qualified-operation-lineage-no-generic-persistent-matching');
 assert.equal(native.proof.cut.source.sourceField,'request.cutAsset.source');assert.equal(native.proof.cut.source.componentIndex,null);assert.equal(native.proof.cut.source.objectIndex,1);assert.equal(native.proof.cut.source.objectId,request.cutAsset.surface.id);assert.equal(native.proof.cut.source.modelName,native.cutModel.name);
 assert.equal(native.proof.intervals.disjointOpenInteriors,true);assert.equal(native.proof.intervals.closedUnionEqualsInput,true);assert.equal(native.proof.volume.originalExactVolumeMM3.numerator,'1040');
 same(native.proof.volume.actualOutputExactVolumeMM3,key==='main'?[{numerator:'390',denominator:'1'},{numerator:'650',denominator:'1'}]:[{numerator:'520',denominator:'1'},{numerator:'520',denominator:'1'}]);
 same(native.proof.volume.conservationResidual,{numerator:'0',denominator:'1'});assert.equal(report.inputBodyCount,1);assert.equal(report.outputBodyCount,2);
 const trueFlags=['restrictedSplitCertified','inputMaterialConserved','disjointOutputInteriors','closedOutputUnionEqualsInput','actualOutputBodiesQualified','commonCutImageCertified','oppositeCutOutwardOrientations','originalBodySourcesAndSiblingsPreserved','fullParentProofsUnchanged','ownedRebuild'];
 for(const[name,value]of Object.entries(report.quality))if(typeof value==='boolean')assert.equal(value,trueFlags.includes(name),'No upgraded quality '+name);
 assert.equal(report.quality.ownership,'independent-copied-cpu-data-gc');assert.equal(report.directCounts.originalBodyValidationCount,1);assert.equal(report.directCounts.cutSourceCompilationCount,1);assert.equal(report.directCounts.outputBodyConstructionCount,2);assert.equal(report.directCounts.producerDelegationCount,22);assert.equal(report.directCounts.totalDirectDelegationCount,24);
 for(const field of ['curvePointEvaluationCount','curveDerivativeEvaluationCount','surfacePointEvaluationCount','surfaceDerivativeEvaluationCount','cutSurfaceValidationCount','cutSurfaceDomainCallCount','floatConversionCount','nativeRootCount','booleanCallCount','sourceWriterCallCount'])assert.equal(report.directCounts[field],0);
 assert.equal(zeros(native).length,122);
 return{originalBody,outputs,cutObjectCount:3,negativeZeroCount:zeros(native).length,storedNativeAuthorCounts:report.directCounts,rationalCounts:report.rationalCounts,quality:report.quality,limits:report.limits,workScope:report.workScope};
}

`;
const primary=String.raw`
const output=process.env.LOADER1450_PRODUCT_OUTPUT,rows=[],admissions=[],pairs=[],calls=[],refusals=[],telemetry=[],originals=new Map();let attempts=0,successes=0,nativeRefusals=0,getterCalls=0,last='boot';
function invoke(entry,input,label){last=label;attempts++;const call={index:attempts,entry,label,outcome:'pending'},start=performance.now(),before=process.memoryUsage();calls.push(call);try{const result=entry==='parse'?parse(input):read(input);successes++;call.outcome='accepted';return result;}catch(error){call.outcome='refused';call.error=errorReceipt(error);throw error;}finally{telemetry.push({index:attempts,label,elapsedMilliseconds:performance.now()-start,before,after:process.memoryUsage()});}}
function remember(result,literal,input,text,descriptor,label){const facts=check(result,literal,text,descriptor);for(const tree of [result.native,result.validationReport])assert.equal(intersect(refs(tree),refs(input)),0);const mutable=refs(result,new Set(),true);for(const previous of admissions){const count=intersect(mutable,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}admissions.push({label,key:descriptor.key,result,mutable,negativeZeroPaths:zeros(result.native),sourceTextRole:text===null?'owned-null':'exact-text',digest:readDigest(result)});return facts;}
try{
 assert.ok(output&&isAbsolute(output));assert.equal(pins.reduce((n,p)=>n+p.bytes,0),5688499);assert.deepEqual(Object.keys(BaroCadTranslatedStripPlaneSplitDiagnosticCode).sort(),['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'].sort());
 for(const pin of pins){const bytes=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);originals.set(pin.file,{pin,text,literal:JSON.parse(text)});}
 for(const descriptor of cases){
  const original=originals.get(descriptor.file),literal=original.literal,parsed=invoke('parse',original.text,descriptor.key+':text'),facts=remember(parsed,literal,original.text,original.text,descriptor,descriptor.key+':text');
  const parsedBefore=structuredClone(parsed),owned=invoke('read',parsed.native,descriptor.key+':owned');remember(owned,literal,parsed.native,null,descriptor,descriptor.key+':owned');same(parsed,parsedBefore);
  const bytes=Buffer.from(signed(parsed.native));pinBytes(bytes,original.pin);writeFileSync(resolve(output,original.pin.file),bytes,{flag:'wx'});const coldText=readFileSync(resolve(output,original.pin.file),'utf8');assert.equal(coldText,original.text);const cold=invoke('parse',coldText,descriptor.key+':cold');remember(cold,literal,coldText,coldText,descriptor,descriptor.key+':cold');
  const ownedBefore=structuredClone(owned),coldBefore=structuredClone(cold),u=parsed.native.proof.volume.conservationResidual.numerator;parsed.native.proof.volume.conservationResidual.numerator='2';same(owned,ownedBefore);same(cold,coldBefore);parsed.native.proof.volume.conservationResidual.numerator=u;same(parsed,parsedBefore);
  const version=owned.validationReport.version;owned.validationReport.version=1;same(owned.native,literal);same(parsed,parsedBefore);same(cold,coldBefore);owned.validationReport.version=version;
  const v=owned.native.proof.volume.conservationResidual.numerator;owned.native.proof.volume.conservationResidual.numerator='2';same(owned.validationReport,literal.report);same(parsed,parsedBefore);same(cold,coldBefore);owned.native.proof.volume.conservationResidual.numerator=v;same(owned,ownedBefore);
  rows.push({key:descriptor.key,native:parsed.native,validationReport:parsed.validationReport,profile:parsed.profile,sourceText:parsed.sourceText,resultPin:original.pin,savedPin:original.pin,negativeZeroPaths:zeros(parsed.native),nativeFacts:facts,callerMutationIsolated:true});console.log(JSON.stringify({positive:descriptor.key,primaryAdmissions:3,negativeZeros:descriptor.negativeZeros}));
 }
 assert.equal(successes,6);assert.equal(pairs.length,15);
 const main=rows[0].native,edited=rows[1].native;
 const dataFiles=pins.slice(2),dataRecords={};for(const {file} of dataFiles){dataRecords[file]=structuredClone(originals.get(file).literal);same(dataRecords[file],originals.get(file).literal);assert.equal(intersect(refs(dataRecords[file]),refs(originals.get(file).literal)),0);}
 const mainRequest=dataRecords['main-cut-y3-request.json'],editedRequest=dataRecords['second-cut-only-y4-request.json'],editRequest=dataRecords['one-cut-only-edit-request.json'],editResult=dataRecords['one-cut-only-edit-result.json'];
 const mainAuthored=dataRecords['main-cut-y3.authored.json'],editedAuthored=dataRecords['second-cut-only-y4.authored.json'];
 association(mainRequest,main.request);association(editedRequest,edited.request);assert.equal(zeros(mainRequest).length,40);assert.equal(zeros(editedRequest).length,40);
 association(main.request.body,edited.request.body);association(main.request.options,edited.request.options);association(editResult.request,editRequest);assert.equal(editRequest.sourceVersion,0);assert.equal(editRequest.source,main.request.cutAsset.source);assert.equal(editRequest.surfaceId,main.request.cutAsset.surface.id);
 association(editResult.originalModel,main.cutModel);association(editResult.model,edited.cutModel);association(editResult.surface,edited.request.cutAsset.surface);assert.equal(editResult.source,edited.request.cutAsset.source);
 same(editRequest.edits,{poleEdits:[{uIndex:0,vIndex:0,yMM:4},{uIndex:0,vIndex:1,yMM:4},{uIndex:1,vIndex:0,yMM:4},{uIndex:1,vIndex:1,yMM:4}]});
 assert.equal(editResult.patches.length,4);const expectedPatches=[[0,0,369,370],[0,1,377,378],[1,0,388,389],[1,1,397,398]];let patched=editRequest.source;
 for(let i=editResult.patches.length-1;i>=0;i--){const patch=editResult.patches[i],[uIndex,vIndex,startUTF16,endUTF16]=expectedPatches[i];same(patch,{uIndex,vIndex,field:'yMM',startUTF16,endUTF16,originalText:'3',replacementText:'4'});assert.equal(editRequest.source.slice(startUTF16,endUTF16),'3');patched=patched.slice(0,startUTF16)+'4'+patched.slice(endUTF16);}
 assert.equal(patched,editResult.source);
 for(const [authored,native] of [[mainAuthored,main],[editedAuthored,edited]]){
  assert.deepEqual(Object.keys(authored),['schema','version','original','cutAsset','outputRecipes','options']);assert.equal(authored.schema,'barocss-authored-translated-strip-plane-split');assert.ok(Object.is(authored.version,0));
  association(authored.original.assets,storedAssets(native.request.body));association(authored.original.recipe,storedRecipe(native.request.body));association(authored.cutAsset,native.request.cutAsset);association(authored.outputRecipes,native.request.options.outputRecipes);
  association(authored.options,{evaluationId:native.request.options.evaluationId,maximumOutputBodies:2,maximumProducerDelegations:22});
 }
 association(mainAuthored.original,editedAuthored.original);association(mainAuthored.outputRecipes,editedAuthored.outputRecipes);association(mainAuthored.options,editedAuthored.options);
 const comparisonData={records:dataRecords,nativeAdmissions:0,editorCalls:0,authoredParserCalls:0,associationPolicy:'Equal object-key membership and Object.is values/signs; arrays ordered. Originals and copies retain their own key order.',role:'Six complete request/edit/authored records DATA only; no reconstruction or editor/compiler call'};
 const dataBefore=structuredClone(comparisonData),dataRefs=refs(comparisonData);
 const accepted=admissions.map(x=>x.result),before=structuredClone(accepted),acceptedRefs=refs(accepted),signs=zeros(accepted);
 function retained(){same(accepted,before);const now=refs(accepted);assert.equal(now.size,acceptedRefs.size);for(const ref of now)assert.ok(acceptedRefs.has(ref));same(zeros(accepted),signs);same(comparisonData,dataBefore);const dataNow=refs(comparisonData);assert.equal(dataNow.size,dataRefs.size);for(const ref of dataNow)assert.ok(dataRefs.has(ref));for(const pin of pins)pinBytes(readFileSync(resolve(directory,pin.file)),pin);for(const row of rows)pinBytes(readFileSync(resolve(output,row.savedPin.file)),row.savedPin);}
 const expectedMessages={
  'parse-kind-getter':'Translated strip Plane Split result text must be a string','read-root-array':'Translated strip Plane Split result owned data must be a record',
  'missing-root-cutModel':'A complete translated strip Plane Split result record with the exact six fields is required','report-schema':'The native translated strip Plane Split report schema and version 0 are required','report-version':'The native translated strip Plane Split report schema and version 0 are required',
  'raw-utf16-over-cap':'Raw JSON UTF16 code-unit budget exceeded','raw-utf8-over-cap':'Raw JSON UTF8 byte budget exceeded','decoded-duplicate-report':'Duplicate decoded JSON key','enumerable-getter':'Getter or hidden own data refused','ancestor-cycle':'Own ancestor cycle refused',
  'record-work-budget':'Owned occurrence/depth budget exceeded','record-canonical-budget':'Owned canonical JSON plus newline budget exceeded',
 };
 function refuse(name,entry,input,code,native=false,path=null){let error,threw=false;const prior=successes;try{invoke(entry,input,name);}catch(cause){threw=true;error=cause;}const receipt={name,entry,threw,error:threw?errorReceipt(error):null,getterCalls,eligibleWholeAttempt:native,path,acceptedRetained:false,...(name==='record-work-budget'?{recipe:{root:'plain-record-padding',plannedOccurrences:4198402,phaseScope:'Actual public RECORD first error, not private root-array reuse'}}:{}),...(name==='record-canonical-budget'?{recipe:{root:'plain-record-padding',plannedCanonicalBytesWithLF:12583070,phaseScope:'Actual public RECORD canonical+LF error'}}:{})};refusals.push(receipt);save('refusal-first-'+String(refusals.length).padStart(2,'0')+'.json',receipt);
  assert.equal(threw,true,'Unexpected acceptance; retain FIRST without alternate recipe');assert.ok(error instanceof BaroCadTranslatedStripPlaneSplitReadError);assert.equal(error.code,code);assert.ok(error.message.length<=1024);
  if(native){assert.equal(error.message,'Whole native translated strip Plane Split validation refused the copied data');assert.ok(error.cause instanceof TranslatedStripPlaneSplitError);assert.equal(error.cause.code,'OWNED');assert.equal(error.cause.message,'Translated strip Plane Split: Complete original/cut/output sources, material, lineage, topology, counts or sizes differ from reconstruction');same(error.cause.context,{stage:'owned',componentIndex:null,directCounts:main.report.directCounts,codecCounts:{ownedSplitValidationCount:0,originalBodyReconstructionCount:0,originalProducerDelegationCount:0,splitConstructionCount:0}});assert.equal(Object.hasOwn(error.cause,'cause'),false);nativeRefusals++;}
  else{assert.equal(error.message,expectedMessages[name]);assert.equal(Object.hasOwn(error,'cause'),false,'Same-family codec errors propagate directly');}
  assert.equal(successes,prior);assert.equal(getterCalls,0);retained();receipt.acceptedRetained=true;save('refusal-'+String(refusals.length).padStart(2,'0')+'.json',receipt);
 }
 const mutations=[
  {name:'conservation-proof',path:'$.proof.volume.conservationResidual.numerator',before:'0',after:'1',change(value){assert.equal(value.proof.volume.conservationResidual.numerator,'0');value.proof.volume.conservationResidual.numerator='1';}},
  {name:'output-side',path:'$.outputs[0].side',before:'below-y',after:'above-y',change(value){assert.equal(value.outputs[0].side,'below-y');value.outputs[0].side='above-y';}},
  {name:'cut-parameter-remap',path:'$.bindings.cut.boundaryMaps[0].parameterScale.numerator',before:'1',after:'2',change(value){assert.equal(value.bindings.cut.boundaryMaps[0].parameterScale.numerator,'1');value.bindings.cut.boundaryMaps[0].parameterScale.numerator='2';}},
  {name:'false-generic-split',path:'$.report.quality.genericSplitBody',before:false,after:true,change(value){assert.equal(value.report.quality.genericSplitBody,false);value.report.quality.genericSplitBody=true;}},
 ];
 save('mutation-plan.json',{mutations:mutations.map(({name,path})=>({name,path})),primaryEligibleAttempts:10,freshChildEligibleAttempts:2,scope:'Frozen MAIN whole changes; native error raw capture precedes comparisons'});
 for(const mutation of mutations){const value=structuredClone(main);mutation.change(value);same(value.request,main.request);const snapshot=structuredClone(value);refuse(mutation.name,'read',value,'NATIVE',true,mutation.path);same(value,snapshot);}
 refuse('raw-utf16-over-cap','parse',' '.repeat(12582913),'BUDGET');refuse('raw-utf8-over-cap','parse','é'.repeat(6291457),'BUDGET');refuse('decoded-duplicate-report','parse','{"report":0,"\\u0072eport":1}','JSON');
 const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){getterCalls++;return 1;}});refuse('enumerable-getter','read',getter,'OWNED');const cycle={};cycle.self=cycle;refuse('ancestor-cycle','read',cycle,'OWNED');refuse('record-work-budget','read',{padding:Array(4096).fill(Array(1024).fill(0))},'BUDGET');refuse('record-canonical-budget','read',{padding:Array(48).fill('x'.repeat(262144))},'BUDGET');
 const wrongKind={};Object.defineProperty(wrongKind,'x',{enumerable:true,get(){getterCalls++;return 0;}});refuse('parse-kind-getter','parse',wrongKind,'INPUT');refuse('read-root-array','read',[],'INPUT');const missing=structuredClone(main);delete missing.cutModel;refuse('missing-root-cutModel','read',missing,'SCHEMA');const schema=structuredClone(main);schema.report.schema='unknown';refuse('report-schema','read',schema,'SCHEMA');const version=structuredClone(main);version.report.version=1;refuse('report-version','read',version,'SCHEMA');
 assert.equal(attempts,22);assert.equal(successes,6);assert.equal(refusals.length,16);assert.equal(nativeRefusals,4);assert.equal(successes+nativeRefusals,10);retained();
 const childOutput=resolve(output,'fresh-process');mkdirSync(childOutput);const childBundle=process.env.LOADER1450_CHILD_BUNDLE;assert.ok(childBundle&&isAbsolute(childBundle));
 const childArgs=['--max-old-space-size=4096',childBundle],spawned=spawnSync(process.execPath,childArgs,{cwd:process.cwd(),encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024,env:{...process.env,LOADER1450_CHILD_OUTPUT:childOutput,LOADER1450_SAVED_DIRECTORY:output,LOADER1450_PRIMARY_PID:String(process.pid)}});
 writeFileSync(resolve(childOutput,'first.stdout'),spawned.stdout??'',{flag:'wx'});writeFileSync(resolve(childOutput,'first.stderr'),spawned.stderr??'',{flag:'wx'});writeFileSync(resolve(childOutput,'first.exit'),String(spawned.status)+'\n',{flag:'wx'});save('fresh-process-execution.json',{command:[process.execPath,...childArgs],primaryPID:process.pid,status:spawned.status,signal:spawned.signal,error:spawned.error?errorReceipt(spawned.error):null,timeoutMilliseconds:300000,scope:'Actual newPIDchild; not sameprocess reset'});process.stdout.write(spawned.stdout??'');process.stderr.write(spawned.stderr??'');assert.equal(spawned.status,0,'FIRST freshprocess reader flow failed');
 const child=JSON.parse(readFileSync(resolve(childOutput,'summary.json'),'utf8'));assert.notEqual(child.pid,process.pid);assert.equal(child.parentPID,process.pid);assert.equal(child.ppid,process.pid);assert.equal(child.node,process.version);same(child.execArgv,process.execArgv);assert.equal(child.attempts,2);assert.equal(child.successes,2);assert.equal(child.mutablePairs.length,1);assert.ok(child.mutablePairs.every(p=>p.count===0));
 for(const witness of child.witnesses){const row=rows.find(x=>x.key===witness.key);same(witness.digest,readDigest({native:row.native,validationReport:row.validationReport,profile:row.profile,sourceText:row.sourceText}));same(witness.negativeZeroPaths,row.negativeZeroPaths);assert.equal(witness.fullNativeReportObjectIs,true);assert.equal(witness.sourceTextRole,'exact-text');}retained();
 const counts={primaryAttempts:22,primarySuccesses:6,primaryRefusals:16,primaryEligibleWholeAttempts:10,freshChildAttempts:2,freshChildSuccesses:2,freshChildEligibleWholeAttempts:2,combinedAttempts:24,combinedSuccesses:8,combinedRefusals:16,combinedEligibleWholeAttempts:12,primaryMutablePairs:15,childMutablePairs:1,getterCalls};
 save('summary.json',{result:'translated-strip-plane-split-result-public-file-copy-freshprocess-ok',pins,totalOriginalBytes:5688499,rows,comparisonData,admissions:admissions.map(({label,key,negativeZeroPaths,sourceTextRole,digest})=>({label,key,negativeZeroPaths,sourceTextRole,digest})),freshChildWitnesses:child.witnesses,counts,publicCalls:calls,freshChildCalls:child.calls,refusals,mutablePairs:pairs,childMutablePairs:child.mutablePairs,acceptedRetained:true,callEvidence:'Actual public attempt ledger and one static matching callsite; eligible arithmetic differs from inherited native work. 15 primary+1 child refs, no cross-process reference comparison.'});
 save('telemetry.json',{calls:telemetry,primaryPID:process.pid,childPID:child.pid,finalMemory:process.memoryUsage()});console.log(JSON.stringify({ok:true,...counts}));
}catch(error){save('first-failure.json',{error:errorReceipt(error),stack:error?.stack??null,last,attempts,successes,nativeRefusals,getterCalls,calls,rows,refusals});throw error;}

`;
const child=String.raw`
const output=process.env.LOADER1450_CHILD_OUTPUT,saved=process.env.LOADER1450_SAVED_DIRECTORY,parentPID=Number(process.env.LOADER1450_PRIMARY_PID),witnesses=[],accepted=[],mutablePairs=[],calls=[];let attempts=0,successes=0;
try{
 assert.ok(output&&saved&&isAbsolute(output)&&isAbsolute(saved));assert.ok(Number.isInteger(parentPID));assert.notEqual(process.pid,parentPID);assert.equal(process.ppid,parentPID);
 for(const descriptor of cases){const pin=pins.find(x=>x.file===descriptor.file),bytes=readFileSync(resolve(saved,pin.file)),original=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);pinBytes(original,pin);assert.ok(bytes.equals(original));const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),literal=JSON.parse(text),call={index:++attempts,key:descriptor.key,entry:'parse',outcome:'pending'};calls.push(call);let result;
  try{result=parse(text);successes++;call.outcome='accepted';}catch(error){call.outcome='refused';call.error=errorReceipt(error);throw error;}check(result,literal,text,descriptor);assert.equal(intersect(refs(result.native),refs(literal)),0);const mutable=refs(result,new Set(),true);for(const previous of accepted){const count=intersect(mutable,previous.mutable);assert.equal(count,0);mutablePairs.push({left:descriptor.key,right:previous.key,count});}accepted.push({key:descriptor.key,mutable});witnesses.push({key:descriptor.key,savedPin:pin,fullNativeReportObjectIs:true,profileDeepFrozen:true,sourceTextRole:'exact-text',negativeZeroPaths:zeros(result.native),digest:readDigest(result)});
 }
 assert.equal(attempts,2);assert.equal(successes,2);assert.equal(mutablePairs.length,1);save('summary.json',{result:'fresh-public-strip-plane-split-saved-file-process-ok',pid:process.pid,parentPID,ppid:process.ppid,argv:process.argv,node:process.version,execArgv:process.execArgv,attempts,successes,calls,witnesses,mutablePairs,scope:'Actual newPID2publicparses; wholeRead4 checked against original, compact signed digest/sign witnesses. No crossprocess heap comparison.'});console.log(JSON.stringify({freshChild:true,pid:process.pid,parentPID,attempts,successes}));
}catch(error){save('first-failure.json',{error:errorReceipt(error),stack:error?.stack??null,pid:process.pid,parentPID,attempts,successes,calls,witnesses});throw error;}

`;
 async function graph(meta,virtual){
  const rawInputNames=Object.keys(meta.inputs),inputs=rawInputNames.map(name=>resolve(root,name));
  const otherExamples=inputs.filter(file=>(file.startsWith(resolve(root,'examples')+'/')||[...packages.values()].some(item=>file.startsWith(resolve(item.directory,'examples')+'/')))&&file!==virtual);assert.deepEqual(otherExamples,[],'Exact ABS virtual entry only');
  const own=inputs.filter(file=>[...packages.values()].some(item=>file.startsWith(resolve(item.directory,'src')+'/')||file.startsWith(resolve(item.directory,'dist')+'/'))),source=own.filter(file=>file.includes('/src/')),emitted=own.filter(file=>file.includes('/dist/'));
  assert.ok(own.length>0);assert.equal(mode==='source'?emitted.length:source.length,0);const folder=mode==='source'?'src':'dist',ext=mode==='source'?'.ts':'.js';
  for(const[suffix,leaf]of [['cad-interop','translated-strip-plane-split-result'],['cad-interop','translated-strip-plane-split-result-json'],['cad','translated-strip-plane-split']])assert.ok(own.includes(resolve(root,'packages/barocss-'+suffix,folder,leaf+ext)));
  const peers=inputs.filter(file=>file.includes('/node_modules/')||file.includes('/barocss-gpu/'));assert.deepEqual(peers,[]);assert.ok(!inputs.some(file=>file.includes('/.barocss-ai/')),'No private modules');assert.ok(inputs.every(file=>own.includes(file)||file===virtual),'Ordinary own source/published files and virtual entry only');assert.ok(inputs.includes(virtual),'ABS virtual self entry missing');
  const filePins=[];for(const file of own){const bytes=await readFile(file);filePins.push({file:relative(root,file),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  return{rawInputNames,ownSource:source.map(file=>relative(root,file)),ownEmitted:emitted.map(file=>relative(root,file)),ownSourceCount:source.length,ownEmittedCount:emitted.length,peers,otherExamples,absoluteVirtualEntry:virtual,filePins};
 }
 try{
  const primaryEntry=resolve(examples,'translated-strip-plane-split-result-private-primary-consumer.mjs'),childEntry=resolve(examples,'translated-strip-plane-split-result-private-fresh-consumer.mjs'),primaryText=common+primary,childText=common+child;
  await writeFile(resolve(output,'primary-source.mjs'),primaryText,{flag:'wx'});await writeFile(resolve(output,'fresh-child-source.mjs'),childText,{flag:'wx'});
  const prepare=(text,entry)=>build({absWorkingDir:root,bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true,stdin:{contents:text,resolveDir:examples,sourcefile:entry},...(mode==='emitted'?{plugins:[plugin]}:{})});
  const primaryBundle=await prepare(primaryText,primaryEntry),primaryGraph=await graph(primaryBundle.metafile,primaryEntry),childBundle=await prepare(childText,childEntry),childGraph=await graph(childBundle.metafile,childEntry),primaryPath=resolve(output,'primary.bundle.mjs'),childPath=resolve(output,'fresh-child.bundle.mjs');
  await writeFile(primaryPath,primaryBundle.outputFiles[0].text,{flag:'wx'});await writeFile(childPath,childBundle.outputFiles[0].text,{flag:'wx'});await writeFile(resolve(output,'primary-metafile.json'),JSON.stringify(primaryBundle.metafile,null,2),{flag:'wx'});await writeFile(resolve(output,'fresh-child-metafile.json'),JSON.stringify(childBundle.metafile,null,2),{flag:'wx'});
  const wrapper=await readFile(resolve(interop.directory,'src/translated-strip-plane-split-result.ts'),'utf8'),callsites=[...wrapper.matchAll(/validateTranslatedStripPlaneSplit\s*\(/g)].map(m=>({offset:m.index,line:wrapper.slice(0,m.index).split('\n').length})),guardOffset=wrapper.indexOf('requireNativeSchema(native)');assert.equal(callsites.length,1);assert.ok(guardOffset>=0&&guardOffset<callsites[0].offset);
  await writeFile(resolve(output,'graphs.json'),JSON.stringify({mode,parent,node:process.version,primary:primaryGraph,freshChild:childGraph,resolutions,codecHash,dedicatedCodecHash,baselineMaps:49,currentMaps:50,staticWholeCallEvidence:{callsites,guardBeforeCall:true,scope:'One staticmatchingcallsite and publicattemptledgers; not internalkernel telemetry'}},null,2),{flag:'wx'});
  const executed=spawnSync(process.execPath,['--max-old-space-size=4096',primaryPath],{cwd:root,encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024,env:{...process.env,LOADER1450_PRODUCT_OUTPUT:output,LOADER1450_CHILD_BUNDLE:childPath}});
  await writeFile(resolve(output,'primary.stdout'),executed.stdout??'',{flag:'wx'});await writeFile(resolve(output,'primary.stderr'),executed.stderr??'',{flag:'wx'});await writeFile(resolve(output,'primary.exit'),String(executed.status)+'\n',{flag:'wx'});await writeFile(resolve(output,'primary-execution.json'),JSON.stringify({status:executed.status,signal:executed.signal,error:executed.error?{name:executed.error.name,code:executed.error.code??null,message:executed.error.message}:null,heapMiB:4096,timeoutMilliseconds:300000},null,2),{flag:'wx'});process.stdout.write(executed.stdout??'');process.stderr.write(executed.stderr??'');assert.equal(executed.status,0,'FIRST primary/freshprocess public translated strip Plane Split result flow failed');
  if(mode==='emitted'){
   const mapPins=[];for(const[key,entry]of Object.entries(interop.manifest.publishConfig.exports))for(const field of ['import','types']){const file=resolve(interop.directory,entry[field]);await access(file);const bytes=await readFile(file);mapPins.push({key,field,file:relative(root,file),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}assert.equal(mapPins.length,100);
   const typeSource=await readFile(resolve(examples,'translated-strip-plane-split-result-contract.ts'),'utf8');assert.equal(createHash('sha256').update(typeSource).digest('hex'),'98fd0771b7c1610e2faaa180e167c5bd482e6aae52ac71ccebd8bdf831e6cb9f');const virtualType=resolve(examples,'translated-strip-plane-split-result-private-published-contract.mts'),options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,skipLibCheck:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']},host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host),fileExists=host.fileExists.bind(host),readOriginal=host.readFile.bind(host),typeResolutions=[];
   host.getSourceFile=(p,v,e,n)=>resolve(p)===virtualType?ts.createSourceFile(virtualType,typeSource,v,true,ts.ScriptKind.TS):get(p,v,e,n);host.fileExists=p=>resolve(p)===virtualType||fileExists(p);host.readFile=p=>resolve(p)===virtualType?typeSource:readOriginal(p);host.resolveModuleNames=(names,containing)=>names.map(specifier=>{if(/^@barocss\/(cad|cad-interop)(\/|$)/.test(specifier)){const path=published(specifier,'types');typeResolutions.push({specifier,importer:relative(root,containing),target:relative(root,path)});return{resolvedFileName:path,extension:ts.Extension.Dts,isExternalLibraryImport:true};}return ts.resolveModuleName(specifier,containing,options,host).resolvedModule;});
   const program=ts.createProgram([virtualType],options,host),diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n'),file:d.file?relative(root,d.file.fileName):null})),ownDeclarations=program.getSourceFiles().map(f=>resolve(f.fileName)).filter(p=>[...packages.values()].some(x=>p.startsWith(resolve(x.directory,'src')+'/')||p.startsWith(resolve(x.directory,'dist')+'/'))),fallbacks=ownDeclarations.filter(p=>p.includes('/src/'));
   await writeFile(resolve(output,'published-types.json'),JSON.stringify({compiler:ts.version,strict:true,noEmit:true,skipLibCheck:true,diagnostics,ownDeclarations:ownDeclarations.map(p=>relative(root,p)),sourceFallbacks:fallbacks,typeResolutions,baselineMaps:49,currentMaps:50,mapPins,physicalTypeSourcePin:{file:relative(root,resolve(examples,'translated-strip-plane-split-result-contract.ts')),bytes:Buffer.byteLength(typeSource),sha256:createHash('sha256').update(typeSource).digest('hex')}},null,2),{flag:'wx'});assert.deepEqual(diagnostics,[]);assert.deepEqual(fallbacks,[]);for(const [suffix,leaf] of [['cad','translated-strip-plane-split'],['cad-interop','translated-strip-plane-split-result']])assert.ok(ownDeclarations.includes(resolve(root,'packages/barocss-'+suffix,'dist',leaf+'.d.ts')));
  }
  console.log(JSON.stringify({mode,runtime:mode==='source'?'ordinarypublicsource':'actualpublishedJS',freshProcess:'actual distinctPID2parses passed',types:mode==='emitted'?'strictselectedpublishedDTS':'UNRUN'}));
 }catch(e){await writeFile(resolve(output,'runner-first-failure.json'),JSON.stringify({name:e.name,message:e.message,stack:e.stack??null},null,2),{flag:'wx'});throw e;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
