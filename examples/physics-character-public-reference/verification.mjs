import { observe,timing,project,exact } from './campaign.mjs';
import { runControls } from './controls.mjs';
import { runInternalControls } from './internal-controls.mjs';
import { numbers,inputRecords,outputRecords,encode,hex } from './binary.mjs';
export function runReference(selected,{measure=true,foreign}={}){
 const controls=runControls(foreign),internalControls=runInternalControls(),first=observe(),second=observe();
 const exactRepeat=exact(first,second),exactRawRepeat=hex(encode(numbers(outputRecords(first))))===hex(encode(numbers(outputRecords(second))));
 const selectedProjectionExact=first.every((c,i)=>exact(c.publicStates,selected.first[i].states.map(project)));
 const selectedTraceNumericExact=hex(encode(numbers(outputRecords(first))))===hex(encode(numbers(outputRecords(selected.first))));
 const numericalPassed=first.length===8&&first.every(c=>c.passed)&&selectedProjectionExact&&selectedTraceNumericExact;
 const inputs=numbers(inputRecords(first)),outputs=numbers(outputRecords(first));
 const cost=numericalPassed&&exactRepeat&&exactRawRepeat&&controls.passed&&internalControls.passed&&measure?timing():null;
 return {first,second,controls,internalControls,exactRepeat,exactRawRepeat,selectedProjectionExact,selectedTraceNumericExact,numericalPassed,timing:cost,candidateGO:numericalPassed&&exactRepeat&&exactRawRepeat&&controls.passed&&internalControls.passed&&(!measure||cost?.passed),inputHex:hex(encode(inputs)),outputHex:hex(encode(outputs)),negativeZeroInputOffsets:inputs.flatMap((v,i)=>Object.is(v,-0)?[i]:[]),negativeZeroOutputOffsets:outputs.flatMap((v,i)=>Object.is(v,-0)?[i]:[]),publicStateHex:hex(encode(numbers(first.map(c=>c.publicStates)))),publicController:true,actualViewer:false,traceBoundary:'Recorded same production core, not directly observed facade calls',referenceHead:selected.head};
}
