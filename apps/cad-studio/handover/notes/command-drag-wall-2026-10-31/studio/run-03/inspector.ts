import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error?.detail??(view as any).error?.title??(view as any).error??'evaluation failed'),probes:{}};
if(view.ok){out.bodyCount=view.bodies.length;out.evalVolume=view.bodies[0]?.volume??null;}
out.hasNull=JSON.stringify(doc).includes('null');out.last=doc.nodes[doc.nodes.length-1];
// The refusal radius at run time: the last fillet at 7.5 (accepted) and 8 (refused).
if(doc.nodes[doc.nodes.length-1]?.kind==='fillet'){for(const r of [0.5,7.5,7.9,8,8.5]){const d=JSON.parse(before);d.nodes[d.nodes.length-1].radius=r;const v=evaluateDoc(d,0);out.probes[String(r)]=v.ok?'ok':String((v as any).error?.code??(v as any).error?.title??'refused');}}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));