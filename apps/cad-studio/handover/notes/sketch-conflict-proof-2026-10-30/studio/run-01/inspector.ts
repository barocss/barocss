import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {commitDimension} from '../../packages/barocss-cad-model/src/sketch/rules.ts';
import {outlinePolygon} from '../../packages/barocss-cad-model/src/sketch/outlineFields.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),probes=JSON.parse(process.argv[3]||'[]'),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){out.bodyCount=view.bodies.length;out.evalVolume=view.bodies[0]?.volume??null;}
out.probes=probes.map((p:any)=>{const poly=outlinePolygon(doc.nodes[p.node].outline);const r:any=commitDimension(poly,p.key,p.value);return {...p,ok:!!r.ok,reason:r.ok?null:r.reason};});
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));