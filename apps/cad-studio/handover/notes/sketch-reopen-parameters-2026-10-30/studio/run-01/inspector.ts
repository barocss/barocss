import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error?.detail??(view as any).error?.title??(view as any).error??'evaluation failed')};
if(view.ok){const key=view.bodies[0].key,body=part('D356 observed',doc).body(key);out.bodyCount=view.bodies.length;out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.massVolume=body.mass({density:1}).volume;}
out.sketch=doc.nodes[0]??null;out.extrude=doc.nodes[1]??null;out.parameters=doc.parameters??null;out.hasNull=JSON.stringify(doc.nodes[0]??null).includes('null');
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));