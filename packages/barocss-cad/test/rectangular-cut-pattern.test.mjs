// Six disjoint 4 x 4 through cuts remove 960 from a 60 x 40 x 10 stock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, Location, BarocssError, rectangularFeaturePatternSpec } from '../dist/api/index.js';
import { evaluateCadPart, reevaluate, saveCadPart, loadCadPart, massPropertiesOf, checkBrep, CadPartError, CadPartLimits } from '../dist/index.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), `${actual} vs ${expected}`);
const options = () => ({ axis: 'x', spacing: 16, count: 3, axis2: 'y', spacing2: 16, count2: 2 });
const seedDocument = () => ({
  format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { seedX: 8, width: 4, spacing: 16, spacing2: 16 },
  features: [
    { id: 'baseSketch', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] },
    { id: 'base', kind: 'extrude', sketch: 'baseSketch', height: 10 },
    { id: 'toolSketch', kind: 'sketch', profile: 'rectangle', min: [0, 8], max: [{ parameter: 'width' }, 12] },
    { id: 'tool', kind: 'extrude', sketch: 'toolSketch', height: 10 },
    { id: 'seedPosition', kind: 'translate', target: 'tool', offset: [{ parameter: 'seedX' }, 0, 0] },
    { id: 'seed', kind: 'difference', target: 'base', tool: 'seedPosition' },
  ],
});
const pattern = () => ({ id: 'repeat', kind: 'rectangular-feature-pattern', target: 'seed', ...options(), spacing: { parameter: 'spacing' }, spacing2: { parameter: 'spacing2' } });
const document = () => { const doc = seedDocument(); doc.features.push(pattern()); return doc; };
const names = out => out.brep.faces.map(face => face.name).filter(Boolean).sort();
const coreRefused = (doc, code, message) => assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && e.code === code && (!message || message.test(e.message)));
const facadeRefused = (run, code, where = 'facade') => assert.throws(run, e => e instanceof BarocssError && e.code === code && e.where === where);
function output(snapshot, volume = 23040, min = [0, 0, 0], max = [60, 40, 10]) {
  assert.equal(snapshot.outputs.length, 1);
  const out = snapshot.outputs[0], report = checkBrep(out.brep);
  assert.equal(out.bodyCount, 1);
  assert.equal(report.valid, true, report.issues.join('\n'));
  close(massPropertiesOf(out).volume, volume);
  for (let k = 0; k < 3; k++) {
    close(Math.min(...out.brep.vertices.map(v => v.point[k])), min[k]);
    close(Math.max(...out.brep.vertices.map(v => v.point[k])), max[k]);
  }
  return out;
}
function grid(snapshot, { seedX = 8, seedY = 8, width = 4, spacing = 16, spacing2 = 16, count = 3, count2 = 2 } = {}) {
  const out = output(snapshot, 24000 - count * count2 * width * 4 * 10), allNames = names(out);
  for (let j = 0; j < count2; j++) for (let i = 0; i < count; i++) {
    for (const x of [seedX + i * spacing, seedX + i * spacing + width]) for (const y of [seedY + j * spacing2, seedY + 4 + j * spacing2]) for (const z of [0, 10]) {
      assert.ok(out.brep.vertices.some(v => v.point.every((c, k) => Math.abs(c - [x, y, z][k]) <= 1e-9)), `missing cut corner ${[x, y, z]}`);
    }
    const suffix = i === 0 && j === 0 ? '' : `@${i},${j}`;
    for (let side = 0; side < 4; side++) assert.ok(allNames.includes(`tool.side${side}${suffix}`), `missing cell face tool.side${side}${suffix}`);
  }
  assert.equal(new Set(allNames).size, allNames.length);
  return out;
}

test('rectangular cut: public append retains one editable feature and stock, with two spacing bindings', () => {
  const input = seedDocument(), before = structuredClone(input), source = part('six cuts', input), sourceBefore = source.doc;
  const supplied = { ...options(), spacing: param('spacing'), spacing2: param('spacing2') }, suppliedBefore = structuredClone(supplied);
  const accepted = source.rectangularFeaturePattern(supplied), added = accepted.doc.features.at(-1);
  assert.deepEqual(added, { ...pattern(), id: added.id });
  assert.deepEqual(accepted.doc.features.slice(0, -1), before.features);
  assert.deepEqual(input, before); assert.deepEqual(source.doc, sourceBefore); assert.deepEqual(supplied, suppliedBefore);
  grid(evaluateCadPart(accepted.doc)); close(accepted.mass({ density: 1 }).volume, 23040);
  assert.equal(rectangularFeaturePatternSpec(options()).command, 'rectangular-feature-pattern');
  const copy = accepted.doc; copy.features.at(-1).count = 1;
  assert.equal(accepted.doc.features.at(-1).count, 3);
  const later = seedDocument(); later.features.push({ id: 'laterSketch', kind: 'sketch', profile: 'rectangle', min: [1, 1], max: [2, 2] });
  const continued = part('later sketch', later).rectangularFeaturePattern(options());
  assert.deepEqual(continued.doc.features.slice(0, -1), later.features);
});

