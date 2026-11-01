import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {geometryOf} from '../../packages/barocss-cad-model/src/engine/direct.ts';
import {evaluateCurve,evaluateCurveD1,curveDomain} from '@barocss/cad';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc);
const out:any={objects:(doc.direct?.objects??[]).length,curves:[]};
const ts=[0,0.25,0.5,0.75,1];
for(const o of doc.direct?.objects??[]){const g:any=geometryOf(doc.direct,o);if(g.kind!=='curve')continue;
const dom=curveDomain(g);const c:any={id:o.id,name:o.name,degree:g.degree,knots:g.knots,controlPoints:g.controlPoints,weights:g.weights,domain:dom,evals:ts.map(t=>({t,point:evaluateCurve(g,t)})),d1:{}};
try{c.d1.start=evaluateCurveD1(g,0).derivative;c.d1.end=evaluateCurveD1(g,1).derivative;}catch(e){c.d1.error=String(e);}
out.curves.push(c);}
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify(out));