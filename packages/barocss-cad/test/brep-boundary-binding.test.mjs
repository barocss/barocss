import test from 'node:test';
import assert from 'node:assert/strict';
import { validateSurface, evaluateSurface } from '../dist/core/math.js';
import { checkBrep, assertValidBrep } from '../dist/brep/brep-core.js';
import { faceBoundaryContradiction, assertBoundaryBindings } from '../dist/brep/brep-boundary-binding-internal.js';
import { wholePatchTest, brepQuadratureIntegrals } from '../dist/brep/brep-mass-quadrature.js';
import { tessellateBrep } from '../dist/brep/brep-tessellate.js';
import { brepMassProperties, brepSurfaceArea } from '../dist/brep/solid-mass.js';
import { exportStep } from '../dist/io/step.js';
import { importStep } from '../dist/io/step-import.js';
import { TENT_E, tentSurface, baselineBox, invalidBox, graphSheet, matchedBox, withTentStep, slopedBox } from './brep-boundary-binding-fixtures.mjs';
const message = /edge is separated from its face surface/;
const refusal = e => e?.code === 'GEOMETRY' && message.test(e.message);
const top = b => b.faces.find(f=>f.name==='top');
const contradiction = b => faceBoundaryContradiction(b,b.faces[0]);

test('original-limit tent is native but its authored flat boundary is provably not bound', () => {
  const s = tentSurface(); assert.doesNotThrow(()=>validateSurface(s));
  assert.deepEqual(evaluateSurface(s,TENT_E,0),[TENT_E,0,2]);
  const b = invalidBox(), before = structuredClone(b);
  // 1mm is a same-u vertical delta. The exact nearest gap is 1/sqrt(65537), NOT 1mm.
  assert.ok(1 / Math.sqrt(65537) > 1e-7);
  for (const strict of [false,true]) { const r=checkBrep(b,{strict}); assert.equal(r.valid,false); assert.ok(r.issues.some(i=>message.test(i))); }
  assert.throws(()=>assertValidBrep(b),refusal); assert.deepEqual(b,before);
});
test('whole-patch classification declines a proved contradiction while the valid box stays a whole patch', () => {
  const bad=invalidBox(), good=baselineBox();
  assert.equal(wholePatchTest(bad)(top(bad)),false); assert.equal(wholePatchTest(good)(top(good)),true);
});
for (const [name,consume] of [
  ['quadrature',b=>brepQuadratureIntegrals(b,8)], ['mass',b=>brepMassProperties(b,1)],
  ['mass with quadrature disabled',b=>brepMassProperties(b,1,{quadratureSegments:0})],
  ['area',b=>brepSurfaceArea(b)], ['area with quadrature disabled',b=>brepSurfaceArea(b,{quadratureSegments:0})],
  ['tessellation',b=>tessellateBrep(b)],
  ['STEP with validation',b=>exportStep(b)], ['STEP metadata off',b=>exportStep(b,{validationProperties:false})],
  ['STEP list metadata off',b=>exportStep([b],{validationProperties:false})], ['STEP output wrapper',b=>exportStep({id:'bad',brep:b},{validationProperties:false})],
]) test(`${name}: proved invalid binding refuses before any numerical fallback or export`, () => {
  const b=invalidBox(), before=structuredClone(b); assert.throws(()=>consume(b),refusal); assert.deepEqual(b,before);
});
test('mass and area caches cannot hide a later contradiction in the same Brep object', () => {
  const b=baselineBox(); assert.ok(Math.abs(brepMassProperties(b,1).volume-1)<1e-12); brepSurfaceArea(b);
  top(b).surface=tentSurface(); assert.throws(()=>brepMassProperties(b,1),refusal); assert.throws(()=>brepSurfaceArea(b),refusal);
});
test('import rejects the original malformed boundary bytes even with otherwise valid solid topology', () => {
  const base=exportStep(baselineBox(),{timestamp:'2026-11-01T00:00:00Z'}), bad=withTentStep(base);
  assert.equal(checkBrep(importStep(base)).valid,true); assert.throws(()=>importStep(bad),refusal);
});
const permutations=[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
function reverseAxis(s,axis) {
  const key=axis==='u'?'knotsU':'knotsV', k=s[key], sum=k[0]+k.at(-1); s[key]=k.toReversed().map(x=>sum-x);
  if(axis==='u'){s.controlPoints.reverse();s.weights.reverse();}else{for(const row of s.controlPoints)row.reverse();for(const row of s.weights)row.reverse();}
}
function transpose(s) {const p=s.controlPoints,w=s.weights; s.controlPoints=p[0].map((_,j)=>p.map(row=>row[j]));s.weights=w[0].map((_,j)=>w.map(row=>row[j]));[s.degreeU,s.degreeV]=[s.degreeV,s.degreeU];[s.knotsU,s.knotsV]=[s.knotsV,s.knotsU];}
for(const permutation of permutations) for(const transposed of [false,true]) for(const reverse of ['none','u','v']) test(`Cartesian${permutation} transpose=${transposed} reverse=${reverse}: same exact contradiction`,()=>{
  const s=tentSurface();if(transposed)transpose(s);if(reverse!=='none')reverseAxis(s,reverse);
  s.controlPoints=s.controlPoints.map(row=>row.map(p=>permutation.map(i=>p[i])));
  const a=permutation.map(i=>[0,0,1][i]),b=permutation.map(i=>[1,0,1][i]),sheet=graphSheet(s,a,b);
  assert.match(contradiction(sheet),message);
  sheet.edges[0].curve.controlPoints.reverse(); assert.match(contradiction(sheet),message);
});
for(const factor of [1e-6,0.125,123,1e6])test(`uniform rational weight factor ${factor} preserves the physical contradiction`,()=>{
  const s=tentSurface();s.weights=s.weights.map(row=>row.map(()=>factor));const b=graphSheet(s,[0,0,1],[1,0,1]);
  b.edges[0].curve.weights=[factor,factor];assert.match(contradiction(b),message);
});
test('a valid trim interval outside the tent is not rejected for unused outer-domain protrusion',()=>{
  const b=graphSheet(tentSurface(),[2*TENT_E,0,1],[1,0,1]);assert.equal(contradiction(b),null);assert.doesNotThrow(()=>assertBoundaryBindings(b));
});
test('line endpoint witnesses detect an invalid local interval containing no graph break',()=>{
  const b=graphSheet(tentSurface(),[TENT_E/4,0,1],[TENT_E/2,0,1]);assert.match(contradiction(b),message);
});
function thresholdSheet(delta) {
  const s=2**-20, surface={kind:'surface',id:'threshold',degreeU:1,degreeV:1,knotsU:[0,0,1,2,2],knotsV:[0,0,1,1],controlPoints:[[0,0],[4,3],[8,0]].map(([x,z])=>[[x*s,0,z*s],[x*s,s,z*s]]),weights:[[1,1],[1,1],[1,1]]};
  return graphSheet(surface,[3*s,0,(3-delta)*s],[5*s,0,(3-delta)*s],s);
}
for(const [label,delta,reject]of[['within declared tolerance',19/16,false],['exact bound equality',5/4,false],['above raw tolerance but within the former loose strict threshold',21/16,true]])test(label,()=>{
  // L=3/4, sqrt(1+L²)=5/4 EXACT. All quantities below are dyadic; comparison needs no epsilon.
  const b=thresholdSheet(delta),result=contradiction(b);assert.equal(!!result,reject);if(reject)assert.match(result,message);
});
test('genuinely matched piecewise boundary remains a valid nonplanar solid with its literal volume',()=>{
  const b=matchedBox(),before=structuredClone(b);assert.doesNotThrow(()=>assertBoundaryBindings(b));
  const report=checkBrep(b,{strict:true});assert.equal(report.valid,true,JSON.stringify(report.issues));
  assert.equal(wholePatchTest(b)(top(b)),true);
  assert.ok(Math.abs(brepMassProperties(b,1).volume-1.25)<1e-12); assert.ok(tessellateBrep(b).positions.some(x=>x===2));
  const back=importStep(exportStep(b,{timestamp:'2026-11-01T00:00:00Z'}));assert.equal(checkBrep(back).valid,true);
  assert.ok(Math.abs(brepMassProperties(back,1).volume-1.25)<1e-12);assert.deepEqual(b,before);
});
test('defensive proof admission does not read absent native weights or point grids',()=>{
  const b=invalidBox();b.edges.find(e=>e.id==='e4_5').curve.weights=undefined;assert.equal(faceBoundaryContradiction(b,top(b))===null,false); // Other incident edge still proves it.
  for(const e of b.edges)e.curve.weights=undefined;assert.equal(faceBoundaryContradiction(b,top(b)),null);
  top(b).surface.controlPoints=undefined;assert.equal(faceBoundaryContradiction(b,top(b)),null);
});

test('warm nonconstant sheared-box graph rejects an in-place coefficient tent without any identity change', () => {
  const b=slopedBox(), faces=b.faces, s=top(b).surface, points=s.controlPoints;
  assert.equal(checkBrep(b).valid,true);assert.ok(Math.abs(brepMassProperties(b,1).volume-1)<1e-12);brepSurfaceArea(b);
  for(const p of points[1])p[2]+=1;
  assert.equal(b.faces,faces);assert.equal(top(b).surface,s);assert.equal(s.controlPoints,points);
  assert.throws(()=>brepSurfaceArea(b),refusal);assert.throws(()=>brepMassProperties(b,1),refusal);
});
test('warm planar body rejects a graph replacement at the last face without changing the face list', () => {
  const b=baselineBox(), last=top(b);b.faces=[...b.faces.filter(f=>f!==last),last];const faces=b.faces;
  assert.ok(Math.abs(brepMassProperties(b,1).volume-1)<1e-12);brepSurfaceArea(b);
  last.surface=tentSurface();assert.equal(b.faces,faces);assert.equal(b.faces.at(-1),last);
  assert.throws(()=>brepSurfaceArea(b),refusal);assert.throws(()=>brepMassProperties(b,1),refusal);
});
