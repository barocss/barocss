import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {part} from '../../packages/barocss-cad-model/src/api/index.ts';
import {compileCadModel,surfaceEvaluator} from '../../packages/barocss-cad/src/index.ts';
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),p=part('D340 witness read',doc);
assert.equal(p.bodies().length,1);const key=p.bodies()[0],mass=p.body(key).mass({density:1});
const objects=doc.direct.objects.filter(o=>o.trims?.length&&!o.hidden).map(o=>{
 const compiled=compileCadModel(doc.direct.sources[o.source],{sourceVersion:0});assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));
 const surface=compiled.model.objects.find(s=>s.id===o.geometry);assert.equal(surface?.kind,'surface');
 const evaluate=surfaceEvaluator(surface),domain={u:[surface.knotsU[surface.degreeU],surface.knotsU[surface.knotsU.length-surface.degreeU-1]],v:[surface.knotsV[surface.degreeV],surface.knotsV[surface.knotsV.length-surface.degreeV-1]]};
 const observations=o.trims.flatMap(loop=>loop.uv.map(([u,v])=>({uv:[u,v],actualWorld:evaluate(u,v),authorityWorld:[20+5*u,-11+5*v,3]})));
 return {...o,domain,surface,observations};
});console.log(JSON.stringify({witness:{key,mass,names:p.body(key).select().faces().names().sort()},objects}));