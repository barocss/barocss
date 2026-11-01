import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));const before=JSON.stringify(doc);
const out:any={ok:false,error:null,thrown:null,bodies:[]};let view:any=null;
try{view=evaluateDoc(doc,0);}catch(e:any){out.thrown=String(e?.message??e);}
if(view){out.ok=!!view.ok;out.error=view.ok?null:String(view.error?.detail??view.error?.title??view.error??'evaluation failed');
if(view.ok)for(const b of view.bodies){const p=b.mesh.positions as Float32Array;let zMin=Infinity,zMax=-Infinity;for(let i=2;i<p.length;i+=3){zMin=Math.min(zMin,p[i]);zMax=Math.max(zMax,p[i]);}
const at=(z:number)=>{const r:number[]=[];for(let i=0;i<p.length;i+=3)if(Math.abs(p[i+2]-z)<1e-6)r.push(Math.hypot(p[i],p[i+1]));return r;};
out.bodies.push({key:b.key,ref:b.ref??null,volume:b.volume??null,band:b.band??null,area:b.area??null,areaBasis:b.areaBasis??null,faceAreas:b.mesh.faces.map((f:any)=>f.area),zMin,zMax,radiiAtZMin:at(zMin),radiiAtZMax:at(zMax)});}}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));