// An asymmetric CUT tool follows an L path without rotating; positions and mass have separate oracles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { part, param, BarocssError, curveFeaturePatternSpec } from '../dist/api/index.js';
import { evaluateCadPart, reevaluate, saveCadPart, loadCadPart, massPropertiesOf, checkBrep, CadPartError } from '../dist/index.js';
import { curveCutOffsets } from '../dist/features/curve-cut-pattern.js';

test('an admitted accumulated endpoint uses the authored point without extrapolation', () => {
  const raw = { degree: 1, knots: [0, 0, 1, 2, 2], controlPoints: [[0, 0, 0], [1, 0, 0], [1, 0.1, 0]], weights: [1, 1, 1] };
  const fail = (code, message) => { throw new Error(`${code}: ${message}`); };
  assert.deepEqual(curveCutOffsets(raw, 1.1, 2, 10000, fail), [[0, 0, 0], [1, 0.1, 0]]);
  assert.throws(() => curveCutOffsets(raw, 1.1000000000000003, 2, 10000, fail), /exceeds/);
});

const close = (a, b) => assert.ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), `${a} vs ${b}`);
const path = () => ({ degree: 1, knots: [0, 0, 1, 2, 2], controlPoints: [[0, 0, 0], [16, 0, 0], [16, 16, 0]], weights: [1, 1, 1] });
const quadratic = () => ({ degree: 2, knots: [0, 0, 0, 1, 1, 2, 2, 2], controlPoints: [[0, 0, 0], [8, 0, 0], [16, 0, 0], [16, 8, 0], [16, 16, 0]], weights: [1, 1, 1, 1, 1] });
const offsets = [[0, 0], [8, 0], [16, 0], [16, 8], [16, 16]];
function seedDocument() {
  return {
    format: 'barocss-cad-part', version: 1, units: 'mm', parameters: { seedX: 8, width: 4, spacing: 8, count: 5 },
    features: [
      { id: 'baseSketch', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [60, 40] },
      { id: 'base', kind: 'extrude', sketch: 'baseSketch', height: 10 },
      { id: 'toolSketch', kind: 'sketch', profile: 'rectangle', min: [0, 8], max: [{ parameter: 'width' }, 10] },
      { id: 'tool', kind: 'extrude', sketch: 'toolSketch', height: 10 },
      { id: 'seedPosition', kind: 'translate', target: 'tool', offset: [{ parameter: 'seedX' }, 0, 0] },
      { id: 'seed', kind: 'difference', target: 'base', tool: 'seedPosition' },
    ],
  };
}
const pattern = (given = {}) => ({ id: 'repeat', kind: 'curve-feature-pattern', target: 'seed', path: path(), spacing: { parameter: 'spacing' }, count: 5, ...given });
const document = (given) => { const d = seedDocument(); d.features.push(pattern(given)); return d; };
const names = out => out.brep.faces.map(f => f.name).filter(Boolean).sort();
const refused = (doc, code, message) => assert.throws(() => evaluateCadPart(doc), e => e instanceof CadPartError && e.code === code && (!message || message.test(e.message)));
const facadeRefused = (run, code) => assert.throws(run, e => e instanceof BarocssError && e.code === code);
function geometry(snapshot, { expectedOffsets = offsets, seedX = 8, width = 4, stockVolume = 24000 } = {}) {
  assert.equal(snapshot.outputs.length, 1);
  const out = snapshot.outputs[0], report = checkBrep(out.brep);
  assert.equal(out.bodyCount, 1);
  assert.equal(out.brep.bodies[0].kind, 'solid');
  assert.equal(report.valid, true, report.issues.join('\n'));
  close(massPropertiesOf(out).volume, stockVolume - expectedOffsets.length * width * 2 * 10);
  const allNames = names(out);
  for (const [k, [dx, dy]] of expectedOffsets.entries()) {
    for (const x of [seedX + dx, seedX + dx + width]) for (const y of [8 + dy, 10 + dy]) for (const z of [0, 10]) {
      assert.ok(out.brep.vertices.some(v => v.point.every((c, axis) => Math.abs(c - [x, y, z][axis]) <= 1e-9)), `missing fixed-orientation corner ${[x, y, z]}`);
    }
    for (let side = 0; side < 4; side++) assert.ok(allNames.includes(`tool.side${side}${k ? `@${k}` : ''}`), `missing cut ${k} side ${side}`);
  }
  assert.equal(new Set(allNames).size, allNames.length);
  return out;
}

