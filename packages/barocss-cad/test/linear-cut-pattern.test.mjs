// CG2: oracle fixed before this source in work/cg2-linear-cut-009b/cg2-oracle.json.
// Three disjoint 4 x 4 through cuts remove 480 mm3 from a 60 x 30 x 10 box.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, Location, BarocssError } from '../dist/api/index.js';
import { evaluateCadPart, reevaluate, saveCadPart, loadCadPart, massPropertiesOf, checkBrep, CadPartError } from '../dist/index.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${actual} vs ${expected}`);
const seedDocument = () => ({
  format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { seedX: 8, spacing: 16 },
  features: [
    { id: 'baseSketch', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 30] },
    { id: 'base', kind: 'extrude', sketch: 'baseSketch', height: 10 },
    { id: 'toolSketch', kind: 'sketch', profile: 'rectangle', min: [0, 8], max: [4, 12] },
    { id: 'tool', kind: 'extrude', sketch: 'toolSketch', height: 10 },
    { id: 'seedPosition', kind: 'translate', target: 'tool', offset: [{ parameter: 'seedX' }, 0, 0] },
    { id: 'seed', kind: 'difference', target: 'base', tool: 'seedPosition' },
  ],
});
const pattern = () => ({ id: 'repeat', kind: 'linear-feature-pattern', target: 'seed', axis: 'x', spacing: { parameter: 'spacing' }, count: 3 });
const document = () => { const doc = seedDocument(); doc.features.push(pattern()); return doc; };
const bounds = vertices => ({
  min: [0, 1, 2].map(k => Math.min(...vertices.map(v => v.point[k]))),
  max: [0, 1, 2].map(k => Math.max(...vertices.map(v => v.point[k]))),
});
function shape(snapshot, ranges) {
  assert.equal(snapshot.outputs.length, 1);
  const out = snapshot.outputs[0];
  assert.equal(out.bodyCount, 1);
  const report = checkBrep(out.brep);
  assert.equal(report.valid, true, report.issues.join('\n'));
  close(massPropertiesOf(out).volume, 17520);
  const b = bounds(out.brep.vertices);
  b.min.forEach((v, k) => close(v, [0, 0, 0][k]));
  b.max.forEach((v, k) => close(v, [60, 30, 10][k]));
  // Fixed hole-wall corners detect stale seed/spacing even though the volume does not change.
  for (const range of ranges) for (const x of range) for (const y of [8, 12]) for (const z of [0, 10]) {
    const expected = [x, y, z];
    assert.ok(out.brep.vertices.some(v => v.point.every((c, k) => Math.abs(c - expected[k]) <= 1e-9 * Math.max(1, Math.abs(expected[k])))), `missing cut corner ${expected}`);
  }
  return out;
}
const coreRefused = (doc, code, message) => assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && e.code === code && (!message || message.test(e.message)));
const facadeRefused = (run, code, where = 'facade') => assert.throws(run, e => e instanceof BarocssError && e.code === code && e.where === where);

test('linear feature pattern: public append preserves its direct cut and binds spacing without copying the body', () => {
  const input = seedDocument(), before = structuredClone(input), source = part('three cuts', input), acceptedBefore = source.doc;
  const options = { axis: 'x', spacing: param('spacing'), count: 3 }, optionsBefore = structuredClone(options);
  const accepted = source.linearFeaturePattern(options), doc = accepted.doc, added = doc.features.at(-1);
  assert.deepEqual(added, { id: added.id, kind: 'linear-feature-pattern', target: 'seed', axis: 'x', spacing: { parameter: 'spacing' }, count: 3 });
  assert.deepEqual(doc.features.slice(0, -1), before.features);
  assert.deepEqual(input, before);
  assert.deepEqual(source.doc, acceptedBefore);
  assert.deepEqual(options, optionsBefore);
  shape(evaluateCadPart(doc), [[8, 12], [24, 28], [40, 44]]);
  close(accepted.mass({ density: 1 }).volume, 17520);
  const copy = accepted.doc; copy.features.at(-1).count = 2;
  assert.equal(accepted.doc.features.at(-1).count, 3);
  // An unrelated later sketch is retained; history must not be truncated to the cut.
  const later = seedDocument(); later.features.push({ id: 'laterSketch', kind: 'sketch', profile: 'rectangle', min: [1, 1], max: [2, 2] });
  const continued = part('later sketch', later).linearFeaturePattern({ axis: 'x', spacing: 16, count: 3 });
  assert.deepEqual(continued.doc.features.slice(0, -1), later.features);
});

test('linear feature pattern: seed and spacing Dim edits, save/read and reevaluation preserve fixed cut positions', () => {
  const input = document(), before = structuredClone(input), accepted = evaluateCadPart(input), acceptedBefore = structuredClone(accepted.document);
  shape(accepted, [[8, 12], [24, 28], [40, 44]]);
  const seedEdit = reevaluate(accepted, { parameters: { seedX: 14 } });
  shape(seedEdit, [[14, 18], [30, 34], [46, 50]]);
  const spacingEdit = reevaluate(accepted, { parameters: { spacing: 12 } });
  shape(spacingEdit, [[8, 12], [20, 24], [32, 36]]);
  for (const snapshot of [accepted, seedEdit, spacingEdit]) {
    const reopened = loadCadPart(saveCadPart(snapshot));
    assert.deepEqual(reopened.document, snapshot.document);
    const ranges = snapshot === seedEdit ? [[14, 18], [30, 34], [46, 50]] : snapshot === spacingEdit ? [[8, 12], [20, 24], [32, 36]] : [[8, 12], [24, 28], [40, 44]];
    shape(reopened, ranges);
    shape(reevaluate(reopened, { parameters: {} }), ranges);
  }
  assert.throws(() => reevaluate(accepted, { parameters: { spacing: 0 } }), e => e instanceof CadPartError && e.code === 'PARAMETER');
  assert.deepEqual(input, before);
  assert.deepEqual(accepted.document, acceptedBefore);
  shape(reevaluate(accepted, { parameters: {} }), [[8, 12], [24, 28], [40, 44]]);
  const facade = part('parameter edit', input), facadeBefore = facade.doc;
  shape(evaluateCadPart(facade.withParameters({ seedX: 14 }).doc), [[14, 18], [30, 34], [46, 50]]);
  shape(evaluateCadPart(facade.withParameters({ spacing: 12 }).doc), [[8, 12], [20, 24], [32, 36]]);
  assert.deepEqual(facade.doc, facadeBefore);
});

