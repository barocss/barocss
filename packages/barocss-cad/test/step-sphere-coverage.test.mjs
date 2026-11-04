import test from 'node:test';
import assert from 'node:assert/strict';
import { importStep, checkBrep, brepMassProperties, brepSurfaceArea } from '../dist/index.js';
import { evaluateSurface, surfaceDomain } from '../dist/core/math.js';
import { sphereCoverageStep } from './step-sphere-coverage-fixtures.mjs';
import { cylinderStep } from './step-fixtures.mjs';
function coverage(options) {
  const radius=options.radius??0.001,center=options.center??[0,0,0],b=importStep(sphereCoverageStep(options)),check=checkBrep(b,{strict:true});
  assert.equal(check.valid,true,check.issues.join('\n'));assert.equal(b.bodies.length,1);assert.equal(b.shells.length,1);assert.equal(b.faces.length,2);assert.equal(b.edges.length,2);assert.equal(b.vertices.length,2);
  assert.deepEqual(b.faces.map(f=>f.name),['ball#1','ball#2']);
  const mids=[];
  for(const face of b.faces){
    const s=face.surface,{u,v}=surfaceDomain(s),p=evaluateSurface(s,(u[0]+u[1])/2,(v[0]+v[1])/2),relativeY=(p[1]-center[1])/radius;
    assert.ok(Math.abs(Math.abs(relativeY)-1)<=1e-6,`hemisphere interior normalizedY ${relativeY}`);mids.push(relativeY);
    for(const a of [0.125,0.25,0.5,0.75,0.875])for(const d of [0.125,0.5,0.875]){
      const q=evaluateSurface(s,u[0]+(u[1]-u[0])*a,v[0]+(v[1]-v[0])*d);
      assert.ok(Math.abs(Math.hypot(...q.map((x,k)=>x-center[k]))-radius)<=1e-7,'native support stays on literal sphere within existing tolerance');
    }
  }
  assert.ok(mids[0]*mids[1]<-0.999999,'two faces must cover opposite hemispheres, not duplicate one');
  assert.notDeepEqual(b.faces[0].surface.controlPoints,b.faces[1].surface.controlPoints,'complementary patches must not be identical');
  return b;
}
test('tiny far-center sphere retains two complementary hemispheres',()=>coverage({radius:0.001,center:[999000,999000,999000]}));
test('same tiny sphere near the origin remains complementary',()=>coverage({radius:0.001,center:[0,0,0]}));
test('larger far-center sphere remains complementary without a tiny-volume verdict',()=>coverage({radius:0.01,center:[999000,999000,999000]}));
test('tilted far-center sphere uses translation-stable hemisphere selection',()=>coverage({radius:0.001,center:[999000,999000,999000],tilted:true}));
test('reversed seam direction retains both hemispheres',()=>coverage({radius:0.001,center:[999000,999000,999000],reversed:true}));
for(const radius of [5,7])test(`ordinary centered sphere R${radius} retains literal volume and area`,()=>{
  const b=coverage({radius,center:[0,0,0]}),v=4/3*Math.PI*radius**3,a=4*Math.PI*radius**2;
  assert.ok(Math.abs(brepMassProperties(b,1).volume-v)<=1e-9*v);assert.ok(Math.abs(brepSurfaceArea(b)-a)<=1e-9*a);
});
test('non-spherical cylinder import retains its analytic control',()=>{
  const b=importStep(cylinderStep(5,10)),check=checkBrep(b,{strict:true});assert.equal(check.valid,true,check.issues.join('\n'));assert.equal(b.faces.length,4);
  assert.ok(Math.abs(brepMassProperties(b,1).volume-250*Math.PI)<=1e-9*250*Math.PI);
});
