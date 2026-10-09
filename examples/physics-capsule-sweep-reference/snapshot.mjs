import { sceneInput,queryInput } from './admission.mjs';
import { SweepRefusal,sweepScene } from './sweep.mjs';
export function createSnapshot(input){const scene=sceneInput(input);let disposed=false;
 const copy=()=>({revision:scene.revision,boxes:scene.boxes.map(b=>({...b,centerM:b.centerM.slice(),halfExtentsM:b.halfExtentsM.slice(),orientationXYZW:b.orientationXYZW.slice()}))});
 function live(){if(disposed)throw new SweepRefusal('DISPOSED','Snapshot is disposed');}
 return {getSnapshot(){live();return copy();},query(input){live();const q=queryInput(input,scene);return sweepScene(q.centerM,q.displacementM,scene.boxes,q.excludeId);},dispose(){disposed=true;}};
}
