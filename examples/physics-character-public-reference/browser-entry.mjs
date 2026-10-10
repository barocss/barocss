import selected from './selected-reference.json';
import {runReference} from './verification.mjs';
import {config,command} from './campaign.mjs';
import {CASES} from './fixture.mjs';
const iframe=document.createElement('iframe');iframe.hidden=true;document.body.append(iframe);
const foreign=iframe.contentWindow.JSON.parse(JSON.stringify({config:config(CASES[1]),command:command(CASES[1]),tuple:[1,0,0]}));iframe.remove();
window.runReference=(measure=false)=>{
 const result=runReference(selected,{measure,foreign});let previous=performance.now(),clockMinimumPositiveMs=Infinity;for(let i=0;i<10000;i++){const now=performance.now(),delta=now-previous;if(delta>0)clockMinimumPositiveMs=Math.min(clockMinimumPositiveMs,delta);previous=now;}result.clockMinimumPositiveMs=Number.isFinite(clockMinimumPositiveMs)?clockMinimumPositiveMs:null;
 document.getElementById('status').textContent=result.candidateGO?'All8 fixed public controller cases passed':'A public controller gate failed';
 document.getElementById('rows').replaceChildren(...result.first.map(c=>{const row=document.createElement('tr');for(const value of[c.name,c.passed?'pass':'FAIL',c.error?.code??c.publicStates.length+' states',c.publicStates.at(-1)?.positionM.join(', ')??'refused spawn']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}return row;}));return result;
};window.referenceReady=true;
