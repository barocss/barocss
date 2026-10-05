import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const json = value => JSON.stringify(value, null, 2) + '\n';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const derivativeEvidenceRoot = () => resolve(process.env.BAROCSS_CAD_DERIVATIVE_EVIDENCE ?? '/Users/user/.barocss-ai/v3/verify-cad-ocp-8.0.1.1.0/evidence-507/derivatives');

// Independent closed-form rational quadratic quotient, not the native basis API.
function circleD1(u) {
  const w = Math.SQRT1_2;
  const a = (1-u)**2, b = 2*w*u*(1-u), c = u*u;
  const ap = -2*(1-u), bp = 2*w*(1-2*u), cp = 2*u;
  const d = a+b+c, dp = ap+bp+cp;
  return [10*((ap+bp)*d-(a+b)*dp)/(d*d), 10*((bp+cp)*d-(b+c)*dp)/(d*d), 0];
}
function asymmetricD1(u) {
  const first = u < 3;
  const a = first ? [1,2,3] : [5,7,-1], b = first ? [5,7,-1] : [12,3,4];
  const w0 = first ? 1 : 2, w1 = first ? 2 : .5, width = first ? 1 : 4;
  const t = first ? u-2 : (u-3)/4, d = (1-t)*w0+t*w1;
  return a.map((value,k) => w0*w1*(b[k]-value)/(d*d*width));
}
// Explicit four-pole bilinear homogeneous formula for both original partials.
function bilinearD1(u, v, weighted) {
  const s = weighted ? u : (u-2)/3, t = weighted ? v : (v+1)/4;
  const poles = weighted ? [[0,0,0],[1,7,3],[9,2,4],[12,8,-2]] : [[0,0,0],[0,8,2],[12,0,4],[15,9,7]];
  const weights = weighted ? [1,2,3,4] : [1,1,1,1];
  const n = [(1-s)*(1-t),(1-s)*t,s*(1-t),s*t];
  const ns = [-(1-t),-t,1-t,t], nt = [-(1-s),1-s,-s,s];
  const d = n.reduce((sum,x,k) => sum+x*weights[k],0);
  const ds = ns.reduce((sum,x,k) => sum+x*weights[k],0), dt = nt.reduce((sum,x,k) => sum+x*weights[k],0);
  const partial = (basis, wd, width) => [0,1,2].map(axis => {
    const a = n.reduce((sum,x,k) => sum+x*weights[k]*poles[k][axis],0);
    const ap = basis.reduce((sum,x,k) => sum+x*weights[k]*poles[k][axis],0);
    return (ap*d-a*wd)/(d*d*width);
  });
  return {du:partial(ns,ds,weighted?1:3),dv:partial(nt,dt,weighted?1:4)};
}
function analytic(name, u, v) {
  if (name==='c1-repeated-curve') return [1,2*u,3*u*u];
  if (name==='c1-repeated-surface') return {du:[1,2*u,3*u*u],dv:[0,0,7]};
  if (name === 'quarter-circle') return circleD1(u);
  if (name === 'reparameterized-circle') return circleD1((u-2)/3).map(x=>x/3);
  if (name === 'extrusion-asymmetric-curve') return asymmetricD1(u);
  if (name === 'quarter-cylinder' || name === 'extruded-cylinder') return {du:circleD1(u),dv:[0,0,30]};
  if (name === 'extruded-asymmetric') return {du:asymmetricD1(u),dv:[3,-2,7]};
  if (name === 'extruded-straight') return {du:[8/5,2/5,3/5],dv:[-1,5,4]};
  return bilinearD1(u,v,name==='preview-weighted');
}
const close = (actual, expected, limit) => {
  assert.ok(Math.hypot(...actual.map((x,k)=>x-expected[k])) <= limit*Math.max(1,Math.hypot(...expected)));
};