test('rectangular cut: source size and position, both spacings, and count edits recompute; names survive save/read', () => {
  const input = document(), before = structuredClone(input), accepted = evaluateCadPart(input), acceptedBefore = structuredClone(accepted.document);
  const originalNames = names(grid(accepted));
  const edits = [
    [{ seedX: 14 }, { seedX: 14 }], [{ width: 6 }, { width: 6 }],
    [{ spacing: 12 }, { spacing: 12 }], [{ spacing2: 8 }, { spacing2: 8 }],
  ];
  for (const [parameters, expected] of edits) {
    const edited = reevaluate(accepted, { parameters });
    assert.deepEqual(names(grid(edited, expected)), originalNames);
    const reopened = loadCadPart(saveCadPart(edited));
    assert.deepEqual(reopened.document, edited.document);
    assert.deepEqual(names(grid(reevaluate(reopened, { parameters: {} }), expected)), originalNames);
  }
  const fewer = document(); fewer.features.at(-1).count = 2; fewer.features.at(-1).count2 = 1;
  grid(evaluateCadPart(fewer), { count: 2, count2: 1 });
  const source = part('edit grid', input), sourceBefore = source.doc;
  grid(evaluateCadPart(source.withParameters({ spacing: 12, spacing2: 8 }).doc), { spacing: 12, spacing2: 8 });
  facadeRefused(() => source.withParameters({ spacing2: 0 }), 'PARAMETER', 'evaluate');
  assert.deepEqual(source.doc, sourceBefore); assert.deepEqual(input, before); assert.deepEqual(accepted.document, acceptedBefore);
  grid(reevaluate(accepted, { parameters: {} }));
});

test('rectangular cut: one row, one column, one cell, and swapped axes retain exact cuts', () => {
  for (const [count, count2] of [[3, 1], [1, 2], [1, 1]]) {
    const accepted = part('reduced grid', seedDocument()).rectangularFeaturePattern({ ...options(), count, count2 });
    grid(evaluateCadPart(accepted.doc), { count, count2 });
  }
  const swapped = document(); Object.assign(swapped.features.at(-1), { axis: 'y', count: 2, axis2: 'x', count2: 3 });
  output(evaluateCadPart(swapped));
  const signed = document(); signed.parameters.seedX = 40; signed.parameters.spacing = -16;
  grid(evaluateCadPart(signed), { seedX: 40, spacing: -16 });
  const signedSecond = document(); Object.assign(signedSecond.features.find(f => f.id === 'toolSketch'), { min: [0, 24], max: [{ parameter: 'width' }, 28] }); signedSecond.parameters.spacing2 = -16;
  grid(evaluateCadPart(signedSecond), { seedY: 24, spacing2: -16 });
});

test('rectangular cut: X/Z and Z/Y grids use the B-rep transform path with stable cell names', () => {
  for (const [rotation, edits, min, max] of [
    ['x', { axis: 'x', axis2: 'z' }, [0, -10, 0], [60, 0, 40]],
    ['y', { axis: 'z', spacing: -16, axis2: 'y' }, [0, 0, -60], [10, 40, 0]],
  ]) {
    const doc = seedDocument(); doc.features.pop();
    doc.features.push({ id: 'baseTurn', kind: 'rotate', target: 'base', axis: rotation, angle: 90 }, { id: 'toolTurn', kind: 'rotate', target: 'seedPosition', axis: rotation, angle: 90 }, { id: 'seed', kind: 'difference', target: 'baseTurn', tool: 'toolTurn' }, { ...pattern(), ...options(), ...edits });
    const out = output(evaluateCadPart(doc), 23040, min, max), allNames = names(out);
    for (const suffix of ['@1,0', '@2,0', '@0,1', '@1,1', '@2,1']) assert.ok(allNames.some(name => name.includes(suffix)), `missing cell ${suffix}`);
    assert.deepEqual(names(output(loadCadPart(saveCadPart(evaluateCadPart(doc))), 23040, min, max)), allNames);
  }
});

