import { createUprightCapsuleQuery } from '@barocss/physics';
export const publicScene=scene=>({version:1,profile:'upright-capsule-box-v1',revision:scene.revision,boxes:scene.boxes});
export function createSnapshot(scene){
 const query=createUprightCapsuleQuery(publicScene(scene));
 return {
  query(input){const hit=query.sweep(input);return hit?{bodyId:hit.bodyId,fraction:hit.toiFraction,normalM:hit.normalFixtureToCapsule,pointM:hit.pointM,segmentM:hit.segmentPointM,iterations:hit.iterations}:null;},
  getSnapshot(){const snapshot=query.getSnapshot();return {revision:snapshot.revision,boxes:snapshot.boxes};},
  dispose(){query.dispose();},
 };
}
