// Synthetic transport/identity controls, never a physical certificate.
import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyNormalIdentity} from './normal-identity.mjs';
function fixture(){
 const bodies=[{id:'floor',positionM:[0,0,0],velocityMps:[0,0,0],angularVelocityRadps:[0,0,0],inverseMass:0},{id:'box',positionM:[0,1,0],velocityMps:[0,0,0],angularVelocityRadps:[0,0,0],inverseMass:1}],ledger=[{pairKey:'pair',pointId:'one',final:{normalNs:1}},{pairKey:'pair',pointId:'two',final:{normalNs:0}}],points=ledger.map(point=>({id:JSON.stringify([point.pairKey,point.pointId])}));
 return {stationaryNormalWitness:{bodies:structuredClone(bodies),normalImpulsesNs:[1,0],exactApplied:{points:structuredClone(points)}},normalResult:{bodies:structuredClone(bodies),normalImpulsesNs:[1,0]},velocityBodies:bodies.map(body=>({...structuredClone(body),orientation:[0,0,0,1]})),normalProblem:{points},pointLedger:ledger};
}
test('identity01 shared NormalBody words match full snapshots without orientation assumptions',()=>{const d=fixture(),before=structuredClone(d);verifyNormalIdentity(d);assert.deepEqual(d,before);assert.equal(Object.hasOwn(d.stationaryNormalWitness.bodies[0],'orientation'),false);});
test('identity02 exact impulse words reject altered values and zero signs in either applied path',()=>{for(const mutate of [d=>d.normalResult.normalImpulsesNs[0]=2,d=>d.stationaryNormalWitness.normalImpulsesNs[1]=-0,d=>d.pointLedger[1].final.normalNs=-0]){const d=fixture();mutate(d);assert.throws(()=>verifyNormalIdentity(d));}});
test('identity03 body values/IDs/order and all point ID links are mandatory',()=>{for(const mutate of [d=>d.velocityBodies[1].velocityMps[0]=-0,d=>d.normalResult.bodies[1].inverseMass=2,d=>d.stationaryNormalWitness.bodies.reverse(),d=>d.velocityBodies[1].id='other',d=>d.stationaryNormalWitness.exactApplied.points.reverse(),d=>d.normalProblem.points[0].id='wrong',d=>d.pointLedger[0].pointId='wrong']){const d=fixture();mutate(d);assert.throws(()=>verifyNormalIdentity(d));}});
