import test from 'node:test';
import assert from 'node:assert/strict';
import { part, sketch, Plane, BarocssError, type StudioPart } from '../src/api';
import { evaluateDoc } from '../src/engine/evaluate';
import { encodeStudioFile, readStudioFile } from '../src/engine/container';

// Fixed K02 oracles precede this source. Density 1 g/cm3 is 1/1000 g/mm3.
// Model consumer only: no authored StudioDoc success fixture or UI/GPU claim.
const EPS = 1e-9, RHO = 1 / 1000;
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) <= EPS, `${actual} != ${expected}`);
const vector = (actual: readonly number[], expected: readonly number[]) => {
  assert.equal(actual.length, expected.length); expected.forEach((x, i) => close(actual[i], x));
};
const flat = (z: number) => ({ origin: [0, 0, z] as [number, number, number], xAxis: [1, 0, 0] as [number, number, number], yAxis: [0, 1, 0] as [number, number, number] });
const circles = (radii: readonly number[], planes: readonly number[]) => radii.map((r, i) => ({
  sketch: sketch(Plane.XY.offset(planes[i])).circle({ r }), frame: flat(planes[i]),
}));
const caller = (sections: ReturnType<typeof circles>) => sections.map(s => ({ sketch: s.sketch.data, frame: structuredClone(s.frame) }));
function fullMass(p: StudioPart, volume: number) {
  const mass = p.mass({ density: 1 }); close(mass.volume, volume); close(mass.mass, volume * RHO);
  assert.equal(mass.centroid.length, 3); mass.centroid.forEach(x => assert.ok(Number.isFinite(x)));
  assert.equal(mass.inertia.length, 3);
  mass.inertia.forEach(row => { assert.equal(row.length, 3); row.forEach(x => assert.ok(Number.isFinite(x))); });
  return mass;
}
async function reopen(p: StudioPart, volume: number) {
  const doc = p.doc, before = structuredClone(doc), result = evaluateDoc(doc, 1);
  assert.ok(result.ok, result.ok ? '' : result.error.detail); assert.equal(result.bodies.length, 1);
  assert.ok(result.bodies[0].volume !== null); close(result.bodies[0].volume, volume);
  const mass = fullMass(p, volume), opened = await readStudioFile(encodeStudioFile(doc));
  assert.ok('doc' in opened, JSON.stringify(opened)); assert.deepEqual(opened.doc, doc);
  const continued = part('reopened multi-section loft', opened.doc);
  assert.deepEqual(fullMass(continued, volume), mass);
  const after = evaluateDoc(opened.doc, 2); assert.ok(after.ok, after.ok ? '' : after.error.detail);
  assert.equal(after.bodies.length, 1); assert.ok(after.bodies[0].volume !== null); close(after.bodies[0].volume, volume);
  assert.deepEqual(doc, before); assert.deepEqual(p.doc, before);
}

test('public multi-conic loft: four framed circles preserve cylinder COM, full inertia and codec values', async () => {
  const base = part('four-section cylinder'), baseBefore = base.doc;
  const input = circles([2, 2, 2, 2], [0, 1, 3, 6]), inputBefore = caller(input), options = { smooth: false };
  const made = base.loft(input, options), doc = made.doc, loft = doc.nodes.find(n => n.kind === 'loft');
  assert.ok(loft && loft.kind === 'loft'); assert.equal(loft.sections.length, 4);
  assert.deepEqual(loft.sections.map(s => s.sketch), [0, 1, 2, 3]);
  for (const [i, section] of loft.sections.entries()) { assert.ok('frame' in section); assert.deepEqual(section.frame, inputBefore[i].frame); }
  assert.equal(Object.hasOwn(loft, 'guide'), false); assert.equal(loft.smooth, false);
  const mass = fullMass(made, 24 * Math.PI); vector(mass.centroid, [0, 0, 3]);
  const expected = [[96 * Math.PI * RHO, 0, 0], [0, 96 * Math.PI * RHO, 0], [0, 0, 48 * Math.PI * RHO]];
  expected.forEach((row, i) => vector(mass.inertia[i], row));
  assert.deepEqual(caller(input), inputBefore); assert.deepEqual(options, { smooth: false }); assert.deepEqual(base.doc, baseBefore);
  input[1].frame.origin[2] = 99; options.smooth = true;
  assert.deepEqual(made.doc, doc); assert.deepEqual(fullMass(made, 24 * Math.PI), mass);
  await reopen(made, 24 * Math.PI);
});

