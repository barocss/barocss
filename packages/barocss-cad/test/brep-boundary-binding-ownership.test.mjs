import test from 'node:test';
import assert from 'node:assert/strict';
import { brepFromTriangles } from '../dist/mesh/mesh-brep.js';
import { facetBrepFromTriangles } from '../dist/mesh/facet-brep.js';
import { transformBrep } from '../dist/brep/brep-transform.js';
import { brepMassProperties, brepSurfaceArea } from '../dist/brep/solid-mass.js';
import { assertBoundaryBindings, registerImmutableMeshPlaneExclusion } from '../dist/brep/brep-boundary-binding-internal.js';
import { baselineBox, tentSurface } from './brep-boundary-binding-fixtures.mjs';
function input() {
  return { positions:[0,0,0,1,0,0,1,1,0,0,1,0,0,0,1,1,0,1,1,1,1,0,1,1], indices:[0,3,2,0,2,1,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7] };
}
const bad = e => e?.code==='GEOMETRY' && /edge is separated from its face surface/.test(e.message);
function top(b) {return b.faces.find(f=>f.surface.kind==='surface'&&f.surface.controlPoints.every(row=>row.every(p=>p[2]===1)));}

test('mesh-owned headers and knot counts are locked without retaining/freezing caller inputs or coordinate arrays',()=>{
  const raw=input(),before=structuredClone(raw),b=brepFromTriangles(raw.positions,raw.indices,{id:'owned'});
  assert.deepEqual(raw,before);assert.equal(Object.isFrozen(raw.positions),false);assert.equal(Object.isFrozen(raw.indices),false);
  assert.equal(Object.isFrozen(b),true);assert.equal(Object.isFrozen(b.faces),true);
  for(const face of b.faces){const s=face.surface;assert.equal(Object.isFrozen(face),true);assert.equal(Object.isFrozen(s),true);assert.equal(Object.isFrozen(s.knotsU),true);assert.equal(Object.isFrozen(s.knotsV),true);assert.equal(Object.isFrozen(s.controlPoints),false);for(const row of s.controlPoints){assert.equal(Object.isFrozen(row),false);for(const p of row)assert.equal(Object.isFrozen(p),false);}}
  const snapshot=JSON.stringify(b);assert.doesNotThrow(()=>{raw.positions.fill(123);raw.indices.fill(0);});assert.equal(JSON.stringify(b),snapshot);
  assert.ok(Math.abs(brepMassProperties(b,1).volume-1)<1e-12);assert.ok(Math.abs(brepSurfaceArea(b)-6)<1e-12);
});
test('structural replacement cannot invalidate an owned permanent noneligibility certificate',()=>{
  const raw=input(),b=brepFromTriangles(raw.positions,raw.indices),f=b.faces[0],s=f.surface;
  assert.throws(()=>{b.faces=[];},TypeError);assert.throws(()=>b.faces.push(f),TypeError);
  assert.throws(()=>{f.surface=tentSurface();},TypeError);assert.throws(()=>{s.kind='facets';},TypeError);
  assert.throws(()=>{s.degreeU=2;},TypeError);assert.throws(()=>{s.knotsU=[0,0,0,1,1,1];},TypeError);
  assert.throws(()=>s.knotsU.push(1),TypeError);assert.throws(()=>{s.knotsV.length=9;},TypeError);
  // Coordinate/container edits cannot make native4+4 knots admit a valid >=3-pole graph.
  const saved=structuredClone(s.controlPoints);assert.doesNotThrow(()=>s.controlPoints.push(structuredClone(saved[0])));
  assert.doesNotThrow(()=>assertBoundaryBindings(b));assert.doesNotThrow(()=>s.controlPoints.pop());assert.deepEqual(s.controlPoints,saved);
});
test('JSON and spread copies inherit no permanent exclusion; forged mesh provenance does not bypass live proof',()=>{
  const raw=input(),b=brepFromTriangles(raw.positions,raw.indices,{id:'owned'}),json=JSON.stringify(b);
  const clone=JSON.parse(json);assert.equal(JSON.stringify(clone),json);assert.equal(registerImmutableMeshPlaneExclusion(clone),false);
  brepMassProperties(clone,1);brepSurfaceArea(clone);top(clone).surface=tentSurface();assert.throws(()=>brepMassProperties(clone,1),bad);assert.throws(()=>brepSurfaceArea(clone),bad);
  const spread={...b,faces:b.faces.map(f=>({...f}))};assert.equal(registerImmutableMeshPlaneExclusion(spread),false);top(spread).surface=tentSurface();assert.throws(()=>assertBoundaryBindings(spread),bad);
  const forged=baselineBox();forged.source={family:'mesh',id:'owned'};brepMassProperties(forged,1);forged.faces.find(f=>f.name==='top').surface=tentSurface();assert.throws(()=>assertBoundaryBindings(forged),bad);
});
test('transform results inherit no exclusion and retain their mutable live-check path',()=>{
  const raw=input(),b=brepFromTriangles(raw.positions,raw.indices),m=transformBrep(b,{matrix:[1,0,0,0,1,0,0,0,1]});
  assert.equal(Object.isFrozen(m),false);assert.equal(registerImmutableMeshPlaneExclusion(m),false);
  brepMassProperties(m,1);top(m).surface=tentSurface();assert.throws(()=>brepMassProperties(m,1),bad);
});
test('raw caller, FacetPatch and mixed inputs are never frozen or registered by the exclusion verifier',()=>{
  const raw=input(),f=facetBrepFromTriangles(raw.positions,raw.indices),caller=baselineBox();
  const mixed={...caller,faces:[...caller.faces,...f.faces]};
  for(const b of [f,caller,mixed]){const before=JSON.stringify(b);assert.equal(registerImmutableMeshPlaneExclusion(b),false);assert.doesNotThrow(()=>assertBoundaryBindings(b));assert.equal(Object.isFrozen(b),false);assert.equal(Object.isFrozen(b.faces),false);assert.equal(JSON.stringify(b),before);}
  for(const face of f.faces){assert.equal(Object.isFrozen(face),false);assert.equal(Object.isFrozen(face.surface),false);assert.equal(Object.isFrozen(face.surface.positions),false);}
});
