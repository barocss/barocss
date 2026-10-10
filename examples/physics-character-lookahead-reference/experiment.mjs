import { numbers,inputRecords,outputRecords,encode,hex } from '../physics-character-controller-reference/binary.mjs';
import { observe,timing } from './campaign.mjs';
import { runControls } from './controls.mjs';
export function runExperiment(){const controls=runControls(),first=observe(),second=observe(),exactRepeat=JSON.stringify(first)===JSON.stringify(second),numericalPassed=first.length===8&&first.every(v=>v.passed);
const inputs=numbers(inputRecords(first)),outputs=numbers(outputRecords(first)),repeat=numbers(outputRecords(second));
const exactRawRepeat=hex(encode(outputs))===hex(encode(repeat));
const cost=numericalPassed&&exactRepeat&&exactRawRepeat&&controls.passed?timing():null;
return {inputHex:hex(encode(inputs)),outputHex:hex(encode(outputs)),negativeZeroInputOffsets:inputs.flatMap((v,i)=>Object.is(v,-0)?[i]:[]),negativeZeroOutputOffsets:outputs.flatMap((v,i)=>Object.is(v,-0)?[i]:[]),exactRawRepeat,controls,first,second,exactRepeat,numericalPassed,timing:cost,candidateGO:numericalPassed&&exactRepeat&&exactRawRepeat&&controls.passed&&cost?.passed,publicController:false,actualViewer:false};}

