import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';import {evaluateDoc} from '../../packages/barocss-cad-model/src/engine/evaluate.ts';
import {geometryOf} from '../../packages/barocss-cad-model/src/engine/direct.ts';
import {evaluateCurve} from '@barocss/cad';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const view=evaluateDoc(doc,0);const out:any={ok:!!view.ok,error:view.ok?null:String((view as any).error?.detail??(view as any).error?.title??(view as any).error??'evaluation failed'),curves:[]};
if(view.ok){out.bodyCount=view.bodies.length;if(view.bodies.length){const key=view.bodies[0].key,body=part('Ellipse observed',doc).body(key);out.bodyKey=key;out.evalVolume=view.bodies[0].volume;out.facadeVolume=body.mass({density:1}).volume;}}
out.sketch=doc.nodes[0]??null;out.hasNull=JSON.stringify(doc).includes('null');
for(const o of doc.direct?.objects??[]){const g:any=geometryOf(doc.direct,o);if(g.kind!=='curve')continue;
const a=g.knots[g.degree],b=g.knots[g.knots.length-g.degree-1];
out.curves.push({id:o.id,name:o.name,degree:g.degree,knots:g.knots,controlPoints:g.controlPoints,weights:g.weights,evals:Array.from({length:17},(_,k)=>{const t=a+(b-a)*k/16;return {t,point:evaluateCurve(g,t)};})});}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));