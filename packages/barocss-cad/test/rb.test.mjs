import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as cad from '../dist/index.js';
import { classifyError, crescentContacts, openEdges, runCase } from '../scripts/rb/stages.mjs';

test('robustness taxonomy: kernel error types are refusals, built-in ones crashes', () => {
  assert.equal(classifyError(new cad.BrepError('TOPOLOGY', 'x')), 'REFUSED');
  assert.equal(classifyError(new cad.CadPartError('INPUT', null, 'x')), 'REFUSED');
  assert.equal(classifyError(new TypeError('x')), 'CRASH');
  assert.equal(classifyError(new RangeError('x')), 'CRASH');
  assert.equal(classifyError('a string'), 'CRASH');
});

test('robustness: open edges counted by position; a case runs through its stages', () => {
  // Two triangles sharing one edge: four edges used once.
  assert.equal(openEdges([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0], [0, 1, 2, 1, 3, 2]), 4);
  const dir = mkdtempSync(join(tmpdir(), 'rb-test-')), file = join(dir, 'box.json'), started = [];
  writeFileSync(file, JSON.stringify({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'e', kind: 'extrude', sketch: 's', height: 5 }] }));
  const rows = runCase(cad, file, s => started.push(s));
  assert.deepEqual(rows.map(r => `${r.stage}:${r.status}`), ['evaluate:OK', 'validate:OK', 'mass:OK', 'tessellate:OK', 'roundtrip:OK']);
  assert.deepEqual(started, ['evaluate', 'validate', 'mass', 'tessellate', 'roundtrip']);
  // A conformance case that expects outputs but is refused is WRONG, not an acceptable refusal.
  writeFileSync(file, JSON.stringify({ input: { partDocument: { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'e', kind: 'extrude', sketch: 'nope', height: 5 }] } }, expect: { outputs: [] } }));
  assert.equal(runCase(cad, file, () => {})[0].status, 'WRONG');
});

test('robustness: a prismatic crescent\'s touch along its tangent line is KNOWN, not INVALID (D195)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rb-test-')), file = join(dir, 'crescent.json');
  const doc = (outer, h, hole, z, hh) => ({ format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [outer, { id: 'a', kind: 'extrude', sketch: 'as', height: h },
    { ...hole, id: 'bs', plane: { origin: [0, 0, z], normal: [0, 0, 1], xAxis: [1, 0, 0] } }, { id: 'b', kind: 'extrude', sketch: 'bs', height: hh }, { id: 'd', kind: 'difference', target: 'a', tool: 'b' }] });
  // A disc tangent inside a disc (prismatic-solid.test's pinned crescent: two vertices at the tangent point); a box less
  // a cylinder tangent inside two of its sides (L4 fuzz 56: one vertex, two edges up each tangent line).
  const cases = [
    ['crescent', doc({ id: 'as', kind: 'sketch', profile: 'circle', center: [0, 0], radius: 5 }, 4, { kind: 'sketch', profile: 'circle', center: [2, 0], radius: 3 }, -1, 6), ['validate:KNOWN', 'tessellate:KNOWN']],
    ['box less a tangent cylinder', doc({ id: 'as', kind: 'sketch', profile: 'rectangle', min: [-8, -3], max: [0, 0] }, 8, { kind: 'sketch', profile: 'circle', center: [-2, -2], radius: 2 }, 3, 4), ['tessellate:KNOWN']],
  ];
  for (const [name, d, known] of cases) {
    writeFileSync(file, JSON.stringify(d));
    const rows = runCase(cad, file, () => {}).map(r => `${r.stage}:${r.status}`);
    for (const k of known) assert.ok(rows.includes(k), `${name}: ${rows}`);
    assert.ok(rows.every(r => /:(OK|KNOWN)$/.test(r)), `${name}: ${rows}`);
  }
  // Only a prismatic solid's: the same body from any other source is not one.
  const brep = cad.outputOf(cad.evaluateCadPart(cases[0][1]), 'd').brep;
  assert.ok(crescentContacts(brep));
  assert.equal(crescentContacts({ ...brep, source: { ...brep.source, family: 'analytic-boolean' } }), null);
});


test('robustness expectations use the current volume and centroid fields and reject wrong values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rb-expect-')), file = join(dir, 'box.json');
  const document = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'e', kind: 'extrude', sketch: 's', height: 5 }] };
  const check = (volume, centroid) => {
    writeFileSync(file, JSON.stringify({ input: { partDocument: document }, expect: { outputs: [{
      volume: { value: volume, relTol: 1e-9 }, centroid: { value: centroid, absTol: 1e-9 },
    }] } }));
    return runCase(cad, file, () => {}).find(r => r.stage === 'expect');
  };
  try {
    assert.equal(check(500, [5, 5, 2.5]).status, 'OK');
    const volume = check(600, [5, 5, 2.5]);
    assert.equal(volume.status, 'WRONG'); assert.match(volume.detail, /volume/);
    const centroid = check(500, [5, 5, 3.5]);
    assert.equal(centroid.status, 'WRONG'); assert.match(centroid.detail, /centroid/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('robustness STEP validation properties are checked and a wrong volume is detected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rb-gvp-')), file = join(dir, 'box.step');
  const doc = { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [
    { id: 's', kind: 'sketch', profile: 'rectangle', min: [0, 0], max: [10, 10] }, { id: 'e', kind: 'extrude', sketch: 's', height: 5 }] };
  try {
    const step = cad.exportStep(cad.outputOf(cad.evaluateCadPart(doc), 'e').brep);
    writeFileSync(file, step);
    const valid = runCase(cad, file, () => {}).find(r => r.stage === 'gvp');
    assert.equal(valid.status, 'OK'); assert.notEqual(valid.detail, 'no validation properties');
    const wrong = step.replace(/VOLUME_MEASURE\([^)]+\)/, 'VOLUME_MEASURE(1000.)');
    assert.notEqual(wrong, step, 'the test must change a validation value');
    writeFileSync(file, wrong);
    const invalid = runCase(cad, file, () => {}).find(r => r.stage === 'gvp');
    assert.equal(invalid.status, 'WRONG'); assert.match(invalid.detail, /volume off/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
