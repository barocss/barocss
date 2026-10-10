import {classifyMultiSpanVLinearSurfacePlaneTrimUV,validateMultiSpanVLinearSurfacePlaneTrimUVClassification,compileCadModel} from '@barocss/cad';
import {parseBaroCadSource} from '@barocss/cad-interop/native';
export const CASE_KEYS=Object.freeze(['directed_exact','directed_joins','directed_cap_zero']);
export const PINS=Object.freeze([
  {
    "file": "multispan-trim-uv-babylon-data/directed_exact.authored-classification-request.json",
    "bytes": 169186,
    "sha256": "dfa37da475db931bb0b3cd8da38c817330a4ee595b7a92e6b5bb041e7513acd2"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed_exact.owned-classification.json",
    "bytes": 179146,
    "sha256": "c03764720e0dad20ee636284e3d434b2ffd24fd6908013e8aa8d558292be69ae"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed_joins.authored-classification-request.json",
    "bytes": 169176,
    "sha256": "7a46ba43203e75dfca6748b6ff77133345a18bf1ee38a27aac56ebe1858779a8"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed_joins.owned-classification.json",
    "bytes": 177289,
    "sha256": "e39a8256f608390ad15b7f700a94e876c03368af6fe536a2174d3e37e2b86285"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed_cap_zero.authored-classification-request.json",
    "bytes": 169049,
    "sha256": "d3e256126a583e32f8588a125d612616cd03a1ff302ea24e838dd8be82d462d4"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed_cap_zero.owned-classification.json",
    "bytes": 173273,
    "sha256": "030d7b506e2a21e37fbf60c74f45c6d58df9f14e04a654b67de29a1f8618ce2f"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.actual-trim-model8.source0.css",
    "bytes": 1368,
    "sha256": "3e66311d095f81cd324812b38d5556a1603512c5f904e4e8c08905491eeeeac5"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.original-0.source0.css",
    "bytes": 299,
    "sha256": "1ba781ea0526da7acb82a571b41fce3427ca21e5fbbae528b5c091071035260d"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.original-1.source0.css",
    "bytes": 227,
    "sha256": "3eefd09b5c6ff8b10356d5d0755adb4ac64ab2da798e5fcb38f90501e033a6cd"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.bottom.dimensionless-uv.json",
    "bytes": 194,
    "sha256": "8954b4f0ea1eb760525747b28834c58d313aa09ce01c78f49710c834fedf8f0f"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.rightLow.dimensionless-uv.json",
    "bytes": 200,
    "sha256": "c4a46a9c10d39ecf055aefa2f4252871901d555f562f19e404d23ebe36df10e2"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.rightHigh.dimensionless-uv.json",
    "bytes": 200,
    "sha256": "6abde241ea61f719b0a7ba54026ece11ed0859b88340c130611e08f751beb773"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.top.dimensionless-uv.json",
    "bytes": 194,
    "sha256": "927fc74dd3daabf86d17986c947c5c5d191d9c56e8a1a77bd493e3b61ab79061"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.leftLow.dimensionless-uv.json",
    "bytes": 203,
    "sha256": "199eaa7795cacce213a9824ac61317e0c081626ae638670c561095ee5ed59c9a"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.leftHigh.dimensionless-uv.json",
    "bytes": 203,
    "sha256": "b11a984db581bc51f92efb29cd4df5d249c5a345cea77e1031a3a24e907c57bb"
  },
  {
    "file": "multispan-trim-uv-babylon-data/directed.sharedCut.dimensionless-uv.json",
    "bytes": 360,
    "sha256": "aeddcdbe4cead90e01b8b44d0355ba98a037aede4aeffaee74d492eac3ae9275"
  }
].map(pin=>Object.freeze(pin)));
export const createParentOptions=()=>({sourceVersion:0,unitsPerMillimeter:.001,countU:17,countV:9});
const ROLES=['bottom','rightLow','rightHigh','top','leftLow','leftHigh','sharedCut'];
export function requireFact(value,message){if(!value)throw new Error(message);}
export function assertNative(actual,expected,path='native'){
 if(Object.is(actual,expected))return;
 requireFact(actual!==null&&expected!==null&&typeof actual==='object'&&typeof expected==='object','Native bit mismatch at '+path);
 if(ArrayBuffer.isView(actual)||ArrayBuffer.isView(expected)){requireFact(ArrayBuffer.isView(actual)&&ArrayBuffer.isView(expected)&&actual.constructor===expected.constructor&&actual.length===expected.length,'Typed array changed at '+path);for(let i=0;i<expected.length;i++)assertNative(actual[i],expected[i],path+'['+i+']');return;}
 requireFact(Array.isArray(actual)===Array.isArray(expected),'Array kind changed at '+path);const a=Reflect.ownKeys(actual),b=Reflect.ownKeys(expected);requireFact(a.length===b.length&&b.every(key=>Object.hasOwn(actual,key)),'Fields changed at '+path);for(const key of b)assertNative(actual[key],expected[key],path+'.'+String(key));
}
export function assertBuffer(actual,expected,path='buffer'){requireFact(actual?.length===expected.length,'Buffer length changed at '+path);for(let i=0;i<expected.length;i++)requireFact(Object.is(actual[i],expected[i]),'Buffer bits changed at '+path+'['+i+']');}
export function errorReceipt(name,error){return{name,errorName:error.name,code:error.code??null,message:error.message,diagnostics:error.diagnostics??[],cause:error.cause instanceof Error?{kind:'error',name:error.cause.name,code:error.cause.code??null,message:error.cause.message,diagnostics:error.cause.diagnostics??null}:Array.isArray(error.cause)?{kind:'diagnostics',count:error.cause.length,diagnostics:structuredClone(error.cause)}:error.cause&&Array.isArray(error.cause.diagnostics)?{kind:'compile-result',value:structuredClone(error.cause)}:null};}

