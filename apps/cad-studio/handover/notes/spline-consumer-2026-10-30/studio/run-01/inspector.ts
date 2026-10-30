import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){out.bodyCount=view.bodies.length;if(view.bodies.length){const key=view.bodies[0].key,p=part('D351 observed',doc),body=p.body(key);out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.facadeVolume=body.mass({density:1}).volume;}}
const sk=doc.nodes.find((n:any)=>n.kind==='sketch');out.segments=sk&&sk.profile==='loop'?sk.segments:null;out.outlineKeys=sk?.outline?Object.keys(sk.outline):null;
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));