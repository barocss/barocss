import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAxisRectangleExtrusion } from '../dist/index.js';
import { qualifyKnownSolid } from '../dist/known-solid-qualification.js';

const request = { bodyId: 'qualified_body', profile: { kind: 'rectangle', id: 'qualified_profile', origin: [4, -3], width: 7, height: 5 }, distance: 6 };

test('known Solid qualification delegates to a real axis-box native proof', () => {
  const result = buildAxisRectangleExtrusion(request);
  const certified = qualifyKnownSolid({ family: 'exact-axis-box-solid-v0', source: result.shell });
  assert.equal(certified.status, 'certified');
  assert.equal(certified.family, 'exact-axis-box-solid-v0');
  assert.equal(certified.method, 'exact-safe-integer');
  assert.equal(certified.nativeReport.valid, true);
  assert.equal(certified.nativeReport.volumeMM3, 210);
  assert.equal(certified.nativeReport.areaMM2, 214);
});

test('known Solid qualification refuses missing, invalid and unknown native sources', () => {
  for (const request of [null, 0, 'box', {}, { family: 'unsupported', source: {} }]) {
    const answer = qualifyKnownSolid(request);
    assert.equal(answer.status, 'refused');
    assert.equal(answer.family, 'unsupported');
  }
  const invalid = qualifyKnownSolid({ family: 'exact-axis-box-solid-v0', source: {} });
  assert.equal(invalid.status, 'refused');
  assert.equal(invalid.family, 'exact-axis-box-solid-v0');
  assert.equal(typeof invalid.code, 'string');
  assert.equal(typeof invalid.detail, 'string');
});
