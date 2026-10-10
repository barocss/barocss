import {buildExactSurfaceLowerTrim,validateExactSurfaceLowerTrim,compileCadModel} from '@barocss/cad';
import {parseBaroCadSource} from '@barocss/cad-interop/native';
export const CASE_KEYS=Object.freeze(['low_wall','high_wall']);
export const PINS=Object.freeze([
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.authored-wall-request.json",
    "bytes": 134010,
    "sha256": "a0c6add919ecc82b82bff664a48451f5df9cf3d0158e0d13e76b8de75b4ab4b0"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.owned-wall.json",
    "bytes": 178844,
    "sha256": "23fd5fae163f03615140f38347971383a74155f27a7fd3dc2b9d301a81ef0e0e"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.actual-model5.source0.css",
    "bytes": 1486,
    "sha256": "7bc50869cc519bc749e1c5e8c0028067f28d6c25b370fae8c8c05b008cd1447c"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.edge_0.dimensionless-uv.json",
    "bytes": 200,
    "sha256": "0c79ae4540a9697b7d2b27fcc2b8f5ac7a7d693072478a9e8ee264ae4af5eb8d"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.edge_1.dimensionless-uv.json",
    "bytes": 204,
    "sha256": "8ca9bfbb82faa30b17e2e9356057fbe3241abbf12ab108165b0bcfd0357f5caa"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.edge_2.dimensionless-uv.json",
    "bytes": 348,
    "sha256": "a0ae5539d313e5ba77f4e720093821a06231f556d557b245e8af4c136c48c262"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.edge_3.dimensionless-uv.json",
    "bytes": 201,
    "sha256": "c3cbf568a6e11e11604972a5cfb0d0df58f7541918ef99fd3c47be8ed9b52afb"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.complete-original_0.source0.css",
    "bytes": 536,
    "sha256": "ccebeda9baa3d1584dcb5e64ccac7d7671f432653375791715b14e387d5a93dc"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.complete-original_1.source0.css",
    "bytes": 356,
    "sha256": "ba9b0d5da82a2ffd92b1e3d32cbc67c29caac100a555698e5d61cf15f20180e7"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.independent-native-observations.json",
    "bytes": 18059,
    "sha256": "c4199f28aaee5867f8ce058c4fe95dfd430c2f6ef5c7ddfbe90287695e325406"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/low_wall.independent-projection-edge-oracles.json",
    "bytes": 7602,
    "sha256": "e1b9408e7510e73305c2988ec03cf9f301de78995866aacb33201f0ec90f07c6"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.authored-wall-request.json",
    "bytes": 134194,
    "sha256": "6db91a486f60670132a93d2a541624338b5be911b576af57d612449a92d6d25b"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.owned-wall.json",
    "bytes": 179196,
    "sha256": "255623897be95b87d32725f0582a0c9d2404fad66be56ddda9260d91ff7ce203"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.actual-model5.source0.css",
    "bytes": 1496,
    "sha256": "70a2b45631263b0e0c98acecf82be2261af3afd231362fb137d028b64182d2e9"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.edge_0.dimensionless-uv.json",
    "bytes": 201,
    "sha256": "d9145d842472ebad0b4004c7d0a1bfaa3fb54bb7ac6776a27899bc08c7127a32"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.edge_1.dimensionless-uv.json",
    "bytes": 205,
    "sha256": "b5ef09807994760f0e08af6cf07ad808cf6a94bf9a0022cb63b8cbb972774914"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.edge_2.dimensionless-uv.json",
    "bytes": 349,
    "sha256": "d66f4453c73cf2919b174faba0d59740c2973349c1591655b5578459cdedeccc"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.edge_3.dimensionless-uv.json",
    "bytes": 202,
    "sha256": "0efeefe7bc59754da645e6515af2b66bb00af26feb4f512922b272db4385b3b6"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.complete-original_0.source0.css",
    "bytes": 541,
    "sha256": "0db090b071169499ece728f645754acc30e46160000ce9b6c8b10d04e864083f"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.complete-original_1.source0.css",
    "bytes": 356,
    "sha256": "ba9b0d5da82a2ffd92b1e3d32cbc67c29caac100a555698e5d61cf15f20180e7"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.independent-native-observations.json",
    "bytes": 18069,
    "sha256": "8618230c40de7f7b1ae0b1069a7cd2a726eaa4dee35e7574d2dcabde3a45779a"
  },
  {
    "file": "exact-lower-strip-face-pixi3d-data/high_wall.independent-projection-edge-oracles.json",
    "bytes": 7609,
    "sha256": "876a20ea3abb4f298cb20003e0ecffe38c002eb4f3be0fd22b89d37fcfb9b05c"
  }
].map(pin=>Object.freeze(pin)));
export const createParentOptions=()=>({sourceVersion:0,unitsPerMillimeter:.001,countU:17,countV:9});
export function requireFact(value,message){if(!value)throw new Error(message);}
export function assertNative(actual,expected,path='native'){
 if(Object.is(actual,expected))return;
 requireFact(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object','Native bit mismatch at '+path);
 if(ArrayBuffer.isView(actual)||ArrayBuffer.isView(expected)){requireFact(ArrayBuffer.isView(actual)&&ArrayBuffer.isView(expected)&&actual.constructor===expected.constructor&&actual.length===expected.length,'Typed array changed at '+path);for(let i=0;i<expected.length;i++)assertNative(actual[i],expected[i],path+'['+i+']');return;}
 requireFact(Array.isArray(actual)===Array.isArray(expected),'Array kind changed at '+path);const a=Reflect.ownKeys(actual),b=Reflect.ownKeys(expected);requireFact(a.length===b.length&&b.every(key=>Object.hasOwn(actual,key)),'Fields changed at '+path);for(const key of b)assertNative(actual[key],expected[key],path+'.'+String(key));
}
export function assertBuffer(actual,expected,path='buffer'){requireFact(actual?.length===expected.length,'Buffer length changed at '+path);for(let i=0;i<expected.length;i++)requireFact(Object.is(actual[i],expected[i]),'Buffer bits changed at '+path+'['+i+']');}
export function errorReceipt(name,error){return{name,errorName:error.name,code:error.code??null,message:error.message,diagnostics:error.diagnostics??[],cause:error.cause instanceof Error?{kind:'error',name:error.cause.name,code:error.cause.code??null,message:error.cause.message,diagnostics:error.cause.diagnostics??null}:Array.isArray(error.cause)?{kind:'diagnostics',count:error.cause.length,diagnostics:structuredClone(error.cause)}:error.cause&&Array.isArray(error.cause.diagnostics)?{kind:'compile-result',value:structuredClone(error.cause)}:null};}

export function requireOriginalSourceBinding(source,wall){if(source!==wall.world.source)throw new TypeError('Original complete Model5 Source0 differs from saved exact lower-strip Face');}
export function requireOriginalSidecarBindings(uvSources,wall){for(let index=0;index<4;index++){try{assertNative(uvSources[index],wall.edges[index].pcurve,'original-edge-UV['+index+']');}catch(cause){throw new TypeError('Original dimensionless Edge UV sidecar differs from exact lower-strip Face',{cause});}}}
export async function loadCase(key,readText){requireFact(CASE_KEYS.includes(key),'Original lower-strip Face key required');const pins=[];async function read(suffix){const file='exact-lower-strip-face-pixi3d-data/'+key+'.'+suffix,pin=PINS.find(pin=>pin.file===file);requireFact(pin,'Original file pin required');pins.push(pin);const text=await readText(file,pin);requireFact(typeof text==='string'&&new TextEncoder().encode(text).length===pin.bytes,'Original byte length changed');return text;}const [request,owned,modelSource,parent0,parent1,...rest]=await Promise.all([read('authored-wall-request.json'),read('owned-wall.json'),read('actual-model5.source0.css'),read('complete-original_0.source0.css'),read('complete-original_1.source0.css'),...Array.from({length:4},(_,index)=>read('edge_'+index+'.dimensionless-uv.json')),read('independent-native-observations.json'),read('independent-projection-edge-oracles.json')]);return{key,request:JSON.parse(request),owned:JSON.parse(owned),modelSource,parentSources:[parent0,parent1],uvSources:rest.slice(0,4).map(text=>JSON.parse(text)),independentObservations:JSON.parse(rest[4]),independentOracles:JSON.parse(rest[5]),pins};}
function signBits(value,path='native',rows=[]){if(typeof value==='number'&&Object.is(value,-0))rows.push(path);else if(value&&typeof value==='object')for(const key of Object.keys(value))signBits(value[key],path+'.'+key,rows);return rows;}
export function proveCase(asset){const before=structuredClone(asset),wall=buildExactSurfaceLowerTrim(asset.request.binding,asset.request.options),report=validateExactSurfaceLowerTrim(wall);assertNative(wall,asset.owned,'whole-saved-and-fresh-lower-strip-Face');assertNative(report,wall.report);assertNative(validateExactSurfaceLowerTrim(asset.owned),wall.report,'saved-whole-validator');requireOriginalSourceBinding(asset.modelSource,wall);requireOriginalSidecarBindings(asset.uvSources,wall);const section=wall.binding.section;for(const[index,role]of ['surfaceAsset','planeAsset'].entries()){requireFact(asset.parentSources[index]===section[role].source,'Complete original parent Source0 binding changed');const compiled=compileCadModel(asset.parentSources[index],{sourceVersion:0});requireFact(compiled.ok,'Complete original parent source refused');assertNative(compiled.model,section.originalModels[index]);requireFact(compiled.model.objects.length===2,'Original sibling context must remain');}
 requireFact(wall.observations.length===40&&wall.edges.length===4&&wall.vertices.length===4&&wall.loop.uses.length===4,'Whole original Face graph/40 native observations required');asset.independentObservations.forEach((expected,index)=>{const actual=wall.observations[index];assertNative(Object.fromEntries(Object.keys(expected).map(key=>[key,actual[key]])),expected,'independent-native['+index+']');});const oracle=asset.independentOracles;assertNative(wall.proof.projection,oracle.projection,'independent-exact-projection');assertNative(wall.proof.naturalBoundary.spans,oracle.naturalSpans,'independent-natural-boundary');oracle.connectorOracles.forEach((expected,index)=>{const actual=wall.proof.connectors[index];assertNative({edgeId:actual.edgeId,originalUIndex:actual.originalUIndex,independentlyMappedSurfaceEndpoints:actual.surfaceEndpoints,residuals:actual.residuals},expected,'independent-connector['+index+']');});assertNative(wall.proof.faceEmbedding.UVminimumVGap,oracle.UVminimumVGap);assertNative(wall.proof.faceEmbedding.UVminimumUpperGap,oracle.UVminimumUpperGap);
 const native=parseBaroCadSource(asset.modelSource,createParentOptions()),model=native.model;assertNative(model,wall.world.model,'whole-Model5');requireFact(model.version===0&&model.objects.length===5&&native.surfaces.length===1&&native.curves.length===0&&native.unrenderedCurveIds.length===4,'Complete Model5/Support1/four unrendered Curves required');assertNative(native.unrenderedCurveIds,model.objects.filter(object=>object.kind==='curve').map(object=>object.id));assertNative(model.objects.find(object=>object.kind==='surface'),section.surfaceAsset.surface);requireFact(wall.face.orientation===asset.request.options.orientation&&wall.report.quality.faceEmbeddingCertified&&wall.report.quality.solid===false&&wall.report.quality.wholeBodyTopologyCertified===false,'Individual exact Face quality boundaries required');const negativeZeroPaths=signBits(section.originalModels);requireFact(negativeZeroPaths.length>0,'Original signed-zero siblings must be retained');assertNative(asset,before,'immutable-original-files');const edgeRows=wall.loop.uses.map(use=>{const edge=wall.edges.find(edge=>edge.id===use.edgeId);return{use,edge,face:wall.face,worldDomain:[edge.curve.knots[edge.curve.degree],edge.curve.knots[edge.curve.controlPoints.length]],nativeUV:edge.pcurve};});const readout=structuredClone({key:asset.key,request:asset.request,wall,report,modelSource:asset.modelSource,parentSources:asset.parentSources,uvSources:asset.uvSources,independentObservations:asset.independentObservations,independentOracles:asset.independentOracles,native,edgeRows,negativeZeroPaths});return{wall,report,model,native,edgeRows,negativeZeroPaths,readout};}
/** Narrow original Face/source ownership controls. Actual public errors must match. */
export function runSourceRefusals(asset,{parseParent},after=()=>{}){const before=structuredClone(asset),rows=[];let getterCalls=0;const mutate=(value,edit)=>{const copy=structuredClone(value);edit(copy);return copy;},build=request=>buildExactSurfaceLowerTrim(request.binding,request.options),validate=validateExactSurfaceLowerTrim;
 const recipes=[
 ['observation-budget',()=>build(mutate(asset.request,value=>value.options.maximumObservations=39)),'ExactSurfaceLowerTrimError','BUDGET'],
 ['evaluation-identity',()=>build(mutate(asset.request,value=>value.options.evaluationId=value.binding.options.evaluationId)),'ExactSurfaceLowerTrimError','IDENTITY'],
 ['request-getter',()=>{const request=structuredClone(asset.request);Object.defineProperty(request.options,'orientation',{enumerable:true,get(){getterCalls++;return'forward';}});return build(request);},'ExactSurfaceLowerTrimError','INPUT'],
 ['parent-binding-world-source',()=>build(mutate(asset.request,value=>value.binding.section.world.source+=' ')),'ExactSurfaceLowerTrimError','PARENT'],
 ['owned-use-sense',()=>validate(mutate(asset.owned,value=>value.loop.uses[0].sense=value.loop.uses[0].sense==='forward'?'reverse':'forward')),'ExactSurfaceLowerTrimError','OWNED'],
 ['owned-qualified-face',()=>validate(mutate(asset.owned,value=>value.face.sourceId='foreign_source')),'ExactSurfaceLowerTrimError','OWNED'],
 ['owned-edge-UV',()=>validate(mutate(asset.owned,value=>value.edges[0].pcurve.curve.controlPoints[0][1]+=.125)),'ExactSurfaceLowerTrimError','OWNED'],
 ['owned-exact-projection',()=>validate(mutate(asset.owned,value=>value.proof.projection.gramDeterminantLowerBound.numerator='1')),'ExactSurfaceLowerTrimError','OWNED'],
 ['external-Model5-source',()=>requireOriginalSourceBinding(asset.modelSource+' ',asset.owned),'TypeError',null],
 ['external-edge-UV',()=>requireOriginalSidecarBindings(mutate(asset.uvSources,value=>value[0].curve.controlPoints[0][1]+=.125),asset.owned),'TypeError',null],
 ['parent-count18',()=>parseParent(asset.modelSource,{...createParentOptions(),countU:18}),'RangeError',null],
 ['parent-option-getter',()=>{const options=createParentOptions();Object.defineProperty(options,'countU',{enumerable:true,get(){getterCalls++;return 17;}});return parseParent(asset.modelSource,options);},'TypeError',null],
 ['malformed-Model5-source',()=>parseParent('@model { invalid',createParentOptions()),'BaroCadSourceError',null]
 ];
 for(const[name,action,errorName,code]of recipes){let error;try{action();}catch(caught){error=caught;}requireFact(error instanceof Error&&error.name===errorName&&(error.code??null)===code,'Actual error differs: '+name+' '+error?.name+'/'+error?.code);requireFact(getterCalls===0,'Original input getter invoked');assertNative(asset,before,'unchanged-original-inputs');const row={...errorReceipt(name,error),getterCalls,acceptedRetained:true};rows.push(row);after(row);}return{refusals:rows,getterCalls,acceptedRetained:true};}

export async function runTransportRefusals(url,loadAsync,after=()=>{}){
 const rows=[];let getterCalls=0;const event=(progress,value)=>{requireFact(value.loadedBytes>0,'Actual shared progress required');progress.push({...value});};
 async function refuse(name,transport,errorName,code,expectedRequestDelta,callerError){const progress=[];let error;try{await loadAsync(url,transport(progress));}catch(caught){error=caught;}requireFact(error instanceof Error&&error.name===errorName&&(error.code??null)===code,'Actual transport error differs: '+name);if(callerError)requireFact(error===callerError,'Caller Error identity changed');requireFact(getterCalls===0,'Transport getter invoked');const row={...errorReceipt(name,error),progress,expectedRequestDelta,getterCalls,callerErrorIdentityRetained:callerError?error===callerError:null,acceptedRetained:true};rows.push(row);await after(row);}
 await refuse('preabort',()=>{const c=new AbortController();c.abort();return{signal:c.signal};},'AbortError','ABORT_ERR',0);await refuse('progressfalse',progress=>({onProgress(value){event(progress,value);return false;}}),'AbortError','ABORT_ERR',1);await refuse('callbackabort',progress=>{const c=new AbortController();return{signal:c.signal,onProgress(value){event(progress,value);c.abort();}};},'AbortError','ABORT_ERR',1);const callerError=new Error('standing trimUV caller progress error');await refuse('standingcallerError',progress=>({onProgress(value){event(progress,value);throw callerError;}}),'Error',null,1,callerError);await refuse('onProgressgetter',()=>{const transport={};Object.defineProperty(transport,'onProgress',{enumerable:true,get(){getterCalls++;return()=>{};}});return transport;},'TypeError',null,0);return{refusals:rows,getterCalls,acceptedRetained:true};
}
