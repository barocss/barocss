import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAxisRectangleExtrusion, qualifyKnownSolid } from '../dist/index.js';

test('package root qualifies only the native axis-box family', () => {
  const body = buildAxisRectangleExtrusion({
    bodyId: 'public_body',
    profile: { kind: 'rectangle', id: 'public_profile', origin: [4, -3], width: 7, height: 5 },
    distance: 6,
  });
  const result = qualifyKnownSolid({ kind: 'solid', family: 'exact-axis-box-solid-v0', source: body.shell });
  assert.equal(result.status, 'certified');
  assert.equal(result.kind, 'solid');
  assert.equal(result.method, 'exact-safe-integer');
  assert.equal(result.nativeReport.volumeMM3, 210);
  assert.equal(result.nativeReport.areaMM2, 214);

  const legacy = qualifyKnownSolid({ family: 'exact-axis-box-solid-v0', source: body.shell });
  assert.deepEqual(legacy, result);
});

test('package root refuses Wire, Sheet and Shell with typed unsupported diagnostics', () => {
  for (const kind of ['wire', 'sheet', 'shell']) {
    const result = qualifyKnownSolid({ kind, source: { sampledPreview: true } });
    assert.equal(result.status, 'refused');
    assert.equal(result.requestedKind, kind);
    assert.equal(result.reason, 'unsupported-kind');
    assert.equal(result.code, `UNSUPPORTED_${kind.toUpperCase()}`);
    assert.deepEqual(result.notCertifiedChecks, ['incidence', 'orientation', 'trim', 'closure']);
  }
});

test('unknown family and sampled preview cannot be certified as a Solid', () => {
  const unsupported = qualifyKnownSolid({ kind: 'solid', family: 'sampled-preview', source: { triangles: [] } });
  assert.equal(unsupported.status, 'refused');
  assert.equal(unsupported.reason, 'unsupported-family');
  assert.equal(unsupported.requestedKind, 'solid');

  const masquerade = qualifyKnownSolid({ kind: 'solid', family: 'exact-axis-box-solid-v0', source: { triangles: [] } });
  assert.equal(masquerade.status, 'refused');
  assert.equal(masquerade.reason, 'native-validation');
  assert.equal(masquerade.requestedKind, 'solid');
  assert.equal(masquerade.family, 'exact-axis-box-solid-v0');
});