export function requireOriginalSourceBinding(source,trim){if(source!==trim.world.source)throw new TypeError('Original Support Source0 differs from complete saved trim');}
export function requireOriginalSidecarBindings(sidecars,trim){for(const role of ROLES){const edge=trim.edges.find(edge=>edge.role===role);try{assertNative(sidecars[role],edge.pcurve,'original-sidecar.'+role);}catch(cause){throw new TypeError('Original dimensionless UV sidecar differs from stored trim graph',{cause});}}}
export async function loadCase(key,readText){
 requireFact(CASE_KEYS.includes(key),'Original query group required');const pins=[];
 async function read(name){const file='multispan-trim-uv-babylon-data/'+name,pin=PINS.find(pin=>pin.file===file);requireFact(pin,'Original pin missing');pins.push(pin);const text=await readText(file,pin);requireFact(typeof text==='string'&&new TextEncoder().encode(text).length===pin.bytes,'Original byte length changed');return text;}
 const [request,owned,source,parent0,parent1,...uv]=await Promise.all([read(key+'.authored-classification-request.json'),read(key+'.owned-classification.json'),read('directed.actual-trim-model8.source0.css'),read('directed.original-0.source0.css'),read('directed.original-1.source0.css'),...ROLES.map(role=>read('directed.'+role+'.dimensionless-uv.json'))]);
 return{key,request:JSON.parse(request),owned:JSON.parse(owned),modelSource:source,parentSources:[parent0,parent1],uvSources:Object.fromEntries(ROLES.map((role,index)=>[role,JSON.parse(uv[index])])),pins};
}
export function proveCase(asset){
 const before=structuredClone(asset),r=asset.request;const classification=classifyMultiSpanVLinearSurfacePlaneTrimUV(r.trim,r.queries,r.options),report=validateMultiSpanVLinearSurfacePlaneTrimUVClassification(classification);
 assertNative(classification,asset.owned,'whole-saved-and-fresh-classification');assertNative(validateMultiSpanVLinearSurfacePlaneTrimUVClassification(asset.owned),asset.owned.report);assertNative(report,classification.report);const trim=classification.trim;
 requireOriginalSourceBinding(asset.modelSource,trim);requireOriginalSidecarBindings(asset.uvSources,trim);
 assertNative(r.trim,trim);assertNative(r.queries,classification.queries);assertNative(r.options,classification.options);
 for(const [index,role]of ['surfaceAsset','planeAsset'].entries()){requireFact(asset.parentSources[index]===trim.section[role].source,'Whole original parent source binding changed');const compiled=compileCadModel(asset.parentSources[index],{sourceVersion:0});requireFact(compiled.ok,'Original parent source refused');assertNative(compiled.model,trim.section.originalModels[index]);}
 const native=parseBaroCadSource(asset.modelSource,createParentOptions()),model=native.model;assertNative(model,trim.world.model);requireFact(model.objects.length===8&&native.surfaces.length===1&&native.curves.length===0&&native.unrenderedCurveIds.length===7,'Whole Model8 Support1/unrenderedCurves7 required');assertNative(native.unrenderedCurveIds,model.objects.filter(object=>object.kind==='curve').map(object=>object.id));assertNative(model.objects.find(object=>object.kind==='surface'),trim.section.surfaceAsset.surface);
 const queryRows=classification.queries.map((query,index)=>({...query,...classification.classifications[index],...classification.proof.queries[index]}));
 requireFact(classification.classifications.length===r.queries.length&&classification.proof.queries.length===r.queries.length,'All original queries retained');requireFact(trim.edges.length===7&&trim.loops.length===2&&trim.faces.length===2,'Whole trim graph retained');
 if(asset.key==='directed_joins')for(const row of queryRows)requireFact(row.spanSelection.index===row.u-1&&row.spanSelection.position==='upper-endpoint','Exact original join must select lower span');
 if(asset.key==='directed_cap_zero')requireFact(queryRows.length===1&&queryRows[0].cutRelation==='uncertain'&&queryRows[0].method==='iteration-cap'&&queryRows[0].steps.length===0&&queryRows[0].faces.every(face=>face.classification==='uncertain'),'Cap0 uncertain is successful, not binary fill');
 assertNative(asset,before,'immutable-original-input');const readout=structuredClone({key:asset.key,request:asset.request,classification,report,modelSource:asset.modelSource,parentSources:asset.parentSources,uvSources:asset.uvSources,native,queryRows});return{classification,report,trim,model,native,queryRows,readout};
}
/** Bounded real ownership/source recipes; no query/result substitution or options campaign. */
export function runSourceRefusals(asset,{parseParent},after=()=>{}){
 const before=structuredClone(asset),r=asset.request,rows=[];let getterCalls=0;const mutate=(input,edit)=>{const copy=structuredClone(input);edit(copy);return copy;},classify=value=>classifyMultiSpanVLinearSurfacePlaneTrimUV(value.trim,value.queries,value.options),validate=validateMultiSpanVLinearSurfacePlaneTrimUVClassification;
 const recipes=[
 ['query-budget',()=>classify(mutate(r,x=>x.options.maxQueries=1)),'MultiSpanVLinearSurfacePlaneTrimUVError','BUDGET'],
 ['query-identity',()=>classify(mutate(r,x=>x.queries[1].queryId=x.queries[0].queryId)),'MultiSpanVLinearSurfacePlaneTrimUVError','IDENTITY'],
 ['query-getter',()=>{const copy=structuredClone(r);Object.defineProperty(copy.queries[0],'u',{enumerable:true,get(){getterCalls++;return r.queries[0].u;}});return classify(copy);},'MultiSpanVLinearSurfacePlaneTrimUVError','INPUT'],
 ['trim-source-binding',()=>classify(mutate(r,x=>x.trim.world.source+=' ')),'MultiSpanVLinearSurfacePlaneTrimUVError','TRIM'],
 ['owned-span-proof',()=>validate(mutate(asset.owned,x=>x.proof.queries[0].spanSelection.index++)),'MultiSpanVLinearSurfacePlaneTrimUVError','OWNED'],
 ['owned-qualified-face',()=>validate(mutate(asset.owned,x=>x.classifications[0].faces[0].sourceId='foreign_source')),'MultiSpanVLinearSurfacePlaneTrimUVError','OWNED'],
 ['owned-whole-model',()=>validate(mutate(asset.owned,x=>x.trim.world.model.objects.pop())),'MultiSpanVLinearSurfacePlaneTrimUVError','OWNED'],
 ['external-support-source',()=>requireOriginalSourceBinding(asset.modelSource+' ',r.trim),'TypeError',null],
 ['external-UV-sidecar',()=>requireOriginalSidecarBindings(mutate(asset.uvSources,x=>x.sharedCut.curve.controlPoints[0][1]+=.125),r.trim),'TypeError',null],
 ['parent-count18',()=>parseParent(asset.modelSource,{...createParentOptions(),countU:18}),'RangeError',null],
 ['parent-option-getter',()=>{const options=createParentOptions();Object.defineProperty(options,'countU',{enumerable:true,get(){getterCalls++;return 17;}});return parseParent(asset.modelSource,options);},'TypeError',null]
 ];
 for(const [name,action,errorName,code]of recipes){let error;try{action();}catch(caught){error=caught;}requireFact(error instanceof Error&&error.name===errorName&&(error.code??null)===code,'Actual error differs: '+name+' '+error?.name+'/'+error?.code);requireFact(getterCalls===0,'Input getter invoked');assertNative(asset,before);const row={...errorReceipt(name,error),getterCalls,acceptedRetained:true};rows.push(row);after(row);}return{refusals:rows,getterCalls,acceptedRetained:true};
}
export async function runTransportRefusals(url,loadAsync,after=()=>{}){
 const rows=[];let getterCalls=0;const event=(progress,value)=>{requireFact(value.loadedBytes>0,'Actual shared progress required');progress.push({...value});};
 async function refuse(name,transport,errorName,code,expectedRequestDelta,callerError){const progress=[];let error;try{await loadAsync(url,transport(progress));}catch(caught){error=caught;}requireFact(error instanceof Error&&error.name===errorName&&(error.code??null)===code,'Actual transport error differs: '+name);if(callerError)requireFact(error===callerError,'Caller Error identity changed');requireFact(getterCalls===0,'Transport getter invoked');const row={...errorReceipt(name,error),progress,expectedRequestDelta,getterCalls,callerErrorIdentityRetained:callerError?error===callerError:null,acceptedRetained:true};rows.push(row);await after(row);}
 await refuse('preabort',()=>{const c=new AbortController();c.abort();return{signal:c.signal};},'AbortError','ABORT_ERR',0);await refuse('progressfalse',progress=>({onProgress(value){event(progress,value);return false;}}),'AbortError','ABORT_ERR',1);await refuse('callbackabort',progress=>{const c=new AbortController();return{signal:c.signal,onProgress(value){event(progress,value);c.abort();}};},'AbortError','ABORT_ERR',1);const callerError=new Error('standing trimUV caller progress error');await refuse('standingcallerError',progress=>({onProgress(value){event(progress,value);throw callerError;}}),'Error',null,1,callerError);await refuse('onProgressgetter',()=>{const transport={};Object.defineProperty(transport,'onProgress',{enumerable:true,get(){getterCalls++;return()=>{};}});return transport;},'TypeError',null,0);return{refusals:rows,getterCalls,acceptedRetained:true};
}
