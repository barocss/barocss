import {runExperiment} from './experiment.mjs';
const result=runExperiment();
const body=document.querySelector('tbody');
for(const scene of result.first){
 const row=document.createElement('tr');
 const position=scene.states.at(-1)?.positionM;
 const values=[scene.name,scene.passed?'PASS':'FAIL',String(scene.states.length),position?.map(v=>v.toFixed(9)).join(', ')??scene.error?.code??'none',scene.metrics?.firstFailure?.check??'none'];
 for(const value of values){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);
}
document.querySelector('#status').textContent=result.candidateGO?'All frozen model and cost gates passed':'Model or cost gate failed';
window.characterResult=result;
window.characterReady=true;
