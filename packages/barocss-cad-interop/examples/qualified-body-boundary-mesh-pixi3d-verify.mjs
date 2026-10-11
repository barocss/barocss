import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {access,mkdir,readFile,writeFile,statfs} from 'node:fs/promises';
import {resolve,relative,isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

/** Import-inert CLI. Bundles are prepared only when Root explicitly invokes this file. */
async function main(){
 const root=process.cwd(),prefix='packages/barocss-cad-interop/',examples=resolve(root,prefix,'examples'),name='qualified-body-boundary-mesh-pixi3d',parent='515aabfe4b848f9eb6e9e45ba94b1e21724bfce7';
 assert.equal(Number(process.versions.node.split('.')[0]),22,'Node22 required');assert.equal(process.argv.length,6,'Use --mode source|emitted --output ABS_FRESH only');assert.equal(process.argv[2],'--mode');assert.equal(process.argv[4],'--output');
 const mode=process.argv[3],requested=process.argv[5];assert.ok(['source','emitted'].includes(mode));assert.ok(isAbsolute(requested));const output=resolve(requested);let present=false;try{await access(output);present=true;}catch(error){if(error.code!=='ENOENT')throw error;}assert.equal(present,false,'Every FIRST needs a fresh directory');await mkdir(output,{recursive:true});
 const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
 const signed=value=>JSON.stringify(value,(_key,item)=>typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item)+'\n';
 const save=(file,value)=>writeFile(resolve(output,file),signed(value),{flag:'wx'});
 await save('command.json',{argv:process.argv,cwd:root,node:process.version,mode,parent,output,scope:'Neutral Node CPU plus browser composition; no Node Pixi SDK initialization'});
 const disk=await statfs(output);assert.ok(disk.bavail*disk.bsize>=512*1024*1024,'512MiB operational evidence reserve required');
 const require=createRequire(resolve(root,'package.json')),{build}=require('esbuild'),ts=require('typescript');
 const packages=new Map();for(const suffix of ['cad','cad-interop']){const directory=resolve(root,'packages/barocss-'+suffix),manifest=JSON.parse(await readFile(resolve(directory,'package.json'),'utf8'));packages.set('@barocss/'+suffix,{directory,manifest});if(mode==='source'){let exists=false;try{await access(resolve(directory,'dist'));exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}assert.equal(exists,false,'SOURCE FIRST before ownCAD/Interop DIST');}}
 const interop=packages.get('@barocss/cad-interop');
 const original=spawnSync('git',['show',parent+':'+prefix+'package.json'],{cwd:root,encoding:'utf8',timeout:30000});assert.equal(original.status,0,'Immutable parent manifest required');const baseline=JSON.parse(original.stdout),expected=structuredClone(baseline);assert.equal(Object.keys(baseline.exports).length,48);assert.equal(Object.keys(baseline.publishConfig.exports).length,48);
 expected.exports['./'+name]={types:'./src/'+name+'.ts',import:'./src/'+name+'.ts'};expected.publishConfig.exports['./'+name]={types:'./dist/'+name+'.d.ts',import:'./dist/'+name+'.js'};assert.deepEqual(interop.manifest,expected);assert.equal(Object.keys(interop.manifest.exports).length,49);
 const coreHash=hash(await readFile(resolve(interop.directory,'src/qualified-body-boundary-mesh.ts')));assert.equal(coreHash,'4fa1cb65e5df9a7fa72a33a3c37ae5ad8cf5209b11c971e32d1307f40934cea8');
 const oldCodecHash=hash(await readFile(resolve(interop.directory,'src/qualified-body-json.ts')));assert.equal(oldCodecHash,'451ea4d17c7afce5adf9f5f81c33de3f96eafca297631cac2f73afd437ff1683');
 const resolutions=[];function published(specifier,field){const pkg=specifier.split('/').slice(0,2).join('/'),item=packages.get(pkg),suffix=specifier.slice(pkg.length),key=suffix?'.'+suffix:'.',target=item?.manifest.publishConfig?.exports?.[key]?.[field];assert.ok(target?.startsWith('./dist/'),'Actual published '+field+' required: '+specifier);return resolve(item.directory,target);}
 const plugin={name:'actual-published-qualified-pixi1383',setup(builder){builder.onResolve({filter:/^@barocss\/(cad|cad-interop)(\/|$)/},args=>{const path=published(args.path,'import');resolutions.push({specifier:args.path,importer:relative(root,args.importer),target:relative(root,path)});return{path};});}};
 const observer=resolve(examples,name+'-observer.mjs'),runtime=resolve(examples,name+'.mjs'),virtualEntry=resolve(examples,name+'-neutral-primary-consumer.mjs'),virtualChild=resolve(examples,name+'-neutral-child-consumer.mjs');
 async function graph(metafile,allowed,scope){
  const rawInputNames=Object.keys(metafile.inputs),nonFilesystemInputs=rawInputNames.filter(file=>file.startsWith('(disabled):')).map(file=>({file,namespace:'(disabled)',metadata:metafile.inputs[file]}));
  const inputs=rawInputNames.filter(file=>!file.startsWith('(disabled):')).map(file=>resolve(root,file)),otherExamples=inputs.filter(file=>(file.startsWith(resolve(root,'examples')+'/')||[...packages.values()].some(p=>file.startsWith(resolve(p.directory,'examples')+'/')))&&!allowed.includes(file));assert.deepEqual(otherExamples,[],'Only own exact runtime/observer/ABS virtual entry allowed');
  assert.ok(!inputs.some(file=>file.includes('/.barocss-ai/')),'No private implementation fallback');
  const own=inputs.filter(file=>[...packages.values()].some(p=>file.startsWith(resolve(p.directory,'src')+'/')||file.startsWith(resolve(p.directory,'dist')+'/'))),ownSource=own.filter(file=>file.includes('/src/')),ownEmitted=own.filter(file=>file.includes('/dist/'));assert.equal(mode==='source'?ownEmitted.length:ownSource.length,0,'Wrong mode source/DIST fallback');
  const folder=mode==='source'?'src':'dist',ext=mode==='source'?'.ts':'.js';for(const leaf of ['qualified-body-boundary-mesh','qualified-body-boundary-mesh-json'])assert.ok(own.includes(resolve(interop.directory,folder,leaf+ext)),'Actual neutral leaf '+leaf);
  const peers=inputs.filter(file=>file.includes('/node_modules/')&&/(?:\/pixi3d\/|\/pixi\.js\/|\/pixi[^/]*\/|\/@pixi\/)/.test(file)),otherPeers=inputs.filter(file=>file.includes('/node_modules/')&&/(?:\/three\/|\/@babylonjs\/)/.test(file));assert.deepEqual(otherPeers,[]);
  const target=resolve(interop.directory,folder,name+ext);if(scope==='node-neutral'){assert.ok(!own.includes(target),'No Node target initializer');assert.deepEqual(peers,[],'No Node Pixi evaluation');}else{assert.ok(own.includes(target),'Actual public target leaf required');assert.ok(peers.length>0,'Actual pinned Pixi browser closure required');}
  const filePins=[];for(const file of inputs){if(allowed.includes(file)&&!await exists(file))continue;const bytes=await readFile(file);filePins.push({file:relative(root,file),bytes:bytes.length,sha256:hash(bytes)});}
  return{scope,rawInputNames,nonFilesystemInputs,ownSource:ownSource.map(f=>relative(root,f)),ownEmitted:ownEmitted.map(f=>relative(root,f)),ownSourceCount:ownSource.length,ownEmittedCount:ownEmitted.length,pixiPeers:peers.map(f=>relative(root,f)),pixiPeerCount:peers.length,otherPeers,otherExamples,filePins};
 }
 async function exists(file){try{await access(file);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
 const consumer=String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseBaroCadQualifiedBodyBoundaryMesh as parse,readBaroCadQualifiedBodyBoundaryMesh as read} from '@barocss/cad-interop/qualified-body-boundary-mesh';
import {CASE_KEYS,PINS,assetFromTexts,same,serializeSigned,plainTyped,zeroPaths} from './qualified-body-boundary-mesh-pixi3d-observer.mjs';
const output=process.env.QUALIFIED_PIXI1383_CPU_OUTPUT;
const directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples/qualified-body-boundary-mesh-pixi3d-data');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const save=(file,value)=>writeFileSync(resolve(output,file),serializeSigned(plainTyped(value)),{flag:'wx'});
function pinBytes(bytes,pin){assert.equal(bytes.length,pin.bytes,pin.file);assert.equal(hash(bytes),pin.sha256,pin.file);}
function mutableRefs(value,set=new Set()){if(value&&typeof value==='object'&&!set.has(value)&&!Object.isFrozen(value)){set.add(value);if(ArrayBuffer.isView(value)){set.add(value.buffer);return set;}for(const item of Object.values(value))mutableRefs(item,set);}return set;}
function intersection(left,right){let count=0;for(const item of left)if(right.has(item))count++;return count;}
function frozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert.ok(Object.isFrozen(value),'Profile deeply frozen');for(const item of Object.values(value))frozen(item,seen);}
const telemetry=[],calls=[],admissions=[],pairs=[],rows=[];
let lastOperation='boot';
function invoke(entry,input,label){lastOperation=label;const call={index:calls.length+1,label,entry,outcome:'pending'},memoryBefore=process.memoryUsage(),start=performance.now();calls.push(call);try{const result=entry==='parse'?parse(input,options()):read(input,options());call.outcome='accepted';return result;}catch(error){call.outcome='refused';call.error={name:error?.name,code:error?.code,message:error?.message};throw error;}finally{telemetry.push({label,elapsedMilliseconds:performance.now()-start,memoryBefore,memoryAfter:process.memoryUsage()});}}
const limits={utf8Bytes:4194304,utf16Units:4194304,values:4194304,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128};
const profile={schema:'barocss-qualified-body-boundary-mesh-ingestion',version:0,nativePacketSchema:'barocss-qualified-translated-strip-body-mesh',nativeReportSchema:'barocss-qualified-translated-strip-body-mesh-report',nativeVersion:0,unitsPerMillimeter:.001,sourceFrame:'authored-xyz-no-axis-conversion',lengthUnit:'mm',uvLengthUnit:'dimensionless',normalSource:'approximate-triangle-geometry',ownership:'independent-copied-cpu-data-gc',limits,capabilities:{nativeQualifiedMesh:true,rendererNeutralProjection:true,renderer:false,url:false,byteInput:false,publicSerializer:false,dispose:false,genericSolid:false,boolean:false,globalError:false,meshEmbedding:false,newSolid:false,manufacturing:false,exchange:false,publication:false}};
const options=()=>({unitsPerMillimeter:.001});
const chunkFields=['faceId','role','orientation','supportRef','positions','normals','nativeUV','indices','authorityIndices','faceSampleIndices','triangleIndices','nativeQuantizationGapsMM','conversionMeasurements','metadata'];
function checkProjection(result,key){
 assert.deepEqual(Object.keys(result.projection),['unitsPerMillimeter','chunks','measurements']);assert.equal(result.projection.unitsPerMillimeter,.001);assert.equal(result.projection.chunks.length,6);
 const native=result.native,measurements=result.projection.measurements;
 for(const[i,chunk]of result.projection.chunks.entries()){
  assert.deepEqual(Object.keys(chunk).sort(),chunkFields.slice().sort());const source=native.renderChunks[i],face=native.body.faces[i];assert.equal(chunk.faceId,face.id);assert.equal(chunk.role,face.role);assert.equal(chunk.orientation,face.orientation);same(chunk.supportRef,face.supportRef);
  for(const[field,Type,expected]of[['positions',Float32Array,source.positionsMM.map(value=>Math.fround(value*.001))],['normals',Float32Array,source.normals],['nativeUV',Float64Array,source.parametersUV],['indices',Uint32Array,source.indices],['authorityIndices',Uint32Array,source.authorityIndices],['faceSampleIndices',Uint32Array,source.faceSampleIndices],['triangleIndices',Uint32Array,source.triangleIndices],['nativeQuantizationGapsMM',Float64Array,source.quantizationGapsMM]]){
   assert.ok(chunk[field] instanceof Type,field+' actual typed array');same(Array.from(chunk[field]),expected);assert.equal(chunk[field].byteLength,chunk[field].length*Type.BYTES_PER_ELEMENT);
  }
  const gaps=chunk.conversionMeasurements;assert.equal(gaps.extraScaleUploadGapsMM.length,source.indices.length);assert.equal(gaps.totalDisplayToAuthorityGapsMM.length,source.indices.length);assert.equal(gaps.normalUploadGaps.length,source.indices.length);
  let maximumExtra=0,maximumTotal=0,maximumNormal=0;
  for(let corner=0;corner<source.authorityIndices.length;corner++){
   const authority=source.authorityIndices[corner],sample=native.faceSamples[source.faceSampleIndices[corner]];assert.equal(sample.vertexIndex,authority);assert.equal(sample.faceId,face.id);same(Array.from(chunk.nativeUV.slice(corner*2,corner*2+2)),sample.uv);
   const back=[0,1,2].map(axis=>chunk.positions[corner*3+axis]/.001),stored=source.positionsMM.slice(corner*3,corner*3+3),exact=native.packet.positionsMM.slice(authority*3,authority*3+3);
   const extra=Math.hypot(...back.map((v,axis)=>v-stored[axis])),total=Math.hypot(...back.map((v,axis)=>v-exact[axis])),normal=Math.hypot(...[0,1,2].map(axis=>chunk.normals[corner*3+axis]-source.normals[corner*3+axis]));
   same(gaps.extraScaleUploadGapsMM[corner],extra);same(gaps.totalDisplayToAuthorityGapsMM[corner],total);same(gaps.normalUploadGaps[corner],normal);maximumExtra=Math.max(maximumExtra,extra);maximumTotal=Math.max(maximumTotal,total);maximumNormal=Math.max(maximumNormal,normal);
  }
  same(gaps.maximumExtraScaleUploadGapMM,maximumExtra);same(gaps.maximumTotalDisplayToAuthorityGapMM,maximumTotal);same(gaps.maximumNormalUploadGap,maximumNormal);same(gaps.maximumNativeQuantizationGapMM,Math.max(0,...source.quantizationGapsMM));
  assert.equal(gaps.triangleMeasurements.length,source.triangleIndices.length);
  for(const[t,triangle]of gaps.triangleMeasurements.entries()){assert.equal(triangle.triangleIndex,source.triangleIndices[t]);assert.ok(triangle.doubledAreaRendererUnitsSquared>0);assert.ok(triangle.normalDots.every(value=>value>0));assert.equal(triangle.outwardRoleAgreement,true);}
 }
 assert.equal(measurements.projectedFaceCount,6);assert.equal(measurements.projectedVertexCount,native.report.renderVertexCount);assert.equal(measurements.projectedTriangleCount,native.report.triangleCount);assert.equal(measurements.providerCalls,0);assert.equal(measurements.nativeD1Calls,0);assert.equal(measurements.weldingPerformed,false);assert.equal(measurements.resamplingPerformed,false);assert.equal(measurements.globalErrorCertified,false);assert.equal(measurements.geometricEmbeddingCertified,false);assert.equal(measurements.newSolidCertified,false);
 const evaluated=native.faceSamples.filter(sample=>sample.d1.status==='evaluated').length,refused=native.faceSamples.length-evaluated;same(measurements.retainedNativeD1StateCounts,{evaluated,refusedC0:refused});assert.equal(evaluated,key==='single'?150:345);assert.equal(refused,key==='single'?0:45);
}

function checkAdmission(data,asset,sourceText,label){
 assert.deepEqual(Object.keys(data),['native','validationReport','profile','sourceText','projection']);
 same(data.native,asset.native);same(data.validationReport,asset.native.report);same(data.profile,profile);frozen(data.profile);assert.equal(data.sourceText,sourceText);
 assert.deepEqual(Object.keys(data.native),['body','options','packet','edgePaths','faceSamples','renderChunks','proof','report']);same(data.native.body.models.map(item=>item.model.objects.length),[16,2]);assert.equal(data.native.body.faces.length,6);assert.equal(data.native.edgePaths.length,12);
 assert.ok(!Object.isFrozen(data.native)&&!Object.isFrozen(data.validationReport)&&!Object.isFrozen(data.projection));
 for(const sample of data.native.faceSamples)if(sample.d1.status==='refused-c0')for(const field of['point','du','dv','orientedNormal','pointGapMM'])assert.equal(sample.d1[field],null);
 checkProjection(data,asset.key);
 const parts=['native','validationReport','projection'];for(const part of parts)assert.equal(intersection(mutableRefs(data[part]),mutableRefs(asset.native)),0,part+' input ownership');for(let i=0;i<parts.length;i++)for(let j=0;j<i;j++)assert.equal(intersection(mutableRefs(data[parts[i]]),mutableRefs(data[parts[j]])),0,'Independent CPU parts');
 const set=mutableRefs(data);for(const previous of admissions){const count=intersection(set,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}
 const copy=structuredClone(data);admissions.push({label,key:asset.key,data,copy,mutable:set});
 const saved=Buffer.from(serializeSigned(data.native));pinBytes(saved,asset.resultPin);
 return{key:asset.key,request:asset.request,data:plainTyped(data),negativeZeroPaths:zeroPaths(data),requestPin:asset.requestPin,resultPin:asset.resultPin,savedNative:{file:asset.key+'.mesh-result.json',bytes:saved.length,sha256:hash(saved)},ownership:{inputIntersection:0,nativeReportProjectionIntersection:0},retainedNativeAuthorCounts:plainTyped(data.native.report)};
}
function retained(){for(const row of admissions)same(row.data,row.copy);}
function fail(error){save('first-failure.json',{lastOperation,name:error?.name,code:error?.code??null,message:error?.message??String(error),stack:error?.stack??null,calls,successfulAdmissions:admissions.length});}

try{
 const originals=[];for(const pin of PINS){const bytes=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);originals.push({...pin});}assert.equal(originals.reduce((n,p)=>n+p.bytes,0),11288189);
 for(const key of CASE_KEYS){const requestText=readFileSync(resolve(directory,key+'.mesh-request.json'),'utf8'),resultText=readFileSync(resolve(directory,key+'.mesh-result.json'),'utf8'),asset=assetFromTexts(key,requestText,resultText),entry=key==='main'?'read':'parse';
  const data=invoke(entry,entry==='read'?asset.native:asset.text,key+':primary-'+entry),row=checkAdmission(data,asset,entry==='read'?null:asset.text,key+':primary');
  if(entry==='read'){const before=asset.native.packet.positionsMM[0];asset.native.packet.positionsMM[0]=before+1;retained();asset.native.packet.positionsMM[0]=before;row.callerMutationIsolated=true;}else row.callerMutationIsolated='Text is immutable';
  writeFileSync(resolve(output,key+'.mesh-result.json'),serializeSigned(data.native),{flag:'wx'});rows.push(row);retained();
 }
 assert.equal(calls.length,3);assert.equal(pairs.length,3);
 save('primary-summary.json',{result:'qualified-pixi1383-neutral-primary-ok',rows,originalPins:originals,counts:{publicCalls:3,successfulAdmissions:3,nodeTargetCalls:0,nodePeerInitializations:0,negativePopulation:0},mutablePairs:pairs,scope:'Neutral CPU admissions only; no Pixi SDK or target initialization'});
 save('primary-telemetry.json',{pid:process.pid,ppid:process.ppid,node:process.version,execArgv:process.execArgv,calls,telemetry});
 console.log(JSON.stringify({result:'qualified-pixi1383-neutral-primary-ok',admissions:3,nodeTargetCalls:0}));
}catch(error){fail(error);throw error;}
`;
 const childConsumer=String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {parseBaroCadQualifiedBodyBoundaryMesh as parse,readBaroCadQualifiedBodyBoundaryMesh as read} from '@barocss/cad-interop/qualified-body-boundary-mesh';
import {CASE_KEYS,PINS,assetFromTexts,same,serializeSigned,plainTyped,zeroPaths} from './qualified-body-boundary-mesh-pixi3d-observer.mjs';
const output=process.env.QUALIFIED_PIXI1383_CPU_OUTPUT;
const directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples/qualified-body-boundary-mesh-pixi3d-data');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const save=(file,value)=>writeFileSync(resolve(output,file),serializeSigned(plainTyped(value)),{flag:'wx'});
function pinBytes(bytes,pin){assert.equal(bytes.length,pin.bytes,pin.file);assert.equal(hash(bytes),pin.sha256,pin.file);}
function mutableRefs(value,set=new Set()){if(value&&typeof value==='object'&&!set.has(value)&&!Object.isFrozen(value)){set.add(value);if(ArrayBuffer.isView(value)){set.add(value.buffer);return set;}for(const item of Object.values(value))mutableRefs(item,set);}return set;}
function intersection(left,right){let count=0;for(const item of left)if(right.has(item))count++;return count;}
function frozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert.ok(Object.isFrozen(value),'Profile deeply frozen');for(const item of Object.values(value))frozen(item,seen);}
const telemetry=[],calls=[],admissions=[],pairs=[],rows=[];
let lastOperation='boot';
function invoke(entry,input,label){lastOperation=label;const call={index:calls.length+1,label,entry,outcome:'pending'},memoryBefore=process.memoryUsage(),start=performance.now();calls.push(call);try{const result=entry==='parse'?parse(input,options()):read(input,options());call.outcome='accepted';return result;}catch(error){call.outcome='refused';call.error={name:error?.name,code:error?.code,message:error?.message};throw error;}finally{telemetry.push({label,elapsedMilliseconds:performance.now()-start,memoryBefore,memoryAfter:process.memoryUsage()});}}
const limits={utf8Bytes:4194304,utf16Units:4194304,values:4194304,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128};
const profile={schema:'barocss-qualified-body-boundary-mesh-ingestion',version:0,nativePacketSchema:'barocss-qualified-translated-strip-body-mesh',nativeReportSchema:'barocss-qualified-translated-strip-body-mesh-report',nativeVersion:0,unitsPerMillimeter:.001,sourceFrame:'authored-xyz-no-axis-conversion',lengthUnit:'mm',uvLengthUnit:'dimensionless',normalSource:'approximate-triangle-geometry',ownership:'independent-copied-cpu-data-gc',limits,capabilities:{nativeQualifiedMesh:true,rendererNeutralProjection:true,renderer:false,url:false,byteInput:false,publicSerializer:false,dispose:false,genericSolid:false,boolean:false,globalError:false,meshEmbedding:false,newSolid:false,manufacturing:false,exchange:false,publication:false}};
const options=()=>({unitsPerMillimeter:.001});
const chunkFields=['faceId','role','orientation','supportRef','positions','normals','nativeUV','indices','authorityIndices','faceSampleIndices','triangleIndices','nativeQuantizationGapsMM','conversionMeasurements','metadata'];
function checkProjection(result,key){
 assert.deepEqual(Object.keys(result.projection),['unitsPerMillimeter','chunks','measurements']);assert.equal(result.projection.unitsPerMillimeter,.001);assert.equal(result.projection.chunks.length,6);
 const native=result.native,measurements=result.projection.measurements;
 for(const[i,chunk]of result.projection.chunks.entries()){
  assert.deepEqual(Object.keys(chunk).sort(),chunkFields.slice().sort());const source=native.renderChunks[i],face=native.body.faces[i];assert.equal(chunk.faceId,face.id);assert.equal(chunk.role,face.role);assert.equal(chunk.orientation,face.orientation);same(chunk.supportRef,face.supportRef);
  for(const[field,Type,expected]of[['positions',Float32Array,source.positionsMM.map(value=>Math.fround(value*.001))],['normals',Float32Array,source.normals],['nativeUV',Float64Array,source.parametersUV],['indices',Uint32Array,source.indices],['authorityIndices',Uint32Array,source.authorityIndices],['faceSampleIndices',Uint32Array,source.faceSampleIndices],['triangleIndices',Uint32Array,source.triangleIndices],['nativeQuantizationGapsMM',Float64Array,source.quantizationGapsMM]]){
   assert.ok(chunk[field] instanceof Type,field+' actual typed array');same(Array.from(chunk[field]),expected);assert.equal(chunk[field].byteLength,chunk[field].length*Type.BYTES_PER_ELEMENT);
  }
  const gaps=chunk.conversionMeasurements;assert.equal(gaps.extraScaleUploadGapsMM.length,source.indices.length);assert.equal(gaps.totalDisplayToAuthorityGapsMM.length,source.indices.length);assert.equal(gaps.normalUploadGaps.length,source.indices.length);
  let maximumExtra=0,maximumTotal=0,maximumNormal=0;
  for(let corner=0;corner<source.authorityIndices.length;corner++){
   const authority=source.authorityIndices[corner],sample=native.faceSamples[source.faceSampleIndices[corner]];assert.equal(sample.vertexIndex,authority);assert.equal(sample.faceId,face.id);same(Array.from(chunk.nativeUV.slice(corner*2,corner*2+2)),sample.uv);
   const back=[0,1,2].map(axis=>chunk.positions[corner*3+axis]/.001),stored=source.positionsMM.slice(corner*3,corner*3+3),exact=native.packet.positionsMM.slice(authority*3,authority*3+3);
   const extra=Math.hypot(...back.map((v,axis)=>v-stored[axis])),total=Math.hypot(...back.map((v,axis)=>v-exact[axis])),normal=Math.hypot(...[0,1,2].map(axis=>chunk.normals[corner*3+axis]-source.normals[corner*3+axis]));
   same(gaps.extraScaleUploadGapsMM[corner],extra);same(gaps.totalDisplayToAuthorityGapsMM[corner],total);same(gaps.normalUploadGaps[corner],normal);maximumExtra=Math.max(maximumExtra,extra);maximumTotal=Math.max(maximumTotal,total);maximumNormal=Math.max(maximumNormal,normal);
  }
  same(gaps.maximumExtraScaleUploadGapMM,maximumExtra);same(gaps.maximumTotalDisplayToAuthorityGapMM,maximumTotal);same(gaps.maximumNormalUploadGap,maximumNormal);same(gaps.maximumNativeQuantizationGapMM,Math.max(0,...source.quantizationGapsMM));
  assert.equal(gaps.triangleMeasurements.length,source.triangleIndices.length);
  for(const[t,triangle]of gaps.triangleMeasurements.entries()){assert.equal(triangle.triangleIndex,source.triangleIndices[t]);assert.ok(triangle.doubledAreaRendererUnitsSquared>0);assert.ok(triangle.normalDots.every(value=>value>0));assert.equal(triangle.outwardRoleAgreement,true);}
 }
 assert.equal(measurements.projectedFaceCount,6);assert.equal(measurements.projectedVertexCount,native.report.renderVertexCount);assert.equal(measurements.projectedTriangleCount,native.report.triangleCount);assert.equal(measurements.providerCalls,0);assert.equal(measurements.nativeD1Calls,0);assert.equal(measurements.weldingPerformed,false);assert.equal(measurements.resamplingPerformed,false);assert.equal(measurements.globalErrorCertified,false);assert.equal(measurements.geometricEmbeddingCertified,false);assert.equal(measurements.newSolidCertified,false);
 const evaluated=native.faceSamples.filter(sample=>sample.d1.status==='evaluated').length,refused=native.faceSamples.length-evaluated;same(measurements.retainedNativeD1StateCounts,{evaluated,refusedC0:refused});assert.equal(evaluated,key==='single'?150:345);assert.equal(refused,key==='single'?0:45);
}

function checkAdmission(data,asset,sourceText,label){
 assert.deepEqual(Object.keys(data),['native','validationReport','profile','sourceText','projection']);
 same(data.native,asset.native);same(data.validationReport,asset.native.report);same(data.profile,profile);frozen(data.profile);assert.equal(data.sourceText,sourceText);
 assert.deepEqual(Object.keys(data.native),['body','options','packet','edgePaths','faceSamples','renderChunks','proof','report']);same(data.native.body.models.map(item=>item.model.objects.length),[16,2]);assert.equal(data.native.body.faces.length,6);assert.equal(data.native.edgePaths.length,12);
 assert.ok(!Object.isFrozen(data.native)&&!Object.isFrozen(data.validationReport)&&!Object.isFrozen(data.projection));
 for(const sample of data.native.faceSamples)if(sample.d1.status==='refused-c0')for(const field of['point','du','dv','orientedNormal','pointGapMM'])assert.equal(sample.d1[field],null);
 checkProjection(data,asset.key);
 const parts=['native','validationReport','projection'];for(const part of parts)assert.equal(intersection(mutableRefs(data[part]),mutableRefs(asset.native)),0,part+' input ownership');for(let i=0;i<parts.length;i++)for(let j=0;j<i;j++)assert.equal(intersection(mutableRefs(data[parts[i]]),mutableRefs(data[parts[j]])),0,'Independent CPU parts');
 const set=mutableRefs(data);for(const previous of admissions){const count=intersection(set,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}
 const copy=structuredClone(data);admissions.push({label,key:asset.key,data,copy,mutable:set});
 const saved=Buffer.from(serializeSigned(data.native));pinBytes(saved,asset.resultPin);
 return{key:asset.key,request:asset.request,data:plainTyped(data),negativeZeroPaths:zeroPaths(data),requestPin:asset.requestPin,resultPin:asset.resultPin,savedNative:{file:asset.key+'.mesh-result.json',bytes:saved.length,sha256:hash(saved)},ownership:{inputIntersection:0,nativeReportProjectionIntersection:0},retainedNativeAuthorCounts:plainTyped(data.native.report)};
}
function retained(){for(const row of admissions)same(row.data,row.copy);}
function fail(error){save('first-failure.json',{lastOperation,name:error?.name,code:error?.code??null,message:error?.message??String(error),stack:error?.stack??null,calls,successfulAdmissions:admissions.length});}

try{
 const source=process.env.QUALIFIED_PIXI1383_SAVED_INPUT;
 for(const key of CASE_KEYS){const text=readFileSync(resolve(source,key+'.mesh-result.json'),'utf8'),pin=PINS.find(p=>p.file===key+'.mesh-result.json');pinBytes(Buffer.from(text),pin);
  const asset=assetFromTexts(key,readFileSync(resolve(directory,key+'.mesh-request.json'),'utf8'),text),data=invoke('read',asset.native,key+':fresh-child-owned-read'),row=checkAdmission(data,asset,null,key+':fresh-child');
  const before=asset.native.packet.positionsMM[0];asset.native.packet.positionsMM[0]=before+1;retained();asset.native.packet.positionsMM[0]=before;row.callerMutationIsolated=true;rows.push(row);retained();
 }
 assert.equal(calls.length,3);assert.equal(pairs.length,3);
 save('child-summary.json',{result:'qualified-pixi1383-neutral-new-process-owned-ok',rows,counts:{publicCalls:3,successfulAdmissions:3,nodeTargetCalls:0,nodePeerInitializations:0,negativePopulation:0},mutablePairs:pairs,scope:'Actual fresh process, saved originals owned-read once each; no cold target proof'});
 save('child-telemetry.json',{pid:process.pid,ppid:process.ppid,node:process.version,execArgv:process.execArgv,calls,telemetry});console.log(JSON.stringify({result:'qualified-pixi1383-neutral-new-process-owned-ok',admissions:3,nodeTargetCalls:0}));
}catch(error){fail(error);throw error;}
`;
 try{
  await writeFile(resolve(output,'consumer-source.mjs'),consumer,{flag:'wx'});await writeFile(resolve(output,'child-consumer-source.mjs'),childConsumer,{flag:'wx'});
  const common={absWorkingDir:root,bundle:true,write:false,format:'esm',platform:'node',target:'es2022',metafile:true,...(mode==='emitted'?{plugins:[plugin]}:{})};
  const primaryBundle=await build({...common,stdin:{contents:consumer,resolveDir:examples,sourcefile:virtualEntry}}),childBundle=await build({...common,stdin:{contents:childConsumer,resolveDir:examples,sourcefile:virtualChild}});
  const primaryGraph=await graph(primaryBundle.metafile,[virtualEntry,observer],'node-neutral'),childGraph=await graph(childBundle.metafile,[virtualChild,observer],'node-neutral');
  await writeFile(resolve(output,'consumer.bundle.mjs'),primaryBundle.outputFiles[0].text,{flag:'wx'});await writeFile(resolve(output,'child-consumer.bundle.mjs'),childBundle.outputFiles[0].text,{flag:'wx'});
  await save('consumer-metafile.json',primaryBundle.metafile);await save('child-consumer-metafile.json',childBundle.metafile);
  async function execute(label,file,directory,extra={}){
   const args=['--max-old-space-size=4096',file],run=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',timeout:300000,maxBuffer:4*1024*1024,env:{...process.env,QUALIFIED_PIXI1383_CPU_OUTPUT:directory,...extra}});
   await writeFile(resolve(output,label+'.stdout'),run.stdout??'',{flag:'wx'});await writeFile(resolve(output,label+'.stderr'),run.stderr??'',{flag:'wx'});await writeFile(resolve(output,label+'.exit'),String(run.status)+'\n',{flag:'wx'});
   await save(label+'.result.json',{status:run.status,signal:run.signal,error:run.error?{name:run.error.name,code:run.error.code??null,message:run.error.message}:null,node:process.version,args,heapMiB:4096,timeoutMilliseconds:300000,stdoutLimitBytes:4194304,stdoutScope:'Short process status only; full signed Reads are files, not constrained to stdout buffer'});
   process.stdout.write(run.stdout??'');process.stderr.write(run.stderr??'');assert.equal(run.status,0,'FIRST '+label+' neutral process failed');
  }
  await execute('consumer',resolve(output,'consumer.bundle.mjs'),output);
  const childOutput=resolve(output,'fresh-child');await mkdir(childOutput);
  await execute('child',resolve(output,'child-consumer.bundle.mjs'),childOutput,{QUALIFIED_PIXI1383_SAVED_INPUT:output});
  const primarySummary=JSON.parse(await readFile(resolve(output,'primary-summary.json'),'utf8')),childSummary=JSON.parse(await readFile(resolve(childOutput,'child-summary.json'),'utf8')),primaryTelemetry=JSON.parse(await readFile(resolve(output,'primary-telemetry.json'),'utf8')),childTelemetry=JSON.parse(await readFile(resolve(childOutput,'child-telemetry.json'),'utf8'));
  assert.notEqual(primaryTelemetry.pid,childTelemetry.pid,'Actual new process PID required');assert.notEqual(primaryTelemetry.pid,process.pid);assert.notEqual(childTelemetry.pid,process.pid);assert.equal(primaryTelemetry.node,childTelemetry.node);assert.deepEqual(primaryTelemetry.execArgv,childTelemetry.execArgv);
  const same=(a,b,path='$')=>{if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Signed saved values changed '+path);return;}assert.equal(Array.isArray(a),Array.isArray(b));assert.deepEqual(Object.keys(a),Object.keys(b));for(const key of Object.keys(a))same(a[key],b[key],path+'.'+key);};
  for(let i=0;i<3;i++){const primary=primarySummary.rows[i],fresh=childSummary.rows[i];assert.equal(primary.key,fresh.key);assert.equal(fresh.data.sourceText,null);for(const field of['native','validationReport','profile','projection'])same(primary.data[field],fresh.data[field]);same(primary.request,fresh.request);same(primary.savedNative,fresh.savedNative);}
  assert.equal(primarySummary.counts.publicCalls+childSummary.counts.publicCalls,6);assert.equal(primarySummary.mutablePairs.length,3);assert.equal(childSummary.mutablePairs.length,3);
  await save('summary.json',{result:'qualified-pixi1383-neutral-source-file-new-process-ok',rows:primarySummary.rows,freshChildRows:childSummary.rows,originalPins:primarySummary.originalPins,counts:{primaryAdmissions:3,freshChildAdmissions:3,totalNeutralAdmissions:6,nodeSDKCalls:0,nodePeerInitializations:0,nodeNegativePopulation:0},primaryMutablePairs:primarySummary.mutablePairs,childMutablePairs:childSummary.mutablePairs,freshProcess:{sameNodeFlags:true,actualDifferentPID:true,scope:'PIDs recorded separately in telemetry; isolated address spaces, no invented cross-process live-ref intersection'},scope:'Public neutral CPU/full signed files only. Browser target acceptance is separate, UNRUN by this process'});
  await save('telemetry.json',{supervisorPID:process.pid,primary:primaryTelemetry,child:childTelemetry});
  await save('graphs.json',{mode,parent,node:process.version,primary:primaryGraph,child:childGraph,resolutions,coreHash,oldCodecHash,baselineMaps:48,currentMaps:49,scope:'Node public neutral ordinary import closure; Pixi target and peers not initialized'});
  if(mode==='source')for(const item of packages.values())assert.equal(await exists(resolve(item.directory,'dist')),false,'Node SOURCE flow must not generate ownDIST');
  if(mode==='emitted'){
   const mapPins=[];for(const[key,entry]of Object.entries(interop.manifest.publishConfig.exports)){for(const field of['import','types']){const file=resolve(interop.directory,entry[field]),bytes=await readFile(file);mapPins.push({key,field,file:relative(root,file),bytes:bytes.length,sha256:hash(bytes)});}}assert.equal(mapPins.length,98);
   const typeSource=String.raw`import {BaroCADQualifiedBodyBoundaryMeshPixi3DLoader as Loader,BaroCadQualifiedBodyBoundaryMeshReadError,BaroCadQualifiedBodyBoundaryMeshProjectionError,BaroCadQualifiedBodyBoundaryMeshDiagnosticCode} from '@barocss/cad-interop/qualified-body-boundary-mesh-pixi3d';
import type {BaroCadQualifiedBodyBoundaryMeshPixi3DContext,BaroCadQualifiedBodyBoundaryMeshPixi3DResult,BaroCadQualifiedBodyBoundaryMeshPixi3DFaceBinding,BaroCadQualifiedBodyBoundaryMeshRead,BaroCadQualifiedBodyBoundaryMeshOptions,BaroCadQualifiedBodyBoundaryMeshProjectionDiagnosticCode} from '@barocss/cad-interop/qualified-body-boundary-mesh-pixi3d';
import type {QualifiedTranslatedStripBodyMeshResult,QualifiedTranslatedStripBodyMeshReport,Point} from '@barocss/cad';
import type {Camera,LightingEnvironment,Container3D,Mesh3D,MeshGeometry3D,StandardMaterial} from 'pixi3d/pixi7';
import type {Renderer} from 'pixi.js';
type Equal<A,B>=(<T>()=>T extends A?1:2) extends (<T>()=>T extends B?1:2)?true:false;
type Assert<T extends true>=T;
type ResultKeys=Assert<Equal<keyof BaroCadQualifiedBodyBoundaryMeshPixi3DResult,'data'|'root'|'faceBindings'|'dispose'>>;
type ReadKeys=Assert<Equal<keyof BaroCadQualifiedBodyBoundaryMeshRead,'native'|'validationReport'|'profile'|'sourceText'|'projection'>>;
type NativeKeys=Assert<Equal<keyof QualifiedTranslatedStripBodyMeshResult,'body'|'options'|'packet'|'edgePaths'|'faceSamples'|'renderChunks'|'proof'|'report'>>;
type BindingKeys=Assert<Equal<keyof BaroCadQualifiedBodyBoundaryMeshPixi3DFaceBinding,'faceId'|'role'|'orientation'|'supportRef'|'object'>>;
export function consume(text:string,input:QualifiedTranslatedStripBodyMeshResult,options:BaroCadQualifiedBodyBoundaryMeshOptions,camera:Camera,lighting:LightingEnvironment,geometry:MeshGeometry3D,material:StandardMaterial):BaroCadQualifiedBodyBoundaryMeshPixi3DResult{
 const context:BaroCadQualifiedBodyBoundaryMeshPixi3DContext={camera,lighting},loader=new Loader(options,context),result=loader.parse(text),owned=loader.read(input),data:BaroCadQualifiedBodyBoundaryMeshRead=result.data;
 const root:Container3D=result.root,binding:BaroCadQualifiedBodyBoundaryMeshPixi3DFaceBinding=result.faceBindings[0],mesh:Mesh3D=binding.object,native:QualifiedTranslatedStripBodyMeshResult=data.native,report:QualifiedTranslatedStripBodyMeshReport=data.validationReport,sourceText:string|null=data.sourceText,renderer:Renderer=camera.renderer;
 const chunk=data.projection.chunks[0],positions:Float32Array=chunk.positions,normals:Float32Array=chunk.normals,indices:Uint32Array=chunk.indices,uv:Float64Array=chunk.nativeUV,authority:Uint32Array=chunk.authorityIndices,sampleIndices:Uint32Array=chunk.faceSampleIndices,triangles:Uint32Array=chunk.triangleIndices,gaps:Float64Array=chunk.nativeQuantizationGapsMM,scale:.001=data.projection.unitsPerMillimeter;
 const objectId:string=binding.supportRef.objectId,sourceModelId:string=binding.supportRef.sourceModelId,noRenderer:false=data.profile.capabilities.renderer;
 const sample=native.faceSamples[0];if(sample.d1.status==='evaluated'){const point:Point=sample.d1.point,du:Point=sample.d1.du,dv:Point=sample.d1.dv,normal:Point=sample.d1.orientedNormal;void[point,du,dv,normal];}else{const point:null=sample.d1.point,du:null=sample.d1.du,dv:null=sample.d1.dv,normal:null=sample.d1.orientedNormal;void[point,du,dv,normal];}
 if(false){
 mesh.geometry=geometry;mesh.material=material;native.packet.positionsMM[0]=native.packet.positionsMM[0];report.quality.loaderAcceptance=report.quality.loaderAcceptance;positions[0]=positions[0];
 // @ts-expect-error Result data pointer is readonly, same-value write.
 result.data=result.data;
 // @ts-expect-error Result root pointer is readonly, same-value write.
 result.root=result.root;
 // @ts-expect-error Face binding list is readonly, same-value write.
 result.faceBindings[0]=result.faceBindings[0];
 // @ts-expect-error Binding object pointer is readonly, same-value write.
 binding.object=binding.object;
 // @ts-expect-error Binding role is readonly, same-value write.
 binding.role=binding.role;
 // @ts-expect-error Binding supportRef is readonly, same-value write.
 binding.supportRef.objectId=binding.supportRef.objectId;
 // @ts-expect-error Profile nested limit is readonly, same-value write.
 data.profile.limits.utf8Bytes=data.profile.limits.utf8Bytes;
 // @ts-expect-error Profile nested capabilities are readonly, same-value write.
 data.profile.capabilities.renderer=data.profile.capabilities.renderer;
 // @ts-expect-error Explicit .001 scale only.
 new Loader({unitsPerMillimeter:.01},context);
 // @ts-expect-error Actual live Camera required by the context type.
 new Loader(options,{camera:{},lighting});
 // @ts-expect-error Actual LightingEnvironment required by the context type.
 new Loader(options,{camera,lighting:{}});
 }
 void[owned.data.sourceText,root,mesh,native,report,sourceText,renderer,positions,normals,indices,uv,authority,sampleIndices,triangles,gaps,scale,objectId,sourceModelId,noRenderer];result.dispose();return result;
}
export function consumeError(error:unknown):unknown{if(error instanceof BaroCadQualifiedBodyBoundaryMeshReadError){const code:BaroCadQualifiedBodyBoundaryMeshDiagnosticCode=error.code,cause:unknown=error.cause;return[code,cause,BaroCadQualifiedBodyBoundaryMeshDiagnosticCode.NATIVE];}if(error instanceof BaroCadQualifiedBodyBoundaryMeshProjectionError){const code:BaroCadQualifiedBodyBoundaryMeshProjectionDiagnosticCode=error.code;return code;}return null;}
export type Shapes=[ResultKeys,ReadKeys,NativeKeys,BindingKeys];
`;
   const virtualType=resolve(examples,name+'-actual-published-contract.mts'),options={target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.NodeNext,moduleResolution:ts.ModuleResolutionKind.NodeNext,strict:true,noEmit:true,skipLibCheck:true,types:[],lib:['lib.es2022.d.ts','lib.dom.d.ts']},host=ts.createCompilerHost(options),get=host.getSourceFile.bind(host),fileExists=host.fileExists.bind(host),readOriginal=host.readFile.bind(host),typeResolutions=[];
   host.getSourceFile=(file,version,onError,newFile)=>resolve(file)===virtualType?ts.createSourceFile(virtualType,typeSource,version,true,ts.ScriptKind.TS):get(file,version,onError,newFile);host.fileExists=file=>resolve(file)===virtualType||fileExists(file);host.readFile=file=>resolve(file)===virtualType?typeSource:readOriginal(file);
   host.resolveModuleNames=(specifiers,containing)=>specifiers.map(specifier=>{if(/^@barocss\/(cad|cad-interop)(\/|$)/.test(specifier)){const path=published(specifier,'types');typeResolutions.push({specifier,importer:relative(root,containing),target:relative(root,path)});return{resolvedFileName:path,extension:ts.Extension.Dts,isExternalLibraryImport:true};}return ts.resolveModuleName(specifier,containing,options,host).resolvedModule;});
   const program=ts.createProgram([virtualType],options,host),diagnostics=ts.getPreEmitDiagnostics(program).map(d=>({code:d.code,message:ts.flattenDiagnosticMessageText(d.messageText,'\n'),file:d.file?relative(root,d.file.fileName):null})),allDeclarations=program.getSourceFiles().map(f=>resolve(f.fileName)),ownDeclarations=allDeclarations.filter(file=>[...packages.values()].some(p=>file.startsWith(resolve(p.directory,'src')+'/')||file.startsWith(resolve(p.directory,'dist')+'/'))),sourceFallbacks=ownDeclarations.filter(file=>file.includes('/src/'));
   await save('published-type-source.json',{virtualType,typeSource});await save('published-types.json',{compiler:ts.version,strict:true,noEmit:true,skipLibCheck:true,diagnostics,sourceFallbacks,ownDeclarations:ownDeclarations.map(f=>relative(root,f)),typeResolutions,peerDeclarations:allDeclarations.filter(f=>f.includes('/node_modules/')&&/(?:pixi3d|pixi\.js|@pixi)/.test(f)),baselineMaps:48,currentMaps:49,mapPins});
   assert.deepEqual(diagnostics,[]);assert.deepEqual(sourceFallbacks,[]);for(const leaf of [name,'qualified-body-boundary-mesh'])assert.ok(ownDeclarations.includes(resolve(interop.directory,'dist',leaf+'.d.ts')),'Actual selected public declaration required');
  }
  const browser=await build({absWorkingDir:root,entryPoints:[runtime],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',metafile:true,...(mode==='emitted'?{plugins:[plugin]}:{})}),browserGraph=await graph(browser.metafile,[runtime,observer],'browser-target-composition');
  await writeFile(resolve(output,'browser.bundle.mjs'),browser.outputFiles[0].text,{flag:'wx'});await save('browser-metafile.json',browser.metafile);await save('browser-graph.json',{mode,parent,...browserGraph,resolutions,bundlePin:{bytes:Buffer.byteLength(browser.outputFiles[0].text),sha256:hash(browser.outputFiles[0].text)},scope:'Ordinary public target/neutral/peer browser composition only; genuine headed rendering is Root separate execution'});
  console.log(JSON.stringify({mode,result:'qualified-pixi1383-verifier-prepared',neutralAdmissions:6,nodeTargetCalls:0,publishedTypes:mode==='emitted'?'strict actual declarations checked':'UNRUN',browser:'Prepared actual peer bundle; Root headed execution separate',server:{port:5274,config:relative(root,resolve(examples,name+'.config.mjs')),env:{BAROCSS_QUALIFIED_PIXI3D_MODE:mode,BAROCSS_QUALIFIED_PIXI3D_OUTPUT:output},ready:'http://127.0.0.1:5274/qualified-pixi1383-ready'}}));
 }catch(error){await save('runner-first-failure.json',{name:error?.name??null,code:error?.code??null,message:error?.message??String(error),stack:error?.stack??null});throw error;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main();
