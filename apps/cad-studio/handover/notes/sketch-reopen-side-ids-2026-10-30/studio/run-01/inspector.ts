import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error??'evaluation failed')};
if(view.ok){const key=view.bodies[0].key,body=part('D355 observed',doc).body(key);out.bodyCount=view.bodies.length;out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.massVolume=body.mass({density:1}).volume;}
const fil=doc.nodes[2];out.filletEdges=fil?.edges??null;out.filletMarks={rematched:fil?.rematched??null,held:fil?.held??null,suppressed:fil?.suppressed??null};out.sideTags=doc.nodes[0]?.sideTags??null;
const pre={...doc,nodes:doc.nodes.slice(0,2),outputs:{b1:{node:1,side:'solid'}}},pv=evaluateDoc(pre,0);out.preOk=!!pv.ok;
if(pv.ok){const edges=part('D355 before fillet',pre).body(pv.bodies[0].key).select().edges().list();out.edgeFound=edges.filter(e=>e.names.some(n=>(fil?.edges??[]).includes(n))).map(e=>({names:e.names,a:e.a,b:e.b}));out.sampleEdgeNames=edges.map(e=>e.names[0]);}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));