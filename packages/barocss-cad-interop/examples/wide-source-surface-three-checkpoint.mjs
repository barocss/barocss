import { BaroCADLoader } from '@barocss/cad-interop/three';
import { editSourceSurfaceControlNetWide, validateSourceSurfaceControlNetWideEdit, SourceSurfaceControlNetWideError } from '@barocss/cad';
import { createNativeOptions, proveCase, requireFact, assertNative, assertBuffer } from './wide-source-surface-three-fixture.mjs';
import { observeWideSourceSurfaceResult } from './wide-source-surface-three-observer.mjs';

export class LoaderWideSourceSurfaceHostBindingError extends Error {
  constructor(code,message) { super(message);this.name='LoaderWideSourceSurfaceHostBindingError';this.code=code; }
}
function errorReceipt(error) {
  const result={name:error?.name??null,code:error?.code??null,message:error?.message??String(error)};
  if(error?.cause!==undefined)result.cause=error.cause instanceof Error?{name:error.cause.name,code:error.cause.code??null,message:error.cause.message}:error.cause;
  return result;
}
function nativeData(result) {
  return {source:result.source,model:result.model,diagnostics:result.diagnostics,unrenderedCurveIds:result.unrenderedCurveIds,
    surfaces:result.surfaces.map(surface=>({surfaceId:surface.surfaceId,packet:surface.packet,report:surface.report,mesh:{surfaceId:surface.mesh.surfaceId,revision:surface.mesh.revision,positions:Array.from(surface.mesh.positions),normals:Array.from(surface.mesh.normals),parameters:Array.from(surface.mesh.parameters),indices:Array.from(surface.mesh.indices)}})),
    curves:result.curves.map(curve=>({curveId:curve.curveId,sample:curve.sample,positions:Array.from(curve.positions)}))};
}
function pose(object) { return {position:object.position.toArray(),quaternion:object.quaternion.toArray(),scale:object.scale.toArray(),visible:object.visible}; }

