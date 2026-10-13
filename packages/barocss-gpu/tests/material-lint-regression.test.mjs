import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileMeshMaterial, lowerMeshMaterial, validateMeshMaterialIR } from '../dist/index.js';

// Regression boundary for #1670: valid typed lowering must still succeed after
// eliminating the material input-switch fallthrough and empty-interface lint.
test('valid material is validated and lowered without changing its source', () => {
  const source = '@shader #solid { @fragment { color: #204080; } }';
  const compiled = compileMeshMaterial(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled));
  if (!compiled.ok) return;
  const validated = validateMeshMaterialIR(compiled.material);
  assert.deepEqual(validated, compiled.material);
  const lowered = lowerMeshMaterial(validated);
  assert.match(lowered.expression, /^clamp\(/);
  assert.ok(lowered.expression.includes('vec3('));
  assert.equal(validated.source, source);
});
