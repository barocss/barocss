import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
