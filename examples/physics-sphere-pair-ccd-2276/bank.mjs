// Inert represented endpoints only; no World, helper, oracle or geometry imports.
import {cases} from './cases.mjs';
import {writeFileSync} from 'node:fs';
const raw=x=>typeof x==='number'?{$f64le:(()=>{const b=Buffer.alloc(8);b.writeDoubleLE(x);return b.toString('hex');})()}:Array.isArray(x)?x.map(raw):x&&typeof x==='object'?Object.fromEntries(Object.entries(x).map(([k,v])=>[k,raw(v)])):x;
const data=cases.map(c=>({id:c.id,expectedClass:c.expectedClass,geometry:raw({starts:c.starts,ends:c.starts.map((p,j)=>p.map((x,i)=>x+c.velocities[j][i]*c.dt)),radii:c.radii,marker:c.marker})}));
writeFileSync('examples/physics-sphere-pair-ccd-2276/BANK-INPUT-01.json',JSON.stringify({cases:data},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({cases:data.length,WorldCalls:0,helperCalls:0}));
