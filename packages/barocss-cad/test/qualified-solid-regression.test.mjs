import assert from 'node:assert/strict';
import test from 'node:test';
import { buildAxisRectangleExtrusion, validateAxisBoxSolid } from '../dist/index.js';

// Actual authored/native construction, not a synthetic shell or preview mesh.
test('qualified native Solid corpus: positive certificate, negative edge-use corruption, unchanged source', () => {
  const native = buildAxisRectangleExtrusion({
    bodyId: 'regression_body',
    profile: { kind: 'rectangle', id: 'regression_profile', origin: [4, -3], width: 7, height: 5 },
    distance: 6,
  });
  const shell = native.shell;
  const before = structuredClone(shell);
  const certified = validateAxisBoxSolid(shell);
  assert.equal(certified.valid, true);
  assert.equal(certified.solid, true);
  assert.equal(certified.geometryFamily, 'exact-axis-box-solid-v0');
  assert.equal(certified.volumeMM3, 210);
  assert.equal(certified.areaMM2, 214);
  const corrupt = structuredClone(shell);
  assert.ok(corrupt.edges.length > 0 && corrupt.edges[0].uses.length === 2);
  corrupt.edges[0].uses[1].sense = corrupt.edges[0].uses[0].sense;
  assert.throws(() => validateAxisBoxSolid(corrupt), /Axis box solid gate|Axis box shell|edge|incidence|sense/i);
  assert.deepEqual(shell, before, 'corrupting a copied shell must not mutate accepted source');
  assert.deepEqual(validateAxisBoxSolid(shell), certified, 'positive native proof must remain stable');
});
