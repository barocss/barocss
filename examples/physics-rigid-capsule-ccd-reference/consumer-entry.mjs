import * as api from './entry.ts';
import { runControls } from './controls.mjs';
const flow = runControls(api);
const numbers=[];
function collect(value) { if(typeof value==='number')numbers.push(value); else if(value&&typeof value==='object')Object.values(value).forEach(collect); }
collect(flow);
const bytes=Buffer.alloc(numbers.length*8);numbers.forEach((v,i)=>bytes.writeDoubleLE(v,i*8));
console.log(JSON.stringify({flow,rawHex:bytes.toString('hex')}));
