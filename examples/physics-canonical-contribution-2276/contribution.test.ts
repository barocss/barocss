import assert from 'node:assert/strict';
import test from 'node:test';
import type { Body, Hit, Vec3 } from '../../packages/barocss-physics/src/internal-types.js';
import { solve } from '../../packages/barocss-physics/src/collision.js';
import { warmStartPoint, solvePersistentPoint } from '../../packages/barocss-physics/src/persistent-box-contact.js';
import { ContactPairAccumulator, contactApplication, combineContactContributions } from '../../packages/barocss-physics/src/contact-contribution.js';
import type { ContactContribution } from '../../packages/barocss-physics/src/contact-contribution.js';

// Independent rigid-body momentum equation oracle, not a contact/cache oracle.
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const measured={gate:1e-12,linearImpulseDeltaMaxNs:0,worldOriginMomentDeltaMaxNms:0,linearComponents:0,momentComponents:0};
const near = (a: Vec3, b: Vec3) => a.forEach((value, i) => assert.ok(Math.abs(value-b[i]) <= 1e-12, `${value} != ${b[i]}`));
function body(id: string, fixed = false): Body {
  return { id, kind: fixed ? 'static' : 'dynamic', shape: { kind: 'box', halfExtentsM: [.5,.5,.5] },
    positionM: [0,0,0], velocityMps: [0,0,0], orientation: [0,0,0,1], angularVelocityRadps: [0,0,0],
    inverseMass: fixed ? 0 : 1, inverseInertiaLocal: fixed ? [0,0,0] : [6,6,6],
    sensor: false, restitution: 0, frictionStatic: .5, frictionDynamic: .3 };
}
function totals(contribution: ContactContribution) {
  const accumulator = new ContactPairAccumulator(); accumulator.add('a','b', contribution);
  return accumulator.finish()[0];
}
function equationDelta(before: Body, after: Body, contribution: ContactContribution, owner: 'onA' | 'onB') {
  const total = totals(contribution)[owner];
  // The fixtures have unit mass and isotropic inertia 1/6, fixed pose.
  const linear=after.velocityMps.map((v,i) => v-before.velocityMps[i]) as Vec3;
  total.linearImpulseNs.forEach((value,i)=>{measured.linearImpulseDeltaMaxNs=Math.max(measured.linearImpulseDeltaMaxNs,Math.abs(value-linear[i]));measured.linearComponents++;});
  near(total.linearImpulseNs, linear);
  const spin = after.angularVelocityRadps.map((v,i) => (v-before.angularVelocityRadps[i])/6) as Vec3;
  const orbital: Vec3 = [0,0,0];
  // Each phase may have a different COM because position correction is not impulse.
  for (const application of contribution.applications) {
    const term = cross(application[owner].comM, application[owner].linearImpulseNs);
    for(let i=0;i<3;i++) orbital[i] += term[i];
  }
  const expectedMoment=spin.map((v,i)=>v+orbital[i]) as Vec3;
  total.angularImpulseAboutWorldOriginNms.forEach((value,i)=>{measured.worldOriginMomentDeltaMaxNms=Math.max(measured.worldOriginMomentDeltaMaxNms,Math.abs(value-expectedMoment[i]));measured.momentComponents++;});
  near(total.angularImpulseAboutWorldOriginNms, expectedMoment);
}

test('discrete normal captures pre-correction COM, axis/scalar and static reaction', () => {
  const a=body('a',true), b=body('b'); b.positionM=[0,1,0]; b.velocityMps=[0,-1,0];
  const before=structuredClone(b), hit: Hit={normal:[0,1,0],pointM:[.25,.5,0],penetration:.125};
  const result=solve(a,b,hit), application=result.contribution.applications[0];
  assert.deepEqual(application.onB.comM,[0,1,0]);
  assert.deepEqual(application.onB.armM,[.25,-.5,0]);
  assert.deepEqual(application.normalOperands?.torqueAxisB,[-0,0,.25]);
  assert.deepEqual(b.positionM,[0,1.125,0]);
  equationDelta(before,b,result.contribution,'onB');
  const sum=totals(result.contribution); near(sum.onA.linearImpulseNs,sum.onB.linearImpulseNs.map(v=>-v) as Vec3);
  assert.ok(sum.onA.linearImpulseNs.some(v=>v!==0));
});

