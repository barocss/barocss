import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {partBreps,evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {fillRegionSnapshot} from '../../packages/barocss-cad-model/src/engine/fillFeaturePattern.ts';import {checkBrep} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc),p=part('D345 observed',doc),view=evaluateDoc(doc,0);assert.ok(view.ok);
const bodies=partBreps(doc).map(({key,brep})=>({key,brep,check:checkBrep(brep,{strict:true}),mass:p.body(key).mass({density:1}),names:p.body(key).select().faces().names().sort(),model:view.bodies.find(b=>b.key===key)}));
const sketches=doc.nodes.flatMap((n,index)=>{if(n.kind!=='sketch')return[];try{return[{index,region:fillRegionSnapshot(doc,index)}];}catch(e){return[{index,error:e instanceof Error?e.message:String(e)}];}});
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify({bodies,sketches}));