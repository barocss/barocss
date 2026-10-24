import { sampleCurve } from '@barocss/cad';
import { parseBaroCadSelectedUniformCurveSource } from '@barocss/cad-interop/native-selected-uniform-curve';
import { BaroCADSelectedUniformCurvePixi3DLoader } from '@barocss/cad-interop/pixi3d-selected-uniform-curve';
import { DRAW_MODES } from 'pixi.js';
import { createNativeOptions, requireFact, assertNative, assertBuffer, proveCurveEditAsset, SourceCurveEditPixi3DHostError,
 runCurveEditSourceRefusals, runCurveEditTransportRefusals } from './source-curve-control-polygon-pixi3d-fixture.mjs';
import { observeSourceCurveEditPixi3DResult } from './source-curve-control-polygon-pixi3d-observer.mjs';
const NATIVE_KEYS=['format','version','mode','source','model','curveId','options','domain','parameters','pointsMM','intervals','positions','quality','selectedObjectIndex','curve','unrenderedObjectIds'];
const clone=value=>structuredClone(value),nativeFields=result=>Object.fromEntries(NATIVE_KEYS.map(key=>[key,result[key]]));
function pose(object){return object.rotationQuaternion?{position:Array.from(object.position.array),quaternion:Array.from(object.rotationQuaternion.array),scale:Array.from(object.scale.array),visible:object.visible}:{position:[object.position.x,object.position.y],scale:[object.scale.x,object.scale.y],pivot:[object.pivot.x,object.pivot.y],skew:[object.skew.x,object.skew.y],rotation:object.rotation,visible:object.visible};}
/** Stage, Camera, renderer and lighting are caller-owned. */
export function createSourceCurveControlPolygonPixi3DHost({stage,onChange=()=>{}}){
 let accepted=null,peakLivePairs=0;const records=[],allResources=[],events=[];
 const counters={adapterAttempts:0,parseAttempts:0,loadAttempts:0,acceptedResults:0,callbacks:0,synchronousRefusals:0,transportRefusals:0,progressEvents:0};
 const livePairs=()=>allResources.filter(row=>['root','mesh','geometry','material'].some(name=>row[name+'Disposals']===0)).length;
 function loader(options){counters.adapterAttempts++;return new BaroCADSelectedUniformCurvePixi3DLoader(options);}
 function parse(source,options=createNativeOptions()){counters.parseAttempts++;return loader(options).parse(source);}
 function loadAsync(url,curveId,transport){counters.loadAttempts++;return loader(createNativeOptions(curveId)).loadAsync(url,transport);}
 function binding(condition,message){if(!condition)throw new SourceCurveEditPixi3DHostError('SOURCE_BINDING',message);}
  function neutral(source, model, curveId) {
    const native = parseBaroCadSelectedUniformCurveSource(source, createNativeOptions(curveId));
    assertNative(native.model, model, 'complete-native-Model');
    requireFact(native.source === source && native.selectedObjectIndex === 1 && native.curveId === curveId, 'Full source selection lost original qualification');
    assertNative(native.unrenderedObjectIds, ['context_curve', 'context_plane']);
    assertNative(native.curve, model.objects[1]);
    requireFact(native.curve !== native.model.objects[1] && native.curve.controlPoints !== native.model.objects[1].controlPoints, 'Selected occurrence must be independent');
    const samples = sampleCurve(model.objects[1], 129);
    assertNative(native.parameters, samples.map(sample => sample.parameter)); assertNative(native.pointsMM, samples.map(sample => sample.point));
    requireFact(native.intervals.length === 128, 'Exactly 128 original parameter intervals required');
    for (const [index, interval] of native.intervals.entries()) assertNative(interval, [native.parameters[index], native.parameters[index + 1]]);
    for (const [index, sample] of samples.entries()) for (let axis = 0; axis < 3; axis++) requireFact(Object.is(native.positions[index * 3 + axis], Math.fround(sample.point[axis] * 0.001)), 'Native Float32 scale must occur once');
    return native;
  }
 function verifyTarget(result,native){
  assertNative(nativeFields(result),native,'public-target-whole-native');const {root,mesh}=result,geometry=mesh.geometry,material=mesh.material;
  requireFact(root.parent===null&&root.children.length===1&&root.children[0]===mesh&&mesh.parent===root,'One detached original root/Mesh required');
  requireFact(root.name===native.model.name&&mesh.name===native.curveId,'Original model/Curve names changed');
  requireFact(geometry.positions.componentType===5126&&geometry.positions.componentCount===3&&geometry.positions.buffer.length===387&&geometry.indices.componentType===5123,'Actual selected geometry attributes changed');
  assertBuffer(geometry.positions.buffer,native.positions);assertBuffer(geometry.indices.buffer,Array.from({length:129},(_,i)=>i));
  assertBuffer(geometry.normals.buffer,Array.from({length:387},(_,i)=>i%3===2?1:0));
  requireFact(material.drawMode===DRAW_MODES.LINE_STRIP&&material.unlit&&material.doubleSided,'Unlit LINE_STRIP material required');assertBuffer(material.baseColor.rgba,[Math.fround(40/255),Math.fround(201/255),Math.fround(235/255),1]);
  assertNative(mesh.barocss,{role:'selected-uniform-curve-display-line',modelName:native.model.name,curveId:native.curveId,sourceVersion:0,lengthUnit:'mm',coordinateSystem:'right-handed-z-up',mode:native.mode,
   selectedObjectIndex:native.selectedObjectIndex,unrenderedObjectIds:native.unrenderedObjectIds,nativeDomain:native.domain,nativeParameters:native.parameters,nativeIntervals:native.intervals,quality:native.quality});
  for(const object of [root,mesh]){assertNative(Array.from(object.position.array),[0,0,0]);assertNative(Array.from(object.rotationQuaternion.array),[0,0,0,1]);assertNative(Array.from(object.scale.array),[1,1,1]);}
 }
 function prepare(asset,source,edit,native,result,state){
  const resources=observeSourceCurveEditPixi3DResult(result);allResources.push(resources);peakLivePairs=Math.max(peakLivePairs,livePairs());
  events.push({type:'prepared',family:asset.family,state,livePairs:livePairs(),totalPairs:allResources.length});
  try{verifyTarget(result,native);}catch(error){result.dispose();result.dispose();throw error;}
  return {asset,source,edit,native,result,readout:clone({source,model:native.model,native,edit}),state,resources};
 }
 function admit(record){const previous=accepted;stage.addChild(record.result.root);accepted=record;records.push(record);counters.acceptedResults++;
  previous?.result.dispose();previous?.result.dispose();events.push({type:'accepted',family:record.asset.family,state:record.state,livePairs:livePairs()});counters.callbacks++;onChange(record);return record;
 }
 function capture(){requireFact(accepted,'Accepted complete original required');const record=accepted,r=record.resources;
  const objects=[];function visit(object){objects.push({object,parent:object.parent,children:[...(object.children??[])],pose:pose(object)});for(const child of object.children??[])visit(child);}visit(stage);
  return {record,asset:record.asset,native:record.native,edit:record.edit,result:record.result,readout:record.readout,resources:r,cpu:clone({asset:record.asset,native:record.native,edit:record.edit,source:record.source,readout:record.readout}),
   positionAttribute:r.geometry.positions,normalAttribute:r.geometry.normals,indexAttribute:r.geometry.indices,positionArray:r.geometry.positions.buffer,normalArray:r.geometry.normals.buffer,indexArray:r.geometry.indices.buffer,
   positions:Array.from(r.geometry.positions.buffer),normals:Array.from(r.geometry.normals.buffer),indices:Array.from(r.geometry.indices.buffer),metadata:record.result.mesh.barocss,metadataCopy:clone(record.result.mesh.barocss),
   counts:['root','mesh','geometry','material'].map(name=>r[name+'Disposals']),total:allResources.length,callbacks:counters.callbacks,objects};
 }
 function retained(before){const r=accepted,s=r.resources;
  requireFact(r===before.record&&r.asset===before.asset&&r.native===before.native&&r.edit===before.edit&&r.result===before.result&&r.readout===before.readout&&s===before.resources,'Refusal changed complete accepted refs');
  assertNative({asset:r.asset,native:r.native,edit:r.edit,source:r.source,readout:r.readout},before.cpu);
  requireFact(r.result.root===s.root&&r.result.mesh===s.mesh&&s.mesh.geometry===s.geometry&&s.mesh.material===s.material&&s.geometry.positions===before.positionAttribute&&s.geometry.normals===before.normalAttribute&&s.geometry.indices===before.indexAttribute&&
   s.geometry.positions.buffer===before.positionArray&&s.geometry.normals.buffer===before.normalArray&&s.geometry.indices.buffer===before.indexArray,'Refusal changed target/attribute/buffer refs');
  assertBuffer(before.positionArray,before.positions);assertBuffer(before.normalArray,before.normals);assertBuffer(before.indexArray,before.indices);
  requireFact(r.result.mesh.barocss===before.metadata,'Refusal changed metadata ref');assertNative(before.metadata,before.metadataCopy);
  assertNative(['root','mesh','geometry','material'].map(name=>s[name+'Disposals']),before.counts);
  requireFact(allResources.length===before.total&&counters.callbacks===before.callbacks,'Refusal allocated resources or callback');
  for(const row of before.objects){requireFact(row.object.parent===row.parent&&(row.object.children??[]).length===row.children.length&&(row.object.children??[]).every((o,i)=>o===row.children[i]),'Refusal changed caller Stage order/hierarchy');if(row.pose)assertNative(pose(row.object),row.pose);}
 }
 const host={get accepted(){return accepted;},get records(){return records;},get allResources(){return allResources;},get events(){return events;},get counts(){return{...counters,pairs:allResources.length,sets:allResources.length,livePairs:livePairs(),peakLivePairs};},get peakLivePairs(){return peakLivePairs;},
    loadOriginal(asset) {
      const proof = proveCurveEditAsset(asset), native = neutral(asset.originalSource, proof.originalModel, asset.request.curveId);
      return admit(prepare(asset, asset.originalSource, null, native, parse(asset.originalSource, createNativeOptions(asset.request.curveId)), 'original'));
    },
    apply(asset) {
      binding(accepted?.source === asset.request.source, 'The authored edit request must bind the accepted complete original source');
      const proof = proveCurveEditAsset(asset);
      assertNative(accepted.native.model, proof.originalModel, 'accepted-full-original-Model');
      const native = neutral(asset.candidateSource, proof.candidateModel, asset.request.curveId);
      return admit(prepare(asset, asset.candidateSource, proof.edited, native, parse(asset.candidateSource, createNativeOptions(asset.request.curveId)), 'edited'));
    },
    async coldReopen(asset, url, transport = {}) {
      binding(accepted?.source === asset.candidateSource && accepted.edit !== null, 'Cold reopen must bind the current complete edited source');
      const previous = accepted, proof = proveCurveEditAsset(asset);
      assertNative(previous.edit, proof.edited, 'accepted-whole-edited-proof');
      const native = neutral(asset.candidateSource, proof.candidateModel, asset.request.curveId);
      assertNative(native, previous.native, 'cold-native-before-target');
      const result = await loadAsync(url, asset.request.curveId, transport);
      let candidate;
      try {
        binding(accepted === previous && result.source === asset.candidateSource, 'Cold target source/accepted qualification changed');
        candidate = prepare(asset, asset.candidateSource, proof.edited, native, result, 'cold');
        assertNative(candidate.readout, previous.readout, 'whole-cold-readout'); assertBuffer(candidate.resources.positionArray, previous.resources.positions); assertBuffer(candidate.resources.normalArray, previous.resources.normals); assertBuffer(candidate.resources.indexArray, previous.resources.indices);
      } catch (error) { result.dispose(); result.dispose(); throw error; }
      return admit(candidate);
    },
    runRefusals(asset,afterRefusal=()=>{},staleRequest){const before=capture();
     const refusals=runCurveEditSourceRefusals(asset,parse,value=>host.apply(value),row=>{retained(before);Object.assign(row,{pairsBefore:before.total,pairsAfter:allResources.length});afterRefusal(row);retained(before);},staleRequest);
     counters.synchronousRefusals+=refusals.length;events.push({type:'sync-refusals',count:refusals.length,getterCalls:0});return refusals;
    },
    async runTransportRefusals(url,afterRefusal=()=>{}){const before=capture();
     const refusals=await runCurveEditTransportRefusals(transport=>loadAsync(url,before.native.curveId,transport),async row=>{retained(before);Object.assign(row,{pairsBefore:before.total,pairsAfter:allResources.length});counters.progressEvents+=row.progressEvents;await afterRefusal(row);retained(before);});
     counters.transportRefusals+=refusals.length;events.push({type:'transport-refusals',count:refusals.length,getterCalls:0});return refusals;
    },
    dispose(){if(!accepted)return;const previous=accepted;accepted=null;previous.result.dispose();previous.result.dispose();events.push({type:'disposed',livePairs:livePairs()});counters.callbacks++;onChange(null);}
 };return host;
}
