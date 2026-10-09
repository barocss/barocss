import { createSnapshot } from './snapshot.mjs';
import { sweepBox } from './sweep.mjs';
import { closestCandidate } from './geometry.mjs';
import { closestSegmentBox } from './reference.mjs';
import { CASES } from './fixture.mjs';
function assert(condition,message){if(!condition)throw new Error(message);}
const clone=x=>JSON.parse(JSON.stringify(x));
export function runControls(){const records=[];function refuses(name,action,code){let error;try{action();}catch(e){error=e;}
 assert(!!error && error.code===code,name+' expected '+code);records.push({name,code:error.code});}
 const fixture=CASES.find(c=>c.name==='WALL'),input=clone(fixture.scene),world=createSnapshot(input),before=world.getSnapshot();
 input.boxes[0].centerM[0]=4;assert(JSON.stringify(world.getSnapshot())===JSON.stringify(before),'input copy');
 const returned=world.getSnapshot();returned.boxes[0].halfExtentsM[0]=3;assert(JSON.stringify(world.getSnapshot())===JSON.stringify(before),'state copy');
 const output=world.query(fixture.query);output.normalM.fill(9);output.pointM.fill(9);assert(world.query(fixture.query).normalM[0]===-1,'output copy');
 const query=clone(fixture.query),queryBefore=JSON.stringify(query);world.query(query);assert(JSON.stringify(query)===queryBefore,'query unchanged');
 const invalid=[['stale',{...query,revision:'stale'},'STALE_SCENE'],['unknown-exclude',{...query,excludeId:'missing'},'INVALID_INPUT'],
 ['nan',{...query,centerM:[NaN,0,0]},'INVALID_INPUT'],['oversize',{...query,displacementM:[2,1,0]},'INVALID_INPUT'],['extra',{...query,dt:1},'INVALID_INPUT'],
 ['short-tuple',{...query,centerM:[0,0]},'INVALID_INPUT']];
 for(const [name,q,code]of invalid){refuses(name,()=>world.query(q),code);assert(JSON.stringify(world.getSnapshot())===JSON.stringify(before),'retention '+name);}
 let getterCount=0;const accessor={...query};Object.defineProperty(accessor,'centerM',{get(){getterCount++;return [0,0,0];},enumerable:true});
 refuses('accessor',()=>world.query(accessor),'INVALID_INPUT');assert(getterCount===0,'accessor was called');
 const badScenes=[['cap33',{revision:'sweepRef1',boxes:Array.from({length:33},(_,i)=>({...fixture.scene.boxes[0],id:'box'+i}))}],
 ['duplicate',{...fixture.scene,boxes:[fixture.scene.boxes[0],fixture.scene.boxes[0]]}],['extent',{...fixture.scene,boxes:[{...fixture.scene.boxes[0],halfExtentsM:[0,1,1]}]}],
 ['quaternion',{...fixture.scene,boxes:[{...fixture.scene.boxes[0],orientationXYZW:[0,0,0,2]}]}],['scene-extra',{...fixture.scene,gravity:0}]];
 for(const [name,s]of badScenes)refuses(name,()=>createSnapshot(s),'INVALID_INPUT');
 const sparse={...fixture.scene,boxes:new Array(1)};refuses('sparse-scene',()=>createSnapshot(sparse),'INVALID_INPUT');
 const accessorBoxes=[fixture.scene.boxes[0]];Object.defineProperty(accessorBoxes,'0',{get(){getterCount++;return fixture.scene.boxes[0];},enumerable:true});
 refuses('box-list-accessor',()=>createSnapshot({...fixture.scene,boxes:accessorBoxes}),'INVALID_INPUT');assert(getterCount===0,'box list accessor invoked');
 const zeroScene=clone(fixture.scene);zeroScene.boxes[0].orientationXYZW[1]=-0;const zeroWorld=createSnapshot(zeroScene);assert(Object.is(zeroWorld.getSnapshot().boxes[0].orientationXYZW[1],-0),'original signed-zero snapshot');zeroWorld.dispose();
 const tied=[['z-first',.5],['m-tied',.5+1.6e-9],['a-too-late',.5+3.2e-9]].map(([id,x])=>({...fixture.scene.boxes[0],id,centerM:[x,.6,0]}));
 for(const boxes of [tied,tied.toReversed(),[tied[1],tied[2],tied[0]]]){const tieWorld=createSnapshot({revision:'sweepRef1',boxes});assert(tieWorld.query(fixture.query).bodyId==='m-tied','Ties must be anchored to global earliest TOI');tieWorld.dispose();}
 const angle=Math.PI/7,scale=1+5e-13;
 const nearUnit={...fixture.scene.boxes[0],orientationXYZW:[0,0,Math.sin(angle/2)*scale,Math.cos(angle/2)*scale]};
 const nearWorld=createSnapshot({revision:'sweepRef1',boxes:[nearUnit]});
 assert(nearWorld.getSnapshot().boxes[0].orientationXYZW.every((v,i)=>Object.is(v,nearUnit.orientationXYZW[i])),'Original near-unit quaternion bytes');
 const candidate=closestCandidate([-.5,.6,0],nearUnit),independent=closestSegmentBox([-.5,.6,0],nearUnit);
 assert(Math.abs(candidate.distanceM-independent.distanceM)<=1e-12,'Near-unit rotation distance');
 assert(Math.hypot(...candidate.normalM.map((v,i)=>v-independent.normalM[i]))<=1e-12,'Near-unit rotation normal');nearWorld.dispose();
 const grazing=CASES.find(c=>c.name==='STEP_GRAZE');refuses('diagnostic-cap1',()=>sweepBox(grazing.query.centerM,grazing.query.displacementM,grazing.scene.boxes[0],1),'ITERATION_LIMIT');
 const touching=CASES.find(c=>c.name==='TOUCH_ZERO');const overlapScene={...fixture.scene,boxes:[{...fixture.scene.boxes[0],id:'touch'}, {...fixture.scene.boxes[0],id:'inside',centerM:[.3,.6,0]}]};
 const pair=createSnapshot(overlapScene);refuses('hit0-does-not-skip-overlap',()=>pair.query(touching.query),'INITIAL_OVERLAP');assert(JSON.stringify(pair.getSnapshot())===JSON.stringify(overlapScene),'complete refusal retention');pair.dispose();
 assert(JSON.stringify(world.getSnapshot())===JSON.stringify(before),'accepted snapshot unchanged');world.dispose();world.dispose();
 refuses('disposed-query',()=>world.query(query),'DISPOSED');refuses('disposed-snapshot',()=>world.getSnapshot(),'DISPOSED');
 return {passed:true,records,refusals:records.length,inputStateOutputCopies:true,queryInputUnchanged:true,gettersCalled:getterCount,completeSceneRetention:true,diagnosticCapOnly:true,globalMinimumTiePermutationControl:true,nearUnitRotationAndOriginalBits:true};
}
