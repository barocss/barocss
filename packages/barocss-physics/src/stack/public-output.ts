/** Private public-observation mapping only. No integration, correction or solve. */
import type { PhysicsContact, PhysicsEvent, PhysicsPairStats, Vec3 } from '../internal-types.js';
import { detect } from '../collision.js';
import { error } from '../validation.js';
import type { PreparedStackStep } from './prepare-step.js';

type PairEvent = Omit<PhysicsEvent, 'phase'>;
function requireOutput(value: unknown, message: string): asserts value {
  if (!value) error('NUMERIC_LIMIT', 'stationary public output: ' + message);
}
export function prepareStationaryOutput(prepared: PreparedStackStep, previous: ReadonlyMap<string, PairEvent>): {
  contacts: PhysicsContact[]; events: PhysicsEvent[]; activePairs: Map<string, PairEvent>; pairStats: PhysicsPairStats;
} {
  const { freeBodies, geometryPatches, pointLedger } = prepared.diagnostics;
  requireOutput(freeBodies && freeBodies.length <= 9 && geometryPatches.length <= 8 && pointLedger.length <= 32, 'bounded reached free geometry');
  const points = new Map(pointLedger.map(row => [JSON.stringify([row.pairKey, row.pointId]), row]));
  requireOutput(points.size === pointLedger.length, 'unique actual point IDs');
  const used = new Set<string>(), pairs = new Set<string>(), contacts: PhysicsContact[] = [];
  for (const patch of geometryPatches) {
    const a = freeBodies[patch.aIndex], b = freeBodies[patch.bIndex];
    requireOutput(a && b && a.id === patch.aId && b.id === patch.bId && a.id < b.id &&
      patch.pairKey === a.id + '\0' + b.id && !pairs.has(patch.pairKey) && patch.points.length === 4,
      'frozen pair and four-point identity');
    pairs.add(patch.pairKey);
    // This duplicate free-pose SAT read is an observation, never strict-line construction/solve.
    const hit = detect(a, b);
    requireOutput(hit && Number.isFinite(hit.penetration) && hit.penetration >= 0, 'actual free-pose SAT hit');
    const mean: Vec3 = [0, 0, 0]; let impulse = 0;
    for (const point of patch.points) {
      const key = JSON.stringify([patch.pairKey, point.id]), row = points.get(key);
      requireOutput(row && !used.has(key) && row.aId === a.id && row.bId === b.id &&
        row.aIndex === patch.aIndex && row.bIndex === patch.bIndex &&
        point.pointM.every((value, index) => Number.isFinite(value) && Object.is(value, row.pointM[index])) &&
        patch.normal.every((value, index) => Number.isFinite(value) && Object.is(value, row.normal[index])) &&
        Number.isFinite(row.final.normalNs) && row.final.normalNs >= 0 && row.final.tangentNs.every(value => value === 0), 'actual point-ledger summary');
      used.add(key);
      for (let axis = 0; axis < 3; axis++) mean[axis] += point.pointM[axis];
      impulse += row.final.normalNs;
    }
    for (let axis = 0; axis < 3; axis++) mean[axis] /= 4;
    requireOutput(mean.every(Number.isFinite) && Number.isFinite(impulse), 'finite retained-order mean and RNE sum');
    contacts.push({ aId: a.id, bId: b.id, normalAtoB: [...patch.normal], pointM: mean,
      penetrationM: hit.penetration, impulseNs: impulse, tangentImpulseNs: [0, 0, 0] });
  }
  requireOutput(used.size === pointLedger.length, 'all actual points summarized exactly once');
  contacts.sort((a, b) => a.aId < b.aId ? -1 : a.aId > b.aId ? 1 : a.bId < b.bId ? -1 : a.bId > b.bId ? 1 : 0);
  const activePairs = new Map<string, PairEvent>();
  for (const contact of contacts) activePairs.set(contact.aId + '\0' + contact.bId, { aId: contact.aId, bId: contact.bId, kind: 'contact' });
  const events = [...new Set([...previous.keys(), ...activePairs.keys()])].sort().map((key): PhysicsEvent => {
    const current = activePairs.get(key), prior = previous.get(key);
    return { ...(current ?? prior!), phase: current ? prior ? 'stay' : 'begin' : 'end' };
  });
  let eligiblePairs = 0;
  for (let a = 0; a < freeBodies.length; a++) for (let b = a + 1; b < freeBodies.length; b++)
    if (freeBodies[a].inverseMass !== 0 || freeBodies[b].inverseMass !== 0) eligiblePairs++;
  return { contacts, events, activePairs, pairStats: { eligiblePairs, candidatePairs: eligiblePairs, aabbTests: 0 } };
}
