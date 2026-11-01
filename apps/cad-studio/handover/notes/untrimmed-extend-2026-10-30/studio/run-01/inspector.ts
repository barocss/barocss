import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {modelOf} from '../../packages/barocss-cad-model/src/engine/direct.ts';
import {evaluateSurface,surfaceDomain} from '../../packages/barocss-cad/src/index.ts';
const num=(a:any):any=>Array.isArray(a)||ArrayBuffer.isView(a)?Array.from(a as any,num):a;
const doc=JSON.parse(readFileSync(process.argv[2],'utf8')),before=JSON.stringify(doc),direct=doc.direct;assert.ok(direct&&Array.isArray(direct.objects));
const objects=direct.objects.map((object:any)=>{const text=direct.sources[object.source];assert.equal(typeof text,'string');
  const matches=modelOf(text).objects.filter((g:any)=>g.id===object.geometry);assert.equal(matches.length,1);const g:any=matches[0];
  const out:any={id:object.id,name:object.name,hidden:!!object.hidden,source:object.source,sourceSha256:createHash('sha256').update(text).digest('hex'),geometryId:object.geometry,trims:object.trims??null,kind:g.kind};
  if(g.kind==='surface'){out.geometry={degreeU:g.degreeU,degreeV:g.degreeV,knotsU:num(g.knotsU),knotsV:num(g.knotsV),controlPoints:num(g.controlPoints),weights:num(g.weights)};
    if(!out.hidden){const d:any=surfaceDomain(g);out.domain={u:num(d.u),v:num(d.v)};out.corners=[[d.u[0],d.v[0]],[d.u[1],d.v[0]],[d.u[0],d.v[1]],[d.u[1],d.v[1]]].map(([u,v])=>({u,v,point:num(evaluateSurface(g,u,v))}));}}
  else out.geometry={degree:g.degree,knots:num(g.knots),controlPoints:num(g.controlPoints),weights:num(g.weights)};
  return out;});
assert.equal(JSON.stringify(doc),before);console.log(JSON.stringify({objects}));