import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { readRefusalSource } from '../scripts/refusal-source.mjs';
const ts = createRequire(resolve(import.meta.dirname, '../../../package.json'))('typescript');

test('refusal generator: declared codes and both factory signatures retain message boundaries', () => {
  const source = "export const CAD_ERROR_CODES = ['INPUT', 'GEOMETRY'] as const;\n"
    + "kernelRefusal('solid-mass', 'SOLID_MASS', `mass ${value} is invalid`);\n"
    + "problem('MOUNT_RANGE', '[MOUNT_RANGE] invalid mount');\n"
    + "refusal('DENSITY', words);\n"
    + "// '[FAKE_CODE] a comment is not a refusal'\n";
  const result = readRefusalSource(ts, 'fixture.ts', source);
  assert.deepEqual(result.declared, ['INPUT', 'GEOMETRY']);
  assert.ok(result.literals.includes('[SOLID_MASS] mass … is invalid'));
  assert.equal(result.literals.filter(x => x === '[MOUNT_RANGE] invalid mount').length, 1);
  assert.ok(result.literals.includes('[DENSITY] …'));
  assert.ok(result.literals.every(x => !x.includes('FAKE_CODE')));
  assert.deepEqual(readRefusalSource(ts, 'fixture.ts', "const OTHER_CODES = ['FALSE_CODE']").declared, []);
});
