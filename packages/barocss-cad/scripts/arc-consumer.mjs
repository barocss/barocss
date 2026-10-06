import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Reuse the consumer driver's actual extracted archive; do not pack again. */
export async function verifyArcConsumer({api,destination,temp,require}) {
  assert.equal(typeof api.buildXYArc,'function');
  const requests=[{kind:'quarter-arc',id:'packed_arc',center:[0,0],radius:10,quadrant:0},{kind:'circle',id:'packed_circle',center:[4,-3],radius:10}];
  writeFileSync(join(temp,'arc-runtime.mjs'),`import assert from 'node:assert/strict';
import {buildXYArc,compileCadModel,evaluateCurve,evaluateCurveD1,exportIGES} from '@barocss/cad';
const requests=${JSON.stringify(requests)};
for(const request of requests){const result=buildXYArc(request);const compiled=compileCadModel(result.source,{sourceVersion:0});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,result.model);assert.equal(result.model.version,0);assert.notEqual(result.curve,result.model.objects[0]);assert.equal(result.report.endpointClosed,request.kind==='circle');assert.equal(result.report.periodic,false);assert.equal(result.report.regionCertified,false);assert.equal(result.report.solid,false);
 for(let q=0;q<result.report.spanCount;q++)for(const t of [.125,.5,.875]){const b=[(1-t)**2,2*t*(1-t),t*t],db=[-2*(1-t),2-4*t,2*t],weights=[1,Math.SQRT1_2,1];let poles=[[request.radius,0],[request.radius,request.radius],[0,request.radius]];for(let i=0;i<q;i++)poles=poles.map(([x,y])=>[-y,x]);const den=b.reduce((s,x,i)=>s+x*weights[i],0),dd=db.reduce((s,x,i)=>s+x*weights[i],0);const actual=evaluateCurveD1(result.curve,q+t);for(let k=0;k<2;k++){const n=b.reduce((s,x,i)=>s+x*weights[i]*poles[i][k],0),dn=db.reduce((s,x,i)=>s+x*weights[i]*poles[i][k],0);assert.ok(Math.abs(actual.point[k]-(request.center[k]+n/den))<1e-9);assert.ok(Math.abs(actual.derivative[k]-(dn*den-n*dd)/(den*den))<1e-9);}}
 for(let knot=1;knot<result.report.spanCount;knot++)assert.throws(()=>evaluateCurveD1(result.curve,knot));
 const exported=exportIGES(result.model,[request.id]);const fields=exported.iges.split('\\n').filter(l=>l[72]==='P').map(l=>l.slice(0,64)).join('').split(',').slice(0,7).map(Number);assert.deepEqual(fields,[126,result.curve.controlPoints.length-1,2,0,0,0,0]);
}
const signed=buildXYArc({kind:'circle',id:'signed',center:[-0,-0],radius:.001});assert.ok(Object.is(signed.report.centerMM[0],-0));assert.ok(Object.is(signed.report.centerMM[1],-0));
const edited=buildXYArc({...requests[1],radius:12});assert.equal(edited.curve.id,'packed_circle');assert.deepEqual(evaluateCurve(edited.curve,0),[16,-3,0]);
assert.throws(()=>buildXYArc({...requests[0],quadrant:4}));
`);
  execFileSync(process.execPath,[join(temp,'arc-runtime.mjs')],{stdio:'inherit'});
  writeFileSync(join(temp,'arc-types.ts'),`import {buildXYArc,compileCadModel,evaluateCurve,exportIGES} from '@barocss/cad';
import type {XYArcRequest,XYArcResult,XYArcReport,XYPoint,Curve,Model} from '@barocss/cad';
const center:XYPoint=[0,0];const requests:XYArcRequest[]=[{kind:'quarter-arc',id:'arc',center,radius:10,quadrant:3},{kind:'circle',id:'circle',center,radius:10}];
for(const request of requests){const result:XYArcResult=buildXYArc(request);const report:XYArcReport=result.report;const sourceVersion:0=result.sourceVersion;const curve:Curve=result.curve;const model:Model=result.model;const plane:'xy'=report.plane;const periodic:false=report.periodic;const region:false=report.regionCertified;const solid:false=report.solid;const mm:'mm'=report.lengthUnit;const cx:XYPoint=report.centerMM;const radius:number=report.radiusMM;const spanCount:number=report.spanCount;void[compileCadModel(result.source,{sourceVersion}),evaluateCurve(curve,report.parameterDomain.min),exportIGES(model,[curve.id]),plane,periodic,region,solid,mm,cx,radius,spanCount];}
// @ts-expect-error Only four quarter indices exist.
buildXYArc({kind:'quarter-arc',id:'arc',center,radius:10,quadrant:4});
// @ts-expect-error A circle has no quadrant option.
buildXYArc({kind:'circle',id:'circle',center,radius:10,quadrant:0});
// @ts-expect-error Arbitrary angular sweeps are outside this family.
buildXYArc({kind:'quarter-arc',id:'arc',center,radius:10,quadrant:0,startAngle:0});
`);
  execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',join(temp,'arc-types.ts')],{stdio:'inherit'});
  const results=requests.map(request=>api.buildXYArc(request)),hash=value=>createHash('sha256').update(value).digest('hex');
  const record={producer:'Actual extracted public @barocss/cad ESM/types archive',archiveSHA256:hash(readFileSync(join(temp,'barocss-cad-0.0.0-private-experimental.tgz'))),indexSHA256:hash(readFileSync(join(destination,'dist/index.js'))),sourceVersion:0,nativeVersion:0,fixtures:results.map((result,i)=>({id:requests[i].id,sourceSHA256:hash(result.source),sourceBytes:Buffer.byteLength(result.source),report:result.report,igesFlags:{entity:126,planar:0,closed:0,polynomial:0,periodic:0}}))};
  if(process.env.BAROCSS_CAD_ARC_EVIDENCE){const folder=resolve(process.env.BAROCSS_CAD_ARC_EVIDENCE);mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'consumer-report.json'),JSON.stringify(record,null,2)+'\n');for(let i=0;i<results.length;i++){writeFileSync(join(folder,requests[i].id+'.css'),results[i].source);writeFileSync(join(folder,requests[i].id+'.json'),JSON.stringify(results[i],null,2)+'\n');}}
  console.log('Packed XY arc ESM/types, rational point/D1, original source identity and IGES flags passed');return record;
}
