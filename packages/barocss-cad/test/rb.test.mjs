import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as cad from '../dist/index.js';
import { classifyError, openEdges, runCase } from '../scripts/rb/stages.mjs';

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
  assert.deepEqual(rows.map(r => `${r.stage}:${r.status}`), ['evaluate:OK', 'validate:OK', 'mass:OK', 'tessellate:OK']);
  assert.deepEqual(started, ['evaluate', 'validate', 'mass', 'tessellate']);
  // A conformance case that expects outputs but is refused is WRONG, not an acceptable refusal.
  writeFileSync(file, JSON.stringify({ input: { partDocument: { format: 'barocss-cad-part', version: 1, units: 'mm', parameters: {}, features: [{ id: 'e', kind: 'extrude', sketch: 'nope', height: 5 }] } }, expect: { outputs: [] } }));
  assert.equal(runCase(cad, file, () => {})[0].status, 'WRONG');
});
