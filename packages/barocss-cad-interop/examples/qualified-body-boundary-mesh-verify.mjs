import assert from 'node:assert/strict';
import { build } from 'esbuild';
import ts from 'typescript';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd(), prefix = 'packages/barocss-cad-interop/';
const examples = resolve(root, prefix, 'examples');
const parent = 'aa25a3653922cd50637d5564a7604b2e635a2b44';
function argument(name) { const i = process.argv.indexOf(name); assert.ok(i >= 0 && process.argv[i + 1], name + ' required'); return process.argv[i + 1]; }
const mode = argument('--mode'), requested = argument('--output');
assert.ok(['source', 'compiled'].includes(mode)); assert.ok(isAbsolute(requested), 'Absolute fresh output directory required');
assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'Node22 required');
const output = resolve(requested);
let exists = false;
try { await access(output); exists = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
assert.equal(exists, false, 'Use a fresh output directory for each first flow');
await mkdir(output, { recursive: true });
const packages = new Map();
for (const suffix of ['cad', 'cad-interop']) {
  const directory = resolve(root, 'packages/barocss-' + suffix), manifest = JSON.parse(await readFile(resolve(directory, 'package.json'), 'utf8'));
  packages.set('@barocss/' + suffix, { directory, manifest });
  if (mode === 'source') {
    let ownDist = false; try { await access(resolve(directory, 'dist')); ownDist = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    assert.equal(ownDist, false, 'FIRST source flow must precede own builds');
  }
}
function published(specifier, field) {
  const name = specifier.split('/').slice(0, 2).join('/'), item = packages.get(name);
  const suffix = specifier.slice(name.length), key = suffix ? '.' + suffix : '.';
  const target = item?.manifest.publishConfig?.exports?.[key]?.[field];
  assert.ok(target?.startsWith('./dist/'), 'Actual published ' + field + ' entry required: ' + specifier);
  return resolve(item.directory, target);
}
const resolutions = [];
const plugin = { name: 'actual-published-qualified-body-boundary-mesh', setup(builder) {
  builder.onResolve({ filter: /^@barocss\/(cad|cad-interop)(\/|$)/ }, args => {
    const path = published(args.path, 'import');
    resolutions.push({ specifier: args.path, importer: relative(root, args.importer), target: relative(root, path) }); return { path };
  });
} };

const consumer = String.raw`
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {
 parseBaroCadQualifiedBodyBoundaryMesh as parse,
 readBaroCadQualifiedBodyBoundaryMesh as read,
 BaroCadQualifiedBodyBoundaryMeshReadError,
 BaroCadQualifiedBodyBoundaryMeshDiagnosticCode,
 BaroCadQualifiedBodyBoundaryMeshProjectionError,
} from '@barocss/cad-interop/qualified-body-boundary-mesh';
import {QualifiedTranslatedStripBodyMeshError} from '@barocss/cad';
const output=process.env.LOADER1325_PRODUCT_OUTPUT,directory=resolve(process.cwd(),'packages/barocss-cad-interop/examples/qualified-body-boundary-mesh-data');
const pins=[
 {file:'main.mesh-request.json',bytes:1997510,sha256:'6777a43586cfb0ef6df0f4979f83ec610e37223b98b6294f02cdb8372cb2ae09'},
 {file:'main.mesh-result.json',bytes:2783390,sha256:'30013ca3ff2e04b77388a5c7d5ea2fe1f3ea97c6054089f7491e54ef7ffb2165'},
 {file:'edited.mesh-request.json',bytes:2011904,sha256:'af325a5efddf789fae2c7021db94eb6220fc0a05bf632afeef50dbe96eeb5d65'},
 {file:'edited.mesh-result.json',bytes:2806407,sha256:'241b8ebe23c844f3717110b3d856499ec6e1b6e9cfc5a9aa6a2eda1e40e9bfa0'},
 {file:'single.mesh-request.json',bytes:702431,sha256:'a7cd5e9628940555f6c5c9555491292429536788c4d2dc4af85a3f67dbc3f06c'},
 {file:'single.mesh-result.json',bytes:986547,sha256:'935c30ad1693d27765c6aad0a66613edda9a2904258f3a0bb469b41eaefa627a'},
];
const limits={utf8Bytes:4194304,utf16Units:4194304,values:4194304,depth:64,recordFields:64,arrayElements:8192,stringUnits:262144,keyUnits:128};
const profile={schema:'barocss-qualified-body-boundary-mesh-ingestion',version:0,nativePacketSchema:'barocss-qualified-translated-strip-body-mesh',nativeReportSchema:'barocss-qualified-translated-strip-body-mesh-report',nativeVersion:0,unitsPerMillimeter:.001,sourceFrame:'authored-xyz-no-axis-conversion',lengthUnit:'mm',uvLengthUnit:'dimensionless',normalSource:'approximate-triangle-geometry',ownership:'independent-copied-cpu-data-gc',limits,capabilities:{nativeQualifiedMesh:true,rendererNeutralProjection:true,renderer:false,url:false,byteInput:false,publicSerializer:false,dispose:false,genericSolid:false,boolean:false,globalError:false,meshEmbedding:false,newSolid:false,manufacturing:false,exchange:false,publication:false}};
const options=()=>({unitsPerMillimeter:.001});
function same(a,b,path='$'){
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){assert.ok(Object.is(a,b),'Whole values/signs differ at '+path);return;}
 if(ArrayBuffer.isView(a)||ArrayBuffer.isView(b)){assert.ok(ArrayBuffer.isView(a)&&ArrayBuffer.isView(b));assert.equal(a.constructor,b.constructor,path);assert.equal(a.length,b.length,path);for(let i=0;i<a.length;i++)same(a[i],b[i],path+'['+i+']');return;}
 assert.equal(Array.isArray(a),Array.isArray(b));assert.deepEqual(Object.keys(a),Object.keys(b),path+' fields/order');for(const key of Object.keys(a))same(a[key],b[key],path+'.'+key);
}
function refs(value,set=new Set(),mutableOnly=false){if(value&&typeof value==='object'&&!set.has(value)&&(!mutableOnly||!Object.isFrozen(value))){set.add(value);if(ArrayBuffer.isView(value)){set.add(value.buffer);return set;}for(const item of Object.values(value))refs(item,set,mutableOnly);}return set;}
function intersect(a,b){let count=0;for(const item of a)if(b.has(item))count++;return count;}
function zeros(value,path='$',result=[]){if(typeof value==='number'&&Object.is(value,-0))result.push(path);else if(value&&typeof value==='object')for(const[key,item]of Object.entries(value))zeros(item,path+'.'+key,result);return result;}
function frozen(value,seen=new Set()){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);assert.ok(Object.isFrozen(value),'Profile must be deeply frozen');for(const item of Object.values(value))frozen(item,seen);}
function signedJSON(value,space){return JSON.stringify(value,(_key,item)=>ArrayBuffer.isView(item)?{type:item.constructor.name,values:Array.from(item)}:typeof item==='number'&&Object.is(item,-0)?JSON.rawJSON('-0'):item,space)+'\n';}
function pinBytes(bytes,pin){assert.equal(bytes.length,pin.bytes,pin.file);assert.equal(createHash('sha256').update(bytes).digest('hex'),pin.sha256,pin.file);}
function errorReceipt(error,depth=0){const result={name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};if(error?.cause!==undefined)result.cause=error.cause instanceof Error&&depth<8?errorReceipt(error.cause,depth+1):error.cause;return result;}
const originals=new Map(),admissions=[],pairs=[],rows=[],publicCalls=[],refusals=[];let attempts=0,successes=0,nativeRefusals=0,getterCalls=0;
function invoke(entry,input,opts,label){attempts++;publicCalls.push({index:attempts,entry,label});const result=entry==='parse'?parse(input,opts):read(input,opts);successes++;return result;}
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
function checkAdmission(result,reference,input,text,pin,key,label){
 assert.deepEqual(Object.keys(result),['native','validationReport','profile','sourceText','projection']);same(result.native,reference);same(result.validationReport,reference.report);same(result.profile,profile);frozen(result.profile);assert.equal(result.sourceText,text);assert.ok(!Object.isFrozen(result.native)&&!Object.isFrozen(result.validationReport));
 assert.deepEqual(Object.keys(result.native),['body','options','packet','edgePaths','faceSamples','renderChunks','proof','report']);same(result.native.body.models.map(item=>item.model.objects.length),[16,2]);assert.equal(result.native.body.faces.length,6);assert.equal(result.native.edgePaths.length,12);
 for(const field of['welding','snapping','meshGeometricEmbedding','globalApproximationError','newSolidCertification','manufacturing','rendererAcceptance','loaderAcceptance','publication'])assert.equal(result.native.report.quality[field],false);
 for(const sample of result.native.faceSamples)if(sample.d1.status==='refused-c0')for(const field of['point','du','dv','orientedNormal','pointGapMM'])assert.equal(sample.d1[field],null);
 checkProjection(result,key);
 const sets={native:refs(result.native),report:refs(result.validationReport),projection:refs(result.projection)},inputRefs=refs(input);
 for(const name of Object.keys(sets))assert.equal(intersect(sets[name],inputRefs),0,name+' cannot alias input');
 for(const[a,b]of[['native','report'],['native','projection'],['report','projection']])assert.equal(intersect(sets[a],sets[b]),0,a+'/'+b+' mutable intersection');
 const mutable=refs(result,new Set(),true);for(const previous of admissions){const count=intersect(mutable,previous.mutable);assert.equal(count,0);pairs.push({left:label,right:previous.label,count});}
 admissions.push({label,key,result,mutable,negativeZeroPaths:zeros(result)});
}
assert.deepEqual(Object.keys(BaroCadQualifiedBodyBoundaryMeshDiagnosticCode).sort(),['INPUT','JSON','OWNED','BUDGET','SCHEMA','NATIVE'].sort());assert.equal(typeof BaroCadQualifiedBodyBoundaryMeshProjectionError,'function');
assert.equal(pins.reduce((sum,pin)=>sum+pin.bytes,0),11288189);
for(const pin of pins){const bytes=readFileSync(resolve(directory,pin.file));pinBytes(bytes,pin);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);originals.set(pin.file,{pin,text,reference:JSON.parse(text)});}
for(const key of['main','edited','single']){
 const{pin,text,reference}=originals.get(key+'.mesh-result.json'),request=originals.get(key+'.mesh-request.json').reference;same(request,{body:reference.body,options:reference.options});
 const parsed=invoke('parse',text,options(),key+':text');checkAdmission(parsed,reference,text,text,pin,key,key+':text');
 const input=structuredClone(reference),inputBefore=structuredClone(input),copied=invoke('read',input,options(),key+':owned');checkAdmission(copied,reference,input,null,pin,key,key+':owned');same(input,inputBefore);
 const written=Buffer.from(signedJSON(parsed.native),'utf8');pinBytes(written,pin);writeFileSync(resolve(output,pin.file),written);const coldText=readFileSync(resolve(output,pin.file),'utf8');assert.equal(coldText,text);
 const cold=invoke('parse',coldText,options(),key+':cold');checkAdmission(cold,reference,coldText,coldText,pin,key,key+':cold');same(parsed.projection,copied.projection);same(parsed.projection,cold.projection);
 const parsedBefore=structuredClone(parsed),coldBefore=structuredClone(cold),nativeReportBefore=structuredClone(copied.native.report),projectionBefore=structuredClone(copied.projection);
 input.packet.positionsMM[0]+=1;same(copied.native,reference);copied.validationReport.quality.loaderAcceptance=true;same(copied.native.report,nativeReportBefore);same(copied.projection,projectionBefore);
 copied.native.packet.positionsMM[0]+=1;same(parsed,parsedBefore);same(cold,coldBefore);same(copied.projection,projectionBefore);copied.projection.chunks[0].positions[0]+=1;same(parsed,parsedBefore);same(cold,coldBefore);
 rows.push({key,pin,requestPin:originals.get(key+'.mesh-request.json').pin,request,native:parsed.native,validationReport:parsed.validationReport,profile:parsed.profile,sourceText:parsed.sourceText,projection:parsed.projection,negativeZeroPaths:zeros(parsed),savedPin:{file:pin.file,bytes:written.length,sha256:createHash('sha256').update(written).digest('hex')},callerMutationIsolated:true});
}
assert.equal(successes,9);assert.equal(pairs.length,36);
const main=originals.get('main.mesh-result.json').reference,edited=originals.get('edited.mesh-result.json').reference;
const beforeUpper=main.body.volume.upperWall.binding.section.surfaceAsset.surface.controlPoints,afterUpper=edited.body.volume.upperWall.binding.section.surfaceAsset.surface.controlPoints;const upperY=[];
assert.equal(beforeUpper.length*beforeUpper[0].length,18);for(let u=0;u<beforeUpper.length;u++)for(let v=0;v<beforeUpper[u].length;v++){same(afterUpper[u][v][1],beforeUpper[u][v][1]+1);same(afterUpper[u][v][0],beforeUpper[u][v][0]);same(afterUpper[u][v][2],beforeUpper[u][v][2]);upperY.push({u,v,before:beforeUpper[u][v][1],after:afterUpper[u][v][1]});}
const accepted=admissions.at(-1).result,acceptedBefore=structuredClone(accepted),acceptedRefs=refs(accepted),acceptedZeros=zeros(accepted);
function retained(){same(accepted,acceptedBefore);const now=refs(accepted);assert.equal(now.size,acceptedRefs.size);for(const value of now)assert.ok(acceptedRefs.has(value));same(zeros(accepted),acceptedZeros);}
function refuse(name,entry,input,opts,code,native=false){let error;const before=successes;try{invoke(entry,input,opts,name);}catch(cause){error=cause;}assert.ok(error instanceof BaroCadQualifiedBodyBoundaryMeshReadError,name);assert.equal(error.code,code,name);assert.ok(error.message.length<=1024);if(native){assert.ok(error.cause instanceof QualifiedTranslatedStripBodyMeshError);assert.equal(error.cause.code,'OWNED');nativeRefusals++;}assert.equal(successes,before);assert.equal(getterCalls,0);retained();refusals.push({name,entry,error:errorReceipt(error),eligibleWholeValidator:native,acceptedRetained:true,getterCalls});}
refuse('parse-wrong-kind','parse',0,options(),'INPUT');refuse('read-wrong-kind','read',0,options(),'INPUT');refuse('wrong-explicit-scale','read',main,{unitsPerMillimeter:1},'INPUT');
const optionGetter={};Object.defineProperty(optionGetter,'unitsPerMillimeter',{enumerable:true,get(){getterCalls++;return .001;}});refuse('options-own-getter','read',main,optionGetter,'OWNED');
refuse('malformed-json','parse','{',options(),'JSON');refuse('decoded-duplicate-key','parse','{"packet":{},"\\u0070acket":{}}',options(),'JSON');
refuse('raw-utf16-over-cap','parse',' '.repeat(limits.utf16Units+1),options(),'BUDGET');refuse('raw-utf8-over-cap','parse','é'.repeat(limits.utf8Bytes/2+1),options(),'BUDGET');
const getter=structuredClone(main);Object.defineProperty(getter,'body',{enumerable:true,get(){getterCalls++;return main.body;}});refuse('whole-own-getter','read',getter,options(),'OWNED');
const cycle=structuredClone(main);cycle.body=cycle;refuse('whole-own-cycle','read',cycle,options(),'OWNED');
const schema=structuredClone(main);schema.packet.schema='unknown';refuse('packet-wrong-schema','read',schema,options(),'SCHEMA');const version=structuredClone(main);version.report.version=1;refuse('report-wrong-version','read',version,options(),'SCHEMA');
const mutations=[
 {name:'chunk-authority-remap',path:'$.renderChunks[0].authorityIndices[0]',change(value){assert.equal(value.renderChunks[0].authorityIndices[0],0);value.renderChunks[0].authorityIndices[0]=1;}},
 {name:'missing-sixth-chunk',path:'$.renderChunks[5]',change(value){assert.equal(value.renderChunks.length,6);value.renderChunks.pop();}},
 {name:'refused-c0-reason-changed',path:'$.faceSamples[20].d1.reason',change(value){assert.equal(value.faceSamples[20].d1.status,'refused-c0');value.faceSamples[20].d1.reason+=' changed';}},
 {name:'body-source-binding',path:'$.body.models[0].source',change(value){value.body.models[0].source+=' ';}},
];
for(const action of mutations){const value=structuredClone(main);action.change(value);const before=structuredClone(value);refuse(action.name,'read',value,options(),'NATIVE',true);same(value,before);refusals.at(-1).mutationPath=action.path;}
assert.equal(attempts,25);assert.equal(successes,9);assert.equal(refusals.length,16);assert.equal(nativeRefusals,4);assert.equal(successes+nativeRefusals,13);assert.equal(getterCalls,0);for(const pin of pins)pinBytes(readFileSync(resolve(directory,pin.file)),pin);
const summary={result:'qualified-body-boundary-mesh-public-file-copy-ok',pins,totalOriginalBytes:11288189,rows,admissions:admissions.map(item=>({label:item.label,key:item.key,result:item.result,negativeZeroPaths:item.negativeZeroPaths})),counts:{publicAttempts:attempts,successes,refusals:16,getterCalls,mutableReferencePairs:pairs.length,nativeRefusalOutcomes:nativeRefusals,eligibleWholeValidatorAttempts:successes+nativeRefusals},publicCalls,mutableReferenceIntersections:pairs,refusals,editedUpperY:upperY,acceptedRetained:true,nativeCallEvidence:'Actual public outcome ledger records nine eligible successes and four genuine native-owned refusal outcomes. A separate source check verifies exactly one matching whole-validator callsite. Thirteen is eligible-attempt arithmetic, not instrumented library execution telemetry.',scope:'Neutral CPU only: six literal inputs/full eight-field native/report/profile/projection;9public reads+16refusals+3exactsign-preservingfile reopenings. No direct provider constructor, extra positive native replay, renderer, URL, public serializer or global geometry certification.'};
writeFileSync(resolve(output,'summary.json'),signedJSON(summary));console.log(JSON.stringify({result:summary.result,attempts,successes,refusals:16,eligibleWholeValidatorAttempts:13,getterCalls}));
`;

const virtualEntry = resolve(examples, 'qualified-body-boundary-mesh-private-consumer.mjs');
const bundle = await build({ absWorkingDir: root, bundle: true, write: false, format: 'esm', platform: 'node', target: 'es2022', metafile: true,
  stdin: { contents: consumer, resolveDir: examples, sourcefile: virtualEntry },
  ...(mode === 'compiled' ? { plugins: [plugin] } : {}),
});
const inputs = Object.keys(bundle.metafile.inputs).map(path => resolve(root, path));
const otherExamples = inputs.filter(path => (path.startsWith(resolve(root, 'examples') + '/') || [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'examples') + '/'))) && path !== virtualEntry);
assert.deepEqual(otherExamples, [], 'Only the exact own virtual consumer entry may appear; no old examples');
const own = inputs.filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/')));
const ownSource = own.filter(path => path.includes('/src/')), ownCompiled = own.filter(path => path.includes('/dist/'));
assert.ok(own.length > 0); assert.equal(mode === 'source' ? ownCompiled.length : ownSource.length, 0);
const folder = mode === 'source' ? 'src' : 'dist', extension = mode === 'source' ? '.ts' : '.js';
for (const [suffix, leaf] of [['cad-interop', 'qualified-body-boundary-mesh'], ['cad-interop', 'qualified-body-boundary-mesh-json'], ['cad', 'qualified-translated-strip-body-mesh']]) assert.ok(own.includes(resolve(root, 'packages/barocss-' + suffix, folder, leaf + extension)), 'Actual public authority in runtime graph: ' + leaf);
const peers = inputs.filter(path => /(?:node_modules\/.*(?:three|babylon|pixi)|barocss-gpu)/i.test(path)); assert.deepEqual(peers, []);
const wrapperSource = await readFile(resolve(packages.get('@barocss/cad-interop').directory, 'src/qualified-body-boundary-mesh.ts'), 'utf8');
const nativeCallsiteEvidence = { callsites: [...wrapperSource.matchAll(/validateQualifiedTranslatedStripBodyMesh\s*\(/g)].length, kind: 'static source callsite count, not runtime provider telemetry' };
assert.equal(nativeCallsiteEvidence.callsites, 1);
await writeFile(resolve(output, 'consumer-source.mjs'), consumer);
await writeFile(resolve(output, 'consumer.bundle.mjs'), bundle.outputFiles[0].text);
await writeFile(resolve(output, 'consumer-metafile.json'), JSON.stringify(bundle.metafile, null, 2));
await writeFile(resolve(output, 'graphs.json'), JSON.stringify({ mode, node: process.version, ownSource: ownSource.map(path => relative(root, path)), ownCompiled: ownCompiled.map(path => relative(root, path)), ownSourceCount: ownSource.length, ownCompiledCount: ownCompiled.length, enginePeers: peers, resolutions, nativeCallsiteEvidence, virtualEntry: relative(root, virtualEntry), otherExamples }, null, 2));
const run = spawnSync(process.execPath, ['--max-old-space-size=8192', '--input-type=module'], { cwd: root, input: bundle.outputFiles[0].text, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024, env: { ...process.env, LOADER1325_PRODUCT_OUTPUT: output } });
await writeFile(resolve(output, 'consumer.stdout'), run.stdout ?? ''); await writeFile(resolve(output, 'consumer.stderr'), run.stderr ?? ''); await writeFile(resolve(output, 'consumer.exit'), String(run.status));
await writeFile(resolve(output, 'consumer.result.json'), JSON.stringify({ status: run.status, signal: run.signal, error: run.error ? { name: run.error.name, code: run.error.code ?? null, message: run.error.message } : null, timeoutMs: 120000, heapMB: 8192 }, null, 2));
process.stdout.write(run.stdout ?? ''); process.stderr.write(run.stderr ?? ''); assert.equal(run.status, 0, 'Actual public neutral mesh file flow failed');

if (mode === 'compiled') {
  const interop = packages.get('@barocss/cad-interop'), current = interop.manifest;
  const baselineRun = spawnSync('git', ['show', parent + ':' + prefix + 'package.json'], { cwd: root, encoding: 'utf8' }); assert.equal(baselineRun.status, 0);
  const baseline = JSON.parse(baselineRun.stdout); assert.equal(Object.keys(baseline.exports).length, 38);
  const expected = structuredClone(baseline); expected.exports['./qualified-body-boundary-mesh'] = { types: './src/qualified-body-boundary-mesh.ts', import: './src/qualified-body-boundary-mesh.ts' };
  expected.publishConfig.exports['./qualified-body-boundary-mesh'] = { types: './dist/qualified-body-boundary-mesh.d.ts', import: './dist/qualified-body-boundary-mesh.js' };
  assert.deepEqual(current, expected); assert.equal(Object.keys(current.exports).length, 39); assert.equal(Object.keys(current.publishConfig.exports).length, 39);
  for (const entry of Object.values(current.publishConfig.exports)) { await access(resolve(interop.directory, entry.import)); await access(resolve(interop.directory, entry.types)); }
  const typeSource = await readFile(resolve(examples, 'qualified-body-boundary-mesh-contract.ts'), 'utf8'), virtual = resolve(examples, 'qualified-body-boundary-mesh-private-published-contract.mts');
  const compilerOptions = { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext, moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true, skipLibCheck: true, types: [], lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'] };
  const host = ts.createCompilerHost(compilerOptions), get = host.getSourceFile.bind(host), existsFile = host.fileExists.bind(host), readOriginal = host.readFile.bind(host), typeResolutions = [];
  host.getSourceFile = (path, version, onError, newFile) => resolve(path) === virtual ? ts.createSourceFile(virtual, typeSource, version, true, ts.ScriptKind.TS) : get(path, version, onError, newFile);
  host.fileExists = path => resolve(path) === virtual || existsFile(path); host.readFile = path => resolve(path) === virtual ? typeSource : readOriginal(path);
  host.resolveModuleNames = (names, containingFile) => names.map(name => {
    if (/^@barocss\/(cad|cad-interop)(\/|$)/.test(name)) { const path = published(name, 'types'); typeResolutions.push({ name, importer: relative(root, containingFile), target: relative(root, path) }); return { resolvedFileName: path, extension: ts.Extension.Dts, isExternalLibraryImport: true }; }
    return ts.resolveModuleName(name, containingFile, compilerOptions, host).resolvedModule;
  });
  const program = ts.createProgram([virtual], compilerOptions, host), diagnostics = ts.getPreEmitDiagnostics(program).map(item => ({ code: item.code, message: ts.flattenDiagnosticMessageText(item.messageText, '\n'), file: item.file ? relative(root, item.file.fileName) : null }));
  const ownDeclarations = program.getSourceFiles().map(file => resolve(file.fileName)).filter(path => [...packages.values()].some(item => path.startsWith(resolve(item.directory, 'src') + '/') || path.startsWith(resolve(item.directory, 'dist') + '/'))), sourceFallbacks = ownDeclarations.filter(path => path.includes('/src/'));
  await writeFile(resolve(output, 'published-types.json'), JSON.stringify({ compiler: ts.version, strict: true, noEmit: true, skipLibCheck: true, diagnostics, sourceFallbacks, ownDeclarations: ownDeclarations.map(path => relative(root, path)), typeResolutions, baselineMaps: 38, currentMaps: 39 }, null, 2));
  assert.deepEqual(diagnostics, []); assert.deepEqual(sourceFallbacks, []);
  for (const [suffix, leaf] of [['cad-interop', 'qualified-body-boundary-mesh'], ['cad', 'qualified-translated-strip-body-mesh']]) assert.ok(ownDeclarations.includes(resolve(root, 'packages/barocss-' + suffix, 'dist', leaf + '.d.ts')));
}
console.log(JSON.stringify({ mode, runtime: mode === 'source' ? 'ordinary public source' : 'actual emitted public JS', types: mode === 'compiled' ? 'strict selected actual published declarations' : 'unrun' }));
