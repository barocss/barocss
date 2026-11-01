import test from 'node:test';
import assert from 'node:assert/strict';
import { importStep, checkBrep, brepMassProperties, brepSurfaceArea, transformBrep, facetBrepFromTriangles } from '../dist/index.js';
import { wholePatchTest, brepQuadratureIntegrals } from '../dist/brep/brep-mass-quadrature.js';
import { readNativeSIInertia } from '../dist/internal/native-si-mass-state.js';
import { massTranslationSphereStep, massTranslationSphereOracle, MASS_TRANSLATION_BUDGET as budget, quadraticRoofBox } from './brep-mass-translation-fixtures.mjs';
import { cylinderStep } from './step-fixtures.mjs';
const identity=[1,0,0,0,1,0,0,0,1];
const relative=(a,b,tolerance,label)=>assert.ok(Math.abs(a-b)<=Math.abs(b)*tolerance,`${label}: ${a} vs ${b}`);
function sphere(options,density=2.7) {
  const b=importStep(massTranslationSphereStep(options)),before=JSON.stringify(b),o=massTranslationSphereOracle({...options,density}),m=brepMassProperties(b,density),a=brepSurfaceArea(b);
  assert.equal(checkBrep(b,{strict:true}).valid,true);assert.equal(b.faces.length,2);assert.equal(b.edges.length,2);assert.equal(b.vertices.length,2);
  assert.equal(m.method,'quadrature');relative(m.volume,o.volume,budget.literalVolumeRelative,'literal volume');relative(a,o.area,budget.literalAreaRelative,'literal area');relative(m.mass,o.mass,budget.literalVolumeRelative,'MMGS mass');
  for(let i=0;i<3;i++){
    assert.ok(Math.abs(m.centroid[i]-o.center[i])<=budget.centroid,'literal centroid');
    for(let j=0;j<3;j++)assert.ok(Math.abs(m.inertia[i][j]-(i===j?o.inertia:0))<=o.inertia*budget.literalInertiaRelative,`literal centroidal inertia ${i},${j}`);
  }
  const si=readNativeSIInertia(m);assert.equal(si.ok,true);assert.equal(si.density,density);
  for(let i=0;i<3;i++)for(let j=0;j<3;j++)assert.ok(Math.abs(si.inertia[i][j]-m.inertia[i][j]*1e-9)<=o.inertia*1e-9*1e-14,'native SI central basis retained');
  assert.equal(JSON.stringify(b),before,'authored geometry, topology, tolerances and UV data remain unchanged');return {b,m,a};
}
for(const [name,options] of [
 ['original compound far',{center:[999000,-998000,997000]}],
 ['same compound rotation centered',{center:[0,0,0]}],
 ['negative compound far',{center:[-999000,998000,-997000]}],
 ['one wide/cross-zero axis',{center:[0,-998000,997000]}],
 ['reversed seam compound far',{center:[999000,-998000,997000],reversed:true}],
])test(`${name}: relative tiny-body V/A, centroid and centroidal inertia`,()=>sphere(options));
test('ordinary centered sphere retains the existing strict analytic precision',()=>{
 const {m,a}=sphere({radius:5,center:[0,0,0]});relative(m.volume,4/3*Math.PI*125,1e-9,'ordinary volume');relative(a,100*Math.PI,1e-9,'ordinary area');
});
test('collapsed-pole interior trim declines full-support integration at either world origin',()=>{
 for(const center of [[999000,-998000,997000],[0,0,0]]){const b=importStep(massTranslationSphereStep({center})),whole=wholePatchTest(b);assert.ok(b.faces.every(f=>!whole(f)),'interior meridians are not domain sides');}
});
test('the same stored far geometry is translation invariant, with origin restored only to centroid',()=>{
 const origin=[999000,-998000,997000],b=importStep(massTranslationSphereStep({center:origin})),before=JSON.stringify(b),local=transformBrep(b,{matrix:identity,offset:origin.map(x=>-x)}),m=brepMassProperties(b,1),n=brepMassProperties(local,1);
 relative(m.volume,n.volume,budget.sameGeometryRelative,'represented volume');relative(brepSurfaceArea(b),brepSurfaceArea(local),budget.sameGeometryRelative,'represented area');
 for(let i=0;i<3;i++){assert.ok(Math.abs(m.centroid[i]-(n.centroid[i]+origin[i]))<=2**-33,'centroid restored once');for(let j=0;j<3;j++)assert.ok(Math.abs(m.inertia[i][j]-n.inertia[i][j])<=n.inertia[0][0]*budget.sameGeometryRelative,'centroidal tensor unchanged by translation');}
 assert.equal(JSON.stringify(b),before);
});
test('curved polynomial roof remains a whole patch and preserves asymmetric centroid',()=>{
 const b=quadraticRoofBox(),top=b.faces.find(f=>f.name==='top');assert.equal(wholePatchTest(b)(top),true);
 const wantVolume=91/90,wantZ=(1+1/45+1/5625)/(2*wantVolume),m=brepMassProperties(b,1);relative(m.volume,wantVolume,1e-12,'polynomial roof volume');assert.ok(Math.abs(m.centroid[2]-wantZ)<1e-12);
 const origin=[900000,-800000,700000],far=transformBrep(b,{matrix:identity,offset:origin}),n=brepMassProperties(far,1);
 relative(n.volume,m.volume,1e-9,'roof volume translation');relative(brepSurfaceArea(far),brepSurfaceArea(b),1e-8,'roof area translation');
 for(let i=0;i<3;i++){assert.ok(Math.abs(n.centroid[i]-(m.centroid[i]+origin[i]))<=2**-33);for(let j=0;j<3;j++)assert.ok(Math.abs(n.inertia[i][j]-m.inertia[i][j])<=m.inertia[0][0]*1e-8);}
});
test('translated trimmed cylinder retains analytic mass and asymmetric height centroid',()=>{
 const b=importStep(cylinderStep(2,4)),origin=[900000,-800000,700000],far=transformBrep(b,{matrix:identity,offset:origin}),m=brepMassProperties(far,1),mass=16*Math.PI*.001;
 relative(m.volume,16*Math.PI,1e-9,'cylinder volume');relative(brepSurfaceArea(far),24*Math.PI,1e-9,'cylinder area');
 for(let k=0;k<3;k++)assert.ok(Math.abs(m.centroid[k]-(origin[k]+(k===2?2:0)))<1e-8);
 relative(m.inertia[0][0],mass*28/12,1e-8,'cylinder transverse I');relative(m.inertia[2][2],mass*2,1e-8,'cylinder axial I');
});
test('raw quadrature still returns world first moments, without hidden origin metadata',()=>{
 const origin=[7,-9,11],b=transformBrep(quadraticRoofBox(),{matrix:identity,offset:origin}),q=brepQuadratureIntegrals(b,8),m=brepMassProperties(b,1);
 assert.equal(q.meshed,false);assert.equal('origin' in q,false);relative(q.integrals[0],91/90,1e-12,'raw volume');
 for(let k=0;k<3;k++)assert.ok(Math.abs(q.integrals[k+1]/q.integrals[0]-m.centroid[k])<1e-12,'raw first moment remains in caller coordinates');
});
test('mass-first and area-first cache hits retain density and stable local moments',()=>{
 for(const first of ['mass','area']){const b=importStep(massTranslationSphereStep()),before=JSON.stringify(b);if(first==='area')brepSurfaceArea(b);else brepMassProperties(b,1);
  const m=brepMassProperties(b,1),a=brepSurfaceArea(b);assert.deepEqual(brepMassProperties(b,1),m);assert.equal(brepSurfaceArea(b),a);const n=brepMassProperties(b,2.7);relative(n.mass,2.7*m.mass,1e-14,'cached density');for(let i=0;i<3;i++)relative(n.inertia[i][i],2.7*m.inertia[i][i],1e-14,'cached tensor density');assert.equal(JSON.stringify(b),before);
 }
});
test('wide native coordinate span is not doubled by the private origin',()=>{
 const b=transformBrep(quadraticRoofBox(),{matrix:[2e6,0,0,0,1,0,0,0,1],offset:[-1e6,100,999000]}),before=JSON.stringify(b),m=brepMassProperties(b,1);
 assert.equal(m.method,'quadrature');relative(m.volume,2e6*91/90,1e-9,'wide volume');assert.ok(Math.abs(m.centroid[0])<1e-5);assert.equal(JSON.stringify(b),before);
});
test('facet-only and mixed native/facet paths retain their existing geometry and values',()=>{
 const positions=[0,0,0,1,0,0,0,1,0,0,0,1],indices=[0,2,1,0,1,3,1,2,3,2,0,3],facet=facetBrepFromTriangles(positions,indices,{id:'tetra'}),f=brepMassProperties(facet,1);
 relative(f.volume,1/6,1e-12,'facet volume');assert.equal(f.method,'planar-exact');
 const b=quadraticRoofBox(),bottom=b.faces[0],surface=bottom.surface,points=[surface.controlPoints[0][0],surface.controlPoints[1][0],surface.controlPoints[1][1],surface.controlPoints[0][1]];
 bottom.surface={kind:'facets',id:'bottom_facets',positions:new Float64Array(points.flat()),indices:new Uint32Array([0,1,2,0,2,3]),bounds:new Float64Array([0,0,0,1,1,0])};const before=structuredClone(b),m=brepMassProperties(b,1);relative(m.volume,91/90,1e-12,'mixed volume');assert.deepEqual(b,before);assert.equal(Object.isFrozen(bottom.surface),false);
});
