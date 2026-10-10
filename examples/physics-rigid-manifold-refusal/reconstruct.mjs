import assert from 'node:assert/strict';
/** Reconstruct the unaccepted command-free pose; never step or solve a world. */
export function reconstruct(module,config,last) {
  const saved=structuredClone(last);
  const bodies=config.bodies.map(input=>module.parseBody(input));
  for(const body of bodies) {
    const state=last.bodies.find(row=>row.id===body.id); assert.ok(state);
    for(const field of ['positionM','velocityMps','orientation','angularVelocityRadps']) body[field]=[...state[field]];
  }
  const dt=config.fixedStepSeconds;
  for(const body of bodies) if(body.kind==='dynamic') {
    body.angularVelocityRadps=module.add(body.angularVelocityRadps,module.inverseInertia(body,module.add([0,0,0],module.scale([0,0,0],dt))));
  }
  for(const body of bodies) if(body.kind==='dynamic') {
    body.orientation=module.advanceOrientation(body.orientation,body.angularVelocityRadps,dt);
    for(let i=0;i<3;i++) {
      body.velocityMps[i]+=0*body.inverseMass;
      body.velocityMps[i]+=(config.gravityMps2[i]+0*body.inverseMass)*dt;
    }
    for(let i=0;i<3;i++) body.positionM[i]+=body.velocityMps[i]*dt;
  }
  assert.deepEqual(last,saved,'archive input mutated');
  return bodies;
}
export function sortedPairs(bodies) {
  const pairs=[];
  for(let a=0;a<bodies.length;a++) for(let b=a+1;b<bodies.length;b++)
    if(bodies[a].inverseMass!==0||bodies[b].inverseMass!==0) pairs.push(bodies[a].id<bodies[b].id?[a,b]:[b,a]);
  pairs.sort((l,r)=>bodies[l[0]].id<bodies[r[0]].id?-1:bodies[l[0]].id>bodies[r[0]].id?1:bodies[l[1]].id<bodies[r[1]].id?-1:1);
  return pairs;
}
export function rawBodies(bodies) {
  const bytes=Buffer.alloc(bodies.length*13*8);let offset=0;
  for(const b of bodies) for(const v of [...b.positionM,...b.velocityMps,...b.orientation,...b.angularVelocityRadps]) {assert.ok(Number.isFinite(v));bytes.writeDoubleLE(v,offset);offset+=8;}
  return bytes;
}