test('public multi-conic loft: eight framed circles reach the inclusive section limit and reopen', async () => {
  const input = circles(Array(8).fill(2), [0, 1, 2, 3, 4, 5, 6, 7]), before = caller(input);
  const made = part('eight-section cylinder').loft(input), loft = made.doc.nodes.find(n => n.kind === 'loft');
  assert.ok(loft && loft.kind === 'loft'); assert.equal(loft.sections.length, 8);
  vector(fullMass(made, 28 * Math.PI).centroid, [0, 0, 3.5]); assert.deepEqual(caller(input), before);
  await reopen(made, 28 * Math.PI);
});

test('public multi-conic loft: changed circle sections use the fixed piecewise-frustum volume without changing accepted input', async () => {
  const base = part('changed sections'), input = circles([2, 2, 2, 2], [0, 1, 3, 6]), before = caller(input);
  const accepted = base.loft(input), acceptedDoc = accepted.doc, massBefore = accepted.mass({ density: 1 });
  const changed = circles([1, 2, 1, 3], [0, 1, 3, 6]), changedBefore = caller(changed), made = base.loft(changed);
  fullMass(made, 20 * Math.PI); await reopen(made, 20 * Math.PI);
  const stored = made.doc.nodes.filter(n => n.kind === 'sketch'); assert.equal(stored.length, 4);
  for (const [i, node] of stored.entries()) { assert.ok(node.kind === 'sketch' && node.profile === 'circle'); assert.equal(node.radius, [1, 2, 1, 3][i]); }
  assert.deepEqual(caller(changed), changedBefore); assert.deepEqual(caller(input), before);
  assert.deepEqual(accepted.doc, acceptedDoc); assert.deepEqual(accepted.mass({ density: 1 }), massBefore); assert.equal(base.doc.nodes.length, 0);
});

test('public multi-conic loft: section limit, smoothing, guide, order and contour refusals preserve accepted state', () => {
  const base = part('multi-conic refusal'), input = circles([2, 2, 2, 2], [0, 1, 3, 6]);
  const accepted = base.loft(input), before = accepted.doc, massBefore = accepted.mass({ density: 1 });
  const refused = (sections: Parameters<StudioPart['loft']>[0], options: Parameters<StudioPart['loft']>[1] = {}, code = 'GEOMETRY') => {
    const callerBefore = sections.map(s => ({ sketch: s.sketch.data, ...('frame' in s ? { frame: structuredClone(s.frame) } : { z: s.z }) }));
    const optionsBefore = structuredClone(options);
    assert.throws(() => base.loft(sections, options), error => error instanceof BarocssError && error.code === code && (code !== 'GEOMETRY' || error.where === 'evaluate'));
    assert.deepEqual(sections.map(s => ({ sketch: s.sketch.data, ...('frame' in s ? { frame: structuredClone(s.frame) } : { z: s.z }) })), callerBefore);
    assert.deepEqual(options, optionsBefore); assert.equal(base.doc.nodes.length, 0);
    assert.deepEqual(accepted.doc, before); assert.deepEqual(accepted.mass({ density: 1 }), massBefore);
  };
  refused(circles(Array(9).fill(2), [0, 1, 2, 3, 4, 5, 6, 7, 8]));
  refused(input, { smooth: true });
  refused(input, { guide: { kind: 'cubic-bezier', controlPoints: [[2, 0, 0], [2, 0, 2], [2, 0, 4], [2, 0, 6]] } });
  refused(circles([2, 2, 2, 2], [0, 1, 1, 6]));
  refused(input.map((s, i) => i === 2 ? { sketch: sketch(Plane.XY.offset(3)).rectangle({ w: 2, d: 2 }), frame: s.frame } : s));
  // (A height section among framed ones is refused by the public input check, before evaluation.)
  refused(input.map((s, i) => i === 2 ? { sketch: s.sketch, z: 3 } : s), {}, 'INPUT');
});
