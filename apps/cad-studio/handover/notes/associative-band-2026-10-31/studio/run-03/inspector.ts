import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8'));if(process.argv[3])doc.parameters={...(doc.parameters??{}),...JSON.parse(process.argv[3])};const before=JSON.stringify(doc);
const out:any={ok:false,error:null,thrown:null};let view:any=null;
try{view=evaluateDoc(doc,0);}catch(e:any){out.thrown=String(e?.message??e);}
if(view){out.ok=!!view.ok;out.error=view.ok?null:String(view.error?.detail??view.error?.title??view.error??'evaluation failed');
if(view.ok){out.bodyCount=view.bodies.length;if(view.bodies.length){const key=view.bodies[0].key,body=part('Band observed',doc).body(key);out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.facadeVolume=body.mass({density:1}).volume;}}}
out.sketch=doc.nodes[0]??null;out.parameters=doc.parameters??null;out.hasNull=JSON.stringify(doc).includes('null');
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));