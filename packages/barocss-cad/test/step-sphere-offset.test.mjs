import test from 'node:test';
import assert from 'node:assert/strict';
import { importStep, evaluateCadPart, checkBrep, brepMassProperties, brepSurfaceArea, BrepError } from '../dist/index.js';
import { checkOffsetBoundary, checkSphereOffsetPatch } from '../dist/io/step-offset-internal.js';
import { evaluateSurface, surfaceDomain } from '../dist/core/math.js';
import { sphereOffsetStep, offsetCircle, sphereSupport, witnessPatch } from './step-sphere-offset-fixtures.mjs';

const far=['999000','-998000','997000'];
const document=step=>({format:'barocss-cad-part',version:1,units:'mm',parameters:{},features:[{id:'n0',kind:'import',step}]});
function unsupported(text, phrase) {
  assert.throws(()=>evaluateCadPart(document(text)),e=>e.code==='CAPABILITY'&&e.message.includes(phrase));
}
function rawInput(text, phrase) { assert.throws(()=>importStep(text),e=>e instanceof BrepError&&e.code==='INPUT'&&e.message.includes(phrase)); }
function valid(text) {
  const b=importStep(text),r=checkBrep(b,{strict:true});assert.equal(r.valid,true,r.issues.join('\n'));
  assert.deepEqual([b.bodies.length,b.faces.length,b.edges.length,b.vertices.length],[1,2,2,2]);return b;
}
// Fixed before execution. V/A relative1e-9 ordinary,1e-6 tiny; M/I use the same
// root-selected profile. Absolute off-diagonal cap=relative*nonzero Iref, no floor.
function physical(b,radius,center,relative,centroidBudget) {
  const volume=4/3*Math.PI*radius**3,area=4*Math.PI*radius**2;
  assert.ok(Math.abs(brepSurfaceArea(b)-area)<=relative*area,'literal sphere area');
  for(const density of [1,2.7]){
    const expectedMass=volume*density*.001,expectedInertia=.4*expectedMass*radius**2,m=brepMassProperties(b,density);
    assert.ok(Math.abs(m.volume-volume)<=relative*volume,'literal sphere volume');
    assert.ok(Math.abs(m.mass-expectedMass)<=relative*expectedMass,'MMGS density conversion');
    for(let i=0;i<3;i++){
      assert.ok(Math.abs(m.centroid[i]-center[i])<=centroidBudget,'literal sphere centroid');
      for(let j=0;j<3;j++)assert.ok(Math.abs(m.inertia[i][j]-(i===j?expectedInertia:0))<=relative*expectedInertia,'literal central tensor');
    }
  }
}

for(const [place,center]of [['centered',['0','0','0']],['far',far]])for(const [sign,baseRadius,distance]of [['positive','0.00075','0.00025'],['negative','0.00125','-0.00025'],['zero','0.001','0']])test(`direct sphere offset ${place} ${sign} retains physical target and original tolerances`,()=>{
  const b=valid(sphereOffsetStep({radius:'0.001',baseRadius,distance,center,compound:true})),c=center.map(Number),tau=place==='far'?9.9900000048e-6:1e-7;
  assert.deepEqual(b.edges.map(e=>e.tolerance),[tau,tau]);assert.deepEqual(b.vertices.map(v=>v.tolerance),[tau,tau]);
  physical(b,.001,c,1e-6,place==='far'?8*2**-33:4096*Number.EPSILON);
});
test('ordinary R5 positive offset has independent volume area central inertia and public mm output',()=>{
  const text=sphereOffsetStep(),b=valid(text);physical(b,5,[0,0,0],1e-9,8*2**-33);
  const result=evaluateCadPart(document(text));assert.equal(result.outputs.length,1);assert.equal(result.outputs[0].brep.lengthUnit,'mm');
});
test('positive dyadic near-collapse offset keeps its represented support',()=>{
  const radius=1/1024,b=valid(sphereOffsetStep({radius:String(radius),baseRadius:'1',distance:String(-1023/1024)}));
  for(const f of b.faces){const{u,v}=surfaceDomain(f.surface);for(const a of [.125,.5,.875])for(const d of [.125,.5,.875]){
    const p=evaluateSurface(f.surface,u[0]+(u[1]-u[0])*a,v[0]+(v[1]-v[0])*d);assert.ok(Math.abs(Math.hypot(...p)-radius)<=1e-7);
  }}
});
for(const distance of ['-3','-4'])test(`sphere offset collapse/cross-focal ${distance} stays a named capability`,()=>unsupported(sphereOffsetStep({radius:'3',baseRadius:'3',distance}),'sphere radius at or beyond collapse'));
for(const selfIntersect of ['T','U'])test(`sphere offset advisory ${selfIntersect} does not bypass physical support`,()=>{
  const b=valid(sphereOffsetStep({selfIntersect}));physical(b,5,[0,0,0],1e-9,8*2**-33);
});
for(const [name,options]of [['reversed seam',{reversed:true}],['opposite face sense',{faceSense:false}]])test(`sphere offset ${name} preserves signed support semantics`,()=>{
  // Inward standalone shell is not a positive material-volume qualification.
  const b=valid(sphereOffsetStep(options));for(const f of b.faces){const{u,v}=surfaceDomain(f.surface);const p=evaluateSurface(f.surface,(u[0]+u[1])/2,(v[0]+v[1])/2);assert.ok(Math.abs(Math.hypot(...p)-5)<=1e-7);}
});

