import { runReference } from './verification.mjs';
window.runReference=()=>{
 const result=runReference();let previous=performance.now(),clockMinimumPositiveMs=Infinity;
 for(let i=0;i<10000;i++){const now=performance.now(),delta=now-previous;if(delta>0)clockMinimumPositiveMs=Math.min(clockMinimumPositiveMs,delta);previous=now;}
 result.clockMinimumPositiveMs=Number.isFinite(clockMinimumPositiveMs)?clockMinimumPositiveMs:null;
 document.getElementById('status').textContent=result.passed?'All31 fixed public numerical gates passed':'A public numerical gate failed';
 document.getElementById('rows').replaceChildren(...result.first.map(item=>{const row=document.createElement('tr');for(const value of[item.name,item.passed?'pass':'FAIL',item.hit?.bodyId??item.error?.code??'clear',item.hit?.fraction??'—']){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}return row;}));
 return result;
};window.referenceReady=true;