/** Called with the actual extracted ESM archive API, with separate retained files. */
export function writeDerivativeEvidence(api) {
  const output = derivativeEvidenceRoot(); mkdirSync(output,{recursive:true});
  const fractions = [0,.03,.07,.123,.21,.271,.33,.41,.5,.57,.66,.719,.8,.877,.93,.97,1];
  const vf = [0,.11,.23,.37,.5,.61,.79,.91,1], fixtures=[];
  const reparameterized = readFileSync(resolve(root,'examples/cad-nurbs/quarter-circle.css'),'utf8').replace('[0,0,0,1,1,1]','[2,2,2,5,5,5]');
  for (const name of ['quarter-circle','quarter-cylinder','asymmetric-patch','preview-weighted','extruded-cylinder','extruded-asymmetric','extruded-straight','extrusion-asymmetric-curve','reparameterized-circle','c1-repeated-curve','c1-repeated-surface']) {
    const construction = name.startsWith('extruded-') || name === 'extrusion-asymmetric-curve' || name.startsWith('c1-repeated-');
    const filename = name.startsWith('c1-repeated-')?'derivative-c1':name==='extrusion-asymmetric-curve'?'extruded-asymmetric':name;
    const source = name === 'reparameterized-circle' ? reparameterized : readFileSync(resolve(root,'examples/cad-nurbs/'+filename+'.css'),'utf8');
    const compiled = construction ? api.compileConstruction(source) : null;
    const model = compiled?.model ?? api.parseModel(source);
    const id = compiled ? (name==='extrusion-asymmetric-curve'||name==='c1-repeated-curve'?compiled.constructions[0].inputId:compiled.constructions[0].outputId) : model.objects[0].id;
    const native = model.objects.find(object=>object.id===id), before=json(model);
    const domain = native.kind==='curve'?api.curveDomain(native):api.surfaceDomain(native);
    const exported = api.exportIGES(model,[id]), samples=[];
    const interval = native.kind==='curve'?domain:domain.u;
    for (const f of fractions) {
      const u=(1-f)*interval[0]+f*interval[1];
      if(native.kind==='curve') {
        const result=api.evaluateCurveD1(native,u), expected=analytic(name,u);
        close(result.point,api.evaluateCurve(native,u),1e-12); close(result.derivative,expected,1e-9);
        samples.push({parameter:u,...result,analyticDerivative:expected});
      } else for(const g of vf) {
        const v=(1-g)*domain.v[0]+g*domain.v[1];
        const result=api.evaluateSurfaceD1(native,u,v), expected=analytic(name,u,v);
        close(result.point,api.evaluateSurface(native,u,v),1e-12);close(result.du,expected.du,1e-9);close(result.dv,expected.dv,1e-9);
        samples.push({u,v,...result,analyticDu:expected.du,analyticDv:expected.dv});
      }
    }
    if (name==='extruded-asymmetric') assert.throws(()=>api.evaluateSurfaceD1(native,3,.5),/C0/);
    if (name==='extrusion-asymmetric-curve') assert.throws(()=>api.evaluateCurveD1(native,3),/C0/);
    assert.equal(json(model),before);
    const contents={'css':source,'native.json':json(native),'iges':exported.iges,'samples.json':json(samples),'export-report.json':json(exported.report),'lineage.json':json(compiled?.constructions ?? [])};
    for(const [suffix,bytes] of Object.entries(contents)) writeFileSync(resolve(output,name+'.'+suffix),bytes);
    fixtures.push({name,id,entity:native.kind==='curve'?126:128,native,domain,samples,
      sourceVersion:compiled?1:0,geometryVersion:0,constructions:compiled?.constructions ?? [],
      files:{source:name+'.css',native:name+'.native.json',iges:name+'.iges'},
      hashes:{source:hash(source),native:hash(contents['native.json']),iges:hash(exported.iges)}});
  }
  const manifest={base:'1ca1c432dd07502162193b6c5ba8691971500078',head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),
    producer:'Actual extracted CAD ESM archive; original analytic first derivatives',units:'mm per original dimensionless knot parameter',
    limits:{analyticRelative:1e-9,exchangeRelative:1e-7,positionMM:1e-7},fixtures};
  writeFileSync(resolve(output,'manifest.json'),json(manifest));writeFileSync(resolve(output,'manifest.sha256'),hash(json(manifest))+'\n');
  console.log('Packed derivative evidence: '+output);
  return manifest;
}
