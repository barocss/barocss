import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileMeshMaterial, lowerMeshMaterial, validateMeshMaterialIR, compileEngineUVMaterial, lowerEngineUVMaterial } from '../dist/index.js';

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

// This input variant previously fell through to sample lowering; cover the
// intended UV lowering path rather than testing only a constant color.
test('UV material input lowers to the declared interpolant', () => {
  const source = '@shader #uvtest { @fragment { color: mix(#000000,#FFFFFF,uv_u); } }';
  const compiled = compileEngineUVMaterial(source);
  assert.equal(compiled.ok, true, JSON.stringify(compiled));
  if (!compiled.ok) return;
  const lowered = lowerEngineUVMaterial(compiled.material);
  assert.equal(lowered.inputDeclarations, 'in vec2 v_engine_uv;');
  assert.match(lowered.expression, /v_engine_uv\.x/);
  assert.ok(!lowered.expression.includes('mat_s_0'));
});
