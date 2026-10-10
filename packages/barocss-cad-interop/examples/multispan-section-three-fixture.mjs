import {buildMultiSpanVLinearSurfacePlaneSection,validateMultiSpanVLinearSurfacePlaneSection,curveDomain,surfaceDomain,sampleCurve,evaluateCurve,evaluateCurveD1,evaluateSurface,evaluateSurfaceD1} from '@barocss/cad';
import {parseBaroCadUniformCurveSource} from '@barocss/cad-interop/native-uniform-curve';
import {parseBaroCadSource} from '@barocss/cad-interop/native';
export const CASE_KEYS=Object.freeze(['warped_four','nonuniform_u']);
export const PINS=Object.freeze([
  {
    "file": "multispan-section-three-data/warped_four.full-original-request.json",
    "bytes": 1950,
    "sha256": "3a96aed7e8eb09f1351b9139d7ed1de2316cf18bee087a84b328de20b12c30bb"
  },
  {
    "file": "multispan-section-three-data/warped_four.owned-result.json",
    "bytes": 105551,
    "sha256": "2c132f5c6951223b7f8d83c2957ba23decfe54b399449f964132c0999584b1e0"
  },
  {
    "file": "multispan-section-three-data/warped_four.actual-world.source0.css",
    "bytes": 676,
    "sha256": "3e0a17791c359b63fcb7cdda2b155fcdea2553841caebfaaf2c0133df6ac4048"
  },
  {
    "file": "multispan-section-three-data/warped_four.surface-uv.dimensionless-only.json",
    "bytes": 692,
    "sha256": "d1f7709d6ee56ea917defe8bb6a2342deb2d6457a29be23cb333e5b610b6c3f9"
  },
  {
    "file": "multispan-section-three-data/warped_four.plane-uv.dimensionless-only.json",
    "bytes": 759,
    "sha256": "3037fa05b716c72d45919678f6bc88a04f1e4572a3b9723577fce1459f04cb4a"
  },
  {
    "file": "multispan-section-three-data/nonuniform_u.full-original-request.json",
    "bytes": 1698,
    "sha256": "7b9b03f447cc7c3068f7a14b3dab480e50dc363868dedb4cc7738dfb138c4cca"
  },
  {
    "file": "multispan-section-three-data/nonuniform_u.owned-result.json",
    "bytes": 107169,
    "sha256": "65afee12181dfc48e5027fff1bd5c38616d37a46c3c000b0eac5fddd55696621"
  },
  {
    "file": "multispan-section-three-data/nonuniform_u.actual-world.source0.css",
    "bytes": 686,
    "sha256": "99498abe90a5af3579643014d6d18d487dbecedec070f943ad74e4769f9d0a56"
  },
  {
    "file": "multispan-section-three-data/nonuniform_u.surface-uv.dimensionless-only.json",
    "bytes": 620,
    "sha256": "c0954cb327ee0cf0ec9a60fd2ec65ccda01276f967af9b239f75379dabb2493d"
  },
  {
    "file": "multispan-section-three-data/nonuniform_u.plane-uv.dimensionless-only.json",
    "bytes": 727,
    "sha256": "a4a832a640b0062a6fe2e0c0d8dd7d93b35adc3cfed29053f46b791f9af4f075"
  },
  {
    "file": "multispan-section-three-data/warped_source.original.source0.css",
    "bytes": 712,
    "sha256": "1363495df92d2ffe2cf2c200b2e5dc1cbfe0fa77dc8834e8f72e8687a2b8ba8c"
  },
  {
    "file": "multispan-section-three-data/plane_source.original.source0.css",
    "bytes": 337,
    "sha256": "e9db1dd361560b5ac6690e247924279df011f4981d9bfec0e01aed28c4d4f611"
  },
  {
    "file": "multispan-section-three-data/shifted_source.original.source0.css",
    "bytes": 546,
    "sha256": "5542b28e1dfd9f4eec2b829f3ac06731d286884e9c52346b056e41a1530cc588"
  },
  {
    "file": "multispan-section-three-data/shift_plane_source.original.source0.css",
    "bytes": 233,
    "sha256": "16d12db4e6296aee7b2866b8c1564934a9f5c09dd9154df1a9e2d66e094a255f"
  }
].map(pin=>Object.freeze(pin)));
export const createWorldOptions=()=>({sourceVersion:0,unitsPerMillimeter:.001,uniformCurveDisplay:{version:1,count:129}});
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
export async function loadCase(key,readText){
 requireFact(CASE_KEYS.includes(key),'Original family required');const pins=[];
 async function read(name){const file='multispan-section-three-data/'+name,pin=PINS.find(pin=>pin.file===file);requireFact(pin,'Original pin missing');pins.push(pin);const text=await readText(file,pin);requireFact(typeof text==='string'&&new TextEncoder().encode(text).length===pin.bytes,'Original UTF8 bytes changed');return text;}
 const request=JSON.parse(await read(key+'.full-original-request.json'));
 const [ownedText,worldSource,surfaceUV,planeUV,surfaceSource,planeSource]=await Promise.all([read(key+'.owned-result.json'),read(key+'.actual-world.source0.css'),read(key+'.surface-uv.dimensionless-only.json'),read(key+'.plane-uv.dimensionless-only.json'),read(request.surfaceAsset.sourceId+'.original.source0.css'),read(request.planeAsset.sourceId+'.original.source0.css')]);
 return{key,request,owned:JSON.parse(ownedText),worldSource,dualUV:{surface:JSON.parse(surfaceUV),plane:JSON.parse(planeUV)},parentSources:[surfaceSource,planeSource],pins};
}
export function requireOriginalWorldSourceBinding(source,owned){if(source!==owned.world.source)throw new TypeError('Original World Source0 differs from whole saved result');}
function nativeD1(action){try{return{status:'evaluated',value:action()};}catch(error){requireFact(error instanceof Error,'Actual native derivative Error required');return{status:'native-refused',reason:error.message,nativeErrorName:error.name};}}
export function proveCase(asset){
 const before=structuredClone(asset);requireFact(CASE_KEYS.includes(asset.key),'Original family required');const {request,owned}=asset;
 const section=buildMultiSpanVLinearSurfacePlaneSection(request.surfaceAsset,request.planeAsset,request.options),report=validateMultiSpanVLinearSurfacePlaneSection(section),savedReport=validateMultiSpanVLinearSurfacePlaneSection(owned);
 assertNative(section,owned,'fresh-whole-original');assertNative(report,section.report);assertNative(savedReport,owned.report);
 assertNative(request.surfaceAsset,section.surfaceAsset);assertNative(request.planeAsset,section.planeAsset);assertNative(request.options,section.options);
 requireOriginalWorldSourceBinding(asset.worldSource,section);requireFact(section.world.sourceVersion===0,'Original World Source0 version required');
 assertNative(asset.dualUV.surface,section.pcurves.surface);assertNative(asset.dualUV.plane,section.pcurves.plane);
 for(const [role,chart]of Object.entries(section.pcurves)){requireFact(chart.lengthUnit==='dimensionless'&&chart.coordinateSystem===(role==='surface'?'native-surface-uv':'native-plane-uv'),'Dimensionless original UV identity required');requireFact(chart.curve.controlPoints.every(point=>Object.is(point[2],0)),'Original UV remains in chart Z0');}
 requireFact(section.world.curve.degree===4&&section.world.curve.controlPoints.length===17&&section.pcurves.surface.curve.degree===3&&section.pcurves.surface.curve.controlPoints.length===13&&section.pcurves.plane.curve.degree===4&&section.pcurves.plane.curve.controlPoints.length===17,'Original World/dualUV degrees and poles changed');
 requireFact(report.spanCount===4&&section.proof.spans.length===4&&section.observations.length===17,'Whole four-span lineage and17observations required');
 assertNative(report.surfaceDomains,surfaceDomain(request.surfaceAsset.surface));assertNative(report.planeDomains,surfaceDomain(request.planeAsset.surface));
 for(const curve of [section.world.curve,section.pcurves.surface.curve,section.pcurves.plane.curve])assertNative(curveDomain(curve),report.surfaceDomains.u);
 const nativeWorld=parseBaroCadUniformCurveSource(asset.worldSource,createWorldOptions());assertNative(nativeWorld.model,section.world.model);assertNative(nativeWorld.model.objects[0],section.world.curve);assertNative(nativeWorld.domain,report.surfaceDomains.u);
 const samples=sampleCurve(section.world.curve,129);assertNative(nativeWorld.parameters,samples.map(sample=>sample.parameter));assertNative(nativeWorld.pointsMM,samples.map(sample=>sample.point));requireFact(nativeWorld.positions.length===387&&nativeWorld.intervals.length===128,'Original129uniform samples required');
 for(let i=0;i<129;i++){for(let axis=0;axis<3;axis++)requireFact(Object.is(nativeWorld.positions[i*3+axis],Math.fround(samples[i].point[axis]*.001)),'World mm scales toF32 once');if(i>0)assertNative(nativeWorld.intervals[i-1],[nativeWorld.parameters[i-1],nativeWorld.parameters[i]]);}
 const nativeParents=asset.parentSources.map((source,index)=>{requireFact(source===(index===0?request.surfaceAsset.source:request.planeAsset.source),'Exact complete parent file binding required');const native=parseBaroCadSource(source,createParentOptions());assertNative(native.model,section.originalModels[index]);assertNative(native.unrenderedCurveIds,native.model.objects.filter(object=>object.kind==='curve').map(object=>object.id));requireFact(native.curves.length===0,'Parent Curves remain unrendered');for(const surface of native.surfaces){requireFact(surface.mesh.positions.length===459&&surface.mesh.normals.length===459&&surface.mesh.parameters.length===306&&surface.mesh.indices.length===768,'Original153vertices/256triangles Surface preview required');}return native;});
 const derivativeCounts=Object.fromEntries(['world','surfacePcurve','planePcurve','surface','plane'].map(role=>[role,{evaluated:0,refused:0}]));
 for(const observation of section.observations){
  const t=observation.parameter,world=evaluateCurve(section.world.curve,t),surfaceUV=evaluateCurve(section.pcurves.surface.curve,t),planeUV=evaluateCurve(section.pcurves.plane.curve,t);
  assertNative(world,observation.world.d0);assertNative(surfaceUV,observation.surfacePcurve.d0);assertNative(planeUV,observation.planePcurve.d0);
  assertNative(evaluateSurface(request.surfaceAsset.surface,surfaceUV[0],surfaceUV[1]),observation.surface.d0);assertNative(evaluateSurface(request.planeAsset.surface,planeUV[0],planeUV[1]),observation.plane.d0);
  const actions={world:()=>evaluateCurveD1(section.world.curve,t),surfacePcurve:()=>evaluateCurveD1(section.pcurves.surface.curve,t),planePcurve:()=>evaluateCurveD1(section.pcurves.plane.curve,t),surface:()=>evaluateSurfaceD1(request.surfaceAsset.surface,surfaceUV[0],surfaceUV[1]),plane:()=>evaluateSurfaceD1(request.planeAsset.surface,planeUV[0],planeUV[1])};
  for(const [role,action]of Object.entries(actions)){const result=nativeD1(action);assertNative(result,observation[role].d1);derivativeCounts[role][result.status==='evaluated'?'evaluated':'refused']++;}
 }
 assertNative(derivativeCounts,report.derivativeCounts);for(const role of ['world','surfacePcurve','planePcurve','surface'])assertNative(derivativeCounts[role],{evaluated:14,refused:3});assertNative(derivativeCounts.plane,{evaluated:17,refused:0});
 assertNative(asset,before,'immutable-original-inputs');return{section,report,model:nativeWorld.model,nativeWorld,nativeParents,originalModels:section.originalModels,derivativeCounts};
}
/** Native refusals use injected actual public parsers; the fixture never allocates a target. */
export function runSectionSourceRefusals(asset,{parseWorld,parseParent},afterRefusal=()=>{}){
 const before=structuredClone(asset),rows=[];let getterCalls=0;const mutate=(value,edit)=>{const copy=structuredClone(value);edit(copy);return copy;},build=r=>buildMultiSpanVLinearSurfacePlaneSection(r.surfaceAsset,r.planeAsset,r.options),validate=validateMultiSpanVLinearSurfacePlaneSection;
 const request=asset.request,owned=asset.owned;
 const recipes=[
 ['provider-budget',()=>build(mutate(request,r=>r.options.maximumObservations=18)),'MultiSpanVLinearSurfacePlaneSectionError','BUDGET'],
 ['provider-source',()=>build(mutate(request,r=>r.surfaceAsset.source='@model {')),'MultiSpanVLinearSurfacePlaneSectionError','SOURCE'],
 ['provider-source-binding',()=>build(mutate(request,r=>r.surfaceAsset.surface.controlPoints[0][0][0]+=.125)),'MultiSpanVLinearSurfacePlaneSectionError','SOURCE'],
 ['provider-getter',()=>{const r=structuredClone(request);Object.defineProperty(r.surfaceAsset,'source',{enumerable:true,get(){getterCalls++;return request.surfaceAsset.source;}});return build(r);},'MultiSpanVLinearSurfacePlaneSectionError','INPUT'],
 ['owned-span',()=>validate(mutate(owned,r=>r.report.spanCount=3)),'MultiSpanVLinearSurfacePlaneSectionError','OWNED'],
 ['owned-world-pole',()=>validate(mutate(owned,r=>r.world.curve.controlPoints[0][0]+=.125)),'MultiSpanVLinearSurfacePlaneSectionError','OWNED'],
 ['owned-surface-uv',()=>validate(mutate(owned,r=>r.pcurves.surface.curve.controlPoints[0][0]+=.125)),'MultiSpanVLinearSurfacePlaneSectionError','OWNED'],
 ['owned-bound',()=>validate(mutate(owned,r=>r.proof.bounds.worldToSurface.upper=.5)),'MultiSpanVLinearSurfacePlaneSectionError','OWNED'],
 ['owned-whole-parent',()=>validate(mutate(owned,r=>r.originalModels[0].objects.shift())),'MultiSpanVLinearSurfacePlaneSectionError','OWNED'],
 ['owned-C0-observation',()=>validate(mutate(owned,r=>r.observations.find(o=>o.world.d1.status==='native-refused').world.d1.reason='healed')),'MultiSpanVLinearSurfacePlaneSectionError','OWNED'],
 ['owned-getter',()=>{const c=structuredClone(owned);Object.defineProperty(c,'proof',{enumerable:true,get(){getterCalls++;return owned.proof;}});return validate(c);},'MultiSpanVLinearSurfacePlaneSectionError','OWNED'],
 ['external-world-source',()=>requireOriginalWorldSourceBinding(owned.world.source+' ',owned),'TypeError',null],
 ['uniform-mixed-parent',()=>parseWorld(request.surfaceAsset.source,createWorldOptions()),'BaroCadUniformCurveSourceError','PROFILE'],
 ['uniform-count',()=>parseWorld(owned.world.source,{...createWorldOptions(),uniformCurveDisplay:{version:1,count:130}}),'BaroCadUniformCurveSourceError','OPTIONS'],
 ['uniform-f32',()=>parseWorld(owned.world.source,{...createWorldOptions(),unitsPerMillimeter:1e300}),'BaroCadUniformCurveSourceError','POSITIONS'],
 ['surface-world-only',()=>parseParent(owned.world.source,createParentOptions()),'RangeError',null]
 ];
 for(const [name,action,errorName,code]of recipes){let error;try{action();}catch(caught){error=caught;}requireFact(error instanceof Error&&error.name===errorName&&(error.code??null)===code,'Actual refusal differs: '+name);requireFact(getterCalls===0,'Input accessor invoked');assertNative(asset,before);if(name==='provider-source')requireFact(error.cause?.ok===false&&Array.isArray(error.cause.diagnostics)&&error.cause.diagnostics.some(diagnostic=>diagnostic.code==='SYNTAX'),'Actual failed compiler result and diagnostics required');const row={...errorReceipt(name,error),getterCalls,acceptedRetained:true};rows.push(row);afterRefusal(row);}
 return{refusals:rows,getterCalls,acceptedRetained:true};
}
export async function runSectionTransportRefusals(url,loadAsync,afterRefusal=()=>{}){
 const rows=[];let getterCalls=0;const event=(events,value)=>{requireFact(value.loadedBytes>0,'Actual nonempty shared progress required');events.push({...value});};
 async function refuse(name,transport,errorName,code,expectedRequestDelta,callerError){const progress=[];let error;try{await loadAsync(url,transport(progress));}catch(caught){error=caught;}requireFact(error instanceof Error&&error.name===errorName&&(error.code??null)===code,'Actual transport refusal differs: '+name);if(callerError)requireFact(error===callerError,'Caller Error identity changed');requireFact(getterCalls===0,'Transport accessor invoked');const row={...errorReceipt(name,error),progress,expectedRequestDelta,callerErrorIdentityRetained:callerError?error===callerError:null,getterCalls,acceptedRetained:true};rows.push(row);await afterRefusal(row);}
 await refuse('preabort',()=>{const c=new AbortController();c.abort();return{signal:c.signal};},'AbortError','ABORT_ERR',0);
 await refuse('progressfalse',events=>({onProgress(value){event(events,value);return false;}}),'AbortError','ABORT_ERR',1);
 await refuse('callbackabort',events=>{const c=new AbortController();return{signal:c.signal,onProgress(value){event(events,value);c.abort();}};},'AbortError','ABORT_ERR',1);
 const callerError=new Error('standing multi-span caller progress error');await refuse('standingcallerError',events=>({onProgress(value){event(events,value);throw callerError;}}),'Error',null,1,callerError);
 await refuse('onProgressgetter',()=>{const transport={};Object.defineProperty(transport,'onProgress',{enumerable:true,get(){getterCalls++;return()=>{};}});return transport;},'TypeError',null,0);
 requireFact(rows.length===5&&getterCalls===0&&rows.slice(1,4).every(row=>row.progress.length>0),'Five actual transport refusals/getter0 required');return{refusals:rows,getterCalls,acceptedRetained:true};
}
