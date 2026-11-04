// Actual applied-value provenance only. No normal/contact equation or solver.
import assert from 'node:assert/strict';
import {numericWordsHex} from '../physics-stack-stationary-library-2276/witness-wire.mjs';
const words=bodies=>numericWordsHex(bodies.map(body=>({positionM:body.positionM,velocityMps:body.velocityMps,angularVelocityRadps:body.angularVelocityRadps,inverseMass:body.inverseMass})));
const ids=bodies=>bodies.map(body=>body.id);
export function verifyNormalIdentity(d){
 const witness=d.stationaryNormalWitness;assert.ok(witness,'complete actual stationary witness required');
 assert.equal(numericWordsHex(witness.normalImpulsesNs),numericWordsHex(d.normalResult.normalImpulsesNs),'witness/FloatKKT impulse words');
 assert.equal(numericWordsHex(d.pointLedger.map(point=>point.final.normalNs)),numericWordsHex(d.normalResult.normalImpulsesNs),'ledger impulse row words');
 for(const bodies of [d.normalResult.bodies,d.velocityBodies]){assert.deepEqual(ids(witness.bodies),ids(bodies),'normal body ID/order');assert.equal(words(witness.bodies),words(bodies),'actual applied normal body words');}
 assert.deepEqual(witness.exactApplied.points.map(point=>point.id),d.normalProblem.points.map(point=>point.id),'witness point IDs/order');
 assert.deepEqual(d.normalProblem.points.map(point=>point.id),d.pointLedger.map(point=>JSON.stringify([point.pairKey,point.pointId])),'ledger point IDs/order');
}
