import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root=resolve(import.meta.dirname,'../../..');
const json=value=>JSON.stringify(value,null,2)+'\n';
const hash=value=>createHash('sha256').update(value).digest('hex');
export const boundaryEvidenceRoot=()=>resolve(process.env.BAROCSS_CAD_BOUNDARY_EVIDENCE ?? '/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-509/boundaries');
const choose=(n,k)=>k<0||k>n?0:k===0||k===n?1:n===2?2:NaN;
function closedBasis(knots,p,count,t) {
  const a=knots[p], b=knots[count], f=(t-a)/(b-a);
  if(count===p+1) {
    const n=Array.from({length:count},(_,i)=>choose(p,i)*f**i*(1-f)**(p-i));
    const lower=Array.from({length:p},(_,i)=>choose(p-1,i)*f**i*(1-f)**(p-1-i));
    return {n,d:n.map((_,i)=>p*((lower[i-1]??0)-(lower[i]??0))/(b-a))};
  }
  assert.equal(p,1);
  const k=[...new Set(knots)], span=t===b?k.length-2:k.findIndex((v,i)=>v<=t&&t<k[i+1]);
  const width=k[span+1]-k[span], s=(t-k[span])/width;
  const n=Array(count).fill(0),d=Array(count).fill(0);
  n[span]=1-s;n[span+1]=s;d[span]=-1/width;d[span+1]=1/width;
  return {n,d};
}
/** Independent closed-form Bernstein/linear rational surface oracle. */
function analytic(surface,u,v,name) {
  if(name==='derivative-c1') return {point:[u,u*u,u**3+7*v],du:[1,2*u,3*u*u],dv:[0,0,7]};
  const bu=closedBasis(surface.knotsU,surface.degreeU,surface.controlPoints.length,u);
  const bv=closedBasis(surface.knotsV,surface.degreeV,surface.controlPoints[0].length,v);
  const terms=surface.controlPoints.flatMap((row,i)=>row.map((point,j)=>({point,w:surface.weights[i][j],n:bu.n[i]*bv.n[j],u:bu.d[i]*bv.n[j],v:bu.n[i]*bv.d[j]})));
  const w=terms.reduce((s,t)=>s+t.n*t.w,0);
  const point=[0,1,2].map(k=>terms.reduce((s,t)=>s+t.n*t.w*t.point[k],0)/w);
  const partial=key=>[0,1,2].map(k=>terms.reduce((s,t)=>s+t[key]*t.w*(t.point[k]-point[k]),0)/w);
  return {point,du:partial('u'),dv:partial('v')};
}
const close=(a,b,limit)=>assert.ok(Math.hypot(...a.map((x,k)=>x-b[k]))<=limit);

