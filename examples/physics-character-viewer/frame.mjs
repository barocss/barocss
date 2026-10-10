export const DT=1/120,STEPS=240,CONTEXT='characterViewerV1';
export const copyData=x=>structuredClone(x);
export const config=f=>({version:1,profile:'upright-capsule-controller-v1',scene:copyData(f.scene),positionM:[...f.positionM]});
export const command=f=>({dtSeconds:DT,sceneRevision:f.scene.revision,desiredVelocityMps:[...f.requestMps]});
export function bindingsFor(packets,fixture){return packets.map((p,i)=>({contextId:CONTEXT,targetId:p.modelId==='physics-character'?'capsule':'terrain:'+fixture.scene.boxes[i-(packets[0]?.modelId==='physics-character'?1:0)].id,ref:{modelId:p.modelId,surfaceId:p.packet.surfaceId}}));}
export function frameFor(state,bindings){return {contextId:CONTEXT,timeSeconds:state.timeSeconds,poses:bindings.map(b=>({targetId:b.targetId,translation:b.targetId==='capsule'?state.positionM.map(v=>v*1000):[0,0,0],rotation:b.targetId==='capsule'?[...state.orientationXYZW]:[0,0,0,1],scale:[1,1,1]}))};}
export const BASIS={basis:'part-xyz-matches-rhyup'};