test('path cut: public API stores one feature and preserves inputs, history and fixed orientation', () => {
  const input = seedDocument(), before = structuredClone(input), source = part('L cuts', input), sourceBefore = source.doc;
  const supplied = { path: path(), spacing: param('spacing'), count: 5 }, suppliedBefore = structuredClone(supplied);
  const result = source.curveFeaturePattern(supplied), node = result.doc.features.at(-1);
  assert.deepEqual(node, { ...pattern(), id: node.id });
  assert.deepEqual(result.doc.features.slice(0, -1), before.features);
  assert.deepEqual(input, before); assert.deepEqual(source.doc, sourceBefore); assert.deepEqual(supplied, suppliedBefore);
  geometry(evaluateCadPart(result.doc)); close(result.mass({ density: 1 }).volume, 23600);
  const copy = result.doc; copy.features.at(-1).path.controlPoints[1][0] = 100;
  assert.equal(result.doc.features.at(-1).path.controlPoints[1][0], 16);
  assert.equal(curveFeaturePatternSpec({ path: path(), spacing: 8, count: 5 }).command, 'curve-feature-pattern');
});

test('path cut: native quadratic line spans and translated/nonuniform parameterizations retain placement and names', () => {
  const original = names(geometry(evaluateCadPart(document())));
  const translated = path(); translated.controlPoints = translated.controlPoints.map(p => p.map((v, k) => v + [100, -200, 300][k])); translated.knots = [-10, -10, -9, 20, 20];
  for (const raw of [quadratic(), translated]) {
    const doc = document({ path: raw }), before = structuredClone(doc);
    assert.deepEqual(names(geometry(evaluateCadPart(doc))), original);
    assert.deepEqual(doc, before);
    const reopened = loadCadPart(saveCadPart(evaluateCadPart(doc)));
    assert.deepEqual(reopened.document, doc);
    assert.deepEqual(names(geometry(reopened)), original);
  }
});

test('path cut: source, spacing, count and path edits recompute without stale cache or renamed cuts', () => {
  const input = document(), before = structuredClone(input), accepted = evaluateCadPart(input), acceptedBefore = structuredClone(accepted.document);
  const original = names(geometry(accepted));
  assert.deepEqual(names(geometry(reevaluate(accepted, { parameters: { seedX: 10 } }), { seedX: 10 })), original);
  assert.deepEqual(names(geometry(reevaluate(accepted, { parameters: { width: 3 } }), { width: 3 })), original);
  const shorter = [[0, 0], [6, 0], [12, 0], [16, 2], [16, 8]];
  assert.deepEqual(names(geometry(reevaluate(accepted, { parameters: { spacing: 6 } }), { expectedOffsets: shorter })), original);
  const changed = document(); changed.features.at(-1).path.controlPoints[1][0] = 24; changed.features.at(-1).path.controlPoints[2][0] = 24;
  assert.deepEqual(names(geometry(evaluateCadPart(changed), { expectedOffsets: [[0, 0], [8, 0], [16, 0], [24, 0], [24, 8]] })), original);
  geometry(evaluateCadPart(document({ count: 3 })), { expectedOffsets: offsets.slice(0, 3) });
  assert.deepEqual(input, before); assert.deepEqual(accepted.document, acceptedBefore);
  geometry(reevaluate(accepted, { parameters: {} }));
  const source = part('edits', input), sourceBefore = source.doc;
  facadeRefused(() => source.withParameters({ spacing: 9 }), 'PARAMETER');
  assert.deepEqual(source.doc, sourceBefore);
  geometry(evaluateCadPart(source.withParameters({ spacing: 6 }).doc), { expectedOffsets: shorter });
  facadeRefused(() => part('count binding', seedDocument()).curveFeaturePattern({ path: path(), spacing: 8, count: param('count') }), 'PARAMETER_UNBINDABLE');
});

test('path cut: count one is an identity that still validates the path; copy and native curve caps remain bounded', () => {
  const one = document({ count: 1 }); geometry(evaluateCadPart(one), { expectedOffsets: [[0, 0]] });
  const many = path(); many.knots = [0, ...Array.from({ length: 64 }, (_, k) => k), 63]; many.controlPoints = Array.from({ length: 64 }, (_, k) => [k * 8, 0, 0]); many.weights = Array(64).fill(1);
  geometry(evaluateCadPart(document({ path: many, count: 2 })), { expectedOffsets: [[0, 0], [8, 0]] });
  const cap = document({ path: { degree: 1, knots: [0, 0, 1, 1], controlPoints: [[0, 0, 0], [504, 0, 0]], weights: [1, 1] }, count: 64 });
  cap.features[0].max = [520, 40];
  geometry(evaluateCadPart(cap), { expectedOffsets: Array.from({ length: 64 }, (_, k) => [8 * k, 0]), stockVolume: 208000 });
  refused(document({ count: 65 }), 'INPUT');
  const over = structuredClone(many); over.controlPoints.push([512, 0, 0]); over.weights.push(1); over.knots = [0, ...Array.from({ length: 65 }, (_, k) => k), 64];
  refused(document({ path: over, count: 1 }), 'INPUT', /2\.\.64/);
});

