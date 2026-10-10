import assert from 'node:assert/strict';
import {digest,restoreWorking,verify} from './archive.mjs';
const quat=(axis,angle)=>axis.map(v=>v*Math.sin(angle/2)).concat(Math.cos(angle/2));
const body=(m,id,positionM=[0,0,0],orientation=[0,0,0,1],halfExtentsM=[1,1,1])=>m.parseBody({id,kind:'dynamic',shape:{kind:'box',halfExtentsM},positionM,orientation,velocityMps:[0,0,0],massKg:1,restitution:0});
const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-12,`${a} != ${b}`);
export async function controls(m,reference) {
  const rows=[];let count=0;
  for(const [name,pos,q,extent] of [['aligned',[0,1.8,0],[0,0,0,1],[1,1,1]],['touch',[0,2,0],[0,0,0,1],[1,1,1]],
    ['rotated-face',[0,1.7,0],quat([0,1,0],.2),[1,1,1]],['containment',[0,0,0],[0,0,0,1],[.25,.25,.25]]]) {
    const a=body(m,'a'),b=body(m,'b',pos,q,extent),saved=structuredClone([a,b]);const g=m.featureContact(a,b);assert.ok(g&&g.points.length>0&&g.points.length<=4);
    assert.equal(new Set(g.points.map(p=>p.key)).size,g.points.length);
    if(name==='aligned'){assert.equal(g.points.length,4);for(const point of g.points) close(point.normalGapM,-.2);}
    assert.deepEqual(g.selection.hit,m.detect(a,b));assert.deepEqual(m.featureContact(a,b),g);assert.deepEqual([a,b],saved);
    const ref=await reference.ask({a,b,geometry:g});assert.equal(ref.ok,true,JSON.stringify(ref));rows.push({name,geometry:g,reference:ref});count++;
    const swapped=m.featureContact(b,a);assert.ok(swapped);const swapRef=await reference.ask({a:b,b:a,geometry:swapped});assert.equal(swapRef.ok,true,JSON.stringify(swapRef));rows.push({name:name+'-swapped',geometry:swapped,reference:swapRef});count++;
  }
  const a=body(m,'a'),b=body(m,'b',[0,3,0]);assert.equal(m.featureContact(a,b),null);assert.equal(m.selectBoxSATFeature(a,b),null);count++;
  const rotated=body(m,'a',[0,0,0],quat([0,0,1],.2)),above=body(m,'b',[0,1.8,0]);
  const selection=m.selectBoxSATFeature(rotated,above);assert.ok(selection);assert.equal(selection.feature.kind,'face-b');const bg=m.featureContact(rotated,above);assert.equal(bg.reference.body,'b');const br=await reference.ask({a:rotated,b:above,geometry:bg});assert.equal(br.ok,true,JSON.stringify(br));rows.push({name:'reference-b',geometry:bg,reference:br});count++;
  const p=[-1,0,0],p1=[1,0,0];
  for(const [name,q,q1,s,t,d] of [['skew-interior',[0,-1,1],[0,1,1],.5,.5,1],['endpoint-clamped',[3,-1,1],[3,1,1],1,.5,5],
    ['parallel',[-1,1,0],[1,1,0],0,0,1],['near-parallel',[-1,1,0],[1,1+1e-10,0],0,0,1]]) {
    const n=m.closestSegments(p,p1,q,q1);close(n.parameterA,s);close(n.parameterB,t);close(n.distanceSquared,d);
    const ref=await reference.ask({segments:{p,p1,q,q1,result:n}});assert.equal(ref.ok,true,JSON.stringify(ref));rows.push({name,nearest:n,reference:ref});count++;
  }
  assert.throws(()=>m.closestSegments(p,p,p,p1),e=>e.code==='NUMERIC_LIMIT'&&e.message==='private feature contact requires valid box witnesses');count++;
  const fake=m.selectBoxSATFeature(a,body(m,'b',[0,2,0]));assert.throws(()=>m.faceContact(a,b,fake),e=>e.code==='NUMERIC_LIMIT'&&e.message==='private feature contact requires valid box witnesses');count++;
  const repeated=[[0,0,0],[0,0,0],[0,1,0]];assert.deepEqual(m.clipFace(repeated,[0,0,0],[1,0,0],1),repeated);count++;
  const square=[[-1,-1,0],[1,-1,0],[1,1,0],[-1,1,0]],clipped=m.clipFace(square,[0,0,0],[1,0,0],0);assert.equal(clipped.length,4);assert.ok(clipped.every(p=>p[0]<=0));assert.equal(clipped.filter(p=>p[0]===0).length,2);count++;
  const touchingEdge=body(m,'b',[2,2,0]),dedup=m.featureContact(a,touchingEdge);assert.equal(dedup.points.length,2);assert.ok(dedup.conditioning.clippedVertices>dedup.points.length);for(const point of dedup.points){close(point.witnessAM[0],1);close(point.witnessAM[1],1);close(Math.abs(point.witnessAM[2]),1);close(point.normalGapM,0);}const duplicateRef=await reference.ask({a,b:touchingEdge,geometry:dedup});assert.equal(duplicateRef.ok,true,JSON.stringify(duplicateRef));rows.push({name:'duplicate-contact-elimination',geometry:dedup,reference:duplicateRef});count++;
  const signB=body(m,'b',[0,1.8,0],[0,0,0,-1]);assert.deepEqual(m.featureContact(a,signB),m.featureContact(a,body(m,'b',[0,1.8,0])));count++;
  const same=body(m,'b',[0,1.8,0]);const original=m.featureContact(a,same);const copy=structuredClone(original);original.points[0].witnessAM[0]=999;original.selection.hit.normal[0]=999;assert.deepEqual(m.featureContact(a,same),copy);count++;
  for(const edit of [x=>{x.id='a';},x=>{x.positionM[0]=NaN;},x=>{x.orientation=[0,0,0,0];},x=>{x.shape.halfExtentsM[0]=0;},x=>{x.shape={kind:'sphere',radiusM:1};},x=>{delete x.positionM[1];},x=>{delete x.shape.halfExtentsM[1];},x=>{delete x.orientation[1];}]){
    const invalid=structuredClone(same);edit(invalid);const saved=structuredClone([a,invalid]);assert.throws(()=>m.featureContact(a,invalid),e=>e.code==='INVALID_CONFIG'&&e.message==='private feature geometry requires two admitted boxes');assert.deepEqual([a,invalid],saved);count++;
  }
  const huge=body(m,'b',[0,0,0],[0,0,0,1],[20,20,20]),hugeA=body(m,'a',[0,0,0],[0,0,0,1],[20,20,20]);const saved=structuredClone([hugeA,huge]);assert.throws(()=>m.featureContact(hugeA,huge),e=>e.code==='NUMERIC_LIMIT'&&e.message==='private feature contact requires valid box witnesses');assert.deepEqual([hugeA,huge],saved);count++;
  for(const [name,edit,violation] of [['witness',g=>{g.points[0].witnessAM[1]+=.1;},'referenceFaceMembershipM'],['midpoint',g=>{g.points[0].midpointM[0]+=.1;},'midpointIdentityM'],['gap',g=>{g.points[0].normalGapM+=.1;},'normalGapIdentityM']]){const g=m.featureContact(a,same);edit(g);const ref=await reference.ask({a,b:same,geometry:g});assert.equal(ref.ok,false,'reference must reject changed '+name);assert.ok(ref.violations.some(v=>v.includes(violation)),JSON.stringify(ref));count++;}
  const badSegment=m.closestSegments(p,p1,[0,-1,1],[0,1,1]);badSegment.a=[-1,0,0];badSegment.parameterA=0;const badRef=await reference.ask({segments:{p,p1,q:[0,-1,1],q1:[0,1,1],result:badSegment}});assert.equal(badRef.ok,false);assert.ok(badRef.violations.some(v=>v.includes('StationaryOrEndpointResidualM')));count++;
  const raw=Buffer.alloc(13*8),fields=[...a.positionM,...a.velocityMps,...a.orientation,...a.angularVelocityRadps];fields[0]=-0;fields.forEach((v,i)=>raw.writeDoubleLE(v,i*8));const archived={workingBodies:[structuredClone(a)],workingRawSha256:digest(raw)};const restored=restoreWorking(archived,raw);assert.ok(Object.is(restored[0].positionM[0],-0));assert.ok(!Object.is(archived.workingBodies[0].positionM[0],-0));count++;
  assert.throws(()=>verify(Buffer.from('corrupt'),digest(raw),'control'));assert.throws(()=>restoreWorking(archived,raw.subarray(0,8)));count++;
  const nonfinite=Buffer.from(raw);nonfinite.writeDoubleLE(NaN,0);assert.throws(()=>restoreWorking({...archived,workingRawSha256:digest(nonfinite)},nonfinite));count++;
  return {passed:count,rows,worldStepped:false};
}
