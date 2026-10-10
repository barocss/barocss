import { observe,timingTrials,packInputs,packOutputs } from './campaign.mjs';
import { runControls } from './controls.mjs';
import { encodeF64 } from '../physics-capsule-sweep-reference/binary.mjs';
const hex=bytes=>Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
export function runReference(){
 const controls=runControls(),first=observe(),second=observe();
 const inputBytes=encodeF64(packInputs(first)),outputBytes=encodeF64(packOutputs(first)),repeatBytes=encodeF64(packOutputs(second));
 const exactRepeat=first.length===31&&hex(outputBytes)===hex(repeatBytes)&&JSON.stringify(first)===JSON.stringify(second);
 const numericalPassed=first.length===31&&first.every(item=>item.passed&&item.snapshotRetained);
 const timing=numericalPassed&&exactRepeat&&controls.passed?timingTrials():null;
 return {first,second,controls,exactRepeat,numericalPassed,timing,passed:numericalPassed&&exactRepeat&&controls.passed&&timing?.passed,
 inputHex:hex(inputBytes),outputHex:hex(outputBytes),publicRoot:true,queryDoesNotMoveBody:true,actualViewer:false,
 profile:{version:1,profile:'upright-capsule-box-v1',radiusM:.15,halfLengthM:.35,basis:'right-handed-xyz-metres-world-y'},
 fieldMapping:{fraction:'toiFraction',normalM:'normalFixtureToCapsule',pointM:'pointM',segmentM:'segmentPointM',iterations:'iterations'}};
}