test('path cut: exact unsupported curves are refused without projection, endpoint extension or partial mutation', () => {
  const variants = [
    [{ ...path(), controlPoints: [[0, 0, 0], [16, 0, 0], [0, 0, 0]] }, 'CAPABILITY'],
    [{ ...path(), controlPoints: [[0, 0, 0], [0, 0, 0], [16, 16, 0]] }, 'INPUT'],
    [{ ...path(), weights: [1, 2, 1] }, 'CAPABILITY'],
    [{ ...quadratic(), controlPoints: [[0, 0, 0], [8, 1e-12, 0], [16, 0, 0], [16, 8, 0], [16, 16, 0]] }, 'CAPABILITY'],
    [{ degree: 2, knots: [0, 0, 0, 1, 1, 1], controlPoints: [[1, 0, 0], [1, 0, 0], [1 + Number.EPSILON, 0, 0]], weights: [1, 1, 1] }, 'CAPABILITY'],
    [{ degree: 2, knots: [0, 0, 0, 1, 2, 2, 2], controlPoints: [[0, 0, 0], [8, 0, 0], [16, 0, 0], [24, 0, 0]], weights: [1, 1, 1, 1] }, 'CAPABILITY'],
    [{ degree: 3, knots: [0, 0, 0, 0, 1, 1, 1, 1], controlPoints: [[0, 0, 0], [8, 0, 0], [16, 0, 0], [24, 0, 0]], weights: [1, 1, 1, 1] }, 'CAPABILITY'],
    [{ ...path(), extra: 0 }, 'INPUT'], [{ ...path(), controlPoints: [[0, 0, 0], [10001, 0, 0], [16, 16, 0]] }, 'PARAMETER'],
    [{ ...path(), knots: [0, 0, 1, 1, 2] }, 'INPUT'], [{ objectId: 'obj_1' }, 'CAPABILITY'], [null, 'INPUT'],
  ];
  for (const [raw, code] of variants) {
    const doc = document({ path: raw, count: 1 }), before = structuredClone(doc);
    refused(doc, code); assert.deepEqual(doc, before);
  }
  for (const count of [0, 1.5, 65]) refused(document({ count }), 'INPUT');
  for (const spacing of [0, -1, 10001]) refused(document({ spacing }), 'PARAMETER');
  const over = document({ count: 6 }), before = structuredClone(over); refused(over, 'PARAMETER', /exceeds/); assert.deepEqual(over, before);
  refused(document({ spacing: 8 + Number.EPSILON * 8 }), 'PARAMETER', /exceeds/);
  geometry(evaluateCadPart(document()));
});

test('path cut: raw admission, facade refusals and active difference ownership stay explicit', () => {
  const nonDifference = document({ target: 'base' }); refused(nonDifference, 'REFERENCE', /difference/);
  const suppressed = document(); suppressed.features.find(f => f.id === 'seed').suppressed = true; refused(suppressed, 'REFERENCE');
  const consumed = document(); consumed.features.splice(-1, 0, { id: 'moved', kind: 'translate', target: 'seed', offset: [1, 0, 0] }); refused(consumed, 'REFERENCE', /active/);
  const unknown = document({ target: 'missing' }); refused(unknown, 'REFERENCE');
  const source = part('refusals', seedDocument()), before = source.doc;
  facadeRefused(() => source.curveFeaturePattern({ path: { objectId: 'obj_1' }, spacing: 8, count: 5 }), 'CAPABILITY');
  for (const count of [0, 65, 1.5]) facadeRefused(() => source.curveFeaturePattern({ path: path(), spacing: 8, count }), 'VALUE');
  for (const spacing of [0, -1, 10001]) facadeRefused(() => source.curveFeaturePattern({ path: path(), spacing, count: 5 }), 'VALUE');
  assert.deepEqual(source.doc, before);
  const raw = document(); raw.features.at(-1).path.controlPoints[0][0] = NaN; refused(raw, 'INPUT');
  const sparse = document(); delete sparse.features.at(-1).path.weights[1]; refused(sparse, 'INPUT');
  assert.throws(() => loadCadPart(JSON.stringify(document({ path: { objectId: 'obj_1' } }))), e => e instanceof CadPartError && e.code === 'CAPABILITY');
  geometry(evaluateCadPart(source.curveFeaturePattern({ path: path(), spacing: 8, count: 5 }).doc));
});
