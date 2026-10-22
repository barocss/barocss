import test from 'node:test';
import assert from 'node:assert/strict';
import { revolveProfile, revolveMassProperties } from '../dist/revolve.js';
import { assertValidBrep } from '../dist/brep-core.js';
import { brepMassProperties } from '../dist/solid-mass.js';

const rect = (x,y,w,h) => [[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]].map(start=>({kind:'line',start}));
const circle = (x,y,r) => [{kind:'arc',start:[x+r,y],center:[x,y],direction:'ccw'}];
const near = (g,w,label,tol=1e-12,scale=1) => assert.ok(Math.abs(g-w)<=tol*Math.max(scale,Math.abs(w)),`${label}: ${g} vs ${w}`);
// Independent rectangular/disk Cartesian moments and elementary angle integrals.
// Neither Kernel Green integration nor the generated BRep supplies oracle values.
const rectangle = (x,y,w,h,sign=1) => ({x,y,A:sign*w*h,vx:w*w/12,vy:h*h/12});
const disk = (x,y,r,sign=1) => ({x,y,A:sign*Math.PI*r*r,vx:r*r/4,vy:r*r/4});
function oracle(pieces, degrees, rho) {
  const a=degrees*Math.PI/180, sum=f=>pieces.reduce((v,p)=>v+p.A*f(p),0);
  const r=sum(p=>p.y), r2=sum(p=>p.y*p.y+p.vy), r3=sum(p=>p.y**3+3*p.y*p.vy), hr=sum(p=>p.x*p.y), hhr=sum(p=>(p.x*p.x+p.vx)*p.y), hr2=sum(p=>p.x*(p.y*p.y+p.vy));
  const V=a*r,c=[a*hr/V,Math.sin(a)*r2/V,(1-Math.cos(a))*r2/V];
  const cc=a/2+Math.sin(2*a)/4,ss=a/2-Math.sin(2*a)/4,sc=Math.sin(a)**2/2;
  const Q=[[a*hhr,Math.sin(a)*hr2,(1-Math.cos(a))*hr2],[Math.sin(a)*hr2,cc*r3,sc*r3],[(1-Math.cos(a))*hr2,sc*r3,ss*r3]];
  const C=Q.map((row,i)=>row.map((q,j)=>q-V*c[i]*c[j])), trace=C[0][0]+C[1][1]+C[2][2], k=rho*1e-15;
  return {V,c,mass:rho*V*1e-9,I:C.map((row,i)=>row.map((q,j)=>k*((i===j?trace:0)-q)))};
}
function check(profile,holes,pieces,degrees) {
  const input={id:'r',profile,holes,axis:{origin:[0,0],direction:[1,0]},angleDegrees:degrees};
  const b=revolveProfile(input), report=assertValidBrep(b); assert.equal(report.valid,true);assert.equal(b.bodies.length,1);
  assert.equal(b.shells.length,degrees===360?1+holes.length:1);
  if(degrees<360) for(const end of ['start','end']) {
    const cap=b.faces.find(f=>f.name===`r.${end}`);assert.ok(cap);
    const capLoops=b.loops.filter(l=>l.face===cap.id);assert.equal(capLoops.length,holes.length+1);assert.equal(capLoops.filter(l=>l.kind==='inner').length,holes.length);
  }
  const rho=7850,w=oracle(pieces,degrees,rho), closed=revolveMassProperties(input,rho), actual=brepMassProperties(b,rho);
  for(const [kind,m] of [['closed',closed],['native',actual]]) {
    near(m.volumeMM3,w.V,`${kind} Pappus volume`);near(m.massKG,w.mass,`${kind} mass`);
    m.centroidMM.forEach((x,i)=>near(x,w.c[i],`${kind} c${i}`));
    const scale=Math.max(...w.I.flat().map(Math.abs));
    m.inertiaCentroidKgM2.forEach((row,i)=>row.forEach((x,j)=>near(x,w.I[i][j],`${kind} I${i}${j}`,1e-12,scale)));
  }
  return b;
}
test('FRk4 direct rectangular tube: partial inner caps and full inward cavity, independent V/C/all9I',()=>{
  for(const deg of [45,120,240,360]) check(rect(0,100,30,40),[rect(0,100,24,34)],[rectangle(0,100,30,40),rectangle(0,100,24,34,-1)],deg);
});
test('FRk4 direct round tube: toroidal bore walls, independent V/C/all9I',()=>{
  for(const deg of [60,180,270,360]) check(circle(0,80,12),[circle(0,80,9)],[disk(0,80,12),disk(0,80,9,-1)],deg);
});
test('FRk4 two offset bores preserve nonzero product moments, winding and persistent tags',()=>{
  for(const deg of [110,360]) check(rect(0,100,60,40),[circle(-12,96,5),rect(10,105,9,11)],[rectangle(0,100,60,40),disk(-12,96,5,-1),rectangle(10,105,9,11,-1)],deg);
  const input={id:'tagged',profile:rect(0,100,30,40),holes:[rect(0,100,24,34)],sideTags:['a','b','c','d'],holeTags:[['e','f','g','h']],axis:{origin:[0,0],direction:[1,0]},angleDegrees:90};
  const b=revolveProfile(input);assertValidBrep(b);
  for(const tag of ['a','b','c','d','e','f','g','h']) assert.ok(b.faces.some(f=>f.name===`tagged.side[${tag}]`));
  const clockwise={...input,holes:[rect(0,100,24,34).reverse()]};
  near(revolveMassProperties(clockwise,1).volumeMM3,revolveMassProperties(input,1).volumeMM3,'authored winding');
});
test('FRk4 bore refusal: outside, touching, crossing, overlapping, nested; no Boolean repair',()=>{
  const p=rect(0,100,30,40), base={profile:p,axis:{origin:[0,0],direction:[1,0]},angleDegrees:90};
  const bad=[[rect(40,100,4,4)],[rect(13,100,4,4)],[rect(15,100,5,5)],[circle(0,100,5),circle(4,100,5)],[circle(0,100,8),circle(0,100,3)]];
  for(const holes of bad) for(const fn of [revolveProfile,x=>revolveMassProperties(x,1)]) assert.throws(()=>fn({...base,holes}),/revolve:.*(bore|bores)/);
});
test('FRk4 no-hole behavior remains identical when holes is empty',()=>{
  const input={id:'plain',profile:rect(0,100,30,40),axis:{origin:[0,0],direction:[1,0]},angleDegrees:120};
  assert.deepEqual(revolveProfile({...input,holes:[]}),revolveProfile(input));
  assert.deepEqual(revolveMassProperties({...input,holes:[]},1),revolveMassProperties(input,1));
});
test('FRk4 hollow tags reject collisions and wrong list sizes instead of ambiguous face names',()=>{
  const input={id:'tags',profile:rect(0,100,30,40),holes:[rect(0,100,24,34)],sideTags:['a','b','c','d'],holeTags:[['e','f','g','h']],axis:{origin:[0,0],direction:[1,0]},angleDegrees:90};
  for(const holeTags of [[['a','f','g','h']],[['e','f']],[['e','f','g','?']],[]]) for(const fn of [revolveProfile,x=>revolveMassProperties(x,1)]) assert.throws(()=>fn({...input,holeTags}),/revolve:.*(tags|Tags)/);
});
