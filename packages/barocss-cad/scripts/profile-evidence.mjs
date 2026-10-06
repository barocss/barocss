import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../../..'),json=value=>JSON.stringify(value,null,2)+'\n';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const xyProfileEvidenceRoot=()=>resolve(process.env.BAROCSS_CAD_XY_PROFILE_EVIDENCE??'/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-553/xy-profile');
const close=(actual,expected,derivative=false)=>assert.ok(Math.hypot(...actual.map((x,i)=>x-expected[i]))<=1e-9*(derivative?Math.max(1,Math.hypot(...expected)):1));
export function writeXYProfileEvidence(api){
  const output=xyProfileEvidenceRoot();mkdirSync(output,{recursive:true});
  const definitions=['line','polyline','rectangle'].map(name=>({name,request:JSON.parse(readFileSync(resolve(root,'examples/cad-nurbs/xy-profile-'+name+'.json'),'utf8'))}));
  definitions.push({name:'binary64-line',request:{kind:'line',id:'binary64_line',points:[[-0,1e-7],[0.001,1e-7]]}});
  const fixtures=[];
  for(const {name,request}of definitions){
    // Expected poles come from the authored request, not the builder output.
    const points=request.kind==='rectangle'?[[4,-3,0],[11,-3,0],[11,2,0],[4,2,0],[4,-3,0]]:request.points.map(([x,y])=>[x,y,0]);
    const built=api.buildXYProfile(request),compiled=api.compileCadModel(built.source,{sourceVersion:0});
    assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,built.model);assert.deepEqual(built.curve,built.model.objects[0]);assert.notEqual(built.curve,built.model.objects[0]);
    assert.deepEqual(built.curve.controlPoints,points);assert.equal(built.curve.degree,1);assert.deepEqual(built.curve.weights,points.map(()=>1));
    assert.deepEqual(built.curve.knots,[0,0,...Array.from({length:points.length-2},(_,i)=>i+1),points.length-1,points.length-1]);
    assert.equal(built.sourceVersion,0);assert.equal(built.model.version,0);assert.deepEqual(api.curveDomain(built.curve),[0,points.length-1]);
    assert.deepEqual(built.report,{kind:request.kind,plane:'xy',lengthUnit:'mm',vertexCount:points.length,segmentCount:points.length-1,parameterDomain:{min:0,max:points.length-1},endpointClosed:request.kind==='rectangle',regionCertified:false,solid:false});
    const samples=[],positionSamples=[],c0Refusals=[];
    for(let span=0;span<points.length-1;span++)for(const fraction of [0,.03,.17,.5,.83,.97,1]){
      const parameter=span+fraction,analyticPoint=points[span].map((x,k)=>x+(points[span+1][k]-x)*fraction),analyticDerivative=points[span].map((x,k)=>points[span+1][k]-x);
      const point=api.evaluateCurve(built.curve,parameter);close(point,analyticPoint);positionSamples.push({span,fraction,parameter,point,analyticPoint});
      if(parameter>0&&parameter<points.length-1&&Number.isInteger(parameter))continue;
      const evaluated=api.evaluateCurveD1(built.curve,parameter);close(evaluated.point,analyticPoint);close(evaluated.derivative,analyticDerivative,true);
      samples.push({span,fraction,parameter,...evaluated,analyticPoint,analyticDerivative});
    }
    for(let knot=1;knot<points.length-1;knot++){assert.throws(()=>api.evaluateCurveD1(built.curve,knot));c0Refusals.push({parameter:knot,position:api.evaluateCurve(built.curve,knot),derivative:'rejected-exact-C0'});}
    const exported=api.exportIGES(built.model,[request.id]);assert.equal(exported.report.objects.length,1);assert.equal(exported.report.objects[0].id,request.id);assert.equal(exported.report.objects[0].entity,126);
    const contents={request:json(request),source:built.source,ast:json(compiled.ast),ir:json(compiled.ir),model:json(built.model),native:json(built.curve),report:json(built.report),iges:exported.iges,exportReport:json(exported.report),samples:json(samples),positionSamples:json(positionSamples),c0Refusals:json(c0Refusals)};
    const files={},hashes={};for(const [key,bytes]of Object.entries(contents)){const filename=name+'.'+({source:'css',iges:'iges'}[key]??key+'.json');files[key]=filename;hashes[key]=hash(bytes);writeFileSync(resolve(output,filename),bytes);}
    fixtures.push({name,request,authoredPoints:points,sourceVersion:0,geometryVersion:0,id:request.id,entity:126,native:built.curve,domain:api.curveDomain(built.curve),report:built.report,exportMapping:exported.report.objects[0],positionSamples,c0Refusals,samples,files,hashes});
  }
  const manifest={base:'ea901f77203b3582d9e49a24245cdaa5bd2d60b6',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),producer:'Actual packed buildXYProfile -> source0 compiler -> original selected IGES126',fixtures,limits:{nativeMM:1e-9,readerMM:1e-7,derivative:'scaled by max(1, expected norm)'},limitations:['Native rectangle endpoint equality is not certified region/wire/solid topology.','Original IGES126 flags remain general/open/nonperiodic.']};
  writeFileSync(resolve(output,'manifest.json'),json(manifest));writeFileSync(resolve(output,'manifest.sha256'),hash(json(manifest))+'\n');console.log('Packed XY profile evidence: '+output);return manifest;
}