test('exact sphere certificate keeps all three coordinates',()=>checkOffsetBoundary(sphereSupport(),offsetCircle({points:[[0,1,0],[0,1,1],[0,0,1]]}),0,'face','edge'));
test('sphere certificate uses exact represented R+d and closed tolerance equality',()=>{
  const s=sphereSupport({radius:1,distance:2**-53}),c=offsetCircle();
  assert.equal(s.r,1);
  assert.throws(()=>checkOffsetBoundary(s,c,2**-54,'face','edge'),e=>e.code==='GEOMETRY');
  assert.doesNotThrow(()=>checkOffsetBoundary(s,c,2**-53,'face','edge'));
});
test('sphere certificate subtracts represented world center before rounding',()=>{
  // Exact x separation is1+2^-60; Number(1-(-2^-60)) would lose it.
  // The two transverse offsets add at most2^-79 to squared radius, below the2^-70 annulus reserve.
  const s=sphereSupport({radius:1,distance:2**-60,center:[-(2**-60),0,0]}),a=2**-40;
  assert.doesNotThrow(()=>checkOffsetBoundary(s,offsetCircle({points:[[1,0,0],[1,a,0],[1,a,a]],weights:[1,1,1]}),2**-70,'face','edge'));
});
test('correct endpoints do not admit a bulging quadratic sphere boundary',()=>assert.throws(()=>checkOffsetBoundary(sphereSupport(),offsetCircle({weights:[1,1,1]}),1e-7,'face','edge'),e=>e.code==='INPUT'&&/not supported/.test(e.message)));
test('sphere semicircle endpoints bind while its interior is separated by two',()=>{
  const c=offsetCircle({points:[[3,-4,0],[7,-4,0],[7,0,0],[7,4,0],[3,4,0]],weights:[1,1,2,2,4],knots:[0,0,0,.5,.5,1,1,1]});
  assert.equal(Math.hypot(...c.controlPoints[0]),5);assert.equal(Math.hypot(...c.controlPoints.at(-1)),5);assert.equal(Math.hypot(...c.controlPoints[2]),7);
  assert.throws(()=>checkOffsetBoundary(sphereSupport({radius:5}),c,1e-7,'face','edge'),e=>e.code==='INPUT'&&/not supported/.test(e.message));
});
test('constant or collinear final circle spans are refused even inside the annulus',()=>{
  for(const points of [[[1,0,0],[1,0,0],[1,0,0]],[[1,0,0],[1.00000001,0,0],[1,0,0]]])assert.throws(()=>checkOffsetBoundary(sphereSupport(),offsetCircle({points}),1e-7,'face','edge'),e=>e.code==='INPUT');
});
for(const [name,change]of [['degree',{degree:1}],['non-Bezier knots',{points:[[1,0,0],[1,1,0],[0,1,0],[-1,1,0],[-1,0,0]],weights:[1,1,2,1,1],knots:[0,0,0,.25,.5,1,1,1]}],['zero interval',{knots:[0,0,0,0,0,0]}],['nonpositive weight',{weights:[1,0,2]}]])test(`sphere certificate refuses ${name} without widening its span family`,()=>assert.throws(()=>checkOffsetBoundary(sphereSupport(),offsetCircle(change),1e-7,'face','edge'),e=>e.code==='INPUT'));
test('new offset face requires an exact interior two-dimensional witness',()=>{
  assert.doesNotThrow(()=>checkSphereOffsetPatch(sphereSupport(),witnessPatch(),'face'));
  assert.throws(()=>checkSphereOffsetPatch(sphereSupport(),witnessPatch({singular:true}),'face'),e=>e.code==='INPUT'&&/not supported/.test(e.message));
});
test('source circle radius contradiction cannot be hidden by endpoint pinning',()=>{
  const text=sphereOffsetStep().replace(/^#9=.*;$/m,"#9=CIRCLE('',#8,4);");
  assert.throws(()=>importStep(text),e=>e.code==='GEOMETRY'&&/OFFSET_SURFACE.*separated/.test(e.message));
});
for(const family of ['LINE','ELLIPSE','B_SPLINE_CURVE_WITH_KNOTS'])test(`new sphere offset refuses raw ${family} boundaries before reconstruction`,()=>{
  const text=sphereOffsetStep().replace(/^#9=.*;$/m,`#9=${family}('',#8,5,5);`);unsupported(text,`spherical boundary ${family}`);
});
test('sphere source family is checked on each use before a cached edge can return',()=>{
  // Admission-order control: a plain use caches the ellipse before the new offset use.
  // This intentionally tests the unsupported source refusal, not valid solid topology.
  const text=sphereOffsetStep().replace(/^#9=.*;$/m,"#9=ELLIPSE('',#8,5,5);")
    .replace(/^#21=.*;$/m,"#21=ADVANCED_FACE('plain',(#20),#28,.T.);")
    .replace(/^#22=.*;$/m,"#22=CLOSED_SHELL('',(#21,#29));")
    .replace('ENDSEC;\nEND-ISO-10303-21;',"#28=SPHERICAL_SURFACE('',#15,5);\n#29=ADVANCED_FACE('offset',(#20),#16,.T.);\nENDSEC;\nEND-ISO-10303-21;");
  unsupported(text,'spherical boundary ELLIPSE');
});
for(const base of ['OFFSET_SURFACE','ORIENTED_SURFACE','COMPLEX'])test(`new sphere offset does not recursively interpret ${base} basis`,()=>{
  const value=base==='COMPLEX'?"(BOUNDED_SURFACE()SPHERICAL_SURFACE('',#15,3))":`${base}('',#27,1,.F.)`;
  const text=sphereOffsetStep().replace(/^#27=.*;$/m,`#27=${value};`);unsupported(text,`basis ${base}`);
});
for(const [name,from,to]of [
  ['nonfinite distance',"OFFSET_SURFACE('',#27,2,.F.)","OFFSET_SURFACE('',#27,1E309,.F.)"],
  ['nonpositive radius',"SPHERICAL_SURFACE('',#15,3)","SPHERICAL_SURFACE('',#15,0)"],
  ['malformed logical',"OFFSET_SURFACE('',#27,2,.F.)","OFFSET_SURFACE('',#27,2,.X.)"],
  ['bad face sense',"#16,.T.)","#16,.U.)"],
  ['nonfinite frame',"#13=DIRECTION('',(0,0,1))","#13=DIRECTION('',(0,0,1E309))"],
  ['parallel frame',"#14=DIRECTION('',(1,0,0))","#14=DIRECTION('',(0,0,1))"],
])test(`new sphere offset rejects ${name} with a typed input refusal`,()=>{
  const original=sphereOffsetStep();assert.ok(original.includes(from));rawInput(original.replace(from,to),'OFFSET_SURFACE');
});
test('sphere offset wrapper cycles remain bounded named refusals',()=>unsupported(sphereOffsetStep().replace(/^#10=.*;$/m,"#10=SEAM_CURVE('',#10,(),.PCURVE_S1.);"),'wrapper cycle or depth'));
test('D435 dimensional-collapse refusal also guards new far spherical offsets',()=>unsupported(sphereOffsetStep({radius:'1e-12',baseRadius:'1e-12',distance:'0',center:far,compound:true}),'SPHERICAL_SURFACE patch precision is not supported'));