test('rectangular cut: empty or outside tools do not create stock copies; cap boundary admits 64 cells', () => {
  const outside = document(); outside.parameters.seedX = 100;
  output(evaluateCadPart(outside), 24000);
  // An original tool outside the stock can have translated cells that cut the stock.
  const entering = structuredClone(outside); entering.parameters.seedX = 72; entering.parameters.spacing = -16;
  output(evaluateCadPart(entering), 23360);
  const max = structuredClone(outside); Object.assign(max.features.at(-1), { count: 8, count2: 8 });
  assert.equal(CadPartLimits.copies, 64); output(evaluateCadPart(max), 24000);
  const empty = document(); empty.features.splice(5, 0, { id: 'emptyTool', kind: 'difference', target: 'seedPosition', tool: 'seedPosition' });
  empty.features.find(f => f.id === 'seed').tool = 'emptyTool';
  output(evaluateCadPart(empty), 24000);
  const original = seedDocument(); const before = evaluateCadPart(original).outputs[0];
  const one = document(); Object.assign(one.features.at(-1), { count: 1, count2: 1 });
  assert.deepEqual(names(grid(evaluateCadPart(one), { count: 1, count2: 1 })), names(before));
});

test('rectangular cut: stale, suppressed, non-cut, split and cyclic source references refuse atomically', () => {
  for (const target of ['base', 'seedPosition', 'toolSketch', 'missing', 'repeat', 'seed/1']) {
    const doc = document(); doc.features.at(-1).target = target; const before = structuredClone(doc);
    coreRefused(doc, 'REFERENCE'); assert.deepEqual(doc, before);
  }
  const suppressed = document(); suppressed.features.find(f => f.id === 'seed').suppressed = true;
  coreRefused(suppressed, 'REFERENCE', /unsuppressed difference/);
  const stale = seedDocument(); stale.features.push({ id: 'moved', kind: 'translate', target: 'seed', offset: [0, 0, 1] }, pattern());
  coreRefused(stale, 'REFERENCE', /must still be active/);
  const split = seedDocument(); Object.assign(split.features.find(f => f.id === 'toolSketch'), { min: [28, -1], max: [32, 41] }); split.parameters.seedX = 0;
  assert.equal(evaluateCadPart(split).outputs[0].bodyCount, 2); split.features.push(pattern());
  coreRefused(split, 'REFERENCE', /one nonempty solid/);
  const cycle = document(); cycle.features.find(f => f.id === 'seed').target = 'repeat'; coreRefused(cycle, 'REFERENCE', /no earlier feature/);
  const source = part('source', seedDocument()), sourceBefore = source.doc, moved = source.moved(Location.at([0, 0, 1])), before = moved.doc;
  facadeRefused(() => moved.rectangularFeaturePattern(options()), 'REFERENCE', 'evaluate');
  assert.deepEqual(moved.doc, before); assert.deepEqual(source.doc, sourceBefore);
});

test('rectangular cut: bad axes, dimensions, counts and total size refuse with typed errors and leave state intact', () => {
  const source = part('source', seedDocument()), before = source.doc;
  for (const edit of [{ axis: 'q' }, { axis2: 'q' }, { axis2: 'x' }, ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].flatMap(count => [{ count }, { count2: count }]), ...[0, -1, NaN, Infinity, -Infinity].flatMap(spacing => [{ spacing }, { spacing2: spacing }])]) {
    facadeRefused(() => source.rectangularFeaturePattern({ ...options(), ...edit }), 'VALUE');
  }
  for (const edit of [{ count: 9, count2: 8 }, { count: 65 }, { count2: 65 }, { count: Number.MAX_SAFE_INTEGER }]) facadeRefused(() => source.rectangularFeaturePattern({ ...options(), ...edit }), 'INPUT', 'evaluate');
  for (const key of ['spacing', 'spacing2']) facadeRefused(() => source.rectangularFeaturePattern({ ...options(), [key]: 10001 }), 'PARAMETER', 'evaluate');
  const bound = source.parameter('copies', 3), boundBefore = bound.doc;
  for (const key of ['count', 'count2']) facadeRefused(() => bound.rectangularFeaturePattern({ ...options(), [key]: param('copies') }), 'PARAMETER_UNBINDABLE');
  assert.deepEqual(bound.doc, boundBefore);
  for (const [edit, code] of [
    [{ axis2: 'x' }, 'INPUT'], [{ axis: 'q' }, 'INPUT'], [{ axis2: 'q' }, 'INPUT'], [{ count: 9, count2: 8 }, 'INPUT'],
    ...[0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].flatMap(count => [[{ count }, 'INPUT'], [{ count2: count }, 'INPUT']]),
    ...[0, NaN, Infinity, -Infinity, 10001].flatMap(spacing => [[{ spacing }, 'PARAMETER'], [{ spacing2: spacing }, 'PARAMETER']]),
  ]) {
    const doc = document(); Object.assign(doc.features.at(-1), edit); const snapshot = structuredClone(doc);
    coreRefused(doc, code); assert.deepEqual(doc, snapshot);
  }
  assert.deepEqual(source.doc, before); grid(evaluateCadPart(source.rectangularFeaturePattern(options()).doc));
});
