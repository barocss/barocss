import {BaroCADUniformCurvePixi3DLoader} from '@barocss/cad-interop/pixi3d-uniform-curve';
import {Camera,Container3D,Mesh3D,MeshGeometry3D,StandardMaterial,LightingEnvironment} from 'pixi3d/pixi7';
import {Container,DRAW_MODES} from 'pixi.js';
import {assertNative,assertBuffer,createNativeOptions,proveCase,requireFact,requireOriginalSourceBinding,runXYAngleArcSourceRefusals,runXYAngleArcTransportRefusals} from './xy-angle-arc-pixi3d-fixture.mjs';
import {observeXYAngleArcPixi3DResult} from './xy-angle-arc-pixi3d-observer.mjs';
const NATIVE_KEYS=['format','version','mode','source','model','curveId','options','domain','parameters','pointsMM','intervals','positions','quality'];
const clone=value=>structuredClone(value),nativeFields=result=>Object.fromEntries(NATIVE_KEYS.map(key=>[key,result[key]]));
function pose(object){return{position:[object.position.x,object.position.y,object.position.z??null],scale:[object.scale.x,object.scale.y,object.scale.z??null],pivot:object.pivot?[object.pivot.x,object.pivot.y]:null,skew:object.skew?[object.skew.x,object.skew.y]:null,quaternion:object.rotationQuaternion?Array.from(object.rotationQuaternion.array):null,rotation:typeof object.rotation==='number'?object.rotation:null,visible:object.visible,renderable:object.renderable,alpha:object.alpha};}
/** Caller Stage, camera, renderer and lighting remain outside captured result ownership. */
export function createXYAngleArcPixi3DHost({stage,camera,lighting,onChange=()=>{}}){
 requireFact(stage instanceof Container&&!stage.destroyed&&camera instanceof Camera&&!camera.destroyed&&lighting===camera.renderer.plugins.lighting,'Actual live caller Stage/Camera/lighting required');
 let accepted=null,disposed=false,peakLivePairs=0;const records=[],allResources=[],events=[];
 const counters={acceptedResults:0,callbacks:0,parseCalls:0,loadCalls:0,synchronousRefusals:0,transportRefusals:0,progressEvents:0};
 const livePairs=()=>allResources.filter(row=>['root','mesh','geometry','material'].some(name=>row[name+'Disposals']===0)).length;
 function available(){requireFact(!disposed,'The example host was disposed');}
 function parse(source,options=createNativeOptions()){const loader=new BaroCADUniformCurvePixi3DLoader(options);counters.parseCalls++;return loader.parse(source);}
 function loadAsync(url,transport){const loader=new BaroCADUniformCurvePixi3DLoader(createNativeOptions());counters.loadCalls++;return loader.loadAsync(url,transport);}
 function cameraState(){return{position:Array.from(camera.position.array),quaternion:Array.from(camera.rotationQuaternion.array),scale:Array.from(camera.scale.array),world:Array.from(camera.worldTransform.array),view:Array.from(camera.view.array),projection:Array.from(camera.projection.array),viewProjection:Array.from(camera.viewProjection.array),orthographic:camera.orthographic,orthographicSize:camera.orthographicSize,aspect:camera.aspect,near:camera.near,far:camera.far};}
 function verifyTarget(result,proof){assertNative(nativeFields(result),proof.native,'complete-original-public-target-native');const{root,mesh}=result,g=mesh.geometry,m=mesh.material;
  requireFact(root instanceof Container3D&&mesh instanceof Mesh3D&&g instanceof MeshGeometry3D&&m instanceof StandardMaterial&&root.parent===null&&root.children.length===1&&root.children[0]===mesh&&mesh.parent===root,'One detached original root/Mesh required');
  requireFact(root.name===result.model.name&&mesh.name===result.curveId,'Original Model/Curve target names changed');
  requireFact(g.positions.buffer instanceof Float32Array&&g.positions.buffer!==result.positions&&g.positions.buffer!==proof.native.positions&&g.positions.buffer.length===387&&g.positions.componentType===5126&&g.positions.componentCount===3&&g.positions.normalized===false,'Independent129vertex original F32 upload required');
  assertBuffer(g.positions.buffer,proof.native.positions);assertNative(g.positions.min,[0,1,2].map(axis=>Math.min(...Array.from(proof.native.positions).filter((_,index)=>index%3===axis))));assertNative(g.positions.max,[0,1,2].map(axis=>Math.max(...Array.from(proof.native.positions).filter((_,index)=>index%3===axis))));
  requireFact(g.normals.buffer instanceof Float32Array&&g.normals.componentType===5126&&g.normals.componentCount===3&&g.normals.normalized===false,'Derived shader-only normal attribute required');assertBuffer(g.normals.buffer,Array.from({length:387},(_,index)=>index%3===2?1:0));
  requireFact(g.indices.buffer instanceof Uint16Array&&g.indices.componentType===5123&&g.indices.componentCount===1&&g.indices.normalized===false,'Actual sequential Uint16 index attribute required');assertBuffer(g.indices.buffer,Array.from({length:129},(_,index)=>index));
  requireFact(!g.uvs&&!g.tangents&&!g.colors&&!g.targets&&!g.joints&&!g.weights,'Only selected original positions/derivednormals/indices uploaded');
  requireFact(m.unlit&&m.doubleSided&&m.drawMode===DRAW_MODES.LINE_STRIP&&m.camera===camera&&m.lightingEnvironment===lighting,'Original cyan LINE_STRIP and explicit caller camera/lighting required');assertBuffer(m.baseColor.rgba,Float32Array.from([40/255,201/255,235/255,1]));
  for(const object of [root,mesh]){assertBuffer(object.position.array,[0,0,0]);assertBuffer(object.scale.array,[1,1,1]);assertBuffer(object.rotationQuaternion.array,[0,0,0,1]);}
 }
 function prepare(asset,proof,result,state){result.mesh.material.camera=camera;result.mesh.material.lightingEnvironment=lighting;const resources=observeXYAngleArcPixi3DResult(result);requireFact(resources.length===1,'One captured root/mesh/geometry/material set required');allResources.push(...resources);peakLivePairs=Math.max(peakLivePairs,livePairs());events.push({type:'prepared',assetKey:asset.key,state,livePairs:livePairs(),totalPairs:allResources.length});
  try{verifyTarget(result,proof);}catch(error){result.dispose();result.dispose();throw error;}
    const readout = clone({ assetKey: asset.key, source: asset.source, sourceVersion: 0, modelName: result.model.name, curveId: result.curveId, model: result.model,
      request: asset.request, artifact:proof.artifact, originalReport:proof.artifact.report, verification:proof.verification, verificationReport:proof.verificationReport, sameRuntimeRebuilt:proof.sameRuntimeRebuilt, sameRuntimeRebuiltReport:proof.sameRuntimeRebuiltReport, legacySavedControl:proof.legacySavedControl, witness: asset.witness, witnessSummary: proof.witnessSummary,
      nativeDomain: result.domain, parameters: result.parameters, pointsMM: result.pointsMM, intervals: result.intervals,
      displayQuality: result.quality, nativeParameterIsAngle: false, periodic: false, endpointClosed: proof.artifact.report.endpointClosed,
      parameterMeaning: 'original dimensionless rational Curve parameter; not authored angle radians', displayRole: 'approximate-uniform-original-curve' });
    return { assetKey: asset.key, state, asset, proof, source: asset.source, model: result.model, result, resources, readout };
 }
 function admit(record){const previous=accepted;stage.addChild(record.result.root);accepted=record;records.push(record);counters.acceptedResults++;
  previous?.result.dispose();previous?.result.dispose();if(previous)requireFact(previous.resources.every(row=>['root','mesh','geometry','material'].every(name=>row[name+'Disposals']===1)),'Previous captured set must be released before callback');
  events.push({type:'change',assetKey:record.assetKey,state:record.state,livePairs:livePairs()});counters.callbacks++;onChange(record);return record;
 }
 function capture(){available();requireFact(accepted,'Accepted complete original required');const result=accepted.result,g=result.mesh.geometry,m=result.mesh.material;
  const objects=[];function visit(object){objects.push({object,parent:object.parent,children:[...(object.children??[])],pose:pose(object)});for(const child of object.children??[])visit(child);}visit(stage);
  return{record:accepted,asset:accepted.asset,proof:accepted.proof,readout:accepted.readout,model:accepted.model,source:accepted.source,result,resources:accepted.resources,
   cpu:clone({asset:accepted.asset,proof:accepted.proof,readout:accepted.readout,model:accepted.model,source:accepted.source,native:nativeFields(result)}),root:result.root,mesh:result.mesh,geometry:g,material:m,
   positionAttribute:g.positions,normalAttribute:g.normals,indexAttribute:g.indices,positionArray:g.positions.buffer,normalArray:g.normals.buffer,indexArray:g.indices.buffer,
   attributeData:clone({positions:g.positions,normals:g.normals,indices:g.indices}),materialData:{color:Array.from(m.baseColor.rgba),unlit:m.unlit,doubleSided:m.doubleSided,drawMode:m.drawMode},
   materialCamera:m.camera,materialLighting:m.lightingEnvironment,camera:cameraState(),cameraRenderer:camera.renderer,main:Camera.main,lightingMain:LightingEnvironment.main,
   total:allResources.length,records:records.length,callbacks:counters.callbacks,resourceCounts:allResources.map(row=>['root','mesh','geometry','material'].map(name=>row[name+'Disposals'])),objects};
 }
 function retained(before){const r=accepted,g=r.result.mesh.geometry,m=r.result.mesh.material;
  requireFact(r===before.record&&r.asset===before.asset&&r.proof===before.proof&&r.readout===before.readout&&r.model===before.model&&r.source===before.source&&r.result===before.result&&r.resources===before.resources,'Refusal changed complete original/proof/readout refs');
  assertNative({asset:r.asset,proof:r.proof,readout:r.readout,model:r.model,source:r.source,native:nativeFields(r.result)},before.cpu);
  requireFact(r.result.root===before.root&&r.result.mesh===before.mesh&&g===before.geometry&&m===before.material&&g.positions===before.positionAttribute&&g.normals===before.normalAttribute&&g.indices===before.indexAttribute&&g.positions.buffer===before.positionArray&&g.normals.buffer===before.normalArray&&g.indices.buffer===before.indexArray,'Refusal changed original target/threeattribute/buffer refs');
  assertNative({positions:g.positions,normals:g.normals,indices:g.indices},before.attributeData);assertNative({color:Array.from(m.baseColor.rgba),unlit:m.unlit,doubleSided:m.doubleSided,drawMode:m.drawMode},before.materialData);
  requireFact(m.camera===before.materialCamera&&m.lightingEnvironment===before.materialLighting&&camera.renderer===before.cameraRenderer&&camera.renderer.plugins.lighting===lighting&&Camera.main===before.main&&LightingEnvironment.main===before.lightingMain,'Refusal changed caller camera/lighting/global refs');assertNative(cameraState(),before.camera);
  requireFact(allResources.length===before.total&&records.length===before.records&&counters.callbacks===before.callbacks,'Refusal allocated/admitted/called callback');assertNative(allResources.map(row=>['root','mesh','geometry','material'].map(name=>row[name+'Disposals'])),before.resourceCounts);
  for(const row of before.objects){requireFact(row.object.parent===row.parent&&(row.object.children??[]).length===row.children.length&&(row.object.children??[]).every((child,index)=>child===row.children[index]),'Refusal changed caller Stage order/hierarchy');assertNative(pose(row.object),row.pose);}
 }
 const host={get accepted(){return accepted;},get records(){return records;},get allResources(){return allResources;},get events(){return events;},get counts(){return{...counters,pairs:allResources.length,sets:allResources.length,livePairs:livePairs(),peakLivePairs,disposed,...Object.fromEntries(['root','mesh','geometry','material'].map(name=>[name+'Disposals',allResources.reduce((sum,row)=>sum+row[name+'Disposals'],0)]))};},
    load(asset) {
      available(); const proof = proveCase(asset), result = parse(asset.source); return admit(prepare(asset, proof, result, 'original'));
    },
    async coldReopen(freshAsset, url, transport = {}) {
      available(); requireFact(accepted && accepted.assetKey === freshAsset.key, 'Cold reopen must retain the accepted authored family');
      assertNative(freshAsset, accepted.asset, 'fresh-whole-original-files');
      const previous = accepted, proof = proveCase(freshAsset), result = await loadAsync(url, transport);
      // This is the actual successful internal public loadAsync parse, not a transport callback allocation.
      counters.parseCalls++;
      if (disposed || accepted !== previous) { result.dispose(); result.dispose(); throw new TypeError('Accepted original source changed during cold reopen'); }
      try { requireOriginalSourceBinding(result.source, freshAsset.owned); }
      catch (error) { result.dispose(); result.dispose(); throw error; }
      let candidate;
      try {
        candidate=prepare(freshAsset,proof,result,'cold-reopen');
        assertNative(candidate.readout,previous.readout,'complete-cold-original-and-portable-readout');
        assertBuffer(result.mesh.geometry.positions.buffer,previous.resources[0].positions,'cold-original-target-positions');assertBuffer(result.mesh.geometry.normals.buffer,previous.resources[0].normals,'cold-derived-shader-normals');
        assertBuffer(result.mesh.geometry.indices.buffer,previous.resources[0].indices,'cold-original-target-indices');
      } catch(error) {result.dispose();result.dispose();throw error;}
      return admit(candidate);
    },
 runRefusals(assets,afterRefusal=()=>{}){available();requireFact(accepted?.assetKey==='positive_multispan_native_c0'&&accepted.state==='original','Initial positive multispan original required');const before=capture();
  const outcome=runXYAngleArcSourceRefusals(assets,parse,row=>{retained(before);Object.assign(row,{pairsBefore:before.total,pairsAfter:allResources.length});counters.synchronousRefusals++;events.push({type:'refused',...row});afterRefusal(row);retained(before);},'public-pixi3d-source','public-pixi3d-options');return outcome;
 },
 async runTransportRefusals(url,afterRefusal=()=>{}){available();const before=capture();const outcome=await runXYAngleArcTransportRefusals(url,loadAsync,async row=>{retained(before);Object.assign(row,{pairsBefore:before.total,pairsAfter:allResources.length});counters.transportRefusals++;counters.progressEvents+=row.progress.length;events.push({type:'transport-refused',...row});await afterRefusal(row);retained(before);});return outcome;},
 dispose(){if(disposed)return;disposed=true;const previous=accepted;accepted=null;previous?.result.dispose();previous?.result.dispose();requireFact(livePairs()===0,'Captured original sets not released');events.push({type:'disposed',livePairs:livePairs()});counters.callbacks++;onChange(null);}
 };return host;
}