test('synthetic resolver input: sphere friction uses post-correction COM and actual radial arm', () => {
  const a=body('a',true), b=body('b'); b.shape={kind:'sphere',radiusM:.5};
  b.positionM=[0,.5,0]; b.velocityMps=[1,-1,0];
  const before=structuredClone(b);
  const result=solve(a,b,{normal:[0,1,0],pointM:[0,0,0],penetration:.125});
  assert.equal(result.contribution.applications.length,2);
  const [normal,tangent]=result.contribution.applications;
  assert.deepEqual(normal.onB.comM,[0,.5,0]);
  assert.deepEqual(tangent.onB.comM,[0,.625,0]);
  assert.deepEqual(tangent.onB.armM,[-0,-.5,-0]);
  assert.notDeepEqual(tangent.onB.armM,[0,-.625,0]);
  assert.ok(tangent.onB.linearImpulseNs[0]<0);
  equationDelta(before,b,result.contribution,'onB');
  // This constructed Hit is an application-equation probe, not accepted-native
  // geometry or evidence of a World-law failure. Do not force M_A=-M_B.
  const sum=totals(result.contribution);
  assert.ok(Math.abs(sum.onA.angularImpulseAboutWorldOriginNms[2]
    +sum.onB.angularImpulseAboutWorldOriginNms[2])>1e-12);
});

test('two moving bodies retain both independently measured momentum and spin deltas', () => {
  const a=body('a'), b=body('b'); a.positionM=[-1,0,0]; b.positionM=[1,0,0];
  a.velocityMps=[1,.25,0]; b.velocityMps=[-1,-.5,0];
  const beforeA=structuredClone(a), beforeB=structuredClone(b);
  const result=solve(a,b,{normal:[1,0,0],pointM:[0,.25,0],penetration:0});
  equationDelta(beforeA,a,result.contribution,'onA');
  equationDelta(beforeB,b,result.contribution,'onB');
  const sum=totals(result.contribution);
  near(sum.onA.linearImpulseNs,sum.onB.linearImpulseNs.map(v=>-v) as Vec3);
  near(sum.onA.angularImpulseAboutWorldOriginNms,sum.onB.angularImpulseAboutWorldOriginNms.map(v=>-v) as Vec3);
});

test('persistent warm, negative normal increment and cached tangent removal use actual deltas', () => {
  const a=body('a',true), b=body('b'); b.positionM=[0,1,0];
  const cache={normalNs:1,tangentNs:[.25,0,0] as Vec3}, point: Vec3=[0,.5,0];
  const before=structuredClone(b), warm=warmStartPoint(a,b,point,[0,1,0],cache);
  equationDelta(before,b,warm,'onB');
  // A separating body unloads the complete old normal/friction cache.
  b.velocityMps=[0,2,0]; b.angularVelocityRadps=[0,0,0];
  const beforeRemoval=structuredClone(b), removal=solvePersistentPoint(a,b,point,[0,1,0],cache,0);
  assert.equal(cache.normalNs,0); assert.deepEqual(cache.tangentNs,[0,0,0]);
  assert.equal(removal.applications.length,2);
  assert.equal(removal.applications[0].onB.linearImpulseNs[1],-1);
  assert.equal(removal.applications[1].onB.linearImpulseNs[0],-.25);
  equationDelta(beforeRemoval,b,removal,'onB');
});

test('zero applications remain truthful; cancellation preserves history and copies isolate callers', () => {
  const com: Vec3=[2,3,4], arm: Vec3=[1,0,0], j: Vec3=[0,2,0];
  const first=contactApplication(com,com,arm,arm,j);
  com[0]=99; arm[0]=99; j[1]=99;
  assert.deepEqual(first.applications[0].onB.comM,[2,3,4]);
  const second=contactApplication([2,3,4],[2,3,4],[1,0,0],[1,0,0],[0,-2,0]);
  const accumulator=new ContactPairAccumulator();
  accumulator.add('a','b',combineContactContributions(first,second));
  const sum=accumulator.finish()[0]; assert.equal(sum.anyNonzero,true);
  near(sum.onB.linearImpulseNs,[0,0,0]); near(sum.onB.angularImpulseAboutWorldOriginNms,[0,0,0]);
  sum.onB.linearImpulseNs[0]=99; first.applications[0].onB.linearImpulseNs[0]=99;
  near(accumulator.finish()[0].onB.linearImpulseNs,[0,0,0]);
  const zero=contactApplication([0,0,0],[0,0,0],[0,0,0],[0,0,0],[0,0,0]);
  assert.equal(zero.applications.length,1); assert.equal(totals(zero).anyNonzero,false);
});

test('whole candidate ledger rejects finite application sums that overflow', context => {
  const accumulator=new ContactPairAccumulator();
  const contribution=contactApplication([0,0,0],[0,0,0],[0,0,0],[0,0,0],[Number.MAX_VALUE,0,0]);
  accumulator.add('a','b',contribution); accumulator.add('a','b',contribution);
  assert.throws(()=>accumulator.finish(),error=>!!error && (error as {code:string}).code==='NUMERIC_LIMIT');
  context.diagnostic('EQUATION_DELTA_METRICS '+JSON.stringify(measured));
});