export function createWideSourceSurfaceThreeHost({scene,onChange=()=>{}}) {
  let accepted=null,disposed=false,callbacks=0,parseCalls=0,loadCalls=0,sourceRefusals=0,transportRefusals=0,progressEvents=0,peakLivePairs=0;
  const records=[],allResources=[],allGroups=[],events=[],loader=new BaroCADLoader(createNativeOptions());
  const remembered=new WeakMap();
  const livePairs=()=>allResources.filter(row=>row.geometryDisposals===0 && row.materialDisposals===0).length;
  function remember(result) {
    if(remembered.has(result))return remembered.get(result);
    const resources=observeWideSourceSurfaceResult(result);
    requireFact(resources.length===2,'Actual two Surface resources required');
    allResources.push(...resources);allGroups.push(result.group);remembered.set(result,resources);
    peakLivePairs=Math.max(peakLivePairs,livePairs());
    events.push({kind:'prepared',groups:allGroups.length,pairs:allResources.length,livePairs:livePairs()});
    return resources;
  }
  function guardRequest(request,expectedSource=accepted?.source) {
    const descriptor=request && Object.getOwnPropertyDescriptor(request,'source');
    if(expectedSource===undefined || !descriptor || !('value'in descriptor) || descriptor.value!==expectedSource)
      throw new LoaderWideSourceSurfaceHostBindingError('SOURCE_BINDING','Request source differs from accepted complete asset');
  }
  function guardCandidate(source,whole=accepted?.proof.edit) {
    if(!whole || source!==whole.source)
      throw new LoaderWideSourceSurfaceHostBindingError('INCOMPLETE_ASSET','Candidate source differs from full public edit result source');
  }
  function checkTarget(result,source,neutral) {
    requireFact(result.source===source,'Actual target source binding differs');
    assertNative(nativeData(result),nativeData(neutral),'Actual target whole neutral data differs');
    requireFact(result.group.parent===null && result.group.children.length===2,'Candidate whole Group must be detached');
    assertNative(result.group.children.map(object=>object.name),['target_surface','context_plane']);
    for(const object of [result.group,...result.group.children]) {
      assertNative(object.position.toArray(),[0,0,0]);assertNative(object.quaternion.toArray(),[0,0,0,1]);assertNative(object.scale.toArray(),[1,1,1]);
      requireFact(object.visible===true,'Whole context Surface must remain visible=true');
    }
    const resources=remembered.get(result);
    for(const row of resources) {
      const preview=result.surfaces.find(surface=>surface.surfaceId===row.object.name);
      requireFact(preview && row.object.parent===result.group,'Actual Surface resource qualification differs');
      requireFact(row.object.geometry===row.geometry && row.object.material===row.material,'Actual owned resources differ');
      requireFact(row.material.type==='MeshNormalMaterial' && row.material.side===2,'Default DoubleSide normal material required');
      assertNative(Object.keys(row.geometry.attributes).sort(),['_CAD_UV','normal','position'].sort());
      for(const[name,size,values]of[['position',3,preview.mesh.positions],['normal',3,preview.mesh.normals],['_CAD_UV',2,preview.mesh.parameters]]) {
        const capture=row.attributes[name];
        requireFact(row.geometry.getAttribute(name)===capture.attribute && capture.attribute.array===capture.array,'Actual attribute references differ');
        requireFact(capture.attribute.itemSize===size && capture.attribute.normalized===false,'Actual attribute format differs');
        requireFact(capture.array!==values,'Three Float32 attribute must retain its actual independent copy');
        assertBuffer(capture.array,values);assertBuffer(capture.values,values);
      }
      requireFact(row.geometry.index===row.indexAttribute && row.indexAttribute.array===row.indexArray,'Actual index references differ');
      requireFact(row.indexArray===preview.mesh.indices,'Actual Three index/native buffer binding differs');
      assertBuffer(row.indexArray,preview.mesh.indices);assertBuffer(row.indices,preview.mesh.indices);
    }
  }
  function makeReadout(asset,proof,result) {
    return structuredClone({source:result.source,originalSource:asset.originalSource,candidateSource:asset.candidateSource,sourceEdit:proof.edit,validationReport:proof.validationReport,originalModel:proof.originalModel,model:result.model,options:createNativeOptions(),observations:proof.observations,centers:proof.centers,native:nativeData(result)});
  }
  function admit(asset,proof,result,state) {
    requireFact(!disposed,'Host already disposed');
    const previous=accepted,resources=remember(result),record={assetKey:asset.key,family:asset.key,state,asset,proof,sourceEdit:proof.edit,source:result.source,model:result.model,result,resources,readout:makeReadout(asset,proof,result)};
    scene.add(result.group);accepted=record;records.push(record);
    previous?.result.dispose();
    events.push({kind:'admitted',family:asset.key,state,livePairs:livePairs()});callbacks++;onChange(record);
    return record;
  }
  function parse(source) { parseCalls++;const result=loader.parse(source);remember(result);return result; }
  function prepare(asset,state) {
    requireFact(!disposed,'Host already disposed');
    if(state==='original')guardRequest(asset.request,asset.originalSource);else guardRequest(asset.request);
    guardCandidate(asset.candidateSource,asset.owned);
    const proof=proveCase(asset);guardCandidate(asset.candidateSource,proof.edit);
    const source=state==='original'?asset.originalSource:asset.candidateSource,neutral=state==='original'?proof.originalNative:proof.candidateNative;
    let result;
    try {result=parse(source);checkTarget(result,source,neutral);return admit(asset,proof,result,state);}
    catch(error){result?.dispose();throw error;}
  }
  function loadOriginal(asset) { return prepare(asset,'original'); }
  function applyEdit(asset) { return prepare(asset,'edited'); }
  async function coldReopen(asset,url,transport={}) {
    requireFact(accepted?.family===asset.key,'Cold input must bind the accepted family');
    guardRequest(asset.request,asset.originalSource);guardCandidate(asset.candidateSource,accepted.result);guardCandidate(asset.candidateSource,accepted.proof.edit);
    const proof=proveCase(asset);guardCandidate(asset.candidateSource,proof.edit);
    const previousReadout=structuredClone(accepted.readout),originalParse=loader.parse;
    loader.parse=function(source){parseCalls++;const result=originalParse.call(this,source);remember(result);return result;};
    let result;
    try {
      loadCalls++;result=await loader.loadAbortable(url,transport);
      checkTarget(result,asset.candidateSource,proof.candidateNative);
      assertNative(makeReadout(asset,proof,result),previousReadout,'Cold whole readout differs from actual edited source');
      return admit(asset,proof,result,'cold-reopen');
    }catch(error){result?.dispose();throw error;}
    finally{loader.parse=originalParse;}
  }
  function capture() {
    requireFact(accepted,'Accepted result required');
    return {record:accepted,asset:accepted.asset,proof:accepted.proof,sourceEdit:accepted.sourceEdit,readout:accepted.readout,result:accepted.result,model:accepted.model,source:accepted.source,
      cpu:structuredClone({asset:accepted.asset,proof:accepted.proof,sourceEdit:accepted.sourceEdit,readout:accepted.readout,native:nativeData(accepted.result)}),sceneChildren:[...scene.children],groupChildren:[...accepted.result.group.children],poses:[accepted.result.group,...accepted.result.group.children].map(object=>({object,pose:pose(object)})),callbacks,pairs:allResources.length,groups:allGroups.length,
      resources:accepted.resources.map(row=>({row,object:row.object,geometry:row.geometry,material:row.material,attributes:Object.fromEntries(Object.entries(row.attributes).map(([name,value])=>[name,{attribute:value.attribute,array:value.array,values:[...value.values]}])),indexAttribute:row.indexAttribute,indexArray:row.indexArray,indices:[...row.indices]}))};
  }
  function retained(before) {
    requireFact(accepted===before.record,'Refusal changed accepted record');
    for(const key of ['asset','proof','sourceEdit','readout','result','model'])requireFact(accepted[key]===before[key],'Refusal changed accepted '+key+' reference');
    requireFact(accepted.source===before.source && callbacks===before.callbacks,'Refusal changed source/callback');
    requireFact(allResources.length===before.pairs && allGroups.length===before.groups,'Refusal allocated successful owned target resources');
    assertNative({asset:accepted.asset,proof:accepted.proof,sourceEdit:accepted.sourceEdit,readout:accepted.readout,native:nativeData(accepted.result)},before.cpu,'Refusal changed full CPU values');
    requireFact(scene.children.length===before.sceneChildren.length && before.sceneChildren.every((object,index)=>scene.children[index]===object),'Refusal changed caller Scene order');
    requireFact(accepted.result.group.children.length===before.groupChildren.length && before.groupChildren.every((object,index)=>accepted.result.group.children[index]===object),'Refusal changed whole Group order');
    for(const item of before.poses)assertNative(pose(item.object),item.pose,'Refusal changed authored pose/visibility');
    for(const item of before.resources){const row=item.row;requireFact(row.object===item.object && row.object.geometry===item.geometry && row.object.material===item.material,'Refusal changed actual resource refs');for(const[name,value]of Object.entries(item.attributes)){requireFact(row.geometry.getAttribute(name)===value.attribute && value.attribute.array===value.array,'Refusal changed attribute refs');assertBuffer(value.array,value.values);}requireFact(row.geometry.index===item.indexAttribute && item.indexAttribute.array===item.indexArray,'Refusal changed index refs');assertBuffer(item.indexArray,item.indices);requireFact(row.geometryDisposals===0 && row.materialDisposals===0,'Refusal disposed accepted resource');}
  }
  async function runRefusals(asset,afterRefusal=()=>{}) {
    requireFact(asset.key==='degree5','Frozen refusal inputs require degree5 family');
    const before=capture(),assetBefore=structuredClone(asset),refusals=[];let getterCalls=0;
    const request=()=>structuredClone(asset.request),owned=()=>structuredClone(asset.owned);
    function invokeNative(action,input) {
      const source=Object.getOwnPropertyDescriptor(input,'source'),accessor=source && !('value'in source);
      const before=accessor?{descriptors:Object.getOwnPropertyDescriptors(input),rest:structuredClone({sourceVersion:input.sourceVersion,surfaceId:input.surfaceId,edits:input.edits})}:structuredClone(input);
      try{return action(input);}
      finally{
        if(accessor){assertNative(Object.getOwnPropertyDescriptors(input),before.descriptors,'Native refusal changed accessor descriptors');assertNative({sourceVersion:input.sourceVersion,surfaceId:input.surfaceId,edits:input.edits},before.rest,'Native refusal changed own data');}
        else assertNative(input,before,'Native refusal changed failed input');
      }
    }
    const actions=[
      {name:'writer-weight-zero',code:'NATIVE',message:'Source Surface control-net wide: Actual complete edited native Surface validation refused',run(){const value=request();value.edits.poleEdits[0].weight=0;return invokeNative(editSourceSurfaceControlNetWide,value);}},
      {name:'writer-unknown-surface',code:'TARGET',message:'Source Surface control-net wide: The selected ID must identify an existing original Surface',run(){const value=request();value.surfaceId='missing_surface';return invokeNative(editSourceSurfaceControlNetWide,value);}},
      {name:'writer-own-getter',code:'INPUT',message:'Source Surface control-net wide: Bounded fields without getters/symbols/hidden data are required',run(){const value=request();Object.defineProperty(value,'source',{enumerable:true,get(){getterCalls++;return asset.originalSource;}});return invokeNative(editSourceSurfaceControlNetWide,value);}},
      {name:'writer-infinite-scalar',code:'INPUT',message:'Source Surface control-net wide: Finite own numbers are required',run(){const value=request();value.edits.poleEdits[0].xMM=Infinity;return invokeNative(editSourceSurfaceControlNetWide,value);}},
      {name:'owned-patch-replacement-tamper',code:'OWNED',message:'Source Surface control-net wide: Owned request/full sources/Model/Surface/provenance/patches/native observations/counters changed',run(){const value=owned();value.patches[0].replacementText+='0';return invokeNative(validateSourceSurfaceControlNetWideEdit,value);}},
      {name:'owned-full-source-binding-mismatch',code:'OWNED',message:'Source Surface control-net wide: Owned request/full sources/Model/Surface/provenance/patches/native observations/counters changed',run(){const value=owned();value.source+=' ';return invokeNative(validateSourceSurfaceControlNetWideEdit,value);}},
      {name:'host-stale-request-source',code:'SOURCE_BINDING',host:true,message:'Request source differs from accepted complete asset',run(){const value={...asset,request:request()};value.request.source=asset.candidateSource;return applyEdit(value);}},
      {name:'host-incomplete-candidate-source',code:'INCOMPLETE_ASSET',host:true,message:'Candidate source differs from full public edit result source',run(){return applyEdit({...asset,candidateSource:asset.candidateSource+' '});}},
      {name:'unsafe-float32-conversion',code:null,target:true,message:'Invalid CAD preview packet: Float32 conversion is not finite',run(){parseCalls++;return new BaroCADLoader({...createNativeOptions(),unitsPerMillimeter:1e35}).parse(asset.originalSource);}},
    ];
    for(const action of actions){let error;try{await action.run();}catch(cause){error=cause;}requireFact(error,'Frozen refusal unexpectedly accepted');
      if(action.host)requireFact(error instanceof LoaderWideSourceSurfaceHostBindingError,'Actual shared host error required');else if(action.target)requireFact(error instanceof RangeError,'Actual native Float32 RangeError required');else requireFact(error instanceof SourceSurfaceControlNetWideError,'Actual wide native error required');
      requireFact((error.code??null)===action.code,'Actual refusal code differs');if(action.message)requireFact(error.message===action.message,'Actual refusal message differs');
      if(action.name==='writer-weight-zero')requireFact(error.cause?.name==='Error' && error.cause.message==='Weights must be in [1e-6, 1e6]','Actual weight cause differs');
      requireFact(getterCalls===0,'Native accessor was invoked');retained(before);assertNative(asset,assetBefore,'Refusal changed original whole asset');
      const receipt={name:action.name,error:errorReceipt(error),getterCalls,inputRetained:true,acceptedRetained:true};refusals.push(receipt);sourceRefusals++;events.push({kind:'source-refusal',name:action.name});await afterRefusal(receipt);retained(before);
    }
    return {refusals,getterCalls,acceptedRetained:true};
  }
  async function runTransportRefusals(url,afterRefusal=()=>{}) {
    const before=capture(),refusals=[];let getterCalls=0;
    const callerError=new Error('Caller progress refusal');
    const pre=new AbortController();pre.abort();const active=new AbortController();
    const accessor={};Object.defineProperty(accessor,'onProgress',{enumerable:true,get(){getterCalls++;return ()=>{};}});
    const progress=[];const observed=value=>{progressEvents++;progress.push({...value});};
    const actions=[
      {name:'pre-aborted',transport:{signal:pre.signal},delta:0},
      {name:'progress-false',transport:{onProgress(value){observed(value);return false;}},delta:1},
      {name:'progress-abort',transport:{signal:active.signal,onProgress(value){observed(value);active.abort();}},delta:1},
      {name:'progress-throw',transport:{onProgress(value){observed(value);throw callerError;}},delta:1,caller:true},
      {name:'transport-accessor',transport:accessor,delta:0,accessor:true},
    ];
    for(const action of actions){let error;const progressBefore=progress.length;loadCalls++;try{await loader.loadAbortable(url,action.transport);}catch(cause){error=cause;}requireFact(error,'Frozen transport unexpectedly accepted');
      if(action.caller)requireFact(error===callerError,'Original caller progress Error identity lost');else if(action.accessor)requireFact(error instanceof TypeError,'Actual descriptor TypeError required');else requireFact(error.name==='AbortError' && error.code==='ABORT_ERR','Actual public AbortError required');
      requireFact(getterCalls===0,'Transport getter was invoked');retained(before);
      const receipt={name:action.name,error:errorReceipt(error),expectedRequestDelta:action.delta,progress:progress.slice(progressBefore),callerErrorIdentity:action.caller?error===callerError:null,getterCalls,acceptedRetained:true};refusals.push(receipt);transportRefusals++;events.push({kind:'transport-refusal',name:action.name});await afterRefusal(receipt);retained(before);
    }
    return {refusals,getterCalls,acceptedRetained:true};
  }
  function dispose() {
    if(disposed)return;disposed=true;
    const previous=accepted;accepted=null;previous?.result.dispose();
    events.push({kind:'cleanup',livePairs:livePairs()});callbacks++;onChange(null);
  }
  function observations() {
    return {counts:host.counts,events:structuredClone(events),accepted:accepted?{assetKey:accepted.assetKey,state:accepted.state,source:accepted.source,model:structuredClone(accepted.model),proof:structuredClone(accepted.proof),readout:structuredClone(accepted.readout)}:null,
      records:records.map(record=>({assetKey:record.assetKey,state:record.state,source:record.source,model:structuredClone(record.model),proof:structuredClone(record.proof),readout:structuredClone(record.readout),resources:record.resources.map(row=>({surfaceId:row.object.name,geometryDisposals:row.geometryDisposals,materialDisposals:row.materialDisposals,positions:[...row.attributes.position.values],normals:[...row.attributes.normal.values],parameters:[...row.attributes._CAD_UV.values],indices:[...row.indices]}))}))};
  }
  const host={loadOriginal,applyEdit,coldReopen,runRefusals,runTransportRefusals,guardRequest,guardCandidate,dispose,observations,
    get accepted(){return accepted;},get records(){return records;},get allResources(){return allResources;},get allGroups(){return allGroups;},get events(){return events;},
    get counts(){return{pairs:allResources.length,groups:allGroups.length,livePairs:livePairs(),peakLivePairs,callbacks,parseCalls,loadCalls,sourceRefusals,transportRefusals,progressEvents,geometryDisposals:allResources.reduce((sum,row)=>sum+row.geometryDisposals,0),materialDisposals:allResources.reduce((sum,row)=>sum+row.materialDisposals,0),disposed};}};
  return host;
}
