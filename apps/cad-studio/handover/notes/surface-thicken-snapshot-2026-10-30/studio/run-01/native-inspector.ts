import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {partBreps} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')), p=part('D338 native read',doc);
const breps=partBreps(doc), meshes=p.meshes();
const result=p.bodies().map(key=>{
 const b=breps.find(x=>x.key===key).brep, mesh=meshes.find(x=>x.key===key);
 const check=checkBrep(b); assert.deepEqual(check.issues,[]);
 assert.equal(b.bodies.length,1); assert.equal(b.bodies[0].kind,'solid'); assert.ok(b.shells.every(x=>x.closed));
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 for(let i=0;i<mesh.positions.length;i++) { const k=i%3; bounds.min[k]=Math.min(bounds.min[k],mesh.positions[i]); bounds.max[k]=Math.max(bounds.max[k],mesh.positions[i]); }
 return {key,mass:p.body(key).mass({density:1}),names:p.body(key).select().faces().names().sort(),faces:p.body(key).select().faces().list(),bounds,closed:true,valid:true,issues:check.issues};
});
console.log(JSON.stringify(result));