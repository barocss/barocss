import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'../../..'),json=value=>JSON.stringify(value,null,2)+'\n',hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export const xyArcEvidenceRoot=()=>resolve(process.env.BAROCSS_CAD_XY_ARC_EVIDENCE??'/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-554/xy-arc');
const rotate=([x,y],quadrant)=>[[x,y],[-y,x],[-x,-y],[y,-x]][quadrant];
const close=(actual,expected,derivative=false)=>assert.ok(Math.hypot(...actual.map((x,i)=>x-expected[i]))<=1e-9*(derivative?Math.max(1,Math.hypot(...expected)):1));
export function arcAnalytic(request,quadrant,t){
  const r=request.radius,w=Math.SQRT1_2,a=1-t,d=a*a+2*w*a*t+t*t,dd=-2*a+2*w*(1-2*t)+2*t;
  const nx=r*(a*a+2*w*a*t),ny=r*(2*w*a*t+t*t),dx=r*(-2*a+2*w*(1-2*t)),dy=r*(2*w*(1-2*t)+2*t);
  const [x,y]=rotate([nx/d,ny/d],quadrant),[vx,vy]=rotate([(dx*d-nx*dd)/(d*d),(dy*d-ny*dd)/(d*d)],quadrant);
  return{point:[request.center[0]+x,request.center[1]+y,0],derivative:[vx,vy,0]};
}
export function writeXYArcEvidence(api){
  const output=xyArcEvidenceRoot();mkdirSync(output,{recursive:true});
  const quarter=JSON.parse(readFileSync(resolve(root,'examples/cad-nurbs/xy-arc-quarter.json'),'utf8')),circle=JSON.parse(readFileSync(resolve(root,'examples/cad-nurbs/xy-arc-circle.json'),'utf8'));
  const definitions=[{name:'quarter-0',request:quarter},...[[1,[4,-3],12],[2,[-4,3],10],[3,[4,3],12]].map(([quadrant,center,radius])=>({name:'quarter-'+quadrant,request:{...quarter,quadrant,center,radius}})),{name:'circle-10',request:circle},{name:'circle-12',request:{...circle,radius:12}}];
  const fixtures=[];
  for(const {name,request}of definitions){
    const full=request.kind==='circle',r=request.radius,w=Math.SQRT1_2;
    const relative=full?[[r,0],[r,r],[0,r],[-r,r],[-r,0],[-r,-r],[0,-r],[r,-r],[r,0]]:[[r,0],[r,r],[0,r]].map(p=>rotate(p,request.quadrant));
    const authoredPoles=relative.map(([x,y])=>[request.center[0]+x,request.center[1]+y,0]),weights=full?[1,w,1,w,1,w,1,w,1]:[1,w,1],knots=full?[0,0,0,1,1,2,2,3,3,4,4,4]:[0,0,0,1,1,1];
    const built=api.buildXYArc(request),compiled=api.compileCadModel(built.source,{sourceVersion:0});assert.equal(compiled.ok,true);assert.deepEqual(compiled.model,built.model);assert.deepEqual(built.curve,built.model.objects[0]);assert.notEqual(built.curve,built.model.objects[0]);
    assert.deepEqual(built.curve.controlPoints,authoredPoles);assert.deepEqual(built.curve.weights,weights);assert.deepEqual(built.curve.knots,knots);assert.equal(built.curve.degree,2);assert.equal(built.sourceVersion,0);assert.equal(built.model.version,0);
    const spanCount=full?4:1;assert.deepEqual(api.curveDomain(built.curve),[0,spanCount]);assert.deepEqual(built.report,{kind:request.kind,plane:'xy',lengthUnit:'mm',centerMM:request.center,radiusMM:r,startQuadrant:full?0:request.quadrant,spanCount,controlPointCount:full?9:3,parameterDomain:{min:0,max:spanCount},endpointClosed:full,periodic:false,regionCertified:false,solid:false});
    const samples=[],positionSamples=[],c0Refusals=[];
    for(let span=0;span<spanCount;span++)for(const t of [0,.03,.17,.5,.83,.97,1]){const parameter=span+t,quadrant=full?span:request.quadrant,expected=arcAnalytic(request,quadrant,t),point=api.evaluateCurve(built.curve,parameter);close(point,expected.point);assert.ok(Math.abs(Math.hypot(point[0]-request.center[0],point[1]-request.center[1])-r)<=1e-9);positionSamples.push({span,t,quadrant,parameter,point,analyticPoint:expected.point});if(parameter>0&&parameter<spanCount&&Number.isInteger(parameter))continue;const actual=api.evaluateCurveD1(built.curve,parameter);close(actual.point,expected.point);close(actual.derivative,expected.derivative,true);samples.push({span,t,quadrant,parameter,...actual,analyticPoint:expected.point,analyticDerivative:expected.derivative});}
    for(let knot=1;knot<spanCount;knot++){assert.throws(()=>api.evaluateCurveD1(built.curve,knot));c0Refusals.push({parameter:knot,position:api.evaluateCurve(built.curve,knot),derivative:'rejected-exact-C0'});}
    const exported=api.exportIGES(built.model,[request.id]);assert.equal(exported.report.objects.length,1);assert.equal(exported.report.objects[0].id,request.id);assert.equal(exported.report.objects[0].entity,126);
    const contents={request:json(request),source:built.source,ast:json(compiled.ast),ir:json(compiled.ir),model:json(built.model),native:json(built.curve),report:json(built.report),iges:exported.iges,exportReport:json(exported.report),samples:json(samples),positionSamples:json(positionSamples),c0Refusals:json(c0Refusals)};
    const files={},hashes={};for(const [key,bytes]of Object.entries(contents)){const filename=name+'.'+({source:'css',iges:'iges'}[key]??key+'.json');files[key]=filename;hashes[key]=hash(bytes);writeFileSync(resolve(output,filename),bytes);}
    fixtures.push({name,request,authoredPoles,authoredWeights:weights,authoredKnots:knots,sourceVersion:0,geometryVersion:0,id:request.id,entity:126,native:built.curve,domain:api.curveDomain(built.curve),report:built.report,exportMapping:exported.report.objects[0],positionSamples,c0Refusals,samples,files,hashes});
  }
  const manifest={base:'21cee58553e53fb641eefb617bab206f44a2694a',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),producer:'Actual packed buildXYArc -> source0 compiler -> original selected rational IGES126',fixtures,limits:{nativeMM:1e-9,readerMM:1e-7,derivative:'scaled by max(1, expected norm)'},limitations:['Original rational parameter is not linear angle.','Circle endpoint equality is not periodic/wire/region/solid certification.','Original IGES126 flags remain general/open/nonperiodic.']};writeFileSync(resolve(output,'manifest.json'),json(manifest));writeFileSync(resolve(output,'manifest.sha256'),hash(json(manifest))+'\n');console.log('Packed XY arc evidence: '+output);return manifest;
}
