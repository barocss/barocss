import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error?.detail??(view as any).error?.title??(view as any).error??'evaluation failed')};
if(view.ok){out.bodyCount=view.bodies.length;out.evalVolumes=view.bodies.map((b:any)=>b.volume);out.massVolumes=view.bodies.map((b:any)=>part('D357 observed',doc).body(b.key).mass({density:1}).volume);}
const nulls:string[]=[];const walk=(v:any,p:string)=>{if(v===null||(typeof v==='number'&&!Number.isFinite(v)))nulls.push(p);else if(Array.isArray(v))v.forEach((x,i)=>walk(x,p+'['+i+']'));else if(v&&typeof v==='object')for(const k of Object.keys(v))walk(v[k],p+'.'+k);};walk(doc,'doc');
out.nulls=nulls;out.nodeKinds=doc.nodes.map((n:any)=>n.kind);out.parameters=doc.parameters??null;
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));