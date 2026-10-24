import test from 'node:test';
import assert from 'node:assert/strict';
import { deferMasses, evaluateDoc, evaluatePlaced, forgetSnapshots, massOfRef, placedMassFields, type BodyResult } from '../src/engine/evaluate';
import { cylinderPart, emptyDoc, placedBase, placedDoc, rectanglePart, type PartInstance, type StudioDoc } from '../src/engine/doc';
import { placementOf } from '../src/engine/placement';

// O18: with deferMasses on (the studio's worker) a body leaves its mass properties out and carries a `massRef`;
// massOfRef gives the fields the eager evaluation gives, byte for byte — a placed copy's moved and turned with it. A
// body whose B-rep's mass is already known keeps it inline; a member never defers (its cut piece needs its volume).

const MASS = ['volumeMM3', 'massG', 'centroid', 'inertia', 'volumeBasis'] as const;
const fields = (b: Partial<BodyResult>) => JSON.stringify(Object.fromEntries(MASS.filter(k => b[k] !== undefined).map(k => [k, b[k]])));
const inst = (id: string, doc: StudioDoc, position: [number, number, number], rotation: [number, number, number]): PartInstance => ({ id, name: id, doc, position, rotation });
const placed = (i: PartInstance, root: StudioDoc) => { const r = evaluatePlaced(placedDoc(i, root), placedBase(i, root), placementOf(i), 1); assert.ok(r.ok); return r.bodies; };
const part = (doc: StudioDoc) => { const r = evaluateDoc(doc, 1); assert.ok(r.ok); return r.bodies; };
/** Each body's mass fields: deferred and worked out on request, then evaluated eagerly from fresh B-reps. */
function both(run: () => BodyResult[]) {
  forgetSnapshots(); deferMasses(true);
  let deferred: BodyResult[];
  try { deferred = run(); } finally { deferMasses(false); }
  const asked = deferred.map(b => { assert.equal(b.volumeMM3, null); assert.equal(b.massG, null); assert.ok(b.massRef !== undefined, b.key); return fields(massOfRef(b.massRef!, b.massPlace)!); });
  forgetSnapshots();
  return { asked, eager: run().map(fields), deferred };
}

test('O18: a deferred body\'s mass on request equals the eager evaluation\'s, a placed copy\'s placed', () => {
  const plate = rectanglePart(40, 30, 6), rod = cylinderPart(5, 30);
  for (const doc of [plate, rod]) { const { asked, eager } = both(() => part(doc)); assert.deepEqual(asked, eager); }
  const root: StudioDoc = { ...emptyDoc(), instances: [inst('i1', rod, [20, -5, 3], [30, 0, 90])] };
  const { asked, eager, deferred } = both(() => placed(root.instances![0], root));
  assert.deepEqual(asked, eager);
  assert.equal(deferred[0].massPlace?.length, 1, 'the placement kept for the mass');
  assert.notDeepEqual(JSON.parse(asked[0]).centroid, [0, 0, 15], 'moved with its copy');
  // (The studio's way: the worker sends the fields unplaced, the client places them by the body's massPlace.)
  assert.equal(fields(placedMassFields(massOfRef(deferred[0].massRef!)!, deferred[0].massPlace!)), eager[0]);
});

test('O18: a B-rep whose mass is known keeps it inline; deferMasses off changes nothing', () => {
  const rod = cylinderPart(5, 30);
  forgetSnapshots(); const eager = part(rod);
  assert.equal(eager[0].massRef, undefined); assert.ok(eager[0].volumeMM3! > 0);
  deferMasses(true);
  try { const again = part(rod); assert.equal(again[0].massRef, undefined, 'the reused B-rep\'s mass is known'); assert.equal(fields(again[0]), fields(eager[0])); }
  finally { deferMasses(false); }
});
