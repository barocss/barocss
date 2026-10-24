import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Use the consumer driver's one actual extracted archive, never pack again. */
export async function verifyProfileConsumer({api,destination,temp,require,archive}) {
  assert.equal(typeof api.buildXYProfile,'function');
  const requests=[
    {kind:'line',id:'packed_line',points:[[0,0],[120,0]]},
    {kind:'polyline',id:'packed_path',points:[[0,0],[3,0],[3,2],[-1,2]]},
    {kind:'rectangle',id:'packed_rect',origin:[4,-3],width:7,height:5},
  ];
  writeFileSync(join(temp,'profile-runtime.mjs'), `import assert from 'node:assert/strict';
import {buildXYProfile,compileCadModel,evaluateCurve,evaluateCurveD1,exportIGES} from '@barocss/cad';
const requests=${JSON.stringify(requests)};
for(const request of requests){
 const result=buildXYProfile(request);const compiled=compileCadModel(result.source,{sourceVersion:0});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,result.model);
 assert.equal(result.model.version,0);assert.equal(result.report.endpointClosed,request.kind==='rectangle');assert.equal(result.report.regionCertified,false);assert.equal(result.report.solid,false);
 assert.notEqual(result.curve,result.model.objects[0]);
 for(let i=0;i<result.curve.controlPoints.length-1;i++){const a=result.curve.controlPoints[i],b=result.curve.controlPoints[i+1];const p=evaluateCurve(result.curve,i+.25);const d=evaluateCurveD1(result.curve,i+.25).derivative;for(let k=0;k<3;k++){assert.ok(Math.abs(p[k]-(a[k]+.25*(b[k]-a[k])))<1e-10);assert.ok(Math.abs(d[k]-(b[k]-a[k]))<1e-10);}}
 for(let i=1;i<result.curve.controlPoints.length-1;i++)assert.throws(()=>evaluateCurveD1(result.curve,i));
 const exported=exportIGES(result.model,[request.id]);assert.equal(exported.report.objects[0].entity,126);
 const fields=exported.iges.split('\\n').filter(l=>l[72]==='P').map(l=>l.slice(0,64)).join('').split(',').slice(0,7).map(Number);
 assert.deepEqual(fields,[126,result.curve.controlPoints.length-1,1,0,0,1,0]);
}
const tiny=buildXYProfile({kind:'line',id:'tiny',points:[[5e-324,-0],[1,0]]});assert.ok(Object.is(tiny.curve.controlPoints[0][0],5e-324));assert.ok(Object.is(tiny.curve.controlPoints[0][1],-0));assert.doesNotMatch(tiny.source,/\\d[eE][+-]?\\d/);
assert.throws(()=>buildXYProfile({kind:'polyline',id:'closed',points:[[0,0],[1,0],[0,0]]}));
`);
  execFileSync(process.execPath,[join(temp,'profile-runtime.mjs')],{stdio:'inherit'});
  writeFileSync(join(temp,'profile-types.ts'), `import {buildXYProfile,compileCadModel,evaluateCurve,exportIGES} from '@barocss/cad';
import type {XYProfileRequest,XYProfileResult,XYProfileReport,Curve,Model} from '@barocss/cad';
const requests:XYProfileRequest[]=[{kind:'line',id:'line',points:[[0,0],[1,0]]},{kind:'polyline',id:'path',points:[[0,0],[1,0],[1,1]]},{kind:'rectangle',id:'rect',origin:[0,0],width:1,height:2}];
for(const request of requests){const output:XYProfileResult=buildXYProfile(request);const report:XYProfileReport=output.report;const sourceVersion:0=output.sourceVersion;const curve:Curve=output.curve;const model:Model=output.model;const plane:'xy'=report.plane;const uncertified:false=report.regionCertified;const solid:false=report.solid;const min:number=report.parameterDomain.min;const max:number=report.parameterDomain.max;void[compileCadModel(output.source,{sourceVersion}),evaluateCurve(curve,min),exportIGES(model,[curve.id]),max,plane,uncertified,solid];}
// @ts-expect-error Circle profiles are outside this bounded family.
buildXYProfile({kind:'circle',id:'circle',radius:1});
// @ts-expect-error Coordinates are XY pairs, not XYZ points.
buildXYProfile({kind:'line',id:'line',points:[[0,0,0],[1,0,0]]});
// @ts-expect-error Profile units are fixed mm.
buildXYProfile({kind:'rectangle',id:'rect',origin:[0,0],width:1,height:2,unit:'cm'});
`);
  execFileSync(process.execPath,[require.resolve('typescript/bin/tsc'),'--noEmit','--strict','--target','ES2022','--module','NodeNext','--moduleResolution','NodeNext',join(temp,'profile-types.ts')],{stdio:'inherit'});
  const results=requests.map(request=>api.buildXYProfile(request));
  const hash=value=>createHash('sha256').update(value).digest('hex');
  const record={archiveSHA256:hash(readFileSync(archive)),producer:'Actual extracted public @barocss/cad ESM/types archive',indexSHA256:hash(readFileSync(join(destination,'dist/index.js'))),sourceVersion:0,nativeVersion:0,fixtures:results.map((result,i)=>({id:requests[i].id,sourceSHA256:hash(result.source),sourceBytes:Buffer.byteLength(result.source),report:result.report,igesFlags:{entity:126,planar:0,closed:0,polynomial:1,periodic:0}}))};
  if(process.env.BAROCSS_CAD_PROFILE_EVIDENCE){const folder=resolve(process.env.BAROCSS_CAD_PROFILE_EVIDENCE);mkdirSync(folder,{recursive:true});writeFileSync(join(folder,'consumer-report.json'),JSON.stringify(record,null,2)+'\n');for(let i=0;i<results.length;i++){writeFileSync(join(folder,requests[i].id+'.css'),results[i].source);writeFileSync(join(folder,requests[i].id+'.json'),JSON.stringify(results[i],null,2)+'\n');}}
  console.log('Packed XY profile ESM/types, actual source/native identity and original IGES flags passed');
  return record;
}