export function writeBoundaryEvidence(api) {
  const output=boundaryEvidenceRoot();mkdirSync(output,{recursive:true});const fixtures=[];
  const fractions=[0,.017,.03,.07,.11,.123,.19,.271,.33,.41,.5,.57,.66,.719,.8,.877,.91,.93,.97,.989,1];
  for(const name of ['preview-flat','quarter-cylinder','asymmetric-patch','preview-weighted','extruded-cylinder','extruded-asymmetric','derivative-c1']) {
    const source=readFileSync(resolve(root,'examples/cad-nurbs/'+name+'.css'),'utf8');
    const isConstruction=name.startsWith('extruded-')||name==='derivative-c1';
    const compiled=api.compileCadModel(source,{sourceVersion:compiled.ir.sourceVersion});assert.equal(compiled.ok,true,JSON.stringify(compiled.diagnostics));const model=compiled.model;
    const surface=isConstruction?model.objects.find(o=>o.id===compiled.constructions[0].outputId):model.objects[0];
    const before=json(model),domain=api.surfaceDomain(surface),boundaries=[],curves=[];
    for(const boundary of ['v-min','u-max','v-max','u-min']) {
      const variesU=boundary==='v-min'||boundary==='v-max', decreasing=boundary==='v-max'||boundary==='u-min';
      const originalDomain=variesU?domain.u:domain.v;
      const curveId=surface.id+'_'+boundary.replace('-','_'),native=api.extractSurfaceBoundary(surface,{boundary,id:curveId}),samples=[],rejectedQueries=[];
      for(const f of fractions) {
        const [a,b]=originalDomain,parameter=(1-f)*a+f*b,q=decreasing?a+(b-parameter):parameter;
        const surfaceU=variesU?q:boundary==='u-max'?domain.u[1]:domain.u[0];
        const surfaceV=variesU?boundary==='v-max'?domain.v[1]:domain.v[0]:q;
        let result;
        try {result=api.evaluateCurveD1(native,parameter);} catch(error) {
          assert.match(error.message,/C0/);assert.equal(name,'extruded-asymmetric');
          assert.throws(()=>api.evaluateSurfaceD1(surface,surfaceU,surfaceV),/C0/);
          rejectedQueries.push({parameter,surfaceU,surfaceV,reason:error.message});continue;
        }
        const evaluated=api.evaluateSurfaceD1(surface,surfaceU,surfaceV),expected=analytic(surface,surfaceU,surfaceV,name);
        const sign=decreasing?-1:1,expectedDerivative=(variesU?expected.du:expected.dv).map(x=>sign*x);
        close(result.point,evaluated.point,1e-9);close(result.point,expected.point,1e-9);
        close(result.derivative,(variesU?evaluated.du:evaluated.dv).map(x=>sign*x),1e-9*Math.max(1,Math.hypot(...expectedDerivative)));
        close(result.derivative,expectedDerivative,1e-9*Math.max(1,Math.hypot(...expectedDerivative)));
        samples.push({parameter,surfaceU,surfaceV,...result,analyticPoint:expected.point,analyticDerivative:expectedDerivative});
      }
      assert.ok(samples.filter(s=>s.parameter>originalDomain[0]&&s.parameter<originalDomain[1]).length>=17);
      curves.push(native);boundaries.push({surfaceId:surface.id,boundary,curveId,parameterDirection:decreasing?'decreasing':'increasing',originalDomain,native,samples,rejectedQueries});
    }
    // Join positions establish only geometric endpoint agreement, not a wire.
    for(let i=0;i<4;i++) close(boundaries[i].samples.at(-1).point,boundaries[(i+1)%4].samples[0].point,1e-9);
    const boundaryModel={name:'boundaries_'+name.replaceAll('-','_'),version:0,lengthUnit:'mm',objects:curves};
    api.validateModel(boundaryModel);const exported=api.exportIGES(boundaryModel,curves.map(c=>c.id));
    assert.equal(exported.report.objects.length,4);assert.ok(exported.report.objects.every(o=>o.entity===126));
    boundaries.forEach((entry,i)=>entry.exportMapping=exported.report.objects[i]);assert.equal(json(model),before);
    const mapping={surfaceId:surface.id,boundaries:boundaries.map(({samples,rejectedQueries,...entry})=>entry)};
    const contents={'css':source,'surface.json':json(surface),'mapping.json':json(mapping),'model.json':json(boundaryModel),'samples.json':json(boundaries),'iges':exported.iges,'export-report.json':json(exported.report),'features.json':json(compiled.constructions??[])};
    const artifactHashes={};for(const [suffix,bytes] of Object.entries(contents)){writeFileSync(resolve(output,name+'.'+suffix),bytes);artifactHashes[suffix]=hash(bytes);}
    fixtures.push({name,surface,sourceVersion:compiled.ir.sourceVersion,constructions:compiled.constructions??[],boundaries,
      files:{source:name+'.css',surface:name+'.surface.json',mapping:name+'.mapping.json',iges:name+'.iges'},
      hashes:{source:hash(source),surface:hash(contents['surface.json']),mapping:hash(contents['mapping.json']),iges:hash(exported.iges)},artifactHashes});
  }
  const manifest={base:'a344d75623753a6e7d2471b48828912c85e01eca',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),producer:'Actual extracted CAD ESM archive',units:'mm; derivatives mm per original dimensionless parameter',fixtures};
  writeFileSync(resolve(output,'manifest.json'),json(manifest));writeFileSync(resolve(output,'manifest.sha256'),hash(json(manifest))+'\n');
  console.log('Packed boundary evidence: '+output);return manifest;
}