test('linear feature pattern: stale, non-cut and invalid references refuse without discarding later history', () => {
  const suppressed = document(); suppressed.features.find(f => f.id === 'seed').suppressed = true;
  coreRefused(suppressed, 'REFERENCE', /unsuppressed difference/);
  // Fixed separator spans past both Y sides: two disconnected 28 x 30 x 10 blocks.
  const splitSeed = seedDocument();
  Object.assign(splitSeed.features.find(f => f.id === 'toolSketch'), { min: [28, -1], max: [32, 31] });
  splitSeed.parameters.seedX = 0;
  const splitOutput = evaluateCadPart(splitSeed).outputs;
  assert.equal(splitOutput.length, 1);
  close(massPropertiesOf(splitOutput[0]).volume, 16800);
  assert.equal(splitOutput[0].bodyCount, 2);
  splitSeed.features.push(pattern());
  coreRefused(splitSeed, 'REFERENCE', /one nonempty solid/);
  for (const target of ['base', 'seedPosition', 'toolSketch']) {
    const doc = document(); doc.features.at(-1).target = target;
    coreRefused(doc, 'REFERENCE', /direct difference result/);
  }
  const moved = seedDocument(); moved.features.push({ id: 'moved', kind: 'translate', target: 'seed', offset: [0, 0, 1] }, pattern());
  const movedBefore = structuredClone(moved);
  coreRefused(moved, 'REFERENCE', /must still be active/);
  assert.deepEqual(moved, movedBefore);
  const followed = seedDocument(); followed.features.push({ id: 'followed', kind: 'hole', target: 'seed', center: [54, 20], radius: 1 }, pattern());
  coreRefused(followed, 'REFERENCE', /must still be active/);
  for (const target of ['missing', 'repeat', 'future']) {
    const doc = document(); doc.features.at(-1).target = target;
    if (target === 'future') doc.features.push({ id: 'future', kind: 'translate', target: 'repeat', offset: [0, 0, 1] });
    coreRefused(doc, 'REFERENCE', /no earlier feature/);
  }
  // A cycle through the source difference is rejected where its forward reference first occurs.
  const cycle = document(); cycle.features.find(f => f.id === 'seed').target = 'repeat';
  coreRefused(cycle, 'REFERENCE', /no earlier feature/);
  const accepted = part('accepted cut', seedDocument()), before = accepted.doc;
  const movedPart = accepted.moved(Location.at([0, 0, 1])), movedPartBefore = movedPart.doc;
  facadeRefused(() => movedPart.linearFeaturePattern({ axis: 'x', spacing: 16, count: 3 }), 'REFERENCE', 'evaluate');
  assert.deepEqual(movedPart.doc, movedPartBefore);
  assert.deepEqual(accepted.doc, before);
});

test('linear feature pattern: existing axis, count and spacing admission and count binding stay typed and atomic', () => {
  const accepted = part('accepted cut', seedDocument()), before = accepted.doc;
  for (const edits of [
    { axis: 'q' }, { count: 1 }, { count: 0 }, { count: 2.5 }, { count: NaN }, { count: Infinity },
    { spacing: 0 }, { spacing: -1 }, { spacing: NaN }, { spacing: Infinity }, { spacing: -Infinity },
  ]) facadeRefused(() => accepted.linearFeaturePattern({ axis: 'x', spacing: 16, count: 3, ...edits }), 'VALUE');
  facadeRefused(() => accepted.linearFeaturePattern({ axis: 'x', spacing: 16, count: 65 }), 'INPUT', 'evaluate');
  facadeRefused(() => accepted.linearFeaturePattern({ axis: 'x', spacing: 10001, count: 3 }), 'PARAMETER', 'evaluate');
  const boundCount = accepted.parameter('copies', 3), boundBefore = boundCount.doc;
  facadeRefused(() => boundCount.linearFeaturePattern({ axis: 'x', spacing: 16, count: param('copies') }), 'PARAMETER_UNBINDABLE');
  assert.deepEqual(boundCount.doc, boundBefore);
  for (const [edits, code] of [
    [{ axis: 'q' }, 'INPUT'], ...[0, 65, 2.5, NaN, Infinity].map(count => [{ count }, 'INPUT']),
    ...[0, NaN, Infinity, -Infinity, 10001].map(spacing => [{ spacing }, 'PARAMETER']),
  ]) {
    const doc = document(); Object.assign(doc.features.at(-1), edits);
    const snapshot = structuredClone(doc); coreRefused(doc, code); assert.deepEqual(doc, snapshot);
  }
  // The evaluator's existing count=1 contract includes only the seed; public count still starts at two.
  const one = document(); one.features.at(-1).count = 1;
  close(massPropertiesOf(evaluateCadPart(one).outputs[0]).volume, 17840);
  assert.deepEqual(accepted.doc, before);
  shape(evaluateCadPart(accepted.linearFeaturePattern({ axis: 'x', spacing: 16, count: 3 }).doc), [[8, 12], [24, 28], [40, 44]]);
});
